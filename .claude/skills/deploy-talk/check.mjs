// Copyright 2026 SASU Sentient Art
// SPDX-License-Identifier: Apache-2.0
// Check a deployed talk in headless Chrome, as a visitor sees it: serves <out> at its root, opens
// /talks/<slug>/ in every language, steps through every slide to the end card with the arrow key, then opens it once at
// phone size. Prints JS errors and failed requests; writes a screenshot per step into <shots dir>.
// Usage: node .claude/skills/deploy-talk/check.mjs <out folder> <slug> <shots dir>
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";

const [outArg, slug, shotsArg] = process.argv.slice(2);
if (!outArg || !slug || !shotsArg) { console.error("Usage: node check.mjs <out folder> <slug> <shots dir>"); process.exit(1); }
const OUT = path.resolve(outArg);
const SHOTS = path.resolve(shotsArg);
fs.mkdirSync(SHOTS, { recursive: true });
const info = JSON.parse(fs.readFileSync(path.join(OUT, "talks", slug, "talk.json"), "utf8"));
const sleep = ms => new Promise(r => setTimeout(r, ms));

const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".json": "application/json",
  ".svg": "image/svg+xml", ".webp": "image/webp", ".jpg": "image/jpeg", ".woff2": "font/woff2", ".mp4": "video/mp4", ".webm": "video/webm" };
const server = http.createServer((req, res) => {
  let file = path.join(OUT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (fs.statSync(file, { throwIfNoEntry: false })?.isDirectory()) file = path.join(file, "index.html");
  if (!file.startsWith(OUT) || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});
await new Promise(r => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;

const CHROME = process.env.CHROME || { win32: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  darwin: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" }[process.platform] || "google-chrome";
const port = 9800 + Math.floor(Math.random() * 190);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "talk-check-"));
const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--hide-scrollbars",
  "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "about:blank"], { stdio: "ignore" });

const problems = [];
let ws;
try {
  let targets;
  for (let i = 0; i < 100 && !targets; i++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); } catch { await sleep(100); } }
  ws = new WebSocket(targets.find(t => t.type === "page").webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);
  let id = 0, where = "";
  const pending = new Map();
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); }
    if (m.method === "Runtime.exceptionThrown") problems.push(`${where}: JS ${m.params.exceptionDetails.exception?.description?.split("\n")[0]}`);
    if (m.method === "Network.responseReceived" && m.params.response.status >= 400) problems.push(`${where}: ${m.params.response.status} ${m.params.response.url}`);
  };
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const size = (width, height) => send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 760 });
  const shot = async name => { const { data } = await send("Page.captureScreenshot", { format: "png" }); fs.writeFileSync(path.join(SHOTS, `${name}.png`), Buffer.from(data, "base64")); };
  const right = async () => { for (const type of ["keyDown", "keyUp"]) await send("Input.dispatchKeyEvent", { type, key: "ArrowRight", code: "ArrowRight", windowsVirtualKeyCode: 39 }); };
  await send("Runtime.enable"); await send("Network.enable"); await send("Page.enable");

  for (const lang of info.languages) {
    await size(1440, 900);
    where = `${lang} #1`;
    await send("Page.navigate", { url: `${base}/talks/${slug}/?lang=${lang}#1` });
    await sleep(3000);
    for (let n = 1; n <= info.slides.length + 1; n++) {
      where = n > info.slides.length ? `${lang} end card` : `${lang} #${n} ${info.slides[n - 1]}`;
      if (n > 1) { await right(); await sleep(2500); }   // most entrances end within 2.5 s (library/components/anim)
      await shot(`${lang}-${String(n).padStart(2, "0")}`);
    }
  }
  await size(390, 844);
  where = "phone #1";
  await send("Page.navigate", { url: `${base}/talks/${slug}/#1` });
  await sleep(3000);
  await shot("phone-01");
} finally {
  ws?.close();
  chrome.kill();
  server.close();
}
console.log(problems.length ? problems.join("\n") : `${slug}: no JS error, no failed request`);
console.log(`screenshots: ${SHOTS}`);
process.exitCode = problems.length ? 1 : 0;
