/**
 * Home Assistant custom panel shell.
 *
 * HA creates <dollhouse-panel>, sets `hass`, `narrow`, `panel` properties, and
 * updates `hass` on every state change. We mount a React root once and re-render
 * on each `hass` assignment.
 */
import { createRoot, type Root } from "react-dom/client";
import { App } from "./core/App";
import { render3D } from "./core/lazy3d";
import type { HassLike, LayoutStore } from "./ha/types";

const WS_GET = "dollhouse/layout/get";
const WS_SAVE = "dollhouse/layout/save";

function createHaStore(getHass: () => HassLike | undefined): LayoutStore {
  return {
    async load() {
      const hass = getHass();
      if (!hass) return null;
      const res = await hass.callWS<{ layout: unknown | null }>({ type: WS_GET });
      return res?.layout ?? null;
    },
    async save(layout) {
      const hass = getHass();
      if (!hass) throw new Error("no hass");
      await hass.callWS({ type: WS_SAVE, layout });
    },
  };
}

class DollhousePanel extends HTMLElement {
  private _hass?: HassLike;
  private root?: Root;
  private store = createHaStore(() => this._hass);

  set hass(value: HassLike) {
    this._hass = value;
    this.render();
  }
  get hass() {
    return this._hass as HassLike;
  }

  connectedCallback() {
    this.style.display = "block";
    this.style.height = "100%";
    if (!this.root) this.root = createRoot(this);
    this.render();
  }

  disconnectedCallback() {
    this.root?.unmount();
    this.root = undefined;
  }

  private render() {
    if (!this.root || !this._hass) return;
    this.root.render(
      <App
        hass={this._hass}
        store={this.store}
        render3D={render3D}
        onMoreInfo={(entityId) => this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId }, bubbles: true, composed: true }))}
      />,
    );
  }
}

if (!customElements.get("dollhouse-panel")) customElements.define("dollhouse-panel", DollhousePanel);
