'use server';

import { createAdminClient } from '@/utils/supabase/admin';
import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

// Safe error codes for redirect URLs — never put raw error messages in the URL.
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
};

function toErrorCode(message: string): string {
  return ERROR_CODES[message] ?? 'server_error';
}

// ── Constants ─────────────────────────────────────────────────────────────────

const VALID_ROLES   = new Set(['admin', 'user']);
const VALID_STATUSES = new Set(['active', 'suspended']);

// ── Helpers ───────────────────────────────────────────────────────────────────

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
 * invalidate + insert in a single implicit transaction — eliminates the TOCTOU
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

    const email      = formData.get('email') as string;
    const vrm_site_id = formData.get('vrm_site_id') as string | null;
    const device_name = formData.get('device_name') as string | null;

    if (!email) throw new Error('Email is required');

    const adminClient = createAdminClient();
    const siteUrl     = getSiteUrl();

    // Step 1: generateLink — creates the auth user and returns their ID.
    // Does NOT send an email (that's handled by inviteUserByEmail below).
    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: 'invite',
      email,
      options: { redirectTo: `${siteUrl}/auth/callback` },
    });
    if (linkError) throw new Error(linkError.message);
    if (!linkData.user?.id) throw new Error('User creation failed — no user ID returned');

    // Step 2: Create the 48-hour invite token (atomic RPC)
    const inviteToken = await createAuthToken(linkData.user.id, 'invite', 48);

    // Step 3: Send the invite email with the token embedded in redirectTo.
    // If this fails, clean up the orphaned auth user created in step 1.
    const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
      email,
      { redirectTo: `${siteUrl}/auth/callback?invite_token=${inviteToken}` }
    );
    if (inviteError) {
      // Roll back the orphaned auth user to avoid ghost accounts.
      console.error('[inviteNewUser] inviteUserByEmail failed, rolling back user:', linkData.user.id);
      await adminClient.auth.admin.deleteUser(linkData.user.id).catch((e: any) =>
        console.error('[inviteNewUser] rollback deleteUser failed:', e.message)
      );
      throw new Error(inviteError.message);
    }
    if (!inviteData.user) throw new Error('Invite user data missing');

    // Step 4: Optionally register and assign a VRM device
    const userId = inviteData.user.id ?? linkData.user.id;
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
    // Do not include email in URL — visible in browser history and server logs.
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
    const inviteToken = await createAuthToken(userId, 'invite', 48);

    const { error } = await adminClient.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${siteUrl}/auth/callback?invite_token=${inviteToken}`,
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

    // ── Replace O(n) listUsers() with targeted RPC lookup ─────────────────────
    // get_user_id_by_email queries auth.users directly via SECURITY DEFINER
    // function — avoids loading the entire user list on every public form submit.
    // Returns null if the user doesn't exist; we still redirect to "sent" to
    // prevent email enumeration.
    const { data: userId, error: rpcError } = await adminClient
      .rpc('get_user_id_by_email', { email_input: email.trim().toLowerCase() });

    if (rpcError) {
      // RPC not yet deployed (migration 009 pending) — fall back gracefully.
      // Do NOT fall back to listUsers() — just skip token creation.
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

    // Always redirect to "sent" — don't reveal whether the email exists.
    redirect(`/forgot-password?sent=1`);
  } catch (err: any) {
    if (err.digest) throw err;
    // Generic error message — don't expose internal details in URL
    redirect('/forgot-password?event=error&code=server_error');
  }
}

export async function updateUserRole(formData: FormData) {
  try {
    await verifyAdmin();
    const userId = formData.get('userId') as string;
    const role   = formData.get('role') as string;

    if (!userId || !role) throw new Error('User ID and role required');

    // ── Allowlist validation — prevents arbitrary string injection ─────────────
    if (!VALID_ROLES.has(role)) {
      throw new Error(`Invalid role '${role}' — must be 'admin' or 'user'`);
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

    // ── Allowlist validation ───────────────────────────────────────────────────
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
