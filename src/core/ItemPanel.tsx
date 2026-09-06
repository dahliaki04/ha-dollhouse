import { t } from "../i18n";
import type { Beam, CoverDraw, CoverStyle, FixtureType, Item, ItemKind, Mount } from "../domain/types";
import { newId } from "../domain/types";
import { coverView, guessCoverStyle } from "../domain/covers";
import { defaultBeam, defaultMount, effectiveHeight, effectiveShowIn, hasBeam, mountHeight, resolveKind } from "../domain/entities";
import { domainOf, friendlyName } from "../ha/types";
import { KELVIN_PRESETS, kelvinToHex, lightColor } from "./markers";
import { addItems, removeItem, updateItem } from "./useEditor";
import { Button, ColorInput, Field, Group, NumberInput, PanelActions, PanelHeader, Segmented, Select, StatePill } from "./ui";
import { Ic } from "./icons";
import { DomainIcon } from "./glyphs";
import { EntityField, TextField } from "./fields";
import type { SidebarProps } from "./Sidebar";

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

const rgbToHex = (c: string) => c.replace(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/, (_m, r, g, b) => "#" + [r, g, b].map((v: string) => Number(v).toString(16).padStart(2, "0")).join(""));

export function ItemPanel(p: SidebarProps & { item: Item }) {
  const { layout, hass, item } = p;
  const kind = resolveKind(item, hass);
  const s = hass.states[item.entityId];
  const set = (patch: Partial<Item>) => p.onCommit(updateItem(layout, item.id, patch));
  const attrs = s ? Object.keys(s.attributes).filter((a) => !["friendly_name", "icon", "supported_features", "supported_color_modes"].includes(a)) : [];
  const rotationSeg = (
    <div className="dh-row nowrap">
      <NumberInput unit="°" label={t("旋轉 (°)")} step={15} value={item.rotation ?? 0} onChange={(v) => set({ rotation: v || 0 })} />
      <Segmented size="sm" label={t("旋轉 (°)")} value={(item.rotation ?? 0) === 0 ? 0 : (item.rotation ?? 0) === 90 ? 90 : -1} onChange={(v) => set({ rotation: v })} options={[{ v: 0, label: t("橫") }, { v: 90, label: t("直") }]} />
    </div>
  );

  return (
    <>
      <PanelHeader
        icon={<DomainIcon dom={domainOf(item.entityId)} size={18} />}
        title={friendlyName(hass, item.entityId)}
        subtitle={<><StatePill state={s?.state} /> <span className="dh-code">{item.entityId}</span></>}
        onBack={() => p.onSelect(null)}
      />

      <Group title={t("綁定與顯示")}>
        <EntityField hass={hass} value={item.entityId} onChange={(id) => set({ entityId: id })} />
        <Field label={t("顯示方式")} meta={item.kind === "auto" ? t("自動：{v}", { v: t(KINDS.find((x) => x.v === kind)?.label ?? "") }) : undefined}>
          <Segmented size="sm" cols={3} label={t("顯示方式")} value={item.kind} onChange={(v) => set({ kind: v as ItemKind })} options={KINDS.map((k) => ({ v: k.v, label: t(k.label) }))} />
        </Field>
        {kind !== "light" && kind !== "cover" && (
          <Field label={t("顯示位置")} meta={item.showIn ? undefined : t("預設")} hint={t("數值型裝置預設集中在房間的狀態框；拖它的小圓點到另一間就換房間。")}>
            <Segmented size="sm" full label={t("顯示位置")} value={effectiveShowIn(item, hass)} onChange={(v) => set({ showIn: v })} options={[{ v: "frame", label: t("房間狀態框") }, { v: "plan", label: t("平面圖上") }]} />
          </Field>
        )}
        {kind === "generic" && (
          <>
            <Field label={t("顯示的值")}>
              <Select label={t("顯示的值")} value={item.attribute ?? ""} onChange={(v) => set({ attribute: v || null })}>
                <option value="">{t("狀態 (state)")}</option>
                {attrs.map((a) => <option key={a} value={a}>{a}</option>)}
              </Select>
            </Field>
            <TextField label={t("標籤")} value={item.label ?? ""} placeholder={friendlyName(hass, item.entityId)} onSave={(v) => set({ label: v || null })} />
          </>
        )}
      </Group>

      {kind === "light" && (
        <Group title={t("燈具")}>
          <Field label={t("燈具型式")}>
            <Segmented size="sm" cols={3} label={t("燈具型式")} value={item.fixture ?? "downlight"} onChange={(v) => set({ fixture: v })} options={FIXTURES.map((f) => ({ v: f.v, label: t(f.label) }))} />
          </Field>
          <Field label={t("顏色")} meta={item.color ? t("使用者指定") : t("跟 HA 同步")} hint={t("只有開關的燈（Shelly、Sonoff）在這裡指定色溫或顏色；有色溫或彩色的燈不設定就跟 HA 同步。")}>
            <div className="dh-row nowrap">
              <Segmented size="sm" cols={2} label={t("顏色")} value={item.color ?? ""} onChange={(v) => set({ color: v || null })} options={[{ v: "", label: t("自動") }, ...KELVIN_PRESETS.map((k) => ({ v: kelvinToHex(k.k), label: t(k.label), swatch: kelvinToHex(k.k) }))]} />
              <ColorInput label={t("自訂顏色")} value={item.color ?? rgbToHex(lightColor(hass, item.entityId))} onChange={(v) => set({ color: v })} />
            </div>
          </Field>
          {item.fixture === "strip" && (
            <Field label={t("燈條長度")}>
              <div className="dh-stack">
                <NumberInput unit="m" label={t("燈條長度 (m)")} min={0.1} max={20} step={0.1} value={item.length ?? 1} onChange={(v) => v > 0 && set({ length: v })} />
                <Segmented size="sm" full label={t("燈條長度 (m)")} value={item.length ?? 1} onChange={(v) => set({ length: v })} options={[0.5, 1, 1.5, 2, 3, 4].map((v) => ({ v, label: String(v) }))} />
              </div>
            </Field>
          )}
          {hasBeam(item, hass) && (() => {
            const BEAMS: { v: Beam; label: string }[] = [{ v: "down", label: t("向下") }, { v: "up", label: t("向上") }, { v: "both", label: t("上下") }];
            const d = defaultBeam(item, hass);
            return (
              <Field label={t("投光方向")} meta={item.beam ? undefined : t("預設 {v}", { v: t(BEAMS.find((b) => b.v === d)?.label ?? "") })} hint={item.fixture === "strip" ? t("牆面層板燈向上打天花板，天花板或櫃下燈條向下打。牆面安裝的燈條拖到牆邊會自動貼齊。") : t("壁燈預設上下都打。")}>
                <Segmented size="sm" full label={t("投光方向")} value={item.beam ?? ""} onChange={(v) => set({ beam: (v || null) as Beam | null })} options={[{ v: "", label: t("自動") }, ...BEAMS.map((b) => ({ v: b.v, label: t(b.label) }))]} />
              </Field>
            );
          })()}
          {(item.fixture === "wall" || item.fixture === "strip") && <Field label={t("旋轉")}>{rotationSeg}</Field>}
        </Group>
      )}

      {kind === "light" && item.fixture !== "room" && (() => {
        const r = item.repeat ?? { count: 1, pattern: "row" as const, spacing: 0.8 };
        const setR = (patch: Partial<typeof r>) => set({ repeat: { ...r, ...patch } });
        const strip = item.fixture === "strip";
        return (
          <Group title={t("燈組")} right={<span className="dh-meta">{t("一個開關帶多顆燈")}</span>}>
            {!strip && (
              <Field label={t("排列")}>
                <Segmented size="sm" full label={t("排列")} value={r.pattern} onChange={(v) => (v === "grid" ? setR({ pattern: "grid", rows: r.rows ?? 2, cols: r.cols ?? 2, count: (r.rows ?? 2) * (r.cols ?? 2) }) : setR({ pattern: "row" }))} options={[{ v: "row", label: t("一排") }, { v: "grid", icon: <Ic.grid size={14} />, label: t("矩陣") }]} />
              </Field>
            )}
            {r.pattern !== "grid" && (
              <Field label={t("數量")}>
                <div className="dh-stack">
                  <NumberInput label={t("數量")} min={1} max={40} value={r.count} onChange={(v) => setR({ count: Math.max(1, Math.min(40, v || 1)) })} width={72} />
                  <Segmented size="sm" full label={t("數量")} value={r.count} onChange={(v) => setR({ count: v })} options={[1, 2, 3, 4, 6, 8].map((n) => ({ v: n, label: String(n) }))} />
                </div>
              </Field>
            )}
            {r.pattern === "grid" && (
              <>
                <Field label={t("列 × 欄")}>
                  <div className="dh-stack">
                    <div className="dh-row nowrap">
                      <NumberInput label={t("列")} min={1} max={10} value={r.rows ?? 2} width={72} onChange={(v) => { const rr = Math.max(1, Math.min(10, v || 1)); setR({ rows: rr, count: rr * (r.cols ?? 2) }); }} />
                      <span className="dh-muted">×</span>
                      <NumberInput label={t("欄")} min={1} max={10} value={r.cols ?? 2} width={72} onChange={(v) => { const cc = Math.max(1, Math.min(10, v || 1)); setR({ cols: cc, count: (r.rows ?? 2) * cc }); }} />
                      <span className="dh-meta">= {r.count}</span>
                    </div>
                    <Segmented size="sm" full label={t("列 × 欄")} value={`${r.rows ?? 0}x${r.cols ?? 0}`} onChange={(v) => { const [rr, cc] = v.split("x").map(Number); setR({ rows: rr, cols: cc, count: rr * cc }); }} options={[[2, 2], [2, 3], [3, 3], [2, 4]].map(([rr, cc]) => ({ v: `${rr}x${cc}`, label: `${rr}×${cc}` }))} />
                  </div>
                </Field>
                <Field label={t("間距 橫 / 縱")}>
                  <div className="dh-row nowrap">
                    <NumberInput unit="m" label={t("間距 橫")} min={0.2} max={5} step={0.1} value={r.spacing} onChange={(v) => v > 0 && setR({ spacing: v })} />
                    <NumberInput unit="m" label={t("間距 縱")} min={0.2} max={5} step={0.1} value={r.spacingY ?? r.spacing} onChange={(v) => v > 0 && setR({ spacingY: v })} />
                  </div>
                </Field>
              </>
            )}
            {(r.count > 1 || r.pattern === "grid") && (
              <Field label={r.pattern === "row" ? (strip ? t("兩條之間與方向") : t("間距與方向")) : t("方向")}>
                <div className="dh-row nowrap">
                  {r.pattern === "row" && <NumberInput unit="m" label={strip ? t("兩條之間 (m)") : t("間距 (m)")} min={0.2} max={5} step={0.1} value={r.spacing} onChange={(v) => v > 0 && setR({ spacing: v })} />}
                  {rotationSeg}
                </div>
              </Field>
            )}
            <div className="dh-help-text">{strip ? t("燈條會平行並排；兩側各貼一面牆的層板燈請用「複製」，每條各自吸牆。") : t("燈本身沒有進 HA、只有 Shelly / Sonoff 的開關時，用這裡畫出實際的幾顆燈；狀態跟著這個開關。")}</div>
          </Group>
        );
      })()}

      {kind === "cover" && (() => {
        const v = coverView(hass, item);
        const guessed = guessCoverStyle(hass, item.entityId);
        const STYLES: { v: CoverStyle; label: string }[] = [{ v: "curtain", label: t("橫拉") }, { v: "roller", label: t("上下") }, { v: "blind", label: t("百葉") }];
        const DRAWS: { v: CoverDraw; label: string }[] = [{ v: "center", label: t("對開") }, { v: "left", label: t("左收") }, { v: "right", label: t("右收") }];
        return (
          <Group title={t("窗簾")} right={<span className="dh-meta">{t("目前開 {n}%", { n: Math.round(v.open * 100) })}{v.style === "blind" ? t("，葉片 {n}%", { n: Math.round(v.tilt * 100) }) : ""}</span>}>
            <Field label={t("窗簾型式")} meta={item.coverStyle ? t("使用者指定") : t("依屬性判斷：{v}", { v: t(STYLES.find((x) => x.v === guessed)?.label ?? "") })}>
              <Segmented size="sm" full label={t("窗簾型式")} value={item.coverStyle ?? ""} onChange={(x) => set({ coverStyle: (x || null) as CoverStyle | null })} options={[{ v: "", label: t("自動") }, ...STYLES.map((x) => ({ v: x.v, label: t(x.label) }))]} />
            </Field>
            {(item.coverStyle ?? guessed) === "curtain" && (
              <Field label={t("開法")} meta={t("站在房間內看窗")}>
                <Segmented size="sm" full label={t("開法")} value={item.coverDraw ?? "center"} onChange={(x) => set({ coverDraw: x })} options={DRAWS.map((d) => ({ v: d.v, label: t(d.label) }))} />
              </Field>
            )}
            <Field label={t("窗寬")}>
              <div className="dh-stack">
                <NumberInput unit="m" label={t("窗寬 (m)")} min={0.3} max={20} step={0.1} value={item.length ?? 1.5} onChange={(x) => x > 0 && set({ length: x })} />
                <Segmented size="sm" full label={t("窗寬 (m)")} value={item.length ?? 1.5} onChange={(x) => set({ length: x })} options={[1, 1.5, 2, 3, 4].map((L) => ({ v: L, label: String(L) }))} />
              </div>
            </Field>
            <Field label={t("方向")} meta={t("拖到牆邊會自動貼齊")}>{rotationSeg}</Field>
            <div className="dh-help-text">{t("點圖示開關，雙擊拉到指定位置。")}</div>
          </Group>
        );
      })()}

      {kind !== "cover" && (() => {
        const ceiling = layout.wallDefaults.height;
        const dm = defaultMount(item, hass);
        const cur = item.mount ?? dm;
        const MOUNTS: { v: Mount; label: string }[] = [{ v: "ceiling", label: t("天花板") }, { v: "wall", label: t("牆面") }, { v: "floor", label: t("地面") }];
        const h = effectiveHeight(item, hass, ceiling);
        const meta = item.z != null ? t("自訂 {h} m", { h: h.toFixed(2) }) : item.mount ? `${t(MOUNTS.find((x) => x.v === cur)?.label ?? "")} ${h.toFixed(2)} m` : t("預設 {v} {h} m", { v: t(MOUNTS.find((x) => x.v === dm)?.label ?? ""), h: h.toFixed(2) });
        return (
          <Group title={t("安裝")}>
            <Field label={t("安裝高度")} meta={meta}>
              <div className="dh-row nowrap">
                <Segmented size="sm" label={t("安裝高度")} value={item.z == null ? cur : ""} onChange={(v) => v && set({ mount: v as Mount, z: null })} options={MOUNTS.map((mo) => ({ v: mo.v, label: t(mo.label), title: `${mountHeight(item, mo.v, hass, ceiling).toFixed(2)} m` }))} />
                <NumberInput unit="m" label={t("安裝高度")} min={0} max={ceiling} step={0.05} value={Math.round(h * 100) / 100} onChange={(v) => set({ z: Math.min(ceiling, Math.max(0, v)) })} width={88} />
              </div>
            </Field>
          </Group>
        );
      })()}

      <Group title={t("位置")} right={<span className="dh-meta">({(item.x * layout.metresPerUnit).toFixed(2)}, {(item.y * layout.metresPerUnit).toFixed(2)}) m</span>}>
        <Button variant={p.placing ? "tonal" : "default"} on={!!p.placing} icon={<Ic.pin size={16} />} onClick={() => p.onPlacing?.(!p.placing)}>{p.placing ? t("點畫布放置…") : t("移到點的位置")}</Button>
        <div className="dh-help-text">{t("或直接拖曳；Shift 拖曳不吸附格點。")}</div>
      </Group>

      <PanelActions>
        <Button icon={<Ic.copy size={16} />} onClick={() => { const c = { ...item, id: newId("i"), x: item.x + 0.5 / layout.metresPerUnit, y: item.y + 0.5 / layout.metresPerUnit }; p.onCommit(addItems(layout, [c])); p.onSelect({ kind: "item", id: c.id }); }} title={t("同一個 entity 再放一顆，狀態同步")}>{t("複製")}</Button>
        <Button variant="danger" icon={<Ic.trash size={16} />} onClick={() => { p.onCommit(removeItem(layout, item.id)); p.onSelect(null); p.onNotify?.(t("已移除裝置，可用復原鍵還原")); }}>{t("移除")}</Button>
      </PanelActions>
    </>
  );
}
