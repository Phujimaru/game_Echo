// ============================================================
//  14 ฉากหลังของระบบ Journey (7 ภูมิภาค × กลางวัน/กลางคืน)
//
//  หลักประสิทธิภาพ (ห้ามทำให้กระตุก):
//   - ทิวทัศน์นิ่งทั้งหมดอยู่ใน <svg> ก้อนเดียวต่อฉาก -> วาดครั้งเดียว ไม่มีอะไรในนั้นขยับ
//   - ของที่ขยับเป็น <div> แยกชั้น ขนาดเท่าที่จำเป็น ขยับด้วย transform/opacity (CSS keyframes) เท่านั้น
//   - ไม่มี filter/blur/box-shadow ที่ขยับ แสงเรืองใช้ radial-gradient ล้วน
//   - รูปทรงสุ่มแบบกำหนด seed คำนวณครั้งเดียวแล้วแคชไว้ระดับโมดูล
//   - lowQ = อนิเมชันทั้งหมดถูกหยุด (paused) + อนุภาคเหลือ 1/3 -> ภาพนิ่งที่ยังสวย
// ============================================================

import { memo } from "react";
import {
  SW,
  SH,
  seeded,
  box,
  ridge,
  ridgeLine,
  wave,
  peaks,
  starField,
  strip,
  twistedTree,
  spikyLine,
  shadeBand,
  crescent,
  cloudPuffs,
  crackPath,
  waveStrip,
  spiralArm,
} from "./geometry";

// ---------- แคชผลคำนวณระดับโมดูล ----------
const CACHE = new Map();
function once(key, make) {
  if (!CACHE.has(key)) CACHE.set(key, make());
  return CACHE.get(key);
}

const f1 = (n) => Math.round(n * 10) / 10;

// ============================================================
//  ชิ้นส่วนใช้ซ้ำ
// ============================================================

function Sky({ bg }) {
  return <div className="jb-sky" style={{ background: bg }} />;
}

/** แสงเรืองวงรี (radial-gradient) — anim = ชื่อคลาสอนิเมชัน (ไม่บังคับ) */
function Glow({ x, y, w, h, bg, anim, dur, delay, opacity }) {
  return (
    <div
      className={`jb-abs${anim ? ` ${anim}` : ""}`}
      style={box(x - w / 2, y - h / 2, w, h, {
        background: bg,
        opacity,
        animationDuration: dur,
        animationDelay: delay,
      })}
    />
  );
}

/** svg ขนาดเท่า stage (1600×900) สำหรับทิวทัศน์นิ่ง */
function StageSvg({ children }) {
  return (
    <svg className="jb-svg" viewBox={`0 0 ${SW} ${SH}`} preserveAspectRatio="none" aria-hidden="true">
      {children}
    </svg>
  );
}

/** ดาวกระพริบ: ชั้นนิ่ง 1 ชั้น + ชั้นกระพริบ 2 ชั้น (สลับ opacity ทั้งชั้น — ถูกกว่ากระพริบทีละดวง) */
function StarLayers({ seed, n, y1 = 470, color = "#fff", r1 = 1.8 }) {
  const stars = once(`stars-${seed}-${n}-${y1}-${r1}`, () => starField(seed, n, { y1, r1 }));
  const groups = [[], [], []];
  stars.forEach((s, i) => groups[i % 3].push(s));
  const layer = (g) => (
    <svg viewBox={`0 0 ${SW} ${y1}`} preserveAspectRatio="none" aria-hidden="true">
      {g.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={s.r} fill={color} opacity={s.o} />
      ))}
    </svg>
  );
  return (
    <>
      <div className="jb-abs" style={box(0, 0, SW, y1)}>
        {layer(groups[0])}
      </div>
      <div className="jb-abs jb-tw" style={box(0, 0, SW, y1, { animationDuration: "3.8s" })}>
        {layer(groups[1])}
      </div>
      <div className="jb-abs jb-tw" style={box(0, 0, SW, y1, { animationDuration: "5.2s", animationDelay: "-2.4s" })}>
        {layer(groups[2])}
      </div>
    </>
  );
}

function ShootingStar({ x, y, angle = 28, dur = "11s", delay = "0s", color = "rgba(255,255,255,0.95)" }) {
  return (
    <div className="jb-abs" style={box(x, y, 1, 1, { transform: `rotate(${angle}deg)` })}>
      <div
        className="jb-shoot"
        style={{
          width: "16cqw",
          background: `linear-gradient(90deg, transparent, ${color})`,
          animationDuration: dur,
          animationDelay: delay,
        }}
      />
    </div>
  );
}

/** เมฆลอยช้า ๆ ไปกลับ (ease-in-out alternate จึงไม่มีจังหวะกระโดด) */
function Cloud({ seed, x, y, w, h, fill, shade, opacity = 1, from = "-6cqw", to = "6cqw", dur = "70s", delay = "0s" }) {
  const puffs = once(`cloud-${seed}-${w}-${h}`, () => cloudPuffs(seed, w, h, 7));
  return (
    <div
      className="jb-abs jb-drift"
      style={box(x, y, w, h, { opacity, "--from": from, "--to": to, animationDuration: dur, animationDelay: delay })}
    >
      {/* สีทึบทั้งหมด แล้วคุมความโปร่งด้วย opacity ของทั้งกล่อง -> วงกลมที่ซ้อนกันไม่เห็นรอยต่อ */}
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
        <g fill={shade || fill}>
          {puffs.map((p, i) => (
            <circle key={i} cx={p.cx} cy={p.cy} r={p.r} />
          ))}
          <rect x={w * 0.08} y={h * 0.7} width={w * 0.84} height={h * 0.3} rx={h * 0.15} />
        </g>
        {shade && (
          <g fill={fill}>
            {puffs.map((p, i) => (
              <circle key={i} cx={Number(p.cx) - p.r * 0.08} cy={Number(p.cy) - p.r * 0.14} r={p.r * 0.86} />
            ))}
          </g>
        )}
      </svg>
    </div>
  );
}

/** แถบหมอกลอย (gradient ล้วน) */
function MistBand({ y, h, color, opacity = 0.35, from = "-8cqw", to = "8cqw", dur = "40s", delay = "0s" }) {
  return (
    <div
      className="jb-abs jb-drift"
      style={box(-240, y, SW + 480, h, {
        opacity,
        "--from": from,
        "--to": to,
        animationDuration: dur,
        animationDelay: delay,
        background: `radial-gradient(ellipse 22% 50% at 16% 55%, ${color}, transparent 70%), radial-gradient(ellipse 26% 46% at 48% 45%, ${color}, transparent 70%), radial-gradient(ellipse 22% 52% at 80% 58%, ${color}, transparent 70%), linear-gradient(180deg, transparent, ${color} 50%, transparent)`,
      })}
    />
  );
}

/** ก้อนควันมืดลอย (radial-gradient ล้วน ไม่มีขอบแข็ง) */
function Smoke({ x, y, w, h, color, opacity = 1, from = "-6cqw", to = "6cqw", dur = "50s", delay = "0s" }) {
  return (
    <div
      className="jb-abs jb-drift"
      style={box(x, y, w, h, {
        opacity,
        "--from": from,
        "--to": to,
        animationDuration: dur,
        animationDelay: delay,
        background: `radial-gradient(ellipse 26% 42% at 18% 55%, ${color}, transparent 72%), radial-gradient(ellipse 30% 50% at 45% 42%, ${color}, transparent 72%), radial-gradient(ellipse 26% 44% at 72% 58%, ${color}, transparent 72%), radial-gradient(ellipse 18% 36% at 90% 40%, ${color}, transparent 72%)`,
      })}
    />
  );
}

/** นกบินผ่าน: ตัวนอกเลื่อนข้ามจอ ตัวในกระพือปีก */
function Bird({ y, dur, delay, size = 26, color = "#1c2433", rise = "-6cqh" }) {
  return (
    <div
      className="jb-abs jb-fly"
      style={box(-60, y, size, size * 0.5, { animationDuration: dur, animationDelay: delay, "--rise": rise })}
    >
      <svg className="jb-flap" viewBox="0 0 40 20" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 4 Q10 0 20 12 Q30 0 40 4 Q30 5 20 16 Q10 5 0 4 Z" fill={color} />
      </svg>
    </div>
  );
}

/** สัตว์บินวนเป็นวง (อีกา/แร้ง) */
function Circler({ x, y, radius, dur, delay = "0s", size = 30, color = "#0b0b0b", reverse }) {
  return (
    <div className="jb-abs" style={box(x, y, 1, 1)}>
      <div className="jb-orbit" style={{ animationDuration: dur, animationDelay: delay, animationDirection: reverse ? "reverse" : "normal" }}>
        <div className="jb-orbit-arm" style={{ transform: `translateX(${(radius / SW) * 100}cqw)` }}>
          <svg className="jb-flap" style={{ width: `${(size / SW) * 100}cqw`, height: `${(size / SW) * 50}cqw` }} viewBox="0 0 40 20" aria-hidden="true">
            <path d="M0 6 Q8 1 16 9 L20 13 L24 9 Q32 1 40 6 Q31 6 22 17 L20 19 L18 17 Q9 6 0 6 Z" fill={color} />
          </svg>
        </div>
      </div>
    </div>
  );
}

// ---------- ไฟ ----------
const FLAME_D =
  "M50 200 C18 200 4 172 10 140 C16 108 30 96 28 64 C38 82 44 90 46 74 C48 50 40 30 54 0 C60 30 76 44 80 70 C84 90 78 100 86 112 C92 96 94 88 92 76 C104 100 100 128 96 150 C92 180 76 200 50 200 Z";
const FLAME_D2 =
  "M50 200 C22 200 8 178 12 150 C16 122 26 110 22 84 C34 96 40 104 42 90 C44 66 34 44 44 18 C52 42 64 58 66 80 C68 98 64 110 72 118 C78 102 78 92 76 80 C92 104 94 132 90 156 C86 182 72 200 50 200 Z";

