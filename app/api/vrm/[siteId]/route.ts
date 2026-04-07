import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';

// ── VRM attribute ID constants ─────────────────────────────────────────────────
// Verified against live debug response from installation 810801.
// These IDs are standard Venus OS / Cerbo GX attribute codes.
const A = {
  // Battery Monitor (SmartShunt/BMV)
  BATTERY_SOC:   51,   // /Soc  (%)
  BATTERY_V:     47,   // /Dc/0/Voltage  (V)
  BATTERY_A:     49,   // /Dc/0/Current  (A)  positive = charging

  // System overview — more reliable for power totals across devices
  BATTERY_W:     243,  // /Dc/Battery/Power  (W)  positive = charging
  BATTERY_STATE: 215,  // /Dc/Battery/State  0=Idle 1=Charging 2=Discharging

  // Solar Charger (MPPT)
  SOLAR_W:       442,  // /Yield/Power  (W)  — PV output power
  SOLAR_V:       86,   // /Pv/V  (V)         — panel string voltage
  SOLAR_TODAY:   94,   // /History/Daily/0/Yield  (kWh)
  MPPT_STATE:    85,   // /State  3=Bulk 4=Absorption 5=Float 6=Storage

  // DC loads on the bus (System overview)
  DC_SYSTEM:     140,  // /Dc/System/Power  (W)
} as const;

// MPPT SmartSolar charge state enum
const MPPT_LABELS: Record<number, string> = {
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
  lastSeen: number;          // unix seconds — heartbeat
  battery: {
    soc: number;             // %
    voltage: number;         // V
    current: number;         // A — positive = charging
    power: number;           // W — positive = charging
    state: number;           // 0=Idle 1=Charging 2=Discharging
  };
  solar: {
    power: number;           // W  (PV output)
    voltage: number;         // V  (panel string voltage)
    yieldToday: number;      // kWh
    mpptState: number;       // charge state enum
    mpptStateLabel: string;
  };
  dcLoad: number;            // W — DC bus loads
  sparkline: number[];       // 6 hourly solar power readings (W)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`VRM ${res.status}: ${path}`);
  return res.json();
}

function deriveDCLoad(solarW: number, batteryW: number): number {
  // Energy balance: Solar = Battery Charge + DC Loads
  // → DC Loads = Solar − Battery Net (positive W = charging)
  // When battery is discharging (batteryW < 0), loads = solar + |discharge|
  return Math.max(0, Math.round(solarW - batteryW));
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: { siteId: string } }
) {
  const { siteId } = params;

  const supabase    = createClient();
  const adminClient = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Verify caller owns this device OR is admin
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
    const now        = Math.floor(Date.now() / 1000);
    const sixHrsAgo  = now - 6 * 3600;

    const [diagJson, statsJson] = await Promise.all([
      fetchVRM(`/installations/${siteId}/diagnostics`),
      fetchVRM(
        `/installations/${siteId}/stats` +
        `?type=custom&attributeCodes[]=${A.SOLAR_W}` +  // 442 = PV power
        `&interval=hours&start=${sixHrsAgo}&end=${now}`
      ).catch(() => null),
    ]);

    const records: any[] = diagJson?.records ?? [];

    const solarW   = pick(records, A.SOLAR_W);
    const batteryW = pick(records, A.BATTERY_W);

    // DC System attr 140: trust the value (even 0) when the attribute is present.
    // Only fall back to the energy-balance formula when attr 140 is absent entirely.
    const dcLoad = hasAttr(records, A.DC_SYSTEM)
      ? pick(records, A.DC_SYSTEM)
      : deriveDCLoad(solarW, batteryW);

    const mpptStateRaw = pick(records, A.MPPT_STATE);

    const data: VRMData = {
      siteId,
      lastSeen: latestTimestamp(records) || now,
      battery: {
        soc:     pick(records, A.BATTERY_SOC),
        voltage: pick(records, A.BATTERY_V),
        current: pick(records, A.BATTERY_A),
        power:   batteryW,
        state:   pick(records, A.BATTERY_STATE), // 0=Idle 1=Charging 2=Discharging
      },
      solar: {
        power:          solarW,
        voltage:        pick(records, A.SOLAR_V),
        yieldToday:     pick(records, A.SOLAR_TODAY),
        mpptState:      mpptStateRaw,
        mpptStateLabel: MPPT_LABELS[mpptStateRaw] ?? 'Unknown',
      },
      dcLoad,
      sparkline: extractSparkline(statsJson, A.SOLAR_W), // attr 442 for stats API
    };

    return NextResponse.json({ data, ok: true });
  } catch (err: any) {
    console.error(`[VRM] ${siteId}:`, err.message);
    return NextResponse.json({ error: err.message, ok: false }, { status: 502 });
  }
}

function extractSparkline(statsJson: any, attrCode: number): number[] {
  const attr = statsJson?.records?.[String(attrCode)];
  if (!attr?.avg) return [];
  return (attr.avg as (number | null)[]).slice(-6).map(v => v ?? 0);
}
