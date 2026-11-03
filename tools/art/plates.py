"""Draw road-only layout plates for each march.

The plates are reference images for the painted backgrounds: flat ground, the
exact road route at game scale, and the two hold flags. No pads, no props, no
interface. Output: art/plates/<level>.png at 1280x720.

Run: python tools/art/plates.py
"""
from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
LEVELS = json.loads((ROOT / "art" / "levels.json").read_text())
OUT = ROOT / "art" / "plates"
OUT.mkdir(parents=True, exist_ok=True)

GROUND = {
    "meadow": (84, 150, 68),
    "fen": (62, 110, 86),
    "keep": (78, 86, 94),
}
ROAD = {
    "meadow": ((196, 160, 92), (138, 104, 52)),
    "fen": ((150, 160, 104), (90, 100, 60)),
    "keep": ((112, 98, 84), (62, 54, 46)),
}


def stroke(draw: ImageDraw.ImageDraw, pts: list[tuple[int, int]], width: int, color: tuple[int, int, int]) -> None:
    draw.line(pts, fill=color, width=width, joint="curve")
    r = width // 2
    for x, y in pts:
        draw.ellipse([x - r, y - r, x + r, y + r], fill=color)


for level in LEVELS:
    scenery = level["scenery"]
    img = Image.new("RGB", (1280, 720), GROUND[scenery])
    draw = ImageDraw.Draw(img)
    dirt, edge = ROAD[scenery]
    for path in level["paths"]:
        pts = [(p["x"], p["y"]) for p in path["points"]]
        stroke(draw, pts, 48, edge)
    for path in level["paths"]:
        pts = [(p["x"], p["y"]) for p in path["points"]]
        stroke(draw, pts, 36, dirt)
    # Hold flags at the end of the first path.
    ex, ey = (level["paths"][0]["points"][-1][k] for k in ("x", "y"))
    for dx in (-18, 12):
        draw.rectangle([ex + dx, ey - 46, ex + dx + 5, ey - 14], fill=(244, 240, 230))
        draw.polygon([(ex + dx, ey - 46), (ex + dx + 16, ey - 40), (ex + dx, ey - 32)], fill=(192, 57, 43))
    img.save(OUT / f"{level['id']}.png")
    print("plate", level["id"])
