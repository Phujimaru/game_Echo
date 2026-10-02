// โหมด Purge — หนี ORT ในอุโมงค์ท่อ (ffa)
//  · สู้กันตามปกติ · ผู้ชนะรอบ (ไม่เสมอ) ได้เดิน PURGE_WIN_STEPS ช่อง · คนแพ้ไม่เดิน
//  · ท่อยาว PURGE_STEPS ช่อง · ORT โผล่ที่ช่อง 0 ตอนจบเทิร์น PURGE_ORT_TURN แล้วเดิน 1 ช่องทุก PURGE_ORT_EVERY เทิร์น (ถึงปลายท่อเทิร์น 110)
//  · ORT ไล่ทัน (ช่อง <= ORT) = LOST DATA ตกรอบทันที ไม่มีฉากสู้ · เทิร์นที่ ORT เพิ่งโผล่ยังไม่กินใคร
//  · เลือดหมด = "ล้มลง" ไม่ตาย: ถอยหลัง PURGE_KNOCKBACK ช่อง แล้วเลือด/เกราะเต็ม (ดัก instantDeath จุดเดียว)
//  · เหลือรอดคนเดียว = ชนะ · ORT ถึงปลายท่อ = ทุกคนที่เหลือโดนกิน (แพ้หมด)
//  ORT ในโหมดนี้ไม่ใช่ผู้เล่น (ไม่อยู่ใน match.players) — เป็นแค่ตำแหน่งบนท่อ
//  ฉากจบเทิร์นฝั่ง client (client/src/purge/purgeScene.js) — server พักเฟส CUTSCENE (ไม่มีคลิป) ตาม turnSceneSeconds()
// export ก่อน require: ไฟล์ใน server/ require วนกันเอง — function declaration ถูก hoist จึงพร้อมใช้ตั้งแต่บรรทัดแรก
Object.assign(module.exports, {
  purgeActive, resetPurge, startPurge, awardWinSteps, tryKnockBack, purgeAdvance, purgeStateFor,
  turnSceneSeconds, introHoldSeconds, nextPhaseOrEnd,
});

const {
  PURGE_INTRO_SECONDS, PURGE_KNOCKBACK, PURGE_ORT_EVERY, PURGE_ORT_TURN, PURGE_STEPS, PURGE_WIN_STEPS, TRANSITION_TIME,
} = require("../constants");
const match = require("../match");
const combat = require("../combat");
const draw = require("../phases/draw");
const timers = require("../timers");
const view = require("../view");

function purgeActive() { return match.gameMode === "purge"; }
function fresh() {
  return { steps: {}, ort: null, lost: [], turnFrom: {}, scene: null, seq: 0, result: null };
}
function state() { return match.purge || (match.purge = fresh()); }
function resetPurge() { match.purge = fresh(); }

// เวลาของฉากจบเทิร์น — ต้องตรงกับ turnSceneSeconds() ใน client/src/purge/purgeScene.js (มีเทสต์เทียบ)
const T_ZOOM_OUT = 1.5, T_PAUSE = 0.3, T_STEP = 0.34, T_AFTER_MOVE = 0.25, T_KNOCK = 0.9;
const T_ORT_STEP = 0.75, T_ORT_ARRIVE = 1.4, T_AFTER_ORT = 0.4, T_LOST = 1.3, T_NO_LOST = 0.5, T_ZOOM_IN = 1.8;
function turnSceneSeconds(scene) {
  let t = T_ZOOM_OUT + T_PAUSE;
  for (const m of scene.moves || []) {
    t += m.to > m.from ? (m.to - m.from) * T_STEP + T_AFTER_MOVE : T_KNOCK + T_AFTER_MOVE;
  }
  if (scene.ortTo != null && scene.ortTo !== scene.ortFrom) {
    t += scene.ortFrom == null ? T_ORT_ARRIVE + T_AFTER_ORT : (scene.ortTo - scene.ortFrom) * T_ORT_STEP + T_AFTER_ORT;
  }
  t += (scene.caught || []).length ? T_LOST : T_NO_LOST;
  return t + T_ZOOM_IN;
}
function introHoldSeconds() { return PURGE_INTRO_SECONDS; }

function stepOf(p) { return state().steps[p.id] || 0; }
function moveTo(p, step) {
  const s = state();
  const next = Math.max(0, Math.min(PURGE_STEPS, step));
  if (!(p.id in s.turnFrom)) s.turnFrom[p.id] = stepOf(p);
  s.steps[p.id] = next;
}

// เริ่มแมตช์: ทุกคนอยู่ช่อง 0 + ฉากเปิด (ท่อเต็มวง → ลอยลงมาจุดเริ่ม) — ผู้เรียกพักเฟส CUTSCENE เอง
function startPurge() {
  resetPurge();
  const s = state();
  for (const p of Object.values(match.players)) s.steps[p.id] = 0;
  s.scene = { seq: ++s.seq, kind: "intro", active: true };
}

// ผู้ชนะรอบ: เดินหน้า — เรียกจาก resolveRound() ตรงจุดที่ตัดสินผู้ชนะแล้ว
function awardWinSteps(w) {
  if (!purgeActive() || !w || !w.alive || match.roundTiedWin) return;
  const before = stepOf(w);
  moveTo(w, before + PURGE_WIN_STEPS);
  const moved = stepOf(w) - before;
  if (moved > 0) match.lastLog.push(`👣 ${w.name} ชนะ เดินหน้า ${moved} ช่อง (ช่อง ${stepOf(w)})`);
}

