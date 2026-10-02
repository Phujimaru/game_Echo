// ภาพของตั้ง/เอฟเฟกต์เฉพาะภูมิภาค 7 (จุดสิ้นสุดของโลก) — { stand: { Kind: Comp }, fx: { Kind: Comp }, fore: { Kind: Comp } }
/* eslint-disable react-refresh/only-export-components -- ไฟล์นี้ export ตาราง kind -> คอมโพเนนต์ ไม่ใช่คอมโพเนนต์เดี่ยว */
import { useId } from "react";
import { Stand } from "../ArenaArt";
import { r1, rand32 } from "../arenaKit";
import "./area7.css";

const FULL = { width: "100%", height: "100%" };
const A11Y = { "aria-hidden": "true", focusable: "false" };
const sid = (id) => id.replace(/[^a-zA-Z0-9]/g, "");

/* สันหยักแหลม (ไม่โค้ง) */
function ridge(seed, base, hMin, hMax, wMin, wMax, bottom) {
  const r = rand32(seed);
  let x = -40;
  let d = `M -40 ${bottom} L -40 ${base}`;
  while (x < 3440) {
    const w = wMin + r() * (wMax - wMin);
    const h = hMin + r() * (hMax - hMin);
    d += ` L ${r1(x + w * 0.2)} ${r1(base - h * (0.5 + r() * 0.3))} L ${r1(x + w * (0.4 + r() * 0.2))} ${r1(base - h)} L ${r1(x + w * 0.75)} ${r1(base - h * (0.4 + r() * 0.4))}`;
    x += w;
    d += ` L ${r1(x)} ${r1(base - r() * 18)}`;
  }
  return `${d} L 3440 ${bottom} Z`;
}
/* เส้นแตกซิกแซก */
function zig(seed, x0, y0, x1, y1, n, jag) {
  const r = rand32(seed);
  let d = `M ${x0} ${y0}`;
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const j = i === n ? 0 : (r() - 0.5) * jag;
    d += ` L ${r1(x0 + (x1 - x0) * t + j)} ${r1(y0 + (y1 - y0) * t + (i === n ? 0 : (r() - 0.5) * jag * 0.4))}`;
  }
  return d;
}
let EDGE = null;
function edgeGeo() {
  if (EDGE) return EDGE;
  EDGE = {
    far: ridge(731, 380, 40, 150, 70, 170, 440),
    near: ridge(732, 428, 8, 40, 50, 130, 440),
    fissures: [zig(751, 0, 404, 900, 414, 14, 16), zig(752, 1060, 410, 2350, 402, 18, 18), zig(753, 2500, 412, 3400, 400, 14, 16)].join(" "),
  };
  return EDGE;
}

