#!/usr/bin/env node
/**
 * Renders src/*.html into public/ — inlining the CSS and SVGs, filling in the
 * shared header and footer, and resolving every /assets/* URL to its
 * content-hashed filename so the whole directory can be served immutable.
 *
 * Two shapes of page. `/` is the landing: the photographs in the middle, the
 * marquee across them, the studio text below. Everything else is a plain
 * subpage. Each gets only the CSS it paints, inlined, so no page waits on a
 * stylesheet request.
 *
 * Runs last in `npm run build`, so it is also where stale assets are pruned:
 * by now every step has written its entries into the manifest.
 */
import fs from 'node:fs';
import path from 'node:path';
import { SRC, PUBLIC, writeHashed, readManifest, mergeManifest, prune, kb } from './lib/manifest.mjs';

const SITE = 'https://kolchinagordon.com';
const PAGES = ['index.html', 'on-view.html', 'previous-projects.html', 'contact.html', 'privacy.html'];

const manifest = readManifest();
const warnings = [];

/* ── SVG ────────────────────────────────────────────────────────────────── */

const svgs = {
  instagram:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
    '<rect x="2.5" y="2.5" width="19" height="19" rx="5.4"/>' +
    '<circle cx="12" cy="12" r="4.3"/>' +
    '<circle cx="17.6" cy="6.4" r="1.15" fill="currentColor" stroke="none"/></svg>',
};

/* ── CSS and JS ─────────────────────────────────────────────────────────── */

/**
 * Whitespace-only minification.
 *
 * Note which characters are NOT in the strip set: `:` most of all. Collapsing
 * the space around it rewrites `.small :is(h2, h3)` — a descendant selector —
 * into `.small:is(h2, h3)`, which matches nothing, and does it silently.
 * The handful of bytes this leaves on the table disappear under Brotli anyway.
 */
const squish = (css) =>
  css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s*([{};,>])\s*/g, '$1')
    .replace(/;}/g, '}')
    .replace(/\s+/g, ' ')
    .trim();

const readCss = (f) => squish(fs.readFileSync(path.join(SRC, 'css', f), 'utf8'));

const base = readCss('critical.css');
const homeCss = readCss('home.css');
const pageCss = readCss('page.css');
const CRITICAL = Object.fromEntries(
  PAGES.map((p) => [p, base + (p === 'index.html' ? homeCss : pageCss)])
);

// Every script in src/js is hashed and exposed as {{js:<basename>}}, so a page
// pulls in only the behaviour it actually has.
const js = {};
for (const f of fs.readdirSync(path.join(SRC, 'js')).sort()) {
  if (!f.endsWith('.js')) continue;
  js[f.replace(/\.js$/, '')] = writeHashed(f.replace(/\.js$/, ''), 'js', fs.readFileSync(path.join(SRC, 'js', f)));
}

/* ── Header and footer ──────────────────────────────────────────────────── */

// The menu, in order. The current page is marked, not removed, so the list
// reads the same from every page.
const MENU = [
  ['/on-view.html', 'On View'],
  ['/previous-projects.html', 'Previous Projects'],
  ['/contact.html', 'Contact'],
];

function header(page) {
  // --i staggers the links in from the top down.
  const items = MENU.map(([href, label], i) => {
    const current = href === `/${page}` ? ' aria-current="page"' : '';
    return `<li style="--i:${i}"><a href="${href}"${current}>${label}</a></li>`;
  }).join('');
  // On `/` the marquee already says the name; everywhere else it is the way home.
  const home = page === 'index.html' ? '' : '<a class="top__home" href="/">Studio Kolchina &amp; Gordon</a>';
  // The button comes before the links so focus moves from it into them; the
  // CSS draws the links to its left.
  return (
    '<header class="top">' +
    home +
    '<button class="burger" type="button" aria-expanded="false" aria-controls="menu" aria-label="Menu">' +
    '<span></span><span></span></button>' +
    `<nav class="menu" id="menu" aria-label="Main"><ul>${items}</ul></nav>` +
    '</header>'
  );
}

