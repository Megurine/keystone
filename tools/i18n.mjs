// Slide translations: one slide.html (markup, styles, code, in the deck's source language) + slide.<lang>.json (text).
// Used by server.js (/render/<id>?lang=en) and tools/deploy.mjs, so both build the same page.
//
//   slide.en.json = {
//     "blocks": { "<source innerHTML of an element>": "<translated innerHTML>", … },
//     "attrs":  { "<source alt / title / aria-label value>": "<translated value>", … }
//   }
//
// A block replaces an element's whole content (so bold, links, line breaks can move in the translation); it only
// matches between ">" and "<", so a short key never hits other text. Attribute values match whole alt="…",
// title="…", aria-label="…". Script and style contents are never touched: strings in code use saT(fr, en)
// (public/components/display.js). A key that no longer matches the source (the source text was edited) is reported
// in `missing`: that part shows in the source language, and the presenter flags the slide's translation as outdated.
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

export function readTranslation(slideDir, lang) {
  const f = path.join(slideDir, `slide.${lang}.json`);
  return existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : null;
}

const RAW = /(<script\b[^>]*>[\s\S]*?<\/script>|<style\b[^>]*>[\s\S]*?<\/style>)/gi;   // left untouched

export function translate(html, tr) {
  if (!tr) return { html, missing: [] };
  const blocks = Object.entries(tr.blocks || {}).sort((a, b) => b[0].length - a[0].length);   // longest first
  const attrs = Object.entries(tr.attrs || {});
  const parts = html.split(RAW);                     // odd indexes: script / style elements
  const found = new Set();
  for (let i = 0; i < parts.length; i += 2) {
    let s = parts[i];
    for (const [src, dst] of blocks) {
      const key = ">" + src + "<";
      if (s.includes(key)) { s = s.split(key).join(">" + dst + "<"); found.add("b:" + src); }
    }
    for (const [src, dst] of attrs)
      s = s.replace(new RegExp(`(\\s(?:alt|title|aria-label)=)(["'])${src.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\2`, "g"),
        (m, a, q) => (found.add("a:" + src), a + q + dst + q));
    parts[i] = s;
  }
  const missing = [...blocks.map(([k]) => "b:" + k), ...attrs.map(([k]) => "a:" + k)].filter(k => !found.has(k)).map(k => k.slice(2));
  return { html: parts.join(""), missing };
}
