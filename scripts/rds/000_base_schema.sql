-- Base schema for RDS (tables that existed in Supabase before tracked migrations)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Roles used by Supabase RLS policies in migrations
DO $$ BEGIN
  CREATE ROLE anon NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE ROLE authenticated NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Programs
CREATE TABLE IF NOT EXISTS programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO programs (name) VALUES
  ('Web Development'),
  ('Digital Marketing with AI'),
  ('UI/UX Creative Designer'),
  ('Internet of Things (UAV/IoT)'),
  ('UAV Engineering Degree'),
  ('Cybersecurity'),
  ('3D Creative Artist'),
  ('Entrepreneurship')
ON CONFLICT (name) DO NOTHING;

-- Profiles (user accounts)
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'teacher', 'student')),
  avatar_url text,
  phone text,
  secondary_phone text,
  location text,
  date_of_birth date,
  address text,
  city text,
  country text DEFAULT 'Egypt',
  emergency_contact_name text,
  emergency_contact_phone text,
  specialization text,
  qualifications text,
  experience_years integer,
  parent_first_name text,
  id_document_url text,
  program text,
  must_change_password boolean NOT NULL DEFAULT false,
  is_archived boolean NOT NULL DEFAULT false,
  gpa numeric(4,2),
  attendance_rate numeric(5,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Auth credentials (replaces Supabase auth.users)
CREATE TABLE IF NOT EXISTS auth_users (
  id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  encrypted_password text NOT NULL,
  email_confirmed_at timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  program_id uuid REFERENCES programs(id) ON DELETE SET NULL,
  student_id text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'graduated', 'suspended')),
  enrollment_date date,
  gender text,
  date_of_birth date,
  address text,
  city text,
  country text,
  emergency_contact_name text,
  emergency_contact_phone text,
  gpa numeric(4,2),
  attendance_rate numeric(5,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS teacher_programs (
  teacher_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  program_id uuid NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  PRIMARY KEY (teacher_id, program_id)
);

CREATE TABLE IF NOT EXISTS announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  audience text NOT NULL DEFAULT 'all',
  program_id uuid REFERENCES programs(id) ON DELETE SET NULL,
  class_id uuid,
  author_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  start_date date,
  end_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL CHECK (status IN ('present', 'absent', 'late', 'excused')),
  check_in_time time,
  check_out_time time,
  notes text,
  recorded_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_students_user_id ON students(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance(student_id);

-- Default admin (password: Admin@123 — change after first login)
INSERT INTO profiles (id, email, first_name, last_name, role, must_change_password)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'admin@fma.edu',
  'System',
  'Admin',
  'admin',
  true
)
ON CONFLICT (email) DO NOTHING;

INSERT INTO auth_users (id, email, encrypted_password)
SELECT
  '00000000-0000-0000-0000-000000000001',
  'admin@fma.edu',
  crypt('Admin@123', gen_salt('bf'))
WHERE NOT EXISTS (SELECT 1 FROM auth_users WHERE email = 'admin@fma.edu');
