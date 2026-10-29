import { Resend } from 'resend';
import { query } from './db';

// Email/SMS helpers shared by /api/notify and the server-side invoice sync.

// ── Providers ──────────────────────────────────────────────────────────────
export const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export function getFromEmail(): string {
  const raw = process.env.RESEND_FROM_EMAIL ?? 'info@futureminds.io';
  const match = raw.match(/<([^>]+)>/);
  return `Future Minds Academy <${(match?.[1] ?? raw).trim()}>`;
}

const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID ?? '';
const TWILIO_AUTH = process.env.TWILIO_AUTH_TOKEN ?? '';
const TWILIO_FROM = process.env.TWILIO_FROM_NUMBER ?? process.env.TWILIO_PHONE_NUMBER ?? '';

// ── Helpers ─────────────────────────────────────────────────────────────────
export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

export function interpolate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '');
}

export function normalizePhone(raw: string): string {
  const d = raw.replace(/[^+\d]/g, '');
  if (d.startsWith('+')) return d;
  if (d.startsWith('0')) return '+383' + d.slice(1);
  if (d.startsWith('383')) return '+' + d;
  return '+' + d;
}

export async function sendSms(to: string, body: string): Promise<void> {
  if (!TWILIO_SID || !TWILIO_AUTH || !TWILIO_FROM) throw new Error('Twilio not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER.');
  const auth = Buffer.from(`${TWILIO_SID}:${TWILIO_AUTH}`).toString('base64');
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ From: TWILIO_FROM, To: normalizePhone(to), Body: body }).toString(),
  });
  if (!res.ok) throw new Error(`Twilio error: ${res.status} ${await res.text()}`);
}

export async function getSmsTemplate(type: string, def: string): Promise<string> {
  try {
    const { rows } = await query<{ sms_body: string }>(`SELECT sms_body FROM message_templates WHERE type = $1`, [type]);
    return rows[0]?.sms_body ?? def;
  } catch { return def; }
}

// ── Email templates (admin-editable in Settings → Email Templates) ─────────
// Defaults mirror the seed rows in supabase/migrations/20261005000000_create_email_templates.sql
// and are used if the row is missing or the table can't be read.
export type EmailTemplate = { subject: string; body: string };

const EMAIL_DEFAULTS: Record<string, EmailTemplate> = {
  password_reset: {
    subject: 'Reset Your Password — Future Minds Academy',
    body: `Hello {{firstName}},\n\nWe received a request to reset the password for your Future Minds Academy account. Click the secure button below to proceed.\n\n{{resetButton}}\n\nIf you did not request this, you can safely ignore this email. Your password will not change.`,
  },
  announcement: {
    subject: '{{title}} — {{senderName}}',
    body: `{{content}}`,
  },
  attendance_alert: {
    subject: 'Attendance Alert from Future Minds Academy: {{studentName}}',
    body: `Hello {{studentName}},\n\nYour attendance rate in {{className}} is currently **{{attendanceRate}}%**, which is at or below the 40% threshold.\n\nPresent: **{{presentCount}}** / **{{totalCount}}** sessions.\n\nPlease contact your instructor or the administration team as soon as possible.\n\nWarm regards,\nFuture Minds Academy · Student Support Team`,
  },
  invoice_new: {
    subject: 'New Invoice from Future Minds Academy: {{invoiceTitle}}',
    body: `Hello {{studentName}},\n\nA new invoice "{{invoiceTitle}}" has been issued for you.\n\nInvoice ID: **{{invoiceId}}** · Class: {{className}} · Amount: **\${{amount}}** · Due: **{{dueDate}}** · Status: **{{status}}**\n\nWarm regards,\nFuture Minds Academy · Finance Department`,
  },
  invoice_updated: {
    subject: 'Updated Invoice from Future Minds Academy: {{invoiceTitle}}',
    body: `Hello {{studentName}},\n\nYour invoice "{{invoiceTitle}}" has been updated. Change: **{{changeSummary}}**.\n\nInvoice ID: **{{invoiceId}}** · Class: {{className}} · Amount: **\${{amount}}** · Due: **{{dueDate}}** · Status: **{{status}}**\n\nWarm regards,\nFuture Minds Academy · Finance Department`,
  },
  invoice_receipt: {
    subject: 'Payment Receipt from Future Minds Academy: {{invoiceTitle}}',
    body: `Hello {{studentName}},\n\nWe have received your payment for invoice "{{invoiceTitle}}". Thank you.\n\n{{receiptDetails}}\n\nPlease keep this email as your proof of payment.\n\nWarm regards,\nFuture Minds Academy · Finance Department`,
  },
  grade_new: {
    subject: 'Your Grade is Ready – {{examName}} | Future Minds Academy',
    body: `Hello **{{studentName}}**,\n\nYour exam **{{examName}}** has been graded.\n\n{{gradeDetails}}\n\n{{teacherNote}}\n\nWarm regards,\n**Future Minds Academy**`,
  },
  grade_updated: {
    subject: 'Grade Updated – {{examName}} | Future Minds Academy',
    body: `Hello **{{studentName}}**,\n\nYour grade for **{{examName}}** has been **updated**.\n\n{{gradeDetails}}\n\n{{teacherNote}}\n\nWarm regards,\n**Future Minds Academy**`,
  },
  class_cancelled: {
    subject: 'Class Cancelled: {{className}} | Future Minds Academy',
    body: `Hello {{studentName}},\n\nYour class **{{className}}** scheduled for **{{originalDate}}** has been **cancelled**.\n\n{{reasonBox}}\n\nIf you have any questions, please contact us.\n\nWarm regards,\nFuture Minds Academy`,
  },
  class_rescheduled: {
    subject: 'Class Rescheduled: {{className}} | Future Minds Academy',
    body: `Hello {{studentName}},\n\nYour class **{{className}}** scheduled for **{{originalDate}}** has been **rescheduled**.\n\n{{newSchedule}}\n\n{{reasonBox}}\n\nIf you have any questions, please contact us.\n\nWarm regards,\nFuture Minds Academy`,
  },
};

