// Copyright 2026 SASU Sentient Art
// SPDX-License-Identifier: Apache-2.0
// Canvas render resolution for slides. The presenter scales each 1280×720 slide on screen with a CSS transform, so a
// canvas needs screen pixels, not slide pixels: display.js (loaded by every slide page) gives saPixelRatio() and fires
// "sa:resize" when it changes. Figures built with stage.js get this already; use these helpers for the others.
//
//   import { fitRenderer, canvas2d } from "/public/components/canvas.js";
//   fitRenderer(renderer, w, h, redraw?)     three.js view shown at w×h slide px; resized on "sa:resize", then redraw()
//   const ctx = canvas2d(el, w, h, redraw?, units?)  2D canvas shown at w×h slide px, ctx draws in slide px × units;
//                                            on "sa:resize" the backing store is resized, then redraw(ctx)
export const pixelRatio = () => (window.saPixelRatio ? window.saPixelRatio() : (devicePixelRatio || 1));

export function fitRenderer(r, w, h, redraw) {
  const fit = () => { r.setPixelRatio(pixelRatio()); r.setSize(w, h, false); };
  fit();
  addEventListener("sa:resize", () => { fit(); redraw?.(); });
  return r;
}

// The 2D helper lives in display.js (window.saCanvas2d), so classic slide scripts can use it too.
export const canvas2d = (el, w, h, redraw, units = 1) => window.saCanvas2d(el, w, h, redraw, units);
