/* Aurora Hunt — forecast engine and UI.
 * Everything runs in the browser. Live inputs:
 *   NOAA SWPC  — observed Kp, 3-day Kp forecast, 27-day outlook, propagated solar wind
 *   Open-Meteo — cloud cover (current, hourly, 16-day daily mean), timezone, geocoding
 * No innerHTML is used with dynamic data; all rendering goes through h(). */
'use strict';

const PRESETS = [
  { name: 'Tromsø', lat: 69.6492, lon: 18.9553 },
  { name: 'Abisko', lat: 68.3495, lon: 18.8312 },
  { name: 'Rovaniemi', lat: 66.5039, lon: 25.7294 },
  { name: 'Reykjavík', lat: 64.1466, lon: -21.9426 },
  { name: 'Fairbanks', lat: 64.8378, lon: -147.7164 },
  { name: 'Yellowknife', lat: 62.454, lon: -114.3718 },
  { name: 'Stockholm', lat: 59.3293, lon: 18.0686 },
  { name: 'Oslo', lat: 59.9139, lon: 10.7522 },
];
const DEFAULT_LOCATION = PRESETS[6];
const STORAGE_KEY = 'aurora-forecast-v1';
const NOAA = 'https://services.swpc.noaa.gov';
const HOUR = 3600000;
const DAY = 86400000;
const CAM_ID = /^[\w-]{11}$/;

const $ = (id) => document.getElementById(id);
// Elements missing from the current page resolve to a detached stub, so one script serves every page.
const els = new Proxy({}, { get: (cache, id) => (id in cache ? cache[id] : (cache[id] = $(id) || document.createElement('input'))) });

/** Tiny DOM builder: h('div', { class: 'x', text: 'safe' }, child, ...) */
function h(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'text') node.textContent = value;
    else if (key === 'class') node.className = value;
    else if (key === 'on') for (const [evt, fn] of Object.entries(value)) node.addEventListener(evt, fn);
    else node.setAttribute(key, value === true ? '' : String(value));
  }
  node.append(...children.filter((child) => child !== null && child !== undefined && child !== false));
  return node;
}
function setText(id, value) { const node = $(id); if (node) node.textContent = value; }
function clear(node) { if (node) node.replaceChildren(); return node; }

const root = document.documentElement;
const themeMeta = document.querySelector('meta[name="theme-color"]');
const themeButtons = [...document.querySelectorAll('[data-theme-option]')];
const navLinks = [...document.querySelectorAll('.nav-links a[href^="#"]')];
const mapFocusButtons = [...document.querySelectorAll('[data-map-focus]')];
const webcamItems = [...document.querySelectorAll('.cam-item[data-webcam-id]')];
const systemThemeMedia = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

const state = {
  location: { ...DEFAULT_LOCATION },
  space: null,          // { kp, kpTime, forecast[], wind, bz, density, outlook: Map, live }
  wx: null,             // { cloudNow, temp, hourly[], daily: Map, tz, utcOffset }
  cityClouds: new Map(),// preset name -> hourly [{ t, cloud }]
  cloudOverride: null,  // manual what-if value from the slider
  hourly: [],
  threshold: 60,
  notify: false,
  saveLocation: true,
  lastNotifiedKey: null,
  calendarOffset: 0,
  calendarSelected: null,
  mapFocus: 'arctic',
  themePreference: 'system',
};

/** City landing pages pin the location with data attributes on <body>. */
const PAGE_CITY = document.body.dataset.cityLat
  ? sanitizeLocation({ name: document.body.dataset.cityName, lat: document.body.dataset.cityLat, lon: document.body.dataset.cityLon })
  : null;
let savedRaw = null;

/* ---------- maths & astronomy ---------- */
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const rad = (deg) => (deg * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

/** Low-precision solar position (Astronomical Almanac), good to ~0.01°. */
function sunPosition(ms) {
  const d = ms / DAY - 10957.5; // days since J2000.0
  const g = rad(357.529 + 0.98560028 * d);
  const L = rad(280.459 + 0.98564736 * d + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g));
  const e = rad(23.439 - 0.00000036 * d);
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L));
  const dec = Math.asin(Math.sin(e) * Math.sin(L));
  const gmst = ((18.697374558 + 24.06570982441908 * d) % 24 + 24) % 24;
  return { ra, dec, gmst, lat: deg(dec), lon: ((deg(ra) - gmst * 15 + 540) % 360) - 180 };
}
function sunElevation(ms, lat, lon) {
  const sun = sunPosition(ms);
  const lha = rad(sun.gmst * 15 + lon) - sun.ra;
  const phi = rad(lat);
  return deg(Math.asin(Math.sin(phi) * Math.sin(sun.dec) + Math.cos(phi) * Math.cos(sun.dec) * Math.cos(lha)));
}
/** Approximate geomagnetic latitude: centred dipole (IGRF-14 pole ≈ 80.8°N, 72.8°W) plus a small
 *  empirical correction for the North Atlantic / European sector, where the centred dipole reads
 *  2–4° higher than the corrected geomagnetic latitude that NOAA's Kp viewing table is based on. */
function magneticLatitude(lat, lon) {
  const p = rad(80.8), l = rad(lat);
  const dipole = deg(Math.asin(Math.sin(l) * Math.sin(p) + Math.cos(l) * Math.cos(p) * Math.cos(rad(lon + 72.8))));
  if (lat <= 0) return dipole;
  const offset = (((lon + 15 + 540) % 360) - 180) / 35;
  return dipole - 3 * Math.exp(-offset * offset) * clamp(lat / 45, 0, 1);
}
function moonInfo(ms) {
  const synodic = 29.53058867;
  const age = (((ms - Date.UTC(2000, 0, 6, 18, 14)) / DAY) % synodic + synodic) % synodic;
  const illum = (1 - Math.cos((2 * Math.PI * age) / synodic)) / 2;
  const phases = [
    [1.0, 'New moon', '🌑'], [6.4, 'Waxing crescent', '🌒'], [8.4, 'First quarter', '🌓'], [13.8, 'Waxing gibbous', '🌔'],
    [15.8, 'Full moon', '🌕'], [21.1, 'Waning gibbous', '🌖'], [23.1, 'Last quarter', '🌗'], [28.5, 'Waning crescent', '🌘'], [30, 'New moon', '🌑'],
  ];
  const [, label, glyph] = phases.find(([limit]) => age < limit);
  return { age, illum, label, glyph };
}

