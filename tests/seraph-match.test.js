// SE.RA.PH Moon Cell ผ่าน server จริง (lobby/view/combat) — กันบั๊กที่เทสต์ seraph.js แบบ mock engine จับไม่ได้
//  ตัวจับเวลาของเฟสถูกแทนด้วยตัวเก็บ callback (ไม่ให้ setTimeout จริงค้าง process)
const test = require('node:test');
const assert = require('node:assert/strict');
require('../server');
const match = require('../server/match');
const timers = require('../server/timers');
const { engine } = require('../server/engine');
const lobby = require('../server/lobby');
const view = require('../server/view');
const combat = require('../server/combat');
const socketLayer = require('../server/socket');
const Seraph = require('../seraph');
const { CHAR_BY_ID } = require('../characters');

let pendingTimer = null; // callback ของตัวจับเวลาล่าสุด — runTimer() เรียกแทนการรอเวลาจริง
timers.startPhaseTimer = (sec, cb) => { match.timeLeft = sec; pendingTimer = cb || null; };
function runTimer() { const cb = pendingTimer; pendingTimer = null; if (cb) cb(); }
timers.clearPhaseTimer = () => {};
engine.startPhaseTimer = timers.startPhaseTimer;
engine.clearPhaseTimer = timers.clearPhaseTimer;

function seat(chars) {
  for (const id of Object.keys(match.players)) delete match.players[id];
  chars.forEach((cid, i) => {
    const id = `P${i + 1}`;
    match.players[id] = socketLayer.newPlayerRecord({
      playerId: id, sessionToken: `t${id}`, socketId: `s${id}`, name: `ผู้เล่น${i + 1}`, color: null, pos: i + 1, ch: CHAR_BY_ID[cid],
    });
  });
}
function startSeraph(chars) {
  seat(chars);
  match.gameMode = 'seraph';
  lobby.startMatch();
  // ฉากเปิดแมตช์ (เปิดตัวผู้เล่น + บินไปดวงจันทร์) — server พักเกมไว้ในเฟส CUTSCENE ที่ไม่มีคลิป
  assert.equal(match.gameState, 'CUTSCENE');
  assert.equal(Seraph.stateFor(engine, 'P1').intro, true);
  runTimer();
  assert.equal(Seraph.stateFor(engine, 'P1').intro, false);
}
const other = (st, id) => st.players.find((p) => p.id === id);

test.afterEach(() => {
  lobby.backToLobby();
  match.gameMode = 'ffa';
  for (const id of Object.keys(match.players)) delete match.players[id];
});

test('กลับห้องรอหลัง Moon Cell: ปิดโหมด และแมตช์ถัดไปเริ่มด้วยเลือด/เกราะของตัวละคร ไม่ใช่ 3/2 ของ Moon Cell', () => {
  startSeraph(['kotone', 'satoru']);
  assert.ok(Seraph.active());
  match.gameState = 'GAMEOVER';
  lobby.backToLobby();
  assert.equal(Seraph.active(), false);
  assert.equal(view.buildStateFor('P1').seraph, null);
  match.gameMode = 'ffa';
  lobby.startMatch();
  for (const p of Object.values(match.players)) {
    assert.equal(p.hp, combat.maxHpOf(p));
    assert.equal(p.armor, combat.maxArmorOf(p));
    assert.ok(p.hp > 3, `${p.characterId} ต้องได้เลือดของตัวละคร (ได้ ${p.hp})`);
  }
});

test('ไม่เล่นวีดีโอเปิดตัวตัวละครใน Moon Cell (คลิปบอกว่าใครอยู่ในแมตช์)', () => {
  startSeraph(['conner', 'daisuke', 'kotone']);
  assert.deepEqual(match.cutsceneQueue, []);
  assert.equal(match.cutsceneInfo, null);
  assert.equal(match.gameState, 'SERAPH_PLACE');
});

test('ผู้เล่นที่ยังถูกซ่อน: ไม่ส่งฟิลด์เฉพาะตัวละคร / avatar / สถานะ ให้ผู้ชม', () => {
  startSeraph(['kotone', 'cayenne', 'echo_queen', 'conner']);
  match.players.P2.statuses.resist = 2;
  const st = view.buildStateFor('P1');
  for (const id of ['P2', 'P3', 'P4']) {
    const p = other(st, id);
    assert.equal(p.scHidden, true);
    assert.equal(p.avatar, null);
    assert.deepEqual(p.statuses, {});
    assert.equal(p.character.id, null);
    for (const k of ['piggy', 'kotoneForm', 'cayenne', 'echoQueen', 'connorStress', 'skillLocks', 'kim', 'tohno']) {
      assert.equal(p[k], undefined, `${id}.${k} ต้องไม่ถูกส่ง`);
    }
    assert.equal(typeof p.hp, 'number');
  }
  // ตัวเองเห็นของตัวเองครบตามปกติ
  const me = other(st, 'P1');
  assert.equal(me.scHidden, false);
  assert.equal(typeof me.piggy, 'number');
});

