-- ############################################################################
-- MIGRATION 015: Historical intelligence and recommendation ledger
-- Stores generated lease intelligence reports, customer-visible recommendations,
-- partner monitoring evidence, site-boundary checks, and firmware/configuration
-- advisories. Browser clients can read assigned rows through RLS; writes remain
-- service-role/server controlled.
-- ############################################################################

CREATE TABLE IF NOT EXISTS public.daily_intelligence_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id UUID REFERENCES public.customer_leases(id) ON DELETE SET NULL,
  vrm_device_id INTEGER NOT NULL REFERENCES public.vrm_devices(id) ON DELETE CASCADE,
  report_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'generated'
    CHECK (status IN ('generated', 'partial', 'needs_review')),
  generated_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  source_window_start TIMESTAMPTZ NOT NULL,
  source_window_end TIMESTAMPTZ NOT NULL,
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (vrm_device_id, report_date)
);

CREATE TABLE IF NOT EXISTS public.intelligence_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id UUID REFERENCES public.customer_leases(id) ON DELETE SET NULL,
  vrm_device_id INTEGER NOT NULL REFERENCES public.vrm_devices(id) ON DELETE CASCADE,
  report_id UUID REFERENCES public.daily_intelligence_reports(id) ON DELETE SET NULL,
  category TEXT NOT NULL CHECK (category IN (
    'power',
    'visibility',
    'alarm_coverage',
    'service',
    'geofence',
    'firmware',
    'monitoring',
    'efficiency'
  )),
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'watch', 'action', 'critical')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'accepted', 'dismissed', 'completed')),
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  action TEXT NOT NULL,
  confidence INTEGER NOT NULL DEFAULT 50 CHECK (confidence BETWEEN 0 AND 100),
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.monitoring_partner_events (
  id BIGSERIAL PRIMARY KEY,
  lease_id UUID REFERENCES public.customer_leases(id) ON DELETE SET NULL,
  vrm_device_id INTEGER REFERENCES public.vrm_devices(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'watch', 'action', 'critical')),
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.site_boundary_checks (
  id BIGSERIAL PRIMARY KEY,
  lease_id UUID REFERENCES public.customer_leases(id) ON DELETE SET NULL,
  vrm_device_id INTEGER NOT NULL REFERENCES public.vrm_devices(id) ON DELETE CASCADE,
  expected_lat DOUBLE PRECISION,
  expected_lon DOUBLE PRECISION,
  actual_lat DOUBLE PRECISION,
  actual_lon DOUBLE PRECISION,
  distance_m INTEGER,
  status TEXT NOT NULL DEFAULT 'unknown' CHECK (status IN ('unknown', 'inside', 'watch', 'outside')),
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.firmware_config_advisories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vrm_device_id INTEGER NOT NULL REFERENCES public.vrm_devices(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  firmware_version TEXT,
  advisory_type TEXT NOT NULL CHECK (advisory_type IN ('inventory', 'unknown_version', 'drift', 'manual_review')),
  severity TEXT NOT NULL DEFAULT 'watch' CHECK (severity IN ('info', 'watch', 'action', 'critical')),
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'accepted', 'dismissed', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_daily_intelligence_reports_device_date
  ON public.daily_intelligence_reports (vrm_device_id, report_date DESC);

CREATE INDEX IF NOT EXISTS idx_daily_intelligence_reports_lease_date
  ON public.daily_intelligence_reports (lease_id, report_date DESC)
  WHERE lease_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_intelligence_recommendations_device_status
  ON public.intelligence_recommendations (vrm_device_id, status, severity, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_monitoring_partner_events_device_time
  ON public.monitoring_partner_events (vrm_device_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_site_boundary_checks_device_time
  ON public.site_boundary_checks (vrm_device_id, checked_at DESC);

CREATE INDEX IF NOT EXISTS idx_firmware_config_advisories_device_status
  ON public.firmware_config_advisories (vrm_device_id, status, created_at DESC);

ALTER TABLE public.daily_intelligence_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intelligence_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monitoring_partner_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_boundary_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.firmware_config_advisories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see assigned daily intelligence reports" ON public.daily_intelligence_reports;
CREATE POLICY "Users see assigned daily intelligence reports"
  ON public.daily_intelligence_reports
  FOR SELECT
  USING (
    public.user_can_access_vrm_device(vrm_device_id)
    OR (lease_id IS NOT NULL AND public.user_can_access_lease(lease_id))
  );

DROP POLICY IF EXISTS "Users see assigned intelligence recommendations" ON public.intelligence_recommendations;
CREATE POLICY "Users see assigned intelligence recommendations"
  ON public.intelligence_recommendations
  FOR SELECT
  USING (
    public.user_can_access_vrm_device(vrm_device_id)
    OR (lease_id IS NOT NULL AND public.user_can_access_lease(lease_id))
  );

DROP POLICY IF EXISTS "Users see assigned partner monitoring events" ON public.monitoring_partner_events;
CREATE POLICY "Users see assigned partner monitoring events"
  ON public.monitoring_partner_events
  FOR SELECT
  USING (
    (vrm_device_id IS NOT NULL AND public.user_can_access_vrm_device(vrm_device_id))
    OR (lease_id IS NOT NULL AND public.user_can_access_lease(lease_id))
  );

DROP POLICY IF EXISTS "Users see assigned site boundary checks" ON public.site_boundary_checks;
CREATE POLICY "Users see assigned site boundary checks"
  ON public.site_boundary_checks
  FOR SELECT
  USING (
    public.user_can_access_vrm_device(vrm_device_id)
    OR (lease_id IS NOT NULL AND public.user_can_access_lease(lease_id))
  );

DROP POLICY IF EXISTS "Users see assigned firmware advisories" ON public.firmware_config_advisories;
CREATE POLICY "Users see assigned firmware advisories"
  ON public.firmware_config_advisories
  FOR SELECT
  USING (public.user_can_access_vrm_device(vrm_device_id));

REVOKE INSERT, UPDATE, DELETE ON public.daily_intelligence_reports FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.intelligence_recommendations FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.monitoring_partner_events FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.site_boundary_checks FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.firmware_config_advisories FROM anon, authenticated;

GRANT SELECT ON public.daily_intelligence_reports TO authenticated;
GRANT SELECT ON public.intelligence_recommendations TO authenticated;
GRANT SELECT ON public.monitoring_partner_events TO authenticated;
GRANT SELECT ON public.site_boundary_checks TO authenticated;
GRANT SELECT ON public.firmware_config_advisories TO authenticated;
