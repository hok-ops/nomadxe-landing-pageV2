import type { CerboNetworkScanPayload } from '@/lib/networkDevices';

type RouterDeviceReport = NonNullable<CerboNetworkScanPayload['devices']>[number];
type RouterCellularReport = NonNullable<CerboNetworkScanPayload['cellular']>;

export type TeltonikaRouterReport = {
  observedAt: string;
  cellular?: RouterCellularReport;
  devices: RouterDeviceReport[];
  warnings: string[];
  lanProbes: TeltonikaLanProbeResult[];
};

type JsonValue = Record<string, unknown> | unknown[] | string | number | boolean | null;

const DEFAULT_TIMEOUT_MS = 8_000;
const LAN_ENDPOINTS = [
  '/api/interfaces/status',
  '/api/wireless/interfaces/status',
  '/api/devices/status',
  '/api/network/devices',
  '/api/dhcp/leases',
  '/api/dhcp/leases/status',
  '/api/dhcp/status',
  '/api/hosts/status',
  '/api/lan/status',
  '/api/network/lan/status',
  '/api/network/status',
  '/api/network/topology/status',
  '/api/topology/status',
];

export type TeltonikaLanProbeResult = {
  path: string;
  ok: boolean;
  status: number | null;
  elapsedMs: number;
  deviceCount: number;
  bodyShape: string;
  sampleKeys: string[];
  error?: string;
};

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

async function fetchRouterJson(url: string, init: RequestInit = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const startedAt = Date.now();
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
  const contentType = response.headers.get('content-type');
  let parsed: JsonValue = null;
  if (text) {
    try {
      parsed = JSON.parse(text) as JsonValue;
    } catch {
      parsed = text;
    }
  }

  return {
    ok: response.ok,
    status: response.status,
    contentType,
    parsed,
    elapsedMs: Date.now() - startedAt,
  };
}

