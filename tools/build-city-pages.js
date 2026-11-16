// Dev helper (not needed to run the site): regenerates the city forecast pages (aurora-forecast-*.html) from one shared template.
// Usage: node tools/build-city-pages.js   — then commit the generated HTML.
const fs = require('fs'), path = require('path');
const out = process.argv[2] || path.join(__dirname, '..'), V = '20261118', SITE = 'https://aurorahunt.live/';
const CSP = "default-src 'self'; base-uri 'self'; object-src 'none'; form-action 'self'; connect-src 'self' https://services.swpc.noaa.gov https://api.open-meteo.com https://geocoding-api.open-meteo.com; img-src 'self' data:; font-src 'self'; frame-src 'none'; script-src 'self'; style-src 'self'; manifest-src 'self'; worker-src 'self'; upgrade-insecure-requests";
const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
const rad = (d) => d * Math.PI / 180, deg = (r) => r * 180 / Math.PI;
function mlat(lat, lon) { // keep in sync with magneticLatitude() in script.js
  const p = rad(80.8), l = rad(lat);
  const dipole = deg(Math.asin(Math.sin(l) * Math.sin(p) + Math.cos(l) * Math.cos(p) * Math.cos(rad(lon + 72.8))));
  const offset = (((lon + 15 + 540) % 360) - 180) / 35;
  return dipole - 3 * Math.exp(-offset * offset) * Math.min(1, lat / 45);
}

