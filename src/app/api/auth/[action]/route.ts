import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, loginWithPassword, updatePassword, verifyToken } from '../../../../server/auth';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ action: string }> }
) {
  const { action } = await params;
  const body = await req.json().catch(() => ({}));

  if (action === 'login') {
    try {
      const { email, password } = body as { email: string; password: string };
      const { session, profile } = await loginWithPassword(email, password);
      return NextResponse.json({
        data: {
          user: { id: profile.id, email: profile.email },
          session,
        },
        error: null,
      });
    } catch (e) {
      return NextResponse.json(
        { data: null, error: { message: e instanceof Error ? e.message : 'Login failed' } },
        { status: 401 }
      );
    }
  }

  if (action === 'session' || action === 'user') {
    const token = getBearerToken(req.headers.get('authorization'));
    if (!token) return NextResponse.json({ data: { session: null, user: null }, error: null });
    const user = await verifyToken(token);
    if (!user) return NextResponse.json({ data: { session: null, user: null }, error: null });
    return NextResponse.json({
      data: {
        session: { access_token: token, user: { id: user.id, email: user.email } },
        user: { id: user.id, email: user.email },
      },
      error: null,
    });
  }

  if (action === 'logout') {
    return NextResponse.json({ data: {}, error: null });
  }

  if (action === 'update-password') {
    const token = getBearerToken(req.headers.get('authorization'));
    const authUser = token ? await verifyToken(token) : null;
    if (!authUser) {
      return NextResponse.json({ data: null, error: { message: 'Not authenticated' } }, { status: 401 });
    }
    try {
      await updatePassword(authUser.id, (body as { password: string }).password);
      return NextResponse.json({ data: { user: { id: authUser.id } }, error: null });
    } catch (e) {
      return NextResponse.json(
        { data: null, error: { message: e instanceof Error ? e.message : 'Update failed' } },
        { status: 400 }
      );
    }
  }

  return NextResponse.json({ error: { message: 'Unknown action' } }, { status: 404 });
}
