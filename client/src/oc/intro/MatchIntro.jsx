// ============================================================
//  ฉากเปิดแมตช์ ORDEAL CALL — ต่อจากหน้าเลือกโหมดบน "ลูกโลกร่วม" ใบเดิม (ไม่ตัดฉาก)
//  <MatchIntro players area lowQ onOutro onHandoff onDone />
//
//  1) โลกใบเดิมของหน้าเลือกโหมดเลื่อน/ย่อมากลางจอ · การ์ดผู้เล่นไหลเข้ามาทีละใบแล้วโคจรรอบโลก (วงรีเอียง 1–2 วง)
//  2) รวมแถว: หัวข้อ "เริ่มการประลอง" + วงโคจรเรือง · การ์ดยังโคจรต่อ
//  3) การ์ดไหลออก → โลกหมุนเข้าหาภูมิภาคเริ่มต้น (หมุนต่อเนื่องมาตั้งแต่ต้นฉาก) → ล็อก → ดิ่งชนผิวโลก
//     → แฟลชขาวทึบ: onHandoff (App ปิดลูกโลกร่วม + mount กระดานใต้แฟลช) → แฟลชจางเผยกระดาน
//
//  ลูกโลก: GlobeCanvas โหมดร่วม (canvas อยู่ใน SharedGlobeStage ชั้นล่างสุด — App ถือว่า "gameintro" เป็นหน้าลูกโลก)
//   ฉากนี้โปร่งใส (ไม่มีพื้นของตัวเอง) · ถอด GlobeCanvas ทันทีที่ส่งต่อ ไม่ให้สร้าง canvas ใหม่ตอนฉากร่วมปิด
//
//  สัญญาเวลา (ต้องตรงกับ server/lobby.js gameIntroHoldSeconds()):
//    perMs = clamp(round(4200/n), 620..1000) · การ์ดใบที่ i เข้าที่ 120 + i*perMs · รวมแถวที่ L = n*perMs
//    X = L + 2900 → onOutro() — App คืน { area, durationMs } ถ้า server ยังพักเกมรอฉากดิ่ง (โหมดการเดินทาง)
//      มีฉากดิ่ง: ยาว D = durationMs (≤ 7 วิ) · ส่งต่อที่ชน (0.82D + 0.1 ของช่วงเผย) · onDone ที่ X + D
//      ไม่มี: การ์ดไหลออก + ม่านขาว · ส่งต่อที่ X+600 · onDone ที่ X+1300 (server พักเกินนี้อย่างน้อย 1 วิ)
//      Purge ({ warp }): พุ่งเข้าทางช้างเผือก · Moon Cell ({ moon }): กล้องโค้งอ้อมหลังโลก เห็นดวงจันทร์ แล้วซูมเข้า (moonFlight.js)
// ============================================================
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import GlobeCanvas from "../../globe/GlobeCanvas";
import { regionDir } from "../../globe/globeCore";
import { clampJourneyArea } from "../../journey/areas";
import {
  REDUCED, clamp01, easeOutCubic, easeInOutCubic, span, aimAngles, setAim, nearYaw, createMarker, createDiveCamera,
} from "./diveKit";
import { DiveStreaks, DiveReticle, RegionTag, DiveImpact, Chrome } from "./DiveFx";
import "./dive.css";
import "./intro.css";
import WarpGalaxy from "../../purge/GalaxyWarp";
import { createMoonFlight } from "./moonFlight";

const FINALE_MS = 2900;
const FIRST_MS = 120;
const FLOW_IN_MS = 1100;
const FLOW_OUT_MS = 650;
const OUT_HANDOFF_MS = 600;   // ไม่มีฉากดิ่ง: ม่านขาวทึบแล้ว → ส่งต่อ
const OUT_DONE_MS = 1300;
const SWEEP = 2.6;            // โลกหมุนอย่างน้อยเท่านี้ก่อนหยุดที่ภูมิภาคเริ่มต้น (เรเดียน)
const ORBIT_SPEED = 0.5;      // ความเร็วการ์ดบนวงโคจร (เรเดียน/วินาที)
const T = { title: 0.1, lock: 0.28, dive: 0.52, crash: 0.82 }; // สัดส่วนเวลาช่วงดิ่ง (คูณ D) — ลุคเดิมของ GlobeDive
const HANDOFF_REV = 0.1;      // ส่งต่อหลังเริ่มชน = 10% ของช่วงเผย (แฟลชทึบเต็มช่วง 7–26%)
const VIEW_H = 2 * 6 * Math.tan((16 * Math.PI) / 180);
const DEG = Math.PI / 180;
const FULL = { x: 0, y: 0, s: 1 };
const TAU = Math.PI * 2;

