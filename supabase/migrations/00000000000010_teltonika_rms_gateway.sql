ALTER TABLE public.vrm_devices
  ADD COLUMN IF NOT EXISTS teltonika_rms_device_id TEXT;

COMMENT ON COLUMN public.vrm_devices.teltonika_rms_device_id IS
  'Teltonika RMS device ID used for one-click modem WebUI access through the /access/device/[id] gateway.';

CREATE INDEX IF NOT EXISTS idx_vrm_devices_teltonika_rms_device_id
  ON public.vrm_devices (teltonika_rms_device_id)
  WHERE teltonika_rms_device_id IS NOT NULL;
