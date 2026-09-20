const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = name => fs.readFileSync(require.resolve('../' + name), 'utf8');

function analytics(navigator = {}) {
  const window = {};
  vm.runInNewContext(source('analytics.js'), { window, navigator, URL });
  return { window, events: () => (window.vaq || []).filter(x => x[0] === 'event').map(x => x[1]) };
}

test('analytics redacts URLs, filters properties, and keeps dedupe identifiers private', () => {
  const { window, events } = analytics();
  const beforeSend = window.vaq[0][1];
  assert.equal(beforeSend({ url: 'https://departmentofsurrender.com/join.html?email=private#token=secret' }).url, 'https://departmentofsurrender.com/join.html');
  assert.equal(beforeSend({ url: 'invalid' }), null);
  const properties = { currency: 'USD', value: 14, environment: 'live', email: 'private@example.com', token: 'secret' };
  window.dosTrack('purchase_completed', properties, 'private-order');
  window.dosTrack('purchase_completed', properties, 'private-order');
  window.dosTrack('arbitrary-event', properties);
  window.dosTrack('purchase_completed', { ...properties, value: NaN });
  assert.equal(events().length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(events()[0].data)), { environment: 'live', currency: 'USD', value: 14 });
  assert.doesNotMatch(JSON.stringify(events()), /private|secret|token/);
});

test('custom events honor browser privacy signals and analytics errors are harmless', () => {
  for (const navigator of [{ doNotTrack: '1' }, { globalPrivacyControl: true }]) {
    const { window, events } = analytics(navigator);
    window.dosTrack('subscription_confirmed');
    assert.equal(events().length, 0);
  }
  const { window } = analytics();
  window.va = () => { throw Error('blocked'); };
  assert.doesNotThrow(() => window.dosTrack('subscription_confirmed'));
});

function reader({ nativeShare, clipboardFails = false, hash = '', opened = false, visible = true } = {}) {
  const base = analytics(); const window = base.window;
  const handlers = {};
  const node = () => ({ hidden: true, handlers: {}, addEventListener(e, fn) { this.handlers[e] = fn; } });
  const share = node(), copy = node(), status = { textContent: '' };
  const input = { value: '', focus() { this.focused = true; }, select() { this.selected = true; } };
  const manual = { hidden: true, querySelector: () => input };
  const panel = { dataset: { shareUrl: '/transmissions/warning-about-words.html#passage-warning-about-words', shareTitle: 'A Warning About Words', shareText: 'A book asks you to create the image yourself.' }, querySelector: s => ({ '[data-share]': share, '[data-copy]': copy, '[data-share-status]': status, '[data-share-manual]': manual })[s] };
  const summary = { focus() { this.focused = true; } };
  const passage = { tagName: 'DETAILS', open: opened, dataset: { passageId: 'warning-about-words' }, getBoundingClientRect: () => visible ? { top: 100, bottom: 600 } : { top: 1200, bottom: 1800 }, addEventListener(e, fn) { handlers[e] = fn; }, scrollIntoView() { this.scrolled = true; }, querySelector: () => summary };
  let observer; const copied = [], shared = [];
  const navigator = { clipboard: { writeText: async url => { if (clipboardFails) throw Error('denied'); copied.push(url); } } };
  if (nativeShare) navigator.share = async payload => { shared.push(payload); if (nativeShare === 'cancel') { const e = Error('cancel'); e.name = 'AbortError'; throw e; } };
  window.innerHeight = 800;
  window.addEventListener = (e, fn) => { handlers[e] = fn; };
  const document = { querySelectorAll: s => s === '[data-passage-id]' ? [passage] : [panel], getElementById: id => id === 'passage-warning-about-words' ? passage : null };
  vm.runInNewContext(source('reader.js'), { window, document, navigator, location: { hash }, URL, IntersectionObserver: class { constructor(fn) { observer = fn; } observe() {} } });
  return { ...base, share, copy, status, manual, input, copied, shared, passage, summary, handlers, observe: () => observer([{ target: passage, isIntersecting: true }]) };
}