/** Scan one night (local noon → next noon) in 5-minute steps. Handles polar night and midnight sun. */
function nightInfo(noonMs, lat, lon) {
  const HORIZON = -0.833, DARK = -12;
  let prev = sunElevation(noonMs, lat, lon);
  const upAtNoon = prev > HORIZON;
  const out = { sunset: null, sunrise: null, darkStart: prev <= DARK ? noonMs : null, darkEnd: null, minEl: prev, minT: noonMs };
  for (let i = 1; i <= 288; i += 1) {
    const t = noonMs + i * 300000;
    const el = sunElevation(t, lat, lon);
    if (out.sunset === null && prev > HORIZON && el <= HORIZON) out.sunset = t;
    if (out.sunrise === null && prev <= HORIZON && el > HORIZON && (out.sunset !== null || !upAtNoon)) out.sunrise = t;
    if (out.darkStart === null && prev > DARK && el <= DARK) out.darkStart = t;
    if (out.darkEnd === null && out.darkStart !== null && prev <= DARK && el > DARK) out.darkEnd = t;
    if (el < out.minEl) { out.minEl = el; out.minT = t; }
    prev = el;
  }
  if (out.darkStart !== null && out.darkEnd === null) out.darkEnd = noonMs + DAY;
  out.midnightSun = upAtNoon && out.sunset === null;
  out.polarNight = !upAtNoon && out.sunrise === null;
  return out;
}

/* ---------- scoring model ---------- */
/** How far inside NOAA's equatorward viewing limit a site sits (0 = out of range, 1 = well inside). */
function viewFactor(lat, lon, kp) {
  const boundary = 66.5 - 2.05 * kp;
  return clamp((Math.abs(magneticLatitude(lat, lon)) - boundary + 5) / 8, 0, 1);
}
function activityFactor(kp, bz, wind) {
  const kpPart = clamp(kp / 6, 0, 1);
  if (!isNum(bz) && !isNum(wind)) return kpPart;
  const bzPart = isNum(bz) ? clamp((-bz + 1) / 9, 0, 1) : kpPart;
  const windPart = isNum(wind) ? clamp((wind - 320) / 380, 0, 1) : kpPart;
  return kpPart * 0.6 + bzPart * 0.25 + windPart * 0.15;
}
const darknessFactor = (elevation) => clamp((-elevation - 5) / 7, 0, 1);
const skyFactor = (cloud) => 1 - 0.95 * clamp(cloud, 0, 100) / 100;

function chanceAt(place, ms, { kp, bz, wind, cloud }) {
  const geo = viewFactor(place.lat, place.lon, kp) * (0.5 + 0.5 * activityFactor(kp, bz, wind));
  return Math.round(100 * geo * darknessFactor(sunElevation(ms, place.lat, place.lon)) * skyFactor(cloud));
}
function scoreClass(score) {
  if (score >= 60) return 'very-high';
  if (score >= 40) return 'high';
  if (score >= 20) return 'medium';
  return 'low';
}
function kpLabel(kp) {
  return ['Quiet', 'Quiet', 'Calm', 'Unsettled', 'Active', 'Minor storm · G1', 'Moderate storm · G2', 'Strong storm · G3', 'Severe storm · G4', 'Extreme storm · G5'][clamp(Math.round(kp), 0, 9)];
}

/* ---------- data layer ---------- */
async function fetchWith(url, kind = 'json', timeoutMs = 9000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return kind === 'text' ? await response.text() : await response.json();
  } finally {
    clearTimeout(timer);
  }
}
/** NOAA timestamps are UTC but often lack the trailing Z. */
function parseUtc(value) {
  if (typeof value !== 'string') return NaN;
  return Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(value) ? value : `${value.replace(' ', 'T')}Z`);
}
function tableRows(payload) {
  if (!Array.isArray(payload) || !payload.length) return [];
  if (!Array.isArray(payload[0])) return payload.filter((row) => row && typeof row === 'object');
  const headers = payload[0].map((cell) => String(cell).trim().toLowerCase());
  return payload.slice(1).map((row) => Object.fromEntries(headers.map((key, i) => [key, row[i]])));
}
function pick(row, keys) {
  for (const key of keys) {
    const hit = Object.keys(row).find((candidate) => candidate.toLowerCase() === key);
    const value = hit === undefined ? NaN : Number(row[hit]);
    if (hit !== undefined && row[hit] !== null && row[hit] !== '' && Number.isFinite(value)) return value;
  }
  return null;
}

async function fetchSpaceWeather() {
  const [kpNow, kpForecast, wind, windSummary, magSummary, outlook] = await Promise.allSettled([
    fetchWith(`${NOAA}/products/noaa-planetary-k-index.json`),
    fetchWith(`${NOAA}/products/noaa-planetary-k-index-forecast.json`),
    fetchWith(`${NOAA}/products/geospace/propagated-solar-wind-1-hour.json`),
    fetchWith(`${NOAA}/products/summary/solar-wind-speed.json`),
    fetchWith(`${NOAA}/products/summary/solar-wind-mag-field.json`),
    fetchWith(`${NOAA}/text/27-day-outlook.txt`, 'text'),
  ]);
  const val = (result) => (result.status === 'fulfilled' ? result.value : null);
  const out = { kp: null, kpTime: null, forecast: [], wind: null, bz: null, density: null, outlook: new Map(), live: false };

  const forecastRows = tableRows(val(kpForecast))
    .map((row) => ({ t: parseUtc(row.time_tag), kp: pick(row, ['kp']), kind: String(row.observed || '') }))
    .filter((row) => Number.isFinite(row.t) && row.kp !== null)
    .sort((a, b) => a.t - b.t);
  out.forecast = forecastRows.map((row) => ({ ...row, kp: clamp(row.kp, 0, 9) }));

  const observed = tableRows(val(kpNow))
    .map((row) => ({ t: parseUtc(row.time_tag), kp: pick(row, ['kp', 'kp_index', 'estimated_kp']) }))
    .filter((row) => Number.isFinite(row.t) && row.kp !== null)
    .sort((a, b) => a.t - b.t)
    .pop();
  const current = observed || [...out.forecast].reverse().find((row) => row.t <= Date.now());
  if (current) { out.kp = clamp(current.kp, 0, 9); out.kpTime = current.t; out.live = true; }

  const windRow = tableRows(val(wind)).filter((row) => pick(row, ['speed']) !== null).pop();
  if (windRow) {
    out.wind = pick(windRow, ['speed']);
    out.bz = pick(windRow, ['bz', 'bz_gsm']);
    out.density = pick(windRow, ['density']);
  }
  if (out.wind === null) out.wind = pick(tableRows(val(windSummary))[0] || {}, ['proton_speed', 'windspeed']);
  if (out.bz === null) out.bz = pick(tableRows(val(magSummary))[0] || {}, ['bz_gsm', 'bz']);
  if (out.wind !== null && (out.wind < 150 || out.wind > 3000)) out.wind = null;
  if (out.bz !== null && Math.abs(out.bz) > 200) out.bz = null;

  const months = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
  for (const line of String(val(outlook) || '').split('\n')) {
    const match = /^(\d{4}) (\w{3}) (\d{1,2})\s+\d+\s+\d+\s+(\d)\s*$/.exec(line.trim());
    if (match && match[2] in months) out.outlook.set(dateKey(Date.UTC(+match[1], months[match[2]], +match[3])), +match[4]);
  }
  return out;
}

