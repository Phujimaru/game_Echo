// วงแหวนที่นั่ง 7 ดวงรอบลูกโลก (หน้าเลือกลำดับผู้เล่น) — ไม่หมุนเอง ผู้เล่นหมุนเอง:
//  ลากวงแหวน / ล้อเมาส์ / กดที่นั่ง (หมุนที่นั่งนั้นมาไว้หน้าสุด) · ปล่อยมือแล้ววงแหวนเข้าล็อกที่นั่งที่ใกล้ที่สุด
//  กดที่ว่าง (ไม่โดนที่นั่ง) = onEmpty() · วงแหวนโผล่หลังโลกถอยจากมุมซูม (ลูกโลกร่วมเริ่มแบบซูมเต็มจอ) จนขนาดใกล้ปกติ
//  ป้าย P# (DOM ของ React) ลอยตามดาวเทียมแต่ละดวง — ตัวควบคุมนี้แค่ตั้ง transform ให้ทุกเฟรม
import { THREE } from "../../globe/globeCore";

export const SEAT_N = 7;
const ORB_R = 1.62;
const ORB_Y = -0.24; // วงแหวนต่ำกว่าศูนย์กลางโลกเล็กน้อย (มุมเอียงเท่าเดิม)
const SHOW_SCALE = 1.7; // โลกยังใหญ่กว่านี้ (กำลังถอยจากมุมซูม) = ยังไม่โผล่วงแหวน/ป้าย
const STEP = (Math.PI * 2) / SEAT_N;
const REDUCED = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * @param core   ฉากจาก createGlobe
 * @param opts.onSeat(seat)  กดที่ดาวเทียม (หมุนมาหน้าสุดให้แล้ว — ตัดสินว่าจองได้ไหมที่หน้าจอ)
 * @param opts.onEmpty()  กดที่ว่าง (ไม่โดนที่นั่ง)
 */
