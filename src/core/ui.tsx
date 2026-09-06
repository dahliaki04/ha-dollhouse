import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode, type Ref } from "react";
import { t } from "../i18n";
import { Ic } from "./icons";

/* =====================================================================
   Dollhouse UI kit. Every control in the sidebar, toolbar and overlays is
   built from these so spacing, radii, heights and states stay consistent.
   Styling lives in styles.ts under the matching .dh-* class.
   ===================================================================== */

/* ---------- buttons ---------- */

export type ButtonVariant = "default" | "primary" | "tonal" | "ghost" | "danger";

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  variant?: ButtonVariant;
  size?: "sm" | "md";
  icon?: ReactNode;
  /** Pressed / toggled look (aria-pressed is set too). */
  on?: boolean;
  block?: boolean;
}

export function Button({ variant = "default", size = "md", icon, on, block, className, children, ...rest }: ButtonProps) {
  const cls = ["dh-btn", variant !== "default" ? variant : "", size === "sm" ? "sm" : "", on ? "on" : "", block ? "block" : "", className ?? ""].filter(Boolean).join(" ");
  return (
    <button type="button" className={cls} aria-pressed={on === undefined ? undefined : on} {...rest}>
      {icon && <span className="dh-btn-ic">{icon}</span>}
      {children !== undefined && children !== null && children !== "" && <span className="dh-btn-tx">{children}</span>}
    </button>
  );
}

/** Square icon-only button; `label` is required and becomes aria-label + tooltip. */
export function IconButton({ label, icon, on, danger, size = "md", className, ref, ...rest }: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> & { label: string; icon: ReactNode; on?: boolean; danger?: boolean; size?: "sm" | "md" | "lg"; ref?: Ref<HTMLButtonElement> }) {
  const cls = ["dh-ibtn", size, on ? "on" : "", danger ? "danger" : "", className ?? ""].filter(Boolean).join(" ");
  return (
    <button ref={ref} type="button" className={cls} aria-label={label} title={label} aria-pressed={on === undefined ? undefined : on} {...rest}>
      {icon}
    </button>
  );
}

/* ---------- segmented control (single choice) ---------- */

export interface SegOption<T> {
  v: T;
  label?: ReactNode;
  icon?: ReactNode;
  title?: string;
  disabled?: boolean;
  /** Colour swatch shown before the label. */
  swatch?: string;
}

export function Segmented<T extends string | number>({ value, options, onChange, label, size = "md", full, wrap, cols }: { value: T; options: SegOption<T>[]; onChange: (v: T) => void; label?: string; size?: "sm" | "md"; full?: boolean; wrap?: boolean; /** Lay options out as an equal-width grid with this many columns. */ cols?: number }) {
  const cls = ["dh-seg", size === "sm" ? "sm" : "", full ? "full" : "", wrap ? "wrap" : "", cols ? "grid" : ""].filter(Boolean).join(" ");
  return (
    <div className={cls} role="radiogroup" aria-label={label} style={cols ? { gridTemplateColumns: `repeat(${cols},minmax(0,1fr))` } : undefined}>
      {options.map((o) => (
        <button
          key={String(o.v)}
          type="button"
          role="radio"
          aria-checked={o.v === value}
          className={`dh-seg-btn${o.v === value ? " on" : ""}`}
          disabled={o.disabled}
          title={o.title}
          onClick={() => onChange(o.v)}
        >
          {o.swatch && <span className="dh-swatch" style={{ background: o.swatch }} aria-hidden="true" />}
          {o.icon}
          {o.label !== undefined && <span>{o.label}</span>}
        </button>
      ))}
    </div>
  );
}

/* ---------- filter chip (multi / toggle) ---------- */

export function Chip({ on, children, ...rest }: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> & { on?: boolean }) {
  return (
    <button type="button" className={`dh-chip${on ? " on" : ""}`} aria-pressed={on} {...rest}>
      {children}
    </button>
  );
}

/* ---------- field: label row + control + hint ---------- */

