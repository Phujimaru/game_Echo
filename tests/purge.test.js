// โหมด Purge (server/modes/purge.js) — หนี ORT ในอุโมงค์ท่อ (ทอยเต๋า)
process.env.PURGE_INTRO_SECONDS = '0';
const test = require('node:test');
const assert = require('node:assert/strict');
const { engine, resolveRound } = require('../server.js');
const purgeMod = require('../server/modes/purge.js');

const blank = (id, characterId, position) => ({
  id, name: id, position, characterId, alive: true, connected: true, cards: [], statuses: {}, statusAmt: {},
  seen: {}, cutsceneShown: {}, inventory: [], teamId: null,
});
// temari / kai ไม่มีการหลบแบบสุ่ม และไม่มีผลพิเศษตอนแพ้จั่ว
function setup(ids = ['A', 'B', 'C']) {
  for (const id of Object.keys(engine.players)) delete engine.players[id];
  const chars = ['temari', 'kai', 'temari', 'kai'];
  ids.forEach((id, i) => { engine.players[id] = blank(id, chars[i], i + 1); });
  engine.setGameMode('purge');
  engine.startMatch();
  engine.clearPhaseTimer();
  engine.setRoundNumber(1); // ธงบางตัวผูกกับเลขรอบ (รอบ 0 = ยังไม่แจกไพ่)
  for (const p of Object.values(engine.players)) {
    p.hp = engine.maxHpOf(p); p.armor = 0; p.statuses = {}; p.statusAmt = {};
  }
  return engine.players;
}
// ลูกเต๋า: Math.random ตามลำดับที่กำหนด (แต้ม n -> (n - 1) / 6)
function withDice(rolls, fn) {
  const real = Math.random;
  let i = 0;
  Math.random = () => (rolls[i++ % rolls.length] - 1) / 6 + 0.01;
  try { return fn(); } finally { Math.random = real; }
}
const saved = { triggerCutscene: engine.triggerCutscene, queueCutscene: engine.queueCutscene, skillFlash: engine.skillFlash };
test.before(() => {
  engine.triggerCutscene = () => {};
  engine.queueCutscene = () => {};
  engine.skillFlash = () => {};
});
test.after(() => { Object.assign(engine, saved); engine.clearPhaseTimer(); for (const id of Object.keys(engine.players)) delete engine.players[id]; engine.setGameMode('ffa'); });
test.afterEach(() => { engine.clearPhaseTimer(); });

const st = () => engine.purge;
// ฉากเต๋าจบ → จุดปะทะแรก แล้วเข้าเฟสจั่วไพ่ของจุดนั้น (ตั้ง state เองแทนการแจกไพ่จริง)
function toFight() {
  engine.clearPhaseTimer();
  purgeMod.nextPhaseOrEnd();
  engine.clearPhaseTimer();
  engine.setGameState('PLAYING');
}

test('เริ่มแมตช์: ทุกคนช่อง 0 · พักเฟสรอฉากเปิด · ยังไม่มี ORT', () => {
  for (const id of Object.keys(engine.players)) delete engine.players[id];
  engine.players.A = blank('A', 'temari', 1);
  engine.players.B = blank('B', 'kai', 2);
  engine.setGameMode('purge');
  engine.startMatch();
  assert.equal(engine.gameState, 'CUTSCENE');
  assert.deepEqual(st().steps, { A: 0, B: 0 });
  const view = engine.buildStateFor('A').purge;
  assert.equal(view.ort, null);
  assert.equal(view.scene.kind, 'intro');
  assert.equal(view.totalSteps, 80);
});

test('ทอยเต๋า: ทุกคนเดินตามแต้ม 1-6 · ไม่มีใครตกช่องเดียวกัน = ไม่มีจุดปะทะ', () => {
  setup(['A', 'B', 'C']);
  withDice([3, 5, 1], () => engine.purgeDiceTurn());
  assert.deepEqual(st().steps, { A: 3, B: 5, C: 1 });
  assert.equal(st().turn, 1);
  const sc = st().scene;
  assert.equal(sc.kind, 'dice');
  assert.deepEqual(sc.moves.map((m) => m.roll), [3, 5, 1]);
  assert.deepEqual(sc.fights, []);
  assert.equal(engine.gameState, 'CUTSCENE');
});

test('ตกช่องเดียวกัน = จุดปะทะ (เรียงจากท้ายท่อ) · คนอื่นเป็นผู้ชม', () => {
  const { A, C } = setup(['A', 'B', 'C', 'D']);
  withDice([4, 4, 2, 2], () => engine.purgeDiceTurn());
  assert.deepEqual(st().scene.fights.map((f) => [f.tile, f.ids]), [[2, ['C', 'D']], [4, ['A', 'B']]]);
  engine.clearPhaseTimer();
  purgeMod.nextPhaseOrEnd();
  assert.equal(st().scene.kind, 'fight');
  assert.equal(st().scene.tile, 2);
  assert.equal(purgeMod.benched(A), true);
  assert.equal(purgeMod.benched(C), false);
  assert.deepEqual(purgeMod.combatants().map((p) => p.id), ['C', 'D']);
});

test('ผู้แพ้การปะทะถอยหลัง 2 ช่อง · ผู้ชนะอยู่ที่เดิม · ผู้ชมไม่เกี่ยว', () => {
  const { A, B, C } = setup(['A', 'B', 'C']);
  withDice([5, 5, 2], () => engine.purgeDiceTurn());
  toFight();
  A.locked = true; B.locked = true; C.locked = true; C.cards = [];
  A.cards = [{ value: 10, color: 'blue' }, { value: 8, color: 'blue' }];
  B.cards = [{ value: 5, color: 'blue' }];
  resolveRound();
  assert.equal(st().steps.A, 5);
  assert.equal(st().steps.B, 3);
  assert.equal(st().steps.C, 2);
  assert.equal(C.isWinner || C.isLoser || false, false);
});

