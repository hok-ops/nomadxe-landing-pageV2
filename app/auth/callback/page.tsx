'use client';

/**
 * /auth/callback — implicit flow client-side handler.
 *
 * Supabase implicit flow redirects here with tokens in the URL hash:
 *   #access_token=xxx&refresh_token=xxx&type=invite
 *   #access_token=xxx&refresh_token=xxx&type=recovery
 *
 * The hash is never sent to the server, so this MUST be a client component.
 * The Supabase browser client automatically reads the hash and establishes
 * the session. We read `type` from the hash to decide where to route.
 *
 * Routing:
 *   type=invite   → check auth_tokens DB → /auth/setup/[token]
 *   type=recovery → /reset-otp
 *   anything else → /dashboard
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

export default function AuthCallbackPage() {
  const [status, setStatus] = useState('Verifying…');
  const router   = useRouter();
  const supabase = createClient();

  useEffect(() => {
    let handled = false;

    // Read `type` from the hash fragment before the client clears it.
    // Supabase sets: #access_token=...&type=invite|recovery|signup|...
    const hash  = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const type  = params.get('type'); // 'invite', 'recovery', 'signup', etc.

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (handled) return;

        if (event === 'PASSWORD_RECOVERY' || type === 'recovery') {
          handled = true;
          setStatus('Redirecting to password reset…');
          router.replace('/reset-otp');
          return;
        }

        if (event === 'SIGNED_IN' && session) {
          handled = true;

          if (type === 'invite') {
            setStatus('Setting up your account…');
            // Look up the invite token to send user to the right setup page
            const { data: tokenRow } = await supabase
              .from('auth_tokens')
              .select('token')
              .eq('user_id', session.user.id)
              .eq('type', 'invite')
              .is('used_at', null)
              .gt('expires_at', new Date().toISOString())
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (tokenRow?.token) {
              router.replace(`/auth/setup/${tokenRow.token}`);
            } else {
              // Token missing or expired — account may already be set up
              router.replace('/dashboard');
            }
          } else {
            setStatus('Signed in, redirecting…');
            router.replace('/dashboard');
          }
        }
      }
    );

    // Fallback timeout — if no event fires the link is broken/expired
    const timeout = setTimeout(() => {
      if (!handled) {
        router.replace('/login?error=Invalid+or+expired+link.+Please+request+a+new+one.');
      }
    }, 6000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [router, supabase]);

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
