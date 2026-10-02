// ============================================================
//  ฉากสนาม 2.5D ของแต่ละภูมิภาค (พอร์ตจากต้นแบบ canvas lib.js)
//  พื้น = แผ่น CSS-3D (perspective + rotateX) · flats = ชิ้นบนพื้น
//  stands = ป้ายตั้งหันเข้ากล้อง (วางในพิกัดจอด้วย proj) · fx = เอฟเฟกต์บนจอ · fore = ของเบลอหน้ากล้อง
//  ไฟล์นี้คำนวณข้อมูลล้วน ๆ (ไม่มี React) — keyframes ชื่อ ar* อยู่ใน arena.css
// ============================================================

import { seeded, twistedTree } from "../geometry";
import { NONE, r1, rand32, proj, seatPoint, nearSector } from "./arenaKit";
import { EXTRA_AREAS } from "./areas";

/** ความสูงเส้นแสงจากฐานที่นั่งถึงขอบล่างการ์ด (px ที่ความสูงจอ 900) — Game.jsx ใช้ค่าเดียวกันวางการ์ด */
export const ARENA_STEM = 38;
/** ย่อการ์ดผู้เล่นบนสนาม (คูณกับสเกลความลึก) ให้การ์ดใบติดกันไม่ทับกัน */
export const ARENA_CARD_SCALE = 0.92;

export const ARENA_AREA_MAX = 7;
/** ภูมิภาคนี้มีสนาม 2.5D แล้วหรือยัง (ภูมิภาคที่ยังไม่ทำ = ใช้ฉากหลัง JourneyBackdrop เดิม) */
export function hasArena(area) {
  return !!AREAS[area];
}

/* ผู้เล่นอื่นนั่งครึ่งวงด้านไกล (กลางด้านบน = 270°) ห่างกันไม่เกิน 44° · ตัวเรา = 90° (ใกล้กล้อง) */
export function seatAngles(n) {
  if (n <= 0) return [];
  if (n === 1) return [270];
  const step = Math.min(44, 220 / (n - 1));
  const out = [];
  for (let i = 0; i < n; i++) out.push(270 + (i - (n - 1) / 2) * step);
  return out;
}

/* กล้องตามขนาดจอ — 5.1.9: กล้องก้ม 30° (ผู้ใช้ขอ: 55° ดูแบนเหมือน 2D) · เห็นเส้นขอบฟ้า ~16% จากบนจอ
   วงที่นั่งกว้างขึ้น (R 590) เพราะมุมต่ำบีบวงในแนวตั้ง การ์ดใบติดกันจะได้ไม่ทับกัน */
export function arenaCamera(W, H) {
  const u = H / 900;
  // วงที่นั่งไม่กว้างเกินจอแคบ (4:3 / 5:4): รัศมีคิดจากด้านที่แคบกว่าเมื่อเทียบ 16:9 — 16:9 เท่าเดิม
  const ur = Math.min(u, W / 1600);
  return { W, H, e: 30, p: 1300 * u, oy: H, cy: H * 0.606, R: 590 * ur };
}

/** จอสูงเกิน 1080 (เช่น 1440p): ขยายการ์ดผู้เล่นบนสนามตาม (กระดานทั้งใบหยุดขยายที่ 1 แต่แผงของเราขยายตามจอ) */
export function arenaCardZoom(H) {
  return Math.min(1.5, Math.max(1, H / 1080));
}

/* ความสูง (หน่วยสนาม) ของแท่นที่ใช้ทั้งตอนวาดและตอนหาตำแหน่งที่นั่ง — แก้ที่เดียว ไม่หลุดกัน
   ring = ชั้นที่วงที่นั่งวางอยู่ (ซ้อนตามลำดับ) · pad = แท่นที่นั่ง · center = ชั้นกลางสนาม */
const AREA_H = {
  1: { ring: [16, 24], pad: 10, center: [16, 24] },
  2: { ring: [12], pad: 8, center: [12, 34, 30] },
  3: { ring: [], pad: 26, center: [64] },
};

/* ความสูงจริง h -> เลื่อนบนพื้นเท่าไรถึงดูเหมือนยกขึ้น (กล้องก้ม e°: dy = h·cot e) */
function makeLift(c) {
  const k = c.R / 300;
  const eRad = (c.e * Math.PI) / 180;
  return (h) => (c.e >= 89.5 ? 0 : (h * k * Math.cos(eRad)) / Math.sin(eRad));
}
/* ซ้อนชั้นแบบเดียวกับ cyl ต่อกัน (y - dy ทีละชั้น) */
function chainLift(lift, hs) {
  let y = 0;
  for (const h of hs) y = y - lift(h);
  return y;
}
/* หน้าบนแท่นที่นั่ง (เทียบ p.y) — สูตรเดียวกับ seatPad: cyl(p.y + ringLift, pad) - p.y */
function seatTop(lift, py, ringLift, pad) {
  return py + ringLift - lift(pad) - py;
}
function seatScreen(c, p, top) {
  const sp = proj(c, p.x, p.y + top);
  return { x: sp.x, y: sp.y, s: Math.max(0.78, Math.min(1.1, sp.s)) };
}

/* ตำแหน่งที่นั่ง/กลางสนามบนจอ โดยไม่ต้องสร้างฉาก */
export function arenaLayout(W, H, area, nOthers) {
  const c = arenaCamera(W, H);
  const k = c.R / 300;
  const R = 300 * k;
  const lift = makeLift(c);
  const AH = AREA_H[area] || AREA_H[1];
  const ringLift = chainLift(lift, AH.ring);
  const at = (phi) => {
    const p = seatPoint(R, phi);
    return { phi, ...seatScreen(c, p, seatTop(lift, p.y, ringLift, AH.pad)) };
  };
  const center = proj(c, 0, chainLift(lift, AH.center));
  return {
    others: stackCards(W, H, seatAngles(nOthers).map(at), center),
    me: at(90),
    center,
  };
}

/* การ์ดผู้เล่นยืนบนเส้นแสงเหนือฐานที่นั่ง — มุมกล้องต่ำบีบวงที่นั่งในแนวตั้ง การ์ดใบใกล้จะบังใบไกล
   จึงไล่จากที่นั่งใกล้กล้องไปไกล: ถ้าการ์ดใบไกลซ้อนแนวนอนกับใบที่วางแล้ว ยืดเส้นแสงให้การ์ดลอยขึ้นพ้นขอบบนของใบนั้น
   ขนาดการ์ดประมาณจากการ์ดจริง (236×165 ที่สเกลกระดาน min(1, H/920)) · bottom/stem = px บนจอ */
