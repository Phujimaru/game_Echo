// ============================================================
//  Moon Cell: ปลายฉากเปิดแมตช์ (MatchIntro โหมด moon) — บนลูกโลกร่วมใบเดิม
//  กล้องโค้งอ้อมไปด้านข้าง/หลังลูกโลก → เห็นดวงจันทร์ (Moon Cell) ที่ซ่อนอยู่หลังโลก → ซูมเข้าหาดวงจันทร์ → แฟลชขาว (DOM)
//  ของ 3D ที่เพิ่มใน core.scene ถูก scopeCore เก็บกวาดเอง · restore() คืนกล้องเมื่อฉากถูกยกเลิกกลางคัน
//  u = เวลา/ D (0..1) · D = MOON_MS
// ============================================================
import { REDUCED, clamp01, easeInOutCubic, span } from "./diveKit";

export const MOON_MS = 5600;

/** ผิวดวงจันทร์: ขาวอมฟ้า + หลุมอุกกาบาต + ตารางข้อมูล (สไตล์ ORDEAL CALL) */
function moonTexture(THREE) {
  const cv = document.createElement("canvas");
  cv.width = 1024; cv.height = 512;
  const g = cv.getContext("2d");
  const grd = g.createLinearGradient(0, 0, 0, 512);
  grd.addColorStop(0, "#f4f8fc"); grd.addColorStop(0.5, "#e2eaf3"); grd.addColorStop(1, "#d3deeb");
  g.fillStyle = grd; g.fillRect(0, 0, 1024, 512);
  let s = 7;
  const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  // ทะเลจันทร์ (แผ่นเข้ม) + หลุม
  for (let i = 0; i < 14; i++) {
    const x = r() * 1024, y = 90 + r() * 330, rr = 40 + r() * 110;
    const m = g.createRadialGradient(x, y, 0, x, y, rr);
    m.addColorStop(0, "rgba(139,163,194,.38)"); m.addColorStop(1, "rgba(139,163,194,0)");
    g.fillStyle = m; g.beginPath(); g.ellipse(x, y, rr, rr * 0.7, 0, 0, Math.PI * 2); g.fill();
  }
  for (let i = 0; i < 160; i++) {
    const x = r() * 1024, y = r() * 512, rr = 2 + Math.pow(r(), 3) * 26;
    g.fillStyle = "rgba(110,135,170,.28)"; g.beginPath(); g.arc(x, y, rr, 0, Math.PI * 2); g.fill();
    g.strokeStyle = "rgba(255,255,255,.7)"; g.lineWidth = Math.max(1, rr * 0.18);
    g.beginPath(); g.arc(x - rr * 0.15, y - rr * 0.15, rr, Math.PI * 0.9, Math.PI * 1.7); g.stroke();
  }
  // ตารางข้อมูล
  g.strokeStyle = "rgba(61,139,217,.35)"; g.lineWidth = 1.5;
  for (let x = 0; x <= 1024; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 512); g.stroke(); }
  for (let y = 0; y <= 512; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(1024, y); g.stroke(); }
  // แผงหกเหลี่ยมเรืองแสงประปราย (เมืองข้อมูลบนดวงจันทร์)
  for (let i = 0; i < 40; i++) {
    const x = r() * 1024, y = 60 + r() * 390, rr = 4 + r() * 8;
    g.fillStyle = i % 4 ? "rgba(61,139,217,.55)" : "rgba(155,79,150,.6)";
    g.beginPath(); for (let k = 0; k < 6; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 3; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath(); g.fill();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function glowTexture(THREE, inner, outer) {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 256;
  const g = cv.getContext("2d");
  const m = g.createRadialGradient(128, 128, 30, 128, 128, 128);
  m.addColorStop(0, inner); m.addColorStop(0.45, outer); m.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = m; g.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createMoonFlight(core, { lowQ = false } = {}) {
  const { THREE, camera, scene } = core;
  const MOON_R = 1;
  // ดวงจันทร์อยู่หลังโลก (มองจากกล้องตั้งต้น z+ จะถูกโลกบังเกือบทั้งดวง)
  const E = core.world.position.clone();
  const M = E.clone().add(new THREE.Vector3(0.75, 0.42, -11));

  const moon = new THREE.Group();
  moon.position.copy(M);
  const body = new THREE.Mesh(new THREE.SphereGeometry(MOON_R, 96, 64), new THREE.MeshLambertMaterial({ map: moonTexture(THREE) }));
  moon.add(body);
  {
    const pts = [], R = MOON_R * 1.03;
    const dir = (lo, la) => { const a = (lo * Math.PI) / 180, b = (la * Math.PI) / 180; return new THREE.Vector3(Math.cos(b) * Math.sin(a) * R, Math.sin(b) * R, Math.cos(b) * Math.cos(a) * R); };
    for (let la = -60; la <= 60; la += 30) for (let lo = 0; lo < 360; lo += 5) pts.push(dir(lo, la), dir(lo + 5, la));
    for (let lo = 0; lo < 360; lo += 30) for (let la = -84; la < 84; la += 5) pts.push(dir(lo, la), dir(lo, la + 5));
    moon.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x3d8bd9, transparent: true, opacity: 0.35 })));
  }
  // วงแหวนข้อมูลรอบดวงจันทร์
  const ringMat = new THREE.LineDashedMaterial({ color: 0x9b4f96, transparent: true, opacity: 0.7, dashSize: 0.12, gapSize: 0.08 });
  {
    const pts = [];
    for (let i = 0; i <= 128; i++) { const a = (i / 128) * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * 1.65, 0, Math.sin(a) * 1.65)); }
    const ring = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), ringMat);
    ring.computeLineDistances();
    ring.rotation.set(0.35, 0, -0.25);
    moon.add(ring);
  }
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(THREE, "rgba(230,244,255,.95)", "rgba(190,227,248,.45)"), transparent: true, depthWrite: false }));
  glow.scale.setScalar(MOON_R * 4.4);
  moon.add(glow);
  scene.add(moon);

  const near0 = camera.near;
  camera.near = 0.01;
  camera.updateProjectionMatrix();
  const sandMat = core.sand?.material;
  const sand0 = sandMat ? sandMat.opacity : 0;
  const cam = new THREE.Vector3(), look = new THREE.Vector3(), side = new THREE.Vector3(), end = new THREE.Vector3();
  let lastFov = camera.fov;

  return {
    /** u = ความคืบหน้าของฉาก 0..1 */
    frame(u, dt = 0.016) {
      moon.rotation.y += dt * 0.12;
      ringMat.dashOffset = (ringMat.dashOffset || 0) - dt * 0.4;
      if (REDUCED) { camera.position.copy(M).add(new THREE.Vector3(0, 0, 3.2)); camera.lookAt(M); return; }
      // 1) โค้งอ้อมโลก: มุมรอบแกน Y 0 -> 112° ยกกล้องขึ้นนิดหน่อย
      const k = easeInOutCubic(span(u, 0.02, 0.56));
      const a = 1.95 * k, R = 6 + 0.6 * k;
      side.set(E.x + R * Math.sin(a), E.y + 0.95 * Math.sin(k * Math.PI * 0.5), E.z + R * Math.cos(a));
      // มุมมอง: จากโลก -> ดวงจันทร์
      look.copy(E).lerp(M, easeInOutCubic(span(u, 0.24, 0.56)));
      // 2) ซูมเข้าหาดวงจันทร์ (เร่งขึ้นเรื่อย ๆ) จนเกือบแตะผิว
      const z = Math.pow(span(u, 0.56, 0.97), 2.4);
      end.copy(side).sub(M).normalize().multiplyScalar(MOON_R * 1.08).add(M);
      cam.copy(side).lerp(end, z);
      if (!lowQ && z > 0.75) { const sh = ((z - 0.75) / 0.25) * 0.01; cam.x += (Math.random() - 0.5) * sh; cam.y += (Math.random() - 0.5) * sh; }
      camera.position.copy(cam);
      camera.lookAt(look);
      const fov = 32 + 34 * Math.pow(span(u, 0.7, 0.98), 3);
      if (Math.abs(fov - lastFov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); lastFov = fov; }
      if (sandMat) sandMat.opacity = sand0 * (1 - clamp01((u - 0.5) * 3));
    },
    restore() {
      camera.near = near0;
      camera.fov = 32;
      camera.position.set(0, 0, 6);
      camera.rotation.set(0, 0, 0);
      camera.updateProjectionMatrix();
      if (sandMat) sandMat.opacity = sand0;
      // ดวงจันทร์ใน core.scene: scopeCore (ลูกโลกร่วม) / dispose (ลูกโลกของตัวเอง) เก็บกวาดให้
    },
  };
}
