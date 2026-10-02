// ภาพของตั้ง/เอฟเฟกต์เฉพาะภูมิภาค 6 (อาณาจักรน้ำแข็ง) — { stand: { Kind: Comp }, fx: { Kind: Comp }, fore: { Kind: Comp } }
/* eslint-disable react-refresh/only-export-components -- ไฟล์นี้ export ตาราง kind -> คอมโพเนนต์ ไม่ใช่คอมโพเนนต์เดี่ยว */
import { useId } from "react";
import { Stand } from "../ArenaArt";
import { r1, rand32 } from "../arenaKit";
import "./area6.css";

const FULL = { width: "100%", height: "100%" };
const A11Y = { "aria-hidden": "true", focusable: "false" };
const sid = (id) => id.replace(/[^a-zA-Z0-9]/g, "");

/* เทือกเขา: ยอดหยัก + หมวกหิมะ (คำนวณครั้งเดียว) */
function range(seed, base, hMin, hMax, wMin, wMax) {
  const r = rand32(seed);
  let x = -40;
  let vy = base;
  let d = `M -40 560 L -40 ${base}`;
  let caps = "";
  while (x < 3440) {
    const w = wMin + r() * (wMax - wMin);
    const h = hMin + r() * (hMax - hMin);
    const px = x + w * (0.35 + r() * 0.3);
    const py = base - h;
    const ex = x + w;
    const ey = base - r() * h * 0.3;
    d += ` L ${r1(px)} ${r1(py)} L ${r1(ex)} ${r1(ey)}`;
    const f = 0.28 + r() * 0.14;
    const lx = px + (x - px) * f;
    const ly = py + (vy - py) * f;
    const rx = px + (ex - px) * f;
    const ry = py + (ey - py) * f;
    caps += `M ${r1(px)} ${r1(py)} L ${r1(lx)} ${r1(ly)}`;
    for (let j = 1; j <= 3; j++) caps += ` L ${r1(lx + ((rx - lx) * j) / 4)} ${r1(ly + ((ry - ly) * j) / 4 + (j % 2 ? -h * 0.07 : h * 0.05))}`;
    caps += ` L ${r1(rx)} ${r1(ry)} Z `;
    x = ex;
    vy = ey;
  }
  return { d: `${d} L 3440 560 Z`, caps };
}
let RANGE = null;
const ranges = () => (RANGE = RANGE || [range(611, 470, 170, 380, 260, 460), range(612, 530, 70, 190, 160, 300)]);

/* ผลึกน้ำแข็งหนึ่งแท่ง: ด้านสว่าง/ด้านเงา (x = กลางฐาน, y = ฐาน) */
function Shard({ x, y, w, h, lean = 0, c1, c2, c3 }) {
  const tx = x + lean;
  const ty = y - h;
  const sy = y - h * 0.68;
  const pts = `${r1(tx)},${r1(ty)} ${r1(x + w / 2)},${r1(sy)} ${r1(x + w * 0.38)},${y} ${r1(x - w * 0.38)},${y} ${r1(x - w / 2)},${r1(sy)}`;
  return (
    <>
      <polygon points={pts} fill={c2} />
      <polygon points={`${r1(tx)},${r1(ty)} ${r1(x - w / 2)},${r1(sy)} ${r1(x - w * 0.38)},${y} ${r1(x - w * 0.05)},${y}`} fill={c1} />
      <polygon points={`${r1(tx)},${r1(ty)} ${r1(x + w / 2)},${r1(sy)} ${r1(x + w * 0.38)},${y} ${r1(x + w * 0.2)},${y}`} fill={c3} opacity={0.8} />
    </>
  );
}

function I6Range({ s }) {
  const [a, b] = ranges();
  return (
    <Stand vb="0 0 3400 560" par="none">
      <path d={a.d} fill={s.c1} />
      <path d={a.caps} fill={s.c3} opacity={0.92} />
      <path d={b.d} fill={s.c2} />
      <path d={b.caps} fill={s.c3} opacity={0.85} />
      <path d="M0 560 L0 520 C500 500 900 528 1400 512 C1900 498 2400 526 2900 508 C3100 502 3300 512 3400 506 L3400 560 Z" fill={s.c3} opacity={0.9} />
    </Stand>
  );
}

