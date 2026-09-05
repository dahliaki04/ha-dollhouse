import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Item, Layout, Point, Room, Wall } from "../domain/types";
import { bbox, dist, rectToPolygon, snapToGrid } from "../domain/geometry";
import { nearestWall, wallThicknessUnits } from "../domain/walls";
import { lightColor, Marker } from "./markers";
import { moveRoom, updateItem, updateRoom, type Selection, type Tool } from "./useEditor";
import type { HassLike } from "../ha/types";
import { entitiesInArea, hugsWall } from "../domain/entities";

export interface Canvas2DProps {
  layout: Layout;
  hass: HassLike;
  walls: Wall[];
  selection: Selection;
  tool: Tool;
  onPreview: (l: Layout) => void;
  onCommit: (l: Layout) => void;
  onSelect: (s: Selection) => void;
  onRoomDrawn: (points: Point[]) => void;
  onScale: (units: number) => void;
  onTap: (item: Item) => void;
  onDoubleTap: (item: Item) => void;
}

interface ViewBox { x: number; y: number; w: number; h: number }

type Drag =
  | { kind: "item"; id: string; start: Point; orig: Point; moved: boolean }
  | { kind: "room"; id: string; last: Point; moved: boolean }
  | { kind: "vertex"; id: string; index: number }
  | { kind: "rect"; start: Point; cur: Point }
  | { kind: "pan"; start: Point; orig: ViewBox }
  | { kind: "pinch"; d0: number; vb0: ViewBox; c0: Point };

