'use server';

import { createAdminClient } from '@/utils/supabase/admin';
import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

// Safe error codes for redirect URLs â€” never put raw error messages in the URL.
// Raw strings can expose DB constraint names, table names, user emails, and
// internal Supabase error details in browser history and server access logs.
const ERROR_CODES: Record<string, string> = {
  'Unauthorized': 'unauthorized',
  'Forbidden': 'forbidden',
  'Email is required': 'email_required',
  'User ID and email are required': 'missing_fields',
  'User ID and role required': 'missing_fields',
  'User ID and status required': 'missing_fields',
  'User ID required': 'missing_fields',
  'VRM ID and nickname are required': 'missing_fields',
  'User and device selection are required': 'missing_fields',
  'Assignment ID required': 'missing_fields',
  'Email and password required': 'missing_fields',
  'Password must be at least 12 characters': 'password_too_short',
  'Invalid device ID': 'invalid_input',
  'Invalid assignment ID': 'invalid_input',
  'Managed device name, target trailer, and IP address are required': 'missing_fields',
  'Invalid managed network device ID': 'invalid_input',
  'Invalid discovered network device ID': 'invalid_input',
  'Free-plan maintenance unavailable': 'maintenance_unavailable',
};

function toErrorCode(message: string): string {
  return ERROR_CODES[message] ?? 'server_error';
}

// â”€â”€ Constants â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const VALID_ROLES   = new Set(['admin', 'user']);
const VALID_STATUSES = new Set(['active', 'suspended']);

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function getSiteUrl(): string {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, '');
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  console.error(
    '[SECURITY] getSiteUrl: neither SITE_URL nor NEXT_PUBLIC_SITE_URL is set. ' +
    'Invite/reset emails will use a hardcoded fallback. Set this env var in Vercel immediately.'
  );
  return process.env.NODE_ENV === 'development'
    ? 'http://localhost:3000'
    : 'https://www.nomadxe.com';
}

async function generateToken(): Promise<string> {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Atomically rotate an auth token for a user.
 * Uses the rotate_auth_token Postgres RPC (migration 009) which runs the
 * invalidate + insert in a single implicit transaction â€” eliminates the TOCTOU
 * race present in the prior two-step UPDATE then INSERT pattern.
 */
async function createAuthToken(
  userId: string,
  type: 'invite' | 'recovery',
  expiryHours: number
): Promise<string> {
  const adminClient = createAdminClient();
  const token      = await generateToken();
  const expiresAt  = new Date(Date.now() + expiryHours * 60 * 60 * 1000).toISOString();

  const { error } = await adminClient.rpc('rotate_auth_token', {
    p_user_id:    userId,
    p_type:       type,
    p_token:      token,
    p_expires_at: expiresAt,
  });

  if (error) throw new Error(`Failed to create auth token: ${error.message}`);
  return token;
}

// â”€â”€ Auth guard â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€ Actions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function inviteNewUser(formData: FormData) {
  try {
    await verifyAdmin();

    const email      = formData.get('email') as string;
    const vrm_site_id = formData.get('vrm_site_id') as string | null;
    const device_name = formData.get('device_name') as string | null;

    if (!email) throw new Error('Email is required');

    const adminClient = createAdminClient();
    const siteUrl     = getSiteUrl();

    // Send the Supabase invite email and create the custom app token against
    // the returned user id. Do not call generateLink first; it can pre-create
    // the same user and make inviteUserByEmail fail as an already-registered
    // email.
    const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
      email,
      { redirectTo: `${siteUrl}/auth/confirm` }
    );
    if (inviteError) throw new Error(inviteError.message);
    if (!inviteData.user) throw new Error('Invite user data missing');

    const userId = inviteData.user.id;
    await createAuthToken(userId, 'invite', 48);

    // Optionally register and assign a VRM device
    if (vrm_site_id && device_name && userId) {
      const { data: device, error: deviceError } = await adminClient
        .from('vrm_devices')
        .upsert([{ vrm_site_id, name: device_name }], { onConflict: 'vrm_site_id' })
        .select()
        .single();

      if (deviceError) {
        console.error('[inviteNewUser] device sync error:', deviceError.message);
      } else if (device) {
        await adminClient.from('device_assignments').insert([{
          user_id: userId,
          device_id: device.id,
        }]);
      }
    }

    revalidatePath('/admin');
    // Do not include email in URL â€” visible in browser history and server logs.
    redirect('/admin?event=user_invited');
  } catch (err: any) {
    if (err.digest) throw err;
    redirect(`/admin?event=error&code=${toErrorCode(err.message)}`);
  }
}

