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
  try {
    await verifyAdmin();
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    
    if (!email || !password) throw new Error('Email and password required');
    
    const adminAuthClient = createAdminClient();
    const { data, error } = await adminAuthClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });
    
    if (error) throw new Error(error.message);
    revalidatePath('/admin');
  } catch (err: any) {
    console.error('Action error:', err.message);
    throw err;
  }
}

export async function registerDevice(formData: FormData) {
  try {
    await verifyAdmin();
    const vrm_site_id = formData.get('vrm_site_id') as string;
    const name = formData.get('name') as string;
    
    if (!vrm_site_id || !name) throw new Error('VRM ID and nickname are required');
    
    const supabase = createClient();
    const { error } = await supabase.from('vrm_devices').insert([{ vrm_site_id, name }]);
    if (error) throw new Error(error.message);
    revalidatePath('/admin');
  } catch (err: any) {
    console.error('Action error:', err.message);
    throw err;
  }
}

export async function assignDevice(formData: FormData) {
  try {
    await verifyAdmin();
    const user_id = formData.get('user_id') as string;
    const device_id = formData.get('device_id') as string;
    
    if (!user_id || !device_id) throw new Error('User and device selection are required');
    
    const supabase = createClient();
    const { error } = await supabase.from('device_assignments').insert([{ user_id, device_id: Number(device_id) }]);
    if (error) throw new Error(error.message);
    revalidatePath('/admin');
  } catch (err: any) {
    console.error('Action error:', err.message);
    throw err;
  }
}
