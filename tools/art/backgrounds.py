"""Install painted backgrounds and snap the sim's roads onto them.

Usage: python tools/art/backgrounds.py <levelId>=<source image> [...]

Each source is resized to 1280x720 and saved to public/art/bg/<levelId>.jpg.
Image generators keep a reference road's shape but drift it by tens of pixels
in places, so the painted map becomes the ground truth: for every sim segment
we scan across the road, find the painted band, and shift the segment onto its
centre. The snapped vertices are written to art/snapped/<levelId>.json (paste
them into src/content/levels.ts) and art/checks/<levelId>.png shows the result
in green with pad rings in yellow.
"""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
LEVELS = {lvl["id"]: lvl for lvl in json.loads((ROOT / "art" / "levels.json").read_text())}
BG = ROOT / "public" / "art" / "bg"
CHECKS = ROOT / "art" / "checks"
SNAPPED = ROOT / "art" / "snapped"
for d in (BG, CHECKS, SNAPPED):
    d.mkdir(parents=True, exist_ok=True)

W, H = 1280, 720
Pt = tuple[float, float]


def classifier(scenery: str, px, level: dict):
    if scenery == "meadow":
        # Light tan surface only: excludes grass, the brown outline, and shadow.
        return lambda c: c[0] > c[1] + 20 and c[0] > 150
    # Adaptive: road colour = median along the sim centreline, ground colour =
    # median 64px off it; a pixel is road if it is closer to the road colour.
    road = median_color(px, centre_samples(level))
    ground = median_color(px, offset_samples(level, 64))

    def dist2(a, b):
        return sum((a[k] - b[k]) ** 2 for k in range(3))

    return lambda c: dist2(c, road) < dist2(c, ground)


