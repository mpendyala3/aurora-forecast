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

All logic lives in three files:

- `script.js` — data fetching, scoring, rendering, alert scheduling, and all runtime behaviour
- `styles.css` — visual design and responsive layout
- `index.html` — page structure and content

Data flows entirely in the browser:
1. **NOAA SWPC** feeds supply the live Kp index and solar wind data
2. **Open-Meteo** supplies cloud cover, weather, and geocoding
3. `script.js` combines both feeds into a visibility score and renders the UI
4. If either feed fails, `script.js` falls back to a local estimation model

Supporting files:
- `sw.js` — service worker for offline/PWA support
- `monitoring.js` — client-side RUM/error hook (inactive until a same-origin collector is configured)
- `consent.js` / `consent-bootstrap.js` — cookie consent layer
- `manifest.json` / `site.webmanifest` — PWA metadata

## Deployment

Static files served directly — no server runtime required. `CNAME` is present for a custom domain. `_headers` configures HTTP response headers (Cloudflare Pages / Netlify style).

`healthz.html` is a plain uptime check target — it should always return 200.
