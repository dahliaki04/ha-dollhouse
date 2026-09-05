import { useRef, useState } from "react";
import { langFromHass, readLangOverride, setLang, t, writeLangOverride, type Lang } from "../i18n";
import type { CoverDraw, CoverStyle, FixtureType, Item, ItemKind, Layout, Wall } from "../domain/types";
import { coverView, guessCoverStyle } from "../domain/covers";
import { autoPlace, defaultBeam, defaultMount, effectiveHeight, entitiesInArea, hasBeam, makeItem, mountHeight, resolveKind } from "../domain/entities";
import type { Beam } from "../domain/types";
import type { Mount } from "../domain/types";
import { newId } from "../domain/types";
import { domainOf, friendlyName, type HassLike } from "../ha/types";
import { importBackground } from "./background";
import { KELVIN_PRESETS, kelvinToHex, lightColor } from "./markers";
import { addFurniture, addItems, applyThickness, applyVirtual, removeFurniture, removeItem, removeRoom, resetThickness, setBackground, updateFurniture, updateItem, updateRoom, type Selection } from "./useEditor";
import { FURNITURE, FURNITURE_GROUPS, makeFurniture, type Furniture, type FurnitureType } from "../domain/furniture";
import { centroid, pointInPolygon } from "../domain/geometry";
import { EntityPicker } from "./EntityPicker";
import { VERSION } from "../version";
import { PanelHeader, Section, type Toast } from "./ui";

export interface SidebarProps {
  layout: Layout;
  hass: HassLike;
  walls: Wall[];
  selection: Selection;
  onCommit: (l: Layout) => void;
  onSelect: (s: Selection) => void;
  onExport: () => void;
  onImport: (file: File) => void;
  onStartScale: () => void;
  placing?: boolean;
  onPlacing?: (v: boolean) => void;
  onNotify?: (t: Toast | string) => void;
  wallMulti?: boolean;
  onWallMulti?: (v: boolean) => void;
}

const FIXTURES: { v: FixtureType; label: string }[] = [
  { v: "downlight", label: t("崁燈") },
  { v: "ceiling", label: t("吸頂燈") },
  { v: "pendant", label: t("吊燈") },
  { v: "wall", label: t("壁燈") },
  { v: "strip", label: t("燈條") },
  { v: "room", label: t("整間") },
];

const KINDS: { v: ItemKind; label: string }[] = [
  { v: "auto", label: t("自動") },
  { v: "light", label: t("燈") },
  { v: "climate", label: t("冷氣") },
  { v: "presence", label: t("人在") },
  { v: "cover", label: t("窗簾") },
  { v: "generic", label: t("通用") },
];

export function Sidebar(p: SidebarProps) {
  const { layout, hass, walls, selection } = p;
  if (selection?.kind === "room") {
    const room = layout.rooms.find((r) => r.id === selection.id);
    if (room) return <aside className="dh-side"><RoomPanel {...p} room={room} /></aside>;
  }
  if (selection?.kind === "item") {
    const item = layout.items.find((i) => i.id === selection.id);
    if (item) return <aside className="dh-side"><ItemPanel {...p} item={item} /></aside>;
  }
  if (selection?.kind === "furniture") {
    const f = (layout.furniture ?? []).find((x) => x.id === selection.id);
    if (f) return <aside className="dh-side"><FurniturePanel {...p} f={f} /></aside>;
  }
  if (selection?.kind === "walls") {
    const sel = walls.filter((w) => selection.ids.includes(w.id));
    if (sel.length) return <aside className="dh-side"><WallPanel {...p} selected={sel} /></aside>;
  }
  return <aside className="dh-side"><LayoutPanel {...p} /></aside>;
}

/* ---------- layout / nothing selected ---------- */

