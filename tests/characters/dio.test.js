// ดิโอ แบรนโด (Stardust) — characters/dio.js ผ่าน engine จริง
//  เกจเวลา · Vampire (ดูดเลือด + กลางวัน/กลางคืน + Last stand) · Throwing knife · Barrage · Za warudo / THE WORLD
//  คลิปสุ่ม (Barrage 1/2 · Za warudo 1/3) · คลิปมีดครั้งแรกต่อเกม · เลือกเป้ารายหมัด · ชุดหยุดเวลา 1 ครั้งต่อ THE WORLD
//  เป้าหมายใช้ temari / kai (ไม่มีการหลบแบบสุ่ม — กับดัก #6)
process.env.JOURNEY_START_SECONDS = '0';
const test = require('node:test');
const assert = require('node:assert/strict');
const { engine, resolveRound } = require('../../server.js');
const dio = require('../../characters/dio.js');
const CHARACTERS = require('../../characters.js');

const realRandom = Math.random;
const blank = (id, characterId, position) => ({
  id, name: id, position, characterId, alive: true, connected: true, cards: [], statuses: {}, statusAmt: {},
  seen: {}, cutsceneShown: {}, inventory: [], teamId: null,
});
function setup(extra) {
  for (const id of Object.keys(engine.players)) delete engine.players[id];
  engine.players.D = blank('D', 'dio', 1);
  engine.players.T = blank('T', 'temari', 2);
  engine.players.K = blank('K', 'kai', 3);
  if (extra) engine.players[extra.id] = blank(extra.id, extra.characterId, 4);
  engine.setGameMode('ffa');
  engine.setCycleShift(0);
  engine.startMatch();
  engine.clearPhaseTimer();
  engine.setGameState('PLAYING');
  engine.setRoundNumber(5);
  for (const p of Object.values(engine.players)) {
    p.locked = false; p.skillPoints = 8; p.skillUsedRound = false; p.cards = []; p.busted = false;
    p.hp = engine.maxHpOf(p); p.armor = engine.maxArmorOf(p); p.shield = 0; p.tempHp = 0;
    p.statuses = {}; p.statusAmt = {}; p.evadeStacks = []; p.nightTaxTier = null;
  }
  cutscenes.length = 0;
  return engine.players;
}
// รอบกลางวัน/กลางคืนตามกติกาจริงของเกม (ไม่เดาเลขรอบเอง)
const dayRound = () => [5, 1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 12].find((r) => !engine.isNightRound(r));
const nightRound = () => [5, 1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 12].find((r) => engine.isNightRound(r));
const card = (v) => ({ value: v, color: 'red' });
function attack(byId, targetId) {
  engine.setGameState('ATTACK');
  engine.setAttackerId(byId);
  engine.doAttack(byId, targetId);
  engine.clearPhaseTimer();
}
const saved = { triggerCutscene: engine.triggerCutscene, queueCutscene: engine.queueCutscene, notifyTransform: engine.notifyTransform, skillFlash: engine.skillFlash, sfx: engine.sfx };
const cutscenes = [];
const notices = [];
test.before(() => {
  engine.triggerCutscene = (p, k) => cutscenes.push(k);
  engine.queueCutscene = (p, k) => cutscenes.push(k);
  engine.notifyTransform = (p, k) => notices.push(k);
  engine.skillFlash = () => {};
  engine.sfx = () => {};
});
test.after(() => { Object.assign(engine, saved); for (const id of Object.keys(engine.players)) delete engine.players[id]; engine.setCycleShift(0); });
test.afterEach(() => { Math.random = realRandom; engine.clearPhaseTimer(); cutscenes.length = 0; notices.length = 0; engine.setCycleShift(0); });

