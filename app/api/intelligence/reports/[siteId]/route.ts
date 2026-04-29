import { NextRequest, NextResponse } from 'next/server';
import { assessAssetIntelligence } from '@/lib/assetIntelligence';
import { buildHistoricalIntelligenceReport, reportFromDatabaseRow } from '@/lib/historicalIntelligence';
import { fetchLeaseOperationsForDashboard } from '@/lib/leaseOperationsServer';
import type { DashboardDeviceRef } from '@/lib/leaseOperations';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { assertVrmSiteAccess } from '@/lib/vrmAccess';
import { fetchVRMData, fetchVRMDetail } from '@/lib/vrm';
import { fetchWeatherForecast } from '@/lib/weatherForecast';
import { createAdminClient } from '@/utils/supabase/admin';

export const dynamic = 'force-dynamic';

async function loadDevice(siteId: string) {
  const adminClient = createAdminClient();
  const { data: device, error } = await adminClient
    .from('vrm_devices')
    .select('id, vrm_site_id, name, display_name, teltonika_rms_device_id, router_access_url')
    .eq('vrm_site_id', siteId)
    .maybeSingle();

  if (error || !device) {
    return { adminClient, device: null, error: error?.message ?? 'Device not found' };
  }

  const ref: DashboardDeviceRef & { dbId: number } = {
    dbId: Number(device.id),
    siteId: String(device.vrm_site_id),
    name: String(device.name ?? device.vrm_site_id),
    displayName: device.display_name ?? null,
    teltonikaRmsDeviceId: device.teltonika_rms_device_id ? String(device.teltonika_rms_device_id) : null,
    routerAccessUrl: device.router_access_url ? String(device.router_access_url) : null,
  };

  return { adminClient, device: ref, error: null };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const { siteId } = await params;
  const access = await assertVrmSiteAccess(siteId);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { adminClient, device, error } = await loadDevice(siteId);
  if (!device) {
    return NextResponse.json({ error }, { status: 404 });
  }

  const { data: report, error: reportError } = await adminClient
    .from('daily_intelligence_reports')
    .select(`
      id,
      lease_id,
      vrm_device_id,
      report_date,
      status,
      source_window_start,
      source_window_end,
      summary,
      recommendations,
      evidence,
      created_at,
      updated_at,
      vrm_devices(vrm_site_id, name, display_name)
    `)
    .eq('vrm_device_id', device.dbId)
    .order('report_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (reportError) {
    console.warn('[historical-report] latest lookup failed:', reportError.message);
    return NextResponse.json({ error: 'Historical intelligence storage is not configured yet.' }, { status: 503 });
  }

  return NextResponse.json({ ok: true, report: report ? reportFromDatabaseRow(report) : null });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const { siteId } = await params;
  const ip = getClientIp(request);
  if (!checkRateLimit(`historical-report:${ip}:${siteId}`, 3, 60_000)) {
    return NextResponse.json({ error: 'Too many report requests. Please wait before generating another report.' }, { status: 429 });
  }

  const access = await assertVrmSiteAccess(siteId);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { adminClient, device, error } = await loadDevice(siteId);
  if (!device) {
    return NextResponse.json({ error }, { status: 404 });
  }

  const [dataResult, detailResult] = await Promise.allSettled([
    fetchVRMData(siteId),
    fetchVRMDetail(siteId),
  ]);
  const data = dataResult.status === 'fulfilled' ? dataResult.value : null;
  const details = detailResult.status === 'fulfilled' ? detailResult.value : null;
  const lat = details?.gps?.latitude ?? data?.lat ?? null;
  const lon = details?.gps?.longitude ?? data?.lon ?? null;
  const weatherForecast = lat != null && lon != null
    ? await fetchWeatherForecast(lat, lon)
    : null;
  const asset = assessAssetIntelligence({ device, data, details });
  const operations = await fetchLeaseOperationsForDashboard({
    userId: access.userId,
    devices: [device],
    dataMap: { [siteId]: data },
    assetIntelligence: [asset],
  });
  const generated = buildHistoricalIntelligenceReport({
    device,
    data,
    details,
    asset,
    operations,
    weatherForecast,
  });

  const payload = {
    lease_id: generated.leaseId,
    vrm_device_id: device.dbId,
    report_date: generated.reportDate,
    status: generated.status,
    generated_by_user_id: access.userId,
    source_window_start: generated.sourceWindowStart,
    source_window_end: generated.sourceWindowEnd,
    summary: generated.summary,
    recommendations: generated.recommendations,
    evidence: generated.evidence,
    updated_at: new Date().toISOString(),
  };

  const { data: savedReport, error: saveError } = await adminClient
    .from('daily_intelligence_reports')
    .upsert(payload, { onConflict: 'vrm_device_id,report_date' })
    .select('id')
    .single();

  if (saveError) {
    console.warn('[historical-report] save failed:', saveError.message);
    return NextResponse.json({
      ok: true,
      warning: 'Historical intelligence generated but storage is not configured yet.',
      report: generated,
    });
  }

  const reportId = String(savedReport.id);
  await adminClient
    .from('intelligence_recommendations')
    .delete()
    .eq('report_id', reportId);

  if (generated.recommendations.length > 0) {
    await adminClient
      .from('intelligence_recommendations')
      .insert(generated.recommendations.map((item) => ({
        lease_id: generated.leaseId,
        vrm_device_id: device.dbId,
        report_id: reportId,
        category: item.category,
        severity: item.severity,
        status: 'open',
        title: item.title,
        summary: item.summary,
        action: item.action,
        confidence: item.confidence,
        evidence: { facts: item.evidence },
      })));
  }

  await Promise.all([
    adminClient.from('proof_of_service_events').insert({
      lease_id: generated.leaseId,
      vrm_device_id: device.dbId,
      event_type: 'report',
      severity: generated.summary.overallSeverity,
      title: 'Daily intelligence report generated',
      summary: `${generated.deviceName}: ${generated.recommendations.length} recommendation(s), readiness ${generated.summary.readinessScore}%.`,
      evidence: { reportId, status: generated.status },
    }),
    adminClient.from('site_boundary_checks').insert({
      lease_id: generated.leaseId,
      vrm_device_id: device.dbId,
      actual_lat: details?.gps?.latitude ?? data?.lat ?? null,
      actual_lon: details?.gps?.longitude ?? data?.lon ?? null,
      status: 'unknown',
      evidence: {
        label: generated.summary.siteBoundary.label,
        gpsAgeSeconds: generated.summary.siteBoundary.gpsAgeSeconds,
        reason: 'Expected jobsite boundary is not configured in the lease record yet.',
      },
    }),
  ]);

  if (generated.summary.monitoring.severity !== 'info') {
    await adminClient.from('monitoring_partner_events').insert({
      lease_id: generated.leaseId,
      vrm_device_id: device.dbId,
      provider: generated.summary.monitoring.partner ?? 'unlinked',
      event_type: 'coverage_gap',
      severity: generated.summary.monitoring.severity,
      title: 'Monitoring partner evidence gap',
      summary: generated.summary.monitoring.summary,
      evidence: { reportId },
    });
  }

  const unknownFirmware = details?.system.devices.filter((item) => !item.firmwareVersion || item.firmwareVersion === 'Unknown') ?? [];
  if (unknownFirmware.length > 0) {
    await adminClient.from('firmware_config_advisories').insert(unknownFirmware.slice(0, 8).map((item) => ({
      vrm_device_id: device.dbId,
      product_name: item.productName || item.name || 'Victron device',
      firmware_version: item.firmwareVersion || null,
      advisory_type: 'unknown_version',
      severity: 'watch',
      title: 'Unknown firmware version',
      summary: `${item.productName || item.name || 'Victron device'} did not report a firmware version in VRM inventory.`,
      evidence: { reportId, productCode: item.productCode, connection: item.connection },
    })));
  }

  return NextResponse.json({
    ok: true,
    report: {
      ...generated,
      id: reportId,
      persisted: true,
    },
  });
}
