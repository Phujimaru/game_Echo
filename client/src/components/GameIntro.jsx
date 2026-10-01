// ============================================================
//  ฉากเปิดตัวผู้เล่นตอนแมตช์เริ่ม — ธีม ORDEAL CALL (5.1)
//  ล็อกเป้าผู้เล่นทีละคน (วงสำรวจ + วงเล็บเล็งเป้า + พิกัด) แล้วรวมแถวทุกคนก่อนปิดฉาก
//  สัญญาเวลา (ต้องตรงกับ server/lobby.js gameIntroHoldSeconds()):
//    perMs = clamp(round(4200/n), 620..1000) · คนที่ i ขึ้นที่ i*perMs · แถวรวมที่ n*perMs
//    onOutro ที่ n*perMs + 2900 (ฉากถัดไปขึ้นรอข้างใต้) · onDone ที่ n*perMs + 2900 + 1000
// ============================================================
import { useEffect, useMemo, useState } from "react";
import { getEarth } from "../globe/globeCore";
import "../oc/intro/intro.css";

const FINALE_MS = 2900;
const OUTRO_MS = 1000;

const pad2 = (n) => String(Math.max(0, Math.floor(Number(n) || 0))).padStart(2, "0");

function Portrait({ p, className = "" }) {
  const [broken, setBroken] = useState(false);
  const src = p.character?.img || p.img;
  return (
    <span className={`oci-portrait ${className}`}>
      {src && !broken ? (
        <img src={src} alt="" decoding="async" draggable={false} onError={() => setBroken(true)} />
      ) : (
        <span className="oci-portrait-fallback">{(p.name || "?").slice(0, 1).toUpperCase()}</span>
      )}
    </span>
  );
}

function Brackets({ className = "" }) {
  return (
    <span className={`oci-brackets ${className}`} aria-hidden="true">
      <i className="tl" /><i className="tr" /><i className="bl" /><i className="br" />
    </span>
  );
}

// วงสำรวจรอบเป้า: วงนอกขีดสเกล หมุนช้า · วงในเส้นประ หมุนสวน · กากบาทเล็ง
function ScopeRings({ color }) {
  const ticks = [];
  for (let a = 0; a < 360; a += 6) {
    const long = a % 30 === 0;
    ticks.push(<line key={a} x1="200" y1={long ? 8 : 14} x2="200" y2="22" transform={`rotate(${a} 200 200)`} className={long ? "oci-tick-l" : ""} />);
  }
  return (
    <svg className="oci-scope" viewBox="0 0 400 400" aria-hidden="true" style={{ "--pc": color }}>
      <g className="oci-scope-spin">
        <circle cx="200" cy="200" r="190" className="oci-ring-hair" />
        <g className="oci-ticks">{ticks}</g>
      </g>
      <g className="oci-scope-rev">
        <circle cx="200" cy="200" r="150" className="oci-ring-dash" />
        <path d="M200 40 l4 7 h-8z M360 200 l-7 4 v-8z M200 360 l-4 -7 h8z M40 200 l7 -4 v8z" className="oci-ring-mark" />
      </g>
      <circle cx="200" cy="200" r="104" className="oci-ring-pc" />
      <path d="M200 120 V170 M200 230 V280 M120 200 H170 M230 200 H280" className="oci-cross" />
      <circle cx="200" cy="200" r="3" className="oci-dot" />
    </svg>
  );
}

function LockOn({ p, index, total }) {
  const left = index % 2 === 0;
  return (
    <div className={`oci-lock ${left ? "is-left" : "is-right"}`} style={{ "--pc": p.color || "#3d8bd9" }}>
      <span className="oci-numeral oc-latin" aria-hidden="true">{pad2(p.position)}</span>

      <div className="oci-target">
        <ScopeRings color={p.color} />
        <div className="oci-frame">
          <Portrait p={p} />
          <span className="oci-frame-scan" aria-hidden="true" />
          <span className="oci-frame-bar" aria-hidden="true" />
        </div>
        <Brackets className="oci-brackets-lock" />
        <div className="oci-readout oci-readout-b oc-latin" aria-hidden="true">
          <span><b>{pad2(index + 1)}/{pad2(total)}</b></span>
        </div>
      </div>

      <div className="oci-id">
        <div className="oci-id-row">
          <span className="oci-chip">ผู้เล่นคนที่ {p.position}</span>
        </div>
        <div className="oci-name">{p.name}</div>
        {p.character?.name && (
          <div className="oci-char">
            <i className="oc-diamond" style={{ background: p.color }} />
            {p.character.name}
          </div>
        )}
        <span className="oci-rule" aria-hidden="true"><i /></span>
      </div>
    </div>
  );
}

