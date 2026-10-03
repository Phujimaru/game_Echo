// นักบินปริศนา (Silver Bullet) — characters/sliver_bullet.js ผ่าน engine จริง
//  แขน/ราคาสกิลพื้นฐาน · Beam Magnum (ดาเมจแบบไอเทม — ทักต์ที่หลบสกิล 15% หลบไม่ได้) · ซุ่มโจมตี (ซ่อนตัว/สิงร่าง)
//  เส้นทางปรากฏตัว 1-5 + กรณีที่ไม่ปรากฏตัว · เล็งไม่ได้ระหว่างซ่อน · ไม่มีไพ่/ไม่ร่วมตัดสินรอบ · เตรียมพร้อม = lock
//  buildStateFor ซ่อนจากศัตรู · บันทึกไม่รั่ว · เงื่อนไข ffa/trio/duo · จบเกมยังตัดสินได้
//  เป้าหมายปกติใช้ temari / kai (ไม่มีการหลบแบบสุ่ม — กับดัก #6) · ทักต์ใช้พิสูจน์ "ไอเทมหลบไม่ได้" โดยล็อก Math.random
process.env.JOURNEY_START_SECONDS = '0';
const test = require('node:test');
const assert = require('node:assert/strict');
const { engine, resolveRound, attackSoundOf } = require('../../server.js');
const sb = require('../../characters/sliver_bullet.js');
const CHARACTERS = require('../../characters.js');

const realRandom = Math.random;
const blank = (id, characterId, position, teamId = null) => ({
  id, name: id, position, characterId, alive: true, connected: true, cards: [], statuses: {}, statusAmt: {},
  seen: {}, cutsceneShown: {}, inventory: [], teamId,
});
// list = [[id, characterId, teamId?], ...] · ตัวแรกควรเป็นนักบิน
function setup(list, mode = 'ffa', hostIdx = 0) {
  for (const id of Object.keys(engine.players)) delete engine.players[id];
  list.forEach(([id, cid, team], i) => { engine.players[id] = blank(id, cid, i + 1, team || null); });
  engine.setGameMode(mode);
  engine.setCycleShift(0);
  Math.random = () => 0; // dealRound ของ startMatch สุ่มร่างที่สิง -> คนแรกในรายชื่อผู้สมัคร
  engine.startMatch();
  Math.random = realRandom;
  engine.clearPhaseTimer();
  engine.setGameState('PLAYING');
  for (const p of Object.values(engine.players)) {
    p.locked = false; p.skillPoints = 8; p.skillUsedRound = false; p.busted = false;
    p.hp = engine.maxHpOf(p); p.armor = engine.maxArmorOf(p); p.shield = 0; p.tempHp = 0;
    p.statuses = {}; p.statusAmt = {}; p.evadeStacks = []; p.nightTaxTier = null; p.cutsceneShown = {};
  }
  // ตัดสินการซ่อนตัวใหม่ด้วยร่างที่กำหนด (hostIdx = ลำดับในรายชื่อผู้สมัคร)
  Math.random = () => (hostIdx ? 0.999 : 0.001); // 0 = ผู้สมัครคนแรก · 1 = คนสุดท้าย
  sb.onRoundStart(engine);
  Math.random = realRandom;
  for (const p of Object.values(engine.players)) if (sb.hidden(p)) p.cards = [];
  rec.length = 0;
  return engine.players;
}
const rec = [];
const saved = {
  triggerCutscene: engine.triggerCutscene, queueCutscene: engine.queueCutscene, notifyTransform: engine.notifyTransform,
  skillFlash: engine.skillFlash, sfx: engine.sfx, pausePlayingForCutscene: engine.pausePlayingForCutscene,
};
test.before(() => {
  engine.triggerCutscene = (p, k) => rec.push({ kind: 'trigger', key: k });
  engine.queueCutscene = (p, k, onlyFor) => rec.push({ kind: 'cut', key: k, onlyFor: onlyFor || null });
  engine.notifyTransform = (p, k, onlyFor) => rec.push({ kind: 'notice', key: k, onlyFor: onlyFor || null });
  engine.skillFlash = (payload) => rec.push({ kind: 'flash', payload });
  engine.sfx = (sound, onlyFor) => rec.push({ kind: 'sfx', sound, onlyFor: onlyFor || null });
});
test.after(() => {
  Object.assign(engine, saved);
  for (const id of Object.keys(engine.players)) delete engine.players[id];
  engine.setGameMode('ffa');
  engine.setCycleShift(0);
});
test.afterEach(() => { Math.random = realRandom; engine.clearPhaseTimer(); engine.setCycleShift(0); });

