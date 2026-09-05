import type { Item, Layout } from "../domain/types";
import { t } from "../i18n";
import { resolveKind } from "../domain/entities";
import { coverInward, coverView, curtainPanels, wallInward } from "../domain/covers";
import { effectiveBeam, fixturePositions, hugsWall } from "../domain/entities";
import { DomainGlyph, ModeGlyph } from "./glyphs";
import { domainOf, friendlyName, type HassLike } from "../ha/types";

export interface MarkerProps {
  item: Item;
  layout: Layout;
  hass: HassLike;
  selected: boolean;
  onPointerDown: (e: React.PointerEvent, item: Item) => void;
}

/**
 * Colour of a light when on. Priority: user override → HA rgb_color (colour-temp
 * lights are blended toward white so 2700K reads as warm white, not orange) →
 * color_temp_kelvin → default warm white.
 */
export function lightColor(hass: HassLike, entityId: string, override?: string | null): string {
  const s = hass.states[entityId];
  if (!s || s.state !== "on") return "#b8bcc2";
  if (override) return override;
  const mode = s.attributes.color_mode as string | undefined;
  const kelvin = s.attributes.color_temp_kelvin as number | undefined;
  if (mode === "color_temp" && kelvin) return kelvinToHex(kelvin);
  const rgb = s.attributes.rgb_color as number[] | undefined;
  if (rgb && rgb.length === 3) return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
  if (kelvin) return kelvinToHex(kelvin);
  return kelvinToHex(2700);
}

/** Colour temperature → display hex (Tanner Helland approximation, softened toward white). */
export function kelvinToHex(kelvin: number): string {
  const t = Math.min(12000, Math.max(1000, kelvin)) / 100;
  let r: number;
  let g: number;
  let b: number;
  if (t <= 66) {
    r = 255;
    g = 99.47 * Math.log(t) - 161.12;
    b = t <= 19 ? 0 : 138.52 * Math.log(t - 10) - 305.04;
  } else {
    r = 329.7 * Math.pow(t - 60, -0.1332);
    g = 288.12 * Math.pow(t - 60, -0.0755);
    b = 255;
  }
  const soften = (v: number) => Math.round(Math.min(255, Math.max(0, v)) * 0.55 + 255 * 0.45);
  return "#" + [r, g, b].map((v) => soften(v).toString(16).padStart(2, "0")).join("");
}

export const KELVIN_PRESETS: { k: number; label: string }[] = [
  { k: 2700, label: t("2700K 暖") },
  { k: 3000, label: "3000K" },
  { k: 4000, label: t("4000K 自然") },
  { k: 5000, label: "5000K" },
  { k: 6500, label: t("6500K 冷") },
];

export function brightness01(hass: HassLike, entityId: string): number {
  const s = hass.states[entityId];
  if (!s || s.state !== "on") return 0;
  const b = s.attributes.brightness as number | undefined;
  return b === undefined ? 1 : Math.max(0.15, b / 255);
}

const HVAC_COLOR: Record<string, string> = { cool: "#3b82f6", heat: "#f97316", dry: "#eab308", fan_only: "#14b8a6", heat_cool: "#a855f7", auto: "#a855f7", off: "#9ca3af" };

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

  if (kind === "light") {
    const side = hugsWall(item, hass) ? (wallInward(layout, item).flip ? -1 : 1) : 0;
    const beam = effectiveBeam(item, hass);
    const pts = fixturePositions(item, layout.metresPerUnit);
    if (pts.length === 1) return <g {...common}>{ring}<LightGlyph item={item} hass={hass} m={m} side={side} beam={beam} /></g>;
    // repeated fixtures: draw each at its own spot, rotation applied per fixture
    const xs = pts.map((q) => q[0]);
    const ys = pts.map((q) => q[1]);
    const pad = 0.35 * m;
    return (
      <g className="dh-marker" onPointerDown={(e: React.PointerEvent) => props.onPointerDown(e, item)} style={{ cursor: "pointer" }}>
        {props.selected && <rect x={Math.min(...xs) - pad} y={Math.min(...ys) - pad} width={Math.max(...xs) - Math.min(...xs) + 2 * pad} height={Math.max(...ys) - Math.min(...ys) + 2 * pad} rx={0.15 * m} fill="none" stroke="#2563eb" strokeWidth={0.03 * m} strokeDasharray={`${0.08 * m} ${0.05 * m}`} />}
        {pts.map((q, i) => (
          <g key={i} transform={`translate(${q[0]} ${q[1]}) rotate(${item.rotation ?? 0})`}>
            <LightGlyph item={item} hass={hass} m={m} side={side} beam={beam} />
          </g>
        ))}
        {props.selected && <text x={Math.max(...xs) + pad} y={Math.min(...ys) - pad + 0.2 * m} fontSize={0.18 * m} fill="#2563eb">×{pts.length}</text>}
      </g>
    );
  }
  if (kind === "climate") return <g {...common}>{ring}<ClimateChip item={item} hass={hass} m={m} /></g>;
  if (kind === "presence") return <g {...common}>{ring}<PresenceDot item={item} hass={hass} m={m} /></g>;
  if (kind === "cover") return <g {...common}>{ring}<CoverGlyph item={item} hass={hass} m={m} flip={coverInward(layout, item).flip} /></g>;
  return <g {...common}>{ring}<GenericChip item={item} hass={hass} m={m} /></g>;
}

