// Dev helper (not needed to run the site): regenerates about, contact, legal and error pages from one shared template.
// Usage: node tools/build-sub-pages.js   — then commit the generated HTML.
const fs = require('fs'), path = require('path');
const out = process.argv[2] || path.join(__dirname, '..'), V = '20261117', SITE = 'https://aurorahunt.live/';
const CSP = "default-src 'self'; base-uri 'self'; object-src 'none'; form-action 'self' https://formspree.io; connect-src 'self' https://formspree.io; img-src 'self' data:; font-src 'self'; frame-src 'none'; script-src 'self'; style-src 'self'; manifest-src 'self'; worker-src 'self'; upgrade-insecure-requests";
const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

function page({ file, title, desc, crumbs, body, index = true, abs = false, ld = [], scripts = [] }) {
  const p = abs ? '/' : '';
  const url = SITE + file;
  const crumbLd = crumbs ? { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ name: 'Home', item: SITE }, ...crumbs.map((c) => ({ name: c[0], item: c[1] ? SITE + c[1] : url }))].map((c, i) => ({ '@type': 'ListItem', position: i + 1, ...c })) } : null;
  const blocks = [...ld, crumbLd].filter(Boolean).map((o) => `    <script type="application/ld+json">${JSON.stringify(o)}</script>`).join('\n');
  const crumbHtml = crumbs ? `      <nav class="breadcrumbs" aria-label="Breadcrumb">
        <a href="${p}index.html">Home</a>${crumbs.map((c, i) => `<span aria-hidden="true">/</span>${i === crumbs.length - 1 ? `<span aria-current="page">${c[0]}</span>` : `<a href="${p}${c[1]}">${c[0]}</a>`}`).join('')}
      </nav>\n\n` : '';
  const social = index ? `    <link rel="canonical" href="${url}" />
    <meta property="og:site_name" content="Aurora Hunt" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(desc)}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${url}" />
    <meta property="og:image" content="${SITE}assets/og-image.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:image" content="${SITE}assets/og-image.png" />
` : '';
  const extra = scripts.map((s) => `    <script src="${p}${s}?v=${V}" defer></script>\n`).join('');
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta http-equiv="Content-Security-Policy" content="${CSP}" />
    <meta name="referrer" content="strict-origin-when-cross-origin" />
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(desc)}" />
    <meta name="robots" content="${index ? 'index, follow' : 'noindex, follow'}" />
    <meta name="theme-color" content="#04060c" />
    <meta name="color-scheme" content="dark light" />
${social}    <link rel="icon" href="${p}favicon.ico" sizes="any" />
    <link rel="icon" type="image/svg+xml" href="${p}assets/favicon.svg?v=4" />
    <link rel="apple-touch-icon" href="${p}assets/apple-touch-icon.png" />
    <link rel="manifest" href="${p}manifest.json" />
    <meta name="aurora-analytics-provider" content="privacy-first" />
    <meta name="aurora-telemetry-endpoint" content="/rum" />
    <link rel="preload" as="font" type="font/woff2" href="${p}assets/fonts/instrument-serif-400.woff2" crossorigin />
    <link rel="preload" as="font" type="font/woff2" href="${p}assets/fonts/geist-var.woff2" crossorigin />
    <link rel="stylesheet" href="${p}styles.css?v=${V}" />
    <script src="${p}boot.js?v=${V}"></script>
${blocks}
  </head>
  <body id="top" class="subpage">
    <a class="skip-link" href="#main-content">Skip to main content</a>
    <canvas id="sky" class="sky" aria-hidden="true"></canvas>
    <header>
      <nav class="topbar" aria-label="Primary">
        <a class="brand" href="${p}index.html" aria-label="Aurora Hunt home">
          <span class="brand-mark"><img src="${p}assets/logo.svg?v=4" alt="" width="30" height="30" /></span>
          <span class="brand-name">Aurora <em>Hunt</em></span>
        </a>
        <div class="nav-links">
          <a href="${p}index.html#forecast">Forecast</a>
          <a href="${p}index.html#map">Map</a>
          <a href="${p}index.html#webcam">Live</a>
          <a href="${p}index.html#faq">FAQ</a>
          <a href="${p}about.html">About</a>
          <a href="${p}contact.html">Contact</a>
        </div>
      </nav>
    </header>

    <main id="main-content" class="page-main">
