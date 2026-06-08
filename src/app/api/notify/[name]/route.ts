import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, verifyToken, updatePassword } from '../../../../server/auth';
import { query } from '../../../../server/db';
import { Resend } from 'resend';
import crypto from 'crypto';

// ── Providers ──────────────────────────────────────────────────────────────
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

function getFromEmail(): string {
  const raw = process.env.RESEND_FROM_EMAIL ?? 'info@futureminds.io';
  const match = raw.match(/<([^>]+)>/);
  return `Future Minds Academy <${(match?.[1] ?? raw).trim()}>`;
}

const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID ?? '';
const TWILIO_AUTH = process.env.TWILIO_AUTH_TOKEN ?? '';
const TWILIO_FROM = process.env.TWILIO_FROM_NUMBER ?? process.env.TWILIO_PHONE_NUMBER ?? '';

// ── Helpers ─────────────────────────────────────────────────────────────────
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function interpolate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '');
}

function normalizePhone(raw: string): string {
  const d = raw.replace(/[^+\d]/g, '');
  if (d.startsWith('+')) return d;
  if (d.startsWith('0')) return '+383' + d.slice(1);
  if (d.startsWith('383')) return '+' + d;
  return '+' + d;
}

async function sendSms(to: string, body: string): Promise<void> {
  if (!TWILIO_SID || !TWILIO_AUTH || !TWILIO_FROM) throw new Error('Twilio not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER.');
  const auth = Buffer.from(`${TWILIO_SID}:${TWILIO_AUTH}`).toString('base64');
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ From: TWILIO_FROM, To: normalizePhone(to), Body: body }).toString(),
  });
  if (!res.ok) throw new Error(`Twilio error: ${res.status} ${await res.text()}`);
}

async function getSmsTemplate(type: string, def: string): Promise<string> {
  try {
    const { rows } = await query<{ sms_body: string }>(`SELECT sms_body FROM message_templates WHERE type = $1`, [type]);
    return rows[0]?.sms_body ?? def;
  } catch { return def; }
}

async function assertNonStudent(userId: string): Promise<void> {
  const { rows } = await query<{ role: string }>(`SELECT role FROM profiles WHERE id = $1`, [userId]);
  if (!rows[0] || rows[0].role === 'student') throw new Error('Permission denied');
}

// ── Main handler ────────────────────────────────────────────────────────────
export async function POST(req: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const body = await req.json().catch(() => ({}));

  const publicFns = ['send-reset-access-code', 'verify-identity-reset-password', 'send-password-reset-email'];
  const token = getBearerToken(req.headers.get('authorization'));
  const user = token ? await verifyToken(token) : null;

  if (!user && !publicFns.includes(name)) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    switch (name) {
      case 'send-reset-access-code':          return await handleSendResetCode(body);
      case 'verify-identity-reset-password':  return await handleVerifyIdentity(body);
      case 'send-password-reset-email':       return await handlePasswordResetEmail(body);
      case 'send-announcement-email':         return await handleAnnouncementEmail(body, user!);
      case 'send-announcement-sms':           return await handleAnnouncementSms(body, user!);
      case 'send-attendance-alert-email':     return await handleAttendanceAlertEmail(body, user!);
      case 'send-attendance-alert-sms':       return await handleAttendanceAlertSms(body, user!);
      case 'send-invoice-email':              return await handleInvoiceEmail(body, user!);
      case 'send-invoice-sms':                return await handleInvoiceSms(body, 'invoice', user!);
      case 'send-invoice-changed-sms':        return await handleInvoiceSms(body, 'invoice_changed', user!);
      case 'send-grade-email':                return await handleGradeEmail(body, user!);
      case 'send-grade-sms':                  return await handleGradeSms(body, user!);
      case 'send-grade-changed-sms':          return await handleGradeChangedSms(body, user!);
      case 'send-class-update-email':         return await handleClassUpdateEmail(body, user!);
      case 'send-class-update-sms':           return await handleClassUpdateSms(body, user!);
      default:
        return NextResponse.json({ error: `Unknown function: ${name}` }, { status: 404 });
    }
  } catch (err) {
    console.error(`[notify/${name}]`, err);
    return NextResponse.json({ success: false, error: 'An error occurred. Please try again.' }, { status: 500 });
  }
}

// ════════════════════════════════════════════════════════════════════════════
// PUBLIC: Forgot-password flow
// ════════════════════════════════════════════════════════════════════════════

async function handleSendResetCode(body: Record<string, unknown>) {
  const ok = NextResponse.json({ success: true });
  const email = ((body.email as string) ?? '').trim().toLowerCase();
  if (!email || !email.includes('@')) return ok;

  const { rows: profileRows } = await query<{ first_name: string }>(
    `SELECT first_name FROM profiles WHERE email = $1`,
    [email]
  );
  if (!profileRows[0]) return ok; // silent — no user enumeration

  // Rate-limit: one token per 60s
  const { rows: latestRows } = await query<{ created_at: string }>(
    `SELECT created_at FROM password_reset_tokens WHERE email = $1 ORDER BY created_at DESC LIMIT 1`,
    [email]
  );
  if (latestRows[0]) {
    const elapsed = Date.now() - new Date(latestRows[0].created_at).getTime();
    if (elapsed < 60_000) return ok;
  }

  const resetToken = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  await query(`DELETE FROM password_reset_tokens WHERE email = $1`, [email]);
  await query(
    `INSERT INTO password_reset_tokens (token, email, expires_at) VALUES ($1, $2, $3)`,
    [resetToken, email, expiresAt]
  );

  const base = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '');
  const resetLink = `${base}/resetpassword#t=${resetToken}`;
  const firstName = profileRows[0].first_name ?? 'there';

  if (resend) {
    await resend.emails.send({
      from: getFromEmail(),
      to: email,
      subject: 'Password Reset Access — Future Minds Academy',
      html: buildResetCodeEmailHtml(resetLink, firstName),
    });
  } else {
    console.log(`[send-reset-access-code] No RESEND_API_KEY. Link for ${email}: ${resetLink}`);
  }

  return ok;
}

