import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { fetchVRMData } from '@/lib/vrm';

// Re-export VRMData type so DashboardClient can import from this route path
export type { VRMData } from '@/lib/vrm';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { siteId: string } }
) {
  const { siteId } = params;

  if (!/^\d+$/.test(siteId)) {
    return NextResponse.json({ error: 'Invalid site ID' }, { status: 400 });
  }

  const supabase    = createClient();
  const adminClient = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Verify the user is assigned to this device OR is an admin
  const [{ data: assignment }, { data: profile }] = await Promise.all([
    adminClient
      .from('device_assignments')
      .select('id, vrm_devices!inner(vrm_site_id)')
      .eq('user_id', user.id)
      .eq('vrm_devices.vrm_site_id', siteId)
      .maybeSingle(),
    adminClient.from('profiles').select('role').eq('id', user.id).single(),
  ]);

  if (!assignment && profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const data = await fetchVRMData(siteId);
    return NextResponse.json({ data, ok: true });
  } catch (err: any) {
    // Log full error server-side; return only a generic message to the client
    // to avoid leaking internal VRM API details (installation IDs, token status, etc.)
    console.error(`[VRM] ${siteId}:`, err.message);
    return NextResponse.json({ error: 'Telemetry unavailable', ok: false }, { status: 502 });
  }
}
