// โหมด Purge (server/modes/purge.js) — หนี ORT ในอุโมงค์ท่อ
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
  engine.setGameState('PLAYING');
  engine.setRoundNumber(1); // เทิร์นแรกจริงเริ่มที่ 1 (รอบ 0 = ยังไม่แจกไพ่ — ธงบางตัวผูกกับเลขรอบ)
  for (const p of Object.values(engine.players)) {
    p.locked = true; p.hp = engine.maxHpOf(p); p.armor = 0; p.statuses = {}; p.statusAmt = {};
  }
  return engine.players;
}
const saved = { triggerCutscene: engine.triggerCutscene, queueCutscene: engine.queueCutscene, skillFlash: engine.skillFlash };
test.before(() => {
  engine.triggerCutscene = () => {};
  engine.queueCutscene = () => {};
  engine.skillFlash = () => {};
});
test.after(() => { Object.assign(engine, saved); engine.clearPhaseTimer(); for (const id of Object.keys(engine.players)) delete engine.players[id]; engine.setGameMode('ffa'); });
test.afterEach(() => { engine.clearPhaseTimer(); });

const steps = () => engine.purge.steps;

test('เริ่มแมตช์: ทุกคนช่อง 0 · พักเฟสรอฉากเปิด · ยังไม่มี ORT', () => {
  for (const id of Object.keys(engine.players)) delete engine.players[id];
  engine.players.A = blank('A', 'temari', 1);
  engine.players.B = blank('B', 'kai', 2);
  engine.setGameMode('purge');
  engine.startMatch();
  assert.equal(engine.gameState, 'CUTSCENE');
  assert.deepEqual(steps(), { A: 0, B: 0 });
  const st = engine.buildStateFor('A').purge;
  assert.equal(st.ort, null);
  assert.equal(st.scene.kind, 'intro');
  assert.equal(st.scene.active, true);
  assert.equal(st.totalSteps, 50);
});

test('ผู้ชนะรอบเดิน 1 ช่อง · คนแพ้ไม่เดิน', () => {
  const { A, B } = setup(['A', 'B']);
  A.cards = [{ value: 10, color: 'blue' }, { value: 8, color: 'blue' }];
  B.cards = [{ value: 5, color: 'blue' }];
  resolveRound();
  assert.equal(steps().A, 1);
  assert.equal(steps().B, 0);
});

test('ชนะด้วย 21 พอดีก็เดิน 1 ช่องเท่าเดิม', () => {
  const { A, B } = setup(['A', 'B']);
  A.cards = [{ value: 10, color: 'blue' }, { value: 9, color: 'blue' }, { value: 2, color: 'blue' }];
  B.cards = [{ value: 5, color: 'blue' }];
  resolveRound();
  assert.equal(steps().A, 1);
});

test('เสมอแต้มสูงสุด: ไม่มีใครเดิน', () => {
  const { A, B } = setup(['A', 'B']);
  A.cards = [{ value: 10, color: 'blue' }, { value: 8, color: 'blue' }];
  B.cards = [{ value: 9, color: 'blue' }, { value: 9, color: 'blue' }];
  resolveRound();
  assert.equal(steps().A, 0);
  assert.equal(steps().B, 0);
});

test('เลือดหมด = ล้มลง: ไม่ตาย ถอยหลัง 2 ช่อง เลือดเต็ม', () => {
  const { A } = setup(['A', 'B']);
  engine.purge.steps.A = 12;
  A.hp = 0;
  engine.instantDeath(A);
  assert.equal(A.alive, true);
  assert.equal(steps().A, 10);
  assert.equal(A.hp, engine.maxHpOf(A));
});

test('ล้มลงตอนอยู่ช่องต้นๆ: ถอยได้ไม่ต่ำกว่าช่อง 0', () => {
  const { A } = setup(['A', 'B']);
  engine.purge.steps.A = 1;
  engine.instantDeath(A, true);
  assert.equal(A.alive, true);
  assert.equal(steps().A, 0);
});

test('ORT โผล่จบเทิร์น 10 ที่ช่อง 0 และยังไม่กินใคร', () => {
  const { A } = setup(['A', 'B']);
  engine.setRoundNumber(9);
  engine.purgeAdvance();
  assert.equal(engine.purge.ort, null);
  engine.clearPhaseTimer();
  engine.setRoundNumber(10);
  engine.purgeAdvance();
  assert.equal(engine.purge.ort, 0);
  assert.equal(A.alive, true);
  assert.equal(engine.purge.scene.kind, 'turn');
  assert.equal(engine.purge.scene.ortFrom, null);
  assert.equal(engine.purge.scene.ortTo, 0);
  assert.equal(engine.gameState, 'CUTSCENE');
});