function I6Castle({ s }) {
  const id = sid(useId());
  const n = s.night;
  const C = n
    ? { w0: "#4d7da6", w1: "#26486b", sp: "#6cc3ee", sp2: "#2f6f9f", win: "#a6f7ff", gate: "#071a2e", shade: "rgba(0,10,30,0.28)" }
    : { w0: "#eef8ff", w1: "#a9d2ee", sp: "#7fc3ec", sp2: "#4a94c9", win: "#3f8fcf", gate: "#2e6c9e", shade: "rgba(30,80,130,0.14)" };
  const spire = (x, top, base, w) => (
    <>
      <polygon points={`${x - w / 2},${base} ${x},${top} ${x + w / 2},${base}`} fill={C.sp} />
      <polygon points={`${x},${top} ${x + w / 2},${base} ${x},${base}`} fill={C.sp2} />
    </>
  );
  const tower = (x, y, w) => (
    <>
      <rect x={x - w / 2} y={y} width={w} height={800 - y} fill={`url(#${id}w)`} />
      <rect x={x} y={y} width={w / 2} height={800 - y} fill={C.shade} />
    </>
  );
  const slot = (x, y, h = 34) => <path d={`M${x - 7} ${y + h} V${y + 7} A7 7 0 0 1 ${x + 7} ${y + 7} V${y + h} Z`} fill={C.win} />;
  return (
    <Stand vb="0 0 1100 800">
      <defs>
        <linearGradient id={`${id}w`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={C.w0} />
          <stop offset="1" stopColor={C.w1} />
        </linearGradient>
        <radialGradient id={`${id}g`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={s.col} stopOpacity={n ? 0.45 : 0.18} />
          <stop offset="1" stopColor={s.col} stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="550" cy="430" rx="540" ry="400" fill={`url(#${id}g)`} />
      {tower(285, 360, 70)}
      {spire(285, 170, 362, 98)}
      {tower(815, 360, 70)}
      {spire(815, 170, 362, 98)}
      <rect x="150" y="560" width="800" height="240" fill={`url(#${id}w)`} />
      <rect x="550" y="560" width="400" height="240" fill={C.shade} />
      <path d="M150 560 V538 H190 V560 H230 V538 H270 V560 H310 V538 H350 V560 H750 V538 H790 V560 H830 V538 H870 V560 H910 V538 H950 V560 Z" fill={C.w0} />
      <path d="M160 560 l8 22 l8 -22 M300 560 l6 16 l6 -16 M760 560 l8 24 l8 -24 M880 560 l6 18 l6 -18" fill={C.sp} />
      {tower(160, 430, 120)}
      {spire(160, 220, 432, 156)}
      {tower(940, 430, 120)}
      {spire(940, 220, 432, 156)}
      {tower(375, 380, 90)}
      {spire(375, 196, 382, 120)}
      {tower(725, 380, 90)}
      {spire(725, 196, 382, 120)}
      {tower(550, 300, 220)}
      {spire(480, 214, 302, 54)}
      {spire(620, 214, 302, 54)}
      {spire(550, 14, 302, 260)}
      <path d="M496 800 V700 C496 640 604 640 604 700 V800 Z" fill={C.gate} />
      <path d="M510 800 V704 C510 660 590 660 590 704" fill="none" stroke={C.sp} strokeWidth="6" />
      {slot(520, 380)}
      {slot(580, 380)}
      {slot(550, 330, 30)}
      {slot(160, 480)}
      {slot(940, 480)}
      {slot(375, 430, 30)}
      {slot(725, 430, 30)}
      {slot(285, 410, 26)}
      {slot(815, 410, 26)}
      {slot(260, 610, 30)}
      {slot(840, 610, 30)}
      <circle cx="550" cy="120" r="9" fill={C.win} opacity={n ? 1 : 0.7} style={{ animation: "arPulse 3s ease-in-out infinite" }} />
    </Stand>
  );
}

function I6Throne({ s }) {
  const p = { c1: s.c1, c2: s.c2, c3: s.c3 };
  return (
    <Stand vb="0 0 190 150">
      <Shard x={28} y={150} w={24} h={64} lean={-8} {...p} />
      <Shard x={162} y={150} w={24} h={64} lean={8} {...p} />
      <Shard x={54} y={150} w={30} h={104} lean={-10} {...p} />
      <Shard x={136} y={150} w={30} h={104} lean={10} {...p} />
      <Shard x={95} y={150} w={40} h={148} {...p} />
      <path d="M95 6 L95 140" stroke={s.col} strokeWidth="2.5" opacity="0.85" style={{ animation: "arPulse 3s ease-in-out infinite" }} />
    </Stand>
  );
}

function I6Spike({ s }) {
  const p = { c1: s.c1, c2: s.c2, c3: s.c3 };
  return (
    <Stand vb="0 0 110 150">
      <Shard x={26} y={150} w={26} h={96} lean={-12} {...p} />
      <Shard x={86} y={150} w={26} h={108} lean={10} {...p} />
      <Shard x={55} y={150} w={34} h={150} lean={2} {...p} />
      <Shard x={40} y={150} w={18} h={52} lean={-4} {...p} />
      <Shard x={72} y={150} w={16} h={44} lean={5} {...p} />
    </Stand>
  );
}

function I6Shard({ s }) {
  const p = { c1: s.c1, c2: s.c2, c3: s.c3 };
  return (
    <Stand vb="0 0 40 46">
      <Shard x={11} y={46} w={11} h={28} lean={-4} {...p} />
      <Shard x={29} y={46} w={11} h={32} lean={4} {...p} />
      <Shard x={20} y={46} w={14} h={46} {...p} />
    </Stand>
  );
}

function I6Statue({ s }) {
  const flip = s.rot ? "translate(80 0) scale(-1 1)" : undefined;
  return (
    <Stand vb="0 0 80 150">
      <rect x="4" y="136" width="72" height="14" fill={s.c2} opacity="0.85" />
      <g transform={flip}>
        {/* อัศวินยกดาบ ถูกแช่แข็ง */}
        <rect x="52" y="6" width="5" height="66" fill={s.c2} />
        <rect x="46" y="66" width="17" height="5" fill={s.c2} />
        <circle cx="34" cy="40" r="10" fill={s.c2} />
        <path d="M22 54 H46 L52 70 L56 74 L50 80 L46 76 V104 L50 136 H40 L36 108 L32 136 H22 L24 104 V76 L14 92 L10 88 Z" fill={s.c2} />
        <path d="M26 36 H42" stroke={s.col} strokeWidth="2" opacity="0.8" />
      </g>
      <path d="M6 136 V30 L16 18 H64 L74 28 V136 Z" fill={s.c1} stroke="rgba(255,255,255,0.75)" strokeWidth="2" />
      <path d="M16 28 L24 22 V128 L16 132 Z" fill="rgba(255,255,255,0.4)" />
      <path d="M4 32 C10 18 22 12 40 14 C58 12 70 18 76 30 C66 24 58 28 50 24 C40 30 30 22 22 28 C14 24 10 30 4 32 Z" fill="#ffffff" opacity="0.9" />
    </Stand>
  );
}

function I6Pine({ s }) {
  const tier = (y, w, h) => (
    <>
      <polygon points={`50,${y - h} ${50 + w},${y} ${50 - w},${y}`} fill={s.c1} />
      <polygon points={`50,${y - h} ${50 + w},${y} 50,${y}`} fill={s.c2} />
      <path d={`M50 ${y - h} L${50 + w * 0.55} ${y - h * 0.45} L${50 + w * 0.3} ${y - h * 0.5} L${50 + w * 0.12} ${y - h * 0.36} L50 ${y - h * 0.5} L${50 - w * 0.2} ${y - h * 0.38} L${50 - w * 0.38} ${y - h * 0.5} L${50 - w * 0.55} ${y - h * 0.45} Z`} fill={s.c3} opacity="0.95" />
      <path d={`M${50 - w} ${y} Q${50 - w * 0.5} ${y - 7} 50 ${y - 2} Q${50 + w * 0.5} ${y - 6} ${50 + w} ${y} Z`} fill={s.c3} opacity="0.8" />
    </>
  );
  return (
    <Stand vb="0 0 100 170">
      <rect x="45" y="140" width="10" height="30" fill="#4f3d30" />
      {tier(146, 48, 54)}
      {tier(112, 40, 50)}
      {tier(78, 31, 44)}
      {tier(46, 21, 40)}
    </Stand>
  );
}

/* ---------- เอฟเฟกต์ ---------- */
function I6Aurora({ f }) {
  const id = sid(useId());
  return (
    <svg viewBox="0 0 1000 300" width="100%" height="100%" preserveAspectRatio="none" {...A11Y}>
      <defs>
        <linearGradient id={`${id}f`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.25" stopColor="#fff" stopOpacity="1" />
          <stop offset="0.75" stopColor="#fff" stopOpacity="1" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id={`${id}m`} maskContentUnits="objectBoundingBox">
          <rect width="1" height="1" fill={`url(#${id}f)`} />
        </mask>
        <linearGradient id={`${id}a`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={f.col} stopOpacity="0" />
          <stop offset="0.4" stopColor={f.col} stopOpacity="0.6" />
          <stop offset="0.75" stopColor={f.col2} stopOpacity="0.25" />
          <stop offset="1" stopColor={f.col2} stopOpacity="0" />
        </linearGradient>
      </defs>
      <g mask={`url(#${id}m)`}>
        <path d="M0 120 C160 40 320 200 520 110 C700 40 860 170 1000 90 L1000 260 C860 320 700 210 520 290 C320 360 160 230 0 300 Z" fill={`url(#${id}a)`} />
        <path d="M0 132 C160 52 320 212 520 122 C700 52 860 182 1000 102" fill="none" stroke={f.col} strokeWidth="3" opacity="0.7" />
        <path d="M120 100 V230 M220 90 V250 M330 140 V270 M430 120 V280 M560 100 V260 M660 70 V230 M770 90 V240 M880 100 V230" stroke={f.col} strokeWidth="6" opacity="0.18" />
      </g>
    </svg>
  );
}

function I6Beam({ f }) {
  return <div style={{ ...FULL, transform: `rotate(${f.rot}deg)`, background: `radial-gradient(50% 100% at 50% 0%, ${f.col} 0%, rgba(255,255,255,0) 100%)` }} />;
}

function I6Glint({ f }) {
  return (
    <svg viewBox="-14 -14 28 28" width="100%" height="100%" {...A11Y}>
      <path d="M0 -14 L2 -2 L14 0 L2 2 L0 14 L-2 2 L-14 0 L-2 -2 Z" fill={f.col} />
      <circle r="2.6" fill="#ffffff" />
    </svg>
  );
}

function I6Flake({ f }) {
  return <div style={{ ...FULL, borderRadius: "50%", background: `radial-gradient(circle, ${f.col} 0%, ${f.col} 38%, rgba(255,255,255,0) 72%)` }} />;
}

function I6Star({ f }) {
  return (
    <svg viewBox="-10 -10 20 20" width="100%" height="100%" {...A11Y}>
      <path d="M0 -9 V9 M-7.8 -4.5 L7.8 4.5 M-7.8 4.5 L7.8 -4.5 M-2.5 -7 L0 -5 L2.5 -7 M-2.5 7 L0 5 L2.5 7" stroke={f.col} strokeWidth="1.6" strokeLinecap="round" fill="none" />
    </svg>
  );
}

function I6Frost({ f }) {
  return (
    <div
      style={{
        ...FULL,
        background: `radial-gradient(ellipse at 50% 56%, rgba(0,0,0,0) 50%, ${f.col2} 100%), radial-gradient(ellipse 60% 50% at 0% 0%, ${f.col} 0%, rgba(255,255,255,0) 100%), radial-gradient(ellipse 60% 50% at 100% 0%, ${f.col} 0%, rgba(255,255,255,0) 100%)`,
      }}
    />
  );
}

/* ---------- ของบังหน้ากล้อง ---------- */
function I6Icicles({ f }) {
  return (
    <div style={{ ...FULL, transform: f.rot ? "scaleX(-1)" : undefined }}>
      <svg viewBox="0 0 520 120" width="100%" height="100%" preserveAspectRatio="none" {...A11Y}>
        <path d="M0 0 H520 V18 C470 30 430 22 380 30 C320 40 260 26 200 34 C140 42 80 30 0 40 Z" fill={f.col} />
        <path d="M30 34 L42 110 L54 36 Z M90 32 L98 82 L106 32 Z M150 36 L164 120 L178 36 Z M230 32 L238 70 L246 32 Z M290 30 L302 100 L314 30 Z M360 30 L368 66 L376 30 Z M420 26 L432 92 L444 26 Z M480 22 L487 58 L494 22 Z" fill={f.col2} />
        <path d="M34 36 L42 100 L44 36 Z M154 38 L164 108 L166 38 Z M294 32 L302 90 L304 32 Z M424 28 L432 82 L434 28 Z" fill={f.col} opacity="0.85" />
      </svg>
    </div>
  );
}

function I6Drift({ f }) {
  return (
    <div style={{ ...FULL, transform: f.rot ? "scaleX(-1)" : undefined }}>
      <svg viewBox="0 0 420 200" width="100%" height="100%" preserveAspectRatio="none" {...A11Y}>
        <path d="M40 120 L120 30 L150 60 L210 10 L250 70 L300 40 L340 110 Z" fill={f.col2} />
        <path d="M0 200 V110 C80 70 170 90 240 110 C310 128 370 120 420 140 V200 Z" fill={f.col} />
        <path d="M0 120 C80 84 170 100 240 120" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="6" />
      </svg>
    </div>
  );
}

export default {
  stand: { I6Range, I6Castle, I6Throne, I6Spike, I6Shard, I6Statue, I6Pine },
  fx: { I6Aurora, I6Beam, I6Glint, I6Flake, I6Star, I6Frost },
  fore: { I6Icicles, I6Drift },
};
