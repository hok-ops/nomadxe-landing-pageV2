/**
 * GET /api/vrm/[siteId]/debug
 *
 * Admin-only diagnostic route. Returns the full raw VRM API response for both
 * diagnostics and stats endpoints so we can verify attribute codes and response shape.
 *
 * Usage: open in browser while logged in as admin:
 *   https://www.nomadxe.com/api/vrm/810801/debug
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';

export async function GET(
  request: NextRequest,
  { params }: { params: { siteId: string } }
) {
  const supabase    = createClient();
  const adminClient = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  const token = process.env.VICTRON_ADMIN_TOKEN;
  if (!token) {
    return NextResponse.json({ error: 'VICTRON_ADMIN_TOKEN not set in environment' }, { status: 500 });
  }

  const { siteId } = params;
  const base    = `https://vrmapi.victronenergy.com/v2`;
  const headers = { 'X-Authorization': `Token ${token}` };

  const now       = Math.floor(Date.now() / 1000);
  const sixHrsAgo = now - 6 * 3600;

  // ── Diagnostics ─────────────────────────────────────────────────────────────
  const diagUrl = `${base}/installations/${siteId}/diagnostics`;
  let diagStatus = 0, diagBody: any = null, diagError: string | null = null;
  try {
    const res = await fetch(diagUrl, { headers, cache: 'no-store' });
    diagStatus = res.status;
    diagBody   = await res.json();
  } catch (e: any) {
    diagError = e.message;
  }

  const records: any[] = diagBody?.records ?? [];
  const attributes = records
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

  // ── Stats (6h hourly) ────────────────────────────────────────────────────────
  const statsUrl =
    `${base}/installations/${siteId}/stats` +
    `?type=custom&attributeCodes[]=442&attributeCodes[]=51` +
    `&interval=hours&start=${sixHrsAgo}&end=${now}`;

  let statsStatus = 0, statsBody: any = null, statsError: string | null = null;
  try {
    const res = await fetch(statsUrl, { headers, cache: 'no-store' });
    statsStatus = res.status;
    statsBody   = await res.json();
  } catch (e: any) {
    statsError = e.message;
  }

  return NextResponse.json({
    siteId,
    token_ok:         true,
    // Diagnostics
    diag_url:         diagUrl,
    diag_status:      diagStatus,
    diag_error:       diagError,
    diag_success:     diagBody?.success,
    total_attributes: attributes.length,
    attributes,
    // Stats — inspect records shape to fix extractSparkline
    stats_url:        statsUrl,
    stats_status:     statsStatus,
    stats_error:      statsError,
    stats_success:    statsBody?.success,
    stats_records_type: Array.isArray(statsBody?.records) ? 'array' : typeof statsBody?.records,
    stats_raw:        statsBody,   // full raw stats response
  }, { status: 200 });
}
