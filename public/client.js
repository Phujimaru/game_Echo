// ============================================================
//  โปรแกรมฝั่งผู้เล่น (ทำงานในเบราว์เซอร์)
//  คุยกับเซิร์ฟเวอร์ผ่าน Socket.io
// ============================================================

const socket = io();

const AVATAR_COUNT = 10;
const FALLBACK = ["🐱","🐶","🦊","🐻","🐼","🐨","🦁","🐯","🐸","🐵"];

let myName = "";
let myAvatar = 0;


// ------------------------------------------------------------
//  สลับหน้าจอ
// ------------------------------------------------------------
function showScreen(id) {
  document.querySelectorAll(".screen").forEach((s) => (s.style.display = "none"));
  document.getElementById(id).style.display = "flex";
}

function avatarHTML(index) {
  return `
    <span class="avatar">
      <img src="avatars/${index + 1}.png" alt="" onerror="this.style.display='none'">
      <span class="avatar-fallback">${FALLBACK[index] || "🙂"}</span>
    </span>`;
}
function cardHTML(card) {
  const red = (card.suit === "♥" || card.suit === "♦") ? "red" : "";
  return `<div class="card ${red}">${card.value}${card.suit}</div>`;
}
function cardBackHTML() {
  return `<div class="card back">🂠</div>`;
}

// แถบพลังชีวิต: หัวใจ (เลือดจริง) + โล่ (เกราะ) + หลอดสกิล
function statsHTML(p) {
  let hearts = "";
  for (let i = 0; i < p.maxHp; i++) hearts += (i < p.hp) ? "❤️" : "🖤";
  let shields = "";
  for (let i = 0; i < p.maxArmor; i++) shields += (i < p.armor) ? "🛡️" : "▫️";
  let skill = "";
  for (let i = 0; i < p.maxSkill; i++) skill += (i < p.skillPoints) ? "🔵" : "⚪";
  return `
    <div class="stats">
      <div class="stat-line" title="เลือดจริง / เกราะ">${hearts} ${shields}</div>
      <div class="stat-line skill" title="หลอดสกิล ${p.skillPoints}/${p.maxSkill}">${skill}</div>
    </div>`;
}


// ============================================================
//  หน้าที่ 1 -> 2
// ============================================================
function goToSetup() {
  showScreen("setup-screen");
  renderAvatarChoices();
}
function renderAvatarChoices() {
  const grid = document.getElementById("avatar-grid");
  let html = "";
  for (let i = 0; i < AVATAR_COUNT; i++) {
    const selected = i === myAvatar ? "selected" : "";
    html += `<div class="avatar-choice ${selected}" onclick="pickAvatar(${i})">${avatarHTML(i)}</div>`;
  }
  grid.innerHTML = html;
}
function pickAvatar(index) {
  myAvatar = index;
  renderAvatarChoices();
}


// ============================================================
//  หน้าที่ 2 -> 3
// ============================================================
function joinLobby() {
  const name = document.getElementById("name-input").value.trim();
  if (!name) { alert("กรุณาตั้งชื่อก่อนนะ"); return; }
  myName = name;
  socket.emit("join", { name: myName, avatar: myAvatar });
}
socket.on("joined", () => showScreen("lobby-screen"));
socket.on("full", () => alert("ขออภัย ห้องเต็มแล้ว (สูงสุด 6 คน)"));


// ============================================================
//  ปุ่มกดต่างๆ
// ============================================================
function startGame()   { socket.emit("startGame"); }
function doHit()       { socket.emit("hit"); }
function doLock()      { socket.emit("lock"); }
function doSkill()     { socket.emit("useSkill"); }
function nextRound()   { socket.emit("nextRound"); }
function backToLobby() { socket.emit("backToLobby"); }
function doAttack(id)  { socket.emit("attack", { targetId: id }); }


// ============================================================
//  รับสถานะเกมจากเซิร์ฟเวอร์
// ============================================================
let lastSignature = null;

