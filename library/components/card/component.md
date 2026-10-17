# Component: card

`div.sa-card`: a raised panel (`--ink-2`) with a 4px top bar, white; `.is-key` makes the bar red for the one card
that matters. Position and width come from the slide (often x 813, width 394, cards 190px apart).

Inside, in this order:

- `p.sa-label` — the eyebrow: what the card is about (mono caps).
- `.sa-heading.is-small` (22) or `p.sa-stat` — a short heading, or a big value (`components/stat`).
- `p` — one or two short sentences (18, grey; `<b>` white), or a `ul.sa-list` (20).
- `p.sa-note` — optional closing line under a rule (Poppins 18).

Rules: 1–3 cards on a slide, one `.is-key` at most; a card holds one idea.
