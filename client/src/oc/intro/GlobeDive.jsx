// ============================================================
//  ฉากเริ่มการเดินทาง (ต่อจากฉากเปิดตัวผู้เล่น) — ORDEAL CALL
//  <GlobeDive area={1..7} durationMs={ms} lowQ={bool} onDone={fn} />
//  ลูกโลกหมุนเข้าหาภูมิภาคเริ่มต้น → ล็อกเป้า → กล้องดิ่งลงไปจนชนผิวโลก → แฟลชขาว + คลื่นกระแทก
//  แล้วฉากนี้จางหายเผยกระดานเกม (ที่ mount รออยู่ข้างใต้แล้ว) · ทุกเฟสคิดเป็นสัดส่วนของ durationMs
//  App เริ่มฉากนี้ตอนฉากเปิดตัว "เริ่มปิดฉาก" (onOutro) — ช่วงแรก ~1 วิ ถูกฉากเปิดตัวที่กำลังจางบังอยู่
// ============================================================
import { useEffect, useMemo, useRef, useState } from "react";
import GlobeCanvas from "../../globe/GlobeCanvas";
import { regionDir, REGION_GEO, COLORS } from "../../globe/globeCore";
import { clampJourneyArea, journeyArea } from "../../journey/areas";
import "./dive.css";

const REDUCED = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

// สัดส่วนเวลา (คูณ D)
const T = { title: 0.1, lock: 0.28, dive: 0.52, crash: 0.82 };

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const pad = (n, w) => String(n).padStart(w, "0");

function fmtGeo(g) {
  const lat = `${Math.abs(g.lat).toFixed(2)}${g.lat >= 0 ? "N" : "S"}`;
  const lon = g.lon > 180 ? `${(360 - g.lon).toFixed(2)}W` : `${g.lon.toFixed(2)}E`;
  return { lat, lon };
}

// เส้นวงกลมบนระนาบ XY (ใช้ทำวงสำรวจที่ปักบนผิวโลก)
function circlePts(THREE, r, seg = 96) {
  const pts = [];
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0));
  }
  return pts;
}

