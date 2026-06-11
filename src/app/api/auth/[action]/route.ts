import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, generateResetToken, loginWithPassword, updatePassword, verifyResetToken, verifyToken } from '../../../../server/auth';
import { rateLimit, clientIp } from '../../../../server/rate-limit';
import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'noreply@futuremindsacademy.com';

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function buildResetEmailHtml(resetUrl: string, firstName: string): string {
  const safeFirst = escapeHtml(firstName);
  const safeUrl = escapeHtml(resetUrl);
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0f;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#111118;border-radius:16px;border:1px solid rgba(255,255,255,0.06);overflow:hidden;">
          <tr>
            <td style="background:linear-gradient(135deg,#fc0ce4 0%,#949ce4 100%);padding:32px 40px;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:600;letter-spacing:-0.3px;">Password Reset Request</h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">Future Minds Academy · Account Security</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 40px;">
              <div style="color:rgba(255,255,255,0.75);font-size:15px;line-height:1.7;">
                <p style="margin:0 0 16px;">Hello ${safeFirst},</p>
                <p style="margin:0 0 16px;">We received a request to reset the password for your Future Minds Academy account. Click the secure button below to set a new password.</p>
                <p style="margin:0 0 24px;">
                  <a href="${safeUrl}" style="display:inline-block;background:linear-gradient(135deg,#fc0ce4 0%,#949ce4 100%);color:#ffffff;text-decoration:none;padding:13px 28px;border-radius:10px;font-weight:600;font-size:14px;">Reset My Password</a>
                </p>
                <p style="margin:0 0 8px;color:rgba(255,255,255,0.5);font-size:13px;">This link expires in <strong style="color:rgba(255,255,255,0.75);">1 hour</strong> and can only be used once.</p>
                <p style="margin:0 0 16px;color:rgba(255,255,255,0.5);font-size:13px;">If the button does not work, copy and paste this URL into your browser:</p>
                <p style="margin:0 0 16px;word-break:break-all;"><a href="${safeUrl}" style="color:#b5b9ff;font-size:12px;">${safeUrl}</a></p>
                <p style="margin:16px 0 0;padding:16px;background:rgba(255,255,255,0.04);border-radius:8px;border-left:3px solid rgba(252,12,228,0.5);color:rgba(255,255,255,0.5);font-size:12px;">
                  If you did not request this, you can safely ignore this email. Your password will not change.
                </p>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 40px 28px;border-top:1px solid rgba(255,255,255,0.06);">
              <p style="margin:0;color:rgba(255,255,255,0.25);font-size:11px;text-align:center;">Future Minds Academy · Student Information System</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ action: string }> }
) {
  const { action } = await params;
  const body = await req.json().catch(() => ({}));

  if (action === 'login') {
    try {
      const { email, password } = body as { email: string; password: string };

      // Brute-force speed bump: cap attempts per IP and per email in a 15-min window.
      // Thresholds are generous so a classroom behind one NAT IP isn't locked out.
      const ip = clientIp(req);
      const normEmail = (email ?? '').toLowerCase().trim();
      const ipLimit = rateLimit(`login:ip:${ip}`, 50, 15 * 60_000);
      const emailLimit = rateLimit(`login:email:${normEmail}`, 10, 15 * 60_000);
      if (!ipLimit.ok || !emailLimit.ok) {
        const retryAfter = Math.max(ipLimit.retryAfterSec, emailLimit.retryAfterSec);
        return NextResponse.json(
          { data: null, error: { message: 'Too many login attempts. Please try again later.' } },
          { status: 429, headers: { 'Retry-After': String(retryAfter) } }
        );
      }

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

  if (action === 'request-password-reset') {
    const token = getBearerToken(req.headers.get('authorization'));
    const authUser = token ? await verifyToken(token) : null;
    if (!authUser) {
      return NextResponse.json({ error: { message: 'Not authenticated' } }, { status: 401 });
    }

    const resetToken = await generateResetToken(authUser.id);
    const base = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '');
    const resetUrl = `${base}/resetpassword#t=${resetToken}`;

    if (resend) {
      const { query } = await import('../../../../server/db');
      const { rows } = await query<{ first_name: string }>(
        `SELECT first_name FROM profiles WHERE id = $1`,
        [authUser.id]
      );
      const firstName = rows[0]?.first_name || 'there';

      await resend.emails.send({
        from: FROM_EMAIL,
        to: authUser.email,
        subject: 'Reset your password — FMA Student Portal',
        html: buildResetEmailHtml(resetUrl, firstName),
      });
    } else {
      console.log(`[request-password-reset] RESEND_API_KEY not set. Reset URL for ${authUser.email}: ${resetUrl}`);
    }

    return NextResponse.json({ success: true });
  }

  if (action === 'reset-password-with-token') {
    const { token, newPassword } = body as { token: string; newPassword: string };
    if (!token || !newPassword) {
      return NextResponse.json({ error: { message: 'Missing token or password.' } }, { status: 400 });
    }
    const userId = await verifyResetToken(token);
    if (!userId) {
      return NextResponse.json({ error: { message: 'This reset link is invalid or has expired.' } }, { status: 400 });
    }
    await updatePassword(userId, newPassword);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: { message: 'Unknown action' } }, { status: 404 });
}
