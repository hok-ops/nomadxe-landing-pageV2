-- ############################################################################
-- MIGRATION 012: Lock direct profile updates
-- Applied after migration 004 for existing databases that already created the
-- row-scoped "Users can update own profile" policy.
-- ############################################################################

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- RLS controls rows, not columns. Direct authenticated UPDATE grants on
-- profiles would allow users to write privileged columns such as role/status.
-- All profile writes must go through service_role server code.
REVOKE UPDATE ON public.profiles FROM anon;
REVOKE UPDATE ON public.profiles FROM authenticated;
