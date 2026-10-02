// โหมด Purge — หนี ORT ในอุโมงค์ท่อ (กระดานทอยเต๋า · ทางแยก · ช่องกิจกรรม · จัดอันดับ)
//  1 "เทิร์นเต๋า" (match.purge.turn):
//   1. เฟสทอย (gameState PURGE_ROLL): ทุกคนได้เหรียญ +PURGE_TURN_GOLD · ใช้ไอเทมกระดานได้ก่อนทอย · กดทอยพร้อมกัน
//      เดินเองตามแต้ม ถึงทางแยกหยุดเลือกทาง · จบที่ช่องกิจกรรม = ผลของช่อง · หมดเวลา = ระบบทอย/เลือกทางหลักให้
//   2. ฉาก ORT (ทุกคนทำครบแล้ว): จบเทิร์น PURGE_ORT_TURN = ORT โผล่ช่อง 0 · เทิร์นต่อจากนั้น ORT ทอยเต๋า 1-6 (+ช่องล่อ) ให้ทุกคนเห็น
//      ใครอยู่ระยะ (prog) <= ORT = LOST DATA (โล่ผลึกกันได้ 1 ครั้ง)
//   3. คนที่อยู่ช่องเดียวกันปะทะกันทีละจุด — 1 จุด = จั่วไพ่ 2 รอบ (2 รอบของ engine) คนอื่นเป็นผู้ชม
//      ชนะมากกว่า = คนอื่นถอย 2 · เสมอ (รวมรอบที่ไพ่แตกพร้อมกัน = ไม่มีใครชนะรอบนั้น) = ถอยทั้งหมด 2
//  · เลือดหมด = ล้มลงถอย PURGE_KNOCKBACK เลือดเต็ม · ถึงประตูผนึก = ได้อันดับตามลำดับเข้า
//  · เกมจบเมื่อทุกคนเข้าเส้นชัยหรือโดน ORT กิน · ORT ถึงปลายท่อ = คนที่เหลือโดนกินหมด
//  ฉากฝั่ง client (client/src/purge/) — server พักเฟสตามเวลาที่คำนวณด้วยสูตรเดียวกัน (มีเทสต์เทียบ)
// export ก่อน require: ไฟล์ใน server/ require วนกันเอง — function declaration ถูก hoist จึงพร้อมใช้ตั้งแต่บรรทัดแรก
Object.assign(module.exports, {
  purgeActive, resetPurge, startPurge, beginRollPhase, roll, choose, useBoardItem, onRollTimeout, ortPhase,
  benched, combatants, onFightResult, tryKnockBack, purgeAdvance, purgeStateFor, ortSceneSeconds, introHoldSeconds,
  nextFightOrTurn, rollDie, board, progOf, itemTypes,
});

const {
  PURGE_FIGHT_INTRO_SECONDS, PURGE_FIGHT_KNOCKBACK, PURGE_INTRO_SECONDS, PURGE_KNOCKBACK, PURGE_ORT_TURN,
  PURGE_ROLL_SECONDS, PURGE_TURN_GOLD, TRANSITION_TIME,
} = require("../constants");
const { buildBoard } = require("./purgeBoard");
const match = require("../match");
const combat = require("../combat");
const cardDeck = require("../deck");
const draw = require("../phases/draw");
const shop = require("../shop");
const timers = require("../timers");
const view = require("../view");

const BOARD = buildBoard();
function board() { return BOARD; }
const ITEM_TYPES = ["dice2", "golden", "boots", "trap", "push", "shield"];
function itemTypes() { return ITEM_TYPES; }
const MAX_ITEMS = 3;
// PURGE_FIXED_DICE (env) = ทุกลูกออกแต้มเดียวกัน ใช้ทดสอบ
const FIXED_DICE = Math.max(0, Math.min(6, Number(process.env.PURGE_FIXED_DICE) || 0));
function rollDie() { return FIXED_DICE || 1 + Math.floor(Math.random() * 6); }

function purgeActive() { return match.gameMode === "purge"; }
function fresh() {
  return {
    pl: {}, ort: null, ortBonus: 0, lost: [], finished: [], turn: 0, scene: null, seq: 0, walkSeq: 0,
    walks: {}, rolls: {}, traps: {}, fights: [], fightIdx: -1, fight: null, result: null, winnerId: null, itemSeq: 0,
    history: [], logSeq: 0, // บันทึกเหตุการณ์ทั้งเกม (แผงบันทึกด้านขวาของ client)
  };
}
function state() { return match.purge || (match.purge = fresh()); }
function resetPurge() { match.purge = fresh(); }

