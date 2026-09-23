// Base URL for links in outgoing emails (password reset links). Always the live
// domain: NEXT_PUBLIC_APP_URL is inlined at build time, and a localhost value on the
// prod box sent every reset link to localhost:3000. Links in emails sent from a
// local dev server therefore also point at the live site.
const PROD_URL = 'https://sis.futureminds.io';

export function appUrl(): string {
  return PROD_URL;
}
