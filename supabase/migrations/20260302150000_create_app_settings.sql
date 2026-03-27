CREATE TABLE IF NOT EXISTS public.app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_name text NOT NULL DEFAULT 'Future Minds Academy',
  contact_email text NOT NULL DEFAULT 'admin@futureminds.edu',
  phone text NOT NULL DEFAULT '+383 44 123 456',
  timezone text NOT NULL DEFAULT 'CET',
  logo_url text DEFAULT 'https://futureminds.io/assets/imgs/logo/site-logo-white-2.png',
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.app_settings (institution_name, contact_email, phone, timezone, logo_url)
VALUES ('Future Minds Academy', 'admin@futureminds.edu', '+383 44 123 456', 'CET', 'https://futureminds.io/assets/imgs/logo/site-logo-white-2.png')
ON CONFLICT DO NOTHING;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read app_settings" ON public.app_settings
  FOR SELECT USING (true);

CREATE POLICY "Admins can update app_settings" ON public.app_settings
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
