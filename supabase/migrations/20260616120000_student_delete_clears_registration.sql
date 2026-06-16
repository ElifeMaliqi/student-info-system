-- ============================================================
-- Deleting a student also removes them from the Registrations tabs
-- ============================================================
-- admin_delete_student_account now (1) allows superadmins (not just admins) and
-- (2) deletes the student's registration_applications row so a deleted student
-- no longer lingers in the Registrations views.

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
  v_email  text;
BEGIN
  v_caller := COALESCE(caller_id, current_app_user_id());
  SELECT role INTO v_role FROM profiles WHERE id = v_caller;
  IF v_role NOT IN ('admin', 'superadmin') THEN
    RAISE EXCEPTION 'Only admins can delete student accounts';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_student_id AND role = 'student') THEN
    RETURN json_build_object('success', false, 'message', 'Student account not found');
  END IF;
  SELECT email INTO v_email FROM profiles WHERE id = p_student_id;

  DELETE FROM teacher_student_notes WHERE student_id = p_student_id;
  DELETE FROM class_attendance WHERE student_id = p_student_id;
  DELETE FROM class_enrollments WHERE student_id = p_student_id;
  DELETE FROM students WHERE user_id = p_student_id;
  DELETE FROM registration_applications WHERE email = v_email;
  DELETE FROM auth_users WHERE id = p_student_id;
  DELETE FROM profiles WHERE id = p_student_id AND role = 'student';

  RETURN json_build_object('success', true, 'message', 'Student account deleted');
END;
$$;
