import type { CerboNetworkScanPayload } from '@/lib/networkDevices';

type RouterDeviceReport = NonNullable<CerboNetworkScanPayload['devices']>[number];
type RouterCellularReport = NonNullable<CerboNetworkScanPayload['cellular']>;

export type TeltonikaRouterReport = {
  observedAt: string;
  cellular?: RouterCellularReport;
  devices: RouterDeviceReport[];
  warnings: string[];
};

type JsonValue = Record<string, unknown> | unknown[] | string | number | boolean | null;

const DEFAULT_TIMEOUT_MS = 8_000;
const LAN_ENDPOINTS = [
  '/api/devices/status',
  '/api/network/devices',
  '/api/dhcp/leases',
  '/api/hosts/status',
];

function normalizeBaseUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) throw new Error('Router access URL is empty');
  const withHttps = trimmed.replace(/^http:\/\//i, 'https://');
  return withHttps.replace(/\/+$/, '');
}

function getRouterCredentials() {
  const username = process.env.TELTONIKA_ROUTER_USERNAME ?? process.env.ROUTER_API_USERNAME ?? 'admin';
  const password = process.env.TELTONIKA_ROUTER_PASSWORD ?? process.env.ROUTER_API_PASSWORD;
  if (!password) return null;
  return { username, password };
}

async function fetchJson(url: string, init: RequestInit = {}, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<JsonValue> {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      Accept: 'application/json',
      'Accept-Encoding': 'identity',
      ...(init.headers ?? {}),
    },
  });

  const text = await response.text();
  let parsed: JsonValue = null;
  if (text) {
    try {
      parsed = JSON.parse(text) as JsonValue;
    } catch {
      parsed = text;
    }
  }

  if (!response.ok) {
    throw new Error(`Router API returned ${response.status}`);
  }

  return parsed;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function numberFrom(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function textFrom(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function firstNumber(...values: unknown[]) {
  for (const value of values) {
    const parsed = numberFrom(value);
    if (parsed !== null) return parsed;
  }
  return null;
}

function firstObject(value: JsonValue): Record<string, unknown> | null {
  const root = asRecord(value);
  const data = root?.data;
  if (Array.isArray(data)) return asRecord(data[0]);
  if (data && typeof data === 'object') return asRecord(data);
  if (Array.isArray(value)) return asRecord(value[0]);
  return root;
}

async function login(baseUrl: string) {
  const credentials = getRouterCredentials();
  if (!credentials) {
    throw new Error('TELTONIKA_ROUTER_PASSWORD is not configured');
  }

  const response = await fetchJson(`${baseUrl}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });

  const root = asRecord(response);
  const data = asRecord(root?.data);
  const token = textFrom(data?.token);
  if (!token) {
    throw new Error('Router login succeeded without a bearer token');
  }

  return token;
}

function extractCellularReport(modemStatus: JsonValue): RouterCellularReport | undefined {
  const modem = firstObject(modemStatus);
  if (!modem) return undefined;

  const report: RouterCellularReport = {
    source: 'router_api',
    operator: textFrom(modem.operator, modem.oper, modem.provider),
    networkType: textFrom(modem.ntype, modem.conntype, modem.data_conn_state),
    band: textFrom(modem.band, modem.sc_band_av),
    rssiDbm: numberFrom(modem.rssi ?? modem.signal),
    rsrpDbm: numberFrom(modem.rsrp),
    rsrqDb: numberFrom(modem.rsrq),
    sinrDb: numberFrom(modem.sinr),
    connectionState: textFrom(modem.state, modem.netstate, modem.operator_state, modem.data_conn_state),
    detail: 'Native Teltonika router modem API report',
  };

  return Object.values(report).some((value) => value != null) ? report : undefined;
}

function extractCandidateArrays(value: JsonValue): unknown[][] {
  const root = asRecord(value);
  const candidates = [
    value,
    root?.data,
    root?.devices,
    root?.leases,
    root?.hosts,
    asRecord(root?.data)?.devices,
    asRecord(root?.data)?.leases,
    asRecord(root?.data)?.hosts,
  ];
  return candidates.map(asArray).filter((items) => items.length > 0);
}

function extractIp(value: Record<string, unknown>) {
  return textFrom(value.ipAddress, value.ip_address, value.ip, value.address, value.host, value.ipaddr);
}

function extractLanReports(value: JsonValue, sourceLabel: string): RouterDeviceReport[] {
  const reports: RouterDeviceReport[] = [];
  for (const collection of extractCandidateArrays(value)) {
    for (const item of collection) {
      const row = asRecord(item);
      if (!row) continue;
      const ipAddress = extractIp(row);
      if (!ipAddress) continue;

      const statusText = textFrom(row.status, row.state, row.online);
      reports.push({
        ipAddress,
        status: statusText?.toLowerCase() === 'offline' ? 'offline' : 'online',
        macAddress: textFrom(row.macAddress, row.mac_address, row.mac),
        hostname: textFrom(row.hostname, row.hostName, row.name, row.device_name),
        latencyMs: firstNumber(row.latencyMs, row.latency_ms, row.ping_ms),
        detail: `${sourceLabel} router client observation`,
      });
    }
  }
  return reports;
}

function getLanEndpointPaths() {
  const configured = process.env.TELTONIKA_LAN_CLIENTS_PATHS
    ?.split(',')
    .map((path) => path.trim())
    .filter(Boolean);
  return configured?.length ? configured : LAN_ENDPOINTS;
}

export async function collectTeltonikaRouterReport(routerAccessUrl: string): Promise<TeltonikaRouterReport> {
  const baseUrl = normalizeBaseUrl(routerAccessUrl);
  const token = await login(baseUrl);
  const warnings: string[] = [];

  const modemStatus = await fetchJson(`${baseUrl}/api/modems/status`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });

  const devicesByIp = new Map<string, RouterDeviceReport>();
  for (const endpointPath of getLanEndpointPaths()) {
    try {
      const result = await fetchJson(`${baseUrl}${endpointPath.startsWith('/') ? endpointPath : `/${endpointPath}`}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      }, 4_000);
      for (const report of extractLanReports(result, endpointPath)) {
        devicesByIp.set(report.ipAddress, report);
      }
    } catch (error) {
      warnings.push(`${endpointPath}: ${error instanceof Error ? error.message : 'unavailable'}`);
    }
  }

  return {
    observedAt: new Date().toISOString(),
    cellular: extractCellularReport(modemStatus),
    devices: Array.from(devicesByIp.values()),
    warnings,
  };
}
