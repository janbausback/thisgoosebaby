/* The burger menu, on every page. The CSS does all the drawing — the lines
   turning into an X, the links coming in, the white sheet behind them — so
   this only flips the state. No dependencies, deferred so it never blocks the
   first paint. */
(() => {
  'use strict';

  const top = document.querySelector('.top');
  const button = top && top.querySelector('.burger');
  if (!button) return;

  const isOpen = () => button.getAttribute('aria-expanded') === 'true';

  function setOpen(open) {
    button.setAttribute('aria-expanded', String(open));
    top.classList.toggle('is-open', open);
  }

  button.addEventListener('click', () => setOpen(!isOpen()));

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !isOpen()) return;
    setOpen(false);
    button.focus();
  });

  // A tap anywhere but a link or the burger closes it: outside the header, or
  // on the open sheet beside the links (the sheet is the header's own
  // ::before, so such a tap targets the header itself).
  document.addEventListener('click', (e) => {
    if (isOpen() && (!top.contains(e.target) || e.target === top)) setOpen(false);
  });

  // Going back to a page restores it from the back/forward cache exactly as it
  // was left, which is with the menu open, since a menu link is how one leaves.
  addEventListener('pageshow', (e) => {
    if (e.persisted) setOpen(false);
  });
})();