async function handleVerifyIdentity(body: Record<string, unknown>) {
  const email = ((body.email as string) ?? '').trim().toLowerCase();
  const firstName = ((body.firstName as string) ?? '').trim().toLowerCase();
  const lastName = ((body.lastName as string) ?? '').trim().toLowerCase();
  const parentName = ((body.parentName as string) ?? '').trim().toLowerCase();
  const phone = ((body.phone as string) ?? '').trim().replace(/\s+/g, '');
  const accessToken = ((body.accessToken as string) ?? '').trim();
  const newPassword = body.newPassword as string | undefined;

  if (!accessToken) return NextResponse.json({ success: false, error: 'Invalid or missing reset link. Please request a new one.' }, { status: 400 });
  if (!email || !firstName || !lastName || !parentName || !phone) return NextResponse.json({ success: false, error: 'All fields are required.' }, { status: 400 });

  const { rows: tokenRows } = await query<{
    id: string; email: string; expires_at: string; used: boolean; failed_attempts: number; locked: boolean;
  }>(
    `SELECT id, email, expires_at, used, failed_attempts, locked FROM password_reset_tokens WHERE token = $1`,
    [accessToken]
  );

  const tokenRow = tokenRows[0];
  if (!tokenRow) return NextResponse.json({ success: false, error: 'Invalid or expired reset link. Please request a new one.' }, { status: 400 });
  if (tokenRow.locked) return NextResponse.json({ success: false, error: 'Too many failed attempts. Please request a new reset link.' }, { status: 429 });
  if (tokenRow.used) return NextResponse.json({ success: false, error: 'This reset link has already been used. Please request a new one.' }, { status: 400 });
  if (new Date(tokenRow.expires_at) < new Date()) return NextResponse.json({ success: false, error: 'This reset link has expired. Please request a new one.' }, { status: 400 });
  if (tokenRow.email.toLowerCase() !== email) return NextResponse.json({ success: false, error: 'Identity verification failed. Please check all fields and try again.' }, { status: 400 });

  const { rows: profileRows } = await query<{
    id: string; first_name: string; last_name: string; parent_first_name: string; phone: string; secondary_phone: string;
  }>(
    `SELECT id, first_name, last_name, parent_first_name, phone, secondary_phone FROM profiles WHERE email = $1`,
    [email]
  );

  async function recordFailure(tokenId: string, attempts: number) {
    const newAttempts = attempts + 1;
    const shouldLock = newAttempts >= 5;
    await query(`UPDATE password_reset_tokens SET failed_attempts = $1, locked = $2 WHERE id = $3`, [newAttempts, shouldLock, tokenId]);
    return shouldLock;
  }

  if (!profileRows[0]) {
    const locked = await recordFailure(tokenRow.id, tokenRow.failed_attempts);
    const msg = locked ? 'Too many failed attempts. Please request a new reset link.' : 'Identity verification failed. Please check all fields and try again.';
    return NextResponse.json({ success: false, error: msg }, { status: locked ? 429 : 400 });
  }

  const p = profileRows[0];
  const dbPhone = (p.phone ?? '').trim().replace(/\s+/g, '');
  const dbPhone2 = (p.secondary_phone ?? '').trim().replace(/\s+/g, '');

  const matches =
    firstName === (p.first_name ?? '').trim().toLowerCase() &&
    lastName === (p.last_name ?? '').trim().toLowerCase() &&
    parentName === (p.parent_first_name ?? '').trim().toLowerCase() &&
    (phone === dbPhone || phone === dbPhone2);

  if (!matches) {
    const locked = await recordFailure(tokenRow.id, tokenRow.failed_attempts);
    const msg = locked ? 'Too many failed attempts. Please request a new reset link.' : 'Identity verification failed. Please check all fields and try again.';
    return NextResponse.json({ success: false, error: msg }, { status: locked ? 429 : 400 });
  }

  if (newPassword) {
    if (newPassword.length < 8) return NextResponse.json({ success: false, error: 'Password must be at least 8 characters.' }, { status: 400 });
    await updatePassword(p.id, newPassword);
    await query(`UPDATE password_reset_tokens SET used = true WHERE token = $1`, [accessToken]);
    return NextResponse.json({ success: true, passwordChanged: true });
  }

  return NextResponse.json({ success: true, verified: true });
}

