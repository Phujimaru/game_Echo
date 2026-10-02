// โหมด Type Mercury (Raid Boss ORT) + โหวตยอมแพ้
// export ก่อน require: ไฟล์ใน server/ require วนกันเอง — function declaration ถูก hoist จึงพร้อมใช้ตั้งแต่บรรทัดแรก
Object.assign(module.exports, {
  mercuryActive, isOrt, ortBoss, humanPlayers, ortFx, createOrt, resetMercury, mercuryOnDeath,
  mercuryPick, mercuryRespawnPicked, maybeJourneyAdvance, normalGameOver, checkOrtEarlyWin,
  mercuryAdvance, mercurySurrenderVote, mercuryStateFor,
});

const { CHARACTERS, CHAR_BY_ID } = require("../../characters");
const CHAR_HOOKS = require("../../characters/index");
const Journey = require("../../characters/_journey");
const Seraph = require("../../seraph");
const { io } = require("../app");
const {
  JOURNEY_ADVANCE_SECONDS, MERCURY_SURRENDER_SECONDS, ORT_ID, ORT_POSITION, TRANSITION_TIME,
} = require("../constants");
const match = require("../match");
const { engine } = require("../engine");
const combat = require("../combat");
const draw = require("../phases/draw");
const lobby = require("../lobby");
const socketLayer = require("../socket");
const timers = require("../timers");
const view = require("../view");