${crumbHtml}${body}
    </main>

    <footer class="footer">
      <div class="footer-top">
        <p class="footer-mark">Aurora <em>Hunt</em></p>
        <p class="muted">A free, account-free aurora forecast made for people who would rather be outside looking up.</p>
      </div>
      <nav class="footer-links" aria-label="Footer">
        <a href="${p}index.html">Forecast</a>
        <a href="${p}about.html">About</a>
        <a href="${p}contact.html">Contact</a>
        <a href="${p}submit-operator.html">Submit an operator</a>
        <a href="${p}privacy.html">Privacy</a>
        <a href="${p}cookies.html">Cookies</a>
        <a href="${p}terms.html">Terms</a>
      </nav>
    </footer>

    <script src="${p}monitoring.js?v=${V}" defer></script>
    <script src="${p}sky.js?v=${V}" defer></script>
${extra}  </body>
</html>
`;
}
const hero = (eyebrow, h1, lede) => `      <section class="card page-hero">
        <p class="eyebrow">${eyebrow}</p>
        <h1>${h1}</h1>
        <p class="lede">${lede}</p>
      </section>`;
const card = (id, h2, inner) => `        <article class="card page-card"${id ? ` id="${id}"` : ''}>
          <h2>${h2}</h2>
${inner}
        </article>`;
const list = (items) => `          <ul class="page-list">\n${items.map((i) => `            <li>${i}</li>`).join('\n')}\n          </ul>`;
const para = (t) => `          <p>${t}</p>`;
const grid = (...cards) => `      <section class="page-grid">\n${cards.join('\n')}\n      </section>`;
const ext = (href, text) => `<a href="${href}" target="_blank" rel="noopener noreferrer">${text}</a>`;
const honeypot = '<div class="honeypot" aria-hidden="true"><label>Leave this field empty <input name="_gotcha" type="text" tabindex="-1" autocomplete="off" /></label></div>';

const pages = [
  {
    file: 'about.html',
    title: 'About Aurora Hunt — How Our Aurora Forecast Works',
    desc: 'Aurora Hunt is a free, account-free northern lights forecast. See how it combines NOAA space weather, Open-Meteo cloud cover and solar geometry into one clear answer.',
    crumbs: [['About']],
    ld: [{ '@context': 'https://schema.org', '@type': 'AboutPage', name: 'About Aurora Hunt', url: SITE + 'about.html', isPartOf: { '@id': SITE + '#site' }, about: { '@id': SITE + '#org' } }],
    body: [
      hero('About', 'Built for people chasing the <em>northern lights.</em>', 'Aurora Hunt answers one question as honestly as it can: is it worth going outside tonight? It reads live space weather, real cloud cover and the darkness of your sky, and turns them into a single hour-by-hour chance.'),
      grid(
        card('what-we-do', 'What it does', para('It combines the planetary Kp index, NOAA’s Kp forecast, solar wind speed and Bz with hourly cloud cover and the Sun’s true position at your coordinates. The result is a visibility chance for any place on Earth, a best viewing window, a 27-day outlook and a live map of the auroral oval.')),
        card('why-it-exists', 'Why it exists', para('Most aurora tools show raw numbers and leave the interpretation to you, or bury the answer under ads and sign-ups. Aurora Hunt keeps the useful parts on one page, explains them in plain language, and never asks for an account.'))),
      grid(
        card('data', 'Where the data comes from', list([
          `${ext('https://www.swpc.noaa.gov/', 'NOAA Space Weather Prediction Center')} — observed Kp, 3-day Kp forecast, 27-day outlook, solar wind and the OVATION aurora model`,
          `${ext('https://open-meteo.com/', 'Open-Meteo')} — cloud cover, time zones and place search (CC BY 4.0)`,
          'Sunrise, sunset, twilight and moon phase are calculated in your browser'])),
        card('method', 'How the chance is calculated', list([
          '<strong>Reach</strong> — your geomagnetic latitude against how far the oval extends at the current or forecast Kp',
          '<strong>Energy</strong> — live solar wind speed and southward Bz raise the score',
          '<strong>Darkness</strong> — the Sun must be well below the horizon; 12° or more is ideal',
          '<strong>Sky</strong> — cloud cover scales the chance toward zero']))),
      `      <section class="card page-card" id="principles">
          <h2>Principles</h2>
