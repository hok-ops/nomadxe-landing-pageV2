-- Migration 006: Add display_name to vrm_devices
--
-- Allows dashboard users to set a custom label for their trailer
-- without modifying the name stored in Victron VRM.
-- Falls back to the VRM `name` column when display_name is NULL.
--
-- Run in Supabase SQL Editor.

ALTER TABLE public.vrm_devices
  ADD COLUMN IF NOT EXISTS display_name text;

COMMENT ON COLUMN public.vrm_devices.display_name IS
  'Optional user-facing label for this device. When set, shown in the dashboard instead of the VRM name. Does not affect Victron VRM.';