function Flame({ x, base, w, h, dur, delay, colors, variant = 0 }) {
  const d = variant ? FLAME_D2 : FLAME_D;
  return (
    <div className="jb-abs jb-flame" style={box(x - w / 2, base - h, w, h, { animationDuration: dur, animationDelay: delay })}>
      <svg viewBox="0 0 100 200" preserveAspectRatio="none" aria-hidden="true">
        <path d={d} fill={colors[0]} opacity="0.9" />
        <path d={d} fill={colors[1]} transform="translate(50 200) scale(0.74 0.78) translate(-50 -200)" />
        <path d={d} fill={colors[2]} transform="translate(50 200) scale(0.46 0.5) translate(-50 -200)" />
      </svg>
    </div>
  );
}

// ============================================================
//  อนุภาค (หิมะ / กลีบดอกไม้ / ถ่านไฟ / หิ่งห้อย / ทราย / ดวงวิญญาณ / เถ้า)
//  วางใน .jb-parts ที่คลุมจอพอดี (ใช้หน่วย cqw/cqh ของฉาก)
// ============================================================

function makeParticles(kind, n, seed) {
  const r = seeded(seed);
  const out = [];
  for (let i = 0; i < n; i++) {
    let s;
    if (kind === "snow" || kind === "snowNight") {
      const depth = r();
      const size = 0.55 + depth * depth * 1.5;
      const dur = 24 - depth * 13 + r() * 4;
      s = {
        left: `${f1(r() * 106 - 3)}%`,
        width: `${f1(size * 100) / 100}cqh`,
        height: `${f1(size * 100) / 100}cqh`,
        opacity: f1((0.6 + depth * 0.4) * 100) / 100,
        "--dx": `${f1((r() - 0.25) * 16)}cqw`,
        "--sw": `${f1((r() - 0.5) * 7)}cqw`,
        animationDuration: `${f1(dur)}s`,
        animationDelay: `${f1(-r() * dur)}s`,
      };
    } else if (kind === "ash") {
      const size = 0.25 + r() * 0.45;
      const dur = 18 + r() * 12;
      s = {
        left: `${f1(r() * 104 - 2)}%`,
        width: `${f1(size * 100) / 100}cqh`,
        height: `${f1(size * 70) / 100}cqh`,
        opacity: f1((0.3 + r() * 0.4) * 100) / 100,
        "--dx": `${f1((r() - 0.6) * 18)}cqw`,
        "--sw": `${f1((r() - 0.5) * 8)}cqw`,
        animationDuration: `${f1(dur)}s`,
        animationDelay: `${f1(-r() * dur)}s`,
      };
    } else if (kind === "petal") {
      const size = 1.3 + r() * 1.1;
      const dur = 14 + r() * 10;
      s = {
        left: `${f1(r() * 100 - 18)}%`,
        width: `${f1(size * 100) / 100}cqh`,
        height: `${f1(size * 60) / 100}cqh`,
        "--dx": `${f1(22 + r() * 26)}cqw`,
        "--sw": `${f1((r() - 0.5) * 10)}cqw`,
        "--r0": `${Math.round(r() * 360)}deg`,
        animationDuration: `${f1(dur)}s`,
        animationDelay: `${f1(-r() * dur)}s`,
        background: r() < 0.3 ? "linear-gradient(135deg, #fff1f6, #f6b3cc)" : "linear-gradient(135deg, #ffd0e0, #e9789f)",
      };
    } else if (kind === "ember") {
      const size = 0.25 + r() * 0.55;
      const dur = 6 + r() * 7;
      s = {
        left: `${f1(r() * 104 - 2)}%`,
        width: `${f1(size * 100) / 100}cqh`,
        height: `${f1(size * 100) / 100}cqh`,
        "--dx": `${f1((r() - 0.4) * 16)}cqw`,
        "--sw": `${f1((r() - 0.5) * 9)}cqw`,
        "--rise": `${f1(-55 - r() * 50)}cqh`,
        animationDuration: `${f1(dur)}s`,
        animationDelay: `${f1(-r() * dur)}s`,
      };
    } else if (kind === "firefly" || kind === "wisp") {
      const wisp = kind === "wisp";
      const size = wisp ? 1.6 + r() * 1.6 : 0.8 + r() * 0.7;
      const dur = (wisp ? 11 : 7) + r() * 6;
      s = {
        left: `${f1(4 + r() * 92)}%`,
        top: `${f1(wisp ? 42 + r() * 40 : 50 + r() * 44)}%`,
        width: `${f1(size * 100) / 100}cqh`,
        height: `${f1(size * 100) / 100}cqh`,
        "--ax": `${f1((r() - 0.5) * 8)}cqw`,
        "--ay": `${f1((r() - 0.5) * 7)}cqh`,
        "--bx": `${f1((r() - 0.5) * 8)}cqw`,
        "--by": `${f1((r() - 0.5) * 7)}cqh`,
        animationDuration: `${f1(dur)}s, ${f1(2.2 + r() * 2.6)}s`,
        animationDelay: `${f1(-r() * dur)}s, ${f1(-r() * 4)}s`,
      };
    } else if (kind === "sand" || kind === "sandNight") {
      const dur = 2.6 + r() * 3.2;
      s = {
        top: `${f1(46 + r() * 52)}%`,
        width: `${f1(3 + r() * 7)}cqw`,
        height: `${f1((0.12 + r() * 0.2) * 100) / 100}cqh`,
        "--dy": `${f1((r() - 0.3) * 8)}cqh`,
        opacity: f1((0.35 + r() * 0.5) * 100) / 100,
        animationDuration: `${f1(dur)}s`,
        animationDelay: `${f1(-r() * dur * 3)}s`,
      };
    }
    out.push(s);
  }
  return out;
}

function Particles({ kind, n, seed, lowQ }) {
  const list = once(`p-${kind}-${n}-${seed}`, () => makeParticles(kind, n, seed));
  const shown = lowQ ? list.slice(0, Math.ceil(n / 3)) : list;
  return (
    <div className="jb-parts" aria-hidden="true">
      {shown.map((p, i) => (
        <i key={i} className={`jb-p jb-p-${kind}`} style={p} />
      ))}
    </div>
  );
}

// ============================================================
//  ภูมิภาค 1 — อาณาจักรแห่งจุดเริ่มต้น
// ============================================================

const A1 = () =>
  once("a1", () => {
    const far = peaks(101, { base: 560, minH: 70, maxH: 180, minW: 150, maxW: 280, cap: 0.3 });
    const midFn = wave(102, 604, [[16, 95], [24, 230]]);
    const nearFn = wave(103, 700, [[20, 120], [28, 300]]);
    const frontFn = wave(104, 815, [[16, 100], [30, 260]]);
    const rnd = seeded(105);
    const castleX = 1180;
    const castleY = midFn(castleX) - 8;
    const midTrees = Array.from({ length: 14 }, () => {
      const x = rnd() * SW;
      return { x, y: midFn(x) + 8 + rnd() * 14, s: 0.55 + rnd() * 0.3 };
    }).filter((t) => Math.abs(t.x - castleX) > 200);
    const nearTrees = Array.from({ length: 16 }, () => {
      const x = rnd() * SW;
      return { x, y: nearFn(x) + 6 + rnd() * 20, s: 0.9 + rnd() * 0.5 };
    });
    const roadPts = [];
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      const x = 640 + (castleX - 640) * t + Math.sin(t * Math.PI * 1.6) * 150 * (1 - t);
      const y = 920 - (920 - castleY - 4) * (1 - Math.pow(1 - t, 1.5));
      roadPts.push([x, y]);
    }
    return {
      far,
      mid: ridge(midFn),
      near: ridge(nearFn),
      front: ridge(frontFn),
      castleX,
      castleY,
      midTrees,
      nearTrees,
      road: strip(roadPts, 150, 8),
    };
  });

const TOWERS = [
  { cx: -152, w: 30, h: 88, c: 46 },
  { cx: -98, w: 44, h: 140, c: 62 },
  { cx: 0, w: 72, h: 198, c: 94 },
  { cx: 94, w: 44, h: 152, c: 64 },
  { cx: 152, w: 32, h: 98, c: 48 },
];

function KingdomCastle({ x, y, night }) {
  const P = night
    ? { wall: "#121c33", shade: "#0b1326", roof: "#0d1529", roofS: "#080d1c", dark: "#050914", win: "#ffcf6e" }
    : { wall: "#d8d0bc", shade: "#b1a790", roof: "#41629c", roofS: "#2d487a", dark: "#5c5444", win: "#3b352a" };
  return (
    <g transform={`translate(${f1(x)} ${f1(y)})`}>
      <path d="M -230 26 Q -120 -18 0 -14 Q 120 -18 230 26 Z" fill={night ? "#16283a" : "#6d9858"} />
      <rect x="-164" y="-66" width="328" height="70" fill={P.wall} />
      <rect x="0" y="-66" width="164" height="70" fill={P.shade} opacity="0.55" />
      {Array.from({ length: 24 }, (_, i) => (
        <rect key={i} x={-164 + i * 14} y="-75" width="8" height="10" fill={i > 11 ? P.shade : P.wall} />
      ))}
      <path d="M -18 4 L -18 -30 A 18 18 0 0 1 18 -30 L 18 4 Z" fill={P.dark} />
      {TOWERS.map((t) => (
        <g key={t.cx}>
          <rect x={t.cx - t.w / 2} y={-t.h} width={t.w} height={t.h} fill={P.wall} />
          <rect x={t.cx} y={-t.h} width={t.w / 2} height={t.h} fill={P.shade} />
          <rect x={t.cx - t.w / 2 - 3} y={-t.h} width={t.w + 6} height="7" fill={P.dark} />
          <path d={`M ${t.cx - t.w / 2 - 6} ${-t.h} L ${t.cx} ${-t.h - t.c} L ${t.cx + t.w / 2 + 6} ${-t.h} Z`} fill={P.roof} />
          <path d={`M ${t.cx} ${-t.h - t.c} L ${t.cx + t.w / 2 + 6} ${-t.h} L ${t.cx} ${-t.h} Z`} fill={P.roofS} />
          <line x1={t.cx} y1={-t.h - t.c} x2={t.cx} y2={-t.h - t.c - 24} stroke={P.dark} strokeWidth="2" />
          {[0.28, 0.52, 0.76].slice(0, t.h > 120 ? 3 : 2).map((k) => (
            <rect key={k} x={t.cx - 3} y={-t.h + t.h * k} width="6" height="12" rx="3" fill={P.win} />
          ))}
        </g>
      ))}
      {[-130, -60, 50, 120].map((wx) => (
        <rect key={wx} x={wx} y="-44" width="6" height="11" rx="3" fill={P.win} />
      ))}
    </g>
  );
}