async function fetchJson(url: string, init: RequestInit = {}, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<JsonValue> {
  const result = await fetchRouterJson(url, init, timeoutMs);

  if (!result.ok) {
    throw new Error(`Router API returned ${result.status}`);
  }

  return result.parsed;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
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

function objectKeysFromJson(value: JsonValue) {
  const firstCandidate = firstObject(value);
  if (firstCandidate) return Object.keys(firstCandidate).slice(0, 12);
  if (Array.isArray(value) && value.length > 0) {
    const firstRow = asRecord(value[0]);
    if (firstRow) return Object.keys(firstRow).slice(0, 12);
  }
  return [];
}

function describeJsonShape(value: JsonValue, contentType: string | null) {
  if (Array.isArray(value)) return `array(${value.length})`;
  const root = asRecord(value);
  if (root) {
    const keys = Object.keys(root).slice(0, 5);
    return keys.length ? `object:${keys.join(',')}` : 'object';
  }
  if (typeof value === 'string') {
    return contentType?.includes('html') ? 'html' : 'text';
  }
  return value === null ? 'empty' : typeof value;
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

function extractIp(value: Record<string, unknown>) {
  return textFrom(
    value.ipAddress,
    value.ip_address,
    value.ip,
    value.address,
    value.ipaddr,
    value.ipv4,
    value.lease_ip,
    value.host_ip
  );
}

function extractCandidateRows(value: JsonValue): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];
  const seen = new Set<Record<string, unknown>>();

  const visit = (current: unknown, depth: number) => {
    if (depth > 4) return;

    if (Array.isArray(current)) {
      for (const item of current) visit(item, depth + 1);
      return;
    }

    const record = asRecord(current);
    if (!record) return;

    if (extractIp(record) && !seen.has(record)) {
      seen.add(record);
      rows.push(record);
    }

    for (const child of Object.values(record)) {
      if (child && typeof child === 'object') visit(child, depth + 1);
    }
  };

  visit(value, 0);
  return rows;
}

function statusFromRow(row: Record<string, unknown>): 'online' | 'offline' {
  for (const value of [row.status, row.state, row.online, row.active, row.connected]) {
    if (typeof value === 'boolean') return value ? 'online' : 'offline';
    if (typeof value !== 'string') continue;
    const normalized = value.trim().toLowerCase();
    if (!normalized) continue;
    if (['offline', 'down', 'inactive', 'disconnected', 'expired', 'failed'].some((word) => normalized.includes(word))) {
      return 'offline';
    }
    return 'online';
  }
  return 'online';
}

function extractLanReports(value: JsonValue, sourceLabel: string): RouterDeviceReport[] {
  const reports: RouterDeviceReport[] = [];
  for (const row of extractCandidateRows(value)) {
    const ipAddress = extractIp(row);
    if (!ipAddress) continue;

    reports.push({
      ipAddress,
      status: statusFromRow(row),
      macAddress: textFrom(row.macAddress, row.mac_address, row.mac, row.macaddr, row.hwaddr),
      hostname: textFrom(row.hostname, row.hostName, row.name, row.device_name, row.client_name),
      latencyMs: firstNumber(row.latencyMs, row.latency_ms, row.ping_ms, row.rtt_ms, row.response_time_ms),
      detail: `${sourceLabel} router client observation`,
    });
  }
  return reports;
}

export function getLanEndpointPaths() {
  const configured = process.env.TELTONIKA_LAN_CLIENTS_PATHS
    ?.split(',')
    .map((path) => path.trim())
    .filter(Boolean);
  return configured?.length ? configured : LAN_ENDPOINTS;
}

async function probeLanEndpoint(baseUrl: string, token: string, endpointPath: string): Promise<{
  result: TeltonikaLanProbeResult;
  reports: RouterDeviceReport[];
}> {
  const path = endpointPath.startsWith('/') ? endpointPath : `/${endpointPath}`;
  try {
    const response = await fetchRouterJson(`${baseUrl}${path}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    }, 4_000);
    const reports = response.ok ? extractLanReports(response.parsed, path) : [];

    return {
      result: {
        path,
        ok: response.ok,
        status: response.status,
        elapsedMs: response.elapsedMs,
        deviceCount: reports.length,
        bodyShape: describeJsonShape(response.parsed, response.contentType),
        sampleKeys: objectKeysFromJson(response.parsed),
        error: response.ok ? undefined : `HTTP ${response.status}`,
      },
      reports,
    };
  } catch (error) {
    return {
      result: {
        path,
        ok: false,
        status: null,
        elapsedMs: 4_000,
        deviceCount: 0,
        bodyShape: 'unavailable',
        sampleKeys: [],
        error: error instanceof Error ? error.message : 'Endpoint unavailable',
      },
      reports: [],
    };
  }
}

export async function collectTeltonikaRouterReport(routerAccessUrl: string): Promise<TeltonikaRouterReport> {
  const baseUrl = normalizeBaseUrl(routerAccessUrl);
  const token = await login(baseUrl);
  const warnings: string[] = [];

  const modemStatusPromise = fetchJson(`${baseUrl}/api/modems/status`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  })
    .then((value) => ({ value, error: null }))
    .catch((error) => ({ value: null, error }));

  const lanProbePromise = Promise.all(
    getLanEndpointPaths().map((endpointPath) => probeLanEndpoint(baseUrl, token, endpointPath))
  );

  const [modemStatusResult, lanProbeResults] = await Promise.all([modemStatusPromise, lanProbePromise]);

  const devicesByIp = new Map<string, RouterDeviceReport>();
  const lanProbes = lanProbeResults.map(({ result }) => result);
  for (const { result, reports } of lanProbeResults) {
    if (!result.ok) {
      warnings.push(`${result.path}: ${result.error ?? 'unavailable'}`);
      continue;
    }
    for (const report of reports) {
      devicesByIp.set(report.ipAddress, report);
    }
  }

  if (modemStatusResult.error) {
    warnings.push(`/api/modems/status: ${modemStatusResult.error instanceof Error ? modemStatusResult.error.message : 'unavailable'}`);
  }

  return {
    observedAt: new Date().toISOString(),
    cellular: modemStatusResult.value ? extractCellularReport(modemStatusResult.value) : undefined,
    devices: Array.from(devicesByIp.values()),
    warnings,
    lanProbes,
  };
}
