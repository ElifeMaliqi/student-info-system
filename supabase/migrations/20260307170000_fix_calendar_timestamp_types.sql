/*
  # Fix calendar_events timestamp column types

  start_time and end_time were created as type 'time' instead of 'timestamptz'.
  ALTER COLUMN ... TYPE fixes the existing columns in-place, preserving data.
*/

-- Cannot cast time → timestamptz directly; drop and re-add with correct type.
-- Safe because no real event data exists yet.
ALTER TABLE calendar_events
  DROP COLUMN start_time,
  DROP COLUMN end_time;

ALTER TABLE calendar_events
  ADD COLUMN start_time timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN end_time   timestamptz NOT NULL DEFAULT now();

NOTIFY pgrst, 'reload schema';
