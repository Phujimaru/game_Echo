// ============================================================
//  สนามประลอง 2.5D (ORDEAL CALL 5.1) — ภูมิภาค I–III
//
//  <ArenaScene area={1..3} night={bool} lowQ={bool} W={px} H={px} seats={[{phi,col,me}]} />
//   - พื้นเป็น 3D จริงด้วย CSS (perspective + rotateX) · ของที่ตั้งอยู่ (ต้นไม้/เสา/ปราสาท) เป็นป้ายหันหน้าเข้ากล้อง
//     วางบนจอด้วยสูตรเดียวกับพื้น (arenaData.js) จึงยืนตรงจุดบนพื้นพอดี
//   - ความลึก: ยกพื้นเป็นชั้น · ของไกลเบลอ+จางเข้าหมอก · ของบังหน้ากล้องเบลอแรง · แต่ละชั้นแกว่งคนละระยะ (พารัลแลกซ์)
//     ชั้นพื้นไม่แกว่ง เพราะการ์ดผู้เล่นบนกระดานต้องนั่งตรงฐานที่นั่งตลอด
//   - เปลี่ยนภูมิภาค = ฉากใหม่ซ้อนแล้วเฟดเข้า พร้อม "ร่อนลง" (พื้นเอียงจากมองตรงลงมา 55° · ของตั้งกางขึ้นแบบป๊อปอัป)
//     สลับกลางวัน/กลางคืน = เฟดเฉยๆ ไม่ร่อนซ้ำ
//   - lowQ = หยุดอนิเมชันทั้งหมด ไม่มีเอฟเฟกต์/เบลอ (เหลือภาพนิ่งที่ยังมีมิติ)
// ============================================================

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { buildArena, ARENA_STEM } from "./arenaData";
import { bakePlane } from "./bakePlane";
import { onArenaLandRequest, announceArenaLand, shouldLandOnMount, noteArenaShown } from "./arenaLandBus";
import { StandArt, FxArt, ForeArt } from "./ArenaArt";
import "./arena.css";

const FADE_MS = 1600;
const LAND_MS = 2000; // ฉากใหม่ที่พุ่งลงทับฉากเดิม: ม่านฟ้าทึบตั้งแต่เฟรมแรก จึงถอดฉากเดิมได้เร็ว


/* ฉากพุ่งลงจากฟ้า — เมฆ 3 ระลอก [left%, top%, ขนาด vmax, หน่วงวินาที] แตกออกจากกลางจอเหมือนกล้องดิ่งทะลุชั้นเมฆ */
const CLOUD_WAVE = [
  [50, 50, 72, 0], [22, 30, 46, 0.05], [78, 28, 50, 0.1], [18, 74, 52, 0.12], [82, 72, 48, 0.16],
  [50, 16, 44, 0.22], [50, 86, 46, 0.25], [6, 48, 40, 0.3], [94, 50, 40, 0.32],
];
const DIVE_CLOUDS = [0.05, 0.75, 1.45].flatMap((t0, w) =>
  CLOUD_WAVE.map(([x, y, s, d]) => [w % 2 ? 100 - x : x, y, s * (1 - w * 0.12), t0 + d]));

/** ชั้นฉากพุ่งลง (เล่นครั้งเดียวตอนเข้าภูมิภาค ~5 วิ) — ฟ้าทึบ+แสงแดด → เมฆ 3 ระลอก + เส้นความเร็ว → เห็นภูมิภาคหมุนเป็นเกลียวอยู่ไกลลงไป */
function DiveSky({ night }) {
  return (
    <div className={`ar-dive${night ? " is-night" : ""}`}>
      <div className="ar-dive-veil" />
      <div className="ar-dive-glare" />
      <div className="ar-dive-speed" />
      {DIVE_CLOUDS.map(([x, y, w, d], i) => (
        <span
          key={i}
          className="ar-dive-cloud"
          style={{ left: `${x}%`, top: `${y}%`, width: `${w}vmax`, height: `${w * 0.62}vmax`, animationDelay: `${d}s`, "--dx": `${(x - 50) * 1.6}vw`, "--dy": `${(y - 50) * 1.6}vh` }}
        />
      ))}
    </div>
  );
}

/** ตอนแตะพื้น: ฝุ่นพุ่งออกรอบกองไพ่กลางสนาม (พิกัดจอ) */
const DUST = Array.from({ length: 14 }, (_, i) => {
  const a = (i / 14) * Math.PI * 2;
  return { dx: Math.cos(a), dy: Math.sin(a) * 0.45, d: (i % 3) * 0.04 };
});

