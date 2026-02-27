/*
  # Create Registration Applications Table

  1. New Tables
    - `registration_applications`
      - `id` (uuid, primary key) - Unique identifier
      - `email` (text, not null, unique) - Applicant's email
      - `first_name` (text, not null) - Applicant's first name
      - `last_name` (text, not null) - Applicant's last name
      - `password_hash` (text, not null) - Encrypted password for approved accounts
      - `role` (text, not null) - Requested role: 'teacher' or 'student'
      - `program_id` (uuid, nullable) - For student applications, the desired program
      - `phone` (text, nullable) - Phone number
      - `date_of_birth` (date, nullable) - Date of birth
      - `address` (text, nullable) - Address
      - `city` (text, nullable) - City
      - `country` (text, nullable) - Country
      - `emergency_contact_name` (text, nullable) - Emergency contact name
      - `emergency_contact_phone` (text, nullable) - Emergency contact phone
      - `specialization` (text, nullable) - For teacher applications
      - `qualifications` (text, nullable) - For teacher applications
      - `experience_years` (integer, nullable) - For teacher applications
      - `status` (text, not null) - Application status: 'pending', 'approved', 'rejected'
      - `notes` (text, nullable) - Admin notes
      - `reviewed_by` (uuid, nullable) - Admin who reviewed the application
      - `reviewed_at` (timestamptz, nullable) - When the application was reviewed
      - `created_at` (timestamptz) - Application submission timestamp
      - `updated_at` (timestamptz) - Last update timestamp

  2. Security
    - Enable RLS on `registration_applications` table
    - Add policy for public to insert applications (registration)
    - Add policy for admins to read all applications
    - Add policy for admins to update applications (approve/reject)

  3. Indexes
    - Index on email for faster lookups
    - Index on status for filtering pending applications
*/

-- Create registration applications table
CREATE TABLE IF NOT EXISTS registration_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('teacher', 'student')),
  program_id uuid REFERENCES programs(id),
  phone text,
  date_of_birth date,
  address text,
  city text,
  country text DEFAULT 'Egypt',
  emergency_contact_name text,
  emergency_contact_phone text,
  specialization text,
  qualifications text,
  experience_years integer DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  notes text,
  reviewed_by uuid REFERENCES profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE registration_applications ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can insert registration applications
CREATE POLICY "Anyone can submit registration"
  ON registration_applications
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Policy: Admins can read all applications
CREATE POLICY "Admins can read all applications"
  ON registration_applications
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Policy: Admins can update applications
CREATE POLICY "Admins can update applications"
  ON registration_applications
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_registration_applications_updated_at ON registration_applications;
CREATE TRIGGER update_registration_applications_updated_at
  BEFORE UPDATE ON registration_applications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create indexes
CREATE INDEX IF NOT EXISTS registration_applications_email_idx ON registration_applications(email);
CREATE INDEX IF NOT EXISTS registration_applications_status_idx ON registration_applications(status);
CREATE INDEX IF NOT EXISTS registration_applications_role_idx ON registration_applications(role);