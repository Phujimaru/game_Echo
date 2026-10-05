// ============================================================
//  Moon Cell — ภาพภายในสถานที่ (วาดลง canvas · พื้นที่ 960x540 จัดกลางจอ แผงตัวเลือกอยู่ฝั่งขวา x ≥ 600)
//  ห้องพัก / โบสถ์ / ห้องสมุด / สวนสาธารณะ / ร้านค้า — มีชุดสีกลางวัน/กลางคืน
// ============================================================

import { C, EC, IC, TAU, lcg, glow, survey, hexP, rr, navy } from "./ocKit";

const BOOK = ["#bee3f8", "#7fb8e6", "#c99ad6", "#dce7f3", "#8ba3c2", "#a9c9ea"];
const BOOK_N = ["#3d6fa8", "#5a8fc8", "#7b4f8f", "#2c4f80", "#4f6e95", "#6f95c6"];
const LIB = (() => { const r = lcg(42), a = []; for (let i = 0; i < 300; i++) a.push([r(), r(), r()]); return a; })();

function bg(c, W, night) {
  const g = c.createLinearGradient(0, 0, 0, 540);
  if (night) { g.addColorStop(0, "#0f2447"); g.addColorStop(1, "#1a3864"); } else { g.addColorStop(0, "#f9fbfe"); g.addColorStop(1, "#e4edf7"); }
  c.fillStyle = g; c.fillRect(0, 0, W, 540);
}
function floorPlane(c, W, y0, night, vx = W / 2) {
  const fg = c.createLinearGradient(0, y0, 0, 540);
  if (night) { fg.addColorStop(0, "#22416b"); fg.addColorStop(1, "#0e1f3b"); } else { fg.addColorStop(0, "#edf3f9"); fg.addColorStop(1, "#cddcec"); }
  c.fillStyle = fg; c.fillRect(0, y0, W, 540 - y0);
  c.strokeStyle = night ? "rgba(127,184,230,.16)" : "rgba(61,139,217,.14)"; c.lineWidth = 1; c.beginPath();
  for (let i = -16; i <= 16; i++) { const sx = vx + i * 80; c.moveTo(sx, y0); c.lineTo(sx + (sx - vx) * 0.9, 540); }
  for (const f of [0.08, 0.22, 0.42, 0.7]) { const y = y0 + (540 - y0) * f; c.moveTo(0, y); c.lineTo(W, y); }
  c.stroke();
  c.fillStyle = night ? "rgba(127,184,230,.45)" : "rgba(61,139,217,.35)"; c.fillRect(0, y0, W, 1.5);
}
function vignette(c, W, night) {
  const v = c.createRadialGradient(W / 2, 270, 200, W / 2, 270, W * 0.75);
  v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, night ? "rgba(4,10,26,.55)" : "rgba(190,210,232,.45)");
  c.fillStyle = v; c.fillRect(0, 0, W, 540);
}
function line(night) { return night ? "rgba(190,227,248,.55)" : "rgba(61,139,217,.5)"; }
function paperFill(night) { return night ? "#2a4a75" : "#ffffff"; }

