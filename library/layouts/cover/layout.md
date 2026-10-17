# Layout: cover

The first slide of a talk. Red ground, the cover photo at 20 %, the wordmark top left, the giant monogram cut by the
right edge, the talk title centred in the left part. Chapter, demo and closing slides use the same ground.

- Use: the opening slide (one only: a welcome slide and the title slide are the same slide).
- Title: the talk's name, as in `deck.json` (`title`), one or two lines at 48px. Sentence case; names and technical
  terms keep their form (Texel density and trim sheets, Deferred rendering · How it works).
- Photo: `.sa-cover-photo`, full bleed, the same image on every cover-ground slide of the talk (`/deck/assets/media/…`).
  The theme scales it 8 % from the bottom-right corner, which pushes a top-left logo off the frame.
- Monogram: `img.sa-monogram` with `/public/assets/brand/monogram.webp`.
- Don't: add a rail, add body text, use a second accent colour.