// ---------- เวลาของฉาก ORT — ต้องตรงกับ client/src/purge/purgeScene.js (มีเทสต์เทียบ) ----------
const T_ORT_CAM = 1.6, T_ORT_DICE = 1.8, T_ORT_ARRIVE = 2.4, T_ORT_STEP = 0.32, T_AFTER_ORT = 0.4, T_BOOM = 1.9, T_BACK = 1.4, T_FIGHT_MARK = 1.2, T_END = 0.3;
function ortSceneSeconds(scene) {
  let t = T_ORT_CAM;
  if (scene.ortFrom == null) t += T_ORT_ARRIVE;
  else t += T_ORT_DICE + (scene.ortTo - scene.ortFrom) * T_ORT_STEP + T_AFTER_ORT;
  if ((scene.caught || []).length) t += T_BOOM;
  t += T_BACK;
  if ((scene.fights || []).length) t += T_FIGHT_MARK;
  return t + T_END;
}
// เวลาเดินของ client: 0.3 วิ/ช่อง (ไว้รอให้ทุกคนเดินจบก่อนตัดเข้าฉาก ORT)
const WALK_STEP = 0.3;
function introHoldSeconds() { return PURGE_INTRO_SECONDS; }

// ---------- ผู้เล่นบนกระดาน ----------
function humans() { return Object.values(match.players); }
function plOf(p) { return state().pl[p.id]; }
function nodeOf(p) { const ps = plOf(p); return ps ? BOARD.nodes[ps.node] : BOARD.nodes[BOARD.start]; }
function progOf(p) { return nodeOf(p).prog; }
function activePlayers() { return humans().filter((p) => p.alive && plOf(p) && !plOf(p).finished); }
function newPl() {
  return { node: BOARD.start, trail: [BOARD.start], rolled: false, done: false, pending: 0, choices: null, stop: 0, items: [], mod: null, golden: 0, extra: false, shield: false, finished: false, rank: null, bonusNext: 0, walked: 0 };
}

// เริ่มแมตช์: ทุกคนอยู่ช่องเริ่ม + ฉากเปิด — ผู้เรียกพักเฟส CUTSCENE เองแล้วเรียก beginRollPhase() ตอนจบ
function startPurge() {
  resetPurge();
  const s = state();
  for (const p of humans()) s.pl[p.id] = newPl();
  s.scene = { seq: ++s.seq, kind: "intro", active: true };
}

function hold(seconds, then, gameState = "CUTSCENE") {
  match.cutsceneInfo = null;
  match.gameState = gameState;
  timers.startPhaseTimer(Math.max(1, Math.ceil(seconds)), then);
  view.broadcastState();
}
function log(msg) {
  match.lastLog.push(msg);
  const s = state();
  s.history.push({ id: ++s.logSeq, turn: s.turn, msg });
  if (s.history.length > 80) s.history.shift();
}

// ---------- จบเกม ----------
function finishGame() {
  const s = state();
  s.result = s.finished.length ? "ranked" : "allLost";
  s.winnerId = s.finished[0] || null;
  s.fight = null;
  timers.clearPhaseTimer();
  match.winningTeamId = null;
  match.gameState = "GAMEOVER";
  match.timeLeft = 0;
  view.broadcastState();
}
// คืน true = จบแล้ว
function maybeEnd() {
  if (activePlayers().length) return false;
  finishGame();
  return true;
}