/* พื้นที่อบแล้วเก็บไว้ระดับโมดูล — กระดาน mount ใหม่หลังคัตซีนได้ภาพพื้นทันที ไม่ต้องอบซ้ำ (canvas ใช้ซ้ำได้ทีละที่ จึงวาดสำเนา) */
const BAKE_CACHE = new Map();
const BIG_LIVE = 1400; // ชิ้นที่ขยับแต่ใหญ่เกินนี้ (เช่นเกลียวน้ำวน) อบนิ่งไปด้วย — เลเยอร์ใหญ่ที่หมุนอยู่ในแผ่น 3D กิน GPU มาก
function copyCanvas(src) {
  const cv = document.createElement("canvas");
  cv.width = src.width;
  cv.height = src.height;
  cv.getContext("2d")?.drawImage(src, 0, 0);
  return cv;
}

function Layer({ area, night, lowQ, W, H, seats, land, fadeIn }) {
  const sc = useMemo(() => buildArena({ W, H, area, night, seats, lowQ }), [W, H, area, night, seats, lowQ]);
  // พื้น: ชิ้นนิ่ง → อบเป็น canvas ก้อนเดียว · ชิ้นที่ขยับ (เล็ก) → ยังเป็น DOM ซ้อนบนภาพ
  const { baked, live } = useMemo(() => {
    const isLive = (f) => f.style.animation && Math.max(f.style.width || 0, f.style.height || 0) < BIG_LIVE;
    return { baked: sc.flats.filter((f) => !isLive(f)), live: sc.flats.filter(isLive) };
  }, [sc]);
  const bakeKey = `${area}|${night ? 1 : 0}|${W}|${H}|${lowQ ? 1 : 0}|${(seats || []).map((st) => `${st.phi}${st.col}`).join(",")}`;
  const bakeHost = useRef(null);
  const [bakeReady, setBakeReady] = useState(() => BAKE_CACHE.has(bakeKey));
  useEffect(() => {
    let alive = true;
    const put = (src) => {
      const host = bakeHost.current;
      if (!alive || !host || !src) return;
      const cv = copyCanvas(src);
      cv.className = "ar-plane-bake";
      host.replaceChildren(cv);
      setBakeReady(true);
    };
    if (BAKE_CACHE.has(bakeKey)) put(BAKE_CACHE.get(bakeKey));
    else bakePlane(sc.plane.size, sc.ground, baked).then((cv) => {
      if (!cv) return;
      if (BAKE_CACHE.size > 24) BAKE_CACHE.delete(BAKE_CACHE.keys().next().value);
      BAKE_CACHE.set(bakeKey, cv);
      put(cv);
    });
    return () => { alive = false; };
  }, [bakeKey, sc, baked]);
  const u = H / 900;
  const cls = `ar-scene${land ? " ar-land" : ""}${fadeIn ? " ar-fadein" : ""}`;
  return (
    <div className={cls} style={{ background: sc.sky }}>
      <div className="ar-stage" style={{ perspective: `${sc.plane.perspective}px`, perspectiveOrigin: `50% ${sc.plane.originY}px` }}>
        <div
          className="ar-plane"
          style={{ left: sc.plane.left, top: sc.plane.top, width: sc.plane.size, height: sc.plane.size, background: sc.ground, "--ar-rx": `${sc.plane.rx}deg` }}
        >
          <div ref={bakeHost} className="ar-plane-bakehost" />
          {/* ระหว่างรออบครั้งแรก (ไม่กี่ร้อยมิลลิวินาที ใต้ม่านฟ้าของฉากพุ่งลง) เห็นแค่สีพื้น — ไม่วางชิ้น DOM หลายร้อยชิ้นให้ GPU หนัก */}
          {bakeReady && live.map((f) => <div key={f.key} className="ar-flat" style={f.style} />)}
          {land && !lowQ && <div className="ar-shock" style={{ left: sc.plane.size / 2, top: sc.plane.size / 2 + sc.centerLift, width: sc.plane.size * 0.34, height: sc.plane.size * 0.34 }} />}
        </div>
      </div>
      <div className="ar-layer ar-par-b">
        {sc.stands.map((s) => (
          <div
            key={s.key}
            className="ar-stand"
            style={{ left: s.left, top: s.top, width: s.width, height: s.height, transform: `translate(-50%, -100%) scaleY(${s.fold})`, opacity: s.op ?? 1, "--i": s.i }}
          >
            <div className="ar-pop">
              <div className="ar-sway" style={s.anim && s.anim !== "none" ? { animation: s.anim } : undefined}>
                <StandArt s={s} />
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="ar-layer ar-haze" style={{ background: sc.haze }} />
      <div className="ar-layer ar-fxl ar-par-b">
        {sc.fx.map((f) => (
          <div
            key={f.key}
            className="ar-fx"
            style={{ left: f.x, top: f.y, width: f.w, height: f.h, marginLeft: -f.w / 2, marginTop: -f.h / 2, opacity: f.op, animation: f.anim && f.anim !== "none" ? f.anim : undefined }}
          >
            <FxArt f={f} />
          </div>
        ))}
      </div>
      {/* เส้นแสงจากฐานที่นั่งขึ้นไปหาการ์ดผู้เล่น (การ์ดจริงวางโดย Game.jsx) */}
      <div className="ar-layer ar-stems">
        {sc.pts.filter((p) => !p.me).map((p) => (
          <span key={p.idx} className="ar-stem" style={{ left: p.x, top: p.y, height: seats[p.idx]?.stem ?? ARENA_STEM * u * p.s, "--c": p.col }} />
        ))}
      </div>
      <div className="ar-layer ar-forel ar-par-c">
        {sc.fore.map((f) => (
          <div
            key={f.key}
            className="ar-fore"
            // ชั้นหน้ากล้องเบลอแบบนิ่ง (5.1.12: เลิกแกว่ง — ภาพเบลอที่ขยับต้องคำนวณเบลอใหม่บน GPU ทุกเฟรม)
            style={{ left: f.x, top: f.y, width: f.w, height: f.h, marginLeft: -f.w / 2, marginTop: -f.h / 2, opacity: f.op, filter: `blur(${f.blur}px)` }}
          >
            <ForeArt f={f} />
          </div>
        ))}
      </div>
      {land && !lowQ && (
        <div className="ar-layer ar-dust" style={{ "--cx": `${sc.center.x}px`, "--cy": `${sc.center.y}px`, "--u": u }}>
          {DUST.map((p, i) => <span key={i} style={{ "--dx": `${p.dx * 360 * u}px`, "--dy": `${p.dy * 360 * u}px`, animationDelay: `${3.55 + p.d}s` }} />)}
        </div>
      )}
      {land && !lowQ && <DiveSky night={night} />}
    </div>
  );
}

/* เปลี่ยนภูมิภาคแล้วไม่มีสัญญาณจากฉากลูกโลก (รีคอนเนกต์ / ฉากถูกข้าม) — พุ่งลงเองหลังรอเท่านี้ */
const LAND_WAIT_MS = 9000;

function ArenaScene({ area = 1, night = false, lowQ = false, W, H, seats }) {
  const n = !!night;
  const seq = useRef(0);
  // mount ใหม่ในภูมิภาคเดิมหลังคัตซีน (กระดานถูกแทนทั้งจอชั่วคราว) = ไม่พุ่งลงซ้ำ — ดู arenaLandBus
  const [layers, setLayers] = useState(() => [{ key: `${area}${n ? "n" : "d"}-0`, area, night: n, land: shouldLandOnMount(area) }]);
  const top = layers[layers.length - 1];

  // สลับกลางวัน/กลางคืนในภูมิภาคเดิม = เฟดเฉยๆ (ปรับ state ระหว่าง render แบบเดียวกับ JourneyBackdrop)
  if (top.area === area && top.night !== n) {
    setLayers([top, { key: `${area}${n ? "n" : "d"}-f${layers.length}-${top.key}`, area, night: n, land: false }]);
  }

  // เปลี่ยนภูมิภาค = รอฉากลูกโลก (RegionTravel) ส่งสัญญาณตอนชนผิวโลก แล้วค่อยพุ่งลง — ระหว่างรอฉากเดิมค้างไว้ใต้ลูกโลก
  useEffect(() => {
    if (top.area === area) return undefined;
    let fired = false;
    const go = () => {
      if (fired) return;
      fired = true;
      seq.current += 1;
      setLayers((prev) => [prev[prev.length - 1], { key: `${area}${n ? "n" : "d"}-${seq.current}`, area, night: n, land: true }]);
      announceArenaLand();
    };
    const off = onArenaLandRequest(go);
    const t = setTimeout(go, LAND_WAIT_MS);
    return () => { off(); clearTimeout(t); };
  }, [area, n, top.area]);

  // พุ่งลงตอน mount → บอก Game.jsx ให้การ์ดหล่นลงที่นั่ง · จำภูมิภาคที่แสดงอยู่ (ทั้งตอนแสดงและตอนถอด)
  const shownArea = top.area;
  useEffect(() => {
    if (layers[0].land && layers.length === 1 && layers[0].key.endsWith("-0")) announceArenaLand();
    // ครั้งเดียวต่อการ mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    noteArenaShown(shownArea);
    return () => noteArenaShown(shownArea);
  }, [shownArea]);

  useEffect(() => {
    if (layers.length < 2) return undefined;
    const t = setTimeout(() => setLayers((prev) => prev.slice(-1)), (layers[layers.length - 1].land ? LAND_MS : FADE_MS) + 120);
    return () => clearTimeout(t);
  }, [layers]);

  return (
    <div className={`ar${lowQ ? " ar-lowq" : ""}`} style={{ "--ar-fade": `${FADE_MS}ms` }} aria-hidden="true">
      {layers.map((l, i) => (
        <Layer key={l.key} area={l.area} night={l.night} lowQ={lowQ} W={W} H={H} seats={seats} land={l.land} fadeIn={i > 0 && !l.land} />
      ))}
    </div>
  );
}

export default memo(ArenaScene);
