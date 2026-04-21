import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';

/**
 * PATCH /api/devices/[siteId]/display-name
 * Body: { displayName: string }
 *
 * Sets a custom display label for the device in the dashboard.
 * Does NOT touch Victron VRM — only updates the local display_name column.
 * Restricted to users who have this device assigned to their account.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { siteId: string } }
) {
  const supabase    = createClient();
  const adminClient = createAdminClient();

  // Verify caller is authenticated
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { displayName } = await request.json();
  if (typeof displayName !== 'string') {
    return NextResponse.json({ error: 'displayName must be a string' }, { status: 400 });
  }

  const trimmed = displayName.trim().slice(0, 80); // max 80 chars

  // Verify the caller has this device assigned to them
  const { data: assignment } = await adminClient
    .from('device_assignments')
    .select('device_id, vrm_devices!inner(id, vrm_site_id)')
    .eq('user_id', user.id)
    .eq('vrm_devices.vrm_site_id', params.siteId)
    .maybeSingle();

  if (!assignment) {
    return NextResponse.json({ error: 'Device not found or not assigned to you' }, { status: 404 });
  }

  // Update display_name — null when cleared so it falls back to VRM name
  const { error } = await adminClient
    .from('vrm_devices')
    .update({ display_name: trimmed || null })
    .eq('vrm_site_id', params.siteId);

  if (error) {
    console.error('[display-name] update error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ displayName: trimmed || null });
}
