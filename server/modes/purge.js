// โหมด Purge — หนี ORT ในอุโมงค์ท่อ (ทอยเต๋า)
//  ทุกเทิร์น ("เทิร์นเต๋า" = match.purge.turn ไม่ใช่ roundNumber ของ engine):
//   1. ฉากเต๋า: ORT เดิน (ของเทิร์นที่แล้ว) → จับคนที่ตามทัน (LOST DATA) → ทุกคนที่รอดทอยเต๋า 1-6 แล้วเดินตามแต้ม
//   2. คนที่ตกช่องเดียวกันสู้กัน (จั่วไพ่ตามระบบเดิม) ทีละจุดจากท้ายท่อไปหน้าท่อ — 1 จุด = 1 รอบของ engine
//      (dealRound → resolveRound → โจมตี → endTurn) คนอื่นเป็นผู้ชม (ไม่ได้ไพ่ ไม่ได้กดสกิล/ไอเทม)
//      ผู้ชนะไม่เสมอ → คนอื่นในจุดนั้นถอยหลัง PURGE_FIGHT_KNOCKBACK ช่อง
//   3. ไม่มีใครตกช่องเดียวกัน = ไม่มีรอบการ์ด ไปทอยเต๋าเทิร์นถัดไปเลย
//  · ORT โผล่ช่อง 0 ตอนจบเทิร์นเต๋า PURGE_ORT_TURN แล้วเดิน PURGE_ORT_SPEED ช่องทุกเทิร์น · ช่อง <= ORT = LOST DATA
//  · เลือดหมด = ล้มลง ถอยหลัง PURGE_KNOCKBACK ช่อง เลือด/เกราะเต็ม (ดัก instantDeath จุดเดียว)
//  · ถึงประตูผนึก (ช่อง PURGE_STEPS) คนเดียว = ชนะทันที · ถึงพร้อมกันหลายคน = สู้กันที่ประตู ผู้ชนะคือผู้ชนะเกม
//  · เหลือรอดคนเดียว (เกม 2 คนขึ้นไป) = ชนะ · ORT ถึงปลายท่อ/ไม่เหลือใคร = ทุกคนแพ้
//  ฉากฝั่ง client (client/src/purge/purgeScene.js) — server พักเฟส CUTSCENE (ไม่มีคลิป) ตามเวลาที่คำนวณด้วยสูตรเดียวกัน
// export ก่อน require: ไฟล์ใน server/ require วนกันเอง — function declaration ถูก hoist จึงพร้อมใช้ตั้งแต่บรรทัดแรก
Object.assign(module.exports, {
  purgeActive, resetPurge, startPurge, diceTurn, benched, combatants, onFightResult, tryKnockBack, purgeAdvance,
  purgeStateFor, diceSceneSeconds, introHoldSeconds, nextPhaseOrEnd, rollDie,
});

const {
  PURGE_FIGHT_INTRO_SECONDS, PURGE_FIGHT_KNOCKBACK, PURGE_INTRO_SECONDS, PURGE_KNOCKBACK, PURGE_ORT_SPEED,
  PURGE_ORT_TURN, PURGE_STEPS,
} = require("../constants");
const match = require("../match");
const combat = require("../combat");
const draw = require("../phases/draw");
const timers = require("../timers");
const view = require("../view");

function purgeActive() { return match.gameMode === "purge"; }
function fresh() {
  return { steps: {}, ort: null, lost: [], scene: null, seq: 0, result: null, winnerId: null, turn: 0, fights: [], fightIdx: -1, fight: null };
}
function state() { return match.purge || (match.purge = fresh()); }
function resetPurge() { match.purge = fresh(); }

