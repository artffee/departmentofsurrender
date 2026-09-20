(() => {
  'use strict';
  window.va = window.va || function () {
    (window.vaq = window.vaq || []).push(arguments);
  };
  // Configure the deferred Vercel script before it loads. Keep page addresses
  // free of query values and fragments that could contain personal information.
  window.va('beforeSend', (event) => {
    try {
      const url = new URL(event.url);
      url.search = '';
      url.hash = '';
      return { ...event, url: url.toString() };
    } catch {
      return null;
    }
  });

  const seen = new Set();
  const passages = new Set(["warning-about-words", "productive-leisure", "the-word-enough"]);
  // Only these fixed, non-personal properties may reach the analytics provider.
  // Dedupe keys stay in this page's memory; they are never sent or stored.
  window.dosTrack = (name, properties = {}, key = '') => {
    try {
      if (navigator.globalPrivacyControl || navigator.doNotTrack === '1') return;
      let data;
      if (name === 'sample_opened' && passages.has(properties.passage) && ['reading-room', 'transmission'].includes(properties.source)) {
        data = { passage: properties.passage, source: properties.source };
      } else if (name === 'subscription_confirmed') {
        data = { source: 'email-confirmation' };
      } else if (name === 'checkout_started' && ['live', 'sandbox'].includes(properties.environment) && Number.isInteger(properties.quantity) && properties.quantity >= 1 && properties.quantity <= 10) {
        data = { environment: properties.environment, quantity: properties.quantity };
      } else if (name === 'purchase_completed' && ['live', 'sandbox'].includes(properties.environment) && properties.currency === 'USD' && Number.isFinite(properties.value) && properties.value > 0 && properties.value <= 140) {
        data = { environment: properties.environment, currency: 'USD', value: properties.value };
      } else return;
      const identity = name + ':' + key;
      if (key && seen.has(identity)) return;
      window.va('event', { name, data });
      if (key) seen.add(identity);
    } catch { /* Metrics must never interrupt reading, signup or payment. */ }
  };
})();
