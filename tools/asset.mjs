// Copy media files of another deck (or of the style library, or of public/assets) into a deck, so the deck holds
// everything its slides show: a slide must never point at another deck's folder or server.
//   node tools/asset.mjs <file> [<file> …] <deck folder>
// A file from <other deck>/assets/<sub>/… goes to <deck>/assets/<sub>/…, any other file to <deck>/assets/media/.
// Prints the address to write in the slide (/deck/assets/…). A file already there with the same content is left
// alone; one with the same name and another content is refused (rename the source, or use the one that is there).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const MEDIA = /\.(webp|svg|png|jpe?g|gif|mp4|webm|glb|bin|ktx2|woff2)$/i;
const args = process.argv.slice(2), deck = path.resolve(args.pop() || ""), files = args.map(f => path.resolve(f));
const fail = message => { console.error(message); process.exit(1); };

if (!files.length) fail("Usage: node tools/asset.mjs <file> [<file> …] <deck folder>");
if (!fs.existsSync(path.join(deck, "deck.json"))) fail(`${deck} is not a deck folder (no deck.json)`);
for (const file of files) {
  if (!file.startsWith(ROOT + path.sep)) fail(`${file} is outside the Keystone folder`);
  if (!MEDIA.test(file)) fail(`${file} is not a media file (images, video, models, fonts)`);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) fail(`${file}: no such file`);
}
for (const file of files) {
  // <somewhere>/assets/<sub>/<name> keeps its place under assets/
  const parts = file.split(path.sep), at = parts.lastIndexOf("assets");
  const inside = at >= 0 && at < parts.length - 2 && !file.startsWith(path.join(ROOT, "public") + path.sep) ? parts.slice(at + 1).join("/") : `media/${path.basename(file)}`;
  const to = path.join(deck, "assets", inside), url = `/deck/assets/${inside}`;
  if (file === to) { console.log(`${url}  (already in this deck)`); continue; }
  if (fs.existsSync(to)) {
    if (fs.readFileSync(to).equals(fs.readFileSync(file))) { console.log(`${url}  (already there, same file)`); continue; }
    fail(`${to} exists with another content: not replaced`);
  }
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(file, to);
  console.log(`${url}  (copied, ${Math.round(fs.statSync(to).size / 1024)} kB)`);
}
