import type { CoverStyle, Item } from "./types";
import type { HassLike } from "../ha/types";

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
