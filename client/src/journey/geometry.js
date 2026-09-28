// ============================================================
//  ตัวช่วยสร้างรูปทรงแบบ procedural สำหรับฉากหลัง Journey
//  ทุกอย่างคำนวณครั้งเดียว (module scope / useMemo) ด้วย random แบบกำหนด seed
//  พิกัดของฉาก = "stage" ขนาด 1600 × 900 (16:9) ที่ถูกขยายให้คลุมจอแบบ cover
// ============================================================

export const SW = 1600;
export const SH = 900;

export function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const f1 = (n) => (Math.round(n * 10) / 10).toString();

/** style ของกล่อง HTML ที่วางด้วยพิกัด stage (x,y,w,h) -> เปอร์เซ็นต์ */
export function box(x, y, w, h, extra) {
  return {
    left: `${(x / SW) * 100}%`,
    top: `${(y / SH) * 100}%`,
    width: `${(w / SW) * 100}%`,
    height: `${(h / SH) * 100}%`,
    ...extra,
  };
}

/** แนวสันเขา/เนิน: fn(x) -> y แล้วปิดลงไปที่ขอบล่าง */
export function ridge(fn, { step = 20, from = -40, to = SW + 40, bottom = SH + 20, smooth = true } = {}) {
  const pts = [];
  for (let x = from; x <= to; x += step) pts.push([x, fn(x)]);
  let d = `M ${from} ${bottom} L ${f1(pts[0][0])} ${f1(pts[0][1])}`;
  if (smooth) {
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i][0] + pts[i + 1][0]) / 2;
      const my = (pts[i][1] + pts[i + 1][1]) / 2;
      d += ` Q ${f1(pts[i][0])} ${f1(pts[i][1])} ${f1(mx)} ${f1(my)}`;
    }
    const last = pts[pts.length - 1];
    d += ` L ${f1(last[0])} ${f1(last[1])}`;
  } else {
    for (let i = 1; i < pts.length; i++) d += ` L ${f1(pts[i][0])} ${f1(pts[i][1])}`;
  }
  return `${d} L ${to} ${bottom} Z`;
}

/** ฟังก์ชันคลื่นไซน์ผสมหลายความถี่ พร้อมเฟสสุ่มตาม seed */
export function wave(seed, base, parts) {
  const rnd = seeded(seed);
  const ph = parts.map(() => rnd() * Math.PI * 2);
  return (x) => base + parts.reduce((acc, [amp, len], i) => acc + amp * Math.sin(x / len + ph[i]), 0);
}

/** ทิวเขาหยัก: คืน { d, caps } — caps = path หิมะบนยอด (ถ้าขอ) */
export function peaks(seed, { base, minH, maxH, minW, maxW, from = -60, to = SW + 60, bottom = SH + 20, cap = 0 }) {
  const rnd = seeded(seed);
  const pts = [[from, base]];
  let x = from;
  while (x < to) {
    const w = minW + rnd() * (maxW - minW);
    const h = minH + rnd() * (maxH - minH);
    const px = x + w * (0.35 + rnd() * 0.3);
    pts.push([px, base - h]);
    x += w;
    pts.push([x, base - h * (0.15 + rnd() * 0.3)]);
  }
  let d = `M ${from} ${bottom}`;
  for (const [px, py] of pts) d += ` L ${f1(px)} ${f1(py)}`;
  d += ` L ${f1(x)} ${bottom} Z`;
  let caps = "";
  if (cap > 0) {
    for (let i = 1; i < pts.length - 1; i += 2) {
      const [px, py] = pts[i];
      const [lx, ly] = pts[i - 1];
      const [rx, ry] = pts[i + 1];
      const t = cap;
      const ax = px + (lx - px) * t;
      const ay = py + (ly - py) * t;
      const bx = px + (rx - px) * t;
      const by = py + (ry - py) * t;
      const zig = 4;
      let seg = `M ${f1(px)} ${f1(py)} L ${f1(bx)} ${f1(by)}`;
      for (let k = 1; k <= zig; k++) {
        const u = k / (zig + 1);
        const zx = bx + (ax - bx) * u;
        const zy = by + (ay - by) * u + (k % 2 ? 1 : -0.4) * (8 + rnd() * 10);
        seg += ` L ${f1(zx)} ${f1(zy)}`;
      }
      caps += `${seg} L ${f1(ax)} ${f1(ay)} Z `;
    }
  }
  return { d, caps };
}