function LayoutPanel(p: SidebarProps) {
  const { layout, hass, walls } = p;
  const fileRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true);
    try {
      p.onCommit(setBackground(layout, await importBackground(f)));
    } catch (e) {
      p.onNotify?.({ text: (e as Error).message, kind: "error" });
    } finally {
      setBusy(false);
    }
  };


  const noRooms = layout.rooms.length === 0;
  return (
    <>
      {noRooms && (
        <section style={{ padding: "6px 0 10px" }}>
          <h3>{t("三步驟")}</h3>
          <ol className="dh-steps">
            <li>{t("（可選）上傳平面圖 PDF / JPG 當底圖，用「點選房間」點房間內部自動框出。")}</li>
            <li>{t("沒有底圖就用「矩形房間」：點一個角、再點對角。")}</li>
            <li>{t("點房間 → 連結 HA area → 加入裝置。")}</li>
          </ol>
        </section>
      )}

      <Section id="rooms" title={t("房間")} defaultOpen badge={layout.rooms.length || undefined}>
        {layout.rooms.length === 0 && <div className="dh-muted">{t("還沒有房間。用上方「矩形房間」工具畫一間。")}</div>}
        <ul className="dh-list">
          {layout.rooms.map((r) => (
            <li key={r.id} onClick={() => p.onSelect({ kind: "room", id: r.id })}>
              <span>{r.name}</span>
              <span className="dh-muted">{r.areaId ? hass.areas[r.areaId]?.name : t("未連結 area")}</span>
            </li>
          ))}
        </ul>
      
      </Section>

      <Section id="devices" title={t("加入裝置")} defaultOpen badge={layout.items.length || undefined}>
        <EntityPicker hass={hass} layout={layout} onAdd={(ids) => {
          const cx = layout.canvas.width / 2;
          const cy = layout.canvas.height / 2;
          const step = 0.6 / layout.metresPerUnit;
          const items = ids.map((id, i) => makeItem(hass, id, cx + (i % 4) * step, cy + Math.floor(i / 4) * step));
          p.onCommit(addItems(layout, items));
          if (items.length === 1) p.onSelect({ kind: "item", id: items[0].id });
        }} onRemove={(ids) => {
          const set = new Set(ids);
          p.onCommit({ ...layout, items: layout.items.filter((i) => !set.has(i.entityId)) });
          p.onNotify?.(t("已移除 {n} 個裝置，可用復原鍵還原", { n: ids.length }));
        }} onFocus={(id) => { const it = layout.items.find((i) => i.entityId === id); if (it) p.onSelect({ kind: "item", id: it.id }); }} />
        <div className="dh-muted" style={{ marginTop: 6 }}>{t("先選一間房間再加，會直接放進那間。")}</div>
      
      </Section>

      <Section id="furniture" title={t("家具（純裝飾）")} badge={(layout.furniture ?? []).length || undefined}>
        {FURNITURE_GROUPS.map((grp) => (
          <div key={grp} className="dh-row" style={{ marginBottom: 6 }}>
            <span className="dh-muted" style={{ width: 34 }}>{t(grp)}</span>
            {(Object.keys(FURNITURE) as FurnitureType[]).filter((ft) => FURNITURE[ft].group === grp).map((ft) => (
              <button key={ft} className="dh-btn small" onClick={() => {
                const f = makeFurniture(ft, layout.canvas.width / 2, layout.canvas.height / 2);
                p.onCommit(addFurniture(layout, f));
                p.onSelect({ kind: "furniture", id: f.id });
              }}>{t(FURNITURE[ft].label)}</button>
            ))}
          </div>
        ))}
        <div className="dh-muted">{t("先選一間房間再按，家具會放在那間房的中央。")}</div>
      
      </Section>

      <Section id="background" title={t("底圖與比例")} defaultOpen={noRooms}>
        <div className="dh-row">
          <button className="dh-btn" disabled={busy} onClick={() => fileRef.current?.click()}>{busy ? t("處理中…") : layout.background ? t("換底圖") : t("上傳 PDF / JPG")}</button>
          {layout.background && <button className="dh-btn" onClick={() => p.onCommit(setBackground(layout, null))}>{t("移除")}</button>}
          <input ref={fileRef} type="file" accept="image/*,application/pdf" hidden onChange={(e) => onFile(e.target.files?.[0])} />
        </div>
        {layout.background && (
          <div className="dh-field" style={{ marginTop: 8 }}>
            <label>{t("底圖透明度")}</label>
            <input type="range" min={0.1} max={1} step={0.05} value={layout.background.opacity ?? 0.6} onChange={(e) => p.onCommit({ ...layout, background: { ...layout.background!, opacity: Number(e.target.value) } })} />
          </div>
        )}
      
        <div style={{ height: 10 }} />
        <div className="dh-muted">{t("畫布寬 {w} m", { w: (layout.canvas.width * layout.metresPerUnit).toFixed(1) })}</div>
        <div className="dh-row" style={{ marginTop: 6 }}>
          <button className="dh-btn" onClick={p.onStartScale}>{t("用已知距離校正")}</button>
        </div>
        <div className="dh-field" style={{ marginTop: 8 }}>
          <label>{t("吸附格點 (m)")}</label>
          <select value={layout.grid} onChange={(e) => p.onCommit({ ...layout, grid: Number(e.target.value) })}>
            <option value={0}>{t("關閉")}</option>
            <option value={0.1}>0.1</option>
            <option value={0.25}>0.25</option>
            <option value={0.5}>0.5</option>
            <option value={1}>1</option>
          </select>
        </div>
      
      </Section>

      <Section id="walls" title={t("牆")} badge={t("{n} 面", { n: walls.length })}>
        <div className="dh-row">
          <NumberField label={t("外牆 (cm)")} value={layout.wallDefaults.exterior * 100} onChange={(v) => p.onCommit({ ...layout, wallDefaults: { ...layout.wallDefaults, exterior: v / 100 } })} />
          <NumberField label={t("內牆 (cm)")} value={layout.wallDefaults.interior * 100} onChange={(v) => p.onCommit({ ...layout, wallDefaults: { ...layout.wallDefaults, interior: v / 100 } })} />
          <NumberField label={t("牆高 (m)")} value={layout.wallDefaults.height} step={0.1} onChange={(v) => p.onCommit({ ...layout, wallDefaults: { ...layout.wallDefaults, height: v } })} />
        </div>
        <WallQuickSelect walls={walls} onSelect={p.onSelect} />
        <div className="dh-muted" style={{ marginTop: 4 }}>{t("{a} 面牆，{b} 面自訂厚度，{c} 面虛擬", { a: walls.length, b: Object.keys(layout.wallThickness).length, c: walls.filter((w) => w.virtual).length })}</div>
      
      </Section>

      <Section id="view3d" title="3D">
        <label className="dh-row" style={{ cursor: "pointer" }}>
          <input type="checkbox" style={{ width: "auto" }} checked={layout.labels3d !== false} onChange={(e) => p.onCommit({ ...layout, labels3d: e.target.checked })} />
          <span>{t("顯示感測數值標籤")}</span>
        </label>
        <div className="dh-muted">{t("感測器很多時關掉會清爽很多；燈、冷氣、窗簾不受影響。")}</div>
      
      </Section>

      {(() => {
        const dead = layout.items.filter((i) => { const st = hass.states[i.entityId]?.state; return !st || st === "unavailable" || st === "unknown"; });
        return dead.length > 0 ? (
          <section>
            <h3>{t("清理")}</h3>
            <button className="dh-btn" onClick={() => p.onCommit({ ...layout, items: layout.items.filter((i) => !dead.includes(i)) })}>{t("移除 {n} 個 unavailable 的裝置", { n: dead.length })}</button>
            <div className="dh-muted">{t("狀態是 unavailable / unknown 的圖示只會疊在一起，之後自動填入也不會再加它們。")}</div>
          </section>
        ) : null;
      })()}

      <Section id="files" title={t("檔案")}>
        <div className="dh-row">
          <button className="dh-btn" onClick={p.onExport}>{t("匯出 JSON")}</button>
          <button className="dh-btn" onClick={() => importRef.current?.click()}>{t("匯入 JSON")}</button>
          <input ref={importRef} type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && p.onImport(e.target.files[0])} />
        </div>
        <div className="dh-field" style={{ marginTop: 10 }}>
          <label>{t("語言")}</label>
          <div className="dh-row">
            {([["", t("跟隨 HA")], ["zh-Hant", "中文"], ["en", "English"]] as const).map(([v, label]) => (
              <button key={v} className={`dh-btn small${(readLangOverride() ?? "") === v ? " on" : ""}`} onClick={() => { writeLangOverride(v ? (v as Lang) : null); setLang(v ? (v as Lang) : langFromHass(hass.language)); }}>{label}</button>
            ))}
          </div>
        </div>
      
      </Section>

      <section>
        <div className="dh-muted">Dollhouse v{VERSION} · WebGL {webglOk() ? t("可用") : t("不可用")} · {t("視窗")} {typeof window !== "undefined" ? `${window.innerWidth}×${window.innerHeight}` : ""}</div>
      </section>
    </>
  );
}

