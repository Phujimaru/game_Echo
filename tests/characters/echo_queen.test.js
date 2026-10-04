// Echo (echo_queen) — characters/echo_queen.js + เฟสย่อยตีฟรี server/phases/echoFreeHit.js ผ่าน engine จริง
//  ขยายร่าง/ราชินี/คูลดาวน์ · เพดานเลือด · คุ้มครองระดับ 1-4 · ล้างบัฟไม่โดน · Overwrite · ท่าไม้ตาย · ตีฟรี
//  (เลือกเป้า / สุ่มตอนเปิดไพ่-หมดเวลา / สตั้น-หลับตีไม่ได้ / นับเป็นโจมตีปกติ) · สังหาร 5% · ATK จากคิลสูงสุด +2 · unique
//  เป้าหมายใช้ temari / kai (ไม่มีการหลบแบบสุ่ม — กับดัก #6)
process.env.JOURNEY_START_SECONDS = '0';
const test = require('node:test');
const assert = require('node:assert/strict');
const { engine, resolveRound, computeAttackBase } = require('../../server.js');
const echo = require('../../characters/echo_queen.js');
const freeHit = require('../../server/phases/echoFreeHit.js');
const CHARACTERS = require('../../characters.js');
const { serverSource } = require('../serverSource');

const realRandom = Math.random;
const blank = (id, characterId, position) => ({
  id, name: id, position, characterId, alive: true, connected: true, cards: [], statuses: {}, statusAmt: {},
  seen: {}, cutsceneShown: {}, inventory: [], teamId: null,
});
const card = (v) => ({ value: v, color: 'red' });

function setup(list = [['E', 'echo_queen'], ['T', 'temari'], ['K', 'kai']]) {
  for (const id of Object.keys(engine.players)) delete engine.players[id];
  list.forEach(([id, cid], i) => { engine.players[id] = blank(id, cid, i + 1); });
  engine.setGameMode('ffa');
  engine.setCycleShift(0);
  engine.startMatch();
  engine.clearPhaseTimer();
  engine.setRoundNumber(1);
  engine.setGameState('PLAYING');
  for (const p of Object.values(engine.players)) {
    p.locked = false; p.skillPoints = 8; p.skillUsedRound = false; p.busted = false; p.cards = [card(5)];
    p.hp = engine.maxHpOf(p); p.armor = engine.maxArmorOf(p); p.shield = 0; p.tempHp = 0;
    p.statuses = {}; p.statusAmt = {}; p.evadeStacks = []; p.nightTaxTier = null; p.cutsceneShown = {};
  }
  return engine.players;
}
// ตั้งระดับขยายร่างตรงๆ (ไม่ผ่านสกิล)
function setLv(p, lv) { echo.resetCombat(p); p.echoQ.lv = lv; p.hp = engine.maxHpOf(p); }
// กดท่าไม้ตายจริง แล้วข้ามฉากเปิดตัว 12 วิ (เฟส CUTSCENE) กลับเข้าช่วงจั่วไพ่ — เทสต์ที่ต้องกดซ้ำในเทิร์นเดียว
function ult(id = 'E') {
  engine.useSkill(id, 'ultimate');
  if (engine.gameState === 'CUTSCENE') { engine.clearPhaseTimer(); engine.setGameState('PLAYING'); }
}
function ultOn(p) { setLv(p, 10); p.echoQ.ultFrom = engine.roundNumber; p.echoQ.ultUntil = engine.roundNumber + 4; }

const saved = {
  triggerCutscene: engine.triggerCutscene, queueCutscene: engine.queueCutscene, notifyTransform: engine.notifyTransform,
  skillFlash: engine.skillFlash, sfx: engine.sfx,
};
test.before(() => {
  engine.triggerCutscene = () => {};
  engine.queueCutscene = () => {};
  engine.notifyTransform = () => {};
  engine.skillFlash = () => {};
  engine.sfx = () => {};
});
test.after(() => {
  Object.assign(engine, saved);
  for (const id of Object.keys(engine.players)) delete engine.players[id];
  engine.setGameMode('ffa');
  engine.setCycleShift(0);
});
test.afterEach(() => { Math.random = realRandom; engine.clearPhaseTimer(); engine.setCycleShift(0); });

