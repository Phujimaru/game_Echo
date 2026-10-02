// อาซาฮินะ ทักต์ + ไททัน — characters/takt.js / characters/titan.js ผ่าน engine จริง (server.js)
process.env.JOURNEY_START_SECONDS = '0';
const test = require('node:test');
const assert = require('node:assert/strict');
const { engine } = require('../../server.js');
const takt = require('../../characters/takt.js');
const titan = require('../../characters/titan.js');
const CHARACTERS = require('../../characters.js');

const realRandom = Math.random;
const blank = (id, characterId, position, teamId = null) => ({
  id, name: id, position, characterId, alive: true, connected: true, cards: [], statuses: {}, statusAmt: {},
  seen: {}, cutsceneShown: {}, inventory: [], teamId,
});

function setup({ mode = 'ffa', teams = false, extra = [] } = {}) {
  for (const id of Object.keys(engine.players)) delete engine.players[id];
  engine.players.K = blank('K', 'takt', 1, teams ? 'A' : null);
  engine.players.N = blank('N', 'titan', 2, teams ? 'A' : null);
  engine.players.T = blank('T', 'temari', 3, teams ? 'B' : null);
  engine.players.M = blank('M', 'kai', 4, teams ? 'B' : null);
  for (const [id, cid, pos] of extra) engine.players[id] = blank(id, cid, pos);
  engine.setGameMode(mode);
  engine.startMatch();
  engine.clearPhaseTimer();
  engine.setGameState('PLAYING');
  for (const p of Object.values(engine.players)) {
    p.locked = false; p.skillPoints = 8; p.skillUsedRound = false;
    p.hp = engine.maxHpOf(p); p.armor = engine.maxArmorOf(p); p.shield = 0; p.statuses = {}; p.statusAmt = {}; p.evadeStacks = [];
  }
  return engine.players;
}
function bond(K, N) {
  takt.invite(engine, K, N.id);
  takt.answerInvite(engine, N, true);
}
function attack(byId, targetId) {
  engine.setGameState('ATTACK');
  engine.setAttackerId(byId);
  engine.doAttack(byId, targetId);
  engine.clearPhaseTimer();
}

const saved = {
  triggerCutscene: engine.triggerCutscene, queueCutscene: engine.queueCutscene, skillFlash: engine.skillFlash,
  pausePlayingForCutscene: engine.pausePlayingForCutscene, sfx: engine.sfx,
};
const cutscenes = [];
test.before(() => {
  engine.triggerCutscene = (p, k) => cutscenes.push(k);
  engine.queueCutscene = (p, k) => cutscenes.push(k);
  engine.skillFlash = () => {};
  engine.sfx = () => {};
});
test.after(() => { Object.assign(engine, saved); for (const id of Object.keys(engine.players)) delete engine.players[id]; });
test.afterEach(() => { Math.random = realRandom; engine.clearPhaseTimer(); cutscenes.length = 0; });

test('ข้อมูล: ทักต์พิเศษ unique · ไททันง่าย · ราคาตามสเปก', () => {
  const k = CHARACTERS.CHAR_BY_ID.takt, n = CHARACTERS.CHAR_BY_ID.titan;
  assert.equal(k.difficulty, 'special');
  assert.equal(k.unique, true);
  assert.deepEqual([k.basic.cost, k.secondary.cost, k.ultimate.cost], [2, 0, 4]);
  assert.equal(n.difficulty, 'easy');
  assert.deepEqual([n.basic.cost, n.secondary.cost, n.ultimate.cost, n.secondary2.cost, n.ultimate2.cost], [0, 4, 4, 4, 12]);
});

test('ตระกูลอาซาฮินะ: พลังชีวิต 5 ไม่มีเกราะ · ไม่รับดาเมจแพ้รอบ · ฟื้น 2 ทุก 3 เทิร์น', () => {
  const { K } = setup();
  assert.equal(engine.maxHpOf(K), 5);
  assert.equal(engine.maxArmorOf(K), 0);
  assert.equal(takt.lossDamageImmune(K), true);
  K.hp = 1;
  engine.setRoundNumber(3);
  takt.onRoundStartTick(engine, K);
  assert.equal(K.hp, 3);
  engine.setRoundNumber(4);
  takt.onRoundStartTick(engine, K);
  assert.equal(K.hp, 3);
});

