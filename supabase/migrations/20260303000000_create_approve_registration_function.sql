/*
  # Create approve_registration_application RPC function

  Replaces the Edge Function (which required deployment) with a server-side
  PostgreSQL function using SECURITY DEFINER. This function runs with elevated
  privileges (as the postgres superuser), allowing it to directly create auth
  users and profile records in a single atomic transaction.

  1. Enables pgcrypto for bcrypt password hashing
  2. Creates approve_registration_application(application_id UUID) → JSON
     - Verifies caller is an admin via auth.uid()
     - Hashes the stored password with bcrypt (compatible with Supabase auth)
     - Inserts directly into auth.users
     - Creates the profile record
     - Creates student or teacher records as appropriate
     - Marks the application as approved
  3. Grants EXECUTE to authenticated role (internal admin check handles authz)
*/

-- Enable pgcrypto for bcrypt password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Drop existing function if present (idempotent)
DROP FUNCTION IF EXISTS public.approve_registration_application(UUID);

CREATE OR REPLACE FUNCTION public.approve_registration_application(application_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, auth
AS $$
DECLARE
  app         RECORD;
  new_user_id UUID;
  prog_id     UUID;
BEGIN
  -- ── 1. Authorization: caller must be an admin ──────────────────────────────
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only admins can approve registrations';
  END IF;

  -- ── 2. Fetch the application ───────────────────────────────────────────────
  SELECT * INTO app
  FROM registration_applications
  WHERE id = application_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Application not found';
  END IF;

  IF app.status != 'pending' THEN
    RAISE EXCEPTION 'Application is already %', app.status;
  END IF;

  -- ── 3. Guard: email must not already exist in profiles ────────────────────
  IF EXISTS (SELECT 1 FROM profiles WHERE email = app.email) THEN
    RAISE EXCEPTION 'A user with this email already exists';
  END IF;

  -- ── 4. Generate new UUID for the auth user ────────────────────────────────
  new_user_id := gen_random_uuid();

  -- ── 5. Create the Supabase auth user directly ─────────────────────────────
  --      encrypted_password uses bcrypt (compatible with gotrue/Supabase auth)
  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    aud,
    role,
    raw_app_meta_data,
    raw_user_meta_data,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change
  ) VALUES (
    new_user_id,
    '00000000-0000-0000-0000-000000000000',
    app.email,
    crypt(app.password_hash, gen_salt('bf')),
    NOW(),
    NOW(),
    NOW(),
    'authenticated',
    'authenticated',
    '{"provider": "email", "providers": ["email"]}',
    '{}',
    '',
    '',
    '',
    ''
  );

  -- ── 6. Create the public profile record ───────────────────────────────────
  -- Use ON CONFLICT DO UPDATE because Supabase may have a trigger on auth.users
  -- that auto-inserts a bare profiles row before we get here.
  INSERT INTO profiles (
    id,
    email,
    first_name,
    last_name,
    role,
    phone,
    date_of_birth,
    address,
    city,
    country,
    emergency_contact_name,
    emergency_contact_phone,
    specialization,
    qualifications,
    experience_years,
    parent_first_name,
    id_document_url,
    program
  ) VALUES (
    new_user_id,
    app.email,
    app.first_name,
    app.last_name,
    app.role,
    app.phone,
    app.date_of_birth,
    app.address,
    app.city,
    app.country,
    app.emergency_contact_name,
    app.emergency_contact_phone,
    app.specialization,
    app.qualifications,
    app.experience_years,
    app.parent_first_name,
    app.id_document_url,
    app.program
  )
  ON CONFLICT (id) DO UPDATE SET
    email                   = EXCLUDED.email,
    first_name              = EXCLUDED.first_name,
    last_name               = EXCLUDED.last_name,
    role                    = EXCLUDED.role,
    phone                   = EXCLUDED.phone,
    date_of_birth           = EXCLUDED.date_of_birth,
    address                 = EXCLUDED.address,
    city                    = EXCLUDED.city,
    country                 = EXCLUDED.country,
    emergency_contact_name  = EXCLUDED.emergency_contact_name,
    emergency_contact_phone = EXCLUDED.emergency_contact_phone,
    specialization          = EXCLUDED.specialization,
    qualifications          = EXCLUDED.qualifications,
    experience_years        = EXCLUDED.experience_years,
    parent_first_name       = EXCLUDED.parent_first_name,
    id_document_url         = EXCLUDED.id_document_url,
    program                 = EXCLUDED.program;

  -- ── 7. Role-specific records ───────────────────────────────────────────────
  IF app.role = 'student' THEN
    -- Resolve program id (optional)
    IF app.program IS NOT NULL THEN
      SELECT id INTO prog_id
      FROM programs
      WHERE name ILIKE '%' || app.program || '%'
      LIMIT 1;
    END IF;

    INSERT INTO students (
      user_id,
      program_id,
      date_of_birth,
      address,
      city,
      country,
      emergency_contact_name,
      emergency_contact_phone,
      status
    ) VALUES (
      new_user_id,
      prog_id,
      app.date_of_birth,
      app.address,
      app.city,
      app.country,
      app.emergency_contact_name,
      app.emergency_contact_phone,
      'active'
    );
  END IF;

  IF app.role = 'teacher' THEN
    -- Resolve program id (optional)
    IF app.program IS NOT NULL THEN
      SELECT id INTO prog_id
      FROM programs
      WHERE name ILIKE '%' || app.program || '%'
      LIMIT 1;
    END IF;

    IF prog_id IS NOT NULL THEN
      INSERT INTO teacher_programs (teacher_id, program_id)
      VALUES (new_user_id, prog_id)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  -- ── 8. Mark application as approved ───────────────────────────────────────
  UPDATE registration_applications
  SET
    status      = 'approved',
    reviewed_by = auth.uid(),
    reviewed_at = NOW()
  WHERE id = application_id;

  RETURN json_build_object('success', true, 'user_id', new_user_id);
END;
$$;

-- Allow any authenticated user to call this function;
-- the SECURITY DEFINER body enforces admin-only access internally.
GRANT EXECUTE ON FUNCTION public.approve_registration_application(UUID) TO authenticated;