// ---------- เวลาของฉาก — ต้องตรงกับ client/src/purge/purgeScene.js (มีเทสต์เทียบ) ----------
const T_OUT = 1.6, T_ORBIT = 2.2, T_ORT_ARRIVE = 2.4, T_ORT_STEP = 0.35, T_AFTER_ORT = 0.4, T_BOOM = 1.9;
const T_DICE = 1.9, T_WALK_STEP = 0.3, T_AFTER_WALK = 0.6, T_FIGHT_MARK = 1.4, T_END = 0.4;
function diceSceneSeconds(scene) {
  let t = T_OUT + T_ORBIT;
  if (scene.ortTo != null && scene.ortTo !== scene.ortFrom) {
    t += scene.ortFrom == null ? T_ORT_ARRIVE : (scene.ortTo - scene.ortFrom) * T_ORT_STEP + T_AFTER_ORT;
  }
  if ((scene.caught || []).length) t += T_BOOM;
  const walks = (scene.moves || []).map((m) => m.to - m.from);
  if (walks.length) t += T_DICE + Math.max(...walks) * T_WALK_STEP + T_AFTER_WALK;
  if ((scene.fights || []).length) t += T_FIGHT_MARK;
  return t + T_END;
}
function introHoldSeconds() { return PURGE_INTRO_SECONDS; }

function stepOf(p) { return state().steps[p.id] || 0; }
function setStep(p, step) { state().steps[p.id] = Math.max(0, Math.min(PURGE_STEPS, step)); }
function humans() { return Object.values(match.players); }
function aliveHumans() { return humans().filter((p) => p.alive); }
// PURGE_FIXED_DICE (env) = ทุกลูกออกแต้มเดียวกัน ใช้ทดสอบฉากปะทะ
const FIXED_DICE = Math.max(0, Math.min(6, Number(process.env.PURGE_FIXED_DICE) || 0));
function rollDie() { return FIXED_DICE || 1 + Math.floor(Math.random() * 6); }

// เริ่มแมตช์: ทุกคนอยู่ช่อง 0 + ฉากเปิด — ผู้เรียกพักเฟส CUTSCENE เองแล้วเรียก diceTurn() ตอนจบ
function startPurge() {
  resetPurge();
  const s = state();
  for (const p of humans()) s.steps[p.id] = 0;
  s.scene = { seq: ++s.seq, kind: "intro", active: true };
}

// ---------- ผู้ชม / คู่สู้ ----------
// ระหว่างรอบการ์ดของจุดหนึ่ง คนที่ไม่ได้อยู่ในจุดนั้นเป็นผู้ชม
function benched(p) {
  const s = match.purge;
  return !!(purgeActive() && s && s.fight && p && !s.fight.ids.includes(p.id));
}
function combatants() {
  const s = state();
  if (!s.fight) return [];
  return s.fight.ids.map((id) => match.players[id]).filter((p) => p && p.alive);
}

// ผลการสู้ (เรียกจาก resolveRound ตรงจุดที่ตัดสินผู้ชนะแล้ว): ชนะไม่เสมอ → คนอื่นในจุดนั้นถอยหลัง
function onFightResult(w) {
  const s = state();
  if (!purgeActive() || !s.fight || !w) return;
  s.fight.winnerId = w.id;
  if (match.roundTiedWin) return;
  for (const p of combatants()) {
    if (p.id === w.id) continue;
    const before = stepOf(p);
    setStep(p, before - PURGE_FIGHT_KNOCKBACK);
    if (before !== stepOf(p)) match.lastLog.push(`↩️ ${p.name} แพ้การปะทะ ถอยหลัง ${before - stepOf(p)} ช่อง (ช่อง ${stepOf(p)})`);
  }
}

// เลือดหมด = ล้มลง: ถอยหลังแล้วฟื้นเต็ม แทนการตกรอบ — เรียกจาก instantDeath() ก่อนบรรทัดตั้ง alive=false
//  คืน true = ผู้เรียกต้อง return ทันที (ไม่ตาย)
function tryKnockBack(p) {
  if (!purgeActive() || !p || !p.alive) return false;
  const before = stepOf(p);
  setStep(p, before - PURGE_KNOCKBACK);
  p.hp = combat.maxHpOf(p);
  p.armor = combat.maxArmorOf(p);
  p.tempHp = 0;
  p.result = null;
  match.lastLog.push(`💫 ${p.name} ล้มลง! ถอยหลัง ${before - stepOf(p)} ช่อง (ช่อง ${stepOf(p)}) — ลุกขึ้นพร้อมเลือดเต็ม`);
  return true;
}

