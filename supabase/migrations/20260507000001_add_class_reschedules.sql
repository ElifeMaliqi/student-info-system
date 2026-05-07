-- ─────────────────────────────────────────────────────────────────
-- class_reschedules: stores per-occurrence overrides for class sessions
-- A row represents one specific occurrence (class + original date) that has
-- been either CANCELLED (new_date IS NULL) or RESCHEDULED (new_date IS NOT NULL).
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS class_reschedules (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  class_id        uuid        NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  session_id      uuid        REFERENCES class_sessions(id) ON DELETE SET NULL,
  original_date   date        NOT NULL,
  new_date        date,
  new_start_time  time,
  new_end_time    time,
  reason          text,
  created_by      uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      timestamptz DEFAULT now(),

  -- Only one override per class per original occurrence date
  UNIQUE (class_id, original_date)
);

CREATE INDEX IF NOT EXISTS idx_class_reschedules_class_id
  ON class_reschedules (class_id);

CREATE INDEX IF NOT EXISTS idx_class_reschedules_original_date
  ON class_reschedules (original_date);

CREATE INDEX IF NOT EXISTS idx_class_reschedules_new_date
  ON class_reschedules (new_date);

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE class_reschedules ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "admins_can_select_reschedules"
  ON class_reschedules FOR SELECT
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "admins_can_insert_reschedules"
  ON class_reschedules FOR INSERT
  WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "admins_can_update_reschedules"
  ON class_reschedules FOR UPDATE
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin')
  WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "admins_can_delete_reschedules"
  ON class_reschedules FOR DELETE
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- Teachers can read reschedules for their own classes
CREATE POLICY "teachers_can_select_their_reschedules"
  ON class_reschedules FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM classes
      WHERE classes.id = class_reschedules.class_id
        AND classes.teacher_id = auth.uid()
    )
  );
