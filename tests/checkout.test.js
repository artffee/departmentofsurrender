const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const originalFetch = global.fetch;
const originalEnv = { ...process.env };
after(() => { global.fetch = originalFetch; process.env = originalEnv; });
const config = require('../api/paypal/client-config');
const create = require('../api/paypal/create-order');
const capture = require('../api/paypal/capture-order');
const { PRODUCT } = require('../api/paypal/_paypal');
const orderID = '5O190127TN364715T';
function ready() {
  process.env.PAYPAL_CLIENT_ID = 'test-client';
  process.env.PAYPAL_CLIENT_SECRET = 'test-secret';
  process.env.ORION_DOWNLOAD_URL = 'https://example.com/private-book.pdf';
}
function response(data, ok = true) { return { ok, status: ok ? 200 : 400, json: async () => data }; }
async function call(handler, body, method = 'POST') {
  const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(s) { this.code = s; return this; }, json(data) { this.data = data; return this; } };
  await handler({ method, body }, res); return res;
}
function order(status = 'APPROVED', captureStatus = 'COMPLETED') {
  return { id: orderID, status, purchase_units: [{ reference_id: PRODUCT.sku,
    amount: { currency_code: PRODUCT.currency, value: '28.00' },
    items: [{ sku: PRODUCT.sku, quantity: '2', unit_amount: { currency_code: PRODUCT.currency, value: '14.00' } }],
    payments: { captures: [{ id: 'capture-1', status: captureStatus, amount: { currency_code: PRODUCT.currency, value: '28.00' } }] }
  }] };
}
test('unconfigured checkout is explicit, and never exposes secret or book URL', async () => {
  ready(); delete process.env.PAYPAL_CLIENT_SECRET;
  const cfg = await call(config, undefined, 'GET');
  assert.equal(cfg.data.checkoutReady, false);
  assert.equal(cfg.data.product.name, 'The Orion Protocol — Digital Edition');
  assert.equal(JSON.stringify(cfg.data).includes('private-book'), false);
  global.fetch = async () => { throw Error('must not contact PayPal'); };
  assert.equal((await call(create, { quantity: 1 })).code, 503);
  ready(); process.env.ORION_DOWNLOAD_URL = 'javascript:alert(1)';
  assert.equal((await call(config, undefined, 'GET')).data.checkoutReady, false);
});
test('server enforces book identity, price and maximum quantity', async () => {
  ready(); let payload;
  global.fetch = async (url, options) => {
    if (url.endsWith('/token')) return response({ access_token: 'test' });
    payload = JSON.parse(options.body); return response({ id: orderID });
  };
  const result = await call(create, { quantity: 999, price: 0.01 });
  assert.equal(result.code, 200);
  assert.equal(payload.purchase_units[0].amount.value, '140.00');
  assert.equal(payload.purchase_units[0].items[0].sku, 'ORION-PROTOCOL-001');
});
test('capture rejects malformed and unrelated orders before charging', async () => {
  ready(); let captures = 0;
  assert.equal((await call(capture, { orderID: '../token' })).code, 400);
  global.fetch = async url => {
    if (url.endsWith('/token')) return response({ access_token: 'test' });
    if (url.endsWith('/capture')) captures++;
    const data = order(); data.purchase_units[0].reference_id = 'DOS-CERT-001'; return response(data);
  };
  assert.equal((await call(capture, { orderID })).code, 409); assert.equal(captures, 0);
});
test('capture verifies totals and refuses an altered order', async () => {
  ready(); global.fetch = async url => {
    if (url.endsWith('/token')) return response({ access_token: 'test' });
    assert.equal(url.endsWith('/capture'), false);
    const data = order(); data.purchase_units[0].amount.value = '0.01'; return response(data);
  };
  assert.equal((await call(capture, { orderID })).code, 409);
});
test('completed payment returns authoritative amount and delivery link; retry never recaptures', async () => {
  ready(); let captures = 0; let complete = false;
  global.fetch = async (url, options) => {
    if (url.endsWith('/token')) return response({ access_token: 'test' });
    if (url.endsWith('/capture')) { captures++; complete = true; assert.equal(options.headers['PayPal-Request-Id'], 'capture-' + orderID); }
    return response(order(complete ? 'COMPLETED' : 'APPROVED'));
  };
  const paid = await call(capture, { orderID });
  assert.equal(paid.data.downloadUrl, process.env.ORION_DOWNLOAD_URL); assert.equal(paid.data.amount.value, '28.00');
  await call(capture, { orderID }); assert.equal(captures, 1);
});
test('pending capture never releases the book', async () => {
  ready(); global.fetch = async url => response(url.endsWith('/token') ? { access_token: 'test' } : order('COMPLETED', 'PENDING'));
  const pending = await call(capture, { orderID });
  assert.equal(pending.data.capture_status, 'PENDING'); assert.equal(pending.data.downloadUrl, undefined);
});
async function frontend(fetcher, sdkFailure = false) {
  const elements = new Map(); let buttonOptions;
  const element = id => {
    if (!elements.has(id)) elements.set(id, { value: id === 'qty' ? '1' : '', hidden: id === 'receipt' || id === 'book-download', disabled: false, textContent: '', handlers: {}, addEventListener(event, fn) { this.handlers[event] = fn; }, replaceChildren() {}, focus() { this.focused = true; } });
    return elements.get(id);
  };
  const window = sdkFailure ? {} : { paypal: { Buttons(options) { buttonOptions = options; return { render: async () => {} }; } } };
  const document = { getElementById: element, createElement: () => ({ remove() {} }), head: { appendChild(script) { script.onerror(); } } };
  vm.runInNewContext(fs.readFileSync(require.resolve('../checkout.js'), 'utf8'), { document, window, fetch: fetcher, Intl, URL, URLSearchParams, AbortSignal, setTimeout, clearTimeout });
  await new Promise(resolve => setImmediate(resolve));
  return { element, options: buttonOptions };
}
const readyConfig = { checkoutReady: true, clientId: 'test', currency: 'USD', env: 'sandbox', product: { price: '14.00', maxQuantity: 10 } };
test('frontend survives unavailable, failed and malformed config, plus SDK loading failure', async () => {
  const unavailable = await frontend(async () => response({ ...readyConfig, checkoutReady: false }));
  assert.match(unavailable.element('buy-message').textContent, /temporarily unavailable/);
  assert.equal(unavailable.element('quantity-controls').disabled, true);
  for (const fetcher of [async () => { throw Error('offline'); }, async () => response({}), async () => response(readyConfig)]) {
    const failed = await frontend(fetcher, true);
    assert.match(failed.element('buy-message').textContent, /could not load/);
    assert.equal(failed.element('retry-checkout').hidden, false);
  }
});
test('receipt uses server amount and pending never becomes a successful purchase', async () => {
  let pending = true;
  const ui = await frontend(async url => response(url.includes('client-config') ? readyConfig : { status: 'COMPLETED', capture_status: pending ? 'PENDING' : 'COMPLETED', order_id: orderID, amount: { value: '28.00', currency_code: 'USD' }, ...(pending ? {} : { downloadUrl: 'https://example.com/book.pdf' }) }));
  await ui.options.onApprove({ orderID }, {});
  assert.equal(ui.element('receipt').hidden, true); assert.equal(ui.element('book-download').hidden, true);
  pending = false;
  await ui.element('retry-checkout').handlers.click();
  assert.equal(ui.element('receipt').hidden, false); assert.equal(ui.element('r-amount').textContent, 'Paid: $28.00');
  assert.equal(ui.element('book-download').hidden, false); assert.equal(ui.element('receipt').focused, true);
});