let webglCache: boolean | null = null;
function webglOk(): boolean {
  if (webglCache !== null) return webglCache;
  try {
    const c = document.createElement("canvas");
    webglCache = !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    webglCache = false;
  }
  return webglCache;
}

function WallQuickSelect({ walls, onSelect }: { walls: Wall[]; onSelect: (s: Selection) => void }) {
  const pick = (f: (w: Wall) => boolean) => onSelect({ kind: "walls", ids: walls.filter(f).map((w) => w.id) });
  return (
    <div className="dh-row" style={{ marginTop: 8 }}>
      <button className="dh-btn small" disabled={!walls.length} onClick={() => pick(() => true)}>{t("全選牆")}</button>
      <button className="dh-btn small" disabled={!walls.length} onClick={() => pick((w) => w.exterior)}>{t("全部外牆")}</button>
      <button className="dh-btn small" disabled={!walls.length} onClick={() => pick((w) => !w.exterior)}>{t("全部內牆")}</button>
      {walls.some((w) => w.virtual) && <button className="dh-btn small" onClick={() => pick((w) => w.virtual)}>{t("全部虛擬")}</button>}
    </div>
  );
}

/* ---------- walls selected ---------- */

function WallPanel(p: SidebarProps & { selected: Wall[] }) {
  const { layout, walls, selected } = p;
  const first = selected[0].thickness;
  const uniform = selected.every((w) => Math.abs(w.thickness - first) < 1e-9);
  const [cm, setCm] = useState(() => Math.round(first * 100));
  const ids = selected.map((w) => w.id);
  const ext = selected.filter((w) => w.exterior).length;
  const virt = selected.filter((w) => w.virtual).length;
  return (
    <>
      <PanelHeader title={t("已選 {n} 面牆", { n: selected.length })} onBack={() => p.onSelect(null)} />
      <section>
        <div className="dh-row" style={{ marginBottom: 8 }}>
          <button className={`dh-btn small${p.wallMulti ? " on" : ""}`} onClick={() => p.onWallMulti?.(!p.wallMulti)}>{p.wallMulti ? t("多選中：點牆加選 / 取消") : t("多選（點牆加入）")}</button>
        </div>
        <div className="dh-muted">{t("{a} 面外牆、{b} 面內牆", { a: ext, b: selected.length - ext })}{virt ? t("，{n} 面虛擬", { n: virt }) : ""}{t("，目前厚度 {v}", { v: uniform ? `${Math.round(first * 100)} cm` : t("不一致") })}</div>
        <div className="dh-field" style={{ marginTop: 8 }}>
          <label>{t("實牆 / 虛擬區隔")}</label>
          <div className="dh-row">
            <button className={`dh-btn small${virt === 0 ? " on" : ""}`} onClick={() => p.onCommit(applyVirtual(layout, ids, false))}>{t("實牆")}</button>
            <button className={`dh-btn small${virt === selected.length ? " on" : ""}`} onClick={() => p.onCommit(applyVirtual(layout, ids, true))}>{t("虛擬（開放空間）")}</button>
          </div>
          <div className="dh-muted">{t("虛擬區隔只用來分房間與 area，不畫牆。例如開放式廚房和客廳之間。")}</div>
        </div>
        <div className="dh-field" style={{ marginTop: 8 }}>
          <label>{t("設定厚度 (cm)")}</label>
          <div className="dh-row">
            <input type="number" min={3} max={80} step={1} value={cm} onChange={(e) => setCm(Number(e.target.value))} style={{ width: 90 }} onKeyDown={(e) => e.key === "Enter" && p.onCommit(applyThickness(layout, ids, cm / 100))} />
            <button className="dh-btn on" onClick={() => p.onCommit(applyThickness(layout, ids, cm / 100))}>{t("套用到 {n} 面", { n: selected.length })}</button>
          </div>
        </div>
        <div className="dh-row">
          {[8, 10, 12, 15, 20, 24, 30].map((v) => <button key={v} className="dh-btn small" onClick={() => { setCm(v); p.onCommit(applyThickness(layout, ids, v / 100)); }}>{v}</button>)}
        </div>
        <div className="dh-row" style={{ marginTop: 8 }}>
          <button className="dh-btn small" onClick={() => p.onCommit(resetThickness(layout, ids))}>{t("回到預設")}</button>
          <button className="dh-btn small" onClick={() => p.onSelect(null)}>{t("取消選取")}</button>
        </div>
      </section>
      <section>
        <h3>{t("快速選取")}</h3>
        <WallQuickSelect walls={walls} onSelect={p.onSelect} />
        <div className="dh-muted" style={{ marginTop: 6 }}>{t("開「多選」後點牆可加選或取消；桌機也可以 Shift+點。")}</div>
      </section>
    </>
  );
}