test('sample events require an open visible passage and are deduplicated', () => {
  const ui = reader(); ui.observe(); assert.equal(ui.events().length, 0);
  ui.passage.open = true; ui.handlers.toggle(); ui.observe();
  assert.equal(ui.events().length, 1);
  assert.equal(ui.events()[0].name, 'sample_opened');
  const below = reader({ visible: false, opened: true }); below.observe();
  assert.equal(below.events().length, 0);
});

test('direct reading-room links open and focus the intended excerpt', () => {
  const ui = reader({ hash: '#passage-warning-about-words' });
  assert.equal(ui.passage.open, true); assert.equal(ui.passage.scrolled, true); assert.equal(ui.summary.focused, true);
});

test('native sharing uses the intended quote and canonical passage URL', async () => {
  const ui = reader({ nativeShare: true });
  await ui.share.handlers.click();
  assert.equal(ui.shared[0].text, 'A book asks you to create the image yourself.');
  assert.equal(ui.shared[0].url, 'https://departmentofsurrender.com/transmissions/warning-about-words.html#passage-warning-about-words');
  assert.equal(ui.copied.length, 0);
});

test('sharing falls back to copying; clipboard denial presents a selectable link; cancel stays cancelled', async () => {
  const copied = reader(); await copied.share.handlers.click(); assert.equal(copied.copied.length, 1);
  const manual = reader({ clipboardFails: true }); await manual.copy.handlers.click();
  assert.equal(manual.manual.hidden, false); assert.equal(manual.input.selected, true); assert.match(manual.input.value, /^https:\/\/departmentofsurrender\.com\/transmissions\//);
  assert.doesNotMatch(manual.status.textContent, /Link copied/);
  const cancelled = reader({ nativeShare: 'cancel' }); await cancelled.share.handlers.click();
  assert.equal(cancelled.copied.length, 0); assert.equal(cancelled.status.textContent, '');
});

function confirmation(result, ok = true) {
  const button = { handlers: {}, addEventListener(e, fn) { this.handlers[e] = fn; } };
  const status = { textContent: '' }; const scripts = [];
  const window = {}; const location = { hash: '#token=private-token', pathname: '/join.html' };
  const history = { replaceState() { location.hash = ''; } };
  const document = { querySelector: s => s === '#confirm-enlistment' ? button : s === '#confirmation-status' ? status : null, createElement: () => ({ dataset: {} }), head: { appendChild(script) { assert.equal(location.hash, ''); scripts.push(script); } } };
  const context = vm.createContext({ window, document, history, location, URLSearchParams, URL, navigator: {}, AbortSignal, fetch: async () => ({ ok, json: async () => result }) });
  vm.runInContext(source('newsletter.js'), context);
  return { button, status, scripts, window, loadMetrics() { vm.runInContext(source('analytics.js'), context); scripts[0].onload(); } };
}

test('confirmation tracks only provider-confirmed success after the token is cleared', async () => {
  const ui = confirmation({ status: 'subscribed' });
  assert.equal(ui.scripts.length, 0);
  await ui.button.handlers.click(); assert.equal(ui.scripts.length, 1);
  ui.loadMetrics();
  const events = ui.window.vaq.filter(x => x[0] === 'event');
  assert.equal(events.length, 1); assert.equal(events[0][1].name, 'subscription_confirmed');
  assert.doesNotMatch(JSON.stringify(ui.window.vaq), /private-token/);
  assert.equal(ui.scripts[1].dataset.disableAutoTrack, '1');
  for (const result of [{ status: 'confirmation_sent' }, { error: 'email_service_unavailable' }]) {
    const failed = confirmation(result, !result.error); await failed.button.handlers.click();
    assert.equal(failed.scripts.length, 0); assert.notEqual(failed.button.hidden, true);
  }
});

test('analytics failures cannot turn a confirmed subscription into an error', async () => {
  const ui = confirmation({ status: 'subscribed' });
  ui.window.dosTrack = () => { throw Error('blocked'); };
  await ui.button.handlers.click();
  assert.equal(ui.button.hidden, true); assert.match(ui.status.textContent, /You’re enlisted/);
});
