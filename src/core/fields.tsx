import { useState } from "react";
import { t } from "../i18n";
import type { Item, Layout } from "../domain/types";
import { frameItems, frameValue, makeItem } from "../domain/entities";
import { centroid } from "../domain/geometry";
import { domainOf, friendlyName, type HassLike } from "../ha/types";
import { addItems, removeItem, updateItem, type Selection } from "./useEditor";
import { Button, EmptyState, Field, IconButton, Row, SearchInput, StatePill } from "./ui";
import { Ic } from "./icons";
import { DomainIcon } from "./glyphs";

type Room = Layout["rooms"][number];

/** Domains that never make sense on a floor plan or in a status frame. */
const HIDDEN_DOMAINS = new Set(["automation", "script", "scene", "update", "button", "event", "image", "camera", "zone", "tts", "stt", "conversation", "person", "device_tracker", "input_button", "number", "select", "text"]);

/** Text input with a draft: Enter / 儲存 commits, Esc / 取消 reverts. Nothing is written while typing. */
export function TextField({ label, value, placeholder, onSave, hint }: { label: string; value: string; placeholder?: string; onSave: (v: string) => void; hint?: string }) {
  const [draft, setDraft] = useState(value);
  const [base, setBase] = useState(value);
  if (base !== value) { setBase(value); setDraft(value); } // external change (undo, selection switch)
  const dirty = draft !== value;
  const save = () => { if (dirty) onSave(draft); };
  const cancel = () => setDraft(value);
  return (
    <Field label={label} meta={dirty ? t("未儲存") : undefined} hint={hint}>
      <div className="dh-row nowrap">
        <input
          className="dh-grow"
          value={draft}
          placeholder={placeholder}
          aria-label={label}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); save(); } else if (e.key === "Escape") { e.preventDefault(); cancel(); } }}
        />
        {dirty && <IconButton label={t("儲存")} icon={<Ic.check />} on onClick={save} />}
        {dirty && <IconButton label={t("取消")} icon={<Ic.close />} onClick={cancel} />}
      </div>
    </Field>
  );
}