socket.on("state", (state) => {
  document.getElementById("timer-text").textContent = state.timeLeft;

  const signature = JSON.stringify({
    gameState: state.gameState,
    attackerId: state.attackerId,
    log: state.log,
    players: state.players,
  });
  if (signature === lastSignature) return;
  lastSignature = signature;

  if (state.gameState === "LOBBY") {
    showScreen("lobby-screen");
    renderLobby(state);
  } else {
    showScreen("game-screen");
    renderGame(state);
  }
});


// ------------------------------------------------------------
//  ห้องรอ
// ------------------------------------------------------------
function renderLobby(state) {
  const count = state.players.length;
  document.getElementById("lobby-info").textContent =
    `ผู้เล่นในห้อง: ${count}/${state.maxPlayers} คน`;

  let html = "";
  for (const p of state.players) {
    const you = p.id === state.youId ? " (คุณ)" : "";
    html += `<div class="player-card">
               ${avatarHTML(p.avatar)}
               <div class="player-name">${p.name}${you}</div>
               <div class="char-name">${p.character.name}</div>
             </div>`;
  }
  document.getElementById("lobby-players").innerHTML = html;

  const startBtn = document.getElementById("btn-start");
  if (count >= 2) {
    startBtn.disabled = false;
    startBtn.textContent = `เริ่มเกม (${count} คน)`;
  } else {
    startBtn.disabled = true;
    startBtn.textContent = "เริ่มเกม (รอเพื่อน)";
  }
}


