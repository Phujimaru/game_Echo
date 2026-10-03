// จอห์นนี่ โจสตาร์ (Tusk) — characters/johnny.js ผ่าน engine จริง · เป้าหมายใช้ temari/kai (ไม่มีหลบสุ่ม — กับดัก #6)
process.env.JOURNEY_START_SECONDS = '0';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { engine } = require('../../server.js');
const J = require('../../characters/johnny.js');
const CHARACTERS = require('../../characters.js');

const realRandom = Math.random;
const blank = (id, characterId, position) => ({
  id, name: id, position, characterId, alive: true, connected: true, cards: [], statuses: {}, statusAmt: {},
  seen: {}, cutsceneShown: {}, inventory: [], teamId: null,
});
function setup() {
  for (const id of Object.keys(engine.players)) delete engine.players[id];
  engine.players.J = blank('J', 'johnny', 1);
  engine.players.T = blank('T', 'temari', 2);
  engine.players.M = blank('M', 'kai', 3);
  engine.setGameMode('ffa');
  engine.startMatch();
  engine.clearPhaseTimer();
  engine.setGameState('PLAYING');
  for (const p of Object.values(engine.players)) {
    p.locked = false; p.skillPoints = 8; p.skillUsedRound = false; p.nightTaxTier = null;
    p.hp = engine.maxHpOf(p); p.armor = engine.maxArmorOf(p); p.shield = 0; p.statuses = {}; p.statusAmt = {}; p.evadeStacks = [];
  }
  return engine.players;
}
function nextRound(p) {
  engine.setRoundNumber(engine.roundNumber + 1);
  for (const x of Object.values(engine.players)) { x.skillUsedRound = false; x.skillPoints = 8; x.nightTaxTier = null; }
  engine.setGameState('PLAYING');
  return p;
}
function attack(byId, targetId) {
  engine.setGameState('ATTACK');
  engine.setAttackerId(byId);
  engine.doAttack(byId, targetId);
  engine.clearPhaseTimer();
}
function act(p, form) {
  const s = p.johnny;
  if (form === 4) { s.preAwaken = 0; s.awakening = true; s.goldenRatio = 2; s.at.goldenRatio = 1e9; }
  else { s.awakening = false; s.goldenRatio = 0; s.preAwaken = form - 1; }
}
const saved = { triggerCutscene: engine.triggerCutscene, queueCutscene: engine.queueCutscene, skillFlash: engine.skillFlash, sfx: engine.sfx };
const cutscenes = [];
const sounds = [];
test.before(() => {
  engine.triggerCutscene = (p, k) => cutscenes.push(k);
  engine.queueCutscene = (p, k) => cutscenes.push(k);
  engine.skillFlash = () => {};
  engine.sfx = (s) => sounds.push(s);
});
test.after(() => { Object.assign(engine, saved); for (const id of Object.keys(engine.players)) delete engine.players[id]; });
test.afterEach(() => { Math.random = realRandom; engine.clearPhaseTimer(); cutscenes.length = 0; sounds.length = 0; });

test('ข้อมูล: ระดับยาก · ราคา · ค่าเริ่มต้น (พลังชีวิต 7 เกราะ 3 เล็บ 5 Slow Dancer 2) · อยู่ในหมวดยาก', () => {
  const c = CHARACTERS.CHAR_BY_ID.johnny;
  assert.equal(c.difficulty, 'hard');
  assert.deepEqual([c.basic.cost, c.secondary.cost, c.secondary2.cost, c.secondary3.cost, c.secondary4.cost, c.ultimate.cost, c.ultimate2.cost], [2, 3, 4, 5, 6, 4, 7]);
  const { J: j } = setup();
  assert.equal(j.hp, 7); assert.equal(j.armor, 3);
  assert.equal(j.johnny.nails, 5); assert.equal(j.johnny.slowDancer, 2);
  assert.equal(J.formOf(j), 1);
  assert.equal(engine.displayImg(j), J.IMG.act1);
  const sel = fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'src', 'screens', 'CharacterSelect.jsx'), 'utf8');
  assert.match(sel, /key: "hard"[^\n]*"johnny"/);
  for (const d of [c.basic, c.secondary, c.secondary2, c.secondary3, c.secondary4, c.ultimate, c.ultimate2]) {
    assert.match(d.desc, /^(Act \d · )?(ก่อนเปิดไพ่|หลังเปิดไพ่)/, d.name);
  }
});

