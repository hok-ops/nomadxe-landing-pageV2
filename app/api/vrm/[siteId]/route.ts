import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';

// ── VRM attribute ID constants ────────────────────────────────────────────────
// Source: Victron VRM API / Venus OS DBUS attribute registry
const A = {
  BATTERY_SOC: 282,    // Battery Monitor State of charge (%)
  BATTERY_V:   259,    // Battery Monitor Voltage (V)
  BATTERY_A:   261,    // Battery Monitor Current (A)
  BATTERY_W:   262,    // Battery Monitor Power (W)
  SOLAR_W:     789,    // Solar Charger PV power (W)
  SOLAR_V:     776,    // Solar Charger PV voltage (V)
  SOLAR_TODAY: 784,    // Solar Charger Yield today (kWh)
  AC_LOAD:     8,      // AC Consumption L1 (W)
  AC_OUTPUT:   9,      // Multi/Quattro AC Output L1 (W)
  VEBUS_STATE: 64,     // VEBus / Multi state enum
} as const;

// VEBus state enum → human label
const VEBUS_LABELS: Record<number, string> = {
  0: 'Off', 1: 'Low Power', 2: 'Fault',
  3: 'Bulk', 4: 'Absorption', 5: 'Float',
  6: 'Storage', 7: 'Equalize', 8: 'Passthru',
  9: 'Inverting', 10: 'Power Assist', 11: 'Power Supply',
};

export interface VRMData {
  siteId: string;
  lastSeen: number;           // unix seconds — used by client for heartbeat
  battery: { soc: number; voltage: number; current: number; power: number };
  solar:   { power: number; voltage: number; yieldToday: number };
  inverterState: number;
  inverterStateLabel: string;
  acLoad: number;             // W
  sparkline: number[];        // last 6 hourly solar power readings (W)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function pick(records: any[], id: number): number {
  const rec = records.find((r: any) => r.idDataAttribute === id);
  return rec ? Number(rec.rawValue ?? 0) : 0;
}

function pickString(records: any[], id: number): string {
  const rec = records.find((r: any) => r.idDataAttribute === id);
  return rec?.formatWithUnit ?? '';
}

function latestTimestamp(records: any[]): number {
  return records.reduce((max: number, r: any) => Math.max(max, Number(r.timestamp ?? 0)), 0);
}

async function fetchVRM(path: string): Promise<any> {
  const token = process.env.VICTRON_ADMIN_TOKEN;
  if (!token) throw new Error('VICTRON_ADMIN_TOKEN not configured');

  const url = `https://vrmapi.victronenergy.com/v2${path}`;
  const res = await fetch(url, {
    headers: { 'X-Authorization': `Bearer ${token}` },
    next: { revalidate: 0 },   // always fresh
  });
  if (!res.ok) throw new Error(`VRM API ${res.status}: ${url}`);
  return res.json();
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: { siteId: string } }
) {
  const { siteId } = params;

  // 1. Verify caller is authenticated
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // 2. Verify caller owns this device (RLS-safe check via admin client)
  const adminClient = createAdminClient();
  const { data: assignment } = await adminClient
    .from('device_assignments')
    .select('id, vrm_devices!inner(vrm_site_id)')
    .eq('user_id', user.id)
    .eq('vrm_devices.vrm_site_id', siteId)
    .maybeSingle();

  // Also allow admin users unrestricted access
  const { data: profile } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!assignment && profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    // 3. Fetch diagnostics and 6-hour solar sparkline in parallel
    const now = Math.floor(Date.now() / 1000);
    const sixHoursAgo = now - 6 * 3600;

    const [diagJson, statsJson] = await Promise.all([
      fetchVRM(`/installations/${siteId}/diagnostics`),
      fetchVRM(
        `/installations/${siteId}/stats` +
        `?type=custom&attributeCodes[]=${A.SOLAR_W}` +
        `&interval=hours&start=${sixHoursAgo}&end=${now}`
      ).catch(() => null),  // sparkline is non-critical; fail gracefully
    ]);

    const records: any[] = diagJson?.records ?? [];

    // 4. Normalize diagnostics
    const inverterStateRaw = pick(records, A.VEBUS_STATE);
    const solarW = pick(records, A.SOLAR_W);
    // Prefer AC_LOAD; fall back to AC_OUTPUT as the consumption signal
    const acLoad = pick(records, A.AC_LOAD) || pick(records, A.AC_OUTPUT);

    const data: VRMData = {
      siteId,
      lastSeen: latestTimestamp(records) || now,
      battery: {
        soc:     pick(records, A.BATTERY_SOC),
        voltage: pick(records, A.BATTERY_V),
        current: pick(records, A.BATTERY_A),
        power:   pick(records, A.BATTERY_W),
      },
      solar: {
        power:      solarW,
        voltage:    pick(records, A.SOLAR_V),
        yieldToday: pick(records, A.SOLAR_TODAY),
      },
      inverterState:      inverterStateRaw,
      inverterStateLabel: VEBUS_LABELS[inverterStateRaw] ?? 'Unknown',
      acLoad,
      sparkline: extractSparkline(statsJson, A.SOLAR_W),
    };

    return NextResponse.json({ data, ok: true });
  } catch (err: any) {
    console.error(`[VRM] ${siteId}:`, err.message);
    return NextResponse.json({ error: err.message, ok: false }, { status: 502 });
  }
}

function extractSparkline(statsJson: any, attrCode: number): number[] {
  if (!statsJson?.records) return [];
  const attr = statsJson.records[String(attrCode)];
  if (!attr?.avg) return [];
  // Return up to 6 values, replacing nulls with 0
  return (attr.avg as (number | null)[])
    .slice(-6)
    .map(v => (v == null ? 0 : Math.round(v)));
}
