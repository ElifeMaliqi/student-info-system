/**
 * Send one test email through Resend with the credentials in .env.local, to
 * confirm the API key, the sender address and the Resend account all work.
 *
 * Usage: node scripts/test-email.mjs you@example.com
 *
 * This checks the credentials on this machine only. The live server reads its
 * own environment, so passing here does not mean the server has the key.
 */
import { Resend } from 'resend';
import { config } from 'dotenv';

config({ path: '.env.local' });

const to = process.argv[2];
if (!to || !to.includes('@')) {
  console.error('Usage: node scripts/test-email.mjs you@example.com');
  process.exit(1);
}
if (!process.env.RESEND_API_KEY) {
  console.error('RESEND_API_KEY is not set in .env.local');
  process.exit(1);
}

// Same From handling as src/app/api/notify/[name]/route.ts, so this exercises
// the sender the app really uses.
const raw = process.env.RESEND_FROM_EMAIL ?? 'info@futureminds.io';
const match = raw.match(/<([^>]+)>/);
const from = `Future Minds Academy <${(match?.[1] ?? raw).trim()}>`;

const sentAt = new Date().toISOString();
const resend = new Resend(process.env.RESEND_API_KEY);
const { data, error } = await resend.emails.send({
  from,
  to,
  subject: 'SIS email test',
  html: `<p>This is a test email from the Future Minds Academy SIS.</p>
         <p>If you can read this, Resend is connected and sending works.</p>
         <p style="color:#888">Sent ${sentAt}</p>`,
});

if (error) {
  console.error(`Resend rejected the email: ${error.message ?? JSON.stringify(error)}`);
  process.exit(1);
}

console.log(`Accepted by Resend (id ${data.id})`);
console.log(`From: ${from}`);
console.log(`To:   ${to}`);
console.log('Check the inbox (and spam) for "SIS email test", and the Emails log in the Resend dashboard.');
