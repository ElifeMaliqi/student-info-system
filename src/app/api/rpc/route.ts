import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, verifyToken } from '../../../server/auth';
import { withUserContext } from '../../../server/db';
import { executeRpc } from '../../../server/query-executor';

export async function POST(req: NextRequest) {
  const token = getBearerToken(req.headers.get('authorization'));
  const user = token ? await verifyToken(token) : null;
  if (!user) {
    return NextResponse.json({ data: null, error: { message: 'Not authenticated' } }, { status: 401 });
  }

  const { fn, args } = (await req.json()) as { fn: string; args: Record<string, unknown> };
  const result = await withUserContext(user.id, (client) => executeRpc(client, fn, args ?? {}, user.id));
  return NextResponse.json(result, { status: result.error ? 400 : 200 });
}
