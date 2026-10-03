// คอเซ็ตต์ ชไนเดอร์ + เปิดม่าน/บทเพลงพังของทักต์ — characters/cosette.js · characters/takt.js ผ่าน engine จริง
process.env.JOURNEY_START_SECONDS = '0';
const test = require('node:test');
const assert = require('node:assert/strict');
const { engine } = require('../../server.js');
const takt = require('../../characters/takt.js');
const titan = require('../../characters/titan.js');
const cos = require('../../characters/cosette.js');
const CHARACTERS = require('../../characters.js');

const realRandom = Math.random;
const blank = (id, characterId, position) => ({
  id, name: id, position, characterId, alive: true, connected: true, cards: [], statuses: {}, statusAmt: {},
  seen: {}, cutsceneShown: {}, inventory: [], teamId: null,
});
function setup() {
  for (const id of Object.keys(engine.players)) delete engine.players[id];
  engine.players.K = blank('K', 'takt', 1);
  engine.players.C = blank('C', 'cosette', 2);
  engine.players.N = blank('N', 'titan', 3);
  engine.players.T = blank('T', 'temari', 4);
  engine.players.M = blank('M', 'kai', 5);
  engine.setGameMode('ffa');
  engine.startMatch();
  engine.clearPhaseTimer();
  engine.setGameState('PLAYING');
  for (const p of Object.values(engine.players)) {
    p.locked = false; p.skillPoints = 8; p.skillUsedRound = false;
    p.hp = engine.maxHpOf(p); p.armor = engine.maxArmorOf(p); p.shield = 0; p.statuses = {}; p.statusAmt = {}; p.evadeStacks = [];
  }
  return engine.players;
}
function bond(K, c) { takt.invite(engine, K, c.id); takt.answerInvite(engine, c, true); }
function song(K, c) { c.statuses.taktSong = 5; c.taktSongMode = 'low'; }
function attack(byId, targetId) {
  engine.setGameState('ATTACK');
  engine.setAttackerId(byId);
  engine.doAttack(byId, targetId);
  engine.clearPhaseTimer();
}
const saved = { triggerCutscene: engine.triggerCutscene, queueCutscene: engine.queueCutscene, skillFlash: engine.skillFlash, sfx: engine.sfx };
const cutscenes = [];
test.before(() => {
  engine.triggerCutscene = (p, k) => cutscenes.push(k);
  engine.queueCutscene = (p, k) => cutscenes.push(k);
  engine.skillFlash = () => {};
  engine.sfx = () => {};
});
test.after(() => { Object.assign(engine, saved); for (const id of Object.keys(engine.players)) delete engine.players[id]; });
test.afterEach(() => { Math.random = realRandom; engine.clearPhaseTimer(); cutscenes.length = 0; });

test('ข้อมูล: ระดับกลาง · ราคา 0/1/4 · ชุดบทเพลง 3/8 · ทักต์มีสกิลติดตัว 3', () => {
  const c = CHARACTERS.CHAR_BY_ID.cosette;
  assert.equal(c.difficulty, 'medium');
  assert.deepEqual([c.basic.cost, c.secondary.cost, c.ultimate.cost, c.secondary2.cost, c.ultimate2.cost], [0, 1, 4, 3, 8]);
  assert.equal(CHARACTERS.CHAR_BY_ID.takt.passive3.name, 'เปิดม่าน');
});

test('เปลี่ยนร่าง: ไม่กินโควตา · 1 ครั้ง/เทิร์น · มนุษย์ -1 พรมลิขิต +2 · ต้นเทิร์นฟื้น 1 / เสีย 2 ลดเกราะก่อน', () => {
  const { C, T } = setup();
  assert.equal(engine.attackPowerAgainst(C, T), 0, 'มนุษย์ 1-1');
  engine.useSkill('C', 'basic');
  assert.equal(C.cosette.form, 'destiny');
  assert.equal(C.skillUsedRound, false);
  engine.useSkill('C', 'basic');
  assert.equal(C.cosette.form, 'destiny', 'สลับได้เทิร์นละครั้ง');
  assert.equal(engine.attackPowerAgainst(C, T), 3);
  C.hp = 7; C.armor = 1;
  cos.onRoundStartTick(engine, C);
  assert.equal(C.armor, 0); assert.equal(C.hp, 6);
  C.hp = 2; C.armor = 0;
  cos.onRoundStartTick(engine, C);
  assert.equal(C.hp, 1, 'หยุดที่ 1');
  assert.equal(C.cosette.form, 'human', 'กลับร่างมนุษย์เอง');
  cos.onRoundStartTick(engine, C);
  assert.equal(C.hp, 2);
});

