'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

/**
 * Looks up the auth token for the current user via the server API.
 * The server route uses adminClient (service_role) to bypass the RESTRICTIVE
 * deny RLS policy on auth_tokens that blocks authenticated/anon queries.
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

    const hash        = window.location.hash.substring(1);
    const hashParams  = new URLSearchParams(hash);
    const type        = hashParams.get('type');
    const inviteToken = searchParams.get('invite_token');

    async function route(session: { user: { id: string } } | null) {
      if (handled || !session) return;
      handled = true;

      if (type === 'recovery') {
        setStatus('Redirecting to password reset…');
        const token = await fetchAuthToken('recovery');
        if (token) {
          router.replace(`/auth/reset/${token}`);
        } else {
          router.replace('/reset-password');
        }
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
        console.log('[auth/callback] invite server-API lookup:', { userId: session.user.id, token });

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

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (handled) return;
        if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
          if (session) route(session);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && !handled) route(session);
    });

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