// ---------------------------------------------------------------- ข้อมูล
test('ข้อมูล: กลาง · พลังชีวิต 6 เกราะ 4 · ราคา 3/3/0 · ชุดหยุดเวลาราคา 0 · คลิปทุกตัวคิวเอง', () => {
  const c = CHARACTERS.CHAR_BY_ID.dio;
  assert.equal(c.difficulty, 'medium');
  assert.deepEqual([c.basic.cost, c.secondary.cost, c.ultimate.cost], [3, 3, 0]);
  assert.deepEqual([c.basic2.name, c.secondary2.name, c.ultimate2.name], ['SHINEI!', 'Barrage', 'Road Roller']);
  const { D } = setup();
  assert.equal(engine.maxHpOf(D), 6);
  assert.equal(engine.maxArmorOf(D), 4);
  assert.equal(D.skillPoints, 8); // setup() ตั้งเอง — ค่าเริ่มเกมจริงคือ 0 (resetCombat กลาง)
  for (const k of ['dioKnifeAim', 'dioKnifeThrow', 'dioBarrage', 'dioBarrage2', 'dioWorld1', 'dioWorld2', 'dioWorld3', 'dioShine', 'dioRoadRoller', 'dioLastStand', 'dioLastStandFail']) {
    assert.ok(engine.TRANSFORMS[k] && engine.TRANSFORMS[k].video, `ต้องมีคลิป ${k}`);
    assert.equal(engine.TRANSFORMS[k].afterReveal, false);
  }
});

// ---------------------------------------------------------------- เกจเวลา
test('เกจเวลา: ไม่แตก +1 · 21 พอดี +2 · แตก -2 (ไม่ต่ำกว่า 0) · เพดาน 6', () => {
  const { D } = setup();
  D.cards = [card(9), card(9)];
  dio.onRoundResolved(engine);
  assert.equal(dio.meterOf(D), 1);
  D.cards = [card(10), card(9), card(2)];
  dio.onRoundResolved(engine);
  assert.equal(dio.meterOf(D), 3, '21 พอดีได้ +2');
  D.cards = [card(10), card(10), card(5)];
  dio.onRoundResolved(engine);
  assert.equal(dio.meterOf(D), 1, 'ไพ่แตก -2');
  dio.onRoundResolved(engine);
  assert.equal(dio.meterOf(D), 0, 'ไม่ต่ำกว่า 0');
  D.cards = [card(10), card(9), card(2)];
  for (let i = 0; i < 5; i++) dio.onRoundResolved(engine);
  assert.equal(dio.meterOf(D), 6, 'ตันที่ 6');
});

test('[integration] เกจเวลาคิดตอนสรุปรอบจริง (resolveRound)', () => {
  const { D, T, K } = setup();
  Math.random = () => 0.99; // กัน Overload Force
  D.cards = [card(10), card(9), card(2)];
  T.cards = [card(10), card(8)];
  K.cards = [card(5)];
  resolveRound();
  assert.equal(dio.meterOf(D), 2);
});

// ---------------------------------------------------------------- Vampire
test('Vampire กลางวัน: โดนสกิลศัตรู ดาเมจ +1 ทุกครั้ง · ไม่นับดาเมจจากสถานะ', () => {
  const { D, T } = setup();
  engine.setRoundNumber(dayRound());
  D.armor = 0;
  engine.withEffectSource(T, () => engine.dealMixed(D, 1));
  assert.equal(D.hp, 4, '1 + 1 กลางวัน');
  D._statusDamage = true;
  engine.dealMixed(D, 1);
  D._statusDamage = false;
  assert.equal(D.hp, 3, 'ดาเมจสถานะไม่ถูกบวก');
});

test('Vampire กลางคืน: โดนตีปกติ ดาเมจ -1 (ไม่ต่ำกว่า 0) + การ์ดสรุปการโจมตีบอกผล', () => {
  const { D } = setup();
  engine.setRoundNumber(nightRound());
  D.armor = 0;
  attack('T', 'D');
  assert.equal(D.hp, 6, 'หมัด 1 - 1 = 0');
  const names = (engine.lastAttack && engine.lastAttack.skills || []).map((s) => s.name).join(' | ');
  assert.match(names, /Vampire \(กลางคืน\)/);
});

test('Vampire: ตีปกติโดน ฟื้นพลังชีวิต 1', () => {
  const { D, T } = setup();
  engine.setRoundNumber(dayRound());
  D.hp = 3;
  attack('D', 'T');
  assert.equal(D.hp, 4);
  assert.ok(T.armor < engine.maxArmorOf(T) || T.hp < engine.maxHpOf(T), 'เป้าโดนจริง');
});