export function Field({ label, meta, hint, children, className }: { label?: ReactNode; meta?: ReactNode; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={`dh-field${className ? " " + className : ""}`}>
      {(label || meta) && (
        <div className="dh-field-head">
          {label && <span className="dh-label">{label}</span>}
          {meta && <span className="dh-meta">{meta}</span>}
        </div>
      )}
      {children}
      {hint && <div className="dh-help-text">{hint}</div>}
    </div>
  );
}

/** Sub-section inside a panel: small caps title with optional right-side actions. */
export function Group({ title, right, children, className }: { title?: ReactNode; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={`dh-group${className ? " " + className : ""}`}>
      {(title || right) && (
        <div className="dh-group-head">
          {title && <h3 className="dh-group-title">{title}</h3>}
          {right && <div className="dh-group-right">{right}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

/* ---------- inputs ---------- */

export function NumberInput({ value, onChange, unit, step = 1, min, max, width, label, disabled }: { value: number; onChange: (v: number) => void; unit?: string; step?: number; min?: number; max?: number; width?: number; label?: string; disabled?: boolean }) {
  return (
    <label className="dh-num" style={width ? { width } : undefined}>
      <input
        type="number"
        inputMode="decimal"
        step={step}
        min={min}
        max={max}
        disabled={disabled}
        aria-label={label}
        value={Number.isFinite(value) ? Math.round(value * 100) / 100 : 0}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (Number.isFinite(v)) onChange(v);
        }}
      />
      {unit && <span className="dh-unit">{unit}</span>}
    </label>
  );
}

export function Select({ value, onChange, children, label, className }: { value: string; onChange: (v: string) => void; children: ReactNode; label?: string; className?: string }) {
  return (
    <span className={`dh-select${className ? " " + className : ""}`}>
      <select value={value} aria-label={label} onChange={(e) => onChange(e.target.value)}>{children}</select>
      <Ic.chevronDown size={16} className="dh-select-ic" />
    </span>
  );
}

export function Switch({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label className="dh-switch">
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="dh-switch-track" aria-hidden="true"><span className="dh-switch-thumb" /></span>
      <span className="dh-switch-label">{children}</span>
    </label>
  );
}

export function ColorInput({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <label className="dh-color" title={label}>
      <input type="color" value={value} aria-label={label} onChange={(e) => onChange(e.target.value)} />
      <span className="dh-swatch lg" style={{ background: value }} aria-hidden="true" />
    </label>
  );
}

export function SearchInput({ value, onChange, placeholder, autoFocus }: { value: string; onChange: (v: string) => void; placeholder?: string; autoFocus?: boolean }) {
  return (
    <div className="dh-search">
      <Ic.search size={16} className="dh-search-ic" />
      <input type="search" value={value} placeholder={placeholder} autoFocus={autoFocus} aria-label={placeholder} onChange={(e) => onChange(e.target.value)} />
      {value && <IconButton size="sm" label={t("清除")} icon={<Ic.close size={14} />} onClick={() => onChange("")} />}
    </div>
  );
}

/* ---------- list rows ---------- */

export function Row({ lead, primary, secondary, trailing, onClick, selected, title, dimmed }: { lead?: ReactNode; primary: ReactNode; secondary?: ReactNode; trailing?: ReactNode; onClick?: () => void; selected?: boolean; title?: string; dimmed?: boolean }) {
  const main = (
    <>
      <span className="dh-item-primary">{primary}</span>
      {secondary && <span className="dh-item-secondary">{secondary}</span>}
    </>
  );
  return (
    <li className={`dh-item${selected ? " sel" : ""}${dimmed ? " dim" : ""}`}>
      {lead && <span className="dh-item-lead" aria-hidden="true">{lead}</span>}
      {onClick ? (
        <button type="button" className="dh-item-main" onClick={onClick} title={title}>{main}</button>
      ) : (
        <span className="dh-item-main" title={title}>{main}</span>
      )}
      {trailing && <span className="dh-item-trail">{trailing}</span>}
    </li>
  );
}

/** Coloured state pill: on (amber), off (muted), dead (red), or a plain value. */
export function StatePill({ state, unit }: { state: string | undefined; unit?: string }) {
  const s = state ?? "unavailable";
  const kind = s === "on" || s === "open" || s === "playing" || s === "heat" || s === "cool" ? "on" : s === "unavailable" || s === "unknown" ? "dead" : s === "off" || s === "closed" ? "off" : "val";
  return <span className={`dh-state ${kind}`}>{s}{unit ? ` ${unit}` : ""}</span>;
}

export function EmptyState({ icon, title, hint, action }: { icon?: ReactNode; title: ReactNode; hint?: ReactNode; action?: ReactNode }) {
  return (
    <div className="dh-empty-state" role="status">
      {icon && <div className="dh-empty-ic">{icon}</div>}
      <div className="dh-empty-title">{title}</div>
      {hint && <div className="dh-help-text">{hint}</div>}
      {action && <div className="dh-empty-action">{action}</div>}
    </div>
  );
}

/* ---------- collapsible sidebar section (open state remembered per section) ---------- */

const KEY = "dollhouse:ui:sections";
function readOpen(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}");
  } catch {
    return {};
  }
}
function writeOpen(map: Record<string, boolean>) {
  try {
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export function Section({ id, title, icon, defaultOpen = false, badge, children }: { id: string; title: string; icon?: ReactNode; defaultOpen?: boolean; badge?: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState<boolean>(() => readOpen()[id] ?? defaultOpen);
  const toggle = () => {
    const next = !open;
    setOpen(next);
    writeOpen({ ...readOpen(), [id]: next });
  };
  return (
    <section className={`dh-sec${open ? " open" : ""}`}>
      <button type="button" className="dh-sec-head" aria-expanded={open} onClick={toggle}>
        {icon && <span className="dh-sec-ic" aria-hidden="true">{icon}</span>}
        <span className="dh-sec-title">{title}</span>
        {badge !== undefined && badge !== null && badge !== 0 && <span className="dh-badge">{badge}</span>}
        <Ic.chevronDown size={16} className="dh-sec-chev" />
      </button>
      {open && <div className="dh-sec-body">{children}</div>}
    </section>
  );
}

/* ---------- header for selection panels ---------- */

export function PanelHeader({ title, subtitle, icon, onBack, actions }: { title: string; subtitle?: ReactNode; icon?: ReactNode; onBack: () => void; actions?: ReactNode }) {
  return (
    <div className="dh-panel-head">
      <IconButton label={t("返回")} icon={<Ic.back />} onClick={onBack} />
      {icon && <span className="dh-panel-ic" aria-hidden="true">{icon}</span>}
      <div className="dh-panel-titles">
        <div className="dh-panel-title">{title}</div>
        {subtitle && <div className="dh-panel-sub">{subtitle}</div>}
      </div>
      {actions && <div className="dh-panel-actions">{actions}</div>}
    </div>
  );
}

/** Bottom action bar of a selection panel (duplicate / delete). */
export function PanelActions({ children }: { children: ReactNode }) {
  return <div className="dh-panel-actions-bar">{children}</div>;
}

/* ---------- toast ---------- */

export interface Toast {
  text: string;
  action?: { label: string; onClick: () => void };
  /** ms; default 3500 */
  ttl?: number;
  kind?: "info" | "error";
}

export function ToastBar({ toast, onDone }: { toast: Toast | null; onDone: () => void }) {
  useEffect(() => {
    if (!toast) return;
    const h = setTimeout(onDone, toast.ttl ?? 3500);
    return () => clearTimeout(h);
  }, [toast, onDone]);
  if (!toast) return null;
  return (
    <div className={`dh-toast${toast.kind === "error" ? " error" : ""}`} role="status" aria-live="polite">
      <span>{toast.text}</span>
      {toast.action && (
        <button type="button" className="dh-toast-action" onClick={() => { toast.action!.onClick(); onDone(); }}>{toast.action.label}</button>
      )}
    </div>
  );
}
