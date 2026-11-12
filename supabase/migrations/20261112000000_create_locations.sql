-- Locations offered in the student location dropdowns (enroll, edit, public registration).
-- Managed by admins in Settings > Locations.
CREATE TABLE IF NOT EXISTS public.locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.locations (name) VALUES ('FMA Qender') ON CONFLICT (name) DO NOTHING;

-- One-time data fix: move every existing student to FMA Qender (the old
-- FMA Kids (Dardani) / FMA (Rruga Qarkore) options were removed).
-- Guarded by a marker row so it runs exactly once per database: re-running this
-- file, migrate-rds, or the apply script later finds the marker and skips, so
-- locations set after this (e.g. new locations added in Settings) are never overwritten.
CREATE TABLE IF NOT EXISTS public.one_time_data_fixes (
  name text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  INSERT INTO public.one_time_data_fixes (name)
  VALUES ('2026-11-12 all students to FMA Qender')
  ON CONFLICT (name) DO NOTHING;

  IF FOUND THEN
    UPDATE public.profiles SET location = 'FMA Qender' WHERE role = 'student';
    UPDATE public.registration_applications SET location = 'FMA Qender' WHERE role = 'student';
  END IF;
END $$;
