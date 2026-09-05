import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { emptyLayout, type Item, type Layout, type Point } from "../domain/types";
import { deriveWalls } from "../domain/walls";
import type { HassLike, LayoutStore } from "../ha/types";
import { Canvas2D } from "./Canvas2D";
import { Sidebar, TextField } from "./Sidebar";
import { Mark } from "./Mark";
import { ToastBar, type Toast } from "./ui";
import { Viewer } from "./Viewer";
import { Welcome, markWelcomeSeen, welcomeSeen } from "./Welcome";
import { Help } from "./Help";
import { demoLayout } from "../ha/demo";
import { setBackground } from "./useEditor";
import { langFromHass, onLangChange, readLangOverride, setLang, t } from "../i18n";
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

export function App({ hass, store, onMoreInfo, render3D, initialView }: AppProps) {
  const [state, dispatch] = useEditor(emptyLayout(), initialView ?? "2d");
  const [loaded, setLoaded] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [placing, setPlacing] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  // Language: manual override wins, else follow Home Assistant; re-render on change.
  const [, langTick] = useState(0);
  useEffect(() => onLangChange(() => langTick((n) => n + 1)), []);
  useEffect(() => { setLang(readLangOverride() ?? langFromHass(hass.language)); }, [hass.language]);
  const [wallMulti, setWallMulti] = useState(false);
  const [help, setHelp] = useState(() => import.meta.env.DEV && new URLSearchParams(location.search).has("help"));
  const [welcomeDismissed, setWelcomeDismissed] = useState(() => welcomeSeen());
  // Edit vs view mode. Remembered per device; first run with no rooms starts in edit mode.
  const [mode, setModeState] = useState<"edit" | "view">(() => { try { return (localStorage.getItem("dollhouse:mode") as "edit" | "view") || "view"; } catch { return "view"; } });
  const setMode = (m: "edit" | "view") => { setModeState(m); try { localStorage.setItem("dollhouse:mode", m); } catch { /* ignore */ } };
  const notify = useCallback((t: Toast | string) => setToast(typeof t === "string" ? { text: t } : t), []);
  const layoutRef = useRef(state.layout);
  layoutRef.current = state.layout;

  const rootRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => { bodyRef.current?.scrollTo({ top: 0, behavior: "smooth" }); }, [state.view]);
  useEffect(() => {
    const root = rootRef.current?.getRootNode();
    injectStyles(root instanceof ShadowRoot ? root : document);
  }, []);

  // Load once.
  useEffect(() => {
    let alive = true;
    store.load().then((raw) => {
      if (!alive) return;
      if (raw && typeof raw === "object" && (raw as Layout).version === 1) dispatch({ type: "load", layout: raw as Layout });
      else setModeState("edit");
      if (raw && (raw as Layout).rooms?.length === 0) setModeState("edit");
      // Dev harness hook: ?select=room opens the editor with the first room selected (for screenshots).
      if (import.meta.env.DEV && new URLSearchParams(location.search).get("select") === "room" && raw) {
        setModeState("edit");
        const first = (raw as Layout).rooms?.[0];
        if (first) setTimeout(() => dispatch({ type: "select", selection: { kind: "room", id: first.id } }), 0);
      }
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
        setToast({ text: t("儲存失敗，請檢查連線或權限（需要管理員）"), kind: "error", ttl: 6000 });
      }
    }, 800);
    return () => clearTimeout(t);
  }, [state.layout, state.dirty, loaded, store]);

  const walls = useMemo(() => deriveWalls(state.layout), [state.layout]);

  const commit = useCallback((layout: Layout) => dispatch({ type: "commit", layout }), []);
  const preview = useCallback((layout: Layout) => dispatch({ type: "preview", layout }), []);
  const select = useCallback((selection: typeof state.selection) => { dispatch({ type: "select", selection }); setPlacing(false); }, []);
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

  // Edit mode: a tap only selects (switching devices happens in view mode). Double-tap still opens more-info.
  const onTap = (_item: Item) => {};

  // Keyboard: delete, undo/redo, escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Inside a shadow root e.target is retargeted to the host; composedPath() gives the real element.
      const real = (e.composedPath?.()[0] ?? e.target) as HTMLElement | null;
      const tag = real?.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA" || real?.isContentEditable) return;
      if (mode !== "edit") return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); dispatch({ type: e.shiftKey ? "redo" : "undo" }); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") { e.preventDefault(); dispatch({ type: "redo" }); }
      else if (e.key === "Delete" || e.key === "Backspace") {
        const sel = state.selection;
        if (sel?.kind === "item") { commit(removeItem(state.layout, sel.id)); select(null); notify({ text: t("已移除裝置"), action: { label: t("復原"), onClick: () => dispatch({ type: "undo" }) } }); }
        if (sel?.kind === "room" && !state.layout.locked) { commit(removeRoom(state.layout, sel.id)); select(null); notify({ text: t("已刪除房間"), action: { label: t("復原"), onClick: () => dispatch({ type: "undo" }) } }); }
        if (sel?.kind === "furniture") { commit(removeFurniture(state.layout, sel.id)); select(null); notify({ text: t("已刪除家具"), action: { label: t("復原"), onClick: () => dispatch({ type: "undo" }) } }); }
      } else if (e.key === "Escape") { select(null); setTool("select"); setPlacing(false); }
      else if (e.key === "v") setTool("select");
      else if (e.key === "r" && !state.layout.locked) setTool("rect");
      else if (e.key === "p" && !state.layout.locked) setTool("polygon");
      else if (e.key === "m" && state.layout.background) setTool("magic");
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
      if (raw.version !== 1 || !Array.isArray(raw.rooms)) throw new Error(t("不是 Dollhouse 的 JSON"));
      commit(raw);
    } catch (e) {
      notify({ text: (e as Error).message, kind: "error" });
    }
  };

  const roomTool = (tool: Tool) => tool === "rect" || tool === "polygon" || tool === "magic";
  const toolBtn = (tool: Tool, label: string, key: string) => (
    <button className={`dh-btn${state.tool === tool ? " on" : ""}`} disabled={!!state.layout.locked && roomTool(tool)} title={t("快捷鍵 {key}", { key })} onClick={() => setTool(tool)}>{label}</button>
  );

  if (mode === "view" && loaded) {
    return (
      <div className="dh-app dh-app-view" ref={rootRef}>
        <div className="dh-body" style={{ position: "relative" }}>
          <Viewer
            layout={state.layout}
            hass={hass}
            view={state.view === "3d" && render3D ? "3d" : "2d"}
            onViewChange={(v) => dispatch({ type: "view", view: v })}
            toggle={!!render3D}
            onMoreInfo={onMoreInfo}
            extra={<><button className="dh-btn" onClick={() => setMode("edit")}>{t("編輯")}</button><button className={`dh-btn${help ? " on" : ""}`} onClick={() => setHelp((h) => !h)} aria-label={t("說明")} title={t("說明")}>?</button></>}
          />
          {help && <Help onClose={() => setHelp(false)} />}
          <ToastBar toast={toast} onDone={() => setToast(null)} />
        </div>
      </div>
    );
  }

  return (
    <div className="dh-app" ref={rootRef}>
      <div className="dh-toolbar">
        <span className="dh-title" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Mark /> Dollhouse</span>
        <span className="dh-name" style={{ width: 200 }}><TextField label="" value={state.layout.name} onSave={(v) => commit({ ...state.layout, name: v })} /></span>
        <button className={`dh-btn${state.layout.locked ? " on" : ""}`} title={state.layout.locked ? t("平面圖已鎖定：房間不能移動、變形、新增或刪除") : t("鎖定平面圖，避免誤動房間")} aria-pressed={!!state.layout.locked} onClick={() => { commit({ ...state.layout, locked: !state.layout.locked }); if (!state.layout.locked) setTool("select"); }}>{state.layout.locked ? t("🔒 已鎖定") : t("🔓 鎖定")}</button>
        {toolBtn("select", t("選取"), "V")}
        {toolBtn("rect", t("矩形房間"), "R")}
        {toolBtn("polygon", t("多邊形房間"), "P")}
        <button className={`dh-btn${state.tool === "magic" ? " on" : ""}`} disabled={!state.layout.background || !!state.layout.locked} title={state.layout.background ? t("點底圖上的房間內部，自動框出") : t("先上傳底圖")} onClick={() => setTool("magic")}>{t("點選房間")}</button>
        <button className="dh-btn" aria-label={t("復原")} title={t("復原 (Ctrl+Z)")} disabled={!state.past.length} onClick={() => dispatch({ type: "undo" })}>↶</button>
        <button className="dh-btn" aria-label={t("重做")} title={t("重做 (Ctrl+Y)")} disabled={!state.future.length} onClick={() => dispatch({ type: "redo" })}>↷</button>
        <button className={`dh-btn${state.view === "2d" ? " on" : ""}`} onClick={() => dispatch({ type: "view", view: "2d" })}>2D</button>
        <button className={`dh-btn${state.view === "3d" ? " on" : ""}`} disabled={!render3D} onClick={() => dispatch({ type: "view", view: "3d" })}>3D</button>
        <button className="dh-btn" onClick={() => setMode("view")} disabled={state.layout.rooms.length === 0} title={t("切換到檢視模式")}>{t("完成")}</button>
        <button className={`dh-btn${help ? " on" : ""}`} onClick={() => setHelp((h) => !h)} aria-label={t("說明")} title={t("說明")}>?</button>
        <span className="dh-spacer" />
        <span className="dh-muted dh-save">{saveState === "saving" ? t("儲存中…") : saveState === "error" ? t("儲存失敗") : state.dirty ? t("未儲存") : loaded ? t("已儲存") : ""}</span>
      </div>
      <div className="dh-body" ref={bodyRef} style={{ position: "relative" }}>
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
            placing={placing}
            onPlaced={() => setPlacing(false)}
            wallMulti={wallMulti}
          />
        ) : (
          <div className="dh-canvas-wrap" style={{ minHeight: 320 }}>{render3D({ layout: state.layout, hass })}</div>
        )}
        <Sidebar layout={state.layout} hass={hass} walls={walls} selection={state.selection} onCommit={commit} onSelect={select} onExport={onExport} onImport={onImport} onStartScale={() => setTool("scale")} placing={placing} onPlacing={setPlacing} onNotify={notify} wallMulti={wallMulti} onWallMulti={setWallMulti} />
        {help && <Help onClose={() => setHelp(false)} />}
        {loaded && !welcomeDismissed && state.layout.rooms.length === 0 && (
          <Welcome
            onClose={() => { markWelcomeSeen(); setWelcomeDismissed(true); }}
            onDemo={() => { commit(demoLayout(hass)); markWelcomeSeen(); setWelcomeDismissed(true); notify(t("已載入示範，檔案區的「全部清除」可以重來")); }}
            onBackground={(bg) => { commit(setBackground(state.layout, bg)); markWelcomeSeen(); setWelcomeDismissed(true); setTool("magic"); }}
            onDraw={() => { markWelcomeSeen(); setWelcomeDismissed(true); setTool("rect"); }}
          />
        )}
        <ToastBar toast={toast} onDone={() => setToast(null)} />
      </div>
    </div>
  );
}
