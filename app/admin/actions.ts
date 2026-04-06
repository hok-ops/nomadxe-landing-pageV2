'use server';

import { createAdminClient } from '@/utils/supabase/admin';
import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

// Verify privileges — use adminClient for profile lookup to avoid RLS recursion
async function verifyAdmin() {
  const supabase = createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error('Unauthorized');

  const adminClient = createAdminClient();
  const { data, error: profileError } = await adminClient.from('profiles').select('role').eq('id', user.id).single();
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

export async function deleteAssignment(formData: FormData) {
  try {
    await verifyAdmin();
    const id = formData.get('id') as string;
    if (!id) throw new Error('Assignment ID required');
    
    const supabase = createClient();
    const { error } = await supabase.from('device_assignments').delete().eq('id', Number(id));
    if (error) throw new Error(error.message);
    revalidatePath('/admin');
  } catch (err: any) {
    console.error('Action error:', err.message);
    throw err;
  }
}

export async function updateUserRole(formData: FormData) {
  try {
    await verifyAdmin();
    const userId = formData.get('userId') as string;
    const role = formData.get('role') as string;
    
    if (!userId || !role) throw new Error('User ID and role required');
    
    const supabase = createClient();
    const { error } = await supabase.from('profiles').update({ role }).eq('id', userId);
    if (error) throw new Error(error.message);
    revalidatePath('/admin');
  } catch (err: any) {
    console.error('Action error:', err.message);
    throw err;
  }
}

export async function inviteNewUser(formData: FormData) {
  try {
    await verifyAdmin();
    const email = formData.get('email') as string;
    const vrm_site_id = formData.get('vrm_site_id') as string;
    const device_name = formData.get('device_name') as string || 'Primary Trailer';

    if (!email) throw new Error('Email is required');

    const adminAuthClient = createAdminClient();
    const { data: inviteData, error: inviteError } = await adminAuthClient.auth.admin.inviteUserByEmail(email, {
       redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || ''}/activate-account`
    });

    if (inviteError) throw new Error(inviteError.message);

    // If a device was provided, register it and assign it to the new user
    if (vrm_site_id && inviteData.user) {
      const supabase = createClient();
      
      // 1. Ensure device exists
      const { data: device, error: deviceError } = await supabase
        .from('vrm_devices')
        .upsert([{ vrm_site_id, name: device_name }], { onConflict: 'vrm_site_id' })
        .select()
        .single();
      
      if (deviceError) console.error('Device sync error:', deviceError.message);

      // 2. Map assignment
      if (device) {
        await supabase.from('device_assignments').insert([{ 
          user_id: inviteData.user.id, 
          device_id: device.id 
        }]);
      }
    }

    revalidatePath('/admin');
  } catch (err: any) {
    console.error('Invitation error:', err.message);
    throw err;
  }
}


