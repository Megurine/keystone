// Copyright 2026 SASU Sentient Art
// SPDX-License-Identifier: Apache-2.0
// A slide as an image, made in the reader's own browser with no library (the "This slide" items of menu.js).
// The slide's DOM is copied with its computed styles written inline (animations at their current values), its
// ::before / ::after as spans, its fonts and images as data: URLs and its canvases and videos as stills, into an SVG
// <foreignObject> that a canvas draws. The published slides are on the same origin, so all of them can be read.
// Limits: a video gives its current frame; an iframe inside a slide stays empty; a WebGL canvas that keeps no drawing
// buffer and does not redraw on "sa:resize" can come out blank (stage.js figures keep their buffer).
const W = 1280;
const H = 720;
const XHTML = 'http://www.w3.org/1999/xhtml';
const SVG = 'http://www.w3.org/2000/svg';
const SKIP = new Set(['script', 'style', 'link', 'meta', 'base', 'noscript', 'template', 'title', 'head']);
const URL_RE = /url\((["']?)([^"')]+)\1\)/g;
const IMG = { namespaceURI: XHTML, localName: 'img' };
const SPAN = { namespaceURI: XHTML, localName: 'span' };

// The pixels of every canvas and video of a slide, as 2D canvases (null when there is nothing to read).
// Read in an animation frame, after the slide's own drawing of that frame: a WebGL buffer is only readable before the
// browser shows it. A canvas that comes out of one colour is asked to redraw ("sa:resize", which canvas.js and
// stage.js answer) and read again, for figures that draw once and keep no buffer.
export function stills(win) {
  const els = [...win.document.querySelectorAll('canvas, video')];
  if (!els.length) return Promise.resolve(new Map());
  return new Promise(resolve => win.requestAnimationFrame(() => {
    const out = new Map(els.map(el => [el, read(el)]));
    const flat = els.filter(el => el.localName === 'canvas' && plain(out.get(el)));
    if (flat.length) {
      try { win.dispatchEvent(new win.Event('sa:resize')); } catch {}
      for (const el of flat) out.set(el, read(el));
    }
    resolve(out);
  }));
}

function read(el) {
  const w = el.videoWidth || el.width, h = el.videoHeight || el.height;
  if (!w || !h) return null;
  try {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    c.getContext('2d').drawImage(el, 0, 0, w, h);
    return c;
  } catch { return null; }
}

// One colour everywhere (empty, or a WebGL buffer already cleared), on a 32×18 sample.
function plain(c) {
  if (!c) return true;
  const s = document.createElement('canvas');
  s.width = 32; s.height = 18;
  const g = s.getContext('2d', { willReadFrequently: true });
  g.drawImage(c, 0, 0, 32, 18);
  const d = new Uint32Array(g.getImageData(0, 0, 32, 18).data.buffer);
  return d.every(v => v === d[0]);
}

// Default computed styles of each element type, read in an empty page: a property equal to its default and to the
// parent's value is left out, which keeps the copy small (the result is the same whether it inherits or not).
function defaults() {
  const box = document.createElement('iframe');
  box.style.cssText = 'position:fixed;left:-10000px;top:0;width:100px;height:100px;border:0;visibility:hidden';
  document.body.append(box);
  const doc = box.contentDocument;
  doc.open(); doc.write('<!doctype html><html><head></head><body><svg></svg></body></html>'); doc.close();
  const cache = new Map();
  return {
    get(el) {
      const key = `${el.namespaceURI} ${el.localName}`;
      if (!cache.has(key)) {
        const d = doc.createElementNS(el.namespaceURI, el.localName);
        (el.namespaceURI === SVG && el.localName !== 'svg' ? doc.querySelector('svg') : doc.body).append(d);
        const cs = box.contentWindow.getComputedStyle(d), m = new Map();
        for (let i = 0; i < cs.length; i++) m.set(cs[i], cs.getPropertyValue(cs[i]));
        d.remove();
        cache.set(key, m);
      }
      return cache.get(key);
    },
    remove: () => box.remove(),
  };
}

function styleText(cs, base, parent) {
  let s = '';
  for (let i = 0; i < cs.length; i++) {
    const p = cs[i];
    if (p.startsWith('animation') || p.startsWith('transition')) continue;   // frozen at their current values
    const v = cs.getPropertyValue(p);
    if (base && parent && v === base.get(p) && v === parent.getPropertyValue(p)) continue;
    s += `${p}:${v};`;
  }
  return s;
}

// The text of a computed "content" value: its strings and attr() values.
function contentText(content, el) {
  let s = '';
  content.replace(/"((?:[^"\\]|\\.)*)"|attr\(\s*([\w-]+)\s*\)/g, (m, str, attr) => {
    s += str != null ? str.replace(/\\([0-9a-fA-F]{1,6})\s?|\\(.)/g, (e, hex, ch) => hex ? String.fromCodePoint(parseInt(hex, 16)) : ch)
      : el.getAttribute(attr) || '';
  });
  return s;
}

function pseudo(node, which, cs, ctx) {
  const ps = ctx.win.getComputedStyle(node, which);
  const content = ps.content;
  if (!content || content === 'none' || content === 'normal' || ps.display === 'none') return null;
  const span = document.createElementNS(XHTML, 'span');
  ctx.styled.push([span, styleText(ps, ctx.base.get(SPAN), cs)]);
  const text = contentText(content, node);
  if (text) span.textContent = text;
  return span;
}

