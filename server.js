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

const MAX_HP = 5;       // เลือดจริงพื้นฐาน
const MAX_ARMOR = 2;
const MAX_SKILL = 6;
const BEAM_AMMO = 2;    // กระสุน Beam Magnum ต่อเกม (บานาจ)
const PUDDING_USES = 2; // Rainbow Pudding ใช้ได้ต่อเกม (คุวากาตะ)
const REIJU_USES = 3;   // เรจูอาคมบัญชา ต่อเกม (ฟุจิมารุ)
const MAGE_USES_PER_TURN = 3; // จอมเวทย์ฝึกหัด กดได้ 3 ครั้งต่อเทิร์น (ฟุจิมารุ)
const GAMBLER_USES = 3; // วอสก้าหน่อยน้อง ใช้ได้ต่อเกม (แกมเบลอร์)
const TEMP_HP_TURNS = 2; // เลือดชั่วคราว (แกมเบลอร์) หายเองภายใน 2 เทิร์น
const EVA_BLAST_DMG = 5; // ระเบิด fourth impact (เอวา 13) ใส่ทุกคนในสนาม

// ร่างสุดท้ายฟุจิมารุ (หลังเปิด Everything For Humanity — คงอยู่จนตาย)
const FUJIMARU_FINAL_IMG = "/characters/fujimaru/fujimaru_final.jpg";

// ---------- ระบบกลางวัน/กลางคืน (patch 1.7) ----------
//  เริ่มเกมเป็นกลางวันเสมอ สลับทุก 3 เทิร์น: รอบ 1-3 กลางวัน, 4-6 กลางคืน, 7-9 กลางวัน, ...
//  จบเทิร์นกลางวัน = ทุกคนได้แต้มสกิลเพิ่ม +1 | กลางคืน = เกราะฟื้นทุกเทิร์น (ปกติทุก 2 เทิร์น)
//  cycleShift: Lie Like Vortigern รีเซ็ตเวลากลางคืนให้เหลืออีก 3 เทิร์น — เลื่อนวงจรทั้งเกมไปข้างหน้า
const CYCLE_TURNS = 3;
let cycleShift = 0;
let nightResetPending = false; // ตั้งตอนกดท่าไม้ตาย 2 -> เริ่มนับกลางคืนใหม่ตั้งแต่เทิร์นถัดไป
function isNightRound(n) {
  const m = n - cycleShift;
  return m > 0 && Math.floor((m - 1) / CYCLE_TURNS) % 2 === 1;
}

// ร่างกลางวัน/กลางคืนของโอเบรอน (สลับอัตโนมัติตามช่วงเวลา)
const OBERON_MORNING_IMG = "/characters/oberon/oberon_morning.jpg";
const OBERON_NIGHT_IMG = "/characters/oberon/oberon_night.jpg";
const SUNRISE_CD = 4; // รุ่งอรุณแห่งวันใหม่: รออีก 3 เทิร์นถึงใช้ได้อีก (+1 ชดเชยการลด cd ตอนจบเทิร์นที่ใช้)

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
  // humanity: ท่าไม้ตายฟุจิมารุ — วีดีโอ 13 วิ แล้วเพลง fujimaru_final_theme เล่นค้างระหว่างมีผล
  humanity: { img: FUJIMARU_FINAL_IMG, video: "/characters/fujimaru/fujimaru_final.mp4", title: "EVERYTHING FOR HUMANITY", label: "ปล่อยท่าไม้ตาย", seconds: 13, music: "fujimaru_final", afterReveal: true },
  // monster: เล่นทันทีตอนใช้สกิล (พักช่วงจั่วการ์ดไว้ก่อน) | anataFinal: สกิลติดตัวเทมาริ เล่นก่อนท่าไม้ตายอื่นเสมอ
  monster:  { img: "/characters/hikaru/black_king.webp", video: "/characters/hikaru/ginga_skill3.mp4", title: "MONSTERLIVE", label: "แปลงร่างไคจู", seconds: 10, music: null, afterReveal: false },
  anataFinal: { img: "/characters/temari/temari.webp", video: "/characters/temari/temari_final.mp4", title: "หิวอะโปรดิวเซอร์", label: "สกิลติดตัวทำงาน", seconds: 10, music: null, afterReveal: false },
  // golden: ท่าไม้ตายแกมเบลอร์ ทอยสำเร็จ -> เล่นทันทีก่อนเปิดไพ่ (แบบ monster) + เพลงค้างระหว่างมีผล — วีดีโอ 10 วิ
  golden:   { img: "/characters/gambler/gamnler_final.jpg", video: "/characters/gambler/gambler_final.mp4", title: "เวลาทองของพี่มาแล้ว 777", label: "ปล่อยท่าไม้ตาย", seconds: 11, music: "gambler", afterReveal: false },
  // fourth: ท่าไม้ตายเอวา 13 (หลังเปิดไพ่) — วีดีโอ 10 วิ + เพลงค้างระหว่างมีผล
  fourth:   { img: "/characters/eva13/eva13_final.jpg", video: "/characters/eva13/eva13_final.mp4", title: "FOURTH IMPACT", label: "ปล่อยท่าไม้ตาย", seconds: 11, music: "eva13", afterReveal: true },
  // eva3: สกิลติดตัว 3 เอวา 13 (เลือด <= 3) — วีดีโอ 9 วิ | evaboom: สกิลติดตัว 1 ตายขณะ fourth impact — วีดีโอ 17 วิ
  eva3:     { img: "/characters/eva13/eva13_passive3.jpg", video: "/characters/eva13/eva13_passive3.mp4", title: "อย่าให้ฉันทำแแบบนี้เลย", label: "สกิลติดตัวทำงาน", seconds: 10, music: null, afterReveal: false },
  evaboom:  { img: "/characters/eva13/eva13.webp", video: "/characters/eva13/eva13_passive1.mp4", title: "ไม่สามารถแก้ไขอะไรได้อีกแล้ว", label: "สกิลติดตัวทำงาน", seconds: 18, music: null, afterReveal: false },
  // ---------- โอเบรอน (patch 1.7) ----------
  // lai: ท่าไม้ตายกลางวัน — วีดีโอ 13 วิ | vortigern: ท่าไม้ตายกลางคืน — วีดีโอ 16 วิ
  // (ฉากหลัง "ราตรีกลืนกิน" ไม่ผูกกับท่าไม้ตาย — ทำงานเองทุกครั้งที่เข้ากลางคืนขณะมีโอเบรอนอยู่ในเกม)
  lai:       { img: "/characters/oberon/oberon_skill3_morning.webp", video: "/characters/oberon/oberon_final_morning.mp4", title: "LAI RHYME GOODFELLOW", label: "ปล่อยท่าไม้ตาย", seconds: 14, music: null, afterReveal: true },
  vortigern: { img: "/characters/oberon/oberon_skill3_night.jpg", video: "/characters/oberon/oberon_final_night.mp4", title: "LIE LIKE VORTIGERN", label: "ปล่อยท่าไม้ตาย", seconds: 17, music: null, afterReveal: true },
  // oberonNight: สลับร่างตอนเข้ากลางคืน (วีดีโอ 5 วิ) | oberonDay: กลับร่างกลางวัน = แจ้งเตือนปกติ ไม่มีวีดีโอ
  oberonNight: { img: OBERON_NIGHT_IMG, video: "/characters/oberon/morning_tonight.mp4", title: "ราชาแห่งการหลอกลวง", label: "สลับร่างยามราตรี", seconds: 6, music: null, afterReveal: false },
  oberonDay:   { img: OBERON_MORNING_IMG, video: null, title: "ราชาแห่งภูติ", label: "กลับคืนร่างกลางวัน", seconds: 0, music: null, afterReveal: false },
};


// ---------- สถานะเกมส่วนกลาง ----------
let players = {};
let gameState = "LOBBY"; // LOBBY | PLAYING | CUTSCENE | SUMMARY | ATTACK | TRANSITION | GAMEOVER
let timeLeft = 0;
let phaseTimerId = null;
let attackerId = null;
let roundWinnerId = null;
let roundTiedWin = false;  // ผู้ชนะได้จากการเสมอแต้ม -> ไม่มีเทิร์นโจมตีรอบนี้
let roundNumber = 0;
let lastLog = [];
let reservations = {};
let cutsceneQueue = [];
let cutsceneInfo = null;
let cutsceneSeq = 0;      // id ต่อ cutscene (ให้ client remount วีดีโอ กันจอดำ)
let transformCounter = 0; // ลำดับการเปิดร่าง (ใช้เลือกเพลงตอนสวนท่ากัน)
let anataMusicSeq = 0;    // เพลง ANATA WAAAAAAAA เล่นระหว่างช่วงจั่วการ์ด จบเมื่อทุกคนเปิดไพ่
let oberonDevour = 0;     // ราตรีกลืนกิน: เปิดเมื่อโอเบรอนใช้ท่าไม้ตาย 2 (Vortigern) — หายไปเมื่อหมดกลางคืน (0 = ปิด)
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

