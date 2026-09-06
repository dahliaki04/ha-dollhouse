import { useEffect, useRef, useState } from "react";
import { t } from "../i18n";
import { IconButton } from "./ui";
import { Ic } from "./icons";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { Item, Layout, Point } from "../domain/types";
import { deriveWalls, nearestWall } from "../domain/walls";
import { wallPieces, type OpeningCut } from "../domain/openings";
import { FURNITURE, isWindow } from "../domain/furniture";
import { bbox, centroid, pointInPolygon } from "../domain/geometry";
import { effectiveBeam, effectiveHeight, effectiveShowIn, fixturePositions, frameItems, frameValue, hasBeam, hugsWall, resolveKind } from "../domain/entities";
import { coverInward, coverView, curtainPanels, wallInward } from "../domain/covers";
import { frameLayout, frameHeight, FRAME_W } from "./RoomFrame";
import type { HassLike } from "../ha/types";
import { brightness01, lightColor } from "./markers";
import { buildFurniture } from "./furniture3d";

export interface Canvas3DProps {
  layout: Layout;
  hass: HassLike;
}

/**
 * Dollhouse view: orthographic isometric camera, four fixed directions,
 * floors + extruded walls + light/climate/presence markers. Rebuilt on every
 * layout or state change; scenes are tiny so this is cheaper than diffing.
 */
