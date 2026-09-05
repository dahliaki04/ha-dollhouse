import { useReducer } from "react";
import type { Background, Item, Layout, Point, Room } from "../domain/types";
import type { Furniture } from "../domain/furniture";
import { newId } from "../domain/types";
import { deriveWalls, pruneOverrides, pruneVirtual, setThickness, setVirtual } from "../domain/walls";

export type Selection = { kind: "room"; id: string } | { kind: "item"; id: string } | { kind: "furniture"; id: string } | { kind: "walls"; ids: string[] } | null;
export type Tool = "select" | "rect" | "polygon" | "scale";
export type View = "2d" | "3d";

export interface EditorState {
  layout: Layout;
  selection: Selection;
  tool: Tool;
  view: View;
  past: Layout[];
  future: Layout[];
  dirty: boolean;
}

export type EditorAction =
  | { type: "load"; layout: Layout }
  | { type: "commit"; layout: Layout }
  | { type: "preview"; layout: Layout }
  | { type: "select"; selection: Selection }
  | { type: "tool"; tool: Tool }
  | { type: "view"; view: View }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "saved" };

const HISTORY = 60;

function reducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "load":
      return { ...state, layout: action.layout, past: [], future: [], selection: null, dirty: false };
    case "commit":
      return { ...state, layout: action.layout, past: [...state.past.slice(-HISTORY), state.layout], future: [], dirty: true };
    case "preview":
      return { ...state, layout: action.layout };
    case "select":
      return { ...state, selection: action.selection };
    case "tool":
      return { ...state, tool: action.tool, selection: action.tool === "select" ? state.selection : null };
    case "view":
      return { ...state, view: action.view };
    case "undo": {
      const prev = state.past[state.past.length - 1];
      if (!prev) return state;
      return { ...state, layout: prev, past: state.past.slice(0, -1), future: [state.layout, ...state.future], selection: null, dirty: true };
    }
    case "redo": {
      const next = state.future[0];
      if (!next) return state;
      return { ...state, layout: next, past: [...state.past, state.layout], future: state.future.slice(1), selection: null, dirty: true };
    }
    case "saved":
      return { ...state, dirty: false };
  }
}

export function useEditor(initial: Layout, view: View = "2d") {
  return useReducer(reducer, { layout: initial, selection: null, tool: "select", view, past: [], future: [], dirty: false });
}

/* ---------- pure layout operations ---------- */

function withRooms(layout: Layout, rooms: Room[]): Layout {
  const next = { ...layout, rooms };
  const walls = deriveWalls(next);
  return { ...next, wallThickness: pruneOverrides(next, walls), wallVirtual: pruneVirtual(next, walls) };
}

export function addRoom(layout: Layout, points: Point[], name?: string): { layout: Layout; room: Room } {
  const room: Room = { id: newId("r"), name: name ?? `房間 ${layout.rooms.length + 1}`, points };
  return { layout: withRooms(layout, [...layout.rooms, room]), room };
}

export function updateRoom(layout: Layout, id: string, patch: Partial<Room>): Layout {
  return withRooms(layout, layout.rooms.map((r) => (r.id === id ? { ...r, ...patch } : r)));
}

export function moveRoom(layout: Layout, id: string, dx: number, dy: number, withItems = true): Layout {
  const rooms = layout.rooms.map((r) => (r.id === id ? { ...r, points: r.points.map(([x, y]) => [x + dx, y + dy] as Point) } : r));
  const next = withRooms(layout, rooms);
  if (!withItems) return next;
  const room = layout.rooms.find((r) => r.id === id);
  if (!room) return next;
  const inside = new Set(layout.items.filter((i) => insidePolygon([i.x, i.y], room.points)).map((i) => i.id));
  const insideF = new Set((layout.furniture ?? []).filter((f) => insidePolygon([f.x, f.y], room.points)).map((f) => f.id));
  return {
    ...next,
    items: next.items.map((i) => (inside.has(i.id) ? { ...i, x: i.x + dx, y: i.y + dy } : i)),
    furniture: (next.furniture ?? []).map((f) => (insideF.has(f.id) ? { ...f, x: f.x + dx, y: f.y + dy } : f)),
  };
}

export function removeRoom(layout: Layout, id: string): Layout {
  return withRooms(layout, layout.rooms.filter((r) => r.id !== id));
}

export function addItems(layout: Layout, items: Item[]): Layout {
  return { ...layout, items: [...layout.items, ...items] };
}

export function updateItem(layout: Layout, id: string, patch: Partial<Item>): Layout {
  return { ...layout, items: layout.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) };
}

export function removeItem(layout: Layout, id: string): Layout {
  return { ...layout, items: layout.items.filter((i) => i.id !== id) };
}

export function addFurniture(layout: Layout, f: Furniture): Layout {
  return { ...layout, furniture: [...(layout.furniture ?? []), f] };
}

export function updateFurniture(layout: Layout, id: string, patch: Partial<Furniture>): Layout {
  return { ...layout, furniture: (layout.furniture ?? []).map((f) => (f.id === id ? { ...f, ...patch } : f)) };
}

export function removeFurniture(layout: Layout, id: string): Layout {
  return { ...layout, furniture: (layout.furniture ?? []).filter((f) => f.id !== id) };
}

export function applyThickness(layout: Layout, ids: string[], metres: number): Layout {
  return { ...layout, wallThickness: setThickness(layout, ids, metres) };
}

export function applyVirtual(layout: Layout, ids: string[], virtual: boolean): Layout {
  return { ...layout, wallVirtual: setVirtual(layout, ids, virtual) };
}

export function resetThickness(layout: Layout, ids: string[]): Layout {
  const next = { ...layout.wallThickness };
  for (const id of ids) delete next[id];
  return { ...layout, wallThickness: next };
}

export function setBackground(layout: Layout, bg: Background | null): Layout {
  if (!bg) return { ...layout, background: null };
  // Fresh layout: adopt the image's pixel space as the canvas so 1 unit = 1 image px.
  if (layout.rooms.length === 0 && layout.items.length === 0) {
    const metresWide = layout.canvas.width * layout.metresPerUnit;
    return { ...layout, background: bg, canvas: { width: bg.width, height: bg.height }, metresPerUnit: metresWide / bg.width };
  }
  return { ...layout, background: bg };
}

/** Calibrate: the user measured `units` on canvas and says it is `metres` long. */
export function setScale(layout: Layout, units: number, metres: number): Layout {
  if (units <= 0 || metres <= 0) return layout;
  return { ...layout, metresPerUnit: metres / units };
}

function insidePolygon(p: Point, pts: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
