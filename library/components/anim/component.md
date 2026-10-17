# Component: anim

`public/components/anim.js`: entrance animations. Plays on `sa:enter`, resets on `sa:leave`; without the presenter
everything stays visible (screenshots show the final state).

- `data-in="<ms>"` — delay. Required to animate.
- `data-anim` — `rise` (default), `fade`, `pop`, `draw` (SVG path with `pathLength="1" stroke-dasharray="1"`),
  `wipe` (left to right), `drop` (falls from above).
- `data-dur="<ms>"` — duration (default 500, `draw` 600).

Rules: animate in reading order — title 100, lead 100–200, content from 400 in steps of about 300, takeaway last.
`pop` for small marks, `draw` for links, `rise` for blocks. Keep the whole entrance under about 2.5 s.