const card = (v) => ({ value: v, color: 'red' });
const logLines = () => engine.buildStateFor('PIL').log; // ผู้ชมที่เห็นทุกอย่าง (ตัวเขาเอง) — ใช้ได้เฉพาะช่วง SUMMARY
const allLog = () => { const g = engine.gameState; engine.setGameState('SUMMARY'); const l = logLines(); engine.setGameState(g); return l; };
const viewLog = (viewer) => { const g = engine.gameState; engine.setGameState('SUMMARY'); const l = engine.buildStateFor(viewer).log; engine.setGameState(g); return l; };
const ids = (viewer) => engine.buildStateFor(viewer).players.map((p) => p.id);
const FFA3 = [['PIL', 'sliver_bullet'], ['TEM', 'temari'], ['KAI', 'kai']];
const FFA4 = [['PIL', 'sliver_bullet'], ['TEM', 'temari'], ['KAI', 'kai'], ['TM2', 'temari']];

// ---------------------------------------------------------------- ข้อมูล
test('ข้อมูล: ง่าย · unique · พลังชีวิต 3 เกราะ 2 · ราคา 2/4 · ไม่มีท่าไม้ตาย · คลิป 2 ตัว · เสียงตีปกติ', () => {
  const c = CHARACTERS.CHAR_BY_ID.sliver_bullet;
  assert.equal(c.name, 'นักบินปริศนา');
  assert.equal(c.difficulty, 'easy');
  assert.equal(c.unique, true, 'เลือกได้แค่ 1 คนต่อเกม');
  assert.equal(CHARACTERS.publicRoster().find((r) => r.id === 'sliver_bullet').unique, true);
  assert.equal(c.ultimate, null);
  assert.deepEqual([c.basic.cost, c.secondary.cost], [2, 4]);
  assert.equal(c.img, '/characters/sliver_bullet/sliver_bullet_banagher.png');
  for (const k of ['sliverReload', 'sliverBeam']) {
    assert.ok(engine.TRANSFORMS[k] && engine.TRANSFORMS[k].video, `ต้องมีคลิป ${k}`);
    assert.equal(engine.TRANSFORMS[k].afterReveal, false);
  }
  const { PIL } = setup([['PIL', 'sliver_bullet'], ['TEM', 'temari']]);
  assert.equal(engine.maxHpOf(PIL), 3);
  assert.equal(engine.maxArmorOf(PIL), 2);
  assert.equal(PIL.sliver.arm, true, 'เริ่มเกมมีแขน');
  assert.equal(attackSoundOf(PIL), 'sliver_shot');
  assert.equal(engine.displayImg(PIL), '/characters/sliver_bullet/sliver_bullet.png');
});

