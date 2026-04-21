-- Migration: enforce one assignment per (user, device) pair
-- This is a data-integrity guarantee at the database level.
-- The API route already handles 23505 → 409, so adding this
-- constraint makes the existing error path the authoritative guard.

-- First, remove any duplicate rows that already exist in the table,
-- keeping only the row with the lowest id for each (user_id, device_id) pair.
DELETE FROM device_assignments
WHERE id NOT IN (
  SELECT MIN(id)
  FROM device_assignments
  GROUP BY user_id, device_id
);

-- Now that duplicates are gone, add the UNIQUE constraint.
ALTER TABLE device_assignments
  ADD CONSTRAINT device_assignments_user_device_unique
  UNIQUE (user_id, device_id);
