import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, verifyToken } from '../../../server/auth';
import { withUserContext } from '../../../server/db';
import { executeQuery } from '../../../server/query-executor';
import {
  authorizeDbRequest,
  publicLookupColumns,
  sanitizePublicRegistration,
} from '../../../server/authz';
import type { DbQueryRequest } from '../../../types/db-query';
import { NAMED_QUERIES } from '../../../server/named-queries';

export async function POST(req: NextRequest) {
  const token = getBearerToken(req.headers.get('authorization'));
  const user = token ? await verifyToken(token) : null;
  const body = (await req.json()) as DbQueryRequest & { query?: unknown; queryName?: string; params?: unknown[] };

  // Raw SQL from the browser is no longer accepted (it allowed SQL injection by
  // design: any admin session could run any statement). Use a named query.
  if (body.query !== undefined) {
    return NextResponse.json({ data: null, error: { message: 'Raw SQL is not accepted' } }, { status: 400 });
  }

  // Named queries: fixed SQL kept on the server (src/server/named-queries.ts);
  // the client only picks one by name and supplies bind parameters.
  if (body.queryName !== undefined) {
    if (!user) {
      return NextResponse.json({ data: null, error: { message: 'Not authenticated' } }, { status: 401 });
    }
    const named = typeof body.queryName === 'string' && Object.prototype.hasOwnProperty.call(NAMED_QUERIES, body.queryName)
      ? NAMED_QUERIES[body.queryName]
      : null;
    if (!named) {
      return NextResponse.json({ data: null, error: { message: 'Unknown query' } }, { status: 400 });
    }
    if (!(named.roles as readonly string[]).includes(user.role)) {
      return NextResponse.json({ data: null, error: { message: 'Forbidden' } }, { status: 403 });
    }
    const params = Array.isArray(body.params) ? body.params : [];
    const invalid = named.validate?.(params);
    if (invalid) {
      return NextResponse.json({ data: null, error: { message: invalid } }, { status: 400 });
    }

    const result = await withUserContext(user.id, async (client) => {
      try {
        const queryResult = await client.query(named.sql, params);
        return { rows: queryResult.rows, error: null };
      } catch (e: any) {
        console.error(`[/api/db] Named query ${body.queryName} failed:`, e.message);
        // Admin-only queries: the Postgres message (e.g. duplicate email) is what
        // the admin needs to see, and the SQL itself is fixed.
        const message = e.detail ? `${e.message} (${e.detail})` : e.message;
        return { rows: [], error: { message: message || 'Query failed' } };
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

  // Degree names for the public application form's dropdown.
  const isProgramList = body.action === 'select' && body.table === 'programs';

  // Location names for the public application form's dropdown.
  const isLocationList = body.action === 'select' && body.table === 'locations';

  if (!user) {
    if (isProgramList) {
      // Names of active degrees only — nothing else about them.
      body.select = 'name';
      body.filters = [{ op: 'eq', column: 'is_active', value: true }];
      body.or = undefined;
    } else if (isLocationList) {
      body.select = 'name';
      body.filters = [];
      body.or = undefined;
    } else if (isPublicInsert) {
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
