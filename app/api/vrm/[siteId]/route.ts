import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';

const A = {
  BATTERY_SOC:   51,
  BATTERY_V:     47,
  BATTERY_A:     49,
  BATTERY_W:     243,
  BATTERY_STATE: 215,
  SOLAR_W:       442,
  SOLAR_V:       86,
  SOLAR_TODAY:   94,
  MPPT_STATE:    85,
  DC_SYSTEM:     140,
} as const;

const MPPT_LABELS: Record<number, string> = {
  0: 'Off', 2: 'Fault', 3: 'Bulk', 4: 'Absorption',
  5: 'Float', 6: 'Storage', 7: 'Equalize',
  245: 'Off', 247: 'Equalize', 252: 'Ext. Control',
};

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

function pick(records: any[], id: number): number {
  const rec = records.find((r: any) => r.idDataAttribute === id);
  return rec ? Number(rec.rawValue ?? 0) : 0;
}

function hasAttr(records: any[], id: number): boolean {
  return records.some((r: any) => r.idDataAttribute === id);
}

function latestTimestamp(records: any[]): number {
  return records.reduce((max: number, r: any) => Math.max(max, Number(r.timestamp ?? 0)), 0);
}

async function fetchVRM(path: string): Promise<any> {
  const token = process.env.VICTRON_ADMIN_TOKEN;
  if (!token) throw new Error('VICTRON_ADMIN_TOKEN not configured');
  const res = await fetch(`https://vrmapi.victronenergy.com/v2${path}`, {
    headers: { 'X-Authorization': `Token ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`VRM ${res.status}: ${path}`);
  return res.json();
}

function deriveDCLoad(solarW: number, batteryW: number): number {
  return Math.max(0, Math.round(solarW - batteryW));
}

/**
 * Extract a 6-point sparkline from the VRM stats response.
 *
 * VRM API response shape is underdocumented. We handle two observed formats:
 *
 * Format A (object-keyed):
 *   { records: { "442": { avg: [number|null, ...] } } }
 *
 * Format B (array, 4-element sub-arrays):
 *   { records: [ { "442": { stats: [[timestamp, value, null, null], ...] } } ] }
 *
 * If the format is unrecognised, returns [] and logs the raw shape for debugging.
 */
function extractSparkline(statsJson: any, attrCode: number): number[] {
  if (!statsJson) return [];
  const records = statsJson.records;
  if (!records) return [];
  const key = String(attrCode);

  // Format A — object keyed by attribute code string
  if (typeof records === 'object' && !Array.isArray(records)) {
    const attr = records[key];
    if (attr?.avg && Array.isArray(attr.avg)) {
      return (attr.avg as (number | null)[]).slice(-6).map(v => (v === null ? 0 : v));
    }
    // Some installs return 'data' instead of 'avg'
    if (attr?.data && Array.isArray(attr.data)) {
      return (attr.data as (number | null)[]).slice(-6).map(v => (v === null ? 0 : v));
    }
  }

  // Format B — array where each element is { [attrCode]: { stats: [[ts, val, ...], ...] } }
  if (Array.isArray(records)) {
    const entry = records.find((r: any) => r[key] !== undefined);
    if (entry) {
      const stats = entry[key]?.stats ?? entry[key]?.avg;
      if (Array.isArray(stats)) {
        // stats rows are either [timestamp, value, ...] or bare numbers
        const vals = stats.slice(-6).map((row: any) =>
          Array.isArray(row) ? (row[1] ?? 0) : (row ?? 0)
        );
        return vals as number[];
      }
    }
  }

  return [];
}

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { siteId: string } }
) {
  const { siteId } = params;

  if (!/^\d+$/.test(siteId)) {
    return NextResponse.json({ error: 'Invalid site ID' }, { status: 400 });
  }

  const supabase    = createClient();
  const adminClient = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [{ data: assignment }, { data: profile }] = await Promise.all([
    adminClient
      .from('device_assignments')
      .select('id, vrm_devices!inner(vrm_site_id)')
      .eq('user_id', user.id)
      .eq('vrm_devices.vrm_site_id', siteId)
      .maybeSingle(),
    adminClient.from('profiles').select('role').eq('id', user.id).single(),
  ]);

  if (!assignment && profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const now       = Math.floor(Date.now() / 1000);
    const sixHrsAgo = now - 6 * 3600;

    const [diagJson, statsJson] = await Promise.all([
      fetchVRM(`/installations/${siteId}/diagnostics`),
      fetchVRM(
        `/installations/${siteId}/stats` +
        `?type=custom&attributeCodes[]=${A.SOLAR_W}` +
        `&attributeCodes[]=${A.BATTERY_SOC}` +
        `&interval=hours&start=${sixHrsAgo}&end=${now}`
      ).catch(() => null),
    ]);

    const records: any[] = diagJson?.records ?? [];
    const solarW         = pick(records, A.SOLAR_W);
    const batteryW       = pick(records, A.BATTERY_W);
    const dcLoad         = hasAttr(records, A.DC_SYSTEM)
      ? pick(records, A.DC_SYSTEM)
      : deriveDCLoad(solarW, batteryW);
    const mpptStateRaw   = pick(records, A.MPPT_STATE);

    const sparkline        = extractSparkline(statsJson, A.SOLAR_W);
    const batterySparkline = extractSparkline(statsJson, A.BATTERY_SOC);

    // Log if stats came back but produced no sparkline data (helps diagnose format issues)
    if (statsJson && sparkline.length === 0) {
      console.warn(`[VRM stats] ${siteId}: stats returned but no sparkline extracted. records type=${Array.isArray(statsJson.records) ? 'array' : typeof statsJson.records}`);
    }

    const data: VRMData = {
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

    return NextResponse.json({ data, ok: true });
  } catch (err: any) {
    console.error(`[VRM] ${siteId}:`, err.message);
    return NextResponse.json({ error: err.message, ok: false }, { status: 502 });
  }
}
