/**
 * Lovelace card: <dollhouse-card>. Read-only view of the saved layout.
 *
 *   type: custom:dollhouse-card
 *   view: 3d          # 2d | 3d (default 2d)
 *   height: 420       # px (default 380)
 *   rooms: [客廳, 餐廳] # optional: room names or ids to show
 *   toggle: true      # show the 2D/3D switch (default true)
 *   title: 我家
 */
import { createRoot, type Root } from "react-dom/client";
import { Viewer } from "./core/Viewer";
import { injectStyles } from "./core/styles";
import type { HassLike } from "./ha/types";
import type { Layout } from "./domain/types";
import { langFromHass, readLangOverride, setLang } from "./i18n";

interface CardConfig {
  type: string;
  view?: "2d" | "3d";
  height?: number;
  rooms?: string[];
  toggle?: boolean;
  title?: string;
}

class DollhouseCard extends HTMLElement {
  private _hass?: HassLike;
  private config: CardConfig = { type: "custom:dollhouse-card" };
  private root?: Root;
  private container?: HTMLDivElement;
  private layout: Layout | null = null;
  private loading = false;
  private view: "2d" | "3d" = "2d";
  private lastLoad = 0;

  static getStubConfig() {
    return { view: "2d", height: 380 };
  }

  setConfig(config: CardConfig) {
    this.config = config;
    this.view = config.view === "3d" ? "3d" : "2d";
    this.lastLoad = 0; // force reload on next hass
    this.render();
  }

  getCardSize() {
    return Math.max(3, Math.round((this.config.height ?? 380) / 50));
  }

  set hass(value: HassLike) {
    this._hass = value;
    setLang(readLangOverride() ?? langFromHass(value.language));
    if (!this.layout || Date.now() - this.lastLoad > 60_000) void this.load();
    this.render();
  }

  private async load() {
    if (!this._hass || this.loading) return;
    this.loading = true;
    try {
      const res = await this._hass.callWS<{ layout: Layout | null }>({ type: "dollhouse/layout/get" });
      this.layout = res?.layout ?? null;
      this.lastLoad = Date.now();
    } catch {
      /* keep old layout */
    } finally {
      this.loading = false;
      this.render();
    }
  }

  connectedCallback() {
    if (!this.shadowRoot) {
      const shadow = this.attachShadow({ mode: "open" });
      injectStyles(shadow);
      this.container = document.createElement("div");
      shadow.appendChild(this.container);
    }
    if (!this.root) this.root = createRoot(this.container!);
    this.render();
  }

  disconnectedCallback() {
    this.root?.unmount();
    this.root = undefined;
  }

  private render() {
    if (!this.root || !this._hass) return;
    const height = this.config.height ?? 380;
    const body = this.layout ? (
      <Viewer
        layout={this.layout}
        hass={this._hass}
        view={this.view}
        toggle={this.config.toggle !== false}
        rooms={this.config.rooms}
        onViewChange={(v) => { this.view = v; this.render(); }}
        onMoreInfo={(entityId) => this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId }, bubbles: true, composed: true }))}
      />
    ) : (
      <div className="dh-empty"><div>{this.loading ? "…" : "Dollhouse: no layout yet. Open the Dollhouse panel to draw one."}</div></div>
    );
    this.root.render(
      <div className="dh-card" style={{ height, position: "relative", overflow: "hidden", borderRadius: "var(--ha-card-border-radius, 12px)", background: "var(--ha-card-background, var(--card-background-color, #fff))", boxShadow: "var(--ha-card-box-shadow, none)", border: "var(--ha-card-border-width, 1px) solid var(--ha-card-border-color, var(--divider-color, #e0e0e0))" }}>
        {this.config.title && <div className="dh-card-title">{this.config.title}</div>}
        {body}
      </div>,
    );
  }
}

if (!customElements.get("dollhouse-card")) customElements.define("dollhouse-card", DollhouseCard);

declare global {
  interface Window { customCards?: { type: string; name: string; description: string; preview?: boolean }[] }
}
window.customCards = window.customCards ?? [];
if (!window.customCards.some((c) => c.type === "dollhouse-card")) {
  window.customCards.push({ type: "dollhouse-card", name: "Dollhouse", description: "2D plan / 3D dollhouse view of your home with live entity state", preview: false });
}