function RoundTrees({ list, trunk, leaf, hi }) {
  return (
    <g>
      {list.map((t, i) => (
        <g key={i} transform={`translate(${f1(t.x)} ${f1(t.y)}) scale(${f1(t.s * 10) / 10})`}>
          <rect x="-2" y="-12" width="4" height="14" fill={trunk} />
          <circle cx="0" cy="-22" r="13" fill={leaf} />
          <circle cx="-4" cy="-26" r="7" fill={hi} />
        </g>
      ))}
    </g>
  );
}

function Area1({ night, lowQ }) {
  const g = A1();
  const flags = TOWERS.filter((_, i) => i % 2 === 0 || i === 1).map((t) => ({
    x: g.castleX + t.cx,
    y: g.castleY - t.h - t.c - 24,
  }));
  const C = night
    ? {
        sky: "linear-gradient(180deg, #03050f 0%, #0a1430 38%, #1a2a52 70%, #34406a 100%)",
        far: "#1b2844",
        cap: "#5b6c8f",
        mid: "#15263a",
        near: "#0f1e2e",
        front: "#08131e",
        road: "#2b3550",
        trunk: "#070d16",
        leaf: "#0c1a24",
        hi: "#122431",
        leafN: "#08141c",
        hiN: "#0d1c26",
      }
    : {
        sky: "linear-gradient(180deg, #2f5b8a 0%, #5a88b2 34%, #9bbccd 60%, #dccfa6 82%, #e6c68c 100%)",
        far: "#7c95b3",
        cap: "#eef3f8",
        mid: "#6f9a5a",
        near: "#4f7f43",
        front: "#33602e",
        road: "#cdb67f",
        trunk: "#4a3a26",
        leaf: "#4d8043",
        hi: "#6aa25a",
        leafN: "#2d5a2a",
        hiN: "#3f7438",
      };
  return (
    <>
      <Sky bg={C.sky} />
      {night ? (
        <>
          <StarLayers seed={111} n={90} y1={480} />
          <Glow x={330} y={170} w={360} h={360} bg="radial-gradient(closest-side, rgba(255,240,200,0.32), rgba(160,180,255,0.1) 55%, transparent)" anim="jb-breathe" dur="9s" />
          <ShootingStar x={900} y={80} dur="13s" delay="-4s" />
        </>
      ) : (
        <>
          <Glow x={1250} y={150} w={760} h={620} bg="radial-gradient(closest-side, rgba(255,246,214,0.75), rgba(255,214,140,0.28) 45%, transparent)" anim="jb-breathe" dur="10s" />
          <div className="jb-abs jb-rays" style={box(750, -350, 1000, 1000, { transformOrigin: "50% 50%" })}>
            <svg viewBox="-500 -500 1000 1000" aria-hidden="true">
              {[98, 114, 131, 149, 166, 184].map((a, i) => {
                const r = (a * Math.PI) / 180;
                const w = i % 2 ? 0.028 : 0.042;
                return (
                  <path
                    key={a}
                    d={`M 0 0 L ${f1(Math.cos(r - w) * 720)} ${f1(Math.sin(r - w) * 720)} L ${f1(Math.cos(r + w) * 720)} ${f1(Math.sin(r + w) * 720)} Z`}
                    fill="#fff4d0"
                    opacity={i % 2 ? 0.09 : 0.14}
                  />
                );
              })}
            </svg>
          </div>
          <Cloud seed={121} x={80} y={90} w={420} h={110} fill="#ffffff" shade="#c3d2e4" opacity={0.78} dur="80s" from="-4cqw" to="10cqw" />
          <Cloud seed={122} x={620} y={40} w={300} h={80} fill="#ffffff" shade="#c3d2e4" opacity={0.6} dur="95s" delay="-30s" from="-8cqw" to="6cqw" />
          <Cloud seed={123} x={140} y={330} w={340} h={70} fill="#fff8ec" shade="#e6d8c8" opacity={0.45} dur="70s" delay="-12s" />
        </>
      )}
      <StageSvg>
        {night && <path d={crescent(330, 170, 44, 0.36, -30)} fill="#f6efd2" />}
        {!night && <circle cx="1250" cy="150" r="46" fill="#fff6dc" opacity="0.95" />}
        <path d={g.far.d} fill={C.far} />
        <path d={g.far.caps} fill={C.cap} opacity={night ? 0.5 : 0.9} />
        <path d={g.mid} fill={C.mid} />
        <RoundTrees list={g.midTrees} trunk={C.trunk} leaf={C.leaf} hi={C.hi} />
        <KingdomCastle x={g.castleX} y={g.castleY} night={night} />
        <path d={g.near} fill={C.near} />
        <path d={g.road} fill={C.road} opacity={night ? 0.7 : 0.85} />
        <RoundTrees list={g.nearTrees} trunk={C.trunk} leaf={C.leafN} hi={C.hiN} />
        <path d={g.front} fill={C.front} />
      </StageSvg>
      <MistBand y={560} h={90} color={night ? "rgba(140,160,220,0.5)" : "rgba(255,244,220,0.6)"} opacity={night ? 0.35 : 0.4} dur="55s" />
      {night && (
        <Glow x={g.castleX} y={g.castleY - 100} w={460} h={320} bg="radial-gradient(closest-side, rgba(255,196,96,0.28), transparent)" anim="jb-breathe" dur="5s" />
      )}
      {flags.map((f, i) => (
        <div key={i} className="jb-abs jb-flag" style={box(f.x, f.y, 30, 16, { animationDuration: `${1.6 + i * 0.3}s`, animationDelay: `${-i * 0.5}s` })}>
          <svg viewBox="0 0 30 16" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0 0 L30 4 L22 8 L30 12 L0 16 Z" fill={night ? "#3a1420" : i % 2 ? "#c9992f" : "#b8323c"} />
          </svg>
        </div>
      ))}
      {!night && !lowQ && (
        <>
          <Bird y={210} dur="34s" delay="-6s" />
          <Bird y={240} dur="34s" delay="-7.2s" size={20} />
          <Bird y={180} dur="40s" delay="-22s" size={22} />
        </>
      )}
    </>
  );
}

// ============================================================
//  ภูมิภาค 2 — สวนดอกไม้ทุ่งหญ้าแสนอบอุ่น
// ============================================================

const A2 = () =>
  once("a2", () => {
    const farFn = wave(201, 572, [[14, 120], [22, 300]]);
    const midFn = wave(202, 636, [[16, 110], [20, 260]]);
    const nearFn = wave(203, 720, [[18, 140], [26, 320]]);
    const frontFn = wave(204, 828, [[14, 90], [22, 210]]);
    const rnd = seeded(205);
    const speck = (fn, n, dy, r0, r1) =>
      Array.from({ length: n }, () => {
        const x = rnd() * SW;
        return { x: f1(x), y: f1(fn(x) + 4 + rnd() * dy), r: f1(r0 + rnd() * (r1 - r0)), c: Math.floor(rnd() * 4) };
      });
    const blooms = Array.from({ length: 30 }, () => {
      const x = rnd() * SW;
      return { x: f1(x), y: f1(frontFn(x) + 10 + rnd() * 60), r: f1(5 + rnd() * 6), c: Math.floor(rnd() * 4), rot: Math.round(rnd() * 72) };
    });
    const treeX = 1280;
    const tree = twistedTree(206, treeX, nearFn(treeX) + 6, 400, { twist: 0.35, depth: 4, spread: 0.85, width: 26, lean: -0.04 });
    const canopy = [];
    tree.tips.forEach(([x, y]) => {
      for (let k = 0; k < 3; k++) {
        canopy.push({ x: f1(x + (rnd() - 0.5) * 56), y: f1(y + (rnd() - 0.6) * 44), r: f1(20 + rnd() * 20), c: k === 0 ? 0 : 1 + Math.floor(rnd() * 2) });
      }
    });
    canopy.sort((p, q) => p.c - q.c);
    const grass = [];
    for (let x = -10; x < SW + 10; x += 9) {
      const h = 22 + rnd() * 42;
      const lean = (rnd() - 0.5) * 16;
      grass.push(`M ${f1(x)} 120 L ${f1(x + 3 + lean)} ${f1(120 - h)} L ${f1(x + 7)} 120 Z`);
    }
    return {
      far: ridge(farFn),
      mid: ridge(midFn),
      near: ridge(nearFn),
      front: ridge(frontFn),
      midSpeck: speck(midFn, 110, 50, 1.4, 2.8),
      nearSpeck: speck(nearFn, 110, 90, 2.2, 4.2),
      blooms,
      tree: tree.d,
      canopy,
      grass: grass.join(" "),
    };
  });

