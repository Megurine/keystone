# Style: Rail (default)

A 46px red rail runs down the left edge of every content slide. It carries the monogram at the top and the chapter
name, in capitals, letters stacked upright. The slide topic is the page title (`.sa-title`), white, sentence case.
Covers and chapter openers have no rail: they use a red ground (`body.sa-cover`).

## Example slide

`slides/style-rail` shows the style in use (rail, title, lead, list, takeaway, the three typefaces) and lists its
values (sizes, rules, margins, colours). Feedback on that slide is feedback on the style: change `public/theme.css`
(`public/tokens.css` for a colour), then this file, then the values written on the slide, so the three agree.
A change of the theme changes every slide of every deck that uses this style.

## Titles (`.sa-title`)

- Sentence case, white, no red word. English technical terms keep their usual form (Forward rendering, G-Buffer,
  Texel density, CPU vs GPU).
- One line when possible, two at most (about 65 characters). Longer: split the slide or move words to the lead.
- Patterns used in the talks:
  - a series on one subject: `Sujet&nbsp;: étape` (Deferred rendering&nbsp;: le G-Buffer, … : le bilan);
  - the summary of a part: `Sujet&nbsp;: le bilan` (with the `procon` layout when there are pros and cons);
  - a worked case: `Exemple&nbsp;: …`;
  - a question the slide answers (Pourquoi des résolutions différentes&nbsp;?).
- The same title may stay on 2–3 slides in a row when they show one idea step by step.

## Rail text (`.sa-band`)

- The chapter name in capitals. It may be a short form of the chapter slide's title (chapter "ENTER THE PIPELINE" →
  rail "PIPELINE"); keep it the same on every slide of the chapter.
- Slides outside the chapters use their own word: INTRODUCTION before chapter 01, SOURCES after the last one.

## Website

The website viewer cuts the slide's rail off and shows its own rail with the same chapter, so the chapter must be
in `.sa-band` (content slides) or `.sa-section-title` (chapter slides).

Markup, first lines of every content slide:

```html
<header class="sa-head"><img class="sa-logo" src="/public/assets/brand/sa-monogram-white.svg" alt=""><h1 class="sa-band">CHAPITRE</h1></header>
<h2 class="sa-title">Titre de la slide</h2>
```

## Old variants

`public/styles/` holds older header variants for `?style=<name>`: `a-bandeau` and `c-rail` are empty, `b-editorial`
targets `.sa-sub`, which the rail migration removed. They are not part of the library.