// ---------------------------------------------------------------- ข้อมูล
test('ข้อมูล: พิเศษ · unique · ชื่อ/สกิลภาษาไทย · ราคา 0/0/8 · ภาพหน้า · สกิลยังไม่มีภาพ · ลำดับในหน้าเลือกตัว', () => {
  const c = CHARACTERS.CHAR_BY_ID.echo_queen;
  assert.equal(c.name, 'Echo');
  assert.equal(c.difficulty, 'special');
  assert.equal(c.unique, true, 'เลือกได้แค่ 1 คนต่อเกม');
  assert.equal(CHARACTERS.publicRoster().find((r) => r.id === 'echo_queen').unique, true);
  assert.equal(c.img, '/characters/echo_queen/echo_queen_portrait.webp');
  assert.deepEqual([c.basic.name, c.secondary.name, c.ultimate.name], ['มหึมา', 'Overwrite', 'นี่มันเกมของฉัน']);
  assert.deepEqual([c.passive.name, c.passive2.name], ['เหล่าสหายตัวน้อยเอ๋ย', 'การกลืนกินระดับ EX']);
  assert.deepEqual([c.basic.cost, c.secondary.cost, c.ultimate.cost], [0, 0, 8]);
  for (const t of ['basic', 'secondary', 'ultimate']) assert.ok(!c[t].img, `${t}: ยังไม่มีภาพสกิล`);
  const sel = require('fs').readFileSync(require('path').join(__dirname, '../../client/src/screens/CharacterSelect.jsx'), 'utf8');
  assert.match(sel, /key: "special"[^\n]*"echo_queen"/);
});

test('เลือดเริ่ม 10 เกราะ 0 · เพดานเลือด = 10 + 2×ระดับ (สูงสุด 30)', () => {
  const { E } = setup();
  assert.equal(E.hp, 10);
  assert.equal(engine.maxArmorOf(E), 0);
  for (const [lv, max] of [[0, 10], [1, 12], [5, 20], [10, 30]]) { setLv(E, lv); assert.equal(engine.maxHpOf(E), max); }
});

// ---------------------------------------------------------------- มหึมา + ขยายร่าง
test('มหึมา: ราชินี 10 เทิร์น · ขยายร่าง +1 ทันที (เพดาน +2 ฟื้น 2) · +1 ทุกต้นเทิร์นถัดไป · เพดานระดับ 10', () => {
  const { E } = setup();
  Math.random = () => 0.99; // ไม่ติดต้านสถานะ
  engine.useSkill('E', 'basic');
  assert.equal(echo.levelOf(E), 1, 'ขยายร่าง +1 ทันทีตอนกด');
  assert.equal(engine.maxHpOf(E), 12);
  assert.equal(E.hp, 12, 'ฟื้นเลือด 2 พร้อมเพดานที่เพิ่ม');
  assert.equal(echo.queenTurnsLeft(engine, E), 10);
  assert.equal(E.skillPoints, 8, 'ราคา 0');
  for (let r = 2; r <= 10; r++) { engine.setRoundNumber(r); echo.onRoundStartTick(engine, E); }
  assert.equal(echo.levelOf(E), 10, 'ครบ 10 เทิร์นของราชินี = ระดับ 10 พอดี');
  assert.equal(engine.maxHpOf(E), 30);
  engine.setRoundNumber(11);
  assert.equal(echo.queenTurnsLeft(engine, E), 0, 'ราชินีหมดหลังเทิร์นที่ 10');
  echo.onRoundStartTick(engine, E);
  assert.equal(echo.levelOf(E), 10, 'ราชินีหมดแล้ว ระดับไม่ขึ้นแต่ก็ไม่หาย');
  // เพดานระดับ 10: ขึ้นต่อไม่ได้
  E.echoQ.queenFrom = 11; E.echoQ.queenUntil = 20;
  engine.setRoundNumber(12);
  echo.onRoundStartTick(engine, E);
  assert.equal(echo.levelOf(E), 10);
  assert.match(serverSource(), /CHAR_HOOKS\.echo_queen\.onRoundStartTick\(engine, p\)/, 'dealRound เรียกฮุคต้นเทิร์น');
});