/* ---------- room selected ---------- */

function RoomPanel(p: SidebarProps & { room: Room }) {
  const { layout, hass, room } = p;
  const areaEntities = room.areaId ? entitiesInArea(hass, room.areaId) : [];
  const placed = new Set(layout.items.map((i) => i.entityId));
  const missing = areaEntities.filter((e) => !placed.has(e));
  const areas = Object.values(hass.areas).sort((a, b) => a.name.localeCompare(b.name));
  return (
    <>
      <PanelHeader title={room.name} subtitle={room.areaId ? t("area：{name}", { name: hass.areas[room.areaId]?.name ?? room.areaId }) : t("未連結 area")} onBack={() => p.onSelect(null)} />
      <section>
        <TextField label={t("名稱")} value={room.name} onSave={(v) => p.onCommit(updateRoom(layout, room.id, { name: v }))} />
        <div className="dh-field">
          <label>Home Assistant area</label>
          <select value={room.areaId ?? ""} onChange={(e) => {
            const areaId = e.target.value || null;
            const area = areaId ? hass.areas[areaId] : null;
            const rename = area && /^(房間|Room) \d+$/.test(room.name) ? { name: area.name } : {};
            p.onCommit(updateRoom(layout, room.id, { areaId, ...rename }));
          }}>
            <option value="">{t("未連結")}</option>
            {areas.map((a) => <option key={a.area_id} value={a.area_id}>{a.name}</option>)}
          </select>
        </div>
        {room.areaId && (
          <div className="dh-row">
            <button className="dh-btn on" disabled={missing.length === 0} onClick={() => p.onCommit(addItems(layout, autoPlace(hass, room, missing, layout.items, 1.0 / layout.metresPerUnit, p.walls)))}>{t("填入 {n} 個裝置", { n: missing.length })}</button>
            <span className="dh-muted">{areaEntities.length - missing.length}/{areaEntities.length} {t("已放")}</span>
          </div>
        )}
        <div className="dh-row" style={{ marginTop: 10 }}>
          <NumberField label={t("天花板高 (m)")} value={room.height ?? layout.wallDefaults.height} step={0.1} onChange={(v) => p.onCommit(updateRoom(layout, room.id, { height: v }))} />
          <div className="dh-field"><label>{t("地板色")}</label><input type="color" value={room.color ?? "#f8fafc"} onChange={(e) => p.onCommit(updateRoom(layout, room.id, { color: e.target.value }))} /></div>
        </div>
        <div className="dh-muted">{t("面積約 {a} m²，{n} 個頂點（選取後可拖頂點）", { a: (Math.abs(area(room)) * layout.metresPerUnit ** 2).toFixed(1), n: room.points.length })}{layout.locked ? " · " + t("平面圖已鎖定") : ""}</div>
        <div className="dh-row" style={{ marginTop: 10 }}>
          <button className="dh-btn danger" disabled={!!layout.locked} title={layout.locked ? t("平面圖已鎖定") : undefined} onClick={() => { p.onCommit(removeRoom(layout, room.id)); p.onSelect(null); p.onNotify?.(t("已刪除房間，可用工具列的復原鍵還原")); }}>{t("刪除房間")}</button>
        </div>
      </section>
      <section>
        <h3>{t("在這間加家具")}</h3>
        {FURNITURE_GROUPS.map((grp) => (
          <div key={grp} className="dh-row" style={{ marginBottom: 6 }}>
            <span className="dh-muted" style={{ width: 34 }}>{t(grp)}</span>
            {(Object.keys(FURNITURE) as FurnitureType[]).filter((ft) => FURNITURE[ft].group === grp).map((ft) => (
              <button key={ft} className="dh-btn small" onClick={() => {
                const c = centroid(room.points);
                const f = makeFurniture(ft, c[0], c[1]);
                p.onCommit(addFurniture(layout, f));
                p.onSelect({ kind: "furniture", id: f.id });
              }}>{t(FURNITURE[ft].label)}</button>
            ))}
          </div>
        ))}
      </section>
      {(() => {
        const inside = layout.items.filter((i) => pointInPolygon([i.x, i.y], room.points));
        const dead = (id: string) => { const st = hass.states[id]?.state; return !st || st === "unavailable" || st === "unknown"; };
        const removeIds = (ids: string[]) => {
          const set = new Set(ids);
          p.onCommit({ ...layout, items: layout.items.filter((i) => !set.has(i.id)) });
          p.onNotify?.(t("已移除 {n} 個裝置，可用復原鍵還原", { n: ids.length }));
        };
        return (
          <section>
            <div className="dh-row" style={{ justifyContent: "space-between" }}>
              <h3 style={{ margin: 0 }}>{t("這間裡的裝置 ({n})", { n: inside.length })}</h3>
              <span className="dh-row">
                {inside.some((i) => dead(i.entityId)) && <button className="dh-btn small" onClick={() => removeIds(inside.filter((i) => dead(i.entityId)).map((i) => i.id))}>{t("移除 unavailable")}</button>}
                {inside.length > 0 && <button className="dh-btn small danger" onClick={() => removeIds(inside.map((i) => i.id))}>{t("整間清空")}</button>}
              </span>
            </div>
            {inside.length === 0 && <div className="dh-muted">{t("還沒有裝置放在這間。")}</div>}
            <ul className="dh-list">
              {inside.map((i) => (
                <li key={i.id} style={{ gap: 6 }}>
                  <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "pointer" }} onClick={() => p.onSelect({ kind: "item", id: i.id })} title={t("在畫布上選取")}>
                    {friendlyName(hass, i.entityId)}
                    <span className={dead(i.entityId) ? "dh-muted" : "dh-muted"} style={{ marginLeft: 6, fontSize: 11, color: dead(i.entityId) ? "#dc2626" : undefined }}>{hass.states[i.entityId]?.state ?? "unavailable"}</span>
                  </span>
                  <button className="dh-btn small danger" onClick={() => removeIds([i.id])}>{t("移除")}</button>
                </li>
              ))}
            </ul>
            <div className="dh-muted">{t("依圖示實際位置判斷，不看 area。")}</div>
          </section>
        );
      })()}

      <section>
        <h3>{t("加入裝置到這間")}</h3>
        <EntityPicker hass={hass} layout={layout} room={room} onAdd={(ids) => {
          const items = autoPlace(hass, room, ids, layout.items, 1.0 / layout.metresPerUnit, p.walls);
          p.onCommit(addItems(layout, items));
          if (items.length === 1) p.onSelect({ kind: "item", id: items[0].id });
        }} onRemove={(ids) => {
          const set = new Set(ids);
          p.onCommit({ ...layout, items: layout.items.filter((i) => !set.has(i.entityId)) });
          p.onNotify?.(t("已移除 {n} 個裝置，可用復原鍵還原", { n: ids.length }));
        }} onFocus={(id) => { const it = layout.items.find((i) => i.entityId === id); if (it) p.onSelect({ kind: "item", id: it.id }); }} />
      </section>
    </>
  );
}

