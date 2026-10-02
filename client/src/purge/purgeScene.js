// ============================================================
//  Purge — ฉากอุโมงค์ท่อแบบ 2.5D (ไม่ผูกกับ React)
//  - ท่อ = ทรงกระบอกที่ผิวด้านในเป็นภูมิประเทศธรรมชาติ (ป่า เชิงเขา โบราณสถาน น้ำตก) แบ่ง 5 ภูมิภาค
//  - ระหว่างเล่น ตัดครึ่งบนของท่อออกด้วยระนาบตัด (clipping) → เหลือรางครึ่งทรงกระบอก มองจากมุมสูงด้วยเลนส์แคบ
//    ครึ่งบนมีไว้เฉพาะฉากเปิด (เห็นท่อเต็มวงก่อนกล้องลอยลงมาที่จุดเริ่ม) แล้วซ่อนทิ้งทั้งชุด
//  - ทุกช่องที่ ORT คลานผ่านตกผลึก (Crystal Valley) ด้วย shader ตัวเดียวที่ทุกวัสดุใช้ร่วมกัน (uniform uCrystal)
//  - ประหยัดเครื่อง: ไม่มีเงาจริง · วาดเฉพาะตอนมีอนิเมชัน (นิ่ง = วาดช้าลงเหลือ ~12 เฟรม/วิ) · pixelRatio ไม่เกิน 1.25
//  เวลาของฉากจบเทิร์นต้องตรงกับ server/modes/purge.js — ใช้ ortSceneSeconds() สูตรเดียวกัน
// ============================================================
import * as THREE from "three";

const T = THREE;

// ---------- โครงท่อ ----------
export const STEPS = 150;
const ORT_IMG = "/characters/ort/ort_body.jpg";
const R = 58;
const L = 940;
const SC = L / 610;          // ตัวคูณตำแหน่งของฉาก (ออกแบบไว้ที่ท่อยาว 610)
const CUT = -5;                                  // ระนาบตัดครึ่งบน (เก็บเฉพาะ y <= CUT)
const SHELL = R + 8;
export const REGION_STEPS = 30;
export function zOf(step) { return 20 + step * 6; }
const BOUNDS = [30, 60, 90, 120].map((s) => zOf(s) - 3);
const FLOOR = -Math.PI / 2;
const TH_R = Math.asin(CUT / R);
const TH_L = -Math.PI - TH_R;
const Z0 = -12, Z1 = L + 12;

export const REGIONS = [
  { n: "I", name: "ประตูท่อ", color: "#7fb0ee" },
  { n: "II", name: "ธารใต้ดิน", color: "#4fd6c4" },
  { n: "III", name: "ทางมืด", color: "#a48cff" },
  { n: "IV", name: "คอขวด", color: "#f0a25a" },
  { n: "V", name: "แก่นกลาง", color: "#f6d77e" },
];
export function regionOfStep(s) { return Math.min(4, Math.max(0, Math.floor(s / REGION_STEPS))); }

// ---------- เวลาของฉาก (ต้องตรงกับ server/modes/purge.js — มีเทสต์เทียบ) ----------
export const INTRO_SECONDS = 11.4;
const T_ORT_CAM = 1.6, T_ORT_DICE = 1.8, T_ORT_ARRIVE = 2.4, T_ORT_STEP = 0.32, T_AFTER_ORT = 0.4, T_BOOM = 1.9, T_BACK = 1.4, T_FIGHT_MARK = 1.2, T_END = 0.3;
export const FIGHT_ZOOM_SECONDS = 2.4; // ซูมเข้าช่องปะทะ (server พัก 3 วิ — แฟลชขาวตอนท้าย แล้วสนามประลองของภูมิภาคขึ้นแทน)
export const WALK_STEP = 0.3;          // วิ/ช่อง ตอนหมากเดิน (server รอตามนี้ก่อนเข้าฉาก ORT)
// scene = { ortFrom, ortTo, caught: [...], fights: [...] }
export function ortSceneSeconds(scene) {
  let t = T_ORT_CAM;
  if (scene.ortFrom == null) t += T_ORT_ARRIVE;
  else t += T_ORT_DICE + (scene.ortTo - scene.ortFrom) * T_ORT_STEP + T_AFTER_ORT;
  if ((scene.caught || []).length) t += T_BOOM;
  t += T_BACK;
  if ((scene.fights || []).length) t += T_FIGHT_MARK;
  return t + T_END;
}

// ---------- noise ----------
function hash(x, y, z) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function vnoise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const c = (a, b, d) => hash(xi + a, yi + b, zi + d);
  const x00 = c(0, 0, 0) + (c(1, 0, 0) - c(0, 0, 0)) * u;
  const x10 = c(0, 1, 0) + (c(1, 1, 0) - c(0, 1, 0)) * u;
  const x01 = c(0, 0, 1) + (c(1, 0, 1) - c(0, 0, 1)) * u;
  const x11 = c(0, 1, 1) + (c(1, 1, 1) - c(0, 1, 1)) * u;
  const y0 = x00 + (x10 - x00) * v, y1 = x01 + (x11 - x01) * v;
  return y0 + (y1 - y0) * w;
}
function fbm(x, y, z, oct) {
  let a = 0, amp = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { a += amp * vnoise(x * f, y * f, z * f); f *= 2.03; amp *= 0.5; }
  return a / (1 - Math.pow(0.5, oct));
}
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
function makeRnd(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; }; }

// ---------- ภูมิภาค ----------
const hex = (h) => new T.Color(h);
const REG = [
  { amp: 9, ridge: 0.2, grass: hex("#7aa154"), dark: hex("#46703c"), rock: hex("#8f897a"), path: hex("#c2ab80"), sky: hex("#dde9ee"), tree: [hex("#2f5e3a"), hex("#3d7346"), hex("#5a8a48"), hex("#4b7a3c")] },
  { amp: 14, ridge: 0.5, grass: hex("#64a86e"), dark: hex("#33785a"), rock: hex("#71807f"), path: hex("#adac94"), sky: hex("#d6ecea"), tree: [hex("#2f7a55"), hex("#4b9a62"), hex("#2a6450"), hex("#6aa868")] },
  { amp: 10, ridge: 0.3, grass: hex("#3a5246"), dark: hex("#223630"), rock: hex("#4d4a5c"), path: hex("#6f6676"), sky: hex("#5a5c80"), tree: [hex("#1f3d33"), hex("#2b4a3e"), hex("#352f52"), hex("#24433a")] },
  { amp: 18, ridge: 0.9, grass: hex("#ad9e66"), dark: hex("#807246"), rock: hex("#b8875c"), path: hex("#cbb18a"), sky: hex("#eadcc0"), tree: [hex("#5d6a33"), hex("#76773a"), hex("#8a6a34"), hex("#55602f")] },
  { amp: 8, ridge: 0.2, grass: hex("#cfb165"), dark: hex("#a3823e"), rock: hex("#ded4bb"), path: hex("#eee4c8"), sky: hex("#f6eed6"), tree: [hex("#e0b44a"), hex("#f1cf6a"), hex("#d0982e"), hex("#e8c060")] },
];
function regMix(z) {
  for (let i = 0; i < BOUNDS.length; i++) {
    if (z < BOUNDS[i] + 10) return { a: i, b: Math.min(4, i + 1), t: smooth(BOUNDS[i] - 10, BOUNDS[i] + 10, z) };
  }
  return { a: 4, b: 4, t: 0 };
}
function regionAt(z) { let i = 0; while (i < 4 && z >= BOUNDS[i]) i++; return i; }
function mixC(out, c1, c2, t) { out.r = lerp(c1.r, c2.r, t); out.g = lerp(c1.g, c2.g, t); out.b = lerp(c1.b, c2.b, t); return out; }

function pathCenter(z) { return FLOOR + 0.04 * Math.sin(z * 0.012) + 0.02 * Math.sin(z * 0.037 + 1.3); }
function angleFromPath(th, z) { const d = th - pathCenter(z); return Math.abs(Math.atan2(Math.sin(d), Math.cos(d))); }
function heightAt(th, z) {
  const m = regMix(z);
  const amp = lerp(REG[m.a].amp, REG[m.b].amp, m.t);
  const ridge = lerp(REG[m.a].ridge, REG[m.b].ridge, m.t);
  const a = angleFromPath(th, z);
  const k = 0.034;
  const nx = Math.cos(th) * R * k, ny = Math.sin(th) * R * k, nz = z * k;
  const n = fbm(nx, ny, nz, 4);
  const rdg = 1 - Math.abs(2 * fbm(nx * 1.7 + 11, ny * 1.7, nz * 1.7, 3) - 1);
  const hills = Math.pow(n, 1.6) * 1.9 * (1 - ridge) + Math.pow(rdg, 2.2) * 1.5 * ridge;
  const wall = smooth(0.55, 1.25, a); // พื้นกลางกว้างพอให้ทางแยก 3 สาย
  let d = wall * amp * hills + 0.5 * n;
  d += 7 * smooth(BOUNDS[2] - 20, BOUNDS[2] + 30, z) * (1 - smooth(BOUNDS[3] - 10, BOUNDS[3] + 25, z)) * wall;
  d *= lerp(0.1, 1, smooth(0.5, 0.68, a));
  d *= lerp(1, 0.55, smooth(1.2, 1.5, a)) * (a > 1.9 ? lerp(0.55, 1, smooth(1.9, 2.3, a)) / 0.55 : 1);
  return Math.min(d, R * 0.5);
}
function surfPoint(th, z, lift = 0) {
  const r = R - heightAt(th, z) - lift;
  return new T.Vector3(Math.cos(th) * r, Math.sin(th) * r, z);
}
const UP = new T.Vector3(0, 1, 0);
function placeOn(obj, th, z, lift = 0, yaw = 0) {
  obj.position.copy(surfPoint(th, z, lift));
  obj.quaternion.setFromUnitVectors(UP, new T.Vector3(-Math.cos(th), -Math.sin(th), 0));
  if (yaw) obj.rotateY(yaw);
  return obj;
}
function floorY(z) { return surfPoint(pathCenter(z), z).y; }

// ---------- texture helpers ----------
function canvasTex(w, h, draw) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; return t;
}
function glowTex(inner, outer) {
  return canvasTex(128, 128, (g) => {
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, inner); gr.addColorStop(0.35, outer); gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  });
}
function hexPath(g, cx, cy, rw, rh) {
  g.beginPath();
  g.moveTo(cx, cy - rh); g.lineTo(cx + rw, cy - rh / 2); g.lineTo(cx + rw, cy + rh / 2);
  g.lineTo(cx, cy + rh); g.lineTo(cx - rw, cy + rh / 2); g.lineTo(cx - rw, cy - rh / 2); g.closePath();
}
const THAI = '"IBM Plex Sans Thai", "Leelawadee UI", Tahoma, sans-serif';
// ตัวหมากหกเหลี่ยม: รูปตัวละคร (ถ้าโหลดได้) ไม่งั้นใช้ตัวอักษรแรกของชื่อ · lost = กลายเป็นผลึก
function drawToken(g, { color, ini, img, lost }) {
  g.clearRect(0, 0, 256, 296);
  g.save();
  g.shadowColor = "rgba(0,0,0,.35)"; g.shadowBlur = 10;
  hexPath(g, 128, 148, 118, 138); g.fillStyle = lost ? "#e8f6ff" : "#ffffff"; g.fill();
  g.restore();
  hexPath(g, 128, 148, 106, 125);
  const gr = g.createLinearGradient(40, 20, 216, 280);
  gr.addColorStop(0, color || "#7cc4ff"); gr.addColorStop(1, "#0b1424");
  g.fillStyle = gr; g.fill();
  if (img && img.complete && img.naturalWidth) {
    g.save(); hexPath(g, 128, 148, 106, 125); g.clip();
    const s = Math.max(212 / img.naturalWidth, 250 / img.naturalHeight);
    const w = img.naturalWidth * s, h = img.naturalHeight * s;
    g.drawImage(img, 128 - w / 2, 148 - h * 0.42, w, h);
    g.restore();
  } else {
    g.fillStyle = "#06121f";
    g.font = `600 118px ${THAI}`; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(ini || "?", 128, 156);
  }
  if (lost) {
    hexPath(g, 128, 148, 106, 125);
    const cr = g.createLinearGradient(40, 20, 216, 280);
    cr.addColorStop(0, "rgba(242,251,255,.82)"); cr.addColorStop(0.5, "rgba(159,214,255,.78)"); cr.addColorStop(1, "rgba(140,120,232,.82)");
    g.fillStyle = cr; g.fill();
  }
  g.lineWidth = 6; g.strokeStyle = color || "#ffffff"; hexPath(g, 128, 148, 106, 125); g.stroke();
}
function labelTex(text) {
  return canvasTex(256, 64, (g) => {
    g.font = `600 34px ${THAI}`; g.textAlign = "center"; g.textBaseline = "middle";
    const w = Math.min(240, g.measureText(text).width + 36);
    g.fillStyle = "rgba(6,12,24,.78)";
    g.beginPath(); if (g.roundRect) g.roundRect(128 - w / 2, 8, w, 48, 24); else g.rect(128 - w / 2, 8, w, 48); g.fill();
    g.fillStyle = "#f2f7ff"; g.fillText(text, 128, 33);
  });
}
function mergeGeo(list) {
  const pos = [], nor = [];
  for (const g of list) {
    const n = g.index ? g.toNonIndexed() : g;
    n.computeVertexNormals();
    pos.push(...n.attributes.position.array); nor.push(...n.attributes.normal.array);
  }
  const out = new T.BufferGeometry();
  out.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
  out.setAttribute("normal", new T.Float32BufferAttribute(nor, 3));
  return out;
}