// เลือดหมด = ล้มลง: ถอยหลังแล้วฟื้นเต็ม แทนการตกรอบ — เรียกจาก instantDeath() ก่อนบรรทัดตั้ง alive=false
//  คืน true = ผู้เรียกต้อง return ทันที (ไม่ตาย)
function tryKnockBack(p) {
  if (!purgeActive() || !p || !p.alive) return false;
  const before = stepOf(p);
  moveTo(p, before - PURGE_KNOCKBACK);
  p.hp = combat.maxHpOf(p);
  p.armor = combat.maxArmorOf(p);
  p.tempHp = 0;
  p.result = null;
  match.lastLog.push(`💫 ${p.name} ล้มลง! ถอยหลัง ${before - stepOf(p)} ช่อง (ช่อง ${stepOf(p)}) — ลุกขึ้นพร้อมเลือดเต็ม`);
  return true;
}

function humans() { return Object.values(match.players); }
function finish(result) {
  const s = state();
  s.result = result;
  timers.clearPhaseTimer();
  match.winningTeamId = null;
  match.gameState = "GAMEOVER";
  match.timeLeft = 0;
  view.broadcastState();
}
function nextPhaseOrEnd() {
  const s = state();
  const total = humans().length;
  const alive = humans().filter((p) => p.alive);
  if (!alive.length) {
    match.lastLog.push("🕳️ ORT กลืนทุกคนในท่อ — ไม่มีผู้รอด");
    finish("allLost");
    return;
  }
  if (total >= 2 && alive.length === 1) {
    match.lastLog.push(`🏆 ${alive[0].name} คือผู้รอดคนสุดท้าย!`);
    finish("survivor");
    return;
  }
  if (s.ort != null && s.ort >= PURGE_STEPS) {
    // ปลายท่อ: ORT มาชนแล้วยังเหลือหลายคน = ทุกคนแพ้ (ปกติถูกกินไปแล้วจากเงื่อนไขช่อง <= ORT)
    for (const p of alive) lose(p);
    finish("allLost");
    return;
  }
  match.gameState = "TRANSITION";
  timers.startPhaseTimer(TRANSITION_TIME, draw.dealRound);
  view.broadcastState();
}
// LOST DATA: ตกรอบโดยไม่ผ่าน instantDeath (ไม่ใช่การตายจากการต่อสู้ — ไม่ปลุกระบบกันตาย/ชุบชีวิตใดๆ)
function lose(p) {
  p.hp = 0; p.alive = false; p.result = "dead"; p.locked = true;
  p.purgeLost = true;
  const s = state();
  if (!s.lost.includes(p.id)) s.lost.push(p.id);
}

// ท้าย endTurn(): ORT เดิน → จับคนที่ตามทัน → เล่นฉากจบเทิร์น แล้วไปเทิร์นถัดไป/จบเกม
//  คืน true เสมอในโหมดนี้ (จัดการเฟสถัดไปเองทั้งหมด)
function purgeAdvance() {
  const s = state();
  const ortFrom = s.ort;
  let ortTo = ortFrom;
  if (match.roundNumber === PURGE_ORT_TURN) ortTo = 0;
  else if (match.roundNumber > PURGE_ORT_TURN) {
    // เดิน 1 ช่องทุก PURGE_ORT_EVERY เทิร์น — เทิร์นที่ไม่เดินยังจับคนที่ถอยลงมาอยู่ช่อง <= ORT ตามปกติ · ไม่ถอยหลังเด็ดขาด
    const at = Math.floor((match.roundNumber - PURGE_ORT_TURN) / PURGE_ORT_EVERY);
    ortTo = Math.min(PURGE_STEPS, Math.max(ortFrom ?? 0, at));
  }
  s.ort = ortTo;
  const caught = [];
  if (ortTo != null && ortFrom != null) {
    for (const p of humans()) {
      if (p.alive && stepOf(p) <= ortTo) { lose(p); caught.push(p.id); }
    }
  }
  if (ortFrom == null && ortTo != null) match.lastLog.push("🕷️ ORT ปรากฏตัวที่ปากท่อ!");
  for (const id of caught) match.lastLog.push(`💠 ${match.players[id].name} ถูก ORT ไล่ทัน — LOST DATA`);
  const moves = Object.entries(s.turnFrom)
    .map(([id, from]) => ({ id, from, to: s.steps[id] || 0 }))
    .filter((m) => m.from !== m.to && match.players[m.id]);
  s.turnFrom = {};
  const scene = { seq: ++s.seq, kind: "turn", active: true, moves, ortFrom, ortTo, caught };
  if (!moves.length && ortTo === ortFrom && !caught.length) {
    s.scene = { ...scene, active: false };
    nextPhaseOrEnd();
    return true;
  }
  s.scene = scene;
  match.cutsceneInfo = null;
  match.gameState = "CUTSCENE";
  timers.startPhaseTimer(Math.ceil(turnSceneSeconds(scene) + 0.6), () => {
    s.scene.active = false;
    nextPhaseOrEnd();
  });
  view.broadcastState();
  return true;
}

// ส่งให้ client (ข้อมูลเดียวกันทุกคน — ไม่มีอะไรลับ)
function purgeStateFor() {
  if (!purgeActive()) return null;
  const s = state();
  return {
    steps: { ...s.steps },
    ort: s.ort,
    ortTurn: PURGE_ORT_TURN,
    ortEvery: PURGE_ORT_EVERY,
    totalSteps: PURGE_STEPS,
    lost: [...s.lost],
    scene: s.scene ? { ...s.scene } : null,
    result: s.result,
  };
}
