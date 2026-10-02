// ============================================================
//  ภาพวาดในสนาม (พอร์ตจากต้นแบบ SVG)
//   - StandArt = ของตั้งบนพื้น (ปราสาท ต้นไม้ เสา ...)
//   - FxArt    = เอฟเฟกต์ลอยบนจอ (เนื้อในเท่านั้น กรอบตำแหน่ง/อนิเมชันผู้เรียกวาดเอง)
//   - ForeArt  = ของบังหน้ากล้อง (เนื้อในเท่านั้น)
//  keyframes (arSpin, arPulse, ...) อยู่ใน arena.css
// ============================================================

import { memo } from "react";
import { EXTRA_ART } from "./areas";

const FULL = { width: "100%", height: "100%" };
const SVG_A11Y = { "aria-hidden": "true", focusable: "false" };

// svg มาตรฐานของของตั้ง: ยึดก้นภาพไว้กับพื้น
export function Stand({ vb, par = "xMidYMax meet", children }) {
  return (
    <svg viewBox={vb} width="100%" height="100%" preserveAspectRatio={par} {...SVG_A11Y}>
      {children}
    </svg>
  );
}

function Plain({ vb, children }) {
  return (
    <svg viewBox={vb} width="100%" height="100%" {...SVG_A11Y}>
      {children}
    </svg>
  );
}