export function createSeatRing(core, { onSeat, onEmpty }) {
  const { world, camera, canvas } = core;

  const orbit = new THREE.Group();
  orbit.rotation.set(1.18, 0, 0.22);
  orbit.position.y = ORB_Y;
  orbit.visible = false;
  world.add(orbit);
  const fadeMats = [];
  const addFade = (m) => { m.userData.o = m.opacity; fadeMats.push(m); return m; };
  orbit.add(new THREE.Mesh(new THREE.TorusGeometry(ORB_R, 0.0035, 6, 200), addFade(new THREE.MeshBasicMaterial({ color: 0x7fb8e6, transparent: true, opacity: 0.7 }))));
  orbit.add(new THREE.Mesh(new THREE.TorusGeometry(ORB_R + 0.09, 0.0015, 6, 200), addFade(new THREE.MeshBasicMaterial({ color: 0xbee3f8, transparent: true, opacity: 0.8 }))));
  const holder = new THREE.Group();
  orbit.add(holder);

  // FRONT = มุมบนวงแหวนที่ใกล้กล้องที่สุด · sign = ทิศที่ลากเมาส์ไปขวาแล้วดาวเทียมด้านหน้าเลื่อนไปขวาด้วย
  let FRONT = 0, sign = 1;
  {
    const m = new THREE.Matrix4().makeRotationFromEuler(orbit.rotation);
    let best = -9;
    for (let i = 0; i < 720; i++) {
      const a = (i / 720) * Math.PI * 2;
      const z = new THREE.Vector3(Math.cos(a), Math.sin(a), 0).applyMatrix4(m).z;
      if (z > best) { best = z; FRONT = a; }
    }
    const p = new THREE.Vector3(Math.cos(FRONT + 0.02), Math.sin(FRONT + 0.02), 0).applyMatrix4(m);
    const q = new THREE.Vector3(Math.cos(FRONT), Math.sin(FRONT), 0).applyMatrix4(m);
    sign = p.x > q.x ? 1 : -1;
  }
  let rot = FRONT, target = FRONT, dragging = false, dragFrom = 0;
  const near = (t) => {
    while (t - rot > Math.PI) t -= Math.PI * 2;
    while (t - rot < -Math.PI) t += Math.PI * 2;
    return t;
  };
  const toFront = (seat, instant) => {
    target = near(FRONT - (seat - 1) * STEP);
    if (instant || REDUCED) rot = target;
  };
  const snap = () => { const i = Math.round((FRONT - rot) / STEP); target = near(FRONT - i * STEP); };
  const turn = (dir) => { target += dir * sign * STEP; };

  const sats = [];
  for (let i = 0; i < SEAT_N; i++) {
    const g = new THREE.Group();
    const a = (i / SEAT_N) * Math.PI * 2;
    g.position.set(Math.cos(a) * ORB_R, Math.sin(a) * ORB_R, 0);
    const body = new THREE.Mesh(new THREE.OctahedronGeometry(0.06), new THREE.MeshLambertMaterial({ color: 0xffffff }));
    const frame = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.004, 6, 40), new THREE.MeshBasicMaterial({ color: 0x3d8bd9 }));
    const hit = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    hit.userData.seat = i + 1;
    g.add(body, frame, hit);
    holder.add(g);
    sats.push({ g, body, frame, hit });
  }
  const hits = sats.map((s) => s.hit);
  const seatAt = (ev) => core.pick(ev, hits)?.object.userData.seat || 0;

  // สถานะที่หน้าจอส่งมา (ที่นั่งของเรา / ที่ถูกจอง / สีของเรา)
  let st = { pos: null, taken: [], color: "#9B4F96" };
  const paint = () => {
    sats.forEach((s, i) => {
      const seat = i + 1, mine = st.pos === seat, other = !mine && st.taken.includes(seat);
      s.body.material.color.set(mine ? st.color : other ? 0x8ba3c2 : 0xffffff);
      s.frame.material.color.set(mine ? 0x9b4f96 : other ? 0x8ba3c2 : 0x3d8bd9);
      s.frame.scale.setScalar(mine ? 1.35 : 1);
    });
  };
  paint();

  // ---------- pointer ----------
  core.setDrag(false);
  core.setDragHandler((phase, info) => {
    if (phase === "down") { dragging = true; dragFrom = rot; return true; }
    if (phase === "move") { rot = target = dragFrom + info.dx * 0.006 * sign; return true; }
    if (phase === "up") { dragging = false; if (!info.click) snap(); }
    return true;
  });
  const offClick = core.onClick((ev) => {
    const s = seatAt(ev);
    if (s) { toFront(s); onSeat?.(s); return; }
    if (orbit.visible) onEmpty?.();
  });
  const offHover = core.onHover((ev) => {
    const s = ev ? seatAt(ev) : 0;
    if (s && !(st.taken.includes(s) && st.pos !== s)) canvas.dataset.pointing = "1";
    else delete canvas.dataset.pointing;
  });
  let wheelAt = 0;
  const onWheel = (ev) => {
    ev.preventDefault();
    const now = performance.now();
    if (now - wheelAt < 140 || !ev.deltaY) return;
    wheelAt = now;
    turn(Math.sign(ev.deltaY));
  };
  canvas.addEventListener("wheel", onWheel, { passive: false });

  // ---------- ป้าย ----------
  let tags = [];
  let intro = REDUCED ? 1 : 0;
  let t0 = 0; // เริ่มนับฉากโผล่เมื่อโลกถอยจนเล็กพอ
  const wp = new THREE.Vector3();
  const offFrame = core.onFrame((dt) => {
    const sc = world.scale.x;
    if (!t0) {
      if (sc > SHOW_SCALE && !REDUCED) { tags.forEach((el) => { if (el) el.dataset.back = "1"; }); return; }
      t0 = performance.now();
      orbit.visible = true;
    }
    if (intro < 1) {
      intro = Math.min(1, (performance.now() - t0) / 900);
      const e = 1 - Math.pow(1 - intro, 3);
      orbit.scale.setScalar(0.6 + 0.4 * e);
      fadeMats.forEach((m) => { m.opacity = m.userData.o * e; });
    }
    if (!dragging) rot += (target - rot) * (REDUCED ? 1 : 1 - Math.pow(0.01, dt));
    holder.rotation.z = rot;
    sats.forEach((s) => { s.body.rotation.y += dt * 0.8; s.frame.lookAt(camera.position); });
    orbit.updateMatrixWorld(true);
    sats.forEach((s, i) => {
      const el = tags[i];
      if (!el) return;
      s.g.getWorldPosition(wp);
      const p = core.project(wp);
      el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -140%)`;
      el.dataset.placed = "1";
      if (wp.z < -0.35 * sc || intro < 0.5) el.dataset.back = "1";
      else delete el.dataset.back;
    });
  });

  return {
    setState(next) { st = { ...st, ...next }; paint(); },
    setTags(els) { tags = els; },
    toFront,
    turn,
    dispose() {
      offClick(); offHover(); offFrame();
      core.setDragHandler(null);
      canvas.removeEventListener("wheel", onWheel);
      delete canvas.dataset.pointing;
    },
  };
}
