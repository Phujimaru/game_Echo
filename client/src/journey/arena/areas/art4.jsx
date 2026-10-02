// ภาพของตั้ง/เอฟเฟกต์เฉพาะภูมิภาค IV (คลื่นวงวนน้ำ) — { stand, fx, fore } · keyframes ar4* อยู่ใน area4.css
import { Stand } from "../ArenaArt";
import "./area4.css";

const FULL = { width: "100%", height: "100%" };
const A11Y = { "aria-hidden": "true", focusable: "false" };

/* เกาะหินโด่ง 3 แบบ (viewBox 200×400) */
const STACK = [
  "M30 400 L40 330 L32 280 L50 220 L44 170 L64 120 L60 80 L84 40 L110 30 L132 52 L138 100 L130 150 L150 200 L146 260 L162 320 L172 400 Z",
  "M14 400 L26 320 L22 250 L40 190 L36 130 L58 90 L74 118 L92 58 L118 70 L128 140 L150 170 L160 240 L176 300 L186 400 Z",
  "M50 400 L58 330 L52 270 L66 210 L58 160 L40 122 L48 72 L90 40 L140 48 L162 90 L150 130 L134 170 L140 230 L132 300 L148 400 Z",
];
const CAP = [
  "M60 84 L84 40 L110 30 L132 52 L136 84 C112 74 86 92 60 84 Z",
  "M40 136 L58 90 L74 118 L92 58 L118 70 L124 110 C96 100 70 132 40 136 Z",
  "M44 90 L48 72 L90 40 L140 48 L160 88 C126 74 84 98 44 90 Z",
];

function W4Stack({ s }) {
  const v = s.v || 0;
  const id = `w4stk${s.i}`;
  return (
    <Stand vb="0 0 200 400">
      <defs>
        <clipPath id={id}><path d={STACK[v]} /></clipPath>
      </defs>
      <path d={STACK[v]} fill={s.c2} />
      <g clipPath={`url(#${id})`}>
        <rect x="104" y="0" width="100" height="400" fill={s.c1} opacity="0.85" />
        <path d="M0 40 L60 10 L40 400 L0 400 Z" fill={s.c3} opacity="0.5" />
        <path d="M0 150 L200 138 M0 212 L200 226 M0 268 L200 256 M0 318 L200 330 M0 96 L200 104" stroke={s.c1} strokeWidth="5" opacity="0.6" />
        <path d={CAP[v]} fill={s.col} opacity="0.9" />
        <path d="M70 120 l-4 40 M118 96 l3 50 M96 60 l-2 34" stroke="#ffffff" strokeWidth="3" opacity="0.35" strokeLinecap="round" />
        <rect x="0" y="352" width="200" height="48" fill={s.c1} opacity="0.7" />
      </g>
      <g style={{ transformOrigin: "100px 394px", animation: "ar4Foam 3.2s ease-in-out infinite" }}>
        <ellipse cx="100" cy="395" rx="80" ry="6" fill={s.d1} opacity="0.22" />
        <ellipse cx="100" cy="395" rx="80" ry="6" fill="none" stroke={s.d1} strokeWidth="3" opacity="0.85" />
        <path d="M34 392 q8 -5 16 0 M150 392 q8 -5 16 0" fill="none" stroke={s.d1} strokeWidth="3" strokeLinecap="round" opacity="0.8" />
      </g>
    </Stand>
  );
}

