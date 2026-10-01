// ย้อนเทิร์น (snapshot) + Overload Force
// export ก่อน require: ไฟล์ใน server/ require วนกันเอง — function declaration ถูก hoist จึงพร้อมใช้ตั้งแต่บรรทัดแรก
Object.assign(module.exports, {
  applySnapshot, pushSnapshotHistory, clearSnapshotHistory, snapshotBefore, captureTurnSnapshot,
  clearTurnSnapshot, restoreTurnSnapshot, triggerOverloadForce,
});

const Seraph = require("../seraph");
const { ORT_ID, OVERLOAD_FORCE_CHANCE, OVERLOAD_FORCE_CUTSCENE_SECONDS } = require("./constants");
const match = require("./match");
const combat = require("./combat");
const cutscene = require("./cutscene");
const cardDeck = require("./deck");
const draw = require("./phases/draw");
const mercury = require("./modes/mercury");
const summary = require("./phases/summary");
const timers = require("./timers");
const view = require("./view");

// ประวัติสแนปช็อตต้นเทิร์นย้อนหลัง — ใช้โดยท่าไม้ตาย "ฝากด้วยนะตัวฉัน" (อิสึกะ ชิโด) ที่ย้อนเวลากลับ 5 เทิร์น
//  โครงสร้างเดียวกับ turnSnapshot ของ Overload Force เป๊ะ แค่เก็บหลายใบเป็นวงแหวนแทนใบเดียว
//  (เก็บ SNAPSHOT_HISTORY_MAX ใบพอ — ลึกกว่าที่ท่าไม้ตายต้องการ 1 ใบ เผื่อกรณีเทิร์นต้นเกม)
const SNAPSHOT_HISTORY_MAX = 6;
function buildSnapshot() {
  return {
    round: match.roundNumber,
    players: structuredClone(match.players),
    roundSkills: structuredClone(match.roundSkills),
    shopItems: structuredClone(match.shopItems),
    kaiOverhaulSlots: structuredClone(match.kaiOverhaulSlots),
    g: {
      cycleShift: match.cycleShift, dayForceUntil: match.dayForceUntil, transformCounter: match.transformCounter,
      yunaLongingUsed: match.yunaLongingUsed, yunaWindowEnd: match.yunaWindowEnd, yunaEffect: match.yunaEffect, yunaTargetId: match.yunaTargetId, yunaLongingPendingId: match.yunaLongingPendingId, yunaPity: match.yunaPity,
    },
  };
}
// นำสแนปช็อตกลับมาใช้ — โครงเดียวกับ restoreTurnSnapshot() แต่รับใบไหนก็ได้
//  keepPerPlayer: ฟิลด์ที่ "ห้ามย้อน" รายผู้เล่น (นอกเหนือจากข้อมูลการเชื่อมต่อ) เช่นคูลดาวน์ท่าไม้ตายของชิโด
//  ไม่งั้นการย้อนเวลาจะลบข้อมูลว่าเคยใช้ท่านี้ไปแล้ว = ย้อนวนได้ไม่จำกัด
function applySnapshot(snap, keepPerPlayer) {
  if (!snap) return false;
  for (const [id, saved] of Object.entries(snap.players)) {
    const live = match.players[id];
    if (!live) continue; // ออกจากเกมไปแล้ว — ไม่ปลุกกลับ
    const keep = {
      socketId: live.socketId, connected: live.connected,
      sessionToken: live.sessionToken, ready: live.ready,
      pair: live.pair, // สไตรเกอร์ ยูเรก้า: ข้อมูลการเชื่อมต่อของคู่หู — ห้ามย้อน
    };
    if (typeof keepPerPlayer === "function") Object.assign(keep, keepPerPlayer(live) || {});
    for (const k of Object.keys(live)) delete live[k];
    Object.assign(live, structuredClone(saved), keep);
  }
  match.roundSkills = snap.roundSkills;
  match.shopItems = snap.shopItems;
  match.kaiOverhaulSlots = snap.kaiOverhaulSlots;
  ({
    cycleShift: match.cycleShift, dayForceUntil: match.dayForceUntil, transformCounter: match.transformCounter,
    yunaLongingUsed: match.yunaLongingUsed, yunaWindowEnd: match.yunaWindowEnd, yunaEffect: match.yunaEffect, yunaTargetId: match.yunaTargetId, yunaLongingPendingId: match.yunaLongingPendingId, yunaPity: match.yunaPity,
  } = snap.g);
  // ORT ที่บุกเข้ามาหลังจุดที่ย้อนไป (เทิร์น 60 ของโหมดปกติ) ต้องหายไปด้วย — ย้อนทุกอย่าง แล้วค่อยบุกใหม่ตามเวลา
  if (match.players[ORT_ID] && !snap.players[ORT_ID]) delete match.players[ORT_ID];
  match.lastAttack = null;
  return true;
}
function pushSnapshotHistory() {
  try {
    match.snapshotHistory.push(buildSnapshot());
    while (match.snapshotHistory.length > SNAPSHOT_HISTORY_MAX) match.snapshotHistory.shift();
  } catch { /* structuredClone พังด้วยเหตุใดก็ตาม = ข้ามเทิร์นนี้ไป ไม่ใช่เรื่องคอขาดบาดตาย */ }
}
function clearSnapshotHistory() { match.snapshotHistory = []; }
// สแนปช็อตของ "N เทิร์นก่อนหน้า" — ถ้ายังไม่ลึกพอก็คืนใบเก่าสุดที่มี (ต้นเกมยังย้อนไม่ครบ 5)
function snapshotBefore(turns) {
  if (!match.snapshotHistory.length) return null;
  const idx = Math.max(0, match.snapshotHistory.length - 1 - turns);
  return match.snapshotHistory[idx];
}

