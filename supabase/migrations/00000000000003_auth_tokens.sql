-- ############################################################################
-- MIGRATION 003: Custom auth tokens table
-- Stores single-use, time-limited tokens for invite activation and
-- password reset flows, decoupled from Supabase's redirect whitelist.
-- ############################################################################

CREATE TABLE IF NOT EXISTS public.auth_tokens (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  token       text        NOT NULL UNIQUE,
  user_id     uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type        text        NOT NULL CHECK (type IN ('invite', 'recovery')),
  expires_at  timestamptz NOT NULL DEFAULT (now() + interval '48 hours'),
  used_at     timestamptz DEFAULT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auth_tokens_token_idx  ON public.auth_tokens (token);
CREATE INDEX IF NOT EXISTS auth_tokens_user_idx   ON public.auth_tokens (user_id, type);

-- Only service_role touches this table (admin actions + API routes).
-- No user-context policies needed.
ALTER TABLE public.auth_tokens ENABLE ROW LEVEL SECURITY;
