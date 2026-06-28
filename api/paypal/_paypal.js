/* ─────────────────────────────────────────────────────
   DEPARTMENT OF SURRENDER · PayPal shared config + helpers
   Files prefixed with "_" are NOT routed by Vercel, so this
   module is import-only (required by the handlers in this dir).
───────────────────────────────────────────────────── */

// "sandbox" while testing, "live" when you go to production.
// Set via the PAYPAL_ENV environment variable in Vercel.
const ENV = (process.env.PAYPAL_ENV || 'sandbox').toLowerCase();

const BASE = ENV === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

/* ─── PRODUCT CATALOGUE (authoritative) ───────────────
   This is the single source of truth for what you sell.
   The price here — NOT anything sent by the browser — is
   what the buyer is charged. Edit freely.
──────────────────────────────────────────────────────── */
const PRODUCT = {
  sku:         'DOS-CERT-001',
  name:        'Official Certificate of Surrender',
  description: 'One (1) hand-numbered digital Certificate of Surrender, issued under seal by the Department.',
  price:       '14.00',                              // string, 2 decimals
  currency:    process.env.PAYPAL_CURRENCY || 'USD', // e.g. USD, EUR, GBP
  maxQuantity: 10
};

/* ─── OAuth: exchange client id + secret for an access token ─── */
async function getAccessToken() {
  const id = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!id || !secret) {
    throw new Error('Missing PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET environment variables.');
  }
  const auth = Buffer.from(`${id}:${secret}`).toString('base64');
  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`PayPal auth failed: ${res.status} ${detail}`);
  }
  const data = await res.json();
  return data.access_token;
}

module.exports = { ENV, BASE, PRODUCT, getAccessToken };
