import { useRef, useState } from "react";
import { langFromHass, readLangOverride, setLang, t, writeLangOverride, type Lang } from "../i18n";
import type { Layout, Wall } from "../domain/types";
import { makeItem } from "../domain/entities";
import { pointInPolygon } from "../domain/geometry";
import type { HassLike } from "../ha/types";
import { importBackground } from "./background";
import { addFurniture, addItems, applyThickness, applyVirtual, resetThickness, setBackground, type Selection } from "./useEditor";
import { FURNITURE, FURNITURE_GROUPS, makeFurniture, type FurnitureType } from "../domain/furniture";
import { EntityPicker } from "./EntityPicker";
import { VERSION } from "../version";
import { Button, Chip, EmptyState, Field, Group, NumberInput, PanelHeader, Row, Section, Segmented, Switch, type Toast } from "./ui";
import { Ic } from "./icons";
import { RoomPanel } from "./RoomPanel";
import { ItemPanel } from "./ItemPanel";
import { FurniturePanel } from "./FurniturePanel";

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

export function Sidebar(p: SidebarProps) {
  const { layout, walls, selection } = p;
  let body: React.ReactNode = <LayoutPanel {...p} />;
  if (selection?.kind === "room") {
    const room = layout.rooms.find((r) => r.id === selection.id);
    if (room) body = <RoomPanel {...p} room={room} />;
  } else if (selection?.kind === "item") {
    const item = layout.items.find((i) => i.id === selection.id);
    if (item) body = <ItemPanel {...p} item={item} />;
  } else if (selection?.kind === "furniture") {
    const f = (layout.furniture ?? []).find((x) => x.id === selection.id);
    if (f) body = <FurniturePanel {...p} f={f} />;
  } else if (selection?.kind === "walls") {
    const sel = walls.filter((w) => selection.ids.includes(w.id));
    if (sel.length) body = <WallPanel {...p} selected={sel} />;
  }
  return <aside className="dh-side" aria-label={t("側欄")}>{body}</aside>;
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
  const dead = layout.items.filter((i) => { const st = hass.states[i.entityId]?.state; return !st || st === "unavailable" || st === "unknown"; });
  const itemsIn = (roomId: string) => { const r = layout.rooms.find((x) => x.id === roomId)!; return layout.items.filter((i) => pointInPolygon([i.x, i.y], r.points)).length; };

  return (
    <>
      {noRooms && (
        <div className="dh-side-intro">
          <b>{t("三步驟")}</b>
          <ol className="dh-steps">
            <li><span>{t("（可選）上傳平面圖 PDF / JPG 當底圖，用「點選房間」點房間內部自動框出。")}</span></li>
            <li><span>{t("沒有底圖就用「矩形房間」：點一個角、再點對角。")}</span></li>
            <li><span>{t("點房間 → 連結 HA area → 加入裝置。")}</span></li>
          </ol>
        </div>
      )}

      <Section id="rooms" title={t("房間")} icon={<Ic.door size={16} />} defaultOpen badge={layout.rooms.length || undefined}>
        {noRooms ? (
          <EmptyState icon={<Ic.rect size={22} />} title={t("還沒有房間")} hint={t("用上方「矩形房間」工具畫一間。")} />
        ) : (
          <ul className="dh-list">
            {layout.rooms.map((r) => (
              <Row
                key={r.id}
                lead={<span className="dh-swatch" style={{ background: r.color ?? "#f8fafc" }} />}
                primary={r.name}
                secondary={r.areaId ? hass.areas[r.areaId]?.name : t("未連結 area")}
                trailing={<><span className="dh-badge">{itemsIn(r.id)}</span><Ic.chevronRight size={16} className="dh-muted" /></>}
                onClick={() => p.onSelect({ kind: "room", id: r.id })}
              />
            ))}
          </ul>
        )}
      </Section>

      <Section id="devices" title={t("加入裝置")} icon={<Ic.bulb size={16} />} defaultOpen badge={layout.items.length || undefined}>
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
        <div className="dh-help-text">{t("先選一間房間再加，會直接放進那間。")}</div>
      </Section>

      <Section id="furniture" title={t("家具（純裝飾）")} icon={<Ic.sofa size={16} />} badge={(layout.furniture ?? []).length || undefined}>
        <FurnitureChips onPick={(ft) => {
          const f = makeFurniture(ft, layout.canvas.width / 2, layout.canvas.height / 2);
          p.onCommit(addFurniture(layout, f));
          p.onSelect({ kind: "furniture", id: f.id });
        }} />
        <div className="dh-help-text">{t("先選一間房間再按，家具會放在那間房的中央。")}</div>
      </Section>

      <Section id="background" title={t("底圖與比例")} icon={<Ic.file size={16} />} defaultOpen={noRooms}>
        <Field label={t("底圖")} meta={layout.background ? t("已上傳") : undefined}>
          <div className="dh-row">
            <Button variant={layout.background ? "default" : "primary"} icon={busy ? <Ic.spin size={16} /> : <Ic.upload size={16} />} disabled={busy} onClick={() => fileRef.current?.click()}>{busy ? t("處理中…") : layout.background ? t("換底圖") : t("上傳 PDF / JPG")}</Button>
            {layout.background && <Button variant="danger" onClick={() => p.onCommit(setBackground(layout, null))}>{t("移除")}</Button>}
            <input ref={fileRef} type="file" accept="image/*,application/pdf" hidden onChange={(e) => onFile(e.target.files?.[0])} />
          </div>
        </Field>
        {layout.background && (
          <Field label={t("底圖透明度")} meta={`${Math.round((layout.background.opacity ?? 0.6) * 100)}%`}>
            <input type="range" min={0.1} max={1} step={0.05} aria-label={t("底圖透明度")} value={layout.background.opacity ?? 0.6} onChange={(e) => p.onCommit({ ...layout, background: { ...layout.background!, opacity: Number(e.target.value) } })} />
          </Field>
        )}
        <Field label={t("比例")} meta={t("畫布寬 {w} m", { w: (layout.canvas.width * layout.metresPerUnit).toFixed(1) })}>
          <Button icon={<Ic.ruler size={16} />} onClick={p.onStartScale}>{t("用已知距離校正")}</Button>
        </Field>
        <Field label={t("吸附格點")}>
          <Segmented size="sm" full label={t("吸附格點")} value={layout.grid} onChange={(v) => p.onCommit({ ...layout, grid: v })} options={[{ v: 0, label: t("關閉") }, { v: 0.1, label: "0.1 m" }, { v: 0.25, label: "0.25 m" }, { v: 0.5, label: "0.5 m" }, { v: 1, label: "1 m" }]} />
        </Field>
      </Section>

      <Section id="walls" title={t("牆")} icon={<Ic.wall size={16} />} badge={walls.length || undefined}>
        <div className="dh-cols">
          <Field label={t("外牆")}><NumberInput unit="cm" label={t("外牆 (cm)")} value={layout.wallDefaults.exterior * 100} onChange={(v) => p.onCommit({ ...layout, wallDefaults: { ...layout.wallDefaults, exterior: v / 100 } })} /></Field>
          <Field label={t("內牆")}><NumberInput unit="cm" label={t("內牆 (cm)")} value={layout.wallDefaults.interior * 100} onChange={(v) => p.onCommit({ ...layout, wallDefaults: { ...layout.wallDefaults, interior: v / 100 } })} /></Field>
          <Field label={t("牆高")}><NumberInput unit="m" label={t("牆高 (m)")} step={0.1} value={layout.wallDefaults.height} onChange={(v) => p.onCommit({ ...layout, wallDefaults: { ...layout.wallDefaults, height: v } })} /></Field>
        </div>
        <Field label={t("快速選取")} className="dh-mt">
          <WallQuickSelect walls={walls} onSelect={p.onSelect} />
        </Field>
        <div className="dh-help-text">{t("{a} 面牆，{b} 面自訂厚度，{c} 面虛擬", { a: walls.length, b: Object.keys(layout.wallThickness).length, c: walls.filter((w) => w.virtual).length })}</div>
      </Section>

      <Section id="view3d" title="3D" icon={<Ic.layers size={16} />}>
        <Switch checked={layout.labels3d !== false} onChange={(v) => p.onCommit({ ...layout, labels3d: v })}>{t("顯示感測數值標籤")}</Switch>
        <div className="dh-help-text">{t("感測器很多時關掉會清爽很多；燈、冷氣、窗簾不受影響。")}</div>
      </Section>

      {dead.length > 0 && (
        <Section id="cleanup" title={t("清理")} icon={<Ic.trash size={16} />} badge={dead.length} defaultOpen>
          <Button icon={<Ic.trash size={16} />} onClick={() => p.onCommit({ ...layout, items: layout.items.filter((i) => !dead.includes(i)) })}>{t("移除 {n} 個 unavailable 的裝置", { n: dead.length })}</Button>
          <div className="dh-help-text">{t("狀態是 unavailable / unknown 的圖示只會疊在一起，之後自動填入也不會再加它們。")}</div>
        </Section>
      )}

      <Section id="files" title={t("檔案")} icon={<Ic.download size={16} />}>
        <div className="dh-row">
          <Button icon={<Ic.download size={16} />} onClick={p.onExport}>{t("匯出 JSON")}</Button>
          <Button icon={<Ic.upload size={16} />} onClick={() => importRef.current?.click()}>{t("匯入 JSON")}</Button>
          <input ref={importRef} type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && p.onImport(e.target.files[0])} />
        </div>
        <Field label={t("語言")} className="dh-mt">
          <Segmented size="sm" full label={t("語言")} value={readLangOverride() ?? ""} onChange={(v) => { writeLangOverride(v ? (v as Lang) : null); setLang(v ? (v as Lang) : langFromHass(hass.language)); }} options={[{ v: "", label: t("跟隨 HA") }, { v: "zh-Hant", label: "中文" }, { v: "en", label: "English" }]} />
        </Field>
        <div className="dh-danger-zone">
          <Button variant="danger" icon={<Ic.trash size={16} />} disabled={layout.rooms.length === 0 && layout.items.length === 0 && !(layout.furniture ?? []).length} onClick={() => { p.onCommit({ ...layout, rooms: [], items: [], furniture: [], wallThickness: {}, wallVirtual: {}, background: null, locked: false }); p.onSelect(null); p.onNotify?.(t("已全部清除，可用復原鍵還原")); }}>{t("全部清除")}</Button>
          <div className="dh-help-text">{t("清掉房間、裝置、家具與底圖，從頭開始。")}</div>
        </div>
      </Section>

      <div className="dh-side-foot">
        <span>Dollhouse v{VERSION}</span>
        <span>WebGL {webglOk() ? t("可用") : t("不可用")}</span>
        <span>{t("視窗")} {typeof window !== "undefined" ? `${window.innerWidth}×${window.innerHeight}` : ""}</span>
      </div>
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

/** Furniture catalogue as chips, one row per group. */
export function FurnitureChips({ onPick }: { onPick: (ft: FurnitureType) => void }) {
  return (
    <>
      {FURNITURE_GROUPS.map((grp) => (
        <Group key={grp} title={t(grp)}>
          <div className="dh-chips">
            {(Object.keys(FURNITURE) as FurnitureType[]).filter((ft) => FURNITURE[ft].group === grp).map((ft) => (
              <Chip key={ft} onClick={() => onPick(ft)}><Ic.plus size={12} />{t(FURNITURE[ft].label)}</Chip>
            ))}
          </div>
        </Group>
      ))}
    </>
  );
}

export function WallQuickSelect({ walls, onSelect }: { walls: Wall[]; onSelect: (s: Selection) => void }) {
  const pick = (f: (w: Wall) => boolean) => onSelect({ kind: "walls", ids: walls.filter(f).map((w) => w.id) });
  return (
    <div className="dh-chips">
      <Chip disabled={!walls.length} onClick={() => pick(() => true)}>{t("全選牆")}</Chip>
      <Chip disabled={!walls.length} onClick={() => pick((w) => w.exterior)}>{t("全部外牆")}</Chip>
      <Chip disabled={!walls.length} onClick={() => pick((w) => !w.exterior)}>{t("全部內牆")}</Chip>
      {walls.some((w) => w.virtual) && <Chip onClick={() => pick((w) => w.virtual)}>{t("全部虛擬")}</Chip>}
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
  const virtual: "solid" | "virtual" | "mixed" = virt === 0 ? "solid" : virt === selected.length ? "virtual" : "mixed";
  return (
    <>
      <PanelHeader
        icon={<Ic.wall />}
        title={t("已選 {n} 面牆", { n: selected.length })}
        subtitle={`${t("{a} 面外牆、{b} 面內牆", { a: ext, b: selected.length - ext })}${virt ? t("，{n} 面虛擬", { n: virt }) : ""}`}
        onBack={() => p.onSelect(null)}
        actions={<Button size="sm" variant={p.wallMulti ? "tonal" : "ghost"} on={!!p.wallMulti} onClick={() => p.onWallMulti?.(!p.wallMulti)}>{t("多選")}</Button>}
      />
      <Group title={t("類型")}>
        <Segmented full label={t("實牆 / 虛擬區隔")} value={virtual} onChange={(v) => v !== "mixed" && p.onCommit(applyVirtual(layout, ids, v === "virtual"))} options={[{ v: "solid", label: t("實牆") }, { v: "virtual", label: t("虛擬（開放空間）") }]} />
        <div className="dh-help-text">{t("虛擬區隔只用來分房間與 area，不畫牆。例如開放式廚房和客廳之間。")}</div>
      </Group>
      <Group title={t("厚度")} right={<span className="dh-meta">{t("目前 {v}", { v: uniform ? `${Math.round(first * 100)} cm` : t("不一致") })}</span>}>
        <div className="dh-row nowrap">
          <NumberInput unit="cm" label={t("設定厚度 (cm)")} min={3} max={80} value={cm} onChange={setCm} />
          <Button variant="primary" onClick={() => p.onCommit(applyThickness(layout, ids, cm / 100))}>{t("套用到 {n} 面", { n: selected.length })}</Button>
        </div>
        <div style={{ marginTop: 8 }}>
          <Segmented size="sm" full label={t("常用厚度")} value={uniform ? Math.round(first * 100) : -1} onChange={(v) => { setCm(v); p.onCommit(applyThickness(layout, ids, v / 100)); }} options={[8, 10, 12, 15, 20, 24, 30].map((v) => ({ v, label: String(v) }))} />
        </div>
        <div className="dh-row" style={{ marginTop: 8 }}>
          <Button size="sm" variant="ghost" icon={<Ic.reset size={14} />} onClick={() => p.onCommit(resetThickness(layout, ids))}>{t("回到預設")}</Button>
        </div>
      </Group>
      <Group title={t("快速選取")}>
        <WallQuickSelect walls={walls} onSelect={p.onSelect} />
        <div className="dh-help-text">{t("開「多選」後點牆可加選或取消；桌機也可以 Shift+點。")}</div>
      </Group>
    </>
  );
}
