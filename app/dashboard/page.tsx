import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import NomadXECoreView, { type VRMData } from '@/components/dashboard/NomadXECoreView';

export const metadata = { title: 'Core Diagnostics | NomadXE' };

// Fetch VRM data server-side (keeps VICTRON_ADMIN_TOKEN off the client)
async function fetchInitialVRMData(siteId: string): Promise<VRMData | null> {
  const token = process.env.VICTRON_ADMIN_TOKEN;
  if (!token) return null;

  try {
    const A = { BATTERY_SOC: 282, BATTERY_V: 259, BATTERY_A: 261, BATTERY_W: 262,
                 SOLAR_W: 789, SOLAR_V: 776, SOLAR_TODAY: 784, AC_LOAD: 8, AC_OUTPUT: 9, VEBUS_STATE: 64 };

    const VEBUS_LABELS: Record<number, string> = {
      0: 'Off', 1: 'Low Power', 2: 'Fault', 3: 'Bulk', 4: 'Absorption',
      5: 'Float', 6: 'Storage', 7: 'Equalize', 8: 'Passthru',
      9: 'Inverting', 10: 'Power Assist', 11: 'Power Supply',
    };

    const headers = { 'X-Authorization': `Bearer ${token}` };
    const now = Math.floor(Date.now() / 1000);
    const sixHoursAgo = now - 6 * 3600;

    const [diagRes, statsRes] = await Promise.all([
      fetch(`https://vrmapi.victronenergy.com/v2/installations/${siteId}/diagnostics`, { headers, cache: 'no-store' }),
      fetch(`https://vrmapi.victronenergy.com/v2/installations/${siteId}/stats?type=custom&attributeCodes[]=${A.SOLAR_W}&interval=hours&start=${sixHoursAgo}&end=${now}`, { headers, cache: 'no-store' })
        .catch(() => null),
    ]);

    if (!diagRes.ok) return null;
    const diagJson = await diagRes.json();
    const statsJson = statsRes?.ok ? await statsRes.json() : null;

    const records: any[] = diagJson?.records ?? [];
    const pick = (id: number) => Number(records.find((r: any) => r.idDataAttribute === id)?.rawValue ?? 0);
    const lastSeen = records.reduce((max: number, r: any) => Math.max(max, Number(r.timestamp ?? 0)), 0) || now;

    const inverterStateRaw = pick(A.VEBUS_STATE);
    const sparklineRaw = statsJson?.records?.[String(A.SOLAR_W)]?.avg;
    const sparkline = Array.isArray(sparklineRaw)
      ? (sparklineRaw as (number | null)[]).slice(-6).map(v => v ?? 0)
      : [];

    return {
      siteId,
      lastSeen,
      battery: { soc: pick(A.BATTERY_SOC), voltage: pick(A.BATTERY_V), current: pick(A.BATTERY_A), power: pick(A.BATTERY_W) },
      solar:   { power: pick(A.SOLAR_W), voltage: pick(A.SOLAR_V), yieldToday: pick(A.SOLAR_TODAY) },
      inverterState: inverterStateRaw,
      inverterStateLabel: VEBUS_LABELS[inverterStateRaw] ?? 'Unknown',
      acLoad: pick(A.AC_LOAD) || pick(A.AC_OUTPUT),
      sparkline,
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
    .select('device_id, vrm_devices(id, vrm_site_id, name)')
    .eq('user_id', user.id);

  type Device = { siteId: string; name: string };
  const devices: Device[] = (assignments ?? [])
    .map((a: any) => a.vrm_devices)
    .filter(Boolean)
    .map((d: any) => ({ siteId: String(d.vrm_site_id), name: String(d.name) }));

  // Fetch initial VRM data for all assigned devices in parallel
  const initialDataMap = Object.fromEntries(
    await Promise.all(
      devices.map(async (d) => [d.siteId, await fetchInitialVRMData(d.siteId)])
    )
  );

  return (
    <div className="min-h-screen bg-[#080c14] pt-28 pb-24 relative">
      {/* Grid texture */}
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.022]"
        style={{ backgroundImage: 'linear-gradient(#3b82f6 1px,transparent 1px),linear-gradient(to right,#3b82f6 1px,transparent 1px)', backgroundSize: '48px 48px' }}
      />
      {/* Top accent bar */}
      <div className="fixed top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#1e40af] via-[#3b82f6] to-[#1e40af] z-[100]" />

      <div className="relative z-10 max-w-[1400px] mx-auto px-6 lg:px-12">

        {/* Header */}
        <header className="flex items-center justify-between mb-10 pb-7 border-b border-[#1e3a5f]/60">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <span className="w-2 h-2 rounded-full bg-[#3b82f6] shadow-[0_0_8px_#3b82f6]" />
              <span className="text-[10px] font-bold text-[#3b82f6]/60 uppercase tracking-[0.5em] font-mono">NomadXE</span>
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">Core Diagnostics</h1>
            <p className="text-xs text-[#93c5fd]/40 mt-1 font-mono uppercase tracking-widest">
              Power system health · {devices.length} unit{devices.length !== 1 ? 's' : ''} assigned
            </p>
          </div>
          <Link
            href="/"
            className="text-[10px] font-bold font-mono border border-[#1e3a5f] text-[#93c5fd]/50 hover:text-white hover:border-[#3b82f6]/50 px-5 py-2.5 rounded-lg transition-all uppercase tracking-widest"
          >
            ← Disconnect
          </Link>
        </header>

        {/* Device grid */}
        {devices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#1e3a5f]/30 border border-[#1e3a5f] flex items-center justify-center mb-6">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.5">
                <rect x="2" y="7" width="20" height="14" rx="2" />
                <path d="M16 7V5a2 2 0 0 0-4 0v2" />
              </svg>
            </div>
            <h2 className="text-white font-bold text-lg mb-2">No Devices Assigned</h2>
            <p className="text-[#93c5fd]/40 text-sm max-w-sm">
              Your account has no Victron units assigned yet. Contact your administrator to link your trailer.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {devices.map(device => (
              <NomadXECoreView
                key={device.siteId}
                device={device}
                initialData={initialDataMap[device.siteId] ?? null}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