test('ทักต์มอบบทเพลง: เปลี่ยนเป็นพรมลิขิตทันที · สลับร่างไม่ได้จนบทเพลงหมด', () => {
  const { K, C } = setup();
  bond(K, C);
  assert.equal(C.cosette.form, 'human');
  engine.useSkill('K', 'ultimate', ['C']);
  assert.equal(engine.players.C.statuses.taktSong > 0, true);
  assert.equal(C.cosette.form, 'destiny');
  engine.setRoundNumber(engine.roundNumber + 1);
  assert.equal(cos.canUseSkill(engine, C, 'basic'), false, 'ล็อกระหว่างบทเพลง');
  assert.equal(cos.skillLocks(engine, C).basic.locked, true);
  engine.useSkill('C', 'basic');
  assert.equal(C.cosette.form, 'destiny');
  delete C.statuses.taktSong; // บทเพลงหมด
  assert.equal(cos.canUseSkill(engine, C, 'basic'), true);
  engine.useSkill('C', 'basic');
  assert.equal(C.cosette.form, 'human');
});

test('มิวสิคคาร์ทที่แท้จริง: 3 ขั้น ไม่กินโควตา · ตีโดนลุกไหม้ตามขั้น · หลบ 5%/ขั้น', () => {
  const { C, T } = setup();
  for (let i = 0; i < 4; i++) engine.useSkill('C', 'secondary');
  assert.equal(C.cosette.trueStacks, 3);
  assert.equal(C.skillPoints, 5);
  engine.useSkill('C', 'basic'); // พรมลิขิต
  Math.random = () => 0.9;
  attack('C', 'T');
  assert.equal(T.statuses.hburn, 3);
  Math.random = () => 0.1; // 10% < 15%
  const hp = C.hp;
  attack('T', 'C');
  assert.equal(engine.lastAttack.dodge, true);
  assert.equal(C.hp, hp);
});

test('ทิ่มแทง: คัดลอกบัฟ · ลบต้านสถานะ · ภาระเวท 2 · ถูกหลบท่ายังอยู่', () => {
  const { C, T } = setup();
  engine.useSkill('C', 'ultimate');
  assert.equal(C.cosette.pierce, true);
  assert.equal(cos.canUseSkill(engine, C, 'ultimate'), false);
  T.statuses.resist = 2; T.statuses.guard = 3; T.statusAmt.guard = 1; T.statuses.fortune = 2;
  // ถูกหลบ (เทมาริไม่มีหลบ -> ใส่หลบหลีกให้)
  engine.grantEvadeStack(T, 2);
  Math.random = () => 0.1;
  attack('C', 'T');
  assert.equal(C.cosette.pierce, true, 'พลาด ท่ายังอยู่');
  assert.ok(!cutscenes.includes('cosettePierce'));
  Math.random = () => 0.9;
  attack('C', 'T');
  assert.equal(C.cosette.pierce, false);
  assert.ok(cutscenes.includes('cosettePierce'));
  assert.equal(C.statuses.guard, 3); assert.equal(C.statuses.fortune, 2);
  assert.equal(T.statuses.guard, 3, 'เป้าไม่เสียบัฟ');
  assert.equal(T.statuses.resist, undefined);
  assert.equal(T.statusAmt.spellburden, 2);
});

