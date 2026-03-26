import { playPopSound } from './sound';

/**
 * Escape a cell value for CSV (RFC 4180 compliant).
 * Always wraps in quotes, escapes internal quotes by doubling.
 */
function escapeCell(value: unknown): string {
  const str = value == null ? '' : String(value);
  return `"${str.replace(/"/g, '""')}"`;
}

interface ExportCsvOptions {
  /** Filename without extension. Date suffix is appended automatically. */
  filename: string;
  /** Column headers in display order. */
  headers: string[];
  /** Row data — each row is an array of cell values matching headers order. */
  rows: unknown[][];
}

/**
 * Build a well-structured CSV and trigger browser download.
 *
 * - UTF-8 BOM so Excel opens with correct encoding
 * - RFC 4180 quoting (every cell quoted, inner quotes doubled)
 * - CRLF line endings per spec
 */
export function exportCsv({ filename, headers, rows }: ExportCsvOptions) {
  const headerLine = headers.map(escapeCell).join(',');
  const dataLines = rows.map(row => row.map(escapeCell).join(','));
  // "sep=," tells Excel which delimiter to use regardless of locale
  const csvContent = ['sep=,', headerLine, ...dataLines].join('\r\n');

  // UTF-8 BOM ensures Excel interprets encoding correctly
  const bom = '\uFEFF';
  const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  playPopSound();
}
