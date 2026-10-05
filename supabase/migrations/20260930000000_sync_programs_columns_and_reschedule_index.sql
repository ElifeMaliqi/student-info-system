/*
  # Sync schema pieces that exist on live RDS but were never captured in a migration

  - programs: capacity, color, duration_months, enrolled_count, is_active, price
    (used by AdminPrograms via src/services/api.ts)
  - class_reschedules: index on original_date
  - pgcrypto in the public schema (Supabase installs it in "extensions", where
    functions pinned to search_path = public can't find crypt()/gen_salt())

  Idempotent: a no-op on live, where these already exist.
*/

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace
    WHERE e.extname = 'pgcrypto' AND n.nspname <> 'public'
  ) THEN
    ALTER EXTENSION pgcrypto SET SCHEMA public;
  END IF;
END $$;

ALTER TABLE programs ADD COLUMN IF NOT EXISTS capacity integer;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS color text;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS duration_months integer;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS enrolled_count integer NOT NULL DEFAULT 0;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS price numeric(10,2) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_class_reschedules_orig_date ON class_reschedules (original_date);