// ---------------------------------------------------------------- Throwing knife
test('Throwing knife: ดาเมจ 1 (ลดเกราะก่อน) + เลือดไหล 1 + ดูดเลือด 1 · คูลดาวน์ 2 เทิร์น', () => {
  const { D, T } = setup();
  D.hp = 3;
  const armorBefore = T.armor;
  engine.useSkill('D', 'basic', ['T']);
  assert.equal(T.armor, armorBefore - 1, 'ลดเกราะก่อน');
  assert.equal(T.statuses.hbleed, 1);
  assert.equal(D.hp, 4, 'Vampire ฟื้น 1');
  assert.equal(D.skillPoints, 5, 'ราคา 3');
  assert.deepEqual(cutscenes, ['dioKnifeAim', 'dioKnifeThrow'], 'ไม่ได้ง้างผ่านปุ่ม = เล่นสองคลิปต่อกัน');
  assert.equal(dio.cooldownLeft(engine, D, 'basic'), 3);
  for (const [r, ok] of [[6, false], [7, false], [8, true]]) {
    engine.setRoundNumber(r);
    assert.equal(dio.canUseSkill(engine, D, 'basic'), ok, `เทิร์น ${r}`);
  }
});

test('Throwing knife: ง้างผ่านปุ่ม (aimKnife) เล่นคลิปง้างครั้งเดียว แล้วเลือกเป้าเล่นแค่คลิปขว้าง', () => {
  const { D } = setup();
  assert.equal(dio.aimKnife(engine, D), true);
  assert.equal(dio.aimKnife(engine, D), false, 'ง้างซ้ำในเทิร์นเดียวกันไม่เล่นคลิปอีก');
  assert.deepEqual(cutscenes, ['dioKnifeAim']);
  engine.setGameState('PLAYING');
  engine.useSkill('D', 'basic', ['K']);
  assert.deepEqual(cutscenes, ['dioKnifeAim', 'dioKnifeThrow']);
  D.skillPoints = 0;
  engine.setRoundNumber(20);
  D.skillUsedRound = false;
  assert.equal(dio.aimKnife(engine, D), false, 'แต้มไม่พอ = ไม่เล่นคลิป');
});

test('Throwing knife: คลิปเล่นครั้งแรกต่อเกมเท่านั้น — ครั้งต่อไปเป็นการ์ดแจ้งเตือน ไม่มีคลิป', () => {
  const { D } = setup();
  engine.useSkill('D', 'basic', ['T']);
  assert.deepEqual(cutscenes, ['dioKnifeAim', 'dioKnifeThrow']);
  assert.deepEqual(notices, []);
  cutscenes.length = 0;
  engine.setRoundNumber(engine.roundNumber + 3);
  engine.setGameState('PLAYING');
  D.skillUsedRound = false;
  const sp = D.skillPoints;
  engine.useSkill('D', 'basic', ['K']);
  assert.equal(D.skillPoints, sp - 3, 'สกิลยังทำงาน');
  assert.deepEqual(cutscenes, [], 'ไม่มีคลิปครั้งที่สอง');
  assert.deepEqual(notices, ['dioKnifeThrow']);
  // แมตช์ใหม่ = เล่นได้อีก (cutsceneShown ล้างที่ resetCombat)
  setup();
  engine.useSkill('D', 'basic', ['T']);
  assert.deepEqual(cutscenes, ['dioKnifeAim', 'dioKnifeThrow']);
});

test('Throwing knife: ง้างผ่านปุ่มหลังครั้งแรกของเกม = ไม่เล่นคลิปง้าง ไม่พักเฟส', () => {
  const { D } = setup();
  assert.equal(dio.aimKnife(engine, D), true, 'ครั้งแรกของเกม');
  engine.setGameState('PLAYING');
  engine.useSkill('D', 'basic', ['T']);
  assert.deepEqual(cutscenes, ['dioKnifeAim', 'dioKnifeThrow']);
  cutscenes.length = 0;
  engine.setRoundNumber(engine.roundNumber + 3);
  engine.setGameState('PLAYING');
  D.skillUsedRound = false;
  assert.equal(dio.aimKnife(engine, D), false, 'ครั้งต่อไป socket ไม่ต้องพักเฟส');
  assert.equal(engine.gameState, 'PLAYING');
  engine.useSkill('D', 'basic', ['K']);
  assert.deepEqual(cutscenes, []);
  assert.deepEqual(notices, ['dioKnifeThrow']);
});

test('Throwing knife: ต้องเลือกเป้าศัตรู — ไม่เลือก/เลือกตัวเอง = ไม่เสียแต้ม', () => {
  const { D } = setup();
  engine.useSkill('D', 'basic');
  engine.useSkill('D', 'basic', ['D']);
  assert.equal(D.skillPoints, 8);
  assert.equal(D.skillUsedRound, false);
});

