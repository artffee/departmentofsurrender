'use strict';

const crypto = require('node:crypto');
const SITE = 'https://departmentofsurrender.com';
const HOUR = 60 * 60 * 1000;
const attempts = new Map();

function config() {
  return {
    key: process.env.RESEND_API_KEY || '',
    from: process.env.RESEND_FROM_EMAIL || '',
    segment: process.env.RESEND_SEGMENT_ID || '',
    secret: process.env.NEWSLETTER_SECRET || ''
  };
}
function ready(c) {
  return Boolean(c.key && /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(c.from) && c.segment && c.secret.length >= 32);
}
function validEmail(value) {
  return typeof value === 'string' && value.length <= 254 && /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(value);
}
function tokenKey(secret) { return crypto.createHash('sha256').update(secret).digest(); }
function seal(email, secret, now = Date.now()) {
  const issued = Math.floor(now / HOUR) * HOUR;
  // Deterministic per email and hour so Resend can safely deduplicate retries.
  // Different plaintext always gets a different nonce under the same key.
  const plaintext = JSON.stringify({ email, issued, expires: issued + 24 * HOUR, purpose: 'orion-newsletter-v1' });
  const iv = crypto.createHmac('sha256', secret).update('nonce:' + plaintext).digest().subarray(0, 12);
  const cipher = crypto.createCipheriv('aes-256-gcm', tokenKey(secret), iv);
  const body = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64url');
}
function unseal(token, secret, now = Date.now()) {
  if (typeof token !== 'string' || token.length > 1600 || !/^[\w-]+$/.test(token)) throw new Error('invalid_token');
  const bytes = Buffer.from(token, 'base64url');
  if (bytes.length < 29) throw new Error('invalid_token');
  const decipher = crypto.createDecipheriv('aes-256-gcm', tokenKey(secret), bytes.subarray(0, 12));
  decipher.setAuthTag(bytes.subarray(12, 28));
  const data = JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString('utf8'));
  if (data.purpose !== 'orion-newsletter-v1' || !validEmail(data.email) || !Number.isFinite(data.issued) || data.issued > now || data.expires !== data.issued + 24 * HOUR || data.expires <= now) throw new Error('invalid_token');
  return data;
}
function rateLimited(key, maximum, now = Date.now()) {
  for (const [id, entry] of attempts) if (entry.until <= now) attempts.delete(id);
  const entry = attempts.get(key) || { count: 0, until: now + HOUR };
  // Fail closed rather than growing an unbounded map during an attack.
  if (!attempts.has(key) && attempts.size >= 5000) return true;
  entry.count += 1;
  attempts.set(key, entry);
  return entry.count > maximum;
}
async function resend(c, path, method = 'GET', body, idempotencyKey) {
  const response = await fetch('https://api.resend.com' + path, {
    method,
    headers: { Authorization: 'Bearer ' + c.key, 'Content-Type': 'application/json', ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(8000)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) { const error = new Error('email_service_error'); error.status = response.status; throw error; }
  return data;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const c = config();
  if (req.method === 'GET') return res.status(200).json({ ready: ready(c) });
  if (req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); return res.status(405).json({ error: 'method_not_allowed' }); }
  const origin = req.headers.origin;
  if (![SITE, 'https://www.departmentofsurrender.com'].includes(origin) || req.headers['sec-fetch-site'] === 'cross-site') return res.status(403).json({ error: 'origin_not_allowed' });
  if (!(req.headers['content-type'] || '').toLowerCase().startsWith('application/json')) return res.status(415).json({ error: 'json_required' });
  let body;
  try {
    const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
    if (Buffer.byteLength(raw) > 4096) return res.status(413).json({ error: 'request_too_large' });
    body = JSON.parse(raw);
    if (!body || Array.isArray(body) || typeof body !== 'object') throw new Error('invalid_body');
  } catch { return res.status(400).json({ error: 'invalid_request' }); }
  if (!ready(c)) return res.status(503).json({ error: 'newsletter_unavailable' });
  const ip = String(req.headers['x-vercel-forwarded-for'] || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  const ipKey = crypto.createHmac('sha256', c.secret).update('ip:' + ip).digest('hex');
  if (rateLimited('ip:' + ipKey, 30)) { res.setHeader('Retry-After', '3600'); return res.status(429).json({ error: 'try_later' }); }

  if (body.action === 'subscribe') {
    if (body.website) return res.status(400).json({ error: 'invalid_request' });
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!validEmail(email) || body.consent !== true) return res.status(400).json({ error: 'email_and_consent_required' });
    const emailKey = crypto.createHmac('sha256', c.secret).update('email:' + email).digest('hex');
    if (rateLimited('email:' + emailKey, 3)) { res.setHeader('Retry-After', '3600'); return res.status(429).json({ error: 'try_later' }); }
    const token = seal(email, c.secret);
    const link = SITE + '/join.html#token=' + token;
    const text = 'Citizen,\n\nOne small formality remains. Confirm your email to receive Pemberton’s bulletins, new case files and news of future books from the Department of Surrender.\n\nConfirm your enlistment:\n' + link + '\n\nThis link expires within 24 hours. If you did not request it, ignore this message. You have not been added to the mailing list.\n\nThe Bird respects your inbox.\nDepartment of Surrender\n' + SITE;
    try {
      const sent = await resend(c, '/emails', 'POST', {
        from: 'Department of Surrender <' + c.from + '>', to: [email], subject: 'One small formality — confirm your enlistment', text
      }, 'orion-confirm-' + crypto.createHash('sha256').update(token).digest('hex'));
      if (!sent.id) throw new Error('missing_email_id');
      return res.status(200).json({ ok: true, status: 'confirmation_sent' });
    } catch { return res.status(502).json({ error: 'email_service_unavailable' }); }
  }

  if (body.action === 'confirm') {
    let verified;
    try { verified = unseal(body.token, c.secret); } catch { return res.status(400).json({ error: 'invalid_or_expired_link' }); }
    const contactPath = '/contacts/' + encodeURIComponent(verified.email);
    try {
      let contact;
      try { contact = await resend(c, contactPath); } catch (error) { if (error.status !== 404) throw error; }
      if (!contact) {
        try {
          contact = await resend(c, '/contacts', 'POST', { email: verified.email, unsubscribed: false, segments: [{ id: c.segment }] });
        } catch (error) {
          if (error.status !== 409) throw error;
          contact = await resend(c, contactPath);
        }
      }
      if (!contact.id) throw new Error('missing_contact_id');
      // The mailbox owner must explicitly confirm before any re-enlistment.
      if (contact.unsubscribed === true) await resend(c, contactPath, 'PATCH', { unsubscribed: false });
      await resend(c, contactPath + '/segments/' + encodeURIComponent(c.segment), 'POST');
      return res.status(200).json({ ok: true, status: 'subscribed' });
    } catch { return res.status(502).json({ error: 'email_service_unavailable' }); }
  }
  return res.status(400).json({ error: 'invalid_action' });
};