function captureTurnSnapshot() {
  try {
    match.turnSnapshot = {
      players: structuredClone(match.players),
      roundSkills: structuredClone(match.roundSkills),
      shopItems: structuredClone(match.shopItems),
      kaiOverhaulSlots: structuredClone(match.kaiOverhaulSlots),
      g: {
        cycleShift: match.cycleShift, dayForceUntil: match.dayForceUntil, transformCounter: match.transformCounter,
        yunaLongingUsed: match.yunaLongingUsed, yunaWindowEnd: match.yunaWindowEnd, yunaEffect: match.yunaEffect, yunaTargetId: match.yunaTargetId, yunaLongingPendingId: match.yunaLongingPendingId, yunaPity: match.yunaPity,
      },
    };
  } catch { match.turnSnapshot = null; }
}

function clearTurnSnapshot() { match.turnSnapshot = null; clearSnapshotHistory(); }

// skipId = ผู้เล่นที่ "ห้ามย้อน" (เท็นโนจิ โคทาโร่: กลับไปแก้ไข ย้อนทั้งสนามยกเว้นตัวเอง
//  ไม่งั้นแต้มสกิล/ไอเทม/เลือดที่จ่ายไปจะถูกคืนมาหมด = กดท่านี้ฟรีไม่รู้จบ)
function restoreTurnSnapshot(skipId, keepOncePerGame) {
  const snap = match.turnSnapshot;
  match.turnSnapshot = null;
  if (!snap) return false;
  for (const [id, saved] of Object.entries(snap.players)) {
    if (skipId && id === skipId) continue;
    const live = match.players[id];
    if (!live) continue; // ออกจากเกมไปแล้วระหว่างเทิร์น — ไม่ปลุกกลับ
    // ข้อมูลการเชื่อมต่อเป็นของ "ปัจจุบัน" เสมอ ห้ามย้อน ไม่งั้น reconnect/disconnect กลางเทิร์นจะพัง
    const keep = {
      socketId: live.socketId, connected: live.connected,
      sessionToken: live.sessionToken, ready: live.ready,
      pair: live.pair, // สไตรเกอร์ ยูเรก้า: ข้อมูลการเชื่อมต่อของคู่หู — ห้ามย้อน
    };
    for (const k of Object.keys(live)) delete live[k];
    Object.assign(live, structuredClone(saved), keep);
  }
  // ธง "ใช้ไปแล้ว" ของยูนะเป็นสิทธิ์ครั้งเดียวต่อเกม — การย้อนเทิร์นในเทิร์นเดียวกันต้องไม่คืนให้
  //  ไม่งั้นเกิดลูป: โคทาโร่ตาย -> Longing ชุบ -> ย้อนเทิร์น -> ธงถูกคืน -> ตาย -> Longing ชุบอีก วนไม่จบ
  //  (ท่าไม้ตายของชิโดย้อนไป 5 เทิร์นผ่าน applySnapshot คนละทาง จึงยังคืนได้ตามเดิม)
  const keepYuna = keepOncePerGame ? { yunaLongingUsed: match.yunaLongingUsed, yunaPity: match.yunaPity } : null;
  match.roundSkills = snap.roundSkills;
  match.shopItems = snap.shopItems;
  match.kaiOverhaulSlots = snap.kaiOverhaulSlots;
  ({
    cycleShift: match.cycleShift, dayForceUntil: match.dayForceUntil, transformCounter: match.transformCounter,
    yunaLongingUsed: match.yunaLongingUsed, yunaWindowEnd: match.yunaWindowEnd, yunaEffect: match.yunaEffect, yunaTargetId: match.yunaTargetId, yunaLongingPendingId: match.yunaLongingPendingId, yunaPity: match.yunaPity,
  } = snap.g);
  if (keepYuna) {
    match.yunaLongingUsed = keepYuna.yunaLongingUsed || match.yunaLongingUsed;
    match.yunaPity = keepYuna.yunaPity;
    match.yunaLongingPendingId = null; // คิวชุบที่ค้างอยู่เป็นของ "อนาคตที่ถูกลบทิ้ง" แล้ว
  }
  match.lastAttack = null;
  return true;
}

