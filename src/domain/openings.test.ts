import { describe, expect, it } from "vitest";
import { longestEdge, snapToWall, wallPieces } from "./openings";
import { deriveWalls } from "./walls";
import { emptyLayout, type Room } from "./types";
import { rectToPolygon } from "./geometry";

describe("wallPieces", () => {
  it("returns the whole wall when there are no cuts", () => {
    expect(wallPieces(4, 2.8, [])).toEqual([{ x0: 0, x1: 4, y0: 0, y1: 2.8 }]);
  });

  it("cuts a door: two side pieces and a lintel", () => {
    const p = wallPieces(4, 2.8, [{ along: 2, w: 0.9, bottom: 0, top: 2.1 }]);
    expect(p).toEqual([
      { x0: 0, x1: 1.55, y0: 0, y1: 2.8 },
      { x0: 1.55, x1: 2.45, y0: 2.1, y1: 2.8 },
      { x0: 2.45, x1: 4, y0: 0, y1: 2.8 },
    ]);
  });

  it("cuts a window: sill below and lintel above", () => {
    const p = wallPieces(3, 2.8, [{ along: 1.5, w: 1.2, bottom: 0.9, top: 2.1 }]);
    expect(p.map((x) => [x.x0, x.x1, x.y0, x.y1])).toEqual([
      [0, 0.9, 0, 2.8],
      [0.9, 2.1, 0, 0.9],
      [0.9, 2.1, 2.1, 2.8],
      [2.1, 3, 0, 2.8],
    ]);
  });

  it("clips cuts to the wall and merges overlaps", () => {
    const p = wallPieces(2, 2.8, [{ along: 0.2, w: 0.9, bottom: 0, top: 2.1 }, { along: 0.6, w: 0.9, bottom: 0, top: 2.1 }]);
    // no piece before x=0, one lintel run, then the rest of the wall
    expect(p[0]).toEqual({ x0: 0, x1: 0.65, y0: 2.1, y1: 2.8 });
    expect(p.at(-1)).toEqual({ x0: 1.05, x1: 2, y0: 0, y1: 2.8 });
    expect(p.every((x) => x.x0 >= 0 && x.x1 <= 2)).toBe(true);
  });

  it("drops a cut taller than the wall without a lintel", () => {
    const p = wallPieces(3, 2.4, [{ along: 1.5, w: 1, bottom: 0, top: 2.4 }]);
    expect(p).toEqual([{ x0: 0, x1: 1, y0: 0, y1: 2.4 }, { x0: 2, x1: 3, y0: 0, y1: 2.4 }]);
  });
});

describe("snapToWall", () => {
  const room: Room = { id: "r", name: "r", points: rectToPolygon(0, 0, 400, 300) };
  const walls = deriveWalls({ ...emptyLayout(), metresPerUnit: 0.01, rooms: [room] });

  it("lands on the wall centreline with the wall's angle", () => {
    const s = snapToWall(walls, [200, 20], 0, 60)!;
    expect(s.y).toBe(0);
    expect(s.x).toBe(200);
    expect(s.rotation % 180).toBe(0);
  });

  it("keeps the 180° side and returns null when too far", () => {
    const s = snapToWall(walls, [200, 20], 180, 60)!;
    expect(Math.abs(s.rotation % 360)).toBe(180);
    expect(snapToWall(walls, [200, 150], 0, 60)).toBeNull();
  });
});

describe("longestEdge", () => {
  it("picks the midpoint of the longest side", () => {
    expect(longestEdge(rectToPolygon(0, 0, 400, 300))).toMatchObject({ x: 200, rotation: 0 });
  });
});