async function handlePasswordResetEmail(body: Record<string, unknown>) {
  // Called from Login "Forgot?" — sends a reset link by email without requiring auth
  const ok = NextResponse.json({ success: true });
  const email = ((body.email as string) ?? '').trim().toLowerCase();
  if (!email || !email.includes('@')) return ok;

  const { rows } = await query<{ id: string; first_name: string }>(
    `SELECT id, first_name FROM profiles WHERE email = $1`,
    [email]
  );
  if (!rows[0]) return ok;

  const { generateResetToken } = await import('../../../../server/auth');
  const resetToken = await generateResetToken(rows[0].id);
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '');
  const resetLink = `${base}/resetpassword#t=${resetToken}`;

  if (resend) {
    await resend.emails.send({
      from: getFromEmail(),
      to: email,
      subject: 'Reset Your Password — Future Minds Academy',
      html: buildResetCodeEmailHtml(resetLink, rows[0].first_name ?? 'there'),
    });
  } else {
    console.log(`[send-password-reset-email] No RESEND_API_KEY. Link for ${email}: ${resetLink}`);
  }

  return ok;
}

// ════════════════════════════════════════════════════════════════════════════
// ANNOUNCEMENTS
// ════════════════════════════════════════════════════════════════════════════

async function resolveEmailRecipients(audience: string, programId?: string, classId?: string): Promise<string[]> {
  let emails: string[] = [];
  if (audience === 'all') {
    const { rows } = await query<{ email: string }>(`SELECT email FROM profiles WHERE role IN ('student','teacher','admin') AND email IS NOT NULL`);
    emails = rows.map(r => r.email);
  } else if (audience === 'students') {
    const { rows } = await query<{ email: string }>(`SELECT email FROM profiles WHERE role = 'student' AND email IS NOT NULL`);
    emails = rows.map(r => r.email);
  } else if (audience === 'teachers') {
    const { rows } = await query<{ email: string }>(`SELECT email FROM profiles WHERE role = 'teacher' AND email IS NOT NULL`);
    emails = rows.map(r => r.email);
  } else if (audience === 'admins') {
    const { rows } = await query<{ email: string }>(`SELECT email FROM profiles WHERE role = 'admin' AND email IS NOT NULL`);
    emails = rows.map(r => r.email);
  } else if (audience === 'program_specific' && programId) {
    const { rows } = await query<{ email: string }>(
      `SELECT DISTINCT p.email FROM profiles p
       JOIN class_enrollments ce ON ce.student_id = p.id
       JOIN classes c ON c.id = ce.class_id
       WHERE c.program_id = $1 AND ce.status = 'active' AND p.email IS NOT NULL`,
      [programId]
    );
    emails = rows.map(r => r.email);
  } else if (audience === 'class_specific' && classId) {
    const { rows } = await query<{ email: string }>(
      `SELECT p.email FROM profiles p
       JOIN class_enrollments ce ON ce.student_id = p.id
       WHERE ce.class_id = $1 AND ce.status = 'active' AND p.email IS NOT NULL`,
      [classId]
    );
    emails = rows.map(r => r.email);
  }
  return [...new Set(emails.filter(Boolean))];
}

async function resolvePhoneRecipients(audience: string, programId?: string, classId?: string): Promise<string[]> {
  let phones: string[] = [];
  if (audience === 'all') {
    const { rows } = await query<{ phone: string }>(`SELECT phone FROM profiles WHERE role IN ('student','teacher','admin') AND phone IS NOT NULL`);
    phones = rows.map(r => r.phone);
  } else if (audience === 'students') {
    const { rows } = await query<{ phone: string }>(`SELECT phone FROM profiles WHERE role = 'student' AND phone IS NOT NULL`);
    phones = rows.map(r => r.phone);
  } else if (audience === 'teachers') {
    const { rows } = await query<{ phone: string }>(`SELECT phone FROM profiles WHERE role = 'teacher' AND phone IS NOT NULL`);
    phones = rows.map(r => r.phone);
  } else if (audience === 'admins') {
    const { rows } = await query<{ phone: string }>(`SELECT phone FROM profiles WHERE role = 'admin' AND phone IS NOT NULL`);
    phones = rows.map(r => r.phone);
  } else if (audience === 'program_specific' && programId) {
    const { rows } = await query<{ phone: string }>(
      `SELECT DISTINCT p.phone FROM profiles p
       JOIN class_enrollments ce ON ce.student_id = p.id
       JOIN classes c ON c.id = ce.class_id
       WHERE c.program_id = $1 AND ce.status = 'active' AND p.phone IS NOT NULL`,
      [programId]
    );
    phones = rows.map(r => r.phone);
  } else if (audience === 'class_specific' && classId) {
    const { rows } = await query<{ phone: string }>(
      `SELECT p.phone FROM profiles p
       JOIN class_enrollments ce ON ce.student_id = p.id
       WHERE ce.class_id = $1 AND ce.status = 'active' AND p.phone IS NOT NULL`,
      [classId]
    );
    phones = rows.map(r => r.phone);
  }
  return [...new Set(phones.filter(Boolean).map(normalizePhone))];
}