export default function Canvas3D({ layout, hass }: Canvas3DProps) {
  const mount = useRef<HTMLDivElement>(null);
  const three = useRef<{ renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.OrthographicCamera; controls: OrbitControls } | null>(null);
  const [, bump] = useState(0);
  const [fatal, setFatal] = useState<string | null>(null);
  const placed = useRef(false);

  // Renderer lifecycle.
  useEffect(() => {
    const el = mount.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch (e) {
      setFatal(t("這個瀏覽器無法建立 WebGL：{msg}", { msg: (e as Error).message }));
      return;
    }
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // The scene is static between rebuilds, so shadow maps are rendered once (see needsUpdate below), not per frame.
    renderer.shadowMap.autoUpdate = false;
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 500);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = false;
    controls.minPolarAngle = 0.12; // almost top-down
    controls.maxPolarAngle = 1.25; // ~72°, never below the floor
    controls.minZoom = 0.4;
    controls.maxZoom = 5;
    controls.screenSpacePanning = true;
    controls.addEventListener("change", () => render());
    three.current = { renderer, scene, camera, controls };
    placeCamera(0);
    const ro = new ResizeObserver(() => {
      renderer.setSize(el.clientWidth, el.clientHeight, false);
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      frame();
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      controls.dispose();
      renderer.dispose();
      el.removeChild(renderer.domElement);
      three.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Scene rebuild.
  useEffect(() => {
    const t = three.current;
    if (!t) return;
    try {
      buildScene(t.scene, layout, hass);
      t.renderer.shadowMap.needsUpdate = true;
      frame();
    } catch (e) {
      setFatal(t("3D 場景建立失敗：{msg}", { msg: (e as Error).message }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, hass.states]);

  const render = () => {
    const t = three.current;
    if (!t) return;
    if (applyCutaway(t.scene, t.camera, t.controls.target)) t.renderer.shadowMap.needsUpdate = true;
    t.renderer.render(t.scene, t.camera);
  };

  /** Fit the orthographic frustum to the container; zoom is left to OrbitControls. */
  const frame = () => {
    const t = three.current;
    if (!t) return;
    const el = mount.current!;
    const w = el.clientWidth || 1;
    const h = el.clientHeight || 1;
    const size = layoutSizeM(layout, hass);
    const span = Math.max(size.w, size.h) * 0.75;
    const aspect = w / h;
    t.camera.left = -span * aspect;
    t.camera.right = span * aspect;
    t.camera.top = span;
    t.camera.bottom = -span;
    t.camera.updateProjectionMatrix();
    t.controls.target.set(size.cx, 0, size.cz);
    t.renderer.setSize(w, h, false);
    render();
  };

  /** Snap the camera to one of four isometric directions (quarter turns), keeping the current tilt. */
  const placeCamera = (quarter: number) => {
    const t = three.current;
    if (!t) return;
    const size = layoutSizeM(layout, hass);
    const target = new THREE.Vector3(size.cx, 0, size.cz);
    const sph = new THREE.Spherical().setFromVector3(t.camera.position.clone().sub(target));
    const polar = placed.current ? sph.phi : 0.95; // first placement: ~36° elevation
    placed.current = true;
    const az = Math.PI / 4 + quarter * (Math.PI / 2);
    sph.set(60, polar, az);
    t.camera.position.copy(target).add(new THREE.Vector3().setFromSpherical(sph));
    t.camera.lookAt(target);
    t.controls.target.copy(target);
    t.controls.update();
    render();
  };

  const turn = (delta: number) => {
    const t = three.current;
    if (!t) return;
    const size = layoutSizeM(layout);
    const sph = new THREE.Spherical().setFromVector3(t.camera.position.clone().sub(new THREE.Vector3(size.cx, 0, size.cz)));
    const q = Math.round((sph.theta - Math.PI / 4) / (Math.PI / 2)) + delta;
    placeCamera(q);
  };

  const zoomBy = (k: number) => {
    const t = three.current;
    if (!t) return;
    t.camera.zoom = Math.min(5, Math.max(0.4, t.camera.zoom * k));
    t.camera.updateProjectionMatrix();
    render();
    bump((n) => n + 1);
  };

  return (
    <div ref={mount} style={{ position: "absolute", inset: 0, background: "linear-gradient(#e5e7eb,#f3f4f6)", touchAction: "none" }}>
      <div className="dh-3d-controls" role="toolbar" aria-label="3D">
        <IconButton label={t("向左轉")} icon={<Ic.rotateL />} onClick={() => turn(-1)} />
        <IconButton label={t("向右轉")} icon={<Ic.rotateR />} onClick={() => turn(1)} />
        <div className="dh-3d-sep" />
        <IconButton label={t("放大")} icon={<Ic.plus />} onClick={() => zoomBy(1.25)} />
        <IconButton label={t("縮小")} icon={<Ic.minus />} onClick={() => zoomBy(1 / 1.25)} />
        <div className="dh-3d-sep" />
        <IconButton label={t("重置")} icon={<Ic.home />} onClick={() => { const tt = three.current; if (tt) { tt.camera.zoom = 1; tt.camera.updateProjectionMatrix(); } placeCamera(0); }} />
      </div>
      <div className="dh-hint">{t("拖曳旋轉，滾輪或雙指縮放，右鍵或雙指拖曳平移。狀態即時更新。")}</div>
      {fatal && (
        <div className="dh-empty" style={{ pointerEvents: "auto" }}>
          <div>
            <b>{t("3D 無法顯示")}</b><br />{fatal}<br />
            <span className="dh-muted">{t("HA 手機 App 的內建瀏覽器有時會關閉 WebGL。")}</span><br />
            <button className="dh-btn" style={{ marginTop: 8 }} onClick={() => window.open(location.href, "_blank")}>{t("在瀏覽器開啟")}</button>
          </div>
        </div>
      )}
    </div>
  );
}

interface CutawayWall {
  mesh: THREE.Object3D;
  /** Doors / windows: not scaled, just hidden while their wall is cut below their top. */
  hideOnly?: boolean;
  /** Piece height and bottom (a wall with openings is several stacked pieces). */
  h: number;
  y0: number;
  /** Unit normal in (x, z). */
  n: [number, number];
  roomPlus: boolean;
  roomMinus: boolean;
  cutH: number;
}

/**
 * Sims-style cutaway: a wall that has a room on the side facing away from the
 * camera would hide that room, so it is lowered. Far exterior walls stay tall.
 */
/** Lower walls that face the camera; returns true when any wall height changed (shadow maps then need a refresh). */
function applyCutaway(scene: THREE.Scene, camera: THREE.Camera, target: THREE.Vector3): boolean {
  const list = (scene.userData.cutaway as CutawayWall[] | undefined) ?? [];
  let changed = false;
  const cx = camera.position.x - target.x;
  const cz = camera.position.z - target.z;
  const cl = Math.hypot(cx, cz) || 1;
  const dx = cx / cl;
  const dz = cz / cl;
  for (const w of list) {
    const facing = w.n[0] * dx + w.n[1] * dz; // >0: +n side faces the camera
    const farHasRoom = facing > 0 ? w.roomMinus : w.roomPlus;
    if (w.hideOnly) {
      const visible = !farHasRoom || w.cutH >= w.y0 + w.h;
      if (w.mesh.visible !== visible) changed = true;
      w.mesh.visible = visible;
      continue;
    }
    const cut = farHasRoom ? w.cutH : w.y0 + w.h; // absolute height everything above is hidden
    const vis = Math.min(w.h, Math.max(0, cut - w.y0));
    const sy = Math.max(vis / w.h, 1e-4);
    const visible = vis > 0.005;
    if (Math.abs(w.mesh.scale.y - sy) > 1e-6 || w.mesh.visible !== visible) changed = true;
    w.mesh.visible = visible;
    w.mesh.scale.y = sy;
    w.mesh.position.y = w.y0 + vis / 2;
  }
  return changed;
}

let poolTex: THREE.Texture | null = null;
/** Feathered radial gradient so overlapping light pools blend instead of stacking as hard discs. */
function poolTexture(): THREE.Texture {
  if (poolTex) return poolTex;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.35, "rgba(255,255,255,0.55)");
  g.addColorStop(0.7, "rgba(255,255,255,0.15)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  poolTex = new THREE.CanvasTexture(c);
  poolTex.colorSpace = THREE.SRGBColorSpace;
  return poolTex;
}

let washTex: THREE.Texture | null = null;
/** Vertical falloff (bright at the fixture, fading upward) with feathered ends, for cove/wall washes. */
function washTexture(): THREE.Texture {
  if (washTex) return washTex;
  const c = document.createElement("canvas");
  c.width = 256; c.height = 128;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(256, 128);
  for (let y = 0; y < 128; y++) {
    const v = 1 - y / 127; // row 0 = top (far from strip)
    const fall = Math.pow(1 - v, 1.6); // strong near the bottom
    for (let x = 0; x < 256; x++) {
      const u = (x / 255) * 2 - 1;
      const feather = Math.pow(Math.max(0, 1 - u * u), 0.9);
      const a = Math.round(255 * fall * feather);
      const i = (y * 256 + x) * 4;
      img.data[i] = 255; img.data[i + 1] = 255; img.data[i + 2] = 255; img.data[i + 3] = a;
    }
  }
  ctx.putImageData(img, 0, 0);
  washTex = new THREE.CanvasTexture(c);
  washTex.colorSpace = THREE.SRGBColorSpace;
  return washTex;
}

function layoutSizeM(layout: Layout, hass?: HassLike) {
  const mpu = layout.metresPerUnit;
  const pts: Point[] = layout.rooms.flatMap((r) => r.points);
  if (hass) for (const pl of frameLayout(layout, hass, 1 / mpu)) { pts.push(pl.pos); pts.push([pl.pos[0] + FRAME_W / mpu, pl.pos[1] + frameHeight(pl.items.length) / mpu]); }
  if (pts.length === 0) return { w: layout.canvas.width * mpu, h: layout.canvas.height * mpu, cx: (layout.canvas.width * mpu) / 2, cz: (layout.canvas.height * mpu) / 2 };
  const b = bbox(pts);
  return { w: b.w * mpu, h: b.h * mpu, cx: (b.x + b.w / 2) * mpu, cz: (b.y + b.h / 2) * mpu };
}

function buildScene(scene: THREE.Scene, layout: Layout, hass: HassLike) {
  // Dispose previous.
  while (scene.children.length) {
    const c = scene.children.pop()!;
    c.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose();
    });
  }

  const mpu = layout.metresPerUnit;
  const toM = (p: Point): [number, number] => [p[0] * mpu, p[1] * mpu];

  scene.add(new THREE.HemisphereLight(0xffffff, 0x9aa0a8, 1.5));
  const sun = new THREE.DirectionalLight(0xffffff, 1.4);
  sun.position.set(-10, 20, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  const size = layoutSizeM(layout);
  const s = Math.max(size.w, size.h);
  sun.shadow.camera.left = -s;
  sun.shadow.camera.right = s;
  sun.shadow.camera.top = s;
  sun.shadow.camera.bottom = -s;
  sun.shadow.camera.far = 80;
  sun.target.position.set(size.cx, 0, size.cz);
  scene.add(sun, sun.target);

  // Ground slab under everything.
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(size.w + 4, size.h + 4), new THREE.MeshStandardMaterial({ color: 0xd4d8de }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(size.cx, -0.05, size.cz);
  ground.receiveShadow = true;
  scene.add(ground);

  // Floors.
  for (const room of layout.rooms) {
    const lit = layout.items.some((i) => resolveKind(i, hass) === "light" && hass.states[i.entityId]?.state === "on" && inside([i.x, i.y], room.points));
    const shape = new THREE.Shape(room.points.map((p) => { const [x, z] = toM(p); return new THREE.Vector2(x, z); }));
    const geo = new THREE.ShapeGeometry(shape);
    const base = new THREE.Color(room.color ?? "#f8fafc");
    const mat = new THREE.MeshStandardMaterial({ color: lit ? base.clone().lerp(new THREE.Color("#ffe4b5"), 0.35) : base, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = Math.PI / 2; // shape (x,y) → (x,z)
    mesh.position.y = 0.01;
    mesh.receiveShadow = true;
    scene.add(mesh);
    // Room label sprite.
    const c = toM(centroid(room.points));
    const hasFrame = !room.frameHidden && frameItems(layout, room, hass).length > 0;
    if (!hasFrame) {
      const label = textSprite(room.name, "#1f2937");
      label.position.set(c[0], 0.3, c[1]);
      scene.add(label);
    }
  }

  const walls = deriveWalls(layout);
  const cutaway: CutawayWall[] = [];
  // Doors / windows snapped onto a wall (within 0.5 m): where along it, how wide, how tall.
  const openings = (layout.furniture ?? []).flatMap((f) => {
    const spec = FURNITURE[f.type];
    if (!spec?.wall) return [];
    const hit = nearestWall(walls, [f.x, f.y]);
    if (!hit || hit.d > 0.5 / mpu) return [];
    const wa = toM(hit.wall.a);
    const wb = toM(hit.wall.b);
    const wl = Math.hypot(wb[0] - wa[0], wb[1] - wa[1]);
    const bottom = isWindow(f) ? f.sill ?? spec.sill ?? 0.9 : 0;
    return [{ id: f.id, wallId: hit.wall.id, along: hit.t * wl, w: f.w, bottom, top: bottom + f.h }];
  });
  const wallSides = new Map<string, { n: [number, number]; roomPlus: boolean; roomMinus: boolean; cutH: number }>();
  // Walls.
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.9 });
  const wallMatExt = new THREE.MeshStandardMaterial({ color: 0xd9dee5, roughness: 0.9 });
  for (const w of walls) {
    const a = toM(w.a);
    const b = toM(w.b);
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 0.01) continue;
    if (w.virtual) {
      // Open-plan boundary: a faint seam on the floor, no wall.
      const seam = new THREE.Mesh(new THREE.BoxGeometry(len, 0.012, 0.04), new THREE.MeshStandardMaterial({ color: 0xcbd5e1 }));
      seam.position.set((a[0] + b[0]) / 2, 0.02, (a[1] + b[1]) / 2);
      seam.rotation.y = -Math.atan2(b[1] - a[1], b[0] - a[0]);
      scene.add(seam);
      continue;
    }
    const h = w.exterior ? layout.wallDefaults.height : Math.max(...w.rooms.map((id) => layout.rooms.find((r) => r.id === id)?.height ?? layout.wallDefaults.height));
    const ux = (b[0] - a[0]) / len;
    const uz = (b[1] - a[1]) / len;
    const rotY = -Math.atan2(b[1] - a[1], b[0] - a[0]);
    // Cutaway bookkeeping: which side of the wall has a room (probe 0.3 m to each side, canvas units).
    const nx = -(w.b[1] - w.a[1]);
    const nz = w.b[0] - w.a[0];
    const nl = Math.hypot(nx, nz) || 1;
    const probe = 0.3 / mpu;
    const mid: Point = [(w.a[0] + w.b[0]) / 2, (w.a[1] + w.b[1]) / 2];
    const plus: Point = [mid[0] + (nx / nl) * probe, mid[1] + (nz / nl) * probe];
    const minus: Point = [mid[0] - (nx / nl) * probe, mid[1] - (nz / nl) * probe];
    const side = { n: [nx / nl, nz / nl] as [number, number], roomPlus: layout.rooms.some((r) => pointInPolygon(plus, r.points)), roomMinus: layout.rooms.some((r) => pointInPolygon(minus, r.points)), cutH: w.exterior ? 0.5 : 0.9 };
    wallSides.set(w.id, side);
    // Doors and windows on this wall become holes; exterior walls extend half a thickness past each end to close corners.
    const cuts: OpeningCut[] = openings.filter((o) => o.wallId === w.id).map((o) => ({ along: o.along, w: o.w, bottom: o.bottom, top: o.top }));
    const ext = w.exterior ? w.thickness / 2 : 0;
    for (const pc of wallPieces(len, h, cuts)) {
      const x0 = pc.x0 < 0.001 ? -ext : pc.x0;
      const x1 = pc.x1 > len - 0.001 ? len + ext : pc.x1;
      const ph = pc.y1 - pc.y0;
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, ph, w.thickness), w.exterior ? wallMatExt : wallMat);
      const c = (x0 + x1) / 2;
      mesh.position.set(a[0] + ux * c, pc.y0 + ph / 2, a[1] + uz * c);
      mesh.rotation.y = rotY;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
      cutaway.push({ mesh, h: ph, y0: pc.y0, ...side });
    }
  }
  scene.userData.cutaway = cutaway;

  // Status callouts: cards outside the house, leader down to the room floor.
  for (const pl of frameLayout(layout, hass, 1 / mpu)) {
    const rows = pl.items.slice(0, 6).map((it) => frameValue(it, hass).text);
    const card = multilineSprite([pl.room.name, ...rows], "#1f2937");
    const cx = (pl.pos[0] + (FRAME_W / mpu) / 2) * mpu;
    const cz = (pl.pos[1] + (frameHeight(pl.items.length) / mpu) / 2) * mpu;
    const cy = 2.0;
    card.position.set(cx, cy, cz);
    card.renderOrder = 10;
    scene.add(card);
    const [ax, az] = toM(pl.anchor);
    const pts = [new THREE.Vector3(cx, cy - 0.35, cz), new THREE.Vector3(cx, 0.06, cz), new THREE.Vector3(ax, 0.06, az)];
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const line = new THREE.Line(geo, new THREE.LineDashedMaterial({ color: 0x64748b, dashSize: 0.18, gapSize: 0.12 }));
    line.computeLineDistances();
    scene.add(line);
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshBasicMaterial({ color: 0x64748b }));
    dot.position.set(ax, 0.06, az);
    scene.add(dot);
  }

  // Furniture.
  for (const f of layout.furniture ?? []) {
    const g = buildFurniture(f);
    const [fx, fz] = toM([f.x, f.y]);
    g.position.set(fx, 0, fz);
    g.rotation.y = THREE.MathUtils.degToRad(-f.rotation);
    scene.add(g);
    // A door or window disappears together with its wall when the cutaway lowers it.
    const op = openings.find((o) => o.id === f.id);
    const side = op && wallSides.get(op.wallId);
    if (op && side) cutaway.push({ mesh: g, h: op.top, y0: 0, hideOnly: true, ...side });
  }

  // Items (a repeated light becomes one pseudo-item per fixture).
  const expanded: Item[] = [];
  for (const it of layout.items) {
    if (resolveKind(it, hass) === "light" && it.repeat && it.repeat.count > 1) {
      for (const [px, py] of fixturePositions(it, layout.metresPerUnit)) expanded.push({ ...it, x: px, y: py, repeat: null });
    } else expanded.push(it);
  }
  // Lights near a wall leak the most, so they get shadow maps first. Shadow maps are static (see autoUpdate),
  // but each one is a texture sampler in every lit material, so the count stays well under the GPU limit.
  const wallDistM = (it: Item) => { const n = nearestWall(walls, [it.x, it.y]); return n ? n.d * mpu : 99; };
  const isOnLight = (it: Item) => resolveKind(it, hass) === "light" && hass.states[it.entityId]?.state === "on";
  expanded.sort((a, b) => (isOnLight(a) ? wallDistM(a) : 1e3) - (isOnLight(b) ? wallDistM(b) : 1e3));
  let shadowBudget = 10;
  for (const item of expanded) {
    if (resolveKind(item, hass) === "light" && item.fixture === "room") continue; // whole-room lighting: floor tint only
    if (effectiveShowIn(item, hass) === "frame") continue; // listed in the room frame instead
    const [x, z] = toM([item.x, item.y]);
    const kind = resolveKind(item, hass);
    const state = hass.states[item.entityId];
    if (kind === "light") {
      const on = state?.state === "on";
      const color = new THREE.Color(on ? lightColor(hass, item.entityId, item.color) : "#9ca3af");
      const fixture = item.fixture ?? "downlight";
      const ceilingH = roomCeiling(layout, item);
      const yMount = effectiveHeight(item, hass, ceilingH);
      // Ceiling fixtures hang just below the slab; pendants drop 0.8 m.
      const y = fixture === "pendant" && yMount >= ceilingH - 0.05 ? ceilingH - 0.8 : Math.min(yMount, ceilingH - 0.03);
      const bright = brightness01(hass, item.entityId);
      const bodyColor = on ? (fixture === "strip" ? color.clone().lerp(new THREE.Color(0xffffff), 0.6) : color) : new THREE.Color(0xd1d5db);
      const mat = new THREE.MeshStandardMaterial({ color: bodyColor, emissive: on ? color : 0x000000, emissiveIntensity: on ? (fixture === "strip" ? 0.35 + 0.3 * bright : 0.8 + bright) : 0 });
      let geo: THREE.BufferGeometry;
      const L = item.length ?? 1;
      if (fixture === "strip") geo = new THREE.BoxGeometry(L, 0.04, 0.06);
      else if (fixture === "wall") geo = new THREE.SphereGeometry(0.12, 16, 8, 0, Math.PI);
      else if (fixture === "pendant") geo = new THREE.ConeGeometry(0.18, 0.2, 20, 1, true);
      else if (fixture === "ceiling") geo = new THREE.CylinderGeometry(0.25, 0.25, 0.06, 24);
      else geo = new THREE.CylinderGeometry(0.09, 0.09, 0.03, 16);
      const mesh = new THREE.Mesh(geo, mat);
      // Wall-hugging lights sit just off the wall face, on the room side.
      let lx = x;
      let lz = z;
      let inN: [number, number] = [0, 0];
      const near = nearestWall(walls, [item.x, item.y]);
      const room = layout.rooms.find((r) => pointInPolygon([item.x, item.y], r.points));
      if (hugsWall(item, hass)) {
        const inward = wallInward(layout, item);
        const off = (near && near.d < 0.5 / mpu ? near.wall.thickness / 2 : 0) + 0.04;
        inN = [inward.n[0], inward.n[1]];
        lx = x + inN[0] * off;
        lz = z + inN[1] * off;
      }
      mesh.position.set(lx, y, lz);
      mesh.rotation.y = THREE.MathUtils.degToRad(-(item.rotation ?? 0));
      if (fixture === "pendant") {
        const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, Math.max(0.05, ceilingH - y), 6), new THREE.MeshStandardMaterial({ color: 0x374151 }));
        cord.position.set(x, y + (ceilingH - y) / 2, z);
        scene.add(cord);
      }
      scene.add(mesh);
      if (on) {
        const beam = hasBeam(item, hass) ? effectiveBeam(item, hass) : "down";
        const wallSide = hugsWall(item, hass);
        const poolMat = new THREE.MeshBasicMaterial({ map: poolTexture(), color, transparent: true, opacity: 0.1 + 0.16 * bright, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
        const rotZ = THREE.MathUtils.degToRad(-(item.rotation ?? 0));
        // Pools hug the wall on the room side when wall-mounted, else centre on the fixture.
        // Wide, feathered pools that overlap and merge; radius grows with mount height.
        const spread = 1.0 + Math.max(0, y - 1) * 0.5;
        const poolW = fixture === "strip" ? L + 1.2 : 2.2 * spread;
        const poolD = fixture === "strip" ? (wallSide ? 1.4 : 1.8) : wallSide ? 1.4 : 2.2 * spread;
        const px = wallSide ? lx + inN[0] * (poolD / 2) : x;
        const pz = wallSide ? lz + inN[1] * (poolD / 2) : z;
        const addPool = (yy: number, faceDown: boolean) => {
          if (room) {
            // The pool is the room's own polygon with the glow texture projected onto it, so it cannot
            // spill under a wall into the next room (the texture is transparent outside its rectangle).
            const shape = new THREE.Shape(room.points.map((p) => { const [sx, sz] = toM(p); return new THREE.Vector2(sx, sz); }));
            const geo = new THREE.ShapeGeometry(shape);
            const pos = geo.attributes.position;
            const uv = geo.attributes.uv as THREE.BufferAttribute;
            const cs = Math.cos(rotZ);
            const sn = Math.sin(rotZ);
            for (let k = 0; k < pos.count; k++) {
              const dx = pos.getX(k) - px;
              const dz = pos.getY(k) - pz;
              uv.setXY(k, (dx * cs - dz * sn) / poolW + 0.5, (dx * sn + dz * cs) / poolD + 0.5);
            }
            uv.needsUpdate = true;
            const pool = new THREE.Mesh(geo, poolMat);
            pool.rotation.x = Math.PI / 2; // shape (x,y) → (x,z)
            pool.position.y = yy;
            scene.add(pool);
          } else {
            const pool = new THREE.Mesh(new THREE.PlaneGeometry(poolW, poolD), poolMat);
            pool.rotation.x = faceDown ? Math.PI / 2 : -Math.PI / 2;
            pool.rotation.z = rotZ;
            pool.position.set(px, yy, pz);
            scene.add(pool);
          }
        };
        if (beam === "down" || beam === "both") addPool(0.02, false);
        if (beam === "up" || beam === "both") {
          if (wallSide) {
            // No ceiling in a dollhouse, so an up-throw reads as a glow on the wall above the fixture.
            const gh = Math.max(0.3, ceilingH - y + 0.1);
            let ww = poolW + 0.8;
            let wx = lx + inN[0] * 0.015;
            let wz = lz + inN[1] * 0.015;
            let wrot = rotZ;
            if (near && near.d < 0.5 / mpu) {
              // Keep the wash on its own wall: no wider than the wall, centred within its ends.
              const a = toM(near.wall.a);
              const b = toM(near.wall.b);
              const wl = Math.hypot(b[0] - a[0], b[1] - a[1]);
              const ux = (b[0] - a[0]) / wl;
              const uz = (b[1] - a[1]) / wl;
              ww = Math.min(ww, wl);
              let along = (lx - a[0]) * ux + (lz - a[1]) * uz;
              along = Math.max(ww / 2, Math.min(wl - ww / 2, along));
              wx = a[0] + ux * along + inN[0] * 0.015;
              wz = a[1] + uz * along + inN[1] * 0.015;
              wrot = -Math.atan2(uz, ux);
            }
            const wash = new THREE.Mesh(new THREE.PlaneGeometry(ww, gh), new THREE.MeshBasicMaterial({ map: washTexture(), color, transparent: true, opacity: 0.45 + 0.35 * bright, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
            wash.position.set(wx, y - 0.1 + gh / 2, wz);
            wash.rotation.y = wrot;
            scene.add(wash);
          } else addPool(ceilingH - 0.02, true);
        }
        const ly = beam === "up" ? Math.min(ceilingH - 0.15, y + 0.15) : Math.max(0.2, y - 0.1);
        const wd = near ? near.d * mpu : 99;
        const useShadow = shadowBudget > 0 && wd < 3.5;
        if (useShadow) shadowBudget--;
        if (!wallSide && beam === "down" && fixture !== "strip") {
          // Ceiling fixtures: a soft downward cone. With a shadow map the walls block it; without one the
          // cone is narrowed so its floor disc stops at the nearest wall instead of lighting the next room.
          const rMax = wd + 0.4;
          const angle = useShadow ? 0.9 : Math.max(0.3, Math.min(0.9, Math.atan2(rMax, Math.max(0.5, ly))));
          const sp = new THREE.SpotLight(color, 2.5 + 6 * bright, 6, angle, 0.8, 1.3);
          sp.position.set(x, ly, z);
          sp.target.position.set(x, 0, z);
          if (useShadow) { sp.castShadow = true; sp.shadow.mapSize.set(256, 256); sp.shadow.bias = -0.002; sp.shadow.camera.near = 0.2; sp.shadow.camera.far = 8; }
          scene.add(sp, sp.target);
        } else {
          // Wall lights, strips and up-throws: an omni light; range limited to the room when it has no shadow map.
          const range = useShadow ? 4.5 : Math.min(4.5, Math.max(1.2, wd + 0.8));
          const pl = new THREE.PointLight(color, 5 + 14 * bright, range, 1.6);
          if (useShadow) { pl.castShadow = true; pl.shadow.mapSize.set(256, 256); pl.shadow.bias = -0.002; pl.shadow.camera.near = 0.1; pl.shadow.camera.far = 6; }
          pl.position.set(wallSide ? lx + inN[0] * 0.2 : x, ly, wallSide ? lz + inN[1] * 0.2 : z);
          scene.add(pl);
        }
      }
    } else if (kind === "climate") {
      const mode = state?.state ?? "off";
      const col = { cool: 0x3b82f6, heat: 0xf97316, dry: 0xeab308, fan_only: 0x14b8a6 }[mode as "cool"] ?? 0x9ca3af;
      const ceilingH = roomCeiling(layout, item);
      const yc = effectiveHeight(item, hass, ceilingH);
      const ledMat = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: mode === "off" ? 0 : 0.8 });
      const white = new THREE.MeshStandardMaterial({ color: 0xffffff });
      const rot = THREE.MathUtils.degToRad(-(item.rotation ?? 0));
      if (yc >= ceilingH - 0.05) {
        // ceiling cassette: flat square panel with a lit rim
        const unit = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.05, 0.65), white);
        unit.position.set(x, ceilingH - 0.03, z);
        scene.add(unit);
        const led = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.02, 0.5), ledMat);
        led.position.set(x, ceilingH - 0.06, z);
        scene.add(led);
      } else if (yc <= 0.05) {
        // floor-standing unit
        const unit = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.8, 0.3), white);
        unit.position.set(x, 0.9, z);
        unit.rotation.y = rot;
        unit.castShadow = true;
        scene.add(unit);
        const led = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.04, 0.32), ledMat);
        led.position.set(x, 1.5, z);
        led.rotation.y = rot;
        scene.add(led);
      } else {
        const unit = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.28, 0.22), white);
        unit.position.set(x, yc, z);
        unit.rotation.y = rot;
        unit.castShadow = true;
        scene.add(unit);
        const led = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.04, 0.24), ledMat);
        led.position.set(x, yc - 0.16, z);
        led.rotation.y = rot;
        scene.add(led);
      }
      const cur = state?.attributes.current_temperature as number | undefined;
      const target = state?.attributes.temperature as number | undefined;
      const txt = mode === "off" ? t("{cur}° 關", { cur: cur?.toFixed(1) ?? "--" }) : `${cur?.toFixed(1) ?? "--"}° → ${target ?? "--"}°`;
      const sp = textSprite(txt, "#111827", 0.9);
      sp.position.set(x, Math.min(ceilingH - 0.1, (yc <= 0.05 ? 1.8 : yc) + 0.45), z);
      scene.add(sp);
    } else if (kind === "cover") {
      const v = coverView(hass, item);
      const L = item.length ?? 1.5;
      const H = 2.2; // curtain drop
      const top = 2.4;
      const rotY = THREE.MathUtils.degToRad(-(item.rotation ?? 0));
      const inward = coverInward(layout, item);
      const near = nearestWall(walls, [item.x, item.y]);
      const off = (near && near.d < 0.5 / mpu ? near.wall.thickness / 2 : 0) + 0.04;
      const group = new THREE.Group();
      group.position.set(x + inward.n[0] * off, 0, z + inward.n[1] * off);
      group.rotation.y = rotY;
      const fabric = new THREE.MeshStandardMaterial({ color: v.unknown ? 0x9ca3af : 0x64748b, side: THREE.DoubleSide, roughness: 1 });
      const glass = new THREE.MeshStandardMaterial({ color: 0xbae6fd, transparent: true, opacity: 0.35, side: THREE.DoubleSide });
      const win = new THREE.Mesh(new THREE.PlaneGeometry(L, H), glass);
      win.position.set(0, top - H / 2, 0);
      group.add(win);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(L + 0.1, 0.04, 0.06), new THREE.MeshStandardMaterial({ color: 0x1f2937 }));
      rail.position.set(0, top + 0.02, 0.05);
      group.add(rail);
      if (v.style === "curtain") {
        for (const pn of curtainPanels(L, v.open, item.coverDraw, inward.flip)) {
          if (pn.w < 0.01) continue;
          const p = new THREE.Mesh(new THREE.BoxGeometry(pn.w, H, 0.05), fabric);
          p.position.set(pn.x0 + pn.w / 2, top - H / 2, 0.05);
          p.castShadow = true;
          group.add(p);
        }
      } else if (v.style === "roller") {
        const drop = (1 - v.open) * H;
        if (drop > 0.01) {
          const p = new THREE.Mesh(new THREE.BoxGeometry(L, drop, 0.03), fabric);
          p.position.set(0, top - drop / 2, 0.05);
          p.castShadow = true;
          group.add(p);
        }
      } else {
        const drop = (1 - v.open) * H;
        const n = Math.max(1, Math.round(drop / 0.08));
        const slatMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, side: THREE.DoubleSide });
        for (let i = 0; i < n; i++) {
          const s = new THREE.Mesh(new THREE.BoxGeometry(L, 0.07, 0.01), slatMat);
          s.position.set(0, top - 0.04 - i * 0.08, 0.05);
          s.rotation.x = THREE.MathUtils.degToRad(80 - v.tilt * 80);
          group.add(s);
        }
      }
      scene.add(group);
      const sp = textSprite(`${Math.round(v.open * 100)}%`, "#0f172a", 0.6);
      sp.position.set(x + inward.n[0] * (off + 0.3), top + 0.35, z + inward.n[1] * (off + 0.3));
      scene.add(sp);
    } else if (kind === "presence") {
      const on = state?.state === "on";
      const disc = new THREE.Mesh(new THREE.CircleGeometry(on ? 0.45 : 0.2, 24), new THREE.MeshBasicMaterial({ color: on ? 0x22c55e : 0x9ca3af, transparent: true, opacity: on ? 0.5 : 0.35 }));
      disc.rotation.x = -Math.PI / 2;
      disc.position.set(x, 0.03, z);
      scene.add(disc);
      const ceilingH = roomCeiling(layout, item);
      const yp = effectiveHeight(item, hass, ceilingH);
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), new THREE.MeshStandardMaterial({ color: on ? 0x22c55e : 0xd1d5db, emissive: on ? 0x22c55e : 0x000000, emissiveIntensity: 0.6 }));
      body.position.set(x, Math.min(yp, ceilingH - 0.06), z);
      scene.add(body);
    } else {
      const active = state?.state === "on" || state?.state === "open" || state?.state === "playing";
      const ceilingH = roomCeiling(layout, item);
      const yg = effectiveHeight(item, hass, ceilingH);
      const gmat = new THREE.MeshStandardMaterial({ color: active ? 0x2563eb : 0x9ca3af });
      let box: THREE.Mesh;
      if (yg >= ceilingH - 0.05) box = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.03, 16), gmat);
      else if (yg <= 0.05) box = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.25, 12), gmat);
      else box = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.03), gmat);
      box.position.set(x, yg >= ceilingH - 0.05 ? ceilingH - 0.02 : yg <= 0.05 ? 0.125 : yg, z);
      box.rotation.y = THREE.MathUtils.degToRad(-(item.rotation ?? 0));
      box.castShadow = true;
      scene.add(box);
      const raw = item.attribute ? state?.attributes[item.attribute] : state?.state;
      const unit = item.attribute ? "" : ((state?.attributes.unit_of_measurement as string | undefined) ?? "");
      if (layout.labels3d !== false) {
        const sp = textSprite(`${raw ?? "?"}${unit}`, "#374151", 0.7);
        sp.position.set(x, yg >= ceilingH - 0.05 ? ceilingH - 0.3 : yg <= 0.05 ? 0.55 : yg + 0.3, z);
        scene.add(sp);
      }
    }
  }
}