test('มหึมา: คูลดาวน์ 12 เทิร์นนับจากตอนกด · กดซ้ำไม่ได้ระหว่างมีราชินี (แม้คูลดาวน์หมด)', () => {
  const { E } = setup();
  Math.random = () => 0.99;
  engine.useSkill('E', 'basic');
  assert.equal(echo.basicCooldownLeft(engine, E), 12);
  engine.setRoundNumber(2); E.skillUsedRound = false;
  engine.useSkill('E', 'basic');
  assert.equal(E.echoQ.queenFrom, 1, 'ราชินียังอยู่ กดซ้ำไม่ได้');
  // คูลดาวน์หมดแต่ราชินียังอยู่ (ตั้งเลขรอบคูลดาวน์ให้หมดก่อน)
  E.echoQ.cdRound = 2;
  assert.equal(echo.canUseSkill(engine, E, 'basic'), false, 'ราชินียังอยู่ = กดไม่ได้');
  E.echoQ.cdRound = 13;
  engine.setRoundNumber(11);
  assert.equal(echo.queenActive(engine, E), false);
  assert.equal(echo.basicCooldownLeft(engine, E), 2);
  assert.equal(echo.canUseSkill(engine, E, 'basic'), false, 'ราชินีหมดแต่คูลดาวน์ยังเหลือ');
  engine.setRoundNumber(13); E.skillUsedRound = false;
  assert.equal(echo.canUseSkill(engine, E, 'basic'), true);
  engine.useSkill('E', 'basic');
  assert.equal(E.echoQ.queenFrom, 13, 'กดได้อีกครั้งที่เทิร์น 13');
  // ปุ่มฝั่ง client: skillLocks ชุดเดียวกัน
  const me = engine.buildStateFor('E').players.find((x) => x.id === 'E');
  assert.equal(me.skillLocks.basic.locked, true);
  assert.equal(me.skillLocks.basic.cd, 12);
});

test('ขยายร่าง/ราชินีล้าง-ต้าน-ปาดไม่ได้ (อยู่นอก p.statuses) · ต้านสถานะ 20% เป็นบัฟจริง 1 เทิร์น', () => {
  const { E } = setup();
  Math.random = () => 0.99;
  engine.useSkill('E', 'basic');
  const before = JSON.stringify(E.echoQ);
  engine.cleanseDebuffs(E);
  engine.stripLatestBuff(E);
  assert.equal(JSON.stringify(E.echoQ), before, 'ล้างดีบัฟ/ปาดบัฟไม่โดนขยายร่างและราชินี');
  assert.deepEqual(Object.keys(E.statuses).filter((k) => /echo|queen/i.test(k)), [], 'ไม่มีสถานะจริงของ Echo');
  engine.setRoundNumber(2);
  Math.random = () => 0.1;
  echo.onRoundStartTick(engine, E);
  assert.equal(E.statuses.resist, 1, 'โรลติด 20% = ต้านสถานะ 1 เทิร์น');
  delete E.statuses.resist;
  Math.random = () => 0.5;
  echo.onRoundStartTick(engine, E);
  assert.equal(E.statuses.resist, undefined);
});

// ---------------------------------------------------------------- สกิลติดตัว 1
test('คุ้มครองเฉพาะระดับ 1-4 = คุ้มครองปกติ (ลดเฉพาะโจมตีปกติ · หมัด 1 หน่วยเหลือ 0 โดยตั้งใจ) · ระดับ 0 และ 5+ ไม่มี', (t) => {
  t.mock.timers.enable({ apis: ['setInterval', 'setTimeout'] });
  try {
    const { E } = setup();
    Math.random = () => 0.99;
    for (const [lv, lost] of [[0, 1], [1, 0], [4, 0], [5, 1], [10, 1]]) {
      setLv(E, lv);
      const hp = E.hp;
      engine.setGameState('ATTACK'); engine.setAttackerId('T');
      engine.doAttack('T', 'E');
      engine.clearPhaseTimer();
      assert.equal(hp - E.hp, lost, `ระดับ ${lv}: โดนตีปกติ 1 เสีย ${lost}`);
    }
    // ดาเมจสกิล (ไม่ใช่โจมตีปกติ) ไม่ถูกลด
    setLv(E, 2);
    const hp = E.hp;
    engine.dealMixed(E, 2);
    assert.equal(hp - E.hp, 2, 'ดาเมจสกิลไม่โดนคุ้มครอง');
  } finally { t.mock.timers.reset(); }
});

