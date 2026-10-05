// ============================================================
//  Moon Cell — ชุดวาด canvas สไตล์ ORDEAL CALL (ใช้ร่วมกันทุกฉากของโหมด)
//  สี/จังหวะอนิเมชันตาม client/src/oc/theme.css + intro/dive.css:
//    oc-rise (เลื่อนขึ้น 14px + จาง) · ocd-shock (วงแหวนขยาย) · ocd-flash (แฟลชขาว) · ocd-banner · ocl-flow (เส้นประวิ่ง)
//  ทุกฉากวาดลง canvas ชั้นเดียว (ภาพรวยรายละเอียดได้โดยไม่สร้างเลเยอร์ GPU เพิ่ม — ดู quality-over-flash)
// ============================================================

export const TAU = Math.PI * 2;
export const C = {
  snow: "#f7fafd", paper: "#eef3f9", frost: "#dce7f3", ice: "#bee3f8", sky: "#7fb8e6", azure: "#3d8bd9",
  ink: "#1c3f6e", ink2: "#4f6e95", ink3: "#8ba3c2", echo: "#9b4f96", echoDeep: "#6e2c7a", echoGlow: "#c99ad6",
  hp: "#d2455b", warn: "#e8590c", gold: "#e3b341", navy: "rgba(18,38,72,.92)", navyLine: "rgba(127,184,230,.35)",
  navyText: "#eaf3fc", navyMute: "#9db8da"
};
/** สีแบบ template — แทน A ด้วยความทึบ: rgba(…, A) */
export const AZ = "rgba(61,139,217,A)", EC = "rgba(155,79,150,A)", HP = "rgba(210,69,91,A)", WT = "rgba(255,255,255,A)", IC = "rgba(190,227,248,A)", GD = "rgba(233,190,90,A)";
export const FD = "'Chakra Petch','Kanit',sans-serif";
export const FB = "'Kanit','Chakra Petch',sans-serif";

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
/** ≈ cubic-bezier(.2,.8,.2,1) ของ oc-rise */
export const ease = (p) => 1 - Math.pow(1 - clamp(p, 0, 1), 3);
export const lerp = (a, b, t) => a + (b - a) * t;

