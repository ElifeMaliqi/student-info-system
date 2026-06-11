import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, verifyToken } from '../../../../server/auth';
import { query } from '../../../../server/db';

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
  const dir = join(process.cwd(), 'public', 'uploads', 'avatars');
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, filename), bytes);

  const publicUrl = `/uploads/avatars/${filename}`;
  await query('UPDATE profiles SET avatar_url = $1, updated_at = now() WHERE id = $2', [publicUrl, user.id]);

  return NextResponse.json({ publicUrl });
}
