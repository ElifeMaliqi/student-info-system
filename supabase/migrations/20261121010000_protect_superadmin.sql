-- ─────────────────────────────────────────────────────────────────────────────
-- Nobody can make an account a superadmin from the app, and nobody but a
-- superadmin can change a superadmin account.
--
-- These triggers act on every request made through the app: the app sets
-- app.user_id for each request (withUserContext), so current_app_user_id() is
-- the signed-in user. Maintenance scripts run by the database owner (no
-- app.user_id) are not affected — that is the only way to create a superadmin.
-- Password resets by email token also run without a user and still work.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.protect_superadmin_profiles()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_actor uuid := current_app_user_id();
BEGIN
  IF v_actor IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.role = 'superadmin' THEN
      RAISE EXCEPTION 'Superadmin accounts cannot be deleted from the app';
    END IF;
    RETURN OLD;
  END IF;

  -- No one becomes a superadmin through the app (create or promote).
  IF NEW.role = 'superadmin' AND (TG_OP = 'INSERT' OR OLD.role IS DISTINCT FROM 'superadmin') THEN
    RAISE EXCEPTION 'Superadmin accounts cannot be created from the app';
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.role = 'superadmin' THEN
    -- Only the superadmin themself may edit their own account …
    IF v_actor <> OLD.id THEN
      RAISE EXCEPTION 'Only that superadmin can change a superadmin account';
    END IF;
    -- … and not demote, archive or re-scope it.
    IF NEW.role IS DISTINCT FROM 'superadmin'
       OR COALESCE(NEW.is_archived, false) <> COALESCE(OLD.is_archived, false)
       OR NEW.system_role_id IS DISTINCT FROM OLD.system_role_id THEN
      RAISE EXCEPTION 'A superadmin account cannot be demoted or archived from the app';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_superadmin_profiles ON profiles;
CREATE TRIGGER protect_superadmin_profiles
  BEFORE INSERT OR UPDATE OR DELETE ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_superadmin_profiles();


-- Login records (passwords): only the superadmin themself may change theirs.
CREATE OR REPLACE FUNCTION public.protect_superadmin_logins()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_actor uuid := current_app_user_id();
  v_target uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END;
BEGIN
  IF v_actor IS NULL OR v_actor = v_target THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF EXISTS (SELECT 1 FROM profiles WHERE id = v_target AND role = 'superadmin') THEN
    RAISE EXCEPTION 'Only that superadmin can change a superadmin login';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS protect_superadmin_logins ON auth_users;
CREATE TRIGGER protect_superadmin_logins
  BEFORE INSERT OR UPDATE OR DELETE ON auth_users
  FOR EACH ROW EXECUTE FUNCTION public.protect_superadmin_logins();


-- Approving a registration creates an account with the application's role, so
-- applications may only ever be for students or teachers (always enforced).
CREATE OR REPLACE FUNCTION public.registration_role_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.role IS NULL OR NEW.role NOT IN ('student', 'teacher') THEN
    RAISE EXCEPTION 'Registrations can only be for students or teachers';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS registration_role_guard ON registration_applications;
CREATE TRIGGER registration_role_guard
  BEFORE INSERT OR UPDATE OF role ON registration_applications
  FOR EACH ROW EXECUTE FUNCTION public.registration_role_guard();
