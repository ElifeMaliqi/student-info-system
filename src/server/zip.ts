import zlib from 'zlib';

/**
 * Minimal, dependency-free ZIP reader for Office Open XML files (.xlsx, .docx),
 * which are ZIP archives of XML parts. We read the central directory for reliable
 * sizes/offsets, then inflate individual entries on demand.
 */

export interface ZipEntry { method: number; compSize: number; offset: number; name: string; }

export function readZipEntries(buf: Buffer): Map<string, ZipEntry> {
  // Find End Of Central Directory record (signature 0x06054b50), scanning back.
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i >= buf.length - 22 - 0xffff; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Not a valid Office file (no ZIP directory)');

  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16); // central directory start offset

  const entries = new Map<string, ZipEntry>();
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break; // central file header sig
    const method   = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen  = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commLen  = buf.readUInt16LE(p + 32);
    const offset   = buf.readUInt32LE(p + 42);
    const name     = buf.toString('utf8', p + 46, p + 46 + nameLen);
    entries.set(name, { method, compSize, offset, name });
    p += 46 + nameLen + extraLen + commLen;
  }
  return entries;
}

export function readZipFile(buf: Buffer, entry: ZipEntry): string {
  // Local file header: skip to the data using its own name/extra lengths.
  const lh = entry.offset;
  if (buf.readUInt32LE(lh) !== 0x04034b50) throw new Error('Corrupt ZIP entry');
  const nameLen  = buf.readUInt16LE(lh + 26);
  const extraLen = buf.readUInt16LE(lh + 28);
  const dataStart = lh + 30 + nameLen + extraLen;
  const data = buf.subarray(dataStart, dataStart + entry.compSize);
  if (entry.method === 0) return data.toString('utf8');           // stored
  if (entry.method === 8) return zlib.inflateRawSync(data).toString('utf8'); // deflate
  throw new Error(`Unsupported ZIP compression method ${entry.method}`);
}