test('เสมอแต้มในการปะทะ: ไม่มีใครถอย', () => {
  const { A, B } = setup(['A', 'B']);
  withDice([3, 3], () => engine.purgeDiceTurn());
  toFight();
  A.locked = true; B.locked = true;
  A.cards = [{ value: 10, color: 'blue' }, { value: 8, color: 'blue' }];
  B.cards = [{ value: 9, color: 'blue' }, { value: 9, color: 'blue' }];
  resolveRound();
  assert.equal(st().steps.A, 3);
  assert.equal(st().steps.B, 3);
});

test('เลือดหมด = ล้มลง: ไม่ตาย ถอยหลัง 2 ช่อง เลือดเต็ม', () => {
  const { A } = setup(['A', 'B']);
  st().steps.A = 12;
  A.hp = 0;
  engine.instantDeath(A);
  assert.equal(A.alive, true);
  assert.equal(st().steps.A, 10);
  assert.equal(A.hp, engine.maxHpOf(A));
});

test('ORT โผล่ช่อง 0 ตอนจบเทิร์นเต๋า 5 แล้วเดินเทิร์นละ 4 ช่อง · ช่อง <= ORT = LOST DATA', () => {
  const { A, B, C } = setup(['A', 'B', 'C']);
  st().turn = 5;
  withDice([1, 2, 3], () => engine.purgeDiceTurn());
  assert.equal(st().ort, 0);
  assert.equal(st().scene.ortFrom, null);
  assert.equal(st().scene.ortTo, 0);
  engine.clearPhaseTimer();
  Object.assign(st().steps, { A: 3, B: 4, C: 9 });
  withDice([1, 1, 1], () => engine.purgeDiceTurn());
  assert.equal(st().ort, 4);
  assert.equal(A.alive, false);
  assert.equal(B.alive, false);
  assert.equal(C.alive, true);
  assert.deepEqual([...st().scene.caught].sort(), ['A', 'B']);
  assert.equal(A.purgeLost, true);
});

test('ถึงประตูผนึกคนเดียว = ชนะ', () => {
  setup(['A', 'B']);
  Object.assign(st().steps, { A: 10, B: 77 });
  withDice([2, 6], () => engine.purgeDiceTurn());
  assert.deepEqual(st().scene.reached, ['B']);
  assert.equal(st().steps.B, 80);
  assert.deepEqual(st().scene.fights, []);
});

test('ถึงประตูพร้อมกันหลายคน = ปะทะที่ประตู ผู้ชนะการปะทะชนะเกม', () => {
  const { A, B } = setup(['A', 'B', 'C']);
  Object.assign(st().steps, { A: 78, B: 77, C: 10 });
  withDice([4, 6, 1], () => engine.purgeDiceTurn());
  assert.deepEqual(st().scene.fights, [{ tile: 80, ids: ['A', 'B'], gate: true }]);
  toFight();
  A.locked = true; B.locked = true;
  A.cards = [{ value: 5, color: 'blue' }];
  B.cards = [{ value: 10, color: 'blue' }, { value: 9, color: 'blue' }];
  resolveRound();
  engine.clearPhaseTimer();
  engine.purgeAdvance();
  assert.equal(engine.gameState, 'GAMEOVER');
  assert.equal(st().result, 'gate');
  assert.equal(st().winnerId, 'B');
});

test('เหลือรอดคนเดียว = จบเกม', () => {
  const { A } = setup(['A', 'B']);
  st().turn = 7; st().ort = 6;
  Object.assign(st().steps, { A: 8, B: 30 });
  withDice([1, 1], () => engine.purgeDiceTurn());
  assert.equal(A.alive, false);
  engine.clearPhaseTimer();
  engine.purgeAdvance();
  assert.equal(engine.gameState, 'GAMEOVER');
  assert.equal(st().result, 'survivor');
  assert.equal(st().winnerId, 'B');
});

test('ไม่มี Overload Force ในโหมด Purge แม้แต้มสูงสุดเสมอ', () => {
  const { A, B } = setup(['A', 'B']);
  withDice([3, 3], () => engine.purgeDiceTurn());
  toFight();
  A.locked = true; B.locked = true;
  A.cards = [{ value: 10, color: 'blue' }, { value: 8, color: 'blue' }];
  B.cards = [{ value: 9, color: 'blue' }, { value: 9, color: 'blue' }];
  const real = Math.random;
  Math.random = () => 0;
  try { resolveRound(); } finally { Math.random = real; }
  assert.equal(engine.overloadForceActive ?? false, false);
});

test('เวลาฉากเต๋าของ server ตรงกับ client', async () => {
  const client = await import('../client/src/purge/purgeScene.js');
  const cases = [
    { moves: [{ from: 0, to: 3 }, { from: 0, to: 6 }], ortFrom: null, ortTo: null, caught: [], fights: [] },
    { moves: [{ from: 3, to: 7 }], ortFrom: null, ortTo: 0, caught: [], fights: [{ tile: 7, ids: ['a', 'b'] }] },
    { moves: [{ from: 10, to: 12 }], ortFrom: 4, ortTo: 8, caught: ['x'], fights: [] },
  ];
  for (const c of cases) assert.equal(purgeMod.diceSceneSeconds(c), client.diceSceneSeconds(c));
  assert.ok(client.INTRO_SECONDS <= 14, 'ฉากเปิดฝั่ง client ต้องไม่ยาวกว่าเวลาที่ server พักไว้ (PURGE_INTRO_SECONDS ค่าเริ่มต้น 14)');
});
