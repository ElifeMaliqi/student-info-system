-- ============================================================
-- Allow class-less imported attendance
-- ============================================================
-- Attendance imported from a day-initial sheet with no class selected is not
-- tied to a class. Relax the NOT NULL constraint so such rows can be stored; the
-- app renders a null class as "N/A".

ALTER TABLE class_attendance ALTER COLUMN class_id DROP NOT NULL;

NOTIFY pgrst, 'reload schema';
