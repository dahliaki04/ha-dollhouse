import { useRef, useState } from "react";
import { t } from "../i18n";
import { importBackground } from "./background";
import type { Background } from "../domain/types";
import { IconButton } from "./ui";
import { Ic } from "./icons";
import { Mark } from "./Mark";

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
    <div className="dh-welcome" role="dialog" aria-modal="true" aria-label={t("開始使用")}>
      <div className="dh-welcome-box">
        <div className="dh-welcome-head">
          <div className="dh-row nowrap" style={{ alignItems: "flex-start", gap: 12 }}>
            <Mark size={40} />
            <div>
              <div className="dh-welcome-title">{t("三分鐘做出你家的娃娃屋")}</div>
              <div className="dh-muted" style={{ fontSize: 13 }}>{t("畫房間、連結 HA area、放上燈和感測器。先看看成品，或直接開始。")}</div>
            </div>
          </div>
          <IconButton label={t("關閉")} icon={<Ic.close />} onClick={onClose} autoFocus />
        </div>
        <div className="dh-welcome-cards">
          <button type="button" className="dh-welcome-card" onClick={onDemo}>
            <span className="dh-welcome-icon"><Ic.home size={20} /></span>
            <span className="dh-welcome-card-title">{t("先看示範")}</span>
            <span className="dh-muted">{t("載入一間示範公寓，看 2D 與 3D 長什麼樣，之後可以整個清掉。")}</span>
          </button>
          <button type="button" className="dh-welcome-card" onClick={() => fileRef.current?.click()} disabled={busy}>
            <span className="dh-welcome-icon">{busy ? <Ic.spin size={20} /> : <Ic.file size={20} />}</span>
            <span className="dh-welcome-card-title">{busy ? t("處理中…") : t("我有平面圖")}</span>
            <span className="dh-muted">{t("上傳 PDF 或 JPG 當底圖，點房間內部就自動框出。")}</span>
          </button>
          <button type="button" className="dh-welcome-card" onClick={onDraw}>
            <span className="dh-welcome-icon"><Ic.pencil size={20} /></span>
            <span className="dh-welcome-card-title">{t("直接畫")}</span>
            <span className="dh-muted">{t("矩形工具：點一個角、再點對角，一間房就好了。")}</span>
          </button>
        </div>
        <div className="dh-welcome-foot">{t("之後隨時可以按工具列的「?」看說明。")}</div>
        <input ref={fileRef} type="file" accept="image/*,application/pdf" hidden onChange={(e) => pick(e.target.files?.[0])} />
      </div>
    </div>
  );
}