${list(['Free, with no account and no advertising', 'Honest when data is missing: if a feed is down the page says so instead of inventing numbers', 'Private by default: no analytics, no third-party fonts, video only loads when you press play', 'A forecast is guidance, not a guarantee — the sky has the final say'])}
      </section>`,
      `      <nav class="page-toc" aria-label="Next steps">
        <a href="index.html#forecast">Tonight’s forecast</a>
        <a href="index.html#map">Aurora oval map</a>
        <a href="index.html#faq">Northern lights FAQ</a>
        <a href="contact.html">Contact</a>
      </nav>`].join('\n\n'),
  },
  {
    file: 'contact.html',
    title: 'Contact Aurora Hunt — Support, Feedback and Partnerships',
    desc: 'Send Aurora Hunt a question, bug report, feature idea or partnership note using the contact form. No account needed.',
    crumbs: [['Contact']],
    scripts: ['forms.js'],
    body: [
      hero('Contact', 'Talk to <em>Aurora Hunt.</em>', 'Questions, bug reports, feature ideas and partnership notes are all welcome.'),
      grid(
        `        <article class="card page-card" id="contact-form">
          <h2>Contact form</h2>
          <form class="contact-form" action="https://formspree.io/f/mlgzwlro" method="POST" data-async-form data-success="Message sent — we’ll get back to you soon." data-fallback-submit>
            <input type="hidden" name="_subject" value="Aurora Hunt contact form" />
            ${honeypot}
            <div class="contact-split">
              <label>Your name <input name="name" type="text" autocomplete="name" maxlength="120" required /></label>
              <label>Your email <input name="email" type="email" placeholder="you@example.com" autocomplete="email" maxlength="254" required /></label>
            </div>
            <label>What is this about?
              <select name="topic" required>
                <option value="">Choose one</option>
                <option>Support</option>
                <option>Partnership</option>
                <option>Feature request</option>
                <option>Bug report</option>
                <option>Remove my data</option>
                <option>Other</option>
              </select>
            </label>
            <label>Message <textarea name="message" rows="6" maxlength="5000" placeholder="Tell us what you need." required></textarea></label>
            <div class="planner-actions"><button type="submit" class="button primary">Send message</button></div>
            <p class="page-note">The form is delivered by Formspree. See the <a href="privacy.html">privacy policy</a>.</p>
            <noscript><p class="page-note">JavaScript is optional here — the form still submits normally without it.</p></noscript>
            <div class="contact-status" data-form-status role="status" hidden></div>
          </form>
        </article>`,
        card('what-to-send', 'What to send', list(['Something on the site looks wrong or broken', 'An idea that would make the forecast more useful', 'Tour operator collaborations', 'A request to remove an email you signed up with'])))].join('\n\n'),
  },
  {
    file: 'submit-operator.html',
    title: 'Suggest an Aurora Tour Operator | Aurora Hunt',
    desc: 'Know a trustworthy northern lights tour operator? Suggest them to Aurora Hunt with this short form so other aurora chasers can find good local guides.',
    crumbs: [['Tours', 'index.html#tours'], ['Submit an operator']],
    scripts: ['forms.js'],
    body: [
      hero('Tours', 'Suggest a tour <em>operator.</em>', 'Recommend a reputable aurora tour company. Listings are editorial — we review every suggestion and never sell placement.'),
      `      <section class="card page-card" id="operator-form">
        <form id="tourForm" class="tour-form" action="https://formspree.io/f/mjglerqr" method="POST" data-async-form data-success="Thank you — your suggestion has been sent for review.">
          <input type="hidden" name="_subject" value="Aurora Hunt operator submission" />
          ${honeypot}
          <label>Operator / company name <input name="operator_name" type="text" autocomplete="organization" maxlength="160" required /></label>
          <label>Website <input name="website" type="url" placeholder="https://example.com" autocomplete="url" maxlength="300" required aria-describedby="tourWebsiteError" /></label>
          <p id="tourWebsiteError" class="field-error" data-url-error aria-live="polite"></p>
          <label>Region <input name="region" type="text" maxlength="120" required /></label>
          <label>Contact email (optional) <input name="contact_email" type="email" placeholder="hello@example.com" autocomplete="email" maxlength="254" /></label>
          <label>Type of tour
            <select name="tour_type">
              <option value="">Select an option</option>
              <option>Aurora chase</option>
              <option>Northern lights cruise</option>
              <option>Private tour</option>
              <option>Photography tour</option>
              <option>Multi-day package</option>
            </select>
          </label>
          <label>Short description <textarea name="description" rows="4" maxlength="2000" placeholder="What makes this operator stand out?"></textarea></label>
          <div class="planner-actions"><button type="submit" class="button primary">Submit operator</button></div>
          <noscript><p class="page-note">This form still works without JavaScript.</p></noscript>
          <div class="contact-status" data-form-status role="status" hidden></div>
        </form>
      </section>`].join('\n\n'),
  },
  {
    file: 'privacy.html',
    title: 'Privacy Policy | Aurora Hunt',
    desc: 'How Aurora Hunt handles your data: no account, no analytics, no advertising. What is stored in your browser and which services your browser contacts.',
    crumbs: [['Privacy policy']],
    body: [
      hero('Privacy policy', 'Private by <em>default.</em>', 'Aurora Hunt has no accounts, no advertising and no analytics. The forecast is calculated in your browser. This page lists exactly what is stored and which services your browser talks to. Last updated 16 November 2026.'),
      `      <nav class="page-toc" aria-label="On this page">
        <a href="#local-storage">Stored in your browser</a>
        <a href="#services">Services contacted</a>
        <a href="#forms">Forms</a>
        <a href="#location">Location</a>
        <a href="#your-choices">Your choices</a>
      </nav>`,
      grid(
        card('local-storage', 'Stored in your browser', para('Your consent choice is kept in local storage, plus one session cookie so the banner does not reappear while you browse. Only if you tick “Remember preferences” do we also save your theme, alert threshold and chosen location in local storage. Nothing is stored on a server.')),
        card('services', 'Services your browser contacts', list([
          '<strong>GitHub Pages</strong> hosts the site and, like any web host, sees your IP address',
          '<strong>NOAA SWPC</strong> — space weather data; receives your IP address only',
          '<strong>Open-Meteo</strong> — weather and place search; receives the coordinates or place name you look up',
          '<strong>YouTube (privacy-enhanced mode)</strong> — only after you press play on a webcam',
          '<strong>Formspree</strong> — only if you submit a form'])),
        card('forms', 'Forms', para('The alert, contact and operator forms are delivered to our inbox by Formspree. The alert form sends your email address, your threshold and the location you selected, rounded to about one kilometre. We use this only to reply or send aurora alerts, and never sell or share it. To have it removed, use the <a href="contact.html">contact form</a>.')),
        card('location', 'Location', para('“Use my location” asks your browser for a position only when you press it. The coordinates are rounded to about one kilometre before they are used, and are remembered only if you opted in to saved preferences.')),
        card('your-choices', 'Your choices', list(['Choose “Essential only” in the privacy banner to store no preferences at all', 'Reopen the banner any time from “Privacy choices” in the homepage footer', 'Clear this site’s data in your browser settings to reset everything']))),
      `      <div class="page-note">We do not use advertising cookies, tracking pixels, fingerprinting or third-party fonts. If this ever changes, this page will say so first.</div>`].join('\n\n'),
  },
  {
    file: 'cookies.html',
    title: 'Cookies and Browser Storage | Aurora Hunt',
    desc: 'Aurora Hunt uses one session cookie and a small amount of local storage for your consent choice and optional preferences. No advertising or tracking cookies.',
    crumbs: [['Cookies']],
    body: [
      hero('Cookies', 'One small cookie, <em>no maze.</em>', 'Aurora Hunt sets no advertising or tracking cookies. Here is everything the site can store in your browser.'),
      grid(
        card('what-we-store', 'What is stored', list([
          '<strong>aurora_consent_session</strong> (session cookie) — remembers that you answered the privacy banner; deleted when you close the browser',
          '<strong>aurora-consent-v1</strong> (local storage) — your consent choice',
          '<strong>aurora-forecast-v1</strong> (local storage, opt-in only) — theme, alert threshold, map view and chosen location',
          '<strong>Offline cache</strong> — a copy of the site’s own files so it loads fast and works offline'])),
        card('why-its-stored', 'Why', list(['So the privacy banner is not shown on every page', 'So your location and theme are still there next visit, if you asked for that', 'So the page opens instantly on a slow connection']))),
      `      <div class="page-note">Pressing play on a webcam loads a YouTube player in privacy-enhanced mode, which may set its own storage. Nothing from YouTube loads before you press play. See the <a href="privacy.html">privacy policy</a> for the full list of services.</div>`].join('\n\n'),
  },
  {
    file: 'terms.html',
    title: 'Terms of Use | Aurora Hunt',
    desc: 'The terms for using Aurora Hunt: a free aurora forecast offered as guidance, with no guarantee that the northern lights will appear.',
    crumbs: [['Terms']],
    body: [
      hero('Terms', 'Simple terms for a <em>simple site.</em>', 'Use Aurora Hunt as a helpful forecast and planning tool. Don’t abuse the forms or overload the services it relies on.'),
      grid(
        card('', 'Acceptable use', para('Use the site lawfully and avoid automated abuse, scraping, or attempts to disrupt the service.')),
        card('', 'Third-party services', para('Space weather comes from NOAA, weather from Open-Meteo, video from YouTube and form delivery from Formspree. Each has its own terms, and any of them can be unavailable at times.'))),
      `      <section class="card page-card">
          <h2>Limitations</h2>
