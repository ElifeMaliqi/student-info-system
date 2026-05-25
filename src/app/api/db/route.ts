import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, verifyToken } from '../../../server/auth';
import { withUserContext } from '../../../server/db';
import { executeQuery } from '../../../server/query-executor';
import type { DbQueryRequest } from '../../../types/db-query';

export async function POST(req: NextRequest) {
  const token = getBearerToken(req.headers.get('authorization'));
  const user = token ? await verifyToken(token) : null;
  const body = (await req.json()) as DbQueryRequest;

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
