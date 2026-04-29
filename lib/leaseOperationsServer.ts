import { createAdminClient } from '@/utils/supabase/admin';
import {
  buildSyntheticLeaseOperations,
  normalizeLeaseOperationsRows,
  type DashboardDeviceRef,
  type LeaseOperationsData,
} from '@/lib/leaseOperations';
import type { VRMData } from '@/lib/vrm';
import type { AssetIntelligence } from '@/lib/assetIntelligence';

export async function fetchLeaseOperationsForDashboard({
  userId,
  devices,
  dataMap,
  assetIntelligence,
}: {
  userId: string;
  devices: DashboardDeviceRef[];
  dataMap: Record<string, VRMData | null>;
  assetIntelligence: AssetIntelligence[];
}): Promise<LeaseOperationsData> {
  const fallback = () => buildSyntheticLeaseOperations(devices, dataMap, assetIntelligence);
  if (devices.length === 0) return fallback();

  const adminClient = createAdminClient();
  const siteIds = devices.map((device) => device.siteId);

  try {
    const { data: deviceRows, error: deviceError } = await adminClient
      .from('vrm_devices')
      .select('id, vrm_site_id, name, display_name, teltonika_rms_device_id, router_access_url')
      .in('vrm_site_id', siteIds);

    if (deviceError) {
      console.warn('[lease-operations] device lookup failed:', deviceError.message);
      return fallback();
    }

    const deviceIds = (deviceRows ?? []).map((device: any) => Number(device.id)).filter(Number.isFinite);
    if (deviceIds.length === 0) return fallback();

    const { data: leaseAssets, error: leaseAssetError } = await adminClient
      .from('lease_assets')
      .select('lease_id')
      .in('vrm_device_id', deviceIds);

    if (leaseAssetError) {
      console.warn('[lease-operations] lease table unavailable:', leaseAssetError.message);
      return fallback();
    }

    const leaseIds = Array.from(new Set((leaseAssets ?? []).map((row: any) => String(row.lease_id)).filter(Boolean)));

    const [leasesResult, customerTicketsResult, deviceTicketsResult, proofResult, accessResult] = await Promise.all([
      leaseIds.length > 0
        ? adminClient
            .from('customer_leases')
            .select(`
              id,
              lease_number,
              package_type,
              status,
              site_name,
              site_address,
              service_level,
              monitoring_partner,
              starts_on,
              ends_on,
              lease_assets(
                role,
                vrm_devices(id, vrm_site_id, name, display_name, teltonika_rms_device_id, router_access_url)
              )
            `)
            .in('id', leaseIds)
            .order('status', { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      adminClient
        .from('service_tickets')
        .select('id, lease_id, vrm_device_id, type, priority, status, title, description, requested_for, customer_visible_note, created_at')
        .eq('customer_id', userId)
        .order('created_at', { ascending: false })
        .limit(12),
      adminClient
        .from('service_tickets')
        .select('id, lease_id, vrm_device_id, type, priority, status, title, description, requested_for, customer_visible_note, created_at')
        .in('vrm_device_id', deviceIds)
        .order('created_at', { ascending: false })
        .limit(12),
      adminClient
        .from('proof_of_service_events')
        .select('id, lease_id, vrm_device_id, event_type, severity, title, summary, evidence, occurred_at')
        .in('vrm_device_id', deviceIds)
        .order('occurred_at', { ascending: false })
        .limit(16),
      adminClient
        .from('remote_access_audit_events')
        .select('id, vrm_device_id, access_type, status, actor_role, reason, created_at')
        .in('vrm_device_id', deviceIds)
        .order('created_at', { ascending: false })
        .limit(8),
    ]);

    if (leasesResult.error || customerTicketsResult.error || deviceTicketsResult.error || proofResult.error || accessResult.error) {
      console.warn(
        '[lease-operations] partial load failed:',
        leasesResult.error?.message ?? customerTicketsResult.error?.message ?? deviceTicketsResult.error?.message ?? proofResult.error?.message ?? accessResult.error?.message
      );
      return fallback();
    }

    const ticketsById = new Map<string, any>();
    for (const ticket of [...(customerTicketsResult.data ?? []), ...(deviceTicketsResult.data ?? [])]) {
      ticketsById.set(String(ticket.id), ticket);
    }

    const normalized = normalizeLeaseOperationsRows({
      devices,
      leases: leasesResult.data ?? [],
      tickets: Array.from(ticketsById.values()).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, 12),
      proofEvents: proofResult.data ?? [],
      accessEvents: accessResult.data ?? [],
    });

    if (normalized.leases.length === 0 && normalized.tickets.length === 0 && normalized.proofEvents.length === 0) {
      return fallback();
    }

    return normalized;
  } catch (error) {
    console.warn('[lease-operations] falling back to telemetry-derived view:', error);
    return fallback();
  }
}