export function lcg(seed) { let s = seed || 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

// ห้ามตั้ง letterSpacing กับข้อความไทย (สระ/วรรณยุกต์แตก) — ls ใช้กับตัวอังกฤษเท่านั้น
export function T(c, s, x, y, o = {}) {
  c.font = `${o.w || 500} ${o.size || 16}px ${o.fam || FD}`;
  c.fillStyle = o.color || C.ink;
  c.textAlign = o.align || "left";
  c.textBaseline = o.base || "alphabetic";
  if ("letterSpacing" in c) c.letterSpacing = `${o.ls || 0}px`;
  c.fillText(s, x, y);
}
export function cutPath(c, x, y, w, h, k = 10) {
  c.beginPath(); c.moveTo(x + k, y); c.lineTo(x + w, y); c.lineTo(x + w, y + h - k);
  c.lineTo(x + w - k, y + h); c.lineTo(x, y + h); c.lineTo(x, y + k); c.closePath();
}
export function ticks(c, x, y, w, h, col = C.azure, s = 12) {
  c.strokeStyle = col; c.lineWidth = 2; c.beginPath();
  c.moveTo(x, y + s); c.lineTo(x, y); c.lineTo(x + s, y);
  c.moveTo(x + w - s, y + h); c.lineTo(x + w, y + h); c.lineTo(x + w, y + h - s); c.stroke();
}
/** แผงกระจกน้ำเงินในเกม (.oc-navy) */
export function navy(c, x, y, w, h, o = {}) {
  const k = o.k ?? 10;
  cutPath(c, x, y, w, h, k); c.fillStyle = o.fill || C.navy; c.fill();
  c.strokeStyle = o.line || C.navyLine; c.lineWidth = 1; c.stroke();
  if (o.accent !== false) {
    c.strokeStyle = o.accent || C.sky; c.lineWidth = 2; c.beginPath();
    c.moveTo(x, y + k + 12); c.lineTo(x, y + k); c.lineTo(x + k, y); c.lineTo(x + k + 12, y); c.stroke();
  }
}
export function rr(c, x, y, w, h, r) {
  c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}
export function hexP(c, x, y, r) {
  c.beginPath(); for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + i * Math.PI / 3; c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } c.closePath();
}
export function diamondP(c, x, y, r) { c.beginPath(); c.moveTo(x, y - r); c.lineTo(x + r * 0.68, y); c.lineTo(x, y + r); c.lineTo(x - r * 0.68, y); c.closePath(); }
export function heartP(c, x, y, r) { c.beginPath(); c.moveTo(x, y + r * 0.9); c.bezierCurveTo(x - r * 1.7, y - r * 0.2, x - r * 0.6, y - r * 1.3, x, y - r * 0.4); c.bezierCurveTo(x + r * 0.6, y - r * 1.3, x + r * 1.7, y - r * 0.2, x, y + r * 0.9); c.closePath(); }
export function shieldP(c, x, y, r) { c.beginPath(); c.moveTo(x, y - r); c.lineTo(x + r * 0.85, y - r * 0.62); c.lineTo(x + r * 0.72, y + r * 0.3); c.lineTo(x, y + r); c.lineTo(x - r * 0.72, y + r * 0.3); c.lineTo(x - r * 0.85, y - r * 0.62); c.closePath(); }
export function starP(c, x, y, r) { c.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? r * 0.45 : r; c.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); } c.closePath(); }
export function glow(c, x, y, r, col, a) {
  if (r <= 0 || a <= 0) return;
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, col.replace("A", a)); g.addColorStop(1, col.replace("A", 0));
  c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
}
export function lockIcon(c, x, y, s, color) {
  c.save(); c.strokeStyle = color; c.fillStyle = color; c.lineWidth = s * 0.16;
  c.beginPath(); c.arc(x, y - s * 0.25, s * 0.32, Math.PI, 0); c.stroke(); rr(c, x - s * 0.45, y - s * 0.25, s * 0.9, s * 0.7, s * 0.1); c.fill(); c.restore();
}
export function coinP(c, x, y, r, spin = 1) {
  const sx = Math.max(0.12, Math.abs(spin));
  c.save(); c.translate(x, y); c.scale(sx, 1);
  c.fillStyle = "#c9932b"; c.beginPath(); c.arc(1.5, 0, r, 0, TAU); c.fill();
  const g = c.createLinearGradient(-r, -r, r, r); g.addColorStop(0, "#fff1b8"); g.addColorStop(0.5, "#f0c24e"); g.addColorStop(1, "#c08a1e");
  c.fillStyle = g; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
  c.strokeStyle = "rgba(122,84,16,.8)"; c.lineWidth = 1.4; c.beginPath(); c.arc(0, 0, r * 0.62, 0, TAU); c.stroke();
  diamondP(c, 0, 0, r * 0.38); c.fillStyle = "rgba(122,84,16,.7)"; c.fill();
  c.restore();
}
/** ไอคอนตามชนิดของ (ของฟรีห้องพัก/ร้านค้า) */
export function itemIcon(c, type, x, y, r, color) {
  c.save(); c.fillStyle = color; c.strokeStyle = color; c.lineWidth = Math.max(1.5, r * 0.18);
  if (type === "heal") { c.fillRect(x - r * 0.25, y - r * 0.8, r * 0.5, r * 1.6); c.fillRect(x - r * 0.8, y - r * 0.25, r * 1.6, r * 0.5); }
  else if (type === "armor") { shieldP(c, x, y, r); c.fill(); }
  else if (type === "skill") { diamondP(c, x, y, r); c.fill(); }
  else if (type === "resist") { c.beginPath(); c.arc(x, y, r * 0.8, 0, TAU); c.stroke(); c.beginPath(); c.moveTo(x - r * 0.55, y + r * 0.55); c.lineTo(x + r * 0.55, y - r * 0.55); c.stroke(); }
  else if (type === "fortune") { starP(c, x, y, r); c.fill(); }
  else if (type === "guard") { hexP(c, x, y, r * 0.9); c.stroke(); hexP(c, x, y, r * 0.45); c.fill(); }
  else { diamondP(c, x, y, r); c.fill(); }
  c.restore();
}
export const ITEM_COL = { heal: C.hp, armor: C.azure, skill: C.echo, resist: "#6a5acd", fortune: "#d9a52b", guard: "#2f9e8f" };

