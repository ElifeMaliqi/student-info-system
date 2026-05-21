/*
  # Update approve_registration_application for re-activation support

  Problem: When an archived student's registration application is re-approved,
  the function raises 'A user with this email already exists' because a profiles
  row still exists for that email (archived or otherwise).

  Fix: Before creating a new account, check whether a profile already exists for
  the email. If one does, re-activate it (unarchive, refresh data, mark student
  active) rather than failing. The existing auth.users row is left intact so the
  student can log in with their original credentials.

  Returns the same shape as before:
    { success: true, user_id: uuid }
  Plus an extra field when re-activating:
    { success: true, user_id: uuid, reactivated: true }
*/

CREATE OR REPLACE FUNCTION public.approve_registration_application(application_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, auth
AS $$
DECLARE
  app              RECORD;
  new_user_id      UUID;
  existing_user_id UUID;
  prog_id          UUID;
BEGIN
  -- ── 1. Caller must be admin ───────────────────────────────────────────────
  IF (SELECT role FROM profiles WHERE id = auth.uid()) <> 'admin' THEN
    RAISE EXCEPTION 'Only admins can approve applications';
  END IF;

  -- ── 2. Load the application ───────────────────────────────────────────────
  SELECT * INTO app FROM registration_applications WHERE id = application_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Application not found';
  END IF;
  IF app.status <> 'pending' THEN
    RAISE EXCEPTION 'Application is not pending';
  END IF;

  -- ── 3. Re-activation check ────────────────────────────────────────────────
  -- If a profile already exists for this email, re-activate it instead of
  -- creating a brand-new auth user / profile.
  SELECT id INTO existing_user_id FROM profiles WHERE email = app.email;

  IF existing_user_id IS NOT NULL THEN
    -- Restore the profile, refreshing fields that came from the new application
    UPDATE profiles SET
      is_archived         = false,
      first_name          = app.first_name,
      last_name           = app.last_name,
      phone               = COALESCE(NULLIF(app.phone, ''),               phone),
      secondary_phone     = COALESCE(NULLIF(app.secondary_phone, ''),     secondary_phone),
      location            = COALESCE(NULLIF(app.location, ''),            location),
      parent_first_name   = COALESCE(NULLIF(app.parent_first_name, ''),   parent_first_name),
      program             = COALESCE(NULLIF(app.program, ''),             program)
    WHERE id = existing_user_id;

    -- Ensure the students record exists and is active
    IF NOT EXISTS (SELECT 1 FROM students WHERE user_id = existing_user_id) THEN
      INSERT INTO students (user_id, status) VALUES (existing_user_id, 'active');
    ELSE
      UPDATE students SET status = 'active' WHERE user_id = existing_user_id;
    END IF;

    -- Mark the application as approved
    UPDATE registration_applications
      SET status      = 'approved',
          reviewed_by = auth.uid(),
          reviewed_at = NOW()
    WHERE id = application_id;

    RETURN json_build_object(
      'success',     true,
      'user_id',     existing_user_id,
      'reactivated', true
    );
  END IF;

  -- ── 4. New account creation (original flow) ───────────────────────────────
  new_user_id := gen_random_uuid();

  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    created_at,
    updated_at,
    last_sign_in_at,
    aud,
    role,
    raw_app_meta_data,
    raw_user_meta_data,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
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

  INSERT INTO profiles (
    id,
    email,
    first_name,
    last_name,
    role,
    must_change_password,
    location,
    phone,
    secondary_phone,
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
    (app.password_hash = 'FMA#2026'),
    app.location,
    app.phone,
    app.secondary_phone,
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
    must_change_password    = EXCLUDED.must_change_password,
    location                = EXCLUDED.location,
    phone                   = EXCLUDED.phone,
    secondary_phone         = EXCLUDED.secondary_phone,
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

  IF app.role = 'student' THEN
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

  UPDATE registration_applications
  SET
    status      = 'approved',
    reviewed_by = auth.uid(),
    reviewed_at = NOW()
  WHERE id = application_id;

  RETURN json_build_object('success', true, 'user_id', new_user_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_registration_application(UUID) TO authenticated;