test('ระหว่างบทเพลง: ทิ่มแทงที่ค้างไม่ทำงาน · มิวสิคคาร์ท ตีโดนฟื้นคอนดักเตอร์ 1 + ตัวเอง 1', () => {
  const { K, C, T } = setup();
  bond(K, C);
  engine.useSkill('C', 'ultimate'); // ทิ่มแทง (ก่อนได้บทเพลง)
  song(K, C);
  K.hp = 3; C.hp = 4;
  Math.random = () => 0.9;
  attack('C', 'T');
  assert.equal(C.cosette.pierce, true, 'ทิ่มแทงรอไว้');
  assert.equal(K.hp, 4);
  assert.equal(C.hp, 5);
});

test('Maestro: คอนดักเตอร์โชคลาภ 1 · คอนดักเตอร์ออกหมัดแล้วตามตี · อยู่ 2 เทิร์น · คูลดาวน์ 4', () => {
  const { K, C, T } = setup();
  bond(K, C); song(K, C);
  const r = engine.roundNumber;
  engine.useSkill('C', 'secondary');
  assert.equal(K.statuses.fortune, 1);
  assert.equal(C.skillUsedRound, true);
  Math.random = () => 0.9;
  attack('K', 'T');
  assert.equal(C.cosette.followPending, true);
  assert.equal(cos.continueFollow(engine), true);
  engine.clearPhaseTimer();
  assert.ok(!cutscenes.some((k) => /maestro/i.test(k)), 'ตามตีไม่มีวีดีโอ');
  assert.equal(engine.attackerId, 'C');
  assert.equal(C.cosette.follow, 0, 'ใช้แล้ว');
  C.skillUsedRound = false;
  engine.setRoundNumber(r + 3);
  assert.equal(cos.canUseSkill(engine, C, 'secondary'), false);
  engine.setRoundNumber(r + 4);
  assert.equal(cos.canUseSkill(engine, C, 'secondary'), true);
});

test('Destiny: หารแต้มกับคอนดักเตอร์ · ยิงโดนแล้วค่อยสูบเลือด 2 · I ×1.5 ผกผัน · II ลบบัฟ ×2', () => {
  const { K, C, T } = setup();
  bond(K, C); song(K, C);
  C.skillPoints = 5; K.skillPoints = 8; K.hp = 5; C.hp = 5;
  engine.useSkill('C', 'ultimate', [], 'I');
  assert.equal(C.skillPoints, 0); assert.equal(K.skillPoints, 5);
  assert.equal(K.hp, 5, 'กดแล้วยังไม่สูบ');
  assert.equal(C.hp, 5);
  assert.equal(C.cosette.destiny, 'I');
  // ถูกหลบ = ไม่สูบ บัฟยังอยู่
  T.hp = 7; T.armor = 0; T.statuses.resist = 2;
  engine.grantEvadeStack(T, 2);
  Math.random = () => 0.1;
  attack('C', 'T');
  assert.equal(C.cosette.destiny, 'I');
  assert.equal(K.hp, 5);
  Math.random = () => 0.9;
  attack('C', 'T'); // ฐาน 1-1 (มนุษย์) +1 บทเพลง = 1 -> ×1.5 = 2
  assert.equal(T.hp, 5);
  assert.equal(T.statuses.invert, 2);
  assert.ok(cutscenes.includes('cosetteDestinyI'));
  assert.equal(K.hp, 4, 'ยิงโดนแล้วสูบ 2 แล้วมิวสิคคาร์ทฟื้นคืน 1');
  assert.equal(C.hp, 7, 'สูบ 2 + มิวสิคคาร์ทฟื้น 1 (เต็ม 7)');
  // II สูบ 2
  C.skillPoints = 8; K.skillPoints = 8; C.skillUsedRound = false; K.hp = 5; C.hp = 3;
  engine.setGameState('PLAYING');
  engine.useSkill('C', 'ultimate', [], 'II');
  assert.equal(C.cosette.destiny, 'II');
  T.statuses = { guard: 2 }; T.statusAmt = { guard: 1 }; T.hp = 7;
  attack('C', 'T');
  assert.equal(T.statuses.guard, undefined);
  assert.equal(T.hp, 5, '1 ×2 (คุ้มครองถูกลบก่อน)');
  assert.equal(K.hp, 4, 'สูบ 2 แล้วมิวสิคคาร์ทฟื้นคืน 1');
  assert.equal(C.hp, 6, 'สูบ 2 + ฟื้น 1');
  // คอนดักเตอร์เลือด 2 ยังกดได้ · เลือด 1 กดไม่ได้
  K.hp = 2; C.skillPoints = 8; K.skillPoints = 8;
  assert.equal(cos.destinySplit(engine, C, 'I').ok, true);
  K.hp = 1;
  assert.equal(cos.destinySplit(engine, C, 'I').ok, false);
});

