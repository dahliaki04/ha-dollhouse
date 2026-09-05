import type { Point } from "./types";

/** Grayscale raster (0 = black, 255 = white), row-major. */
export interface Gray {
  w: number;
  h: number;
  data: Uint8Array;
}

export interface DetectOptions {
  /** Pixels lighter than this count as floor (open); darker = wall lines. */
  threshold?: number;
  /** Give up if the fill covers more than this fraction of the image (leaked). */
  maxFraction?: number;
  /** Treat as rectangle when fill / bbox area exceeds this. */
  rectFill?: number;
  /** Cap on polygon vertices before falling back to the bounding box. */
  maxVertices?: number;
}

export interface DetectResult {
  points: Point[];
  kind: "rect" | "polygon";
  /** Fill pixel count. */
  area: number;
}

/**
 * Click inside a room on a scanned floor plan → enclosed region → polygon.
 * Flood-fills light pixels from (x, y), rejects leaks (touching the border or
 * covering too much), then returns either a rectangle grown to the wall
 * centreline or a simplified, axis-snapped contour.
 */
export function detectRoom(g: Gray, x: number, y: number, opts: DetectOptions = {}): DetectResult | null {
  const thr = opts.threshold ?? 180;
  const { w, h, data } = g;
  const open = (px: number, py: number) => px >= 0 && py >= 0 && px < w && py < h && data[py * w + px] > thr;
  const sx = Math.round(x);
  const sy = Math.round(y);
  if (sx < 0 || sy < 0 || sx >= w || sy >= h) return null;
  // Candidate start pixels: the click itself, else open pixels nearby ordered by distance.
  // A click on a wall line has open pixels on both sides; the first one may leak outside, so try several.
  const candidates: [number, number][] = [];
  if (open(sx, sy)) candidates.push([sx, sy]);
  else {
    for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) if (open(sx + dx, sy + dy)) candidates.push([sx + dx, sy + dy]);
    candidates.sort((a, b) => (a[0] - sx) ** 2 + (a[1] - sy) ** 2 - ((b[0] - sx) ** 2 + (b[1] - sy) ** 2));
  }
  const tried = new Set<number>();
  for (const [cx, cy] of candidates.slice(0, 12)) {
    const key = cy * w + cx;
    if (tried.has(key)) continue;
    const r = fillFrom(g, cx, cy, opts);
    if (r) return r;
    // remember the leaked region so we do not refill it
    if (r === null && lastMask) for (let i = 0; i < lastMask.length; i++) if (lastMask[i]) tried.add(i);
  }
  return null;
}

let lastMask: Uint8Array | null = null;

