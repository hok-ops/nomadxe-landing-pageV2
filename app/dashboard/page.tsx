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
