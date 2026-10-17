// Copyright 2026 SASU Sentient Art
// SPDX-License-Identifier: Apache-2.0
// three.js stage for slides: renderer at the slide's real resolution, a preset "look", models, a play loop.
//
//   import { THREE, stage, material, applyLook, loadModel, playLoop } from "/public/components/stage.js";
//   const { render, scene, softShadow } = stage(canvas, 660, 410, { look: "pbr", env: "studio", draw });
//   function draw() { render(camera); }
//   softShadow(floor, camera);            // once the scene is complete (pbr): HDRI soft shadow on a floor plane
//
// Looks (set the lights, environment and tone mapping; materials must match, see material() / applyLook()):
//   "unlit"   no lights, MeshBasicMaterial: exact texture colours (checkers, UV views, diagrams).
//   "simple"  sky/ground light + key + rim, MeshPhongMaterial (Blinn-Phong): clean shapes.
//   "pbr"     image-based lighting from an Ultra HDR environment (+ its sun as a DirectionalLight), MeshStandardMaterial,
//             neutral tone mapping. env: "studio" (neutral, default) or "exterior" (sky, with sun). The environment and
//             its sun follow the camera (yaw and pitch, not roll): the light stays the same relative to the view.
// Options: clear (background colour, null = transparent), draw (called again on "sa:resize", once the environment is
// ready and once a soft shadow is built), ao (pbr: ambient occlusion in render(), default true).
// stage() returns { renderer, scene, render, softShadow, newScene, look, ready }:
//   render(camera, scene?)     draws; in pbr with ambient occlusion (GTAO). renderer.render() still works, without AO
//                              (figures that draw several viewports by hand).
//   softShadow(floor, camera)  pbr: how much of the HDRI's light reaches a floor plane (PlaneGeometry mesh), as its
//                              aoMap, built over a few frames for the environment as seen from `camera`.
//   newScene()                 another scene with the same look (a figure that renders several scenes in one canvas).
//   ready                      Promise, resolves when the environment is applied.
// Quality: every texture gets the GPU's anisotropic filtering. Touch devices (phones, tablets): pixel ratio at most 2,
// ambient occlusion at half resolution; if a figure animates below ~45 fps, AO pauses while it moves and the last
// frame is drawn again with AO once it stops. (Measured on an iPhone: GTAO half res = +5 ms at pixel ratio 2.)
// Environments: public/assets/env/*.uhdr.jpg, made with tools/env.py (which also prints the sun values below).
import * as THREE from "/public/vendor/three.module.min.js";
import { GLTFLoader } from "/public/vendor/jsm/GLTFLoader.js";
import { MeshoptDecoder } from "/public/vendor/jsm/libs/meshopt_decoder.module.js";
import { EffectComposer } from "/public/vendor/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "/public/vendor/jsm/postprocessing/RenderPass.js";
import { GTAOPass } from "/public/vendor/jsm/postprocessing/GTAOPass.js";
import { OutputPass } from "/public/vendor/jsm/postprocessing/OutputPass.js";
import { loadUltraHDR } from "/public/components/uhdr.js";
import { softShadow as buildSoftShadow } from "/public/components/softshadow.js";
export { THREE };

// Each map's settings are in envs.json next to the maps (the overlay folder decks/public can replace maps and settings):
// yaw, pitch (degrees): the map's orientation for a camera looking down -Z: yaw spins it about Y, then pitch tilts it
// about X (positive: the top of the map leans toward the camera). The sun turns with it. exposure: tone mapping exposure for that
// map (default 1). sun: the light clipped out of the map, as tools/env.py prints it. Values chosen by eye on test scenes.
const ENVS = { studio: { url: "/public/assets/env/studio.uhdr.jpg" }, exterior: { url: "/public/assets/env/exterior.uhdr.jpg" } };
const SETTINGS = await fetch("/public/assets/env/envs.json").then(r => r.json()).catch(() => ({}));
for (const name in ENVS) Object.assign(ENVS[name], SETTINGS[name]);

// Turn a pbr scene's environment and sun with the camera that renders it (called from scene.onBeforeRender).
// Wanted map rotation R = camera yaw·pitch × base turn. three.js samples the map with makeRotationFromEuler(-e),
// so e = the Euler angles of R⁻¹, negated.
const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _m = new THREE.Matrix4();
const envTurn = (camera, base, q = new THREE.Quaternion()) => {
  camera.getWorldQuaternion(q);
  _e.setFromQuaternion(q, "YXZ"); _e.z = 0;
  return q.setFromEuler(_e).multiply(base);
};
function followCamera(scene, camera, base, sun, light) {
  envTurn(camera, base, _q);
  _e.setFromRotationMatrix(_m.makeRotationFromQuaternion(_q).invert(), "XYZ");
  scene.environmentRotation.set(-_e.x, -_e.y, -_e.z, "XYZ");
  if (light) { light.position.set(...sun.dir).applyQuaternion(_q).multiplyScalar(10); light.updateMatrixWorld(); }
}

