// Copyright 2026 SASU Sentient Art
// SPDX-License-Identifier: Apache-2.0
// The "⋯" menu, top right next to the close cross: what matters less than reading. Downloads made in the reader's own
// browser, nothing stored on the server: the whole talk as a PDF (print.js), the current slide as PNG or WebP
// (capture.js; WebP only where the browser can write it, not in Safari).
import { captureSlide } from './capture.js';
import { printTalk } from './print.js';

const STRINGS = {
  en: {
    more: 'More', pdf: 'Download PDF', asPng: 'This slide (PNG)', asWebp: 'This slide (WebP)',
    capturing: 'Capturing…', failed: 'Capture failed',
    preparing: (i, n) => `Preparing the PDF · ${i} / ${n}`, ready: 'PDF ready',
    hint: 'In the print window, set the destination to “Save as PDF”: a printer, or Microsoft Print to PDF, changes the page size.', cancel: 'Cancel', close: 'Close',
  },
  fr: {
    more: 'Plus', pdf: 'Télécharger en PDF', asPng: 'Cette slide (PNG)', asWebp: 'Cette slide (WebP)',
    capturing: 'Capture…', failed: 'Capture impossible',
    preparing: (i, n) => `Préparation du PDF · ${i} / ${n}`, ready: 'PDF prêt',
    hint: 'Dans la fenêtre d’impression, choisissez la destination « Enregistrer au format PDF » : une imprimante, ou Microsoft Print to PDF, change le format des pages.', cancel: 'Annuler', close: 'Fermer',
  },
};

const pad = n => String(n).padStart(2, '0');

function canWrite(type) {
  const c = document.createElement('canvas');
  c.width = c.height = 1;
  return c.toDataURL(type).startsWith(`data:${type}`);
}

function save(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}

export function initMenu(talk, stage, { base, slides, lang, title }) {
  const t = STRINGS[lang] || STRINGS.en;
  const slug = base.split('/').filter(Boolean).pop();
  const button = talk.querySelector('.talk-more');
  button.setAttribute('aria-label', t.more);
  button.title = t.more;

  const menu = document.createElement('div');
  menu.className = 'talk-menu mono';
  menu.id = 'talk-menu';
  menu.setAttribute('role', 'menu');
  menu.hidden = true;
  menu.innerHTML = [
    `<button type="button" role="menuitem" data-do="pdf">${t.pdf}</button>`,
    `<button type="button" role="menuitem" data-do="png" data-slide>${t.asPng}</button>`,
    canWrite('image/webp') ? `<button type="button" role="menuitem" data-do="webp" data-slide>${t.asWebp}</button>` : '',
  ].join('');
  talk.append(menu);
  button.setAttribute('aria-controls', menu.id);
  const items = [...menu.querySelectorAll('button')];

  function toggle(open = menu.hidden) {
    menu.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
    if (open) items.find(b => !b.disabled)?.focus();
  }

  button.addEventListener('click', () => toggle());
  addEventListener('pointerdown', e => { if (!menu.hidden && !menu.contains(e.target) && !button.contains(e.target)) toggle(false); });
  addEventListener('keydown', e => {   // before the reader's keys (controls.js): Escape closes the menu, not the talk
    if (menu.hidden) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); toggle(false); button.focus(); }
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault(); e.stopImmediatePropagation();
      const live = items.filter(b => !b.disabled);
      live[(live.indexOf(document.activeElement) + (e.key === 'ArrowDown' ? 1 : -1) + live.length) % live.length]?.focus();
    } else if (!['Tab', 'Enter', ' '].includes(e.key)) e.stopImmediatePropagation();
  }, true);

  // The end card has no slide to capture. A new slide closes the menu.
  stage.on('change', i => {
    for (const b of menu.querySelectorAll('[data-slide]')) b.disabled = i >= stage.slides;
    if (!menu.hidden && !busy) toggle(false);
  });

  let busy = false;
  menu.addEventListener('click', async e => {
    const item = e.target.closest('[data-do]');
    if (!item || item.disabled || busy) return;
    const what = item.dataset.do;
    if (what === 'pdf') {
      toggle(false);
      printTalk({ sources: slides.map(id => `${base}slides/${id}/${lang}.html`), title, t }).catch(err => console.error(err));
      return;
    }
    const frame = stage.frame;
    if (!frame) return;
    busy = true;
    const label = item.textContent;
    item.textContent = t.capturing;
    try {
      const blob = await captureSlide(frame, { type: `image/${what}` });
      save(blob, `${slug}-${lang}-${pad(stage.index + 1)}.${what}`);
      toggle(false);
    } catch (err) {
      console.error(err);
      item.textContent = t.failed;
      await new Promise(r => setTimeout(r, 2000));
    } finally {
      item.textContent = label;
      busy = false;
    }
  });

  return { toggle, get open() { return !menu.hidden; } };
}
