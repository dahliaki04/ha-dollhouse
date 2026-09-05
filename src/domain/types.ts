/**
 * Dollhouse data model. One layout = one home floor.
 *
 * Coordinates are "canvas units" (logical pixels of the drawing space, NOT metres).
 * `metresPerUnit` converts to real size; wall thickness etc. are stored in metres
 * so a re-calibration never breaks proportions.
 */

export type Point = [number, number];

export type FixtureType = "downlight" | "ceiling" | "pendant" | "wall" | "strip";

export type ItemKind = "auto" | "light" | "climate" | "presence" | "cover" | "generic";

/** curtain = side-draw 橫拉, roller = top-down 上下 (roller/honeycomb/shade), blind = slats with tilt 百葉 */
export type CoverStyle = "curtain" | "roller" | "blind";

/** Curtain stacking: center = 對開 (two panels), left / right = single panel gathers on that side, as seen from inside the room. */
export type CoverDraw = "center" | "left" | "right";

/** Where the object is mounted. Drives the 3D height (and the default z). */
export type Mount = "ceiling" | "wall" | "floor";

/** Which way a strip / wall lamp throws its light. */
export type Beam = "down" | "up" | "both";

export interface Room {
  id: string;
  name: string;
  /** Home Assistant area_id this room maps to (optional). */
  areaId?: string | null;
  /** Closed polygon, canvas units, no repeated last point. */
  points: Point[];
  /** Ceiling height in metres (3D). */
  height?: number;
  /** Floor tint (CSS colour). */
  color?: string | null;
}

export interface Item {
  id: string;
  entityId: string;
  x: number;
  y: number;
  /** Mounting position; default depends on kind/fixture. */
  mount?: Mount | null;
  /** Custom height above floor in metres; overrides the mount preset. */
  z?: number | null;
  /** Light throw direction for strips and wall lamps; default depends on mount. */
  beam?: Beam | null;
  /** Rotation in degrees, for wall lights / strips. */
  rotation?: number;
  /** Physical length in metres (strips). Default 1.0. */
  length?: number;
  /** User colour override (#rrggbb). Wins over HA-reported colour; for on/off-only lights (Shelly, Sonoff). */
  color?: string | null;
  /** Cover drawing style override; guessed from HA attributes when unset. */
  coverStyle?: CoverStyle | null;
  /** Curtain stacking side (curtain style only). Default center. */
  coverDraw?: CoverDraw | null;
  kind: ItemKind;
  fixture?: FixtureType;
  /** For generic items: which attribute to show instead of state. */
  attribute?: string | null;
  label?: string | null;
}

export interface Background {
  /** data: URL or HA-served URL. */
  url: string;
  width: number;
  height: number;
  opacity?: number;
}

export interface WallDefaults {
  /** metres */
  exterior: number;
  interior: number;
  /** metres */
  height: number;
}

export interface Layout {
  version: 1;
  name: string;
  canvas: { width: number; height: number };
  /** Real-world scale. */
  metresPerUnit: number;
  background?: Background | null;
  rooms: Room[];
  items: Item[];
  /** Decorative furniture (no entity binding). Optional for layouts saved before it existed. */
  furniture?: import("./furniture").Furniture[];
  wallDefaults: WallDefaults;
  /** Per-wall thickness overrides in metres, keyed by derived wall id. */
  wallThickness: Record<string, number>;
  /** Walls that exist only as a room boundary (open-plan kitchen/living), keyed by wall id. */
  wallVirtual?: Record<string, true>;
  /** Grid in metres for snapping (0 = off). */
  grid: number;
  /** 3D: draw value labels for generic items (sensors, switches). Default true. */
  labels3d?: boolean;
  /** Structure lock: rooms cannot be moved, reshaped, added or deleted while true. Devices and furniture stay editable. */
  locked?: boolean;
  /** Structure lock: rooms cannot be moved, reshaped, added or deleted while true. Devices and furniture stay editable. */
  locked?: boolean;
}

/** A wall derived from room edges. Never stored; always recomputed. */
export interface Wall {
  id: string;
  a: Point;
  b: Point;
  exterior: boolean;
  /** Rooms touching this wall (1 for exterior, 2 for interior). */
  rooms: string[];
  /** Resolved thickness in metres. */
  thickness: number;
  /** True when thickness comes from an explicit override. */
  overridden: boolean;
  /** Boundary only, no physical wall. */
  virtual: boolean;
}

export const DEFAULT_WALLS: WallDefaults = { exterior: 0.24, interior: 0.12, height: 2.8 };

export function emptyLayout(name = "我的家"): Layout {
  const width = 1200;
  const height = 800;
  return {
    version: 1,
    name,
    canvas: { width, height },
    // Uncalibrated default: assume the blank canvas is 12 m wide.
    metresPerUnit: 12 / width,
    background: null,
    rooms: [],
    items: [],
    furniture: [],
    wallDefaults: { ...DEFAULT_WALLS },
    wallThickness: {},
    wallVirtual: {},
    grid: 0.5,
  };
}

let counter = 0;
export function newId(prefix: string): string {
  counter = (counter + 1) % 1e6;
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}`;
}
