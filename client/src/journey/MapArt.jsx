// ============================================================
//  ลายเส้นนิ่งของแผนที่การเดินทาง (svg ก้อนใหญ่ก้อนเดียว วาดครั้งเดียว ไม่มีอะไรขยับข้างใน)
//  กระดาษหนังสีเข้ม + ลายเส้นทอง: เส้นกริด, เส้นชั้นความสูง, ลายภูมิประเทศของแต่ละภูมิภาค,
//  ขอบกรอบ, เข็มทิศ, รอยไหม้/รอยแยกสีแดงด้านบนสุด (จุดสิ้นสุดของโลก)
// ============================================================

import { memo } from "react";
import { seeded, crackPath } from "./geometry";
import { MW, MH, NODES, ROUTE_DENSE } from "./mapGeometry";

const GLYPHS = [
  // 1 อาณาจักร
  [
    "M0 0 V-9 M-6 -14 a6 6 0 1 0 12 0 a6 6 0 1 0 -12 0",
    "M-18 0 Q-9 -12 0 0 Q9 -12 18 0",
    "M-5 0 V-14 L0 -21 L5 -14 V0 M-8 0 H8 M-1.5 -9 H1.5",
  ],
  // 2 ทุ่งดอกไม้
  [
    "M0 10 V0 M-5 -4 a5 5 0 1 0 10 0 a5 5 0 1 0 -10 0 M0 5 Q-6 2 -8 -1",
    "M-8 0 L-6 -10 M-2 0 L0 -13 M4 0 L6 -9",
    "M-3 -8 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0 M-8 0 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0 M2 0 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0",
  ],
  // 3 ป่าต้องสาป
  [
    "M0 0 V-20 M0 -10 L-8 -17 L-11 -16 M0 -14 L7 -22",
    "M-8 0 L0 -22 L8 0 Z M0 0 V4",
    "M-5 0 V-10 A5 5 0 0 1 5 -10 V0 Z M-2 -9 H2 M0 -11 V-5",
  ],
  // 4 คลื่นวงวนน้ำ
  [
    "M-16 0 q4 -6 8 0 t8 0 t8 0",
    "M0 0 a3 3 0 1 1 3 3 a6 6 0 1 1 -6 -6 a9 9 0 1 1 9 9",
    "M-12 0 q6 -8 12 0 q6 -8 12 0 M-6 6 q6 -8 12 0",
  ],
  // 5 ทะเลทราย
  [
    "M-20 0 Q-6 -12 8 -4 T20 0",
    "M-12 0 L0 -16 L12 0 Z M0 -16 L4 0",
    "M0 0 V-18 M0 -10 H-5 V-14 M0 -7 H5 V-12",
  ],
  // 6 น้ำแข็ง
  [
    "M-16 0 L-4 -20 L4 -8 L8 -13 L18 0 M-8 -13 L-4 -20 L-1 -14",
    "M0 -9 V9 M-8 -4.5 L8 4.5 M-8 4.5 L8 -4.5",
    "M-4 0 L0 -20 L4 0 Z M-9 0 L-6 -12 L-3 0",
  ],
  // 7 จุดสิ้นสุดของโลก
  [
    "M0 0 C-8 0 -9 -8 -4 -13 C-3 -9 0 -9 0 -12 C3 -8 7 -6 5 -2 C4 0 2 0 0 0 Z",
    "M-14 0 L-6 -6 L0 -2 L8 -10 L14 -6",
    "M-10 0 L-7 -14 L-4 0 M-2 0 L1 -18 L4 0 M6 0 L8 -10 L10 0",
  ],
];

const ART = (() => {
  const rnd = seeded(9001);
  const items = [];
  NODES.forEach((n, idx) => {
    const area = idx + 1;
    const yMin = area === 7 ? 70 : n.y - 165;
    const yMax = area === 1 ? 2740 : n.y + 165;
    const labelRight = n.x < MW / 2;
    let placed = 0;
    for (let tries = 0; tries < 400 && placed < (area === 1 || area === 7 ? 22 : 16); tries++) {
      const x = 70 + rnd() * (MW - 140);
      const y = yMin + rnd() * (yMax - yMin);
      if (Math.hypot(x - n.x, y - n.y) < 130) continue;
      const dxl = x - n.x;
      if (Math.abs(y - n.y) < 80 && (labelRight ? dxl > 0 && dxl < 420 : dxl < 0 && dxl > -420)) continue;
      if (ROUTE_DENSE.some((p) => Math.abs(p.y - y) < 54 && Math.abs(p.x - x) < 70)) continue;
      if (items.some((it) => Math.hypot(it.x - x, it.y - y) < 62)) continue;
      items.push({ x: Math.round(x), y: Math.round(y), area, g: Math.floor(rnd() * 3), s: Math.round((0.9 + rnd() * 0.7) * 10) / 10 });
      placed++;
    }
  });

  const contour = (cx, cy, rx, ry, seed) => {
    const r = seeded(seed);
    const pts = [];
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2;
      const k = 1 + (r() - 0.5) * 0.18;
      pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
    }
    let d = "";
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const q = pts[(i + 1) % pts.length];
      const mx = (p[0] + q[0]) / 2;
      const my = (p[1] + q[1]) / 2;
      d += i === 0 ? `M ${mx.toFixed(1)} ${my.toFixed(1)}` : ` Q ${p[0].toFixed(1)} ${p[1].toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)}`;
    }
    const p0 = pts[0];
    const q0 = pts[1];
    return `${d} Q ${p0[0].toFixed(1)} ${p0[1].toFixed(1)} ${((p0[0] + q0[0]) / 2).toFixed(1)} ${((p0[1] + q0[1]) / 2).toFixed(1)} Z`;
  };
  const contours = NODES.map((n, i) => [1, 1.45, 1.95].map((m, j) => contour(n.x, n.y, 92 * m, 60 * m, 9100 + i * 7 + j)).join(" ")).join(" ");

  let grid = "";
  for (let x = 125; x < MW; x += 125) grid += `M ${x} 0 V ${MH} `;
  for (let y = 100; y < MH; y += 100) grid += `M 0 ${y} H ${MW} `;

  let orn = "";
  for (let y = 180; y < MH; y += 280) {
    for (const x of [26, MW - 26]) orn += `M ${x} ${y - 12} L ${x + 7} ${y} L ${x} ${y + 12} L ${x - 7} ${y} Z `;
  }

  const n7 = NODES[6];
  const cracks = [
    crackPath(9201, n7.x - 20, n7.y - 60, 170, 10, { seg: 8, jag: 26, branches: 3 }),
    crackPath(9202, n7.x + 30, n7.y - 60, 900, 40, { seg: 8, jag: 22, branches: 3 }),
    crackPath(9203, n7.x, n7.y - 80, 520, -10, { seg: 5, jag: 18, branches: 2 }),
    crackPath(9204, n7.x - 90, n7.y + 10, 60, 330, { seg: 6, jag: 16, branches: 1 }),
    crackPath(9205, n7.x + 90, n7.y + 20, 960, 300, { seg: 6, jag: 16, branches: 1 }),
  ].join(" ");

  let burn = "M 0 0 H 1000 V 40";
  const rb = seeded(9301);
  for (let x = 1000; x >= 0; x -= 40) burn += ` L ${x} ${Math.round(20 + rb() * 70)}`;
  burn += " Z";

  return { items, contours, grid, orn, cracks, burn };
})();