test('ORT เดิน 1 ช่องทุก 2 เทิร์น และกินคนที่ช่อง <= ORT (LOST DATA)', () => {
  const { A, B, C } = setup(['A', 'B', 'C']);
  engine.purge.ort = 3;
  Object.assign(engine.purge.steps, { A: 4, B: 9, C: 2 });
  engine.setRoundNumber(18);
  engine.purgeAdvance();
  assert.equal(engine.purge.ort, 4);
  assert.equal(A.alive, false);
  assert.equal(C.alive, false);
  assert.equal(B.alive, true);
  assert.deepEqual([...engine.purge.scene.caught].sort(), ['A', 'C']);
  assert.equal(A.purgeLost, true);
});

test('เทิร์นที่ ORT ไม่เดิน: อยู่ที่เดิม แต่คนที่ถอยลงมาถึง ORT ยังโดนกิน', () => {
  const { A, B } = setup(['A', 'B', 'C']);
  engine.purge.ort = 4;
  Object.assign(engine.purge.steps, { A: 4, B: 9, C: 12 });
  engine.setRoundNumber(19);
  engine.purgeAdvance();
  assert.equal(engine.purge.ort, 4);
  assert.equal(A.alive, false);
  assert.equal(B.alive, true);
});

test('ฉากจบเทิร์นบอกการเดินของเทิร์นนี้ (from → to)', () => {
  const { A, B } = setup(['A', 'B']);
  A.cards = [{ value: 10, color: 'blue' }, { value: 8, color: 'blue' }];
  B.cards = [{ value: 5, color: 'blue' }];
  resolveRound();
  engine.setRoundNumber(1);
  engine.purgeAdvance();
  assert.deepEqual(engine.purge.scene.moves, [{ id: 'A', from: 0, to: 1 }]);
  assert.equal(engine.purge.scene.ortTo, null);
});

test('เหลือรอดคนเดียว = จบเกม ผู้ชนะคือคนนั้น', () => {
  const { B } = setup(['A', 'B']);
  engine.purge.ort = 6;
  Object.assign(engine.purge.steps, { A: 7, B: 20 });
  engine.setRoundNumber(24);
  engine.purgeAdvance();
  assert.equal(engine.players.A.alive, false);
  engine.clearPhaseTimer();
  purgeModuleNext();
  assert.equal(engine.gameState, 'GAMEOVER');
  assert.equal(engine.purge.result, 'survivor');
  assert.equal(B.alive, true);
});

test('ORT ถึงปลายท่อ (ช่อง 50): ทุกคนที่เหลือแพ้', () => {
  const { A, B } = setup(['A', 'B']);
  engine.purge.ort = 49;
  Object.assign(engine.purge.steps, { A: 50, B: 50 });
  engine.setRoundNumber(110);
  engine.purgeAdvance();
  assert.equal(engine.purge.ort, 50);
  assert.equal(A.alive, false);
  assert.equal(B.alive, false);
  engine.clearPhaseTimer();
  purgeModuleNext();
  assert.equal(engine.gameState, 'GAMEOVER');
  assert.equal(engine.purge.result, 'allLost');
});

test('ไม่มี Overload Force ในโหมด Purge แม้แต้มสูงสุดเสมอ', () => {
  const { A, B } = setup(['A', 'B']);
  A.cards = [{ value: 10, color: 'blue' }, { value: 8, color: 'blue' }];
  B.cards = [{ value: 9, color: 'blue' }, { value: 9, color: 'blue' }];
  const real = Math.random;
  Math.random = () => 0;
  try { resolveRound(); } finally { Math.random = real; }
  assert.equal(engine.overloadForceActive ?? false, false);
});

test('เวลาฉากจบเทิร์นของ server ตรงกับ client', async () => {
  const client = await import('../client/src/purge/purgeScene.js');
  const cases = [
    { moves: [], ortFrom: null, ortTo: 0, caught: [] },
    { moves: [{ from: 3, to: 7 }], ortFrom: 4, ortTo: 5, caught: [] },
    { moves: [{ from: 10, to: 5 }, { from: 2, to: 6 }], ortFrom: 5, ortTo: 6, caught: ['x'] },
  ];
  for (const c of cases) assert.equal(purgeMod.turnSceneSeconds(c), client.turnSceneSeconds(c));
  assert.ok(client.INTRO_SECONDS <= 11, 'ฉากเปิดฝั่ง client ต้องไม่ยาวกว่าเวลาที่ server พักไว้ (PURGE_INTRO_SECONDS ค่าเริ่มต้น 11)');
});

// ฉากจบเทิร์นหมดเวลา -> เฟสถัดไป (timer จริงถูกล้างในเทสต์ จึงเรียกตัวที่ timer เรียกตรงๆ)
function purgeModuleNext() { purgeMod.nextPhaseOrEnd(); }
