// ============================================================
//  ECHO — Blackjack Skill Battle : เซิร์ฟเวอร์ + เอนจินเกม
//  - การ์ดสุ่มเลข 1-10 (ไม่ซ้ำในมือเดียวกัน) รวมแต้มใกล้ 21 สุดโดยไม่เกิน
//  - 1 รอบ: ไพ่ -> [CUTSCENE] -> สรุปผล -> โจมตี -> แบนเนอร์รอบ
//  - ระบบแปลงร่าง/cutscene/เพลงสกิลแบบ generic (Ginga / NewType Paradise / NT-D)
// ============================================================

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const fs = require("fs");
const { CHARACTERS, CHAR_BY_ID, POSITION_COLORS, publicRoster } = require("./characters");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const clientDist = path.join(__dirname, "client", "dist");
const useReact = fs.existsSync(path.join(clientDist, "index.html"));
const staticDir = useReact ? clientDist : path.join(__dirname, "public");
app.use(express.static(staticDir));
app.get(/^\/(?!socket\.io).*/, (req, res) => res.sendFile(path.join(staticDir, "index.html")));


// ---------- ค่าคงที่ ----------
const MAX_PLAYERS = 6;
const CARD_TIME = 60;
const SUMMARY_TIME = 5;
const ATTACK_TIME = 15;
const TRANSITION_TIME = 3;
const ATTACKFX_TIME = 3;  // อนิเมชันบอกว่าใครตีใคร
const BANNER_TIME = 2;    // แบนเนอร์สั้น (แปลงร่างซ้ำ ไม่เล่นวีดีโอ)

const MAX_HP = 5;       // เลือดจริงพื้นฐาน
const MAX_ARMOR = 2;
const MAX_SKILL = 6;

// การแปลงร่าง/cutscene ต่อสถานะ
//  afterReveal = เล่นหลังเปิดไพ่ (ท่าไม้ตาย) | ntd เล่นตอนโดนโจมตี
const TRANSFORMS = {
  ginga:    { img: "ginga.jpg",            video: "/skill_song/ginga/ginga_final.mp4",      title: "ULTLIVE ULTRAMAN GINGA", label: "ปล่อยท่าไม้ตาย",   seconds: 21, music: "ginga",   afterReveal: true },
  paradise: { img: "unicorn_ntdfinal.jpg", video: "/skill_song/banagher/Unicorn_final.mp4", title: "NEWTYPE PARADISE",       label: "ปล่อยท่าไม้ตาย",   seconds: 10, music: "unicorn", afterReveal: true },
  ntd:      { img: "unicron_ntd.jpg",      video: "/skill_song/banagher/NTD_passive.mp4",   title: "NT-D SYSTEM",           label: "สกิลติดตัวทำงาน", seconds: 9,  music: null,     afterReveal: false },
};


// ---------- สถานะเกมส่วนกลาง ----------
let players = {};
let gameState = "LOBBY"; // LOBBY | PLAYING | CUTSCENE | SUMMARY | ATTACK | TRANSITION | GAMEOVER
let timeLeft = 0;
let phaseTimerId = null;
let attackerId = null;
let roundWinnerId = null;
let roundNumber = 0;
let lastLog = [];
let reservations = {};
let cutsceneQueue = [];
let cutsceneInfo = null;
let cutsceneSeq = 0;      // id ต่อ cutscene (ให้ client remount วีดีโอ กันจอดำ)
let transformCounter = 0; // ลำดับการเปิดร่าง (ใช้เลือกเพลงตอนสวนท่ากัน)
let lastAttack = null;    // ข้อมูลการโจมตีล่าสุด (อนิเมชันใครตีใคร)

function clearPhaseTimer() {
  if (phaseTimerId) clearInterval(phaseTimerId);
  phaseTimerId = null;
}
function startPhaseTimer(seconds, onExpire) {
  clearPhaseTimer();
  timeLeft = seconds;
  phaseTimerId = setInterval(() => {
    timeLeft--;
    if (timeLeft <= 0) { clearPhaseTimer(); onExpire(); }
    else broadcastState();
  }, 1000);
}


