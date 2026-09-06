import { t } from "../i18n";
import type { Layout } from "../domain/types";
import { autoPlace, entitiesInArea } from "../domain/entities";
import { centroid, pointInPolygon } from "../domain/geometry";
import { domainOf, friendlyName } from "../ha/types";
import { makeFurniture } from "../domain/furniture";
import { addFurniture, addItems, removeRoom, updateRoom } from "./useEditor";
import { EntityPicker } from "./EntityPicker";
import { Button, ColorInput, EmptyState, Field, Group, IconButton, NumberInput, PanelActions, PanelHeader, Row, Segmented, Select, StatePill } from "./ui";
import { Ic } from "./icons";
import { DomainIcon } from "./glyphs";
import { FrameEditor, TextField } from "./fields";
import { FurnitureChips, type SidebarProps } from "./Sidebar";

type Room = Layout["rooms"][number];

export function RoomPanel(p: SidebarProps & { room: Room }) {
  const { layout, hass, room } = p;
  const areaEntities = room.areaId ? entitiesInArea(hass, room.areaId) : [];
  const placed = new Set(layout.items.map((i) => i.entityId));
  const missing = areaEntities.filter((e) => !placed.has(e));
  const areas = Object.values(hass.areas).sort((a, b) => a.name.localeCompare(b.name));
  const inside = layout.items.filter((i) => pointInPolygon([i.x, i.y], room.points));
  const dead = (id: string) => { const st = hass.states[id]?.state; return !st || st === "unavailable" || st === "unknown"; };
  const removeIds = (ids: string[]) => {
    const set = new Set(ids);
    p.onCommit({ ...layout, items: layout.items.filter((i) => !set.has(i.id)) });
    p.onNotify?.(t("已移除 {n} 個裝置，可用復原鍵還原", { n: ids.length }));
  };
  const m2 = (Math.abs(area(room)) * layout.metresPerUnit ** 2).toFixed(1);

  return (
    <>
      <PanelHeader
        icon={<span className="dh-swatch lg" style={{ background: room.color ?? "#f8fafc" }} />}
        title={room.name}
        subtitle={`${room.areaId ? t("area：{name}", { name: hass.areas[room.areaId]?.name ?? room.areaId }) : t("未連結 area")} · ${m2} m²`}
        onBack={() => p.onSelect(null)}
      />

      <Group title={t("基本")}>
        <TextField label={t("名稱")} value={room.name} onSave={(v) => p.onCommit(updateRoom(layout, room.id, { name: v }))} />
        <Field label="Home Assistant area" meta={room.areaId ? `${areaEntities.length - missing.length}/${areaEntities.length} ${t("已放")}` : undefined}>
          <div className="dh-row nowrap">
            <Select className="dh-grow" label="Home Assistant area" value={room.areaId ?? ""} onChange={(v) => {
              const areaId = v || null;
              const a = areaId ? hass.areas[areaId] : null;
              const rename = a && /^(房間|Room) \d+$/.test(room.name) ? { name: a.name } : {};
              p.onCommit(updateRoom(layout, room.id, { areaId, ...rename }));
            }}>
              <option value="">{t("未連結")}</option>
              {areas.map((a) => <option key={a.area_id} value={a.area_id}>{a.name}</option>)}
            </Select>
            {room.areaId && (
              <Button variant="primary" icon={<Ic.sparkle size={16} />} disabled={missing.length === 0} onClick={() => p.onCommit(addItems(layout, autoPlace(hass, room, missing, layout.items, 1.0 / layout.metresPerUnit, p.walls)))}>{t("填入 {n} 個", { n: missing.length })}</Button>
            )}
          </div>
        </Field>
        <div className="dh-cols">
          <Field label={t("天花板高")}><NumberInput unit="m" label={t("天花板高 (m)")} step={0.1} value={room.height ?? layout.wallDefaults.height} onChange={(v) => p.onCommit(updateRoom(layout, room.id, { height: v }))} /></Field>
          <Field label={t("地板色")}><ColorInput label={t("地板色")} value={room.color ?? "#f8fafc"} onChange={(v) => p.onCommit(updateRoom(layout, room.id, { color: v }))} /></Field>
        </div>
      </Group>

      <Group title={t("狀態框")} right={room.frame ? <Button size="sm" variant="ghost" icon={<Ic.reset size={14} />} onClick={() => p.onCommit(updateRoom(layout, room.id, { frame: null }))}>{t("位置回預設")}</Button> : undefined}>
        <Segmented size="sm" full label={t("狀態框")} value={room.frameHidden ? "hide" : "show"} onChange={(v) => p.onCommit(updateRoom(layout, room.id, { frameHidden: v === "hide" }))} options={[{ v: "show", icon: <Ic.eye size={14} />, label: t("顯示") }, { v: "hide", icon: <Ic.eyeOff size={14} />, label: t("隱藏") }]} />
        <div style={{ marginTop: 10 }}>
          <FrameEditor layout={layout} hass={hass} room={room} onCommit={p.onCommit} onSelect={p.onSelect} />
        </div>
        <div className="dh-help-text">{t("這間的感測數值、人在、開關狀態集中在這個框，可在畫布上拖動。")}</div>
      </Group>

      <Group
        title={t("這間裡的裝置 ({n})", { n: inside.length })}
        right={
          <>
            {inside.some((i) => dead(i.entityId)) && <Button size="sm" variant="ghost" onClick={() => removeIds(inside.filter((i) => dead(i.entityId)).map((i) => i.id))}>{t("移除 unavailable")}</Button>}
            {inside.length > 0 && <Button size="sm" variant="danger" onClick={() => removeIds(inside.map((i) => i.id))}>{t("整間清空")}</Button>}
          </>
        }
      >
        {inside.length === 0 ? (
          <EmptyState title={t("還沒有裝置放在這間。")} hint={t("下面搜尋加入，或連結 area 後按「填入」。")} />
        ) : (
          <ul className="dh-list">
            {inside.map((i) => (
              <Row
                key={i.id}
                lead={<DomainIcon dom={domainOf(i.entityId)} size={15} />}
                primary={friendlyName(hass, i.entityId)}
                secondary={i.entityId}
                dimmed={dead(i.entityId)}
                trailing={<><StatePill state={hass.states[i.entityId]?.state} /><IconButton size="sm" danger label={t("移除")} icon={<Ic.close size={15} />} onClick={() => removeIds([i.id])} /></>}
                onClick={() => p.onSelect({ kind: "item", id: i.id })}
                title={t("在畫布上選取")}
              />
            ))}
          </ul>
        )}
        <div className="dh-help-text">{t("依圖示實際位置判斷，不看 area。")}</div>
      </Group>

      <Group title={t("加入裝置到這間")}>
        <EntityPicker hass={hass} layout={layout} room={room} onAdd={(ids) => {
          const items = autoPlace(hass, room, ids, layout.items, 1.0 / layout.metresPerUnit, p.walls);
          p.onCommit(addItems(layout, items));
          if (items.length === 1) p.onSelect({ kind: "item", id: items[0].id });
        }} onRemove={(ids) => {
          const set = new Set(ids);
          p.onCommit({ ...layout, items: layout.items.filter((i) => !set.has(i.entityId)) });
          p.onNotify?.(t("已移除 {n} 個裝置，可用復原鍵還原", { n: ids.length }));
        }} onFocus={(id) => { const it = layout.items.find((i) => i.entityId === id); if (it) p.onSelect({ kind: "item", id: it.id }); }} />
      </Group>

      <Group title={t("在這間加家具")}>
        <FurnitureChips onPick={(ft) => {
          const c = centroid(room.points);
          const f = makeFurniture(ft, c[0], c[1]);
          p.onCommit(addFurniture(layout, f));
          p.onSelect({ kind: "furniture", id: f.id });
        }} />
      </Group>

      <PanelActions>
        <span className="dh-help-text" style={{ marginTop: 0 }}>{t("{n} 個頂點（選取後可拖頂點）", { n: room.points.length })}{layout.locked ? " · " + t("平面圖已鎖定") : ""}</span>
        <Button variant="danger" icon={<Ic.trash size={16} />} disabled={!!layout.locked} title={layout.locked ? t("平面圖已鎖定") : undefined} onClick={() => { p.onCommit(removeRoom(layout, room.id)); p.onSelect(null); p.onNotify?.(t("已刪除房間，可用工具列的復原鍵還原")); }}>{t("刪除房間")}</Button>
      </PanelActions>
    </>
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
