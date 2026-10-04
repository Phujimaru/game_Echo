// Echo "นี่มันเกมของฉัน" — ฉากเปิดตัวร่างยักษ์ · สนามราชินี · ต่อย · โดนตี · ฉากออก
//  canvas ล้วน ไม่ผูก React (แบบเดียวกับ raid/ortStage.js) · ต้นแบบที่ผู้ใช้อนุมัติ: .claude/plans/echo-queen-artifact/echo_field_src.html
//  canvas 2 ชั้น:
//   back = สนามราชินี (อยู่หลังการ์ดผู้เล่น/HUD) — วาดใหม่เฉพาะตอนมีท่า ว่างแล้วเป็นภาพนิ่ง
//   fx   = ฉากเปิดตัว / กำปั้น / อนุภาค / กลิตช์ (อยู่หน้า HUD ไม่รับคลิก) — ว่างแล้วล้างใส
//  งบ GPU (quality-over-flash): ไม่มี RAF ตอนนิ่ง · ฉากหลัง+กระดาน "อบ" ครั้งเดียวต่อขนาดจอ · กลิตช์ทั้งจอเฉพาะช่วงสั้นๆ · lowQ ตัดกลิตช์/อนุภาค/จอแตก

const BASE = "/characters/echo_queen/";
export const ECHO_IMG = {
  main: `${BASE}echo_queen_board.webp`,   // เท้าคาง + ลูกโลก ECHO (บนกระดาน)
  wind: `${BASE}echo_queen_windup.webp`,  // ท่าง้าง (ขยิบตา ชูกำปั้น) — ใช้ตอนต่อย + โบกลา
  cut: `${BASE}echo_queen_spread.webp`,   // กางแขน (ฉากเปิดตัว)
  fist: `${BASE}echo_queen_fist.webp`,    // กำปั้นมือซ้ายพุ่งตรง + ประกายดาว
};
export const TRANSFORM_SECONDS = 12;
export const EXIT_SECONDS = 3.2;

// ---------- ตำแหน่งบนภาพ (สัดส่วนของภาพ) — ภาพวาดมือ v5 1920×1080 · ได้ภาพใหม่แก้แค่ก้อนนี้ ----------
const ART = {
  edgeCut: .93,                         // ชายเสื้อ = วางตรงขอบไกลของกระดาน (ศอก 2 ข้างวางเลยลงมาบนกระดาน)
  fadeFrom: .8, fadeTo: .95,
  elbows: [[.4, .985], [.647, .983]],   // จุดที่ศอกวางบนกระดาน
  fist: [.646, .49], fistH: .13,        // กำปั้นในภาพท่าง้าง (จุดออกตัวของหมัด · สูงเท่าไหร่ของภาพ)
  globe: [.766, .333],                  // ลูกโลก ECHO บนฝ่ามือ — แตกเป็นประกายตอนโบกลา
  winkEye: [.44, .43],
  armCut: [[.6016, .4074, .6953, .5972], [.6719, .5, .7813, .6667]], // ภาพง้างตัดแขนที่ง้างออก (ช่วงกำปั้นลอยไปหาเป้า)
};
const CUT = { heart: { x: .508, y: .037 }, face: { cx: .5, cy: .36, w: .22 }, eyes: [[.471, .337], [.531, .337]], fadeFrom: .84, fadeTo: 1 };
const FIST_KNUCKLE = [.52, .6], FIST_FILL = .73;

const PURPLE = "168,92,255", VIOLET = "112,96,255";
const FONT_D = '"Chakra Petch", "Kanit", sans-serif', FONT_B = '"Kanit", "Segoe UI", sans-serif';

// ---------- คณิต ----------
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const lerp = (a, b, k) => a + (b - a) * k;
const seg = (p, a, b) => clamp01((p - a) / (b - a));
const easeInOut = (k) => (k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
const easeOut = (k) => 1 - Math.pow(1 - k, 3);
const easeOutBack = (k) => { const c = 1.6; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };
function bounce(k) { // 1 → 0 แบบตกกระดอน
  const n = 7.5625, d = 2.75; let x = k, v;
  if (x < 1 / d) v = n * x * x; else if (x < 2 / d) v = n * (x -= 1.5 / d) * x + .75; else if (x < 2.5 / d) v = n * (x -= 2.25 / d) * x + .9375; else v = n * (x -= 2.625 / d) * x + .984375;
  return 1 - v;
}
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l]; };
const rotY = (v, r) => [v[0] * Math.cos(r) + v[2] * Math.sin(r), v[1], -v[0] * Math.sin(r) + v[2] * Math.cos(r)];

function mk(w, h) { const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }
function tint(src, color) { const c = mk(src.width, src.height), g = c.getContext("2d"); g.drawImage(src, 0, 0); g.globalCompositeOperation = "source-in"; g.fillStyle = color; g.fillRect(0, 0, c.width, c.height); return c; }
function heartPath(g, x, y, s) {
  g.beginPath();
  g.moveTo(x, y + s * .38);
  g.bezierCurveTo(x - s * 1.15, y - s * .35, x - s * .5, y - s * 1.12, x, y - s * .45);
  g.bezierCurveTo(x + s * .5, y - s * 1.12, x + s * 1.15, y - s * .35, x, y + s * .38);
  g.closePath();
}
function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

// ---------- เตรียมภาพ (ครั้งเดียวต่อหน้าเว็บ — tint/blur อ่านพิกเซลทั้งภาพ ห้ามทำซ้ำทุกครั้งที่สร้างเวที) ----------
function fadeBottom(src, from, to) {
  const c = mk(src.width, src.height), g = c.getContext("2d");
  g.drawImage(src, 0, 0); g.globalCompositeOperation = "destination-in";
  const gr = g.createLinearGradient(0, 0, 0, c.height); gr.addColorStop(0, "#000"); gr.addColorStop(from, "#000"); gr.addColorStop(to, "rgba(0,0,0,0)");
  g.fillStyle = gr; g.fillRect(0, 0, c.width, c.height);
  return c;
}
function makeAura(src) {
  const q = 4, pad = 24, aura = mk(src.width / q + pad * 2, src.height / q + pad * 2), ag = aura.getContext("2d");
  ag.filter = "blur(9px)"; ag.drawImage(tint(src, `rgb(${PURPLE})`), pad, pad, src.width / q, src.height / q); ag.filter = "none";
  return { aura, auraQ: q, auraPad: pad };
}
function prepCut(img) {
  const sc = Math.min(1, 1400 / img.height), w = Math.round(img.width * sc), h = Math.round(img.height * sc);
  const full = mk(w, h); full.getContext("2d").drawImage(img, 0, 0, w, h);
  const fade = fadeBottom(full, CUT.fadeFrom, CUT.fadeTo);
  return { w, h, full, fade, white: tint(fade, "#f6efff"), ghost: tint(fade, `rgb(${PURPLE})`), cyan: tint(fade, "rgb(70,225,255)"), ...makeAura(fade) };
}
function prepMain(img, wind) {
  const sc = Math.min(1, 1400 / img.height), w = Math.round(img.width * sc), h = Math.round(img.height * sc);
  const draw = (src) => { const c = mk(w, h); c.getContext("2d").drawImage(src, 0, 0, w, h); return c; };
  const full = draw(img), windup = draw(wind);
  const fade = fadeBottom(full, ART.fadeFrom, ART.fadeTo);
  const m = mk(w, h), mg = m.getContext("2d");
  mg.filter = "blur(4px)"; mg.fillStyle = "#000";
  for (const [x0, y0, x1, y1] of ART.armCut) mg.fillRect(x0 * w, y0 * h, (x1 - x0) * w, (y1 - y0) * h);
  mg.filter = "none";
  const stub = draw(wind), stg = stub.getContext("2d");
  stg.globalCompositeOperation = "destination-out"; stg.drawImage(m, 0, 0);
  return { w, h, full, windup, stub, fade, white: tint(fade, "#f6efff"), whiteWind: tint(windup, "#f6efff"), red: tint(full, "#ff3d6e"), ...makeAura(full) };
}
const loadImg = (src) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
let assetsPromise = null;
// โหลด+เตรียมภาพล่วงหน้า (เรียกตั้งแต่มี Echo ในแมตช์ — ฉากเปิดตัวจะได้เริ่มทันทีตอนกดท่า)
export function preloadEchoQueen() {
  if (!assetsPromise) {
    assetsPromise = Promise.all([loadImg(ECHO_IMG.main), loadImg(ECHO_IMG.wind), loadImg(ECHO_IMG.cut), loadImg(ECHO_IMG.fist)])
      .then(([main, wind, cut, fist]) => (main && wind && cut ? { A: { ...prepMain(main, wind), cut: prepCut(cut) }, fist } : null));
  }
  return assetsPromise;
}

