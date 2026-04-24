/**
 * lib/vrm.ts — Shared Victron VRM API utilities
 *
 * Single source of truth for attribute codes, types, fetch logic, and
 * sparkline extraction. Imported by both the API route (/api/vrm/[siteId])
 * and the SSR dashboard page fetch to keep logic in sync.
 */

// ── Attribute codes ────────────────────────────────────────────────────────────
export const A = {
  BATTERY_SOC:   51,
  BATTERY_V:     47,
  BATTERY_A:     49,
  BATTERY_W:     243,
  BATTERY_STATE: 215,
  SOLAR_W:       442,
  SOLAR_W_SYS:   113,  // system-level PV DC-coupled — more reliably tracked in stats
  SOLAR_V:       86,
  SOLAR_TODAY:   94,
  MPPT_STATE:    85,
  DC_SYSTEM:     140,
} as const;

export const MPPT_LABELS: Record<number, string> = {
  0: 'Off', 2: 'Fault', 3: 'Bulk', 4: 'Absorption',
  5: 'Float', 6: 'Storage', 7: 'Equalize',
  245: 'Off', 247: 'Equalize', 252: 'Ext. Control',
};

// ── Types ─────────────────────────────────────────────────────────────────────
export interface VRMData {
  siteId: string;
  lastSeen: number;
  battery: {
    soc: number; voltage: number; current: number; power: number; state: number;
  };
  solar: {
    power: number; voltage: number; yieldToday: number; mpptState: number; mpptStateLabel: string;
  };
  dcLoad: number;
  sparkline: number[];
  batterySparkline?: number[];
}

// ── Record helpers ─────────────────────────────────────────────────────────────
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

// ── Sparkline extraction ───────────────────────────────────────────────────────
/**
 * Safely coerce a raw VRM value to a finite number.
 * Returns 0 for null / undefined / NaN / Infinity.
 */
function safeNum(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
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

  // Format A / C — object keyed by attribute code string
  if (typeof records === 'object' && !Array.isArray(records)) {
    const attr = records[key];
    if (!attr || attr === false) return [];

    // Format C — bare array of values
    if (Array.isArray(attr)) {
      return (attr as unknown[]).slice(-6).map(safeNum);
    }

    // Format A standard — { avg: [...] } | { data: [...] } | { values: [...] }
    const arr: unknown[] | undefined = attr.avg ?? attr.data ?? attr.values;
    if (Array.isArray(arr)) {
      return arr.slice(-6).map(safeNum);
    }

    // Format A with nested records array: { records: [[ts, val], ...] }
    if (Array.isArray(attr.records)) {
      return (attr.records as unknown[]).slice(-6).map((row: unknown) =>
        Array.isArray(row) ? safeNum((row as unknown[])[1]) : safeNum(row)
      );
    }
  }

  // Format B — array where each element is { [attrCode]: { stats: [[ts, val, ...], ...] } }
  if (Array.isArray(records)) {
    const entry = (records as any[]).find((r: any) => r[key] !== undefined);
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

// ── VRM HTTP client ───────────────────────────────────────────────────────────
const VRM_BASE = 'https://vrmapi.victronenergy.com/v2';
const FETCH_TIMEOUT_MS = 8_000;

export async function fetchVRM(path: string): Promise<unknown> {
  const token = process.env.VICTRON_ADMIN_TOKEN;
  if (!token) throw new Error('VICTRON_ADMIN_TOKEN not configured');

  const res = await fetch(`${VRM_BASE}${path}`, {
    headers: { 'X-Authorization': `Token ${token}` },
    cache: 'no-store',
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!res.ok) throw new Error(`VRM HTTP ${res.status}: ${path}`);
  return res.json();
}

// ── High-level fetch for a single installation ────────────────────────────────
/**
 * Fetch diagnostics + 3-hour sparkline data for one installation.
 * Uses 15-minute interval buckets — hourly often returns `false` until full bucket forms.
 * Stats fetch failure is tolerated (sparkline just omitted).
 */
export async function fetchVRMData(siteId: string): Promise<VRMData> {
  const now         = Math.floor(Date.now() / 1000);
  const threeHrsAgo = now - 3 * 3_600;

  const [diagJson, statsJson] = await Promise.all([
    fetchVRM(`/installations/${siteId}/diagnostics`),
    fetchVRM(
      `/installations/${siteId}/stats` +
      `?type=custom` +
      `&attributeCodes[]=${A.SOLAR_W}` +
      `&attributeCodes[]=${A.SOLAR_W_SYS}` +
      `&attributeCodes[]=${A.BATTERY_SOC}` +
      `&interval=15mins&start=${threeHrsAgo}&end=${now}`
    ).catch(() => null),
  ]);

  const records: unknown[] = (diagJson as any)?.records ?? [];
  const solarW             = pick(records, A.SOLAR_W);
  const batteryW           = pick(records, A.BATTERY_W);
  const dcLoad             = hasAttr(records, A.DC_SYSTEM)
    ? pick(records, A.DC_SYSTEM)
    : deriveDCLoad(solarW, batteryW);
  const mpptStateRaw       = pick(records, A.MPPT_STATE);

  const sparklineRaw     = extractSparkline(statsJson, A.SOLAR_W);
  const sparkline        = sparklineRaw.length > 0
    ? sparklineRaw
    : extractSparkline(statsJson, A.SOLAR_W_SYS);
  const batterySparkline = extractSparkline(statsJson, A.BATTERY_SOC);

  if (statsJson && sparkline.length === 0) {
    const recType = Array.isArray((statsJson as any).records) ? 'array' : typeof (statsJson as any).records;
    const sample  = JSON.stringify((statsJson as any).records).slice(0, 200);
    console.warn(`[VRM stats] ${siteId}: no sparkline. records type=${recType} sample=${sample}`);
  }

  return {
    siteId,
    lastSeen: latestTimestamp(records),
    battery: {
      soc:     pick(records, A.BATTERY_SOC),
      voltage: pick(records, A.BATTERY_V),
      current: pick(records, A.BATTERY_A),
      power:   batteryW,
      state:   pick(records, A.BATTERY_STATE),
    },
    solar: {
      power:          solarW,
      voltage:        pick(records, A.SOLAR_V),
      yieldToday:     pick(records, A.SOLAR_TODAY),
      mpptState:      mpptStateRaw,
      mpptStateLabel: MPPT_LABELS[mpptStateRaw] ?? 'Off',
    },
    dcLoad,
    sparkline,
    batterySparkline,
  };
}
