const PRESETS = [
  { name: 'Stockholm', lat: 59.3293, lon: 18.0686, cloud: 45 },
  { name: 'Tromsø', lat: 69.6492, lon: 18.9553, cloud: 38 },
  { name: 'Reykjavík', lat: 64.1466, lon: -21.9426, cloud: 52 },
  { name: 'Fairbanks', lat: 64.8378, lon: -147.7164, cloud: 33 },
  { name: 'Oslo', lat: 59.9139, lon: 10.7522, cloud: 48 },
  { name: 'Rovaniemi', lat: 66.5039, lon: 25.7294, cloud: 40 },
];

const els = {
  updatedAt: document.querySelector('#updatedAt'),
  dataSource: document.querySelector('#dataSource'),
  activeLocation: document.querySelector('#activeLocation'),
  kpValue: document.querySelector('#kpValue'),
  kpLabel: document.querySelector('#kpLabel'),
  windValue: document.querySelector('#windValue'),
  bzValue: document.querySelector('#bzValue'),
  cloudValue: document.querySelector('#cloudValue'),
  chanceValue: document.querySelector('#chanceValue'),
  chanceFill: document.querySelector('#chanceFill'),
  summaryLabel: document.querySelector('#summaryLabel'),
  summaryText: document.querySelector('#summaryText'),
  windowTitle: document.querySelector('#windowTitle'),
  windowText: document.querySelector('#windowText'),
  sunsetValue: document.querySelector('#sunsetValue'),
  sunriseValue: document.querySelector('#sunriseValue'),
  darkHourValue: document.querySelector('#darkHourValue'),
  timeline: document.querySelector('#timeline'),
  cityRankings: document.querySelector('#cityRankings'),
  calendarMonthLabel: document.querySelector('#calendarMonthLabel'),
  calendarPrev: document.querySelector('#calendarPrev'),
  calendarNext: document.querySelector('#calendarNext'),
  forecastCalendar: document.querySelector('#forecastCalendar'),
  calendarSelectedLabel: document.querySelector('#calendarSelectedLabel'),
  calendarSelectedSummary: document.querySelector('#calendarSelectedSummary'),
  calendarSelectedScore: document.querySelector('#calendarSelectedScore'),
  calendarSelectedMoon: document.querySelector('#calendarSelectedMoon'),
  calendarSelectedSunset: document.querySelector('#calendarSelectedSunset'),
  calendarSelectedSunrise: document.querySelector('#calendarSelectedSunrise'),
  calendarBestNights: document.querySelector('#calendarBestNights'),
  searchInput: document.querySelector('#searchInput'),
  searchButton: document.querySelector('#searchButton'),
  searchResults: document.querySelector('#searchResults'),
  siteSearchInput: document.querySelector('#siteSearchInput'),
  siteSearchButton: document.querySelector('#siteSearchButton'),
  siteSearchResults: document.querySelector('#siteSearchResults'),
  latInput: document.querySelector('#latInput'),
  lonInput: document.querySelector('#lonInput'),
  cloudInput: document.querySelector('#cloudInput'),
  cloudPreview: document.querySelector('#cloudPreview'),
  presetRow: document.querySelector('#presetRow'),
  locationForm: document.querySelector('#locationForm'),
  useCurrent: document.querySelector('#useCurrent'),
  visibilityScore: document.querySelector('#visibilityScore'),
  resultSummary: document.querySelector('#resultSummary'),
  resultNotes: document.querySelector('#resultNotes'),
  mapBadge: document.querySelector('#mapBadge'),
  mapBzChip: document.querySelector('#mapBzChip'),
  mapWindChip: document.querySelector('#mapWindChip'),
  mapDarkChip: document.querySelector('#mapDarkChip'),
  mapCanvas: document.querySelector('#mapCanvas'),
  auroraBand: document.querySelector('#auroraBand'),
  bestCities: document.querySelector('#bestCities'),
  tourForm: document.querySelector('#tourForm'),
  tourNameInput: document.querySelector('#tourNameInput'),
  tourWebsiteInput: document.querySelector('#tourWebsiteInput'),
  tourRegionInput: document.querySelector('#tourRegionInput'),
  tourEmailInput: document.querySelector('#tourEmailInput'),
  tourTypeInput: document.querySelector('#tourTypeInput'),
  tourDescriptionInput: document.querySelector('#tourDescriptionInput'),
  tourSubmissions: document.querySelector('#tourSubmissions'),
  emailInput: document.querySelector('#emailInput'),
  thresholdInput: document.querySelector('#thresholdInput'),
  thresholdValue: document.querySelector('#thresholdValue'),
  notifyToggle: document.querySelector('#notifyToggle'),
  saveToggle: document.querySelector('#saveToggle'),
  alertForm: document.querySelector('#alertForm'),
  watchlist: document.querySelector('#watchlist'),
  featuredCamTitle: document.querySelector('#featuredCamTitle'),
  featuredCamMeta: document.querySelector('#featuredCamMeta'),
  featuredCamLink: document.querySelector('#featuredCamLink'),
  featuredCamFrame: document.querySelector('#featuredCamFrame'),
};

const root = document.documentElement;
const themeMeta = document.querySelector('meta[name="theme-color"]');
const themeButtons = [...document.querySelectorAll('[data-theme-option]')];
const navLinks = [...document.querySelectorAll('.nav-links a[href^="#"]')];
const systemThemeMedia = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
const viewportMedia = window.matchMedia ? window.matchMedia('(max-width: 700px)') : null;
const mapFocusButtons = [...document.querySelectorAll('[data-map-focus]')];
const webcamItems = [...document.querySelectorAll('.cam-item[data-webcam-id]')];
const navSections = navLinks
  .map((link) => document.querySelector(link.getAttribute('href')))
  .filter(Boolean);

const defaultFeaturedCam = {
  title: 'Featured live cam',
  meta: 'Kilpisjärvi, Finland · north view',
  id: 'ccTVAhJU5lg',
  watch: 'https://www.youtube.com/watch?v=ccTVAhJU5lg',
};

const STORAGE_KEY = 'aurora-forecast-v1';

function hasPreferenceConsent() {
  return Boolean(window.__auroraConsent?.preferences);
}

const state = {
  weather: null,
  location: { ...PRESETS[0] },
  threshold: 60,
  notify: false,
  saveLocation: true,
  watchlist: [],
  tourSubmissions: [],
  lastNotifiedKey: null,
  calendarOffset: 0,
  calendarSelectedDate: new Date(),
  mapFocus: 'global',
  themePreference: 'system',
};

let searchDebounceTimer = null;
let siteSearchDebounceTimer = null;
let topBarFrame = null;
let liveBootstrapped = false;
let activeWebcamId = defaultFeaturedCam.id;

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function round(v, digits = 0) { return Number(v.toFixed(digits)); }
function pad(n) { return String(n).padStart(2, '0'); }
function toLocalTime(date) {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
function toDateStamp(date) {
  return date.toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' });
}
function dayOfYear(date) {
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date - start) / 86400000);
}
function degToRad(deg) { return (deg * Math.PI) / 180; }
function radToDeg(rad) { return (rad * 180) / Math.PI; }
function normalize(value, max) {
  let out = value % max;
  if (out < 0) out += max;
  return out;
}

function normalizeSearchText(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function levenshtein(a, b) {
  const s = normalizeSearchText(a);
  const t = normalizeSearchText(b);
  if (!s.length) return t.length;
  if (!t.length) return s.length;
  const prev = Array.from({ length: t.length + 1 }, (_, i) => i);
  for (let i = 1; i <= s.length; i += 1) {
    let cur = [i];
    for (let j = 1; j <= t.length; j += 1) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (s[i - 1] === t[j - 1] ? 0 : 1),
      );
    }
    prev.splice(0, prev.length, ...cur);
  }
  return prev[t.length];
}