const cities = [
  { slug: 'tromso', name: 'Tromsø', country: 'Norway', lat: 69.6492, lon: 18.9553, focus: 'nordics',
    season: 'Late August to early April',
    intro: 'Tromsø sits at almost 70°N, inside the auroral zone, which makes it one of the most reliable places on Earth to see the northern lights. On a clear, dark night there is usually something to see even when space weather is quiet.',
    when: 'The season runs from late August to early April. From late November to mid-January the Sun does not rise at all, so it is dark enough for aurora from mid-afternoon. From about 20 May to 22 July the midnight sun makes the aurora impossible to see.',
    where: 'In town, Telegrafbukta beach and the lake Prestvannet are the easy options. For darker skies head to Ersfjordbotn or elsewhere on Kvaløya, 30–40 minutes by car.',
    tips: 'Tromsø is coastal and the weather changes fast. When the coast is clouded over, local guides often drive inland toward Skibotn and the Finnish border, where the air is drier and skies clear more often.' },
  { slug: 'abisko', name: 'Abisko', country: 'Sweden', lat: 68.3495, lon: 18.8312, focus: 'nordics',
    season: 'September to late March',
    intro: 'Abisko, in Swedish Lapland, is famous among aurora chasers for its clear skies. It lies under the auroral oval, so even quiet nights can produce a display.',
    when: 'The viewing season runs from September to late March. Midwinter brings the polar night, with only a few hours of twilight around midday.',
    where: 'The shore of Lake Torneträsk and the trails of Abisko National Park give open views north. The Aurora Sky Station on Mount Nuolja is reached by chairlift and sits above most local light.',
    tips: 'The mountains to the west wring moisture out of Atlantic weather, leaving a patch of clearer sky over the lake that locals call the “blue hole”. It is why Abisko often has stars when the Norwegian coast is clouded over.' },
  { slug: 'kiruna', name: 'Kiruna', country: 'Sweden', lat: 67.8558, lon: 20.2253, focus: 'nordics',
    season: 'September to late March',
    intro: 'Kiruna is Sweden’s northernmost town and a centre of space research — the Swedish Institute of Space Physics is based here and the Esrange space centre is nearby. It lies close to the auroral oval.',
    when: 'Aurora is visible from September to late March. The polar night lasts for a few weeks around the winter solstice, giving very long dark hours.',
    where: 'Leave the town and mine lights behind: the road toward Jukkasjärvi and the frozen Torne River, or the hill Luossavaara just north of town, both give darker skies.',
    tips: 'Kiruna has a cold, stable inland climate, so clear nights are common in midwinter — and so are temperatures below −25 °C. Dress for standing still.' },
  { slug: 'rovaniemi', name: 'Rovaniemi', country: 'Finland', lat: 66.5039, lon: 25.7294, focus: 'nordics',
    season: 'Late August to early April',
    intro: 'Rovaniemi sits on the Arctic Circle in Finnish Lapland. It is a little south of the auroral oval’s usual position, so a touch of geomagnetic activity helps — but displays are common through the dark season.',
    when: 'The season runs from late August to early April. September, October and March often combine dark skies with milder temperatures and good activity around the equinoxes.',
    where: 'The Arctic Garden on the riverbank behind the Arktikum museum is a ten-minute walk from the centre. Ounasvaara hill, across the river, is darker and higher.',
    tips: 'Look north and low on the horizon first: on quiet nights the aurora from Rovaniemi appears as an arc toward the north rather than overhead.' },
  { slug: 'reykjavik', name: 'Reykjavík', country: 'Iceland', lat: 64.1466, lon: -21.9426, focus: 'iceland',
    season: 'Late August to mid-April',
    intro: 'All of Iceland lies under the auroral oval, so Reykjavík needs very little geomagnetic activity. The real opponent is the North Atlantic weather.',
    when: 'The season runs from late August to mid-April. In midsummer the sky never gets properly dark.',
    where: 'Grótta lighthouse on the Seltjarnarnes peninsula is the classic in-town spot, and the hill Öskjuhlíð by Perlan is another. For truly dark skies, Þingvellir National Park is about 45 minutes away.',
    tips: 'Cloud moves through quickly in Iceland. Check the hourly chart above for a clear gap — a one-hour break is often all you need — and be ready to drive toward it.' },
  { slug: 'fairbanks', name: 'Fairbanks', country: 'Alaska, USA', lat: 64.8378, lon: -147.7164, focus: 'north-america',
    season: '21 August to 21 April',
    intro: 'Fairbanks lies directly under the auroral oval in Alaska’s interior. Its dry continental climate gives many clear nights, which is why it is the best-known aurora destination in the United States.',
    when: 'Locally the “aurora season” is counted from 21 August to 21 April. In summer the sky is too bright.',
    where: 'Cleary Summit and Murphy Dome, both within an hour of town, are popular high viewpoints. Chena Hot Springs, about 60 miles east, is well away from city lights.',
    tips: 'The Geophysical Institute at the University of Alaska Fairbanks has studied the aurora for decades. Activity often peaks around local midnight to 2 am, so plan to stay up.' },
  { slug: 'anchorage', name: 'Anchorage', country: 'Alaska, USA', lat: 61.2181, lon: -149.9003, focus: 'north-america',
    season: 'Late August to mid-April',
    intro: 'Anchorage is south of the auroral oval’s usual position, so it needs somewhat more activity than Fairbanks — but on active nights the aurora is seen well from the city’s edges.',
    when: 'The season runs from late August to mid-April, with the longest dark hours from November to February.',
    where: 'Glen Alps trailhead above the city, Point Woronzof by the airport and the Eklutna Lake area to the north-east all give a clear view north away from downtown lights.',
    tips: 'Anchorage is coastal and often cloudier than the interior. If the forecast is good but the sky is not, driving north toward Wasilla or Talkeetna can help.' },
  { slug: 'yellowknife', name: 'Yellowknife', country: 'Northwest Territories, Canada', lat: 62.454, lon: -114.3718, focus: 'north-america',
    season: 'Mid-August to early October, and mid-November to early April',
    intro: 'Yellowknife sits directly beneath the auroral oval. Flat terrain, a dry climate and very little cloud in winter make it one of the most dependable aurora locations in the world.',
    when: 'There are two seasons: mid-August to early October, when the lakes are still open and reflect the lights, and mid-November to early April, the cold, clear winter season.',
    where: 'The Ingraham Trail east of town has many lakeside pull-offs, such as Prosperous Lake. Aurora Village offers heated tipis a short drive from the city.',
    tips: 'Because Yellowknife is under the oval, the aurora is often directly overhead rather than on the northern horizon — lie back and look straight up.' },
  { slug: 'whitehorse', name: 'Whitehorse', country: 'Yukon, Canada', lat: 60.7212, lon: -135.0568, focus: 'north-america',
    season: 'Mid-August to mid-April',
    intro: 'Whitehorse, the capital of Yukon, is close to the southern edge of the auroral oval. Displays are frequent through the dark season, especially with a little geomagnetic activity.',
    when: 'The season runs from mid-August to mid-April. Autumn offers milder nights; midwinter offers the longest darkness.',
    where: 'Fish Lake Road and the Chadburn Lake area are both a short drive from town and well clear of city lights.',
    tips: 'Mountains surround Whitehorse, so choose a spot with an open northern horizon — a frozen lake is ideal.' },
  { slug: 'stockholm', name: 'Stockholm', country: 'Sweden', lat: 59.3293, lon: 18.0686, focus: 'nordics',
    season: 'September to March',
    intro: 'Stockholm is well south of the auroral zone, so the northern lights are an occasional treat rather than a nightly event. They appear during geomagnetic storms, usually low on the northern horizon.',
    when: 'Dark skies run from September to March. Storms are statistically more likely around the equinoxes, in September–October and March.',
    where: 'Get away from the city glow and find an open view north: the northern shores of the archipelago, Järvafältet nature reserve or the fields north of the city work well.',
    tips: 'From Stockholm the aurora is often a faint green or grey arc that a camera sees better than the eye. A phone on night mode pointed north will confirm it before you can.' },
  { slug: 'oslo', name: 'Oslo', country: 'Norway', lat: 59.9139, lon: 10.7522, focus: 'nordics',
    season: 'September to March',
    intro: 'Oslo is south of the auroral zone, but during geomagnetic storms the northern lights do reach the city — typically as an arc or rays above the northern horizon.',
    when: 'Dark skies run from September to March, with storms statistically more likely around the equinoxes.',
    where: 'The forests of Nordmarka shield you from city light: the lake Sognsvann is on the metro line, and the heights around Holmenkollen and Frognerseteren look north over dark woodland.',
    tips: 'Watch Bz and solar wind as well as Kp. In southern Norway a sudden southward turn of Bz during a storm is what brings the aurora into view.' },
  { slug: 'edinburgh', name: 'Edinburgh', country: 'Scotland, UK', lat: 55.9533, lon: -3.1883, focus: 'nordics',
    season: 'September to March',
    intro: 'Edinburgh sees the northern lights a handful of times each winter, during geomagnetic storms. From Scotland the aurora usually sits low over the northern horizon.',
    when: 'Dark skies run from September to March. Summer nights in Scotland never get fully dark.',
    where: 'Calton Hill and Arthur’s Seat give an open view north over the Firth of Forth. The coast at Portobello or further along East Lothian is darker still.',
    tips: 'City lights wash out faint aurora, so the darker your northern horizon the better. If Edinburgh is cloudy, the east coast is often clearer than the west.' },
];

