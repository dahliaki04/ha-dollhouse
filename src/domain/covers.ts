import type { CoverDraw, CoverStyle, Item, Layout, Point } from "./types";
import type { HassLike } from "../ha/types";
import { pointInPolygon } from "./geometry";

// HA CoverEntityFeature bits
const SUPPORT_OPEN_TILT = 16;
const SUPPORT_SET_TILT_POSITION = 128;

/**
 * Pick how to draw a cover from its HA attributes.
 *  curtain: side-draw (橫拉) — two panels meet in the middle
 *  roller:  top-down (上下) — roller / honeycomb / shade / shutter
 *  blind:   slats with tilt angle (百葉)
 */
export function guessCoverStyle(hass: HassLike, entityId: string): CoverStyle {
  const s = hass.states[entityId];
  const cls = (s?.attributes.device_class as string | undefined) ?? "";
  const features = (s?.attributes.supported_features as number | undefined) ?? 0;
  const name = `${entityId} ${(s?.attributes.friendly_name as string | undefined) ?? ""}`.toLowerCase();
  if (features & (SUPPORT_OPEN_TILT | SUPPORT_SET_TILT_POSITION) || cls === "blind" || /blind|百葉|venetian/.test(name)) return "blind";
  if (cls === "shade" || cls === "shutter" || cls === "awning" || /roller|honeycomb|蜂巢|捲簾|卷簾|shade|shutter|羅馬簾|斑馬簾/.test(name)) return "roller";
  return "curtain";
}

export interface CoverView {
  style: CoverStyle;
  /** 0 = fully closed, 1 = fully open. */
  open: number;
  /** 0..1 slat tilt (blinds only), 0 = closed flat, 1 = fully tilted open. */
  tilt: number;
  moving: boolean;
  unknown: boolean;
}

export function coverView(hass: HassLike, item: Item): CoverView {
  const s = hass.states[item.entityId];
  const style = item.coverStyle ?? guessCoverStyle(hass, item.entityId);
  const pos = s?.attributes.current_position as number | undefined;
  const tiltPos = s?.attributes.current_tilt_position as number | undefined;
  const state = s?.state ?? "unknown";
  const open = pos !== undefined ? pos / 100 : state === "open" || state === "opening" ? 1 : state === "closed" || state === "closing" ? 0 : 0.5;
  return {
    style,
    open: Math.min(1, Math.max(0, open)),
    tilt: tiltPos !== undefined ? tiltPos / 100 : open,
    moving: state === "opening" || state === "closing",
    unknown: !s || state === "unknown" || state === "unavailable",
  };
}

/**
 * Unit vector (canvas space) pointing from the cover into the room it belongs to.
 * The cover sits on a wall centreline; we probe 0.4 m to each side and pick the
 * side that lands inside a room (default: the local +y side).
 */
export function coverInward(layout: Layout, item: Item): { n: Point; flip: boolean } {
  return wallInward(layout, item);
}

/** Same as coverInward but for any wall-hugging item (strips, wall lamps). */
export function wallInward(layout: Layout, item: Pick<Item, "x" | "y" | "rotation">): { n: Point; flip: boolean } {
  const th = ((item.rotation ?? 0) * Math.PI) / 180;
  const n: Point = [-Math.sin(th), Math.cos(th)];
  const probe = 0.4 / layout.metresPerUnit;
  const plus: Point = [item.x + n[0] * probe, item.y + n[1] * probe];
  const minus: Point = [item.x - n[0] * probe, item.y - n[1] * probe];
  const inPlus = layout.rooms.some((r) => pointInPolygon(plus, r.points));
  const inMinus = layout.rooms.some((r) => pointInPolygon(minus, r.points));
  if (!inPlus && inMinus) return { n: [-n[0], -n[1]], flip: true };
  return { n, flip: false };
}

/**
 * Fabric spans of a curtain in local x (from -L/2 to +L/2), given the open fraction.
 * `flip` comes from wallInward: when the room is on the local -y side, the viewer's
 * left is local +x, so left/right are mirrored to stay correct from inside the room.
 */
export function curtainPanels(L: number, open: number, draw: CoverDraw | null | undefined, flip: boolean): { x0: number; w: number }[] {
  const closedW = (1 - open) * L;
  if (closedW <= 1e-6) return [];
  const mode = draw ?? "center";
  if (mode === "center") return [{ x0: -L / 2, w: closedW / 2 }, { x0: L / 2 - closedW / 2, w: closedW / 2 }];
  const leftSign = flip ? 1 : -1; // which local-x side is "left" for someone inside the room
  const side = mode === "left" ? leftSign : -leftSign;
  return side < 0 ? [{ x0: -L / 2, w: closedW }] : [{ x0: L / 2 - closedW, w: closedW }];
}