function searchScore(query, text, extras = []) {
  const q = normalizeSearchText(query);
  if (!q) return 0;
  const haystack = normalizeSearchText([text, ...extras].join(' '));
  if (!haystack) return 0;
  if (haystack.includes(q)) return 100 - Math.min(30, haystack.indexOf(q));

  const qTokens = q.split(' ').filter(Boolean);
  const hTokens = haystack.split(' ').filter(Boolean);
  let score = 0;

  qTokens.forEach((qToken) => {
    let best = 0;
    hTokens.forEach((hToken) => {
      const distance = levenshtein(qToken, hToken);
      const ratio = 1 - (distance / Math.max(qToken.length, hToken.length));
      if (ratio > best) best = ratio;
    });
    if (best > 0.45) score += best * 34;
  });

  return clamp(Math.round(score), 0, 100);
}

const SITE_SEARCH_INDEX = [
  { title: 'Forecast', href: '#forecast', description: 'Best viewing times tonight', keywords: ['aurora forecast', 'tonight', 'hourly', 'wind', 'kp'] },
  { title: 'Calendar', href: '#calendar', description: 'Monthly forecast calendar', keywords: ['moon', 'month', 'nights', 'watch'] },
  { title: 'Location planner', href: '#planner', description: 'See if you’ll spot it from here', keywords: ['search city', 'location', 'latitude', 'longitude'] },
  { title: 'Aurora visibility map', href: '#map', description: 'Approximate aurora oval and focus regions', keywords: ['map', 'oval', 'north america', 'nordics'] },
  { title: 'Live aurora telecast', href: '#webcams', description: 'Live webcam streams', keywords: ['webcam', 'camera', 'live sky'] },
  { title: 'Tours', href: '#tours', description: 'Reputed aurora tour operators', keywords: ['operator', 'trip', 'chase', 'tour'] },
  { title: 'Alerts', href: '#alerts', description: 'Set a watch and get notified', keywords: ['notification', 'threshold', 'watchlist'] },
  { title: 'Learn', href: '#learn', description: 'What the numbers mean', keywords: ['kp', 'bz', 'cloud cover', 'dark sky'] },
  { title: 'About us', href: 'about.html', description: 'How Aurora Hunt works', keywords: ['about', 'site guide', 'what we do'] },
  { title: 'Contact us', href: 'contact.html', description: 'Support, partnerships, and feature ideas', keywords: ['contact', 'support', 'bug report'] },
  { title: 'Privacy policy', href: 'privacy.html', description: 'How we handle data and storage', keywords: ['privacy', 'data', 'local storage'] },
  { title: 'Cookies', href: 'cookies.html', description: 'What browser storage is used', keywords: ['cookies', 'browser storage', 'preferences'] },
  { title: 'Submit operator', href: 'submit-operator.html', description: 'Suggest a new tour operator', keywords: ['operator', 'submit', 'tour'] },
];

function getSystemTheme() {
  return systemThemeMedia?.matches ? 'dark' : 'light';
}