// Song for you (เทมาริ): โบนัสจากชามทงคัสสึที่กินสะสม — 3 ชาม = 1 หน่วย สูงสุด 3 (9 ชาม)
function songBonus(p) {
  return Math.min(3, Math.floor((p.tonkatsu || 0) / 3));
}
function songActive(p) {
  return !!p && ((p.statuses && p.statuses.song) || 0) > 0;
}
// เกราะสูงสุดของผู้เล่น: ปกติ 2 — ระหว่างสวมเกราะราชัน (ท่าไม้ตายคุวากาตะ) เพิ่ม +3 เป็น 5
// ระหว่าง Song for you (เทมาริ) เพิ่มตามโบนัสชามทงคัสสึ (สูงสุด +3)
// ระหว่าง Everything For Humanity (ฟุจิมารุ) เพิ่ม +3
// ระหว่างสกิลติดตัว 3 เอวา 13 (เลือด <= 3) เพิ่ม +1
// ระหว่าง Lie Like Vortigern (โอเบรอน) เป้าหมายได้เพดานเกราะ +2
function maxArmorOf(p) {
  return MAX_ARMOR
    + ((((p.statuses && p.statuses.rachan) || 0) > 0) ? 3 : 0)
    + ((((p.statuses && p.statuses.humanity) || 0) > 0) ? 3 : 0)
    + ((((p.statuses && p.statuses.vortarmor) || 0) > 0) ? 2 : 0)
    + (songActive(p) ? songBonus(p) : 0)
    + (eva3Active(p) ? 1 : 0);
}
// เรจูอาคมบัญชา คำสั่ง 1 (ฟุจิมารุ): อมตะ 1 เทิร์น — ไม่รับความเสียหายใดๆ
function sealActive(p) {
  return !!p && ((p.statuses && p.statuses.seal) || 0) > 0;
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
  p.beatAt = p.transformAt; // ล็อกลำดับตอนเข้า Beat (ให้เพลง ex_guts ไม่รีสตาร์ทตอนแปลงร่างอื่นทีหลัง)
  const firstTime = !p.cutsceneShown.beat;
  triggerCutscene(p, "beat");
  if (firstTime) queueTransformAnnounce(p, "beat"); // วีดีโอ -> ประกาศเปลี่ยนร่าง (ระเบิดเขียว + เสียงพากย์)
  lastLog.push(`⚡ ${p.name} เข้าสู่ประกายเขี้ยวปฏิปักษ์ (Beat Mode)!`);
}
// Beat Mode กันตาย: ทำงานทันทีเมื่อความเสียหายถึงตาย ไม่ต้องรอเข้า Beat Mode ก่อน
// (ครั้งเดียวต่อเกม — ค้างที่ 1 หน่วย, เกราะไม่ฟื้นคืน, ภูมิดาเมจจากการแพ้ตอนจั่วการ์ด)
function maybeBeatSave(p) {
  if (!p || !p.alive || p.characterId !== "kuwagata") return false;
  if (p.beatSaved || p.hp >= 1) return false;
  p.hp = 1;
  p.beatSaved = true;
  p.armorLocked = true;
  lastLog.push(`🛡️⚡ ${p.name} ประกายเขี้ยวปฏิปักษ์ — รอดจากความเสียหายถึงตาย! (กันตายได้ครั้งเดียว)`);
  return true;
}
// ---------- เอวานเกเลี่ยน หมายเลข 13 ----------
// สกิลติดตัว 3 อย่าให้ฉันทำแแบบนี้เลย: เลือด <= 3 = ทำงาน (ห้ามจั่วของสกิลรอง +1 เทิร์น, เพดานเกราะ +1)
function eva3Active(p) {
  return !!p && p.alive && p.characterId === "eva13" && p.hp > 0 && p.hp <= 3;
}
// เข้าสกิลติดตัว 3 ครั้งแรก: เล่นวีดีโอ + ฟื้นเกราะให้ 1 หน่วย (เพดานเพิ่มแล้วผ่าน maxArmorOf)
function maybeEva3(p) {
  if (!eva3Active(p)) return;
  if (p.seen && p.seen.eva3) return; // เข้าแล้วครั้งเดียวพอ (ผลเปิด/ปิดตามเลือดจริง)
  p.seen.eva3 = true;
  p.armor = Math.min(maxArmorOf(p), p.armor + 1); // ฟื้นเกราะให้ด้วย
  triggerCutscene(p, "eva3");
  lastLog.push(`🗡️ ${p.name} อย่าให้ฉันทำแแบบนี้เลย — เพดานเกราะ +1 และฟื้นเกราะ!`);
}
// สกิลติดตัว 2 ทุกอย่างไร้ความหมาย: ไม่รับดาเมจแพ้จั่ว/แตก
//  - fourth impact อยู่ = บังคับทำงานแบบไม่ติดเงื่อนไข
//  - สกิลติดตัว 3 ทำงานอยู่ (เลือด <= 3) = สกิลติดตัว 2 ไม่ทำงาน
function evaLossImmune(p) {
  if (!p || p.characterId !== "eva13") return false;
  if ((p.statuses.fourth || 0) > 0) return true;
  return !eva3Active(p);
}

