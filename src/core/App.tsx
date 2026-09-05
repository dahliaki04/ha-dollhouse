import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { emptyLayout, type Item, type Layout, type Point } from "../domain/types";
import { deriveWalls } from "../domain/walls";
import { resolveKind } from "../domain/entities";
import { domainOf, type HassLike, type LayoutStore } from "../ha/types";
import { Canvas2D } from "./Canvas2D";
import { Sidebar } from "./Sidebar";
import { injectStyles } from "./styles";
import { addRoom, removeFurniture, removeItem, removeRoom, setScale, useEditor, type Tool } from "./useEditor";

export interface AppProps {
  hass: HassLike;
  store: LayoutStore;
  /** Open HA's more-info dialog; optional in the dev harness. */
  onMoreInfo?: (entityId: string) => void;
  /** Lazy 3D renderer; keeps three.js out of the first paint. */
  render3D?: (props: { layout: Layout; hass: HassLike }) => React.ReactNode;
  initialView?: "2d" | "3d";
}

const TOGGLE_DOMAINS = new Set(["light", "switch", "fan", "cover", "media_player", "lock", "humidifier"]);

export function App({ hass, store, onMoreInfo, render3D, initialView }: AppProps) {
  const [state, dispatch] = useEditor(emptyLayout(), initialView ?? "2d");
  const [loaded, setLoaded] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const layoutRef = useRef(state.layout);
  layoutRef.current = state.layout;

  useEffect(() => injectStyles(), []);

  // Load once.
  useEffect(() => {
    let alive = true;
    store.load().then((raw) => {
      if (!alive) return;
      if (raw && typeof raw === "object" && (raw as Layout).version === 1) dispatch({ type: "load", layout: raw as Layout });
      setLoaded(true);
    });
    return () => { alive = false; };
  }, [store]);

  // Autosave, debounced.
  useEffect(() => {
    if (!loaded || !state.dirty) return;
    const t = setTimeout(async () => {
      setSaveState("saving");
      try {
        await store.save(layoutRef.current);
        dispatch({ type: "saved" });
        setSaveState("saved");
      } catch {
        setSaveState("error");
      }
    }, 800);
    return () => clearTimeout(t);
  }, [state.layout, state.dirty, loaded, store]);

  const walls = useMemo(() => deriveWalls(state.layout), [state.layout]);

  const commit = useCallback((layout: Layout) => dispatch({ type: "commit", layout }), []);
  const preview = useCallback((layout: Layout) => dispatch({ type: "preview", layout }), []);
  const select = useCallback((selection: typeof state.selection) => dispatch({ type: "select", selection }), []);
  const setTool = (tool: Tool) => dispatch({ type: "tool", tool });

  const onRoomDrawn = (points: Point[]) => {
    const { layout, room } = addRoom(state.layout, points);
    commit(layout);
    dispatch({ type: "tool", tool: "select" });
    select({ kind: "room", id: room.id });
  };

  const onScale = (units: number) => {
    const metres = Number(prompt("這段距離實際是幾公尺？", "4"));
    if (metres > 0) commit(setScale(state.layout, units, metres));
    setTool("select");
  };

  const onTap = (item: Item) => {
    const dom = domainOf(item.entityId);
    if (TOGGLE_DOMAINS.has(dom)) hass.callService(dom, "toggle", { entity_id: item.entityId });
    else if (resolveKind(item, hass) === "climate" && !onMoreInfo) {
      const s = hass.states[item.entityId];
      hass.callService("climate", "set_hvac_mode", { entity_id: item.entityId, hvac_mode: s?.state === "off" ? "cool" : "off" });
    } else onMoreInfo?.(item.entityId);
  };

  // Keyboard: delete, undo/redo, escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); dispatch({ type: e.shiftKey ? "redo" : "undo" }); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") { e.preventDefault(); dispatch({ type: "redo" }); }
      else if (e.key === "Delete" || e.key === "Backspace") {
        const sel = state.selection;
        if (sel?.kind === "item") { commit(removeItem(state.layout, sel.id)); select(null); }
        if (sel?.kind === "room") { commit(removeRoom(state.layout, sel.id)); select(null); }
        if (sel?.kind === "furniture") { commit(removeFurniture(state.layout, sel.id)); select(null); }
      } else if (e.key === "Escape") { select(null); setTool("select"); }
      else if (e.key === "v") setTool("select");
      else if (e.key === "r") setTool("rect");
      else if (e.key === "p") setTool("polygon");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const onExport = () => {
    const blob = new Blob([JSON.stringify(state.layout, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${state.layout.name || "dollhouse"}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const onImport = async (file: File) => {
    try {
      const raw = JSON.parse(await file.text()) as Layout;
      if (raw.version !== 1 || !Array.isArray(raw.rooms)) throw new Error("不是 Dollhouse 的 JSON");
      commit(raw);
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const toolBtn = (tool: Tool, label: string, key: string) => (
    <button className={`dh-btn${state.tool === tool ? " on" : ""}`} title={`快捷鍵 ${key}`} onClick={() => setTool(tool)}>{label}</button>
  );

  return (
    <div className="dh-app">
      <div className="dh-toolbar">
        <span className="dh-title">🏠 Dollhouse</span>
        <input className="dh-btn dh-name" style={{ width: 140 }} value={state.layout.name} onChange={(e) => commit({ ...state.layout, name: e.target.value })} />
        {toolBtn("select", "選取", "V")}
        {toolBtn("rect", "矩形房間", "R")}
        {toolBtn("polygon", "多邊形房間", "P")}
        <button className="dh-btn" disabled={!state.past.length} onClick={() => dispatch({ type: "undo" })}>↶</button>
        <button className="dh-btn" disabled={!state.future.length} onClick={() => dispatch({ type: "redo" })}>↷</button>
        <button className={`dh-btn${state.view === "2d" ? " on" : ""}`} onClick={() => dispatch({ type: "view", view: "2d" })}>2D</button>
        <button className={`dh-btn${state.view === "3d" ? " on" : ""}`} disabled={!render3D} onClick={() => dispatch({ type: "view", view: "3d" })}>3D</button>
        <span className="dh-spacer" />
        <span className="dh-muted dh-save">{saveState === "saving" ? "儲存中…" : saveState === "error" ? "儲存失敗" : state.dirty ? "未儲存" : loaded ? "已儲存" : ""}</span>
      </div>
      <div className="dh-body">
        {state.view === "2d" || !render3D ? (
          <Canvas2D
            layout={state.layout}
            hass={hass}
            walls={walls}
            selection={state.selection}
            tool={state.tool}
            onPreview={preview}
            onCommit={commit}
            onSelect={select}
            onRoomDrawn={onRoomDrawn}
            onScale={onScale}
            onTap={onTap}
            onDoubleTap={(item) => onMoreInfo?.(item.entityId)}
          />
        ) : (
          <div className="dh-canvas-wrap">{render3D({ layout: state.layout, hass })}</div>
        )}
        <Sidebar layout={state.layout} hass={hass} walls={walls} selection={state.selection} onCommit={commit} onSelect={select} onExport={onExport} onImport={onImport} onStartScale={() => setTool("scale")} />
      </div>
    </div>
  );
}