// ---------------------------------------------------------------- สกิลพื้นฐาน
test('เปลี่ยนชิ้นส่วน: มีแขน = 3 แต้ม ฟื้น 2 · ไม่มีแขน = 2 แต้ม ได้แขน + ฟื้น 1 · ราคาบนปุ่มตามแขน', () => {
  const { PIL } = setup([['PIL', 'sliver_bullet'], ['TEM', 'temari']]); // 2 คน = ไม่ซ่อน
  const shownCost = () => engine.buildStateFor('PIL').players.find((p) => p.id === 'PIL').character.basic.cost;
  assert.equal(shownCost(), 3);
  PIL.hp = 1;
  engine.useSkill('PIL', 'basic');
  assert.equal(PIL.skillPoints, 5);
  assert.equal(PIL.hp, 3);
  assert.equal(PIL.sliver.arm, true);
  PIL.sliver.arm = false; PIL.skillUsedRound = false; PIL.hp = 1;
  assert.equal(shownCost(), 2);
  assert.equal(engine.buildStateFor('TEM').players.find((p) => p.id === 'PIL').character.basic.cost, 2);
  engine.useSkill('PIL', 'basic');
  assert.equal(PIL.skillPoints, 3);
  assert.equal(PIL.hp, 2);
  assert.equal(PIL.sliver.arm, true);
});

test('เปลี่ยนชิ้นส่วน: คลิปครั้งแรกต่อเกม · ครั้งต่อไปการ์ดแจ้งเตือน + เสียง sliver_reload · ไม่มีป้ายสกิลกลาง', () => {
  const { PIL } = setup([['PIL', 'sliver_bullet'], ['TEM', 'temari']]);
  engine.useSkill('PIL', 'basic');
  assert.deepEqual(rec.filter((r) => r.kind === 'cut').map((r) => [r.key, r.onlyFor]), [['sliverReload', null]]);
  assert.equal(rec.some((r) => r.kind === 'flash'), false);
  rec.length = 0;
  PIL.skillUsedRound = false;
  engine.useSkill('PIL', 'basic');
  assert.deepEqual(rec.filter((r) => r.kind !== 'flash').map((r) => [r.kind, r.key || r.sound]), [['notice', 'sliverReload'], ['sfx', 'sliver_reload']]);
  assert.equal(rec.some((r) => r.kind === 'flash'), false);
});

test('เปลี่ยนชิ้นส่วนระหว่างซ่อนตัว: ไม่ปรากฏตัว · คลิป/การ์ด/เสียงเฉพาะนักบิน (+เพื่อนร่วมทีม) · ไม่มีบันทึก/roundSkills', () => {
  const { PIL } = setup(FFA3);
  assert.equal(sb.hidden(PIL), true);
  engine.useSkill('PIL', 'basic');
  assert.equal(sb.hidden(PIL), true, 'สกิลพื้นฐานไม่ทำให้ปรากฏตัว');
  assert.equal(PIL.skillPoints, 5);
  assert.deepEqual(rec.filter((r) => r.kind === 'cut').map((r) => r.onlyFor), [['PIL']]);
  assert.equal(rec.some((r) => r.kind === 'flash'), false);
  assert.equal(engine.roundSkills.some((s) => s.playerId === 'PIL'), false);
  assert.equal(allLog().some((l) => l.includes('PIL')), false);
  rec.length = 0;
  PIL.skillUsedRound = false;
  engine.useSkill('PIL', 'basic');
  assert.deepEqual(rec.map((r) => [r.kind, r.onlyFor]), [['notice', ['PIL']], ['sfx', ['PIL']]]);
  // trio: เพื่อนร่วมทีมเห็นด้วย
  const team = setup([['PIL', 'sliver_bullet', 'A'], ['TEM', 'temari', 'A'], ['KAI', 'kai', 'A'], ['E1', 'temari', 'B'], ['E2', 'kai', 'B'], ['E3', 'temari', 'B']], 'trio');
  engine.useSkill('PIL', 'basic');
  assert.equal(sb.hidden(team.PIL), true);
  assert.deepEqual(rec.filter((r) => r.kind === 'cut')[0].onlyFor.sort(), ['KAI', 'PIL', 'TEM']);
});

