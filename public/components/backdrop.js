// Copyright 2026 SASU Sentient Art
// SPDX-License-Identifier: Apache-2.0
// An opaque plane that fills a perspective camera's view, painted with a 2D canvas.
// Glass (transmission) only refracts opaque objects of the scene, never the page behind the canvas: the ground,
// a glow or a grid it should bend must be in the scene. MeshBasicMaterial + toneMapped: false keeps the painted
// colours exact (use with stage(…, { ao: false }), the AO composer tone-maps the whole image).
//
//   const plane = backdrop(scene, camera, (ctx, w, h) => { ctx.fillStyle = "#1b1b1c"; ctx.fillRect(0, 0, w, h); });
//   toCanvas(camera, point, w, h)  → [x, y] of a world point in the painted canvas (to place a glow under an object)
import { THREE } from "/public/components/stage.js";

export function backdrop(scene, camera, paint, dist = camera.far * 0.9) {
  const h = 2 * dist * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), w = h * camera.aspect;
  const c = document.createElement("canvas");
  c.width = 2048; c.height = Math.round(2048 / camera.aspect);
  camera.updateMatrixWorld();
  paint(c.getContext("2d"), c.width, c.height);
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map, toneMapped: false }));
  plane.position.z = -dist;
  camera.add(plane);
  scene.add(camera);
  return plane;
}

export function toCanvas(camera, point, w, h) {
  const v = new THREE.Vector3(...point).project(camera);
  return [(v.x + 1) / 2 * w, (1 - v.y) / 2 * h];
}
