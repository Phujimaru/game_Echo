// การเดินทาง 7 ภูมิภาค (characters/_journey.js) — สนามของโหมดสงครามทั่วไป ffa/duo/trio
process.env.JOURNEY_START_SECONDS = '1';
process.env.JOURNEY_ADVANCE_SECONDS = '1';
const test = require('node:test');
const assert = require('node:assert/strict');
const { engine } = require('../server.js');
const Journey = require('../characters/_journey.js');
const { tickBurn } = require('../characters/_universal_status.js');

const ORT_ID = '__ort__';
const realRandom = Math.random;
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitState(pred, ms = 5000) {
  for (let i = 0; i < ms / 50; i++) { if (pred()) return true; await delay(50); }
  return false;
}
function withRandom(v, fn) {
  Math.random = () => v;
  try { return fn(); } finally { Math.random = realRandom; }
}
function setup(chars = ['hikaru', 'kai', 'dan'], mode = 'ffa') {
  for (const id of Object.keys(engine.players)) delete engine.players[id];
  chars.forEach((ch, i) => {
    engine.players['p' + i] = {
      id: 'p' + i, name: 'P' + i, position: i + 1, characterId: ch, alive: true, connected: true,
      cards: [], statuses: {}, statusAmt: {}, seen: {}, inventory: [], teamId: null,
    };
  });
  engine.setGameMode(mode);
  engine.startMatch();
  engine.clearPhaseTimer();
  return engine.players;
}
function attack(byId, targetId) {
  engine.setGameState('ATTACK');
  engine.setAttackerId(byId);
  engine.doAttack(byId, targetId);
  engine.clearPhaseTimer();
}

test.afterEach(() => { Math.random = realRandom; engine.clearPhaseTimer(); });
test.after(() => { engine.clearPhaseTimer(); for (const id of Object.keys(engine.players)) delete engine.players[id]; });

test('ภูมิภาคเปลี่ยนทุก 10 เทิร์น และค้างที่ภูมิภาค 7 ถาวร · กลางวัน 5 เทิร์นแรก กลางคืน 5 เทิร์นหลัง', () => {
  assert.deepEqual([1, 10, 11, 20, 21, 60, 61, 70, 71, 200].map(Journey.areaOf), [1, 1, 2, 2, 3, 6, 7, 7, 7, 7]);
  setup();
  engine.setRoundNumber(15);
  assert.deepEqual(Journey.current(engine), { area: 2, night: false });
  engine.setRoundNumber(16);
  assert.deepEqual(Journey.current(engine), { area: 2, night: true });
  engine.setRoundNumber(95);
  const info = engine.buildStateFor('p0').journey;
  assert.equal(info.area, 7);
  assert.equal(info.turnsLeft, null, 'ภูมิภาค 7 ไม่มีที่สิ้นสุด');
});

test('เริ่มเกม: พักรอฉากเปิดตัว + ฉากแผนที่ "start" แล้วค่อยแจกไพ่เทิร์น 1', async () => {
  for (const id of Object.keys(engine.players)) delete engine.players[id];
  ['hikaru', 'kai'].forEach((ch, i) => {
    engine.players['p' + i] = { id: 'p' + i, name: 'P' + i, position: i + 1, characterId: ch, alive: true, connected: true, cards: [], statuses: {}, statusAmt: {}, seen: {}, inventory: [], teamId: null };
  });
  engine.setGameMode('ffa');
  engine.startMatch();
  assert.equal(engine.gameState, 'CUTSCENE');
  const scene = engine.buildStateFor('p0').journey.scene;
  assert.equal(scene.active, true);
  assert.equal(scene.mode, 'start');
  assert.ok(await waitState(() => engine.gameState === 'PLAYING' && engine.roundNumber === 1, 15000), 'เทิร์น 1 เริ่มหลังฉากจบ');
  assert.equal(engine.buildStateFor('p0').journey.scene.active, false);
});

