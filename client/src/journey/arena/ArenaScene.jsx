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
import { buildArena } from "./arenaData";
import { StandArt, FxArt, ForeArt } from "./ArenaArt";
import "./arena.css";

const FADE_MS = 1600;

/** ความสูงเส้นแสงจากฐานที่นั่งถึงขอบล่างการ์ด (px ที่ความสูงจอ 900) — Game.jsx ใช้ค่าเดียวกันวางการ์ด */
export const ARENA_STEM = 38;
/** ย่อการ์ดผู้เล่นบนสนาม (คูณกับสเกลความลึก) ให้การ์ดใบติดกันไม่ทับกัน */
export const ARENA_CARD_SCALE = 0.86;

function Layer({ area, night, lowQ, W, H, seats, land, fadeIn }) {
  const sc = useMemo(() => buildArena({ W, H, area, night, seats, lowQ }), [W, H, area, night, seats, lowQ]);
  const u = H / 900;
  const cls = `ar-scene${land ? " ar-land" : ""}${fadeIn ? " ar-fadein" : ""}`;
  return (
    <div className={cls} style={{ background: sc.sky }}>
      <div className="ar-stage" style={{ perspective: `${sc.plane.perspective}px` }}>
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
          <span key={p.idx} className="ar-stem" style={{ left: p.x, top: p.y, height: ARENA_STEM * u * p.s, "--c": p.col }} />
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
