// โหมด Purge (server/modes/purge.js + purgeBoard.js) — กระดานทอยเต๋า · ทางแยก · ช่องกิจกรรม · ปะทะ 2 รอบ · จัดอันดับ
process.env.PURGE_INTRO_SECONDS = '0';
const test = require('node:test');
const assert = require('node:assert/strict');
const { engine, resolveRound } = require('../server.js');
const purgeMod = require('../server/modes/purge.js');

const B = purgeMod.board();
const blank = (id, characterId, position) => ({
  id, name: id, position, characterId, alive: true, connected: true, cards: [], statuses: {}, statusAmt: {},
  seen: {}, cutsceneShown: {}, inventory: [], teamId: null, gold: 0,
});
// temari / kai ไม่มีการหลบแบบสุ่ม และไม่มีผลพิเศษตอนแพ้จั่ว
function setup(ids = ['A', 'B']) {
  for (const id of Object.keys(engine.players)) delete engine.players[id];
  const chars = ['temari', 'kai', 'temari', 'kai'];
  ids.forEach((id, i) => { engine.players[id] = blank(id, chars[i], i + 1); });
  engine.setGameMode('purge');
  engine.startMatch();
  engine.clearPhaseTimer();
  for (const p of Object.values(engine.players)) { p.hp = engine.maxHpOf(p); p.armor = 0; p.statuses = {}; p.statusAmt = {}; }
  return engine.players;
}
// ลูกเต๋า: Math.random ตามลำดับที่กำหนด (แต้ม n -> (n - 1) / 6)
function withDice(rolls, fn) {
  const real = Math.random;
  let i = 0;
  Math.random = () => (rolls[i++ % rolls.length] - 1) / 6 + 0.01;
  try { return fn(); } finally { Math.random = real; }
}
// ปิดช่องกิจกรรมทั้งกระดานระหว่างเทสต์ (เปิดเฉพาะที่ต้องการ)
const savedTiles = Object.fromEntries(Object.values(B.nodes).map((n) => [n.id, n.tile]));
function clearTiles() { for (const n of Object.values(B.nodes)) n.tile = null; }
const saved = { triggerCutscene: engine.triggerCutscene, queueCutscene: engine.queueCutscene, skillFlash: engine.skillFlash };
test.before(() => {
  engine.triggerCutscene = () => {};
  engine.queueCutscene = () => {};
  engine.skillFlash = () => {};
});
test.beforeEach(() => clearTiles());
test.after(() => {
  Object.assign(engine, saved); engine.clearPhaseTimer();
  for (const [id, t] of Object.entries(savedTiles)) B.nodes[id].tile = t;
  for (const id of Object.keys(engine.players)) delete engine.players[id];
  engine.setGameMode('ffa');
});
test.afterEach(() => { engine.clearPhaseTimer(); });

const st = () => engine.purge;
const pl = (id) => st().pl[id];
function rollPhase() { engine.purgeBeginRoll(); engine.clearPhaseTimer(); }
function put(id, node) { pl(id).node = node; pl(id).trail = [...trail(node)]; }
function trail(node) {
  const out = [];
  const m = /^m(\d+)$/.exec(node);
  if (m) for (let i = 0; i <= Number(m[1]); i++) out.push(`m${i}`);
  return out;
}

test('กระดาน: 150 ช่องทางหลัก · มีทางแยกภูมิภาคละ 1 จุด · ทางย่อยกลับมารวมทางหลัก', () => {
  assert.equal(B.main, 150);
  const forks = Object.values(B.nodes).filter((n) => n.next.length > 1);
  assert.equal(forks.length, 5);
  for (const f of forks) {
    for (const start of f.next.slice(1)) {
      let id = start, guard = 0;
      while (!id.startsWith('m') && guard++ < 50) id = B.nodes[id].next[0];
      assert.ok(id.startsWith('m'), 'ทางย่อยต้องกลับมาทางหลัก');
      assert.ok(B.nodes[id].prog > f.prog);
    }
  }
});

