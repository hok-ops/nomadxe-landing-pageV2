import type { AssetIntelligence, IntelligenceSeverity } from '@/lib/assetIntelligence';
import type { DashboardDeviceRef, LeaseOperationsData, LeaseSummary } from '@/lib/leaseOperations';
import type { VRMData, VRMDetailData, VRMSeries } from '@/lib/vrm';
import { assessWeatherForecast, type WeatherForecastWindow } from '@/lib/weatherForecast';

export type ReportSeverity = 'info' | 'watch' | 'action' | 'critical';
export type RecommendationCategory =
  | 'power'
  | 'visibility'
  | 'alarm_coverage'
  | 'service'
  | 'geofence'
  | 'firmware'
  | 'monitoring'
  | 'efficiency';

export interface HistoricalRecommendation {
  id: string;
  category: RecommendationCategory;
  severity: ReportSeverity;
  title: string;
  summary: string;
  action: string;
  confidence: number;
  evidence: string[];
}

export interface HistoricalReportSummary {
  overallSeverity: ReportSeverity;
  readinessScore: number;
  narrative?: {
    headline: string;
    customerSummary: string;
    operatorSummary: string;
    keyFindings: string[];
  };
  metrics?: Array<{
    label: string;
    value: string;
    detail: string;
    severity: ReportSeverity;
  }>;
  powerAutonomy: {
    severity: ReportSeverity;
    reserveLabel: string;
    socNow: number | null;
    socTrendPctPerHour: number | null;
    solarCoveragePct: number | null;
    summary: string;
  };
  visibilityRisk: {
    severity: ReportSeverity;
    label: string;
    lastSeenMinutes: number | null;
    routerLinked: boolean;
    summary: string;
  };
  alarmCoverage: {
    severity: ReportSeverity;
    configuredCount: number | null;
    recipients: number | null;
    summary: string;
  };
  siteBoundary: {
    severity: ReportSeverity;
    label: string;
    gpsAgeSeconds: number | null;
    hasGps: boolean;
    summary: string;
  };
  monitoring: {
    severity: ReportSeverity;
    label: string;
    partner: string | null;
    summary: string;
  };
  weatherOutlook?: {
    severity: ReportSeverity;
    label: string;
    confidence: number;
    summary: string;
    solarRadiationWhM2: number | null;
    avgCloudCoverPct: number | null;
    precipitationProbabilityMaxPct: number | null;
    windMphMax: number | null;
    temperatureRangeF: string;
    evidence: string[];
  };
  firmware: {
    severity: ReportSeverity;
    unknownVersions: number;
    deviceCount: number | null;
    summary: string;
  };
  efficiency: {
    severity: ReportSeverity;
    mode: string;
    summary: string;
  };
}

export interface HistoricalIntelligenceReport {
  id?: string;
  siteId: string;
  leaseId: string | null;
  deviceName: string;
  reportDate: string;
  generatedAt: string;
  sourceWindowStart: string;
  sourceWindowEnd: string;
  status: 'generated' | 'partial' | 'needs_review';
  summary: HistoricalReportSummary;
  recommendations: HistoricalRecommendation[];
  evidence: {
    sources: string[];
    historyWindows: string[];
    exportLinks?: VRMDetailData['exports'];
  };
  persisted: boolean;
}

