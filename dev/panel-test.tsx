/**
 * Loads the real HA panel element with a mock hass, the way home-assistant does:
 * create <dollhouse-panel>, assign .hass, re-assign on every state change.
 * Open http://localhost:5175/dev/panel.html
 */
import "../src/panel";
import { createMockHass } from "../src/ha/mock";
import { demoLayout } from "../src/ha/demo";
import type { HassLike } from "../src/ha/types";

const host = document.getElementById("host")!;
if (new URLSearchParams(location.search).has("noheight")) document.body.classList.add("noheight");
const el = document.createElement("dollhouse-panel") as HTMLElement & { hass: HassLike };

// Fake the two WebSocket commands the integration provides, backed by localStorage.
const KEY = "dollhouse:panel-test";
const hass = createMockHass(() => { el.hass = { ...hass }; });
hass.callWS = async <T,>(msg: Record<string, unknown>): Promise<T> => {
  if (msg.type === "dollhouse/layout/get") {
    const raw = localStorage.getItem(KEY);
    return { layout: raw ? JSON.parse(raw) : demoLayout(hass) } as T;
  }
  if (msg.type === "dollhouse/layout/save") {
    localStorage.setItem(KEY, JSON.stringify(msg.layout));
    return { ok: true } as T;
  }
  return null as T;
};
if (new URLSearchParams(location.search).get("demo") === "reset") localStorage.removeItem(KEY);

host.appendChild(el);
el.hass = hass;
el.addEventListener("hass-more-info", (e) => console.log("more-info", (e as CustomEvent).detail));
