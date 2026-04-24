import { NextRequest, NextResponse } from 'next/server';
import { fetchVRMDetail } from '@/lib/vrm';
import { assertVrmSiteAccess } from '@/lib/vrmAccess';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { siteId: string } }
) {
  const { siteId } = params;
  const access = await assertVrmSiteAccess(siteId);

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    const data = await fetchVRMDetail(siteId);
    return NextResponse.json({ data, ok: true });
  } catch (err: any) {
    console.error(`[VRM details] ${siteId}:`, err.message);
    return NextResponse.json({ error: 'Detailed telemetry unavailable', ok: false }, { status: 502 });
  }
}