/* ---------- item selected ---------- */

function ItemPanel(p: SidebarProps & { item: Item }) {
  const { layout, hass, item } = p;
  const kind = resolveKind(item, hass);
  const s = hass.states[item.entityId];
  const attrs = s ? Object.keys(s.attributes).filter((a) => !["friendly_name", "icon", "supported_features", "supported_color_modes"].includes(a)) : [];
  return (
    <section>
      <PanelHeader title={friendlyName(hass, item.entityId)} subtitle={t("{id} · 狀態 {state}", { id: item.entityId, state: s?.state ?? "unknown" })} onBack={() => p.onSelect(null)} />
      <div className="dh-field">
        <label>{t("顯示方式")}</label>
        <select value={item.kind} onChange={(e) => p.onCommit(updateItem(layout, item.id, { kind: e.target.value as ItemKind }))}>
          {KINDS.map((k) => <option key={k.v} value={k.v}>{t(k.label)}{k.v === "auto" ? t("（{v}）", { v: t(KINDS.find((x) => x.v === kind)?.label ?? "") }) : ""}</option>)}
        </select>
      </div>
      {kind === "light" && (
        <div className="dh-field">
          <label>{t("燈具型式")}</label>
          <div className="dh-row">
            {FIXTURES.map((f) => <button key={f.v} className={`dh-btn small${(item.fixture ?? "downlight") === f.v ? " on" : ""}`} onClick={() => p.onCommit(updateItem(layout, item.id, { fixture: f.v }))}>{t(f.label)}</button>)}
          </div>
        </div>
      )}
      {kind === "light" && (
        <div className="dh-field">
          <label>{t("顏色")} {item.color ? t("（使用者指定）") : t("（跟 HA 同步）")}</label>
          <div className="dh-row">
            <button className={`dh-btn small${!item.color ? " on" : ""}`} onClick={() => p.onCommit(updateItem(layout, item.id, { color: null }))}>{t("自動")}</button>
            {KELVIN_PRESETS.map((k) => {
              const hex = kelvinToHex(k.k);
              return <button key={k.k} className={`dh-btn small${item.color === hex ? " on" : ""}`} style={{ background: item.color === hex ? undefined : hex }} onClick={() => p.onCommit(updateItem(layout, item.id, { color: hex }))}>{t(k.label)}</button>;
            })}
            <input type="color" value={item.color ?? lightColor(hass, item.entityId) .replace(/^rgb\((\d+),(\d+),(\d+)\)$/, (_m, r, g, b) => "#" + [r, g, b].map((v: string) => Number(v).toString(16).padStart(2, "0")).join(""))} onChange={(e) => p.onCommit(updateItem(layout, item.id, { color: e.target.value }))} title={t("自訂顏色")} />
          </div>
          <div className="dh-muted">{t("只有開關的燈（Shelly、Sonoff）在這裡指定色溫或顏色；有色溫或彩色的燈不設定就跟 HA 同步。")}</div>
        </div>
      )}
      {kind === "cover" && (() => {
        const v = coverView(hass, item);
        const guessed = guessCoverStyle(hass, item.entityId);
        const STYLES: { v: CoverStyle; label: string }[] = [{ v: "curtain", label: t("橫拉") }, { v: "roller", label: t("上下") }, { v: "blind", label: t("百葉") }];
        return (
          <>
            <div className="dh-field">
              <label>{t("窗簾型式")} {item.coverStyle ? t("（使用者指定）") : t("（依屬性判斷：{v}）", { v: t(STYLES.find((s) => s.v === guessed)?.label ?? "") })}</label>
              <div className="dh-row">
                <button className={`dh-btn small${!item.coverStyle ? " on" : ""}`} onClick={() => p.onCommit(updateItem(layout, item.id, { coverStyle: null }))}>{t("自動")}</button>
                {STYLES.map((s) => <button key={s.v} className={`dh-btn small${item.coverStyle === s.v ? " on" : ""}`} onClick={() => p.onCommit(updateItem(layout, item.id, { coverStyle: s.v }))}>{t(s.label)}</button>)}
              </div>
            </div>
            {(item.coverStyle ?? guessed) === "curtain" && (() => {
              const DRAWS: { v: CoverDraw; label: string }[] = [{ v: "center", label: t("對開") }, { v: "left", label: t("左收") }, { v: "right", label: t("右收") }];
              return (
                <div className="dh-field">
                  <label>{t("開法（站在房間內看窗）")}</label>
                  <div className="dh-row">
                    {DRAWS.map((d) => <button key={d.v} className={`dh-btn small${(item.coverDraw ?? "center") === d.v ? " on" : ""}`} onClick={() => p.onCommit(updateItem(layout, item.id, { coverDraw: d.v }))}>{t(d.label)}</button>)}
                  </div>
                </div>
              );
            })()}
            <div className="dh-field">
              <label>{t("窗寬 (m)")}</label>
              <div className="dh-row">
                <input type="number" min={0.3} max={20} step={0.1} style={{ width: 90 }} value={item.length ?? 1.5} onChange={(e) => { const v2 = Number(e.target.value); if (v2 > 0) p.onCommit(updateItem(layout, item.id, { length: v2 })); }} />
                {[1, 1.5, 2, 3, 4].map((L) => <button key={L} className={`dh-btn small${(item.length ?? 1.5) === L ? " on" : ""}`} onClick={() => p.onCommit(updateItem(layout, item.id, { length: L }))}>{L}</button>)}
              </div>
            </div>
            <div className="dh-field">
              <label>{t("方向 (°)，拖到牆邊會自動貼齊")}</label>
              <div className="dh-row">
                <input type="number" step={15} style={{ width: 90 }} value={item.rotation ?? 0} onChange={(e) => p.onCommit(updateItem(layout, item.id, { rotation: Number(e.target.value) || 0 }))} />
                {[0, 90].map((r) => <button key={r} className={`dh-btn small${(item.rotation ?? 0) === r ? " on" : ""}`} onClick={() => p.onCommit(updateItem(layout, item.id, { rotation: r }))}>{r === 0 ? t("橫") : t("直")}</button>)}
              </div>
            </div>
            <div className="dh-muted">{t("目前開 {n}%", { n: Math.round(v.open * 100) })}{v.style === "blind" ? t("，葉片 {n}%", { n: Math.round(v.tilt * 100) }) : ""}{t("。點圖示開關，雙擊拉到指定位置。")}</div>
          </>
        );
      })()}
      {kind === "light" && item.fixture !== "room" && item.fixture !== "strip" && (() => {
        const r = item.repeat ?? { count: 1, pattern: "row" as const, spacing: 0.8 };
        const setR = (patch: Partial<typeof r>) => p.onCommit(updateItem(layout, item.id, { repeat: { ...r, ...patch } }));
        return (
          <div className="dh-field">
            <label>{t("燈組（一個開關帶多顆燈）")}</label>
            {r.pattern !== "grid" && (
              <div className="dh-row">
                <span className="dh-muted">{t("數量")}</span>
                {[1, 2, 3, 4, 6, 8].map((n) => <button key={n} className={`dh-btn small${r.count === n ? " on" : ""}`} onClick={() => setR({ count: n })}>{n}</button>)}
                <input type="number" min={1} max={40} style={{ width: 60 }} value={r.count} onChange={(e) => { const n = Math.max(1, Math.min(40, Number(e.target.value) || 1)); setR({ count: n }); }} />
              </div>
            )}
            <div className="dh-row" style={{ marginTop: 6 }}>
              <button className={`dh-btn small${r.pattern === "row" ? " on" : ""}`} onClick={() => setR({ pattern: "row" })}>{t("一排")}</button>
              <button className={`dh-btn small${r.pattern === "grid" ? " on" : ""}`} onClick={() => setR({ pattern: "grid", rows: r.rows ?? 2, cols: r.cols ?? 2, count: (r.rows ?? 2) * (r.cols ?? 2) })}>{t("矩陣")}</button>
              {r.pattern === "grid" && [[2, 2], [2, 3], [3, 3], [2, 4]].map(([rr, cc]) => (
                <button key={`${rr}x${cc}`} className={`dh-btn small${(r.rows ?? 0) === rr && (r.cols ?? 0) === cc ? " on" : ""}`} onClick={() => setR({ rows: rr, cols: cc, count: rr * cc })}>{rr}×{cc}</button>
              ))}
            </div>
            {r.pattern === "grid" && (
              <div className="dh-row" style={{ marginTop: 6 }}>
                <span className="dh-muted">{t("列")}</span>
                <input type="number" min={1} max={10} style={{ width: 56 }} value={r.rows ?? 2} onChange={(e) => { const rr = Math.max(1, Math.min(10, Number(e.target.value) || 1)); setR({ rows: rr, count: rr * (r.cols ?? 2) }); }} />
                <span className="dh-muted">×</span>
                <span className="dh-muted">{t("欄")}</span>
                <input type="number" min={1} max={10} style={{ width: 56 }} value={r.cols ?? 2} onChange={(e) => { const cc = Math.max(1, Math.min(10, Number(e.target.value) || 1)); setR({ cols: cc, count: (r.rows ?? 2) * cc }); }} />
                <span className="dh-muted">{t("間距 橫 / 縱 (m)")}</span>
                <input type="number" min={0.2} max={5} step={0.1} style={{ width: 60 }} value={r.spacing} onChange={(e) => { const v = Number(e.target.value); if (v > 0) setR({ spacing: v }); }} />
                <input type="number" min={0.2} max={5} step={0.1} style={{ width: 60 }} value={r.spacingY ?? r.spacing} onChange={(e) => { const v = Number(e.target.value); if (v > 0) setR({ spacingY: v }); }} />
              </div>
            )}
            {(r.count > 1 || r.pattern === "grid") && (
              <div className="dh-row" style={{ marginTop: 6 }}>
                {r.pattern === "row" && <><span className="dh-muted">{t("間距 (m)")}</span>
                <input type="number" min={0.2} max={5} step={0.1} style={{ width: 64 }} value={r.spacing} onChange={(e) => { const v = Number(e.target.value); if (v > 0) setR({ spacing: v }); }} /></>}
                <span className="dh-muted">{t("方向 (°)")}</span>
                <input type="number" step={15} style={{ width: 64 }} value={item.rotation ?? 0} onChange={(e) => p.onCommit(updateItem(layout, item.id, { rotation: Number(e.target.value) || 0 }))} />
                {[0, 90].map((v) => <button key={v} className={`dh-btn small${(item.rotation ?? 0) === v ? " on" : ""}`} onClick={() => p.onCommit(updateItem(layout, item.id, { rotation: v }))}>{v === 0 ? t("橫") : t("直")}</button>)}
              </div>
            )}
            <div className="dh-muted">{t("燈本身沒有進 HA、只有 Shelly / Sonoff 的開關時，用這裡畫出實際的幾顆燈；狀態跟著這個開關。")}</div>
          </div>
        );
      })()}
      {kind === "light" && item.fixture === "strip" && (
        <div className="dh-field">
          <label>{t("燈條長度 (m)")}</label>
          <div className="dh-row">
            <input type="number" min={0.1} max={20} step={0.1} style={{ width: 90 }} value={item.length ?? 1} onChange={(e) => { const v = Number(e.target.value); if (v > 0) p.onCommit(updateItem(layout, item.id, { length: v })); }} />
            {[0.5, 1, 1.5, 2, 3, 4].map((v) => <button key={v} className={`dh-btn small${(item.length ?? 1) === v ? " on" : ""}`} onClick={() => p.onCommit(updateItem(layout, item.id, { length: v }))}>{v}</button>)}
          </div>
        </div>
      )}
      {hasBeam(item, hass) && (() => {
        const BEAMS: { v: Beam; label: string }[] = [{ v: "down", label: t("向下") }, { v: "up", label: t("向上") }, { v: "both", label: t("上下") }];
        const d = defaultBeam(item, hass);
        return (
          <div className="dh-field">
            <label>{t("投光方向")} {item.beam ? "" : t("（預設 {v}）", { v: t(BEAMS.find((b) => b.v === d)?.label ?? "") })}</label>
            <div className="dh-row">
              <button className={`dh-btn small${!item.beam ? " on" : ""}`} onClick={() => p.onCommit(updateItem(layout, item.id, { beam: null }))}>{t("自動")}</button>
              {BEAMS.map((b) => <button key={b.v} className={`dh-btn small${item.beam === b.v ? " on" : ""}`} onClick={() => p.onCommit(updateItem(layout, item.id, { beam: b.v }))}>{t(b.label)}</button>)}
            </div>
            <div className="dh-muted">{item.fixture === "strip" ? t("牆面層板燈向上打天花板，天花板或櫃下燈條向下打。牆面安裝的燈條拖到牆邊會自動貼齊。") : t("壁燈預設上下都打。")}</div>
          </div>
        );
      })()}
      {kind === "light" && (item.fixture === "wall" || item.fixture === "strip") && (
        <div className="dh-field">
          <label>{t("旋轉 (°)")}</label>
          <div className="dh-row">
            <input type="number" step={15} style={{ width: 90 }} value={item.rotation ?? 0} onChange={(e) => p.onCommit(updateItem(layout, item.id, { rotation: Number(e.target.value) || 0 }))} />
            {[0, 90].map((v) => <button key={v} className={`dh-btn small${(item.rotation ?? 0) === v ? " on" : ""}`} onClick={() => p.onCommit(updateItem(layout, item.id, { rotation: v }))}>{v === 0 ? t("橫") : t("直")}</button>)}
          </div>
        </div>
      )}
      {kind === "generic" && (
        <>
          <div className="dh-field">
            <label>{t("顯示的值")}</label>
            <select value={item.attribute ?? ""} onChange={(e) => p.onCommit(updateItem(layout, item.id, { attribute: e.target.value || null }))}>
              <option value="">{t("狀態 (state)")}</option>
              {attrs.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <TextField label={t("標籤")} value={item.label ?? ""} placeholder={friendlyName(hass, item.entityId)} onSave={(v) => p.onCommit(updateItem(layout, item.id, { label: v || null }))} />
        </>
      )}
      {kind !== "cover" && (() => {
        const ceiling = layout.wallDefaults.height;
        const dm = defaultMount(item, hass);
        const cur = item.mount ?? dm;
        const MOUNTS: { v: Mount; label: string }[] = [{ v: "ceiling", label: t("天花板") }, { v: "wall", label: t("牆面") }, { v: "floor", label: t("地面") }];
        const h = effectiveHeight(item, hass, ceiling);
        return (
          <div className="dh-field">
            <label>{t("安裝高度")} {item.z != null ? t("（自訂 {h} m）", { h: h.toFixed(2) }) : item.mount ? t("（{v} {h} m）", { v: t(MOUNTS.find((x) => x.v === cur)?.label ?? ""), h: h.toFixed(2) }) : t("（預設 {v} {h} m）", { v: t(MOUNTS.find((x) => x.v === dm)?.label ?? ""), h: h.toFixed(2) })}</label>
            <div className="dh-row">
              {MOUNTS.map((mo) => (
                <button key={mo.v} className={`dh-btn small${cur === mo.v && item.z == null ? " on" : ""}`} title={`${mountHeight(item, mo.v, hass, ceiling).toFixed(2)} m`} onClick={() => p.onCommit(updateItem(layout, item.id, { mount: mo.v, z: null }))}>{t(mo.label)}</button>
              ))}
              <input type="number" min={0} max={ceiling} step={0.05} style={{ width: 80 }} value={Math.round(h * 100) / 100} onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v)) p.onCommit(updateItem(layout, item.id, { z: Math.min(ceiling, Math.max(0, v)) })); }} />
              <span className="dh-muted">m</span>
            </div>
          </div>
        );
      })()}
      <div className="dh-row" style={{ marginTop: 6 }}>
        <button className={`dh-btn small${p.placing ? " on" : ""}`} onClick={() => p.onPlacing?.(!p.placing)}>{p.placing ? t("點畫布放置…") : t("移到點的位置")}</button>
        <span className="dh-muted">{t("位置 ({x}, {y}) m", { x: (item.x * layout.metresPerUnit).toFixed(2), y: (item.y * layout.metresPerUnit).toFixed(2) })}</span>
      </div>
      <div className="dh-row" style={{ marginTop: 10 }}>
        <button className="dh-btn" onClick={() => { const c = { ...item, id: newId("i"), x: item.x + 0.5 / layout.metresPerUnit, y: item.y + 0.5 / layout.metresPerUnit }; p.onCommit(addItems(layout, [c])); p.onSelect({ kind: "item", id: c.id }); }} title={t("同一個 entity 再放一顆，狀態同步")}>{t("複製")}</button>
        <button className="dh-btn danger" onClick={() => { p.onCommit(removeItem(layout, item.id)); p.onSelect(null); p.onNotify?.(t("已移除裝置，可用復原鍵還原")); }}>{t("移除")}</button>
      </div>
    </section>
  );
}

