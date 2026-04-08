'use client';

/**
 * /auth/callback — client-side handler for implicit flow auth events.
 *
 * Supabase implicit flow embeds tokens in the URL hash (#access_token=...)
 * which servers can never read. This page lets the browser client pick up
 * the session, then routes to the correct destination:
 *
 *   PASSWORD_RECOVERY  → /reset-otp   (password reset)
 *   SIGNED_IN (invite) → /auth/setup/[token]
 *   SIGNED_IN (normal) → /dashboard
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (handled) return;

        if (event === 'PASSWORD_RECOVERY') {
          handled = true;
          setStatus('Redirecting to password reset…');
          router.replace('/reset-otp');
          return;
        }

        if (event === 'SIGNED_IN' && session) {
          handled = true;
          setStatus('Checking account…');

          // Look for an unused invite token — if found this is a new user invite
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
            setStatus('Redirecting to account setup…');
            router.replace(`/auth/setup/${tokenRow.token}`);
          } else {
            setStatus('Signed in, redirecting…');
            router.replace('/dashboard');
          }
        }
      }
    );

    // PKCE: exchange ?code= for a session — onAuthStateChange fires after
    const code = new URLSearchParams(window.location.search).get('code');
    if (code) {
      supabase.auth.exchangeCodeForSession(code).catch(() => {
        if (!handled) {
          router.replace('/login?error=Invalid+or+expired+link.+Please+request+a+new+one.');
        }
      });
    }

    // Fallback timeout
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
