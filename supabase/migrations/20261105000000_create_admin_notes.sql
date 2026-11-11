-- ─────────────────────────────────────────────────────────────────────────────
-- admin_notes — optional notes admins/superadmins attach to an action they take
-- (approve a registration, delete an invoice, save settings, ...).
--
-- Visibility (enforced in /api/notes, never sent to teachers or students):
--   is_private = false → every admin and superadmin
--   is_private = true  → the author; plus superadmins when the author is an admin
--                        (a superadmin's private note is seen by that superadmin only)
-- author_role is stored at write time so visibility does not change if the
-- author's role changes later. Only the author can edit or delete a note.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS admin_notes (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id   uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  author_role text        NOT NULL,
  area        text        NOT NULL,
  action      text        NOT NULL,
  note        text        NOT NULL,
  is_private  boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_notes_created_at ON admin_notes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_notes_author_id ON admin_notes(author_id);
