/**
 * Small vector glyphs drawn with primitives so they render identically on every
 * platform (Android WebView has no font for ⏻ ✦ ⇅ and shows tofu boxes).
 * Each glyph is drawn in a 24×24 box centred at the origin; scale with `s`.
 */

export function DomainGlyph({ dom, s, color }: { dom: string; s: number; color: string }) {
  const k = s / 24;
  const stroke = { fill: "none", stroke: color, strokeWidth: 2.2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  let body: React.ReactNode;
  switch (dom) {
    case "switch":
      body = (
        <>
          <path d="M12 3v9" {...stroke} />
          <path d="M7 6.5a7 7 0 1 0 10 0" {...stroke} />
        </>
      );
      break;
    case "fan":
      body = (
        <>
          <circle cx="12" cy="12" r="2" fill={color} />
          <path d="M12 10c-1-4 1-7 3-6s0 5-3 6zM14 12c4-1 7 1 6 3s-5 0-6-3zM12 14c1 4-1 7-3 6s0-5 3-6zM10 12c-4 1-7-1-6-3s5 0 6 3z" fill={color} />
        </>
      );
      break;
    case "media_player":
      body = (
        <>
          <path d="M9 18V6l11-2v12" {...stroke} />
          <circle cx="6.5" cy="18" r="2.5" fill={color} />
          <circle cx="17.5" cy="16" r="2.5" fill={color} />
        </>
      );
      break;
    case "sensor":
      body = (
        <>
          <path d="M4 16a8 8 0 0 1 16 0" {...stroke} />
          <path d="M12 16l4-6" {...stroke} />
          <circle cx="12" cy="16" r="1.6" fill={color} />
        </>
      );
      break;
    case "binary_sensor":
      body = (
        <>
          <circle cx="12" cy="12" r="2.2" fill={color} />
          <path d="M7.5 7.5a6.4 6.4 0 0 0 0 9M16.5 7.5a6.4 6.4 0 0 1 0 9" {...stroke} />
        </>
      );
      break;
    case "lock":
      body = (
        <>
          <rect x="6" y="10" width="12" height="10" rx="2" fill={color} />
          <path d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10" {...stroke} />
        </>
      );
      break;
    case "vacuum":
      body = (
        <>
          <circle cx="12" cy="12" r="8" {...stroke} />
          <circle cx="12" cy="12" r="2.5" fill={color} />
          <path d="M12 4v3M12 17v3" {...stroke} />
        </>
      );
      break;
    case "humidifier":
      body = <path d="M12 3c3 4.5 6 7.5 6 11a6 6 0 0 1-12 0c0-3.5 3-6.5 6-11z" fill={color} />;
      break;
    case "cover":
      body = (
        <>
          <rect x="4" y="4" width="16" height="16" rx="1.5" {...stroke} />
          <path d="M4 9h16M4 14h16" {...stroke} />
        </>
      );
      break;
    case "light":
      body = (
        <>
          <path d="M8 14a5 5 0 1 1 8 0c-1 1-1.5 2-1.5 3h-5c0-1-.5-2-1.5-3z" fill={color} />
          <rect x="9.5" y="18" width="5" height="2" rx="1" fill={color} />
        </>
      );
      break;
    default:
      body = <circle cx="12" cy="12" r="4" fill={color} />;
  }
  return <g transform={`scale(${k}) translate(-12 -12)`}>{body}</g>;
}

/** HVAC mode glyph: cool / heat / dry / fan_only / heat_cool / auto / off. */
export function ModeGlyph({ mode, s, color }: { mode: string; s: number; color: string }) {
  const k = s / 24;
  const stroke = { fill: "none", stroke: color, strokeWidth: 2.4, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  let body: React.ReactNode;
  switch (mode) {
    case "cool":
      body = (
        <>
          <path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9" {...stroke} />
          <path d="M9.5 4.5L12 7l2.5-2.5M9.5 19.5L12 17l2.5 2.5M5 10l3 1.5-1 3M19 10l-3 1.5 1 3M5 14l3-1.5-1-3M19 14l-3-1.5 1-3" {...stroke} strokeWidth={1.6} />
        </>
      );
      break;
    case "heat":
      body = <path d="M12 2c1 4 5 5 5 11a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3 0-3-1-6 1-9.5z" fill={color} />;
      break;
    case "dry":
      body = <path d="M12 3c3 4.5 6 7.5 6 11a6 6 0 0 1-12 0c0-3.5 3-6.5 6-11z" fill={color} />;
      break;
    case "fan_only":
      body = (
        <>
          <circle cx="12" cy="12" r="2" fill={color} />
          <path d="M12 10c-1-4 1-7 3-6s0 5-3 6zM14 12c4-1 7 1 6 3s-5 0-6-3zM12 14c1 4-1 7-3 6s0-5 3-6zM10 12c-4 1-7-1-6-3s5 0 6 3z" fill={color} />
        </>
      );
      break;
    case "heat_cool":
    case "auto":
      body = (
        <>
          <path d="M5 8h11l-3-3M19 16H8l3 3" {...stroke} />
        </>
      );
      break;
    default:
      body = (
        <>
          <path d="M12 3v9" {...stroke} />
          <path d="M7 6.5a7 7 0 1 0 10 0" {...stroke} />
        </>
      );
  }
  return <g transform={`scale(${k}) translate(-12 -12)`}>{body}</g>;
}