async function handleAnnouncementEmail(body: Record<string, unknown>, user: { id: string }) {
  await assertNonStudent(user.id);
  const { title, content, audience, programId, classId, senderName } = body as Record<string, string>;
  if (!title || !content || !audience) return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });

  const emails = await resolveEmailRecipients(audience, programId, classId);
  if (!emails.length) return NextResponse.json({ success: true, sent: 0, total: 0, message: 'No recipients found' });

  if (!resend) return NextResponse.json({ success: false, error: 'Email provider not configured' }, { status: 500 });

  const subject = `${title} — ${senderName}`;
  const html = buildAnnouncementEmailHtml(title, content, senderName);
  const batchSize = 50;
  let sent = 0;

  for (let i = 0; i < emails.length; i += batchSize) {
    const batch = emails.slice(i, i + batchSize);
    const res = await fetch('https://api.resend.com/emails/batch', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(batch.map(to => ({ from: getFromEmail(), to: [to], subject, html }))),
    });
    if (res.ok) sent += batch.length;
  }

  return NextResponse.json({ success: true, sent, total: emails.length });
}

async function handleAnnouncementSms(body: Record<string, unknown>, user: { id: string }) {
  await assertNonStudent(user.id);
  const { title, content, audience, programId, classId, senderName } = body as Record<string, string>;
  if (!title || !content || !audience) return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });

  const phones = await resolvePhoneRecipients(audience, programId, classId);
  if (!phones.length) return NextResponse.json({ success: true, sent: 0, total: 0, message: 'No recipients with phone numbers found' });

  const tpl = await getSmsTemplate('announcement', `Future Minds Academy\n\n{{title}}\n\n{{content}}\n\n— {{senderName}}`);
  const smsBody = interpolate(tpl, { title, content: content.length > 400 ? content.slice(0, 397) + '…' : content, senderName });

  let sent = 0;
  for (const phone of phones) {
    try { await sendSms(phone, smsBody); sent++; } catch { /* continue */ }
  }

  return NextResponse.json({ success: true, sent, total: phones.length });
}

// ════════════════════════════════════════════════════════════════════════════
// ATTENDANCE ALERTS
// ════════════════════════════════════════════════════════════════════════════

async function handleAttendanceAlertEmail(body: Record<string, unknown>, user: { id: string }) {
  await assertNonStudent(user.id);
  const { studentEmail, studentName, className, attendanceRate, presentCount, totalCount } = body as Record<string, unknown>;
  if (!studentEmail || !studentName || !className || attendanceRate == null || presentCount == null || totalCount == null)
    return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });

  if (!resend) return NextResponse.json({ success: false, error: 'Email provider not configured' }, { status: 500 });

  await resend.emails.send({
    from: getFromEmail(),
    to: studentEmail as string,
    subject: `Attendance Alert from Future Minds Academy: ${studentName}`,
    html: buildAttendanceAlertEmailHtml(String(studentName), String(className), Number(attendanceRate), Number(presentCount), Number(totalCount)),
  });

  return NextResponse.json({ success: true });
}

async function handleAttendanceAlertSms(body: Record<string, unknown>, user: { id: string }) {
  await assertNonStudent(user.id);
  const { studentPhone, studentName, className, attendanceRate, presentCount, totalCount } = body as Record<string, unknown>;
  if (!studentPhone || !studentName || !className || attendanceRate == null || presentCount == null || totalCount == null)
    return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });

  const tpl = await getSmsTemplate('attendance_alert',
    `Future Minds Academy — Attendance Alert\n\nHi {{studentName}},\n\nYour attendance in "{{className}}" is currently {{attendanceRate}}% ({{presentCount}} of {{totalCount}} sessions attended).\n\nThis is below the required minimum. Please contact us as soon as possible.\n\nStudent Support Team`);

  const smsBody = interpolate(tpl, {
    studentName: String(studentName), className: String(className),
    attendanceRate: String(attendanceRate), presentCount: String(presentCount), totalCount: String(totalCount),
  });

  await sendSms(String(studentPhone), smsBody);
  return NextResponse.json({ success: true });
}

// ════════════════════════════════════════════════════════════════════════════
// INVOICES
// ════════════════════════════════════════════════════════════════════════════

async function handleInvoiceEmail(body: Record<string, unknown>, user: { id: string }) {
  await assertNonStudent(user.id);
  const { studentEmail, studentName, className, invoiceTitle, invoiceId, amount, dueDate, status, mode, changeSummary } = body as Record<string, unknown>;
  if (!studentEmail || !studentName || !className || !invoiceTitle || !invoiceId || !dueDate || amount == null)
    return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });

  if (!resend) return NextResponse.json({ success: false, error: 'Email provider not configured' }, { status: 500 });

  const isUpdated = mode === 'updated';
  const formattedAmount = Number(amount).toFixed(2);
  const formattedDue = new Date(String(dueDate)).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const formattedStatus = (String(status ?? 'not_paid')).replace(/_/g, ' ');

  await resend.emails.send({
    from: getFromEmail(),
    to: studentEmail as string,
    subject: isUpdated ? `Updated Invoice from Future Minds Academy: ${invoiceTitle}` : `New Invoice from Future Minds Academy: ${invoiceTitle}`,
    html: buildInvoiceEmailHtml(String(studentName), String(className), String(invoiceTitle), String(invoiceId), formattedAmount, formattedDue, formattedStatus, isUpdated, String(changeSummary ?? '')),
  });

  return NextResponse.json({ success: true });
}

