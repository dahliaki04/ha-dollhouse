import { describe, expect, it } from "vitest";
import { detectRoom, type Gray } from "./autoroom";

/** White canvas with dark rectangle outlines (like a scanned plan). */
function plan(w: number, h: number, draw: (set: (x: number, y: number) => void) => void): Gray {
  const data = new Uint8Array(w * h).fill(255);
  draw((x, y) => { if (x >= 0 && y >= 0 && x < w && y < h) data[y * w + x] = 20; });
  return { w, h, data };
}
const rectOutline = (set: (x: number, y: number) => void, x0: number, y0: number, x1: number, y1: number, t: number) => {
  for (let x = x0; x <= x1; x++) for (let k = 0; k < t; k++) { set(x, y0 + k); set(x, y1 - k); }
  for (let y = y0; y <= y1; y++) for (let k = 0; k < t; k++) { set(x0 + k, y); set(x1 - k, y); }
};

describe("detectRoom", () => {
  it("finds a rectangular room and grows it to the wall centreline", () => {
    // outer 200×150 outline, 6px lines; interior wall at x=100..105 splitting two rooms
    const g = plan(220, 170, (set) => {
      rectOutline(set, 10, 10, 209, 159, 6);
      for (let y = 10; y <= 159; y++) for (let x = 100; x < 106; x++) set(x, y);
    });
    const left = detectRoom(g, 50, 80)!;
    const right = detectRoom(g, 150, 80)!;
    expect(left.kind).toBe("rect");
    expect(right.kind).toBe("rect");
    // shared wall: left room's right edge and right room's left edge meet at the line centre (103)
    const leftRight = left.points[1][0];
    const rightLeft = right.points[0][0];
    expect(Math.abs(leftRight - rightLeft)).toBeLessThanOrEqual(0.5);
    expect(leftRight).toBeCloseTo(103, 0);
  });

  it("rejects clicks outside any enclosed area (leak to border)", () => {
    const g = plan(200, 200, (set) => rectOutline(set, 50, 50, 150, 150, 4));
    expect(detectRoom(g, 10, 10)).toBeNull();
  });

  it("returns an L-shaped polygon for an L-shaped room", () => {
    const g = plan(220, 220, (set) => {
      // L: big square minus its top-right quadrant, drawn as outline lines
      const t = 5;
      const line = (x0: number, y0: number, x1: number, y1: number) => {
        for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) for (let k = 0; k < t; k++) { set(x + (x0 === x1 ? k : 0), y + (y0 === y1 ? k : 0)); }
      };
      line(20, 20, 120, 20); line(120, 20, 120, 110); line(120, 110, 200, 110); line(200, 110, 200, 200); line(20, 200, 200, 200); line(20, 20, 20, 200);
    });
    const r = detectRoom(g, 60, 150)!;
    expect(r).not.toBeNull();
    expect(r.kind).toBe("polygon");
    expect(r.points.length).toBe(6);
    // every edge axis-aligned
    for (let i = 0; i < r.points.length; i++) {
      const a = r.points[i];
      const b = r.points[(i + 1) % r.points.length];
      expect(Math.min(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]))).toBeLessThan(1e-6);
    }
  });

  it("tolerates a click that lands on a line", () => {
    const g = plan(120, 120, (set) => rectOutline(set, 10, 10, 110, 110, 4));
    expect(detectRoom(g, 12, 60)).not.toBeNull();
  });
});