function syncThemeButtons() {
  themeButtons.forEach((button) => {
    const active = button.dataset.themeOption === state.themePreference;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}

function syncDefaultThemeButtonIcon() {
  const defaultButton = themeButtons.find((button) => button.dataset.themeOption === 'system');
  if (!defaultButton) return;
  const icon = defaultButton.querySelector('.theme-icon');
  if (!icon) return;
  icon.classList.toggle('theme-icon-mobile', Boolean(viewportMedia?.matches));
  icon.classList.toggle('theme-icon-desktop', !viewportMedia?.matches);
  defaultButton.setAttribute('aria-label', viewportMedia?.matches ? 'Default theme mobile' : 'Default theme desktop');
}

function buildWebcamEmbedUrl(id, autoplay = true) {
  const url = new URL(`https://www.youtube.com/embed/${id}`);
  url.searchParams.set('autoplay', autoplay ? '1' : '0');
  url.searchParams.set('mute', '1');
  url.searchParams.set('playsinline', '1');
  url.searchParams.set('rel', '0');
  url.searchParams.set('modestbranding', '1');
  return url.toString();
}

function setFeaturedWebcam(cam, autoplay = true) {
  if (!cam || !els.featuredCamFrame) return;
  activeWebcamId = cam.id;
  if (els.featuredCamTitle) els.featuredCamTitle.textContent = cam.title;
  if (els.featuredCamMeta) els.featuredCamMeta.textContent = cam.meta;
  if (els.featuredCamLink) els.featuredCamLink.href = cam.watch;
  els.featuredCamFrame.src = buildWebcamEmbedUrl(cam.id, autoplay);

  webcamItems.forEach((item) => {
    const active = item.dataset.webcamId === cam.id;
    item.classList.toggle('active', active);
    item.setAttribute('aria-current', active ? 'true' : 'false');
  });
}

function applyTheme(preference = state.themePreference) {
  const actualTheme = preference === 'system' ? getSystemTheme() : preference;
  root.dataset.theme = actualTheme;
  if (themeMeta) themeMeta.setAttribute('content', actualTheme === 'light' ? '#eef4ff' : '#07111f');
  syncThemeButtons();
  syncDefaultThemeButtonIcon();
}

function syncTopBarState() {
  const compact = Boolean(viewportMedia?.matches) && window.scrollY < 18;
  document.body.classList.toggle('mobile-topbar-compact', compact);
}

function scheduleTopBarStateSync() {
  if (topBarFrame) return;
  topBarFrame = window.requestAnimationFrame(() => {
    topBarFrame = null;
    syncTopBarState();
  });
}

function syncNavActive(sectionId) {
  navLinks.forEach((link) => {
    const active = link.getAttribute('href') === `#${sectionId}`;
    link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
}

function startOfMonth(date, offset = 0) {
  return new Date(date.getFullYear(), date.getMonth() + offset, 1);
}

function formatMonthYear(date) {
  return date.toLocaleString([], { month: 'long', year: 'numeric' });
}

function formatCalendarDate(date) {
  return date.toLocaleString([], { weekday: 'long', month: 'short', day: 'numeric' });
}

function moonAge(date) {
  const synodicMonth = 29.53058867;
  const knownNewMoon = Date.UTC(2000, 0, 6, 18, 14, 0);
  const daysSince = (date.getTime() - knownNewMoon) / 86400000;
  return normalize(daysSince, synodicMonth);
}

function moonInfo(date) {
  const age = moonAge(date);
  const synodicMonth = 29.53058867;
  const fullAge = synodicMonth / 2;
  const nearNew = age < 1.25 || age > synodicMonth - 1.25;
  const nearFull = Math.abs(age - fullAge) < 1.4;

  if (nearNew) return { label: 'New moon', type: 'new', age };
  if (nearFull) return { label: 'Full moon', type: 'full', age };
  if (age < 7.4) return { label: 'Waxing crescent', type: 'other', age };
  if (age < 8.9) return { label: 'First quarter', type: 'other', age };
  if (age < 14.0) return { label: 'Waxing gibbous', type: 'other', age };
  if (age < 16.0) return { label: 'Waning gibbous', type: 'other', age };
  if (age < 22.0) return { label: 'Last quarter', type: 'other', age };
  return { label: 'Waning crescent', type: 'other', age };
}

function scoreClass(score) {
  if (score >= 76) return 'very-high';
  if (score >= 51) return 'high';
  if (score >= 26) return 'medium';
  return 'low';
}

function renderSiteSearchResults(query) {
  if (!els.siteSearchResults) return;
  const q = query.trim();
  els.siteSearchResults.innerHTML = '';

  if (!q) {
    const hint = document.createElement('p');
    hint.className = 'field-hint';
    hint.textContent = 'Try “privacy”, “contact”, “forecast”, or “map”.';
    els.siteSearchResults.appendChild(hint);
    return;
  }

  const results = SITE_SEARCH_INDEX
    .map((item) => ({ ...item, score: searchScore(q, item.title, [item.description, ...(item.keywords || [])]) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  if (!results.length) {
    const empty = document.createElement('p');
    empty.className = 'field-hint';
    empty.textContent = 'No direct matches. Try a simpler word.';
    els.siteSearchResults.appendChild(empty);
    return;
  }

  results.forEach((item) => {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'search-result';
    row.innerHTML = `
      <div>
        <strong>${item.title}</strong>
        <small>${item.description}</small>
      </div>
      <span class="muted">${item.href.startsWith('#') ? 'Section' : 'Page'}</span>
    `;
    row.addEventListener('click', () => {
      if (item.href.startsWith('#')) {
        const target = document.querySelector(item.href);
        target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        history.replaceState(null, '', item.href);
      } else {
        window.location.href = item.href;
      }
    });
    els.siteSearchResults.appendChild(row);
  });
}

function runSiteSearch(query) {
  if (!els.siteSearchInput || !els.siteSearchResults) return;
  els.siteSearchResults.classList.add('search-busy');
  renderSiteSearchResults(query);
  els.siteSearchResults.classList.remove('search-busy');
}

async function fetchJson(url, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, cache: 'no-store' });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function asTableRows(payload) {
  if (!Array.isArray(payload) || !payload.length) return [];
  if (!Array.isArray(payload[0])) return payload;
  const headers = payload[0].map((item) => String(item).trim().toLowerCase());
  return payload.slice(1).map((row) => {
    const out = {};
    headers.forEach((header, index) => {
      out[header] = row[index];
    });
    return out;
  });
}

function getCaseInsensitive(row, key) {
  if (!row || typeof row !== 'object') return undefined;
  if (key in row) return row[key];
  const target = String(key).toLowerCase();
  for (const [candidate, value] of Object.entries(row)) {
    if (candidate.toLowerCase() === target) return value;
  }
  return undefined;
}

function pickNumber(row, keys) {
  if (!row || typeof row !== 'object') return null;
  for (const key of keys) {
    const value = getCaseInsensitive(row, key);
    const num = Number(value);
    if (Number.isFinite(num)) return num;
  }
  return null;
}

function pickString(row, keys) {
  if (!row || typeof row !== 'object') return null;
  for (const key of keys) {
    const value = getCaseInsensitive(row, key);
    if (value !== undefined && value !== null && value !== '') return String(value);
  }
  return null;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function latestByTime(rows, timeKeys = ['time_tag', 'time', 'timestamp', 'date']) {
  return [...rows].sort((a, b) => {
    const at = new Date(pickString(a, timeKeys) || 0).getTime();
    const bt = new Date(pickString(b, timeKeys) || 0).getTime();
    return bt - at;
  })[0];
}

async function fetchNoaaSpaceWeather() {
  const kpSources = [
    'https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json',
    'https://services.swpc.noaa.gov/json/planetary_k_index_1m.json',
  ];
  const windSources = [
    'https://services.swpc.noaa.gov/products/solar-wind/plasma-1-day.json',
    'https://services.swpc.noaa.gov/products/solar-wind/mag-1-day.json',
  ];

  let kpData = null;
  let solarData = null;

  for (const url of kpSources) {
    try {
      const payload = await fetchJson(url);
      const rows = asTableRows(payload);
      if (!rows.length) continue;
      const latest = latestByTime(rows);
      const kp = pickNumber(latest, ['kp', 'kp_index', 'planetary_k_index']) ?? 3;
      const updatedText = pickString(latest, ['time_tag', 'time', 'timestamp', 'date']);
      kpData = {
        kp: clamp(Math.round(kp), 0, 9),
        updated: updatedText ? new Date(updatedText) : new Date(),
      };
      break;
    } catch {
      // try next source
    }
  }

  for (const url of windSources) {
    try {
      const payload = await fetchJson(url);
      const rows = asTableRows(payload);
      if (!rows.length) continue;
      const latest = latestByTime(rows);
      solarData = {
        solarWind: pickNumber(latest, ['speed', 'solar_wind_speed', 'flow_speed']) ?? null,
        bz: pickNumber(latest, ['bz_gsm', 'bz', 'bz_gse']) ?? null,
        density: pickNumber(latest, ['density', 'np', 'proton_density']) ?? null,
        updated: new Date(pickString(latest, ['time_tag', 'time', 'timestamp', 'date']) || Date.now()),
      };
      break;
    } catch {
      // try next source
    }
  }

  if (!kpData && !solarData) return null;

  return {
    kp: kpData?.kp ?? null,
    solarWind: solarData?.solarWind ?? null,
    bz: solarData?.bz ?? null,
    density: solarData?.density ?? null,
    updated: kpData?.updated ?? solarData?.updated ?? new Date(),
    source: ['NOAA Kp', solarData ? 'NOAA solar wind' : null].filter(Boolean).join(' + '),
  };
}

async function fetchOpenMeteoWeather(location) {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', location.lat);
  url.searchParams.set('longitude', location.lon);
  url.searchParams.set('current', 'cloud_cover,wind_speed_10m,temperature_2m');
  url.searchParams.set('hourly', 'cloud_cover');
  url.searchParams.set('forecast_days', '1');
  url.searchParams.set('timezone', 'auto');

  const payload = await fetchJson(url.toString());
  const cloud = Number(payload?.current?.cloud_cover);
  const wind = Number(payload?.current?.wind_speed_10m);
  const temp = Number(payload?.current?.temperature_2m);
  const fallbackCloud = Number(payload?.hourly?.cloud_cover?.[0]);

  return {
    cloud: Number.isFinite(cloud) ? cloud : (Number.isFinite(fallbackCloud) ? fallbackCloud : null),
    windSpeed: Number.isFinite(wind) ? wind : null,
    temperature: Number.isFinite(temp) ? temp : null,
    updated: new Date(),
    source: 'Open-Meteo',
  };
}

async function searchLocations(query) {
  const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
  url.searchParams.set('name', query);
  url.searchParams.set('count', '6');
  url.searchParams.set('language', 'en');
  url.searchParams.set('format', 'json');
  const payload = await fetchJson(url.toString());
  return Array.isArray(payload?.results) ? payload.results : [];
}

function searchPresetLocations(query) {
  const q = normalizeSearchText(query);
  if (q.length < 2) return [];
  return PRESETS
    .map((preset) => ({
      name: preset.name,
      latitude: preset.lat,
      longitude: preset.lon,
      admin1: 'Preset city',
      country: '',
      timezone: 'local',
      score: searchScore(q, preset.name, [`${preset.lat}`, `${preset.lon}`]),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);
}

async function reverseGeocode(lat, lon) {
  const url = new URL('https://geocoding-api.open-meteo.com/v1/reverse');
  url.searchParams.set('latitude', lat);
  url.searchParams.set('longitude', lon);
  url.searchParams.set('language', 'en');
  url.searchParams.set('format', 'json');
  const payload = await fetchJson(url.toString());
  return payload?.results?.[0] || null;
}

function buildFallbackWeather(now = new Date()) {
  const t = now.getTime() / 1000;
  const cycle = Math.sin(t / 13700) * 1.4 + Math.cos(t / 24000) * 0.8;
  const kp = clamp(Math.round(2.8 + cycle + ((now.getUTCDay() % 4) - 1) * 0.2), 0, 9);
  const solarWind = Math.round(360 + 120 * Math.sin(t / 21000) + 55 * Math.cos(t / 7800));
  const bz = round(Math.sin(t / 17000) * 6 - 3.5, 1);
  const density = Math.round(4 + Math.sin(t / 9000) * 2 + Math.cos(t / 12000) * 1.3);
  const cloud = clamp(Math.round(42 + Math.sin(t / 18000 + 1.2) * 18 + Math.cos(t / 9000) * 10), 0, 100);
  return { kp, solarWind, bz, density, cloud, updated: now, source: 'Local fallback' };
}

async function postFormspree(endpoint, formData) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { Accept: 'application/json' },
    body: formData,
  });
  return response.ok;
}

async function loadLiveData(location = state.location) {
  const fallback = buildFallbackWeather();
  const [spaceResult, weatherResult] = await Promise.allSettled([
    fetchNoaaSpaceWeather(),
    fetchOpenMeteoWeather(location),
  ]);

  const space = spaceResult.status === 'fulfilled' && spaceResult.value ? spaceResult.value : null;
  const weather = weatherResult.status === 'fulfilled' ? weatherResult.value : null;

  state.weather = {
    kp: space?.kp ?? fallback.kp,
    solarWind: space?.solarWind ?? fallback.solarWind,
    bz: space?.bz ?? fallback.bz,
    density: space?.density ?? fallback.density,
    cloud: weather?.cloud ?? location.cloud ?? fallback.cloud,
    windSpeed: weather?.windSpeed ?? null,
    temperature: weather?.temperature ?? null,
    updated: space?.updated ?? weather?.updated ?? fallback.updated,
    source: [space?.source, weather?.source].filter(Boolean).join(' + ') || fallback.source,
  };

  if (Number.isFinite(state.weather.cloud)) {
    state.location.cloud = Math.round(state.weather.cloud);
    els.cloudInput.value = state.location.cloud;
    els.cloudPreview.textContent = `${state.location.cloud}%`;
  }

  return state.weather;
}

function sunTime(date, latitude, longitude, sunrise = true) {
  const zenith = 90.833;
  const N = dayOfYear(date);
  const lngHour = longitude / 15;
  const t = sunrise ? N + (6 - lngHour) / 24 : N + (18 - lngHour) / 24;
  const M = 0.9856 * t - 3.289;
  let L = M + 1.916 * Math.sin(degToRad(M)) + 0.02 * Math.sin(degToRad(2 * M)) + 282.634;
  L = normalize(L, 360);
  let RA = radToDeg(Math.atan(0.91764 * Math.tan(degToRad(L))));
  RA = normalize(RA, 360);
  const Lquadrant = Math.floor(L / 90) * 90;
  const RAquadrant = Math.floor(RA / 90) * 90;
  RA = (RA + (Lquadrant - RAquadrant)) / 15;
  const sinDec = 0.39782 * Math.sin(degToRad(L));
  const cosDec = Math.cos(Math.asin(sinDec));
  const cosH = (Math.cos(degToRad(zenith)) - sinDec * Math.sin(degToRad(latitude))) / (cosDec * Math.cos(degToRad(latitude)));
  if (cosH > 1 || cosH < -1) return null;
  let H = sunrise ? 360 - radToDeg(Math.acos(cosH)) : radToDeg(Math.acos(cosH));
  H /= 15;
  const T = H + RA - 0.06571 * t - 6.622;
  const UT = normalize(T - lngHour, 24);
  const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0));
  utcDate.setUTCHours(Math.floor(UT), Math.floor((UT % 1) * 60), Math.floor((((UT % 1) * 60) % 1) * 60), 0);
  return utcDate;
}

function scoreChance(location, weather, time = new Date()) {
  const latFactor = clamp((Math.abs(location.lat) - 40) / 25, 0, 1);
  const kpFactor = weather.kp / 9;
  const bzFactor = clamp((-weather.bz + 2) / 10, 0, 1);
  const cloudFactor = 1 - location.cloud / 100;
  const sun = sunTime(time, location.lat, location.lon, true);
  const set = sunTime(time, location.lat, location.lon, false);
  const darkness = isDark(time, sun, set) ? 1 : 0.25;
  const score = 100 * (kpFactor * 0.33 + latFactor * 0.24 + bzFactor * 0.16 + cloudFactor * 0.18 + darkness * 0.09);
  return clamp(Math.round(score), 0, 100);
}

function buildForecastSummary(location, weather) {
  const chance = scoreChance(location, weather);
  const dark = isDark(new Date(), sunTime(new Date(), location.lat, location.lon, true), sunTime(new Date(), location.lat, location.lon, false));
  const cloud = Number.isFinite(location.cloud) ? location.cloud : 50;

  if (chance >= 75) return ['Great odds', dark ? 'Dark, active, and worth stepping outside now.' : 'Strong activity, but wait for darkness.' ];
  if (chance >= 55) return ['Good watch night', cloud > 55 ? 'Aurora activity is decent; clouds are the main limiter.' : 'A solid night if you have a dark horizon.'];
  if (chance >= 35) return ['Borderline', dark ? 'Possible, but you’ll need patience and a clear patch of sky.' : 'Not ideal yet — check again after sunset.'];
  return ['Low odds', 'Probably not a strong aurora night unless conditions improve.'];
}

function buildConditionHints(location, weather) {
  const hints = [];
  if (weather.kp >= 5) hints.push('Geomagnetic activity is strong enough to push the aurora farther south.');
  else if (weather.kp >= 3) hints.push('Kp is watchable, but the best chance stays in the north.');
  else hints.push('Space weather is quiet right now.');

  if (Number.isFinite(weather.bz) && weather.bz < 0) hints.push('Bz is negative, which helps aurora energy coupling.');
  else if (Number.isFinite(weather.bz)) hints.push('Bz is not helping much yet.');

  if (location.cloud > 60) hints.push('Clouds are likely the biggest problem tonight.');
  else if (location.cloud > 35) hints.push('Cloud cover is moderate, so clear breaks still matter.');
  else hints.push('Skies look fairly clear from this estimate.');

  return hints.slice(0, 3);
}

function isDark(now, sunrise, sunset) {
  if (!sunrise || !sunset) return now.getHours() < 6 || now.getHours() > 20;
  return now < sunrise || now > sunset;
}

function generateForecast(weather, location) {
  const now = new Date();
  const points = [];
  for (let i = 0; i < 12; i += 1) {
    const time = new Date(now.getTime() + i * 3600000);
    const kp = clamp(Math.round(weather.kp + Math.sin(i / 2) + (i > 3 && i < 8 ? 1 : 0) - 1), 0, 9);
    const simulated = { ...weather, kp, cloud: clamp(location.cloud + Math.round(Math.sin(i / 3) * 8), 0, 100) };
    const chance = scoreChance(location, simulated, time);
    points.push({ time, kp, chance });
  }
  return points;
}

function generateCalendarScore(location, weather, date) {
  const dayIndex = Math.floor((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - Date.UTC(date.getFullYear(), 0, 1)) / 86400000);
  const moon = moonInfo(date);
  const moonPenalty = moon.type === 'full' ? 8 : moon.type === 'new' ? -4 : 0;
  const simulated = {
    ...weather,
    kp: clamp(Math.round((weather.kp ?? 3) + Math.sin(dayIndex / 2.8) + Math.cos(dayIndex / 5.2)), 0, 9),
    bz: Number.isFinite(weather.bz) ? weather.bz + Math.sin(dayIndex / 3.2) * 2 : weather.bz,
  };
  const cloudSwing = Math.round(Math.sin(dayIndex / 3.4) * 18 + Math.cos(dayIndex / 6.1) * 8);
  const simulatedLocation = { ...location, cloud: clamp(location.cloud + cloudSwing, 0, 100) };
  const night = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 22, 0, 0, 0);
  return clamp(scoreChance(simulatedLocation, simulated, night) + moonPenalty, 0, 100);
}

function calendarDetailForDate(date) {
  const score = generateCalendarScore(state.location, state.weather, date);
  const moon = moonInfo(date);
  const sunrise = sunTime(date, state.location.lat, state.location.lon, true);
  const sunset = sunTime(date, state.location.lat, state.location.lon, false);
  return {
    date,
    score,
    moon,
    sunrise,
    sunset,
    summary:
      score >= 76 ? 'Very strong night for chasing the lights.' :
      score >= 51 ? 'A good watch night if skies stay clear.' :
      score >= 26 ? 'Possible, but not a strong bet.' :
      'Low odds unless conditions improve.',
  };
}

function renderCalendarDetails(date) {
  const details = calendarDetailForDate(date);
  els.calendarSelectedLabel.textContent = formatCalendarDate(details.date);
  els.calendarSelectedSummary.textContent = details.summary;
  els.calendarSelectedScore.textContent = `${details.score}%`;
  els.calendarSelectedMoon.textContent = details.moon.label;
  els.calendarSelectedSunset.textContent = details.sunset ? toLocalTime(details.sunset) : '—';
  els.calendarSelectedSunrise.textContent = details.sunrise ? toLocalTime(details.sunrise) : '—';
}

function renderBestCalendarNights(base) {
  const daysInMonth = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
  const candidates = Array.from({ length: daysInMonth }, (_, index) => {
    const date = new Date(base.getFullYear(), base.getMonth(), index + 1);
    const details = calendarDetailForDate(date);
    return details;
  }).sort((a, b) => b.score - a.score).slice(0, 3);

  els.calendarBestNights.innerHTML = '';
  candidates.forEach((item, index) => {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'calendar-best-item';
    row.innerHTML = `
      <strong>#${index + 1} · ${formatCalendarDate(item.date)}</strong>
      <span>${item.score}% · ${item.moon.label} · ${item.sunset ? toLocalTime(item.sunset) : 'no sunset'}→${item.sunrise ? toLocalTime(item.sunrise) : 'no sunrise'}</span>
    `;
    row.addEventListener('click', () => {
      state.calendarSelectedDate = item.date;
      renderCalendar();
    });
    els.calendarBestNights.appendChild(row);
  });
}

function renderCalendar() {
  const base = startOfMonth(new Date(), state.calendarOffset);
  const firstDay = new Date(base.getFullYear(), base.getMonth(), 1);
  const startPadding = firstDay.getDay();
  const daysInMonth = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
  const totalCells = 42;
  const selected = state.calendarSelectedDate;

  if (!selected || selected.getFullYear() !== base.getFullYear() || selected.getMonth() !== base.getMonth()) {
    state.calendarSelectedDate = new Date(base.getFullYear(), base.getMonth(), 1);
  }

  els.calendarMonthLabel.textContent = formatMonthYear(base);
  els.forecastCalendar.innerHTML = '';

  for (let i = 0; i < totalCells; i += 1) {
    const dayNum = i - startPadding + 1;
    const cellDate = new Date(base.getFullYear(), base.getMonth(), dayNum);
    const inMonth = dayNum >= 1 && dayNum <= daysInMonth;
    const score = inMonth ? generateCalendarScore(state.location, state.weather, cellDate) : null;
    const moon = moonInfo(cellDate);
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = `calendar-day ${inMonth ? scoreClass(score) : 'outside'}`;
    tile.disabled = !inMonth;
    const selectedDay = inMonth
      && state.calendarSelectedDate
      && state.calendarSelectedDate.getFullYear() === cellDate.getFullYear()
      && state.calendarSelectedDate.getMonth() === cellDate.getMonth()
      && state.calendarSelectedDate.getDate() === cellDate.getDate();
    if (selectedDay) tile.classList.add('selected');
    tile.innerHTML = `
      <span class="calendar-day-top">
        <strong>${inMonth ? dayNum : ''}</strong>
        ${inMonth ? `<span class="calendar-score">${score}%</span>` : ''}
      </span>
      <span class="calendar-day-label">${inMonth ? (moon.type === 'new' ? 'New moon' : moon.type === 'full' ? 'Full moon' : moon.label) : ''}</span>
      <span class="calendar-moon ${moon.type === 'new' ? 'new' : moon.type === 'full' ? 'full' : ''}">${inMonth && (moon.type === 'new' || moon.type === 'full') ? moon.label : ''}</span>
    `;
    if (inMonth && dayNum === new Date().getDate() && base.getMonth() === new Date().getMonth() && base.getFullYear() === new Date().getFullYear()) {
      tile.classList.add('today');
    }
    tile.setAttribute('aria-label', inMonth ? `${cellDate.toDateString()} — ${score}% chance — ${moon.label}` : '');
    tile.addEventListener('click', () => {
      state.calendarSelectedDate = cellDate;
      renderCalendar();
    });
    els.forecastCalendar.appendChild(tile);
  }

  renderCalendarDetails(state.calendarSelectedDate);
  renderBestCalendarNights(base);
}

function renderPresets() {
  els.presetRow.innerHTML = '';
  PRESETS.forEach((preset) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'preset-chip';
    btn.textContent = preset.name;
    btn.addEventListener('click', () => setLocation(preset));
    els.presetRow.appendChild(btn);
  });
}

function markActivePreset(name) {
  document.querySelectorAll('.preset-chip').forEach((btn) => {
    btn.classList.toggle('active', btn.textContent === name);
    btn.setAttribute('aria-pressed', String(btn.classList.contains('active')));
  });
}

function setLocation(next, shouldRefresh = true) {
  state.location = { ...next };
  els.latInput.value = next.lat.toFixed(4);
  els.lonInput.value = next.lon.toFixed(4);
  els.cloudInput.value = next.cloud;
  els.cloudPreview.textContent = `${next.cloud}%`;
  els.activeLocation.textContent = next.name;
  markActivePreset(next.name);
  if (shouldRefresh) refreshLive();
}

function updateWeather() {
  if (!state.weather) state.weather = buildFallbackWeather();
  els.updatedAt.textContent = toDateStamp(state.weather.updated);
  els.dataSource.textContent = state.weather.source || '—';
  els.kpValue.textContent = state.weather.kp;
  els.kpLabel.textContent = kpLabel(state.weather.kp);
  els.windValue.textContent = state.weather.solarWind ?? '—';
  els.bzValue.textContent = Number.isFinite(state.weather.bz) ? state.weather.bz.toFixed(1) : '—';
  els.cloudValue.textContent = `${Math.round(state.weather.cloud ?? 0)}%`;
}

function kpLabel(kp) {
  if (kp <= 1) return 'Quiet';
  if (kp === 2) return 'Calm';
  if (kp === 3) return 'Watch';
  if (kp === 4) return 'Visible north';
  if (kp === 5) return 'Strong';
  if (kp === 6) return 'Very strong';
  if (kp === 7) return 'Major storm';
  if (kp === 8) return 'Severe';
  return 'Extreme';
}

function renderChance(location = state.location) {
  const chance = scoreChance(location, state.weather);
  els.chanceValue.textContent = `${chance}%`;
  els.chanceFill.style.width = `${chance}%`;
  els.chanceFill.style.filter = `hue-rotate(${Math.max(0, 120 - chance)}deg)`;
  const [label, text] = buildForecastSummary(location, state.weather);
  els.summaryLabel.textContent = label;
  els.summaryText.textContent = text;
  return chance;
}

function renderWindow(location = state.location) {
  const now = new Date();
  const sunset = sunTime(now, location.lat, location.lon, false);
  const sunrise = sunTime(now, location.lat, location.lon, true);
  const sunsetLabel = sunset ? toLocalTime(sunset) : 'No sunset today';
  const sunriseLabel = sunrise ? toLocalTime(sunrise) : 'No sunrise today';
  els.sunsetValue.textContent = sunsetLabel;
  els.sunriseValue.textContent = sunriseLabel;

  let windowStart = sunset ? new Date(sunset.getTime() + 90 * 60000) : new Date(now.getTime() + 4 * 3600000);
  let windowEnd = sunrise ? new Date(sunrise.getTime() - 90 * 60000) : new Date(now.getTime() + 8 * 3600000);
  if (windowEnd <= windowStart) {
    windowStart = new Date(now.getTime() + 22 * 3600000);
    windowEnd = new Date(now.getTime() + 26 * 3600000);
  }

  const best = `${toLocalTime(windowStart)} — ${toLocalTime(windowEnd)}`;
  els.windowTitle.textContent = 'Best window';
  const hints = buildConditionHints(location, state.weather);
  els.windowText.textContent = `Plan for the darkest stretch: ${best}. ${hints[0] || ''}`;
  els.darkHourValue.textContent = `${toLocalTime(new Date((windowStart.getTime() + windowEnd.getTime()) / 2))}`;
}

function renderTimeline(location = state.location) {
  const forecast = generateForecast(state.weather, location);
  els.timeline.innerHTML = '';
  forecast.forEach((point) => {
    const hour = document.createElement('div');
    hour.className = 'hour';
    const wrap = document.createElement('div');
    wrap.className = 'bar-wrap';
    const bar = document.createElement('div');
    bar.className = 'bar';
    bar.style.height = `${Math.max(18, point.chance * 1.6)}px`;
    bar.style.opacity = `${0.35 + point.chance / 140}`;
    bar.title = `${toLocalTime(point.time)} — ${point.chance}% chance`;
    wrap.appendChild(bar);
    const label = document.createElement('small');
    label.textContent = `${pad(point.time.getHours())}:00`;
    const value = document.createElement('strong');
    value.textContent = `${point.chance}%`;
    hour.append(wrap, value, label);
    els.timeline.appendChild(hour);
  });
}

function renderRankings() {
  const list = [...PRESETS]
    .map((place) => ({
      ...place,
      score: scoreChance(place, state.weather),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  els.cityRankings.innerHTML = '';
  list.forEach((place, index) => {
    const card = document.createElement('article');
    card.className = 'city-score';
    card.innerHTML = `
      <span>#${index + 1}</span>
      <strong>${place.name}</strong>
      <span>${place.score}% likely · lat ${place.lat.toFixed(1)}°</span>
    `;
    els.cityRankings.appendChild(card);
  });
}

function renderMap() {
  const kp = state.weather.kp;
  els.mapBadge.textContent = `Kp ${kp}`;
  const focus = state.mapFocus || 'global';
  const focusConfig = {
    global: { top: clamp(58 - kp * 3, 8, 44), side: 18, heightMul: 2.65, widthScale: 1, shift: 0 },
    nordics: { top: clamp(54 - kp * 3.3, 6, 40), side: 26, heightMul: 2.45, widthScale: 0.92, shift: 8 },
    'north-america': { top: clamp(62 - kp * 2.8, 10, 48), side: 22, heightMul: 2.85, widthScale: 1.05, shift: -8 },
    iceland: { top: clamp(50 - kp * 3.2, 8, 38), side: 20, heightMul: 2.35, widthScale: 0.84, shift: 16 },
  }[focus] || { top: 18, side: 18, heightMul: 2.65, widthScale: 1, shift: 0 };
  const width = clamp((18 + kp * 8) * focusConfig.widthScale, 24, 96);
  const top = focusConfig.top;
  els.auroraBand.style.inset = `${top}px ${focusConfig.side}px auto ${focusConfig.side}px`;
  els.auroraBand.style.height = `${Math.max(170, width * focusConfig.heightMul)}px`;
  els.auroraBand.style.opacity = `${0.44 + kp * 0.06}`;
  els.auroraBand.style.transform = `translateY(${18 - focusConfig.shift}px) scale(${1 + kp * 0.0025})`;
  els.mapCanvas.dataset.focus = focus;
  els.mapBzChip.textContent = Number.isFinite(state.weather.bz) ? `Bz ${state.weather.bz.toFixed(1)}` : 'Bz —';
  els.mapWindChip.textContent = `Wind ${state.weather.solarWind ?? '—'} km/s`;
  const darkNow = isDark(new Date(), sunTime(new Date(), state.location.lat, state.location.lon, true), sunTime(new Date(), state.location.lat, state.location.lon, false));
  els.mapDarkChip.textContent = darkNow ? 'Night: yes' : 'Night: no';
  mapFocusButtons.forEach((button) => {
    const active = button.dataset.mapFocus === focus;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}

function renderBestCities() {
  const cities = [...PRESETS]
    .map((place) => ({ ...place, score: scoreChance(place, state.weather) }))
    .sort((a, b) => b.score - a.score);

  els.bestCities.innerHTML = '';
  cities.forEach((city) => {
    const item = document.createElement('div');
    item.className = 'city-list-item';
    item.innerHTML = `
      <div>
        <strong>${city.name}</strong>
        <span>Lat ${city.lat.toFixed(1)}°, clouds ${city.cloud}%</span>
      </div>
      <strong>${city.score}%</strong>
    `;
    item.addEventListener('click', () => setLocation(city));
    els.bestCities.appendChild(item);
  });
}

function renderResult(location = state.location) {
  const chance = renderChance(location);
  const sun = sunTime(new Date(), location.lat, location.lon, true);
  const dark = isDark(new Date(), sun, sunTime(new Date(), location.lat, location.lon, false));
  const notes = [
    `${location.name} is at ${Math.abs(location.lat).toFixed(1)}° latitude.`,
    dark ? 'It is dark enough right now for a real attempt.' : 'Wait for darkness after sunset for the best odds.',
    chance >= state.threshold ? `This clears your ${state.threshold}% alert threshold.` : `Not quite your ${state.threshold}% alert threshold yet.`,
    location.cloud > 60 ? 'Clouds are the main blocker tonight.' : 'Cloud cover is manageable tonight.',
  ];

  els.visibilityScore.textContent = `${chance}%`;
  els.resultSummary.textContent = `${location.name}: ${chance}% aurora visibility right now.`;
  els.resultNotes.innerHTML = '';
  [...notes, ...buildConditionHints(location, state.weather).slice(0, 2)].forEach((note) => {
    const li = document.createElement('li');
    li.textContent = note;
    els.resultNotes.appendChild(li);
  });
}

function refresh() {
  state.location.cloud = Number(els.cloudInput.value);
  renderWindow(state.location);
  renderTimeline(state.location);
  renderCalendar();
  renderRankings();
  renderMap();
  renderBestCities();
  renderResult(state.location);
  saveState();
}

async function refreshLive() {
  try {
    if (!liveBootstrapped) document.body.classList.add('loading-live');
    await loadLiveData(state.location);
  } catch {
    state.weather = buildFallbackWeather();
  }
  updateWeather();
  refresh();
  notifyIfNeeded();
  if (!liveBootstrapped) {
    liveBootstrapped = true;
    document.body.classList.remove('loading-live');
  }
}

function setThemePreference(preference) {
  state.themePreference = preference;
  applyTheme(preference);
  saveState();
}

function loadState() {
  if (!hasPreferenceConsent()) return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (typeof saved.threshold === 'number') state.threshold = saved.threshold;
    if (typeof saved.notify === 'boolean') state.notify = saved.notify;
    if (typeof saved.saveLocation === 'boolean') state.saveLocation = saved.saveLocation;
    if (Array.isArray(saved.watchlist)) state.watchlist = saved.watchlist;
    if (Array.isArray(saved.tourSubmissions)) state.tourSubmissions = saved.tourSubmissions;
    if (typeof saved.lastNotifiedKey === 'string') state.lastNotifiedKey = saved.lastNotifiedKey;
    if (saved.location) state.location = { ...state.location, ...saved.location };
    if (typeof saved.mapFocus === 'string') state.mapFocus = saved.mapFocus;
    if (typeof saved.themePreference === 'string') state.themePreference = saved.themePreference;
  } catch {
    // ignore corrupt storage
  }
}

function saveState() {
  if (!hasPreferenceConsent()) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    threshold: state.threshold,
    notify: state.notify,
    saveLocation: state.saveLocation,
    location: state.location,
    watchlist: state.watchlist,
    tourSubmissions: state.tourSubmissions,
    mapFocus: state.mapFocus,
    lastNotifiedKey: state.lastNotifiedKey,
    themePreference: state.themePreference,
  }));
}

function renderWatchlist() {
  if (!els.watchlist) return;
  els.watchlist.innerHTML = '';
  if (!state.watchlist.length) {
    const empty = document.createElement('p');
    empty.className = 'muted';
    empty.textContent = 'No saved watches yet. Add one with the form above.';
    els.watchlist.appendChild(empty);
    return;
  }
  state.watchlist.slice(0, 5).forEach((item) => {
    const row = document.createElement('div');
    row.className = 'watch-item';
    row.innerHTML = `
      <strong>${item.location}</strong>
      <span>Threshold ${item.threshold}%</span>
    `;
    els.watchlist.appendChild(row);
  });
}

function renderTourSubmissions() {
  if (!els.tourSubmissions) return;
  els.tourSubmissions.innerHTML = '';
  if (!state.tourSubmissions.length) {
    const empty = document.createElement('p');
    empty.className = 'muted';
    empty.textContent = 'No operator submissions yet. Add one with the form above.';
    els.tourSubmissions.appendChild(empty);
    return;
  }

  state.tourSubmissions.slice(0, 6).forEach((item) => {
    const row = document.createElement('div');
    row.className = 'tour-submission-item';
    const details = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = item.name;
    const meta = document.createElement('span');
    meta.textContent = `${item.region} · ${item.type}`;
    const desc = document.createElement('p');
    desc.textContent = item.description || 'No description provided.';
    details.append(title, meta, desc);

    const link = document.createElement('a');
    link.className = 'button secondary';
    link.textContent = 'Website';
    link.target = '_blank';
    link.rel = 'noreferrer';
    try {
      const parsed = new URL(item.website);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') link.href = parsed.href;
      else link.href = '#';
    } catch {
      link.href = '#';
    }

    row.append(details, link);
    els.tourSubmissions.appendChild(row);
  });
}

function renderSearchResults(results) {
  els.searchResults.innerHTML = '';
  if (!results.length) {
    const empty = document.createElement('p');
    empty.className = 'muted small';
    empty.textContent = 'No matches yet. Try a different spelling.';
    els.searchResults.appendChild(empty);
    return;
  }

  results.forEach((item) => {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'search-result';
    const label = [item.name, item.admin1, item.country].filter(Boolean).join(', ');
    row.innerHTML = `
      <div>
        <strong>${escapeHtml(label)}</strong>
        <small>${escapeHtml(item.latitude.toFixed(4))}, ${escapeHtml(item.longitude.toFixed(4))}</small>
      </div>
      <span class="muted">${escapeHtml(item.timezone || 'tz')}</span>
    `;
    row.addEventListener('click', () => {
      setLocation({
        name: label,
        lat: item.latitude,
        lon: item.longitude,
        cloud: Number(els.cloudInput.value) || state.location.cloud || 45,
      });
      els.searchInput.value = label;
      els.searchResults.innerHTML = '';
      els.searchInput.setAttribute('aria-expanded', 'false');
    });
    els.searchResults.appendChild(row);
  });

  els.searchInput.setAttribute('aria-expanded', 'true');
}

function clearSearchResults() {
  els.searchResults.innerHTML = '';
  els.searchInput.setAttribute('aria-expanded', 'false');
}

async function runLiveSearch(query) {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    clearSearchResults();
    return;
  }

  els.searchResults.classList.add('search-busy');
  els.searchResults.setAttribute('aria-busy', 'true');
  els.searchResults.innerHTML = '<p class="muted small">Searching…</p>';
  try {
    const [remote, preset] = await Promise.all([
      searchLocations(trimmed).catch(() => []),
      Promise.resolve(searchPresetLocations(trimmed)),
    ]);
    const merged = [...preset, ...remote]
      .filter((item, index, self) => index === self.findIndex((entry) => `${entry.latitude}|${entry.longitude}|${entry.name}` === `${item.latitude}|${item.longitude}|${item.name}`))
      .slice(0, 6);
    renderSearchResults(merged);
  } catch {
    els.searchResults.innerHTML = '<p class="muted small">Search failed. Try again later.</p>';
    els.searchInput.setAttribute('aria-expanded', 'true');
  } finally {
    els.searchResults.classList.remove('search-busy');
    els.searchResults.removeAttribute('aria-busy');
  }
}

async function requestNotificationPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

function notifyIfNeeded() {
  const chance = scoreChance(state.location, state.weather);
  if (chance < state.threshold || !state.notify || !('Notification' in window) || Notification.permission !== 'granted') return;
  const key = `${state.location.name}|${state.location.lat.toFixed(2)}|${state.location.lon.toFixed(2)}|${state.threshold}|${new Date().toDateString()}`;
  if (state.lastNotifiedKey === key) return;
  new Notification('Aurora watch triggered', {
    body: `${state.location.name} is at ${chance}% — above your ${state.threshold}% threshold.`,
  });
  state.lastNotifiedKey = key;
  saveState();
}

function syncAlertUI() {
  els.thresholdInput.value = state.threshold;
  els.thresholdValue.textContent = `${state.threshold}%`;
  els.notifyToggle.checked = state.notify;
  els.saveToggle.checked = state.saveLocation;
}

themeButtons.forEach((button) => {
  button.addEventListener('click', () => setThemePreference(button.dataset.themeOption || 'system'));
});

if (systemThemeMedia?.addEventListener) {
  systemThemeMedia.addEventListener('change', () => {
    if (state.themePreference === 'system') applyTheme('system');
  });
}

if (viewportMedia?.addEventListener) {
  viewportMedia.addEventListener('change', syncDefaultThemeButtonIcon);
}

mapFocusButtons.forEach((button) => {
  button.addEventListener('click', () => {
    state.mapFocus = button.dataset.mapFocus || 'global';
    renderMap();
  });
});

webcamItems.forEach((item) => {
  item.addEventListener('click', (event) => {
    event.preventDefault();
    setFeaturedWebcam({
      id: item.dataset.webcamId,
      title: item.dataset.webcamTitle || item.querySelector('strong')?.textContent || 'Live cam',
      meta: item.dataset.webcamMeta || item.querySelector('span')?.textContent || '',
      watch: item.dataset.webcamWatch || item.href,
    });
  });
});

if (navSections.length && 'IntersectionObserver' in window) {
  const navObserver = new IntersectionObserver((entries) => {
    const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (visible?.target?.id) syncNavActive(visible.target.id);
  }, { rootMargin: '-30% 0px -55% 0px', threshold: [0.12, 0.2, 0.35] });
  navSections.forEach((section) => navObserver.observe(section));
}

navLinks.forEach((link) => {
  link.addEventListener('click', () => {
    const href = link.getAttribute('href') || '';
    if (href.startsWith('#')) syncNavActive(href.slice(1));
  });
});

window.addEventListener('scroll', scheduleTopBarStateSync, { passive: true });
window.addEventListener('resize', scheduleTopBarStateSync);

syncTopBarState();

els.cloudInput.addEventListener('input', () => {
  els.cloudPreview.textContent = `${els.cloudInput.value}%`;
  state.location.cloud = Number(els.cloudInput.value);
  renderResult(state.location);
  renderTimeline(state.location);
  renderBestCities();
  renderRankings();
  renderMap();
  saveState();
});

els.locationForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const chosen = {
    name: state.location?.name || 'Selected city',
    lat: Number(els.latInput.value),
    lon: Number(els.lonInput.value),
    cloud: Number(els.cloudInput.value),
  };
  setLocation(chosen);
});

