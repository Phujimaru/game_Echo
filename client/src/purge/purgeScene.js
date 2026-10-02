// ============================================================
//  Purge — ฉากอุโมงค์ท่อแบบ 2.5D (ไม่ผูกกับ React)
//  - ท่อ = ทรงกระบอกที่ผิวด้านในเป็นภูมิประเทศธรรมชาติ (ป่า เชิงเขา โบราณสถาน น้ำตก) แบ่ง 5 ภูมิภาค
//  - ระหว่างเล่น ตัดครึ่งบนของท่อออกด้วยระนาบตัด (clipping) → เหลือรางครึ่งทรงกระบอก มองจากมุมสูงด้วยเลนส์แคบ
//    ครึ่งบนมีไว้เฉพาะฉากเปิด (เห็นท่อเต็มวงก่อนกล้องลอยลงมาที่จุดเริ่ม) แล้วซ่อนทิ้งทั้งชุด
//  - ทุกช่องที่ ORT คลานผ่านตกผลึก (Crystal Valley) ด้วย shader ตัวเดียวที่ทุกวัสดุใช้ร่วมกัน (uniform uCrystal)
//  - ประหยัดเครื่อง: ไม่มีเงาจริง · วาดเฉพาะตอนมีอนิเมชัน (นิ่ง = วาดช้าลงเหลือ ~12 เฟรม/วิ) · pixelRatio ไม่เกิน 1.25
//  เวลาของฉากจบเทิร์นต้องตรงกับ server/modes/purge.js — ใช้ turnSceneSeconds() สูตรเดียวกัน
// ============================================================
import * as THREE from "three";

const T = THREE;

// ---------- โครงท่อ ----------
export const STEPS = 50;
const R = 46;
const L = 610;
const CUT = -4;                                  // ระนาบตัดครึ่งบน (เก็บเฉพาะ y <= CUT)
const SHELL = R + 8;
export function zOf(step) { return 20 + step * 11.2; }
const BOUNDS = [10, 20, 30, 40].map(zOf);
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
export function regionOfStep(s) { return Math.min(4, Math.max(0, Math.floor(s / 10))); }

