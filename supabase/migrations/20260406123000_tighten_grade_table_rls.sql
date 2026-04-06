/*
  Tighten grade table RLS policies to enforce least privilege.
  - Admins can read/write all grade data.
  - Teachers can manage only grade data for their own grade tables.
  - Students can read only their own grade entries / enrolled class grade tables.
*/

-- Remove permissive legacy policies.
DROP POLICY IF EXISTS "Authenticated users can read grade_tables" ON public.grade_tables;
DROP POLICY IF EXISTS "Teachers can insert their own grade_tables" ON public.grade_tables;
DROP POLICY IF EXISTS "Teachers can delete their own grade_tables" ON public.grade_tables;

DROP POLICY IF EXISTS "Authenticated users can read grade_table_entries" ON public.grade_table_entries;
DROP POLICY IF EXISTS "Authenticated users can insert grade_table_entries" ON public.grade_table_entries;
DROP POLICY IF EXISTS "Authenticated users can update grade_table_entries" ON public.grade_table_entries;

-- Grade table access
CREATE POLICY "grade_tables_select_scoped"
  ON public.grade_tables FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
    OR teacher_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.class_enrollments ce
      WHERE ce.class_id = grade_tables.class_id
        AND ce.student_id = auth.uid()
        AND ce.status = 'active'
    )
  );

CREATE POLICY "grade_tables_insert_scoped"
  ON public.grade_tables FOR INSERT TO authenticated
  WITH CHECK (
    (
      teacher_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role = 'teacher'
      )
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE POLICY "grade_tables_delete_scoped"
  ON public.grade_tables FOR DELETE TO authenticated
  USING (
    teacher_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Grade entry access
CREATE POLICY "grade_entries_select_scoped"
  ON public.grade_table_entries FOR SELECT TO authenticated
  USING (
    student_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
    OR EXISTS (
      SELECT 1
      FROM public.grade_tables gt
      WHERE gt.id = grade_table_entries.grade_table_id
        AND gt.teacher_id = auth.uid()
    )
  );

CREATE POLICY "grade_entries_insert_scoped"
  ON public.grade_table_entries FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
    OR EXISTS (
      SELECT 1
      FROM public.grade_tables gt
      WHERE gt.id = grade_table_entries.grade_table_id
        AND gt.teacher_id = auth.uid()
    )
  );

CREATE POLICY "grade_entries_update_scoped"
  ON public.grade_table_entries FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
    OR EXISTS (
      SELECT 1
      FROM public.grade_tables gt
      WHERE gt.id = grade_table_entries.grade_table_id
        AND gt.teacher_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
    OR EXISTS (
      SELECT 1
      FROM public.grade_tables gt
      WHERE gt.id = grade_table_entries.grade_table_id
        AND gt.teacher_id = auth.uid()
    )
  );

NOTIFY pgrst, 'reload schema';