/** กริดสำรวจ 48 หน่วย (.oc-screen::before) — off = เลื่อนตามกล้อง */
export function survey(c, x0, y0, w, h, off = 0, a = 0.055, step = 48) {
  c.save(); c.beginPath(); c.rect(x0, y0, w, h); c.clip(); c.strokeStyle = `rgba(61,139,217,${a})`; c.lineWidth = 1;
  c.beginPath();
  for (let x = x0 - (((off % step) + step) % step); x < x0 + w; x += step) { c.moveTo(x + 0.5, y0); c.lineTo(x + 0.5, y0 + h); }
  for (let y = y0; y < y0 + h; y += step) { c.moveTo(x0, y + 0.5); c.lineTo(x0 + w, y + 0.5); }
  c.stroke(); c.restore();
}

/** ลูกโลกเส้นลวด Moon Cell (ลูกโลกร่วมของ Ordeal Call) + วงแหวนโคจร + ดาวเทียม */
export function globe(c, x, y, r, t, o = {}) {
  const a = o.alpha ?? 1, night = !!o.night;
  c.save(); c.globalAlpha *= a;
  glow(c, x, y, r * 2.1, night ? "rgba(127,184,230,A)" : IC, night ? 0.35 : 0.65);
  const g = c.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.08, x, y, r);
  if (night) { g.addColorStop(0, "#e8f4ff"); g.addColorStop(0.55, "#a9cdee"); g.addColorStop(1, "#5d8fc4"); }
  else { g.addColorStop(0, "#ffffff"); g.addColorStop(0.6, "#e6f1fa"); g.addColorStop(1, "#bcd6ee"); }
  c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
  c.save(); c.beginPath(); c.arc(x, y, r, 0, TAU); c.clip();
  c.strokeStyle = night ? "rgba(255,255,255,.45)" : "rgba(61,139,217,.42)"; c.lineWidth = Math.max(0.8, r / 90);
  const rot = (t * 0.06) % 1;
  for (let k = 0; k < 8; k++) { const f = (k + rot) / 8; c.beginPath(); c.ellipse(x, y, Math.abs(Math.cos(f * Math.PI)) * r, r, 0, 0, TAU); c.stroke(); }
  for (let j = -4; j <= 4; j++) { const yy = y + (j * r) / 5, hw = Math.sqrt(Math.max(0, r * r - (yy - y) * (yy - y))); c.beginPath(); c.ellipse(x, yy, hw, hw * 0.1, 0, 0, TAU); c.stroke(); }
  // แผ่นดินข้อมูลจาง ๆ เลื่อนตามการหมุน
  const rnd = lcg(31);
  c.fillStyle = night ? "rgba(255,255,255,.18)" : "rgba(61,139,217,.13)";
  for (let i = 0; i < 26; i++) {
    const u = (rnd() + t * 0.012) % 1, v = rnd() * 1.6 - 0.8;
    const px = x + Math.sin(u * TAU) * r * Math.sqrt(1 - v * v), py = y + v * r;
    if (Math.cos(u * TAU) > 0) { c.beginPath(); c.arc(px, py, r * (0.03 + rnd() * 0.05), 0, TAU); c.fill(); }
  }
  c.restore();
  const sh = c.createRadialGradient(x + r * 0.45, y + r * 0.5, r * 0.2, x, y, r * 1.02);
  sh.addColorStop(0, "rgba(28,63,110,0)"); sh.addColorStop(1, night ? "rgba(10,20,50,.45)" : "rgba(28,63,110,.18)");
  c.fillStyle = sh; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
  c.strokeStyle = night ? "rgba(255,255,255,.7)" : "rgba(61,139,217,.65)"; c.lineWidth = Math.max(1, r / 60); c.beginPath(); c.arc(x, y, r, 0, TAU); c.stroke();
  if (o.rings !== false) {
    for (let i = 0; i < 2; i++) {
      const tilt = -0.32 + i * 0.5, rx = r * (1.45 + i * 0.28), ry = rx * 0.22;
      c.save(); c.translate(x, y); c.rotate(tilt);
      c.setLineDash(i ? [6, 8] : []); c.lineDashOffset = -t * 18;
      c.strokeStyle = i ? (night ? "rgba(201,154,214,.6)" : "rgba(155,79,150,.45)") : (night ? "rgba(190,227,248,.55)" : "rgba(61,139,217,.4)");
      c.lineWidth = 1.2; c.beginPath(); c.ellipse(0, 0, rx, ry, 0, 0, TAU); c.stroke(); c.setLineDash([]);
      const ang = t * (0.45 - i * 0.2) + i * 2;
      const sx = Math.cos(ang) * rx, sy = Math.sin(ang) * ry;
      hexP(c, sx, sy, Math.max(2.5, r * 0.045)); c.fillStyle = i ? C.echoGlow : "#fff"; c.fill(); c.strokeStyle = i ? C.echo : C.azure; c.lineWidth = 1; c.stroke();
      c.restore();
    }
  }
  c.restore();
}

