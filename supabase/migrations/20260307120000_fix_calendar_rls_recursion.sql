/*
  # Fix infinite recursion in calendar RLS policies

  The two tables reference each other in their SELECT policies, causing a loop:
    calendar_events SELECT      → queries calendar_event_participants
    calendar_event_participants SELECT → queries calendar_events  ← cycle

  Fix: introduce a SECURITY DEFINER helper function that queries calendar_events
  without triggering its RLS policy, then use that function in the
  calendar_event_participants policies to break the cycle.
*/

-- ── Helper function (SECURITY DEFINER bypasses RLS on calendar_events) ─────────

CREATE OR REPLACE FUNCTION is_calendar_event_creator(p_event_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM calendar_events
    WHERE id = p_event_id AND created_by = auth.uid()
  );
$$;

-- ── Drop the recursive calendar_event_participants policies ─────────────────────

DROP POLICY IF EXISTS "View participant records"        ON calendar_event_participants;
DROP POLICY IF EXISTS "Event creator adds participants" ON calendar_event_participants;
DROP POLICY IF EXISTS "Event creator removes participants" ON calendar_event_participants;

-- ── Re-create policies using the helper function (no recursion) ─────────────────

-- SELECT: user can see their own participant row OR records for events they created
CREATE POLICY "View participant records"
  ON calendar_event_participants FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR is_calendar_event_creator(event_id)
  );

-- INSERT: only the event creator can add participants
CREATE POLICY "Event creator adds participants"
  ON calendar_event_participants FOR INSERT TO authenticated
  WITH CHECK (is_calendar_event_creator(event_id));

-- DELETE: only the event creator can remove participants
CREATE POLICY "Event creator removes participants"
  ON calendar_event_participants FOR DELETE TO authenticated
  USING (is_calendar_event_creator(event_id));
