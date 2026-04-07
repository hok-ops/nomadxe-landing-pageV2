'use server';

import { createAdminClient } from '@/utils/supabase/admin';
import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

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
    const { error } = await adminAuthClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (error) throw new Error(error.message);
    revalidatePath('/admin');
    redirect('/admin?success=Client account created successfully');
  } catch (err: any) {
    if (err.digest) throw err;
    redirect(`/admin?error=${encodeURIComponent(err.message)}`);
  }
}

export async function registerDevice(formData: FormData) {
  try {
    await verifyAdmin();
    const vrm_site_id = formData.get('vrm_site_id') as string;
    const name = formData.get('name') as string;

    if (!vrm_site_id || !name) throw new Error('VRM ID and nickname are required');

    const adminClient = createAdminClient();
    const { error } = await adminClient.from('vrm_devices').insert([{ vrm_site_id, name }]);
    if (error) throw new Error(error.message);
    revalidatePath('/admin');
    redirect('/admin?success=Device registered successfully');
  } catch (err: any) {
    if (err.digest) throw err;
    redirect(`/admin?error=${encodeURIComponent(err.message)}`);
  }
}

export async function assignDevice(formData: FormData) {
  try {
    await verifyAdmin();
    const user_id = formData.get('user_id') as string;
    const device_id = formData.get('device_id') as string;

    if (!user_id || !device_id) throw new Error('User and device selection are required');

    const adminClient = createAdminClient();
    const { error } = await adminClient.from('device_assignments').insert([{ user_id, device_id: Number(device_id) }]);
    if (error) throw new Error(error.message);
    revalidatePath('/admin');
    redirect('/admin?success=Device assigned successfully');
  } catch (err: any) {
    if (err.digest) throw err;
    redirect(`/admin?error=${encodeURIComponent(err.message)}`);
  }
}

export async function deleteAssignment(formData: FormData) {
  try {
    await verifyAdmin();
    const id = formData.get('id') as string;
    if (!id) throw new Error('Assignment ID required');

    const adminClient = createAdminClient();
    const { error } = await adminClient.from('device_assignments').delete().eq('id', Number(id));
    if (error) throw new Error(error.message);
    revalidatePath('/admin');
    redirect('/admin?success=Device assignment removed');
  } catch (err: any) {
    if (err.digest) throw err;
    redirect(`/admin?error=${encodeURIComponent(err.message)}`);
  }
}

export async function updateUserRole(formData: FormData) {
  try {
    await verifyAdmin();
    const userId = formData.get('userId') as string;
    const role = formData.get('role') as string;

    if (!userId || !role) throw new Error('User ID and role required');

    const adminClient = createAdminClient();
    const { error } = await adminClient.from('profiles').update({ role }).eq('id', userId);
    if (error) throw new Error(error.message);
    revalidatePath('/admin');
    redirect(`/admin?success=Role updated to ${role}`);
  } catch (err: any) {
    if (err.digest) throw err;
    redirect(`/admin?error=${encodeURIComponent(err.message)}`);
  }
}

export async function inviteNewUser(formData: FormData) {
  try {
    await verifyAdmin();
    const email = formData.get('email') as string;
    const vrm_site_id = formData.get('vrm_site_id') as string;
    const device_name = (formData.get('device_name') as string) || 'Primary Trailer';

    if (!email) throw new Error('Email is required');

    const adminAuthClient = createAdminClient();
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const { data: inviteData, error: inviteError } = await adminAuthClient.auth.admin.inviteUserByEmail(email, {
     redirectTo: 'https://www.nomadxe.com/auth/confirm',
    });

    if (inviteError) throw new Error(inviteError.message);

    // If a device was provided, register it and assign it to the new user
    if (vrm_site_id && inviteData.user) {
      const adminClient = createAdminClient();

      // 1. Ensure device exists
      const { data: device, error: deviceError } = await adminClient
        .from('vrm_devices')
        .upsert([{ vrm_site_id, name: device_name }], { onConflict: 'vrm_site_id' })
        .select()
        .single();

      if (deviceError) console.error('Device sync error:', deviceError.message);

      // 2. Map assignment
      if (device) {
        await adminClient.from('device_assignments').insert([{
          user_id: inviteData.user.id,
          device_id: device.id,
        }]);
      }
    }

    revalidatePath('/admin');
    redirect(`/admin?success=Invitation sent to ${email}`);
  } catch (err: any) {
    if (err.digest) throw err;
    redirect(`/admin?error=${encodeURIComponent(err.message)}`);
  }
}

export async function resendInvite(formData: FormData) {
  try {
    await verifyAdmin();
    const email = formData.get('email') as string;
    if (!email) throw new Error('Email is required');

    const adminAuthClient = createAdminClient();
    
    // 🛑 RATE LIMIT BYPASS: Generate the link instead of emailing it
    const { data, error } = await adminAuthClient.auth.admin.generateLink({
      type: 'invite',
      email: email,
      options: {
        redirectTo: 'https://www.nomadxe.com/auth/confirm',
      }
    });

    if (error) throw new Error(error.message);

    // 🔥 LOG THE GOLDEN TICKET TO VERCEL 🔥
    console.log("==================================================");
    console.log("RAW INVITE URL:", data.properties?.action_link);
    console.log("==================================================");

    revalidatePath('/admin');
    redirect(`/admin?success=Link generated! Check Vercel logs.`);
  } catch (err: any) {
    if (err.digest) throw err;
    redirect(`/admin?error=${encodeURIComponent(err.message)}`);
  }
}

export async function updateUserStatus(formData: FormData) {
  try {
    await verifyAdmin();
    const userId = formData.get('userId') as string;
    const status = formData.get('status') as string;

    if (!userId || !status) throw new Error('User ID and status required');
    if (!['active', 'suspended'].includes(status)) throw new Error('Invalid status value');

    const adminClient = createAdminClient();
    const { error } = await adminClient
      .from('profiles')
      .update({ status, is_active: status === 'active' })
      .eq('id', userId);

    if (error) throw new Error(error.message);
    revalidatePath('/admin');
    redirect(`/admin?success=User ${status === 'suspended' ? 'suspended' : 'reactivated'} successfully`);
  } catch (err: any) {
    if (err.digest) throw err;
    redirect(`/admin?error=${encodeURIComponent(err.message)}`);
  }
}

export async function deleteUser(formData: FormData) {
  try {
    await verifyAdmin();
    const userId = formData.get('userId') as string;
    if (!userId) throw new Error('User ID required');

    const adminClient = createAdminClient();
    const { error } = await adminClient.auth.admin.deleteUser(userId);
    if (error) throw new Error(error.message);
    revalidatePath('/admin');
    redirect('/admin?success=User deleted successfully');
  } catch (err: any) {
    if (err.digest) throw err;
    redirect(`/admin?error=${encodeURIComponent(err.message)}`);
  }
}