/** คลื่นวงแหวน (ocd-shock) · p = 0..1 */
export function shock(c, x, y, p, col = AZ, maxR = 160, flat = 1, width = 2) {
  if (p <= 0 || p >= 1) return;
  const r = 6 + ease(p) * maxR;
  c.save(); c.globalAlpha *= 1 - p; c.strokeStyle = col.replace("A", 1); c.lineWidth = width;
  c.shadowColor = col.replace("A", 0.5); c.shadowBlur = 14;
  c.beginPath(); c.ellipse(x, y, r, r * flat, 0, 0, TAU); c.stroke(); c.restore();
}
/** เส้นแสงพุ่ง (ocd-streak) */
export function streaks(c, x, y, p, col = AZ, n = 10, len = 90) {
  if (p <= 0 || p >= 1) return;
  c.save(); c.strokeStyle = col.replace("A", (1 - p) * 0.9); c.lineWidth = 1.6; c.lineCap = "round";
  c.beginPath();
  for (let i = 0; i < n; i++) {
    const a = (i * TAU) / n + 0.3, d0 = 10 + ease(p) * len * 0.4, d1 = d0 + len * (0.2 + 0.8 * ease(p)) * 0.5;
    c.moveTo(x + Math.cos(a) * d0, y + Math.sin(a) * d0); c.lineTo(x + Math.cos(a) * d1, y + Math.sin(a) * d1);
  }
  c.stroke(); c.restore();
}

/** ร่างคน (เงาด้านข้าง) เท้าอยู่ที่ (x,y) สูงราว 120*s · o.walk = เฟสเดิน · o.moving */
export function figure(c, x, y, s, o = {}) {
  c.save(); c.translate(x, y); c.scale(s * (o.face || 1), s);
  const mv = o.moving ? 1 : 0, sw = Math.sin(o.walk || 0), bob = mv ? Math.abs(Math.cos(o.walk || 0)) * 2 : Math.sin((o.t || 0) * 2) * 0.6;
  c.translate(0, -bob);
  c.lineCap = "round";
  if (o.glow) { c.shadowColor = o.glow; c.shadowBlur = 14; }
  c.strokeStyle = o.fill; c.fillStyle = o.fill;
  c.lineWidth = 10;
  c.beginPath(); c.moveTo(-5, -46); c.lineTo(-5 + sw * 11 * mv, -4 + bob); c.moveTo(5, -46); c.lineTo(5 - sw * 11 * mv, -4 + bob); c.stroke();
  c.lineWidth = 7;
  c.beginPath(); c.moveTo(-13, -86); c.lineTo(-17 - sw * 7 * mv, -54); c.moveTo(13, -86); c.lineTo(17 + sw * 7 * mv, -54); c.stroke();
  const body = () => { c.beginPath(); c.moveTo(-15, -93); c.quadraticCurveTo(0, -99, 15, -93); c.lineTo(21, -40); c.quadraticCurveTo(0, -35, -21, -40); c.closePath(); };
  body(); c.fill();
  c.beginPath(); c.arc(0, -109, 12.5, 0, TAU); c.fill();
  c.shadowBlur = 0;
  if (o.coat) { c.fillStyle = o.coat; c.beginPath(); c.moveTo(-3, -92); c.lineTo(3, -92); c.lineTo(6, -42); c.lineTo(-6, -42); c.closePath(); c.fill(); }
  if (o.stroke) {
    c.strokeStyle = o.stroke; c.lineWidth = 1.6 / s;
    c.beginPath(); c.arc(0, -109, 12.5, 0, TAU); c.stroke(); body(); c.stroke();
  }
  if (o.visor) { c.fillStyle = o.visor; c.fillRect(2, -112, 9, 2.5); }
  c.restore();
}
/**
 * ตัวละครชุดนักเรียน (มุมข้าง) เท้าอยู่ที่ (x,y) สูงราว 135*s
 * o: { face, walk, moving, t, skin, hair, coat, trim, tie, pants, shoe, outline, rim }
 */