test('พลังโจมตี: ระดับ 5 +1 · ระดับ 10 +2 (ผ่าน computeAttackBase)', () => {
  const { E, T } = setup();
  for (const [lv, base] of [[0, 1], [4, 1], [5, 2], [9, 2], [10, 3]]) {
    setLv(E, lv);
    assert.equal(computeAttackBase(engine, E, T).base, base, `ระดับ ${lv}`);
  }
});

// ---------------------------------------------------------------- Overwrite
test('Overwrite: ชุด = ระดับ/2 ปัดลง · คูลดาวน์มหึมา -1/ชุด · ATK +1/ชุด 2 เทิร์นนับเทิร์นที่กด · ล้างขยายร่าง+ราชินี', () => {
  const { E, T } = setup();
  Math.random = () => 0.99;
  engine.useSkill('E', 'basic'); // เทิร์น 1: ราชินี + คูลดาวน์ถึงเทิร์น 13
  E.echoQ.lv = 7; E.hp = engine.maxHpOf(E);
  engine.setRoundNumber(5); E.skillUsedRound = false;
  engine.useSkill('E', 'secondary');
  assert.equal(echo.levelOf(E), 0);
  assert.equal(echo.queenActive(engine, E), false, 'ราชินีถูกล้าง');
  assert.equal(E.echoQ.cdRound, 13 - 3, '7/2 = 3 ชุด (ปัดลง)');
  assert.equal(computeAttackBase(engine, E, T).base, 1 + 3, 'เทิร์นที่กดได้ ATK +3');
  engine.setRoundNumber(6);
  assert.equal(computeAttackBase(engine, E, T).base, 1 + 3, 'เทิร์นถัดไปยังได้');
  engine.setRoundNumber(7);
  assert.equal(computeAttackBase(engine, E, T).base, 1, 'หมดหลัง 2 เทิร์น');
  // ระดับ 1 = 0 ชุด: ไม่มี ATK ไม่ลดคูลดาวน์
  setLv(E, 1); E.echoQ.cdRound = 20; E.skillUsedRound = false;
  engine.useSkill('E', 'secondary');
  assert.equal(E.echoQ.cdRound, 20);
  assert.equal(echo.overwriteAtk(engine, E), 0);
});

test('Overwrite: เพดานกลับ 10 · เลือดเกินถูกตัดเหลือ 10 แล้วค่อยฟื้น 5', () => {
  const { E } = setup();
  setLv(E, 8); E.hp = 22; // เพดาน 26
  engine.useSkill('E', 'secondary');
  assert.equal(engine.maxHpOf(E), 10);
  assert.equal(E.hp, 10, 'ตัดเหลือ 10 (ฟื้น 5 เกินเพดานไม่ได้)');
  setLv(E, 6); E.hp = 3; E.skillUsedRound = false;
  engine.useSkill('E', 'secondary');
  assert.equal(E.hp, 8, 'เลือดไม่เกิน 10 = ฟื้น 5 ตามปกติ');
});

test('Overwrite กดไม่ได้ระหว่างท่าไม้ตาย (server + ปุ่ม)', () => {
  const { E } = setup();
  ultOn(E);
  engine.useSkill('E', 'secondary');
  assert.equal(echo.levelOf(E), 10, 'ไม่มีผล');
  const me = engine.buildStateFor('E').players.find((x) => x.id === 'E');
  assert.equal(me.skillLocks.secondary.locked, true);
});

