import { readZipEntries, readZipFile } from './zip';

/**
 * Minimal, dependency-free reader for the attendance-template .xlsx.
 *
 * An .xlsx is a ZIP archive of XML parts. We read the ZIP central directory,
 * inflate the parts we need (sharedStrings, styles, the first worksheet), and
 * interpret the sheet.
 *
 * Attendance is marked by CELL FILL COLOUR, not by cell text: a green/solid-fill
 * cell means the student attended (present), a blank/no-fill cell means absent.
 * So we resolve each cell's style → fill and treat any solid fill as "filled".
 *
 * Sheet layout (horizontal, repeating per month):
 *   - identity columns: First Name | Last Name | Email | Phone (header in row 4)
 *   - then, per month, one column per class meeting, headed by the DAY INITIAL it
 *     falls on (M, T, W, Thur, F, S/Sat, Su). The columns repeat the weekly
 *     pattern (e.g. M W  M W  M W  M W for a Mon/Wed class over four weeks).
 *   - row 1: month name at the start of each month's block
 *   - row 2/3: human-friendly "Week n" labels (ignored by the parser)
 *   - row 5+: one student per row, cells filled green when present
 *
 * Each column maps to a concrete date: the Nth occurrence of its weekday in the
 * month (the 1st "M" column = 1st Monday, the 2nd "M" column = 2nd Monday, …).
 * That makes the sheet self-describing — dates no longer depend on the class
 * schedule, so attendance can be imported even with no class selected.
 */

/** A data column resolved to a weekday (Mon=0 … Sun=6) and its occurrence in the
 *  month (1 = first such weekday of the month, 2 = second, …). */
export interface MonthColumn {
  weekday: number;
  occurrence: number;
}

export interface ParsedStudentRow {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  /** filled[monthIndex][columnIndex] = attended (green). columnIndex aligns with
   *  ParsedAttendanceSheet.monthColumns[monthIndex]. */
  filled: boolean[][];
}

export interface ParsedAttendanceSheet {
  /** Month names as written in row 1, in left-to-right order. */
  months: string[];
  /** Per month, the day columns in left-to-right order. */
  monthColumns: MonthColumn[][];
  students: ParsedStudentRow[];
}

/** Map a day-initial header to a weekday number (Mon=0 … Sun=6), or null. */
export function parseWeekday(raw: string): number | null {
  const t = raw.trim().toLowerCase().replace(/[^a-z]/g, '');
  if (!t) return null;
  if (t === 'su' || t === 'sun' || t === 'sunday') return 6;
  if (t === 's' || t === 'sa' || t === 'sat' || t === 'saturday') return 5; // "S" alone = Saturday
  if (t.startsWith('th')) return 3; // th / thu / thur / thursday
  switch (t[0]) {
    case 'm': return 0; // Monday
    case 't': return 1; // Tuesday (Thursday handled above)
    case 'w': return 2; // Wednesday
    case 'f': return 4; // Friday
    default:  return null;
  }
}

// ── XML helpers ──────────────────────────────────────────────────────────────

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)))
    .replace(/&amp;/g, '&');
}

function parseSharedStrings(xml: string): string[] {
  const out: string[] = [];
  const siRe = /<si>([\s\S]*?)<\/si>/g;
  let m: RegExpExecArray | null;
  while ((m = siRe.exec(xml))) {
    const texts = m[1].match(/<t[^>]*>([\s\S]*?)<\/t>/g) || [];
    out.push(texts.map(t => decodeEntities(t.replace(/<[^>]+>/g, ''))).join(''));
  }
  return out;
}

/** Returns the set of cellXfs style indices whose fill is a solid colour. */
function parseColoredStyles(xml: string): Set<number> {
  // 1. Which fillIds are solid-colour fills?
  const fillsBlock = (xml.match(/<fills[^>]*>([\s\S]*?)<\/fills>/) || [])[1] || '';
  const fillIsColored: boolean[] = [];
  const fillRe = /<fill>([\s\S]*?)<\/fill>/g;
  let fm: RegExpExecArray | null;
  while ((fm = fillRe.exec(fillsBlock))) {
    fillIsColored.push(/patternType="solid"/.test(fm[1]));
  }

  // 2. Which cellXfs (style indices) point at a coloured fill?
  const xfsBlock = (xml.match(/<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/) || [])[1] || '';
  const colored = new Set<number>();
  const xfRe = /<xf\b[^>]*?(?:\/>|>[\s\S]*?<\/xf>)/g;
  let xm: RegExpExecArray | null;
  let idx = 0;
  while ((xm = xfRe.exec(xfsBlock))) {
    const fillId = parseInt((xm[0].match(/fillId="(\d+)"/) || [])[1] || '0', 10);
    if (fillIsColored[fillId]) colored.add(idx);
    idx++;
  }
  return colored;
}

/** "A" -> 1, "B" -> 2, "AA" -> 27 … (1-based). */
function colToNum(col: string): number {
  let n = 0;
  for (let i = 0; i < col.length; i++) n = n * 26 + (col.charCodeAt(i) - 64);
  return n;
}

interface Cell { value: string; filled: boolean; }

