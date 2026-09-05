import { autoPlace, entitiesInArea } from "../domain/entities";
import { rectToPolygon } from "../domain/geometry";
import { emptyLayout, type Layout, type Room } from "../domain/types";
import { deriveWalls } from "../domain/walls";
import { makeFurniture, type Furniture, type FurnitureType } from "../domain/furniture";
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
  layout.wallThickness["w:r_master|r_kid|1"] = 0.1; // master right edge (1) shared with kid
  // Open-plan: living ↔ dining and dining ↔ kitchen are boundaries only.
  layout.wallVirtual = { "w:r_dining|r_living|3": true, "w:r_dining|r_kitchen|1": true }; // dining left edge (3) ↔ living, right edge (1) ↔ kitchen
  const put = (type: FurnitureType, x: number, y: number, rotation = 0, patch: Partial<Furniture> = {}): Furniture => ({ ...makeFurniture(type, x * m, y * m), rotation, ...patch });
  layout.furniture = [
    put("rug", 3, 2.6),
    // Brian's real sofa (from photo): 3-seat greige leather, slim metal legs, ~2.3 × 0.95 × 0.85 m
    put("sofa", 3, 3.8, 180, { w: 2.3, d: 0.95, h: 0.85, color: "#d8d2c8", label: "客廳沙發" }),
    put("coffee", 3, 2.6),
    put("tv", 3, 0.45),
    put("plant", 0.4, 4.5),
    put("table", 7.5, 2.5, 90, { w: 1.6 }),
    put("chair", 6.9, 2.0, 270), put("chair", 6.9, 3.0, 270), put("chair", 8.1, 2.0, 90), put("chair", 8.1, 3.0, 90),
    put("counter", 11.6, 1.6, 90, { w: 2.4 }),
    put("fridge", 9.6, 2.5, 90),
    put("bed", 2.5, 6.9, 180),
    put("wardrobe", 0.4, 6.5, 90, { w: 2.2 }),
    put("bed", 6.75, 6.8, 180, { w: 1.2, color: "#fde68a" }),
    put("desk", 8.1, 5.6, 90, { w: 1.0 }),
    put("bathtub", 11.5, 6.5, 90),
    put("toilet", 9.0, 7.5, 0),
    put("sink", 9.0, 5.5, 180),
  ];
  return layout;
}