test('สกิลพื้นฐาน: Herbal Tea Time ฟื้น 1 + เล็บ 3-5 (เพดาน 5) · Spin Rotation + Spin Mastery', () => {
  const { J: j } = setup();
  j.hp = 5; j.johnny.nails = 1;
  Math.random = () => 0.99;
  engine.useSkill('J', 'basic', [], 'tea');
  assert.equal(j.hp, 6);
  assert.equal(j.johnny.nails, 5, '1 + 5 ตัดเพดาน 5');
  assert.equal(j.skillPoints, 6);
  engine.useSkill('J', 'basic', [], 'spin');
  assert.equal(j.johnny.spin, 0, '1 สกิล/เทิร์น');
  nextRound();
  Math.random = () => 0; // Spin +1 · ติด Mastery (0 < 20%)
  engine.useSkill('J', 'basic', [], 'spin');
  assert.equal(j.johnny.spin, 1);
  assert.equal(j.johnny.mastery, J.MASTERY_TURNS);
  nextRound();
  Math.random = () => 0.99; // +3 +2 (Mastery) · ไม่ติด Mastery ใหม่
  engine.useSkill('J', 'basic', [], 'spin');
  assert.equal(j.johnny.spin, 6);
  nextRound();
  engine.useSkill('J', 'basic', [], 'nope');
  assert.equal(j.skillPoints, 8, 'ต้องเลือกโหมด');
});

test('Spin: 7+ ต้นเทิร์นแต้มสกิล +1 · 15 Spinning Skin ลด 1 สองครั้งแล้วคูลดาวน์ 3 · Spin Mastery หมดเวลา', () => {
  const { J: j, T: t } = setup();
  j.skillPoints = 0;
  j.johnny.spin = 6;
  J.onRoundStartTick(engine, j);
  assert.equal(j.skillPoints, 0);
  j.johnny.spin = 7;
  J.onRoundStartTick(engine, j);
  assert.equal(j.skillPoints, 1);
  j.johnny.spin = 15;
  engine.withEffectSource(t, () => engine.dealMixed(j, 2));
  assert.equal(j.armor, 2, '2 - 1');
  engine.withEffectSource(t, () => engine.dealMixed(j, 1));
  assert.equal(j.armor, 2, '1 - 1 = 0');
  engine.withEffectSource(t, () => engine.dealMixed(j, 1));
  assert.equal(j.armor, 1, 'คูลดาวน์');
  assert.equal(J.publicState(engine, j).skin.cd, J.SKIN_CD);
  j.johnny.mastery = 1;
  J.onRoundStartTick(engine, j);
  assert.equal(j.johnny.mastery, 0);
});

test('Tusk Evo Experience: ราคา 4/5/6 · คูลดาวน์ 5/6/7 · Act 1 -> 2 -> 3 -> 4 (Golden Ratio 2 · วีดีโอ · เพลง)', () => {
  const { J: j } = setup();
  engine.useSkill('J', 'ultimate');
  assert.equal(j.skillPoints, 4);
  assert.equal(J.formOf(j), 2);
  assert.equal(engine.displayImg(j), J.IMG.act2);
  assert.equal(j.johnny.cd.evo, engine.roundNumber + 5);
  assert.ok(sounds.includes('johnny_tusk'));
  nextRound();
  engine.useSkill('J', 'ultimate');
  assert.equal(J.formOf(j), 2, 'ติดคูลดาวน์');
  for (let i = 0; i < 4; i++) nextRound();
  assert.equal(J.dynamicSkillFor(j, CHARACTERS.CHAR_BY_ID.johnny, 'ultimate').cost, 5);
  engine.useSkill('J', 'ultimate');
  assert.equal(j.skillPoints, 3, 'ราคา 4 + Pre-Awaken 1');
  assert.equal(J.formOf(j), 3);
  assert.equal(j.johnny.cd.evo, engine.roundNumber + 6);
  for (let i = 0; i < 6; i++) nextRound();
  engine.useSkill('J', 'ultimate');
  assert.equal(j.skillPoints, 2, 'ราคา 4 + Pre-Awaken 2');
  assert.equal(J.formOf(j), 4);
  assert.equal(j.johnny.preAwaken, 0);
  assert.equal(j.johnny.goldenRatio, 2);
  assert.ok(cutscenes.includes('johnnyEvo'));
  assert.equal(engine.displayImg(j), J.IMG.act4);
  assert.equal(J.activeMusic(engine).music, 'johnny_theme');
  const ch = CHARACTERS.CHAR_BY_ID.johnny;
  assert.equal(J.dynamicSkillFor(j, ch, 'secondary').name, ch.secondary4.name);
  assert.equal(J.dynamicSkillFor(j, ch, 'ultimate').name, 'Lesson Five');
});