test('ข้ามเข้าภูมิภาคใหม่: ฉากแผนที่ "advance" ก่อนเทิร์น 11 · ไม่มี ORT บุกเทิร์น 60 อีกแล้ว', async () => {
  setup();
  engine.setRoundNumber(10);
  engine.setGameState('SUMMARY');
  engine.endTurn();
  assert.ok(await waitState(() => engine.buildStateFor('p0').journey.scene?.active));
  const j = engine.buildStateFor('p0').journey;
  assert.deepEqual({ mode: j.scene.mode, area: j.scene.area, fromArea: j.scene.fromArea }, { mode: 'advance', area: 2, fromArea: 1 });
  assert.equal(j.area, 2, 'ระหว่างฉาก client เห็นภูมิภาคปลายทางแล้ว (ฉากหลัง/เพลงเปลี่ยนใต้แผนที่)');
  assert.equal(j.night, false, 'เทิร์น 11 เป็นกลางวัน');
  assert.ok(await waitState(() => engine.gameState === 'PLAYING' && engine.roundNumber === 11));

  engine.setRoundNumber(59);
  engine.setGameState('SUMMARY');
  engine.endTurn();
  assert.ok(await waitState(() => engine.gameState === 'PLAYING' && engine.roundNumber === 60));
  assert.equal(engine.players[ORT_ID], undefined, 'ORT ไม่บุกโหมดสงครามทั่วไป');
});

test('โหมด Raid ไม่มีการเดินทาง (กฎกลางวัน/กลางคืนเดิม)', () => {
  engine.setGameMode('mercury');
  assert.equal(Journey.active(engine), false);
  assert.equal(Journey.nightTaxOn(engine, true), true);
  assert.equal(Journey.skillBonus(engine, true), 1);
  engine.setGameMode('ffa');
});

test('1 อาณาจักรแห่งจุดเริ่มต้น: กลางวันแต้มโบนัสเฉพาะเทิร์นเลขคู่ · กลางคืนมีภาษีสกิล — ภูมิภาคอื่นไม่มีทั้งสองอย่าง', () => {
  setup();
  engine.setRoundNumber(2);
  assert.equal(Journey.skillBonus(engine, false), 1);
  engine.setRoundNumber(3);
  assert.equal(Journey.skillBonus(engine, true), 0);
  engine.setRoundNumber(7);
  assert.equal(Journey.nightTaxOn(engine, false), true);
  engine.setRoundNumber(17);
  assert.equal(Journey.nightTaxOn(engine, true), false, 'ภูมิภาค 2 กลางคืน ไม่มีภาษีกลางคืนเดิม');
  engine.setRoundNumber(12);
  assert.equal(Journey.skillBonus(engine, true), 0, 'ภูมิภาค 2 ไม่มีโบนัสเช้าเดิม');
});

test('2 ทุ่งดอกไม้: กลางวันได้ของฟรี · กลางคืนร้านซื้อได้ช่องละ 3 ชิ้น (ยกเว้นของที่มีโควตา)', () => {
  const { p0, p1, p2 } = setup();
  engine.setRoundNumber(12);
  withRandom(0, () => Journey.onEndTurn(engine));
  assert.equal(p0.inventory.length, 1);
  assert.ok(p0.inventory[0].price <= 5 && p0.inventory[0].type !== 'gutsAmmo');

  engine.setRoundNumber(20);
  engine.openShop();
  const shop = engine.shopItems;
  const potion = shop.find((it) => it.type !== 'gutsGun' && it.type !== 'mark42' && it.ammo !== 'hyper_trigger' && it.ammo !== 'trigger_dark_key');
  assert.equal(potion.stock, 3);
  for (const p of [p0, p1, p2]) p.gold = 30;
  engine.setGameState('PLAYING');
  engine.buyShopItem('p0', potion.id);
  engine.buyShopItem('p1', potion.id);
  assert.equal(potion.sold, false);
  assert.equal(potion.stock, 1);
  engine.buyShopItem('p2', potion.id);
  assert.equal(potion.sold, true, 'ชิ้นที่ 3 หมดช่อง');
  engine.buyShopItem('p0', potion.id);
  assert.equal(p0.gold, 30 - potion.price, 'ซื้อเกินสต็อกไม่ได้');
  for (const it of shop.filter((x) => x.type === 'gutsGun' || x.type === 'mark42' || x.ammo === 'hyper_trigger')) {
    assert.equal(it.stock, undefined, 'ของที่มีโควตาต่อรอบยังช่องละ 1');
  }
});

