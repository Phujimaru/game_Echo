// ห้องรอ: ปุ่ม "เล่นคนเดียว (ทดสอบ)" (startGame) ต้องผ่านหน้าเลือกโหมดเหมือนเกมปกติ
//  คนเดียว -> TEAM_MODE (อิสระ + Type Mercury โหวตได้) · มีหลายคน -> startGame ไม่มีผล (ต้องกดพร้อมครบ)
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const { io } = require('../client/node_modules/socket.io-client');

const projectRoot = path.resolve(__dirname, '..');
const port = 37000 + (process.pid % 1000);
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

test('เล่นคนเดียว (ทดสอบ): startGame เข้าหน้าเลือกโหมด ไม่เริ่มแมตช์ทันที · หลายคนกดไม่มีผล', { timeout: 25000 }, async () => {
  const server = spawn(process.execPath, ['server.js'], {
    cwd: projectRoot,
    env: { ...process.env, PORT: String(port), RECONNECT_GRACE_MS: '100' },
    stdio: 'ignore',
  });
  const sockets = [];
  try {
    await waitForHttp();
    const a = await connectClient();
    const b = await connectClient();
    sockets.push(a, b);
    let latest = null;
    a.on('state', (s) => { latest = s; });

    const aJoined = waitForEvent(a, 'joined');
    a.emit('join', { name: 'Ann', position: 1, characterId: 'hikaru' });
    await aJoined;
    const two = waitForEvent(a, 'state', (s) => s.players.length === 2);
    b.emit('join', { name: 'Bee', position: 2, characterId: 'hikaru' });
    await two;

    // มี 2 คน: startGame ไม่มีผล (ต้องกดพร้อมครบ)
    a.emit('startGame');
    await delay(250);
    assert.equal(latest.gameState, 'LOBBY', 'startGame ใช้ได้เฉพาะตอนอยู่คนเดียว');
    assert.equal(latest.players.every((p) => !p.ready), true, 'startGame ต้องไม่ตั้งพร้อมให้ใคร');

    // คนที่สองออก -> เหลือคนเดียว
    const alone = waitForEvent(a, 'state', (s) => s.players.length === 1, 4000);
    b.disconnect();
    await alone;
    await delay(1100); // พ้นช่วงจำกัดความถี่ของ startGame

    const modeSelect = waitForEvent(a, 'state', (s) => s.gameState !== 'LOBBY');
    a.emit('startGame');
    const tm = await modeSelect;
    assert.equal(tm.gameState, 'TEAM_MODE', 'ผ่านหน้าเลือกโหมดเหมือนเกมปกติ');
    assert.equal(tm.gameMode, 'pending');
    assert.equal(tm.players[0].ready, true);
    const byMode = Object.fromEntries(tm.modeOptions.map((o) => [o.mode, o]));
    assert.equal(byMode.ffa.enabled, true, 'อิสระเล่นคนเดียวได้ (ทดสอบ)');
    assert.equal(byMode.mercury.enabled, true, 'Type Mercury รองรับ 1 คน');
    assert.equal(byMode.duo.enabled, false);
    assert.equal(byMode.trio.enabled, false);

    // startGame ซ้ำระหว่างเลือกโหมด -> ไม่มีผล
    a.emit('startGame');
    await delay(200);
    assert.equal(latest.gameState, 'TEAM_MODE');

    // โหวตโหมดที่คนไม่พอ -> ไม่มีผล
    a.emit('selectGameMode', { mode: 'duo' });
    await delay(200);
    assert.equal(latest.gameState, 'TEAM_MODE');

    // โหวตอิสระ -> แมตช์เริ่ม
    const started = waitForEvent(a, 'state', (s) => s.gameState !== 'TEAM_MODE');
    a.emit('selectGameMode', { mode: 'ffa' });
    const st = await started;
    assert.notEqual(st.gameState, 'LOBBY');
    assert.equal(st.gameMode, 'ffa');
  } finally {
    for (const s of sockets) s.disconnect();
    server.kill();
  }
});