/* ซุ้มหินโค้งกลางทะเล (viewBox 900×520) */
function W4Arch({ s }) {
  const body = "M0 520 L22 400 L58 300 L92 206 L150 124 L240 74 L360 52 L480 62 L600 40 L704 82 L782 160 L834 262 L862 380 L900 520 L706 520 L692 424 L664 334 L604 266 L522 226 L440 220 L362 244 L302 302 L262 384 L242 520 Z";
  return (
    <Stand vb="0 0 900 520">
      <defs>
        <clipPath id={`w4arch${s.i}`}><path d={body} /></clipPath>
      </defs>
      <path d={body} fill={s.c2} />
      <g clipPath={`url(#w4arch${s.i})`}>
        <path d="M450 0 L900 0 L900 520 L640 520 L600 270 L470 200 Z" fill={s.c1} opacity="0.8" />
        <path d="M0 150 L900 110 M0 250 L900 230 M0 340 L900 360 M0 430 L900 440" stroke={s.c1} strokeWidth="9" opacity="0.5" />
        <path d="M100 200 L250 74 L380 50 L300 160 L170 240 Z" fill={s.c3} opacity="0.45" />
        <path d="M150 124 L240 74 L360 52 L480 62 L600 40 L704 82 L760 136 C640 100 520 120 420 96 C320 90 230 120 150 124 Z" fill={s.col} opacity="0.85" />
        <rect x="0" y="470" width="900" height="50" fill={s.c1} opacity="0.6" />
      </g>
      {/* สาหร่ายห้อยใต้โค้ง */}
      <path d="M330 270 q6 30 -2 60 M372 244 q-6 34 4 70 M420 224 q6 26 -4 52 M470 222 q-4 40 6 74 M530 230 q8 30 -2 62 M590 258 q-6 30 4 58 M640 300 q6 24 -2 48" fill="none" stroke={s.col} strokeWidth="5" strokeLinecap="round" opacity="0.9" />
      <g style={{ transformOrigin: "450px 512px", animation: "ar4Foam 3.6s ease-in-out infinite" }}>
        <ellipse cx="130" cy="513" rx="130" ry="7" fill="none" stroke={s.d1} strokeWidth="4" opacity="0.85" />
        <ellipse cx="800" cy="513" rx="120" ry="7" fill="none" stroke={s.d1} strokeWidth="4" opacity="0.85" />
        <ellipse cx="130" cy="513" rx="130" ry="7" fill={s.d1} opacity="0.2" />
        <ellipse cx="800" cy="513" rx="120" ry="7" fill={s.d1} opacity="0.2" />
      </g>
    </Stand>
  );
}

/* แถบทะเลไกล + เกาะหิน/หน้าผาที่ขอบฟ้า (ปิดช่องใต้เส้นขอบฟ้า) */
function W4Horizon({ s }) {
  return (
    <Stand vb="0 0 3400 420" par="none">
      <defs>
        <linearGradient id={s.night ? "w4hzn" : "w4hzd"} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={s.c1} />
          <stop offset="1" stopColor={s.c2} />
        </linearGradient>
      </defs>
      <rect x="0" y="212" width="3400" height="208" fill={`url(#${s.night ? "w4hzn" : "w4hzd"})`} />
      <path d="M0 420 L0 120 L40 96 L70 132 L104 70 L150 112 L190 100 L226 150 L262 128 L300 176 L340 160 L388 196 L440 190 L500 210 L560 214 L560 420 Z" fill={s.c3} />
      <path d="M3400 420 L3400 100 L3360 80 L3322 126 L3280 92 L3236 140 L3190 124 L3150 166 L3100 150 L3050 186 L2990 196 L2920 212 L2860 214 L2860 420 Z" fill={s.c3} />
      <path d="M0 140 L40 96 L70 132 L104 70 L120 92 L60 170 Z M3400 110 L3360 80 L3322 126 L3280 92 L3300 150 Z" fill={s.col} opacity="0.12" />
      <path d="M980 214 L1010 186 L1040 196 L1070 172 L1110 200 L1150 214 Z M2080 214 L2120 190 L2150 176 L2190 198 L2240 214 Z M1560 214 L1580 202 L1600 206 L1620 214 Z" fill={s.c3} opacity="0.85" />
      <path d="M700 232 H1300 M1500 246 H2300 M900 268 H1700 M2000 290 H2700 M600 316 H1200 M1600 340 H2500" stroke={s.col} strokeWidth="3" opacity="0.35" strokeLinecap="round" />
      <rect x="0" y="210" width="3400" height="4" fill={s.col} opacity="0.4" />
    </Stand>
  );
}

