const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const policy = vm.createContext({});
vm.runInContext(fs.readFileSync(require.resolve('../client/src/audioPolicy.js'), 'utf8').replace(/^export /gm, ''), policy);
const night = { gameState: 'PLAYING', cycle: 'night' };

test('music follows cutscene -> skill -> day/night priority', () => {
  const skill = { ...night, skillMusic: 'dummy', skillMusicSeq: 5 };
  assert.equal(policy.musicForState(night).name, 'new_night');
  assert.equal(policy.musicForState(skill).name, 'dummy');
  assert.equal(policy.musicForState(skill).seq, 5);
  const cutscene = { ...skill, gameState: 'CUTSCENE', cutscene: { id: 1, video: 'skill.mp4' } };
  assert.equal(policy.musicForState(cutscene).name, null);
  assert.equal(policy.musicForState(cutscene, { lowQ: true }).name, 'dummy');
});

test('voice announcements and mandatory clips stay silent in low quality; private clips do not silence outsiders', () => {
  for (const cs of [{ announce: true, voice: 'ex_k' }, { kind: 'overloadForce' }]) {
    assert.equal(policy.musicForState({ ...night, gameState: 'CUTSCENE', cutscene: cs }, { lowQ: true }).name, null);
  }
  assert.equal(policy.musicForState({ ...night, gameState: 'CUTSCENE', cutscene: null }).name, 'new_night');
});

test('attack phase music restarts per attack; lobby screens keep lobby music', () => {
  const atk = policy.musicForState({ ...night, gameState: 'ATTACK' }, { attackSeq: 3 });
  assert.equal(atk.name, 'battle_phase');
  assert.equal(atk.seq, 3);
  assert.equal(policy.musicForState({ ...night, gameState: 'ATTACKING', skillMusic: 'dummy' }).name, 'dummy');
  assert.equal(policy.musicForState({ gameState: 'PLAYING', cycle: 'day' }).name, 'new_morning');
  assert.equal(policy.musicForState(null).name, 'lobby5');
  assert.equal(policy.musicForState({ ...night, gameState: 'LOBBY', skillMusic: 'shiki' }).name, 'lobby5');
  assert.equal(policy.musicForState({ gameState: 'TEAM_MODE' }).name, 'lobby5');
  // ฉากเปิดตัวแมตช์ยังเป็นเพลงห้องรอ จนเข้าด่าน
  assert.equal(policy.musicForState({ gameState: 'CUTSCENE', journey: { area: 1, scene: { active: true, seq: 1 } } }, { intro: true }).name, 'lobby5');
});

test('round sound survives intermediate cutscenes and broadcasts; attack sound follows every attack ID', () => {
  const track = policy.createPhaseSoundTracker();
  const state = { roundNumber: 1 };
  track({ ...state, gameState: 'PLAYING' });
  assert.equal(track({ ...state, gameState: 'CUTSCENE' }).roundEnded, false);
  assert.equal(track({ ...state, gameState: 'SUMMARY' }).roundEnded, true);
  assert.equal(track({ ...state, gameState: 'SUMMARY' }).roundEnded, false);
  assert.equal(track({ ...state, gameState: 'ATTACKING', attack: { id: 1 } }).attack, true);
  assert.equal(track({ ...state, gameState: 'ATTACKING', attack: { id: 1 } }).attack, false);
  assert.equal(track({ ...state, gameState: 'ATTACKING', attack: { id: 2 } }).attack, true);
  track({ gameState: 'LOBBY' });
  track({ ...state, gameState: 'PLAYING' });
  assert.equal(track({ ...state, gameState: 'SUMMARY' }).roundEnded, true);
});

