# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stack

Pure static site — plain HTML, CSS, and vanilla JavaScript. No build step, no dependencies, no package manager.

## Run locally

Open `index.html` in a browser, or serve the directory with any static server:

```bash
npx serve .
# or
python -m http.server
```

## Architecture

- `index.html` — homepage structure, SEO metadata and JSON-LD (WebApplication, FAQPage)
- `styles.css` — the whole design system (dark/light tokens, layout, sub pages)
- `boot.js` — synchronous head script: frame-busting, consent state, theme
- `script.js` — data layer, astronomy, scoring model, all rendering (DOM built with `h()`, never innerHTML)
- `sky.js` — WebGL aurora background, driven by the `aurora:weather` event
- `globe.js` — per-pixel orthographic globe from NOAA OVATION; exposes `window.AuroraGlobe`
- `consent.js`, `forms.js`, `monitoring.js`, `sw.js` — privacy banner, Formspree enhancement, RUM hook, service worker

Data flows entirely in the browser:
1. **NOAA SWPC** — observed Kp, 3-day Kp forecast, 27-day outlook, propagated solar wind, OVATION grid
2. **Open-Meteo** — hourly/daily cloud cover, time zone, geocoding
3. `script.js` computes `chance = reach × energy × darkness × sky` per hour and renders the UI
4. If a feed fails the UI says so and uses a quiet-sky estimate (Kp 2); it never fabricates values

## Generated pages

- `aurora-forecast-<city>.html` — one landing page per city. They reuse `script.js`: the location is pinned by
  `data-city-*` attributes on `<body>`, and elements a page does not have resolve to a detached stub.
- City pages and the about/contact/legal/error pages are written by `tools/build-city-pages.js` and
  `tools/build-sub-pages.js` (plain Node, no dependencies). Edit the generator, run it, commit the HTML.
  Keep `mlat()` in the city generator in sync with `magneticLatitude()` in `script.js`.

## Rules that must hold

- **CSP**: every page sets `script-src 'self'; style-src 'self'` via `<meta http-equiv>`. No inline scripts,
  no inline `style=""` attributes, no third-party scripts or fonts. A new external host must be added to the
  CSP in `index.html` and in `_headers`.
- **No innerHTML with dynamic data.** Use `h()` / `textContent`.
- **Cache busting**: when a JS/CSS file changes, bump its `?v=` in every HTML file and `VERSION` in `sw.js`.
- NOAA timestamps are UTC without a trailing `Z` — parse them with `parseUtc()`.
- `404.html` and `500.html` use absolute asset paths because GitHub Pages serves 404 at any depth.

## Deployment

GitHub Pages serves the `main` branch root (custom domain in `CNAME`) — pushing to `main` deploys.
GitHub Pages ignores `_headers`; the file is kept for hosts that honour it (Cloudflare Pages / Netlify).

`healthz.html` is a plain uptime check target — it should always return 200.