// The imprint lives on the contact page now; this keeps it one tap from
// anywhere, which is what § 5 DDG's "unmittelbar erreichbar" asks for.
const FOOTER =
  '<footer class="foot">' +
  '<p>Studio Kolchina &amp; Gordon<span aria-hidden="true"> · </span><br class="foot__break">Eisenbahnstraße 5, 10997 Berlin</p>' +
  '<nav aria-label="Legal"><a href="/contact.html#impressum">Impressum</a><a href="/privacy.html">Datenschutz</a></nav>' +
  '</footer>';

/* ── Social card ────────────────────────────────────────────────────────── */

const ogUrl = manifest.og?.src ?? '/assets/og-image.jpg';
const OG_ALT =
  'A photograph of the studio on white, with “Studio Kolchina &amp; Gordon” running across it in purple.';

/* ── JSON-LD ────────────────────────────────────────────────────────────── */

const abs = (url) => `${SITE}${url}`;
const day = (d) => `https://schema.org/${d}`;
const ALL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day);
const THU_SAT = ['Thursday', 'Friday', 'Saturday'].map(day);

const address = {
  '@type': 'PostalAddress',
  streetAddress: 'Eisenbahnstraße 5',
  postalCode: '10997',
  addressLocality: 'Berlin',
  addressRegion: 'Berlin',
  addressCountry: 'DE',
};

const organization = {
  '@type': 'Organization',
  '@id': `${SITE}/#organization`,
  name: 'Studio Kolchina & Gordon',
  url: `${SITE}/`,
  description:
    'An art studio and collaborative project based in Berlin, working at the intersection of art, design and science.',
  email: 'hello@kolchinagordon.com',
  telephone: '+4915221465761',
  address,
  sameAs: 'https://www.instagram.com/studio.kolchina.gordon/',
  founder: [
    {
      '@type': 'Person',
      name: 'Galina Kolchina',
      jobTitle: 'Visual artist and curator',
      sameAs: 'https://www.instagram.com/_kolchina_/',
    },
    {
      '@type': 'Person',
      name: 'Liam Gordon',
      jobTitle: 'Composer and musician',
      sameAs: 'https://www.instagram.com/liamgordon__/',
    },
  ],
  image: abs(ogUrl),
};

const website = {
  '@type': 'WebSite',
  '@id': `${SITE}/#website`,
  url: `${SITE}/`,
  name: 'Studio Kolchina & Gordon',
  inLanguage: 'en',
  publisher: { '@id': organization['@id'] },
};

const webPage = (type, file, name) => ({
  '@type': type,
  '@id': `${SITE}/${file}`,
  url: `${SITE}/${file}`,
  name,
  inLanguage: 'en',
  isPartOf: { '@id': website['@id'] },
  about: { '@id': organization['@id'] },
});

// The exhibition is over, but it ran as scheduled, so EventScheduled stands;
// the dates are what say it is past. Two runs of hours, hence two Schedules:
// the opening days were daily and longer, the rest of the month Thursday to
// Saturday, shorter.
const zwischentoene = {
  '@type': 'ExhibitionEvent',
  '@id': `${SITE}/previous-projects.html#zwischentoene`,
  name: 'Zwischentöne',
  description:
    'A temporary installation by Clara Twele and Galina Kolchina at the intersection of design, art and architecture, held together by a soundscape.',
  startDate: '2026-09-09T14:00:00+02:00',
  endDate: '2026-09-30T19:00:00+02:00',
  eventStatus: 'https://schema.org/EventScheduled',
  eventSchedule: [
    {
      '@type': 'Schedule',
      startDate: '2026-09-10',
      endDate: '2026-09-13',
      startTime: '14:00:00',
      endTime: '20:00:00',
      byDay: ALL_DAYS,
      repeatFrequency: 'P1D',
      scheduleTimezone: 'Europe/Berlin',
    },
    {
      '@type': 'Schedule',
      startDate: '2026-09-14',
      endDate: '2026-09-30',
      startTime: '15:00:00',
      endTime: '19:00:00',
      byDay: THU_SAT,
      repeatFrequency: 'P1W',
      scheduleTimezone: 'Europe/Berlin',
    },
  ],
  eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
  inLanguage: 'en',
  isAccessibleForFree: true,
  image: ['zw1', 'zw2', 'zw3'].filter((k) => manifest[k]).map((k) => abs(manifest[k].src)),
  url: `${SITE}/previous-projects.html#zwischentoene`,
  location: { '@type': 'Place', name: 'Studio Kolchina & Gordon', address },
  organizer: { '@id': organization['@id'] },
  performer: [
    { '@type': 'Person', name: 'Clara Twele' },
    { '@type': 'Person', name: 'Galina Kolchina' },
  ],
};

