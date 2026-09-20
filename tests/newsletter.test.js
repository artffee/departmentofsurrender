'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const originalFetch = global.fetch;
const originalNow = Date.now;
const names = ['RESEND_API_KEY', 'RESEND_FROM_EMAIL', 'RESEND_SEGMENT_ID', 'NEWSLETTER_SECRET'];
const originalEnv = Object.fromEntries(names.map(name => [name, process.env[name]]));
const origin = 'https://departmentofsurrender.com';
let handler;
test.beforeEach(() => {
  Object.assign(process.env, { RESEND_API_KEY: 'test-key', RESEND_FROM_EMAIL: 'postmaster@example.com', RESEND_SEGMENT_ID: 'test-segment', NEWSLETTER_SECRET: 'test-secret-at-least-thirty-two-characters-long' });
  delete require.cache[require.resolve('../api/newsletter')];
  handler = require('../api/newsletter');
  global.fetch = async () => { throw new Error('Unexpected external request'); };
});
test.afterEach(() => {
  global.fetch = originalFetch; Date.now = originalNow;
  for (const name of names) { if (originalEnv[name] === undefined) delete process.env[name]; else process.env[name] = originalEnv[name]; }
});
async function call(body, overrides = {}) {
  const res = { statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(n) { this.statusCode = n; return this; }, json(data) { this.data = data; return this; } };
  await handler({ method: 'POST', headers: { origin, 'content-type': 'application/json', 'x-vercel-forwarded-for': '192.0.2.1' }, body, ...overrides }, res);
  return res;
}
const response = (status, data = {}) => ({ ok: status >= 200 && status < 300, status, json: async () => data });
const signup = { action: 'subscribe', email: 'citizen@example.com', consent: true, website: '' };
async function obtainToken() {
  let sent;
  global.fetch = async (url, options) => { assert.equal(url, 'https://api.resend.com/emails'); sent = JSON.parse(options.body); return response(200, { id: 'message-id' }); };
  const result = await call(signup);
  assert.equal(result.statusCode, 200);
  return { token: sent.text.match(/#token=([\w-]+)/)[1], sent };
}

test('configuration readiness does not expose credentials and missing configuration fails closed', async () => {
  const ready = await call(undefined, { method: 'GET' });
  assert.deepEqual(ready.data, { ready: true });
  delete process.env.NEWSLETTER_SECRET;
  assert.deepEqual((await call(undefined, { method: 'GET' })).data, { ready: false });
  assert.equal((await call(signup)).statusCode, 503);
});
test('rejects cross-site submissions and non-JSON bodies before contacting the provider', async () => {
  assert.equal((await call(signup, { headers: { origin: 'https://unrelated.example', 'content-type': 'application/json' } })).statusCode, 403);
  assert.equal((await call(signup, { headers: { origin, 'content-type': 'text/plain' } })).statusCode, 415);
});
test('requires valid email and explicit consent, rejects honeypots and oversized bodies', async () => {
  for (const payload of [{ ...signup, email: 'invalid' }, { ...signup, consent: false }, { ...signup, consent: 'true' }, { ...signup, website: 'spam' }]) assert.equal((await call(payload)).statusCode, 400);
  assert.equal((await call({ ...signup, extra: 'x'.repeat(5000) })).statusCode, 413);
});
test('signup sends only a confirmation; it never adds an unconfirmed contact', async () => {
  const { token, sent } = await obtainToken();
  assert.deepEqual(sent.to, ['citizen@example.com']);
  assert.ok(sent.text.includes('/join.html#token='));
  assert.ok(!Buffer.from(token, 'base64url').toString('utf8').includes('citizen@example.com'));
});
test('confirmation creates a contact in the intended segment, never an arbitrary segment from the browser', async () => {
  const { token } = await obtainToken();
  const writes = [];
  global.fetch = async (url, options) => {
    if (options.method === 'GET') return response(404);
    writes.push({ url, body: options.body ? JSON.parse(options.body) : null });
    return response(200, { id: 'contact-id' });
  };
  const result = await call({ action: 'confirm', token, segment: 'attacker-segment' });
  assert.equal(result.statusCode, 200);
  assert.equal(result.data.status, 'subscribed');
  assert.deepEqual(writes[0].body, { email: signup.email, unsubscribed: false, segments: [{ id: 'test-segment' }] });
  assert.ok(writes.every(write => !JSON.stringify(write).includes('attacker-segment')));
});
test('existing contacts are reused; only mailbox-confirmed re-enlistment changes an unsubscribe', async () => {
  const { token } = await obtainToken();
  const methods = [];
  global.fetch = async (url, options) => {
    methods.push(options.method);
    if (options.method === 'GET') return response(200, { id: 'existing', unsubscribed: true });
    if (options.method === 'PATCH') assert.deepEqual(JSON.parse(options.body), { unsubscribed: false });
    return response(200, { id: 'existing' });
  };
  assert.equal((await call({ action: 'confirm', token })).data.status, 'subscribed');
  assert.deepEqual(methods, ['GET', 'PATCH', 'POST']);
});
test('tampered, expired and wrong-key confirmation tokens cannot add contacts', async () => {
  const now = Date.now();
  const { token } = await obtainToken();
  global.fetch = async () => { assert.fail('Invalid token must not contact the provider'); };
  const tampered = token.slice(0, 40) + (token[40] === 'A' ? 'B' : 'A') + token.slice(41);
  assert.equal((await call({ action: 'confirm', token: tampered })).statusCode, 400);
  Date.now = () => now + 25 * 3600000;
  assert.equal((await call({ action: 'confirm', token })).statusCode, 400);
  Date.now = originalNow;
  process.env.NEWSLETTER_SECRET = 'a-completely-different-secret-of-sufficient-length';
  assert.equal((await call({ action: 'confirm', token })).statusCode, 400);
});
test('confirmation GET only exposes readiness and cannot subscribe anyone', async () => {
  assert.deepEqual((await call({ action: 'confirm', token: 'anything' }, { method: 'GET' })).data, { ready: true });
});
test('provider errors and missing provider IDs never produce success', async () => {
  global.fetch = async () => response(403, { message: 'credential-detail-must-not-leak' });
  const rejected = await call(signup);
  assert.equal(rejected.statusCode, 502);
  assert.equal(rejected.data.error, 'email_service_unavailable');
  assert.ok(!JSON.stringify(rejected.data).includes('credential-detail'));
  global.fetch = async () => response(200, {});
  assert.equal((await call(signup)).statusCode, 502);
});
test('confirmation provider failure cannot report a subscribed state', async () => {
  const { token } = await obtainToken();
  global.fetch = async () => response(500);
  const result = await call({ action: 'confirm', token });
  assert.equal(result.statusCode, 502);
  assert.ok(!result.data.ok);
});
test('retry payloads have stable idempotency keys and email attempts are limited', async () => {
  const fixedTime = Date.now(); Date.now = () => fixedTime;
  const requests = [];
  global.fetch = async (url, options) => { requests.push(options); return response(200, { id: 'message-id' }); };
  for (let i = 0; i < 3; i++) assert.equal((await call(signup)).statusCode, 200);
  assert.equal(requests[0].headers['Idempotency-Key'], requests[1].headers['Idempotency-Key']);
  assert.equal(requests[0].body, requests[1].body);
  const limited = await call(signup);
  assert.equal(limited.statusCode, 429);
  assert.equal(requests.length, 3);
  assert.equal(limited.headers['Retry-After'], '3600');
});
