import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, verifyToken } from '../../../server/auth';
import { withUserContext } from '../../../server/db';
import { executeQuery } from '../../../server/query-executor';
import type { DbQueryRequest } from '../../../types/db-query';
import { Pool } from 'pg';

export async function POST(req: NextRequest) {
  const token = getBearerToken(req.headers.get('authorization'));
  const user = token ? await verifyToken(token) : null;
  const body = (await req.json()) as DbQueryRequest & { query?: string; params?: any[] };

  // Support raw SQL queries for system_roles and role_permissions
  if (body.query) {
    if (!user) {
      return NextResponse.json({ data: null, error: { message: 'Not authenticated' } }, { status: 401 });
    }

    const result = await withUserContext(user.id, async (client) => {
      try {
        const queryResult = await client.query(body.query!, body.params || []);
        return { rows: queryResult.rows, error: null };
      } catch (e: any) {
        console.error('[/api/db] Query error:', e.message);
        return { rows: [], error: { message: e.message } };
      }
    });

    const status = result.error ? 400 : 200;
    return NextResponse.json(result, { status });
  }

  // Legacy format support
  const isPublicInsert =
    body.action === 'insert' && body.table === 'registration_applications';

  const isEmailLookup =
    body.action === 'select' &&
    (body.table === 'profiles' || body.table === 'registration_applications') &&
    body.filters?.length === 1 &&
    body.filters[0].op === 'eq' &&
    body.filters[0].column === 'email' &&
    !!body.maybeSingle;

  if (!user && !isPublicInsert && !isEmailLookup) {
    return NextResponse.json({ data: null, error: { message: 'Not authenticated' } }, { status: 401 });
  }

  const result = await withUserContext(user?.id ?? null, async (client) =>
    executeQuery(client, body)
  );

  const status = result.error ? 400 : 200;
  return NextResponse.json(result, { status });
}
