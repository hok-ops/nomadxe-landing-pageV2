import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';

// ── VRM attribute ID constants ─────────────────────────────────────────────────
// NomadXE trailers are DC-only: MPPT solar charger + SmartShunt/BMV + DC loads.
// No inverter, no AC, no grid, no generator, no tank, no temperature.
const A = {
  BATTERY_SOC:  282,  // Battery Monitor State of charge (%)
  BATTERY_V:    259,  // Battery Monitor Voltage (V)
  BATTERY_A:    261,  // Battery Monitor Current (A) — positive = charging
  BATTERY_W:    262,  // Battery Monitor Power (W)   — positive = charging
  SOLAR_W:      789,  // Solar Charger PV power (W)
  SOLAR_V:      776,  // Solar Charger PV voltage (V)
  SOLAR_A:      777,  // Solar Charger PV current (A)
  SOLAR_TODAY:  784,  // Solar Charger Yield today (kWh)
  MPPT_STATE:   775,  // Solar Charger state enum (Bulk/Absorption/Float/Off)
  DC_SYSTEM:    190,  // DC System power — loads on DC bus (W), if available
} as const;

// MPPT solar charger state enum (Venus OS / SmartSolar)
const MPPT_LABELS: Record<number, string> = {
  0: 'Off',
  2: 'Fault',
  3: 'Bulk',
  4: 'Absorption',
  5: 'Float',
  6: 'Storage',
  7: 'Equalize',
  11: 'Power Supply',
  245: 'Starting Up',
  247: 'Auto Equalize',
  252: 'External Control',
};

export interface VRMData {
  siteId: string;
  lastSeen: number;          // unix seconds — heartbeat
  battery: {
    soc: number;             // %
    voltage: number;         // V
    current: number;         // A — positive = charging
    power: number;           // W — positive = charging
  };
  solar: {
    power: number;           // W
    voltage: number;         // V (panel voltage)
    current: number;         // A
    yieldToday: number;      // kWh
    mpptState: number;       // state enum
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
        `?type=custom&attributeCodes[]=${A.SOLAR_W}` +
        `&interval=hours&start=${sixHrsAgo}&end=${now}`
      ).catch(() => null),
    ]);

    const records: any[] = diagJson?.records ?? [];

    const solarW   = pick(records, A.SOLAR_W);
    const batteryW = pick(records, A.BATTERY_W);

    // Use direct DC System attribute if available; derive otherwise
    const directDC  = pick(records, A.DC_SYSTEM);
    const dcLoad    = directDC > 0 ? directDC : deriveDCLoad(solarW, batteryW);

    const mpptStateRaw = pick(records, A.MPPT_STATE);

    const data: VRMData = {
      siteId,
      lastSeen: latestTimestamp(records) || now,
      battery: {
        soc:     pick(records, A.BATTERY_SOC),
        voltage: pick(records, A.BATTERY_V),
        current: pick(records, A.BATTERY_A),
        power:   batteryW,
      },
      solar: {
        power:          solarW,
        voltage:        pick(records, A.SOLAR_V),
        current:        pick(records, A.SOLAR_A),
        yieldToday:     pick(records, A.SOLAR_TODAY),
        mpptState:      mpptStateRaw,
        mpptStateLabel: MPPT_LABELS[mpptStateRaw] ?? 'Unknown',
      },
      dcLoad,
      sparkline: extractSparkline(statsJson, A.SOLAR_W),
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
