import { NextRequest, NextResponse } from 'next/server';
import { assertTeltonikaRmsDeviceAccess } from '@/lib/vrmAccess';
import { createRemoteWebUiSession, getGatewayBearerToken, TeltonikaRmsError } from '@/lib/teltonikaRms';

export const dynamic = 'force-dynamic';

function hasValidGatewayBearerToken(request: NextRequest) {
  const expected = getGatewayBearerToken();
  if (!expected) return false;

  const header = request.headers.get('authorization') ?? '';
  return header === `Bearer ${expected}`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const deviceId = params.id;

  if (!hasValidGatewayBearerToken(request)) {
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