function Lineup({ players }) {
  const n = players.length;
  return (
    <div className="oci-lineup" style={{ "--n": n }}>
      <svg className="oci-halo" viewBox="0 0 600 600" aria-hidden="true">
        <g className="oci-halo-spin">
          <circle cx="300" cy="300" r="286" className="oci-draw oci-draw-1" pathLength="1" />
          <circle cx="300" cy="300" r="270" className="oci-ring-dash" />
        </g>
        <g className="oci-halo-rev">
          <circle cx="300" cy="300" r="214" className="oci-draw oci-draw-2" pathLength="1" />
          <circle cx="300" cy="300" r="150" className="oci-draw oci-draw-3" pathLength="1" />
        </g>
        <path d="M300 0 V60 M300 540 V600 M0 300 H60 M540 300 H600" className="oci-halo-cross" />
      </svg>

      <div className="oci-title-wrap">
        <span className="oci-kicker oc-latin">ORDEAL CALL</span>
        <div className="oci-title-row">
          <span className="oci-wing" aria-hidden="true" />
          <h1 className="oci-title">เริ่มการประลอง</h1>
          <span className="oci-wing is-r" aria-hidden="true" />
        </div>
        <span className="oci-chip oci-count">ผู้เล่น {n} คน</span>
      </div>

      <div className="oci-cards">
        {players.map((p, i) => (
          <div key={p.id} className="oci-card" style={{ "--pc": p.color || "#3d8bd9", animationDelay: `${(0.25 + i * 0.09).toFixed(2)}s` }}>
            <span className="oci-card-no oc-latin">{pad2(p.position)}</span>
            <div className="oci-card-img"><Portrait p={p} /></div>
            <div className="oci-card-name">{p.name}</div>
            {p.character?.name && <div className="oci-card-char">{p.character.name}</div>}
            <Brackets />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function GameIntro({ players, onDone, onOutro }) {
  const ordered = useMemo(() => [...players].sort((a, b) => a.position - b.position), [players]);
  const [index, setIndex] = useState(-1);
  const [outro, setOutro] = useState(false);

  const n = ordered.length;
  const perMs = Math.max(620, Math.min(1000, Math.round(4200 / Math.max(1, n))));

  // สร้างพื้นผิวลูกโลกรอไว้ก่อน (ฉากเริ่มการเดินทางต่อจากนี้ใช้) — มีอยู่แล้วก็ไม่ทำซ้ำ
  useEffect(() => { try { getEarth(); } catch { /* ไม่มี canvas ก็ข้าม */ } }, []);

  useEffect(() => {
    const timers = [];
    ordered.forEach((_, i) => {
      timers.push(setTimeout(() => setIndex(i), i * perMs));
    });
    timers.push(setTimeout(() => setIndex(ordered.length), ordered.length * perMs));
    timers.push(setTimeout(() => { setOutro(true); if (onOutro) onOutro(); }, ordered.length * perMs + FINALE_MS)); // onOutro: ฉากถัดไปขึ้นรอใต้ฉากนี้ก่อนเผย
    timers.push(setTimeout(() => onDone && onDone(), ordered.length * perMs + FINALE_MS + OUTRO_MS));
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ordered.length]);

  const current = index >= 0 && index < n ? ordered[index] : null;
  const isLineup = index === n;

  return (
    <div className={`oci${outro ? " oci-out" : ""}`} style={{ "--per": `${perMs}ms` }}>
      <div className="oci-bg" aria-hidden="true" />

      <div className="oci-chrome" aria-hidden="true">
        <i className="oc-tick tl" /><i className="oc-tick tr" /><i className="oc-tick bl" /><i className="oc-tick br" />
        <span className="oci-mark oc-latin">ECHO · <b>ORDEAL CALL</b></span>
        <span className="oci-mark is-r oc-latin">
          {isLineup || outro ? `${pad2(n)}/${pad2(n)}` : `${pad2(Math.max(0, index + 1))}/${pad2(n)}`}
        </span>
      </div>

      {current && <LockOn key={current.id} p={current} index={index} total={n} />}

      {!isLineup && !outro && (
        <div className="oci-roster" aria-hidden="true">
          {ordered.map((p, i) => (
            <span key={p.id} className={`oci-slot${i < index ? " is-done" : i === index ? " is-now" : ""}`} style={{ "--pc": p.color || "#3d8bd9" }}>
              <i />
              <b className="oc-latin">{pad2(p.position)}</b>
            </span>
          ))}
        </div>
      )}

      {(isLineup || outro) && <Lineup players={ordered} />}
    </div>
  );
}
