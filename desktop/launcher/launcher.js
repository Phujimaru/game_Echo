// หน้าแรกของโปรแกรม ECHO — สร้างห้อง / เข้าร่วม (คำสั่งจริงอยู่ใน main.js ผ่าน window.echo จาก preload.js)
const $ = (id) => document.getElementById(id);
const panels = ["home", "host", "join"];

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

async function init() {
  const info = await window.echo.info();
  $("version").textContent = `เวอร์ชัน ${info.version}`;
  $("join-ip").value = info.lastHost;
  setMessage(new URLSearchParams(location.search).get("message"));

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
}

init();
