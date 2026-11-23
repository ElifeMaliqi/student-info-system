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
  /**
   * Set when a superadmin is impersonating this user. `id`/`role` above are the
   * impersonated user's, so every route acts exactly as that user would.
   */
  impersonation?: {
    byId: string;
    byName: string;
    asName: string;
  };
}

const IMPERSONATION_PURPOSE = 'impersonation';
const IMPERSONATION_EXPIRY = '1h';

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

    const purpose = (payload as { purpose?: string }).purpose;
    // A password-reset link is not a sign-in.
    if (purpose === 'password-reset') return null;

    if (purpose === IMPERSONATION_PURPOSE) {
      // Valid only while the impersonator is still a superadmin and the target
      // is not one (superadmins can't be impersonated).
      const byId = (payload as { imp?: unknown }).imp;
      if (typeof byId !== 'string' || !byId) return null;
      const { rows } = await query<{ id: string; email: string; role: string; as_name: string; by_id: string; by_name: string }>(
        `SELECT t.id, t.email, t.role,
                trim(coalesce(t.first_name, '') || ' ' || coalesce(t.last_name, '')) AS as_name,
                i.id AS by_id,
                trim(coalesce(i.first_name, '') || ' ' || coalesce(i.last_name, '')) AS by_name
         FROM profiles t
         JOIN profiles i ON i.id = $2 AND i.role = 'superadmin'
         WHERE t.id = $1 AND t.role <> 'superadmin'`,
        [id, byId]
      );
      const r = rows[0];
      if (!r) return null;
      return {
        id: r.id,
        email: r.email,
        role: r.role,
        impersonation: { byId: r.by_id, byName: r.by_name, asName: r.as_name },
      };
    }

    const { rows } = await query<{ id: string; email: string; role: string }>(
      'SELECT id, email, role FROM profiles WHERE id = $1',
      [id]
    );
    return rows[0] || null;
  } catch {
    return null;
  }
}

/**
 * Short-lived token that signs a superadmin in as another user. The caller must
 * already have checked that `byId` is a real (not impersonating) superadmin.
 */
export async function generateImpersonationToken(
  target: { id: string; email: string; role: string },
  byId: string
): Promise<string> {
  return new SignJWT({ sub: target.id, email: target.email, role: target.role, imp: byId, purpose: IMPERSONATION_PURPOSE })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer(JWT_ISSUER)
    .setExpirationTime(IMPERSONATION_EXPIRY)
    .sign(getSecret());
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