test('พันธะ: เชิญ -> ตอบรับ = ผูก + วีดีโอ · พวกเดียวกันในโหมดอิสระ · สูงสุด 2', () => {
  const { K, N, T } = setup({ extra: [['N2', 'titan', 5], ['N3', 'titan', 6]] });
  assert.equal(takt.invite(engine, K, 'T'), false, 'คนที่ไม่ใช่มิวสิคคาร์ทเชิญไม่ได้');
  assert.equal(takt.invite(engine, K, 'N'), true);
  assert.equal(takt.invitePending(engine), true);
  assert.equal(takt.answerInvite(engine, N, true), true);
  assert.deepEqual(K.taktBonds, ['N']);
  assert.ok(cutscenes.includes('taktAccept'));
  assert.equal(engine.sameTeam(K, N), true);
  assert.equal(engine.isAlly(N, K), true);
  assert.equal(engine.sameTeam(K, T), false);
  assert.equal(engine.displayImg(K), takt.IMG.bonded);
  bond(K, engine.players.N2);
  assert.equal(takt.invite(engine, K, 'N3'), false, 'พันธะเต็ม 2 แล้ว');
  // ปฏิเสธ -> เชิญซ้ำเทิร์นนี้ไม่ได้
  K.taktBonds = ['N']; engine.players.N2.taktBondBy = null;
  takt.invite(engine, K, 'N3');
  takt.answerInvite(engine, engine.players.N3, false);
  assert.equal(engine.players.N3.taktBondBy, null);
  assert.equal(takt.invite(engine, K, 'N3'), false);
});

test('พันธะ: โหมดทีมผูกได้เฉพาะเพื่อนร่วมทีม', () => {
  const { K } = setup({ mode: 'duo', teams: true, extra: [] });
  engine.players.T.characterId = 'titan';
  engine.players.T.titan = null; titan.resetCombat(engine.players.T);
  assert.equal(takt.invite(engine, K, 'T'), false);
  assert.equal(takt.invite(engine, K, 'N'), true);
});

test('พันธะหลุดเมื่อมิวสิคคาร์ทตาย · โหมดอิสระเหลือพวกในพันธะ = ชนะพร้อมกัน', () => {
  const { K, N, T, M } = setup();
  bond(K, N);
  T.alive = false; M.alive = false;
  assert.equal(takt.bondGroupWins(engine, [K, N]), true);
  engine.instantDeath(N, true);
  assert.deepEqual(K.taktBonds, []);
  assert.equal(engine.sameTeam(K, N), false);
});

test('หลบการโจมตีปกติ: 15% ติดตัว · มีพันธะ 35% (ไม่บวกกัน)', () => {
  const { K, N, T } = setup();
  assert.equal(takt.dodgeChance(engine, K), 15);
  bond(K, N);
  assert.equal(takt.dodgeChance(engine, K), 35);
  Math.random = () => 0.1;
  const hp = K.hp;
  attack('T', 'K');
  assert.equal(K.hp, hp);
  assert.equal(engine.lastAttack.dodge, true);
  assert.deepEqual(engine.lastAttack.skills, [], 'หลบเงียบ ไม่ขึ้นป้าย');
  assert.ok(T);
});

test('เสียงอันไพเราะ: โชคลาภ/เลือด/เกราะ · ให้ตัวเองฟื้น 2 · ให้มิวสิคคาร์ทโชคลาภ 2 · คูลดาวน์ 3', () => {
  const { K, N, T } = setup();
  T.hp = 3; T.armor = 0;
  engine.useSkill('K', 'basic', ['T']);
  assert.equal(T.statuses.fortune, 1);
  assert.equal(T.hp, 4);
  assert.equal(T.armor, 1);
  assert.equal(K.skillPoints, 6);
  const r = engine.roundNumber;
  K.skillUsedRound = false;
  assert.equal(takt.canUseSkill(engine, K, 'basic', ['K']), false);
  engine.setRoundNumber(r + 2);
  assert.equal(takt.canUseSkill(engine, K, 'basic', ['K']), false);
  engine.setRoundNumber(r + 3);
  K.hp = 1;
  engine.useSkill('K', 'basic', ['K']);
  assert.equal(K.hp, 3);
  bond(K, N);
  engine.setRoundNumber(r + 6);
  K.skillUsedRound = false;
  engine.useSkill('K', 'basic', ['N']);
  assert.equal(N.statuses.fortune, 2);
});

test('ปลดปล่อยเสียงดนตรี + บรรเลงเสียงสวรรค์: บทเพลง 5 เทิร์น · พลังโจมตี +1 · สลับโหมดไม่กินโควตา', () => {
  const { K, N, T } = setup();
  assert.equal(takt.canUseSkill(engine, K, 'ultimate', ['N']), false, 'ต้องมีพันธะก่อน');
  bond(K, N);
  engine.useSkill('K', 'ultimate', ['N']);
  assert.equal(N.statuses.taktSong, 5);
  assert.ok(cutscenes.includes('taktSongTitan'));
  assert.equal(engine.displayImg(N), titan.IMG.song);
  assert.equal(engine.attackPowerAgainst(N, T), 2);
  assert.equal(takt.canUseSkill(engine, K, 'ultimate', ['N']), false, 'บทเพลงยังอยู่');
  // สกิลรอง 0 แต้ม ไม่กินโควตา (ใช้ท่าไม้ตายไปแล้วเทิร์นนี้)
  engine.useSkill('K', 'secondary', ['N'], 'fierce');
  assert.equal(N.taktSongMode, 'fierce');
  assert.equal(takt.critBonus(N), 20);
  engine.useSkill('K', 'secondary', ['N'], 'gentle');
  assert.equal(N.taktSongMode, 'fierce', 'มิวสิคคาร์ทละ 1 ครั้ง/เทิร์น');
  // ทุ้มต่ำ: ดาเมจ -1 (ไม่นับดาเมจจากสถานะ)
  N.taktSongMode = 'low';
  assert.equal(takt.songIncoming(N, 2), 1);
  N._statusDamage = true;
  assert.equal(takt.songIncoming(N, 2), 2);
  N._statusDamage = false;
});

