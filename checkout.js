(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const state = { price: 14, currency: 'USD', max: 10, ready: false, busy: false, environment: 'sandbox' };
  const reportedOrders = new Set();
  const startedOrders = new Set();
  const track = (name, data, key) => { try { window.dosTrack?.(name, data, key); } catch {} };
  let retryAction = init;
  const format = (amount, currency = state.currency) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  const quantity = () => Math.max(1, Math.min(state.max, parseInt($('qty').value, 10) || 1));
  const message = text => { $('buy-message').textContent = text; };
  function sync(normalize = false) {
    const qty = quantity();
    if (normalize) $('qty').value = qty;
    $('total').textContent = format(state.price * qty);
    $('qty-minus').disabled = qty <= 1;
    $('qty-plus').disabled = qty >= state.max;
  }
  function lock(busy) { state.busy = busy; $('quantity-controls').disabled = busy || !state.ready; }
  async function request(url, body) {
    const response = await fetch(url, {
      method: body ? 'POST' : 'GET', cache: 'no-store', signal: AbortSignal.timeout(20000),
      ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {})
    });
    const data = await response.json();
    if (!response.ok) { const error = new Error(data.error || 'request_failed'); error.issue = data.issue; throw error; }
    return data;
  }
  function loadSDK(clientId, currency) {
    if (window.paypal?.Buttons) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      const timer = setTimeout(() => { script.remove(); reject(new Error('sdk_timeout')); }, 20000);
      script.src = 'https://www.paypal.com/sdk/js?' + new URLSearchParams({ 'client-id': clientId, currency, intent: 'capture', components: 'buttons' });
      script.onload = () => { clearTimeout(timer); window.paypal?.Buttons ? resolve() : reject(new Error('sdk_missing')); };
      script.onerror = () => { clearTimeout(timer); script.remove(); reject(new Error('sdk_failed')); };
      document.head.appendChild(script);
    });
  }
  async function capture(orderID, actions) {
    lock(true);
    $('paypal-buttons').hidden = true;
    $('retry-checkout').hidden = true;
    message('Confirming your payment. Please keep this page open.');
    try {
      const result = await request('/api/paypal/capture-order', { orderID });
      if (result.status !== 'COMPLETED' || result.capture_status !== 'COMPLETED') {
        message('Your payment is still pending. Do not pay again. Order: ' + orderID + '. Check its status below.');
        retryAction = () => capture(orderID, actions);
        $('retry-checkout').textContent = 'Check payment status';
        $('retry-checkout').hidden = false;
        return;
      }
      $('r-status').textContent = 'Payment confirmed.';
      $('r-order').textContent = 'Order: ' + result.order_id;
      $('r-amount').textContent = 'Paid: ' + format(Number(result.amount.value), result.amount.currency_code);
      if (result.downloadUrl) {
        const url = new URL(result.downloadUrl);
        if (url.protocol === 'https:') { $('book-download').href = url.href; $('book-download').hidden = false; }
      }
      $('checkout').hidden = true;
      $('receipt').hidden = false;
      $('receipt').focus();
      if (!reportedOrders.has(result.order_id)) {
        track('purchase_completed', { value: Number(result.amount.value), currency: result.amount.currency_code, environment: state.environment }, result.order_id);
        reportedOrders.add(result.order_id);
      }
    } catch (error) {
      if (error.issue === 'INSTRUMENT_DECLINED' && actions?.restart) {
        $('paypal-buttons').hidden = false;
        message('Please choose another payment method in PayPal.');
        return actions.restart();
      }
      message('We could not confirm the payment status. Do not pay again yet. Order: ' + orderID + '. Check its status below.');
      retryAction = () => capture(orderID, actions);
      $('retry-checkout').textContent = 'Check payment status';
      $('retry-checkout').hidden = false;
    }
  }
  async function init() {
    state.ready = false;
    lock(true);
    $('retry-checkout').hidden = true;
    $('checkout-note').hidden = true;
    message('Checking checkout availability…');
    try {
      const config = await request('/api/paypal/client-config');
      if (!config.product || !Number.isFinite(Number(config.product.price)) || Number(config.product.price) <= 0) throw new Error('invalid_config');
      state.price = Number(config.product.price);
      state.currency = config.currency || 'USD';
      state.environment = config.env === 'live' ? 'live' : 'sandbox';
      state.max = Math.max(1, Math.floor(Number(config.product.maxQuantity) || 1));
      $('qty').max = state.max;
      $('p-price').textContent = format(state.price);
      $('edition-format').textContent = 'Digital edition · ' + state.currency;
      sync(true);
      if (!config.checkoutReady || !config.clientId) {
        message('Online checkout is temporarily unavailable. Please check back soon.');
        return;
      }
      message('Loading secure checkout…');
      await loadSDK(config.clientId, state.currency);
      $('paypal-buttons').replaceChildren();
      await window.paypal.Buttons({
        createOrder: async () => {
          sync(true); lock(true); message('Opening PayPal…');
          try {
            const order = await request('/api/paypal/create-order', { quantity: quantity() });
            if (!order.id) throw new Error('missing_order');
            if (!startedOrders.has(order.id)) {
              track('checkout_started', { quantity: quantity(), environment: state.environment }, order.id);
              startedOrders.add(order.id);
            }
            return order.id;
          } catch (error) { lock(false); message('We could not start checkout. Please try again.'); throw error; }
        },
        onApprove: (data, actions) => capture(data.orderID, actions),
        onCancel: () => { lock(false); message('Checkout was cancelled. You can try again when you are ready.'); },
        onError: () => { if (!$('paypal-buttons').hidden) { lock(false); message('PayPal could not complete checkout. Please try again.'); } }
      }).render('#paypal-buttons');
      state.ready = true; lock(false);
      $('checkout-note').hidden = false;
      message(config.env === 'sandbox' ? 'Test checkout — no real payment will be taken.' : '');
    } catch (error) {
      message('Checkout could not load. Please check your connection and try again.');
      retryAction = init; $('retry-checkout').textContent = 'Try again'; $('retry-checkout').hidden = false;
    }
  }
  $('qty-minus').addEventListener('click', () => { $('qty').value = quantity() - 1; sync(true); });
  $('qty-plus').addEventListener('click', () => { $('qty').value = quantity() + 1; sync(true); });
  $('qty').addEventListener('input', () => sync());
  $('qty').addEventListener('change', () => sync(true));
  $('retry-checkout').addEventListener('click', () => retryAction());
  sync(); init();
})();