// ฉากเปลี่ยนร่าง 12 วิ:
//  0–1.6 กระดานโดนยึด (กลิตช์ถี่ขึ้น · ภาพราชินีแวบ · "ECHO") → ม่านมืดหุบเข้าที่นั่ง Echo
//  1.6–2.8 หัวใจเต้น 3 จังหวะ → 2.8–4.6 ร่างขาวงอก (เงาสีเหลื่อม) → 4.6–5.9 ไล่สีจริง + กลิตช์หนัก
//  5.9–6.6 ไพ่สับปาดจอ → 6.4–8.7 โคลสอัปดวงตา + ชื่อท่า → 8.7 จอแตกเป็นช่องกระดาน → 8.7–12 กล้องเอียงเข้าสนาม
const T = { cut: 1.6, beat1: 1.8, beat2: 2.15, beat3: 2.5, grow: 2.8, wipe: 4.6, shuffle: 5.9, face: 6.4, smash: 8.7 };
const ACTS = { transform: TRANSFORM_SECONDS, punch: 1.75, hit: .8, exit: EXIT_SECONDS };
const REVEAL = ACTS.transform - T.smash;
// ฉากออก (สัดส่วนของ 3.2 วิ): ขยิบตาโบกลา + ลูกโลกแตก → ร่างสลายเป็นพิกเซลจากล่างขึ้นบน → กระดานพลิกหาย ไพ่ล้ม ลูกเต๋าลอยออก → กลิตช์ขาว กลับสนามปกติ
const EXIT = { wink: .02, melt0: .12, melt1: .46, board0: .4, board1: .7, back: .72 };
const CAM_E = 30, CAM_D = 20;
const PIPS = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] };

/**
 * createEchoQueenStage(backCanvas, fxCanvas, { lowQ, onCover })
 *  - playTransform({ seat })  ฉากเปิดตัว 12 วิ · seat = [x, y] จุดกลางการ์ดที่นั่งของ Echo (พิกัดจอ)
 *  - enterField()             เข้าสนามทันทีไม่เล่นฉาก (รีคอนเนกต์กลางท่า / ฉากเปิดตัวถูกข้าม)
 *  - punch({ at, me, dmg })   Echo ต่อย — at = [x, y] เป้าบนจอ · me = เราโดน (กำปั้นพุ่งเข้าจอ)
 *  - hit({ dmg })             Echo โดนตี (สั่น + เรืองแดง)
 *  - exit({ seat })           ฉากออก 3.2 วิ แล้วล้างใส
 *  - onCover(bool)            true = สนามบังฉากหลังปกติทั้งจอแล้ว (ผู้เรียกซ่อนฉากหลังเดิมได้ ประหยัด GPU)
 */