test('Destiny สูบเลือดคอนดักเตอร์ไม่ทำให้ตาย (ค้างที่ 1)', () => {
  const { K, C, T } = setup();
  bond(K, C); song(K, C);
  K.hp = 2; C.skillPoints = 8; K.skillPoints = 8;
  engine.useSkill('C', 'ultimate', [], 'II');
  Math.random = () => 0.9;
  T.hp = 7; T.armor = 0;
  attack('C', 'T');
  assert.equal(K.alive, true);
  assert.ok(K.hp >= 1);
});

test('บทเพลงหมดเวลา: Destiny/Maestro ที่ค้างหายไปด้วย (ไม่ค้างไปบทเพลงรอบหน้า)', () => {
  const { K, C } = setup();
  bond(K, C); song(K, C);
  C.cosette.destiny = 'II'; C.cosette.follow = engine.roundNumber + 1;
  delete C.statuses.taktSong; // หมดเวลา (ไม่ได้พัง)
  cos.onRoundStartTick(engine, C);
  assert.equal(C.cosette.destiny, null);
  assert.equal(C.cosette.follow, 0);
  assert.equal(cos.publicState(engine, C).destiny, null);
});

test('บทเพลงพัง: คอนดักเตอร์เลือดเหลือ 1 -> มิวสิคคาร์ททุกคนเสียบทเพลง + สตั้น 2 · คอเซ็ตต์กลับร่างมนุษย์', () => {
  const { K, C, N } = setup();
  bond(K, C); bond(K, N);
  song(K, C); song(K, N);
  C.cosette.form = 'destiny'; C.cosette.destiny = 'II';
  K.hp = 1;
  assert.equal(takt.checkLowRevert(engine), 2);
  assert.equal(C.statuses.taktSong, undefined);
  assert.equal(N.statuses.taktSong, undefined);
  assert.equal(C.statuses.stun, 2); assert.equal(N.statuses.stun, 2);
  assert.equal(C.cosette.form, 'human');
  assert.equal(C.cosette.destiny, null);
  assert.deepEqual(cutscenes.filter((k) => /Low$/.test(k)), ['titanLow'], 'ต่างแบบพังพร้อมกัน = คลิปไททันคลิปเดียว');
  assert.equal(takt.canUseSkill(engine, K, 'ultimate', ['C']), false, 'เลือด 1 มอบบทเพลงไม่ได้');
});

test('บทเพลงพังเมื่อคอนดักเตอร์ตาย · พรมลิขิตระหว่างบทเพลงลงที่คอนดักเตอร์ 1 ไม่ตาย', () => {
  const { K, C } = setup();
  bond(K, C); song(K, C);
  C.cosette.form = 'destiny';
  K.hp = 2;
  const hp = C.hp;
  cos.onRoundStartTick(engine, C);
  assert.equal(C.hp, hp);
  assert.equal(K.hp, 1);
  cos.onRoundStartTick(engine, C);
  assert.equal(K.hp, 1, 'ไม่ตาย');
  K.hp = 3;
  engine.instantDeath(K, true);
  assert.equal(C.statuses.taktSong, undefined);
  assert.equal(C.statuses.stun, 2);
});

