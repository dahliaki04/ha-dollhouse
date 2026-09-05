import { Component, lazy, Suspense, type ReactNode } from "react";
import { t } from "../i18n";
import type { Layout } from "../domain/types";
import type { HassLike } from "../ha/types";

const Canvas3D = lazy(() => import("./Canvas3D"));

class Boundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(e: Error) {
    return { error: e.message };
  }
  render() {
    if (this.state.error) return <div className="dh-empty"><div><b>{t("3D 無法顯示")}</b><br />{this.state.error}</div></div>;
    return this.props.children;
  }
}

/** Pass to <App render3D={render3D}> to enable the dollhouse view. */
export function render3D(props: { layout: Layout; hass: HassLike }) {
  return (
    <Boundary>
      <Suspense fallback={<div className="dh-hint">{t("載入 3D…")}</div>}>
        <Canvas3D {...props} />
      </Suspense>
    </Boundary>
  );
}
