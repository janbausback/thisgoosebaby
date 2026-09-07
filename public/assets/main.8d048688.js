/* Zwischentöne — loading screen, menu accordion, hero video.
   No dependencies, no build step, deferred so it never blocks the first paint. */
(() => {
  'use strict';

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const LOADER_MS = 1500;
  const FADE_MS = 600;

  /* ── Loading screen ─────────────────────────────────────────────────────
     Fixed hold, then the wordmark fades out. Under reduced motion there is
     no hold and no fade: the final state shows immediately. Shown on every
     visit — nothing is remembered between them. */

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

  /* ── Hero video ────────────────────────────────────────────────────────
     The poster <img> underneath is what actually paints; the video fades in
     only once it is confirmed playing, so a blocked or slow autoplay never
     shows a stalled black frame — it just leaves the poster in place.
     Under reduced motion it is left paused and hidden, poster only. */

  const video = document.querySelector('.hero-video');
  if (!video) return;

  function showVideo() { video.classList.add('is-playing'); }
  function hideVideo() { video.classList.remove('is-playing'); }

  function tryPlay() {
    if (reduced.matches || !video.paused) return;
    video.play().catch(() => {});
  }

  // Low Power Mode (and similar restricted states) can silently block
  // autoplay — no error, just a video that never starts. There is no API to
  // detect that or force playback without one, so the only way through is a
  // real user gesture: retry on the first touch/click/key anywhere on the page.
  function onFirstInteraction() {
    tryPlay();
    ['touchstart', 'click', 'keydown'].forEach((type) =>
      window.removeEventListener(type, onFirstInteraction)
    );
  }

  video.addEventListener('playing', showVideo);
  video.addEventListener('loadedmetadata', tryPlay);
  ['touchstart', 'click', 'keydown'].forEach((type) =>
    window.addEventListener(type, onFirstInteraction, { passive: true })
  );

  reduced.addEventListener('change', () => {
    if (reduced.matches) { video.pause(); hideVideo(); }
    else tryPlay();
  });

  // The `autoplay` attribute is a native fallback for if this script is slow
  // to run; undo it immediately when motion is reduced rather than relying
  // on the change listener, which only fires on a later toggle.
  if (reduced.matches) video.pause();
  else tryPlay();
})();
