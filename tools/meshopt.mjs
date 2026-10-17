// Compress the geometry of GLB models with meshopt (EXT_meshopt_compression), in place. Textures are kept as they are.
//
//   node tools/meshopt.mjs <folder or .glb> …     e.g. node tools/meshopt.mjs decks/my-talk/assets/models
//
// Runs gltfpack (meshoptimizer, through npx: needs Node and a network the first time) with: -cc (meshopt, higher
// compression), -kn -km -ke (keep node names, materials and extras: code looks props up by name), -kv (keep every
// vertex attribute: COLOR_0 and second UV sets are read by slide shaders), -vtf (float UVs: applyChecker() and
// texel-density figures replace the materials, which would drop the UV dequantisation), -vpf (float positions, in
// metres: shaders such as the triplanar splat material read object-space positions; costs ~2 %). Normals are
// quantised. stage.js loadModel() decodes these files; a slide with its own
// GLTFLoader needs .setMeshoptDecoder(MeshoptDecoder) from /public/vendor/jsm/libs/meshopt_decoder.module.js.
// Models already compressed are skipped, so it is safe to run again after a new export.
import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const args = process.argv.slice(2);
if (!args.length) { console.error("Usage: node tools/meshopt.mjs <folder or .glb> …"); process.exit(1); }
const files = args.flatMap(a => fs.statSync(a).isDirectory()
  ? fs.readdirSync(a).filter(f => f.endsWith(".glb")).map(f => path.join(a, f)) : [a]);

const extensions = file => {
  const b = fs.readFileSync(file), len = b.readUInt32LE(12);
  return JSON.parse(b.subarray(20, 20 + len).toString()).extensionsUsed || [];
};
let before = 0, after = 0;
for (const f of files) {
  if (extensions(f).includes("EXT_meshopt_compression")) { console.log(`  ${f}: already compressed`); continue; }
  const tmp = path.join(os.tmpdir(), `meshopt-${process.pid}-${path.basename(f)}`);
  execSync(`npx --yes gltfpack -i "${f}" -o "${tmp}" -cc -kn -km -ke -kv -vtf -vpf`, { stdio: "ignore" });   // npx is a script on Windows: run through the shell
  const a = fs.statSync(f).size, b = fs.statSync(tmp).size;
  fs.copyFileSync(tmp, f); fs.rmSync(tmp);
  before += a; after += b;
  console.log(`  ${f}: ${(a / 1e3).toFixed(0)} → ${(b / 1e3).toFixed(0)} kB`);
}
if (before) console.log(`${(before / 1e6).toFixed(1)} → ${(after / 1e6).toFixed(1)} MB`);
