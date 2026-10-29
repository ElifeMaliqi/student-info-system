import crypto from 'crypto';
import type { PoolClient } from 'pg';
import { getPool } from './db';
import { sendInvoiceEmail, sendInvoiceSms } from './notify';
import { effectiveAge, priceForAge, parseAgePrices } from '../utils/age';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// Days of the month (issue window, cut-off, overdue) are counted in the school's time zone,
// not the server's, so the hourly run and a Finance page open agree on what "today" is.
const SCHOOL_TIME_ZONE = 'Europe/Belgrade';

// Held while a sync runs so the hourly run, Finance page opens and other server
// processes never issue the same month twice at once.
const SYNC_LOCK_KEY = 4207311;

const HOUR = 60 * 60 * 1000;

function schoolDate(d: Date): { y: number; m: number; day: number } {
  const [y, m, day] = new Intl.DateTimeFormat('en-CA', {
    timeZone: SCHOOL_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d).split('-').map(Number);
  return { y, m, day };
}

function generateInvoiceId(year: number, month: number): string {
  const rand = crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
  return `INV-${year}${String(month).padStart(2, '0')}-${rand}`;
}

/**
 * Auto-generate missing invoices. Only the current month is issued: a month is issued
 * between issue_start_day and issue_end_day; the joining month is issued only when the
 * student joined on or before enrollment_cutoff_day. Then marks overdue invoices.
 */
export async function syncInvoices(): Promise<void> {
  const client = await getPool().connect();
  try {
    const { rows } = await client.query<{ ok: boolean }>('SELECT pg_try_advisory_lock($1) AS ok', [SYNC_LOCK_KEY]);
    if (!rows[0]?.ok) return; // another sync is running right now
    try {
      await runSync(client);
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [SYNC_LOCK_KEY]);
    }
  } finally {
    client.release();
  }
}

