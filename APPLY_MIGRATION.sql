-- Run this SQL in your Supabase dashboard (SQL Editor)
-- Go to: https://supabase.com/dashboard → Your Project → SQL Editor → New Query
-- Then paste this entire script and click "Run"

-- Create classes table
CREATE TABLE IF NOT EXISTS classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id TEXT NOT NULL,
  title TEXT NOT NULL,
  teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc',now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc',now()),
  CONSTRAINT valid_program CHECK (program_id IN (
    'Web Development',
    'Digital Marketing with AI',
    'UI/UX Creative Designer',
    'Internet of Things (UAV/IoT)',
    'UAV Engineering Degree',
    'Cybersecurity',
    '3D Creative Artist',
    'Entrepreneurship'
  ))
);

-- Create class sessions table
CREATE TABLE IF NOT EXISTS class_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc',now()),
  CONSTRAINT valid_times CHECK (end_time > start_time)
);

-- Create class enrollments table
CREATE TABLE IF NOT EXISTS class_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc',now()),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'dropped', 'completed')),
  UNIQUE(class_id, student_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_classes_program_id ON classes(program_id);
CREATE INDEX IF NOT EXISTS idx_classes_teacher_id ON classes(teacher_id);
CREATE INDEX IF NOT EXISTS idx_class_sessions_class_id ON class_sessions(class_id);
CREATE INDEX IF NOT EXISTS idx_class_enrollments_class_id ON class_enrollments(class_id);
CREATE INDEX IF NOT EXISTS idx_class_enrollments_student_id ON class_enrollments(student_id);

-- Enable RLS
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_enrollments ENABLE ROW LEVEL SECURITY;

-- Drop old policies if they exist
DROP POLICY IF EXISTS "admins_can_select_classes" ON classes;
DROP POLICY IF EXISTS "admins_can_insert_classes" ON classes;
DROP POLICY IF EXISTS "admins_can_update_classes" ON classes;
DROP POLICY IF EXISTS "admins_can_delete_classes" ON classes;
DROP POLICY IF EXISTS "teachers_can_select_their_classes" ON classes;
DROP POLICY IF EXISTS "students_can_select_enrolled_classes" ON classes;
DROP POLICY IF EXISTS "anyone_can_select_class_sessions" ON class_sessions;
DROP POLICY IF EXISTS "admins_can_insert_class_sessions" ON class_sessions;
DROP POLICY IF EXISTS "admins_can_delete_class_sessions" ON class_sessions;
DROP POLICY IF EXISTS "admins_can_select_enrollments" ON class_enrollments;
DROP POLICY IF EXISTS "admins_can_insert_enrollments" ON class_enrollments;
DROP POLICY IF EXISTS "admins_can_update_enrollments" ON class_enrollments;
DROP POLICY IF EXISTS "admins_can_delete_enrollments" ON class_enrollments;

-- Classes RLS Policies
CREATE POLICY "admins_can_select_classes"
  ON classes FOR SELECT
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "admins_can_insert_classes"
  ON classes FOR INSERT
  WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "admins_can_update_classes"
  ON classes FOR UPDATE
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin')
  WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "admins_can_delete_classes"
  ON classes FOR DELETE
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "teachers_can_select_their_classes"
  ON classes FOR SELECT
  USING (teacher_id = auth.uid());

-- Students can read classes they are enrolled in (needed for calendar class events)
CREATE POLICY "students_can_select_enrolled_classes"
  ON classes FOR SELECT
  USING (
    id IN (
      SELECT class_id FROM class_enrollments WHERE student_id = auth.uid()
    )
  );

-- Class Sessions RLS Policies
CREATE POLICY "anyone_can_select_class_sessions"
  ON class_sessions FOR SELECT
  USING (true);

CREATE POLICY "admins_can_insert_class_sessions"
  ON class_sessions FOR INSERT
  WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "admins_can_delete_class_sessions"
  ON class_sessions FOR DELETE
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- Class Enrollments RLS Policies
CREATE POLICY "admins_can_select_enrollments"
  ON class_enrollments FOR SELECT
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin' OR student_id = auth.uid());

CREATE POLICY "admins_can_insert_enrollments"
  ON class_enrollments FOR INSERT
  WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "admins_can_update_enrollments"
  ON class_enrollments FOR UPDATE
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin')
  WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "admins_can_delete_enrollments"
  ON class_enrollments FOR DELETE
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- Notify Supabase to reload the schema cache
NOTIFY pgrst, 'reload schema';
