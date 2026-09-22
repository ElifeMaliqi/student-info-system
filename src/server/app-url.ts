// Base URL for links in outgoing emails. NEXT_PUBLIC_APP_URL is inlined at build
// time, so a localhost value copied onto the prod box ends up in every email.
// In production, a missing or localhost value falls back to the live domain.
// A value without a scheme (e.g. "sis.futureminds.io") gets one added, or the
// link in the email isn't clickable.
const PROD_URL = 'https://sis.futureminds.io';

export function appUrl(): string {
  let env = (process.env.NEXT_PUBLIC_APP_URL ?? '').trim().replace(/\/$/, '');
  const isLocal = /^(https?:\/\/)?(localhost|127\.0\.0\.1)/.test(env);
  if (process.env.NODE_ENV === 'production' && (!env || isLocal)) {
    return PROD_URL;
  }
  if (env && !/^https?:\/\//.test(env)) {
    env = `${isLocal ? 'http' : 'https'}://${env}`;
  }
  return env || 'http://localhost:3000';
}
