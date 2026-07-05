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
const BEAM_AMMO = 3;    // กระสุน Beam Magnum ต่อเกม (บานาจ)
const PUDDING_USES = 2; // Rainbow Pudding ใช้ได้ต่อเกม (คุวากาตะ)

// รูปร่างโอเจอร์ (ใช้ทั้งท่าไม้ตายสวมเกราะราชัน และ Beat Mode)
const OHGER_FORM = "/characters/kuwagata/kuwakata_ohger_form.jpg";

// การแปลงร่าง/cutscene ต่อสถานะ
//  afterReveal = เล่นหลังเปิดไพ่ (ท่าไม้ตาย) | ntd/beat เล่นตอน trigger (โดนโจมตี/เลือดต่ำ)
//  voice = เสียงพากย์เล่นต่อเมื่อวีดีโอจบ | music = เพลงสกิลที่ค้างหลัง cutscene
const TRANSFORMS = {
  ginga:    { img: "/characters/hikaru/ginga.jpg",           video: "/characters/hikaru/ginga_final.mp4",     title: "ULTLIVE ULTRAMAN GINGA", label: "ปล่อยท่าไม้ตาย",   seconds: 21, music: "ginga",   afterReveal: true },
  paradise: { img: "/characters/banagher/unicorn_ntdfinal.jpg", video: "/characters/banagher/Unicorn_final.mp4", title: "NEWTYPE PARADISE",    label: "ปล่อยท่าไม้ตาย",   seconds: 10, music: "unicorn", afterReveal: true },
  ntd:      { img: "/characters/banagher/unicron_ntd.jpg",   video: "/characters/banagher/NTD_passive.mp4",   title: "NT-D SYSTEM",           label: "สกิลติดตัวทำงาน", seconds: 9,  music: null,     afterReveal: false },
  // seconds ≈ ความยาววิดีโอ (วีดีโอจบ = ตัดกลับจอปกติทันที ไม่ค้างเฟรม)
  //  เสียงพากย์ + เอฟเฟกต์ระเบิด + แจ้งเปลี่ยนร่าง จะเล่นบนจอปกติหลังวีดีโอจบ (ฝั่ง client)
  //  rachan: วีดีโอ 11.62 | beat: วีดีโอ 4.70
  rachan:   { img: OHGER_FORM, video: "/characters/kuwagata/kuwagata_final.mp4",   title: "สวมเกราะราชัน",       label: "ปล่อยท่าไม้ตาย",   seconds: 12, music: "final_normal", voice: "normal_k", afterReveal: true },
  beat:     { img: OHGER_FORM, video: "/characters/kuwagata/kuwagata_passive.mp4", title: "ประกายเขี้ยวปฏิปักษ์", label: "สกิลติดตัวทำงาน", seconds: 5,  music: "ex_guts",      voice: "ex_k",     afterReveal: false },
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
let roundSkills = [];     // สกิลที่ใช้ในรอบ (เก็บประวัติ — instant เด้งตอนใช้ / หลังเปิดไพ่โชว์ตอนโจมตี)

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
function upgCap(p) {
  // เพดานแต้มขณะ UPG! : ปกติ 16 — ถ้าอยู่ในร่าง Ginga (ท่าไม้ตาย) เพิ่มเป็น 19
  return (p.statuses && (p.statuses.ginga || 0) > 0) ? 19 : 16;
}
function scoreCap(p) {
  // แต้มสูงสุดที่รับได้ก่อนล็อกไพ่อัตโนมัติ (UPG! = เพดานของมัน, ปกติ = 21)
  return (p.statuses && p.statuses.upg) ? upgCap(p) : 21;
}
function scoreOf(p) {
  const raw = calculateScore(p.cards);
  if (p.statuses && p.statuses.upg) return Math.min(raw, upgCap(p));
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

// เกราะสูงสุดของผู้เล่น: ปกติ 2 — ระหว่างสวมเกราะราชัน (ท่าไม้ตายคุวากาตะ) เพิ่ม +3 เป็น 5
function maxArmorOf(p) {
  return MAX_ARMOR + ((((p.statuses && p.statuses.rachan) || 0) > 0) ? 3 : 0);
}
// Beat Mode (คุวากาตะ): พลังชีวิต < 3 = อยู่ในประกายเขี้ยวปฏิปักษ์
function beatActive(p) {
  return !!p && p.alive && p.characterId === "kuwagata" && p.hp < 3;
}
// เข้าสู่ Beat Mode ครั้งแรก (เล่นวีดีโอ passive + ตั้งร่างถาวรจนตาย)
function maybeBeatMode(p) {
  if (!p || !p.alive || p.characterId !== "kuwagata") return;
  if (p.hp < 1 || p.hp >= 3) return;      // ต้องเหลือ 1-2 หน่วย (0 = กำลังจะตาย)
  if (p.seen && p.seen.beat) return;       // เข้าแล้วครั้งเดียวพอ (ถาวรจนตาย)
  p.seen.beat = true;
  p.transformAt = ++transformCounter;
  const firstTime = !p.cutsceneShown.beat;
  triggerCutscene(p, "beat");
  if (firstTime) queueTransformAnnounce(p, "beat"); // วีดีโอ -> ประกาศเปลี่ยนร่าง (ระเบิดเขียว + เสียงพากย์)
  lastLog.push(`⚡ ${p.name} เข้าสู่ประกายเขี้ยวปฏิปักษ์ (Beat Mode)!`);
}
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

// รูปที่แสดง: Beat Mode (ถาวรจนตาย) > NT-D คงอยู่จนแก้แค้น > Paradise > Ginga > สวมเกราะราชัน
function displayImg(p) {
  if (p.seen && p.seen.beat) return OHGER_FORM;
  if (p.ntdTarget && p.seen && p.seen.ntd) return TRANSFORMS.ntd.img;
  for (const key of ["paradise", "ginga", "rachan"]) {
    if (p.seen && p.seen[key] && (p.statuses[key] || 0) > 0) return TRANSFORMS[key].img;
  }
  return p.img;
}
// เพลงสกิล: Beat Mode (ex_guts) ทับทุกเพลงจนผู้ใช้ตาย > คนที่เปิดร่างล่าสุด
function activeSkillMusic() {
  for (const p of alivePlayers()) if (p.seen && p.seen.beat) return "ex_guts";
  let best = null;
  for (const key of ["ginga", "paradise", "rachan"]) {
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
    case "armor": p.armor = Math.min(maxArmorOf(p), p.armor + e.amount); break;
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
// หาข้อมูลสกิล (ชื่อ+รูป) จาก status ที่กำลังมีผล — ใช้โชว์ตอนอนิเมชันโจมตี ว่าดาเมจ/การป้องกันมาจากสกิลไหนของใคร
function skillByStatus(p, status) {
  const ch = CHAR_BY_ID[p.characterId];
  if (!ch) return null;
  for (const tier of ["basic", "secondary", "ultimate"]) {
    const s = ch[tier];
    if (s && s.effect && !Array.isArray(s.effect) && s.effect.type === "status" && s.effect.status === status) {
      return { name: s.name, img: s.img || null, by: p.name, color: POSITION_COLORS[p.position] || "#888" };
    }
  }
  return null;
}
// ไพ่แตกก่อนเปิดไพ่ = ท่าไม้ตายที่เพิ่งกดในเทิร์นนี้ใช้งานไม่ได้ (แต้มสกิลที่จ่ายไปเสียฟรี)
function voidUltimateOnBust(p) {
  for (const key of Object.keys(TRANSFORMS)) {
    if (!TRANSFORMS[key].afterReveal) continue; // เฉพาะท่าไม้ตาย (ginga / paradise)
    if ((p.statuses[key] || 0) > 0 && !p.seen[key]) {
      delete p.statuses[key];
      lastLog.push(`💥 ${p.name} ไพ่แตก! ท่าไม้ตาย ${TRANSFORMS[key].title} ใช้งานไม่ได้ — แต้มสกิลเสียฟรี`);
    }
  }
}

function resetRoundDisplay(p) {
  p.dmgHp = 0; p.dmgArmor = 0; p.gainedSkill = 0;
  p.wasAttacked = false; p.isWinner = false; p.isLoser = false;
}
function resetCombat(p) {
  p.hp = MAX_HP; p.armor = MAX_ARMOR; p.skillPoints = 0; p.alive = true; p.shield = 0;
  p.statuses = {}; p.seen = {}; p.ntdTarget = null; p.transformAt = 0;
  p.armorLocked = false; // Beat Mode: กันตายแล้วเกราะจะไม่ฟื้นคืน
  p.beatSaved = false;   // Beat Mode: กันตายได้ครั้งเดียวต่อเกม (คล้าย Focus Sash)
  p.skillUsedRound = false; // ใช้สกิลได้ 1 อันต่อเทิร์น
  p.beamAmmo = BEAM_AMMO; // กระสุน Beam Magnum รีเซ็ตต้นเกม
  p.puddingUses = PUDDING_USES; // Rainbow Pudding รีเซ็ตต้นเกม
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
      const pub = (s) => (s ? { name: s.name, desc: s.desc, cost: s.cost, img: s.img, ammo: s.ammo } : null);
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
        armor: p.armor, maxArmor: maxArmorOf(p),
        shield: p.shield,
        // เอฟเฟครอบการ์ด (เห็นทุกคน): เขี้ยวปฏิปักษ์สีเขียว (ถาวร) / เกราะราชันสีแดง (ตอนสวม)
        beat: !!(p.seen && p.seen.beat),
        rachan: !!(p.seen && p.seen.rachan) && (p.statuses.rachan || 0) > 0,
        skillPoints: p.skillPoints, maxSkill: MAX_SKILL,
        beamAmmo: p.beamAmmo,
        puddingUses: p.puddingUses,
        atCap: scoreOf(p) >= scoreCap(p), // แต้มเต็มเพดาน (21/UPG) -> ปิดปุ่มจั่ว รอเปิดไพ่เอง
        skillUsed: !!p.skillUsedRound,    // ใช้สกิลไปแล้วในเทิร์นนี้ (1 อันต่อเทิร์น)
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
      video: t.video, title: t.title, label: t.label, voice: t.voice || null,
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
// ประกาศเปลี่ยนร่าง (เอฟเฟกต์ระเบิด + ชื่อ + เสียงพากย์) — ต่อจากวีดีโอ ก่อนขึ้นสรุปผล/คนอื่น
//  seconds ≈ ความยาวเสียงพากย์ เพื่อให้เสียงเล่นจบก่อนขึ้นฉากถัดไป (ไม่ทับวีดีโอคนอื่น)
function queueTransformAnnounce(p, kind) {
  const t = TRANSFORMS[kind];
  if (!t) return;
  cutsceneQueue.push({
    seconds: kind === "beat" ? 9 : 7,
    info: {
      playerId: p.id, name: p.name,
      img: OHGER_FORM, color: POSITION_COLORS[p.position] || "#9B4F96",
      title: t.title, voice: t.voice || null, kind, announce: true,
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
  roundSkills = [];

  for (const p of Object.values(players)) {
    resetRoundDisplay(p);
    p.shield = 0;
    p.skillUsedRound = false; // เทิร์นใหม่ ใช้สกิลได้อีก 1 อัน
    if (!p.alive) { p.cards = []; p.locked = true; p.busted = false; continue; }

    // Beat Mode: หลังกันตายทำงาน เกราะจะไม่ฟื้นคืนต้นรอบ
    if (!p.armorLocked) p.armor = Math.min(maxArmorOf(p), p.armor + 1);
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
  if (scoreOf(p) >= scoreCap(p)) return; // แต้มเต็มเพดาน (เช่น 21 พอดี) = จั่วไม่ได้ รอผู้ใช้ใช้สกิล/เปิดไพ่เอง
  p.cards.push(drawCardFor(p));
  p.busted = bustedOf(p);
  if (p.busted) { p.locked = true; voidUltimateOnBust(p); }
  // ถึงเพดานพอดี: ไม่ล็อกอัตโนมัติ — ปิดปุ่มจั่ว (atCap) แล้วรอผู้ใช้เลือกสกิลก่อนเปิดไพ่เอง
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

  if (p.skillUsedRound) return; // ใช้สกิลได้เพียง 1 อันต่อเทิร์น (ซ้ำ/ซ้อนไม่ได้)
  // Beat Mode (ประกายเขี้ยว): สกิลพื้นฐาน + ท่าไม้ตายใช้ไม่ได้ (ใช้ได้แค่สกิลรอง)
  if ((tier === "basic" || tier === "ultimate") && beatActive(p)) return;
  // Rainbow Pudding (คุวากาตะ): ใช้ได้แค่ 2 ครั้งต่อเกม
  const isPudding = p.characterId === "kuwagata" && tier === "basic";
  if (isPudding && (p.puddingUses || 0) <= 0) return;

  const st = skill.effect && !Array.isArray(skill.effect) && skill.effect.type === "status" ? skill.effect.status : null;
  if (st === "beam" && (p.beamAmmo || 0) <= 0) return; // Beam Magnum กระสุนหมด ใช้ไม่ได้

  p.skillPoints -= skill.cost;
  p.skillUsedRound = true;
  if (isPudding) p.puddingUses--; // นับใช้ Rainbow Pudding
  applyEffect(p, skill.effect);

  // NewType Paradise: เติมกระสุน Beam Magnum +1
  if (st === "paradise") p.beamAmmo = Math.min(BEAM_AMMO, (p.beamAmmo || 0) + 1);

  // สกิลช่วงจั่วการ์ด (instant): เด้งโชว์ทันทีบนกระดานของทุกคน ไม่ต้องรอเปิดไพ่/ไม่ตัดจอดำ
  if (skill.instant) {
    io.emit("skillFlash", { name: skill.name, img: skill.img || null, by: p.name, color: POSITION_COLORS[p.position] || "#9B4F96" });
  }
  // จำสกิลที่ใช้ในรอบ (ท่าไม้ตายมี cutscene ของตัวเอง / สกิลหลังเปิดไพ่ไปโชว์ตอนโจมตี)
  roundSkills.push({ playerId: id, name: skill.name, img: skill.img || null, status: st });

  p.busted = bustedOf(p);
  if (p.busted) { p.locked = true; voidUltimateOnBust(p); }
  // ถึงเพดานพอดี (เช่น 21): ไม่ล็อกอัตโนมัติ — รอผู้ใช้เปิดไพ่เอง

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
      if (l.beatSaved) {
        // หลังกันตายทำงานแล้ว: ความเสียหายจากการแพ้ตอนจั่วการ์ดไม่มีผล ไม่ว่าห่าง 21 แค่ไหน
        addSkill(l, 2);
        firePassive(l, "lose");
        lastLog.push(`⚡ ${l.name} ประกายเขี้ยวปฏิปักษ์ — ไม่รับความเสียหายจากการแพ้`);
        continue;
      }
      const armorBefore = l.armor;
      damageSoft(l);
      // Absorb shield: ถ้าเป็นผู้แพ้แล้วเสียเกราะ ให้แปลงเกราะที่เสียกลับเป็นพลังชีวิต
      const armorLost = armorBefore - l.armor;
      if ((l.statuses.absorb || 0) > 0 && armorLost > 0) {
        const heal = Math.min(MAX_HP - l.hp, armorLost);
        if (heal > 0) { l.hp += heal; lastLog.push(`🛡️ ${l.name} Absorb shield แปลงเกราะที่เสีย ${armorLost} → พลังชีวิต +${heal}`); }
      }
      addSkill(l, 2);
      firePassive(l, "lose");
      lastLog.push(`${l.name} แต้มน้อยสุด เสียพลังชีวิต -1`);
    }
  }
  for (const p of combatants) if (!p.result) p.result = "safe";

  afterResolve();
}

// เปิดร่างท่าไม้ตาย (หลังเปิดไพ่) -> cutscene ก่อนสรุปผล (สรุปผลไว้ท้ายสุดเสมอ)
//  หมายเหตุ: สกิลทั่วไปไม่มีแบนเนอร์ก่อนสรุปผลแล้ว — instant เด้งตอนใช้ / หลังเปิดไพ่ไปโชว์ตอนโจมตี
function afterResolve() {
  const activated = [];
  for (const p of alivePlayers()) {
    if (bustedOf(p)) continue; // ไพ่แตก = ท่าไม้ตายไม่ทำงาน (กันหลุดกรณีเพิ่งกดแล้วแตก)
    for (const key of Object.keys(TRANSFORMS)) {
      if (!TRANSFORMS[key].afterReveal) continue;
      if ((p.statuses[key] || 0) > 0 && !p.seen[key]) {
        p.seen[key] = true;
        p.transformAt = ++transformCounter;
        // สวมเกราะราชัน: สวมเกราะเต็มทันที (เพดานเพิ่มเป็น 5)
        if (key === "rachan") p.armor = maxArmorOf(p);
        const firstTime = !p.cutsceneShown[key];
        triggerCutscene(p, key);
        // ครั้งแรก (เล่นวีดีโอ): ต่อด้วยฉากประกาศเปลี่ยนร่าง (ระเบิด + เสียงพากย์) ก่อนขึ้นคนอื่น/สรุปผล
        if (firstTime && key === "rachan") queueTransformAnnounce(p, "rachan");
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
  // Beat Mode: ถ้าใครเลือดตกต่ำกว่า 3 จากการแพ้รอบนี้ -> เข้าประกายเขี้ยวปฏิปักษ์
  for (const p of alivePlayers()) maybeBeatMode(p);
  runCutsceneQueue(goSummary);
}

function goSummary() {
  gameState = "SUMMARY";
  startPhaseTimer(SUMMARY_TIME, afterSummary);
  broadcastState();
}

// ---- โจมตี ----
function attackableTargets(atkId) {
  return alivePlayers().filter((p) => p.id !== atkId);
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
  clearPhaseTimer();

  const ginga = (attacker.statuses.ginga || 0) > 0;
  const beam = (attacker.statuses.beam || 0) > 0;
  const paradiseAtk = (attacker.statuses.paradise || 0) > 0;
  // Ohger Finish: +1 หน่วยหลังเปิดไพ่ — ถ้ายังสวมเกราะราชันอยู่จะเป็น +2 (ไม่ซ้อนกับเงื่อนไขปกติ)
  const ohger = (attacker.statuses.ohger || 0) > 0;
  const ohgerBonus = ohger ? ((attacker.statuses.rachan || 0) > 0 ? 2 : 1) : 0;
  // NT-D System: สวนกลับคนที่ตีเราล่าสุด +1 — NewType Paradise = NT-D แบบพิเศษ ใช้ +1 กับเป้าหมายใดก็ได้
  const isRevenge = attacker.characterId === "banagher" && attacker.ntdTarget && attacker.ntdTarget === target.id;
  const ntdBonus = (isRevenge || paradiseAtk) ? 1 : 0;
  // Ginga no Uta: ถ้าเหลือฝ่ายตรงข้ามเพียงคนเดียว พลังโจมตี +1
  const lastStanding = ginga && alivePlayers().filter((p) => p.id !== attacker.id).length === 1;

  let base = 1 + (ginga ? 1 : 0) + (beam ? 2 : 0) + (lastStanding ? 1 : 0) + ohgerBonus; // Beam Magnum +2
  let dmg = base + ntdBonus;
  if ((target.statuses.monster || 0) > 0) dmg = Math.max(0, dmg - 1);

  // Beam Magnum: หักกระสุน 1 นัดเมื่อได้โจมตีจริงเท่านั้น (ไม่นับถ้าเลือกแล้วไม่ได้ตี/แตกในเทิร์น)
  if (beam && (attacker.beamAmmo || 0) > 0) attacker.beamAmmo--;

  const attackerBeat = beatActive(attacker); // Beat Mode: การโจมตีเป็นความเสียหายจริง ไม่สนเกราะ
  const targetBeat = beatActive(target);     // Beat Mode: จะไม่ตายจากการโจมตีที่ถึงตายทันที
  const hpBefore = target.hp;
  const armorBefore = target.armor;
  const shieldBefore = target.shield;
  if (attackerBeat) dealDirect(target, dmg); // ประกายเขี้ยวปฏิปักษ์: ทะลุเกราะเข้าเลือดจริง
  else dealMixed(target, dmg);               // กฎปกติ: ลดเกราะก่อน ถ้าไม่มีเกราะจึงเข้าเลือดจริง
  // Beat Mode กันตาย (ครั้งเดียวต่อเกม): การโจมตีถึงตายครั้งแรกจะค้างที่ 1 หน่วย
  //  หลังกันตายทำงาน -> เกราะจะไม่ฟื้นคืน + ภูมิดาเมจจากการแพ้ (แต่ครั้งต่อไปจะตายปกติ)
  let beatSaveFired = false;
  if (targetBeat && !target.beatSaved && target.hp < 1) {
    target.hp = 1;
    target.beatSaved = true;
    target.armorLocked = true;
    beatSaveFired = true;
    lastLog.push(`🛡️⚡ ${target.name} ประกายเขี้ยวปฏิปักษ์ — รอดจากการโจมตีถึงตาย! (กันตายได้ครั้งเดียว)`);
  }
  target.wasAttacked = true;
  addSkill(target, 2);
  // Absorb shield: เกราะที่เสียไปจากการถูกโจมตี แปลงกลับเป็นพลังชีวิต
  const armorLost = armorBefore - target.armor;
  if ((target.statuses.absorb || 0) > 0 && armorLost > 0) {
    const heal = Math.min(MAX_HP - target.hp, armorLost);
    if (heal > 0) { target.hp += heal; lastLog.push(`🛡️ ${target.name} Absorb shield แปลงเกราะที่เสีย ${armorLost} → พลังชีวิต +${heal}`); }
  }
  // Beat Mode: ถ้าการโจมตีทำให้เลือดเหลือ < 3 -> เข้าประกายเขี้ยวปฏิปักษ์
  maybeBeatMode(target);
  if (isRevenge) {
    attacker.ntdTarget = null;
    delete attacker.seen.ntd;
    lastLog.push(`⚡ ${attacker.name} แก้แค้น ${target.name} ด้วย NT-D +1 -${dmg} (ลดเกราะก่อน) — NT-D สงบลง`);
  } else {
    lastLog.push(`${attacker.name} โจมตี ${target.name} -${dmg} (ลดเกราะก่อน)`);
  }

  // Ginga: ตีหมู่ — คนที่ไม่ใช่เป้าหมายรับความเสียหายแค่ 1 (Ginga no Uta ไม่มีผลกับการตีหมู่)
  if (ginga) {
    const splashHit = [];
    for (const o of alivePlayers()) {
      if (o.id === attacker.id || o.id === target.id) continue;
      let admg = 1;
      if ((o.statuses.monster || 0) > 0) admg = Math.max(0, admg - 1);
      dealArmorOnly(o, admg);
      o.wasAttacked = true;
      splashHit.push(o);
    }
    if (splashHit.length) lastLog.push(`ตีหมู่ Ginga! ผู้เล่นอื่นเสียเกราะ -1`);
  }

  // Ginga no Uta: ถ้ากำจัดเป้าหมายที่เลือกได้ ต่ออายุท่าไม้ตาย +1 เทิร์น (ชดเชยการลดสถานะตอนจบเทิร์น)
  if (attacker.characterId === "hikaru" && ginga && hpBefore > 0 && target.hp <= 0) {
    attacker.statuses.ginga = (attacker.statuses.ginga || 0) + 1;
    lastLog.push(`🎵 Ginga no Uta: ${attacker.name} กำจัด ${target.name} — ท่าไม้ตายคงอยู่ +1 เทิร์น`);
  }

  // NT-D (บานาจเป็นเป้า): ตั้งบัฟแก้แค้น "คนล่าสุด" — แสดงฉากเมื่อเปลี่ยนเป้าเท่านั้น
  if (target.characterId === "banagher" && attacker.alive) {
    const changed = target.ntdTarget !== attacker.id;
    target.ntdTarget = attacker.id;
    target.seen.ntd = true;
    if (changed) triggerCutscene(target, "ntd");
  }

  // สกิลที่มีผลกับการโจมตีครั้งนี้ (โชว์ใต้อนิเมชัน แยกฝั่งชัดเจน: atk = ฝั่งโจมตี | def = ฝั่งป้องกัน)
  const fxSkills = [];
  const addFx = (x, side) => { if (x) fxSkills.push({ ...x, side }); };
  if (beam) addFx(skillByStatus(attacker, "beam"), "atk");
  if (ohger) addFx(skillByStatus(attacker, "ohger"), "atk");
  if (ginga) addFx(skillByStatus(attacker, "ginga"), "atk");
  if (paradiseAtk && !isRevenge) addFx(skillByStatus(attacker, "paradise"), "atk");
  if (isRevenge) addFx({ name: "NT-D System แก้แค้น +1", img: TRANSFORMS.ntd.img, by: attacker.name, color: POSITION_COLORS[attacker.position] || "#888" }, "atk");
  if (attackerBeat) addFx({ name: "ประกายเขี้ยวปฏิปักษ์ (ทะลุเกราะ)", img: OHGER_FORM, by: attacker.name, color: POSITION_COLORS[attacker.position] || "#888" }, "atk");
  if ((target.statuses.monster || 0) > 0) addFx(skillByStatus(target, "monster"), "def");
  if (shieldBefore > target.shield) addFx({ name: "โล่ป้องกัน (กันความเสียหาย)", img: null, by: target.name, color: POSITION_COLORS[target.position] || "#888" }, "def");
  if ((target.statuses.absorb || 0) > 0 && armorLost > 0) addFx(skillByStatus(target, "absorb"), "def");
  if (beatSaveFired) addFx({ name: "ประกายเขี้ยวปฏิปักษ์ (กันตาย)", img: OHGER_FORM, by: target.name, color: POSITION_COLORS[target.position] || "#888" }, "def");

  // อนิเมชันบอกว่าใครตีใคร
  lastAttack = {
    byName: attacker.name, byImg: displayImg(attacker), byColor: POSITION_COLORS[attacker.position] || "#888",
    targetName: target.name, targetImg: displayImg(target), targetColor: POSITION_COLORS[target.position] || "#888",
    dmg, aoe: ginga, revenge: isRevenge, skills: fxSkills,
  };
  gameState = "ATTACKING";
  // มีข้อมูลสกิลให้อ่าน -> ยืดเวลาอนิเมชันให้อ่านทัน
  startPhaseTimer(fxSkills.length ? ATTACKFX_TIME + 2 : ATTACKFX_TIME, () => runCutsceneQueue(endTurn));
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
      if (k === "ntd" || k === "beat") continue; // NT-D คงอยู่จนแก้แค้น / Beat Mode ถาวรจนตาย
      if (!(p.statuses[k] > 0)) delete p.seen[k];
    }
    // สวมเกราะราชันหมดเวลา: เพดานเกราะกลับเป็นค่าเดิม เกราะส่วนเกินหายไป
    p.armor = Math.min(p.armor, maxArmorOf(p));
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
      armorLocked: false, beatSaved: false, skillUsedRound: false,
      beamAmmo: BEAM_AMMO, puddingUses: PUDDING_USES,
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