// ---------------------------------------------------------------- ท่าไม้ตาย
test('ท่าไม้ตาย: ฟื้นเลือดตัวเอง 5 ทันทีตอนกด (ไม่เกินเพดาน · ไม่ใช้งานต่อกันได้)', () => {
  const { E } = setup();
  setLv(E, 10); E.hp = 20;
  ult();
  assert.equal(E.hp, 25, 'ฟื้น 5');
  setLv(E, 10); E.hp = 28; E.skillPoints = 8; E.skillUsedRound = false; E.cards = [card(5)];
  ult();
  assert.equal(E.hp, 30, 'ไม่เกินเพดาน 30');
  setLv(E, 10); E.hp = 20; E.skillPoints = 8; E.skillUsedRound = false;
  E.statuses.nohealing = 2;
  engine.setRoundNumber(3);
  ult();
  assert.equal(echo.ultActive(engine, E), true);
  assert.equal(E.hp, 20, 'ไม่ใช้งานต่อ = ฟื้นไม่ได้');
});

test('ท่าไม้ตาย: ต้องขยายร่าง 10 · 8 แต้ม · 5 เทิร์น · ระดับไม่หาย · ไพ่แตกไม่เป็นโมฆะ (ผลลงก่อนเปิดไพ่)', () => {
  const { E } = setup();
  setLv(E, 9);
  ult();
  assert.equal(echo.ultActive(engine, E), false, 'ระดับ 9 กดไม่ได้');
  assert.equal(E.skillPoints, 8);
  assert.equal(engine.buildStateFor('E').players.find((x) => x.id === 'E').skillLocks.ultimate.locked, true);
  setLv(E, 10);
  ult();
  assert.equal(echo.ultTurnsLeft(engine, E), 5);
  assert.equal(E.skillPoints, 0);
  assert.equal(echo.levelOf(E), 10, 'ระดับไม่หาย');
  engine.setRoundNumber(5);
  assert.equal(echo.ultTurnsLeft(engine, E), 1);
  engine.setRoundNumber(6);
  assert.equal(echo.ultActive(engine, E), false);
  // ไพ่แตกในเทิร์นที่กด
  engine.setRoundNumber(7); E.skillPoints = 8; E.skillUsedRound = false;
  ult();
  assert.equal(echo.ultActive(engine, E), true);
  const hp = E.hp;
  E.cards = [card(10), card(10), card(10)];
  engine.voidUltimateOnBust(E);
  assert.equal(echo.ultActive(engine, E), true, 'ไพ่แตกแล้วสนาม/ตีฟรียังอยู่');
  assert.equal(echo.ultTurnsLeft(engine, E), 5);
  assert.equal(E.hp, hp);
});

test('เพลงท่าไม้ตาย echo_queen_theme: เล่นตลอด 5 เทิร์น · กดใหม่เริ่มจากต้น · อยู่บนสุดของลำดับเพลง (ทับยูนะ/เอจิ/Overload Force)', () => {
  const { E } = setup();
  const music = (id = 'T') => engine.buildStateFor(id);
  assert.equal(music().skillMusic === 'echo_queen_theme', false, 'ยังไม่กด = ไม่มีเพลง');
  setLv(E, 10);
  ult();
  const s1 = music();
  assert.equal(s1.skillMusic, 'echo_queen_theme', 'ทุกคนได้ยิน');
  engine.setRoundNumber(5);
  assert.equal(music().skillMusic, 'echo_queen_theme', 'เทิร์นสุดท้ายของท่า');
  engine.setRoundNumber(6);
  assert.notEqual(music().skillMusic, 'echo_queen_theme', 'หมดท่า = เพลงหยุด');
  E.skillPoints = 8; E.skillUsedRound = false;
  ult();
  assert.ok(music().skillMusicSeq > s1.skillMusicSeq, 'กดใหม่ = seq ใหม่ (เพลงเริ่มจากต้น)');
  const src = require('fs').readFileSync(require('path').join(__dirname, '../../server/view.js'), 'utf8');
  const at = (s) => src.indexOf(s);
  assert.ok(at('let sm = echoQueenMusic ? echoQueenMusic') > 0, 'Echo เป็นเงื่อนไขแรกของ sm');
  assert.ok(at('let sm = echoQueenMusic') < at('match.overloadForceActive && match.gameState'), 'ก่อน Overload Force');
  assert.ok(at('let sm = echoQueenMusic') < at('YunaMod.YUNA_MUSIC[match.yunaEffect]'), 'ก่อนยูนะ');
});

