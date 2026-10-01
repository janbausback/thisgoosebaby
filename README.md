# Studio Kolchina & Gordon

Website of **Studio Kolchina & Gordon**, an art studio and collaborative project
in Berlin-Kreuzberg by Galina Kolchina and Liam Gordon.

Live: <https://kolchinagordon.com>

Plain HTML, CSS and vanilla JS. No framework, no runtime dependencies, no
third-party requests — no fonts, no analytics, no CDN. Everything in `public/`
is committed, so Netlify deploys it without running a build.

Until October 2026 this repo was the site of the exhibition **Zwischentöne**
(Clara Twele and Galina Kolchina, 9–30 September 2026). That version is tagged
`zwischentoene-archive`; the exhibition itself now lives under Previous
Projects. See [Archive](#archive).

---

## Local preview

```bash
npm install      # only needed for the build scripts
npm run serve    # → http://localhost:4173, and the LAN address for a phone
```

`npm run serve` is a dependency-free static server over `public/`. It listens
on every interface and prints the machine's LAN address as well, e.g.
`http://192.168.178.64:4173` — open that on a phone on the same Wi-Fi. macOS
may ask once whether `node` may accept incoming connections; allow it, or the
phone will time out. The address comes from the router and can change; the
server prints the current one on every start.

## Layout

```
src/            what you edit
  assets/photos/  JPEG masters of every photograph (see Photographs)
  css/            critical.css   shared base, header, menu, footer — every page
                  home.css       the landing page
                  page.css       the subpages
  js/             menu.js        the burger menu — every page
                  slideshow.js   the landing picture's hard cuts
                  marquee.js     the line of type across it
                  studio.js      sizes the studio text to one screen
  index.html              templates — {{tokens}} are filled in at build time
  on-view.html
  previous-projects.html
  contact.html            (includes the Impressum)
  privacy.html
public/         what is deployed — generated, and committed
scripts/        the build
```

Edit files in `src/`, run a build, commit `public/`.

## Pages

| URL | |
|---|---|
| `/` | One photograph in the middle, cutting between three; the studio's name running across it; below, the studio text set to fill one screen, then a fourth photograph, centred. |
| `/on-view.html` | The current exhibition. Right now: “Next exhibition will start in November. Stay close.” |
| `/previous-projects.html` | Past exhibitions, newest first, one `<article>` each. Zwischentöne is the first. |
| `/contact.html` | Email, address, Instagram (Galina Kolchina, Liam Gordon) — and the Impressum, at `#impressum`. |
| `/privacy.html` | Datenschutzerklärung. `noindex`. |

The header, menu and footer are not in the templates: `{{header}}` and
`{{footer}}` are rendered by `scripts/build-html.mjs`, which marks the current
page in the menu (`aria-current`) and adds the home link on every page but
`/`. The menu's items and order are the `MENU` array there.

To add a project, put a new `<article class="project" id="…">` above the
Zwischentöne one in `src/previous-projects.html`, add its photographs to
`PHOTOS` in `scripts/build-images.mjs`, and — if it should carry structured
data — an `ExhibitionEvent` beside `zwischentoene` in `build-html.mjs`.

## Build

```bash
npm run build          # images → social card → icons → HTML
npm run build:images   # photo masters → responsive WebP
npm run build:og       # social preview image, then HTML
npm run build:icons    # flat purple favicons
npm run build:html     # templates → public/, inlining CSS and SVGs
```

`npm run build` is safe to re-run at any time and is what you want after
changing anything in `src/`. After a change to HTML, CSS or JS only,
`npm run build:html` is enough.

Filenames under `/assets/` carry a content hash, which is what lets
`netlify.toml` serve them as `immutable` — replace an image, re-run the build,
and the URL changes with it. `build:html` runs last and prunes any file in
`public/assets/` the manifest no longer references.

Every page's CSS is inlined into its `<head>` — the shared base plus either
`home.css` or `page.css`, about 6 KB either way — so no page waits on a
stylesheet request.

### Photographs

The camera originals are in the project folder,
`Studio Kolchina & Gordon/Default/` — HEIC and full-size JPEG, 4–7 MB each.
The repo keeps JPEG **masters** instead, in `src/assets/photos/`: upright,
2400 px on the long edge, sRGB. `build:images` turns those into WebP at the
widths each picture is actually drawn at (see `PHOTOS` in
`scripts/build-images.mjs` for the reasoning per picture).

To replace or add one, make a master from the original. `sharp` cannot read
HEIC, so macOS's `sips` converts it first:

```bash
sips -s format jpeg -s formatOptions 95 IMG.HEIC --out /tmp/full.jpg
node -e "require('sharp')('/tmp/full.jpg').rotate()
  .resize({width:2400,height:2400,fit:'inside',withoutEnlargement:true})
  .jpeg({quality:88,mozjpeg:true}).toFile('src/assets/photos/NAME.jpg')"
npm run build
```

`rotate()` with no angle applies the EXIF orientation: the iPhone stores its
portrait shots as landscape pixels plus a rotation flag, and without it they
come out sideways. The masters are already upright, but `build:images` applies
it again so a master exported the other way still works.

`about.jpg` was cut out of the white sheet it was delivered on
(`trim({ background: '#ffffff', threshold: 24 })` before the resize); any
replacement should be the photograph alone.

All landing and project pictures are **3:4 portrait**. The hero frame and the
project grid are both drawn at 3:4 with `object-fit: cover`, so another shape
would be cropped, not letterboxed.

### Landing: the picture

Three photographs (`hero-1` … `hero-3`) are stacked in one frame and
`slideshow.js` cuts between them every two seconds — hard cuts, no fade. The
frame is 51 % of the width on a phone, as in the mockup, and is limited by the
height on wider screens (`min(51vw, 41svh)`), so it never outgrows the
viewport.

A cut is only made to a picture that has loaded and decoded (`img.decode()`),
so it never lands on a half-drawn frame; a picture that fails to load drops out
of the rotation. The timer stops while the tab is hidden. Only the first
picture is fetched at high priority — it is the one that paints.

**The scroll cue is the text itself.** The hero is one screen less a sliver,
so the bottom edge of the first screen cuts the studio text's first line about
a third of the way down its capitals. NN/g's research on the “illusion of
completeness” found that a full-screen hero ending on a clean edge reads as
the whole page — a false floor — and that real content visibly crossing the
fold is the strongest cue that a page goes on, stronger than arrows or a
“scroll” label, and with no extra element on the page. The hero's height is
computed from the studio text's size and the white above its first line
(`--studio-size` and `--studio-top` on `<main>`; `studio.js` sets the size), so
the cut lands in the same place on every screen; the fraction is the
`0.714 / 3` in `.hero` in `home.css`.

### Landing: the marquee

The old frame-ring, straightened: the studio's name running right to left
through the middle of the picture, in the site's purple, with the same
hand-printed texture filter. It is set in **Helvetica Neue bold**, as in the
mockup. The ring asked for Arial Black, but iOS has no Arial Black, so on an
iPhone it always fell back to Helvetica — the mockup simply shows what a phone
rendered.

How it moves is new. `marquee.js` fills an SVG with two identical halves, each
at least a viewport wide, and a CSS animation slides the whole track left by
exactly one half, then starts over — every letter lands where the same letter
one half on stood, so there is no seam. Because that is a `transform` on a
composited layer, the text and its filter are painted **once per layout**, not
once per frame. The ring had to rewrite `startOffset` on every frame, which
re-ran the filter each time; that is why it was capped at 30 fps and why its
noise had to be pre-baked into a bitmap. Neither is needed any more.

Two details keep the loop exact:

- **The lengths come from glyph positions** (`getStartPositionOfChar`), not
  `getComputedTextLength()`. WebKit leaves letter-spacing out of the latter but
  not out of what it draws, so on an iPhone the computed length overstates each
  unit by 27 × 0.01em, and the loop jumped by the difference every time round.
- **The texture repeats with the text.** The filter's noise is generated for
  one half only (`feTurbulence stitchTiles="stitch"`) and tiled across both
  (`feTile`), so the textured glyphs are identical at the start and the end of a
  loop.

The texture is still switched on only after `marquee.js` has sized the filter
(`data-textured`): the chain ends in an alpha threshold (`slope 18 / intercept
-7`) that maps an empty input to fully transparent, so a filter with no region
would take the text with it rather than just its texture.

Pace is 3.6 em/s, the ring's old 60 px/s at the mockup's type size, so it reads
the same at every size. Like the ring, it runs regardless of
`prefers-reduced-motion` — ambient motion the site wants running
unconditionally. Flip it in `marquee.js` and the `data-running` rule in
`home.css` if that stance changes.

### The studio text

Below the picture, the text that used to sit behind “The Studio” in the old
menu, set to fill **exactly one screen** — from under the header strip to the
bottom edge. The text's height grows with the square of its size, so no single
CSS formula fits every phone; `home.css` makes a close first guess
(`min(7.15vw, 4.17svh)` in portrait), and `studio.js` measures the real text
and bisects to the largest size that fits. It measures against `100svh` — the
screen with Safari's toolbars showing — so the size does not change when the
toolbars collapse as the reader scrolls into it. The section is below the
fold, so the correction is never seen.

The photograph from the opening (`about.jpg`) follows the text, **centred**,
one line of the text's leading below it, and a little narrower than the
picture at the top (`min(40vw, 32svh)` against the hero's `min(51vw, 41svh)`):
the page opens and closes on a centred photograph without the two competing.
It is not part of the screen the text fills.

It was floated into the text, then set into the middle of it with the words
running past on both sides (a script cut a matching gap into each line); both
were tried on a phone and dropped in favour of this.

### Menu

Two lines at the **top right**: 28 px wide, 2 px thick and 4.5 px apart on a
375 px phone, 22.5 px down from the top and in line with the right edge of the
text column. The mockup drew them at 21 px, 12 px from the corner, which on a
phone was both tiny and as far up as the screen goes. The button runs from the
lines all the way into the corner — about 53 px square on a 390 px phone — so
a tap that falls a little short of them still lands; to the left it stops
halfway to the menu, so the links keep their own ends. Open, they close the gap and then
turn into an X with a slight overshoot; closing runs the same two moves
backwards. Each state carries the timing for the transition *into* it, so CSS
reverses the order without any script. The links — the mockup's regular
Helvetica, 25.6 px on a 375 px phone — come in from the right, staggered, with
their first line's cap tops level with the burger's upper line.

A bottom-right placement was built and tried on a phone first, for thumb
reach: one-handed use is about half of all phone use, about three quarters of
taps are made with the thumb, and the top corners are the hardest place on the
screen to reach (Steven Hoober's field study; NN/g). It went back to the top:
the mockup's position is the decision. Don't move it down again without asking.

The header is fixed and paints a white strip, invisible over the white landing
page and what keeps the burger off the type everywhere else. Type scrolling up
under it is cut off at a **hard edge**, with no fade. Open, the strip grows to
sit behind the links, so they never land on text either; it takes taps like
the paper it looks like, so nothing under it can be hit through it and a tap on
it beside the links closes the menu. On the subpages it also holds the home
link, STUDIO KOLCHINA & GORDON in the marquee's letter, which steps aside while
the menu is open. Without JavaScript the links are simply shown — which is the
mockup's state anyway.

Safari 26 reads the background of fixed elements near the screen's edges to
tint its own toolbars, so the white of the strip is painted by a
pseudo-element, never by the fixed element itself, and `html` and `body` both
carry an explicit white.

### Colour

`#b26dd4`, sampled from the mockup, for everything large: the menu, the
marquee, headings, the studio text. On white it is 3.5:1, which passes AA for
large text (24 px and up) only, so small print — the Impressum, the privacy
policy, credits, the footer — uses `#a14dcb`, the same hue darkened to 4.7:1.
Running text that has to stay in the mockup purple, like the project
descriptions, is set at 24 px or larger for the same reason.

### Icons

Flat `#b26dd4` tiles. Any wordmark squeezed into a 32 px favicon is a few
pixels tall and unreadable; the flat colour reads at every size a tab or a home
screen renders.

### Social preview image

`build:og` composes the 1200×630 card rather than screenshotting the page:
`hero-1` on white with the studio's name running across its middle in purple —
the landing page in miniature. The type is rendered by librsvg through
fontconfig, so it is set in whatever the build machine resolves “Helvetica
Neue” to; on a Mac, the real thing.

## Legal

The **Impressum** is on the contact page (`/contact.html#impressum`), reached
from the menu (Contact) or from the footer link on every page. The old
`/imprint.html` redirects there. The **Datenschutzerklärung** stays its own
page, linked from the footer and from the Impressum.

The operator is Galina Kolchina, Eisenbahnstraße 5, 10997 Berlin,
+49 152 21465761. The provider-identification heading cites **§ 5 DDG**: the
Digitale-Dienste-Gesetz replaced the TMG in May 2024. The liability paragraphs
below it still cite §§ 7–10 TMG as they were written; both documents are
standard German boilerplate and a starting point, not legal advice — have them
reviewed.

The privacy policy promises no cookies, no local or session storage and no
third-party requests. None of the scripts store anything, and the
Content-Security-Policy in `netlify.toml` is what actually enforces the rest.

## Redirects

`netlify.toml` sends the retired URLs, which are on printed flyers and in
shared links, to where their content lives now:

| from | to |
|---|---|
| `/zwischentoene.html`, `/zwischentoene` | `/previous-projects.html#zwischentoene` |
| `/imprint.html`, `/imprint` | `/contact.html#impressum` |

## Deployment

Netlify, publish directory `public/`, no build command. `netlify.toml` sets the
cache headers — a year and `immutable` for the hashed `/assets/*`, revalidate
for HTML — the redirects above, and a Content-Security-Policy strict enough to
enforce the claim the privacy policy makes: this site loads nothing from anyone
else.

## Performance

Measured on an iPhone 14 viewport (390×664 at 3×), every request the page
makes including lazy images, before compression:

| | requests | transfer |
|---|---|---|
| `/` | 10 | 245 KB |
| `/on-view.html` | 3 | 13 KB |
| `/previous-projects.html` | 6 | 164 KB |
| `/contact.html` | 3 | 18 KB |

The landing page used to be 2.16 MB, nearly all of it the shopfront video.
Now the largest single file is the graffiti shopfront (`hero2`, 106 KB at
720w) — busy detail is what WebP spends bytes on. The opening photograph in
the studio text is lazy-loaded, so it is not part of the first screen.

## Archive

The Zwischentöne exhibition site — landing video, frame ring, woven
background, drifting rugs — is tagged:

```bash
git checkout zwischentoene-archive   # look around; `git checkout main` to return
```

Its source assets were removed from `src/assets/` in the same change and are in
that tag. The camera master of the landing video (`ledder2.MOV`, 781 MB, never
committed) was moved to `Zwischentöne/archived assets/` in the project folder.