els.searchButton.addEventListener('click', async () => {
  await runLiveSearch(els.searchInput.value);
});

els.searchInput.addEventListener('input', () => {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => runLiveSearch(els.searchInput.value), 250);
});

els.searchInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    els.searchButton.click();
  }
});

if (els.siteSearchInput && els.siteSearchButton && els.siteSearchResults) {
  renderSiteSearchResults('');
  els.siteSearchInput.addEventListener('input', () => {
    clearTimeout(siteSearchDebounceTimer);
    siteSearchDebounceTimer = setTimeout(() => runSiteSearch(els.siteSearchInput.value), 150);
  });
  els.siteSearchButton.addEventListener('click', () => runSiteSearch(els.siteSearchInput.value));
  els.siteSearchInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      runSiteSearch(els.siteSearchInput.value);
    }
  });
}

els.calendarPrev.addEventListener('click', () => {
  state.calendarOffset -= 1;
  state.calendarSelectedDate = new Date();
  renderCalendar();
});

els.calendarNext.addEventListener('click', () => {
  state.calendarOffset += 1;
  state.calendarSelectedDate = new Date();
  renderCalendar();
});

document.addEventListener('click', (event) => {
  if (!els.searchResults.contains(event.target) && event.target !== els.searchInput) {
    clearSearchResults();
  }
});

