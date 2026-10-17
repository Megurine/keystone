// Overview: every slide as a thumbnail (slides/<id>/thumb-<lang>.webp, made by tools/deploy.mjs), the end card last.
// Opens from the toolbar or the O key; a click goes to that slide; Escape or O closes it.
export function initOverview(talk, stage, { base, slides, lang, endLabel }) {
  const panel = document.createElement('div');
  panel.className = 'talk-overview';
  panel.hidden = true;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Overview');
  const pad = n => String(n).padStart(2, '0');
  const tiles = [
    ...slides.map((id, i) => `<li><button type="button" data-go="${i}" aria-label="Slide ${i + 1}">
      <img src="${base}slides/${id}/thumb-${lang}.webp" alt="" loading="lazy" width="400" height="225"><span class="mono">${pad(i + 1)}</span></button></li>`),
    `<li><button type="button" data-go="${slides.length}" class="talk-overview-end"><b class="mono">${endLabel}</b></button></li>`,
  ];
  panel.innerHTML = `<ol class="talk-overview-grid">${tiles.join('')}</ol>`;
  talk.append(panel);
  const buttons = [...panel.querySelectorAll('[data-go]')];

  function toggle(open = panel.hidden) {
    panel.hidden = !open;
    talk.classList.toggle('is-overview', open);
    if (!open) { stage.element.focus(); return; }
    buttons.forEach((b, i) => b.classList.toggle('is-current', i === stage.index));
    buttons[stage.index].scrollIntoView({ block: 'center' });
    buttons[stage.index].focus({ preventScroll: true });
  }

  panel.addEventListener('click', e => {
    const b = e.target.closest('[data-go]');
    if (!b) return;
    toggle(false);
    stage.show(Number(b.dataset.go));
  });

  return { toggle, get open() { return !panel.hidden; } };
}
