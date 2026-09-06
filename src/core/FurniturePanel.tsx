import { t } from "../i18n";
import { FURNITURE, isOpening, isWindow, makeFurniture, type Furniture, type FurnitureType } from "../domain/furniture";
import { addFurniture, removeFurniture, updateFurniture } from "./useEditor";
import { Button, ColorInput, Field, Group, NumberInput, PanelActions, PanelHeader, Segmented, Select } from "./ui";
import { Ic } from "./icons";
import { TextField } from "./fields";
import type { SidebarProps } from "./Sidebar";

export function FurniturePanel(p: SidebarProps & { f: Furniture }) {
  const { layout, f } = p;
  const spec = FURNITURE[f.type];
  const set = (patch: Partial<Furniture>) => p.onCommit(updateFurniture(layout, f.id, patch));
  const opening = isOpening(f);
  const window = isWindow(f);
  return (
    <>
      <PanelHeader icon={<Ic.sofa />} title={f.label || t(spec.label)} subtitle={t("家具")} onBack={() => p.onSelect(null)} />
      <Group title={t("基本")}>
        <Field label={t("種類")}>
          <Select label={t("種類")} value={f.type} onChange={(v) => { const ft = v as FurnitureType; const s = FURNITURE[ft]; set({ type: ft, w: s.w, d: s.d, h: s.h, color: s.color }); }}>
            {(Object.keys(FURNITURE) as FurnitureType[]).map((ft) => <option key={ft} value={ft}>{t(FURNITURE[ft].label)}</option>)}
          </Select>
        </Field>
        <TextField label={t("標籤（選填）")} value={f.label ?? ""} placeholder={t(spec.label)} onSave={(v) => set({ label: v || null })} />
      </Group>
      <Group title={t("尺寸")} right={<Button size="sm" variant="ghost" icon={<Ic.reset size={14} />} onClick={() => set({ w: spec.w, d: spec.d, h: spec.h, color: spec.color })}>{t("回預設尺寸")}</Button>}>
        <div className="dh-cols">
          <Field label={t("寬")}><NumberInput unit="m" label={t("寬 (m)")} step={0.1} value={f.w} onChange={(v) => v > 0 && set({ w: v })} /></Field>
          {!opening && <Field label={t("深")}><NumberInput unit="m" label={t("深 (m)")} step={0.1} value={f.d} onChange={(v) => v > 0 && set({ d: v })} /></Field>}
          <Field label={t("高")}><NumberInput unit="m" label={t("高 (m)")} step={0.05} value={f.h} onChange={(v) => v >= 0 && set({ h: v })} /></Field>
          {window && <Field label={t("窗台高")}><NumberInput unit="m" label={t("窗台高")} step={0.05} min={0} value={f.sill ?? spec.sill ?? 0.9} onChange={(v) => v >= 0 && set({ sill: v })} /></Field>}
        </div>
        {opening && (
          <Field label={t("開口")} hint={t("門窗會自動貼到最近的牆上；Shift 拖曳可自由放。")} className="dh-mt">
            <div className="dh-row">
              <Button size="sm" icon={<Ic.rotateR size={14} />} onClick={() => set({ rotation: (f.rotation + 180) % 360 })}>{t("開向另一側")}</Button>
              {!window && f.type !== "sliding_door" && <Button size="sm" icon={<Ic.arrowOut size={14} />} onClick={() => set({ flip: !f.flip })}>{t("鉸鏈換邊")}</Button>}
            </div>
          </Field>
        )}
        <Field label={t("方向")} className="dh-mt">
          <div className="dh-row nowrap">
            <Segmented size="sm" label={t("方向")} value={[0, 90, 180, 270].includes(f.rotation) ? f.rotation : -1} onChange={(v) => set({ rotation: v })} options={[0, 90, 180, 270].map((r) => ({ v: r, label: `${r}°` }))} />
            <NumberInput unit="°" label={t("方向 (°)")} step={15} value={f.rotation} onChange={(v) => set({ rotation: v || 0 })} width={80} />
          </div>
        </Field>
        <Field label={t("顏色")}>
          <ColorInput label={t("顏色")} value={f.color} onChange={(v) => set({ color: v })} />
        </Field>
      </Group>
      <Group title={t("位置")}>
        <Button variant={p.placing ? "tonal" : "default"} on={!!p.placing} icon={<Ic.pin size={16} />} onClick={() => p.onPlacing?.(!p.placing)}>{p.placing ? t("點畫布放置…") : t("移到點的位置")}</Button>
        <div className="dh-help-text">{t("或直接拖曳；Shift 拖曳不吸附格點。")}</div>
      </Group>
      <PanelActions>
        <Button icon={<Ic.copy size={16} />} onClick={() => { const c = makeFurniture(f.type, f.x + 0.3 / layout.metresPerUnit, f.y + 0.3 / layout.metresPerUnit); p.onCommit(addFurniture(layout, { ...c, w: f.w, d: f.d, h: f.h, color: f.color, rotation: f.rotation })); p.onSelect({ kind: "furniture", id: c.id }); }}>{t("複製")}</Button>
        <Button variant="danger" icon={<Ic.trash size={16} />} onClick={() => { p.onCommit(removeFurniture(layout, f.id)); p.onSelect(null); p.onNotify?.(t("已刪除家具，可用復原鍵還原")); }}>{t("刪除")}</Button>
      </PanelActions>
    </>
  );
}
