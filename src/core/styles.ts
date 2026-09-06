export const STYLE_ID = "dollhouse-styles";

/*
  Design tokens
  ─ colours come from Home Assistant's theme variables with light fallbacks, so the panel
    follows the user's HA theme (dark included). Soft tints are alpha overlays so they work
    on any surface.
  ─ spacing scale 4 / 8 / 12 / 16 / 24; radii 6 / 8 / 12; control heights 32 (desktop) / 40 (touch).
  ─ type: 14 body, 13 controls, 12 secondary, 11 captions/labels.
*/
export const CSS = `
:host{display:block;height:100%;min-height:100dvh}
.dh-app,.dh-card{
  --dh-bg:var(--primary-background-color,#f4f5f7);
  --dh-card:var(--card-background-color,#fff);
  --dh-text:var(--primary-text-color,#111827);
  --dh-muted:var(--secondary-text-color,#6b7280);
  --dh-border:var(--divider-color,#e5e7eb);
  --dh-primary:var(--primary-color,#2563eb);
  --dh-primary-soft:rgba(37,99,235,.12);
  --dh-primary-soft2:rgba(37,99,235,.2);
  --dh-danger:#dc2626;
  --dh-danger-soft:rgba(220,38,38,.1);
  --dh-amber:#f59e0b;
  --dh-amber-soft:rgba(245,158,11,.16);
  --dh-surface-2:rgba(127,127,127,.09);
  --dh-surface-3:rgba(127,127,127,.16);
  --dh-hover:rgba(127,127,127,.12);
  --dh-shadow:0 1px 2px rgba(0,0,0,.08),0 4px 12px rgba(0,0,0,.06);
  --dh-r-sm:6px;--dh-r:8px;--dh-r-lg:12px;
  --dh-ctl:32px;--dh-ctl-sm:28px;
  --dh-side-w:320px;
}
@supports (color:color-mix(in srgb,red 50%,blue)){.dh-app,.dh-card{--dh-primary-soft:color-mix(in srgb,var(--dh-primary) 12%,transparent);--dh-primary-soft2:color-mix(in srgb,var(--dh-primary) 20%,transparent)}}
.dh-mt{margin-top:12px}
.dh-app{display:flex;flex-direction:column;height:100%;min-height:480px;font:14px/1.45 system-ui,-apple-system,"Segoe UI","Noto Sans TC",sans-serif;color:var(--dh-text);background:var(--dh-bg);box-sizing:border-box;-webkit-font-smoothing:antialiased}
.dh-app *,.dh-card *{box-sizing:border-box}
.dh-app h1,.dh-app h2,.dh-app h3{margin:0;font-weight:600}
.dh-muted{color:var(--dh-muted);font-size:12px}
.dh-help-text{color:var(--dh-muted);font-size:12px;line-height:1.45;margin-top:6px}
.dh-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.dh-row.nowrap{flex-wrap:nowrap}
.dh-row.between{justify-content:space-between}
.dh-grow{flex:1;min-width:0}
.dh-ellipsis{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dh-spacer{flex:1}
@keyframes dh-spin{to{transform:rotate(360deg)}}
.dh-spin{animation:dh-spin .9s linear infinite}

/* ---------- buttons ---------- */
.dh-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:var(--dh-ctl);padding:0 12px;border:1px solid var(--dh-border);background:var(--dh-card);border-radius:var(--dh-r);cursor:pointer;font:inherit;font-size:13px;font-weight:500;color:var(--dh-text);line-height:1.2;white-space:nowrap;transition:background .12s,border-color .12s,color .12s}
.dh-btn:hover{background:var(--dh-hover)}
.dh-btn:active{transform:translateY(.5px)}
.dh-btn:disabled{opacity:.45;cursor:default;transform:none}
.dh-btn.sm{min-height:var(--dh-ctl-sm);padding:0 10px;font-size:12px}
.dh-btn.block{display:flex;width:100%}
.dh-btn.primary{background:var(--dh-primary);border-color:var(--dh-primary);color:#fff}
.dh-btn.primary:hover{filter:brightness(1.08)}
.dh-btn.tonal,.dh-btn.on{background:var(--dh-primary-soft);border-color:transparent;color:var(--dh-primary)}
.dh-btn.tonal:hover,.dh-btn.on:hover{background:var(--dh-primary-soft2)}
.dh-btn.ghost{background:transparent;border-color:transparent}
.dh-btn.ghost:hover{background:var(--dh-hover)}
.dh-btn.danger{background:transparent;border-color:transparent;color:var(--dh-danger)}
.dh-btn.danger:hover{background:var(--dh-danger-soft)}
.dh-btn-ic{display:inline-flex;margin-left:-2px}
.dh-btn-ic svg{display:block}
.dh-ibtn{display:inline-flex;align-items:center;justify-content:center;width:var(--dh-ctl);height:var(--dh-ctl);padding:0;border:1px solid transparent;background:transparent;border-radius:var(--dh-r);color:var(--dh-text);cursor:pointer;flex:none;transition:background .12s,color .12s}
.dh-ibtn svg{display:block}
.dh-ibtn:hover{background:var(--dh-hover)}
.dh-ibtn:disabled{opacity:.4;cursor:default}
.dh-ibtn.on{background:var(--dh-primary-soft);color:var(--dh-primary)}
.dh-ibtn.danger{color:var(--dh-danger)}
.dh-ibtn.danger:hover{background:var(--dh-danger-soft)}
.dh-ibtn.sm{width:var(--dh-ctl-sm);height:var(--dh-ctl-sm)}
.dh-ibtn.lg{width:40px;height:40px}
.dh-ibtn.raised{background:var(--dh-card);border-color:var(--dh-border);box-shadow:var(--dh-shadow)}

/* ---------- segmented ---------- */
.dh-seg{display:inline-flex;align-items:stretch;gap:2px;padding:2px;background:var(--dh-surface-2);border-radius:var(--dh-r);max-width:100%;vertical-align:middle}
.dh-seg.full{display:flex}
.dh-seg.full .dh-seg-btn{flex:1}
.dh-seg.wrap{flex-wrap:wrap}
.dh-seg.grid{display:grid;flex:1;min-width:0}
.dh-seg.grid .dh-seg-btn{min-width:0;padding:0 6px}
.dh-seg.grid .dh-seg-btn>span{overflow:hidden;text-overflow:ellipsis}
.dh-stack{display:flex;flex-direction:column;gap:6px}
.dh-seg-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:calc(var(--dh-ctl) - 4px);padding:0 10px;border:0;border-radius:var(--dh-r-sm);background:transparent;font:inherit;font-size:13px;color:var(--dh-text);cursor:pointer;white-space:nowrap;transition:background .12s,color .12s}
.dh-seg-btn svg{display:block}
.dh-seg-btn:hover{background:var(--dh-hover)}
.dh-seg-btn:disabled{opacity:.4;cursor:default}
.dh-seg-btn.on{background:var(--dh-card);color:var(--dh-primary);font-weight:600;box-shadow:0 1px 2px rgba(0,0,0,.14)}
.dh-seg.sm .dh-seg-btn{min-height:calc(var(--dh-ctl-sm) - 4px);padding:0 8px;font-size:12px}
.dh-swatch{display:inline-block;width:12px;height:12px;border-radius:50%;box-shadow:inset 0 0 0 1px rgba(0,0,0,.28);flex:none}
.dh-swatch.lg{width:20px;height:20px;border-radius:6px}

/* ---------- chips ---------- */
.dh-chips{display:flex;gap:6px;flex-wrap:wrap}
.dh-chip{display:inline-flex;align-items:center;gap:4px;min-height:26px;padding:0 10px;border:1px solid var(--dh-border);background:transparent;border-radius:999px;font:inherit;font-size:12px;color:var(--dh-text);cursor:pointer;white-space:nowrap}
.dh-chip:hover{background:var(--dh-hover)}
.dh-chip.on{background:var(--dh-primary-soft);border-color:transparent;color:var(--dh-primary);font-weight:600}

/* ---------- fields ---------- */
.dh-field{display:flex;flex-direction:column;gap:6px;margin:0 0 12px}
.dh-field:last-child{margin-bottom:0}
.dh-field-head{display:flex;align-items:baseline;justify-content:space-between;gap:8px;min-height:16px}
.dh-label{font-size:12px;font-weight:600;color:var(--dh-text)}
.dh-meta{font-size:11px;color:var(--dh-muted);text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dh-app input:not([type=checkbox]):not([type=color]):not([type=range]),.dh-app select,.dh-app textarea{font:inherit;font-size:13px;min-height:var(--dh-ctl);padding:0 10px;border:1px solid var(--dh-border);border-radius:var(--dh-r);background:var(--dh-card);color:var(--dh-text);width:100%;outline:none;transition:border-color .12s,box-shadow .12s}
.dh-app input:not([type=checkbox]):not([type=color]):not([type=range]):focus,.dh-app select:focus{border-color:var(--dh-primary);box-shadow:0 0 0 3px var(--dh-primary-soft)}
.dh-app input[type=search]::-webkit-search-cancel-button{display:none}
.dh-app input[type=range]{width:100%;accent-color:var(--dh-primary);margin:6px 0}
.dh-app input[type=number]{-moz-appearance:textfield}
.dh-app input[type=number]::-webkit-inner-spin-button{opacity:.6}
.dh-num{position:relative;display:inline-flex;align-items:center;width:96px;flex:none}
.dh-num input{padding-right:30px!important;width:100%}
.dh-unit{position:absolute;right:9px;font-size:11px;color:var(--dh-muted);pointer-events:none}
.dh-select{position:relative;display:flex;width:100%}
.dh-select select{appearance:none;-webkit-appearance:none;padding-right:30px}
.dh-select-ic{position:absolute;right:8px;top:50%;transform:translateY(-50%);color:var(--dh-muted);pointer-events:none}
.dh-search{position:relative;display:flex;align-items:center}
.dh-search input{padding-left:32px!important;padding-right:32px!important}
.dh-search-ic{position:absolute;left:10px;color:var(--dh-muted);pointer-events:none}
.dh-search .dh-ibtn{position:absolute;right:2px}
.dh-color{position:relative;display:inline-flex;width:var(--dh-ctl);height:var(--dh-ctl);align-items:center;justify-content:center;border:1px solid var(--dh-border);border-radius:var(--dh-r);cursor:pointer;background:var(--dh-card);flex:none}
.dh-color input{position:absolute;inset:0;opacity:0;width:100%;height:100%;cursor:pointer}
.dh-switch{display:flex;align-items:center;gap:10px;cursor:pointer;min-height:var(--dh-ctl);user-select:none}
.dh-switch input{position:absolute;opacity:0;width:0;height:0}
.dh-switch-track{position:relative;width:36px;height:20px;border-radius:999px;background:var(--dh-surface-3);transition:background .15s;flex:none}
.dh-switch-thumb{position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.3);transition:transform .15s}
.dh-switch input:checked+.dh-switch-track{background:var(--dh-primary)}
.dh-switch input:checked+.dh-switch-track .dh-switch-thumb{transform:translateX(16px)}
.dh-switch input:focus-visible+.dh-switch-track{outline:2px solid var(--dh-primary);outline-offset:2px}
.dh-switch-label{font-size:13px}
.dh-app input[type=checkbox]{width:18px;height:18px;accent-color:var(--dh-primary);margin:0;flex:none;cursor:pointer}
.dh-cols{display:grid;gap:8px;grid-template-columns:repeat(auto-fit,minmax(88px,1fr))}
.dh-cols .dh-num{width:100%}
.dh-cols .dh-field{margin:0}
.dh-inline{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.dh-kbd{font:11px/1 ui-monospace,SFMono-Regular,Menlo,monospace;padding:2px 5px;border:1px solid var(--dh-border);border-bottom-width:2px;border-radius:4px;color:var(--dh-muted);background:var(--dh-surface-2)}
.dh-code{font:12px ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--dh-muted)}

/* ---------- groups / sections ---------- */
.dh-group{padding:12px 0;border-top:1px solid var(--dh-border)}
.dh-group:first-of-type{border-top:0;padding-top:0}
.dh-group-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;min-height:24px}
.dh-group-title{font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--dh-muted)}
.dh-group-right{display:flex;gap:4px;align-items:center}
.dh-sec{border-bottom:1px solid var(--dh-border);margin:0 -16px}
.dh-sec-head{display:flex;align-items:center;gap:10px;width:100%;padding:12px 16px;background:none;border:0;font:inherit;color:var(--dh-text);cursor:pointer;text-align:left;min-height:46px}
.dh-sec-head:hover{background:var(--dh-hover)}
.dh-sec-ic{display:inline-flex;color:var(--dh-muted)}
.dh-sec-title{flex:1;font-weight:600;font-size:13px}
.dh-sec-chev{color:var(--dh-muted);transition:transform .15s;flex:none}
.dh-sec.open .dh-sec-chev{transform:rotate(180deg)}
.dh-badge{font-size:11px;font-weight:600;color:var(--dh-muted);background:var(--dh-surface-2);border-radius:999px;padding:1px 8px;min-width:22px;text-align:center}
.dh-sec-body{padding:0 16px 16px}
.dh-sec-body>.dh-group:first-child{padding-top:0;border-top:0}

/* ---------- lists ---------- */
.dh-list{list-style:none;margin:0;padding:0}
.dh-list.boxed{border:1px solid var(--dh-border);border-radius:var(--dh-r);overflow:hidden}
.dh-list.boxed .dh-item+.dh-item{border-top:1px solid var(--dh-border)}
.dh-list.scroll{max-height:260px;overflow:auto}
.dh-item{display:flex;align-items:center;gap:8px;min-height:38px;padding:2px 4px 2px 6px;border-radius:var(--dh-r-sm)}
.dh-item:hover{background:var(--dh-hover)}
.dh-item.sel{background:var(--dh-primary-soft)}
.dh-item.dim .dh-item-primary{color:var(--dh-muted)}
.dh-item-lead{display:inline-flex;width:24px;height:24px;align-items:center;justify-content:center;border-radius:6px;background:var(--dh-surface-2);color:var(--dh-muted);flex:none}
.dh-item-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px;background:none;border:0;padding:4px 0;font:inherit;color:inherit;text-align:left;cursor:default;line-height:1.3}
button.dh-item-main{cursor:pointer}
.dh-item-primary{font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:flex;gap:6px;align-items:center}
.dh-item-secondary{font-size:11px;color:var(--dh-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dh-item-trail{display:inline-flex;align-items:center;gap:2px;flex:none}
.dh-state{display:inline-block;font-size:11px;font-weight:600;padding:1px 7px;border-radius:999px;background:var(--dh-surface-2);color:var(--dh-muted);line-height:1.5;white-space:nowrap}
.dh-state.on{background:var(--dh-amber-soft);color:#b45309}
.dh-state.dead{background:var(--dh-danger-soft);color:var(--dh-danger)}
.dh-state.val{background:var(--dh-primary-soft);color:var(--dh-primary)}
.dh-empty-state{text-align:center;padding:16px 8px;color:var(--dh-muted)}
.dh-empty-ic{display:flex;justify-content:center;margin-bottom:6px;color:var(--dh-muted)}
.dh-empty-title{font-size:13px;font-weight:600;color:var(--dh-text)}
.dh-empty-action{margin-top:10px}
.dh-list-cap{font-size:11px;color:var(--dh-muted);padding:6px 4px 2px;font-weight:600}

/* ---------- toolbar ---------- */
.dh-toolbar{display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--dh-card);border-bottom:1px solid var(--dh-border);flex-wrap:wrap;min-height:52px}
.dh-tb-group{display:flex;align-items:center;gap:4px}
.dh-tb-group.tools{gap:8px}
.dh-title{display:inline-flex;align-items:center;gap:8px;font-weight:700;font-size:15px;margin-right:4px}
.dh-title-name{display:inline-flex;align-items:center;gap:6px;font-weight:500;font-size:13px;color:var(--dh-muted);background:none;border:1px solid transparent;border-radius:var(--dh-r);padding:4px 8px;cursor:pointer;font-family:inherit;max-width:220px}
.dh-title-name:hover{border-color:var(--dh-border);color:var(--dh-text)}
.dh-title-name span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dh-title-edit{display:inline-flex;gap:4px;align-items:center}
.dh-title-edit input{width:200px}
.dh-tb-sep{width:1px;height:22px;background:var(--dh-border);margin:0 4px;flex:none}
.dh-save{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--dh-muted);white-space:nowrap}
.dh-save-dot{width:7px;height:7px;border-radius:50%;background:#16a34a}
.dh-save.dirty .dh-save-dot{background:var(--dh-amber)}
.dh-save.error .dh-save-dot{background:var(--dh-danger)}
.dh-save.saving .dh-save-dot{background:var(--dh-primary);animation:dh-blink 1s infinite}
@keyframes dh-blink{50%{opacity:.3}}

/* ---------- layout ---------- */
.dh-body{display:flex;flex:1;min-height:0}
.dh-canvas-wrap{flex:1;position:relative;overflow:hidden;min-height:360px;background:#e6e8ec;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;overscroll-behavior:contain}
.dh-canvas-wrap svg{width:100%;height:100%;display:block}
.dh-hint{position:absolute;left:12px;bottom:10px;background:rgba(17,24,39,.78);color:#fff;padding:5px 10px;border-radius:var(--dh-r);font-size:12px;pointer-events:none;backdrop-filter:blur(4px)}
.dh-empty{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none}
.dh-empty div{background:rgba(255,255,255,.92);padding:16px 22px;border-radius:var(--dh-r-lg);color:#374151;text-align:center;max-width:360px;box-shadow:var(--dh-shadow)}
.dh-side{width:var(--dh-side-w);background:var(--dh-card);border-left:1px solid var(--dh-border);overflow:auto;padding:0 16px 24px;display:flex;flex-direction:column}
.dh-side>section{margin:0}
.dh-panel-head{position:sticky;top:0;z-index:2;display:flex;align-items:center;gap:8px;margin:0 -16px 12px;padding:10px 12px;background:var(--dh-card);border-bottom:1px solid var(--dh-border)}
.dh-panel-ic{display:inline-flex;width:30px;height:30px;align-items:center;justify-content:center;border-radius:8px;background:var(--dh-surface-2);color:var(--dh-muted);flex:none}
.dh-panel-titles{flex:1;min-width:0}
.dh-panel-title{font-weight:600;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dh-panel-sub{font-size:11px;color:var(--dh-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dh-panel-actions{display:flex;gap:2px}
.dh-panel-actions-bar{display:flex;gap:8px;justify-content:space-between;padding:14px 0 0;margin-top:4px;border-top:1px solid var(--dh-border)}
.dh-side-foot{margin-top:auto;padding-top:16px;font-size:11px;color:var(--dh-muted);display:flex;flex-wrap:wrap;gap:4px 10px}
.dh-side-intro{margin:16px 0 8px;padding:12px 14px;border-radius:var(--dh-r-lg);background:var(--dh-primary-soft);color:var(--dh-text)}
.dh-side-intro b{display:block;margin-bottom:6px;font-size:13px}
.dh-steps{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:6px;font-size:12px;line-height:1.5}
.dh-steps li{display:flex;gap:8px}
.dh-steps li::before{counter-increment:dh;content:counter(dh);display:inline-flex;width:18px;height:18px;flex:none;align-items:center;justify-content:center;border-radius:50%;background:var(--dh-primary);color:#fff;font-size:11px;font-weight:700}
.dh-steps{counter-reset:dh}
.dh-danger-zone{margin-top:8px;padding-top:12px;border-top:1px dashed var(--dh-border)}

/* ---------- canvas bits ---------- */
.dh-room-label{font-weight:600;pointer-events:none;user-select:none}
.dh-wall{cursor:pointer}
.dh-wall:hover{filter:brightness(1.15)}
@keyframes dh-pulse{0%{opacity:.35;transform:scale(.8)}100%{opacity:0;transform:scale(1.6)}}
.dh-pulse{animation:dh-pulse 1.6s ease-out infinite;transform-box:fill-box;transform-origin:center}
.dh-marker text{pointer-events:none;user-select:none}
.dh-app :is(button,input,select,[tabindex]):focus-visible{outline:2px solid var(--dh-primary);outline-offset:2px}
.dh-app input:focus-visible{outline:none}

/* ---------- floating controls (viewer / 3D) ---------- */
.dh-viewer-controls{position:absolute;top:10px;right:10px;display:flex;gap:6px;z-index:3;align-items:center}
.dh-float{display:inline-flex;gap:2px;padding:3px;background:var(--dh-card);border:1px solid var(--dh-border);border-radius:10px;box-shadow:var(--dh-shadow);color:var(--dh-text)}
.dh-float .dh-seg{background:transparent;padding:0}
.dh-float .dh-seg-btn.on{background:var(--dh-primary-soft);box-shadow:none}
.dh-3d-controls{position:absolute;top:10px;left:10px;display:flex;flex-direction:column;gap:2px;padding:3px;z-index:3;background:var(--dh-card);border:1px solid var(--dh-border);border-radius:10px;box-shadow:var(--dh-shadow);color:var(--dh-text)}
.dh-3d-controls .dh-ibtn{width:36px;height:36px}
.dh-3d-sep{height:1px;background:var(--dh-border);margin:2px 4px}
.dh-card .dh-3d-controls .dh-ibtn{width:30px;height:30px}
.dh-card .dh-3d-controls svg{width:16px;height:16px}
.dh-viewer-hint{position:absolute;left:10px;bottom:8px;font-size:11px;background:rgba(17,24,39,.6);color:#fff;padding:3px 9px;border-radius:var(--dh-r);pointer-events:none;backdrop-filter:blur(4px)}
.dh-app-view .dh-body{flex:1;min-height:0}
.dh-card{font:14px/1.45 system-ui,-apple-system,"Segoe UI","Noto Sans TC",sans-serif;color:var(--primary-text-color,#111)}
.dh-card-title{position:absolute;right:10px;bottom:8px;z-index:3;font-weight:600;font-size:13px;background:rgba(17,24,39,.6);padding:3px 9px;border-radius:var(--dh-r);color:#fff}

/* ---------- toast ---------- */
.dh-toast{position:absolute;left:50%;bottom:16px;transform:translateX(-50%);max-width:calc(100% - 24px);background:rgba(17,24,39,.94);color:#fff;padding:10px 14px;border-radius:10px;font-size:13px;display:flex;align-items:center;gap:14px;z-index:5;box-shadow:0 6px 20px rgba(0,0,0,.28)}
.dh-toast.error{background:#b91c1c}
.dh-toast-action{background:none;border:0;color:#93c5fd;font:inherit;font-weight:600;cursor:pointer;padding:0}

/* ---------- welcome ---------- */
.dh-welcome{position:absolute;inset:0;z-index:6;display:flex;align-items:center;justify-content:center;background:rgba(15,23,42,.4);padding:16px;backdrop-filter:blur(2px)}
.dh-welcome-box{background:var(--dh-card);color:var(--dh-text);border-radius:16px;padding:22px;max-width:720px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.3)}
.dh-welcome-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:16px}
.dh-welcome-title{font-size:19px;font-weight:700;margin-bottom:4px;letter-spacing:-.01em}
.dh-welcome-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.dh-welcome-card{text-align:left;background:var(--dh-bg);border:1px solid var(--dh-border);border-radius:var(--dh-r-lg);padding:14px;cursor:pointer;font:inherit;color:var(--dh-text);display:flex;flex-direction:column;gap:6px;min-height:130px;transition:border-color .12s,transform .12s,box-shadow .12s}
.dh-welcome-card:hover{border-color:var(--dh-primary);box-shadow:var(--dh-shadow);transform:translateY(-1px)}
.dh-welcome-card:disabled{opacity:.6;cursor:default}
.dh-welcome-icon{display:inline-flex;width:36px;height:36px;align-items:center;justify-content:center;border-radius:10px;background:var(--dh-primary-soft);color:var(--dh-primary)}
.dh-welcome-card-title{font-weight:600;font-size:14px}
.dh-welcome-foot{margin-top:14px;font-size:12px;color:var(--dh-muted)}
@media (max-width:640px){.dh-welcome-cards{grid-template-columns:1fr}.dh-welcome-card{min-height:0;flex-direction:row;align-items:center;gap:12px}.dh-welcome-card .dh-muted{display:none}.dh-welcome-box{padding:18px}}

/* ---------- help drawer ---------- */
.dh-help{position:absolute;top:0;right:0;bottom:0;width:min(400px,100%);background:var(--dh-card);color:var(--dh-text);border-left:1px solid var(--dh-border);z-index:7;display:flex;flex-direction:column;box-shadow:-8px 0 24px rgba(0,0,0,.15)}
.dh-help-head{display:flex;justify-content:space-between;align-items:center;padding:10px 12px 10px 16px;border-bottom:1px solid var(--dh-border);font-weight:600}
.dh-help-body{overflow:auto;padding:4px 16px 24px}
.dh-help-body h3{margin:16px 0 6px;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--dh-muted);font-weight:600}
.dh-help-list{margin:0}
.dh-help-list div{display:grid;grid-template-columns:112px 1fr;gap:10px;padding:7px 0;border-bottom:1px solid var(--dh-border)}
.dh-help-list dt{font-weight:600;font-size:13px}
.dh-help-list dd{margin:0;font-size:13px;color:var(--dh-text);line-height:1.5}

/* ---------- touch / narrow ---------- */
@media (max-width:800px){
  .dh-app{--dh-ctl:40px;--dh-ctl-sm:34px}
  .dh-toolbar{padding:6px 8px;gap:6px;flex-wrap:wrap;min-height:0}
  .dh-tb-group.tools{order:10;flex-basis:100%;justify-content:space-between;gap:4px;padding-top:2px}
  .dh-tb-group.tools .dh-seg{flex:1}
  .dh-tb-group.tools .dh-seg-btn{flex:1;padding:0 6px}
  .dh-tb-group.tools .dh-seg-btn>span{display:none}
  .dh-title-name,.dh-title-edit{display:none}
  .dh-title{font-size:14px}
  .dh-save .dh-save-tx{display:none}
  .dh-body{flex-direction:column;overflow:auto;-webkit-overflow-scrolling:touch}
  .dh-canvas-wrap{flex:none;height:50dvh;min-height:280px;position:sticky;top:0;z-index:2;box-shadow:0 2px 8px rgba(0,0,0,.22)}
  .dh-app-view .dh-body{overflow:hidden}
  .dh-app-view .dh-canvas-wrap,.dh-card .dh-canvas-wrap{position:absolute;inset:0;height:auto;min-height:0;box-shadow:none}
  .dh-side{flex:none;width:100%;height:auto;border-left:none;border-top:1px solid var(--dh-border);padding:0 14px 32px;overflow:visible;border-radius:14px 14px 0 0;margin-top:-10px;position:relative;z-index:3}
  .dh-side::before{content:"";display:block;width:36px;height:4px;border-radius:2px;background:var(--dh-surface-3);margin:8px auto 4px}
  .dh-sec{margin:0 -14px}
  .dh-sec-head{padding:12px 14px}
  .dh-sec-body{padding:0 14px 16px}
  .dh-panel-head{margin:0 -14px 12px;position:static}
  .dh-item{min-height:44px}
  .dh-hint{left:8px;right:8px;bottom:6px;font-size:11px;padding:4px 8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .dh-help-list div{grid-template-columns:96px 1fr}
}
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
