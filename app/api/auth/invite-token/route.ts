import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';

/**
 * GET /api/auth/invite-token?type=invite|recovery
 *
 * Returns the valid auth token for the currently-authenticated user.
 * Uses adminClient (service_role) to bypass the RESTRICTIVE deny RLS policy
 * on auth_tokens that blocks authenticated/anon role queries.
 *
 * Called by /auth/callback as a fallback when invite_token is not in the URL.
 */
export async function GET(request: NextRequest) {
  // Rate limit: 10 lookups per IP per minute — tokens are per-user and
  // only accessible to the authenticated owner, so this is belt-and-suspenders.
  const ip = getClientIp(request);
  if (!checkRateLimit(`invite-token:${ip}`, 10, 60_000)) {
    return NextResponse.json({ token: null }, { status: 429 });
  }

  const type = request.nextUrl.searchParams.get('type') ?? 'invite';
  if (!['invite', 'recovery'].includes(type)) {
    return NextResponse.json({ token: null }, { status: 400 });
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ token: null }, { status: 401 });
  }

  const adminClient = createAdminClient();
  const { data } = await adminClient
    .from('auth_tokens')
    .select('token')
    .eq('user_id', user.id)
    .eq('type', type)
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({ token: data?.token ?? null });
}