test('3 ป่าไม้ต้องสาป: สกิลแพงขึ้น +1 (ราคา 0 ยังฟรี) · กลางวันโจมตีพลาด 40% / โดนแรงขึ้น +1', () => {
  const { p0, p1 } = setup();
  engine.setRoundNumber(1);
  const baseCost = engine.buildStateFor('p0').players.find((x) => x.id === 'p0').character.basic.cost;
  engine.setRoundNumber(21);
  assert.equal(engine.buildStateFor('p0').players.find((x) => x.id === 'p0').character.basic.cost, baseCost + 1);
  assert.equal(Journey.skillTax(engine, 0), 0);

  p1.armor = 0; p1.hp = 7; p1.shield = 0;
  withRandom(0, () => attack('p0', 'p1'));
  assert.equal(p1.hp, 7, 'พลาดเป้า');
  assert.equal(engine.lastAttack.dodge, true);

  withRandom(0.99, () => attack('p0', 'p1'));
  assert.equal(p1.hp, 5, 'ตีโดน = พลังโจมตีพื้นฐาน 1 +1');
});

test('3 ป่าไม้ต้องสาป กลางวัน: สกิลที่เลือกศัตรูพลาด 25% · แม่นยำไม่พลาด · เป้าหมายเป็นตัวเอง/เพื่อนไม่นับ', () => {
  const { p0 } = setup();
  engine.setRoundNumber(22);
  assert.equal(withRandom(0.2, () => Journey.skillMisses(engine, p0, ['p1'])), true);
  assert.equal(withRandom(0.3, () => Journey.skillMisses(engine, p0, ['p1'])), false);
  assert.equal(withRandom(0, () => Journey.skillMisses(engine, p0, ['p0'])), false);
  assert.equal(withRandom(0, () => Journey.skillMisses(engine, p0, [])), false);
  p0.statuses.accurate = 1;
  assert.equal(withRandom(0, () => Journey.skillMisses(engine, p0, ['p1'])), false);
});

test('3 ป่าไม้ต้องสาป กลางคืน: ลุกไหม้แรงขึ้น +1 ตามโอกาส 50%', () => {
  const { p0 } = setup();
  engine.setRoundNumber(27);
  p0.armor = 0; p0.hp = 7; p0.shield = 0;
  p0.statuses.hburn = 2;
  withRandom(0, () => tickBurn(engine, p0));
  assert.equal(p0.hp, 5);
  withRandom(0.99, () => tickBurn(engine, p0));
  assert.equal(p0.hp, 4, 'ไม่ติดโอกาส = ความเสียหายปกติ 1');
  engine.setRoundNumber(22);
  p0.statuses.hburn = 1;
  withRandom(0, () => tickBurn(engine, p0));
  assert.equal(p0.hp, 3, 'กลางวันไม่มีโบนัส');
});

test('4 คลื่นวงวนน้ำ: เหรียญ +1 · กลางวันร้านมีแต่ของราคา 5+ · กลางคืนเสียเหรียญ (ไม่พอ = โดนความเสียหาย)', () => {
  const { p0 } = setup();
  engine.setRoundNumber(33);
  assert.equal(Journey.goldBonus(engine), 1);
  engine.setRoundNumber(35);
  engine.openShop();
  assert.ok(engine.shopItems.every((it) => it.price >= 5));

  engine.setRoundNumber(37);
  p0.gold = 1; p0.armor = 1; p0.shield = 0;
  withRandom(0, () => Journey.onEndTurn(engine));
  assert.equal(p0.gold, 0);
  assert.equal(p0.armor, 0, 'จ่ายไม่พอ -> ความเสียหาย 1 ลงเกราะก่อน');
});

