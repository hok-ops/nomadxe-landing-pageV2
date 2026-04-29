import { NextRequest, NextResponse } from 'next/server';
import { assertTeltonikaRmsDeviceAccess } from '@/lib/vrmAccess';
import { createRemoteWebUiSession, getGatewayBearerToken, TeltonikaRmsError } from '@/lib/teltonikaRms';

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

  if (!hasGatewayBearer) {
    if (!hasSameOrigin(request)) {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    const access = await assertTeltonikaRmsDeviceAccess(deviceId);
    if (!access.ok) {
      return NextResponse.json({ ok: false, error: access.error }, { status: access.status });
    }
  }

  try {
    const session = await createRemoteWebUiSession(deviceId);
    return NextResponse.redirect(session.url, { status: 302 });
  } catch (error) {
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
