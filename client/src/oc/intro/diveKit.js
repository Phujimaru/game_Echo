// ============================================================
//  ชุดเครื่องมือฉากลูกโลก (ฉากเปิดแมตช์ + ฉากเปลี่ยนภูมิภาค) — ไม่ผูกกับ React
//  - หมุนโลกด้วย core.world.rotation (yaw/pitch) — แกนกลางของ globeCore ไม่ต้องรู้เรื่องนี้
//    (spin/tilt ของ core อยู่นิ่ง: ฉากเหล่านี้ตั้ง autoSpin 0 ตอนเริ่มคุมทิศเอง)
//  - กล้องดิ่งลงผิวโลก (ลุคเดิมของ GlobeDive) + วงสำรวจปักบนผิวโลก + เส้นทางโค้งตามผิวโลก
// ============================================================
import { COLORS } from "../../globe/globeCore";

export const REDUCED = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export const clamp01 = (v) => Math.max(0, Math.min(1, v));
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
export const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const lerp = (a, b, t) => a + (b - a) * t;
/** ความคืบหน้า 0..1 ของช่วง [a, b] */
export const span = (u, a, b) => clamp01((u - a) / Math.max(1e-6, b - a));

/** ทิศ (ระบบผิวโลก) → มุม yaw/pitch ของ world ที่ทำให้จุดนั้นหันตรงกล้อง (ใช้ spin/tilt ปัจจุบันของ core) */
export function aimAngles(core, dirLocal) {
  const v = dirLocal.clone().applyQuaternion(core.spin.quaternion).applyQuaternion(core.tilt.quaternion);
  return { yaw: -Math.atan2(v.x, v.z), pitch: Math.asin(Math.max(-1, Math.min(1, v.y))) };
}
export function setAim(core, yaw, pitch) {
  core.world.rotation.set(pitch, yaw, 0);
  core.world.updateMatrixWorld(true);
}
/** yaw b ที่ใกล้ a ที่สุด (ไม่หมุนเกินครึ่งรอบ) */
export function nearYaw(a, b) {
  let t = b;
  while (t - a > Math.PI) t -= Math.PI * 2;
  while (t - a < -Math.PI) t += Math.PI * 2;
  return t;
}

// เส้นวงกลมบนระนาบ XY
function circlePts(THREE, r, seg = 96) {
  const pts = [];
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0));
  }
  return pts;
}

/**
 * วงสำรวจปักบนผิวโลก (ลุคเดิมของ GlobeDive) — วางใน parent (ปกติ core.spin) ที่ทิศ dir
 *  update(lk) = ระดับการกางวง 0..1 · now (ms) ใช้ทำวงชีพจร
 */
export function createMarker(core, dir, parent = core.spin, colors = {}) {
  const { THREE } = core;
  const c1 = colors.inner ?? COLORS.echo, c2 = colors.mid ?? COLORS.azure, c3 = colors.outer ?? COLORS.sky;
  const marker = new THREE.Group();
  marker.position.copy(dir).multiplyScalar(1.004);
  marker.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
  const mats = [];
  const addRing = (r, color, opacity, dashed) => {
    const g = new THREE.BufferGeometry().setFromPoints(circlePts(THREE, r));
    const m = dashed
      ? new THREE.LineDashedMaterial({ color, transparent: true, opacity: 0, dashSize: r * 0.12, gapSize: r * 0.08, depthWrite: false })
      : new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false });
    const line = new THREE.LineLoop(g, m);
    if (dashed) line.computeLineDistances();
    m.userData.max = opacity;
    mats.push(m);
    marker.add(line);
    return line;
  };
  addRing(0.03, c1, 1);
  const pulse = addRing(0.06, c1, 0.8);
  addRing(0.1, c2, 0.9);
  addRing(0.16, c2, 0.7, true);
  addRing(0.26, c3, 0.5);
  {
    const pts = [];
    for (let k = 0; k < 4; k++) {
      const ang = (k / 4) * Math.PI * 2, c = Math.cos(ang), s = Math.sin(ang);
      pts.push(new THREE.Vector3(c * 0.11, s * 0.11, 0), new THREE.Vector3(c * 0.2, s * 0.2, 0));
    }
    const m = new THREE.LineBasicMaterial({ color: c2, transparent: true, opacity: 0, depthWrite: false });
    m.userData.max = 0.9;
    mats.push(m);
    marker.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), m));
  }
  marker.scale.setScalar(0.001);
  parent.add(marker);
  return {
    group: marker,
    update(lk, now, size = 1) {
      marker.scale.setScalar(Math.max(0.001, size * (0.35 + 0.65 * easeOutCubic(lk))));
      mats.forEach((m) => { m.opacity = m.userData.max * lk; });
      const pz = (now / 900) % 1;
      pulse.scale.setScalar(1 + pz * 2.4);
      pulse.material.opacity = lk * 0.8 * (1 - pz);
    },
  };
}

