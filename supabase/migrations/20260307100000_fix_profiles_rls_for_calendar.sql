/*
  # Fix profiles RLS for calendar collaboration

  The profiles table currently only allows a user to read their own row.
  Calendar features (email participant lookup, audience presets, participant
  display) need any authenticated user to read basic profile fields of others.

  Changes:
  - Add SELECT policy so any authenticated user can read all profiles
  - Keep INSERT/UPDATE/DELETE restricted to the row owner
*/

-- Drop the restrictive self-only SELECT policy if it exists
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile"       ON profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;

-- Allow any authenticated user to read any profile row
-- (email, name, role, avatar are needed for calendar collaboration)
CREATE POLICY "Authenticated users can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);