test('คริติคอล/หลบตามร่าง · Pre-Awaken ทำดาเมจได้ลดคูลดาวน์ Tusk Evo', () => {
  const { J: j, T: t } = setup();
  assert.equal(J.critBonus(j), 0);
  act(j, 2); assert.equal(J.critBonus(j), 22.5);
  act(j, 3); assert.equal(J.critBonus(j), 25);
  act(j, 4); assert.equal(J.critBonus(j), 0);
  act(j, 3);
  Math.random = () => 0.1; // < 15%
  engine.setGameState('ATTACK'); engine.setAttackerId('T');
  assert.equal(J.tryAttackDodge(engine, t, j), true, 'Act 3 หลบ 15%');
  engine.clearPhaseTimer();
  act(j, 2);
  assert.equal(J.tryAttackDodge(engine, t, j), false, 'Act 2 ไม่หลบ');
  j.johnny.cd.evo = engine.roundNumber + 4;
  Math.random = () => 0.99; // ไม่คริ
  attack('J', 'T');
  assert.equal(t.armor, 2);
  assert.equal(j.johnny.cd.evo, engine.roundNumber + 3);
});

test('Slow Dancer: กันดีบัฟจากศัตรู 2 ครั้ง · สกิลที่เล็งเรา (ดาเมจ+ดีบัฟ) ไม่มีผลและนับ 1 ครั้ง', () => {
  const { J: j, T: t, M: m } = setup();
  const ctx = J.beginUse(engine, t, ['J']);
  J.onSkillFired(engine, t, ['J']);
  engine.withEffectSource(t, () => { engine.dealMixed(j, 2); engine.applyDebuff(j, 'weak', 1, 2); });
  J.endUse(ctx);
  assert.equal(j.armor, 3);
  assert.equal(j.statuses.weak, undefined);
  assert.equal(j.johnny.slowDancer, 1);
  engine.withEffectSource(m, () => engine.applyDebuff(j, 'stun', null, 1));
  assert.equal(j.statuses.stun, undefined);
  assert.equal(j.johnny.slowDancer, 0);
  engine.withEffectSource(m, () => engine.applyDebuff(j, 'stun', null, 1));
  assert.equal(j.statuses.stun, 1, 'หมดแล้ว');
  engine.withEffectSource(j, () => engine.applyDebuff(j, 'weak', 1, 1));
  assert.equal(j.statuses.weak, 1, 'ไม่กันของตัวเอง');
});

