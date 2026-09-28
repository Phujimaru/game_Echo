// ============================================================
//  แผนที่การเดินทาง (overlay เต็มจอ) — แนวตั้ง อ่านจากล่าง (ภูมิภาค 1) ขึ้นบน (ภูมิภาค 7)
//
//  <JourneyMap mode="start"|"advance" area={1..7} fromArea={1..7} durationMs={ms} lowQ={bool} onDone={fn} />
//   start   : กล้องเริ่มล่างสุด -> แพนขึ้นโชว์เส้นทางถึงยอด (ภูมิภาค 7 เรืองแดง) -> กลับลงมา
//             หมุดลงที่โหนด 1 + การ์ด "การเดินทางเริ่มต้นขึ้น"
//   advance : หมุดออกจาก fromArea เดินตามเส้นทางไปโหนด area กล้องเลื่อนตาม หมอกจางออก โหนดสว่าง
//             การ์ด "มุ่งหน้าสู่ภูมิภาคถัดไป" -> "ภูมิภาคที่ N" + ชื่อ
//  ทุกเฟสถูกจัดเวลาตามสัดส่วนของ durationMs และเรียก onDone() ครั้งเดียวตอนจบ (เฟดออก 500ms สุดท้าย)
//
//  ประสิทธิภาพ: กล้อง/หมุด/เส้นทางใช้ Web Animations API (transform บน compositor) — ไม่มี re-render ต่อเฟรม
//  React state เปลี่ยนแค่ ~5 ครั้งต่อรอบ (สลับเฟส) ด้วย setTimeout ที่ล้างทิ้งทั้งหมดตอน unmount
// ============================================================

import { memo, useEffect, useRef, useState } from "react";
import { JOURNEY_AREAS, clampJourneyArea } from "./areas";
import JourneyEmblem from "./Emblem";
import MapArt from "./MapArt";
import { seeded } from "./geometry";
import { NODES, K, MW, routeD, routeBox, routeSamples, camFor, vh } from "./mapGeometry";
import "./journey.css";

const FADE_OUT_MS = 500;
const EASE_TRAVEL = "cubic-bezier(0.55, 0, 0.3, 1)";

// สัดส่วนเวลาของแต่ละเฟส (คูณ durationMs)
const START_T = { reveal: 0.07, panUp0: 0.08, top: 0.4, omen: 0.34, back: 0.52, down: 0.7, settle: 0.7, drop: 0.07, title: 0.75 };
const ADV_T = { kicker: 0.05, depart: 0.16, travel: 0.18, travelLen: 0.48, fog: 0.46, arrive: 0.66, title: 0.71 };

const tY = (v) => `translate3d(0, ${Math.round(v * 1000) / 1000}vh, 0)`;
const tXY = (x, y) => `translate3d(${vh(x)}, ${vh(y)}, 0)`;

// ---------- แคชเส้นทาง ----------
const ROUTE_CACHE = new Map();
function route(a, b) {
  const k = `${a}-${b}`;
  if (!ROUTE_CACHE.has(k)) ROUTE_CACHE.set(k, { d: routeD(a, b), box: routeBox(a, b, 24) });
  return ROUTE_CACHE.get(k);
}

function RouteSvg({ a, b, className, style, svgRef, children }) {
  if (b <= a) return null;
  const { d, box } = route(a, b);
  return (
    <svg
      ref={svgRef}
      className={className}
      style={{ left: vh(box.x), top: vh(box.y), width: vh(box.w), height: vh(box.h), ...style }}
      viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {children(d)}
    </svg>
  );
}

const baseStroke = (d) => (
  <>
    <path d={d} stroke="#0c0805" strokeWidth="14" fill="none" opacity="0.7" strokeLinecap="round" />
    <path d={d} stroke="#c9992f" strokeWidth="4" strokeDasharray="14 12" fill="none" opacity="0.6" />
  </>
);
const litStroke = (d) => (
  <>
    <path d={d} stroke="#0c0805" strokeWidth="16" fill="none" opacity="0.75" strokeLinecap="round" />
    <path d={d} stroke="#ffcf6a" strokeWidth="20" fill="none" opacity="0.16" strokeLinecap="round" />
    <path d={d} stroke="#f3d27a" strokeWidth="5" fill="none" strokeLinecap="round" />
    <path d={d} stroke="#fff3c8" strokeWidth="1.6" strokeDasharray="10 14" fill="none" />
  </>
);

// ---------- ฝุ่นทองลอย ----------
const MOTES = (() => {
  const r = seeded(4242);
  return Array.from({ length: 16 }, () => {
    const dur = 9 + r() * 9;
    return {
      left: `${Math.round(r() * 1000) / 10}%`,
      width: `${Math.round((0.3 + r() * 0.5) * 100) / 100}vh`,
      height: `${Math.round((0.3 + r() * 0.5) * 100) / 100}vh`,
      "--dx": `${Math.round((r() - 0.5) * 120) / 10}vw`,
      animationDuration: `${Math.round(dur * 10) / 10}s`,
      animationDelay: `${Math.round(-r() * dur * 10) / 10}s`,
    };
  });
})();

