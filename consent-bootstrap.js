(() => {
  const DEFAULT = { preferences: false, analytics: false };
  try {
    const raw = localStorage.getItem('aurora-consent-v1');
    const sessionKnown = sessionStorage.getItem('aurora-consent-v1-session') === '1';
    window.__auroraConsentKnown = Boolean(raw) || sessionKnown;
    window.__auroraConsent = raw ? { ...DEFAULT, ...JSON.parse(raw) } : { ...DEFAULT };
  } catch {
    window.__auroraConsentKnown = sessionStorage.getItem('aurora-consent-v1-session') === '1';
    window.__auroraConsent = { ...DEFAULT };
  }
})();