test('กระสุนเล็บ: ตีปกติใช้เล็บ 1 · ตีโดน 50% หมุนวน +1 (ต้านได้) · เล็บ 0 ยังตีได้แต่ไม่มีหมุนวน', () => {
  const { J: j, T: t } = setup();
  const hpArm = () => t.hp + t.armor;
  let before = hpArm();
  Math.random = () => 0.3; // < 50% ติด (Act 1 ไม่มีคริ)
  attack('J', 'T');
  assert.equal(hpArm(), before - 1);
  assert.equal(j.johnny.nails, 4);
  assert.equal(J.whirlOf(t), 1);
  Math.random = () => 0.5; // ไม่ติด (ต้องต่ำกว่า 50%)
  attack('J', 'T');
  assert.equal(j.johnny.nails, 3);
  assert.equal(J.whirlOf(t), 1);
  t.statuses.resist = 2;
  Math.random = () => 0.2;
  attack('J', 'T');
  assert.equal(j.johnny.nails, 2);
  assert.equal(J.whirlOf(t), 1, 'ต้านได้');
  delete t.statuses.resist;
  j.johnny.nails = 0;
  before = hpArm();
  attack('J', 'T');
  assert.equal(hpArm(), before - 1, 'เล็บหมดยังตีได้');
  assert.equal(j.johnny.nails, 0);
  assert.equal(J.whirlOf(t), 1, 'เล็บหมด ไม่มีโอกาสหมุนวน');
});

test('Rapid Shot: แต้ม 3 อย่างเดียว · ยิง 3 นัด นัดละหมุนวน 1-2 · แต่ละนัดใช้เล็บ 1 + 50% หมุนวน +1 · พลาด 25% ก็ยิงต่อ · คูลดาวน์ 3 นับจากได้ตี', () => {
  const { J: j, T: t } = setup();
  engine.useSkill('J', 'secondary');
  assert.equal(j.skillPoints, 5);
  assert.equal(j.johnny.nails, 5, 'กดแล้วไม่ใช้เล็บ');
  assert.equal(j.johnny.rapid, true);
  assert.equal(J.canUseSkill(engine, j, 'secondary'), false, 'ค้างอยู่');
  Math.random = () => 0.5; // ไม่พลาด · หมุนวน +2 · เล็บไม่ติด 50%
  attack('J', 'T');
  assert.equal(t.armor, 2);
  assert.equal(J.whirlOf(t), 2);
  assert.equal(j.johnny.nails, 4);
  assert.equal(j.johnny.rapidShot, 1);
  assert.equal(j.johnny.cd.rapid, engine.roundNumber + 3);
  assert.equal(J.continueRapid(engine), true);
  assert.equal(engine.gameState, 'ATTACK');
  engine.clearPhaseTimer();
  Math.random = () => 0.3; // ไม่พลาด (30 >= 25) · หมุนวน +1 · เล็บติด 50% +1
  engine.doAttack('J', 'T');
  engine.clearPhaseTimer();
  assert.equal(t.armor, 1);
  assert.equal(J.whirlOf(t), 4);
  assert.equal(j.johnny.nails, 3);
  assert.equal(j.johnny.rapidShot, 2);
  assert.equal(J.continueRapid(engine), true, 'ยังเหลือนัดที่ 3');
  engine.clearPhaseTimer();
  Math.random = () => 0.1; // พลาด
  engine.doAttack('J', 'T');
  engine.clearPhaseTimer();
  assert.equal(t.armor, 1, 'นัดที่ 3 พลาด');
  assert.equal(j.johnny.nails, 2, 'พลาดก็ใช้เล็บ');
  assert.equal(J.whirlOf(t), 4);
  assert.equal(J.continueRapid(engine), false, 'ครบ 3 นัด');
  assert.equal(j.johnny.rapidShot, 0);
  // นัดแรกพลาดก็ยังได้นัดที่ 2-3 · เล็บหมดก็ยังยิงได้ (ไม่มีหมุนวน +1)
  nextRound(); j.johnny.cd.rapid = 0; j.johnny.nails = 0; t.armor = 3; t.statuses = {}; t.statusAmt = {};
  engine.useSkill('J', 'secondary');
  Math.random = () => 0.1;
  attack('J', 'T');
  assert.equal(t.armor, 3);
  Math.random = () => 0.3; // ไม่พลาด · หมุนวน +1 · ไม่มีเล็บ = ไม่ทอย 50%
  assert.equal(J.continueRapid(engine), true);
  engine.clearPhaseTimer();
  engine.doAttack('J', 'T');
  engine.clearPhaseTimer();
  assert.equal(J.continueRapid(engine), true);
  engine.clearPhaseTimer();
  engine.doAttack('J', 'T');
  engine.clearPhaseTimer();
  assert.equal(t.armor, 1);
  assert.equal(J.whirlOf(t), 2);
  assert.equal(J.continueRapid(engine), false);
});

