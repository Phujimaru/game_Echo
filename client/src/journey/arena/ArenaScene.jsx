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

import { memo, useEffect, useMemo, useState } from "react";
import { buildArena, ARENA_STEM } from "./arenaData";
import { StandArt, FxArt, ForeArt } from "./ArenaArt";
import "./arena.css";

const FADE_MS = 1600;


/* ฉากพุ่งลงจากฟ้า: [left%, top%, ขนาด vmax, หน่วงวินาที] — เมฆแตกออกจากกลางจอเหมือนกล้องดิ่งทะลุชั้นเมฆ */
const DIVE_CLOUDS = [
  [50, 50, 70, 0.1], [22, 30, 46, 0.15], [78, 28, 50, 0.2], [18, 74, 52, 0.25], [82, 72, 48, 0.3],
  [50, 18, 44, 0.45], [50, 84, 46, 0.5], [32, 52, 40, 0.6], [68, 50, 42, 0.65], [8, 50, 40, 0.75],
  [92, 46, 40, 0.8], [36, 22, 34, 0.9], [64, 80, 36, 0.95], [50, 50, 50, 1.0],
];

/** ชั้นฉากพุ่งลง (เล่นครั้งเดียวตอนเข้าภูมิภาค ~3.4 วิ) — ท้องฟ้าทึบ → เมฆแตกออก + เส้นความเร็ว → เผยพื้นที่กำลังซูม/เอียง */
function DiveSky({ night }) {
  return (
    <div className={`ar-dive${night ? " is-night" : ""}`}>
      <div className="ar-dive-veil" />
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

function Layer({ area, night, lowQ, W, H, seats, land, fadeIn }) {
  const sc = useMemo(() => buildArena({ W, H, area, night, seats, lowQ }), [W, H, area, night, seats, lowQ]);
  const u = H / 900;
  const cls = `ar-scene${land ? " ar-land" : ""}${fadeIn ? " ar-fadein" : ""}`;
  return (
    <div className={cls} style={{ background: sc.sky }}>
      <div className="ar-stage" style={{ perspective: `${sc.plane.perspective}px`, perspectiveOrigin: `50% ${sc.plane.originY}px` }}>
        <div
          className="ar-plane"
          style={{ left: sc.plane.left, top: sc.plane.top, width: sc.plane.size, height: sc.plane.size, background: sc.ground, "--ar-rx": `${sc.plane.rx}deg` }}
        >
          {sc.flats.map((f) => <div key={f.key} className="ar-flat" style={f.style} />)}
        </div>
      </div>
      <div className="ar-layer ar-par-b">
        {sc.stands.map((s) => (
          <div
            key={s.key}
            className="ar-stand"
            style={{ left: s.left, top: s.top, width: s.width, height: s.height, transform: `translate(-50%, -100%) scaleY(${s.fold})`, filter: s.filter === "none" ? undefined : s.filter, "--i": s.i }}
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
            style={{ left: f.x, top: f.y, width: f.w, height: f.h, marginLeft: -f.w / 2, marginTop: -f.h / 2, opacity: f.op, filter: `blur(${f.blur}px)` }}
          >
            <div className="ar-sway" style={f.anim && f.anim !== "none" ? { animation: f.anim } : undefined}>
              <ForeArt f={f} />
            </div>
          </div>
        ))}
      </div>
      {land && !lowQ && <DiveSky night={night} />}
    </div>
  );
}

function ArenaScene({ area = 1, night = false, lowQ = false, W, H, seats }) {
  const n = !!night;
  const key = `${area}${n ? "n" : "d"}`;
  const [layers, setLayers] = useState(() => [{ key, area, night: n, land: true }]);

  // ปรับ state ตาม props ระหว่าง render (แพทเทิร์นเดียวกับ JourneyBackdrop)
  const top = layers[layers.length - 1];
  if (top.key !== key) {
    setLayers([top, { key, area, night: n, land: top.area !== area }]);
  }

  useEffect(() => {
    if (layers.length < 2) return undefined;
    const t = setTimeout(() => setLayers((prev) => prev.slice(-1)), FADE_MS + 120);
    return () => clearTimeout(t);
  }, [layers]);

  return (
    <div className={`ar${lowQ ? " ar-lowq" : ""}`} style={{ "--ar-fade": `${FADE_MS}ms` }} aria-hidden="true">
      {layers.map((l, i) => (
        <Layer key={l.key} area={l.area} night={l.night} lowQ={lowQ} W={W} H={H} seats={seats} land={l.land} fadeIn={i > 0} />
      ))}
    </div>
  );
}

export default memo(ArenaScene);