function walk(node, parentCs, ctx) {
  if (node.nodeType === Node.TEXT_NODE) return document.createTextNode(node.data);
  if (node.nodeType !== Node.ELEMENT_NODE) return null;
  const tag = node.localName;
  if (SKIP.has(tag)) return null;
  const svg = node.namespaceURI === SVG;
  const cs = ctx.win.getComputedStyle(node);
  if (cs.display === 'none' && !svg) return null;   // SVG defs (markers, gradients) are used without being shown
  for (const f of cs.fontFamily.split(',')) ctx.families.add(f.trim().replace(/^["']|["']$/g, '').toLowerCase());

  const root = tag === 'html' || tag === 'body';
  const still = tag === 'canvas' || tag === 'video';
  let out;
  if (still) {
    out = document.createElementNS(XHTML, 'img');
    const c = ctx.shots.get(node);
    if (c) out.setAttribute('src', c.toDataURL());
  } else if (root || tag === 'iframe') {
    out = document.createElementNS(XHTML, 'div');
  } else {
    out = document.createElementNS(node.namespaceURI, tag);
    for (const a of node.attributes) {
      if (/^(on|style$|srcset$|loading$)/i.test(a.name)) continue;
      if (tag === 'img' && a.name === 'src') continue;
      if (tag === 'image' && /(^|:)href$/.test(a.name)) { ctx.links.push([out, a.namespaceURI, a.name, new URL(a.value, node.baseURI).href]); continue; }
      out.setAttributeNS(a.namespaceURI, a.name, a.value);
    }
    if (tag === 'img' && (node.currentSrc || node.src)) ctx.links.push([out, null, 'src', node.currentSrc || node.src]);
  }

  let style = styleText(cs, root ? null : ctx.base.get(still ? IMG : node), root ? null : parentCs);
  if (tag === 'html') style += `width:${W}px;height:${H}px;overflow:hidden;`;
  ctx.styled.push([out, style]);

  if (!svg) { const b = pseudo(node, '::before', cs, ctx); if (b) out.append(b); }
  if (!still && tag !== 'iframe') for (const child of node.childNodes) { const c = walk(child, cs, ctx); if (c) out.append(c); }
  if (!svg) { const a = pseudo(node, '::after', cs, ctx); if (a) out.append(a); }
  return out;
}

const cache = new Map();
function dataUrl(url) {
  if (url.startsWith('data:')) return Promise.resolve(url);
  if (!cache.has(url)) {
    cache.set(url, fetch(url).then(r => (r.ok ? r.blob() : null)).then(b => b && new Promise(res => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result);
      fr.onerror = () => res(null);
      fr.readAsDataURL(b);
    })).catch(() => null));
  }
  return cache.get(url);
}

// The @font-face rules of the slide for the families it uses, their files as data: URLs.
async function fontCss(win, families) {
  const faces = [];
  const visit = list => {
    for (const r of list) {
      if (r instanceof win.CSSFontFaceRule) faces.push(r);
      else if (r instanceof win.CSSImportRule) { try { visit(r.styleSheet.cssRules); } catch {} }
      else if (r.cssRules) visit(r.cssRules);
    }
  };
  for (const sheet of win.document.styleSheets) { try { visit(sheet.cssRules); } catch {} }
  const used = faces.filter(r => families.has(r.style.getPropertyValue('font-family').trim().replace(/^["']|["']$/g, '').toLowerCase()));
  const css = await Promise.all(used.map(async r => {
    const base = r.parentStyleSheet?.href || win.document.baseURI;
    let text = r.cssText;
    for (const [m, , u] of text.matchAll(URL_RE)) {
      const d = await dataUrl(new URL(u, base).href);
      if (d) text = text.replace(m, `url("${d}")`);
    }
    return text;
  }));
  return css.join('\n');
}

const xml = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// The slide of an iframe as an image Blob of (1280 × scale) × (720 × scale) pixels.
export async function captureSlide(frame, { scale = 2, type = 'image/png' } = {}) {
  const win = frame.contentWindow, doc = frame.contentDocument;
  await doc.fonts?.ready;
  const ctx = { win, shots: await stills(win), base: defaults(), styled: [], links: [], families: new Set() };
  let root;
  try { root = walk(doc.documentElement, null, ctx); } finally { ctx.base.remove(); }

  const urls = new Set(ctx.links.map(l => l[3]));
  for (const [, s] of ctx.styled) for (const m of s.matchAll(URL_RE)) if (!m[2].startsWith('data:')) urls.add(m[2]);
  const found = new Map(await Promise.all([...urls].map(async u => [u, await dataUrl(u)])));
  for (const [el, s] of ctx.styled) el.setAttribute('style', s.replace(URL_RE, (m, q, u) => (found.get(u) ? `url("${found.get(u)}")` : m)));
  for (const [el, ns, name, u] of ctx.links) el.setAttributeNS(ns, name, found.get(u) || u);

  const fonts = await fontCss(win, ctx.families);
  const svg = `<svg xmlns="${SVG}" width="${W * scale}" height="${H * scale}"><foreignObject x="0" y="0" width="100%" height="100%">` +
    `<div xmlns="${XHTML}" style="width:${W}px;height:${H}px;overflow:hidden;transform:scale(${scale});transform-origin:0 0">` +
    `<style>${xml(fonts)}</style>${new XMLSerializer().serializeToString(root)}</div></foreignObject></svg>`;

  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = W * scale; canvas.height = H * scale;
  const g = canvas.getContext('2d');
  g.drawImage(img, 0, 0);
  await new Promise(r => setTimeout(r, 150));   // Safari draws the images inside a foreignObject from the second time on
  g.clearRect(0, 0, canvas.width, canvas.height);
  g.drawImage(img, 0, 0);
  return new Promise((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('toBlob failed'))), type, 0.92));
}