// LOST DATA: ตกรอบโดยไม่ผ่าน instantDeath (ไม่ใช่การตายจากการต่อสู้ — ไม่ปลุกระบบกันตาย/ชุบชีวิตใดๆ)
function lose(p) {
  p.hp = 0; p.alive = false; p.result = "dead"; p.locked = true;
  p.purgeLost = true;
  const s = state();
  if (!s.lost.includes(p.id)) s.lost.push(p.id);
}
function finish(result, winnerId = null) {
  const s = state();
  s.result = result;
  s.winnerId = winnerId;
  s.fight = null;
  timers.clearPhaseTimer();
  match.winningTeamId = null;
  match.gameState = "GAMEOVER";
  match.timeLeft = 0;
  view.broadcastState();
}
// เช็คจบเกมจากจำนวนคนรอด — คืน true = จบแล้ว
function survivorCheck() {
  const total = humans().length;
  const alive = aliveHumans();
  if (!alive.length) {
    match.lastLog.push("🕳️ ORT กลืนทุกคนในท่อ — ไม่มีผู้รอด");
    finish("allLost");
    return true;
  }
  if (total >= 2 && alive.length === 1) {
    match.lastLog.push(`🏆 ${alive[0].name} คือผู้รอดคนสุดท้าย!`);
    finish("survivor", alive[0].id);
    return true;
  }
  return false;
}
function hold(seconds, then) {
  match.cutsceneInfo = null;
  match.gameState = "CUTSCENE";
  timers.startPhaseTimer(Math.max(1, Math.ceil(seconds)), then);
  view.broadcastState();
}

// ---------- ฉากเต๋า (ต้นเทิร์นเต๋า) ----------
function diceTurn() {
  const s = state();
  s.fight = null; s.fights = []; s.fightIdx = -1;
  match.lastLog = [];
  // 1) ORT ของเทิร์นที่เพิ่งจบ
  const ortFrom = s.ort;
  let ortTo = ortFrom;
  if (s.turn === PURGE_ORT_TURN) ortTo = 0;
  else if (s.turn > PURGE_ORT_TURN && ortFrom != null) ortTo = Math.min(PURGE_STEPS, ortFrom + PURGE_ORT_SPEED);
  s.ort = ortTo;
  if (ortFrom == null && ortTo != null) match.lastLog.push("🕷️ ORT ปรากฏตัวที่ปากท่อ!");
  const caught = [];
  if (ortFrom != null && ortTo != null) {
    for (const p of aliveHumans()) if (stepOf(p) <= ortTo) { lose(p); caught.push(p.id); }
  }
  for (const id of caught) match.lastLog.push(`💠 ${match.players[id].name} ถูก ORT ไล่ทัน — LOST DATA`);
  const total = humans().length;
  const alive = aliveHumans();
  const over = !alive.length || (total >= 2 && alive.length === 1) || (s.ort != null && s.ort >= PURGE_STEPS);
  // 2) ทอยเต๋า (เกมจบแล้วไม่ต้องทอย)
  const moves = [];
  if (!over) {
    s.turn++;
    for (const p of alive) {
      const r = rollDie();
      const from = stepOf(p);
      setStep(p, from + r);
      moves.push({ id: p.id, from, to: stepOf(p), roll: r });
    }
    match.lastLog.push(`🎲 เทิร์น ${s.turn}: ` + moves.map((m) => `${match.players[m.id].name} ${m.roll}`).join(" · "));
  }
  // 3) ถึงประตู / จุดปะทะ
  const reached = over ? [] : alive.filter((p) => stepOf(p) >= PURGE_STEPS);
  let fights = [];
  if (reached.length >= 2) fights = [{ tile: PURGE_STEPS, ids: reached.map((p) => p.id), gate: true }];
  else if (!over && reached.length === 0) {
    const byTile = {};
    for (const p of alive) (byTile[stepOf(p)] = byTile[stepOf(p)] || []).push(p.id);
    fights = Object.entries(byTile).filter(([, ids]) => ids.length >= 2)
      .map(([tile, ids]) => ({ tile: Number(tile), ids })).sort((a, b) => a.tile - b.tile);
  }
  s.fights = fights;
  const scene = { seq: ++s.seq, kind: "dice", active: true, turn: s.turn, ortFrom, ortTo, caught, moves, fights, reached: reached.map((p) => p.id) };
  s.scene = scene;
  hold(diceSceneSeconds(scene) + 0.6, () => {
    scene.active = false;
    if (survivorCheck()) return;
    if (s.ort != null && s.ort >= PURGE_STEPS) { for (const p of aliveHumans()) lose(p); finish("allLost"); return; }
    if (reached.length === 1) {
      match.lastLog.push(`🏁 ${reached[0].name} ถึงประตูผนึกคนแรก — ชนะ!`);
      finish("gate", reached[0].id);
      return;
    }
    nextPhaseOrEnd();
  });
}