// ======================================================
export function createPurgeScene(canvas, opts = {}) {
  const rnd = makeRnd(1234567);
  const disposables = [];
  const keep = (x) => { disposables.push(x); return x; };

  const renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance", alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.outputColorSpace = T.SRGBColorSpace;
  const clip = new T.Plane(new T.Vector3(0, -1, 0), CUT);
  renderer.clippingPlanes = [clip];

  const scene = new T.Scene();
  const skyCol = REG[0].sky.clone();
  scene.background = skyCol;
  scene.fog = new T.Fog(skyCol, 200, 600);
  const camera = new T.PerspectiveCamera(22, 16 / 9, 1, 3000);

  scene.add(new T.HemisphereLight(0xf2f8ff, 0x4a4234, 1.35));
  const sun = new T.DirectionalLight(0xfff1dc, 2.0);
  sun.position.set(-0.45, 1, -0.3);
  scene.add(sun);
  const under = new T.DirectionalLight(0xcfe0ff, 0.6);
  under.position.set(0.3, -1, 0.2);
  scene.add(under);

  // ---------- ตกผลึก (Crystal Valley) ----------
  const U = { uCrystal: { value: -80 }, uTime: { value: 0 } };
  function crystalize(mat, grow = false) {
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uCrystal = U.uCrystal;
      sh.uniforms.uTime = U.uTime;
      sh.vertexShader = "uniform float uCrystal;\nvarying vec3 vCW;\n" + sh.vertexShader
        .replace("#include <begin_vertex>", "#include <begin_vertex>\n" + (grow
          ? "#ifdef USE_INSTANCING\n transformed *= smoothstep(uCrystal + 1.0, uCrystal - 6.0, instanceMatrix[3].z);\n#endif\n" : ""))
        .replace("#include <project_vertex>", "#include <project_vertex>\n vec4 cwp = vec4(transformed, 1.0);\n#ifdef USE_INSTANCING\n cwp = instanceMatrix * cwp;\n#endif\n vCW = (modelMatrix * cwp).xyz;\n");
      if (grow) return;
      sh.fragmentShader = "uniform float uCrystal;\nuniform float uTime;\nvarying vec3 vCW;\n" + sh.fragmentShader
        .replace("#include <color_fragment>", [
          "#include <color_fragment>",
          " float cAng = atan(vCW.y, vCW.x);",
          " float cFront = uCrystal + sin(cAng * 7.0) * 2.2 + sin(cAng * 19.0 + 1.7) * 1.1;",
          " float cr = smoothstep(cFront + 0.6, cFront - 2.0, vCW.z);",
          " float facet = 0.5 + 0.5 * sin(vCW.x * 0.9 + vCW.y * 0.7 + vCW.z * 0.45) * sin(vCW.z * 1.3 - vCW.x * 0.4);",
          " vec3 cCol = mix(vec3(0.80, 0.93, 1.0), vec3(0.62, 0.56, 0.96), facet);",
          " diffuseColor.rgb = mix(diffuseColor.rgb, cCol, cr);",
        ].join("\n"))
        .replace("#include <emissivemap_fragment>", [
          "#include <emissivemap_fragment>",
          " float cEdge = exp(-pow((vCW.z - cFront) / 1.3, 2.0));",
          " float ahead = smoothstep(cFront + 9.0, cFront, vCW.z) * (1.0 - cr);",
          " float web = smoothstep(0.994, 1.0, abs(sin(cAng * 22.0 + sin(vCW.z * 0.2) * 0.4))) + 0.6 * smoothstep(0.985, 1.0, abs(sin((vCW.z - cFront) * 1.1)));",
          " float sparkle = pow(max(0.0, sin(vCW.x * 3.1 + uTime * 1.5) * sin(vCW.y * 2.7 - uTime) * sin(vCW.z * 2.3)), 12.0);",
          " totalEmissiveRadiance += cr * (vec3(0.08, 0.12, 0.26) + sparkle * vec3(1.2, 1.4, 1.6)) + cEdge * vec3(0.5, 0.85, 1.2) + web * ahead * vec3(0.22, 0.45, 0.7);",
        ].join("\n"));
    };
    return keep(mat);
  }

  // ---------- พื้นผิวท่อ (ครึ่งล่าง = ใช้ตลอด · ครึ่งบน = เฉพาะฉากเปิด) ----------
  function buildTerrain(th0, th1, nt, nz) {
    const pos = new Float32Array((nt + 1) * (nz + 1) * 3), col = new Float32Array((nt + 1) * (nz + 1) * 3);
    const c1 = new T.Color(), c2 = new T.Color(), c3 = new T.Color();
    for (let j = 0; j <= nz; j++) {
      const z = Z0 + (Z1 - Z0) * j / nz;
      const m = regMix(z), A = REG[m.a], B = REG[m.b];
      const amp = lerp(A.amp, B.amp, m.t);
      for (let i = 0; i <= nt; i++) {
        const th = th0 + (th1 - th0) * i / nt;
        const d = heightAt(th, z);
        const r = R - d, idx = (j * (nt + 1) + i) * 3;
        pos[idx] = Math.cos(th) * r; pos[idx + 1] = Math.sin(th) * r; pos[idx + 2] = z;
        const dc = angleFromPath(th, z);
        const patch = fbm(Math.cos(th) * 3.1, Math.sin(th) * 3.1, z * 0.07, 3);
        mixC(c1, A.grass, B.grass, m.t); mixC(c2, A.dark, B.dark, m.t);
        c1.lerp(c2, smooth(0.42, 0.62, patch));
        mixC(c3, A.rock, B.rock, m.t);
        c1.lerp(c3, smooth(0.5, 0.85, d / (amp * 1.4)) * 0.9);
        mixC(c3, A.path, B.path, m.t);
        c1.lerp(c3, 1 - smooth(0.03, 0.07, dc));
        const shade = 0.86 + 0.28 * vnoise(i * 0.7, j * 0.7, 3);
        col[idx] = c1.r * shade; col[idx + 1] = c1.g * shade; col[idx + 2] = c1.b * shade;
      }
    }
    const ind = [];
    for (let j = 0; j < nz; j++) for (let i = 0; i < nt; i++) {
      const a0 = j * (nt + 1) + i, a1 = a0 + 1, b0 = a0 + nt + 1, b1 = b0 + 1;
      ind.push(a0, b0, a1, a1, b0, b1);
    }
    const g = keep(new T.BufferGeometry());
    g.setAttribute("position", new T.BufferAttribute(pos, 3));
    g.setAttribute("color", new T.BufferAttribute(col, 3));
    g.setIndex(ind); g.computeVertexNormals();
    const mesh = new T.Mesh(g, crystalize(new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, side: T.DoubleSide })));
    scene.add(mesh);
    return mesh;
  }
  buildTerrain(TH_L - 0.06, TH_R + 0.06, 190, 620);
  const upper = new T.Group(); scene.add(upper);
  upper.add(buildTerrain(TH_R - 0.06, Math.PI - TH_R + 0.06, 80, 300));

  // ---------- รอยตัดของราง: ชั้นหญ้า/ดิน/หิน + ผิวนอก ----------
  const cutParts = new T.Group(); scene.add(cutParts);
  {
    const soil = hex("#7a5a3c"), rockA = hex("#6a6358"), rockB = hex("#4a4640");
    for (const [th, side] of [[TH_R, 1], [TH_L, -1]]) {
      const verts = [], cols = [], idxs = [];
      const NZr = 220; let v = 0;
      for (let j = 0; j < NZr; j++) {
        const zA = Z0 + (Z1 - Z0) * j / NZr, zB = Z0 + (Z1 - Z0) * (j + 1) / NZr;
        const rA = R - heightAt(th, zA), rB = R - heightAt(th, zB);
        const m = regMix(zA), g = mixC(new T.Color(), REG[m.a].grass, REG[m.b].grass, m.t);
        const bands = [[rA - 0.4, rB - 0.4, rA + 1.3, rB + 1.3, g], [rA + 1.3, rB + 1.3, R + 3, R + 3, soil], [R + 3, R + 3, R + 5.5, R + 5.5, rockA], [R + 5.5, R + 5.5, SHELL, SHELL, rockB]];
        bands.forEach((bd, k) => {
          const wob = 0.92 + 0.16 * vnoise(k * 3.1, j * 0.35, 7), c = bd[4], y = CUT - 0.02;
          verts.push(bd[0] * side, y, zA, bd[1] * side, y, zB, bd[2] * side, y, zA, bd[3] * side, y, zB);
          for (let q = 0; q < 4; q++) cols.push(c.r * wob, c.g * wob, c.b * wob);
          idxs.push(v, v + 1, v + 2, v + 2, v + 1, v + 3); v += 4;
        });
      }
      const g2 = keep(new T.BufferGeometry());
      g2.setAttribute("position", new T.Float32BufferAttribute(verts, 3));
      g2.setAttribute("color", new T.Float32BufferAttribute(cols, 3));
      g2.setIndex(idxs); g2.computeVertexNormals();
      cutParts.add(new T.Mesh(g2, crystalize(new T.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: T.DoubleSide }))));
    }
    const shell = new T.Mesh(keep(new T.CylinderGeometry(SHELL, SHELL, Z1 - Z0, 72, 1, true)),
      crystalize(new T.MeshStandardMaterial({ color: 0x55504a, roughness: 1, side: T.DoubleSide })));
    shell.rotation.x = Math.PI / 2; shell.position.z = (Z0 + Z1) / 2;
    scene.add(shell);
  }

  function halfDisc(rad, full) {
    const s = new T.Shape(), n = 48;
    if (full) { s.absarc(0, 0, rad, 0, Math.PI * 2, false); return new T.ShapeGeometry(s, 24); }
    const a0 = Math.asin(CUT / rad);
    s.moveTo(Math.cos(a0) * rad, CUT);
    for (let k = 0; k <= n; k++) { const a = a0 - (Math.PI + 2 * a0) * k / n; s.lineTo(Math.cos(a) * rad, Math.sin(a) * rad); }
    s.lineTo(Math.cos(a0) * rad, CUT);
    return new T.ShapeGeometry(s, 4);
  }

  // ---------- ปลายท่อ: ประตูผนึก ----------
  const goldGlow = keep(new T.MeshBasicMaterial({ color: 0xffd98a }));
  {
    const g = new T.Group();
    g.add(new T.Mesh(keep(halfDisc(SHELL, true)), keep(new T.MeshStandardMaterial({ color: 0x4d4840, roughness: 0.95, side: T.DoubleSide }))));
    const cy = -R + 22;
    const door = new T.Mesh(keep(new T.CircleGeometry(21, 6)), keep(new T.MeshStandardMaterial({ color: 0x8d8574, roughness: 0.8, flatShading: true })));
    door.position.set(0, cy, 0.3); door.rotation.z = Math.PI / 6; g.add(door);
    for (const rr of [8, 14, 19.5]) {
      const ring = new T.Mesh(keep(new T.RingGeometry(rr - 0.45, rr, 6)), goldGlow);
      ring.position.set(0, cy, 0.5); ring.rotation.z = Math.PI / 6; g.add(ring);
    }
    for (let k = 0; k < 6; k++) {
      const seam = new T.Mesh(keep(new T.PlaneGeometry(0.5, 19.5)), goldGlow);
      const an = k * Math.PI / 3;
      seam.position.set(Math.sin(an) * 9.75, cy + Math.cos(an) * 9.75, 0.5); seam.rotation.z = -an; g.add(seam);
    }
    const core = new T.Mesh(keep(new T.CircleGeometry(3.6, 6)), goldGlow); core.position.set(0, cy, 0.6); core.rotation.z = Math.PI / 6; g.add(core);
    const pm = keep(new T.MeshStandardMaterial({ color: 0x7d7566, roughness: 0.9, flatShading: true }));
    for (const x of [-26, 26]) {
      const p = new T.Mesh(keep(new T.BoxGeometry(5, 30, 5)), pm); p.position.set(x, -R + 15, 2.5); g.add(p);
      const c = new T.Mesh(keep(new T.BoxGeometry(7, 2, 7)), pm); c.position.set(x, -R + 30.5, 2.5); g.add(c);
    }
    const halo = new T.Sprite(keep(new T.SpriteMaterial({ map: keep(glowTex("rgba(255,236,180,.95)", "rgba(255,214,120,.35)")), blending: T.AdditiveBlending, depthWrite: false })));
    halo.position.set(0, cy, 3); halo.scale.set(70, 70, 1); g.add(halo);
    g.position.z = Z1; g.rotation.y = Math.PI;
    scene.add(g);
  }

  // ---------- ปากท่อฝั่ง ORT: รอยตัดผลึก (โผล่เมื่อ ORT ปรากฏ) ----------
  const crystalMat = keep(new T.MeshStandardMaterial({ color: 0xdcf2ff, emissive: 0x4a5cb8, emissiveIntensity: 0.5, roughness: 0.12, metalness: 0.2, flatShading: true, transparent: true, opacity: 0.94 }));
  const crystalCut = new T.Group(); scene.add(crystalCut);
  {
    const fg = keep(halfDisc(SHELL, true).toNonIndexed()), fp = fg.attributes.position;
    for (let q = 0; q < fp.count; q++) fp.setZ(q, (vnoise(fp.getX(q) * 0.2, fp.getY(q) * 0.2, 5) - 0.5) * 9);
    fg.computeVertexNormals();
    const face = new T.Mesh(fg, keep(new T.MeshStandardMaterial({ color: 0xd2ecff, emissive: 0x4a5cc0, emissiveIntensity: 0.35, roughness: 0.15, metalness: 0.2, flatShading: true, side: T.DoubleSide })));
    face.position.z = Z0; crystalCut.add(face);
    const sg = keep(new T.OctahedronGeometry(1, 0));
    const inst = new T.InstancedMesh(sg, crystalMat, 120), o = new T.Object3D();
    for (let k = 0; k < 120; k++) {
      const a = -Math.PI + rnd() * Math.PI * 2, rr = 6 + rnd() * (SHELL - 6), sz = 3 + rnd() * 9;
      o.position.set(Math.cos(a) * rr, Math.sin(a) * rr, Z0 + rnd() * 5 - 2);
      o.rotation.set((rnd() - 0.5) * 1.4, rnd() * 3, (rnd() - 0.5) * 1.4);
      o.scale.set(0.9 + rnd(), sz, 0.9 + rnd()); o.updateMatrix(); inst.setMatrixAt(k, o.matrix);
    }
    crystalCut.add(inst);
  }
  crystalCut.visible = false;
  // ปากท่อก่อน ORT โผล่: ผนังหินปิดไว้ (หน้าผลึกจะงอกทับเมื่อ ORT มาถึง)
  {
    const cap = new T.Mesh(keep(halfDisc(SHELL, true)), keep(new T.MeshStandardMaterial({ color: 0x5a544b, roughness: 1, side: T.DoubleSide })));
    cap.position.z = Z0 - 3; scene.add(cap);
  }

  // ---------- ต้นไม้ ----------
  const p1 = new T.ConeGeometry(1.5, 2.4, 6); p1.translate(0, 1.9, 0);
  const p2 = new T.ConeGeometry(1.15, 2.1, 6); p2.translate(0, 3.0, 0);
  const p3 = new T.ConeGeometry(0.75, 1.7, 6); p3.translate(0, 4.0, 0);
  const pt = new T.CylinderGeometry(0.16, 0.22, 1.2, 4); pt.translate(0, 0.6, 0);
  const pineG = keep(mergeGeo([p1, p2, p3, pt]));
  const b1 = new T.IcosahedronGeometry(1.35, 0); b1.translate(0, 2.4, 0);
  const b2 = new T.IcosahedronGeometry(1.0, 0); b2.translate(0.9, 2.0, 0.4);
  const b3 = new T.IcosahedronGeometry(0.95, 0); b3.translate(-0.8, 2.1, -0.3);
  const trunk = new T.CylinderGeometry(0.16, 0.24, 1.6, 4); trunk.translate(0, 0.8, 0);
  const broadG = keep(mergeGeo([b1, b2, b3, trunk]));
  function forest(parent, geo, count, pick, thA, thB) {
    const mesh = new T.InstancedMesh(geo, crystalize(new T.MeshStandardMaterial({ roughness: 0.9, flatShading: true })), count);
    const o = new T.Object3D(), c = new T.Color();
    let n = 0, guard = 0;
    while (n < count && guard++ < count * 8) {
      const z = Z0 + 6 + rnd() * (L - 6), th = thA + rnd() * (thB - thA);
      const dc = angleFromPath(th, z), reg = regionAt(z);
      const w = pick(reg);
      if (w <= 0 || rnd() > w || dc < 0.56) continue; // พื้นกลาง = กระดาน
      if (dc < 0.75 && rnd() < 0.6) continue;
      placeOn(o, th, z, -0.2, rnd() * 6.28);
      const s = (0.5 + rnd() * 0.55) * (reg === 3 ? 0.85 : 1) * (dc > 1.6 ? 1.4 : 1);
      o.scale.set(s, s * (0.85 + rnd() * 0.5), s);
      o.updateMatrix(); mesh.setMatrixAt(n, o.matrix);
      const pal = REG[reg].tree; c.copy(pal[(rnd() * pal.length) | 0]).multiplyScalar(0.85 + rnd() * 0.3);
      mesh.setColorAt(n, c); n++;
    }
    mesh.count = n;
    parent.add(mesh);
  }
  const pinePick = (reg) => [0.8, 0.45, 0.3, 0.6, 0.05][reg];
  const broadPick = (reg) => [0.6, 0.9, 1, 0.15, 0.9][reg];
  forest(scene, pineG, 1400, pinePick, TH_L, TH_R);
  forest(scene, broadG, 1700, broadPick, TH_L, TH_R);
  forest(upper, pineG, 450, pinePick, TH_R, Math.PI - TH_R);
  forest(upper, broadG, 550, broadPick, TH_R, Math.PI - TH_R);

  // ---------- โบราณสถาน ----------
  const stoneMat = crystalize(new T.MeshStandardMaterial({ color: 0x9a9182, roughness: 0.92, flatShading: true }));
  const mossMat = crystalize(new T.MeshStandardMaterial({ color: 0x6f7a5a, roughness: 0.95, flatShading: true }));
  const goldMat = crystalize(new T.MeshStandardMaterial({ color: 0xe8cf8a, roughness: 0.6, metalness: 0.35, flatShading: true }));
  const unitBox = keep(new T.BoxGeometry(1, 1, 1));
  function pyramid(size, levels, mat) {
    const g = new T.Group();
    for (let k = 0; k < levels; k++) {
      const s = size * (1 - k / (levels + 0.6)), h = size * 0.22;
      const b = new T.Mesh(unitBox, k % 2 ? mossMat : mat); b.scale.set(s, h, s);
      b.position.y = h * (k + 0.5); g.add(b);
    }
    const top = new T.Mesh(unitBox, mat); top.scale.set(size * 0.22, size * 0.2, size * 0.22);
    top.position.y = size * 0.22 * levels + size * 0.1; g.add(top);
    const stair = new T.Mesh(unitBox, mat); stair.scale.set(size * 0.18, size * 0.22 * levels, size * 0.5);
    stair.position.set(0, size * 0.11 * levels, size * 0.42); stair.rotation.x = -0.55; g.add(stair);
    return g;
  }
  const colGeo = keep(new T.CylinderGeometry(0.55, 0.65, 1, 6));
  function pillar(h, mat) {
    const g = new T.Group();
    const c = new T.Mesh(colGeo, mat); c.scale.y = h; c.position.y = h / 2; g.add(c);
    const cap = new T.Mesh(unitBox, mat); cap.scale.set(1.6, 0.4, 1.6); cap.position.y = h; g.add(cap);
    return g;
  }
  for (const r of [
    [0.75, 70, 9, 4, stoneMat], [-0.72, 100, 7, 3, stoneMat], [1.0, 45, 14, 5, stoneMat],
    [0.78, 290, 10, 4, mossMat], [0.95, 318, 14, 5, mossMat], [-0.74, 272, 7, 3, mossMat],
    [0.74, 520, 11, 5, goldMat], [-0.72, 552, 8, 4, goldMat], [1.0, 498, 18, 6, goldMat], [0.85, 580, 16, 6, goldMat],
  ]) {
    const g = pyramid(r[2], r[3], r[4]);
    placeOn(g, pathCenter(r[1] * SC) + r[0], r[1] * SC, -0.5, rnd() * 0.6 - 0.3);
    scene.add(g);
  }
  for (const [za, zb, mat] of [[40, 90, stoneMat], [262, 330, mossMat], [480, 600, goldMat]]) {
    for (let z = za * SC; z < zb * SC; z += 16) {
      for (const side of [-1, 1]) {
        if (rnd() < 0.25) continue;
        const h = 3 + rnd() * 3.5;
        const p = pillar(rnd() < 0.3 ? h * 0.45 : h, mat);
        placeOn(p, pathCenter(z) + side * 0.6, z, -0.2, rnd());
        if (rnd() < 0.3) p.rotateX(0.25 * side);
        scene.add(p);
      }
    }
  }

  // ---------- ประตูภูมิภาค ----------
  ["#2fc4b2", "#8a6cf0", "#e08a3c", "#f0cf6e"].forEach((col, k) => {
    const bz = BOUNDS[k];
    const g = new T.Group();
    const gm = crystalize(new T.MeshStandardMaterial({ color: 0x8c8678, roughness: 0.85, flatShading: true }));
    const lm = keep(new T.MeshBasicMaterial({ color: new T.Color(col) }));
    for (const x of [-4.2, 4.2]) {
      const p = new T.Mesh(unitBox, gm); p.scale.set(1, 6.5, 1); p.position.set(x, 3.25, 0); g.add(p);
      const s = new T.Mesh(unitBox, lm); s.scale.set(0.22, 5, 1.05); s.position.set(x, 3.25, 0); g.add(s);
    }
    const top = new T.Mesh(unitBox, gm); top.scale.set(10.6, 1, 1.3); top.position.y = 6.8; g.add(top);
    const band = new T.Mesh(unitBox, lm); band.scale.set(8.6, 0.22, 1.35); band.position.y = 6.8; g.add(band);
    placeOn(g, pathCenter(bz), bz, 0.1);
    scene.add(g);
  });

  // ---------- น้ำตก + ลำธาร ----------
  const waterTex = keep(canvasTex(128, 256, (g, w, h) => {
    for (let k = 0; k < 260; k++) {
      const x = 8 + rnd() * (w - 16), y = rnd() * h, len = 30 + rnd() * 120;
      const edge = Math.min(x, w - x) / (w / 2);
      const gr = g.createLinearGradient(0, y, 0, y + len);
      const a = (0.25 + rnd() * 0.55) * Math.min(1, edge * 1.6);
      gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(0.5, `rgba(235,248,255,${a})`); gr.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = gr; g.fillRect(x, y, 1 + rnd() * 3, len);
    }
    const side = g.createLinearGradient(0, 0, w, 0);
    side.addColorStop(0, "rgba(160,215,235,0)"); side.addColorStop(0.25, "rgba(160,215,235,.35)"); side.addColorStop(0.75, "rgba(160,215,235,.35)"); side.addColorStop(1, "rgba(160,215,235,0)");
    g.fillStyle = side; g.fillRect(0, 0, w, h);
  }));
  waterTex.wrapS = waterTex.wrapT = T.RepeatWrapping;
  const waterMats = [];
  function ribbon(pts, mat) {
    const verts = [], uvs = [], idxs = [];
    pts.forEach((p) => { verts.push(p.a.x, p.a.y, p.a.z, p.b.x, p.b.y, p.b.z); uvs.push(0, p.v, 1, p.v); });
    for (let s = 0; s < pts.length - 1; s++) { const a = s * 2; idxs.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    const g = keep(new T.BufferGeometry());
    g.setAttribute("position", new T.Float32BufferAttribute(verts, 3));
    g.setAttribute("uv", new T.Float32BufferAttribute(uvs, 2)); g.setIndex(idxs);
    scene.add(new T.Mesh(g, mat));
  }
  const mistTex = keep(glowTex("rgba(255,255,255,.85)", "rgba(220,245,255,.35)"));
  function waterfall(side, z, top, bottom, width) {
    const pts = [], segs = 22;
    for (let s = 0; s <= segs; s++) {
      const th = pathCenter(z) + side * lerp(top, bottom, s / segs);
      const lift = 0.8 + Math.sin(s / segs * Math.PI) * 1.4;
      pts.push({ a: surfPoint(th, z - width / 2, lift), b: surfPoint(th, z + width / 2, lift), v: s / segs * 3 });
    }
    const tex = keep(waterTex.clone()); tex.needsUpdate = true;
    const mat = keep(new T.MeshBasicMaterial({ map: tex, transparent: true, side: T.DoubleSide, depthWrite: false }));
    waterMats.push(mat); ribbon(pts, mat);
    const mist = new T.Sprite(keep(new T.SpriteMaterial({ map: mistTex, transparent: true, depthWrite: false })));
    mist.position.copy(surfPoint(pathCenter(z) + side * bottom, z, 1.5)); mist.scale.set(width * 2.2, width * 1.5, 1); scene.add(mist);
  }
  waterfall(1, 160 * SC, 1.42, 0.66, 7); waterfall(-1, 185 * SC, 1.42, 0.66, 9); waterfall(1, 215 * SC, 1.4, 0.7, 6);
  waterfall(-1, 140 * SC, 1.3, 0.66, 5); waterfall(1, 98 * SC, 1.38, 0.7, 4); waterfall(-1, 232 * SC, 1.42, 0.72, 8);
  {
    const pts = [], z0 = 118 * SC, z1 = 252 * SC, steps = 120;
    for (let s = 0; s <= steps; s++) {
      const z = lerp(z0, z1, s / steps), c = pathCenter(z) + 0.6 + 0.02 * Math.sin(z * 0.08);
      pts.push({ a: surfPoint(c - 0.03, z, 0.15), b: surfPoint(c + 0.03, z, 0.15), v: s / steps * 18 });
    }
    const tex = keep(waterTex.clone()); tex.needsUpdate = true;
    const mat = keep(new T.MeshBasicMaterial({ map: tex, color: 0x9fe2ee, transparent: true, depthWrite: false }));
    waterMats.push(mat); ribbon(pts, mat);
  }

  // ---------- หิ่งห้อย / ละอองทอง ----------
  function motes(z0, z1, count, color, size) {
    const p = new Float32Array(count * 3);
    for (let k = 0; k < count; k++) {
      const z = lerp(z0, z1, rnd()), th = pathCenter(z) + (rnd() - 0.5) * 1.8;
      const v = surfPoint(th, z, 1 + rnd() * 8); p[k * 3] = v.x; p[k * 3 + 1] = v.y; p[k * 3 + 2] = v.z;
    }
    const g = keep(new T.BufferGeometry()); g.setAttribute("position", new T.BufferAttribute(p, 3));
    const pts = new T.Points(g, keep(new T.PointsMaterial({ map: keep(glowTex("rgba(255,255,255,1)", color)), size, transparent: true, depthWrite: false, blending: T.AdditiveBlending })));
    scene.add(pts); return pts;
  }
  const fireflies = motes(250 * SC, 360 * SC, 500, "rgba(190,170,255,.8)", 1.4);
  motes(470 * SC, 600 * SC, 420, "rgba(255,220,140,.8)", 1.1);

  // ---------- ผลึกงอก (ตามหลัง ORT) ----------
  {
    const sg = keep(new T.OctahedronGeometry(1, 0)); sg.scale(0.55, 2.6, 0.55); sg.translate(0, 1.6, 0);
    const mat = crystalize(new T.MeshStandardMaterial({ color: 0xd8f1ff, emissive: 0x4256b0, emissiveIntensity: 0.55, roughness: 0.12, metalness: 0.25, flatShading: true, transparent: true, opacity: 0.92 }), true);
    const SH = 1100, inst = new T.InstancedMesh(sg, mat, SH), o = new T.Object3D();
    let k = 0, guard = 0;
    while (k < SH && guard++ < SH * 4) {
      const z = rnd() * L, near = rnd() < 0.5;
      const th = near ? pathCenter(z) + (rnd() < 0.5 ? -1 : 1) * (0.55 + rnd() * 0.4) : TH_L + rnd() * (TH_R - TH_L);
      if (surfPoint(th, z).y > CUT - 1) continue;
      placeOn(o, th, z, -0.3, rnd() * 6.28);
      o.rotateX((rnd() - 0.5) * 0.9); o.rotateZ((rnd() - 0.5) * 0.9);
      const s = (0.6 + Math.pow(rnd(), 2) * 3.0) * (near ? 0.6 : 1); o.scale.set(s, s * (0.7 + rnd()), s);
      o.updateMatrix(); inst.setMatrixAt(k++, o.matrix);
    }
    inst.count = k;
    scene.add(inst);
  }

  // ---------- ORT: ยูนิตหกเหลี่ยมใหญ่ ----------
  const ort = new T.Group();
  // ตัวหมาก ORT: หกเหลี่ยมขอบผลึก + รูป ORT (ort_body.jpg ตัวเดียวกับโหมด Type Mercury) + ป้ายชื่อด้านล่าง
  const ortCv = document.createElement("canvas"); ortCv.width = 512; ortCv.height = 592;
  const ortTex = keep(new T.CanvasTexture(ortCv)); ortTex.colorSpace = T.SRGBColorSpace;
  function drawOrt(img) {
    const g = ortCv.getContext("2d");
    g.clearRect(0, 0, 512, 592);
    g.save(); g.shadowColor = "rgba(0,0,0,.4)"; g.shadowBlur = 16;
    hexPath(g, 256, 296, 240, 280);
    const rim = g.createLinearGradient(0, 0, 512, 592);
    rim.addColorStop(0, "#f4fbff"); rim.addColorStop(0.5, "#9fd6ff"); rim.addColorStop(1, "#8c78e8");
    g.fillStyle = rim; g.fill(); g.restore();
    g.save(); hexPath(g, 256, 296, 218, 254); g.clip();
    const gr = g.createRadialGradient(256, 250, 10, 256, 296, 300);
    gr.addColorStop(0, "#ff3a5c"); gr.addColorStop(0.35, "#7a1028"); gr.addColorStop(1, "#0c0307");
    g.fillStyle = gr; g.fillRect(0, 0, 512, 592);
    if (img && img.naturalWidth) {
      const sc = Math.max(436 / img.naturalWidth, 508 / img.naturalHeight);
      const w = img.naturalWidth * sc, h = img.naturalHeight * sc;
      g.drawImage(img, 256 - w / 2, 296 - h / 2, w, h);
      const shade = g.createLinearGradient(0, 330, 0, 560);
      shade.addColorStop(0, "rgba(40,4,14,0)"); shade.addColorStop(1, "rgba(40,4,14,.92)");
      g.fillStyle = shade; g.fillRect(0, 330, 512, 262);
    }
    g.restore();
    g.fillStyle = "#ffe6ec"; g.font = '700 96px "Chakra Petch", "Segoe UI", sans-serif';
    g.textAlign = "center"; g.textBaseline = "middle";
    g.shadowColor = "rgba(255,40,80,.8)"; g.shadowBlur = 18;
    g.fillText("ORT", 256, img && img.naturalWidth ? 478 : 306);
    ortTex.needsUpdate = true;
  }
  drawOrt(null);
  {
    const im = new Image(); im.crossOrigin = "anonymous";
    im.onload = () => { drawOrt(im); dirty = true; };
    im.src = ORT_IMG;
  }
  const ortSpr = new T.Sprite(keep(new T.SpriteMaterial({ map: ortTex, depthWrite: false })));
  ortSpr.scale.set(9, 10.4, 1); ortSpr.position.y = 6.4; ort.add(ortSpr);
  const ortAura = new T.Sprite(keep(new T.SpriteMaterial({ map: keep(glowTex("rgba(255,60,90,.7)", "rgba(255,30,70,.25)")), blending: T.AdditiveBlending, depthWrite: false })));
  ortAura.scale.set(22, 22, 1); ortAura.position.y = 6; ort.add(ortAura);
  const ortRingGeo = keep(new T.RingGeometry(5, 6, 6)); ortRingGeo.rotateX(-Math.PI / 2);
  const ortRing = new T.Mesh(ortRingGeo, keep(new T.MeshBasicMaterial({ color: 0xff2d55, transparent: true, opacity: 0.85, depthWrite: false })));
  ortRing.position.y = 0.35; ort.add(ortRing);
  {
    const sg = keep(new T.OctahedronGeometry(1, 0));
    for (let k = 0; k < 10; k++) {
      const sp = new T.Mesh(sg, crystalMat);
      const an = k / 10 * Math.PI * 2, sz = 1.2 + rnd() * 2.2;
      sp.scale.set(0.5, sz, 0.5);
      sp.position.set(Math.cos(an) * 5.6, sz * 0.7, Math.sin(an) * 5.6);
      sp.rotation.set(Math.sin(an) * 0.5, 0, -Math.cos(an) * 0.5); ort.add(sp);
    }
    const pl = new T.PointLight(0xff2d55, 50, 45, 1.6); pl.position.y = 8; ort.add(pl);
  }
  ort.visible = false;
  scene.add(ort);


  const fx = []; // { t, dur, fn(u, dt), end() }
  function addFx(dur, fn, end) { fx.push({ t: 0, dur, fn, end }); }


  // ---------- ลูกเต๋า ----------
  const PIPS = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] };
  const diceTex = [null, 1, 2, 3, 4, 5, 6].map((n) => (n == null ? null : keep(canvasTex(128, 128, (g) => {
    g.shadowColor = "rgba(0,0,0,.35)"; g.shadowBlur = 8;
    g.fillStyle = "#ffffff";
    g.beginPath(); if (g.roundRect) g.roundRect(10, 10, 108, 108, 22); else g.rect(10, 10, 108, 108); g.fill();
    g.shadowBlur = 0;
    const gr = g.createLinearGradient(10, 10, 118, 118);
    gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(1, "rgba(120,150,200,.25)");
    g.fillStyle = gr; g.fill();
    g.fillStyle = n === 1 ? "#d92b4b" : "#14213b";
    for (const [x, y] of PIPS[n]) { g.beginPath(); g.arc(64 + x * 28, 64 + y * 28, n === 1 ? 14 : 10, 0, Math.PI * 2); g.fill(); }
  }))));

  // ---------- ระเบิดกระจุย (ORT กลืนผู้เล่น) ----------
  const shardTex = keep(canvasTex(64, 64, (g) => {
    g.beginPath(); g.moveTo(32, 2); g.lineTo(58, 40); g.lineTo(30, 62); g.lineTo(8, 34); g.closePath();
    const gr = g.createLinearGradient(8, 2, 58, 62);
    gr.addColorStop(0, "#ffffff"); gr.addColorStop(0.45, "#a9dcff"); gr.addColorStop(1, "#8c78e8");
    g.fillStyle = gr; g.fill();
    g.strokeStyle = "rgba(255,255,255,.9)"; g.lineWidth = 2; g.stroke();
  }));
  const sparkTex = keep(glowTex("rgba(255,255,255,1)", "rgba(255,120,150,.6)"));
  const flashTex = keep(glowTex("rgba(255,255,255,1)", "rgba(255,70,110,.55)"));
  const ringTex = keep(canvasTex(256, 256, (g) => {
    const gr = g.createRadialGradient(128, 128, 80, 128, 128, 126);
    gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(0.7, "rgba(170,225,255,.9)"); gr.addColorStop(0.85, "rgba(255,80,120,.7)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  }));
  function explode(P) {
    const origin = new T.Vector3();
    P.spr.getWorldPosition(origin);
    const up = new T.Vector3(0, 1, 0);
    const group = new T.Group(); scene.add(group);
    const parts = [];
    const N = 70;
    for (let i = 0; i < N; i++) {
      const spark = i % 3 === 0;
      const m = new T.SpriteMaterial({ map: spark ? sparkTex : shardTex, transparent: true, depthWrite: false, blending: spark ? T.AdditiveBlending : T.NormalBlending });
      const s = new T.Sprite(m);
      s.position.copy(origin);
      const a = Math.random() * Math.PI * 2, e = 0.25 + Math.random() * 1.1, sp = 9 + Math.random() * 16;
      const v = new T.Vector3(Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e)).multiplyScalar(sp).addScaledVector(up, 4);
      const size = spark ? 0.8 + Math.random() * 1.4 : 0.6 + Math.random() * 1.6;
      s.scale.setScalar(size);
      group.add(s);
      parts.push({ s, v, spin: (Math.random() - 0.5) * 14, size });
    }
    const flash = new T.Sprite(new T.SpriteMaterial({ map: flashTex, transparent: true, depthWrite: false, blending: T.AdditiveBlending }));
    flash.position.copy(origin); group.add(flash);
    const ring = new T.Mesh(keep(new T.PlaneGeometry(1, 1)), new T.MeshBasicMaterial({ map: ringTex, transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide }));
    ring.position.copy(P.g.position); ring.quaternion.copy(P.g.quaternion); ring.rotateX(-Math.PI / 2); ring.translateZ(0.6);
    group.add(ring);
    addFx(1.7, (u, dt) => {
      for (const q of parts) {
        q.v.y -= 22 * dt; q.v.multiplyScalar(1 - 0.9 * dt);
        q.s.position.addScaledVector(q.v, dt);
        q.s.material.rotation += q.spin * dt;
        q.s.material.opacity = 1 - Math.pow(u, 1.6);
        q.s.scale.setScalar(q.size * (1 - u * 0.4));
      }
      const f = Math.min(1, u / 0.22);
      flash.scale.setScalar(4 + f * 26);
      flash.material.opacity = (1 - f) * 0.95 + (u < 0.22 ? 0.05 : 0);
      const r = Math.min(1, u / 0.55);
      ring.scale.setScalar(2 + r * 26);
      ring.material.opacity = 1 - r;
    }, () => {
      for (const q of parts) q.s.material.dispose();
      flash.material.dispose(); ring.material.dispose();
      scene.remove(group);
    });
  }


  // ---------- จุดเกิด ORT (ก่อน ORT โผล่): รอยแยกแดงเรืองแสง + ประกายลอยขึ้น ----------
  const rift = new T.Group(); scene.add(rift);
  const riftParts = {};
  {
    const crackTex = keep(canvasTex(128, 512, (g) => {
      const r = makeRnd(77);
      g.lineCap = "round";
      for (const [w, col] of [[26, "rgba(255,40,80,.18)"], [12, "rgba(255,60,100,.55)"], [4, "rgba(255,230,240,1)"]]) {
        g.strokeStyle = col; g.lineWidth = w; g.beginPath();
        let x = 64; g.moveTo(x, 10);
        for (let y = 10; y <= 502; y += 18) { x = 64 + (r() - 0.5) * 34 * Math.sin((y / 512) * Math.PI); g.lineTo(x, y); }
        g.stroke();
      }
    }));
    const zf = Z0 + 0.4;
    const crack = new T.Mesh(keep(new T.PlaneGeometry(9, 34)), new T.MeshBasicMaterial({ map: crackTex, transparent: true, depthWrite: false, blending: T.AdditiveBlending }));
    crack.position.set(0, -R + 17, zf); rift.add(crack);
    const halo = new T.Sprite(new T.SpriteMaterial({ map: keep(glowTex("rgba(255,70,110,.9)", "rgba(160,20,60,.35)")), transparent: true, depthWrite: false, blending: T.AdditiveBlending }));
    halo.position.set(0, -R + 15, zf + 2); halo.scale.set(40, 46, 1); rift.add(halo);
    const pool = new T.Mesh(keep(new T.CircleGeometry(9, 32)), new T.MeshBasicMaterial({ map: keep(glowTex("rgba(255,60,100,.8)", "rgba(120,10,40,.3)")), transparent: true, depthWrite: false, blending: T.AdditiveBlending }));
    pool.rotation.x = -Math.PI / 2; pool.position.set(0, floorY(zf + 4) + 0.5, zf + 5); rift.add(pool);
    const EM = 160, ep = new Float32Array(EM * 3), seeds = new Float32Array(EM);
    for (let k = 0; k < EM; k++) { seeds[k] = Math.random(); ep[k * 3] = (Math.random() - 0.5) * 18; ep[k * 3 + 1] = -R + 2 + Math.random() * 30; ep[k * 3 + 2] = zf + 1 + Math.random() * 10; }
    const eg = keep(new T.BufferGeometry()); eg.setAttribute("position", new T.BufferAttribute(ep, 3));
    const embers = new T.Points(eg, new T.PointsMaterial({ map: keep(glowTex("rgba(255,255,255,1)", "rgba(255,80,120,.7)")), size: 1.3, transparent: true, depthWrite: false, blending: T.AdditiveBlending }));
    rift.add(embers);
    const light = new T.PointLight(0xff2d55, 14, 32, 2); light.position.set(0, -R + 14, zf + 3); rift.add(light);
    Object.assign(riftParts, { crack, halo, pool, embers, ep, seeds, light });
  }
  function updateRift(dt) {
    if (!rift.visible) return;
    const { crack, halo, pool, embers, ep, seeds, light } = riftParts;
    const pulse = 0.75 + 0.25 * Math.sin(time * 3.1) + 0.08 * Math.sin(time * 11.7);
    crack.material.opacity = pulse;
    halo.material.opacity = 0.55 + 0.3 * pulse;
    pool.material.opacity = 0.5 + 0.3 * pulse;
    light.intensity = 9 + 7 * pulse;
    for (let k = 0; k < seeds.length; k++) {
      ep[k * 3 + 1] += dt * (2 + seeds[k] * 5);
      ep[k * 3] += Math.sin(time * 1.3 + seeds[k] * 20) * dt * 0.8;
      if (ep[k * 3 + 1] > -R + 34) { ep[k * 3 + 1] = -R + 2; ep[k * 3] = (Math.random() - 0.5) * 18; }
    }
    embers.geometry.attributes.position.needsUpdate = true;
  }


  // ---------- เครื่องหมายจุดปะทะ ----------
  const swordTex = keep(canvasTex(128, 128, (g) => {
    g.translate(64, 64);
    for (const a of [-0.78, 0.78]) {
      g.save(); g.rotate(a);
      g.fillStyle = "#ffffff"; g.strokeStyle = "rgba(255,45,85,.95)"; g.lineWidth = 4;
      g.beginPath(); g.moveTo(-5, -52); g.lineTo(5, -52); g.lineTo(5, 26); g.lineTo(0, 34); g.lineTo(-5, 26); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = "#ff2d55"; g.fillRect(-14, 24, 28, 7); g.fillRect(-4, 31, 8, 18);
      g.restore();
    }
  }));
  const fightMarks = new T.Group(); scene.add(fightMarks);
  const markRingGeo = keep(new T.RingGeometry(3.4, 4.3, 6)); markRingGeo.rotateX(-Math.PI / 2);
  function setFightMarks(fights) {
    for (const c of [...fightMarks.children]) { fightMarks.remove(c); c.traverse((o) => o.material?.dispose?.()); }
    for (const f of fights || []) {
      const g = new T.Group();
      const n = nodeWorld(f.node);
      placeOn(g, n.th, n.z, 0, Math.PI / 6);
      const ring = new T.Mesh(markRingGeo, new T.MeshBasicMaterial({ color: 0xff2d55, transparent: true, depthWrite: false }));
      ring.position.y = 0.5; g.add(ring);
      const sw = new T.Sprite(new T.SpriteMaterial({ map: swordTex, transparent: true, depthWrite: false, depthTest: false }));
      sw.renderOrder = 9; sw.position.y = 11; sw.scale.setScalar(4.2); g.add(sw);
      g.userData = { ring, sw };
      fightMarks.add(g);
    }
  }
  function updateFightMarks() {
    const k = Math.min(2.4, Math.max(1, camDist / 110));
    for (const g of fightMarks.children) {
      const { ring, sw } = g.userData;
      ring.material.opacity = 0.55 + 0.45 * Math.sin(time * 6);
      ring.scale.setScalar(1 + 0.08 * Math.sin(time * 6));
      sw.scale.setScalar(4.2 * k * (1 + 0.06 * Math.sin(time * 5)));
      sw.position.y = 11 * k;
    }
  }


  // ---------- กลางวัน / กลางคืน ----------
  const hemi = scene.children.find((o) => o.isHemisphereLight);
  let nightK = 0, nightTarget = 0;
  const skyNight = new T.Color("#141b33");
  const nightMotes = motes(Z0 + 10, L, 700, "rgba(200,220,255,.85)", 1.2);
  nightMotes.material.opacity = 0;
  function setNight(on) { nightTarget = on ? 1 : 0; dirty = true; }
  function updateNight(dt) {
    nightK += (nightTarget - nightK) * (1 - Math.exp(-dt * 1.5));
    hemi.intensity = lerp(1.35, 0.42, nightK);
    hemi.color.setRGB(lerp(0.95, 0.55, nightK), lerp(0.97, 0.62, nightK), 1);
    sun.intensity = lerp(2.0, 0.55, nightK);
    sun.color.setRGB(lerp(1, 0.62, nightK), lerp(0.95, 0.72, nightK), 1);
    under.intensity = lerp(0.6, 0.25, nightK);
    nightMotes.material.opacity = nightK * (0.55 + 0.35 * Math.sin(time * 2.3));
    renderer.toneMappingExposure = lerp(1.0, 1.15, nightK);
  }



  // ======================================================
  //  กระดาน (มาจาก server ทั้งก้อน): ช่อง = แผ่นหินหกเหลี่ยม · เส้นทาง = แถบดิน · ช่องกิจกรรม = ป้ายสัญลักษณ์
  // ======================================================
  let BOARD = null;
  const boardGroup = new T.Group(); scene.add(boardGroup);
  const TILE_COL = { gold: "#f2c94c", back: "#e06a5a", stop: "#8a8f9c", heal: "#5fd38a", skill: "#a48cff", item: "#ff9f43", warp: "#4fc3f7", reroll: "#ffffff", lure: "#d92b4b", region: "#ffd98a" };
  const TILE_GLYPH = { gold: "💰", back: "↩️", stop: "⛓️", heal: "💚", skill: "✨", item: "🎁", warp: "🌀", reroll: "🎲", lure: "🩸" };
  const REGION_GLYPH = ["🗿", "🌊", "🌑", "🪨", "👑"];
  const iconCache = {};
  function iconTex(key, glyph, col) {
    if (iconCache[key]) return iconCache[key];
    iconCache[key] = keep(canvasTex(128, 128, (g) => {
      g.shadowColor = "rgba(0,0,0,.35)"; g.shadowBlur = 8;
      g.fillStyle = "rgba(255,255,255,.95)"; g.beginPath(); g.arc(64, 64, 52, 0, Math.PI * 2); g.fill();
      g.shadowBlur = 0;
      g.lineWidth = 8; g.strokeStyle = col; g.stroke();
      g.font = '64px "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
      g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText(glyph, 64, 70);
    }));
    return iconCache[key];
  }
  const iconGeo = keep(new T.PlaneGeometry(3.4, 3.4)); iconGeo.rotateX(-Math.PI / 2); iconGeo.rotateY(Math.PI);
  function nodeWorld(id) { return BOARD && BOARD.nodes[id] ? BOARD.nodes[id] : { th: pathCenter(zOf(0)), z: zOf(0), prog: 0 }; }
  function setBoard(b) {
    if (!b || BOARD) return;
    const nodes = {};
    for (const n of b.nodes) {
      const z = zOf(n.prog);
      nodes[n.id] = { ...n, z, th: pathCenter(z) + n.lane };
    }
    BOARD = { ...b, nodes };
    const list = Object.values(nodes);
    // แผ่นหินช่องเดิน
    const geo = keep(new T.CylinderGeometry(2.4, 2.6, 0.5, 6)); geo.translate(0, 0.1, 0);
    const mesh = new T.InstancedMesh(geo, crystalize(new T.MeshStandardMaterial({ roughness: 0.85, flatShading: true })), list.length);
    const o = new T.Object3D(), c = new T.Color(), white = new T.Color(0xffffff);
    list.forEach((n, i) => {
      placeOn(o, n.th, n.z, 0, Math.PI / 6);
      const fork = n.next.length > 1;
      o.scale.setScalar(n.id === b.gate ? 2.2 : fork ? 1.3 : 1);
      o.updateMatrix(); mesh.setMatrixAt(i, o.matrix);
      if (n.tile) c.set(TILE_COL[n.tile]).lerp(white, 0.35);
      else c.copy(REG[n.region].path).lerp(white, fork ? 0.6 : 0.3);
      mesh.setColorAt(i, c);
    });
    boardGroup.add(mesh);
    // แถบดินเชื่อมช่อง (ทางเดิน)
    const verts = [], cols = [], idx = [];
    let v = 0;
    const dirt = new T.Color();
    for (const a of list) {
      for (const nid of a.next) {
        const bn = nodes[nid];
        const seg = 5;
        for (let k = 0; k < seg; k++) {
          const u0 = k / seg, u1 = (k + 1) / seg;
          const th0 = lerp(a.th, bn.th, u0), z0 = lerp(a.z, bn.z, u0), th1 = lerp(a.th, bn.th, u1), z1 = lerp(a.z, bn.z, u1);
          const w = 1.25 / R;
          const pA = surfPoint(th0 - w, z0, 0.06), pB = surfPoint(th0 + w, z0, 0.06), pC = surfPoint(th1 - w, z1, 0.06), pD = surfPoint(th1 + w, z1, 0.06);
          verts.push(pA.x, pA.y, pA.z, pB.x, pB.y, pB.z, pC.x, pC.y, pC.z, pD.x, pD.y, pD.z);
          dirt.copy(REG[a.region].path).multiplyScalar(a.kind === "secret" ? 0.75 : 0.92);
          for (let q = 0; q < 4; q++) cols.push(dirt.r, dirt.g, dirt.b);
          idx.push(v, v + 2, v + 1, v + 1, v + 2, v + 3); v += 4;
        }
      }
    }
    const rg = keep(new T.BufferGeometry());
    rg.setAttribute("position", new T.Float32BufferAttribute(verts, 3));
    rg.setAttribute("color", new T.Float32BufferAttribute(cols, 3));
    rg.setIndex(idx); rg.computeVertexNormals();
    boardGroup.add(new T.Mesh(rg, crystalize(new T.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: T.DoubleSide }))));
    // ป้ายสัญลักษณ์ช่องกิจกรรม
    for (const n of list) {
      if (!n.tile) continue;
      const key = n.tile === "region" ? `r${n.region}` : n.tile;
      const tex = iconTex(key, n.tile === "region" ? REGION_GLYPH[n.region] : TILE_GLYPH[n.tile], TILE_COL[n.tile]);
      // ป้ายแปะราบบนแผ่นหิน (หมากยืนทับได้ ไม่บังหน้าหมาก)
      const decal = new T.Mesh(iconGeo, new T.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
      const g = new T.Group();
      placeOn(g, n.th, n.z, 0);
      decal.position.y = 0.38;
      g.add(decal);
      boardGroup.add(g);
    }
    dirty = true;
  }

  // ======================================================
  //  ผู้เล่น — หมากหกเหลี่ยม · แต่ละคนมีคิวการเดินของตัวเอง (ทอยพร้อมกัน ต่างคนต่างเดิน)
  // ======================================================
  const players = {};
  const ringGeo = keep(new T.RingGeometry(1.6, 2.1, 6)); ringGeo.rotateX(-Math.PI / 2);
  const blobGeo = keep(new T.CircleGeometry(1.7, 20)); blobGeo.rotateX(-Math.PI / 2);
  const blobMat = keep(new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }));
  const encGeo = keep(new T.OctahedronGeometry(1, 0));
  function makePlayer(p) {
    const g = new T.Group();
    const blob = new T.Mesh(blobGeo, blobMat); blob.position.y = 0.42; g.add(blob);
    const ring = new T.Mesh(ringGeo, new T.MeshBasicMaterial({ color: new T.Color(p.color || "#ffffff"), transparent: true, opacity: 0.9, depthWrite: false }));
    ring.position.y = 0.45; g.add(ring);
    const body = new T.Group(); g.add(body);
    const cv = document.createElement("canvas"); cv.width = 256; cv.height = 296;
    const tex = new T.CanvasTexture(cv); tex.colorSpace = T.SRGBColorSpace;
    const spr = new T.Sprite(new T.SpriteMaterial({ map: tex, depthWrite: false }));
    spr.scale.set(3.6, 4.15, 1); spr.position.y = 2.9; body.add(spr);
    const lab = new T.Sprite(new T.SpriteMaterial({ map: labelTex(p.name || ""), depthWrite: false }));
    lab.scale.set(5.6, 1.4, 1); lab.position.y = 5.9; body.add(lab);
    const encase = new T.Group();
    for (let k = 0; k < 7; k++) {
      const c = new T.Mesh(encGeo, crystalMat);
      c.scale.set(0.7, 2 + (k % 3) * 0.7, 0.7);
      c.position.set(Math.cos(k * 0.9) * 1.4, 1.6, Math.sin(k * 0.9) * 1.4);
      c.rotation.set(Math.sin(k) * 0.5, k, Math.cos(k) * 0.5); encase.add(c);
    }
    encase.visible = false; g.add(encase);
    scene.add(g);
    const nw = nodeWorld(p.node);
    const P = { g, body, spr, cv, tex, lab, ring, encase, data: p, node: p.node, th: nw.th, z: nw.z, hop: 0, lane: 0, queue: [], seg: null, lastWalkSeq: null, lastRollSeq: null, lostShown: null, img: null, imgSrc: null, scale: 1, diceSprs: [] };
    redrawToken(P);
    return P;
  }
  function redrawToken(P) {
    const p = P.data;
    if (p.img && p.img !== P.imgSrc) {
      P.imgSrc = p.img;
      const im = new Image(); im.crossOrigin = "anonymous";
      im.onload = () => { if (P.imgSrc === p.img) { P.img = im; redrawToken(P); dirty = true; } };
      im.src = p.img;
    }
    const ini = (p.name || "?").replace(/^[เ-ไ]/, "").charAt(0) || "?";
    drawToken(P.cv.getContext("2d"), { color: p.color, ini, img: P.img, lost: !!p.lost });
    P.tex.needsUpdate = true;
  }
  function setLost(P, lost) {
    if (lost === P.lostShown) return;
    P.lostShown = lost;
    P.data = { ...P.data, lost };
    redrawToken(P);
    // LOST DATA: ตัวหมากแตกกระจาย (ฉากระเบิด) เหลือแต่กองผลึก
    P.encase.visible = lost; P.ring.visible = !lost; P.body.visible = !lost;
  }
  function removeMissing(list) {
    const ids = new Set(list.map((p) => p.id));
    for (const id of Object.keys(players)) {
      if (ids.has(id)) continue;
      const P = players[id];
      scene.remove(P.g); P.tex.dispose(); P.spr.material.dispose(); P.lab.material.map.dispose(); P.lab.material.dispose(); P.ring.material.dispose();
      delete players[id];
    }
  }
  function snapPlayer(P, nodeId) {
    const nw = nodeWorld(nodeId);
    P.node = nodeId; P.th = nw.th; P.z = nw.z; P.hop = 0; P.queue = []; P.seg = null; P.scale = 1;
  }
  function clearDiceOf(P) { for (const s of P.diceSprs) { P.body.remove(s); s.material.dispose(); } P.diceSprs = []; }

  // ======================================================
  //  สถานะจาก server → คิวอนิเมชัน
  // ======================================================
  let state = { players: [], ort: null, walks: {}, rolls: {}, me: null };
  let ortCur = -3, ortHop = 0, crystalZ = -80;
  let busy = false;
  function sync(s, { instant = false } = {}) {
    state = s;
    removeMissing(s.players);
    for (const p of s.players) {
      let P = players[p.id];
      const fresh = !P;
      if (!P) P = players[p.id] = makePlayer(p);
      const prev = P.data;
      P.data = { ...p, lost: P.lostShown ?? p.lost };
      if (prev.img !== p.img || prev.color !== p.color) redrawToken(P);
      const walks = (s.walks && s.walks[p.id]) || [];
      const roll = s.rolls && s.rolls[p.id];
      if (fresh || instant || P.lastWalkSeq == null) {
        P.lastWalkSeq = Math.max(0, ...walks.map((w) => w.seq));
        P.lastRollSeq = roll ? roll.seq : 0;
        snapPlayer(P, p.node);
      } else {
        if (roll && roll.seq > (P.lastRollSeq || 0)) {
          P.lastRollSeq = roll.seq;
          P.queue.push({ kind: "dice", dice: roll.dice, total: roll.total });
        }
        for (const w of walks) {
          if (w.seq <= P.lastWalkSeq) continue;
          P.lastWalkSeq = w.seq;
          P.queue.push({ kind: w.kind, path: w.path });
        }
        // ไม่มีอะไรค้างแต่ตำแหน่งไม่ตรง (เช่นถอยหลังจากการปะทะ / ต่อเข้ากลางเกม) = ไปที่ช่องจริง
        if (!P.seg && !P.queue.length && P.node !== p.node && !busy) snapPlayer(P, p.node);
      }
      if (!busy) setLost(P, !!p.lost);
      P.finished = !!p.finished;
    }
    if (!busy) {
      ort.visible = s.ort != null; crystalCut.visible = s.ort != null; rift.visible = s.ort == null;
      ortCur = s.ort == null ? -3 : s.ort;
      crystalZ = s.ort == null ? -80 : zOf(s.ort) + 3;
    }
    dirty = true;
  }
  // อนิเมชันของหมากแต่ละตัว (ไม่บล็อกกัน)
  function stepPlayer(P, dt) {
    if (!P.seg) {
      if (!P.queue.length) return;
      P.seg = P.queue.shift(); P.seg.t = 0;
      P.seg.start = { th: P.th, z: P.z, node: P.node };
      if (P.seg.kind === "dice") { clearDiceOf(P); showDiceOn(P, P.seg.dice); }
    }
    const sg = P.seg;
    sg.t += dt;
    if (sg.kind === "dice") {
      if (sg.t >= 1.15) P.seg = null;
      return;
    }
    if (sg.kind === "warp" || sg.kind === "swap") {
      const u = Math.min(1, sg.t / 0.8);
      if (u < 0.45) P.scale = 1 - u / 0.45;
      else {
        if (P.node !== sg.path[sg.path.length - 1]) { const nw = nodeWorld(sg.path[sg.path.length - 1]); P.node = nw.id; P.th = nw.th; P.z = nw.z; }
        P.scale = (u - 0.45) / 0.55;
      }
      if (u >= 1) { P.scale = 1; P.seg = null; }
      return;
    }
    const n = sg.path.length;
    const per = sg.kind === "back" ? WALK_STEP * 0.8 : WALK_STEP;
    const x = Math.min(n, sg.t / per);
    const k = Math.min(n - 1, Math.floor(x)), f = x - k;
    const from = k === 0 ? sg.start : nodeWorld(sg.path[k - 1]);
    const to = nodeWorld(sg.path[k]);
    const e = ease(Math.min(1, f));
    P.th = lerp(from.th, to.th, e); P.z = lerp(from.z, to.z, e);
    P.hop = Math.sin(Math.min(1, f) * Math.PI) * (sg.kind === "back" ? 0.8 : 1.7);
    const prevNode = P.node;
    if (f > 0.5) P.node = sg.path[k];
    if (prevNode !== P.node) {
      const ra = nodeWorld(prevNode).region, rb = nodeWorld(P.node).region;
      if (ra != null && rb != null && rb !== ra) opts.onRegion?.(rb, P.data.name);
    }
    if (x >= n) { P.node = sg.path[n - 1]; P.th = to.th; P.z = to.z; P.hop = 0; P.seg = null; }
  }
  function walking() { return Object.values(players).some((P) => P.seg || P.queue.length); }


  // ลูกเต๋าลอยเหนือหมาก (1 หรือ 2 ลูก) — หมุนแล้วหยุดที่แต้มจริง ค้างไว้จนจบการเดิน
  function showDiceOn(P, dice) {
    dice.forEach((val, i) => {
      const spr = new T.Sprite(new T.SpriteMaterial({ map: diceTex[1], depthWrite: false, depthTest: false, transparent: true }));
      spr.renderOrder = 10;
      const ox = (i - (dice.length - 1) / 2) * 3.2;
      spr.position.set(ox, 8.6, 0);
      P.body.add(spr);
      P.diceSprs.push(spr);
      let flip = 0;
      addFx(1.1, (u, dt) => {
        const land = 0.7;
        if (u < land) {
          flip += dt;
          if (flip > 0.07) { flip = 0; spr.material.map = diceTex[1 + ((Math.random() * 6) | 0)]; }
          const k = u / land;
          spr.position.y = 8.6 + Math.sin(k * Math.PI * 3) * (1 - k) * 2.4;
          spr.material.rotation = (1 - k) * 9;
          spr.scale.setScalar(2.2 + Math.sin(k * Math.PI) * 0.7);
        } else {
          spr.material.map = diceTex[val];
          spr.material.rotation = 0;
          spr.scale.setScalar(2.6 + Math.sin(Math.min(1, ((u - land) / (1 - land)) * 2.5) * Math.PI) * 1.0);
          spr.position.y = 8.6;
        }
      });
    });
    // เก็บลูกเต๋าหลังเดินจบสักพัก
    addFx(5, () => {}, () => { if (P.diceSprs.length && !P.seg && !P.queue.length) clearDiceOf(P); });
  }

  // ---------- อนิเมชันแบบลำดับ (ฉากเปิด / ฉาก ORT / ซูมเข้าปะทะ) ----------
  const anims = [];
  const animate = (dur, fn) => new Promise((res) => { anims.push({ t: 0, dur, fn, res }); });
  const wait = (sec) => animate(sec, () => {});
  let token = 0;
  let latest = null; // สถานะล่าสุดจาก server ระหว่างฉากที่กำหนดเอง (ใช้ต่อเมื่อฉากจบ)
  function cancelAll() { token++; for (const a of anims.splice(0)) a.res(); }

  // ======================================================
  //  กล้อง — ท่า = { pos, look, dist }
  //   follow: ตามหมากของเรา (มุมบุคคลที่สาม ใกล้หมาก) · scripted: ฉากที่กำหนดเอง
  // ======================================================
  const cam = { pos: new T.Vector3(0, -R + 20, -40), look: new T.Vector3(0, -R + 3, 40) };
  let camDist = 40, camMode = "follow";
  const tmpV = new T.Vector3();
  function pointAt(th, z, lift = 0) { return surfPoint(th, z, lift); } // lift บวก = ขึ้นจากพื้น (เข้าหาแกนท่อ)
  function poseLook(look, el, az, dist) {
    const a = az * Math.PI / 180;
    // ใกล้ปากท่อ: กล้องห้ามถอยไปหลังฝาปิดท่อ — ยกมุมกล้องขึ้นแทน
    for (; ;) {
      const e = el * Math.PI / 180;
      const off = new T.Vector3(Math.cos(e) * Math.cos(a), Math.sin(e), Math.cos(e) * Math.sin(a)).multiplyScalar(dist);
      if (look.z + off.z >= Z0 + 4 || el >= 84) return { pos: look.clone().add(off), look: look.clone(), dist };
      el += 2;
    }
  }
  function focusPlayer() {
    const me = state.me && players[state.me];
    if (me && !me.lostShown && !me.finished) return me;
    // เราตกรอบ/เข้าเส้นชัยแล้ว: ตามคนที่ยังเล่นอยู่ที่นำหน้าสุด
    const live = Object.values(players).filter((P) => !P.lostShown && !P.finished);
    if (!live.length) return me || null;
    return live.sort((a, b) => b.z - a.z)[0];
  }
  function followPose() {
    const P = focusPlayer();
    if (!P) return poseLook(new T.Vector3(0, -R + 4, zOf(0)), 50, 200, 120);
    // ทางแยก: ยกกล้องขึ้นให้เห็นทุกเส้นทาง · กำลังเดิน: มุมบุคคลที่สามหลังหมาก · ยืนนิ่ง: ใกล้หมาก เยื้องข้างเล็กน้อย
    if (P.data.choices && !P.seg && !P.queue.length) return poseLook(pointAt(P.th, P.z + 26, 1), 48, 252, 125);
    if (P.seg && P.seg.kind !== "dice") return poseLook(pointAt(P.th, P.z + 12, 2.4), 21, 264, 56);
    return poseLook(pointAt(P.th, P.z + 8, 2.2), 31, 252, 72);
  }
  function nodeView(nodeId) { const n = nodeWorld(nodeId); return poseLook(pointAt(n.th, n.z, 1), 50, 222, 60); }
  function camTo(target, dur, lift = 0) {
    const from = { pos: cam.pos.clone(), look: cam.look.clone(), dist: camDist };
    return animate(dur, (u) => {
      const e = ease(u);
      cam.pos.lerpVectors(from.pos, target.pos, e);
      cam.pos.y += Math.sin(e * Math.PI) * lift;
      cam.look.lerpVectors(from.look, target.look, e);
      camDist = lerp(from.dist, target.dist || from.dist, e);
    });
  }
  function snapTo(p) { cam.pos.copy(p.pos); cam.look.copy(p.look); camDist = p.dist || camDist; dirty = true; }
  // จุดบนจอของช่อง (ปุ่มเลือกทางแยก)
  function project(nodeId, ahead = 0) {
    // ahead = เดินต่อตามทางนั้นอีกกี่ช่อง (ปุ่มเลือกทางแยกวางห่างกันพอ)
    let id = nodeId;
    for (let k = 0; k < ahead && BOARD?.nodes[id]?.next?.length; k++) id = BOARD.nodes[id].next[0];
    const n = nodeWorld(id);
    tmpV.copy(pointAt(n.th, n.z, 1.5)).project(camera);
    const w = canvas.clientWidth, h = canvas.clientHeight;
    return { x: (tmpV.x * 0.5 + 0.5) * w, y: (-tmpV.y * 0.5 + 0.5) * h, visible: tmpV.z < 1 };
  }

  // ======================================================
  //  ฉากเปิด: เริ่มที่ปลายท่อ (ประตูผนึก) มองย้อนเข้าหาปากท่อ → ไถลผ่านผู้เล่นไปจนถึงจุดเกิด ORT
  //           → หันกลับไปมองผู้เล่น → ครึ่งบนของท่อเปิดออก กล้องลงมาหาหมากของเรา
  // ======================================================
  function playIntro(s) {
    cancelAll(); const my = token;
    busy = true; camMode = "scripted"; latest = s;
    sync(s, { instant: true });
    setFightMarks([]);
    upper.visible = true; cutParts.visible = false;
    clip.constant = R + 30;
    const axisY = -R * 0.38;
    const startZ = Z1 - 22, endZ = Z0 + 14;
    snapTo({ pos: new T.Vector3(0, axisY, startZ), look: new T.Vector3(0, axisY - 4, startZ - 200), dist: 120 });
    const go = (fn) => () => (my === token ? fn() : null);
    return animate(5.4, (u) => {
      const e = ease(u);
      const z = lerp(startZ, endZ, e);
      cam.pos.set(Math.sin(u * Math.PI) * 8, axisY - Math.sin(u * Math.PI) * 6, z);
      cam.look.set(0, axisY - 8, z - 160);
    })
      .then(go(() => {
        // หันกลับไปมองผู้เล่น (หมุนทิศมองครึ่งรอบรอบแกนตั้ง — เห็นการหันจริง)
        const from = cam.look.clone();
        const st0 = nodeWorld("m0");
        const to = pointAt(st0.th, st0.z + 6, 3);
        const pos0 = cam.pos.clone(), pos1 = new T.Vector3(0, -R + 16, Z0 + 2);
        const dirFrom = from.clone().sub(pos0).normalize(), dirTo = to.clone().sub(pos1).normalize();
        const yawFrom = Math.atan2(dirFrom.x, dirFrom.z), yawTo = yawFrom + Math.PI;
        return animate(1.8, (u) => {
          const e = ease(u);
          const yaw = lerp(yawFrom, yawTo, e);
          const pitch = lerp(Math.asin(dirFrom.y), Math.asin(dirTo.y), e);
          cam.pos.lerpVectors(pos0, pos1, e);
          cam.look.set(cam.pos.x + Math.sin(yaw) * Math.cos(pitch) * 60, cam.pos.y + Math.sin(pitch) * 60, cam.pos.z + Math.cos(yaw) * Math.cos(pitch) * 60);
        });
      }))
      .then(go(() => wait(0.6)))
      .then(go(() => {
        const from = { pos: cam.pos.clone(), look: cam.look.clone() };
        const to = followPose();
        return animate(3.2, (u) => {
          const e = ease(u);
          cam.pos.lerpVectors(from.pos, to.pos, e);
          cam.pos.y += Math.sin(e * Math.PI) * 30;
          cam.look.lerpVectors(from.look, to.look, e);
          camDist = lerp(120, to.dist, e);
          clip.constant = lerp(R + 30, CUT, smooth(0.1, 0.8, u));
          if (u >= 1) { upper.visible = false; cutParts.visible = true; clip.constant = CUT; }
        });
      }))
      .then(() => { upper.visible = false; cutParts.visible = true; clip.constant = CUT; if (my === token) { busy = false; camMode = "follow"; sync(latest); } });
  }

  // ======================================================
  //  ฉาก ORT: กล้องลงระดับพื้นข้างหมาก มอง ORT จากมุมของหมาก → ORT ทอยเต๋า (ทุกคนเห็นแต้ม) → เดิน/โผล่
  //           → ระเบิดคนที่ถูกกิน → กล้องกลับขึ้นมาที่กระดาน → ปักดาบไขว้ที่จุดปะทะ   (รวม ortSceneSeconds)
  // ======================================================
  function playOrt(next, scene) {
    cancelAll(); const my = token;
    busy = true; camMode = "scripted"; latest = next;
    setFightMarks([]);
    sync({ ...next, ort: scene.ortFrom ?? null, players: next.players.map((p) => ({ ...p, lost: p.lost && !(scene.caught || []).includes(p.id) })) });
    for (const P of Object.values(players)) { P.queue = []; P.seg = null; snapPlayer(P, P.data.node); clearDiceOf(P); }
    ort.visible = scene.ortFrom != null; crystalCut.visible = scene.ortFrom != null; rift.visible = scene.ortFrom == null;
    ortCur = scene.ortFrom == null ? -3 : scene.ortFrom;
    crystalZ = scene.ortFrom == null ? -80 : zOf(scene.ortFrom) + 3;
    // หมากที่ใกล้ ORT ที่สุด (ยังเล่นอยู่) — มอง ORT จากมุมของหมากตัวนี้
    const live = Object.values(players).filter((P) => !P.lostShown && !P.finished);
    const near = live.sort((a, b) => a.z - b.z)[0] || focusPlayer();
    const eyeTh = near ? near.th : pathCenter(zOf(0)), eyeZ = near ? near.z : zOf(0);
    const ortZ = (v) => (v == null ? Z0 + 4 : zOf(v) - 3);
    // ข้ามไหล่หมาก: กล้องอยู่หน้าหมากเยื้องข้าง ระดับสายตา หันกลับไปหา ORT (หมากอยู่มุมล่างของภาพ)
    const groundPose = (oz) => ({ pos: pointAt(eyeTh + 0.1, eyeZ + 15, 4.5), look: pointAt(pathCenter(oz), oz, 6), dist: 40 });
    const go = (fn) => () => (my === token ? fn() : null);
    let chain = camTo(groundPose(ortZ(scene.ortFrom)), T_ORT_CAM, 6);
    if (scene.ortFrom == null) {
      chain = chain.then(go(() => {
        ortCur = scene.ortTo; ortHop = -14;
        let shown = false;
        return animate(T_ORT_ARRIVE, (u) => {
          if (!shown && u > 0.25) { shown = true; ort.visible = true; crystalCut.visible = true; rift.visible = false; explodeAt(new T.Vector3(0, -R + 14, Z0 + 4)); }
          ortHop = (1 - ease(smooth(0.25, 0.75, u))) * -14;
          crystalZ = lerp(-80, zOf(scene.ortTo) + 3, smooth(0.35, 1, u));
        });
      }));
    } else {
      chain = chain.then(go(() => { opts.onOrtDice?.(scene.roll); showOrtDice(scene.die); return wait(T_ORT_DICE); }));
      const a = scene.ortFrom, b = scene.ortTo, n = b - a;
      chain = chain.then(go(() => {
        const look0 = cam.look.clone();
        return animate(n * T_ORT_STEP, (u) => {
          const x = u * n, k = Math.min(n - 1, Math.floor(x)), f = x - k;
          ortCur = a + k + ease(f); ortHop = Math.sin(f * Math.PI) * 1.4;
          crystalZ = zOf(ortCur) + 3;
          // กล้องหันตาม ORT ที่คืบเข้ามา
          const oz = zOf(ortCur) - 3;
          cam.look.lerpVectors(look0, pointAt(pathCenter(oz), oz, 5), Math.min(1, u * 1.2));
          if (u >= 1) { ortCur = b; ortHop = 0; }
        });
      })).then(go(() => wait(T_AFTER_ORT)));
    }
    if ((scene.caught || []).length) {
      chain = chain.then(go(() => {
        for (const id of scene.caught) { const P = players[id]; if (P) { explode(P); setLost(P, true); } }
        const names = scene.caught.map((id) => players[id]?.data.name).filter(Boolean);
        if (names.length) opts.onLost?.(names);
        return wait(T_BOOM);
      }));
    }
    chain = chain.then(go(() => camTo(followPose(), T_BACK, 8)));
    if ((scene.fights || []).length) chain = chain.then(go(() => { setFightMarks(scene.fights); return wait(T_FIGHT_MARK); }));
    return chain.then(go(() => wait(T_END)))
      .then(() => { if (my === token) { busy = false; camMode = "follow"; sync(latest); } });
  }
  // ลูกเต๋าของ ORT (ลอยเหนือ ORT ให้ทุกคนเห็นแต้ม)
  function showOrtDice(die) {
    const spr = new T.Sprite(new T.SpriteMaterial({ map: diceTex[1], depthWrite: false, depthTest: false, transparent: true }));
    spr.renderOrder = 11;
    ort.add(spr);
    const face = Math.max(1, Math.min(6, die || 1));
    let flip = 0;
    addFx(T_ORT_DICE + 1.2, (u, dt) => {
      const tt = u * (T_ORT_DICE + 1.2);
      if (tt < 1.0) {
        flip += dt;
        if (flip > 0.07) { flip = 0; spr.material.map = diceTex[1 + ((Math.random() * 6) | 0)]; }
        spr.material.rotation = (1 - tt) * 10;
        spr.position.y = 16 + Math.sin(tt * Math.PI * 3) * (1 - tt) * 3;
        spr.scale.setScalar(4 + Math.sin(tt * Math.PI) * 1.2);
      } else {
        spr.material.map = diceTex[face];
        spr.material.rotation = 0;
        spr.position.y = 16;
        spr.scale.setScalar(5);
        spr.material.opacity = tt > T_ORT_DICE + 0.6 ? 1 - (tt - T_ORT_DICE - 0.6) / 0.6 : 1;
      }
    }, () => { ort.remove(spr); spr.material.dispose(); });
  }
  // ระเบิดเล็กไม่ผูกกับตัวหมาก (ORT ผุดจากรอยแยก)
  function explodeAt(pos) {
    explode({ spr: { getWorldPosition: (v) => v.copy(pos) }, g: { position: pos.clone(), quaternion: new T.Quaternion() } });
  }

  // ======================================================
  //  ซูมเข้าช่องปะทะ (server พัก 3 วิ): บินลงไปที่ช่อง → แฟลชขาว (PurgeStage) → สนามของภูมิภาคขึ้นแทน
  // ======================================================
  function playFight(st, scene) {
    cancelAll(); const my = token;
    busy = true; camMode = "scripted"; latest = st;
    sync(st);
    setFightMarks([{ node: scene.node }]);
    return camTo(nodeView(scene.node), FIGHT_ZOOM_SECONDS, 16)
      .then(() => { if (my === token) { busy = false; sync(latest); } });
  }
  // กลับจากสนามประลอง: เริ่มที่ช่องปะทะแล้วถอยกลับมาตามหมากของเรา
  function returnFromFight(nodeId) {
    setFightMarks([]);
    if (nodeId) snapTo(nodeView(nodeId));
    camMode = "follow";
  }

  // ---------- loop (วาดเมื่อจำเป็น) ----------
  let dirty = true, dead = false, paused = false, raf = 0, last = performance.now(), idleAcc = 0, time = 0;
  const skyTarget = new T.Color();
  function resize() {
    const w = canvas.clientWidth || canvas.width, h = canvas.clientHeight || canvas.height;
    if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); dirty = true;
  }
  function update(dt, raw = dt) {
    time += dt;
    U.uTime.value = time;
    // ฉากที่กำหนดเอง (กล้อง/ORT) เดินตามเวลาจริง — เครื่องช้ายังจบทันเวลาที่ server พักเกมไว้
    const adt = Math.min(1, raw);
    for (let a = anims.length - 1; a >= 0; a--) {
      const an = anims[a]; an.t += adt;
      const u = Math.min(1, an.t / an.dur); an.fn(u);
      if (u >= 1) { anims.splice(a, 1); an.res(); }
    }
    for (let i = fx.length - 1; i >= 0; i--) {
      const f = fx[i]; f.t += dt;
      const u = Math.min(1, f.t / f.dur); f.fn(u, dt);
      if (u >= 1) { fx.splice(i, 1); f.end?.(); }
    }
    if (ort.visible) {
      const oz = zOf(ortCur) - 3;
      placeOn(ort, pathCenter(oz), oz, 0);
      ort.position.y += ortHop;
      const ko = Math.min(1.9, Math.max(0.6, camDist / 120));
      ortSpr.scale.set(9 * ko, 10.4 * ko, 1);
      ortSpr.position.y = 6.4 * ko + Math.sin(time * 2.2) * 0.25;
      ortRing.scale.setScalar(1 + 0.06 * Math.sin(time * 4));
    }
    U.uCrystal.value = crystalZ;
    updateRift(dt);
    updateFightMarks();
    updateNight(dt);
    // หมาก: เดินตามคิว + จัดวงคนที่ยืนช่องเดียวกัน
    const ks = Math.min(2.2, Math.max(0.7, camDist / 60));
    const lanes = {};
    for (const id of Object.keys(players)) {
      const P = players[id];
      stepPlayer(P, dt);
      const p = P.data;
      const resting = !P.seg;
      let la = 0, lr = 0;
      if (resting && !P.lostShown) {
        const k = lanes[P.node] || 0; lanes[P.node] = k + 1;
        if (k) { la = (k - 1) * Math.PI * 2 / 6 + Math.PI / 6; lr = 2.8; }
      }
      const lz = P.z + Math.sin(la) * lr;
      placeOn(P.g, P.th + Math.cos(la) * lr / R, lz, 0);
      P.body.position.y = P.hop * ks; P.body.scale.setScalar(ks * P.scale);
      const prog = nodeWorld(P.node).prog || 0;
      const danger = !p.lost && !P.finished && state.ort != null && prog - state.ort <= 7;
      P.ring.material.color.set(danger ? "#ff2d55" : (p.color || "#ffffff"));
      P.ring.material.opacity = danger ? 0.55 + 0.45 * Math.sin(time * 7) : 0.9;
      P.spr.position.y = 2.9 + Math.sin(time * 2 + P.lane) * 0.1;
    }
    fireflies.material.opacity = (0.6 + 0.4 * Math.sin(time * 3)) * (0.5 + nightK * 0.5);
    for (const m of waterMats) m.map.offset.y -= dt * 1.4;
    if (camMode === "follow" && !busy) {
      const t = followPose(), k = 1 - Math.exp(-dt * 3.2);
      cam.pos.lerp(t.pos, k); cam.look.lerp(t.look, k); camDist = lerp(camDist, t.dist, k);
    }
    // กันพลาด: ค่ากล้อง/สีฟ้าเพี้ยน (NaN) → กลับมุมตามหมาก ไม่ปล่อยจอว่าง
    if (!Number.isFinite(cam.pos.x + cam.pos.y + cam.pos.z + cam.look.x + cam.look.y + cam.look.z + camDist)) snapTo(followPose());
    if (![skyCol.r, skyCol.g, skyCol.b].every((v) => Number.isFinite(v) && v >= 0 && v <= 2)) skyCol.copy(REG[0].sky);
    camera.position.copy(cam.pos);
    camera.lookAt(cam.look);
    scene.fog.near = camDist * 1.2 + 30; scene.fog.far = camDist * 3 + 260;
    const m = regMix(cam.look.z); mixC(skyTarget, REG[m.a].sky, REG[m.b].sky, m.t);
    skyTarget.lerp(skyNight, nightK * 0.9);
    skyCol.lerp(skyTarget, 1 - Math.exp(-dt * 2)); scene.fog.color.copy(skyCol);
  }
  function frame(now) {
    if (dead) return;
    raf = requestAnimationFrame(frame);
    if (document.hidden || paused) { last = now; return; }
    // เวลาจริง (เพดาน 0.25 วิ) — เครื่องที่เฟรมตกยังจบอนิเมชันทันเวลาที่ server พักเกมไว้
    //  เวลาของ rAF อาจย้อนหลัง performance.now() ที่จดไว้ตอนกลับมาวาด (setPaused) → dt ติดลบ = สีฟ้า/กล้องพุ่งย้อน (จอฟ้าทั้งจอ)
    const raw = Math.max(0, (now - last) / 1000); last = now;
    const dt = Math.min(0.25, raw);
    if (canvas.clientWidth && Math.abs(canvas.clientWidth / canvas.clientHeight - camera.aspect) > 0.01) resize();
    idleAcc += dt;
    const active = anims.length || fx.length || dirty || walking() || camMode === "follow" || Math.abs(nightTarget - nightK) > 0.01;
    if (!active && idleAcc < 1 / 12) return;
    update(active ? dt : idleAcc, active ? raw : idleAcc);
    idleAcc = 0; dirty = false;
    renderer.render(scene, camera);
  }
  resize();
  upper.visible = false;
  snapTo(followPose());
  raf = requestAnimationFrame(frame);

  return {
    setBoard,
    sync(s) { latest = s; if (!busy) sync(s); },
    forceSync(s) {
      cancelAll(); busy = false; camMode = "follow"; latest = s;
      upper.visible = false; cutParts.visible = true; clip.constant = CUT;
      sync(s, { instant: true }); snapTo(followPose());
    },
    playIntro, playOrt, playFight, returnFromFight, setNight, resize, project,
    setPaused(v) { paused = !!v; if (!paused) { dirty = true; last = performance.now(); } },
    isBusy: () => busy,
    dispose() {
      dead = true; cancelAnimationFrame(raf); cancelAll();
      removeMissing([]);
      scene.traverse((o) => { if (o.isInstancedMesh) o.dispose(); });
      for (const d of disposables) d.dispose?.();
      renderer.dispose();
    },
  };
}