// ---------- โหนดของแต่ละภูมิภาค ----------
function MapNode({ node, state, burst, lowQ }) {
  const A = JOURNEY_AREAS[node.id - 1];
  const right = node.x < MW / 2;
  return (
    <div
      className={`jm-node is-${state}${node.id === 7 ? " is-end" : ""}`}
      style={{ left: vh(node.x), top: vh(node.y), "--c": A.color, "--g": A.glow }}
    >
      <div className="jm-node-glow" />
      {state === "current" && !lowQ && <div className="jm-node-ring" />}
      {burst && <div className="jm-node-burst" />}
      <div className="jm-medal">
        <JourneyEmblem icon={A.icon} className="jm-emb jm-emb-dim" color="#7d6843" size="56%" />
        <JourneyEmblem icon={A.icon} className="jm-emb jm-emb-lit" color={A.glow} size="56%" />
      </div>
      <div className={`jm-plaque ${right ? "is-right" : "is-left"}`}>
        <span className="jm-plaque-num">{A.numeral}</span>
        <span className="jm-plaque-name">{A.name}</span>
      </div>
    </div>
  );
}

function Token({ state }) {
  return (
    <div className="jm-token">
      <div className="jm-token-glow" />
      <div className={`jm-token-hop${state ? ` ${state}` : ""}`}>
        <div className="jm-token-bob">
          <svg viewBox="0 0 60 100" aria-hidden="true">
            <ellipse cx="18" cy="96" rx="12" ry="3.5" fill="rgba(0,0,0,0.55)" />
            <path d="M18 8 V96" stroke="#5e3f08" strokeWidth="4" strokeLinecap="round" />
            <path d="M18 8 V96" stroke="#e8bf5a" strokeWidth="1.8" strokeLinecap="round" />
            <path d="M19 12 H54 L45 27 L54 42 H19 Z" fill="#8f1d2c" stroke="#ffe9a8" strokeWidth="1.8" strokeLinejoin="round" />
            <path d="M19 38 H52" stroke="#5a0f1a" strokeWidth="2" opacity="0.6" />
            <path d="M33 18 L35.2 24.4 L42 24.6 L36.6 28.6 L38.6 35 L33 31.2 L27.4 35 L29.4 28.6 L24 24.6 L30.8 24.4 Z" fill="#ffe9a8" />
            <circle cx="18" cy="7" r="4.6" fill="#ffe9a8" stroke="#8a6414" strokeWidth="1.4" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function Rail({ current }) {
  return (
    <div className="jm-rail" aria-hidden="true">
      <div className="jm-rail-line" />
      {[...JOURNEY_AREAS].reverse().map((A) => (
        <div
          key={A.id}
          className={`jm-pip${A.id < current ? " is-done" : A.id === current ? " is-cur" : ""}${A.id === 7 ? " is-end" : ""}`}
          style={{ "--c": A.color, "--g": A.glow }}
        >
          <span>{A.numeral}</span>
        </div>
      ))}
    </div>
  );
}

// ============================================================
//  หนึ่งรอบการเล่น (ถูก remount ด้วย key ทุกครั้งที่ props หลักเปลี่ยน -> เริ่มใหม่สะอาด)
// ============================================================

function MapRun({ mode, from, to, D, lowQ, onDoneRef }) {
  const sheetRef = useRef(null);
  const markerRef = useRef(null);
  const trailRef = useRef(null);
  const [phase, setPhase] = useState(0);
  const isStart = mode === "start";
  const travel = !isStart && to > from;

  const camStart = isStart ? camFor(NODES[0].y, 0.55) : camFor(NODES[from - 1].y, 0.52);
  const markerNode = NODES[(isStart ? 1 : from) - 1];

  useEffect(() => {
    const timers = [];
    const anims = [];
    const at = (ms, fn) => timers.push(setTimeout(fn, Math.max(0, ms)));
    const play = (el, keyframes, opts) => {
      if (!el) return;
      if (typeof el.animate === "function") {
        anims.push(el.animate(keyframes, { fill: "both", ...opts }));
      } else {
        // ไม่มี WAAPI: กระโดดไปสถานะสุดท้ายเลย
        const last = { ...keyframes[keyframes.length - 1] };
        delete last.offset;
        delete last.easing;
        Object.assign(el.style, last);
      }
    };
    let fired = false;
    const finish = () => {
      if (fired) return;
      fired = true;
      if (typeof onDoneRef.current === "function") onDoneRef.current();
    };

    if (isStart) {
      const bottom = camFor(NODES[0].y, 0.55);
      const top = camFor(NODES[6].y, 0.5);
      play(
        sheetRef.current,
        [
          { offset: 0, transform: tY(bottom) },
          { offset: START_T.panUp0, transform: tY(bottom), easing: "cubic-bezier(0.5, 0, 0.25, 1)" },
          { offset: START_T.top, transform: tY(top) },
          { offset: START_T.back, transform: tY(top), easing: "cubic-bezier(0.65, 0, 0.2, 1)" },
          { offset: START_T.down, transform: tY(bottom) },
          { offset: 1, transform: tY(bottom) },
        ],
        { duration: D }
      );
      const n1 = NODES[0];
      play(
        markerRef.current,
        [
          { opacity: 0, transform: `translate3d(${vh(n1.x)}, ${(n1.y * K - 14).toFixed(3)}vh, 0)` },
          { opacity: 1, transform: tXY(n1.x, n1.y) },
        ],
        { duration: START_T.drop * D, delay: START_T.settle * D, easing: "cubic-bezier(0.3, 1.45, 0.5, 1)" }
      );
      at(START_T.reveal * D, () => setPhase(1));
      at(START_T.omen * D, () => setPhase(2));
      at(START_T.back * D, () => setPhase(3));
      at(START_T.settle * D, () => setPhase(4));
      at(START_T.title * D, () => setPhase(5));
    } else {
      if (travel) {
        const pts = routeSamples(from, to, 12 * (to - from) + 36);
        const timing = { duration: ADV_T.travelLen * D, delay: ADV_T.travel * D, easing: EASE_TRAVEL };
        play(markerRef.current, pts.map((p) => ({ transform: tXY(p.x, p.y) })), timing);
        play(sheetRef.current, pts.map((p) => ({ transform: tY(camFor(p.y, 0.52)) })), timing);
        play(trailRef.current, [{ strokeDashoffset: "1" }, { strokeDashoffset: "0" }], timing);
      }
      at(ADV_T.kicker * D, () => setPhase(1));
      at(ADV_T.depart * D, () => setPhase(2));
      at(ADV_T.fog * D, () => setPhase(3));
      at(ADV_T.arrive * D, () => setPhase(4));
      at(ADV_T.title * D, () => setPhase(5));
    }
    at(D, finish);
    return () => {
      timers.forEach(clearTimeout);
      anims.forEach((a) => a.cancel());
    };
  }, [isStart, travel, from, to, D, onDoneRef]);

  // ---------- สถานะที่ได้จากเฟส ----------
  const nodeState = (id) => {
    if (isStart) return id === 1 && phase >= 4 ? "current" : "locked";
    if (id < from) return "visited";
    if (id === from) return travel && phase >= 2 ? "visited" : "current";
    if (id < to) return phase >= 3 ? "visited" : "locked";
    if (id === to) return phase >= 4 ? "current" : "locked";
    return "locked";
  };
  const fogClear = (id) => {
    if (isStart) return id === 1 && phase >= 4;
    if (id <= from) return true;
    if (id <= to) return phase >= 3;
    return false;
  };
  const burstId = isStart ? (phase >= 4 ? 1 : 0) : travel && phase >= 4 ? to : 0;
  const railCur = isStart ? (phase >= 4 ? 1 : 0) : phase >= 4 ? to : from;
  const tokenState = isStart ? (phase >= 4 ? "is-landed" : "") : phase >= 4 ? "is-landed" : phase >= 2 && travel ? "is-moving" : "";
  const toA = JOURNEY_AREAS[to - 1];
  const fromA = JOURNEY_AREAS[from - 1];

  return (
    <div
      className={`jm${lowQ ? " jm-lowq" : ""}${isStart ? " jm-mode-start" : " jm-mode-advance"}`}
      style={{ animation: `jmIn 450ms ease-out both, jmOut ${FADE_OUT_MS}ms ease-in ${Math.max(0, D - FADE_OUT_MS)}ms forwards` }}
      role="presentation"
    >
      <div className="jm-bg" />
      <div ref={sheetRef} className="jm-sheet" style={{ transform: tY(camStart) }}>
        <div className="jm-paper" />
        {NODES.map((n) => (
          <div
            key={n.id}
            className="jm-wash"
            style={{
              left: vh(n.x - 460),
              top: vh(n.y - 260),
              width: vh(920),
              height: vh(520),
              background: `radial-gradient(closest-side, color-mix(in srgb, ${JOURNEY_AREAS[n.id - 1].color} ${n.id === 7 ? 30 : 16}%, transparent), transparent)`,
            }}
          />
        ))}
        <MapArt />
        {NODES.slice(0, -1).map((n) => (
          <RouteSvg
            key={n.id}
            a={n.id}
            b={n.id + 1}
            className={`jm-route${isStart ? " jm-seg-reveal" : ""}`}
            style={isStart ? { animationDelay: `${Math.round((START_T.panUp0 + ((START_T.top - START_T.panUp0) * (n.id - 0.6)) / 6) * D)}ms` } : undefined}
          >
            {baseStroke}
          </RouteSvg>
        ))}
        {!isStart && from > 1 && (
          <RouteSvg a={1} b={from} className="jm-route">
            {litStroke}
          </RouteSvg>
        )}
        {travel && (
          <RouteSvg a={from} b={to} className="jm-route">
            {(d) => (
              <g ref={trailRef} style={{ strokeDasharray: "1 1", strokeDashoffset: 1 }}>
                <path d={d} pathLength="1" stroke="#0c0805" strokeWidth="16" fill="none" opacity="0.75" />
                <path d={d} pathLength="1" stroke="#ffcf6a" strokeWidth="20" fill="none" opacity="0.2" />
                <path d={d} pathLength="1" stroke="#f3d27a" strokeWidth="5" fill="none" />
              </g>
            )}
          </RouteSvg>
        )}
        {NODES.map((n) => (
          <div key={n.id} className={`jm-fog${fogClear(n.id) ? " is-clear" : ""}${n.id === 7 ? " is-end" : ""}`} style={{ top: vh(n.y - (n.id === 7 ? 420 : 200)), height: vh(n.id === 7 ? 560 : 400) }}>
            <div className="jm-fog-inner" style={{ animationDelay: `${-n.id * 3}s` }} />
          </div>
        ))}
        <div className={`jm-n7glow${isStart && phase === 2 ? " is-omen" : ""}`} style={{ left: vh(NODES[6].x), top: vh(NODES[6].y) }} />
        {NODES.map((n) => (
          <MapNode key={n.id} node={n} state={nodeState(n.id)} burst={burstId === n.id && !lowQ} lowQ={lowQ} />
        ))}
        <div ref={markerRef} className="jm-marker" style={{ transform: tXY(markerNode.x, markerNode.y), opacity: isStart ? 0 : 1 }}>
          <Token state={tokenState} />
        </div>
      </div>

      <div className={`jm-omen${isStart && phase === 2 ? " is-on" : ""}`} />
      <div className="jm-vignette" />
      {!lowQ && (
        <div className="jm-motes" aria-hidden="true">
          {MOTES.map((m, i) => (
            <i key={i} className="jm-mote" style={m} />
          ))}
        </div>
      )}
      <Rail current={railCur} />

      <div className="jm-cards">
        {isStart ? (
          <div className={`jm-card${phase >= 5 ? " is-on" : ""}`}>
            <div className="jm-card-kicker">บันทึกแห่งการเดินทาง</div>
            <div className="jm-card-title">การเดินทางเริ่มต้นขึ้น</div>
            <div className="jm-card-rule">
              <i />
              <b />
              <i />
            </div>
            <div className="jm-card-sub" style={{ "--c": JOURNEY_AREAS[0].glow }}>
              ภูมิภาคที่ 1 · {JOURNEY_AREAS[0].name}
            </div>
          </div>
        ) : (
          <>
            <div className={`jm-card jm-card-a${phase >= 1 && phase < 5 ? " is-on" : ""}`}>
              <div className="jm-card-title jm-card-title-sm">มุ่งหน้าสู่ภูมิภาคถัดไป</div>
              <div className="jm-card-rule">
                <i />
                <b />
                <i />
              </div>
              <div className="jm-card-sub">ออกเดินทางจาก {fromA.name}</div>
            </div>
            <div className={`jm-card${phase >= 5 ? " is-on" : ""}${to === 7 ? " is-end" : ""}`} style={{ "--c": toA.color, "--g": toA.glow }}>
              <div className="jm-card-kicker">ภูมิภาคที่ {to}</div>
              <div className="jm-card-title jm-card-title-area">{toA.name}</div>
              <div className="jm-card-rule">
                <i />
                <b />
                <i />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function JourneyMap({ mode = "advance", area = 1, fromArea, durationMs, lowQ = false, onDone }) {
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  const isStart = mode === "start";
  const to = isStart ? 1 : clampJourneyArea(area);
  let from = isStart ? 1 : clampJourneyArea(fromArea == null ? to - 1 : fromArea);
  if (from > to) from = to;
  const D = Math.max(2000, Number(durationMs) || (isStart ? 7000 : 6000));
  const runKey = `${isStart ? "s" : "a"}|${from}|${to}|${D}`;

  return <MapRun key={runKey} mode={isStart ? "start" : "advance"} from={from} to={to} D={D} lowQ={!!lowQ} onDoneRef={onDoneRef} />;
}

export default memo(JourneyMap);
