import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import type { CerboNetworkScanPayload, ManagedNetworkStatus } from '@/lib/networkDevices';

type ManagedDeviceRow = {
  id: number;
  name: string;
  ip_address: string;
  last_status: ManagedNetworkStatus;
  alert_on_offline: boolean;
};

function getCerboIngestToken() {
  const token = process.env.CERBO_INGEST_TOKEN;
  if (!token) throw new Error('CERBO_INGEST_TOKEN not configured');
  return token;
}

function parseBearer(request: Request) {
  const auth = request.headers.get('authorization') ?? '';
  const [scheme, token] = auth.split(' ');
  return scheme?.toLowerCase() === 'bearer' ? token : null;
}

function isReportedStatus(value: unknown): value is CerboNetworkScanPayload['devices'][number]['status'] {
  return value === 'online' || value === 'offline';
}

function finiteNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function capText(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) || null : null;
}

async function sendAlertWebhook(payload: Record<string, unknown>) {
  const url = process.env.MAKE_NETWORK_ALERT_WEBHOOK_URL;
  if (!url) return;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      console.error('[cerbo-network-scan] alert webhook failed:', response.status, await response.text());
    }
  } catch (error) {
    console.error('[cerbo-network-scan] alert webhook error:', error);
  }
}

export async function POST(request: Request) {
  try {
    const token = parseBearer(request);
    if (!token || token !== getCerboIngestToken()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as CerboNetworkScanPayload;
    const reports = Array.isArray(body.devices) ? body.devices : [];
    const hasCellularReport = body.cellular && typeof body.cellular === 'object';
    if (!body?.vrmSiteId || (!hasCellularReport && reports.length === 0)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const observedAt = body.observedAt && Number.isFinite(Date.parse(body.observedAt))
      ? new Date(body.observedAt).toISOString()
      : new Date().toISOString();

    const adminClient = createAdminClient();
    const { data: vrmDevice, error: vrmError } = await adminClient
      .from('vrm_devices')
      .select('id, vrm_site_id, name, router_access_url')
      .eq('vrm_site_id', body.vrmSiteId)
      .maybeSingle();

    if (vrmError) {
      console.error('[cerbo-network-scan] vrm device lookup error:', vrmError.message);
      return NextResponse.json({ error: 'Lookup failed' }, { status: 500 });
    }
    if (!vrmDevice) {
      return NextResponse.json({ error: 'Unknown vrmSiteId' }, { status: 404 });
    }
    const vrmDeviceRow = vrmDevice;

    const { data: managedDevices, error: managedError } = await adminClient
      .from('managed_network_devices')
      .select('*')
      .eq('vrm_device_id', vrmDeviceRow.id)
      .eq('is_active', true);

    if (managedError) {
      console.error('[cerbo-network-scan] managed device lookup error:', managedError.message);
      return NextResponse.json({ error: 'Managed device lookup failed' }, { status: 500 });
    }

    const devicesByIp = new Map<string, ManagedDeviceRow>(
      (managedDevices ?? []).map((device: any) => [
        String(device.ip_address),
        {
          id: Number(device.id),
          name: String(device.name),
          ip_address: String(device.ip_address),
          last_status: String(device.last_status) as ManagedNetworkStatus,
          alert_on_offline: Boolean(device.alert_on_offline),
        },
      ])
    );

    let cellularInserted = false;

    if (hasCellularReport) {
      const cellular = body.cellular!;
      const observedCellular = {
        vrm_device_id: vrmDeviceRow.id,
        observed_at: observedAt,
        source: ['cerbo', 'teltonika_rms', 'router_api', 'manual'].includes(String(cellular.source))
          ? cellular.source
          : 'cerbo',
        operator: capText(cellular.operator, 120),
        network_type: capText(cellular.networkType, 64),
        band: capText(cellular.band, 64),
        rssi_dbm: finiteNumber(cellular.rssiDbm),
        rsrp_dbm: finiteNumber(cellular.rsrpDbm),
        rsrq_db: finiteNumber(cellular.rsrqDb),
        sinr_db: finiteNumber(cellular.sinrDb),
        connection_state: capText(cellular.connectionState, 120),
        detail: capText(cellular.detail, 500),
      };

      const hasSignalValue = [
        observedCellular.rssi_dbm,
        observedCellular.rsrp_dbm,
        observedCellular.rsrq_db,
        observedCellular.sinr_db,
      ].some((value) => value !== null);

      if (hasSignalValue) {
        const { error: cellularError } = await adminClient
          .from('cellular_signal_reports')
          .insert(observedCellular);

        if (cellularError) {
          console.error('[cerbo-network-scan] cellular report insert error:', cellularError.message);
        } else {
          cellularInserted = true;
        }
      }
    }

    let updated = 0;
    let discovered = 0;
    let markedOffline = 0;
    const ignored: string[] = [];
    const reportedIps = new Set<string>();
    const isFullScan = body.scanMode === 'full';

    const applyManagedStatus = async (
      managedDevice: ManagedDeviceRow,
      nextStatus: ManagedNetworkStatus,
      latencyMs: number | null,
      detail: string | null,
      ipAddress: string
    ) => {
      const previousStatus = String(managedDevice.last_status) as ManagedNetworkStatus;

      const updatePatch = {
        last_status: nextStatus,
        last_reported_at: observedAt,
        last_latency_ms: latencyMs,
        last_detail: detail,
        ...(previousStatus !== nextStatus ? { last_change_at: observedAt } : {}),
      };

      const { error: updateError } = await adminClient
        .from('managed_network_devices')
        .update(updatePatch)
        .eq('id', managedDevice.id);

      if (updateError) {
        console.error('[cerbo-network-scan] update error:', updateError.message);
        return false;
      }

      updated += 1;
      managedDevice.last_status = nextStatus;

      if (previousStatus !== nextStatus) {
        await adminClient.from('managed_network_device_events').insert([{
          managed_network_device_id: managedDevice.id,
          previous_status: previousStatus,
          next_status: nextStatus,
          observed_at: observedAt,
          latency_ms: latencyMs,
          detail,
        }]);

        const shouldAlert =
          Boolean(managedDevice.alert_on_offline) &&
          (
            (previousStatus === 'online' && nextStatus === 'offline') ||
            (previousStatus === 'offline' && nextStatus === 'online')
          );

        if (shouldAlert) {
          await sendAlertWebhook({
            eventType: nextStatus === 'offline' ? 'managed_device_offline' : 'managed_device_recovered',
            observedAt,
            vrmSiteId: vrmDeviceRow.vrm_site_id,
            trailerName: vrmDeviceRow.name,
            routerAccessUrl: vrmDeviceRow.router_access_url ?? null,
            device: {
              id: managedDevice.id,
              name: managedDevice.name,
              ipAddress,
              previousStatus,
              status: nextStatus,
              latencyMs,
              detail,
            },
          });
        }
      }

      return true;
    };

    for (const report of reports) {
      const ipAddress = String(report.ipAddress ?? '').trim();
      const status = report.status;
      if (!ipAddress || !isReportedStatus(status)) {
        ignored.push(ipAddress || 'unknown');
        continue;
      }

      const nextStatus = status;
      reportedIps.add(ipAddress);
      const latencyMs = typeof report.latencyMs === 'number' && report.latencyMs >= 0
        ? Math.round(report.latencyMs)
        : null;
      const detail = report.detail ? String(report.detail).slice(0, 500) : null;
      const macAddress = report.macAddress ? String(report.macAddress).slice(0, 64) : null;
      const hostname = report.hostname ? String(report.hostname).slice(0, 255) : null;

      const { error: discoveryError } = await adminClient
        .from('discovered_network_devices')
        .upsert([{
          vrm_device_id: vrmDeviceRow.id,
          ip_address: ipAddress,
          mac_address: macAddress,
          hostname,
          last_status: nextStatus,
          last_seen_at: observedAt,
          last_latency_ms: latencyMs,
          last_detail: detail,
        }], { onConflict: 'vrm_device_id,ip_address' });

      if (discoveryError) {
        console.error('[cerbo-network-scan] discovery upsert error:', discoveryError.message);
      } else {
        discovered += 1;
      }

      const managedDevice = devicesByIp.get(ipAddress);
      if (!managedDevice) continue;

      await applyManagedStatus(managedDevice, nextStatus, latencyMs, detail, ipAddress);
    }

    if (isFullScan) {
      const offlineDetail = 'not present in full Cerbo LAN scan';
      for (const managedDevice of Array.from(devicesByIp.values())) {
        if (reportedIps.has(managedDevice.ip_address) || managedDevice.last_status === 'offline') {
          continue;
        }
        const didUpdate = await applyManagedStatus(
          managedDevice,
          'offline',
          null,
          offlineDetail,
          managedDevice.ip_address
        );
        if (didUpdate) markedOffline += 1;
      }

      const { data: previouslyDiscovered, error: previousDiscoveryError } = await adminClient
        .from('discovered_network_devices')
        .select('id, ip_address, last_status')
        .eq('vrm_device_id', vrmDeviceRow.id)
        .eq('is_ignored', false);

      if (previousDiscoveryError) {
        console.error('[cerbo-network-scan] previous discovery lookup error:', previousDiscoveryError.message);
      } else {
        for (const device of previouslyDiscovered ?? []) {
          const ipAddress = String(device.ip_address);
          const lastStatus = String(device.last_status) as ManagedNetworkStatus;
          if (reportedIps.has(ipAddress) || lastStatus === 'offline') continue;

          const { error: discoveryOfflineError } = await adminClient
            .from('discovered_network_devices')
            .update({
              last_status: 'offline',
              last_seen_at: observedAt,
              last_latency_ms: null,
              last_detail: offlineDetail,
            })
            .eq('id', device.id);

          if (discoveryOfflineError) {
            console.error('[cerbo-network-scan] discovery offline update error:', discoveryOfflineError.message);
          } else {
            markedOffline += 1;
          }
        }
      }
    }

    return NextResponse.json({
      ok: true,
      vrmSiteId: vrmDeviceRow.vrm_site_id,
      discovered,
      updated,
      markedOffline,
      scanMode: isFullScan ? 'full' : 'targets',
      cellularInserted,
      ignored,
    });
  } catch (error) {
    console.error('[cerbo-network-scan] fatal error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
