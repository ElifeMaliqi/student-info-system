/*
  # Add Parent Name and ID Document Fields to Registration Applications

  1. Changes
    - Add `parent_first_name` field to store parent's first name (required for students)
    - Add `id_document_url` field to store uploaded ID document URL (optional)
    
  2. Security
    - No RLS changes needed as existing policies cover these new fields
*/

-- Add parent's first name field
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'registration_applications' AND column_name = 'parent_first_name'
  ) THEN
    ALTER TABLE registration_applications ADD COLUMN parent_first_name text;
  END IF;
END $$;

-- Add ID document URL field
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'registration_applications' AND column_name = 'id_document_url'
  ) THEN
    ALTER TABLE registration_applications ADD COLUMN id_document_url text;
  END IF;
END $$;