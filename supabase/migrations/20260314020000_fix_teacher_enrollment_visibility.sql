-- Allow teachers to SELECT enrollments in their own classes.
-- Without this, the nested join in getClassStudents returns empty arrays
-- because the existing policy only covers admins and the student themselves.

DROP POLICY IF EXISTS "teachers_can_select_enrollments_in_their_classes" ON class_enrollments;

CREATE POLICY "teachers_can_select_enrollments_in_their_classes"
  ON class_enrollments FOR SELECT
  USING (
    class_id IN (
      SELECT id FROM classes WHERE teacher_id = auth.uid()
    )
  );

NOTIFY pgrst, 'reload schema';
