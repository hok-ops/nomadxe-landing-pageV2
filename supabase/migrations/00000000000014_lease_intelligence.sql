-- ############################################################################
-- MIGRATION 014: Lease intelligence, proof-of-service, and access audit layer
-- Customer dashboards can read assigned lease/service/proof/audit records.
-- Writes stay server/service-role controlled unless an API route explicitly
-- validates ownership and creates a customer service ticket.
-- ############################################################################

CREATE TABLE IF NOT EXISTS public.customer_leases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  lease_number TEXT NOT NULL UNIQUE,
  package_type TEXT NOT NULL DEFAULT 'power_base'
    CHECK (package_type IN ('power_base', 'fully_equipped')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('draft', 'scheduled', 'active', 'paused', 'ending', 'ended')),
  site_name TEXT NOT NULL,
  site_address TEXT,
  service_level TEXT NOT NULL DEFAULT 'full_service',
  monitoring_partner TEXT,
  starts_on DATE,
  ends_on DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.lease_assets (
  id BIGSERIAL PRIMARY KEY,
  lease_id UUID NOT NULL REFERENCES public.customer_leases(id) ON DELETE CASCADE,
  vrm_device_id INTEGER NOT NULL REFERENCES public.vrm_devices(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'primary' CHECK (role IN ('primary', 'support', 'temporary')),
  deployed_at TIMESTAMPTZ,
  removed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (lease_id, vrm_device_id)
);

CREATE TABLE IF NOT EXISTS public.service_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id UUID REFERENCES public.customer_leases(id) ON DELETE SET NULL,
  vrm_device_id INTEGER REFERENCES public.vrm_devices(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('service', 'relocation', 'connectivity', 'power', 'monitoring', 'billing', 'other')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'urgent')),
  status TEXT NOT NULL DEFAULT 'received'
    CHECK (status IN ('received', 'triage', 'scheduled', 'en_route', 'blocked', 'completed', 'cancelled')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  requested_for TIMESTAMPTZ,
  customer_visible_note TEXT,
  internal_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.proof_of_service_events (
  id BIGSERIAL PRIMARY KEY,
  lease_id UUID REFERENCES public.customer_leases(id) ON DELETE CASCADE,
  vrm_device_id INTEGER REFERENCES public.vrm_devices(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL
    CHECK (event_type IN ('telemetry', 'alarm', 'monitoring', 'service', 'relocation', 'access', 'report')),
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'watch', 'action', 'critical')),
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.remote_access_audit_events (
  id BIGSERIAL PRIMARY KEY,
  actor_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_role TEXT NOT NULL DEFAULT 'user',
  vrm_device_id INTEGER REFERENCES public.vrm_devices(id) ON DELETE SET NULL,
  teltonika_rms_device_id TEXT,
  access_type TEXT NOT NULL CHECK (access_type IN ('teltonika_remote_webui', 'vrm_portal', 'admin_gateway')),
  status TEXT NOT NULL CHECK (status IN ('requested', 'granted', 'denied', 'failed')),
  reason TEXT,
  user_agent_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
      AND COALESCE(p.is_active, true) = true
      AND COALESCE(p.status, 'active') = 'active'
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.user_can_access_vrm_device(target_device_id INTEGER)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.device_assignments da
      WHERE da.device_id = target_device_id
        AND da.user_id = auth.uid()
    );
$$;

CREATE OR REPLACE FUNCTION public.user_can_access_lease(target_lease_id UUID)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.customer_leases cl
      WHERE cl.id = target_lease_id
        AND cl.customer_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.lease_assets la
      JOIN public.device_assignments da ON da.device_id = la.vrm_device_id
      WHERE la.lease_id = target_lease_id
        AND da.user_id = auth.uid()
    );
$$;

REVOKE EXECUTE ON FUNCTION public.user_can_access_vrm_device(INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.user_can_access_lease(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_can_access_vrm_device(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_access_lease(UUID) TO authenticated;

CREATE INDEX IF NOT EXISTS idx_customer_leases_customer_status
  ON public.customer_leases (customer_id, status);

CREATE INDEX IF NOT EXISTS idx_lease_assets_device
  ON public.lease_assets (vrm_device_id, lease_id);

CREATE INDEX IF NOT EXISTS idx_service_tickets_customer_status
  ON public.service_tickets (customer_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_service_tickets_device_status
  ON public.service_tickets (vrm_device_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_proof_events_device_time
  ON public.proof_of_service_events (vrm_device_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_access_audit_device_time
  ON public.remote_access_audit_events (vrm_device_id, created_at DESC);

ALTER TABLE public.customer_leases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lease_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proof_of_service_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.remote_access_audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see assigned leases" ON public.customer_leases;
CREATE POLICY "Users see assigned leases"
  ON public.customer_leases
  FOR SELECT
  USING (public.user_can_access_lease(id));

DROP POLICY IF EXISTS "Users see assigned lease assets" ON public.lease_assets;
CREATE POLICY "Users see assigned lease assets"
  ON public.lease_assets
  FOR SELECT
  USING (public.user_can_access_lease(lease_id) OR public.user_can_access_vrm_device(vrm_device_id));

DROP POLICY IF EXISTS "Users see assigned service tickets" ON public.service_tickets;
CREATE POLICY "Users see assigned service tickets"
  ON public.service_tickets
  FOR SELECT
  USING (
    customer_id = auth.uid()
    OR (lease_id IS NOT NULL AND public.user_can_access_lease(lease_id))
    OR (vrm_device_id IS NOT NULL AND public.user_can_access_vrm_device(vrm_device_id))
  );

DROP POLICY IF EXISTS "Users see assigned proof events" ON public.proof_of_service_events;
CREATE POLICY "Users see assigned proof events"
  ON public.proof_of_service_events
  FOR SELECT
  USING (
    (lease_id IS NOT NULL AND public.user_can_access_lease(lease_id))
    OR (vrm_device_id IS NOT NULL AND public.user_can_access_vrm_device(vrm_device_id))
  );

DROP POLICY IF EXISTS "Users see assigned access audit" ON public.remote_access_audit_events;
CREATE POLICY "Users see assigned access audit"
  ON public.remote_access_audit_events
  FOR SELECT
  USING (
    actor_user_id = auth.uid()
    OR (vrm_device_id IS NOT NULL AND public.user_can_access_vrm_device(vrm_device_id))
  );

REVOKE INSERT, UPDATE, DELETE ON public.customer_leases FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.lease_assets FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.service_tickets FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.proof_of_service_events FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.remote_access_audit_events FROM anon, authenticated;

GRANT SELECT ON public.customer_leases TO authenticated;
GRANT SELECT ON public.lease_assets TO authenticated;
GRANT SELECT ON public.service_tickets TO authenticated;
GRANT SELECT ON public.proof_of_service_events TO authenticated;
GRANT SELECT ON public.remote_access_audit_events TO authenticated;