function openMeteoUrl(lats, lons, extra) {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', lats);
  url.searchParams.set('longitude', lons);
  url.searchParams.set('timeformat', 'unixtime');
  url.searchParams.set('timezone', 'auto');
  for (const [key, value] of Object.entries(extra)) url.searchParams.set(key, value);
  return url.toString();
}
const hourlyClouds = (payload) => (payload?.hourly?.time || [])
  .map((t, i) => ({ t: t * 1000, cloud: Number(payload.hourly.cloud_cover?.[i]) }))
  .filter((row) => Number.isFinite(row.cloud));

async function fetchLocalWeather(location) {
  const payload = await fetchWith(openMeteoUrl(location.lat.toFixed(3), location.lon.toFixed(3), {
    current: 'cloud_cover,temperature_2m', hourly: 'cloud_cover', forecast_hours: '30', daily: 'cloud_cover_mean', forecast_days: '16',
  }));
  const utcOffset = Number(payload.utc_offset_seconds) || 0;
  const daily = new Map();
  (payload.daily?.time || []).forEach((t, i) => {
    const cloud = Number(payload.daily.cloud_cover_mean?.[i]);
    if (Number.isFinite(cloud)) daily.set(dateKey((t + utcOffset) * 1000), cloud);
  });
  const cloudNow = Number(payload.current?.cloud_cover);
  const temp = Number(payload.current?.temperature_2m);
  return {
    cloudNow: Number.isFinite(cloudNow) ? cloudNow : null,
    temp: Number.isFinite(temp) ? temp : null,
    hourly: hourlyClouds(payload), daily, utcOffset,
    tz: typeof payload.timezone === 'string' && isValidTimeZone(payload.timezone) ? payload.timezone : null,
  };
}
async function fetchCityClouds() {
  const payload = await fetchWith(openMeteoUrl(PRESETS.map((p) => p.lat).join(','), PRESETS.map((p) => p.lon).join(','), {
    hourly: 'cloud_cover', forecast_hours: '24',
  }));
  const list = Array.isArray(payload) ? payload : [payload];
  const map = new Map();
  PRESETS.forEach((preset, i) => { if (list[i]) map.set(preset.name, hourlyClouds(list[i])); });
  return map;
}
async function searchLocations(query) {
  const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
  url.searchParams.set('name', query.slice(0, 80));
  url.searchParams.set('count', '6');
  url.searchParams.set('language', 'en');
  url.searchParams.set('format', 'json');
  const payload = await fetchWith(url.toString());
  return (Array.isArray(payload?.results) ? payload.results : [])
    .filter((item) => isNum(item.latitude) && isNum(item.longitude) && typeof item.name === 'string');
}

/* ---------- time helpers (shown in the selected location's timezone) ---------- */
function isValidTimeZone(tz) { try { new Intl.DateTimeFormat('en', { timeZone: tz }); return true; } catch { return false; } }
function dateKey(ms) { return new Date(ms).toISOString().slice(0, 10); }
function fmt(ms, options) {
  const base = { ...options, timeZone: state.wx?.tz || undefined };
  try { return new Intl.DateTimeFormat(undefined, base).format(ms); } catch { return new Intl.DateTimeFormat(undefined, options).format(ms); }
}
const fmtTime = (ms) => (ms === null ? '—' : fmt(ms, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }));
const fmtHour = (ms) => fmt(ms, { hour: '2-digit', hourCycle: 'h23' }).replace(/\D/g, '').padStart(2, '0');
const utcOffsetMs = () => (state.wx ? state.wx.utcOffset * 1000 : Math.round(state.location.lon / 15) * HOUR);
const localNoon = (y, m, d) => Date.UTC(y, m, d, 12) - utcOffsetMs();
function tonightNoon() {
  const local = new Date(Date.now() + utcOffsetMs());
  const shift = local.getUTCHours() < 6 ? -1 : 0;
  return localNoon(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + shift);
}

