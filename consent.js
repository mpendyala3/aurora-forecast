(() => {
  const KEY = 'aurora-consent-v1';
  const state = window.__auroraConsent || { preferences: false, analytics: false };
  const rememberSession = () => {
    try { sessionStorage.setItem('aurora-consent-v1-session', '1'); } catch {}
  };
  const rememberPersisted = (value) => {
    try { localStorage.setItem(KEY, JSON.stringify(value)); } catch {}
  };
  const clearThemeState = () => {
    try { localStorage.removeItem('aurora-forecast-v1'); } catch {}
  };
  const pages = document.body ? Array.from(document.body.children) : [];
  const existing = document.querySelector('#aurora-consent-banner');
  if (existing) return;

  const banner = document.createElement('section');
  banner.id = 'aurora-consent-banner';
  banner.className = 'consent-banner';
  banner.hidden = Boolean(window.__auroraConsentKnown);
  banner.innerHTML = `
    <div class="consent-copy">
      <strong>Privacy choices</strong>
      <p>We only use local storage for theme and saved settings. You can allow preferences, or keep essential-only mode.</p>
    </div>
    <div class="consent-actions">
      <label class="consent-option"><input type="checkbox" data-consent="preferences"> Remember preferences</label>
      <label class="consent-option"><input type="checkbox" data-consent="analytics"> Analytics (unused)</label>
      <button type="button" class="button secondary" data-consent-action="essential">Essential only</button>
      <button type="button" class="button primary" data-consent-action="save">Save choices</button>
    </div>
  `;

  const sync = () => {
    const prefs = banner.querySelector('[data-consent="preferences"]');
    const analytics = banner.querySelector('[data-consent="analytics"]');
    if (prefs) prefs.checked = Boolean(state.preferences);
    if (analytics) analytics.checked = Boolean(state.analytics);
  };

  banner.querySelector('[data-consent-action="essential"]')?.addEventListener('click', () => {
    state.preferences = false;
    state.analytics = false;
    rememberPersisted(state);
    clearThemeState();
    rememberSession();
    window.__auroraConsent = { ...state };
    window.__auroraConsentKnown = true;
    banner.hidden = true;
    banner.remove();
  });

  banner.querySelector('[data-consent-action="save"]')?.addEventListener('click', () => {
    state.preferences = Boolean(banner.querySelector('[data-consent="preferences"]')?.checked);
    state.analytics = Boolean(banner.querySelector('[data-consent="analytics"]')?.checked);
    rememberPersisted(state);
    rememberSession();
    window.__auroraConsent = { ...state };
    window.__auroraConsentKnown = true;
    if (!state.preferences) clearThemeState();
    banner.hidden = true;
    banner.remove();
  });

  pages.length ? document.body.appendChild(banner) : document.addEventListener('DOMContentLoaded', () => document.body.appendChild(banner));
  sync();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
  }
})();