// ============================================================
//  การ์ด (สุ่มเลข 1-10 ไม่ซ้ำในมือเดียวกัน) + แต้ม
// ============================================================
function drawCardFor(p) {
  const used = new Set(p.cards.map((c) => c.value));
  const avail = [];
  for (let v = 1; v <= 10; v++) if (!used.has(v)) avail.push(v);
  const v = avail.length ? avail[Math.floor(Math.random() * avail.length)] : 1 + Math.floor(Math.random() * 10);
  return { value: v };
}
function calculateScore(cards) { return cards.reduce((s, c) => s + c.value, 0); }
function scoreOf(p) {
  const raw = calculateScore(p.cards);
  if (p.statuses && p.statuses.upg) return Math.min(raw, 16);
  return raw;
}
function bustedOf(p) {
  if (p.statuses && p.statuses.upg) return false;
  return calculateScore(p.cards) > 21;
}


// ============================================================
//  ต่อสู้ + เอฟเฟกต์สกิล
// ============================================================
function alivePlayers() { return Object.values(players).filter((p) => p.alive); }
function joinedPositions() { return Object.values(players).map((p) => p.position); }
function positionsFor(sid) {
  const joined = joinedPositions();
  const reserved = Object.entries(reservations).filter(([id]) => id !== sid).map(([, p]) => p);
  return [...new Set([...joined, ...reserved])];
}
function positionUsedByOther(pos, sid) {
  return joinedPositions().includes(pos) ||
    Object.entries(reservations).some(([id, p]) => id !== sid && p === pos);
}

// รูปที่แสดง: NT-D คงอยู่จนแก้แค้น (ntdTarget) > Paradise > Ginga
function displayImg(p) {
  if (p.ntdTarget && p.seen && p.seen.ntd) return TRANSFORMS.ntd.img;
  for (const key of ["paradise", "ginga"]) {
    if (p.seen && p.seen[key] && (p.statuses[key] || 0) > 0) return TRANSFORMS[key].img;
  }
  return p.img;
}
// เพลงสกิล: คนที่เปิดร่างล่าสุด (afterResolve ดันของผู้ชนะให้เด่นตอนสวนท่ากัน)
function activeSkillMusic() {
  let best = null;
  for (const key of ["ginga", "paradise"]) {
    const t = TRANSFORMS[key];
    if (!t.music) continue;
    for (const p of alivePlayers()) {
      if (p.seen && p.seen[key] && (p.statuses[key] || 0) > 0) {
        if (!best || (p.transformAt || 0) > best.at) best = { music: t.music, at: p.transformAt || 0 };
      }
    }
  }
  return best ? best.music : null;
}

function damageSoft(p) {
  if (!p.alive) return;
  if (p.shield > 0) { p.shield--; return; }
  if (p.armor > 0) { p.armor--; p.dmgArmor++; }
  else { p.hp--; p.dmgHp++; }
}
function dealDirect(p, n) {
  for (let i = 0; i < n; i++) {
    if (!p.alive) return;
    if (p.shield > 0) { p.shield--; continue; }
    p.hp--; p.dmgHp++;
  }
}
function dealArmorOnly(p, n) {
  for (let i = 0; i < n; i++) {
    if (p.shield > 0) { p.shield--; continue; }
    if (p.armor > 0) { p.armor--; p.dmgArmor++; }
  }
}
function dealMixed(p, n) { // เกราะก่อนแล้วเลือด (สำหรับ NT-D)
  for (let i = 0; i < n; i++) {
    if (!p.alive) return;
    if (p.shield > 0) { p.shield--; continue; }
    if (p.armor > 0) { p.armor--; p.dmgArmor++; }
    else { p.hp--; p.dmgHp++; }
  }
}
function addSkill(p, n) {
  const before = p.skillPoints;
  p.skillPoints = Math.min(MAX_SKILL, p.skillPoints + n);
  p.gainedSkill += p.skillPoints - before;
}