/* ---------- forecast assembly ---------- */
function kpAt(ms) {
  const space = state.space;
  const slot = space?.forecast.find((row) => ms >= row.t && ms < row.t + 3 * HOUR);
  return slot ? slot.kp : (space?.kp ?? 2);
}
function cloudAt(series, ms, fallback) {
  const hit = series?.find((row) => ms >= row.t && ms < row.t + HOUR);
  return hit ? hit.cloud : fallback;
}
function buildHourly(place, series, fallbackCloud, override = null) {
  const start = Math.floor(Date.now() / HOUR) * HOUR;
  return Array.from({ length: 24 }, (_, i) => {
    const t = start + i * HOUR;
    const sample = Math.max(t, Date.now());
    // Nowcast: the observed Kp persists for a few hours, then NOAA's forecast takes over.
    const observed = state.space?.kp, predicted = kpAt(sample), hold = Math.exp(-i / 3);
    const kp = isNum(observed) ? observed * hold + predicted * (1 - hold) : predicted;
    const cloud = override ?? cloudAt(series, sample, fallbackCloud);
    const live = i === 0 ? { bz: state.space?.bz, wind: state.space?.wind } : {};
    return { t, kp, cloud, dark: darknessFactor(sunElevation(sample, place.lat, place.lon)), chance: chanceAt(place, sample, { kp, cloud, ...live }) };
  });
}
function currentCloud() {
  return state.cloudOverride ?? state.wx?.cloudNow ?? 50;
}
function peakOf(hourly) {
  return hourly.reduce((best, point) => (point.chance > best.chance ? point : best), hourly[0]);
}
function bestWindow(hourly) {
  const peak = peakOf(hourly);
  if (!peak || peak.chance < 5) return null;
  const index = hourly.indexOf(peak);
  const floor = Math.max(5, peak.chance * 0.7);
  let a = index, b = index;
  while (a > 0 && hourly[a - 1].chance >= floor) a -= 1;
  while (b < hourly.length - 1 && hourly[b + 1].chance >= floor) b += 1;
  return { start: hourly[a].t, end: hourly[b].t + HOUR, peak };
}
function verdict(peak, now) {
  if (peak >= 70) return ['Go. Tonight is the night.', now >= 50 ? 'It is dark, active and clear enough right now — step outside and look north.' : 'Strong odds once the sky is fully dark. Charge the camera.'];
  if (peak >= 45) return ['A good watch night', 'Worth staying up for. Find a dark horizon away from town lights.'];
  if (peak >= 20) return ['Borderline', 'Possible with patience and a clear patch of sky. Keep an eye on Bz.'];
  if (peak >= 5) return ['Long shot', 'A faint glow low on the horizon at best, unless activity picks up.'];
  return ['Not tonight', 'The lights are unlikely here tonight. The reasons are listed in the planner.'];
}
function limitingFactors(place, hourly) {
  const night = nightInfo(tonightNoon(), place.lat, place.lon);
  const kp = state.space?.kp ?? 2;
  const mlat = Math.abs(magneticLatitude(place.lat, place.lon));
  const boundary = 66.5 - 2.05 * kp;
  const notes = [];
  notes.push(`${place.name} sits at roughly ${mlat.toFixed(0)}° geomagnetic latitude; at Kp ${kp.toFixed(1)} the aurora is typically visible down to about ${boundary.toFixed(0)}°.`);
  if (mlat < boundary) notes.push(`You would need roughly Kp ${clamp(Math.round((66.5 - mlat) / 2.05), 1, 9)} or more for a realistic chance here.`);
  if (night.midnightSun) notes.push('The sun does not set here tonight — the sky never gets dark enough.');
  else if (night.minEl > -12) notes.push('The sky only reaches twilight tonight, so only bright aurora will show.');
  else notes.push(`True darkness runs ${fmtTime(night.darkStart)}–${fmtTime(night.darkEnd)} local time.`);
  const darkHours = hourly.filter((point) => point.dark > 0.5);
  if (darkHours.length) {
    const avg = Math.round(darkHours.reduce((sum, point) => sum + point.cloud, 0) / darkHours.length);
    notes.push(avg > 70 ? `Cloud is the main blocker: about ${avg}% cover through the dark hours.` : avg > 35 ? `Partly cloudy (${avg}% through the dark hours) — look for clear breaks.` : `Skies look clear: about ${avg}% cloud through the dark hours.`);
  }
  if (isNum(state.space?.bz)) notes.push(state.space.bz < -2 ? `Bz is southward (${state.space.bz.toFixed(1)} nT), which feeds the aurora.` : `Bz is ${state.space.bz.toFixed(1)} nT — not strongly southward right now.`);
  const overhead = window.AuroraGlobe?.probabilityAt?.(place.lat, place.lon);
  if (isNum(overhead)) notes.push(`NOAA's OVATION model puts aurora probability directly overhead at ${Math.round(overhead)}% for the next hour.`);
  return notes;
}

/* ---------- rendering ---------- */
function renderConditions() {
  const space = state.space;
  const kp = space?.kp ?? 2;
  setText('kpValue', space?.live ? kp.toFixed(1) : '—');
  setText('kpLabel', space?.live ? kpLabel(kp) : 'Feed unavailable');
  setText('windValue', isNum(space?.wind) ? Math.round(space.wind) : '—');
  setText('bzValue', isNum(space?.bz) ? `${space.bz > 0 ? '+' : ''}${space.bz.toFixed(1)}` : '—');
  setText('bzLabel', isNum(space?.bz) ? (space.bz < 0 ? 'nT · southward' : 'nT · northward') : 'nT');
  setText('cloudValue', `${Math.round(currentCloud())}%`);
  setText('cloudLabel', state.cloudOverride !== null ? 'what-if' : state.wx ? 'live' : 'assumed');
  setText('updatedAt', space?.kpTime ? fmt(space.kpTime, { weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }) : 'offline');
  setText('dataSource', [space?.live ? 'NOAA SWPC' : null, state.wx ? 'Open-Meteo' : null].filter(Boolean).join(' + ') || 'Offline estimate');
  setText('activeLocation', state.location.name);
  setText('tzNote', state.wx?.tz ? `Times shown in ${state.wx.tz.replace(/_/g, ' ')} time.` : 'Times shown in your device time zone.');
  [...(els.kpScale?.children || [])].forEach((segment, i) => segment.classList.toggle('on', Boolean(space?.live) && i <= Math.round(kp)));
}

function renderVerdict() {
  const peak = peakOf(state.hourly);
  const now = state.hourly[0].chance;
  setText('chanceValue', `${peak.chance}`);
  setText('nowValue', `${now}%`);
  if (els.chanceRing) els.chanceRing.style.strokeDasharray = `${peak.chance} 100`;
  const [label, text] = verdict(peak.chance, now);
  setText('summaryLabel', label);
  setText('summaryText', text);
  root.dataset.level = scoreClass(peak.chance);
  document.dispatchEvent(new CustomEvent('aurora:weather', { detail: { kp: state.space?.kp ?? 2, chance: peak.chance } }));
}

