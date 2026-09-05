/** Mounts two <dollhouse-card> instances (2D with room filter, 3D) with a mock hass. Open /dev/card.html */
import "../src/card";
import { createMockHass } from "../src/ha/mock";
import { demoLayout } from "../src/ha/demo";
import type { HassLike } from "../src/ha/types";

type CardEl = HTMLElement & { hass: HassLike; setConfig: (c: Record<string, unknown>) => void };

const cards: CardEl[] = [];
const hass = createMockHass(() => { for (const c of cards) c.hass = { ...hass }; });
hass.callWS = async <T,>(msg: Record<string, unknown>): Promise<T> => {
  if (msg.type === "dollhouse/layout/get") return { layout: demoLayout(hass) } as T;
  return null as T;
};

const grid = document.getElementById("grid")!;
const make = (config: Record<string, unknown>) => {
  const el = document.createElement("dollhouse-card") as CardEl;
  el.setConfig(config);
  grid.appendChild(el);
  el.hass = hass;
  el.addEventListener("hass-more-info", (e) => console.log("more-info", (e as CustomEvent).detail));
  cards.push(el);
};
make({ type: "custom:dollhouse-card", view: "2d", height: 380, rooms: ["客廳", "餐廳", "廚房"], title: "客餐廚" });
make({ type: "custom:dollhouse-card", view: "3d", height: 380, title: "3D" });