test('การเดินทาง: เพลงประจำภูมิภาคแยกกลางวัน/กลางคืน · ฉากเปลี่ยนภูมิภาคเล่นเพลงภูมิภาคใหม่ (ไม่มีเพลงแผนที่) · ช่วงโจมตียังเป็นเพลงโจมตี', () => {
  const j = (area, night, scene = null) => ({ gameState: 'PLAYING', cycle: night ? 'night' : 'day', journey: { area, night, scene } });
  assert.equal(policy.musicForState(j(3, false)).name, 'journey_3_day');
  assert.equal(policy.musicForState(j(7, true)).name, 'journey_7_night');
  const travel = { ...j(2, false, { seq: 4, active: true, mode: 'advance' }), gameState: 'CUTSCENE', cutscene: null };
  assert.deepEqual({ ...policy.musicForState(travel, { cycleSeq: 3 }) }, { name: 'journey_2_day', seq: 3 });
  for (const area of [1, 4, 7]) assert.notEqual(policy.musicForState({ ...j(area, true, { seq: 9, active: true, mode: 'advance' }), gameState: 'CUTSCENE', cutscene: null }).name, 'journey_map');
  assert.equal(policy.musicForState({ ...j(2, false), gameState: 'ATTACK' }).name, 'battle_phase');
  assert.equal(policy.musicForState({ ...j(2, false, { seq: 4, active: false }) }).name, 'journey_2_day');
});

// โหมด Purge: เพลงด่านเปลี่ยนตามสถานการณ์ในท่อ
test('Purge: เพลงด่านตาม ORT / ระยะห่าง / 2 คนสุดท้าย', async () => {
  const { musicForState } = await import('../client/src/audioPolicy.js');
  const board = { nodes: [10, 12, 9, 1].map((n) => ({ id: `m${n}`, prog: n })) };
  const pg = (ort, at = { a: 10, b: 12, c: 9 }, scene = null) => ({
    ort, scene, board, pl: Object.fromEntries(Object.entries(at).map(([id, n]) => [id, { node: `m${n}` }])),
  });
  const base = (over = {}) => ({
    gameState: 'PURGE_ROLL', youId: 'a',
    players: [{ id: 'a', alive: true }, { id: 'b', alive: true }, { id: 'c', alive: true }],
    purge: pg(null),
    ...over,
  });
  assert.equal(musicForState(base()).name, 'purge_normal');
  assert.equal(musicForState(base({ purge: pg(2) })).name, 'purge_ort');
  assert.equal(musicForState(base({ purge: pg(6) })).name, 'purge_close');
  const two = base({ players: [{ id: 'a', alive: true }, { id: 'b', alive: true }, { id: 'c', alive: false }] });
  assert.equal(musicForState(two).name, 'purge_final');
  // ซูมออก (ฉาก ORT): เพลงท่าไม้ตายของผู้เล่นปิดไว้ เหลือแต่เพลงด่าน
  const scene = base({ gameState: 'CUTSCENE', skillMusic: 'some_ult', purge: pg(null, { a: 1 }, { active: true }) });
  assert.equal(musicForState(scene).name, 'purge_normal');
  // กลับเข้าสนาม: เพลงท่าไม้ตายเล่นตามปกติ
  assert.equal(musicForState(base({ gameState: 'PLAYING', skillMusic: 'some_ult' })).name, 'some_ult');
});

// Purge: ทอยเต๋า ↔ ฉาก ORT ↔ ปะทะ อยู่ในแมตช์ทั้งหมด — ตำแหน่งเพลงด่านไม่ถูกรีเซ็ต (เพลง ORT ไม่เริ่มใหม่ทุกเทิร์น)
test('Purge: เฟสทอยเต๋านับว่าอยู่ในแมตช์', async () => {
  const { isMatchPhase } = await import('../client/src/audioPolicy.js');
  for (const ph of ['PURGE_ROLL', 'CUTSCENE', 'PLAYING', 'SUMMARY', 'ATTACK', 'ATTACKING', 'TRANSITION']) assert.equal(isMatchPhase(ph), true, ph);
  for (const ph of ['LOBBY', 'TEAM_MODE', 'GAMEOVER', undefined]) assert.equal(isMatchPhase(ph), false, String(ph));
});