export async function resendInvite(formData: FormData) {
  try {
    await verifyAdmin();

    const userId = formData.get('userId') as string;
    const email  = formData.get('email') as string;

    if (!userId || !email) throw new Error('User ID and email are required');

    const adminClient = createAdminClient();
    const siteUrl     = getSiteUrl();

    // Create fresh invite token (atomic RPC)
    await createAuthToken(userId, 'invite', 48);

    const { error } = await adminClient.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${siteUrl}/auth/confirm`,
    });
    if (error) throw new Error(error.message);

    revalidatePath('/admin');
    redirect('/admin?event=invite_resent');
  } catch (err: any) {
    if (err.digest) throw err;
    redirect(`/admin?event=error&code=${toErrorCode(err.message)}`);
  }
}

export async function sendPasswordReset(formData: FormData) {
  try {
    await verifyAdmin();

    const userId = formData.get('userId') as string;
    const email  = formData.get('email') as string;

    if (!userId || !email) throw new Error('User ID and email are required');

    const siteUrl = getSiteUrl();

    // Create recovery token (atomic RPC)
    await createAuthToken(userId, 'recovery', 24);

    const res = await fetch(`${siteUrl}/api/auth/send-reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      console.error('[sendPasswordReset] send-reset error:', body.error);
    }

    revalidatePath('/admin');
    redirect('/admin?event=reset_sent');
  } catch (err: any) {
    if (err.digest) throw err;
    redirect(`/admin?event=error&code=${toErrorCode(err.message)}`);
  }
}

