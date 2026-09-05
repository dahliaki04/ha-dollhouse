import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { App } from "../src/core/App";
import { createLocalStore, createMockHass } from "../src/ha/mock";
import { demoLayout } from "../src/ha/demo";
import { render3D } from "../src/core/lazy3d";
import type { HassLike } from "../src/ha/types";

const store = createLocalStore();

function Harness({ hass, setHass }: { hass: HassLike; setHass: (h: HassLike) => void }) {
  void setHass;
  return <App hass={hass} store={store} render3D={render3D} initialView={new URLSearchParams(location.search).get("view") === "3d" ? "3d" : "2d"} onMoreInfo={(id) => console.log("more-info", id, hass.states[id])} />;
}

function Root() {
  const [hass, setHass] = useState<HassLike>(() => {
    const h = createMockHass(() => setHass({ ...h }));
    return h;
  });
  return <Harness hass={hass} setHass={setHass} />;
}

async function boot() {
  // ?demo seeds the store with a ready-made apartment (use ?demo=reset to overwrite).
  const q = new URLSearchParams(location.search);
  if (q.has("demo")) {
    const seed = createMockHass(() => {});
    if (q.get("demo") === "reset" || !(await store.load())) await store.save(demoLayout(seed));
  }
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <Root />
    </StrictMode>,
  );
}
boot();