test('Snipe Shot: ก่อนเปิดไพ่ · เลือกศัตรู · ยิงทันที ดาเมจ 2 + หมุนวน 2-3 · Chumimi +1 · เล็บ 2 · คูลดาวน์ 4', () => {
  const { J: j, T: t } = setup();
  act(j, 2);
  engine.useSkill('J', 'secondary', []);
  assert.equal(j.skillPoints, 8, 'ต้องเลือกเป้า');
  engine.useSkill('J', 'secondary', ['J']);
  assert.equal(j.skillPoints, 8, 'เลือกตัวเองไม่ได้');
  t.statuses.johnnyChumimi = 5;
  Math.random = () => 0.99; // หมุนวน +3
  engine.useSkill('J', 'secondary', ['T']);
  assert.equal(engine.gameState, 'PLAYING', 'ลงผลช่วงจั่วไพ่ ไม่ต้องรอชนะ');
  assert.equal(j.skillPoints, 4);
  assert.equal(j.johnny.nails, 3);
  assert.equal(t.armor, 0, '2 + Chumimi 1');
  assert.equal(t.statuses.johnnyChumimi, undefined);
  assert.ok(sounds.includes('johnny_chumimi'));
  assert.equal(J.whirlOf(t), 3);
  assert.equal(j.johnny.cd.snipe, engine.roundNumber + 4);
  nextRound();
  assert.equal(J.canUseSkill(engine, j, 'secondary', ['T']), false, 'คูลดาวน์');
  j.johnny.cd.snipe = 0; j.johnny.nails = 1;
  assert.equal(J.canUseSkill(engine, j, 'secondary', ['T']), false, 'เล็บไม่พอ');
  j.johnny.nails = 2;
  assert.equal(J.canUseSkill(engine, j, 'secondary', ['T']), true);
});

test('Wormhole Multi Shot: 3 นัดสุ่ม คนละไม่เกิน 2 · เล็บ 3 · ศัตรูคนเดียวโดนแค่ 2 นัด', () => {
  const { J: j, T: t, M: m } = setup();
  act(j, 3);
  Math.random = () => 0; // เลือกคนแรกที่ยังไม่เต็มเสมอ · หมุนวน +1
  engine.useSkill('J', 'secondary');
  assert.equal(j.johnny.nails, 2);
  const hitT = 3 - t.armor, hitM = 3 - m.armor;
  assert.deepEqual([hitT, hitM].sort(), [1, 2]);
  assert.equal(J.whirlOf(t) + J.whirlOf(m), 3);
  assert.equal(j.johnny.cd.wormhole, engine.roundNumber + 5);
  nextRound(); j.johnny.cd.wormhole = 0; j.johnny.nails = 5;
  m.alive = false;
  t.armor = 3;
  engine.useSkill('J', 'secondary');
  assert.equal(t.armor, 1, 'เพดาน 2 นัดต่อคน');
});

