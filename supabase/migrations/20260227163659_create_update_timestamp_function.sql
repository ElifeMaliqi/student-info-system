/*
  # Create Update Timestamp Function

  1. Functions
    - `update_updated_at_column()` - Function to automatically update updated_at timestamps

  2. Purpose
    - Used by triggers to automatically set updated_at timestamps on row updates
    - Ensures all tables maintain accurate last-modified timestamps
*/

-- Create or replace the update_updated_at_column function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;