export function avatar(c, x, y, s, o = {}) {
  const mv = o.moving ? 1 : 0, ph = o.walk || 0, sw = Math.sin(ph);
  const bob = mv ? Math.abs(Math.cos(ph)) * 2.2 : Math.sin((o.t || 0) * 2.1) * 0.7;
  const col = {
    skin: "#f5dcc9", hair: "#24314d", coat: C.ink, trim: C.sky, tie: C.azure, pants: "#22355a", shoe: "#152238", shirt: "#ffffff",
    ...o
  };
  c.save(); c.translate(x, y); c.scale(s * (o.face || 1), s);
  if (o.glow) { c.shadowColor = o.glow; c.shadowBlur = 16; }
  c.lineCap = "round"; c.lineJoin = "round";
  // ขา: สะโพก -> เข่า -> เท้า (ขาหลังวาดก่อน สีเข้มกว่า)
  const leg = (dir, back) => {
    const a = sw * dir * mv;
    const hip = { x: back ? -2 : 3, y: -52 - bob };
    const knee = { x: hip.x + a * 10 + 2, y: -28 - bob * 0.5 };
    const foot = { x: hip.x + a * 15, y: -4 + Math.max(0, -a) * 3 * mv };
    c.strokeStyle = back ? shade(col.pants, -0.25) : col.pants; c.lineWidth = 9;
    c.beginPath(); c.moveTo(hip.x, hip.y); c.lineTo(knee.x, knee.y); c.lineTo(foot.x, foot.y); c.stroke();
    c.fillStyle = back ? shade(col.shoe, -0.2) : col.shoe; c.beginPath(); c.ellipse(foot.x + 4, foot.y + 1, 8, 4, 0, 0, TAU); c.fill();
  };
  leg(-1, true);
  // แขนหลัง
  const arm = (dir, back) => {
    const a = sw * dir * mv;
    const sh = { x: back ? -6 : 5, y: -96 - bob };
    const el = { x: sh.x - a * 9, y: -74 - bob };
    const hand = { x: sh.x - a * 14 + 2, y: -54 - bob };
    c.strokeStyle = back ? shade(col.coat, -0.25) : col.coat; c.lineWidth = 8;
    c.beginPath(); c.moveTo(sh.x, sh.y); c.lineTo(el.x, el.y); c.lineTo(hand.x, hand.y); c.stroke();
    c.fillStyle = back ? shade(col.skin, -0.12) : col.skin; c.beginPath(); c.arc(hand.x, hand.y + 2, 3.6, 0, TAU); c.fill();
  };
  arm(1, true);
  leg(1, false);
  c.translate(0, -bob);
  // เสื้อคลุมนักเรียน: ไหล่ -> เอว -> ชายเสื้อบานด้านหลัง (สะบัดตามจังหวะเดิน)
  const flap = mv ? Math.sin(ph * 2) * 2.5 : Math.sin((o.t || 0) * 1.3) * 0.8;
  c.fillStyle = col.coat;
  c.beginPath();
  c.moveTo(-12, -103); c.quadraticCurveTo(0, -108, 13, -103);
  c.lineTo(16, -72); c.lineTo(18, -46); c.lineTo(4, -42);
  c.lineTo(-10, -42); c.lineTo(-22 - flap, -36); c.lineTo(-18, -70); c.closePath(); c.fill();
  // เสื้อเชิ้ต + เนกไทด้านหน้า
  c.fillStyle = col.shirt; c.beginPath(); c.moveTo(6, -103); c.lineTo(13, -103); c.lineTo(13, -82); c.closePath(); c.fill();
  c.fillStyle = col.tie; c.beginPath(); c.moveTo(10, -100); c.lineTo(13, -98); c.lineTo(12.5, -80); c.lineTo(9.5, -83); c.closePath(); c.fill();
  // ขอบเสื้อ + กระดุม
  c.strokeStyle = col.trim; c.lineWidth = 1.4; c.beginPath(); c.moveTo(14, -100); c.lineTo(17, -46); c.moveTo(-20, -39); c.lineTo(18, -45); c.stroke();
  c.fillStyle = col.trim; c.beginPath(); c.arc(15.5, -70, 1.3, 0, TAU); c.arc(16.3, -58, 1.3, 0, TAU); c.fill();
  // คอ + หัว
  c.fillStyle = col.skin; c.fillRect(-3, -110, 7, 8);
  c.beginPath(); c.ellipse(1, -121, 12, 13, 0, 0, TAU); c.fill();
  // ผม: ทรงด้านหลัง + หน้าม้า + ปอยชี้
  c.fillStyle = col.hair;
  c.beginPath();
  c.moveTo(13, -122); c.quadraticCurveTo(14, -138, 0, -137); c.quadraticCurveTo(-15, -136, -14, -120);
  c.lineTo(-15, -108); c.lineTo(-9, -112); c.lineTo(-7, -106); c.lineTo(-3, -114);
  c.lineTo(4, -126); c.lineTo(8, -120); c.lineTo(10, -127); c.lineTo(13, -118); c.closePath(); c.fill();
  c.beginPath(); c.moveTo(-2, -136); c.quadraticCurveTo(2, -146, 9, -142); c.quadraticCurveTo(4, -140, 3, -135); c.closePath(); c.fill();
  // ตา
  c.fillStyle = o.eye || "#1b2a44"; c.beginPath(); c.ellipse(8.5, -120, 1.6, 2.6, 0, 0, TAU); c.fill();
  if (o.visor) { c.fillStyle = o.visor; c.globalAlpha *= 0.85; c.fillRect(4, -123, 10, 2.2); c.globalAlpha /= 0.85; }
  c.shadowBlur = 0;
  // ขอบแสงด้านหลัง
  if (o.rim) {
    c.strokeStyle = o.rim; c.lineWidth = 1.6 / s;
    c.beginPath(); c.moveTo(-14, -120); c.quadraticCurveTo(-15, -136, 0, -137); c.stroke();
    c.beginPath(); c.moveTo(-12, -103); c.lineTo(-18, -70); c.lineTo(-22 - flap, -36); c.stroke();
  }
  if (o.outline) {
    c.strokeStyle = o.outline; c.lineWidth = 1.2 / s;
    c.beginPath(); c.ellipse(1, -121, 12, 13, 0, 0, TAU); c.stroke();
  }
  c.restore();
}
function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v + (k < 0 ? v * k : (255 - v) * k))));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

