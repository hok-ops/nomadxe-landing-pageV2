'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

function AuthCallbackInner() {
  const [status, setStatus] = useState('Verifying…');
  const router       = useRouter();
  const searchParams = useSearchParams();
  const supabase     = createClient();

  useEffect(() => {
    let handled = false;

    const hash       = window.location.hash.substring(1);
    const hashParams = new URLSearchParams(hash);
    const type       = hashParams.get('type');
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

        if (inviteToken) {
          console.log('[auth/callback] invite_token from URL, going to activate-account');
          router.replace('/activate-account');
          return;
        }

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

        console.log('[auth/callback] invite DB lookup:', { userId: session.user.id, tokenRow, tokenErr });

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
