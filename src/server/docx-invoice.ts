import { readZipEntries, readZipFile } from './zip';

/**
 * Dependency-free reader for the payment-confirmation .docx that the academy
 * sends to students. A .docx is a ZIP whose main part (word/document.xml) holds
 * the body as <w:p> paragraphs of <w:r> runs of <w:t> text.
 *
 * The letter carries labelled fields, e.g.:
 *   Student Name: Ledion Selmani
 *   Payment Amount: 100 Euro
 *   Payment Method: Cash
 *   Date/Month of Payment: 11 June 2026/May-June
 */

export interface ParsedInvoiceDoc {
  studentName: string;
  amount: number | null;
  paymentMethod: string;
  /** Payment date as yyyy-mm-dd, if parseable. */
  paymentDate: string | null;
  /** The period text after the "/" , e.g. "May-June". */
  periodLabel: string;
  /** First month of the period = the month the invoice is issued (1-12). */
  periodFirstMonth: number | null;
  /** Second month of the period = the due month (1-12), if a range is given. */
  periodSecondMonth: number | null;
  /** Year, from the payment date. */
  year: number | null;
}

const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9,
  oct: 10, nov: 11, dec: 12,
};

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)))
    .replace(/&amp;/g, '&');
}

/** Concatenate runs within each paragraph; one line per paragraph. */
function extractLines(documentXml: string): string[] {
  return documentXml.split(/<\/w:p>/).map(p => {
    const ts = p.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g) || [];
    return ts.map(t => decodeEntities(t.replace(/<[^>]+>/g, ''))).join('').trim();
  }).filter(Boolean);
}

/** Find the value after a labelled field, scanning all lines. */
function fieldValue(lines: string[], label: RegExp): string {
  for (const line of lines) {
    const m = line.match(label);
    if (m) return m[1].trim();
  }
  return '';
}

export function parseInvoiceDocx(buf: Buffer): ParsedInvoiceDoc {
  const entries = readZipEntries(buf);
  const docEntry = entries.get('word/document.xml');
  if (!docEntry) throw new Error('Not a valid .docx file (missing document.xml)');
  const lines = extractLines(readZipFile(buf, docEntry));

  const studentName  = fieldValue(lines, /student\s*name\s*:?\s*(.+)/i);
  const amountRaw    = fieldValue(lines, /payment\s*amount\s*:?\s*(.+)/i);
  const paymentMethod = fieldValue(lines, /payment\s*method\s*:?\s*(.+)/i);
  const dateRaw      = fieldValue(lines, /date\s*\/?\s*month\s*of\s*payment\s*:?\s*(.+)/i);

  // Amount: first number in the value (handles "100 Euro", "€100", "100,00").
  let amount: number | null = null;
  const amtMatch = amountRaw.match(/(\d[\d.,]*)/);
  if (amtMatch) {
    const n = parseFloat(amtMatch[1].replace(/,/g, '.'));
    if (Number.isFinite(n)) amount = n;
  }

  // Date/period: "<payment date>/<period>", e.g. "11 June 2026/May-June".
  const [datePart = '', periodPart = ''] = dateRaw.split('/');
  let paymentDate: string | null = null;
  let year: number | null = null;
  const dm = datePart.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (dm) {
    const mn = MONTHS[dm[2].toLowerCase()];
    if (mn) {
      year = parseInt(dm[3], 10);
      paymentDate = `${year}-${String(mn).padStart(2, '0')}-${String(parseInt(dm[1], 10)).padStart(2, '0')}`;
    }
  }

  const periodLabel = periodPart.trim();
  const periodMonths = periodLabel.split(/[-–—]/).map(s => s.trim().toLowerCase());
  const periodFirstMonth = periodMonths[0] && MONTHS[periodMonths[0]] != null ? MONTHS[periodMonths[0]] : null;
  const periodSecondMonth = periodMonths[1] && MONTHS[periodMonths[1]] != null ? MONTHS[periodMonths[1]] : null;

  return { studentName, amount, paymentMethod, paymentDate, periodLabel, periodFirstMonth, periodSecondMonth, year };
}
