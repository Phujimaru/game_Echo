// ภาพของตั้ง/เอฟเฟกต์เฉพาะภูมิภาค V (ทะเลทรายไม่อาจหวนคืน) — { stand, fx, fore } · keyframes ar5* อยู่ใน area5.css
import { Stand } from "../ArenaArt";
import { r1 } from "../arenaKit";
import "./area5.css";

const FULL = { width: "100%", height: "100%" };
const A11Y = { "aria-hidden": "true", focusable: "false" };
const PULSE = { animation: "arPulse 3.4s ease-in-out infinite" };

/* แถบเนินทรายไกล + พีระมิดร้างที่ขอบฟ้า (ปิดช่องใต้เส้นขอบฟ้า) */
function D5Dunes({ s }) {
  const far = "M0 190 C300 150 600 170 900 196 C1200 214 1500 160 1800 150 C2100 142 2400 200 2700 186 C3000 172 3200 150 3400 168";
  const mid = "M0 236 C400 210 700 222 1000 240 C1300 256 1700 214 2100 222 C2500 230 2900 252 3400 228";
  return (
    <Stand vb="0 0 3400 420" par="none">
      <path d="M2340 190 L2510 80 L2680 190 Z" fill={s.d1} opacity="0.6" />
      <path d="M2510 80 L2680 190 L2560 190 Z" fill="#000000" opacity="0.15" />
      <path d="M560 200 L680 124 L712 140 L736 128 L830 200 Z" fill={s.d1} opacity="0.5" />
      <path d={`${far} L3400 420 L0 420 Z`} fill={s.c1} />
      <path d={far} fill="none" stroke={s.col} strokeWidth="3" opacity="0.55" />
      <path d={`${mid} L3400 420 L0 420 Z`} fill={s.c2} />
      <path d={mid} fill="none" stroke={s.col} strokeWidth="3" opacity="0.45" />
      <path d="M0 300 C500 280 900 300 1400 310 C1900 320 2400 290 3400 300 L3400 420 L0 420 Z" fill={s.c3} />
    </Stand>
  );
}

/* เสาหินทรายรอบลาน — v0 ทั้งต้น · v1 หักครึ่ง (viewBox 54×220) */
function D5Column({ s }) {
  const flutes = "M15 SY V206 M21 SY V206 M27 SY V206 M33 SY V206 M39 SY V206";
  if (s.v === 1) {
    return (
      <Stand vb="0 0 54 220">
        <rect x="2" y="204" width="50" height="16" fill={s.c2} />
        <path d="M8 96 L14 84 L20 92 L28 76 L36 90 L46 80 L46 206 L8 206 Z" fill={s.c1} />
        <path d="M27 82 L28 76 L36 90 L46 80 L46 206 L27 206 Z" fill={s.c2} opacity="0.5" />
        <path d={flutes.replace(/SY/g, "96")} stroke={s.c3} strokeWidth="1.6" opacity="0.4" />
        <path d="M14 130 L20 146 L16 160" stroke={s.c3} strokeWidth="1.8" fill="none" />
        {s.night && <path d="M23 112 h8 M27 108 v10 M23 172 l8 6 M31 172 l-8 6" stroke={s.d1} strokeWidth="2" style={PULSE} />}
        <path d="M-6 220 C6 200 46 198 60 220 Z" fill={s.col} />
      </Stand>
    );
  }
  return (
    <Stand vb="0 0 54 220">
      <rect x="2" y="204" width="50" height="16" fill={s.c2} />
      <rect x="8" y="38" width="38" height="168" fill={s.c1} />
      <rect x="27" y="38" width="19" height="168" fill={s.c2} opacity="0.5" />
      <path d={flutes.replace(/SY/g, "38")} stroke={s.c3} strokeWidth="1.6" opacity="0.4" />
      <rect x="2" y="24" width="50" height="14" fill={s.c1} />
      <rect x="27" y="24" width="25" height="14" fill={s.c2} opacity="0.5" />
      <path d="M6 24 L10 14 L44 14 L48 24 Z" fill={s.c2} />
      <path d="M0 14 L30 4 L40 8 L54 6 L54 14 Z" fill={s.c1} />
      <path d="M12 90 L18 104 L14 120 M36 150 L40 164" stroke={s.c3} strokeWidth="1.8" fill="none" />
      {s.night && <path d="M23 70 h8 M27 66 v10 M22 126 l10 8 M32 126 l-10 8" stroke={s.d1} strokeWidth="2" style={PULSE} />}
      <path d="M-6 220 C6 198 46 196 60 220 Z" fill={s.col} />
    </Stand>
  );
}