const CARD_W = 260;
const CARD_H = 170;
const DECK_W = 110;
const DECK_H = 140;
function stackCards(W, H, seats, center) {
  const bs = Math.min(1, H / 920) * Math.min(1, W / 900);
  const u = H / 900;
  // กองไพ่บนแท่นกลางนับเป็นสิ่งกีดขวางชิ้นแรก — ที่นั่งไกลกลาง (คนอื่น 1/3/5 คน) จะลอยการ์ดขึ้นพ้นกองไพ่ ไม่ทับกัน
  const placed = center ? [{ x: center.x, w: DECK_W * bs, top: center.y - DECK_H * bs }] : [];
  const order = seats.map((st, i) => i).sort((a, b) => seats[b].y - seats[a].y);
  const out = seats.map((st) => ({ ...st }));
  for (const i of order) {
    const st = out[i];
    const sc = st.s * ARENA_CARD_SCALE * bs * arenaCardZoom(H);
    const w = CARD_W * sc, h = CARD_H * sc;
    // ไม่ให้การ์ดล้นขอบจอ (ที่นั่งริมสุดบนจอแคบ) — เส้นแสงยังตั้งตรงที่ฐานที่นั่ง
    st.cardX = r1(Math.min(W - w / 2 - 6, Math.max(w / 2 + 6, st.x)));
    let bottom = st.y - ARENA_STEM * u * st.s;
    for (const q of placed) if (Math.abs(q.x - st.cardX) < (q.w + w) / 2 + 6) bottom = Math.min(bottom, q.top - 8 * u);
    st.bottom = r1(bottom);
    st.stem = r1(st.y - bottom);
    placed.push({ x: st.cardX, w, top: bottom - h });
  }
  return out;
}

/* ---------- ตัวช่วยวาด: พื้น (flats) · ของตั้ง (stands) · เอฟเฟกต์บนจอ (fx) ---------- */
function makeBuilder(c) {
  const k = c.R / 300;
  const HS = 1700 * k;
  const B = {
    c, k, HS, R: 300 * k, th: 90 - c.e, pop: c.pop == null ? 1 : c.pop, night: !!c.night,
    S: c.W / 1440, flats: [], stands: [], fx: [], foreList: [], rand: rand32(7),
  };
  B.px = (n) => `${r1(n * k)}px`;
  B.flat = (x, y, w, h, o) => {
    B.flats.push({
      l: r1(HS + x - w / 2), t: r1(HS + y - h / 2), w: r1(w), h: r1(h), bg: o.bg || "transparent", bd: o.bd || NONE,
      rad: o.rad || "0", rot: r1(o.rot || 0), op: o.op == null ? 1 : o.op, anim: o.anim || "none",
    });
  };
  B.disc = (x, y, r, bg, bd, op, anim) => B.flat(x, y, 2 * r, 2 * r, { bg, bd, rad: "50%", op, anim });
  B.oval = (x, y, rx, ry, bg, op, rot) => B.flat(x, y, 2 * rx, 2 * ry, { bg, rad: "50%", op, rot });
  B.rect = (x, y, w, h, bg, bd, rot, op, rad) => B.flat(x, y, w, h, { bg, bd, rot, op, rad });
  B.lift = makeLift(c);
  /* ทรงกระบอกหลอกตา: ซ้อนวงด้านข้างไล่ขึ้นไปแล้วปิดด้วยหน้าบน · คืนค่า y ของหน้าบน */
  B.cyl = (x, y, r, h, side, top, topBd, topAnim) => {
    const dy = B.lift(h);
    const steps = Math.max(2, Math.min(48, Math.ceil(dy / (1.5 * k)))); // มุมต่ำ = ผนังสูง ต้องซ้อนถี่ ไม่งั้นขอบเป็นหยัก
    B.disc(x, y + 2 * k, r * 1.05, `radial-gradient(closest-side, ${B.shadow || "rgba(0,0,0,0.3)"}, transparent)`, null, 1);
    if (dy > 0.5) for (let i = 0; i <= steps; i++) B.disc(x, y - (dy * i) / steps, r, side, null, 1);
    B.disc(x, y - dy, r, top, topBd, 1, topAnim);
    return y - dy;
  };
  /* ป้ายตั้งหันเข้ากล้องเสมอ -> วางบนจอด้วย proj · fold = ความสูงตอนกางป๊อปอัป (0 = พับราบ, 1 = ตั้งเต็ม) */
  B.stand = (kind, x, y, w, h, extra, shadow) => {
    const sp = proj(c, x, y);
    const s = {
      kind, l: sp.x, t: sp.y, w: r1(w * k * sp.s), h: r1(h * k * sp.s), fold: r1(0.12 + 0.88 * B.pop), y, anim: "none",
      col: "#9b4f96", c1: "#8fb878", c2: "#7aa765", c3: "#b4d69b", d1: "#ffffff", d2: "#ffffff", trunk: "#8b7355", crystalOp: B.night ? 0.9 : 0.35,
      ...(extra || {}),
    };
    /* ระยะไกล -> จางเข้าหมอก (ความลึกแบบภาพวาด)
       5.1.10: เลิกใช้ filter blur/brightness ต่อชิ้น — ของตั้งหลายสิบชิ้นที่มี filter กิน GPU จนจอกระพริบในเครื่องเพื่อน
       ใช้ความทึบอย่างเดียวแทน (ชั้นหมอกด้านบนจอช่วยกลืนของไกลอยู่แล้ว) */
    const ff = Math.max(0, Math.min(1, (0.97 - sp.s) / 0.32));
    s.filter = "none";
    s.op = r1(1 - (B.hazeDark ? 0.45 : 0.35) * ff);
    if (s.l + s.w / 2 < -40 || s.l - s.w / 2 > c.W + 40 || s.t < -20 || s.t - s.h > c.H + 20) return;
    B.stands.push(s);
    if (shadow !== false) B.oval(x, y + 4 * k, w * k * 0.45, 9 * k + w * k * 0.08, `radial-gradient(closest-side, ${B.shadow || "rgba(0,0,0,0.25)"}, transparent)`, 1);
  };
  /* เอฟเฟกต์บนจอ: x,y = กลางชิ้น (px จอ) */
  B.fxAdd = (kind, x, y, w, h, o) => {
    B.fx.push({
      kind, x: r1(x), y: r1(y), w: r1(w), h: r1(h), op: o.op == null ? 1 : o.op,
      anim: o.anim || "none", inner: o.inner || "none", col: o.col || "#ffffff", col2: o.col2 || "#ffffff", rot: o.rot || 0,
    });
  };
  /* ชั้นหน้าสุด: ของใกล้กล้องมาก เบลอแรง (ระยะชัดตื้น) */
  B.foreAdd = (kind, x, y, w, h, o) => {
    B.foreList.push({
      kind, x: r1(x), y: r1(y), w: r1(w), h: r1(h), op: o.op == null ? 1 : o.op,
      anim: o.anim || "none", col: o.col || "#ffffff", col2: o.col2 || "#ffffff", blur: r1(o.blur || 8), rot: o.rot || 0,
    });
  };
  return B;
}

/* ============================================================
   ภูมิภาค I — อาณาจักรแห่งจุดเริ่มต้น
   ============================================================ */
