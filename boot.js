/* Runs synchronously in <head>: frame-busting, consent state, and theme (no flash of wrong theme). */
(() => {
  // GitHub Pages cannot send X-Frame-Options / frame-ancestors, so refuse to render inside foreign frames.
  if (window.top !== window.self) {
    let sameOrigin = false;
    try { sameOrigin = window.top.location.origin === window.location.origin; } catch { sameOrigin = false; }
    if (!sameOrigin) {
      document.documentElement.hidden = true;
      try { window.top.location = window.location.href; } catch { /* sandboxed: stay hidden */ }
    }
  }

  const DEFAULT = { preferences: false, analytics: false };
  const sessionKnown = () => {
    try { if (sessionStorage.getItem('aurora-consent-v1-session') === '1') return true; } catch { /* blocked */ }
    return /(?:^|;\s*)aurora_consent_session=1(?:;|$)/.test(document.cookie || '');
  };
  let consent = { ...DEFAULT }, known = false;
  try {
    const raw = JSON.parse(localStorage.getItem('aurora-consent-v1') || 'null');
    if (raw && typeof raw === 'object') {
      consent = { preferences: raw.preferences === true, analytics: raw.analytics === true };
      known = true;
    }
  } catch { /* corrupt or blocked storage */ }
  window.__auroraConsent = consent;
  window.__auroraConsentKnown = known || sessionKnown();

  let theme = 'dark';
  try {
    let pref = 'system';
    if (consent.preferences) {
      const saved = JSON.parse(localStorage.getItem('aurora-forecast-v1') || 'null');
      if (saved && ['dark', 'light', 'system'].includes(saved.themePreference)) pref = saved.themePreference;
    }
    theme = pref === 'system' ? (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : pref;
  } catch { theme = 'dark'; }
  document.documentElement.dataset.theme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'light' ? '#f3efe6' : '#04060c');
})();
