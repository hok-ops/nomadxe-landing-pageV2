'use server';

import { createAdminClient } from '@/utils/supabase/admin';
import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

// Verify privileges natively
async function verifyAdmin() {
  const supabase = createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error('Unauthorized');
  
  const { data, error: profileError } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profileError || data?.role !== 'admin') throw new Error('Forbidden');
}

export async function createClientAccount(formData: FormData) {
  await verifyAdmin();
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  
  const adminAuthClient = createAdminClient();
  const { data, error } = await adminAuthClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  });
  
  if (error) throw new Error(error.message);
  revalidatePath('/admin');
}

export async function registerDevice(formData: FormData) {
  await verifyAdmin();
  const vrm_site_id = formData.get('vrm_site_id') as string;
  const name = formData.get('name') as string;
  
  const supabase = createClient();
  const { error } = await supabase.from('vrm_devices').insert([{ vrm_site_id, name }]);
  if (error) throw new Error(error.message);
  revalidatePath('/admin');
}

export async function assignDevice(formData: FormData) {
  await verifyAdmin();
  const user_id = formData.get('user_id') as string;
  const device_id = formData.get('device_id') as string;
  
  const supabase = createClient();
  const { error } = await supabase.from('device_assignments').insert([{ user_id, device_id: Number(device_id) }]);
  if (error) throw new Error(error.message);
  revalidatePath('/admin');
}
