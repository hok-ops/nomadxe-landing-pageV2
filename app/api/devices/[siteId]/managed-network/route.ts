import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { assertVrmSiteAccess } from '@/lib/vrmAccess';

export async function GET(
  _request: Request,
  { params }: { params: { siteId: string } }
) {
  const access = await assertVrmSiteAccess(params.siteId);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from('managed_network_devices')
    .select(`
      id,
      vrm_device_id,
      name,
      ip_address,
      alert_on_offline,
      is_active,
      last_status,
      last_reported_at,
      last_change_at,
      last_latency_ms,
      last_detail,
      vrm_devices!inner(vrm_site_id)
    `)
    .eq('vrm_devices.vrm_site_id', params.siteId)
    .eq('is_active', true)
    .order('last_status', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    console.error('[managed-network] list error:', error.message);
    return NextResponse.json({ error: 'Failed to load managed network devices' }, { status: 500 });
  }

  return NextResponse.json({
    devices: (data ?? []).map((device: any) => ({
      id: Number(device.id),
      vrmDeviceId: Number(device.vrm_device_id),
      name: String(device.name),
      ipAddress: String(device.ip_address),
      alertOnOffline: Boolean(device.alert_on_offline),
      isActive: Boolean(device.is_active),
      lastStatus: String(device.last_status),
      lastReportedAt: device.last_reported_at ? String(device.last_reported_at) : null,
      lastChangeAt: device.last_change_at ? String(device.last_change_at) : null,
      lastLatencyMs: typeof device.last_latency_ms === 'number' ? device.last_latency_ms : null,
      lastDetail: device.last_detail ? String(device.last_detail) : null,
    }),
  });
}