export default function GlobeDive({ area = 1, durationMs, lowQ = false, onDone }) {
  const a = clampJourneyArea(area);
  const A = journeyArea(a);
  const geo = fmtGeo(REGION_GEO[a - 1]);
  const D = Math.max(3000, Number(durationMs) || 7000);
  const [phase, setPhase] = useState(0); // 0 หมุนเข้า · 1 ชื่อ · 2 ล็อก · 3 ดิ่ง · 4 ชน/เผย

  const onDoneRef = useRef(onDone);
  useEffect(() => { onDoneRef.current = onDone; }, [onDone]);
  const reticleRef = useRef(null);
  const altRef = useRef(null);
  const globeWrapRef = useRef(null);

  const streaks = useMemo(() => {
    if (lowQ || REDUCED) return [];
    let s = 917 + a * 31;
    const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    return Array.from({ length: 30 }, () => ({ a: rnd() * 360, d: rnd() * 0.5, t: 0.36 + rnd() * 0.3, w: 10 + rnd() * 18, echo: rnd() < 0.22 }));
  }, [lowQ, a]);

  useEffect(() => {
    const timers = [];
    const at = (ms, fn) => timers.push(setTimeout(fn, Math.max(0, ms)));
    let fired = false;
    at(T.title * D, () => setPhase(1));
    at(T.lock * D, () => setPhase(2));
    at(T.dive * D, () => setPhase(3));
    at(T.crash * D, () => setPhase(4));
    at(D, () => {
      if (fired) return;
      fired = true;
      if (typeof onDoneRef.current === "function") onDoneRef.current();
    });
    return () => timers.forEach(clearTimeout);
  }, [D]);

  const onReady = (core) => {
    const { THREE, camera, spin, world } = core;
    const dir = regionDir(a - 1);
    const start = performance.now();
    core.setAutoSpin(0);
    core.setDrag(false);
    core.focusDir(dir, 1.4);

    // วงสำรวจปักบนผิวโลกตรงจุดเริ่มต้น (ขยายใหญ่เองตามกล้องที่ดิ่งเข้าไป)
    const marker = new THREE.Group();
    marker.position.copy(dir).multiplyScalar(1.004);
    marker.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
    const mats = [];
    const addRing = (r, color, opacity, dashed) => {
      const g = new THREE.BufferGeometry().setFromPoints(circlePts(THREE, r));
      const m = dashed
        ? new THREE.LineDashedMaterial({ color, transparent: true, opacity: 0, dashSize: r * 0.12, gapSize: r * 0.08, depthWrite: false })
        : new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false });
      const line = new THREE.LineLoop(g, m);
      if (dashed) line.computeLineDistances();
      m.userData.max = opacity;
      mats.push(m);
      marker.add(line);
      return line;
    };
    addRing(0.03, COLORS.echo, 1);
    const pulse = addRing(0.06, COLORS.echo, 0.8);
    addRing(0.1, COLORS.azure, 0.9);
    addRing(0.16, COLORS.azure, 0.7, true);
    addRing(0.26, COLORS.sky, 0.5);
    {
      const pts = [];
      for (let k = 0; k < 4; k++) {
        const ang = (k / 4) * Math.PI * 2, c = Math.cos(ang), s = Math.sin(ang);
        pts.push(new THREE.Vector3(c * 0.11, s * 0.11, 0), new THREE.Vector3(c * 0.2, s * 0.2, 0));
      }
      const m = new THREE.LineBasicMaterial({ color: COLORS.azure, transparent: true, opacity: 0, depthWrite: false });
      m.userData.max = 0.9;
      mats.push(m);
      marker.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), m));
    }
    marker.scale.setScalar(0.001);
    spin.add(marker);

    const C0 = new THREE.Vector3(0, 0, 6);
    const P = new THREE.Vector3(), cam = new THREE.Vector3(), look = new THREE.Vector3(), origin = new THREE.Vector3();
    const sandMat = core.sand?.material;
    const sand0 = sandMat ? sandMat.opacity : 0;
    let lastFov = camera.fov;
    camera.near = 0.004;
    camera.updateProjectionMatrix();

    const off = core.onFrame(() => {
      const u = (performance.now() - start) / D;

      // หมุนเข้า: ทั้งโลกหมุนตามแกนตั้งแล้วค่อยๆ ช้าลงจนจุดเริ่มต้นหันตรงกล้อง
      if (!REDUCED) {
        world.rotation.y = -2.6 * (1 - easeOutCubic(clamp01(u / T.lock)));
        world.updateMatrixWorld(true);
      }
      P.copy(dir);
      spin.localToWorld(P);

      // วงสำรวจ: กางออกตอนล็อก + วงชีพจร
      const lk = clamp01((u - T.lock + 0.04) / 0.08);
      marker.scale.setScalar(Math.max(0.001, 0.35 + 0.65 * easeOutCubic(lk)));
      mats.forEach((m) => { m.opacity = m.userData.max * lk; });
      const pz = ((performance.now() - start) / 900) % 1;
      pulse.scale.setScalar(1 + pz * 2.4);
      pulse.material.opacity = lk * 0.8 * (1 - pz);

      // ดิ่ง: เร่งขึ้นเรื่อยๆ จนเกือบแตะผิว
      const d = REDUCED ? 0 : clamp01((u - T.dive) / (T.crash - T.dive));
      const e = Math.pow(d, 2.4);
      cam.copy(C0).lerp(look.copy(P).multiplyScalar(1.1), e);
      if (!lowQ && d > 0.72) {
        const sh = ((d - 0.72) / 0.28) * 0.012;
        cam.x += (Math.random() - 0.5) * sh;
        cam.y += (Math.random() - 0.5) * sh;
      }
      camera.position.copy(cam);
      camera.lookAt(look.copy(origin).lerp(P, clamp01(e * 1.8)));
      const fov = 32 + 40 * Math.pow(d, 3);
      if (Math.abs(fov - lastFov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); lastFov = fov; }
      if (sandMat) sandMat.opacity = sand0 * (1 - clamp01(d * 1.6));
      if (core.halo?.material?.uniforms?.k) core.halo.material.uniforms.k.value = 1 - clamp01(d * 1.3);

      // ภาพพร่าตอนใกล้ชน (CSS บน canvas)
      const wrap = globeWrapRef.current;
      if (wrap && !REDUCED) {
        const z = clamp01((d - 0.8) / 0.2);
        wrap.style.transform = z > 0 ? `scale(${(1 + z * 0.7).toFixed(3)})` : "";
        if (!lowQ) wrap.style.filter = z > 0 ? `blur(${(z * 5).toFixed(2)}px) brightness(${(1 + z * 0.35).toFixed(3)})` : "";
      }

      // วงเล็บเล็งเป้า (DOM) ตามจุดบนจอ
      const ret = reticleRef.current;
      if (ret) {
        const s = core.project(P);
        const sc = 1 + 2.6 * e;
        ret.style.transform = `translate3d(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px, 0) scale(${sc.toFixed(3)})`;
      }
      if (altRef.current) {
        const alt = Math.max(0, camera.position.length() - 1);
        altRef.current.textContent = (alt * 1000).toFixed(1).padStart(7, "0");
      }
    });

    return () => {
      off();
      world.rotation.y = 0;
    };
  };

  const crash = phase >= 4;

  return (
    <div
      className={`ocd ocd-p${phase}${crash ? " is-crash" : ""}${lowQ ? " is-lowq" : ""}`}
      style={{ "--rev": `${Math.round((1 - T.crash) * D)}ms`, "--dive": `${Math.round((T.crash - T.dive) * D)}ms`, "--ac": A.color }}
    >
      <div className="ocd-bg" aria-hidden="true" />
      <div className="ocd-globe" ref={globeWrapRef}>
        <GlobeCanvas layout={{ x: 0, y: 0, s: 1 }} drag={false} sand={!lowQ} autoSpin={0} onReady={onReady} />
      </div>

      {phase === 3 && streaks.length > 0 && (
        <div className="ocd-streaks" aria-hidden="true">
          {streaks.map((s, i) => (
            <i key={i} className={s.echo ? "is-echo" : ""} style={{ "--a": `${s.a.toFixed(1)}deg`, "--w": `${s.w.toFixed(1)}vmax`, animationDelay: `${s.d.toFixed(2)}s`, animationDuration: `${s.t.toFixed(2)}s` }} />
          ))}
        </div>
      )}

      <div className="ocd-reticle" ref={reticleRef} aria-hidden="true">
        <span className="ocd-ret-box"><i className="tl" /><i className="tr" /><i className="bl" /><i className="br" /></span>
        <span className="ocd-ret-cross" />
      </div>

      <div className="ocd-tag-anchor">
        <div className="ocd-tag">
          <i className="ocd-tag-line" aria-hidden="true" />
          <span className="ocd-tag-k">ภูมิภาค <b className="oc-latin">{A.numeral}</b></span>
          <span className="ocd-tag-name">{A.name}</span>
          <span className="ocd-tag-geo oc-latin">{geo.lat} · {geo.lon}</span>
        </div>
      </div>

      <div className="ocd-chrome" aria-hidden="true">
        <i className="oc-tick tl" /><i className="oc-tick tr" /><i className="oc-tick bl" /><i className="oc-tick br" />
        <span className="ocd-mark oc-latin">ECHO · <b>ORDEAL CALL</b></span>
        <span className="ocd-mark is-r oc-latin"><b>{pad(a, 2)}</b> · <b ref={altRef}>05000.0</b></span>
      </div>

      <div className="ocd-head">
        <h1 className="ocd-title">เริ่มการเดินทาง</h1>
      </div>

      <div className="ocd-flash" aria-hidden="true" />
      {!REDUCED && (
        <div className="ocd-shock" aria-hidden="true">
          <i className="r1" />
          {!lowQ && <i className="r2" />}
          {!lowQ && <i className="r3" />}
        </div>
      )}

      <div className="ocd-banner">
        <span className="ocd-banner-k">ภูมิภาค <b className="oc-latin">{A.numeral}</b></span>
        <span className="ocd-banner-name">{A.name}</span>
      </div>
    </div>
  );
}
