/*
  # Fix calendar RLS infinite recursion (nuclear drop)

  Previous DROP POLICY statements only targeted known policy names.
  Stale policies with old names may still exist and cause recursion.
  This migration drops ALL policies on both tables dynamically, then
  recreates a clean set with no cross-table references.
*/

-- ── Drop ALL policies on both calendar tables (regardless of name) ─────────────

DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('calendar_events', 'calendar_event_participants')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- ── SECURITY DEFINER helper for INSERT/DELETE ownership checks ─────────────────

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
-- The subquery on calendar_event_participants is safe because that table's
-- SELECT policy (below) is self-contained: only checks user_id = auth.uid()
-- with no back-reference to calendar_events.

CREATE POLICY "events_select"
  ON calendar_events FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR id IN (
      SELECT event_id FROM calendar_event_participants
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "events_insert"
  ON calendar_events FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "events_update"
  ON calendar_events FOR UPDATE TO authenticated
  USING     (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "events_delete"
  ON calendar_events FOR DELETE TO authenticated
  USING (created_by = auth.uid());

-- ── calendar_event_participants policies ───────────────────────────────────────
-- SELECT is intentionally self-contained: no reference to calendar_events.
-- This is what breaks the recursive cycle.

CREATE POLICY "participants_select"
  ON calendar_event_participants FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "participants_insert"
  ON calendar_event_participants FOR INSERT TO authenticated
  WITH CHECK (is_calendar_event_creator(event_id));

CREATE POLICY "participants_delete"
  ON calendar_event_participants FOR DELETE TO authenticated
  USING (is_calendar_event_creator(event_id));
