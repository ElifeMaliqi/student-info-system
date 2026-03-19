/*
  Update approve_registration_application to:
  - copy location + secondary_phone into profiles
  - set must_change_password when temporary password is used
*/

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
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only admins can approve registrations';
  END IF;

  SELECT * INTO app
  FROM registration_applications
  WHERE id = application_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Application not found';
  END IF;

  IF app.status != 'pending' THEN
    RAISE EXCEPTION 'Application is already %', app.status;
  END IF;

  IF EXISTS (SELECT 1 FROM profiles WHERE email = app.email) THEN
    RAISE EXCEPTION 'A user with this email already exists';
  END IF;

  new_user_id := gen_random_uuid();

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

NOTIFY pgrst, 'reload schema';