// ------------------------------------------------------------
//  หน้าจอเล่นเกม
// ------------------------------------------------------------
function renderGame(state) {
  const phase = state.gameState;
  document.getElementById("timer-text").textContent = state.timeLeft;
  document.getElementById("timer-bar").style.display =
    (phase === "PLAYING" || phase === "ATTACK" || phase === "RESULTS") ? "block" : "none";

  const me = state.players.find((p) => p.id === state.youId);
  const iAmAttacker = phase === "ATTACK" && state.attackerId === state.youId;
  const attacker = state.players.find((p) => p.id === state.attackerId);

  // ---- วาดไพ่ + สถานะของทุกคน ----
  let html = "";
  for (const p of state.players) {
    const you = p.id === state.youId;

    let cardsHtml = "";
    if (p.cards) cardsHtml = p.cards.map(cardHTML).join("");
    else cardsHtml = Array(p.cardCount).fill(cardBackHTML()).join("");

    // ป้ายสถานะ
    let badge = "";
    if (!p.alive) {
      badge = `<span class="badge dead">💀 ตกรอบ</span>`;
    } else if (phase === "RESULTS" || phase === "GAMEOVER") {
      if (p.isWinner)    badge = `<span class="badge win">🏆 ชนะ</span>`;
      else if (p.isLoser) badge = `<span class="badge lose">แต้มน้อยสุด</span>`;
      else               badge = `<span class="badge locked">รอด</span>`;
    } else {
      if (p.busted)      badge = `<span class="badge bust">💥 แตก</span>`;
      else if (p.locked) badge = `<span class="badge locked">✅ เปิดไพ่แล้ว</span>`;
      else               badge = `<span class="badge playing">🤔 กำลังคิด</span>`;
    }

    // สรุปผลรอบ (โชว์เฉพาะตอนจบรอบ)
    let effect = "";
    if (phase === "RESULTS" || phase === "GAMEOVER") {
      const parts = [];
      if (p.dmgHp)    parts.push(`<span class="fx dmg">-${p.dmgHp}❤️</span>`);
      if (p.dmgArmor) parts.push(`<span class="fx dmg">-${p.dmgArmor}🛡️</span>`);
      if (p.wasAttacked) parts.push(`<span class="fx atk">⚔️ ถูกเลือกโจมตี</span>`);
      if (p.gainedSkill) parts.push(`<span class="fx skill">+${p.gainedSkill}🔵</span>`);
      if (parts.length) effect = `<div class="fx-row">${parts.join(" ")}</div>`;
    }

    const scoreText = (p.score !== null) ? `แต้ม: ${p.score}` : "แต้ม: ?";

    // ระหว่างเฟสเลือกโจมตี: ทำให้เป้าหมายกดได้
    const targetable = iAmAttacker && p.alive && !you;
    const clickAttr = targetable ? `onclick="doAttack('${p.id}')"` : "";
    const cls = [
      "player-panel",
      you ? "me" : "",
      p.alive ? "" : "dead",
      p.isWinner ? "winner" : "",
      p.isLoser ? "loser" : "",
      targetable ? "targetable" : "",
    ].join(" ");

    html += `<div class="${cls}" ${clickAttr}>
               <div class="panel-head">
                 ${avatarHTML(p.avatar)}
                 <div>
                   <div class="player-name">${p.name}${you ? " (คุณ)" : ""}</div>
                   <div class="char-name">${p.character.name}</div>
                   ${badge}
                 </div>
               </div>
               ${statsHTML(p)}
               <div class="cards-row">${cardsHtml}</div>
               <div class="panel-score">${scoreText}</div>
               ${effect}
             </div>`;
  }
  document.getElementById("game-players").innerHTML = html;

  // ---- ปุ่มควบคุม + ข้อความ ----
  const playControls = document.getElementById("play-controls");
  const resultControls = document.getElementById("result-controls");
  const message = document.getElementById("game-message");
  const logBox = document.getElementById("game-log");

  playControls.style.display = "none";
  resultControls.style.display = "none";
  logBox.innerHTML = "";

  if (phase === "PLAYING") {
    playControls.style.display = "flex";
    const done = me && (me.locked || !me.alive);
    document.getElementById("btn-hit").disabled = done;
    document.getElementById("btn-lock").disabled = done;

    // ปุ่มท่าไม้ตาย
    const skillBtn = document.getElementById("btn-skill");
    if (me && me.alive) {
      const ult = me.character.ultimate;
      skillBtn.style.display = "inline-block";
      skillBtn.textContent = `⚡ ${ult.name} (${ult.cost})`;
      skillBtn.disabled = done || me.skillPoints < ult.cost;
      skillBtn.title = ult.desc;
    } else {
      skillBtn.style.display = "none";
    }

    if (!me || !me.alive) message.textContent = "คุณตกรอบแล้ว — ดูเพื่อนเล่นต่อ 👀";
    else if (done) message.textContent = me.busted ? "คุณแตก! 😢 รอเพื่อน..." : "เปิดไพ่แล้ว ✅ รอเพื่อน...";
    else message.textContent = "ตาของคุณ! จั่วเพิ่ม / เปิดไพ่ / ใช้ท่าไม้ตาย";

  } else if (phase === "ATTACK") {
    if (iAmAttacker) {
      message.innerHTML = `⚔️ <b>คุณชนะเทิร์นนี้!</b> เลือกคู่ต่อสู้ที่จะโจมตี (คลิกที่การ์ด) — เข้าเลือดจริง -1`;
    } else {
      message.textContent = `รอ ${attacker ? attacker.name : "ผู้ชนะ"} เลือกเป้าหมายโจมตี...`;
    }

  } else if (phase === "RESULTS" || phase === "GAMEOVER") {
    resultControls.style.display = "flex";
    if (state.log && state.log.length) {
      logBox.innerHTML = state.log.map((t) => `<div class="log-line">${t}</div>`).join("");
    }

    const nextBtn = document.getElementById("btn-next");
    const lobbyBtn = document.getElementById("btn-lobby");
    if (phase === "GAMEOVER") {
      const champ = state.players.find((p) => p.alive);
      message.innerHTML = champ ? `🏆 <b>${champ.name}</b> คือผู้ชนะคนสุดท้าย!` : "จบเกม — ไม่มีผู้รอด";
      nextBtn.style.display = "none";
      lobbyBtn.style.display = "inline-block";
    } else {
      message.textContent = "จบเทิร์น — กำลังไปเทิร์นต่อไป...";
      nextBtn.style.display = "inline-block";  // กด "ไปต่อเลย" เพื่อข้ามการรอ
      lobbyBtn.style.display = "none";
    }
  }
}
