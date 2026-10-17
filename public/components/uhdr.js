// Ultra HDR decoder: JPEG + gain map (ISO 21496-1 metadata, as written by libultrahdr / tools/env.py) → linear HDR.
// Spec formula at full boost: hdr = (sdr + offsetSdr) · 2^lerp(min, max, gain^(1/gamma)) − offsetHdr, in linear sRGB.
//
//   import { loadUltraHDR } from "/public/components/uhdr.js";
//   const { width, height, data } = await loadUltraHDR(url);   // data: Float32Array RGBA, rows bottom to top
//
// parseUltraHDR(arrayBuffer) and applyGainMap(sdr, gain, meta, w, h) are pure (no DOM), for tests.

const ISO = "urn:iso:std:iso:ts:21496:-1\0";

// APP segments of one JPEG stream, up to its image data.
function segments(bytes, start) {
  const out = [];
  let i = start + 2;                                   // after SOI
  while (i + 4 <= bytes.length && bytes[i] === 0xff) {
    const marker = bytes[i + 1], len = (bytes[i + 2] << 8) | bytes[i + 3];
    if (marker === 0xda) break;                        // start of scan
    out.push({ marker, start: i + 4, end: i + 2 + len });
    i += 2 + len;
  }
  return out;
}
const startsWith = (bytes, at, text) => [...text].every((c, k) => bytes[at + k] === c.charCodeAt(0));

// MPF (CIPA DC-007): the second image of the file is the gain map.
function mpfImages(bytes, seg) {
  const t = seg.start + 4, v = new DataView(bytes.buffer, bytes.byteOffset + t), le = v.getUint16(0) === 0x4949;
  const ifd = v.getUint32(4, le), n = v.getUint16(ifd, le);
  for (let e = 0; e < n; e++) {
    const p = ifd + 2 + e * 12;
    if (v.getUint16(p, le) !== 0xb002) continue;
    const count = v.getUint32(p + 4, le) / 16, list = v.getUint32(p + 8, le);
    return Array.from({ length: count }, (_, k) => ({
      size: v.getUint32(list + k * 16 + 4, le),
      offset: k ? t + v.getUint32(list + k * 16 + 8, le) : 0,
    }));
  }
  throw new Error("Ultra HDR: no MP entry list");
}

// ISO 21496-1 gain map metadata (big endian). Values in log2 units for min / max.
function isoMetadata(bytes, seg) {
  const v = new DataView(bytes.buffer, bytes.byteOffset + seg.start + ISO.length);
  let p = 0;
  const u16 = () => (p += 2, v.getUint16(p - 2)), u8 = () => v.getUint8(p++);
  const u32 = () => (p += 4, v.getUint32(p - 4)), s32 = () => (p += 4, v.getInt32(p - 4));
  if (u16() !== 0) throw new Error("Ultra HDR: unsupported metadata version");
  u16();
  const flags = u8(), channels = flags & 0x80 ? 3 : 1, common = flags & 0x08;
  const d = common ? u32() : 0;
  const frac = signed => { const n = signed ? s32() : u32(); return n / (common ? d : u32()); };
  const meta = { baseHeadroom: frac(false), altHeadroom: frac(false), backward: !!(flags & 0x04), min: [], max: [], gamma: [], offsetSdr: [], offsetHdr: [] };
  for (let c = 0; c < channels; c++) {
    meta.min.push(frac(true)); meta.max.push(frac(true)); meta.gamma.push(frac(false));
    meta.offsetSdr.push(frac(true)); meta.offsetHdr.push(frac(true));
  }
  return meta;
}

