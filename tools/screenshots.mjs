// Copyright 2026 SASU Sentient Art
// SPDX-License-Identifier: Apache-2.0
// Capture every slide at 1280×720 into screenshots/NN-id.png (resting state = final layout).
// Usage: npm run shots [-- id1 id2 ...]   (server must be running on PORT, default 4321; shoots the deck it serves)
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { CHROME, CHROME_FLAGS } from "./chrome.mjs";

const PORT = process.env.PORT || 4321;
// DECK_LANG=en npm run shots → English version into screenshots/en/
const EN = process.env.DECK_LANG === "en";
const { dir: DECK_DIR } = await (await fetch(`http://localhost:${PORT}/api/info`)).json();
const out = path.join(DECK_DIR, "screenshots", EN ? "en" : "");
fs.mkdirSync(out, { recursive: true });
const { order } = JSON.parse(fs.readFileSync(path.join(DECK_DIR, "deck.json"), "utf8"));
const only = process.argv.slice(2);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "keystone-shots-"));
process.on("exit", () => fs.rmSync(profile, { recursive: true, force: true }));
const sleep = ms => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
order.forEach((id, i) => {
  if (only.length && !only.includes(id)) return;
  const file = path.join(out, `${String(i + 1).padStart(2, "0")}-${id}.png`);
  fs.rmSync(file, { force: true });
  // A profile of its own: with the default one, Windows hands the command to a Chrome already open, which shoots nothing.
  // On Windows the first start of a new profile can end before the picture is written: wait for it, else shoot again.
  for (let tries = 0; tries < 2 && !fs.existsSync(file); tries++) {
    execFileSync(CHROME, [...CHROME_FLAGS, `--user-data-dir=${profile}`, "--window-size=1280,720", "--virtual-time-budget=3000", `--screenshot=${file}`, `http://localhost:${PORT}/render/${id}${EN ? "?lang=en" : ""}`], { stdio: "ignore" });
    for (let t = 0; t < 50 && !fs.existsSync(file); t++) sleep(100);
  }
  console.log(fs.existsSync(file) ? file : `missing: ${file}`);
});
