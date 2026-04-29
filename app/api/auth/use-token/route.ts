import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { AUTH_TOKEN_COOKIE_NAMES, AuthTokenType } from '@/lib/authTokenCookies';

// Whitelist of profile fields that a user is allowed to set through the
// invite activation flow. Prevents privilege escalation via injected keys
// such as { role: 'admin' } — only these three fields are ever written.
const ALLOWED_PROFILE_FIELDS = new Set<string>(['full_name', 'is_active', 'status']);

export async function POST(request: NextRequest) {
  try {
    const { token, type, profileUpdate } = await request.json();

    if (!type) {
      return NextResponse.json({ error: 'type is required' }, { status: 400 });
    }
    if (!['invite', 'recovery'].includes(type)) {
      return NextResponse.json({ error: 'Invalid token type' }, { status: 400 });
    }
    const tokenType = type as AuthTokenType;
    const cookieName = AUTH_TOKEN_COOKIE_NAMES[tokenType];
    const resolvedToken = typeof token === 'string' && token.length > 0
      ? token
      : request.cookies.get(cookieName)?.value;

    if (!resolvedToken) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }
    // profileUpdate is only valid for the invite (account activation) flow
    if (profileUpdate && type !== 'invite') {
      return NextResponse.json({ error: 'profileUpdate only allowed for invite tokens' }, { status: 400 });
    }

    // Verify caller has an active session
    const supabase = createClient();
    const { data: { user }, error: sessionError } = await supabase.auth.getUser();
    if (sessionError || !user) {
      return NextResponse.json({ error: 'No active session' }, { status: 401 });
    }

    const adminClient = createAdminClient();

    // ── Atomic single-use enforcement ──────────────────────────────────────────
    // Replace the previous read→check→update pattern (vulnerable to TOCTOU race)
    // with a single UPDATE … WHERE used_at IS NULL.
    //
    // Postgres evaluates the WHERE predicate and applies the write atomically with
    // row-level locking. If two concurrent requests arrive with the same token,
    // only one UPDATE wins; the second sees 0 rows returned from .select() and
    // is rejected without ever accessing the profile update path.
    //
    // All validation (expiry, ownership, type) is inlined into the WHERE clause
    // so no separate SELECT round-trip is needed.
    const { data: invalidated, error: invalidateError } = await adminClient
      .from('auth_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('token', resolvedToken)
      .eq('type', tokenType)
      .eq('user_id', user.id)          // ownership check — prevents token hijacking
      .is('used_at', null)             // single-use enforcement
      .gt('expires_at', new Date().toISOString())  // expiry check
      .select('id')
      .maybeSingle();

    if (invalidateError) {
      console.error('[use-token] invalidate error:', invalidateError.message);
      return NextResponse.json({ error: 'Token validation failed' }, { status: 500 });
    }

    if (!invalidated) {
      // Either token doesn't exist, belongs to a different user, is already used,
      // or has expired. Return a consistent message regardless to avoid oracle.
      return NextResponse.json({ error: 'Token invalid, expired, or already used' }, { status: 409 });
    }

    // Token is now burned. Apply profile updates if provided (invite activation).
    // Only whitelisted keys are written — all others are silently dropped to
    // prevent privilege escalation (e.g. a caller sending { role: 'admin' }).
    if (profileUpdate && Object.keys(profileUpdate).length > 0) {
      const safeUpdate: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(profileUpdate)) {
        if (ALLOWED_PROFILE_FIELDS.has(key)) {
          safeUpdate[key] = value;
        }
      }

      if (Object.keys(safeUpdate).length > 0) {
        const { error: profileError } = await adminClient
          .from('profiles')
          .update(safeUpdate)
          .eq('id', user.id);

        if (profileError) {
          console.error('[use-token] profile update:', profileError.message);
          return NextResponse.json({ error: 'Profile update failed' }, { status: 500 });
        }
      }
    }

    const response = NextResponse.json({ success: true });
    response.cookies.delete(cookieName);
    return response;
  } catch (err: any) {
    console.error('[use-token] unexpected:', err);
    return NextResponse.json({ error: 'Unexpected server error' }, { status: 500 });
  }
}