function mercuryActive() { return match.gameMode === "mercury"; }
function isOrt(p) { return !!p && p.id === ORT_ID; }
function ortBoss() { const p = match.players[ORT_ID]; return p && p.alive ? p : null; }
function humanPlayers() { return Object.values(match.players).filter((p) => !isOrt(p)); }
function aliveHumans() { return humanPlayers().filter((p) => p.alive); }
// อนิเมชันบนตัว ORT (ไม่หยุดเกม) — client เรียก ortStage.play(kind)
function ortFx(kind) { io.emit("ortFx", { kind, seq: ++match.ortFxSeq }); }
// ============================================================
//  Type Mercury (Raid Boss ORT)
// ============================================================
function createOrt(bars) {
  const ch = CHAR_BY_ID.ort;
  const p = socketLayer.newPlayerRecord({ playerId: ORT_ID, sessionToken: null, socketId: null, name: ch.name, color: null, pos: ORT_POSITION, ch });
  p.isBoss = true;
  match.players[ORT_ID] = p;
  combat.resetCombat(p);
  p.ready = true;
  p.connected = true;
  p.teamConfirmed = true;
  p.locked = true;
  CHAR_HOOKS.ort.initBoss(p, bars);
  return p;
}
function resetMercury() {
  match.ortArrivalActive = false;
  if (match.mercurySurrender && match.mercurySurrender.timer) clearTimeout(match.mercurySurrender.timer);
  match.mercurySurrender = null;
  match.mercuryLost = new Set();
  match.mercuryResult = null;
  match.mercuryHold = false;
  CHAR_HOOKS.ort.resetMatch();
}
// ผู้เล่นจริงตายในโหมด Raid -> ตัวละครนั้น "ข้อมูลสูญหาย" ทั้งห้อง และเจ้าของต้องเลือกตัวใหม่
function mercuryOnDeath(p) {
  if (p.alive) return;
  match.mercuryLost.add(p.characterId);
  p.mercuryPick = null;
}
// ตัวละครที่ยังเลือกลงสนามได้ (ไม่ใช่บอต/ไม่ล็อก/ไม่สูญหาย/ตัว unique ที่คนอื่นยังใช้อยู่)
function mercuryPickable(forPlayer) {
  const held = new Set(humanPlayers().filter((o) => o !== forPlayer && (o.alive || o.mercuryPick))
    .map((o) => (o.alive ? o.characterId : o.mercuryPick)));
  return CHARACTERS.filter((c) => !c.locked && !c.hidden && !c.botOnly && !match.mercuryLost.has(c.id)
    && !(c.unique && held.has(c.id)));
}
function mercuryPick(playerId, characterId, extra = {}) {
  const p = match.players[playerId];
  if (!mercuryActive() || match.mercuryResult || !p || isOrt(p) || p.alive) return;
  if (!["PLAYING", "CUTSCENE", "SUMMARY", "ATTACK", "ATTACKING", "TRANSITION"].includes(match.gameState)) return;
  if (characterId === "") { p.mercuryPick = null; view.broadcastState(); return; } // ยกเลิกเพื่อเลือกตัวใหม่
  if (!mercuryPickable(p).some((c) => c.id === characterId)) return;
  p.mercuryPick = characterId;
  p.mercuryPickShikiUlt = extra.shikiUlt === "wither" ? "wither" : "deatheye";
  // ผู้เล่นตายหมดแล้วเกมหยุดรอ -> มีคนเลือกตัวแล้ว เดินต่อได้
  if (match.mercuryHold) {
    match.mercuryHold = false;
    match.gameState = "TRANSITION";
    timers.startPhaseTimer(TRANSITION_TIME, draw.dealRound);
  }
  view.broadcastState();
}
// ต้นเทิร์น: คนที่เลือกตัวไว้แล้วลงสนามด้วยเลือด/เกราะเต็ม — เหรียญและไอเทมติดตัวไปด้วย แต้มสกิลเริ่มใหม่
function mercuryRespawnPicked() {
  if (!mercuryActive()) return;
  for (const p of humanPlayers()) {
    if (p.alive) {
      // ถูกชุบชีวิตกลับมาในร่างเดิม (เช่น เพลง Longing ของยูนะ) -> ตัวละครนี้ไม่ได้ "สูญหาย" แล้ว
      match.mercuryLost.delete(p.characterId);
      p.mercuryPick = null;
      continue;
    }
    const ch = p.mercuryPick && CHAR_BY_ID[p.mercuryPick];
    if (!ch || match.mercuryLost.has(ch.id)) { p.mercuryPick = null; continue; }
    const keep = {
      id: p.id, sessionToken: p.sessionToken, socketId: p.socketId, connected: p.connected,
      name: p.name, customColor: p.customColor, position: p.position,
      gold: p.gold || 0, inventory: p.inventory || [],
      pair: p.pair, // สไตรเกอร์ ยูเรก้า: คู่หูยังบังคับร่วมกันต่อในตัวละครใหม่
    };
    const origChar = p.mercuryOrigChar || p.characterId; // ตัวที่เลือกตอนเข้าห้อง — คืนให้ตอนกลับห้องรอ
    const fresh = socketLayer.newPlayerRecord({ playerId: p.id, sessionToken: p.sessionToken, socketId: p.socketId, name: p.name, color: p.customColor, pos: p.position, ch, shikiUlt: p.mercuryPickShikiUlt });
    for (const k of Object.keys(p)) delete p[k];
    Object.assign(p, fresh);
    combat.resetCombat(p);
    Object.assign(p, { connected: keep.connected, customColor: keep.customColor, gold: keep.gold, inventory: keep.inventory, ready: true, teamConfirmed: true, mercuryOrigChar: origChar });
    match.lastLog.push(`🔁 ${p.name} กลับเข้าสนามในร่าง ${ch.name}`);
  }
}
// การเดินทาง: เทิร์นถัดไปเป็นเทิร์นแรกของภูมิภาคใหม่ -> พักเกมให้ฉากแผนที่ "เดินทางต่อ" เล่นจบก่อน แล้วค่อยแจกไพ่
//  คืน true = จัดการเฟสถัดไปเองแล้ว (ผู้เรียกต้อง return) · ย้อนเวลา (ชิโด) ถอยกลับภูมิภาคเก่าได้เองโดยไม่มีฉาก
function maybeJourneyAdvance() {
  if (!Journey.active(engine)) return false;
  const from = Journey.areaOf(match.roundNumber);
  const to = Journey.areaOf(match.roundNumber + 1);
  if (to <= from) return false;
  match.journeyScene = { seq: ++match.journeySceneSeq, active: true, mode: "advance", area: to, fromArea: from };
  match.lastLog.push(`🗺️ ออกเดินทางต่อ — มุ่งหน้าสู่ภูมิภาคที่ ${to} ${Journey.AREAS[to - 1].name}`);
  match.cutsceneInfo = null;
  match.gameState = "CUTSCENE";
  timers.startPhaseTimer(JOURNEY_ADVANCE_SECONDS, () => { match.journeyScene.active = false; draw.dealRound(); });
  view.broadcastState();
  return true;
}
// โหมดปกติ: เหลือผู้เล่นจริงคนเดียว (หรือทีมเดียว) = จบเกม — ORT ไม่นับเป็นผู้ชิงชัย
//  คืน true = จบเกมแล้ว
function normalGameOver() {
  const stillAlive = aliveHumans();
  const total = humanPlayers().length;
  const teamWin = lobby.remainingTeamWinInfo(stillAlive, total);
  if (teamWin.over) {
    match.winningTeamId = teamWin.teamId;
    if (match.winningTeamId) {
      const winners = stillAlive.filter((p) => p.teamId === match.winningTeamId).map((p) => p.name).join(" & ");
      match.lastLog.push(`🏆 Team ${match.winningTeamId} (${winners}) ชนะ!`);
    } else {
      match.lastLog.push("ไม่มีทีมที่รอด — เสมอ");
    }
  } else if (!lobby.teamModeActive() && total >= 2 && (stillAlive.length <= 1 || CHAR_HOOKS.takt.bondGroupWins(engine, stillAlive))) {
    match.winningTeamId = null;
    if (stillAlive.length > 1) match.lastLog.push(`🏆 ${stillAlive.map((p) => p.name).join(" & ")} ชนะพร้อมกันด้วยพันธะสัญญา!`); // อาซาฮินะ ทักต์
    else if (stillAlive.length === 1) match.lastLog.push(`🏆 ${stillAlive[0].name} คือผู้ชนะคนสุดท้าย!`);
    else match.lastLog.push("ไม่มีผู้รอด — เสมอ");
  } else {
    return false;
  }
  timers.clearPhaseTimer();
  match.gameState = "GAMEOVER";
  match.timeLeft = 0;
  view.broadcastState();
  return true;
}
// ORT อยู่ในสนามโหมดปกติ: มีคนตายกลางเฟสจั่วไพ่ (สวนกลับ/สกิล/ไอเทม) จนเหลือคนเดียว -> จบทันที ไม่ต้องรอจบเทิร์น
//  เรียกเฉพาะจุดที่ปลอดภัย (ท้ายการกระทำในเฟส PLAYING) — ระหว่างฉากโจมตี/คัตซีนปล่อยให้ endTurn ตัดสินตามปกติ
function checkOrtEarlyWin() {
  if (!match.players[ORT_ID] || mercuryActive() || Seraph.active() || match.gameState !== "PLAYING") return false;
  if (CHAR_HOOKS.shido.rewindPending(engine)) return false; // ชิโดกำลังจะย้อนเวลา — ทุกคนจะกลับมา
  return normalGameOver();
}
function mercuryFinish(result) {
  if (match.mercuryResult) return;
  match.mercuryResult = result;
  if (match.mercurySurrender && match.mercurySurrender.timer) clearTimeout(match.mercurySurrender.timer);
  match.mercurySurrender = null;
  match.mercuryHold = false;
  match.winningTeamId = null;
  if (result === "win") match.lastLog.push("🏆 ORT ถูกโค่นแล้ว — ผู้เล่นทุกคนชนะ Raid!");
  else if (result === "surrender") match.lastLog.push("🏳️ ทีมโหวตยอมแพ้ — Raid จบลง");
  else match.lastLog.push("💀 ไม่เหลือตัวละครให้ลงสนามแล้ว — ORT ชนะ");
  timers.clearPhaseTimer();
  match.gameState = "GAMEOVER";
  match.timeLeft = 0;
  view.broadcastState();
}
// เช็คผล Raid ตอนจบเทิร์น — คืน true = จัดการเฟสถัดไปเองแล้ว (ผู้เรียกต้อง return)
function mercuryAdvance() {
  if (!mercuryActive()) return false;
  if (!match.players[ORT_ID] || !match.players[ORT_ID].alive) { mercuryFinish("win"); return true; }
  if (aliveHumans().length === 0) {
    // คอนเนอร์: ฟื้นคืนชีพเองเมื่อครบกำหนด — นับเป็น "ยังมีคนรอลงสนาม" และเทิร์นต้องเดินต่อให้ถึงรอบนั้น
    const reviving = humanPlayers().some((p) => (p.connorReviveRound || 0) > match.roundNumber);
    const waiting = reviving || humanPlayers().some((p) => p.mercuryPick);
    if (!waiting && humanPlayers().every((p) => mercuryPickable(p).length === 0)) { mercuryFinish("lose"); return true; }
    if (!waiting) {
      // ตายหมดและยังไม่มีใครเลือกตัว -> หยุดเกมไว้ เวลาไม่เดิน จนกว่าจะมีคนเลือก (mercuryPick สั่งเดินต่อ)
      match.mercuryHold = true;
      timers.clearPhaseTimer();
      match.gameState = "TRANSITION";
      match.timeLeft = 0;
      view.broadcastState();
      return true;
    }
  }
  return false;
}
// ---------- โหวตยอมแพ้ (เสียงข้างมาก + นับถอยหลัง) ----------
function mercurySurrenderVote(playerId, yes) {
  const p = match.players[playerId];
  if (!mercuryActive() || match.mercuryResult || !p || isOrt(p) || match.gameState === "GAMEOVER") return;
  if (!match.mercurySurrender) {
    if (!yes) return; // เปิดโหวตได้ด้วยการกด "ยอมแพ้" เท่านั้น
    match.mercurySurrender = { votes: {}, endsAt: Date.now() + MERCURY_SURRENDER_SECONDS * 1000, timer: null };
    match.mercurySurrender.timer = setTimeout(() => settleSurrender(true), MERCURY_SURRENDER_SECONDS * 1000);
  }
  match.mercurySurrender.votes[playerId] = !!yes;
  settleSurrender(false);
  view.broadcastState();
}
function settleSurrender(deadline) {
  const v = match.mercurySurrender;
  if (!v) return;
  const humans = humanPlayers();
  const yes = humans.filter((p) => v.votes[p.id] === true).length;
  const no = humans.filter((p) => v.votes[p.id] === false).length;
  const half = humans.length / 2;
  // ชนะขาดแล้ว (เกินครึ่งของทั้งห้อง) ไม่ต้องรอหมดเวลา · หมดเวลา = นับเฉพาะคนที่กด เสมอ = ไม่ยอมแพ้
  if (yes > half) { mercuryFinish("surrender"); return; }
  const decided = no >= half || yes + no === humans.length;
  if (!deadline && !decided) return;
  if (v.timer) clearTimeout(v.timer);
  match.mercurySurrender = null;
  if (yes > no) { mercuryFinish("surrender"); return; }
  match.lastLog.push("🛡️ โหวตยอมแพ้ไม่ผ่าน — สู้ต่อ!");
  view.broadcastState();
}
function mercuryStateFor(viewer) {
  if (!mercuryActive()) return null;
  const boss = match.players[ORT_ID];
  const v = match.mercurySurrender;
  return {
    arrivalSeq: match.ortArrivalSeq,
    result: match.mercuryResult,
    hold: match.mercuryHold,
    lost: [...match.mercuryLost],
    pickable: viewer && !isOrt(viewer) && !viewer.alive ? mercuryPickable(viewer).map((c) => c.id) : [],
    myPick: viewer ? viewer.mercuryPick || null : null,
    ort: boss ? { id: boss.id, alive: boss.alive, ...CHAR_HOOKS.ort.publicState(boss) } : null,
    surrender: v ? {
      leftMs: Math.max(0, v.endsAt - Date.now()),
      yes: Object.values(v.votes).filter((x) => x === true).length,
      no: Object.values(v.votes).filter((x) => x === false).length,
      total: humanPlayers().length,
      mine: viewer && v.votes[viewer.id] !== undefined ? v.votes[viewer.id] : null,
    } : null,
  };
}