// ---------- Gambler the gambling ----------
// สกิลติดตัว แจ๊กพอตแตก!: เลือด < 3 -> โชคด้านบวก +10% และผลดีทุกอย่าง +1 หน่วย
function gamblerJackpot(p) {
  return !!p && p.alive && p.characterId === "gambler" && p.hp < 3;
}
// โอกาสสำเร็จด้านบวก: พื้นฐาน 50% + สกิลติดตัว 10% (ทุกสกิล รวมท่าไม้ตาย) + เวลาทอง 10%
// (เวลาทองไม่มีผลกับท่าไม้ตายอยู่แล้ว — ระหว่างบัฟยังอยู่กดท่าไม้ตายซ้ำไม่ได้)
function gamblerChance(p, tier) {
  let c = 0.5;
  if (gamblerJackpot(p)) c += 0.1;
  if (tier !== "ultimate" && (p.statuses.golden || 0) > 0) c += 0.1;
  return c;
}
// ฮีลพร้อมล้น: เลือดจริง -> เกราะ -> เลือดชั่วคราว (หายเองใน 2 เทิร์น / หมดเมื่อรับดาเมจ)
//  คืนรายละเอียดว่าฮีลครั้งนี้ลงช่องไหนเท่าไหร่ (ใช้แจ้งผลใน log ให้ชัด)
function healOverflow(p, amount) {
  let left = amount;
  const toHp = Math.min(left, MAX_HP - p.hp);
  p.hp += toHp; left -= toHp;
  let toArmor = 0;
  if (left > 0) {
    toArmor = Math.min(left, Math.max(0, maxArmorOf(p) - p.armor));
    p.armor += toArmor; left -= toArmor;
  }
  if (left > 0) {
    p.tempHp = (p.tempHp || 0) + left;
    p.tempHpTurns = TEMP_HP_TURNS;
  }
  return { toHp, toArmor, toTemp: left };
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

// รูปที่แสดง: Beat Mode (ถาวรจนตาย) > ร่างสุดท้ายฟุจิมารุ (จนตาย) > Paradise (เหนือกว่าสกิลติดตัว NT-D)
//  > NT-D คงอยู่จนแก้แค้น > ไคจู Black King > Ginga > สวมเกราะราชัน
function displayImg(p) {
  // โอเบรอน: ร่างสลับตามช่วงเวลากลางวัน/กลางคืนเสมอ
  if (p.characterId === "oberon") return isNightRound(roundNumber) ? OBERON_NIGHT_IMG : OBERON_MORNING_IMG;
  if (p.seen && p.seen.beat) return OHGER_FORM;
  if (p.humanityActivated) return FUJIMARU_FINAL_IMG; // Everything For Humanity: คงร่างจนตาย
  // เอวา 13: Fourth Impact (ท่าไม้ตาย) > สกิลติดตัว 3 (เลือด <= 3)
  if (p.seen && p.seen.fourth && (p.statuses.fourth || 0) > 0) return TRANSFORMS.fourth.img;
  if (p.seen && p.seen.eva3 && eva3Active(p)) return TRANSFORMS.eva3.img;
  // NewType Paradise อยู่เหนือกว่าสกิลติดตัว NT-D — ระหว่างร่าง Paradise คงภาพ Paradise ไว้
  if (p.seen && p.seen.paradise && (p.statuses.paradise || 0) > 0) return TRANSFORMS.paradise.img;
  if (p.ntdTarget && p.seen && p.seen.ntd) return TRANSFORMS.ntd.img;
  for (const key of ["monster", "ginga", "rachan", "golden"]) {
    if (p.seen && p.seen[key] && (p.statuses[key] || 0) > 0) return TRANSFORMS[key].img;
  }
  return p.img;
}
// เพลงสกิล: Beat Mode (ex_guts) ทับทุกเพลงจนผู้ใช้ตาย > คนที่เปิดร่างล่าสุด
//  คืน { music, at } — at = ลำดับการเปิดร่าง ให้ client รู้ว่าเป็น "การเปิดครั้งใหม่"
//  (เปิดท่าซ้ำ / คนอื่นเปิดท่าเพลงเดียวกันทับ) -> เพลงต้องเริ่มใหม่จากต้น
function activeSkillMusic() {
  let bestBeat = null;
  for (const p of alivePlayers()) {
    if (p.seen && p.seen.beat) {
      if (!bestBeat || (p.beatAt || 0) > bestBeat.at) bestBeat = { music: "ex_guts", at: p.beatAt || 0 };
    }
  }
  if (bestBeat) return bestBeat;
  let best = null;
  for (const key of ["ginga", "paradise", "rachan", "humanity", "golden", "fourth"]) {
    const t = TRANSFORMS[key];
    if (!t.music) continue;
    for (const p of alivePlayers()) {
      if (p.seen && p.seen[key] && (p.statuses[key] || 0) > 0) {
        if (!best || (p.transformAt || 0) > best.at) best = { music: t.music, at: p.transformAt || 0 };
      }
    }
  }
  return best;
}

// เลือดจริงลด 1 หน่วย — เลือดชั่วคราว (แกมเบลอร์) รับแทนก่อนเสมอ (หมดไปเพราะได้รับความเสียหาย)
function loseHp(p) {
  if ((p.tempHp || 0) > 0) { p.tempHp--; return; }
  p.hp--; p.dmgHp++;
}
// เรจูอาคมบัญชา (อมตะ): ไม่รับความเสียหายใดๆ ตลอดเทิร์น — กันไว้กลางทางทุกช่องทางดาเมจ
function damageSoft(p) {
  if (!p.alive || sealActive(p)) return;
  if (p.shield > 0) { p.shield--; return; }
  if (p.armor > 0) { p.armor--; p.dmgArmor++; }
  else loseHp(p);
}
function dealDirect(p, n) {
  if (sealActive(p)) return;
  for (let i = 0; i < n; i++) {
    if (!p.alive) return;
    if (p.shield > 0) { p.shield--; continue; }
    loseHp(p);
  }
}
function dealArmorOnly(p, n) {
  if (sealActive(p)) return;
  for (let i = 0; i < n; i++) {
    if (p.shield > 0) { p.shield--; continue; }
    if (p.armor > 0) { p.armor--; p.dmgArmor++; }
  }
}
function dealMixed(p, n) { // เกราะก่อนแล้วเลือด (สำหรับ NT-D)
  if (sealActive(p)) return;
  for (let i = 0; i < n; i++) {
    if (!p.alive) return;
    if (p.shield > 0) { p.shield--; continue; }
    if (p.armor > 0) { p.armor--; p.dmgArmor++; }
    else loseHp(p);
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
  for (const tier of ["basic", "secondary", "ultimate", "ultimateNight"]) {
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
  // ANATA WAAAAAAAA (เทมาริ): ผู้ใช้ไพ่แตกเอง = ท่าไม้ตายเป็นโมฆะ
  if ((p.statuses.anata || 0) > 0 && p.anataTargets) {
    delete p.statuses.anata;
    p.anataTargets = null;
    anataMusicSeq = 0;
    lastLog.push(`💥 ${p.name} ไพ่แตก! ท่าไม้ตาย ANATA WAAAAAAAA ใช้งานไม่ได้ — แต้มสกิลเสียฟรี`);
  }
}

function resetRoundDisplay(p) {
  p.dmgHp = 0; p.dmgArmor = 0; p.gainedSkill = 0;
  p.wasAttacked = false; p.isWinner = false; p.isLoser = false;
}
function resetCombat(p) {
  p.hp = MAX_HP; p.armor = MAX_ARMOR; p.skillPoints = 0; p.alive = true; p.shield = 0;
  p.statuses = {}; p.seen = {}; p.ntdTarget = null; p.transformAt = 0; p.beatAt = 0;
  p.armorLocked = false; // Beat Mode: กันตายแล้วเกราะจะไม่ฟื้นคืน
  p.beatSaved = false;   // Beat Mode: กันตายได้ครั้งเดียวต่อเกม (คล้าย Focus Sash)
  p.skillUsedRound = false; // ใช้สกิลได้ 1 อันต่อเทิร์น
  p.beamAmmo = BEAM_AMMO; // กระสุน Beam Magnum รีเซ็ตต้นเกม
  p.puddingUses = PUDDING_USES; // Rainbow Pudding รีเซ็ตต้นเกม
  p.tonkatsu = 0;         // เทมาริ: ชามทงคัสสึที่กินสะสม (ไม่รีเซ็ตระหว่างแมตช์)
  p.songUsedOnce = false; // Song for you: ครั้งแรกเติมเกราะให้ ครั้งถัดไปเพิ่มแค่เพดาน
  p.noDrawNext = 0;       // จำนวนเทิร์นที่จั่วเพิ่มไม่ได้ เริ่มเทิร์นถัดไป (ทงคัสสึ / กำไรเท่าตัวโว้ย)
  p.noSkillNext = 0;      // จำนวนเทิร์นที่ใช้สกิลไม่ได้ เริ่มเทิร์นถัดไป (หอกลองกินัส เอวา 13)
  p.gamblerUses = GAMBLER_USES; // แกมเบลอร์: วอสก้าหน่อยน้อง 3 ครั้งต่อเกม (เวลาทองรีเซ็ตให้เต็ม)
  p.profit = 0;           // แกมเบลอร์: บัฟกำไรเท่าตัวโว้ย (+โจมตี, ทะลุเกราะ) สะสมจนกว่าจะได้ตี
  p.tempHp = 0;           // แกมเบลอร์: เลือดชั่วคราวจากฮีลล้น
  p.tempHpTurns = 0;      // เลือดชั่วคราวหายเองเมื่อครบ 2 เทิร์น
  p.anataTargets = null;  // เป้าหมาย ANATA WAAAAAAAA (ลับจนกว่าจะเปิดไพ่)
  p.reiju = REIJU_USES;   // ฟุจิมารุ: เรจูอาคมบัญชา 3 ครั้งต่อเกม
  p.mageUses = 0;         // จอมเวทย์ฝึกหัด: จำนวนครั้งที่กดในเทิร์นนี้ (สูงสุด 3)
  p.mageHealNext = 0;     // จอมเวทย์ฝึกหัด: ฟื้นเลือดเทิร์นถัดไปตามจำนวนครั้งที่ใช้
  p.humanityActivated = false; // Everything For Humanity เปิดแล้ว (ร่างสุดท้ายจนตาย + ตายเมื่อผลจบ)
  p.sunriseCd = 0;   // โอเบรอน: คูลดาวน์รุ่งอรุณแห่งวันใหม่ (รอ 3 เทิร์น)
  p.sunriseDrop = 0; // โอเบรอน: เทิร์นถัดมาพลังชีวิตลดลง 2 หน่วยอัตโนมัติ (หลังโดนฮีล 5)
  p.cutsceneShown = {}; // เล่นวีดีโอครั้งเดียวต่อเกม (per match)
}


// ============================================================
//  ส่งสถานะ
// ============================================================
// สถานะที่ผู้เล่นคนอื่นเห็นได้ระหว่างช่วงจั่วการ์ด (patch 1.7.1): โชว์ให้ดูของกันและกันได้
//  ยกเว้นสกิลหลังเปิดไพ่ที่เพิ่งกดรอไว้ในเทิร์นนี้ — เปิดเผยเมื่อทำงานแล้วเท่านั้น (กันสปอยล์)
const HIDDEN_UNTIL_REVEAL = ["beam", "ohger", "absorb", "spear"];
function publicStatuses(p) {
  const out = {};
  for (const [k, v] of Object.entries(p.statuses || {})) {
    if (TRANSFORMS[k] && TRANSFORMS[k].afterReveal && !(p.seen && p.seen[k])) continue;
    if (HIDDEN_UNTIL_REVEAL.includes(k)) continue;
    out[k] = v;
  }
  if (p.ntdTarget) out.ntd = 1;
  return out;
}
function buildStateFor(viewerId) {
  const revealAll = gameState !== "PLAYING" && gameState !== "LOBBY";
  // เพลง ANATA WAAAAAAAA ทับทุกเพลงระหว่างช่วงจั่วการ์ด — จบลงเมื่อทุกคนพร้อมเปิดไพ่แล้ว
  const nightNow = isNightRound(roundNumber);
  // ราตรีกลืนกิน: เปิดเมื่อโอเบรอนใช้ท่าไม้ตาย 2 (Lie Like Vortigern) — ฉากหลังกลางคืนกลายเป็น
  //  วีดีโอ oberon_background.mp4 + เพลงประจำตัวเล่นค้าง และหายไปเมื่อหมดกลางคืน
  const oberonBg = nightNow && oberonDevour > 0;
  let sm = (gameState === "PLAYING" && anataMusicSeq)
    ? { music: "temari_final_theme", at: anataMusicSeq }
    : activeSkillMusic();
  if (!sm && oberonBg) sm = { music: "oberon", at: oberonDevour }; // เพลงสกิล/ท่าไม้ตายอื่นยังทับได้
  return {
    gameState,
    timeLeft,
    roundNumber,
    cycle: nightNow ? "night" : "day", // กลางวัน/กลางคืน (สลับทุก 3 เทิร์น)
    oberonBg,
    maxPlayers: MAX_PLAYERS,
    youId: viewerId,
    attackerId: gameState === "ATTACK" ? attackerId : null,
    winnerId: (gameState === "SUMMARY" || gameState === "ATTACK") ? roundWinnerId : null,
    skillMusic: sm ? sm.music : null,
    skillMusicSeq: sm ? sm.at : 0, // เปลี่ยน = การเปิดร่างครั้งใหม่ -> client เริ่มเพลงใหม่
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
        tempHp: p.tempHp || 0, // เลือดชั่วคราว (แกมเบลอร์)
        // เอฟเฟครอบการ์ด (เห็นทุกคน): เขี้ยวปฏิปักษ์สีเขียว (ถาวร) / เกราะราชันสีแดง (ตอนสวม)
        beat: !!(p.seen && p.seen.beat),
        rachan: !!(p.seen && p.seen.rachan) && (p.statuses.rachan || 0) > 0,
        skillPoints: p.skillPoints, maxSkill: MAX_SKILL,
        beamAmmo: p.beamAmmo,
        puddingUses: p.puddingUses,
        gamblerUses: p.gamblerUses, // แกมเบลอร์: จำนวนวอสก้าหน่อยน้องคงเหลือ
        profit: p.profit || 0,      // แกมเบลอร์: บัฟกำไรเท่าตัวโว้ยสะสม
        sunriseCd: p.sunriseCd || 0, // โอเบรอน: คูลดาวน์รุ่งอรุณแห่งวันใหม่คงเหลือ
        reiju: p.reiju,       // ฟุจิมารุ: เรจูอาคมบัญชาคงเหลือ (UI พิเศษ reiju0-3.jpg)
        mageUses: p.mageUses, // จอมเวทย์ฝึกหัด: กดไปแล้วกี่ครั้งในเทิร์นนี้ (สูงสุด 3)
        tonkatsu: p.tonkatsu || 0, // เทมาริ: ชามทงคัสสึสะสม (UI สะสมชาม)
        atCap: scoreOf(p) >= scoreCap(p), // แต้มเต็มเพดาน (21/UPG) -> ปิดปุ่มจั่ว รอเปิดไพ่เอง
        skillUsed: !!p.skillUsedRound,    // ใช้สกิลไปแล้วในเทิร์นนี้ (1 อันต่อเทิร์น)
        alive: p.alive,
        statuses: show ? { ...p.statuses, ...(p.ntdTarget ? { ntd: 1 } : {}) } : publicStatuses(p),
        character: {
          // โอเบรอน: กลางคืนสลับชื่อ + ท่าไม้ตายเป็นเวอร์ชันกลางคืน (Lie Like Vortigern)
          id: ch.id, name: nightNow && ch.nightName ? ch.nightName : ch.name,
          passive: ch.passive ? { name: ch.passive.name, desc: ch.passive.desc } : null,
          basic: pub(ch.basic), secondary: pub(ch.secondary),
          ultimate: pub(nightNow && ch.ultimateNight ? ch.ultimateNight : ch.ultimate),
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
// ครั้งแรกต่อเกม/ต่อคน = เล่นวีดีโอเต็ม (หยุดกระดาน), ครั้งต่อไป = แค่การ์ดแจ้งเตือนเล็กๆ ไม่หยุดเกม
function triggerCutscene(p, key) {
  if (p.cutsceneShown[key]) notifyTransform(p, key);
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
// การ์ดแจ้งเตือนเล็กๆ (ครั้งที่ 2 เป็นต้นไป): ส่งทันทีแบบเดียวกับ skillFlash — ไม่ตัดเข้าเฟส CUTSCENE
// ไม่หยุดเวลา/กระดาน แค่บอกว่าใครใช้ท่าอะไรซ้ำ
function notifyTransform(p, key) {
  const t = TRANSFORMS[key];
  if (!t) return;
  io.emit("transformNotice", {
    playerId: p.id, name: p.name,
    img: t.img, color: POSITION_COLORS[p.position] || "#9B4F96",
    title: t.title, label: t.label,
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
// พักช่วงจั่วการ์ดไว้ เล่น cutscene ให้จบ แล้วกลับมาจั่วต่อด้วยเวลาที่เหลือ
// (ใช้กับสกิลที่แปลงร่างทันทีก่อนเปิดไพ่ เช่น MonsterLive)
function pausePlayingForCutscene() {
  const remain = Math.max(3, timeLeft);
  clearPhaseTimer();
  runCutsceneQueue(() => {
    gameState = "PLAYING";
    startPhaseTimer(remain, resolveRound);
    broadcastState();
    checkAllLocked();
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
  cycleShift = 0;
  nightResetPending = false;
  oberonDevour = 0;
  dealRound();
}

function dealRound() {
  clearPhaseTimer();
  roundNumber++;
  // รีเซ็ตเวลากลางคืน (Lie Like Vortigern): นับกลางคืนใหม่ — เทิร์นนี้เป็นคืนที่ 1 จาก 3
  const prevNight = isNightRound(roundNumber - 1); // เช็คด้วยวงจรเดิมก่อนเลื่อน (กันแบนเนอร์สลับเวลาเด้งผิด)
  if (nightResetPending) {
    nightResetPending = false;
    cycleShift = roundNumber - (CYCLE_TURNS + 1); // ให้เทิร์นนี้ตรงกับคืนแรกของวงจร
  }
  lastLog = [];
  attackerId = null;
  roundWinnerId = null;
  roundTiedWin = false;
  cutsceneQueue = [];
  cutsceneInfo = null;
  lastAttack = null;
  roundSkills = [];
  anataMusicSeq = 0;

  for (const p of Object.values(players)) {
    resetRoundDisplay(p);
    p.shield = 0;
    p.skillUsedRound = false; // เทิร์นใหม่ ใช้สกิลได้อีก 1 อัน
    p.mageUses = 0;           // จอมเวทย์ฝึกหัด: นับใหม่ทุกเทิร์น (กดได้ 3 ครั้งต่อเทิร์น)
    p.anataTargets = null;
    // ห้ามจั่วการ์ดเพิ่มที่ตั้งไว้จากเทิร์นก่อน (ทงคัสสึ / กำไรเท่าตัวโว้ย) — noDrawNext เป็นจำนวนเทิร์น
    if (p.noDrawNext) {
      p.statuses.nodraw = Math.max(p.statuses.nodraw || 0, Number(p.noDrawNext) || 1);
      p.noDrawNext = 0;
    }
    // ห้ามใช้สกิลที่ตั้งไว้จากเทิร์นก่อน (หอกลองกินัส เอวา 13)
    if (p.noSkillNext) {
      p.statuses.noskill = Math.max(p.statuses.noskill || 0, Number(p.noSkillNext) || 1);
      p.noSkillNext = 0;
    }
    if (!p.alive) { p.cards = []; p.locked = true; p.busted = false; continue; }

    // รุ่งอรุณแห่งวันใหม่ (โอเบรอน): เทิร์นถัดมาพลังชีวิตลดลง 2 หน่วยอัตโนมัติ
    if ((p.sunriseDrop || 0) > 0) {
      const drop = p.sunriseDrop;
      p.sunriseDrop = 0;
      for (let i = 0; i < drop; i++) loseHp(p);
      lastLog.push(`🌄 ${p.name} ผลรุ่งอรุณแห่งวันใหม่จางลง — พลังชีวิตลดลง -${drop}`);
      if (p.hp <= 0) {
        p.hp = 0; p.alive = false; p.result = "dead"; p.cards = []; p.locked = true; p.busted = false;
        lastLog.push(`💀 ${p.name} เลือดจริงหมด ตกรอบ!`);
        continue;
      }
    }

    // เกราะฟื้น 1 หน่วยทุก 2 เทิร์น (รอบเลขคู่) — จบเทิร์นช่วงกลางคืน: ฟื้นทุกเทิร์น
    // Beat Mode: หลังกันตายทำงาน เกราะจะไม่ฟื้นคืน (prevNight = เทิร์นที่เพิ่งจบเป็นกลางคืนตามวงจรเดิม)
    if (!p.armorLocked && (roundNumber % 2 === 0 || prevNight)) {
      p.armor = Math.min(maxArmorOf(p), p.armor + 1);
    }
    // จอมเวทย์ฝึกหัด (ฟุจิมารุ): ฟื้นพลังชีวิต 1 หน่วยตามจำนวนครั้งที่ใช้สกิลในเทิร์นก่อน
    if (p.mageHealNext > 0) {
      const heal = Math.min(MAX_HP - p.hp, p.mageHealNext);
      if (heal > 0) {
        p.hp += heal;
        lastLog.push(`🪄 ${p.name} จอมเวทย์ฝึกหัด — ฟื้นพลังชีวิต +${heal}`);
      }
      p.mageHealNext = 0;
    }
    // การตื่นขึ้น (Lai Rhyme Goodfellow โอเบรอน): ฟื้นพลังชีวิตเทิร์นละ 1 หน่วย
    if ((p.statuses.awaken || 0) > 0 && p.hp < MAX_HP) {
      p.hp++;
      lastLog.push(`⏰ ${p.name} การตื่นขึ้น — ฟื้นพลังชีวิต +1`);
    }
    firePassive(p, "roundStart");

    p.cards = [];
    p.cards.push(drawCardFor(p));
    p.cards.push(drawCardFor(p));
    p.locked = false;
    p.busted = false;
    p.result = null;

    // หลับไหล (Lie Like Vortigern โอเบรอน): ออกการกระทำใดๆ ไม่ได้ทั้งเทิร์น
    // และเสียพลังชีวิตแบบไม่สนเกราะเทิร์นละ 1 หน่วย — ไม่ถึงตายจากผลนี้ (เลือดเหลือ 2 จะไม่ลดต่อ)
    if ((p.statuses.sleep || 0) > 0) {
      p.locked = true;
      if (p.hp > 2) { p.hp--; p.dmgHp++; }
      lastLog.push(`💤 ${p.name} หลับไหลจากคำลวงของราชาภูติ — ขยับไม่ได้ (เหลืออีก ${p.statuses.sleep} เทิร์น)`);
    }
  }

  // สลับช่วงเวลากลางวัน/กลางคืน (ทุก 3 เทิร์น): โอเบรอนสลับร่างอัตโนมัติ
  const night = isNightRound(roundNumber);
  if (!night && oberonDevour) {
    oberonDevour = 0; // ราตรีกลืนกิน หายไปเมื่อหมดกลางคืน
    lastLog.push("🌄 ราตรีกลืนกินจางหายไปพร้อมแสงแรกของวัน");
  }
  if (roundNumber > 1 && night !== prevNight) {
    lastLog.push(night ? "🌙 ราตรีมาเยือน — เกราะจะฟื้นทุกเทิร์น" : "☀️ ฟ้าสางแล้ว — จบเทิร์นได้แต้มสกิลเพิ่ม +1");
    for (const p of alivePlayers()) {
      if (p.characterId !== "oberon") continue;
      if (night) triggerCutscene(p, "oberonNight"); // ครั้งแรกเล่นวีดีโอ morning_tonight.mp4 / ครั้งถัดไปแจ้งเตือนเล็กๆ
      else notifyTransform(p, "oberonDay");         // กลับร่างกลางวัน = แจ้งปกติ ไม่มีวีดีโอ
    }
  }

  gameState = "PLAYING";
  startPhaseTimer(CARD_TIME, resolveRound);
  if (cutsceneQueue.length) { pausePlayingForCutscene(); return; } // วีดีโอสลับร่างโอเบรอนตอนเข้ากลางคืน
  broadcastState();
  checkAllLocked();
}

function hit(id) {
  const p = players[id];
  if (gameState !== "PLAYING" || !p || !p.alive || p.locked) return;
  if ((p.statuses.nodraw || 0) > 0) return; // อิ่มทงคัสสึเกิน: เทิร์นนี้จั่วเพิ่มไม่ได้
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
function useSkill(id, tier, targets) {
  const p = players[id];
  if (gameState !== "PLAYING" || !p || !p.alive || p.locked) return;
  if (!["basic", "secondary", "ultimate"].includes(tier)) return;
  const ch = CHAR_BY_ID[p.characterId];
  let skill = ch && ch[tier];
  if (!skill) return;
  // โอเบรอน: ท่าไม้ตายสลับตามช่วงเวลา — กลางคืนใช้ Lie Like Vortigern แทน
  if (tier === "ultimate" && ch.ultimateNight && isNightRound(roundNumber)) skill = ch.ultimateNight;
  if ((p.statuses.noskill || 0) > 0) return; // โดนหอกลองกินัสปัก: เทิร์นนี้ใช้สกิลไม่ได้

  // เวลาทอง (แกมเบลอร์): แต้มที่ใช้ของสกิลพื้นฐาน/สกิลรองลดครึ่งหนึ่ง
  const isGambler = p.characterId === "gambler";
  const goldenOn = (p.statuses.golden || 0) > 0;
  let cost = skill.cost;
  if (isGambler && goldenOn && (tier === "basic" || tier === "secondary")) cost = Math.ceil(cost / 2);
  if (p.skillPoints < cost) return;

  const st = skill.effect && !Array.isArray(skill.effect) && skill.effect.type === "status" ? skill.effect.status : null;

  // จอมเวทย์ฝึกหัด (ฟุจิมารุ): กดซ้ำได้ถึง 3 ครั้งต่อเทิร์น — เป็นข้อยกเว้นของกฎ 1 สกิลต่อเทิร์น
  const isMage = p.characterId === "fujimaru" && tier === "basic";
  const mageRepeat = isMage && (p.mageUses || 0) > 0 && (p.mageUses || 0) < MAGE_USES_PER_TURN;
  // เวลาทอง (แกมเบลอร์): กดสกิลพื้นฐานซ้ำในเทิร์นเดียวได้ จนกว่าจำนวนใช้/แต้มจะหมด
  const isGamble = isGambler && tier === "basic";
  const gambleRepeat = isGamble && goldenOn;
  if (p.skillUsedRound && !mageRepeat && !gambleRepeat) return; // ใช้สกิลได้เพียง 1 อันต่อเทิร์น (ซ้ำ/ซ้อนไม่ได้)
  if (isMage && (p.mageUses || 0) >= MAGE_USES_PER_TURN) return;
  // จอมเวทย์ฝึกหัด: ระหว่างเปิด Everything For Humanity ใช้ไม่ได้
  if (isMage && (p.statuses.humanity || 0) > 0) return;
  // Mystic Code (ฟุจิมารุ): ต้องมีเกราะเหลือ และต้องเปิด Everything For Humanity อยู่เท่านั้น
  const isMystic = p.characterId === "fujimaru" && tier === "secondary";
  if (isMystic && ((p.statuses.humanity || 0) <= 0 || p.armor < 1)) return;
  // Everything For Humanity: ต้องมีเรจูอาคมบัญชาครบ 3 เท่านั้น (ใช้หมดทั้ง 3 ตอนกด)
  if (st === "humanity" && (p.reiju || 0) < REIJU_USES) return;
  // Beat Mode (ประกายเขี้ยว): สกิลพื้นฐาน + ท่าไม้ตายใช้ไม่ได้ (ใช้ได้แค่สกิลรอง)
  if ((tier === "basic" || tier === "ultimate") && beatActive(p)) return;
  // ท่าไม้ตาย: กดซ้ำไม่ได้จนกว่าผลจะหมดเวลา (สวมเกราะราชันคงอยู่ถาวร = กดซ้ำไม่ได้อีกเลยตลอดเกม)
  if (tier === "ultimate" && st && (p.statuses[st] || 0) > 0) return;
  // เวลาทอง (แกมเบลอร์): ระหว่างบัฟยังอยู่ กดท่าไม้ตายซ้ำไม่ได้
  if (tier === "ultimate" && isGambler && goldenOn) return;
  // MonsterLive (ฮิคารุ): ระหว่างร่างไคจู ใช้ท่าไม้ตายไม่ได้
  if (tier === "ultimate" && p.characterId === "hikaru" && (p.statuses.monster || 0) > 0) return;
  // Rainbow Pudding (คุวากาตะ): ใช้ได้แค่ 2 ครั้งต่อเกม
  const isPudding = p.characterId === "kuwagata" && tier === "basic";
  if (isPudding && (p.puddingUses || 0) <= 0) return;
  // วอสก้าหน่อยน้อง (แกมเบลอร์): ใช้ได้ 3 ครั้งต่อเกม (เวลาทองรีเซ็ตให้เต็ม)
  if (isGamble && (p.gamblerUses || 0) <= 0) return;
  // หอกแห่งแคสเซียส (เอวา 13): ต้องมีเกราะเหลือให้หัก
  const isCassius = p.characterId === "eva13" && tier === "basic";
  if (isCassius && p.armor < 1) return;
  // Fourth Impact (เอวา 13): ใช้ได้เมื่อสกิลติดตัว 3 (เลือด <= 3) ทำงานอยู่เท่านั้น
  if (st === "fourth" && !eva3Active(p)) return;
  // ม่านแห่งราตรี (โอเบรอน): กดซ้ำไม่ได้จนกว่าผลเพิ่มพลังโจมตีจะหมด
  const isVeil = p.characterId === "oberon" && tier === "basic";
  if (isVeil && (p.statuses.veil || 0) > 0) return;
  // รุ่งอรุณแห่งวันใหม่ (โอเบรอน): เลือกเป้าหมาย 1 คน (ตัวเองได้) + หลังใช้รออีก 3 เทิร์น
  const isSunrise = p.characterId === "oberon" && tier === "secondary";
  let sunriseTarget = null;
  if (isSunrise) {
    if ((p.sunriseCd || 0) > 0) return;
    const tgs = Array.isArray(targets) ? [...new Set(targets)] : [];
    const t = tgs.length === 1 ? players[tgs[0]] : null;
    if (!t || !t.alive) return;
    sunriseTarget = t;
  }

  if (st === "beam" && (p.beamAmmo || 0) <= 0) return; // Beam Magnum กระสุนหมด ใช้ไม่ได้
  // Ohger Finish: ต้องมีทั้งสวมเกราะราชัน และ ประกายเขี้ยวปฏิปักษ์ ถึงจะใช้ได้ (+1 ความเสียหาย)
  if (st === "ohger" && !((p.statuses.rachan || 0) > 0 && (beatActive(p) || (p.seen && p.seen.beat)))) return;

  // ANATA WAAAAAAAA (เทมาริ): ต้องเลือกเป้าหมาย 1 คนก่อนใช้
  let anataTargets = null;
  if (st === "anata") {
    const avail = alivePlayers().filter((o) => o.id !== p.id);
    const need = Math.min(1, avail.length);
    if (need === 0) return;
    const tgs = Array.isArray(targets)
      ? [...new Set(targets)].filter((tid) => avail.some((o) => o.id === tid))
      : [];
    if (tgs.length !== need) return;
    anataTargets = tgs;
  }

  p.skillPoints -= cost;
  p.skillUsedRound = true;
  if (isPudding) p.puddingUses--; // นับใช้ Rainbow Pudding

  // ---------- Gambler the gambling: สกิลเสี่ยงโชค (จัดการใน engine โดยตรง) ----------
  let flashSuffix = ""; // ต่อท้ายชื่อสกิลบนป้ายเด้ง เพื่อบอกผลเสี่ยงโชคให้ทุกคนเห็น
  if (isGambler) {
    const jackpot = gamblerJackpot(p); // เช็คก่อนผลสกิลเปลี่ยนเลือด
    const win = Math.random() < gamblerChance(p, tier);
    if (tier === "basic") {
      // วอสก้าหน่อยน้อง: 50/50 ลดเลือดตัวเอง 1 หรือ ฟื้น 2 (แจ๊กพอต +1) — ฮีลล้นไปเกราะ/เลือดชั่วคราว
      p.gamblerUses--;
      if (win) {
        const heal = 2 + (jackpot ? 1 : 0);
        const got = healOverflow(p, heal);
        const parts = [];
        if (got.toHp > 0) parts.push(`เลือด +${got.toHp}`);
        if (got.toArmor > 0) parts.push(`เกราะ +${got.toArmor}`);
        if (got.toTemp > 0) parts.push(`เลือดชั่วคราว +${got.toTemp}`);
        flashSuffix = ` — ดวงมา! ฟื้น +${heal}`;
        lastLog.push(`🎰 ${p.name} วอสก้าหน่อยน้อง — ดวงมา! ฟื้น +${heal} (${parts.join(", ") || "เต็มหมดแล้ว"})`);
      } else {
        loseHp(p);
        flashSuffix = " — ดวงกุด เสียเลือด -1";
        lastLog.push(`🎰 ${p.name} วอสก้าหน่อยน้อง — ดวงกุด เสียพลังชีวิต -1`);
        // ผลสกิลตัวเองทำให้เลือดหมด -> ตายทันที ไม่ต้องรอจบเทิร์น
        if (p.hp <= 0) {
          p.hp = 0; p.alive = false; p.result = "dead"; p.locked = true;
          lastLog.push(`💀 ${p.name} เสี่ยงดวงจนสิ้นลม — ตกรอบทันที!`);
        }
      }
    } else if (tier === "secondary") {
      // กำไรเท่าตัวโว้ย: 50/50 ห้ามจั่วเทิร์นนี้+เทิร์นหน้า หรือ +1 โจมตี (แจ๊กพอต +2) และทะลุเกราะ 1 ครั้ง (ถาวรจนได้ตี)
      if (win) {
        const gain = 1 + (jackpot ? 1 : 0);
        p.profit = (p.profit || 0) + gain;
        flashSuffix = ` — กำไรงาม! โจมตี +${gain} ทะลุเกราะ`;
        lastLog.push(`💰 ${p.name} กำไรเท่าตัวโว้ย — กำไรงาม! พลังโจมตี +${gain} และโจมตีครั้งถัดไปไม่สนเกราะ (คงอยู่จนกว่าจะได้ตี รวม +${p.profit})`);
      } else {
        p.statuses.nodraw = Math.max(p.statuses.nodraw || 0, 1);
        p.noDrawNext = Math.max(p.noDrawNext || 0, 1);
        flashSuffix = " — ขาดทุนยับ! ห้ามจั่ว 2 เทิร์น";
        lastLog.push(`💸 ${p.name} กำไรเท่าตัวโว้ย — ขาดทุนยับ! จั่วการ์ดเพิ่มไม่ได้ทั้งเทิร์นนี้และเทิร์นหน้า`);
      }
    } else {
      // เวลาทองของพี่มาแล้ว 777: 50/50 (สกิลติดตัวเพิ่มโอกาสได้) — พลาด = แต้มสกิลหายฟรี
      if (win) {
        p.statuses.golden = 5;
        p.skillPoints = Math.min(MAX_SKILL, p.skillPoints + 3); // สำเร็จ: คืนแต้ม 3 (กินจริงแค่ 3)
        p.skillUsedRound = false; // เทิร์นที่สำเร็จ ยังใช้สกิลต่อได้ (ไม่ติดกฎ 1 สกิลต่อเทิร์น)
        p.gamblerUses = GAMBLER_USES; // รีเซ็ตจำนวนใช้สกิลพื้นฐานกลับมาเต็ม
        p.seen.golden = true;
        p.transformAt = ++transformCounter;
        lastLog.push(`🎉 ${p.name} เวลาทองของพี่มาแล้ว 777 — แจ๊กพอต! บัฟเวลาทอง 5 เทิร์น (คืนแต้มสกิล 3 แต้ม)`);
        if (!p.cutsceneShown.golden) {
          p.cutsceneShown.golden = true;
          queueCutscene(p, "golden");
          pausePlayingForCutscene(); // เล่นวีดีโอทันทีก่อนเปิดไพ่ (แบบ MonsterLive)
        } else {
          notifyTransform(p, "golden");
        }
      } else {
        p.skillPoints = 0;
        flashSuffix = " — แห้ว! แต้มสกิลหายฟรี";
        lastLog.push(`💥 ${p.name} เวลาทองของพี่มาแล้ว 777 — แห้ว! เสียแต้มสกิลทั้งหมดฟรี`);
      }
    }
  }
  // ---------- เอวา 13: หอกแห่งแคสเซียส — หักเกราะตัวเอง 1 ฟื้นเลือด 1 ----------
  if (isCassius) {
    p.armor--;
    p.hp = Math.min(MAX_HP, p.hp + 1);
    lastLog.push(`🗡️ ${p.name} หอกแห่งแคสเซียส — หักเกราะ 1 ฟื้นพลังชีวิต +1`);
  }
  // ---------- โอเบรอน: ม่านแห่งราตรี — บัฟหมู่ก่อนเปิดการ์ด ----------
  if (isVeil) {
    for (const o of alivePlayers()) {
      o.statuses.veil = Math.max(o.statuses.veil || 0, 2); // พลังโจมตี +1 คงอยู่ 2 เทิร์น (รวมตัวเอง)
      o.hp = Math.min(MAX_HP, o.hp + 1);                   // ฟื้นพลังชีวิตทุกคน +1 (รวมตัวเอง)
      o.armor = Math.min(maxArmorOf(o), o.armor + 1);      // ฟื้นเกราะทุกคน +1 (รวมตัวเอง)
      // ยามฟ้าสาง ถาวร (สะสมสูงสุด 3) — คนที่กำลังหลับไหลจะไม่รับเพิ่ม (ผลก่อนหน้ายังไม่หมด)
      if (o.id !== p.id && !((o.statuses.sleep || 0) > 0)) o.statuses.dawn = Math.min(3, (o.statuses.dawn || 0) + 1);
    }
    lastLog.push(`🌙 ${p.name} ม่านแห่งราตรี — ทุกคนพลังโจมตี +1 (2 เทิร์น) ฟื้นเลือด/เกราะ +1 และติดยามฟ้าสาง (ยกเว้นผู้ใช้/คนหลับ)`);
  }
  // ---------- โอเบรอน: รุ่งอรุณแห่งวันใหม่ — ฮีล 5 แลกกับลดเลือด 1 ในเทิร์นถัดมา (ไม่สนเกราะ) ----------
  if (isSunrise && sunriseTarget) {
    const t = sunriseTarget;
    t.hp = Math.min(MAX_HP, t.hp + 5);
    t.sunriseDrop = 1; // เทิร์นถัดมาลดลง 1 หน่วยอัตโนมัติ แบบไม่สนเกราะ
    // ยามฟ้าสาง +2 — ไม่ติดถ้าใช้กับตัวเอง หรือเป้าหมายกำลังหลับไหล (ผลก่อนหน้ายังไม่หมด)
    if (t.id !== p.id && !((t.statuses.sleep || 0) > 0)) t.statuses.dawn = Math.min(3, (t.statuses.dawn || 0) + 2);
    p.sunriseCd = SUNRISE_CD;
    flashSuffix = ` — ใส่ ${t.name}`;
    lastLog.push(`🌄 ${p.name} รุ่งอรุณแห่งวันใหม่ — ฟื้นพลังชีวิต ${t.name} +5 (เทิร์นถัดมาลดลง 1 ไม่สนเกราะ)${t.id !== p.id && !(t.statuses.sleep > 0) ? " และติดยามฟ้าสาง +2" : ""}`);
  }

  // จอมเวทย์ฝึกหัด (ฟุจิมารุ): สแตคดาเมจแพ้จั่ว/แตก +1 ต่อครั้ง (1 เทิร์น) + ฟื้นเลือดเทิร์นถัดไปตามจำนวนครั้ง
  if (isMage) {
    p.mageUses = (p.mageUses || 0) + 1;
    p.mageHealNext = (p.mageHealNext || 0) + 1;
    p.statuses.mage = (p.statuses.mage || 0) + 1; // เก็บเป็นจำนวนสแตค (ล้างหมดตอนจบเทิร์น)
    lastLog.push(`🪄 ${p.name} จอมเวทย์ฝึกหัด x${p.statuses.mage} — ความเสียหายจากการแพ้/แตกเทิร์นนี้ +${p.statuses.mage}`);
  }
  // Mystic Code (ฟุจิมารุ): หักเกราะตัวเอง 1 -> ต่ออายุ Everything For Humanity +1 เทิร์น
  if (isMystic) {
    p.armor--;
    p.statuses.humanity = (p.statuses.humanity || 0) + 1;
    lastLog.push(`🔧 ${p.name} Mystic Code — หักเกราะ 1 ต่ออายุ Everything For Humanity (เหลือ ${p.statuses.humanity} เทิร์น)`);
  }
  // Everything For Humanity: ใช้เรจูอาคมบัญชาทั้ง 3 หมดทันทีตอนกด
  if (st === "humanity") p.reiju = 0;

  // ทงคัสสึ 3 มื้อ (เทมาริ): นับชามสะสม — เกิน 2 ชาม = เทิร์นถัดไปจั่วเพิ่มไม่ได้,
  // เกิน 6 ชาม = ครั้งถัดไปอิ่มเกิน ได้เกราะ 1 หน่วยแทนการฟื้นเลือด
  const isTonkatsu = p.characterId === "temari" && tier === "basic";
  if (isTonkatsu) {
    p.tonkatsu = (p.tonkatsu || 0) + 1;
    if (p.tonkatsu > 2) p.noDrawNext = Math.max(p.noDrawNext || 0, 1);
    if (p.tonkatsu > 6) {
      p.armor = Math.min(maxArmorOf(p), p.armor + 1);
      lastLog.push(`🍜 ${p.name} อิ่มเกินไป! ได้เกราะ +1 แทน (ชามที่ ${p.tonkatsu})`);
    } else {
      applyEffect(p, skill.effect);
    }
  } else {
    applyEffect(p, skill.effect);
  }

  // NewType Paradise: เติมกระสุน Beam Magnum +1
  if (st === "paradise") p.beamAmmo = Math.min(BEAM_AMMO, (p.beamAmmo || 0) + 1);

  // Song for you (เทมาริ): ครั้งแรกเติมเกราะให้ตามโบนัสชาม — ครั้งที่ 2 เป็นต้นไปเพิ่มแค่เพดาน
  if (st === "song" && !p.songUsedOnce) {
    p.songUsedOnce = true;
    p.armor = Math.min(maxArmorOf(p), p.armor + songBonus(p));
  }

  // ANATA WAAAAAAAA: เก็บเป้าหมายไว้เป็นความลับ + เปิดเพลงจนกว่าทุกคนจะเปิดไพ่
  if (st === "anata") {
    p.anataTargets = anataTargets;
    anataMusicSeq = ++transformCounter;
  }

  // MonsterLive (ฮิคารุ): แปลงร่างไคจู Black King ทันทีก่อนเปิดไพ่ — พักช่วงจั่วการ์ดเล่นฉากแปลงร่าง
  if (st === "monster") {
    p.seen.monster = true;
    if (!p.cutsceneShown.monster) {
      p.cutsceneShown.monster = true;
      queueCutscene(p, "monster");
      pausePlayingForCutscene();
    } else {
      notifyTransform(p, "monster");
    }
    lastLog.push(`🦖 ${p.name} แปลงร่างไคจู Black King (MonsterLive)!`);
  }

  // สกิลช่วงจั่วการ์ด (instant): เด้งโชว์ทันทีบนกระดานของทุกคน ไม่ต้องรอเปิดไพ่/ไม่ตัดจอดำ
  if (skill.instant) {
    io.emit("skillFlash", { name: skill.name + flashSuffix, img: skill.img || null, by: p.name, color: POSITION_COLORS[p.position] || "#9B4F96" });
  }
  // จำสกิลที่ใช้ในรอบ (ท่าไม้ตายมี cutscene ของตัวเอง / สกิลหลังเปิดไพ่ไปโชว์ตอนโจมตี)
  roundSkills.push({ playerId: id, name: skill.name, img: skill.img || null, status: st });

  p.busted = bustedOf(p);
  if (p.busted) { p.locked = true; voidUltimateOnBust(p); }
  // ถึงเพดานพอดี (เช่น 21): ไม่ล็อกอัตโนมัติ — รอผู้ใช้เปิดไพ่เอง

  broadcastState();
  checkAllLocked();
}
// ---- เรจูอาคมบัญชา (สกิลติดตัวฟุจิมารุ) ----
//  สั่งใช้ก่อนเปิดการ์ด ไม่นับเป็นการใช้สกิล (ใช้พร้อมสกิลอื่นได้) — 3 ครั้งต่อเกม
//  คำสั่ง: 1 อมตะ 1 เทิร์น | 2 สุ่มฟื้นเลือด/เกราะเต็ม (50/50) | 3 เติมแต้มสกิลเต็ม
function useReiju(id, command) {
  const p = players[id];
  if (gameState !== "PLAYING" || !p || !p.alive || p.locked) return;
  if (p.characterId !== "fujimaru") return;
  const cmd = Number(command);
  if (![1, 2, 3].includes(cmd)) return;
  if ((p.reiju || 0) <= 0) return;
  p.reiju--;

  let what = "";
  if (cmd === 1) {
    p.statuses.seal = 1;
    what = "อมตะ 1 เทิร์น";
    lastLog.push(`📜 ${p.name} เรจูอาคมบัญชา — เทิร์นนี้เป็นอมตะ ไม่ถูกเลือกโจมตี ไม่รับความเสียหายใดๆ (เหลือ ${p.reiju})`);
  } else if (cmd === 2) {
    if (Math.random() < 0.5) {
      p.hp = MAX_HP;
      what = "ฟื้นพลังชีวิตเต็ม";
    } else {
      p.armor = maxArmorOf(p);
      what = "ฟื้นเกราะเต็ม";
    }
    lastLog.push(`📜 ${p.name} เรจูอาคมบัญชา — สุ่มได้ ${what}! (เหลือ ${p.reiju})`);
  } else {
    addSkill(p, MAX_SKILL); // เติมให้เต็ม 6 แต้ม (addSkill ตัดเพดานให้เอง)
    what = "เติมแต้มสกิลเต็ม";
    lastLog.push(`📜 ${p.name} เรจูอาคมบัญชา — เติมแต้มสกิลเต็ม ${MAX_SKILL} แต้ม (เหลือ ${p.reiju})`);
  }
  // เด้งโชว์ทันทีบนกระดานทุกคน (แบบเดียวกับสกิล instant) — รูปตามจำนวนเส้นที่เหลือ
  io.emit("skillFlash", {
    name: `ขอสาบานด้วยอาคมบัญชานี้ — ${what}`,
    img: `/characters/fujimaru/reiju${Math.max(0, Math.min(3, p.reiju))}.jpg`,
    by: p.name, color: POSITION_COLORS[p.position] || "#9B4F96",
  });
  broadcastState();
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
  anataMusicSeq = 0; // เพลง ANATA WAAAAAAAA จบลงเมื่อทุกคนพร้อมเปิดไพ่แล้ว

  // ANATA WAAAAAAAA (เทมาริ): เปิดเผยเป้าหมาย + บังคับจั่วเพิ่ม 2 ใบหลังเปิดไพ่
  // ทำงานก่อนท่าไม้ตายอื่นเสมอ — ถ้าเป้าหมายแตกจากการบังคับจั่ว ท่าไม้ตายที่เพิ่งกดจะเป็นโมฆะ
  const anataProcs = [];
  for (const u of alivePlayers()) {
    if (!u.anataTargets || !u.anataTargets.length) continue;
    if (bustedOf(u)) { u.anataTargets = null; continue; } // ผู้ใช้แตกเอง (โมฆะไปแล้วใน voidUltimateOnBust)
    for (const tid of u.anataTargets) {
      const t = players[tid];
      if (!t || !t.alive) continue;
      t.cards.push(drawCardFor(t));
      t.cards.push(drawCardFor(t));
      t.busted = bustedOf(t);
      lastLog.push(`🎤 ANATA WAAAAAAAA! ${u.name} บังคับ ${t.name} จั่วเพิ่ม 2 ใบ${t.busted ? " — ไพ่แตก!" : ""}`);
      if (t.busted) voidUltimateOnBust(t);
      anataProcs.push({ u, t });
    }
    u.anataTargets = null;
  }

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
    roundTiedWin = tied.length > 1; // เสมอแต้มกัน -> ยังได้แต้มสกิล/ท่าไม้ตายทำงานปกติ แต่ไม่มีเทิร์นโจมตี
    w.isWinner = true;
    w.result = "win";
    addSkill(w, 1); // ชนะเป็นคนแรก (ใกล้ 21 สุด / เท่ากับ 21) +1
    firePassive(w, "win");
    if (tied.length > 1) lastLog.push(`เสมอที่ ${best} แต้ม — สุ่มผู้ชนะได้ ${w.name} (เสมอ ไม่มีเทิร์นโจมตี)`);
  }

  if (best !== worst) {
    // จอมเวทย์ฝึกหัด (ฟุจิมารุ): ความเสียหายจากการแพ้จั่ว/แตกรุนแรงขึ้น +1 ต่อสแตค (รวมทุกคนที่เปิดไว้)
    const mageExtra = combatants.reduce((n, q) => n + (q.statuses.mage || 0), 0);
    // การหลับไหลอันไม่สิ้นสุด (สกิลติดตัวโอเบรอน): ผู้แพ้ที่ติดทั้ง "การตื่นขึ้น" และ "ยามฟ้าสาง" เจ็บขึ้น +1
    const oberonHere = combatants.some((q) => q.characterId === "oberon");
    for (const l of combatants.filter((p) => val(p) === worst && p.id !== roundWinnerId)) {
      l.isLoser = true;
      l.result = "lose";
      if (sealActive(l)) {
        // เรจูอาคมบัญชา (อมตะ): ไม่รับความเสียหายใดๆ เทิร์นนี้
        addSkill(l, 1);
        firePassive(l, "lose");
        lastLog.push(`📜 ${l.name} อาคมบัญชาคุ้มครอง — ไม่รับความเสียหายจากการแพ้`);
        continue;
      }
      if ((l.statuses.humanity || 0) > 0) {
        // Everything For Humanity: ความเสียหายจากการแพ้จั่ว/แตก ทำอะไรไม่ได้
        addSkill(l, 1);
        firePassive(l, "lose");
        lastLog.push(`✨ ${l.name} Everything For Humanity — ความเสียหายจากการแพ้ทำอะไรไม่ได้`);
        continue;
      }
      if (l.beatSaved) {
        // หลังกันตายทำงานแล้ว: ความเสียหายจากการแพ้ตอนจั่วการ์ดไม่มีผล ไม่ว่าห่าง 21 แค่ไหน
        addSkill(l, 1);
        firePassive(l, "lose");
        lastLog.push(`⚡ ${l.name} ประกายเขี้ยวปฏิปักษ์ — ไม่รับความเสียหายจากการแพ้`);
        continue;
      }
      if ((l.statuses.monster || 0) > 0) {
        // ร่างไคจู (MonsterLive): แพ้เพราะแต้มน้อยสุด/ไพ่แตก รับความเสียหายน้อยลง 1 หน่วย (1 -> 0)
        addSkill(l, 1);
        firePassive(l, "lose");
        lastLog.push(`🦖 ${l.name} ร่างไคจู — ไม่รับความเสียหายจากการแพ้`);
        continue;
      }
      if (evaLossImmune(l)) {
        // สกิลติดตัว 2 เอวา 13 (ทุกอย่างไร้ความหมาย): ไม่รับดาเมจแพ้จั่ว/แตก
        //  — นอก fourth impact ทำงานเสมอ ยกเว้นสกิลติดตัว 3 (เลือด <= 3) ทำงานอยู่ | fourth impact = บังคับทำงาน
        addSkill(l, 1);
        firePassive(l, "lose");
        lastLog.push(`🌑 ${l.name} ทุกอย่างไร้ความหมาย — ไม่รับความเสียหายจากการแพ้`);
        continue;
      }
      const armorBefore = l.armor;
      // การหลับไหลอันไม่สิ้นสุด: ติดทั้งการตื่นขึ้น + ยามฟ้าสาง -> ดาเมจแตก/แพ้ +1
      // และล้าง "การตื่นขึ้น" ออก 1 หน่วยทุกครั้งที่เกิดผล
      const dawnExtra = (oberonHere && (l.statuses.awaken || 0) > 0 && (l.statuses.dawn || 0) > 0) ? 1 : 0;
      if (dawnExtra > 0) {
        l.statuses.awaken--;
        if (l.statuses.awaken <= 0) delete l.statuses.awaken;
      }
      const lossDmg = 1 + mageExtra + dawnExtra; // จอมเวทย์ฝึกหัด: แพ้จั่ว/แตกเจ็บขึ้นตามสแตค
      for (let i = 0; i < lossDmg; i++) damageSoft(l);
      // Absorb shield: ถ้าเป็นผู้แพ้แล้วเสียเกราะ ให้แปลงเกราะที่เสียกลับเป็นพลังชีวิต
      const armorLost = armorBefore - l.armor;
      if ((l.statuses.absorb || 0) > 0 && armorLost > 0) {
        const heal = Math.min(MAX_HP - l.hp, armorLost);
        if (heal > 0) { l.hp += heal; lastLog.push(`🛡️ ${l.name} Absorb shield แปลงเกราะที่เสีย ${armorLost} → พลังชีวิต +${heal}`); }
      }
      // Beat Mode กันตาย: ทำงานทันทีแม้ความเสียหายถึงตายมาจากการแพ้จั่ว/แตก
      maybeBeatSave(l);
      addSkill(l, 1); // โดนความเสียหายเพราะแต้มห่างจาก 21 มากที่สุด +1
      firePassive(l, "lose");
      lastLog.push(`${l.name} แต้มน้อยสุด รับความเสียหาย -${lossDmg}${mageExtra > 0 ? ` (จอมเวทย์ฝึกหัด +${mageExtra})` : ""}${dawnExtra > 0 ? " (การหลับไหลอันไม่สิ้นสุด +1)" : ""}`);
    }
  }
  for (const p of combatants) if (!p.result) p.result = "safe";

  // สกิลติดตัว หิวอะโปรดิวเซอร์ (เทมาริ): เป้าหมาย ANATA WAAAAAAAA แพ้หรือไพ่แตก
  // -> โดนขิงจนช้ำ รับความเสียหายทันที (คิดแบบการโจมตีปกติ + โบนัส Song for you)
  // ต่อให้เทมาริไม่ชนะ/แพ้ในตานั้นก็ตาม — และฉากของสกิลนี้ขึ้นก่อนทุกท่าไม้ตาย
  let anataFinalShown = false;
  for (const { u, t } of anataProcs) {
    if (!t.alive || !(bustedOf(t) || t.isLoser)) continue;
    let dmg = 1 + (songActive(u) ? songBonus(u) : 0);
    if ((t.statuses.monster || 0) > 0) dmg = Math.max(0, dmg - 1); // ร่างไคจูรับเบาลง 1
    dealMixed(t, dmg);
    maybeBeatSave(t); // กันตายทำงานทันทีถ้าโดนขิงจนถึงตาย
    t.wasAttacked = true;
    addSkill(t, 1);
    lastLog.push(`🎤 หิวอะโปรดิวเซอร์! ${t.name} โดนขิงจนช้ำ -${dmg}`);
    if (!anataFinalShown) {
      anataFinalShown = true;
      triggerCutscene(u, "anataFinal"); // เข้าคิวก่อน afterResolve -> ขึ้นก่อนท่าไม้ตายอื่นเสมอ
    }
  }

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
        // สวมเกราะราชัน: เพิ่มแค่เพดานเกราะ +3 (ไม่ฟื้นเกราะให้ — เกราะที่มีคงเดิม รอฟื้นฟูเองต้นรอบ)
        // Everything For Humanity (ฟุจิมารุ): หักเลือดเหลือ 1 + ความจุเกราะ +3 พร้อมฟื้นเกราะ +3
        //  ร่างสุดท้ายคงอยู่จนตาย — เมื่อผลจบลงแล้วเกมยังไม่จบ ตัวละครตายทันที (เช็คใน endTurn)
        if (key === "humanity") {
          p.humanityActivated = true;
          p.hp = 1;
          p.armor = Math.min(maxArmorOf(p), p.armor + 3);
        }
        // Lai Rhyme Goodfellow (โอเบรอน กลางวัน): โจมตีทุกคนไม่สนเกราะ 2 หน่วย + มอบ "การตื่นขึ้น" (ฟื้น 1/เทิร์น 2 เทิร์น)
        if (key === "lai") {
          for (const o of alivePlayers()) {
            if (o.id === p.id) continue;
            dealDirect(o, 2);
            maybeBeatSave(o);
            o.statuses.awaken = Math.max(o.statuses.awaken || 0, 3); // +1 ชดเชยการลดสถานะตอนจบเทิร์น
            o.wasAttacked = true;
          }
          lastLog.push(`🌞 Lai Rhyme Goodfellow! ${p.name} โจมตีทุกคน -2 (ไม่สนเกราะ) และมอบสถานะ "การตื่นขึ้น"`);
        }
        // Lie Like Vortigern (โอเบรอน กลางคืน): เกราะหมู่ +2 (ยกเว้นตัวเอง) แล้วกล่อมคนติดยามฟ้าสางให้หลับไหล
        if (key === "vortigern") {
          for (const o of alivePlayers()) {
            if (o.id === p.id) continue;
            o.statuses.vortarmor = 4; // เพดานเกราะ +2 คงอยู่ 3 เทิร์น (+1 ชดเชยการลดสถานะตอนจบเทิร์น)
            o.armor = Math.min(maxArmorOf(o), o.armor + 2);
            const dawn = o.statuses.dawn || 0;
            if (dawn > 0) {
              o.statuses.sleep = dawn + 1; // หลับตามจำนวนยามฟ้าสาง (+1 ชดเชยการลดสถานะตอนจบเทิร์น)
              lastLog.push(`💤 ${o.name} ต้องคำลวงของราชาภูติ — หลับไหล ${dawn} เทิร์น!`);
            }
          }
          for (const o of Object.values(players)) delete o.statuses.dawn; // ล้างยามฟ้าสางให้ทุกคน
          // ราตรีกลืนกิน: ฉากหลังกลางคืนกลายเป็นวีดีโอ + เพลงประจำตัวโอเบรอน จนกว่าจะหมดกลางคืน
          oberonDevour = ++transformCounter;
          // สนามของโอเบรอน: รีเซ็ตเวลากลางคืนให้เหลืออีก 3 เทิร์นนับจากเทิร์นถัดไป
          nightResetPending = true;
          lastLog.push(`🌑 Lie Like Vortigern! ${p.name} มอบเกราะ +2 ให้ทุกคน (3 เทิร์น) — ราตรีกลืนกิน และรีเซ็ตกลางคืนเหลืออีก 3 เทิร์น`);
        }
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
  // สกิลติดตัว 3 เอวา 13: เลือดตกถึง <= 3 -> อย่าให้ฉันทำแแบบนี้เลย
  for (const p of alivePlayers()) maybeEva3(p);
  runCutsceneQueue(goSummary);
}

function goSummary() {
  gameState = "SUMMARY";
  startPhaseTimer(SUMMARY_TIME, afterSummary);
  broadcastState();
}

// ---- โจมตี ----
// เรจูอาคมบัญชา (อมตะ): ไม่ถูกเลือกเป็นเป้าโจมตีตลอดเทิร์น
function attackableTargets(atkId) {
  return alivePlayers().filter((p) => p.id !== atkId && !sealActive(p));
}
function afterSummary() {
  const winner = players[roundWinnerId];
  // หลับไหล (Lie Like Vortigern): ผู้ชนะที่ยังหลับอยู่ ออกการกระทำไม่ได้ -> ไม่มีเทิร์นโจมตี
  if (winner && winner.alive && (winner.statuses.sleep || 0) > 0) {
    lastLog.push(`💤 ${winner.name} ยังหลับไหลอยู่ — ไม่มีเทิร์นโจมตี`);
    endTurn();
    return;
  }
  if (winner && winner.alive && !roundTiedWin) {
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
  if (sealActive(target)) return; // เรจูอาคมบัญชา (อมตะ): เลือกโจมตีไม่ได้
  clearPhaseTimer();

  const ginga = (attacker.statuses.ginga || 0) > 0;
  const beam = (attacker.statuses.beam || 0) > 0;
  const paradiseAtk = (attacker.statuses.paradise || 0) > 0;
  // Ohger Finish: ต้องมีทั้งสวมเกราะราชัน + ประกายเขี้ยวปฏิปักษ์ (เช็คตอนกดสกิล) = +1
  const ohger = (attacker.statuses.ohger || 0) > 0;
  const ohgerBonus = ohger ? 1 : 0;
  // Everything For Humanity (ฟุจิมารุ): พลังโจมตี +4
  const humanityAtk = (attacker.statuses.humanity || 0) > 0;
  // หอกลองกินัส (เอวา 13): พลังโจมตี +1 (1 เทิร์น) + เป้าหมายจั่วไม่ได้เทิร์นถัดมา
  const spearAtk = (attacker.statuses.spear || 0) > 0;
  // กำไรเท่าตัวโว้ย (แกมเบลอร์): +โจมตีสะสม และทะลุเกราะ 1 ครั้ง — หมดไปเมื่อได้ตี
  const profitAtk = attacker.characterId === "gambler" ? (attacker.profit || 0) : 0;
  // NT-D System: สวนกลับคนที่ตีเราล่าสุด +1 — NewType Paradise = NT-D แบบพิเศษ ใช้ +1 กับเป้าหมายใดก็ได้
  const isRevenge = attacker.characterId === "banagher" && attacker.ntdTarget && attacker.ntdTarget === target.id;
  const ntdBonus = (isRevenge || paradiseAtk) ? 1 : 0;
  // Ginga no Uta: ถ้าเหลือฝ่ายตรงข้ามเพียงคนเดียว พลังโจมตี +1
  const lastStanding = ginga && alivePlayers().filter((p) => p.id !== attacker.id).length === 1;
  // ม่านแห่งราตรี (โอเบรอน): พลังโจมตี +1 ทุกคนที่ติดบัฟ (2 เทิร์น)
  const veilAtk = (attacker.statuses.veil || 0) > 0;
  // การหลับไหลอันไม่สิ้นสุด (สกิลติดตัวโอเบรอน): พลังโจมตีพื้นฐานเป็น 0 — ชนะจั่วก็ตีไม่เข้า เว้นแต่มีบัฟม่านแห่งราตรี
  const oberonZero = attacker.characterId === "oberon" ? -1 : 0;

  let base = 1 + oberonZero + (veilAtk ? 1 : 0) + (ginga ? 1 : 0) + (beam ? 2 : 0) + (lastStanding ? 1 : 0) + ohgerBonus + (humanityAtk ? 4 : 0) + (spearAtk ? 1 : 0) + profitAtk; // Beam Magnum +2
  let dmg = base + ntdBonus;
  if ((target.statuses.monster || 0) > 0) dmg = Math.max(0, dmg - 1);

  // Beam Magnum: หักกระสุน 1 นัดเมื่อได้โจมตีจริงเท่านั้น (ไม่นับถ้าเลือกแล้วไม่ได้ตี/แตกในเทิร์น)
  if (beam && (attacker.beamAmmo || 0) > 0) attacker.beamAmmo--;

  const attackerBeat = beatActive(attacker); // Beat Mode: การโจมตีเป็นความเสียหายจริง ไม่สนเกราะ
  const hpBefore = target.hp;
  const armorBefore = target.armor;
  const shieldBefore = target.shield;
  if (attackerBeat || profitAtk > 0) dealDirect(target, dmg); // ประกายเขี้ยวปฏิปักษ์ / กำไรเท่าตัวโว้ย: ทะลุเกราะเข้าเลือดจริง
  else dealMixed(target, dmg);               // กฎปกติ: ลดเกราะก่อน ถ้าไม่มีเกราะจึงเข้าเลือดจริง
  if (profitAtk > 0) {
    attacker.profit = 0; // บัฟกำไรหมดไปเมื่อได้ตี
    lastLog.push(`💰 ${attacker.name} กำไรเท่าตัวโว้ย — โจมตี +${profitAtk} ทะลุเกราะ! (บัฟหมดลง)`);
  }
  // หอกลองกินัส: โจมตีโดนเป้าหมาย -> มีโอกาส 20/80 ที่เทิร์นถัดมาเป้าหมายจะใช้สกิลไม่ได้
  //  (สกิลติดตัว 3 เอวาทำงาน = โอกาสเพิ่มเป็น 50/50)
  if (spearAtk && target.alive) {
    const chance = eva3Active(attacker) ? 0.5 : 0.2;
    if (Math.random() < chance) {
      target.noSkillNext = Math.max(target.noSkillNext || 0, 1);
      lastLog.push(`🗡️ หอกลองกินัสปักเป้า! ${target.name} ใช้สกิลไม่ได้ในเทิร์นถัดไป`);
    } else {
      lastLog.push(`🗡️ หอกลองกินัสพลาด — ${target.name} ยังใช้สกิลได้ตามปกติ`);
    }
  }
  // Beat Mode กันตาย (ครั้งเดียวต่อเกม): ทำงานทันทีเมื่อความเสียหายถึงตาย — ไม่ต้องอยู่ใน Beat Mode ก่อน
  //  หลังกันตายทำงาน -> เกราะจะไม่ฟื้นคืน + ภูมิดาเมจจากการแพ้ (แต่ครั้งต่อไปจะตายปกติ)
  const beatSaveFired = maybeBeatSave(target);
  target.wasAttacked = true;
  addSkill(target, 1); // โดนเลือกโจมตีจากผู้ชนะรอบนั้น +1
  // Absorb shield: เกราะที่เสียไปจากการถูกโจมตี แปลงกลับเป็นพลังชีวิต
  const armorLost = armorBefore - target.armor;
  if ((target.statuses.absorb || 0) > 0 && armorLost > 0) {
    const heal = Math.min(MAX_HP - target.hp, armorLost);
    if (heal > 0) { target.hp += heal; lastLog.push(`🛡️ ${target.name} Absorb shield แปลงเกราะที่เสีย ${armorLost} → พลังชีวิต +${heal}`); }
  }
  // Beat Mode: ถ้าการโจมตีทำให้เลือดเหลือ < 3 -> เข้าประกายเขี้ยวปฏิปักษ์
  maybeBeatMode(target);
  // สกิลติดตัว 3 เอวา 13: ถ้าการโจมตีทำให้เลือดเหลือ <= 3
  maybeEva3(target);
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
  if (humanityAtk) addFx(skillByStatus(attacker, "humanity"), "atk");
  if (spearAtk) addFx(skillByStatus(attacker, "spear"), "atk");
  if (veilAtk) addFx({ name: "ม่านแห่งราตรี +1", img: "/characters/oberon/oberon_skill1.jpg", by: attacker.name, color: POSITION_COLORS[attacker.position] || "#888" }, "atk");
  if (attacker.characterId === "oberon" && !veilAtk) addFx({ name: "การหลับไหลอันไม่สิ้นสุด (พลังโจมตี 0)", img: displayImg(attacker), by: attacker.name, color: POSITION_COLORS[attacker.position] || "#888" }, "atk");
  if (profitAtk > 0) addFx({ name: `กำไรเท่าตัวโว้ย +${profitAtk} (ทะลุเกราะ)`, img: "/characters/gambler/gambler_skill2.jpg", by: attacker.name, color: POSITION_COLORS[attacker.position] || "#888" }, "atk");
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

  // สกิลติดตัว 1 เอวา 13 (ไม่สามารถแก้ไขอะไรได้อีกแล้ว): กำลังจะถูกกำจัดขณะ fourth impact ยังอยู่
  //  -> เช็คก่อนลดเทิร์นสถานะ (ดาเมจถึงตายเกิดตอน fourth ยังไม่หมดอายุ)
  const evaBlasts = Object.values(players).filter(
    (p) => p.alive && p.hp <= 0 && p.characterId === "eva13" && (p.statuses.fourth || 0) > 0
  );

  for (const p of Object.values(players)) {
    for (const k of Object.keys(p.statuses || {})) {
      if (k === "rachan") continue; // สวมเกราะราชัน: ผลคงอยู่ถาวร ไม่ลดเทิร์น
      if (k === "dawn") continue;   // ยามฟ้าสาง (โอเบรอน): สแตคถาวร จนกว่า Vortigern จะล้าง
      if (k === "mage") { delete p.statuses.mage; continue; } // จอมเวทย์ฝึกหัด: เก็บเป็นสแตค อยู่แค่ 1 เทิร์น
      p.statuses[k]--;
      if (p.statuses[k] <= 0) delete p.statuses[k];
    }
    // รุ่งอรุณแห่งวันใหม่ (โอเบรอน): นับถอยหลังคูลดาวน์
    if ((p.sunriseCd || 0) > 0) p.sunriseCd--;
    for (const k of Object.keys(p.seen || {})) {
      if (k === "ntd" || k === "beat" || k === "eva3") continue; // NT-D คงอยู่จนแก้แค้น / Beat Mode ถาวร / eva3 เปิดปิดตามเลือด
      if (!(p.statuses[k] > 0)) delete p.seen[k];
    }
    // เลือดชั่วคราว (แกมเบลอร์): หายเองเมื่อครบ 2 เทิร์น
    if ((p.tempHp || 0) > 0) {
      p.tempHpTurns--;
      if (p.tempHpTurns <= 0) { p.tempHp = 0; p.tempHpTurns = 0; }
    }
    p.armor = Math.min(p.armor, maxArmorOf(p)); // กันเกราะเกินเพดาน
  }

  // จบเทิร์นรอบนั้น +1 — ช่วงกลางวันได้แต้มสกิลเพิ่มอีก +1 (ระบบกลางวัน/กลางคืน)
  const dayBonus = !isNightRound(roundNumber);
  for (const p of alivePlayers()) addSkill(p, dayBonus ? 2 : 1);
  if (dayBonus) lastLog.push("☀️ จบเทิร์นช่วงกลางวัน — ทุกคนได้แต้มสกิลเพิ่ม +1");

  // Everything For Humanity (ฟุจิมารุ): ผลจบลงแล้วเกมยังไม่จบ -> จ่ายราคา ตัวละครตายลง
  for (const p of Object.values(players)) {
    if (p.alive && p.humanityActivated && !(p.statuses.humanity > 0)) {
      p.hp = 0;
      lastLog.push(`💫 ${p.name} ผลของ Everything For Humanity จบลง — ร่างกายรับไม่ไหว...`);
    }
  }

  for (const p of Object.values(players)) {
    if (p.alive && p.hp <= 0) {
      p.hp = 0; p.alive = false; p.result = "dead";
      lastLog.push(`💀 ${p.name} เลือดจริงหมด ตกรอบ!`);
    }
  }
  // ระเบิด fourth impact: เอวา 13 ตายขณะสถานะยังอยู่ -> ทุกคนในสนามรับ 5 หน่วย (เกราะก่อนแล้วเลือด)
  if (evaBlasts.length) {
    for (const e of evaBlasts) {
      lastLog.push(`💥 ${e.name} ไม่สามารถแก้ไขอะไรได้อีกแล้ว — ทุกสิ่งทุกอย่างไร้ความหมาย! ระเบิดใส่ทุกคน -${EVA_BLAST_DMG}`);
      for (const o of alivePlayers()) {
        if (o.id === e.id) continue;
        dealMixed(o, EVA_BLAST_DMG);
        maybeBeatSave(o);
        maybeBeatMode(o);
        maybeEva3(o);
        o.wasAttacked = true;
      }
      triggerCutscene(e, "evaboom");
    }
    // เช็คคนตายจากแรงระเบิดอีกรอบ
    for (const p of Object.values(players)) {
      if (p.alive && p.hp <= 0) {
        p.hp = 0; p.alive = false; p.result = "dead";
        lastLog.push(`💀 ${p.name} เลือดจริงหมด ตกรอบ!`);
      }
    }
  }
  // ถ้าเป้าแก้แค้นตาย/หายไป -> NT-D สงบ
  for (const p of Object.values(players)) {
    if (p.ntdTarget && (!players[p.ntdTarget] || !players[p.ntdTarget].alive)) {
      p.ntdTarget = null;
      delete p.seen.ntd;
    }
  }

  // เล่นฉากระเบิด (ถ้ามี) ให้จบก่อน แล้วค่อยสรุปจบเกม/ขึ้นรอบถัดไป
  runCutsceneQueue(() => {
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
  });
}

function backToLobby() {
  gameState = "LOBBY";
  clearPhaseTimer();
  timeLeft = 0;
  attackerId = null;
  roundWinnerId = null;
  roundNumber = 0;
  cycleShift = 0;
  nightResetPending = false;
  oberonDevour = 0;
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
      tonkatsu: 0, songUsedOnce: false, noDrawNext: 0, anataTargets: null,
      gamblerUses: GAMBLER_USES, profit: 0, tempHp: 0, tempHpTurns: 0, noSkillNext: 0,
      reiju: REIJU_USES, mageUses: 0, mageHealNext: 0, humanityActivated: false,
      sunriseCd: 0, sunriseDrop: 0,
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
  socket.on("useSkill", ({ tier, targets } = {}) => useSkill(socket.id, tier, targets));
  socket.on("useReiju", ({ command } = {}) => useReiju(socket.id, command));
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
