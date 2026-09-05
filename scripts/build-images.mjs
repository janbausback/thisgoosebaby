#!/usr/bin/env node
/**
 * Raster pipeline: every source image becomes responsive, content-hashed WebP.
 * Output lands in public/assets and is committed, so a deploy needs no build.
 */
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { SRC, writeHashed, mergeManifest, prune, readManifest, kb } from './lib/manifest.mjs';

const IN = path.join(SRC, 'assets');
const src = (f) => path.join(IN, f);
const has = (f) => fs.existsSync(src(f));

/** Find a source by basename whatever its extension — the rugs arrive as
    PNG or WebP depending on where they were exported from. */
function find(base) {
  const hit = fs.readdirSync(IN).find(
    (f) => f.normalize('NFC').replace(/\.[^.]+$/, '').toLowerCase() === base.toLowerCase()
  );
  return hit ? path.join(IN, hit) : null;
}

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

// ── Site background ────────────────────────────────────────────────────────
// A near-flat woven texture: detail is imperceptible at display size, so this
// is compressed hard. The flat colour behind it paints instantly from CSS.
if (has('backgroud.png')) {
  console.log('background');
  patch.bg = await emit('bg', [480, 960, 1440], (w) =>
    sharp(src('backgroud.png'))
      .flatten({ background: '#37161d' })
      .resize({ width: w })
      .webp({ quality: 52, effort: 6, smartSubsample: true })
      .toBuffer()
  );
}

// ── Loading-screen square ──────────────────────────────────────────────────
// Pre-cropped to 1:1 from inside the rug's own edge, so no white margin creeps
// in and object-fit never has to discard downloaded pixels.
if (has('Teppich2_Delphinium_FULL_A-Single-Ply.webp')) {
  console.log('square (Delphinium)');
  const file = src('Teppich2_Delphinium_FULL_A-Single-Ply.webp');
  const trimmed = await sharp(file).trim({ threshold: 1 }).toBuffer();
  const { width, height } = await sharp(trimmed).metadata();
  // Inset well inside the woven edge: the rug's border fades softly into the
  // white ground, so a shallow crop leaves a pale seam along the sides.
  const side = Math.round(Math.min(width, height) * 0.9);
  const square = await sharp(trimmed)
    .extract({
      left: Math.round((width - side) / 2),
      top: Math.round((height - side) / 2),
      width: side,
      height: side,
    })
    .toBuffer();
  // Quality sits low on purpose: the rug is a near-flat woven field whose own
  // grain sets the noise floor, so q70 costs ~2.3× the bytes of q50 for 0.9 dB.
  patch.square = await emit('square', [480, 720, 960], (w) =>
    sharp(square).resize({ width: w }).webp({ quality: 50, effort: 6 }).toBuffer()
  );
}

/**
 * Crop an opaque rug photograph down to its flat woven field.
 *
 * These arrive shot on a white ground with knotted fringes along two edges. A
 * fixed inset either leaves a fringe showing or eats into the pile, because the
 * fringe depth differs per rug — so instead each row and column is scored by
 * how much of it matches the rug's dominant colour, and the crop keeps the
 * contiguous band where that stays above 90%.
 */
async function flatCore(buf) {
  const { dominant } = await sharp(buf).stats();
  const { data, info } = await sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: ch } = info;
  const near = (i) =>
    Math.abs(data[i] - dominant.r) + Math.abs(data[i + 1] - dominant.g) + Math.abs(data[i + 2] - dominant.b) < 120;

  const rowScore = (y) => {
    let n = 0;
    for (let x = 0; x < w; x++) if (near((y * w + x) * ch)) n++;
    return n / w;
  };
  const colScore = (x) => {
    let n = 0;
    for (let y = 0; y < h; y++) if (near((y * w + x) * ch)) n++;
    return n / h;
  };

  const scan = (n, score) => {
    let a = 0, b = n - 1;
    while (a < b && score(a) < 0.9) a++;
    while (b > a && score(b) < 0.9) b--;
    return [a, b];
  };
  const [top, bottom] = scan(h, rowScore);
  const [left, right] = scan(w, colScore);

  // A hair further in, so no softened edge pixel survives the downscale.
  const pad = Math.round(Math.min(w, h) * 0.01);
  const x = Math.min(left + pad, w - 2);
  const y = Math.min(top + pad, h - 2);
  return sharp(buf)
    .extract({
      left: x,
      top: y,
      width: Math.max(2, Math.min(right - pad, w - 1) - x),
      height: Math.max(2, Math.min(bottom - pad, h - 1) - y),
    })
    .toBuffer();
}