/* ซากเรือเอียงกำลังจม (viewBox 300×260) */
function W4Wreck({ s }) {
  return (
    <Stand vb="0 0 300 260">
      <line x1="146" y1="178" x2="112" y2="22" stroke={s.c1} strokeWidth="8" strokeLinecap="round" />
      <line x1="88" y1="66" x2="152" y2="50" stroke={s.c1} strokeWidth="5" strokeLinecap="round" />
      <path d="M96 66 L148 54 L158 120 L134 108 L118 132 L104 112 Z" fill={s.col} opacity="0.9" />
      <line x1="214" y1="160" x2="226" y2="96" stroke={s.c1} strokeWidth="7" strokeLinecap="round" />
      <path d="M112 22 L40 200 M112 22 L250 150" stroke={s.c1} strokeWidth="1.6" opacity="0.7" />
      <path d="M16 206 L256 150 L286 178 L246 232 L64 244 Z" fill={s.c1} />
      <path d="M30 214 L262 162 M44 226 L270 180" stroke={s.c2} strokeWidth="4" opacity="0.8" />
      <path d="M246 232 L286 178 L256 150 Z" fill={s.c2} />
      <circle cx="120" cy="214" r="6" fill="#000000" opacity="0.5" />
      <circle cx="170" cy="204" r="6" fill="#000000" opacity="0.5" />
      <g style={{ transformOrigin: "150px 240px", animation: "ar4Foam 2.8s ease-in-out infinite" }}>
        <ellipse cx="150" cy="243" rx="128" ry="8" fill={s.d1} opacity="0.25" />
        <ellipse cx="150" cy="243" rx="128" ry="8" fill="none" stroke={s.d1} strokeWidth="3" opacity="0.85" />
      </g>
    </Stand>
  );
}

/* งูทะเลยักษ์ — หลังโค้ง 2 ขด + คอและหัว (viewBox 500×280) */
function W4Serpent({ s }) {
  return (
    <Stand vb="0 0 500 280">
      <path d="M24 272 C40 150 132 150 148 272" fill="none" stroke={s.c1} strokeWidth="30" strokeLinecap="round" />
      <path d="M196 272 C214 124 312 124 330 272" fill="none" stroke={s.c1} strokeWidth="34" strokeLinecap="round" />
      <path d="M36 236 C56 172 120 172 138 236 M210 230 C232 150 300 150 318 230" fill="none" stroke={s.c2} strokeWidth="6" opacity="0.7" />
      <path d="M62 178 l6 -20 l8 18 M84 166 l6 -22 l8 20 M106 172 l6 -20 l8 18 M236 152 l7 -24 l9 22 M262 140 l7 -26 l9 24 M290 150 l7 -24 l9 22" fill={s.c2} stroke={s.c2} strokeWidth="2" />
      <path d="M372 276 C364 190 382 112 428 70" fill="none" stroke={s.c1} strokeWidth="32" strokeLinecap="round" />
      <path d="M408 52 C436 30 482 38 494 58 C480 66 462 70 446 86 C430 92 412 80 408 52 Z" fill={s.c1} />
      <path d="M446 86 C462 90 480 84 490 76 L470 96 Z" fill={s.c2} />
      <path d="M414 50 l-8 -24 l18 16 M430 40 l-2 -26 l14 22" fill={s.c2} stroke={s.c2} strokeWidth="2" />
      <circle cx="452" cy="54" r="5" fill={s.col} style={{ animation: "arPulse 3s ease-in-out infinite" }} />
      {s.night && <circle cx="452" cy="54" r="12" fill={s.col} opacity="0.25" />}
      <g style={{ transformOrigin: "250px 272px", animation: "ar4Foam 3s ease-in-out infinite" }}>
        <ellipse cx="30" cy="272" rx="30" ry="7" fill={s.d1} opacity="0.85" />
        <ellipse cx="144" cy="272" rx="30" ry="7" fill={s.d1} opacity="0.85" />
        <ellipse cx="200" cy="272" rx="32" ry="7" fill={s.d1} opacity="0.85" />
        <ellipse cx="328" cy="272" rx="32" ry="7" fill={s.d1} opacity="0.85" />
        <ellipse cx="372" cy="274" rx="36" ry="7" fill={s.d1} opacity="0.85" />
      </g>
    </Stand>
  );
}

/* โขดหินมีปะการัง (viewBox 70×56) */
function W4Reef({ s }) {
  return (
    <Stand vb="0 0 70 56">
      <path d="M4 56 C2 40 14 28 30 30 C38 18 58 22 62 36 C70 40 68 52 66 56 Z" fill={s.c1} />
      <path d="M30 30 C38 18 58 22 62 36 C52 32 40 32 30 30 Z" fill={s.c2} />
      <path d="M16 40 C14 30 12 24 16 18 M16 32 C20 26 24 24 26 20 M48 30 C48 20 52 14 56 10 M50 22 C46 18 44 14 44 10" fill="none" stroke={s.d1} strokeWidth="3.5" strokeLinecap="round" />
      <circle cx="40" cy="30" r="5" fill={s.d2} />
      <circle cx="58" cy="40" r="3.5" fill={s.d2} />
      <path d="M4 52 C20 48 50 50 66 52" stroke={s.col} strokeWidth="4" fill="none" opacity="0.8" />
    </Stand>
  );
}

