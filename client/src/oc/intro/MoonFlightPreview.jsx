// ============================================================
//  หน้าดูฉาก "บินจากโลกไปดวงจันทร์" (เฉพาะ dev) — เปิดด้วย  ?moon  ต่อท้าย URL (http://localhost:5173/?moon)
//  ฉากนี้เก็บไว้ให้โหมดในอนาคต (เดิมเป็นฉากเปิดของ Moon Cell ที่ถูกถอดออกไปแล้ว)
//  ใช้งาน: MatchIntro ถาม onOutro() ตอนช่วงเปิดตัวผู้เล่นจบ → คืน { moon: true, durationMs: MOON_MS }
//   แล้ว server ต้องพักเกมให้นานพอ (ช่วงเปิดตัวผู้เล่น + ~6 วิ) — ดู moonFlight.js
//  หน้านี้ใช้ลูกโลกของ MatchIntro เอง (เกมจริงใช้ลูกโลกร่วมที่วาดใต้ฉาก — ห้ามทาสีทึบที่ .ocd-bg)
// ============================================================
import { useState } from "react";
import MatchIntro from "./MatchIntro";
import { MOON_MS } from "./moonFlight";

const mk = (id, name, color, ch, chName, position) => ({
  id, name, color, position, connected: true, alive: true,
  img: `/characters/${ch}/${ch}.jpg`,
  character: { id: ch, img: `/characters/${ch}/${ch}.jpg`, name: chName },
});
const PLAYERS = [
  mk("p1", "คุณ", "#3d8bd9", "kotone", "ฟุจิตะ โคโตเนะ", 1),
  mk("p2", "Rin", "#d2455b", "satoru", "ซาโตรุ อาเคฟุ", 2),
  mk("p3", "Kaze", "#2f9e8f", "eiji", "เอจิ", 3),
  mk("p4", "Nox", "#6a5acd", "satoru", "ซาโตรุ", 4),
];

export default function MoonFlightPreview() {
  const [run, setRun] = useState(0);
  return (
    <div style={{ position: "fixed", inset: 0 }} onDoubleClick={() => setRun((r) => r + 1)} title="ดับเบิลคลิกเพื่อเล่นใหม่">
      <MatchIntro
        key={run}
        players={PLAYERS}
        area={1}
        onOutro={() => ({ moon: true, durationMs: MOON_MS })}
        onHandoff={() => {}}
        onDone={() => setRun((r) => r + 1)}
      />
    </div>
  );
}