test('5 ทะเลทราย: เกราะฟื้นทุกเทิร์น · กลางวันโดนแดด 1 · กลางคืนคืนแต้มไม่เกินที่จ่ายจริง', () => {
  const { p0 } = setup();
  engine.setRoundNumber(41);
  assert.equal(Journey.armorRegenDue(engine, 41), true);
  engine.setRoundNumber(11);
  assert.equal(Journey.armorRegenDue(engine, 11), false);
  engine.setRoundNumber(41);
  p0.armor = 3; p0.shield = 0;
  Journey.onEndTurn(engine);
  assert.equal(p0.armor, 2);
  engine.setRoundNumber(46);
  assert.equal(Journey.skillRefund(engine, 6), 2);
  assert.equal(Journey.skillRefund(engine, 1), 1);
  assert.equal(Journey.skillRefund(engine, 0), 0);
});

test('6 อาณาจักรน้ำแข็ง: คริติคอล 20% ×2 (ตัวละครที่มีอัตราคริ = บวกเข้าอัตราเดิม ไม่คูณซ้อน) · กลางคืนสตั้น ไม่โดนซ้ำเทิร์นติดกัน · ต้านสถานะกันได้', () => {
  const { p0, p1 } = setup();
  engine.setRoundNumber(51);
  assert.equal(withRandom(0, () => Journey.applyCrit(engine, p0, 2, {})), 4);
  assert.equal(withRandom(0.5, () => Journey.applyCrit(engine, p0, 2, {})), 2);
  assert.equal(Journey.critBonus(engine), 20);
  // ตัวละครที่มีอัตราคริเอง: สนามไม่ทอยแยก (กันคูณซ้อน) แต่บวก +20% เข้าไปในการทอยของตัวเอง
  const usagi = require('../characters/usagi.js');
  const bunny = { ...p0, characterId: 'usagi', usagiPuru: 0 };
  assert.equal(withRandom(0, () => Journey.applyCrit(engine, bunny, 2, {})), 2);
  assert.equal(withRandom(0.19, () => usagi.applyCrit(engine, bunny, 2, {})), 4, '0 ปรุๆ + สนาม 20% = คริได้');
  assert.equal(withRandom(0.21, () => usagi.applyCrit(engine, bunny, 2, {})), 2);
  assert.equal(withRandom(0.19, () => usagi.applyCrit(engine, { ...bunny, usagiPuru: 1 }, 3, {})), 6, 'ไม่เกิน ×2');
  engine.setRoundNumber(41);
  assert.equal(withRandom(0.19, () => usagi.applyCrit(engine, bunny, 2, {})), 2, 'นอกอาณาจักรน้ำแข็งไม่มีโบนัส');
  engine.setRoundNumber(51);

  engine.setRoundNumber(56);
  p1.statuses.resist = 1;
  withRandom(0, () => Journey.onEndTurn(engine));
  assert.equal(p0.statuses.stun, 1);
  assert.equal(p1.statuses.stun, undefined, 'ต้านสถานะผิดปกติ');
  delete p0.statuses.stun;
  engine.setRoundNumber(57);
  withRandom(0, () => Journey.onEndTurn(engine));
  assert.equal(p0.statuses.stun, undefined, 'เพิ่งโดนเมื่อเทิร์นที่แล้ว');
});

test('7 จุดสิ้นสุดของโลก: แต้มสกิล +1 ทุกเทิร์น · กลางวันไฟแผดเผา + ผุพัง · กลางคืนพลังโจมตี +1', () => {
  const { p0, p1 } = setup();
  engine.setRoundNumber(63);
  assert.equal(Journey.skillBonus(engine, false), 1);
  p0.armor = 3; p0.shield = 0;
  withRandom(0, () => Journey.onEndTurn(engine));
  assert.equal(p0.armor, 2);
  assert.equal(p0.statuses.decay, 1);

  engine.setRoundNumber(68);
  p1.armor = 0; p1.hp = 7; p1.shield = 0;
  withRandom(0.99, () => attack('p0', 'p1'));
  assert.equal(p1.hp, 5, 'พลังโจมตีพื้นฐาน 1 +1');
});
