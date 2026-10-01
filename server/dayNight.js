// ระบบกลางวัน/กลางคืน
// export ก่อน require: ไฟล์ใน server/ require วนกันเอง — function declaration ถูก hoist จึงพร้อมใช้ตั้งแต่บรรทัดแรก
Object.assign(module.exports, {
  isNightRound, nightCycleIndex, morningBonusActive,
});

const CHAR_HOOKS = require("../characters/index");
const Seraph = require("../seraph");
const { CYCLE_TURNS } = require("./constants");
const match = require("./match");
const { engine } = require("./engine");

// เสียงไพเราะที่กึกก้อง (ชเรด เอลัน patch พิเศษ): ใช้ท่าไม้ตาย 1 -> รีเซ็ตกลางคืนใหม่ 3 เทิร์น (แบบ Vortigern)
//  และตราบใดที่มีชเรดร่างสปาด้ายังมีชีวิต ทุกค่ำคืน ฉากหลังจะเป็นราตรีของชเรด (change_fill.jpg)
function isNightRound(n) {
  // SE.RA.PH: 1 รอบ (5 วัน) = 1 ช่วงเวลาเต็ม — รอบเลขคี่กลางวัน รอบเลขคู่กลางคืน
  //  ไม่ผูกกับ CYCLE_TURNS เพราะวันที่ 7 กินหลายเทิร์น (ดวลทีละคู่จนจบคิว)
  if (Seraph.active()) return Seraph.isNight();
  // มิติมายาบรรเลง (Bard): โลหิต = นับเป็นตอนเช้า / วิญญาณ = นับเป็นตอนกลางคืน (อยู่เหนือทุกวงจร)
  const bardCycle = CHAR_HOOKS.bard.dimCycle(engine);
  if (bardCycle) return bardCycle === "night";
  if (n <= match.dayForceUntil) return false;
  const m = n - match.cycleShift;
  const block = m > 0 ? Math.floor((m - 1) / CYCLE_TURNS) : 0;
  return m > 0 && block % 2 === 1;
}
// patch 2.1.7: เช้าที่กี่ (1 = เช้าแรกของเกม, 2 = เช้าที่สอง, ...) — ใช้กำหนดว่าเช้าไหนแจกแต้มสกิลโบนัส
function dayCycleIndex(n) {
  const m = n - match.cycleShift;
  const block = m > 0 ? Math.floor((m - 1) / CYCLE_TURNS) : 0;
  return Math.floor(block / 2) + 1;
}
// patch 2.2.7: คืนที่กี่ของเกม (นับตามบล็อกวงจร ไม่ใช่จำนวนคืน) — ใช้เป็นคีย์ "1 ครั้งต่อ 1 คืน"
//  ของสกิลติดตัวแบทแมน (อัศวินรัตติกาล) — เลื่อนตาม cycleShift เหมือน isNightRound เสมอ
function nightCycleIndex(n) {
  const m = n - match.cycleShift;
  return m > 0 ? Math.floor((m - 1) / CYCLE_TURNS) : 0;
}
// patch 2.1.7: แต้มสกิลโบนัสตอนเช้า — แจกเฉพาะเช้าที่ 2, 4, 6, ... (เช้าที่ 1, 3, 5, ... ไม่มีโบนัส)
function morningBonusActive(n) {
  if (Seraph.active()) return false; // SE.RA.PH: ปิดโบนัสแต้มสกิลตอนเช้าทั้งโหมด (§12)
  const bardCycle = CHAR_HOOKS.bard.dimCycle(engine);
  if (bardCycle) return bardCycle === "day"; // มิติมายาบรรเลงอยู่เหนือทุกวงจร ไม่นับเช้าคู่/คี่
  if (n <= match.dayForceUntil) return true;       // บังคับกลางวันชั่วคราว (โอเบรอน) — ให้โบนัสตามปกติ
  if (isNightRound(n)) return false;
  return dayCycleIndex(n) % 2 === 0;
}
