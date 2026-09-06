import type { Point } from "./types";
import type { Wall } from "./types";
import { nearestWall } from "./walls";

/**
 * Doors and windows are decorative furniture that live on walls. These helpers keep the
 * geometry pure and testable: snapping a piece onto the nearest wall, and slicing a wall
 * into solid pieces around its openings for the 3D build.
 */

/** One opening along a wall, all in metres measured from the wall's `a` end. */
export interface OpeningCut {
  along: number;
  w: number;
  /** Bottom of the hole (0 for doors, sill height for windows). */
  bottom: number;
  /** Top of the hole. */
  top: number;
}

/** A solid box of wall: x along the wall from `a`, y up from the floor. */
export interface WallPiece {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/** Split a wall of length `len` and height `h` into solid pieces around the cuts. Overlapping cuts merge; cuts outside the wall are clipped. */
export function wallPieces(len: number, h: number, cuts: OpeningCut[]): WallPiece[] {
  const out: WallPiece[] = [];
  const sorted = cuts
    .map((c) => ({ ...c, x0: Math.max(0, c.along - c.w / 2), x1: Math.min(len, c.along + c.w / 2) }))
    .filter((c) => c.x1 - c.x0 > 0.01)
    .sort((p, q) => p.x0 - q.x0);
  let cursor = 0;
  for (const c of sorted) {
    const x0 = Math.max(cursor, c.x0);
    if (x0 >= c.x1) continue;
    if (x0 - cursor > 0.005) out.push({ x0: cursor, x1: x0, y0: 0, y1: h });
    const bottom = Math.max(0, Math.min(c.bottom, h));
    const top = Math.max(bottom, Math.min(c.top, h));
    if (bottom > 0.005) out.push({ x0, x1: c.x1, y0: 0, y1: bottom });
    if (h - top > 0.005) out.push({ x0, x1: c.x1, y0: top, y1: h });
    cursor = c.x1;
  }
  if (len - cursor > 0.005) out.push({ x0: cursor, x1: len, y0: 0, y1: h });
  return out;
}

/** Snap a point onto the nearest wall (within `maxDist`, canvas units) and align rotation to it, keeping the piece's 0°/180° side. */
export function snapToWall(walls: Wall[], pt: Point, rotation: number, maxDist: number): { x: number; y: number; rotation: number; wall: Wall; t: number } | null {
  const hit = nearestWall(walls, pt);
  if (!hit || hit.d > maxDist) return null;
  const { wall: w, t } = hit;
  const angle = Math.round((Math.atan2(w.b[1] - w.a[1], w.b[0] - w.a[0]) * 180) / Math.PI);
  const rel = (((rotation - angle) % 360) + 360) % 360;
  const flip = rel > 90 && rel < 270 ? 180 : 0;
  return { x: w.a[0] + (w.b[0] - w.a[0]) * t, y: w.a[1] + (w.b[1] - w.a[1]) * t, rotation: angle + flip, wall: w, t };
}

/** Midpoint and direction of a polygon's longest edge: a sensible first spot for a door or window. */
export function longestEdge(points: Point[]): { x: number; y: number; rotation: number } {
  let best = { x: points[0][0], y: points[0][1], rotation: 0, len: -1 };
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len > best.len) best = { x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2, rotation: Math.round((Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI), len };
  }
  return { x: best.x, y: best.y, rotation: best.rotation };
}
