#!/usr/bin/env node
/**
 * Raster pipeline: every photograph becomes responsive, content-hashed WebP.
 * Output lands in public/assets and is committed, so a deploy needs no build.
 *
 * Sources are the JPEG masters in src/assets/photos — upright, 2400px on the
 * long edge, cut down from the camera originals in the project's Default
 * folder (see README → Photographs). Stale files are pruned by build-html,
 * which runs last.
 */
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { SRC, writeHashed, mergeManifest, kb } from './lib/manifest.mjs';

const IN = path.join(SRC, 'assets', 'photos');

/**
 * Widths are chosen per use, from the size each picture is actually drawn at:
 *
 *   hero   51vw on a phone (191–219px), so 720w covers a 3× screen; 1080w is
 *          for a desktop, where the height governs and it reaches ~450px.
 *   about  floated four lines tall in the studio text: ~150px on a phone,
 *          ~380px on a desktop.
 *   zw     full column width on a phone (~345px, so 1080w at 3×), a third of
 *          the page on a desktop.
 *
 * Photographs, not flat fields, so the quality sits higher than the rugs and
 * the woven ground of the old exhibition page did (q52 there).
 */
const PHOTOS = [
  { key: 'hero1', file: 'hero-1.jpg', widths: [480, 720, 1080] },
  { key: 'hero2', file: 'hero-2.jpg', widths: [480, 720, 1080] },
  { key: 'hero3', file: 'hero-3.jpg', widths: [480, 720, 1080] },
  { key: 'about', file: 'about.jpg', widths: [480, 960] },
  { key: 'zw1', file: 'zwischentoene-1.jpg', widths: [480, 720, 1080] },
  { key: 'zw2', file: 'zwischentoene-2.jpg', widths: [480, 720, 1080] },
  { key: 'zw3', file: 'zwischentoene-3.jpg', widths: [480, 720, 1080] },
];
const QUALITY = 74;

/** Widest-last srcset entry set; `src` and the intrinsic size are the widest. */
async function emit(name, widths, make) {
  const out = { widths: {}, srcset: '' };
  const parts = [];
  for (const w of widths) {
    const buf = await make(w);
    const meta = await sharp(buf).metadata();
    const { url, bytes } = writeHashed(`${name}-${w}`, 'webp', buf);
    out.widths[w] = url;
    if (w === widths.at(-1)) { out.w = meta.width; out.h = meta.height; }
    parts.push(`${url} ${meta.width}w`);
    console.log(`  ${name}-${w}`.padEnd(24), `${meta.width}×${meta.height}`.padEnd(12), kb(bytes));
  }
  out.srcset = parts.join(', ');
  out.src = out.widths[widths.at(-1)];
  return out;
}

const patch = {};
for (const { key, file, widths } of PHOTOS) {
  const source = path.join(IN, file);
  if (!fs.existsSync(source)) {
    console.log(`${key}: src/assets/photos/${file} missing, skipped`);
    continue;
  }
  console.log(key);
  // rotate() with no angle applies any EXIF orientation, so a master that was
  // exported sideways-with-a-flag still comes out upright.
  patch[key] = await emit(key, widths, (w) =>
    sharp(source)
      .rotate()
      .resize({ width: w, withoutEnlargement: true })
      .webp({ quality: QUALITY, effort: 6, smartSubsample: true })
      .toBuffer()
  );
}

mergeManifest(patch);

const total = Object.values(patch).reduce((sum, a) => sum + Object.keys(a.widths).length, 0);
console.log(`\n${total} file(s) written to public/assets`);
