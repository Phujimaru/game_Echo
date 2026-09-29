// ไรเนส เอลเมลลอย — characters/reines.js ผ่าน engine จริง (server.js)
process.env.JOURNEY_START_SECONDS = '0';
const test = require('node:test');
const assert = require('node:assert/strict');
const { engine } = require('../../server.js');
const rei = require('../../characters/reines.js');
const usagi = require('../../characters/usagi.js');
const CHARACTERS = require('../../characters.js');

const realRandom = Math.random;
function withRandom(v, fn) {
  Math.random = () => v;
  try { return fn(); } finally { Math.random = realRandom; }
}
const blank = (id, characterId, position, teamId = null) => ({
  id, name: id, position, characterId, alive: true, connected: true, cards: [], statuses: {}, statusAmt: {},
  seen: {}, cutsceneShown: {}, inventory: [], teamId,
});

function setup({ mode = 'ffa', teams = null } = {}) {
  for (const id of Object.keys(engine.players)) delete engine.players[id];
  engine.players.R = blank('R', 'reines', 1, teams && 'A');
  engine.players.M = blank('M', 'kai', 2, teams && 'A');
  engine.players.T = blank('T', 'temari', 3, teams && 'B');
  engine.setGameMode(mode);
  engine.startMatch();
  engine.clearPhaseTimer();
  engine.setGameState('PLAYING');
  for (const p of Object.values(engine.players)) {
    p.locked = false; p.skillPoints = 8; p.skillUsedRound = false;
    p.hp = 3; p.armor = 2; p.shield = 0; p.statuses = {}; p.statusAmt = {}; p.evadeStacks = []; p.gold = 30;
    rei.resetCombat(p);
  }
  return engine.players;
}
function attack(byId, targetId) {
  engine.setGameState('ATTACK');
  engine.setAttackerId(byId);
  engine.doAttack(byId, targetId);
  engine.clearPhaseTimer();
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

test('ข้อมูล: ระดับกลาง · ราคา 2/4/6', () => {
  const c = CHARACTERS.CHAR_BY_ID.reines;
  assert.equal(c.difficulty, 'medium');
  assert.deepEqual([c.basic.cost, c.secondary.cost, c.ultimate.cost], [2, 4, 6]);
});

test('คำแนะนำชั้นครู: ffa ทุกคนได้คุ้มครอง 1 เทิร์น · ทุกคนยกเว้นไรเนสแต้มสกิล +1 · คูลดาวน์ 3', () => {
  const { R, M, T } = setup();
  for (const p of [M, T]) p.skillPoints = 2;
  const r0 = engine.roundNumber;
  engine.useSkill('R', 'basic');
  for (const p of [R, M, T]) assert.equal(p.statuses.guard, 1);
  assert.equal(R.skillPoints, 6, 'จ่าย 2 ไม่ได้ +1');
  assert.equal(M.skillPoints, 3);
  assert.equal(T.skillPoints, 3);
  R.skillUsedRound = false;
  assert.equal(rei.canUseSkill(engine, R, 'basic'), false);
  engine.setRoundNumber(r0 + 3);
  assert.equal(rei.canUseSkill(engine, R, 'basic'), true);
  // คุ้มครอง 1 ลบโจมตีปกติฐาน 1
  T.hp = 7; T.armor = 0;
  attack('M', 'T');
  assert.equal(T.hp, 7);
});

test('คำแนะนำชั้นครู โหมดทีม: เฉพาะตัวเองและเพื่อนร่วมทีม', () => {
  const { R, M, T } = setup({ mode: 'duo', teams: true });
  engine.useSkill('R', 'basic');
  assert.equal(M.statuses.guard, 1);
  assert.equal(T.statuses.guard, undefined);
  assert.equal(R.statuses.guard, 1);
});

test('คำสั่งขั้นเด็ดขาด: พลังโจมตี +1 อัตราคริ +20% 2 เทิร์น + โชคลาภ · ให้ซ้ำ = โชคลาภเพิ่ม บัฟแค่ต่ออายุ · ไรเนสเสียเกราะ 1', () => {
  const { R, M } = setup();
  engine.useSkill('R', 'secondary', ['M']);
  assert.equal(M.statuses.reinesCmd, 2);
  assert.equal(M.statuses.fortune, 1);
  assert.equal(rei.atkBonus(M), 1);
  assert.equal(rei.critBonus(M), 20);
  assert.equal(R.armor, 1, 'ความเสียหาย 1 ลดเกราะก่อน');
  M.statuses.reinesCmd = 1;
  R.skillUsedRound = false;
  engine.useSkill('R', 'secondary', ['M']);
  assert.equal(M.statuses.reinesCmd, 2, 'ต่ออายุ');
  assert.equal(M.statuses.fortune, 2, 'โชคลาภเพิ่ม');
  assert.equal(rei.atkBonus(M), 1, 'พลังโจมตีไม่ซ้อน');
});

test('คำสั่งขั้นเด็ดขาด: เลือกตัวเองได้ · โหมดทีมเลือกศัตรูไม่ได้', () => {
  const { R, T } = setup({ mode: 'duo', teams: true });
  const sp = R.skillPoints;
  engine.useSkill('R', 'secondary', ['T']);
  assert.equal(T.statuses.reinesCmd, undefined);
  assert.equal(R.skillPoints, sp, 'ไม่หักแต้ม');
  engine.useSkill('R', 'secondary', ['R']);
  assert.equal(R.statuses.reinesCmd, 2);
});

test('อัตราคริ +20%: ตัวละครทั่วไปทอยคริ ×2 · อุซากิบวกเข้าอัตราของตัวเอง (ไม่คูณซ้อน)', () => {
  const { M, T } = setup();
  M.statuses.reinesCmd = 2;
  T.hp = 7; T.armor = 0;
  withRandom(0, () => attack('M', 'T'));
  assert.equal(T.hp, 3, '(1 + 1) × 2 = 4');
  T.hp = 7;
  withRandom(0.5, () => attack('M', 'T'));
  assert.equal(T.hp, 5, 'ไม่ติดคริ = 2');
  const bunny = { ...M, characterId: 'usagi', usagiPuru: 0, statuses: { reinesCmd: 2 } };
  assert.equal(withRandom(0.19, () => usagi.applyCrit(engine, bunny, 2, {})), 4);
  assert.equal(withRandom(0.21, () => usagi.applyCrit(engine, bunny, 2, {})), 2);
});

test('แผนการลับสุดยอดชั้นครู: ศัตรูเปราะบาง+อ่อนแอ 3 เทิร์น · แต้มสกิล -1 (ต้านไม่ได้) · ไม่โดนตัวเอง · ฟื้น 3 · วีดีโอทุกครั้ง · คูลดาวน์ 5', () => {
  const { R, M, T } = setup();
  T.statuses.resist = 3;
  const r0 = engine.roundNumber;
  engine.useSkill('R', 'ultimate');
  assert.deepEqual(cutscenes, ['reinesUlt']);
  assert.equal(M.statuses.fragile, 3);
  assert.equal(M.statuses.weak, 3);
  assert.equal(M.skillPoints, 7);
  assert.equal(T.statuses.weak, undefined, 'ต้านสถานะกันเปราะบาง/อ่อนแอได้');
  assert.equal(T.skillPoints, 7, 'แต่แต้มสกิลยังลด');
  assert.equal(R.statuses.weak, undefined, 'ไม่โดนตัวเอง');
  assert.equal(R.skillPoints, 2);
  assert.equal(R.hp, 6);
  assert.equal(R.reinesPlanReady, r0 + 5);
});

test('แผนการลับสุดยอดชั้นครู โหมดทีม: ลงเฉพาะฝ่ายตรงข้าม', () => {
  const { R, M, T } = setup({ mode: 'duo', teams: true });
  engine.useSkill('R', 'ultimate');
  assert.equal(M.statuses.weak, undefined);
  assert.equal(M.skillPoints, 8);
  assert.equal(T.statuses.weak, 3);
  assert.equal(R.statuses.weak, undefined);
});

test('คุณนายใหญ่: ซื้อของมีโอกาส 20% ได้เพิ่มอีกชิ้นฟรี · ไม่แถมของที่มีได้ชิ้นเดียว', () => {
  const { R } = setup();
  engine.setShopItems([
    { id: 's1', type: 'armor', value: 1, price: 3, sold: false, soldTo: null },
    { id: 's2', type: 'gutsGun', price: 15, sold: false, soldTo: null },
  ]);
  withRandom(0.1, () => engine.buyShopItem('R', 's1'));
  assert.equal(R.inventory.filter((it) => it.type === 'armor').length, 2);
  withRandom(0.1, () => engine.buyShopItem('R', 's2'));
  assert.equal(R.inventory.filter((it) => it.type === 'gutsGun').length, 1);
  engine.setShopItems([{ id: 's3', type: 'armor', value: 1, price: 3, sold: false, soldTo: null }]);
  withRandom(0.5, () => engine.buyShopItem('R', 's3'));
  assert.equal(R.inventory.filter((it) => it.type === 'armor').length, 3, 'ไม่ติด 20% = ได้ชิ้นเดียว');
});