/* ซากวิหาร 3 แบบ (viewBox 240×300) */
function D5Ruin({ s }) {
  const sand = <path d="M-10 300 C30 262 90 270 130 276 C170 262 220 258 250 300 Z" fill={s.col} />;
  if (s.v === 1) {
    return (
      <Stand vb="0 0 240 300">
        <path d="M10 300 L10 140 L40 130 L60 150 L90 110 L130 120 L160 90 L200 130 L230 160 L230 300 Z" fill={s.c1} />
        <path d="M130 120 L160 90 L200 130 L230 160 L230 300 L130 300 Z" fill={s.c2} opacity="0.55" />
        <path d="M10 180 H230 M10 220 H230 M10 260 H230 M50 140 V180 M110 180 V220 M70 220 V260 M170 220 V260 M150 130 V180 M200 180 V220" stroke={s.c2} strokeWidth="3" opacity="0.6" />
        <path d="M96 250 V196 C96 176 132 176 132 196 V250 Z" fill="#000000" opacity="0.55" />
        {s.night && <path d="M108 214 h12 M114 206 v16" stroke={s.d1} strokeWidth="2.5" style={PULSE} />}
        <path d="M20 120 L30 104 L46 114 L38 128 Z" fill={s.c3} />
        {sand}
      </Stand>
    );
  }
  if (s.v === 2) {
    return (
      <Stand vb="0 0 240 300">
        <rect x="60" y="40" width="40" height="260" fill={s.c1} />
        <rect x="80" y="40" width="20" height="260" fill={s.c2} opacity="0.5" />
        <rect x="50" y="24" width="60" height="18" fill={s.c3} />
        <path d="M54 24 L60 12 L104 12 L108 24 Z" fill={s.c1} />
        <g transform="rotate(16 170 300)">
          <path d="M150 300 L150 120 L158 108 L166 118 L176 104 L186 116 L186 300 Z" fill={s.c1} />
          <rect x="168" y="110" width="18" height="190" fill={s.c2} opacity="0.5" />
        </g>
        <path d="M66 90 L74 110 L68 126 M90 180 L96 196" stroke={s.c2} strokeWidth="2.5" fill="none" />
        <rect x="16" y="262" width="34" height="22" fill={s.c3} transform="rotate(-10 33 273)" />
        <rect x="196" y="270" width="30" height="20" fill={s.c2} transform="rotate(12 211 280)" />
        {sand}
      </Stand>
    );
  }
  return (
    <Stand vb="0 0 240 300">
      <rect x="30" y="86" width="40" height="214" fill={s.c1} />
      <rect x="50" y="86" width="20" height="214" fill={s.c2} opacity="0.5" />
      <path d="M170 300 L170 140 L180 128 L190 140 L200 124 L210 136 L210 300 Z" fill={s.c1} />
      <rect x="190" y="130" width="20" height="170" fill={s.c2} opacity="0.5" />
      <path d="M26 92 C26 24 110 6 150 26 L156 44 L140 52 C110 38 72 48 70 96 Z" fill={s.c3} />
      <path d="M150 26 L156 44 L140 52 Z" fill={s.c2} />
      <path d="M40 60 L70 40 M90 26 L94 44" stroke={s.c2} strokeWidth="3" opacity="0.6" />
      {s.night && <path d="M44 150 h12 M50 142 v16 M44 190 l12 10 M56 190 l-12 10" stroke={s.d1} strokeWidth="2.5" style={PULSE} />}
      <rect x="100" y="270" width="40" height="22" fill={s.c3} transform="rotate(8 120 281)" />
      {sand}
    </Stand>
  );
}