/**
 * ผู้เล่นที่ตัวละครยังถูกซ่อน: โฮโลแกรมโทนเดียว + เส้นสแกน + กะพริบเบา ๆ
 * วาดลง canvas ย่อยก่อน (ตัดเส้นสแกนให้อยู่ในตัวคนพอดี) แล้วค่อยแปะ
 */
let HOLO = null;
export function hologram(c, x, y, s, o = {}) {
  const w = 120, h = 190, k = 2;
  if (!HOLO) { HOLO = document.createElement("canvas"); HOLO.width = w * k; HOLO.height = h * k; }
  const g = HOLO.getContext("2d");
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, HOLO.width, HOLO.height);
  g.setTransform(k, 0, 0, k, 0, 0);
  const base = o.tone || "#8ba3c2";
  avatar(g, w / 2, h - 10, 1, {
    ...o, glow: null, skin: shade(base, 0.35), hair: shade(base, -0.35), coat: base, trim: "#ffffff", tie: o.tint || base,
    pants: shade(base, -0.2), shoe: shade(base, -0.45), shirt: shade(base, 0.55), eye: shade(base, -0.5)
  });
  g.globalCompositeOperation = "source-atop";
  const off = ((o.t || 0) * 18) % 6;
  g.fillStyle = "rgba(255,255,255,.35)";
  for (let yy = -off; yy < h; yy += 6) g.fillRect(0, yy, w, 1.6);
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "rgba(255,255,255,.25)"); gr.addColorStop(1, "rgba(61,139,217,.25)");
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = "source-over";
  const flick = 0.72 + 0.12 * Math.sin((o.t || 0) * 7.3) + (Math.sin((o.t || 0) * 23) > 0.97 ? -0.25 : 0);
  c.save(); c.globalAlpha *= flick;
  c.drawImage(HOLO, x - (w / 2) * s, y - (h - 10) * s, w * s, h * s);
  c.restore();
}