async function handleInvoiceSms(body: Record<string, unknown>, templateType: string, user: { id: string }) {
  await assertNonStudent(user.id);
  const { studentPhone, studentName, className, amount, dueDate, status } = body as Record<string, unknown>;
  if (!studentPhone || !studentName || !className || amount == null || !status)
    return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });

  const defaultTpl = templateType === 'invoice_changed'
    ? `Future Minds Academy — Invoice Updated\n\nHi {{studentName}},\n\nYour invoice for "{{className}}" has been updated.\n\nAmount: €{{amount}}\nDue: {{dueDate}}\nStatus: {{status}}\n\nLog in to your portal to view and complete payment.`
    : `Future Minds Academy — Invoice Notice\n\nHi {{studentName}},\n\nA new invoice has been issued.\n\nClass: {{className}}\nAmount: €{{amount}}\nDue: {{dueDate}}\nStatus: {{status}}\n\nLog in to your portal to view and complete payment.`;

  const tpl = await getSmsTemplate(templateType, defaultTpl);
  const formattedDue = dueDate ? new Date(String(dueDate)).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A';

  const smsBody = interpolate(tpl, {
    studentName: String(studentName), className: String(className),
    amount: Number(amount).toFixed(2), dueDate: formattedDue, status: String(status),
  });

  await sendSms(String(studentPhone), smsBody);
  return NextResponse.json({ success: true });
}

// ════════════════════════════════════════════════════════════════════════════
// GRADES
// ════════════════════════════════════════════════════════════════════════════

async function handleGradeEmail(body: Record<string, unknown>, user: { id: string }) {
  await assertNonStudent(user.id);
  const { studentEmail, studentName, examName, className, teacherName, totalPoints, passed, note, mode } = body as Record<string, unknown>;
  if (!studentEmail || !studentName || !examName || !className || !teacherName || totalPoints == null || passed == null)
    return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });

  if (!resend) return NextResponse.json({ success: false, error: 'Email provider not configured' }, { status: 500 });

  const isUpdated = mode === 'updated';
  await resend.emails.send({
    from: getFromEmail(),
    to: studentEmail as string,
    subject: isUpdated ? `Grade Updated – ${examName} | Future Minds Academy` : `Your Grade is Ready – ${examName} | Future Minds Academy`,
    html: buildGradeEmailHtml(String(studentName), String(examName), String(className), String(teacherName), Number(totalPoints), Boolean(passed), note as string | undefined, isUpdated),
  });

  return NextResponse.json({ success: true });
}

async function handleGradeSms(body: Record<string, unknown>, user: { id: string }) {
  await assertNonStudent(user.id);
  const { studentPhone, studentName, examName, className, teacherName, totalPoints, passed, note, mode } = body as Record<string, unknown>;
  if (!studentPhone || !studentName || !examName || !className || !teacherName || totalPoints == null || passed == null)
    return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });

  const tpl = await getSmsTemplate('grade',
    `Future Minds Academy — Grade {{mode}}\n\nHi {{studentName}},\n\nExam: {{examName}}\nClass: {{className}}\nResult: {{resultLabel}} | {{totalPoints}}/100{{noteSection}}\n\nTeacher: {{teacherName}}`);

  const modeLabel = mode === 'updated' ? 'Updated' : 'Posted';
  const smsBody = interpolate(tpl, {
    studentName: String(studentName), examName: String(examName), className: String(className),
    teacherName: String(teacherName), mode: modeLabel,
    resultLabel: passed ? 'Passed' : 'Failed',
    totalPoints: String(totalPoints),
    noteSection: note ? `\nNote: ${note}` : '',
  });

  await sendSms(String(studentPhone), smsBody);
  return NextResponse.json({ success: true });
}

async function handleGradeChangedSms(body: Record<string, unknown>, user: { id: string }) {
  await assertNonStudent(user.id);
  const { studentPhone, studentName, examName, className, teacherName, oldPoints, oldPassed, newPoints, newPassed, note } = body as Record<string, unknown>;
  if (!studentPhone || !studentName || !examName || !className || !teacherName || oldPoints == null || newPoints == null || oldPassed == null || newPassed == null)
    return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });

  const tpl = await getSmsTemplate('grade_changed',
    `Future Minds Academy — Grade Correction\n\nHi {{studentName}},\n\nYour grade for "{{examName}}" in {{className}} has been revised.\n\nPrevious: {{oldPoints}}/100 ({{oldResult}})\nNew:      {{newPoints}}/100 ({{newResult}}){{noteSection}}\n\nTeacher: {{teacherName}}`);

  const smsBody = interpolate(tpl, {
    studentName: String(studentName), examName: String(examName), className: String(className),
    teacherName: String(teacherName), oldPoints: String(oldPoints), newPoints: String(newPoints),
    oldResult: oldPassed ? 'Passed' : 'Failed', newResult: newPassed ? 'Passed' : 'Failed',
    noteSection: note ? `\nNote: ${note}` : '',
  });

  await sendSms(String(studentPhone), smsBody);
  return NextResponse.json({ success: true });
}

// ════════════════════════════════════════════════════════════════════════════
// CLASS UPDATES
// ════════════════════════════════════════════════════════════════════════════

