/*
  # Add RSVP status to calendar_event_participants

  Adds rsvp_status so participants can confirm, decline, or leave undecided.
  Also adds an UPDATE policy so each participant can update only their own row.
*/

ALTER TABLE calendar_event_participants
  ADD COLUMN IF NOT EXISTS rsvp_status text NOT NULL DEFAULT 'pending'
    CHECK (rsvp_status IN ('attending', 'pending', 'declined'));

-- Allow participants to update their own RSVP status
DROP POLICY IF EXISTS "participants_update_rsvp" ON calendar_event_participants;

CREATE POLICY "participants_update_rsvp"
  ON calendar_event_participants FOR UPDATE TO authenticated
  USING     (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

NOTIFY pgrst, 'reload schema';
