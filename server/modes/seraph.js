// SE.RA.PH Moon Cell: เฟสแมพวันสืบสวน + ตัวเดินวัน/รอบ
// export ก่อน require: ไฟล์ใน server/ require วนกันเอง — function declaration ถูก hoist จึงพร้อมใช้ตั้งแต่บรรทัดแรก
Object.assign(module.exports, {
  beginSeraphPlacePhase, seraphAdvance,
});

const Seraph = require("../../seraph");
const { SERAPH_PLACE_SAFETY_SECONDS, TRANSITION_TIME } = require("../constants");
const match = require("../match");
const combat = require("../combat");
const { engine } = require("../engine");
const draw = require("../phases/draw");
const endTurnPhase = require("../phases/endTurn");
const timers = require("../timers");
const view = require("../view");

// ---------- SE.RA.PH: เฟสแมพวันสืบสวน (SERAPH_MOONCELL.md §5) ----------
//  เปิดตั้งแต่ต้นวันที่ 1-6 (draw.dealRound ไม่แจกไพ่) · ทุกคนเดิน/เก็บของ/เข้าสถานที่พร้อมกัน · ครบคนกดพร้อมแล้วจึงขึ้นวันถัดไป
function beginSeraphPlacePhase() {
  timers.clearPhaseTimer();
  Seraph.startPlacePhase(engine, finishSeraphPlacePhase);
  match.gameState = "SERAPH_PLACE";
  // **ไม่มีเวลาจำกัด** — ไปต่อเมื่อทุกคนกดพร้อมเท่านั้น (finishSeraphPlacePhase ถูกเรียกจาก
  //  Seraph.readyPlace เมื่อทุกคนกดพร้อม) ตัวจับเวลาที่ตั้งไว้เป็นแค่ตาข่ายกันเกมค้างถาวร
  //  กรณีมีคนหลุดการเชื่อมต่อแล้วไม่กลับมา — ยาวกว่า RECONNECT_GRACE_MS (60s) หลายเท่า
  //  และ client ไม่แสดงเป็นนาฬิกานับถอยหลัง
  timers.startPhaseTimer(SERAPH_PLACE_SAFETY_SECONDS, finishSeraphPlacePhase);
  view.broadcastState();
}
function finishSeraphPlacePhase() {
  if (match.gameState !== "SERAPH_PLACE") return; // กันถูกเรียกซ้ำ (ครบคน + หมดเวลาพร้อมกัน)
  timers.clearPhaseTimer();
  Seraph.finishPlacePhase(engine);
  endTurnPhase.endTurn();
}

// ล้างสถานะการต่อสู้ของผู้เล่นที่ยังไม่ตกรอบ (คงเงิน/ไอเทม/ค่าของโหมด — combat.resetCycleCombat)
//  + ของระดับแมตช์: ตีฟรีของ Echo ที่ค้าง · สนาม Break Beat Bark! (ท่าไม้ตายของเอจิใช้ช่องทางเดียวกับยูนะ)
function clearCombatState() {
  for (const p of Object.values(match.players)) if (!p.scEliminated) combat.resetCycleCombat(p);
  match.echoFreeHit = null;
  match.yunaEffect = null; match.yunaTargetId = null; match.yunaWindowEnd = 0; match.yunaLongingPendingId = null;
}

// ---- ปิดรอบ ----
// ============================================================
//  SE.RA.PH — ตัวเดินวัน/รอบ (เรียกจากท้าย endTurn เท่านั้น)
//  คืน true = จัดการเฟสถัดไปเองแล้ว ผู้เรียกต้อง return ทันที
// ============================================================
function seraphAdvance() {
  // เหลือผู้รอดคนเดียว = จบเกมทั้งแมตช์
  const finish = () => {
    const left = Seraph.survivors(engine);
    if (left.length <= 1) {
      match.winningTeamId = null;
      if (left.length === 1) match.lastLog.push(`🏆 ${left[0].name} คือผู้รอดคนสุดท้ายของ SE.RA.PH — คำขอถูกมอบให้!`);
      else match.lastLog.push("ไม่มีผู้รอด — เสมอ");
      match.gameState = "GAMEOVER";
      match.timeLeft = 0;
      view.broadcastState();
      return true;
    }
    return false;
  };

  // คืนวันที่ 7 จบ (ทุกคนกดพร้อม) -> จบรอบ ฟื้นเลือด/เกราะ แจกเหรียญ แล้วขึ้นวันที่ 1 ของรอบใหม่
  if (Seraph.isDuelNight()) {
    if (finish()) return true;
    clearCombatState();
    Seraph.endCycle(engine);
    match.gameState = "TRANSITION";
    timers.startPhaseTimer(TRANSITION_TIME, draw.dealRound);
    view.broadcastState();
    return true;
  }

  if (Seraph.isDuelDay()) {
    // วันที่ 7: คู่นี้จบหรือยัง
    const st = Seraph.checkDuelProgress(engine);
    if (st === "continue") return false;      // ดวลคู่เดิมต่อในเทิร์นถัดไป
    if (st === "nextPair") {
      if (finish()) return true;
      match.gameState = "TRANSITION";
      timers.startPhaseTimer(TRANSITION_TIME, draw.dealRound); // ขึ้นคู่ถัดไป
      view.broadcastState();
      return true;
    }
    // ดวลจบ -> คืนวันที่ 7 (เดินแมพ · ห้องพัก + ร้านค้า) ก่อนจบรอบ
    if (finish()) return true;
    // ล้างของจากวันดวลก่อน (endCycle ฟื้นเลือด/เกราะ + แจกเหรียญตอนจบคืนนี้)
    clearCombatState();
    Seraph.beginDuelNight(engine);
    match.gameState = "TRANSITION";
    timers.startPhaseTimer(TRANSITION_TIME, draw.dealRound);
    view.broadcastState();
    return true;
  }

  // วันที่ 1-6: ขึ้นวันถัดไป (จบวันที่ 5 = ประกาศคู่ดวล · จบวันที่ 6 = เข้าวันดวล)
  //  ตาข่าย: วันสืบสวนไม่มีสถานะ/สกิลติดตัว — อะไรที่ hook ของตัวละครแอบสร้างไว้ระหว่างวันถูกล้างทิ้ง
  //  ก่อนขึ้นวันใหม่ (และก่อน beginDuelDay แจกแต้มสกิลเริ่มดวล) จึงเข้าวันดวลด้วยสภาพสะอาดเสมอ
  clearCombatState();
  const { next } = Seraph.advanceDay(engine);
  if (next === "duelDay") Seraph.beginDuelDay(engine);
  match.gameState = "TRANSITION";
  timers.startPhaseTimer(TRANSITION_TIME, draw.dealRound);
  view.broadcastState();
  return true;
}