/* โครงกระดูกสัตว์ยักษ์จมทราย (viewBox 640×340) */
const RIBS = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
  const x = 110 + i * 58;
  const h = 250 - Math.abs(i - 2.5) * 26;
  const w = 34 - i * 1.5;
  const end = i % 3 === 1 ? `${x + w + 8} ${r1(318 - h * 0.42)}` : `${x + w + 2} 318`;
  return { d: `M${x - w} 318 C${x - w - 16} ${318 - h} ${x + w + 26} ${r1(318 - h * 1.04)} ${end}`, sw: 12 - i * 0.6 };
});
function D5Ribs({ s }) {
  return (
    <Stand vb="0 0 640 340">
      <path d="M50 306 C200 286 420 288 600 300" fill="none" stroke={s.c2} strokeWidth="14" strokeLinecap="round" />
      {RIBS.map((r, i) => (
        <g key={i}>
          <path d={r.d} fill="none" stroke={s.c2} strokeWidth={r.sw + 4} strokeLinecap="round" />
          <path d={r.d} fill="none" stroke={s.c1} strokeWidth={r.sw} strokeLinecap="round" />
        </g>
      ))}
      <path d="M40 300 L20 290 L28 280 L10 270" fill="none" stroke={s.c1} strokeWidth="8" strokeLinecap="round" />
      {/* กะโหลกมีเขา */}
      <path d="M560 300 C556 250 590 226 616 236 C640 246 642 286 626 304 Z" fill={s.c1} />
      <path d="M596 240 C580 200 590 168 618 156 C604 184 606 210 614 236 Z" fill={s.c2} />
      <circle cx="600" cy="262" r="9" fill="#000000" opacity="0.65" />
      <path d="M612 288 l6 -6 l6 6" stroke="#000000" strokeWidth="2.5" opacity="0.5" fill="none" />
      <path d="M-20 340 C40 300 120 312 200 318 C300 300 420 304 500 316 C560 300 620 300 660 340 Z" fill={s.col} />
    </Stand>
  );
}

/* เศียรรูปปั้นยักษ์ล้มจมทราย (viewBox 420×300) */
function D5Statue({ s }) {
  return (
    <Stand vb="0 0 420 300">
      <g transform="rotate(-12 210 220)">
        <path d="M86 270 L104 96 C134 36 286 36 316 96 L334 270 Z" fill={s.c1} />
        <path d="M100 130 H320 M96 170 H324 M92 210 H328 M90 246 H330" stroke={s.c3} strokeWidth="9" opacity="0.5" />
        <path d="M146 270 L146 130 C146 96 274 96 274 130 L274 270 Z" fill={s.c2} />
        <path d="M210 100 C240 100 274 106 274 130 L274 270 L210 270 Z" fill="#000000" opacity="0.12" />
        <path d="M164 160 C176 150 192 150 200 160 M220 160 C228 150 246 150 256 160" stroke="#000000" strokeWidth="5" fill="none" opacity="0.55" />
        <ellipse cx="182" cy="168" rx="14" ry="5" fill={s.night ? s.d1 : "#000000"} opacity={s.night ? 0.9 : 0.45} style={s.night ? PULSE : undefined} />
        <ellipse cx="238" cy="168" rx="14" ry="5" fill={s.night ? s.d1 : "#000000"} opacity={s.night ? 0.9 : 0.45} style={s.night ? PULSE : undefined} />
        <path d="M210 168 L200 214 L222 214 Z" fill="#000000" opacity="0.18" />
        <path d="M186 236 C200 244 220 244 234 236" stroke="#000000" strokeWidth="4" fill="none" opacity="0.4" />
        <path d="M250 104 L262 140 L250 170 L262 200 M150 200 L160 230" stroke="#000000" strokeWidth="3" fill="none" opacity="0.4" />
        <path d="M290 60 L320 100 L300 108 L286 80 Z" fill={s.col} />
        <path d="M196 44 L210 20 L224 44 Z" fill={s.d1} opacity="0.85" />
      </g>
      <path d="M-20 300 C40 236 150 250 220 264 C300 244 380 236 440 300 Z" fill={s.col} />
    </Stand>
  );
}

/* กะโหลกวัวมีเขา (viewBox 60×40) */
function D5Skull({ s }) {
  return (
    <Stand vb="0 0 60 40">
      <path d="M22 18 C14 18 6 12 2 2 C10 8 16 10 24 12 Z M38 18 C46 18 54 12 58 2 C50 8 44 10 36 12 Z" fill={s.c2} />
      <path d="M20 14 C20 8 40 8 40 14 L36 34 C34 40 26 40 24 34 Z" fill={s.c1} />
      <circle cx="25" cy="18" r="3" fill="#000000" opacity="0.6" /><circle cx="35" cy="18" r="3" fill="#000000" opacity="0.6" />
    </Stand>
  );
}