// ---------- ห้องพัก ----------
function room(c, W, t, night) {
  bg(c, W, night); survey(c, 0, 0, W, 360, 0, night ? 0.06 : 0.05);
  const ox = (W - 960) / 2;
  c.save(); c.translate(ox, 0);
  // หน้าต่างใหญ่ (ลูกโลกหลังหน้าต่างวาดโดยฉาก 3D ด้านหลัง — ที่นี่เจาะกระจกให้โปร่ง)
  c.save(); c.globalCompositeOperation = "destination-out"; c.fillRect(60, 70, 300, 250); c.restore();
  c.strokeStyle = line(night); c.lineWidth = 4; c.strokeRect(60, 70, 300, 250);
  c.lineWidth = 2; c.beginPath(); c.moveTo(210, 70); c.lineTo(210, 320); c.moveTo(60, 195); c.lineTo(360, 195); c.stroke();
  c.fillStyle = night ? "rgba(127,184,230,.5)" : "rgba(190,227,248,.9)";
  for (const [a, b, q, d] of [[40, 96, 78, 98], [380, 324, 342, 322]]) { c.beginPath(); c.moveTo(a, 56); c.lineTo(b, 56); c.quadraticCurveTo(q, 200, d, 340); c.lineTo(a, 340); c.closePath(); c.fill(); }
  c.fillStyle = night ? "rgba(190,227,248,.35)" : "rgba(255,255,255,.95)"; c.fillRect(52, 320, 316, 6);
  c.restore();
  floorPlane(c, W, 360, night);
  c.save(); c.translate(ox, 0);
  // แสงจากหน้าต่างตกพื้น
  const g = c.createLinearGradient(0, 320, 0, 540); g.addColorStop(0, night ? "rgba(160,205,255,.18)" : "rgba(255,255,255,.6)"); g.addColorStop(1, "rgba(255,255,255,0)");
  c.fillStyle = g; c.beginPath(); c.moveTo(60, 326); c.lineTo(360, 326); c.lineTo(520, 540); c.lineTo(140, 540); c.closePath(); c.fill();
  // เตียง
  c.fillStyle = paperFill(night); c.strokeStyle = line(night); c.lineWidth = 1.5;
  c.beginPath(); c.moveTo(650, 350); c.lineTo(920, 350); c.lineTo(948, 440); c.lineTo(622, 440); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = night ? "#3d6fa8" : C.ice; rr(c, 664, 330, 90, 28, 10); c.fill(); c.stroke();
  c.fillStyle = night ? "#2c4f80" : "#dce7f3"; c.beginPath(); c.moveTo(770, 352); c.lineTo(918, 352); c.lineTo(944, 436); c.lineTo(800, 436); c.closePath(); c.fill();
  // โต๊ะ + โคมไฟ + หนังสือ
  c.fillStyle = paperFill(night); c.fillRect(420, 392, 170, 12); c.strokeRect(420, 392, 170, 12);
  c.fillStyle = C.ink3; c.fillRect(430, 404, 7, 90); c.fillRect(574, 404, 7, 90);
  glow(c, 560, 360, 90, night ? "rgba(255,226,160,A)" : IC, night ? 0.5 : 0.6);
  c.fillStyle = night ? "#ffe7a8" : C.ice; c.beginPath(); c.moveTo(544, 362); c.lineTo(576, 362); c.lineTo(568, 344); c.lineTo(552, 344); c.closePath(); c.fill(); c.strokeStyle = line(night); c.stroke();
  c.fillStyle = C.ink3; c.fillRect(558, 362, 3, 30);
  c.fillStyle = C.echoGlow; c.fillRect(446, 380, 40, 12); c.fillStyle = C.sky; c.fillRect(450, 370, 34, 10);
  c.restore();
  vignette(c, W, night);
}

