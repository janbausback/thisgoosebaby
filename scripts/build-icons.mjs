#!/usr/bin/env node
/**
 * Favicons: the site's purple, and nothing else.
 *
 * A flat tile, as it was in the Zwischentöne burgundy. Any wordmark squeezed
 * into a 32 px tile is a few pixels tall and unreadable; the flat colour reads
 * at every size a tab or a home screen actually renders, and it cannot be
 * misread at any of them.
 */
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { PUBLIC, writeHashed, mergeManifest, kb } from './lib/manifest.mjs';

const BG = '#b26dd4';
const RGB = { r: 0xb2, g: 0x6d, b: 0xd4, alpha: 1 };

const png = (size) =>
  sharp({ create: { width: size, height: size, channels: 4, background: RGB } })
    .png({ compressionLevel: 9, palette: true })
    .toBuffer();

fs.mkdirSync(PUBLIC, { recursive: true });
const patch = {};

const appleTouch = await png(180);
fs.writeFileSync(path.join(PUBLIC, 'apple-touch-icon.png'), appleTouch);
console.log(`  apple-touch-icon.png       ${kb(appleTouch.length)}`);

// A bare 32×32 BMP-in-ICO — everything that still requests favicon.ico takes it,
// and it avoids a dependency for one small file.
const bmp = Buffer.alloc(40 + 32 * 32 * 4 + 32 * 4);
bmp.writeUInt32LE(40, 0); bmp.writeInt32LE(32, 4); bmp.writeInt32LE(64, 8);
bmp.writeUInt16LE(1, 12); bmp.writeUInt16LE(32, 14); bmp.writeUInt32LE(32 * 32 * 4, 20);
for (let i = 0; i < 32 * 32; i++) {
  const d = 40 + i * 4;
  bmp[d] = RGB.b; bmp[d + 1] = RGB.g; bmp[d + 2] = RGB.r; bmp[d + 3] = 0xff;
}
const ico = Buffer.concat([
  Buffer.from([0, 0, 1, 0, 1, 0, 32, 32, 0, 0, 1, 0, 32, 0,
    ...new Uint8Array(new Uint32Array([bmp.length, 22]).buffer)]),
  bmp,
]);
fs.writeFileSync(path.join(PUBLIC, 'favicon.ico'), ico);
console.log(`  favicon.ico                ${kb(ico.length)}`);

// Scalable favicon: the same tile, still vector.
const favSvg =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">` +
  `<rect width="32" height="32" fill="${BG}"/></svg>`;
fs.writeFileSync(path.join(PUBLIC, 'favicon.svg'), favSvg);
console.log(`  favicon.svg                ${kb(Buffer.byteLength(favSvg))}`);

// Manifest icons are referenced by URL, so these can carry a content hash.
for (const [key, name, size] of [
  ['icon192', 'icon-192', 192],
  ['icon512', 'icon-512', 512],
  ['icon512m', 'icon-512-maskable', 512],
]) {
  const out = writeHashed(name, 'png', await png(size));
  patch[key] = { src: out.url };
  console.log(`  ${out.file.padEnd(27)}${kb(out.bytes)}`);
}

mergeManifest(patch);
