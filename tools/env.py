# Copyright 2026 SASU Sentient Art
# SPDX-License-Identifier: Apache-2.0
# /// script
# requires-python = ">=3.10"
# dependencies = ["imagecodecs>=2024.9", "numpy", "OpenEXR>=3.3"]
# ///
"""Convert an equirectangular EXR environment (e.g. a 2k EXR from polyhaven.com) into a small Ultra HDR JPEG (JPEG + gain map) for the web.

    uv run tools/env.py <in.exr> <out.uhdr.jpg> [--width 1024] [--quality 90] [--clip 32]

Ultra HDR keeps at most ~49x over SDR white, so radiance above --clip is taken out of the map. When that clipped light
is a real share of the total (a sun), the script prints it as a directional light (direction, colour, intensity) for
public/components/stage.js: three.js shades a DirectionalLight with irradiance = intensity, the same unit as the
clipped energy (∫L dω), so map + light add up to the original. Direction uses three.js equirect mapping (+Y up).
"""
import argparse, json, math
import imagecodecs as ic
import OpenEXR   # imagecodecs no longer reads EXR
import numpy as np

p = argparse.ArgumentParser()
p.add_argument("src"); p.add_argument("dst")
p.add_argument("--width", type=int, default=1024)
p.add_argument("--quality", type=int, default=90)
p.add_argument("--clip", type=float, default=32.0)
a = p.parse_args()

with OpenEXR.File(a.src) as exr:
    ch = exr.channels()
    rgb = (ch["RGB"].pixels if "RGB" in ch else ch["RGBA"].pixels[..., :3] if "RGBA" in ch else np.dstack([ch[c].pixels for c in "RGB"])).astype(np.float32)
H, W = rgb.shape[:2]
k = W // a.width
if k > 1: rgb = rgb[: H // k * k, : W // k * k].reshape(H // k, k, W // k, k, 3).mean((1, 3))
H, W = rgb.shape[:2]

lum = lambda x: x[..., 0] * .2126 + x[..., 1] * .7152 + x[..., 2] * .0722
lat = (0.5 - (np.arange(H) + 0.5) / H) * math.pi                    # +pi/2 at the top row
lon = ((np.arange(W) + 0.5) / W - 0.5) * 2 * math.pi
dw = (2 * math.pi / W) * (math.pi / H) * np.cos(lat)[:, None]       # solid angle of each pixel

L = lum(rgb)
over = np.maximum(L / a.clip, 1.0)
excess = rgb * (1 - 1 / over)[..., None]                             # light above the clip, hue kept
rgb = rgb / over[..., None]

total, cut = float((L * dw).sum()), float((lum(excess) * dw).sum())
sun = None
if cut > 0.02 * total:
    e = (excess * dw[..., None]).reshape(-1, 3).sum(0)               # irradiance it gives, per channel
    wl = (lum(excess) * dw).ravel()
    clat, slat = np.cos(lat)[:, None], np.sin(lat)[:, None]
    d = np.stack([clat * np.cos(lon), np.broadcast_to(slat, (H, W)), clat * np.sin(lon)], -1).reshape(-1, 3)
    d = (d * wl[:, None]).sum(0); d /= np.linalg.norm(d)
    i = float(e.max())
    sun = {"dir": [round(float(v), 4) for v in d], "color": [round(float(v / i), 4) for v in e], "intensity": round(i, 3)}

h = np.concatenate([rgb, np.ones((H, W, 1), np.float32)], -1).astype(np.float16)
U = ic.ULTRAHDR
out = ic.ultrahdr_encode(h, a.quality, scale=1, gamut=U.CG.BT_709, transfer=U.CT.LINEAR, usage=U.USAGE.QUALITY)   # the encoder sets the boost from the content
open(a.dst, "wb").write(out)

back = ic.ultrahdr_decode(out).astype(np.float32)[..., :3]
print(f"{a.dst}: {W}x{H}, {len(out) / 1024:.0f} KB, map energy kept {float((lum(back) * dw).sum()) / (total - cut):.3f}, "
      f"clipped {cut / total:.1%}" + (" (dropped, below 2%)" if cut and not sun else ""))
if sun: print("sun:", json.dumps(sun))