const pad2 = (n) => String(Math.max(0, Math.floor(Number(n) || 0))).padStart(2, "0");
const introPerMs = (n) => Math.max(620, Math.min(1000, Math.round(4200 / Math.max(1, n))));
const easeInCubic = (t) => t * t * t;

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

/** ตำแหน่งโลกช่วงเปิดตัว (หน่วยฉาก) — กลางจอ ต่ำลงเล็กน้อยให้หัวข้อซ้ายบน */
function introLayout(w, h) {
  const ppu = h / VIEW_H;
  const r = Math.max(130, Math.min(h * 0.25, w * 0.17));
  return { x: 0, y: -(h * 0.03) / ppu, s: r / ppu };
}

/** วงโคจร: n ≤ 3 = วงเดียว · มากกว่านั้นสองวงไขว้กัน หมุนสวนทาง */
function orbitPlan(n) {
  const rings = n > 3
    ? [{ tilt: -9 * DEG, dir: 1, k: 1 }, { tilt: 12 * DEG, dir: -1, k: 1.13 }]
    : [{ tilt: -8 * DEG, dir: 1, k: 1 }];
  const counts = rings.map((_, r) => Array.from({ length: n }, (_, i) => i).filter((i) => i % rings.length === r).length);
  const slots = Array.from({ length: n }, (_, i) => {
    const r = i % rings.length;
    const j = Math.floor(i / rings.length);
    return { ring: r, theta0: Math.PI / 2 + (j / counts[r]) * TAU + r * (Math.PI / Math.max(1, counts[r])) };
  });
  return { rings, slots };
}

