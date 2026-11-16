/* Aurora Hunt — the aurora globe.
 * A software-rendered orthographic Earth: every pixel is inverse-projected to lat/lon and
 * shaded from three layers — a rasterised land mask, the day/night terminator, and NOAA's
 * OVATION aurora probability grid (1° × 1°, bilinear). Drag or use arrow keys to rotate.
 * If OVATION is unreachable the oval is modelled from Kp and labelled as such. */
(() => {
  'use strict';
  const canvas = document.getElementById('globe');
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext('2d');
  const buffer = document.createElement('canvas');
  const bctx = buffer.getContext('2d');

  const GW = 360, GH = 181, LW = 2048, LH = 1024;
  const RAD = Math.PI / 180;
  const OVATION_URL = 'https://services.swpc.noaa.gov/json/ovation_aurora_latest.json';
  const POLE = { lat: 80.8, lon: -72.8 };
  const FOCUS = {
    arctic: { lat: 74, lon: 5, zoom: 1.02 },
    nordics: { lat: 66, lon: 19, zoom: 2.5 },
    'north-america': { lat: 60, lon: -108, zoom: 1.7 },
    iceland: { lat: 65, lon: -19, zoom: 3.3 },
  };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  let grid = null, source = 'none', validTime = null, fetchedAt = 0, loading = false;
  let land = null;
  let view = { ...FOCUS.arctic };
  let anim = null, dragging = null, visible = false, started = false, queued = 0;
  let data = { kp: 2, sun: { lat: 0, lon: 0 }, pins: [], here: null, focus: 'arctic' };

  /* ---- data ---- */
  function modelGrid() {
    const out = new Float32Array(GW * GH);
    const kp = data.kp;
    const centre = 68 - 1.4 * kp, sigma = 2.5 + 0.5 * kp, peak = Math.min(95, 18 + 11 * kp);
    const sp = Math.sin(POLE.lat * RAD), cp = Math.cos(POLE.lat * RAD);
    const sunLat = data.sun.lat * RAD, sunLon = data.sun.lon * RAD;
    for (let j = 0; j < GH; j += 1) {
      const lat = (j - 90) * RAD, sl = Math.sin(lat), cl = Math.cos(lat);
      for (let i = 0; i < GW; i += 1) {
        const lon = i * RAD;
        const mlat = Math.asin(sl * sp + cl * cp * Math.cos(lon - POLE.lon * RAD)) / RAD;
        const day = sl * Math.sin(sunLat) + cl * Math.cos(sunLat) * Math.cos(lon - sunLon);
        const z = (Math.abs(mlat) - centre) / sigma;
        out[j * GW + i] = peak * Math.exp(-z * z) * (0.6 + 0.4 * clamp(0.5 - day * 2, 0, 1));
      }
    }
    return out;
  }
  async function loadOvation() {
    if (loading) return;
    loading = true;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      const response = await fetch(OVATION_URL, { signal: controller.signal, cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' });
      clearTimeout(timer);
      if (!response.ok) throw new Error('ovation');
      const payload = await response.json();
      const next = new Float32Array(GW * GH);
      let count = 0;
      for (const row of payload.coordinates || []) {
        const lon = row[0], lat = row[1], value = row[2];
        if (Number.isInteger(lon) && Number.isInteger(lat) && lon >= 0 && lon < 360 && lat >= -90 && lat <= 90 && Number.isFinite(value)) {
          next[(lat + 90) * GW + lon] = clamp(value, 0, 100);
          count += 1;
        }
      }
      if (count < GW * GH * 0.9) throw new Error('ovation-shape');
      grid = next;
      source = 'ovation';
      const t = Date.parse(payload['Forecast Time']);
      validTime = Number.isFinite(t) ? t : null;
    } catch {
      grid = modelGrid();
      source = 'model';
    }
    fetchedAt = Date.now();
    loading = false;
    document.dispatchEvent(new CustomEvent('aurora:globe-data'));
    request(true);
  }
  async function loadLand() {
    try {
      const response = await fetch('assets/land-110m.json', { credentials: 'omit' });
      const rings = await response.json();
      const mask = document.createElement('canvas');
      mask.width = LW; mask.height = LH;
      const m = mask.getContext('2d', { willReadFrequently: true });
      m.fillStyle = '#fff';
      for (const ring of rings) {
        m.beginPath();
        for (let i = 0; i < ring.length; i += 2) {
          const x = (ring[i] + 180) / 360 * LW, y = (90 - ring[i + 1]) / 180 * LH;
          if (i === 0) m.moveTo(x, y); else m.lineTo(x, y);
        }
        m.closePath();
        m.fill();
      }
      const pixels = m.getImageData(0, 0, LW, LH).data;
      land = new Uint8Array(LW * LH);
      for (let i = 0; i < land.length; i += 1) land[i] = pixels[i * 4 + 3];
    } catch { land = null; }
    request(true);
  }
  function sample(lonDeg, latDeg) {
    const x = ((lonDeg % 360) + 360) % 360, y = clamp(latDeg + 90, 0, 180);
    const x0 = Math.floor(x), y0 = Math.min(179, Math.floor(y));
    const fx = x - x0, fy = y - y0, x1 = (x0 + 1) % 360;
    const a = grid[y0 * GW + x0], b = grid[y0 * GW + x1], c = grid[(y0 + 1) * GW + x0], d = grid[(y0 + 1) * GW + x1];
    return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
  }

  /* ---- projection ---- */
  function basis() {
    const la = view.lat * RAD, lo = view.lon * RAD;
    const sl = Math.sin(la), cl = Math.cos(la), so = Math.sin(lo), co = Math.cos(lo);
    return { e: [-so, co, 0], n: [-sl * co, -sl * so, cl], o: [cl * co, cl * so, sl] };
  }
  function forward(B, lat, lon) {
    const la = lat * RAD, lo = lon * RAD, cl = Math.cos(la);
    const p = [cl * Math.cos(lo), cl * Math.sin(lo), Math.sin(la)];
    const dot = (v) => v[0] * p[0] + v[1] * p[1] + v[2] * p[2];
    return { x: dot(B.e), y: dot(B.n), z: dot(B.o) };
  }

  /* ---- raster pass ---- */
  function raster(N) {
    const light = document.documentElement.dataset.theme === 'light';
    const P = light
      ? { od: [214, 224, 232], on: [168, 180, 194], ld: [247, 243, 234], ln: [198, 203, 208], au: [0, 148, 108], hot: [96, 60, 190] }
      : { od: [15, 33, 58], on: [7, 12, 23], ld: [62, 88, 116], ln: [34, 48, 68], au: [70, 255, 165], hot: [215, 255, 235] };
    if (buffer.width !== N) { buffer.width = N; buffer.height = N; }
    const image = bctx.createImageData(N, N), px = image.data;
    const B = basis(), R = (N / 2) * 0.95 * view.zoom, half = N / 2;
    const sLat = data.sun.lat * RAD, sLon = data.sun.lon * RAD;
    const S = [Math.cos(sLat) * Math.cos(sLon), Math.cos(sLat) * Math.sin(sLon), Math.sin(sLat)];
    for (let j = 0; j < N; j += 1) {
      const y = (half - j - 0.5) / R;
      for (let i = 0; i < N; i += 1) {
        const x = (i - half + 0.5) / R;
        const r2 = x * x + y * y;
        if (r2 > 1) continue;
        const z = Math.sqrt(1 - r2);
        const gx = x * B.e[0] + y * B.n[0] + z * B.o[0];
        const gy = x * B.e[1] + y * B.n[1] + z * B.o[1];
        const gz = y * B.n[2] + z * B.o[2];
        const lat = Math.asin(clamp(gz, -1, 1)) / RAD, lon = Math.atan2(gy, gx) / RAD;
        let day = clamp((gx * S[0] + gy * S[1] + gz * S[2] + 0.12) / 0.2, 0, 1);
        day = day * day * (3 - 2 * day);
        const isLand = land ? land[Math.min(LH - 1, ((90 - lat) / 180 * LH) | 0) * LW + (((lon + 180) / 360 * LW) | 0) % LW] > 127 : false;
        const dc = isLand ? P.ld : P.od, nc = isLand ? P.ln : P.on;
        const shade = 0.6 + 0.4 * z;
        let a = grid ? Math.pow(clamp(sample(lon, lat) / 45, 0, 1), 0.6) * (0.35 + 0.65 * (1 - day)) : 0;
        if (light) a *= 0.85;
        const hot = a > 0.7 ? (a - 0.7) / 0.3 : 0;
        const k = (j * N + i) * 4;
        for (let c = 0; c < 3; c += 1) {
          const base = (nc[c] + (dc[c] - nc[c]) * day) * shade;
          const glow = P.au[c] + (P.hot[c] - P.au[c]) * hot;
          px[k + c] = base + (glow - base) * a;
        }
        px[k + 3] = r2 > 0.985 ? 255 * (1 - r2) / 0.015 : 255;
      }
    }
    bctx.putImageData(image, 0, 0);
  }

  /* ---- vector overlays ---- */
  function overlays(size) {
    const light = document.documentElement.dataset.theme === 'light';
    const B = basis(), R = (size / 2) * 0.95 * view.zoom, cx = size / 2, cy = size / 2;
    const dpr = size / canvas.clientWidth;
    const line = (points, style, width, dash = []) => {
      ctx.beginPath();
      let pen = false;
      for (const [lat, lon] of points) {
        const p = forward(B, lat, lon);
        if (p.z <= 0.02) { pen = false; continue; }
        const X = cx + p.x * R, Y = cy - p.y * R;
        if (pen) ctx.lineTo(X, Y); else ctx.moveTo(X, Y);
        pen = true;
      }
      ctx.strokeStyle = style; ctx.lineWidth = width * dpr; ctx.setLineDash(dash.map((d) => d * dpr)); ctx.stroke(); ctx.setLineDash([]);
    };
    const hair = light ? 'rgba(20,30,45,.13)' : 'rgba(190,215,255,.1)';
    for (const lat of [40, 50, 60, 70, 80]) line(Array.from({ length: 121 }, (_, i) => [lat, i * 3 - 180]), hair, 0.6);
    for (let lon = -180; lon < 180; lon += 30) line(Array.from({ length: 31 }, (_, i) => [i * 3, lon]), hair, 0.6);

    // Equatorward viewing limit for the current Kp (NOAA rule of thumb), in geomagnetic coordinates.
    const mlat = 66.5 - 2.05 * data.kp, delta = (90 - mlat) * RAD, lp = POLE.lat * RAD;
    const edge = Array.from({ length: 181 }, (_, i) => {
      const phi = i * 2 * RAD;
      const lat = Math.asin(Math.sin(lp) * Math.cos(delta) + Math.cos(lp) * Math.sin(delta) * Math.cos(phi));
      const lon = POLE.lon * RAD + Math.atan2(Math.sin(phi) * Math.sin(delta) * Math.cos(lp), Math.cos(delta) - Math.sin(lp) * Math.sin(lat));
      return [lat / RAD, lon / RAD];
    });
    line(edge, light ? 'rgba(120,60,200,.75)' : 'rgba(255,120,190,.8)', 1.3, [5, 5]);

    ctx.font = `${10.5 * dpr}px "Geist Mono", ui-monospace, monospace`;
    ctx.textBaseline = 'middle';
    const ink = light ? '#131a24' : '#eef3fa';
    const pin = (item, here) => {
      const p = forward(B, item.lat, item.lon);
      if (p.z <= 0.08) return;
      const X = cx + p.x * R, Y = cy - p.y * R;
      if (X < 0 || Y < 0 || X > size || Y > size) return;
      ctx.beginPath(); ctx.arc(X, Y, (here ? 3.5 : 2.2) * dpr, 0, Math.PI * 2);
      ctx.fillStyle = here ? (light ? '#7a3cc8' : '#ff7ac0') : ink; ctx.fill();
      if (here) { ctx.beginPath(); ctx.arc(X, Y, 8 * dpr, 0, Math.PI * 2); ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 1.2 * dpr; ctx.stroke(); }
      if (here || view.zoom > 1.5 || ['Tromsø', 'Reykjavík', 'Fairbanks', 'Yellowknife', 'Stockholm'].includes(item.name)) {
        ctx.fillStyle = ink; ctx.globalAlpha = here ? 1 : 0.8;
        ctx.fillText(item.name, X + (here ? 12 : 6) * dpr, Y);
        ctx.globalAlpha = 1;
      }
    };
    data.pins.filter((item) => !data.here || item.name !== data.here.name).forEach((item) => pin(item, false));
    if (data.here) pin(data.here, true);
  }

  function render(fine) {
    const cssSize = canvas.clientWidth;
    if (!cssSize) return;
    const size = Math.round(cssSize * Math.min(window.devicePixelRatio || 1, 2));
    if (canvas.width !== size) { canvas.width = size; canvas.height = size; }
    raster(fine ? Math.min(460, size) : 190);
    ctx.clearRect(0, 0, size, size);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(buffer, 0, 0, size, size);
    overlays(size);
  }
  function request(fine) {
    if (!visible) return;
    if (fine && queued === 2) return;
    if (!queued) requestAnimationFrame(() => { const f = queued === 2; queued = 0; render(f); });
    queued = Math.max(queued, fine ? 2 : 1);
  }

  /* ---- motion ---- */
  function flyTo(target) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { view = { ...target }; request(true); return; }
    const from = { ...view }, start = performance.now();
    const dLon = ((target.lon - from.lon + 540) % 360) - 180;
    anim = start;
    const step = (now) => {
      if (anim !== start) return;
      const t = clamp((now - start) / 900, 0, 1), k = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      view = { lat: from.lat + (target.lat - from.lat) * k, lon: from.lon + dLon * k, zoom: from.zoom + (target.zoom - from.zoom) * k };
      if (t < 1) { render(false); requestAnimationFrame(step); } else { anim = null; request(true); }
    };
    requestAnimationFrame(step);
  }
  canvas.addEventListener('pointerdown', (event) => {
    dragging = { x: event.clientX, y: event.clientY, lat: view.lat, lon: view.lon };
    anim = null;
    canvas.setPointerCapture(event.pointerId);
    canvas.classList.add('dragging');
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    const scale = 110 / (canvas.clientWidth * view.zoom);
    view.lon = dragging.lon - (event.clientX - dragging.x) * scale;
    view.lat = clamp(dragging.lat + (event.clientY - dragging.y) * scale, 15, 90);
    request(false);
  });
  const endDrag = () => { if (dragging) { dragging = null; canvas.classList.remove('dragging'); request(true); } };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('keydown', (event) => {
    const step = 8 / view.zoom;
    const move = { ArrowLeft: [0, -step], ArrowRight: [0, step], ArrowUp: [step, 0], ArrowDown: [-step, 0] }[event.key];
    if (!move) return;
    event.preventDefault();
    view.lat = clamp(view.lat + move[0], 15, 90);
    view.lon += move[1];
    request(true);
  });

  if ('ResizeObserver' in window) new ResizeObserver(() => request(true)).observe(canvas);
  document.addEventListener('aurora:theme', () => request(true));
  const start = () => { if (started) return; started = true; loadLand(); loadOvation(); };
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      visible = entries.some((entry) => entry.isIntersecting);
      if (visible) { start(); request(true); }
    }, { rootMargin: '400px' }).observe(canvas);
  } else { visible = true; start(); }

  window.AuroraGlobe = {
    update(next) {
      const focusChanged = next.focus && next.focus !== data.focus;
      data = { ...data, ...next };
      if (source === 'model') grid = modelGrid();
      if (started && Date.now() - fetchedAt > 10 * 60 * 1000) loadOvation();
      if (focusChanged && FOCUS[data.focus]) flyTo(FOCUS[data.focus]); else request(true);
    },
    probabilityAt(lat, lon) { return source === 'ovation' && grid ? sample(lon, lat) : null; },
    sourceLabel() {
      if (source === 'ovation') return `NOAA OVATION model${validTime ? ` · valid ${new Date(validTime).toISOString().slice(11, 16)} UTC` : ''}`;
      if (source === 'model') return 'Oval modelled from Kp — the OVATION feed is unavailable right now';
      return 'Loading NOAA OVATION…';
    },
  };
})();