const touch = matchMedia("(pointer: coarse)").matches;                       // phones, tablets
const pixelRatio = () => Math.min(touch ? 2 : 3, window.saPixelRatio ? saPixelRatio() : (devicePixelRatio || 1));
const hdr = {};                                        // decoded environments, shared by the stages of a page

function environment(renderer, name) {
  hdr[name] ||= loadUltraHDR(ENVS[name].url).then(({ width, height, data }) => {
    const half = new Uint16Array(data.length);
    for (let i = 0; i < data.length; i++) half[i] = THREE.DataUtils.toHalfFloat(data[i]);
    return { width, height, data, half };
  });
  return hdr[name].then(({ width, height, half }) => {
    const tex = new THREE.DataTexture(half, width, height, THREE.RGBAFormat, THREE.HalfFloatType);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.colorSpace = THREE.LinearSRGBColorSpace;
    tex.magFilter = tex.minFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    const pmrem = new THREE.PMREMGenerator(renderer), env = pmrem.fromEquirectangular(tex).texture;
    tex.dispose(); pmrem.dispose();
    // PMREM rendered into render targets, which left the GL clear colour in linear space: set it again for the
    // canvas, or a slide that calls renderer.clear() before render() clears with a too dark colour.
    renderer.setClearColor(renderer.getClearColor(new THREE.Color()), renderer.getClearAlpha());
    return env;
  });
}

export function stage(canvas, w, h, { look = "pbr", env = "studio", clear = "#1b1b1c", draw, ao = true } = {}) {
  const pbr = look === "pbr";
  // pbr: transparent clear over the canvas's CSS background (the composer tone-maps its whole image, a clear colour
  // would come out lighter than the slide).
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: pbr || clear == null, preserveDrawingBuffer: true });
  if (pbr && clear != null) canvas.style.background = clear;
  renderer.setClearColor(pbr ? 0x000000 : clear ?? 0x000000, pbr || clear == null ? 0 : 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  let composer = null;
  const fit = () => {
    renderer.setPixelRatio(pixelRatio()); renderer.setSize(w, h, false);
    if (composer) { composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w, h); }
  };
  fit();
  addEventListener("sa:resize", () => { fit(); draw?.(); });

  // Anisotropic filtering on every texture a scene uses (checked once per material).
  const aniso = renderer.capabilities.getMaxAnisotropy(), seen = new WeakSet();
  const sharpen = s => s.traverse(o => {
    if (!o.isMesh) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (!m || seen.has(m)) continue;
      seen.add(m);
      for (const k of ["map", "normalMap", "roughnessMap", "metalnessMap", "aoMap", "emissiveMap", "bumpMap"])
        if (m[k] && m[k].anisotropy < aniso) { m[k].anisotropy = aniso; m[k].needsUpdate = true; }
    }
  });

  // Lights and environment of the look, on every scene of this stage.
  const scenes = [], { sun, yaw = 0, pitch = 0, exposure = 1 } = ENVS[env], rad = THREE.MathUtils.degToRad;
  const base = new THREE.Quaternion().setFromEuler(new THREE.Euler(rad(pitch), rad(yaw), 0, "XYZ"));
  let envMap = null, ready = Promise.resolve();
  const dress = s => {
    if (look === "simple") {
      s.add(new THREE.HemisphereLight("#ffffff", "#2a2a2b", 1.5));
      const key = new THREE.DirectionalLight("#ffffff", 2.2); key.position.set(-3, 5, 5); s.add(key);
      const rim = new THREE.DirectionalLight("#ffffff", 1.0); rim.position.set(4, 3, -4); s.add(rim);
    } else if (look === "pbr") {
      s.environment = envMap;
      const light = sun && new THREE.DirectionalLight(new THREE.Color(...sun.color), sun.intensity);
      if (light) s.add(light);
      s.onBeforeRender = (r, scene, camera) => { followCamera(s, camera, base, sun, light); sharpen(s); };
    } else {
      s.onBeforeRender = () => sharpen(s);
    }
    scenes.push(s);
    return s;
  };
  if (pbr) {
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = exposure;
    ready = environment(renderer, env).then(t => { envMap = t; scenes.forEach(s => (s.environment = t)); draw?.(); });
  }
  const scene = dress(new THREE.Scene());

  // render(): with ambient occlusion (pbr). The composer renders into a multisampled target, so edges stay smooth.
  let aoPass = null, aoPaused = false, last = 0, gaps = [], still = 0;
  const makeComposer = camera => {                  // GTAOPass reads the camera when it is built
    const pr = renderer.getPixelRatio();
    composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(w * pr, h * pr, { type: THREE.HalfFloatType, samples: 4 }));
    composer.addPass(new RenderPass(scene, camera));
    aoPass = new GTAOPass(scene, camera, w, h);
    const res = touch ? 0.5 : 1, setSize = aoPass.setSize.bind(aoPass);
    aoPass.setSize = (sw, sh) => setSize(Math.round(sw * res), Math.round(sh * res));
    aoPass.updateGtaoMaterial({ radius: 0.5, distanceExponent: 1, thickness: 1, scale: 1, samples: 16 });
    aoPass.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 4, rings: 2, samples: 16 });
    composer.addPass(aoPass); composer.addPass(new OutputPass());
    composer.setSize(w, h);
  };
  function render(camera, s = scene) {
    if (!(pbr && ao) || !s.environment) return renderer.render(s, camera);
    const now = performance.now(), gap = now - last; last = now;
    if (gap < 100) { gaps.push(gap); if (gaps.length > 30) gaps.shift(); }          // animating: frame intervals
    if (!aoPaused && gaps.length === 30 && gaps.slice().sort((a, b) => a - b)[15] > 22) aoPaused = true;   // below ~45 fps
    clearTimeout(still);
    if (aoPaused) {                                     // too slow with AO while moving: draw without, add it once still
      renderer.render(s, camera);
      still = setTimeout(() => { aoPaused = false; gaps = []; render(camera, s); aoPaused = true; }, 250);
      return;
    }
    if (!composer) makeComposer(camera);
    composer.passes[0].scene = aoPass.scene = s; composer.passes[0].camera = aoPass.camera = camera;
    composer.render();
  }

  // softShadow(floor, camera): built progressively once the environment is ready, then drawn.
  function softShadow(floor, camera) {
    if (!pbr) return Promise.resolve();
    return ready.then(() => hdr[env]).then(({ width, height, data }) => new Promise(done => {
      const sh = buildSoftShadow(renderer, scene, floor, { hdr: { width, height, data }, toWorld: envTurn(camera, base) });
      const tick = () => {
        if (!sh.step(16)) return requestAnimationFrame(tick);
        floor.material.aoMap = sh.texture; floor.material.needsUpdate = true;
        draw?.(); done(sh);
      };
      tick();
    }));
  }

  return { renderer, scene, render, softShadow, newScene: () => dress(new THREE.Scene()), look, ready };
}

