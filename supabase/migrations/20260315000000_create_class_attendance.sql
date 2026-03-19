-- Per-session attendance tracking.
-- Teachers mark each enrolled student as present / late / absent for a given class date.
-- RLS: teachers write their own classes; students read their own records; admins see all.

CREATE TABLE IF NOT EXISTS class_attendance (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id    UUID NOT NULL REFERENCES classes(id)   ON DELETE CASCADE,
  student_id  UUID NOT NULL REFERENCES profiles(id)  ON DELETE CASCADE,
  date        DATE NOT NULL,
  status      TEXT NOT NULL CHECK (status IN ('present', 'absent', 'late')),
  recorded_by UUID REFERENCES profiles(id),
  created_at  TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
  updated_at  TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE(class_id, student_id, date)
);

CREATE INDEX IF NOT EXISTS idx_ca_class_date ON class_attendance(class_id, date);
CREATE INDEX IF NOT EXISTS idx_ca_student    ON class_attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_ca_date       ON class_attendance(date);

ALTER TABLE class_attendance ENABLE ROW LEVEL SECURITY;

-- Grant permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON class_attendance TO authenticated;

DROP POLICY IF EXISTS "ca_select" ON class_attendance;
DROP POLICY IF EXISTS "ca_insert" ON class_attendance;
DROP POLICY IF EXISTS "ca_update" ON class_attendance;
DROP POLICY IF EXISTS "ca_delete" ON class_attendance;

-- Students see their own; teachers see their classes; admins see all
CREATE POLICY "ca_select" ON class_attendance FOR SELECT
  USING (
    student_id = auth.uid()
    OR (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'teacher')
  );

-- Only teachers (for their own classes) and admins can INSERT
CREATE POLICY "ca_insert" ON class_attendance FOR INSERT
  WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    OR EXISTS (
      SELECT 1 FROM classes
      WHERE classes.id = class_attendance.class_id
        AND classes.teacher_id = auth.uid()
    )
  );

-- Only teachers (for their own classes) and admins can UPDATE
CREATE POLICY "ca_update" ON class_attendance FOR UPDATE
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    OR EXISTS (
      SELECT 1 FROM classes
      WHERE classes.id = class_attendance.class_id
        AND classes.teacher_id = auth.uid()
    )
  )
  WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    OR EXISTS (
      SELECT 1 FROM classes
      WHERE classes.id = class_attendance.class_id
        AND classes.teacher_id = auth.uid()
    )
  );

-- Only admins can DELETE
CREATE POLICY "ca_delete" ON class_attendance FOR DELETE
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

NOTIFY pgrst, 'reload schema';
