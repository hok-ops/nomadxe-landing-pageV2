import { NextRequest, NextResponse } from 'next/server';
import { fetchVRMDetail } from '@/lib/vrm';
import { assertVrmSiteAccess } from '@/lib/vrmAccess';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';

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
    !checkRateLimit(`vrm-detail:user:${access.userId}:${siteId}`, 12, 60_000) ||
    !checkRateLimit(`vrm-detail:ip:${ip}:${siteId}`, 30, 60_000)
  ) {
    return NextResponse.json({ error: 'Detailed telemetry refresh limit reached. Please wait before trying again.' }, { status: 429 });
  }

  try {
    const data = await fetchVRMDetail(siteId);
    return NextResponse.json({ data, ok: true });
  } catch (err: any) {
    console.error(`[VRM details] ${siteId}:`, err.message);
    return NextResponse.json({ error: 'Detailed telemetry unavailable', ok: false }, { status: 502 });
  }
}
