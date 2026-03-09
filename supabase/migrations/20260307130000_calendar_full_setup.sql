/*
  # Calendar full setup (consolidated)

  Safely creates everything needed for the calendar feature in one shot:
  1. Ensures calendar_events has all required columns
  2. Creates calendar_event_participants if it doesn't exist
  3. Enables RLS on both tables
  4. Creates a SECURITY DEFINER helper to avoid RLS recursion
  5. Creates all RLS policies (drops first to avoid duplicates)
  6. Creates the updated_at trigger
  7. Fixes profiles RLS for participant/email lookup
*/

-- ── 1. Add missing columns to calendar_events ─────────────────────────────────

ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS all_day     boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS color       text        NOT NULL DEFAULT '#fc0ce4',
  ADD COLUMN IF NOT EXISTS event_type  text        NOT NULL DEFAULT 'meeting',
  ADD COLUMN IF NOT EXISTS updated_at  timestamptz NOT NULL DEFAULT now();

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

-- ── 2. Create calendar_event_participants ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS calendar_event_participants (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   uuid        NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES profiles(id)        ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_cal_participants_user_id  ON calendar_event_participants (user_id);
CREATE INDEX IF NOT EXISTS idx_cal_participants_event_id ON calendar_event_participants (event_id);

-- ── 3. Enable RLS ──────────────────────────────────────────────────────────────

ALTER TABLE calendar_events             ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_event_participants ENABLE ROW LEVEL SECURITY;

-- ── 4. SECURITY DEFINER helper (breaks the recursive RLS cycle) ────────────────

CREATE OR REPLACE FUNCTION is_calendar_event_creator(p_event_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM calendar_events
    WHERE id = p_event_id AND created_by = auth.uid()
  );
$$;

-- ── 5. calendar_events RLS policies ───────────────────────────────────────────

DROP POLICY IF EXISTS "Select own or invited events" ON calendar_events;
DROP POLICY IF EXISTS "Create own events"            ON calendar_events;
DROP POLICY IF EXISTS "Update own events"            ON calendar_events;
DROP POLICY IF EXISTS "Delete own events"            ON calendar_events;

CREATE POLICY "Select own or invited events"
  ON calendar_events FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR id IN (
      SELECT event_id FROM calendar_event_participants WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Create own events"
  ON calendar_events FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Update own events"
  ON calendar_events FOR UPDATE TO authenticated
  USING     (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Delete own events"
  ON calendar_events FOR DELETE TO authenticated
  USING (created_by = auth.uid());

-- ── 6. calendar_event_participants RLS policies (using helper, no recursion) ───

DROP POLICY IF EXISTS "View participant records"          ON calendar_event_participants;
DROP POLICY IF EXISTS "Event creator adds participants"   ON calendar_event_participants;
DROP POLICY IF EXISTS "Event creator removes participants" ON calendar_event_participants;

CREATE POLICY "View participant records"
  ON calendar_event_participants FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR is_calendar_event_creator(event_id)
  );

CREATE POLICY "Event creator adds participants"
  ON calendar_event_participants FOR INSERT TO authenticated
  WITH CHECK (is_calendar_event_creator(event_id));

CREATE POLICY "Event creator removes participants"
  ON calendar_event_participants FOR DELETE TO authenticated
  USING (is_calendar_event_creator(event_id));

-- ── 7. updated_at trigger ─────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS update_calendar_events_updated_at ON calendar_events;

CREATE TRIGGER update_calendar_events_updated_at
  BEFORE UPDATE ON calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ── 8. Fix profiles RLS so email lookup and audience presets work ──────────────

DROP POLICY IF EXISTS "Users can view their own profile"          ON profiles;
DROP POLICY IF EXISTS "Users can view own profile"                ON profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone"  ON profiles;
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON profiles;

CREATE POLICY "Authenticated users can view all profiles"
  ON profiles FOR SELECT TO authenticated
  USING (true);

-- ── 9. Reload PostgREST schema cache ──────────────────────────────────────────

NOTIFY pgrst, 'reload schema';
