# Aurora Hunt

**[aurorahunt.live](https://aurorahunt.live/)** — a free, account-free aurora forecast and northern lights tracker,
built with plain HTML, CSS and JavaScript. No build step, no dependencies, no backend.

It answers one question: *is it worth going outside tonight?*

## What it does

- **Hour-by-hour aurora chance** for any location, from observed Kp, NOAA's 3-day Kp forecast, live solar wind and Bz,
  hourly cloud cover and the Sun's true elevation at your coordinates
- **Live aurora oval globe** — a software-rendered, draggable Earth shaded from NOAA's OVATION model, with the
  day/night terminator and the equatorward viewing limit for the current Kp
- **27-day outlook calendar** — NOAA's 27-day Kp outlook, 16-day cloud forecast, moon phase and night length
- **A living background** — a WebGL fragment shader paints aurora curtains whose brightness follows the live Kp
- Location search, "where to be tonight" ranking, live webcams (loaded only on click), browser alerts
- Dark / light / system themes, offline support (service worker), installable PWA

## How the chance is calculated

`chance = reach × energy × darkness × sky`

| Factor | Source | Meaning |
| --- | --- | --- |
| Reach | geomagnetic latitude vs. `66.5° − 2.05° × Kp` | how far inside the viewing limit you are |
| Energy | Kp, Bz, solar wind speed | how much the Sun is delivering |
| Darkness | solar elevation (−5° → 0, −12° → 1) | polar night and midnight sun included |
| Sky | hourly cloud cover | cloud scales the chance toward zero |

If a feed is unavailable the page says so and falls back to a quiet-sky estimate rather than inventing numbers.

## Data sources

- [NOAA SWPC](https://www.swpc.noaa.gov/) — `noaa-planetary-k-index`, `noaa-planetary-k-index-forecast`,
  `geospace/propagated-solar-wind-1-hour`, `summary/solar-wind-*`, `text/27-day-outlook`, `json/ovation_aurora_latest`
- [Open-Meteo](https://open-meteo.com/) — forecast (cloud cover, time zone) and geocoding, CC BY 4.0
- Land outlines: Natural Earth 110m (public domain), via world-atlas
- Fonts (self-hosted, SIL OFL): Instrument Serif, Geist, Geist Mono

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Homepage: forecast, calendar, planner, map, webcams, FAQ (with JSON-LD) |
| `styles.css` | Design system and layout for every page |
| `boot.js` | Runs in `<head>`: frame-busting, consent state, theme |
| `script.js` | Data fetching, astronomy, scoring model, rendering, alerts |
| `sky.js` | WebGL aurora background |
| `globe.js` | OVATION globe renderer |
| `consent.js` | Privacy banner and service-worker registration |
| `forms.js` | Progressive enhancement for the Formspree forms |
| `sw.js` | Service worker (network-first for code, cache-first for fonts and images) |
| `monitoring.js` | Optional RUM hook (inactive until a same-origin collector exists) |
| `llms.txt`, `robots.txt`, `sitemap.xml` | Crawler and AI-assistant guidance |

## Security

- Strict Content-Security-Policy on every page (`script-src 'self'`, `style-src 'self'`, no inline scripts or styles),
  delivered by `<meta http-equiv>` because GitHub Pages cannot send custom headers
- No `innerHTML` with dynamic data; third-party API responses are validated and rendered as text
- Webcam iframes are sandboxed, use `youtube-nocookie.com`, and load only when the visitor presses play
- `boot.js` refuses to render inside a foreign frame (clickjacking defence without `X-Frame-Options`)
- `_headers` carries the full header set for hosts that honour it (Cloudflare Pages, Netlify)

## Run locally

```bash
npx serve .
```

## Deploy

GitHub Pages serves the `main` branch root at the `CNAME` domain — pushing to `main` deploys.
When you change a script or stylesheet, bump the `?v=` query on its references and `VERSION` in `sw.js`.