function applyEffect(p, effect) {
  if (!effect) return;
  if (Array.isArray(effect)) return effect.forEach((e) => applyOne(p, e));
  applyOne(p, effect);
}
function applyOne(p, e) {
  switch (e.type) {
    case "heal": p.hp = Math.min(MAX_HP, p.hp + e.amount); break;
    case "armor": p.armor = Math.min(MAX_ARMOR, p.armor + e.amount); break;
    case "points": addSkill(p, e.amount); break;
    case "shield": p.shield += e.amount || 1; break;
    case "draw": for (let i = 0; i < (e.amount || 1); i++) p.cards.push(drawCardFor(p)); break;
    case "redraw": p.cards = []; p.cards.push(drawCardFor(p)); p.cards.push(drawCardFor(p)); break;
    case "status": p.statuses[e.status] = e.turns || 1; break;
  }
}
function firePassive(p, trigger) {
  const ch = CHAR_BY_ID[p.characterId];
  if (ch && ch.passive && ch.passive.trigger === trigger) applyEffect(p, ch.passive.effect);
}

function resetRoundDisplay(p) {
  p.dmgHp = 0; p.dmgArmor = 0; p.gainedSkill = 0;
  p.wasAttacked = false; p.isWinner = false; p.isLoser = false;
}
function resetCombat(p) {
  p.hp = MAX_HP; p.armor = MAX_ARMOR; p.skillPoints = 0; p.alive = true; p.shield = 0;
  p.statuses = {}; p.seen = {}; p.ntdTarget = null; p.transformAt = 0;
  p.cutsceneShown = {}; // เล่นวีดีโอครั้งเดียวต่อเกม (per match)
}


// ============================================================
//  ส่งสถานะ
// ============================================================
function buildStateFor(viewerId) {
  const revealAll = gameState !== "PLAYING" && gameState !== "LOBBY";
  return {
    gameState,
    timeLeft,
    roundNumber,
    maxPlayers: MAX_PLAYERS,
    youId: viewerId,
    attackerId: gameState === "ATTACK" ? attackerId : null,
    winnerId: (gameState === "SUMMARY" || gameState === "ATTACK") ? roundWinnerId : null,
    skillMusic: activeSkillMusic(),
    cutscene: gameState === "CUTSCENE" ? cutsceneInfo : null,
    attack: gameState === "ATTACKING" ? lastAttack : null,
    log: (gameState === "SUMMARY" || gameState === "TRANSITION" || gameState === "GAMEOVER") ? lastLog : [],
    players: Object.values(players).map((p) => {
      const mine = p.id === viewerId;
      const show = mine || revealAll;
      const ch = CHAR_BY_ID[p.characterId] || {};
      const pub = (s) => (s ? { name: s.name, desc: s.desc, cost: s.cost } : null);
      return {
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        img: displayImg(p),
        position: p.position,
        color: POSITION_COLORS[p.position] || "#888",
        locked: p.locked,
        busted: show ? bustedOf(p) : false,
        result: p.result,
        cardCount: p.cards.length,
        cards: mine ? p.cards : null,
        score: show ? scoreOf(p) : null,
        hp: p.hp, maxHp: MAX_HP,
        armor: p.armor, maxArmor: MAX_ARMOR,
        shield: p.shield,
        skillPoints: p.skillPoints, maxSkill: MAX_SKILL,
        alive: p.alive,
        statuses: show ? { ...p.statuses, ...(p.ntdTarget ? { ntd: 1 } : {}) } : {},
        character: {
          id: ch.id, name: ch.name,
          passive: ch.passive ? { name: ch.passive.name, desc: ch.passive.desc } : null,
          basic: pub(ch.basic), secondary: pub(ch.secondary), ultimate: pub(ch.ultimate),
        },
        dmgHp: p.dmgHp, dmgArmor: p.dmgArmor, gainedSkill: p.gainedSkill,
        wasAttacked: p.wasAttacked, isWinner: p.isWinner, isLoser: p.isLoser,
      };
    }),
  };
}
function broadcastState() {
  for (const id of Object.keys(players)) io.to(id).emit("state", buildStateFor(id));
}
function broadcastPositions() {
  for (const [sid, sock] of io.sockets.sockets) sock.emit("positions", positionsFor(sid));
}


