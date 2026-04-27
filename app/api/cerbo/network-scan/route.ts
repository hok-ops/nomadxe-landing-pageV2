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
    if (!body?.vrmSiteId || !Array.isArray(body.devices)) {
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

    const { data: managedDevices, error: managedError } = await adminClient
      .from('managed_network_devices')
      .select('*')
      .eq('vrm_device_id', vrmDevice.id)
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

    let updated = 0;
    let discovered = 0;
    const ignored: string[] = [];

    for (const report of body.devices) {
      const ipAddress = String(report.ipAddress ?? '').trim();
      const status = report.status;
      if (!ipAddress || !isReportedStatus(status)) {
        ignored.push(ipAddress || 'unknown');
        continue;
      }

      const nextStatus = status;
      const latencyMs = typeof report.latencyMs === 'number' && report.latencyMs >= 0
        ? Math.round(report.latencyMs)
        : null;
      const detail = report.detail ? String(report.detail).slice(0, 500) : null;
      const macAddress = report.macAddress ? String(report.macAddress).slice(0, 64) : null;
      const hostname = report.hostname ? String(report.hostname).slice(0, 255) : null;

      const { error: discoveryError } = await adminClient
        .from('discovered_network_devices')
        .upsert([{
          vrm_device_id: vrmDevice.id,
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
        continue;
      }

      updated += 1;

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
            vrmSiteId: vrmDevice.vrm_site_id,
            trailerName: vrmDevice.name,
            routerAccessUrl: vrmDevice.router_access_url ?? null,
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
    }

    return NextResponse.json({
      ok: true,
      vrmSiteId: vrmDevice.vrm_site_id,
      discovered,
      updated,
      ignored,
    });
  } catch (error) {
    console.error('[cerbo-network-scan] fatal error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
