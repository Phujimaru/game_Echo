// หน้าแรกของโปรแกรม ECHO (ธีม ORDEAL CALL) — เปิดโปรแกรม → สร้างห้อง / เข้าร่วม
//  คำสั่งจริงอยู่ใน main.js ผ่าน window.echo (preload.js) · ลูกโลก = window.EchoGlobe (vendor/globe.js)
//  เพลง main5 เล่นทันทีที่เปิด แล้วส่งตำแหน่งเพลง + ระดับเสียงให้หน้าเกม (#music=main5&mt=…&vol=… ดู client/src/audio.js)
//  มุมขวาบน: ปุ่มเสียง + เมนู หน้าตาเดียวกับในเกม (client/src/components/VolumeControl.jsx · vendor/volume.css)
const $ = (id) => document.getElementById(id);
const SCREENS = ["boot", "home", "host", "join"];
const params = new URLSearchParams(location.search);
// กลับมาจากห้อง (F10/ห้องปิด) — ด่านผ่านไปแล้วตั้งแต่ตอนเปิด ไปเมนูเลยไม่ต้องแตะเพื่อเริ่ม
const BACK = params.has("back");

// ตำแหน่ง/ขนาดลูกโลกของแต่ละหน้า (หน่วยฉาก: จอสูง ~3.44) — ชุดเดียวกับต้นแบบที่ผู้ใช้อนุมัติ
const LAYOUT = {
  boot: { x: 0, y: 0.42, s: 0.95 },
  home: { x: 1.25, y: 0, s: 1.15 },
  host: { x: 1.25, y: 0, s: 1.05 },
  join: { x: 1.25, y: 0, s: 1.05 },
  enter: { x: 0, y: 0, s: 4.4 }, // ซูมจนโลกล้นจอ (ฉากเปลี่ยนเข้าห้อง)
};

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- ระดับเสียง (หลอดเดียวกับในเกม: 0–1 · ความดังจริง = ฐาน × ระดับ^1.6 แบบ masterGain ใน audio.js) ----------
const VOL_KEY = "echo_vol"; // ชื่อเดียวกับในเกม (localStorage ของหน้านี้แยกจากของหน้าเกมอยู่แล้ว)
const MUSIC_BASE = 0.75 * 0.85; // MUSIC_BASE × LOUDNESS_GAIN ของ main5.0.mp3 ในเกม → ระดับ 0.8 ดังเท่าเดิม (~0.45)
const CLICK_BASE = 0.55;
const clampVol = (v) => Math.max(0, Math.min(1, v));
let volume = 0.8;
try {
  const saved = parseFloat(localStorage.getItem(VOL_KEY));
  if (Number.isFinite(saved)) volume = clampVol(saved);
} catch { /* ไม่มี storage */ }
// กลับมาจากห้อง: main.js ส่งระดับเสียงล่าสุดในหน้าเกมมาด้วย (?vol=)
{
  const fromGame = parseFloat(params.get("vol"));
  if (Number.isFinite(fromGame)) {
    volume = clampVol(fromGame);
    try { localStorage.setItem(VOL_KEY, String(volume)); } catch { /* ไม่มี storage */ }
  }
}
const gain = () => Math.pow(volume, 1.6);
const musicVolume = () => Math.min(1, MUSIC_BASE * gain());

// ---------- เสียงคลิก (ทุกการกด — เหมือน installClickSound ในเกม) ----------
const clickPool = Array.from({ length: 4 }, () => {
  const a = new Audio("vendor/click.mp3");
  a.preload = "auto";
  return a;
});
let clickIdx = 0;
let lastClickAt = 0;
function clickSound() {
  const now = performance.now();
  if (now - lastClickAt < 90) return; // กันดังซ้อน (ตัวดักทั้งหน้า + โค้ดที่เรียกเอง)
  lastClickAt = now;
  const v = CLICK_BASE * gain();
  if (v <= 0) return;
  const a = clickPool[clickIdx++ % clickPool.length];
  a.volume = Math.min(1, v);
  try { a.currentTime = 0; } catch { /* ยังโหลดไม่เสร็จ */ }
  a.play().catch(() => {});
}
const CLICKABLE = "button, a[href], [role=\"button\"], input[type=\"checkbox\"], input[type=\"radio\"], select, summary, label[for]";
document.addEventListener("click", (e) => {
  const el = e.target instanceof Element ? e.target.closest(CLICKABLE) : null;
  if (!el || el.disabled) return;
  clickSound();
}, true);

