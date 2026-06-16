#!/usr/bin/env node
/**
 * Generates the import templates that match the parsers in
 * src/server/xlsx-attendance.ts and src/server/docx-invoice.ts:
 *   templates/attendance_template.xlsx
 *   templates/invoice_template.docx
 *
 * .xlsx/.docx are ZIP archives of XML parts. We write a minimal, valid package
 * with a tiny "stored" (uncompressed) ZIP writer — no dependencies.
 */
import { writeFileSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';

// ── minimal ZIP writer (stored entries) ──────────────────────────────────────
function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1));
  }
  return (~c) >>> 0;
}

function zip(files) {
  const local = [];
  const central = [];
  let offset = 0;
  for (const f of files) {
    const name = Buffer.from(f.name, 'utf8');
    const data = Buffer.isBuffer(f.data) ? f.data : Buffer.from(f.data, 'utf8');
    const crc = crc32(data);

    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4);
    lh.writeUInt16LE(0, 6);
    lh.writeUInt16LE(0, 8); // method 0 = stored
    lh.writeUInt16LE(0, 10);
    lh.writeUInt16LE(0, 12);
    lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(data.length, 18);
    lh.writeUInt32LE(data.length, 22);
    lh.writeUInt16LE(name.length, 26);
    lh.writeUInt16LE(0, 28);
    local.push(lh, name, data);

    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0, 8);
    cd.writeUInt16LE(0, 10);
    cd.writeUInt16LE(0, 12);
    cd.writeUInt16LE(0, 14);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(data.length, 20);
    cd.writeUInt32LE(data.length, 24);
    cd.writeUInt16LE(name.length, 28);
    cd.writeUInt16LE(0, 30);
    cd.writeUInt16LE(0, 32);
    cd.writeUInt16LE(0, 34);
    cd.writeUInt16LE(0, 36);
    cd.writeUInt32LE(0, 38);
    cd.writeUInt32LE(offset, 42);
    central.push(cd, name);

    offset += lh.length + name.length + data.length;
  }
  const centralStart = offset;
  const centralSize = central.reduce((n, b) => n + b.length, 0);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralSize, 12);
  eocd.writeUInt32LE(centralStart, 16);
  return Buffer.concat([...local, ...central, eocd]);
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ── attendance .xlsx ─────────────────────────────────────────────────────────
function colLetter(n) {
  let s = '';
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

const MONTHS = ['September', 'October', 'November', 'December', 'January', 'February', 'March', 'April', 'May', 'June'];
const FIRST_DATA_COL = 5; // A-D = identity
// Example: a class that meets Monday & Wednesday. Edit these initials to match
// the class's actual meeting days (M, T, W, Thur, F, S/Sat, Su) and add/remove
// columns accordingly. Each column = one weekday; "Week n" groups repeat them.
const DAYS = ['M', 'W'];
const WEEKS = 4;
const BLOCK = WEEKS * DAYS.length; // columns per month

function textCell(ref, s, text) {
  return `<c r="${ref}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${esc(text)}</t></is></c>`;
}
function styleCell(ref, s) { return `<c r="${ref}" s="${s}"/>`; }

// students: [{ firstName, lastName, email, phone, green(monthIndex, colIndex) }]
function buildAttendanceXlsx(months, students) {
  const lastCol = FIRST_DATA_COL - 1 + months.length * BLOCK;

  const row1 = [], row2 = [], row4 = [];
  const merges = [];

  // Row 4 identity headers
  row4.push(textCell('A4', 1, 'First Name'), textCell('B4', 1, 'Last Name'), textCell('C4', 1, 'Email'), textCell('D4', 1, 'Phone Number'));

  months.forEach((month, b) => {
    const start = FIRST_DATA_COL + b * BLOCK;
    // Row 1: month name spanning the whole month block
    row1.push(textCell(`${colLetter(start)}1`, 1, month));
    merges.push(`${colLetter(start)}1:${colLetter(start + BLOCK - 1)}1`);
    for (let w = 0; w < WEEKS; w++) {
      const wc = start + w * DAYS.length;
      // Row 2: week label spanning its day columns
      row2.push(textCell(`${colLetter(wc)}2`, 1, `Week ${w + 1}`));
      merges.push(`${colLetter(wc)}2:${colLetter(wc + DAYS.length - 1)}2`);
      // Row 4: one day-initial column per meeting day
      DAYS.forEach((day, di) => {
        row4.push(textCell(`${colLetter(wc + di)}4`, 1, day));
      });
    }
  });

  // Student rows (row 5+). Identity cells + green cells where present.
  const studentRows = students.map((stu, si) => {
    const r = 5 + si;
    const cells = [
      textCell(`A${r}`, 0, stu.firstName),
      textCell(`B${r}`, 0, stu.lastName),
      textCell(`C${r}`, 0, stu.email),
      textCell(`D${r}`, 0, stu.phone),
    ];
    months.forEach((_, mi) => {
      for (let ci = 0; ci < BLOCK; ci++) {
        if (stu.green && stu.green(mi, ci)) {
          cells.push(styleCell(`${colLetter(FIRST_DATA_COL + mi * BLOCK + ci)}${r}`, 2));
        }
      }
    });
    return `<row r="${r}">${cells.join('')}</row>`;
  }).join('');

  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<dimension ref="A1:${colLetter(lastCol)}${4 + students.length}"/>
<sheetData>
<row r="1">${row1.join('')}</row>
<row r="2">${row2.join('')}</row>
<row r="3"></row>
<row r="4">${row4.join('')}</row>
${studentRows}
</sheetData>
<mergeCells count="${merges.length}">${merges.map(m => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>
</worksheet>`;

  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF92D050"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color indexed="64"/></left><right style="thin"><color indexed="64"/></right><top style="thin"><color indexed="64"/></top><bottom style="thin"><color indexed="64"/></bottom><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="3">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"/>
<xf numFmtId="0" fontId="0" fillId="2" borderId="1" xfId="0" applyFill="1" applyBorder="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

  return zip([
    { name: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>` },
    { name: '_rels/.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>` },
    { name: 'xl/workbook.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="Attendance" sheetId="1" r:id="rId1"/></sheets>
</workbook>` },
    { name: 'xl/_rels/workbook.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>` },
    { name: 'xl/worksheets/sheet1.xml', data: sheet },
    { name: 'xl/styles.xml', data: styles },
  ]);
}

// ── invoice .docx ────────────────────────────────────────────────────────────
function para(text) {
  return `<w:p><w:r><w:t xml:space="preserve">${esc(text)}</w:t></w:r></w:p>`;
}

function buildInvoiceDocx({ firstName, studentName, amount, method, dateLine }) {
  const body = [
    para('Future Minds Academy'),
    para(''),
    para(`Dear ${firstName},`),
    para(''),
    para('I am writing to confirm the receipt of a payment. Below are the details of the payment:'),
    para(''),
    para(`Student Name: ${studentName}`),
    para(`Payment Amount: ${amount}`),
    para(`Payment Method: ${method}`),
    para(`Date/Month of Payment: ${dateLine}`),
    para(''),
    para('We are pleased to acknowledge the successful payment made by the student for their Program at Future Minds Academy. The payment has been processed and recorded in our system.'),
    para(''),
    para('If you have any further questions, please reach out to us!'),
  ].join('');

  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>${body}<w:sectPr/></w:body>
</w:document>`;

  return zip([
    { name: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>` },
    { name: '_rels/.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>` },
    { name: 'word/document.xml', data: document },
  ]);
}

