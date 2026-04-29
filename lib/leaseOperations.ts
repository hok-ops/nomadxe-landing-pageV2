import type { VRMData } from '@/lib/vrm';
import type { AssetIntelligence, IntelligenceSeverity } from '@/lib/assetIntelligence';

export type LeasePackageType = 'power_base' | 'fully_equipped';
export type LeaseStatus = 'draft' | 'scheduled' | 'active' | 'paused' | 'ending' | 'ended';
export type ServiceTicketStatus = 'received' | 'triage' | 'scheduled' | 'en_route' | 'blocked' | 'completed' | 'cancelled';
export type ServiceTicketType = 'service' | 'relocation' | 'connectivity' | 'power' | 'monitoring' | 'billing' | 'other';
export type ServiceTicketPriority = 'low' | 'normal' | 'urgent';
export type ProofEventSeverity = 'info' | 'watch' | 'action' | 'critical';

export interface DashboardDeviceRef {
  siteId: string;
  name: string;
  displayName: string | null;
  teltonikaRmsDeviceId: string | null;
  routerAccessUrl: string | null;
}

export interface LeaseAssetSummary {
  siteId: string;
  name: string;
  displayName: string | null;
  role: string;
}

export interface LeaseSummary {
  id: string;
  leaseNumber: string;
  packageType: LeasePackageType;
  status: LeaseStatus;
  siteName: string;
  siteAddress: string | null;
  serviceLevel: string;
  monitoringPartner: string | null;
  startsOn: string | null;
  endsOn: string | null;
  assets: LeaseAssetSummary[];
  isSynthetic: boolean;
}

export interface ServiceTicketSummary {
  id: string;
  leaseId: string | null;
  siteId: string | null;
  type: ServiceTicketType;
  priority: ServiceTicketPriority;
  status: ServiceTicketStatus;
  title: string;
  description: string;
  requestedFor: string | null;
  customerVisibleNote: string | null;
  createdAt: string;
}

export interface ProofOfServiceEvent {
  id: string;
  leaseId: string | null;
  siteId: string | null;
  eventType: string;
  severity: ProofEventSeverity;
  title: string;
  summary: string;
  occurredAt: string;
  evidence: Record<string, unknown>;
  isSynthetic: boolean;
}

export interface AccessAuditSummary {
  id: string;
  siteId: string | null;
  accessType: string;
  status: 'requested' | 'granted' | 'denied' | 'failed';
  actorRole: string;
  createdAt: string;
  reason: string | null;
}

export interface LeaseOperationsData {
  leases: LeaseSummary[];
  tickets: ServiceTicketSummary[];
  proofEvents: ProofOfServiceEvent[];
  accessEvents: AccessAuditSummary[];
  dataSource: 'database' | 'telemetry-fallback';
}

