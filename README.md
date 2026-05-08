# Aurora Hunt

Aurora Hunt is a browser-based aurora hunting site built with plain HTML, CSS, and JavaScript.
It combines live space-weather data, local weather, location planning, and simple guidance so you can judge
whether the northern lights are actually worth chasing tonight.

## What it does

- Pulls live NOAA Kp and solar wind data in the browser
- Pulls live cloud and weather estimates from Open-Meteo
- Falls back to a local model if a feed fails
- Scores aurora visibility by location
- Shows a best-time window for darkness
- Includes an hourly forecast timeline and monthly forecast calendar
- Ranks preset cities by current odds
- Supports search and reverse geocoding
- Draws an approximate aurora oval / visibility map
- Includes a webcam section with live aurora streams
- Includes a compare section and educational explainer cards
- Saves watch settings locally
- Can trigger browser notifications
- Can send alert submissions through Formspree
- Includes a separate operator submission form
- Includes a light/dark/system theme switcher

## Why it feels useful

- Turns raw numbers into plain-language guidance
- Works without a backend
- Degrades gracefully when feeds are unavailable
- Gives a quick answer for "should I go out now?"
- Includes a comparison section that explains why Aurora Hunt is easier to use than typical forecast apps

## Data sources

- NOAA SWPC: planetary K-index and solar wind feeds
- Open-Meteo: weather, cloud cover, and geocoding

## Site pages

- `index.html` — main dashboard
- `about.html` — project overview
- `contact.html` — support and partnership contact form
- `submit-operator.html` — operator suggestion form
- `privacy.html` — privacy policy
- `cookies.html` — cookie and local storage notes

## Run locally

Open `index.html` in a browser, or serve the folder with any static server.

## Files

- `index.html` — page structure and content
- `styles.css` — visual design and responsive layout
- `script.js` — data loading, scoring, rendering, and alerts
