-- Add is_archived flag to registration_applications
ALTER TABLE registration_applications
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;

-- Add is_archived flag to profiles (for active student accounts)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;

-- Index for fast archived queries
CREATE INDEX IF NOT EXISTS idx_registration_applications_is_archived
  ON registration_applications (is_archived);

CREATE INDEX IF NOT EXISTS idx_profiles_is_archived
  ON profiles (is_archived);