// ---------- เวลาของฉาก (ต้องตรงกับ server) ----------
export const INTRO_SECONDS = 10.5;
const T_ZOOM_OUT = 1.5, T_PAUSE = 0.3, T_STEP = 0.34, T_AFTER_MOVE = 0.25, T_KNOCK = 0.9;
const T_ORT_STEP = 0.75, T_ORT_ARRIVE = 1.4, T_AFTER_ORT = 0.4, T_LOST = 1.3, T_NO_LOST = 0.5, T_ZOOM_IN = 1.8;
// scene = { moves: [{ from, to }], ortFrom, ortTo, caught: [...] }
export function turnSceneSeconds(scene) {
  let t = T_ZOOM_OUT + T_PAUSE;
  for (const m of scene.moves || []) {
    t += m.to > m.from ? (m.to - m.from) * T_STEP + T_AFTER_MOVE : T_KNOCK + T_AFTER_MOVE;
  }
  if (scene.ortTo != null && scene.ortTo !== scene.ortFrom) {
    t += scene.ortFrom == null ? T_ORT_ARRIVE + T_AFTER_ORT : (scene.ortTo - scene.ortFrom) * T_ORT_STEP + T_AFTER_ORT;
  }
  t += (scene.caught || []).length ? T_LOST : T_NO_LOST;
  return t + T_ZOOM_IN;
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

function pathCenter(z) { return FLOOR + 0.06 * Math.sin(z * 0.018) + 0.03 * Math.sin(z * 0.051 + 1.3); }
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
  const wall = smooth(0.1, 0.85, a);
  let d = wall * amp * hills + 0.5 * n;
  d += 7 * smooth(BOUNDS[2] - 20, BOUNDS[2] + 30, z) * (1 - smooth(BOUNDS[3] - 10, BOUNDS[3] + 25, z)) * wall;
  d *= lerp(0.12, 1, smooth(0.035, 0.12, a));
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
  buildTerrain(TH_L - 0.06, TH_R + 0.06, 170, 420);
  const upper = new T.Group(); scene.add(upper);
  upper.add(buildTerrain(TH_R - 0.06, Math.PI - TH_R + 0.06 - 2 * Math.PI + 2 * Math.PI, 90, 220));

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
      if (w <= 0 || rnd() > w || dc < 0.2) continue;
      if (dc < 0.45 && rnd() < 0.7) continue;
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
  forest(scene, pineG, 1800, pinePick, TH_L, TH_R);
  forest(scene, broadG, 2200, broadPick, TH_L, TH_R);
  forest(upper, pineG, 600, pinePick, TH_R, Math.PI - TH_R);
  forest(upper, broadG, 700, broadPick, TH_R, Math.PI - TH_R);

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
    [0.42, 70, 9, 4, stoneMat], [-0.32, 100, 6, 3, stoneMat], [0.85, 45, 14, 5, stoneMat],
    [0.45, 290, 10, 4, mossMat], [0.75, 318, 14, 5, mossMat], [-0.3, 272, 6, 3, mossMat],
    [0.4, 520, 11, 5, goldMat], [-0.3, 552, 7, 4, goldMat], [0.9, 498, 18, 6, goldMat], [0.7, 580, 16, 6, goldMat],
  ]) {
    const g = pyramid(r[2], r[3], r[4]);
    placeOn(g, pathCenter(r[1]) + r[0], r[1], -0.5, rnd() * 0.6 - 0.3);
    scene.add(g);
  }
  for (const [za, zb, mat] of [[40, 90, stoneMat], [262, 330, mossMat], [480, 600, goldMat]]) {
    for (let z = za; z < zb; z += 14) {
      for (const side of [-1, 1]) {
        if (rnd() < 0.25) continue;
        const h = 3 + rnd() * 3.5;
        const p = pillar(rnd() < 0.3 ? h * 0.45 : h, mat);
        placeOn(p, pathCenter(z) + side * 0.12, z, -0.2, rnd());
        if (rnd() < 0.3) p.rotateX(0.25 * side);
        scene.add(p);
      }
    }
  }

  // ---------- แผ่นหินหกเหลี่ยม 1 แผ่นต่อ 1 ช่อง ----------
  {
    const geo = keep(new T.CylinderGeometry(2.5, 2.7, 0.5, 6)); geo.translate(0, 0.1, 0);
    const mesh = new T.InstancedMesh(geo, crystalize(new T.MeshStandardMaterial({ roughness: 0.85, flatShading: true })), STEPS + 1);
    const o = new T.Object3D(), c = new T.Color(), white = new T.Color(0xffffff);
    for (let s = 0; s <= STEPS; s++) {
      const z = zOf(s);
      placeOn(o, pathCenter(z), z, 0, Math.PI / 6);
      const big = s % 10 === 0;
      o.scale.setScalar(big ? 1.25 : 1);
      o.updateMatrix(); mesh.setMatrixAt(s, o.matrix);
      c.copy(REG[regionOfStep(s)].path).lerp(white, big ? 0.45 : 0.25);
      mesh.setColorAt(s, c);
    }
    scene.add(mesh);
  }

  // ---------- ประตูภูมิภาค ----------
  ["#2fc4b2", "#8a6cf0", "#e08a3c", "#f0cf6e"].forEach((col, k) => {
    const bz = BOUNDS[k] - 5.6;
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
  waterfall(1, 160, 1.42, 0.3, 7); waterfall(-1, 185, 1.42, 0.32, 9); waterfall(1, 215, 1.4, 0.5, 6);
  waterfall(-1, 140, 1.3, 0.34, 5); waterfall(1, 98, 1.38, 0.42, 4); waterfall(-1, 232, 1.42, 0.6, 8);
  {
    const pts = [], z0 = 118, z1 = 252, steps = 90;
    for (let s = 0; s <= steps; s++) {
      const z = lerp(z0, z1, s / steps), c = pathCenter(z) + 0.105 + 0.02 * Math.sin(z * 0.08);
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
  const fireflies = motes(250, 360, 400, "rgba(190,170,255,.8)", 1.4);
  motes(470, 600, 360, "rgba(255,220,140,.8)", 1.1);

  // ---------- ผลึกงอก (ตามหลัง ORT) ----------
  {
    const sg = keep(new T.OctahedronGeometry(1, 0)); sg.scale(0.55, 2.6, 0.55); sg.translate(0, 1.6, 0);
    const mat = crystalize(new T.MeshStandardMaterial({ color: 0xd8f1ff, emissive: 0x4256b0, emissiveIntensity: 0.55, roughness: 0.12, metalness: 0.25, flatShading: true, transparent: true, opacity: 0.92 }), true);
    const SH = 1400, inst = new T.InstancedMesh(sg, mat, SH), o = new T.Object3D();
    let k = 0, guard = 0;
    while (k < SH && guard++ < SH * 4) {
      const z = rnd() * L, near = rnd() < 0.5;
      const th = near ? pathCenter(z) + (rnd() < 0.5 ? -1 : 1) * (0.16 + rnd() * 0.4) : TH_L + rnd() * (TH_R - TH_L);
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
  const ortTex = keep(canvasTex(512, 592, (g) => {
    g.save(); g.shadowColor = "rgba(0,0,0,.4)"; g.shadowBlur = 16;
    hexPath(g, 256, 296, 240, 280);
    const rim = g.createLinearGradient(0, 0, 512, 592);
    rim.addColorStop(0, "#f4fbff"); rim.addColorStop(0.5, "#9fd6ff"); rim.addColorStop(1, "#8c78e8");
    g.fillStyle = rim; g.fill(); g.restore();
    hexPath(g, 256, 296, 218, 254);
    const gr = g.createRadialGradient(256, 250, 10, 256, 296, 300);
    gr.addColorStop(0, "#ff3a5c"); gr.addColorStop(0.35, "#7a1028"); gr.addColorStop(1, "#0c0307");
    g.fillStyle = gr; g.fill();
    g.strokeStyle = "rgba(190,235,255,.35)"; g.lineWidth = 3;
    for (let k = 0; k < 6; k++) { g.beginPath(); g.moveTo(256, 296); const an = k * Math.PI / 3 + 0.5; g.lineTo(256 + Math.cos(an) * 226, 296 + Math.sin(an) * 226); g.stroke(); }
    g.fillStyle = "#ffe6ec"; g.font = '700 132px "Chakra Petch", "Segoe UI", sans-serif';
    g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("ORT", 256, 306);
  }));
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

  // ---------- ผู้เล่น ----------
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
    const P = { g, body, spr, cv, tex, lab, ring, encase, cur: p.step, hop: 0, lane: 0, data: p, lostShown: null, img: null, imgSrc: null };
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
    P.encase.visible = lost; P.ring.visible = !lost;
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

  let state = { players: [], ort: null };
  let ortCur = -3, ortHop = 0, crystalZ = -80;
  function applyLanes(list) {
    const lanes = {};
    for (const p of list) {
      const P = players[p.id] || (players[p.id] = makePlayer(p));
      const k = lanes[p.step] || 0; lanes[p.step] = k + 1; P.lane = k;
      const prev = P.data;
      P.data = { ...p, lost: prev.lost && P.lostShown ? prev.lost : p.lost };
      if (prev.img !== p.img || prev.color !== p.color) redrawToken(P);
    }
  }
  // ตั้งสถานะทันที (ไม่มีอนิเมชัน) — ใช้ตอนต่อเข้ากลางเกม / ข้ามฉาก
  function setState(s) {
    state = s;
    removeMissing(s.players);
    applyLanes(s.players);
    for (const p of s.players) { const P = players[p.id]; P.cur = p.step; P.hop = 0; setLost(P, !!p.lost); }
    ort.visible = s.ort != null; crystalCut.visible = s.ort != null;
    ortCur = s.ort == null ? -3 : s.ort; ortHop = 0;
    crystalZ = s.ort == null ? -80 : zOf(s.ort) + 4;
    dirty = true;
  }

  // ---------- อนิเมชันแบบลำดับ ----------
  const anims = [];
  const animate = (dur, fn) => new Promise((res) => { anims.push({ t: 0, dur, fn, res }); });
  const wait = (sec) => animate(sec, () => {});
  let token = 0;               // เปลี่ยนเมื่อเริ่มลำดับใหม่ — ลำดับเก่าที่ยังค้างจะหยุดเอง
  function cancelAll() { token++; for (const a of anims.splice(0)) a.res(); }

  // ---------- กล้อง ----------
  // ท่าของกล้อง = { pos, look } · มุมมองมาตรฐานคำนวณจาก จุดมอง z + มุมเงย el + มุมรอบ az + ระยะ dist (+ ty = ยกจุดมอง)
  const cam = { pos: new T.Vector3(0, -R + 20, -40), look: new T.Vector3(0, -R + 3, 40) };
  function poseFrom(p) {
    const fy = floorY(p.z);
    const look = new T.Vector3(0, lerp(fy + 3, CUT, p.ty || 0), p.z);
    const el = p.el * Math.PI / 180, az = p.az * Math.PI / 180;
    const off = new T.Vector3(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az)).multiplyScalar(p.dist);
    return { pos: look.clone().add(off), look, dist: p.dist };
  }
  let camDist = 120;
  function groupSpan() {
    const a = state.players.filter((p) => !p.lost).map((p) => zOf(p.step));
    if (!a.length) a.push(zOf(0));
    return { min: Math.min(...a), max: Math.max(...a) };
  }
  function viewParams(name, arg) {
    const g = groupSpan(), mid = (g.min + g.max) / 2;
    if (name === "top") return { z: arg != null ? arg : zOf(0) + 40, el: 88, az: 180, dist: 175, ty: 0.05 };
    if (name === "high") return { z: mid + 4, el: 58, az: 180, dist: Math.max(235, (g.max - g.min) * 1.25 + 60), ty: 0.45 };
    if (name === "field") {
      // ช่วงต้นท่อ: ยกกล้องสูงขึ้นแทนการถอยหลัง (ถอยไปจะชนผนังปากท่อ)
      const near = 1 - smooth(40, 130, g.min);
      return { z: g.min + lerp(12, 6, near), el: lerp(30, 62, near), az: 252, dist: lerp(115, 100, near), ty: 0.05 };
    }
    if (name === "overview") {
      const lo = Math.min(g.min, state.ort == null ? g.min : zOf(state.ort)) - 18, hi = Math.max(g.max, arg != null ? arg : g.max) + 24;
      return { z: (lo + hi) / 2, el: 58, az: 180, dist: Math.max(235, (hi - lo) * 1.25), ty: 0.45 };
    }
    if (name === "region") return { z: zOf((arg || 0) * 10 + 5), el: 56, az: 180, dist: 245, ty: 0.45 };
    return { z: mid, el: 58, az: 180, dist: 235, ty: 0.45 };
  }
  function camTo(target, dur, lift = 0) {
    const from = { pos: cam.pos.clone(), look: cam.look.clone(), dist: camDist };
    const to = target.pos ? target : poseFrom(target);
    return animate(dur, (u) => {
      const e = ease(u);
      cam.pos.lerpVectors(from.pos, to.pos, e);
      cam.pos.y += Math.sin(e * Math.PI) * lift;
      cam.look.lerpVectors(from.look, to.look, e);
      camDist = lerp(from.dist, to.dist || from.dist, e);
    });
  }
  function snapTo(target) { const p = target.pos ? target : poseFrom(target); cam.pos.copy(p.pos); cam.look.copy(p.look); camDist = p.dist || camDist; dirty = true; }
  let busy = false, viewName = "field";
  function setView(name, arg) {
    viewName = name;
    if (busy) return Promise.resolve();
    return camTo(viewParams(name, arg), 1.6);
  }

  // ฉากเปิด: เห็นท่อเต็มวงจากปากท่อ → กล้องลอยขึ้นพร้อมเปิดครึ่งบนของท่อออก จนมองลงตรงจุดเริ่ม
  //          → มุมสูงเห็นรางครึ่งท่อ → ซูมเข้าสนาม  (รวม INTRO_SECONDS)
  function playIntro(s) {
    cancelAll(); const my = token;
    busy = true;
    setState(s);
    upper.visible = true; cutParts.visible = false;
    clip.constant = R + 30;
    snapTo({ pos: new T.Vector3(0, -R * 0.42, Z0 + 4), look: new T.Vector3(0, -R * 0.46, Z0 + 240), dist: 120 });
    const top = poseFrom(viewParams("top"));
    return animate(1.6, (u) => { cam.pos.z = lerp(Z0 + 4, Z0 + 24, u); })
      .then(() => {
        if (my !== token) return null;
        const from = { pos: cam.pos.clone(), look: cam.look.clone() };
        return animate(3.0, (u) => {
          const e = ease(u);
          cam.pos.lerpVectors(from.pos, top.pos, e);
          cam.look.lerpVectors(from.look, top.look, e);
          camDist = lerp(120, top.dist, e);
          clip.constant = lerp(R + 30, CUT, smooth(0.15, 0.85, u));
          if (u >= 1) { upper.visible = false; cutParts.visible = true; clip.constant = CUT; }
        });
      })
      .then(() => (my === token ? wait(1.0) : null))
      .then(() => (my === token ? camTo(viewParams("high"), 2.2) : null))
      .then(() => (my === token ? wait(0.9) : null))
      .then(() => (my === token ? camTo(viewParams("field"), 1.8) : null))
      .then(() => { if (my === token) { busy = false; viewName = "field"; } upper.visible = false; cutParts.visible = true; clip.constant = CUT; });
  }

  // จบเทิร์น: ซูมออก → คนเดินทีละช่อง → ORT เดิน (ผลึกลาม) → LOST DATA → ซูมกลับสนาม
  //  next = สถานะหลังเทิร์น · moves/ortFrom ได้จาก server (from = ช่องตอนต้นเทิร์น)
  function playTurn(next, scene) {
    cancelAll(); const my = token;
    busy = true;
    const moves = (scene && scene.moves) || [];
    // เริ่มจากช่องตอนต้นเทิร์น
    const startPlayers = next.players.map((p) => {
      const mv = moves.find((m) => m.id === p.id);
      return { ...p, step: mv ? mv.from : p.step, lost: p.lost && !(scene.caught || []).includes(p.id) };
    });
    setState({ players: startPlayers, ort: scene.ortFrom ?? null });
    const ordered = [...moves].sort((a, b) => (b.to > b.from) - (a.to > a.from));
    const leadTo = Math.max(...next.players.map((p) => zOf(p.step)));
    let chain = camTo(viewParams("overview", leadTo), T_ZOOM_OUT).then(() => wait(T_PAUSE));
    for (const mv of ordered) {
      chain = chain.then(() => {
        if (my !== token) return null;
        const P = players[mv.id]; if (!P) return null;
        P.data = { ...P.data, step: mv.to };
        const n = Math.abs(mv.to - mv.from);
        if (mv.to > mv.from) {
          let lastReg = regionOfStep(mv.from);
          return animate(n * T_STEP, (u) => {
            const x = u * n, k = Math.min(n - 1, Math.floor(x)), f = x - k;
            P.cur = mv.from + k + ease(f);
            P.hop = Math.sin(f * Math.PI) * 1.8;
            const rg = regionOfStep(Math.round(P.cur));
            if (rg !== lastReg && f > 0.5) { lastReg = rg; opts.onRegion?.(rg, P.data.name); }
            if (u >= 1) { P.cur = mv.to; P.hop = 0; }
          }).then(() => wait(T_AFTER_MOVE));
        }
        return animate(T_KNOCK, (u) => {
          P.cur = lerp(mv.from, mv.to, 1 - Math.pow(1 - u, 3)); P.hop = Math.sin(u * Math.PI) * 3.2 * (1 - u);
          if (u >= 1) { P.cur = mv.to; P.hop = 0; }
        }).then(() => wait(T_AFTER_MOVE));
      });
    }
    chain = chain.then(() => {
      if (my !== token) return null;
      state = { players: next.players.map((p) => ({ ...p, lost: players[p.id]?.lostShown || false })), ort: scene.ortFrom ?? null };
      applyLanes(state.players);
      const a = scene.ortFrom, b = scene.ortTo;
      if (b == null || b === a) return null;
      if (a == null) {
        ort.visible = true; crystalCut.visible = true; ortCur = b;
        return animate(T_ORT_ARRIVE, (u) => { ortHop = (1 - ease(u)) * -12; crystalZ = lerp(-80, zOf(b) + 4, ease(u)); })
          .then(() => { ortHop = 0; return wait(T_AFTER_ORT); });
      }
      const n = b - a;
      return animate(n * T_ORT_STEP, (u) => {
        const x = u * n, k = Math.min(n - 1, Math.floor(x)), f = x - k;
        ortCur = a + k + ease(f); ortHop = Math.sin(f * Math.PI) * 1.1;
        crystalZ = zOf(ortCur) + 4;
        if (u >= 1) { ortCur = b; ortHop = 0; }
      }).then(() => wait(T_AFTER_ORT));
    });
    chain = chain.then(() => {
      if (my !== token) return null;
      state = next;
      applyLanes(next.players);
      for (const id of scene.caught || []) if (players[id]) setLost(players[id], true);
      const names = (scene.caught || []).map((id) => players[id]?.data.name).filter(Boolean);
      if (names.length) opts.onLost?.(names);
      return wait((scene.caught || []).length ? T_LOST : T_NO_LOST);
    });
    return chain.then(() => (my === token ? camTo(viewParams("field"), T_ZOOM_IN) : null))
      .then(() => { if (my === token) { busy = false; viewName = "field"; setState(next); } });
  }

  // ---------- loop (วาดเมื่อจำเป็น) ----------
  let dirty = true, dead = false, raf = 0, last = performance.now(), idleAcc = 0, time = 0;
  const skyTarget = new T.Color();
  function resize() {
    const w = canvas.clientWidth || canvas.width, h = canvas.clientHeight || canvas.height;
    if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); dirty = true;
  }
  function update(dt) {
    time += dt;
    U.uTime.value = time;
    for (let a = anims.length - 1; a >= 0; a--) {
      const an = anims[a]; an.t += dt;
      const u = Math.min(1, an.t / an.dur); an.fn(u);
      if (u >= 1) { anims.splice(a, 1); an.res(); }
    }
    if (ort.visible) {
      const oz = zOf(ortCur) - 4; // ยืนหลังแผ่นหินของช่องตัวเองเล็กน้อย ไม่ทับผู้เล่นช่องเดียวกัน
      placeOn(ort, pathCenter(oz), oz, 0);
      ort.position.y += ortHop;
      const ko = Math.min(1.9, Math.max(0.55, camDist / 150));
      ortSpr.scale.set(9 * ko, 10.4 * ko, 1);
      ortSpr.position.y = 6.4 * ko + Math.sin(time * 2.2) * 0.25;
      ortRing.scale.setScalar(1 + 0.06 * Math.sin(time * 4));
    }
    U.uCrystal.value = crystalZ;
    const ks = Math.min(2.6, Math.max(0.75, camDist / 120));
    for (const id of Object.keys(players)) {
      const P = players[id], p = P.data;
      const z = zOf(P.cur);
      const la = P.lane ? (P.lane - 1) * Math.PI * 2 / 6 + Math.PI / 6 : 0, lr = P.lane ? 4.6 : 0;
      const lz = z + Math.sin(la) * lr;
      placeOn(P.g, pathCenter(lz) + Math.cos(la) * lr / R, lz, 0);
      P.body.position.y = P.hop * ks; P.body.scale.setScalar(ks);
      const danger = !p.lost && state.ort != null && p.step - state.ort <= 1;
      P.ring.material.color.set(danger ? "#ff2d55" : (p.color || "#ffffff"));
      P.ring.material.opacity = danger ? 0.55 + 0.45 * Math.sin(time * 7) : 0.9;
      P.spr.position.y = 2.9 + Math.sin(time * 2 + P.lane) * 0.1;
    }
    fireflies.material.opacity = 0.6 + 0.4 * Math.sin(time * 3);
    for (const m of waterMats) m.map.offset.y -= dt * 1.4;
    camera.position.copy(cam.pos);
    camera.lookAt(cam.look);
    scene.fog.near = camDist * 0.85; scene.fog.far = camDist * 2.8;
    const m = regMix(cam.look.z); mixC(skyTarget, REG[m.a].sky, REG[m.b].sky, m.t);
    skyCol.lerp(skyTarget, 1 - Math.exp(-dt * 2)); scene.fog.color.copy(skyCol);
  }
  function frame(now) {
    if (dead) return;
    raf = requestAnimationFrame(frame);
    if (document.hidden) { last = now; return; }
    // เวลาจริง (เพดาน 0.25 วิ) — เครื่องที่เฟรมตกยังจบอนิเมชันทันเวลาที่ server พักเกมไว้
    const dt = Math.min(0.25, (now - last) / 1000); last = now;
    if (canvas.clientWidth && Math.abs(canvas.clientWidth / canvas.clientHeight - camera.aspect) > 0.01) resize();
    // นิ่ง (ไม่มีอนิเมชัน) = วาดแค่ ~12 เฟรม/วิ พอให้น้ำตก/วงแดงขยับ
    idleAcc += dt;
    if (!anims.length && !dirty && idleAcc < 1 / 12) return;
    update(anims.length || dirty ? dt : idleAcc);
    idleAcc = 0; dirty = false;
    renderer.render(scene, camera);
  }
  resize();
  snapTo(viewParams("field"));
  raf = requestAnimationFrame(frame);

  return {
    setState(s) { if (!busy) setState(s); else state = s; },
    forceState(s) { cancelAll(); busy = false; setState(s); snapTo(viewParams(viewName)); },
    playIntro, playTurn, setView, resize,
    snap(name) { snapTo(viewParams(name || viewName)); },
    isBusy: () => busy,
    dispose() {
      dead = true; cancelAnimationFrame(raf); cancelAll();
      removeMissing([]);
      scene.traverse((o) => {
        if (o.isInstancedMesh) o.dispose();
      });
      for (const d of disposables) d.dispose?.();
      renderer.dispose();
    },
  };
}
