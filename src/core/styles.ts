export const STYLE_ID = "dollhouse-styles";

export const CSS = `
.dh-app{display:flex;flex-direction:column;height:100%;min-height:480px;font:14px/1.4 system-ui,-apple-system,"Segoe UI","Noto Sans TC",sans-serif;color:#111827;background:#f3f4f6;box-sizing:border-box}
.dh-app *{box-sizing:border-box}
.dh-toolbar{display:flex;align-items:center;gap:6px;padding:8px 12px;background:#fff;border-bottom:1px solid #e5e7eb;flex-wrap:wrap}
.dh-toolbar .dh-title{font-weight:700;margin-right:8px;font-size:15px}
.dh-toolbar .dh-spacer{flex:1}
.dh-btn{border:1px solid #d1d5db;background:#fff;border-radius:6px;padding:5px 10px;cursor:pointer;font:inherit;color:#111827;line-height:1.2}
.dh-btn:hover{background:#f9fafb}
.dh-btn:disabled{opacity:.45;cursor:default}
.dh-btn.on{background:#2563eb;color:#fff;border-color:#2563eb}
.dh-btn.small{padding:3px 8px;font-size:12px}
.dh-btn.danger{color:#b91c1c;border-color:#fca5a5}
.dh-body{display:flex;flex:1;min-height:0}
.dh-canvas-wrap{flex:1;position:relative;overflow:hidden;background:#e9ebee;touch-action:none}
.dh-canvas-wrap svg{width:100%;height:100%;display:block}
.dh-hint{position:absolute;left:12px;bottom:10px;background:rgba(17,24,39,.8);color:#fff;padding:4px 10px;border-radius:6px;font-size:12px;pointer-events:none}
.dh-empty{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none}
.dh-empty div{background:rgba(255,255,255,.9);padding:16px 22px;border-radius:10px;color:#374151;text-align:center;max-width:360px}
.dh-side{width:300px;background:#fff;border-left:1px solid #e5e7eb;overflow:auto;padding:12px}
.dh-side h3{margin:0 0 8px;font-size:13px;text-transform:uppercase;letter-spacing:.04em;color:#6b7280}
.dh-side section{margin-bottom:18px}
.dh-field{display:flex;flex-direction:column;gap:4px;margin-bottom:8px}
.dh-field label{font-size:12px;color:#6b7280}
.dh-field input,.dh-field select{font:inherit;padding:5px 8px;border:1px solid #d1d5db;border-radius:6px;background:#fff;width:100%}
.dh-row{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.dh-list{list-style:none;margin:0;padding:0}
.dh-list li{padding:5px 8px;border-radius:6px;cursor:pointer;display:flex;justify-content:space-between;align-items:center}
.dh-list li:hover{background:#f3f4f6}
.dh-list li.sel{background:#dbeafe}
.dh-muted{color:#6b7280;font-size:12px}
.dh-room-label{font-weight:600;pointer-events:none;user-select:none}
.dh-wall{cursor:pointer}
.dh-wall:hover{filter:brightness(1.15)}
@keyframes dh-pulse{0%{opacity:.35;transform:scale(.8)}100%{opacity:0;transform:scale(1.6)}}
.dh-pulse{animation:dh-pulse 1.6s ease-out infinite;transform-box:fill-box;transform-origin:center}
.dh-marker text{pointer-events:none;user-select:none}
`;

export function injectStyles(doc: Document = document) {
  if (doc.getElementById(STYLE_ID)) return;
  const el = doc.createElement("style");
  el.id = STYLE_ID;
  el.textContent = CSS;
  doc.head.appendChild(el);
}