const kpNeeded = (m) => Math.round((66.5 - m) / 2.05);
function kpText(c) {
  const n = kpNeeded(c.m);
  if (n <= 1) return { short: 'Kp 0–2', long: `${c.name} is close enough to the auroral oval that Kp 0–2 is usually enough. On most clear, dark nights there is a chance, and anything above Kp 3 can be spectacular.` };
  if (n <= 3) return { short: `Kp ${n}–${n + 1}`, long: `${c.name} sits just south of the oval’s usual position, so around Kp ${n} to ${n + 1} gives a realistic chance. On quieter nights look for a low arc on the northern horizon.` };
  if (n === 4) return { short: 'Kp 4+', long: `${c.name} needs an active night: around Kp 4 or higher, just short of a G1 geomagnetic storm. Below that the aurora usually stays too far north to see.` };
  return { short: `Kp ${n}+`, long: `${c.name} needs a geomagnetic storm: around Kp ${n} or higher (NOAA storm level G${n - 4}). Below that the aurora stays too far north to see.` };
}

function page(c) {
  const file = `aurora-forecast-${c.slug}.html`, url = SITE + file;
  const kp = kpText(c);
  const title = `${c.name} Aurora Forecast Tonight: Northern Lights Chance | Aurora Hunt`;
  const desc = `Will you see the northern lights in ${c.name} tonight? Live hour-by-hour aurora chance from NOAA Kp, solar wind and local cloud cover, plus when and where to watch.`;
  const faq = [
    [`What Kp index do you need to see the northern lights in ${c.name}?`, kp.long],
    [`When is the best time to see the northern lights in ${c.name}?`, `${c.when} On any given night the most active period is usually between about 22:00 and 02:00 local time.`],
    [`Where is the best place to see the aurora near ${c.name}?`, c.where],
  ];
  const ld = [
    { '@context': 'https://schema.org', '@type': 'WebPage', name: title, url, description: desc, isPartOf: { '@id': SITE + '#site' },
      about: { '@type': 'Place', name: `${c.name}, ${c.country}`, geo: { '@type': 'GeoCoordinates', latitude: c.lat, longitude: c.lon } } },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Aurora forecast', item: SITE },
      { '@type': 'ListItem', position: 2, name: c.name, item: url }] },
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
  ].map((o) => `    <script type="application/ld+json">${JSON.stringify(o)}</script>`).join('\n');
  const others = cities.filter((o) => o.slug !== c.slug).map((o) => `        <a href="aurora-forecast-${o.slug}.html">${o.name}</a>`).join('\n');
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta http-equiv="Content-Security-Policy" content="${CSP}" />
    <meta name="referrer" content="strict-origin-when-cross-origin" />
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(desc)}" />
    <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />
    <meta name="theme-color" content="#04060c" />
    <meta name="color-scheme" content="dark light" />
    <link rel="canonical" href="${url}" />
    <meta property="og:site_name" content="Aurora Hunt" />
    <meta property="og:title" content="${esc(c.name)} Aurora Forecast Tonight" />
    <meta property="og:description" content="${esc(desc)}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${url}" />
    <meta property="og:image" content="${SITE}assets/og-image.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:image" content="${SITE}assets/og-image.png" />
    <link rel="icon" href="favicon.ico?v=5" sizes="any" />
    <link rel="icon" type="image/svg+xml" href="assets/favicon.svg?v=5" />
    <link rel="apple-touch-icon" href="assets/apple-touch-icon.png?v=5" />
    <link rel="manifest" href="manifest.json" />
    <meta name="aurora-analytics-provider" content="privacy-first" />
    <meta name="aurora-telemetry-endpoint" content="/rum" />
    <link rel="preload" as="font" type="font/woff2" href="assets/fonts/instrument-serif-400.woff2" crossorigin />
    <link rel="preload" as="font" type="font/woff2" href="assets/fonts/geist-var.woff2" crossorigin />
    <link rel="preconnect" href="https://services.swpc.noaa.gov" crossorigin />
    <link rel="preconnect" href="https://api.open-meteo.com" crossorigin />
    <link rel="stylesheet" href="styles.css?v=${V}" />
    <script src="boot.js?v=${V}"></script>
