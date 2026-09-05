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
  /** Height above floor in metres (3D). Defaults per fixture. */
  z?: number;
  /** Rotation in degrees, for wall lights / strips. */
  rotation?: number;
  /** Physical length in metres (strips). Default 1.0. */
  length?: number;
  /** User colour override (#rrggbb). Wins over HA-reported colour; for on/off-only lights (Shelly, Sonoff). */
  color?: string | null;
  /** Cover drawing style override; guessed from HA attributes when unset. */
  coverStyle?: CoverStyle | null;
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
  wallDefaults: WallDefaults;
  /** Per-wall thickness overrides in metres, keyed by derived wall id. */
  wallThickness: Record<string, number>;
  /** Grid in metres for snapping (0 = off). */
  grid: number;
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
    wallDefaults: { ...DEFAULT_WALLS },
    wallThickness: {},
    grid: 0.5,
  };
}

let counter = 0;
export function newId(prefix: string): string {
  counter = (counter + 1) % 1e6;
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}`;
}
