// ============================================================
//  ลูกโลกจำลอง ORDEAL CALL — แกนกลางที่ทุกหน้าใช้ร่วมกัน (ไม่ผูกกับ React)
//  - พื้นผิว "โลกกระดาษขาว" สร้างจาก noise ครั้งเดียวต่อหน้าเว็บ (แคชไว้ใน module) แบ่งทำทีละช่วงไม่ให้จอค้าง
//  - createGlobe(canvas) = ฉาก three.js 1 ชุด: กล้อง + world(เลื่อน/ย่อตามหน้า) > tilt(ก้ม-เงย) > spin(หมุนรอบแกน)
//    หน้าจอแต่ละหน้าเอาของของตัวเองไปแปะใน core.world (ไม่หมุนตามโลก) หรือ core.spin (ติดผิวโลก)
//  - ทิศบนผิวโลกใช้ระบบเดียวกับ THREE.SphereGeometry (lon/lat → dirFromLonLat)
//  ใช้ทั้งในเกม (client) และหน้าแรกของโปรแกรม (desktop/launcher ผ่าน build แบบ iife)
// ============================================================
import * as THREE from "three";

export { THREE };

// ศูนย์กลาง 7 ภูมิภาคของการเดินทาง (ลำดับตรงกับ journey/areas.js) — ทวีปบนโลกจำลองงอกรอบจุดเหล่านี้
export const REGION_GEO = [
  { lon: 20, lat: 22 },
  { lon: 72, lat: 38 },
  { lon: 128, lat: -4 },
  { lon: 186, lat: 16 },
  { lon: 242, lat: -22 },
  { lon: 296, lat: 56 },
  { lon: 330, lat: -46 },
];

export const COLORS = {
  azure: 0x3d8bd9, sky: 0x7fb8e6, ice: 0xbee3f8, ink: 0x1c3f6e, echo: 0x9b4f96, echoGlow: 0xc99ad6, mute: 0x8ba3c2,
};

export function dirFromPhiTheta(phi, theta) {
  return new THREE.Vector3(-Math.cos(phi) * Math.sin(theta), Math.cos(theta), Math.sin(phi) * Math.sin(theta));
}
export function dirFromLonLat(lon, lat) {
  return dirFromPhiTheta((lon * Math.PI) / 180, ((90 - lat) * Math.PI) / 180);
}
export const regionDir = (i) => dirFromLonLat(REGION_GEO[i].lon, REGION_GEO[i].lat);

// ---------------- พื้นผิวโลก (สร้างครั้งเดียว) ----------------
const TW = 1600, TH = 800;
let earth = null;

function hash(x, y, z) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1103515245);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const L = (a, b, t) => a + (b - a) * t;
  return L(
    L(L(hash(xi, yi, zi), hash(xi + 1, yi, zi), u), L(hash(xi, yi + 1, zi), hash(xi + 1, yi + 1, zi), u), v),
    L(L(hash(xi, yi, zi + 1), hash(xi + 1, yi, zi + 1), u), L(hash(xi, yi + 1, zi + 1), hash(xi + 1, yi + 1, zi + 1), u), v),
    w,
  );
}
function fbm(x, y, z) {
  let a = 0.5, f = 1.7, s = 0, n = 0;
  for (let o = 0; o < 5; o++) { s += a * vnoise(x * f + 11, y * f + 23, z * f + 37); n += a; a *= 0.5; f *= 2.03; }
  return s / n;
}

