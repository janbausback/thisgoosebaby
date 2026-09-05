#!/usr/bin/env node
/**
 * Favicons, derived from the Zwischentöne mark on the site background.
 *
 * The mark is a single-line wordmark at roughly 6.8:1. Squeezed into a 32 px
 * tile it is four pixels tall and unreadable, so the icons are cut down to its
 * own leading Z — found by scanning the artwork, not redrawn.
 */
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { SRC, PUBLIC, writeHashed, mergeManifest, kb } from './lib/manifest.mjs';

const BG = '#37161d';

function findAsset(re) {
  const dir = path.join(SRC, 'assets');
  const hit = fs.readdirSync(dir).find((f) => re.test(f.normalize('NFC')));
  return hit ? path.join(dir, hit) : null;
}

const zwischen = findAsset(/^zwischent[öo]ne[_-]?vector\.svg$/i);
const wordmark = findAsset(/^studio kolchina & gordon\.svg$/i);
const source = zwischen ?? wordmark;

if (!source) {
  console.error('No mark SVG found in src/assets — cannot build icons.');
  process.exit(1);
}
if (!zwischen) {
  console.warn('⚠  Zwischentöne_vector.svg not found; icons derived from the Studio');
  console.warn('⚠  wordmark as a stand-in. Re-run once the real mark is added.');
}

/** Strip the export's fills and physical dimensions so it paints white and
    rasterises from the viewBox rather than at 9 inches wide. */
const markSvg = fs
  .readFileSync(source, 'utf8')
  .replace(/<\?xml[\s\S]*?\?>/g, '')
  .replace(/<title>[\s\S]*?<\/title>/gi, '')
  .replace(/\s(?:fill|stroke|stroke-width)="[^"]*"/g, '')
  .replace(/\s(?:width|height)="[\d.]+(?:in|px|pt|mm|cm)?"/g, '')
  .replace(/<svg/, '<svg fill="#ffffff"')
  .replace(/viewBox="0 0 4161 2320"/, 'viewBox="1585 824 1633 1055"'); // Studio wordmark ink bounds

const [vx, vy, vw, vh] = /viewBox="([^"]+)"/.exec(markSvg)[1].split(/\s+/).map(Number);

/**
 * Bounding box of the leading Z, plus the neighbouring ink that overlaps it.
 *
 * Three things that do not work, for the record: the first empty column arrives
 * only after "Zwis", because those letters are kerned tightly enough to share
 * columns; no vertical cut separates Z from w, because the w's first stroke
 * starts before the Z's top bar ends; and a flood fill runs straight through
 * the whole word, because the letterforms actually touch.
 *
 * What does work: the Z's top bar is alone up at cap height, so the end of the
 * first run in the top band is the Z's right edge. Then, scanning leftward from
 * that edge, the w shows up as a run touching neither the top nor the bottom of
 * its column — the Z's diagonal has merged with its top bar by then, so it is
 * not mistaken for one. The first column with no such run ends the intrusion.
 */
async function leadingGlyph() {
  const W = 1600;
  const { data, info } = await sharp(Buffer.from(markSvg))
    .resize({ width: W }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: iw, height: ih, channels } = info;
  const ink = (x, y) => data[(y * iw + x) * channels + 3] > 8;
  const inkedIn = (x, a, b) => {
    for (let y = a; y < b; y++) if (ink(x, y)) return true;
    return false;
  };

  const band = Math.max(2, Math.round(ih * 0.12));
  let barStart = 0;
  while (barStart < iw && !inkedIn(barStart, 0, band)) barStart++;
  let x1 = barStart;
  while (x1 < iw && inkedIn(x1, 0, band)) x1++;

  let x0 = 0;
  while (x0 < iw && !inkedIn(x0, 0, ih)) x0++;

  const cols = [...Array(x1 - x0)].map((_, i) => x0 + i);
  let y0 = 0;
  while (y0 < ih && !cols.some((x) => ink(x, y0))) y0++;
  let y1 = ih - 1;
  while (y1 > y0 && !cols.some((x) => ink(x, y1))) y1--;

  /** Runs in one column that touch neither y0 nor y1. */
  const floating = (x) => {
    const out = [];
    let run = -1;
    for (let y = y0; y <= y1 + 1; y++) {
      const on = y <= y1 && ink(x, y);
      if (on && run < 0) run = y;
      else if (!on && run >= 0) {
        if (run > y0 && y - 1 < y1) out.push([run, y - 1]);
        run = -1;
      }
    }
    return out;
  };

  let ix0 = Infinity, iy0 = Infinity, ix1 = -1, iy1 = -1;
  for (let x = x1 - 1; x >= x0; x--) {
    const runs = floating(x);
    if (!runs.length) break;
    for (const [a, b] of runs) {
      if (x < ix0) ix0 = x; if (x > ix1) ix1 = x;
      if (a < iy0) iy0 = a; if (b > iy1) iy1 = b;
    }
  }

  const kx = vw / iw, ky = vh / ih;
  const box = (a, b, c, d) => ({ x: vx + a * kx, y: vy + b * ky, w: (c - a + 1) * kx, h: (d - b + 1) * ky });
  return { ...box(x0, y0, x1 - 1, y1), intruder: ix1 >= 0 ? box(ix0, iy0, ix1, iy1) : null };
}

