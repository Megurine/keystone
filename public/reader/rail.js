// The page's rail (reader.css .rail, markup in talk.html), in place of each slide's own rail:
// the current slide's chapter, or "share" on the end card (after site.json's "railPrefix", e.g. "Built to"), with a word swap.
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

export function initRail(stage) {
  const built = document.querySelector('.talk-rail .rail-built');
  const word = document.querySelector('.talk-rail .rail-word');
  let current = null;
  stage.on('chapter', chapter => {
    const next = chapter ?? 'share';
    if (next === current) return;
    const first = current === null;
    current = next;
    const swap = () => { word.textContent = next; built.hidden = chapter !== null; word.classList.remove('is-swapping'); };
    if (first || reduced) return swap();
    word.classList.add('is-swapping');
    setTimeout(swap, 200);
  });
}