// ---------- การเดิน ----------
function recordWalk(p, path, kind) {
  const s = state();
  if (!path.length) return;
  const list = s.walks[p.id] || (s.walks[p.id] = []);
  list.push({ seq: ++s.walkSeq, path: [...path], kind });
  plOf(p).walked += path.length;
}
// เดินหน้า n ช่องตามทางที่เลือก (ทางแยก = หยุดรอเลือก ถ้า autoMain = ไปทางหลักเลย) — คืน true ถ้าเดินจบ
function walkForward(p, n, kind = "move", autoMain = false) {
  const ps = plOf(p);
  const path = [];
  let left = n;
  while (left > 0) {
    const node = BOARD.nodes[ps.node];
    if (!node.next.length) break; // ประตูผนึก
    if (node.next.length > 1 && !autoMain) {
      recordWalk(p, path, kind);
      ps.pending = left; ps.choices = [...node.next]; ps.pendingKind = kind;
      return false;
    }
    ps.node = node.next[0];
    ps.trail.push(ps.node);
    path.push(ps.node);
    left--;
  }
  recordWalk(p, path, kind);
  ps.pending = 0; ps.choices = null;
  return true;
}
function walkBack(p, n, kind = "back") {
  const ps = plOf(p);
  const path = [];
  for (let i = 0; i < n && ps.trail.length > 1; i++) {
    ps.trail.pop();
    ps.node = ps.trail[ps.trail.length - 1];
    path.push(ps.node);
  }
  recordWalk(p, path, kind);
}
// วาร์ป/สลับที่: กระโดดไปช่องเป้าหมาย แล้วสร้าง trail ใหม่จากจุดเริ่มถึงช่องนั้น (ไว้ถอยหลังต่อได้)
function teleport(p, nodeId, kind) {
  const ps = plOf(p);
  ps.node = nodeId;
  ps.trail = trailTo(nodeId);
  recordWalk(p, [nodeId], kind);
}
function trailTo(nodeId) {
  const prev = { [BOARD.start]: null };
  const q = [BOARD.start];
  while (q.length) {
    const id = q.shift();
    if (id === nodeId) break;
    for (const nx of BOARD.nodes[id].next) if (!(nx in prev)) { prev[nx] = id; q.push(nx); }
  }
  const out = [];
  for (let id = nodeId; id != null; id = prev[id]) out.unshift(id);
  return out.length ? out : [BOARD.start, nodeId];
}

// ---------- ผลของช่องกิจกรรม ----------
function giveItem(p) {
  const ps = plOf(p);
  if (ps.items.length >= MAX_ITEMS) { log(`🎁 ${p.name} กระเป๋าเต็ม — ไอเทมหล่นหาย`); return; }
  const type = ITEM_TYPES[Math.floor(Math.random() * ITEM_TYPES.length)];
  ps.items.push({ uid: `i${++state().itemSeq}`, type });
  log(`🎁 ${p.name} ได้ไอเทมกระดาน`);
}
function landOn(p) {
  const s = state();
  const ps = plOf(p);
  const node = BOARD.nodes[ps.node];
  if (node.id === BOARD.gate) { reachGate(p); return; }
  // กับดักผลึก (ไอเทม): คนอื่นที่หยุดตรงนี้ถอย 3 แล้วกับดักหายไป
  const trap = s.traps[node.id];
  if (trap && trap !== p.id) {
    delete s.traps[node.id];
    log(`💠 ${p.name} เหยียบกับดักผลึก ถอยหลัง 3 ช่อง`);
    walkBack(p, 3, "back");
    return;
  }
  switch (node.tile) {
    case "gold": shop.addGold(p, 3); log(`💰 ${p.name} เก็บเหรียญ +3`); break;
    case "back": log(`↩️ ${p.name} ลื่นไถล ถอยหลัง 3 ช่อง`); walkBack(p, 3, "back"); break;
    case "stop": ps.stop = 2; log(`⛓️ ${p.name} ติดหล่ม หยุดอยู่กับที่ 2 เทิร์น`); break;
    case "heal": combat.healHp(p, 2); log(`💚 ${p.name} ฟื้นเลือด +2`); break;
    case "skill": combat.addSkill(p, 2, "item"); log(`✨ ${p.name} แต้มสกิล +2`); break;
    case "item": giveItem(p); break;
    case "warp": {
      let id = ps.node;
      for (let i = 0; i < 6 && BOARD.nodes[id].next.length; i++) id = BOARD.nodes[id].next[0];
      log(`🌀 ${p.name} วาร์ปไปข้างหน้า`);
      teleport(p, id, "warp");
      if (id === BOARD.gate) reachGate(p);
      break;
    }
    case "reroll":
      if (!ps.extra) { ps.extra = true; ps.rolled = false; log(`🎲 ${p.name} ได้ทอยอีกครั้ง!`); }
      break;
    case "lure": s.ortBonus += 2; log(`🩸 ${p.name} เหยียบช่องล่อ — ORT จะเดินเพิ่ม 2 ช่องเทิร์นนี้`); break;
    case "region": regionTile(p, node.region); break;
    default: break;
  }
}
// ช่องประจำภูมิภาค
function regionTile(p, region) {
  const ps = plOf(p);
  if (region === 0) { ps.bonusNext += 2; log(`🗿 ${p.name} ศิลาจารึก — ทอยเทิร์นหน้า +2`); return; }
  if (region === 1) {
    log(`🌊 ${p.name} กระแสน้ำพาไปข้างหน้า 3 ช่อง`);
    walkForward(p, 3, "flow", true);
    if (ps.node === BOARD.gate) reachGate(p);
    return;
  }
  if (region === 2) {
    const others = activePlayers().filter((o) => o.id !== p.id);
    if (!others.length) return;
    const o = others[Math.floor(Math.random() * others.length)];
    const a = ps.node, b = plOf(o).node;
    log(`🌑 ${p.name} สลับที่กับ ${o.name} ในความมืด`);
    teleport(p, b, "swap"); teleport(o, a, "swap");
    return;
  }
  if (region === 3) {
    log(`🪨 ${p.name} ทำหินถล่ม — คนที่อยู่ใกล้ถอยหลัง 1 ช่อง`);
    for (const o of activePlayers()) if (o.id !== p.id && Math.abs(progOf(o) - progOf(p)) <= 3) walkBack(o, 1, "back");
    return;
  }
  if (region === 4) { shop.addGold(p, 6); log(`👑 ${p.name} แก่นทองคำ — เหรียญ +6`); }
}
function reachGate(p) {
  const s = state();
  const ps = plOf(p);
  if (ps.finished) return;
  ps.finished = true; ps.done = true;
  s.finished.push(p.id);
  ps.rank = s.finished.length;
  log(`🏁 ${p.name} ถึงประตูผนึก — อันดับ ${ps.rank}!`);
}

