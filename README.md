# Zwischentöne

Two-page site for **Studio Kolchina & Gordon** and its current exhibition,
**Zwischentöne** by Clara Twele and Galina Kolchina.

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
  assets/         original images, SVGs, and video/ledder.mp4 (landing video)
  css/            critical.css   shared base, inlined into every <head>
                  landing.css    inlined into / only
                  site.css       inlined into the exhibition and legal pages
                  main.css       deferred — menu, panels, footer, legal
  js/             marquee.js + landing.js  (the landing page)
                  main.js                  (the exhibition page)
  index.html          templates — {{tokens}} are filled in at build time
  zwischentoene.html
  imprint.html
  privacy.html
public/         what is deployed — generated, and committed
scripts/        the build
```

Edit files in `src/`, run a build, commit `public/`.

### Two screens

`/` is the landing: the shopfront video full-bleed, the studio name running
around the frame as a marquee ring, and a plaque carrying the run dates and a
single link into the exhibition. `/zwischentoene.html` is the exhibition itself: the woven
background, the drifting rugs, and the menu.

They are separate documents rather than one page that swaps state, so the
exhibition has a URL that can be shared and linked, the back button works, and
each gets its own OG card. They share the type stack and very little else,
which is why the critical CSS is split per page — the landing never downloads
the menu styles, and the exhibition never downloads the marquee.

There is no loading screen. The landing page is itself the entrance, so a
wordmark hold in front of the exhibition would repeat branding the visitor has
just come through.

## Build

```bash
npm run build          # images → icons → HTML
npm run build:images   # sources → responsive WebP
npm run build:icons    # flat burgundy favicons
npm run build:html     # templates → public/, inlining CSS and SVGs
npm run build:og       # social preview image, cropped from src/assets/preview2.jpg
```

`npm run build` is safe to re-run at any time and is what you want after
changing anything in `src/`.

### Images

`build:images` converts every source raster to responsive WebP and wires the
widths into `srcset`: the landing video's poster at 480 / 960 / 1440, the woven
background at the same three, and the three rugs at 480 / 960. Filenames carry
a content hash, which is what lets `netlify.toml` serve all of `/assets/*` as
`immutable` — replace an image, re-run the build, and the URL changes with it.
Stale files are pruned automatically.

Quality is set low on purpose. The rugs and the background are near-flat woven
fields whose own grain sets the noise floor, so q70 costs roughly 2.3× the bytes
of q50 for under 1 dB of PSNR.

### Landing video

The landing page's background is a muted, autoplaying video
(`src/assets/video/ledder.mp4`), not sharp-processed since it isn't a raster —
`build:images` just content-hashes and copies it. It is re-encoded once by hand
before being dropped in; there's no dependency on `ffmpeg` in the build itself,
only in however the source file was prepared.

**It does not loop.** The clip is a one-way reveal — a night shot in which the
shopfront's roller shutter rises to expose the lit interior — so it has no
natural loop point: it starts closed and ends open, and looping it would snap
back to a shut shutter every pass. The `loop` attribute is deliberately absent
from the `<video>` in `src/index.html`; it plays once and rests on the final
open frame. Restore `loop` only if the footage is ever replaced with something
that actually cycles.

Current cut: `ledder2.MOV` trimmed from 19.2 s (the camera reframes over
t≈14–19; starting after that keeps the framing locked) to the end, 24.9 s at
1080×1920 / 30 fps, 2.0 MB.

To replace it:

```
ffmpeg -ss <start> -i SOURCE.MOV \
  -vf "colorspace=iall=bt2020:itrc=bt2020-10:all=bt709:format=yuv420p,fps=30,scale=1080:1920:flags=lanczos" \
  -c:v libx264 -profile:v high -pix_fmt yuv420p -crf 30 -preset slow \
  -an -movflags +faststart src/assets/video/ledder.mp4
ffmpeg -i src/assets/video/ledder.mp4 -frames:v 1 -q:v 2 src/assets/video/ledder-poster.jpg
```

Four things in that command are load-bearing:

- `+faststart` — without it the `moov` atom lands after the payload and nothing
  plays until the whole file has arrived.
- `yuv420p` — anything else (4:2:2, 10-bit) and Safari refuses the file outright.
  The phone source is 10-bit, so this conversion is mandatory, not optional.
- The `colorspace` clause — phone footage arrives as **HLG HDR** (BT.2020
  primaries, `arib-std-b67` transfer). Decoded naively it is watchable, because
  HLG is designed to degrade to SDR, but the colours sit flat and desaturated.
  This build of ffmpeg has neither `zscale` nor `libplacebo`, so a true HLG
  tone-map isn't available; treating the transfer as `bt2020-10` and correcting
  the primaries to BT.709 is the closest the stock `colorspace` filter gets, and
  on this footage it is visually very near the naive decode with the gamut
  fixed. If a proper tone-map is ever wanted, install ffmpeg with libzimg.
- `fps=30` — the source is 120 fps, which is four times more than a background
  clip needs and four times the bitrate.

Keep it **portrait**, and regenerate the poster from the new video's first
frame whenever the video changes. The two are separate files and the build will
not catch a mismatch, but `.hero__video` and `.hero__poster` are stacked in the
same box under `object-fit: cover`, so differing framing shows as a jump when
the video fades in, and stays wrong for anyone autoplay is blocked for.

Resolution is worth spending bytes on: the hero is full-bleed, so a 540×960
source is upscaled ~3.5× on a desktop viewport and looks soft. 1080×1920 holds
up at every size. Night footage carries sensor noise and compresses far worse
than daylight — on this clip `crf 26/30/34` came out at roughly 8.4 / 4.0 / 2.2
MB for the full 44 s. `crf 30` is the chosen balance.

The camera master (`ledder2.MOV`, 781 MB) is **not** committed —
`src/assets/video/*.MOV` is gitignored. Keep it in the project archive; only the
encoded web version belongs in the repo.

A plain `<img class="hero__poster">` sits underneath the `<video>` and is what
actually paints — the LCP candidate — so the frame is never blank while the
video loads or if autoplay is blocked. `src/js/landing.js` fades the video in
(`.is-playing`) only once the `playing` event actually fires, and retries
`play()` on the first tap/click/key if autoplay was blocked (iOS Low Power Mode
and similar states block it silently, with no event and no way to detect it in
advance). Holding the video transparent until then also keeps WebKit's own "tap
to play" button — shadow DOM a page is no longer allowed to style away —
invisible along with the rest of the element.

The ring's hand-printed texture degrades rather than failing closed. Its
filter chain ends in `feComponentTransfer` with `slope 18 / intercept -7`,
which maps an empty input straight to fully transparent — so if any earlier
step fails, the ring disappears entirely instead of merely losing its texture.
The step that fails in practice is `canvas.toDataURL()` after drawing the noise
SVG blob, which some WebKit versions refuse on a tainted canvas. `marquee.js`
therefore bakes the noise first and only then sets `data-textured` on the SVG;
the CSS applies `filter: url(#handPrintedRing)` under that attribute alone. A
failure now costs the texture and keeps the text.

Note that neither the video nor the marquee ring stops under
`prefers-reduced-motion`. That is inherited from this page's original design and
is recorded as deliberate in the comment above `tick()` in `src/js/marquee.js`:
ambient motion the page wants running unconditionally. Flip it if that stance
ever changes.

`.hero__scrim` is the original gradient along the top only — it carries the
ring text where it crosses the sky and reaches nothing else. The exhibition link
does not depend on it: it sits on a white card (see Notes), which is what makes
it readable over a night shot without darkening the video at all.

### Drifting rugs

The exhibition page floats three rugs behind the menu, drifting on one rAF loop
and draggable with pointer events so it works on touch. Drift resumes from
wherever you let go. Purely decorative — nothing is reachable only by dragging —
and it stops entirely under `prefers-reduced-motion` and while the tab is hidden.

The rugs carry the reference artwork's Gaussian softener: a blurred copy of the
layer blended back over the original, Normal mode at 47% opacity. `SOFTEN` at
the top of the rug section in `scripts/build-images.mjs` is the only knob;
`sigma: 5` is a slight softening, `10` turns it into a pronounced glow. It is
baked into the WebP at build time rather than applied as a CSS `filter`, because
the rugs move and a runtime blur would re-rasterise a large element every frame.

Each rug is resized to leave a transparent margin before blurring, because the
feather needs somewhere to fade into. The blend runs on premultiplied pixels:
blurring straight RGBA drags the black of fully transparent pixels in under the
edge and rings every rug with a dark halo.

### Icons

The Zwischentöne mark is a single-line wordmark at roughly 6.8:1. Squeezed into
a 32 px favicon it is four pixels tall and unreadable. `build:icons` used to cut
the icons down to the mark's own leading **Z**, scanned out of the artwork
rather than redrawn; that was dropped in favour of a flat `#37161d` tile, which
reads better at every size a tab or a home screen actually renders and cannot be
misread at any of them. The icons are now generated as solid squares — no SVG
rasterisation, no glyph isolation.

### Social preview image

The OG/Twitter card is a photo of the shopfront window, not a screenshot of the
live page. `build:og` crops `src/assets/preview2.jpg` (1350×602) to the standard
1200×630 card size with `sharp`'s `cover` fit, writes `og-image.<hash>.jpg`, and
then re-runs `build:html` so the meta tags pick up the new filename. Replace
`src/assets/preview2.jpg` and re-run `npm run build:og` to update it.

## Replacing assets

Drop the new file into `src/assets/` under the same name and run `npm run build`.
For the landing video, re-encode it yourself first (see Landing video above) — the
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

Transfer per page, as a phone fetches it (narrowest `srcset` candidate, critical
CSS inlined, measured from the built files in `public/`):

| | requests | transfer |
|---|---|---|
| `/` (landing) | 5 | 2.02 MB |
| `/zwischentoene.html` | 7 | **40 KB** |

**Splitting the two screens is what makes the exhibition page cheap.** It used
to carry the video and came in around 1.5 MB; with the video living only on the
landing page, everything the exhibition needs — markup, critical CSS, the
deferred stylesheet, the menu and rug script, the woven background and all three
rugs — adds up to 40 KB.

The landing page is the expensive one, and it is nearly all video: 2.0 MB of its
2.02 MB. That is an explicit trade for the full-bleed shopfront, made with the
cost known — the night footage was budgeted at `crf 30` against measured
alternatives of ~2.2 MB (`crf 34`, mushy shadows) and ~8.4 MB (`crf 26`).
Everything else on the page is under 40 KB. The poster is preloaded at
`fetchpriority="high"` and is the LCP candidate, so the first paint does not
wait on the video — and with no loading screen in front of it any more, nothing
covers the viewport while it arrives.

The LCP figures that used to sit here were measured against the previous
single-page build with its 1.5 s loading screen, so they no longer describe this
site and have been dropped rather than carried over. If the number matters,
re-measure it.

If the video's bytes ever need trimming: it is currently `crf 30` over a 24.9 s
cut. Raising the crf, shortening the cut further, or capping its width would all
help, at some cost to how it reads on a large desktop screen where `cover`
scales it up — and night footage shows compression artefacts in the shadows
much sooner than daylight did.

## Notes

- There is no loading screen. It was removed when the landing page became the
  site's entrance — a wordmark hold behind it would have repeated branding the
  visitor had just walked through, and delayed the rugs by 2.1 s.
- The intro text — what used to live behind an "About" toggle — is always
  visible above the menu now, not a panel. It reads as the page's lead
  statement; `.intro` in `src/css/main.css` shares its typography with
  `.panel-body` so the two read as one voice.
- The menu is The Studio · Artists · Brands · Contact, left-aligned, in the
  source order of the `<li>` elements in `src/zwischentoene.html`. Its
  font-size is derived from the mark rather than picked by eye — see the
  comment on `.menu-toggle` in `src/css/main.css`.
- Body copy is left-aligned sitewide — the intro, every panel, and the legal
  pages — at a larger, more editorial scale than the original centred design.
  `.intro, .panel-body` in `src/css/main.css` is the shared type rule.
- The exhibition runs 9–30 September 2026, Monday to Saturday 14:00–20:00,
  closed Sundays. The dates, the venue and that schedule appear in the meta
  description and in the `ExhibitionEvent` JSON-LD; changing them means editing
  `src/zwischentoene.html` and the `exhibition` object in
  `scripts/build-html.mjs`.
- **The exhibition link sits on a framed plaque, and that is what makes it
  readable.** It is set in the site's burgundy (`#37161d`), which is close to
  black; the landing video is a night shot, and no scrim is wanted over it.
  Measured directly against the footage the type came out near 1:1 — invisible.
  On the plaque's cream field (`#efeae1`) the same burgundy measures
  **13.5:1**, comfortably past AAA, and the video behind it is left completely
  untouched. This is why `.hero__footer` has a background at all; it is not
  decoration.

  The frame is two rules — a thick border and a keyline set inside it — both
  driven off one `--frame` custom property, so they cannot drift apart. The
  plaque sits at `top: 78%`, over the pavement on a portrait phone; on a wide
  viewport `cover` has already cropped the pavement away and it simply reads as
  the lower quarter of the picture.

  The card is `width: max-content` rather than the default shrink-to-fit,
  because an auto-width absolutely positioned box at `left: 50%` is only
  offered half the viewport — the centring transform does not feed back into
  layout — which wrapped the label onto two lines on a phone.
- Body copy on the exhibition page sits over the burgundy ground and the rugs,
  not over video, so it is not subject to the above.
