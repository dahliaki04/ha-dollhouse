import { lazy, Suspense } from "react";
import type { Layout } from "../domain/types";
import type { HassLike } from "../ha/types";

const Canvas3D = lazy(() => import("./Canvas3D"));

/** Pass to <App render3D={render3D}> to enable the dollhouse view. */
export function render3D(props: { layout: Layout; hass: HassLike }) {
  return (
    <Suspense fallback={<div className="dh-hint">載入 3D…</div>}>
      <Canvas3D {...props} />
    </Suspense>
  );
}