// ---------- เพลง main5 ----------
const music = new Audio("vendor/main5.0.mp3");
music.loop = true;
music.preload = "auto";
music.volume = 0;
let fadeRaf = 0;

function fadeMusic(target, ms) {
  cancelAnimationFrame(fadeRaf);
  const from = music.volume;
  const t0 = performance.now();
  const tick = (now) => {
    const k = Math.min(1, (now - t0) / ms);
    music.volume = Math.max(0, Math.min(1, from + (target - from) * k));
    if (k < 1) fadeRaf = requestAnimationFrame(tick);
  };
  fadeRaf = requestAnimationFrame(tick);
}

function startMusic() {
  music.play().then(() => fadeMusic(musicVolume(), 1500)).catch(() => {
    // เล่นเองไม่ได้ (ไม่น่าเกิดในโปรแกรม — main.js ตั้ง autoplayPolicy ไว้) → เล่นเมื่อแตะจอครั้งแรก
    const retry = () => {
      document.removeEventListener("pointerdown", retry, true);
      document.removeEventListener("keydown", retry, true);
      startMusic();
    };
    document.addEventListener("pointerdown", retry, true);
    document.addEventListener("keydown", retry, true);
  });
}
startMusic();

// ---------- มุมขวาบน: แผงเสียง / เมนู (เปิดได้ทีละแผง) ----------
const BARS = 5;
let lastOn = volume > 0 ? volume : 0.8; // ระดับก่อนกดปิดเสียง
let openPanel = null; // null | "vol" | "menu"

function setVolume(v) {
  volume = clampVol(v);
  if (volume > 0) lastOn = volume;
  try { localStorage.setItem(VOL_KEY, String(volume)); } catch { /* ไม่มี storage */ }
  if (!entering) {
    cancelAnimationFrame(fadeRaf);
    music.volume = musicVolume();
  }
  renderVolume();
}

function renderVolume() {
  const pct = Math.round(volume * 100);
  const muted = volume <= 0;
  const lit = muted ? 0 : Math.max(1, Math.ceil(volume * BARS - 0.001));
  $("vol-btn").classList.toggle("is-muted", muted);
  [...$("vol-bars").children].forEach((bar, i) => bar.classList.toggle("on", i < lit));
  $("vol-num").textContent = String(pct);
  $("vol-pct").classList.toggle("is-muted", muted);
  $("vol-slider").style.setProperty("--fill", `${pct}%`);
  [...$("vol-track").querySelectorAll("b")].forEach((tick, i) => tick.classList.toggle("on", i * 10 <= pct));
  const range = $("vol-range");
  if (Number(range.value) !== pct) range.value = String(pct);
  range.setAttribute("aria-valuetext", `${pct}%`);
  $("vol-mute").classList.toggle("is-on", muted);
  $("vol-mute").setAttribute("aria-pressed", String(muted));
}

function setPanel(name) {
  openPanel = name;
  $("vol-panel").hidden = name !== "vol";
  $("menu-panel").hidden = name !== "menu";
  $("vol-btn").classList.toggle("is-open", name === "vol");
  $("menu-btn").classList.toggle("is-open", name === "menu");
  $("vol-btn").setAttribute("aria-expanded", String(name === "vol"));
  $("menu-btn").setAttribute("aria-expanded", String(name === "menu"));
}

