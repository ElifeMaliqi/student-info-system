import { SignJWT, jwtVerify } from 'jose';
import { query } from './db';

// Known insecure placeholder values that must never be used to sign tokens.
const WEAK_SECRETS = new Set([
  'change-me-in-production-fma-sis',
  'change-this-to-a-long-random-string-in-production',
]);

let cachedSecret: Uint8Array | null = null;

/**
 * Resolve the JWT signing secret lazily and fail closed.
 *
 * Resolving at call time (rather than module load) keeps `next build` from
 * crashing in environments where the secret isn't present, while still
 * refusing to sign/verify tokens with a missing or placeholder secret.
 */
function getSecret(): Uint8Array {
  if (cachedSecret) return cachedSecret;
  const value = process.env.JWT_SECRET;
  if (!value || WEAK_SECRETS.has(value) || value.length < 32) {
    throw new Error(
      'JWT_SECRET is not configured with a strong value. Set a random 32+ character secret.'
    );
  }
  cachedSecret = new TextEncoder().encode(value);
  return cachedSecret;
}

const JWT_ISSUER = 'fma-sis';
const JWT_EXPIRY = '7d';

export interface AuthUser {
  id: string;
  email: string;
  role: string;
}

export interface AuthSession {
  access_token: string;
  user: { id: string; email: string };
}

export async function loginWithPassword(
  email: string,
  password: string
): Promise<{ session: AuthSession; profile: AuthUser & { first_name: string; last_name: string; avatar_url: string | null; must_change_password: boolean } }> {
  const { rows } = await query<{
    id: string;
    email: string;
    role: string;
    first_name: string;
    last_name: string;
    avatar_url: string | null;
    must_change_password: boolean;
  }>(
    `SELECT p.id, p.email, p.role, p.first_name, p.last_name, p.avatar_url, p.must_change_password
     FROM auth_users a
     JOIN profiles p ON p.id = a.id
     WHERE a.email = $1 AND a.encrypted_password = crypt($2, a.encrypted_password)`,
    [email.toLowerCase().trim(), password]
  );

  const profile = rows[0];
  if (!profile) throw new Error('Invalid login credentials');

  const token = await new SignJWT({ sub: profile.id, email: profile.email, role: profile.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer(JWT_ISSUER)
    .setExpirationTime(JWT_EXPIRY)
    .sign(getSecret());

  return {
    session: {
      access_token: token,
      user: { id: profile.id, email: profile.email },
    },
    profile,
  };
}

export async function verifyToken(token: string): Promise<AuthUser | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), { issuer: JWT_ISSUER });
    const id = payload.sub as string;
    if (!id) return null;
    const { rows } = await query<{ id: string; email: string; role: string }>(
      'SELECT id, email, role FROM profiles WHERE id = $1',
      [id]
    );
    return rows[0] || null;
  } catch {
    return null;
  }
}

export async function updatePassword(userId: string, newPassword: string): Promise<void> {
  await query(
    `UPDATE auth_users SET encrypted_password = crypt($1, gen_salt('bf')), updated_at = now() WHERE id = $2`,
    [newPassword, userId]
  );
  await query(
    `UPDATE profiles SET must_change_password = false, updated_at = now() WHERE id = $1`,
    [userId]
  );
}

export async function generateResetToken(userId: string): Promise<string> {
  return new SignJWT({ sub: userId, purpose: 'password-reset' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer(JWT_ISSUER)
    .setExpirationTime('1h')
    .sign(getSecret());
}

export async function verifyResetToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), { issuer: JWT_ISSUER });
    if ((payload as { purpose?: string }).purpose !== 'password-reset') return null;
    return (payload.sub as string) || null;
  } catch {
    return null;
  }
}

export function getBearerToken(header: string | null): string | null {
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice(7).trim() || null;
}
