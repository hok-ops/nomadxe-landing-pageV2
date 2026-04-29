/**
 * Shared Victron VRM API utilities.
 *
 * The fleet dashboard polls a lightweight snapshot (`fetchVRMData`) for every
 * assigned trailer. Rich detail views use `fetchVRMDetail` so we can surface
 * more of the VRM API without exploding request volume on initial load.
 */

export const A = {
  BATTERY_SOC: 51,
  BATTERY_V: 47,
  BATTERY_A: 49,
  BATTERY_W: 243,
  BATTERY_STATE: 215,
  SOLAR_W: 442,
  SOLAR_W_SYS: 113,
  SOLAR_V: 86,
  SOLAR_TODAY: 94,
  MPPT_STATE: 85,
  DC_SYSTEM: 140,
} as const;

export const MPPT_LABELS: Record<number, string> = {
  0: 'Off',
  2: 'Fault',
  3: 'Bulk',
  4: 'Absorption',
  5: 'Float',
  6: 'Storage',
  7: 'Equalize',
  245: 'Off',
  247: 'Equalize',
  252: 'Ext. Control',
};

export interface VRMData {
  siteId: string;
  lastSeen: number;
  battery: {
    soc: number;
    voltage: number;
    current: number;
    power: number;
    state: number;
  };
  solar: {
    power: number;
    voltage: number;
    yieldToday: number;
    mpptState: number;
    mpptStateLabel: string;
  };
  dcLoad: number;
  hasDcLoadReading?: boolean;
  sparkline: number[];
  batterySparkline?: number[];
  /** GPS coordinates from the VRM GPS widget — null when unavailable */
  lat: number | null;
  lon: number | null;
  /** Cached "City, ST ZIP" label derived from the latest known coordinates. */
  location: string | null;
}

export interface VRMWidgetMetric {
  key: string;
  label: string;
  value: string;
  rawValue: number | null;
  unit: string | null;
  stale: boolean;
}

export interface VRMSeriesPoint {
  timestamp: number;
  value: number;
  min?: number;
  max?: number;
}

export interface VRMSeries {
  key: string;
  label: string;
  unit: string | null;
  points: VRMSeriesPoint[];
}

export interface VRMDeviceOverview {
  name: string;
  customName: string | null;
  productName: string;
  productCode: string;
  connection: string;
  firmwareVersion: string;
  lastConnection: number | null;
}

export interface VRMAlarmConfig {
  attributeId: number;
  attributeLabel: string;
  enabled: boolean;
  notifyAfterSeconds: number | null;
  lowAlarm: number | null;
  highAlarm: number | null;
}

export interface VRMGpsSnapshot {
  latitude: number | null;
  longitude: number | null;
  speed: number | null;
  ageSeconds: number | null;
  hasOldData: boolean;
  mapUrl: string | null;
}

export interface VRMOverallWindow {
  solarYieldKwh: number | null;
  consumptionKwh: number | null;
}

export interface VRMDetailData {
  siteId: string;
  fetchedAt: number;
  gps: VRMGpsSnapshot | null;
  system: {
    deviceCount: number;
    solarChargers: number;
    gateways: number;
    batteryDevices: number;
    inverterChargers: number;
    devices: VRMDeviceOverview[];
  };
  widgets: {
    status: VRMWidgetMetric[];
    battery: VRMWidgetMetric[];
    solar: VRMWidgetMetric[];
    historic: VRMWidgetMetric[];
  };
  alarms: {
    configuredCount: number;
    notificationRecipients: number;
    items: VRMAlarmConfig[];
  };
  graphs: {
    solar: VRMSeries | null;
    batterySoc: VRMSeries | null;
    dcLoad: VRMSeries | null;
    forecastSolar: VRMSeries | null;
  };
  overall: {
    today: VRMOverallWindow;
    week: VRMOverallWindow;
    month: VRMOverallWindow;
    year: VRMOverallWindow;
  };
  exports: {
    csv7d: string;
    xlsx30d: string;
    gpsKml7d: string;
  };
}