def centre_samples(level: dict, step: int = 6) -> list[Pt]:
    out: list[Pt] = []
    for path in level["paths"]:
        pts = [(p["x"], p["y"]) for p in path["points"]]
        for (x1, y1), (x2, y2) in zip(pts, pts[1:]):
            n = max(1, int(math.hypot(x2 - x1, y2 - y1) // step))
            out += [(x1 + (x2 - x1) * i / n, y1 + (y2 - y1) * i / n) for i in range(n + 1)]
    return out


def offset_samples(level: dict, dist: float, step: int = 6) -> list[Pt]:
    out: list[Pt] = []
    for path in level["paths"]:
        pts = [(p["x"], p["y"]) for p in path["points"]]
        for (x1, y1), (x2, y2) in zip(pts, pts[1:]):
            seg = math.hypot(x2 - x1, y2 - y1)
            if seg == 0:
                continue
            nx, ny = -(y2 - y1) / seg, (x2 - x1) / seg
            n = max(1, int(seg // step))
            for i in range(n + 1):
                cx, cy = x1 + (x2 - x1) * i / n, y1 + (y2 - y1) * i / n
                out += [(cx + nx * dist, cy + ny * dist), (cx - nx * dist, cy - ny * dist)]
    return out


def median_color(px, pts: list[Pt]):
    chans: list[list[int]] = [[], [], []]
    for x, y in pts:
        xi, yi = int(x), int(y)
        if 0 <= xi < W and 0 <= yi < H:
            for k in range(3):
                chans[k].append(px[xi, yi][k])
    return tuple(sorted(ch)[len(ch) // 2] for ch in chans)


def band_centre(px, is_road, cx: float, cy: float, nx: float, ny: float, search: int = 70) -> float | None:
    """Offset along the normal of the painted road band nearest the sim centreline."""
    marks: list[bool] = []
    for t in range(-search, search + 1):
        x, y = int(cx + nx * t), int(cy + ny * t)
        marks.append(bool(is_road(px[x, y])) if 0 <= x < W and 0 <= y < H else False)
    runs: list[tuple[int, int]] = []
    start = None
    for i, m in enumerate(marks):
        if m and start is None:
            start = i
        if not m and start is not None:
            runs.append((start, i - 1))
            start = None
    if start is not None:
        runs.append((start, len(marks) - 1))
    runs = [(a - search, b - search) for a, b in runs if b - a >= 16]
    if not runs:
        return None
    a, b = min(runs, key=lambda r: abs((r[0] + r[1]) / 2))
    return (a + b) / 2


def snap_path(px, is_road, points: list[Pt]) -> list[Pt]:
    lines: list[tuple[Pt, Pt]] = []
    for (x1, y1), (x2, y2) in zip(points, points[1:]):
        seg = math.hypot(x2 - x1, y2 - y1)
        nx, ny = -(y2 - y1) / seg, (x2 - x1) / seg
        offsets: list[float] = []
        for i in range(1, 30):
            t = i / 30
            o = band_centre(px, is_road, x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, nx, ny)
            if o is not None:
                offsets.append(o)
        lateral = sorted(offsets)[len(offsets) // 2] if len(offsets) >= 6 else 0.0
        lines.append(((x1 + nx * lateral, y1 + ny * lateral), (x2 + nx * lateral, y2 + ny * lateral)))

    out: list[Pt] = [lines[0][0]]
    for (a1, a2), (b1, b2) in zip(lines, lines[1:]):
        out.append(intersect(a1, a2, b1, b2) or ((a2[0] + b1[0]) / 2, (a2[1] + b1[1]) / 2))
    out.append(lines[-1][1])

    # A path that enters from the screen edge keeps entering from that edge.
    if points[0][0] == 0:
        (ax, ay), (bx, by) = lines[0]
        out[0] = (0.0, ay + (by - ay) * (0 - ax) / (bx - ax)) if bx != ax else (0.0, ay)
    return [(round(x), round(y)) for x, y in out]


def intersect(p1: Pt, p2: Pt, p3: Pt, p4: Pt) -> Pt | None:
    d = (p1[0] - p2[0]) * (p3[1] - p4[1]) - (p1[1] - p2[1]) * (p3[0] - p4[0])
    if abs(d) < 1e-6:
        return None
    t = ((p1[0] - p3[0]) * (p3[1] - p4[1]) - (p1[1] - p3[1]) * (p3[0] - p4[0])) / d
    return (p1[0] + t * (p2[0] - p1[0]), p1[1] + t * (p2[1] - p1[1]))


def point_segment_gap(p: Pt, a: Pt, b: Pt) -> float:
    ax, ay = a
    bx, by = b
    px_, py_ = p
    l2 = (bx - ax) ** 2 + (by - ay) ** 2
    t = 0 if l2 == 0 else max(0, min(1, ((px_ - ax) * (bx - ax) + (py_ - ay) * (by - ay)) / l2))
    return math.hypot(px_ - (ax + t * (bx - ax)), py_ - (ay + t * (by - ay)))


def install(level_id: str, source: Path) -> None:
    level = LEVELS[level_id]
    img = Image.open(source).convert("RGB")
    if img.size != (W, H):
        img = img.resize((W, H), Image.LANCZOS)
    img.save(BG / f"{level_id}.jpg", quality=88, optimize=True)
    px = img.load()
    is_road = classifier(level["scenery"], px, level)

    snapped = {}
    check = img.copy()
    draw = ImageDraw.Draw(check, "RGBA")
    moved = 0.0
    for path in level["paths"]:
        pts = [(p["x"], p["y"]) for p in path["points"]]
        new = snap_path(px, is_road, pts)
        snapped[path["id"]] = [{"x": x, "y": y} for x, y in new]
        moved = max(moved, max(math.hypot(a[0] - b[0], a[1] - b[1]) for a, b in zip(pts, new)))
        draw.line(new, fill=(40, 255, 80, 110), width=34)
        draw.line(new, fill=(255, 255, 255, 255), width=2)
    for slot in level["slots"]:
        x, y = slot["x"], slot["y"]
        gap = min(point_segment_gap((x, y), (a["x"], a["y"]), (b["x"], b["y"])) for pts in snapped.values() for a, b in zip(pts, pts[1:]))
        colour = (255, 255, 0, 255) if gap >= 42 else (255, 60, 60, 255)
        draw.ellipse([x - 26, y - 14, x + 26, y + 14], outline=colour, width=3)
        if gap < 42:
            print(f"  pad {slot['id']} at ({x}, {y}) is {gap:.0f}px from the road; move it")
    check.save(CHECKS / f"{level_id}.png")
    (SNAPPED / f"{level_id}.json").write_text(json.dumps(snapped, indent=2))
    print(f"{level_id}: snapped from {source.name}; largest vertex move {moved:.0f}px -> art/snapped/{level_id}.json")


for arg in sys.argv[1:]:
    level_id, _, src = arg.partition("=")
    install(level_id, Path(src))
