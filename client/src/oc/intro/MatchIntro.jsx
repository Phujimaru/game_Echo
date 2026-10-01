// ============================================================
//  ฉากเปิดแมตช์ ORDEAL CALL — ฉากเปิดตัวผู้เล่น + ดิ่งลงภูมิภาคเริ่มต้น ต่อเนื่องบนลูกโลกใบเดียว
//  <MatchIntro players area lowQ onOutro onHandoff onDone />
//
//  1) ลูกโลกกลางจอ · ผู้เล่นมาประจำที่ทีละคน (ตราหกเหลี่ยม + ชื่อ + ตัวละคร) เส้นโยงลงหมุดบนผิวโลก
//  2) รวมแถว: วงโคจรวาดรอบโลก + หัวข้อ
//  3) ไม่ตัดฉาก: ป้ายผู้เล่นหดลงหมุด → โลกหมุนหาภูมิภาคเริ่มต้น → ล็อก → ดิ่งชนผิวโลก → แฟลช/คลื่นกระแทก → จางเผยกระดาน
//
//  สัญญาเวลา (ต้องตรงกับ server/lobby.js gameIntroHoldSeconds()):
//    perMs = clamp(round(4200/n), 620..1000) · คนที่ i มาที่ 120 + i*perMs · รวมแถวที่ L = n*perMs
//    X = L + 2900 → เรียก onOutro() — App คืน { area, durationMs } ถ้า server ยังพักเกมรอฉากดิ่ง (โหมดการเดินทาง)
//      มีฉากดิ่ง: เล่นต่อ durationMs (App คิดจากเวลาพักที่เหลือ ≤ 7 วิ) แล้ว onDone
//      ไม่มี: จางหาย 1 วิ แล้ว onDone (ความยาวเท่าฉากเปิดตัวเดิม)
//    onHandoff = จังหวะที่ฉากนี้ทึบบังจอ → App สลับกระดานเป็นตัวจริงข้างใต้ (X+80ms หรือ X ถ้าไม่มีฉากดิ่ง)
// ============================================================
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import GlobeCanvas from "../../globe/GlobeCanvas";
import { regionDir } from "../../globe/globeCore";
import { clampJourneyArea } from "../../journey/areas";
import {
  REDUCED, clamp01, easeOutCubic, easeInOutCubic, span, aimAngles, setAim, createMarker, createDiveCamera,
} from "./diveKit";
import { DiveStreaks, DiveReticle, RegionTag, DiveImpact, Chrome } from "./DiveFx";
import "./dive.css";
import "./intro.css";

const FINALE_MS = 2900;
const OUTRO_MS = 1000;
const FIRST_MS = 120;
const HANDOFF_MS = 80;
const SWEEP = 2.6;      // มุมที่โลกหมุนเข้าหาภูมิภาคเริ่มต้น (เรเดียน)
const DRIFT = 0.12;     // โลกหมุนช้าๆ ระหว่างเปิดตัว (เรเดียน/วินาที)
// สัดส่วนเวลาของช่วงดิ่ง (คูณ D) — ลุคเดิมของ GlobeDive
const T = { title: 0.1, lock: 0.28, dive: 0.52, crash: 0.82 };
const VIEW_H = 2 * 6 * Math.tan((16 * Math.PI) / 180);
const DEG = Math.PI / 180;
const FULL = { x: 0, y: 0, s: 1 }; // ตำแหน่งโลกช่วงดิ่ง (ลุคเดิมของ GlobeDive)

const pad2 = (n) => String(Math.max(0, Math.floor(Number(n) || 0))).padStart(2, "0");
const introPerMs = (n) => Math.max(620, Math.min(1000, Math.round(4200 / Math.max(1, n))));

