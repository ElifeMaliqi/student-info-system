import { randomUUID } from 'crypto';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, verifyToken } from '../../../../server/auth';
import { PRIVILEGED_ROLES } from '../../../../server/authz';

// ID documents are personal data, so they live outside public/ and are only
// served back to admins through GET below.
const DIR = join(process.cwd(), 'uploads', 'id-documents');

const ALLOWED: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'application/pdf': 'pdf',
};
const CONTENT_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  pdf: 'application/pdf',
};
const MAX_BYTES = 5 * 1024 * 1024;

// Public on purpose: applicants upload their ID before they have an account.
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 });

  // Extension comes from the validated content type, never the user's filename.
  const ext = ALLOWED[file.type];
  if (!ext) return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'File too large (max 5MB)' }, { status: 400 });

  const filename = `${randomUUID()}.${ext}`;
  await mkdir(DIR, { recursive: true });
  await writeFile(join(DIR, filename), Buffer.from(await file.arrayBuffer()));

  return NextResponse.json({ url: `/api/upload/id-document?file=${filename}` });
}

export async function GET(req: NextRequest) {
  const token = getBearerToken(req.headers.get('authorization'));
  const user = token ? await verifyToken(token) : null;
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!PRIVILEGED_ROLES.has(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // Only accept names this route generated: a uuid plus a known extension.
  const name = req.nextUrl.searchParams.get('file') || '';
  const m = name.match(/^[0-9a-f-]{36}\.(jpg|png|pdf)$/);
  if (!m) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  try {
    const bytes = await readFile(join(DIR, name));
    return new NextResponse(bytes, { headers: { 'Content-Type': CONTENT_TYPES[m[1]] } });
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
}
