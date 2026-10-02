// ============================================================
//  ฉากเปลี่ยนภูมิภาค (การเดินทาง ทุก 10 เทิร์น) — ORDEAL CALL
//  <RegionTravel from={1..7} to={1..7} durationMs={ms} lowQ={bool} onDone={fn} />
//  ซูมออกจากสนามขึ้นไปเห็นลูกโลก → เส้นเรืองแสงวิ่งตามผิวโลก (วงกลมใหญ่) จากภูมิภาคเดิมไปภูมิภาคใหม่
//  → ป้ายชื่อภูมิภาคใหม่ → ดิ่งกลับลงที่จุดนั้น (ลุคเดียวกับฉากเริ่มเดินทาง แต่สั้นกว่า) → แฟลช แล้วจางเผยสนาม
//  ทุกเฟสคิดเป็นสัดส่วนของ durationMs (App คิดจากเวลาที่ server ยังพักเกมอยู่ ≈ 6 วิ)
// ============================================================
import { useEffect, useRef, useState } from "react";
import GlobeCanvas from "../../globe/GlobeCanvas";
import { regionDir, COLORS } from "../../globe/globeCore";
import { clampJourneyArea, journeyArea } from "../../journey/areas";
import {
  REDUCED, clamp01, easeInOutCubic, span, aimAngles, setAim, createMarker, createDiveCamera, slerpDir, glowTexture,
} from "./diveKit";
import { DiveStreaks, DiveReticle, RegionTag, DiveImpact, Chrome } from "./DiveFx";
import { requestArenaLand } from "../../journey/arena/arenaLandBus";
import "./dive.css";

// สัดส่วนเวลา (คูณ D)
const T = { back: 0.22, travel: 0.22, travelEnd: 0.5, tag: 0.45, aimTo: 0.53, aimToEnd: 0.66, dive: 0.66, crash: 0.82 };
const N = 120; // จำนวนช่วงของเส้นทาง

const pad2 = (n) => String(n).padStart(2, "0");

