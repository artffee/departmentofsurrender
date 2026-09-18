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
})();
