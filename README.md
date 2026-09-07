# Zwischentöne

One-page site for **Zwischentöne**, a temporary installation by Clara Twele and
Galina Kolchina, published under Studio Kolchina & Gordon.

Live: <https://kolchinagordon.com>

Plain HTML, CSS and vanilla JS. No framework, no runtime dependencies, no
third-party requests — no fonts, no analytics, no CDN. Everything in `public/`
is committed, so Netlify deploys it without running a build.

---

## Local preview

```bash
npm install      # only needed for the build scripts
npm run serve    # → http://localhost:4173
```

`npm run serve` is a dependency-free static server over `public/`. Any other
static server works too — nothing is generated at request time.

## Layout

```
src/            what you edit
  assets/         original images, SVGs, and video/ledder.mp4 (hero background)
  css/            critical.css (inlined into <head>) + main.css (deferred)
  js/main.js
  index.html      templates — {{tokens}} are filled in at build time
  imprint.html
  privacy.html
public/         what is deployed — generated, and committed
scripts/        the build
```

Edit files in `src/`, run a build, commit `public/`.

## Build

```bash
npm run build          # images → icons → HTML
npm run build:images   # sources → responsive WebP
npm run build:icons    # favicons from the Zwischentöne mark
npm run build:html     # templates → public/, inlining CSS and SVGs
npm run build:og       # social preview image, cropped from src/assets/preview.png
```

`npm run build` is safe to re-run at any time and is what you want after
changing anything in `src/`.

### Images

`build:images` converts the hero poster to responsive WebP at 480 / 960 / 1440
and wires the widths into `srcset`. Filenames carry a content hash, which is
what lets `netlify.toml` serve all of `/assets/*` as `immutable` — replace an
image, re-run the build, and the URL changes with it. Stale files are pruned
automatically.

### Hero video

The main screen's background is a looping, muted, autoplaying video
(`src/assets/video/ledder.mp4`), not sharp-processed since it isn't a raster —
`build:images` just content-hashes and copies it. It is re-encoded once by hand
before being dropped in; there's no dependency on `ffmpeg` in the build itself,
only in however the source file was prepared. To replace it:

```
ffmpeg -i SOURCE.mov -vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920" \
  -c:v libx264 -profile:v high -pix_fmt yuv420p -crf 28 -preset slow \
  -an -movflags +faststart src/assets/video/ledder.mp4
ffmpeg -i src/assets/video/ledder.mp4 -frames:v 1 -q:v 2 src/assets/video/ledder-poster.jpg
```

Three of those flags are load-bearing. Without `+faststart` the `moov` atom
lands after the payload and nothing plays until the whole file has arrived.
Anything but `yuv420p` — 4:2:2, 10-bit — and Safari refuses the file outright.
`-an` drops the audio track, which is dead weight on a muted background loop.

Keep it **portrait**, and regenerate the poster from the new video's first
frame whenever the video changes. The two are separate files and the build will
not catch a mismatch, but `.hero-video` and `.hero-poster` are stacked in the
same box under `object-fit: cover`, so differing framing shows as a jump when
the video fades in — and is permanent for the reduced-motion case below.

Resolution is worth spending bytes on: the hero is full-bleed, so a 540×960
source is upscaled ~3.5× on a desktop viewport and looks soft. 1080×1920 holds
up at every size. Aim for under ~3 MB, raising `-crf` toward 30–32 if needed.

A plain `<img class="hero-poster">` sits underneath the `<video>` and is what
actually paints — the LCP candidate — so the frame is never blank while the
video loads or if autoplay is blocked. `src/js/main.js` fades the video in
(`.is-playing`) only once the `playing` event actually fires, retries `play()`
on the first tap/click/key if autoplay was blocked (iOS Low Power Mode and
similar states block it silently, with no event and no way to detect it in
advance), and never starts it at all under `prefers-reduced-motion` — the
poster stays as a static image.

`.hero-scrim` is a burgundy-tinted gradient over the whole frame, holding white
type off the brightest parts of the video. Its opacity is a deliberate trade
against contrast — see Performance below before changing it, and re-measure if
the source video changes.

### Icons

The Zwischentöne mark is a single-line wordmark at roughly 6.8:1. Squeezed into
a 32 px favicon it is four pixels tall and unreadable. `build:icons` used to cut
the icons down to the mark's own leading **Z**, scanned out of the artwork
rather than redrawn; that was dropped in favour of a flat `#37161d` tile, which
reads better at every size a tab or a home screen actually renders and cannot be
misread at any of them. The icons are now generated as solid squares — no SVG
rasterisation, no glyph isolation.

### Social preview image

The OG/Twitter card is a fixed design — the Studio Kolchina & Gordon wordmark
on blue, over the site's burgundy ground — not a screenshot of the live page.
`build:og` crops `src/assets/preview.png` (2746×1296) to the standard 1200×630
card size with `sharp`'s `cover` fit, writes `og-image.<hash>.jpg`, and then
re-runs `build:html` so the meta tags pick up the new filename. Replace
`src/assets/preview.png` and re-run `npm run build:og` to update it.

