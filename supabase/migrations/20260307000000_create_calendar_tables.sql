/*
  # Create Calendar Tables

  1. New Tables
    - `calendar_events`
      - id, title, description, start_time, end_time, all_day, color, event_type, created_by
    - `calendar_event_participants`
      - id, event_id, user_id (links users to events they can see)

  2. Security – Row Level Security
    - Users can only SELECT events they created or are participants of
    - Only creators can UPDATE/DELETE their events
    - Only event creators can INSERT/DELETE participants

  3. Trigger
    - auto-update updated_at on calendar_events
*/

-- ── Tables ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS calendar_events (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text        NOT NULL,
  description text,
  start_time  timestamptz NOT NULL,
  end_time    timestamptz NOT NULL,
  all_day     boolean     NOT NULL DEFAULT false,
  color       text        NOT NULL DEFAULT '#fc0ce4',
  event_type  text        NOT NULL DEFAULT 'meeting'
                CHECK (event_type IN ('meeting', 'class', 'personal', 'holiday')),
  created_by  uuid        REFERENCES profiles(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS calendar_event_participants (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   uuid        NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES profiles(id)        ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

-- ── Indexes ────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_calendar_events_created_by  ON calendar_events (created_by);
CREATE INDEX IF NOT EXISTS idx_calendar_events_time_range  ON calendar_events (start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_cal_participants_user_id    ON calendar_event_participants (user_id);
CREATE INDEX IF NOT EXISTS idx_cal_participants_event_id   ON calendar_event_participants (event_id);

-- ── Row Level Security ─────────────────────────────────────────────────────────

ALTER TABLE calendar_events             ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_event_participants ENABLE ROW LEVEL SECURITY;

-- calendar_events: SELECT
CREATE POLICY "Select own or invited events"
  ON calendar_events FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR id IN (
      SELECT event_id FROM calendar_event_participants WHERE user_id = auth.uid()
    )
  );

-- calendar_events: INSERT
CREATE POLICY "Create own events"
  ON calendar_events FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

-- calendar_events: UPDATE
CREATE POLICY "Update own events"
  ON calendar_events FOR UPDATE TO authenticated
  USING    (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- calendar_events: DELETE
CREATE POLICY "Delete own events"
  ON calendar_events FOR DELETE TO authenticated
  USING (created_by = auth.uid());

-- calendar_event_participants: SELECT
CREATE POLICY "View participant records"
  ON calendar_event_participants FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR event_id IN (SELECT id FROM calendar_events WHERE created_by = auth.uid())
  );

-- calendar_event_participants: INSERT (only event creator)
CREATE POLICY "Event creator adds participants"
  ON calendar_event_participants FOR INSERT TO authenticated
  WITH CHECK (
    event_id IN (SELECT id FROM calendar_events WHERE created_by = auth.uid())
  );

-- calendar_event_participants: DELETE (only event creator)
CREATE POLICY "Event creator removes participants"
  ON calendar_event_participants FOR DELETE TO authenticated
  USING (
    event_id IN (SELECT id FROM calendar_events WHERE created_by = auth.uid())
  );

-- ── updated_at trigger ────────────────────────────────────────────────────────

CREATE TRIGGER update_calendar_events_updated_at
  BEFORE UPDATE ON calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
