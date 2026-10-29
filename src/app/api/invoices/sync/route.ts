import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, verifyToken } from '../../../../server/auth';
import { syncInvoices } from '../../../../server/invoice-sync';

// Called when the Finance page opens. The same sync also runs every hour on the
// server (src/instrumentation.ts), so opening the page is not required.
export async function POST(req: NextRequest) {
  const token = getBearerToken(req.headers.get('authorization'));
  const user = token ? await verifyToken(token) : null;
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (user.role === 'student') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    await syncInvoices();
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Invoice sync failed:', e);
    return NextResponse.json({ error: 'Invoice sync failed' }, { status: 500 });
  }
}
