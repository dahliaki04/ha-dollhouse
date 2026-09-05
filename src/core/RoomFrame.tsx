import type { Item, Layout, Point, Room } from "../domain/types";
import { frameItems, frameValue, resolveKind } from "../domain/entities";
import { friendlyName, type HassLike } from "../ha/types";
import { DomainGlyph } from "./glyphs";
import { domainOf } from "../ha/types";
import { bbox } from "../domain/geometry";

export const FRAME_W = 2.4; // metres
export const FRAME_ROW = 0.34;
export const FRAME_PAD = 0.12;

/** Top-left of a room's status frame in canvas units: explicit position, else inside the room's top-right corner. */
export function framePosition(room: Room, m: number): Point {
  if (room.frame) return [room.frame[0], room.frame[1]];
  const b = bbox(room.points);
  return [b.x + b.w - FRAME_W * m - 0.25 * m, b.y + 0.25 * m];
}

export function frameHeight(count: number): number {
  return FRAME_PAD * 2 + Math.max(1, count) * FRAME_ROW;
}

export interface RoomFrameProps {
  room: Room;
  layout: Layout;
  hass: HassLike;
  m: number;
  readOnly?: boolean;
  selected?: boolean;
  onPointerDown?: (e: React.PointerEvent, room: Room) => void;
  onRowTap?: (item: Item) => void;
}

/** One panel per room listing the room's value-type devices: icon, value, name. */
export function RoomFrame({ room, layout, hass, m, readOnly, selected, onPointerDown, onRowTap }: RoomFrameProps) {
  if (room.frameHidden) return null;
  const items = frameItems(layout, room, hass);
  if (items.length === 0) return null;
  const [x, y] = framePosition(room, m);
  const W = FRAME_W * m;
  const H = frameHeight(items.length) * m;
  const fs = 0.19 * m;
  return (
    <g className="dh-frame" transform={`translate(${x} ${y})`} onPointerDown={(e) => onPointerDown?.(e, room)} style={{ cursor: readOnly ? "default" : "move" }}>
      <rect width={W} height={H} rx={0.14 * m} fill="#ffffff" fillOpacity={0.92} stroke={selected ? "#2563eb" : "#cbd5e1"} strokeWidth={(selected ? 0.03 : 0.02) * m} />
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
  );
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
