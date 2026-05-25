-- RDS auth helpers (no Supabase auth schema)

CREATE OR REPLACE FUNCTION public.set_app_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('app.user_id', COALESCE(p_user_id::text, ''), true);
END;
$$;

CREATE OR REPLACE FUNCTION public.current_app_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.user_id', true), '')::uuid;
$$;

CREATE OR REPLACE FUNCTION public.approve_registration_application(
  application_id uuid,
  caller_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  app         RECORD;
  new_user_id UUID;
  prog_id     UUID;
  v_caller    uuid;
BEGIN
  v_caller := COALESCE(caller_id, current_app_user_id());

  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = v_caller AND role = 'admin') THEN
    RAISE EXCEPTION 'Only admins can approve registrations';
  END IF;

  SELECT * INTO app FROM registration_applications WHERE id = application_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Application not found'; END IF;
  IF app.status != 'pending' THEN RAISE EXCEPTION 'Application is already %', app.status; END IF;
  IF EXISTS (SELECT 1 FROM profiles WHERE email = app.email) THEN
    RAISE EXCEPTION 'A user with this email already exists';
  END IF;

  new_user_id := gen_random_uuid();

  INSERT INTO profiles (
    id, email, first_name, last_name, role, must_change_password,
    location, phone, secondary_phone, date_of_birth, address, city, country,
    emergency_contact_name, emergency_contact_phone, specialization, qualifications,
    experience_years, parent_first_name, id_document_url, program
  ) VALUES (
    new_user_id, app.email, app.first_name, app.last_name, app.role,
    (app.password_hash = 'FMA#2026'),
    app.location, app.phone, app.secondary_phone, app.date_of_birth, app.address,
    app.city, app.country, app.emergency_contact_name, app.emergency_contact_phone,
    app.specialization, app.qualifications, app.experience_years,
    app.parent_first_name, app.id_document_url, app.program
  );

  INSERT INTO auth_users (id, email, encrypted_password)
  VALUES (new_user_id, app.email, crypt(app.password_hash, gen_salt('bf')));

  IF app.role = 'student' THEN
    IF app.program IS NOT NULL THEN
      SELECT id INTO prog_id FROM programs WHERE name ILIKE '%' || app.program || '%' LIMIT 1;
    END IF;
    INSERT INTO students (
      user_id, program_id, date_of_birth, address, city, country,
      emergency_contact_name, emergency_contact_phone, status
    ) VALUES (
      new_user_id, prog_id, app.date_of_birth, app.address, app.city, app.country,
      app.emergency_contact_name, app.emergency_contact_phone, 'active'
    );
  END IF;

  IF app.role = 'teacher' AND app.program IS NOT NULL THEN
    SELECT id INTO prog_id FROM programs WHERE name ILIKE '%' || app.program || '%' LIMIT 1;
    IF prog_id IS NOT NULL THEN
      INSERT INTO teacher_programs (teacher_id, program_id) VALUES (new_user_id, prog_id)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  UPDATE registration_applications
  SET status = 'approved', reviewed_by = v_caller, reviewed_at = NOW()
  WHERE id = application_id;

  RETURN json_build_object('success', true, 'user_id', new_user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_student_account(
  p_student_id uuid,
  caller_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid;
  v_role   text;
BEGIN
  v_caller := COALESCE(caller_id, current_app_user_id());
  SELECT role INTO v_role FROM profiles WHERE id = v_caller;
  IF v_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Only admins can delete student accounts';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_student_id AND role = 'student') THEN
    RETURN json_build_object('success', false, 'message', 'Student account not found');
  END IF;

  DELETE FROM teacher_student_notes WHERE student_id = p_student_id;
  DELETE FROM class_attendance WHERE student_id = p_student_id;
  DELETE FROM class_enrollments WHERE student_id = p_student_id;
  DELETE FROM students WHERE user_id = p_student_id;
  DELETE FROM auth_users WHERE id = p_student_id;
  DELETE FROM profiles WHERE id = p_student_id AND role = 'student';

  RETURN json_build_object('success', true, 'message', 'Student account deleted');
END;
$$;
