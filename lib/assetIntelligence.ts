import type { VRMData, VRMDetailData } from '@/lib/vrm';
import type { DiscoveredNetworkDevice, ManagedNetworkDevice } from '@/lib/networkDevices';

export type IntelligenceSeverity = 'normal' | 'watch' | 'action' | 'critical';
export type AdaptiveTelemetryMode = 'normal' | 'watch' | 'incident' | 'offline';

export interface IntelligenceDevice {
  siteId: string;
  name: string;
  displayName?: string | null;
  teltonikaRmsDeviceId?: string | null;
  routerAccessUrl?: string | null;
}

export interface IntelligenceSignal {
  label: string;
  value: string;
  tone: IntelligenceSeverity;
}

export interface RootCauseSignal {
  id: string;
  severity: IntelligenceSeverity;
  title: string;
  summary: string;
  evidence: string[];
  action: string;
}

export interface PowerRiskForecast {
  severity: IntelligenceSeverity;
  runtimeHours: number | null;
  socTrendPerHour: number | null;
  solarCoveragePct: number | null;
  reserveLabel: string;
  summary: string;
  action: string;
}

export interface AdaptiveTelemetryPlan {
  mode: AdaptiveTelemetryMode;
  pollIntervalMs: number;
  captureWindowMinutes: number;
  reason: string;
  rules: string[];
}

export interface DigitalTwinComponent {
  id: string;
  label: string;
  status: IntelligenceSeverity;
  confidence: number;
  detail: string;
}

export interface DigitalTwinReadiness {
  score: number;
  label: string;
  components: DigitalTwinComponent[];
}

export interface AssetIntelligence {
  siteId: string;
  displayName: string;
  generatedAt: number;
  severity: IntelligenceSeverity;
  trustScore: number;
  headline: string;
  briefing: string;
  signals: IntelligenceSignal[];
  power: PowerRiskForecast;
  anomalies: RootCauseSignal[];
  telemetryPlan: AdaptiveTelemetryPlan;
  readiness: DigitalTwinReadiness;
  nextActions: string[];
}

export interface FleetIntelligence {
  generatedAt: number;
  severity: IntelligenceSeverity;
  headline: string;
  briefing: string;
  fleetScore: number;
  counts: Record<IntelligenceSeverity, number>;
  priorityAssets: AssetIntelligence[];
  nextActions: string[];
  telemetryPlan: AdaptiveTelemetryPlan;
}

interface AssessInput {
  device: IntelligenceDevice;
  data: VRMData | null;
  details?: VRMDetailData | null;
  managedDevices?: ManagedNetworkDevice[];
  discoveredDevices?: DiscoveredNetworkDevice[];
  nowMs?: number;
}

