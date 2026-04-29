import type { AssetIntelligence, IntelligenceSeverity } from './assetIntelligence';
import type { VRMData, VRMDetailData } from './vrm';
import type { DiscoveredNetworkDevice, ManagedNetworkDevice } from './networkDevices';

export type VisualBriefingFrameKind = 'state' | 'cause' | 'risk' | 'action' | 'proof';

export interface VisualBriefingFrame {
  id: string;
  kind: VisualBriefingFrameKind;
  title: string;
  eyebrow: string;
  severity: IntelligenceSeverity;
  summary: string;
  evidence: string[];
  hotspots: Array<{
    id: string;
    label: string;
    detail: string;
    tone: IntelligenceSeverity;
  }>;
}

interface BuildVisualBriefingFramesInput {
  intelligence: AssetIntelligence;
  data: VRMData | null;
  details: VRMDetailData | null;
  managedDevices: ManagedNetworkDevice[];
  discoveredDevices: DiscoveredNetworkDevice[];
}

function fmt(value: number | null | undefined, unit = '') {
  if (value == null || !Number.isFinite(value)) return 'unknown';
  return `${Math.round(value)}${unit}`;
}

function staleAge(data: VRMData | null) {
  if (!data?.lastSeen) return 'no trusted sync yet';
  const ageSeconds = Math.max(0, Date.now() / 1000 - data.lastSeen);
  if (ageSeconds < 60) return `${Math.floor(ageSeconds)}s ago`;
  if (ageSeconds < 3600) return `${Math.floor(ageSeconds / 60)}m ago`;
  return `${Math.floor(ageSeconds / 3600)}h ago`;
}

function managedNetworkSummary(managedDevices: ManagedNetworkDevice[], discoveredDevices: DiscoveredNetworkDevice[]) {
  const managedOffline = managedDevices.filter((device) => device.lastStatus === 'offline').length;
  const discoveredOffline = discoveredDevices.filter((device) => device.lastStatus === 'offline').length;
  const total = managedDevices.length + discoveredDevices.length;
  if (total === 0) return 'No Cerbo LAN inventory has been received yet.';
  if (managedOffline + discoveredOffline === 0) return `${total} LAN device signal(s) are online or recently observed.`;
  return `${managedOffline + discoveredOffline}/${total} LAN device signal(s) need review.`;
}