test('log ที่มีชื่อสกิลของคนที่ยังถูกซ่อน ไม่ถูกส่งให้ผู้ชมคนนั้น', () => {
  startSeraph(['kotone', 'cayenne']);
  const skill = CHAR_BY_ID.cayenne.basic.name;
  match.lastLog = ['บรรทัดกลาง ๆ', `ผู้เล่น2 ใช้ ${skill}`];
  match.gameState = 'SUMMARY';
  assert.deepEqual(view.buildStateFor('P1').log, ['บรรทัดกลาง ๆ']);
  assert.equal(view.buildStateFor('P2').log.length, 2); // เจ้าของเห็นของตัวเอง
});

test('วันดวล: คนดูกับคนตกรอบไม่อยู่บนสนาม (สกิลหมู่/สุ่มเป้า/บัฟไม่โดน)', () => {
  startSeraph(['kotone', 'satoru', 'cayenne', 'conner']);
  match.players.P3.scSpectator = true;
  match.players.P4.scEliminated = true;
  const ids = combat.alivePlayers().map((p) => p.id).sort();
  assert.deepEqual(ids, ['P1', 'P2']);
});

test('จบรอบ: ล้างสถานะ/ของจากวันดวล แต่คงเงิน ไอเทม และค่าของโหมด (§8)', () => {
  startSeraph(['echo_queen', 'kotone']);
  const p = match.players.P1;
  p.statuses.hbleed = 3;
  p.statusAmt.atk = 2;
  p.echoQ.ultFrom = 5; p.echoQ.ultUntil = 9;
  p.gold = 17;
  p.inventory = [{ uid: 1, type: 'armor' }];
  p.scSkillLevel = 4;
  p.scCapSkill = 6;
  p.scCapHp = 5;
  p.scCapArmor = 4;
  p.armor = 1;
  p.scMatrix = 2;
  p.scStat.duelWins = 1;
  combat.resetCycleCombat(p);
  assert.deepEqual(p.statuses, {});
  assert.deepEqual(p.statusAmt, {});
  assert.equal(p.echoQ.ultUntil, 0);
  assert.equal(p.gold, 17);
  assert.deepEqual(p.inventory, [{ uid: 1, type: 'armor' }]);
  assert.equal(p.scSkillLevel, 4);
  assert.equal(p.scCapSkill, 6);
  assert.equal(p.scMatrix, 2);
  assert.equal(p.scStat.duelWins, 1);
  assert.equal(p.hp, 5); // เต็มตามความจุจากโบสถ์ ไม่ใช่ค่าตั้งต้น
  assert.equal(p.armor, 4);
});

test('ยูนะไม่ทำงานใน Moon Cell: คนแรกที่ตายในเทิร์น 1-10 ไม่ถูก Longing ชุบ (รวมแฝดฮิซากาว่า)', () => {
  startSeraph(['kotone', 'satoru', 'hisakawa_sister']);
  match.roundNumber = 7; // วันดวลแรกของแมตช์
  const p = match.players.P1;
  combat.instantDeath(p, true);
  assert.equal(p.alive, false);
  assert.equal(match.yunaLongingPendingId, null);
  assert.equal(match.yunaLongingUsed, false);
  assert.equal(combat.tryYunaLongingForTwin(match.players.P3), false);
});

test('วันที่ 1-6: ไม่ได้แต้มสกิลทุกช่องทาง และใช้ไอเทมไม่ได้ (§5)', () => {
  startSeraph(['kotone', 'satoru']);
  assert.ok(Seraph.noCombat());
  const p = match.players.P1;
  combat.addSkill(p, 3, 'item');
  assert.equal(p.skillPoints, 0);
  p.inventory = [{ uid: 9, type: 'armor', value: 1 }];
  match.gameState = 'PLAYING';
  engine.useInventoryItem(p.id, 9, {});
  assert.equal(p.inventory.length, 1);
});

test('วันดวล: ตายพร้อมกันทั้งคู่ = ตกรอบทั้งคู่ ไม่มีผู้ชนะ', () => {
  startSeraph(['kotone', 'satoru', 'cayenne']);
  for (let d = 1; d < 7; d++) { const { next } = Seraph.advanceDay(engine); if (next === 'duelDay') Seraph.beginDuelDay(engine); }
  assert.ok(Seraph.isDuelDay());
  const pair = Seraph.stateFor(engine, 'P1').duelPair;
  for (const id of [pair.a, pair.b]) match.players[id].alive = false;
  assert.equal(Seraph.checkDuelProgress(engine), 'cycleEnd');
  assert.ok(match.players[pair.a].scEliminated && match.players[pair.b].scEliminated);
});