// ── default templates: ONE demo user, so the expected values are obvious ──────
function writeDefaults(dir) {
  mkdirSync(dir, { recursive: true });
  const demo = {
    firstName: 'John', lastName: 'Smith', email: 'johnsmith@example.com', phone: '044123456',
    green: (mi, ci) => mi === 0 && ci === 0, // 1st meeting present, as an example
  };
  writeFileSync(join(dir, 'attendance_template.xlsx'), buildAttendanceXlsx(MONTHS, [demo]));
  writeFileSync(join(dir, 'invoice_template.docx'), buildInvoiceDocx({
    firstName: '[First Name]', studentName: 'John Smith', amount: '100 Euro',
    method: 'Cash', dateLine: '11 June 2026/May-June',
  }));
  console.log(`Wrote defaults → ${dir}`);
}

// ── test sample: 4 users (3 complete + active, 1 not-active with random data) ──
const SAMPLE_USERS = [
  { firstName: 'Arben',   lastName: 'Krasniqi', email: 'arben.krasniqi@example.com',   phone: '+38344111111', status: 'active',     program: 'Web Development', parent: 'Driton',  location: 'FMA (Rruga Qarkore)', classCode: 'WEBA1B2' },
  { firstName: 'Besarta', lastName: 'Gashi',    email: 'besarta.gashi@example.com',    phone: '+38344222222', status: 'active',     program: 'Web Development', parent: 'Fatmir',  location: 'FMA (Rruga Qarkore)', classCode: 'WEBA1B2' },
  { firstName: 'Drilon',  lastName: 'Berisha',  email: 'drilon.berisha@example.com',   phone: '+38344333333', status: 'active',     program: 'Web Development', parent: 'Lulzim',  location: 'FMA Kids (Dardani)',  classCode: 'WEBA1B2' },
  { firstName: 'Zana',    lastName: 'Hoxha',    email: 'zana.hoxha@example.com',       phone: '+38344999999', status: 'Not Active', program: 'qwerty',          parent: '',        location: '',                    classCode: 'ZZZ0000' },
];

