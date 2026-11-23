-- ─────────────────────────────────────────────────────────────────────────────
-- activity_logs — one row per admin/superadmin action taken in the app
-- (enrol a student, edit an invoice, delete a class, save settings, ...).
-- Shown to superadmins only, under Settings > Logs.
--
-- Rows are written by POST /api/logs, which takes the user from the session
-- token (never from the request body) and classifies the activity as
-- add / edit / delete from the action description.
-- user_name / user_role are stored at write time so the log still reads
-- correctly after the account is renamed or deleted.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS activity_logs (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  user_name   text        NOT NULL,
  user_role   text        NOT NULL,
  activity    text        NOT NULL CHECK (activity IN ('add', 'edit', 'delete')),
  area        text        NOT NULL,
  description text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);