function area1(B) {
  const { k, px, night } = B;
  const AH = AREA_H[1];
  const C = night ? {
    sky: "linear-gradient(180deg, #0b1830 0%, #183056 100%)",
    plaza: "#5d7697", plaza2: "#526b8c", rim: "#465e7e", grass1: "#2f4f5a", grass2: "#22394a", path: "#55708f",
    glow: "rgba(150, 205, 255, 0.55)", line: "rgba(170, 215, 255, 0.85)", gold: "#f0c868", tile: "rgba(200, 225, 255, 0.07)", tile2: "rgba(200, 225, 255, 0.14)", rim2: "#33475f",
    dots: ["#fff3b0", "#cfe8ff", "#fff3b0"], tree: ["#2c5a55", "#244b48", "#3d7068"], trunk: "#4a3d33", shadow: "rgba(0, 8, 24, 0.45)",
  } : {
    sky: "linear-gradient(180deg, #d6e9f9 0%, #f4f8fc 100%)",
    plaza: "#f3f4f1", plaza2: "#e9ebe6", rim: "#d8d1bf", grass1: "#bfd8a8", grass2: "#9fc28a", path: "#ebe7dc",
    glow: "rgba(127, 184, 230, 0.32)", line: "rgba(61, 139, 217, 0.75)", gold: "#d9a93f", tile: "rgba(28, 63, 110, 0.05)", tile2: "rgba(28, 63, 110, 0.14)", rim2: "#b4aa92",
    dots: ["#f6d36b", "#ffffff", "#eaa6c2"], tree: ["#8fb878", "#7aa765", "#b4d69b"], trunk: "#8b7355", shadow: "rgba(28, 46, 40, 0.22)",
  };
  B.sky = C.sky;
  B.shadow = C.shadow;
  B.ground = `radial-gradient(circle at 50% 50%, ${C.grass1} 0px, ${C.grass1} ${r1(700 * k)}px, ${C.grass2} ${r1(1700 * k)}px)`;
  const rand = B.rand;
  for (let i = 0; i < 46; i++) {
    const a1 = rand() * Math.PI * 2;
    const rr1 = (580 + rand() * 1000) * k;
    B.disc(Math.cos(a1) * rr1, Math.sin(a1) * rr1, (26 + rand() * 40) * k, night ? "#1d3242" : "#8fb878", null, 0.35);
  }
  for (let j = 0; j < 150; j++) {
    const a2 = rand() * Math.PI * 2;
    const rr2 = (560 + rand() * 1050) * k;
    B.disc(Math.cos(a2) * rr2, Math.sin(a2) * rr2, (3 + rand() * 4) * k, C.dots[j % 3], null, night ? 0.75 : 0.9);
  }
  B.rect(0, -1080 * k, 150 * k, 1120 * k, `repeating-linear-gradient(180deg, ${C.path} 0 ${px(44)}, ${C.rim} ${px(44)} ${px(48)})`, `${px(4)} solid ${C.rim}`);
  /* ลานยกสองชั้น: ลานหิน (สูง 16) แล้วแท่นสนาม (สูงอีก 24) */
  const side1 = `linear-gradient(90deg, ${C.rim2} 0%, ${C.rim} 45%, ${C.rim2} 100%)`;
  const L1 = B.cyl(0, 0, 525 * k, AH.ring[0], side1, C.plaza, `${px(10)} solid ${C.rim}`);
  B.disc(0, L1, 505 * k, `repeating-radial-gradient(circle, ${C.tile} 0 ${px(2)}, transparent ${px(2)} ${px(42)})`);
  for (let q = 0; q < 24; q++) {
    const aq = (q * 15 * Math.PI) / 180;
    B.rect(Math.cos(aq) * 432 * k, L1 + Math.sin(aq) * 432 * k, 150 * k, 2 * k, C.tile2, null, q * 15);
  }
  const L2 = B.cyl(0, L1, 352 * k, AH.ring[1], side1, C.plaza2, `${px(12)} solid ${C.rim}`);
  B.disc(0, L2, 250 * k, `radial-gradient(circle, ${C.glow} 0%, transparent 72%)`, null, 1, "arPulse 5s ease-in-out infinite");
  B.disc(0, L2, 300 * k, "transparent", `${px(3)} solid ${C.gold}`);
  B.disc(0, L2, 240 * k, "transparent", `${px(2.5)} solid ${C.line}`);
  B.disc(0, L2, 224 * k, "transparent", `${px(2)} dashed ${C.line}`, 0.6, "arSpin 60s linear infinite");
  B.rect(0, L2, 300 * k, 300 * k, "transparent", `${px(2)} solid ${C.gold}`, 0, 0.75);
  B.rect(0, L2, 300 * k, 300 * k, "transparent", `${px(2)} solid ${C.gold}`, 45, 0.75);
  B.disc(0, L2, 150 * k, "transparent", `${px(2)} solid ${C.line}`);
  B.disc(0, L2, 92 * k, `radial-gradient(circle, ${C.shadow} 0%, transparent 70%)`);
  B.hazeCol = night ? "rgba(12,24,48,0.85)" : "rgba(232,242,252,0.85)";
  B.fore = (W, H, S) => {
    const leaf = night ? "#13283a" : "#6f9e58";
    [[0.02, 0.98, 260], [0.98, 1.0, 300], [-0.02, 0.12, 200], [1.02, 0.08, 220]].forEach((b, i) => {
      B.foreAdd("Leafy", W * b[0], H * b[1], b[2] * S * 1.6, b[2] * S * 1.3, { col: leaf, blur: 10 * S, op: 0.9, anim: `arSway ${6 + i}s ease-in-out ${-i}s infinite` });
    });
  };
  return {
    ringLift: L2,
    centerLift: L2,
    seatPad: (p, st, rr) => {
      const y = p.y + L2;
      B.disc(p.x, y, rr * 1.9, `radial-gradient(circle, ${st.col} 0%, transparent 70%)`, null, night ? 0.75 : 0.45);
      return B.cyl(p.x, y, rr, AH.pad, `linear-gradient(90deg, ${C.rim2}, ${st.col} 50%, ${C.rim2})`, st.col, `${px(4)} solid rgba(255,255,255,0.85)`) - p.y;
    },
    after: () => {
      B.stand("Hills", 0, -1660 * k, 3400, 420, {}, false);
      B.stand("Castle", 0, -1360 * k, 1000, 680, {});
      [0, 180, 212, 328].forEach((d) => {
        const p = seatPoint(400 * k, d);
        B.stand("Pillar", p.x, p.y, 40, 170, {});
      });
      [[252, "#9b4f96"], [288, "#3d8bd9"]].forEach((b) => {
        const p = seatPoint(450 * k, b[0]);
        B.stand("Banner", p.x, p.y, 60, 240, { col: b[1] });
      });
      const trand = rand32(21);
      for (let t = 0; t < 40; t++) {
        const deg = trand() * 360;
        if ((deg > 255 && deg < 285) || nearSector(deg)) continue;
        const rad = (620 + trand() * 900) * k;
        const sz = 0.8 + trand() * 0.7;
        const tp = seatPoint(rad, deg);
        B.stand("Tree", tp.x, tp.y, 120 * sz, 160 * sz, { c1: C.tree[0], c2: C.tree[1], c3: C.tree[2], trunk: C.trunk });
      }
      /* ประกายเวทลอยเหนือวง */
      const fr = rand32(31);
      for (let s = 0; s < 18; s++) {
        const a = fr() * Math.PI * 2;
        const rr = fr() * 240 * k;
        const p = proj(B.c, Math.cos(a) * rr, Math.sin(a) * rr);
        const z = (8 + fr() * 10) * B.S;
        B.fxAdd("Spark", p.x, p.y - fr() * 90 * B.S, z, z, { col: night ? "#cfe8ff" : "#7fb8e6", anim: `arTwinkle ${r1(2 + fr() * 3)}s ease-in-out ${r1(-fr() * 5)}s infinite` });
      }
    },
  };
}

