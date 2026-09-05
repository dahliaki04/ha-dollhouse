import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { Layout, Point } from "../domain/types";
import { deriveWalls } from "../domain/walls";
import { bbox, centroid } from "../domain/geometry";
import { FIXTURE_HEIGHT, resolveKind } from "../domain/entities";
import type { HassLike } from "../ha/types";
import { brightness01, lightColor } from "./markers";

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
  const [dir, setDir] = useState(0); // 0..3 quarter turns
  const [zoom, setZoom] = useState(1);
  const three = useRef<{ renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.OrthographicCamera } | null>(null);

  // Renderer lifecycle.
  useEffect(() => {
    const el = mount.current!;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 500);
    three.current = { renderer, scene, camera };
    const ro = new ResizeObserver(() => {
      renderer.setSize(el.clientWidth, el.clientHeight, false);
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      frame();
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
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
    buildScene(t.scene, layout, hass);
    frame();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, hass.states, dir, zoom]);

  const frame = () => {
    const t = three.current;
    if (!t) return;
    const el = mount.current!;
    const w = el.clientWidth || 1;
    const h = el.clientHeight || 1;
    const size = layoutSizeM(layout);
    const span = Math.max(size.w, size.h) * 0.75 / zoom;
    const aspect = w / h;
    t.camera.left = -span * aspect;
    t.camera.right = span * aspect;
    t.camera.top = span;
    t.camera.bottom = -span;
    // Isometric-ish: 45° azimuth per direction, ~35° elevation.
    const az = (Math.PI / 4) + dir * (Math.PI / 2);
    const r = 60;
    t.camera.position.set(size.cx + r * Math.cos(az), r * 0.7, size.cz + r * Math.sin(az));
    t.camera.lookAt(size.cx, 0, size.cz);
    t.camera.updateProjectionMatrix();
    t.renderer.setSize(w, h, false);
    t.renderer.render(t.scene, t.camera);
  };

  return (
    <div ref={mount} style={{ position: "absolute", inset: 0, background: "linear-gradient(#e5e7eb,#f3f4f6)" }} onWheel={(e) => setZoom((z) => Math.min(4, Math.max(0.4, z * (e.deltaY > 0 ? 0.9 : 1.1))))}>
      <div style={{ position: "absolute", top: 10, left: 10, display: "flex", gap: 6 }}>
        <button className="dh-btn" onClick={() => setDir((d) => (d + 3) % 4)}>⟲ 轉</button>
        <button className="dh-btn" onClick={() => setDir((d) => (d + 1) % 4)}>轉 ⟳</button>
        <button className="dh-btn" onClick={() => setZoom(1)}>重置縮放</button>
      </div>
      <div className="dh-hint">娃娃屋視圖：四個方向切換，滾輪縮放。狀態即時更新。</div>
    </div>
  );
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

  // Walls.
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.9 });
  const wallMatExt = new THREE.MeshStandardMaterial({ color: 0xd9dee5, roughness: 0.9 });
  for (const w of deriveWalls(layout)) {
    const a = toM(w.a);
    const b = toM(w.b);
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 0.01) continue;
    const h = w.exterior ? layout.wallDefaults.height : Math.max(...w.rooms.map((id) => layout.rooms.find((r) => r.id === id)?.height ?? layout.wallDefaults.height));
    const geo = new THREE.BoxGeometry(len + (w.exterior ? w.thickness : 0), h, w.thickness);
    const mesh = new THREE.Mesh(geo, w.exterior ? wallMatExt : wallMat);
    mesh.position.set((a[0] + b[0]) / 2, h / 2, (a[1] + b[1]) / 2);
    mesh.rotation.y = -Math.atan2(b[1] - a[1], b[0] - a[0]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
  }

  // Items.
  for (const item of layout.items) {
    const [x, z] = toM([item.x, item.y]);
    const kind = resolveKind(item, hass);
    const state = hass.states[item.entityId];
    if (kind === "light") {
      const on = state?.state === "on";
      const color = new THREE.Color(on ? lightColor(hass, item.entityId) : "#9ca3af");
      const fixture = item.fixture ?? "downlight";
      const y = item.z ?? FIXTURE_HEIGHT[fixture];
      const bright = brightness01(hass, item.entityId);
      const mat = new THREE.MeshStandardMaterial({ color: on ? color : 0xd1d5db, emissive: on ? color : 0x000000, emissiveIntensity: on ? 0.8 + bright : 0 });
      let geo: THREE.BufferGeometry;
      if (fixture === "strip") geo = new THREE.BoxGeometry(1.0, 0.04, 0.06);
      else if (fixture === "wall") geo = new THREE.SphereGeometry(0.12, 16, 8, 0, Math.PI);
      else if (fixture === "pendant") geo = new THREE.ConeGeometry(0.18, 0.2, 20, 1, true);
      else if (fixture === "ceiling") geo = new THREE.CylinderGeometry(0.25, 0.25, 0.06, 24);
      else geo = new THREE.CylinderGeometry(0.09, 0.09, 0.03, 16);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, Math.min(y, 2.75), z);
      mesh.rotation.y = THREE.MathUtils.degToRad(-(item.rotation ?? 0));
      if (fixture === "pendant") {
        const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 2.8 - y, 6), new THREE.MeshStandardMaterial({ color: 0x374151 }));
        cord.position.set(x, y + (2.8 - y) / 2, z);
        scene.add(cord);
      }
      scene.add(mesh);
      if (on) {
        const pl = new THREE.PointLight(color, 5 + 14 * bright, 5, 1.6);
        pl.position.set(x, Math.min(y, 2.6) - 0.1, z);
        scene.add(pl);
        // Light pool on the floor.
        const pool = new THREE.Mesh(new THREE.CircleGeometry(fixture === "strip" ? 0.9 : 0.7, 24), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.18 + 0.2 * bright, depthWrite: false }));
        pool.rotation.x = -Math.PI / 2;
        pool.position.set(x, 0.02, z);
        scene.add(pool);
      }
    } else if (kind === "climate") {
      const mode = state?.state ?? "off";
      const col = { cool: 0x3b82f6, heat: 0xf97316, dry: 0xeab308, fan_only: 0x14b8a6 }[mode as "cool"] ?? 0x9ca3af;
      const unit = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.28, 0.22), new THREE.MeshStandardMaterial({ color: 0xffffff }));
      unit.position.set(x, item.z ?? 2.2, z);
      unit.castShadow = true;
      scene.add(unit);
      const led = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.04, 0.24), new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: mode === "off" ? 0 : 0.8 }));
      led.position.set(x, (item.z ?? 2.2) - 0.16, z);
      scene.add(led);
      const cur = state?.attributes.current_temperature as number | undefined;
      const target = state?.attributes.temperature as number | undefined;
      const txt = mode === "off" ? `${cur?.toFixed(1) ?? "--"}° 關` : `${cur?.toFixed(1) ?? "--"}° → ${target ?? "--"}°`;
      const sp = textSprite(txt, "#111827", 0.9);
      sp.position.set(x, (item.z ?? 2.2) + 0.45, z);
      scene.add(sp);
    } else if (kind === "presence") {
      const on = state?.state === "on";
      const disc = new THREE.Mesh(new THREE.CircleGeometry(on ? 0.45 : 0.2, 24), new THREE.MeshBasicMaterial({ color: on ? 0x22c55e : 0x9ca3af, transparent: true, opacity: on ? 0.5 : 0.35 }));
      disc.rotation.x = -Math.PI / 2;
      disc.position.set(x, 0.03, z);
      scene.add(disc);
    } else {
      const active = state?.state === "on" || state?.state === "open" || state?.state === "playing";
      const box = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.25, 12), new THREE.MeshStandardMaterial({ color: active ? 0x2563eb : 0x9ca3af }));
      box.position.set(x, 0.125, z);
      box.castShadow = true;
      scene.add(box);
      const raw = item.attribute ? state?.attributes[item.attribute] : state?.state;
      const unit = item.attribute ? "" : ((state?.attributes.unit_of_measurement as string | undefined) ?? "");
      const sp = textSprite(`${raw ?? "?"}${unit}`, "#374151", 0.7);
      sp.position.set(x, 0.55, z);
      scene.add(sp);
    }
  }
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
