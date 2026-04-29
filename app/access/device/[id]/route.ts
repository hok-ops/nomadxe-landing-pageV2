import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { assertTeltonikaRmsDeviceAccess } from '@/lib/vrmAccess';
import { createRemoteWebUiSession, getGatewayBearerToken, TeltonikaRmsError } from '@/lib/teltonikaRms';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { createAdminClient } from '@/utils/supabase/admin';

export const dynamic = 'force-dynamic';

function hasSameOrigin(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (!origin) return true;

  try {
    return new URL(origin).origin === request.nextUrl.origin;
  } catch {
    return false;
  }
}

function hasValidGatewayBearerToken(request: NextRequest) {
  const expected = getGatewayBearerToken();
  if (!expected) return false;

  const header = request.headers.get('authorization') ?? '';
  return header === `Bearer ${expected}`;
}

async function recordAccessAudit({
  deviceId,
  userId,
  role,
  status,
  reason,
  userAgent,
}: {
  deviceId: string;
  userId: string | null;
  role: string;
  status: 'requested' | 'granted' | 'denied' | 'failed';
  reason?: string;
  userAgent: string | null;
}) {
  try {
    const adminClient = createAdminClient();
    const { data: device } = await adminClient
      .from('vrm_devices')
      .select('id')
      .eq('teltonika_rms_device_id', deviceId)
      .maybeSingle();

    await adminClient.from('remote_access_audit_events').insert({
      actor_user_id: userId,
      actor_role: role,
      vrm_device_id: device?.id ?? null,
      teltonika_rms_device_id: deviceId,
      access_type: 'teltonika_remote_webui',
      status,
      reason: reason ?? null,
      user_agent_hash: userAgent ? createHash('sha256').update(userAgent).digest('hex') : null,
    });
  } catch (error) {
    console.warn('[access-audit] unable to record modem access event:', error);
  }
}

export async function GET() {
  return NextResponse.json(
    { ok: false, error: 'Use POST to open a modem session.' },
    { status: 405, headers: { Allow: 'POST' } }
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: deviceId } = await params;

  const hasGatewayBearer = hasValidGatewayBearerToken(request);
  let actorUserId: string | null = null;
  let actorRole = hasGatewayBearer ? 'gateway' : 'user';

  if (!hasGatewayBearer) {
    if (!hasSameOrigin(request)) {
      await recordAccessAudit({
        deviceId,
        userId: null,
        role: 'unknown',
        status: 'denied',
        reason: 'Cross-origin modem session request blocked',
        userAgent: request.headers.get('user-agent'),
      });
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    const access = await assertTeltonikaRmsDeviceAccess(deviceId);
    if (!access.ok) {
      await recordAccessAudit({
        deviceId,
        userId: null,
        role: 'unknown',
        status: 'denied',
        reason: access.error,
        userAgent: request.headers.get('user-agent'),
      });
      return NextResponse.json({ ok: false, error: access.error }, { status: access.status });
    }
    actorUserId = access.userId;
    actorRole = access.role;

    const ip = getClientIp(request);
    if (
      !checkRateLimit(`modem-session:user:${actorUserId}:${deviceId}`, 3, 5 * 60_000) ||
      !checkRateLimit(`modem-session:ip:${ip}:${deviceId}`, 6, 5 * 60_000)
    ) {
      await recordAccessAudit({
        deviceId,
        userId: actorUserId,
        role: actorRole,
        status: 'denied',
        reason: 'Remote modem session rate limit reached',
        userAgent: request.headers.get('user-agent'),
      });
      return NextResponse.json({ ok: false, error: 'Too many modem session requests. Please wait before trying again.' }, { status: 429 });
    }
  }

  try {
    await recordAccessAudit({
      deviceId,
      userId: actorUserId,
      role: actorRole,
      status: 'requested',
      reason: 'Remote modem WebUI session requested',
      userAgent: request.headers.get('user-agent'),
    });
    const session = await createRemoteWebUiSession(deviceId);
    await recordAccessAudit({
      deviceId,
      userId: actorUserId,
      role: actorRole,
      status: 'granted',
      reason: 'Teltonika RMS session created',
      userAgent: request.headers.get('user-agent'),
    });
    return NextResponse.redirect(session.url, { status: 302 });
  } catch (error) {
    await recordAccessAudit({
      deviceId,
      userId: actorUserId,
      role: actorRole,
      status: 'failed',
      reason: error instanceof Error ? error.message : 'Unexpected modem access gateway error',
      userAgent: request.headers.get('user-agent'),
    });
    if (error instanceof TeltonikaRmsError) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { ok: false, error: 'Unexpected modem access gateway error' },
      { status: 502 }
    );
  }
}
