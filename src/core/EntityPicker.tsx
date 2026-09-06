import { useMemo, useState } from "react";
import { t } from "../i18n";
import { entitiesInArea, PLACEABLE_DOMAINS } from "../domain/entities";
import type { Layout, Room } from "../domain/types";
import { domainOf, friendlyName, type HassLike } from "../ha/types";
import { Button, Chip, EmptyState, IconButton, Row, SearchInput, StatePill } from "./ui";
import { Ic } from "./icons";
import { DomainIcon } from "./glyphs";

export interface EntityPickerProps {
  hass: HassLike;
  layout: Layout;
  /** When set, the area's entities are listed first and additions land in this room. */
  room?: Room | null;
  onAdd: (entityIds: string[]) => void;
  /** Remove placed entities from the layout. */
  onRemove?: (entityIds: string[]) => void;
  /** Select a placed entity on the canvas. */
  onFocus?: (entityId: string) => void;
}

const DOMAIN_LABEL: Record<string, string> = {
  light: t("燈"), switch: t("開關"), climate: t("冷氣"), fan: t("風扇"), cover: t("窗簾"), binary_sensor: t("感測"), sensor: t("數值"),
  media_player: t("媒體"), lock: t("門鎖"), vacuum: t("掃地"), humidifier: t("除濕"),
};
const DOMAIN_ORDER = ["light", "switch", "climate", "fan", "cover", "binary_sensor", "sensor", "media_player", "lock", "vacuum", "humidifier"];

/**
 * Search / filter / pick entities one by one, a few at a time, or a whole device.
 * Works with hundreds of entities: results are capped and grouped by device.
 */
