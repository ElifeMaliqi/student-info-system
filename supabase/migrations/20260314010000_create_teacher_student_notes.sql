-- Teacher private notes on individual students.
-- One note per (teacher, student) pair.
-- RLS ensures only the authoring teacher can read or write their own notes.

CREATE TABLE IF NOT EXISTS teacher_student_notes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  note       TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', now()),
  UNIQUE(teacher_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_teacher_student_notes_teacher ON teacher_student_notes(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_student_notes_student ON teacher_student_notes(student_id);

ALTER TABLE teacher_student_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "teacher_owns_notes"   ON teacher_student_notes;
DROP POLICY IF EXISTS "teacher_notes_select" ON teacher_student_notes;
DROP POLICY IF EXISTS "teacher_notes_insert" ON teacher_student_notes;
DROP POLICY IF EXISTS "teacher_notes_update" ON teacher_student_notes;

-- Separate policies per operation so upsert (INSERT + UPDATE) works correctly
CREATE POLICY "teacher_notes_select"
  ON teacher_student_notes FOR SELECT
  USING (teacher_id = auth.uid());

CREATE POLICY "teacher_notes_insert"
  ON teacher_student_notes FOR INSERT
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "teacher_notes_update"
  ON teacher_student_notes FOR UPDATE
  USING     (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

NOTIFY pgrst, 'reload schema';
