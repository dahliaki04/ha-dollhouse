import { useEffect, useRef, useState } from "react";
import { t } from "../i18n";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { Layout, Point } from "../domain/types";
import { deriveWalls, nearestWall } from "../domain/walls";
import { bbox, centroid, pointInPolygon } from "../domain/geometry";
import { effectiveBeam, effectiveHeight, hasBeam, hugsWall, resolveKind } from "../domain/entities";
import { coverInward, coverView, curtainPanels, wallInward } from "../domain/covers";
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
      frame();
    } catch (e) {
      setFatal(t("3D 場景建立失敗：{msg}", { msg: (e as Error).message }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, hass.states]);

  const render = () => {
    const t = three.current;
    if (!t) return;
    applyCutaway(t.scene, t.camera, t.controls.target);
    t.renderer.render(t.scene, t.camera);
  };

  /** Fit the orthographic frustum to the container; zoom is left to OrbitControls. */
  const frame = () => {
    const t = three.current;
    if (!t) return;
    const el = mount.current!;
    const w = el.clientWidth || 1;
    const h = el.clientHeight || 1;
    const size = layoutSizeM(layout);
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
    const size = layoutSizeM(layout);
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
      <div style={{ position: "absolute", top: 10, left: 10, display: "flex", gap: 6 }}>
        <button className="dh-btn" onClick={() => turn(-1)}>{t("⟲ 轉")}</button>
        <button className="dh-btn" onClick={() => turn(1)}>{t("轉 ⟳")}</button>
        <button className="dh-btn" onClick={() => zoomBy(1.25)}>{t("＋")}</button>
        <button className="dh-btn" onClick={() => zoomBy(1 / 1.25)}>{t("－")}</button>
        <button className="dh-btn" onClick={() => { const t = three.current; if (t) { t.camera.zoom = 1; t.camera.updateProjectionMatrix(); } placeCamera(0); }}>{t("重置")}</button>
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
  mesh: THREE.Mesh;
  h: number;
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
function applyCutaway(scene: THREE.Scene, camera: THREE.Camera, target: THREE.Vector3) {
  const list = (scene.userData.cutaway as CutawayWall[] | undefined) ?? [];
  const cx = camera.position.x - target.x;
  const cz = camera.position.z - target.z;
  const cl = Math.hypot(cx, cz) || 1;
  const dx = cx / cl;
  const dz = cz / cl;
  for (const w of list) {
    const facing = w.n[0] * dx + w.n[1] * dz; // >0: +n side faces the camera
    const farHasRoom = facing > 0 ? w.roomMinus : w.roomPlus;
    const target_h = farHasRoom ? Math.min(w.h, w.cutH) : w.h;
    w.mesh.scale.y = target_h / w.h;
    w.mesh.position.y = target_h / 2;
  }
}

function layoutSizeM(layout: Layout) {
  const mpu = layout.metresPerUnit;
  const pts: Point[] = layout.rooms.flatMap((r) => r.points);
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
    const lit = layout.items.some((i) => i.entityId.startsWith("light.") && hass.states[i.entityId]?.state === "on" && inside([i.x, i.y], room.points));
    const shape = new THREE.Shape(room.points.map((p) => { const [x, z] = toM(p); return new THREE.Vector2(x, z); }));
    const geo = new THREE.ShapeGeometry(shape);
    const base = new THREE.Color(room.color ?? "#f8fafc");
    const mat = new THREE.MeshStandardMaterial({ color: lit ? base.clone().lerp(new THREE.Color("#ffe4b5"), 0.6) : base, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = Math.PI / 2; // shape (x,y) → (x,z)
    mesh.position.y = 0.01;
    mesh.receiveShadow = true;
    scene.add(mesh);
    // Room label sprite.
    const c = toM(centroid(room.points));
    const label = textSprite(room.name, "#1f2937");
    label.position.set(c[0], 0.3, c[1]);
    scene.add(label);
  }

  const walls = deriveWalls(layout);
  const cutaway: CutawayWall[] = [];
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
    const geo = new THREE.BoxGeometry(len + (w.exterior ? w.thickness : 0), h, w.thickness);
    const mesh = new THREE.Mesh(geo, w.exterior ? wallMatExt : wallMat);
    mesh.position.set((a[0] + b[0]) / 2, h / 2, (a[1] + b[1]) / 2);
    mesh.rotation.y = -Math.atan2(b[1] - a[1], b[0] - a[0]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    // Cutaway bookkeeping: which side of the wall has a room (probe 0.3 m to each side, canvas units).
    const nx = -(w.b[1] - w.a[1]);
    const nz = w.b[0] - w.a[0];
    const nl = Math.hypot(nx, nz) || 1;
    const probe = 0.3 / mpu;
    const mid: Point = [(w.a[0] + w.b[0]) / 2, (w.a[1] + w.b[1]) / 2];
    const plus: Point = [mid[0] + (nx / nl) * probe, mid[1] + (nz / nl) * probe];
    const minus: Point = [mid[0] - (nx / nl) * probe, mid[1] - (nz / nl) * probe];
    cutaway.push({
      mesh,
      h,
      n: [nx / nl, nz / nl],
      roomPlus: layout.rooms.some((r) => pointInPolygon(plus, r.points)),
      roomMinus: layout.rooms.some((r) => pointInPolygon(minus, r.points)),
      cutH: w.exterior ? 0.5 : 0.9,
    });
  }
  scene.userData.cutaway = cutaway;

  // Furniture.
  for (const f of layout.furniture ?? []) {
    const g = buildFurniture(f);
    const [fx, fz] = toM([f.x, f.y]);
    g.position.set(fx, 0, fz);
    g.rotation.y = THREE.MathUtils.degToRad(-f.rotation);
    scene.add(g);
  }

  // Items.
  for (const item of layout.items) {
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
      const mat = new THREE.MeshStandardMaterial({ color: on ? color : 0xd1d5db, emissive: on ? color : 0x000000, emissiveIntensity: on ? 0.8 + bright : 0 });
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
      if (hugsWall(item, hass)) {
        const inward = wallInward(layout, item);
        const near = nearestWall(walls, [item.x, item.y]);
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
        const poolMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.18 + 0.2 * bright, depthWrite: false });
        const rotZ = THREE.MathUtils.degToRad(-(item.rotation ?? 0));
        // Pools hug the wall on the room side when wall-mounted, else centre on the fixture.
        const poolW = fixture === "strip" ? L + 0.6 : 1.4;
        const poolD = fixture === "strip" ? (wallSide ? 0.9 : 1.2) : wallSide ? 0.9 : 1.4;
        const px = wallSide ? lx + inN[0] * (poolD / 2) : x;
        const pz = wallSide ? lz + inN[1] * (poolD / 2) : z;
        const addPool = (yy: number, faceDown: boolean) => {
          const pool = new THREE.Mesh(fixture === "strip" || wallSide ? new THREE.PlaneGeometry(poolW, poolD) : new THREE.CircleGeometry(0.7, 24), poolMat);
          pool.rotation.x = faceDown ? Math.PI / 2 : -Math.PI / 2;
          pool.rotation.z = rotZ;
          pool.position.set(px, yy, pz);
          scene.add(pool);
        };
        if (beam === "down" || beam === "both") addPool(0.02, false);
        if (beam === "up" || beam === "both") {
          if (wallSide) {
            // No ceiling in a dollhouse, so an up-throw reads as a glow on the wall above the fixture.
            const gh = Math.max(0.2, ceilingH - y);
            const wash = new THREE.Mesh(new THREE.PlaneGeometry(poolW, gh), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.22 + 0.25 * bright, depthWrite: false, side: THREE.DoubleSide }));
            wash.position.set(lx + inN[0] * 0.01, y + gh / 2, lz + inN[1] * 0.01);
            wash.rotation.y = rotZ;
            scene.add(wash);
          } else addPool(ceilingH - 0.02, true);
        }
        const pl = new THREE.PointLight(color, 5 + 14 * bright, 4.5, 1.6);
        // Shadows stop light leaking through walls onto the outside ground; scene renders on demand so the cost is fine.
        pl.castShadow = true;
        pl.shadow.mapSize.set(512, 512);
        pl.shadow.bias = -0.002;
        const ly = beam === "up" ? Math.min(ceilingH - 0.15, y + 0.15) : Math.max(0.2, y - 0.1);
        pl.position.set(wallSide ? lx + inN[0] * 0.2 : x, ly, wallSide ? lz + inN[1] * 0.2 : z);
        scene.add(pl);
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
