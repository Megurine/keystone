// Copyright 2026 SASU Sentient Art
// SPDX-License-Identifier: Apache-2.0
// A quick check that Keystone runs on this machine (macOS, Windows, Linux): every script parses, each example deck is
// served and renders (French and English), screenshots work, and a deck publishes. Used by the CI; run it after a change.
//   node tools/smoke.mjs            exit 1 when something fails; it prints what
// It serves the decks on free ports of its own (from 4700), so a Keystone already running is not disturbed.
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const sleep = ms => new Promise(r => setTimeout(r, ms));
let failed = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) failed++; };

// 1. Every script parses
for (const dir of ["", "tools", "public/components", "public/reader"]) {
  for (const f of fs.readdirSync(path.join(ROOT, dir)).filter(f => /\.(m?js)$/.test(f))) {
    try { execFileSync(process.execPath, ["--check", path.join(ROOT, dir, f)], { stdio: "pipe" }); check(true, `parses: ${path.join(dir, f)}`); }
    catch (e) { check(false, `parses: ${path.join(dir, f)}\n${e.stderr}`); }
  }
}

// 2. Each example deck: served, every slide renders in both languages, screenshots
async function deck(dir, port) {
  const server = spawn(process.execPath, [path.join(ROOT, "server.js"), path.join(ROOT, dir)], { env: { ...process.env, PORT: String(port) }, stdio: "pipe" });
  let log = ""; server.stdout.on("data", d => log += d); server.stderr.on("data", d => log += d);
  try {
    const base = `http://127.0.0.1:${port}`;
    let info;
    for (let i = 0; i < 50 && !info; i++) { try { info = await (await fetch(`${base}/api/info`)).json(); } catch { await sleep(200); } }
    check(!!info, `${dir}: server starts${info ? "" : `\n${log}`}`);
    if (!info) return;
    const { slides = [], languages = [] } = await (await fetch(`${base}/api/deck`)).json();
    check(slides.length > 0, `${dir}: ${slides.length} slides, languages ${languages.join(", ")}`);
    for (const lang of languages) {   // each of the deck's languages: every slide renders, translated (<html lang>) and up to date
      const bad = [], view = await (await fetch(`${base}/api/deck?lang=${lang}`)).json();
      for (const s of view.slides) {
        const r = await fetch(`${base}/render/${s.id}?lang=${lang}`), html = await r.text();
        if (r.status !== 200) bad.push(`${s.id} (${r.status})`);
        else if (s.styled && (!s.translated || s.outdated || !html.includes(`<html lang="${lang}">`))) bad.push(`${s.id} (not translated)`);
      }
      check(!bad.length, `${dir}: every slide renders in ${lang}${bad.length ? `: ${bad.join(", ")}` : ""}`);
    }
    for (const f of ["/", "/public/theme.css", "/public/components/stage.js", "/public/assets/brand/sa-monogram-white.svg"]) {
      const r = await fetch(base + f); check(r.status === 200, `${dir}: GET ${f} (${r.status})`);
    }
    for (const f of ["/public/..%2fserver.js", "/public/..%5cserver.js", "/deck/..%2f..%2fserver.js"]) {
      const r = await fetch(base + f); check(r.status !== 200, `${dir}: GET ${f} is refused (${r.status})`);
    }
    const styled = slides.filter(s => fs.existsSync(path.join(ROOT, dir, "slides", s.id, "slide.html"))).slice(0, 2).map(s => s.id);
    const shots = path.join(ROOT, dir, "screenshots");
    fs.rmSync(shots, { recursive: true, force: true });
    try {
      execFileSync(process.execPath, [path.join(ROOT, "tools", "screenshots.mjs"), ...styled], { env: { ...process.env, PORT: String(port) }, stdio: "pipe", timeout: 120e3 });
      const made = fs.existsSync(shots) ? fs.readdirSync(shots).filter(f => f.endsWith(".png")).map(f => `${f} ${fs.statSync(path.join(shots, f)).size} B`) : [];
      check(made.filter(f => parseInt(f.split(" ")[1]) > 1000).length >= styled.length, `${dir}: screenshots of ${styled.join(", ")}: ${made.join(", ") || "none"}`);
    } catch (e) { check(false, `${dir}: screenshots\n${e.stderr || e.message}`); }
  } finally { server.kill(); await sleep(300); }
}
await deck("examples/hello", 4700);
await deck("library", 4701);
await deck("examples/keystone", 4703);

// 3. A deck publishes (reader page, slides in both languages, thumbnails)
const out = fs.mkdtempSync(path.join(os.tmpdir(), "keystone-smoke-"));
try {
  execFileSync(process.execPath, [path.join(ROOT, "tools", "deploy.mjs"), path.join(ROOT, "examples", "hello"), "--out", out], { stdio: "pipe", timeout: 180e3 });
  const talk = path.join(out, "talks", "hello");
  for (const f of ["index.html", "talk.json", "slides/cover/en.html", "slides/cover/fr.html", "slides/cover/thumb-en.webp", "../index.json", "../_shared/theme.css"]) {
    check(fs.existsSync(path.join(talk, f)), `publish: talks/hello/${f}`);
  }
  check(/Hello Keystone/.test(fs.readFileSync(path.join(talk, "slides", "cover", "en.html"), "utf8")), "publish: the English slide is in English");
  check(/Bonjour Keystone/.test(fs.readFileSync(path.join(talk, "slides", "cover", "fr.html"), "utf8")), "publish: the French slide is in French");
} catch (e) { check(false, `publish\n${e.stderr || e.message}`); }
finally { fs.rmSync(out, { recursive: true, force: true }); }

// 4. Text files keep \n line endings (slide.en.json keys must match slide.html exactly)
const crlf = [];
const walk = dir => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
  const f = path.join(dir, e.name);
  if (e.isDirectory()) { if (!/^(\.git|node_modules|decks|screenshots|vendor)$/.test(e.name)) walk(f); }
  else if (/\.(html|json|js|mjs|css|md|ks|py)$/.test(e.name) && fs.readFileSync(f, "utf8").includes("\r\n")) crlf.push(path.relative(ROOT, f));
} };
walk(ROOT);
check(!crlf.length, `line endings are \\n${crlf.length ? `: ${crlf.slice(0, 5).join(", ")}` : ""}`);

console.log(failed ? `\n${failed} check(s) failed` : "\nAll checks passed");
process.exit(failed ? 1 : 0);
