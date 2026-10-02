// แพ้เพราะแต้มน้อยสุด / ไพ่แตก ไม่ได้แต้มสกิลแล้ว (เหมือนการชนะจั่ว) — resolveRound() ผ่าน engine จริง
// startMatch() ในโหมดปกติพักรอฉากแผนที่การเดินทางก่อนแจกไพ่ — เทสต์นี้ต้องการเทิร์นแรกทันที
process.env.JOURNEY_START_SECONDS = '0';
const test = require('node:test');
const assert = require('node:assert/strict');
const { engine, resolveRound } = require('../server.js');

const blank = (id, characterId, position) => ({
  id, name: id, position, characterId, alive: true, connected: true, cards: [], statuses: {}, statusAmt: {},
  seen: {}, cutsceneShown: {}, inventory: [], teamId: null,
});
// temari / kai ไม่มีการหลบแบบสุ่ม และไม่มีผลพิเศษตอนแพ้จั่ว
function setup() {
  for (const id of Object.keys(engine.players)) delete engine.players[id];
  engine.players.W = blank('W', 'temari', 1);
  engine.players.L = blank('L', 'kai', 2);
  engine.setGameMode('ffa');
  engine.startMatch();
  engine.clearPhaseTimer();
  engine.setGameState('PLAYING');
  for (const p of Object.values(engine.players)) {
    p.locked = true; p.skillPoints = 3; p.skillUsedRound = false;
    p.hp = engine.maxHpOf(p); p.armor = 0; p.shield = 0; p.statuses = {}; p.statusAmt = {};
  }
  return { W: engine.players.W, L: engine.players.L };
}

const saved = { triggerCutscene: engine.triggerCutscene, queueCutscene: engine.queueCutscene, skillFlash: engine.skillFlash };
test.before(() => {
  engine.triggerCutscene = () => {};
  engine.queueCutscene = () => {};
  engine.skillFlash = () => {};
});
test.after(() => { Object.assign(engine, saved); for (const id of Object.keys(engine.players)) delete engine.players[id]; });
test.afterEach(() => { engine.clearPhaseTimer(); });

test('แพ้เพราะแต้มน้อยสุด: โดนดาเมจ 1 แต่ไม่ได้แต้มสกิล', () => {
  const { W, L } = setup();
  W.cards = [{ value: 10, color: 'blue' }, { value: 9, color: 'blue' }];
  L.cards = [{ value: 5, color: 'blue' }];
  const hp = L.hp;
  resolveRound();
  assert.equal(L.isLoser, true);
  assert.equal(L.hp, hp - 1);
  assert.equal(L.skillPoints, 3);
  assert.equal(W.skillPoints, 3);
});

test('ไพ่แตก: แพ้แต่ไม่ได้แต้มสกิล', () => {
  const { W, L } = setup();
  W.cards = [{ value: 5, color: 'blue' }];
  L.cards = [{ value: 9, color: 'blue' }, { value: 8, color: 'blue' }, { value: 7, color: 'blue' }];
  resolveRound();
  assert.equal(L.isLoser, true);
  assert.equal(L.skillPoints, 3);
});

test('มีผลกันดาเมจแพ้จั่ว (กันตายทำงานแล้ว): ไม่โดนดาเมจ และไม่ได้แต้มสกิลเช่นกัน', () => {
  const { W, L } = setup();
  L.beatSaved = true;
  W.cards = [{ value: 10, color: 'blue' }];
  L.cards = [{ value: 4, color: 'blue' }];
  const hp = L.hp;
  resolveRound();
  assert.equal(L.isLoser, true);
  assert.equal(L.hp, hp);
  assert.equal(L.skillPoints, 3);
});