export function Canvas2D(p: Canvas2DProps) {
  const { layout, hass, walls, selection, tool } = p;
  const svgRef = useRef<SVGSVGElement>(null);
  const [vb, setVb] = useState<ViewBox>(() => fitView(layout, 1.5));
  const [drag, setDrag] = useState<Drag | null>(null);
  const [poly, setPoly] = useState<Point[]>([]);
  const [hover, setHover] = useState<Point | null>(null);
  const [scalePts, setScalePts] = useState<Point[]>([]);
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const pointers = useRef(new Map<number, { x: number; y: number }>());

  // Fit to the container's aspect ratio (so pointer→canvas mapping is exact) on mount,
  // on resize, and when the canvas size changes (new background).
  const sizeKey = `${layout.canvas.width}x${layout.canvas.height}`;
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const fit = () => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) setVb(fitView(layoutRef.current, r.width / r.height));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [sizeKey]);
  useEffect(() => {
    if (tool !== "polygon") setPoly([]);
    if (tool !== "scale") setScalePts([]);
  }, [tool]);

  const m = 1 / layout.metresPerUnit;
  const gridUnits = layout.grid > 0 ? layout.grid * m : 0;

  const toCanvas = useCallback(
    (e: { clientX: number; clientY: number }): Point => {
      const svg = svgRef.current!;
      const r = svg.getBoundingClientRect();
      const k = vb.w / r.width;
      return [vb.x + (e.clientX - r.left) * k, vb.y + (e.clientY - r.top) * k];
    },
    [vb],
  );

  const snap = useCallback(
    (pt: Point, excludeRoom?: string): Point => {
      let [x, y] = pt;
      const tol = 0.15 * m;
      // Snap to other rooms' vertices (axis-wise) so shared edges become exactly collinear.
      let bx = tol;
      let by = tol;
      for (const r of layout.rooms) {
        if (r.id === excludeRoom) continue;
        for (const [vx, vy] of r.points) {
          if (Math.abs(vx - x) < bx) { bx = Math.abs(vx - x); x = vx; }
          if (Math.abs(vy - y) < by) { by = Math.abs(vy - y); y = vy; }
        }
      }
      if (bx >= tol) x = snapToGrid(x, gridUnits);
      if (by >= tol) y = snapToGrid(y, gridUnits);
      return [x, y];
    },
    [layout.rooms, gridUnits, m],
  );

  /* ---------- pointer handling ---------- */

  // Runs before children: tracks fingers so a second finger turns any gesture into a pinch.
  const onPointerDownCapture = (e: React.PointerEvent) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const mid = { clientX: (a.x + b.x) / 2, clientY: (a.y + b.y) / 2 };
      setDrag({ kind: "pinch", d0: Math.hypot(a.x - b.x, a.y - b.y), vb0: vb, c0: toCanvas(mid) });
      svgRef.current!.setPointerCapture(e.pointerId);
      e.stopPropagation();
    }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (pointers.current.size >= 2) return;
    const onBackground = (e.target as Element) === svgRef.current || (e.target as Element).classList.contains("dh-bg");
    if (tool === "select" && e.pointerType === "touch" && onBackground) {
      p.onSelect(null);
      setDrag({ kind: "pan", start: [e.clientX, e.clientY], orig: vb });
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
      return;
    }
    if (e.button === 1 || (e.button === 0 && e.altKey) || (tool === "select" && e.button === 0 && (e.target as Element) === svgRef.current && e.shiftKey === false && spaceDown.current)) {
      setDrag({ kind: "pan", start: [e.clientX, e.clientY], orig: vb });
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
      return;
    }
    if (e.button !== 0) return;
    const pt = toCanvas(e);
    if (tool === "rect") {
      const s = snap(pt);
      setDrag({ kind: "rect", start: s, cur: s });
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    } else if (tool === "polygon") {
      const s = snap(pt);
      if (poly.length >= 3 && dist(s, poly[0]) < 0.3 * m) finishPolygon();
      else setPoly([...poly, s]);
    } else if (tool === "scale") {
      const next = [...scalePts, pt];
      if (next.length === 2) {
        p.onScale(dist(next[0], next[1]));
        setScalePts([]);
      } else setScalePts(next);
    } else if ((e.target as Element) === svgRef.current || (e.target as Element).classList.contains("dh-bg")) {
      p.onSelect(null);
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pt = toCanvas(e);
    setHover(pt);
    if (!drag) return;
    if (drag.kind === "pinch") {
      if (pointers.current.size < 2) return;
      const [a, b] = [...pointers.current.values()];
      const r = svgRef.current!.getBoundingClientRect();
      const k = drag.d0 / Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
      const w = drag.vb0.w * k;
      const h = drag.vb0.h * k;
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      setVb({ x: drag.c0[0] - (mx - r.left) * (w / r.width), y: drag.c0[1] - (my - r.top) * (h / r.height), w, h });
      return;
    }
    if (drag.kind === "pan") {
      const svg = svgRef.current!;
      const k = vb.w / svg.getBoundingClientRect().width;
      setVb({ ...drag.orig, x: drag.orig.x - (e.clientX - drag.start[0]) * k, y: drag.orig.y - (e.clientY - drag.start[1]) * k });
    } else if (drag.kind === "rect") {
      setDrag({ ...drag, cur: snap(pt) });
    } else if (drag.kind === "item") {
      const dx = pt[0] - drag.start[0];
      const dy = pt[1] - drag.start[1];
      if (!drag.moved && Math.hypot(dx, dy) < 0.05 * m) return;
      let target: Point = e.shiftKey ? [drag.orig[0] + dx, drag.orig[1] + dy] : snapToGridPt([drag.orig[0] + dx, drag.orig[1] + dy], gridUnits / 5);
      const item = layoutRef.current.items.find((i) => i.id === drag.id);
      let patch: Partial<Item> = {};
      if (item && hugsWall(item, hass) && !e.shiftKey) {
        // Covers, wall lamps and wall strips live on walls: snap to the nearest wall within 0.5 m and align to it.
        const raw: Point = [drag.orig[0] + dx, drag.orig[1] + dy];
        const hit = nearestWall(walls, raw);
        if (hit) {
          const { wall: w, d, t } = hit;
          if (d < 0.5 * m) {
            target = [w.a[0] + (w.b[0] - w.a[0]) * t, w.a[1] + (w.b[1] - w.a[1]) * t];
            patch = { rotation: Math.round((Math.atan2(w.b[1] - w.a[1], w.b[0] - w.a[0]) * 180) / Math.PI) };
          }
        }
      }
      setDrag({ ...drag, moved: true });
      p.onPreview(updateItem(layoutRef.current, drag.id, { x: target[0], y: target[1], ...patch }));
    } else if (drag.kind === "room") {
      const s = snapToGridPt(pt, gridUnits);
      const dx = s[0] - drag.last[0];
      const dy = s[1] - drag.last[1];
      if (dx === 0 && dy === 0) return;
      setDrag({ ...drag, last: s, moved: true });
      p.onPreview(moveRoom(layoutRef.current, drag.id, dx, dy));
    } else if (drag.kind === "vertex") {
      const room = layoutRef.current.rooms.find((r) => r.id === drag.id);
      if (!room) return;
      const s = snap(pt, room.id);
      const points = room.points.map((q, i) => (i === drag.index ? s : q));
      p.onPreview(updateRoom(layoutRef.current, room.id, { points }));
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (!drag) return;
    if (drag.kind === "pinch") {
      if (pointers.current.size === 0) setDrag(null);
      return;
    }
    if (drag.kind === "rect") {
      const [x0, y0] = drag.start;
      const [x1, y1] = drag.cur;
      const w = Math.abs(x1 - x0);
      const h = Math.abs(y1 - y0);
      if (w > 0.4 * m && h > 0.4 * m) p.onRoomDrawn(rectToPolygon(Math.min(x0, x1), Math.min(y0, y1), w, h));
    } else if (drag.kind === "item") {
      const item = layoutRef.current.items.find((i) => i.id === drag.id);
      if (drag.moved) p.onCommit(layoutRef.current);
      else if (item) {
        if (e.detail >= 2) p.onDoubleTap(item);
        else p.onTap(item);
      }
    } else if (drag.kind === "room" || drag.kind === "vertex") {
      if (drag.kind === "vertex" || drag.moved) p.onCommit(layoutRef.current);
    }
    setDrag(null);
  };

  const onWheel = (e: React.WheelEvent) => {
    const pt = toCanvas(e);
    const k = e.deltaY > 0 ? 1.1 : 1 / 1.1;
    setVb((v) => ({ x: pt[0] - (pt[0] - v.x) * k, y: pt[1] - (pt[1] - v.y) * k, w: v.w * k, h: v.h * k }));
  };

  const spaceDown = useRef(false);
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space") spaceDown.current = true;
      if (tool === "polygon") {
        if (e.key === "Enter") finishPolygon();
        if (e.key === "Escape") setPoly([]);
      }
    };
    const up = (e: KeyboardEvent) => { if (e.code === "Space") spaceDown.current = false; };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  });

  const finishPolygon = () => {
    if (poly.length >= 3) p.onRoomDrawn(poly);
    setPoly([]);
  };

  const startItemDrag = (e: React.PointerEvent, item: Item) => {
    if (tool !== "select" || e.button !== 0) return;
    e.stopPropagation();
    svgRef.current!.setPointerCapture(e.pointerId);
    p.onSelect({ kind: "item", id: item.id });
    setDrag({ kind: "item", id: item.id, start: toCanvas(e), orig: [item.x, item.y], moved: false });
  };

  const startRoomDrag = (e: React.PointerEvent, room: Room) => {
    if (tool !== "select" || e.button !== 0) return;
    e.stopPropagation();
    svgRef.current!.setPointerCapture(e.pointerId);
    p.onSelect({ kind: "room", id: room.id });
    setDrag({ kind: "room", id: room.id, last: snapToGridPt(toCanvas(e), gridUnits), moved: false });
  };

  const startVertexDrag = (e: React.PointerEvent, room: Room, index: number) => {
    if (tool !== "select" || e.button !== 0) return;
    e.stopPropagation();
    svgRef.current!.setPointerCapture(e.pointerId);
    setDrag({ kind: "vertex", id: room.id, index });
  };

  const clickWall = (e: React.PointerEvent, wall: Wall) => {
    if (tool !== "select" || e.button !== 0) return;
    e.stopPropagation();
    const cur = selection?.kind === "walls" ? selection.ids : [];
    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      p.onSelect({ kind: "walls", ids: cur.includes(wall.id) ? cur.filter((i) => i !== wall.id) : [...cur, wall.id] });
    } else p.onSelect({ kind: "walls", ids: [wall.id] });
  };

  /* ---------- derived render data ---------- */

  const roomLit = useMemo(() => {
    const out: Record<string, string | null> = {};
    for (const r of layout.rooms) {
      const lights = layout.items.filter((i) => i.entityId.startsWith("light.") && inside([i.x, i.y], r.points) && hass.states[i.entityId]?.state === "on");
      out[r.id] = lights.length ? lightColor(hass, lights[0].entityId, lights[0].color) : null;
    }
    return out;
  }, [layout.rooms, layout.items, hass.states, hass]);

  const selWalls = selection?.kind === "walls" ? new Set(selection.ids) : new Set<string>();
  const selRoom = selection?.kind === "room" ? layout.rooms.find((r) => r.id === selection.id) : undefined;
  const cursor = tool === "select" ? (drag?.kind === "pan" ? "grabbing" : "default") : "crosshair";

  return (
    <div className="dh-canvas-wrap">
      <svg
        ref={svgRef}
        viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
        preserveAspectRatio="none"
        style={{ cursor }}
        onPointerDownCapture={onPointerDownCapture}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={(e) => { pointers.current.delete(e.pointerId); setDrag(null); }}
        onWheel={onWheel}
        onContextMenu={(e) => e.preventDefault()}
      >
        <defs>
          <filter id="dh-glow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation={0.12 * m} />
          </filter>
          <pattern id="dh-grid" width={gridUnits || 1} height={gridUnits || 1} patternUnits="userSpaceOnUse">
            <path d={`M ${gridUnits} 0 L 0 0 0 ${gridUnits}`} fill="none" stroke="#d1d5db" strokeWidth={0.01 * m} />
          </pattern>
        </defs>

        {/* canvas sheet */}
        <rect className="dh-bg" x={0} y={0} width={layout.canvas.width} height={layout.canvas.height} fill="#fff" />
        {layout.background && (
          <image className="dh-bg" href={layout.background.url} x={0} y={0} width={layout.canvas.width} height={layout.canvas.height} preserveAspectRatio="xMidYMid meet" opacity={layout.background.opacity ?? 0.6} />
        )}
        {gridUnits > 0 && <rect className="dh-bg" x={0} y={0} width={layout.canvas.width} height={layout.canvas.height} fill="url(#dh-grid)" />}

        {/* rooms */}
        {layout.rooms.map((r) => {
          const bb = bbox(r.points);
          const c: Point = [bb.x + 0.25 * m, bb.y + 0.45 * m];
          const lit = roomLit[r.id];
          const sel = selection?.kind === "room" && selection.id === r.id;
          const areaName = r.areaId ? hass.areas[r.areaId]?.name : null;
          return (
            <g key={r.id}>
              <polygon
                points={r.points.map((q) => q.join(",")).join(" ")}
                fill={lit ?? r.color ?? "#f8fafc"}
                fillOpacity={lit ? 0.28 : 0.55}
                stroke={sel ? "#2563eb" : "none"}
                strokeWidth={0.03 * m}
                style={{ cursor: tool === "select" ? "move" : undefined }}
                onPointerDown={(e) => startRoomDrag(e, r)}
              />
              <text className="dh-room-label" x={c[0]} y={c[1]} fontSize={0.32 * m} textAnchor="start" fill="#1f2937">{r.name}</text>
              {areaName && <text className="dh-room-label" x={c[0]} y={c[1] + 0.28 * m} fontSize={0.18 * m} textAnchor="start" fill="#6b7280">{areaName !== r.name ? areaName : `${entitiesInArea(hass, r.areaId!).length} 個裝置`}</text>}
            </g>
          );
        })}

        {/* walls */}
        {walls.map((w) => {
          const t = w.virtual ? 0.03 * m : wallThicknessUnits(w, layout);
          const sel = selWalls.has(w.id);
          return (
            <g key={w.id} className="dh-wall" onPointerDown={(e) => clickWall(e, w)}>
              <line x1={w.a[0]} y1={w.a[1]} x2={w.b[0]} y2={w.b[1]} stroke={sel ? "#2563eb" : w.virtual ? "#94a3b8" : w.exterior ? "#374151" : "#6b7280"} strokeWidth={t} strokeLinecap={w.exterior && !w.virtual ? "square" : "butt"} strokeDasharray={w.virtual ? `${0.15 * m} ${0.1 * m}` : undefined} />
              {/* fat invisible hit area */}
              <line x1={w.a[0]} y1={w.a[1]} x2={w.b[0]} y2={w.b[1]} stroke="transparent" strokeWidth={Math.max(t, 0.25 * m)} />
            </g>
          );
        })}

        {/* vertex handles for selected room */}
        {selRoom && tool === "select" && selRoom.points.map((q, i) => (
          <circle key={i} cx={q[0]} cy={q[1]} r={0.12 * m} fill="#fff" stroke="#2563eb" strokeWidth={0.03 * m} style={{ cursor: "grab" }} onPointerDown={(e) => startVertexDrag(e, selRoom, i)} />
        ))}

        {/* items */}
        {layout.items.map((it) => (
          <Marker key={it.id} item={it} layout={layout} hass={hass} selected={selection?.kind === "item" && selection.id === it.id} onPointerDown={startItemDrag} />
        ))}

        {/* drafting overlays */}
        {drag?.kind === "rect" && (
          <rect x={Math.min(drag.start[0], drag.cur[0])} y={Math.min(drag.start[1], drag.cur[1])} width={Math.abs(drag.cur[0] - drag.start[0])} height={Math.abs(drag.cur[1] - drag.start[1])} fill="#2563eb" fillOpacity={0.12} stroke="#2563eb" strokeWidth={0.03 * m} strokeDasharray={`${0.1 * m} ${0.06 * m}`} />
        )}
        {drag?.kind === "rect" && <DimLabel a={drag.start} b={drag.cur} m={m} />}
        {tool === "polygon" && poly.length > 0 && (
          <>
            <polyline points={[...poly, hover ? snap(hover) : poly[poly.length - 1]].map((q) => q.join(",")).join(" ")} fill="none" stroke="#2563eb" strokeWidth={0.03 * m} strokeDasharray={`${0.1 * m} ${0.06 * m}`} />
            {poly.map((q, i) => <circle key={i} cx={q[0]} cy={q[1]} r={(i === 0 ? 0.15 : 0.08) * m} fill={i === 0 ? "#2563eb" : "#fff"} stroke="#2563eb" strokeWidth={0.02 * m} />)}
          </>
        )}
        {tool === "scale" && scalePts.length === 1 && hover && (
          <>
            <line x1={scalePts[0][0]} y1={scalePts[0][1]} x2={hover[0]} y2={hover[1]} stroke="#dc2626" strokeWidth={0.03 * m} />
            <circle cx={scalePts[0][0]} cy={scalePts[0][1]} r={0.1 * m} fill="#dc2626" />
          </>
        )}
      </svg>
      {layout.rooms.length === 0 && tool === "select" && (
        <div className="dh-empty"><div><b>從畫房間開始</b><br />上方選「矩形房間」，在畫布上拖一下就是一間。<br />有平面圖的話先在右邊上傳底圖再描。</div></div>
      )}
      <div className="dh-hint">{hint(tool, poly.length, scalePts.length)}</div>
    </div>
  );
}