// ---------- โบสถ์ ----------
function church(c, W, t, night) {
  bg(c, W, night);
  const ox = (W - 960) / 2;
  c.save(); c.translate(ox, 0);
  survey(c, -ox, 0, W, 300, 0, 0.04);
  c.strokeStyle = night ? "rgba(190,227,248,.12)" : "rgba(61,139,217,.12)"; c.lineWidth = 2;
  for (let i = 0; i < 5; i++) { c.beginPath(); c.ellipse(300, 330, 260 - i * 44, 300 - i * 52, 0, Math.PI, 0); c.stroke(); }
  // หน้าต่างกุหลาบ
  const wx = 300, wy = 138, R = 96;
  glow(c, wx, wy, R * 2.4, night ? "rgba(201,154,214,A)" : IC, night ? 0.35 : 0.75);
  const cols = night ? ["#5a8fc8", "#c99ad6", "#bee3f8", "#7b4f8f", "#3d8bd9", "#ffffff"] : [C.ice, C.sky, "#ffffff", C.echoGlow, "#d6e8f7", C.azure];
  for (let i = 0; i < 16; i++) {
    c.beginPath(); c.moveTo(wx, wy); c.arc(wx, wy, R, (i * TAU) / 16, ((i + 1) * TAU) / 16); c.closePath();
    c.globalAlpha = 0.62 + 0.3 * Math.sin(t * 0.9 + i); c.fillStyle = cols[i % cols.length]; c.fill(); c.globalAlpha = 1;
  }
  c.strokeStyle = night ? "#0c1d3a" : C.ink; c.lineWidth = 2.4;
  for (let i = 0; i < 16; i++) { const a = (i * TAU) / 16; c.beginPath(); c.moveTo(wx, wy); c.lineTo(wx + Math.cos(a) * R, wy + Math.sin(a) * R); c.stroke(); }
  for (const r of [R * 0.35, R * 0.68, R]) { c.beginPath(); c.arc(wx, wy, r, 0, TAU); c.stroke(); }
  hexP(c, wx, wy, R * 0.16); c.fillStyle = "#fff"; c.fill(); c.stroke();
  // ลำแสง
  for (let i = 0; i < 4; i++) {
    const sw = Math.sin(t * 0.4 + i) * 10, g = c.createLinearGradient(wx, wy, wx + 140, 520);
    g.addColorStop(0, night ? "rgba(201,154,214,.28)" : "rgba(255,255,255,.75)"); g.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = g; c.beginPath(); c.moveTo(wx - 40 + i * 26, wy + 20); c.lineTo(wx - 4 + i * 26, wy + 20); c.lineTo(wx + 150 + i * 56 + sw, 540); c.lineTo(wx + 40 + i * 56 + sw, 540); c.closePath(); c.fill();
  }
  for (const x of [40, 526]) { c.fillStyle = paperFill(night); c.fillRect(x, 40, 34, 430); c.strokeStyle = line(night); c.lineWidth = 1; c.strokeRect(x, 40, 34, 430); }
  // ทางเดินกลาง + ม้านั่ง
  c.fillStyle = night ? "#1d3961" : "#e4edf7"; c.beginPath(); c.moveTo(-ox, 540); c.lineTo(230, 300); c.lineTo(370, 300); c.lineTo(620 + ox, 540); c.closePath(); c.fill();
  c.fillStyle = "rgba(155,79,150,.14)"; c.beginPath(); c.moveTo(282, 300); c.lineTo(318, 300); c.lineTo(362, 540); c.lineTo(238, 540); c.closePath(); c.fill();
  for (let i = 0; i < 6; i++) {
    const k = i / 5, y = 330 + k * k * 190, sp = 40 + k * 110, w = 40 + k * 130, h = 6 + k * 16;
    c.fillStyle = paperFill(night); c.strokeStyle = line(night); c.lineWidth = 1;
    c.fillRect(300 - sp - w, y, w, h); c.strokeRect(300 - sp - w, y, w, h); c.fillRect(300 + sp, y, w, h); c.strokeRect(300 + sp, y, w, h);
  }
  c.fillStyle = paperFill(night); c.fillRect(252, 284, 96, 24); c.strokeStyle = C.azure; c.strokeRect(252, 284, 96, 24);
  for (const x of [264, 300, 336]) {
    const f = 0.7 + 0.3 * Math.sin(t * 9 + x); glow(c, x, 270, 22, EC, 0.35 * f);
    c.fillStyle = "#f4f0e6"; c.fillRect(x - 2, 272, 4, 12); c.fillStyle = C.echo; c.beginPath(); c.ellipse(x, 268, 2.3, 4.2 * f, 0, 0, TAU); c.fill();
  }
  c.restore();
  vignette(c, W, night);
}