test('ของว่าง: ฟื้น 2 แต้มสกิล +3 · ไม่กินโควตา · 1 ครั้ง/เทิร์น · 3 ครั้ง/เกม', () => {
  const { N } = setup();
  N.hp = 3; N.skillPoints = 2;
  const r = engine.roundNumber;
  engine.useSkill('N', 'basic');
  assert.equal(N.hp, 5);
  assert.equal(N.skillPoints, 5);
  assert.equal(N.skillUsedRound, false);
  engine.useSkill('N', 'basic');
  assert.equal(N.skillPoints, 5, 'เทิร์นละครั้ง');
  engine.setRoundNumber(r + 1); engine.useSkill('N', 'basic');
  engine.setRoundNumber(r + 2); engine.useSkill('N', 'basic');
  assert.equal(N.titan.snacks, 3);
  engine.setRoundNumber(r + 3);
  assert.equal(titan.canUseSkill(engine, N, 'basic'), false);
});

test('ซองแฝด: ตีปกติโดนติดลุกไหม้ 2 · ช็อตกันทอย 50% ดาเมจ +1', () => {
  const { N, T } = setup();
  engine.useSkill('N', 'secondary');
  assert.equal(N.statuses.titanTwin, 3);
  T.armor = 0; T.hp = 7;
  Math.random = () => 0.9; // ช็อตกันไม่ติด / ไม่หลบ
  attack('N', 'T');
  assert.equal(T.hp, 6);
  assert.equal(T.statuses.hburn, 2);
  Math.random = () => 0.3; // ช็อตกันติด (50%) — หลบของเป้า (เทมาริไม่มี) ไม่เกี่ยว
  N.titan.set = null;
  attack('N', 'T');
  assert.equal(T.hp, 4);
});

test('คล่องตัวสูง: หลบหลีก 1 · ถูกตีปกติสวนกลับ (แม้หลบได้) · ถูกสกิลเล็งสวนกลับ', () => {
  const { N, T, K } = setup();
  engine.useSkill('N', 'ultimate');
  assert.equal(N.statuses.evade, 1);
  assert.deepEqual(N.evadeStacks, [2], 'หลบหลีกอยู่ 2 เทิร์น');
  assert.equal(N.statuses.titanAgile, 3);
  assert.ok(cutscenes.includes('titanAgile'));
  N.skillUsedRound = false;
  assert.equal(titan.canUseSkill(engine, N, 'ultimate'), false, 'กดซ้ำระหว่างผลไม่ได้');
  // หลบด้วยหลบหลีก แต่ยังสวน (flush ที่หัว endTurn)
  T.armor = 0; T.hp = 7;
  Math.random = () => 0.9;
  attack('T', 'N');
  assert.equal(engine.lastAttack.dodge, true);
  titan.flushCounters(engine, false);
  assert.equal(T.hp, 6);
  // ถูกสกิลเล็ง (แม้เป็นบัฟ) -> สวนผู้ใช้
  K.hp = 5;
  engine.setGameState('PLAYING');
  engine.useSkill('K', 'basic', ['N']);
  assert.equal(K.hp, 4, 'ไม่ได้ผูกพันธะ = ศัตรู ถูกสวน 1');
});