// ---------------------------------------------------------------- Barrage
test('Barrage: 1 × 2 เป้าเดียว (ส่งมาเป้าเดียว = ทุกหมัดลงคนนั้น) + ผุพัง 2 เทิร์น · คลิปเดียว · คูลดาวน์ 3', () => {
  const { D, K } = setup();
  Math.random = () => 0;
  K.armor = 1;
  const hp = K.hp;
  engine.useSkill('D', 'secondary', ['K']);
  assert.equal(K.armor, 0);
  assert.equal(K.hp, hp - 1, 'หมัดที่สองทะลุเข้าเลือด');
  assert.equal(K.statuses.decay, 2);
  assert.deepEqual(cutscenes, ['dioBarrage']);
  assert.equal(dio.cooldownLeft(engine, D, 'secondary'), 4);
});

test('Barrage: คลิปสุ่ม 1 จาก 2 ทุกครั้งที่กด (ไม่เล่นต่อกัน)', () => {
  for (const [r, clip] of [[0, 'dioBarrage'], [0.49, 'dioBarrage'], [0.5, 'dioBarrage2'], [0.999, 'dioBarrage2']]) {
    setup();
    Math.random = () => r;
    engine.useSkill('D', 'secondary', ['K']);
    assert.deepEqual(cutscenes, [clip], `random ${r}`);
  }
});

test('Barrage: เลือกเป้ารายหมัด — คนละคนได้ · ทุกคนที่โดนติดผุพัง · Vampire ครั้งเดียว', () => {
  const { D, T, K } = setup();
  D.hp = 3;
  T.armor = 0; K.armor = 0;
  const th = T.hp, kh = K.hp;
  engine.useSkill('D', 'secondary', ['T', 'K']);
  assert.equal(T.hp, th - 1);
  assert.equal(K.hp, kh - 1);
  assert.equal(T.statuses.decay, 2);
  assert.equal(K.statuses.decay, 2);
  assert.equal(D.hp, 4, 'Vampire 1 ครั้งต่อการกด ไม่ใช่ต่อเป้า');
  assert.equal(D.skillPoints, 5);
});

test('Barrage: id ที่เล็งไม่ได้ใช้เป้าที่ถูกต้องแทน · ไม่มีเป้าที่ถูกต้องเลย = กดไม่ได้ ไม่เสียแต้ม', () => {
  const { D, T, K } = setup();
  T.armor = 0; K.armor = 0;
  const th = T.hp, kh = K.hp;
  engine.useSkill('D', 'secondary', ['D', 'T']);
  assert.equal(T.hp, th - 2, 'หมัดแรกเล็งตัวเอง -> ใช้เป้าที่ถูกต้องคนแรก');
  assert.equal(K.hp, kh);
  const P = setup();
  engine.useSkill('D', 'secondary', ['D', 'nobody']);
  assert.equal(P.D.skillPoints, 8);
  assert.equal(P.D.skillUsedRound, false);
  const picks = dio.prepareTarget(engine, P.D, ['K', 'D'], 'secondary');
  assert.deepEqual(picks.map((x) => x.id), ['K', 'K'], 'หมัดหลังผิด = ใช้เป้าก่อนหน้า');
  assert.equal(dio.prepareTarget(engine, P.D, ['T', 'K'], 'basic').id, 'T', 'ท่าหมัดเดียวคืนเป้าเดียว');
});

// ---------------------------------------------------------------- Za warudo / THE WORLD
function startWorld(meter) {
  const P = setup();
  P.D.dio.meter = meter;
  engine.setTimeLeft(37);
  engine.useSkill('D', 'ultimate');
  engine.setGameState('PLAYING');
  return P;
}

test('Za warudo: ต้องมีเกจ 1 ขึ้นไป · ไม่ใช้แต้มสกิล · ใช้เกจทั้งหมดเป็นแอคชัน · นาฬิกา 10 วิ · คลิปสุ่ม 1 จาก 3', () => {
  const { D } = setup();
  engine.useSkill('D', 'ultimate');
  assert.equal(dio.worldOn(D), false, 'เกจ 0 กดไม่ได้');
  Math.random = () => 0;
  const P = startWorld(5);
  assert.equal(P.D.dio.world.actions, 5);
  assert.equal(dio.meterOf(P.D), 0);
  assert.equal(P.D.skillPoints, 8, 'ไม่ใช้แต้มสกิล');
  assert.equal(engine.timeLeft, dio.WORLD_SECONDS);
  assert.deepEqual(cutscenes, ['dioWorld1']);
  assert.equal(engine.displayImg(P.D), dio.IMG.timestop);
  assert.equal(dio.cooldownLeft(engine, P.D, 'ultimate'), 5);
});

