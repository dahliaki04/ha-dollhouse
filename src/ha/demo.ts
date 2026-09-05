import { autoPlace, entitiesInArea } from "../domain/entities";
import { rectToPolygon } from "../domain/geometry";
import { emptyLayout, type Layout, type Room } from "../domain/types";
import { deriveWalls } from "../domain/walls";
import type { HassLike } from "./types";

/** A 12 m × 8 m apartment with rooms linked to the mock areas and entities auto-placed. */
export function demoLayout(hass: HassLike): Layout {
  const layout = emptyLayout("示範公寓");
  const m = 100; // 1 m = 100 units at 0.01 m/unit
  layout.metresPerUnit = 0.01;
  layout.canvas = { width: 12 * m, height: 8 * m };
  const mk = (id: string, name: string, areaId: string | null, x: number, y: number, w: number, h: number): Room => ({
    id,
    name,
    areaId,
    points: rectToPolygon(x * m, y * m, w * m, h * m),
  });
  layout.rooms = [
    mk("r_living", "客廳", "living", 0, 0, 6, 5),
    mk("r_dining", "餐廳", "dining", 6, 0, 3, 5),
    mk("r_kitchen", "廚房", "kitchen", 9, 0, 3, 3),
    mk("r_entrance", "玄關", "entrance", 9, 3, 3, 2),
    mk("r_master", "主臥", "master", 0, 5, 5, 3),
    mk("r_kid", "果的房間", "kid", 5, 5, 3.5, 3),
    mk("r_bath", "浴室", null, 8.5, 5, 3.5, 3),
  ];
  const walls = deriveWalls(layout);
  for (const r of layout.rooms) {
    if (!r.areaId) continue;
    layout.items.push(...autoPlace(hass, r, entitiesInArea(hass, r.areaId), layout.items, 1.0 / layout.metresPerUnit, walls));
  }
  const mc = layout.items.find((i) => i.entityId === "cover.master_curtain");
  if (mc) mc.coverDraw = "left";
  const cove = layout.items.find((i) => i.entityId === "light.kid_cove_strip");
  if (cove) Object.assign(cove, { mount: "wall", z: 2.3, length: 3, x: 6.75 * m, y: 5 * m, rotation: 0 }); // on the kid room north wall, throws up
  const ac = layout.items.find((i) => i.entityId === "climate.daikin_living");
  if (ac) ac.mount = "ceiling"; // Daikin cassette
  const kitchen = layout.items.find((i) => i.entityId === "light.kitchen_downlight");
  if (kitchen) kitchen.color = "#f6f1e6"; // 4000K-ish, user-set: this light only reports on/off
  const strip = layout.items.find((i) => i.entityId === "light.living_strip");
  if (strip) Object.assign(strip, { length: 2.5, x: 3 * m, y: 0.4 * m });
  // Make the living/dining partition thinner so the override path is exercised.
  layout.wallThickness["w:r_dining|r_living|1"] = 0.1;
  return layout;
}
