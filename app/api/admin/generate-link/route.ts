import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import crypto from 'crypto';

/**
 * Atomically rotate an auth token using the rotate_auth_token RPC (migration 009).
 * Replaces the prior two-step UPDATE+INSERT pattern that had a TOCTOU race.
 */
async function createAuthToken(
  adminClient: ReturnType<typeof createAdminClient>,
  userId: string,
  type: 'invite' | 'recovery',
  expiryHours: number
): Promise<string> {
  const token     = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000).toISOString();

  const { error } = await adminClient.rpc('rotate_auth_token', {
    p_user_id:    userId,
    p_type:       type,
    p_token:      token,
    p_expires_at: expiresAt,
  });

  if (error) throw new Error(`Failed to create auth token: ${error.message}`);
  return token;
}

export async function POST(request: NextRequest) {
  const supabase    = createClient();
  const adminClient = createAdminClient();

  // Auth guard — admin only
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await adminClient
    .from('profiles').select('role').eq('id', user.id).single();
  if (!profile || profile.role !== 'admin') {
    console.warn('[SECURITY] generate-link: non-admin access attempt', {
      userId: user.id,
      role: profile?.role ?? 'no profile',
      ts: new Date().toISOString(),
    });
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  let body: { type?: string; email?: string };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }); }

  const { type, email } = body;
  if (!type || !email) {
    return NextResponse.json({ error: 'type and email required' }, { status: 400 });
  }

  const siteUrl = process.env.SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.nomadxe.com';

  const { data, error } = await adminClient.auth.admin.generateLink({
    type: type as 'invite' | 'recovery' | 'magiclink',
    email,
    options: { redirectTo: `${siteUrl}/auth/confirm` },
  });

  // Return a generic error to the client — never expose internal Supabase messages
  if (error) {
    console.error('[generate-link] generateLink error:', error.message);
    return NextResponse.json({ error: 'Failed to generate link' }, { status: 400 });
  }

  const invitedUserId = data.user?.id;
  console.log('[generate-link] generateLink OK:', { invitedUserId, type });

  // Create the auth_tokens row using atomic RPC
  if (invitedUserId && (type === 'invite' || type === 'recovery')) {
    try {
      await createAuthToken(
        adminClient,
        invitedUserId,
        type as 'invite' | 'recovery',
        type === 'invite' ? 48 : 24
      );
    } catch (e: any) {
      console.error('[generate-link] createAuthToken failed:', e.message);
    }
  } else {
    console.warn('[generate-link] skipping createAuthToken — invitedUserId missing:', { invitedUserId, type });
  }

  return NextResponse.json({ link: data.properties.action_link });
}
