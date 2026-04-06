import { createClient } from '@supabase/supabase-js';

export function createAdminClient() {
  const isBuildStep = process.env.NEXT_PHASE === 'phase-production-build' || process.env.VERCEL || process.env.CI;
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || (isBuildStep ? 'https://placeholder.supabase.co' : '');
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || (isBuildStep ? 'build-time-placeholder' : '');

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY && !isBuildStep) {
    console.error('🚨 [SECURITY_CRITICAL] SUPABASE_SERVICE_ROLE_KEY IS MISSING. Admin tools will fail.');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