export function buildVisualBriefingFrames({
  intelligence,
  data,
  details,
  managedDevices,
  discoveredDevices,
}: BuildVisualBriefingFramesInput): VisualBriefingFrame[] {
  const anomaly = intelligence.anomalies[0];
  const stateEvidence = [
    `Battery ${data ? fmt(data.battery.soc, '%') : 'unknown'}`,
    `Solar ${data ? fmt(data.solar.power, ' W') : 'unknown'}`,
    `DC load ${data ? fmt(data.dcLoad, ' W') : 'unknown'}`,
    `VRM sync ${staleAge(data)}`,
  ];

  return [
    {
      id: 'state',
      kind: 'state',
      title: `${intelligence.displayName} current operating picture`,
      eyebrow: 'Frame 1 / Live State',
      severity: intelligence.severity,
      summary: intelligence.briefing,
      evidence: stateEvidence,
      hotspots: [
        { id: 'battery', label: 'Battery', detail: data ? `${fmt(data.battery.soc, '%')} state of charge, ${fmt(data.battery.voltage, ' V')}` : 'No battery telemetry returned.', tone: intelligence.power.severity },
        { id: 'solar', label: 'Solar', detail: data ? `${fmt(data.solar.power, ' W')} input, MPPT ${data.solar.mpptStateLabel}` : 'No solar telemetry returned.', tone: data?.solar.mpptStateLabel === 'Fault' ? 'critical' : 'normal' },
        { id: 'sync', label: 'Freshness', detail: `VRM last sync: ${staleAge(data)}`, tone: data && Date.now() / 1000 - data.lastSeen < 15 * 60 ? 'normal' : 'critical' },
      ],
    },
    {
      id: 'cause',
      kind: 'cause',
      title: 'Most likely cause path',
      eyebrow: 'Frame 2 / Cause Map',
      severity: anomaly?.severity ?? intelligence.power.severity,
      summary: anomaly?.summary ?? 'No cross-signal exception is active. The strongest signal is the power reserve forecast.',
      evidence: anomaly?.evidence ?? stateEvidence.slice(0, 3),
      hotspots: [
        { id: 'load', label: 'Load demand', detail: `Current DC load is ${data ? fmt(data.dcLoad, ' W') : 'unknown'}.`, tone: data && data.dcLoad > 120 ? 'watch' : 'normal' },
        { id: 'coverage', label: 'Solar coverage', detail: intelligence.power.solarCoveragePct == null ? 'No active load coverage calculation.' : `${intelligence.power.solarCoveragePct}% of active load.`, tone: intelligence.power.solarCoveragePct != null && intelligence.power.solarCoveragePct < 60 ? 'watch' : 'normal' },
        { id: 'network', label: 'Network evidence', detail: managedNetworkSummary(managedDevices, discoveredDevices), tone: managedDevices.some((device) => device.lastStatus === 'offline') ? 'watch' : 'normal' },
      ],
    },
    {
      id: 'risk',
      kind: 'risk',
      title: 'Risk window and confidence',
      eyebrow: 'Frame 3 / Risk Window',
      severity: intelligence.readiness.score < 70 ? 'action' : intelligence.power.severity,
      summary: `Trust score is ${intelligence.trustScore}%. Digital twin readiness is ${intelligence.readiness.score}%. Reserve estimate is ${intelligence.power.runtimeHours == null ? 'unknown' : `${intelligence.power.runtimeHours.toFixed(1)} hours`}.`,
      evidence: [
        `Readiness ${intelligence.readiness.score}%`,
        `Trust ${intelligence.trustScore}%`,
        `Monitoring pace ${Math.round(intelligence.telemetryPlan.pollIntervalMs / 1000)}s`,
      ],
      hotspots: intelligence.readiness.components.slice(0, 4).map((component) => ({
        id: component.id,
        label: component.label,
        detail: component.detail,
        tone: component.status,
      })),
    },
    {
      id: 'action',
      kind: 'action',
      title: 'Recommended operator action',
      eyebrow: 'Frame 4 / Next Move',
      severity: intelligence.nextActions.length > 0 ? intelligence.severity : 'normal',
      summary: intelligence.nextActions[0] ?? 'No immediate field action is recommended. Keep normal monitoring pace.',
      evidence: intelligence.nextActions.length > 0 ? intelligence.nextActions.slice(0, 4) : ['All primary signals are inside expected operating bands.'],
      hotspots: [
        { id: 'remote', label: 'Remote check', detail: 'Use RMS/VRM access only when the customer or operator needs live verification.', tone: 'watch' },
        { id: 'ticket', label: 'Ticket path', detail: 'If an issue is customer-visible, create a support ticket so proof of service is preserved.', tone: intelligence.severity === 'normal' ? 'normal' : 'action' },
        { id: 'report', label: 'Report', detail: 'Generate a historical intelligence report after the condition is understood.', tone: 'normal' },
      ],
    },
    {
      id: 'proof',
      kind: 'proof',
      title: 'Proof package',
      eyebrow: 'Frame 5 / Evidence Record',
      severity: 'normal',
      summary: 'This frame collects the facts that should travel with a customer update, service ticket, or daily report.',
      evidence: [
        details?.alarms.configuredCount != null ? `${details.alarms.configuredCount} VRM alarm rule(s)` : 'Alarm rule detail not loaded',
        details?.system.deviceCount != null ? `${details.system.deviceCount} Victron device(s) inventoried` : 'Device inventory not loaded',
        managedNetworkSummary(managedDevices, discoveredDevices),
      ],
      hotspots: [
        { id: 'customer', label: 'Customer language', detail: 'Explain what happened, what evidence confirms it, and what NomadXE is doing next.', tone: 'normal' },
        { id: 'ops', label: 'Operations handoff', detail: 'Attach frame evidence to the ticket or shift briefing for continuity.', tone: 'normal' },
      ],
    },
  ];
}
