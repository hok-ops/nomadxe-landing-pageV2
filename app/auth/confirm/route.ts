import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { type EmailOtpType } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code       = searchParams.get('code');
  const token_hash = searchParams.get('token_hash');
  const type       = searchParams.get('type') as EmailOtpType | null;

  const supabase = createClient();

  // ── Step 1: Establish a Supabase session from the incoming link ───────────

  let sessionError: string | null = null;

  if (code) {
    // PKCE flow — invite links always arrive as ?code=
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) sessionError = error.message;

  } else if (token_hash && type) {
    // OTP flow — password reset links arrive as ?token_hash=&type=recovery
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (error) sessionError = error.message;

  } else {
    // Neither present — malformed link
    return NextResponse.redirect(
      new URL('/login?error=Invalid+reset+link.+Please+request+a+new+one.', request.url)
    );
  }

  if (sessionError) {
    console.error('[auth/confirm] session error:', sessionError);
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(sessionError)}`, request.url)
    );
  }

  // ── Step 2: Identify the user now that a session is established ───────────

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(
      new URL('/login?error=Session+could+not+be+established', request.url)
    );
  }

  // ── Step 3: Look up the matching auth_token to determine destination ───────
  // Determine which type of token to look for based on the incoming flow.
  // PKCE code → invite,  token_hash recovery → recovery
  const tokenType: 'invite' | 'recovery' = type === 'recovery' ? 'recovery' : 'invite';

  const adminClient = createAdminClient();
  const { data: tokenRecord } = await adminClient
    .from('auth_tokens')
    .select('token, type, used_at, expires_at')
    .eq('user_id', user.id)
    .eq('type', tokenType)
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // ── Step 4: Route to the correct page ─────────────────────────────────────

  if (tokenRecord) {
    const dest = tokenType === 'recovery'
      ? `/auth/reset/${tokenRecord.token}`
      : `/auth/setup/${tokenRecord.token}`;
    return NextResponse.redirect(new URL(dest, request.url));
  }

  // No valid token in DB — the session is still good, so for recovery we can
  // still let the user reset their password via a generic fallback page.
  // For invite, send them to login since their account is already set up.
  if (tokenType === 'recovery') {
    // Session established, no custom token — still allow password update
    return NextResponse.redirect(new URL('/reset-password', request.url));
  }

  // Invite with no token → account already activated, go to dashboard
  return NextResponse.redirect(new URL('/dashboard', request.url));
}
