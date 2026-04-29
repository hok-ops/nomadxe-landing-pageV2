-- ############################################################################
-- MIGRATION 004: Security hardening
-- Fixes issues flagged by Supabase security advisor + manual code review.
-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New Query).
-- ############################################################################

-- ── 1. Drop SECURITY DEFINER view ────────────────────────────────────────────
-- public.vw_client_assignments was created with SECURITY DEFINER, which means
-- queries run with the VIEW OWNER's permissions instead of the caller's.
-- This bypasses RLS and can expose rows to users who should not see them.
-- The application never queries this view directly (all admin queries use the
-- service_role client which bypasses RLS correctly). Safe to drop entirely.
DROP VIEW IF EXISTS public.vw_client_assignments;


-- ── 2. auth_tokens: explicit deny for all non-service_role sessions ───────────
-- RLS is already enabled on auth_tokens (migration 003). However, having no
-- policies at all is flagged by the Supabase security advisor as ambiguous.
-- We add an explicit RESTRICTIVE deny policy for `authenticated` and `anon`
-- roles to make the intent unambiguous.
--
-- service_role (used by createAdminClient) has the BYPASSRLS privilege in
-- Supabase's managed Postgres and is never affected by RLS policies.
DROP POLICY IF EXISTS "Deny direct user access to auth_tokens" ON public.auth_tokens;
CREATE POLICY "Deny direct user access to auth_tokens"
  ON public.auth_tokens
  AS RESTRICTIVE
  TO authenticated, anon
  USING (false);


-- ── 3. Verify RLS is enabled on all public tables ────────────────────────────
-- Belt-and-suspenders: ensure nothing was accidentally left open.
ALTER TABLE public.profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vrm_devices       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_tokens       ENABLE ROW LEVEL SECURITY;


-- ── 4. Tighten profiles: prevent users from direct profile writes ─────────────
-- Row-level UPDATE policies cannot restrict which columns are written. Allowing
-- users to update their own row would also let them write privileged columns
-- such as `role` and `status` through PostgREST. Profile writes therefore go
-- through server-side service_role routes/actions only.
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
REVOKE UPDATE ON public.profiles FROM anon;
REVOKE UPDATE ON public.profiles FROM authenticated;


-- ── 5. Revoke public execute on handle_new_user trigger function ──────────────
-- The trigger function runs SECURITY DEFINER (required to write to profiles
-- from the auth.users trigger context). Revoke direct invocation by public/anon
-- to ensure it can only be called as a trigger, not directly by users.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