/* เสาโอเบลิสก์เข็มนาฬิกาแดด (viewBox 56×200) */
function D5Gnomon({ s }) {
  return (
    <Stand vb="0 0 56 200">
      <rect x="4" y="188" width="48" height="12" fill={s.c3} />
      <path d="M13 190 L19 38 L37 38 L43 190 Z" fill={s.c1} />
      <path d="M28 38 L37 38 L43 190 L28 190 Z" fill={s.c2} opacity="0.55" />
      <path d="M19 38 L28 16 L37 38 Z" fill={s.col} />
      <path d="M28 16 L37 38 L28 38 Z" fill="#000000" opacity="0.2" />
      <path d="M23 56 h10 M28 52 v10 M23 76 l10 8 M33 76 l-10 8 M22 100 h12 M24 108 h8 M28 124 c-6 0 -6 10 0 10 c6 0 6 -10 0 -10 M22 150 l6 -8 l6 8 M23 168 h10" stroke={s.d1} strokeWidth="2" fill="none" opacity={s.night ? 1 : 0.6} style={s.night ? PULSE : undefined} />
      <circle cx="28" cy="17" r="5" fill="#ffffff" style={{ animation: "ar5Glint 4s ease-in-out infinite" }} />
    </Stand>
  );
}

/* ---------- เอฟเฟกต์ ---------- */
function D5Sun({ f }) {
  return <div style={{ ...FULL, borderRadius: "50%", background: `radial-gradient(circle, #ffffff 0%, ${f.col} 55%, ${f.col2} 100%)`, boxShadow: `0 0 70px 34px ${f.col2}` }} />;
}

function D5Moon({ f }) {
  return <div style={{ ...FULL, borderRadius: "50%", boxShadow: `inset ${-Math.round(f.w * 0.24)}px ${Math.round(f.w * 0.08)}px 0 0 ${f.col}, 0 0 30px 4px ${f.col2}` }} />;
}

const HEAT_MASK = "linear-gradient(90deg, rgba(0,0,0,0) 0%, #000 20%, #000 80%, rgba(0,0,0,0) 100%)";
function D5Heat({ f }) {
  return <div style={{ ...FULL, background: `linear-gradient(180deg, rgba(255,255,255,0) 0%, ${f.col} 40%, rgba(255,255,255,0) 55%, ${f.col} 75%, rgba(255,255,255,0) 100%)`, WebkitMaskImage: HEAT_MASK, maskImage: HEAT_MASK }} />;
}

function D5Streak({ f }) {
  return <div style={{ ...FULL, borderRadius: "50%", background: `linear-gradient(90deg, rgba(255,255,255,0) 0%, ${f.col} 40%, ${f.col} 60%, rgba(255,255,255,0) 100%)` }} />;
}

function D5Vulture({ f }) {
  return (
    <div style={{ ...FULL, animation: f.inner && f.inner !== "none" ? f.inner : undefined }}>
      <svg viewBox="0 0 52 20" width="100%" height="100%" {...A11Y}>
        <path d="M0 9 L8 6 L18 5 L24 7 L28 7 L34 5 L44 6 L52 9 L47 10 L49 12 L44 11 L45 13 L40 12 C36 13 32 13 29.5 14 L28 18 L24 18 L22.5 14 C20 13 16 13 12 12 L7 13 L8 11 L3 12 L5 10 Z" fill={f.col} />
        <circle cx="26" cy="5.6" r="2.2" fill={f.col} />
      </svg>
    </div>
  );
}

/* ---------- ของบังหน้ากล้อง ---------- */
function D5Rock({ f }) {
  return (
    <div style={{ ...FULL, transform: f.rot ? "scaleX(-1)" : undefined }}>
      <svg viewBox="0 0 300 200" width="100%" height="100%" {...A11Y}>
        <path d="M0 200 L0 60 L70 40 L110 70 L104 120 L170 110 L210 150 L250 160 L270 200 Z" fill={f.col} />
        <path d="M0 60 L70 40 L110 70 L40 84 Z M104 120 L170 110 L210 150 L150 146 Z" fill={f.col2} opacity="0.55" />
        <path d="M20 130 H90 M30 160 H120" stroke={f.col2} strokeWidth="5" opacity="0.45" />
      </svg>
    </div>
  );
}

export default {
  stand: { D5Dunes, D5Column, D5Ruin, D5Ribs, D5Statue, D5Skull, D5Gnomon },
  fx: { D5Sun, D5Moon, D5Heat, D5Streak, D5Vulture },
  fore: { D5Rock },
};