${ld}
  </head>
  <body id="top" class="subpage city-page" data-city-name="${esc(c.name)}" data-city-lat="${c.lat}" data-city-lon="${c.lon}" data-city-focus="${c.focus}">
    <a class="skip-link" href="#main-content">Skip to main content</a>
    <canvas id="sky" class="sky" aria-hidden="true"></canvas>
    <header>
      <nav class="topbar" aria-label="Primary">
        <a class="brand" href="index.html" aria-label="Aurora Hunt home">
          <span class="brand-mark"><img src="assets/logo.svg?v=5" alt="" width="30" height="30" /></span>
          <span class="brand-name">Aurora <em>Hunt</em></span>
        </a>
        <div class="nav-links">
          <a href="#tonight">Tonight</a>
          <a href="#oval">Map</a>
          <a href="#guide">Guide</a>
          <a href="#city-faq">FAQ</a>
          <a href="index.html#planner">Other places</a>
        </div>
      </nav>
    </header>

    <main id="main-content" class="page-main wide">
      <nav class="breadcrumbs" aria-label="Breadcrumb">
        <a href="index.html">Aurora forecast</a><span aria-hidden="true">/</span><span aria-current="page">${c.name}</span>
      </nav>

      <section class="page-hero city-hero">
        <p class="eyebrow">${c.country} · ${Math.abs(c.lat).toFixed(1)}°N</p>
        <h1>Aurora forecast for <em>${c.name}</em> tonight</h1>
        <p class="lede">${c.intro}</p>
        <dl class="meta-row">
          <div class="meta-pill"><dt>Kp observed</dt><dd id="updatedAt">—</dd></div>
          <div class="meta-pill"><dt>Source</dt><dd id="dataSource">—</dd></div>
          <div class="meta-pill"><dt>Kp needed here</dt><dd>${kp.short}</dd></div>
        </dl>
      </section>

      <noscript><p class="card page-card">The live forecast needs JavaScript. The guide below works without it.</p></noscript>

      <section class="city-live" id="tonight" aria-label="Tonight’s forecast for ${esc(c.name)}">
        <aside class="instrument" aria-label="Tonight’s aurora conditions in ${esc(c.name)}">
          <p class="panel-title"><span class="live-dot" aria-hidden="true"></span>${c.name}, live</p>
          <div class="dial">
            <svg viewBox="0 0 120 120" aria-hidden="true" focusable="false">
              <defs><linearGradient id="dialGrad" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#3dffa2" /><stop offset=".55" stop-color="#39d0ff" /><stop offset="1" stop-color="#a77bff" /></linearGradient></defs>
              <circle class="dial-track" cx="60" cy="60" r="54" pathLength="100" />
              <circle class="dial-value" id="chanceRing" cx="60" cy="60" r="54" pathLength="100" stroke="url(#dialGrad)" />
            </svg>
            <div class="dial-read">
              <span>Peak chance</span>
              <strong><b id="chanceValue">—</b><i>%</i></strong>
              <small>Right now <b id="nowValue">—</b></small>
            </div>
          </div>
          <div class="verdict" aria-live="polite">
            <strong id="summaryLabel">Reading the sky…</strong>
            <p id="summaryText" class="muted">Fetching live space weather and cloud cover.</p>
          </div>
          <div class="kp-block">
            <div class="kp-head"><span>Planetary Kp</span><strong id="kpValue">—</strong><small id="kpLabel">—</small></div>
            <div class="kp-scale" id="kpScale" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
          </div>
          <dl class="stat-grid">
            <div class="stat-card"><dt>Solar wind</dt><dd id="windValue">—</dd><small>km/s</small></div>
            <div class="stat-card"><dt>Bz</dt><dd id="bzValue">—</dd><small id="bzLabel">nT</small></div>
            <div class="stat-card"><dt>Cloud</dt><dd id="cloudValue">—</dd><small id="cloudLabel">—</small></div>
          </dl>
        </aside>

        <div class="city-stack">
          <article class="card window-card">
            <p class="card-kicker">Best viewing window in ${c.name}</p>
            <h2 id="windowTitle">Calculating…</h2>
            <p id="windowText" class="muted">Working out when it is dark, clear and active.</p>
            <dl class="window-times">
              <div><dt>Sunset</dt><dd id="sunsetValue">—</dd></div>
              <div><dt>Darkest</dt><dd id="darkHourValue">—</dd></div>
              <div><dt>Sunrise</dt><dd id="sunriseValue">—</dd></div>
            </dl>
            <p id="tzNote" class="small muted"></p>
          </article>
          <article class="card timeline-card">
            <div class="card-head">
              <h2>Hourly northern lights chance</h2>
              <p class="muted small">% chance of seeing aurora · dimmed bars are daylight or twilight</p>
            </div>
            <ol id="timeline" class="timeline" aria-label="Hourly aurora chance in ${esc(c.name)} for the next 24 hours"></ol>
          </article>
          <article class="card" aria-live="polite">
            <h2>Why tonight looks like this</h2>
            <p id="resultSummary" class="muted">Loading…</p>
            <ul id="resultNotes" class="bullet-list"></ul>
          </article>
        </div>
      </section>

      <section class="card map-card" id="oval">
        <div class="map-top">
          <h2>The aurora oval over ${c.name} right now</h2>
          <span class="map-badge" id="mapBadge">Kp —</span>
        </div>
        <div class="globe-wrap">
          <canvas id="globe" class="globe" width="640" height="640" tabindex="0" role="img" aria-label="Globe showing the current aurora oval and the position of ${esc(c.name)}. Drag or use the arrow keys to rotate."></canvas>
        </div>
        <ul class="legend">
          <li><i class="legend-glow"></i>Aurora probability</li>
          <li><i class="legend-line"></i>Viewing limit at current Kp</li>
          <li><i class="legend-here"></i>${c.name}</li>
        </ul>
        <p id="mapSource" class="small muted">Loading NOAA OVATION…</p>
      </section>

      <section id="guide" class="city-guide">
        <h2 class="guide-title">Seeing the northern lights in <em>${c.name}</em></h2>
        <dl class="fact-grid">
          <div><dt>Latitude</dt><dd>${c.lat.toFixed(2)}°N</dd></div>
          <div><dt>Geomagnetic latitude</dt><dd>about ${Math.round(c.m)}°</dd></div>
          <div><dt>Kp needed</dt><dd>${kp.short}</dd></div>
          <div><dt>Season</dt><dd>${c.season}</dd></div>
        </dl>
        <div class="page-grid">
          <article class="card page-card"><h3>When to go</h3><p>${c.when}</p></article>
          <article class="card page-card"><h3>What Kp you need</h3><p>${kp.long}</p></article>
          <article class="card page-card"><h3>Where to watch</h3><p>${c.where}</p></article>
          <article class="card page-card"><h3>Local tip</h3><p>${c.tips}</p></article>
        </div>
      </section>

      <section id="city-faq">
        <h2 class="guide-title">${c.name} aurora <em>FAQ</em></h2>
        <div class="faq-list">