function initCorner() {
  for (let i = 0; i <= 10; i++) {
    const tick = document.createElement("b");
    tick.style.left = `${i * 10}%`;
    $("vol-track").append(tick);
  }
  renderVolume();
  $("vol-btn").addEventListener("click", () => setPanel(openPanel === "vol" ? null : "vol"));
  $("menu-btn").addEventListener("click", () => setPanel(openPanel === "menu" ? null : "menu"));
  $("vol-range").addEventListener("input", (e) => setVolume(Number(e.target.value) / 100));
  $("vol-mute").addEventListener("click", () => setVolume(volume <= 0 ? (lastOn > 0 ? lastOn : 0.8) : 0));
  $("menu-quit").addEventListener("click", quit);
  // คลิกนอกแผง / Esc = ปิดแผง (Esc ไม่ส่งต่อให้ปุ่มลัดอื่น เช่น Esc ในหน้าเข้าร่วม = ย้อนกลับ)
  document.addEventListener("pointerdown", (e) => {
    if (openPanel && !$("ocv").contains(e.target)) setPanel(null);
  }, true);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && openPanel) {
      e.stopImmediatePropagation();
      setPanel(null);
    }
  }, true);
}

// ---------- ลูกโลก ----------
let globe = null;
let earthReady = false;
let earthProgress = 0;
try {
  globe = window.EchoGlobe.createGlobe($("globe"), { layout: LAYOUT[BACK ? "home" : "boot"], drag: false, sand: true });
  const earth = window.EchoGlobe.getEarth((p) => {
    earthProgress = p;
    renderBar();
  });
  earth.ready.then(() => {
    earthReady = true;
    maybeReady();
  });
} catch (err) {
  // ไม่มี vendor/globe.js หรือเครื่องไม่รองรับ WebGL — หน้าแรกยังใช้ได้ แค่ไม่มีลูกโลก
  console.error("ลูกโลกไม่พร้อม:", err);
  globe = null;
  earthReady = true;
  earthProgress = 1;
}

// ---------- สลับหน้า ----------
let current = "none";
function show(name) {
  current = name;
  document.body.dataset.screen = name;
  for (const s of SCREENS) $(s).hidden = s !== name;
  document.body.classList.toggle("can-drag", !!globe && name !== "boot");
  if (globe && LAYOUT[name]) {
    globe.setLayout(LAYOUT[name]);
    globe.setDrag(name !== "boot");
  }
}

function setMessage(text) {
  $("message").textContent = text || "";
  $("message").hidden = !text;
}

function goHome() {
  show("home");
  $("go-host").focus({ preventScroll: true });
}

// ---------- ด่านตอนเปิดโปรแกรม ----------
// แถบเดียว: ตรวจเวอร์ชัน 0–15% · ไฟล์เกม 15–85% · สร้างลูกโลก 85–100% (ระหว่างอัปเดต แถบ = % ที่โหลดตัวอัปเดต)
const gate = { version: 0, media: 0, update: null, passed: false, failed: false };
let ready = false;

function renderBar() {
  const pct = gate.update != null
    ? gate.update
    : 15 * gate.version + 70 * gate.media + 15 * (gate.passed ? earthProgress : Math.min(earthProgress, gate.media));
  $("boot-bar").style.width = `${Math.max(0, Math.min(100, pct))}%`;
}

function setStatus(text) {
  $("boot-status").textContent = text || "";
}

const mb = (bytes) => (bytes / 1024 ** 2).toFixed(0);

function renderMediaProgress({ doneBytes, totalBytes, totalFiles }) {
  if (!totalFiles) {
    gate.media = 1;
    setStatus("ไฟล์เกมครบแล้ว");
  } else {
    gate.media = totalBytes ? Math.min(1, doneBytes / totalBytes) : 1;
    setStatus(`กำลังโหลดไฟล์เกม ${mb(doneBytes)} / ${mb(totalBytes)} MB`);
  }
  renderBar();
}