/* ============================================================
   ภูมิภาค II — สวนดอกไม้ทุ่งหญ้าแสนอบอุ่น
   สนาม = สวนดอกไม้วงแมนดาลา · กลางสนาม = น้ำพุ · รอบนอก = ทุ่งดอกไม้ ซุ้มกุหลาบ พุ่มดอก ทานตะวัน ต้นไม้ดอก กังหันลม
   ============================================================ */
function area2(B) {
  const { k, px, night } = B;
  const AH = AREA_H[2];
  const rand = rand32(202);
  const FL = night
    ? ["#b0607a", "#b98257", "#c9b45e", "#b77f9f", "#8569b3", "#5d7fbf", "#d6dbe8"]
    : ["#ef4f6b", "#f7a14a", "#f6d443", "#f48fb8", "#b07fe0", "#5f9ff0", "#ffffff"];
  const C = night ? {
    sky: "linear-gradient(180deg, #0a1430 0%, #22345e 100%)", lawn: "#2f5246", lawn2: "#365c4f", lawnLine: "rgba(255,255,255,0.03)",
    field: "#24423a", hedge: "#1e3a33", hedge2: "#29493f", stone: "#8090a8", stone2: "#6a7a92", water1: "#3a6c96", water2: "#1f4469",
    dot: "rgba(255,255,255,0.18)", gold: "#e8cf7a", shadow: "rgba(0, 10, 20, 0.45)", leaf: ["#2f5a48", "#264c3d", "#3e6e5a"],
  } : {
    sky: "linear-gradient(180deg, #d9ecfb 0%, #fff8ee 100%)", lawn: "#a6d87e", lawn2: "#b6e28f", lawnLine: "rgba(255,255,255,0.12)",
    field: "#7fbf5e", hedge: "#5f9f45", hedge2: "#79b85a", stone: "#f6f1e6", stone2: "#e3d9c4", water1: "#c4ecfa", water2: "#6cc0e6",
    dot: "rgba(255,255,255,0.55)", gold: "#f2c84b", shadow: "rgba(40, 70, 30, 0.22)", leaf: ["#7cbf5c", "#68ab4b", "#9ad37a"],
  };
  B.sky = C.sky;
  B.shadow = C.shadow;
  /* ทุ่งดอกไม้แถบหลากสี (conic) + ลายจุดดอกเล็ก */
  const stops = [];
  let deg = 0;
  const n = 30;
  for (let i = 0; i < n; i++) {
    const w = 360 / n;
    stops.push(`${FL[i % FL.length]} ${r1(deg)}deg ${r1(deg + w - 2.2)}deg`);
    stops.push(`${C.field} ${r1(deg + w - 2.2)}deg ${r1(deg + w)}deg`);
    deg += w;
  }
  B.ground = `radial-gradient(circle, ${C.dot} 0 ${px(3)}, transparent ${px(4)}) 0 0 / ${px(18)} ${px(18)}, `
    + `radial-gradient(circle at 50% 50%, ${C.field} 0, ${C.field} ${px(600)}, transparent ${px(640)}), `
    + `conic-gradient(from 3deg, ${stops.join(", ")})`;
  /* ทางเดินหินแผ่นไปกังหันลม + ซ้าย/ขวา */
  [270, 0, 180].forEach((d) => {
    const len = d === 270 ? 1100 : 600;
    const mid = 560 + len / 2;
    const p = seatPoint(mid * k, d);
    B.rect(p.x, p.y, len * k, 110 * k, `repeating-linear-gradient(90deg, ${C.stone} 0 ${px(60)}, ${C.field} ${px(60)} ${px(70)})`, null, d);
  });
  /* แนวพุ่มไม้ล้อมสวน */
  B.disc(0, 0, 600 * k, C.hedge, `${px(18)} solid ${C.hedge2}`);
  /* สนามหญ้า + แปลงดอกไม้วงแมนดาลา */
  B.disc(0, 0, 572 * k, C.lawn);
  const ring = (ra, rb, cols, seg, from) => {
    const st = [];
    let d0 = 0;
    const w = 360 / seg;
    for (let s = 0; s < seg; s++) {
      st.push(`${cols[s % cols.length]} ${r1(d0)}deg ${r1(d0 + w)}deg`);
      d0 += w;
    }
    B.disc(0, 0, rb, `radial-gradient(circle, ${C.dot} 0 ${px(2.5)}, transparent ${px(3.5)}) 0 0 / ${px(13)} ${px(13)}, conic-gradient(from ${from}deg, ${st.join(", ")})`, `${px(5)} solid ${C.hedge2}`);
    B.disc(0, 0, ra, C.lawn, `${px(5)} solid ${C.hedge2}`);
  };
  ring(500 * k, 552 * k, FL, 28, 0);
  ring(420 * k, 470 * k, [FL[3], FL[6], FL[4], FL[6]], 32, 6);
  /* ทางเดินตัดผ่านแปลง */
  [270, 0, 180].forEach((d) => {
    const p = seatPoint(485 * k, d);
    B.rect(p.x, p.y, 190 * k, 96 * k, C.stone, `${px(3)} solid ${C.stone2}`, d, 1, px(14));
  });
  /* ลานหญ้ายกขอบหิน (สูง 12) + ลายตัดหญ้า */
  const sideS = `linear-gradient(90deg, ${C.stone2} 0%, ${C.stone} 45%, ${C.stone2} 100%)`;
  const L = B.cyl(0, 0, 398 * k, AH.ring[0], sideS, `repeating-linear-gradient(90deg, ${C.lawn2} 0 ${px(46)}, ${C.lawn} ${px(46)} ${px(92)})`, `${px(9)} solid ${C.stone}`);
  B.disc(0, L, 300 * k, "transparent", `${px(6)} dotted ${FL[6]}`);
  B.disc(0, L, 292 * k, "transparent", `${px(2)} solid ${C.gold}`, 0.8);
  /* กลีบดอกไม้หล่นบนสนาม */
  for (let j = 0; j < 70; j++) {
    const a = rand() * Math.PI * 2;
    const rr = (140 + rand() * 230) * k;
    B.oval(Math.cos(a) * rr, L + Math.sin(a) * rr, 7 * k, 4 * k, FL[j % 6], 0.85, rand() * 180);
  }
  /* น้ำพุกลาง: อ่างหินสูง + น้ำ + ระลอก + ใบบัว + แท่นวางกองไพ่ */
  const Lb = B.cyl(0, L, 126 * k, AH.center[1], sideS, C.stone, `${px(10)} solid ${C.stone2}`);
  B.disc(0, Lb, 108 * k, `radial-gradient(circle at 40% 35%, ${C.water1} 0%, ${C.water2} 100%)`);
  for (let r = 0; r < 3; r++) B.disc(0, Lb, 104 * k, "transparent", `${px(2.5)} solid rgba(255,255,255,0.85)`, 1, `arRipple 3.6s ease-out ${r1(-r * 1.2)}s infinite`);
  for (let lp = 0; lp < 7; lp++) {
    const la = (lp * 51 * Math.PI) / 180;
    const lr = (66 + (lp % 2) * 18) * k;
    B.disc(Math.cos(la) * lr, Lb + Math.sin(la) * lr, 13 * k, night ? "#2f6a4e" : "#5fae58", null, 0.95);
    B.disc(Math.cos(la) * lr, Lb + Math.sin(la) * lr, 5 * k, FL[lp % 5], null, 1);
  }
  const Lp = B.cyl(0, Lb, 40 * k, AH.center[2], sideS, C.stone, `${px(5)} solid ${C.stone2}`);
  B.hazeCol = night ? "rgba(14,24,50,0.85)" : "rgba(255,246,232,0.8)";
  B.fore = (W, H, S) => {
    [[0.03, 0.97, 230, 0], [0.97, 0.99, 260, 3], [0.0, 0.1, 170, 1], [1.0, 0.06, 190, 4], [0.16, 1.04, 150, 2], [0.85, 1.05, 140, 5]].forEach((b, i) => {
      B.foreAdd("Bloom", W * b[0], H * b[1], b[2] * S * 1.5, b[2] * S * 1.5, {
        col: FL[b[3]], col2: night ? "#c9b45e" : "#ffe27a", blur: 9 * S, op: night ? 0.55 : 0.85,
        anim: `arSway ${5 + i}s ease-in-out ${-i * 0.8}s infinite`,
      });
    });
  };

  return {
    ringLift: L,
    centerLift: Lp,
    seatPad: (p, st, rr) => {
      const y = p.y + L;
      B.disc(p.x, y, rr * 1.9, `radial-gradient(circle, ${st.col} 0%, transparent 70%)`, null, night ? 0.7 : 0.4);
      B.disc(p.x, y, rr * 1.12, "transparent", `${px(9)} dotted ${FL[((Math.round(st.phi) / 10) | 0) % 6]}`);
      return B.cyl(p.x, y, rr * 0.8, AH.pad, sideS, st.col, `${px(3)} solid rgba(255,255,255,0.9)`) - p.y;
    },
    after: () => {
      /* แนวเนินไกลปิดช่องระหว่างขอบพื้นกับเส้นขอบฟ้า (มุมกล้องต่ำเห็นท้องฟ้า) */
      B.stand("Hills", 0, -1660 * k, 3400, 420, { h1: night ? "#2a4250" : "#cfe8c8", h2: night ? "#22394a" : "#b2d8a4" }, false);
      B.stand("Windmill", 0, -1450 * k, 260, 380, {});
      /* ซุ้มกุหลาบที่ทางเข้า */
      [270, 0, 180].forEach((d) => {
        const p = seatPoint(600 * k, d);
        B.stand("Arch", p.x, p.y, 160, 180, { d1: FL[0], d2: FL[3] });
      });
      /* พุ่มดอกไม้รอบแนวพุ่ม */
      const br = rand32(23);
      for (let b = 0; b < 34; b++) {
        const bd = 190 + b * (160 / 33) + (br() - 0.5) * 3;
        if (Math.abs(bd - 270) < 9 || Math.abs(bd - 180) < 9 || Math.abs(bd - 360) < 9) continue;
        const bp = seatPoint((615 + br() * 30) * k, bd);
        const bs = 0.75 + br() * 0.5;
        B.stand("Bush", bp.x, bp.y, 100 * bs, 80 * bs, { c1: C.leaf[0], c2: C.leaf[1], c3: C.leaf[2], d1: FL[b % 7], d2: FL[(b + 3) % 7] });
      }
      /* ทานตะวันข้างทาง */
      for (let s = 0; s < 26; s++) {
        const sd = (s < 13 ? 150 + s * 2.4 : 2 + (s - 13) * 2.4) + br() * 2;
        const sp = seatPoint((680 + br() * 120) * k, sd);
        B.stand("Sunflower", sp.x, sp.y, 40, 110 + br() * 30, { anim: `arSway ${r1(3 + br() * 2)}s ease-in-out ${r1(-br() * 4)}s infinite` });
      }
      /* ต้นไม้ดอกหลายสีในทุ่ง */
      const TR = night
        ? [["#7d5a86", "#6a4a73", "#9c79a6"], ["#4f6f8c", "#405d77", "#6d8eab"], ["#8a6d4f", "#765b40", "#a88a69"], ["#7a4f63", "#663f52", "#9a6c80"]]
        : [["#f6a9c8", "#ec8cb2", "#ffd3e3"], ["#c7a6f0", "#ad87e4", "#e2cffb"], ["#ffe07a", "#f5c94a", "#fff2b8"], ["#ffffff", "#e9eef5", "#ffffff"], ["#ff9f7a", "#f4835c", "#ffc8b0"]];
      for (let t = 0; t < 46; t++) {
        const td = br() * 360;
        if (Math.abs(td - 270) < 12 || nearSector(td)) continue;
        const tp = seatPoint((760 + br() * 820) * k, td);
        const ts = 0.8 + br() * 0.6;
        const tc = TR[t % TR.length];
        B.stand("Ftree", tp.x, tp.y, 140 * ts, 170 * ts, { c1: tc[0], c2: tc[1], c3: tc[2], d1: FL[t % 7], trunk: night ? "#3e3a40" : "#8b6b55" });
      }
      /* เอฟเฟกต์: แสงแดด · กลีบปลิว · ผีเสื้อ/หิ่งห้อย · ละอองเกสร */
      const f = rand32(77);
      const { W, H } = B.c;
      const S = B.S;
      if (!night) {
        B.fxAdd("Glow", W * 0.1, H * 0.02, W * 0.9, H * 0.9, { col: "rgba(255, 240, 200, 0.55)", anim: "arPulse 7s ease-in-out infinite" });
        for (let g = 0; g < 4; g++) B.fxAdd("Ray", W * (0.18 + g * 0.16), H * 0.2, 90 * S, H * 1.1, { rot: 28, op: 0.5, col: "rgba(255, 248, 220, 0.5)", anim: `arPulse ${6 + g}s ease-in-out ${-g * 1.7}s infinite` });
      } else {
        B.fxAdd("Glow", W * 0.85, H * 0.05, W * 0.6, H * 0.6, { col: "rgba(200, 220, 255, 0.35)" });
      }
      for (let pt = 0; pt < 46; pt++) {
        const pz = (9 + f() * 10) * S;
        B.fxAdd("Petal", f() * W * 1.15, f() * H * 0.9 - H * 0.1, pz, pz * 0.62, {
          col: FL[pt % 6], op: night ? 0.6 : 0.95,
          anim: `${pt % 2 ? "arFallA " : "arFallB "}${r1(7 + f() * 7)}s linear ${r1(-f() * 14)}s infinite`,
        });
      }
      if (!night) {
        const BF = [["#f6d443", "#ef8f2f"], ["#5f9ff0", "#b9dcff"], ["#ffffff", "#f6c1d6"], ["#b07fe0", "#f2d9ff"], ["#f7a14a", "#ffe0a8"], ["#ef4f6b", "#ffd0d8"], ["#5f9ff0", "#ffffff"]];
        for (let bf = 0; bf < 7; bf++) {
          const bpx = proj(B.c, (f() - 0.5) * 760 * k, (-f() * 380 + 60) * k);
          const bz = 30 * S * (0.8 + f() * 0.5);
          B.fxAdd("Fly", bpx.x, bpx.y - (40 + f() * 120) * S, bz, bz, {
            col: BF[bf][0], col2: BF[bf][1],
            anim: `arBob ${r1(5 + f() * 4)}s ease-in-out ${r1(-f() * 6)}s infinite`, inner: `arFlap ${r1(0.28 + f() * 0.15)}s ease-in-out infinite`,
          });
        }
      }
      for (let sp2 = 0; sp2 < (night ? 40 : 26); sp2++) {
        const sz = (night ? 8 + f() * 8 : 5 + f() * 6) * S;
        B.fxAdd("Spark", f() * W, H * 0.12 + f() * H * 0.7, sz, sz, {
          col: night ? "#fff3a0" : "#fff6c8",
          anim: `${night ? "arFloat " : "arTwinkle "}${r1(3 + f() * 4)}s ease-in-out ${r1(-f() * 6)}s infinite`,
        });
      }
    },
  };
}

