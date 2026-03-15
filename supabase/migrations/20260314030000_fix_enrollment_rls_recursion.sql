-- Fix RLS infinite recursion between classes and class_enrollments.
--
-- The previous teacher enrollment policy used:
--   class_id IN (SELECT id FROM classes WHERE teacher_id = auth.uid())
-- This queries classes through RLS. The classes table has a student visibility
-- policy that in turn queries class_enrollments through RLS, creating a cycle:
--   class_enrollments → classes → class_enrollments → classes → ...
--
-- Fix: use a SECURITY DEFINER function to read classes.id without triggering
-- the classes RLS, breaking the cycle at the classes→class_enrollments boundary.

CREATE OR REPLACE FUNCTION get_teacher_class_ids(p_teacher_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT id FROM classes WHERE teacher_id = p_teacher_id;
$$;

DROP POLICY IF EXISTS "teachers_can_select_enrollments_in_their_classes" ON class_enrollments;

CREATE POLICY "teachers_can_select_enrollments_in_their_classes"
  ON class_enrollments FOR SELECT
  USING (
    class_id IN (SELECT get_teacher_class_ids(auth.uid()))
  );

NOTIFY pgrst, 'reload schema';
