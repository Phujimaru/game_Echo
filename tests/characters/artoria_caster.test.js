// จอมเวทย์ อาร์โทเรีย — characters/artoria_caster.js ผ่าน engine จริง (server.js)
process.env.JOURNEY_START_SECONDS = '0';
const test = require('node:test');
const assert = require('node:assert/strict');
const { engine } = require('../../server.js');
const art = require('../../characters/artoria_caster.js');
const CHARACTERS = require('../../characters.js');

const realRandom = Math.random;
const blank = (id, characterId, position, teamId = null) => ({
  id, name: id, position, characterId, alive: true, connected: true, cards: [], statuses: {}, statusAmt: {},
  seen: {}, cutsceneShown: {}, inventory: [], teamId,
});

function setup({ mode = 'ffa', teams = null } = {}) {
  for (const id of Object.keys(engine.players)) delete engine.players[id];
  engine.players.A = blank('A', 'artoria_caster', 1, teams && 'A');
  engine.players.M = blank('M', 'kai', 2, teams && 'A');
  engine.players.T = blank('T', 'temari', 3, teams && 'B');
  engine.setGameMode(mode);
  engine.startMatch();
  engine.clearPhaseTimer();
  engine.setGameState('PLAYING');
  for (const p of Object.values(engine.players)) {
    p.locked = false; p.skillPoints = 0; p.skillUsedRound = false;
    p.hp = 3; p.armor = 0; p.shield = 0; p.statuses = {}; p.statusAmt = {}; p.evadeStacks = [];
    art.resetCombat(p);
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

test('ข้อมูล: ระดับง่าย · ราคา 0/0/8', () => {
  const c = CHARACTERS.CHAR_BY_ID.artoria_caster;
  assert.equal(c.difficulty, 'easy');
  assert.deepEqual([c.basic.cost, c.secondary.cost, c.ultimate.cost], [0, 0, 8]);
});

test('เสน่ห์แห่งความหวัง: ffa ทุกคน +1 พลังโจมตี 3 เทิร์น + แต้มสกิล 3 · คูลดาวน์ 5 เทิร์น', () => {
  const { A, M, T } = setup();
  const r0 = engine.roundNumber;
  engine.useSkill('A', 'basic');
  for (const p of [A, M, T]) {
    assert.equal(p.statuses.artCharm, 3);
    assert.equal(p.skillPoints, 3);
  }
  A.skillUsedRound = false;
  assert.equal(art.canUseSkill(engine, A, 'basic'), false);
  engine.setRoundNumber(r0 + 4);
  assert.equal(art.canUseSkill(engine, A, 'basic'), false);
  engine.setRoundNumber(r0 + 5);
  assert.equal(art.canUseSkill(engine, A, 'basic'), true, 'กดเทิร์น N กดได้อีกเทิร์น N+5');
});

test('เสน่ห์แห่งความหวัง โหมดทีม: เฉพาะตัวเองและเพื่อนร่วมทีม', () => {
  const { A, M, T } = setup({ mode: 'duo', teams: true });
  engine.useSkill('A', 'basic');
  assert.equal(A.skillPoints, 3);
  assert.equal(M.skillPoints, 3);
  assert.equal(T.skillPoints, 0);
});

test('ผู้พิทักษ์ทะเลสาบ: +1 แต้มสกิล + ความหวัง 2 เทิร์น · โหมดทีมเลือกศัตรูไม่ได้ · คูลดาวน์ 2', () => {
  const { A, M, T } = setup({ mode: 'duo', teams: true });
  engine.useSkill('A', 'secondary', ['T']);
  assert.equal(T.statuses.artHope, undefined, 'โหมดทีมมอบให้ศัตรูไม่ได้');
  engine.useSkill('A', 'secondary', ['M']);
  assert.equal(M.skillPoints, 1);
  assert.equal(M.statuses.artHope, 2);
  assert.equal(art.canUseSkill(engine, A, 'secondary', ['A']), false, 'คูลดาวน์');
});

test('ความหวัง: ออกหมัดโจมตีปกติแล้วฟื้นแต้มสกิล +1 (ถูกหลบก็นับ)', () => {
  const { A, T } = setup();
  engine.useSkill('A', 'secondary', ['T']);
  const before = T.skillPoints;
  A.statuses.evade = 1; A.evadeStacks = [2]; // A หลบ 100%
  attack('T', 'A');
  assert.equal(T.skillPoints, before + 1);
});

test('พลังโจมตีจากสกิลพื้นฐานกับท่าไม้ตายซ้อนกันได้ (+2)', () => {
  const { A, T } = setup();
  engine.useSkill('A', 'basic');
  A.skillUsedRound = false;
  A.skillPoints = 8;
  engine.useSkill('A', 'ultimate');
  T.hp = 7; T.armor = 0; T.evadeStacks = []; delete T.statuses.evade;
  attack('A', 'T');
  assert.equal(T.hp, 4, 'พลังโจมตี 1 + 1 + 1');
});

test('Around Caliburn: ทุกคน +1 พลังโจมตี · หลบหลีก 1 · ล้างดีบัฟล่าสุด · ฟื้น 2 · วีดีโอทุกครั้ง', () => {
  const { A, M, T } = setup();
  engine.applyDebuff(M, 'weak', 1, 3);
  engine.applyDebuff(M, 'nodraw', null, 2);
  A.skillPoints = 8;
  engine.useSkill('A', 'ultimate');
  assert.deepEqual(cutscenes, ['artoriaUlt']);
  for (const p of [A, M, T]) {
    assert.equal(p.statuses.artCaliburn, 3);
    assert.equal(p.statuses.evade, 1);
    assert.equal(p.hp, 5);
  }
  assert.equal(M.statuses.nodraw, undefined, 'ล้างตัวที่โดนล่าสุด');
  assert.equal(M.statuses.weak, 3);
});

test('หัวใจที่บริสุทธิ์: ต้นเทิร์นที่ 3, 6, 9 หลบหลีก 1 ครั้ง (อยู่ 1 เทิร์น) + ฟื้น 2', () => {
  const { A } = setup();
  engine.setRoundNumber(4);
  art.onRoundStartTick(engine, A);
  assert.equal(A.statuses.evade, undefined, 'ไม่ใช่เทิร์นที่หาร 3 ลงตัว');
  engine.setRoundNumber(6);
  art.onRoundStartTick(engine, A);
  assert.equal(A.statuses.evade, 1);
  assert.deepEqual(A.evadeStacks, [1], 'อายุ 1 เทิร์น');
  assert.equal(A.hp, 5);
});
