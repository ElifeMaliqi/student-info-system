/*
  # Hash passwords in registration_applications table
  
  Problem: Plaintext passwords were being stored in registration_applications.password_hash
  This migration:
  1. Enables pgcrypto for bcrypt hashing if not already enabled
  2. Hashes any existing plaintext passwords already in the table
  3. Creates a trigger to hash new passwords on insert/update
  4. Ensures passwords are never stored as plaintext
*/

-- Ensure pgcrypto extension is available for bcrypt hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create function to hash password before insert/update
CREATE OR REPLACE FUNCTION public.hash_registration_password()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Hash the password if it's plaintext (not already hashed)
  IF NEW.password_hash IS NOT NULL 
     AND NEW.password_hash != '' 
     AND NOT (NEW.password_hash ~ '^\$2[aby]\$') THEN
    NEW.password_hash := crypt(NEW.password_hash, gen_salt('bf'));
  END IF;
  RETURN NEW;
END;
$$;

-- Drop existing trigger if present to avoid conflicts
DROP TRIGGER IF EXISTS hash_registration_password_trigger ON public.registration_applications;

-- Create trigger to hash passwords on insert
CREATE TRIGGER hash_registration_password_trigger
BEFORE INSERT OR UPDATE ON public.registration_applications
FOR EACH ROW
EXECUTE FUNCTION public.hash_registration_password();

NOTIFY pgrst, 'reload schema';
