/*
  # Student Archived Classes

  When a student profile is archived, their class enrollments are removed from
  class_enrollments but preserved here so they can be offered for restoration
  when the student is re-approved.

  Table: student_archived_classes
  - student_id  → profiles(id)
  - class_id    → classes(id)
  - class_title → snapshot of class name at archive time
  - program_id  → snapshot of program at archive time
  - archived_at → when this entry was saved

  Unique constraint on (student_id, class_id) prevents duplicate history rows
  if a student is archived multiple times from the same class.
*/

CREATE TABLE IF NOT EXISTS student_archived_classes (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  class_id    uuid        NOT NULL REFERENCES classes(id)  ON DELETE CASCADE,
  class_title text        NOT NULL,
  program_id  text,
  archived_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(student_id, class_id)
);

CREATE INDEX IF NOT EXISTS idx_student_archived_classes_student_id
  ON student_archived_classes (student_id);

ALTER TABLE student_archived_classes ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "admins_manage_student_archived_classes"
  ON student_archived_classes FOR ALL
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');