/* ---------- furniture selected ---------- */

function FurniturePanel(p: SidebarProps & { f: Furniture }) {
  const { layout, f } = p;
  const spec = FURNITURE[f.type];
  const set = (patch: Partial<Furniture>) => p.onCommit(updateFurniture(layout, f.id, patch));
  return (
    <section>
      <PanelHeader title={f.label || t(spec.label)} subtitle={t("家具")} onBack={() => p.onSelect(null)} />
      <div className="dh-field">
        <label>{t("種類")}</label>
        <select value={f.type} onChange={(e) => { const ft = e.target.value as FurnitureType; const s = FURNITURE[ft]; set({ type: ft, w: s.w, d: s.d, h: s.h, color: s.color }); }}>
          {(Object.keys(FURNITURE) as FurnitureType[]).map((ft) => <option key={ft} value={ft}>{t(FURNITURE[ft].label)}</option>)}
        </select>
      </div>
      <div className="dh-row">
        <NumberField label={t("寬 (m)")} value={f.w} step={0.1} onChange={(v) => v > 0 && set({ w: v })} />
        <NumberField label={t("深 (m)")} value={f.d} step={0.1} onChange={(v) => v > 0 && set({ d: v })} />
        <NumberField label={t("高 (m)")} value={f.h} step={0.05} onChange={(v) => v >= 0 && set({ h: v })} />
      </div>
      <div className="dh-field">
        <label>{t("方向")}</label>
        <div className="dh-row">
          {[0, 90, 180, 270].map((r) => <button key={r} className={`dh-btn small${f.rotation === r ? " on" : ""}`} onClick={() => set({ rotation: r })}>{r}°</button>)}
          <input type="number" step={15} style={{ width: 70 }} value={f.rotation} onChange={(e) => set({ rotation: Number(e.target.value) || 0 })} />
        </div>
      </div>
      <div className="dh-row">
        <div className="dh-field"><label>{t("顏色")}</label><input type="color" value={f.color} onChange={(e) => set({ color: e.target.value })} /></div>
        <button className="dh-btn small" style={{ marginTop: 16 }} onClick={() => set({ w: spec.w, d: spec.d, h: spec.h, color: spec.color })}>{t("回預設尺寸")}</button>
      </div>
      <TextField label={t("標籤（選填）")} value={f.label ?? ""} placeholder={t(spec.label)} onSave={(v) => set({ label: v || null })} />
      <div className="dh-row">
        <button className={`dh-btn small${p.placing ? " on" : ""}`} onClick={() => p.onPlacing?.(!p.placing)}>{p.placing ? t("點畫布放置…") : t("移到點的位置")}</button>
        <span className="dh-muted">{t("或直接拖曳；Shift 拖曳不吸附格點。")}</span>
      </div>
      <div className="dh-row" style={{ marginTop: 10 }}>
        <button className="dh-btn" onClick={() => { const c = makeFurniture(f.type, f.x + 0.3 / layout.metresPerUnit, f.y + 0.3 / layout.metresPerUnit); p.onCommit(addFurniture(layout, { ...c, w: f.w, d: f.d, h: f.h, color: f.color, rotation: f.rotation })); p.onSelect({ kind: "furniture", id: c.id }); }}>{t("複製")}</button>
        <button className="dh-btn danger" onClick={() => { p.onCommit(removeFurniture(layout, f.id)); p.onSelect(null); p.onNotify?.(t("已刪除家具，可用復原鍵還原")); }}>{t("刪除")}</button>
      </div>
    </section>
  );
}

