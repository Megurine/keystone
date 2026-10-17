// The end card, after the last slide of every talk: share the talk, follow the author, write to them.
// Same for every talk, in the talk's language (English, or French when the talk is read in French).
// The follow links and the contact address come from site.json (site.follow: [[name, url]], site.contact,
// and site.work: { en: "…", fr: "…" } for the text above the contact button); without them, those parts are left out.

const STRINGS = {
  en: {
    label: 'End of the talk', title: 'Thanks for reading.',
    share: 'Share', shareText: 'Know someone who would like this talk? Send it to them.',
    shareNative: 'Share…', copy: 'Copy link', copied: 'Link copied',
    follow: 'Follow', followText: 'New talks, tools and work, as they come out.',
    work: 'Work with us', workText: 'Like what you see? Tell us what you need to build.',
    contact: 'Contact us', end: 'End',
  },
  fr: {
    label: 'Fin de la présentation', title: 'Merci de votre lecture.',
    share: 'Partager', shareText: 'Quelqu’un autour de vous aimerait cette présentation ? Envoyez-la-lui.',
    shareNative: 'Partager…', copy: 'Copier le lien', copied: 'Lien copié',
    follow: 'Suivre', followText: 'Nouvelles présentations, outils et projets, dès leur sortie.',
    work: 'Travailler avec nous', workText: 'Ce que vous voyez vous plaît ? Dites-nous ce que vous voulez construire.',
    contact: 'Nous écrire', end: 'Fin',
  },
};

export const endStrings = lang => STRINGS[lang] || STRINGS.en;

export function createEnd(talk, { lang, languages, title, site = {} }) {
  const follow = site.follow || [];
  const t = endStrings(lang);
  const url = `${location.origin}${location.pathname}${lang === languages[0] ? '' : `?lang=${lang}`}`;
  const end = document.createElement('section');
  end.className = 'talk-end';
  end.lang = lang;
  end.setAttribute('aria-label', t.label);
  end.innerHTML = `
    <div class="talk-end-body">
      <p class="label mono">${t.label}</p>
      <h2>${t.title}</h2>
      <div class="talk-end-grid">
        <div>
          <h3 class="mono">${t.share}</h3>
          <p>${t.shareText}</p>
          <div class="talk-end-actions">
            ${navigator.share ? `<button type="button" class="link" data-share>${t.shareNative}</button>` : ''}
            <button type="button" class="link" data-copy>${t.copy}</button>
            <a class="link" href="https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}" target="_blank" rel="noopener">LinkedIn</a>
          </div>
        </div>
        ${follow.length ? `<div>
          <h3 class="mono">${t.follow}</h3>
          <p>${t.followText}</p>
          <ul class="talk-end-actions">
            ${follow.map(([name, href]) => `<li><a class="link" href="${href}" target="_blank" rel="noopener">${name}</a></li>`).join('')}
          </ul>
        </div>` : ''}
        ${site.contact ? `<div class="talk-end-work">
          <h3 class="mono">${t.work}</h3>
          <p>${site.work?.[lang] || t.workText}</p>
          <a class="button" href="${site.contact}">${t.contact}</a>
        </div>` : ''}
      </div>
    </div>`;

  end.querySelector('[data-share]')?.addEventListener('click', () => navigator.share({ title, url }).catch(() => {}));
  const copy = end.querySelector('[data-copy]');
  copy.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(url); } catch { prompt(t.copy, url); return; }
    copy.textContent = t.copied;
    setTimeout(() => { copy.textContent = t.copy; }, 2000);
  });
  return end;
}
