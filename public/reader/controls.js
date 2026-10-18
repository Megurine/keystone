// Copyright 2026 SASU Sentient Art
// SPDX-License-Identifier: Apache-2.0
// Everything the reader uses to move: toolbar, keys, swipe, overview, full screen, language link, the #slide address.
// The toolbar and the close cross fade out when the pointer rests, unless it rests on them.
const pad = n => String(n).padStart(2, '0');

export function initControls(talk, stage, overview, { lang, languages, endLabel }) {
  const count = talk.querySelector('.talk-count');
  const close = talk.querySelector('.talk-close');
  const langLink = talk.querySelector('.talk-lang');

  // The other language (the next one when a talk has more than two). The default language has no ?lang.
  const other = languages[(languages.indexOf(lang) + 1) % languages.length];
  langLink.hidden = languages.length < 2;
  langLink.textContent = other.toUpperCase();
  langLink.hreflang = other;
  const query = other === languages[0] ? '' : `?lang=${other}`;

  stage.on('change', i => {
    count.textContent = i < stage.slides ? `${pad(i + 1)} / ${pad(stage.slides)}` : endLabel;
    history.replaceState(null, '', `${location.search}#${i + 1}`);
    langLink.href = `${location.pathname}${query}#${i + 1}`;   // the other language opens on the same slide
  });

  function onKey(e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'o' || e.key === 'O') overview.toggle();
    else if (e.key === 'Escape' && overview.open) overview.toggle(false);
    else if (overview.open) return;   // in the overview, Tab and Enter pick a slide
    else if (['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); stage.step(1); }
    else if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key)) { e.preventDefault(); stage.step(-1); }
    else if (e.key === 'Home') stage.show(0);
    else if (e.key === 'End') stage.show(stage.count - 1);
    else if (e.key === 'f' || e.key === 'F') toggleFullscreen();
    else if (e.key === 'Escape' && !document.fullscreenElement) location.href = close.href;
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.().catch(() => {});
  }

  // Swipe left or right on touch screens.
  function onSwipe(target) {
    let x0 = null;
    target.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
    target.addEventListener('touchend', e => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 50) stage.step(dx < 0 ? 1 : -1);
      x0 = null;
    });
  }

  let timer;
  let hovered = 0;   // pointer over the toolbar or the close cross
  function wake() {
    talk.classList.remove('is-idle');
    clearTimeout(timer);
    timer = setTimeout(() => { if (!hovered) talk.classList.add('is-idle'); }, 2500);
  }
  for (const el of [talk.querySelector('.talk-bar'), close, talk.querySelector('.talk-more'), talk.querySelector('.talk-menu')]) {
    if (!el) continue;
    el.addEventListener('pointerenter', () => { hovered++; wake(); });
    el.addEventListener('pointerleave', () => { hovered = Math.max(0, hovered - 1); wake(); });
  }

  talk.querySelectorAll('[data-step]').forEach(b => b.addEventListener('click', () => stage.step(Number(b.dataset.step))));
  talk.querySelector('.talk-fullscreen').addEventListener('click', toggleFullscreen);
  talk.querySelector('.talk-overview-open').addEventListener('click', () => overview.toggle());
  addEventListener('hashchange', () => stage.show(Number(location.hash.slice(1)) - 1));
  addEventListener('keydown', onKey);
  onSwipe(stage.element);
  for (const type of ['pointermove', 'keydown', 'touchstart']) addEventListener(type, wake, { passive: true });

  // The slides take keys, touches and pointer moves while they have them: listen inside each one too.
  stage.on('frame', win => {
    win.addEventListener('keydown', onKey);
    win.addEventListener('pointermove', wake);
    onSwipe(win);
  });

  wake();
}
