/**
 * Send one test SMS through Twilio with the credentials in .env.local, then wait
 * briefly for the delivery result (Twilio accepts first and reports carrier
 * delivery or failure a few seconds later).
 *
 * Usage: node scripts/test-sms.mjs +38344123456
 *
 * This checks the credentials on this machine only. The live server reads its
 * own environment, so passing here does not mean the server has them.
 */
import { config } from 'dotenv';

config({ path: '.env.local' });

const SID = process.env.TWILIO_ACCOUNT_SID ?? '';
const AUTH = process.env.TWILIO_AUTH_TOKEN ?? '';
// Same sender lookup as src/app/api/notify/[name]/route.ts.
const FROM = process.env.TWILIO_FROM_NUMBER ?? process.env.TWILIO_PHONE_NUMBER ?? '';

// Same number formatting as normalizePhone() in the notify route.
function normalizePhone(raw) {
  const d = raw.replace(/[^+\d]/g, '');
  if (d.startsWith('+')) return d;
  if (d.startsWith('0')) return '+383' + d.slice(1);
  if (d.startsWith('383')) return '+' + d;
  return '+' + d;
}

const rawTo = process.argv[2];
if (!rawTo) {
  console.error('Usage: node scripts/test-sms.mjs +38344123456');
  process.exit(1);
}
if (!SID || !AUTH || !FROM) {
  console.error('Twilio is not configured in .env.local (need TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER).');
  process.exit(1);
}

const to = normalizePhone(rawTo);
const auth = 'Basic ' + Buffer.from(`${SID}:${AUTH}`).toString('base64');
const base = `https://api.twilio.com/2010-04-01/Accounts/${SID}/Messages`;

const res = await fetch(`${base}.json`, {
  method: 'POST',
  headers: { Authorization: auth, 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    From: FROM,
    To: to,
    Body: `Future Minds Academy SIS: test SMS sent ${new Date().toISOString()}. If you got this, Twilio works.`,
  }).toString(),
});
const sent = await res.json().catch(() => ({}));
if (!res.ok) {
  console.error(`Twilio rejected the SMS (HTTP ${res.status}, code ${sent.code ?? '?'}): ${sent.message ?? 'no message'}`);
  if (sent.more_info) console.error(`Details: ${sent.more_info}`);
  process.exit(1);
}

console.log(`Accepted by Twilio (sid ${sent.sid})`);
console.log(`From: ${FROM}`);
console.log(`To:   ${to}`);

// Poll for the carrier's verdict for up to ~20 seconds.
const FINAL = new Set(['delivered', 'undelivered', 'failed']);
let msg = sent;
for (let i = 0; i < 7 && !FINAL.has(msg.status); i++) {
  await new Promise((r) => setTimeout(r, 3000));
  const poll = await fetch(`${base}/${sent.sid}.json`, { headers: { Authorization: auth } });
  msg = await poll.json().catch(() => msg);
}

console.log(`Status: ${msg.status}`);
if (msg.error_code) {
  console.log(`Error ${msg.error_code}: ${msg.error_message ?? ''}`);
  console.log(`Look it up: https://www.twilio.com/docs/api/errors/${msg.error_code}`);
}
if (!FINAL.has(msg.status)) {
  console.log('No final result yet; check Monitor > Logs > Messaging in the Twilio console.');
}
