/*
  # Add missing columns to calendar_events

  The calendar_events table may have been created before the all_day and
  other columns were added to the schema. This migration safely adds any
  missing columns using ALTER TABLE ... ADD COLUMN IF NOT EXISTS.
*/

ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS all_day     boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS color       text        NOT NULL DEFAULT '#fc0ce4',
  ADD COLUMN IF NOT EXISTS event_type  text        NOT NULL DEFAULT 'meeting',
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS updated_at  timestamptz NOT NULL DEFAULT now();

-- Add the check constraint for event_type if it doesn't already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'calendar_events'
      AND constraint_name = 'calendar_events_event_type_check'
  ) THEN
    ALTER TABLE calendar_events
      ADD CONSTRAINT calendar_events_event_type_check
      CHECK (event_type IN ('meeting', 'class', 'personal', 'holiday'));
  END IF;
END $$;

-- Notify PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema';
