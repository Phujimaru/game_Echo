// ปุ่มย้อนกลับก่อนเริ่มเกมต้องถอยทีละขั้น: จัดทีม -> เลือกโหมด (teamBackToMode) -> ห้องรอ (modeBackToLobby)
//  modeBackToLobby ใช้ได้เฉพาะหน้าเลือกโหมด · กลับห้องรอแล้วทุกคน "ยังไม่พร้อม" และโหวตโหมดถูกล้าง
//  เล่นคนเดียว: เลือกโหมด -> ย้อนกลับห้องรอ -> กดเล่นคนเดียวใหม่ได้
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const { io } = require('../client/node_modules/socket.io-client');

const projectRoot = path.resolve(__dirname, '..');
// เทสต์ละพอร์ต (38xxx / 39xxx) — server ของเทสต์ก่อนอาจยังปิดไม่เสร็จ
let port = 0;
let url = '';
function usePort(base) { port = base + (process.pid % 1000); url = `http://127.0.0.1:${port}`; }

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
function startServer() {
  return spawn(process.execPath, ['server.js'], {
    cwd: projectRoot,
    env: { ...process.env, PORT: String(port), RECONNECT_GRACE_MS: '100' },
    stdio: 'ignore',
  });
}

test('ย้อนกลับทีละขั้น: จัดทีม -> เลือกโหมด -> ห้องรอ (ทุกคนยกเลิกพร้อม)', { timeout: 30000 }, async () => {
  usePort(38000);
  const server = startServer();
  const sockets = [];
  try {
    await waitForHttp();
    const names = ['Ann', 'Bee', 'Cat', 'Dee'];
    for (let i = 0; i < names.length; i++) {
      const s = await connectClient();
      sockets.push(s);
      const joined = waitForEvent(s, 'joined');
      s.emit('join', { name: names[i], position: i + 1, characterId: 'hikaru' });
      await joined;
    }
    const [a] = sockets;
    let latest = null;
    a.on('state', (s) => { latest = s; });
    await waitForEvent(a, 'state', (s) => s.players.length === 4);

    // modeBackToLobby ในห้องรอ = ไม่มีผล
    a.emit('modeBackToLobby');
    await delay(200);
    assert.equal(latest.gameState, 'LOBBY');

    // พร้อมครบ -> เลือกโหมด
    let next = waitForEvent(a, 'state', (s) => s.gameState === 'TEAM_MODE');
    for (const s of sockets) s.emit('toggleReady');
    await next;

    // โหวตคู่หูครบ -> จัดทีม
    next = waitForEvent(a, 'state', (s) => s.gameState === 'TEAM_SETUP');
    for (const s of sockets) s.emit('selectGameMode', { mode: 'duo' });
    await next;

    // modeBackToLobby ระหว่างจัดทีม = ไม่มีผล (ต้องถอยทีละขั้น)
    a.emit('modeBackToLobby');
    await delay(200);
    assert.equal(latest.gameState, 'TEAM_SETUP');

    // จัดทีม -> เลือกโหมด
    next = waitForEvent(a, 'state', (s) => s.gameState === 'TEAM_MODE');
    a.emit('teamBackToMode');
    const tm = await next;
    assert.equal(tm.gameMode, 'pending');
    assert.equal(tm.players.every((p) => !p.modeVote), true, 'โหวตถูกล้าง');

    // โหวตไว้บางส่วนแล้วถอย -> ห้องรอ ทุกคนยังไม่พร้อม โหวตหาย
    a.emit('selectGameMode', { mode: 'ffa' });
    await waitForEvent(a, 'state', (s) => s.players.some((p) => p.modeVote === 'ffa'));
    next = waitForEvent(a, 'state', (s) => s.gameState === 'LOBBY');
    sockets[1].emit('modeBackToLobby'); // ใครกดก็ได้
    const lobby = await next;
    assert.equal(lobby.players.length, 4, 'ไม่มีใครถูกเตะออกจากห้อง');
    assert.equal(lobby.players.every((p) => !p.ready), true, 'ทุกคนยกเลิกพร้อม');
    assert.equal(lobby.players.every((p) => !p.modeVote), true, 'โหวตโหมดถูกล้าง');
    assert.equal(lobby.players.every((p) => !p.teamId), true);

    // ยังอยู่ห้องรอจนกว่าจะพร้อมครบใหม่
    await delay(300);
    assert.equal(latest.gameState, 'LOBBY');
    next = waitForEvent(a, 'state', (s) => s.gameState === 'TEAM_MODE');
    for (const s of sockets) s.emit('toggleReady');
    await next;
  } finally {
    for (const s of sockets) s.disconnect();
    server.kill();
  }
});

test('เล่นคนเดียว: เลือกโหมด -> ย้อนกลับห้องรอ -> เล่นคนเดียวใหม่ได้', { timeout: 25000 }, async () => {
  usePort(39000);
  const server = startServer();
  const sockets = [];
  try {
    await waitForHttp();
    const a = await connectClient();
    sockets.push(a);
    const joined = waitForEvent(a, 'joined');
    a.emit('join', { name: 'Solo', position: 1, characterId: 'hikaru' });
    await joined;

    let next = waitForEvent(a, 'state', (s) => s.gameState === 'TEAM_MODE');
    a.emit('startGame');
    await next;

    next = waitForEvent(a, 'state', (s) => s.gameState === 'LOBBY');
    a.emit('modeBackToLobby');
    const lobby = await next;
    assert.equal(lobby.players.length, 1);
    assert.equal(lobby.players[0].ready, false);

    await delay(1100); // พ้นช่วงจำกัดความถี่ของ startGame
    next = waitForEvent(a, 'state', (s) => s.gameState === 'TEAM_MODE');
    a.emit('startGame');
    await next;

    const started = waitForEvent(a, 'state', (s) => s.gameState !== 'TEAM_MODE');
    a.emit('selectGameMode', { mode: 'ffa' });
    const st = await started;
    assert.equal(st.gameMode, 'ffa');
  } finally {
    for (const s of sockets) s.disconnect();
    server.kill();
  }
});