const SEVERITY_RANK: Record<ReportSeverity, number> = {
  info: 0,
  watch: 1,
  action: 2,
  critical: 3,
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function asReportSeverity(severity: IntelligenceSeverity): ReportSeverity {
  return severity === 'normal' ? 'info' : severity;
}

function maxSeverity(values: ReportSeverity[]) {
  return values.reduce<ReportSeverity>(
    (highest, next) => (SEVERITY_RANK[next] > SEVERITY_RANK[highest] ? next : highest),
    'info'
  );
}

function formatPct(value: number | null) {
  if (value == null || !Number.isFinite(value)) return 'unknown';
  return `${Math.round(value)}%`;
}

function formatKwh(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return 'unknown';
  return `${value.toFixed(value < 10 ? 2 : 1)} kWh`;
}

function formatMinutes(value: number | null) {
  if (value == null || !Number.isFinite(value)) return 'unknown';
  if (value < 60) return `${Math.max(0, Math.round(value))}m`;
  return `${(value / 60).toFixed(value < 180 ? 1 : 0)}h`;
}

function roundNullable(value: number | null, digits = 1) {
  if (value == null || !Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function valuesFromSeries(series: VRMSeries | null | undefined) {
  return (series?.points ?? [])
    .map((point) => ({ timestamp: point.timestamp, value: point.value }))
    .filter((point) => Number.isFinite(point.timestamp) && Number.isFinite(point.value));
}

function seriesTrendPerHour(series: VRMSeries | null | undefined): number | null {
  const values = valuesFromSeries(series);
  if (values.length < 2) return null;
  const first = values[0];
  const last = values[values.length - 1];
  const hours = Math.max((last.timestamp - first.timestamp) / 3600, 0.25);
  return (last.value - first.value) / hours;
}

function average(values: number[]) {
  const finite = values.filter(Number.isFinite);
  if (finite.length === 0) return null;
  return finite.reduce((sum, value) => sum + value, 0) / finite.length;
}

function solarCoveragePct(details: VRMDetailData | null | undefined, data: VRMData | null) {
  const todaySolar = details?.overall.today.solarYieldKwh;
  const todayConsumption = details?.overall.today.consumptionKwh;
  if (todaySolar != null && todayConsumption != null && todayConsumption > 0) {
    return clamp((todaySolar / todayConsumption) * 100, 0, 500);
  }

  if (data && data.dcLoad > 5) {
    return clamp((Math.max(0, data.solar.power) / data.dcLoad) * 100, 0, 500);
  }

  return null;
}

function buildPowerSummary(data: VRMData | null, details: VRMDetailData | null | undefined, asset: AssetIntelligence | null) {
  const socNow = data ? clamp(data.battery.soc, 0, 100) : null;
  const trendFromDetails = seriesTrendPerHour(details?.graphs.batterySoc);
  const trendFromSnapshot = data?.batterySparkline && data.batterySparkline.length > 1
    ? (data.batterySparkline[data.batterySparkline.length - 1] - data.batterySparkline[0]) / 3
    : null;
  const trend = roundNullable(trendFromDetails ?? trendFromSnapshot, 2);
  const coverage = roundNullable(solarCoveragePct(details, data), 0);
  const severity = maxSeverity([
    asset ? asReportSeverity(asset.power.severity) : 'info',
    socNow == null ? 'critical' : socNow <= 15 ? 'critical' : socNow <= 30 ? 'action' : socNow <= 50 ? 'watch' : 'info',
    trend != null && trend < -4 ? 'action' : trend != null && trend < -1.5 ? 'watch' : 'info',
    coverage != null && coverage < 50 && (data?.battery.power ?? 0) < -10 ? 'watch' : 'info',
  ]);

  const reserveLabel = severity === 'critical'
    ? 'Critical reserve'
    : severity === 'action'
      ? 'Action reserve'
      : severity === 'watch'
        ? 'Watch reserve'
        : 'Healthy reserve';

  const summary = data
    ? `SOC ${formatPct(socNow)}, ${trend == null ? 'trend unavailable' : `${trend > 0 ? '+' : ''}${trend.toFixed(1)} pct/hr`}, solar coverage ${formatPct(coverage)}.`
    : 'Power telemetry is unavailable, so historical autonomy cannot be calculated from current evidence.';

  return {
    severity,
    reserveLabel,
    socNow: roundNullable(socNow, 0),
    socTrendPctPerHour: trend,
    solarCoveragePct: coverage,
    summary,
  };
}

function buildVisibilitySummary(device: DashboardDeviceRef, data: VRMData | null, nowMs: number) {
  const lastSeenMinutes = data?.lastSeen ? Math.max(0, (nowMs / 1000 - data.lastSeen) / 60) : null;
  const routerLinked = Boolean(device.teltonikaRmsDeviceId || device.routerAccessUrl);
  const severity: ReportSeverity = !data || lastSeenMinutes == null
    ? (routerLinked ? 'action' : 'critical')
    : lastSeenMinutes > 60
      ? 'critical'
      : lastSeenMinutes > 15
        ? 'action'
        : !routerLinked
          ? 'watch'
          : 'info';
  const label = severity === 'critical'
    ? 'Blind spot'
    : severity === 'action'
      ? 'Needs verification'
      : severity === 'watch'
        ? 'Limited remote path'
        : 'Current';
  const summary = data
    ? `VRM last checked in ${formatMinutes(lastSeenMinutes)} ago; remote router path ${routerLinked ? 'is linked' : 'is not linked'}.`
    : `No current VRM snapshot; remote router path ${routerLinked ? 'is linked' : 'is not linked'}.`;

  return { severity, label, lastSeenMinutes: roundNullable(lastSeenMinutes, 0), routerLinked, summary };
}

function buildAlarmSummary(details: VRMDetailData | null | undefined) {
  if (!details) {
    return {
      severity: 'watch' as ReportSeverity,
      configuredCount: null,
      recipients: null,
      summary: 'Detailed VRM alarm coverage has not been loaded for this report.',
    };
  }

  const configuredCount = details.alarms.configuredCount;
  const recipients = details.alarms.notificationRecipients;
  const severity: ReportSeverity = configuredCount === 0 || recipients === 0 ? 'action' : configuredCount < 3 ? 'watch' : 'info';
  return {
    severity,
    configuredCount,
    recipients,
    summary: `${configuredCount} VRM alarm rule(s) and ${recipients} notification recipient(s) were found.`,
  };
}

function buildBoundarySummary(data: VRMData | null, details: VRMDetailData | null | undefined) {
  const gps = details?.gps;
  const hasGps = Boolean((gps?.latitude != null && gps.longitude != null) || (data?.lat != null && data.lon != null));
  const gpsAgeSeconds = gps?.ageSeconds ?? null;
  const stale = gpsAgeSeconds != null && gpsAgeSeconds > 24 * 3600;
  const severity: ReportSeverity = !hasGps ? 'watch' : stale ? 'watch' : 'info';
  const label = !hasGps ? 'GPS missing' : stale ? 'GPS stale' : 'GPS available';
  const summary = !hasGps
    ? 'No VRM GPS coordinate is available, so site-boundary confidence cannot be calculated yet.'
    : stale
      ? `GPS exists but is ${formatMinutes(gpsAgeSeconds / 60)} old; confirm site position before relying on geofence checks.`
      : 'GPS is available for site-boundary confidence and export history.';

  return { severity, label, gpsAgeSeconds, hasGps, summary };
}

function findPrimaryLease(device: DashboardDeviceRef, operations: LeaseOperationsData): LeaseSummary | null {
  return operations.leases.find((lease) => lease.assets.some((asset) => asset.siteId === device.siteId)) ?? operations.leases[0] ?? null;
}

function buildMonitoringSummary(lease: LeaseSummary | null) {
  const fullyEquipped = lease?.packageType === 'fully_equipped';
  const partner = lease?.monitoringPartner ?? null;
  const severity: ReportSeverity = fullyEquipped && !partner ? 'watch' : 'info';
  const label = fullyEquipped ? (partner ? 'Partner linked' : 'Partner not linked') : 'Base visibility';
  const summary = fullyEquipped
    ? partner
      ? `${partner} monitoring is linked to the lease record.`
      : 'This is a Fully Equipped lease, but no monitoring partner is linked in the portal yet.'
    : 'Base trailer visibility is active; customer-owned monitoring platforms remain outside the portal unless integrated.';

  return { severity, label, partner, summary };
}

function buildWeatherSummary(weatherForecast: WeatherForecastWindow | null | undefined) {
  const assessed = assessWeatherForecast(weatherForecast ?? null);
  if (!assessed) return null;
  const forecast = assessed.forecast;
  const temperatureRangeF = forecast.temperatureMinF == null || forecast.temperatureMaxF == null
    ? 'unknown'
    : `${Math.round(forecast.temperatureMinF)}-${Math.round(forecast.temperatureMaxF)} F`;

  return {
    severity: assessed.severity,
    label: assessed.label,
    confidence: assessed.confidence,
    summary: assessed.summary,
    solarRadiationWhM2: forecast.solarRadiationWhM2,
    avgCloudCoverPct: forecast.avgCloudCoverPct,
    precipitationProbabilityMaxPct: forecast.precipitationProbabilityMaxPct,
    windMphMax: forecast.windMphMax,
    temperatureRangeF,
    evidence: assessed.evidence,
  };
}

function buildFirmwareSummary(details: VRMDetailData | null | undefined) {
  if (!details) {
    return {
      severity: 'watch' as ReportSeverity,
      unknownVersions: 0,
      deviceCount: null,
      summary: 'System inventory was not available for firmware/configuration drift review.',
    };
  }

  const unknownVersions = details.system.devices.filter((device) => !device.firmwareVersion || device.firmwareVersion === 'Unknown').length;
  const severity: ReportSeverity = unknownVersions > 0 ? 'watch' : 'info';
  return {
    severity,
    unknownVersions,
    deviceCount: details.system.deviceCount,
    summary: `${details.system.deviceCount} VRM device(s) detected; ${unknownVersions} device(s) have unknown firmware versions.`,
  };
}

function buildEfficiencySummary(asset: AssetIntelligence | null, details: VRMDetailData | null | undefined) {
  const dcLoadValues = valuesFromSeries(details?.graphs.dcLoad).map((point) => point.value);
  const averageLoad = average(dcLoadValues);
  const mode = asset?.telemetryPlan.mode ?? 'normal';
  const severity = asset ? asReportSeverity(asset.severity) : 'watch';
  const summary = averageLoad == null
    ? `Recommended monitoring pace is ${mode}; DC load history is not available for load-profile review.`
    : `Recommended monitoring pace is ${mode}; average 24h DC load is ${Math.round(averageLoad)} W.`;

  return { severity, mode, summary };
}

function buildReportMetrics(summary: HistoricalReportSummary, details: VRMDetailData | null | undefined): NonNullable<HistoricalReportSummary['metrics']> {
  return [
    {
      label: 'Battery Now',
      value: formatPct(summary.powerAutonomy.socNow),
      detail: summary.powerAutonomy.socTrendPctPerHour == null
        ? 'No reliable SOC trend was available.'
        : `${summary.powerAutonomy.socTrendPctPerHour > 0 ? '+' : ''}${summary.powerAutonomy.socTrendPctPerHour.toFixed(1)}% per hour trend.`,
      severity: summary.powerAutonomy.severity,
    },
    {
      label: 'Solar Today',
      value: formatKwh(details?.overall.today.solarYieldKwh),
      detail: `Load coverage: ${formatPct(summary.powerAutonomy.solarCoveragePct)} from available VRM history.`,
      severity: summary.powerAutonomy.solarCoveragePct != null && summary.powerAutonomy.solarCoveragePct < 60 ? 'watch' : 'info',
    },
    {
      label: 'Last Check-in',
      value: formatMinutes(summary.visibilityRisk.lastSeenMinutes),
      detail: summary.visibilityRisk.routerLinked ? 'Remote access path is linked.' : 'Remote access path is not linked.',
      severity: summary.visibilityRisk.severity,
    },
    {
      label: 'VRM Alarms',
      value: summary.alarmCoverage.configuredCount == null ? 'unknown' : String(summary.alarmCoverage.configuredCount),
      detail: summary.alarmCoverage.recipients == null
        ? 'Alarm recipient detail unavailable.'
        : `${summary.alarmCoverage.recipients} notification recipient(s) configured.`,
      severity: summary.alarmCoverage.severity,
    },
    {
      label: 'System Inventory',
      value: summary.firmware.deviceCount == null ? 'unknown' : String(summary.firmware.deviceCount),
      detail: `${summary.firmware.unknownVersions} device(s) have unknown firmware versions.`,
      severity: summary.firmware.severity,
    },
    {
      label: 'GPS Evidence',
      value: summary.siteBoundary.hasGps ? summary.siteBoundary.label : 'Missing',
      detail: summary.siteBoundary.summary,
      severity: summary.siteBoundary.severity,
    },
    ...(summary.weatherOutlook ? [{
      label: 'Weather Window',
      value: summary.weatherOutlook.label,
      detail: summary.weatherOutlook.summary,
      severity: summary.weatherOutlook.severity,
    }] : []),
  ];
}

function buildNarrative({
  deviceName,
  summary,
  recommendations,
}: {
  deviceName: string;
  summary: HistoricalReportSummary;
  recommendations: HistoricalRecommendation[];
}) {
  const urgent = recommendations.filter((item) => SEVERITY_RANK[item.severity] >= SEVERITY_RANK.action);
  const watch = recommendations.filter((item) => item.severity === 'watch');
  const headline = summary.overallSeverity === 'critical'
    ? `${deviceName} needs immediate review before this report is considered clear.`
    : summary.overallSeverity === 'action'
      ? `${deviceName} has action items that should be handled this shift.`
      : summary.overallSeverity === 'watch'
        ? `${deviceName} is operating with watch items.`
        : `${deviceName} is operating inside expected historical bands.`;

  const customerSummary = [
    summary.powerAutonomy.summary,
    summary.visibilityRisk.summary,
    summary.weatherOutlook?.summary,
    urgent.length > 0
      ? `${urgent.length} action-level item${urgent.length === 1 ? '' : 's'} should be reviewed.`
      : watch.length > 0
        ? `${watch.length} watch item${watch.length === 1 ? '' : 's'} should remain visible.`
        : 'No immediate customer-facing service issue was found in this report.',
  ].join(' ');

  const operatorSummary = recommendations.length > 0
    ? `Primary operator focus: ${recommendations[0].action}`
    : 'Operator focus: keep normal monitoring and regenerate the report after the next service or telemetry event.';

  const keyFindings = [
    `Power: ${summary.powerAutonomy.summary}`,
    `Visibility: ${summary.visibilityRisk.summary}`,
    ...(summary.weatherOutlook ? [`Weather: ${summary.weatherOutlook.summary}`] : []),
    `Alarms: ${summary.alarmCoverage.summary}`,
    `Monitoring: ${summary.monitoring.summary}`,
  ].slice(0, 5);

  return { headline, customerSummary, operatorSummary, keyFindings };
}

function recommendation(
  category: RecommendationCategory,
  severity: ReportSeverity,
  title: string,
  summary: string,
  action: string,
  confidence: number,
  evidence: string[]
): HistoricalRecommendation {
  return {
    id: `${category}-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`.slice(0, 80),
    category,
    severity,
    title,
    summary,
    action,
    confidence: clamp(Math.round(confidence), 0, 100),
    evidence,
  };
}

function buildRecommendations({
  summary,
  asset,
  details,
}: {
  summary: HistoricalReportSummary;
  asset: AssetIntelligence | null;
  details: VRMDetailData | null | undefined;
}) {
  const items: HistoricalRecommendation[] = [];

  if (SEVERITY_RANK[summary.powerAutonomy.severity] >= SEVERITY_RANK.watch) {
    items.push(recommendation(
      'power',
      summary.powerAutonomy.severity,
      'Protect power autonomy',
      summary.powerAutonomy.summary,
      asset?.power.action ?? 'Review solar exposure, connected load, and alternate charging before the next overnight window.',
      asset ? 86 : 68,
      [
        `SOC: ${formatPct(summary.powerAutonomy.socNow)}`,
        `SOC trend: ${summary.powerAutonomy.socTrendPctPerHour == null ? 'unknown' : `${summary.powerAutonomy.socTrendPctPerHour} pct/hr`}`,
        `Solar coverage: ${formatPct(summary.powerAutonomy.solarCoveragePct)}`,
      ]
    ));
  }

  if (SEVERITY_RANK[summary.visibilityRisk.severity] >= SEVERITY_RANK.watch) {
    items.push(recommendation(
      'visibility',
      summary.visibilityRisk.severity,
      'Close visibility gap',
      summary.visibilityRisk.summary,
      summary.visibilityRisk.routerLinked
        ? 'Use the registered remote path to verify WAN/VPN and Cerbo reachability.'
        : 'Link a Teltonika RMS or router access path before promising live visibility.',
      84,
      [
        `Last VRM check-in: ${formatMinutes(summary.visibilityRisk.lastSeenMinutes)}`,
        `Router linked: ${summary.visibilityRisk.routerLinked ? 'yes' : 'no'}`,
      ]
    ));
  }

  if (SEVERITY_RANK[summary.alarmCoverage.severity] >= SEVERITY_RANK.watch) {
    items.push(recommendation(
      'alarm_coverage',
      summary.alarmCoverage.severity,
      'Harden VRM alarm coverage',
      summary.alarmCoverage.summary,
      'Configure low SOC, loss-of-communication, charger fault, and recipient notifications in VRM.',
      details ? 82 : 55,
      [
        `Alarm rules: ${summary.alarmCoverage.configuredCount ?? 'unknown'}`,
        `Recipients: ${summary.alarmCoverage.recipients ?? 'unknown'}`,
      ]
    ));
  }

  if (SEVERITY_RANK[summary.siteBoundary.severity] >= SEVERITY_RANK.watch) {
    items.push(recommendation(
      'geofence',
      summary.siteBoundary.severity,
      'Improve site-boundary confidence',
      summary.siteBoundary.summary,
      'Confirm GPS availability and set an expected jobsite boundary before enabling outside-site alerts.',
      summary.siteBoundary.hasGps ? 72 : 50,
      [
        `GPS available: ${summary.siteBoundary.hasGps ? 'yes' : 'no'}`,
        `GPS age seconds: ${summary.siteBoundary.gpsAgeSeconds ?? 'unknown'}`,
      ]
    ));
  }

  if (SEVERITY_RANK[summary.monitoring.severity] >= SEVERITY_RANK.watch) {
    items.push(recommendation(
      'monitoring',
      summary.monitoring.severity,
      'Link monitoring partner evidence',
      summary.monitoring.summary,
      'Attach monitoring partner, platform handoff, or evidence ingestion before reporting Fully Equipped coverage as complete.',
      75,
      [`Monitoring partner: ${summary.monitoring.partner ?? 'not linked'}`]
    ));
  }

  if (summary.weatherOutlook && SEVERITY_RANK[summary.weatherOutlook.severity] >= SEVERITY_RANK.watch) {
    items.push(recommendation(
      'power',
      summary.weatherOutlook.severity,
      'Plan around the weather window',
      summary.weatherOutlook.summary,
      'Compare the forecast against battery reserve and load before the overnight window; reduce nonessential load or schedule a power check if recovery margin is thin.',
      summary.weatherOutlook.confidence,
      summary.weatherOutlook.evidence
    ));
  }

  if (SEVERITY_RANK[summary.firmware.severity] >= SEVERITY_RANK.watch) {
    items.push(recommendation(
      'firmware',
      summary.firmware.severity,
      'Review firmware inventory',
      summary.firmware.summary,
      'Compare firmware and configuration inventory with the approved trailer baseline before scheduling any update.',
      70,
      [
        `Device count: ${summary.firmware.deviceCount ?? 'unknown'}`,
        `Unknown versions: ${summary.firmware.unknownVersions}`,
      ]
    ));
  }

  items.push(recommendation(
    'efficiency',
    summary.efficiency.severity,
    'Use the appropriate monitoring pace',
    summary.efficiency.summary,
    'Use faster refresh while a risk is active, then return to normal monitoring so the dashboard stays responsive and focused.',
    asset ? 88 : 62,
    asset?.telemetryPlan.rules ?? ['Use normal monitoring until richer signal history is available']
  ));

  return items.sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] || b.confidence - a.confidence);
}

export function buildHistoricalIntelligenceReport({
  device,
  data,
  details,
  asset,
  operations,
  weatherForecast,
  now = new Date(),
}: {
  device: DashboardDeviceRef;
  data: VRMData | null;
  details?: VRMDetailData | null;
  asset?: AssetIntelligence | null;
  operations: LeaseOperationsData;
  weatherForecast?: WeatherForecastWindow | null;
  now?: Date;
}): HistoricalIntelligenceReport {
  const lease = findPrimaryLease(device, operations);
  const nowMs = now.getTime();
  const sourceWindowEnd = now;
  const sourceWindowStart = new Date(nowMs - 24 * 60 * 60_000);
  const powerAutonomy = buildPowerSummary(data, details, asset ?? null);
  const visibilityRisk = buildVisibilitySummary(device, data, nowMs);
  const alarmCoverage = buildAlarmSummary(details);
  const siteBoundary = buildBoundarySummary(data, details);
  const monitoring = buildMonitoringSummary(lease);
  const weatherOutlook = buildWeatherSummary(weatherForecast);
  const firmware = buildFirmwareSummary(details);
  const efficiency = buildEfficiencySummary(asset ?? null, details);
  const overallSeverity = maxSeverity([
    powerAutonomy.severity,
    visibilityRisk.severity,
    alarmCoverage.severity,
    siteBoundary.severity,
    monitoring.severity,
    weatherOutlook?.severity ?? 'info',
    firmware.severity,
    efficiency.severity,
  ]);
  const readinessScore = clamp(
    Math.round((asset?.readiness.score ?? 70) - SEVERITY_RANK[overallSeverity] * 8 + (details ? 6 : -6)),
    0,
    100
  );
  const summaryBase: HistoricalReportSummary = {
    overallSeverity,
    readinessScore,
    powerAutonomy,
    visibilityRisk,
    alarmCoverage,
    siteBoundary,
    monitoring,
    ...(weatherOutlook ? { weatherOutlook } : {}),
    firmware,
    efficiency,
  };
  const recommendations = buildRecommendations({ summary: summaryBase, asset: asset ?? null, details });
  const summary: HistoricalReportSummary = {
    ...summaryBase,
    metrics: buildReportMetrics(summaryBase, details),
    narrative: buildNarrative({
      deviceName: device.displayName ?? device.name,
      summary: summaryBase,
      recommendations,
    }),
  };
  const partial = !details || !data;

  return {
    siteId: device.siteId,
    leaseId: lease?.isSynthetic ? null : lease?.id ?? null,
    deviceName: device.displayName ?? device.name,
    reportDate: now.toISOString().slice(0, 10),
    generatedAt: now.toISOString(),
    sourceWindowStart: sourceWindowStart.toISOString(),
    sourceWindowEnd: sourceWindowEnd.toISOString(),
    status: overallSeverity === 'critical' ? 'needs_review' : partial ? 'partial' : 'generated',
    summary,
    recommendations,
    evidence: {
      sources: [
        data ? 'VRM diagnostics snapshot' : 'VRM diagnostics unavailable',
        details ? 'VRM 24h graph, alarm, GPS, firmware, and overall stats' : 'VRM detail history unavailable',
        weatherForecast ? 'Open-Meteo GPS-based 24h weather and solar forecast' : 'Weather forecast unavailable',
        operations.dataSource === 'database' ? 'Linked lease operations records' : 'Telemetry-derived lease fallback',
      ],
      historyWindows: ['24h graph window', 'today/week/month/year overall stats', '7d CSV and 30d XLSX exports when available'],
      exportLinks: details?.exports,
    },
    persisted: false,
  };
}

export function reportFromDatabaseRow(row: any): HistoricalIntelligenceReport {
  const summary = row.summary as HistoricalReportSummary;
  const recommendations = Array.isArray(row.recommendations) ? row.recommendations as HistoricalRecommendation[] : [];
  const evidence = typeof row.evidence === 'object' && row.evidence ? row.evidence : {};

  return {
    id: String(row.id),
    siteId: String(row.vrm_devices?.vrm_site_id ?? row.siteId ?? ''),
    leaseId: row.lease_id ? String(row.lease_id) : null,
    deviceName: String(row.vrm_devices?.display_name ?? row.vrm_devices?.name ?? row.deviceName ?? 'NomadXE trailer'),
    reportDate: String(row.report_date),
    generatedAt: String(row.updated_at ?? row.created_at ?? new Date().toISOString()),
    sourceWindowStart: String(row.source_window_start),
    sourceWindowEnd: String(row.source_window_end),
    status: String(row.status ?? 'generated') as HistoricalIntelligenceReport['status'],
    summary,
    recommendations,
    evidence: {
      sources: Array.isArray(evidence.sources) ? evidence.sources : [],
      historyWindows: Array.isArray(evidence.historyWindows) ? evidence.historyWindows : [],
      exportLinks: evidence.exportLinks,
    },
    persisted: true,
  };
}
