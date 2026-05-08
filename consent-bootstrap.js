(() => {
  const DEFAULT = { preferences: false, analytics: false };
  const hasSessionCookie = () => /(?:^|;\s*)aurora_consent_session=1(?:;|$)/.test(document.cookie || '');
  const hasWindowMark = () => String(window.name || '').includes('aurora_consent_seen=1');
  try {
    const raw = localStorage.getItem('aurora-consent-v1');
    const sessionKnown = sessionStorage.getItem('aurora-consent-v1-session') === '1' || hasSessionCookie() || hasWindowMark();
    window.__auroraConsentKnown = Boolean(raw) || sessionKnown;
    window.__auroraConsent = raw ? { ...DEFAULT, ...JSON.parse(raw) } : { ...DEFAULT };
  } catch {
    window.__auroraConsentKnown = sessionStorage.getItem('aurora-consent-v1-session') === '1' || hasSessionCookie() || hasWindowMark();
    window.__auroraConsent = { ...DEFAULT };
  }
})();
