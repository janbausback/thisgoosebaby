#!/usr/bin/env node
/**
 * Renders src/*.html into public/ — inlining the critical CSS and the SVGs,
 * and resolving every /assets/* URL to its content-hashed filename so the
 * whole directory can be served immutable.
 */
import fs from 'node:fs';
import path from 'node:path';
import { SRC, PUBLIC, ASSETS, writeHashed, readManifest, mergeManifest, kb } from './lib/manifest.mjs';

const manifest = readManifest();
const warnings = [];

/* ── SVG ──────────────────────────────────────────────────────────────────
   Source files carry hard-coded fills and strokes from the export; strip them
   so the mark takes its colour from CSS. Coordinates are rounded to one
   decimal, which is well below a pixel at any size we render at. */

function cleanSvg(raw, { viewBox } = {}) {
  let s = raw
    .replace(/<\?xml[\s\S]*?\?>/g, '')
    .replace(/<!DOCTYPE[\s\S]*?>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<title>[\s\S]*?<\/title>/gi, '')
    .replace(/<desc>[\s\S]*?<\/desc>/gi, '')
    .replace(/\s(?:fill|stroke|stroke-width|stroke-linecap|stroke-linejoin|style)="[^"]*"/g, '')
    .replace(/\sxmlns:[a-z]+="[^"]*"/g, '')
    .replace(/\sversion="[^"]*"/g, '')
    .replace(/\s(?:width|height)="[\d.]+(?:in|px|pt|mm|cm)?"/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  s = s.replace(/-?\d+\.\d+/g, (n) => String(Math.round(parseFloat(n) * 10) / 10));

  if (viewBox) s = s.replace(/viewBox="[^"]*"/, `viewBox="${viewBox}"`);
  if (!/viewBox=/.test(s)) warnings.push('an SVG has no viewBox — it will not scale');

  return s.replace(
    /^<svg/,
    '<svg fill="currentColor" aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMid meet"'
  );
}

/** macOS writes filenames in NFD; a literal "ö" in source will not match. */
function findAsset(re) {
  const dir = path.join(SRC, 'assets');
  const hit = fs.readdirSync(dir).find((f) => re.test(f.normalize('NFC')));
  return hit ? path.join(dir, hit) : null;
}

const wordmarkFile = findAsset(/^studio kolchina & gordon\.svg$/i);
const zwischenFile = findAsset(/^zwischent[öo]ne[_-]?vector\.svg$/i);

const svgs = {};

if (wordmarkFile) {
  // The export leaves the artwork in the lower-right of a much larger canvas.
  // Tightened to the ink bounds so the square can be sized from the wordmark.
  svgs.wordmark = cleanSvg(fs.readFileSync(wordmarkFile, 'utf8'), { viewBox: '1585 824 1633 1055' });
} else {
  warnings.push('Studio Kolchina & Gordon.svg not found');
  svgs.wordmark = '<svg viewBox="0 0 100 65" aria-hidden="true"></svg>';
}

if (zwischenFile) {
  svgs.zwischentoene = cleanSvg(fs.readFileSync(zwischenFile, 'utf8'));
} else {
  // PLACEHOLDER — replaced automatically once Zwischentöne_vector.svg is added
  // to src/assets and `npm run build` is re-run.
  warnings.push(
    'Zwischentöne_vector.svg not found in src/assets — the top-left mark is\n' +
    '  rendering as live text. Drop the SVG in and re-run `npm run build`.'
  );
  svgs.zwischentoene =
    '<span class="mark-fallback" data-placeholder="Zwischentöne_vector.svg">Zwischentöne</span>';
}

svgs.instagram =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
  '<rect x="2.5" y="2.5" width="19" height="19" rx="5.4"/>' +
  '<circle cx="12" cy="12" r="4.3"/>' +
  '<circle cx="17.6" cy="6.4" r="1.15" fill="currentColor" stroke="none"/></svg>';

/* ── CSS and JS ───────────────────────────────────────────────────────────── */

/**
 * Whitespace-only minification.
 *
 * Note which characters are NOT in the strip set: `:` most of all. Collapsing
 * the space around it rewrites `.shell :is(button, a)` — a descendant selector —
 * into `.shell:is(button, a)`, which matches nothing, and does it silently.
 * The handful of bytes this leaves on the table disappear under Brotli anyway.
 */
const squish = (css) =>
  css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s*([{};,>])\s*/g, '$1')
    .replace(/;}/g, '}')
    .replace(/\s+/g, ' ')
    .trim();

const critical = squish(fs.readFileSync(path.join(SRC, 'css', 'critical.css'), 'utf8'));

