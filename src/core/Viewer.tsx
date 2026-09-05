import { useMemo, useState } from "react";
import type { Item, Layout } from "../domain/types";
import { deriveWalls } from "../domain/walls";
import { pointInPolygon } from "../domain/geometry";
import { resolveKind } from "../domain/entities";
import { domainOf, type HassLike } from "../ha/types";
import { Canvas2D } from "./Canvas2D";
import { render3D } from "./lazy3d";
import { t } from "../i18n";

export interface ViewerProps {
  layout: Layout;
  hass: HassLike;
  view: "2d" | "3d";
  onViewChange?: (v: "2d" | "3d") => void;
  /** Show the floating 2D/3D toggle. */
  toggle?: boolean;
  /** Restrict to these room ids or names (card option). */
  rooms?: string[] | null;
  onMoreInfo?: (entityId: string) => void;
  /** Extra floating controls (e.g. an Edit button). */
  extra?: React.ReactNode;
}

const TOGGLE_DOMAINS = new Set(["light", "switch", "fan", "cover", "media_player", "lock", "humidifier"]);

/** Read-only, full-bleed view of a layout: tap toggles, long-press opens more-info. Shared by the panel's view mode and the Lovelace card. */
export function Viewer({ layout, hass, view, onViewChange, toggle = true, rooms, onMoreInfo, extra }: ViewerProps) {
  const [, force] = useState(0);
  const filtered = useMemo(() => filterRooms(layout, rooms), [layout, rooms]);
  const walls = useMemo(() => deriveWalls(filtered), [filtered]);

  const onTap = (item: Item) => {
    const dom = domainOf(item.entityId);
    if (TOGGLE_DOMAINS.has(dom)) void hass.callService(dom, "toggle", { entity_id: item.entityId });
    else if (resolveKind(item, hass) === "climate" && !onMoreInfo) {
      const s = hass.states[item.entityId];
      void hass.callService("climate", "set_hvac_mode", { entity_id: item.entityId, hvac_mode: s?.state === "off" ? "cool" : "off" });
    } else onMoreInfo?.(item.entityId);
    force((n) => n + 1);
  };

  return (
    <div className="dh-viewer" style={{ position: "absolute", inset: 0 }}>
      {view === "2d" ? (
        <Canvas2D
          layout={filtered}
          hass={hass}
          walls={walls}
          selection={null}
          tool="select"
          readOnly
          onPreview={() => {}}
          onCommit={() => {}}
          onSelect={() => {}}
          onRoomDrawn={() => {}}
          onScale={() => {}}
          onTap={onTap}
          onDoubleTap={(item) => onMoreInfo?.(item.entityId)}
        />
      ) : (
        <div className="dh-canvas-wrap" style={{ position: "absolute", inset: 0, minHeight: 0 }}>{render3D({ layout: filtered, hass })}</div>
      )}
      <div className="dh-viewer-controls">
        {toggle && (
          <>
            <button className={`dh-btn${view === "2d" ? " on" : ""}`} onClick={() => onViewChange?.("2d")}>2D</button>
            <button className={`dh-btn${view === "3d" ? " on" : ""}`} onClick={() => onViewChange?.("3d")}>3D</button>
          </>
        )}
        {extra}
      </div>
      {view === "2d" && <div className="dh-viewer-hint dh-muted">{t("點一下切換開關，長按開啟詳細資訊")}</div>}
    </div>
  );
}

/** Keep only the named rooms (by id or name) and whatever sits inside them. */
export function filterRooms(layout: Layout, rooms?: string[] | null): Layout {
  if (!rooms || rooms.length === 0) return layout;
  const keep = layout.rooms.filter((r) => rooms.includes(r.id) || rooms.includes(r.name));
  if (keep.length === 0) return layout;
  const inside = (x: number, y: number) => keep.some((r) => pointInPolygon([x, y], r.points));
  return {
    ...layout,
    rooms: keep,
    items: layout.items.filter((i) => inside(i.x, i.y)),
    furniture: (layout.furniture ?? []).filter((f) => inside(f.x, f.y)),
  };
}
