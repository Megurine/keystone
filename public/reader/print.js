// Copyright 2026 SASU Sentient Art
// SPDX-License-Identifier: Apache-2.0
// "Download PDF" (menu.js): every slide at rest, one 1280×720 page each, through the browser's own print window
// ("Save as PDF"). Nothing is made or stored on the server, and the text stays text.
// The slides load a few at a time in a print sheet, under a progress card. Each one is played to its end (sa:enter,
// builds stepped through with saNext, animations finished, the files its 3D figures load: window.saPending of
// stage.js), its background becomes a layer of its own (browsers leave the page background out of a print unless
// asked), then its canvases and videos become still 2D canvases and its WebGL contexts are freed (a browser keeps only
// a few). Then the page prints the sheet alone.
import { stills } from './capture.js';

const AT_ONCE = 3;   // slides prepared at the same time
const wait = ms => new Promise(r => setTimeout(r, ms));
const frame = win => new Promise(r => win.requestAnimationFrame(() => r()));

// Until the slide has nothing left to load (3D files, images, other files) for 200 ms; at most 15 s.
async function idle(win, max = 15000) {
  const t0 = performance.now();
  let n = -1, since = t0;
  while (performance.now() - t0 < max) {
    const count = win.performance.getEntriesByType('resource').length;
    const busy = win.saPending?.size || ![...win.document.images].every(i => i.complete);
    if (busy || count !== n) { n = count; since = performance.now(); }
    else if (performance.now() - since > 200) return;
    await wait(50);
  }
}

// The page background (html or body) as an element under the slide: printed like any other element.
function backgroundLayer(win) {
  const doc = win.document;
  const html = win.getComputedStyle(doc.documentElement);
  const bg = html.backgroundColor !== 'rgba(0, 0, 0, 0)' || html.backgroundImage !== 'none' ? html : win.getComputedStyle(doc.body);
  const layer = doc.createElement('div');
  layer.style.cssText = 'position:absolute;left:0;top:0;width:1280px;height:720px;z-index:-1;pointer-events:none;' +
    ['color', 'image', 'size', 'position', 'repeat', 'origin', 'clip'].map(p => `background-${p}:${bg.getPropertyValue(`background-${p}`)}`).join(';');
  doc.body.prepend(layer);
}

async function settle(win) {
  const doc = win.document;
  doc.head.insertAdjacentHTML('beforeend', '<style>*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}</style>');
  backgroundLayer(win);
  doc.body.classList.add('sa-active');
  win.dispatchEvent(new win.CustomEvent('sa:enter', { detail: { dir: 1 } }));
  const finish = () => { for (const a of doc.getAnimations()) try { a.finish(); } catch {} };   // endless ones cannot finish: they keep their current frame
  await doc.fonts?.ready;
  await frame(win); finish();
  for (let i = 0; i < 30 && win.saNext?.(); i++) { await frame(win); finish(); }
  await idle(win);
  await frame(win); await frame(win);   // the figures draw what they loaded
  finish();
}

// Canvases and videos become 2D canvases holding their current picture; the WebGL contexts are freed.
async function freeze(win) {
  const doc = win.document;
  for (const [el, pic] of await stills(win)) {
    if (!pic) continue;
    const cs = win.getComputedStyle(el);
    const copy = doc.createElement('canvas');
    for (const a of el.attributes) if (a.name !== 'width' && a.name !== 'height') copy.setAttribute(a.name, a.value);
    copy.width = pic.width; copy.height = pic.height;
    copy.style.width = cs.width; copy.style.height = cs.height;
    copy.getContext('2d').drawImage(pic, 0, 0);
    el.replaceWith(copy);
    if (el.localName === 'video') el.pause();
    else { try { (el.getContext('webgl2') || el.getContext('webgl'))?.getExtension('WEBGL_lose_context')?.loseContext(); } catch {} }
  }
}

// sources: the slide pages; title: the PDF's name (the page title while printing); t: the menu's strings.
export async function printTalk({ sources, title, t }) {
  const sheet = document.createElement('div');
  sheet.className = 'talk-print';
  sheet.setAttribute('aria-hidden', 'true');
  const card = document.createElement('div');
  card.className = 'talk-printing';
  card.setAttribute('role', 'status');
  card.innerHTML = '<p class="mono"></p><p class="talk-printing-hint"></p><button type="button" class="link"></button>';
  const [label, hint] = card.querySelectorAll('p');
  const button = card.querySelector('button');
  button.textContent = t.cancel;
  const page = document.createElement('style');
  page.textContent = '@page { size: 1280px 720px; margin: 0; }';
  const oldTitle = document.title;

  let stopped = false;
  const stop = () => {
    stopped = true;
    sheet.remove(); card.remove(); page.remove();
    document.body.classList.remove('is-printing');
    document.title = oldTitle;
    removeEventListener('keydown', onKey, true);
    removeEventListener('afterprint', stop);
  };
  const onKey = e => { e.stopImmediatePropagation(); if (e.key === 'Escape') { e.preventDefault(); stop(); } };   // the reader's keys wait
  button.addEventListener('click', stop);
  addEventListener('keydown', onKey, true);

  // One iframe per slide, in order; a few load at a time (later ones on top, in view: browsers slow down hidden frames).
  const frames = sources.map(() => {
    const f = document.createElement('iframe');
    f.className = 'talk-print-frame';
    f.tabIndex = -1;
    return f;
  });
  sheet.append(...frames);
  document.body.append(sheet, card);
  button.focus();

  let next = 0, done = 0;
  const show = () => { label.textContent = t.preparing(done, sources.length); };
  async function worker() {
    for (let i; !stopped && (i = next++) < sources.length; ) {
      const f = frames[i];
      f.style.zIndex = String(i + 1);
      await new Promise(r => { f.addEventListener('load', r, { once: true }); f.src = sources[i]; });
      if (stopped) return;
      await settle(f.contentWindow);
      await freeze(f.contentWindow);
      done++; show();
    }
  }

  try {
    show();
    await Promise.all(Array.from({ length: Math.min(AT_ONCE, sources.length) }, worker));
    if (stopped) return;
    label.textContent = t.ready;
    hint.textContent = t.hint;
    button.textContent = t.close;
    document.head.append(page);
    document.body.classList.add('is-printing');
    document.title = title;
    addEventListener('afterprint', stop);   // phones return from print() at once: clean up when the window closes
    await wait(100);
    window.print();
  } catch (e) {
    stop();
    throw e;
  }
}
