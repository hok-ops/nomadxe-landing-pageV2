import { NextRequest, NextResponse } from 'next/server';
import { fetchVRMRaw } from '@/lib/vrm';
import { assertVrmSiteAccess } from '@/lib/vrmAccess';

export const dynamic = 'force-dynamic';

const RANGE_TO_SECONDS: Record<string, number> = {
  '24h': 24 * 3_600,
  '7d': 7 * 24 * 3_600,
  '30d': 30 * 24 * 3_600,
};

function filenameFor(kind: string, siteId: string) {
  const stamp = new Date().toISOString().slice(0, 10);
  if (kind === 'gps-kml') return `vrm-site-${siteId}-gps-${stamp}.kml`;
  if (kind === 'xlsx') return `vrm-site-${siteId}-telemetry-${stamp}.xlsx`;
  return `vrm-site-${siteId}-telemetry-${stamp}.csv`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { siteId: string } }
) {
  const { siteId } = params;
  const access = await assertVrmSiteAccess(siteId);

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const url = new URL(request.url);
  // Allowlist kind to prevent unexpected values reaching VRM's format param
  const rawKind = url.searchParams.get('kind') ?? 'csv';
  const kind = ['csv', 'xlsx', 'gps-kml'].includes(rawKind) ? rawKind : 'csv';
  const range = url.searchParams.get('range') ?? '7d';
  const now = Math.floor(Date.now() / 1000);
  const span = RANGE_TO_SECONDS[range] ?? RANGE_TO_SECONDS['7d'];
  const rawStart = Number(url.searchParams.get('start'));
  const rawEnd   = Number(url.searchParams.get('end'));
  const start = Number.isFinite(rawStart) && rawStart > 0 ? Math.floor(rawStart) : now - span;
  const end   = Number.isFinite(rawEnd)   && rawEnd   > 0 ? Math.floor(rawEnd)   : now;

  try {
    const vrmPath =
      kind === 'gps-kml'
        ? `/installations/${siteId}/gps-download?start=${start}&end=${end}`
        : `/installations/${siteId}/data-download?start=${start}&end=${end}&datatype=log&format=${kind === 'xlsx' ? 'xlsx' : 'csv'}`;

    const upstream = await fetchVRMRaw(vrmPath);
    const contentType = upstream.headers.get('content-type') ?? (
      kind === 'gps-kml'
        ? 'application/vnd.google-earth.kml+xml'
        : kind === 'xlsx'
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'text/csv; charset=utf-8'
    );

    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filenameFor(kind, siteId)}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err: any) {
    console.error(`[VRM export] ${siteId}:`, err.message);
    return NextResponse.json({ error: 'Export unavailable' }, { status: 502 });
  }
}