async function handleClassUpdateEmail(body: Record<string, unknown>, user: { id: string }) {
  await assertNonStudent(user.id);
  const { studentEmail, studentName, className, originalDate, updateType, newDate, newStartTime, newEndTime, reason } = body as Record<string, unknown>;
  if (!studentEmail || !studentName || !className || !originalDate || !updateType)
    return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });

  if (!resend) return NextResponse.json({ success: false, error: 'Email provider not configured' }, { status: 500 });

  const isCancelled = updateType === 'cancelled';
  await resend.emails.send({
    from: getFromEmail(),
    to: studentEmail as string,
    subject: isCancelled ? `Class Cancelled: ${className} | Future Minds Academy` : `Class Rescheduled: ${className} | Future Minds Academy`,
    html: buildClassUpdateEmailHtml(String(studentName), String(className), String(originalDate), String(updateType), newDate as string | undefined, newStartTime as string | undefined, newEndTime as string | undefined, reason as string | undefined),
  });

  return NextResponse.json({ success: true });
}

async function handleClassUpdateSms(body: Record<string, unknown>, user: { id: string }) {
  await assertNonStudent(user.id);
  const { studentPhone, studentName, className, originalDate, updateType, newDate, newStartTime, newEndTime, reason } = body as Record<string, unknown>;
  if (!studentPhone || !studentName || !className || !originalDate || !updateType)
    return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });

  const tpl = await getSmsTemplate('class_update',
    `Future Minds Academy — Class Update\n\nHi {{studentName}},\n\nYour class "{{className}}" originally scheduled for {{originalDate}} has been {{updateType}}.{{newScheduleSection}}{{reasonSection}}`);

  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
  const newTime = newStartTime && newEndTime ? `${newStartTime} – ${newEndTime}` : (newStartTime as string | undefined) ?? '';
  const newScheduleSection = updateType === 'rescheduled' && newDate
    ? `\n\nNew date: ${fmtDate(String(newDate))}${newTime ? `\nNew time: ${newTime}` : ''}` : '';
  const reasonSection = reason ? `\nReason: ${reason}` : '';

  const smsBody = interpolate(tpl, {
    studentName: String(studentName), className: String(className),
    originalDate: fmtDate(String(originalDate)), updateType: String(updateType),
    newScheduleSection, reasonSection,
  });

  await sendSms(String(studentPhone), smsBody);
  return NextResponse.json({ success: true });
}

// ════════════════════════════════════════════════════════════════════════════
// EMAIL HTML BUILDERS (exact template styling from existing Supabase functions)
// ════════════════════════════════════════════════════════════════════════════

function buildResetCodeEmailHtml(resetLink: string, firstName: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0f;padding:40px 20px;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background-color:#111118;border-radius:16px;border:1px solid rgba(255,255,255,0.06);overflow:hidden;">
<tr><td style="background:linear-gradient(135deg,#fc0ce4 0%,#949ce4 100%);padding:32px 40px;">
<h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:600;letter-spacing:-0.3px;">Password Reset Request</h1>
<p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">Future Minds Academy · Account Security</p></td></tr>
<tr><td style="padding:32px 40px;"><div style="color:rgba(255,255,255,0.75);font-size:15px;line-height:1.7;">
<p style="margin:0 0 16px;">Hello ${esc(firstName)},</p>
<p style="margin:0 0 16px;">We received a request to reset the password for your Future Minds Academy account. Click the secure button below to proceed.</p>
<p style="margin:0 0 24px;"><a href="${esc(resetLink)}" style="display:inline-block;background:linear-gradient(135deg,#fc0ce4 0%,#949ce4 100%);color:#ffffff;text-decoration:none;padding:13px 28px;border-radius:10px;font-weight:600;font-size:14px;">Reset My Password</a></p>
<p style="margin:0 0 8px;color:rgba(255,255,255,0.5);font-size:13px;">This link expires in <strong style="color:rgba(255,255,255,0.75);">1 hour</strong> and can only be used once.</p>
<p style="margin:0 0 16px;color:rgba(255,255,255,0.5);font-size:13px;">If the button does not work, copy and paste this URL into your browser:</p>
<p style="margin:0 0 16px;word-break:break-all;"><a href="${esc(resetLink)}" style="color:#b5b9ff;font-size:12px;">${esc(resetLink)}</a></p>
<p style="margin:16px 0 0;padding:16px;background:rgba(255,255,255,0.04);border-radius:8px;border-left:3px solid rgba(252,12,228,0.5);color:rgba(255,255,255,0.5);font-size:12px;">If you did not request this, you can safely ignore this email. Your password will not change.</p>
</div></td></tr>
<tr><td style="padding:20px 40px 28px;border-top:1px solid rgba(255,255,255,0.06);">
<p style="margin:0;color:rgba(255,255,255,0.25);font-size:11px;text-align:center;">Future Minds Academy · Student Information System</p>
</td></tr></table></td></tr></table></body></html>`;
}

function buildAnnouncementEmailHtml(title: string, content: string, senderName: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background-color:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0f;padding:40px 20px;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background-color:#111118;border-radius:16px;border:1px solid rgba(255,255,255,0.06);overflow:hidden;">
<tr><td style="background:linear-gradient(135deg,#fc0ce4 0%,#949ce4 100%);padding:32px 40px;">
<h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:600;letter-spacing:-0.3px;">${esc(title)}</h1>
<p style="margin:8px 0 0;color:rgba(255,255,255,0.8);font-size:13px;">From ${esc(senderName)}</p></td></tr>
<tr><td style="padding:32px 40px;"><div style="color:rgba(255,255,255,0.75);font-size:15px;line-height:1.7;white-space:pre-wrap;">${esc(content)}</div></td></tr>
<tr><td style="padding:20px 40px 28px;border-top:1px solid rgba(255,255,255,0.06);">
<p style="margin:0;color:rgba(255,255,255,0.25);font-size:11px;text-align:center;">Future Minds · Student Information System</p>
</td></tr></table></td></tr></table></body></html>`;
}

