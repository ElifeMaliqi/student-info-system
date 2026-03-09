/*
  # Fix calendar RLS infinite recursion (definitive)

  The root cause: calendar_events SELECT references calendar_event_participants,
  and calendar_event_participants SELECT references back to calendar_events → cycle.

  Fix: break the cycle by making calendar_event_participants SELECT policy
  self-contained (only checks user_id = auth.uid(), no cross-reference).
  INSERT/DELETE still use the SECURITY DEFINER helper to verify event ownership.
*/

-- ── Drop all existing calendar policies ────────────────────────────────────────

DROP POLICY IF EXISTS "Select own or invited events"       ON calendar_events;
DROP POLICY IF EXISTS "Create own events"                  ON calendar_events;
DROP POLICY IF EXISTS "Update own events"                  ON calendar_events;
DROP POLICY IF EXISTS "Delete own events"                  ON calendar_events;
DROP POLICY IF EXISTS "View participant records"           ON calendar_event_participants;
DROP POLICY IF EXISTS "Event creator adds participants"    ON calendar_event_participants;
DROP POLICY IF EXISTS "Event creator removes participants" ON calendar_event_participants;

-- ── SECURITY DEFINER helper for INSERT/DELETE checks ──────────────────────────
-- Only used for write policies — bypasses RLS on calendar_events safely.

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

-- ── calendar_events policies ───────────────────────────────────────────────────
-- SELECT: creator OR invited. The subquery on calendar_event_participants hits
-- only its self-contained SELECT policy (user_id = auth.uid) → NO back-reference
-- to calendar_events → NO recursion.

CREATE POLICY "Select own or invited events"
  ON calendar_events FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR id IN (
      SELECT event_id FROM calendar_event_participants
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Create own events"
  ON calendar_events FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Update own events"
  ON calendar_events FOR UPDATE TO authenticated
  USING     (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Delete own events"
  ON calendar_events FOR DELETE TO authenticated
  USING (created_by = auth.uid());

-- ── calendar_event_participants policies ───────────────────────────────────────
-- SELECT: self-contained, only checks own user_id — NO reference to calendar_events.
-- This is what breaks the cycle.

CREATE POLICY "View participant records"
  ON calendar_event_participants FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- INSERT/DELETE: use SECURITY DEFINER function (bypasses calendar_events RLS,
-- so no recursion on that side either).

CREATE POLICY "Event creator adds participants"
  ON calendar_event_participants FOR INSERT TO authenticated
  WITH CHECK (is_calendar_event_creator(event_id));

CREATE POLICY "Event creator removes participants"
  ON calendar_event_participants FOR DELETE TO authenticated
  USING (is_calendar_event_creator(event_id));
