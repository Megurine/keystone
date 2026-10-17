// Copyright 2026 SASU Sentient Art
// SPDX-License-Identifier: Apache-2.0
// Convert the PNG and JPEG images of decks (or any folder) to WebP, in place, and update every reference to them.
//
//   node tools/webp.mjs <folder> … [--dry]      e.g. node tools/webp.mjs decks/my-talk library public/assets/brand
//
// Encoding (in the installed Chrome, as tools/deploy.mjs does): JPEG → lossy .82. PNG → lossless when that is at most
// 25 % bigger than lossy .9 (diagrams, UV layouts, flat colours), else lossy .9 (renders, photos). Data images (splat
// maps, checkers, UDIM tiles: names matching DATA below) are always lossless, so their values stay exact.
// Each image becomes <name>.webp next to it and the original is deleted (git keeps it). References are rewritten in the
// text files of this repository (slides, translations, components, JSON, CSS, docs, deck tools): "<name>.png" →
// "<name>.webp" for every converted file name. Images whose name is used by a file that stays (see SKIP) are not converted.
//
// Skipped: screenshots/, .trash/, import/, src/, node_modules/, public/vendor/; reference.png (editor comparison) and
// thumb.png (library cards); *.uhdr.jpg (Ultra HDR: the gain map must stay JPEG).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchChrome, encodeWebp } from "./chrome.mjs";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2), DRY = args.includes("--dry"), folders = args.filter(a => a !== "--dry");
if (!folders.length) { console.error("Usage: node tools/webp.mjs <folder> … [--dry]"); process.exit(1); }

const SKIP_DIRS = new Set(["screenshots", ".trash", "import", "src", "node_modules", ".git", "vendor"]);
const SKIP = /^(reference|thumb)\.png$|\.uhdr\.jpg$/i;
const DATA = /splat|checker|udim/i;
const IMAGE = /\.(png|jpe?g)$/i;
const TEXT = /\.(html|json|js|mjs|css|md|py)$/i;

function walk(dir, out = [], skip = SKIP_DIRS) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!skip.has(e.name)) walk(path.join(dir, e.name), out, skip); }
    else out.push(path.join(dir, e.name));
  }
  return out;
}

const images = folders.flatMap(f => walk(path.resolve(f))).filter(f => IMAGE.test(f) && !SKIP.test(path.basename(f)));
// Names that must not change: every other image of the repository, skipped folders included (Blender sources, imports).
const kept = new Set(walk(ROOT, [], new Set([".git", "node_modules"])).filter(f => IMAGE.test(f) && !images.includes(f)).map(f => path.basename(f)));
const todo = images.filter(f => {
  if (!kept.has(path.basename(f))) return true;
  console.warn(`  kept ${path.relative(ROOT, f)}: another image with that name stays, a rename would hit both`);
  return false;
});
if (!todo.length) { console.log("Nothing to convert."); process.exit(0); }

let before = 0, after = 0;
const renamed = new Set();
const chrome = DRY ? null : await launchChrome();
try {
  const page = chrome && await chrome.newPage();
  for (const src of todo) {
    const data = fs.readFileSync(src), png = /\.png$/i.test(src), mime = png ? "image/png" : "image/jpeg";
    const rel = path.relative(ROOT, src).replaceAll(path.sep, "/");
    before += data.length;
    if (DRY) { console.log(`  ${rel}`); renamed.add(path.basename(src)); continue; }
    let out, kind;
    if (!png) { out = await encodeWebp(page, data, { mime, quality: 0.82 }); kind = "lossy .82"; }
    else {
      const lossless = await encodeWebp(page, data, { mime, quality: 1 });
      const lossy = DATA.test(rel) ? null : await encodeWebp(page, data, { mime, quality: 0.9 });
      [out, kind] = !lossy || lossless.length <= lossy.length * 1.25 ? [lossless, "lossless"] : [lossy, "lossy .9"];
    }
    fs.writeFileSync(src.replace(IMAGE, ".webp"), out);
    fs.rmSync(src);
    after += out.length;
    renamed.add(path.basename(src));
    console.log(`  ${rel}: ${(data.length / 1e3).toFixed(0)} → ${(out.length / 1e3).toFixed(0)} kB (${kind})`);
  }
} finally { chrome?.close(); }

// References: a converted file name, after a path separator, quote, bracket or space, gets the .webp extension.
const names = [...renamed].map(n => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
const ref = new RegExp(`(?<=^|[/"'(\`\\s=])(${names.join("|")})(?![\\w.])`, "g");
let files = 0, refs = 0;
for (const f of walk(ROOT).filter(f => TEXT.test(f))) {
  const text = fs.readFileSync(f, "utf8");
  let n = 0;
  const next = text.replace(ref, m => (n++, m.replace(IMAGE, ".webp")));
  if (!n) continue;
  files++; refs += n;
  if (DRY) console.log(`  ${path.relative(ROOT, f)}: ${n} reference(s)`);
  else fs.writeFileSync(f, next);
}
console.log(`${todo.length} images${DRY ? "" : `: ${(before / 1e6).toFixed(1)} → ${(after / 1e6).toFixed(1)} MB`}; ${refs} references in ${files} files${DRY ? " (dry run)" : ""}`);
