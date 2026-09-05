import { shade, type Furniture } from "../domain/furniture";

export interface FurnitureGlyphProps {
  f: Furniture;
  /** canvas units per metre */
  m: number;
  selected: boolean;
  onPointerDown: (e: React.PointerEvent, f: Furniture) => void;
}

/** Top-down furniture symbol. Drawn in local space: width along x, depth along y, origin at centre. */
export function FurnitureGlyph({ f, m, selected, onPointerDown }: FurnitureGlyphProps) {
  const W = f.w * m;
  const D = f.d * m;
  const c = f.color;
  const dark = shade(c, 0.78);
  const light = shade(c, 1.12);
  const sw = 0.02 * m;
  const body = (() => {
    switch (f.type) {
      case "sofa":
      case "armchair": {
        const arm = Math.min(0.18 * m, W * 0.15);
        const back = Math.min(0.22 * m, D * 0.3);
        return (
          <>
            <rect x={-W / 2} y={-D / 2} width={W} height={D} rx={0.08 * m} fill={c} stroke={dark} strokeWidth={sw} />
            <rect x={-W / 2} y={-D / 2} width={W} height={back} rx={0.06 * m} fill={dark} />
            <rect x={-W / 2} y={-D / 2} width={arm} height={D} rx={0.06 * m} fill={dark} />
            <rect x={W / 2 - arm} y={-D / 2} width={arm} height={D} rx={0.06 * m} fill={dark} />
            {f.type === "sofa" && Array.from({ length: Math.max(1, Math.round((W - 2 * arm) / (0.7 * m))) }, (_, i, a) => (
              <line key={i} x1={-W / 2 + arm + ((i + 1) * (W - 2 * arm)) / (a.length + 0)} y1={-D / 2 + back} x2={-W / 2 + arm + ((i + 1) * (W - 2 * arm)) / (a.length + 0)} y2={D / 2} stroke={dark} strokeWidth={sw} opacity={i === a.length - 1 ? 0 : 1} />
            ))}
          </>
        );
      }
      case "bed": {
        const pillowW = Math.min(0.6 * m, W * 0.42);
        const head = 0.1 * m;
        return (
          <>
            <rect x={-W / 2} y={-D / 2} width={W} height={D} rx={0.04 * m} fill={c} stroke={dark} strokeWidth={sw} />
            <rect x={-W / 2} y={-D / 2} width={W} height={head} fill={dark} />
            <rect x={-W / 2 + 0.08 * m} y={-D / 2 + head + 0.06 * m} width={pillowW} height={0.35 * m} rx={0.06 * m} fill="#fff" stroke={dark} strokeWidth={sw} />
            {W > 1.2 * m && <rect x={W / 2 - 0.08 * m - pillowW} y={-D / 2 + head + 0.06 * m} width={pillowW} height={0.35 * m} rx={0.06 * m} fill="#fff" stroke={dark} strokeWidth={sw} />}
            <rect x={-W / 2 + 0.05 * m} y={-D / 2 + head + 0.55 * m} width={W - 0.1 * m} height={D - head - 0.6 * m} rx={0.05 * m} fill={light} stroke={dark} strokeWidth={sw} />
          </>
        );
      }
      case "table":
      case "desk":
      case "coffee":
        return <rect x={-W / 2} y={-D / 2} width={W} height={D} rx={f.type === "coffee" ? 0.1 * m : 0.03 * m} fill={c} stroke={dark} strokeWidth={sw} />;
      case "chair":
        return (
          <>
            <rect x={-W / 2} y={-D / 2} width={W} height={D} rx={0.05 * m} fill={c} stroke={dark} strokeWidth={sw} />
            <rect x={-W / 2} y={-D / 2} width={W} height={0.08 * m} fill={dark} />
          </>
        );
      case "wardrobe":
      case "cabinet":
        return (
          <>
            <rect x={-W / 2} y={-D / 2} width={W} height={D} fill={c} stroke={dark} strokeWidth={sw} />
            <line x1={0} y1={-D / 2} x2={0} y2={D / 2} stroke={dark} strokeWidth={sw} />
            <line x1={-W / 2} y1={D / 2} x2={W / 2} y2={D / 2} stroke={dark} strokeWidth={sw * 2} />
          </>
        );
      case "tv":
        return (
          <>
            <rect x={-W / 2} y={-D / 2} width={W} height={D} fill={c} stroke={dark} strokeWidth={sw} />
            <rect x={-W * 0.38} y={-D / 2 + 0.05 * m} width={W * 0.76} height={0.05 * m} fill="#111827" />
          </>
        );
      case "fridge":
        return (
          <>
            <rect x={-W / 2} y={-D / 2} width={W} height={D} fill={c} stroke={dark} strokeWidth={sw} />
            <line x1={-W / 2} y1={D / 2 - 0.06 * m} x2={W / 2} y2={D / 2 - 0.06 * m} stroke={dark} strokeWidth={sw} />
          </>
        );
      case "counter":
        return (
          <>
            <rect x={-W / 2} y={-D / 2} width={W} height={D} fill={c} stroke={dark} strokeWidth={sw} />
            <rect x={-W / 2 + 0.2 * m} y={-D / 2 + 0.1 * m} width={0.5 * m} height={D - 0.2 * m} rx={0.04 * m} fill="none" stroke={dark} strokeWidth={sw} />
            {[0, 1, 2, 3].map((i) => <circle key={i} cx={W / 2 - 0.35 * m - (i % 2) * 0.25 * m} cy={-D / 2 + 0.18 * m + Math.floor(i / 2) * 0.25 * m} r={0.08 * m} fill="none" stroke={dark} strokeWidth={sw} />)}
          </>
        );
      case "toilet":
        return (
          <>
            <rect x={-W / 2} y={-D / 2} width={W} height={0.2 * m} rx={0.03 * m} fill={c} stroke={dark} strokeWidth={sw} />
            <ellipse cx={0} cy={0.12 * m} rx={W / 2} ry={D / 2 - 0.15 * m} fill={c} stroke={dark} strokeWidth={sw} />
          </>
        );
      case "bathtub":
        return (
          <>
            <rect x={-W / 2} y={-D / 2} width={W} height={D} rx={0.12 * m} fill={c} stroke={dark} strokeWidth={sw} />
            <rect x={-W / 2 + 0.08 * m} y={-D / 2 + 0.08 * m} width={W - 0.16 * m} height={D - 0.16 * m} rx={0.12 * m} fill="#e0f2fe" stroke={dark} strokeWidth={sw} />
          </>
        );
      case "sink":
        return (
          <>
            <rect x={-W / 2} y={-D / 2} width={W} height={D} rx={0.03 * m} fill={c} stroke={dark} strokeWidth={sw} />
            <ellipse cx={0} cy={0} rx={W * 0.32} ry={D * 0.3} fill="#e0f2fe" stroke={dark} strokeWidth={sw} />
          </>
        );
      case "plant":
        return (
          <>
            <circle r={W / 2} fill={c} stroke={shade(c, 0.7)} strokeWidth={sw} />
            <circle r={W / 5} fill={shade(c, 1.3)} />
          </>
        );
      case "rug":
        return <rect x={-W / 2} y={-D / 2} width={W} height={D} rx={0.06 * m} fill={c} fillOpacity={0.7} stroke={dark} strokeWidth={sw} strokeDasharray={`${0.08 * m} ${0.05 * m}`} />;
    }
  })();
  return (
    <g className="dh-furn" transform={`translate(${f.x} ${f.y}) rotate(${f.rotation})`} onPointerDown={(e) => onPointerDown(e, f)} style={{ cursor: "move" }}>
      {body}
      {selected && <rect x={-W / 2 - 0.05 * m} y={-D / 2 - 0.05 * m} width={W + 0.1 * m} height={D + 0.1 * m} fill="none" stroke="#2563eb" strokeWidth={0.03 * m} strokeDasharray={`${0.08 * m} ${0.05 * m}`} />}
    </g>
  );
}
