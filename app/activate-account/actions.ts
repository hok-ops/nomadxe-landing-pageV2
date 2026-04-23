'use server';

import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';

/**
 * Sets the password and activates the user profile for a newly invited account.
 *
 * Uses the admin API (updateUserById) instead of the client-side updateUser,
 * which has a "same password" restriction that fires on re-invited test accounts
 * or any account that previously had a password set.
 */
export async function activateAccount(fullName: string, password: string) {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) throw new Error('Session expired — please use your invite link again.');

  const adminClient = createAdminClient();

  // Admin API bypasses the "must differ from current password" check
  const { error: passwordError } = await adminClient.auth.admin.updateUserById(
    user.id,
    { password }
  );
  if (passwordError) throw new Error(passwordError.message);

  const { error: profileError } = await adminClient
    .from('profiles')
    .update({ full_name: fullName, is_active: true, status: 'active' })
    .eq('id', user.id);

  if (profileError) throw new Error(profileError.message);

  return { success: true };
}
