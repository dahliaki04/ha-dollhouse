import { newId, type Point } from "./types";

/** Decorative, non-entity objects that make the layout look like the real home. */
export type FurnitureType =
  | "sofa" | "armchair" | "bed" | "table" | "coffee" | "chair" | "desk"
  | "wardrobe" | "cabinet" | "tv" | "fridge" | "counter"
  | "toilet" | "bathtub" | "sink" | "plant" | "rug"
  | "door" | "double_door" | "sliding_door" | "window" | "tall_window" | "small_window";

export interface Furniture {
  id: string;
  type: FurnitureType;
  /** Centre, canvas units. */
  x: number;
  y: number;
  /** Degrees. Width runs along local x, depth along local y. */
  rotation: number;
  /** Metres. */
  w: number;
  d: number;
  h: number;
  color: string;
  label?: string | null;
  /** Windows: bottom of the opening above the floor (m). */
  sill?: number;
  /** Doors: hinge on the other end. */
  flip?: boolean;
}

export interface FurnitureSpec {
  label: string;
  w: number;
  d: number;
  h: number;
  color: string;
  group: "門窗" | "客廳" | "臥室" | "餐廚" | "衛浴" | "其他";
  /** Doors and windows sit on a wall and cut an opening in it. */
  wall?: "door" | "window";
  sill?: number;
}

export const FURNITURE: Record<FurnitureType, FurnitureSpec> = {
  sofa: { label: "沙發", w: 2.2, d: 0.9, h: 0.8, color: "#6b7280", group: "客廳" },
  armchair: { label: "單人沙發", w: 0.9, d: 0.9, h: 0.8, color: "#6b7280", group: "客廳" },
  coffee: { label: "茶几", w: 1.0, d: 0.5, h: 0.4, color: "#a16207", group: "客廳" },
  tv: { label: "電視櫃", w: 1.6, d: 0.4, h: 0.5, color: "#57534e", group: "客廳" },
  rug: { label: "地毯", w: 2.0, d: 1.4, h: 0.01, color: "#c7d2fe", group: "客廳" },
  plant: { label: "植物", w: 0.4, d: 0.4, h: 1.2, color: "#16a34a", group: "其他" },
  bed: { label: "床", w: 1.5, d: 2.0, h: 0.5, color: "#d1d5db", group: "臥室" },
  wardrobe: { label: "衣櫃", w: 1.8, d: 0.6, h: 2.2, color: "#d6d3d1", group: "臥室" },
  desk: { label: "書桌", w: 1.2, d: 0.6, h: 0.75, color: "#a16207", group: "臥室" },
  chair: { label: "椅子", w: 0.45, d: 0.45, h: 0.9, color: "#78716c", group: "餐廚" },
  table: { label: "餐桌", w: 1.4, d: 0.8, h: 0.75, color: "#a16207", group: "餐廚" },
  counter: { label: "廚房檯面", w: 2.4, d: 0.6, h: 0.9, color: "#f5f5f4", group: "餐廚" },
  fridge: { label: "冰箱", w: 0.7, d: 0.7, h: 1.8, color: "#e5e7eb", group: "餐廚" },
  cabinet: { label: "櫃子", w: 1.0, d: 0.4, h: 0.9, color: "#d6d3d1", group: "其他" },
  toilet: { label: "馬桶", w: 0.4, d: 0.7, h: 0.8, color: "#f8fafc", group: "衛浴" },
  bathtub: { label: "浴缸", w: 1.6, d: 0.75, h: 0.55, color: "#f8fafc", group: "衛浴" },
  sink: { label: "洗手台", w: 0.6, d: 0.5, h: 0.85, color: "#f8fafc", group: "衛浴" },
  door: { label: "單開門", w: 0.9, d: 0.2, h: 2.1, color: "#b45309", group: "門窗", wall: "door" },
  double_door: { label: "雙開門", w: 1.6, d: 0.2, h: 2.1, color: "#b45309", group: "門窗", wall: "door" },
  sliding_door: { label: "推拉門", w: 1.8, d: 0.2, h: 2.1, color: "#64748b", group: "門窗", wall: "door" },
  window: { label: "窗", w: 1.2, d: 0.2, h: 1.2, color: "#7dd3fc", group: "門窗", wall: "window", sill: 0.9 },
  tall_window: { label: "落地窗", w: 2.4, d: 0.2, h: 2.2, color: "#7dd3fc", group: "門窗", wall: "window", sill: 0.05 },
  small_window: { label: "小窗", w: 0.6, d: 0.2, h: 0.6, color: "#7dd3fc", group: "門窗", wall: "window", sill: 1.5 },
};

export const FURNITURE_GROUPS: FurnitureSpec["group"][] = ["門窗", "客廳", "臥室", "餐廚", "衛浴", "其他"];

/** Doors and windows: wall-bound, cut the wall in 3D, snap to walls in 2D. */
export function isOpening(f: Pick<Furniture, "type">): boolean {
  return !!FURNITURE[f.type]?.wall;
}
export function isWindow(f: Pick<Furniture, "type">): boolean {
  return FURNITURE[f.type]?.wall === "window";
}

export function makeFurniture(type: FurnitureType, x: number, y: number): Furniture {
  const s = FURNITURE[type];
  return { id: newId("f"), type, x, y, rotation: 0, w: s.w, d: s.d, h: s.h, color: s.color, ...(s.sill != null ? { sill: s.sill } : {}) };
}

/** Corners of the footprint in canvas units (for hit-testing / selection outline). */
export function footprint(f: Furniture, metresPerUnit: number): Point[] {
  const hw = f.w / metresPerUnit / 2;
  const hd = f.d / metresPerUnit / 2;
  const th = (f.rotation * Math.PI) / 180;
  const c = Math.cos(th);
  const s = Math.sin(th);
  return ([[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]] as Point[]).map(([px, py]) => [f.x + px * c - py * s, f.y + px * s + py * c] as Point);
}

/** Slightly darker/lighter variants of the base colour for details. */
export function shade(hex: string, k: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  if (Number.isNaN(n)) return hex;
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)));
  const r = ch((n >> 16) & 255);
  const g = ch((n >> 8) & 255);
  const b = ch(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}