const COMPASS = (() => {
  let d = "";
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
    const L = i % 2 ? 34 : 62;
    const w = i % 2 ? 6 : 10;
    const tx = Math.cos(a) * L;
    const ty = Math.sin(a) * L;
    const px = Math.cos(a + Math.PI / 2) * w;
    const py = Math.sin(a + Math.PI / 2) * w;
    d += `M ${px.toFixed(1)} ${py.toFixed(1)} L ${tx.toFixed(1)} ${ty.toFixed(1)} L ${(-px).toFixed(1)} ${(-py).toFixed(1)} Z `;
  }
  return d;
})();

function MapArt() {
  const n1 = NODES[0];
  const n7 = NODES[6];
  return (
    <svg className="jm-art" viewBox={`0 0 ${MW} ${MH}`} preserveAspectRatio="none" aria-hidden="true">
      <path d={ART.grid} stroke="#c9992f" strokeWidth="1" opacity="0.07" fill="none" />
      <path d={ART.contours} stroke="#c9992f" strokeWidth="1.2" opacity="0.14" fill="none" />
      <path d={ART.burn} fill="#040101" />
      <path d={ART.cracks} stroke="rgba(200,30,20,0.28)" strokeWidth="10" fill="none" strokeLinejoin="round" />
      <path d={ART.cracks} stroke="#d8401f" strokeWidth="2.2" fill="none" strokeLinejoin="round" opacity="0.85" />
      {ART.items.map((it, i) => (
        <path
          key={i}
          d={GLYPHS[it.area - 1][it.g]}
          transform={`translate(${it.x} ${it.y}) scale(${it.s})`}
          stroke={it.area === 7 ? "#c2341f" : "#caa24a"}
          strokeWidth={1.7 / it.s}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={it.area === 7 ? 0.6 : 0.4}
        />
      ))}
      {/* หางเส้นทาง: ใต้โหนด 1 (ทางที่เดินมาแล้ว) และเหนือโหนด 7 (หายไปในความมืด) */}
      <path d={`M ${n1.x} ${n1.y} C ${n1.x + 30} ${n1.y + 130} ${n1.x - 90} ${n1.y + 250} ${n1.x - 60} ${MH}`} stroke="#0c0805" strokeWidth="14" fill="none" opacity="0.7" />
      <path d={`M ${n1.x} ${n1.y} C ${n1.x + 30} ${n1.y + 130} ${n1.x - 90} ${n1.y + 250} ${n1.x - 60} ${MH}`} stroke="#e8bf5a" strokeWidth="4" strokeDasharray="14 12" fill="none" opacity="0.7" />
      <path d={`M ${n7.x} ${n7.y} C ${n7.x + 30} ${n7.y - 140} ${n7.x - 80} ${n7.y - 260} ${n7.x - 40} 0`} stroke="#b3261e" strokeWidth="3" strokeDasharray="10 14" fill="none" opacity="0.55" />
      {/* กรอบข้าง */}
      <path d={`M 16 0 V ${MH} M 34 0 V ${MH} M ${MW - 16} 0 V ${MH} M ${MW - 34} 0 V ${MH}`} stroke="#c9992f" strokeWidth="1.6" opacity="0.5" />
      <path d={ART.orn} fill="#c9992f" opacity="0.6" />
      {/* เข็มทิศ */}
      <g transform={`translate(${MW - 150} ${MH - 330})`} opacity="0.55">
        <circle r="74" stroke="#c9992f" strokeWidth="1.5" fill="none" />
        <circle r="66" stroke="#c9992f" strokeWidth="0.8" fill="none" strokeDasharray="2 6" />
        <path d={COMPASS} fill="#c9992f" />
        <circle r="5" fill="#1d150d" stroke="#c9992f" strokeWidth="1.5" />
      </g>
    </svg>
  );
}

export default memo(MapArt);