// A material for a look, from MeshStandardMaterial-style parameters (color, map, normalMap, roughness, metalness,
// vertexColors, side, transparent, opacity, alphaTest…); parameters a look cannot use are left out.
const COMMON = ["color", "map", "vertexColors", "side", "transparent", "opacity", "alphaTest", "depthWrite", "wireframe"];
const pick = (p, keys) => Object.fromEntries(keys.filter(k => p[k] !== undefined).map(k => [k, p[k]]));
export function material(look, p = {}) {
  if (look === "unlit") return new THREE.MeshBasicMaterial(pick(p, COMMON));
  if (look === "simple") {
    const r = p.roughness ?? 1;
    return new THREE.MeshPhongMaterial({ ...pick(p, [...COMMON, "normalMap", "normalScale", "emissive", "emissiveMap"]),
      shininess: Math.min(200, 2 / Math.max(r, 0.05) ** 4 - 2), specular: new THREE.Color(0.04 + 0.2 * (1 - r)) });
  }
  return new THREE.MeshStandardMaterial(p);
}

// Give a loaded model (GLB: MeshStandardMaterial) the materials of a look. The original material is kept, so a
// model can switch back to "pbr".
export function applyLook(root, look) {
  root.traverse(o => {
    if (!o.isMesh) return;
    const orig = o.userData.pbrMaterial ||= o.material;
    const one = m => look === "pbr" ? m : material(look, {
      ...pick(m, [...COMMON, "normalMap", "normalScale", "roughness", "emissiveMap"]),
      ...(m.emissiveMap || m.emissive?.getHex() ? { emissive: m.emissive } : {}),
      ...(m.transmission > 0 ? { transparent: true, opacity: 0.25, depthWrite: false } : {}),   // glass: see-through
    });
    o.material = Array.isArray(orig) ? orig.map(one) : one(orig);
  });
  return root;
}

// A fresh copy of a glTF / GLB scene (geometry and textures shared between copies). Models compressed with
// tools/meshopt.mjs (EXT_meshopt_compression) are decoded here.
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder), models = {};
export function loadModel(url) {
  models[url] ||= loader.loadAsync(url);
  return models[url].then(g => g.scene.clone(true));
}

// Runs frame(t) on every animation frame between sa:enter and sa:leave.
export function playLoop(frame) {
  let raf = 0;
  const tick = t => { frame(t); raf = requestAnimationFrame(tick); };
  addEventListener("sa:enter", () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(tick); });
  addEventListener("sa:leave", () => cancelAnimationFrame(raf));
}