export function EntityPicker({ hass, layout, room, onAdd, onRemove, onFocus }: EntityPickerProps) {
  const [q, setQ] = useState("");
  const [domain, setDomain] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(!room);

  const placed = useMemo(() => new Set(layout.items.map((i) => i.entityId)), [layout.items]);

  const all = useMemo(() => {
    const ids = Object.keys(hass.states).filter((id) => PLACEABLE_DOMAINS.has(domainOf(id)));
    return ids.sort((a, b) => friendlyName(hass, a).localeCompare(friendlyName(hass, b)));
  }, [hass]);

  const areaIds = useMemo(() => (room?.areaId ? entitiesInArea(hass, room.areaId) : []), [hass, room?.areaId]);

  const domains = useMemo(() => {
    const present = new Set(all.map(domainOf));
    return DOMAIN_ORDER.filter((d) => present.has(d));
  }, [all]);

  const needle = q.trim().toLowerCase();
  const matches = (id: string) => {
    if (domain && domainOf(id) !== domain) return false;
    if (!needle) return true;
    const e = hass.entities[id];
    const dev = e?.device_id ? hass.devices[e.device_id] : undefined;
    const hay = `${id} ${friendlyName(hass, id)} ${dev?.name_by_user ?? ""} ${dev?.name ?? ""}`.toLowerCase();
    return needle.split(/\s+/).every((w) => hay.includes(w));
  };

  const areaRows = areaIds.filter(matches);
  const rest = (showAll || needle || domain ? all : []).filter((id) => matches(id) && !areaIds.includes(id));

  // Group the rest by device for readability.
  const groups = useMemo(() => {
    const byDev = new Map<string, string[]>();
    for (const id of rest) {
      const e = hass.entities[id];
      const key = e?.device_id ?? "";
      if (!byDev.has(key)) byDev.set(key, []);
      byDev.get(key)!.push(id);
    }
    const out = [...byDev.entries()].map(([devId, ids]) => {
      const dev = devId ? hass.devices[devId] : undefined;
      const area = dev?.area_id ? hass.areas[dev.area_id]?.name : undefined;
      return { devId, name: dev ? (dev.name_by_user || dev.name || devId) : t("未歸屬裝置"), area, ids };
    });
    out.sort((a, b) => a.name.localeCompare(b.name));
    return out;
  }, [rest, hass]);

  const CAP = 80;
  let shown = 0;

  const toggle = (id: string) => {
    const next = new Set(checked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setChecked(next);
  };
  const addNow = (ids: string[]) => {
    const fresh = ids.filter((id) => !placed.has(id));
    if (fresh.length) onAdd(fresh);
    setChecked(new Set([...checked].filter((id) => !fresh.includes(id))));
  };
  const removeNow = (ids: string[]) => {
    const gone = ids.filter((id) => placed.has(id));
    if (gone.length) onRemove?.(gone);
    setChecked(new Set([...checked].filter((id) => !gone.includes(id))));
  };
  const checkedUnplaced = [...checked].filter((id) => !placed.has(id));
  const checkedPlaced = [...checked].filter((id) => placed.has(id));

  const EntityRow = ({ id }: { id: string }) => {
    const isPlaced = placed.has(id);
    return (
      <Row
        lead={<input type="checkbox" checked={checked.has(id)} onChange={() => toggle(id)} aria-label={isPlaced ? t("勾選以移除") : t("勾選以加入")} />}
        selected={checked.has(id)}
        primary={<><DomainIcon dom={domainOf(id)} size={14} /><span className="dh-ellipsis">{friendlyName(hass, id)}</span></>}
        secondary={id}
        onClick={() => (isPlaced ? onFocus?.(id) : toggle(id))}
        title={isPlaced ? t("在畫布上選取") : undefined}
        trailing={
          isPlaced
            ? <><StatePill state={t("已放")} />{onRemove && <IconButton size="sm" danger label={t("移除")} icon={<Ic.close size={15} />} onClick={() => removeNow([id])} />}</>
            : <IconButton size="sm" label={t("加入")} icon={<Ic.plus size={16} />} onClick={() => addNow([id])} />
        }
      />
    );
  };

  return (
    <div className="dh-picker">
      <SearchInput value={q} placeholder={t("搜尋名稱、entity id 或裝置…")} onChange={setQ} />
      <div className="dh-chips" style={{ margin: "8px 0" }}>
        <Chip on={domain === null} onClick={() => setDomain(null)}>{t("全部")}</Chip>
        {domains.map((d) => <Chip key={d} on={domain === d} onClick={() => setDomain(domain === d ? null : d)}>{t(DOMAIN_LABEL[d] ?? d)}</Chip>)}
      </div>
      {checked.size > 0 && (
        <div className="dh-row" style={{ marginBottom: 8 }}>
          {checkedUnplaced.length > 0 && <Button variant="primary" size="sm" icon={<Ic.plus size={14} />} onClick={() => addNow(checkedUnplaced)}>{t("加入勾選的 {n} 個", { n: checkedUnplaced.length })}</Button>}
          {checkedPlaced.length > 0 && onRemove && <Button variant="danger" size="sm" onClick={() => removeNow(checkedPlaced)}>{t("移除勾選的 {n} 個", { n: checkedPlaced.length })}</Button>}
          <Button variant="ghost" size="sm" onClick={() => setChecked(new Set())}>{t("清除勾選")}</Button>
        </div>
      )}

      {room && (
        <>
          <div className="dh-row between">
            <span className="dh-list-cap">{room.areaId ? t("{name} 的裝置 ({n})", { name: hass.areas[room.areaId]?.name ?? room.areaId, n: areaRows.length }) : t("這間房間還沒連結 area")}</span>
            <span className="dh-row" style={{ gap: 2 }}>
              {areaRows.some((id) => !placed.has(id)) && <Button size="sm" variant="ghost" onClick={() => addNow(areaRows)}>{t("全部加入")}</Button>}
              {onRemove && areaRows.some((id) => placed.has(id)) && <Button size="sm" variant="danger" onClick={() => removeNow(areaRows)}>{t("全部移除")}</Button>}
            </span>
          </div>
          <ul className="dh-list">{areaRows.map((id) => <EntityRow key={id} id={id} />)}</ul>
          {!showAll && !needle && !domain && (
            <Button size="sm" variant="ghost" style={{ marginTop: 4 }} icon={<Ic.chevronDown size={14} />} onClick={() => setShowAll(true)}>{t("顯示其他房間 / 所有裝置")}</Button>
          )}
        </>
      )}

      {(showAll || needle || domain) && (
        <div style={{ marginTop: 8 }}>
          {room && <div className="dh-list-cap">{t("其他裝置")}</div>}
          {groups.map((g) => {
            if (shown >= CAP) return null;
            const rows = g.ids.slice(0, Math.max(0, CAP - shown));
            shown += rows.length;
            const addable = g.ids.filter((id) => !placed.has(id));
            return (
              <div key={g.devId || "none"} style={{ marginBottom: 6 }}>
                <div className="dh-row between" style={{ padding: "4px 4px 2px" }}>
                  <span className="dh-ellipsis" style={{ fontWeight: 600, fontSize: 12 }}>{g.name}{g.area ? <span className="dh-muted"> · {g.area}</span> : null}</span>
                  {g.devId && addable.length > 1 && <Button size="sm" variant="ghost" onClick={() => addNow(addable)}>{t("整個裝置 ({n})", { n: addable.length })}</Button>}
                </div>
                <ul className="dh-list">{rows.map((id) => <EntityRow key={id} id={id} />)}</ul>
              </div>
            );
          })}
          {rest.length === 0 && <EmptyState title={t("沒有符合的裝置")} hint={needle ? t("換個關鍵字，或清掉篩選。") : undefined} />}
          {rest.length > CAP && <div className="dh-help-text">{t("只顯示前 {n} 個，輸入關鍵字縮小範圍", { n: CAP })}</div>}
        </div>
      )}
    </div>
  );
}