function Area2({ night, lowQ }) {
  const g = A2();
  const C = night
    ? {
        sky: "linear-gradient(180deg, #060b1f 0%, #111f44 40%, #24385e 72%, #3a4f70 100%)",
        far: "#20384a",
        mid: "#193044",
        near: "#122736",
        front: "#0c1c28",
        grass: "#0a1822",
        fl: ["#b7c9ef", "#d0a8dc", "#e9e3c7", "#9fd0e0"],
        flOp: 0.55,
        trunk: "#0b0f18",
        can: ["#4e3a63", "#634a7c", "#7b5f96"],
      }
    : {
        sky: "linear-gradient(180deg, #4a82b6 0%, #82b0cc 32%, #cfd6c0 62%, #f5d39c 84%, #f2b98c 100%)",
        far: "#8fb49a",
        mid: "#86b562",
        near: "#6aa24c",
        front: "#4d8a3a",
        grass: "#3f7a30",
        fl: ["#f7a8c6", "#ffe38a", "#fff4f0", "#d9b6f2"],
        flOp: 0.95,
        trunk: "#5a3a2a",
        can: ["#cf6690", "#e98cb0", "#f6b1ca"],
      };
  return (
    <>
      <Sky bg={C.sky} />
      {night ? (
        <>
          <StarLayers seed={211} n={70} y1={460} />
          <Glow x={1170} y={190} w={520} h={520} bg="radial-gradient(closest-side, rgba(240,240,255,0.36), rgba(150,170,240,0.12) 50%, transparent)" anim="jb-breathe" dur="10s" />
        </>
      ) : (
        <>
          <Glow x={420} y={230} w={900} h={700} bg="radial-gradient(closest-side, rgba(255,247,220,0.8), rgba(255,210,150,0.3) 45%, transparent)" anim="jb-breathe" dur="11s" />
          <Cloud seed={221} x={900} y={110} w={380} h={100} fill="#ffffff" shade="#f0cfc6" opacity={0.78} dur="90s" from="-6cqw" to="8cqw" />
          <Cloud seed={222} x={640} y={300} w={280} h={70} fill="#fffaf0" shade="#f2dccf" opacity={0.55} dur="75s" delay="-20s" />
          <Cloud seed={223} x={60} y={60} w={260} h={70} fill="#ffffff" shade="#dfe6ee" opacity={0.55} dur="85s" delay="-40s" />
        </>
      )}
      <StageSvg>
        {night ? (
          <g>
            <circle cx="1170" cy="190" r="56" fill="#f4f1e2" />
            <circle cx="1152" cy="176" r="11" fill="#dedbc8" />
            <circle cx="1188" cy="206" r="8" fill="#dedbc8" />
            <circle cx="1180" cy="170" r="5" fill="#e3e0cf" />
          </g>
        ) : (
          <circle cx="420" cy="230" r="54" fill="#fff5da" />
        )}
        <path d={g.far} fill={C.far} />
        <path d={g.mid} fill={C.mid} />
        <g opacity={C.flOp * 0.8}>
          {g.midSpeck.map((s, i) => (
            <circle key={i} cx={s.x} cy={s.y} r={s.r} fill={C.fl[s.c]} />
          ))}
        </g>
        <path d={g.tree} fill={C.trunk} />
        <g>
          {g.canopy.map((c, i) => (
            <circle key={i} cx={c.x} cy={c.y} r={c.r} fill={C.can[c.c]} />
          ))}
        </g>
        <path d={g.near} fill={C.near} />
        <g opacity={C.flOp}>
          {g.nearSpeck.map((s, i) => (
            <circle key={i} cx={s.x} cy={s.y} r={s.r} fill={C.fl[s.c]} />
          ))}
        </g>
        <path d={g.front} fill={C.front} />
        <g opacity={C.flOp}>
          {g.blooms.map((b, i) => (
            <g key={i} transform={`translate(${b.x} ${b.y}) rotate(${b.rot})`}>
              {[0, 72, 144, 216, 288].map((a) => (
                <ellipse key={a} cx="0" cy={-b.r * 0.8} rx={b.r * 0.45} ry={b.r * 0.85} fill={C.fl[b.c]} transform={`rotate(${a})`} />
              ))}
              <circle r={b.r * 0.35} fill={night ? "#e8d9a0" : "#f7c948"} />
            </g>
          ))}
        </g>
      </StageSvg>
      <div className="jb-abs jb-sway" style={box(-20, 760, SW + 40, 140)}>
        <svg viewBox={`-10 0 ${SW + 20} 140`} preserveAspectRatio="none" aria-hidden="true">
          <path d={g.grass} fill={C.grass} />
          <rect x="-10" y="118" width={SW + 20} height="22" fill={C.grass} />
        </svg>
      </div>
      {night ? <Particles kind="firefly" n={22} seed={231} lowQ={lowQ} /> : <Particles kind="petal" n={18} seed={232} lowQ={lowQ} />}
    </>
  );
}

// ============================================================
//  ภูมิภาค 3 — ป่าไม้ต้องสาป
// ============================================================

const A3 = () =>
  once("a3", () => {
    const groundFn = wave(305, 812, [[14, 110], [20, 260]]);
    const midTrees = [
      twistedTree(311, 330, 690, 330, { depth: 4, twist: 0.8, width: 16 }),
      twistedTree(312, 610, 700, 290, { depth: 4, twist: 0.9, width: 14, lean: 0.12 }),
      twistedTree(313, 930, 690, 340, { depth: 4, twist: 0.85, width: 17, lean: -0.1 }),
      twistedTree(314, 1210, 700, 300, { depth: 4, twist: 0.9, width: 15 }),
    ];
    const bigL = twistedTree(321, 110, 900, 980, { depth: 5, twist: 0.7, width: 70, lean: 0.22, spread: 0.8 });
    const bigR = twistedTree(322, 1500, 900, 940, { depth: 5, twist: 0.7, width: 66, lean: -0.26, spread: 0.8 });
    const rnd = seeded(323);
    const vines = [...bigL.tips, ...bigR.tips]
      .filter((_, i) => i % 3 === 0)
      .slice(0, 16)
      .map(([x, y]) => {
        const L = 40 + rnd() * 110;
        return `M ${f1(x)} ${f1(y)} q ${f1((rnd() - 0.5) * 20)} ${f1(L * 0.5)} ${f1((rnd() - 0.5) * 10)} ${f1(L)}`;
      })
      .join(" ");
    return {
      far: spikyLine(301, { base: 575, minH: 40, maxH: 130, step: 22 }),
      mid: spikyLine(302, { base: 660, minH: 70, maxH: 190, step: 36 }),
      midTrees: midTrees.map((t) => t.d).join(" "),
      big: bigL.d + bigR.d,
      vines,
      ground: ridge(groundFn),
    };
  });

const EYES = [
  { x: 470, y: 640, s: 1, dur: "9s", delay: "-1s" },
  { x: 780, y: 690, s: 0.8, dur: "12s", delay: "-6s" },
  { x: 1060, y: 650, s: 0.9, dur: "10s", delay: "-3s" },
  { x: 250, y: 720, s: 1.2, dur: "13s", delay: "-9s" },
  { x: 1340, y: 700, s: 1.1, dur: "11s", delay: "-4.5s" },
  { x: 660, y: 600, s: 0.7, dur: "14s", delay: "-11s" },
];

function Area3({ night, lowQ }) {
  const g = A3();
  const C = night
    ? {
        sky: "linear-gradient(180deg, #04020a 0%, #120a1d 34%, #26143a 64%, #3a1f4a 100%)",
        far: "#2a1a38",
        mid: "#1f1229",
        midTree: "#150b1e",
        big: "#06030a",
        ground: "#09050e",
        vine: "#1d1226",
        mist: "rgba(138,85,181,0.75)",
        mist2: "rgba(90,50,130,0.8)",
      }
    : {
        sky: "linear-gradient(180deg, #181d16 0%, #2b3425 30%, #4a5538 58%, #767f55 80%, #8a8d62 100%)",
        far: "#46513a",
        mid: "#343e2a",
        midTree: "#252d1e",
        big: "#0f130c",
        ground: "#151a10",
        vine: "#2a3320",
        mist: "rgba(185,196,141,0.7)",
        mist2: "rgba(140,160,110,0.7)",
      };
  return (
    <>
      <Sky bg={C.sky} />
      {night ? (
        <>
          <StarLayers seed={331} n={36} y1={380} color="#e8d9ff" r1={1.4} />
          <Glow x={1180} y={170} w={380} h={380} bg="radial-gradient(closest-side, rgba(200,230,150,0.3), rgba(120,160,90,0.1) 55%, transparent)" anim="jb-breathe" dur="8s" />
        </>
      ) : (
        <Glow x={1140} y={250} w={620} h={520} bg="radial-gradient(closest-side, rgba(226,232,180,0.45), rgba(170,180,120,0.15) 55%, transparent)" anim="jb-breathe" dur="12s" />
      )}
      <StageSvg>
        {night ? <circle cx="1180" cy="170" r="38" fill="#d5dfae" opacity="0.85" /> : <circle cx="1140" cy="250" r="42" fill="#e8ecc4" opacity="0.55" />}
        <path d={g.far} fill={C.far} />
      </StageSvg>
      <MistBand y={520} h={120} color={C.mist} opacity={night ? 0.45 : 0.4} dur="46s" />
      <StageSvg>
        <path d={g.mid} fill={C.mid} />
        <path d={g.midTrees} fill={C.midTree} />
      </StageSvg>
      {night &&
        EYES.map((e, i) => (
          <div key={i} className="jb-abs jb-eyes" style={box(e.x, e.y, 34 * e.s, 12 * e.s, { animationDuration: e.dur, animationDelay: e.delay })}>
            <svg viewBox="0 0 34 12" preserveAspectRatio="none" aria-hidden="true">
              <ellipse cx="7" cy="6" rx="6" ry="4.2" fill={i % 3 === 1 ? "#ff5a4a" : "#f6e05a"} />
              <ellipse cx="27" cy="6" rx="6" ry="4.2" fill={i % 3 === 1 ? "#ff5a4a" : "#f6e05a"} />
              <ellipse cx="7" cy="6" rx="1.4" ry="3.6" fill="#140404" />
              <ellipse cx="27" cy="6" rx="1.4" ry="3.6" fill="#140404" />
            </svg>
          </div>
        ))}
      <MistBand y={640} h={130} color={C.mist2} opacity={night ? 0.5 : 0.35} from="6cqw" to="-8cqw" dur="38s" delay="-12s" />
      <StageSvg>
        <path d={g.ground} fill={C.ground} />
        <path d={g.big} fill={C.big} />
        <path d={g.vines} stroke={C.vine} strokeWidth="2.2" fill="none" strokeLinecap="round" />
      </StageSvg>
      <MistBand y={780} h={140} color={C.mist} opacity={night ? 0.32 : 0.28} dur="52s" delay="-20s" />
      {!night && !lowQ && (
        <>
          <Circler x={760} y={200} radius={120} dur="16s" size={34} color="#0c0f0a" />
          <Circler x={900} y={250} radius={80} dur="12s" delay="-5s" size={26} color="#12160f" reverse />
        </>
      )}
      {night && <Particles kind="wisp" n={9} seed={341} lowQ={lowQ} />}
    </>
  );
}

