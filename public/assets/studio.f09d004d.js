/* The studio text on `/`, sized to fill exactly one screen.
   home.css makes a close first guess; this measures the real text and
   corrects it, which matters on any phone whose shape or fonts the guess was
   not fitted to. The section is below the fold, so nothing on screen moves
   when it does. */
(() => {
  'use strict';

  const section = document.querySelector('.studio');
  if (!section) return;

  // Only the text is fitted; the photograph after it is not part of the
  // screen it fills.
  const paragraphs = Array.from(section.querySelectorAll('.studio__text'));
  // The size is set on <main>, not on the text: the hero reads it as well,
  // to let the first line of this text peek in at the bottom of the screen.
  const scope = section.parentElement;

  const MIN_PX = 16;
  const MAX_PX = 112;
  const RESIZE_DEBOUNCE_MS = 150;

  // 100svh in pixels: the screen with the browser's toolbars showing. Unlike
  // innerHeight it stays put when the toolbars collapse on scroll, so the type
  // is never resized under the reader's eyes.
  const probe = document.createElement('div');
  probe.setAttribute('aria-hidden', 'true');
  probe.style.cssText =
    'position:absolute;top:0;left:0;width:0;height:100vh;height:100svh;visibility:hidden;pointer-events:none';
  document.body.append(probe);

  let fittedFor = '';

  function contentHeight() {
    const first = paragraphs[0].getBoundingClientRect();
    const last = paragraphs[paragraphs.length - 1].getBoundingClientRect();
    return last.bottom - first.top;
  }

  function fit() {
    const width = document.documentElement.clientWidth;
    const screen = probe.offsetHeight || innerHeight;
    const key = `${width}×${screen}`;
    if (key === fittedFor) return;
    fittedFor = key;

    const style = getComputedStyle(section);
    const room = screen - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);

    // Height does not grow smoothly with size — lines break in steps — so
    // bisect on the real layout rather than solving for it. Twelve rounds
    // take the 16–112px range to well under a tenth of a pixel.
    //
    // `lo` is always a size that was measured to fit, and the search ends
    // right against a line break, so it is set exactly as measured: rounding
    // it, even up by a thousandth of a pixel, can push a word onto a new line.
    let lo = MIN_PX;
    let hi = MAX_PX;
    for (let i = 0; i < 12; i++) {
      const mid = (lo + hi) / 2;
      scope.style.setProperty('--studio-size', `${mid}px`);
      if (contentHeight() <= room) lo = mid;
      else hi = mid;
    }
    scope.style.setProperty('--studio-size', `${lo}px`);
  }

  let timer = 0;
  addEventListener('resize', () => {
    clearTimeout(timer);
    timer = setTimeout(fit, RESIZE_DEBOUNCE_MS);
  });

  fit();
})();
