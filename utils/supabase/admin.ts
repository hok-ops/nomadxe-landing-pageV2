import { createClient } from '@supabase/supabase-js';

export function createAdminClient() {
  const supabaseUrl    = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // During Next.js static build, env vars may not be set — return a placeholder
  // client so the build doesn't crash. This client is NEVER used at request time.
  const isBuild = process.env.NEXT_PHASE === 'phase-production-build';
  if (isBuild && (!supabaseUrl || !serviceRoleKey)) {
    return createClient('https://placeholder.supabase.co', 'build-placeholder', {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  // At request time, missing keys are a hard failure — throw rather than return
  // a non-functional client that silently fails all DB operations and makes
  // misconfiguration look like normal operation.
  if (!supabaseUrl) {
    throw new Error('[CRITICAL] NEXT_PUBLIC_SUPABASE_URL is not configured');
  }
  if (!serviceRoleKey) {
    throw new Error('[CRITICAL] SUPABASE_SERVICE_ROLE_KEY is not configured — set this env var in Vercel immediately');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
