// ฮันส์ คริสเตียน แอนเดอร์เซน — characters/andersen.js ผ่าน engine จริง (server.js)
process.env.JOURNEY_START_SECONDS = '0';
const test = require('node:test');
const assert = require('node:assert/strict');
const { engine } = require('../../server.js');
const an = require('../../characters/andersen.js');
const CHARACTERS = require('../../characters.js');

const realRandom = Math.random;
function withRandom(v, fn) {
  const seq = Array.isArray(v) ? v : null;
  let i = 0;
  Math.random = () => (seq ? (i < seq.length ? seq[i++] : 0.99) : v);
  try { return fn(); } finally { Math.random = realRandom; }
}
const blank = (id, characterId, position, teamId = null) => ({
  id, name: id, position, characterId, alive: true, connected: true, cards: [], statuses: {}, statusAmt: {},
  seen: {}, cutsceneShown: {}, inventory: [], teamId,
});
const card = (value, color) => ({ value, color });

function setup({ mode = 'ffa', teams = null } = {}) {
  for (const id of Object.keys(engine.players)) delete engine.players[id];
  engine.players.H = blank('H', 'andersen', 1, teams && 'A');
  engine.players.M = blank('M', 'kai', 2, teams && 'A');
  engine.players.T = blank('T', 'temari', 3, teams && 'B');
  engine.setGameMode(mode);
  engine.startMatch();
  engine.clearPhaseTimer();
  engine.setGameState('PLAYING');
  for (const p of Object.values(engine.players)) {
    p.locked = false; p.skillPoints = 8; p.skillUsedRound = false; p.busted = false;
    p.hp = 3; p.armor = 0; p.shield = 0; p.statuses = {}; p.statusAmt = {};
    an.resetCombat(p);
  }
  return engine.players;
}

const saved = { triggerCutscene: engine.triggerCutscene, queueCutscene: engine.queueCutscene, skillFlash: engine.skillFlash };
const cutscenes = [];
test.before(() => {
  engine.triggerCutscene = (p, k) => cutscenes.push(k);
  engine.queueCutscene = (p, k) => cutscenes.push(k);
  engine.skillFlash = () => {};
});
test.after(() => { Object.assign(engine, saved); for (const id of Object.keys(engine.players)) delete engine.players[id]; });
test.afterEach(() => { Math.random = realRandom; engine.clearPhaseTimer(); cutscenes.length = 0; });

test('ข้อมูล: ระดับยาก · ราคา 2/4/6', () => {
  const c = CHARACTERS.CHAR_BY_ID.andersen;
  assert.equal(c.difficulty, 'hard');
  assert.deepEqual([c.basic.cost, c.secondary.cost, c.ultimate.cost], [2, 4, 6]);
});

test('นักแสดงผู้ยอดเยี่ยม: ลดไพ่ใบล่าสุด (แก้ไพ่แตกได้) + ฟื้น 1 · เลือกศัตรูได้แม้โหมดทีม · เปิดไพ่แล้วลดไม่ได้ · คูลดาวน์ 2', () => {
  const { H, T } = setup({ mode: 'duo', teams: true });
  T.cards = [card(10, 'red'), card(9, 'blue'), card(5, 'green')];
  T.busted = true;
  const r0 = engine.roundNumber;
  engine.useSkill('H', 'basic', ['T']);
  assert.equal(T.cards.length, 2);
  assert.equal(T.busted, false, '24 -> 19 ไม่แตกแล้ว');
  assert.equal(T.hp, 4);
  assert.equal(an.canUseSkill(engine, H, 'basic', ['T']), false, 'คูลดาวน์');
  engine.setRoundNumber(r0 + 2);
  T.locked = true;
  H.skillUsedRound = false;
  engine.useSkill('H', 'basic', ['T']);
  assert.equal(T.cards.length, 2, 'เปิดไพ่แล้วลดไม่ได้');
  assert.equal(T.hp, 5, 'แต่ยังฟื้นพลังชีวิต');
});