/** จุดดาวแบบสุ่ม */
export function starField(seed, n, { x0 = 0, x1 = SW, y0 = 0, y1 = SH * 0.55, r0 = 0.5, r1 = 1.8 } = {}) {
  const rnd = seeded(seed);
  return Array.from({ length: n }, () => ({
    x: f1(x0 + rnd() * (x1 - x0)),
    y: f1(y0 + rnd() * (y1 - y0)),
    r: f1(r0 + rnd() * rnd() * (r1 - r0)),
    o: (0.35 + rnd() * 0.65).toFixed(2),
  }));
}

/** เส้นสัน (ไม่ปิดรูป) ใช้วาดขอบแสงบนเนินทราย/หิมะ */
export function ridgeLine(fn, { step = 20, from = -40, to = SW + 40 } = {}) {
  let d = "";
  for (let x = from; x <= to; x += step) d += `${d ? " L" : "M"} ${f1(x)} ${f1(fn(x))}`;
  return d;
}

/** แถบเงาใต้สันเนิน (ด้านที่หันหนีแสงจากขวา) — ช่วงระหว่าง fn(x) กับ fn(x - dx) + dy */
export function shadeBand(fn, { dx = 90, dy = 6, step = 16, from = -40, to = SW + 40 } = {}) {
  const top = [];
  const bot = [];
  for (let x = from; x <= to; x += step) {
    const y = fn(x);
    top.push([x, y]);
    bot.push([x, Math.max(y, fn(x - dx) + dy)]);
  }
  const pts = [...top, ...bot.reverse()];
  return `M ${pts.map(([x, y]) => `${f1(x)} ${f1(y)}`).join(" L ")} Z`;
}

/** แถบรูปทรงเรียวตามเส้นโค้ง (ใช้กับกิ่งไม้ / ถนน) */
export function strip(points, w0, w1) {
  const L = [];
  const R = [];
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const a = points[Math.max(0, i - 1)];
    const b = points[Math.min(n - 1, i + 1)];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    const w = (w0 + (w1 - w0) * (i / (n - 1))) / 2;
    const px = (-dy / len) * w;
    const py = (dx / len) * w;
    L.push([points[i][0] + px, points[i][1] + py]);
    R.push([points[i][0] - px, points[i][1] - py]);
  }
  const all = [...L, ...R.reverse()];
  return `M ${all.map(([x, y]) => `${f1(x)} ${f1(y)}`).join(" L ")} Z`;
}

/** ต้นไม้บิดเบี้ยว (ป่าต้องสาป / ทุ่งดอกไม้) — คืน path d แบบเติมสี */
export function twistedTree(seed, x, y, h, { twist = 0.55, depth = 4, spread = 0.7, width = h * 0.075, lean = 0 } = {}) {
  const rnd = seeded(seed);
  let d = "";
  const tips = [];
  const branch = (bx, by, ang, len, w, lvl) => {
    const pts = [[bx, by]];
    let cx = bx;
    let cy = by;
    let a = ang;
    const steps = 4;
    for (let s = 0; s < steps; s++) {
      a += (rnd() - 0.5) * twist * (lvl === depth && s < 2 ? 0.15 : 1);
      cx += Math.cos(a) * (len / steps);
      cy += Math.sin(a) * (len / steps);
      pts.push([cx, cy]);
    }
    const wEnd = Math.max(0.8, w * 0.58);
    d += strip(pts, w, wEnd);
    if (lvl <= 0) {
      tips.push([cx, cy]);
      return;
    }
    const kids = 2 + (rnd() < 0.45 ? 1 : 0);
    for (let k = 0; k < kids; k++) {
      const side = k === 0 ? -1 : k === 1 ? 1 : rnd() - 0.5;
      const na = a + side * (0.3 + rnd() * spread);
      branch(cx, cy, na, len * (0.58 + rnd() * 0.2), wEnd * 0.95, lvl - 1);
    }
  };
  // รากแผ่ออก
  d += `M ${f1(x - width * 1.5)} ${f1(y + 2)} Q ${f1(x - width * 0.55)} ${f1(y - width * 0.25)} ${f1(x - width * 0.42)} ${f1(y - h * 0.07)} L ${f1(x + width * 0.42)} ${f1(y - h * 0.07)} Q ${f1(x + width * 0.55)} ${f1(y - width * 0.25)} ${f1(x + width * 1.6)} ${f1(y + 2)} Z `;
  branch(x, y, -Math.PI / 2 + lean, h * 0.42, width, depth);
  return { d, tips };
}

