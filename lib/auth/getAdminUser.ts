/**
 * lib/auth/getAdminUser.ts
 *
 * Shared helper — verifies the caller has an active session AND admin role.
 * Returns the auth user object if admin, null otherwise.
 * Uses adminClient (service_role) for the role lookup to bypass RLS.
 */
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import type { User } from '@supabase/supabase-js';

export async function getAdminUser(): Promise<User | null> {
  const supabase = createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;

  const adminClient = createAdminClient();
  const { data: profile } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  return profile?.role === 'admin' ? user : null;
}
