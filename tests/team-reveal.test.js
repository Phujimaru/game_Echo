// โหมดทีม (duo/trio) และ Type Mercury: เพื่อนร่วมทีมเห็นแต้มการ์ดกันตลอดเวลา — ศัตรูยังถูกซ่อน
process.env.JOURNEY_START_SECONDS = '0';
const test = require('node:test');
const assert = require('node:assert/strict');
const { engine } = require('../server.js');

const mk = (id, pos, teamId) => ({ id, name: id, position: pos, characterId: 'kai', alive: true, connected: true, cards: [], statuses: {}, statusAmt: {}, seen: {}, inventory: [], teamId });
function setup(mode) {
  for (const id of Object.keys(engine.players)) delete engine.players[id];
  engine.players.A = mk('A', 1, 'A');
  engine.players.B = mk('B', 2, 'A');
  engine.players.C = mk('C', 3, 'B');
  engine.setGameMode(mode);
  engine.startMatch();
  engine.clearPhaseTimer();
  const score = (viewer, id) => engine.buildStateFor(viewer).players.find((p) => p.id === id).score;
  return score;
}
test.after(() => { engine.clearPhaseTimer(); engine.setGameMode('ffa'); for (const id of Object.keys(engine.players)) delete engine.players[id]; });

for (const mode of ['duo', 'trio']) {
  test(`${mode}: เห็นแต้มเพื่อนร่วมทีมระหว่างจั่ว แต่ไม่เห็นศัตรู`, () => {
    const score = setup(mode);
    assert.equal(engine.gameState, 'PLAYING');
    assert.notEqual(score('A', 'B'), null);
    assert.equal(score('A', 'C'), null);
    assert.equal(score('C', 'A'), null);
  });
}

test('ffa: ไม่เห็นแต้มคนอื่นระหว่างจั่ว', () => {
  const score = setup('ffa');
  assert.equal(score('A', 'B'), null);
});