## Replacing assets

Drop the new file into `src/assets/` under the same name and run `npm run build`.
For the hero video, re-encode it yourself first (see Hero video above) — the
build only hashes and copies whatever is in `src/assets/video/ledder.mp4`, it
does not compress it.

If `Zwischentöne_vector.svg` is ever missing, the build warns, renders the
top-left mark as live text and falls back to the Studio wordmark for icons.

Source SVGs may keep their exported `fill`/`stroke` attributes; the build strips
them so the marks take their colour from CSS.

## Legal pages

The imprint and privacy policy carry the operator's details: Galina Kolchina,
Eisenbahnstraße 5, 10997 Berlin, +49 152 21465761. No placeholders remain, and
the VAT-ID section has been removed.

Both documents are standard German boilerplate (§ 5 TMG, GDPR). They are a
starting point, not legal advice; have them reviewed.

The `<mark>` styling in `src/css/main.css` is kept for any detail that later
needs flagging as unfilled — it renders loudly on purpose.

## Deployment

Netlify, publish directory `public/`, no build command. `netlify.toml` sets the
cache headers — a year and `immutable` for the hashed `/assets/*`, revalidate
for HTML — plus a Content-Security-Policy strict enough to enforce the claim the
privacy policy makes: this site loads nothing from anyone else.

## Performance

Measured on the built site — Moto G4, Slow 4G (1.6 Mbps, 150 ms RTT), 4× CPU:

| | mobile | desktop |
|---|---|---|
| requests | 6 | 5 |
| transfer | 1.50 MB | 1.43 MB |
| LCP | 1.95 s (median of 5) | — |

**This is well past the original 500 KB / 1.5 s budget, on purpose.** The hero
video is ~1.3 MB of that transfer by itself — bringing it back was an explicit
choice to trade the transfer budget for it, made with that cost known, not an
oversight. Everything else on the page is still light: the poster and the rest
of the markup/CSS/JS/icons together are under 200 KB.

LCP is governed by the same structural tension as before: the loading screen
covers the viewport for a fixed 1.5 s, so nothing behind it can paint before
then, and the video's poster (the LCP candidate once the loader fades) paints
right after. The lever, if the hold ever needs to give way to the metric, is
still `LOADER_MS` at the top of `src/js/main.js`.

If the video's bytes ever need trimming further: it is already `crf 30`;
pushing higher (this footage tolerated `crf 32` with no visible difference in
testing) or capping its width below the source's 540px would both cut more,
at some cost to how sharp it reads on a large desktop screen where `cover`
scales it up.

## Notes

- The loading screen runs for a fixed 1.5 s on every visit, showing only the
  Studio Kolchina & Gordon wordmark on the flat `--bg` colour — no image. Under
  `prefers-reduced-motion` it skips straight to the final state, no hold and no
  fade. Durations live at the top of `src/js/main.js`.
- The intro text — what used to live behind an "About" toggle — is always
  visible above the menu now, not a panel. It reads as the page's lead
  statement; `.intro` in `src/css/main.css` shares its typography with
  `.panel-body` so the two read as one voice.
- The menu is The Studio · Artists · Brands · Contact, left-aligned, in the
  source order of the `<li>` elements in `src/index.html`.
- Body copy is left-aligned sitewide — the intro, every panel, and the legal
  pages — at a larger, more editorial scale than the original centred design.
  `.intro, .panel-body` in `src/css/main.css` is the shared type rule.
- The exhibition runs 9–30 September 2026, Monday to Saturday 14:00–20:00,
  closed Sundays. The dates, the venue and that schedule appear in the meta
  description and in the `ExhibitionEvent` JSON-LD; changing them means editing
  `src/index.html` and the `jsonld` block in `scripts/build-html.mjs`.
- **White body copy over the video measures about 3.7:1 worst-case, which is
  below the 4.5:1 WCAG AA minimum.** This is a known, deliberate trade: the
  scrim was lightened to `0.65 / 0.50 / 0.55 / 0.65` so more of the video reads
  through, and the contrast went with it. The menu clears its own bar — at
  `clamp(1.5rem, 4vw, 2.6rem)` it is large text, judged at 3:1 — but the intro
  and panel paragraphs do not. Expect it to be hard to read on a phone in
  daylight.

  Measured by compositing the scrim over 17 frames sampled across the video and
  taking the brightest point in each. For reference, on this footage:
  `0.70 / 0.56 / 0.61 / 0.70` gives 4.5:1 (AA) and `0.79 / 0.69 / 0.73 / 0.79`
  gives 7:1 (AAA). Re-measure if the source video changes — a brighter clip
  pushes this further down, and it looks fine by eye long after it stops
  passing.
