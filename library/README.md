# Keystone style library

What a slide may look like, for people and for LLMs. Read this before styling a slide.

- `*.md` — judgement: when to use a piece, why, do / don't.
- `*.json` — facts a script or an LLM can check: classes, slots, limits.
- The CSS stays the source of truth: `public/tokens.css` (colours, type) and `public/theme.css` (components).
  The JSON names classes and tokens; it never copies colour values.

The library is also a Keystone deck: `node server.js library` shows one example slide per layout and component,
and `npm run shots` (with that server running) refreshes the screenshots. Each `thumb.png` is a copy of one.

## Contents

| Kind | Id | Use | Example slide |
|---|---|---|---|
| brand | [brand](brand.md) · [json](brand.json) | Tone, words, colours, shapes, logos | — |
| style | [rail](styles/rail/style.md) | The deck look: red rail on the left with logo and chapter | `style-rail` |
| layout | [cover](layouts/cover/layout.md) | First slide of a talk | `cover` |
| layout | [chapter](layouts/chapter/layout.md) | Numbered chapter opener | `chapter` |
| layout | [list](layouts/list/layout.md) | One idea, 2–6 points, optional takeaway | `list` |
| layout | [intro-visual](layouts/intro-visual/layout.md) | Text column + one square visual (speaker, studio) | `intro-visual` |
| layout | [canvas](layouts/canvas/layout.md) | Free content under the title: figures, cards, diagrams, 3D | `cards`, `diagram` |
| layout | [procon](layouts/procon/layout.md) | Advantages and drawbacks in two columns ("…: the verdict") | `procon` |
| layout | [agenda](layouts/agenda/layout.md) | The list of chapters | `agenda` |
| layout | [demo](layouts/demo/layout.md) | Un-numbered break before a live demo | `demo` |
| layout | [closing](layouts/closing/layout.md) | Last slide: THANK YOU, recap or QR code | `closing` |
| layout | [sources](layouts/sources/layout.md) | References by chapter, with links | `sources` |
| component | [list](components/list/component.md) | `.sa-list` bullets: plain, pro (+), con (−) | `list` |
| component | [takeaway](components/takeaway/component.md) | Closing line at the bottom | `list` |
| component | [card](components/card/component.md) | Panel with a top bar: label, heading or value, text | `cards` |
| component | [stat](components/stat/component.md) | Big value with its unit | `cards` |
| component | [label](components/label/component.md) | Mono caps labels, content headings (26 / 22) | `cards` |
| component | [caption](components/caption/component.md) | Figure captions, source line | `cards` |
| component | [monogram](components/monogram/component.md) | Giant brand mark cut by the edge | `cover` |
| component | [diagram](components/diagram/component.md) | Pipeline nodes, links, tiles (`diagram.css`) | `diagram` |
| component | [anim](components/anim/component.md) | Entrance animations (`data-in`) | `diagram` |
| component | [code](components/code/component.md) | Commands, files, trees (`.sa-code`), keys (`kbd`), screenshots (`.sa-shot`) | `examples/keystone` |
| component | [three](components/three/component.md) | three.js scenes in a slide: looks, glass, glTF materials | `looks`, `materials`, `glass` |

## How to choose (LLM workflow)

1. Read `brand.md`, then this table.
2. Pick the layout whose `use` matches the brief. Read its `layout.md` and `layout.json`; copy the markup of its example
   slide (`slides/<example>/slide.html`) and fill the slots within the limits.
3. Add components from `components/` as needed. Slide-local CSS is fine for positions; new looks are not.
4. If no layout fits, use `canvas`. If the same local CSS appears on several slides, propose a new layout or
   theme class to the user instead of copying it again.

## Deck add-ons

A deck can add its own pieces in `<deck>/library/`, same format (`layouts/<id>/layout.{md,json}`,
`components/<id>/component.{md,json}`). Their `example` is a slide id of that deck. A deck entry with the same id
as a Keystone entry replaces it for that deck. Brand rules cannot be replaced by a deck.

## JSON shapes

- `layout.json`: `id`, `kind: "layout"`, `use`, `avoid`, `body` (extra body classes, from the `<!-- body: … -->` line),
  `slots` (name → `{ class, required, maxChars?, min?, max?, notes? }`), `components`, `example`.
- `component.json`: `id`, `kind: "component"`, `use`, `include` (tags to add to the slide), `classes` or `attributes`,
  `rules`, `example`.
- `style.json`: `id`, `kind: "style"`, `default`, `css`, `requires` (markup every slide must have), `example`,
  `media` (files of this deck that a new deck of the style gets in its `assets/media/`, e.g. the cover photo).
- `maxChars` limits are guides measured at the theme's sizes, not hard rules; check with `npm run shots`.
