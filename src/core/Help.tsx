import { useEffect, useRef } from "react";
import { t } from "../i18n";
import { IconButton } from "./ui";
import { Ic } from "./icons";

/** Slide-in help: gestures, shortcuts and the concepts people ask about. */
export function Help({ onClose }: { onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const S = ({ title, rows }: { title: string; rows: [React.ReactNode, string][] }) => (
    <section>
      <h3>{title}</h3>
      <dl className="dh-help-list">
        {rows.map(([k, v], i) => (
          <div key={i}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
  const K = ({ k }: { k: string }) => <kbd className="dh-kbd">{k}</kbd>;
  return (
    <div className="dh-help" role="dialog" aria-label={t("說明")}>
      <div className="dh-help-head">
        <span>{t("說明")}</span>
        <IconButton ref={closeRef} label={t("關閉")} icon={<Ic.close />} onClick={onClose} />
      </div>
      <div className="dh-help-body">
        <S title={t("流程")} rows={[
          [t("1 房間"), t("矩形：點一個角、再點對角。多邊形：逐點點出。有底圖時用「點選房間」點房間內部自動框出。")],
          [t("2 area"), t("點房間 → 連結 HA area → 「全部加入」把那個 area 的裝置放進來。")],
          [t("3 調整"), t("拖裝置到正確位置，設燈具型式、窗簾型式、安裝高度。感測數值自動集中到房間的狀態框。")],
          [t("4 使用"), t("按「完成」進檢視模式：點圖示切換開關，長按看詳細。儀表板可加 custom:dollhouse-card。")],
        ]} />
        <S title={t("2D 手勢")} rows={[
          [t("拖曳"), t("移動裝置、家具、房間；拖頂點改房間形狀。Shift 拖曳不吸附格點。")],
          [t("雙指 / 滾輪"), t("縮放。單指拖空白處或 Alt+拖曳平移。")],
          [t("點牆"), t("選取牆；開「多選」或 Shift 點可加選。側欄一次改厚度、設成虛擬區隔。")],
          [t("移到點的位置"), t("選好物件按這顆，再點目的地，不用拖。")],
        ]} />
        <S title={t("3D")} rows={[
          [t("拖曳"), t("旋轉。雙指或滾輪縮放，右鍵或雙指拖曳平移。左邊直排按鈕可轉 90°、縮放、重置。")],
          [t("牆切低"), t("面向鏡頭的牆自動降低，看得到後面的家具。")],
        ]} />
        <S title={t("概念")} rows={[
          [t("虛擬區隔"), t("開放式廚房和客廳之間不畫牆，但仍分成兩間、各自掛 area。")],
          [t("鎖定平面圖"), t("房間不能被移動、變形、新增或刪除；裝置和家具照常編輯。")],
          [t("燈組"), t("一顆開關帶多顆燈：在裝置面板設數量、一排或矩陣、間距。")],
          [t("狀態框"), t("每間房一個 callout，內容在房間面板自選、排序，可加任何 entity。")],
          [t("門窗"), t("在家具區選門或窗，拖到牆上會自動貼齊並在 3D 切出開口；純裝飾，不綁 entity。")],
        ]} />
        <S title={t("快捷鍵")} rows={[
          [<><K k="V" /> <K k="R" /> <K k="P" /> <K k="M" /></>, t("選取 / 矩形 / 多邊形 / 點選房間")],
          [<><K k="Ctrl" />+<K k="Z" /> / <K k="Y" /></>, t("復原 / 重做")],
          [<K k="Delete" />, t("刪除選取的物件")],
          [<K k="Esc" />, t("取消選取、回到選取工具")],
        ]} />
      </div>
    </div>
  );
}