function renderWindow() {
  const place = state.location;
  const night = nightInfo(tonightNoon(), place.lat, place.lon);
  const window_ = bestWindow(state.hourly);
  setText('sunsetValue', night.midnightSun ? 'Sun stays up' : night.polarNight ? 'Polar night' : fmtTime(night.sunset));
  setText('sunriseValue', night.midnightSun ? 'Sun stays up' : night.polarNight ? 'Polar night' : fmtTime(night.sunrise));
  setText('darkHourValue', fmtTime(night.minT));
  if (window_) {
    setText('windowTitle', `${fmtTime(window_.start)} – ${fmtTime(window_.end)}`);
    setText('windowText', `Peak around ${fmtTime(window_.peak.t)} at ${window_.peak.chance}%, with Kp ${window_.peak.kp.toFixed(1)} forecast and ${Math.round(window_.peak.cloud)}% cloud.`);
  } else {
    setText('windowTitle', 'No real window tonight');
    setText('windowText', night.midnightSun ? 'The sky never gets dark here at this time of year.' : 'Activity, cloud or latitude rule it out for now. Check the planner for the limiting factor.');
  }
}

function renderTimeline() {
  const peak = Math.max(1, ...state.hourly.map((point) => point.chance));
  clear(els.timeline).append(...state.hourly.map((point) => {
    const bar = h('span', { class: 'bar' });
    bar.style.height = `${Math.max(3, (point.chance / Math.max(peak, 40)) * 100)}%`;
    return h('li', {
      class: `hour ${point.dark > 0.5 ? 'night' : 'day'}${point.chance === peak && peak > 4 ? ' peak' : ''}`,
      title: `${fmtTime(point.t)} · ${point.chance}% · Kp ${point.kp.toFixed(1)} · cloud ${Math.round(point.cloud)}%`,
    }, h('span', { class: 'bar-wrap' }, bar), h('strong', { text: `${point.chance}` }), h('small', { text: fmtHour(point.t) }));
  }));
}

function rankCities() {
  return PRESETS.map((place) => {
    const hourly = buildHourly(place, state.cityClouds.get(place.name), 50);
    return { ...place, peak: peakOf(hourly), now: hourly[0].chance };
  }).sort((a, b) => b.peak.chance - a.peak.chance || b.lat - a.lat);
}
function renderCities() {
  const ranked = rankCities();
  clear(els.cityRankings).append(...ranked.slice(0, 3).map((place, i) => h('article', { class: 'city-score' },
    h('span', { class: 'rank', text: `0${i + 1}` }),
    h('strong', { text: place.name }),
    h('span', { text: `${place.peak.chance}% peak · ${Math.round(place.peak.cloud)}% cloud` }))));
  clear(els.bestCities).append(...ranked.map((place) => h('li', {},
    h('button', { type: 'button', class: 'city-list-item', on: { click: () => setLocation(place) } },
      h('span', {}, h('strong', { text: place.name }), h('small', { text: `Now ${place.now}% · ${Math.abs(magneticLatitude(place.lat, place.lon)).toFixed(0)}° mag. lat` })),
      h('b', { class: scoreClass(place.peak.chance), text: `${place.peak.chance}%` })))));
}

function renderPlanner() {
  const place = state.location;
  const peak = peakOf(state.hourly);
  setText('visibilityScore', `${peak.chance}%`);
  setText('resultSummary', `${place.name}: ${state.hourly[0].chance}% right now, peaking at ${peak.chance}% around ${fmtTime(peak.t)}.`);
  const notes = limitingFactors(place, state.hourly);
  if (!PAGE_CITY) notes.push(peak.chance >= state.threshold ? `This clears your ${state.threshold}% alert threshold.` : `Below your ${state.threshold}% alert threshold.`);
  clear(els.resultNotes).append(...notes.map((note) => h('li', { text: note })));
}

