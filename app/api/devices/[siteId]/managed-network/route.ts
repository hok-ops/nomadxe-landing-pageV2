import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { assertVrmSiteAccess } from '@/lib/vrmAccess';
import type { ManagedNetworkStatus } from '@/lib/networkDevices';

export async function GET(
  _request: Request,
  { params }: { params: { siteId: string } }
) {
  const access = await assertVrmSiteAccess(params.siteId);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const adminClient = createAdminClient();
  const { data: managedRows, error: managedError } = await adminClient
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

  if (managedError) {
    console.error('[managed-network] managed list error:', managedError.message);
    return NextResponse.json({ error: 'Failed to load managed network devices' }, { status: 500 });
  }

  const { data: discoveredRows, error: discoveredError } = await adminClient
    .from('discovered_network_devices')
    .select(`
      id,
      vrm_device_id,
      ip_address,
      mac_address,
      hostname,
      last_status,
      first_seen_at,
      last_seen_at,
      last_latency_ms,
      last_detail,
      is_ignored,
      vrm_devices!inner(vrm_site_id)
    `)
    .eq('vrm_devices.vrm_site_id', params.siteId)
    .eq('is_ignored', false)
    .order('last_seen_at', { ascending: false });

  if (discoveredError) {
    console.error('[managed-network] discovered list error:', discoveredError.message);
    return NextResponse.json({ error: 'Failed to load discovered network devices' }, { status: 500 });
  }

  const managedDevices = (managedRows ?? []).map((device: any) => ({
    id: Number(device.id),
    vrmDeviceId: Number(device.vrm_device_id),
    name: String(device.name),
    ipAddress: String(device.ip_address),
    alertOnOffline: Boolean(device.alert_on_offline),
    isActive: Boolean(device.is_active),
    lastStatus: String(device.last_status) as ManagedNetworkStatus,
    lastReportedAt: device.last_reported_at ? String(device.last_reported_at) : null,
    lastChangeAt: device.last_change_at ? String(device.last_change_at) : null,
    lastLatencyMs: typeof device.last_latency_ms === 'number' ? device.last_latency_ms : null,
    lastDetail: device.last_detail ? String(device.last_detail) : null,
  }));

  const managedIps = new Set(
    managedDevices.map((device) => `${device.vrmDeviceId}:${device.ipAddress}`)
  );

  return NextResponse.json({
    devices: managedDevices,
    discoveredDevices: (discoveredRows ?? []).map((device: any) => {
      const vrmDeviceId = Number(device.vrm_device_id);
      const ipAddress = String(device.ip_address);
      return {
        id: Number(device.id),
        vrmDeviceId,
        ipAddress,
        macAddress: device.mac_address ? String(device.mac_address) : null,
        hostname: device.hostname ? String(device.hostname) : null,
        lastStatus: String(device.last_status) as ManagedNetworkStatus,
        firstSeenAt: String(device.first_seen_at),
        lastSeenAt: String(device.last_seen_at),
        lastLatencyMs: typeof device.last_latency_ms === 'number' ? device.last_latency_ms : null,
        lastDetail: device.last_detail ? String(device.last_detail) : null,
        isIgnored: Boolean(device.is_ignored),
        isManaged: managedIps.has(`${vrmDeviceId}:${ipAddress}`),
      };
    }),
  });
}