test('เริ่มแมตช์: ทุกคนที่ช่องเริ่ม · ฉากเปิด · ส่งกระดานให้ client', () => {
  setup(['A', 'B']);
  assert.equal(engine.gameState, 'CUTSCENE');
  assert.equal(pl('A').node, 'm0');
  const v = engine.buildStateFor('A').purge;
  assert.equal(v.scene.kind, 'intro');
  assert.equal(v.board.main, 150);
  assert.ok(v.board.nodes.length > 150);
});

test('เฟสทอย: ได้เหรียญ +2 · ทอยแล้วเดินตามแต้ม · ทุกคนทำครบแล้วรอเดินจบก่อนเข้าฉาก ORT', () => {
  const { A } = setup(['A', 'B']);
  rollPhase();
  assert.equal(engine.gameState, 'PURGE_ROLL');
  assert.equal(st().turn, 1);
  assert.equal(A.gold, 2);
  withDice([4], () => engine.purgeRoll('A'));
  assert.equal(pl('A').node, 'm4');
  assert.deepEqual(st().walks.A[0].path, ['m1', 'm2', 'm3', 'm4']);
  assert.equal(st().settling, undefined);
  withDice([2], () => engine.purgeRoll('B'));
  assert.equal(st().settling, true);
  assert.equal(engine.gameState, 'PURGE_ROLL');
});

test('ทางแยก: หยุดรอเลือก แล้วเดินแต้มที่เหลือตามทางที่เลือก', () => {
  setup(['A', 'B']);
  rollPhase();
  put('A', 'm4');
  withDice([5], () => engine.purgeRoll('A'));
  assert.equal(pl('A').node, 'm6');
  assert.deepEqual(pl('A').choices, B.nodes.m6.next);
  const side = B.nodes.m6.next[1];
  engine.purgeChoose('A', side);
  assert.equal(pl('A').choices, null);
  assert.ok(pl('A').node.startsWith('b0'));
  assert.equal(pl('A').trail.slice(-3).length, 3);
});

test('หมดเวลาทอย: ระบบทอยให้ และที่ทางแยกเลือกทางหลัก', () => {
  setup(['A', 'B']);
  rollPhase();
  put('A', 'm4');
  withDice([6, 1], () => purgeMod.onRollTimeout());
  assert.equal(pl('A').node, 'm10');
  assert.equal(pl('B').node, 'm1');
  assert.equal(st().settling, true);
});

test('ช่องกิจกรรม: เหรียญ · ถอยหลัง · หยุด 2 เทิร์น · ทอยอีกครั้ง', () => {
  const { A } = setup(['A', 'B']);
  B.nodes.m3.tile = 'gold';
  B.nodes.m4.tile = 'back';
  B.nodes.m2.tile = 'stop';
  rollPhase();
  withDice([3], () => engine.purgeRoll('A'));
  assert.equal(A.gold, 2 + 3);
  withDice([4], () => engine.purgeRoll('B'));
  assert.equal(pl('B').node, 'm1');
  engine.clearPhaseTimer();
  // หยุด 2 เทิร์น
  setup(['A', 'B']); clearTiles(); B.nodes.m2.tile = 'stop';
  rollPhase();
  withDice([2], () => engine.purgeRoll('A'));
  assert.equal(pl('A').stop, 2);
  engine.clearPhaseTimer();
  st().settling = false;
  rollPhase();
  assert.equal(pl('A').done, true);
  assert.equal(pl('A').stop, 1);
  // ทอยอีกครั้ง
  setup(['A', 'B']); clearTiles(); B.nodes.m2.tile = 'reroll';
  rollPhase();
  withDice([2], () => engine.purgeRoll('A'));
  assert.equal(pl('A').rolled, false);
  assert.equal(pl('A').done, false);
  withDice([3], () => engine.purgeRoll('A'));
  assert.equal(pl('A').node, 'm5');
  assert.equal(pl('A').done, true);
});

