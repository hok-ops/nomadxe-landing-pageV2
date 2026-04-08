'use client';

/**
 * /auth/callback — implicit flow client-side handler.
 *
 * Supabase implicit flow redirects here after token verification with:
 *   #access_token=xxx&refresh_token=xxx&type=invite|recovery|signup
 *
 * The invite_token query param may be present when the invite email was
 * generated with it embedded in redirectTo. If present, we skip the DB
 * lookup entirely and go straight to /activate-account.
 *
 * Routing:
 *   type=recovery              → /reset-otp
 *   type=invite + invite_token → /activate-account (token known from URL)
 *   type=invite (no token)     → DB lookup fallback → /activate-account or error
 *   anything else              → /dashboard
 */

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

export default function AuthCallbackPage() {
  const [status, setStatus] = useState('Verifying…');
  const router       = useRouter();
  const searchParams = useSearchParams();
  const supabase     = createClient();

  useEffect(() => {
    let handled = false;

    // Read type from hash fragment BEFORE the client may clear it
    const hash       = window.location.hash.substring(1);
    const hashParams = new URLSearchParams(hash);
    const type       = hashParams.get('type'); // 'invite' | 'recovery' | 'signup' | null

    // invite_token is in the URL query string (not the hash) — embedded by generate-link
    // and inviteUserByEmail redirectTo so we never rely on session user ID for routing.
    const inviteToken = searchParams.get('invite_token');

    async function route(session: { user: { id: string } } | null) {
      if (handled || !session) return;
      handled = true;

      if (type === 'recovery') {
        setStatus('Redirecting to password reset…');
        router.replace('/reset-otp');
        return;
      }

      if (type === 'invite') {
        setStatus('Setting up your account…');

        // Fast path: invite_token is in the URL — skip DB lookup entirely.
        // This prevents the session user-ID mismatch that occurs when an admin
        // tests the invite link in their own logged-in browser.
        if (inviteToken) {
          console.log('[auth/callback] invite_token from URL, going to activate-account');
          router.replace('/activate-account');
          return;
        }

        // Fallback for older invite links (no token in URL): look up by session user ID.
        // Works correctly when the invited user opens the link in a fresh browser.
        const { data: tokenRow, error: tokenErr } = await supabase
          .from('auth_tokens')
          .select('token')
          .eq('user_id', session.user.id)
          .eq('type', 'invite')
          .is('used_at', null)
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        console.log('[auth/callback] invite DB lookup:', {
          userId: session.user.id,
          tokenRow,
          tokenErr,
        });

        if (tokenRow?.token) {
          router.replace('/activate-account');
        } else {
          console.warn('[auth/callback] No invite token found for user', session.user.id, tokenErr);
          router.replace('/login?error=Invite+link+expired.+Ask+your+admin+to+resend+the+invite.');
        }
        return;
      }

      setStatus('Signed in, redirecting…');
      router.replace('/dashboard');
    }

    // 1. Subscribe to auth state changes — catches SIGNED_IN and INITIAL_SESSION
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (handled) return;
        if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
          if (session) route(session);
        }
      }
    );

    // 2. Immediate getSession() check — in case the event already fired
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && !handled) route(session);
    });

    // 3. Fallback timeout
    const timeout = setTimeout(() => {
      if (!handled) {
        router.replace('/login?error=Invalid+or+expired+link.+Please+request+a+new+one.');
      }
    }, 8000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [router, supabase, searchParams]);

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
