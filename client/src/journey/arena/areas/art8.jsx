// ภาพของตั้ง/เอฟเฟกต์เฉพาะสนาม 8 (Moon Cell) — { stand: { Kind: Comp }, fx: { Kind: Comp }, fore: { Kind: Comp } }
/* eslint-disable react-refresh/only-export-components -- ไฟล์นี้ export ตาราง kind -> คอมโพเนนต์ ไม่ใช่คอมโพเนนต์เดี่ยว */
import { useId } from "react";
import { Stand } from "../ArenaArt";
import { rand32, r1 } from "../arenaKit";
import "./area8.css";

const sid = (id) => id.replace(/[^a-zA-Z0-9]/g, "");
const A11Y = { "aria-hidden": "true", focusable: "false" };

/* เมืองข้อมูลที่เส้นขอบฟ้า: ตึกสี่เหลี่ยมหลายชั้นความลึก + หน้าต่างเรืองแสง + เสาสัญญาณ */
let CITY = null;
function cityGeo() {
  if (CITY) return CITY;
  const r = rand32(4242);
  const far = [], near = [], wins = [], masts = [];
  let x = -20;
  while (x < 3420) { const w = 60 + r() * 110, h = 90 + r() * 200; far.push([x, 420 - h, w, h]); x += w + 8; }
  x = -40;
  while (x < 3440) {
    const w = 80 + r() * 140, h = 40 + r() * 140; near.push([x, 420 - h, w, h]);
    for (let wy = 420 - h + 12; wy < 410; wy += 16) for (let wx = x + 10; wx < x + w - 12; wx += 18) if (r() > 0.55) wins.push([wx, wy]);
    if (r() > 0.8) masts.push([x + w / 2, 420 - h]);
    x += w + 10;
  }
  CITY = { far, near, wins, masts };
  return CITY;
}
function McCity({ s }) {
  const id = sid(useId());
  const g = cityGeo();
  return (
    <Stand vb="0 0 3400 420" par="none">
      <defs>
        <linearGradient id={`${id}f`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={s.c1} stopOpacity="0.55" /><stop offset="1" stopColor={s.c1} /></linearGradient>
        <linearGradient id={`${id}n`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={s.c2} /><stop offset="1" stopColor={s.c1} /></linearGradient>
      </defs>
      {g.far.map(([x, y, w, h], i) => <rect key={`f${i}`} x={x} y={y} width={w} height={h} fill={`url(#${id}f)`} />)}
      {g.near.map(([x, y, w, h], i) => <rect key={`n${i}`} x={x} y={y} width={w} height={h} fill={`url(#${id}n)`} stroke={s.col} strokeOpacity="0.35" strokeWidth="2" />)}
      <g fill="#ffffff" opacity="0.75">{g.wins.map(([x, y], i) => <rect key={i} x={x} y={y} width="8" height="6" />)}</g>
      {g.masts.map(([x, y], i) => (
        <g key={`m${i}`}>
          <line x1={x} y1={y} x2={x} y2={y - 60} stroke={s.col} strokeWidth="3" />
          <circle cx={x} cy={y - 62} r="6" fill={s.c3} style={{ animation: `arPulse ${r1(1.6 + (i % 3) * 0.5)}s ease-in-out infinite` }} />
        </g>
      ))}
      <rect x="0" y="414" width="3400" height="6" fill={s.col} opacity="0.5" />
    </Stand>
  );
}

/* เสาคริสตัลข้อมูล: ปริซึมหกเหลี่ยมยาว 2 หน้า + แกนเรืองแสง + วงแหวนลอย */
function McPylon({ s }) {
  const id = sid(useId());
  return (
    <Stand vb="0 0 60 200">
      <defs>
        <linearGradient id={`${id}a`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor={s.c3} /><stop offset="1" stopColor={s.c1} /></linearGradient>
        <linearGradient id={`${id}b`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor={s.c1} /><stop offset="1" stopColor={s.c2} /></linearGradient>
      </defs>
      <ellipse cx="30" cy="194" rx="22" ry="5" fill={s.c2} opacity="0.35" />
      <polygon points="30,8 14,34 14,168 30,186" fill={`url(#${id}a)`} />
      <polygon points="30,8 46,34 46,168 30,186" fill={`url(#${id}b)`} />
      <line x1="30" y1="14" x2="30" y2="180" stroke="#ffffff" strokeWidth="2" opacity="0.85" />
      <polygon points="30,8 14,34 30,42 46,34" fill="#ffffff" opacity="0.9" />
      <ellipse cx="30" cy="96" rx="26" ry="6" fill="none" stroke={s.col} strokeWidth="2.5" opacity="0.8" style={{ animation: "arPulse 2.6s ease-in-out infinite" }} />
    </Stand>
  );
}

/* จอโฮโลแกรมลอย: แผงกระจกน้ำเงิน + กราฟคลื่น + แถบข้อมูล */
function McPanel({ s }) {
  return (
    <Stand vb="0 0 220 150">
      <polygon points="12,0 220,0 220,138 208,150 0,150 0,12" fill={s.c1} stroke={s.col} strokeWidth="2" />
      <polyline points="16,104 40,86 62,98 86,66 110,80 134,52 158,70 182,44 204,60" fill="none" stroke={s.col} strokeWidth="3" />
      <g fill={s.c2}>{[0, 1, 2, 3, 4, 5].map((i) => <rect key={i} x={18 + i * 32} y={118 - (i % 3) * 6} width="22" height="5" />)}</g>
      <rect x="14" y="14" width="80" height="8" fill="#ffffff" opacity="0.8" />
      <rect x="14" y="28" width="50" height="5" fill="#ffffff" opacity="0.4" />
      <polyline points="0,24 0,0 24,0" fill="none" stroke="#ffffff" strokeWidth="3" />
    </Stand>
  );
}

/* โฮโลแกรมลูกโลกเหนือแท่นกลาง */
function McGlobe({ s }) {
  return (
    <svg viewBox="0 0 120 130" width="100%" height="100%" {...A11Y}>
      <ellipse cx="60" cy="124" rx="34" ry="5" fill={s.col} opacity="0.3" />
      <g className="ar8-spin" style={{ transformOrigin: "60px 56px" }}>
        <circle cx="60" cy="56" r="44" fill="rgba(190,227,248,0.25)" stroke={s.col} strokeWidth="2" />
        {[0.2, 0.55, 0.85].map((k, i) => <ellipse key={i} cx="60" cy="56" rx={44 * k} ry="44" fill="none" stroke={s.col} strokeWidth="1.2" opacity="0.7" />)}
        {[-22, 0, 22].map((dy, i) => <ellipse key={`l${i}`} cx="60" cy={56 + dy} rx={Math.sqrt(44 * 44 - dy * dy)} ry="4" fill="none" stroke={s.col} strokeWidth="1.2" opacity="0.7" />)}
      </g>
      <ellipse cx="60" cy="56" rx="62" ry="13" fill="none" stroke={s.c2} strokeWidth="2" strokeDasharray="8 6" transform="rotate(-14 60 56)" />
    </svg>
  );
}

/* ---------- เอฟเฟกต์ ---------- */
function McHex({ f }) {
  return (
    <svg viewBox="0 0 20 23" width="100%" height="100%" {...A11Y}>
      <polygon points="10,1 19,6 19,17 10,22 1,17 1,6" fill="none" stroke={f.col} strokeWidth="1.6" />
    </svg>
  );
}

/* ---------- หน้ากล้อง ---------- */
function McForePillar({ f }) {
  return (
    <svg viewBox="0 0 100 800" width="100%" height="100%" preserveAspectRatio="none" {...A11Y}>
      <rect x="10" y="0" width="80" height="800" fill={f.col} />
      <rect x="10" y="0" width="6" height="800" fill={f.col2} opacity="0.5" />
      <rect x="84" y="0" width="6" height="800" fill={f.col2} opacity="0.35" />
    </svg>
  );
}

export default {
  stand: { McCity, McPylon, McPanel, McGlobe },
  fx: { McHex },
  fore: { McForePillar },
};