export default function RegionTravel({ from, to, durationMs, lowQ = false, onDone }) {
  const b = clampJourneyArea(to);
  const a = clampJourneyArea(from ?? b - 1);
  const A = journeyArea(b);
  const D = Math.max(3000, Number(durationMs) || 6000);
  const [phase, setPhase] = useState(0); // 0 ถอยออก · 1 เดินทาง · 2 ถึง/ป้ายชื่อ · 3 ดิ่ง · 4 ชน/เผย

  const onDoneRef = useRef(onDone);
  useEffect(() => { onDoneRef.current = onDone; }, [onDone]);
  const reticleRef = useRef(null);
  const tagRef = useRef(null);
  const globeWrapRef = useRef(null);

  useEffect(() => {
    const timers = [];
    const at = (ms, fn) => timers.push(setTimeout(fn, Math.max(0, ms)));
    let fired = false;
    at(T.travel * D, () => setPhase(1));
    at(T.tag * D, () => setPhase(2));
    at(T.dive * D, () => setPhase(3));
    at(T.crash * D, () => setPhase(4));
    // สนาม 2.5D ภูมิภาคใหม่เริ่มพุ่งลงใต้แฟลชตอนชน (เท่ากับจังหวะส่งต่อของฉากเปิดแมตช์: 10% ของช่วงเผย)
    at((T.crash + (1 - T.crash) * 0.1) * D, requestArenaLand);
    at(D, () => {
      if (fired) return;
      fired = true;
      if (typeof onDoneRef.current === "function") onDoneRef.current();
    });
    return () => timers.forEach(clearTimeout);
  }, [D]);

  const onReady = (core) => {
    const { THREE, spin } = core;
    const start = performance.now();
    core.setAutoSpin(0);
    core.setDrag(false);
    const dA = regionDir(a - 1), dB = regionDir(b - 1);
    const same = a === b;
    // ภูมิภาคเดียวกัน (ไม่ควรเกิด) — เบี่ยงต้นทางเล็กน้อยให้เส้นทางมีความยาว
    if (same) dA.applyAxisAngle(new THREE.Vector3(0, 1, 0), -0.6);
    // สีภูมิภาค (บางสีอ่อนมาก เช่นแดนน้ำแข็ง) — กดความสว่างให้เห็นชัดบนโลกสีขาว
    const vivid = (hex) => {
      const c = new THREE.Color(hex), hsl = {};
      c.getHSL(hsl);
      return c.setHSL(hsl.h, Math.max(hsl.s, 0.62), Math.min(hsl.l, 0.5));
    };
    const cA = vivid(journeyArea(a).color);
    const cB = vivid(A.color);
    const disposables = [];

    // ---------- เส้นทางตามผิวโลก (ยกโค้งขึ้นเล็กน้อยกลางทาง) ----------
    const ang = Math.acos(Math.max(-1, Math.min(1, dA.dot(dB))));
    const lift = 0.03 + 0.07 * (ang / Math.PI);
    const pts = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      pts.push(slerpDir(THREE, dA, dB, t).multiplyScalar(1.006 + lift * Math.sin(Math.PI * t)));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const colorTube = (geo, radial) => {
      const cnt = geo.attributes.position.count;
      const col = new Float32Array(cnt * 3);
      const c = new THREE.Color();
      for (let j = 0; j <= N; j++) {
        c.copy(cA).lerp(cB, j / N);
        for (let i = 0; i <= radial; i++) col.set([c.r, c.g, c.b], (j * (radial + 1) + i) * 3);
      }
      geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
      geo.setDrawRange(0, 0);
      return geo;
    };
    const RAD = 8;
    const coreGeo = colorTube(new THREE.TubeGeometry(curve, N, 0.0068, RAD, false), RAD);
    const glowGeo = colorTube(new THREE.TubeGeometry(curve, N, 0.019, RAD, false), RAD);
    const coreMat = new THREE.MeshBasicMaterial({ vertexColors: true });
    const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.26, depthWrite: false });
    const tube = new THREE.Mesh(coreGeo, coreMat);
    const glow = new THREE.Mesh(glowGeo, glowMat);
    spin.add(glow, tube);
    // เส้นประของเส้นทางทั้งเส้น (เห็นก่อนเส้นจริงวิ่งทับ)
    const dashGeo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(N));
    const dashMat = new THREE.LineDashedMaterial({ color: COLORS.azure, transparent: true, opacity: 0, dashSize: 0.018, gapSize: 0.014, depthWrite: false });
    const dash = new THREE.Line(dashGeo, dashMat);
    dash.computeLineDistances();
    spin.add(dash);
    disposables.push(coreGeo, glowGeo, coreMat, glowMat, dashGeo, dashMat);

    // ---------- เส้นทางที่เดินมาแล้ว (ภูมิภาค I → … → ต้นทาง) ค้างไว้บนโลก ไม่หายไป ----------
    //  วาดเต็มเส้นตั้งแต่เปิดฉาก สีไล่ตามภูมิภาคแต่ละช่วงเหมือนเส้นใหม่ · จุดเล็กตรงภูมิภาคที่ผ่านมา
    const trailMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false });
    const trailGlowMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.16, depthWrite: false });
    const dotGeo = new THREE.CircleGeometry(0.014, 20);
    disposables.push(trailMat, trailGlowMat, dotGeo);
    for (let k = 1; k < a && !same; k++) {
      const s0 = regionDir(k - 1), s1 = regionDir(k);
      const sAng = Math.acos(Math.max(-1, Math.min(1, s0.dot(s1))));
      const sLift = 0.03 + 0.07 * (sAng / Math.PI);
      const sp = [];
      for (let i = 0; i <= N; i++) sp.push(slerpDir(THREE, s0, s1, i / N).multiplyScalar(1.006 + sLift * Math.sin(Math.PI * (i / N))));
      const sCurve = new THREE.CatmullRomCurve3(sp);
      const c0 = vivid(journeyArea(k).color), c1 = vivid(journeyArea(k + 1).color);
      const paint = (geo) => {
        const col = new Float32Array(geo.attributes.position.count * 3);
        const c = new THREE.Color();
        for (let j = 0; j <= N; j++) {
          c.copy(c0).lerp(c1, j / N);
          for (let i = 0; i <= RAD; i++) col.set([c.r, c.g, c.b], (j * (RAD + 1) + i) * 3);
        }
        geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
        return geo;
      };
      const tGeo = paint(new THREE.TubeGeometry(sCurve, N, 0.0058, RAD, false));
      const gGeo = paint(new THREE.TubeGeometry(sCurve, N, 0.016, RAD, false));
      spin.add(new THREE.Mesh(gGeo, trailGlowMat), new THREE.Mesh(tGeo, trailMat));
      disposables.push(tGeo, gGeo);
      const dotMat = new THREE.MeshBasicMaterial({ color: c0, transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide });
      const dot = new THREE.Mesh(dotGeo, dotMat);
      dot.position.copy(s0).multiplyScalar(1.008);
      dot.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), s0);
      spin.add(dot);
      disposables.push(dotMat);
    }

    // หัวเส้น: จุดขาว + แสงสีภูมิภาคปลายทาง
    const tex = glowTexture(THREE);
    const headGlowMat = new THREE.SpriteMaterial({ map: tex, color: cB, transparent: true, depthWrite: false, opacity: 0 });
    const headCoreMat = new THREE.SpriteMaterial({ map: tex, color: 0xffffff, transparent: true, depthWrite: false, opacity: 0 });
    const headGlow = new THREE.Sprite(headGlowMat);
    const headCore = new THREE.Sprite(headCoreMat);
    headGlow.scale.setScalar(0.11);
    headCore.scale.setScalar(0.036);
    spin.add(headGlow, headCore);
    disposables.push(headGlowMat, headCoreMat);

    // วงสำรวจ: ต้นทาง (สีภูมิภาคเดิม) · ปลายทาง (ลุคเดิมของฉากดิ่ง)
    const mFrom = createMarker(core, dA, spin, { inner: cA.getHex(), mid: cA.getHex(), outer: COLORS.sky });
    const mTo = createMarker(core, dB);
    // คลื่นตอนหัวเส้นถึงปลายทาง
    const burstMat = new THREE.MeshBasicMaterial({ color: cB, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
    const burstGeo = new THREE.RingGeometry(0.05, 0.058, 48);
    const burst = new THREE.Mesh(burstGeo, burstMat);
    burst.position.copy(dB).multiplyScalar(1.006);
    burst.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dB);
    spin.add(burst);
    disposables.push(burstMat, burstGeo);

    const diveCam = createDiveCamera(core, { lowQ, wrapEl: () => globeWrapRef.current });
    const aimDir = new THREE.Vector3(), P = new THREE.Vector3(), head = new THREE.Vector3();
    const total = coreGeo.index.count;

    const off = core.onFrame(() => {
      const now = performance.now();
      const u = (now - start) / D;

      // ---------- ทิศของโลก: ต้นทาง → กึ่งกลางเส้นทาง (ตามหัวเส้นเล็กน้อย) → ปลายทาง ----------
      let w;
      if (REDUCED) w = 0.5;
      else {
        const toMid = easeInOutCubic(span(u, 0.06, 0.3)) * 0.5;
        const follow = easeInOutCubic(span(u, T.travel, T.travelEnd)) * 0.1;
        const toEnd = easeInOutCubic(span(u, T.aimTo, T.aimToEnd));
        w = toMid + follow;
        w += (1 - w) * toEnd;
      }
      if (same) w = 1;
      slerpDir(THREE, dA, dB, w, aimDir);
      const aim = aimAngles(core, aimDir);
      setAim(core, aim.yaw, aim.pitch);

      // ---------- เส้นทาง ----------
      const dashK = span(u, 0.14, 0.26);
      dashMat.opacity = 0.55 * dashK * (1 - span(u, T.dive, T.dive + 0.08));
      const tk = REDUCED ? span(u, T.travel, T.travelEnd) : easeInOutCubic(span(u, T.travel, T.travelEnd));
      const segs = Math.round(tk * N);
      const range = segs * RAD * 6;
      coreGeo.setDrawRange(0, Math.min(total, range));
      glowGeo.setDrawRange(0, Math.min(glowGeo.index.count, range));
      const moving = tk > 0 && tk < 1;
      curve.getPoint(tk, head);
      headGlow.position.copy(head);
      headCore.position.copy(head);
      const headK = tk > 0 ? (1 - span(u, T.travelEnd, T.travelEnd + 0.06)) : 0;
      const beat = 1 + 0.18 * Math.sin(now / 90);
      headGlowMat.opacity = 0.9 * headK;
      headCoreMat.opacity = headK;
      headGlow.scale.setScalar(0.11 * (moving ? beat : 1));

      // วงต้นทาง: กางตอนเห็นโลก หุบตอนออกเดินทาง · วงปลายทาง: กางตอนหัวเส้นใกล้ถึง
      mFrom.update(clamp01(span(u, 0.1, 0.2) - span(u, T.travel + 0.1, T.travelEnd)), now - start, 0.8);
      mTo.update(clamp01((u - T.tag) / 0.08), now - start);
      const bk = span(u, T.travelEnd - 0.01, T.travelEnd + 0.12);
      burst.scale.setScalar(1 + bk * 5);
      burstMat.opacity = bk > 0 && bk < 1 ? 0.85 * (1 - bk) : 0;
      // เส้นจางลงตอนดิ่ง (กล้องลงไปใกล้ผิว)
      glowMat.opacity = 0.26 * (1 - span(u, T.dive, T.dive + 0.1));

      // ---------- กล้อง: ถอยออกจากผิวโลก (ต้นทาง) → ระยะปกติ → ดิ่งลง (ปลายทาง) ----------
      if (REDUCED) {
        diveCam.frame(P.set(0, 0, 0), 0, 0);
      } else if (u < T.back) {
        // ค้างใกล้ผิวโลกช่วงสั้นๆ ระหว่างสนามจางหาย แล้วค่อยถอยออก (เร็วกลางทาง ช้าลงตอนจบ)
        const z = span(u, 0.02, T.back);
        const e = 1 - easeInOutCubic(z);
        P.copy(dA);
        spin.localToWorld(P);
        diveCam.frame(P, e, Math.pow(e, 1 / 2.4), { scaleWrap: false, shake: false });
      } else {
        const d = clamp01((u - T.dive) / (T.crash - T.dive));
        P.copy(dB);
        spin.localToWorld(P);
        diveCam.frame(P, Math.pow(d, 2.4), d);
      }

      // ---------- ป้าย/เป้าบนจอ ----------
      P.copy(dB);
      spin.localToWorld(P);
      const sp = core.project(P);
      const d = clamp01((u - T.dive) / (T.crash - T.dive));
      const ret = reticleRef.current;
      if (ret) ret.style.transform = `translate3d(${sp.x.toFixed(1)}px, ${sp.y.toFixed(1)}px, 0) scale(${(1 + 2.6 * Math.pow(d, 2.4)).toFixed(3)})`;
      const tag = tagRef.current;
      if (tag) tag.style.transform = `translate3d(${sp.x.toFixed(1)}px, ${sp.y.toFixed(1)}px, 0)`;
    });

    return () => {
      off();
      spin.remove(glow, tube, dash, headGlow, headCore, burst, mFrom.group, mTo.group);
      disposables.forEach((x) => x.dispose());
      core.world.rotation.set(0, 0, 0);
    };
  };

  const crash = phase >= 4;
  return (
    <div
      className={`ocd ort ocd-p${phase}${crash ? " is-crash" : ""}${lowQ ? " is-lowq" : ""}`}
      style={{ "--rev": `${Math.round((1 - T.crash) * D)}ms`, "--in": `${Math.round(Math.min(700, T.back * D * 0.5))}ms` }}
    >
      {/* ม่านพร่าสนามใช้แค่ช่วงถอยออก (เฟส 0) — หลังจากนั้นพื้นขาว .ocd-bg ทึบบังสนามแล้ว
          ถ้าค้างไว้ backdrop-filter ต้องเบลอสนามที่ยังขยับอยู่ข้างใต้ใหม่ทุกเฟรมทั้งฉาก (กินเครื่อง/เฟรมตก) */}
      {!lowQ && phase === 0 && <div className="ort-veil" aria-hidden="true" />}
      <div className="ocd-bg" aria-hidden="true" />
      <div className="ocd-globe" ref={globeWrapRef}>
        <GlobeCanvas shared={false} layout={{ x: 0, y: 0, s: 1 }} drag={false} sand={!lowQ} autoSpin={0} onReady={onReady} />
      </div>

      <DiveStreaks show={phase === 0 && !REDUCED} seed={b + 11} lowQ={lowQ} reverse />
      <DiveStreaks show={phase === 3} seed={b} lowQ={lowQ} />
      <DiveReticle ref={reticleRef} />
      <RegionTag ref={tagRef} area={b} />

      <Chrome>
        <span className="ocd-mark is-r oc-latin"><b>{pad2(a)}</b> → <b>{pad2(b)}</b></span>
      </Chrome>

      <DiveImpact area={b} lowQ={lowQ} />
    </div>
  );
}

