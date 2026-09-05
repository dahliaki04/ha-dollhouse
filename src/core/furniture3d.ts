import * as THREE from "three";
import { shade, type Furniture } from "../domain/furniture";

/**
 * Low-poly furniture built from boxes. Local space: x = width, y = up, z = depth,
 * origin on the floor at the footprint centre. Returned group is positioned/rotated by the caller.
 */
export function buildFurniture(f: Furniture): THREE.Group {
  const g = new THREE.Group();
  const mat = (hex: string) => new THREE.MeshStandardMaterial({ color: hex, roughness: 0.85 });
  const base = mat(f.color);
  const dark = mat(shade(f.color, 0.8));
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material = base) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    g.add(mesh);
    return mesh;
  };
  const { w: W, d: D, h: H } = f;
  const legs = (topY: number, inset = 0.05, t = 0.05) => {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(t, topY, t, sx * (W / 2 - inset - t / 2), topY / 2, sz * (D / 2 - inset - t / 2), dark);
  };

  switch (f.type) {
    case "sofa":
    case "armchair": {
      const seatH = Math.min(0.45, H * 0.55);
      const arm = Math.min(0.18, W * 0.15);
      const back = Math.min(0.22, D * 0.3);
      box(W, seatH, D, 0, seatH / 2, 0);
      box(W, H - seatH, back, 0, seatH + (H - seatH) / 2, -D / 2 + back / 2, dark);
      box(arm, H * 0.8 - seatH, D, -W / 2 + arm / 2, seatH + (H * 0.8 - seatH) / 2, 0, dark);
      box(arm, H * 0.8 - seatH, D, W / 2 - arm / 2, seatH + (H * 0.8 - seatH) / 2, 0, dark);
      break;
    }
    case "bed": {
      const frameH = Math.min(0.3, H * 0.6);
      box(W, frameH, D, 0, frameH / 2, 0, dark);
      box(W - 0.06, H - frameH, D - 0.06, 0, frameH + (H - frameH) / 2, 0);
      box(W, Math.max(H + 0.4, 0.9), 0.08, 0, Math.max(H + 0.4, 0.9) / 2, -D / 2 + 0.04, dark);
      const pw = Math.min(0.6, W * 0.42);
      const pillow = mat("#ffffff");
      box(pw, 0.12, 0.35, -W / 2 + 0.08 + pw / 2, H + 0.06, -D / 2 + 0.12 + 0.175, pillow);
      if (W > 1.2) box(pw, 0.12, 0.35, W / 2 - 0.08 - pw / 2, H + 0.06, -D / 2 + 0.12 + 0.175, pillow);
      break;
    }
    case "table":
    case "desk":
    case "coffee": {
      box(W, 0.05, D, 0, H - 0.025, 0);
      legs(H - 0.05);
      break;
    }
    case "chair": {
      const seatH = Math.min(0.45, H * 0.5);
      box(W, 0.05, D, 0, seatH, 0);
      legs(seatH - 0.025, 0.03, 0.03);
      box(W, H - seatH, 0.05, 0, seatH + (H - seatH) / 2, -D / 2 + 0.025, dark);
      break;
    }
    case "wardrobe":
    case "cabinet":
    case "fridge":
    case "counter": {
      box(W, H, D, 0, H / 2, 0);
      // door seam / handles on the front face (+z)
      const seam = mat(shade(f.color, 0.6));
      if (f.type === "fridge") box(0.02, H * 0.5, 0.02, W * 0.3, H * 0.6, D / 2 + 0.01, seam);
      else if (f.type === "wardrobe" || f.type === "cabinet") box(0.01, H * 0.9, 0.01, 0, H / 2, D / 2 + 0.005, seam);
      else box(W * 0.9, 0.02, D * 0.9, 0, H + 0.01, 0, mat("#d6d3d1"));
      break;
    }
    case "tv": {
      box(W, H, D, 0, H / 2, 0);
      const screenW = Math.min(W * 0.8, 1.4);
      const screenH = screenW * 0.56;
      box(screenW, screenH, 0.03, 0, H + 0.1 + screenH / 2, 0, mat("#111827"));
      box(0.3, 0.1, 0.15, 0, H + 0.05, 0, dark);
      break;
    }
    case "toilet": {
      box(W, H, 0.2, 0, H / 2, -D / 2 + 0.1);
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(W / 2, W / 2 * 0.8, 0.4, 16), base);
      bowl.scale.z = (D - 0.25) / W;
      bowl.position.set(0, 0.2, 0.1);
      bowl.castShadow = true;
      g.add(bowl);
      break;
    }
    case "bathtub": {
      box(W, H, D, 0, H / 2, 0);
      box(W - 0.16, 0.02, D - 0.16, 0, H - 0.1, 0, mat("#bae6fd"));
      break;
    }
    case "sink": {
      box(W, H, D, 0, H / 2, 0);
      const basin = new THREE.Mesh(new THREE.CylinderGeometry(W * 0.32, W * 0.25, 0.12, 16), mat("#bae6fd"));
      basin.position.set(0, H + 0.02, 0);
      g.add(basin);
      break;
    }
    case "plant": {
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(W * 0.35, W * 0.28, H * 0.3, 12), mat("#a8a29e"));
      pot.position.set(0, H * 0.15, 0);
      pot.castShadow = true;
      g.add(pot);
      const leaves = new THREE.Mesh(new THREE.SphereGeometry(W * 0.55, 10, 8), base);
      leaves.position.set(0, H * 0.3 + W * 0.45, 0);
      leaves.castShadow = true;
      g.add(leaves);
      break;
    }
    case "rug": {
      const rug = box(W, 0.01, D, 0, 0.012, 0);
      rug.castShadow = false;
      break;
    }
  }
  return g;
}