/** ทิวป่าหนาม (ต้นสน/ต้นไม้ตาย) แบบแถวเดียว */
export function spikyLine(seed, { base, minH, maxH, step = 18, from = -40, to = SW + 40, bottom = SH + 20 }) {
  const rnd = seeded(seed);
  let d = `M ${from} ${bottom} L ${from} ${base}`;
  for (let x = from; x < to; x += step * (0.6 + rnd() * 0.8)) {
    const h = minH + rnd() * (maxH - minH);
    const w = step * (0.5 + rnd() * 0.5);
    d += ` L ${f1(x + w * 0.1)} ${f1(base - h * 0.35)} L ${f1(x + w * 0.35 + (rnd() - 0.5) * 6)} ${f1(base - h)} L ${f1(x + w * 0.6)} ${f1(base - h * 0.3)} L ${f1(x + w)} ${f1(base - rnd() * 6)}`;
  }
  return `${d} L ${to} ${bottom} Z`;
}

/** จันทร์เสี้ยว: path จากวงกลมรัศมี r ถูกวงกลมอีกวงเลื่อนไป dx ตัดออก */
export function crescent(cx, cy, r, shift = 0.42, rot = -20) {
  const dd = r * shift * 2;
  const hh = Math.sqrt(Math.max(0, r * r - (dd * dd) / 4));
  const rad = (rot * Math.PI) / 180;
  const T = (x, y) => [cx + x * Math.cos(rad) - y * Math.sin(rad), cy + x * Math.sin(rad) + y * Math.cos(rad)];
  const [ax, ay] = T(dd / 2, -hh);
  const [bx, by] = T(dd / 2, hh);
  return `M ${f1(ax)} ${f1(ay)} A ${r} ${r} 0 1 0 ${f1(bx)} ${f1(by)} A ${r} ${r} 0 0 1 ${f1(ax)} ${f1(ay)} Z`;
}

/** กลุ่มเมฆจากวงกลมหลายวง (คืน array ของวงกลม) */
export function cloudPuffs(seed, w, h, n = 7) {
  const rnd = seeded(seed);
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const r = h * (0.28 + Math.sin(t * Math.PI) * 0.34 + rnd() * 0.12);
    out.push({ cx: f1(w * (0.08 + t * 0.84)), cy: f1(h - r * 0.7 - rnd() * h * 0.08), r: f1(r) });
  }
  return out;
}

/** เส้นหยักแตก (รอยแยกบนฟ้า/พื้น) */
export function crackPath(seed, x0, y0, x1, y1, { seg = 9, jag = 26, branches = 3 } = {}) {
  const rnd = seeded(seed);
  const pts = [];
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    const off = i === 0 || i === seg ? 0 : (rnd() - 0.5) * jag * 2;
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy) || 1;
    pts.push([x0 + dx * t + (-dy / len) * off, y0 + dy * t + (dx / len) * off]);
  }
  let d = `M ${pts.map(([x, y]) => `${f1(x)} ${f1(y)}`).join(" L ")}`;
  for (let b = 0; b < branches; b++) {
    const i = 1 + Math.floor(rnd() * (seg - 1));
    const [bx, by] = pts[i];
    const ang = Math.atan2(y1 - y0, x1 - x0) + (rnd() < 0.5 ? -1 : 1) * (0.6 + rnd() * 0.7);
    const L = (Math.hypot(x1 - x0, y1 - y0) / seg) * (1 + rnd() * 1.6);
    const mx = bx + Math.cos(ang) * L * 0.5 + (rnd() - 0.5) * jag;
    const my = by + Math.sin(ang) * L * 0.5 + (rnd() - 0.5) * jag;
    d += ` M ${f1(bx)} ${f1(by)} L ${f1(mx)} ${f1(my)} L ${f1(bx + Math.cos(ang) * L)} ${f1(by + Math.sin(ang) * L)}`;
  }
  return d;
}

/** แถบคลื่นวนซ้ำ (ความกว้าง 2 เท่าของ stage เพื่อเลื่อนวนแบบไร้รอยต่อ) */
export function waveStrip(period, h, amp, { width = SW * 2 } = {}) {
  let d = "";
  for (let x = 0; x < width; x += period) {
    d += `M ${x} ${h / 2} q ${period * 0.25} ${-amp} ${period * 0.5} 0 `;
  }
  return d;
}

/** เกลียวลอการิทึม (แขนของวังวนน้ำ) รอบจุด (0,0) */
export function spiralArm(r0, r1, turns, phase, steps = 48) {
  const k = Math.log(r1 / r0) / (turns * Math.PI * 2);
  let d = "";
  for (let i = 0; i <= steps; i++) {
    const th = (i / steps) * turns * Math.PI * 2;
    const r = r0 * Math.exp(k * th);
    const x = r * Math.cos(th + phase);
    const y = r * Math.sin(th + phase);
    d += `${i ? " L" : "M"} ${f1(x)} ${f1(y)}`;
  }
  return d;
}