function OrbitCard({ p, cardRef }) {
  const [broken, setBroken] = useState(false);
  const src = p.character?.img || p.img;
  return (
    <div className="ocx-card" ref={cardRef} style={{ "--c": p.color || "#3d8bd9" }}>
      <div className="ocx-card-in">
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
  const plan = useMemo(() => orbitPlan(Math.max(1, n)), [n]);

  const vp = useViewport();
  const layout = useMemo(() => introLayout(vp.w, vp.h), [vp.w, vp.h]);

  const [seen, setSeen] = useState(0);            // การ์ดที่ไหลเข้ามาแล้ว
  const [lineup, setLineup] = useState(false);
  const [mode, setMode] = useState("intro");      // intro | dive | out
  const [dive, setDive] = useState(null);         // { area, D }
  const [dphase, setDphase] = useState(0);        // ช่วงดิ่ง: 0 หมุนเข้า · 1 หัวข้อ · 2 ล็อก · 3 ดิ่ง · 4 ชน/เผย
  const [handed, setHanded] = useState(false);    // ส่งต่อแล้ว — ลูกโลกร่วมปิด ห้าม render GlobeCanvas อีก
  const [warp, setWarp] = useState(null);         // Purge: ปลายฉากพุ่งออกสู่ทางช้างเผือก { D }
  const [moon, setMoon] = useState(null);         // Moon Cell: ปลายฉากบินอ้อมโลกไปดวงจันทร์ { D }

  const cbRef = useRef({ onOutro, onHandoff, onDone });
  useLayoutEffect(() => { cbRef.current = { onOutro, onHandoff, onDone }; });
  const tlRef = useRef({ start: 0, dive: null, out: false });
  const cardRefs = useRef([]);
  const orbitRefs = useRef([]);
  const reticleRef = useRef(null);
  const tagRef = useRef(null);
  const altRef = useRef(null);

  useEffect(() => {
    const timers = [];
    const at = (ms, fn) => timers.push(setTimeout(fn, Math.max(0, ms)));
    let finished = false, handedOff = false;
    const handoff = () => {
      if (handedOff) return;
      handedOff = true;
      setHanded(true);
      cbRef.current.onHandoff?.();
    };
    const done = () => {
      if (finished) return;
      finished = true;
      handoff();
      cbRef.current.onDone?.();
    };
    for (let i = 0; i < n; i++) at(FIRST_MS + i * perMs, () => setSeen(i + 1));
    at(L, () => setLineup(true));
    at(X, () => {
      const spec = cbRef.current.onOutro?.() || null;
      if (spec && spec.moon) {
        // Moon Cell: การ์ดไหลออก → กล้องโค้งอ้อมหลังโลก → ดวงจันทร์โผล่ → ซูมเข้า → แฟลชขาวส่งต่อ
        const D = Math.max(2400, Number(spec.durationMs) || 5600);
        tlRef.current.out = true;
        tlRef.current.moon = { at: performance.now(), D };
        setMoon({ D });
        setMode("moon");
        at(D - 300, handoff);
        at(D, done);
      } else if (spec && spec.warp) {
        // Purge: เส้นพุ่งออกจากโลก → ซูมเข้าเส้น → หันตามทิศเส้น → พุ่งเข้าทางช้างเผือก (3D) → แฟลชส่งต่อฉากท่อ
        const D = Math.max(1800, Number(spec.durationMs) || 4600);
        tlRef.current.out = true;
        setWarp({ D });
        setMode("warp");
        at(D - 350, handoff);
        at(D, done);
      } else if (spec && spec.durationMs > 0) {
        const D = Math.max(3000, Number(spec.durationMs) || 7000);
        const a = clampJourneyArea(spec.area);
        tlRef.current.dive = { at: performance.now(), D, area: a };
        setDive({ area: a, D });
        setMode("dive");
        at(T.title * D, () => setDphase(1));
        at(T.lock * D, () => setDphase(2));
        at(T.dive * D, () => setDphase(3));
        at(T.crash * D, () => setDphase(4));
        at((T.crash + (1 - T.crash) * HANDOFF_REV) * D, handoff);
        at(D, done);
      } else {
        tlRef.current.out = true;
        setMode("out");
        at(OUT_HANDOFF_MS, handoff);
        at(OUT_DONE_MS, done);
      }
    });
    return () => timers.forEach(clearTimeout);
    // เส้นเวลาเริ่มครั้งเดียวต่อการ mount (App ใส่ key ใหม่ทุกแมตช์)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onReady = (core) => {
    const { THREE, camera } = core;
    const start = performance.now();
    tlRef.current.start = start;
    core.setAutoSpin(0);
    core.setDrag(false);
    // โหมดประหยัด: ซ่อนละอองดาวของลูกโลกร่วมระหว่างฉาก (คืนตอนถอด)
    const sandShown = core.sand ? core.sand.visible : false;
    if (lowQ && core.sand) core.sand.visible = false;
    // canvas จริงของลูกโลกร่วม — ใส่ภาพพร่า/ขยายตอนใกล้ชน
    const stageEl = () => core.renderer?.domElement?.parentElement || null;

    // ทิศของโลก: หมุนต่อเนื่องเส้นเดียวตั้งแต่เปิดฉากจนหยุดที่ภูมิภาคเริ่มต้น (จบที่ X + 0.28D)
    //  มุมรวม Θ ≡ yaw ของเป้าหมาย (mod 2π) และไม่น้อยกว่า SWEEP · เริ่มจาก world.rotation = 0 (ต่อจากหน้าเลือกโหมด)
    let aimArea = clampJourneyArea(area);
    let target = regionDir(aimArea - 1);
    let wraps = null, lastYaw = null;
    const totalTurn = (yaw) => {
      lastYaw = lastYaw == null ? yaw : nearYaw(lastYaw, yaw); // ไม่ให้กระโดด 2π ตอนข้าม ±π
      if (wraps == null) wraps = Math.ceil((SWEEP - lastYaw) / TAU);
      return lastYaw + wraps * TAU;
    };

    let diveCam = null;
    let marker = null;
    let moonCam = null;
    const P = new THREE.Vector3();
    const ring = { cx: 0, cy: 0, r: 1 };

    const off = core.onFrame(() => {
      const now = performance.now();
      const ms = now - start;
      const dv = tlRef.current.dive;

      // ---------- ทิศของโลก ----------
      if (dv && dv.area !== aimArea) { aimArea = dv.area; target = regionDir(aimArea - 1); lastYaw = null; }
      const aim = aimAngles(core, target);
      const theta = totalTurn(aim.yaw);
      const turnEnd = X + T.lock * (dv ? dv.D : 7000);
      if (REDUCED) {
        if (dv) setAim(core, aim.yaw, aim.pitch);
      } else {
        const k = easeInOutCubic(clamp01(ms / turnEnd));
        const pk = dv ? easeInOutCubic(span(now - dv.at, 0, T.lock * dv.D)) : 0;
        setAim(core, theta * k, aim.pitch * pk);
      }

      // ---------- การ์ดโคจร ----------
      const { w: W, h: H } = core.size;
      const ppu = H / VIEW_H;
      ring.cx = W / 2 + core.world.position.x * ppu;
      ring.cy = H / 2 - core.world.position.y * ppu;
      ring.r = core.world.scale.x * ppu;
      const aBase = Math.min(ring.r * 1.55 + 64, W / 2 - 300);
      const hexPx = n > 4 ? Math.max(60, Math.min(84, H * 0.085)) : Math.max(68, Math.min(96, H * 0.1));
      const cardOff = (hexPx + 170) / 2 - hexPx / 2; // กลางการ์ดอยู่ขวาของจุดยึด (กลางตรา) เท่านี้
      plan.rings.forEach((rg, r) => {
        const el = orbitRefs.current[r];
        if (!el) return;
        const a = aBase * rg.k, b = a * 0.3;
        el.setAttribute("transform", `translate(${ring.cx.toFixed(1)} ${ring.cy.toFixed(1)}) rotate(${(rg.tilt / DEG).toFixed(2)})`);
        el.style.setProperty("--a", a.toFixed(1));
        for (const path of el.children) {
          // ครึ่งหน้า (ล่าง ใกล้กล้อง) กับครึ่งหลัง (บน หลังโลก)
          const front = path.dataset.half === "front";
          path.setAttribute("d", `M ${a.toFixed(1)} 0 A ${a.toFixed(1)} ${b.toFixed(1)} 0 0 ${front ? 1 : 0} ${(-a).toFixed(1)} 0`);
        }
      });
      const t = ms / 1000;
      const out = dv ? now - dv.at : tlRef.current.out ? ms - X : -1;
      ordered.forEach((_, i) => {
        const el = cardRefs.current[i];
        if (!el) return;
        const slot = plan.slots[i];
        const rg = plan.rings[slot.ring];
        const a = aBase * rg.k, b = a * 0.3;
        const tIn = FIRST_MS + i * perMs;
        const kin = easeOutCubic(span(ms, tIn, tIn + FLOW_IN_MS));
        const kout = out >= 0 ? easeInCubic(span(out, i * 45, i * 45 + FLOW_OUT_MS)) : 0;
        let th = slot.theta0 + rg.dir * (REDUCED ? 0 : ORBIT_SPEED * t);
        th -= rg.dir * 1.3 * (1 - kin);  // ไหลเข้าเป็นเกลียว
        th += rg.dir * 1.2 * kout;       // ไหลออกตามทาง
        const m = 1 + 1.9 * (1 - kin) + 2.2 * kout;
        const ex = a * m * Math.cos(th), ey = b * m * Math.sin(th);
        const x = ex * Math.cos(rg.tilt) - ey * Math.sin(rg.tilt);
        const y = ex * Math.sin(rg.tilt) + ey * Math.cos(rg.tilt);
        const depth = Math.sin(th);                       // +1 หน้าโลก (ล่าง) · −1 หลังโลก (บน)
        const s = (0.72 + 0.28 * (depth + 1) / 2) * (1 + 0.25 * (1 - kin));
        // ครึ่งหลังของวงที่ทับหน้าโลก = อยู่หลังโลก → จางลง (คิดจากกลางการ์ด ไม่ใช่จุดยึด)
        const dist = Math.hypot(x + cardOff * s, y);
        const behind = depth < 0 ? clamp01((ring.r * 1.15 - dist) / (ring.r * 0.55)) * clamp01(-depth * 2.5) : 0;
        const op = kin * (1 - kout) * (1 - 0.85 * behind) * (0.8 + 0.2 * (depth + 1) / 2);
        el.style.transform = `translate3d(${(ring.cx + x).toFixed(1)}px, ${(ring.cy + y).toFixed(1)}px, 0) scale(${s.toFixed(3)})`;
        el.style.opacity = op.toFixed(3);
        el.style.zIndex = String(10 + Math.round((depth + 1) * 10));
      });

      // ---------- Moon Cell: บินอ้อมโลกไปดวงจันทร์ ----------
      const mv = tlRef.current.moon;
      if (mv) {
        if (!moonCam) moonCam = createMoonFlight(core, { lowQ });
        moonCam.frame(clamp01((now - mv.at) / mv.D));
        return;
      }

      if (!dv) return;
      // ---------- ช่วงดิ่ง (ลุคเดิมของ GlobeDive) ----------
      if (!diveCam) diveCam = createDiveCamera(core, { lowQ, wrapEl: stageEl });
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
        const alt = Math.max(0, camera.position.length() - 1);
        altRef.current.textContent = (alt * 1000).toFixed(1).padStart(7, "0");
      }
    });

    return () => {
      off();
      // ฉากร่วมอาจอยู่ต่อ (เช่นกลับห้องรอกลางฉาก) — คืนค่าที่ฉากนี้แก้ไว้ (ของ 3D/กล้อง/world ถูก scopeCore เก็บกวาด)
      diveCam?.restore();
      moonCam?.restore();
      if (core.sand) core.sand.visible = sandShown;
      core.world.rotation.set(0, 0, 0);
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
    mode === "warp" ? "is-warp" : "",
    mode === "moon" ? "is-moon" : "",
    diving ? `ocd-p${dphase}` : "",
    crash ? "is-crash" : "",
    lineup ? "is-lineup" : "",
    lowQ ? "is-lowq" : "",
  ].filter(Boolean).join(" ");
  const D = dive?.D || 7000;

  return (
    <div
      className={rootCls}
      style={{ "--warp": `${warp ? warp.D : 2800}ms`, "--moon": `${moon ? moon.D : 5600}ms`, "--rev": `${Math.round((1 - T.crash) * D)}ms`, "--hex": n > 4 ? "clamp(60px, 8.5vh, 84px)" : "clamp(68px, 10vh, 96px)" }}
    >
      <div className="ocd-bg" aria-hidden="true" />
      {!handed && (
        <div className="ocd-globe">
          <GlobeCanvas layout={diving ? FULL : layout} layoutRate={diving ? 0.04 : 0.09} drag={false} autoSpin={0} onReady={onReady} />
        </div>
      )}

      {/* วงโคจร (ตำแหน่ง/ขนาดตั้งจาก JS ตามลูกโลกทุกเฟรม) — หลังส่งต่อไม่มีลูปเฟรมแล้ว จึงถอดทิ้ง */}
      {!handed && <svg className="ocx-orbit" aria-hidden="true">
        {plan.rings.map((_, r) => (
          <g key={r} ref={(el) => { orbitRefs.current[r] = el; }} className={`ocx-ring r${r}`}>
            <path data-half="back" className="ocx-ring-back" />
            <path data-half="front" className="ocx-ring-front" pathLength="1" />
          </g>
        ))}
      </svg>}

      {!handed && ordered.map((p, i) => (i < seen ? <OrbitCard key={p.id} p={p} cardRef={(el) => { cardRefs.current[i] = el; }} /> : null))}

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

      {mode === "out" && <div className="ocx-veil" aria-hidden="true" />}
      {warp && (
        <>
          <div className="ocx-warp-zoom" aria-hidden="true"><div className="ocx-warp-line" /></div>
          <WarpGalaxy D={warp.D} lowQ={lowQ} />
          <div className="ocx-warp-flash" aria-hidden="true" />
        </>
      )}
      {moon && (
        <>
          <div className="ocx-moon-tag" aria-hidden="true"><span className="oc-latin">SE.RA.PH</span><b className="oc-latin">MOON CELL</b></div>
          <div className="ocx-moon-flash" aria-hidden="true" />
        </>
      )}
      {diving && <DiveImpact area={A} lowQ={lowQ} />}
    </div>
  );
}