// Only the wide single-line mark needs cutting down; the Studio wordmark is
// three stacked lines and already close to square.
const wide = vw / vh > 3;
const glyph = wide ? await leadingGlyph() : { x: vx, y: vy, w: vw, h: vh };

/** Square tile with the glyph centred and even padding around it. */
function tile(scale) {
  const side = Math.max(glyph.w, glyph.h) / scale;
  return { side, left: (side - glyph.w) / 2, top: (side - glyph.h) / 2 };
}

/**
 * The mark is one long path, so showing only the Z means clipping the rest
 * away. A nested <svg> viewport is not enough — librsvg does not reliably clip
 * one — so the glyph box is cut with an explicit clipPath.
 */
function tileSvg(scale) {
  const t = tile(scale);
  const g = glyph;
  const inner = markSvg
    .replace(/^[\s\S]*?<svg[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${t.side.toFixed(1)} ${t.side.toFixed(1)}">` +
    `<defs><mask id="g">` +
    `<rect x="${g.x.toFixed(1)}" y="${g.y.toFixed(1)}" width="${g.w.toFixed(1)}" height="${g.h.toFixed(1)}" fill="#fff"/>` +
    (g.intruder
      ? `<rect x="${g.intruder.x.toFixed(1)}" y="${g.intruder.y.toFixed(1)}" ` +
        `width="${g.intruder.w.toFixed(1)}" height="${g.intruder.h.toFixed(1)}" fill="#000"/>`
      : '') +
    `</mask></defs>` +
    `<rect width="${t.side.toFixed(1)}" height="${t.side.toFixed(1)}" fill="${BG}"/>` +
    `<g transform="translate(${(t.left - g.x).toFixed(1)} ${(t.top - g.y).toFixed(1)})">` +
    `<g mask="url(#g)" fill="#ffffff">${inner}</g></g></svg>`
  );
}

async function icon(size, scale) {
  return sharp(Buffer.from(tileSvg(scale)), { density: 300 })
    .resize({ width: size, height: size })
    .png({ compressionLevel: 9, palette: true })
    .toBuffer();
}

fs.mkdirSync(PUBLIC, { recursive: true });
const patch = {};

const appleTouch = await icon(180, 0.62);
fs.writeFileSync(path.join(PUBLIC, 'apple-touch-icon.png'), appleTouch);
console.log(`  apple-touch-icon.png       ${kb(appleTouch.length)}`);

// A bare 32×32 BMP-in-ICO — everything that still requests favicon.ico takes it,
// and it avoids a dependency for one 4 KB file.
const raw32 = await sharp(await icon(32, 0.68)).ensureAlpha().raw().toBuffer();
const bmp = Buffer.alloc(40 + 32 * 32 * 4 + 32 * 4);
bmp.writeUInt32LE(40, 0); bmp.writeInt32LE(32, 4); bmp.writeInt32LE(64, 8);
bmp.writeUInt16LE(1, 12); bmp.writeUInt16LE(32, 14); bmp.writeUInt32LE(32 * 32 * 4, 20);
for (let y = 0; y < 32; y++) {
  for (let x = 0; x < 32; x++) {
    const s = ((31 - y) * 32 + x) * 4;
    const d = 40 + (y * 32 + x) * 4;
    bmp[d] = raw32[s + 2]; bmp[d + 1] = raw32[s + 1]; bmp[d + 2] = raw32[s]; bmp[d + 3] = raw32[s + 3];
  }
}
const ico = Buffer.concat([
  Buffer.from([0, 0, 1, 0, 1, 0, 32, 32, 0, 0, 1, 0, 32, 0,
    ...new Uint8Array(new Uint32Array([bmp.length, 22]).buffer)]),
  bmp,
]);
fs.writeFileSync(path.join(PUBLIC, 'favicon.ico'), ico);
console.log(`  favicon.ico                ${kb(ico.length)}`);

// Scalable favicon: the same square tile, still vector.
const favSvg = tileSvg(0.68);
fs.writeFileSync(path.join(PUBLIC, 'favicon.svg'), favSvg);
console.log(`  favicon.svg                ${kb(Buffer.byteLength(favSvg))}`);

// Manifest icons are referenced by URL, so these can carry a content hash.
// The maskable variant sits smaller, inside the safe zone Android crops to.
for (const [key, name, size, scale] of [
  ['icon192', 'icon-192', 192, 0.62],
  ['icon512', 'icon-512', 512, 0.62],
  ['icon512m', 'icon-512-maskable', 512, 0.42],
]) {
  const out = writeHashed(name, 'png', await icon(size, scale));
  patch[key] = { src: out.url };
  console.log(`  ${out.file.padEnd(27)}${kb(out.bytes)}`);
}

mergeManifest(patch);