function beginOverloadForceDraw() {
  match.centralDeck = cardDeck.buildCentralDeck();
  match.roundWinnerId = null;
  match.roundTiedWin = false;
  match.doomTieAttack = false;
  match.anataMusicSeq = 0;

  for (const p of Object.values(match.players)) {
    if (!p.alive) {
      p.cards = [];
      p.locked = true;
      p.busted = false;
      p.overloadDrawReady = false;
      continue;
    }
    p.cards = [];
    p.cardBonus = 0;
    p.colorTrigger = { red: 0, blue: 0, green: 0, yellow: 0 };
    p.statusAmt.cardAtkBonus = 0;
    delete p.statuses.freecast; // ไพ่ Queen จากมือเดิมถูกย้อนทิ้งไปพร้อมไพ่
    combat.resetOverloadDrawCounter(p, false);
    const initial = cardDeck.drawInitialCard(p);
    if (initial) {
      p.cards.push(initial);
      cardDeck.onCardDrawn(p, initial);
    }
    p.overloadDrawReady = true;
    p.locked = (p.statuses.sleep || 0) > 0 || (p.statuses.stun || 0) > 0;
    p.busted = false;
    p.result = null;
    p.isWinner = false;
    p.isLoser = false;
  }

  match.lastLog.push("⚡ Overload Force เริ่มทำงาน — แจกไพ่ใหม่ในเทิร์นเดิม ปลดเพดาน 21 แต้ม!");
  match.gameState = "PLAYING";
  timers.startPhaseTimer(timers.cardPhaseSeconds(), summary.resolveRound);
  view.broadcastState();
  draw.checkAllLocked();
}

function triggerOverloadForce() {
  if (Seraph.active() || mercury.mercuryActive()) return; // Type Mercury: ไม่มี Overload Force ในโหมด Raid
  match.overloadForceCount++;
  match.overloadForceActive = true;
  match.overloadForceSeq++;
  // ย้อนทุกการกระทำในเทิร์นนี้ก่อนแจกไพ่ใหม่ — สกิลที่กดไป/แต้มสกิล/ไอเทม/เหรียญ ได้คืนทั้งหมด
  //  (บั๊กเดิม: สกิลที่ทำงาน "หลังเปิดไพ่" ถูกล้างทิ้งพร้อมมือไพ่ เจ้าของเสียแต้มกับสกิลไปฟรีๆ)
  if (restoreTurnSnapshot()) {
    match.lastLog.push("↩️ Overload Force ย้อนเวลาเทิร์นนี้กลับไปก่อนทุกการกระทำ — แต้มสกิล สกิลที่ใช้ และไอเทมถูกคืนทั้งหมด");
  }
  match.cutsceneQueue = [{
    info: {
      kind: "overloadForce",
      video: "/overload_force/overload_force_start.mp4",
      title: "OVERLOAD FORCE",
    },
    seconds: OVERLOAD_FORCE_CUTSCENE_SECONDS,
  }];
  match.lastLog.push(`⚡ คะแนนสูงสุดเสมอกัน — Overload Force ทำงาน (${Math.round(OVERLOAD_FORCE_CHANCE * 100)}%)!`);
  cutscene.runCutsceneQueue(beginOverloadForceDraw);
}