els.useCurrent.addEventListener('click', async () => {
  if ('geolocation' in navigator) {
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        let name = 'My location';
        try {
          const place = await reverseGeocode(lat, lon);
          name = [place?.name, place?.admin1, place?.country].filter(Boolean).join(', ') || name;
        } catch {
          // keep fallback name
        }
        setLocation({
          name,
          lat,
          lon,
          cloud: Number(els.cloudInput.value) || state.location.cloud || 45,
        });
      },
      () => setLocation(PRESETS[0]),
      { enableHighAccuracy: false, timeout: 8000 },
    );
    return;
  }
  setLocation(PRESETS[0]);
});

els.thresholdInput.addEventListener('input', () => {
  state.threshold = Number(els.thresholdInput.value);
  els.thresholdValue.textContent = `${state.threshold}%`;
  renderResult(state.location);
  saveState();
});

els.alertForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  state.threshold = Number(els.thresholdInput.value);
  state.notify = els.notifyToggle.checked;
  state.saveLocation = els.saveToggle.checked;
  const alertStatus = document.querySelector('#alertStatus');
  const submitButton = els.alertForm.querySelector('button[type="submit"]');

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = 'Saving…';
  }
  if (alertStatus) {
    alertStatus.textContent = 'Saving your alert settings…';
  }

  if (state.notify) {
    const ok = await requestNotificationPermission();
    if (!ok) state.notify = false;
    els.notifyToggle.checked = state.notify;
  }

  if (state.saveLocation) {
    state.watchlist.unshift({
      location: state.location.name,
      threshold: state.threshold,
      lat: state.location.lat,
      lon: state.location.lon,
    });
    state.watchlist = state.watchlist.slice(0, 8);
    renderWatchlist();
  }

  const alertData = new FormData(els.alertForm);
  alertData.set('_subject', 'Aurora Hunt alert watch');
  alertData.set('location_name', state.location.name);
  alertData.set('latitude', String(state.location.lat));
  alertData.set('longitude', String(state.location.lon));
  alertData.set('cloud_cover', String(state.location.cloud));
  alertData.set('weather_kp', String(state.weather?.kp ?? ''));
  alertData.set('weather_bz', String(Number.isFinite(state.weather?.bz) ? state.weather.bz.toFixed(1) : ''));

  const sent = await postFormspree('https://formspree.io/f/xqendboy', alertData).catch(() => false);
  if (alertStatus) {
    alertStatus.textContent = sent
      ? 'Saved and sent successfully.'
      : 'Saved locally. Sending failed just now.';
  }

  if (submitButton) {
    submitButton.disabled = false;
    submitButton.textContent = 'Save alert';
  }

  saveState();
  refresh();
});