/* ปะการังกิ่งบนเสากลาง (viewBox 46×56) */
function W4Coral({ s }) {
  return (
    <Stand vb="0 0 46 56">
      <g style={{ transformOrigin: "23px 56px", animation: "arSway 4s ease-in-out infinite" }}>
        <path d="M23 56 C22 40 18 30 10 20 M22 44 C28 34 34 28 38 16 M20 34 C16 26 18 14 22 6 M30 30 C34 24 40 22 44 20" fill="none" stroke={s.d1} strokeWidth="4.5" strokeLinecap="round" />
        <circle cx="10" cy="19" r="3" fill={s.d2} />
        <circle cx="38" cy="15" r="3" fill={s.d2} />
        <circle cx="22" cy="5" r="3" fill={s.d2} />
      </g>
    </Stand>
  );
}

/* ---------- เอฟเฟกต์ ---------- */
function W4Gull({ f }) {
  return (
    <div style={{ ...FULL, animation: f.inner }}>
      <svg viewBox="0 0 36 18" width="100%" height="100%" {...A11Y}>
        <path d="M0 6 C6 1 12 3 18 11 C24 3 30 1 36 6 C30 5 24 8 18 15 C12 8 6 5 0 6 Z" fill={f.col} />
        <path d="M0 6 C3 4 5 4 7 4.4 L5 6 Z M36 6 C33 4 31 4 29 4.4 L31 6 Z" fill={f.col2} />
      </svg>
    </div>
  );
}

function W4Bubble({ f }) {
  return <div style={{ ...FULL, borderRadius: "50%", border: `1.5px solid ${f.col}`, background: "radial-gradient(circle at 32% 30%, rgba(255,255,255,0.9) 0 14%, rgba(255,255,255,0.08) 30%, rgba(255,255,255,0) 70%)", boxSizing: "border-box" }} />;
}

function W4Drop({ f }) {
  return <div style={{ ...FULL, borderRadius: "50% 50% 50% 50% / 60% 60% 40% 40%", background: `radial-gradient(circle at 40% 35%, #ffffff 0%, ${f.col} 45%, rgba(255,255,255,0) 75%)` }} />;
}

function W4Moon({ f }) {
  return <div style={{ ...FULL, borderRadius: "50%", background: `radial-gradient(circle at 38% 36%, #ffffff 0%, ${f.col} 55%, #c9d8ec 100%)`, boxShadow: `0 0 40px 14px ${f.col2}` }} />;
}

const GLIT_MASK = "radial-gradient(closest-side, #000 20%, rgba(0,0,0,0) 100%)";
function W4Glitter({ f }) {
  return <div style={{ ...FULL, background: `repeating-linear-gradient(180deg, ${f.col} 0 2px, rgba(255,255,255,0) 2px 8px)`, WebkitMaskImage: GLIT_MASK, maskImage: GLIT_MASK }} />;
}

/* ---------- ของบังหน้ากล้อง ---------- */
function W4Rock({ f }) {
  return (
    <div style={{ ...FULL, transform: f.rot ? "scaleX(-1)" : undefined }}>
      <svg viewBox="0 0 300 200" width="100%" height="100%" {...A11Y}>
        <path d="M0 200 L0 70 C30 40 70 50 96 80 C120 50 170 60 186 110 C214 100 250 130 262 200 Z" fill={f.col} />
        <path d="M20 80 C40 60 70 64 88 86 M110 74 C140 70 166 88 176 112" stroke={f.col2} strokeWidth="8" fill="none" strokeLinecap="round" opacity="0.7" />
      </svg>
    </div>
  );
}

export default {
  stand: { W4Stack, W4Arch, W4Horizon, W4Wreck, W4Serpent, W4Reef, W4Coral },
  fx: { W4Gull, W4Bubble, W4Drop, W4Moon, W4Glitter },
  fore: { W4Rock },
};
