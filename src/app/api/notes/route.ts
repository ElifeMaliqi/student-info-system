import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, verifyToken } from '../../../server/auth';
import { query } from '../../../server/db';
import { PRIVILEGED_ROLES } from '../../../server/authz';

/**
 * Admin notes attached to admin actions. Admins and superadmins only.
 *
 * Visibility:
 *   shared  → every admin and superadmin
 *   private → the author; superadmins also see private notes written by admins
 *             (a superadmin's private note stays with that superadmin)
 * Only the author can edit or delete a note.
 *
 * GET  /api/notes            → all notes visible to the caller
 * GET  /api/notes?others=1   → same, minus the caller's own notes (nav bell)
 * POST /api/notes            → { area, action, note, isPrivate }
 * PATCH /api/notes           → { id, note, isPrivate }
 * DELETE /api/notes?id=...
 */

async function getUser(req: NextRequest) {
  const token = getBearerToken(req.headers.get('authorization'));
  const user = token ? await verifyToken(token) : null;
  if (!user) return { error: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) };
  if (!PRIVILEGED_ROLES.has(user.role)) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  return { user };
}

const SELECT_NOTES = `
  SELECT n.id, n.author_id, n.author_role, n.area, n.action, n.note, n.is_private,
         n.created_at, n.updated_at, p.first_name, p.last_name
  FROM admin_notes n
  LEFT JOIN profiles p ON p.id = n.author_id`;

export async function GET(req: NextRequest) {
  const { user, error } = await getUser(req);
  if (error) return error;

  const others = req.nextUrl.searchParams.get('others') === '1';
  const { rows } = await query(
    `${SELECT_NOTES}
     WHERE (n.is_private = false
            OR n.author_id = $1
            OR ($2 = 'superadmin' AND n.author_role <> 'superadmin'))
       AND ($3 = false OR n.author_id <> $1)
     ORDER BY n.created_at DESC`,
    [user.id, user.role, others]
  );
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const { user, error } = await getUser(req);
  if (error) return error;

  const body = await req.json().catch(() => null);
  const note = typeof body?.note === 'string' ? body.note.trim() : '';
  const area = typeof body?.area === 'string' ? body.area : '';
  const action = typeof body?.action === 'string' ? body.action.trim() : '';
  if (!note || !area || !action) {
    return NextResponse.json({ error: 'area, action and note are required' }, { status: 400 });
  }

  const { rows } = await query(
    `INSERT INTO admin_notes (author_id, author_role, area, action, note, is_private)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [user.id, user.role, area, action, note, body?.isPrivate === true]
  );
  return NextResponse.json(rows[0]);
}

export async function PATCH(req: NextRequest) {
  const { user, error } = await getUser(req);
  if (error) return error;

  const body = await req.json().catch(() => null);
  const id = typeof body?.id === 'string' ? body.id : '';
  const note = typeof body?.note === 'string' ? body.note.trim() : '';
  if (!id || !note) return NextResponse.json({ error: 'id and note are required' }, { status: 400 });

  const result = await query(
    `UPDATE admin_notes SET note = $1, is_private = $2, updated_at = now()
     WHERE id = $3 AND author_id = $4`,
    [note, body?.isPrivate === true, id, user.id]
  );
  if (result.rowCount === 0) return NextResponse.json({ error: 'Note not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { user, error } = await getUser(req);
  if (error) return error;

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const result = await query(`DELETE FROM admin_notes WHERE id = $1 AND author_id = $2`, [id, user.id]);
  if (result.rowCount === 0) return NextResponse.json({ error: 'Note not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
