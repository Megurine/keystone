// Copyright 2026 SASU Sentient Art
// SPDX-License-Identifier: Apache-2.0
// Render resolution for canvases. The presenter and the reader show each 1280×720 slide in an iframe scaled with a CSS
// transform, so devicePixelRatio alone renders too few pixels on a large screen. Loaded by every slide page.
//   saPixelRatio() — screen pixels per slide pixel (devicePixelRatio × slide scale, 1 to 3).
//   "sa:resize" fires on the slide's window when that value changes (window resized, moved to another screen).
//   saCanvas2d(el, w, h, redraw?, units = 1) — 2D canvas shown at w×h slide px, backing store in screen pixels; the
//     returned context draws in slide px × units (units 2: code written for a fixed 2× canvas keeps its coordinates).
//     On "sa:resize" the backing store is resized, then redraw(ctx). Modules: canvas2d() in /public/components/canvas.js.
//   saT(fr, en) — a string written by code, in the page's language (<html lang>): saT("Rouge", "Red"),
//     n.toLocaleString(saT("fr-FR", "en-US")). Text in the markup is translated by slide.en.json instead.
//   <a href="deck:<id>#<n>"> — a link to slide n of another deck (see below).
(() => {
  const scale = () => {
    try { const w = frameElement && frameElement.getBoundingClientRect().width; if (w) return w / 1280; } catch {}
    return 1;
  };
  window.saPixelRatio = () => Math.min(3, Math.max(1, (window.devicePixelRatio || 1) * scale()));
  let last = saPixelRatio();
  const check = () => requestAnimationFrame(() => {   // after the parent has applied its new transform
    const r = saPixelRatio();
    if (Math.abs(r - last) > 0.01) { last = r; dispatchEvent(new Event("sa:resize")); }
  });
  window.saT = (fr, en) => (document.documentElement.lang === "en" ? en : fr);
  window.saCanvas2d = (el, w, h, redraw, units = 1) => {
    const ctx = el.getContext("2d");
    const fit = () => {
      const k = saPixelRatio();
      el.width = Math.round(w * k); el.height = Math.round(h * k);
      el.style.width = w + "px"; el.style.height = h + "px";
      ctx.setTransform(el.width / (w * units), 0, 0, el.height / (h * units), 0, 0);
    };
    fit();
    if (redraw) addEventListener("sa:resize", () => { fit(); redraw(ctx); });
    return ctx;
  };
  // Links to another deck: <a href="deck:library#3"> (slide number optional). In Keystone each deck has its own port
  // (/api/decks); the published reader gets plain links from tools/deploy.mjs, or none when that deck is not published.
  addEventListener("click", async e => {
    const a = e.target.closest?.('a[href^="deck:"]'); if (!a) return;
    e.preventDefault();
    const [, id, slide = ""] = a.getAttribute("href").match(/^deck:([\w-]+)(#\d+)?$/) || [];
    try {
      const d = (await (await fetch("/api/decks")).json()).decks.find(x => x.id === id);
      if (!d) return console.warn(`Keystone: deck "${id}" is not served by this server`);
      top.location.href = `${location.protocol}//${location.hostname}:${d.port}/${top.location.search}${slide}`;
    } catch {}
  });
  try { parent.addEventListener("resize", check); } catch {}
  addEventListener("resize", check);
  addEventListener("sa:enter", check);
})();