/** Shows the bound entity; 更換 opens a search to rebind the item to another entity (everything else stays). */
export function EntityField({ hass, value, onChange }: { hass: HassLike; value: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const list = open
    ? Object.keys(hass.states)
        .filter((id) => id !== value && !HIDDEN_DOMAINS.has(domainOf(id)))
        .filter((id) => !needle || needle.split(/\s+/).every((w) => `${id} ${friendlyName(hass, id)}`.toLowerCase().includes(w)))
        .sort((a, b) => (domainOf(a) === domainOf(value) ? 0 : 1) - (domainOf(b) === domainOf(value) ? 0 : 1) || friendlyName(hass, a).localeCompare(friendlyName(hass, b)))
        .slice(0, 30)
    : [];
  return (
    <Field label="Entity" hint={open ? t("換綁只改控制它的 entity；型式、燈組、位置都保留。同 domain 的排前面。") : undefined}>
      <div className="dh-row nowrap">
        <span className="dh-code dh-grow dh-ellipsis" title={value}>{value}</span>
        <Button size="sm" variant={open ? "tonal" : "default"} onClick={() => { setOpen((o) => !o); setQ(""); }}>{open ? t("取消") : t("更換")}</Button>
      </div>
      {open && (
        <>
          <SearchInput autoFocus value={q} placeholder={t("搜尋要改綁的 entity…")} onChange={setQ} />
          <ul className="dh-list boxed scroll">
            {list.map((id) => (
              <Row key={id} lead={<DomainIcon dom={domainOf(id)} size={14} />} primary={friendlyName(hass, id)} secondary={id} trailing={<StatePill state={hass.states[id]?.state} />} onClick={() => { onChange(id); setOpen(false); }} />
            ))}
            {list.length === 0 && <li><EmptyState title={t("沒有符合的裝置")} /></li>}
          </ul>
        </>
      )}
    </Field>
  );
}

/** Pick what a room's status frame shows: any HA entity, ordered, removable. */
export function FrameEditor({ layout, hass, room, onCommit, onSelect }: { layout: Layout; hass: HassLike; room: Room; onCommit: (l: Layout) => void; onSelect: (s: Selection) => void }) {
  const [q, setQ] = useState("");
  const rows = frameItems(layout, room, hass);
  const inFrame = new Set(rows.map((r) => r.entityId));
  const needle = q.trim().toLowerCase();
  const candidates = needle
    ? Object.keys(hass.states)
        .filter((id) => !inFrame.has(id) && !HIDDEN_DOMAINS.has(domainOf(id)))
        .filter((id) => needle.split(/\s+/).every((w) => `${id} ${friendlyName(hass, id)}`.toLowerCase().includes(w)))
        .slice(0, 25)
    : [];
  const c = centroid(room.points);
  const setOrder = (ordered: Item[]) => {
    const map = new Map(ordered.map((it, i) => [it.id, i]));
    onCommit({ ...layout, items: layout.items.map((it) => (map.has(it.id) ? { ...it, order: map.get(it.id) } : it)) });
  };
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= rows.length) return;
    const next = rows.slice();
    [next[i], next[j]] = [next[j], next[i]];
    setOrder(next);
  };
  const add = (entityId: string) => {
    const jitter = (rows.length % 5) * 0.15 / layout.metresPerUnit;
    const it = { ...makeItem(hass, entityId, c[0] + jitter, c[1] + jitter), showIn: "frame" as const, order: rows.length };
    onCommit(addItems(layout, [it]));
    setQ("");
  };
  return (
    <>
      {rows.length === 0 ? (
        <EmptyState title={t("狀態框還是空的")} hint={t("下面搜尋任何 entity 加進來；數值型裝置加入房間時也會自動進來。")} />
      ) : (
        <ul className="dh-list boxed">
          {rows.map((it, i) => {
            const v = frameValue(it, hass);
            return (
              <Row
                key={it.id}
                lead={<DomainIcon dom={domainOf(it.entityId)} size={14} />}
                primary={<><b>{v.text}</b><span className="dh-muted dh-ellipsis">{it.label ?? friendlyName(hass, it.entityId)}</span></>}
                onClick={() => onSelect({ kind: "item", id: it.id })}
                title={t("到裝置面板改顯示的屬性、標籤")}
                trailing={
                  <>
                    <IconButton size="sm" label={t("上移")} icon={<Ic.up size={15} />} disabled={i === 0} onClick={() => move(i, -1)} />
                    <IconButton size="sm" label={t("下移")} icon={<Ic.down size={15} />} disabled={i === rows.length - 1} onClick={() => move(i, 1)} />
                    <IconButton size="sm" label={t("改顯示在平面圖上")} icon={<Ic.arrowOut size={15} />} onClick={() => onCommit(updateItem(layout, it.id, { showIn: "plan" }))} />
                    <IconButton size="sm" danger label={t("移除")} icon={<Ic.close size={15} />} onClick={() => onCommit(removeItem(layout, it.id))} />
                  </>
                }
              />
            );
          })}
        </ul>
      )}
      <div style={{ marginTop: 8 }}>
        <SearchInput value={q} placeholder={t("搜尋 entity 加進狀態框…")} onChange={setQ} />
      </div>
      {candidates.length > 0 && (
        <ul className="dh-list boxed scroll" style={{ marginTop: 6 }}>
          {candidates.map((id) => (
            <Row key={id} lead={<DomainIcon dom={domainOf(id)} size={14} />} primary={friendlyName(hass, id)} secondary={id} trailing={<><StatePill state={hass.states[id]?.state} /><IconButton size="sm" label={t("加入")} icon={<Ic.plus size={16} />} onClick={() => add(id)} /></>} />
          ))}
        </ul>
      )}
      {needle && candidates.length === 0 && <div className="dh-help-text">{t("沒有符合的裝置")}</div>}
    </>
  );
}