function fillFrom(g: Gray, sx: number, sy: number, opts: DetectOptions): DetectResult | null {
  const thr = opts.threshold ?? 180;
  const maxFrac = opts.maxFraction ?? 0.85;
  const rectFill = opts.rectFill ?? 0.9;
  const maxV = opts.maxVertices ?? 24;
  const { w, h, data } = g;

  // Scanline flood fill.
  const mask = new Uint8Array(w * h);
  lastMask = mask;
  const stack: number[] = [sy * w + sx];
  let count = 0;
  let minX = w, minY = h, maxX = -1, maxY = -1;
  let touchesBorder = false;
  const limit = Math.floor(w * h * maxFrac);
  while (stack.length) {
    const idx = stack.pop()!;
    const py = Math.floor(idx / w);
    let px = idx - py * w;
    if (mask[idx] || data[idx] <= thr) continue;
    // walk left
    while (px > 0 && !mask[idx - (idx - py * w - (px - 1))] && data[py * w + px - 1] > thr) px--;
    let spanUp = false;
    let spanDown = false;
    for (let cx = px; cx < w && data[py * w + cx] > thr && !mask[py * w + cx]; cx++) {
      const i = py * w + cx;
      mask[i] = 1;
      count++;
      if (count > limit) return null;
      if (cx < minX) minX = cx;
      if (cx > maxX) maxX = cx;
      if (py < minY) minY = py;
      if (py > maxY) maxY = py;
      if (cx === 0 || cx === w - 1 || py === 0 || py === h - 1) touchesBorder = true;
      if (py > 0) {
        const up = data[i - w] > thr && !mask[i - w];
        if (up && !spanUp) { stack.push(i - w); spanUp = true; } else if (!up) spanUp = false;
      }
      if (py < h - 1) {
        const down = data[i + w] > thr && !mask[i + w];
        if (down && !spanDown) { stack.push(i + w); spanDown = true; } else if (!down) spanDown = false;
      }
    }
  }
  if (count < 25 || touchesBorder) return null;

  const bw = maxX - minX + 1;
  const bh = maxY - minY + 1;
  if (count / (bw * bh) >= rectFill) {
    // Rectangle: push each side out by half the dark line beyond it, so adjacent rooms meet on the wall centreline.
    const run = (x0: number, y0: number, dx: number, dy: number) => {
      let n = 0;
      let px = x0 + dx;
      let py = y0 + dy;
      while (n < 40 && px >= 0 && py >= 0 && px < w && py < h && data[py * w + px] <= thr) { n++; px += dx; py += dy; }
      return n;
    };
    const cx = Math.round((minX + maxX) / 2);
    const cy = Math.round((minY + maxY) / 2);
    const left = minX - run(minX, cy, -1, 0) / 2;
    const right = maxX + 1 + run(maxX, cy, 1, 0) / 2;
    const top = minY - run(cx, minY, 0, -1) / 2;
    const bottom = maxY + 1 + run(cx, maxY, 0, 1) / 2;
    return { kind: "rect", area: count, points: [[left, top], [right, top], [right, bottom], [left, bottom]] };
  }

  // Polygon: trace the outer contour, simplify, snap to axes.
  const contour = traceContour(mask, w, h, minX, minY, maxX, maxY);
  if (!contour) return bboxResult();
  const eps = Math.max(2, 0.012 * Math.max(bw, bh));
  let poly = orthogonalize(rdp(contour, eps), Math.max(2, 0.03 * Math.max(bw, bh)));
  poly = dropCollinear(poly);
  if (poly.length < 4 || poly.length > maxV) return bboxResult();
  return { kind: "polygon", area: count, points: poly };

  function bboxResult(): DetectResult {
    return { kind: "rect", area: count, points: [[minX, minY], [maxX + 1, minY], [maxX + 1, maxY + 1], [minX, maxY + 1]] };
  }
}

/** Moore-neighbour tracing of the filled region's outer boundary (pixel corners). */
function traceContour(mask: Uint8Array, w: number, h: number, minX: number, minY: number, _maxX: number, _maxY: number): Point[] | null {
  const at = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && mask[y * w + x] === 1;
  // start: leftmost pixel on the top row of the region
  let sx = -1;
  for (let x = minX; x < w; x++) if (at(x, minY)) { sx = x; break; }
  if (sx < 0) return null;
  const dirs: Point[] = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  const out: Point[] = [];
  let cx = sx;
  let cy = minY;
  let dir = 6; // came from above
  const maxSteps = w * h * 2;
  for (let step = 0; step < maxSteps; step++) {
    out.push([cx, cy]);
    let found = false;
    // start searching from the direction to the right of where we came from
    for (let k = 0; k < 8; k++) {
      const d = (dir + 6 + k) % 8;
      const nx = cx + dirs[d][0];
      const ny = cy + dirs[d][1];
      if (at(nx, ny)) { cx = nx; cy = ny; dir = d; found = true; break; }
    }
    if (!found) break; // single pixel
    if (cx === sx && cy === minY && out.length > 2) break;
  }
  return out.length >= 4 ? out : null;
}