${list(['Forecasts are guidance, not a guarantee — aurora and weather are unpredictable', 'Do not rely on the site for safety decisions; winter travel needs its own planning', 'Tour operators are independent businesses; we do not vouch for or sell their services', 'Features may change or be withdrawn over time'])}
      </section>`].join('\n\n'),
  },
  {
    file: '404.html', index: false, abs: true,
    title: 'Page not found · Aurora Hunt',
    desc: 'That page could not be found on Aurora Hunt.',
    crumbs: null,
    body: [
      hero('404', 'That page drifted off into the <em>night.</em>', 'The link may be old or mistyped. The forecast is still right where you left it.'),
      `      <nav class="page-toc" aria-label="Quick links">
        <a href="/index.html#forecast">Tonight’s forecast</a>
        <a href="/index.html#planner">Planner</a>
        <a href="/index.html#map">Aurora map</a>
        <a href="/index.html#faq">FAQ</a>
      </nav>`].join('\n\n'),
  },
  {
    file: '500.html', index: false, abs: true,
    title: 'Something went wrong · Aurora Hunt',
    desc: 'Aurora Hunt hit an unexpected error.',
    crumbs: null,
    body: [
      hero('Error', 'A cloud rolled in on <em>our side.</em>', 'Something went wrong loading this page. Please try again in a moment.'),
      `      <nav class="page-toc" aria-label="Quick links">
        <a href="/index.html">Back to the forecast</a>
        <a href="/contact.html">Report a problem</a>
      </nav>`].join('\n\n'),
  },
];
for (const p of pages) { fs.writeFileSync(path.join(out, p.file), page(p)); console.log('wrote', p.file); }
