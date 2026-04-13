-- ############################################################################
-- MIGRATION 005: Security Advisor pass 2
-- Resolves all remaining issues from Supabase Security Advisor screenshots:
--   Error  : public.audit_logs — RLS disabled in public schema
--   Warning: public.is_admin   — Function Search Path Mutable
--   Warning: public.log_changes — Function Search Path Mutable
--   Info   : public.device_assignments — RLS enabled, no policy
--
-- Leaked Password Protection (Auth setting) cannot be fixed via SQL.
-- Enable it in: Supabase Dashboard → Authentication → Sign In / Sign Up →
--               Password → enable "Leaked Password Protection (HaveIBeenPwned)"
--
-- Run this entire script in: Supabase Dashboard → SQL Editor → New Query
-- ############################################################################


-- ── 1. audit_logs: Enable RLS + lock down access ─────────────────────────────
-- This table was created outside migrations. Enable RLS so PostgREST cannot
-- serve its rows to anonymous or authenticated callers directly.
-- Only service_role (admin client) should ever read or write audit logs.

DO $$ 
BEGIN 
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename  = 'audit_logs') THEN
        ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- Deny all direct access from authenticated / anon roles.
-- service_role bypasses RLS and is unaffected.
DROP POLICY IF EXISTS "Deny direct access to audit_logs" ON public.audit_logs;
CREATE POLICY "Deny direct access to audit_logs"
  ON public.audit_logs
  AS RESTRICTIVE
  TO authenticated, anon
  USING (false);


-- ── 2. Fix mutable search_path on public.is_admin ───────────────────────────
-- A mutable search_path allows an attacker to hijack object resolution by
-- placing malicious objects earlier in the search path.
-- Fix: pin search_path to public + pg_catalog so the function always resolves
-- objects against the known schemas, regardless of caller search_path.

DO $$
BEGIN
  -- Attempt no-arg signature first (most common for is_admin helper)
  ALTER FUNCTION public.is_admin() SET search_path = public, pg_catalog;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'public.is_admin() signature mismatch — check function signature in Supabase Dashboard → Database → Functions and run: ALTER FUNCTION public.is_admin(<params>) SET search_path = public, pg_catalog;';
END $$;


-- ── 3. Fix mutable search_path on public.log_changes ────────────────────────
-- Same risk as above. log_changes is typically a trigger function (RETURNS trigger).

DO $$
BEGIN
  ALTER FUNCTION public.log_changes() SET search_path = public, pg_catalog;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'public.log_changes() signature mismatch — check function signature in Supabase Dashboard → Database → Functions and run: ALTER FUNCTION public.log_changes(<params>) SET search_path = public, pg_catalog;';
END $$;


-- ── 4. device_assignments: re-assert SELECT policy ───────────────────────────
-- The Supabase security advisor reports no policies on device_assignments.
-- Migration 000 created this policy but it may not have been applied to the
-- current Supabase project. Re-create it explicitly here.

DROP POLICY IF EXISTS "Users see own assignments" ON public.device_assignments;
CREATE POLICY "Users see own assignments"
  ON public.device_assignments
  FOR SELECT
  USING (user_id = auth.uid());

-- Confirm RLS is still enabled
ALTER TABLE public.device_assignments ENABLE ROW LEVEL SECURITY;


-- ── 5. Re-assert handle_new_user search_path (belt-and-suspenders) ───────────
-- Migration 001 already sets this but re-assert in case the function was
-- recreated without the SET clause.
ALTER FUNCTION public.handle_new_user() SET search_path = public, pg_catalog;
