# Component: three

three.js scenes in a slide, built on `public/components/stage.js` (three.js from `public/vendor/`, addons in `vendor/jsm/`).

```html
<canvas class="xx-view"></canvas>
<script type="module">
import { THREE, stage, material, applyLook, loadModel, playLoop } from "/public/components/stage.js";
const { render, scene, softShadow } = stage(document.querySelector(".xx-view"), 1040, 700, { look: "pbr", env: "studio", draw });
const camera = new THREE.PerspectiveCamera(35, 1040 / 700, .1, 50);
function draw() { render(camera); }       // pbr: with ambient occlusion
const floor = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), material("pbr", { color: "#2a2a2b", roughness: 1 }));
floor.rotation.x = -Math.PI / 2; scene.add(floor);
scene.add(new THREE.Mesh(new THREE.SphereGeometry(.5, 48, 24), material("pbr", { color: "#ee342c", roughness: .4 })));
scene.add(applyLook(await loadModel("/deck/assets/models/x.glb"), "pbr"));
draw();                                   // one still frame at load, for screenshots and the overview
softShadow(floor, camera);                // soft contact shadows from the HDRI, built once (redraws when done)
playLoop(t => { /* update */ draw(); });  // runs between sa:enter and sa:leave
</script>
```

Looks — pick one per figure, and make every material with `material(look, …)` or `applyLook(model, look)`:

- `unlit` — no lighting, exact texture colours: checkers, texel density, UV views, flat diagrams in 3D.
- `simple` — Blinn-Phong with a sky/ground light, a key and a rim: clean shapes, schematic scenes.
- `pbr` — image-based lighting, neutral tone mapping: real props and materials. `env: "studio"` (neutral, default) or
  `"exterior"` (sky + its sun as a directional light). The environment follows the camera (yaw, pitch): the light stays
  the same relative to the view, whatever the camera does.

Rules:

- Run the loop only between `sa:enter` and `sa:leave` (`playLoop`); render one still frame at load.
- `stage()` renders at `saPixelRatio()` (at most 2 on phones) and calls `draw` again on `sa:resize`, when the environment
  is ready and when a soft shadow is built.
- Draw with `render(camera)` (ambient occlusion in pbr). `renderer.render()` skips AO: only for figures that draw
  several viewports by hand.
- `softShadow(floor, camera)` needs a PlaneGeometry floor, called once the scene is complete. If the objects turn,
  put the floor in the turning group (its shadow turns with it).
- Models: GLB with WebP textures, geometry compressed by `tools/meshopt.mjs`. `loadModel()` decodes meshopt; with your own
  `GLTFLoader`, add `.setMeshoptDecoder(MeshoptDecoder)`. Scale and place a model through a parent group, not its meshes.
- Colours: raw hex is allowed here (`0xee342c` = `--red`, `0x1b1b1c` = `--ink`), no other hues unless they are data colours.
- The presenter keeps ±2 slides loaded (WebGL context limit); the website talk needs `requires = "webgl"`.
- Builds: `window.saNext()` / `window.saPrev()` return true while the slide takes the step itself.

Example slides: `rendus` (the four looks), `materiaux` (glTF materials), `verre` (frosted glass).

## Physical materials (glass, glTF extensions)

`material()` makes `MeshStandardMaterial`. For more, create `THREE.MeshPhysicalMaterial` in the `pbr` look. A GLB keeps its
physical materials (`applyLook(model, "pbr")` does not change them), and `GLTFLoader` reads every `KHR_materials_*`
extension: `transmission`, `volume` (thickness, attenuation), `ior`, `dispersion`, `clearcoat`, `iridescence`, `sheen`,
`anisotropy`, `specular`, `emissive_strength`.

- **Glass** — `transmission: 1`, `roughness` (blur of what is behind), `ior`, `thickness`, `dispersion` (rainbow edges).
  In three.js the blur is scaled by the ior (`ior 1.5` = full blur, `ior 1.2` = 40 %); low `ior` = little refraction.
  Frosted plate: `ior 1.5`, `thickness .15`, `roughness .5`. Clear ball with thin fringes: `ior 1.03`, `thickness 2.2`,
  `dispersion 10`. On a dark ground, `transmission .9` makes the glass a little milky (pure glass looks smoky).
- **Glass only refracts opaque objects of the scene**, not the slide behind the canvas, and not other glass. Put the
  ground in the scene with `backdrop(scene, camera, paint)` from `/public/components/backdrop.js`: a plane painted with
  a 2D canvas (the slide colour, a grid, a glow — `toCanvas(camera, point, w, h)` places it under an object).
- **Glow** — paint it on the backdrop (radial gradient), not a light.
- Use `stage(…, { ao: false, clear: null })` with a backdrop: the AO pass tone-maps the whole image, so the painted
  ground would not match the slide colour.
- Live tuning: a few `<input type="range">` that set material values and call `render(camera)` (see `materiaux`);
  stop `keydown` on them so the arrows move the slider, not the slides.
