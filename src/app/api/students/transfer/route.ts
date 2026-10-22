import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, verifyToken } from '../../../../server/auth';
import { withUserContext } from '../../../../server/db';
import { PRIVILEGED_ROLES } from '../../../../server/authz';
import type { PoolClient } from 'pg';

// Day index used by class_sessions.day_of_week (0 = Monday … 6 = Sunday).
function weekday(date: string): number {
  return (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Move a student from one class to another. The enrollment row itself is moved
 * (same id and enrolled_at), so invoice sync sees the months as already invoiced
 * and issues nothing new. Attendance moves to the new class, each record shifted
 * to the matching weekly session day of the same week. Unpaid invoices move and
 * get the new class name in their title; paid invoices and test results stay with
 * the old class. No email or SMS is sent.
 */
export async function POST(req: NextRequest) {
  const token = getBearerToken(req.headers.get('authorization'));
  const user = token ? await verifyToken(token) : null;
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!PRIVILEGED_ROLES.has(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const studentId = body?.studentId;
  const fromClassId = body?.fromClassId;
  const toClassId = body?.toClassId;
  if (typeof studentId !== 'string' || typeof fromClassId !== 'string' || typeof toClassId !== 'string') {
    return NextResponse.json({ error: 'studentId, fromClassId and toClassId are required' }, { status: 400 });
  }
  if (fromClassId === toClassId) {
    return NextResponse.json({ error: 'Pick a different class to transfer to' }, { status: 400 });
  }

  try {
    const result = await withUserContext(user.id, async (client: PoolClient) => {
      await client.query('BEGIN');
      try {
        const enr = await client.query<{ id: string }>(
          `SELECT id FROM class_enrollments WHERE student_id = $1 AND class_id = $2 FOR UPDATE`,
          [studentId, fromClassId]
        );
        if (enr.rowCount === 0) {
          await client.query('ROLLBACK');
          return { http: 400, body: { error: 'Student is not enrolled in that class' } };
        }
        const already = await client.query(
          `SELECT 1 FROM class_enrollments WHERE student_id = $1 AND class_id = $2`,
          [studentId, toClassId]
        );
        if ((already.rowCount ?? 0) > 0) {
          await client.query('ROLLBACK');
          return { http: 400, body: { error: 'Student is already enrolled in that class' } };
        }

        const classes = await client.query<{ id: string; title: string }>(
          `SELECT id, title FROM classes WHERE id = ANY($1)`,
          [[fromClassId, toClassId]]
        );
        const fromTitle = classes.rows.find(c => c.id === fromClassId)?.title;
        const toTitle = classes.rows.find(c => c.id === toClassId)?.title;
        if (!fromTitle || !toTitle) {
          await client.query('ROLLBACK');
          return { http: 404, body: { error: 'Class not found' } };
        }

        // 1. Enrollment
        await client.query(`UPDATE class_enrollments SET class_id = $1 WHERE id = $2`, [toClassId, enr.rows[0].id]);

        // 2. Attendance — old class's 1st/2nd weekly day maps to the new class's 1st/2nd day.
        const sessions = await client.query<{ class_id: string; day_of_week: number }>(
          `SELECT class_id, day_of_week FROM class_sessions WHERE class_id = ANY($1) ORDER BY day_of_week`,
          [[fromClassId, toClassId]]
        );
        const oldDays = [...new Set(sessions.rows.filter(s => s.class_id === fromClassId).map(s => s.day_of_week))];
        const newDays = [...new Set(sessions.rows.filter(s => s.class_id === toClassId).map(s => s.day_of_week))];

        const records = await client.query<{ id: string; date: string }>(
          `SELECT id, date FROM class_attendance WHERE student_id = $1 AND class_id = $2 ORDER BY date`,
          [studentId, fromClassId]
        );
        const taken = new Set(
          (await client.query<{ date: string }>(
            `SELECT date FROM class_attendance WHERE student_id = $1 AND class_id = $2`,
            [studentId, toClassId]
          )).rows.map(r => r.date)
        );
        const perWeek = new Map<string, number>();
        let attendanceMoved = 0;
        for (const rec of records.rows) {
          const dow = weekday(rec.date);
          const weekStart = addDays(rec.date, -dow);
          const rank = perWeek.get(weekStart) ?? 0;
          perWeek.set(weekStart, rank + 1);

          let target = rec.date;
          if (oldDays.length > 0 && newDays.length > 0) {
            // A date that isn't one of the old class's days (schedule changed) maps by its order in the week.
            const idx = oldDays.indexOf(dow) !== -1 ? oldDays.indexOf(dow) : rank;
            target = addDays(weekStart, newDays[Math.min(idx, newDays.length - 1)]);
          }
          if (taken.has(target)) target = rec.date;
          if (taken.has(target)) continue; // the new class already has this day — leave the record with the old class
          taken.add(target);
          await client.query(
            `UPDATE class_attendance SET class_id = $1, date = $2, updated_at = now() WHERE id = $3`,
            [toClassId, target, rec.id]
          );
          attendanceMoved++;
        }

        // 3. Unpaid invoices — renamed to the new class, no new invoice and no notification.
        const inv = await client.query(
          `UPDATE invoices
              SET class_id = $1, title = replace(title, $2, $3)
            WHERE student_id = $4 AND class_id = $5 AND status <> 'paid' AND deleted_at IS NULL`,
          [toClassId, fromTitle, toTitle, studentId, fromClassId]
        );

        await client.query('COMMIT');
        return {
          http: 200,
          body: {
            attendanceMoved,
            attendanceKept: records.rows.length - attendanceMoved,
            invoicesMoved: inv.rowCount ?? 0,
          },
        };
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      }
    });
    return NextResponse.json(result.body, { status: result.http });
  } catch (e) {
    console.error('Student transfer failed:', e);
    return NextResponse.json({ error: 'Transfer failed' }, { status: 500 });
  }
}