function renderUpdate({ phase, version, percent }) {
  if (phase === "checking") {
    setStatus("กำลังตรวจเวอร์ชัน");
  } else if (phase === "downloading") {
    gate.update = percent || 0;
    setStatus(`กำลังอัปเดตเป็นเวอร์ชัน ${version} · ${(percent || 0).toFixed(0)}%`);
  } else if (phase === "restarting") {
    gate.update = 100;
    setStatus("อัปเดตเสร็จแล้ว กำลังเปิดโปรแกรมใหม่");
  }
  renderBar();
}

function showGateError(error) {
  gate.failed = true;
  show("boot");
  setStatus("");
  $("boot-error").textContent = error;
  $("boot-error").hidden = false;
  $("boot-retry").hidden = false;
  $("boot-retry").focus({ preventScroll: true });
}

async function runGates() {
  gate.version = 0;
  gate.media = 0;
  gate.update = null;
  gate.failed = false;
  $("boot-error").hidden = true;
  $("boot-retry").hidden = true;
  if (!BACK) show("boot");
  setStatus("กำลังตรวจเวอร์ชัน");
  renderBar();

  const update = await window.echo.checkUpdate();
  if (!update.ok) return showGateError(update.error);
  gate.version = 1;
  gate.update = null;
  setStatus("กำลังตรวจไฟล์เกม");
  renderBar();

  const media = await window.echo.prepareMedia();
  if (!media.ok) return showGateError(media.error);
  gate.media = 1;
  gate.passed = true;
  renderBar();
  maybeReady();
}

// ด่านผ่าน + ลูกโลกสร้างเสร็จ → แตะเพื่อเริ่ม (กลับจากห้อง = ไปเมนูเลย ไม่รอลูกโลก)
function maybeReady() {
  if (!gate.passed || ready) return;
  if (BACK) {
    ready = true;
    goHome();
    return;
  }
  if (!earthReady) {
    setStatus("กำลังเตรียมพร้อม");
    return;
  }
  ready = true;
  renderBar();
  setStatus("");
  $("tap").hidden = false;
  $("boot").classList.add("ready");
}

function onTap(event) {
  if (!ready || current !== "boot") return;
  if (event.type === "keydown" && ["F10", "F11", "Tab", "Shift", "Control", "Alt", "Meta", "Escape"].includes(event.key)) return;
  if (event.target instanceof Element && event.target.closest("#ocv")) return; // กดปุ่มเสียง/เมนูด้วยคีย์บอร์ด
  clickSound();
  goHome();
}

// ---------- สร้างห้อง ----------
let hostSeq = 0;

function ipCard(address, label, dim) {
  const card = document.createElement("div");
  card.className = "ip" + (dim ? " dim" : "");
  const text = document.createElement("div");
  const k = document.createElement("div");
  k.className = "k";
  k.textContent = label;
  const v = document.createElement("div");
  v.className = "v";
  v.textContent = address;
  text.append(k, v);
  const copy = document.createElement("button");
  copy.type = "button";
  copy.className = "copy";
  copy.textContent = "คัดลอก";
  copy.addEventListener("click", async () => {
    await window.echo.copy(address);
    copy.textContent = "คัดลอกแล้ว";
    setTimeout(() => { copy.textContent = "คัดลอก"; }, 1500);
  });
  card.append(text, copy);
  return card;
}

function renderAddresses({ radmin, other }) {
  $("ip-list").replaceChildren(
    ...radmin.map((a) => ipCard(a, "Radmin VPN", false)),
    ...other.map((o) => ipCard(o.address, `วงแลน · ${o.name}`, true)),
  );
  $("no-radmin").hidden = radmin.length > 0;
}

async function startHosting() {
  const seq = ++hostSeq;
  setMessage("");
  show("host");
  $("host-status").textContent = "กำลังเปิดห้อง";
  $("ip-list").replaceChildren();
  $("no-radmin").hidden = true;
  $("enter-room").disabled = true;
  const result = await window.echo.host();
  if (seq !== hostSeq) return; // กดปิดห้องระหว่างรอ
  if (!result.ok) {
    goHome();
    setMessage(result.error);
    return;
  }
  $("host-status").textContent = "";
  renderAddresses(result.addresses);
  $("enter-room").disabled = false;
  $("enter-room").focus({ preventScroll: true });
}

