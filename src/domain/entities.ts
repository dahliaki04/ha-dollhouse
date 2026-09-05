import type { FixtureType, Item, ItemKind, Layout, Mount, Point, Room, Wall } from "./types";
import { newId } from "./types";
import { bbox, pointInPolygon } from "./geometry";
import { domainOf, friendlyName, type HassLike } from "../ha/types";

/** Domains worth putting on a floor plan by default. */
export const PLACEABLE_DOMAINS = new Set(["light", "switch", "climate", "fan", "cover", "binary_sensor", "sensor", "media_player", "lock", "vacuum", "humidifier"]);

const SENSOR_CLASSES = new Set(["temperature", "humidity", "carbon_dioxide", "illuminance", "power", "energy", "pm25", "battery"]);

/** Entities that belong to an HA area (directly or via their device). */
export function entitiesInArea(hass: HassLike, areaId: string): string[] {
  const out: string[] = [];
  for (const e of Object.values(hass.entities)) {
    if (e.hidden || e.entity_category) continue;
    const area = e.area_id ?? (e.device_id ? hass.devices[e.device_id]?.area_id : null);
    if (area !== areaId) continue;
    if (!hass.states[e.entity_id]) continue;
    const dom = domainOf(e.entity_id);
    if (!PLACEABLE_DOMAINS.has(dom)) continue;
    if (dom === "sensor") {
      const cls = hass.states[e.entity_id].attributes.device_class as string | undefined;
      if (!cls || !SENSOR_CLASSES.has(cls)) continue;
    }
    if (dom === "binary_sensor") {
      const cls = hass.states[e.entity_id].attributes.device_class as string | undefined;
      if (cls && !["occupancy", "motion", "presence", "door", "window", "opening"].includes(cls)) continue;
    }
    out.push(e.entity_id);
  }
  return out.sort(byDomainThenName(hass));
}

const DOMAIN_ORDER = ["light", "climate", "fan", "switch", "cover", "media_player", "binary_sensor", "sensor", "lock", "vacuum", "humidifier"];
const byDomainThenName = (hass: HassLike) => (a: string, b: string) => {
  const da = DOMAIN_ORDER.indexOf(domainOf(a));
  const db = DOMAIN_ORDER.indexOf(domainOf(b));
  return da !== db ? da - db : friendlyName(hass, a).localeCompare(friendlyName(hass, b));
};

/** Resolve "auto" to a concrete kind from the entity domain. */
export function resolveKind(item: Pick<Item, "kind" | "entityId">, hass: HassLike): Exclude<ItemKind, "auto"> {
  if (item.kind !== "auto") return item.kind;
  const dom = domainOf(item.entityId);
  if (dom === "light") return "light";
  if (dom === "climate") return "climate";
  if (dom === "cover") return "cover";
  if (dom === "binary_sensor") {
    const cls = hass.states[item.entityId]?.attributes.device_class as string | undefined;
    if (!cls || ["occupancy", "motion", "presence"].includes(cls)) return "presence";
  }
  return "generic";
}

/** Guess a fixture type from names; user can always override. */
export function guessFixture(hass: HassLike, entityId: string): FixtureType {
  const text = `${entityId} ${friendlyName(hass, entityId)}`.toLowerCase();
  if (/strip|燈條|燈帶|led\s?bar|間接/.test(text)) return "strip";
  if (/wall|壁燈|壁|sconce/.test(text)) return "wall";
  if (/pendant|吊燈|吊/.test(text)) return "pendant";
  if (/ceiling|吸頂|主燈|room light|房間燈/.test(text)) return "ceiling";
  return "downlight";
}

/** Default mount per kind/fixture. */
export function defaultMount(item: Pick<Item, "kind" | "entityId" | "fixture">, hass: HassLike): Mount {
  const kind = resolveKind(item, hass);
  if (kind === "light") return (item.fixture ?? "downlight") === "wall" ? "wall" : "ceiling";
  if (kind === "climate") return "wall";
  if (kind === "presence") return "ceiling";
  if (kind === "cover") return "wall";
  const dom = domainOf(item.entityId);
  if (dom === "switch" || dom === "binary_sensor" || dom === "sensor" || dom === "lock") return "wall";
  return "floor";
}

