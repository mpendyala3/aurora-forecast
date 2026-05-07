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
  cityInput: document.querySelector('#cityInput'),
  searchInput: document.querySelector('#searchInput'),
  searchButton: document.querySelector('#searchButton'),
  searchResults: document.querySelector('#searchResults'),
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
  auroraBand: document.querySelector('#auroraBand'),
  bestCities: document.querySelector('#bestCities'),
  emailInput: document.querySelector('#emailInput'),
  webhookInput: document.querySelector('#webhookInput'),
  thresholdInput: document.querySelector('#thresholdInput'),
  thresholdValue: document.querySelector('#thresholdValue'),
  notifyToggle: document.querySelector('#notifyToggle'),
  saveToggle: document.querySelector('#saveToggle'),
  alertForm: document.querySelector('#alertForm'),
  testAlert: document.querySelector('#testAlert'),
  watchlist: document.querySelector('#watchlist'),
};

const STORAGE_KEY = 'aurora-forecast-v1';

const state = {
  weather: null,
  location: { ...PRESETS[0] },
  threshold: 60,
  email: '',
  webhookUrl: '',
  notify: false,
  saveLocation: true,
  watchlist: [],
  lastNotifiedKey: null,
};

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

async function postJson(url, body, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return true;
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

function pickNumber(row, keys) {
  if (!row || typeof row !== 'object') return null;
  for (const key of keys) {
    const value = row[key] ?? row[key.toLowerCase()] ?? row[key.toUpperCase()];
    const num = Number(value);
    if (Number.isFinite(num)) return num;
  }
  return null;
}

function pickString(row, keys) {
  if (!row || typeof row !== 'object') return null;
  for (const key of keys) {
    const value = row[key] ?? row[key.toLowerCase()] ?? row[key.toUpperCase()];
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

async function sendAlertWebhook(payload) {
  if (!state.webhookUrl) return false;
  try {
    await postJson(state.webhookUrl, payload);
    return true;
  } catch {
    return false;
  }
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
  });
}

function setLocation(next, shouldRefresh = true) {
  state.location = { ...next };
  els.cityInput.value = next.name;
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
  const width = clamp(18 + kp * 8, 24, 92);
  const top = clamp(60 - kp * 3, 8, 46);
  els.auroraBand.style.inset = `${top}px 18px auto 18px`;
  els.auroraBand.style.height = `${Math.max(170, width * 2.7)}px`;
  els.auroraBand.style.opacity = `${0.45 + kp * 0.06}`;
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
  renderRankings();
  renderMap();
  renderBestCities();
  renderResult(state.location);
  saveState();
}

async function refreshLive() {
  try {
    await loadLiveData(state.location);
  } catch {
    state.weather = buildFallbackWeather();
  }
  updateWeather();
  refresh();
  notifyIfNeeded();
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (saved.email) state.email = saved.email;
    if (saved.webhookUrl) state.webhookUrl = saved.webhookUrl;
    if (typeof saved.threshold === 'number') state.threshold = saved.threshold;
    if (typeof saved.notify === 'boolean') state.notify = saved.notify;
    if (typeof saved.saveLocation === 'boolean') state.saveLocation = saved.saveLocation;
    if (Array.isArray(saved.watchlist)) state.watchlist = saved.watchlist;
    if (typeof saved.lastNotifiedKey === 'string') state.lastNotifiedKey = saved.lastNotifiedKey;
    if (saved.location) state.location = { ...state.location, ...saved.location };
  } catch {
    // ignore corrupt storage
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    email: state.email,
    webhookUrl: state.webhookUrl,
    threshold: state.threshold,
    notify: state.notify,
    saveLocation: state.saveLocation,
    location: state.location,
    watchlist: state.watchlist,
    lastNotifiedKey: state.lastNotifiedKey,
  }));
}

function renderWatchlist() {
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
      <span>${item.email || 'No email'} · threshold ${item.threshold}%</span>
    `;
    els.watchlist.appendChild(row);
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
    });
    els.searchResults.appendChild(row);
  });
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
  els.emailInput.value = state.email;
  els.webhookInput.value = state.webhookUrl;
  els.thresholdInput.value = state.threshold;
  els.thresholdValue.textContent = `${state.threshold}%`;
  els.notifyToggle.checked = state.notify;
  els.saveToggle.checked = state.saveLocation;
}

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
    name: els.cityInput.value.trim() || 'Custom location',
    lat: Number(els.latInput.value),
    lon: Number(els.lonInput.value),
    cloud: Number(els.cloudInput.value),
  };
  setLocation(chosen);
});

els.searchButton.addEventListener('click', async () => {
  const query = els.searchInput.value.trim();
  if (!query) return;
  els.searchResults.innerHTML = '<p class="muted small">Searching…</p>';
  try {
    const results = await searchLocations(query);
    renderSearchResults(results);
  } catch {
    els.searchResults.innerHTML = '<p class="muted small">Search failed. Try again later.</p>';
  }
});

els.searchInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    els.searchButton.click();
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
  state.email = els.emailInput.value.trim();
  state.webhookUrl = els.webhookInput.value.trim();
  state.threshold = Number(els.thresholdInput.value);
  state.notify = els.notifyToggle.checked;
  state.saveLocation = els.saveToggle.checked;

  if (state.notify) {
    const ok = await requestNotificationPermission();
    if (!ok) state.notify = false;
    els.notifyToggle.checked = state.notify;
  }

  if (state.saveLocation) {
    state.watchlist.unshift({
      location: state.location.name,
      email: state.email,
      threshold: state.threshold,
      lat: state.location.lat,
      lon: state.location.lon,
    });
    state.watchlist = state.watchlist.slice(0, 8);
    renderWatchlist();
  }

  if (state.webhookUrl) {
    await sendAlertWebhook({
      type: 'watch-saved',
      email: state.email,
      threshold: state.threshold,
      location: state.location,
      weather: state.weather,
      timestamp: new Date().toISOString(),
    });
  }

  saveState();
  refresh();
});

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

els.testAlert.addEventListener('click', async () => {
  const ok = await requestNotificationPermission();
  if (ok) {
    new Notification('Aurora forecast test', { body: 'Your alert system is connected.' });
  }
  if (state.webhookUrl) {
    const sent = await sendAlertWebhook({
      type: 'test-alert',
      email: state.email,
      location: state.location,
      weather: state.weather,
      timestamp: new Date().toISOString(),
    });
    if (sent) return alert('Test alert sent to your webhook.');
  }
  if (!ok) alert('Notifications are not available here, but your watch settings are saved locally.');
});

renderPresets();
loadState();
syncAlertUI();

if (state.location && state.location.name) {
  setLocation(state.location, false);
} else {
  setLocation(PRESETS[0], false);
}

if (state.email) els.emailInput.value = state.email;
renderWatchlist();
state.weather = buildFallbackWeather();
updateWeather();
refresh();
refreshLive();

setInterval(refreshLive, 10 * 60 * 1000);