const csvField = (v) => /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;

function writeSamples(dir) {
  const sdir = join(dir, 'samples');
  mkdirSync(sdir, { recursive: true });

  // 1) Student CSV (matches the downloadable template's columns/order).
  const headers = ['Name *', 'Surname *', 'Email *', 'Phone Number', 'Status', 'Program', 'Parent First Name', 'Secondary Phone', 'Location', 'Password', 'Class Code'];
  const csvRows = SAMPLE_USERS.map(u => [u.firstName, u.lastName, u.email, u.phone, u.status, u.program, u.parent, '', u.location, '', u.classCode]);
  const csv = '﻿' + 'sep=,\r\n' + [headers, ...csvRows].map(r => r.map(csvField).join(',')).join('\r\n') + '\r\n';
  writeFileSync(join(sdir, 'students_sample.csv'), csv, 'utf8');

  // 2) Attendance sample (day initials, one month) with varied attendance.
  const attStudents = SAMPLE_USERS.map((u, i) => ({
    firstName: u.firstName, lastName: u.lastName, email: u.email, phone: u.phone,
    green:
      i === 0 ? () => true :                       // all present
      i === 1 ? (_, ci) => ci < 4 :                // first two weeks present
      i === 2 ? (_, ci) => ci % 2 === 0 :          // Mondays present, Wednesdays absent
                () => false,                       // none present
  }));
  writeFileSync(join(sdir, 'attendance_sample.xlsx'), buildAttendanceXlsx(['September'], attStudents));

  // 3) Sample invoices — one per active student (match by name on import).
  const invoices = [
    { user: SAMPLE_USERS[0], amount: '100 Euro',  method: 'Cash',          dateLine: '11 September 2026/September' },
    { user: SAMPLE_USERS[1], amount: '120 Euro',  method: 'Bank Transfer', dateLine: '15 October 2026/October-November' },
    { user: SAMPLE_USERS[2], amount: '60 Euro',   method: 'Cash',          dateLine: '5 November 2026/November' },
  ];
  for (const inv of invoices) {
    const file = `invoice_${inv.user.firstName}_${inv.user.lastName}`.toLowerCase() + '.docx';
    writeFileSync(join(sdir, file), buildInvoiceDocx({
      firstName: inv.user.firstName,
      studentName: `${inv.user.firstName} ${inv.user.lastName}`,
      amount: inv.amount, method: inv.method, dateLine: inv.dateLine,
    }));
  }
  console.log(`Wrote samples → ${sdir}`);
}

// ── write ────────────────────────────────────────────────────────────────────
// Optional first arg overrides the output directory (used for verification when
// the canonical file is locked open in Excel).
const outDir = process.argv[2] ? resolve(process.argv[2]) : join(process.cwd(), 'templates');
writeDefaults(outDir);
writeSamples(outDir);
