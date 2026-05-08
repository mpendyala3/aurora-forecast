(() => {
  const DEFAULT = { preferences: false, analytics: false };
  const hasSessionCookie = () => /(?:^|;\s*)aurora_consent_session=1(?:;|$)/.test(document.cookie || '');
  try {
    const raw = localStorage.getItem('aurora-consent-v1');
    const sessionKnown = sessionStorage.getItem('aurora-consent-v1-session') === '1' || hasSessionCookie();
    window.__auroraConsentKnown = Boolean(raw) || sessionKnown;
    window.__auroraConsent = raw ? { ...DEFAULT, ...JSON.parse(raw) } : { ...DEFAULT };
  } catch {
    window.__auroraConsentKnown = sessionStorage.getItem('aurora-consent-v1-session') === '1' || hasSessionCookie();
    window.__auroraConsent = { ...DEFAULT };
  }
})();
