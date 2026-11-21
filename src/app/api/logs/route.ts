import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, verifyToken } from '../../../server/auth';
import { query } from '../../../server/db';
import { PRIVILEGED_ROLES } from '../../../server/authz';

/**
 * Activity log of admin/superadmin actions (Settings > Logs, superadmin only).
 *
 * POST /api/logs  { area, description }  → admins and superadmins; called after
 *   every admin action (from saveNote). The user comes from the session token.
 * GET  /api/logs  → superadmins only; newest first, PAGE_SIZE rows per page.
 *   ?page=1            1-based page number
 *   ?user=<name>       only this user's actions (matched on the stored name, so
 *                      actions by since-deleted accounts can still be filtered)
 *   ?activity=add|edit|delete
 *   ?from=YYYY-MM-DD&to=YYYY-MM-DD   inclusive days, school time (Europe/Belgrade)
 *   Returns { rows, total, page, pageSize, users } — users = every name in the log,
 *   for the User filter.
 */

const PAGE_SIZE = 25;
const SCHOOL_TZ = 'Europe/Belgrade';
const isDay = (v: string | null): v is string => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

type Activity = 'add' | 'edit' | 'delete';

/**
 * Add / Edit / Delete from the action description the app writes, e.g.
 * "Student enrolled – Ana Learnerz" or "Invoice deleted – …". Only the part
 * before " – " (the verb phrase) is looked at, so names can't change the result.
 */
function classify(description: string): Activity {
  const verb = description.split(' – ')[0].toLowerCase();
  if (/\b(deleted|removed|cancelled)\b/.test(verb)) return 'delete';
  if (/\b(created|added|enrolled|imported|assigned|approved)\b/.test(verb)) return 'add';
  return 'edit';
}

async function getUser(req: NextRequest) {
  const token = getBearerToken(req.headers.get('authorization'));
  const user = token ? await verifyToken(token) : null;
  if (!user) return { error: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) };
  if (!PRIVILEGED_ROLES.has(user.role)) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  return { user };
}

export async function POST(req: NextRequest) {
  const { user, error } = await getUser(req);
  if (error) return error;

  const body = await req.json().catch(() => null);
  const area = typeof body?.area === 'string' ? body.area.trim().slice(0, 50) : '';
  const description = typeof body?.description === 'string' ? body.description.trim().slice(0, 2000) : '';
  if (!area || !description) {
    return NextResponse.json({ error: 'area and description are required' }, { status: 400 });
  }

  await query(
    `INSERT INTO activity_logs (user_id, user_name, user_role, activity, area, description)
     SELECT p.id, trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), p.role, $2, $3, $4
     FROM profiles p WHERE p.id = $1`,
    [user.id, classify(description), area, description]
  );
  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  const { user, error } = await getUser(req);
  if (error) return error;
  if (user.role !== 'superadmin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const sp = req.nextUrl.searchParams;
  const page = Math.max(1, Math.floor(Number(sp.get('page')) || 1));
  const userName = sp.get('user')?.trim() || null;
  const activityParam = sp.get('activity');
  const activity = activityParam === 'add' || activityParam === 'edit' || activityParam === 'delete' ? activityParam : null;
  const from = sp.get('from');
  const to = sp.get('to');

  // Every value is a bind parameter; NULL means "no filter".
  const where = `
    WHERE ($1::text IS NULL OR user_name = $1::text)
      AND ($2::text IS NULL OR activity = $2::text)
      AND ($3::date IS NULL OR created_at >= ($3::date)::timestamp AT TIME ZONE '${SCHOOL_TZ}')
      AND ($4::date IS NULL OR created_at <  ($4::date + 1)::timestamp AT TIME ZONE '${SCHOOL_TZ}')`;
  const filterParams = [userName, activity, isDay(from) ? from : null, isDay(to) ? to : null];

  const [{ rows }, { rows: countRows }, { rows: userRows }] = await Promise.all([
    query(
      `SELECT id, user_name, user_role, activity, area, description, created_at
       FROM activity_logs ${where}
       ORDER BY created_at DESC, id DESC
       LIMIT ${PAGE_SIZE} OFFSET $5`,
      [...filterParams, (page - 1) * PAGE_SIZE]
    ),
    query(`SELECT count(*)::int AS total FROM activity_logs ${where}`, filterParams),
    query(`SELECT DISTINCT user_name FROM activity_logs ORDER BY user_name`),
  ]);

  return NextResponse.json({
    rows,
    total: countRows[0]?.total ?? 0,
    page,
    pageSize: PAGE_SIZE,
    users: userRows.map((r) => r.user_name),
  });
}
