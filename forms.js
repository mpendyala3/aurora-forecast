/* Progressive enhancement for Formspree forms (contact + operator suggestion).
 * Without JavaScript the forms post normally. All status text is set with textContent. */
(() => {
  'use strict';
  document.querySelectorAll('form[data-async-form]').forEach((form) => {
    const status = form.querySelector('[data-form-status]');
    const button = form.querySelector('button[type="submit"]');
    const urlError = form.querySelector('[data-url-error]');
    const label = button ? button.textContent : '';
    let endpoint;
    try { endpoint = new URL(form.action); } catch { return; }
    if (endpoint.origin !== 'https://formspree.io') return; // never post anywhere unexpected

    const show = (kind, message) => {
      if (!status) return;
      status.hidden = false;
      status.className = `contact-status ${kind}`;
      const title = document.createElement('strong');
      title.textContent = kind === 'success' ? 'Sent' : 'Not sent';
      const text = document.createElement('span');
      text.textContent = message;
      status.replaceChildren(title, text);
    };
    const busy = (on) => { if (button) { button.disabled = on; button.textContent = on ? 'Sending…' : label; } };

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (urlError) urlError.textContent = '';
      const data = new FormData(form);
      if (data.get('_gotcha')) return; // honeypot: silently drop bots

      for (const input of form.querySelectorAll('input[type="url"]')) {
        let ok = false;
        try { const parsed = new URL(input.value.trim()); ok = ['http:', 'https:'].includes(parsed.protocol); if (ok) data.set(input.name, parsed.href); } catch { ok = false; }
        input.setAttribute('aria-invalid', String(!ok));
        if (!ok) { if (urlError) urlError.textContent = 'Please enter a full website address starting with https://'; input.focus(); return; }
      }

      busy(true);
      let response = null;
      try {
        response = await fetch(endpoint.href, { method: 'POST', headers: { Accept: 'application/json' }, body: data, credentials: 'omit', referrerPolicy: 'no-referrer' });
      } catch { response = null; }
      busy(false);

      if (response && response.ok) {
        form.reset();
        show('success', form.dataset.success || 'Sent. Thank you.');
      } else if (!response && 'fallbackSubmit' in form.dataset) {
        form.submit(); // network-level failure: let the browser post the form directly
      } else {
        show('error', 'Something went wrong on the way. Please try again in a moment.');
      }
    });
  });
})();
