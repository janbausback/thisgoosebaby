#!/usr/bin/env node
/**
 * Social preview image (OG/Twitter, 1200×630): the landing page in miniature —
 * the first hero photograph on white with the studio's name running across its
 * middle in the site's purple. Composed here rather than screenshotted, so it
 * needs no browser.
 *
 * The type is rendered by librsvg through fontconfig, so it is set in whatever
 * the build machine resolves "Helvetica Neue" to. On a Mac that is the real
 * thing; elsewhere it falls back to Arial or the system sans.
 */
import sharp from 'sharp';
import path from 'node:path';
import { SRC, writeHashed, mergeManifest, kb } from './lib/manifest.mjs';

const W = 1200;
const H = 630;
const PURPLE = '#b26dd4';

// Same proportions as the phone layout: picture about 3/4 of the card's
// height, type about a twelfth of the picture's height.
const photoH = 470;
const photoW = Math.round((photoH * 3) / 4);
const size = 38;
const unit = 'STUDIO KOLCHINA &amp; GORDON&#160;•&#160;';

const photo = await sharp(path.join(SRC, 'assets', 'photos', 'hero-1.jpg'))
  .rotate()
  .resize(photoW, photoH, { fit: 'cover' })
  .toBuffer();

// Caps centred on the card's middle: baseline sits half a cap height (0.357em
// in Helvetica) below it. Starts left of the edge so the line runs off both
// sides, as the moving one does.
const type = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">` +
    `<text x="-96" y="${H / 2 + size * 0.357}" xml:space="preserve" fill="${PURPLE}" ` +
    `font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-weight="700" ` +
    `font-size="${size}" letter-spacing="${-0.01 * size}">${unit.repeat(4)}</text></svg>`
);

const jpg = await sharp({ create: { width: W, height: H, channels: 3, background: '#ffffff' } })
  .composite([
    { input: photo, left: Math.round((W - photoW) / 2), top: Math.round((H - photoH) / 2) },
    { input: type, left: 0, top: 0 },
  ])
  .jpeg({ quality: 86, mozjpeg: true })
  .toBuffer();

const out = writeHashed('og-image', 'jpg', jpg);
mergeManifest({ og: { src: out.url, w: W, h: H } });

console.log(`  ${out.file}  ${W}×${H}  ${kb(out.bytes)}`);
