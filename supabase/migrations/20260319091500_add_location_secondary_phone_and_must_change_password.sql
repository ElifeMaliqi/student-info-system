/*
  Add location + secondary phone support and first-login password-reset flag.

  1. registration_applications
     - location text (required for new registrations in UI)
     - secondary_phone text (optional)

  2. profiles
     - location text
     - secondary_phone text
     - must_change_password boolean default false
*/

ALTER TABLE registration_applications
ADD COLUMN IF NOT EXISTS location text;

ALTER TABLE registration_applications
ADD COLUMN IF NOT EXISTS secondary_phone text;

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS location text;

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS secondary_phone text;

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_profiles_must_change_password
  ON profiles (must_change_password);

NOTIFY pgrst, 'reload schema';