// ============================================================
//  ภูมิภาค 4 — คลื่นวงวนน้ำ
// ============================================================

const HORIZON4 = 440;
const A4 = () =>
  once("a4", () => {
    const rnd = seeded(401);
    const arms = Array.from({ length: 6 }, (_, i) => spiralArm(28, 640, 1.45, (i / 6) * Math.PI * 2));
    const inner = Array.from({ length: 4 }, (_, i) => spiralArm(10, 300, 1.1, (i / 4) * Math.PI * 2 + 0.4));
    const reflect = Array.from({ length: 30 }, (_, i) => {
      const t = i / 29;
      const w = 16 + t * 140 * (0.4 + rnd() * 0.6);
      return { x: f1(1200 - w / 2 + (rnd() - 0.5) * 30 * (1 + t * 2)), y: f1(HORIZON4 + 8 + t * t * 440 + rnd() * 6), w: f1(w), h: f1(1.5 + t * 3), g: i % 2 };
    });
    const rockL =
      "M -20 900 L -20 470 L 30 452 L 62 402 L 96 396 L 120 440 L 150 470 L 190 520 L 214 610 L 262 690 L 300 900 Z";
    const rockL2 = "M 180 900 L 196 700 L 232 660 L 262 672 L 300 740 L 330 900 Z";
    const rockR = "M 1620 900 L 1620 430 L 1580 420 L 1548 468 L 1520 470 L 1490 540 L 1440 600 L 1410 700 L 1380 900 Z";
    const arch = "M 1300 560 L 1310 480 L 1350 452 L 1398 470 L 1420 560 L 1400 560 Q 1380 506 1356 506 Q 1330 510 1322 560 Z";
    return { arms, inner, reflect, rockL, rockL2, rockR, arch };
  });

function Area4({ night, lowQ }) {
  const g = A4();
  const C = night
    ? {
        sky: "linear-gradient(180deg, #01040a 0%, #061226 45%, #0f2640 85%, #19324a 100%)",
        sea: "linear-gradient(180deg, #13334a 0%, #0c2336 22%, #07182a 60%, #040e1a 100%)",
        rock: "#050d16",
        rockHi: "#0d1d2c",
        foam: "rgba(120,220,230,0.35)",
        arm: "rgba(100,235,220,0.5)",
        armThin: "rgba(170,250,240,0.6)",
        disc: "radial-gradient(closest-side, #01060c 0%, #03121e 22%, #0a2a3c 46%, rgba(20,70,95,0.55) 70%, transparent 100%)",
        wave: "rgba(140,200,230,0.28)",
      }
    : {
        sky: "linear-gradient(180deg, #23527a 0%, #4b83a4 40%, #97bcca 78%, #cadbd6 100%)",
        sea: "linear-gradient(180deg, #4b93a6 0%, #2b7189 20%, #185570 55%, #0c3650 100%)",
        rock: "#1c3440",
        rockHi: "#2f4d5a",
        foam: "rgba(255,255,255,0.55)",
        arm: "rgba(225,248,255,0.5)",
        armThin: "rgba(255,255,255,0.7)",
        disc: "radial-gradient(closest-side, #031822 0%, #0a3346 24%, #16586f 48%, rgba(40,120,145,0.5) 72%, transparent 100%)",
        wave: "rgba(235,250,255,0.4)",
      };
  return (
    <>
      <Sky bg={C.sky} />
      <div className="jb-abs" style={box(0, HORIZON4, SW, SH - HORIZON4, { background: C.sea })} />
      {night ? (
        <>
          <StarLayers seed={411} n={80} y1={HORIZON4 - 10} />
          <Glow x={1200} y={160} w={420} h={420} bg="radial-gradient(closest-side, rgba(230,240,255,0.36), rgba(120,160,230,0.12) 55%, transparent)" anim="jb-breathe" dur="9s" />
        </>
      ) : (
        <>
          <Glow x={300} y={120} w={700} h={520} bg="radial-gradient(closest-side, rgba(255,250,230,0.6), rgba(200,230,240,0.2) 50%, transparent)" anim="jb-breathe" dur="12s" />
          <Cloud seed={421} x={560} y={70} w={520} h={130} fill="#eef3f7" shade="#8fa5b8" opacity={0.85} dur="70s" from="-8cqw" to="6cqw" />
          <Cloud seed={422} x={1100} y={170} w={400} h={110} fill="#e4ecf2" shade="#8599ad" opacity={0.8} dur="60s" delay="-25s" />
          <Cloud seed={423} x={40} y={230} w={320} h={80} fill="#f0f6fa" shade="#a9bccb" opacity={0.65} dur="80s" delay="-10s" />
        </>
      )}
      <StageSvg>
        {night && <circle cx="1200" cy="160" r="42" fill="#eef2fb" />}
        <rect x="0" y={HORIZON4 - 1} width={SW} height="3" fill={night ? "rgba(150,190,230,0.25)" : "rgba(255,255,255,0.35)"} />
        <path d={g.arch} fill={C.rock} opacity="0.85" />
      </StageSvg>
      {night && (
        <>
          <div className="jb-abs jb-shimmer" style={box(1080, HORIZON4, 240, SH - HORIZON4)}>
            <svg viewBox={`1080 ${HORIZON4} 240 ${SH - HORIZON4}`} preserveAspectRatio="none" aria-hidden="true">
              {g.reflect.filter((r) => r.g === 0).map((r, i) => (
                <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} rx={r.h / 2} fill="#dfe9ff" opacity="0.55" />
              ))}
            </svg>
          </div>
          <div className="jb-abs jb-shimmer" style={box(1080, HORIZON4, 240, SH - HORIZON4, { animationDelay: "-1.6s" })}>
            <svg viewBox={`1080 ${HORIZON4} 240 ${SH - HORIZON4}`} preserveAspectRatio="none" aria-hidden="true">
              {g.reflect.filter((r) => r.g === 1).map((r, i) => (
                <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} rx={r.h / 2} fill="#dfe9ff" opacity="0.55" />
              ))}
            </svg>
          </div>
        </>
      )}
      <div className="jb-abs jb-slide" style={box(0, HORIZON4 + 6, SW * 2, 24, { animationDuration: "60s" })}>
        <svg viewBox={`0 0 ${SW * 2} 24`} preserveAspectRatio="none" aria-hidden="true">
          <path d={waveStrip(64, 24, 5)} stroke={C.wave} strokeWidth="1.5" fill="none" />
        </svg>
      </div>
      <div className="jb-abs jb-slide" style={box(0, 500, SW * 2, 40, { animationDuration: "44s", animationDirection: "reverse" })}>
        <svg viewBox={`0 0 ${SW * 2} 40`} preserveAspectRatio="none" aria-hidden="true">
          <path d={waveStrip(100, 40, 8)} stroke={C.wave} strokeWidth="2" fill="none" />
        </svg>
      </div>
      {/* วังวนน้ำ: กล่องสี่เหลี่ยมจัตุรัสถูกบีบแนวตั้ง (static) แล้วหมุนชั้นใน (compositor ล้วน) */}
      <div className="jb-abs" style={box(930 - 680, 650 - 680, 1360, 1360, { transform: "scaleY(0.3)" })}>
        <div className="jb-fill" style={{ background: C.disc, borderRadius: "50%" }} />
        <div className="jb-fill jb-spin" style={{ animationDuration: "34s" }}>
          <svg viewBox="-680 -680 1360 1360" aria-hidden="true">
            {g.arms.map((d, i) => (
              <path key={i} d={d} stroke={C.arm} strokeWidth={i % 2 ? 7 : 12} fill="none" strokeLinecap="round" opacity={i % 2 ? 0.6 : 0.4} />
            ))}
          </svg>
        </div>
        <div className="jb-fill" style={{ transform: "scale(0.55)" }}>
          <div className="jb-fill jb-spin" style={{ animationDuration: "15s" }}>
            <svg viewBox="-680 -680 1360 1360" aria-hidden="true">
              {g.inner.map((d, i) => (
                <path key={i} d={d} stroke={C.armThin} strokeWidth="9" fill="none" strokeLinecap="round" opacity="0.55" />
              ))}
            </svg>
          </div>
        </div>
        <div className="jb-fill" style={{ background: "radial-gradient(closest-side, #01070c 0%, rgba(1,7,12,0.85) 9%, transparent 16%)" }} />
      </div>
      <div className="jb-abs jb-slide" style={box(0, 800, SW * 2, 70, { animationDuration: "30s" })}>
        <svg viewBox={`0 0 ${SW * 2} 70`} preserveAspectRatio="none" aria-hidden="true">
          <path d={waveStrip(160, 70, 16)} stroke={C.wave} strokeWidth="3" fill="none" />
        </svg>
      </div>
      <StageSvg>
        <path d={g.rockL} fill={C.rock} />
        <path d="M 30 452 L 62 402 L 96 396 L 120 440 L 92 430 L 70 444 Z" fill={C.rockHi} />
        <path d={g.rockL2} fill={C.rock} />
        <path d={g.rockR} fill={C.rock} />
        <path d="M 1580 420 L 1548 468 L 1566 462 L 1600 446 Z" fill={C.rockHi} />
        <path d="M 150 700 q 40 -14 80 0 M 1390 720 q 40 -12 80 0 M 240 860 q 50 -16 100 0" stroke={C.foam} strokeWidth="5" fill="none" strokeLinecap="round" />
      </StageSvg>
      {!night && !lowQ && (
        <>
          <Bird y={260} dur="30s" delay="-3s" color="#f2f5f7" size={30} rise="-4cqh" />
          <Bird y={300} dur="36s" delay="-19s" color="#e8eef2" size={24} rise="-8cqh" />
          <Bird y={220} dur="42s" delay="-30s" color="#f2f5f7" size={22} rise="2cqh" />
        </>
      )}
    </>
  );
}