// ============================================================
//  cutscene
// ============================================================
// ครั้งแรกต่อเกม/ต่อคน = เล่นวีดีโอเต็ม, ครั้งต่อไป = แบนเนอร์สั้น (บอกแค่ใครใช้อะไร)
function triggerCutscene(p, key) {
  if (p.cutsceneShown[key]) queueBanner(p, key);
  else { p.cutsceneShown[key] = true; queueCutscene(p, key); }
}
function queueCutscene(p, key) {
  const t = TRANSFORMS[key];
  if (!t) return;
  cutsceneQueue.push({
    seconds: t.seconds,
    info: {
      playerId: p.id, name: p.name,
      img: t.img, color: POSITION_COLORS[p.position] || "#9B4F96",
      video: t.video, title: t.title, label: t.label,
    },
  });
}
function queueBanner(p, key) {
  const t = TRANSFORMS[key];
  if (!t) return;
  cutsceneQueue.push({
    seconds: BANNER_TIME,
    info: {
      playerId: p.id, name: p.name,
      img: t.img, color: POSITION_COLORS[p.position] || "#9B4F96",
      title: t.title, label: t.label, brief: true, // ไม่มี video -> แสดงแค่แบนเนอร์
    },
  });
}
function runCutsceneQueue(onDone) {
  if (cutsceneQueue.length === 0) { cutsceneInfo = null; onDone(); return; }
  const c = cutsceneQueue.shift();
  cutsceneInfo = { ...c.info, id: ++cutsceneSeq }; // id ใหม่ทุกครั้ง -> client remount วีดีโอ
  gameState = "CUTSCENE";
  startPhaseTimer(c.seconds, () => runCutsceneQueue(onDone));
  broadcastState();
}


// ============================================================
//  วงจรรอบ
// ============================================================
function startMatch() {
  for (const p of Object.values(players)) resetCombat(p);
  roundNumber = 0;
  dealRound();
}

function dealRound() {
  clearPhaseTimer();
  roundNumber++;
  lastLog = [];
  attackerId = null;
  roundWinnerId = null;
  cutsceneQueue = [];
  cutsceneInfo = null;
  lastAttack = null;

  for (const p of Object.values(players)) {
    resetRoundDisplay(p);
    p.shield = 0;
    if (!p.alive) { p.cards = []; p.locked = true; p.busted = false; continue; }

    p.armor = Math.min(MAX_ARMOR, p.armor + 1);
    firePassive(p, "roundStart");

    p.cards = [];
    p.cards.push(drawCardFor(p));
    p.cards.push(drawCardFor(p));
    p.locked = false;
    p.busted = false;
    p.result = null;
  }

  gameState = "PLAYING";
  startPhaseTimer(CARD_TIME, resolveRound);
  broadcastState();
  checkAllLocked();
}

function hit(id) {
  const p = players[id];
  if (gameState !== "PLAYING" || !p || !p.alive || p.locked) return;
  p.cards.push(drawCardFor(p));
  p.busted = bustedOf(p);
  if (p.busted) p.locked = true;
  else if (scoreOf(p) === 21) p.locked = true;
  broadcastState();
  checkAllLocked();
}
function lock(id) {
  const p = players[id];
  if (gameState !== "PLAYING" || !p || !p.alive || p.locked) return;
  p.locked = true;
  broadcastState();
  checkAllLocked();
}
function useSkill(id, tier) {
  const p = players[id];
  if (gameState !== "PLAYING" || !p || !p.alive || p.locked) return;
  if (!["basic", "secondary", "ultimate"].includes(tier)) return;
  const ch = CHAR_BY_ID[p.characterId];
  const skill = ch && ch[tier];
  if (!skill || p.skillPoints < skill.cost) return;

  p.skillPoints -= skill.cost;
  applyEffect(p, skill.effect);

  p.busted = bustedOf(p);
  if (p.busted) p.locked = true;
  else if (scoreOf(p) === 21) p.locked = true;

  broadcastState();
  checkAllLocked();
}
function checkAllLocked() {
  if (gameState !== "PLAYING") return;
  const c = alivePlayers();
  if (c.length > 0 && c.every((p) => p.locked)) resolveRound();
}