// ---------- จุดปะทะ ----------
function startFight(i) {
  const s = state();
  const f = s.fights[i];
  s.fightIdx = i;
  s.fight = { ...f, idx: i, winnerId: null };
  const scene = { seq: ++s.seq, kind: "fight", active: true, tile: f.tile, ids: [...f.ids], gate: !!f.gate, idx: i, count: s.fights.length };
  s.scene = scene;
  match.lastLog = [`⚔️ ปะทะที่ช่อง ${f.tile}: ` + f.ids.map((id) => match.players[id].name).join(" vs ")];
  // เลขรอบของ engine = เทิร์นเต๋า (dealRound บวก 1) — กลางวัน/กลางคืน ร้านค้า ฯลฯ เดินตามเทิร์นเต๋า แม้เทิร์นนั้นจะมีหลายจุดปะทะ
  hold(PURGE_FIGHT_INTRO_SECONDS, () => { scene.active = false; match.roundNumber = Math.max(0, s.turn - 1); draw.dealRound(); });
}
// จุดถัดไปที่ยังสู้ได้ (สมาชิกยังรอดและยังอยู่ช่องเดิมอย่างน้อย 2 คน) — ไม่มีแล้ว = เทิร์นเต๋าถัดไป
function nextPhaseOrEnd() {
  const s = state();
  for (let i = s.fightIdx + 1; i < s.fights.length; i++) {
    const f = s.fights[i];
    const ids = f.ids.filter((id) => match.players[id] && match.players[id].alive && stepOf(match.players[id]) === f.tile);
    if (ids.length >= 2) { s.fights[i] = { ...f, ids }; startFight(i); return; }
  }
  s.fight = null;
  diceTurn();
}

// ท้าย endTurn() ของรอบการ์ด: จบจุดปะทะนี้ → จุดถัดไป / ทอยเต๋าเทิร์นใหม่ / จบเกม
//  คืน true เสมอในโหมดนี้ (จัดการเฟสถัดไปเองทั้งหมด)
function purgeAdvance() {
  const s = state();
  const f = s.fight;
  s.fight = null;
  if (survivorCheck()) return true;
  if (f && f.gate) {
    const w = f.winnerId && match.players[f.winnerId];
    if (w && w.alive) {
      match.lastLog.push(`🏁 ${w.name} ชนะการปะทะที่ประตูผนึก — ชนะ!`);
      finish("gate", w.id);
      return true;
    }
  }
  nextPhaseOrEnd();
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
    ortSpeed: PURGE_ORT_SPEED,
    totalSteps: PURGE_STEPS,
    turn: s.turn,
    lost: [...s.lost],
    fight: s.fight ? { tile: s.fight.tile, ids: [...s.fight.ids], gate: !!s.fight.gate } : null,
    scene: s.scene ? { ...s.scene } : null,
    result: s.result,
    winnerId: s.winnerId,
  };
}
