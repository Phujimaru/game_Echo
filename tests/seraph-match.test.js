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

timers.startPhaseTimer = (sec) => { match.timeLeft = sec; };
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
  assert.notEqual(match.gameState, 'CUTSCENE');
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
  assert.equal(combat.maxHpOf(p), 3); // ยังอยู่ในโหมด — เพดานเลือดของ Moon Cell
});