function paintEarth(e) {
  const d = e.img.data, { land, reg, edge } = e;
  for (let y = 0; y < TH; y++) {
    const lat = 90 - ((y + 0.5) / TH) * 180;
    const latLine = Math.abs(lat - Math.round(lat / 15) * 15) < 0.16;
    const widen = Math.max(1, 1 / Math.max(0.15, Math.sin(((y + 0.5) / TH) * Math.PI)));
    for (let x = 0; x < TW; x++) {
      const k = y * TW + x, i = k * 4, h = land[k];
      const lon = ((x + 0.5) / TW) * 360;
      const lonLine = Math.abs(lon - Math.round(lon / 15) * 15) < 0.16 * widen;
      let R, G, B;
      if (h > 0) {
        R = 253; G = 254; B = 255;
        if (h > 0.03 && (h * 16) % 1 < 0.07) { R *= 0.93; G *= 0.93; B *= 0.93; } // เส้นชั้นความสูง
        if (edge[k]) { R = 180; G = 208; B = 236; }
      } else {
        R = 226; G = 237; B = 248;
        if (latLine || lonLine) { R = 196; G = 218; B = 240; }
        if (edge[k] && (x + y) % 6 < 3) { R = 204; G = 222; B = 241; }
      }
      if (Math.abs(h) < 0.012) { R = 111; G = 168; B = 221; } // ชายฝั่ง
      d[i] = R; d[i + 1] = G; d[i + 2] = B; d[i + 3] = 255;
    }
  }
  e.ctx.putImageData(e.img, 0, 0);
  e.textures.forEach((t) => { t.needsUpdate = true; });
}

/** พื้นผิวโลกที่แชร์กันทั้งหน้าเว็บ · ready = Promise ที่เสร็จเมื่อสร้างทวีปครบ · onProgress(0..1) */
export function getEarth(onProgress) {
  if (earth) {
    if (onProgress) { if (earth.done) onProgress(1); else earth.listeners.add(onProgress); }
    return earth;
  }
  const canvas = document.createElement("canvas");
  canvas.width = TW; canvas.height = TH;
  const ctx = canvas.getContext("2d");
  const e = earth = {
    canvas, ctx, img: ctx.createImageData(TW, TH), TW, TH,
    land: new Float32Array(TW * TH).fill(-1), reg: new Uint8Array(TW * TH), edge: new Uint8Array(TW * TH),
    textures: new Set(), listeners: new Set(onProgress ? [onProgress] : []), done: false, row: 0,
  };
  paintEarth(e); // มหาสมุทร + เส้นกริดไปก่อน ระหว่างรอทวีป
  const dirs = REGION_GEO.map((g) => dirFromLonLat(g.lon, g.lat));
  e.ready = new Promise((resolve) => {
    const step = () => {
      const end = Math.min(TH, e.row + 36);
      for (let y = e.row; y < end; y++) {
        const theta = ((y + 0.5) / TH) * Math.PI, st = Math.sin(theta), ct = Math.cos(theta);
        for (let x = 0; x < TW; x++) {
          const phi = ((x + 0.5) / TW) * Math.PI * 2, dx = -Math.cos(phi) * st, dy = ct, dz = Math.sin(phi) * st;
          let best = -2, bi = 0, bump = 0;
          for (let r = 0; r < dirs.length; r++) {
            const dd = dirs[r], dot = dx * dd.x + dy * dd.y + dz * dd.z;
            if (dot > best) { best = dot; bi = r; }
            bump += 0.3 * Math.exp(-(1 - dot) / 0.045);
          }
          const k = y * TW + x;
          e.reg[k] = bi; e.land[k] = fbm(dx, dy, dz) + bump - 0.6;
        }
      }
      e.row = end;
      e.listeners.forEach((fn) => fn(e.row / TH));
      if (e.row < TH) { setTimeout(step, 0); return; }
      for (let y = 1; y < TH - 1; y++) for (let x = 0; x < TW; x++) {
        const k = y * TW + x, r = e.reg[k];
        if (e.reg[y * TW + ((x + 1) % TW)] !== r || e.reg[k + TW] !== r) e.edge[k] = 1;
      }
      paintEarth(e);
      e.done = true;
      e.listeners.forEach((fn) => fn(1));
      e.listeners.clear();
      resolve(e);
    };
    setTimeout(step, 0);
  });
  return e;
}

// ---------------- ฉากลูกโลก ----------------
const REDUCED = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * สร้างฉากลูกโลกบน canvas
 * opts.layout {x,y,s} = ตำแหน่ง/ขนาดเริ่มต้นของโลก (หน่วยฉาก: จอสูง ~3.44 หน่วยที่ระยะกล้อง)
 * opts.drag = true → ลากหมุนโลกได้ (มีแรงเหวี่ยง) · false = ไม่ให้ลาก (หน้าอื่นจัดการ pointer เอง)
 * opts.sand = true → ละอองดาวลอยรอบโลก
 */
