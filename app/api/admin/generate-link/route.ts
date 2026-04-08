import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';

/**
 * POST /api/admin/generate-link
 *
 * Admin-only. Generates the auth link that would be emailed to a user
 * without actually sending the email. Used for testing auth flows when
 * email rate limits are hit or email delivery is unavailable.
 *
 * Body: { type: 'invite' | 'recovery', email: string }
 * Returns: { link: string }
 */
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

  return NextResponse.json({ link: data.properties.action_link });
}