// ---- สรุปผล ----
function resolveRound() {
  clearPhaseTimer();
  for (const p of alivePlayers()) p.locked = true;

  const combatants = alivePlayers();
  roundWinnerId = null;

  if (combatants.length < 2) {
    lastLog.push("รอบนี้ไม่มีการต่อสู้ (ผู้เล่นไม่พอ)");
    afterResolve();
    return;
  }

  const val = (p) => (bustedOf(p) ? -1 : scoreOf(p));
  const best = Math.max(...combatants.map(val));
  const worst = Math.min(...combatants.map(val));

  if (best >= 0) {
    const tied = combatants.filter((p) => val(p) === best);
    const w = tied[Math.floor(Math.random() * tied.length)];
    roundWinnerId = w.id;
    w.isWinner = true;
    w.result = "win";
    addSkill(w, 2);
    firePassive(w, "win");
    if (tied.length > 1) lastLog.push(`เสมอที่ ${best} แต้ม — สุ่มผู้ชนะได้ ${w.name}`);
  }

  if (best !== worst) {
    for (const l of combatants.filter((p) => val(p) === worst && p.id !== roundWinnerId)) {
      l.isLoser = true;
      l.result = "lose";
      damageSoft(l);
      addSkill(l, 2);
      firePassive(l, "lose");
      lastLog.push(`${l.name} แต้มน้อยสุด เสียพลังชีวิต -1`);
    }
  }
  for (const p of combatants) if (!p.result) p.result = "safe";

  afterResolve();
}

// เปิดร่างท่าไม้ตาย (หลังเปิดไพ่) -> cutscene ก่อนสรุปผล
function afterResolve() {
  const activated = [];
  for (const p of alivePlayers()) {
    for (const key of Object.keys(TRANSFORMS)) {
      if (!TRANSFORMS[key].afterReveal) continue;
      if ((p.statuses[key] || 0) > 0 && !p.seen[key]) {
        p.seen[key] = true;
        p.transformAt = ++transformCounter;
        triggerCutscene(p, key);
        lastLog.push(`✨ ${p.name} ${TRANSFORMS[key].label} ${TRANSFORMS[key].title}!`);
        activated.push(p);
      }
    }
  }
  // สวนท่าไม้ตายกัน: เอาเพลงของผู้ชนะ (ถ้าไม่มีผู้ชนะ = คนที่เปิดหลังสุด ซึ่ง transformAt สูงสุดอยู่แล้ว)
  if (activated.length > 1) {
    const winner = activated.find((p) => p.id === roundWinnerId);
    if (winner) winner.transformAt = ++transformCounter;
  }
  runCutsceneQueue(goSummary);
}

function goSummary() {
  gameState = "SUMMARY";
  startPhaseTimer(SUMMARY_TIME, afterSummary);
  broadcastState();
}

// ---- โจมตี ----
function attackableTargets(atkId) {
  return alivePlayers().filter((p) => p.id !== atkId && (p.statuses.paradise || 0) === 0);
}
function afterSummary() {
  const winner = players[roundWinnerId];
  if (winner && winner.alive) {
    const targets = attackableTargets(winner.id);
    if (targets.length > 0) {
      attackerId = winner.id;
      gameState = "ATTACK";
      startPhaseTimer(ATTACK_TIME, () => {
        const t = attackableTargets(attackerId);
        if (t.length) doAttack(attackerId, t[Math.floor(Math.random() * t.length)].id);
        else endTurn();
      });
      broadcastState();
      return;
    }
  }
  endTurn();
}