// ---------- ห้องสมุด ----------
function library(c, W, t, night) {
  bg(c, W, night);
  const ox = (W - 960) / 2;
  const books = night ? BOOK_N : BOOK;
  // ชั้นหนังสือเต็มผนังหลัง
  c.fillStyle = paperFill(night); c.fillRect(0, 40, W, 330);
  let n = 0;
  for (let row = 0; row < 6; row++) {
    const y = 52 + row * 52; c.fillStyle = line(night); c.fillRect(0, y + 44, W, 2);
    for (let x = 4; x < W;) { const s = LIB[n++ % LIB.length], w = 7 + s[0] * 9, h = 30 + s[1] * 12; c.fillStyle = books[Math.floor(s[2] * books.length)]; c.fillRect(x, y + 44 - h, w, h); c.fillStyle = "rgba(255,255,255,.18)"; c.fillRect(x + 1, y + 44 - h + 4, w - 2, 2); x += w + 1.5; }
  }
  for (let x = 0; x < W; x += 240) { c.fillStyle = night ? "#1d3961" : "#dfe8f3"; c.fillRect(x, 40, 10, 330); }
  c.save(); c.translate(ox, 0);
  // ผนังซ้ายเปอร์สเปกทีฟ
  c.fillStyle = night ? "#183258" : "#edf3fa"; c.beginPath(); c.moveTo(-ox, 0); c.lineTo(150, 40); c.lineTo(150, 370); c.lineTo(-ox, 470); c.closePath(); c.fill();
  for (let row = 0; row < 6; row++) {
    const ty = 52 + row * 52 + 44, by = ty + (ty - 200) * 0.65;
    c.strokeStyle = line(night); c.lineWidth = 2; c.beginPath(); c.moveTo(150, ty); c.lineTo(0, by); c.stroke();
    for (let i = 0; i < 14; i++) { const s = LIB[(row * 14 + i) % LIB.length], k = i / 14, x = 150 - k * 150, yb = ty + (by - ty) * k, hh = (26 + s[1] * 10) * (1 + k * 0.7); c.fillStyle = books[Math.floor(s[2] * books.length)]; c.fillRect(x - 9, yb - hh, 8 * (1 + k * 0.6), hh); }
  }
  c.restore();
  floorPlane(c, W, 370, night);
  c.save(); c.translate(ox, 0);
  glow(c, 360, 410, 210, night ? "rgba(255,226,160,A)" : IC, night ? 0.35 : 0.7);
  c.fillStyle = paperFill(night); c.strokeStyle = line(night); c.lineWidth = 1.5;
  c.beginPath(); c.moveTo(220, 420); c.lineTo(500, 420); c.lineTo(540, 456); c.lineTo(180, 456); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = C.ink3; c.fillRect(196, 456, 8, 70); c.fillRect(516, 456, 8, 70);
  c.fillStyle = night ? "#dce7f3" : C.paper; c.beginPath(); c.moveTo(300, 418); c.lineTo(360, 408); c.lineTo(420, 418); c.lineTo(360, 428); c.closePath(); c.fill(); c.stroke();
  // ตัวอักษรข้อมูลลอยขึ้นจากหนังสือเป็นหกเหลี่ยม
  for (let i = 0; i < 16; i++) {
    const k = (t * 0.16 + i / 16) % 1, x = 360 + Math.sin(i * 3.1 + t * 0.5) * 80, y = 410 - k * 290;
    c.globalAlpha = (1 - k) * 0.85; hexP(c, x, y, 5 + (i % 3)); c.strokeStyle = i % 3 ? C.azure : C.echo; c.lineWidth = 1.3; c.stroke(); c.globalAlpha = 1;
  }
  c.restore();
  vignette(c, W, night);
}

