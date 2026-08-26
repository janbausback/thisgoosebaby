(function () {
  "use strict";

  var video = document.querySelector(".hero__video");
  if (!video) return;

  // Low Power Mode (and similar restricted states) can silently block the
  // autoplay attribute — no error, and WebKit then draws its own "tap to
  // play" button over the paused video. That button lives in UA shadow DOM
  // that Apple no longer lets pages style away, so instead the video stays
  // fully transparent (revealing the plain <img> poster underneath) until
  // it's genuinely playing, at which point any built-in overlay is already
  // invisible along with the rest of the element. There's no API to detect
  // Low Power Mode or force playback without one; the only way through is
  // a real user gesture, so retry play() on the first touch/click/key too.
  function reveal() {
    video.classList.add("is-playing");
  }

  function tryPlay() {
    if (!video.paused) return;
    video.play().catch(function () {});
  }

  function onFirstInteraction() {
    tryPlay();
    ["touchstart", "click", "keydown"].forEach(function (type) {
      window.removeEventListener(type, onFirstInteraction);
    });
  }

  video.addEventListener("playing", reveal);
  video.addEventListener("loadedmetadata", tryPlay);
  ["touchstart", "click", "keydown"].forEach(function (type) {
    window.addEventListener(type, onFirstInteraction, { passive: true });
  });
})();
