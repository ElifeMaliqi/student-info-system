ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS address text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS secondary_phone text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS open_hours text NOT NULL DEFAULT 'Mon–Fri 08:00–17:00';
