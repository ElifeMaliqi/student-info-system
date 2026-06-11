import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, verifyToken } from '../../../server/auth';
import { withUserContext } from '../../../server/db';
import { executeQuery } from '../../../server/query-executor';
import {
  authorizeDbRequest,
  PRIVILEGED_ROLES,
  publicLookupColumns,
  sanitizePublicRegistration,
} from '../../../server/authz';
import type { DbQueryRequest } from '../../../types/db-query';

export async function POST(req: NextRequest) {
  const token = getBearerToken(req.headers.get('authorization'));
  const user = token ? await verifyToken(token) : null;
  const body = (await req.json()) as DbQueryRequest & { query?: string; params?: any[] };

  // Raw SQL passthrough — used by privileged admin tooling (role management,
  // invoice creation, account provisioning). Restricted to admins/superadmins so
  // a logged-in student or teacher can't run arbitrary SQL.
  if (body.query) {
    if (!user) {
      return NextResponse.json({ data: null, error: { message: 'Not authenticated' } }, { status: 401 });
    }
    if (!PRIVILEGED_ROLES.has(user.role)) {
      return NextResponse.json({ data: null, error: { message: 'Forbidden' } }, { status: 403 });
    }

    const result = await withUserContext(user.id, async (client) => {
      try {
        const queryResult = await client.query(body.query!, body.params || []);
        return { rows: queryResult.rows, error: null };
      } catch (e: any) {
        console.error('[/api/db] Query error:', e.message);
        return { rows: [], error: { message: 'Query failed' } };
      }
    });

    const status = result.error ? 400 : 200;
    return NextResponse.json(result, { status });
  }

  // ── Unauthenticated public surface (registration screen only) ──────────────
  const isPublicInsert =
    body.action === 'insert' && body.table === 'registration_applications';

  const isEmailLookup =
    body.action === 'select' &&
    (body.table === 'profiles' || body.table === 'registration_applications') &&
    body.filters?.length === 1 &&
    body.filters[0].op === 'eq' &&
    body.filters[0].column === 'email' &&
    !!body.maybeSingle;

  if (!user) {
    if (isPublicInsert) {
      // Force a safe shape: students only, pending status, no review/identity fields.
      body.body = sanitizePublicRegistration(body.body);
    } else if (isEmailLookup) {
      // Clamp returned columns to an existence/status check — never full PII.
      const cols = publicLookupColumns(body.table);
      if (!cols) {
        return NextResponse.json({ data: null, error: { message: 'Forbidden' } }, { status: 403 });
      }
      body.select = cols;
    } else {
      return NextResponse.json({ data: null, error: { message: 'Not authenticated' } }, { status: 401 });
    }
  } else {
    // Authenticated: enforce role-based access (may inject ownership filters).
    const decision = authorizeDbRequest(user, body);
    if (!decision.allowed) {
      return NextResponse.json(
        { data: null, error: { message: decision.message || 'Forbidden' } },
        { status: decision.status || 403 }
      );
    }
  }

  const result = await withUserContext(user?.id ?? null, async (client) =>
    executeQuery(client, body)
  );

  const status = result.error ? 400 : 200;
  return NextResponse.json(result, { status });
}
