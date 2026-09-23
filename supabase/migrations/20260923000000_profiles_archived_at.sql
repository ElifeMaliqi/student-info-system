-- ============================================================
-- When a profile was archived
-- ============================================================
-- profiles.is_archived only says whether someone is archived, not when. The
-- admin dashboard counts students who left (were archived) in the current
-- month, so every archive stamps archived_at and every unarchive clears it.
-- Profiles archived before this column existed keep archived_at NULL.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS archived_at timestamptz;

NOTIFY pgrst, 'reload schema';
