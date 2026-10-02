// ============================================================
//  Purge — ปลายฉากเปิดตัว: เส้นพุ่งออกจากโลก → กล้องหันตามทิศเส้น → พุ่งเข้าทางช้างเผือก (three.js ล้วน ไม่ใช้ภาพ)
//  เวลาเทียบสัดส่วน u = t / D (D = WARP_MS) — ช่วง 0-0.24 เป็น CSS ซูมเข้าเส้นบนลูกโลก (intro.css) แคนวาสนี้จางเข้าที่ 0.18-0.3
//   0.18-0.46 หัน: มองเส้นจากด้านข้าง (เฉียงขึ้นขวาเท่าเส้นบนลูกโลก) แล้วหมุนไปมองตามเส้น ฟ้าจางจากสีสว่างเป็นอวกาศ
//   0.46-1.00 พุ่ง: เร่งตามเส้น ดาวยืดเป็นเส้น ดาราจักรกังหันขยายเต็มจอ แล้วแฟลชเข้าแกนกลาง (ส่งต่อฉากท่อ)
// ============================================================
import * as THREE from "three";

const T = THREE;
export const WARP_MS = 4600;

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function makeRnd(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; }; }

const POINT_VS = `
attribute float size;
attribute vec3 tint;
uniform float uScale;
uniform float uTime;
uniform float uTwinkle;
varying vec3 vColor;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float tw = 1.0 - uTwinkle + uTwinkle * (0.6 + 0.4 * sin(uTime * 2.7 + position.x * 0.31 + position.z * 0.17));
  gl_PointSize = clamp(size * uScale / max(1.0, -mv.z), 0.6, 90.0);
  vColor = tint * tw;
}`;
const POINT_FS = `
uniform float uOpacity;
varying vec3 vColor;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = dot(c, c) * 4.0;
  float a = exp(-d * 3.6) * uOpacity;
  gl_FragColor = vec4(vColor * a, a);
}`;
// ฝุ่นในแขนกังหัน (บังแสงดาว) — วาดหลังดาว แบบปกติ
const DUST_FS = `
uniform float uOpacity;
varying vec3 vColor;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = dot(c, c) * 4.0;
  float a = exp(-d * 2.4) * uOpacity;
  gl_FragColor = vec4(vColor, a);
}`;
// ดาวยืดเป็นเส้นตามความเร็ว (หัวที่ position · หางยืดไปทาง +z ตาม uStretch)
const STREAK_VS = `
attribute float tail;
uniform float uStretch;
varying float vT;
void main() {
  vec3 p = position;
  p.z += tail * uStretch;
  vT = tail;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;
const STREAK_FS = `
uniform float uOpacity;
varying float vT;
void main() { gl_FragColor = vec4(vec3(0.75, 0.86, 1.0) * (1.0 - vT) * uOpacity, 1.0); }`;

function glowTex(stops) {
  const c = document.createElement("canvas"); c.width = c.height = 256;
  const g = c.getContext("2d");
  const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  for (const [o, col] of stops) gr.addColorStop(o, col);
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
}

export function createWarpScene(canvas, { D = WARP_MS, lowQ = false } = {}) {
  const rnd = makeRnd(20261002);
  const gauss = () => { let u = 0; for (let k = 0; k < 4; k++) u += rnd(); return (u - 2) * 1.2; };
  const disposables = [];
  const keep = (x) => { disposables.push(x); return x; };

  const renderer = new T.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowQ ? 1 : 1.5));
  renderer.outputColorSpace = T.SRGBColorSpace;
  const scene = new T.Scene();
  const bgLight = new T.Color("#eef5ff"), bgMid = new T.Color("#3b5aa8"), bgDark = new T.Color("#02030b");
  scene.background = bgLight.clone();
  const camera = new T.PerspectiveCamera(55, 16 / 9, 0.5, 30000);

  const G = new T.Vector3(0, 0, -5200);        // ใจกลางดาราจักร (เส้นพุ่งตรงไปที่นี่)
  const RG = 1500;                             // รัศมีดาราจักร
  const pointUniforms = [];
  // mul = ตัวคูณขนาดจุด (หน่วยโลก) ของแต่ละชุด
  function pointsMat({ fs = POINT_FS, blending = T.AdditiveBlending, twinkle = 0.25, mul = 1 } = {}) {
    const u = { uScale: { value: 600 }, uTime: { value: 0 }, uOpacity: { value: 1 }, uTwinkle: { value: twinkle }, mul };
    pointUniforms.push(u);
    return keep(new T.ShaderMaterial({ uniforms: u, vertexShader: POINT_VS, fragmentShader: fs, transparent: true, depthWrite: false, blending }));
  }
  function cloud(list, mat) {
    const n = list.length;
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), size = new Float32Array(n);
    list.forEach((s, i) => { pos.set(s.p, i * 3); col.set(s.c, i * 3); size[i] = s.s; });
    const g = keep(new T.BufferGeometry());
    g.setAttribute("position", new T.BufferAttribute(pos, 3));
    g.setAttribute("tint", new T.BufferAttribute(col, 3));
    g.setAttribute("size", new T.BufferAttribute(size, 1));
    return new T.Points(g, mat);
  }
  const C = (h) => new T.Color(h);
  const mix = (a, b, t) => a.clone().lerp(b, t);

  // ---------- ดาราจักรกังหัน (จานอยู่ระนาบ XZ ของกลุ่ม แล้วเอียงให้เห็นเฉียง) ----------
  const galaxy = new T.Group();
  galaxy.position.copy(G);
  galaxy.rotation.set(-1.02, 0.4, 0.18);
  scene.add(galaxy);
  {
    const N = lowQ ? 22000 : 64000;
    const core = C("#ffe7bf"), mid = C("#fff6ea"), arm = C("#9fc3ff"), young = C("#7fb0ff"), pink = C("#ff8fcf");
    const stars = [], dust = [];
    const ARMS = 4;
    const spiral = (r) => Math.log(r / RG * 9 + 1) * 2.6; // มุมของแขนตามรัศมี (log spiral)
    for (let i = 0; i < N; i++) {
      const t = rnd();
      if (t < 0.17) {
        // ป่องกลาง (bulge)
        const r = Math.abs(gauss()) * RG * 0.1;
        const th = rnd() * Math.PI * 2, ph = Math.acos(2 * rnd() - 1);
        const p = [Math.sin(ph) * Math.cos(th) * r, Math.cos(ph) * r * 0.55, Math.sin(ph) * Math.sin(th) * r];
        const c = mix(core, mid, Math.min(1, r / (RG * 0.2)));
        c.multiplyScalar(0.7);
        stars.push({ p, c: [c.r, c.g, c.b], s: 1.1 + rnd() * 1.6 });
        continue;
      }
      const r = Math.min(RG, -Math.log(1 - rnd() * 0.985) * RG * 0.27 + RG * 0.03);
      const k = r / RG;
      const diffuse = t > 0.83; // ดาวระหว่างแขน
      const a = (i % ARMS) * (Math.PI * 2 / ARMS) + (i % ARMS >= 2 ? 0.35 : 0);
      const off = diffuse ? rnd() * Math.PI * 2 : gauss() * (0.24 + 0.26 * (1 - k)) * ((i % ARMS) >= 2 ? 1.4 : 1);
      const ang = a + spiral(r) + off;
      const rr = r + gauss() * RG * 0.025;
      const y = gauss() * RG * (0.008 + 0.02 * (1 - k));
      const p = [Math.cos(ang) * rr, y, Math.sin(ang) * rr];
      let c = mix(mid, arm, smooth(0.05, 0.6, k));
      let s = 1.6 + rnd() * 2.2;
      if (!diffuse && Math.abs(off) < 0.08 && rnd() < 0.12) { c = mix(young, C("#ffffff"), rnd() * 0.4); s *= 1.8; }
      if (!diffuse && k > 0.15 && Math.abs(off) < 0.12 && rnd() < 0.05) { c = pink.clone(); s = 3 + rnd() * 4; } // บริเวณดาวเกิดใหม่
      if (diffuse) { c.multiplyScalar(0.55); s *= 0.8; }
      stars.push({ p, c: [c.r, c.g, c.b], s });
      // ฝุ่น: ขอบด้านในของแขนหลัก
      if (!diffuse && (i % ARMS) < 2 && k > 0.1 && k < 0.8 && rnd() < (lowQ ? 0.05 : 0.07)) {
        const da = a + spiral(r) - 0.1 + gauss() * 0.07;
        dust.push({ p: [Math.cos(da) * rr, y * 0.6, Math.sin(da) * rr], c: [0.1, 0.06, 0.07], s: 7 + rnd() * 10 });
      }
    }
    galaxy.add(cloud(stars, pointsMat({ twinkle: 0.18, mul: 4 })));
    const dustPts = cloud(dust, pointsMat({ fs: DUST_FS, blending: T.NormalBlending, twinkle: 0 }));
    pointUniforms[pointUniforms.length - 1].uOpacity.value = 0.2;
    dustPts.renderOrder = 2;
    galaxy.add(dustPts);
    // แกนสว่าง + ฮาโล
    const coreGlow = new T.Sprite(new T.SpriteMaterial({ map: keep(glowTex([[0, "rgba(255,250,235,.9)"], [0.12, "rgba(255,226,170,.55)"], [0.4, "rgba(255,170,120,.12)"], [1, "rgba(0,0,0,0)"]])), blending: T.AdditiveBlending, depthWrite: false, transparent: true }));
    coreGlow.scale.setScalar(RG * 0.5); coreGlow.renderOrder = 3;
    galaxy.add(coreGlow);
    const halo = new T.Sprite(new T.SpriteMaterial({ map: keep(glowTex([[0, "rgba(150,170,255,.35)"], [0.5, "rgba(120,110,220,.12)"], [1, "rgba(0,0,0,0)"]])), blending: T.AdditiveBlending, depthWrite: false, transparent: true }));
    halo.scale.setScalar(RG * 2.8);
    galaxy.add(halo);
  }

  // ---------- เนบิวลา + ดาวพื้นหลัง + ดาราจักรไกลๆ ----------
  {
    const neb = keep(glowTex([[0, "rgba(255,255,255,.55)"], [0.4, "rgba(255,255,255,.18)"], [1, "rgba(255,255,255,0)"]]));
    const tints = ["#6c5cff", "#ff6fb4", "#4fc3f7", "#9a7cff"];
    for (let k = 0; k < 9; k++) {
      const s = new T.Sprite(new T.SpriteMaterial({ map: neb, color: C(tints[k % 4]), blending: T.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.32 }));
      s.position.set((rnd() - 0.5) * 5200, (rnd() - 0.5) * 3000, G.z + (rnd() - 0.3) * 3200);
      s.scale.setScalar(1400 + rnd() * 2200);
      scene.add(s);
    }
    const bg = [];
    const BN = lowQ ? 3500 : 9000;
    const pal = [C("#ffffff"), C("#cfe0ff"), C("#ffe9c9"), C("#a9c4ff")];
    for (let i = 0; i < BN; i++) {
      const th = rnd() * Math.PI * 2, ph = Math.acos(2 * rnd() - 1), r = 9000 + rnd() * 6000;
      const c = pal[i % 4].clone().multiplyScalar(0.5 + rnd() * 0.5);
      bg.push({ p: [Math.sin(ph) * Math.cos(th) * r, Math.cos(ph) * r, Math.sin(ph) * Math.sin(th) * r - 2600], c: [c.r, c.g, c.b], s: (rnd() < 0.04 ? 70 : 24 + rnd() * 26) });
    }
    scene.add(cloud(bg, pointsMat({ twinkle: 0.4 })));
    const far = keep(glowTex([[0, "rgba(255,240,220,.9)"], [0.25, "rgba(200,190,255,.35)"], [1, "rgba(0,0,0,0)"]]));
    for (let k = 0; k < 7; k++) {
      const s = new T.Sprite(new T.SpriteMaterial({ map: far, blending: T.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8, rotation: rnd() * 3 }));
      s.position.set((rnd() - 0.5) * 16000, (rnd() - 0.5) * 9000, -9000 - rnd() * 4000);
      s.scale.set(160 + rnd() * 140, 60 + rnd() * 50, 1);
      scene.add(s);
    }
  }

  // ---------- ดาวยืดตามความเร็ว (ท่อรอบเส้นทางบิน) ----------
  const streakU = { uStretch: { value: 0 }, uOpacity: { value: 0 } };
  {
    const SN = lowQ ? 400 : 1000;
    const pos = new Float32Array(SN * 6), tail = new Float32Array(SN * 2);
    for (let i = 0; i < SN; i++) {
      const a = rnd() * Math.PI * 2, r = 25 + Math.pow(rnd(), 0.6) * 520;
      const x = Math.cos(a) * r, y = Math.sin(a) * r, z = 200 + rnd() * (G.z + 400 - 200);
      pos.set([x, y, z, x, y, z], i * 6);
      tail[i * 2] = 0; tail[i * 2 + 1] = 1;
    }
    const g = keep(new T.BufferGeometry());
    g.setAttribute("position", new T.BufferAttribute(pos, 3));
    g.setAttribute("tail", new T.BufferAttribute(tail, 1));
    const m = keep(new T.ShaderMaterial({ uniforms: streakU, vertexShader: STREAK_VS, fragmentShader: STREAK_FS, transparent: true, depthWrite: false, blending: T.AdditiveBlending }));
    const lines = new T.LineSegments(g, m);
    lines.frustumCulled = false;
    scene.add(lines);
  }

  // ---------- เส้นที่พุ่งออกจากโลก (จาก +z ด้านหลังกล้อง ตรงไปใจกลางดาราจักร) ----------
  //  แถบแบนหันหน้าเข้ากล้องเสมอ (หมุนรอบแกนเส้น) + ไล่สีขวางเส้น → เป็นลำแสงนุ่มทั้งมองจากข้างและมองตามเส้น
  const beam = new T.Group();
  {
    const len = 200 - G.z;
    const ribbonTex = (stops) => {
      const c = document.createElement("canvas"); c.width = 128; c.height = 4;
      const g = c.getContext("2d"); const gr = g.createLinearGradient(0, 0, 128, 0);
      for (const [o, col] of stops) gr.addColorStop(o, col);
      g.fillStyle = gr; g.fillRect(0, 0, 128, 4);
      const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return keep(t);
    };
    const mk = (w, tex) => {
      const geo = keep(new T.PlaneGeometry(1, len)); geo.rotateX(-Math.PI / 2);
      const m = new T.Mesh(geo, keep(new T.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: T.DoubleSide })));
      m.position.z = (200 + G.z) / 2; m.scale.x = w;
      return m;
    };
    beam.add(mk(16, ribbonTex([[0, "rgba(120,170,255,0)"], [0.5, "rgba(140,190,255,.55)"], [1, "rgba(120,170,255,0)"]])));
    beam.add(mk(3, ribbonTex([[0, "rgba(190,225,255,0)"], [0.3, "rgba(200,230,255,.9)"], [0.5, "rgba(255,255,255,1)"], [0.7, "rgba(200,230,255,.9)"], [1, "rgba(190,225,255,0)"]])));
  }
  scene.add(beam);
  const beamHead = new T.Sprite(new T.SpriteMaterial({ map: keep(glowTex([[0, "rgba(255,255,255,1)"], [0.2, "rgba(190,225,255,.8)"], [1, "rgba(0,0,0,0)"]])), blending: T.AdditiveBlending, depthWrite: false, transparent: true }));
  beamHead.scale.setScalar(60);
  scene.add(beamHead);

  // ---------- กล้อง ----------
  const C0 = new T.Vector3(170, 12, -330), C1 = new T.Vector3(7, 4, -250);
  const q0 = new T.Quaternion(), q1 = new T.Quaternion();
  {
    // มองเส้นจากด้านข้าง: เส้น (แกน -z) วิ่งไปทางขวาของจอ · หมุนกล้องให้เส้นเฉียงขึ้นขวา 34° เท่าเส้นบนลูกโลก
    const o = new T.PerspectiveCamera(); // กล้องมองทาง -z (Object3D ธรรมดามองกลับด้าน)
    o.position.copy(C0); o.lookAt(0, 0, -330); o.rotateZ(-34 * Math.PI / 180);
    q0.copy(o.quaternion);
    o.position.copy(C1); o.rotation.set(0, 0, 0); o.lookAt(G.x, G.y + 60, G.z);
    q1.copy(o.quaternion);
  }
  const endZ = G.z + 160;

  let dead = false, raf = 0;
  const t0 = performance.now();
  let last = t0, lastZ = C1.z;
  function resize() {
    const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    const sc = h * renderer.getPixelRatio() * 0.5 / Math.tan(camera.fov * Math.PI / 360);
    for (const u of pointUniforms) u.uScale.value = sc * u.mul;
  }
  function frame(now) {
    if (dead) return;
    raf = requestAnimationFrame(frame);
    draw(now);
  }
  function draw(now) {
    const dt = Math.max(0, Math.min(0.1, (now - last) / 1000)); last = now;
    const u = Math.max(0, (now - t0) / D);
    if (canvas.clientWidth && Math.abs(canvas.clientWidth / canvas.clientHeight - camera.aspect) > 0.01) resize();
    // หัน
    const kt = smooth(0.18, 0.46, u);
    camera.position.lerpVectors(C0, C1, kt);
    camera.quaternion.slerpQuaternions(q0, q1, kt);
    // พุ่ง (เร่งขึ้นเรื่อยๆ)
    const kf = Math.min(1, Math.max(0, (u - 0.46) / 0.54));
    // เร่งออกตัว แล้วไปถึงใกล้ดาราจักรก่อนแฟลช (0.86)
    const p = Math.pow(kf, 2.3) * 0.4 + (kf < 0.5 ? 4 * kf * kf * kf : 1 - Math.pow(-2 * kf + 2, 3) / 2) * 0.6;
    camera.position.z = (kf > 0 ? C1.z + (endZ - C1.z) * p : camera.position.z);
    camera.position.y += Math.sin(kf * Math.PI) * 30;
    if (kf > 0) camera.lookAt(G.x, G.y + 60 * (1 - p), G.z);
    camera.fov = 55 + smooth(0.55, 0.95, u) * 22; camera.updateProjectionMatrix();
    const speed = dt > 0 ? Math.abs(camera.position.z - lastZ) / dt : 0;
    lastZ = camera.position.z;
    streakU.uStretch.value = Math.min(900, speed * 0.05);
    streakU.uOpacity.value = smooth(0.48, 0.6, u) * 0.7;
    // หัวลำแสงวิ่งนำหน้ากล้อง แล้วหายเข้าแกนดาราจักร
    beamHead.position.set(0, 0, Math.max(G.z, camera.position.z - 120 - 2600 * p));
    beamHead.material.opacity = smooth(0.3, 0.5, u) * (1 - smooth(0.9, 1, u));
    // ฟ้า: สว่าง (ต่อจากฉากลูกโลก) → อวกาศ
    const kb = smooth(0.2, 0.42, u);
    if (kb < 0.5) scene.background.copy(bgLight).lerp(bgMid, kb * 2); else scene.background.copy(bgMid).lerp(bgDark, kb * 2 - 1);
    beam.rotation.z = Math.atan2(-camera.position.x, camera.position.y);
    galaxy.rotation.y += dt * 0.04;
    for (const pu of pointUniforms) pu.uTime.value = (now - t0) / 1000;
    renderer.render(scene, camera);
  }
  resize();
  raf = requestAnimationFrame(frame);
  return {
    // วาดเฟรมที่เวลา ms (หยุดลูปเวลาจริง) — ใช้ตรวจภาพทีละช่วง
    renderAt(ms) { cancelAnimationFrame(raf); raf = 0; dead = false; last = t0 + ms - 16; draw(t0 + ms); },
    dispose() {
      dead = true; cancelAnimationFrame(raf);
      scene.traverse((o) => { if (o.isSprite) o.material.dispose(); if (o.isMesh) o.material.dispose?.(); });
      for (const d of disposables) d.dispose?.();
      renderer.dispose();
    },
  };
}
