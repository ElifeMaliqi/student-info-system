/*
  # Fix remaining RLS recursion on calendar_events

  The calendar_events SELECT policy still contains:
    OR id IN (SELECT event_id FROM calendar_event_participants WHERE user_id = auth.uid())

  PostgreSQL evaluates RLS on calendar_event_participants for that subquery,
  which calls is_calendar_event_creator(), which queries calendar_events again — cycle.

  Fix: wrap the participants lookup in a second SECURITY DEFINER function so both
  sides of the mutual reference bypass RLS and the cycle is fully broken.
*/

-- Helper: does the current user appear as a participant for this event?
-- SECURITY DEFINER bypasses RLS on calendar_event_participants
CREATE OR REPLACE FUNCTION user_is_event_participant(p_event_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM calendar_event_participants
    WHERE event_id = p_event_id AND user_id = auth.uid()
  );
$$;

-- Drop and recreate the calendar_events SELECT policy using the helper
DROP POLICY IF EXISTS "Select own or invited events" ON calendar_events;

CREATE POLICY "Select own or invited events"
  ON calendar_events FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR user_is_event_participant(id)
  );
