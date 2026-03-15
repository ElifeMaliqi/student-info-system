-- Add class_id to announcements for class-specific targeting.
-- Also extends the audience check constraint to include 'class_specific'.

-- 1. Add the class_id column
ALTER TABLE announcements
  ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES classes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_announcements_class_id ON announcements(class_id);

-- 2. Replace the audience check constraint to include 'class_specific'
ALTER TABLE announcements DROP CONSTRAINT IF EXISTS announcements_audience_check;

ALTER TABLE announcements
  ADD CONSTRAINT announcements_audience_check
  CHECK (audience IN ('all', 'students', 'teachers', 'admins', 'program_specific', 'class_specific'));

NOTIFY pgrst, 'reload schema';