test('THE WORLD: คนอื่นถูกแช่ — จั่ว/เปิดไพ่/สกิล/ไอเทมไม่ได้ · ดิโอเองจั่ว/เปิดไพ่ไม่ได้', () => {
  const { D, T, K } = startWorld(6);
  engine.setCentralDeck(Array.from({ length: 30 }, () => card(2)));
  const tc = T.cards.length;
  engine.hit('T');
  engine.lock('K');
  assert.equal(T.cards.length, tc, 'จั่วไม่ได้');
  assert.equal(K.locked, false, 'เปิดไพ่ไม่ได้');
  const sp = K.skillPoints;
  engine.useSkill('K', 'basic', ['T']);
  assert.equal(K.skillPoints, sp, 'กดสกิลไม่ได้');
  assert.equal(dio.itemBlocked(engine), true);
  const dc = D.cards.length;
  engine.hit('D');
  engine.lock('D');
  assert.equal(D.cards.length, dc);
  assert.equal(D.locked, false);
  // checkAllLocked ไม่สรุปรอบระหว่าง THE WORLD แม้คนอื่นเปิดไพ่หมดแล้ว
  T.locked = true; K.locked = true;
  engine.checkAllLocked();
  assert.equal(engine.gameState, 'PLAYING');
  const v = engine.buildStateFor('T');
  assert.equal(v.dioWorld.frozen, true);
  assert.equal(engine.buildStateFor('D').dioWorld.frozen, false);
  assert.equal(engine.buildStateFor('D').dioWorld.actions, 6);
});

test('THE WORLD: ไรเดอร์ที่ Clock Up อยู่ก็ถูกแช่ (กด Clock Up สวนไม่ได้)', () => {
  const P = setup({ id: 'Z', characterId: 'daisuke' });
  const Z = P.Z;
  Z.zectCassOff = true; Z.zectClockUp = true; Z.locked = true; // เปิดไพ่ไปแล้ว — ไม่ได้แช่สนามอยู่
  P.D.dio.meter = 4;
  engine.useSkill('D', 'ultimate');
  engine.setGameState('PLAYING');
  assert.equal(dio.worldOn(P.D), true);
  Z.locked = false;
  const sp = Z.skillPoints;
  engine.useSkill('Z', 'secondary');
  assert.equal(Z.skillPoints, sp);
  assert.equal(dio.actionBlocked(engine, Z), true);
});

test('THE WORLD: SHINEI! 3 แอคชัน — ดาเมจ 2 + ไร้ทางเยียวยา 2 · ดูดเลือด · ไม่กินโควตา/แต้ม · 1 ครั้งต่อ THE WORLD', () => {
  const { D, T } = startWorld(6);
  D.hp = 2;
  assert.equal(D.skillUsedRound, true, 'Za warudo กินโควตาของเทิร์น');
  const pubs = engine.buildStateFor('D').players.find((x) => x.id === 'D').character;
  assert.deepEqual([pubs.basic.name, pubs.secondary.name, pubs.ultimate.name], ['SHINEI!', 'Barrage', 'Road Roller']);
  assert.equal(pubs.basic.cost, 0);
  T.armor = 0;
  const hp = T.hp;
  cutscenes.length = 0;
  engine.useSkill('D', 'basic', ['T']);
  assert.equal(T.hp, hp - 2);
  assert.equal(T.statuses.nohealing, 2);
  assert.equal(D.hp, 3, 'Vampire');
  assert.equal(D.dio.world.actions, 3);
  assert.equal(D.skillPoints, 8);
  assert.deepEqual(cutscenes, ['dioShine']);
  engine.setGameState('PLAYING');
  const hp2 = T.hp;
  engine.useSkill('D', 'basic', ['T']);
  assert.equal(D.dio.world.actions, 3, 'SHINEI! ซ้ำใน THE WORLD เดียวกันไม่ได้');
  assert.equal(T.hp, hp2);
  const locks = engine.buildStateFor('D').players.find((x) => x.id === 'D').skillLocks;
  assert.equal(locks.basic.locked, true, 'ปุ่ม SHINEI! ล็อก');
  assert.equal(locks.secondary.locked, false);
  assert.equal(locks.ultimate.locked, false);
  Math.random = () => 0;
  engine.useSkill('D', 'secondary', ['T']);
  assert.equal(dio.worldOn(D), false, 'ท่าอื่นยังกดต่อได้ (ไม่ติดโควตา) · แอคชันหมด = จบ');
});

