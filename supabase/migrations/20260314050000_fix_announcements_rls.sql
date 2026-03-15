-- Fix RLS on announcements table.
-- The table had RLS enabled but no INSERT policy for teachers/admins,
-- causing "new row violates row-level security policy" on create.

DROP POLICY IF EXISTS "staff_can_insert_announcements"         ON announcements;
DROP POLICY IF EXISTS "authenticated_can_select_announcements" ON announcements;
DROP POLICY IF EXISTS "staff_can_update_announcements"         ON announcements;
DROP POLICY IF EXISTS "staff_can_delete_announcements"         ON announcements;

-- Anyone authenticated can read active announcements
CREATE POLICY "authenticated_can_select_announcements"
  ON announcements FOR SELECT
  USING (is_active = true);

-- Admins and teachers can create announcements (must set themselves as author)
CREATE POLICY "staff_can_insert_announcements"
  ON announcements FOR INSERT
  WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'teacher')
    AND author_id = auth.uid()
  );

-- Admins and the original author can update
CREATE POLICY "staff_can_update_announcements"
  ON announcements FOR UPDATE
  USING (
    author_id = auth.uid()
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  )
  WITH CHECK (
    author_id = auth.uid()
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- Admins and the original author can delete
CREATE POLICY "staff_can_delete_announcements"
  ON announcements FOR DELETE
  USING (
    author_id = auth.uid()
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

NOTIFY pgrst, 'reload schema';
