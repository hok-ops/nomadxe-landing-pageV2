import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';

export async function assertVrmSiteAccess(siteId: string) {
  if (!/^\d+$/.test(siteId)) {
    return { ok: false as const, status: 400, error: 'Invalid site ID' };
  }

  const supabase = createClient();
  const adminClient = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false as const, status: 401, error: 'Unauthorized' };
  }

  const [{ data: assignment }, { data: profile }] = await Promise.all([
    adminClient
      .from('device_assignments')
      .select('id, vrm_devices!inner(vrm_site_id)')
      .eq('user_id', user.id)
      .eq('vrm_devices.vrm_site_id', siteId)
      .maybeSingle(),
    adminClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single(),
  ]);

  if (!assignment && profile?.role !== 'admin') {
    return { ok: false as const, status: 403, error: 'Forbidden' };
  }

  return {
    ok: true as const,
    userId: user.id,
    role: profile?.role ?? 'user',
  };
}

export async function assertTeltonikaRmsDeviceAccess(deviceId: string) {
  if (!/^\d+$/.test(deviceId)) {
    return { ok: false as const, status: 400, error: 'Invalid RMS device ID' };
  }

  const supabase = createClient();
  const adminClient = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false as const, status: 401, error: 'Unauthorized' };
  }

  const [{ data: assignment }, { data: profile }] = await Promise.all([
    adminClient
      .from('device_assignments')
      .select('id, vrm_devices!inner(teltonika_rms_device_id)')
      .eq('user_id', user.id)
      .eq('vrm_devices.teltonika_rms_device_id', deviceId)
      .maybeSingle(),
    adminClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single(),
  ]);

  if (!assignment && profile?.role !== 'admin') {
    return { ok: false as const, status: 403, error: 'Forbidden' };
  }

  return {
    ok: true as const,
    userId: user.id,
    role: profile?.role ?? 'user',
  };
}
