import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/utils/supabase/admin';
import { createClient } from '@/utils/supabase/server';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { ingestNetworkScanPayload, NetworkScanIngestError } from '@/lib/networkScanIngest';
import { collectTeltonikaRouterReport } from '@/lib/teltonikaRouter';

export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const supabase = createClient();
  const adminClient = createAdminClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return { ok: false as const, status: 401, error: 'Unauthorized' };
  }

  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError || profile?.role !== 'admin') {
    return { ok: false as const, status: 403, error: 'Forbidden' };
  }

  return { ok: true as const, adminClient, userId: user.id };
}

function numericId(value: unknown) {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isInteger(parsed) && parsed > 0) return parsed;
  }
  return null;
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  if (!checkRateLimit(`admin-router-lan-diagnostic:${ip}`, 10, 60_000)) {
    return NextResponse.json({ error: 'Too many router diagnostic requests. Please wait before trying again.' }, { status: 429 });
  }

  const admin = await requireAdmin();
  if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: admin.status });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const vrmDeviceId = numericId((body as Record<string, unknown>)?.vrmDeviceId);
  if (!vrmDeviceId) {
    return NextResponse.json({ error: 'vrmDeviceId is required' }, { status: 400 });
  }

  const { data: device, error: deviceError } = await admin.adminClient
    .from('vrm_devices')
    .select('id, vrm_site_id, name, display_name, router_access_url')
    .eq('id', vrmDeviceId)
    .maybeSingle();

  if (deviceError) {
    console.error('[router-lan-diagnostic] device lookup failed:', deviceError.message);
    return NextResponse.json({ error: 'Device lookup failed' }, { status: 500 });
  }
  if (!device) return NextResponse.json({ error: 'Device not found' }, { status: 404 });

  const routerAccessUrl = typeof device.router_access_url === 'string' ? device.router_access_url.trim() : '';
  if (!routerAccessUrl) {
    return NextResponse.json({
      error: 'Router access URL is not linked for this trailer.',
      device: {
        id: Number(device.id),
        siteId: String(device.vrm_site_id),
        name: String(device.display_name ?? device.name ?? 'NomadXE trailer'),
      },
    }, { status: 400 });
  }

  try {
    const report = await collectTeltonikaRouterReport(routerAccessUrl);
    const hasReportData = Boolean(report.cellular) || report.devices.length > 0;
    const ingestResult = hasReportData
      ? await ingestNetworkScanPayload({
          vrmSiteId: String(device.vrm_site_id),
          observedAt: report.observedAt,
          scanMode: report.devices.length > 0 ? 'full' : 'targets',
          scanSource: 'teltonika_router',
          cellular: report.cellular,
          devices: report.devices,
        })
      : null;

    revalidatePath('/admin');
    revalidatePath('/dashboard');

    return NextResponse.json({
      ok: true,
      device: {
        id: Number(device.id),
        siteId: String(device.vrm_site_id),
        name: String(device.display_name ?? device.name ?? 'NomadXE trailer'),
      },
      observedAt: report.observedAt,
      modemReportSaved: Boolean(ingestResult?.cellularInserted),
      lanDeviceCount: report.devices.length,
      discovered: ingestResult?.discovered ?? 0,
      updated: ingestResult?.updated ?? 0,
      markedOffline: ingestResult?.markedOffline ?? 0,
      endpointResults: report.lanProbes.map((probe) => ({
        path: probe.path,
        ok: probe.ok,
        status: probe.status,
        elapsedMs: probe.elapsedMs,
        deviceCount: probe.deviceCount,
        bodyShape: probe.bodyShape,
        sampleKeys: probe.sampleKeys,
        error: probe.error,
      })),
      warnings: report.warnings.slice(0, 8),
    });
  } catch (error) {
    if (error instanceof NetworkScanIngestError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[router-lan-diagnostic] probe failed:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Router diagnostic failed',
    }, { status: 502 });
  }
}
