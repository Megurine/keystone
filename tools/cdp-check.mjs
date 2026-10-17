// Copyright 2026 SASU Sentient Art
// SPDX-License-Identifier: Apache-2.0
// Drive the real presenter in headless Chrome over the DevTools protocol (real time, real key presses).
// Usage: node tools/cdp-check.mjs <slideNumber> "<actions>" <out-prefix>
//   actions: comma list of  wait:<ms> | key:<ArrowRight|ArrowLeft|...> | shot:<name>
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { CHROME, CHROME_FLAGS } from "./chrome.mjs";
const [slide = "1", actions = "wait:1500,shot:a", prefix = path.join(os.tmpdir(), "cdp")] = process.argv.slice(2);
const PORT = 9333 + Math.floor(Math.random() * 500);
const chrome = spawn(CHROME, [...CHROME_FLAGS, `--remote-debugging-port=${PORT}`, "--window-size=1280,720", `--user-data-dir=${path.join(os.tmpdir(), `cdp-${PORT}`)}`, "about:blank"], { stdio: "ignore" });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ws, id = 0; const pending = new Map();
const send = (method, params = {}) => new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
try {
  let targets;
  for (let i = 0; i < 50; i++) { try { targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); break; } catch { await sleep(100); } }
  const page = targets.find(t => t.type === "page");
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); } };
  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: `http://localhost:${process.env.PORT || 4321}/${process.env.DECK_LANG === "en" ? "?lang=en" : ""}#${slide}` });
  await sleep(2500);
  for (const a of actions.split(",")) {
    const [k, v] = a.split(":");
    if (k === "wait") await sleep(+v);
    if (k === "key") for (const type of ["keyDown", "keyUp"]) await send("Input.dispatchKeyEvent", { type, key: v, code: v, windowsVirtualKeyCode: { ArrowRight: 39, ArrowLeft: 37 }[v] || 0 });
    if (k === "shot") { const { data } = await send("Page.captureScreenshot", { format: "png" }); (await import("node:fs")).writeFileSync(`${prefix}-${v}.png`, Buffer.from(data, "base64")); console.log(`${prefix}-${v}.png`); }
  }
} finally { ws?.close(); chrome.kill(); }