const graph = (...nodes) => ({ '@context': 'https://schema.org', '@graph': nodes });

const JSONLD = {
  'index.html': graph(website, organization),
  'on-view.html': graph(webPage('WebPage', 'on-view.html', 'On View'), organization),
  'previous-projects.html': graph(
    { ...webPage('CollectionPage', 'previous-projects.html', 'Previous Projects'), hasPart: { '@id': zwischentoene['@id'] } },
    zwischentoene,
    organization
  ),
  'contact.html': graph(
    { ...webPage('ContactPage', 'contact.html', 'Contact'), mainEntity: { '@id': organization['@id'] } },
    organization
  ),
};

/* ── Token replacement ──────────────────────────────────────────────────── */

function render(html, page) {
  return html.replace(/\{\{([a-z]+):?([a-zA-Z0-9_-]*)\}\}/g, (whole, kind, name) => {
    switch (kind) {
      case 'critical': {
        const css = CRITICAL[page];
        if (!css) { warnings.push(`no critical CSS mapped for ${page}`); return ''; }
        return css;
      }
      case 'header': return header(page);
      case 'footer': return FOOTER;
      case 'js': {
        if (!js[name]) { warnings.push(`unknown script: ${whole} in ${page}`); return ''; }
        return js[name].url;
      }
      case 'svg': {
        if (!svgs[name]) { warnings.push(`unknown svg token: ${whole}`); return ''; }
        return svgs[name];
      }
      case 'og': return name === 'alt' ? OG_ALT : ogUrl;
      case 'jsonld': {
        if (!JSONLD[page]) { warnings.push(`no JSON-LD mapped for ${page}`); return '{}'; }
        return JSON.stringify(JSONLD[page]);
      }
      case 'src': case 'srcset': case 'w': case 'h': {
        const a = manifest[name];
        if (!a) { warnings.push(`missing asset in manifest: ${name}`); return ''; }
        return kind === 'src' ? a.src : kind === 'srcset' ? a.srcset : String(kind === 'w' ? a.w : a.h);
      }
      default: warnings.push(`unknown token: ${whole}`); return '';
    }
  });
}

fs.mkdirSync(PUBLIC, { recursive: true });
for (const page of PAGES) {
  const out = render(fs.readFileSync(path.join(SRC, page), 'utf8'), page);
  fs.writeFileSync(path.join(PUBLIC, page), out);
  console.log(`  ${page.padEnd(26)} ${kb(Buffer.byteLength(out))}`);
}

for (const f of ['robots.txt', 'sitemap.xml', 'site.webmanifest']) {
  const p = path.join(SRC, f);
  if (!fs.existsSync(p)) continue;
  fs.writeFileSync(path.join(PUBLIC, f), render(fs.readFileSync(p, 'utf8'), f));
  console.log(`  ${f.padEnd(26)} copied`);
}

// One key per script. Keys for scripts that no longer exist are cleared, or
// prune() below would treat their orphaned files as still referenced —
// JSON.stringify drops undefined, so this removes the key rather than nulling it.
const stale = Object.keys(manifest).filter((k) => k.startsWith('js_') && !js[k.slice(3)]);
const next = mergeManifest({
  ...Object.fromEntries(stale.map((k) => [k, undefined])),
  ...Object.fromEntries(Object.entries(js).map(([n, o]) => [`js_${n}`, { src: o.url }])),
});

for (const [n, o] of Object.entries(js)) console.log(`  ${`${n}.js`.padEnd(26)} ${kb(o.bytes)}`);
for (const [p, c] of Object.entries(CRITICAL)) {
  console.log(`  ${`critical → ${p}`.padEnd(26)} ${kb(Buffer.byteLength(c))}`);
}

const removed = prune(next);
if (removed.length) console.log(`\n  pruned ${removed.length} stale file(s)`);

if (warnings.length) {
  console.warn('\n⚠  ' + warnings.join('\n⚠  '));
  process.exitCode = 1;
}
