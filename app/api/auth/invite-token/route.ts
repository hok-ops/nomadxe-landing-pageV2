import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { AUTH_TOKEN_COOKIE_NAMES, AuthTokenType, authTokenCookieOptions } from '@/lib/authTokenCookies';

/**
 * GET /api/auth/invite-token?type=invite|recovery
 *
 * Bridges the valid auth token for the currently-authenticated user into an
 * HttpOnly cookie and returns the next same-origin route.
 * Uses adminClient (service_role) to bypass the RESTRICTIVE deny RLS policy
 * on auth_tokens that blocks authenticated/anon role queries.
 *
 * Called by /auth/callback when Supabase completes a client-side auth flow.
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
    return NextResponse.json({ redirectTo: null }, { status: 400 });
  }
  const tokenType = type as AuthTokenType;

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ redirectTo: null }, { status: 401 });
  }

  const adminClient = createAdminClient();
  const { data } = await adminClient
    .from('auth_tokens')
    .select('token, expires_at')
    .eq('user_id', user.id)
    .eq('type', tokenType)
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data?.token) {
    return NextResponse.json({ redirectTo: null });
  }

  const redirectTo = tokenType === 'recovery' ? '/auth/reset' : '/auth/setup';
  const response = NextResponse.json({ redirectTo });
  response.cookies.set(
    AUTH_TOKEN_COOKIE_NAMES[tokenType],
    data.token,
    authTokenCookieOptions(data.expires_at)
  );
  return response;
}
