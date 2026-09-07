#!/usr/bin/env node
/**
 * Social preview image: crop the shopfront window photo
 * (src/assets/preview2.jpg) down to the standard 1200×630 OG/Twitter card
 * size.
 * Run via `npm run build:og`, which re-renders the HTML afterwards so the
 * meta tags pick up the new hashed filename.
 */
import sharp from 'sharp';
import { writeHashed, mergeManifest, kb } from './lib/manifest.mjs';

const jpg = await sharp('src/assets/preview2.jpg')
  .resize(1200, 630, { fit: 'cover' })
  .jpeg({ quality: 86, mozjpeg: true })
  .toBuffer();

const out = writeHashed('og-image', 'jpg', jpg);
mergeManifest({ og: { src: out.url, w: 1200, h: 630 } });

console.log(`  ${out.file}  1200×630  ${kb(out.bytes)}`);
