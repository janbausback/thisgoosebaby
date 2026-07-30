const hero = document.querySelector(".hero");
const footer = document.querySelector(".hero__footer");

function moveFooter(x, y) {
  footer.style.left = `${x}px`;
  footer.style.top = `${y}px`;
  footer.style.bottom = "auto";
  footer.style.transform = "translate(-50%, -130%)";
}

hero.addEventListener("mousemove", (e) => {
  moveFooter(e.clientX, e.clientY);
});

hero.addEventListener(
  "touchstart",
  (e) => {
    const touch = e.touches[0];
    if (touch) moveFooter(touch.clientX, touch.clientY);
  },
  { passive: true }
);

hero.addEventListener(
  "touchmove",
  (e) => {
    const touch = e.touches[0];
    if (touch) moveFooter(touch.clientX, touch.clientY);
  },
  { passive: true }
);
