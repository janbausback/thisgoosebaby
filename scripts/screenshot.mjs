#!/usr/bin/env node
/**
 * Social preview image. Serves public/, waits out the loading screen and lets
 * the rugs settle, then captures the main screen at exactly 1200×630.
 * Run via `npm run build:og`, which re-renders the HTML afterwards so the meta
 * tags pick up the new hashed filename.
 */
import sharp from 'sharp';
import { createServer } from './serve.mjs';
import { writeHashed, mergeManifest, kb } from './lib/manifest.mjs';

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error('Playwright is not installed. It is only needed for this step:');
  console.error('  npm i -D playwright && npx playwright install chromium');
  process.exit(1);
}

const server = createServer();
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const browser = await chromium.launch();
// Captured at a larger viewport of the same 1200:630 ratio, then scaled down.
// At 630px tall the menu does not fit and the last item is clipped; the fluid
// type is capped in rem, so extra viewport height buys real room rather than
// just scaling everything up with it. Leave headroom for another menu item.
const SHOT = { width: 1800, height: 945 };

const page = await browser.newPage({
  viewport: SHOT,
  deviceScaleFactor: 2,
  // Keep the composition still and predictable rather than catching the rugs
  // mid-drift at a random point.
  reducedMotion: 'reduce',
});

await page.goto(`http://localhost:${port}/`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => document.body.dataset.phase === 'ready');
await page.waitForFunction(() =>
  Array.from(document.images).every((i) => i.complete && i.naturalWidth > 0)
);
await page.waitForTimeout(400);

// The composition must fit the frame — otherwise the preview silently clips
// the last menu item, which is exactly what happened when the menu grew.
const overflow = await page.evaluate(() => ({
  v: document.documentElement.scrollHeight - innerHeight,
  h: document.documentElement.scrollWidth - innerWidth,
}));
if (overflow.v > 1 || overflow.h > 1) {
  console.error(
    `The page overflows the ${SHOT.width}×${SHOT.height} capture frame ` +
    `by ${Math.max(0, overflow.v)}px vertically, ${Math.max(0, overflow.h)}px horizontally.\n` +
    'The preview would be clipped. Raise SHOT (keeping the 1200:630 ratio) and re-run.'
  );
  await browser.close();
  server.close();
  process.exit(1);
}

const shot = await page.screenshot({ type: 'png' });
await browser.close();
server.close();

const jpg = await sharp(shot).resize(1200, 630, { fit: 'cover' }).jpeg({ quality: 86, mozjpeg: true }).toBuffer();
const out = writeHashed('og-image', 'jpg', jpg);
mergeManifest({ og: { src: out.url, w: 1200, h: 630 } });

console.log(`  ${out.file}  1200×630  ${kb(out.bytes)}`);
