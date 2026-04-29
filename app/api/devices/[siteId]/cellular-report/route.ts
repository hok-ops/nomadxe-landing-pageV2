import { NextRequest, NextResponse } from 'next/server';
import { assertVrmSiteAccess } from '@/lib/vrmAccess';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { createAdminClient } from '@/utils/supabase/admin';

export const dynamic = 'force-dynamic';

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
    .select('id, name, display_name')
    .eq('vrm_site_id', siteId)
    .maybeSingle();

  if (error || !device) return { adminClient, device: null, error: error?.message ?? 'Device not found' };
  return { adminClient, device, error: null };
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

  return NextResponse.json({ ok: true, ticketId: ticket.id });
}