function renderMap() {
  const space = state.space;
  setText('mapBadge', space?.live ? `Kp ${space.kp.toFixed(1)}` : 'Kp —');
  setText('mapBzChip', isNum(space?.bz) ? `Bz ${space.bz.toFixed(1)} nT` : 'Bz —');
  setText('mapWindChip', isNum(space?.wind) ? `Wind ${Math.round(space.wind)} km/s` : 'Wind —');
  setText('mapDarkChip', sunElevation(Date.now(), state.location.lat, state.location.lon) < -6 ? `Dark in ${state.location.name}` : `Daylight in ${state.location.name}`);
  mapFocusButtons.forEach((button) => {
    const active = button.dataset.mapFocus === state.mapFocus;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  const sun = sunPosition(Date.now());
  window.AuroraGlobe?.update({
    kp: space?.kp ?? 2, sun: { lat: sun.lat, lon: sun.lon }, focus: state.mapFocus,
    pins: PRESETS.map((p) => ({ name: p.name, lat: p.lat, lon: p.lon })),
    here: { name: state.location.name, lat: state.location.lat, lon: state.location.lon },
  });
}

/* ---------- calendar ---------- */
function calendarDay(y, m, d) {
  const place = state.location;
  const noon = localNoon(y, m, d);
  const night = nightInfo(noon, place.lat, place.lon);
  const moon = moonInfo(night.minT);
  const outlook = state.space?.outlook;
  const kpA = outlook?.get(dateKey(Date.UTC(y, m, d)));
  const kpB = outlook?.get(dateKey(Date.UTC(y, m, d + 1)));
  const kp = kpA === undefined && kpB === undefined ? null : Math.max(kpA ?? 0, kpB ?? 0);
  const cloud = state.wx?.daily.get(dateKey(Date.UTC(y, m, d))) ?? null;
  const past = noon + DAY < Date.now();
  let score = null;
  if (!past && kp !== null) {
    score = Math.round(100 * viewFactor(place.lat, place.lon, kp) * (0.5 + 0.5 * clamp(kp / 6, 0, 1))
      * darknessFactor(night.minEl) * (cloud === null ? 0.6 : skyFactor(cloud)) * (1 - 0.2 * moon.illum));
  }
  return { y, m, d, ms: Date.UTC(y, m, d), night, moon, kp, cloud, score, past };
}
function daySummary(day) {
  if (day.past) return 'This night has passed.';
  if (day.kp === null) return 'Beyond NOAA’s 27-day outlook — only moon and darkness are known this far ahead.';
  if (day.night.midnightSun) return 'No darkness: the sun stays above the horizon all night.';
  const tail = day.cloud === null ? ' No cloud forecast this far ahead, so average skies are assumed.' : '';
  if (day.score >= 60) return `A strong night to plan around.${tail}`;
  if (day.score >= 40) return `A good watch night if skies cooperate.${tail}`;
  if (day.score >= 20) return `Possible, but not a strong bet.${tail}`;
  return `Low odds on current outlook.${tail}`;
}
const fmtDay = (day) => new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(day.ms);

function renderCalendar() {
  const today = new Date();
  const base = new Date(today.getFullYear(), today.getMonth() + state.calendarOffset, 1);
  const y = base.getFullYear(), m = base.getMonth();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const padding = (base.getDay() + 6) % 7; // Monday first
  const days = Array.from({ length: daysInMonth }, (_, i) => calendarDay(y, m, i + 1));
  const isThisMonth = state.calendarOffset === 0;
  if (!state.calendarSelected || state.calendarSelected.y !== y || state.calendarSelected.m !== m) {
    state.calendarSelected = { y, m, d: isThisMonth ? today.getDate() : 1 };
  }
  setText('calendarMonthLabel', new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(base));
  const select = (day) => { state.calendarSelected = { y, m, d: day.d }; renderCalendar(); };

  const cells = Array.from({ length: padding }, () => h('span', { class: 'calendar-day outside', 'aria-hidden': 'true' }));
  days.forEach((day) => {
    const selected = state.calendarSelected.d === day.d;
    const cls = ['calendar-day', day.score === null ? (day.past ? 'past' : 'unknown') : scoreClass(day.score), selected && 'selected', isThisMonth && day.d === today.getDate() && 'today'].filter(Boolean).join(' ');
    cells.push(h('button', {
      type: 'button', class: cls, 'aria-pressed': String(selected),
      'aria-label': `${fmtDay(day)}: ${day.score === null ? 'no outlook' : `${day.score}% outlook`}, ${day.moon.label}`,
      on: { click: () => select(day) },
    },
    h('strong', { text: String(day.d) }),
    h('span', { class: 'calendar-score', text: day.score === null ? '·' : `${day.score}${day.cloud === null ? '~' : ''}` }),
    h('span', { class: 'calendar-moon', 'aria-hidden': 'true', text: day.moon.glyph })));
  });
  clear(els.forecastCalendar).append(...cells);

  const chosen = days[state.calendarSelected.d - 1] || days[0];
  setText('calendarSelectedLabel', fmtDay(chosen));
  setText('calendarSelectedSummary', daySummary(chosen));
  setText('calendarSelectedScore', chosen.score === null ? '—' : `${chosen.score}%`);
  setText('calendarSelectedKp', chosen.kp === null ? '—' : `Kp ${chosen.kp}`);
  setText('calendarSelectedCloud', chosen.cloud === null ? 'No forecast yet' : `${Math.round(chosen.cloud)}%`);
  setText('calendarSelectedMoon', `${chosen.moon.label} · ${Math.round(chosen.moon.illum * 100)}%`);
  setText('calendarSelectedSunset', chosen.night.midnightSun ? 'Sun stays up' : chosen.night.polarNight ? 'Polar night' : fmtTime(chosen.night.sunset));
  setText('calendarSelectedSunrise', chosen.night.midnightSun ? 'Sun stays up' : chosen.night.polarNight ? 'Polar night' : fmtTime(chosen.night.sunrise));

  const best = days.filter((day) => day.score !== null).sort((a, b) => b.score - a.score).slice(0, 3);
  clear(els.calendarBestNights).append(...(best.length ? best.map((day, i) => h('li', {},
    h('button', { type: 'button', class: 'calendar-best-item', on: { click: () => select(day) } },
      h('strong', { text: `0${i + 1} · ${fmtDay(day)}` }),
      h('span', { text: `${day.score}% · Kp ${day.kp} · ${day.moon.label}` }))))
    : [h('li', { class: 'muted', text: 'No outlook is published for this month yet.' })]));
}

/* ---------- orchestration ---------- */
function recompute() {
  state.hourly = buildHourly(state.location, state.wx?.hourly, state.wx?.cloudNow ?? 50, state.cloudOverride);
  renderConditions();
  renderVerdict();
  renderWindow();
  renderTimeline();
  renderCities();
  renderPlanner();
  renderMap();
  renderCalendar();
}

let refreshToken = 0;
async function refreshLive({ space = true } = {}) {
  const token = ++refreshToken;
  const place = { ...state.location };
  document.body.classList.add('loading-live');
  const [spaceResult, wxResult, cityResult] = await Promise.allSettled([
    space || !state.space ? fetchSpaceWeather() : Promise.resolve(state.space),
    fetchLocalWeather(place),
    space || !state.cityClouds.size ? fetchCityClouds() : Promise.resolve(state.cityClouds),
  ]);
  if (token !== refreshToken) return;
  if (spaceResult.status === 'fulfilled' && spaceResult.value.live) state.space = spaceResult.value;
  state.wx = wxResult.status === 'fulfilled' ? wxResult.value : null;
  if (cityResult.status === 'fulfilled') state.cityClouds = cityResult.value;
  syncCloudSlider();
  document.body.classList.remove('loading-live');
  recompute();
  notifyIfNeeded();
}

function syncCloudSlider() {
  const value = Math.round(currentCloud());
  els.cloudInput.value = value;
  setText('cloudPreview', `${value}%${state.cloudOverride !== null ? ' (what-if)' : state.wx ? ' (live)' : ''}`);
}

function sanitizeLocation(input) {
  const lat = Number(input?.lat), lon = Number(input?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  const name = typeof input.name === 'string' && input.name.trim() ? input.name.trim().slice(0, 80) : 'Selected location';
  return { name, lat, lon };
}
function setLocation(next, { refresh = true } = {}) {
  const clean = sanitizeLocation(next);
  if (!clean) return;
  state.location = clean;
  state.cloudOverride = null;
  state.wx = null;
  els.latInput.value = clean.lat.toFixed(4);
  els.lonInput.value = clean.lon.toFixed(4);
  document.querySelectorAll('.preset-chip').forEach((chip) => {
    const active = chip.textContent === clean.name;
    chip.classList.toggle('active', active);
    chip.setAttribute('aria-pressed', String(active));
  });
  saveState();
  if (refresh) { recompute(); refreshLive({ space: false }); }
}

/* ---------- persistence (only with consent) ---------- */
const hasPreferenceConsent = () => Boolean(window.__auroraConsent?.preferences);
function loadState() {
  if (!hasPreferenceConsent()) return;
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!saved || typeof saved !== 'object') return;
    savedRaw = saved;
    if (isNum(saved.threshold)) state.threshold = clamp(Math.round(saved.threshold), 20, 95);
    if (typeof saved.notify === 'boolean') state.notify = saved.notify;
    if (typeof saved.saveLocation === 'boolean') state.saveLocation = saved.saveLocation;
    if (typeof saved.lastNotifiedKey === 'string') state.lastNotifiedKey = saved.lastNotifiedKey.slice(0, 160);
    if (['arctic', 'nordics', 'north-america', 'iceland'].includes(saved.mapFocus)) state.mapFocus = saved.mapFocus;
    if (['dark', 'light', 'system'].includes(saved.themePreference)) state.themePreference = saved.themePreference;
    const location = state.saveLocation && !PAGE_CITY ? sanitizeLocation(saved.location) : null;
    if (location) state.location = location;
  } catch { /* ignore corrupt storage */ }
}
function saveState() {
  if (!hasPreferenceConsent()) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      threshold: state.threshold, notify: state.notify, saveLocation: state.saveLocation,
      // A city page must not overwrite the visitor's own saved place or map view.
      location: PAGE_CITY ? savedRaw?.location : (state.saveLocation ? state.location : undefined),
      mapFocus: PAGE_CITY ? savedRaw?.mapFocus : state.mapFocus, lastNotifiedKey: state.lastNotifiedKey, themePreference: state.themePreference,
    }));
  } catch { /* storage full or blocked */ }
}

