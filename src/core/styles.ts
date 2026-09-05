export const STYLE_ID = "dollhouse-styles";

export const CSS = `
:host{display:block;height:100%;min-height:100dvh}
.dh-app{--dh-bg:var(--primary-background-color,#f3f4f6);--dh-card:var(--card-background-color,#fff);--dh-text:var(--primary-text-color,#111827);--dh-muted:var(--secondary-text-color,#6b7280);--dh-border:var(--divider-color,#e5e7eb);--dh-primary:var(--primary-color,#2563eb);--dh-hover:rgba(127,127,127,.12);display:flex;flex-direction:column;height:100%;min-height:480px;font:14px/1.4 system-ui,-apple-system,"Segoe UI","Noto Sans TC",sans-serif;color:var(--dh-text);background:var(--dh-bg);box-sizing:border-box}
.dh-app *{box-sizing:border-box}
.dh-toolbar{display:flex;align-items:center;gap:6px;padding:8px 12px;background:var(--dh-card);border-bottom:1px solid var(--dh-border);flex-wrap:wrap}
.dh-toolbar .dh-title{font-weight:700;margin-right:8px;font-size:15px}
.dh-toolbar .dh-spacer{flex:1}
.dh-toolbar .dh-name .dh-field{margin:0}
.dh-toolbar .dh-name label:empty{display:none}
.dh-btn{border:1px solid var(--dh-border);background:var(--dh-card);border-radius:6px;padding:5px 10px;cursor:pointer;font:inherit;color:var(--dh-text);line-height:1.2}
.dh-btn:hover{background:var(--dh-hover)}
.dh-btn:disabled{opacity:.45;cursor:default}
.dh-btn.on{background:var(--dh-primary);color:#fff;border-color:var(--dh-primary)}
.dh-btn.small{padding:3px 8px;font-size:12px}
.dh-btn.danger{color:#b91c1c;border-color:#fca5a5}
.dh-body{display:flex;flex:1;min-height:0}
.dh-canvas-wrap{flex:1;position:relative;overflow:hidden;min-height:360px;background:#e9ebee;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;overscroll-behavior:contain}
.dh-canvas-wrap svg{width:100%;height:100%;display:block}
.dh-hint{position:absolute;left:12px;bottom:10px;background:rgba(17,24,39,.8);color:#fff;padding:4px 10px;border-radius:6px;font-size:12px;pointer-events:none}
.dh-empty{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none}
.dh-empty div{background:rgba(255,255,255,.9);padding:16px 22px;border-radius:10px;color:#374151;text-align:center;max-width:360px}
.dh-side{width:300px;background:var(--dh-card);border-left:1px solid var(--dh-border);overflow:auto;padding:12px}
.dh-side h3{margin:0 0 8px;font-size:13px;text-transform:uppercase;letter-spacing:.04em;color:var(--dh-muted)}
.dh-side section{margin-bottom:18px}
.dh-field{display:flex;flex-direction:column;gap:4px;margin-bottom:8px}
.dh-field label{font-size:12px;color:var(--dh-muted)}
.dh-field input,.dh-field select,.dh-row input,.dh-row select{font:inherit;padding:5px 8px;border:1px solid var(--dh-border);border-radius:6px;background:var(--dh-card);color:var(--dh-text);width:100%}
.dh-row input,.dh-row select{width:auto}
.dh-row{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.dh-list{list-style:none;margin:0;padding:0}
.dh-list li{padding:5px 8px;border-radius:6px;cursor:pointer;display:flex;justify-content:space-between;align-items:center}
.dh-list li:hover{background:var(--dh-hover)}
.dh-list li.sel{background:var(--dh-hover)}
.dh-muted{color:var(--dh-muted);font-size:12px}
.dh-room-label{font-weight:600;pointer-events:none;user-select:none}
.dh-wall{cursor:pointer}
.dh-wall:hover{filter:brightness(1.15)}
@keyframes dh-pulse{0%{opacity:.35;transform:scale(.8)}100%{opacity:0;transform:scale(1.6)}}
.dh-pulse{animation:dh-pulse 1.6s ease-out infinite;transform-box:fill-box;transform-origin:center}
.dh-marker text{pointer-events:none;user-select:none}
@media (max-width:800px){.dh-body{flex-direction:column;overflow:auto;-webkit-overflow-scrolling:touch}.dh-canvas-wrap{flex:none;height:58dvh;min-height:300px}.dh-side{flex:none;width:100%;height:auto;border-left:none;border-top:1px solid var(--dh-border);padding:10px;overflow:visible}.dh-toolbar{padding:6px 8px;gap:4px}.dh-toolbar .dh-title{font-size:14px;margin-right:2px}.dh-name{display:none}.dh-btn{padding:7px 9px}.dh-hint{display:none}.dh-save{display:none}}
`;

/** Inject once into the root that contains the app: document.head, or a ShadowRoot (HA custom panels live in shadow DOM). */
export function injectStyles(root: Document | ShadowRoot = document) {
  if (root.querySelector(`#${STYLE_ID}`)) return;
  const el = document.createElement("style");
  el.id = STYLE_ID;
  el.textContent = CSS;
  if (root instanceof Document) root.head.appendChild(el);
  else root.prepend(el);
}
