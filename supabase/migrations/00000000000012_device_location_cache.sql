ALTER TABLE public.vrm_devices
  ADD COLUMN IF NOT EXISTS location_label TEXT,
  ADD COLUMN IF NOT EXISTS location_geocode_key TEXT,
  ADD COLUMN IF NOT EXISTS location_updated_at TIMESTAMPTZ;

COMMENT ON COLUMN public.vrm_devices.location_label IS
  'Cached reverse-geocoded city/state/zip label for the device dashboard tile.';

COMMENT ON COLUMN public.vrm_devices.location_geocode_key IS
  'Rounded lat/lon cache key (3 decimal places) used to determine when the stored location label is stale.';

COMMENT ON COLUMN public.vrm_devices.location_updated_at IS
  'Timestamp of the last successful or attempted location cache refresh.';

CREATE INDEX IF NOT EXISTS idx_vrm_devices_location_geocode_key
  ON public.vrm_devices (location_geocode_key)
  WHERE location_geocode_key IS NOT NULL;