const ogUrl = manifest.og?.src ?? '/assets/og-image.jpg';

const mainCss = writeHashed('main', 'css', Buffer.from(squish(fs.readFileSync(path.join(SRC, 'css', 'main.css'), 'utf8'))));
const mainJs = writeHashed('main', 'js', fs.readFileSync(path.join(SRC, 'js', 'main.js')));

/* ── JSON-LD ────────────────────────────────────────────────────────────── */

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  .map((d) => `https://schema.org/${d}`);

const jsonld = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': 'https://kolchinagordon.com/#website',
      url: 'https://kolchinagordon.com/',
      name: 'Studio Kolchina & Gordon',
      inLanguage: 'en',
      publisher: { '@id': 'https://kolchinagordon.com/#organization' },
    },
    {
      '@type': 'Organization',
      '@id': 'https://kolchinagordon.com/#organization',
      name: 'Studio Kolchina & Gordon',
      url: 'https://kolchinagordon.com/',
      email: 'hello@kolchinagordon.com',
      telephone: '+4915221465761',
      address: {
        '@type': 'PostalAddress',
        streetAddress: 'Eisenbahnstraße 5',
        postalCode: '10997',
        addressLocality: 'Berlin',
        addressCountry: 'DE',
      },
    },
    {
      '@type': 'ExhibitionEvent',
      '@id': 'https://kolchinagordon.com/#exhibition',
      name: 'Zwischentöne',
      description:
        'A temporary installation by Clara Twele and Galina Kolchina at the intersection of design, art and architecture. Open Monday to Saturday, 14:00–20:00. Closed Sundays.',
      startDate: '2026-09-09T14:00:00+02:00',
      endDate: '2026-09-30T20:00:00+02:00',
      eventStatus: 'https://schema.org/EventScheduled',
      eventSchedule: {
        '@type': 'Schedule',
        startDate: '2026-09-09',
        endDate: '2026-09-30',
        startTime: '14:00:00',
        endTime: '20:00:00',
        byDay: DAYS,
        repeatFrequency: 'P1W',
        scheduleTimezone: 'Europe/Berlin',
      },
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      inLanguage: 'en',
      isAccessibleForFree: true,
      image: [`https://kolchinagordon.com${ogUrl}`],
      url: 'https://kolchinagordon.com/',
      location: {
        '@type': 'Place',
        name: 'Eisenbahnstraße 5',
        address: {
          '@type': 'PostalAddress',
          streetAddress: 'Eisenbahnstraße 5',
          postalCode: '10997',
          addressLocality: 'Berlin',
          addressRegion: 'Berlin',
          addressCountry: 'DE',
        },
      },
      organizer: { '@id': 'https://kolchinagordon.com/#organization' },
      performer: [
        { '@type': 'Person', name: 'Clara Twele' },
        { '@type': 'Person', name: 'Galina Kolchina' },
      ],
    },
  ],
};

/* ── Token replacement ────────────────────────────────────────────────────── */

function render(html) {
  return html.replace(/\{\{([a-z]+):?([a-zA-Z0-9_-]*)\}\}/g, (whole, kind, name) => {
    switch (kind) {
      case 'critical': return critical;
      case 'css': return mainCss.url;
      case 'js': return mainJs.url;
      case 'svg': {
        if (!svgs[name]) { warnings.push(`unknown svg token: ${whole}`); return ''; }
        return svgs[name];
      }
      case 'og': return ogUrl;
      case 'jsonld': return JSON.stringify(jsonld);
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
for (const page of ['index.html', 'imprint.html', 'privacy.html']) {
  const out = render(fs.readFileSync(path.join(SRC, page), 'utf8'));
  fs.writeFileSync(path.join(PUBLIC, page), out);
  console.log(`  ${page.padEnd(16)} ${kb(Buffer.byteLength(out))}`);
}

for (const f of ['robots.txt', 'sitemap.xml', 'site.webmanifest']) {
  const p = path.join(SRC, f);
  if (!fs.existsSync(p)) continue;
  fs.writeFileSync(path.join(PUBLIC, f), render(fs.readFileSync(p, 'utf8')));
  console.log(`  ${f.padEnd(16)} copied`);
}

mergeManifest({ css: { src: mainCss.url }, js: { src: mainJs.url } });

console.log(`  ${'main.css'.padEnd(16)} ${kb(mainCss.bytes)}\n  ${'main.js'.padEnd(16)} ${kb(mainJs.bytes)}`);
console.log(`  ${'critical (inline)'.padEnd(16)} ${kb(Buffer.byteLength(critical))}`);

if (warnings.length) {
  console.warn('\n⚠  ' + warnings.join('\n⚠  '));
}