// ---------- สวนสาธารณะ ----------
function park(c, W, t, night) {
  // ฟ้าโปร่ง (ลูกโลก 3D อยู่ชั้นหลัง)
  c.fillStyle = night ? "rgba(10,28,60,.35)" : "rgba(255,255,255,.15)"; c.fillRect(0, 0, W, 330);
  survey(c, 0, 0, W, 330, 0, night ? 0.06 : 0.05);
  const r0 = lcg(12);
  c.fillStyle = night ? "rgba(127,184,230,.25)" : "rgba(139,163,194,.35)";
  for (let x = -20; x < W; ) { const w = 30 + r0() * 40, h = 30 + r0() * 80; c.fillRect(x, 330 - h, w, h); x += w + 4; }
  if (night) { c.fillStyle = "rgba(255,240,180,.7)"; const r1 = lcg(4); for (let i = 0; i < 70; i++) c.fillRect(r1() * W, 260 + r1() * 66, 2, 2); }
  const gg = c.createLinearGradient(0, 320, 0, 540);
  if (night) { gg.addColorStop(0, "#1f4060"); gg.addColorStop(1, "#0d2036"); } else { gg.addColorStop(0, "#e1eef2"); gg.addColorStop(1, "#c8dbe8"); }
  c.fillStyle = gg; c.fillRect(0, 320, W, 220);
  const ox = (W - 960) / 2;
  c.save(); c.translate(ox, 0);
  c.fillStyle = night ? "#2a4a75" : "#f4f8fc"; c.beginPath(); c.moveTo(250, 330); c.lineTo(330, 330); c.lineTo(520, 540); c.lineTo(120, 540); c.closePath(); c.fill();
  // ต้นไม้กระดาษตัด
  c.fillStyle = C.ink3; c.fillRect(94, 230, 14, 140);
  const leaves = night ? ["#3d6fa8", "#4f84bf", "#2c5b92", "#5a8fc8"] : [C.ice, "#cfe6f6", "#a9d3f0", "#d9eef9"];
  [[100, 200, 70], [52, 238, 50], [150, 236, 56], [100, 150, 52], [140, 180, 44], [58, 186, 46]].forEach(([x, y, r], i) => {
    c.fillStyle = leaves[i % 4]; c.beginPath(); c.arc(x + Math.sin(t * 0.6 + x) * 2, y, r, 0, TAU); c.fill(); c.strokeStyle = line(night); c.lineWidth = 1; c.stroke();
  });
  // น้ำพุ
  const fx = 380, fy = 380;
  c.fillStyle = paperFill(night); c.strokeStyle = line(night); c.lineWidth = 1.5; c.beginPath(); c.ellipse(fx, fy, 110, 26, 0, 0, TAU); c.fill(); c.stroke();
  c.fillStyle = "rgba(127,184,230,.45)"; c.beginPath(); c.ellipse(fx, fy - 4, 96, 20, 0, 0, TAU); c.fill();
  c.fillStyle = paperFill(night); c.fillRect(fx - 8, fy - 70, 16, 66); c.strokeRect(fx - 8, fy - 70, 16, 66);
  for (let i = 0; i < 44; i++) { const k = (t * 0.9 + i / 44) % 1, dir = (i % 2 ? 1 : -1) * (0.4 + (i % 5) / 5), x = fx + dir * k * 70, y = fy - 74 - Math.sin(k * Math.PI) * 50 + k * 60; c.fillStyle = `rgba(61,139,217,${(1 - k) * 0.65})`; c.fillRect(x, y, 2.4, 2.4); }
  for (const x of [230, 540]) { c.fillStyle = C.ink3; c.fillRect(x - 2, 240, 4, 140); glow(c, x, 238, 46, night ? "rgba(255,226,160,A)" : IC, 0.9); hexP(c, x, 238, 7); c.fillStyle = "#fff"; c.fill(); c.strokeStyle = C.azure; c.stroke(); }
  c.fillStyle = paperFill(night); c.fillRect(470, 420, 100, 8); c.fillRect(470, 404, 100, 6); c.fillStyle = C.ink3; c.fillRect(478, 428, 5, 22); c.fillRect(557, 428, 5, 22);
  c.restore();
  vignette(c, W, night);
}

// ---------- ร้านค้า ----------
function store(c, W, t, night) {
  bg(c, W, night); survey(c, 0, 0, W, 380);
  const ox = (W - 960) / 2;
  c.save(); c.translate(ox, 0);
  c.fillStyle = "#fff"; c.fillRect(80, 30, 420, 5); glow(c, 290, 34, 260, night ? "rgba(190,227,248,A)" : IC, night ? 0.35 : 0.8);
  const r = lcg(7), boxes = night ? BOOK_N : BOOK;
  for (let row = 0; row < 4; row++) {
    const y = 80 + row * 62; c.fillStyle = line(night); c.fillRect(40, y + 48, 500, 2);
    for (let x = 46; x < 530;) { const w = 18 + r() * 22, h = 22 + r() * 22; c.fillStyle = boxes[Math.floor(r() * boxes.length)]; c.fillRect(x, y + 48 - h, w, h); c.strokeStyle = line(night); c.lineWidth = 1; c.strokeRect(x, y + 48 - h, w, h); x += w + 4; }
  }
  c.fillStyle = paperFill(night); c.fillRect(20, 380, 560, 160); c.strokeStyle = line(night); c.lineWidth = 1.5; c.strokeRect(20, 380, 560, 160);
  c.fillStyle = night ? "#2c4f80" : C.frost; c.beginPath(); c.moveTo(0, 380); c.lineTo(580, 380); c.lineTo(560, 360); c.lineTo(20, 360); c.closePath(); c.fill(); c.stroke();
  navy(c, 410, 318, 104, 40, { k: 6 });
  c.fillStyle = "rgba(190,227,248,.75)"; c.fillRect(420, 328, 84, 14);
  c.fillStyle = "#e9be5a"; for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(80 + i * 16, 372, 6, 0, TAU); c.fill(); }
  c.restore();
  vignette(c, W, night);
}

export const PLACE_ART = { room, church, library, park, store };
/** สถานที่ที่ต้องเห็นท้องฟ้า/ลูกโลก 3D ด้านหลัง */
export const PLACE_SKY = { room: true, park: true };
