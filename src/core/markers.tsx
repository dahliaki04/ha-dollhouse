import type { Item, Layout } from "../domain/types";
import { resolveKind } from "../domain/entities";
import { domainOf, friendlyName, type HassLike } from "../ha/types";

export interface MarkerProps {
  item: Item;
  layout: Layout;
  hass: HassLike;
  selected: boolean;
  onPointerDown: (e: React.PointerEvent, item: Item) => void;
}

/** Colour of a light when on, from rgb_color / color_temp, else warm white. */
export function lightColor(hass: HassLike, entityId: string): string {
  const s = hass.states[entityId];
  if (!s || s.state !== "on") return "#b8bcc2";
  const rgb = s.attributes.rgb_color as number[] | undefined;
  if (rgb && rgb.length === 3) return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
  const kelvin = s.attributes.color_temp_kelvin as number | undefined;
  if (kelvin && kelvin > 4500) return "#f4f7ff";
  return "#ffcf7a";
}

export function brightness01(hass: HassLike, entityId: string): number {
  const s = hass.states[entityId];
  if (!s || s.state !== "on") return 0;
  const b = s.attributes.brightness as number | undefined;
  return b === undefined ? 1 : Math.max(0.15, b / 255);
}

const HVAC_COLOR: Record<string, string> = { cool: "#3b82f6", heat: "#f97316", dry: "#eab308", fan_only: "#14b8a6", heat_cool: "#a855f7", auto: "#a855f7", off: "#9ca3af" };
const HVAC_GLYPH: Record<string, string> = { cool: "❄", heat: "☀", dry: "💧", fan_only: "✦", heat_cool: "⇅", auto: "A", off: "○" };

export function Marker(props: MarkerProps) {
  const { item, layout, hass } = props;
  const kind = resolveKind(item, hass);
  const m = 1 / layout.metresPerUnit; // units per metre
  const common = {
    transform: `translate(${item.x} ${item.y}) rotate(${item.rotation ?? 0})`,
    onPointerDown: (e: React.PointerEvent) => props.onPointerDown(e, item),
    style: { cursor: "pointer" } as React.CSSProperties,
    className: "dh-marker",
  };
  const ring = props.selected ? <circle r={0.32 * m} fill="none" stroke="#2563eb" strokeWidth={0.03 * m} strokeDasharray={`${0.06 * m} ${0.04 * m}`} /> : null;

  if (kind === "light") return <g {...common}>{ring}<LightGlyph item={item} hass={hass} m={m} /></g>;
  if (kind === "climate") return <g {...common}>{ring}<ClimateChip item={item} hass={hass} m={m} /></g>;
  if (kind === "presence") return <g {...common}>{ring}<PresenceDot item={item} hass={hass} m={m} /></g>;
  return <g {...common}>{ring}<GenericChip item={item} hass={hass} m={m} /></g>;
}

function LightGlyph({ item, hass, m }: { item: Item; hass: HassLike; m: number }) {
  const s = hass.states[item.entityId];
  const on = s?.state === "on";
  const color = lightColor(hass, item.entityId);
  const b = brightness01(hass, item.entityId);
  const stroke = on ? "#6b5a2a" : "#6b7280";
  const glow = on ? <circle r={0.55 * m} fill={color} opacity={0.18 + 0.35 * b} filter="url(#dh-glow)" /> : null;
  const fixture = item.fixture ?? "downlight";
  switch (fixture) {
    case "strip":
      return (
        <>
          {on && <rect x={-0.6 * m} y={-0.12 * m} width={1.2 * m} height={0.24 * m} rx={0.12 * m} fill={color} opacity={0.35} filter="url(#dh-glow)" />}
          <rect x={-0.5 * m} y={-0.05 * m} width={1.0 * m} height={0.1 * m} rx={0.05 * m} fill={on ? color : "#fff"} stroke={stroke} strokeWidth={0.02 * m} />
        </>
      );
    case "wall":
      return (
        <>
          {glow}
          <path d={`M ${-0.16 * m} 0 A ${0.16 * m} ${0.16 * m} 0 0 1 ${0.16 * m} 0 Z`} fill={on ? color : "#fff"} stroke={stroke} strokeWidth={0.02 * m} />
          <line x1={-0.2 * m} y1={0} x2={0.2 * m} y2={0} stroke={stroke} strokeWidth={0.03 * m} />
        </>
      );
    case "pendant":
      return (
        <>
          {glow}
          <circle r={0.16 * m} fill={on ? color : "#fff"} stroke={stroke} strokeWidth={0.02 * m} />
          <circle r={0.05 * m} fill={stroke} />
        </>
      );
    case "ceiling":
      return (
        <>
          {glow}
          <circle r={0.22 * m} fill={on ? color : "#fff"} stroke={stroke} strokeWidth={0.02 * m} />
          <circle r={0.12 * m} fill="none" stroke={stroke} strokeWidth={0.015 * m} />
        </>
      );
    default:
      return (
        <>
          {glow}
          <circle r={0.13 * m} fill={on ? color : "#fff"} stroke={stroke} strokeWidth={0.02 * m} />
          <circle r={0.06 * m} fill="none" stroke={stroke} strokeWidth={0.015 * m} />
        </>
      );
  }
}

