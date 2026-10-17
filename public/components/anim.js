// Copyright 2026 SASU Sentient Art
// SPDX-License-Identifier: Apache-2.0
// Declarative entrance animations for slides.
// Mark elements with data-in="<delay ms>" and optionally data-anim="fade|pop|draw|wipe|rise" and data-dur="<ms>".
// They play on sa:enter and reset on sa:leave; with no presenter (or before entering) everything stays visible.
(function () {
  const EASE = "cubic-bezier(.2,.7,.2,1)";
  const KF = {
    fade: () => [{ opacity: 0 }, { opacity: 1 }],
    rise: () => [{ opacity: 0, transform: "translateY(14px)" }, { opacity: 1, transform: "none" }],
    pop:  () => [{ opacity: 0, transform: "scale(.6)" }, { opacity: 1, transform: "scale(1)" }],
    // SVG path with pathLength="1" stroke-dasharray="1"; opacity hides its arrowhead until it starts
    draw: () => [{ strokeDashoffset: 1, opacity: 0 }, { strokeDashoffset: .97, opacity: 1, offset: .04 }, { strokeDashoffset: 0, opacity: 1 }],
    wipe: () => [{ clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0% 0 0)" }],
    drop: () => [{ opacity: 0, transform: "translateY(-230px)" }, { opacity: 1, transform: "translateY(-230px)", offset: .05 }, { opacity: 1, transform: "translateY(0)" }],
  };
  let running = [];
  function play(root = document) {
    stop();
    root.querySelectorAll("[data-in]").forEach(el => {
      const kind = el.dataset.anim || "rise";
      const a = el.animate(KF[kind](), {
        duration: +(el.dataset.dur || (kind === "draw" ? 600 : 500)),
        delay: +el.dataset.in, fill: "both",
        easing: kind === "pop" ? "cubic-bezier(.3,1.5,.5,1)" : kind === "drop" ? "cubic-bezier(.5,0,.7,1.25)" : kind === "draw" || kind === "wipe" ? "ease-in-out" : EASE,
      });
      running.push(a);
    });
  }
  function stop() { running.forEach(a => a.cancel()); running = []; }
  addEventListener("sa:enter", () => play());
  addEventListener("sa:leave", stop);
  window.SAAnim = { play, stop };
})();