const SEVERITY_RANK: Record<IntelligenceSeverity, number> = {
  normal: 0,
  watch: 1,
  action: 2,
  critical: 3,
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function formatWatts(value: number) {
  if (!Number.isFinite(value)) return 'unknown';
  return `${Math.round(value)} W`;
}

export function formatRuntime(hours: number | null) {
  if (hours == null || !Number.isFinite(hours)) return 'unknown';
  if (hours < 1) return '<1h';
  if (hours < 24) return `${hours.toFixed(hours < 6 ? 1 : 0)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

function maxSeverity(values: IntelligenceSeverity[]) {
  return values.reduce<IntelligenceSeverity>(
    (highest, next) => SEVERITY_RANK[next] > SEVERITY_RANK[highest] ? next : highest,
    'normal'
  );
}

function trendPerHour(values?: number[] | null, hours = 3): number | null {
  if (!values || values.length < 2) return null;
  const first = values[0];
  const last = values[values.length - 1];
  if (!Number.isFinite(first) || !Number.isFinite(last)) return null;
  return (last - first) / hours;
}

function isOffline(data: VRMData | null, nowMs: number) {
  if (!data || data.lastSeen === 0) return true;
  return (nowMs / 1000 - data.lastSeen) > 15 * 60;
}

function managedNetworkAttention(
  managedDevices: ManagedNetworkDevice[] = [],
  discoveredDevices: DiscoveredNetworkDevice[] = [],
  nowMs: number
) {
  const staleAfterMs = 10 * 60_000;
  const managedIssues = managedDevices.filter((device) => {
    const reported = device.lastReportedAt ? Date.parse(device.lastReportedAt) : NaN;
    const stale = !Number.isFinite(reported) || nowMs - reported > staleAfterMs;
    return stale || device.lastStatus === 'offline';
  });
  const discoveredIssues = discoveredDevices.filter((device) => {
    const seen = Date.parse(device.lastSeenAt);
    const stale = !Number.isFinite(seen) || nowMs - seen > staleAfterMs;
    return stale || device.lastStatus === 'offline';
  });

  return {
    managedIssues,
    discoveredIssues,
    totalObserved: discoveredDevices.length,
    totalManaged: managedDevices.length,
  };
}

function assessPower(data: VRMData | null): PowerRiskForecast {
  if (!data) {
    return {
      severity: 'critical',
      runtimeHours: null,
      socTrendPerHour: null,
      solarCoveragePct: null,
      reserveLabel: 'No telemetry',
      summary: 'VRM telemetry is unavailable, so runtime cannot be trusted.',
      action: 'Confirm Cerbo connectivity and trailer power before relying on the site.',
    };
  }

  const soc = clamp(data.battery.soc, 0, 100);
  const loadW = Math.max(0, data.dcLoad || Math.abs(data.battery.power) || 0);
  const solarW = Math.max(0, data.solar.power || 0);
  const netBatteryW = data.battery.power;
  const socTrend = trendPerHour(data.batterySparkline);
  const solarCoveragePct = loadW > 5 ? Math.round((solarW / loadW) * 100) : null;
  const discharging = data.battery.state === 2 || netBatteryW < -10;
  const charging = data.battery.state === 1 || netBatteryW > 10;

  let runtimeHours: number | null = null;
  const declinePerHour = socTrend != null && socTrend < -0.1
    ? Math.abs(socTrend)
    : discharging && loadW > 5
      ? Math.max(1, Math.abs(netBatteryW) / Math.max(loadW, 1) * 2)
      : 0;

  if (declinePerHour > 0) {
    runtimeHours = clamp((soc - 20) / declinePerHour, 0, 240);
  }

  let severity: IntelligenceSeverity = 'normal';
  if (soc <= 15 || (runtimeHours != null && runtimeHours < 4)) severity = 'critical';
  else if (soc <= 30 || (runtimeHours != null && runtimeHours < 12)) severity = 'action';
  else if (soc <= 50 || (solarCoveragePct != null && solarCoveragePct < 60 && discharging)) severity = 'watch';

  const reserveLabel = severity === 'critical'
    ? 'Critical reserve'
    : severity === 'action'
      ? 'Action reserve'
      : severity === 'watch'
        ? 'Watch reserve'
        : 'Healthy reserve';

  const summary = charging
    ? `Battery is charging at ${soc.toFixed(0)}% with ${formatWatts(solarW)} solar input.`
    : discharging
      ? `Battery is carrying load at ${soc.toFixed(0)}%; estimated reserve is ${formatRuntime(runtimeHours)}.`
      : `Battery is steady at ${soc.toFixed(0)}% with ${formatWatts(loadW)} DC load.`;

  const action = severity === 'critical'
    ? 'Dispatch or verify alternate power now; customer-visible downtime risk is high.'
    : severity === 'action'
      ? 'Check solar exposure, generator/shore power, and DC load before the next overnight window.'
      : severity === 'watch'
        ? 'Watch the next telemetry cycle and confirm load is expected for this site.'
        : 'No power intervention needed.';

  return { severity, runtimeHours, socTrendPerHour: socTrend, solarCoveragePct, reserveLabel, summary, action };
}

function buildAnomalies(
  device: IntelligenceDevice,
  data: VRMData | null,
  details: VRMDetailData | null | undefined,
  managedDevices: ManagedNetworkDevice[],
  discoveredDevices: DiscoveredNetworkDevice[],
  nowMs: number
): RootCauseSignal[] {
  const anomalies: RootCauseSignal[] = [];
  const offline = isOffline(data, nowMs);
  const network = managedNetworkAttention(managedDevices, discoveredDevices, nowMs);

  if (offline && device.teltonikaRmsDeviceId) {
    anomalies.push({
      id: 'vrm-offline-router-known',
      severity: 'action',
      title: 'VRM path is offline',
      summary: 'The trailer has a known Teltonika router but VRM telemetry is stale.',
      evidence: ['VRM lastSeen is outside the 15-minute live window', 'Router RMS ID is registered'],
      action: 'Open the modem session, confirm WAN/VPN status, then check Cerbo LAN reachability.',
    });
  } else if (offline) {
    anomalies.push({
      id: 'vrm-offline-no-router',
      severity: 'critical',
      title: 'Trailer telemetry is blind',
      summary: 'VRM telemetry is missing and no router access path is registered.',
      evidence: ['VRM is stale or unavailable', 'No Teltonika RMS device ID is linked'],
      action: 'Attach a remote access path or dispatch local verification before promising live visibility.',
    });
  }

  if (data && data.solar.mpptStateLabel === 'Fault') {
    anomalies.push({
      id: 'mppt-fault',
      severity: 'critical',
      title: 'MPPT charger fault',
      summary: 'Victron reports the solar charger in fault state.',
      evidence: [`MPPT state ${data.solar.mpptState}`, `Solar input ${formatWatts(data.solar.power)}`],
      action: 'Inspect charger fault code in VRM and verify PV wiring, breaker state, and battery voltage limits.',
    });
  }

  if (data && data.battery.soc < 35 && data.solar.power < 25 && data.dcLoad > 20 && !offline) {
    anomalies.push({
      id: 'low-soc-low-solar-load',
      severity: data.battery.soc < 20 ? 'critical' : 'action',
      title: 'Battery reserve is being consumed',
      summary: 'SOC is low while solar contribution is not covering active DC load.',
      evidence: [
        `SOC ${data.battery.soc.toFixed(0)}%`,
        `Solar ${formatWatts(data.solar.power)}`,
        `DC load ${formatWatts(data.dcLoad)}`,
      ],
      action: 'Reduce nonessential load or add power input before overnight operation.',
    });
  }

  if (network.managedIssues.length > 0) {
    anomalies.push({
      id: 'managed-lan-attention',
      severity: network.managedIssues.some((device) => device.lastStatus === 'offline') ? 'action' : 'watch',
      title: 'Managed LAN target needs attention',
      summary: `${network.managedIssues.length} mission-critical LAN target(s) are offline or overdue.`,
      evidence: network.managedIssues.slice(0, 3).map((item) => `${item.name} ${item.ipAddress}: ${item.lastStatus}`),
      action: 'Check camera/switch power, PoE path, and local IP reachability from the Cerbo scan.',
    });
  }

  if (details && details.alarms.configuredCount === 0) {
    anomalies.push({
      id: 'vrm-alarms-missing',
      severity: 'watch',
      title: 'VRM alarm coverage is not configured',
      summary: 'This installation has no configured VRM alarm rules returned by the alarms endpoint.',
      evidence: ['Configured VRM alarm count is 0'],
      action: 'Add VRM alarm rules for low SOC, loss of communication, and charger fault notification.',
    });
  }

  return anomalies.sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]);
}

function buildTelemetryPlan(power: PowerRiskForecast, anomalies: RootCauseSignal[], offline: boolean): AdaptiveTelemetryPlan {
  if (offline) {
    return {
      mode: 'offline',
      pollIntervalMs: 10 * 60_000,
      captureWindowMinutes: 0,
      reason: 'VRM is stale; avoid aggressive cloud polling until the device checks in.',
      rules: ['Poll VRM every 10 minutes', 'Keep LAN reporter spooling locally if available', 'Escalate if stale > 30 minutes'],
    };
  }

  const topSeverity = maxSeverity([power.severity, ...anomalies.map((item) => item.severity)]);
  if (topSeverity === 'critical') {
    return {
      mode: 'incident',
      pollIntervalMs: 60_000,
      captureWindowMinutes: 60,
      reason: 'Critical power or system condition detected.',
      rules: ['Increase VRM snapshot polling to 60 seconds', 'Capture pre/post incident trend window', 'Keep alert state latched until acknowledged'],
    };
  }
  if (topSeverity === 'action' || topSeverity === 'watch') {
    return {
      mode: 'watch',
      pollIntervalMs: 2 * 60_000,
      captureWindowMinutes: 30,
      reason: 'Watch condition present; collect enough data to confirm trend without wasting API quota.',
      rules: ['Poll VRM every 2 minutes', 'Refresh LAN inventory every minute', 'Return to normal after two healthy cycles'],
    };
  }
  return {
    mode: 'normal',
    pollIntervalMs: 5 * 60_000,
    captureWindowMinutes: 15,
    reason: 'All primary signals are inside expected operating ranges.',
      rules: ['Keep the normal 5-minute VRM refresh rate', 'Use event-triggered escalation when risk changes', 'Avoid redundant high-frequency calls'],
  };
}

function componentStatus(status: IntelligenceSeverity, confidence: number, detail: string, label: string, id: string): DigitalTwinComponent {
  return { id, label, status, confidence, detail };
}

function buildReadiness(
  device: IntelligenceDevice,
  data: VRMData | null,
  details: VRMDetailData | null | undefined,
  managedDevices: ManagedNetworkDevice[],
  discoveredDevices: DiscoveredNetworkDevice[],
  power: PowerRiskForecast,
  nowMs: number
): DigitalTwinReadiness {
  const offline = isOffline(data, nowMs);
  const network = managedNetworkAttention(managedDevices, discoveredDevices, nowMs);
  const components: DigitalTwinComponent[] = [
    componentStatus(power.severity, data ? 0.9 : 0.25, power.summary, 'Victron power system', 'power'),
    componentStatus(
      data && data.solar.mpptStateLabel !== 'Fault' ? 'normal' : data ? 'critical' : 'watch',
      data ? 0.85 : 0.25,
      data ? `MPPT ${data.solar.mpptStateLabel}, ${formatWatts(data.solar.power)} now` : 'Solar telemetry unavailable',
      'Solar charging path',
      'solar'
    ),
    componentStatus(
      offline ? 'critical' : 'normal',
      data ? 0.9 : 0.35,
      offline ? 'VRM telemetry is stale' : 'VRM telemetry is current',
      'Cerbo / VRM link',
      'vrm'
    ),
    componentStatus(
      device.teltonikaRmsDeviceId || device.routerAccessUrl ? 'normal' : 'watch',
      device.teltonikaRmsDeviceId || device.routerAccessUrl ? 0.8 : 0.35,
      device.teltonikaRmsDeviceId ? 'RMS remote access registered' : device.routerAccessUrl ? 'Router access URL registered' : 'No router access path linked',
      'Remote network access',
      'router'
    ),
    componentStatus(
      network.managedIssues.length > 0 ? 'action' : network.totalManaged > 0 || network.totalObserved > 0 ? 'normal' : 'watch',
      network.totalManaged > 0 || network.totalObserved > 0 ? 0.82 : 0.3,
      network.totalManaged > 0
        ? `${network.totalManaged} managed target(s), ${network.managedIssues.length} requiring attention`
        : network.totalObserved > 0
          ? `${network.totalObserved} LAN host(s) observed; no managed targets`
          : 'No Cerbo LAN inventory yet',
      'LAN / camera inventory',
      'lan'
    ),
    componentStatus(
      details ? (details.alarms.configuredCount > 0 ? 'normal' : 'watch') : 'watch',
      details ? 0.75 : 0.25,
      details ? `${details.alarms.configuredCount} VRM alarm rule(s), ${details.alarms.notificationRecipients} recipient(s)` : 'Detailed VRM alarm data not loaded',
      'Alarm guardrails',
      'alarms'
    ),
    componentStatus(
      data?.lat != null && data?.lon != null ? 'normal' : 'watch',
      data?.lat != null && data?.lon != null ? 0.8 : 0.25,
      data?.lat != null && data?.lon != null ? 'GPS coordinates are available' : 'GPS coordinates are unavailable',
      'Location context',
      'location'
    ),
  ];

  const score = Math.round(
    components.reduce((sum, item) => {
      const severityPenalty = [0, 12, 28, 45][SEVERITY_RANK[item.status]];
      return sum + clamp(100 - severityPenalty, 0, 100) * item.confidence;
    }, 0) / Math.max(components.reduce((sum, item) => sum + item.confidence, 0), 1)
  );

  return {
    score,
    label: score >= 85 ? 'Deployment ready' : score >= 70 ? 'Ready with watch items' : score >= 50 ? 'Action needed' : 'Not ready',
    components,
  };
}

export function assessAssetIntelligence(input: AssessInput): AssetIntelligence {
  const nowMs = input.nowMs ?? Date.now();
  const displayName = input.device.displayName ?? input.device.name;
  const managedDevices = input.managedDevices ?? [];
  const discoveredDevices = input.discoveredDevices ?? [];
  const power = assessPower(input.data);
  const offline = isOffline(input.data, nowMs);
  const anomalies = buildAnomalies(input.device, input.data, input.details, managedDevices, discoveredDevices, nowMs);
  const severity = maxSeverity([power.severity, ...anomalies.map((item) => item.severity)]);
  const telemetryPlan = buildTelemetryPlan(power, anomalies, offline);
  const readiness = buildReadiness(input.device, input.data, input.details, managedDevices, discoveredDevices, power, nowMs);
  const trustScore = clamp(Math.round((readiness.score * 0.7) - (SEVERITY_RANK[severity] * 8) + (input.data ? 12 : 0)), 0, 100);
  const nextActions = [
    ...anomalies.slice(0, 2).map((item) => item.action),
    power.action,
  ].filter((value, index, array) => array.indexOf(value) === index).slice(0, 3);

  const headline = severity === 'critical'
    ? `${displayName} needs immediate attention`
    : severity === 'action'
      ? `${displayName} has action items`
      : severity === 'watch'
        ? `${displayName} is on watch`
        : `${displayName} is operating normally`;

  const briefing = input.data
    ? `${power.summary} ${anomalies.length > 0 ? anomalies[0].summary : 'No cross-signal exceptions are active.'}`
    : 'Telemetry is not available; the system cannot provide a trusted operational briefing yet.';

  return {
    siteId: input.device.siteId,
    displayName,
    generatedAt: nowMs,
    severity,
    trustScore,
    headline,
    briefing,
    signals: [
      { label: 'SOC', value: input.data ? `${input.data.battery.soc.toFixed(0)}%` : '--', tone: power.severity },
      { label: 'Runtime', value: formatRuntime(power.runtimeHours), tone: power.severity },
      { label: 'Readiness', value: `${readiness.score}%`, tone: readiness.score >= 85 ? 'normal' : readiness.score >= 70 ? 'watch' : 'action' },
      { label: 'Telemetry', value: telemetryPlan.mode, tone: telemetryPlan.mode === 'normal' ? 'normal' : telemetryPlan.mode === 'offline' ? 'critical' : 'watch' },
    ],
    power,
    anomalies,
    telemetryPlan,
    readiness,
    nextActions,
  };
}

export function assessFleetIntelligence(assets: AssetIntelligence[]): FleetIntelligence {
  const counts: Record<IntelligenceSeverity, number> = { normal: 0, watch: 0, action: 0, critical: 0 };
  assets.forEach((asset) => { counts[asset.severity] += 1; });
  const severity = maxSeverity(assets.map((asset) => asset.severity));
  const fleetScore = assets.length > 0
    ? Math.round(assets.reduce((sum, asset) => sum + asset.trustScore, 0) / assets.length)
    : 0;
  const priorityAssets = [...assets]
    .sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] || a.trustScore - b.trustScore)
    .slice(0, 4);
  const telemetryPlan = buildTelemetryPlan(
    priorityAssets[0]?.power ?? assessPower(null),
    priorityAssets.flatMap((asset) => asset.anomalies),
    priorityAssets.some((asset) => asset.telemetryPlan.mode === 'offline')
  );

  const issueCount = counts.critical + counts.action + counts.watch;
  return {
    generatedAt: Date.now(),
    severity,
    headline: issueCount > 0
      ? `${issueCount} fleet watch item${issueCount === 1 ? '' : 's'} need review`
      : 'Fleet is inside expected operating bands',
    briefing: assets.length === 0
      ? 'No assigned assets are available for intelligence scoring.'
      : `${counts.normal}/${assets.length} asset${assets.length === 1 ? '' : 's'} are normal. Fleet trust score is ${fleetScore}%.`,
    fleetScore,
    counts,
    priorityAssets,
    nextActions: priorityAssets.flatMap((asset) => asset.nextActions).filter((value, index, array) => array.indexOf(value) === index).slice(0, 4),
    telemetryPlan,
  };
}