test('มิวสิคคาร์ท: จั่วเองครบ 5 ใบ 20% โชคลาภ (นับข้ามเทิร์น)', () => {
  const { K, C } = setup();
  bond(K, C); song(K, C);
  Math.random = () => 0.1;
  cos.onPlayerDraw(engine, C, 3);
  assert.equal(C.statuses.fortune, undefined);
  cos.onPlayerDraw(engine, C, 2);
  assert.equal(C.statuses.fortune, 1);
  assert.equal(C.cosette.draws, 0);
});

test('เปิดม่าน: คลิปขึ้นเฉพาะครบคู่ไม่ซ้ำแบบ · สั่งไททันล่อเป้าทั้งตีปกติและสกิล · สั่งเดสตินี่ตี 2 · คูลดาวน์ 5', () => {
  const { K, C, N, T, M } = setup();
  bond(K, N);
  assert.equal(takt.curtainActive(engine, K), false);
  assert.ok(!cutscenes.includes('taktCurtain'));
  bond(K, C);
  assert.equal(takt.curtainActive(engine, K), true);
  assert.ok(cutscenes.includes('taktCurtain'));
  const r = engine.roundNumber;
  assert.ok(takt.perform(engine, K, 'N'));
  assert.equal(titan.tauntActive(engine, N), true);
  // สกิลที่เล็งศัตรูคนอื่นถูกปิด — เล็งไททันได้
  assert.equal(titan.skillTargetBlocked(engine, M, ['T']), true);
  assert.equal(titan.skillTargetBlocked(engine, M, ['N']), false);
  assert.equal(titan.skillTargetBlocked(engine, M, ['M']), false);
  Math.random = () => 0.9;
  N.hp = 7; N.armor = 0;
  attack('M', 'T');
  assert.equal(N.hp < 7, true, 'ตีปกติถูกดึงไปที่ไททัน');
  assert.equal(takt.perform(engine, K, 'N'), null, 'คูลดาวน์');
  // สั่งเดสตินี่
  T.hp = 7; T.armor = 0;
  const res = takt.perform(engine, K, 'C', 'T');
  assert.ok(res && res.after);
  res.after();
  assert.equal(T.hp, 5);
  engine.setRoundNumber(r + 5);
  C.statuses.stun = 1;
  assert.equal(takt.perform(engine, K, 'C', 'T'), null, 'คู่พันธะติดสตั้นสั่งไม่ได้');
  C.statuses.stun = 0; K.statuses.stun = 1;
  assert.equal(takt.perform(engine, K, 'C', 'T'), null, 'ทักต์ติดสตั้นสั่งไม่ได้');
  K.statuses.stun = 0;
  assert.ok(takt.perform(engine, K, 'C', 'T'));
});

test('บรรเลง: ใช้ได้ตั้งแต่คู่พันธะคนเดียว · ซ้ำแบบได้ คูลดาวน์แยกรายคน · คลิปเปิดม่านไม่ขึ้น', () => {
  const { K, N } = setup();
  engine.players.N2 = blank('N2', 'titan', 6);
  const N2 = engine.players.N2;
  N2.statuses = {}; N2.statusAmt = {}; N2.hp = 7; N2.armor = 3; titan.resetCombat(N2); takt.resetCombat(N2); cos.resetCombat(N2);
  bond(K, N);
  assert.ok(takt.perform(engine, K, 'N'), 'คู่พันธะคนเดียวก็สั่งได้');
  bond(K, N2);
  assert.equal(takt.curtainActive(engine, K), false);
  assert.ok(!cutscenes.includes('taktCurtain'));
  assert.equal(takt.perform(engine, K, 'N'), null, 'N ติดคูลดาวน์');
  assert.ok(takt.perform(engine, K, 'N2'), 'N2 คูลดาวน์แยก');
  assert.equal(takt.publicState(engine, K).perform.length, 2);
});