export function parseUltraHDR(buffer) {
  const bytes = new Uint8Array(buffer);
  const mpf = segments(bytes, 0).find(s => s.marker === 0xe2 && startsWith(bytes, s.start, "MPF\0"));
  if (!mpf) throw new Error("Ultra HDR: not an Ultra HDR JPEG (no MPF)");
  const [first, second] = mpfImages(bytes, mpf);
  const gainmap = bytes.subarray(second.offset, second.offset + second.size);
  const iso = segments(gainmap, 0).find(s => s.marker === 0xe2 && startsWith(gainmap, s.start, ISO));
  if (!iso) throw new Error("Ultra HDR: no ISO 21496-1 gain map metadata");
  const meta = isoMetadata(gainmap, iso);
  if (meta.backward) throw new Error("Ultra HDR: HDR base images are not supported");
  return { primary: bytes.subarray(0, first.size), gainmap, meta };
}

const LIN = Float32Array.from({ length: 256 }, (_, i) => { const c = i / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });

// sdr, gain: RGBA bytes of the same size (top row first). Returns linear RGBA floats, bottom row first (three.js DataTexture).
export function applyGainMap(sdr, gain, meta, w, h) {
  const out = new Float32Array(w * h * 4), m = c => (meta.min.length > 1 ? c : 0);
  const lut = [0, 1, 2].map(c => {                     // boost per 8-bit gain value, per channel
    const k = m(c), g = meta.gamma[k];
    return Float32Array.from({ length: 256 }, (_, i) => {
      const x = g === 1 ? i / 255 : (i / 255) ** (1 / g);
      return 2 ** (meta.min[k] * (1 - x) + meta.max[k] * x);
    });
  });
  for (let y = 0; y < h; y++) {
    const src = y * w * 4, dst = (h - 1 - y) * w * 4;
    for (let x = 0; x < w * 4; x += 4) {
      for (let c = 0; c < 3; c++) {
        const k = m(c);
        out[dst + x + c] = Math.max(0, (LIN[sdr[src + x + c]] + meta.offsetSdr[k]) * lut[c][gain[src + x + c]] - meta.offsetHdr[k]);
      }
      out[dst + x + 3] = 1;
    }
  }
  return out;
}

// The gain map holds data, not colour: without its ICC profile, browsers decode its values unchanged. (Safari ignores
// colorSpaceConversion: "none" and colour-converts a gain map that carries a profile: values off by the sRGB curve.)
export function withoutICC(jpeg) {
  const keep = [jpeg.subarray(0, 2)];
  let i = 2;
  while (i + 4 <= jpeg.length && jpeg[i] === 0xff && jpeg[i + 1] !== 0xda) {
    const end = i + 2 + ((jpeg[i + 2] << 8) | jpeg[i + 3]);
    if (!(jpeg[i + 1] === 0xe2 && startsWith(jpeg, i + 4, "ICC_PROFILE\0"))) keep.push(jpeg.subarray(i, end));
    i = end;
  }
  keep.push(jpeg.subarray(i));                         // start of scan to the end
  const out = new Uint8Array(keep.reduce((n, k) => n + k.length, 0));
  keep.reduce((at, k) => (out.set(k, at), at + k.length), 0);
  return out;
}

async function pixels(jpeg, w, h) {
  const bmp = await createImageBitmap(new Blob([jpeg], { type: "image/jpeg" }), { colorSpaceConversion: "none" });
  w ||= bmp.width; h ||= bmp.height;
  const ctx = new OffscreenCanvas(w, h).getContext("2d", { willReadFrequently: true });
  ctx.drawImage(bmp, 0, 0, w, h);                      // the gain map may be smaller: stretched to the image size
  return { w, h, data: ctx.getImageData(0, 0, w, h).data };
}

export async function loadUltraHDR(url) {
  const { primary, gainmap, meta } = parseUltraHDR(await (await fetch(url)).arrayBuffer());
  const sdr = await pixels(primary);
  const gain = await pixels(withoutICC(gainmap), sdr.w, sdr.h);
  return { width: sdr.w, height: sdr.h, data: applyGainMap(sdr.data, gain.data, meta, sdr.w, sdr.h) };
}
