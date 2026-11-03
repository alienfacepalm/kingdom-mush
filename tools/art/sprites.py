"""Chroma-key the generated magenta sprite sheets, slice them into named frames,
and pack everything into one Phaser atlas: public/art/sprites.png + sprites.json.

Usage:  python tools/art/sprites.py [sheet-dir]
The sheet dir defaults to art/src, which holds the raw generated sheets.
Debug images with labelled boxes land in art/checks/sheet-<name>.png.
"""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

ASSETS = sys.argv[1] if len(sys.argv) > 1 else os.path.join("art", "src")

# sheet file -> (rows of names in reading order, target height per row, pack scale note)
SHEETS = {
    # "scale" sheets keep the painter's relative sizes (tier 1 stays smaller than tier 3);
    # "height" sheets normalise each frame to a pixel height. "override" is per-frame.
    "sheet-towers-a": {
        "rows": [
            ["archer1", "archer2", "archer3", "archer-a", "archer-b"],
            ["barracks1", "barracks2", "barracks3", "barracks-a", "barracks-b"],
        ],
        "scale": 0.42,
    },
    "sheet-towers-b": {
        "rows": [
            ["mage1", "mage2", "mage3", "mage-a", "mage-b"],
            ["artillery1", "artillery2", "artillery3", "artillery-a", "artillery-b"],
        ],
        "scale": 0.42,
    },
    "sheet-foes": {
        "rows": [
            ["sprout", "runner", "beetle", "shade"],
            ["gnat", "brute", "shaman", "rotking"],
        ],
        "scale": 0.32,
        "override": {"rotking": 0.42, "sprout": 0.28, "gnat": 0.28},
    },
    "sheet-units": {
        "rows": [
            ["soldier1", "soldier2", "soldier3", "paladin"],
            ["axe", "elemental", "reinforcement", "hero"],
        ],
        "scale": 0.24,
        "override": {"hero": 0.3, "elemental": 0.3},
    },
    "sheet-ui": {
        "rows": [
            ["btn", "btn-hi", "panel", "scroll"],
            ["ic-archer", "ic-barracks", "ic-mage", "ic-artillery", "ic-gold", "ic-heart", "ic-skull", "ic-star"],
            ["btn-pause", "btn-fast", "slot-aid", "slot-rain", "slot-burst", "btn-sell", "btn-up", "btn-x"],
        ],
        "height": 96,
        "override": {"btn": 72, "btn-hi": 72, "panel": 260, "scroll": 200},
    },
    "sheet-fx": {
        "rows": [
            ["pad", "pad-flag", "flags", "spawn-sign", "rally", "tomb"],
            ["arrow", "bolt", "bomb", "axe-proj", "spark", "poison"],
            ["boom-s", "boom-l", "puff", "poison-cloud", "sparkle", "ring", "coin", "splat"],
        ],
        "height": 72,
        "override": {"pad": 56, "pad-flag": 60, "flags": 64, "spawn-sign": 80, "arrow": 40, "bolt": 36,
                     "bomb": 34, "axe-proj": 38, "spark": 48, "poison": 36, "boom-l": 110, "boom-s": 80,
                     "puff": 80, "poison-cloud": 90, "coin": 28, "splat": 30, "sparkle": 60, "ring": 70},
    },
}


def key_sheet(path: str) -> Image.Image:
    im = Image.open(path).convert("RGB")
    px = np.asarray(im).astype(np.float32)
    h, w, _ = px.shape
    corners = np.concatenate([
        px[:24, :24].reshape(-1, 3), px[:24, -24:].reshape(-1, 3),
        px[-24:, :24].reshape(-1, 3), px[-24:, -24:].reshape(-1, 3)])
    bg = np.median(corners, axis=0)
    d = np.sqrt(((px - bg) ** 2).sum(axis=2))
    # Also key on hue: pixels whose red/blue dominate green in the same way as the bg.
    lo, hi = 48.0, 120.0
    alpha = np.clip((d - lo) / (hi - lo), 0, 1)
    # Despill: undo the blend with the background for soft-edge pixels.
    a = alpha[..., None]
    safe = np.where(a > 0.02, a, 1)
    rgb = np.where(a > 0.02, (px - (1 - a) * bg) / safe, px)
    rgb = np.clip(rgb, 0, 255)
    out = np.dstack([rgb, alpha * 255]).astype(np.uint8)
    return Image.fromarray(out, "RGBA")