/** Height (m) implied by a mount preset for this item. */
export function mountHeight(item: Pick<Item, "kind" | "entityId" | "fixture">, mount: Mount, hass: HassLike, ceiling: number): number {
  if (mount === "ceiling") return ceiling;
  if (mount === "floor") return 0;
  const kind = resolveKind(item, hass);
  if (kind === "light") return 1.9; // wall lamp
  if (kind === "climate") return 2.2; // wall unit
  if (kind === "presence") return 1.5;
  return 1.2; // switches, thermostats, sensors
}

/** Effective height: custom z → mount preset → default mount. */
export function effectiveHeight(item: Item, hass: HassLike, ceiling: number): number {
  if (typeof item.z === "number") return Math.min(item.z, ceiling);
  return mountHeight(item, item.mount ?? defaultMount(item, hass), hass, ceiling);
}

/** Default mounting height (m) per fixture, for 3D. */
export const FIXTURE_HEIGHT: Record<FixtureType, number> = {
  downlight: 2.8,
  ceiling: 2.75,
  pendant: 2.0,
  wall: 1.9,
  strip: 2.6,
};

export function makeItem(hass: HassLike, entityId: string, x: number, y: number): Item {
  const item: Item = { id: newId("i"), entityId, x, y, kind: "auto" };
  const dom = domainOf(entityId);
  // Switches stay generic by default; the fixture guess is kept so "顯示方式 → 燈" gets a sensible glyph.
  if (dom === "light" || dom === "switch") item.fixture = guessFixture(hass, entityId);
  if (dom === "cover") item.length = 1.5;
  return item;
}

/**
 * Place a list of entities inside a room on a grid, skipping points outside the
 * polygon. Lights get the inner cells first so they land near the centre.
 */
export function autoPlace(hass: HassLike, room: Room, entityIds: string[], existing: Item[], labelBand = 0, walls: Wall[] = []): Item[] {
  const already = new Set(existing.map((i) => i.entityId));
  const all = entityIds.filter((e) => !already.has(e));
  // Covers go on the room exterior walls (longest first); everything else on the grid.
  const covers = all.filter((e) => domainOf(e) === "cover");
  const todo = all.filter((e) => domainOf(e) !== "cover");
  const ext = walls.filter((w) => w.exterior && w.rooms[0] === room.id).sort((a, b) => segLen(b) - segLen(a));
  const coverItems = covers.map((entityId, i) => {
    const w = ext[i % Math.max(1, ext.length)];
    if (!w) return makeItem(hass, entityId, (room.points[0][0] + room.points[1][0]) / 2, (room.points[0][1] + room.points[1][1]) / 2);
    const it = makeItem(hass, entityId, (w.a[0] + w.b[0]) / 2, (w.a[1] + w.b[1]) / 2);
    it.rotation = Math.round((Math.atan2(w.b[1] - w.a[1], w.b[0] - w.a[0]) * 180) / Math.PI);
    return it;
  });
  if (todo.length === 0) return coverItems;
  const full = bbox(room.points);
  // Leave the label band at the top and a margin so markers stay clear of walls.
  const mx = Math.min(full.w * 0.15, labelBand * 0.6);
  const box = { x: full.x + mx, y: full.y + Math.min(full.h * 0.3, labelBand), w: full.w - 2 * mx, h: 0 };
  box.h = full.y + full.h - box.y - mx;
  const cols = Math.ceil(Math.sqrt(todo.length * (box.w / Math.max(1, box.h))));
  const rows = Math.ceil(todo.length / Math.max(1, cols));
  const cells: Point[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const p: Point = [box.x + ((c + 0.5) / cols) * box.w, box.y + ((r + 0.5) / rows) * box.h];
      if (pointInPolygon(p, room.points)) cells.push(p);
    }
  }
  // Fallback if the polygon is thin: put everything on the centroid line.
  while (cells.length < todo.length) cells.push([box.x + box.w / 2, box.y + box.h / 2]);
  return [...coverItems, ...todo.map((entityId, i) => makeItem(hass, entityId, cells[i][0], cells[i][1]))];
}

const segLen = (w: Wall) => Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]);

export function roomOfPoint(layout: Layout, p: Point): Room | undefined {
  return layout.rooms.find((r) => pointInPolygon(p, r.points));
}