test('ท่าไม้ตาย: พักช่วงจั่วไพ่เข้าฉากเปิดตัว (คัตซีน kind echoQueen ไม่มีคลิป ~12 วิ) แล้วกลับมาด้วยเวลาที่เหลือ · echoField ส่งให้ทุกคน', (t) => {
  t.mock.timers.enable({ apis: ['setInterval', 'setTimeout'] });
  try {
    const { E } = setup();
    setLv(E, 10);
    engine.startPhaseTimer(40, resolveRound);
    assert.equal(engine.buildStateFor('T').echoField, null);
    engine.useSkill('E', 'ultimate');
    assert.equal(engine.gameState, 'CUTSCENE');
    const cs = engine.buildStateFor('T').cutscene;
    assert.equal(cs.kind, 'echoQueen');
    assert.equal(cs.playerId, 'E');
    assert.ok(!cs.video, 'ไม่มีคลิป — client วาดเอง');
    const f = engine.buildStateFor('T').echoField;
    assert.equal(f.ownerId, 'E');
    assert.equal(f.turnsLeft, 5);
    tickTo(t, echo.INTRO_SECONDS - 1);
    assert.equal(engine.gameState, 'CUTSCENE', 'ยังอยู่ในฉาก');
    tickTo(t, 1.5);
    assert.equal(engine.gameState, 'PLAYING', 'กลับเข้าช่วงจั่วไพ่');
    assert.ok(engine.timeLeft >= 38, `เวลาที่เหลือคืนมา (${engine.timeLeft})`);
    engine.setRoundNumber(6);
    assert.equal(engine.buildStateFor('T').echoField, null, 'หมดท่า = ไม่มีสนาม (client เล่นฉากออก)');
  } finally { t.mock.timers.reset(); }
});

// ---------------------------------------------------------------- ตีฟรี
const tickTo = (t, sec) => t.mock.timers.tick(sec * 1000);

test('ตีฟรี: เลือกเป้าเอง = ตีทันทีช่วงจั่วไพ่ แล้วกลับเข้าเฟสจั่วไพ่ด้วยเวลาที่เหลือ (ไม่จบเทิร์น) · เทิร์นละครั้ง', (t) => {
  t.mock.timers.enable({ apis: ['setInterval', 'setTimeout'] });
  try {
    const { E, T } = setup();
    Math.random = () => 0.99;
    ultOn(E); T.armor = 0;
    engine.startPhaseTimer(40, resolveRound);
    const st0 = engine.buildStateFor('E').players.find((x) => x.id === 'E').echoQueen;
    assert.equal(st0.freeHitPending, true);
    assert.deepEqual(st0.freeHitTargets.sort(), ['K', 'T']);
    assert.equal(freeHit.pickFreeHit('E', 'T'), true);
    assert.equal(T.hp, 7 - 3, 'ระดับ 10: ATK 3');
    assert.equal(engine.gameState, 'ATTACKING', 'ฉากสรุปการโจมตีเล่นได้ตามปกติ');
    tickTo(t, engine.ATTACKFX_TIME + 3);
    assert.equal(engine.gameState, 'PLAYING', 'กลับเข้าเฟสจั่วไพ่');
    assert.equal(engine.roundNumber, 1, 'ไม่จบเทิร์น');
    assert.ok(engine.timeLeft >= 38, `เวลาที่เหลือคืนมา (${engine.timeLeft})`);
    assert.equal(engine.attackerId, null);
    const st1 = engine.buildStateFor('E').players.find((x) => x.id === 'E').echoQueen;
    assert.equal(st1.freeHitPending, false);
    assert.equal(st1.freeHitTarget, 'T');
    assert.equal(freeHit.pickFreeHit('E', 'K'), false, 'เทิร์นละครั้ง');
    // เทิร์นถัดไปได้อีก
    engine.setRoundNumber(2);
    assert.equal(echo.freeHitPending(engine, E), true);
  } finally { t.mock.timers.reset(); }
});

