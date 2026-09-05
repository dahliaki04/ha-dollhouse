import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { t } from "../i18n";
import type { Item, Layout, Point, Room, Wall } from "../domain/types";
import { bbox, dist, rectToPolygon, snapToGrid } from "../domain/geometry";
import { nearestWall, wallThicknessUnits } from "../domain/walls";
import { lightColor, Marker } from "./markers";
import { FurnitureGlyph } from "./FurnitureGlyph";
import type { Furniture } from "../domain/furniture";
import { moveRoom, updateFurniture, updateItem, updateRoom, type Selection, type Tool } from "./useEditor";
import type { HassLike } from "../ha/types";
import { entitiesInArea, hugsWall } from "../domain/entities";
import { backgroundFit, detectRoom, loadGray, type Gray } from "../domain/autoroom";

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
  /** Tap-to-place: next tap on the canvas moves the selected item/furniture there. */
  placing?: boolean;
  onPlaced?: () => void;
  /** Touch-friendly multi-select for walls (acts like holding Shift). */
  wallMulti?: boolean;
}

interface ViewBox { x: number; y: number; w: number; h: number }

type Drag =
  | { kind: "item"; id: string; start: Point; orig: Point; moved: boolean }
  | { kind: "furn"; id: string; start: Point; orig: Point; moved: boolean }
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
  const [rectStart, setRectStart] = useState<Point | null>(null); // tap-tap rectangle
  const [notice, setNotice] = useState<string | null>(null);
  const gray = useRef<{ url: string; gray: Gray; k: number } | null>(null);
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
    if (tool !== "rect") setRectStart(null);
  }, [tool]);

  // Raster the background once per image for the click-to-detect tool.
  const bgUrl = layout.background?.url;
  useEffect(() => {
    if (!bgUrl || gray.current?.url === bgUrl) return;
    let alive = true;
    loadGray(bgUrl).then((r) => { if (alive) gray.current = { url: bgUrl, ...r }; }).catch(() => setNotice(t("底圖讀取失敗")));
    return () => { alive = false; };
  }, [bgUrl]);

  const flash = (msg: string) => { setNotice(msg); setTimeout(() => setNotice(null), 2500); };

  // Android WebView (HA companion app) can still scroll the page on touch despite touch-action:none;
  // React touch handlers are passive, so block scrolling with a native non-passive listener.
  const wrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const block = (e: TouchEvent) => { if (e.cancelable) e.preventDefault(); };
    el.addEventListener("touchstart", block, { passive: false });
    el.addEventListener("touchmove", block, { passive: false });
    return () => { el.removeEventListener("touchstart", block); el.removeEventListener("touchmove", block); };
  }, []);

  /** Click inside a room on the background → polygon in canvas units. */
  const magicAt = (pt: Point) => {
    const L = layoutRef.current;
    const g = gray.current;
    if (!L.background || !g || g.url !== L.background.url) { flash(t("底圖還在讀取，再點一次")); return; }
    const fit = backgroundFit(L.canvas, L.background);
    const ix = ((pt[0] - fit.offX) / fit.s) * g.k;
    const iy = ((pt[1] - fit.offY) / fit.s) * g.k;
    const r = detectRoom(g.gray, ix, iy);
    if (!r) { flash(t("這裡沒有封閉的區域，改用矩形或多邊形")); return; }
    const toCanvasPt = (p: Point): Point => [(p[0] / g.k) * fit.s + fit.offX, (p[1] / g.k) * fit.s + fit.offY];
    // Snap to existing rooms' vertices (not the grid) so shared walls line up exactly.
    const pts = r.points.map(toCanvasPt).map((q) => snap(q, undefined, false, 0.3));
    p.onRoomDrawn(pts);
  };

  // Dev harness hook: window.dispatchEvent(new CustomEvent("dollhouse:autoroom", { detail: { x, y } }))
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const h = (e: Event) => { const d = (e as CustomEvent).detail; magicAt([d.x, d.y]); };
    window.addEventListener("dollhouse:autoroom", h);
    return () => window.removeEventListener("dollhouse:autoroom", h);
  });

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
    (pt: Point, excludeRoom?: string, useGrid = true, tolM = 0.15): Point => {
      let [x, y] = pt;
      const tol = tolM * m;
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
      if (useGrid && bx >= tol) x = snapToGrid(x, gridUnits);
      if (useGrid && by >= tol) y = snapToGrid(y, gridUnits);
      return [x, y];
    },
    [layout.rooms, gridUnits, m],
  );

  /* ---------- pointer handling ---------- */

  // Runs before children: tracks fingers so a second finger turns any gesture into a pinch.
  const onPointerDownCapture = (e: React.PointerEvent) => {
    if (p.placing && e.button === 0) {
      // route the tap to onPointerDown regardless of what was tapped (marker, wall, furniture)
      pointers.current.clear();
      onPointerDown(e);
      e.stopPropagation();
      return;
    }
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
    if (p.placing && e.button === 0) {
      e.stopPropagation();
      const pt = snapToGridPt(toCanvas(e), gridUnits / 5);
      const L = layoutRef.current;
      if (selection?.kind === "item") p.onCommit(updateItem(L, selection.id, { x: pt[0], y: pt[1] }));
      else if (selection?.kind === "furniture") p.onCommit(updateFurniture(L, selection.id, { x: pt[0], y: pt[1] }));
      p.onPlaced?.();
      return;
    }
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
    if (tool === "magic") {
      magicAt(pt);
    } else if (tool === "rect") {
      const s = snap(pt);
      if (rectStart) {
        // second tap completes the rectangle
        const w = Math.abs(s[0] - rectStart[0]);
        const h = Math.abs(s[1] - rectStart[1]);
        if (w > 0.4 * m && h > 0.4 * m) p.onRoomDrawn(rectToPolygon(Math.min(s[0], rectStart[0]), Math.min(s[1], rectStart[1]), w, h));
        setRectStart(null);
        return;
      }
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
    } else if (drag.kind === "furn") {
      const dx = pt[0] - drag.start[0];
      const dy = pt[1] - drag.start[1];
      if (!drag.moved && Math.hypot(dx, dy) < 0.05 * m) return;
      const target = e.shiftKey ? [drag.orig[0] + dx, drag.orig[1] + dy] : snapToGridPt([drag.orig[0] + dx, drag.orig[1] + dy], gridUnits / 5);
      setDrag({ ...drag, moved: true });
      p.onPreview(updateFurniture(layoutRef.current, drag.id, { x: target[0], y: target[1] }));
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
      else if (w < 0.15 * m && h < 0.15 * m) setRectStart(drag.start); // a tap: wait for the opposite corner
    } else if (drag.kind === "item") {
      const item = layoutRef.current.items.find((i) => i.id === drag.id);
      if (drag.moved) p.onCommit(layoutRef.current);
      else if (item) {
        if (e.detail >= 2) p.onDoubleTap(item);
        else p.onTap(item);
      }
    } else if (drag.kind === "furn") {
      if (drag.moved) p.onCommit(layoutRef.current);
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

  const startFurnDrag = (e: React.PointerEvent, f: Furniture) => {
    if (tool !== "select" || e.button !== 0) return;
    e.stopPropagation();
    svgRef.current!.setPointerCapture(e.pointerId);
    p.onSelect({ kind: "furniture", id: f.id });
    setDrag({ kind: "furn", id: f.id, start: toCanvas(e), orig: [f.x, f.y], moved: false });
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
    if (e.shiftKey || e.ctrlKey || e.metaKey || p.wallMulti) {
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
    <div className="dh-canvas-wrap" ref={wrapRef} style={{ minHeight: 320 }}>
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
              {areaName && <text className="dh-room-label" x={c[0]} y={c[1] + 0.28 * m} fontSize={0.18 * m} textAnchor="start" fill="#6b7280">{areaName !== r.name ? areaName : t("{n} 個裝置", { n: entitiesInArea(hass, r.areaId!).length })}</text>}
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
              {sel && <line x1={w.a[0]} y1={w.a[1]} x2={w.b[0]} y2={w.b[1]} stroke="#fff" strokeWidth={Math.max(0.02 * m, t * 0.35)} strokeDasharray={`${0.12 * m} ${0.08 * m}`} pointerEvents="none" />}
              {/* fat invisible hit area */}
              <line x1={w.a[0]} y1={w.a[1]} x2={w.b[0]} y2={w.b[1]} stroke="transparent" strokeWidth={Math.max(t, 0.25 * m)} />
            </g>
          );
        })}

        {/* furniture (decorative) */}
        {(layout.furniture ?? []).map((f) => (
          <FurnitureGlyph key={f.id} f={f} m={m} selected={selection?.kind === "furniture" && selection.id === f.id} onPointerDown={startFurnDrag} />
        ))}

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
        {tool === "rect" && rectStart && hover && !drag && (() => { const s = snap(hover); return (
          <>
            <rect x={Math.min(rectStart[0], s[0])} y={Math.min(rectStart[1], s[1])} width={Math.abs(s[0] - rectStart[0])} height={Math.abs(s[1] - rectStart[1])} fill="#2563eb" fillOpacity={0.12} stroke="#2563eb" strokeWidth={0.03 * m} strokeDasharray={`${0.1 * m} ${0.06 * m}`} />
            <circle cx={rectStart[0]} cy={rectStart[1]} r={0.12 * m} fill="#2563eb" />
            <DimLabel a={rectStart} b={s} m={m} />
          </>
        ); })()}
        {tool === "rect" && rectStart && (!hover || drag) && <circle cx={rectStart[0]} cy={rectStart[1]} r={0.12 * m} fill="#2563eb" />}
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
        <div className="dh-empty"><div><b>{t("從畫房間開始")}</b><br />{t("上方選「矩形房間」，點一個角再點對角就是一間。")}<br />{t("有平面圖的話先上傳底圖，再用「點選房間」點房間內部自動框出。")}</div></div>
      )}
      <div className="dh-hint">{notice ?? (p.placing ? t("點畫布上的位置，把選取的物件移過去") : hint(tool, poly.length, scalePts.length, !!rectStart))}</div>
    </div>
  );
}

function DimLabel({ a, b, m }: { a: Point; b: Point; m: number }) {
  const w = Math.abs(b[0] - a[0]) / m;
  const h = Math.abs(b[1] - a[1]) / m;
  return <text x={Math.max(a[0], b[0]) + 0.1 * m} y={Math.min(a[1], b[1]) - 0.1 * m} fontSize={0.25 * m} fill="#2563eb">{w.toFixed(2)} × {h.toFixed(2)} m</text>;
}

function hint(tool: Tool, polyN: number, scaleN: number, rectPending = false): string {
  if (tool === "magic") return t("點底圖上房間的內部，自動框出封閉區域");
  if (tool === "rect") return rectPending ? t("再點對角的角落完成") : t("點一個角、再點對角；或直接拖出矩形");
  if (tool === "polygon") return polyN === 0 ? t("逐點點出房間輪廓，點回起點或按 Enter 完成，Esc 取消") : t("已 {n} 點，點回起點或 Enter 完成", { n: polyN });
  if (tool === "scale") return scaleN === 0 ? t("點兩個已知距離的點（例如一面牆的兩端）") : t("點第二個點");
  return t("拖曳裝置或房間；點牆可選取；滾輪或雙指縮放");
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

