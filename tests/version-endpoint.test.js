const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');

// /version — exe ใช้ตรวจว่าเวอร์ชันของเครื่อง host ตรงกับตัวเองก่อนเข้าห้อง (ECHO 5.0)
const projectRoot = path.resolve(__dirname, '..');

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
        const response = await fetch(`http://127.0.0.1:${port}/version`);
        if (response.ok) return await fn(response);
      } catch {}
      await delay(100);
    }
    throw new Error('Server did not become ready');
  } finally {
    server.kill();
  }
}

test('/version returns ECHO_VERSION from the exe, uncached and readable cross-origin', { timeout: 10000 }, async () => {
  await withServer(33000 + (process.pid % 1000), { ECHO_VERSION: '5.0.0' }, async (response) => {
    assert.deepEqual(await response.json(), { version: '5.0.0' });
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('access-control-allow-origin'), '*');
  });
});

test('/version falls back to "dev" when not launched by the exe', { timeout: 10000 }, async () => {
  await withServer(34000 + (process.pid % 1000), {}, async (response) => {
    assert.deepEqual(await response.json(), { version: 'dev' });
  });
});
