import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { App } from "../src/core/App";
import { createLocalStore, createMockHass } from "../src/ha/mock";
import { demoLayout } from "../src/ha/demo";
import { render3D } from "../src/core/lazy3d";
import { writeLangOverride } from "../src/i18n";
import { importBackground } from "../src/core/background";
import { setBackground } from "../src/core/useEditor";
import { emptyLayout } from "../src/domain/types";
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
  if (q.get("lang") === "en" || q.get("lang") === "zh-Hant") writeLangOverride(q.get("lang") as "en" | "zh-Hant");
  const seed = createMockHass(() => {});
  if (q.get("layout")) {
    // ?layout=<url> loads a layout JSON (e.g. an export) into the store
    await store.save(await (await fetch(q.get("layout")!)).json());
  } else if (q.has("empty")) {
    localStorage.removeItem("dollhouse:welcomed");
    await store.save(emptyLayout("我的家"));
  } else if (q.has("plan")) {
    // Blank layout with a synthetic scanned plan as background (for the click-to-detect tool).
    const blob = await (await fetch("./plan.png")).blob();
    const bg = await importBackground(new File([blob], "plan.png", { type: "image/png" }));
    await store.save(setBackground(emptyLayout("底圖測試"), bg));
  } else if (q.get("demo") === "reset" || !(await store.load())) await store.save(demoLayout(seed));
  const auto = q.get("autoroom");
  if (auto) {
    // e.g. ?plan&autoroom=300,200;900,200 — canvas coordinates, fired after the app mounts
    setTimeout(() => {
      auto.split(";").forEach((pair, i) => {
        const [x, y] = pair.split(",").map(Number);
        setTimeout(() => window.dispatchEvent(new CustomEvent("dollhouse:autoroom", { detail: { x, y } })), 400 * (i + 1));
      });
    }, 1500);
  }
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <Root />
    </StrictMode>,
  );
}
boot();
