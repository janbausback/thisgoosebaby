/* Zwischentöne — loading screen, menu accordion, drifting rugs.
   No dependencies, no build step, deferred so it never blocks the first paint. */
(() => {
  'use strict';

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const LOADER_MS = 1500;
  const FADE_MS = 600;

  /* ── Loading screen ─────────────────────────────────────────────────────
     Fixed hold, then wordmark and square fade out together as one unit.
     Under reduced motion there is no hold and no fade: the final state shows
     immediately. Shown on every visit — nothing is remembered between them. */

  const loader = document.getElementById('loader');

  function reveal() {
    document.body.dataset.phase = 'ready';
    if (!loader) return;
    if (reduced.matches) { loader.hidden = true; return; }
    loader.dataset.state = 'out';
    const done = () => { loader.hidden = true; };
    loader.addEventListener('transitionend', done, { once: true });
    setTimeout(done, FADE_MS + 120); // belt and braces if the event is missed
  }

  if (reduced.matches) reveal();
  else setTimeout(reveal, LOADER_MS);

  /* ── Menu ───────────────────────────────────────────────────────────────
     One panel open at a time. No routing, no hash — the button is the whole
     control surface, so keyboard support comes for free. */

  const toggles = Array.from(document.querySelectorAll('.menu-toggle'));

  function setOpen(btn, open) {
    const panel = document.getElementById(btn.getAttribute('aria-controls'));
    if (!panel) return;
    btn.setAttribute('aria-expanded', String(open));
    if (open) panel.dataset.open = '';
    else delete panel.dataset.open;
    // A collapsed panel is clipped, not removed, so its links stay in the tab
    // order unless it is made inert.
    panel.inert = !open;
  }

  toggles.forEach((btn) => {
    setOpen(btn, false); // establishes the inert baseline for every panel

    btn.addEventListener('click', () => {
      const willOpen = btn.getAttribute('aria-expanded') !== 'true';
      toggles.forEach((other) => setOpen(other, other === btn && willOpen));
      if (willOpen) {
        // Keep the item you just opened in view when the ones below shift down.
        requestAnimationFrame(() => {
          btn.scrollIntoView({
            block: 'nearest',
            behavior: reduced.matches ? 'auto' : 'smooth',
          });
        });
      }
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const open = toggles.find((b) => b.getAttribute('aria-expanded') === 'true');
    if (open) { setOpen(open, false); open.focus(); }
  });

  /* ── Drifting rugs ──────────────────────────────────────────────────────
     transform-only, one rAF loop for all of them, paused when the tab is
     hidden. Draggable with pointer events so it works on touch; drift resumes
     from wherever you let go. Purely decorative — nothing is only reachable
     by dragging. */

  const stage = document.querySelector('.floaters');
  const nodes = Array.from(document.querySelectorAll('.floater'));
  if (!stage || !nodes.length) return;

  // Fast enough that the drift is visible within a second or two — that
  // movement is the only cue that the rugs can be picked up and dragged.
  const SPEED = 19;            // px per second, before per-item variation
  const rand = (min, max) => min + Math.random() * (max - min);
  let bounds = { w: 0, h: 0 };

  const items = nodes.map((el, i) => ({
    el,
    x: 0, y: 0,
    vx: 0, vy: 0,
    w: 0, h: 0,
    rot: rand(-2.5, 2.5),   // near-square, as in the reference composition
    seed: i,
    dragging: false,
    pointer: 0,
    grabX: 0, grabY: 0,
  }));

  function measure() {
    bounds = { w: stage.clientWidth, h: stage.clientHeight };
    for (const it of items) {
      const r = it.el.getBoundingClientRect();
      it.w = r.width || it.el.offsetWidth;
      it.h = r.height || it.el.offsetHeight;
    }
  }

  function clamp(it) {
    it.x = Math.min(Math.max(it.x, 0), Math.max(0, bounds.w - it.w));
    it.y = Math.min(Math.max(it.y, 0), Math.max(0, bounds.h - it.h));
  }

  function place(it) {
    it.el.style.transform =
      `translate3d(${it.x.toFixed(2)}px, ${it.y.toFixed(2)}px, 0) rotate(${it.rot.toFixed(2)}deg)`;
  }

  function scatter() {
    measure();
    // Clustered around the middle so the rugs overlap the way they do in the
    // reference composition, with enough jitter that no two loads match.
    items.forEach((it, i) => {
      const cols = Math.max(1, bounds.w - it.w);
      const rows = Math.max(1, bounds.h - it.h);
      const spread = 0.42;
      it.x = cols * (0.5 + (((i + 0.5) / items.length) - 0.5) * 2 * spread * rand(0.6, 1.1));
      it.y = rows * (0.5 + rand(-1, 1) * spread);
      const a = rand(0, Math.PI * 2);
      const s = SPEED * rand(0.6, 1.35);
      it.vx = Math.cos(a) * s;
      it.vy = Math.sin(a) * s;
      clamp(it);
      place(it);
      it.el.dataset.ready = '';
    });
  }

  let last = 0;
  let raf = 0;

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.05); // ignore long gaps
    last = now;
    for (const it of items) {
      if (it.dragging) continue;
      it.x += it.vx * dt;
      it.y += it.vy * dt;
      // Soft bounce: reverse and nudge the angle so paths do not become a loop.
      const maxX = Math.max(0, bounds.w - it.w);
      const maxY = Math.max(0, bounds.h - it.h);
      if (it.x <= 0 || it.x >= maxX) { it.vx *= -1; it.vy += rand(-1.5, 1.5); }
      if (it.y <= 0 || it.y >= maxY) { it.vy *= -1; it.vx += rand(-1.5, 1.5); }
      clamp(it);
      place(it);
    }
  }

  function start() {
    if (raf || reduced.matches) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    if (!raf) return;
    cancelAnimationFrame(raf);
    raf = 0;
  }

  /* Drag */
  for (const it of items) {
    it.el.addEventListener('pointerdown', (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      it.dragging = true;
      it.pointer = e.pointerId;
      it.grabX = e.clientX - it.x;
      it.grabY = e.clientY - it.y;
      it.el.setPointerCapture(e.pointerId);
      it.el.dataset.dragging = '';
      e.preventDefault();
    });

    it.el.addEventListener('pointermove', (e) => {
      if (!it.dragging || e.pointerId !== it.pointer) return;
      it.x = e.clientX - it.grabX;
      it.y = e.clientY - it.grabY;
      clamp(it);
      place(it);
    });

    const release = (e) => {
      if (!it.dragging || e.pointerId !== it.pointer) return;
      it.dragging = false;
      delete it.el.dataset.dragging;
      if (it.el.hasPointerCapture?.(e.pointerId)) it.el.releasePointerCapture(e.pointerId);
      // Resume drifting from the new position, in a fresh direction.
      const a = rand(0, Math.PI * 2);
      const s = SPEED * rand(0.6, 1.35);
      it.vx = Math.cos(a) * s;
      it.vy = Math.sin(a) * s;
    };

    it.el.addEventListener('pointerup', release);
    it.el.addEventListener('pointercancel', release);
    it.el.addEventListener('dragstart', (e) => e.preventDefault());
  }

  scatter();
  if (!reduced.matches) start();

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else start();
  });

  let resizeTimer = 0;
  addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      measure();
      for (const it of items) { clamp(it); place(it); }
    }, 150);
  });

  reduced.addEventListener('change', () => {
    if (reduced.matches) stop();
    else start();
  });
})();