/** grid[rowNumber][colNumber] = cell */
function parseSheet(xml: string, shared: string[], coloredStyles: Set<number>): Map<number, Map<number, Cell>> {
  const grid = new Map<number, Map<number, Cell>>();
  const rowRe = /<row[^>]*\br="(\d+)"[^>]*>([\s\S]*?)<\/row>/g;
  let rm: RegExpExecArray | null;
  while ((rm = rowRe.exec(xml))) {
    const rowNum = parseInt(rm[1], 10);
    const cells = new Map<number, Cell>();
    const cellRe = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let cm: RegExpExecArray | null;
    while ((cm = cellRe.exec(rm[2]))) {
      const attrs = cm[1];
      const ref = (attrs.match(/\br="([A-Z]+)\d+"/) || [])[1];
      if (!ref) continue;
      const colNum = colToNum(ref);
      const style  = parseInt((attrs.match(/\bs="(\d+)"/) || [])[1] || '0', 10);
      const type   = (attrs.match(/\bt="([^"]+)"/) || [])[1] || '';
      const inner  = cm[2] || '';

      let value = '';
      if (type === 'inlineStr') {
        value = decodeEntities((inner.match(/<t[^>]*>([\s\S]*?)<\/t>/) || [])[1] || '');
      } else {
        const raw = (inner.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
        if (raw != null) {
          value = type === 's' ? (shared[parseInt(raw, 10)] ?? '') : decodeEntities(raw);
        }
      }
      cells.set(colNum, { value: value.trim(), filled: coloredStyles.has(style) });
    }
    grid.set(rowNum, cells);
  }
  return grid;
}

// ── Public entry point ───────────────────────────────────────────────────────

const HEADER_ROW = 4;      // identity + day-initial headers
const FIRST_DATA_ROW = 5;  // first student row
const MONTH_ROW = 1;       // month names

export function parseAttendanceWorkbook(buf: Buffer): ParsedAttendanceSheet {
  const entries = readZipEntries(buf);

  const get = (name: string) => {
    const e = entries.get(name);
    return e ? readZipFile(buf, e) : '';
  };

  const shared        = parseSharedStrings(get('xl/sharedStrings.xml'));
  const coloredStyles = parseColoredStyles(get('xl/styles.xml'));

  // Use the first worksheet part.
  let sheetName = 'xl/worksheets/sheet1.xml';
  if (!entries.has(sheetName)) {
    sheetName = [...entries.keys()].find(k => /^xl\/worksheets\/sheet\d+\.xml$/.test(k)) || sheetName;
  }
  const grid = parseSheet(get(sheetName), shared, coloredStyles);

  // Locate identity columns from the header row.
  const headerCells = grid.get(HEADER_ROW) || new Map<number, Cell>();
  let firstCol = 0, lastCol = 0, emailCol = 0, phoneCol = 0;
  for (const [col, cell] of headerCells) {
    const v = cell.value.toLowerCase();
    if (v.includes('first')) firstCol = col;
    else if (v.includes('last')) lastCol = col;
    else if (v.includes('email')) emailCol = col;
    else if (v.includes('phone')) phoneCol = col;
  }
  if (!firstCol || !lastCol || !emailCol) {
    throw new Error('Could not find First Name / Last Name / Email header columns');
  }
  const firstDataCol = Math.max(firstCol, lastCol, emailCol, phoneCol) + 1;

  // Month blocks: each non-empty cell in row 1 at/after firstDataCol starts a block.
  const monthRow = grid.get(MONTH_ROW) || new Map<number, Cell>();
  const blocks: { name: string; startCol: number }[] = [];
  for (const col of [...monthRow.keys()].sort((a, b) => a - b)) {
    if (col < firstDataCol) continue;
    const name = monthRow.get(col)!.value;
    if (name) blocks.push({ name, startCol: col });
  }
  if (blocks.length === 0) throw new Error('No month columns found in the header (row 1)');

  // Day columns live in the header row, headed by a day initial.
  const maxCol = headerCells.size ? Math.max(...headerCells.keys()) : firstDataCol;

  // For each month block, walk its columns left→right, resolve the day initial,
  // and number each weekday's occurrences (1st, 2nd, … of that weekday).
  const monthColumns: MonthColumn[][] = [];
  const monthColRefs: number[][] = []; // spreadsheet column number per (month, columnIndex)
  blocks.forEach((block, bi) => {
    const endCol = bi + 1 < blocks.length ? blocks[bi + 1].startCol : maxCol + 1;
    const cols: MonthColumn[] = [];
    const refs: number[] = [];
    const counts: Record<number, number> = {};
    for (let col = block.startCol; col < endCol; col++) {
      const weekday = parseWeekday(headerCells.get(col)?.value || '');
      if (weekday == null) continue;
      counts[weekday] = (counts[weekday] || 0) + 1;
      cols.push({ weekday, occurrence: counts[weekday] });
      refs.push(col);
    }
    monthColumns.push(cols);
    monthColRefs.push(refs);
  });

  // Student rows.
  const students: ParsedStudentRow[] = [];
  const rowNums = [...grid.keys()].filter(r => r >= FIRST_DATA_ROW).sort((a, b) => a - b);
  for (const r of rowNums) {
    const cells = grid.get(r)!;
    const firstName = cells.get(firstCol)?.value || '';
    const lastName  = cells.get(lastCol)?.value || '';
    const email     = cells.get(emailCol)?.value || '';
    const phone     = phoneCol ? (cells.get(phoneCol)?.value || '') : '';
    if (!firstName && !lastName && !email) continue; // skip blank rows

    const filled = monthColRefs.map(refs => refs.map(col => cells.get(col)?.filled || false));
    students.push({ firstName, lastName, email, phone, filled });
  }

  return { months: blocks.map(b => b.name), monthColumns, students };
}
