(function () {
  "use strict";

  // No-break spaces either side of the bullet: SVG strips trailing whitespace,
  // and the loop below depends on every repeat of the unit being the same
  // width, the last one included. xml:space="preserve" on the <text> says the
  // same thing; this keeps it true wherever that attribute is not honoured.
  var UNIT = "STUDIO KOLCHINA & GORDON • ";
  // Pace in ems rather than pixels, so the line reads at the same speed at
  // every size. 3.6em/s is the ring's old 60px/s at the mockup's 16.5px type.
  var SPEED_EM_PER_SEC = 3.6;
  var RESIZE_DEBOUNCE_MS = 150;

  var strip  = document.querySelector(".marquee");
  var track  = strip && strip.querySelector(".marquee__track");
  var text   = track && track.querySelector(".marquee__text");
  var filter = document.getElementById("handPrinted");
  var noise  = document.getElementById("handPrintedNoise");

  if (!strip || !track || !text) return;

  var laidOutAt = 0; // viewport width the current layout was built for

  // The track holds two identical halves, each at least a viewport wide. The
  // CSS animation slides it left by exactly one half and starts over, which
  // puts every letter where the same letter one half further on stood: no
  // seam, no jump. The motion is a transform on the compositor, so the text
  // and its texture are painted once per layout rather than once per frame —
  // the ring had to rewrite startOffset every frame and was capped at 30fps
  // for it.
  function layout() {
    var vw = document.documentElement.clientWidth;
    // Height-only resizes are the phone's toolbar coming and going; the type
    // is sized off the width, so there is nothing to redo.
    if (!vw || vw === laidOutAt) return;

    // Lengths come from where the glyphs actually start, not from
    // getComputedTextLength(): WebKit leaves letter-spacing out of that figure
    // but not out of the drawing, so on an iPhone it overstates every unit by
    // 27 × 0.01em and the loop would jump by the difference each time round.
    text.textContent = UNIT + UNIT;
    var unit = text.getStartPositionOfChar(UNIT.length).x - text.getStartPositionOfChar(0).x;
    if (!unit || !isFinite(unit) || unit <= 0) return;

    var perHalf = Math.max(1, Math.ceil(vw / unit));
    text.textContent = UNIT.repeat(perHalf * 2);
    var half = text.getStartPositionOfChar(perHalf * UNIT.length).x - text.getStartPositionOfChar(0).x;
    var total = half * 2;
    var height = track.getBoundingClientRect().height;
    var fontSize = parseFloat(getComputedStyle(strip).fontSize);
    if (!half || !height || !fontSize) return;

    track.setAttribute("width", total);
    track.setAttribute("height", height);
    track.style.width = total + "px";

    // The hand-printed texture: noise baked for one half and tiled across
    // both, so the texture repeats with the text and the loop stays seamless.
    // stitchTiles makes the noise itself wrap cleanly at the tile edge.
    if (filter && noise) {
      filter.setAttribute("width", total);
      filter.setAttribute("height", height);
      noise.setAttribute("width", half);
      noise.setAttribute("height", height);
      strip.setAttribute("data-textured", "");
    }

    // Runs regardless of prefers-reduced-motion — the same deliberate stance
    // the ring took: ambient motion the site wants running unconditionally.
    track.style.animationDuration = half / (fontSize * SPEED_EM_PER_SEC) + "s";
    strip.setAttribute("data-running", "");
    laidOutAt = vw;
  }

  var resizeTimer = null;
  function scheduleLayout() {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(layout, RESIZE_DEBOUNCE_MS);
  }

  layout();
  window.addEventListener("resize", scheduleLayout);
  window.addEventListener("orientationchange", scheduleLayout);
})();