test('คนที่ตกรอบแล้วไม่ฟื้นกลับมา แม้ระบบสำรองของคอนเนอร์จะครบกำหนด', () => {
  startSeraph(['conner', 'satoru', 'kotone']);
  const c = match.players.P1;
  c.alive = false;
  c.scEliminated = true;
  c.connorReviveRound = 1;
  match.roundNumber = 5;
  require('../server/phases/draw').dealRound();
  assert.equal(c.alive, false);
  assert.deepEqual(c.cards, []);
});

test('Moon Cell: ยูนะทางเดียวที่เหลือคือท่าไม้ตายของเอจิ (เปิดสนาม Break Beat Bark!) — Longing ปิด', () => {
  startSeraph(['eiji', 'kotone']);
  match.roundNumber = 7;
  const CHAR_HOOKS = require('../characters/index');
  CHAR_HOOKS.eiji.applyUlt(engine, match.players.P1);
  assert.equal(match.yunaEffect, 'beatbark');
  combat.instantDeath(match.players.P2, true);
  assert.equal(match.yunaLongingPendingId, null); // ตายในเทิร์น 1-10 ก็ไม่มี Longing มาชุบ
});

test('วันที่ 1-6 ไม่มีจั่วไพ่: เข้าแมพตั้งแต่ต้นวัน · ประกาศคู่ตอนจบวันที่ 5 · วันที่ 7 แจกไพ่ให้คู่ดวลเท่านั้น', () => {
  startSeraph(['kotone', 'satoru', 'cayenne']);
  const ids = ['P1', 'P2', 'P3'];
  for (let d = 1; d <= 6; d++) {
    assert.equal(Seraph.currentDay(), d);
    assert.equal(match.gameState, 'SERAPH_PLACE', `วันที่ ${d} ต้องเป็นแมพ`);
    for (const id of ids) assert.deepEqual(match.players[id].cards, [], `วันที่ ${d} ต้องไม่มีใครได้ไพ่`);
    const st = view.buildStateFor('P1');
    assert.ok(st.seraph.world, 'มีข้อมูลแมพ');
    assert.equal(st.seraph.world.players.length, 3);
    assert.equal(st.seraph.pairs.length, d >= 6 ? 1 : 0, `วันที่ ${d}: คู่ดวลประกาศหลังจบวันที่ 5`);
    for (const id of ids) Seraph.readyPlace(engine, id);
    assert.equal(match.gameState, 'TRANSITION');
    runTimer(); // dealRound ของวันถัดไป
  }
  assert.ok(Seraph.isDuelDay());
  assert.equal(match.gameState, 'PLAYING');
  assert.equal(view.buildStateFor('P1').seraph.world, null, 'วันดวลไม่มีแมพ');
  const pair = Seraph.stateFor(engine, 'P1').duelPair;
  for (const id of ids) {
    const inDuel = id === pair.a || id === pair.b;
    assert.equal(match.players[id].cards.length > 0, inDuel, `${id} ${inDuel ? 'ต้องได้ไพ่' : 'เป็นผู้ชม ไม่ได้ไพ่'}`);
  }

  // ดวลจบ -> คืนวันที่ 7: เดินแมพ ไม่มีของ เข้าได้แค่ห้องพัก (ร้านค้าเปิด) -> พร้อมครบ -> รอบใหม่วันที่ 1
  match.players[pair.a].alive = false;
  require('../server/modes/seraph').seraphAdvance();
  assert.equal(match.gameState, 'TRANSITION');
  runTimer();
  assert.equal(match.gameState, 'SERAPH_PLACE');
  assert.ok(Seraph.isDuelNight());
  const night = view.buildStateFor(pair.b).seraph;
  assert.equal(night.night, true);
  assert.equal(night.world.pickups.length, 0, 'คืนวันที่ 7 ไม่มีของในแมพ');
  assert.deepEqual(night.places.filter((p) => p.available).map((p) => p.key), ['room']);
  assert.equal(night.shopOpen, true);
  const left = ids.filter((id) => id !== pair.a);
  for (const id of left) Seraph.readyPlace(engine, id);
  runTimer();
  assert.equal(Seraph.currentCycle(), 2);
  assert.equal(Seraph.currentDay(), 1);
  assert.equal(match.gameState, 'SERAPH_PLACE');
  assert.equal(view.buildStateFor(pair.b).seraph.night, false, 'วันที่ 1-6 เป็นกลางวัน');
});