/* ---------- theme ---------- */
function applyTheme(preference = state.themePreference) {
  const actual = preference === 'system' ? (systemThemeMedia?.matches === false ? 'light' : 'dark') : preference;
  root.dataset.theme = actual;
  if (themeMeta) themeMeta.setAttribute('content', actual === 'light' ? '#f3efe6' : '#04060c');
  themeButtons.forEach((button) => {
    const active = button.dataset.themeOption === preference;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  document.dispatchEvent(new CustomEvent('aurora:theme', { detail: { theme: actual } }));
}
themeButtons.forEach((button) => button.addEventListener('click', () => {
  state.themePreference = ['dark', 'light', 'system'].includes(button.dataset.themeOption) ? button.dataset.themeOption : 'system';
  applyTheme();
  saveState();
}));
systemThemeMedia?.addEventListener?.('change', () => { if (state.themePreference === 'system') applyTheme(); });

/* ---------- webcams (loaded only on click, via youtube-nocookie) ---------- */
function loadWebcam(cam) {
  if (!CAM_ID.test(cam.id)) return;
  const frame = h('iframe', {
    id: 'featuredCamFrame', title: `Live aurora webcam: ${cam.title}`,
    src: `https://www.youtube-nocookie.com/embed/${cam.id}?autoplay=1&mute=1&playsinline=1&rel=0`,
    allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen',
    referrerpolicy: 'strict-origin-when-cross-origin', loading: 'lazy',
    sandbox: 'allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox',
  });
  clear(els.camStage).append(frame);
}
function selectWebcam(cam, { play = true } = {}) {
  if (!CAM_ID.test(cam.id)) return;
  setText('featuredCamTitle', cam.title);
  setText('featuredCamMeta', cam.meta);
  if (els.featuredCamLink) els.featuredCamLink.href = `https://www.youtube.com/watch?v=${cam.id}`;
  webcamItems.forEach((item) => {
    const active = item.dataset.webcamId === cam.id;
    item.classList.toggle('active', active);
    if (active) item.setAttribute('aria-current', 'true'); else item.removeAttribute('aria-current');
  });
  if (els.camPlay) els.camPlay.dataset.webcamId = cam.id;
  if (play) loadWebcam(cam);
}
const camFromItem = (item) => ({
  id: item.dataset.webcamId || '',
  title: item.dataset.webcamTitle || item.querySelector('strong')?.textContent || 'Live cam',
  meta: item.dataset.webcamMeta || '',
});
webcamItems.forEach((item) => item.addEventListener('click', (event) => { event.preventDefault(); selectWebcam(camFromItem(item)); }));
els.camPlay?.addEventListener('click', () => {
  const active = webcamItems.find((item) => item.dataset.webcamId === els.camPlay.dataset.webcamId) || webcamItems[0];
  if (active) selectWebcam(camFromItem(active));
});

/* ---------- navigation highlight ---------- */
const navSections = navLinks.map((link) => document.querySelector(link.getAttribute('href'))).filter(Boolean);
if (navSections.length && 'IntersectionObserver' in window) {
  const observer = new IntersectionObserver((entries) => {
    const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (!visible) return;
    navLinks.forEach((link) => {
      const active = link.getAttribute('href') === `#${visible.target.id}`;
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'true'); else link.removeAttribute('aria-current');
    });
  }, { rootMargin: '-30% 0px -55% 0px', threshold: [0, 0.2] });
  navSections.forEach((section) => observer.observe(section));
}

/* ---------- planner: search, presets, geolocation ---------- */
function renderPresets() {
  clear(els.presetRow).append(...PRESETS.map((preset) => h('button', {
    type: 'button', class: 'preset-chip', text: preset.name, 'aria-pressed': 'false', on: { click: () => setLocation(preset) },
  })));
}
function closeSearch() { clear(els.searchResults); els.searchInput.setAttribute('aria-expanded', 'false'); }
let searchTimer = null, searchToken = 0;
async function runSearch(query) {
  const trimmed = query.trim();
  const token = ++searchToken;
  if (trimmed.length < 2) { closeSearch(); return; }
  clear(els.searchResults).append(h('p', { class: 'muted small', text: 'Searching…' }));
  const results = await searchLocations(trimmed).catch(() => null);
  if (token !== searchToken) return;
  clear(els.searchResults);
  els.searchInput.setAttribute('aria-expanded', 'true');
  if (!results) { els.searchResults.append(h('p', { class: 'muted small', text: 'Search is unavailable right now. Enter coordinates instead.' })); return; }
  if (!results.length) { els.searchResults.append(h('p', { class: 'muted small', text: 'No matches. Try a different spelling.' })); return; }
  els.searchResults.append(...results.map((item) => {
    const label = [item.name, item.admin1, item.country].filter((part) => typeof part === 'string' && part).join(', ');
    return h('button', {
      type: 'button', class: 'search-result',
      on: { click: () => { setLocation({ name: label, lat: item.latitude, lon: item.longitude }); els.searchInput.value = label; closeSearch(); } },
    }, h('strong', { text: label }), h('small', { text: `${item.latitude.toFixed(2)}°, ${item.longitude.toFixed(2)}°` }));
  }));
}
els.searchInput.addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => runSearch(els.searchInput.value), 280); });
els.searchInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') { event.preventDefault(); clearTimeout(searchTimer); runSearch(els.searchInput.value); }
  if (event.key === 'Escape') closeSearch();
});
els.searchButton.addEventListener('click', () => runSearch(els.searchInput.value));
document.addEventListener('click', (event) => {
  if (!els.searchResults.contains(event.target) && event.target !== els.searchInput && event.target !== els.searchButton) closeSearch();
});

