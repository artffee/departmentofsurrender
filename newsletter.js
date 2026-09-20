(() => {
  'use strict';
  const messages = {
    newsletter_unavailable: 'Enlistment is temporarily closed. Please check back soon.',
    email_service_unavailable: 'The Department could not complete your request. Please try again shortly.',
    email_and_consent_required: 'Enter a valid email address and tick the consent box.',
    try_later: 'Too many requests. Please try again in an hour.',
    invalid_or_expired_link: 'This confirmation link is invalid or has expired. Request a new one in the reading room.'
  };
  async function request(body) {
    const response = await fetch('/api/newsletter', {
      method: body ? 'POST' : 'GET', cache: 'no-store', signal: AbortSignal.timeout(30000),
      ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {})
    });
    const data = await response.json();
    if (!response.ok) throw new Error(messages[data.error] || 'The request could not be completed. Please try again.');
    return data;
  }
  const form = document.querySelector('#enlist-form');
  if (form) {
    const status = document.querySelector('#enlist-status');
    const fieldset = form.querySelector('fieldset');
    const button = form.querySelector('button[type="submit"]');
    request().then(data => {
      if (data.ready) { fieldset.disabled = false; status.textContent = ''; }
      else status.textContent = messages.newsletter_unavailable;
    }).catch(() => { status.textContent = 'Enlistment could not load. Please refresh this page to try again.'; });
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const payload = { action: 'subscribe', email: form.elements.email.value, consent: form.elements.consent.checked, website: form.elements.website.value };
      fieldset.disabled = true;
      button.textContent = 'Sending…';
      status.textContent = 'Sending your confirmation link…';
      try {
        const result = await request(payload);
        if (result.status !== 'confirmation_sent') throw new Error('Your request could not be confirmed. Please try again.');
        form.reset();
        status.textContent = 'Check your inbox. Confirm your email to join the Department. If the message is missing, check your spam folder.';
      } catch (error) { status.textContent = error.message || 'Please try again shortly.'; }
      finally { fieldset.disabled = false; button.textContent = 'Join the Department'; }
    });
  }
  const confirm = document.querySelector('#confirm-enlistment');
  if (confirm) {
    let token = new URLSearchParams(location.hash.slice(1)).get('token');
    history.replaceState(null, '', location.pathname);
    const status = document.querySelector('#confirmation-status');
    if (!token) { status.textContent = 'Open the confirmation link from your email, or return to the reading room to request one.'; return; }
    confirm.disabled = false;
    status.textContent = 'Confirm below to receive the Department’s bulletins, new case files and future-book news. You can unsubscribe at any time.';
    confirm.addEventListener('click', async () => {
      confirm.disabled = true;
      status.textContent = 'Confirming your enlistment…';
      try {
        const result = await request({ action: 'confirm', token });
        if (result.status !== 'subscribed') throw new Error('Your enlistment could not be confirmed. Please try again.');
        token = null;
        status.textContent = 'You’re enlisted. The Bird has made a note. Watch your inbox for the next transmission.';
        confirm.hidden = true;
        // Load analytics only after confirmation and after removing the token
        // from the address bar. Opening the email link alone sends no analytics.
        try { if (typeof window.dosTrack === 'function') {
          window.dosTrack('subscription_confirmed', {}, 'confirmed');
        } else {
          const bootstrap = document.createElement('script');
          bootstrap.src = '/analytics.js';
          bootstrap.onload = () => {
            try {
              window.dosTrack?.('subscription_confirmed', {}, 'confirmed');
              const metrics = document.createElement('script');
              metrics.src = '/_vercel/insights/script.js';
              metrics.dataset.disableAutoTrack = '1';
              document.head.appendChild(metrics);
            } catch { /* Confirmation has already succeeded. */ }
          };
          document.head.appendChild(bootstrap);
        } } catch { /* Analytics failure cannot change a confirmed subscription. */ }
      } catch (error) { status.textContent = error.message || 'Please try again shortly.'; confirm.disabled = false; }
    });
  }
})();