/* ขอบโลก (แถบไกลสุดปิดช่องใต้เส้นขอบฟ้า): ไฟจากใต้ขอบโลก + แผ่นดินดำแตกเป็นเหว + ลาวาไหลตกขอบ */
function I7Edge({ s }) {
  const id = sid(useId());
  const g = edgeGeo();
  return (
    <Stand vb="0 0 3400 440" par="none">
      <defs>
        <linearGradient id={`${id}b`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={s.col} stopOpacity="0" />
          <stop offset="0.5" stopColor={s.col} stopOpacity="0.8" />
          <stop offset="1" stopColor={s.c3} stopOpacity="1" />
        </linearGradient>
        <linearGradient id={`${id}c`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={s.c3} />
          <stop offset="1" stopColor={s.col} stopOpacity="0.3" />
        </linearGradient>
      </defs>
      <rect x="0" y="150" width="3400" height="290" fill={`url(#${id}b)`} />
      <path d={g.far} fill={s.c2} />
      <polygon points="930,440 948,330 972,360 990,250 1012,350 1040,320 1064,440" fill={`url(#${id}c)`} />
      <polygon points="2380,440 2398,340 2420,262 2446,362 2470,318 2500,440" fill={`url(#${id}c)`} />
      <path d={g.fissures} fill="none" stroke={s.col} strokeWidth="5" opacity="0.8" style={{ animation: "arPulse 3.4s ease-in-out infinite" }} />
      <path d={g.near} fill={s.c1} />
    </Stand>
  );
}

/* ---------- ฉากลอยบนฟ้า (เป็น fx เพื่อให้ทึบเต็มที่ ไม่จางตามระยะแบบของตั้ง) ---------- */
/* เกาะลอยแตก: ผิวบน + ใต้เกาะเป็นกรวยหินห้อย + รอยลาวา + ลาวาหยดลงเหว */
const ISLES = [
  { top: "M20 120 L60 96 L110 104 L150 88 L200 98 L250 92 L282 116 L270 132 L30 134 Z", under: "M30 134 L270 132 L250 170 L214 196 L190 250 L160 230 L140 290 L120 236 L96 252 L74 200 L46 176 Z", spires: "M70 98 L78 52 L90 100 Z M196 96 L206 40 L214 74 L222 96 Z", cr: "M60 140 L96 170 L118 160 L140 210 M200 140 L176 176 L190 214", drip: [140, 290] },
  { top: "M10 140 L50 118 L90 124 L120 100 L170 108 L220 96 L270 112 L292 138 L280 152 L20 154 Z", under: "M20 154 L280 152 L262 190 L230 214 L200 270 L176 240 L150 310 L132 250 L104 262 L80 214 L40 190 Z", spires: "M120 102 L132 60 L142 104 Z M240 100 L246 70 L256 106 Z", cr: "M50 160 L80 188 L110 184 L150 250 M230 162 L210 196 L226 230", drip: [150, 310] },
  { top: "M40 110 L80 86 L140 92 L180 72 L230 84 L262 108 L250 124 L52 126 Z", under: "M52 126 L250 124 L232 160 L200 184 L180 240 L156 210 L138 262 L118 214 L92 220 L70 170 Z", spires: "M150 76 L160 28 L172 80 Z", cr: "M90 132 L120 160 L140 156 L156 206 M210 134 L196 160", drip: [138, 262] },
];
/* fx ส่งสีได้แค่ col/col2 -> rot = แบบ (หลักหน่วย) + 10 ถ้ากลางคืน */
const ROCK = [["#2a1410", "#4a281e"], ["#1a0b09", "#2e1712"]];
function I7IsleFx({ f }) {
  const v = ISLES[(f.rot % 10) % ISLES.length];
  const [c1, c2] = ROCK[f.rot >= 10 ? 1 : 0];
  return (
    <svg viewBox="0 20 300 370" width="100%" height="100%" {...A11Y}>
      <rect x={v.drip[0] - 2} y={v.drip[1]} width="5" height="80" fill={f.col} opacity="0.7" />
      <path d={v.under} fill={c1} />
      <path d={v.cr} fill="none" stroke={f.col2} strokeWidth="4" opacity="0.95" style={{ animation: "arPulse 3s ease-in-out infinite" }} />
      <path d={v.top} fill={c2} />
      <path d={v.spires} fill={c1} />
      <path d={v.top} fill="none" stroke={f.col} strokeWidth="3" opacity="0.75" />
    </svg>
  );
}

function I7ChunkFx({ f }) {
  const [c1, c2] = ROCK[f.rot >= 10 ? 1 : 0];
  return (
    <svg viewBox="0 20 110 100" width="100%" height="100%" {...A11Y} style={f.rot % 2 ? { transform: "scaleX(-1)" } : undefined}>
      <path d="M10 40 L34 24 L70 30 L100 44 L92 58 L74 86 L60 112 L48 88 L30 74 Z" fill={c1} />
      <path d="M10 40 L34 24 L70 30 L100 44 L92 52 L20 52 Z" fill={c2} />
      <path d="M10 40 L34 24 L70 30 L100 44" fill="none" stroke={f.col} strokeWidth="2.5" opacity="0.75" />
      <path d="M36 54 L50 70 L58 66 L62 92" fill="none" stroke={f.col2} strokeWidth="3" opacity="0.95" />
    </svg>
  );
}

/* รอยแยกบนฟ้า (ขอบโลกแตกร้าว): แผลฉีกกว้างที่ฐาน เรียวขึ้นไป แสงลาวาทะลักจากข้างใน */
function rift(seed) {
  const r = rand32(seed);
  const pts = [];
  const n = 9;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push([100 + (i && i < n ? (r() - 0.5) * 60 : 0) + t * 20, 400 - t * 400, 15 * (1 - t) + 1.5]);
  }
  const L = pts.map(([x, y, w]) => `${r1(x - w)},${r1(y)}`);
  const R = pts.map(([x, y, w]) => `${r1(x + w)},${r1(y)}`).reverse();
  let br = "";
  [3, 5, 7].forEach((i) => {
    const [x, y] = pts[i];
    const dx = (r() > 0.5 ? 1 : -1) * (24 + r() * 30);
    br += `M ${r1(x)} ${r1(y)} L ${r1(x + dx * 0.6)} ${r1(y - 14 - r() * 10)} L ${r1(x + dx)} ${r1(y - 6 - r() * 26)} `;
  });
  return { poly: [...L, ...R].join(" "), br };
}
const RIFTS = [rift(761), rift(762)];
function I7Rift({ f }) {
  const g = RIFTS[f.rot % 2];
  return (
    <svg viewBox="0 0 200 400" width="100%" height="100%" preserveAspectRatio="none" {...A11Y}>
      <polygon points={g.poly} fill={f.col} opacity="0.35" stroke={f.col} strokeWidth="16" strokeLinejoin="round" />
      <path d={g.br} fill="none" stroke={f.col} strokeWidth="3" opacity="0.8" strokeLinejoin="round" />
      <polygon points={g.poly} fill={f.col2} stroke="#fff2d0" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

/* หนามหินบะซอลต์: เงาดำ + ขอบด้านหนึ่งต้องแสงลาวา */
const SPIKES = [
  { d: "M8 160 L20 70 L30 96 L44 0 L58 90 L66 60 L82 160 Z", rim: "M44 0 L58 90 L66 60 L82 160 L74 160 L62 84 L54 104 Z" },
  { d: "M4 160 L18 90 L28 110 L40 20 L52 64 L60 30 L74 120 L86 160 Z", rim: "M60 30 L74 120 L86 160 L78 160 L68 120 L58 60 Z" },
  { d: "M14 160 L24 40 L36 80 L50 10 L62 100 L76 160 Z", rim: "M50 10 L62 100 L76 160 L68 160 L56 104 Z" },
];
function I7Spike({ s }) {
  const v = SPIKES[s.rot || 0];
  return (
    <Stand vb="0 0 90 160">
      <path d={v.d} fill={s.c1} />
      <path d={v.rim} fill={s.c2} opacity="0.45" />
      <path d="M44 150 L42 120 L48 96 L44 70" fill="none" stroke={s.col} strokeWidth="2.4" opacity="0.8" style={{ animation: "arPulse 2.8s ease-in-out infinite" }} />
    </Stand>
  );
}

function I7Ruin({ s }) {
  const flip = s.rot ? "translate(70 0) scale(-1 1)" : undefined;
  return (
    <Stand vb="0 0 70 170">
      <g transform={flip}>
        <rect x="6" y="152" width="58" height="18" fill={s.c2} />
        <path d="M14 152 V40 L22 30 L30 44 L38 20 L46 36 L56 28 V152 Z" fill={s.c1} />
        <path d="M36 152 V34 L46 36 L56 28 V152 Z" fill="rgba(0,0,0,0.35)" />
        <path d="M14 152 V40 L22 30" fill="none" stroke={s.c3} strokeWidth="3" opacity="0.6" />
        <path d="M22 60 V140 M30 52 V146 M44 50 V144" stroke="rgba(0,0,0,0.3)" strokeWidth="2" />
        <path d="M24 46 L32 74 L26 96 L34 126" fill="none" stroke={s.col} strokeWidth="2.4" opacity="0.9" style={{ animation: "arPulse 3.2s ease-in-out infinite" }} />
      </g>
    </Stand>
  );
}

function I7Flame({ s }) {
  return (
    <Stand vb="0 0 70 120">
      <path d="M35 120 C8 116 2 90 14 70 C20 60 18 46 24 34 C28 54 34 56 36 44 C38 28 32 16 40 0 C46 22 60 34 58 58 C62 54 64 46 64 40 C72 62 70 116 35 120 Z" fill={s.c1} opacity="0.92" />
      <path d="M35 120 C18 116 14 98 22 84 C26 92 30 92 30 82 C30 70 36 62 40 50 C44 66 54 74 52 92 C56 90 58 86 58 82 C62 102 52 118 35 120 Z" fill={s.c2} />
      <path d="M35 120 C28 118 26 108 30 100 C32 104 34 104 35 98 C38 104 44 110 41 118 Z" fill="#fff6e0" />
    </Stand>
  );
}

/* ---------- เอฟเฟกต์ ---------- */
function I7Orb({ f }) {
  if (!f.rot) {
    // กลางวัน: สุริยุปราคาดำ ขอบไฟลุก
    return (
      <div style={{ ...FULL, borderRadius: "50%", background: `radial-gradient(circle, ${f.col2} 0 30%, #ffe2a0 31%, ${f.col} 36%, rgba(255,90,20,0.35) 52%, rgba(255,60,20,0) 70%)` }} />
    );
  }
  // กลางคืน: จันทร์แดงแตก
  return (
    <svg viewBox="-60 -60 120 120" width="100%" height="100%" {...A11Y}>
      <circle r="58" fill="rgba(200,20,15,0.18)" />
      <circle r="40" fill={f.col} />
      <circle r="40" fill={f.col2} opacity="0.45" style={{ transform: "translate(8px, 8px)" }} />
      <circle cx="-12" cy="-10" r="8" fill={f.col2} opacity="0.5" />
      <circle cx="14" cy="16" r="6" fill={f.col2} opacity="0.5" />
      <path d="M-4 -2 L-16 -22 L-12 -34 M-4 -2 L18 -8 L30 -2 M-4 -2 L-2 18 L-10 34" fill="none" stroke="#1a0000" strokeWidth="3.5" />
      <path d="M-4 -2 L-16 -22 L-12 -34 M-4 -2 L18 -8 L30 -2 M-4 -2 L-2 18 L-10 34" fill="none" stroke="#ff5a2a" strokeWidth="1.2" />
    </svg>
  );
}

function I7Bolt({ f }) {
  const d = "M50 0 L40 70 L58 74 L34 160 L52 164 L26 300 M40 70 L18 110 M52 164 L80 210";
  return (
    <svg viewBox="0 0 100 300" width="100%" height="100%" preserveAspectRatio="none" {...A11Y} style={f.rot ? { transform: "scaleX(-1)" } : undefined}>
      <path d={d} fill="none" stroke={f.col2} strokeWidth="14" opacity="0.35" strokeLinejoin="round" />
      <path d={d} fill="none" stroke={f.col} strokeWidth="4" strokeLinejoin="round" />
    </svg>
  );
}

function I7Flash({ f }) {
  return <div style={{ ...FULL, background: `radial-gradient(ellipse at 50% 10%, ${f.col} 0%, rgba(0,0,0,0) 80%)` }} />;
}

function I7Ember({ f }) {
  return <div style={{ ...FULL, borderRadius: "50%", background: `radial-gradient(circle, #fff3d0 0%, ${f.col} 32%, rgba(255,80,20,0) 72%)` }} />;
}

function I7Ash({ f }) {
  return <div style={{ ...FULL, borderRadius: "40% 60% 30% 70%", background: f.col, transform: `rotate(${f.rot}deg)` }} />;
}

/* ---------- ของบังหน้ากล้อง ---------- */
function I7Crag({ f }) {
  return (
    <div style={{ ...FULL, transform: f.rot ? "scaleX(-1)" : undefined }}>
      <svg viewBox="0 0 520 300" width="100%" height="100%" preserveAspectRatio="none" {...A11Y}>
        <path d="M0 300 V120 L40 80 L70 110 L110 40 L150 100 L200 70 L240 130 L300 120 L360 180 L420 170 L520 240 V300 Z" fill={f.col} />
        <path d="M0 120 L40 80 L70 110 L110 40 L150 100 L200 70 L240 130 L300 120 L360 180 L420 170 L520 240" fill="none" stroke={f.col2} strokeWidth="5" opacity="0.6" />
        <path d="M90 300 L110 220 L96 180 L120 140 M240 300 L250 240 L236 210" fill="none" stroke={f.col2} strokeWidth="5" opacity="0.8" />
      </svg>
    </div>
  );
}

function I7Smoke({ f }) {
  return (
    <div
      style={{
        ...FULL,
        background: `radial-gradient(closest-side at 30% 50%, ${f.col} 0%, rgba(0,0,0,0) 100%), radial-gradient(closest-side at 70% 45%, ${f.col} 0%, rgba(0,0,0,0) 100%)`,
      }}
    />
  );
}

export default {
  stand: { I7Edge, I7Spike, I7Ruin, I7Flame },
  fx: { I7Orb, I7Bolt, I7Flash, I7Ember, I7Ash, I7IsleFx, I7ChunkFx, I7Rift },
  fore: { I7Crag, I7Smoke },
};
