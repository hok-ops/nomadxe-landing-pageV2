import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import crypto from 'crypto';

async function createAuthToken(
  adminClient: ReturnType<typeof createAdminClient>,
  userId: string,
  type: 'invite' | 'recovery',
  expiryHours: number
): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000).toISOString();

  // Invalidate prior unused tokens of same type
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

export async function POST(request: NextRequest) {
  const supabase    = createClient();
  const adminClient = createAdminClient();

  // Auth guard — admin only
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await adminClient
    .from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  const { type, email } = await request.json();
  if (!type || !email) {
    return NextResponse.json({ error: 'type and email required' }, { status: 400 });
  }

  const siteUrl = process.env.SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.nomadxe.com';

  const { data, error } = await adminClient.auth.admin.generateLink({
    type,
    email,
    options: { redirectTo: `${siteUrl}/auth/callback` },
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const invitedUserId = data.user?.id;
  console.log('[generate-link] generateLink result:', { invitedUserId, email, type, actionLink: data.properties.action_link });

  // Create the auth_tokens row so /auth/callback can route to the right page
  if (invitedUserId && (type === 'invite' || type === 'recovery')) {
    try {
      const token = await createAuthToken(
        adminClient,
        invitedUserId,
        type as 'invite' | 'recovery',
        type === 'invite' ? 48 : 24
      );
      console.log('[generate-link] auth_token created:', { invitedUserId, type, token });
    } catch (e: any) {
      console.error('[generate-link] createAuthToken failed:', e.message, e);
    }
  } else {
    console.warn('[generate-link] skipping createAuthToken — invitedUserId missing:', { invitedUserId, type });
  }

  return NextResponse.json({ link: data.properties.action_link });
}