test('หมุนวน: สูงสุด 9 · ได้เพิ่มต่ออายุ 8 เทิร์น · ต้านได้ · ล้างได้ทั้งก้อน · การหมุนย้อนกลับ 15%', () => {
  const { J: j, T: t, M: m } = setup();
  J.addWhirl(engine, j, t, 5);
  t.statuses.johnnyWhirl = 3;
  J.addWhirl(engine, j, t, 6);
  assert.equal(J.whirlOf(t), 9);
  assert.equal(t.statuses.johnnyWhirl, 8);
  engine.cleanseDebuffs(t);
  assert.equal(J.whirlOf(t), 0);
  m.statuses.resist = 2;
  assert.equal(J.addWhirl(engine, j, m, 2), 0, 'ต้านได้');
  delete m.statuses.resist;
  // การหมุนย้อนกลับ: ผู้ติดหมุนวนใช้สกิลที่ทำดาเมจ -> ลงตัวเอง + หมุนวน -2
  J.addWhirl(engine, j, t, 4);
  Math.random = () => 0.1; // < 15%
  let ctx = J.beginUse(engine, t, ['M']);
  engine.withEffectSource(t, () => { engine.dealMixed(m, 2); engine.applyDebuff(m, 'weak', 1, 2); });
  J.endUse(ctx);
  assert.equal(m.armor, 3);
  assert.equal(t.armor, 1);
  assert.equal(t.statuses.weak, 2, 'ดีบัฟที่ตามมาย้อนกลับด้วย');
  assert.equal(J.whirlOf(t), 2);
  Math.random = () => 0.5; // ไม่ติด
  ctx = J.beginUse(engine, t, ['M']);
  engine.withEffectSource(t, () => engine.dealMixed(m, 1));
  J.endUse(ctx);
  assert.equal(m.armor, 2);
  // ตีปกติไม่ย้อนกลับ
  Math.random = () => 0.1;
  ctx = J.beginUse(engine, t, ['M']);
  engine.withEffectSource(t, () => engine.dealMixed(m, 1, true));
  J.endUse(ctx);
  assert.equal(m.armor, 1);
});

test('Ora Ora Ora Ora! BeatDown: เสีย Golden Ratio 1 + เล็บทั้งหมด · +1 ต่อหมุนวน 3 · มอบ Chumimi · วีดีโอ · คูลดาวน์หลังตี', () => {
  const { J: j, T: t } = setup();
  act(j, 4);
  J.addWhirl(engine, j, t, 7);
  engine.useSkill('J', 'secondary');
  assert.equal(j.johnny.nails, 0);
  assert.equal(j.johnny.goldenRatio, 1);
  assert.equal(J.formOf(j), 4);
  Math.random = () => 0.99;
  attack('J', 'T');
  assert.equal(t.armor, 0); assert.equal(t.hp, 6, '1 + Awakening 1 + หมุนวน 7/3 = 2 -> 4');
  assert.equal(t.statuses.johnnyChumimi, 5);
  assert.ok(cutscenes.includes('johnnyOra'));
  assert.equal(j.johnny.cd.ora, engine.roundNumber + 5);
  assert.equal(j.skillPoints, 2 + 1, 'Awakening ตีโดนแต้มสกิล +1');
});

test('Lesson Five: ก่อนเปิดไพ่ · เลือกศัตรู · ดาเมจ 3 ทันที · Chumimi = +2 (รวม 5) ไม่สนการลดดาเมจ + สตั้นทันที · วีดีโอทุกครั้ง', () => {
  const { J: j, T: t, M: m } = setup();
  act(j, 4);
  engine.useSkill('J', 'ultimate', []);
  assert.equal(j.skillPoints, 8, 'ต้องเลือกเป้า');
  // ไม่มี Chumimi: ดาเมจ 3 (เย็นชื่นใจยังลดได้ตามปกติ)
  m.statuses.escanorCool = 2; m.statusAmt.escanorCool = 1;
  const mBefore = m.hp + m.armor;
  engine.useSkill('J', 'ultimate', ['M']);
  assert.equal(engine.gameState, 'PLAYING');
  assert.equal(j.skillPoints, 1);
  assert.equal(j.johnny.goldenRatio, 1);
  assert.equal(j.johnny.nails, 4);
  assert.equal(m.hp + m.armor, mBefore - 2, '3 - เย็นชื่นใจ 1');
  assert.equal(m.statuses.stun, undefined);
  assert.equal(m.locked, false);
  assert.ok(cutscenes.includes('johnnyLesson'));
  // Chumimi: +2 · ไม่สนเย็นชื่นใจ · สตั้นทันที (เปิดไพ่ให้) · Golden Ratio หมด -> Act 1
  nextRound();
  t.statuses.johnnyChumimi = 5;
  t.statuses.escanorCool = 2; t.statusAmt.escanorCool = 3;
  const tBefore = t.hp + t.armor;
  engine.useSkill('J', 'ultimate', ['T']);
  assert.equal(t.hp + t.armor, tBefore - 5, '3 + Chumimi 2 ไม่ถูกลด');
  assert.equal(t.statuses.johnnyChumimi, undefined);
  assert.ok(sounds.includes('johnny_chumimi'));
  assert.equal(t.statuses.stun, 1);
  assert.equal(t.locked, true);
  assert.equal(j.johnny.pierce, false, 'ธงทะลุปิดหลังลงดาเมจ');
  assert.equal(j.johnny.nails, 3);
  assert.equal(J.formOf(j), 1, 'Golden Ratio หมด -> Act 1');
  assert.equal(cutscenes.filter((k) => k === 'johnnyLesson').length, 2, 'วีดีโอทุกครั้ง');
  // ต้านสตั้นได้ · ดาเมจหลังทะลุไม่ถูกลดเฉพาะก้อน Lesson Five
  act(j, 4); nextRound();
  m.statuses = { johnnyChumimi: 5, resist: 2 }; m.statusAmt = {}; m.locked = false;
  const m2 = m.hp + m.armor;
  engine.useSkill('J', 'ultimate', ['M']);
  assert.equal(m.hp + m.armor, m2 - 5);
  assert.equal(m.statuses.stun, undefined, 'ต้านได้');
  assert.equal(m.locked, false);
  t.statuses.escanorCool = 2; t.statusAmt.escanorCool = 1;
  const t2 = t.hp + t.armor;
  engine.withEffectSource(j, () => engine.dealMixed(t, 1));
  assert.equal(t.hp + t.armor, t2, 'ดาเมจสกิลอื่นยังถูกลดตามปกติ');
});

