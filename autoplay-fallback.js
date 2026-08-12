(function () {
  "use strict";

  var video = document.querySelector(".hero__video");
  if (!video) return;

  // Low Power Mode (and similar restricted states) can silently block the
  // autoplay attribute — no error, the video just stays paused on its
  // poster frame. There's no API to detect that state or force playback
  // without one; the only way through is a real user gesture, so retry
  // play() on the first touch/click/key the page receives.
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

  video.addEventListener("loadedmetadata", tryPlay);
  ["touchstart", "click", "keydown"].forEach(function (type) {
    window.addEventListener(type, onFirstInteraction, { passive: true });
  });
})();
