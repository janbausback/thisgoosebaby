#!/usr/bin/env node
/**
 * Raster pipeline: every source image becomes responsive, content-hashed WebP.
 * Output lands in public/assets and is committed, so a deploy needs no build.
 */
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { SRC, writeHashed, mergeManifest, prune, kb } from './lib/manifest.mjs';

const IN = path.join(SRC, 'assets');
const src = (f) => path.join(IN, f);
const has = (f) => fs.existsSync(src(f));

/** Widest-first srcset entry set. */
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

// ── Hero poster ─────────────────────────────────────────────────────────
// Painted immediately behind the video — the poster attribute alone is not
// enough, since some browsers only honour it after the element has loaded
// metadata. A plain <img> beneath the video is always there from first paint,
// whether or not autoplay is allowed to proceed.
if (has('video/ledder-poster.jpg')) {
  console.log('hero poster');
  patch.poster = await emit('poster', [480, 960, 1440], (w) =>
    sharp(src('video/ledder-poster.jpg')).resize({ width: w }).webp({ quality: 68, effort: 6 }).toBuffer()
  );
}

// ── Hero video ─────────────────────────────────────────────────────────
// Not raster, so sharp cannot touch it: the file is re-encoded once by hand
// (H.264, crf 28, no audio track, +faststart) before being dropped in here,
// then just content-hashed and copied like everything else in public/assets.
//
// Keep +faststart on any replacement — without it the moov atom lands after
// the payload and nothing plays until the whole file has arrived. It is
// portrait (540×960) to match ledder-poster.jpg, which is the frame actually
// on screen until the video fades in; rotating one without the other makes
// the shopfront swing 90° at the handover.
if (has('video/ledder.mp4')) {
  const buf = fs.readFileSync(src('video/ledder.mp4'));
  const out = writeHashed('hero', 'mp4', buf);
  patch.video = { src: out.url };
  console.log('hero video'.padEnd(24) + `${kb(out.bytes)}`.padStart(12));
}

const manifest = mergeManifest(patch);
const removed = prune(manifest);
if (removed.length) console.log(`\npruned ${removed.length} stale file(s)`);

const total = (patch.poster ? Object.keys(patch.poster.widths).length : 0) + (patch.video ? 1 : 0);
console.log(`\n${total} file(s) written to public/assets`);