def find_blobs(alpha: np.ndarray):
    mask = alpha > 90
    grown = ndimage.binary_dilation(mask, iterations=3)
    labels, count = ndimage.label(grown, structure=np.ones((3, 3)))
    blobs = []
    for idx, sl in enumerate(ndimage.find_objects(labels), start=1):
        if sl is None:
            continue
        region = mask[sl] & (labels[sl] == idx)
        if region.sum() < 160:
            continue
        ys, xs = np.nonzero(region)
        y0, x0 = sl[0].start, sl[1].start
        blobs.append([x0 + xs.min(), y0 + ys.min(), x0 + xs.max() + 1, y0 + ys.max() + 1])
    return blobs


def group_rows(blobs, expected_rows):
    blobs = sorted(blobs, key=lambda b: (b[1] + b[3]) / 2)
    rows = []
    for b in blobs:
        cy = (b[1] + b[3]) / 2
        if rows and abs(cy - rows[-1]["cy"]) < 95:
            rows[-1]["items"].append(b)
            rows[-1]["cy"] = np.mean([(i[1] + i[3]) / 2 for i in rows[-1]["items"]])
        else:
            rows.append({"cy": cy, "items": [b]})
    rows.sort(key=lambda r: r["cy"])
    if len(rows) != len(expected_rows):
        raise SystemExit(f"expected {len(expected_rows)} rows, found {len(rows)}: {[len(r['items']) for r in rows]}")
    result = []
    for row, names in zip(rows, expected_rows):
        items = sorted(row["items"], key=lambda b: b[0])
        while len(items) > len(names):
            # Merge the two horizontally closest neighbours (split sprites such as flag pairs).
            gaps = [items[i + 1][0] - items[i][2] for i in range(len(items) - 1)]
            i = int(np.argmin(gaps))
            a, b = items[i], items[i + 1]
            items[i:i + 2] = [[min(a[0], b[0]), min(a[1], b[1]), max(a[2], b[2]), max(a[3], b[3])]]
        if len(items) < len(names):
            raise SystemExit(f"row {names}: found only {len(items)} sprites")
        result.append(list(zip(names, items)))
    return result


def pack(frames):
    """Simple shelf packer. frames: list of (name, Image). Returns (atlas, json)."""
    frames = sorted(frames, key=lambda f: -f[1].height)
    width = 2048
    x = y = shelf = 0
    pad = 2
    placed = []
    for name, im in frames:
        if x + im.width + pad > width:
            x = 0
            y += shelf + pad
            shelf = 0
        placed.append((name, im, x, y))
        x += im.width + pad
        shelf = max(shelf, im.height)
    height = y + shelf + pad
    height = 1 << (height - 1).bit_length()
    atlas = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    data = {"frames": {}, "meta": {"image": "sprites.png", "size": {"w": width, "h": height}, "scale": "1"}}
    for name, im, px, py in placed:
        atlas.paste(im, (px, py))
        data["frames"][name] = {
            "frame": {"x": px, "y": py, "w": im.width, "h": im.height},
            "rotated": False,
            "trimmed": False,
            "spriteSourceSize": {"x": 0, "y": 0, "w": im.width, "h": im.height},
            "sourceSize": {"w": im.width, "h": im.height},
        }
    return atlas, data


def main():
    os.makedirs("art/checks", exist_ok=True)
    os.makedirs("public/art", exist_ok=True)
    frames = []
    for sheet, spec in SHEETS.items():
        path = os.path.join(ASSETS, sheet + ".jpg")
        if not os.path.exists(path):
            print(f"missing {path}")
            continue
        rgba = key_sheet(path)
        alpha = np.asarray(rgba)[..., 3]
        blobs = find_blobs(alpha)
        rows = group_rows(blobs, spec["rows"])
        debug = rgba.copy().convert("RGB")
        draw = ImageDraw.Draw(debug)
        for row in rows:
            for name, (x0, y0, x1, y1) in row:
                draw.rectangle((x0, y0, x1, y1), outline=(0, 255, 0), width=2)
                draw.text((x0 + 3, y0 + 3), name, fill=(255, 255, 0))
                crop = rgba.crop((x0, y0, x1, y1))
                if "scale" in spec:
                    scale = spec.get("override", {}).get(name, spec["scale"])
                else:
                    target = spec.get("override", {}).get(name, spec["height"])
                    scale = target / crop.height
                size = (max(1, round(crop.width * scale)), max(1, round(crop.height * scale)))
                crop = crop.resize(size, Image.LANCZOS)
                frames.append((name, crop))
        debug.save(f"art/checks/{sheet}.png")
        print(f"{sheet}: {sum(len(r) for r in rows)} sprites")
    atlas, data = pack(frames)
    atlas.save("public/art/sprites.png", optimize=True)
    with open("public/art/sprites.json", "w", encoding="utf-8") as fh:
        json.dump(data, fh, indent=1)
    print(f"atlas {atlas.width}x{atlas.height}, {len(frames)} frames -> public/art/sprites.png")


if __name__ == "__main__":
    main()