test('THE WORLD: Barrage 3 แอคชัน — 1 × 3 + ผุพัง · แอคชันเหลือไม่พอ = THE WORLD จบ คืนเวลาเดิม', () => {
  const { D, K } = startWorld(4);
  K.armor = 0;
  const hp = K.hp;
  engine.useSkill('D', 'secondary', ['K']);
  assert.equal(K.hp, hp - 3);
  assert.equal(K.statuses.decay, 2);
  assert.equal(dio.worldOn(D), false, 'เหลือ 1 แอคชัน กดอะไรไม่ได้แล้ว');
  assert.equal(engine.timeLeft, 37, 'เวลาเฟสจั่วไพ่เดินต่อจากที่เหลือตอนกด');
});

test('THE WORLD: Road Roller ต้องมี 3 แอคชัน · 2 × 2 · ใช้แอคชันที่เหลือทั้งหมดแล้วจบทันที', () => {
  const P = startWorld(2);
  assert.equal(dio.worldOn(P.D), false, 'เกจ 2 = แอคชันไม่พอใช้ท่าใด จบทันที');
  const { D, T } = startWorld(6);
  T.armor = 0; T.hp = 7;
  engine.useSkill('D', 'ultimate', ['T']);
  assert.equal(T.hp, 3);
  assert.equal(dio.worldOn(D), false);
  assert.ok(cutscenes.includes('dioRoadRoller'));
  assert.equal(engine.timeLeft, 37);
});

test('THE WORLD: ครบ 10 วิ (resolveRound จากตัวจับเวลา) = จบ THE WORLD กลับเฟสจั่วไพ่ ไม่ใช่การเปิดไพ่', () => {
  const { D, T } = startWorld(6);
  T.cards = [card(5)];
  resolveRound();
  assert.equal(dio.worldOn(D), false);
  assert.equal(engine.gameState, 'PLAYING');
  assert.equal(engine.timeLeft, 37);
  assert.equal(T.locked, false, 'ยังไม่ได้สรุปรอบ');
});

test('THE WORLD: Road Roller ที่ 3 แอคชันพอดี · เลือกเป้ารายหมัด (คนละคน) · ดูดเลือดครั้งเดียว', () => {
  const { D, T, K } = startWorld(3);
  assert.equal(dio.worldOn(D), true);
  D.hp = 2;
  T.armor = 0; K.armor = 0;
  const th = T.hp, kh = K.hp;
  engine.useSkill('D', 'ultimate', ['T', 'K']);
  assert.equal(T.hp, th - 2);
  assert.equal(K.hp, kh - 2);
  assert.equal(D.hp, 3, 'Vampire 1 ครั้ง');
  assert.equal(dio.worldOn(D), false);
  assert.equal(engine.timeLeft, 37);
});

test('THE WORLD: Barrage เลือกเป้ารายหมัด — เป้าตายก่อนถึงหมัดถัดไปถูกข้าม (ไม่เปลี่ยนเป้า)', () => {
  const { D, T, K } = startWorld(6);
  K.armor = 0; K.hp = 1;
  T.armor = 0;
  const th = T.hp;
  engine.useSkill('D', 'secondary', ['K', 'K', 'T']);
  assert.equal(K.alive, false);
  assert.equal(T.hp, th - 1, 'หมัดที่ 2 (K ตายแล้ว) ข้าม · หมัดที่ 3 ลง T');
  assert.equal(T.statuses.decay, 2);
  assert.equal(D.dio.world.actions, 3);
  assert.equal(D.dio.world.used.secondary, true);
  assert.match(require('../../server/match.js').lastLog.join(' '), /ข้าม 1 หมัด/);
});

