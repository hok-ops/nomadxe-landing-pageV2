-- Free-plan retention guardrails.
-- This function is intentionally not granted to browser roles. Run it from a
-- service-role server route, SQL editor, or a trusted maintenance process.

CREATE OR REPLACE FUNCTION public.prune_free_plan_operational_data(
  form_submission_days INTEGER DEFAULT 365,
  cellular_report_days INTEGER DEFAULT 180,
  discovery_days INTEGER DEFAULT 180,
  network_event_days INTEGER DEFAULT 180,
  daily_report_days INTEGER DEFAULT 365
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_forms INTEGER := 0;
  deleted_cellular INTEGER := 0;
  deleted_discoveries INTEGER := 0;
  deleted_events INTEGER := 0;
  deleted_reports INTEGER := 0;
BEGIN
  DELETE FROM public.public_form_submissions
  WHERE status IN ('closed', 'spam')
    AND created_at < timezone('utc', now()) - make_interval(days => GREATEST(form_submission_days, 30));
  GET DIAGNOSTICS deleted_forms = ROW_COUNT;

  DELETE FROM public.cellular_signal_reports
  WHERE observed_at < timezone('utc', now()) - make_interval(days => GREATEST(cellular_report_days, 30));
  GET DIAGNOSTICS deleted_cellular = ROW_COUNT;

  DELETE FROM public.discovered_network_devices
  WHERE is_ignored = true
    AND last_seen_at < timezone('utc', now()) - make_interval(days => GREATEST(discovery_days, 30));
  GET DIAGNOSTICS deleted_discoveries = ROW_COUNT;

  DELETE FROM public.managed_network_device_events
  WHERE observed_at < timezone('utc', now()) - make_interval(days => GREATEST(network_event_days, 30));
  GET DIAGNOSTICS deleted_events = ROW_COUNT;

  DELETE FROM public.daily_intelligence_reports
  WHERE report_date < (timezone('utc', now())::date - GREATEST(daily_report_days, 90));
  GET DIAGNOSTICS deleted_reports = ROW_COUNT;

  RETURN jsonb_build_object(
    'deletedForms', deleted_forms,
    'deletedCellularReports', deleted_cellular,
    'deletedIgnoredDiscoveries', deleted_discoveries,
    'deletedNetworkEvents', deleted_events,
    'deletedDailyReports', deleted_reports
  );
END;
$$;

COMMENT ON FUNCTION public.prune_free_plan_operational_data(INTEGER, INTEGER, INTEGER, INTEGER, INTEGER) IS
  'Service-role maintenance helper for Supabase free-plan storage pressure. Keeps durable operational data but prunes old low-value records.';

REVOKE ALL ON FUNCTION public.prune_free_plan_operational_data(INTEGER, INTEGER, INTEGER, INTEGER, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.prune_free_plan_operational_data(INTEGER, INTEGER, INTEGER, INTEGER, INTEGER) FROM anon;
REVOKE ALL ON FUNCTION public.prune_free_plan_operational_data(INTEGER, INTEGER, INTEGER, INTEGER, INTEGER) FROM authenticated;