// ---------- เฟสทอย ----------
function beginRollPhase() {
  const s = state();
  s.fight = null; s.fights = []; s.fightIdx = -1;
  if (maybeEnd()) return;
  s.turn++;
  match.roundNumber = s.turn; // กลางวัน/กลางคืน ร้านค้า ฯลฯ เดินตามเทิร์นเต๋า
  match.lastLog = [];
  s.walks = {}; s.rolls = {};
  for (const p of activePlayers()) {
    const ps = plOf(p);
    Object.assign(ps, { rolled: false, done: false, pending: 0, choices: null, mod: null, golden: 0, extra: false, walked: 0 });
    shop.addGold(p, PURGE_TURN_GOLD);
    if (ps.stop > 0) { ps.stop--; ps.rolled = true; ps.done = true; log(`⛓️ ${p.name} ยังติดอยู่ (เหลือ ${ps.stop} เทิร์น)`); }
  }
  s.scene = { seq: ++s.seq, kind: "roll", active: true, turn: s.turn };
  hold(PURGE_ROLL_SECONDS, onRollTimeout, "PURGE_ROLL");
  maybeSettle();
}
function canAct(p) {
  const ps = p && plOf(p);
  return !!(purgeActive() && match.gameState === "PURGE_ROLL" && !state().settling && ps && p.alive && !ps.finished);
}
function roll(id) {
  const p = match.players[id];
  if (!canAct(p)) return false;
  const ps = plOf(p);
  if (ps.rolled || ps.done || ps.choices) return false;
  let dice = [rollDie()];
  if (ps.mod === "dice2") dice = [rollDie(), rollDie()];
  if (ps.mod === "golden" && ps.golden >= 1 && ps.golden <= 6) dice = [ps.golden];
  let total = dice.reduce((a, b) => a + b, 0);
  if (ps.mod === "boots") total += 3;
  total += ps.bonusNext; ps.bonusNext = 0;
  ps.rolled = true;
  state().rolls[p.id] = { dice, total, mod: ps.mod, seq: ++state().walkSeq };
  ps.mod = null; ps.golden = 0;
  if (walkForward(p, total)) afterMove(p);
  view.broadcastState();
  maybeSettle();
  return true;
}
function choose(id, nextId) {
  const p = match.players[id];
  if (!canAct(p)) return false;
  const ps = plOf(p);
  if (!ps.choices || !ps.choices.includes(nextId)) return false;
  const left = ps.pending, kind = ps.pendingKind || "move";
  ps.node = nextId; ps.trail.push(nextId);
  ps.choices = null; ps.pending = 0;
  recordWalk(p, [nextId], kind);
  if (walkForward(p, left - 1, kind)) afterMove(p);
  view.broadcastState();
  maybeSettle();
  return true;
}
function afterMove(p) {
  const ps = plOf(p);
  landOn(p);
  if (!ps.rolled && !ps.finished) return; // ทอยอีกครั้ง
  ps.done = true;
}
// หมดเวลา: ทอย/เลือกทางหลักให้ทุกคนที่ยังไม่ทำ
function onRollTimeout() {
  for (let guard = 0; guard < 12; guard++) {
    let acted = false;
    for (const p of activePlayers()) {
      const ps = plOf(p);
      if (ps.done) continue;
      if (ps.choices) { choose(p.id, ps.choices[0]); acted = true; } else if (!ps.rolled) { roll(p.id); acted = true; }
    }
    if (!acted) break;
  }
  maybeSettle(true);
}
// ทุกคนทำครบ → รอให้ client เดินจบ แล้วเข้าฉาก ORT
function maybeSettle(force = false) {
  const s = state();
  if (match.gameState !== "PURGE_ROLL" || s.settling) return;
  const act = activePlayers();
  if (act.some((p) => !plOf(p).done) && !force) return;
  for (const p of act) plOf(p).done = true;
  const longest = Math.max(0, ...humans().map((p) => (plOf(p) ? plOf(p).walked : 0)));
  s.scene = { ...s.scene, settling: true }; // ทุกคนทอยครบ — รอหมากเดินจบ (ฉากท่อยังเปิดอยู่)
  s.settling = true;
  hold(1 + longest * WALK_STEP + 0.6, ortPhase, "PURGE_ROLL");
}

