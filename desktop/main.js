// ECHO 5.0 — โปรแกรมเปิดห้อง/เข้าร่วม (Electron)
//  หน้าแรก (launcher/) เป็นไฟล์ในเครื่อง · เข้าเกมแล้วหน้าต่างโหลดหน้าเกมจาก server ของห้อง (http://IP:3000)
//  ปุ่มลัด: F11 = สลับเต็มจอ · F10 = ออกจากห้องกลับหน้าแรก
const { app, BrowserWindow, Menu, ipcMain, clipboard, dialog, session, net } = require("electron");
const fs = require("fs");
const os = require("os");
const path = require("path");
const room = require("./room");
const { MediaCache, createHttpHandler } = require("./media");
const { R2_PUBLIC_URL, MEDIA_MANIFEST_URL } = require("./config");

const VERSION = app.getVersion();
// exe (ขั้นถัดไป) จะพกโค้ดเกมไว้ใน resources/game · ตอน dev ใช้ repo ตรงๆ
const GAME_ROOT = app.isPackaged ? path.join(process.resourcesPath, "game") : path.resolve(__dirname, "..");
const LAUNCHER = path.join(__dirname, "launcher", "index.html");
const MEDIA_DIRS = require(path.join(GAME_ROOT, "server", "mediaDirs.js"));
const ASSET_BASE_URL = process.env.ECHO_ASSET_BASE_URL || R2_PUBLIC_URL;
// รายการไฟล์สื่อ: exe ใช้ของ R2 เสมอ · ตอน dev ข้ามการโหลด (ใช้ client/public ตรงๆ) เว้นแต่ตั้ง ECHO_MEDIA_MANIFEST (path หรือ URL)
const MEDIA_MANIFEST = process.env.ECHO_MEDIA_MANIFEST || (app.isPackaged ? MEDIA_MANIFEST_URL : null);

// ห้องที่ exe เปิดรับเฉพาะ user agent ที่มี token นี้ (ดู server/app.js) — ต้องตั้งก่อนสร้างหน้าต่าง
const UA_TOKEN = `ECHO-Desktop/${VERSION}`;
app.userAgentFallback = `${app.userAgentFallback} ${UA_TOKEN}`;

let win = null;
let inGame = false;
let media = null; // MediaCache — สร้างหลัง app ready (ต้องรู้ path userData)
let mediaPrep = null; // Promise ของการเตรียมไฟล์สื่อรอบปัจจุบัน
let mediaReady = false;

// ---------- ค่าที่จำไว้ (IP ล่าสุด) ----------
const settingsFile = () => path.join(app.getPath("userData"), "settings.json");
function readSettings() {
  try {
    return JSON.parse(fs.readFileSync(settingsFile(), "utf8"));
  } catch {
    return {};
  }
}
function writeSettings(patch) {
  try {
    fs.writeFileSync(settingsFile(), JSON.stringify({ ...readSettings(), ...patch }, null, 2));
  } catch (err) {
    console.error("บันทึก settings ไม่สำเร็จ:", err);
  }
}

// ---------- IP ของเครื่องนี้ ----------
// Radmin VPN แจก IP ขึ้นต้น 26. — โชว์ก่อนเสมอ · IP วงแลนอื่นโชว์รองไว้ (เผื่อเล่นบ้านเดียวกัน)
function localAddresses() {
  const radmin = [];
  const other = [];
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    for (const a of addrs || []) {
      if (a.family !== "IPv4" || a.internal) continue;
      if (a.address.startsWith("26.")) radmin.push(a.address);
      else other.push({ name, address: a.address });
    }
  }
  return { radmin, other };
}

// รับได้ทั้ง "26.1.2.3" และ "26.1.2.3:3000"
function parseHost(input) {
  const text = String(input || "").trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  const m = text.match(/^([0-9]{1,3}(?:\.[0-9]{1,3}){3}|localhost)(?::([0-9]{1,5}))?$/);
  if (!m) return null;
  return { host: m[1], port: m[2] ? Number(m[2]) : room.PORT };
}

async function fetchJson(url, timeoutMs) {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ---------- หน้าต่าง ----------
function showLauncher(message) {
  inGame = false;
  win.loadFile(LAUNCHER, { query: message ? { message } : {} });
}

function enterGame(url) {
  inGame = true;
  win.loadURL(url);
}

async function leaveRoom() {
  if (!inGame) return;
  const hosting = room.isRunning();
  const { response } = await dialog.showMessageBox(win, {
    type: "question",
    buttons: ["ออกจากห้อง", "ยกเลิก"],
    defaultId: 1,
    cancelId: 1,
    title: "ECHO",
    message: "ออกจากห้องแล้วกลับหน้าแรก?",
    detail: hosting ? "คุณเป็นคนเปิดห้องนี้ — ออกแล้วห้องจะปิด ทุกคนในห้องจะหลุดจากเกม" : "",
  });
  if (response !== 0) return;
  room.stop();
  showLauncher();
}

function createWindow() {
  win = new BrowserWindow({
    title: "ECHO",
    fullscreen: !process.env.ECHO_WINDOWED, // ECHO_WINDOWED=1 ไว้ทดสอบตอน dev ไม่ให้ทับทั้งจอ
    width: 1280,
    height: 800,
    backgroundColor: "#07070d",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      sandbox: true,
    },
  });

  win.webContents.on("before-input-event", (event, input) => {
    if (input.type !== "keyDown") return;
    if (input.key === "F11") {
      event.preventDefault();
      win.setFullScreen(!win.isFullScreen());
    } else if (input.key === "F10") {
      event.preventDefault();
      leaveRoom();
    }
  });

  // หน้าเกมห้ามเปิดหน้าต่างใหม่/พาออกไปเว็บอื่น
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (event, url) => {
    const current = win.webContents.getURL();
    if (current && new URL(url).origin !== new URL(current).origin) event.preventDefault();
  });

  win.webContents.on("did-fail-load", (_e, code, desc, url, isMainFrame) => {
    if (!isMainFrame || !inGame || code === -3) return; // -3 = ABORTED (เปลี่ยนหน้าเอง)
    room.stop();
    showLauncher(`โหลดหน้าเกมไม่สำเร็จ (${desc}) — ห้องอาจปิดไปแล้ว`);
  });

  showLauncher();
}

