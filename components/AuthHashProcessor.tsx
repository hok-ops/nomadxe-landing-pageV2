'use client';

/**
 * Handles Supabase implicit-flow redirects that land at the site root.
 * This happens when the Supabase allowlist falls back to the Site URL,
 * sending tokens as a URL hash fragment (#access_token=...) instead of
 * a server-readable query param (?code=...).
 *
 * Once PKCE is fully in effect (flowType: 'pkce' + allowlist configured),
 * this component becomes a no-op — the hash will never be present.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

export default function AuthHashProcessor() {
  const router = useRouter();

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash || !hash.includes('access_token')) return;

    const params = new URLSearchParams(hash.slice(1));
    const accessToken  = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    const type         = params.get('type');
    const errorCode    = params.get('error_code') || params.get('error');

    if (errorCode) {
      const desc = params.get('error_description') || errorCode;
      router.replace(`/auth/auth-code-error?error=${encodeURIComponent(desc)}`);
      return;
    }

    if (!accessToken || !refreshToken) return;

    const supabase = createClient();
    supabase.auth
      .setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ error }) => {
        if (error) {
          router.replace(`/auth/auth-code-error?error=${encodeURIComponent(error.message)}`);
          return;
        }
        // Route based on the flow type embedded in the token
        if (type === 'recovery') {
          router.replace('/reset-password');
        } else {
          // invite / signup / magiclink — go to activation page
          router.replace('/activate-account');
        }
      });
  }, [router]);

  return null;
}