if (els.tourForm) {
  els.tourForm.addEventListener('submit', (event) => {
    event.preventDefault();
    let website = els.tourWebsiteInput.value.trim();
    try {
      const parsed = new URL(website);
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Invalid protocol');
      website = parsed.href;
    } catch {
      alert('Please enter a valid website URL starting with http:// or https://');
      return;
    }

    const submission = {
      name: els.tourNameInput.value.trim(),
      website,
      region: els.tourRegionInput.value.trim(),
      email: els.tourEmailInput.value.trim(),
      type: els.tourTypeInput.value,
      description: els.tourDescriptionInput.value.trim(),
      submittedAt: new Date().toISOString(),
    };

    state.tourSubmissions.unshift(submission);
    state.tourSubmissions = state.tourSubmissions.slice(0, 10);
    els.tourForm.reset();
    renderTourSubmissions();
    saveState();
    alert('Operator submission saved locally.');
  });
}

function setupExpandableLearnCards() {
  const cards = [...document.querySelectorAll('[data-expandable-card]')];
  if (!cards.length) return;

  const collapseCard = (card) => {
    card.classList.remove('expanded');
    const details = card.querySelector('.info-card-details');
    card.setAttribute('aria-expanded', 'false');
    if (details) details.hidden = true;
  };

  const expandCard = (card) => {
    cards.forEach((other) => { if (other !== card) collapseCard(other); });
    card.classList.add('expanded');
    const details = card.querySelector('.info-card-details');
    card.setAttribute('aria-expanded', 'true');
    if (details) details.hidden = false;
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  cards.forEach((card) => {
    card.addEventListener('click', () => {
      const open = card.classList.contains('expanded');
      if (open) collapseCard(card);
      else expandCard(card);
    });
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        const open = card.classList.contains('expanded');
        if (open) collapseCard(card);
        else expandCard(card);
      }
      if (event.key === 'Escape') collapseCard(card);
    });
  });
}

els.notifyToggle.addEventListener('change', async () => {
  state.notify = els.notifyToggle.checked;
  if (state.notify) state.notify = await requestNotificationPermission();
  els.notifyToggle.checked = state.notify;
  saveState();
});

els.saveToggle.addEventListener('change', () => {
  state.saveLocation = els.saveToggle.checked;
  saveState();
});

renderPresets();
loadState();
syncAlertUI();
renderTourSubmissions();
setupExpandableLearnCards();
setFeaturedWebcam(defaultFeaturedCam, false);

if (state.location && state.location.name) {
  setLocation(state.location, false);
} else {
  setLocation(PRESETS[0], false);
}

renderWatchlist();
state.weather = buildFallbackWeather();
applyTheme(state.themePreference);
updateWeather();
renderCalendar();
refresh();
refreshLive();

setInterval(refreshLive, 10 * 60 * 1000);
