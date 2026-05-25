import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, verifyToken } from '../../../../server/auth';

/** Placeholder for former Supabase Edge Functions (SMS/email). Wire providers here later. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const token = getBearerToken(req.headers.get('authorization'));
  const user = token ? await verifyToken(token) : null;

  const publicFns = ['send-reset-access-code', 'verify-identity-reset-password'];
  if (!user && !publicFns.includes(name)) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  await req.json().catch(() => ({}));
  console.log(`[notify/${name}] stub — configure email/SMS provider`);

  if (name === 'verify-identity-reset-password') {
    return NextResponse.json({ success: true, message: 'Notification service not configured on server' });
  }

  return NextResponse.json({ sent: 0, total: 0, message: 'Notification service not configured on server' });
}