// ---------------------------------------------------------------- Beam Magnum
test('Beam Magnum: ต้องมีแขน · ดาเมจ 4 แบบไอเทม (ทักต์ที่หลบสกิล 15% หลบไม่ได้) · เสียแขน · คลิปครั้งแรก แล้วเป็นเสียง', () => {
  const { PIL, TAK } = setup([['PIL', 'sliver_bullet'], ['TAK', 'takt']]);
  Math.random = () => 0; // ถ้าเป็นดาเมจสกิลธรรมดา ทักต์จะหลบได้แน่นอน
  // ตัวควบคุม: ดาเมจสกิลปกติถูกทักต์หลบ (พิสูจน์ว่า Math.random ล็อกได้ผล)
  engine.withEffectSource(PIL, () => engine.dealMixed(TAK, 1));
  assert.equal(TAK.hp, 5);
  engine.useSkill('PIL', 'secondary', ['TAK']);
  assert.equal(TAK.hp, 1, 'ไม่มีเกราะ — โดนเต็ม 4');
  assert.equal(PIL.sliver.arm, false);
  assert.equal(PIL.skillPoints, 4);
  assert.equal(TAK._itemDamage, false, 'ปิดธงหลังยิง');
  assert.deepEqual(rec.filter((r) => r.kind === 'cut').map((r) => r.key), ['sliverBeam']);
  assert.ok(allLog().some((l) => l.includes('Beam Magnum') && l.includes('TAK')), 'ปรากฏตัวแล้ว บันทึกเปิดเผยได้');
  // ไม่มีแขน = กดไม่ได้
  PIL.skillUsedRound = false;
  engine.useSkill('PIL', 'secondary', ['TAK']);
  assert.equal(PIL.skillPoints, 4);
  assert.equal(TAK.hp, 1);
  // ได้แขนคืน -> ครั้งที่สองเป็นเสียง sliver_shot (ไม่มีคลิป)
  PIL.sliver.arm = true; rec.length = 0;
  TAK.hp = 5;
  engine.useSkill('PIL', 'secondary', ['TAK']);
  assert.equal(rec.some((r) => r.kind === 'cut'), false);
  assert.ok(rec.some((r) => r.kind === 'sfx' && r.sound === 'sliver_shot' && !r.onlyFor));
});

test('Beam Magnum: ลดเกราะก่อน (temari) · เลือกตัวเอง/คนนอกเป้าไม่ได้', () => {
  const { PIL, TEM } = setup([['PIL', 'sliver_bullet'], ['TEM', 'temari']]);
  TEM.hp = 7; TEM.armor = 3;
  engine.useSkill('PIL', 'secondary', ['PIL']);
  assert.equal(PIL.skillPoints, 8);
  engine.useSkill('PIL', 'secondary', ['TEM']);
  assert.deepEqual([TEM.armor, TEM.hp], [0, 6]);
});

// ---------------------------------------------------------------- เงื่อนไข
test('เงื่อนไขซ่อนตัว: ffa 3 คนขึ้นไป · ffa 2 คนไม่ซ่อน · trio เพื่อนรอด 2 · duo ไม่มีวัน · โหมดพิเศษปิด', () => {
  let P = setup(FFA3);
  assert.equal(sb.hidden(P.PIL), true);
  assert.ok(['TEM', 'KAI'].includes(P.PIL.sliver.hostId));
  P = setup([['PIL', 'sliver_bullet'], ['TEM', 'temari']]);
  assert.equal(sb.hidden(P.PIL), false);
  const trio = [['PIL', 'sliver_bullet', 'A'], ['TEM', 'temari', 'A'], ['KAI', 'kai', 'A'], ['E1', 'temari', 'B'], ['E2', 'kai', 'B'], ['E3', 'temari', 'B']];
  for (let i = 0; i < 4; i++) {
    P = setup(trio, 'trio', i % 2);
    assert.equal(sb.hidden(P.PIL), true);
    assert.ok(['TEM', 'KAI'].includes(P.PIL.sliver.hostId), 'โหมดทีมสิงได้แค่เพื่อนร่วมทีม');
  }
  P.KAI.alive = false;
  sb.onRoundStart(engine);
  assert.equal(sb.hidden(P.PIL), false, 'เพื่อนเหลือ 1 = ไม่ซ่อน');
  P = setup([['PIL', 'sliver_bullet', 'A'], ['TEM', 'temari', 'A'], ['E1', 'temari', 'B'], ['E2', 'kai', 'B']], 'duo');
  assert.equal(sb.hidden(P.PIL), false, 'duo ไม่มีวันเข้าเงื่อนไข');
  P = setup(FFA3);
  for (const mode of ['seraph', 'purge', 'mercury']) {
    engine.setGameMode(mode);
    assert.equal(sb.conditionHolds(engine, P.PIL), false, mode);
  }
  engine.setGameMode('ffa');
});

