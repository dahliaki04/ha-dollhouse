import type { Point } from "./types";

export const dist = (a: Point, b: Point): number => Math.hypot(a[0] - b[0], a[1] - b[1]);

export const lerp = (a: Point, b: Point, t: number): Point => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

export function polygonArea(pts: Point[]): number {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    s += x1 * y2 - x2 * y1;
  }
  return s / 2;
}

export function centroid(pts: Point[]): Point {
  const a = polygonArea(pts);
  if (Math.abs(a) < 1e-9) {
    const n = pts.length || 1;
    return [pts.reduce((s, p) => s + p[0], 0) / n, pts.reduce((s, p) => s + p[1], 0) / n];
  }
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    const f = x1 * y2 - x2 * y1;
    cx += (x1 + x2) * f;
    cy += (y1 + y2) * f;
  }
  return [cx / (6 * a), cy / (6 * a)];
}

export function bbox(pts: Point[]): { x: number; y: number; w: number; h: number } {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

export function pointInPolygon(p: Point, pts: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    const hit = yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi;
    if (hit) inside = !inside;
  }
  return inside;
}

/** Distance from point p to segment ab, plus the projection parameter t (clamped). */
export function pointToSegment(p: Point, a: Point, b: Point): { d: number; t: number } {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return { d: dist(p, a), t: 0 };
  let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return { d: dist(p, lerp(a, b, t)), t };
}

/**
 * If segment cd lies on the same line as ab (within `tol`), return the overlap
 * interval expressed as parameters of ab, else null.
 */
export function collinearOverlap(a: Point, b: Point, c: Point, d: Point, tol: number): [number, number] | null {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return null;
  // Perpendicular distance of c and d from line ab.
  const perp = (p: Point) => Math.abs((p[0] - a[0]) * dy - (p[1] - a[1]) * dx) / Math.sqrt(len2);
  if (perp(c) > tol || perp(d) > tol) return null;
  const proj = (p: Point) => ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2;
  const t0 = Math.max(0, Math.min(proj(c), proj(d)));
  const t1 = Math.min(1, Math.max(proj(c), proj(d)));
  const minLen = tol / Math.sqrt(len2);
  return t1 - t0 > minLen ? [t0, t1] : null;
}

/** Merge overlapping [t0,t1] intervals. */
export function mergeIntervals(iv: [number, number][]): [number, number][] {
  const sorted = [...iv].sort((p, q) => p[0] - q[0]);
  const out: [number, number][] = [];
  for (const [s, e] of sorted) {
    const last = out[out.length - 1];
    if (last && s <= last[1] + 1e-9) last[1] = Math.max(last[1], e);
    else out.push([s, e]);
  }
  return out;
}

/** Complement of intervals inside [0,1]. */
export function complementIntervals(iv: [number, number][], minLen = 1e-6): [number, number][] {
  const out: [number, number][] = [];
  let cur = 0;
  for (const [s, e] of mergeIntervals(iv)) {
    if (s - cur > minLen) out.push([cur, s]);
    cur = Math.max(cur, e);
  }
  if (1 - cur > minLen) out.push([cur, 1]);
  return out;
}

export function snapToGrid(v: number, step: number): number {
  return step > 0 ? Math.round(v / step) * step : v;
}

export function rectToPolygon(x: number, y: number, w: number, h: number): Point[] {
  return [
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
  ];
}

/** Ensure counter-clockwise winding in screen space (y down => negative area). */
export function normalizeWinding(pts: Point[]): Point[] {
  return polygonArea(pts) > 0 ? [...pts].reverse() : pts;
}