/** Text input with a draft: Enter / 儲存 commits, Esc / 取消 reverts. Nothing is written while typing. */
export function TextField({ label, value, placeholder, onSave }: { label: string; value: string; placeholder?: string; onSave: (v: string) => void }) {
  const [draft, setDraft] = useState(value);
  const [base, setBase] = useState(value);
  if (base !== value) { setBase(value); setDraft(value); } // external change (undo, selection switch)
  const dirty = draft !== value;
  const save = () => { if (dirty) onSave(draft); };
  const cancel = () => setDraft(value);
  return (
    <div className="dh-field">
      <label>{label}{dirty ? t("（未儲存）") : ""}</label>
      <div className="dh-row" style={{ flexWrap: "nowrap" }}>
        <input
          style={{ flex: 1, minWidth: 0 }}
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); save(); } else if (e.key === "Escape") { e.preventDefault(); cancel(); } }}
        />
        {dirty && <button className="dh-btn small on" onClick={save}>{t("儲存")}</button>}
        {dirty && <button className="dh-btn small" onClick={cancel}>{t("取消")}</button>}
      </div>
    </div>
  );
}

function NumberField({ label, value, step = 1, onChange }: { label: string; value: number; step?: number; onChange: (v: number) => void }) {
  return (
    <div className="dh-field" style={{ width: 90 }}>
      <label>{label}</label>
      <input type="number" step={step} value={Number.isFinite(value) ? Math.round(value * 100) / 100 : 0} onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v)) onChange(v); }} />
    </div>
  );
}

function area(room: Room): number {
  let s = 0;
  const pts = room.points;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    s += x1 * y2 - x2 * y1;
  }
  return s / 2;
}

type Room = Layout["rooms"][number];