${faq.map(([q, a], i) => `          <details class="faq-item"${i === 0 ? ' open' : ''}>
            <summary><h3>${q}</h3></summary>
            <p>${a}</p>
          </details>`).join('\n')}
        </div>
      </section>

      <h2 class="guide-title small-title">Forecasts for other places</h2>
      <nav class="page-toc" aria-label="Aurora forecasts for other places">
${others}
        <a href="index.html#planner">Any location →</a>
      </nav>
    </main>

    <footer class="footer">
      <div class="footer-top">
        <p class="footer-mark">Aurora <em>Hunt</em></p>
        <p class="muted">A free, account-free aurora forecast made for people who would rather be outside looking up.</p>
      </div>
      <nav class="footer-links" aria-label="Footer">
        <a href="index.html">Forecast</a>
        <a href="about.html">About</a>
        <a href="contact.html">Contact</a>
        <a href="privacy.html">Privacy</a>
        <a href="cookies.html">Cookies</a>
        <a href="terms.html">Terms</a>
      </nav>
      <p class="footer-credit small muted">Space weather: NOAA Space Weather Prediction Center. Weather: Open-Meteo (CC BY 4.0). Forecasts are guidance, not a guarantee.</p>
    </footer>

    <script src="monitoring.js?v=${V}" defer></script>
    <script src="sky.js?v=${V}" defer></script>
    <script src="globe.js?v=${V}" defer></script>
    <script src="script.js?v=${V}" defer></script>
  </body>
</html>
`;
}
for (const c of cities) { c.m = mlat(c.lat, c.lon); fs.writeFileSync(path.join(out, `aurora-forecast-${c.slug}.html`), page(c)); console.log(c.name, 'mlat', c.m.toFixed(1), kpText(c).short); }
