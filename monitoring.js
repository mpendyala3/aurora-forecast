(() => {
  const meta = (name) => document.querySelector(`meta[name="${name}"]`)?.content?.trim() || '';
  const endpoint = meta('aurora-telemetry-endpoint');
  const provider = meta('aurora-analytics-provider') || 'privacy-first';
  const state = {
    provider,
    endpoint,
    errors: [],
    metrics: { lcp: null, cls: 0, inp: null, fcp: null, ttfb: null },
    sent: false,
  };

  const hasConsent = () => Boolean(window.__auroraConsent?.analytics);
  const now = () => Math.round(performance.now());
  const pushError = (type, payload) => {
    state.errors.push({ type, ...payload, at: now() });
    if (state.errors.length > 10) state.errors.shift();
  };

  const send = (reason) => {
    if (!endpoint || !hasConsent() || state.sent) return;
    state.sent = true;
    const nav = performance.getEntriesByType('navigation')[0];
    const payload = {
      reason,
      path: location.pathname + location.search,
      title: document.title,
      referrer: document.referrer || '',
      theme: document.documentElement.dataset.theme || 'unknown',
      provider: state.provider,
      metrics: { ...state.metrics },
      nav: nav ? {
        type: nav.type,
        ttfb: Math.round(nav.responseStart),
        domContentLoaded: Math.round(nav.domContentLoadedEventEnd),
        load: Math.round(nav.loadEventEnd),
      } : null,
      errors: state.errors.slice(-5),
      visibility: document.visibilityState,
    };
    const body = JSON.stringify(payload);
    try {
      if (navigator.sendBeacon?.(endpoint, new Blob([body], { type: 'application/json' }))) return;
    } catch {}
    fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true, mode: 'cors' }).catch(() => {});
  };

  const updateCLS = (entry) => {
    if (entry.hadRecentInput) return;
    state.metrics.cls = Math.round((state.metrics.cls + entry.value) * 1000) / 1000;
  };

  const updateLCP = (entry) => {
    state.metrics.lcp = Math.round(entry.renderTime || entry.loadTime || entry.startTime || 0);
  };

  const updateINP = (entry) => {
    const duration = Math.round(entry.duration || 0);
    if (!state.metrics.inp || duration > state.metrics.inp) state.metrics.inp = duration;
  };

  try {
    new PerformanceObserver((list) => { for (const entry of list.getEntries()) updateLCP(entry); }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((list) => { for (const entry of list.getEntries()) updateCLS(entry); }).observe({ type: 'layout-shift', buffered: true });
    new PerformanceObserver((list) => { for (const entry of list.getEntries()) updateINP(entry); }).observe({ type: 'event', buffered: true, durationThreshold: 40 });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name === 'first-contentful-paint') state.metrics.fcp = Math.round(entry.startTime);
      }
    }).observe({ type: 'paint', buffered: true });
  } catch {}

  try {
    const nav = performance.getEntriesByType('navigation')[0];
    if (nav) state.metrics.ttfb = Math.round(nav.responseStart);
  } catch {}

  window.addEventListener('error', (event) => {
    pushError('error', { message: event.message || 'Script error', source: event.filename || '', line: event.lineno || 0, col: event.colno || 0 });
    send('error');
  }, true);

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason?.message || String(event.reason || 'Unhandled rejection');
    pushError('rejection', { message: reason });
    send('rejection');
  });

  window.addEventListener('pagehide', () => send('pagehide'));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') send('hidden'); });

  window.AuroraMonitoring = {
    snapshot: () => ({ ...state, errors: state.errors.slice() }),
    flush: () => send('manual'),
  };
})();
