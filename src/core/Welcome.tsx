import { useRef, useState } from "react";
import { t } from "../i18n";
import { importBackground } from "./background";
import type { Background } from "../domain/types";

export interface WelcomeProps {
  onDemo: () => void;
  onBackground: (bg: Background) => void;
  onDraw: () => void;
  onClose: () => void;
}

const KEY = "dollhouse:welcomed";
export function welcomeSeen(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}
export function markWelcomeSeen() {
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    /* ignore */
  }
}

/** First-run overlay: three ways in. Shown only while the layout has no rooms. */
export function Welcome({ onDemo, onBackground, onDraw, onClose }: WelcomeProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const pick = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true);
    try {
      onBackground(await importBackground(f));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="dh-welcome" role="dialog" aria-label={t("開始使用")}>
      <div className="dh-welcome-box">
        <div className="dh-welcome-head">
          <div>
            <div className="dh-welcome-title">{t("三分鐘做出你家的娃娃屋")}</div>
            <div className="dh-muted">{t("畫房間、連結 HA area、放上燈和感測器。先看看成品，或直接開始。")}</div>
          </div>
          <button className="dh-btn small" onClick={onClose} aria-label={t("關閉")}>✕</button>
        </div>
        <div className="dh-welcome-cards">
          <button className="dh-welcome-card" onClick={onDemo}>
            <div className="dh-welcome-icon">🏠</div>
            <div className="dh-welcome-card-title">{t("先看示範")}</div>
            <div className="dh-muted">{t("載入一間示範公寓，看 2D 與 3D 長什麼樣，之後可以整個清掉。")}</div>
          </button>
          <button className="dh-welcome-card" onClick={() => fileRef.current?.click()} disabled={busy}>
            <div className="dh-welcome-icon">📄</div>
            <div className="dh-welcome-card-title">{busy ? t("處理中…") : t("我有平面圖")}</div>
            <div className="dh-muted">{t("上傳 PDF 或 JPG 當底圖，點房間內部就自動框出。")}</div>
          </button>
          <button className="dh-welcome-card" onClick={onDraw}>
            <div className="dh-welcome-icon">✏️</div>
            <div className="dh-welcome-card-title">{t("直接畫")}</div>
            <div className="dh-muted">{t("矩形工具：點一個角、再點對角，一間房就好了。")}</div>
          </button>
        </div>
        <input ref={fileRef} type="file" accept="image/*,application/pdf" hidden onChange={(e) => pick(e.target.files?.[0])} />
      </div>
    </div>
  );
}
