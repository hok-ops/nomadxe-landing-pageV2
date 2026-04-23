/**
 * GET /api/vrm/[siteId]/debug
 *
 * Admin-only diagnostic route. Returns the full raw VRM API response so we
 * can identify which idDataAttribute codes are present for a given installation
 * and verify the token/auth is working.
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
  const base = `https://vrmapi.victronenergy.com/v2`;
  const headers = { 'X-Authorization': `Token ${token}` };

  // Hit diagnostics endpoint
  const diagUrl = `${base}/installations/${siteId}/diagnostics`;
  let diagStatus = 0, diagBody: any = null, diagError: string | null = null;
  try {
    const res = await fetch(diagUrl, { headers, cache: 'no-store' });
    diagStatus = res.status;
    diagBody   = await res.json();
  } catch (e: any) {
    diagError = e.message;
  }

  // Summarise attributes found (sorted by idDataAttribute)
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

  return NextResponse.json({
    siteId,
    token_prefix: 'Token (✓)',
    diag_url:    diagUrl,
    diag_status: diagStatus,
    diag_error:  diagError,
    success:     diagBody?.success,
    total_attributes: attributes.length,
    attributes,          // full list — inspect to find the IDs we need
    raw_diag: diagBody,  // full raw response if something looks off
  }, { status: 200 });
}
