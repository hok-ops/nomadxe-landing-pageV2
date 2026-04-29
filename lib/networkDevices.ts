export type ManagedNetworkStatus = 'unknown' | 'online' | 'offline';

export interface ManagedNetworkDevice {
  id: number;
  vrmDeviceId: number;
  name: string;
  ipAddress: string;
  alertOnOffline: boolean;
  isActive: boolean;
  lastStatus: ManagedNetworkStatus;
  lastReportedAt: string | null;
  lastChangeAt: string | null;
  lastLatencyMs: number | null;
  lastDetail: string | null;
}

export interface DiscoveredNetworkDevice {
  id: number;
  vrmDeviceId: number;
  ipAddress: string;
  macAddress: string | null;
  hostname: string | null;
  lastStatus: ManagedNetworkStatus;
  firstSeenAt: string;
  lastSeenAt: string;
  lastLatencyMs: number | null;
  lastDetail: string | null;
  isIgnored: boolean;
  isManaged?: boolean;
}

export interface ManagedNetworkDeviceStatusSummary {
  total: number;
  online: number;
  offline: number;
  stale: number;
}

export interface CerboNetworkScanPayload {
  vrmSiteId: string;
  observedAt?: string;
  scanMode?: 'full' | 'targets';
  cellular?: {
    source?: 'cerbo' | 'teltonika_rms' | 'router_api' | 'manual';
    operator?: string | null;
    networkType?: string | null;
    band?: string | null;
    rssiDbm?: number | null;
    rsrpDbm?: number | null;
    rsrqDb?: number | null;
    sinrDb?: number | null;
    connectionState?: string | null;
    detail?: string | null;
  };
  devices: Array<{
    ipAddress: string;
    status: 'online' | 'offline';
    macAddress?: string | null;
    hostname?: string | null;
    latencyMs?: number | null;
    detail?: string | null;
  }>;
}

export interface CellularSignalReport {
  id: number;
  vrmDeviceId: number;
  observedAt: string;
  source: 'cerbo' | 'teltonika_rms' | 'router_api' | 'manual';
  operator: string | null;
  networkType: string | null;
  band: string | null;
  rssiDbm: number | null;
  rsrpDbm: number | null;
  rsrqDb: number | null;
  sinrDb: number | null;
  connectionState: string | null;
  detail: string | null;
}

export function cellularSignalTone(report: Pick<CellularSignalReport, 'rsrpDbm' | 'rsrqDb' | 'sinrDb'> | null) {
  if (!report) return 'unknown' as const;
  const rsrp = report.rsrpDbm;
  const rsrq = report.rsrqDb;
  const sinr = report.sinrDb;
  if ((typeof rsrp === 'number' && rsrp <= -115) || (typeof rsrq === 'number' && rsrq <= -15) || (typeof sinr === 'number' && sinr < 0)) return 'poor' as const;
  if ((typeof rsrp === 'number' && rsrp <= -105) || (typeof rsrq === 'number' && rsrq <= -12) || (typeof sinr === 'number' && sinr < 5)) return 'watch' as const;
  if ((typeof rsrp === 'number' && rsrp >= -95) && (typeof sinr === 'number' ? sinr >= 10 : true)) return 'good' as const;
  return 'fair' as const;
}

export function isManagedNetworkStatus(value: unknown): value is ManagedNetworkStatus {
  return value === 'unknown' || value === 'online' || value === 'offline';
}

export function getManagedDeviceSummary(
  devices: ManagedNetworkDevice[],
  staleAfterMs = 10 * 60_000
): ManagedNetworkDeviceStatusSummary {
  const now = Date.now();
  let online = 0;
  let offline = 0;
  let stale = 0;

  for (const device of devices) {
    const lastReportedMs = device.lastReportedAt ? Date.parse(device.lastReportedAt) : NaN;
    const isStale = !Number.isFinite(lastReportedMs) || (now - lastReportedMs) > staleAfterMs;

    if (isStale) {
      stale += 1;
      continue;
    }

    if (device.lastStatus === 'online') online += 1;
    else if (device.lastStatus === 'offline') offline += 1;
    else stale += 1;
  }

  return {
    total: devices.length,
    online,
    offline,
    stale,
  };
}
