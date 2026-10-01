/* The landing picture: three photographs, hard cuts, one every two seconds.
   The pictures are stacked in the markup and `is-active` decides which one
   shows; there is no transition, the cut is the effect. */
(() => {
  'use strict';

  const INTERVAL_MS = 2000;

  let slides = Array.from(document.querySelectorAll('.hero__img'));
  if (slides.length < 2) return;

  let index = Math.max(0, slides.findIndex((img) => img.classList.contains('is-active')));
  let timer = 0;

  // Resolves once the picture can be shown without a half-drawn frame, or
  // with false if it never arrived. A cut is only ever made to a decoded image.
  function ready(img) {
    const decoded = () => (img.decode ? img.decode().then(() => true, () => img.naturalWidth > 0) : true);
    if (img.complete) return Promise.resolve(img.naturalWidth > 0 && decoded());
    return new Promise((resolve) => {
      img.addEventListener('load', () => resolve(decoded()), { once: true });
      img.addEventListener('error', () => resolve(false), { once: true });
    });
  }

  async function advance() {
    const next = slides[(index + 1) % slides.length];
    if (!(await ready(next))) {
      // A picture that failed to load drops out of the rotation for this visit.
      slides = slides.filter((img) => img !== next);
      index = slides.indexOf(document.querySelector('.hero__img.is-active'));
      if (slides.length > 1) schedule();
      return;
    }
    if (document.hidden) return; // picked up again by visibilitychange
    slides[index].classList.remove('is-active');
    index = slides.indexOf(next);
    next.classList.add('is-active');
    schedule();
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(advance, INTERVAL_MS);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clearTimeout(timer);
    else schedule();
  });

  schedule();
})();
