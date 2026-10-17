// HDRI soft shadow on a floor plane: how much of the environment's light reaches each floor point, used as the
// floor's aoMap (three.js applies aoMap to environment light only: no light is added, blocked HDRI light is removed).
// Light directions are drawn from the HDR map in proportion to their light (importance sampling); each renders a depth
// map of the scene, and the floor's visibility (weighted by the angle to the floor) is averaged. Used by stage.js.
//
//   const sh = softShadow(renderer, scene, floor, { hdr, toWorld, size: 1024, samples: 96 });
//   while (!sh.step(16)) …   (progressive: a few directions per call)   floor.material.aoMap = sh.texture
//
// floor: a Mesh with a PlaneGeometry (any size, any placement). hdr: { width, height, data } from uhdr.js (Float32 RGBA,
// rows bottom to top, three.js equirect layout). toWorld: Quaternion turning a map direction into the world.
import * as THREE from "/public/vendor/three.module.min.js";

const VERT = `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy * 2.0, 0.0, 1.0); }`;
const ACC = `
uniform sampler2D tDepth; uniform mat4 lightVP, floorMatrix; uniform float weight, texel;
varying vec2 vUv;
void main() {
  vec4 wp = floorMatrix * vec4(vUv - 0.5, 0.0, 1.0);          // the floor point (unit plane scaled by floorMatrix)
  vec4 c = lightVP * vec4(wp.xyz, 1.0);
  vec3 n = c.xyz / c.w * 0.5 + 0.5;
  float vis = 1.0;
  if (n.x > 0.0 && n.x < 1.0 && n.y > 0.0 && n.y < 1.0) {
    vis = 0.0;
    for (int i = -1; i <= 1; i++) for (int j = -1; j <= 1; j++)
      vis += (n.z - 0.0015 > texture2D(tDepth, n.xy + vec2(i, j) * texel).x) ? 0.0 : 1.0;
    vis /= 9.0;
  }
  gl_FragColor = vec4(vis * weight, weight, 0.0, 1.0);
}`;
const RESOLVE = `
uniform sampler2D tAcc; varying vec2 vUv;
void main() { vec4 a = texture2D(tAcc, vUv); float v = a.g > 0.0 ? a.r / a.g : 1.0; gl_FragColor = vec4(v, v, v, 1.0); }`;

function sampleDirections({ width: W, height: H, data }, toWorld, count) {
  const cdf = new Float64Array(W * H), dirs = [], d = new THREE.Vector3();
  let total = 0;
  for (let r = 0; r < H; r++) {
    const cl = Math.cos(((r + 0.5) / H - 0.5) * Math.PI);    // solid angle of a row
    for (let x = 0; x < W; x++) {
      const k = (r * W + x) * 4;
      total += (data[k] * .2126 + data[k + 1] * .7152 + data[k + 2] * .0722) * cl; cdf[r * W + x] = total;
    }
  }
  for (let i = 0; dirs.length < count && i < count * 20; i++) {
    const t = ((i + Math.random()) / count % 1) * total;      // stratified
    let lo = 0, hi = cdf.length - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (cdf[m] < t) lo = m + 1; else hi = m; }
    const lat = ((Math.floor(lo / W) + Math.random()) / H - 0.5) * Math.PI, phi = ((lo % W + Math.random()) / W - 0.5) * 2 * Math.PI;
    d.set(Math.cos(lat) * Math.cos(phi), Math.sin(lat), Math.cos(lat) * Math.sin(phi)).applyQuaternion(toWorld);
    if (d.y > 0.02) dirs.push(d.clone());                      // light from below the floor cannot reach it
  }
  return dirs;
}

export function softShadow(renderer, scene, floor, { hdr, toWorld, size = 1024, depthSize = 1024, samples = 96 } = {}) {
  const dirs = sampleDirections(hdr, toWorld, samples);
  const { width: fw, height: fh } = floor.geometry.parameters;
  const tw = fw >= fh ? size : Math.max(64, Math.round(size * fw / fh)), th = fh >= fw ? size : Math.max(64, Math.round(size * fh / fw));
  const box = new THREE.Box3();
  scene.traverse(o => { if (o.isMesh && o !== floor && o.visible) box.expandByObject(o); });
  const centre = box.getCenter(new THREE.Vector3()), radius = box.getBoundingSphere(new THREE.Sphere()).radius;
  const cam = new THREE.OrthographicCamera(-radius, radius, radius, -radius, 0.1, radius * 4);
  const depthRT = new THREE.WebGLRenderTarget(depthSize, depthSize, { depthTexture: new THREE.DepthTexture(depthSize, depthSize) });
  const acc = new THREE.WebGLRenderTarget(tw, th, { type: THREE.HalfFloatType });
  const out = new THREE.WebGLRenderTarget(tw, th, { generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(1, 1)), qScene = new THREE.Scene(), qCam = new THREE.Camera();
  qScene.add(quad);
  floor.updateMatrixWorld();
  const floorMatrix = floor.matrixWorld.clone().multiply(new THREE.Matrix4().makeScale(fw, fh, 1));
  const accMat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: ACC, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false,
    uniforms: { tDepth: { value: depthRT.depthTexture }, lightVP: { value: new THREE.Matrix4() }, floorMatrix: { value: floorMatrix },
                weight: { value: 1 }, texel: { value: 1.5 / depthSize } } });
  const resolveMat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: RESOLVE, uniforms: { tAcc: { value: acc.texture } }, depthTest: false });
  const depthMat = new THREE.MeshDepthMaterial({ side: THREE.DoubleSide });
  const save = () => ({ target: renderer.getRenderTarget(), clear: renderer.getClearColor(new THREE.Color()), alpha: renderer.getClearAlpha(),
    auto: renderer.autoClear, override: scene.overrideMaterial, floor: floor.visible, bg: scene.background, env: scene.environment, before: scene.onBeforeRender });
  const restore = k => {
    renderer.setRenderTarget(k.target); renderer.autoClear = k.auto; renderer.setClearColor(k.clear, k.alpha);   // after the target: clear colour in canvas space
    scene.overrideMaterial = k.override; floor.visible = k.floor; scene.background = k.bg; scene.environment = k.env; scene.onBeforeRender = k.before;
  };
  const k0 = save(); renderer.setRenderTarget(acc); renderer.setClearColor(0x000000, 1); renderer.clear(); restore(k0);
  let next = 0;
  return {
    texture: out.texture,
    // Renders n more light directions; returns true once all are done.
    step(n = 16) {
      if (next >= dirs.length) return true;
      const k = save();
      scene.overrideMaterial = depthMat; floor.visible = false; scene.background = null; scene.environment = null;
      scene.onBeforeRender = () => {};
      for (let i = 0; i < n && next < dirs.length; i++, next++) {
        const d = dirs[next];
        cam.position.copy(centre).addScaledVector(d, radius * 2); cam.lookAt(centre); cam.updateMatrixWorld();
        renderer.setRenderTarget(depthRT); renderer.autoClear = true; renderer.render(scene, cam);
        accMat.uniforms.lightVP.value.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
        accMat.uniforms.weight.value = d.y;                     // cosine to the floor
        quad.material = accMat; renderer.setRenderTarget(acc); renderer.autoClear = false; renderer.render(qScene, qCam);
      }
      quad.material = resolveMat; renderer.setRenderTarget(out); renderer.autoClear = true; renderer.render(qScene, qCam);
      restore(k);
      return next >= dirs.length;
    },
    dispose() { [depthRT, acc, out].forEach(t => t.dispose()); [accMat, resolveMat, depthMat].forEach(m => m.dispose()); quad.geometry.dispose(); },
  };
}
