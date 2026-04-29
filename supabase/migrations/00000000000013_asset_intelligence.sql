-- ############################################################################
-- MIGRATION 013: Asset intelligence foundation
-- Stores server-generated intelligence snapshots, incidents, and adaptive
-- telemetry policy. Client dashboards may read assigned device summaries, but
-- writes stay service-role only.
-- ############################################################################

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

CREATE TABLE IF NOT EXISTS public.asset_health_snapshots (
  id BIGSERIAL PRIMARY KEY,
  vrm_device_id INTEGER NOT NULL REFERENCES public.vrm_devices(id) ON DELETE CASCADE,
  vrm_site_id TEXT NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  severity TEXT NOT NULL CHECK (severity IN ('normal', 'watch', 'action', 'critical')),
  trust_score INTEGER NOT NULL CHECK (trust_score BETWEEN 0 AND 100),
  telemetry JSONB NOT NULL DEFAULT '{}'::jsonb,
  intelligence JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.asset_incidents (
  id BIGSERIAL PRIMARY KEY,
  vrm_device_id INTEGER NOT NULL REFERENCES public.vrm_devices(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('vrm', 'cerbo_lan', 'router', 'weather', 'operator', 'system')),
  title TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('watch', 'action', 'critical')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved', 'dismissed')),
  evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  action TEXT NOT NULL,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (acknowledged_at IS NULL OR acknowledged_at >= opened_at),
  CHECK (resolved_at IS NULL OR resolved_at >= opened_at)
);

CREATE TABLE IF NOT EXISTS public.telemetry_collection_policies (
  id BIGSERIAL PRIMARY KEY,
  vrm_device_id INTEGER NOT NULL REFERENCES public.vrm_devices(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('normal', 'watch', 'incident', 'offline')),
  poll_interval_seconds INTEGER NOT NULL CHECK (poll_interval_seconds BETWEEN 60 AND 3600),
  capture_window_minutes INTEGER NOT NULL CHECK (capture_window_minutes BETWEEN 0 AND 1440),
  reason TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (vrm_device_id)
);

CREATE INDEX IF NOT EXISTS idx_asset_health_snapshots_device_time
  ON public.asset_health_snapshots (vrm_device_id, captured_at DESC);

CREATE INDEX IF NOT EXISTS idx_asset_health_snapshots_severity_time
  ON public.asset_health_snapshots (severity, captured_at DESC);

CREATE INDEX IF NOT EXISTS idx_asset_incidents_device_status
  ON public.asset_incidents (vrm_device_id, status, opened_at DESC);

CREATE INDEX IF NOT EXISTS idx_telemetry_collection_policies_device
  ON public.telemetry_collection_policies (vrm_device_id);

ALTER TABLE public.asset_health_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telemetry_collection_policies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see assigned asset snapshots" ON public.asset_health_snapshots;
CREATE POLICY "Users see assigned asset snapshots"
  ON public.asset_health_snapshots
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.vrm_devices vd
      JOIN public.device_assignments ud ON ud.device_id = vd.id
      WHERE vd.id = asset_health_snapshots.vrm_device_id
        AND ud.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins see all asset snapshots" ON public.asset_health_snapshots;
CREATE POLICY "Admins see all asset snapshots"
  ON public.asset_health_snapshots
  FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "Users see assigned asset incidents" ON public.asset_incidents;
CREATE POLICY "Users see assigned asset incidents"
  ON public.asset_incidents
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.vrm_devices vd
      JOIN public.device_assignments ud ON ud.device_id = vd.id
      WHERE vd.id = asset_incidents.vrm_device_id
        AND ud.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins see all asset incidents" ON public.asset_incidents;
CREATE POLICY "Admins see all asset incidents"
  ON public.asset_incidents
  FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "Users see assigned telemetry policies" ON public.telemetry_collection_policies;
CREATE POLICY "Users see assigned telemetry policies"
  ON public.telemetry_collection_policies
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.vrm_devices vd
      JOIN public.device_assignments ud ON ud.device_id = vd.id
      WHERE vd.id = telemetry_collection_policies.vrm_device_id
        AND ud.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins see all telemetry policies" ON public.telemetry_collection_policies;
CREATE POLICY "Admins see all telemetry policies"
  ON public.telemetry_collection_policies
  FOR SELECT
  USING (public.is_admin());

REVOKE INSERT, UPDATE, DELETE ON public.asset_health_snapshots FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.asset_incidents FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.telemetry_collection_policies FROM anon, authenticated;

GRANT SELECT ON public.asset_health_snapshots TO authenticated;
GRANT SELECT ON public.asset_incidents TO authenticated;
GRANT SELECT ON public.telemetry_collection_policies TO authenticated;
