import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getBearerToken, verifyToken } from '../../../../server/auth';
import { withUserContext } from '../../../../server/db';
import { PRIVILEGED_ROLES } from '../../../../server/authz';
import { parseInvoiceDocx } from '../../../../server/docx-invoice';
import type { PoolClient } from 'pg';

function generateInvoiceId(year: number, month: number): string {
  const rand = crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
  return `INV-${year}${String(month).padStart(2, '0')}-${rand}`;
}

export async function POST(req: NextRequest) {
  const token = getBearerToken(req.headers.get('authorization'));
  const user = token ? await verifyToken(token) : null;
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  // Only admins/superadmins may import invoices — teachers and students cannot.
  if (!PRIVILEGED_ROLES.has(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let form: FormData;
  try { form = await req.formData(); }
  catch { return NextResponse.json({ error: 'Expected multipart form data' }, { status: 400 }); }

  const file = form.get('file');
  if (!(file instanceof Blob)) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });

  let doc;
  try {
    doc = parseInvoiceDocx(Buffer.from(await file.arrayBuffer()));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed to read document' }, { status: 400 });
  }

  if (!doc.studentName) return NextResponse.json({ error: 'Could not find a Student Name in the document' }, { status: 400 });
  if (doc.amount == null) return NextResponse.json({ error: 'Could not find a Payment Amount in the document' }, { status: 400 });

  // First month of the period = the month the invoice is issued.
  const month = doc.periodFirstMonth ?? (doc.paymentDate ? parseInt(doc.paymentDate.slice(5, 7), 10) : null);
  const year  = doc.year ?? (doc.paymentDate ? parseInt(doc.paymentDate.slice(0, 4), 10) : null);
  if (!month || !year) {
    return NextResponse.json({ error: 'Could not determine the payment month/year from the document' }, { status: 400 });
  }

  // Due date = the 1st of the due month (second month of the period). If the
  // range wraps past December (e.g. Dec–Jan), the due year rolls forward.
  const dueMonth = doc.periodSecondMonth ?? month;
  const dueYear  = dueMonth < month ? year + 1 : year;
  const dueDate  = `${dueYear}-${String(dueMonth).padStart(2, '0')}-01`;
  const title = `Imported Doc${doc.periodLabel ? ` — ${doc.periodLabel}` : ''} ${year}`;

  try {
    const result = await withUserContext(user.id, async (client: PoolClient) => {
      // Match the student by full name.
      const match = await client.query<{ id: string; first_name: string; last_name: string }>(
        `SELECT id, first_name, last_name FROM profiles
          WHERE lower(trim(first_name || ' ' || last_name)) = lower(trim($1))
            AND role = 'student'
            AND COALESCE(is_archived, false) = false`,
        [doc.studentName]
      );
      if (match.rows.length > 1) {
        return { http: 400 as const, body: { error: `Multiple students named "${doc.studentName}" — cannot import unambiguously` } };
      }
      if (match.rows.length === 0) {
        // No active student. If an archived student matches, surface that so the
        // UI can offer to unarchive them; otherwise (rejected / not on platform)
        // it's a plain "not found" the admin can add.
        const archived = await client.query<{ id: string }>(
          `SELECT id FROM profiles
            WHERE lower(trim(first_name || ' ' || last_name)) = lower(trim($1))
              AND role = 'student' AND is_archived = true`,
          [doc.studentName]
        );
        const reason = archived.rows.length === 1 ? 'archived' : 'not_found';
        return {
          http: 200 as const,
          body: {
            imported: false,
            unmatched: [{
              name: doc.studentName,
              reason,
              studentId: reason === 'archived' ? archived.rows[0].id : undefined,
            }],
          },
        };
      }
      const student = match.rows[0];
      const invoiceId = generateInvoiceId(year, month);

      await client.query(
        `INSERT INTO invoices
           (student_id, invoice_id, title, month, year, due_date, amount, discount_percent, status, is_manual)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 0, 'paid', true)`,
        [student.id, invoiceId, title, month, year, dueDate, Math.round(doc.amount! * 100) / 100]
      );

      return {
        http: 200 as const,
        body: {
          imported: true,
          studentName: `${student.first_name} ${student.last_name}`,
          invoiceId,
          amount: doc.amount,
          month,
          year,
          title,
          paymentMethod: doc.paymentMethod || null,
        },
      };
    });

    return NextResponse.json(result.body, { status: result.http });
  } catch (e) {
    console.error('[/api/invoices/import]', e);
    return NextResponse.json({ error: 'Import failed' }, { status: 500 });
  }
}
