-- Grade tables: each represents a final-project grading session created by a teacher
CREATE TABLE IF NOT EXISTS grade_tables (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  class_id    uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  teacher_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  degree      text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Individual student entries inside a grade table
CREATE TABLE IF NOT EXISTS grade_table_entries (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grade_table_id  uuid NOT NULL REFERENCES grade_tables(id) ON DELETE CASCADE,
  student_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  total_points    numeric,
  passed          boolean,
  note            text,
  graded_at       timestamptz,
  graded_by       uuid REFERENCES profiles(id),
  created_at      timestamptz NOT NULL DEFAULT now(),

  UNIQUE(grade_table_id, student_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_grade_tables_teacher  ON grade_tables(teacher_id);
CREATE INDEX IF NOT EXISTS idx_grade_tables_class    ON grade_tables(class_id);
CREATE INDEX IF NOT EXISTS idx_grade_entries_table    ON grade_table_entries(grade_table_id);
CREATE INDEX IF NOT EXISTS idx_grade_entries_student  ON grade_table_entries(student_id);

-- RLS
ALTER TABLE grade_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE grade_table_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read grade_tables" ON grade_tables;
CREATE POLICY "Authenticated users can read grade_tables"
  ON grade_tables FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Teachers can insert their own grade_tables" ON grade_tables;
CREATE POLICY "Teachers can insert their own grade_tables"
  ON grade_tables FOR INSERT TO authenticated
  WITH CHECK (teacher_id = auth.uid());

DROP POLICY IF EXISTS "Teachers can delete their own grade_tables" ON grade_tables;
CREATE POLICY "Teachers can delete their own grade_tables"
  ON grade_tables FOR DELETE TO authenticated
  USING (teacher_id = auth.uid());

DROP POLICY IF EXISTS "Authenticated users can read grade_table_entries" ON grade_table_entries;
CREATE POLICY "Authenticated users can read grade_table_entries"
  ON grade_table_entries FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert grade_table_entries" ON grade_table_entries;
CREATE POLICY "Authenticated users can insert grade_table_entries"
  ON grade_table_entries FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update grade_table_entries" ON grade_table_entries;
CREATE POLICY "Authenticated users can update grade_table_entries"
  ON grade_table_entries FOR UPDATE TO authenticated USING (true);
