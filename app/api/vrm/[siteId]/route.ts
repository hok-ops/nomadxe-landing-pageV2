import { NextRequest, NextResponse } from 'next/server';
import { fetchVRMData } from '@/lib/vrm';
import { resolveAndPersistDeviceLocation } from '@/lib/deviceLocation';
import { assertVrmSiteAccess } from '@/lib/vrmAccess';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';

// Re-export VRMData type so DashboardClient can import from this route path
export type { VRMData } from '@/lib/vrm';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const { siteId } = await params;
  const access = await assertVrmSiteAccess(siteId);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const ip = getClientIp(request);
  if (
    !checkRateLimit(`vrm-snapshot:user:${access.userId}:${siteId}`, 24, 60_000) ||
    !checkRateLimit(`vrm-snapshot:ip:${ip}:${siteId}`, 60, 60_000)
  ) {
    return NextResponse.json({ error: 'Telemetry refresh limit reached. Please wait before trying again.' }, { status: 429 });
  }

  try {
    const data = await fetchVRMData(siteId);
    const location = await resolveAndPersistDeviceLocation(siteId, data.lat, data.lon);
    return NextResponse.json({ data: { ...data, location }, ok: true });
  } catch (err: any) {
    // Log full error server-side; return only a generic message to the client
    // to avoid leaking internal VRM API details (installation IDs, token status, etc.)
    console.error(`[VRM] ${siteId}:`, err.message);
    return NextResponse.json({ error: 'Telemetry unavailable', ok: false }, { status: 502 });
  }
}