export async function getEmailTemplate(type: string): Promise<EmailTemplate> {
  const def = EMAIL_DEFAULTS[type];
  try {
    const { rows } = await query<EmailTemplate>(`SELECT subject, body FROM email_templates WHERE type = $1`, [type]);
    return rows[0]?.subject && rows[0]?.body ? rows[0] : def;
  } catch { return def; }
}

export function renderEmailSubject(tpl: string, vars: Record<string, string>): string {
  return interpolate(tpl, vars).replace(/\s+/g, ' ').trim();
}

// Blank lines separate paragraphs, **text** is bold, {{var}} is replaced (HTML-escaped).
// A paragraph that is only {{blockName}} becomes that pre-built HTML block. Blocks the
// template leaves out are appended at the end so key details (reset link, amounts) are never lost.
export function renderEmailBody(tpl: string, vars: Record<string, string>, blocks: Record<string, string> = {}): string {
  const used = new Set<string>();
  const parts = tpl.replace(/\r\n/g, '\n').split(/\n\s*\n/).map(p => p.trim()).filter(Boolean).map(p => {
    const only = p.match(/^\{\{(\w+)\}\}$/);
    if (only && only[1] in blocks) { used.add(only[1]); return blocks[only[1]]; }
    const html = esc(p)
      .replace(/\*\*(.+?)\*\*/g, '<strong style="color:#ffffff;">$1</strong>')
      .replace(/\{\{(\w+)\}\}/g, (_, k) => esc(vars[k] ?? ''))
      .replace(/\n/g, '<br>');
    return `<p style="margin:0 0 16px;">${html}</p>`;
  });
  for (const [k, html] of Object.entries(blocks)) if (!used.has(k)) parts.push(html);
  return parts.filter(Boolean).join('\n');
}

export const EMAIL_FOOTER = `<tr><td style="padding:20px 40px 28px;border-top:1px solid rgba(255,255,255,0.06);">
<p style="margin:0;color:rgba(255,255,255,0.25);font-size:11px;text-align:center;">Future Minds Academy · Student Information System</p>
</td></tr></table></td></tr></table></body></html>`;

export function emailContent(contentHtml: string): string {
  return `<tr><td style="padding:32px 40px;"><div style="color:rgba(255,255,255,0.75);font-size:15px;line-height:1.7;">
${contentHtml}
</div></td></tr>`;
}

