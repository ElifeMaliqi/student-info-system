-- Track who last changed an invoice's status and when (shown in the Invoice Status modal).
-- Filled by a trigger from the signed-in user (app.user_id, set by withUserContext), so the
-- browser can't fake it. Automatic changes (invoice sync marking overdue) have no user:
-- status_changed_by stays NULL and the modal shows "System".

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS status_changed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status_changed_at timestamptz;

CREATE OR REPLACE FUNCTION public.invoices_track_status_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.status_changed_at := now();
    NEW.status_changed_by := current_app_user_id();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS invoices_track_status_change ON invoices;
CREATE TRIGGER invoices_track_status_change
  BEFORE UPDATE OF status ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.invoices_track_status_change();