function ClimateChip({ item, hass, m }: { item: Item; hass: HassLike; m: number }) {
  const s = hass.states[item.entityId];
  const mode = s?.state ?? "off";
  const color = HVAC_COLOR[mode] ?? "#9ca3af";
  const cur = s?.attributes.current_temperature as number | undefined;
  const target = s?.attributes.temperature as number | undefined;
  const fan = (s?.attributes.fan_mode as string | undefined) ?? "";
  const fanBars = { low: 1, medium: 2, high: 3, auto: 2 }[fan] ?? (mode === "off" ? 0 : 2);
  const w = 1.6 * m;
  const h = 0.6 * m;
  const fs = 0.22 * m;
  return (
    <>
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={0.12 * m} fill="#fff" stroke={color} strokeWidth={0.04 * m} />
      <text x={-w / 2 + 0.12 * m} y={0.08 * m} fontSize={fs * 1.2} fill={color}>{HVAC_GLYPH[mode] ?? "○"}</text>
      <text x={-w / 2 + 0.42 * m} y={-0.02 * m} fontSize={fs} fill="#111" fontWeight={600}>{cur !== undefined ? `${cur.toFixed(1)}°` : "--"}</text>
      <text x={-w / 2 + 0.42 * m} y={0.22 * m} fontSize={fs * 0.75} fill="#6b7280">{target !== undefined && mode !== "off" ? `→${target}°` : mode === "off" ? "關" : ""}</text>
      {[0, 1, 2].map((i) => (
        <rect key={i} x={w / 2 - 0.4 * m + i * 0.1 * m} y={0.16 * m - (i + 1) * 0.09 * m} width={0.06 * m} height={(i + 1) * 0.09 * m} fill={i < fanBars ? color : "#e5e7eb"} />
      ))}
    </>
  );
}

function PresenceDot({ item, hass, m }: { item: Item; hass: HassLike; m: number }) {
  const on = hass.states[item.entityId]?.state === "on";
  return (
    <>
      {on && <circle r={0.3 * m} fill="#22c55e" opacity={0.25} className="dh-pulse" />}
      <circle r={0.12 * m} fill={on ? "#22c55e" : "#fff"} stroke="#15803d" strokeWidth={0.02 * m} />
      <text y={0.04 * m} fontSize={0.14 * m} textAnchor="middle" fill={on ? "#fff" : "#15803d"}>人</text>
    </>
  );
}

const DOMAIN_GLYPH: Record<string, string> = { switch: "⏻", fan: "✢", cover: "▤", media_player: "♪", sensor: "◎", binary_sensor: "◉", lock: "🔒", vacuum: "⌂", humidifier: "≈" };

function GenericChip({ item, hass, m }: { item: Item; hass: HassLike; m: number }) {
  const s = hass.states[item.entityId];
  const dom = domainOf(item.entityId);
  const raw = item.attribute ? s?.attributes[item.attribute] : s?.state;
  const unit = item.attribute ? "" : ((s?.attributes.unit_of_measurement as string | undefined) ?? "");
  const text = raw === undefined || raw === null ? "?" : `${typeof raw === "number" ? Math.round(raw * 10) / 10 : String(raw)}${unit}`;
  const active = s?.state === "on" || s?.state === "open" || s?.state === "playing";
  const label = item.label ?? friendlyName(hass, item.entityId);
  const w = Math.max(1.0, 0.2 + text.length * 0.14) * m;
  const h = 0.44 * m;
  return (
    <>
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={h / 2} fill={active ? "#dbeafe" : "#fff"} stroke={active ? "#2563eb" : "#9ca3af"} strokeWidth={0.025 * m} />
      <text x={-w / 2 + 0.14 * m} y={0.07 * m} fontSize={0.2 * m} fill="#374151">{DOMAIN_GLYPH[dom] ?? "•"}</text>
      <text x={0.1 * m} y={0.07 * m} fontSize={0.19 * m} textAnchor="middle" fill="#111">{text}</text>
      <text y={h / 2 + 0.2 * m} fontSize={0.15 * m} textAnchor="middle" fill="#6b7280">{label}</text>
    </>
  );
}