/* ต้นไม้ตายบิดเบี้ยว 7 แบบ (path เติมสีก้อนเดียว + เถาวัลย์ห้อยจากปลายกิ่ง) — คำนวณครั้งเดียว */
let DEAD = null;
function deadTrees() {
  if (DEAD) return DEAD;
  DEAD = [];
  for (let v = 0; v < 7; v++) {
    const r = seeded(900 + v);
    const t = twistedTree(311 + v * 7, 120, 318, 300, { twist: 0.7 + r() * 0.3, depth: 4 + (v % 2), spread: 0.75 + r() * 0.2, width: 13 + r() * 7, lean: (r() - 0.5) * 0.3 });
    let vines = "";
    t.tips.forEach((tp, i) => {
      if (i % 4 !== 0) return;
      const L = 18 + r() * 46;
      vines += `M ${r1(tp[0])} ${r1(tp[1])} q ${r1((r() - 0.5) * 10)} ${r1(L / 2)} ${r1((r() - 0.5) * 6)} ${r1(L)} `;
    });
    DEAD.push({ d: t.d, vines });
  }
  return DEAD;
}

/* ============================================================
   ภูมิภาค III — ป่าไม้ต้องสาป
   สนาม = ลานดินแห้งกลางป่าตาย · วงที่นั่ง = รากไม้ดำ · กลางสนาม = ตอไม้ผุยักษ์ + วงคำสาป
   รอบนอก = ต้นไม้ตายหนาแน่น · ป้ายหลุมศพ · หินจารึก · พุ่มไม้แห้ง
   ============================================================ */