// ============================================================
//  ภูมิภาค 5 — ทะเลทรายไม่อาจหวนคืน
// ============================================================

const A5 = () =>
  once("a5", () => {
    const farFn = wave(501, 596, [[18, 160], [28, 400]]);
    const midFn = wave(502, 668, [[32, 210], [16, 120]]);
    const nearFn = wave(503, 770, [[38, 260], [16, 110]]);
    const frontFn = wave(504, 866, [[28, 200], [10, 80]]);
    const ruinY = midFn(380);
    return {
      far: ridge(farFn),
      mid: ridge(midFn),
      near: ridge(nearFn),
      front: ridge(frontFn),
      farL: ridgeLine(farFn),
      midL: ridgeLine(midFn),
      nearL: ridgeLine(nearFn),
      frontL: ridgeLine(frontFn),
      shades: [farFn, midFn, nearFn, frontFn].map((fn, i) => shadeBand(fn, { dx: 90 + i * 30, dy: 4 })),
      ruinY,
    };
  });

function DesertRuins({ y, fill }) {
  return (
    <g transform={`translate(380 ${f1(y)})`} fill={fill}>
      <path d="M -120 10 L -120 -120 L -112 -128 L -100 -118 L -96 -10 Z" />
      <path d="M -70 10 L -72 -176 L -58 -186 L -44 -170 L -48 10 Z" />
      <path d="M -10 10 L -8 -92 L 6 -104 L 14 -86 L 16 10 Z" />
      <path d="M 40 10 L 40 -150 Q 90 -210 140 -150 L 140 10 L 118 10 L 118 -136 Q 90 -172 62 -136 L 62 10 Z" />
      <rect x="-160" y="-6" width="120" height="16" transform="rotate(-8 -100 0)" />
      <path d="M 150 10 L 160 -40 L 176 -36 L 170 10 Z" />
    </g>
  );
}

function Area5({ night, lowQ }) {
  const g = A5();
  const uid = night ? "a5n" : "a5d";
  const C = night
    ? {
        sky: "linear-gradient(180deg, #010209 0%, #070b22 40%, #171b42 75%, #2a2850 100%)",
        dunes: [["#30335c", "#1f2140"], ["#272a52", "#181a33"], ["#1d1f3e", "#101226"], ["#13142c", "#08091a"]],
        crest: "#9aa3e0",
        crestOp: 0.4,
        shade: "#04050e",
        shadeOp: 0.45,
        ruin: "#121429",
      }
    : {
        sky: "linear-gradient(180deg, #8c3f1f 0%, #c46a32 24%, #e39a50 50%, #f2c47c 74%, #f7dca4 100%)",
        dunes: [["#ecb678", "#d99a5a"], ["#e19550", "#bd7236"], ["#c9793a", "#9a5427"], ["#a85b2a", "#6e3717"]],
        crest: "#ffe6b0",
        crestOp: 0.65,
        shade: "#6e2f12",
        shadeOp: 0.32,
        ruin: "#94552a",
      };
  const layers = [g.far, g.mid, g.near, g.front];
  const crests = [g.farL, g.midL, g.nearL, g.frontL];
  return (
    <>
      <Sky bg={C.sky} />
      {night ? (
        <>
          <div className="jb-abs" style={box(-200, -200, 2000, 360, { transform: "rotate(-18deg)", background: "radial-gradient(ellipse 50% 50% at 50% 50%, rgba(200,200,255,0.3), rgba(130,120,210,0.12) 55%, transparent 75%)" })} />
          <StarLayers seed={511} n={130} y1={560} r1={1.6} />
          <Glow x={360} y={190} w={380} h={380} bg="radial-gradient(closest-side, rgba(210,225,255,0.3), transparent)" anim="jb-breathe" dur="9s" />
          <ShootingStar x={1000} y={60} angle={32} dur="9s" delay="-2s" />
          <ShootingStar x={300} y={40} angle={20} dur="15s" delay="-9s" />
        </>
      ) : (
        <>
          <Glow x={1160} y={200} w={1100} h={900} bg="radial-gradient(closest-side, rgba(255,246,220,0.85), rgba(255,200,120,0.35) 40%, transparent)" anim="jb-breathe" dur="7s" />
          <Glow x={1160} y={200} w={320} h={320} bg="radial-gradient(closest-side, transparent 55%, rgba(255,250,230,0.5) 62%, transparent 70%)" anim="jb-pulse" dur="5s" />
          <Glow x={800} y={590} w={1900} h={160} bg="radial-gradient(closest-side, rgba(255,240,205,0.55), transparent)" anim="jb-breathe" dur="6s" />
        </>
      )}
      <StageSvg>
        <defs>
          {C.dunes.map(([a, b], i) => (
            <linearGradient key={i} id={`${uid}${i}`} x1="0" y1="0" x2="0.35" y2="1">
              <stop offset="0" stopColor={a} />
              <stop offset="1" stopColor={b} />
            </linearGradient>
          ))}
        </defs>
        {night ? <path d={crescent(360, 190, 40, 0.4, 30)} fill="#e6ecfb" /> : <circle cx="1160" cy="200" r="72" fill="#fff6dc" />}
        <path d={layers[0]} fill={`url(#${uid}0)`} />
        <path d={g.shades[0]} fill={C.shade} opacity={C.shadeOp} />
        <path d={crests[0]} stroke={C.crest} strokeWidth="1.5" fill="none" opacity={C.crestOp} />
        <path d={layers[1]} fill={`url(#${uid}1)`} />
        <path d={g.shades[1]} fill={C.shade} opacity={C.shadeOp} />
        <DesertRuins y={g.ruinY} fill={C.ruin} />
        <path d={crests[1]} stroke={C.crest} strokeWidth="2" fill="none" opacity={C.crestOp} />
      </StageSvg>
      {!night && (
        <>
          <div className="jb-abs jb-haze" style={box(0, 540, SW, 60, { animationDuration: "3.2s" })} />
          <div className="jb-abs jb-haze" style={box(0, 610, SW, 50, { animationDuration: "2.6s", animationDelay: "-1.1s" })} />
        </>
      )}
      <StageSvg>
        <path d={layers[2]} fill={`url(#${uid}2)`} />
        <path d={g.shades[2]} fill={C.shade} opacity={C.shadeOp} />
        <path d={crests[2]} stroke={C.crest} strokeWidth="2.5" fill="none" opacity={C.crestOp} />
        <path d={layers[3]} fill={`url(#${uid}3)`} />
        <path d={g.shades[3]} fill={C.shade} opacity={C.shadeOp} />
        <path d={crests[3]} stroke={C.crest} strokeWidth="3" fill="none" opacity={C.crestOp * 0.8} />
      </StageSvg>
      <MistBand y={700} h={150} color={night ? "rgba(140,150,220,0.4)" : "rgba(240,200,140,0.7)"} opacity={night ? 0.22 : 0.3} from="-14cqw" to="10cqw" dur="22s" />
      {!night && !lowQ && <Circler x={560} y={170} radius={90} dur="20s" size={40} color="#3a1c0c" />}
      <Particles kind={night ? "sandNight" : "sand"} n={night ? 10 : 24} seed={night ? 531 : 532} lowQ={lowQ} />
    </>
  );
}

// ============================================================
//  ภูมิภาค 6 — อาณาจักรน้ำแข็ง (หิมะตกทั้งกลางวันและกลางคืน)
// ============================================================

const SPIRES = [
  { dx: -210, w: 30, h: 150 },
  { dx: -160, w: 42, h: 230 },
  { dx: -100, w: 50, h: 300 },
  { dx: -40, w: 58, h: 380 },
  { dx: 22, w: 76, h: 470 },
  { dx: 88, w: 54, h: 340 },
  { dx: 146, w: 46, h: 260 },
  { dx: 196, w: 34, h: 180 },
  { dx: 240, w: 26, h: 120 },
];
const CASTLE6 = { x: 1060, y: 690 };

const A6 = () =>
  once("a6", () => ({
    far: peaks(601, { base: 600, minH: 150, maxH: 320, minW: 170, maxW: 320, cap: 0.4 }),
    mid: peaks(602, { base: 680, minH: 60, maxH: 170, minW: 120, maxW: 220, cap: 0.45 }),
    bank: ridge(wave(603, 842, [[16, 120], [24, 300]])),
    bankHi: ridgeLine(wave(603, 842, [[16, 120], [24, 300]])),
    shore: ridge(wave(604, 700, [[6, 80], [10, 200]]), { bottom: 712 }),
  }));

