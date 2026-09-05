/** Dollhouse brand mark (same geometry as assets/brand/icon.svg), for the toolbar. */
export function Mark({ size = 22 }: { size?: number }) {
  return (
    <svg viewBox="0 0 512 512" width={size} height={size} aria-hidden="true" style={{ display: "block" }}>
      <defs>
        <radialGradient id="dh-mark-glow" cx="50%" cy="20%" r="80%">
          <stop offset="0" stopColor="#fff7d6" />
          <stop offset="0.45" stopColor="#fcd34d" />
          <stop offset="1" stopColor="#f59e0b" />
        </radialGradient>
      </defs>
      <path d="M256 44 L484 226 H28 Z" fill="#334155" />
      <rect x="356" y="96" width="40" height="70" rx="6" fill="#1e293b" />
      <rect x="60" y="214" width="392" height="262" rx="22" fill="#334155" />
      <rect x="88" y="240" width="164" height="104" rx="8" fill="url(#dh-mark-glow)" />
      <circle cx="170" cy="258" r="9" fill="#fff" />
      <rect x="260" y="240" width="164" height="104" rx="8" fill="#e2e8f0" />
      <rect x="300" y="290" width="92" height="40" rx="8" fill="#cbd5e1" />
      <rect x="88" y="352" width="164" height="96" rx="8" fill="#e2e8f0" />
      <rect x="112" y="398" width="116" height="32" rx="10" fill="#94a3b8" />
      <rect x="112" y="388" width="116" height="16" rx="8" fill="#64748b" />
      <rect x="260" y="352" width="164" height="96" rx="8" fill="#e2e8f0" />
      <rect x="352" y="366" width="52" height="40" rx="6" fill="#7dd3fc" />
    </svg>
  );
}
