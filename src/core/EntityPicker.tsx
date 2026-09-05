import { useMemo, useState } from "react";
import { entitiesInArea, PLACEABLE_DOMAINS } from "../domain/entities";
import type { Layout, Room } from "../domain/types";
import { domainOf, friendlyName, type HassLike } from "../ha/types";

export interface EntityPickerProps {
  hass: HassLike;
  layout: Layout;
  /** When set, the area's entities are listed first and additions land in this room. */
  room?: Room | null;
  onAdd: (entityIds: string[]) => void;
}

const DOMAIN_LABEL: Record<string, string> = {
  light: "燈", switch: "開關", climate: "冷氣", fan: "風扇", cover: "窗簾", binary_sensor: "感測", sensor: "數值",
  media_player: "媒體", lock: "門鎖", vacuum: "掃地", humidifier: "除濕",
};
const DOMAIN_ORDER = ["light", "switch", "climate", "fan", "cover", "binary_sensor", "sensor", "media_player", "lock", "vacuum", "humidifier"];

/**
 * Search / filter / pick entities one by one, a few at a time, or a whole device.
 * Works with hundreds of entities: results are capped and grouped by device.
 */
export function EntityPicker({ hass, layout, room, onAdd }: EntityPickerProps) {
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
      return { devId, name: dev ? (dev.name_by_user || dev.name || devId) : "未歸屬裝置", area, ids };
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

  const Row = ({ id }: { id: string }) => {
    const isPlaced = placed.has(id);
    const dom = domainOf(id);
    return (
      <li className={checked.has(id) ? "sel" : ""} style={{ gap: 6 }}>
        <input type="checkbox" disabled={isPlaced} checked={checked.has(id)} onChange={() => toggle(id)} style={{ width: "auto" }} />
        <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} onClick={() => !isPlaced && toggle(id)}>
          <span className="dh-muted" style={{ marginRight: 4 }}>{DOMAIN_LABEL[dom] ?? dom}</span>
          {friendlyName(hass, id)}
          <span className="dh-muted" style={{ marginLeft: 6, fontSize: 11 }}>{id}</span>
        </span>
        {isPlaced ? <span className="dh-muted">已放</span> : <button className="dh-btn small" onClick={() => addNow([id])}>加入</button>}
      </li>
    );
  };

  return (
    <div>
      <div className="dh-field">
        <input value={q} placeholder="搜尋名稱、entity id 或裝置…" onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="dh-row" style={{ marginBottom: 6 }}>
        <button className={`dh-btn small${domain === null ? " on" : ""}`} onClick={() => setDomain(null)}>全部</button>
        {domains.map((d) => <button key={d} className={`dh-btn small${domain === d ? " on" : ""}`} onClick={() => setDomain(domain === d ? null : d)}>{DOMAIN_LABEL[d] ?? d}</button>)}
      </div>
      {checked.size > 0 && (
        <div className="dh-row" style={{ marginBottom: 8 }}>
          <button className="dh-btn on" onClick={() => addNow([...checked])}>加入勾選的 {checked.size} 個</button>
          <button className="dh-btn small" onClick={() => setChecked(new Set())}>清除勾選</button>
        </div>
      )}

      {room && (
        <>
          <div className="dh-row" style={{ justifyContent: "space-between" }}>
            <span className="dh-muted">{room.areaId ? `${hass.areas[room.areaId]?.name ?? room.areaId} 的裝置 (${areaRows.length})` : "這間房間還沒連結 area"}</span>
            {areaRows.some((id) => !placed.has(id)) && <button className="dh-btn small" onClick={() => addNow(areaRows)}>全部加入</button>}
          </div>
          <ul className="dh-list">{areaRows.map((id) => <Row key={id} id={id} />)}</ul>
          {!showAll && !needle && !domain && (
            <button className="dh-btn small" style={{ marginTop: 6 }} onClick={() => setShowAll(true)}>顯示其他房間 / 所有裝置</button>
          )}
        </>
      )}

      {(showAll || needle || domain) && (
        <div style={{ marginTop: 8 }}>
          {room && <div className="dh-muted" style={{ marginBottom: 4 }}>其他裝置</div>}
          {groups.map((g) => {
            if (shown >= CAP) return null;
            const rows = g.ids.slice(0, Math.max(0, CAP - shown));
            shown += rows.length;
            const addable = g.ids.filter((id) => !placed.has(id));
            return (
              <div key={g.devId || "none"} style={{ marginBottom: 6 }}>
                <div className="dh-row" style={{ justifyContent: "space-between", padding: "2px 4px" }}>
                  <span style={{ fontWeight: 600, fontSize: 12 }}>{g.name}{g.area ? <span className="dh-muted"> · {g.area}</span> : null}</span>
                  {g.devId && addable.length > 1 && <button className="dh-btn small" onClick={() => addNow(addable)}>整個裝置 ({addable.length})</button>}
                </div>
                <ul className="dh-list">{rows.map((id) => <Row key={id} id={id} />)}</ul>
              </div>
            );
          })}
          {rest.length === 0 && <div className="dh-muted">沒有符合的裝置</div>}
          {rest.length > CAP && <div className="dh-muted">只顯示前 {CAP} 個，輸入關鍵字縮小範圍</div>}
        </div>
      )}
    </div>
  );
}