els.locationForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const lat = Number(els.latInput.value), lon = Number(els.lonInput.value);
  const same = Math.abs(lat - state.location.lat) < 0.0001 && Math.abs(lon - state.location.lon) < 0.0001;
  const next = sanitizeLocation({ name: same ? state.location.name : `${lat.toFixed(2)}°, ${lon.toFixed(2)}°`, lat, lon });
  setText('plannerStatus', next ? '' : 'Latitude must be between −90 and 90, longitude between −180 and 180.');
  if (next) setLocation(next);
});
els.cloudInput.addEventListener('input', () => {
  state.cloudOverride = clamp(Number(els.cloudInput.value) || 0, 0, 100);
  syncCloudSlider();
  recompute();
});
els.useCurrent.addEventListener('click', () => {
  if (!('geolocation' in navigator)) { setText('plannerStatus', 'Your browser does not offer geolocation.'); return; }
  setText('plannerStatus', 'Asking your browser for a location…');
  navigator.geolocation.getCurrentPosition(
    (position) => {
      setText('plannerStatus', 'Using your approximate location. It never leaves your browser except as rounded coordinates sent to the weather service.');
      setLocation({ name: 'My location', lat: Math.round(position.coords.latitude * 100) / 100, lon: Math.round(position.coords.longitude * 100) / 100 });
    },
    () => setText('plannerStatus', 'Location permission was declined. Search for a place instead.'),
    { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 },
  );
});

mapFocusButtons.forEach((button) => button.addEventListener('click', () => {
  state.mapFocus = button.dataset.mapFocus || 'arctic';
  renderMap();
  saveState();
}));
document.addEventListener('aurora:globe-data', () => { renderPlanner(); setText('mapSource', window.AuroraGlobe?.sourceLabel?.() || ''); });

els.calendarPrev.addEventListener('click', () => { state.calendarOffset = Math.max(0, state.calendarOffset - 1); renderCalendar(); });
els.calendarNext.addEventListener('click', () => { state.calendarOffset = Math.min(2, state.calendarOffset + 1); renderCalendar(); });

/* ---------- alerts ---------- */
async function requestNotificationPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  return (await Notification.requestPermission()) === 'granted';
}
function notifyIfNeeded() {
  if (!state.notify || !('Notification' in window) || Notification.permission !== 'granted' || !state.hourly.length) return;
  const peak = peakOf(state.hourly);
  if (peak.chance < state.threshold) return;
  const key = `${state.location.lat.toFixed(2)}|${state.location.lon.toFixed(2)}|${state.threshold}|${dateKey(tonightNoon())}`;
  if (state.lastNotifiedKey === key) return;
  try {
    new Notification('Aurora watch triggered', { body: `${state.location.name}: ${peak.chance}% around ${fmtTime(peak.t)} — above your ${state.threshold}% threshold.`, icon: 'assets/icon-192.png' });
  } catch { return; }
  state.lastNotifiedKey = key;
  saveState();
}
els.thresholdInput.addEventListener('input', () => {
  state.threshold = clamp(Number(els.thresholdInput.value) || 60, 20, 95);
  setText('thresholdValue', `${state.threshold}%`);
  renderPlanner();
  saveState();
});
els.notifyToggle.addEventListener('change', async () => {
  state.notify = els.notifyToggle.checked && await requestNotificationPermission();
  els.notifyToggle.checked = state.notify;
  setText('alertStatus', state.notify ? 'Browser notifications are on while this tab stays open.' : 'Notifications are off or blocked by the browser.');
  saveState();
  notifyIfNeeded();
});
els.saveToggle.addEventListener('change', () => { state.saveLocation = els.saveToggle.checked; saveState(); });
els.alertForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = els.alertForm.querySelector('button[type="submit"]');
  const data = new FormData(els.alertForm);
  if (data.get('_gotcha')) return; // honeypot
  button.disabled = true;
  setText('alertStatus', 'Sending your watch request…');
  data.set('_subject', 'Aurora Hunt alert watch');
  data.set('location_name', state.location.name);
  data.set('latitude', state.location.lat.toFixed(2));
  data.set('longitude', state.location.lon.toFixed(2));
  data.set('threshold', String(state.threshold));
  let sent = false;
  try {
    const response = await fetch(els.alertForm.action, { method: 'POST', headers: { Accept: 'application/json' }, body: data, credentials: 'omit', referrerPolicy: 'no-referrer' });
    sent = response.ok;
  } catch { sent = false; }
  setText('alertStatus', sent ? 'Watch request sent. Your threshold is also saved in this browser.' : 'Could not send just now — your threshold is still saved in this browser.');
  button.disabled = false;
  saveState();
});

/* ---------- boot ---------- */
renderPresets();
loadState();
if (PAGE_CITY) {
  state.location = PAGE_CITY;
  const focus = document.body.dataset.cityFocus;
  if (['arctic', 'nordics', 'north-america', 'iceland'].includes(focus)) state.mapFocus = focus;
}
els.thresholdInput.value = state.threshold;
setText('thresholdValue', `${state.threshold}%`);
els.notifyToggle.checked = state.notify && 'Notification' in window && Notification.permission === 'granted';
els.saveToggle.checked = state.saveLocation;
applyTheme();
setLocation(state.location, { refresh: false });
syncCloudSlider();
recompute();
refreshLive();
setInterval(() => { if (!document.hidden) refreshLive(); }, 10 * 60 * 1000);
document.addEventListener('visibilitychange', () => { if (!document.hidden && Date.now() - (state.space?.kpTime || 0) > 4 * HOUR) refreshLive(); });