test('THE WORLD: Barrage 1 ครั้งต่อ THE WORLD · Za warudo ครั้งใหม่รีเซ็ตโควตา', () => {
  const { D, K } = startWorld(6);
  Math.random = () => 0;
  K.armor = 0; K.hp = 9;
  engine.useSkill('D', 'secondary', ['K']);
  engine.setGameState('PLAYING');
  assert.equal(D.dio.world.actions, 3);
  engine.useSkill('D', 'secondary', ['K']);
  assert.equal(D.dio.world.actions, 3, 'Barrage ซ้ำไม่ได้');
  assert.equal(K.hp, 6);
  engine.useSkill('D', 'basic', ['K']);
  assert.equal(dio.worldOn(D), false);
  // THE WORLD ครั้งใหม่ (พ้นคูลดาวน์) — ใช้ได้อีก
  engine.setRoundNumber(engine.roundNumber + 5);
  D.skillUsedRound = false;
  D.dio.meter = 6;
  engine.useSkill('D', 'ultimate');
  engine.setGameState('PLAYING');
  assert.equal(dio.worldOn(D), true);
  assert.deepEqual(D.dio.world.used, {});
  engine.useSkill('D', 'secondary', ['K']);
  assert.equal(D.dio.world.actions, 3, 'Barrage ใช้ได้อีกใน THE WORLD ใหม่');
});

test('THE WORLD: client ได้จำนวนหมัดที่ต้องเลือกเป้า (picks) ตามร่าง', () => {
  const P = setup();
  assert.deepEqual(engine.buildStateFor('D').players.find((x) => x.id === 'D').dio.picks, { basic: 1, secondary: 2, ultimate: 1 });
  P.D.dio.meter = 6;
  engine.useSkill('D', 'ultimate');
  engine.setGameState('PLAYING');
  assert.deepEqual(engine.buildStateFor('D').players.find((x) => x.id === 'D').dio.picks, { basic: 1, secondary: 3, ultimate: 2 });
});

test('THE WORLD: เกจ 1 = เข้า THE WORLD แล้วจบทันที (แอคชันไม่พอใช้ท่าใด)', () => {
  const { D } = startWorld(1);
  assert.equal(dio.worldOn(D), false);
  assert.equal(engine.timeLeft, 37);
});

// ---------------------------------------------------------------- Last stand
test('Last stand: สกิลศัตรูที่จะฆ่า -> ค้างที่ 1 · จองดวลเทิร์นหน้า · ครั้งเดียวต่อเกม', () => {
  const { D, T } = setup();
  engine.setRoundNumber(nightRound());
  D.armor = 1; D.hp = 2;
  engine.withEffectSource(T, () => { engine.dealMixed(D, 9); engine.resolveDamageAftermath(D); });
  assert.equal(D.alive, true);
  assert.equal(D.hp, 1);
  assert.equal(D.armor, 0, 'เกราะยังรับก่อนตามปกติ');
  assert.deepEqual(D.dio.lastStand, { attackerId: 'T', round: engine.roundNumber + 1, trigRound: engine.roundNumber, active: false });
  assert.ok(cutscenes.includes('dioLastStand'));
  // เทิร์นเดียวกันโดนซ้ำ (ก่อนถึงดวล) ยังค้างที่ 1
  engine.withEffectSource(T, () => { engine.dealMixed(D, 9); engine.resolveDamageAftermath(D); });
  assert.equal(D.alive, true);
  assert.equal(D.hp, 1);
  // ดวลจบไปแล้ว (ใช้ครั้งเดียวต่อเกม) — เทิร์นหลังโดนอีกทีตายจริง
  D.dio.lastStand = null;
  engine.setRoundNumber(engine.roundNumber + 2);
  engine.withEffectSource(T, () => { engine.dealMixed(D, 9); engine.resolveDamageAftermath(D); });
  assert.equal(D.alive, false);
});

test('Last stand: ดาเมจที่ทะลุเพดานมาได้ในเทิร์นที่ทำงาน (เช่นหมัดไม่สนการลดดาเมจ) ยังค้างที่ 1', () => {
  const { D, T } = setup();
  D.armor = 0; D.hp = 2;
  dio.triggerLastStand(engine, D, T);
  engine.loseHp(D); engine.loseHp(D); engine.loseHp(D);
  engine.resolveDamageAftermath(D);
  assert.equal(D.alive, true);
  assert.equal(D.hp, 1);
  // ตาข่ายท้ายเทิร์น (ไม่มีต้นตอดาเมจ) ก็ไม่ฆ่า
  D.hp = 0;
  engine.instantDeath(D);
  assert.equal(D.alive, true);
});

