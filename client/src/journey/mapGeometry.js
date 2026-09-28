// ============================================================
//  เรขาคณิตของแผนที่การเดินทาง (แนวตั้ง อ่านจากล่างขึ้นบน)
//  พิกัดแผนที่ = 1000 × 2800 หน่วย แสดงบนแผ่นสูง 300vh -> 1 หน่วย = K vh
//  ทุกอย่างคำนวณครั้งเดียวตอนโหลดโมดูล
// ============================================================

export const MW = 1000;
export const MH = 2800;
export const MAP_VH = 300;
export const K = MAP_VH / MH; // vh ต่อ 1 หน่วยแผนที่
export const SHEET_W_VH = MW * K;

const NODE_XY = [
  [500, 2380],
  [292, 2056],
  [706, 1730],
  [300, 1402],
  [694, 1076],
  [330, 748],
  [540, 420],
];

export const NODES = NODE_XY.map(([x, y], i) => ({ id: i + 1, x, y }));

// จุดควบคุมเส้นทาง: โหนด + จุดกึ่งกลางที่เยื้องออกด้านข้างให้ทางคดเคี้ยว
const PTS = [];
NODE_XY.forEach((p, i) => {
  PTS.push(p);
  if (i < NODE_XY.length - 1) {
    const q = NODE_XY[i + 1];
    const dx = q[0] - p[0];
    const dy = q[1] - p[1];
    const len = Math.hypot(dx, dy);
    const off = (i % 2 ? 1 : -1) * 64;
    PTS.push([(p[0] + q[0]) / 2 + (-dy / len) * off, (p[1] + q[1]) / 2 + (dx / len) * off]);
  }
});

// Catmull-Rom -> cubic bezier
const BEZ = [];
for (let i = 0; i < PTS.length - 1; i++) {
  const p0 = PTS[i - 1] || PTS[i];
  const p1 = PTS[i];
  const p2 = PTS[i + 1];
  const p3 = PTS[i + 2] || p2;
  BEZ.push([p1, [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6], p2]);
}

const bez = ([a, b, c, d], t) => {
  const u = 1 - t;
  return [
    u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0],
    u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1],
  ];
};

const r1 = (n) => Math.round(n * 10) / 10;
const nodeBez = (n) => 2 * (n - 1); // โหนด n (1-based) = จุดเริ่มของ bezier ลำดับนี้

/** จุดถี่ ๆ ตามเส้นทางจากโหนด a ถึง b (a<b) พร้อมความยาวสะสม */
function dense(a, b) {
  const out = [];
  let acc = 0;
  let prev = null;
  for (let i = nodeBez(a); i < nodeBez(b); i++) {
    for (let s = i === nodeBez(a) ? 0 : 1; s <= 40; s++) {
      const p = bez(BEZ[i], s / 40);
      if (prev) acc += Math.hypot(p[0] - prev[0], p[1] - prev[1]);
      out.push({ x: p[0], y: p[1], l: acc });
      prev = p;
    }
  }
  return out;
}

/** path d ของเส้นทางจากโหนด a ถึง b */
export function routeD(a, b) {
  if (b <= a) return "";
  const s = BEZ[nodeBez(a)][0];
  let d = `M ${r1(s[0])} ${r1(s[1])}`;
  for (let i = nodeBez(a); i < nodeBez(b); i++) {
    const [, c1, c2, p] = BEZ[i];
    d += ` C ${r1(c1[0])} ${r1(c1[1])} ${r1(c2[0])} ${r1(c2[1])} ${r1(p[0])} ${r1(p[1])}`;
  }
  return d;
}

/** จุดที่ห่างเท่า ๆ กันตามความยาวเส้น (ใช้ทำคีย์เฟรมเดินหมุดและกล้อง) */
export function routeSamples(a, b, count = 48) {
  if (b <= a) return [{ x: NODES[a - 1].x, y: NODES[a - 1].y }];
  const pts = dense(a, b);
  const total = pts[pts.length - 1].l;
  const out = [];
  let j = 0;
  for (let k = 0; k < count; k++) {
    const target = (total * k) / (count - 1);
    while (j < pts.length - 2 && pts[j + 1].l < target) j++;
    const p = pts[j];
    const q = pts[j + 1];
    const t = q.l > p.l ? (target - p.l) / (q.l - p.l) : 0;
    out.push({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t });
  }
  return out;
}

/** กรอบของเส้นทาง a..b (หน่วยแผนที่) */
export function routeBox(a, b, pad = 24) {
  const pts = dense(a, b);
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of pts) {
    x0 = Math.min(x0, p.x);
    y0 = Math.min(y0, p.y);
    x1 = Math.max(x1, p.x);
    y1 = Math.max(y1, p.y);
  }
  return { x: Math.floor(x0 - pad), y: Math.floor(y0 - pad), w: Math.ceil(x1 - x0 + pad * 2), h: Math.ceil(y1 - y0 + pad * 2) };
}

/** จุดตัวอย่างของเส้นทางทั้งเส้น (ใช้กันไม่ให้ลายประดับทับทาง) */
export const ROUTE_DENSE = dense(1, NODES.length);

/** ตำแหน่งกล้อง (translateY เป็น vh) ให้จุด y อยู่ที่สัดส่วน frac ของจอ */
export function camFor(y, frac = 0.5) {
  const v = frac * 100 - y * K;
  return Math.min(0, Math.max(-(MAP_VH - 100), v));
}

export const vh = (u) => `${Math.round(u * K * 1000) / 1000}vh`;