test('นางเงือกน้อยของฉัน: สำเร็จ = ทั้งมือเป็นสีที่เลือก · ล้มเหลว = ทั้งมือเป็นสีอื่นสีเดียวกัน · ไม่แตะไพ่พิเศษ', () => {
  const { H } = setup();
  H.cards = [card(2, 'red'), card(3, 'blue'), { value: 0, special: 'joker' }];
  withRandom(0.1, () => engine.useSkill('H', 'secondary', ['H'], 'yellow'));
  assert.deepEqual(H.cards.map((c) => c.color), ['yellow', 'yellow', undefined]);
  H.skillUsedRound = false;
  H.cards = [card(2, 'red'), card(3, 'blue'), card(4, 'green')];
  withRandom([0.9, 0], () => engine.useSkill('H', 'secondary', ['H'], 'yellow'));
  const colors = new Set(H.cards.map((c) => c.color));
  assert.equal(colors.size, 1);
  assert.notEqual([...colors][0], 'yellow');
});

test('นางเงือกน้อยของฉัน: โหมดทีมเลือกศัตรูไม่ได้ · ต้องเลือกสี', () => {
  const { H } = setup({ mode: 'duo', teams: true });
  const sp = H.skillPoints;
  engine.useSkill('H', 'secondary', ['T'], 'red');
  engine.useSkill('H', 'secondary', ['H'], 'purple');
  assert.equal(H.skillPoints, sp);
});

test('เปลี่ยนเป็นไพ่ฟ้าแล้วได้ผลตอนเปิดไพ่ (ต้านสถานะผิดปกติ)', () => {
  const { H } = setup();
  H.cards = [card(2, 'red'), card(3, 'red'), card(4, 'green')];
  withRandom(0.1, () => engine.useSkill('H', 'secondary', ['H'], 'blue'));
  assert.equal(H.statuses.resist, undefined, 'ยังไม่เปิดไพ่');
  engine.lock('H');
  assert.equal(H.statuses.resist, 1);
});

test('Märchen Meines Lebens: ทุกคนฟื้น 2 · บัฟสุ่ม 25% แยกกัน · วีดีโอทุกครั้ง · แต้มสกิล +1 ทุกจบเทิร์น 3 เทิร์น', () => {
  const { H, M, T } = setup();
  withRandom(0, () => engine.useSkill('H', 'ultimate')); // ทอยติดทุกอย่าง
  assert.ok(T.alive);
  assert.deepEqual(cutscenes, ['andersenUlt']);
  for (const p of [H, M, T]) {
    assert.equal(p.hp, 5);
    assert.equal(p.statuses.mend, 3);
    assert.equal(p.statuses.guard, 3);
    assert.equal(p.statuses.andCrit, 3);
    assert.equal(p.statuses.andInk, 3);
  }
  M.skillPoints = 0;
  for (let i = 0; i < 4; i++) an.onEndTurn(engine);
  assert.equal(M.skillPoints, 3, 'ได้ครบ 3 เทิร์นแล้วหยุด');
  assert.equal(M.statuses.andInk, undefined);
});

test('Märchen Meines Lebens: 25% ปกติ · 50% เมื่อมีมุมมองใหม่ · โหมดทีมเฉพาะเพื่อนร่วมทีม', () => {
  const { H, M, T } = setup({ mode: 'duo', teams: true });
  withRandom(0.3, () => engine.useSkill('H', 'ultimate'));
  assert.equal(M.statuses.guard, undefined, '30 > 25 ไม่ติด');
  assert.equal(T.hp, 3, 'ศัตรูไม่ได้อะไรเลย');
  assert.equal(M.hp, 5);
  H.skillUsedRound = false; H.skillPoints = 8;
  H.statuses.andView = 1;
  withRandom(0.3, () => engine.useSkill('H', 'ultimate'));
  assert.equal(M.statuses.guard, 3, '30 < 50 ติด');
});

test('สุดยอดนักเขียน: นับเฉพาะไพ่ที่กดจั่วเอง · ทุก 3 ใบแต้มสกิล +1 · ทุก 5 ใบมุมมองใหม่ (ต่ออายุ ไม่ซ้อน)', () => {
  const { H } = setup();
  H.skillPoints = 0;
  H.cards = [card(1, 'red')];
  for (let i = 0; i < 5; i++) { H.cards = [card(1, 'red')]; engine.hit('H'); }
  assert.equal(H.skillPoints, 1, '5 ใบ = +1 (ครบ 3) และเศษ 2');
  assert.equal(H.statuses.andView, 1);
  assert.equal(H.andDrawSkill, 2);
  assert.equal(H.andDrawView, 0);
});