test('ตีฟรี: นับเป็นโจมตีปกติ — "คุ้มครอง" (ใช้กับตีปกติเท่านั้น) และหลบหลีกของเป้าทำงาน', (t) => {
  t.mock.timers.enable({ apis: ['setInterval', 'setTimeout'] });
  try {
    const { E, T, K } = setup();
    ultOn(E); T.armor = 0; K.armor = 0;
    T.statuses.guard = 1; T.statusAmt.guard = 1;
    Math.random = () => 0.99;
    engine.startPhaseTimer(40, resolveRound);
    freeHit.pickFreeHit('E', 'T');
    assert.equal(T.hp, 7 - 2, 'คุ้มครอง 1 ลดหมัด 3 เหลือ 2');
    assert.equal(T.wasAttacked, true);
    tickTo(t, engine.ATTACKFX_TIME + 3);
    // หลบหลีก 100%
    engine.setRoundNumber(2);
    engine.grantEvadeStack(K); K.statusAmt.evade = 100;
    Math.random = () => 0.5;
    freeHit.pickFreeHit('E', 'K');
    assert.equal(K.hp, engine.maxHpOf(K), 'หลบพ้น');
    tickTo(t, engine.ATTACKFX_TIME + 1);
    assert.equal(engine.gameState, 'PLAYING', 'ถูกหลบก็กลับเข้าเฟสจั่วไพ่');
    assert.equal(engine.roundNumber, 2);
  } finally { t.mock.timers.reset(); }
});

test('ตีฟรี: ไม่เลือกเป้า -> หมดเวลา/ทุกคนเปิดไพ่ (resolveRound) = สุ่มเป้าตีก่อนเปิดไพ่ แล้วค่อยสรุปรอบ', (t) => {
  t.mock.timers.enable({ apis: ['setInterval', 'setTimeout'] });
  try {
    const { E, T, K } = setup();
    ultOn(E); T.armor = 0; K.armor = 0;
    Math.random = () => 0.99; // สุ่มได้คนสุดท้ายของรายชื่อ
    resolveRound();
    assert.equal(engine.gameState, 'ATTACKING', 'ตีก่อน ยังไม่สรุปรอบ');
    const hit = [T, K].find((x) => x.hp < engine.maxHpOf(x));
    assert.ok(hit, 'มีคนโดนสุ่มตี');
    assert.equal(E.echoQ.freeHitTarget, hit.id);
    tickTo(t, engine.ATTACKFX_TIME + 3);
    assert.notEqual(engine.gameState, 'PLAYING', 'หมัดจบแล้วไปสรุปรอบต่อ');
    assert.notEqual(engine.gameState, 'ATTACKING');
  } finally { t.mock.timers.reset(); }
});

test('ตีฟรี: Echo กดเปิดไพ่โดยยังไม่เลือก = สุ่มเป้าตีก่อน แล้วค่อยเปิดไพ่', (t) => {
  t.mock.timers.enable({ apis: ['setInterval', 'setTimeout'] });
  try {
    const { E, T, K } = setup();
    ultOn(E); T.armor = 0; K.armor = 0;
    Math.random = () => 0.99;
    engine.startPhaseTimer(40, resolveRound);
    engine.lock('E');
    assert.equal(E.locked, false, 'ยังไม่เปิดไพ่ระหว่างหมัด');
    assert.equal(engine.gameState, 'ATTACKING');
    tickTo(t, engine.ATTACKFX_TIME + 3);
    assert.equal(E.locked, true, 'หมัดจบแล้วเปิดไพ่ต่อ');
    assert.equal(engine.gameState, 'PLAYING', 'คนอื่นยังไม่เปิดไพ่');
    assert.ok([T, K].some((x) => x.hp < engine.maxHpOf(x)));
  } finally { t.mock.timers.reset(); }
});

test('ตีฟรี: ติดสตั้นหรือหลับ = ตีไม่ได้ (ทั้งเลือกเองและสุ่มตอนเปิดไพ่)', () => {
  for (const key of ['stun', 'sleep']) {
    const { E, T, K } = setup();
    ultOn(E);
    E.statuses[key] = 1;
    assert.equal(echo.freeHitPending(engine, E), false);
    assert.equal(freeHit.pickFreeHit('E', 'T'), false);
    assert.equal(freeHit.runPendingBeforeReveal(() => {}), false, `${key}: ไม่สุ่มตีตอนเปิดไพ่`);
    assert.equal(T.hp, engine.maxHpOf(T));
    assert.equal(K.hp, engine.maxHpOf(K));
    engine.clearPhaseTimer();
  }
});

