-- Fix: Add WITH CHECK clause to grade_table_entries UPDATE policy
-- This was blocking all updates because WITH CHECK defaults to false
DROP POLICY IF EXISTS "Authenticated users can update grade_table_entries" ON grade_table_entries;

CREATE POLICY "Authenticated users can update grade_table_entries"
  ON grade_table_entries FOR UPDATE TO authenticated 
  USING (true) 
  WITH CHECK (true);
