import { createClient } from '@supabase/supabase-js';

export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // During Next.js static build, env vars may not be set — use placeholders
  // so the build doesn't crash. These are NEVER used at request time.
  const isBuild = process.env.NEXT_PHASE === 'phase-production-build';

  if (!supabaseUrl || !serviceRoleKey) {
    if (isBuild) {
      return createClient('https://placeholder.supabase.co', 'build-placeholder', {
        auth: { autoRefreshToken: false, persistSession: false },
      });
    }
    // At request time with missing keys: log loudly but return a non-functional client
    // so the app doesn't crash silently. The middleware will handle the auth error.
    console.error('🚨 [CRITICAL] SUPABASE_SERVICE_ROLE_KEY is missing. Admin operations will fail.');
    return createClient(supabaseUrl || 'https://placeholder.supabase.co', 'missing-key', {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
