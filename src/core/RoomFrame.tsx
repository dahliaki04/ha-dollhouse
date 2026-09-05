import type { Item, Layout, Point, Room } from "../domain/types";
import { frameItems, frameValue, resolveKind } from "../domain/entities";
import { friendlyName, type HassLike } from "../ha/types";
import { DomainGlyph } from "./glyphs";
import { domainOf } from "../ha/types";
import { bbox, centroid } from "../domain/geometry";

export const FRAME_W = 2.4; // metres
export const FRAME_ROW = 0.34;
export const FRAME_PAD = 0.12;
const GAP_OUT = 0.9; // metres between the plan and the callout column
const GAP_STACK = 0.25;

export function frameHeight(count: number): number {
  return FRAME_PAD * 2 + Math.max(1, count) * FRAME_ROW;
}

export interface FramePlacement {
  room: Room;
  items: Item[];
  /** top-left, canvas units */
  pos: Point;
  /** point inside the room the leader points at */
  anchor: Point;
  side: "left" | "right";
}

/**
 * Callout layout: frames sit outside the plan in a column on the side nearest
 * each room, stacked without overlap, with a leader back to the room.
 * A room with an explicit `frame` position keeps it.
 */
export function frameLayout(layout: Layout, hass: HassLike, m: number): FramePlacement[] {
  const rooms = layout.rooms.filter((r) => !r.frameHidden);
  if (rooms.length === 0) return [];
  const all = bbox(layout.rooms.flatMap((r) => r.points));
  const cx = all.x + all.w / 2;
  const W = FRAME_W * m;
  const entries = rooms
    .map((room) => ({ room, items: frameItems(layout, room, hass), c: centroid(room.points) }))
    .filter((e) => e.items.length > 0);
  const out: FramePlacement[] = [];
  for (const side of ["left", "right"] as const) {
    const col = entries.filter((e) => (e.room.frame ? false : side === "left" ? e.c[0] < cx : e.c[0] >= cx)).sort((a, b) => a.c[1] - b.c[1]);
    let cursor = all.y;
    for (const e of col) {
      const H = frameHeight(e.items.length) * m;
      const wantY = e.c[1] - H / 2;
      const y = Math.max(wantY, cursor);
      const x = side === "left" ? all.x - GAP_OUT * m - W : all.x + all.w + GAP_OUT * m;
      out.push({ room: e.room, items: e.items, pos: [x, y], anchor: e.c, side });
      cursor = y + H + GAP_STACK * m;
    }
  }
  // explicit positions
  for (const e of entries) {
    if (!e.room.frame) continue;
    const side: "left" | "right" = e.room.frame[0] + W / 2 < e.c[0] ? "left" : "right";
    out.push({ room: e.room, items: e.items, pos: [e.room.frame[0], e.room.frame[1]], anchor: e.c, side });
  }
  return out;
}

/** Extra horizontal room (canvas units) the callouts need on each side when fitting the view. */
export function frameMargins(placements: FramePlacement[], m: number): { left: number; right: number } {
  const left = placements.some((p) => p.side === "left") ? (FRAME_W + GAP_OUT + 0.3) * m : 0;
  const right = placements.some((p) => p.side === "right") ? (FRAME_W + GAP_OUT + 0.3) * m : 0;
  return { left, right };
}

export interface RoomFrameProps {
  placement: FramePlacement;
  hass: HassLike;
  m: number;
  readOnly?: boolean;
  selected?: boolean;
  onPointerDown?: (e: React.PointerEvent, room: Room, pos: Point) => void;
  onRowTap?: (item: Item) => void;
}

/** Callout panel: rows of icon / value / name, plus a leader line to the room. */
export function RoomFrame({ placement, hass, m, readOnly, selected, onPointerDown, onRowTap }: RoomFrameProps) {
  const { room, items, pos, anchor, side } = placement;
  const [x, y] = pos;
  const W = FRAME_W * m;
  const H = frameHeight(items.length) * m;
  const fs = 0.19 * m;
  // leader leaves from the frame edge facing the room, at mid height
  const from: Point = side === "left" ? [x + W, y + H / 2] : [x, y + H / 2];
  const elbow: Point = side === "left" ? [from[0] + 0.35 * m, from[1]] : [from[0] - 0.35 * m, from[1]];
  return (
    <g className="dh-frame">
      <polyline points={`${from[0]},${from[1]} ${elbow[0]},${elbow[1]} ${anchor[0]},${anchor[1]}`} fill="none" stroke="#94a3b8" strokeWidth={0.025 * m} strokeDasharray={`${0.1 * m} ${0.07 * m}`} pointerEvents="none" />
      <circle cx={anchor[0]} cy={anchor[1]} r={0.07 * m} fill="#94a3b8" pointerEvents="none" />
      <g transform={`translate(${x} ${y})`} onPointerDown={(e) => onPointerDown?.(e, room, pos)} style={{ cursor: readOnly ? "default" : "move" }}>
        <rect width={W} height={H} rx={0.14 * m} fill="#ffffff" fillOpacity={0.96} stroke={selected ? "#2563eb" : "#cbd5e1"} strokeWidth={(selected ? 0.03 : 0.02) * m} />
        <text x={0.16 * m} y={-0.08 * m} fontSize={0.17 * m} fill="#6b7280">{room.name}</text>
        {items.map((it, i) => {
          const v = frameValue(it, hass);
          const yy = FRAME_PAD * m + i * FRAME_ROW * m;
          const kind = resolveKind(it, hass);
          const dom = domainOf(it.entityId);
          const color = v.active ? "#16a34a" : v.unknown ? "#9ca3af" : "#374151";
          return (
            <g key={it.id} transform={`translate(0 ${yy})`} onPointerDown={(e) => { if (readOnly && onRowTap) { e.stopPropagation(); onRowTap(it); } }} style={{ cursor: readOnly ? "pointer" : undefined }}>
              <g transform={`translate(${0.28 * m} ${FRAME_ROW * m / 2})`}>
                {kind === "presence" ? <circle r={0.09 * m} fill={v.active ? "#22c55e" : "#d1d5db"} /> : <DomainGlyph dom={dom} s={0.22 * m} color={color} />}
              </g>
              <text x={0.52 * m} y={FRAME_ROW * m / 2 + fs * 0.35} fontSize={fs} fill="#111827" fontWeight={600}>{v.text}</text>
              <text x={W - 0.14 * m} y={FRAME_ROW * m / 2 + fs * 0.3} fontSize={fs * 0.78} fill="#6b7280" textAnchor="end">{truncate(it.label ?? friendlyName(hass, it.entityId), 10)}</text>
            </g>
          );
        })}
      </g>
    </g>
  );
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