function doAttack(byId, targetId) {
  if (gameState !== "ATTACK" || byId !== attackerId) return;
  const attacker = players[byId];
  const target = players[targetId];
  if (!attacker || !target || !target.alive || target.id === attacker.id) return;
  if ((target.statuses.paradise || 0) > 0) return; // Paradise = เลือกโจมตีไม่ได้
  clearPhaseTimer();

  const ginga = (attacker.statuses.ginga || 0) > 0;
  const beam = (attacker.statuses.beam || 0) > 0;
  const paradiseAtk = (attacker.statuses.paradise || 0) > 0;
  // NT-D System (บัฟ): ตีคนที่ตีเราล่าสุด แรงขึ้น +2 (นับเกราะ)
  const isRevenge = attacker.characterId === "banagher" && attacker.ntdTarget && attacker.ntdTarget === target.id;

  let base = paradiseAtk ? 0 : (1 + (ginga ? 1 : 0) + (beam ? 1 : 0)); // NewType Paradise: โจมตีได้แต่ยังไม่สร้างความเสียหายจริง
  let dmg = base + (isRevenge ? 2 : 0);
  if ((target.statuses.monster || 0) > 0) dmg = Math.max(0, dmg - 1);

  const hpBefore = target.hp;
  if (isRevenge) dealMixed(target, dmg); // นับเกราะ (เกราะก่อนแล้วเลือด)
  else dealDirect(target, dmg);          // ปกติเข้าเลือดจริง
  target.wasAttacked = true;
  addSkill(target, 2);
  if ((target.statuses.absorb || 0) > 0 && target.hp < hpBefore) {
    target.hp = Math.min(MAX_HP, target.hp + 1);
    lastLog.push(`🛡️ ${target.name} Absorb shield ฟื้นเลือด +1`);
  }
  if (isRevenge) {
    attacker.ntdTarget = null;
    delete attacker.seen.ntd;
    lastLog.push(`⚡ ${attacker.name} แก้แค้น ${target.name} ด้วย NT-D +2 (นับเกราะ) -${dmg} — NT-D สงบลง`);
  } else {
    lastLog.push(`${attacker.name} โจมตี ${target.name} -${dmg}`);
  }

  // Ginga: ตีหมู่
  if (ginga) {
    for (const o of alivePlayers()) {
      if (o.id === attacker.id || o.id === target.id) continue;
      let admg = base;
      if ((o.statuses.monster || 0) > 0) admg = Math.max(0, admg - 1);
      dealArmorOnly(o, admg);
      o.wasAttacked = true;
    }
    lastLog.push(`ตีหมู่ Ginga! ผู้เล่นอื่นเสียเกราะ -${base}`);
  }

  // NT-D (บานาจเป็นเป้า): ตั้งบัฟแก้แค้น "คนล่าสุด" — แสดงฉากเมื่อเปลี่ยนเป้าเท่านั้น
  if (target.characterId === "banagher" && attacker.alive) {
    const changed = target.ntdTarget !== attacker.id;
    target.ntdTarget = attacker.id;
    target.seen.ntd = true;
    if (changed) triggerCutscene(target, "ntd");
  }

  // อนิเมชันบอกว่าใครตีใคร
  lastAttack = {
    byName: attacker.name, byImg: displayImg(attacker), byColor: POSITION_COLORS[attacker.position] || "#888",
    targetName: target.name, targetImg: displayImg(target), targetColor: POSITION_COLORS[target.position] || "#888",
    dmg, aoe: ginga, revenge: isRevenge,
  };
  gameState = "ATTACKING";
  startPhaseTimer(ATTACKFX_TIME, () => runCutsceneQueue(endTurn));
  broadcastState();
}

// ---- ปิดรอบ ----
function endTurn() {
  clearPhaseTimer();
  attackerId = null;

  for (const p of Object.values(players)) {
    for (const k of Object.keys(p.statuses || {})) {
      p.statuses[k]--;
      if (p.statuses[k] <= 0) delete p.statuses[k];
    }
    for (const k of Object.keys(p.seen || {})) {
      if (k === "ntd") continue; // NT-D คงอยู่จนแก้แค้น
      if (!(p.statuses[k] > 0)) delete p.seen[k];
    }
  }

  for (const p of alivePlayers()) addSkill(p, 1);

  for (const p of Object.values(players)) {
    if (p.alive && p.hp <= 0) {
      p.hp = 0; p.alive = false; p.result = "dead";
      lastLog.push(`💀 ${p.name} เลือดจริงหมด ตกรอบ!`);
    }
  }
  // ถ้าเป้าแก้แค้นตาย/หายไป -> NT-D สงบ
  for (const p of Object.values(players)) {
    if (p.ntdTarget && (!players[p.ntdTarget] || !players[p.ntdTarget].alive)) {
      p.ntdTarget = null;
      delete p.seen.ntd;
    }
  }

  const stillAlive = alivePlayers();
  const total = Object.keys(players).length;

  if (total >= 2 && stillAlive.length <= 1) {
    if (stillAlive.length === 1) lastLog.push(`🏆 ${stillAlive[0].name} คือผู้ชนะคนสุดท้าย!`);
    else lastLog.push("ไม่มีผู้รอด — เสมอ");
    gameState = "GAMEOVER";
    timeLeft = 0;
    broadcastState();
  } else {
    gameState = "TRANSITION";
    startPhaseTimer(TRANSITION_TIME, dealRound);
    broadcastState();
  }
}