/** Ramer–Douglas–Peucker on a closed ring. */
function rdp(pts: Point[], eps: number): Point[] {
  if (pts.length < 4) return pts;
  // split at the two farthest-apart points so the closed ring becomes two open chains
  let a = 0;
  let b = 0;
  let best = -1;
  for (let i = 0; i < pts.length; i += Math.max(1, Math.floor(pts.length / 200))) {
    for (let j = i + 1; j < pts.length; j += Math.max(1, Math.floor(pts.length / 200))) {
      const d = (pts[i][0] - pts[j][0]) ** 2 + (pts[i][1] - pts[j][1]) ** 2;
      if (d > best) { best = d; a = i; b = j; }
    }
  }
  const chain1 = pts.slice(a, b + 1);
  const chain2 = [...pts.slice(b), ...pts.slice(0, a + 1)];
  const r1 = rdpOpen(chain1, eps);
  const r2 = rdpOpen(chain2, eps);
  return [...r1.slice(0, -1), ...r2.slice(0, -1)];
}

function rdpOpen(pts: Point[], eps: number): Point[] {
  if (pts.length < 3) return pts;
  const [x1, y1] = pts[0];
  const [x2, y2] = pts[pts.length - 1];
  const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  let maxD = -1;
  let idx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = Math.abs((pts[i][0] - x1) * (y2 - y1) - (pts[i][1] - y1) * (x2 - x1)) / len;
    if (d > maxD) { maxD = d; idx = i; }
  }
  if (maxD > eps) {
    const l = rdpOpen(pts.slice(0, idx + 1), eps);
    const r = rdpOpen(pts.slice(idx), eps);
    return [...l.slice(0, -1), ...r];
  }
  return [pts[0], pts[pts.length - 1]];
}

/** Snap nearly-horizontal / nearly-vertical edges to exact axes by nudging vertices. */
function orthogonalize(pts: Point[], tol: number): Point[] {
  const out = pts.map((p) => [p[0], p[1]] as Point);
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < out.length; i++) {
      const p = out[i];
      const q = out[(i + 1) % out.length];
      const dx = Math.abs(q[0] - p[0]);
      const dy = Math.abs(q[1] - p[1]);
      if (dx < tol && dx < dy) { const x = (p[0] + q[0]) / 2; p[0] = x; q[0] = x; }
      else if (dy < tol && dy < dx) { const y = (p[1] + q[1]) / 2; p[1] = y; q[1] = y; }
    }
  }
  return out;
}

function dropCollinear(pts: Point[]): Point[] {
  const out: Point[] = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const a = pts[(i + n - 1) % n];
    const b = pts[i];
    const c = pts[(i + 1) % n];
    const cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    const tiny = Math.hypot(b[0] - a[0], b[1] - a[1]) < 1e-6;
    if (Math.abs(cross) > 1e-6 && !tiny) out.push(b);
  }
  return out;
}

/** Luminance raster from RGBA ImageData bytes. */
export function toGray(rgba: Uint8ClampedArray, w: number, h: number): Gray {
  const data = new Uint8Array(w * h);
  for (let i = 0, j = 0; i < data.length; i++, j += 4) data[i] = (rgba[j] * 299 + rgba[j + 1] * 587 + rgba[j + 2] * 114) / 1000;
  return { w, h, data };
}

/** How the background image sits on the canvas (drawn with preserveAspectRatio "meet"). */
export function backgroundFit(canvas: { width: number; height: number }, bg: { width: number; height: number }) {
  const s = Math.min(canvas.width / bg.width, canvas.height / bg.height);
  return { s, offX: (canvas.width - bg.width * s) / 2, offY: (canvas.height - bg.height * s) / 2 };
}

/** Rasterise a background image to a downscaled grayscale for flood filling. Browser only. */
export async function loadGray(url: string, maxW = 1000): Promise<{ gray: Gray; k: number }> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error("bg load failed"));
    im.src = url;
  });
  const k = Math.min(1, maxW / img.naturalWidth);
  const w = Math.max(1, Math.round(img.naturalWidth * k));
  const h = Math.max(1, Math.round(img.naturalHeight * k));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  return { gray: toGray(ctx.getImageData(0, 0, w, h).data, w, h), k };
}