async function closeHosting() {
  hostSeq++;
  await window.echo.closeHostedRoom();
  goHome();
}

// ---------- เข้าร่วม ----------
function openJoin() {
  setMessage("");
  show("join");
  $("join-status").textContent = "";
  $("join-status").classList.remove("err");
  $("join-ip").focus({ preventScroll: true });
  $("join-ip").select();
}

async function join(event) {
  event.preventDefault();
  if (entering) return;
  const button = $("join-go");
  const status = $("join-status");
  button.disabled = true;
  status.classList.remove("err");
  status.textContent = "กำลังเชื่อมต่อ";
  const result = await window.echo.join($("join-ip").value);
  if (!result.ok) {
    status.classList.add("err");
    status.textContent = result.error;
    button.disabled = false;
    return;
  }
  status.textContent = "กำลังเข้าห้อง";
  const entered = await enterRoom((t, v) => window.echo.enterJoinedRoom(t, v));
  if (!entered) button.disabled = false;
}

// ---------- ฉากเปลี่ยนเข้าห้อง ----------
//  ซ่อนแผง → ลูกโลกเลื่อนมากลางแล้วซูมจนล้นจอ → ขาวทั้งจอ (หน้าเกมเริ่มด้วยจอขาว-ฟ้าต่อกันพอดี)
//  เพลงค่อยๆ เบาลง แล้วส่งตำแหน่งเพลงให้หน้าเกมเล่นต่อ
let entering = false;

async function enterRoom(go) {
  if (entering) return false;
  entering = true;
  document.body.classList.add("leaving");
  if (globe) {
    globe.setDrag(false);
    globe.setAutoSpin(0.5);
    globe.setLayout(LAYOUT.enter);
  }
  $("whiteout").classList.add("on");
  setPanel(null);
  fadeMusic(0, 850);
  await wait(900);
  const result = await go(music.currentTime, volume);
  if (result && result.ok) return true; // main.js กำลังโหลดหน้าเกม — หน้านี้จะถูกแทนที่

  // เข้าไม่สำเร็จ → ถอยกลับหน้าเดิม
  entering = false;
  document.body.classList.remove("leaving");
  $("whiteout").classList.remove("on");
  fadeMusic(musicVolume(), 600);
  if (globe) {
    globe.setAutoSpin(0.1);
    show(current);
  }
  if (result && result.error) {
    if (current === "join") {
      $("join-status").classList.add("err");
      $("join-status").textContent = result.error;
    } else {
      $("host-status").textContent = result.error;
    }
  }
  return false;
}

function quit() {
  fadeMusic(0, 250);
  window.echo.quit();
}

// ---------- เริ่ม ----------
async function init() {
  initCorner();
  window.echo.onUpdateStatus(renderUpdate);
  window.echo.onMediaProgress(renderMediaProgress);

  $("boot-retry").addEventListener("click", (e) => {
    e.stopPropagation();
    runGates();
  });
  $("boot").addEventListener("click", onTap);
  document.addEventListener("keydown", onTap);

  $("go-host").addEventListener("click", startHosting);
  $("go-join").addEventListener("click", openJoin);
  $("quit").addEventListener("click", quit);
  $("enter-room").addEventListener("click", () => enterRoom((t, v) => window.echo.enterHostedRoom(t, v)));
  $("host-close").addEventListener("click", closeHosting);
  $("join-form").addEventListener("submit", join);
  $("join-back").addEventListener("click", goHome);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !entering && current === "join") goHome();
  });

  const info = await window.echo.info();
  $("version").textContent = `เวอร์ชัน ${info.version}`;
  $("mark-version").textContent = info.version.split(".").slice(0, 2).join(".");
  $("join-ip").value = info.lastHost;
  setMessage(params.get("message"));
  await runGates();
}

init();