function DimLabel({ a, b, m }: { a: Point; b: Point; m: number }) {
  const w = Math.abs(b[0] - a[0]) / m;
  const h = Math.abs(b[1] - a[1]) / m;
  return <text x={Math.max(a[0], b[0]) + 0.1 * m} y={Math.min(a[1], b[1]) - 0.1 * m} fontSize={0.25 * m} fill="#2563eb">{w.toFixed(2)} × {h.toFixed(2)} m</text>;
}

function hint(tool: Tool, polyN: number, scaleN: number): string {
  if (tool === "rect") return "拖出一個矩形 = 一間房。滾輪縮放，Alt+拖曳平移。";
  if (tool === "polygon") return polyN === 0 ? "逐點點出房間輪廓，點回起點或按 Enter 完成，Esc 取消" : `已 ${polyN} 點，點回起點或 Enter 完成`;
  if (tool === "scale") return scaleN === 0 ? "點兩個已知距離的點（例如一面牆的兩端）" : "點第二個點";
  return "拖曳裝置或房間；點牆可選取（Shift 多選）；滾輪縮放，Alt+拖曳平移";
}

/** ViewBox that shows the whole canvas and has exactly the container's aspect ratio. */
function fitView(layout: Layout, aspect: number): ViewBox {
  const pad = 0.04;
  const cw = layout.canvas.width * (1 + pad * 2);
  const ch = layout.canvas.height * (1 + pad * 2);
  const w = cw / ch > aspect ? cw : ch * aspect;
  const h = cw / ch > aspect ? cw / aspect : ch;
  return { x: layout.canvas.width / 2 - w / 2, y: layout.canvas.height / 2 - h / 2, w, h };
}

function snapToGridPt(pt: Point, step: number): Point {
  return [snapToGrid(pt[0], step), snapToGrid(pt[1], step)];
}

function inside(p: Point, pts: Point[]): boolean {
  let r = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) r = !r;
  }
  return r;
}

