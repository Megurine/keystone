// Copyright 2026 SASU Sentient Art
// SPDX-License-Identifier: Apache-2.0
// Keystone reader (read-only): reads the talk's talk.json (written by tools/deploy.mjs) and shows its slides.
// The page is talks/<slug>/index.html, generated from public/reader/talk.html; <main data-talk> gives the folder.
// Links that belong to the host site (home, talk list, contact, follow) come from site.json next to this file.
// The first language by default; ?lang=<code> for another one; #<n> opens slide n.
import { createStage } from './stage.js';
import { initControls } from './controls.js';
import { checkRequirements } from './checks.js';
import { createEnd, endStrings } from './end.js';
import { initOverview } from './overview.js';
import { initRail } from './rail.js';
import { initMenu } from './menu.js';

async function init() {
  const talk = document.querySelector('.talk');
  const base = talk.dataset.talk;
  const [info, site] = await Promise.all([
    fetch(`${base}talk.json`).then(r => r.json()),
    fetch(new URL('site.json', import.meta.url)).then(r => r.json()).catch(() => ({})),
  ]);
  if (site.index) talk.querySelector('.talk-close').href = site.index;
  if (site.home) document.querySelector('.talk-rail .rail-logo').href = site.home;

  const asked = new URLSearchParams(location.search).get('lang');
  const lang = info.languages.includes(asked) ? asked : info.languages[0];
  document.documentElement.lang = lang;

  checkRequirements(talk, info.requires);
  const endLabel = endStrings(lang).end;
  const end = createEnd(talk, { lang, languages: info.languages, title: info.title, site });
  const stage = createStage(talk, info.slides.map(id => `${base}slides/${id}/${lang}.html`), end);
  initRail(stage);
  const overview = initOverview(talk, stage, { base, slides: info.slides, lang, endLabel });
  initMenu(talk, stage, { base, slides: info.slides, lang, title: info.title });
  initControls(talk, stage, overview, { lang, languages: info.languages, endLabel });
  stage.show((Number(location.hash.slice(1)) || 1) - 1);
  stage.element.focus();
}

init();