export function buildInvoiceEmailHtml(invoiceTitle: string, isUpdated: boolean, contentHtml: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background-color:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0f;padding:40px 20px;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background-color:#111118;border-radius:16px;border:1px solid rgba(255,255,255,0.06);overflow:hidden;">
<tr><td style="background:linear-gradient(135deg,#fc0ce4 0%,#949ce4 100%);padding:32px 40px;">
<h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:600;">${esc(invoiceTitle)}</h1>
<p style="margin:8px 0 0;color:rgba(255,255,255,0.8);font-size:13px;">${isUpdated ? 'Invoice Update' : 'Invoice Notification'}</p></td></tr>
${emailContent(contentHtml)}
${EMAIL_FOOTER}`;
}

export function buildInvoiceReceiptEmailHtml(invoiceTitle: string, contentHtml: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background-color:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0f;padding:40px 20px;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background-color:#111118;border-radius:16px;border:1px solid rgba(255,255,255,0.06);overflow:hidden;">
<tr><td style="background:linear-gradient(135deg,#fc0ce4 0%,#949ce4 100%);padding:32px 40px;">
<h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:600;">${esc(invoiceTitle)}</h1>
<p style="margin:8px 0 0;color:rgba(255,255,255,0.8);font-size:13px;">Payment Receipt</p></td></tr>
${emailContent(contentHtml)}
${EMAIL_FOOTER}`;
}

export function buildReceiptDetailsHtml(className: string, invoiceId: string, amount: string, paidOn: string): string {
  const row = (label: string, value: string, last = false) =>
    `<tr><td style="padding:8px 0;${last ? '' : 'border-bottom:1px solid rgba(255,255,255,0.06);'}"><span style="color:rgba(255,255,255,0.4);font-size:12px;">${label}</span></td><td style="padding:8px 0;${last ? '' : 'border-bottom:1px solid rgba(255,255,255,0.06);'}text-align:right;">${value}</td></tr>`;
  return `<table width="100%" cellpadding="0" cellspacing="0" style="background-color:rgba(255,255,255,0.04);border-radius:12px;border:1px solid rgba(255,255,255,0.08);margin-bottom:24px;"><tr><td style="padding:20px 24px;">
<table width="100%">
${row('Invoice ID', `<strong style="color:#ffffff;">${esc(invoiceId)}</strong>`)}
${row('Class', `<span style="color:#ffffff;">${esc(className)}</span>`)}
${row('Amount paid', `<strong style="color:#ffffff;">€${esc(amount)}</strong>`)}
${row('Payment date', `<span style="color:#ffffff;">${esc(paidOn)}</span>`)}
${row('Status', `<span style="color:#10b981;font-weight:700;">Paid</span>`, true)}
</table></td></tr></table>`;
}

// Sends an invoice email (new, updated or payment receipt). Fields are validated by the caller.
export async function sendInvoiceEmail(body: Record<string, unknown>): Promise<void> {
  if (!resend) throw new Error('Email provider not configured');
  const { studentEmail, studentName, className, invoiceTitle, invoiceId, amount, dueDate, status, mode, changeSummary } = body;

  if (mode === 'receipt') {
    const paidOn = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const tpl = await getEmailTemplate('invoice_receipt');
    const vars = {
      studentName: String(studentName), className: String(className), invoiceTitle: String(invoiceTitle),
      invoiceId: String(invoiceId), amount: Number(amount).toFixed(2), paidOn,
    };
    await resend.emails.send({
      from: getFromEmail(),
      to: studentEmail as string,
      subject: renderEmailSubject(tpl.subject, vars),
      html: buildInvoiceReceiptEmailHtml(vars.invoiceTitle, renderEmailBody(tpl.body, vars, {
        receiptDetails: buildReceiptDetailsHtml(vars.className, vars.invoiceId, vars.amount, paidOn),
      })),
    });
    return;
  }

  const isUpdated = mode === 'updated';
  const formattedAmount = Number(amount).toFixed(2);
  const formattedDue = new Date(String(dueDate)).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const formattedStatus = (String(status ?? 'not_paid')).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  const tpl = await getEmailTemplate(isUpdated ? 'invoice_updated' : 'invoice_new');
  const vars = {
    studentName: String(studentName), className: String(className), invoiceTitle: String(invoiceTitle),
    invoiceId: String(invoiceId), amount: formattedAmount, dueDate: formattedDue, status: formattedStatus,
    changeSummary: String(changeSummary || 'details were updated'),
  };
  await resend.emails.send({
    from: getFromEmail(),
    to: studentEmail as string,
    subject: renderEmailSubject(tpl.subject, vars),
    html: buildInvoiceEmailHtml(vars.invoiceTitle, isUpdated, renderEmailBody(tpl.body, vars)),
  });
}

export async function sendInvoiceSms(body: Record<string, unknown>, templateType: string): Promise<void> {
  const { studentPhone, studentName, className, amount, dueDate, status } = body;

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
}
