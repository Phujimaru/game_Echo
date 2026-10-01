// ห้องรอ: อีโมตปักบนลูกโลก — server ตรวจข้อมูล (อีโมตในรายการ / ทิศเป็นตัวเลข) จำกัดความถี่ แล้วส่งต่อให้ทุกคนในห้อง
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const { io } = require('../client/node_modules/socket.io-client');

const projectRoot = path.resolve(__dirname, '..');
const port = 36000 + (process.pid % 1000);
const url = `http://127.0.0.1:${port}`;

function waitForEvent(socket, event, predicate = () => true, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { socket.off(event, listener); reject(new Error(`Timed out waiting for ${event}`)); }, timeoutMs);
    function listener(payload) {
      if (!predicate(payload)) return;
      clearTimeout(timer);
      socket.off(event, listener);
      resolve(payload);
    }
    socket.on(event, listener);
  });
}
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitForHttp() {
  for (let i = 0; i < 40; i++) {
    try { const r = await fetch(url); if (r.ok) return; } catch {}
    await delay(100);
  }
  throw new Error('Server did not become ready');
}
async function connectClient() {
  const socket = io(url, { autoConnect: false, forceNew: true, reconnection: false });
  const connected = waitForEvent(socket, 'connect');
  socket.connect();
  await connected;
  return socket;
}
// เก็บอีโมตที่ได้รับทั้งหมดของ socket นี้
function collect(socket) {
  const got = [];
  socket.on('lobbyEmote', (e) => got.push(e));
  return got;
}

test('อีโมตห้องรอ: ส่งต่อให้ทุกคน (สีคนส่ง + ทิศปรับเป็นหน่วย) · ข้อมูลผิด/ส่งถี่/นอกห้องรอ ถูกทิ้ง', { timeout: 25000 }, async () => {
  const server = spawn(process.execPath, ['server.js'], {
    cwd: projectRoot,
    env: { ...process.env, PORT: String(port) },
    stdio: 'ignore',
  });
  const sockets = [];
  try {
    await waitForHttp();
    const a = await connectClient();
    const b = await connectClient();
    sockets.push(a, b);

    const aJoined = waitForEvent(a, 'joined');
    a.emit('join', { name: 'Ann', position: 1, characterId: 'hikaru', color: '#123abc' });
    await aJoined;
    const bState = waitForEvent(b, 'state', (s) => s.players.length === 2);
    b.emit('join', { name: 'Bee', position: 2, characterId: 'hikaru' });
    const st = await bState;
    const ann = st.players.find((p) => p.name === 'Ann');

    const gotA = collect(a);
    const gotB = collect(b);

    // ส่งปกติ -> ทั้งสองคนได้รับ (รวมคนส่งเอง)
    const bGets = waitForEvent(b, 'lobbyEmote');
    a.emit('lobbyEmote', { emoji: '🔥', dir: [0, 0, 2] });
    const e1 = await bGets;
    assert.deepEqual(e1, { emoji: '🔥', dir: [0, 0, 1], color: '#123ABC', playerId: ann.id });
    await delay(150);
    assert.equal(gotA.length, 1, 'คนส่งเห็นอีโมตของตัวเองด้วย');
    assert.equal(gotB.length, 1);

    // ส่งถี่เกิน (ภายใน 600 ms) -> ทิ้ง
    a.emit('lobbyEmote', { emoji: '👋', dir: [1, 0, 0] });
    await delay(250);
    assert.equal(gotB.length, 1, 'ส่งซ้ำเร็วเกินไปต้องถูกทิ้ง');

    // ข้อมูลผิดรูปแบบ (เว้นระยะให้พ้นตัวจำกัดความถี่ทุกครั้ง) -> ไม่มีใครได้รับ
    const bad = [
      { emoji: '💩', dir: [0, 1, 0] },
      { emoji: '<b>x</b>', dir: [0, 1, 0] },
      { emoji: '🔥', dir: [0, 0, 0] },
      { emoji: '🔥', dir: [0, 1] },
      { emoji: '🔥', dir: ['0', '1', '0'] },
      { emoji: '🔥', dir: [null, 1, 0] },
      { emoji: '🔥', dir: [0, 1, 0, 0] },
      { emoji: '🔥' },
      null,
    ];
    for (const payload of bad) {
      await delay(650);
      a.emit('lobbyEmote', payload);
    }
    await delay(300);
    assert.equal(gotB.length, 1, 'ข้อมูลผิดต้องไม่ถูกส่งต่อ');

    // หน้าเลือกโหมด (TEAM_MODE) ยังส่งได้
    const teamMode = waitForEvent(b, 'state', (s) => s.gameState === 'TEAM_MODE');
    a.emit('toggleReady');
    b.emit('toggleReady');
    await teamMode;
    await delay(650);
    const aGets = waitForEvent(a, 'lobbyEmote');
    b.emit('lobbyEmote', { emoji: '❤️', dir: [0, -3, 4] });
    const e2 = await aGets;
    assert.equal(e2.emoji, '❤️');
    assert.deepEqual(e2.dir, [0, -0.6, 0.8]);
    assert.equal(e2.playerId, st.players.find((p) => p.name === 'Bee').id);

    // เริ่มเกมแล้ว -> ไม่รับอีโมตอีก
    const started = waitForEvent(a, 'state', (s) => !['LOBBY', 'TEAM_MODE', 'TEAM_SETUP'].includes(s.gameState));
    a.emit('selectGameMode', { mode: 'ffa' });
    b.emit('selectGameMode', { mode: 'ffa' });
    await started;
    const before = gotA.length;
    await delay(650);
    a.emit('lobbyEmote', { emoji: '🔥', dir: [0, 0, 1] });
    await delay(400);
    assert.equal(gotA.length, before, 'นอกห้องรอต้องไม่ส่งต่อ');
  } finally {
    for (const s of sockets) s.close();
    server.kill();
  }
});