test('ช่องประจำภูมิภาค II: กระแสน้ำพาไปข้างหน้า 3 ช่อง', () => {
  setup(['A', 'B']);
  B.nodes.m33.tile = 'region';
  rollPhase();
  put('A', 'm30');
  withDice([3], () => engine.purgeRoll('A'));
  assert.equal(pl('A').node, 'm36');
  assert.deepEqual(st().walks.A.map((w) => w.kind), ['move', 'flow']);
});

test('ไอเทมกระดาน: เต๋าคู่ · เต๋าทอง · รองเท้า · ผลัก', () => {
  setup(['A', 'B']);
  rollPhase();
  pl('A').items = [{ uid: 'x1', type: 'dice2' }, { uid: 'x2', type: 'push' }];
  put('B', 'm4');
  assert.equal(engine.purgeUseItem('A', { uid: 'x2', targetId: 'B' }), true);
  assert.equal(pl('B').node, 'm2');
  engine.purgeUseItem('A', { uid: 'x1' });
  withDice([3, 4], () => engine.purgeRoll('A'));
  assert.equal(pl('A').node, 'm6');
  assert.equal(pl('A').items.length, 0);
  engine.clearPhaseTimer();
  setup(['A', 'B']); clearTiles();
  rollPhase();
  pl('A').items = [{ uid: 'g', type: 'golden' }];
  pl('B').items = [{ uid: 'b', type: 'boots' }];
  assert.equal(engine.purgeUseItem('A', { uid: 'g', value: 5 }), true);
  engine.purgeUseItem('B', { uid: 'b' });
  withDice([1], () => { engine.purgeRoll('A'); engine.purgeRoll('B'); });
  assert.equal(pl('A').node, 'm5');
  assert.equal(pl('B').node, 'm4');
});

test('ORT: โผล่ช่อง 0 จบเทิร์นเต๋า 5 · จากนั้นทอย 1-6 · กินคนที่ระยะ <= ORT · โล่ผลึกกันได้', () => {
  const { A, B: Bp } = setup(['A', 'B', 'C']);
  st().turn = 5;
  put('A', 'm3'); put('B', 'm9'); put('C', 'm4');
  engine.purgeOrtPhase();
  assert.equal(st().ort, 0);
  assert.equal(st().scene.kind, 'ort');
  engine.clearPhaseTimer();
  st().turn = 6;
  pl('C').shield = true;
  withDice([5], () => engine.purgeOrtPhase());
  assert.equal(st().ort, 5);
  assert.equal(st().scene.roll, 5);
  assert.equal(A.alive, false);
  assert.equal(Bp.alive, true);
  assert.equal(engine.players.C.alive, true);
  assert.equal(pl('C').shield, false);
  assert.deepEqual(st().scene.caught, ['A']);
  assert.deepEqual(st().scene.shielded, ['C']);
});

function toFightRound() {
  engine.clearPhaseTimer();
  engine.setGameState('PLAYING');
  engine.setRoundNumber(2); // เลขรอบจริงหลัง dealRound (รอบ 0 = ธงบางตัวยังผูกอยู่)
  for (const p of Object.values(engine.players)) p.locked = true;
}
function playRound(cardsA, cardsB) {
  engine.players.A.cards = cardsA; engine.players.B.cards = cardsB;
  resolveRound();
  engine.clearPhaseTimer();
  engine.purgeAdvance();
}
const W = [{ value: 10, color: 'blue' }, { value: 9, color: 'blue' }];
const Lz = [{ value: 5, color: 'blue' }];
const BUST = [{ value: 10, color: 'blue' }, { value: 9, color: 'blue' }, { value: 8, color: 'blue' }];