function IceCastle({ night, lit }) {
  const L = night ? "#1d4466" : "#e2f2fc";
  const R = night ? "#102c47" : "#8fc3e4";
  const edge = night ? "rgba(140,220,255,0.35)" : "rgba(255,255,255,0.8)";
  const win = night ? "#8ff3ff" : "#5d98c0";
  return (
    <g transform={`translate(${CASTLE6.x} ${CASTLE6.y})`}>
      <path d="M -250 0 L -250 -70 L 262 -70 L 262 0 Z" fill={R} />
      <path d="M -250 0 L -250 -70 L 0 -70 L 0 0 Z" fill={L} opacity="0.9" />
      {Array.from({ length: 20 }, (_, i) => (
        <path key={i} d={`M ${-250 + i * 26} -70 L ${-237 + i * 26} -92 L ${-224 + i * 26} -70 Z`} fill={i < 10 ? L : R} />
      ))}
      {SPIRES.map((s) => {
        const x0 = s.dx - s.w / 2;
        const x1 = s.dx + s.w / 2;
        const sh = -s.h * 0.78;
        return (
          <g key={s.dx}>
            <path d={`M ${x0} 0 L ${x0} ${sh} L ${s.dx} ${-s.h} L ${s.dx} 0 Z`} fill={L} />
            <path d={`M ${s.dx} 0 L ${s.dx} ${-s.h} L ${x1} ${sh} L ${x1} 0 Z`} fill={R} />
            <path d={`M ${x0} ${sh} L ${s.dx} ${-s.h} L ${x1} ${sh}`} stroke={edge} strokeWidth="1.5" fill="none" />
            {lit &&
              [0.3, 0.5].map((k) => (
                <path key={k} d={`M ${s.dx - 4} ${-s.h * k} L ${s.dx} ${-s.h * k - 12} L ${s.dx + 4} ${-s.h * k} L ${s.dx + 4} ${-s.h * k + 10} L ${s.dx - 4} ${-s.h * k + 10} Z`} fill={win} opacity={night ? 1 : 0.6} />
              ))}
          </g>
        );
      })}
      <path d="M -26 0 L -26 -40 L 0 -62 L 26 -40 L 26 0 Z" fill={night ? "#071a2c" : "#4d87b0"} />
    </g>
  );
}

const GLINTS = [
  { x: CASTLE6.x + 22, y: CASTLE6.y - 470, d: "0s" },
  { x: CASTLE6.x - 40, y: CASTLE6.y - 380, d: "-1.3s" },
  { x: CASTLE6.x + 88, y: CASTLE6.y - 340, d: "-2.1s" },
  { x: CASTLE6.x - 160, y: CASTLE6.y - 230, d: "-0.7s" },
  { x: CASTLE6.x + 196, y: CASTLE6.y - 180, d: "-2.8s" },
];

