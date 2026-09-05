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
  assets/         original images and SVGs
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
npm run build:og       # social preview image (needs Playwright, see below)
```

`npm run build` is safe to re-run at any time and is what you want after
changing anything in `src/`.

### Images

`build:images` converts every source raster to WebP at 480 / 960 / 1440 and
wires the widths into `srcset`. Filenames carry a content hash, which is what
lets `netlify.toml` serve all of `/assets/*` as `immutable` — replace an image,
re-run the build, and the URL changes with it. Stale files are pruned
automatically.

Quality is set low on purpose. The rugs and the background are near-flat woven
fields whose own grain sets the noise floor, so q70 costs roughly 2.3× the bytes
of q50 for under 1 dB of PSNR. The whole initial view is about 30 KB on mobile.

### Icons

The Zwischentöne mark is a single-line wordmark at roughly 6.8:1. Squeezed into
a 32 px favicon it is four pixels tall and unreadable, so `build:icons` cuts the
icons down to the mark's own leading **Z**, found by scanning the artwork rather
than redrawn. The comment above `leadingGlyph()` in `scripts/build-icons.mjs`
records why the three obvious ways of isolating it do not work.

### Social preview image

`build:og` drives a real browser, waits out the loading screen, screenshots the
main screen and writes `og-image.<hash>.jpg` at 1200×630. It then re-runs
`build:html` so the meta tags pick up the new filename.

The capture happens at 1800×945 — the same 1200:630 ratio, scaled down
afterwards. At 630 px tall the menu does not fit and the last item is clipped,
and because the type scale is capped in rem, extra viewport height buys real
room rather than just scaling up with it. The script refuses to write a preview
that overflows its frame, so adding another menu item fails loudly instead of
silently cropping. Playwright is only
needed for this one step:

```bash
npm i -D playwright && npx playwright install chromium
npm run build:og
```

## Replacing assets

Drop the new file into `src/assets/` under the same name and run `npm run build`.

Sources are found by basename, whatever the extension — the rugs have arrived as
both PNG and WebP.

Two shapes of rug source are handled. A **cutout** carries its own alpha and is
trimmed to its alpha bounds. A **flat photograph** has no alpha and sits on the
white studio ground with knotted fringes along two edges; a fixed inset either
leaves a fringe showing or eats into the pile, so `flatCore()` scores each row
and column by how much of it matches the rug's dominant colour and keeps the
contiguous band above 90%. `teppich3web.webp` takes this path. Because it is
fully opaque it also carries a lower CSS opacity than the two cutouts, so it
layers in the same register rather than blocking them out.

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
| requests | 8 | 8 |
| transfer, Brotli | 51 KB | 57 KB |
| FCP | 284 ms | — |
| loading screen fully painted | 580 ms | — |
| LCP | 2.0 s | — |

The transfer budget (500 KB) is met about ten times over. **LCP is not under
1.5 s, and structurally cannot be**: the loading screen deliberately covers the
viewport for a fixed 1.5 s, so nothing larger than its own square can paint
before then, and the drifting rugs are larger. LCP lands as the fade completes.

The two requirements are in direct tension. What a visitor actually experiences
is the branded screen fully painted at 580 ms. If the metric matters more than
the hold, the lever is `LOADER_MS` at the top of `src/js/main.js`; making the
rugs smaller on narrow viewports would also hand the LCP back to the loading
screen's square.

## Notes

- The loading screen runs for a fixed 1.5 s on every visit. Nothing is stored
  between visits — no cookies, no `localStorage`.
- `prefers-reduced-motion` skips the loading screen and its fade entirely and
  leaves the rugs at rest. The durations live at the top of `src/js/main.js`.
- The menu is About · The Studio · Artists · Brands · Contact, with the two
  prose panels first and the two lists after. Order is just the source order of
  the `<li>` elements in `src/index.html`.
- The exhibition runs 9–30 September 2026, Monday to Saturday 14:00–20:00,
  closed Sundays. The dates, the venue and that schedule appear in the meta
  description and in the `ExhibitionEvent` JSON-LD; changing them means editing
  `src/index.html` and the `jsonld` block in `scripts/build-html.mjs`.
- The drifting rugs are draggable with a pointer or a finger. Nothing on the
  site is reachable only by dragging.
- `.shell` spans the viewport above the rugs, so it is `pointer-events: none`
  with only the real controls set back to `auto`. Without that, nothing behind
  the menu can be grabbed at all.
- White type keeps a worst-case contrast of about 9.5:1 even with all three
  rugs stacked directly behind the menu, against the 7:1 AAA threshold.