// ---------- ไอเทมกระดาน (ใช้ก่อนทอย) ----------
function useBoardItem(id, { uid, value, targetId } = {}) {
  const p = match.players[id];
  if (!canAct(p)) return false;
  const ps = plOf(p);
  if (ps.rolled || ps.done) return false;
  const idx = ps.items.findIndex((it) => it.uid === uid);
  if (idx < 0) return false;
  const it = ps.items[idx];
  const s = state();
  if (it.type === "dice2" || it.type === "boots") ps.mod = it.type;
  else if (it.type === "golden") {
    const v = Math.floor(Number(value));
    if (!(v >= 1 && v <= 6)) return false;
    ps.mod = "golden"; ps.golden = v;
  } else if (it.type === "trap") {
    if (ps.node === BOARD.start || ps.node === BOARD.gate) return false;
    s.traps[ps.node] = p.id;
    log(`💠 ${p.name} วางกับดักผลึก`);
  } else if (it.type === "push") {
    const t = match.players[targetId];
    if (!t || t.id === p.id || !t.alive || !plOf(t) || plOf(t).finished) return false;
    const d = progOf(t) - progOf(p);
    if (d < 0 || d > 6) return false;
    walkBack(t, 2, "back");
    log(`👐 ${p.name} ผลัก ${t.name} ถอยหลัง 2 ช่อง`);
  } else if (it.type === "shield") ps.shield = true;
  else return false;
  ps.items.splice(idx, 1);
  view.broadcastState();
  return true;
}

