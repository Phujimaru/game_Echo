const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const { io } = require('../client/node_modules/socket.io-client');

// /version + ด่าน "เข้าได้เฉพาะแอป" — exe ใช้ตรวจว่าเวอร์ชันของเครื่อง host ตรงกับตัวเองก่อนเข้าห้อง (ECHO 5.0)
const projectRoot = path.resolve(__dirname, '..');
const APP_UA = 'Mozilla/5.0 Chrome/140 Electron/44 ECHO-Desktop/5.0.0';

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withServer(port, extraEnv, fn) {
  const env = { ...process.env, PORT: String(port), ...extraEnv };
  if (!('ECHO_VERSION' in extraEnv)) delete env.ECHO_VERSION;
  const server = spawn(process.execPath, ['server.js'], { cwd: projectRoot, env, stdio: 'ignore' });
  try {
    for (let i = 0; i < 40; i++) {
      try {
        if ((await fetch(`http://127.0.0.1:${port}/version`)).ok) return await fn(`http://127.0.0.1:${port}`);
      } catch {}
      await delay(100);
    }
    throw new Error('Server did not become ready');
  } finally {
    server.kill();
  }
}

// ผลการเชื่อมต่อ socket: 'connect' หรือข้อความ error ของ connect_error
function trySocket(url, userAgent) {
  return new Promise((resolve) => {
    const socket = io(url, { forceNew: true, reconnection: false, transports: ['websocket'], extraHeaders: userAgent ? { 'user-agent': userAgent } : {} });
    socket.on('connect', () => { socket.close(); resolve('connect'); });
    socket.on('connect_error', (err) => { socket.close(); resolve(err.message); });
  });
}

test('/version returns ECHO_VERSION from the exe, uncached and readable cross-origin', { timeout: 10000 }, async () => {
  await withServer(33000 + (process.pid % 1000), { ECHO_VERSION: '5.0.0' }, async (url) => {
    const response = await fetch(`${url}/version`);
    assert.deepEqual(await response.json(), { version: '5.0.0' });
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('access-control-allow-origin'), '*');
  });
});

test('exe-hosted room only admits the ECHO app of the same version', { timeout: 10000 }, async () => {
  await withServer(35000 + (process.pid % 1000), { ECHO_VERSION: '5.0.0' }, async (url) => {
    assert.equal((await fetch(url)).status, 403, 'plain browser is turned away');
    assert.equal((await fetch(url, { headers: { 'user-agent': 'Electron/44 ECHO-Desktop/5.0.1' } })).status, 403, 'other version is turned away');
    assert.notEqual((await fetch(url, { headers: { 'user-agent': APP_UA } })).status, 403, 'same-version app gets in');

    assert.equal(await trySocket(url, null), 'desktop-only');
    assert.equal(await trySocket(url, 'Electron/44 ECHO-Desktop/4.9.9'), 'desktop-only');
    assert.equal(await trySocket(url, APP_UA), 'connect');
  });
});

test('/version falls back to "dev" and the room stays open to browsers when not launched by the exe', { timeout: 10000 }, async () => {
  await withServer(34000 + (process.pid % 1000), {}, async (url) => {
    assert.deepEqual(await (await fetch(`${url}/version`)).json(), { version: 'dev' });
    assert.notEqual((await fetch(url)).status, 403);
    assert.equal(await trySocket(url, null), 'connect');
  });
});
