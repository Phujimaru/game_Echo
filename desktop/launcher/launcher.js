// หน้าแรกของโปรแกรม ECHO — สร้างห้อง / เข้าร่วม (คำสั่งจริงอยู่ใน main.js ผ่าน window.echo จาก preload.js)
const $ = (id) => document.getElementById(id);
const panels = ["prepare", "home", "host", "join"];

function show(panel) {
  for (const p of panels) $(p).hidden = p !== panel;
}

function setMessage(text) {
  $("message").textContent = text || "";
  $("message").hidden = !text;
}

function ipRow(address, tag, secondary) {
  const row = document.createElement("div");
  row.className = "ip-row" + (secondary ? " secondary" : "");
  const ip = document.createElement("span");
  ip.className = "ip";
  ip.textContent = address;
  const label = document.createElement("span");
  label.className = "tag";
  label.textContent = tag;
  const copy = document.createElement("button");
  copy.className = "btn";
  copy.textContent = "คัดลอก";
  copy.addEventListener("click", async () => {
    await window.echo.copy(address);
    copy.textContent = "คัดลอกแล้ว ✓";
    setTimeout(() => { copy.textContent = "คัดลอก"; }, 1500);
  });
  row.append(ip, label, copy);
  return row;
}

function renderAddresses({ radmin, other }) {
  const list = $("ip-list");
  list.replaceChildren(
    ...radmin.map((a) => ipRow(a, "Radmin VPN", false)),
    ...other.map((o) => ipRow(o.address, `วงแลน · ${o.name}`, true)),
  );
  $("no-radmin").hidden = radmin.length > 0;
}

async function startHosting() {
  setMessage("");
  show("host");
  $("host-status").hidden = false;
  $("host-status").textContent = "กำลังเปิดห้อง…";
  $("host-ready").hidden = true;
  const result = await window.echo.host();
  if (!result.ok) {
    show("home");
    setMessage(result.error);
    return;
  }
  $("host-status").hidden = true;
  renderAddresses(result.addresses);
  $("host-ready").hidden = false;
  $("enter-room").focus();
}

async function join(event) {
  event.preventDefault();
  const button = $("join-go");
  button.disabled = true;
  button.textContent = "กำลังเชื่อมต่อ…";
  $("join-error").hidden = true;
  const result = await window.echo.join($("join-ip").value);
  if (!result.ok) {
    $("join-error").textContent = result.error;
    $("join-error").hidden = false;
    button.disabled = false;
    button.textContent = "เข้าร่วม";
  }
}

const mb = (bytes) => (bytes / 1024 ** 2).toFixed(0);

function renderProgress({ doneBytes, totalBytes, doneFiles, totalFiles }) {
  if (!totalFiles) {
    $("prepare-status").textContent = "ไฟล์เกมครบแล้ว";
    $("prepare-bar").style.width = "100%";
    return;
  }
  const pct = totalBytes ? Math.min(100, (doneBytes / totalBytes) * 100) : 100;
  $("prepare-bar").style.width = `${pct}%`;
  $("prepare-status").textContent = `กำลังโหลด ${mb(doneBytes)} / ${mb(totalBytes)} MB (${pct.toFixed(0)}%) · ${doneFiles}/${totalFiles} ไฟล์`;
}

function renderUpdate({ phase, version, percent }) {
  if (phase === "checking") {
    $("prepare-status").textContent = "กำลังเชื่อมต่อ…";
  } else if (phase === "downloading") {
    $("prepare-title").textContent = `กำลังอัปเดตเป็นเวอร์ชัน ${version}`;
    $("prepare-bar").style.width = `${percent || 0}%`;
    $("prepare-status").textContent = `กำลังโหลด ${(percent || 0).toFixed(0)}%`;
  } else if (phase === "restarting") {
    $("prepare-bar").style.width = "100%";
    $("prepare-status").textContent = "อัปเดตเสร็จแล้ว กำลังเปิดโปรแกรมใหม่…";
  }
}

function showGateError(error) {
  $("prepare-error").textContent = error;
  $("prepare-error").hidden = false;
  $("prepare-retry").hidden = false;
}

// ด่านตอนเปิดโปรแกรม — (1) เวอร์ชันตรงกับ R2 (2) ไฟล์สื่อครบ · ผ่านทั้งคู่ถึงเข้าหน้าแรก (สร้างห้อง/เข้าร่วม) ได้
async function runGates() {
  show("prepare");
  $("prepare-error").hidden = true;
  $("prepare-retry").hidden = true;
  $("prepare-detail").hidden = true;
  $("prepare-bar").style.width = "0";
  $("prepare-title").textContent = "กำลังตรวจเวอร์ชัน";
  $("prepare-status").textContent = "กำลังเชื่อมต่อ…";
  const update = await window.echo.checkUpdate();
  if (!update.ok) return showGateError(update.error);

  $("prepare-title").textContent = "กำลังเตรียมไฟล์เกม";
  $("prepare-status").textContent = "กำลังตรวจรายการไฟล์…";
  $("prepare-bar").style.width = "0";
  $("prepare-detail").hidden = false;
  const media = await window.echo.prepareMedia();
  if (!media.ok) return showGateError(media.error);
  show("home");
}

async function init() {
  const info = await window.echo.info();
  $("version").textContent = `เวอร์ชัน ${info.version}`;
  $("join-ip").value = info.lastHost;
  setMessage(new URLSearchParams(location.search).get("message"));

  window.echo.onUpdateStatus(renderUpdate);
  window.echo.onMediaProgress(renderProgress);
  $("prepare-retry").addEventListener("click", runGates);
  $("go-host").addEventListener("click", startHosting);
  $("go-join").addEventListener("click", () => {
    setMessage("");
    show("join");
    $("join-ip").focus();
    $("join-ip").select();
  });
  $("quit").addEventListener("click", () => window.echo.quit());
  $("enter-room").addEventListener("click", () => window.echo.enterHostedRoom());
  $("host-back").addEventListener("click", async () => {
    await window.echo.closeHostedRoom();
    show("home");
  });
  $("join-form").addEventListener("submit", join);
  $("join-back").addEventListener("click", () => show("home"));
  await runGates();
}

init();
