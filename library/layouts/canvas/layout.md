# Layout: canvas

The general frame: rail, title, optional lead, free content, optional takeaway. Most technical slides use it.

Content area: x 73–1207. Top 150 without a lead, 262 under a one-line or two-line lead. Bottom 660, or about 600 above
a takeaway; a `.sa-source` line sits at 668.

Build the content from the theme pieces, and position them with slide-local CSS:

- **Card** (`components/card`) — a panel with a 4px top bar: an eyebrow label, a heading or a big value, a short text.
  Usually a column of 1–3 cards on the right of a figure (x 813, width 394).
- **Figure** — an image, canvas or three.js view (`components/three`) on `--ink-3` with a 1px `--rule` outline; a
  `.sa-label` in its top-left corner names the view; a `.sa-caption` under it.
- **Figures in a row** — 2–4 views in a grid with a 24px gap; under each, a `.sa-heading` (26) and a `.sa-label`.
- **Diagram** — nodes and links from `components/diagram`, in absolute coordinates.

Rules:

- Positions are slide-local CSS; colours and type come from tokens and theme classes. Prefix local classes with a short
  slide code (`.cg-row`, `.ga-view`) so they cannot leak. No inline styles.
- One red idea per slide. Animate in reading order with `data-in` (`components/anim`).
- If a pattern is copied a third time, propose a theme class.
