(() => {
  'use strict';
  const trackSample = element => {
    if (element.tagName === 'DETAILS' && !element.open) return;
    const box = element.getBoundingClientRect();
    if (box.bottom <= 0 || box.top >= window.innerHeight) return;
    window.dosTrack?.('sample_opened', {
      passage: element.dataset.passageId,
      source: element.tagName === 'DETAILS' ? 'reading-room' : 'transmission'
    }, element.dataset.passageId);
  };
  const passages = document.querySelectorAll('[data-passage-id]');
  const observer = typeof IntersectionObserver === 'function'
    ? new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) trackSample(entry.target);
    }), { threshold: 0.15 }) : null;
  passages.forEach(element => {
    observer?.observe(element);
    element.addEventListener('toggle', () => trackSample(element));
  });
  if (!observer) {
    const check = () => passages.forEach(trackSample);
    window.addEventListener('scroll', check, { passive: true });
    check();
  }

  function revealPassage() {
    const id = location.hash.slice(1);
    if (!/^passage-(warning-about-words|productive-leisure|the-word-enough)$/.test(id)) return;
    const target = document.getElementById(id);
    if (!target) return;
    if (target.tagName === 'DETAILS') target.open = true;
    target.scrollIntoView({ block: 'start' });
    target.querySelector('summary')?.focus({ preventScroll: true });
  }
  window.addEventListener('hashchange', revealPassage);
  revealPassage();

  document.querySelectorAll('[data-share-url]').forEach(panel => {
    const url = new URL(panel.dataset.shareUrl, 'https://departmentofsurrender.com').href;
    const status = panel.querySelector('[data-share-status]');
    const manual = panel.querySelector('[data-share-manual]');
    const copy = async () => {
      try {
        if (!navigator.clipboard?.writeText) throw new Error('clipboard_unavailable');
        await navigator.clipboard.writeText(url);
        manual.hidden = true;
        status.textContent = 'Link copied. This file is cleared for circulation.';
      } catch {
        manual.hidden = false;
        const input = manual.querySelector('input');
        input.value = url;
        input.focus();
        input.select();
        status.textContent = 'Select and copy the link below.';
      }
    };
    const share = panel.querySelector('[data-share]');
    const copyButton = panel.querySelector('[data-copy]');
    share.hidden = false;
    copyButton.hidden = false;
    copyButton.addEventListener('click', copy);
    share.addEventListener('click', async () => {
      if (!navigator.share) return copy();
      try {
        await navigator.share({ title: panel.dataset.shareTitle, text: panel.dataset.shareText, url });
        status.textContent = 'Passage shared.';
      } catch (error) {
        if (error.name !== 'AbortError') await copy();
      }
    });
  });

  const availability = document.getElementById('faq-checkout-status');
  if (availability) {
    fetch('/api/paypal/client-config', { cache: 'no-store', signal: AbortSignal.timeout(8000) })
      .then(response => { if (!response.ok) throw new Error('unavailable'); return response.json(); })
      .then(data => {
        availability.textContent = data.checkoutReady && data.clientId && data.env === 'live'
          ? 'Checkout is open. Visit the book page to see the current price and pay securely with PayPal.'
          : 'Purchases are temporarily unavailable while checkout is being connected. The free sample and transmissions remain open.';
      }).catch(() => { availability.textContent = 'Check the book page for current checkout availability.'; });
  }
})();
