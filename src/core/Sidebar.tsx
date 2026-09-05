import { useRef, useState } from "react";
import type { FixtureType, Item, ItemKind, Layout, Wall } from "../domain/types";
import { autoPlace, entitiesInArea, makeItem, PLACEABLE_DOMAINS, resolveKind } from "../domain/entities";
import { domainOf, friendlyName, type HassLike } from "../ha/types";
import { importBackground } from "./background";
import { KELVIN_PRESETS, kelvinToHex, lightColor } from "./markers";
import { addItems, applyThickness, removeItem, removeRoom, resetThickness, setBackground, updateItem, updateRoom, type Selection } from "./useEditor";

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
}

const FIXTURES: { v: FixtureType; label: string }[] = [
  { v: "downlight", label: "崁燈" },
  { v: "ceiling", label: "吸頂燈" },
  { v: "pendant", label: "吊燈" },
  { v: "wall", label: "壁燈" },
  { v: "strip", label: "燈條" },
];

const KINDS: { v: ItemKind; label: string }[] = [
  { v: "auto", label: "自動" },
  { v: "light", label: "燈" },
  { v: "climate", label: "冷氣" },
  { v: "presence", label: "人在" },
  { v: "generic", label: "通用" },
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
  const [addEntity, setAddEntity] = useState("");

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true);
    try {
      p.onCommit(setBackground(layout, await importBackground(f)));
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const allEntities = Object.keys(hass.states).filter((id) => PLACEABLE_DOMAINS.has(domainOf(id))).sort();
  const placed = new Set(layout.items.map((i) => i.entityId));

  return (
    <>
      <section>
        <h3>底圖</h3>
        <div className="dh-row">
          <button className="dh-btn" disabled={busy} onClick={() => fileRef.current?.click()}>{busy ? "處理中…" : layout.background ? "換底圖" : "上傳 PDF / JPG"}</button>
          {layout.background && <button className="dh-btn" onClick={() => p.onCommit(setBackground(layout, null))}>移除</button>}
          <input ref={fileRef} type="file" accept="image/*,application/pdf" hidden onChange={(e) => onFile(e.target.files?.[0])} />
        </div>
        {layout.background && (
          <div className="dh-field" style={{ marginTop: 8 }}>
            <label>底圖透明度</label>
            <input type="range" min={0.1} max={1} step={0.05} value={layout.background.opacity ?? 0.6} onChange={(e) => p.onCommit({ ...layout, background: { ...layout.background!, opacity: Number(e.target.value) } })} />
          </div>
        )}
      </section>

      <section>
        <h3>比例</h3>
        <div className="dh-muted">畫布寬 {(layout.canvas.width * layout.metresPerUnit).toFixed(1)} m</div>
        <div className="dh-row" style={{ marginTop: 6 }}>
          <button className="dh-btn" onClick={p.onStartScale}>用已知距離校正</button>
        </div>
        <div className="dh-field" style={{ marginTop: 8 }}>
          <label>吸附格點 (m)</label>
          <select value={layout.grid} onChange={(e) => p.onCommit({ ...layout, grid: Number(e.target.value) })}>
            <option value={0}>關閉</option>
            <option value={0.1}>0.1</option>
            <option value={0.25}>0.25</option>
            <option value={0.5}>0.5</option>
            <option value={1}>1</option>
          </select>
        </div>
      </section>

      <section>
        <h3>牆</h3>
        <div className="dh-row">
          <NumberField label="外牆 (cm)" value={layout.wallDefaults.exterior * 100} onChange={(v) => p.onCommit({ ...layout, wallDefaults: { ...layout.wallDefaults, exterior: v / 100 } })} />
          <NumberField label="內牆 (cm)" value={layout.wallDefaults.interior * 100} onChange={(v) => p.onCommit({ ...layout, wallDefaults: { ...layout.wallDefaults, interior: v / 100 } })} />
          <NumberField label="牆高 (m)" value={layout.wallDefaults.height} step={0.1} onChange={(v) => p.onCommit({ ...layout, wallDefaults: { ...layout.wallDefaults, height: v } })} />
        </div>
        <WallQuickSelect walls={walls} onSelect={p.onSelect} />
        <div className="dh-muted" style={{ marginTop: 4 }}>{walls.length} 面牆，{Object.keys(layout.wallThickness).length} 面自訂厚度</div>
      </section>

      <section>
        <h3>房間</h3>
        {layout.rooms.length === 0 && <div className="dh-muted">還沒有房間。用上方「矩形房間」工具畫一間。</div>}
        <ul className="dh-list">
          {layout.rooms.map((r) => (
            <li key={r.id} onClick={() => p.onSelect({ kind: "room", id: r.id })}>
              <span>{r.name}</span>
              <span className="dh-muted">{r.areaId ? hass.areas[r.areaId]?.name : "未連結 area"}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3>加入裝置</h3>
        <div className="dh-field">
          <select value={addEntity} onChange={(e) => setAddEntity(e.target.value)}>
            <option value="">選一個 entity…</option>
            {allEntities.map((id) => <option key={id} value={id} disabled={placed.has(id)}>{friendlyName(hass, id)} ({id})</option>)}
          </select>
        </div>
        <button className="dh-btn" disabled={!addEntity} onClick={() => {
          const item = makeItem(hass, addEntity, layout.canvas.width / 2, layout.canvas.height / 2);
          p.onCommit(addItems(layout, [item]));
          p.onSelect({ kind: "item", id: item.id });
          setAddEntity("");
        }}>放到畫布中央</button>
        <div className="dh-muted" style={{ marginTop: 6 }}>比較快的做法：選一間房間 → 連結 HA area → 一鍵填入。</div>
      </section>

      <section>
        <h3>檔案</h3>
        <div className="dh-row">
          <button className="dh-btn" onClick={p.onExport}>匯出 JSON</button>
          <button className="dh-btn" onClick={() => importRef.current?.click()}>匯入 JSON</button>
          <input ref={importRef} type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && p.onImport(e.target.files[0])} />
        </div>
      </section>
    </>
  );
}

function WallQuickSelect({ walls, onSelect }: { walls: Wall[]; onSelect: (s: Selection) => void }) {
  const pick = (f: (w: Wall) => boolean) => onSelect({ kind: "walls", ids: walls.filter(f).map((w) => w.id) });
  return (
    <div className="dh-row" style={{ marginTop: 8 }}>
      <button className="dh-btn small" disabled={!walls.length} onClick={() => pick(() => true)}>全選牆</button>
      <button className="dh-btn small" disabled={!walls.length} onClick={() => pick((w) => w.exterior)}>全部外牆</button>
      <button className="dh-btn small" disabled={!walls.length} onClick={() => pick((w) => !w.exterior)}>全部內牆</button>
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
  return (
    <>
      <section>
        <h3>已選 {selected.length} 面牆</h3>
        <div className="dh-muted">{ext} 面外牆、{selected.length - ext} 面內牆，目前厚度 {uniform ? `${Math.round(first * 100)} cm` : "不一致"}</div>
        <div className="dh-field" style={{ marginTop: 8 }}>
          <label>設定厚度 (cm)</label>
          <div className="dh-row">
            <input type="number" min={3} max={80} step={1} value={cm} onChange={(e) => setCm(Number(e.target.value))} style={{ width: 90 }} onKeyDown={(e) => e.key === "Enter" && p.onCommit(applyThickness(layout, ids, cm / 100))} />
            <button className="dh-btn on" onClick={() => p.onCommit(applyThickness(layout, ids, cm / 100))}>套用到 {selected.length} 面</button>
          </div>
        </div>
        <div className="dh-row">
          {[8, 10, 12, 15, 20, 24, 30].map((v) => <button key={v} className="dh-btn small" onClick={() => { setCm(v); p.onCommit(applyThickness(layout, ids, v / 100)); }}>{v}</button>)}
        </div>
        <div className="dh-row" style={{ marginTop: 8 }}>
          <button className="dh-btn small" onClick={() => p.onCommit(resetThickness(layout, ids))}>回到預設</button>
          <button className="dh-btn small" onClick={() => p.onSelect(null)}>取消選取</button>
        </div>
      </section>
      <section>
        <h3>快速選取</h3>
        <WallQuickSelect walls={walls} onSelect={p.onSelect} />
        <div className="dh-muted" style={{ marginTop: 6 }}>畫布上 Shift+點牆 可加選或取消。</div>
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
      <section>
        <h3>房間</h3>
        <div className="dh-field">
          <label>名稱</label>
          <input value={room.name} onChange={(e) => p.onCommit(updateRoom(layout, room.id, { name: e.target.value }))} />
        </div>
        <div className="dh-field">
          <label>Home Assistant area</label>
          <select value={room.areaId ?? ""} onChange={(e) => {
            const areaId = e.target.value || null;
            const area = areaId ? hass.areas[areaId] : null;
            const rename = area && /^房間 \d+$/.test(room.name) ? { name: area.name } : {};
            p.onCommit(updateRoom(layout, room.id, { areaId, ...rename }));
          }}>
            <option value="">未連結</option>
            {areas.map((a) => <option key={a.area_id} value={a.area_id}>{a.name}</option>)}
          </select>
        </div>
        {room.areaId && (
          <div className="dh-row">
            <button className="dh-btn on" disabled={missing.length === 0} onClick={() => p.onCommit(addItems(layout, autoPlace(hass, room, missing, layout.items, 1.0 / layout.metresPerUnit)))}>
              填入 {missing.length} 個裝置
            </button>
            <span className="dh-muted">{areaEntities.length - missing.length}/{areaEntities.length} 已放</span>
          </div>
        )}
        <div className="dh-row" style={{ marginTop: 10 }}>
          <NumberField label="天花板高 (m)" value={room.height ?? layout.wallDefaults.height} step={0.1} onChange={(v) => p.onCommit(updateRoom(layout, room.id, { height: v }))} />
          <div className="dh-field"><label>地板色</label><input type="color" value={room.color ?? "#f8fafc"} onChange={(e) => p.onCommit(updateRoom(layout, room.id, { color: e.target.value }))} /></div>
        </div>
        <div className="dh-muted">面積約 {(Math.abs(area(room)) * layout.metresPerUnit ** 2).toFixed(1)} m²，{room.points.length} 個頂點（選取後可拖頂點）</div>
        <div className="dh-row" style={{ marginTop: 10 }}>
          <button className="dh-btn danger" onClick={() => { p.onCommit(removeRoom(layout, room.id)); p.onSelect(null); }}>刪除房間</button>
        </div>
      </section>
      {room.areaId && areaEntities.length > 0 && (
        <section>
          <h3>這個 area 的裝置</h3>
          <ul className="dh-list">
            {areaEntities.map((e) => {
              const it = layout.items.find((i) => i.entityId === e);
              return <li key={e} onClick={() => it && p.onSelect({ kind: "item", id: it.id })}><span>{friendlyName(hass, e)}</span><span className="dh-muted">{it ? "已放" : "未放"}</span></li>;
            })}
          </ul>
        </section>
      )}
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
      <h3>裝置</h3>
      <div><b>{friendlyName(hass, item.entityId)}</b></div>
      <div className="dh-muted" style={{ marginBottom: 8 }}>{item.entityId} · 狀態 {s?.state ?? "unknown"}</div>
      <div className="dh-field">
        <label>顯示方式</label>
        <select value={item.kind} onChange={(e) => p.onCommit(updateItem(layout, item.id, { kind: e.target.value as ItemKind }))}>
          {KINDS.map((k) => <option key={k.v} value={k.v}>{k.label}{k.v === "auto" ? `（${KINDS.find((x) => x.v === kind)?.label}）` : ""}</option>)}
        </select>
      </div>
      {kind === "light" && (
        <div className="dh-field">
          <label>燈具型式</label>
          <div className="dh-row">
            {FIXTURES.map((f) => <button key={f.v} className={`dh-btn small${(item.fixture ?? "downlight") === f.v ? " on" : ""}`} onClick={() => p.onCommit(updateItem(layout, item.id, { fixture: f.v }))}>{f.label}</button>)}
          </div>
        </div>
      )}
      {kind === "light" && (
        <div className="dh-field">
          <label>顏色 {item.color ? "（使用者指定）" : "（跟 HA 同步）"}</label>
          <div className="dh-row">
            <button className={`dh-btn small${!item.color ? " on" : ""}`} onClick={() => p.onCommit(updateItem(layout, item.id, { color: null }))}>自動</button>
            {KELVIN_PRESETS.map((k) => {
              const hex = kelvinToHex(k.k);
              return <button key={k.k} className={`dh-btn small${item.color === hex ? " on" : ""}`} style={{ background: item.color === hex ? undefined : hex }} onClick={() => p.onCommit(updateItem(layout, item.id, { color: hex }))}>{k.label}</button>;
            })}
            <input type="color" value={item.color ?? lightColor(hass, item.entityId) .replace(/^rgb\((\d+),(\d+),(\d+)\)$/, (_m, r, g, b) => "#" + [r, g, b].map((v: string) => Number(v).toString(16).padStart(2, "0")).join(""))} onChange={(e) => p.onCommit(updateItem(layout, item.id, { color: e.target.value }))} title="自訂顏色" />
          </div>
          <div className="dh-muted">只有開關的燈（Shelly、Sonoff）在這裡指定色溫或顏色；有色溫或彩色的燈不設定就跟 HA 同步。</div>
        </div>
      )}
      {kind === "light" && item.fixture === "strip" && (
        <div className="dh-field">
          <label>燈條長度 (m)</label>
          <div className="dh-row">
            <input type="number" min={0.1} max={20} step={0.1} style={{ width: 90 }} value={item.length ?? 1} onChange={(e) => { const v = Number(e.target.value); if (v > 0) p.onCommit(updateItem(layout, item.id, { length: v })); }} />
            {[0.5, 1, 1.5, 2, 3, 4].map((v) => <button key={v} className={`dh-btn small${(item.length ?? 1) === v ? " on" : ""}`} onClick={() => p.onCommit(updateItem(layout, item.id, { length: v }))}>{v}</button>)}
          </div>
        </div>
      )}
      {kind === "light" && (item.fixture === "wall" || item.fixture === "strip") && (
        <div className="dh-field">
          <label>旋轉 (°)</label>
          <div className="dh-row">
            <input type="number" step={15} style={{ width: 90 }} value={item.rotation ?? 0} onChange={(e) => p.onCommit(updateItem(layout, item.id, { rotation: Number(e.target.value) || 0 }))} />
            {[0, 90].map((v) => <button key={v} className={`dh-btn small${(item.rotation ?? 0) === v ? " on" : ""}`} onClick={() => p.onCommit(updateItem(layout, item.id, { rotation: v }))}>{v === 0 ? "橫" : "直"}</button>)}
          </div>
        </div>
      )}
      {kind === "generic" && (
        <>
          <div className="dh-field">
            <label>顯示的值</label>
            <select value={item.attribute ?? ""} onChange={(e) => p.onCommit(updateItem(layout, item.id, { attribute: e.target.value || null }))}>
              <option value="">狀態 (state)</option>
              {attrs.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div className="dh-field">
            <label>標籤</label>
            <input value={item.label ?? ""} placeholder={friendlyName(hass, item.entityId)} onChange={(e) => p.onCommit(updateItem(layout, item.id, { label: e.target.value || null }))} />
          </div>
        </>
      )}
      <div className="dh-muted">位置 ({(item.x * layout.metresPerUnit).toFixed(2)}, {(item.y * layout.metresPerUnit).toFixed(2)}) m</div>
      <div className="dh-row" style={{ marginTop: 10 }}>
        <button className="dh-btn danger" onClick={() => { p.onCommit(removeItem(layout, item.id)); p.onSelect(null); }}>移除</button>
      </div>
    </section>
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
