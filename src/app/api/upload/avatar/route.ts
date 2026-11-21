import { mkdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, verifyToken } from '../../../../server/auth';
import { query } from '../../../../server/db';
import { logImpersonatedAction } from '../../../../server/impersonation';

// `next start` only serves files that were in public/ at build time, so avatars
// uploaded after a deploy 404'd. They're still stored here (keeps existing
// /uploads/avatars/... URLs valid), but served by GET below via the rewrite in
// next.config.ts.
const DIR = join(process.cwd(), 'public', 'uploads', 'avatars');
const CONTENT_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
};

export async function POST(req: NextRequest) {
  const token = getBearerToken(req.headers.get('authorization'));
  const user = token ? await verifyToken(token) : null;
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const form = await req.formData();
  const file = form.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 });

  // Only accept real images, and derive the extension from the validated content
  // type rather than the user-supplied filename (which could carry a script
  // extension or path-traversal segments).
  const ALLOWED: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
  };
  const ext = ALLOWED[file.type];
  if (!ext) {
    return NextResponse.json({ error: 'Unsupported image type' }, { status: 400 });
  }
  const MAX_BYTES = 5 * 1024 * 1024;
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Image too large (max 5MB)' }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const filename = `${user.id}-${Date.now()}.${ext}`;
  await mkdir(DIR, { recursive: true });
  await writeFile(join(DIR, filename), bytes);

  const publicUrl = `/uploads/avatars/${filename}`;
  await query('UPDATE profiles SET avatar_url = $1, updated_at = now() WHERE id = $2', [publicUrl, user.id]);
  await logImpersonatedAction(user, 'edit', 'Profile photo changed while impersonating');

  return NextResponse.json({ publicUrl });
}

// Public like before: avatars are shown in <img> tags, which can't send a token.
export async function GET(req: NextRequest) {
  // Only accept names POST generates: <profile uuid>-<timestamp>.<ext>.
  const name = req.nextUrl.searchParams.get('file') || '';
  const m = name.match(/^[0-9a-f-]{36}-\d+\.(jpg|png|gif|webp)$/);
  if (!m) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  try {
    const bytes = await readFile(join(DIR, name));
    return new NextResponse(bytes, {
      headers: {
        'Content-Type': CONTENT_TYPES[m[1]],
        // Each upload gets a new filename, so the file never changes.
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
}