async function runSync(client: PoolClient): Promise<void> {
  // 1. Settings (global defaults)
  const { rows: settingsRows } = await client.query('SELECT * FROM invoice_settings LIMIT 1');
  const s = settingsRows[0] || { default_amount: 60, title_template: '{class} - {month}', discount_percent: 0, due_day: 1, age_prices: [] };
  const agePrices = parseAgePrices(s.age_prices);

  // 2. Per-student overrides
  const { rows: overrides } = await client.query('SELECT * FROM student_invoice_overrides');
  const ovrMap = new Map<string, any>();
  for (const o of overrides) ovrMap.set(o.student_id, o);

  // 3. All enrollments with class info (no status filter — same approach as SMS dedup fix)
  const { rows: enrollments } = await client.query(`
    SELECT ce.id, ce.student_id, ce.class_id, ce.enrolled_at, c.title AS class_title,
           p.id AS profile_id, p.first_name, p.last_name, p.email, p.phone, p.age, p.date_of_birth
      FROM class_enrollments ce
      LEFT JOIN classes c ON c.id = ce.class_id
      LEFT JOIN profiles p ON p.id = ce.student_id`);
  if (enrollments.length === 0) return;

  // 4. All existing invoices — the DB unique constraint covers all, so skip any month that already has one.
  //    Soft-deleted rows are included on purpose: their key must keep this slot
  //    occupied, otherwise sync would resurrect every invoice an admin removes.
  const { rows: existing } = await client.query('SELECT enrollment_id, month, year FROM invoices');
  const existingKeys = new Set(existing.map((r: any) => `${r.enrollment_id}-${r.month}-${r.year}`));

  // 5. Compute missing invoices for the current month.
  const today = schoolDate(new Date());
  const curMonth = today.m;
  const curYear = today.y;
  const cutoffDay = s.enrollment_cutoff_day ?? 3;
  const inIssueWindow = today.day >= (s.issue_start_day ?? 1) && today.day <= (s.issue_end_day ?? 7);

  const toInsert: any[] = [];
  const pendingInvoiceEmails: Record<string, unknown>[] = [];
  const pendingInvoiceSms: Record<string, unknown>[] = [];
  for (const enr of enrollments) {
    if (!enr.enrolled_at) continue;
    const enrolled = schoolDate(new Date(enr.enrolled_at));
    const enrolledIdx = enrolled.y * 12 + enrolled.m - 1;
    const curIdx = curYear * 12 + curMonth - 1;
    if (enrolledIdx > curIdx) continue;
    if (enrolledIdx === curIdx ? enrolled.day > cutoffDay : !inIssueWindow) continue;
    const y = curYear;
    const m = curMonth;
    if (existingKeys.has(`${enr.id}-${m}-${y}`)) continue;
    const className = enr.class_title || 'Class';
    const studentName = enr.profile_id ? `${enr.first_name || ''} ${enr.last_name || ''}`.trim() : 'Student';
    const studentEmail = enr.email || '';
    const studentPhone = enr.phone || '';

    // Resolve per-student override, else the price for the student's age, else the default
    const ovr = ovrMap.get(enr.student_id);
    const baseAmount = ovr?.custom_amount != null
      ? parseFloat(ovr.custom_amount)
      : priceForAge(effectiveAge(enr.age, enr.date_of_birth), agePrices, parseFloat(s.default_amount));
    const disc = ovr?.custom_discount_percent != null ? parseFloat(ovr.custom_discount_percent) : parseFloat(s.discount_percent);
    const dueDay = Math.min(ovr?.custom_due_day != null ? parseInt(ovr.custom_due_day) : parseInt(s.due_day), 28);
    const titleTpl = ovr?.custom_title_template || (s.title_template as string);
    const amount = baseAmount * (1 - disc / 100);

    const title = titleTpl
      .replace('{class}', className)
      .replace('{month}', `${MONTHS[m - 1]} ${y}`);
    const dueM = m === 12 ? 1 : m + 1;
    const dueY = m === 12 ? y + 1 : y;
    const dueDate = `${dueY}-${String(dueM).padStart(2, '0')}-${String(dueDay).padStart(2, '0')}`;
    const roundedAmount = Math.round(amount * 100) / 100;
    const invoiceId = generateInvoiceId(y, m);
    toInsert.push([enr.id, enr.student_id, enr.class_id, invoiceId, title, m, y, dueDate, roundedAmount, disc, 'not_paid', false]);

    if (studentEmail) {
      pendingInvoiceEmails.push({
        studentEmail, studentName, className, invoiceTitle: title, invoiceId,
        amount: roundedAmount, dueDate, status: 'not_paid', mode: 'created',
      });
    }
    if (studentPhone) {
      pendingInvoiceSms.push({
        studentPhone, studentName, className, amount: roundedAmount, dueDate, status: 'not_paid', mode: 'created',
      });
    }
  }

  if (toInsert.length > 0) {
    const cols = ['enrollment_id', 'student_id', 'class_id', 'invoice_id', 'title', 'month', 'year', 'due_date', 'amount', 'discount_percent', 'status', 'is_manual'];
    const values = toInsert.map((row, i) => `(${row.map((_: unknown, j: number) => `$${i * cols.length + j + 1}`).join(', ')})`);
    await client.query(`INSERT INTO invoices (${cols.join(', ')}) VALUES ${values.join(', ')}`, toInsert.flat());

    // Send one email per newly generated invoice without blocking invoice creation.
    if (pendingInvoiceEmails.length > 0) {
      const emailResults = await Promise.allSettled(pendingInvoiceEmails.map((payload) => sendInvoiceEmail(payload)));
      const failed = emailResults.filter((r) => r.status === 'rejected').length;
      if (failed > 0) {
        console.warn(`Failed to send ${failed} invoice email(s) out of ${pendingInvoiceEmails.length}.`);
      }
    }
    if (pendingInvoiceSms.length > 0) {
      Promise.allSettled(pendingInvoiceSms.map((payload) => sendInvoiceSms(payload, 'invoice'))).then((results) => {
        const failed = results.filter((r) => r.status === 'rejected').length;
        if (failed > 0) console.warn(`Failed to send ${failed} invoice SMS(s) out of ${pendingInvoiceSms.length}.`);
      });
    }
  }

  // 6. Mark overdue: not_paid invoices whose due_date is in the past
  const todayStr = `${curYear}-${String(curMonth).padStart(2, '0')}-${String(today.day).padStart(2, '0')}`;
  await client.query(
    `UPDATE invoices SET status = 'overdue' WHERE status = 'not_paid' AND deleted_at IS NULL AND due_date < $1`,
    [todayStr]
  );

  // 6b. Un-mark overdue: if due_date was moved to the future (e.g. via edit)
  await client.query(
    `UPDATE invoices SET status = 'not_paid' WHERE status = 'overdue' AND deleted_at IS NULL AND due_date >= $1`,
    [todayStr]
  );
}

/** Runs the sync at server start and every hour, so invoices go out even if nobody opens Finance. */
export function startInvoiceScheduler(): void {
  const g = globalThis as { __invoiceSchedulerStarted?: boolean };
  if (g.__invoiceSchedulerStarted) return;
  g.__invoiceSchedulerStarted = true;

  const run = () => {
    syncInvoices().catch((err) => console.error('Scheduled invoice sync failed:', err?.message || err));
  };
  setTimeout(run, 60 * 1000);
  setInterval(run, HOUR);
}