// ---------- IPC จากหน้าแรก ----------
ipcMain.handle("echo:info", () => ({
  version: VERSION,
  lastHost: readSettings().lastHost || "",
  addresses: localAddresses(),
}));

ipcMain.handle("echo:copy", (_e, text) => {
  clipboard.writeText(String(text));
  return true;
});

// ด่านที่ 2: เตรียมไฟล์สื่อให้ครบก่อนเข้าห้อง — ล้มเหลว = เข้าห้องไม่ได้ (หน้าแรกมีปุ่มลองใหม่)
ipcMain.handle("echo:prepareMedia", (event) => {
  if (mediaReady) return { ok: true };
  if (!MEDIA_MANIFEST) {
    mediaReady = true;
    return { ok: true, skipped: true };
  }
  if (!mediaPrep) {
    mediaPrep = media
      .sync(MEDIA_MANIFEST, (progress) => {
        if (!event.sender.isDestroyed()) event.sender.send("echo:mediaProgress", progress);
      })
      .then(() => {
        mediaReady = true;
        return { ok: true };
      })
      .catch((err) => ({ ok: false, error: err.message }))
      .finally(() => {
        mediaPrep = null;
      });
  }
  return mediaPrep;
});

const NOT_READY = { ok: false, error: "ไฟล์เกมยังโหลดไม่ครบ" };

ipcMain.handle("echo:host", async () => {
  if (!mediaReady) return NOT_READY;
  const result = await room.start({
    gameRoot: GAME_ROOT,
    version: VERSION,
    assetBaseUrl: ASSET_BASE_URL,
    onExit: (code) => {
      if (win && !win.isDestroyed()) showLauncher(`เซิร์ฟเวอร์ของห้องหยุดทำงาน (รหัส ${code}) — ทุกคนหลุดจากห้อง`);
    },
  });
  return { ...result, addresses: localAddresses() };
});

ipcMain.handle("echo:enterHostedRoom", () => {
  if (!room.isRunning()) return { ok: false, error: "ห้องยังไม่ได้เปิด" };
  enterGame(`http://127.0.0.1:${room.PORT}`);
  return { ok: true };
});

ipcMain.handle("echo:closeHostedRoom", () => {
  room.stop();
  return { ok: true };
});

ipcMain.handle("echo:join", async (_e, input) => {
  if (!mediaReady) return NOT_READY;
  const target = parseHost(input);
  if (!target) return { ok: false, error: "รูปแบบ IP ไม่ถูกต้อง — ตัวอย่าง 26.123.45.67" };
  const base = `http://${target.host}:${target.port}`;
  let hostVersion;
  try {
    hostVersion = (await fetchJson(`${base}/version`, 5000)).version;
  } catch {
    return {
      ok: false,
      error: "ติดต่อห้องไม่ได้ — เช็คว่าเพื่อนเปิดห้องอยู่, ทั้งสองเครื่องต่อ Radmin VPN วงเดียวกัน และเครื่องที่เปิดห้องอนุญาต ECHO ใน Windows Firewall แล้ว",
    };
  }
  if (hostVersion !== VERSION) {
    return {
      ok: false,
      error: `เวอร์ชันไม่ตรงกัน — ของคุณ ${VERSION} · ของห้อง ${hostVersion} · ให้เครื่องที่เวอร์ชันเก่ากว่าปิดแล้วเปิด ECHO ใหม่เพื่ออัปเดต`,
    };
  }
  writeSettings({ lastHost: String(input).trim() });
  enterGame(base);
  return { ok: true };
});

ipcMain.handle("echo:quit", () => app.quit());

// ---------- วงจรชีวิตแอป ----------
if (!app.requestSingleInstanceLock()) {
  app.quit(); // เปิดซ้อน 2 ตัวจะแย่งพอร์ต 3000 กัน — ให้หน้าต่างเดิมเด้งขึ้นมาแทน
} else {
  app.on("second-instance", () => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
  });
  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    session.defaultSession.setUserAgent(app.userAgentFallback);
    media = new MediaCache({ cacheDir: path.join(app.getPath("userData"), "media"), remoteBase: ASSET_BASE_URL, dirs: MEDIA_DIRS });
    // ไฟล์สื่อตอบจากแคชที่ origin เดิมของหน้าเกม (ดูเหตุผลใน media.js) · คำขออื่นส่งต่อตามปกติ
    session.defaultSession.protocol.handle("http", createHttpHandler({
      cache: media,
      dirs: MEDIA_DIRS,
      remoteBase: ASSET_BASE_URL,
      devPublicDir: app.isPackaged ? null : path.join(GAME_ROOT, "client", "public"),
      passThrough: (request) => net.fetch(request, { bypassCustomProtocolHandlers: true }),
      fetchRemote: (url, init) => net.fetch(url, { ...init, bypassCustomProtocolHandlers: true }),
    }));
    createWindow();
  });
  app.on("window-all-closed", () => app.quit());
  app.on("before-quit", () => room.stop());
}