/** side: 0 = free-standing (symmetric glow), ±1 = which local-y side faces the room. */
function LightGlyph({ item, hass, m, side, beam }: { item: Item; hass: HassLike; m: number; side: number; beam: string }) {
  const s = hass.states[item.entityId];
  const on = s?.state === "on";
  const color = lightColor(hass, item.entityId, item.color);
  const b = brightness01(hass, item.entityId);
  const stroke = on ? "#6b5a2a" : "#6b7280";
  const glow = on ? <circle r={0.55 * m} fill={color} opacity={0.18 + 0.35 * b} filter="url(#dh-glow)" /> : null;
  const fixture = item.fixture ?? "downlight";
  switch (fixture) {
    case "room":
      return (
        <>
          <circle r={0.2 * m} fill={on ? color : "#fff"} fillOpacity={on ? 0.35 : 0.6} stroke={stroke} strokeWidth={0.02 * m} strokeDasharray={`${0.06 * m} ${0.04 * m}`} />
          <path d={`M ${-0.08 * m} ${0.02 * m} a ${0.08 * m} ${0.08 * m} 0 1 1 ${0.16 * m} 0`} fill="none" stroke={stroke} strokeWidth={0.02 * m} />
        </>
      );
    case "strip": {
      const L = (item.length ?? 1) * m;
      // Wall-mounted: glow spills into the room on one side; ceiling-mounted: symmetric.
      const spill = side === 0 ? 0 : side * (beam === "up" ? 0.35 : 0.25) * m;
      const gh = side === 0 ? 0.24 * m : (beam === "up" ? 0.7 : 0.5) * m;
      const gy = side === 0 ? -0.12 * m : spill > 0 ? 0 : -gh;
      return (
        <>
          {on && <rect x={-L / 2 - 0.1 * m} y={gy} width={L + 0.2 * m} height={gh} rx={0.12 * m} fill={color} opacity={side === 0 ? 0.35 : 0.28} filter="url(#dh-glow)" />}
          <rect x={-L / 2} y={-0.05 * m} width={L} height={0.1 * m} rx={0.05 * m} fill={on ? color : "#fff"} stroke={stroke} strokeWidth={0.02 * m} />
          {side !== 0 && on && <path d={`M ${-0.12 * m} ${side * 0.12 * m} L 0 ${side * 0.22 * m} L ${0.12 * m} ${side * 0.12 * m}`} fill="none" stroke={stroke} strokeWidth={0.02 * m} opacity={0.6} />}
        </>
      );
    }
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
      <g transform={`translate(${-w / 2 + 0.25 * m} 0)`}><ModeGlyph mode={mode} s={0.3 * m} color={color} /></g>
      <text x={-w / 2 + 0.42 * m} y={-0.02 * m} fontSize={fs} fill="#111" fontWeight={600}>{cur !== undefined ? `${cur.toFixed(1)}°` : "--"}</text>
      <text x={-w / 2 + 0.42 * m} y={0.22 * m} fontSize={fs * 0.75} fill="#6b7280">{target !== undefined && mode !== "off" ? `→${target}°` : mode === "off" ? t("關") : ""}</text>
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
      <text y={0.04 * m} fontSize={0.14 * m} textAnchor="middle" fill={on ? "#fff" : "#15803d"}>{t("人")}</text>
    </>
  );
}

