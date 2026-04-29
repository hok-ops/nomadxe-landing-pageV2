import { NextRequest, NextResponse } from 'next/server';
import { assertVrmSiteAccess } from '@/lib/vrmAccess';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { createAdminClient } from '@/utils/supabase/admin';

export const dynamic = 'force-dynamic';

const WEBHOOK_TIMEOUT_MS = 10_000;

function mapCellularReport(row: any) {
  if (!row) return null;
  return {
    id: Number(row.id),
    vrmDeviceId: Number(row.vrm_device_id),
    observedAt: String(row.observed_at),
    source: String(row.source ?? 'manual'),
    operator: row.operator ?? null,
    networkType: row.network_type ?? null,
    band: row.band ?? null,
    rssiDbm: typeof row.rssi_dbm === 'number' ? row.rssi_dbm : null,
    rsrpDbm: typeof row.rsrp_dbm === 'number' ? row.rsrp_dbm : null,
    rsrqDb: typeof row.rsrq_db === 'number' ? row.rsrq_db : row.rsrq_db == null ? null : Number(row.rsrq_db),
    sinrDb: typeof row.sinr_db === 'number' ? row.sinr_db : row.sinr_db == null ? null : Number(row.sinr_db),
    connectionState: row.connection_state ?? null,
    detail: row.detail ?? null,
  };
}

async function loadDevice(siteId: string) {
  const adminClient = createAdminClient();
  const { data: device, error } = await adminClient
    .from('vrm_devices')
    .select('id, vrm_site_id, name, display_name, teltonika_rms_device_id, router_access_url')
    .eq('vrm_site_id', siteId)
    .maybeSingle();

  if (error || !device) return { adminClient, device: null, error: error?.message ?? 'Device not found' };
  return { adminClient, device, error: null };
}

function getRouterReportWebhookUrl() {
  return process.env.MAKE_CELLULAR_REPORT_WEBHOOK_URL ?? process.env.MAKE_NETWORK_ALERT_WEBHOOK_URL ?? null;
}

async function dispatchRouterReportRequest({
  request,
  device,
  ticketId,
  userId,
}: {
  request: NextRequest;
  device: any;
  ticketId: string;
  userId: string;
}) {
  const webhookUrl = getRouterReportWebhookUrl();
  if (!webhookUrl) {
    return { queued: false, warning: 'Router report request was logged, but MAKE_CELLULAR_REPORT_WEBHOOK_URL is not configured.' };
  }

  const siteUrl = (process.env.SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin).replace(/\/$/, '');
  const payload = {
    eventType: 'cellular_signal_report_requested',
    requestedAt: new Date().toISOString(),
    ticketId,
    requestedByUserId: userId,
    vrmSiteId: String(device.vrm_site_id),
    vrmDeviceId: Number(device.id),
    trailerName: device.display_name ?? device.name,
    teltonikaRmsDeviceId: device.teltonika_rms_device_id ? String(device.teltonika_rms_device_id) : null,
    routerAccessUrl: device.router_access_url ?? null,
    callback: {
      url: `${siteUrl}/api/cerbo/network-scan`,
      method: 'POST',
      authentication: 'Bearer token stored in collector as CERBO_INGEST_TOKEN',
      minimumPayload: {
        vrmSiteId: String(device.vrm_site_id),
        observedAt: 'ISO timestamp',
        cellular: {
          source: 'teltonika_rms',
          operator: 'carrier name',
          networkType: 'LTE/5G',
          band: 'cellular band',
          rssiDbm: -65,
          rsrpDbm: -95,
          rsrqDb: -9,
          sinrDb: 14,
          connectionState: 'connected',
          detail: 'short router/RMS note',
        },
      },
    },
  };

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
    });

    if (!response.ok) {
      console.error('[cellular-report] router report webhook failed:', response.status, await response.text());
      return { queued: false, warning: 'Router report request was logged, but the automation webhook did not accept it.' };
    }

    return { queued: true, warning: null };
  } catch (error) {
    console.error('[cellular-report] router report webhook error:', error);
    return { queued: false, warning: 'Router report request was logged, but automation dispatch failed.' };
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const { siteId } = await params;
  const access = await assertVrmSiteAccess(siteId);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { adminClient, device, error } = await loadDevice(siteId);
  if (!device) return NextResponse.json({ error }, { status: 404 });

  const { data: report, error: reportError } = await adminClient
    .from('cellular_signal_reports')
    .select('*')
    .eq('vrm_device_id', Number(device.id))
    .order('observed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (reportError) {
    console.warn('[cellular-report] lookup failed:', reportError.message);
    return NextResponse.json({ error: 'Cellular signal storage is not configured yet.' }, { status: 503 });
  }

  return NextResponse.json({ ok: true, report: mapCellularReport(report) });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const { siteId } = await params;
  const ip = getClientIp(request);
  if (!checkRateLimit(`cellular-report-request:${ip}:${siteId}`, 4, 60_000)) {
    return NextResponse.json({ error: 'Too many cellular reading requests. Please wait before trying again.' }, { status: 429 });
  }

  const access = await assertVrmSiteAccess(siteId);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { adminClient, device, error } = await loadDevice(siteId);
  if (!device) return NextResponse.json({ error }, { status: 404 });

  const { data: leaseAsset } = await adminClient
    .from('lease_assets')
    .select('lease_id')
    .eq('vrm_device_id', Number(device.id))
    .is('removed_at', null)
    .maybeSingle();

  const description = `Request a cellular signal reading for ${device.display_name ?? device.name}. Include SINR, RSRP, RSRQ, RSSI, carrier/operator, band, network type, and connection state.`;
  const { data: ticket, error: ticketError } = await adminClient
    .from('service_tickets')
    .insert({
      lease_id: leaseAsset?.lease_id ?? null,
      vrm_device_id: Number(device.id),
      customer_id: access.userId,
      type: 'connectivity',
      priority: 'normal',
      status: 'received',
      title: 'Cellular signal reading request',
      description,
      customer_visible_note: 'Received by NomadXE operations. The latest cellular signal reading will appear after the router/RMS reporter posts it.',
    })
    .select('id')
    .single();

  if (ticketError) {
    console.error('[cellular-report] request ticket failed:', ticketError.message);
    return NextResponse.json({ error: 'Could not create the cellular reading request.' }, { status: 503 });
  }

  await adminClient.from('proof_of_service_events').insert({
    lease_id: leaseAsset?.lease_id ?? null,
    vrm_device_id: Number(device.id),
    event_type: 'service',
    severity: 'info',
    title: 'Cellular signal reading requested',
    summary: `${device.display_name ?? device.name}: customer requested SINR, RSRP, RSRQ, RSSI, carrier, and band reading.`,
    evidence: { ticketId: ticket.id, requestType: 'cellular_signal_report' },
  });

  const dispatch = await dispatchRouterReportRequest({
    request,
    device,
    ticketId: String(ticket.id),
    userId: access.userId,
  });

  return NextResponse.json({
    ok: true,
    ticketId: ticket.id,
    automationQueued: dispatch.queued,
    warning: dispatch.warning,
  });
}