// ---------------------------------------------------------------- สังหาร 5% + การกลืนกิน
test('สังหาร 5% (ระดับ 10 · ใช้กับตีฟรี) · โรลไม่ติด = ตีปกติ · ระดับต่ำกว่า 10 ไม่มี', (t) => {
  t.mock.timers.enable({ apis: ['setInterval', 'setTimeout'] });
  try {
    const { E, T, K } = setup();
    ultOn(E);
    Math.random = () => 0.01;
    engine.startPhaseTimer(40, resolveRound);
    freeHit.pickFreeHit('E', 'T');
    assert.equal(T.alive, false, 'สังหารทันที');
    assert.equal(E.echoQ.killAtk, 1, 'การกลืนกินระดับ EX +1');
    tickTo(t, engine.ATTACKFX_TIME + 3);
    assert.equal(engine.gameState, 'PLAYING');
    // โรลไม่ติด
    engine.setRoundNumber(2);
    Math.random = () => 0.06;
    K.armor = 0;
    freeHit.pickFreeHit('E', 'K');
    assert.equal(K.alive, true);
    assert.ok(K.hp < engine.maxHpOf(K), 'โดนตีปกติ');
    tickTo(t, engine.ATTACKFX_TIME + 3);
    // ระดับ 9 ไม่มีโอกาสสังหาร
    E.echoQ.lv = 9;
    assert.equal(echo.onAttackKill(engine, E, K), false);
    assert.equal(engine.hasKillCapability(E), false);
    E.echoQ.lv = 10;
    assert.equal(engine.hasKillCapability(E), true);
  } finally { t.mock.timers.reset(); }
});

test('การกลืนกินระดับ EX: สังหารได้ ATK ถาวร +1 รวมสูงสุด +2 · นับคิลที่ตายตอนกวาดท้ายเทิร์นด้วย', () => {
  const { E, T } = setup([['E', 'echo_queen'], ['T', 'temari'], ['K', 'kai'], ['T2', 'temari'], ['K2', 'kai']]);
  for (const id of ['K', 'T2']) engine.withEffectSource(E, () => engine.instantDeath(engine.players[id]));
  assert.equal(E.echoQ.killAtk, 2);
  // ตีจนเลือดหมด -> ตายตอนกวาด (ไม่มี effectSource) — อ่านจากผู้ทำดาเมจล่าสุดในเทิร์นเดียวกัน
  const K2 = engine.players.K2;
  K2.armor = 0; K2.hp = 1;
  engine.withEffectSource(E, () => engine.dealMixed(K2, 1));
  engine.instantDeath(K2);
  assert.equal(K2.alive, false);
  assert.equal(E.echoQ.killAtk, 2, 'สูงสุด +2');
  assert.equal(computeAttackBase(engine, E, T).base, 1 + 2);
});

test('buildStateFor: ระดับ/ราชินี/ท่าไม้ตาย/ตีฟรีเห็นทุกคน · คูลดาวน์+เป้าตีฟรีเห็นเจ้าตัว', () => {
  setup();
  Math.random = () => 0.99;
  engine.useSkill('E', 'basic');
  const mine = engine.buildStateFor('E').players.find((x) => x.id === 'E').echoQueen;
  assert.equal(mine.lv, 1);
  assert.equal(mine.queenTurns, 10);
  assert.equal(mine.basicCd, 12);
  assert.equal(mine.ultTurns, 0);
  assert.equal(mine.freeHitPending, false);
  const theirs = engine.buildStateFor('T').players.find((x) => x.id === 'E').echoQueen;
  assert.equal(theirs.lv, 1);
  assert.equal(theirs.queenTurns, 10);
  assert.equal(theirs.basicCd, undefined);
  assert.equal(theirs.freeHitTargets, undefined);
});
