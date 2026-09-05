/** Dollhouse brand mark (same geometry as assets/brand/icon.svg), for the toolbar. */
export function Mark({ size = 22 }: { size?: number }) {
  return (
    <svg viewBox="0 0 512 512" width={size} height={size} aria-hidden="true" style={{ display: "block", borderRadius: size * 0.22 }}>
      <defs>
        <linearGradient id="dh-mark-tile" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1e40af" />
          <stop offset="1" stopColor="#0b1220" />
        </linearGradient>
        <radialGradient id="dh-mark-glow" cx="50%" cy="50%" r="60%">
          <stop offset="0" stopColor="#fff6cc" />
          <stop offset="0.45" stopColor="#fbbf24" />
          <stop offset="1" stopColor="#f59e0b" />
        </radialGradient>
      </defs>
      <rect width="512" height="512" rx="112" fill="url(#dh-mark-tile)" />
      <polygon points="256,432 80,330 256,228 432,330" fill="#334155" />
      <polygon points="80,330 256,432 256,458 80,356" fill="#1e293b" />
      <polygon points="432,330 256,432 256,458 432,356" fill="#111827" />
      <polygon points="80,330 80,170 256,68 256,228" fill="#a3b0c2" />
      <polygon points="432,330 432,170 256,68 256,228" fill="#dbe3ee" />
      <polygon points="80,170 256,68 432,170 432,182 256,80 80,182" fill="#f8fafc" />
      <polygon points="256,228 256,68 268,75 268,235" fill="#64748b" />
      <polygon points="80,330 168,381 256,330 168,279" fill="url(#dh-mark-glow)" />
      <polygon points="80,330 80,210 168,159 168,279" fill="#fbbf24" opacity="0.42" />
      <polygon points="332,150 332,102 380,74 380,122" fill="#7dd3fc" stroke="#f8fafc" strokeWidth="8" strokeLinejoin="round" />
      <polygon points="300,336 300,306 372,264 372,294" fill="#e2e8f0" />
      <polygon points="300,306 300,292 372,250 372,264" fill="#94a3b8" />
    </svg>
  );
}
