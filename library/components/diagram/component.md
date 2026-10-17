# Component: diagram

`public/components/diagram.css`: pieces for pipeline and data-flow diagrams. Positions come from each slide.

- `.dg-node` (150×50) — `.data` (grey, data), `.prog` (red, programmable stage), `.fixed` (outlined, fixed stage).
- `svg.dg-svg` — a 1280×720 overlay; paths `.link` (white 1.6), `.pass` (red 4, a render pass), `.route` (white 2).
- `.dg-pass-label` (red mono caps), `.dg-caption` (grey mono), `.dg-heading` (Poppins 26).
- `.dg-tile` (+ `.dg-tile-label`) — a black image or canvas tile with a 1px rule.
- `.dg-screen-tri` — a screen drawn as two triangles.

Rules: red only for what is programmable or the point of the slide. Draw links with `data-anim="draw"`
(`pathLength="1" stroke-dasharray="1"`). Note: `.dg-node` has 10px rounded corners, the one exception to the
no-rounded-corners brand rule.
