'use server';

import { createAdminClient } from '@/utils/supabase/admin';
import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';

// ── Helpers ───────────────────────────────────────────────────────────────────

function getSiteUrl(): string {
  // SITE_URL is a plain server-side env var — always read at runtime, never
  // inlined at build time. Prefer this over NEXT_PUBLIC_SITE_URL for server actions.
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, '');
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  // Last resort: derive from the request Host header
  const host = headers().get('x-forwarded-host') ?? headers().get('host') ?? 'localhost:3000';
  const proto = host.includes('localhost') ? 'http' : 'https';
  return `${proto}://${host}`;
}

async function generateToken(): Promise<string> {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function createAuthToken(
  userId: string,
  type: 'invite' | 'recovery',
  expiryHours: number
): Promise<string> {
  const adminClient = createAdminClient();
  const token = await generateToken();
  const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000).toISOString();

  // Invalidate any prior unused tokens of the same type for this user
  await adminClient
    .from('auth_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('type', type)
    .is('used_at', null);

  const { error } = await adminClient
    .from('auth_tokens')
    .insert([{ token, user_id: userId, type, expires_at: expiresAt }]);

  if (error) throw new Error(`Failed to create auth token: ${error.message}`);
  return token;
}

// ── Auth guard ────────────────────────────────────────────────────────────────

async function verifyAdmin() {
  const supabase = createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error('Unauthorized');

  const adminClient = createAdminClient();
  const { data, error: profileError } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  if (profileError || data?.role !== 'admin') throw new Error('Forbidden');
}

// ── Actions ───────────────────────────────────────────────────────────────────

export async function inviteNewUser(formData: FormData) {
  try {
    await verifyAdmin();

    const email = formData.get('email') as string;
    const vrm_site_id = formData.get('vrm_site_id') as string | null;
    const device_name = formData.get('device_name') as string | null;

    if (!email) throw new Error('Email is required');

    const adminClient = createAdminClient();
    const siteUrl = getSiteUrl();

    // Create the auth user and send the invite email
    const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${siteUrl}/auth/confirm`,
    });

    if (inviteError) throw new Error(inviteError.message);
    if (!inviteData.user) throw new Error('User creation failed');

    // Create a single-use invite token (48h) for the setup page
    await createAuthToken(inviteData.user.id, 'invite', 48);

    // If a device was provided, register it and assign it to the new user
    if (vrm_site_id && device_name && inviteData.user) {
      const { data: device, error: deviceError } = await adminClient
        .from('vrm_devices')
        .upsert([{ vrm_site_id, name: device_name }], { onConflict: 'vrm_site_id' })
        .select()
        .single();

      if (deviceError) console.error('Device sync error:', deviceError.message);

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

    const userId = formData.get('userId') as string;
    const email = formData.get('email') as string;

    if (!userId || !email) throw new Error('User ID and email are required');

    const adminClient = createAdminClient();
    const siteUrl = getSiteUrl();

    // Re-send the Supabase invite email
    const { error } = await adminClient.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${siteUrl}/auth/confirm`,
    });

    if (error) throw new Error(error.message);

    // Refresh the invite token
    await createAuthToken(userId, 'invite', 48);

    revalidatePath('/admin');
    redirect(`/admin?success=Invitation resent to ${email}`);
  } catch (err: any) {
    if (err.digest) throw err;
    redirect(`/admin?error=${encodeURIComponent(err.message)}`);
  }
}

export async function sendPasswordReset(formData: FormData) {
  try {
    await verifyAdmin();

    const userId = formData.get('userId') as string;
    const email = formData.get('email') as string;

    if (!userId || !email) throw new Error('User ID and email are required');

    const supabase = createClient();
    const siteUrl = getSiteUrl();

    // Generate a recovery token (24h)
    await createAuthToken(userId, 'recovery', 24);

    // resetPasswordForEmail must use the anon/user client, not service_role.
    // redirectTo → /auth/callback (client page) handles both PKCE ?code= and
    // implicit flow #access_token= hash fragments.
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${siteUrl}/auth/callback`,
    });

    if (error) console.error('Reset email error:', error.message);

    revalidatePath('/admin');
    redirect(`/admin?success=Password reset sent to ${email}`);
  } catch (err: any) {
    if (err.digest) throw err;
    redirect(`/admin?error=${encodeURIComponent(err.message)}`);
  }
}

export async function requestPasswordReset(formData: FormData) {
  try {
    const email = formData.get('email') as string;
    if (!email) throw new Error('Email is required');

    const adminClient = createAdminClient();
    const siteUrl = getSiteUrl();

    // Look up user by email (don't reveal if they exist)
    const { data: users } = await adminClient.auth.admin.listUsers();
    const user = users?.users?.find(u => u.email === email);

    if (user) {
      await createAuthToken(user.id, 'recovery', 24);
      // Must use the SSR client (flowType: 'pkce') so the email link arrives
      // as ?code= (query param, readable server-side) not #access_token= (hash
      // fragment, invisible to Route Handlers).
      const supabase = createClient();
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${siteUrl}/auth/callback`,
      });
    }

    // Pass email through so the OTP entry form can pre-fill it.
    // Not a security concern — user just typed it.
    redirect(`/forgot-password?sent=1&email=${encodeURIComponent(email)}`);
  } catch (err: any) {
    if (err.digest) throw err;
    redirect(`/forgot-password?error=${encodeURIComponent(err.message)}`);
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
    const { error } = await adminClient
      .from('device_assignments')
      .insert([{ user_id, device_id: Number(device_id) }]);
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
    const { error } = await adminClient
      .from('device_assignments')
      .delete()
      .eq('id', Number(id));
    if (error) throw new Error(error.message);
    revalidatePath('/admin');
    redirect('/admin?success=Device assignment removed');
  } catch (err: any) {
    if (err.digest) throw err;
    redirect(`/admin?error=${encodeURIComponent(err.message)}`);
  }
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
