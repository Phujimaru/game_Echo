// ซัพพอร์ตทั้ง 4 ตัว (โอเบรอนฤดูร้อน / อาร์โทเรีย / ไรเนส / แอนเดอร์เซน) เลือกเพื่อนร่วมทีมเป็นเป้าหมายได้ทุกโหมดทีม
//  บั๊กเดิม: Type Mercury ใช้ sameTeam() ตัดสิน ซึ่งคืน false ให้ "เป้าที่ผู้เล่นกดเลือกเอง" (explicitTargetIds)
//  เพื่อนที่ถูกเลือกจึงกลายเป็นคนนอกทีม -> สกิลถูกปฏิเสธ · ตอนนี้ใช้ engine.isAlly() แทน
process.env.JOURNEY_START_SECONDS = '0';
const test = require('node:test');
const assert = require('node:assert/strict');
const { engine } = require('../server.js');

const blank = (id, characterId, position, teamId) => ({
  id, name: id, position, characterId, alive: true, connected: true, cards: [], statuses: {}, statusAmt: {},
  seen: {}, cutsceneShown: {}, inventory: [], teamId,
});

// mode: 'duo' | 'trio' | 'mercury' — supportId นั่งที่ S · M = เพื่อน · E = ศัตรู (โหมดทีม)
function setup(mode, supportId) {
  for (const id of Object.keys(engine.players)) delete engine.players[id];
  const raid = mode === 'mercury';
  engine.players.S = blank('S', supportId, 1, raid ? null : 'A');
  engine.players.M = blank('M', 'kai', 2, raid ? null : 'A');
  if (mode === 'trio') engine.players.M2 = blank('M2', 'kai', 3, 'A');
  if (!raid) engine.players.E = blank('E', 'temari', 4, 'B');
  engine.setGameMode(raid ? 'ffa' : mode);
  engine.startMatch();
  engine.clearPhaseTimer();
  if (raid) engine.setGameMode('mercury'); // ผู้เล่นจริงทุกคนเป็นพวกเดียวกัน (ไม่ต้องสร้าง ORT จริงสำหรับเทสต์นี้)
  engine.setGameState('PLAYING');
  for (const p of Object.values(engine.players)) {
    p.locked = false; p.skillPoints = 8; p.skillUsedRound = false;
    p.hp = 3; p.armor = 3; p.shield = 0; p.statuses = {}; p.statusAmt = {}; p.evadeStacks = [];
    p.cards = [{ value: 5, color: 'red' }, { value: 4, color: 'blue' }];
  }
  return engine.players;
}

const saved = { triggerCutscene: engine.triggerCutscene, queueCutscene: engine.queueCutscene, skillFlash: engine.skillFlash };
test.before(() => {
  engine.triggerCutscene = () => {};
  engine.queueCutscene = () => {};
  engine.skillFlash = () => {};
});
test.after(() => {
  Object.assign(engine, saved);
  engine.setGameMode('ffa');
  for (const id of Object.keys(engine.players)) delete engine.players[id];
});
test.afterEach(() => { engine.clearPhaseTimer(); });

for (const mode of ['duo', 'trio', 'mercury']) {
  test(`${mode}: อาร์โทเรีย ผู้พิทักษ์ทะเลสาบ เลือกเพื่อนได้`, () => {
    const { M } = setup(mode, 'artoria_caster');
    engine.useSkill('S', 'secondary', ['M']);
    assert.equal(M.statuses.artHope, 2);
  });
  test(`${mode}: ไรเนส คำแนะนำชั้นครู + คำสั่งขั้นเด็ดขาด เลือกเพื่อนได้`, () => {
    const { S, M } = setup(mode, 'reines');
    engine.useSkill('S', 'basic', ['M']);
    assert.equal(M.statuses.reinesCrit, 3);
    S.skillUsedRound = false;
    engine.useSkill('S', 'secondary', ['M']);
    assert.equal(M.statuses.reinesCmd, 3);
  });
  test(`${mode}: แอนเดอร์เซน นักแสดง + นางเงือก เลือกเพื่อนได้`, () => {
    const { S, M } = setup(mode, 'andersen');
    engine.useSkill('S', 'basic', ['M']);
    assert.equal(M.cards.length, 1);
    S.skillUsedRound = false;
    engine.useSkill('S', 'secondary', ['M'], 'green');
    assert.ok(M.cards.every((c) => ['red', 'yellow', 'green', 'blue'].includes(c.color)));
    assert.equal(S.skillPoints, 8 - 2 - 4, 'หักแต้มทั้งสองท่า = สกิลทำงาน');
  });
  test(`${mode}: โอเบรอน นกจาบ + จุดจบของความฝัน เลือกเพื่อนได้`, () => {
    const { S, M } = setup(mode, 'oberon_summer');
    engine.useSkill('S', 'secondary', ['M']);
    assert.equal(M.statuses.resist, 2);
    engine.useSkill('S', 'ultimate', ['M']);
    assert.equal(M.statuses.obsDream, 1);
    assert.equal(S.skillPoints, 0);
  });
  test(`${mode}: ท่าที่มอบให้ "ทุกคน" ได้ถึงเพื่อน แต่ไม่ถึงศัตรู`, () => {
    const { M, E } = setup(mode, 'artoria_caster');
    M.skillPoints = 0;
    if (E) E.skillPoints = 0;
    engine.useSkill('S', 'basic');
    assert.equal(M.skillPoints, 3);
    if (E) assert.equal(E.skillPoints, 0);
  });
}

test('duo: มอบผลดีให้ศัตรูไม่ได้ (อาร์โทเรีย / ไรเนส)', () => {
  const { E } = setup('duo', 'artoria_caster');
  engine.useSkill('S', 'secondary', ['E']);
  assert.equal(E.statuses.artHope, undefined);
  const r = setup('duo', 'reines');
  engine.useSkill('S', 'basic', ['E']);
  assert.equal(r.E.statuses.reinesCrit, undefined);
});