test('Last stand: โดนตอนเลือดเหลือ 1 ก็ทำงาน (ตีปกติ) · ดาเมจสถานะไม่ทำงาน', () => {
  const { D } = setup();
  engine.setRoundNumber(dayRound());
  D.armor = 0; D.hp = 1;
  D._statusDamage = true;
  engine.dealMixed(D, 1);
  D._statusDamage = false;
  engine.resolveDamageAftermath(D);
  assert.equal(D.alive, false, 'ดาเมจสถานะไม่เปิด Last stand');
  const P = setup();
  P.D.armor = 2; P.D.hp = 1;
  attack('T', 'D');
  assert.equal(P.D.alive, true);
  assert.equal(P.D.hp, 1);
  assert.ok(P.D.dio.lastStand, 'โดนตอนเลือด 1 = Last stand');
  const names = (engine.lastAttack.skills || []).map((s) => s.name).join(' | ');
  assert.match(names, /Last stand/);
});

test('Last stand: สังหารทันทีจากศัตรูก็ถูกกันไว้ (instantDeath)', () => {
  const { D, K } = setup();
  engine.withEffectSource(K, () => engine.instantDeath(D));
  assert.equal(D.alive, true);
  assert.equal(D.hp >= 1, true);
  assert.equal(D.dio.lastStand.attackerId, 'K');
});

function startDuel() {
  const P = setup();
  const { D, T } = P;
  D.hp = 1;
  dio.triggerLastStand(engine, D, T);
  engine.setRoundNumber(engine.roundNumber + 1);
  dio.onRoundStartAfterLoop(engine);
  return P;
}

test('Last stand: เทิร์นถัดไปเริ่มดวล — คนนอกถูกแช่ (ไพ่แตกบังคับ) · ไม่มีใครกดสกิล/ใช้ไอเทมได้', () => {
  const { D, T, K } = startDuel();
  assert.equal(dio.duelActive(engine), true);
  assert.equal(K.dioFrozen, true);
  assert.equal(engine.bustedOf(K), true);
  assert.equal(dio.actionBlocked(engine, K), true);
  assert.equal(dio.actionBlocked(engine, D), false);
  assert.equal(dio.actionBlocked(engine, T), false);
  assert.equal(dio.skillBlocked(engine, D, 'basic'), true);
  assert.equal(dio.skillBlocked(engine, T, 'basic'), true);
  assert.equal(dio.itemBlocked(engine), true);
  assert.equal(engine.buildStateFor('K').dioDuel.foeId, 'T');
});

test('Last stand: ชนะ (แต้มสูงกว่าไม่แตก) -> สูบพลังชีวิต 2 · ไม่มีดาเมจแพ้รอบปกติ', () => {
  const { D, T, K } = startDuel();
  T.hp = 5; K.hp = 7;
  D.cards = [card(10), card(9)];
  T.cards = [card(10), card(5)];
  resolveRound();
  assert.equal(T.hp, 3);
  assert.equal(D.hp, 3);
  assert.equal(D.alive, true);
  assert.equal(K.hp, 7, 'คนนอกไม่โดนดาเมจไพ่แตก');
  assert.equal(K.dioFrozen, false, 'ปลดแช่หลังดวล');
  assert.equal(dio.duelActive(engine), false);
});

test('Last stand: เสมอ = ดิโอแพ้ ตายทันที + คลิป Last Stand Fail', () => {
  const { D, T } = startDuel();
  D.cards = [card(10), card(8)];
  T.cards = [card(10), card(8)];
  resolveRound();
  assert.equal(D.alive, false);
  assert.ok(cutscenes.includes('dioLastStandFail'));
  assert.equal(T.alive, true);
});

test('Last stand: แตกทั้งคู่ = ดิโอแพ้', () => {
  const { D, T } = startDuel();
  D.cards = [card(10), card(10), card(5)];
  T.cards = [card(10), card(10), card(5)];
  resolveRound();
  assert.equal(D.alive, false);
});

test('Last stand: คู่ดวลตกรอบก่อนถึงเทิร์นดวล = ยกเลิก', () => {
  const { D, T, K } = setup();
  dio.triggerLastStand(engine, D, T);
  engine.instantDeath(T);
  assert.equal(D.dio.lastStand, null);
  engine.setRoundNumber(engine.roundNumber + 1);
  dio.onRoundStartAfterLoop(engine);
  assert.equal(dio.duelActive(engine), false);
  assert.equal(K.dioFrozen, false);
});