export function createGlobe(canvas, opts = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(0, 0, 6);

  // three r155+ คิดแสงแบบ physical + จัดการสี sRGB — ค่าชุดนี้จูนให้ได้ลุคเดียวกับต้นแบบ (มหาสมุทรฟ้าอ่อน ทวีปขาว)
  scene.add(new THREE.AmbientLight(0xffffff, 0.62 * Math.PI));
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8fb8e2, 0.2 * Math.PI));
  const sun = new THREE.DirectionalLight(0xffffff, 0.3 * Math.PI);
  sun.position.set(-3, 2.5, 4);
  scene.add(sun);

  const world = new THREE.Group();
  const tilt = new THREE.Group();
  const spin = new THREE.Group();
  world.add(tilt); tilt.add(spin); scene.add(world);

  const e = getEarth();
  const tex = new THREE.CanvasTexture(e.canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  e.textures.add(tex);
  const globe = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 96), new THREE.MeshLambertMaterial({ map: tex }));
  spin.add(globe);

  // กรงเส้นละติจูด/ลองจิจูดลอยเหนือผิว
  {
    const pts = [], R = 1.035;
    for (let lat = -60; lat <= 60; lat += 30) for (let lo = 0; lo < 360; lo += 4) pts.push(dirFromLonLat(lo, lat).multiplyScalar(R), dirFromLonLat(lo + 4, lat).multiplyScalar(R));
    for (let lo = 0; lo < 360; lo += 30) for (let la = -84; la < 84; la += 4) pts.push(dirFromLonLat(lo, la).multiplyScalar(R), dirFromLonLat(lo, la + 4).multiplyScalar(R));
    spin.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: COLORS.sky, transparent: true, opacity: 0.22 })));
  }

  // แสงชั้นบรรยากาศ
  const halo = new THREE.Mesh(new THREE.SphereGeometry(1.2, 64, 48), new THREE.ShaderMaterial({
    side: THREE.BackSide, transparent: true, depthWrite: false,
    uniforms: { c: { value: new THREE.Color(COLORS.sky) }, k: { value: 1 } },
    vertexShader: "varying vec3 vN; void main(){ vN=normalize(normalMatrix*normal); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }",
    fragmentShader: [
      "uniform vec3 c; uniform float k; varying vec3 vN;",
      "void main(){ float i=pow(max(0.,.72-dot(vN,vec3(0,0,1.))),2.4); gl_FragColor=vec4(c, i*1.1*k);",
      "#include <colorspace_fragment>",
      "}",
    ].join("\n"),
  }));
  tilt.add(halo);

  let sand = null;
  if (opts.sand !== false) {
    const N = 700, pos = new Float32Array(N * 3), v = new THREE.Vector3();
    for (let i = 0; i < N; i++) { v.randomDirection().multiplyScalar(1.35 + Math.random() * 2.6); pos.set([v.x, v.y, v.z], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    sand = new THREE.Points(g, new THREE.PointsMaterial({ color: COLORS.sky, size: 0.018, transparent: true, opacity: 0.65 }));
    scene.add(sand);
  }

  // ---------- สถานะการเคลื่อนไหว ----------
  const L0 = opts.layout || { x: 0, y: 0, s: 1 };
  const cur = { ...L0 }, target = { ...L0 };
  let yaw = 0, pitch = 0.12, targetYaw = null, targetPitch = 0.12, fling = 0;
  let autoSpin = REDUCED ? 0 : (opts.autoSpin ?? 0.1); // เรเดียน/วินาที
  let dragEnabled = opts.drag !== false;
  const frameFns = new Set(), clickFns = new Set(), hoverFns = new Set();
  let dragHandler = null; // (phase, info) => boolean — หน้าจอรับการลากเอง (คืน true = กินอีเวนต์นี้)
  let layoutRate = 0.02;  // ส่วนที่ "ยังเหลือ" หลังผ่านไป 1 วิ (น้อย = ไหลไวกว่า) — setLayout ส่งค่าอื่นได้

  // ---------- pointer ----------
  //  evEl = element ที่รับเมาส์ (ปกติคือ canvas) · โหมดลูกโลกร่วม (SharedGlobe) หน้าจอแต่ละหน้าส่ง div โปร่งใส
  //  ของตัวเองมาแทน (setEventTarget) เพราะ canvas จริงอยู่ชั้นล่างสุดใต้หน้าจอ
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let drag = null;
  let evEl = canvas;
  const setRay = (ev) => {
    const r = evEl.getBoundingClientRect();
    ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return ray;
  };
  const onDown = (ev) => {
    drag = { x: ev.clientX, y: ev.clientY, moved: 0, yaw, pitch, custom: false, vel: null, pt: 0, px: ev.clientX };
    if (dragHandler && dragHandler("down", { ev, ray: setRay(ev) })) drag.custom = true;
    evEl.setPointerCapture?.(ev.pointerId);
  };
  const onMove = (ev) => {
    if (!drag) { hoverFns.forEach((fn) => fn(ev, setRay(ev))); return; }
    const dx = ev.clientX - drag.x, dy = ev.clientY - drag.y;
    drag.moved = Math.max(drag.moved, Math.hypot(dx, dy));
    if (drag.moved <= 4) return;
    evEl.dataset.dragging = "1";
    if (drag.custom) { dragHandler("move", { ev, dx, dy }); return; }
    if (!dragEnabled) return;
    targetYaw = null;
    yaw = drag.yaw + dx * 0.006;
    targetPitch = pitch = Math.max(-0.7, Math.min(0.7, drag.pitch + dy * 0.004));
    const now = performance.now();
    if (drag.pt) { const v = (ev.clientX - drag.px) / Math.max(8, now - drag.pt); drag.vel = drag.vel == null ? v : drag.vel * 0.5 + v * 0.5; }
    drag.px = ev.clientX; drag.pt = now;
  };
  const onUp = (ev) => {
    const d = drag; drag = null; delete evEl.dataset.dragging;
    if (!d) return;
    const click = d.moved <= 4;
    if (d.custom) dragHandler("up", { ev, click });
    if (click) { clickFns.forEach((fn) => fn(ev, setRay(ev))); return; }
    if (!d.custom && dragEnabled && d.vel != null && performance.now() - d.pt < 80) fling = Math.max(-14, Math.min(14, d.vel * 6));
  };
  const onLeave = (ev) => { if (!drag) hoverFns.forEach((fn) => fn(null, null, ev)); };
  const listen = (el, on) => {
    const f = on ? "addEventListener" : "removeEventListener";
    el[f]("pointerdown", onDown); el[f]("pointermove", onMove); el[f]("pointerup", onUp);
    el[f]("pointercancel", onUp); el[f]("pointerleave", onLeave);
    if (on) el.style.touchAction = "none";
  };
  listen(evEl, true);

  // ---------- ขนาด ----------
  let W = 1, H = 1;
  const resize = () => {
    const r = canvas.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    renderer.setSize(W, H, false);
    camera.aspect = W / H; camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize); ro.observe(canvas); resize();

  // ---------- ลูป ----------
  let raf = 0, last = performance.now(), clock = 0, alive = true;
  const tmp = new THREE.Vector3();
  const frame = (now) => {
    if (!alive) return;
    // เฟรมแรก timestamp ของ rAF อาจเก่ากว่า performance.now() ตอนสร้าง → dt ติดลบ (clock ห้ามติดลบ)
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now; clock += dt;
    const k = REDUCED ? 1 : 1 - Math.pow(layoutRate, dt);
    cur.x += (target.x - cur.x) * k; cur.y += (target.y - cur.y) * k; cur.s += (target.s - cur.s) * k;
    world.position.set(cur.x, cur.y, 0); world.scale.setScalar(cur.s);
    if (!drag || drag.custom || !dragEnabled) {
      if (targetYaw != null) yaw += (targetYaw - yaw) * (REDUCED ? 1 : 1 - Math.pow(0.04, dt));
      else yaw += autoSpin * dt;
      pitch += (targetPitch - pitch) * (REDUCED ? 1 : 1 - Math.pow(0.04, dt));
      if (fling) { yaw += fling * dt; fling *= Math.pow(0.18, dt); if (Math.abs(fling) < 0.02) fling = 0; }
    }
    spin.rotation.y = yaw; tilt.rotation.x = pitch;
    if (sand) sand.rotation.y += dt * 0.01;
    scene.updateMatrixWorld();
    frameFns.forEach((fn) => fn(dt, clock));
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  const core = {
    THREE, renderer, scene, camera, world, tilt, spin, globe, halo, sand,
    /** element ที่รับเมาส์ (ใช้ตั้ง data-* ให้ cursor) — ปกติคือ canvas */
    get canvas() { return evEl; },
    get clock() { return clock; },
    /** เลื่อน/ย่อโลก (ค่อยๆ ไหลไป) · instant = กระโดดทันที · rate = ความไหล (ค่าเริ่มต้น 0.02 ≈ ถึงใน ~1 วิ, 0.15 ≈ ช้านุ่มๆ ~2 วิ) */
    setLayout(l, instant, rate = 0.02) { layoutRate = rate; Object.assign(target, l); if (instant || REDUCED) Object.assign(cur, target); },
    /** ย้ายตัวรับเมาส์ไปที่ element อื่น (null = กลับเป็น canvas) */
    setEventTarget(el) {
      const next = el || canvas;
      if (next === evEl) return;
      listen(evEl, false); drag = null; delete evEl.dataset.dragging;
      evEl = next; listen(evEl, true);
    },
    setAutoSpin(v) { autoSpin = REDUCED ? 0 : v; },
    setDrag(v) { dragEnabled = !!v; },
    setDragHandler(fn) { dragHandler = fn; },
    /** หมุนโลกให้ทิศ (ในระบบผิวโลก) หันเข้าหากล้อง · null = กลับไปหมุนเอง */
    focusDir(dir, maxPitch = 0.6) {
      if (!dir) { targetYaw = null; targetPitch = 0.12; return; }
      let t = -Math.atan2(dir.x, dir.z);
      while (t - yaw > Math.PI) t -= Math.PI * 2;
      while (t - yaw < -Math.PI) t += Math.PI * 2;
      targetYaw = t; targetPitch = Math.max(-maxPitch, Math.min(maxPitch, Math.asin(Math.max(-1, Math.min(1, dir.y)))));
    },
    onFrame(fn) { frameFns.add(fn); return () => frameFns.delete(fn); },
    onClick(fn) { clickFns.add(fn); return () => clickFns.delete(fn); },
    onHover(fn) { hoverFns.add(fn); return () => hoverFns.delete(fn); },
    raycaster: (ev) => setRay(ev),
    /** จุดบนผิวโลกใต้เมาส์ (ทิศในระบบผิวโลก) หรือ null */
    hitGlobe(ev) {
      const h = setRay(ev).intersectObject(globe)[0];
      return h ? spin.worldToLocal(h.point.clone()).normalize() : null;
    },
    /** วัตถุโดนเมาส์ที่ไม่ถูกโลกบังอยู่ */
    pick(ev, objects) {
      const r = setRay(ev), hits = r.intersectObjects(objects, false);
      if (!hits.length) return null;
      const g = r.intersectObject(globe)[0];
      return g && g.distance < hits[0].distance - 0.02 ? null : hits[0];
    },
    /** ตำแหน่งบนจอ (px ภายใน canvas) ของจุดในพิกัดโลก (world space) */
    project(v) {
      tmp.copy(v).project(camera);
      return { x: (tmp.x * 0.5 + 0.5) * W, y: (-tmp.y * 0.5 + 0.5) * H, z: tmp.z };
    },
    /** ทิศบนผิวโลกหันเข้ากล้องแค่ไหน (1 = ตรงหน้า, <0 = อยู่หลังโลก) */
    facing(dirLocal) {
      const n = dirLocal.clone().applyQuaternion(spin.getWorldQuaternion(new THREE.Quaternion()));
      const p = spin.localToWorld(dirLocal.clone());
      return n.dot(camera.position.clone().sub(p).normalize());
    },
    get size() { return { w: W, h: H }; },
    dispose() {
      alive = false; cancelAnimationFrame(raf); ro.disconnect();
      listen(evEl, false);
      e.textures.delete(tex); tex.dispose();
      scene.traverse((o) => { o.geometry?.dispose?.(); const m = o.material; if (m) (Array.isArray(m) ? m : [m]).forEach((x) => { if (x.map && x.map !== tex) x.map.dispose(); x.dispose(); }); });
      renderer.dispose();
    },
  };
  return core;
}
