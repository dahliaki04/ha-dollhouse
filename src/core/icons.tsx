import type { SVGProps } from "react";

/**
 * Line icons drawn from primitives (no icon font, no Unicode symbols — Android WebViews
 * render those as tofu). 24-unit grid, 1.8 stroke, round joins, currentColor.
 */
type P = SVGProps<SVGSVGElement> & { size?: number };

function I({ size = 18, children, ...rest }: P) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...rest}>
      {children}
    </svg>
  );
}

export const Ic = {
  cursor: (p: P) => <I {...p}><path d="M6 4l12 7.5-6.5 1.5L9 20z" /></I>,
  rect: (p: P) => <I {...p}><rect x="4" y="6" width="16" height="12" rx="1.5" /></I>,
  polygon: (p: P) => <I {...p}><path d="M12 4l8 6-3 9H7L4 10z" /></I>,
  wand: (p: P) => <I {...p}><path d="M3 21l10-10M13 11l2.5-2.5" /><path d="M17 3v4M15 5h4M20 10v2M19 11h2M8 3v2M7 4h2" /></I>,
  undo: (p: P) => <I {...p}><path d="M8 14L4 10l4-4" /><path d="M4 10h9.5a5 5 0 0 1 0 10H10" /></I>,
  redo: (p: P) => <I {...p}><path d="M16 14l4-4-4-4" /><path d="M20 10h-9.5a5 5 0 0 0 0 10H14" /></I>,
  lock: (p: P) => <I {...p}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></I>,
  unlock: (p: P) => <I {...p}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 7.6-1.7" /></I>,
  help: (p: P) => <I {...p}><circle cx="12" cy="12" r="9" /><path d="M9.6 9.5a2.5 2.5 0 1 1 3.6 2.2c-.8.4-1.2 1-1.2 1.8" /><path d="M12 17h.01" /></I>,
  close: (p: P) => <I {...p}><path d="M6 6l12 12M18 6L6 18" /></I>,
  back: (p: P) => <I {...p}><path d="M15 5l-7 7 7 7" /></I>,
  chevronRight: (p: P) => <I {...p}><path d="M9 5l7 7-7 7" /></I>,
  chevronDown: (p: P) => <I {...p}><path d="M5 9l7 7 7-7" /></I>,
  up: (p: P) => <I {...p}><path d="M12 19V5M6 11l6-6 6 6" /></I>,
  down: (p: P) => <I {...p}><path d="M12 5v14M6 13l6 6 6-6" /></I>,
  plus: (p: P) => <I {...p}><path d="M12 5v14M5 12h14" /></I>,
  minus: (p: P) => <I {...p}><path d="M5 12h14" /></I>,
  check: (p: P) => <I {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></I>,
  rotateL: (p: P) => <I {...p}><path d="M4 12a8 8 0 1 0 2.6-5.9" /><path d="M4 4v5h5" /></I>,
  rotateR: (p: P) => <I {...p}><path d="M20 12a8 8 0 1 1-2.6-5.9" /><path d="M20 4v5h-5" /></I>,
  home: (p: P) => <I {...p}><path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" /></I>,
  search: (p: P) => <I {...p}><circle cx="11" cy="11" r="6.5" /><path d="M16 16l5 5" /></I>,
  trash: (p: P) => <I {...p}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></I>,
  copy: (p: P) => <I {...p}><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h9" /></I>,
  pin: (p: P) => <I {...p}><path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0C18.5 15 12 21 12 21z" /><circle cx="12" cy="10" r="2.3" /></I>,
  eye: (p: P) => <I {...p}><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="3" /></I>,
  eyeOff: (p: P) => <I {...p}><path d="M3 3l18 18M10.6 6.2A9.7 9.7 0 0 1 12 6c6 0 9.5 6 9.5 6a17 17 0 0 1-3.3 3.9M6.6 6.9C4 8.9 2.5 12 2.5 12s3.5 6 9.5 6a9 9 0 0 0 3.3-.6" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></I>,
  pencil: (p: P) => <I {...p}><path d="M4 20l4.5-1L19 8.5a2.1 2.1 0 0 0-3-3L5.5 16z" /><path d="M14 7.5l3 3" /></I>,
  file: (p: P) => <I {...p}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></I>,
  sparkle: (p: P) => <I {...p}><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /><path d="M19 17l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z" /></I>,
  upload: (p: P) => <I {...p}><path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></I>,
  download: (p: P) => <I {...p}><path d="M12 4v12M7 11l5 5 5-5" /><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></I>,
  ruler: (p: P) => <I {...p}><path d="M3 16.5L16.5 3 21 7.5 7.5 21z" /><path d="M7 12.5l1.5 1.5M10 9.5l1.5 1.5M13 6.5l1.5 1.5" /></I>,
  layers: (p: P) => <I {...p}><path d="M12 3l9 5-9 5-9-5z" /><path d="M3 13l9 5 9-5M3 17l9 5 9-5" /></I>,
  arrowOut: (p: P) => <I {...p}><path d="M14 4h6v6M20 4l-9 9" /><path d="M20 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h5" /></I>,
  reset: (p: P) => <I {...p}><path d="M4 12a8 8 0 1 0 2.6-5.9" /><path d="M4 4v5h5" /><path d="M12 8v4l3 2" /></I>,
  target: (p: P) => <I {...p}><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="2.5" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></I>,
  grid: (p: P) => <I {...p}><rect x="4" y="4" width="16" height="16" rx="1.5" /><path d="M4 12h16M12 4v16" /></I>,
  bulb: (p: P) => <I {...p}><path d="M9 18h6M10 21h4" /><path d="M8.5 14.5A6 6 0 1 1 15.5 14.5c-.7.6-1 1.5-1 2.5h-5c0-1-.3-1.9-1-2.5z" /></I>,
  wall: (p: P) => <I {...p}><path d="M3 6h18v12H3zM3 12h18M9 6v6M15 12v6" /></I>,
  sofa: (p: P) => <I {...p}><path d="M5 11V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3" /><path d="M3 13a2 2 0 0 1 4 0v3h10v-3a2 2 0 0 1 4 0v5H3z" /></I>,
  door: (p: P) => <I {...p}><path d="M4 21h16M6 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17" /><path d="M14.5 12h.01" /></I>,
  spin: (p: P) => <I {...p} className="dh-spin"><path d="M12 3a9 9 0 1 0 9 9" /></I>,
};

export type IconName = keyof typeof Ic;
