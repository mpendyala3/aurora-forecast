# Aurora Forecast

A polished aurora forecast website built with plain HTML, CSS, and JavaScript.

## Features

- Live NOAA Kp data with local fallback
- Live Open-Meteo cloud/weather data by location
- Kp, Bz, solar wind, cloud cover, and aurora chance
- Location-based planner with presets
- Real location search and reverse geocoding
- Approximate visibility map
- Hourly viewing window and best-time guidance
- Watchlist, alert settings, and webhook-ready alerts
- Local browser notifications when available
- Built-in explainers for aurora numbers

## Notes

- NOAA and weather requests happen in the browser.
- If a feed fails, the site falls back to a local model instead of breaking.
- The site is fully usable without a backend.
- Email/push delivery can be connected through your own webhook or backend later.

## Run locally

Open `index.html` in a browser, or serve the folder with a static server.
