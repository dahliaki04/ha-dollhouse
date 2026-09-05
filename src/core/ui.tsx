import { useEffect, useState, type ReactNode } from "react";
import { t } from "../i18n";

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

export function Section({ id, title, defaultOpen = false, badge, children }: { id: string; title: string; defaultOpen?: boolean; badge?: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState<boolean>(() => readOpen()[id] ?? defaultOpen);
  const toggle = () => {
    const next = !open;
    setOpen(next);
    writeOpen({ ...readOpen(), [id]: next });
  };
  return (
    <section className={`dh-sec${open ? " open" : ""}`}>
      <button type="button" className="dh-sec-head" aria-expanded={open} onClick={toggle}>
        <span className="dh-sec-chev" aria-hidden="true">{open ? "▾" : "▸"}</span>
        <span className="dh-sec-title">{title}</span>
        {badge !== undefined && <span className="dh-muted">{badge}</span>}
      </button>
      {open && <div className="dh-sec-body">{children}</div>}
    </section>
  );
}

/* ---------- header for selection panels ---------- */

export function PanelHeader({ title, subtitle, onBack }: { title: string; subtitle?: string; onBack: () => void }) {
  return (
    <div className="dh-panel-head">
      <button type="button" className="dh-btn small" onClick={onBack} aria-label={t("返回")}>{t("← 返回")}</button>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</div>
        {subtitle && <div className="dh-muted" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{subtitle}</div>}
      </div>
    </div>
  );
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
    const t = setTimeout(onDone, toast.ttl ?? 3500);
    return () => clearTimeout(t);
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
