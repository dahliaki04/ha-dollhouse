<p align="center"><img src="assets/brand/logo.png" width="360" alt="Dollhouse"></p>

# Dollhouse

Draw your home in minutes, drag your Home Assistant entities onto it, and see it as a 2D plan or a 3D dollhouse. No CAD skills needed.

- **Rooms, not walls.** Drag a rectangle (or click out a polygon) per room. Walls are generated automatically: shared edges become interior walls, the rest exterior.
- **Wall thickness you control.** Click a wall, Shift-click to multi-select, or use *select all / all exterior / all interior*, then apply one thickness. Overrides survive edits.
- **Area auto-fill.** Link a room to an HA area and every light, climate unit, presence sensor and switch in that area is placed for you. Drag to adjust.
- **Fixture types.** Downlight, ceiling, pendant, wall, strip. Guessed from the name, switchable with one click. Brightness and colour drive the glow.
- **Climate chips** show current/target temperature, mode and fan speed. Any other entity shows its state or a chosen attribute.
- **Background.** Upload a PDF (page 1) or JPG floor plan and trace over it. Calibrate scale with one known distance.
- **2D and 3D share one model.** The dollhouse view is an isometric orthographic camera with four fixed directions.
- **Live.** Tap a light to toggle it; double-tap for more-info. State changes render immediately.

## Daily use: view mode and the dashboard card

- In the panel, **完成 / Done** switches to view mode: full-bleed plan or dollhouse, tap an icon to toggle it, long-press for more-info, nothing can be moved by accident. **編輯 / Edit** goes back.
- Put the same view on any dashboard with the card (the resource is registered automatically when dashboards are in storage mode):

```yaml
type: custom:dollhouse-card
view: 3d          # 2d | 3d
height: 420       # px
rooms: [客廳, 餐廳]  # optional: only these rooms (names or ids)
toggle: true      # show the 2D/3D switch
title: 我家
```

If your dashboards are in YAML mode, add `/dollhouse_static/ha-dollhouse.js` as a module resource yourself.

## Install (HACS)

1. HACS → Integrations → ⋮ → *Custom repositories* → add this repo as **Integration**.
2. Install **Dollhouse**, restart Home Assistant.
3. Settings → Devices & services → *Add integration* → **Dollhouse**.
4. A **Dollhouse** entry appears in the sidebar.

Manual: copy `custom_components/dollhouse/` into your `config/custom_components/` and restart.

The layout is stored in `.storage/dollhouse.layout`. Only admins can save.

## Develop

```bash
npm install
npm run dev          # http://localhost:5175/dev/index.html  (add ?demo=1 for a sample apartment, ?demo=reset to re-seed)
npm test             # wall derivation tests
npm run build        # typecheck + bundle into custom_components/dollhouse/frontend/ha-dollhouse.js
```

The dev harness uses a mock `hass` with lights, Daikin climate units and Zigbee presence sensors; service calls mutate the mock so the canvas feels live.

## Layout model (v1)

```
Layout { canvas{width,height}, metresPerUnit, background?, rooms[], items[], wallDefaults{exterior,interior,height}, wallThickness{wallId: m}, grid }
Room   { id, name, areaId?, points[[x,y]...], height?, color? }
Item   { id, entityId, x, y, z?, rotation?, kind: auto|light|climate|presence|generic, fixture?, attribute?, label? }
```

Coordinates are canvas units; `metresPerUnit` converts to metres. Walls are never stored: `deriveWalls()` recomputes them and their ids are stable (`w:<roomA>|<roomB>|<edge>` or `w:<room>|<edge>|<piece>`), which is what makes per-wall thickness overrides survive.

## Roadmap

- HACS panel (this repo) is the free, fully local tier.
- Hosted PWA with cloud sync, AI room detection from PDF, automation generation from the layout.
- DXF import mapped onto the same room model.

## Credits

Room-detection prompt and canvas interaction patterns adapted from [cabinet-abacus](https://github.com/dahliaki04/cabinet-abacus).
