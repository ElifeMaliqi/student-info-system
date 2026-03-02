/*
  # Add program column to registration_applications table

  1. Changes
    - Add `program` text column to store program name directly
    - Remove `program_id` foreign key constraint
    - Drop `program_id` column
    
  2. Notes
    - Programs will be stored as text values: "Web Development", "Digital Marketing with AI", etc.
    - This simplifies the registration process and removes dependency on programs table
*/

-- Remove foreign key constraint first
ALTER TABLE registration_applications 
DROP CONSTRAINT IF EXISTS registration_applications_program_id_fkey;

-- Drop the program_id column
ALTER TABLE registration_applications 
DROP COLUMN IF EXISTS program_id;

-- Add the new program text column
ALTER TABLE registration_applications 
ADD COLUMN IF NOT EXISTS program text;
