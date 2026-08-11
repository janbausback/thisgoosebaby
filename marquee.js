(function () {
  "use strict";

  var UNIT = "STUDIO KOLCHINA & GORDON • ";
  var SPEED_PX_PER_SEC = 60; // moderate/readable; tune 50–70 after eyeballing
  var RESIZE_DEBOUNCE_MS = 150;
  // The animated ring re-triggers the hand-printed SVG filter (turbulence +
  // displacement + blur) over a viewport-sized element on every DOM write.
  // That's expensive enough that writing it 60x/sec makes Safari stutter.
  // Capping writes to ~30fps keeps the filter cost sane while still reading
  // as smooth motion; the position itself still accumulates every rAF tick
  // (below) so average speed stays correct regardless of paint rate.
  var PAINT_INTERVAL_MS = 33;

  var svg        = document.querySelector(".hero-marquee");
  var pathEl     = document.getElementById("framePath");
  var measureEl  = document.getElementById("frameMeasure");
  var textPathEl = document.getElementById("frameTextPath");
  var heroEl     = document.querySelector(".hero");

  if (!svg || !pathEl || !measureEl || !textPathEl || !heroEl) return;

  var currentRepeats = 0;

  // Animation state, driven by rAF (not SMIL — see tick() for why).
  var oneUnitPct = 0;   // one repeat-unit's length, in % of totalLen
  var percentPerMs = 0; // travel speed, in % of totalLen per millisecond
  var offsetPct = 0;    // current position within [0, oneUnitPct)
  var lastTs = null;
  var lastPaintTs = null;

  function clampNum(v, min, max) { return Math.max(min, Math.min(max, v)); }

  function computeInset(w, h) {
    return clampNum(Math.min(w, h) * 0.028, 14, 34);
  }

  function computeRadius(w, h, inset) {
    var r = clampNum(Math.min(w, h) * 0.06, 22, 60);
    var maxAllowed = Math.max((Math.min(w, h) - 2 * inset) / 2, 0);
    return Math.min(r, maxAllowed);
  }

  function buildPathD(w, h, inset, r) {
    var x0 = inset, y0 = inset, x1 = w - inset, y1 = h - inset;
    return [
      "M", x0 + r, y0,
      "L", x1 - r, y0,
      "A", r, r, 0, 0, 1, x1, y0 + r,
      "L", x1, y1 - r,
      "A", r, r, 0, 0, 1, x1 - r, y1,
      "L", x0 + r, y1,
      "A", r, r, 0, 0, 1, x0, y1 - r,
      "L", x0, y0 + r,
      "A", r, r, 0, 0, 1, x0 + r, y0,
      "Z",
    ].join(" ");
  }

  function layout() {
    var rect = heroEl.getBoundingClientRect();
    var w = Math.round(rect.width);
    var h = Math.round(rect.height);
    if (w <= 0 || h <= 0) return;

    svg.setAttribute("viewBox", "0 0 " + w + " " + h);

    var inset  = computeInset(w, h);
    var radius = computeRadius(w, h, inset);
    pathEl.setAttribute("d", buildPathD(w, h, inset, radius));

    measureEl.textContent = UNIT;
    var unitLen = measureEl.getComputedTextLength();
    if (!unitLen || !isFinite(unitLen) || unitLen <= 0) return;

    var totalLen = pathEl.getTotalLength();
    if (!totalLen || !isFinite(totalLen) || totalLen <= 0) return;

    // Pick the nearest whole number of repeat-units that tiles one full lap
    // of the path, then force-fit them to *exactly* totalLen via
    // textLength/lengthAdjust="spacing" (a sub-pixel letter-spacing nudge,
    // not a font-size change — imperceptible). That makes the ring
    // mathematically closed by construction — zero gap, zero overflow,
    // no seam at the join — rather than relying on a buffer of slack text
    // and hoping it's enough. This is what makes it adapt exactly to any
    // screen size/aspect ratio.
    var repeatsPerLoop = Math.max(1, Math.round(totalLen / unitLen));
    var laps = 2; // 2nd lap = animation slack, not visible
    var repeats = repeatsPerLoop * laps;

    if (repeats !== currentRepeats) {
      textPathEl.textContent = UNIT.repeat(repeats);
      currentRepeats = repeats;
    }

    textPathEl.setAttribute("textLength", String(totalLen * laps));
    textPathEl.setAttribute("lengthAdjust", "spacing");

    // Animates regardless of prefers-reduced-motion — intentional: this is
    // decorative/ambient motion the site wants running unconditionally.
    //
    // The text block only ever extends forward from startOffset, so it must
    // never go positive, or the block's start point drags past the path's
    // own start (position 0), leaving a growing uncovered gap at the
    // top-left join. Keeping it in [-oneUnit, 0] avoids that. This is driven
    // frame-by-frame via requestAnimationFrame rather than a SMIL <animate>:
    // SMIL's discrete jump back to `from` at every repeat was producing a
    // visible one-letter flash right at the seam on each loop. A continuous
    // rAF-driven update has no such "restart" instant — it's just an
    // ordinary attribute write every frame, same as any other JS animation.
    oneUnitPct = 100 / repeatsPerLoop; // exact, in % of totalLen
    var exactUnitLen = totalLen / repeatsPerLoop;
    percentPerMs = (SPEED_PX_PER_SEC / exactUnitLen) * oneUnitPct / 1000;
  }

  function tick(ts) {
    if (lastTs === null) lastTs = ts;
    var dt = ts - lastTs;
    lastTs = ts;

    if (oneUnitPct > 0) {
      offsetPct = (offsetPct + percentPerMs * dt) % oneUnitPct;
      if (lastPaintTs === null || ts - lastPaintTs >= PAINT_INTERVAL_MS) {
        lastPaintTs = ts;
        // startOffset must increase over time (toward 0, never past it) for
        // the snake to travel clockwise while staying gap-safe — see layout().
        textPathEl.setAttribute("startOffset", (offsetPct - oneUnitPct) + "%");
      }
    }

    requestAnimationFrame(tick);
  }

  var resizeTimer = null;
  function scheduleLayout() {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(layout, RESIZE_DEBOUNCE_MS);
  }

  layout();
  requestAnimationFrame(tick);
  window.addEventListener("resize", scheduleLayout);
  window.addEventListener("orientationchange", scheduleLayout);
})();