export async function requestPasswordReset(formData: FormData) {
  try {
    const email = formData.get('email') as string;
    if (!email) throw new Error('Email is required');

    const adminClient = createAdminClient();
    const siteUrl     = getSiteUrl();

    // â”€â”€ Replace O(n) listUsers() with targeted RPC lookup â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // get_user_id_by_email queries auth.users directly via SECURITY DEFINER
    // function â€” avoids loading the entire user list on every public form submit.
    // Returns null if the user doesn't exist; we still redirect to "sent" to
    // prevent email enumeration.
    const { data: userId, error: rpcError } = await adminClient
      .rpc('get_user_id_by_email', { email_input: email.trim().toLowerCase() });

    if (rpcError) {
      // RPC not yet deployed (migration 009 pending) â€” fall back gracefully.
      // Do NOT fall back to listUsers() â€” just skip token creation.
      console.warn('[requestPasswordReset] get_user_id_by_email RPC unavailable:', rpcError.message);
    } else if (userId) {
      await createAuthToken(userId as string, 'recovery', 24);
    }

    const res = await fetch(`${siteUrl}/api/auth/send-reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      console.error('[requestPasswordReset] send-reset error:', body.error);
    }

    // Always redirect to "sent" â€” don't reveal whether the email exists.
    redirect(`/forgot-password?sent=1`);
  } catch (err: any) {
    if (err.digest) throw err;
    // Generic error message â€” don't expose internal details in URL
    redirect('/forgot-password?event=error&code=server_error');
  }
}

export async function updateUserRole(formData: FormData) {
  try {
    await verifyAdmin();
    const userId = formData.get('userId') as string;
    const role   = formData.get('role') as string;

    if (!userId || !role) throw new Error('User ID and role required');

    // â”€â”€ Allowlist validation â€” prevents arbitrary string injection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (!VALID_ROLES.has(role)) {
      throw new Error(`Invalid role '${role}' â€” must be 'admin' or 'user'`);
    }

    const adminClient = createAdminClient();
    const { error } = await adminClient.from('profiles').update({ role }).eq('id', userId);
    if (error) throw new Error(error.message);
    revalidatePath('/admin');
    redirect('/admin?event=role_updated');
  } catch (err: any) {
    if (err.digest) throw err;
    redirect(`/admin?event=error&code=${toErrorCode(err.message)}`);
  }
}

export async function updateUserStatus(formData: FormData) {
  try {
    await verifyAdmin();
    const userId = formData.get('userId') as string;
    const status = formData.get('status') as string;

    if (!userId || !status) throw new Error('User ID and status required');

    // â”€â”€ Allowlist validation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (!VALID_STATUSES.has(status)) throw new Error('Invalid status value');

    const adminClient = createAdminClient();
    const { error } = await adminClient
      .from('profiles')
      .update({ status, is_active: status === 'active' })
      .eq('id', userId);

    if (error) throw new Error(error.message);
    revalidatePath('/admin');
    redirect('/admin?event=status_updated');
  } catch (err: any) {
    if (err.digest) throw err;
    redirect(`/admin?event=error&code=${toErrorCode(err.message)}`);
  }
}

export async function deleteUser(formData: FormData) {
  try {
    await verifyAdmin();
    const userId = formData.get('userId') as string;
    if (!userId || typeof userId !== 'string') throw new Error('User ID required');

    const adminClient = createAdminClient();
    const { error } = await adminClient.auth.admin.deleteUser(userId);
    if (error) throw new Error(error.message);
    revalidatePath('/admin');
    redirect('/admin?event=user_deleted');
  } catch (err: any) {
    if (err.digest) throw err;
    redirect(`/admin?event=error&code=${toErrorCode(err.message)}`);
  }
}

export async function registerDevice(formData: FormData) {
  try {
    await verifyAdmin();
    const vrm_site_id = formData.get('vrm_site_id') as string;
    const name        = formData.get('name') as string;

    if (!vrm_site_id || !name) throw new Error('VRM ID and nickname are required');

    const adminClient = createAdminClient();
    const { error } = await adminClient.from('vrm_devices').insert([{ vrm_site_id, name }]);
    if (error) throw new Error(error.message);
    revalidatePath('/admin');
    redirect('/admin?event=device_registered');
  } catch (err: any) {
    if (err.digest) throw err;
    redirect(`/admin?event=error&code=${toErrorCode(err.message)}`);
  }
}

export async function assignDevice(formData: FormData) {
  try {
    await verifyAdmin();
    const user_id   = formData.get('user_id') as string;
    const device_id = formData.get('device_id') as string;

    if (!user_id || !device_id) throw new Error('User and device selection are required');

    const deviceIdNum = parseInt(device_id, 10);
    if (isNaN(deviceIdNum)) throw new Error('Invalid device ID');

    const adminClient = createAdminClient();

    const { data: existing } = await adminClient
      .from('device_assignments')
      .select('id')
      .eq('user_id', user_id)
      .eq('device_id', deviceIdNum)
      .maybeSingle();

    if (existing) {
      const { data: device } = await adminClient
        .from('vrm_devices')
        .select('name')
        .eq('id', deviceIdNum)
        .maybeSingle();
      throw new Error(
        `${device?.name ?? 'This device'} is already assigned to this user`
      );
    }

    const { error } = await adminClient
      .from('device_assignments')
      .insert([{ user_id, device_id: deviceIdNum }]);
    if (error) throw new Error(error.message);
    revalidatePath('/admin');
    redirect('/admin?event=device_assigned');
  } catch (err: any) {
    if (err.digest) throw err;
    redirect(`/admin?event=error&code=${toErrorCode(err.message)}`);
  }
}

export async function deleteAssignment(formData: FormData) {
  try {
    await verifyAdmin();
    const id = formData.get('id') as string;
    if (!id) throw new Error('Assignment ID required');

    const idNum = parseInt(id, 10);
    if (isNaN(idNum)) throw new Error('Invalid assignment ID');

    const adminClient = createAdminClient();
    const { error } = await adminClient
      .from('device_assignments')
      .delete()
      .eq('id', idNum);
    if (error) throw new Error(error.message);
    revalidatePath('/admin');
    redirect('/admin?event=assignment_removed');
  } catch (err: any) {
    if (err.digest) throw err;
    redirect(`/admin?event=error&code=${toErrorCode(err.message)}`);
  }
}

export async function addManagedNetworkDevice(formData: FormData) {
  try {
    await verifyAdmin();

    const vrmDeviceId = formData.get('vrm_device_id') as string;
    const name = formData.get('name') as string;
    const ipAddress = formData.get('ip_address') as string;
    const alertOnOffline = formData.get('alert_on_offline') === 'on';

    if (!vrmDeviceId || !name || !ipAddress) {
      throw new Error('Managed device name, target trailer, and IP address are required');
    }

    const parsedVrmDeviceId = parseInt(vrmDeviceId, 10);
    if (Number.isNaN(parsedVrmDeviceId)) throw new Error('Invalid device ID');

    const adminClient = createAdminClient();
    const { error } = await adminClient
      .from('managed_network_devices')
      .insert([{
        vrm_device_id: parsedVrmDeviceId,
        name: name.trim(),
        ip_address: ipAddress.trim(),
        alert_on_offline: alertOnOffline,
      }]);

    if (error) throw new Error(error.message);

    revalidatePath('/admin');
    revalidatePath('/dashboard');
    redirect('/admin?event=managed_device_added');
  } catch (err: any) {
    if (err.digest) throw err;
    redirect(`/admin?event=error&code=${toErrorCode(err.message)}`);
  }
}

export async function deleteManagedNetworkDevice(formData: FormData) {
  try {
    await verifyAdmin();

    const id = formData.get('id') as string;
    if (!id) throw new Error('Invalid managed network device ID');

    const parsedId = parseInt(id, 10);
    if (Number.isNaN(parsedId)) throw new Error('Invalid managed network device ID');

    const adminClient = createAdminClient();
    const { error } = await adminClient
      .from('managed_network_devices')
      .delete()
      .eq('id', parsedId);

    if (error) throw new Error(error.message);

    revalidatePath('/admin');
    revalidatePath('/dashboard');
    redirect('/admin?event=managed_device_removed');
  } catch (err: any) {
    if (err.digest) throw err;
    redirect(`/admin?event=error&code=${toErrorCode(err.message)}`);
  }
}

export async function promoteDiscoveredNetworkDevice(formData: FormData) {
  try {
    await verifyAdmin();

    const id = formData.get('id') as string;
    const label = formData.get('name') as string | null;
    const alertOnOffline = formData.get('alert_on_offline') === 'on';

    if (!id) throw new Error('Invalid discovered network device ID');
    const parsedId = parseInt(id, 10);
    if (Number.isNaN(parsedId)) throw new Error('Invalid discovered network device ID');

    const adminClient = createAdminClient();
    const { data: discovered, error: discoveredError } = await adminClient
      .from('discovered_network_devices')
      .select('vrm_device_id, ip_address, hostname')
      .eq('id', parsedId)
      .maybeSingle();

    if (discoveredError) throw new Error(discoveredError.message);
    if (!discovered) throw new Error('Invalid discovered network device ID');

    const fallbackName = discovered.hostname || String(discovered.ip_address);
    const name = label?.trim() || fallbackName;

    const { error } = await adminClient
      .from('managed_network_devices')
      .upsert([{
        vrm_device_id: discovered.vrm_device_id,
        name,
        ip_address: discovered.ip_address,
        alert_on_offline: alertOnOffline,
        is_active: true,
      }], { onConflict: 'vrm_device_id,ip_address' });

    if (error) throw new Error(error.message);

    revalidatePath('/admin');
    revalidatePath('/dashboard');
    redirect('/admin?event=managed_device_added');
  } catch (err: any) {
    if (err.digest) throw err;
    redirect(`/admin?event=error&code=${toErrorCode(err.message)}`);
  }
}

export async function createClientAccount(formData: FormData) {
  try {
    await verifyAdmin();
    const email    = formData.get('email') as string;
    const password = formData.get('password') as string;

    if (!email || !password) throw new Error('Email and password required');
    if (password.length < 12) throw new Error('Password must be at least 12 characters');

    const adminAuthClient = createAdminClient();
    const { error } = await adminAuthClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (error) throw new Error(error.message);
    revalidatePath('/admin');
    redirect('/admin?event=account_created');
  } catch (err: any) {
    if (err.digest) throw err;
    redirect(`/admin?event=error&code=${toErrorCode(err.message)}`);
  }
}

export async function runFreePlanMaintenance() {
  try {
    await verifyAdmin();

    const adminClient = createAdminClient();
    const { error } = await adminClient.rpc('prune_free_plan_operational_data');
    if (error) {
      console.error('[runFreePlanMaintenance] prune failed:', error.message);
      throw new Error('Free-plan maintenance unavailable');
    }

    revalidatePath('/admin');
    redirect('/admin?event=maintenance_run');
  } catch (err: any) {
    if (err.digest) throw err;
    redirect(`/admin?event=error&code=${toErrorCode(err.message)}`);
  }
}
