// SE.RA.PH Moon Cell: เฟสเลือกสถานที่ + ตัวเดินวัน/รอบ
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

// ---------- SE.RA.PH: เฟสเลือกสถานที่ (SERAPH_MOONCELL.md §5 ขั้นที่ 3 · ฉาก S4) ----------
//  เปิดหลังสรุปแต้มของวันที่ 1-6 · ทุกคนเลือกพร้อมกัน · ครบคนหรือหมดเวลาแล้วจึงขึ้นวันถัดไป
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
    // หมดคิวคู่ดวลแล้ว -> จบรอบ
    if (finish()) return true;
    // ล้างของจากวันดวลก่อน แล้ว endCycle ค่อยฟื้นเลือด/เกราะ + แจกเหรียญจบรอบ
    for (const p of Object.values(match.players)) if (!p.scEliminated) combat.resetCycleCombat(p);
    match.echoFreeHit = null; // Echo: เฟสย่อยตีฟรีที่ค้าง
    Seraph.endCycle(engine);
    match.gameState = "TRANSITION";
    timers.startPhaseTimer(TRANSITION_TIME, draw.dealRound);
    view.broadcastState();
    return true;
  }

  // วันที่ 1-6: ขึ้นวันถัดไป (จบวันที่ 2 = ประกาศคู่ดวล · จบวันที่ 6 = เข้าวันดวล)
  const { next } = Seraph.advanceDay(engine);
  if (next === "duelDay") Seraph.beginDuelDay(engine);
  match.gameState = "TRANSITION";
  timers.startPhaseTimer(TRANSITION_TIME, draw.dealRound);
  view.broadcastState();
  return true;
}