export function createEchoQueenStage(backCv, fxCv, { lowQ = false, onCover = () => {} } = {}) {
  const ctxB = backCv.getContext("2d"), ctxF = fxCv.getContext("2d");
  const reduce = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  let calm = lowQ || reduce;
  let W = 0, H = 0, dpr = 1, dead = false;
  let A = null, fistImg = null, L = null, bgBake = null, boardBake = null;
  let mode = "none"; // none | arena | cut | field
  let act = null, pending = null, seat = null;
  let parts = [], rings = [], boardRings = [], texts = [], bursts = [], tileFlash = [], shards = [];
  const fx = { shake: 0, flash: 0, flashCol: "255,255,255", hit: 0, hitstop: 0, glitch: 0 };
  let frameDt = 0, covered = false;

  const setMode = (m) => {
    mode = m;
    const c = m === "cut" || m === "field";
    if (c !== covered) { covered = c; onCover(c); }
  };
  const shake = (n) => { if (!calm) fx.shake = Math.max(fx.shake, n); };
  const glitch = (n) => { fx.glitch = Math.max(fx.glitch, n); };

  // ---------- กล้องกระดาน ----------
  function makeCam(eDeg, dist) {
    const e = eDeg * Math.PI / 180, t = [0, 0, 0], c = [0, dist * Math.sin(e), dist * Math.cos(e)];
    const f = norm(sub(t, c)), r = norm(cross(f, [0, 1, 0])), u = cross(r, f);
    const fl = 1.5 * H, cx = W / 2, cy = .83 * H; // .83: ตัวราชินีลงมาเว้นที่ให้แถบเลือดเหนือหัว (เดิม .76)
    const P = (x, y, z) => { const d = [x - c[0], y - c[1], z - c[2]]; const zc = dot(d, f); return [cx + fl * dot(d, r) / zc, cy - fl * dot(d, u) / zc, zc]; };
    P.pos = c;
    return P;
  }
  function layout() {
    const P = makeCam(CAM_E, CAM_D);
    const edgeY = P(0, 0, -5.1)[1];
    L = { P, edgeY, h: (edgeY + 2 - .008 * H) / ART.edgeCut };
  }
  function bodyRect(pose) {
    const hh = L.h * (1 + (pose?.s || 0)), ww = hh * A.w / A.h;
    return { x: W / 2 - ww / 2 + (pose?.dx || 0), y: L.edgeY + 2 - ART.edgeCut * hh + (pose?.dy || 0), w: ww, h: hh };
  }
  const imgPt = (R, x, y) => [R.x + x * R.w, R.y + y * R.h];

  // ---------- ฉากหลังสนาม + กระดาน (อบครั้งเดียวต่อขนาดจอ) ----------
  function drawVoid(g) {
    const gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, "#160b2c"); gr.addColorStop(.45, "#0b0619"); gr.addColorStop(1, "#05030b");
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    const hx = W / 2, hy = H * .3;
    const halo = g.createRadialGradient(hx, hy, 0, hx, hy, H * .62);
    halo.addColorStop(0, "rgba(150,90,255,.34)"); halo.addColorStop(.45, "rgba(100,60,220,.12)"); halo.addColorStop(1, "rgba(60,30,140,0)");
    g.fillStyle = halo; g.fillRect(0, 0, W, H);
    g.save(); g.globalCompositeOperation = "lighter";
    for (let i = 0; i < 3; i++) { g.strokeStyle = `rgba(190,150,255,${.16 - i * .04})`; g.lineWidth = 1.5; g.beginPath(); g.arc(hx, hy, H * (.3 + i * .09), 0, 6.29); g.stroke(); }
    let s = 7;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 70; i++) {
      const x = rnd() * W, y = rnd() * H * .7, r = .6 + rnd() * 1.6;
      g.fillStyle = `rgba(200,170,255,${.15 + rnd() * .35})`; g.beginPath(); g.arc(x, y, r, 0, 6.29); g.fill();
    }
    g.restore();
  }
  function quad(g, P, pts, fill, stroke, lw) {
    g.beginPath();
    pts.forEach(([x, z], i) => { const p = P(x, 0, z); i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); });
    g.closePath();
    if (fill) { g.fillStyle = fill; g.fill(); }
    if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw || 1; g.stroke(); }
  }
  function drawCard(g, P, c, mark) { // ไพ่ยักษ์ตั้งเอนท้ายกระดาน
    const right = rotY([1, 0, 0], c.rot), up = rotY([0, Math.cos(c.lean), -Math.sin(c.lean)], c.rot);
    const b = [c.x, 0, c.z];
    const at = (u, v) => P(b[0] + right[0] * u + up[0] * v, b[1] + right[1] * u + up[1] * v, b[2] + right[2] * u + up[2] * v);
    const TL = at(-c.w / 2, c.h), TR = at(c.w / 2, c.h), BL = at(-c.w / 2, 0);
    const s0 = P(c.x, 0, c.z), s1 = P(c.x + c.w * .6, 0, c.z);
    g.fillStyle = "rgba(0,0,0,.45)"; g.beginPath(); g.ellipse(s0[0], s0[1], Math.abs(s1[0] - s0[0]), Math.abs(s1[0] - s0[0]) * .18, 0, 0, 6.29); g.fill();
    g.save();
    g.transform((TR[0] - TL[0]) / 100, (TR[1] - TL[1]) / 100, (BL[0] - TL[0]) / 140, (BL[1] - TL[1]) / 140, TL[0], TL[1]);
    g.fillStyle = "#f3eefb"; roundRect(g, 0, 0, 100, 140, 7); g.fill();
    g.strokeStyle = "#7a4fe0"; g.lineWidth = 2.2; roundRect(g, 6, 6, 88, 128, 4); g.stroke();
    g.fillStyle = "#6a3fd6"; g.font = `700 22px ${FONT_D}`; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(mark, 16, 20); heartPath(g, 16, 38, 6); g.fill();
    g.save(); g.translate(84, 120); g.rotate(Math.PI); g.fillText(mark, 0, 0); heartPath(g, 0, 18, 6); g.fill(); g.restore();
    const hg = g.createLinearGradient(30, 40, 70, 100); hg.addColorStop(0, "#b47bff"); hg.addColorStop(1, "#5a3be0");
    g.fillStyle = hg; heartPath(g, 50, 78, 26); g.fill();
    g.fillStyle = "#f3eefb"; g.font = `700 26px ${FONT_D}`; g.fillText(mark, 50, 70);
    g.restore();
  }
  function drawDie(g, P, d) { // ลูกเต๋ายักษ์ 3D
    const s = d.s, hs = s / 2, c = [d.x, d.y + hs, d.z];
    const f0 = P(d.x, 0, d.z), f1 = P(d.x + s * .75, 0, d.z);
    g.fillStyle = `rgba(0,0,0,${.5 * clamp01(1 - d.y / 6)})`; g.beginPath(); g.ellipse(f0[0], f0[1], Math.abs(f1[0] - f0[0]), Math.abs(f1[0] - f0[0]) * .3, 0, 0, 6.29); g.fill();
    const faces = [
      { n: [0, 1, 0], a: [1, 0, 0], b: [0, 0, 1], v: d.v[0] },
      { n: [0, 0, 1], a: [1, 0, 0], b: [0, -1, 0], v: d.v[1] },
      { n: [1, 0, 0], a: [0, 0, -1], b: [0, -1, 0], v: d.v[2] },
      { n: [-1, 0, 0], a: [0, 0, 1], b: [0, -1, 0], v: 7 - d.v[2] },
      { n: [0, 0, -1], a: [-1, 0, 0], b: [0, -1, 0], v: 7 - d.v[1] },
    ].map((f) => ({ ...f, n: rotY(f.n, d.rot), a: rotY(f.a, d.rot), b: rotY(f.b, d.rot) }));
    const cam = P.pos, light = norm([-.4, 1, .5]);
    const vis = faces.map((f) => ({ ...f, cc: [c[0] + f.n[0] * hs, c[1] + f.n[1] * hs, c[2] + f.n[2] * hs] }))
      .filter((f) => dot(f.n, sub(cam, f.cc)) > 0)
      .sort((p, q) => Math.hypot(...sub(q.cc, cam)) - Math.hypot(...sub(p.cc, cam)));
    for (const f of vis) {
      const pt = (u, v) => P(f.cc[0] + (f.a[0] * u + f.b[0] * v) * hs, f.cc[1] + (f.a[1] * u + f.b[1] * v) * hs, f.cc[2] + (f.a[2] * u + f.b[2] * v) * hs);
      const k = .62 + .38 * Math.max(0, dot(f.n, light));
      g.beginPath(); [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([u, v], i) => { const p = pt(u, v); i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); }); g.closePath();
      g.fillStyle = `rgb(${Math.round(243 * k)},${Math.round(236 * k)},${Math.round(252 * k)})`; g.fill();
      g.strokeStyle = "rgba(42,26,80,.7)"; g.lineWidth = 1.2; g.stroke();
      g.fillStyle = "#5b34c9";
      for (const [pu, pv] of PIPS[f.v]) {
        g.beginPath();
        for (let i = 0; i < 10; i++) { const a = i / 10 * 6.283, p = pt(pu * .5 + Math.cos(a) * .16, pv * .5 + Math.sin(a) * .16); i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); }
        g.fill();
      }
    }
  }
  // o.vanish 0→1 (ฉากออก): ช่องกระดานพลิกหายเป็นคลื่นจากฝั่งราชินี (ขอบไกล) มาหาฝั่งเรา
  function drawBoardScene(g, P, o = {}) {
    const cardK = o.cards ?? 1, van = o.vanish ?? 0, keep = 1 - van;
    if (cardK > 0) {
      drawCard(g, P, { x: -5.9, z: -6.6, w: 2.1, h: 3, rot: .38, lean: lerp(1.5, .18, cardK) }, "Q");
      drawCard(g, P, { x: 6, z: -6.8, w: 2.1, h: 3, rot: -.34, lean: lerp(1.5, .22, cardK) }, "E");
    }
    const c = P(0, 0, 0);
    g.save(); g.globalAlpha = keep;
    const glow = g.createRadialGradient(c[0], c[1], 0, c[0], c[1], W * .55);
    glow.addColorStop(0, "rgba(120,70,255,.22)"); glow.addColorStop(1, "rgba(120,70,255,0)");
    g.fillStyle = glow; g.fillRect(0, 0, W, H);
    quad(g, P, [[-5.15, -5.15], [5.15, -5.15], [5.15, 5.15], [-5.15, 5.15]], "#0c0916");
    quad(g, P, [[-4.85, -4.85], [4.85, -4.85], [4.85, 4.85], [-4.85, 4.85]], null, `rgba(${PURPLE},.85)`, 1.6);
    g.restore();
    for (let i = 0; i < 9; i++) for (let j = 0; j < 9; j++) {
      const x0 = -4.5 + i, z0 = -4.5 + j;
      const v = van > 0 ? clamp01((van * 1.55 - (j + Math.abs(i - 4) * .45) / 10.8) / .3) : 0;
      if (v >= 1) continue;
      const s = .5 * (1 - v * v), cx = x0 + .5, cz = z0 + .5;
      const pts = [[cx - s, cz - s], [cx + s, cz - s], [cx + s, cz + s], [cx - s, cz + s]];
      quad(g, P, pts, (i + j) % 2 ? "#1b1431" : "#cfc4ec");
      if (v > 0) quad(g, P, pts, `rgba(${PURPLE},${.7 * Math.sin(v * Math.PI)})`, `rgba(235,215,255,${1 - v})`, 1.5);
    }
    if (keep > 0) {
      const tl = P(-4.5, 0, -4.5), br = P(4.5, 0, 4.5);
      const sh = g.createLinearGradient(tl[0], tl[1], br[0], br[1]);
      sh.addColorStop(0, `rgba(255,255,255,${.07 * keep})`); sh.addColorStop(.5, "rgba(255,255,255,0)"); sh.addColorStop(1, `rgba(40,10,90,${.25 * keep})`);
      quad(g, P, [[-4.5, -4.5], [4.5, -4.5], [4.5, 4.5], [-4.5, 4.5]], sh);
    }
    drawDie(g, P, { x: -6.5, z: -2.4, s: 1.35, rot: .48 + (o.dieSpin || 0), y: o.dieY?.[0] ?? 0, v: [5, 3, 6] });
    drawDie(g, P, { x: 6.4, z: -3.7, s: 1.1, rot: -.72 - (o.dieSpin || 0) * 1.3, y: o.dieY?.[1] ?? 0, v: [2, 1, 4] });
    g.save(); g.globalCompositeOperation = "lighter"; g.globalAlpha = keep;
    const sp = g.createRadialGradient(c[0], c[1] - H * .05, 0, c[0], c[1], W * .42);
    sp.addColorStop(0, "rgba(200,170,255,.16)"); sp.addColorStop(1, "rgba(200,170,255,0)");
    g.fillStyle = sp; g.fillRect(0, 0, W, H);
    g.restore();
  }
  function bake() {
    bgBake = mk(W * dpr, H * dpr); const bg = bgBake.getContext("2d"); bg.setTransform(dpr, 0, 0, dpr, 0, 0); drawVoid(bg);
    boardBake = mk(W * dpr, H * dpr); const bb = boardBake.getContext("2d"); bb.setTransform(dpr, 0, 0, dpr, 0, 0); drawBoardScene(bb, L.P);
  }

  // ---------- อนุภาค / เอฟเฟกต์ ----------
  function sparks(x, y, n, sp, o = {}) {
    const k = calm ? Math.ceil(n / 4) : n;
    for (let i = 0; i < k; i++) {
      const a = o.up ? -Math.PI / 2 + (Math.random() - .5) * 1.4 : Math.random() * 6.28, v = sp * (.35 + Math.random() * .65);
      parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: o.g ?? 160, life: o.life ?? 1, max: o.life ?? 1, s: 1.8 + Math.random() * 3, heart: !o.sq && Math.random() < (o.hearts ?? .25), sq: o.sq, col: Math.random() < (o.white ?? 0) ? "255,240,255" : Math.random() < .5 ? PURPLE : VIOLET });
    }
  }
  function pixelDust(x0, x1, y, n) { // เศษพิกเซลลอยขึ้น (ร่างสลาย)
    const k = calm ? Math.ceil(n / 4) : n;
    for (let i = 0; i < k; i++) parts.push({ x: lerp(x0, x1, Math.random()), y: y + (Math.random() - .5) * 6, vx: (Math.random() - .5) * 50, vy: -(50 + Math.random() * 140), g: -40, life: .6 + Math.random() * .6, max: 1.2, s: 2 + Math.random() * 4, sq: true, col: Math.random() < .3 ? "255,240,255" : Math.random() < .5 ? PURPLE : "70,225,255" });
  }
  function inflow(tx, ty, n, rad) {
    const k = calm ? Math.ceil(n / 4) : n;
    for (let i = 0; i < k; i++) { const a = Math.random() * 6.28, d = rad * (.6 + Math.random() * .6); parts.push({ x: tx + Math.cos(a) * d, y: ty + Math.sin(a) * d, tx, ty, t: -Math.random() * .25, dur: .35 + Math.random() * .25, s: 1.5 + Math.random() * 2.5, col: PURPLE, life: 2, max: 2 }); }
  }
  const ring = (x, y, r0, grow, life, flat = .25, col = PURPLE, lw = 4) => rings.push({ x, y, r: r0, grow, life, max: life, flat, col, lw });
  const addText = (text, color, size, x, y, life = 1.3) => texts.push({ text, color, size, x, y, vy: -34, life, max: life });
  const boardFlashAt = (x, z) => { tileFlash.push({ x, z, t: 0 }); boardRings.push({ x, z, r: .2, life: .8, max: .8 }); };

  // กลิตช์ทั้งจอบน canvas ที่ระบุ: ถ่ายภาพ 1 ครั้ง → แถบเลื่อน + เงาเหลื่อมในแถบ + แถบสี + บล็อกสัญญาณเสีย + เส้นสแกน
  //  งบ GPU: ภาพเต็มจอแค่ 2 รอบต่อเฟรม (ถ่าย + เส้นสแกน) ที่เหลือเป็นแถบบางๆ · ทำงานเฉพาะช่วงกลิตช์สั้นๆ
  let snapCv = null, scanPat = null;
  function glitchPost(cv, g, amt) {
    if (calm || amt <= 0) return;
    const a = Math.min(1, amt), dw = cv.width, dh = cv.height;
    if (!snapCv || snapCv.width !== dw || snapCv.height !== dh) snapCv = mk(dw, dh);
    const sg = snapCv.getContext("2d");
    sg.clearRect(0, 0, dw, dh); sg.drawImage(cv, 0, 0);
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
    const n = 3 + Math.round(a * 9), off = dw * .008 * a;
    for (let i = 0; i < n; i++) {
      const h = dh * (.006 + Math.random() * .07 * a), y = Math.random() * (dh - h), dx = (Math.random() - .5) * dw * .14 * a;
      g.drawImage(snapCv, 0, y, dw, h, dx, y, dw, h);
      if (i % 2) { g.globalCompositeOperation = "lighter"; g.globalAlpha = .3 * a; g.drawImage(snapCv, 0, y, dw, h, dx + off, y, dw, h); g.globalCompositeOperation = "source-over"; g.globalAlpha = 1; }
    }
    g.globalCompositeOperation = "lighter";
    for (let i = 0; i < 2 + a * 5; i++) {
      g.fillStyle = Math.random() < .5 ? `rgba(255,40,140,${.18 * a})` : `rgba(40,230,255,${.18 * a})`;
      g.fillRect(0, Math.random() * dh, dw, dh * (.004 + Math.random() * .02));
    }
    g.globalCompositeOperation = "source-over";
    for (let i = 0; i < 4 + a * 14; i++) {
      g.fillStyle = Math.random() < .5 ? `rgba(${PURPLE},${.55 * a})` : `rgba(240,230,255,${.4 * a})`;
      g.fillRect(Math.random() * dw, Math.random() * dh, dw * (.01 + Math.random() * .06), dh * (.008 + Math.random() * .03));
    }
    if (!scanPat) { const p = mk(4, 4), pg = p.getContext("2d"); pg.fillStyle = "rgba(0,0,0,.35)"; pg.fillRect(0, 0, 4, 1); scanPat = g.createPattern(p, "repeat"); }
    g.globalAlpha = .6 * a; g.fillStyle = scanPat; g.fillRect(0, 0, dw, dh);
    g.restore();
  }
  function glitchText(g, text, x, y, font, k, main = "#f6f0ff") {
    g.save(); g.font = font; g.textAlign = "center"; g.textBaseline = "middle";
    const j = () => (Math.random() - .5) * 26 * k;
    g.fillStyle = "rgba(255,40,140,.7)"; g.fillText(text, x + j() - 4 * k, y + j() * .2);
    g.fillStyle = "rgba(40,200,255,.7)"; g.fillText(text, x + j() + 4 * k, y + j() * .2);
    g.fillStyle = main; g.fillText(text, x + j() * .3, y);
    g.restore();
  }
  function flatCard(g, x, y, w, rot, mark) {
    const h = w * 1.4;
    g.save(); g.translate(x, y); g.rotate(rot); g.scale(w / 100, h / 140); g.translate(-50, -70);
    g.fillStyle = "rgba(0,0,0,.35)"; roundRect(g, 5, 7, 100, 140, 7); g.fill();
    g.fillStyle = "#f3eefb"; roundRect(g, 0, 0, 100, 140, 7); g.fill();
    g.strokeStyle = "#7a4fe0"; g.lineWidth = 2.2; roundRect(g, 6, 6, 88, 128, 4); g.stroke();
    const hg = g.createLinearGradient(30, 40, 70, 100); hg.addColorStop(0, "#b47bff"); hg.addColorStop(1, "#5a3be0");
    g.fillStyle = hg; heartPath(g, 50, 78, 26); g.fill();
    g.fillStyle = "#6a3fd6"; g.font = `700 22px ${FONT_D}`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(mark, 16, 20);
    g.fillStyle = "#f3eefb"; g.font = `700 26px ${FONT_D}`; g.fillText(mark, 50, 70);
    g.restore();
  }

  // ---------- จังหวะของแต่ละท่า ----------
  function landHands() {
    shake(16); fx.flash = .35; fx.flashCol = PURPLE;
    const R = bodyRect();
    for (const [ex, ey] of ART.elbows) {
      const [px, py] = imgPt(R, ex, ey);
      ring(px, py, 8, W * .2, .7, .3, PURPLE, 4);
      sparks(px, py, 16, 260, { up: true, hearts: .2 });
    }
    boardFlashAt(-2, -4.5); boardFlashAt(2, -4.5);
  }
  let shardCv = null;
  function shatter() { // จอโคลสอัปแตกเป็นช่องสี่เหลี่ยม (ธีมกระดาน) — ถ่ายภาพ fx ณ ตอนนั้นครั้งเดียว
    shards = [];
    if (calm) return;
    shardCv = mk(fxCv.width, fxCv.height); shardCv.getContext("2d").drawImage(fxCv, 0, 0);
    const cols = 16, rows = 9, tw = W / cols, th = H / rows;
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      const cx = (i + .5) * tw, cy = (j + .5) * th, d = Math.hypot(cx - W / 2, cy - H / 2) / Math.hypot(W / 2, H / 2);
      shards.push({ i, j, tw, th, x: cx, y: cy, vx: (cx - W / 2) * (.4 + Math.random() * .6), vy: -H * (.1 + Math.random() * .25), rot: 0, vr: (Math.random() - .5) * 7, delay: d * .22 + Math.random() * .06, t: 0 });
    }
  }
  function drawShards(g, dt) {
    if (!shards.length) return;
    const sx = fxCv.width / W, sy = fxCv.height / H;
    for (const s of shards) {
      s.t += dt;
      const t = s.t - s.delay;
      if (t > 0) { s.x += s.vx * dt; s.y += s.vy * dt; s.vy += H * 2.6 * dt; s.rot += s.vr * dt; }
      const a = 1 - clamp01((t - .15) / .5), sc = 1 - clamp01(t / .7) * .35;
      if (a <= 0) continue;
      g.save(); g.globalAlpha = a; g.translate(s.x, s.y); g.rotate(s.rot); g.scale(sc, sc);
      g.drawImage(shardCv, s.i * s.tw * sx, s.j * s.th * sy, s.tw * sx, s.th * sy, -s.tw / 2, -s.th / 2, s.tw + .5, s.th + .5);
      if (t > 0) { g.strokeStyle = `rgba(235,215,255,${.8 * a})`; g.lineWidth = 1.5; g.strokeRect(-s.tw / 2, -s.th / 2, s.tw, s.th); }
      g.restore();
    }
    shards = shards.filter((s) => s.t - s.delay < .7);
  }
  function impact() {
    const o = act.opts, [tx, ty] = o.at;
    fx.hitstop = calm ? 0 : .12; fx.flash = o.me ? 1 : .6; fx.flashCol = "255,255,255"; shake(o.me ? 28 : 18);
    bursts.push({ x: tx, y: ty, life: .5, max: .5, seed: Math.random() * 6.28, big: o.me });
    ring(tx, ty, 8, W * (o.me ? .7 : .3), .65, o.me ? .5 : .55, PURPLE, 6);
    sparks(tx, ty, 46, o.me ? 760 : 420, { hearts: .2, g: 300, life: .9 });
  }
  function exitWave() {
    const R = bodyRect(), [gx, gy] = imgPt(R, ART.globe[0], ART.globe[1]), [wx, wy] = imgPt(R, ART.winkEye[0], ART.winkEye[1]);
    glitch(.5); shake(5);
    sparks(gx, gy, 40, 380, { hearts: .7, g: 60, life: 1.1, white: .3 });
    ring(gx, gy, 6, W * .16, .6, 1, "255,240,255", 3);
    sparks(wx, wy, 10, 140, { hearts: 1, g: -20, life: .9 });
  }
  function backToBoard() { // ฉากออกจบ: ล้างสนาม เผยกระดานปกติ + วงหัวใจที่ที่นั่ง Echo
    setMode("none"); fx.flash = 1; fx.flashCol = "255,255,255"; glitch(.9);
    if (seat) { ring(seat[0], seat[1], 6, W * .2, .8, .55, PURPLE, 4); sparks(seat[0], seat[1], 26, 260, { hearts: .8, g: 40, life: 1 }); }
  }
  const EVENTS = {
    transform: [
      [0, () => setMode("arena")],
      [.3, () => glitch(.25)], [.62, () => glitch(.4)], [.9, () => { glitch(.6); shake(4); }],
      [1.12, () => glitch(.75)], [1.32, () => { glitch(.9); shake(6); }],
      [T.cut, () => { setMode("cut"); glitch(.5); }],
      [T.beat1, () => ring(W / 2, H * .5, 10, W * .5, .9, 1, PURPLE, 3)],
      [T.beat2, () => { ring(W / 2, H * .5, 10, W * .6, .9, 1, "255,255,255", 2); ring(W / 2, H * .5, 10, W * .5, .8, 1, PURPLE, 4); glitch(.2); }],
      [T.beat3, () => { ring(W / 2, H * .5, 10, W * .8, 1.1, 1, "255,255,255", 3); ring(W / 2, H * .5, 10, W * .6, .9, 1, PURPLE, 5); shake(7); glitch(.45); }],
      [T.grow, () => { fx.flash = .6; fx.flashCol = PURPLE; sparks(W / 2, H * .5, 60, 650, { hearts: .5, g: 0, life: 1.2 }); }],
      [T.grow + .5, () => inflow(W / 2, H * .3, 70, W * .45)],
      [T.grow + 1.1, () => glitch(.3)],
      [T.wipe, () => glitch(1.1)], [T.wipe + .55, () => { glitch(.8); shake(6); }], [T.wipe + 1.0, () => glitch(.5)],
      [T.shuffle, () => glitch(.35)],
      [T.face, () => { fx.flash = .25; fx.flashCol = "255,255,255"; }],
      [T.face + .5, () => sparks(W / 2, H * .55, 24, 120, { hearts: 1, g: -50, life: 1.6 })],
      [T.face + 1.05, () => glitch(.3)], [T.face + 1.8, () => glitch(.55)],
      [T.smash, () => { shatter(); setMode("field"); fx.flash = .7; fx.flashCol = "255,255,255"; shake(10); glitch(.4); }],
      [T.smash + REVEAL * .86, () => landHands()],
      [T.smash + REVEAL * .94, () => {
        glitch(.3); const R = bodyRect(); ring(W / 2, R.y + R.h * .35, 10, W * .4, .9, .45, "255,240,255", 2);
        addText("+5", "#9dffc8", 52, R.x + R.w * .36, R.y + R.h * .3, 1.6); // ท่าไม้ตายฟื้นพลังชีวิต 5
        sparks(R.x + R.w * .36, R.y + R.h * .38, 18, 160, { hearts: 1, g: -60, life: 1.2 });
      }],
    ],
    punch: [[.44, () => impact()]],
    hit: [[0, () => {
      fx.hit = 1; shake(9);
      const R = bodyRect();
      sparks(R.x + R.w * (.38 + Math.random() * .22), R.y + R.h * .3, 18, 300, { hearts: 0 });
      if (act.opts.dmg > 0) addText(`−${act.opts.dmg}`, "#ffd0dc", 44, R.x + R.w * .6, R.y + R.h * .26);
    }]],
    exit: [
      [EXIT.wink, () => exitWave()],
      [EXIT.melt0, () => glitch(.35)], [EXIT.melt1 - .08, () => glitch(.45)],
      [EXIT.board0, () => { shake(6); boardFlashAt(0, -4.5); }],
      [EXIT.back - .03, () => glitch(.8)],
      [EXIT.back, () => backToBoard()],
    ],
  };
  function play(name, opts = {}) {
    act = { name, t: 0, dur: ACTS[name], opts, ev: (EVENTS[name] || []).map(([at, fn]) => ({ at, fn, done: false })) };
    if (name === "transform") { parts = []; rings = []; texts = []; bursts = []; boardRings = []; tileFlash = []; shards = []; }
    start();
  }
  // ท่าที่ขอมาก่อนภาพพร้อม/ระหว่างท่าอื่น: ฉากเปิดตัว/ฉากออกแทรกทันที · ต่อย/โดนตีระหว่างฉากใหญ่ทิ้งไป (การ์ดสรุปการโจมตีบอกผลอยู่แล้ว)
  function request(name, opts) {
    if (!A || !L) { if (name === "transform" || name === "exit" || name === "field") pending = { name, opts }; return; }
    if (name === "field") { act = null; setMode("field"); start(); return; }
    if ((name === "punch" || name === "hit") && (mode !== "field" || (act && (act.name === "transform" || act.name === "exit")))) return;
    play(name, opts);
  }

  // ---------- วาด: ฉากเปิดตัวช่วงแรก (ทับกระดานจริงแบบโปร่ง) ----------
  function drawArenaOverlay(g, t) {
    if (seat) { // การ์ดที่นั่ง Echo เรืองเต้นเป็นจังหวะ
      const k = .5 + .5 * Math.sin(t * 14) * (t < .2 ? t / .2 : 1);
      g.save(); g.globalCompositeOperation = "lighter";
      const r = Math.min(W, H) * .16, gr = g.createRadialGradient(seat[0], seat[1], 0, seat[0], seat[1], r);
      gr.addColorStop(0, `rgba(${PURPLE},${.75 * k})`); gr.addColorStop(1, `rgba(${PURPLE},0)`);
      g.fillStyle = gr; g.fillRect(seat[0] - r, seat[1] - r, r * 2, r * 2); g.restore();
    }
    // ระหว่างกลิตช์: ภาพราชินีแวบทับทั้งจอ + "ECHO" สัญญาณเสีย
    if (fx.glitch > .2 && !calm) {
      const C = A.cut, h = H * 1.05, w = h * C.w / C.h;
      g.save(); g.globalAlpha = Math.min(.6, fx.glitch * .7);
      g.drawImage(Math.random() < .7 ? C.ghost : C.cyan, W / 2 - w / 2 + (Math.random() - .5) * W * .03, -H * .02, w, h);
      g.restore();
      g.save(); g.globalAlpha = Math.min(1, fx.glitch * 1.3);
      glitchText(g, "ECHO", W / 2, H * .42, `700 ${Math.round(H * .16)}px ${FONT_D}`, fx.glitch, "#1d0b3d");
      g.restore();
    }
    // ม่านมืดหุบเข้าหาที่นั่งของ Echo
    const ir = seg(t, 1.0, T.cut);
    if (ir > 0) {
      const [x, y] = seat || [W / 2, H / 2], r = lerp(Math.hypot(W, H), 0, easeInOut(ir));
      const gr = g.createRadialGradient(x, y, Math.max(0, r * .7), x, y, Math.max(1, r));
      gr.addColorStop(0, "rgba(6,3,13,0)"); gr.addColorStop(1, "rgba(6,3,13,1)");
      g.fillStyle = gr; g.fillRect(-20, -20, W + 40, H + 40);
      if (r < W * .2) { g.fillStyle = `rgba(6,3,13,${1 - r / (W * .2)})`; g.fillRect(-20, -20, W + 40, H + 40); }
    }
  }
  // ---------- วาด: ฉากตัด (มืด → หัวใจ → ร่างงอก → โคลสอัป) ----------
  function drawCutVoid(g, k) {
    g.fillStyle = "#06030d"; g.fillRect(0, 0, W, H);
    const gr = g.createRadialGradient(W / 2, H * .5, 0, W / 2, H * .5, W * .6);
    gr.addColorStop(0, `rgba(110,50,220,${.28 * k})`); gr.addColorStop(1, "rgba(40,10,90,0)");
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
  }
  function drawTiles(g, k) { // กระดานงอกออกจากกลางจอ (มองตรงลง)
    const ts = H * .085, cx = W / 2, cy = H * .5, R = easeOut(k) * W * .85, band = W * .12;
    const nx = Math.ceil(W / ts / 2) + 1, nz = Math.ceil(H / ts / 2) + 1;
    for (let i = -nx; i <= nx; i++) for (let j = -nz; j <= nz; j++) {
      const x = cx + (i - .5) * ts, y = cy + (j - .5) * ts, d = Math.hypot(x + ts / 2 - cx, y + ts / 2 - cy);
      if (d > R) continue;
      const a = clamp01((R - d) / band), fl = Math.abs(Math.cos((1 - a) * Math.PI / 2));
      g.fillStyle = (i + j) & 1 ? `rgba(207,196,236,${.2 * a})` : `rgba(27,20,49,${.75 * a})`;
      g.fillRect(x, y + ts * (1 - fl) / 2, ts - 1, ts * fl - 1);
      if (a < 1) { g.fillStyle = `rgba(220,200,255,${.5 * (1 - a)})`; g.fillRect(x, y + ts * (1 - fl) / 2, ts - 1, 2); }
    }
  }
  function cutBodyRect(s, anchorY) {
    const h = H * .97 * s, w = h * A.cut.w / A.cut.h;
    return { x: W / 2 - CUT.heart.x * w, y: anchorY - CUT.heart.y * h, w, h };
  }
  function drawAura(g, R, a, S) {
    if (calm || a <= 0) return;
    const k = R.w / S.w * S.auraQ, p = S.auraPad * k;
    g.save(); g.globalCompositeOperation = "lighter"; g.globalAlpha = a; g.drawImage(S.aura, R.x - p, R.y - p, R.w + p * 2, R.h + p * 2); g.restore();
  }
  function drawShuffle(g, t) { // ไพ่ปลิวปาดจอจากขวาไปซ้าย (บังรอยต่อร่างเต็มตัว → โคลสอัป)
    const n = calm ? 6 : 14;
    for (let i = 0; i < n; i++) {
      const k = seg(t, T.shuffle + i * .025, T.shuffle + .55 + i * .025);
      if (k <= 0 || k >= 1) continue;
      const e = easeInOut(k), row = (i * 5 % n) / n;
      const x = lerp(W * 1.25, -W * .25, e), y = H * (.08 + row * .9) + Math.sin(e * 3 + i) * H * .05;
      flatCard(g, x, y, H * (.2 + (i % 3) * .05), (i % 2 ? -1 : 1) * (.3 + e * 1.4), i % 2 ? "Q" : "E");
    }
  }
  function drawCut(g, t) {
    const C = A.cut;
    if (t < T.grow) { // หัวใจเต้น 3 จังหวะ (จังหวะสุดท้ายแรงสุด)
      drawCutVoid(g, seg(t, T.cut, T.cut + .3));
      const pulse = (b, k) => Math.exp(-Math.max(0, t - b) * 9) * (t > b) * k;
      const beat = pulse(T.beat1, 1) + pulse(T.beat2, 1) + pulse(T.beat3, 1.6);
      const s = H * .07 * (1 + .28 * beat) * easeOutBack(seg(t, T.cut, T.cut + .35));
      g.save(); g.globalCompositeOperation = "lighter";
      for (const [lw, a] of [[16, .12], [8, .3], [2.5, 1]]) { g.strokeStyle = lw < 3 ? `rgba(255,245,255,${a})` : `rgba(${PURPLE},${a})`; g.lineWidth = lw; heartPath(g, W / 2, H * .5, s); g.stroke(); }
      g.fillStyle = `rgba(${PURPLE},${.15 + .35 * beat})`; heartPath(g, W / 2, H * .5, s); g.fill();
      g.restore();
      return;
    }
    if (t < T.face) { // ร่างงอกจากปอยผม + กระดานงอก → ไล่สีจากบนลงล่าง
      drawCutVoid(g, 1);
      drawTiles(g, seg(t, T.grow, T.wipe + .4));
      const growK = (tt) => easeOutBack(seg(tt, T.grow, T.wipe - .2));
      const anchorAt = (tt) => lerp(H * .5, H * .03 + CUT.heart.y * H * .97, easeInOut(seg(tt, T.grow, T.wipe - .2)));
      if (!calm) for (const lag of [.08, .16]) {
        const g2 = growK(t - lag);
        if (g2 > 0 && g2 < .99) { const R2 = cutBodyRect(lerp(.035, 1, g2), anchorAt(t - lag)); g.save(); g.globalCompositeOperation = "lighter"; g.globalAlpha = .28 - lag; g.drawImage(C.ghost, R2.x, R2.y, R2.w, R2.h); g.restore(); }
      }
      const R = cutBodyRect(lerp(.035, 1, growK(t)), anchorAt(t));
      drawAura(g, R, .9, C);
      const split = calm ? 0 : W * (.014 * (1 - seg(t, T.grow, T.wipe)) + .012 * Math.min(1, fx.glitch));
      if (split > .5) {
        g.save(); g.globalCompositeOperation = "lighter"; g.globalAlpha = .5;
        g.drawImage(C.ghost, R.x - split, R.y, R.w, R.h); g.drawImage(C.cyan, R.x + split, R.y, R.w, R.h);
        g.restore();
      }
      const wy = t < T.wipe ? -1 : R.y + R.h * easeInOut(seg(t, T.wipe, T.shuffle + .1));
      const slices = fx.glitch > 0 && !calm ? 12 : 1;
      for (let i = 0; i < slices; i++) {
        const dh = R.h / slices, off = slices > 1 && Math.random() < .5 ? (Math.random() - .5) * R.w * .12 : 0;
        const y = R.y + i * dh;
        const drawPart = (img, y0, y1) => {
          const a0 = Math.max(y, y0), a1 = Math.min(y + dh, y1);
          if (a1 <= a0) return;
          g.drawImage(img, 0, (a0 - R.y) / R.h * C.h, C.w, (a1 - a0) / R.h * C.h, R.x + off, a0, R.w, a1 - a0);
        };
        drawPart(C.fade, -1e9, wy);
        drawPart(C.white, wy, 1e9);
      }
      if (wy > 0 && wy < R.y + R.h) {
        g.save(); g.globalCompositeOperation = "lighter";
        const lg = g.createLinearGradient(0, wy - 18, 0, wy + 18);
        lg.addColorStop(0, `rgba(${PURPLE},0)`); lg.addColorStop(.5, "rgba(255,240,255,.9)"); lg.addColorStop(1, `rgba(${PURPLE},0)`);
        g.fillStyle = lg; g.fillRect(R.x - 40, wy - 18, R.w + 80, 36); g.restore();
      }
      if (t >= T.shuffle) drawShuffle(g, t);
      return;
    }
    // โคลสอัปดวงตา + ชื่อท่า (แถบดำบนล่างเลื่อนเข้า)
    const k = seg(t, T.face, T.smash);
    g.fillStyle = "#000"; g.fillRect(0, 0, W, H);
    const bar = H * .13 * easeOut(seg(t, T.face, T.face + .35)), vh = H - bar * 2;
    const cw = CUT.face.w * C.w / (1 + .16 * easeOut(k)), ch = cw * vh / W;
    const sx = CUT.face.cx * C.w - cw / 2, sy = CUT.face.cy * C.h - ch / 2;
    g.drawImage(C.full, sx, sy, cw, ch, 0, bar, W, vh);
    const tone = g.createLinearGradient(0, bar, 0, H - bar);
    tone.addColorStop(0, "rgba(40,10,90,.25)"); tone.addColorStop(1, "rgba(40,10,90,.45)");
    g.fillStyle = tone; g.fillRect(0, bar, W, vh);
    g.save(); g.globalCompositeOperation = "lighter";
    const tw = Math.sin(seg(t, T.face + .35, T.face + .85) * Math.PI) + 1.25 * Math.sin(seg(t, T.face + 1.45, T.face + 1.85) * Math.PI);
    for (const [ex, ey] of CUT.eyes) {
      const x = (ex * C.w - sx) / cw * W, y = bar + (ey * C.h - sy) / ch * vh, r = H * .05 * tw;
      if (r <= 0) continue;
      g.fillStyle = "rgba(255,240,255,.95)";
      g.beginPath(); g.moveTo(x, y - r); g.lineTo(x + r * .16, y); g.lineTo(x, y + r); g.lineTo(x - r * .16, y); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(x - r, y); g.lineTo(x, y + r * .16); g.lineTo(x + r, y); g.lineTo(x, y - r * .16); g.closePath(); g.fill();
    }
    g.restore();
    g.fillStyle = "#000"; g.fillRect(0, 0, W, bar); g.fillRect(0, H - bar, W, bar);
    const ta = seg(t, T.face + .5, T.face + 1.0);
    if (ta > 0) {
      const fs = Math.round(H * .075), y = H - bar / 2, jitter = Math.max(1 - ta, Math.min(1, fx.glitch));
      g.save(); g.globalAlpha = ta < 1 ? (Math.random() < .25 ? .3 : 1) * ta : 1;
      g.fillStyle = `rgba(${PURPLE},.9)`; g.font = `700 ${fs}px ${FONT_D}`; g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText("นี่มันเกมของฉัน", W / 2 + 3, y + 3);
      glitchText(g, "นี่มันเกมของฉัน", W / 2, y, `700 ${fs}px ${FONT_D}`, calm ? 0 : jitter);
      g.restore();
      const ts = seg(t, T.face + .8, T.face + 1.2);
      if (ts > 0) { g.save(); g.globalAlpha = ts; g.font = `500 ${Math.round(fs * .34)}px ${FONT_B}`; g.fillStyle = "#c9b6ff"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("ราชินีแห่ง Echo", W / 2, bar / 2); g.restore(); }
    }
    if (t < T.face + .35) drawShuffle(g, t);
  }

  // ---------- วาด: สนามราชินี ----------
  function bodyPose() {
    const pose = { s: 0, dy: 0, dx: 0, alpha: 1, clip: false };
    if (!act) return pose;
    const p = act.t / act.dur;
    if (act.name === "transform") {
      const r = seg(act.t, T.smash, ACTS.transform);
      const rise = easeOut(seg(r, .42, .72)), drop = easeInOut(seg(r, .74, .86));
      pose.dy = r < .74 ? lerp(H * .55, -H * .03, rise) : lerp(-H * .03, 0, drop);
      pose.alpha = seg(r, .42, .5);
      pose.clip = r < .74;
    } else if (act.name === "punch") {
      const back = seg(p, 0, .3) - seg(p, .3, .38), lunge = seg(p, .32, .44) - seg(p, .55, 1);
      pose.s = -back * .02 + lunge * .03; pose.dy = -back * H * .01;
    } else if (act.name === "hit") {
      pose.dx = Math.sin(p * 46) * (1 - p) * W * .01;
    } else if (act.name === "exit") {
      const up = easeOutBack(seg(p, 0, .1));
      pose.dy = -H * .018 * up; pose.s = .015 * up;
      pose.shadow = 1 - seg(p, EXIT.melt0, EXIT.melt0 + .12);
      pose.melt = seg(p, EXIT.melt0, EXIT.melt1);
    }
    return pose;
  }
  function bodyLayers() { // ภาพตัวตอนนี้: เท้าคาง / ง้าง / ง้างแต่แขนกลายเป็นกำปั้นที่พุ่งออกไป
    if (act && act.name === "exit") { const k = seg(act.t / act.dur, 0, .05); return [[A.windup, k], [A.full, 1 - k]]; }
    if (!act || act.name !== "punch") return [[A.full, 1]];
    const p = act.t / act.dur;
    if (p < .16) return [[A.full, 1], [A.windup, seg(p, 0, .14)]];
    if (p < .3) return [[A.windup, 1]];
    if (p < .6) return [[A.stub, 1]];
    return [[A.stub, 1], [A.full, seg(p, .6, .74)]];
  }
  function drawBody(g, R, pose) {
    if (pose.alpha <= 0) return;
    const melt = pose.melt || 0;
    if (melt >= 1) return;
    const my = melt > 0 ? lerp(R.y + R.h, R.y + R.h * .02, easeInOut(melt)) : Infinity;
    g.save();
    if (pose.clip) { g.beginPath(); g.rect(-20, -20, W + 40, L.edgeY + 22); g.clip(); }
    else if (melt > 0) { g.beginPath(); g.rect(-20, -20, W + 40, my + 20); g.clip(); }
    drawAura(g, R, (.45 + .5 * Math.sin(melt * Math.PI)) * pose.alpha, A);
    for (const [img, a] of bodyLayers()) { if (a <= 0) continue; g.globalAlpha = pose.alpha * a; g.drawImage(img, R.x, R.y, R.w, R.h); }
    if (fx.hit > 0) { g.globalAlpha = fx.hit * .55; g.drawImage(A.red, R.x, R.y, R.w, R.h); }
    if (melt > 0) {
      g.globalAlpha = .85; g.globalCompositeOperation = "lighter";
      g.beginPath(); g.rect(-20, my - R.h * .06, W + 40, R.h * .06 + 20); g.clip();
      g.drawImage(A.whiteWind, R.x, R.y, R.w, R.h);
    }
    g.restore();
    if (melt > 0 && melt < 1) {
      const x0 = R.x + R.w * .3, x1 = R.x + R.w * .86;
      g.save(); g.globalCompositeOperation = "lighter";
      const lg = g.createLinearGradient(0, my - 16, 0, my + 16);
      lg.addColorStop(0, `rgba(${PURPLE},0)`); lg.addColorStop(.5, "rgba(255,240,255,.95)"); lg.addColorStop(1, `rgba(${PURPLE},0)`);
      g.fillStyle = lg; g.fillRect(x0 - 30, my - 16, x1 - x0 + 60, 32); g.restore();
      pixelDust(x0, x1, my, Math.round(frameDt * 220));
    }
  }
  function drawBoardFx(g, P) {
    g.save(); g.globalCompositeOperation = "lighter";
    for (const f of tileFlash) {
      const r = f.t * 9;
      for (let i = -4; i <= 4; i++) for (let j = -4; j <= 4; j++) {
        const a = clamp01(1 - Math.abs(Math.hypot(i - f.x, j - f.z) - r) / 1.2) * clamp01(1 - f.t / .7);
        if (a > 0) quad(g, P, [[i - .5, j - .5], [i + .5, j - .5], [i + .5, j + .5], [i - .5, j + .5]], `rgba(${PURPLE},${.55 * a})`);
      }
    }
    for (const r of boardRings) {
      g.strokeStyle = `rgba(${PURPLE},${clamp01(r.life / r.max)})`; g.lineWidth = 3;
      g.beginPath();
      for (let i = 0; i <= 28; i++) { const a = i / 28 * 6.283, p = P(r.x + Math.cos(a) * r.r, 0, r.z + Math.sin(a) * r.r); i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); }
      g.stroke();
    }
    g.restore();
  }
  function drawField(g) {
    const reveal = act && act.name === "transform" ? seg(act.t, T.smash, ACTS.transform) : 1;
    const ex = act && act.name === "exit" ? act.t / act.dur : -1;
    const k = easeInOut(seg(reveal, 0, .5));
    const P = reveal < 1 ? makeCam(lerp(84, CAM_E, k), lerp(23, CAM_D, k)) : L.P;
    g.drawImage(bgBake, 0, 0, W, H);
    if (reveal < 1) {
      const dr = (k0) => lerp(7, 0, 1 - bounce(seg(reveal, k0, k0 + .25)));
      drawBoardScene(g, P, { cards: easeOutBack(seg(reveal, .35, .6)), dieY: [dr(.3), dr(.36)] });
    } else if (ex >= EXIT.board0 - .04) {
      const bk = seg(ex, EXIT.board0, EXIT.board1), fly = Math.pow(seg(ex, EXIT.board0 - .04, EXIT.board1), 2);
      drawBoardScene(g, P, { vanish: bk, cards: 1 - easeInOut(seg(ex, EXIT.board0 - .04, EXIT.board0 + .14)), dieY: [fly * 12, fly * 14], dieSpin: fly * 6 });
    } else g.drawImage(boardBake, 0, 0, W, H);
    if (tileFlash.length || boardRings.length) drawBoardFx(g, P);
    const pose = bodyPose(), R = bodyRect(pose);
    if (!pose.clip && pose.alpha > 0 && (pose.shadow ?? 1) > 0) for (const [ex2, ey] of ART.elbows) { // เงาศอกบนกระดาน
      const [px, py] = imgPt(R, ex2, ey), rw = R.w * .06;
      const sh = g.createRadialGradient(px, py, 0, px, py, rw);
      sh.addColorStop(0, `rgba(0,0,0,${.55 * (pose.shadow ?? 1)})`); sh.addColorStop(1, "rgba(0,0,0,0)");
      g.save(); g.translate(px, py); g.scale(1.6, .35); g.translate(-px, -py); g.fillStyle = sh; g.fillRect(px - rw, py - rw, rw * 2, rw * 2); g.restore();
    }
    drawBody(g, R, pose);
    if (act && act.name === "punch") { // พลังรวมที่กำปั้นตอนง้าง
      const p = act.t / act.dur, ch = seg(p, .08, .3) * (1 - seg(p, .3, .34));
      if (ch > 0) {
        const [px, py] = imgPt(R, ART.fist[0], ART.fist[1]), r = R.h * (.08 + .1 * ch);
        g.save(); g.globalCompositeOperation = "lighter";
        const gr = g.createRadialGradient(px, py, 0, px, py, r);
        gr.addColorStop(0, `rgba(255,240,255,${.85 * ch})`); gr.addColorStop(.35, `rgba(${PURPLE},${.65 * ch})`); gr.addColorStop(1, `rgba(${PURPLE},0)`);
        g.fillStyle = gr; g.fillRect(px - r, py - r, r * 2, r * 2); g.restore();
      }
    }
    const vg = g.createRadialGradient(W / 2, H * .55, H * .35, W / 2, H * .55, W * .72); // ขอบจอมืดนิดๆ
    vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,.55)");
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
  }
  function drawFist(g) {
    if (!act || act.name !== "punch" || !fistImg) return;
    const p = act.t / act.dur, o = act.opts, [tx, ty] = o.at;
    const R = bodyRect(bodyPose());
    const [sx, sy] = imgPt(R, ART.fist[0], ART.fist[1]), start = R.h * ART.fistH / FIST_FILL;
    const end = o.me ? H * 1.35 : H * .32;
    const fr = fistImg.width / fistImg.height;
    let k, size, alpha = 1;
    if (p < .3) return;
    if (p < .44) { k = Math.pow(seg(p, .3, .44), 2.2); size = lerp(start, end, k); alpha = seg(p, .3, .32); }
    else { const q = seg(p, .48, .72); k = 1 - q * .25; size = end * (1 - q * .15); alpha = 1 - q; }
    if (alpha <= 0) return;
    const draw = (x, y, s, a) => { g.save(); g.globalAlpha = a; g.drawImage(fistImg, x - s * fr * FIST_KNUCKLE[0], y - s * FIST_KNUCKLE[1], s * fr, s); g.restore(); };
    const sl = seg(p, .3, .36) * (1 - seg(p, .5, .7));
    if (sl > 0) { // เส้นความเร็ว
      g.save(); g.globalCompositeOperation = "lighter";
      const n = calm ? 14 : 38, M = Math.max(W, H);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * 6.283 + (i * 7.3 % 1) * .2, r0 = M * (.2 + (i * 3.7 % 1) * .2), r1 = M * 1.1;
        g.strokeStyle = `rgba(${i % 3 ? PURPLE : "255,255,255"},${sl * .5})`; g.lineWidth = 1.5 + (i % 4);
        g.beginPath(); g.moveTo(tx + Math.cos(a) * r0, ty + Math.sin(a) * r0); g.lineTo(tx + Math.cos(a) * r1, ty + Math.sin(a) * r1); g.stroke();
      }
      g.restore();
    }
    if (p < .44 && !calm) for (const lag of [.03, .06]) { const kk = Math.pow(seg(p - lag, .3, .44), 2.2); if (kk > 0) draw(lerp(sx, tx, kk), lerp(sy, ty, kk), lerp(start, end, kk), .2); }
    draw(lerp(sx, tx, k), lerp(sy, ty, k), size, alpha);
  }
  function drawFx(g, dt) {
    for (const b of bursts) {
      b.life -= dt;
      const a = clamp01(b.life / b.max), k = 1 - a, R = Math.min(W, H) * (b.big ? .14 + k * .4 : .07 + k * .2);
      g.save(); g.globalCompositeOperation = "lighter"; g.translate(b.x, b.y); g.beginPath();
      for (let i = 0; i <= 28; i++) { const ang = b.seed + i / 28 * 6.283, r = i % 2 ? R * .38 : R * (1 + (i * 1.7 % 1) * .3); g.lineTo(Math.cos(ang) * r, Math.sin(ang) * r); }
      g.closePath();
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, R);
      gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(.45, `rgba(220,190,255,${a * .8})`); gr.addColorStop(1, `rgba(${PURPLE},0)`);
      g.fillStyle = gr; g.fill(); g.restore();
    }
    g.save(); g.globalCompositeOperation = "lighter";
    for (const q of parts) {
      if (q.tx != null) {
        q.t += dt; if (q.t < 0) continue;
        const k = easeInOut(clamp01(q.t / q.dur)), x = lerp(q.x, q.tx, k), y = lerp(q.y, q.ty, k);
        g.fillStyle = `rgba(${q.col},${.9 * (1 - k * .4)})`; g.fillRect(x - q.s / 2, y - q.s / 2, q.s, q.s);
        if (k >= 1) q.life = 0; continue;
      }
      q.x += q.vx * dt; q.y += q.vy * dt; q.vy += q.g * dt; q.vx *= .985; q.life -= dt;
      g.fillStyle = `rgba(${q.col},${clamp01(q.life / q.max)})`;
      if (q.heart) { heartPath(g, q.x, q.y, q.s * 1.8); g.fill(); } else if (q.sq) g.fillRect(q.x - q.s / 2, q.y - q.s / 2, q.s, q.s); else { g.beginPath(); g.arc(q.x, q.y, q.s, 0, 6.29); g.fill(); }
    }
    for (const r of rings) {
      r.r += r.grow * dt; r.life -= dt;
      g.strokeStyle = `rgba(${r.col},${clamp01(r.life / r.max) * .85})`; g.lineWidth = r.lw;
      g.beginPath(); g.ellipse(r.x, r.y, r.r, r.r * r.flat, 0, 0, 6.29); g.stroke();
    }
    g.restore();
    g.save(); g.textAlign = "center"; g.textBaseline = "middle";
    for (const t of texts) {
      t.y += t.vy * dt; t.vy *= .96; t.life -= dt;
      const a = clamp01(t.life / t.max * 1.8);
      g.font = `600 ${Math.round(t.size * Math.min(1, W / 1100) + 8)}px ${t.size >= 44 ? FONT_D : FONT_B}`;
      g.lineWidth = 6; g.strokeStyle = `rgba(20,6,40,${a * .85})`; g.strokeText(t.text, t.x, t.y);
      g.globalAlpha = a; g.fillStyle = t.color; g.fillText(t.text, t.x, t.y); g.globalAlpha = 1;
    }
    g.restore();
    for (const b of boardRings) { b.r += 7 * dt; b.life -= dt; }
    for (const f of tileFlash) f.t += dt;
    const alive = (x) => x.life > 0;
    parts = parts.filter(alive); rings = rings.filter(alive); texts = texts.filter(alive); bursts = bursts.filter(alive);
    boardRings = boardRings.filter(alive); tileFlash = tileFlash.filter((f) => f.t < .8);
  }

  function drawFrame(dt) {
    frameDt = dt;
    if (!A || !L) return;
    const tr = act && act.name === "transform";
    const sh = fx.shake > 0 ? [(Math.random() - .5) * fx.shake, (Math.random() - .5) * fx.shake] : null;
    // ชั้นหลัง: สนามราชินี (นอกฉากเปิดตัว)
    ctxB.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (mode === "field" && !tr) {
      ctxB.save(); if (sh) ctxB.translate(sh[0], sh[1]);
      ctxB.fillStyle = "#05030b"; ctxB.fillRect(-30, -30, W + 60, H + 60);
      drawField(ctxB); ctxB.restore();
    } else ctxB.clearRect(0, 0, W, H);
    // ชั้นหน้า: ฉากเปิดตัวทั้งฉาก / กำปั้น / อนุภาค
    ctxF.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctxF.clearRect(0, 0, W, H);
    ctxF.save(); if (sh) ctxF.translate(sh[0], sh[1]);
    if (tr) {
      if (mode === "arena") drawArenaOverlay(ctxF, act.t);
      else if (mode === "cut") drawCut(ctxF, act.t);
      else if (mode === "field") { ctxF.fillStyle = "#05030b"; ctxF.fillRect(-30, -30, W + 60, H + 60); drawField(ctxF); }
    } else if (mode === "field") drawFist(ctxF);
    drawShards(ctxF, dt);
    drawFx(ctxF, dt);
    ctxF.restore();
    if (fx.flash > 0) { ctxF.fillStyle = `rgba(${fx.flashCol},${Math.min(1, fx.flash) * .6})`; ctxF.fillRect(0, 0, W, H); }
    if (fx.glitch > 0) {
      glitchPost(fxCv, ctxF, fx.glitch);
      if (act && act.name === "exit" && mode === "field") glitchPost(backCv, ctxB, fx.glitch);
    }
  }

  // ---------- ลูป: ทำงานเฉพาะตอนมีของขยับ ว่างแล้วเป็นภาพนิ่ง ----------
  let raf = 0, running = false, last = 0;
  const idle = () => !act && !parts.length && !rings.length && !texts.length && !bursts.length && !boardRings.length && !tileFlash.length && !shards.length
    && fx.flash <= 0 && fx.shake <= 0 && fx.hit <= 0 && fx.glitch <= 0;
  function start() { if (running || dead) return; running = true; last = 0; raf = requestAnimationFrame(frame); }
  function frame(now) {
    if (dead) return;
    const rdt = Math.min(.05, (now - (last || now)) / 1000);
    last = now;
    const dt = fx.hitstop > 0 ? rdt * .06 : rdt;
    fx.hitstop = Math.max(0, fx.hitstop - rdt);
    if (act) {
      act.t += dt;
      const tt = act.name === "transform" ? act.t : act.t / act.dur;
      for (const e of act.ev) if (!e.done && tt >= e.at) { e.done = true; e.fn(); }
      if (act.t >= act.dur) {
        const done = act.name;
        act = null;
        if (done === "transform") setMode("field");
      }
    }
    fx.flash = Math.max(0, fx.flash - rdt * 2.4);
    fx.hit = Math.max(0, fx.hit - rdt * 2.2);
    fx.glitch = Math.max(0, fx.glitch - rdt * 3);
    fx.shake = Math.max(0, fx.shake - rdt * 55);
    drawFrame(dt);
    if (idle()) { running = false; drawFrame(0); return; }
    raf = requestAnimationFrame(frame);
  }

  function resize() {
    const r = fxCv.getBoundingClientRect();
    if (!r.width || !r.height) return;
    dpr = Math.min(1.5, window.devicePixelRatio || 1);
    W = r.width; H = r.height;
    for (const c of [backCv, fxCv]) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
    if (A) { layout(); bake(); }
    if (!running) drawFrame(0);
  }
  const ro = typeof ResizeObserver === "function" ? new ResizeObserver(resize) : null;
  if (ro) ro.observe(fxCv);

  preloadEchoQueen().then((res) => {
    if (dead || !res) return;
    A = res.A; fistImg = res.fist;
    resize();
    if (pending) { const p = pending; pending = null; request(p.name, p.opts); }
  });

  return {
    playTransform({ seat: s } = {}) { seat = s || null; request("transform"); },
    enterField() { request("field"); },
    punch(opts) { request("punch", opts); },
    hit(opts = {}) { request("hit", opts); },
    exit({ seat: s } = {}) {
      if (s) seat = s;
      if (mode !== "field" && !(act && act.name === "transform")) { pending = null; return; }
      if (mode !== "field") setMode("field"); // ท่าจบกลางฉากเปิดตัว (เช่น Echo ตาย) — ข้ามไปสนามแล้วเล่นฉากออกเลย
      request("exit");
    },
    clear() { act = null; pending = null; setMode("none"); if (A && L) drawFrame(0); },
    get mode() { return mode; },
    get busy() { return !!act; },
    setLowQ(v) { calm = v || reduce; },
    destroy() { dead = true; cancelAnimationFrame(raf); if (ro) ro.disconnect(); },
  };
}