// ---------------------------------------------------------------- ระหว่างซ่อน
test('ซ่อนตัว: ไม่ได้ไพ่ · จั่วไม่ได้ · ไม่อยู่ในสนาม (alivePlayers/attackableTargets) · เล็งด้วยสกิล/ไอเทมไม่ได้', () => {
  const { PIL, TEM } = setup([...FFA3, ['TAK', 'takt']]);
  // ไพ่ใบแรกจาก dealRound จริง
  engine.setRoundNumber(1);
  Math.random = () => 0.001;
  engine.startMatch(); engine.clearPhaseTimer();
  Math.random = realRandom;
  const pil = engine.players.PIL;
  assert.equal(sb.hidden(pil), true);
  assert.equal(pil.cards.length, 0, 'ไม่ได้ไพ่ต้นเทิร์น');
  assert.equal(engine.scoreOf(pil), 0);
  engine.hit('PIL');
  assert.equal(pil.cards.length, 0, 'จั่วไม่ได้');
  assert.equal(engine.alivePlayers().some((p) => p.id === 'PIL'), false);
  for (const id of ['TEM', 'KAI', 'TAK']) assert.equal(engine.attackableTargets(id).some((p) => p.id === 'PIL'), false);
  // สกิลที่เล็งตรง (เสียงอันไพเราะของทักต์เลือกใครก็ได้) -> ถูกปัด ไม่เสียแต้ม
  const tak = engine.players.TAK;
  tak.skillPoints = 8; tak.locked = false; tak.skillUsedRound = false;
  engine.setGameState('PLAYING');
  engine.useSkill('TAK', 'basic', ['PIL']);
  assert.equal(tak.skillPoints, 8);
  // ไอเทม: ยิงปืนใส่ไม่ได้
  tak.inventory = [{ uid: 'g', type: 'gutsGun' }]; tak.gutsShotTurn = 0;
  assert.ok(engine.gutsFireTargetOf(tak, { ammo: 'nurse' }, 'TEM'), 'ตัวควบคุม: ยิงคนที่อยู่บนสนามได้');
  assert.equal(engine.gutsFireTargetOf(tak, { ammo: 'nurse' }, 'PIL'), null);
  assert.ok(PIL && TEM);
});

test('เตรียมพร้อม = lock เดิม (p.locked = true) · รอบไม่สรุปจนกว่านักบินจะกด · ไม่ชนะไม่แพ้ ไม่รับดาเมจแพ้รอบ', () => {
  const { PIL, TEM, KAI } = setup(FFA3);
  TEM.cards = [card(10), card(9)];
  KAI.cards = [card(5)];
  TEM.locked = true; KAI.locked = true;
  engine.checkAllLocked();
  assert.equal(engine.gameState, 'PLAYING', 'ยังรอนักบินกดเตรียมพร้อม');
  const before = [PIL.hp, PIL.armor];
  engine.lock('PIL');
  assert.equal(PIL.locked, true);
  assert.equal(PIL.sliver.readied, true);
  assert.notEqual(engine.gameState, 'PLAYING', 'ครบแล้วสรุปรอบ');
  engine.clearPhaseTimer();
  assert.equal(PIL.isWinner, false);
  assert.equal(PIL.isLoser, false);
  assert.deepEqual([PIL.hp, PIL.armor], before);
  assert.equal(KAI.isLoser, true, 'คนที่แต้มน้อยสุดจริงยังแพ้ตามปกติ');
  assert.equal(TEM.isWinner, true);
});