test('Vigorous Rising Sun: วีดีโอก่อนหมัดแรก · ตี 2 ครั้ง หมัดละลุกไหม้ 1 · มิวสิคคาร์ทรวมได้ 3 (ครั้งที่ 3 25%)', () => {
  const { K, N, T } = setup();
  bond(K, N);
  engine.useSkill('K', 'ultimate', ['N']);
  engine.setGameState('PLAYING');
  N.skillUsedRound = false;
  engine.useSkill('N', 'secondary');
  assert.equal(N.titan.sun, true);
  T.armor = 0; T.hp = 7;
  Math.random = () => 0.9; // ครั้งที่ 3 ไม่ติด / ช็อตกันไม่ติด
  cutscenes.length = 0;
  engine.setGameState('ATTACK'); engine.setAttackerId('N');
  engine.doAttack('N', 'T'); // เล่นวีดีโอก่อน (คิว) แล้วตีจริงหลังคลิป
  assert.ok(cutscenes.includes('titanSun'));
  engine.clearPhaseTimer();
  if (!N.titan.set) { engine.setGameState('ATTACK'); engine.doAttack('N', 'T'); engine.clearPhaseTimer(); }
  assert.equal(N.titan.set.total, 2);
  assert.equal(T.statuses.hburn, 1);
  assert.equal(titan.continueAttack(engine), true);
  engine.clearPhaseTimer();
  attack('N', 'T');
  assert.equal(T.statuses.hburn, 2);
  assert.equal(titan.continueAttack(engine), false);
  // ทั้งสองบัฟ + โชคดี = 3 ครั้ง
  N.titan.set = null; N.titan.sun = true; N.titan.sunVideo = true;
  Math.random = () => 0.1;
  titan.beginAttack(engine, N);
  assert.equal(N.titan.set.total, 3);
});

test('ช็อตกัน: ตีโดนฟื้น 1 ทุกหมัด · ชุดเดี่ยว 50% ได้ตีครั้งที่ 2 · ชุดหลายหมัดไม่เพิ่ม', () => {
  const { K, N, T } = setup();
  N.hp = 2; T.armor = 0; T.hp = 7;
  Math.random = () => 0.9;
  attack('N', 'T');
  assert.equal(N.hp, 3);
  assert.equal(N.titan.set.total, 1);
  N.titan.set = null;
  Math.random = () => 0.1;
  titan.beginAttack(engine, N);
  assert.equal(N.titan.set.total, 2, 'ช็อตกันได้ตีครั้งที่ 2');
  // มิวสิคคาร์ทปลดล็อก (2 หมัดอยู่แล้ว) -> ช็อตกันไม่เพิ่ม
  bond(K, N);
  engine.useSkill('K', 'ultimate', ['N']);
  N.titan.set = null;
  titan.beginAttack(engine, N);
  assert.equal(N.titan.set.total, 2);
  assert.ok(T);
});

test('ตระกูลอาซาฮินะ: หลบดาเมจสกิล 15% · ปืน/สถานะหลบไม่ได้', () => {
  const { K, T } = setup();
  Math.random = () => 0.1;
  engine.withEffectSource(T, () => engine.dealMixed(K, 2));
  assert.equal(K.hp, 5, 'หลบสกิลได้');
  K._itemDamage = true;
  engine.withEffectSource(T, () => engine.dealMixed(K, 2));
  K._itemDamage = false;
  assert.equal(K.hp, 3, 'ปืนหลบไม่ได้');
  Math.random = () => 0.9;
  engine.withEffectSource(T, () => engine.dealMixed(K, 1));
  assert.equal(K.hp, 2);
});

test('Triumphant: ไททันจ่ายที่มี ทักต์จ่ายส่วนที่ขาด · 4 ดาเมจศัตรู ไม่โดนทักต์ · ลบบัฟ · สตั้น+เปราะบางตัวเอง', () => {
  const { K, N, T, M } = setup();
  bond(K, N);
  engine.useSkill('K', 'ultimate', ['N']);
  engine.setGameState('PLAYING');
  N.skillPoints = 5; K.skillPoints = 7; N.skillUsedRound = false;
  T.statuses.guard = 2; T.statusAmt.guard = 1;
  T.hp = 7; T.armor = 3; M.hp = 7; M.armor = 0;
  let after = null;
  engine.pausePlayingForCutscene = (fn) => { after = fn; };
  engine.useSkill('N', 'ultimate');
  engine.pausePlayingForCutscene = saved.pausePlayingForCutscene;
  assert.equal(N.skillPoints, 0);
  assert.equal(K.skillPoints, 0);
  assert.ok(cutscenes.includes('titanTriumph'));
  // ดาเมจลงหลังวีดีโอ — useSkill ภายในเรียก cutscene.pausePlayingForCutscene (ไม่ผ่าน engine) จึงลงผลเองถ้าไม่ได้ stub
  if (after) after();
  else if (T.hp === 7 && T.armor === 3) titan.applyTriumph(engine, N);
  assert.equal(T.statuses.guard, undefined, 'บัฟถูกลบ');
  assert.equal(T.armor + T.hp, 6);
  assert.equal(M.hp, 3);
  assert.equal(K.hp, 5, 'ไม่โดนคอนดักเตอร์');
  assert.equal(N.statuses.stun, 2);
  assert.equal(N.statuses.fragile, 2);
  engine.clearPhaseTimer();
  // แต้มรวมไม่ถึง 12 = กดไม่ได้
  N.statuses.taktSong = 3; N.skillPoints = 4; K.skillPoints = 7;
  assert.equal(titan.triumphSplit(engine, N).ok, false);
});
