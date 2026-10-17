// Copyright 2026 SASU Sentient Art
// SPDX-License-Identifier: Apache-2.0
// Headless Chrome over the DevTools protocol, for the tools: WebP encoding (deploy.mjs, webp.mjs) and screenshots.
//   const chrome = await launchChrome(); const page = await chrome.newPage();
//   const webp = await encodeWebp(page, pngBuffer, { mime: "image/png", quality: .9 });   // quality 1 = lossless
//   chrome.close();
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const sleep = ms => new Promise(r => setTimeout(r, ms));

// The browser: CHROME if set, else the first one installed: Chrome, then Chromium, then Edge (on every Windows; same engine)
const env = process.env, programs = [env.PROGRAMFILES, env["PROGRAMFILES(X86)"], env.LOCALAPPDATA].filter(Boolean);
const CANDIDATES = {
  win32: [...programs.map(d => path.join(d, "Google", "Chrome", "Application", "chrome.exe")),
          ...programs.map(d => path.join(d, "Microsoft", "Edge", "Application", "msedge.exe"))],
  darwin: ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", path.join(os.homedir(), "Applications/Google Chrome.app/Contents/MacOS/Google Chrome"),
           "/Applications/Chromium.app/Contents/MacOS/Chromium", "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"],
}[process.platform] || ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "microsoft-edge"]   // Linux: names on the PATH
  .flatMap(name => (env.PATH || "").split(path.delimiter).map(dir => path.join(dir, name)));
export const CHROME = env.CHROME || CANDIDATES.find(f => fs.existsSync(f)) || CANDIDATES[0];
// Flags for every headless run. Linux: no sandbox (Ubuntu 24 blocks it and Chrome aborts); the pages are Keystone's own.
export const CHROME_FLAGS = ["--headless=new", "--hide-scrollbars", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
  ...(process.platform === "linux" ? ["--no-sandbox"] : [])];

export async function launchChrome() {
  if (typeof WebSocket === "undefined") throw new Error(`Node ${process.versions.node} has no WebSocket: Keystone needs Node 22 or later`);
  const port = 9400 + Math.floor(Math.random() * 500);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "keystone-chrome-"));
  const proc = spawn(CHROME, [...CHROME_FLAGS, `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
    "--autoplay-policy=no-user-gesture-required", "about:blank"], { stdio: "ignore" });
  let version;
  for (let i = 0; i < 100 && !version; i++) {
    try { version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); } catch { await sleep(100); }
  }
  if (!version) throw new Error(`Chrome did not start (${CHROME}); set CHROME to its path`);
  const ws = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((ok, fail) => { ws.onopen = ok; ws.onerror = fail; });
  let id = 0;
  const pending = new Map();
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (!pending.has(m.id)) return;
    const { ok, fail } = pending.get(m.id);
    pending.delete(m.id);
    m.error ? fail(new Error(m.error.message)) : ok(m.result);
  };
  const send = (method, params = {}, sessionId) => new Promise((ok, fail) => {
    const i = ++id;
    pending.set(i, { ok, fail });
    ws.send(JSON.stringify({ id: i, method, params, sessionId }));
  });

  async function newPage() {
    const { targetId } = await send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
    const s = (method, params) => send(method, params, sessionId);
    await s("Emulation.setDeviceMetricsOverride", { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
    const evaluate = async expression => {
      const r = await s("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
      return r.result.value;
    };
    return { send: s, evaluate, close: () => send("Target.closeTarget", { targetId }) };
  }

  function close() {
    ws.close();
    proc.kill();
    setTimeout(() => fs.rmSync(profile, { recursive: true, force: true }), 500);
  }
  return { newPage, close };
}

// Encode an image as WebP in the browser; optional width. Quality 1 encodes losslessly (Chrome). The pixels are read
// without colour conversion, so data images (splat maps, checkers) keep their values.
const ENCODE = `async (b64, mime, width, quality) => {
  const bmp = await createImageBitmap(await (await fetch("data:" + mime + ";base64," + b64)).blob(), { colorSpaceConversion: "none" });
  const w = width || bmp.width, h = Math.round(bmp.height * w / bmp.width);
  const canvas = new OffscreenCanvas(w, h), ctx = canvas.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bmp, 0, 0, w, h);
  const bytes = new Uint8Array(await (await canvas.convertToBlob({ type: "image/webp", quality })).arrayBuffer());
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}`;

export async function encodeWebp(page, data, { mime = "image/png", width = 0, quality = 0.9 } = {}) {
  const b64 = Buffer.from(data).toString("base64");
  return Buffer.from(await page.evaluate(`(${ENCODE})(${JSON.stringify(b64)}, "${mime}", ${width}, ${quality})`), "base64");
}
