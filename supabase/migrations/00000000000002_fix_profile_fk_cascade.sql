-- ############################################################################
-- MIGRATION 002: Fix profiles FK to add ON DELETE CASCADE
-- Without this, calling auth.admin.deleteUser() throws a FK constraint
-- violation because profiles.id references auth.users with no cascade action.
-- ############################################################################

-- Drop the existing FK constraint (auto-named by Postgres from the table def)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- Re-add with ON DELETE CASCADE so deleting an auth user also removes the profile
-- (device_assignments already cascade from profiles, so full cleanup is automatic)
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_id_fkey
  FOREIGN KEY (id) REFERENCES auth.users (id) ON DELETE CASCADE;