/**
 * กล้องดิ่ง/ถอยจากผิวโลก — ลุคเดิมของ GlobeDive
 *  frame(P, e, d) : e = 0 (กล้องที่ระยะปกติ) .. 1 (แตะผิวที่จุด P ในพิกัดโลก) · d = ความคืบหน้าดิบ (ใช้ทำ fov/สั่น/พร่า)
 *  wrapEl = กรอบ DOM ของ canvas (ใส่ scale/blur ตอนใกล้ชน)
 */
export function createDiveCamera(core, { lowQ = false, wrapEl = null } = {}) {
  const { THREE, camera } = core;
  const C0 = new THREE.Vector3(0, 0, 6);
  const cam = new THREE.Vector3(), look = new THREE.Vector3(), origin = new THREE.Vector3();
  const sandMat = core.sand?.material;
  const sand0 = sandMat ? sandMat.opacity : 0;
  let lastFov = camera.fov;
  camera.near = 0.004;
  camera.updateProjectionMatrix();
  const setFov = (fov) => {
    if (Math.abs(fov - lastFov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); lastFov = fov; }
  };
  return {
    // opts.scaleWrap = false: พร่าอย่างเดียวไม่ขยาย (ขยายกรอบตอน canvas เพิ่งสร้าง = ResizeObserver วัดขนาดผิด)
    frame(P, e, d, { blurFrom = 0.8, scaleWrap = true, shake = true } = {}) {
      cam.copy(C0).lerp(look.copy(P).multiplyScalar(1.1), e);
      if (shake && !lowQ && !REDUCED && d > 0.72) {
        const sh = ((d - 0.72) / 0.28) * 0.012;
        cam.x += (Math.random() - 0.5) * sh;
        cam.y += (Math.random() - 0.5) * sh;
      }
      camera.position.copy(cam);
      camera.lookAt(look.copy(origin).lerp(P, clamp01(e * 1.8)));
      setFov(32 + 40 * Math.pow(d, 3));
      if (sandMat) sandMat.opacity = sand0 * (1 - clamp01(d * 1.6));
      if (core.halo?.material?.uniforms?.k) core.halo.material.uniforms.k.value = 1 - clamp01(d * 1.3);
      const wrap = typeof wrapEl === "function" ? wrapEl() : wrapEl;
      if (wrap && !REDUCED) {
        const z = clamp01((d - blurFrom) / (1 - blurFrom));
        wrap.style.transform = z > 0 && scaleWrap ? `scale(${(1 + z * 0.7).toFixed(3)})` : "";
        if (!lowQ) wrap.style.filter = z > 0 ? `blur(${(z * 5).toFixed(2)}px) brightness(${(1 + z * 0.35).toFixed(3)})` : "";
      }
    },
  };
}

/** จุดบนเส้นวงกลมใหญ่ระหว่างทิศ a กับ b (หน่วยเวกเตอร์) ที่สัดส่วน t */
export function slerpDir(THREE, a, b, t, out = new THREE.Vector3()) {
  const dot = Math.max(-1, Math.min(1, a.dot(b)));
  const om = Math.acos(dot);
  if (om < 1e-4) return out.copy(a);
  const s = Math.sin(om);
  return out.copy(a).multiplyScalar(Math.sin((1 - t) * om) / s).addScaledVector(b, Math.sin(t * om) / s).normalize();
}

/** พื้นผิววงกลมเรืองแสง (ไล่จากกลางจาง) สำหรับ Sprite */
let glowTex = null;
export function glowTexture(THREE) {
  if (glowTex) return glowTex;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(0.25, "rgba(255,255,255,0.85)");
  grd.addColorStop(0.6, "rgba(255,255,255,0.25)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(c);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
}