function firstKnownDevice(devices: DashboardDeviceRef[], siteId: string | null | undefined) {
  if (!siteId) return null;
  return devices.find((device) => device.siteId === siteId) ?? null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function liveState(data: VRMData | null, nowMs: number) {
  if (!data || data.lastSeen === 0) return 'No current telemetry';
  const staleSeconds = Math.max(0, Math.floor(nowMs / 1000 - data.lastSeen));
  if (staleSeconds > 15 * 60) return `Telemetry stale ${Math.floor(staleSeconds / 60)}m`;
  return `Live ${Math.floor(staleSeconds / 60)}m ago`;
}

function severityRank(severity: IntelligenceSeverity) {
  return { normal: 0, watch: 1, action: 2, critical: 3 }[severity];
}

export function buildSyntheticLeaseOperations(
  devices: DashboardDeviceRef[],
  dataMap: Record<string, VRMData | null>,
  assetIntelligence: AssetIntelligence[],
  now = new Date()
): LeaseOperationsData {
  const nowMs = now.getTime();
  const worstSeverity = assetIntelligence.reduce<IntelligenceSeverity>(
    (current, asset) => severityRank(asset.severity) > severityRank(current) ? asset.severity : current,
    'normal'
  );
  const priorityAsset = [...assetIntelligence].sort((a, b) => severityRank(b.severity) - severityRank(a.severity))[0] ?? null;

  const proofEvents: ProofOfServiceEvent[] = devices.slice(0, 6).map((device, index) => {
    const data = dataMap[device.siteId] ?? null;
    const asset = assetIntelligence.find((item) => item.siteId === device.siteId);
    const status = liveState(data, nowMs);
    return {
      id: `synthetic-telemetry-${device.siteId}`,
      leaseId: null,
      siteId: device.siteId,
      eventType: 'telemetry',
      severity: asset?.severity === 'critical' ? 'critical' : asset?.severity === 'action' ? 'action' : asset?.severity === 'watch' ? 'watch' : 'info',
      title: `${device.displayName ?? device.name} visibility check`,
      summary: `${status}. ${asset?.headline ?? 'Power and connectivity signals are being watched.'}`,
      occurredAt: new Date(nowMs - index * 4 * 60_000).toISOString(),
      evidence: {
        source: 'VRM snapshot',
        siteId: device.siteId,
        dataFreshnessScore: asset?.dataFreshnessScore ?? null,
      },
      isSynthetic: true,
    };
  });

  const syntheticLease: LeaseSummary = {
    id: 'synthetic-current-portfolio',
    leaseNumber: 'Current assigned fleet',
    packageType: devices.some((device) => device.teltonikaRmsDeviceId || device.routerAccessUrl) ? 'fully_equipped' : 'power_base',
    status: devices.length > 0 ? 'active' : 'scheduled',
    siteName: devices.length === 1 ? devices[0].displayName ?? devices[0].name : 'Assigned NomadXE fleet',
    siteAddress: null,
    serviceLevel: 'Full trailer servicing',
    monitoringPartner: devices.some((device) => device.teltonikaRmsDeviceId || device.routerAccessUrl) ? 'NomadXE remote operations' : null,
    startsOn: null,
    endsOn: null,
    assets: devices.map((device) => ({
      siteId: device.siteId,
      name: device.name,
      displayName: device.displayName,
      role: 'primary',
    })),
    isSynthetic: true,
  };

  return {
    leases: devices.length > 0 ? [syntheticLease] : [],
    tickets: worstSeverity === 'normal' ? [] : [{
      id: 'synthetic-recommended-service-focus',
      leaseId: syntheticLease.id,
      siteId: priorityAsset?.siteId ?? null,
      type: worstSeverity === 'critical' || worstSeverity === 'action' ? 'service' : 'connectivity',
      priority: worstSeverity === 'critical' ? 'urgent' : 'normal',
      status: 'triage',
      title: 'Recommended operations review',
      description: 'Generated from live telemetry intelligence; not a submitted customer ticket.',
      requestedFor: null,
      customerVisibleNote: 'The dashboard detected a watch item. NomadXE can convert this into a service ticket if needed.',
      createdAt: now.toISOString(),
    }],
    proofEvents,
    accessEvents: [],
    dataSource: 'telemetry-fallback',
  };
}

export function normalizeLeaseOperationsRows({
  devices,
  leases,
  tickets,
  proofEvents,
  accessEvents,
}: {
  devices: DashboardDeviceRef[];
  leases: any[];
  tickets: any[];
  proofEvents: any[];
  accessEvents: any[];
}): LeaseOperationsData {
  const deviceByDbId = new Map<number, DashboardDeviceRef>();
  for (const lease of leases) {
    for (const asset of lease.lease_assets ?? []) {
      const rawDevice = asset.vrm_devices;
      if (rawDevice?.id != null) {
        const siteId = String(rawDevice.vrm_site_id);
        const known = firstKnownDevice(devices, siteId);
        deviceByDbId.set(Number(rawDevice.id), known ?? {
          siteId,
          name: String(rawDevice.name ?? siteId),
          displayName: rawDevice.display_name ?? null,
          teltonikaRmsDeviceId: rawDevice.teltonika_rms_device_id ?? null,
          routerAccessUrl: rawDevice.router_access_url ?? null,
        });
      }
    }
  }

  return {
    leases: leases.map((lease) => ({
      id: String(lease.id),
      leaseNumber: String(lease.lease_number),
      packageType: lease.package_type === 'fully_equipped' ? 'fully_equipped' : 'power_base',
      status: String(lease.status ?? 'active') as LeaseStatus,
      siteName: String(lease.site_name ?? 'NomadXE site'),
      siteAddress: asString(lease.site_address),
      serviceLevel: String(lease.service_level ?? 'Full trailer servicing'),
      monitoringPartner: asString(lease.monitoring_partner),
      startsOn: asString(lease.starts_on),
      endsOn: asString(lease.ends_on),
      assets: (lease.lease_assets ?? []).map((asset: any) => {
        const rawDevice = asset.vrm_devices;
        const siteId = String(rawDevice?.vrm_site_id ?? '');
        const known = firstKnownDevice(devices, siteId);
        return {
          siteId,
          name: String(known?.name ?? rawDevice?.name ?? siteId),
          displayName: known?.displayName ?? rawDevice?.display_name ?? null,
          role: String(asset.role ?? 'primary'),
        };
      }).filter((asset: LeaseAssetSummary) => asset.siteId),
      isSynthetic: false,
    })),
    tickets: tickets.map((ticket) => {
      const device = ticket.vrm_device_id != null ? deviceByDbId.get(Number(ticket.vrm_device_id)) : null;
      return {
        id: String(ticket.id),
        leaseId: asString(ticket.lease_id),
        siteId: device?.siteId ?? null,
        type: String(ticket.type ?? 'service') as ServiceTicketType,
        priority: String(ticket.priority ?? 'normal') as ServiceTicketPriority,
        status: String(ticket.status ?? 'received') as ServiceTicketStatus,
        title: String(ticket.title ?? 'Service request'),
        description: String(ticket.description ?? ''),
        requestedFor: asString(ticket.requested_for),
        customerVisibleNote: asString(ticket.customer_visible_note),
        createdAt: String(ticket.created_at),
      };
    }),
    proofEvents: proofEvents.map((event) => {
      const device = event.vrm_device_id != null ? deviceByDbId.get(Number(event.vrm_device_id)) : null;
      return {
        id: String(event.id),
        leaseId: asString(event.lease_id),
        siteId: device?.siteId ?? null,
        eventType: String(event.event_type ?? 'telemetry'),
        severity: String(event.severity ?? 'info') as ProofEventSeverity,
        title: String(event.title ?? 'Proof event'),
        summary: String(event.summary ?? ''),
        occurredAt: String(event.occurred_at),
        evidence: typeof event.evidence === 'object' && event.evidence ? event.evidence : {},
        isSynthetic: false,
      };
    }),
    accessEvents: accessEvents.map((event) => {
      const device = event.vrm_device_id != null ? deviceByDbId.get(Number(event.vrm_device_id)) : null;
      return {
        id: String(event.id),
        siteId: device?.siteId ?? null,
        accessType: String(event.access_type ?? 'admin_gateway'),
        status: String(event.status ?? 'requested') as AccessAuditSummary['status'],
        actorRole: String(event.actor_role ?? 'user'),
        createdAt: String(event.created_at),
        reason: asString(event.reason),
      };
    }),
    dataSource: 'database',
  };
}
