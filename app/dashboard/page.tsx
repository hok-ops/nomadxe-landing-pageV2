import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { redirect } from 'next/navigation';
import DashboardClient from './DashboardClient';
import type { VRMData } from '@/components/dashboard/NomadXECoreView';

export const metadata = { title: 'Power Base Readings | NomadXE' };

async function fetchInitialVRMData(siteId: string): Promise<VRMData | null> {
  const token = process.env.VICTRON_ADMIN_TOKEN;
  if (!token) return null;

  try {
    const A = {
      BATTERY_SOC: 51, BATTERY_V: 47, BATTERY_A: 49, BATTERY_W: 243,
      BATTERY_STATE: 215,
      SOLAR_W: 442, SOLAR_V: 86, SOLAR_TODAY: 94, MPPT_STATE: 85,
      DC_SYSTEM: 140,
    };

    const MPPT_LABELS: Record<number, string> = {
      0: 'Off', 2: 'Fault', 3: 'Bulk', 4: 'Absorption',
      5: 'Float', 6: 'Storage', 7: 'Equalize', 245: 'Off', 252: 'Ext. Control',
    };

    const headers = { 'X-Authorization': `Token ${token}` };
    const now = Math.floor(Date.now() / 1000);
    const sixHoursAgo = now - 6 * 3600;

    const [diagRes, statsRes] = await Promise.all([
      fetch(`https://vrmapi.victronenergy.com/v2/installations/${siteId}/diagnostics`, { headers, cache: 'no-store' }),
      fetch(
        `https://vrmapi.victronenergy.com/v2/installations/${siteId}/stats` +
        `?type=custom&attributeCodes[]=${A.SOLAR_W}&attributeCodes[]=${A.BATTERY_SOC}` +
        `&interval=hours&start=${sixHoursAgo}&end=${now}`,
        { headers, cache: 'no-store' }
      ).catch(() => null),
    ]);

    if (!diagRes.ok) return null;
    const diagJson = await diagRes.json();
    const statsJson = statsRes?.ok ? await statsRes.json() : null;

    const records: any[] = diagJson?.records ?? [];
    const pick = (id: number) => Number(records.find((r: any) => r.idDataAttribute === id)?.rawValue ?? 0);
    const lastSeen = records.reduce((max: number, r: any) => Math.max(max, Number(r.timestamp ?? 0)), 0);

    const solarW   = pick(A.SOLAR_W);
    const batteryW = pick(A.BATTERY_W);
    const dcLoad   = records.some((r: any) => r.idDataAttribute === A.DC_SYSTEM)
      ? pick(A.DC_SYSTEM)
      : Math.max(0, Math.round(solarW - batteryW));
    const mpptRaw = pick(A.MPPT_STATE);

    // extractSpark handles both VRM response shapes (object-keyed or array)
    const extractSpark = (json: any, code: number): number[] => {
      if (!json) return [];
      const recs = json.records;
      if (!recs) return [];
      const k = String(code);
      if (typeof recs === 'object' && !Array.isArray(recs)) {
        const attr = recs[k];
        const arr = attr?.avg ?? attr?.data;
        if (Array.isArray(arr)) return (arr as (number|null)[]).slice(-6).map(v => v ?? 0);
      }
      if (Array.isArray(recs)) {
        const entry = recs.find((r: any) => r[k] !== undefined);
        if (entry) {
          const stats = entry[k]?.stats ?? entry[k]?.avg;
          if (Array.isArray(stats))
            return stats.slice(-6).map((row: any) => Array.isArray(row) ? (row[1] ?? 0) : (row ?? 0));
        }
      }
      return [];
    };
    const sparkline        = extractSpark(statsJson, A.SOLAR_W);
    const batterySparkline = extractSpark(statsJson, A.BATTERY_SOC);

    return {
      siteId,
      lastSeen,
      battery: {
        soc: pick(A.BATTERY_SOC), voltage: pick(A.BATTERY_V),
        current: pick(A.BATTERY_A), power: batteryW, state: pick(A.BATTERY_STATE),
      },
      solar: {
        power: solarW, voltage: pick(A.SOLAR_V), yieldToday: pick(A.SOLAR_TODAY),
        mpptState: mpptRaw, mpptStateLabel: MPPT_LABELS[mpptRaw] ?? 'Unknown',
      },
      dcLoad,
      sparkline,
      batterySparkline,
    };
  } catch {
    return null;
  }
}

export default async function DashboardPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const adminClient = createAdminClient();
  const { data: assignments } = await adminClient
    .from('device_assignments')
    .select('device_id, vrm_devices(id, vrm_site_id, name, display_name)')
    .eq('user_id', user.id);

  const rawDevices = (assignments ?? [])
    .map((a: any) => a.vrm_devices)
    .filter(Boolean)
    .map((d: any) => ({
      siteId:      String(d.vrm_site_id),
      name:        String(d.name),
      displayName: d.display_name ?? null,
    }));

  // Deduplicate by siteId — a device may have multiple assignment rows
  // in the DB, which would cause duplicate React keys and broken rendering.
  const seenIds = new Set<string>();
  const devices = rawDevices.filter(d => {
    if (seenIds.has(d.siteId)) return false;
    seenIds.add(d.siteId);
    return true;
  });

  const initialDataMap = Object.fromEntries(
    await Promise.all(
      devices.map(async (d) => [d.siteId, await fetchInitialVRMData(d.siteId)])
    )
  );

  return <DashboardClient devices={devices} initialDataMap={initialDataMap} />;
}
