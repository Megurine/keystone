// Copyright 2026 SASU Sentient Art
// SPDX-License-Identifier: Apache-2.0
// The stage: one iframe per slide (a 1280x720 page), the current one shown whole, the page around it painted to match.
// The page shows its own rail (rail.js) in place of each slide's own rail, so the slide's left 46px are cut off.
// Only slides near the current one stay loaded, because the 3D slides each hold a WebGL context.
// After the last slide comes the end card (end.js), a plain element of this page, shown full screen.
// Slide contract (as in Keystone's presenter): "sa:enter" / "sa:leave" events on the slide's window, body.sa-active
// on the current slide, window.saNext() / saPrev() for builds (return true while a build takes the step), the chapter rail
// .sa-head is 46px wide on the left, the chapter name is .sa-band (or .sa-section-title on chapter covers).
const W = 1280;
const H = 720;
const CUT = 46;   // the slide's own rail, hidden behind the page's rail
const KEEP = 2;   // slides kept loaded on each side of the current one

export function createStage(talk, sources, end) {
  const stage = talk.querySelector('.talk-stage');
  const listeners = { frame: [], change: [], chapter: [] };
  const frames = sources.map(makeFrame);
  const count = frames.length + 1;   // the slides, then the end card
  stage.append(end);
  let index = 0;

  // The whole slide (less its own rail), never cropped: largest size that fits, against the page's rail, centred vertically.
  function fit() {
    const scale = Math.min(stage.clientWidth / (W - CUT), stage.clientHeight / H);
    const y = (stage.clientHeight - H * scale) / 2;
    for (const f of frames) f.style.transform = `translate(${-CUT * scale}px, ${y}px) scale(${scale})`;
    talk.style.setProperty('--slide-right', `${stage.clientWidth - (W - CUT) * scale}px`);   // the close cross sits in the slide's corner
    talk.style.setProperty('--slide-top', `${y}px`);
  }

  // The space left over takes the current slide's background; the page's rail shows the slide's chapter.
  function paint() {
    if (index === frames.length) {
      stage.style.backgroundColor = '';
      for (const fn of listeners.chapter) fn(null);   // the end card
      return;
    }
    try {
      const doc = frames[index].contentDocument;
      if (!doc?.body) return;
      stage.style.backgroundColor = getComputedStyle(doc.body).backgroundColor;
      const chapter = doc.querySelector('.sa-band, .sa-section-title')?.textContent.trim();
      if (chapter) for (const fn of listeners.chapter) fn(chapter);
    } catch {}
  }

  function send(frame, name, dir = 1) {
    try { frame.contentWindow.dispatchEvent(new CustomEvent(name, { detail: { dir } })); } catch {}
  }

  function makeFrame(src, i) {
    const f = document.createElement('iframe');
    f.className = 'talk-frame';
    f.title = `Slide ${i + 1}`;
    f.allow = 'autoplay; fullscreen';
    f.tabIndex = -1;
    f.addEventListener('load', () => {
      if (!f.dataset.src) return;   // about:blank after unloading
      try { for (const fn of listeners.frame) fn(f.contentWindow); } catch {}
      if (frames[index] === f) { f.contentDocument.body.classList.add('sa-active'); send(f, 'sa:enter'); paint(); }
    });
    stage.append(f);
    return f;
  }

  function keepNear() {
    frames.forEach((f, i) => {
      const near = Math.abs(i - Math.min(index, frames.length - 1)) <= KEEP;
      if (near && f.dataset.src !== sources[i]) { f.dataset.src = sources[i]; f.src = sources[i]; }
      if (!near && f.dataset.src) { delete f.dataset.src; f.src = 'about:blank'; }
    });
  }

  function show(i) {
    i = Math.max(0, Math.min(count - 1, i));
    const prev = frames[index];
    if (i !== index && prev) {
      prev.classList.remove('is-on');
      prev.contentDocument?.body?.classList.remove('sa-active');
      send(prev, 'sa:leave');
    }
    const dir = i < index ? -1 : 1;
    index = i;
    keepNear();
    const f = frames[index];
    if (f && !f.classList.contains('is-on')) {
      f.classList.add('is-on');
      f.contentDocument?.body?.classList.add('sa-active');
      send(f, 'sa:enter', dir);
    }
    end.classList.toggle('is-on', !f);
    talk.classList.toggle('is-end', !f);
    paint();
    for (const fn of listeners.change) fn(index);
  }

  // Builds inside a slide take the steps until they are done.
  function step(delta) {
    try { if (frames[index]?.contentWindow[delta > 0 ? 'saNext' : 'saPrev']?.()) return; } catch {}
    show(index + delta);
  }

  new ResizeObserver(fit).observe(stage);
  fit();

  return {
    element: stage,
    count,
    slides: frames.length,
    get index() { return index; },
    get frame() { return frames[index] || null; },   // the current slide's iframe (null on the end card)
    show,
    step,
    on: (type, fn) => listeners[type].push(fn),   // 'frame' (a slide window loaded), 'change' (new current slide), 'chapter' (null: end card)
  };
}