// ---------- ฉาก ORT ----------
function ortPhase() {
  const s = state();
  s.settling = false;
  match.lastLog = [];
  const ortFrom = s.ort;
  let ortTo = ortFrom, ortRoll = null, ortDie = null;
  if (s.turn === PURGE_ORT_TURN && ortFrom == null) { ortTo = 0; log("🕷️ ORT ปรากฏตัวที่ปากท่อ!"); }
  else if (ortFrom != null) {
    ortDie = rollDie();
    ortRoll = ortDie + s.ortBonus; // เต๋าเท่าผู้เล่น — ระยะนำแกว่งตามดวง (เต๋า +1 ไล่ทันทุกคนก่อนครึ่งท่อเสมอ)
    s.ortBonus = 0;
    ortTo = Math.min(BOARD.main, ortFrom + ortRoll);
    log(`🎲 ORT ทอยได้ ${ortRoll} — เดินถึงช่อง ${ortTo}`);
  }
  s.ort = ortTo;
  const caught = [], shielded = [];
  if (ortFrom != null && ortTo != null) {
    for (const p of activePlayers()) {
      if (progOf(p) > ortTo && ortTo < BOARD.main) continue;
      const ps = plOf(p);
      if (ps.shield) { ps.shield = false; shielded.push(p.id); log(`🛡️ ${p.name} โล่ผลึกรับการกลืนแทน!`); continue; }
      lose(p); caught.push(p.id);
    }
  }
  for (const id of caught) log(`💠 ${match.players[id].name} ถูก ORT ไล่ทัน — LOST DATA`);
  // จุดปะทะ: ผู้เล่นที่ยังเล่นอยู่ช่องเดียวกัน (ไม่นับช่องเริ่ม) เรียงจากท้ายท่อ
  const byNode = {};
  for (const p of activePlayers()) {
    const nid = plOf(p).node;
    if (nid === BOARD.start) continue;
    (byNode[nid] = byNode[nid] || []).push(p.id);
  }
  s.fights = Object.entries(byNode).filter(([, ids]) => ids.length >= 2)
    .map(([node, ids]) => ({ node, ids, prog: BOARD.nodes[node].prog })).sort((a, b) => a.prog - b.prog);
  s.fightIdx = -1;
  if (ortTo === ortFrom && !caught.length && !shielded.length) {
    nextFightOrTurn(); // ORT ยังไม่มา — ไม่มีฉาก ORT
    return;
  }
  const scene = { seq: ++s.seq, kind: "ort", active: true, turn: s.turn, ortFrom, ortTo, roll: ortRoll, die: ortDie, caught, shielded, fights: s.fights.map((f) => ({ node: f.node })) };
  s.scene = scene;
  hold(ortSceneSeconds(scene) + 0.5, () => { scene.active = false; nextFightOrTurn(); });
}
function lose(p) {
  p.hp = 0; p.alive = false; p.result = "dead"; p.locked = true;
  p.purgeLost = true;
  const s = state();
  if (!s.lost.includes(p.id)) s.lost.push(p.id);
}

// ---------- จุดปะทะ (2 รอบ) ----------
function nextFightOrTurn() {
  const s = state();
  if (maybeEnd()) return;
  for (let i = s.fightIdx + 1; i < s.fights.length; i++) {
    const f = s.fights[i];
    const ids = f.ids.filter((id) => { const p = match.players[id]; return p && p.alive && plOf(p) && !plOf(p).finished && plOf(p).node === f.node; });
    if (ids.length >= 2) { s.fights[i] = { ...f, ids }; startFight(i); return; }
  }
  s.fight = null;
  beginRollPhase();
}
function startFight(i) {
  const s = state();
  const f = s.fights[i];
  s.fightIdx = i;
  s.fight = { node: f.node, prog: f.prog, ids: [...f.ids], round: 1, wins: {}, results: [] };
  const scene = { seq: ++s.seq, kind: "fight", active: true, node: f.node, ids: [...f.ids], idx: i, count: s.fights.length };
  s.scene = scene;
  match.lastLog = [`⚔️ ปะทะ: ` + f.ids.map((id) => match.players[id].name).join(" vs ")];
  hold(PURGE_FIGHT_INTRO_SECONDS, () => { scene.active = false; startFightRound(); });
}
function startFightRound() {
  const s = state();
  match.roundNumber = Math.max(0, s.turn - 1); // เลขรอบของ engine = เทิร์นเต๋า (dealRound บวก 1)
  draw.dealRound();
}
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
// resolveRound ตัดสินผู้ชนะรอบแล้ว (เสมอ = ไม่นับ)
function onFightResult(w) {
  const s = state();
  if (!purgeActive() || !s.fight || !w) return;
  s.fight.roundWinner = match.roundTiedWin ? null : w.id;
}
// ท้าย endTurn() ของรอบการ์ด: รอบ 1 → รอบ 2 · รอบ 2 → ตัดสินจุดนี้ → จุดถัดไป / เทิร์นใหม่ / จบเกม
//  คืน true เสมอในโหมดนี้ (จัดการเฟสถัดไปเองทั้งหมด)
function purgeAdvance() {
  const s = state();
  const f = s.fight;
  if (!f) { nextFightOrTurn(); return true; }
  const fighters = combatants();
  const bothBust = fighters.length >= 2 && fighters.every((p) => cardDeck.bustedOf(p));
  const w = !bothBust && f.roundWinner && match.players[f.roundWinner];
  if (w) f.wins[w.id] = (f.wins[w.id] || 0) + 1;
  f.results.push(w ? w.id : null);
  f.roundWinner = null;
  if (f.round < 2 && fighters.length >= 2) {
    f.round++;
    match.lastLog.push("⚔️ รอบที่ 2");
    hold(TRANSITION_TIME, startFightRound, "TRANSITION");
    return true;
  }
  // ตัดสิน: ชนะมากที่สุดคนเดียว = คนอื่นถอย 2 · ไม่งั้นถอยหมด 2
  const alive = fighters.filter((p) => p.alive);
  const best = Math.max(0, ...alive.map((p) => f.wins[p.id] || 0));
  const top = alive.filter((p) => (f.wins[p.id] || 0) === best);
  if (best > 0 && top.length === 1) {
    for (const p of alive) if (p.id !== top[0].id) walkBack(p, PURGE_FIGHT_KNOCKBACK, "back");
    match.lastLog.push(`🏆 ${top[0].name} ชนะการปะทะ — คนอื่นถอยหลัง ${PURGE_FIGHT_KNOCKBACK} ช่อง`);
  } else {
    for (const p of alive) walkBack(p, PURGE_FIGHT_KNOCKBACK, "back");
    match.lastLog.push(`🤝 การปะทะเสมอ — ถอยหลังทั้งหมด ${PURGE_FIGHT_KNOCKBACK} ช่อง`);
  }
  s.fight = null;
  nextFightOrTurn();
  return true;
}

