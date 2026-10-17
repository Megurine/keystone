// Copyright 2026 SASU Sentient Art
// SPDX-License-Identifier: Apache-2.0
// Warn when the browser lacks what the talk's 3D views need (talk.json "requires"). The text slides read fine without it.
const NAMES = { webgl: 'WebGL', webgpu: 'WebGPU' };

function hasWebGL() {
  const canvas = document.createElement('canvas');
  return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
}

async function hasWebGPU() {
  try { return Boolean(await navigator.gpu?.requestAdapter()); } catch { return false; }
}

export async function checkRequirements(talk, requires) {
  const name = NAMES[requires];
  if (!name || (requires === 'webgl' ? hasWebGL() : await hasWebGPU())) return;
  const warning = talk.querySelector('.talk-warning');
  warning.querySelector('b').textContent = `${name} is off`;
  warning.querySelector('span').textContent =
    `The 3D views of this talk are drawn live with ${name}, which is off or not available in this browser. The text slides still read fine.`;
  warning.hidden = false;
}
