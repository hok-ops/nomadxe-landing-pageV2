'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

/**
 * Looks up the auth token for the current user via the server API.
 * Uses adminClient (service_role) server-side to bypass the RESTRICTIVE deny
 * RLS policy on auth_tokens that blocks authenticated/anon role queries.
 */
async function fetchAuthToken(type: 'invite' | 'recovery'): Promise<string | null> {
  try {
    const res = await fetch(`/api/auth/invite-token?type=${type}`);
    if (!res.ok) return null;
    const { token } = await res.json();
    return token ?? null;
  } catch {
    return null;
  }
}

function AuthCallbackInner() {
  const [status, setStatus] = useState('Verifying…');
  const router       = useRouter();
  const searchParams = useSearchParams();
  const supabase     = createClient();

  useEffect(() => {
    let handled = false;

    const code        = searchParams.get('code');
    const inviteToken = searchParams.get('invite_token');
    const hash        = window.location.hash.substring(1);
    const hashParams  = new URLSearchParams(hash);

    async function route(userId: string, type: string | null) {
      if (handled) return;
      handled = true;

      if (type === 'recovery') {
        setStatus('Redirecting to password reset…');
        const token = await fetchAuthToken('recovery');
        router.replace(token ? `/auth/reset/${token}` : '/reset-password');
        return;
      }

      if (type === 'invite') {
        setStatus('Setting up your account…');

        // Fast path: invite_token was embedded in the redirect URL by generate-link
        if (inviteToken) {
          console.log('[auth/callback] invite_token from URL, going to setup');
          router.replace(`/auth/setup/${inviteToken}`);
          return;
        }

        // Fallback: look up via server API (bypasses RLS)
        const token = await fetchAuthToken('invite');
        console.log('[auth/callback] invite server-API lookup:', { userId, token });

        if (token) {
          router.replace(`/auth/setup/${token}`);
        } else {
          router.replace('/login?error=Invite+link+expired.+Ask+your+admin+to+resend+the+invite.');
        }
        return;
      }

      setStatus('Signed in, redirecting…');
      router.replace('/dashboard');
    }

    async function init() {
      // ── Path 1: PKCE code (?code=) ────────────────────────────────────────
      // Explicitly exchange the code so the invited user's session replaces any
      // existing admin session in the browser. Without this, getSession() returns
      // the admin's session and the token ownership check in use-token fails.
      if (code) {
        setStatus('Exchanging session…');
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (error || !data.session) {
          console.error('[auth/callback] PKCE exchange failed:', error?.message);
          if (!handled) {
            handled = true;
            router.replace('/login?error=Invalid+or+expired+link.+Please+request+a+new+one.');
          }
          return;
        }
        const type = data.session.user.user_metadata?.type
          ?? hashParams.get('type')
          ?? (inviteToken ? 'invite' : null);
        await route(data.session.user.id, type);
        return;
      }

      // ── Path 2: Implicit flow (#access_token= in hash) ────────────────────
      // Supabase sends tokens in the hash when the redirect URL doesn't match the
      // allowlist exactly (falls back to implicit). We call setSession explicitly
      // so the invited user's session replaces any existing admin session.
      const accessToken  = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      const hashType     = hashParams.get('type');

      if (accessToken && refreshToken) {
        setStatus('Establishing session…');
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (error || !data.session) {
          console.error('[auth/callback] setSession failed:', error?.message);
          if (!handled) {
            handled = true;
            router.replace('/login?error=Invalid+or+expired+link.+Please+request+a+new+one.');
          }
          return;
        }
        await route(data.session.user.id, hashType);
        return;
      }

      // ── Path 3: Neither code nor hash — fall back to existing session ─────
      // This handles the case where the user already has a valid session and
      // arrived at /auth/callback without auth params (e.g. a stale redirect).
      const { data: { session } } = await supabase.auth.getSession();
      if (session && !handled) {
        await route(session.user.id, null);
        return;
      }

      // Nothing to work with — timeout will handle the redirect
    }

    init();

    const timeout = setTimeout(() => {
      if (!handled) {
        handled = true;
        router.replace('/login?error=Invalid+or+expired+link.+Please+request+a+new+one.');
      }
    }, 10000);

    return () => { clearTimeout(timeout); };
  }, [router, supabase, searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-[#080c14] flex items-center justify-center">
      <div className="fixed top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#1e40af] via-[#3b82f6] to-[#1e40af]" />
      <div className="text-center space-y-4">
        <div className="w-8 h-8 border-2 border-[#3b82f6] border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-[11px] font-mono text-[#93c5fd]/40 uppercase tracking-widest">{status}</p>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#080c14] flex items-center justify-center">
        <div className="fixed top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#1e40af] via-[#3b82f6] to-[#1e40af]" />
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-2 border-[#3b82f6] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-[11px] font-mono text-[#93c5fd]/40 uppercase tracking-widest">Verifying…</p>
        </div>
      </div>
    }>
      <AuthCallbackInner />
    </Suspense>
  );
}