// เลือดหมด = ล้มลง: ถอยหลังแล้วฟื้นเต็ม แทนการตกรอบ — เรียกจาก instantDeath() ก่อนบรรทัดตั้ง alive=false
function tryKnockBack(p) {
  if (!purgeActive() || !p || !p.alive || !plOf(p)) return false;
  walkBack(p, PURGE_KNOCKBACK, "back");
  p.hp = combat.maxHpOf(p);
  p.armor = combat.maxArmorOf(p);
  p.tempHp = 0;
  p.result = null;
  match.lastLog.push(`💫 ${p.name} ล้มลง! ถอยหลัง ${PURGE_KNOCKBACK} ช่อง — ลุกขึ้นพร้อมเลือดเต็ม`);
  return true;
}

// ---------- ส่งให้ client ----------
let boardPayload = null;
function boardForClient() {
  if (!boardPayload) {
    boardPayload = {
      main: BOARD.main, regionLen: BOARD.regionLen, gate: BOARD.gate, start: BOARD.start,
      nodes: Object.values(BOARD.nodes).map((n) => ({ id: n.id, prog: Math.round(n.prog * 100) / 100, lane: Math.round(n.lane * 1000) / 1000, next: n.next, tile: n.tile, region: n.region, kind: n.kind })),
    };
  }
  return boardPayload;
}
function purgeStateFor(viewerId) {
  if (!purgeActive()) return null;
  const s = state();
  const pl = {};
  for (const [id, ps] of Object.entries(s.pl)) {
    pl[id] = {
      node: ps.node, rolled: ps.rolled, done: ps.done, choices: ps.choices, pending: ps.pending, stop: ps.stop,
      finished: ps.finished, rank: ps.rank, shield: ps.shield, mod: ps.mod, golden: ps.golden,
      items: id === viewerId ? ps.items : ps.items.map(() => ({})),
    };
  }
  const traps = {};
  for (const [node, owner] of Object.entries(s.traps)) if (owner === viewerId) traps[node] = owner;
  return {
    board: boardForClient(),
    pl,
    ort: s.ort,
    ortTurn: PURGE_ORT_TURN,
    turn: s.turn,
    lost: [...s.lost],
    finished: [...s.finished],
    walks: s.walks,
    rolls: s.rolls,
    traps,
    fight: s.fight ? { node: s.fight.node, ids: [...s.fight.ids], round: s.fight.round, wins: { ...s.fight.wins } } : null,
    scene: s.scene ? { ...s.scene } : null,
    result: s.result,
    winnerId: s.winnerId,
    log: s.history.slice(-50),
  };
}
