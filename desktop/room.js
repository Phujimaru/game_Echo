// ห้องที่เครื่องนี้เปิด (host) — รัน server.js ของเกมเป็น process แยกด้วย utilityProcess
//  - process แยก: server พังไม่ลากหน้าต่างพังตาม, ตาข่าย error + listen ใน server.js ทำงานเหมือนรันด้วย node
//  - ปิดห้อง = kill process ทิ้ง สถานะแมตช์ (เก็บระดับโมดูลใน server/match.js) หายหมด เปิดใหม่ได้ห้องสะอาด
const { utilityProcess } = require("electron");
const net = require("net");
const path = require("path");

const PORT = 3000;

let child = null;
let onUnexpectedExit = null;

// เช็คก่อนว่าพอร์ตว่าง — ถ้าปล่อยให้ server.js ชนเอง error จะถูกตาข่าย uncaughtException กลืน
//  process ยังอยู่แต่ไม่ได้ listen แอปจะรอเก้อ
function portFree(port) {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.once("error", () => resolve(false));
    probe.once("listening", () => probe.close(() => resolve(true)));
    probe.listen(port);
  });
}

async function waitUntilReady(version, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!child) return false; // process ตายไประหว่างรอ
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/version`);
      if (res.ok && (await res.json()).version === version) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 150));
  }
  return false;
}

// เปิดห้อง — คืน { ok: true, port } หรือ { ok: false, error: "<ข้อความภาษาไทย>" }
async function start({ gameRoot, version, assetBaseUrl, onExit }) {
  if (child) return { ok: true, port: PORT };
  if (!(await portFree(PORT))) {
    return { ok: false, error: `พอร์ต ${PORT} ถูกโปรแกรมอื่นใช้อยู่` };
  }
  const env = { ...process.env, PORT: String(PORT), ECHO_VERSION: version };
  delete env.ELECTRON_RUN_AS_NODE;
  if (assetBaseUrl) env.ASSET_BASE_URL = assetBaseUrl;
  child = utilityProcess.fork(path.join(gameRoot, "server.js"), [], {
    cwd: gameRoot,
    env,
    serviceName: "ECHO room server",
    stdio: "pipe",
  });
  child.stdout?.on("data", (d) => process.stdout.write(`[room] ${d}`));
  child.stderr?.on("data", (d) => process.stderr.write(`[room] ${d}`));
  onUnexpectedExit = onExit;
  child.once("exit", (code) => {
    const notify = onUnexpectedExit;
    child = null;
    onUnexpectedExit = null;
    if (notify) notify(code);
  });

  if (await waitUntilReady(version, 15000)) return { ok: true, port: PORT };
  stop();
  return { ok: false, error: "เปิดห้องไม่สำเร็จ" };
}

// ปิดห้องโดยตั้งใจ — ไม่เรียก onExit (ไม่ใช่การพัง)
function stop() {
  onUnexpectedExit = null;
  if (child) child.kill();
  child = null;
}

function isRunning() {
  return !!child;
}

module.exports = { PORT, start, stop, isRunning };