function area3(B) {
  const { k, px, night } = B;
  const AH = AREA_H[3];
  const rand = rand32(303);
  const C = night ? {
    sky: "linear-gradient(180deg, #04020a 0%, #120a1d 34%, #26143a 64%, #3a1f4a 100%)", hills: ["#2a1a38", "#1f1229"], clear: "#2a2433", moss: "#17121d", dark: "#06030a", leaf: "rgba(90, 70, 110, 0.4)", leaf2: "rgba(5, 3, 8, 0.6)",
    root: ["#0d0a10", "#1c1622"], bark: "#120e16", ring1: "#3a3040", ring2: "#2c2432", curse: "#b06cf0", curseGlow: "rgba(160, 90, 240, 0.5)",
    shadow: "rgba(0, 0, 0, 0.65)", tree: ["#06030a", "#150b1e", "#26183a"], fog: "rgba(138, 85, 181, 0.32)", haze: ["rgba(8,4,14,0.9)", "rgba(40,20,60,0.45)"],
    grave: "#3a3346", dead: "#3a3044",
  } : {
    sky: "linear-gradient(180deg, #181d16 0%, #2b3425 30%, #4a5538 58%, #767f55 80%, #8a8d62 100%)", hills: ["#46513a", "#343e2a"], clear: "#6b6a4c", moss: "#3e4430", dark: "#151a10", leaf: "rgba(110, 90, 50, 0.55)", leaf2: "rgba(20, 24, 14, 0.45)",
    root: ["#14170f", "#2a2e1f"], bark: "#1c2015", ring1: "#5b5640", ring2: "#4a4633", curse: "#c9d66a", curseGlow: "rgba(201, 214, 106, 0.4)",
    shadow: "rgba(8, 10, 5, 0.5)", tree: ["#0f130c", "#252d1e", "#343e2a"], fog: "rgba(185, 196, 141, 0.42)", haze: ["rgba(43,52,37,0.92)", "rgba(74,85,56,0.5)"],
    grave: "#7a7a68", dead: "#8a8160",
  };
  B.sky = C.sky;
  B.shadow = C.shadow;
  B.hazeDark = true;
  B.hazeGrad = `linear-gradient(180deg, ${C.haze[0]} 0%, ${C.haze[1]} 24%, rgba(0,0,0,0) 52%)`;
  B.ground = `radial-gradient(circle, ${C.leaf} 0 ${px(3.5)}, transparent ${px(4.5)}) 0 0 / ${px(23)} ${px(27)}, `
    + `radial-gradient(circle, ${C.leaf2} 0 ${px(7)}, transparent ${px(8)}) ${px(9)} ${px(11)} / ${px(41)} ${px(37)}, `
    + `radial-gradient(circle at 50% 50%, ${C.clear} 0, ${C.clear} ${px(440)}, ${C.moss} ${px(700)}, ${C.dark} ${px(1450)})`;
  /* ดินแตกระแหง + ขอบลานไม่เป็นวงกลม */
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2;
    const rr = (500 + rand() * 60) * k;
    B.disc(Math.cos(a) * rr, Math.sin(a) * rr, (90 + rand() * 70) * k, `radial-gradient(circle, ${C.clear} 0%, transparent 70%)`, null, 0.85);
  }
  for (let cr = 0; cr < 26; cr++) {
    const ca = rand() * Math.PI * 2;
    const crr = (150 + rand() * 330) * k;
    B.rect(Math.cos(ca) * crr, Math.sin(ca) * crr, (40 + rand() * 60) * k, 2.5 * k, C.root[0], null, rand() * 180, 0.55);
  }
  /* ใบไม้ตาย + หญ้าแห้ง */
  for (let lf = 0; lf < 110; lf++) {
    const la = rand() * Math.PI * 2;
    const lr = (60 + rand() * 520) * k;
    B.oval(Math.cos(la) * lr, Math.sin(la) * lr, (7 + rand() * 5) * k, (3.5 + rand() * 2) * k, ["#5d4a2a", "#7a6234", "#4a3d24", "#6b6440"][lf % 4], night ? 0.45 : 0.8, rand() * 180);
  }
  /* รากไม้ดำแผ่ออกไปทางป่า */
  for (let rt = 0; rt < 14; rt++) {
    const rd = rt * (360 / 14) + rand() * 10;
    if (nearSector(rd)) continue;
    const rp = seatPoint(470 * k, rd);
    B.rect(rp.x, rp.y, 300 * k, (16 + rand() * 10) * k, `linear-gradient(180deg, ${C.root[0]}, ${C.root[1]} 50%, ${C.root[0]})`, null, rd + (rand() - 0.5) * 14, 1, px(14));
  }
  /* วงรากไม้ = วงที่นั่ง */
  B.disc(0, 0, 330 * k, "transparent", `${px(10)} solid ${C.root[0]}`, 0.7);
  for (let s = 0; s < 20; s++) {
    const sd = s * 18 + rand() * 6;
    const sp = seatPoint((300 + (rand() - 0.5) * 18) * k, sd);
    B.rect(sp.x, sp.y, (120 + rand() * 30) * k, (24 + rand() * 10) * k, `linear-gradient(180deg, ${C.root[0]}, ${C.root[1]} 45%, ${C.root[0]})`, null, sd + 90 + (rand() - 0.5) * 16, 1, "50%");
  }
  /* วงคำสาป */
  B.disc(0, 0, 230 * k, `radial-gradient(circle, ${C.curseGlow} 0%, transparent 70%)`, null, 1, "arPulse 4s ease-in-out infinite");
  B.disc(0, 0, 196 * k, "transparent", `${px(3)} solid ${C.curse}`, 0.85, "arPulse 4s ease-in-out infinite");
  B.disc(0, 0, 178 * k, "transparent", `${px(2.5)} dashed ${C.curse}`, 0.7, "arSpin 40s linear infinite");
  for (let h = 0; h < 3; h++) B.rect(0, 0, 250 * k, 250 * k, "transparent", `${px(2)} solid ${C.curse}`, h * 30 + 15, 0.45);
  for (let rn = 0; rn < 8; rn++) {
    const ra = (rn * 45 * Math.PI) / 180;
    B.rect(Math.cos(ra) * 212 * k, Math.sin(ra) * 212 * k, 22 * k, 22 * k, "transparent", `${px(2.5)} solid ${C.curse}`, rn * 45 + 45, 0.8);
  }
  /* ตอไม้ผุยักษ์กลางสนาม */
  const barkSide = `linear-gradient(90deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 38%, rgba(0,0,0,0.6) 100%), repeating-linear-gradient(90deg, ${C.root[0]} 0 ${px(9)}, ${C.root[1]} ${px(9)} ${px(16)})`;
  const ringsTop = `repeating-radial-gradient(circle at 46% 52%, ${C.ring1} 0 ${px(7)}, ${C.ring2} ${px(7)} ${px(12)})`;
  const Ls = B.cyl(0, 0, 124 * k, AH.center[0], barkSide, ringsTop, `${px(14)} solid ${C.bark}`);
  B.rect(18 * k, Ls - 30 * k, 120 * k, 6 * k, C.bark, null, -38, 0.95);
  B.rect(-30 * k, Ls + 26 * k, 90 * k, 5 * k, C.bark, null, 22, 0.95);
  B.rect(-6 * k, Ls - 2 * k, 70 * k, 4 * k, C.bark, null, 96, 0.9);
  B.disc(0, Ls, 70 * k, `radial-gradient(circle, ${C.curseGlow} 0%, transparent 70%)`, null, 1, "arPulse 4s ease-in-out infinite");
  B.fore = (W, H, S) => {
    const brc = night ? "#030205" : "#0b0e08";
    [[0.06, 0.04, 560, 360, 0], [0.95, 0.02, 600, 380, 1], [0.0, 0.96, 440, 300, 2], [1.0, 0.98, 480, 300, 3]].forEach((b, i) => {
      B.foreAdd("Branch", W * b[0], H * b[1], b[2] * S, b[3] * S, {
        col: brc, col2: "rgba(0,0,0,0)", blur: 6 * S, op: 0.95, rot: i % 2 ? 180 : 0,
        anim: `arSway ${7 + i}s ease-in-out ${-i * 1.4}s infinite`,
      });
    });
  };
  return {
    ringLift: 0,
    centerLift: Ls,
    seatPad: (p, st, rr) => {
      B.disc(p.x, p.y, rr * 1.9, `radial-gradient(circle, ${st.col} 0%, transparent 70%)`, null, night ? 0.75 : 0.5);
      return B.cyl(p.x, p.y, rr * 1.05, AH.pad, barkSide, `repeating-radial-gradient(circle, ${C.ring1} 0 ${px(4)}, ${C.ring2} ${px(4)} ${px(7)})`, `${px(5)} solid ${st.col}`) - p.y;
    },
    after: () => {
      const tr = rand32(37);
      B.stand("Hills", 0, -1660 * k, 3400, 420, { h1: C.hills[0], h2: C.hills[1] }, false);
      const DT = deadTrees();
      /* ป่าต้นไม้ตาย (ใกล้ = ดำสนิท · ไกล = จางเข้าหมอก ด้วย filter ของ stand) */
      for (let t = 0; t < 120; t++) {
        const td = tr() * 360;
        if (nearSector(td)) continue;
        const trr = (560 + Math.pow(tr(), 0.7) * 1000) * k;
        const tp = seatPoint(trr, td);
        const ts = 1 + tr() * 0.9;
        const v = DT[t % DT.length];
        B.stand("Dead", tp.x, tp.y, 240 * ts, 320 * ts, { dd: v.d, vines: v.vines, col: C.tree[0], anim: t % 5 === 0 ? `arSway ${r1(6 + tr() * 4)}s ease-in-out infinite` : "none" });
      }
      /* ต้นไม้ตายยักษ์ขนาบซ้าย-ขวา (ใกล้กล้อง) — กรอบภาพให้ป่าดูโอบล้อมสนาม */
      [[150, 610, 2.3, 0], [30, 610, 2.4, 3], [168, 740, 1.9, 5], [12, 740, 2, 2], [196, 660, 1.6, 4], [344, 660, 1.7, 6]].forEach(([deg, rad, sc, vi]) => {
        const hp = seatPoint(rad * k, deg);
        const v = DT[vi % DT.length];
        B.stand("Dead", hp.x, hp.y, 240 * sc, 320 * sc, { dd: v.d, vines: v.vines, col: C.tree[0], anim: "none" });
      });
      /* ป้ายหลุมศพเอียง + หลักไม้ผุ */
      for (let g = 0; g < 14; g++) {
        const gd = 170 + g * 15 + tr() * 8;
        const gp = seatPoint((450 + tr() * 70) * k, gd);
        B.stand(g % 3 === 2 ? "Stake" : "Grave", gp.x, gp.y, 46, 60, { col: C.grave, c1: C.dead, rot: r1((tr() - 0.5) * 24) });
      }
      /* พุ่มไม้แห้งตายริมลาน */
      for (let th = 0; th < 14; th++) {
        const hd = 178 + th * 13 + tr() * 6;
        const hp = seatPoint((540 + tr() * 25) * k, hd);
        const hs = 0.85 + tr() * 0.6;
        B.stand("Shrub", hp.x, hp.y, 140 * hs, 90 * hs, { col: C.tree[0], c1: night ? "#4a3a52" : "#6b5a36" });
      }
      [205, 270, 335].forEach((d) => {
        const p = seatPoint(400 * k, d);
        B.stand("Monolith", p.x, p.y, 80, 170, { col: C.curse });
      });
      /* เอฟเฟกต์: หมอกหนา · อีกาบินวน · ตาในความมืด · ดวงไฟผี (กลางคืน) · ฝุ่นละออง · ขอบมืด */
      const f = rand32(91);
      const { W, H } = B.c;
      const S = B.S;
      if (!night) B.fxAdd("Glow", W * 0.78, H * 0.04, W * 0.5, H * 0.55, { col: "rgba(226, 232, 180, 0.4)", anim: "arPulse 12s ease-in-out infinite" });
      for (let fg = 0; fg < 8; fg++) {
        B.fxAdd("Fog", W * (0.05 + f() * 0.9), H * (0.18 + fg * 0.09), W * (0.55 + f() * 0.4), H * 0.18, {
          col: C.fog, anim: `arDrift ${r1(18 + f() * 16)}s ease-in-out ${r1(-f() * 20)}s infinite`,
        });
      }
      if (!night) {
        [[0.42, 0.16, "A"], [0.6, 0.22, "B"], [0.3, 0.3, "B"], [0.72, 0.12, "A"]].forEach((cw, i) => {
          B.fxAdd("Crow", W * cw[0], H * cw[1], 34 * S, 20 * S, { col: "#0c0f0a", anim: `arOrbit${cw[2]} ${12 + i * 3}s linear ${-i * 4}s infinite`, inner: "arFlapY 0.5s ease-in-out infinite" });
        });
      }
      const EY = night ? [[0.06, 0.2], [0.93, 0.16], [0.13, 0.46], [0.88, 0.42], [0.5, 0.05], [0.33, 0.1], [0.68, 0.08]] : [[0.07, 0.22], [0.92, 0.18], [0.5, 0.06]];
      EY.forEach((e, i) => {
        B.fxAdd("Eyes", W * e[0], H * e[1], 26 * S, 8 * S, { col: i % 3 === 1 ? "#ff4a3a" : "#f6e05a", anim: `arBlink ${5 + i}s ease-in-out ${-i * 1.3}s infinite` });
      });
      if (night) {
        for (let w = 0; w < 10; w++) {
          const wz = (14 + f() * 14) * S;
          B.fxAdd("Wisp", W * (0.08 + f() * 0.84), H * (0.12 + f() * 0.55), wz, wz, { col: "#b98af0", anim: `arFloat ${r1(5 + f() * 5)}s ease-in-out ${r1(-f() * 8)}s infinite` });
        }
      }
      for (let sp2 = 0; sp2 < 30; sp2++) {
        const sz = (3 + f() * 4) * S;
        B.fxAdd("Spark", f() * W, H * 0.1 + f() * H * 0.75, sz, sz, { col: night ? "#d9c2ff" : "#e6e8c0", op: 0.7, anim: `arFloat ${r1(4 + f() * 4)}s ease-in-out ${r1(-f() * 6)}s infinite` });
      }
      B.fxAdd("Vignette", W / 2, H / 2, W, H, { col: night ? "rgba(0,0,0,0.8)" : "rgba(8,10,5,0.7)" });
    },
  };
}

