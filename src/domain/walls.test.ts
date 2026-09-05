import { describe, expect, it } from "vitest";
import { emptyLayout, type Layout, type Room } from "./types";
import { rectToPolygon } from "./geometry";
import { deriveWalls, pruneOverrides, pruneVirtual, setThickness, setVirtual } from "./walls";

const room = (id: string, x: number, y: number, w: number, h: number): Room => ({
  id,
  name: id,
  points: rectToPolygon(x, y, w, h),
});

const layoutWith = (...rooms: Room[]): Layout => ({ ...emptyLayout(), metresPerUnit: 0.01, rooms });

const len = (w: { a: [number, number]; b: [number, number] }) => Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]);

describe("deriveWalls", () => {
  it("single room => 4 exterior walls with default thickness", () => {
    const walls = deriveWalls(layoutWith(room("a", 0, 0, 400, 300)));
    expect(walls).toHaveLength(4);
    expect(walls.every((w) => w.exterior)).toBe(true);
    expect(walls.every((w) => w.thickness === 0.24)).toBe(true);
  });

  it("two rooms sharing a full edge => 1 interior wall, 6 exterior", () => {
    const walls = deriveWalls(layoutWith(room("a", 0, 0, 400, 300), room("b", 400, 0, 300, 300)));
    const interior = walls.filter((w) => !w.exterior);
    const exterior = walls.filter((w) => w.exterior);
    expect(interior).toHaveLength(1);
    expect(interior[0].rooms.sort()).toEqual(["a", "b"]);
    expect(interior[0].thickness).toBe(0.12);
    expect(len(interior[0])).toBeCloseTo(300);
    expect(exterior).toHaveLength(6);
  });

  it("partial overlap splits the long edge into exterior + interior pieces", () => {
    // b touches only the middle 200 of a's right edge (300 tall)
    const walls = deriveWalls(layoutWith(room("a", 0, 0, 400, 300), room("b", 400, 50, 300, 200)));
    const interior = walls.filter((w) => !w.exterior);
    expect(interior).toHaveLength(1);
    expect(len(interior[0])).toBeCloseTo(200);
    // a's right edge contributes two exterior stubs of 50 each
    const stubs = walls.filter((w) => w.exterior && w.rooms[0] === "a" && w.id.startsWith("w:a|1|"));
    expect(stubs.map(len).sort()).toEqual([50, 50]);
  });

  it("edges within tolerance (5cm) still count as shared", () => {
    // 3 units = 3 cm at 0.01 m/unit
    const walls = deriveWalls(layoutWith(room("a", 0, 0, 400, 300), room("b", 403, 0, 300, 300)));
    expect(walls.filter((w) => !w.exterior)).toHaveLength(1);
  });

  it("edges beyond tolerance are separate exterior walls", () => {
    const walls = deriveWalls(layoutWith(room("a", 0, 0, 400, 300), room("b", 420, 0, 300, 300)));
    expect(walls.filter((w) => !w.exterior)).toHaveLength(0);
    expect(walls).toHaveLength(8);
  });

  it("thickness override survives re-derivation and moving both rooms together", () => {
    const base = layoutWith(room("a", 0, 0, 400, 300), room("b", 400, 0, 300, 300));
    const interiorId = deriveWalls(base).find((w) => !w.exterior)!.id;
    const withOverride = { ...base, wallThickness: setThickness(base, [interiorId], 0.1) };
    const moved: Layout = {
      ...withOverride,
      rooms: withOverride.rooms.map((r) => ({ ...r, points: r.points.map(([x, y]) => [x + 100, y + 50] as [number, number]) })),
    };
    const w = deriveWalls(moved).find((x) => !x.exterior)!;
    expect(w.id).toBe(interiorId);
    expect(w.thickness).toBe(0.1);
    expect(w.overridden).toBe(true);
  });

  it("pruneOverrides drops ids for walls that disappeared", () => {
    const base = layoutWith(room("a", 0, 0, 400, 300), room("b", 400, 0, 300, 300));
    const ids = deriveWalls(base).map((w) => w.id);
    const l2 = { ...base, wallThickness: setThickness(base, ids, 0.3), rooms: [base.rooms[0]] };
    const pruned = pruneOverrides(l2, deriveWalls(l2));
    // a's edges 0,2,3 keep their exterior ids; edge 1 was interior (w:a|b|1) and is now a new exterior wall.
    expect(Object.keys(pruned).sort()).toEqual(["w:a|0|0", "w:a|2|0", "w:a|3|0"]);
  });

  it("virtual walls keep the room boundary but flag the wall; pruned when the wall disappears", () => {
    const base = layoutWith(room("a", 0, 0, 400, 300), room("b", 400, 0, 300, 300));
    const interiorId = deriveWalls(base).find((w) => !w.exterior)!.id;
    const l2 = { ...base, wallVirtual: setVirtual(base, [interiorId], true) };
    const w = deriveWalls(l2).find((x) => !x.exterior)!;
    expect(w.virtual).toBe(true);
    expect(deriveWalls(l2).filter((x) => x.virtual)).toHaveLength(1);
    // still two rooms, still one shared boundary
    expect(l2.rooms).toHaveLength(2);
    const l3 = { ...l2, rooms: [l2.rooms[0]] };
    expect(Object.keys(pruneVirtual(l3, deriveWalls(l3)))).toHaveLength(0);
    // turning it back off removes the flag
    expect(Object.keys(setVirtual(l2, [interiorId], false))).toHaveLength(0);
  });

  it("select-all style: applying to every wall id overrides everything", () => {
    const base = layoutWith(room("a", 0, 0, 400, 300), room("b", 400, 0, 300, 300));
    const walls = deriveWalls(base);
    const l2 = { ...base, wallThickness: setThickness(base, walls.map((w) => w.id), 0.15) };
    expect(deriveWalls(l2).every((w) => w.thickness === 0.15 && w.overridden)).toBe(true);
  });
});