// ---------- ของตั้ง ----------
function StandArtBase({ s }) {
  switch (s.kind) {
    case "Hills":
      return (
        <Stand vb="0 0 3400 420" par="none">
          <path d="M0 420 L0 230 C300 140 520 120 800 190 C1050 250 1250 110 1600 120 C1900 130 2100 230 2400 190 C2700 150 2950 90 3400 170 L3400 420 Z" fill={s.h1 || "#cfe0ef"} />
          <path d="M0 420 L0 300 C400 240 700 250 1000 290 C1400 330 1700 250 2100 260 C2500 270 2900 330 3400 280 L3400 420 Z" fill={s.h2 || "#b8d1e6"} />
        </Stand>
      );
    case "Castle":
      return (
        <Stand vb="0 0 1000 680">
          <rect x="120" y="430" width="760" height="250" fill="#f5f7fa" />
          <rect x="500" y="430" width="380" height="250" fill="#e2e9f1" />
          <path d="M120 430 V405 H160 V430 H200 V405 H240 V430 H280 V405 H320 V430 H680 V405 H720 V430 H760 V405 H800 V430 H840 V405 H880 V430 Z" fill="#eef2f6" />
          <rect x="60" y="300" width="140" height="380" fill="#f8fafc" />
          <rect x="130" y="300" width="70" height="380" fill="#e4eaf2" />
          <polygon points="44,302 130,160 216,302" fill="#3d8bd9" />
          <polygon points="130,160 216,302 130,302" fill="#2f6fb8" />
          <rect x="800" y="300" width="140" height="380" fill="#f8fafc" />
          <rect x="870" y="300" width="70" height="380" fill="#e4eaf2" />
          <polygon points="784,302 870,160 956,302" fill="#3d8bd9" />
          <polygon points="870,160 956,302 870,302" fill="#2f6fb8" />
          <rect x="300" y="280" width="80" height="400" fill="#f8fafc" />
          <polygon points="288,282 340,180 392,282" fill="#3d8bd9" />
          <rect x="620" y="280" width="80" height="400" fill="#e9eef4" />
          <polygon points="608,282 660,180 712,282" fill="#2f6fb8" />
          <rect x="380" y="210" width="240" height="470" fill="#fbfcfd" />
          <rect x="500" y="210" width="120" height="470" fill="#e8eef5" />
          <polygon points="358,212 500,26 642,212" fill="#3d8bd9" />
          <polygon points="500,26 642,212 500,212" fill="#2a64a8" />
          <path d="M455 680 V600 C455 568 545 568 545 600 V680 Z" fill="#1c3f6e" />
          <rect x="440" y="300" width="22" height="40" fill="#7fb8e6" />
          <rect x="538" y="300" width="22" height="40" fill="#7fb8e6" />
          <rect x="489" y="250" width="22" height="34" fill="#7fb8e6" />
          <rect x="118" y="380" width="20" height="34" fill="#7fb8e6" />
          <rect x="858" y="380" width="20" height="34" fill="#7fb8e6" />
          <rect x="497" y="0" width="5" height="40" fill="#8a7a5a" />
          <polygon points="502,2 540,12 502,22" fill="#d9a93f" />
          <rect x="127" y="132" width="5" height="34" fill="#8a7a5a" />
          <polygon points="132,134 160,142 132,150" fill="#9b4f96" />
          <rect x="867" y="132" width="5" height="34" fill="#8a7a5a" />
          <polygon points="872,134 900,142 872,150" fill="#9b4f96" />
          <rect x="120" y="470" width="760" height="10" fill="#d9a93f" />
        </Stand>
      );
    case "Pillar":
      return (
        <Stand vb="0 0 40 170">
          <circle cx="20" cy="11" r="14" fill="#7fb8e6" opacity={s.crystalOp} />
          <rect x="4" y="152" width="32" height="18" fill="#cfc8b4" />
          <rect x="8" y="32" width="24" height="122" fill="#f6f4ee" />
          <rect x="20" y="32" width="12" height="122" fill="#dcd6c6" />
          <rect x="5" y="22" width="30" height="11" fill="#e8e2d2" />
          <rect x="8" y="62" width="24" height="4" fill="#d9a93f" />
          <polygon points="20,0 27,11 20,22 13,11" fill="#bfe1fa" />
          <polygon points="20,0 27,11 20,22" fill="#7fb8e6" />
        </Stand>
      );
    case "Banner":
      return (
        <Stand vb="0 0 60 240">
          <rect x="27" y="8" width="5" height="232" fill="#8a7a5a" />
          <circle cx="29.5" cy="7" r="6" fill="#d9a93f" />
          <path d="M32 22 H58 V156 L45 140 L32 156 Z" fill={s.col} />
          <polygon points="45,48 53,60 45,72 37,60" fill="#f0c868" />
          <rect x="32" y="22" width="26" height="6" fill="#f0c868" />
        </Stand>
      );
    case "Tree":
      return (
        <Stand vb="0 0 120 160">
          <rect x="54" y="108" width="12" height="52" fill={s.trunk} />
          <circle cx="38" cy="90" r="30" fill={s.c2} />
          <circle cx="84" cy="88" r="32" fill={s.c2} />
          <circle cx="60" cy="66" r="44" fill={s.c1} />
          <circle cx="48" cy="52" r="18" fill={s.c3} />
        </Stand>
      );
    case "Bush":
      return (
        <Stand vb="0 0 100 80">
          <ellipse cx="30" cy="54" rx="28" ry="24" fill={s.c2} />
          <ellipse cx="70" cy="54" rx="28" ry="24" fill={s.c2} />
          <ellipse cx="50" cy="42" rx="34" ry="30" fill={s.c1} />
          <ellipse cx="42" cy="30" rx="16" ry="11" fill={s.c3} />
          <circle cx="28" cy="40" r="6" fill={s.d1} />
          <circle cx="50" cy="24" r="6.5" fill={s.d2} />
          <circle cx="70" cy="38" r="6" fill={s.d1} />
          <circle cx="40" cy="56" r="5.5" fill={s.d2} />
          <circle cx="62" cy="58" r="6" fill={s.d1} />
          <circle cx="18" cy="60" r="5" fill={s.d1} />
          <circle cx="84" cy="56" r="5" fill={s.d2} />
          <circle cx="56" cy="42" r="2.4" fill="#fff6c8" />
          <circle cx="34" cy="48" r="2.2" fill="#fff6c8" />
        </Stand>
      );
    case "Arch":
      return (
        <Stand vb="0 0 160 180">
          <path d="M22 180 V74 A58 58 0 0 1 138 74 V180" fill="none" stroke="#fbf8f2" strokeWidth={12} />
          <path d="M22 180 V74 A58 58 0 0 1 138 74 V180" fill="none" stroke="#6fae54" strokeWidth={5} strokeDasharray="9 7" />
          <circle cx="22" cy="120" r="9" fill={s.d1} />
          <circle cx="26" cy="72" r="10" fill={s.d2} />
          <circle cx="46" cy="34" r="9" fill={s.d1} />
          <circle cx="80" cy="18" r="11" fill={s.d2} />
          <circle cx="114" cy="34" r="9" fill={s.d1} />
          <circle cx="134" cy="72" r="10" fill={s.d2} />
          <circle cx="138" cy="120" r="9" fill={s.d1} />
          <circle cx="64" cy="22" r="6" fill="#ffffff" />
          <circle cx="98" cy="22" r="6" fill="#ffffff" />
          <circle cx="22" cy="152" r="7" fill={s.d2} />
          <circle cx="138" cy="152" r="7" fill={s.d2} />
        </Stand>
      );
    case "Windmill":
      return (
        <Stand vb="0 0 260 380">
          <polygon points="96,380 104,140 156,140 164,380" fill="#fbf8f2" />
          <polygon points="130,140 156,140 164,380 130,380" fill="#e6ddcc" />
          <polygon points="90,144 130,86 170,144" fill="#3d8bd9" />
          <path d="M118 380 V340 C118 324 142 324 142 340 V380 Z" fill="#7a5a3a" />
          <rect x="120" y="220" width="18" height="24" fill="#7fb8e6" />
          {/* ใบพัดหมุน */}
          <g style={{ transformOrigin: "130px 112px", animation: "arSpin 12s linear infinite" }}>
            <rect x="124" y="0" width="12" height="112" fill="#f3efe6" />
            <rect x="124" y="0" width="12" height="112" fill="#f3efe6" transform="rotate(90 130 112)" />
            <rect x="124" y="0" width="12" height="112" fill="#f3efe6" transform="rotate(180 130 112)" />
            <rect x="124" y="0" width="12" height="112" fill="#f3efe6" transform="rotate(270 130 112)" />
            <circle cx="130" cy="112" r="9" fill="#8a7a5a" />
          </g>
        </Stand>
      );
    case "Ftree":
      return (
        <Stand vb="0 0 140 170">
          <path d="M64 170 L66 112 L52 92 L58 90 L70 104 L84 84 L90 88 L76 112 L78 170 Z" fill={s.trunk} />
          <circle cx="40" cy="84" r="32" fill={s.c2} />
          <circle cx="100" cy="82" r="34" fill={s.c2} />
          <circle cx="70" cy="58" r="46" fill={s.c1} />
          <circle cx="56" cy="40" r="20" fill={s.c3} />
          <circle cx="96" cy="58" r="14" fill={s.c3} />
          <circle cx="38" cy="70" r="4" fill={s.d1} />
          <circle cx="74" cy="30" r="4" fill={s.d1} />
          <circle cx="104" cy="76" r="4" fill={s.d1} />
          <circle cx="60" cy="88" r="3.5" fill={s.d1} />
          <circle cx="88" cy="46" r="3.5" fill="#ffffff" />
          <circle cx="50" cy="56" r="3" fill="#ffffff" />
        </Stand>
      );
    case "Sunflower":
      return (
        <Stand vb="0 0 40 120">
          <rect x="18.5" y="30" width="3" height="90" fill="#4f8f3a" />
          <path d="M20 80 C8 74 4 66 6 62 C12 64 18 70 20 80 Z" fill="#5fa548" />
          <path d="M20 64 C32 58 36 50 34 46 C28 48 22 54 20 64 Z" fill="#5fa548" />
          <circle cx="20" cy="20" r="17" fill="#f6c63b" />
          <circle cx="20" cy="20" r="13" fill="#ffd95a" />
          <circle cx="20" cy="20" r="8" fill="#7a4a1e" />
          <circle cx="18" cy="18" r="3" fill="#9a6230" />
        </Stand>
      );
    case "Dtree":
      return (
        <Stand vb="0 0 200 300">
          <path d="M82 300 C90 246 66 214 82 164 C94 124 78 92 94 58 L108 58 C100 96 118 126 108 166 C98 210 122 246 120 300 Z" fill={s.c1} />
          <path d="M90 124 C68 104 46 98 22 70" fill="none" stroke={s.c1} strokeWidth={9} strokeLinecap="round" />
          <path d="M104 92 C130 72 152 64 178 38" fill="none" stroke={s.c1} strokeWidth={8} strokeLinecap="round" />
          <path d="M86 176 C60 166 42 156 18 164" fill="none" stroke={s.c1} strokeWidth={7} strokeLinecap="round" />
          <path d="M110 146 C140 134 162 122 186 132" fill="none" stroke={s.c1} strokeWidth={7} strokeLinecap="round" />
          <ellipse cx="24" cy="62" rx="32" ry="18" fill={s.c2} />
          <ellipse cx="176" cy="32" rx="30" ry="16" fill={s.c2} />
          <ellipse cx="100" cy="46" rx="44" ry="26" fill={s.c2} />
          <ellipse cx="88" cy="36" rx="22" ry="12" fill={s.c3} />
          <ellipse cx="20" cy="158" rx="22" ry="11" fill={s.c2} />
          <ellipse cx="186" cy="126" rx="22" ry="11" fill={s.c2} />
          <path d="M30 74 v46 M44 80 v30 M168 46 v40 M112 66 v52 M180 136 v34" fill="none" stroke="#8fae6a" strokeWidth={2} opacity={0.55} />
        </Stand>
      );
    case "Mushroom":
      return (
        <Stand vb="0 0 60 60">
          <rect x="25" y="30" width="10" height="30" fill="#e8e2cf" />
          <path d="M6 32 C6 12 54 12 54 32 Z" fill={s.col} style={{ animation: s.anim }} />
          <circle cx="20" cy="24" r="3" fill="#ffffff" />
          <circle cx="34" cy="20" r="2.5" fill="#ffffff" />
          <circle cx="44" cy="27" r="2" fill="#ffffff" />
        </Stand>
      );
    case "Monolith":
      return (
        <Stand vb="0 0 80 170">
          <polygon points="12,170 8,40 24,6 58,10 72,44 68,170" fill="#4d525c" />
          <polygon points="40,8 58,10 72,44 68,170 40,170" fill="#3a3e47" />
          {/* อักษรรูนเต้นเป็นจังหวะ */}
          <path
            d="M40 46 V112 M26 60 L54 88 M54 60 L26 88 M28 124 H52"
            fill="none"
            stroke={s.col}
            strokeWidth={3.5}
            strokeLinecap="round"
            style={{ animation: "arPulse 3s ease-in-out infinite" }}
          />
          <path d="M12 170 C20 150 30 160 40 146 C50 160 62 150 68 170 Z" fill="#3f5f38" />
        </Stand>
      );
    case "Dead":
      return (
        <Stand vb="0 0 240 320">
          <path d={s.dd} fill={s.col} />
          <path d={s.vines} fill="none" stroke={s.col} strokeWidth={1.8} strokeLinecap="round" opacity={0.85} />
        </Stand>
      );
    case "Grave":
      return (
        <Stand vb="0 0 46 60">
          <g transform={`rotate(${s.rot} 23 60)`}>
            <path d="M6 60 V20 C6 6 40 6 40 20 V60 Z" fill={s.col} />
            <path d="M23 60 V12 C32 13 40 16 40 20 V60 Z" fill="rgba(0,0,0,0.25)" />
            <path d="M23 22 V40 M16 28 H30" fill="none" stroke="rgba(0,0,0,0.45)" strokeWidth={3} />
            <path d="M8 52 L14 46 L20 54 L28 47 L38 55" fill="none" stroke="rgba(30,40,20,0.6)" strokeWidth={2} />
          </g>
        </Stand>
      );
    case "Stake":
      return (
        <Stand vb="0 0 46 60">
          <g transform={`rotate(${s.rot} 23 60)`}>
            <rect x="19" y="4" width="8" height="56" fill={s.c1} />
            <rect x="8" y="16" width="30" height="6" fill={s.c1} transform="rotate(-8 23 19)" />
            <path d="M19 4 L23 0 L27 4 Z" fill={s.c1} />
          </g>
        </Stand>
      );
    case "Thorn":
      return (
        <Stand vb="0 0 120 70">
          <path d="M4 70 L14 34 L22 58 L32 16 L42 54 L54 8 L62 50 L74 18 L82 56 L94 26 L102 60 L114 36 L118 70 Z" fill={s.c1} />
          <path d="M10 64 C40 40 70 52 112 30 M8 50 C40 60 80 30 110 56" fill="none" stroke={s.c1} strokeWidth={3} />
          <circle cx="36" cy="44" r="3.5" fill={s.col} />
          <circle cx="70" cy="36" r="3.5" fill={s.col} />
          <circle cx="92" cy="48" r="3" fill={s.col} />
        </Stand>
      );
    case "Shrub":
      // พุ่มไม้แห้งตาย (ป่าต้องสาป): กิ่งเปลือยแตกแขนงจากโคน ไม่มีใบ — เหลือใบแห้งติดอยู่ไม่กี่ใบ
      return (
        <Stand vb="0 0 140 90">
          <path d="M70 90 C66 72 50 60 26 46 M70 90 C64 68 52 44 44 18 M70 90 C72 66 70 42 77 10 M70 90 C78 68 92 46 114 30 M70 90 C82 76 102 66 130 58 M70 90 C58 78 38 72 10 66" fill="none" stroke={s.col} strokeWidth={3.6} strokeLinecap="round" />
          <path d="M26 46 L14 40 M26 46 L22 32 M44 18 L34 8 M44 18 L52 6 M77 10 L70 2 M77 10 L86 3 M114 30 L124 20 M114 30 L128 34 M130 58 L138 50 M10 66 L2 58 M52 60 L42 50 M92 50 L98 38 M60 40 L52 30 M84 30 L94 22" fill="none" stroke={s.col} strokeWidth={1.8} strokeLinecap="round" />
          <ellipse cx="40" cy="30" rx="3.5" ry="2" fill={s.c1} transform="rotate(30 40 30)" />
          <ellipse cx="104" cy="40" rx="3.5" ry="2" fill={s.c1} transform="rotate(-20 104 40)" />
          <ellipse cx="72" cy="22" rx="3" ry="1.8" fill={s.c1} />
        </Stand>
      );
    default:
      { const X = EXTRA_ART.stand[s.kind]; return X ? <X s={s} /> : null; }
  }
}

