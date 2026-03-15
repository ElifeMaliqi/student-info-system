-- Students were unable to see their class events on the calendar because the
-- `classes` table had no SELECT policy for the student role.
-- When Supabase tried to join class_enrollments → classes, the classes rows
-- came back as null (blocked by RLS), and .filter(Boolean) silently dropped them.
--
-- This adds a policy letting students read any class they are enrolled in.
-- There is no RLS recursion risk: class_enrollments SELECT policy only checks
-- student_id = auth.uid() and does not reference the classes table.

DROP POLICY IF EXISTS "students_can_select_enrolled_classes" ON classes;

CREATE POLICY "students_can_select_enrolled_classes"
  ON classes FOR SELECT
  USING (
    id IN (
      SELECT class_id FROM class_enrollments WHERE student_id = auth.uid()
    )
  );

NOTIFY pgrst, 'reload schema';