// ---------------------------------------------------------------- ปรากฏตัว
test('ปรากฏตัว 1: กด Beam Magnum — ปรากฏก่อนผล · ป้าย/บันทึกเปิดเผยได้ · ศัตรูเห็นเขา', () => {
  const { PIL } = setup(FFA4);
  const host = PIL.sliver.hostId;
  const enemy = ['TEM', 'KAI', 'TM2'].find((id) => id !== host);
  assert.equal(ids(enemy).includes('PIL'), false);
  engine.useSkill('PIL', 'secondary', [enemy]);
  assert.equal(sb.hidden(PIL), false);
  assert.equal(PIL.sliver.revealed, true);
  assert.equal(ids(enemy).includes('PIL'), true);
  assert.ok(allLog().some((l) => l.includes('Beam Magnum')));
});

test('ปรากฏตัว 2: ใช้ไอเทมใส่ผู้เล่นอื่น · ใช้ไอเทมกับตัวเองไม่ปรากฏตัว', () => {
  const { PIL } = setup(FFA4);
  const host = PIL.sliver.hostId;
  const enemy = ['TEM', 'KAI', 'TM2'].find((id) => id !== host);
  PIL.inventory = [{ uid: 'f1', type: 'fortune' }, { uid: 'g1', type: 'gutsGun' }, { uid: 'a1', type: 'gutsAmmo', ammo: 'nurse' }];
  engine.useInventoryItem('PIL', 'f1', {});
  assert.equal(sb.hidden(PIL), true, 'ยาโชคลาภใช้กับตัวเอง');
  // เกราะ Mark 42 ใส่เอง: ไม่ปรากฏตัว · คลิปเห็นเฉพาะตัวเอง
  PIL.inventory.push({ uid: 'm1', type: 'mark42', price: 25 });
  rec.length = 0;
  engine.useInventoryItem('PIL', 'm1', { mode: 'self' });
  assert.equal(sb.hidden(PIL), true, 'Mark 42 ใส่เอง');
  assert.ok(PIL.mark42, 'ใส่ชุดแล้ว');
  assert.deepEqual(rec.filter((r) => r.kind === 'cut').map((r) => r.onlyFor), [['PIL']]);
  PIL.cutsceneShown = { [engine.GUTS_AMMO.nurse.cut]: true }; // ไม่เล่นคลิป -> ลงผลทันที
  engine.useInventoryItem('PIL', 'a1', { targetId: enemy });
  assert.equal(sb.hidden(PIL), false);
  assert.equal(PIL.sliver.revealed, true);
});

test('ปรากฏตัว 3: ร่างที่สิงโดนสกิล/ไอเทมโจมตีช่วงจั่วไพ่ · ไม่ปรากฏ: ตีปกติ · ดาเมจสถานะ · หลังเปิดไพ่', () => {
  let P = setup(FFA4);
  let host = P[P.PIL.sliver.hostId];
  const other = () => ['TEM', 'KAI', 'TM2'].map((id) => P[id]).find((o) => o.id !== host.id);
  engine.withEffectSource(other(), () => engine.dealMixed(host, 1, true)); // ตีปกติ
  assert.equal(sb.hidden(P.PIL), true);
  host._statusDamage = true;
  engine.withEffectSource(other(), () => engine.dealMixed(host, 1));
  host._statusDamage = false;
  assert.equal(sb.hidden(P.PIL), true, 'ดาเมจจากสถานะไม่นับ');
  engine.dealMixed(host, 1); // ไม่มีต้นตอ (สนาม) ไม่นับ
  assert.equal(sb.hidden(P.PIL), true);
  engine.withEffectSource(other(), () => engine.dealMixed(host, 1)); // สกิล
  assert.equal(sb.hidden(P.PIL), false);
  // ไอเทมโจมตี (_itemDamage) ก็นับ
  P = setup(FFA4);
  host = P[P.PIL.sliver.hostId];
  host._itemDamage = true;
  engine.withEffectSource(other(), () => engine.dealMixed(host, 1));
  host._itemDamage = false;
  assert.equal(sb.hidden(P.PIL), false);
  // หลังเปิดไพ่ (resolveRound ไปแล้ว) ไม่นับ
  P = setup(FFA4);
  host = P[P.PIL.sliver.hostId];
  sb.onResolveRound(engine);
  engine.setGameState('ATTACK');
  engine.withEffectSource(other(), () => engine.dealMixed(host, 1));
  assert.equal(sb.hidden(P.PIL), true);
});