function Area6({ night, lowQ }) {
  const g = A6();
  const uid = night ? "a6n" : "a6d";
  const C = night
    ? {
        sky: "linear-gradient(180deg, #010309 0%, #04102a 40%, #0a2340 74%, #143552 100%)",
        far: "#15294a",
        farCap: "#5b7ea4",
        mid: "#10223c",
        midCap: "#48698e",
        shore: "#0e2036",
        lake: ["#0d2a44", "#07182a"],
        bank: "#9fb6cc",
        bankHi: "#d8ecff",
      }
    : {
        sky: "linear-gradient(180deg, #4b76a3 0%, #82a8ca 36%, #bad3e6 70%, #e0ecf4 100%)",
        far: "#8cabc8",
        farCap: "#eef5fb",
        mid: "#6d93b6",
        midCap: "#e8f1f8",
        shore: "#c7dceb",
        lake: ["#a8c8dc", "#6f9ab8"],
        bank: "#e6f0f6",
        bankHi: "#ffffff",
      };
  return (
    <>
      <Sky bg={C.sky} />
      {night ? (
        <>
          <StarLayers seed={611} n={80} y1={440} />
          <div className="jb-abs jb-aurora" style={box(-100, 10, 1100, 380, { animationDuration: "16s" })}>
            <svg viewBox="0 0 1100 380" preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <linearGradient id={`${uid}au1`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#7cf5c8" stopOpacity="0" />
                  <stop offset="0.45" stopColor="#5ef0b0" stopOpacity="0.55" />
                  <stop offset="1" stopColor="#3fb8ff" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d="M 0 150 C 180 60 320 220 520 130 C 700 50 880 190 1100 110 L 1100 300 C 880 360 700 230 520 320 C 320 400 180 250 0 330 Z" fill={`url(#${uid}au1)`} />
            </svg>
          </div>
          <div className="jb-abs jb-aurora" style={box(640, 40, 1100, 340, { animationDuration: "21s", animationDelay: "-8s" })}>
            <svg viewBox="0 0 1100 340" preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <linearGradient id={`${uid}au2`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#c58bff" stopOpacity="0" />
                  <stop offset="0.5" stopColor="#8f7bff" stopOpacity="0.45" />
                  <stop offset="1" stopColor="#5ee8ff" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d="M 0 120 C 220 40 380 190 600 100 C 800 30 940 150 1100 90 L 1100 260 C 940 320 800 200 600 280 C 380 360 220 220 0 300 Z" fill={`url(#${uid}au2)`} />
            </svg>
          </div>
          <div className="jb-abs jb-aurora" style={box(300, 80, 900, 260, { animationDuration: "13s", animationDelay: "-4s" })}>
            <svg viewBox="0 0 900 260" preserveAspectRatio="none" aria-hidden="true">
              <path d="M 0 110 C 160 50 300 160 460 90 C 620 30 760 120 900 70 L 900 180 C 760 230 620 140 460 200 C 300 260 160 170 0 220 Z" fill={`url(#${uid}au1)`} opacity="0.7" />
            </svg>
          </div>
        </>
      ) : (
        <>
          <Glow x={420} y={200} w={700} h={600} bg="radial-gradient(closest-side, rgba(255,255,255,0.6), rgba(220,235,250,0.2) 50%, transparent)" anim="jb-breathe" dur="10s" />
          <div className="jb-abs jb-rays" style={box(120, -160, 700, 800)}>
            <svg viewBox="0 0 700 800" preserveAspectRatio="none" aria-hidden="true">
              <path d="M 300 0 L 360 0 L 560 800 L 420 800 Z" fill="#ffffff" opacity="0.1" />
              <path d="M 380 0 L 410 0 L 700 800 L 630 800 Z" fill="#ffffff" opacity="0.08" />
              <path d="M 220 0 L 250 0 L 250 800 L 150 800 Z" fill="#ffffff" opacity="0.07" />
            </svg>
          </div>
        </>
      )}
      <StageSvg>
        <defs>
          <linearGradient id={`${uid}lake`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={C.lake[0]} />
            <stop offset="1" stopColor={C.lake[1]} />
          </linearGradient>
        </defs>
        {!night && <circle cx="420" cy="200" r="40" fill="#fbfdff" opacity="0.9" />}
        <path d={g.far.d} fill={C.far} />
        <path d={g.far.caps} fill={C.farCap} opacity={night ? 0.55 : 0.95} />
        <path d={g.mid.d} fill={C.mid} />
        <path d={g.mid.caps} fill={C.midCap} opacity={night ? 0.5 : 0.9} />
        <rect x="0" y="700" width={SW} height="200" fill={`url(#${uid}lake)`} />
        <g transform="translate(0 1400) scale(1 -1)" opacity={night ? 0.22 : 0.28}>
          <IceCastle night={night} lit={night} />
        </g>
        {night && <rect x="0" y="700" width={SW} height="200" fill="rgba(94,240,176,0.05)" />}
        <path d={g.shore} fill={C.shore} />
        <IceCastle night={night} lit />
        <path d="M 200 760 L 520 750 M 700 790 L 1100 780 M 1200 740 L 1480 736" stroke={night ? "rgba(140,220,255,0.18)" : "rgba(255,255,255,0.55)"} strokeWidth="2" />
        <path d={g.bank} fill={C.bank} />
        <path d={g.bankHi} stroke={C.bankHi} strokeWidth="3" fill="none" opacity="0.8" />
      </StageSvg>
      {night && (
        <Glow x={CASTLE6.x} y={CASTLE6.y - 200} w={640} h={520} bg="radial-gradient(closest-side, rgba(120,230,255,0.2), transparent)" anim="jb-breathe" dur="6s" />
      )}
      {GLINTS.map((s, i) => (
        <div key={i} className="jb-abs jb-glint" style={box(s.x - 14, s.y - 14, 28, 28, { animationDelay: s.d })}>
          <svg viewBox="-14 -14 28 28" aria-hidden="true">
            <path d="M 0 -14 L 2 -2 L 14 0 L 2 2 L 0 14 L -2 2 L -14 0 L -2 -2 Z" fill={night ? "#b8f6ff" : "#ffffff"} />
          </svg>
        </div>
      ))}
      <div className="jb-parts" aria-hidden="true">
        <div className={`jb-snowsheet s1${night ? " is-night" : ""}`} />
        <div className={`jb-snowsheet s2${night ? " is-night" : ""}`} />
      </div>
      <Particles kind={night ? "snowNight" : "snow"} n={night ? 52 : 60} seed={night ? 631 : 632} lowQ={lowQ} />
    </>
  );
}

// ============================================================
//  ภูมิภาค 7 — จุดสิ้นสุดของโลก (แดง-ดำ ไฟลุก น่ากลัว)
// ============================================================

const SKYLINE7 = 640;
const A7 = () =>
  once("a7", () => {
    const rnd = seeded(701);
    let d = `M -20 ${SH + 20} L -20 ${SKYLINE7}`;
    const holes = [];
    let x = -20;
    while (x < SW + 20) {
      const w = 34 + rnd() * 92;
      const tall = rnd() < 0.2;
      const h = (tall ? 170 : 40) + rnd() * (tall ? 150 : 150);
      const top = SKYLINE7 - h;
      d += ` L ${f1(x)} ${f1(SKYLINE7 - rnd() * 8)} L ${f1(x + rnd() * 4)} ${f1(top + rnd() * 24)}`;
      const jags = 2 + Math.floor(rnd() * 3);
      for (let j = 1; j <= jags; j++) d += ` L ${f1(x + (w * j) / (jags + 1))} ${f1(top + (rnd() - 0.25) * h * 0.4)}`;
      d += ` L ${f1(x + w - rnd() * 4)} ${f1(top + rnd() * 36)} L ${f1(x + w)} ${f1(SKYLINE7 - rnd() * 6)}`;
      if (w > 50 && h > 100) {
        for (let k = 0; k < 3; k++) {
          if (rnd() < 0.55) holes.push({ x: f1(x + 10 + rnd() * (w - 24)), y: f1(top + 30 + rnd() * (h - 50)), w: f1(5 + rnd() * 5), h: f1(8 + rnd() * 8) });
        }
      }
      x += w + (rnd() < 0.3 ? 8 + rnd() * 30 : 0);
      d += ` L ${f1(x)} ${f1(SKYLINE7 - rnd() * 10)}`;
    }
    d += ` L ${SW + 20} ${SH + 20} Z`;
    const cracks = [
      crackPath(711, 140, 40, 620, 300, { seg: 10, jag: 30, branches: 4 }),
      crackPath(712, 1560, 20, 1040, 250, { seg: 9, jag: 26, branches: 3 }),
      crackPath(713, 760, -10, 860, 170, { seg: 6, jag: 18, branches: 2 }),
    ];
    const lava = [
      crackPath(721, -10, 842, 520, 870, { seg: 10, jag: 12, branches: 3 }),
      crackPath(722, 700, 900, 1080, 846, { seg: 8, jag: 10, branches: 2 }),
      crackPath(723, 1120, 860, 1620, 830, { seg: 9, jag: 14, branches: 3 }),
    ].join(" ");
    const moonCracks = [
      crackPath(731, 1180, 220, 1090, 130, { seg: 5, jag: 10, branches: 1 }),
      crackPath(732, 1180, 220, 1290, 260, { seg: 5, jag: 10, branches: 1 }),
      crackPath(733, 1180, 220, 1150, 335, { seg: 5, jag: 8, branches: 1 }),
    ].join(" ");
    const skyFlames = Array.from({ length: 16 }, (_, i) => ({
      x: f1(-20 + (i + rnd() * 0.6) * 104),
      w: f1(50 + rnd() * 50),
      h: f1(70 + rnd() * 90),
      dur: `${f1(0.9 + rnd() * 0.8)}s`,
      delay: `${f1(-rnd() * 2)}s`,
      v: i % 2,
    }));
    const bigFlames = [
      { x: 40, w: 150, h: 380 },
      { x: 150, w: 120, h: 290 },
      { x: 250, w: 110, h: 230 },
      { x: 340, w: 90, h: 160 },
      { x: 1270, w: 90, h: 170 },
      { x: 1370, w: 120, h: 260 },
      { x: 1480, w: 150, h: 360 },
      { x: 1580, w: 120, h: 300 },
    ].map((f, i) => ({ ...f, dur: `${f1(1.1 + rnd() * 0.7)}s`, delay: `${f1(-rnd() * 2)}s`, v: i % 2 }));
    return {
      skyline: d,
      holes,
      cracks,
      lava,
      moonCracks,
      skyFlames,
      bigFlames,
      mid: ridge(wave(741, 730, [[18, 70], [26, 180]]), { smooth: false, step: 26 }),
      front: ridge(wave(742, 846, [[14, 60], [20, 170]]), { smooth: false, step: 30 }),
    };
  });

function Area7({ night, lowQ }) {
  const g = A7();
  const uid = night ? "a7n" : "a7d";
  const C = night
    ? {
        sky: "linear-gradient(180deg, #000000 0%, #070001 30%, #1d0203 60%, #3e0506 84%, #5a0808 100%)",
        skyline: "#040000",
        hole: "#ff3212",
        mid: "#030000",
        front: "#010000",
        crack: ["rgba(255,30,20,0.28)", "#ff3a1c", "#ffb08a"],
        flame: ["#8e0a06", "#e8330f", "#ffb347"],
        big: ["#7a0804", "#d92a0c", "#ffc05a"],
        smoke: "rgba(8,0,0,0.9)",
      }
    : {
        sky: "linear-gradient(180deg, #040101 0%, #1a0304 22%, #450808 45%, #871a0c 68%, #bf3c19 86%, #d85a1e 100%)",
        skyline: "#140304",
        hole: "#ff7a26",
        mid: "#0c0203",
        front: "#050101",
        crack: ["rgba(255,90,30,0.25)", "#ff6a26", "#ffd9a0"],
        flame: ["#a3140a", "#ff5a1a", "#ffd27a"],
        big: ["#8f1208", "#f0501a", "#ffdb8a"],
        smoke: "rgba(22,4,4,0.85)",
      };
  return (
    <>
      <Sky bg={C.sky} />
      {night ? (
        <>
          <StarLayers seed={751} n={40} y1={420} color="#ff9a8a" r1={1.3} />
          <Glow x={1180} y={220} w={620} h={620} bg="radial-gradient(closest-side, rgba(200,20,15,0.5), rgba(120,5,5,0.2) 50%, transparent)" anim="jb-pulse" dur="4.5s" />
        </>
      ) : (
        <Glow x={800} y={640} w={2000} h={520} bg="radial-gradient(closest-side, rgba(255,110,40,0.45), rgba(200,40,10,0.18) 55%, transparent)" anim="jb-breathe" dur="4s" />
      )}
      <Smoke x={-160} y={20} w={960} h={300} color={C.smoke} dur="46s" from="-4cqw" to="8cqw" />
      <Smoke x={820} y={-40} w={960} h={280} color={C.smoke} dur="58s" delay="-20s" from="6cqw" to="-6cqw" />
      <Smoke x={300} y={330} w={1100} h={200} color={C.smoke} opacity={0.6} dur="40s" delay="-8s" from="-5cqw" to="5cqw" />
      <StageSvg>
        <defs>
          <radialGradient id={`${uid}moon`} cx="0.42" cy="0.4" r="0.65">
            <stop offset="0" stopColor="#c8261a" />
            <stop offset="0.6" stopColor="#7a0a08" />
            <stop offset="1" stopColor="#3a0202" />
          </radialGradient>
        </defs>
        {night && (
          <g>
            <circle cx="1180" cy="220" r="118" fill={`url(#${uid}moon)`} />
            <circle cx="1140" cy="190" r="26" fill="#5a0505" opacity="0.6" />
            <circle cx="1216" cy="262" r="18" fill="#5a0505" opacity="0.55" />
            <circle cx="1222" cy="176" r="12" fill="#5a0505" opacity="0.5" />
            <path d={g.moonCracks} stroke="#1a0000" strokeWidth="4" fill="none" />
            <path d={g.moonCracks} stroke="#ff5a2a" strokeWidth="1.2" fill="none" opacity="0.8" />
          </g>
        )}
      </StageSvg>
      {g.cracks.map((d, i) => (
        <div key={i} className="jb-abs jb-flicker" style={box(0, 0, SW, 360, { animationDuration: `${3 + i * 1.3}s`, animationDelay: `${-i * 0.9}s` })}>
          <svg viewBox={`0 0 ${SW} 360`} preserveAspectRatio="none" aria-hidden="true">
            <path d={d} stroke={C.crack[0]} strokeWidth="14" fill="none" strokeLinejoin="round" />
            <path d={d} stroke={C.crack[1]} strokeWidth="4" fill="none" strokeLinejoin="round" />
            <path d={d} stroke={C.crack[2]} strokeWidth="1.3" fill="none" strokeLinejoin="round" />
          </svg>
        </div>
      ))}
      {g.skyFlames.map((f, i) => (
        <Flame key={i} x={f.x} base={SKYLINE7 + 6} w={f.w} h={f.h} dur={f.dur} delay={f.delay} colors={C.flame} variant={f.v} />
      ))}
      <StageSvg>
        <path d={g.skyline} fill={C.skyline} />
        <g fill={C.hole} opacity="0.65">
          {g.holes.map((h, i) => (
            <rect key={i} x={h.x} y={h.y} width={h.w} height={h.h} />
          ))}
        </g>
        <path d="M 150 900 L 172 430 L 206 392 L 214 410 L 238 366 L 252 440 L 262 900 Z" fill={C.mid} />
        <path d="M 1360 900 L 1372 520 L 1392 500 L 1404 530 L 1420 480 L 1436 540 L 1444 900 Z" fill={C.mid} />
        <path d={g.mid} fill={C.mid} />
        <path d={g.front} fill={C.front} />
        <path d={g.lava} stroke={C.crack[0]} strokeWidth="12" fill="none" />
        <path d={g.lava} stroke={C.crack[1]} strokeWidth="3" fill="none" />
      </StageSvg>
      <Glow x={800} y={900} w={1800} h={260} bg="radial-gradient(closest-side, rgba(255,80,20,0.4), transparent)" anim="jb-pulse" dur="3.4s" />
      {g.bigFlames.map((f, i) => (
        <Flame key={i} x={f.x} base={SH + 20} w={f.w} h={f.h} dur={f.dur} delay={f.delay} colors={C.big} variant={f.v} />
      ))}
      {night && <div className="jb-abs jb-flash" style={box(0, 0, SW, SH)} />}
      <Particles kind="ember" n={night ? 30 : 26} seed={night ? 771 : 772} lowQ={lowQ} />
      {!night && <Particles kind="ash" n={12} seed={773} lowQ={lowQ} />}
    </>
  );
}

// ============================================================

const AREAS = [Area1, Area2, Area3, Area4, Area5, Area6, Area7];

function JourneyScene({ area, night, lowQ }) {
  const Area = AREAS[Math.min(7, Math.max(1, area)) - 1];
  return (
    <div className="jb-stage">
      <Area night={night} lowQ={lowQ} />
    </div>
  );
}

export default memo(JourneyScene);
