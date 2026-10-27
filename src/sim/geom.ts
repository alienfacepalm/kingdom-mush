import type { Pt } from "../content/types";

export interface Poly {
  points: Pt[];
  seg: number[];
  total: number;
}

export function dist(a: Pt, b: Pt): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function buildPoly(points: Pt[]): Poly {
  const seg: number[] = [];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const len = dist(points[i - 1], points[i]);
    seg.push(len);
    total += len;
  }
  return { points, seg, total };
}

export function pointAlong(poly: Poly, distance: number): Pt {
  let d = clamp(distance, 0, poly.total);
  for (let i = 0; i < poly.seg.length; i++) {
    const len = poly.seg[i];
    if (d <= len || i === poly.seg.length - 1) {
      const t = len === 0 ? 0 : d / len;
      const a = poly.points[i];
      const b = poly.points[i + 1];
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    d -= len;
  }
  return poly.points[poly.points.length - 1];
}

export function normalAlong(poly: Poly, distance: number): Pt {
  let d = clamp(distance, 0, poly.total);
  for (let i = 0; i < poly.seg.length; i++) {
    const len = poly.seg[i];
    if (d <= len || i === poly.seg.length - 1) {
      const a = poly.points[i];
      const b = poly.points[i + 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const mag = Math.hypot(dx, dy) || 1;
      return { x: -dy / mag, y: dx / mag };
    }
    d -= len;
  }
  return { x: 0, y: -1 };
}

export interface Closest {
  point: Pt;
  along: number;
  gap: number;
}

export function closestOnPoly(poly: Poly, x: number, y: number): Closest {
  let best: Closest = { point: poly.points[0], along: 0, gap: dist(poly.points[0], { x, y }) };
  let walked = 0;
  for (let i = 0; i < poly.seg.length; i++) {
    const a = poly.points[i];
    const b = poly.points[i + 1];
    const len = poly.seg[i];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const denom = dx * dx + dy * dy;
    const t = denom === 0 ? 0 : clamp(((x - a.x) * dx + (y - a.y) * dy) / denom, 0, 1);
    const point = { x: a.x + dx * t, y: a.y + dy * t };
    const gap = dist(point, { x, y });
    if (gap < best.gap) best = { point, along: walked + len * t, gap };
    walked += len;
  }
  return best;
}

export function alongOfPoint(poly: Poly, x: number, y: number): number {
  return closestOnPoly(poly, x, y).along;
}
