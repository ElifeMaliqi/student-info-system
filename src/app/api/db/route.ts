import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, verifyToken } from '../../../server/auth';
import { publicErrorMessage, query, withUserContext } from '../../../server/db';
import { executeQuery, type EmbedPolicy } from '../../../server/query-executor';
import {
  authorizeDbRequest,
  publicLookupColumns,
  sanitizePublicRegistration,
} from '../../../server/authz';
import type { DbQueryRequest } from '../../../types/db-query';
import { NAMED_QUERIES } from '../../../server/named-queries';
import { logImpersonatedAction, sqlActivity } from '../../../server/impersonation';

// Structured actions that change data, for the impersonation activity log.
function writeActivityOf(action: unknown): 'add' | 'edit' | 'delete' | null {
  if (action === 'insert') return 'add';
  if (action === 'upsert' || action === 'update') return 'edit';
  if (action === 'delete') return 'delete';
  return null;
}
const ACTIVITY_VERB = { add: 'Added', edit: 'Updated', delete: 'Deleted' } as const;

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
        // Duplicate-key and our own exception messages are what the admin needs
        // to see (e.g. duplicate email); other database errors stay on the server.
        return { rows: [], error: { message: publicErrorMessage(e, 'Query failed') } };
      }
    });

    const namedActivity = sqlActivity(named.sql);
    if (!result.error && namedActivity) {
      await logImpersonatedAction(user, namedActivity, `${ACTIVITY_VERB[namedActivity]} while impersonating – ${body.queryName}`);
    }

    const status = result.error ? 400 : 200;
    return NextResponse.json(result, { status });
  }

  let embedPolicy: EmbedPolicy | undefined;

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
    embedPolicy = decision.embedPolicy;
    if (decision.allowed && decision.eventScope) {
      const { rows } = await query<{ id: string }>(
        `SELECT id FROM calendar_events WHERE created_by = $1
         UNION SELECT event_id FROM calendar_event_participants WHERE user_id = $1`,
        [user.id]
      );
      body.filters = [...(body.filters || []), { op: 'in', column: decision.eventScope, value: rows.map((r) => r.id) }];
    }
    if (decision.allowed && decision.ownEventIds) {
      const ids = [...new Set(decision.ownEventIds.map(String))];
      const { rows } = await query<{ n: number }>(
        `SELECT count(*)::int AS n FROM calendar_events WHERE id::text = ANY($1::text[]) AND created_by = $2`,
        [ids, user.id]
      );
      if (!ids.length || rows[0]?.n !== ids.length) {
        return NextResponse.json({ data: null, error: { message: 'Forbidden' } }, { status: 403 });
      }
    }
    if (!decision.allowed) {
      return NextResponse.json(
        { data: null, error: { message: decision.message || 'Forbidden' } },
        { status: decision.status || 403 }
      );
    }
  }

  const result = await withUserContext(user?.id ?? null, async (client) =>
    executeQuery(client, body, embedPolicy)
  );

  const writeActivity = writeActivityOf(body.action);
  if (user && !result.error && writeActivity) {
    await logImpersonatedAction(user, writeActivity, `${ACTIVITY_VERB[writeActivity]} while impersonating – ${body.table}`);
  }

  const status = result.error ? 400 : 200;
  return NextResponse.json(result, { status });
}
