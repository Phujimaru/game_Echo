// อุซากิ ท่าไม้ตาย ผ่าน engine จริง: กดแล้วแจกโจทย์ทันที + ทำงานครบ 3 เทิร์น
//  (บั๊กเดิม: ตัวนับ usagiMath ถูกลดทั้งต้นเทิร์นและใน endTurn -> ทำงานแค่รอบเดียว)
process.env.JOURNEY_START_SECONDS = '0';
const test = require('node:test');
const assert = require('node:assert/strict');
const { engine } = require('../../server.js');

const delay = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitState(pred, ms = 8000) {
  for (let i = 0; i < ms / 50; i++) { if (pred()) return true; await delay(50); }
  return false;
}

test.after(() => { engine.clearPhaseTimer(); for (const id of Object.keys(engine.players)) delete engine.players[id]; });

test('ท่าไม้ตายอุซากิ: แจกโจทย์ทันทีตอนกด แล้วแจกต่ออีก 2 เทิร์น รวม 3 เทิร์น', async () => {
  for (const id of Object.keys(engine.players)) delete engine.players[id];
  [['u', 'usagi'], ['foe', 'kai']].forEach(([id, ch], i) => {
    engine.players[id] = { id, name: id, position: i + 1, characterId: ch, alive: true, connected: true, cards: [], statuses: {}, statusAmt: {}, seen: {}, inventory: [], teamId: null };
  });
  engine.setGameMode('ffa');
  engine.startMatch();
  engine.clearPhaseTimer();
  const u = engine.players.u;
  const foe = engine.players.foe;
  foe.hp = 7; foe.armor = 3;
  u.skillPoints = 8;
  engine.useSkill('u', 'ultimate');
  assert.ok(foe.usagiQuiz, 'เทิร์นที่กด: โจทย์ขึ้นทันที');
  engine.clearPhaseTimer();

  let quizTurns = 1;
  for (let turn = 0; turn < 3; turn++) {
    foe.usagiQuiz = null; // ถือว่าตอบครบแล้ว
    engine.setGameState('SUMMARY');
    const round = engine.roundNumber;
    engine.endTurn();
    assert.ok(await waitState(() => engine.gameState === 'PLAYING' && engine.roundNumber === round + 1), `เข้าเทิร์น ${round + 1}`);
    engine.clearPhaseTimer();
    if (foe.usagiQuiz) quizTurns++;
  }
  assert.equal(quizTurns, 3, 'ทำงานครบ 3 เทิร์น (เทิร์นที่กด + อีก 2 เทิร์น) แล้วหยุด');
  assert.equal(u.statuses.usagiMath, undefined, 'หมดผลแล้ว กดใหม่ได้');
});