test('ปะทะ 2 รอบ: ชนะ 2-0 = ผู้แพ้ถอย 2 · ผู้ชมไม่เกี่ยว', () => {
  setup(['A', 'B', 'C']);
  put('A', 'm8'); put('B', 'm8'); put('C', 'm3');
  st().turn = 2;
  engine.purgeOrtPhase();
  assert.equal(st().fight.node, 'm8');
  assert.equal(purgeMod.benched(engine.players.C), true);
  toFightRound();
  playRound(W, Lz);
  assert.equal(st().fight.round, 2);
  toFightRound();
  playRound(W, Lz);
  assert.equal(pl('A').node, 'm8');
  assert.equal(pl('B').node, 'm6');
  assert.equal(pl('C').node, 'm3');
});

test('ปะทะ 2 รอบ: 1-1 = ถอยทั้งคู่ 2 · ไพ่แตกพร้อมกัน = รอบนั้นไม่มีใครชนะ', () => {
  setup(['A', 'B']);
  put('A', 'm8'); put('B', 'm8');
  st().turn = 2;
  engine.purgeOrtPhase();
  toFightRound();
  playRound(W, Lz);
  toFightRound();
  playRound(Lz, W);
  assert.equal(pl('A').node, 'm6');
  assert.equal(pl('B').node, 'm6');
  setup(['A', 'B']); clearTiles();
  put('A', 'm8'); put('B', 'm8');
  st().turn = 2;
  engine.purgeOrtPhase();
  toFightRound();
  playRound(W, Lz);
  toFightRound();
  playRound(BUST, BUST);
  // 1-0 (รอบที่แตกพร้อมกันไม่นับ) → A ชนะ
  assert.equal(pl('A').node, 'm8');
  assert.equal(pl('B').node, 'm6');
});

test('เลือดหมด = ล้มลง: ไม่ตาย ถอยหลัง 2 ช่อง เลือดเต็ม', () => {
  const { A } = setup(['A', 'B']);
  put('A', 'm12');
  A.hp = 0;
  engine.instantDeath(A);
  assert.equal(A.alive, true);
  assert.equal(pl('A').node, 'm10');
  assert.equal(A.hp, engine.maxHpOf(A));
});

test('ถึงประตูผนึก = ได้อันดับตามลำดับ · เกมจบเมื่อทุกคนเข้าเส้นชัยหรือโดนกิน', () => {
  const { B: Bp } = setup(['A', 'B', 'C']);
  rollPhase();
  put('A', 'm148'); put('B', 'm147'); put('C', 'm20');
  withDice([2], () => engine.purgeRoll('A'));
  withDice([6], () => engine.purgeRoll('B'));
  assert.deepEqual(st().finished, ['A', 'B']);
  assert.equal(pl('B').rank, 2);
  engine.clearPhaseTimer();
  Bp.alive = true;
  engine.players.C.alive = false; // C โดนกิน
  st().settling = false;
  rollPhase();
  assert.equal(engine.gameState, 'GAMEOVER');
  assert.equal(st().result, 'ranked');
  assert.equal(st().winnerId, 'A');
});

test('เวลาฉาก ORT ของ server ตรงกับ client', async () => {
  const client = await import('../client/src/purge/purgeScene.js');
  const cases = [
    { ortFrom: null, ortTo: 0, caught: [], fights: [] },
    { ortFrom: 4, ortTo: 9, caught: [], fights: [{ node: 'm3' }] },
    { ortFrom: 10, ortTo: 16, caught: ['x'], fights: [] },
  ];
  for (const c of cases) assert.equal(purgeMod.ortSceneSeconds(c), client.ortSceneSeconds(c));
  const { WARP_MS } = await import('../client/src/purge/warpGalaxy.js');
  assert.ok(client.INTRO_SECONDS + WARP_MS / 1000 <= 16, 'ฉากพุ่งเข้าทางช้างเผือก + ฉากเปิดในท่อ ต้องไม่ยาวกว่าเวลาที่ server พักไว้ (PURGE_INTRO_SECONDS ค่าเริ่มต้น 16)');
});
