// ============================================================
//  ECHO — Blackjack Skill Battle : เซิร์ฟเวอร์ + เอนจินเกม
//  - การ์ดสุ่มเลข 1-10 (ไม่ซ้ำในมือเดียวกัน) รวมแต้มใกล้ 21 สุดโดยไม่เกิน
//  - 1 รอบ: ไพ่ -> [CUTSCENE] -> สรุปผล -> โจมตี -> แบนเนอร์รอบ
//  - ระบบแปลงร่าง/cutscene/เพลงสกิลแบบ generic (Ginga / NewType Paradise / NT-D)
// ============================================================

// ตาข่ายสำรองชั้นสุดท้าย — ทุก socket handler ควรมี try/catch ของตัวเองแล้ว (ดู safeOn/onPlayerEvent)
//  นี่ป้องกันเผื่อโค้ดจุดอื่น (เช่น setTimeout/setInterval callback) โยน error ที่ไม่มีใครจับ ไม่ให้ process ทั้งตัว crash
process.on("uncaughtException", (err) => {
  console.error("[uncaughtException] เซิร์ฟเวอร์เจอข้อผิดพลาดที่ไม่ได้ถูกจับ — ทำงานต่อแทนที่จะปิดตัว:", err);
});
process.on("unhandledRejection", (err) => {
  console.error("[unhandledRejection] Promise ถูกปฏิเสธโดยไม่มีใครจับ:", err);
});

// โค้ดเกมแยกอยู่ใน server/ — socket.js โหลดทุกระบบตามมาเอง (ลงทะเบียน io.on('connection') ตอน require)
const { server } = require("./server/app");
const { engine } = require("./server/engine");
const attack = require("./server/phases/attack");
const characterRules = require("./server/characterRules");
const combat = require("./server/combat");
const overload = require("./server/overload");
const pair = require("./server/pair");
const summary = require("./server/phases/summary");
require("./server/socket");

// เผื่อ require() ไฟล์นี้จากเทสต์ (ดึง computeAttackBase ไปทดสอบตรงๆ ไม่ต้องบูตทั้งเซิร์ฟเวอร์)
//  — ฟังก์ชันอื่นที่เหลือยังเข้าถึงไม่ได้จากภายนอกโดยตั้งใจ ต้องเพิ่มเข้า export นี้เองถ้าจะทดสอบเพิ่ม
module.exports = {
  computeAttackBase: attack.computeAttackBase,
  resolveRound: summary.resolveRound, // เทสต์เรียกตรงๆ เพื่อพิสูจน์การตัดสินผู้ชนะ/ผู้แพ้จริง (ไม่จำลองเงื่อนไขเอง)
  pairAllows: pair.pairAllows, // สไตรเกอร์ ยูเรก้า: สิทธิ์ตามบทบาทของคู่หู (เทสต์เรียกตรง)
  mark42Control: characterRules.mark42Control, // เกราะ Mark 42: เจ้าของคุมชุด (โค้ดจริงเรียกจาก socket)
  strikerApprove: characterRules.strikerApprove, strikerRepairStart: characterRules.strikerRepairStart, strikerRepairDone: characterRules.strikerRepairDone, // สไตรเกอร์ ยูเรก้า: คำสั่งของนักบิน (โค้ดจริงเรียกจาก socket)
  attackSoundOf: attack.attackSoundOf, // เสียงโจมตีปกติเฉพาะตัวละคร (เทสต์อ่านตรงนี้)
  engine,
  maxHpOf: combat.maxHpOf,
  maxArmorOf: combat.maxArmorOf,
  overloadCanSafelyDraw: combat.overloadCanSafelyDraw,
  resetOverloadDrawCounter: combat.resetOverloadDrawCounter,
  captureTurnSnapshot: overload.captureTurnSnapshot,
  restoreTurnSnapshot: overload.restoreTurnSnapshot,
  clearTurnSnapshot: overload.clearTurnSnapshot,
};

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => console.log("🃏 ECHO — Blackjack Skill Battle ทำงานที่พอร์ต " + PORT));
}