test('เพลง takt_theme: เล่นระหว่างมีบทเพลง · ได้บทเพลงเพิ่มอีกคนไม่เริ่มใหม่ · ดับหมดแล้วหยุด', () => {
  const { K, C, N } = setup();
  bond(K, C); bond(K, N);
  assert.equal(takt.activeMusic(engine), null);
  song(K, C); C.transformAt = 10;
  const m1 = takt.activeMusic(engine);
  assert.equal(m1.music, 'takt_theme');
  song(K, N); N.transformAt = 20;
  assert.equal(takt.activeMusic(engine).at, m1.at, 'ไม่เริ่มเพลงใหม่');
  delete C.statuses.taktSong;
  assert.equal(takt.activeMusic(engine).at, m1.at, 'ยังมีอีกคน เพลงต่อเนื่อง');
  delete N.statuses.taktSong;
  assert.equal(takt.activeMusic(engine), null);
});

test('ทักต์หลายคน: แย่งมิวสิคคาร์ทที่ผูกกับทักต์อื่นไม่ได้ · กลุ่มพันธะแยกกัน · บทเพลงพังเฉพาะของตัวเอง', () => {
  const { K, C, N, T } = setup();
  engine.players.K2 = blank('K2', 'takt', 6);
  const K2 = engine.players.K2;
  K2.statuses = {}; K2.statusAmt = {}; K2.hp = 5; K2.armor = 0; K2.skillPoints = 8;
  takt.resetCombat(K2); titan.resetCombat(K2); cos.resetCombat(K2);
  assert.equal(CHARACTERS.CHAR_BY_ID.takt.unique, undefined, 'เลือกซ้ำได้');
  bond(K, C);
  assert.equal(takt.invite(engine, K2, 'C'), false, 'C ผูกกับ K แล้ว');
  // คำเชิญค้างของ K กันไม่ให้ K2 แทรก
  takt.invite(engine, K, 'N');
  assert.equal(takt.invite(engine, K2, 'N'), false);
  takt.answerInvite(engine, N, false);
  engine.setRoundNumber(engine.roundNumber + 1);
  bond(K2, N);
  assert.equal(N.taktBondBy, 'K2');
  assert.equal(engine.sameTeam(K, C), true);
  assert.equal(engine.sameTeam(K2, N), true);
  assert.equal(engine.sameTeam(K, K2), false, 'ทักต์คนละกลุ่มไม่ใช่พวก');
  assert.equal(engine.sameTeam(C, N), false);
  assert.equal(takt.bondGroupWins(engine, [K, C, K2, N]), false);
  // ท่าไม้ตายของ K มอบให้มิวสิคคาร์ทของ K2 ไม่ได้
  assert.equal(takt.canUseSkill(engine, K, 'ultimate', ['N']), false);
  song(K, C); song(K2, N);
  K.hp = 1;
  takt.checkLowRevert(engine);
  assert.equal(C.statuses.taktSong, undefined);
  assert.equal(N.statuses.taktSong, 5, 'บทเพลงของพันธะ K2 ไม่พัง');
  assert.ok(T);
});

test('คลิปบทเพลงพัง: แบบเดียวกันพังพร้อมกันเล่นครั้งเดียว · พังแยกจังหวะเล่นทุกครั้ง', () => {
  const { K, C } = setup();
  engine.players.C2 = blank('C2', 'cosette', 6);
  const C2 = engine.players.C2;
  C2.statuses = {}; C2.statusAmt = {}; C2.hp = 7; C2.armor = 3; titan.resetCombat(C2); takt.resetCombat(C2); cos.resetCombat(C2);
  bond(K, C); bond(K, C2);
  song(K, C); song(K, C2);
  K.hp = 1;
  takt.checkLowRevert(engine);
  assert.deepEqual(cutscenes.filter((k) => /Low$/.test(k)), ['cosetteLow'], 'คอเซ็ตต์ 2 คน = คลิปเดียว');
  // พังแยกจังหวะ: ได้บทเพลงใหม่แล้วพังอีกรอบ = เล่นอีกครั้ง
  K.hp = 5; song(K, C);
  K.hp = 1;
  takt.checkLowRevert(engine);
  assert.deepEqual(cutscenes.filter((k) => /Low$/.test(k)), ['cosetteLow', 'cosetteLow']);
});