function buildAttendanceAlertEmailHtml(studentName: string, className: string, attendanceRate: number, presentCount: number, totalCount: number): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background-color:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0f;padding:40px 20px;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background-color:#111118;border-radius:16px;border:1px solid rgba(255,255,255,0.06);overflow:hidden;">
<tr><td style="background:linear-gradient(135deg,#fc0ce4 0%,#949ce4 100%);padding:32px 40px;">
<h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:600;">Attendance Alert</h1>
<p style="margin:8px 0 0;color:rgba(255,255,255,0.8);font-size:13px;">Future Minds Academy Student Support</p></td></tr>
<tr><td style="padding:32px 40px;"><div style="color:rgba(255,255,255,0.75);font-size:15px;line-height:1.7;">
<p style="margin:0 0 16px;">Hello ${esc(studentName)},</p>
<p style="margin:0 0 16px;">Your attendance rate in ${esc(className)} is currently <strong style="color:#ffffff;">${attendanceRate}%</strong>, which is at or below the 40% threshold.</p>
<p style="margin:0 0 16px;">Present: <strong style="color:#ffffff;">${presentCount}</strong> / <strong style="color:#ffffff;">${totalCount}</strong> sessions.</p>
<p style="margin:0;">Please contact your instructor or the administration team as soon as possible.<br><br>Warm regards,<br>Future Minds Academy · Student Support Team</p>
</div></td></tr>
<tr><td style="padding:20px 40px 28px;border-top:1px solid rgba(255,255,255,0.06);">
<p style="margin:0;color:rgba(255,255,255,0.25);font-size:11px;text-align:center;">Future Minds Academy · Student Information System</p>
</td></tr></table></td></tr></table></body></html>`;
}

function buildInvoiceEmailHtml(studentName: string, className: string, invoiceTitle: string, invoiceId: string, amount: string, dueDate: string, status: string, isUpdated: boolean, changeSummary: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background-color:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0f;padding:40px 20px;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background-color:#111118;border-radius:16px;border:1px solid rgba(255,255,255,0.06);overflow:hidden;">
<tr><td style="background:linear-gradient(135deg,#fc0ce4 0%,#949ce4 100%);padding:32px 40px;">
<h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:600;">${esc(invoiceTitle)}</h1>
<p style="margin:8px 0 0;color:rgba(255,255,255,0.8);font-size:13px;">${isUpdated ? 'Invoice Update' : 'Invoice Notification'}</p></td></tr>
<tr><td style="padding:32px 40px;"><div style="color:rgba(255,255,255,0.75);font-size:15px;line-height:1.7;">
<p style="margin:0 0 16px;">Hello ${esc(studentName)},</p>
<p style="margin:0 0 16px;">${isUpdated ? `Your invoice "${esc(invoiceTitle)}" has been updated. Change: <strong style="color:#ffffff;">${esc(changeSummary || 'details were updated')}</strong>.` : `A new invoice "${esc(invoiceTitle)}" has been issued for you.`}</p>
<p style="margin:0 0 16px;">Invoice ID: <strong style="color:#ffffff;">${esc(invoiceId)}</strong> · Class: ${esc(className)} · Amount: <strong style="color:#ffffff;">$${esc(amount)}</strong> · Due: <strong style="color:#ffffff;">${esc(dueDate)}</strong> · Status: <strong style="color:#ffffff;text-transform:capitalize;">${esc(status)}</strong></p>
<p style="margin:0;">Warm regards,<br>Future Minds Academy · Finance Department</p>
</div></td></tr>
<tr><td style="padding:20px 40px 28px;border-top:1px solid rgba(255,255,255,0.06);">
<p style="margin:0;color:rgba(255,255,255,0.25);font-size:11px;text-align:center;">Future Minds Academy · Student Information System</p>
</td></tr></table></td></tr></table></body></html>`;
}