/**
 * GIMP's Gaussian softener: blur a copy of the layer and blend it back over the
 * original, Normal mode, at a fraction of full opacity. Sigma is a fraction of
 * the image's own width so the 480w and 960w files look identical once CSS has
 * scaled them to the same size on screen.
 *
 * The blend runs on premultiplied pixels. Blurring straight RGBA drags the RGB
 * of fully transparent pixels — black, in an exported cutout — in under the
 * edge, which rings every rug with a dark halo.
 */
const SOFTEN = { sigma: 5, opacity: 0.47, ref: 480 };

async function soften(buf, sigma, opacity) {
  const { data: o, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const n = width * height;

  const pre = Buffer.allocUnsafe(n * 4);
  for (let i = 0; i < n; i++) {
    const a = o[i * 4 + 3];
    pre[i * 4] = (o[i * 4] * a) / 255;
    pre[i * 4 + 1] = (o[i * 4 + 1] * a) / 255;
    pre[i * 4 + 2] = (o[i * 4 + 2] * a) / 255;
    pre[i * 4 + 3] = a;
  }
  const b = await sharp(pre, { raw: { width, height, channels: 4 } }).blur(sigma).raw().toBuffer();

  // Premultiplied `over`: out = S + D·(1 − Sa), S being the blurred layer at `opacity`.
  const out = Buffer.allocUnsafe(n * 4);
  for (let i = 0; i < n; i++) {
    const sa = (b[i * 4 + 3] / 255) * opacity;
    const inv = 1 - sa;
    const oa = o[i * 4 + 3];
    const a = b[i * 4 + 3] * opacity + oa * inv;
    for (let c = 0; c < 3; c++) {
      const px = b[i * 4 + c] * opacity + ((o[i * 4 + c] * oa) / 255) * inv;
      out[i * 4 + c] = a > 0 ? Math.min(255, (px * 255) / a) : 0;
    }
    out[i * 4 + 3] = a;
  }
  return sharp(out, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

// ── Drifting rugs ──────────────────────────────────────────────────────────
// Two shapes of source arrive here. A cutout carries its own alpha, and the
// transparent margin is most of the file and none of the picture, so it is
// trimmed to its alpha bounds. A flat photograph has no alpha and sits on the
// white studio ground, which would float a white rectangle over the burgundy —
// so it is cropped to inside the rug's own woven edge instead, the same way the
// loading screen's square is.
for (const n of [1, 2, 3]) {
  const file = find(`teppich${n}web`);
  if (!file) { console.log(`teppich${n}: missing, skipped`); continue; }

  const meta = await sharp(file).metadata();
  let source;
  if (meta.hasAlpha) {
    source = await sharp(file).trim({ threshold: 1 }).toBuffer();
    console.log(`teppich${n}  (cutout, trimmed to alpha)`);
  } else {
    source = await flatCore(await sharp(file).trim({ threshold: 1 }).toBuffer());
    console.log(`teppich${n}  (opaque photo, cropped to the flat weave)`);
  }

  // The softened edge fades outward, so it needs transparent room to fade into:
  // the rug is resized to leave a margin rather than blurring against the frame,
  // which would cut the feather off square. Body-to-frame ratio is identical at
  // both widths, so the two variants stay interchangeable.
  patch[`teppich${n}`] = await emit(`teppich${n}`, [480, 960], async (w) => {
    const sigma = (SOFTEN.sigma * w) / SOFTEN.ref;
    const pad = Math.ceil(sigma * 3);
    const body = await sharp(source).resize({ width: w - 2 * pad }).toBuffer();
    const padded = await sharp(body)
      .extend({ top: pad, bottom: pad, left: pad, right: pad, background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .toBuffer();
    const soft = await soften(padded, sigma, SOFTEN.opacity);
    return sharp(soft).webp({ quality: 52, effort: 6, alphaQuality: 85 }).toBuffer();
  });
}

const manifest = mergeManifest(patch);
const removed = prune(manifest);
if (removed.length) console.log(`\npruned ${removed.length} stale file(s)`);

const total = Object.values(patch).reduce((sum, a) => sum + Object.keys(a.widths).length, 0);
console.log(`\n${total} WebP files written to public/assets`);