/** Ceiling height of the room containing the item, else the layout default. */
function roomCeiling(layout: Layout, item: { x: number; y: number }): number {
  const room = layout.rooms.find((r) => inside([item.x, item.y], r.points));
  return room?.height ?? layout.wallDefaults.height;
}

/** Room name plus value rows on one card. */
function multilineSprite(lines: string[], color: string): THREE.Sprite {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  const title = "bold 40px system-ui, 'Noto Sans TC', sans-serif";
  const body = "30px system-ui, 'Noto Sans TC', sans-serif";
  ctx.font = title;
  let w = ctx.measureText(lines[0]).width;
  ctx.font = body;
  for (const l of lines.slice(1)) w = Math.max(w, ctx.measureText(l).width);
  w = Math.ceil(w) + 32;
  const h = 56 + (lines.length - 1) * 38 + 12;
  canvas.width = w;
  canvas.height = h;
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  roundRect(ctx, 0, 0, w, h, 16);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.textBaseline = "middle";
  ctx.font = title;
  ctx.fillText(lines[0], 16, 30);
  ctx.font = body;
  ctx.fillStyle = "#374151";
  lines.slice(1).forEach((l, i) => ctx.fillText(l, 16, 62 + i * 38));
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  sprite.scale.set((w / 64) * 0.58, (h / 64) * 0.58, 1);
  return sprite;
}

function textSprite(text: string, color: string, scale = 1): THREE.Sprite {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  const font = "bold 40px system-ui, 'Noto Sans TC', sans-serif";
  ctx.font = font;
  const w = Math.ceil(ctx.measureText(text).width) + 32;
  canvas.width = w;
  canvas.height = 64;
  ctx.font = font;
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  roundRect(ctx, 0, 0, w, 64, 16);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.textBaseline = "middle";
  ctx.fillText(text, 16, 32);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  sprite.scale.set((w / 64) * 0.45 * scale, 0.45 * scale, 1);
  return sprite;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function inside(p: Point, pts: Point[]): boolean {
  let r = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) r = !r;
  }
  return r;
}