// ---------- เอฟเฟกต์บนจอ ----------
function FxArtBase({ f }) {
  const c = f.col;
  switch (f.kind) {
    case "Spark":
      return (
        <div style={{ ...FULL, borderRadius: "50%", background: `radial-gradient(circle, ${c} 0%, ${c} 22%, rgba(255,255,255,0) 70%)` }} />
      );
    case "Petal":
      return (
        <div style={{ ...FULL, borderRadius: "70% 0 70% 0", background: c, boxShadow: "inset -2px -2px 0 rgba(0,0,0,0.08)" }} />
      );
    case "Fly":
      return (
        <div style={{ ...FULL, animation: f.inner }}>
          <Plain vb="0 0 40 40">
            <path d="M20 20 C10 2 -1 7 3 18 C-1 27 10 33 20 22 Z" fill={c} />
            <path d="M20 20 C30 2 41 7 37 18 C41 27 30 33 20 22 Z" fill={c} />
            <circle cx="11" cy="14" r="3" fill={f.col2} />
            <circle cx="29" cy="14" r="3" fill={f.col2} />
            <rect x="18.8" y="11" width="2.4" height="17" rx="1.2" fill="#2b2a33" />
          </Plain>
        </div>
      );
    case "Ray":
      return (
        <div
          style={{
            ...FULL,
            transform: `rotate(${f.rot}deg)`,
            background: `linear-gradient(180deg, ${c} 0%, rgba(255,255,255,0) 100%)`,
            filter: "blur(10px)",
          }}
        />
      );
    case "Glow":
    case "Fog":
      return (
        <div style={{ ...FULL, borderRadius: "50%", background: `radial-gradient(closest-side, ${c} 0%, rgba(255,255,255,0) 100%)` }} />
      );
    case "Wisp":
      return (
        <div
          style={{
            ...FULL,
            borderRadius: "50%",
            background: `radial-gradient(circle, #ffffff 0%, #ffffff 12%, ${c} 30%, rgba(255,255,255,0) 70%)`,
            boxShadow: `0 0 24px 6px ${c}`,
          }}
        />
      );
    case "Eyes": {
      const eye = { width: "30%", height: "100%", borderRadius: "50%", background: c, boxShadow: `0 0 8px 2px ${c}` };
      return (
        <div style={{ ...FULL, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={eye} />
          <span style={eye} />
        </div>
      );
    }
    case "Crow":
      return (
        <div style={{ ...FULL, animation: f.inner }}>
          <Plain vb="0 0 34 20">
            <path d="M17 12 C12 4 6 2 0 6 C6 6 10 9 13 14 Z M17 12 C22 4 28 2 34 6 C28 6 24 9 21 14 Z" fill={c} />
            <ellipse cx="17" cy="13" rx="4" ry="3" fill={c} />
          </Plain>
        </div>
      );
    case "Vignette":
      return (
        <div style={{ ...FULL, background: `radial-gradient(ellipse at 50% 58%, rgba(0,0,0,0) 42%, ${c} 100%)` }} />
      );
    default:
      { const X = EXTRA_ART.fx[f.kind]; return X ? <X f={f} /> : null; }
  }
}

// ---------- ของบังหน้ากล้อง ----------
const PETAL_ROTS = [0, 60, 120, 180, 240, 300];

function ForeArtBase({ f }) {
  const c = f.col;
  switch (f.kind) {
    case "Leafy":
      return (
        <Plain vb="0 0 200 160">
          <ellipse cx="60" cy="90" rx="60" ry="46" fill={c} />
          <ellipse cx="130" cy="80" rx="64" ry="50" fill={c} />
          <ellipse cx="96" cy="50" rx="56" ry="42" fill={c} />
          <ellipse cx="84" cy="40" rx="24" ry="16" fill="rgba(255,255,255,0.18)" />
        </Plain>
      );
    case "Bloom":
      return (
        <Plain vb="0 0 100 100">
          {PETAL_ROTS.map((r) => (
            <ellipse key={r} cx="50" cy="25" rx="15" ry="24" fill={c} transform={r ? `rotate(${r} 50 50)` : undefined} />
          ))}
          <circle cx="50" cy="50" r="13" fill={f.col2} />
        </Plain>
      );
    case "Branch":
      return (
        <div style={{ ...FULL, transform: `rotate(${f.rot}deg)` }}>
          <Plain vb="0 0 300 200">
            <path d="M0 40 C60 50 110 30 170 60 C210 80 250 70 300 100" fill="none" stroke={c} strokeWidth={22} strokeLinecap="round" />
            <path d="M90 42 C110 80 100 120 130 160" fill="none" stroke={c} strokeWidth={12} strokeLinecap="round" />
            <path d="M190 70 C210 40 240 30 260 0" fill="none" stroke={c} strokeWidth={10} strokeLinecap="round" />
            <ellipse cx="135" cy="168" rx="40" ry="24" fill={f.col2} />
            <ellipse cx="262" cy="10" rx="36" ry="20" fill={f.col2} />
            <ellipse cx="40" cy="30" rx="50" ry="26" fill={f.col2} />
            <path d="M120 60 v70 M160 66 v50 M60 46 v60" fill="none" stroke={f.col2} strokeWidth={4} />
          </Plain>
        </div>
      );
    default:
      { const X = EXTRA_ART.fore[f.kind]; return X ? <X f={f} /> : null; }
  }
}

export const StandArt = memo(StandArtBase);
export const FxArt = memo(FxArtBase);
export const ForeArt = memo(ForeArtBase);
