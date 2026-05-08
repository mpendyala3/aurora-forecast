(() => {
  const DEFAULT = { preferences: false, analytics: false };
  try {
    const raw = localStorage.getItem('aurora-consent-v1');
    window.__auroraConsentKnown = Boolean(raw);
    window.__auroraConsent = raw ? { ...DEFAULT, ...JSON.parse(raw) } : { ...DEFAULT };
  } catch {
    window.__auroraConsentKnown = false;
    window.__auroraConsent = { ...DEFAULT };
  }
})();
