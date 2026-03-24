-- Add teacher note per entry (optional feedback to student)
ALTER TABLE grade_table_entries ADD COLUMN IF NOT EXISTS note text;

-- Add degree (program name) to grade tables
ALTER TABLE grade_tables ADD COLUMN IF NOT EXISTS degree text;
