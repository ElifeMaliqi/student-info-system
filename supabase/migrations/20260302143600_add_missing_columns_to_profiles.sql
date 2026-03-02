/*
  # Add missing columns to profiles table

  1. Changes
    - Add `date_of_birth` column to store user's birth date
    - Add `address` column for street address
    - Add `city` column for city name
    - Add `country` column for country name
    - Add `emergency_contact_name` column for emergency contact
    - Add `emergency_contact_phone` column for emergency phone
    - Add `specialization` column for teachers
    - Add `qualifications` column for teachers
    - Add `experience_years` column for teachers
    - Add `parent_first_name` column for student's parent
    - Add `id_document_url` column for ID document storage
    - Add `program` column for student's program name

  2. Notes
    - All new columns are nullable to support existing records
    - These columns align with registration_applications table
*/

DO $$
BEGIN
  -- Add date_of_birth if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'date_of_birth'
  ) THEN
    ALTER TABLE profiles ADD COLUMN date_of_birth date;
  END IF;

  -- Add address if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'address'
  ) THEN
    ALTER TABLE profiles ADD COLUMN address text;
  END IF;

  -- Add city if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'city'
  ) THEN
    ALTER TABLE profiles ADD COLUMN city text;
  END IF;

  -- Add country if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'country'
  ) THEN
    ALTER TABLE profiles ADD COLUMN country text;
  END IF;

  -- Add emergency_contact_name if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'emergency_contact_name'
  ) THEN
    ALTER TABLE profiles ADD COLUMN emergency_contact_name text;
  END IF;

  -- Add emergency_contact_phone if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'emergency_contact_phone'
  ) THEN
    ALTER TABLE profiles ADD COLUMN emergency_contact_phone text;
  END IF;

  -- Add specialization if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'specialization'
  ) THEN
    ALTER TABLE profiles ADD COLUMN specialization text;
  END IF;

  -- Add qualifications if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'qualifications'
  ) THEN
    ALTER TABLE profiles ADD COLUMN qualifications text;
  END IF;

  -- Add experience_years if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'experience_years'
  ) THEN
    ALTER TABLE profiles ADD COLUMN experience_years integer;
  END IF;

  -- Add parent_first_name if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'parent_first_name'
  ) THEN
    ALTER TABLE profiles ADD COLUMN parent_first_name text;
  END IF;

  -- Add id_document_url if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'id_document_url'
  ) THEN
    ALTER TABLE profiles ADD COLUMN id_document_url text;
  END IF;

  -- Add program if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'program'
  ) THEN
    ALTER TABLE profiles ADD COLUMN program text;
  END IF;
END $$;