export function floorShadow(c, x, y, rx, a = 0.18) {
  c.save(); c.fillStyle = `rgba(28,63,110,${a})`; c.beginPath(); c.ellipse(x, y, rx, rx * 0.22, 0, 0, TAU); c.fill(); c.restore();
}
/** ตราผนึกหกเหลี่ยม (ตัวละครถูกซ่อน) — แบบเดียวกับห้องรอ */
export function seal(c, x, y, r, col) {
  hexP(c, x, y, r); c.fillStyle = col; c.fill();
  c.strokeStyle = "rgba(255,255,255,.9)"; c.lineWidth = Math.max(1, r / 9); hexP(c, x, y, r * 0.68); c.stroke();
  c.beginPath(); c.moveTo(x - r * 0.3, y); c.lineTo(x + r * 0.3, y); c.moveTo(x, y - r * 0.3); c.lineTo(x, y + r * 0.3); c.stroke();
}
/** ตราหกเหลี่ยมมีรูปตัวละคร (ใช้รูปเดิมจาก R2) — img = HTMLImageElement ที่โหลดเสร็จแล้ว */
export function portraitHex(c, x, y, r, img, col = C.azure) {
  c.save();
  hexP(c, x, y, r + 3); c.fillStyle = col; c.fill();
  hexP(c, x, y, r); c.clip();
  c.fillStyle = C.paper; c.fillRect(x - r, y - r, r * 2, r * 2);
  if (img && img.complete && img.naturalWidth) {
    const ar = img.naturalWidth / img.naturalHeight, h = r * 2.3, w = h * ar;
    c.drawImage(img, x - w / 2, y - r * 1.05, w, h);
  } else {
    // รูปยังไม่มา/ไม่มีไฟล์ — ตราผนึกสีของผู้เล่นแทน (ไม่ปล่อยกรอบว่าง)
    hexP(c, x, y, r * 0.55); c.strokeStyle = col; c.lineWidth = 1.5; c.stroke();
    c.beginPath(); c.moveTo(x - r * 0.25, y); c.lineTo(x + r * 0.25, y); c.moveTo(x, y - r * 0.25); c.lineTo(x, y + r * 0.25); c.stroke();
  }
  c.restore();
  c.strokeStyle = "rgba(255,255,255,.95)"; c.lineWidth = 1.5; hexP(c, x, y, r); c.stroke();
}
export function nameTag(c, name, x, y, col, o = {}) {
  c.font = `600 13px ${FD}`;
  const w = c.measureText(name).width + (o.noSeal ? 18 : 34);
  cutPath(c, x - w / 2, y - 12, w, 24, 6);
  c.fillStyle = o.fill || "rgba(255,255,255,.93)"; c.fill();
  c.strokeStyle = o.line || "rgba(61,139,217,.3)"; c.lineWidth = o.lineW || 1; c.stroke();
  if (!o.noSeal) seal(c, x - w / 2 + 13, y, 7, col);
  T(c, name, x + (o.noSeal ? 0 : 8), y + 1, { size: 13, w: 600, align: "center", base: "middle", color: o.color || C.ink });
}

/** โหลดรูปไว้ใช้ใน canvas (แคชตาม URL) */
const IMG_CACHE = new Map();
export function loadImg(url) {
  if (!url) return null;
  let im = IMG_CACHE.get(url);
  if (!im) { im = new Image(); im.decoding = "async"; im.src = url; IMG_CACHE.set(url, im); }
  return im;
}

/** ตั้งขนาด canvas ตามกล่อง + devicePixelRatio (สูงสุด 2) คืนสเกลจากหน่วยฉาก 540 สูง */
export function fitCanvas(cv, baseH = 540) {
  const r = cv.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  const s = (r.height * dpr) / baseH;
  return { W: r.width * dpr / s, H: baseH, s, dpr };
}