/* ภูมิภาค IV–VII อยู่คนละไฟล์ใน areas/ (default export { H, build }) */
const AREAS = { 1: area1, 2: area2, 3: area3 };
for (const [id, mod] of Object.entries(EXTRA_AREAS)) {
  AREAS[id] = mod.build;
  AREA_H[id] = mod.H;
}

/* สร้างฉากทั้งฉาก
   seats = [{ phi, col, me?, target?, boss? }] · lowQ = ตัด fx (เหลือ Vignette) / fore / filter ของ stand */
export function buildArena({ W, H, area, night, seats, lowQ = false, noFx = false, noFore = false, pop }) {
  const c = { ...arenaCamera(W, H), area, night: !!night, pop };
  const B = makeBuilder(c);
  const A = (AREAS[area] || area1)(B);
  const { k, R, px } = B;
  const list = seats || [];
  let meP = null;
  const RL = A.ringLift || 0;
  const lifts = list.map((st) => {
    const p = seatPoint(R, st.phi);
    if (st.me) meP = p;
    const rr = (st.boss ? 62 : st.me ? 40 : 30) * k;
    const top = A.seatPad(p, st, rr);
    if (st.target) B.disc(p.x, p.y + top, rr * 1.75, "transparent", `${px(3)} dashed #ff5d72`, 1, "arSpin 12s linear infinite");
    return top;
  });
  list.forEach((st) => {
    if (!st.target || !meP) return;
    const p = seatPoint(R, st.phi);
    const dx = p.x - meP.x;
    const dy = p.y - meP.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    B.rect((p.x + meP.x) / 2, RL + (p.y + meP.y) / 2, len - 110 * k, 7 * k,
      `repeating-linear-gradient(90deg, rgba(255,93,114,0.95) 0 ${px(18)}, transparent ${px(18)} ${px(30)})`, null, (Math.atan2(dy, dx) * 180) / Math.PI, 0.95);
  });
  /* แสงทิศทาง (แดดซ้ายบน) / ป่ามืดลงตามระยะ — คลุมพื้นทั้งแผ่น */
  B.flat(0, 0, B.HS * 2, B.HS * 2, {
    bg: B.hazeDark
      ? `radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 0, rgba(0,0,0,0) ${px(420)}, rgba(0,0,0,0.55) ${px(1100)})`
      : "linear-gradient(125deg, rgba(255,250,225,0.22) 0%, rgba(255,250,225,0) 45%, rgba(10,30,60,0.16) 100%)",
  });
  A.after();
  B.stands.sort((a, b) => a.y - b.y);
  const pts = list.map((st, idx) => {
    const p = seatPoint(R, st.phi);
    return { idx, phi: st.phi, ...seatScreen(c, p, lifts[idx]), col: st.col, me: !!st.me, boss: !!st.boss, target: !!st.target };
  });
  /* หมอกระยะไกล (ขอบบนจอ) + ของเบลอบังหน้ากล้อง */
  const haze = B.hazeGrad ? B.hazeGrad : B.hazeDark
    ? "linear-gradient(180deg, rgba(4,8,4,0.88) 0%, rgba(14,24,12,0.5) 24%, rgba(0,0,0,0) 50%)"
    : `linear-gradient(180deg, ${B.hazeCol || "rgba(235,244,252,0.8)"} 0%, rgba(255,255,255,0) 38%)`;
  const wantFore = !noFore && !lowQ;
  if (wantFore && B.fore) B.fore(c.W, c.H, B.S);

  const flats = B.flats.map((f, i) => {
    const style = {
      left: f.l, top: f.t, width: f.w, height: f.h,
      background: f.bg, border: f.bd, borderRadius: f.rad,
    };
    if (f.rot !== 0) style.transform = `rotate(${f.rot}deg)`;
    if (f.op !== 1) style.opacity = f.op;
    if (f.anim !== "none") style.animation = f.anim;
    return { key: `f${i}`, style };
  });
  const stands = B.stands.map(({ l, t, w, h, y: _y, ...rest }, i) => ({
    ...rest,
    key: `s${i}`, i, left: l, top: t, width: w, height: h,
    filter: lowQ ? "none" : rest.filter,
  }));
  let fx = noFx ? [] : B.fx;
  if (lowQ) fx = fx.filter((f) => f.kind === "Vignette");
  fx = fx.map((f, i) => ({ key: `x${i}`, ...f }));
  const fore = wantFore ? B.foreList.map((f, i) => ({ key: `o${i}`, ...f })) : [];

  return {
    sky: B.sky,
    plane: { left: r1(c.W / 2 - B.HS), top: r1(c.cy - B.HS), size: r1(B.HS * 2), rx: r1(B.th), perspective: c.p, originY: c.oy },
    ground: B.ground,
    flats,
    stands,
    fx,
    fore,
    haze,
    center: proj(c, 0, A.centerLift || 0),
    centerLift: A.centerLift || 0,
    pts,
  };
}
