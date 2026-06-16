import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, verifyToken } from '../../../../server/auth';
import { withUserContext } from '../../../../server/db';
import { PRIVILEGED_ROLES } from '../../../../server/authz';
import { parseAttendanceWorkbook } from '../../../../server/xlsx-attendance';
import type { PoolClient } from 'pg';

const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9,
  oct: 10, nov: 11, dec: 12,
};

function monthNumber(name: string): number | null {
  return MONTHS[name.trim().toLowerCase()] ?? null;
}

/** Monday=0 … Sunday=6, matching the day-initial parser's convention. */
function dow(d: Date): number {
  return (d.getDay() + 6) % 7;
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Date of the Nth occurrence of `weekday` (Mon=0) in the month, or null. */
function nthWeekday(year: number, month: number, weekday: number, occurrence: number): string | null {
  let count = 0;
  const last = new Date(year, month, 0).getDate();
  for (let day = 1; day <= last; day++) {
    const d = new Date(year, month - 1, day);
    if (dow(d) === weekday) {
      count++;
      if (count === occurrence) return ymd(d);
    }
  }
  return null;
}

export async function POST(req: NextRequest) {
  const token = getBearerToken(req.headers.get('authorization'));
  const user = token ? await verifyToken(token) : null;
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  let form: FormData;
  try { form = await req.formData(); }
  catch { return NextResponse.json({ error: 'Expected multipart form data' }, { status: 400 }); }

  const file = form.get('file');
  const classId = String(form.get('classId') || '').trim() || null; // optional
  const startYear = parseInt(String(form.get('year') || ''), 10);

  if (!(file instanceof Blob)) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
  if (!Number.isFinite(startYear)) return NextResponse.json({ error: 'Missing or invalid year' }, { status: 400 });
  // A class-less import spans students across classes — admin/superadmin only.
  if (!classId && !PRIVILEGED_ROLES.has(user.role)) {
    return NextResponse.json({ error: 'Select a class to import attendance' }, { status: 403 });
  }

  let parsed;
  try {
    parsed = parseAttendanceWorkbook(Buffer.from(await file.arrayBuffer()));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed to read spreadsheet' }, { status: 400 });
  }

  try {
    const result = await withUserContext(user.id, async (client: PoolClient) => {
      // Class + ownership check (only when a class was selected).
      if (classId) {
        const cls = await client.query<{ teacher_id: string | null }>(
          'SELECT teacher_id FROM classes WHERE id = $1', [classId]
        );
        if (cls.rows.length === 0) return { http: 404 as const, body: { error: 'Class not found' } };
        if (!PRIVILEGED_ROLES.has(user.role) && cls.rows[0].teacher_id !== user.id) {
          return { http: 403 as const, body: { error: 'You can only import attendance for your own classes' } };
        }
      }

      // Enrolled students (when a class is selected) for first-pass matching.
      const byEmail = new Map<string, string>();
      const byName = new Map<string, string>();
      if (classId) {
        const enr = await client.query<{ id: string; first_name: string; last_name: string; email: string }>(
          `SELECT p.id, p.first_name, p.last_name, p.email
             FROM class_enrollments e
             JOIN profiles p ON p.id = e.student_id
            WHERE e.class_id = $1`, [classId]
        );
        for (const s of enr.rows) {
          if (s.email) byEmail.set(s.email.trim().toLowerCase(), s.id);
          byName.set(`${s.first_name} ${s.last_name}`.trim().toLowerCase(), s.id);
        }
      }

      // Map each month block to a calendar (year, month), rolling the year when
      // the month number wraps (e.g. Dec → Jan in a school year).
      const monthNums: (number | null)[] = [];
      const monthYears: number[] = [];
      const warnings: string[] = [];
      let curYear = startYear;
      let prevNum = -1;
      for (const name of parsed.months) {
        const num = monthNumber(name);
        if (num === null) {
          warnings.push(`Unrecognised month "${name}" — its columns were skipped.`);
          monthNums.push(null);
          monthYears.push(curYear);
          continue;
        }
        if (prevNum !== -1 && num < prevNum) curYear++;
        prevNum = num;
        monthNums.push(num);
        monthYears.push(curYear);
      }

      // Resolve each (month, column) to a concrete date once.
      const monthDates: (string | null)[][] = parsed.monthColumns.map((cols, mi) => {
        const num = monthNums[mi];
        if (!num) return cols.map(() => null);
        return cols.map(c => nthWeekday(monthYears[mi], num, c.weekday, c.occurrence));
      });

      // Resolve sheet students → real students (by email, then name). With a class
      // we prefer its roster and enrol any matched-but-not-enrolled students;
      // without a class we match across all student accounts.
      const sheetEmails = [...new Set(parsed.students.map(s => s.email.trim().toLowerCase()).filter(Boolean))];
      const sheetNames  = [...new Set(parsed.students.map(s => `${s.firstName} ${s.lastName}`.trim().toLowerCase()).filter(Boolean))];
      const globalByEmail = new Map<string, string>();
      const globalByName  = new Map<string, string>();
      if (sheetEmails.length || sheetNames.length) {
        const all = await client.query<{ id: string; first_name: string; last_name: string; email: string }>(
          `SELECT id, first_name, last_name, email FROM profiles
            WHERE role = 'student' AND COALESCE(is_archived, false) = false
              AND (lower(email) = ANY($1::text[]) OR lower(trim(first_name || ' ' || last_name)) = ANY($2::text[]))`,
          [sheetEmails, sheetNames]
        );
        for (const s of all.rows) {
          if (s.email) globalByEmail.set(s.email.trim().toLowerCase(), s.id);
          globalByName.set(`${s.first_name} ${s.last_name}`.trim().toLowerCase(), s.id);
        }
      }

      const rows: { studentId: string; date: string; status: 'present' | 'absent' }[] = [];
      const unmatched: { name: string; email: string; phone: string }[] = [];
      const toEnroll = new Set<string>();

      // Sheet-wide cutoff: the latest date any student is marked present. Sessions
      // up to this date are treated as "happened", so blanks on or before it count
      // as absent for everyone; sessions after it are left unrecorded.
      let cutoff: string | null = null;
      for (const stu of parsed.students) {
        stu.filled.forEach((month, mi) => {
          month.forEach((isFilled, ci) => {
            if (!isFilled) return;
            const date = monthDates[mi]?.[ci];
            if (date && (!cutoff || date > cutoff)) cutoff = date;
          });
        });
      }

      for (const stu of parsed.students) {
        const email = stu.email.trim().toLowerCase();
        const nameKey = `${stu.firstName} ${stu.lastName}`.trim().toLowerCase();
        let studentId = (email && byEmail.get(email)) || byName.get(nameKey);
        if (!studentId) {
          const globalId = (email && globalByEmail.get(email)) || globalByName.get(nameKey);
          if (globalId) { studentId = globalId; if (classId) toEnroll.add(globalId); }
        }
        if (!studentId) {
          unmatched.push({
            name: `${stu.firstName} ${stu.lastName}`.trim(),
            email: stu.email.trim(),
            phone: stu.phone?.trim() || '',
          });
          continue;
        }
        stu.filled.forEach((month, mi) => {
          month.forEach((isFilled, ci) => {
            const date = monthDates[mi]?.[ci];
            if (!date) return;
            if (isFilled) {
              rows.push({ studentId: studentId!, date, status: 'present' });
            } else if (cutoff && date <= cutoff) {  // absent up to the sheet-wide cutoff
              rows.push({ studentId: studentId!, date, status: 'absent' });
            }
          });
        });
      }

      // Enrol matched-but-not-enrolled students so the marks appear in class views.
      for (const sid of toEnroll) {
        await client.query(
          `INSERT INTO class_enrollments (class_id, student_id, status)
           SELECT $1, $2, 'active'
           WHERE NOT EXISTS (SELECT 1 FROM class_enrollments WHERE class_id = $1 AND student_id = $2)`,
          [classId, sid]
        );
      }

      // Write attendance. With a class we upsert on the unique key. Without a
      // class, class_id is NULL (which the unique key treats as distinct), so we
      // delete the matching class-less rows first to stay idempotent.
      let written = 0;
      const CHUNK = 200;
      if (!classId && rows.length > 0) {
        await client.query(
          `DELETE FROM class_attendance
            WHERE class_id IS NULL
              AND (student_id, date) IN (SELECT * FROM unnest($1::uuid[], $2::date[]))`,
          [rows.map(r => r.studentId), rows.map(r => r.date)]
        );
      }
      for (let i = 0; i < rows.length; i += CHUNK) {
        const slice = rows.slice(i, i + CHUNK);
        const values: string[] = [];
        const params: unknown[] = [];
        slice.forEach((r, j) => {
          const b = j * 5;
          values.push(`($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5})`);
          params.push(classId, r.studentId, r.date, r.status, user.id);
        });
        const conflict = classId
          ? `ON CONFLICT (class_id, student_id, date)
             DO UPDATE SET status = EXCLUDED.status, recorded_by = EXCLUDED.recorded_by, updated_at = now()`
          : '';
        await client.query(
          `INSERT INTO class_attendance (class_id, student_id, date, status, recorded_by)
           VALUES ${values.join(', ')} ${conflict}`,
          params
        );
        written += slice.length;
      }

      return {
        http: 200 as const,
        body: {
          monthsDetected: parsed.months,
          studentsMatched: parsed.students.length - unmatched.length,
          studentsUnmatched: unmatched,
          studentsEnrolled: toEnroll.size,
          recordsWritten: written,
          warnings,
        },
      };
    });

    return NextResponse.json(result.body, { status: result.http });
  } catch (e) {
    console.error('[/api/attendance/import]', e);
    return NextResponse.json({ error: 'Import failed' }, { status: 500 });
  }
}
