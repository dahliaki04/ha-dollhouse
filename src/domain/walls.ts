import type { Layout, Point, Room, Wall } from "./types";
import { collinearOverlap, complementIntervals, lerp, mergeIntervals } from "./geometry";

/**
 * Derive walls from room polygons.
 *
 * Rule: every room edge becomes wall. Where an edge overlaps a collinear edge of
 * another room, that stretch is an INTERIOR wall shared by both rooms (emitted
 * once). The remaining stretches are EXTERIOR walls.
 *
 * Ids are stable across re-derivation so thickness overrides survive:
 *   interior: w:<roomA>|<roomB>|<edgeIndexOfLowerId>
 *   exterior: w:<room>|<edgeIndex>|<pieceIndex>
 */
export function deriveWalls(layout: Layout, tolUnits?: number): Wall[] {
  const tol = tolUnits ?? 0.05 / layout.metresPerUnit; // 5 cm
  const walls: Wall[] = [];
  const seenInterior = new Set<string>();
  const rooms = layout.rooms;

  for (const room of rooms) {
    const n = room.points.length;
    for (let i = 0; i < n; i++) {
      const a = room.points[i];
      const b = room.points[(i + 1) % n];
      const shared: [number, number][] = [];
      const sharedWith: { room: Room; iv: [number, number] }[] = [];

      for (const other of rooms) {
        if (other.id === room.id) continue;
        const m = other.points.length;
        for (let j = 0; j < m; j++) {
          const ov = collinearOverlap(a, b, other.points[j], other.points[(j + 1) % m], tol);
          if (ov) {
            shared.push(ov);
            sharedWith.push({ room: other, iv: ov });
          }
        }
      }

      // Interior pieces: one wall per (this room, other room, overlap).
      for (const { room: other, iv } of sharedWith) {
        const lower = room.id < other.id ? room : other;
        const key = `${[room.id, other.id].sort().join("|")}|${lower.id === room.id ? i : "?"}`;
        // Emit only from the lower-id room so each interior wall appears once.
        if (lower.id !== room.id) continue;
        if (seenInterior.has(key)) continue;
        seenInterior.add(key);
        const id = `w:${key}`;
        walls.push(makeWall(layout, id, lerp(a, b, iv[0]), lerp(a, b, iv[1]), false, [room.id, other.id]));
      }

      // Exterior pieces: the complement of all shared stretches.
      const ext = complementIntervals(mergeIntervals(shared), tol / Math.max(1e-9, Math.hypot(b[0] - a[0], b[1] - a[1])));
      ext.forEach((iv, k) => {
        const id = `w:${room.id}|${i}|${k}`;
        walls.push(makeWall(layout, id, lerp(a, b, iv[0]), lerp(a, b, iv[1]), true, [room.id]));
      });
    }
  }
  return walls;
}

function makeWall(layout: Layout, id: string, a: Point, b: Point, exterior: boolean, rooms: string[]): Wall {
  const override = layout.wallThickness[id];
  const thickness = override ?? (exterior ? layout.wallDefaults.exterior : layout.wallDefaults.interior);
  return { id, a, b, exterior, rooms, thickness, overridden: override !== undefined };
}

/** Wall thickness in canvas units (for rendering). */
export function wallThicknessUnits(wall: Wall, layout: Layout): number {
  return wall.thickness / layout.metresPerUnit;
}

/** Apply one thickness (metres) to many walls. Returns the new override map. */
export function setThickness(layout: Layout, wallIds: string[], metres: number): Record<string, number> {
  const next = { ...layout.wallThickness };
  for (const id of wallIds) next[id] = metres;
  return next;
}

/** Drop overrides for walls that no longer exist (call after room edits). */
export function pruneOverrides(layout: Layout, walls: Wall[]): Record<string, number> {
  const live = new Set(walls.map((w) => w.id));
  const next: Record<string, number> = {};
  for (const [id, t] of Object.entries(layout.wallThickness)) if (live.has(id)) next[id] = t;
  return next;
}