const VRM_BASE = 'https://vrmapi.victronenergy.com/v2';
const FETCH_TIMEOUT_MS = 8_000;
const VRM_REFILL_PER_SECOND = 3;
const VRM_BURST_CAPACITY = 90;
const VRM_MAX_CONCURRENT = 8;
const VRM_SNAPSHOT_CACHE_MS = 45_000;
const VRM_DETAIL_CACHE_MS = 120_000;

type JsonRecord = Record<string, any>;
type CacheEntry = { expiresAt: number; value: unknown };

const vrmJsonCache = new Map<string, CacheEntry>();
const vrmInflight = new Map<string, Promise<unknown>>();

let vrmTokens = VRM_BURST_CAPACITY;
let vrmLastRefillAt = Date.now();
let vrmActiveRequests = 0;
let vrmBackoffUntil = 0;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function refillVrmTokens(now = Date.now()) {
  const elapsedMs = Math.max(0, now - vrmLastRefillAt);
  if (elapsedMs === 0) return;
  vrmTokens = Math.min(
    VRM_BURST_CAPACITY,
    vrmTokens + (elapsedMs / 1000) * VRM_REFILL_PER_SECOND
  );
  vrmLastRefillAt = now;
}

async function acquireVrmSlot() {
  while (true) {
    const now = Date.now();
    if (now < vrmBackoffUntil) {
      await sleep(Math.min(vrmBackoffUntil - now, 1_000));
      continue;
    }

    refillVrmTokens();
    if (vrmTokens >= 1 && vrmActiveRequests < VRM_MAX_CONCURRENT) {
      vrmTokens -= 1;
      vrmActiveRequests += 1;
      return () => {
        vrmActiveRequests = Math.max(0, vrmActiveRequests - 1);
      };
    }

    const tokenWaitMs = vrmTokens >= 1
      ? 50
      : Math.ceil(((1 - vrmTokens) / VRM_REFILL_PER_SECOND) * 1000);
    await sleep(Math.min(Math.max(tokenWaitMs, 50), 500));
  }
}

function noteVrmRateLimit(response: Response) {
  if (response.status !== 429) return;
  const retryAfter = response.headers.get('retry-after');
  const retrySeconds = retryAfter ? Number(retryAfter) : NaN;
  const delayMs = Number.isFinite(retrySeconds)
    ? Math.max(1_000, retrySeconds * 1_000)
    : 5_000;
  vrmBackoffUntil = Math.max(vrmBackoffUntil, Date.now() + delayMs);
  vrmTokens = 0;
}

function cacheTtlForVrmPath(path: string) {
  if (
    path.includes('/system-overview') ||
    path.includes('/alarms') ||
    path.includes('/overallstats') ||
    path.includes('/widgets/Status') ||
    path.includes('/widgets/BatterySummary') ||
    path.includes('/widgets/SolarChargerSummary') ||
    path.includes('/widgets/HistoricData') ||
    path.includes('/widgets/Graph') ||
    path.includes('type=forecast')
  ) {
    return VRM_DETAIL_CACHE_MS;
  }

  return VRM_SNAPSHOT_CACHE_MS;
}

function cacheKeyForVrmPath(path: string) {
  const [base, query] = path.split('?');
  if (!query) return path;

  const search = new URLSearchParams(query);
  // Rolling VRM windows include fresh start/end timestamps on every poll.
  // Cache by query shape so one browser tab does not defeat the short TTL cache.
  search.delete('start');
  search.delete('end');
  const normalized = search.toString();
  return normalized ? `${base}?${normalized}` : base;
}

function getCachedVrmJson(path: string) {
  const cached = vrmJsonCache.get(path);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    vrmJsonCache.delete(path);
    return null;
  }
  return cached.value;
}

function setCachedVrmJson(path: string, value: unknown) {
  vrmJsonCache.set(path, {
    value,
    expiresAt: Date.now() + cacheTtlForVrmPath(path),
  });
}

function getVrmToken(): string {
  const token = process.env.VICTRON_ADMIN_TOKEN;
  if (!token) throw new Error('VICTRON_ADMIN_TOKEN not configured');
  return token;
}

function buildHeaders(): HeadersInit {
  return { 'X-Authorization': `Token ${getVrmToken()}` };
}

