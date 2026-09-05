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
.dh-btn:focus-visible,.dh-sec-head:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid var(--dh-primary);outline-offset:2px}
.dh-sec{border-bottom:1px solid var(--dh-border);margin:0 -12px}
.dh-sec-head{display:flex;align-items:center;gap:8px;width:100%;padding:11px 12px;background:none;border:0;font:inherit;color:var(--dh-text);cursor:pointer;text-align:left}
.dh-sec-head:hover{background:var(--dh-hover)}
.dh-sec-chev{width:12px;color:var(--dh-muted);font-size:11px}
.dh-sec-title{flex:1;font-weight:600;font-size:13px}
.dh-sec-body{padding:2px 12px 14px}
.dh-sec-body section{margin-bottom:0}
.dh-panel-head{display:flex;align-items:center;gap:10px;margin:-4px 0 12px}
.dh-toast{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);max-width:calc(100% - 24px);background:rgba(17,24,39,.94);color:#fff;padding:9px 14px;border-radius:8px;font-size:13px;display:flex;align-items:center;gap:12px;z-index:5;box-shadow:0 4px 14px rgba(0,0,0,.25)}
.dh-toast.error{background:#b91c1c}
.dh-toast-action{background:none;border:0;color:#93c5fd;font:inherit;font-weight:600;cursor:pointer;padding:0}
.dh-steps{margin:0;padding:0 0 0 18px;line-height:1.7}
.dh-welcome{position:absolute;inset:0;z-index:6;display:flex;align-items:center;justify-content:center;background:rgba(15,23,42,.35);padding:16px}
.dh-welcome-box{background:var(--dh-card);color:var(--dh-text);border-radius:14px;padding:18px;max-width:720px;width:100%;box-shadow:0 12px 40px rgba(0,0,0,.25)}
.dh-welcome-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:14px}
.dh-welcome-title{font-size:18px;font-weight:700;margin-bottom:4px}
.dh-welcome-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.dh-welcome-card{text-align:left;background:var(--dh-bg);border:1px solid var(--dh-border);border-radius:10px;padding:14px;cursor:pointer;font:inherit;color:var(--dh-text);display:flex;flex-direction:column;gap:6px;min-height:120px}
.dh-welcome-card:hover{border-color:var(--dh-primary);background:var(--dh-hover)}
.dh-welcome-icon{font-size:26px}
.dh-welcome-card-title{font-weight:600}
@media (max-width:640px){.dh-welcome-cards{grid-template-columns:1fr}.dh-welcome-card{min-height:0}}
.dh-help{position:absolute;top:0;right:0;bottom:0;width:min(380px,100%);background:var(--dh-card);color:var(--dh-text);border-left:1px solid var(--dh-border);z-index:7;display:flex;flex-direction:column;box-shadow:-8px 0 24px rgba(0,0,0,.15)}
.dh-help-head{display:flex;justify-content:space-between;align-items:center;padding:12px 14px;border-bottom:1px solid var(--dh-border)}
.dh-help-body{overflow:auto;padding:6px 14px 20px}
.dh-help-body h3{margin:14px 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:var(--dh-muted)}
.dh-help-list{margin:0}
.dh-help-list div{display:grid;grid-template-columns:110px 1fr;gap:8px;padding:5px 0;border-bottom:1px solid var(--dh-border)}
.dh-help-list dt{font-weight:600;font-size:13px}
.dh-help-list dd{margin:0;font-size:13px;color:var(--dh-text)}
.dh-viewer-controls{position:absolute;top:10px;right:10px;display:flex;gap:6px;z-index:3}
.dh-3d-controls{position:absolute;top:10px;left:10px;display:flex;flex-direction:column;gap:6px;z-index:3}
.dh-3d-controls .dh-btn{width:38px;height:38px;padding:0;display:inline-flex;align-items:center;justify-content:center;font-size:16px}
.dh-viewer-hint{position:absolute;left:10px;bottom:8px;font-size:11px;background:rgba(17,24,39,.55);color:#fff;padding:2px 8px;border-radius:6px;pointer-events:none}
.dh-app-view .dh-body{flex:1;min-height:0}
.dh-card{font:14px/1.4 system-ui,-apple-system,"Segoe UI","Noto Sans TC",sans-serif;color:var(--primary-text-color,#111)}
.dh-card-title{position:absolute;right:10px;bottom:8px;z-index:3;font-weight:600;font-size:13px;background:rgba(17,24,39,.6);padding:2px 8px;border-radius:6px;color:#fff}
@media (max-width:800px){.dh-toolbar{flex-wrap:nowrap;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;gap:6px;padding:8px 10px}.dh-toolbar::-webkit-scrollbar{display:none}.dh-toolbar>*{flex:none}.dh-btn{min-height:38px}.dh-btn.small{min-height:34px;padding:4px 10px}.dh-list li{min-height:40px}input[type=checkbox]{width:20px;height:20px}.dh-body{flex-direction:column;overflow:auto;-webkit-overflow-scrolling:touch}.dh-canvas-wrap{flex:none;height:52dvh;min-height:300px;position:sticky;top:0;z-index:2;box-shadow:0 2px 6px rgba(0,0,0,.25)}.dh-app-view .dh-body{overflow:hidden}.dh-app-view .dh-canvas-wrap,.dh-card .dh-canvas-wrap{position:absolute;inset:0;height:auto;min-height:0;box-shadow:none}.dh-side{flex:none;width:100%;height:auto;border-left:none;border-top:1px solid var(--dh-border);padding:10px;overflow:visible}.dh-toolbar{padding:6px 8px;gap:4px}.dh-toolbar .dh-title{font-size:14px;margin-right:2px}.dh-name{display:none}.dh-btn{padding:7px 9px}.dh-hint{left:8px;right:8px;bottom:6px;font-size:11px;padding:3px 8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.dh-save{display:none}}
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
