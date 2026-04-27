import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { redirect } from 'next/navigation';
import DashboardClient from './DashboardClient';
import { fetchVRMData, type VRMData } from '@/lib/vrm';

export const metadata = { title: 'Power Base Readings | NomadXE' };

async function fetchInitialVRMData(siteId: string): Promise<VRMData | null> {
  try {
    return await fetchVRMData(siteId);
  } catch {
    return null;
  }
}

/**
 * Concurrency-capped Promise.all.
 * Limits simultaneous upstream VRM fan-out to avoid thundering herd on SSR.
 * VRM's rate limit is generous but each fetchVRMData fires 3 sub-requests;
 * a 20-device fleet uncapped = 60 simultaneous upstream calls on every page load.
 */
async function pLimit<T>(
  tasks: (() => Promise<T>)[],
  limit: number
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let index = 0;

  async function worker() {
    while (index < tasks.length) {
      const i = index++;
      results[i] = await tasks[i]();
    }
  }

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, worker);
  await Promise.all(workers);
  return results;
}

export default async function DashboardPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const adminClient = createAdminClient();
  const { data: assignments } = await adminClient
    .from('device_assignments')
    .select('device_id, vrm_devices(id, vrm_site_id, name, display_name, teltonika_rms_device_id, router_access_url)')
    .eq('user_id', user.id);

  const rawDevices = (assignments ?? [])
    .map((a: any) => a.vrm_devices)
    .filter(Boolean)
    .map((d: any) => ({
      siteId:      String(d.vrm_site_id),
      name:        String(d.name),
      displayName: d.display_name ?? null,
      teltonikaRmsDeviceId: d.teltonika_rms_device_id ? String(d.teltonika_rms_device_id) : null,
      routerAccessUrl: d.router_access_url ? String(d.router_access_url) : null,
    }));

  // Deduplicate by siteId — a device may have multiple assignment rows
  // in the DB, which would cause duplicate React keys and broken rendering.
  const seenIds = new Set<string>();
  const devices = rawDevices.filter(d => {
    if (seenIds.has(d.siteId)) return false;
    seenIds.add(d.siteId);
    return true;
  });

  // Cap concurrent VRM fetches at 4 — each call fans out to 3 sub-requests;
  // uncapped this causes a thundering herd (20 devices = 60 simultaneous calls).
  const pairs = await pLimit(
    devices.map((d) => () => fetchInitialVRMData(d.siteId).then((data) => [d.siteId, data] as const)),
    4
  );
  const initialDataMap = Object.fromEntries(pairs);

  return <DashboardClient devices={devices} initialDataMap={initialDataMap} />;
}
