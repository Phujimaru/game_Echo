// ============================================================
//  ฉากหลังของระบบ Journey — 7 ภูมิภาค × กลางวัน/กลางคืน
//
//  <JourneyBackdrop area={1..7} night={bool} lowQ={bool} />
//   - เติมเต็มพ่อ (absolute inset-0) ไม่รับเมาส์
//   - เปลี่ยน area/night -> ฉากใหม่ซ้อนบนแล้วเฟดเข้า ~1.8 วิ ฉากเก่าค้างไว้ใต้จนเฟดจบแล้วถอดทิ้ง
//     (มีฉากพร้อมกันไม่เกิน 2 ฉาก)
//   - lowQ = ภาพนิ่ง (หยุดอนิเมชันทั้งหมด อนุภาคเหลือ 1/3)
// ============================================================

import { memo, useEffect, useState } from "react";
import JourneyScene from "./scenes";
import { clampJourneyArea } from "./areas";
import "./journey.css";

const FADE_MS = 1800;

function JourneyBackdrop({ area = 1, night = false, lowQ = false }) {
  const a = clampJourneyArea(area);
  const n = !!night;
  const key = `${a}${n ? "n" : "d"}`;
  const [layers, setLayers] = useState(() => [{ key, area: a, night: n }]);

  // ปรับ state ตาม props ระหว่าง render (แพทเทิร์นที่ React แนะนำ แทนการ setState ใน effect)
  if (layers[layers.length - 1].key !== key) {
    // เก็บแค่ฉากบนสุดเดิม (กลายเป็นฉากล่างที่ทึบเต็ม) + ฉากใหม่
    setLayers([layers[layers.length - 1], { key, area: a, night: n }]);
  }

  useEffect(() => {
    if (layers.length < 2) return undefined;
    const t = setTimeout(() => setLayers((prev) => prev.slice(-1)), FADE_MS + 120);
    return () => clearTimeout(t);
  }, [layers]);

  return (
    <div className={`jb${lowQ ? " jb-lowq" : ""}`} style={{ "--jb-fade": `${FADE_MS}ms` }} aria-hidden="true">
      {layers.map((l, i) => (
        <div key={l.key} className={`jb-scene${i === layers.length - 1 ? " jb-in" : ""}`}>
          <JourneyScene area={l.area} night={l.night} lowQ={lowQ} />
        </div>
      ))}
      <div className="jb-grade" />
    </div>
  );
}

export default memo(JourneyBackdrop);
