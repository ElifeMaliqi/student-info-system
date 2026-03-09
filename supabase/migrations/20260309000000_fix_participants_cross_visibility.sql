/*
  # Fix participant cross-visibility

  The current participants SELECT policy is:
    USING (user_id = auth.uid())

  This means each user can ONLY see their own participant row.
  Result: participants cannot see who else is attending, and the organizer
  row in the detail modal is invisible to invitees.

  Fix: replace the self-only policy with a SECURITY DEFINER helper function
  that returns the event_ids the current user participates in -- without
  going through RLS (avoiding infinite recursion) -- then allow SELECT on
  any participant row that belongs to the same events.
*/

-- Helper: returns all event_ids the current user is a participant of.
-- SECURITY DEFINER means it runs as the function owner (bypasses RLS),
-- so there is no recursive RLS call back into calendar_event_participants.
CREATE OR REPLACE FUNCTION get_my_event_ids()
RETURNS TABLE(eid uuid)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT event_id FROM calendar_event_participants WHERE user_id = auth.uid();
$$;

-- Drop the old self-only policy and replace with peer-visibility policy.
DROP POLICY IF EXISTS "participants_select" ON calendar_event_participants;

CREATE POLICY "participants_select"
  ON calendar_event_participants FOR SELECT TO authenticated
  USING (event_id IN (SELECT eid FROM get_my_event_ids()));

NOTIFY pgrst, 'reload schema';
