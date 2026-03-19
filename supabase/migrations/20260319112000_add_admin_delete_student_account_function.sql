/*
  Admin-only helper to fully remove a student account, including auth user.
*/

CREATE OR REPLACE FUNCTION public.admin_delete_student_account(p_student_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, auth
AS $$
DECLARE
  v_role text;
BEGIN
  SELECT role INTO v_role
  FROM public.profiles
  WHERE id = auth.uid();

  IF v_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Only admins can delete student accounts';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = p_student_id
      AND role = 'student'
  ) THEN
    RETURN json_build_object('success', false, 'message', 'Student account not found');
  END IF;

  BEGIN
    DELETE FROM public.teacher_student_notes WHERE student_id = p_student_id;
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;

  BEGIN
    DELETE FROM public.class_attendance WHERE student_id = p_student_id;
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;

  BEGIN
    DELETE FROM public.class_enrollments WHERE student_id = p_student_id;
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;

  BEGIN
    DELETE FROM public.students WHERE user_id = p_student_id;
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;

  BEGIN
    DELETE FROM public.profiles WHERE id = p_student_id AND role = 'student';
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;

  DELETE FROM auth.users WHERE id = p_student_id;

  RETURN json_build_object('success', true, 'message', 'Student account deleted');
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_student_account(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