/** Top-view cover along its wall: fabric = dark bars, open gap = light. Percent label stays upright. */
function CoverGlyph({ item, hass, m, flip }: { item: Item; hass: HassLike; m: number; flip: boolean }) {
  const side = flip ? -1 : 1;
  const v = coverView(hass, item);
  const L = (item.length ?? 1.5) * m;
  const t = 0.16 * m;
  const fabric = v.unknown ? "#9ca3af" : "#475569";
  const glass = "#bae6fd";
  const pct = `${Math.round(v.open * 100)}%`;
  let body: React.ReactNode;
  if (v.style === "curtain") {
    const panels = curtainPanels(L, v.open, item.coverDraw, flip);
    body = (
      <>
        <rect x={-L / 2} y={-t / 2} width={L} height={t} fill={glass} stroke="#7dd3fc" strokeWidth={0.015 * m} />
        {panels.map((pn, i) => <path key={i} d={wave(pn.x0, pn.w, t, m)} fill={fabric} />)}
      </>
    );
  } else if (v.style === "roller") {
    const closed = (1 - v.open) * L;
    body = (
      <>
        <rect x={-L / 2} y={-t / 2} width={L} height={t} fill={glass} stroke="#7dd3fc" strokeWidth={0.015 * m} />
        <rect x={-L / 2} y={-t / 2} width={closed} height={t} fill={fabric} />
        <rect x={-L / 2} y={-t / 2 - 0.04 * m} width={L} height={0.05 * m} fill="#1f2937" />
      </>
    );
  } else {
    // blind: slats across the width, rotated by tilt (0 = flat/closed, 1 = fully open)
    const n = Math.max(3, Math.round(L / (0.12 * m)));
    const ang = 80 - v.tilt * 80;
    const closed = (1 - v.open) * L;
    body = (
      <>
        <rect x={-L / 2} y={-t / 2} width={L} height={t} fill={glass} stroke="#7dd3fc" strokeWidth={0.015 * m} />
        {Array.from({ length: n }, (_, i) => -L / 2 + ((i + 0.5) * L) / n).filter((x) => x < -L / 2 + closed + 1e-6).map((x, i) => (
          <line key={i} x1={x} y1={-t / 2} x2={x} y2={t / 2} stroke={fabric} strokeWidth={0.03 * m} transform={`rotate(${ang} ${x} 0)`} />
        ))}
      </>
    );
  }
  return (
    <>
      {body}
      <g transform={`translate(0 ${side * 0.24 * m}) rotate(${-(item.rotation ?? 0)})`}>
        <rect x={-0.22 * m} y={-0.1 * m} width={0.44 * m} height={0.2 * m} rx={0.1 * m} fill="#fff" stroke="#94a3b8" strokeWidth={0.012 * m} />
        <text y={0.05 * m} fontSize={0.15 * m} textAnchor="middle" fill="#0f172a">{v.moving ? "…" : pct}</text>
      </g>
    </>
  );
}

function wave(x0: number, w: number, t: number, m: number): string {
  if (w <= 0) return "";
  const n = Math.max(1, Math.round(w / (0.1 * m)));
  const step = w / n;
  let d = `M ${x0} ${-t / 2}`;
  for (let i = 0; i < n; i++) d += ` q ${step / 2} ${(i % 2 ? -1 : 1) * t * 0.6} ${step} 0`;
  d += ` L ${x0 + w} ${t / 2}`;
  for (let i = n - 1; i >= 0; i--) d += ` q ${-step / 2} ${(i % 2 ? 1 : -1) * t * 0.6} ${-step} 0`;
  return d + " Z";
}


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
      <g transform={`translate(${-w / 2 + 0.22 * m} 0)`}><DomainGlyph dom={dom} s={0.22 * m} color={active ? "#1d4ed8" : "#374151"} /></g>
      <text x={0.1 * m} y={0.07 * m} fontSize={0.19 * m} textAnchor="middle" fill="#111">{text}</text>
      <text y={h / 2 + 0.2 * m} fontSize={0.15 * m} textAnchor="middle" fill="#6b7280">{label}</text>
    </>
  );
}