test('ปรากฏตัว 4: ร่างที่สิงตาย (ทุกเฟส) · 5: เงื่อนไขหมด (คนอื่นตายจนเหลือ 2)', () => {
  let P = setup(FFA4);
  engine.setGameState('ATTACK');
  engine.instantDeath(P[P.PIL.sliver.hostId]);
  assert.equal(sb.hidden(P.PIL), false, 'ร่างที่สิงตาย');
  P = setup(FFA3);
  const nonHost = ['TEM', 'KAI'].find((id) => id !== P.PIL.sliver.hostId);
  engine.instantDeath(P[nonHost]);
  assert.equal(sb.hidden(P.PIL), false, 'เหลือ 2 คน');
  // ต้นเทิร์นถัดไปเงื่อนไขยังไม่จริง = อยู่บนสนามต่อ
  sb.onRoundStart(engine);
  assert.equal(sb.hidden(P.PIL), false);
});

test('ปรากฏตัวกลางเฟสจั่ว: ยังไม่เตรียมพร้อม = จั่วจาก 0 ได้และร่วมตัดสิน · เตรียมพร้อมแล้ว = ไม่ร่วมตัดสินแต่ถูกเล็งได้', () => {
  let P = setup(FFA4);
  sb.reveal(engine, P.PIL);
  engine.hit('PIL');
  assert.equal(P.PIL.cards.length, 1);
  assert.equal(sb.sitsOutRound(P.PIL), false);
  P = setup(FFA4);
  engine.lock('PIL');
  sb.reveal(engine, P.PIL);
  assert.equal(sb.sitsOutRound(P.PIL), true);
  assert.equal(engine.attackableTargets('TEM').some((p) => p.id === 'PIL'), true);
  for (const [id, v] of [['TEM', 10], ['TM2', 9], ['KAI', 4]]) { P[id].cards = [card(v)]; P[id].locked = true; }
  resolveRound();
  engine.clearPhaseTimer();
  assert.equal(P.PIL.isLoser, false, 'แต้ม 0 แต่ไม่ร่วมตัดสิน');
  assert.equal(P.KAI.isLoser, true);
});

// ---------------------------------------------------------------- ข้อมูลรายผู้ชม
test('buildStateFor: trio ศัตรูไม่เห็นนักบินเลย · เพื่อนร่วมทีม/ตัวเองเห็น + ร่างที่สิง · ป้ายสิงไม่รั่วไปศัตรู', () => {
  const P = setup([['PIL', 'sliver_bullet', 'A'], ['TEM', 'temari', 'A'], ['KAI', 'kai', 'A'], ['E1', 'temari', 'B'], ['E2', 'kai', 'B'], ['E3', 'temari', 'B']], 'trio');
  assert.equal(sb.hidden(P.PIL), true);
  for (const e of ['E1', 'E2', 'E3']) {
    const st = engine.buildStateFor(e);
    assert.equal(st.players.some((p) => p.id === 'PIL'), false);
    assert.equal(JSON.stringify(st).includes('"PIL"'), false, 'ไม่มี id ของนักบินที่ไหนเลย');
  }
  for (const v of ['PIL', 'TEM', 'KAI']) {
    const me = engine.buildStateFor(v).players.find((p) => p.id === 'PIL');
    assert.ok(me, `${v} ต้องเห็นนักบิน`);
    assert.equal(me.sliver_bullet.hidden, true);
    assert.equal(me.sliver_bullet.hostId, P.PIL.sliver.hostId);
    assert.equal(me.sliver_bullet.hostName, P[P.PIL.sliver.hostId].name);
    assert.equal(me.sliver_bullet.arm, true);
  }
  // ปรากฏตัวแล้ว: ศัตรูเห็น แต่ไม่มีข้อมูลร่างที่สิง
  sb.reveal(engine, P.PIL);
  const seen = engine.buildStateFor('E1').players.find((p) => p.id === 'PIL');
  assert.ok(seen);
  assert.equal(seen.sliver_bullet.hostId, null);
  assert.equal(seen.sliver_bullet.hidden, false);
});