test('Golden Ratio หมด = กลับ Act 1 · สกิลกลับเป็น Rapid Shot / Tusk Evo · เพลงหยุด', () => {
  const { J: j } = setup();
  act(j, 4);
  j.johnny.goldenRatio = 1;
  engine.useSkill('J', 'secondary');
  assert.equal(J.formOf(j), 1);
  assert.equal(j.johnny.awakening, false);
  assert.equal(J.activeMusic(engine), null);
  const ch = CHARACTERS.CHAR_BY_ID.johnny;
  assert.equal(J.dynamicSkillFor(j, ch, 'secondary').name, 'Rapid Shot');
  assert.equal(J.dynamicSkillFor(j, ch, 'ultimate').name, 'Tusk Evo Experience');
  assert.equal(engine.displayImg(j), J.IMG.act1);
});

test('ปาดบัฟ: Act 4 Golden Ratio ถูกปาด + Spin 15 = แปลงเป็น Golden Ratio 1 ครั้งเดียว · Pre-Awaken/Awakening ปาดไม่ได้', () => {
  const { J: j } = setup();
  j.johnny.spin = 15; j.johnny.at.spin = 1;
  j.johnny.preAwaken = 2;
  engine.useSkill('J', 'ultimate'); // เข้า Act 4 (Golden Ratio ได้ตราเวลาล่าสุด)
  assert.equal(J.formOf(j), 4);
  let r = engine.stripLatestBuff(j);
  assert.equal(r.label, 'Golden Ratio');
  assert.equal(j.johnny.goldenRatio, 1);
  assert.equal(j.johnny.spin, 0);
  assert.equal(J.formOf(j), 4);
  r = engine.stripLatestBuff(j);
  assert.equal(r.label, 'Golden Ratio');
  assert.equal(J.formOf(j), 1, 'แปลงได้ครั้งเดียว');
  r = engine.stripLatestBuff(j);
  assert.equal(r.label, 'Slow Dancer');
  assert.equal(engine.stripLatestBuff(j), null);
  j.johnny.preAwaken = 2;
  assert.equal(engine.stripLatestBuff(j), null, 'Pre-Awaken ปาดไม่ได้');
  assert.equal(j.johnny.preAwaken, 2);
  // บัฟกลางที่ใหม่กว่าถูกปาดก่อน
  j.johnny.spin = 3; j.johnny.at.spin = 1;
  engine.applyBuff(j, 'guard', 1, 2);
  assert.equal(engine.stripLatestBuff(j).key, 'guard');
  assert.equal(engine.stripLatestBuff(j).label, 'Spin');
});