function useViewport() {
  const read = () => ({ w: window.innerWidth || 1600, h: window.innerHeight || 900 });
  const [vp, setVp] = useState(read);
  useEffect(() => {
    const on = () => setVp(read());
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return vp;
}

/**
 * ที่นั่งรอบลูกโลก (พิกเซลจอ) — สลับซ้าย/ขวาตามลำดับการมา เรียงบน→ล่างในแต่ละฝั่ง
 *  x,y = ขอบด้านในของป้าย (ฝั่งที่หันเข้าโลก) · pin = ทิศของหมุดบนผิวโลก (หน่วยฉาก หันเข้ากล้อง)
 */
function introGeometry(w, h, n) {
  const ppu = h / VIEW_H;
  const r = Math.max(140, Math.min(h * 0.285, w * 0.2));
  const cx = w / 2, cy = h / 2 + h * 0.035;
  const layout = { x: 0, y: -(cy - h / 2) / ppu, s: r / ppu };
  const R = r * 1.2 + 26;
  const nl = Math.ceil(n / 2), nr = n - nl;
  const spanY = Math.max(60, Math.min(cy - 150, h - cy - 96));
  const tMax = Math.min(56 * DEG, Math.asin(Math.min(1, spanY / R)));
  const step = Math.min(nl > 1 ? (2 * tMax) / (nl - 1) : 0, 36 * DEG);
  const seats = [];
  for (let i = 0; i < n; i++) {
    const left = i % 2 === 0;
    const k = Math.floor(i / 2);
    const count = left ? nl : nr;
    const t = (k - (count - 1) / 2) * step;
    const sx = left ? -1 : 1;
    const f = 0.62;
    const px = sx * f * Math.cos(t), py = -f * Math.sin(t);
    seats.push({
      side: left ? "l" : "r", t,
      x: cx + sx * R * Math.cos(t), y: cy + R * Math.sin(t),
      pin: [px, py, Math.sqrt(Math.max(0, 1 - px * px - py * py))],
    });
  }
  return { layout, cx, cy, r, R, seats };
}

function Seat({ p, seat, leaving, index }) {
  const [broken, setBroken] = useState(false);
  const src = p.character?.img || p.img;
  const style = {
    top: `${seat.y}px`,
    ...(seat.side === "l" ? { right: `calc(100% - ${seat.x}px)` } : { left: `${seat.x}px` }),
    "--c": p.color || "#3d8bd9",
    "--k": index,
  };
  return (
    <div className={`ocx-seat ${seat.side}${leaving ? " is-leave" : ""}`} style={style}>
      <div className="ocx-seat-in">
        <span className="ocx-hex" aria-hidden="true">
          <span className="ocx-hex-face">
            {src && !broken
              ? <img src={src} alt="" decoding="async" draggable={false} onError={() => setBroken(true)} />
              : <span className="ocx-hex-fallback">{(p.name || "?").slice(0, 1)}</span>}
          </span>
          <i className="ocx-hex-flash" />
        </span>
        <span className="ocx-plate">
          <span className="ocx-no oc-latin">P{p.position}</span>
          <b className="ocx-name">{p.name}</b>
          {p.character?.name && <small className="ocx-char">{p.character.name}</small>}
        </span>
      </div>
    </div>
  );
}

export default function MatchIntro({ players, area = 1, lowQ = false, onOutro, onHandoff, onDone }) {
  const ordered = useMemo(() => [...players].sort((a, b) => a.position - b.position), [players]);
  const n = ordered.length;
  const perMs = introPerMs(n);
  const L = n * perMs;
  const X = L + FINALE_MS;

  const vp = useViewport();
  const geo = useMemo(() => introGeometry(vp.w, vp.h, Math.max(1, n)), [vp.w, vp.h, n]);
  const geoRef = useRef(geo);
  useLayoutEffect(() => { geoRef.current = geo; });

  const [seen, setSeen] = useState(0);           // ผู้เล่นที่มาประจำที่แล้ว
  const [lineup, setLineup] = useState(false);
  const [mode, setMode] = useState("intro");     // intro | dive | out
  const [dive, setDive] = useState(null);        // { area, D }
  const [dphase, setDphase] = useState(0);       // ช่วงดิ่ง: 0 หมุนเข้า · 1 หัวข้อ · 2 ล็อก · 3 ดิ่ง · 4 ชน/เผย

  const cbRef = useRef({ onOutro, onHandoff, onDone });
  useLayoutEffect(() => { cbRef.current = { onOutro, onHandoff, onDone }; });
  // เส้นเวลาที่ลูป 3D อ่าน (ไม่ผ่าน React)
  const tlRef = useRef({ start: 0, dive: null });
  const tetherRefs = useRef([]);
  const reticleRef = useRef(null);
  const tagRef = useRef(null);
  const altRef = useRef(null);
  const globeWrapRef = useRef(null);

  useEffect(() => {
    const timers = [];
    const at = (ms, fn) => timers.push(setTimeout(fn, Math.max(0, ms)));
    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      cbRef.current.onDone?.();
    };
    for (let i = 0; i < n; i++) at(FIRST_MS + i * perMs, () => setSeen(i + 1));
    at(L, () => setLineup(true));
    at(X, () => {
      const spec = cbRef.current.onOutro?.() || null;
      if (spec && spec.durationMs > 0) {
        const D = Math.max(3000, Number(spec.durationMs) || 7000);
        const a = clampJourneyArea(spec.area);
        tlRef.current.dive = { at: performance.now(), D, area: a };
        setDive({ area: a, D });
        setMode("dive");
        at(HANDOFF_MS, () => cbRef.current.onHandoff?.());
        at(T.title * D, () => setDphase(1));
        at(T.lock * D, () => setDphase(2));
        at(T.dive * D, () => setDphase(3));
        at(T.crash * D, () => setDphase(4));
        at(D, done);
      } else {
        setMode("out");
        cbRef.current.onHandoff?.();
        at(OUTRO_MS, done);
      }
    });
    return () => timers.forEach(clearTimeout);
    // เส้นเวลาเริ่มครั้งเดียวต่อการ mount (App ใส่ key ใหม่ทุกแมตช์)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onReady = (core) => {
    const { THREE, world, scene } = core;
    const start = performance.now();
    tlRef.current.start = start;
    core.setAutoSpin(0);
    core.setDrag(false);
    // เปิดฉาก: โลกเล็กแล้วขยายเข้าที่ (ตำแหน่งปลายทางมาจาก prop layout ของ GlobeCanvas)
    const L0 = geoRef.current.layout;
    core.setLayout({ ...L0, s: L0.s * 0.72 }, true);
    core.setLayout(L0, false, 0.05);

    // ทิศเป้าหมายของภูมิภาคเริ่มต้น — หมุนโลกล่วงหน้าให้ช่วงดิ่งหมุนเข้าหามันพอดี SWEEP เรเดียน
    //  (คิดตอนเฟรมแรก — spin/tilt ของ core ถูกตั้งค่าในลูปเฟรม)
    let aimArea = clampJourneyArea(area);
    let aim = null;
    let target = regionDir(aimArea - 1);
    const yawAt = (ms) => aim.yaw - SWEEP - (REDUCED ? 0 : DRIFT * Math.max(0, X - ms) / 1000);

    // หมุดของผู้เล่นบนผิวโลก — ไม่หมุนตามโลก (อยู่ในชั้นของตัวเอง ตามตำแหน่ง/ขนาดของ world)
    const pinRoot = new THREE.Group();
    scene.add(pinRoot);
    const Z = new THREE.Vector3(0, 0, 1), Y = new THREE.Vector3(0, 1, 0);
    const disposables = [];
    const ringGeo = new THREE.RingGeometry(0.034, 0.044, 40);
    const pulseGeo = new THREE.RingGeometry(0.03, 0.035, 40);
    const dotGeo = new THREE.SphereGeometry(0.02, 16, 12);
    const beamGeo = new THREE.CylinderGeometry(0.0045, 0.0045, 0.16, 8, 1, true);
    disposables.push(ringGeo, pulseGeo, dotGeo, beamGeo);
    const pins = ordered.map((p, i) => {
      const seat = geoRef.current.seats[i];
      const dir = new THREE.Vector3(...seat.pin).normalize();
      const color = new THREE.Color(p.color || "#3d8bd9");
      const g = new THREE.Group();
      g.position.copy(dir).multiplyScalar(1.006);
      const face = new THREE.Group();
      face.quaternion.setFromUnitVectors(Z, dir);
      g.add(face);
      const mk = (geo, opacity) => {
        const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide });
        disposables.push(m);
        return new THREE.Mesh(geo, m);
      };
      const dot = mk(dotGeo, 1);
      const ring = mk(ringGeo, 0.95);
      const pulse = mk(pulseGeo, 0.8);
      face.add(ring, pulse);
      g.add(dot);
      const beam = mk(beamGeo, 0.55);
      beam.quaternion.setFromUnitVectors(Y, dir);
      beam.position.copy(dir).multiplyScalar(0.08);
      g.add(beam);
      g.scale.setScalar(0.001);
      pinRoot.add(g);
      return { g, pulse, dot, at: FIRST_MS + i * perMs, wp: new THREE.Vector3(), seat: i };
    });

    const diveCam = createDiveCamera(core, { lowQ, wrapEl: () => globeWrapRef.current });
    let marker = null;
    const P = new THREE.Vector3();
    const easeBack = (t) => { const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };

    const off = core.onFrame(() => {
      const now = performance.now();
      const ms = now - start;
      const dv = tlRef.current.dive;

      // ---------- ทิศของโลก ----------
      if (!aim) aim = aimAngles(core, target);
      if (dv && dv.area !== aimArea) { // ภูมิภาคจริงไม่ตรงกับที่เดาไว้ (ปกติเป็น 1 เสมอ)
        aimArea = dv.area;
        target = regionDir(aimArea - 1);
        aim = aimAngles(core, target);
      }
      if (!dv) {
        setAim(core, yawAt(Math.min(ms, X)), 0);
      } else {
        const du = (now - dv.at) / dv.D;
        const k = REDUCED ? 1 : easeInOutCubic(span(du, 0, T.lock));
        setAim(core, aim.yaw - SWEEP * (1 - k), aim.pitch * k);
      }

      // ---------- หมุดผู้เล่น ----------
      pinRoot.position.copy(world.position);
      pinRoot.scale.copy(world.scale);
      pinRoot.updateMatrixWorld(true);
      const leaveK = dv ? easeOutCubic(span(now - dv.at, 0, 520)) : 0;
      const lineupK = ms >= L ? span(ms, L, L + 900) : 0;
      const lines = tetherRefs.current;
      for (const pin of pins) {
        const a = span(ms, pin.at, pin.at + 420);
        let s = a > 0 ? easeBack(a) : 0.001;
        if (leaveK > 0) s *= 1 - leaveK;
        pin.g.scale.setScalar(Math.max(0.001, s));
        const pz = (((ms - pin.at) / 1200) % 1 + 1) % 1;
        const flash = lineupK > 0 && lineupK < 1 ? 1 + lineupK * 4 : 0;
        pin.pulse.scale.setScalar(flash || 1 + pz * 2.6);
        pin.pulse.material.opacity = flash ? 0.9 * (1 - lineupK) : 0.8 * (1 - pz);
        const el = lines[pin.seat];
        if (el && a > 0) {
          pin.g.getWorldPosition(pin.wp);
          const sp = core.project(pin.wp);
          el.setAttribute("x2", sp.x.toFixed(1));
          el.setAttribute("y2", sp.y.toFixed(1));
        }
      }

      if (!dv) return;
      // ---------- ช่วงดิ่ง (ลุคเดิมของ GlobeDive) ----------
      const u = (now - dv.at) / dv.D;
      if (!marker) marker = createMarker(core, target);
      P.copy(target);
      core.spin.localToWorld(P);
      marker.update(clamp01((u - T.lock + 0.04) / 0.08), now - dv.at);
      const d = REDUCED ? 0 : clamp01((u - T.dive) / (T.crash - T.dive));
      const e = Math.pow(d, 2.4);
      diveCam.frame(P, e, d);

      const sp = core.project(P);
      const ret = reticleRef.current;
      if (ret) ret.style.transform = `translate3d(${sp.x.toFixed(1)}px, ${sp.y.toFixed(1)}px, 0) scale(${(1 + 2.6 * e).toFixed(3)})`;
      const tag = tagRef.current;
      if (tag) tag.style.transform = `translate3d(${sp.x.toFixed(1)}px, ${sp.y.toFixed(1)}px, 0)`;
      if (altRef.current) {
        const alt = Math.max(0, core.camera.position.length() - 1);
        altRef.current.textContent = (alt * 1000).toFixed(1).padStart(7, "0");
      }
    });

    return () => {
      off();
      scene.remove(pinRoot);
      disposables.forEach((x) => x.dispose());
      world.rotation.set(0, 0, 0);
    };
  };

  const diving = mode === "dive";
  const crash = diving && dphase >= 4;
  const leaving = mode !== "intro";
  const A = dive ? dive.area : clampJourneyArea(area);
  const rootCls = [
    "ocd ocx",
    leaving ? "is-leaving" : "",
    mode === "out" ? "is-out" : "",
    diving ? `ocd-p${dphase}` : "",
    crash ? "is-crash" : "",
    lineup ? "is-lineup" : "",
    lowQ ? "is-lowq" : "",
  ].filter(Boolean).join(" ");
  const D = dive?.D || 7000;

  return (
    <div
      className={rootCls}
      style={{ "--rev": `${Math.round((1 - T.crash) * D)}ms`, "--per": `${perMs}ms`, "--hex": n > 4 ? "clamp(78px, 11vh, 104px)" : "clamp(88px, 13vh, 122px)" }}
    >
      <div className="ocd-bg" aria-hidden="true" />
      <div className="ocd-globe" ref={globeWrapRef}>
        <GlobeCanvas shared={false} layout={diving ? FULL : geo.layout} layoutRate={0.04} drag={false} sand={!lowQ} autoSpin={0} onReady={onReady} />
      </div>

      {/* วงโคจร + เส้นโยงที่นั่งถึงหมุดบนผิวโลก */}
      <svg className="ocx-orbit" aria-hidden="true">
        <circle className="ocx-orbit-ring" cx={geo.cx} cy={geo.cy} r={geo.R} pathLength="1" />
        <circle className="ocx-orbit-sweep" cx={geo.cx} cy={geo.cy} r={geo.R + 8} pathLength="1" />
        {ordered.map((p, i) => {
          if (i >= seen) return null;
          const s = geo.seats[i];
          return (
            <g key={p.id} className="ocx-tether" style={{ "--c": p.color || "#3d8bd9" }}>
              <line
                ref={(el) => { tetherRefs.current[i] = el; }}
                x1={s.x} y1={s.y} x2={s.x} y2={s.y} pathLength="1"
              />
            </g>
          );
        })}
      </svg>

      {ordered.map((p, i) => (i < seen ? <Seat key={p.id} p={p} seat={geo.seats[i]} leaving={leaving} index={i} /> : null))}

      <div className="ocx-title" aria-hidden={!lineup}>
        <h1 className="ocx-title-h">เริ่มการประลอง</h1>
      </div>

      {diving && (
        <>
          <DiveStreaks show={dphase === 3} seed={A} lowQ={lowQ} />
          <DiveReticle ref={reticleRef} />
          <RegionTag ref={tagRef} area={A} />
          <div className="ocd-head">
            <h1 className="ocd-title">เริ่มการเดินทาง</h1>
          </div>
        </>
      )}

      <Chrome>
        {diving
          ? <span className="ocd-mark is-r oc-latin"><b>{pad2(A)}</b> · <b ref={altRef}>05000.0</b></span>
          : <span className="ocd-mark is-r oc-latin"><b>{pad2(seen)}</b> / {pad2(n)}</span>}
      </Chrome>

      {diving && <DiveImpact area={A} lowQ={lowQ} />}
    </div>
  );
}
