/**
 * GET /api/vrm/[siteId]/debug
 *
 * Admin-only diagnostic route. Returns the full raw VRM API response for both
 * diagnostics and stats endpoints so we can verify attribute codes and response shape.
 *
 * ONLY available when ENABLE_DEBUG_ROUTES=true is set in the environment.
 * Never enabled in production unless explicitly opted in.
 *
 * Usage: open in browser while logged in as admin:
 *   https://www.nomadxe.com/api/vrm/810801/debug
 */
import { NextRequest, NextResponse } from 'next/server';
import { fetchVRM } from '@/lib/vrm';
import { getAdminUser } from '@/lib/auth/getAdminUser';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  // Gate: only available when explicitly enabled — never on production by default.
  if (process.env.ENABLE_DEBUG_ROUTES !== 'true') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const caller = await getAdminUser();
  if (!caller) {
    return NextResponse.json({ error: 'Unauthorized — admin only' }, { status: 401 });
  }

  const { siteId } = await params;
  if (!/^\d+$/.test(siteId)) {
    return NextResponse.json({ error: 'Invalid site ID' }, { status: 400 });
  }

  const now         = Math.floor(Date.now() / 1000);
  const threeHrsAgo = now - 3 * 3_600;

  // -- Diagnostics -------------------------------------------------------------
  let diagBody: unknown = null;
  let diagError: string | null = null;
  try {
    diagBody = await fetchVRM(`/installations/${siteId}/diagnostics`);
  } catch (e: unknown) {
    diagError = e instanceof Error ? e.message : String(e);
  }

  const records: unknown[] = Array.isArray((diagBody as any)?.records)
    ? (diagBody as any).records
    : [];

  const attributes = (records as any[])
    .map((r: any) => ({
      id:          r.idDataAttribute,
      description: r.description,
      value:       r.formatWithUnit,
      raw:         r.rawValue,
      service:     r.dbusServiceType,
      path:        r.dbusPath,
      ts:          r.timestamp,
    }))
    .sort((a: any, b: any) => a.id - b.id);

  // -- Stats (3h @ 15min — mirrors production query) --------------------------
  const statsPath =
    `/installations/${siteId}/stats` +
    `?type=custom&attributeCodes[]=442&attributeCodes[]=113&attributeCodes[]=51` +
    `&interval=15mins&start=${threeHrsAgo}&end=${now}`;

  let statsBody: unknown = null;
  let statsError: string | null = null;
  try {
    statsBody = await fetchVRM(statsPath);
  } catch (e: unknown) {
    statsError = e instanceof Error ? e.message : String(e);
  }

  // Summarise the shape of each attribute entry for easy inspection
  const statsShapes: Record<string, string> = {};
  const statsRecords = (statsBody as any)?.records;
  if (statsRecords && typeof statsRecords === 'object' && !Array.isArray(statsRecords)) {
    for (const [k, v] of Object.entries(statsRecords)) {
      if (v === false || v === null) {
        statsShapes[k] = 'false — no data';
      } else if (Array.isArray(v)) {
        statsShapes[k] = `array[${(v as unknown[]).length}]`;
      } else if (v && typeof v === 'object') {
        statsShapes[k] = `object{${Object.keys(v as object).join(', ')}}`;
      } else {
        statsShapes[k] = String(v);
      }
    }
  }

  return NextResponse.json({
    siteId,
    diag_error:       diagError,
    diag_success:     (diagBody as any)?.success,
    total_attributes: attributes.length,
    attributes,
    stats_error:      statsError,
    stats_success:    (statsBody as any)?.success,
    stats_records_type: Array.isArray(statsRecords) ? 'array' : typeof statsRecords,
    stats_attr_shapes:  statsShapes,
    stats_raw:          statsBody,
  });
}