function backToLobby() {
  gameState = "LOBBY";
  clearPhaseTimer();
  timeLeft = 0;
  attackerId = null;
  roundWinnerId = null;
  roundNumber = 0;
  lastLog = [];
  cutsceneQueue = [];
  cutsceneInfo = null;
  for (const p of Object.values(players)) {
    p.cards = []; p.locked = false; p.busted = false; p.result = null;
    resetRoundDisplay(p);
    resetCombat(p);
  }
  broadcastState();
}


// ============================================================
//  Socket.io
// ============================================================
io.on("connection", (socket) => {
  socket.emit("roster", publicRoster());
  socket.emit("positions", positionsFor(socket.id));

  socket.on("reserve", ({ position } = {}) => {
    const pos = Number(position);
    if (!pos) { delete reservations[socket.id]; broadcastPositions(); return; }
    if (pos < 1 || pos > 6 || positionUsedByOther(pos, socket.id)) return;
    reservations[socket.id] = pos;
    broadcastPositions();
  });

  socket.on("join", ({ name, position, characterId } = {}) => {
    if (Object.keys(players).length >= MAX_PLAYERS) { socket.emit("full"); return; }
    if (gameState !== "LOBBY") { socket.emit("inProgress"); return; }
    const pos = Number(position);
    if (!pos || pos < 1 || pos > 6 || positionUsedByOther(pos, socket.id)) { socket.emit("positionTaken"); return; }
    delete reservations[socket.id];
    let ch = CHAR_BY_ID[characterId];
    if (!ch || ch.locked) ch = CHARACTERS.find((c) => !c.locked) || CHARACTERS[0];

    players[socket.id] = {
      id: socket.id,
      name: (name || "ผู้เล่น").toString().slice(0, 12),
      position: pos, characterId: ch.id, avatar: ch.avatar, img: ch.img,
      cards: [], locked: false, busted: false, result: null,
      hp: MAX_HP, armor: MAX_ARMOR, skillPoints: 0, alive: true, shield: 0,
      statuses: {}, seen: {}, ntdTarget: null, transformAt: 0, cutsceneShown: {},
      dmgHp: 0, dmgArmor: 0, gainedSkill: 0,
      wasAttacked: false, isWinner: false, isLoser: false,
    };
    socket.emit("joined");
    broadcastState();
    broadcastPositions();
  });

  socket.on("startGame", () => {
    if (gameState === "LOBBY" && Object.keys(players).length >= 1) startMatch();
  });

  socket.on("hit", () => hit(socket.id));
  socket.on("lock", () => lock(socket.id));
  socket.on("useSkill", ({ tier } = {}) => useSkill(socket.id, tier));
  socket.on("attack", ({ targetId } = {}) => doAttack(socket.id, targetId));
  socket.on("backToLobby", () => { if (gameState === "GAMEOVER") backToLobby(); });

  socket.on("leave", () => {
    if (gameState !== "LOBBY") return;
    const p = players[socket.id];
    if (!p) return;
    reservations[socket.id] = p.position;
    delete players[socket.id];
    broadcastState();
    broadcastPositions();
  });

  socket.on("disconnect", () => {
    const wasAttacker = attackerId === socket.id;
    delete players[socket.id];
    delete reservations[socket.id];

    if (Object.keys(players).length === 0) {
      gameState = "LOBBY";
      clearPhaseTimer();
      attackerId = null;
      broadcastPositions();
      return;
    }
    if (gameState === "ATTACK" && wasAttacker) endTurn();
    else if (gameState === "PLAYING") { checkAllLocked(); broadcastState(); }
    else broadcastState();
    broadcastPositions();
  });
});


const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("🃏 ECHO — Blackjack Skill Battle ทำงานที่พอร์ต " + PORT));