function buildQuery(params: Record<string, string | number | boolean | Array<string | number> | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      value.forEach((item) => search.append(key, String(item)));
      continue;
    }
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

export async function fetchVRM(path: string): Promise<unknown> {
  const cacheKey = cacheKeyForVrmPath(path);
  const cached = getCachedVrmJson(cacheKey);
  if (cached !== null) return cached;

  const inflight = vrmInflight.get(cacheKey);
  if (inflight) return inflight;

  const request = (async () => {
    const release = await acquireVrmSlot();
    try {
      const res = await fetch(`${VRM_BASE}${path}`, {
        headers: buildHeaders(),
        cache: 'no-store',
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });

      if (!res.ok) {
        noteVrmRateLimit(res);
        throw new Error(`VRM HTTP ${res.status}: ${path}`);
      }
      const json = await res.json();
      setCachedVrmJson(cacheKey, json);
      return json;
    } finally {
      release();
      vrmInflight.delete(cacheKey);
    }
  })();

  vrmInflight.set(cacheKey, request);
  return request;
}

export async function fetchVRMRaw(path: string): Promise<Response> {
  const release = await acquireVrmSlot();
  try {
    const res = await fetch(`${VRM_BASE}${path}`, {
      headers: buildHeaders(),
      cache: 'no-store',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!res.ok) {
      noteVrmRateLimit(res);
      throw new Error(`VRM HTTP ${res.status}: ${path}`);
    }
    return res;
  } finally {
    release();
  }
}

async function safeFetchVRM(path: string): Promise<unknown | null> {
  try {
    return await fetchVRM(path);
  } catch {
    return null;
  }
}

function safeNum(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function finiteOrNull(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function pick(records: unknown[], id: number): number {
  const rec = (records as any[]).find((r: any) => r.idDataAttribute === id);
  return rec ? Number(rec.rawValue ?? 0) : 0;
}

export function hasAttr(records: unknown[], id: number): boolean {
  return (records as any[]).some((r: any) => r.idDataAttribute === id);
}

export function latestTimestamp(records: unknown[]): number {
  return (records as any[]).reduce(
    (max: number, r: any) => Math.max(max, Number(r.timestamp ?? 0)),
    0
  );
}

export function deriveDCLoad(solarW: number, batteryW: number): number {
  return Math.max(0, Math.round(solarW - batteryW));
}

function humanizeKey(input: string): string {
  return input
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function extractUnit(format: unknown): string | null {
  const template = String(format ?? '').trim();
  if (!template) return null;
  const unit = template.replace(/%s/g, '').trim();
  return unit || null;
}

function keywordMatch(value: unknown, keywords: string[]): boolean {
  const haystack = String(value ?? '').toLowerCase();
  return keywords.some((keyword) => haystack.includes(keyword));
}

function getWidgetData(widgetJson: unknown): JsonRecord {
  const data = (widgetJson as any)?.records?.data;
  if (data && typeof data === 'object' && !Array.isArray(data)) return data as JsonRecord;
  return {};
}

function listWidgetMetrics(widgetJson: unknown, limit = 6): VRMWidgetMetric[] {
  const data = getWidgetData(widgetJson);

  return Object.entries(data)
    .filter(([key, value]) => {
      if (key === 'secondsAgo' || key === 'hasOldData') return false;
      return value && typeof value === 'object' && !Array.isArray(value);
    })
    .map(([key, value]) => {
      const item = value as JsonRecord;
      return {
        key,
        label: String(item.dataAttributeName ?? item.description ?? item.code ?? humanizeKey(key)),
        value: String(
          item.valueFormattedWithUnit ??
          item.formattedValue ??
          item.value ??
          item.rawValue ??
          'Unavailable'
        ),
        rawValue: finiteOrNull(item.rawValue ?? item.valueFloat ?? item.value),
        unit: extractUnit(item.formatWithUnit),
        stale: Boolean(item.hasOldData),
      };
    })
    .filter((item) => item.value && item.value !== 'null')
    .sort((a, b) => Number(a.stale) - Number(b.stale))
    .slice(0, limit);
}

function getGpsAttributes(widgetJson: unknown): JsonRecord {
  const attrs = (widgetJson as any)?.records?.data?.attributes;
  if (attrs && typeof attrs === 'object' && !Array.isArray(attrs)) return attrs as JsonRecord;
  return {};
}

function findGpsValue(attributes: JsonRecord, keywords: string[]): number | null {
  for (const value of Object.values(attributes)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    const item = value as JsonRecord;
    const fields = [
      item.dataAttributeName,
      item.dbusPath,
      item.code,
      item.formatWithUnit,
      item.valueFormattedWithUnit,
    ];
    if (fields.some((field) => keywordMatch(field, keywords))) {
      return finiteOrNull(item.rawValue ?? item.valueFloat ?? item.value);
    }
  }
  return null;
}

function extractGps(widgetJson: unknown): VRMGpsSnapshot | null {
  const attributes = getGpsAttributes(widgetJson);
  if (Object.keys(attributes).length === 0) return null;

  const latitude = findGpsValue(attributes, ['latitude', 'lat']);
  const longitude = findGpsValue(attributes, ['longitude', 'lon', 'lng']);
  const speed = findGpsValue(attributes, ['speed', 'velocity']);
  const ageSeconds = finiteOrNull(attributes.secondsAgo?.value ?? attributes.secondsAgo?.rawValue);
  const hasOldData = Boolean(attributes.hasOldData);
  const mapUrl =
    latitude !== null && longitude !== null
      ? `https://www.google.com/maps?q=${latitude},${longitude}`
      : null;

  return { latitude, longitude, speed, ageSeconds, hasOldData, mapUrl };
}

function extractSystemDevices(systemJson: unknown): VRMDeviceOverview[] {
  const devices = (systemJson as any)?.records?.devices;
  if (!Array.isArray(devices)) return [];

  return devices.map((device: any) => ({
    name: String(device.name ?? device.customName ?? device.productName ?? 'Unnamed device'),
    customName: device.customName ? String(device.customName) : null,
    productName: String(device.productName ?? 'Unknown product'),
    productCode: String(device.productCode ?? ''),
    connection: String(device.connection ?? ''),
    firmwareVersion: String(device.firmwareVersion ?? 'Unknown'),
    lastConnection: finiteOrNull(device.lastConnection),
  }));
}

function pickSeriesLabel(meta: JsonRecord, fallback: string): string {
  return String(meta.description ?? meta.dataAttributeName ?? meta.code ?? fallback);
}

function extractSeriesFromGraph(graphJson: unknown): VRMSeries[] {
  const data = (graphJson as any)?.records?.data;
  const meta = (graphJson as any)?.records?.meta;
  if (!data || typeof data !== 'object') return [];

  return Object.entries(data)
    .filter(([, value]) => Array.isArray(value))
    .map(([key, value]) => {
      const seriesMeta = (meta?.[key] ?? {}) as JsonRecord;
      const points = (value as unknown[])
        .filter((row) => Array.isArray(row) && row.length >= 2)
        .map((row) => {
          const [timestamp, mean, min, max] = row as number[];
          return {
            timestamp: safeNum(timestamp),
            value: safeNum(mean),
            min: Number.isFinite(min) ? min : undefined,
            max: Number.isFinite(max) ? max : undefined,
          };
        });

      return {
        key,
        label: pickSeriesLabel(seriesMeta, humanizeKey(key)),
        unit: extractUnit(seriesMeta.formatWithUnit),
        points,
      };
    })
    .filter((series) => series.points.length > 0);
}

function extractSeriesFromStats(statsJson: unknown): VRMSeries[] {
  const records = (statsJson as any)?.records;
  if (!records || typeof records !== 'object') return [];

  return Object.entries(records)
    .filter(([, value]) => Array.isArray(value))
    .map(([key, value]) => ({
      key,
      label: humanizeKey(key),
      unit: null,
      points: (value as unknown[])
        .filter((row) => Array.isArray(row) && row.length >= 2)
        .map((row) => ({
          timestamp: safeNum((row as unknown[])[0]),
          value: safeNum((row as unknown[])[1]),
        })),
    }))
    .filter((series) => series.points.length > 0);
}

function pickSeriesByKeywords(seriesList: VRMSeries[], keywords: string[]): VRMSeries | null {
  const direct = seriesList.find((series) => keywordMatch(series.label, keywords) || keywordMatch(series.key, keywords));
  return direct ?? null;
}

function firstSeries(seriesList: VRMSeries[]): VRMSeries | null {
  return seriesList.length > 0 ? seriesList[0] : null;
}

function sumNumericValues(input: unknown): number | null {
  if (!input || typeof input !== 'object') return null;
  const values = Object.values(input as JsonRecord)
    .map((value) => finiteOrNull(value))
    .filter((value): value is number => value !== null);
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0);
}

function extractOverallWindow(overallJson: unknown, timeframeKey: string): number | null {
  const totals = (overallJson as any)?.records?.[timeframeKey]?.totals;
  return sumNumericValues(totals);
}

function extractConfiguredAlarms(alarmsJson: unknown) {
  const rawAlarms: any[] = Array.isArray((alarmsJson as any)?.alarms) ? (alarmsJson as any).alarms : [];
  const rawUsers: any[] = Array.isArray((alarmsJson as any)?.users) ? (alarmsJson as any).users : [];
  const rawAttributes: any[] = Array.isArray((alarmsJson as any)?.attributes) ? (alarmsJson as any).attributes : [];
  const attrMap = new Map<number, string>(
    rawAttributes.map((item: any) => [
      safeNum(item.idDataAttribute),
      String(item.description ?? item.code ?? `Attribute ${item.idDataAttribute}`),
    ])
  );

  const items: VRMAlarmConfig[] = rawAlarms
    .map((alarm: any) => {
      const attributeId = safeNum(alarm.idDataAttribute);
      return {
        attributeId,
        attributeLabel: attrMap.get(attributeId) ?? `Attribute ${attributeId}`,
        enabled: Number(alarm.AlarmEnabled ?? alarm.alarmEnabled ?? 0) === 1,
        notifyAfterSeconds: finiteOrNull(alarm.NotifyAfterSeconds ?? alarm.notifyAfterSeconds),
        lowAlarm: finiteOrNull(alarm.lowAlarm),
        highAlarm: finiteOrNull(alarm.highAlarm),
      };
    })
    .filter((alarm: VRMAlarmConfig) => alarm.enabled)
    .slice(0, 8);

  const notificationRecipients = rawUsers.filter(
    (user: any) => Number(user.receivesAlarmNotifications ?? 0) === 1 && !user.muted
  ).length;

  return {
    configuredCount: rawAlarms.filter((alarm: any) => Number(alarm.AlarmEnabled ?? alarm.alarmEnabled ?? 0) === 1).length,
    notificationRecipients,
    items,
  };
}

function systemCounts(devices: VRMDeviceOverview[]) {
  const hasKeyword = (device: VRMDeviceOverview, keywords: string[]) =>
    keywords.some((keyword) => {
      const haystack = `${device.productName} ${device.name} ${device.productCode}`.toLowerCase();
      return haystack.includes(keyword);
    });

  return {
    deviceCount: devices.length,
    solarChargers: devices.filter((device) => hasKeyword(device, ['solar', 'mppt'])).length,
    gateways: devices.filter((device) => hasKeyword(device, ['gx', 'global link', 'cerbo', 'venus'])).length,
    batteryDevices: devices.filter((device) => hasKeyword(device, ['battery', 'bms', 'lynx', 'shunt'])).length,
    inverterChargers: devices.filter((device) => hasKeyword(device, ['multi', 'quattro', 'inverter', 'charger'])).length,
  };
}

/**
 * Extract a 6-point sparkline from the VRM stats response.
 *
 * VRM API returns `false` for an attribute when no data exists in the requested
 * time window. Three known shapes:
 *
 *   Format A (object-keyed):  { records: { "442": { avg: [n|null, ...] } } }
 *   Format B (array of rows): { records: [ { "442": { stats: [[ts,val,...], ...] } } ] }
 *   Format C (flat array):    { records: { "442": [v1, v2, ...] } }
 */
export function extractSparkline(statsJson: unknown, attrCode: number): number[] {
  if (!statsJson) return [];
  const records = (statsJson as any).records;
  if (!records) return [];
  const key = String(attrCode);

  if (typeof records === 'object' && !Array.isArray(records)) {
    const attr = records[key];
    if (!attr || attr === false) return [];

    if (Array.isArray(attr)) {
      return (attr as unknown[]).slice(-6).map(safeNum);
    }

    const arr: unknown[] | undefined = attr.avg ?? attr.data ?? attr.values;
    if (Array.isArray(arr)) {
      return arr.slice(-6).map(safeNum);
    }

    if (Array.isArray(attr.records)) {
      return (attr.records as unknown[]).slice(-6).map((row: unknown) =>
        Array.isArray(row) ? safeNum((row as unknown[])[1]) : safeNum(row)
      );
    }
  }

  if (Array.isArray(records)) {
    const entry = (records as any[]).find((row: any) => row[key] !== undefined);
    if (entry) {
      const stats: unknown[] | undefined =
        entry[key]?.stats ?? entry[key]?.avg ?? entry[key]?.data;
      if (Array.isArray(stats)) {
        return stats.slice(-6).map((row: unknown) =>
          Array.isArray(row) ? safeNum((row as unknown[])[1]) : safeNum(row)
        );
      }
    }
  }

  return [];
}

/**
 * Fleet-safe snapshot used by SSR and 5-minute polling.
 */
export async function fetchVRMData(siteId: string): Promise<VRMData> {
  const now = Math.floor(Date.now() / 1000);
  const threeHrsAgo = now - 3 * 3_600;

  const [diagJson, statsJson, gpsJson] = await Promise.all([
    fetchVRM(`/installations/${siteId}/diagnostics`),
    fetchVRM(
      `/installations/${siteId}/stats` +
      buildQuery({
        type: 'custom',
        'attributeCodes[]': [A.SOLAR_W, A.SOLAR_W_SYS, A.BATTERY_SOC],
        interval: '15mins',
        start: threeHrsAgo,
        end: now,
      })
    ).catch(() => null),
    safeFetchVRM(`/installations/${siteId}/widgets/GPS`),
  ]);

  const records: unknown[] = (diagJson as any)?.records ?? [];
  const solarW = pick(records, A.SOLAR_W);
  const batteryW = pick(records, A.BATTERY_W);
  const hasDcLoadReading = hasAttr(records, A.DC_SYSTEM);
  const dcLoad = hasDcLoadReading
    ? pick(records, A.DC_SYSTEM)
    : deriveDCLoad(solarW, batteryW);
  const mpptStateRaw = pick(records, A.MPPT_STATE);

  const sparklineRaw = extractSparkline(statsJson, A.SOLAR_W);
  const sparkline = sparklineRaw.length > 0
    ? sparklineRaw
    : extractSparkline(statsJson, A.SOLAR_W_SYS);

  const gps = extractGps(gpsJson);

  return {
    siteId,
    lastSeen: latestTimestamp(records),
    battery: {
      soc: pick(records, A.BATTERY_SOC),
      voltage: pick(records, A.BATTERY_V),
      current: pick(records, A.BATTERY_A),
      power: batteryW,
      state: pick(records, A.BATTERY_STATE),
    },
    solar: {
      power: solarW,
      voltage: pick(records, A.SOLAR_V),
      yieldToday: pick(records, A.SOLAR_TODAY),
      mpptState: mpptStateRaw,
      mpptStateLabel: MPPT_LABELS[mpptStateRaw] ?? 'Off',
    },
    dcLoad,
    hasDcLoadReading,
    sparkline,
    batterySparkline: extractSparkline(statsJson, A.BATTERY_SOC),
    lat: gps?.latitude ?? null,
    lon: gps?.longitude ?? null,
    location: null,
  };
}

/**
 * Rich installation view for the opened trailer card.
 */
export async function fetchVRMDetail(siteId: string): Promise<VRMDetailData> {
  getVrmToken();

  const now = Math.floor(Date.now() / 1000);
  const oneDayAgo = now - 24 * 3_600;
  const sevenDaysAgo = now - 7 * 24 * 3_600;

  const [
    gpsJson,
    systemJson,
    alarmsJson,
    statusJson,
    batteryJson,
    solarJson,
    historicJson,
    graphJson,
    forecastJson,
    overallSolarJson,
    overallConsumptionJson,
  ] = await Promise.all([
    safeFetchVRM(`/installations/${siteId}/widgets/GPS`),
    safeFetchVRM(`/installations/${siteId}/system-overview`),
    safeFetchVRM(`/installations/${siteId}/alarms`),
    safeFetchVRM(`/installations/${siteId}/widgets/Status`),
    safeFetchVRM(`/installations/${siteId}/widgets/BatterySummary`),
    safeFetchVRM(`/installations/${siteId}/widgets/SolarChargerSummary`),
    safeFetchVRM(`/installations/${siteId}/widgets/HistoricData`),
    safeFetchVRM(
      `/installations/${siteId}/widgets/Graph` +
      buildQuery({
        'attributeIds[]': [A.SOLAR_W, A.BATTERY_SOC, A.DC_SYSTEM],
        start: oneDayAgo,
        end: now,
        width: 144,
        pointsPerPixel: 0.3,
        useMinMax: 1,
      })
    ),
    safeFetchVRM(
      `/installations/${siteId}/stats` +
      buildQuery({
        type: 'forecast',
        interval: 'hours',
        start: now,
        end: now + 24 * 3_600,
      })
    ),
    safeFetchVRM(`/installations/${siteId}/overallstats${buildQuery({ type: 'solar_yield' })}`),
    safeFetchVRM(`/installations/${siteId}/overallstats${buildQuery({ type: 'consumption' })}`),
  ]);

  const systemDevices = extractSystemDevices(systemJson);
  const graphSeries = extractSeriesFromGraph(graphJson);
  const forecastSeries = extractSeriesFromStats(forecastJson);

  return {
    siteId,
    fetchedAt: now,
    gps: extractGps(gpsJson),
    system: {
      ...systemCounts(systemDevices),
      devices: systemDevices.slice(0, 10),
    },
    widgets: {
      status: listWidgetMetrics(statusJson),
      battery: listWidgetMetrics(batteryJson),
      solar: listWidgetMetrics(solarJson),
      historic: listWidgetMetrics(historicJson),
    },
    alarms: extractConfiguredAlarms(alarmsJson),
    graphs: {
      solar:
        pickSeriesByKeywords(graphSeries, ['solar', 'pv']) ??
        firstSeries(graphSeries),
      batterySoc: pickSeriesByKeywords(graphSeries, ['soc', 'state of charge', 'battery']),
      dcLoad: pickSeriesByKeywords(graphSeries, ['dc system', 'load', 'dc']),
      forecastSolar:
        pickSeriesByKeywords(forecastSeries, ['solar', 'pv', 'forecast']) ??
        firstSeries(forecastSeries),
    },
    overall: {
      today: {
        solarYieldKwh: extractOverallWindow(overallSolarJson, 'today'),
        consumptionKwh: extractOverallWindow(overallConsumptionJson, 'today'),
      },
      week: {
        solarYieldKwh: extractOverallWindow(overallSolarJson, 'week'),
        consumptionKwh: extractOverallWindow(overallConsumptionJson, 'week'),
      },
      month: {
        solarYieldKwh: extractOverallWindow(overallSolarJson, 'month'),
        consumptionKwh: extractOverallWindow(overallConsumptionJson, 'month'),
      },
      year: {
        solarYieldKwh: extractOverallWindow(overallSolarJson, 'year'),
        consumptionKwh: extractOverallWindow(overallConsumptionJson, 'year'),
      },
    },
    exports: {
      csv7d: `/api/vrm/${siteId}/export?kind=csv&range=7d`,
      xlsx30d: `/api/vrm/${siteId}/export?kind=xlsx&range=30d`,
      gpsKml7d: `/api/vrm/${siteId}/export?kind=gps-kml&range=7d&start=${sevenDaysAgo}&end=${now}`,
    },
  };
}
