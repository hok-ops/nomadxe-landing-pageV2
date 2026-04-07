'use client';

/**
 * /auth/callback — client-side auth handler for implicit flow.
 *
 * Supabase's implicit flow (non-PKCE) redirects here with the session
 * embedded as a URL hash fragment: #access_token=xxx&type=recovery
 *
 * Hash fragments are never sent to the server, so this MUST be a client
 * component. The Supabase browser client automatically reads the hash on
 * init, then onAuthStateChange fires with the appropriate event.
 *
 * PKCE flow (?code=) is handled by /auth/confirm (server Route Handler).
 * This page is only hit when the project is on implicit flow.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

export default function AuthCallbackPage() {
  const [status, setStatus] = useState('Verifying…');
  const router  = useRouter();
  const supabase = createClient();

  useEffect(() => {
    let handled = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (handled) return;
        if (event === 'PASSWORD_RECOVERY') {
          handled = true;
          setStatus('Redirecting to password reset…');
          router.replace('/reset-password');
        } else if (event === 'SIGNED_IN' && session) {
          handled = true;
          setStatus('Signed in, redirecting…');
          router.replace('/dashboard');
        }
      }
    );

    // PKCE flow: ?code= is present as a query param, not a hash fragment.
    // Exchange it manually — onAuthStateChange fires after this resolves.
    const code = new URLSearchParams(window.location.search).get('code');
    if (code) {
      supabase.auth.exchangeCodeForSession(code).catch(() => {
        if (!handled) {
          router.replace('/login?error=Invalid+or+expired+link.+Please+request+a+new+one.');
        }
      });
    }

    // Fallback: if no auth event fires within 6 s the link is broken.
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