function buildGradeEmailHtml(studentName: string, examName: string, className: string, teacherName: string, totalPoints: number, passed: boolean, note: string | undefined, isUpdated: boolean): string {
  const resultColor = passed ? '#10b981' : '#ef4444';
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background-color:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0f;padding:40px 20px;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background-color:#111118;border-radius:16px;border:1px solid rgba(255,255,255,0.06);overflow:hidden;">
<tr><td style="background:linear-gradient(135deg,#fc0ce4 0%,#949ce4 100%);padding:32px 40px;">
<p style="margin:0 0 6px;color:rgba(255,255,255,0.7);font-size:12px;text-transform:uppercase;letter-spacing:1.5px;">${isUpdated ? 'Grade Update' : 'Grade Notification'}</p>
<h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">${esc(examName)}</h1>
<p style="margin:8px 0 0;color:rgba(255,255,255,0.75);font-size:13px;">${esc(className)} · Graded by ${esc(teacherName)}</p></td></tr>
<tr><td style="padding:32px 40px;"><div style="color:rgba(255,255,255,0.75);font-size:15px;line-height:1.7;">
<p style="margin:0 0 20px;">Hello <strong style="color:#ffffff;">${esc(studentName)}</strong>,</p>
<p style="margin:0 0 24px;">${isUpdated ? `Your grade for <strong style="color:#ffffff;">${esc(examName)}</strong> has been <strong style="color:#ffffff;">updated</strong>.` : `Your exam <strong style="color:#ffffff;">${esc(examName)}</strong> has been graded.`}</p>
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:rgba(255,255,255,0.04);border-radius:12px;border:1px solid rgba(255,255,255,0.08);margin-bottom:24px;"><tr><td style="padding:20px 24px;">
<table width="100%"><tr><td style="padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.06);"><span style="color:rgba(255,255,255,0.4);font-size:12px;">Result</span></td><td style="padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.06);text-align:right;"><span style="color:${resultColor};font-weight:700;">${passed ? 'Passed' : 'Failed'}</span></td></tr>
<tr><td style="padding:6px 0;"><span style="color:rgba(255,255,255,0.4);font-size:12px;">Points</span></td><td style="padding:6px 0;text-align:right;"><span style="color:#ffffff;font-weight:700;">${totalPoints}<span style="color:rgba(255,255,255,0.3);font-weight:400;"> / 100</span></span></td></tr>
</table></td></tr></table>
${note ? `<p style="margin:0 0 16px;padding:14px 18px;background:rgba(252,12,228,0.07);border-radius:10px;border:1px solid rgba(252,12,228,0.18);font-size:14px;"><strong style="color:rgba(252,12,228,0.8);display:block;margin-bottom:4px;font-size:11px;text-transform:uppercase;">Note from teacher</strong>${esc(note)}</p>` : ''}
<p style="margin:0;">Warm regards,<br><strong style="color:#ffffff;">Future Minds Academy</strong></p>
</div></td></tr>
<tr><td style="padding:20px 40px 28px;border-top:1px solid rgba(255,255,255,0.06);">
<p style="margin:0;color:rgba(255,255,255,0.25);font-size:11px;text-align:center;">Future Minds Academy · Student Information System</p>
</td></tr></table></td></tr></table></body></html>`;
}

function buildClassUpdateEmailHtml(studentName: string, className: string, originalDate: string, updateType: string, newDate?: string, newStartTime?: string, newEndTime?: string, reason?: string): string {
  const isCancelled = updateType === 'cancelled';
  const accent = isCancelled ? '#ef4444' : '#fc0ce4';
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const newTime = newStartTime && newEndTime ? `${newStartTime} – ${newEndTime}` : newStartTime ?? null;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background-color:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0f;padding:40px 20px;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background-color:#111118;border-radius:16px;border:1px solid rgba(255,255,255,0.06);overflow:hidden;">
<tr><td style="background:linear-gradient(135deg,${accent} 0%,#949ce4 100%);padding:32px 40px;">
<p style="margin:0 0 6px;color:rgba(255,255,255,0.7);font-size:12px;text-transform:uppercase;letter-spacing:1.5px;">${isCancelled ? 'Class Cancellation' : 'Class Reschedule'}</p>
<h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">${esc(className)}</h1>
<p style="margin:8px 0 0;color:rgba(255,255,255,0.75);font-size:13px;">Future Minds Academy</p></td></tr>
<tr><td style="padding:32px 40px;"><div style="color:rgba(255,255,255,0.75);font-size:15px;line-height:1.7;">
<p style="margin:0 0 16px;">Hello ${esc(studentName)},</p>
<p style="margin:0 0 16px;">${isCancelled
  ? `Your class <strong style="color:#ffffff;">${esc(className)}</strong> scheduled for <strong style="color:#ffffff;">${esc(fmtDate(originalDate))}</strong> has been <strong style="color:${accent};">cancelled</strong>.`
  : `Your class <strong style="color:#ffffff;">${esc(className)}</strong> scheduled for <strong style="color:#ffffff;">${esc(fmtDate(originalDate))}</strong> has been <strong style="color:${accent};">rescheduled</strong>.`}</p>
${!isCancelled && (newDate || newTime) ? `<table cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 20px;"><tr><td style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:18px 20px;">${newDate ? `<p style="margin:0 0 8px;font-size:13px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:1px;font-weight:600;">New Date</p><p style="margin:0 0 14px;font-size:16px;font-weight:600;color:#ffffff;">${esc(fmtDate(newDate))}</p>` : ''}${newTime ? `<p style="margin:0 0 8px;font-size:13px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:1px;font-weight:600;">New Time</p><p style="margin:0;font-size:16px;font-weight:600;color:#ffffff;">${esc(newTime)}</p>` : ''}</td></tr></table>` : ''}
${reason ? `<p style="margin:0 0 16px;padding:14px 18px;background:rgba(255,255,255,0.04);border-left:3px solid ${accent};border-radius:0 8px 8px 0;"><strong style="color:#ffffff;display:block;margin-bottom:4px;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Reason</strong>${esc(reason)}</p>` : ''}
<p style="margin:0;">If you have any questions, please contact us.<br><br>Warm regards,<br>Future Minds Academy</p>
</div></td></tr>
<tr><td style="padding:20px 40px 28px;border-top:1px solid rgba(255,255,255,0.06);">
<p style="margin:0;color:rgba(255,255,255,0.25);font-size:11px;text-align:center;">Future Minds Academy · Student Information System</p>
</td></tr></table></td></tr></table></body></html>`;
}
