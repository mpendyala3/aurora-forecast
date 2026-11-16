/* Privacy banner + service worker registration. Consent state is read in boot.js. */
(() => {
  'use strict';
  const KEY = 'aurora-consent-v1';
  const state = { preferences: Boolean(window.__auroraConsent?.preferences), analytics: Boolean(window.__auroraConsent?.analytics) };
  const el = (tag, props = {}, ...children) => {
    const node = Object.assign(document.createElement(tag), props);
    node.append(...children);
    return node;
  };

  const prefs = el('input', { type: 'checkbox', checked: state.preferences });
  const essential = el('button', { type: 'button', className: 'button secondary', textContent: 'Essential only' });
  const save = el('button', { type: 'button', className: 'button primary', textContent: 'Save choices' });
  const banner = el('section', { id: 'aurora-consent-banner', className: 'consent-banner', hidden: Boolean(window.__auroraConsentKnown) },
    el('div', { className: 'consent-copy' },
      el('strong', { textContent: 'Privacy choices' }),
      el('p', { textContent: 'No tracking, no ads, no analytics. With your OK we remember your theme, location and alert threshold in this browser. Nothing is stored on a server.' })),
    el('div', { className: 'consent-actions' },
      el('label', { className: 'consent-option' }, prefs, ' Remember preferences'),
      essential, save));
  banner.setAttribute('aria-label', 'Privacy choices');

  const commit = (preferences) => {
    state.preferences = preferences;
    state.analytics = false;
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage blocked */ }
    if (!preferences) { try { localStorage.removeItem('aurora-forecast-v1'); } catch { /* storage blocked */ } }
    try { sessionStorage.setItem('aurora-consent-v1-session', '1'); } catch { /* storage blocked */ }
    try { document.cookie = `aurora_consent_session=1; Path=/; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`; } catch { /* cookies blocked */ }
    window.__auroraConsent = { ...state };
    window.__auroraConsentKnown = true;
    banner.hidden = true;
  };
  essential.addEventListener('click', () => commit(false));
  save.addEventListener('click', () => commit(prefs.checked));
  document.addEventListener('click', (event) => {
    if (!event.target.closest?.('[data-consent-open]')) return;
    prefs.checked = state.preferences;
    banner.hidden = false;
    save.focus();
  });
  document.body.appendChild(banner);

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}); });
  }
})();