test('buildStateFor ffa: คนอื่นไม่เห็นนักบินที่ซ่อนอยู่ · บันทึกที่มีชื่อเขาช่วงซ่อนถูกกรอง · ไม่มีบันทึกเรื่องการสิง', () => {
  const P = setup(FFA3);
  assert.equal(ids('TEM').includes('PIL'), false);
  assert.equal(ids('KAI').includes('PIL'), false);
  assert.equal(ids('PIL').includes('PIL'), true);
  engine.log('ทดสอบ PIL ทำอะไรบางอย่าง');
  assert.equal(viewLog('TEM').some((l) => l.includes('PIL')), false);
  assert.equal(viewLog('PIL').some((l) => l.includes('PIL')), true);
  assert.equal(allLog().some((l) => l.includes('สิง')), false, 'ไม่มีบรรทัดไหนพูดถึงการสิง');
  // ปรากฏตัว: บรรทัดก่อนหน้ายังถูกกรอง · บรรทัดหลังปรากฏตัวเห็นได้
  sb.reveal(engine, P.PIL);
  engine.log('หลังปรากฏ PIL');
  const tl = viewLog('TEM');
  assert.equal(tl.some((l) => l.includes('ทดสอบ PIL')), false);
  assert.equal(tl.some((l) => l.includes('หลังปรากฏ PIL')), true);
});

// ---------------------------------------------------------------- จบเกม
test('จบเกม: นักบินซ่อนอยู่ยังนับเป็นผู้รอด · ffa เหลือ 2 คนปรากฏตัวเอง · trio ทีมนักบินชนะได้ · GAMEOVER เห็นทุกคน', () => {
  let P = setup(FFA3);
  P.PIL.skillPoints = 0;
  engine.endTurn();
  engine.clearPhaseTimer();
  assert.notEqual(engine.gameState, 'GAMEOVER', 'ซ่อน + อีก 2 คน = ยังไม่จบ');
  assert.ok(P.PIL.skillPoints > 0, 'ได้แต้มสกิลจบเทิร์นแม้ซ่อนอยู่');
  P = setup(FFA3);
  engine.setRoundNumber(20); // พ้นช่วงเพลง Longing ของยูนะ (คนแรกที่ตายเทิร์น 1-10 ฟื้น)
  engine.instantDeath(P.KAI);
  engine.instantDeath(P.TEM);
  engine.endTurn();
  engine.clearPhaseTimer();
  assert.equal(engine.gameState, 'GAMEOVER');
  assert.ok(allLog().some((l) => l.includes('PIL') && l.includes('ผู้ชนะ')));
  P = setup([['PIL', 'sliver_bullet', 'A'], ['TEM', 'temari', 'A'], ['KAI', 'kai', 'A'], ['E1', 'temari', 'B'], ['E2', 'kai', 'B'], ['E3', 'temari', 'B']], 'trio');
  engine.setRoundNumber(20);
  for (const e of ['E1', 'E2', 'E3']) engine.instantDeath(P[e]);
  assert.equal(sb.hidden(P.PIL), true, 'เพื่อนยังรอด 2 คน = ยังซ่อน');
  engine.endTurn();
  engine.clearPhaseTimer();
  assert.equal(engine.gameState, 'GAMEOVER');
  assert.equal(engine.winningTeamId, 'A');
  assert.equal(ids('E1').includes('PIL'), true, 'หน้าจบเกมเห็นนักบิน');
});
