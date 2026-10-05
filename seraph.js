// ============================================================
//  SE.RA.PH Moon Cell — โหมดผจญภัย (รอบละ 7 วัน)
//  กติกา: SERAPH_MOONCELL.md · งานภาพ: SERAPH_SCENES.md
//
//  โมดูลนี้ถือ state ของ "โหมด" ทั้งหมด (วัน/เฟส/คู่ดวล/คิว) แล้วให้ server.js
//  เรียกผ่านจุดเชื่อมที่กำหนดไว้ไม่กี่จุด — ไม่ require server.js กลับ (จะ circular)
//  เข้าถึง state ของเกมผ่าน engine.* เหมือน characters/<id>.js ทุกตัว
//
//  หลักการ: วันที่ 1-6 = แข่งแต้มล้วน ไม่มีดาเมจ ไม่มีสกิล · วันที่ 7 = ดวลคัดออกตัวต่อตัว
// ============================================================

// ---------- ค่าเริ่มต้นของผู้เล่น (SERAPH_MOONCELL.md §2) ----------
const START_HP = 3;
const START_ARMOR = 2;
const START_SKILL_CAP = 4;
const MAX_SKILL_CAP = 8;
const START_GOLD = 10;
const START_SKILL_LEVEL = 1;
const MAX_SKILL_LEVEL = 6;

const MATRIX_MAX = 4;          // สะสมได้สูงสุด 4 แต้ม
const MATRIX_PER_TARGET = 3;   // ลงบนเป้าหมายเดียวได้สูงสุด 3
const INVESTIGATION_DAYS = 6;
const DAYS_PER_CYCLE = INVESTIGATION_DAYS + 1;
const PAIRING_DAY = 5;         // จบวันนี้ = ประกาศคู่ดวล (เห็นคู่ตั้งแต่ต้นวันที่ 6)
const DUEL_DAY = DAYS_PER_CYCLE;

const DUEL_START_SKILL = 4;    // แต้มสกิลตอนเริ่มดวล
const INTRO_SECONDS = 6;       // ฉากเปิดแมตช์: บินอ้อมโลกไปดวงจันทร์ (client MOON_MS 5.6 วิ) — พักเพิ่มจากช่วงเปิดตัวผู้เล่น
const CYCLE_END_GOLD = 5;      // จบรอบทุกคนได้ +5

// โบสถ์: เข้า 1 ครั้งอัปได้ 2 ครั้ง (ความจุพลังชีวิต + เกราะรวมกันไม่เกิน 10) · ห้องสมุด: อัปได้ 3 ครั้ง
const CHURCH_PICKS = 2;
const LIBRARY_PICKS = 3;
const HP_ARMOR_CAP = 10;

// ---------- แมพวันสืบสวน (ทางเดินเดินซ้าย/ขวา) ----------
//  พิกัดเป็นหน่วยของโลก (client วาดกล้องตามตัวเรา) · ประตูวางตายตัว · ของในแมพสุ่มใหม่ทุกวัน
const WORLD_W = 3100;
const DOORS = [
  { key: "room", x: 380 }, { key: "library", x: 940 }, { key: "store", x: 1500 },
  { key: "church", x: 2080 }, { key: "park", x: 2660 }
];
const DOOR_REACH = 90;         // ยืนห่างประตูได้เท่านี้ถึงเข้าได้
const PICK_REACH = 60;         // ยืนห่างของได้เท่านี้ถึงเก็บได้
const MOVE_SPEED = 220;        // หน่วย/วินาที (client เดิน 200) — กันส่งพิกัดวาร์ป
const MATRIX_PICKUPS = 5;      // ชิ้นส่วน Matrix ต่อวัน · เหรียญต่อวัน = จำนวนผู้เล่นที่ยังอยู่

// ระดับทักษะ -> tier ที่ปลดล็อก (SERAPH_MOONCELL.md §3)
const UNLOCK_AT = { basic: 1, secondary: 3, ultimate: 6 };

const PLACES = ["room", "church", "park", "library"];
const DAILY_PLACES = ["room", "church", "library"]; // วันละ 1 ที่ · สวน/ร้านค้าแวะได้ไม่จำกัด
const PLACE_NAME = {
  room: "ห้องพัก", church: "โบสถ์", park: "สวนสาธารณะ",
  library: "ห้องสมุด", store: "ร้านสะดวกซื้อ"
};

// ของฟรีจากห้องพัก — **คนละคลังกับร้านค้า** (SERAPH_MOONCELL.md §5)
// ทุกชิ้น "ราคาเกิน 3 เหรียญ" ตามสเปก จึงไม่มีของถูกปนมา
const ROOM_ITEMS = [
  { type: "skill", size: "big", name: "แคปซูลเวทเข้มข้น", amount: 3, weight: 18 },
  { type: "armor", name: "เกราะสำรอง", amount: 2, weight: 20 },
  { type: "heal", name: "ชุดปฐมพยาบาล", amount: 2, weight: 20 },
  { type: "resist", name: "ยาต้านสถานะ", turns: 2, weight: 16 },
  { type: "fortune", name: "เครื่องรางโชคลาภ", turns: 2, weight: 14 },
  { type: "guard", name: "เครื่องกำบังสนาม", amount: 1, turns: 2, weight: 12 }
];

// ============================================================
//  state ของโหมด (module-level — อยู่ตราบที่แมตช์ยังไม่จบ)
// ============================================================
let on = false;
let day = 1;
let cycleRound = 1;
let phase = "draw";      // draw | place | duel
let places = {};         // { playerId: placeKey } ของวันนี้
let placeDone = {};      // { playerId: true } ส่งผลเรียบร้อยแล้ว
let ready = {};          // ยืนยันจบวันแล้ว: ซื้อของ/เลือกสถานที่เพิ่มไม่ได้
let pairs = [];          // มีได้แค่ 1 คู่ต่อรอบ (กติกา: วันที่ 7 ดวลคู่เดียวแล้ววนกลับ)
let byeIds = [];         // ทุกคนที่เหลือ = ผ่านเข้ารอบถัดไปโดยไม่ต้องดวล
let duelIndex = 0;       // คู่ที่กำลังลงสนาม
let introActive = false; // เริ่มแมตช์: server พักเกมรอฉากเปิด (เปิดตัวผู้เล่น + บินไปดวงจันทร์)
let duelNight = false;   // หลังดวลวันที่ 7 จบ = คืนวันที่ 7 (เดินแมพ · เข้าได้แค่ห้องพัก + ร้านค้า) แล้วค่อยจบรอบ
let pickups = [];        // ของในแมพวันนี้ { id, kind: "matrix"|"coin", x }
let pickupSeq = 0;
let pendingLog = [];

function reset() {
  on = false; day = 1; cycleRound = 1; phase = "draw";
  places = {}; placeDone = {}; ready = {}; pairs = []; byeIds = []; duelIndex = 0;
  pickups = []; pickupSeq = 0; duelNight = false; introActive = false;
  onAllPlaced = null;
  pendingLog = [];
}

// ---------- getters ที่ server.js เรียกบ่อย ----------
const active = () => on;
const currentDay = () => day;
const currentCycle = () => cycleRound;
const currentPhase = () => phase;
const isDuelDay = () => on && day === DUEL_DAY && !duelNight;
/** คืนวันที่ 7: ดวลจบแล้ว เดินแมพพักก่อนจบรอบ */
const isDuelNight = () => on && duelNight;
/** วันที่ 1-6 + คืนวันที่ 7: ไม่มีจั่วไพ่ ไม่มีดาเมจ ไม่มีสกิล — เดินในแมพอย่างเดียว (SERAPH_MOONCELL.md §5) */
const noCombat = () => on && (day < DUEL_DAY || duelNight);
/** รอบเลขคู่ = กลางคืนทั้งรอบ (SERAPH_SCENES.md §6 — 1 รอบ = 1 ช่วงเวลา) */
const isNight = () => on && cycleRound % 2 === 0;

// ============================================================
//  เริ่มแมตช์
// ============================================================
function startMatch(engine) {
  reset();
  on = true;
  for (const p of Object.values(engine.players)) initPlayer(engine, p);
  pendingLog.push(`🌙 SE.RA.PH Moon Cell — รอบที่ ${cycleRound} เริ่มขึ้น · วันที่ 1 จาก ${DAYS_PER_CYCLE}`);
}

/** ค่าเริ่มต้นรายผู้เล่น — **ค่าพลังเดิมของตัวละครถูกละทิ้งทั้งหมด ทุกตัวเท่ากันหมด** */
function initPlayer(engine, p) {
  p.scCapHp = START_HP;
  p.scCapArmor = START_ARMOR;
  p.scCapSkill = START_SKILL_CAP;
  p.scSkillLevel = START_SKILL_LEVEL;
  p.scMatrix = 0;              // แต้มที่ถืออยู่ (ยังไม่ได้ลง)
  p.scPlaced = {};             // { targetId: 1..3 } แต้มที่ลงบนคนอื่น
  p.scSeen = [];               // playerId ที่เราเคยเห็นตัวละครแล้ว (เห็นของตัวเองเสมอ)
  p.scSpectator = false;       // วันที่ 7: ไม่ได้ลงสนามคู่นี้
  p.scEliminated = false;
  p.hp = START_HP;
  p.armor = START_ARMOR;
  p.skillPoints = 0;
  p.gold = START_GOLD;
  // สถิติสำหรับฉากผู้ชนะคนสุดท้าย (S12)
  p.scStat = { matrixFound: 0, coinsFound: 0, duelWins: 0, matrixSpent: 0, places: {} };
}

/** ฟิลด์ที่ต้องล้างทุกครั้งที่ resetCombat (กันค้างข้ามแมตช์ — GAME_SYSTEM.md gotcha #11) */
function resetFields(p) {
  p.scCapHp = 0; p.scCapArmor = 0; p.scCapSkill = 0; p.scSkillLevel = 0;
  p.scMatrix = 0; p.scPlaced = {}; p.scSeen = [];
  p.scSpectator = false; p.scEliminated = false; p.scPlace = null; p.scPlaceResult = null;
  p.scX = null; p.scFace = 1; p.scMoveAt = 0;
  p.scStat = null;
}

/** ฉากเปิดแมตช์กำลังเล่น (lobby.startMatch ตั้ง · จบเมื่อพักครบ) */
function setIntro(v) { introActive = !!v; }

// ============================================================
//  เพดานค่าสถานะ — ทับค่าเฉพาะตัวละครทุกตัว (SERAPH_MOONCELL.md §2 + §14 ข้อ 4)
// ============================================================
const maxHp = (p) => Math.max(1, p.scCapHp || START_HP);
const maxArmor = (p) => Math.max(0, p.scCapArmor || 0);
const maxSkill = (p) => Math.max(1, p.scCapSkill || START_SKILL_CAP);

/** tier นี้ปลดล็อกหรือยังตามระดับทักษะ */
function tierUnlocked(p, tier) {
  const need = UNLOCK_AT[tier];
  if (!need) return true;
  return (p.scSkillLevel || START_SKILL_LEVEL) >= need;
}

/** ราคาสกิลตามระดับทักษะ (2 / 4 / 6) — ทับค่าของตัวละคร */
const TIER_COST = { basic: 2, secondary: 4, ultimate: 6 };
const costOf = (tier) => TIER_COST[tier];

// ============================================================
//  กองไพ่ 40 ใบ — ถอด King / Queen / Joker (SERAPH_MOONCELL.md §10)
// ============================================================
function deckCards(CARD_COLORS) {
  const deck = [];
  for (let v = 1; v <= 10; v++) for (const color of CARD_COLORS) deck.push({ value: v, color });
  return deck;
}

// ============================================================
//  ใครลงสนามในเทิร์นนี้
//   วันที่ 1-6 = ทุกคนที่ยังไม่ตกรอบ · วันที่ 7 = เฉพาะคู่ที่กำลังดวล
// ============================================================
function combatants(engine) {
  const alive = Object.values(engine.players).filter((p) => p.alive && !p.scEliminated);
  if (!isDuelDay()) return alive;
  const pair = pairs[duelIndex];
  if (!pair) return [];
  return alive.filter((p) => p.id === pair.a || p.id === pair.b);
}

function inCurrentDuel(p) {
  if (!isDuelDay()) return true;
  const pair = pairs[duelIndex];
  return !!pair && (p.id === pair.a || p.id === pair.b);
}

// ============================================================
//  ต้นเทิร์น — server.js เรียกจาก dealRound()
// ============================================================
function onDealRound(engine) {
  if (!on) return;
  if (isDuelDay()) {
    phase = "duel";
    const pair = pairs[duelIndex];
    for (const p of Object.values(engine.players)) {
      p.scSpectator = !pair || (p.id !== pair.a && p.id !== pair.b);
      if (p.scSpectator) { p.cards = []; p.locked = true; p.busted = false; }
    }
  } else {
    phase = "draw";
    for (const p of Object.values(engine.players)) p.scSpectator = false;
  }
}

// ============================================================
//  วันที่ 1-6: เดินในแมพ (SERAPH_MOONCELL.md §5) — เปิดตั้งแต่ต้นวัน ไม่มีการจั่วไพ่
//  ทุกคนเดินในทางเดินเดียวกัน · เก็บชิ้นส่วน Matrix/เหรียญ (ใครถึงก่อนได้ก่อน) · เข้าสถานที่ได้วันละ 1 ที่ · กดพร้อม
// ============================================================
// server เป็นเจ้าของ startPhaseTimer/clearPhaseTimer (มีตัวเดียวทั้งเกม) โมดูลนี้จึงถือแค่ข้อมูล
// แล้วให้ server เป็นคนตั้งเวลา/ปิดเฟส — onAllPlaced คือ callback ที่ server ฝากไว้ให้เรียกเมื่อครบคน
let onAllPlaced = null;

function startPlacePhase(engine, allPlacedCb) {
  phase = "place";
  places = {};
  placeDone = {};
  ready = {};
  onAllPlaced = allPlacedCb;
  for (const p of Object.values(engine.players)) { p.scPlace = null; p.scPlaceResult = null; }
  spawnWorld(engine);
}

/** ต้นวัน: ทุกคนยืนเรียงกันที่ต้นทางเดิน + สุ่มของในแมพใหม่ */
function spawnWorld(engine) {
  const alive = Object.values(engine.players).filter((p) => p.alive && !p.scEliminated);
  alive.forEach((p, i) => { p.scX = 120 + i * 46; p.scFace = 1; p.scMoveAt = 0; });
  pickups = [];
  if (duelNight) return; // คืนวันที่ 7 ไม่มีของในแมพ
  const taken = DOORS.map((d) => d.x);
  const spot = () => {
    for (let tries = 0; tries < 60; tries++) {
      const x = Math.round(300 + Math.random() * (WORLD_W - 450));
      if (taken.every((t) => Math.abs(t - x) > 90)) { taken.push(x); return x; }
    }
    const x = Math.round(300 + Math.random() * (WORLD_W - 450));
    taken.push(x);
    return x;
  };
  for (let i = 0; i < MATRIX_PICKUPS; i++) pickups.push({ id: `m${++pickupSeq}`, kind: "matrix", x: spot() });
  for (let i = 0; i < alive.length; i++) pickups.push({ id: `c${++pickupSeq}`, kind: "coin", x: spot() });
}

const inWorld = (p) => !!(noCombat() && phase === "place" && p && p.alive && !p.scEliminated);

/** ผู้เล่นขยับในแมพ — คืน true ถ้าตำแหน่งเปลี่ยน (server ส่งต่อแบบเบาให้คนอื่น ไม่ broadcast state ทั้งก้อน) */
function move(engine, id, x, face) {
  const p = engine.players[id];
  if (!inWorld(p) || typeof x !== "number" || !Number.isFinite(x)) return false;
  const now = Date.now();
  const cur = typeof p.scX === "number" ? p.scX : 120;
  const dt = p.scMoveAt ? Math.max(0.05, (now - p.scMoveAt) / 1000) : 10;
  const reach = MOVE_SPEED * dt + 80;
  let nx = Math.max(40, Math.min(WORLD_W - 40, x));
  if (Math.abs(nx - cur) > reach) nx = cur + Math.sign(nx - cur) * reach; // ส่งพิกัดไกลเกินความเร็วเดิน = ตัดเหลือเท่าที่เดินทัน
  p.scX = Math.round(nx);
  p.scFace = face < 0 ? -1 : 1;
  p.scMoveAt = now;
  return true;
}

/** เก็บของในแมพ — ต้องยืนใกล้ของจริง · Matrix เต็มแล้วเก็บไม่ได้ (ของยังอยู่ให้คนอื่น) */
function pickup(engine, id, pid) {
  const p = engine.players[id];
  if (!inWorld(p)) return false;
  const i = pickups.findIndex((k) => k.id === pid);
  if (i < 0) return false;
  const k = pickups[i];
  if (Math.abs((p.scX ?? 0) - k.x) > PICK_REACH) return false;
  if (k.kind === "matrix") {
    if ((p.scMatrix || 0) >= MATRIX_MAX) return false;
    p.scMatrix = (p.scMatrix || 0) + 1;
    if (p.scStat) p.scStat.matrixFound = (p.scStat.matrixFound || 0) + 1;
  } else {
    engine.addGold(p, 1);
    if (p.scStat) p.scStat.coinsFound = (p.scStat.coinsFound || 0) + 1;
  }
  pickups.splice(i, 1);
  return true;
}

/** ปิดเฟส: คนที่ยังไม่กดพร้อม (หลุด/หมดเวลาตาข่าย) ถูกจัดสถานที่ให้ แล้วจบวัน */
function finishPlacePhase(engine) {
  autoAssign(engine);
  phase = "draw";
  onAllPlaced = null;
  pickups = [];
}

/** ยังมีคนที่ยังไม่กดพร้อมอยู่ไหม */
function placePending(engine) {
  return Object.values(engine.players).filter((p) => p.alive && !p.scEliminated && !ready[p.id]);
}

function canShop(p) {
  return !!(noCombat() && phase === "place" && p && p.alive && !p.scEliminated && !ready[p.id]);
}

function readyPlace(engine, id) {
  const p = engine.players[id];
  if (!canShop(p)) return;
  ready[id] = true;
  if (!placePending(engine).length && onAllPlaced) {
    const done = onAllPlaced;
    onAllPlaced = null;
    done();
  } else engine.broadcastState();
}

/** ตาข่ายหมดเวลา: คนที่ยังไม่ได้ใช้สถานที่ประจำวัน -> ระบบจัดให้ (ธรรมเนียมเดียวกับเฟส ATTACK) */
function autoAssign(engine) {
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  for (const p of placePending(engine)) {
    if (!placeDone[p.id]) {
      const options = DAILY_PLACES.filter((k) => placeAvailable(engine, p, k));
      if (options.length) {
        const key = pick(options);
        engine.log(`⏱️ ${p.name} ไม่ได้เลือกทันเวลา — ระบบจัดให้ที่ ${PLACE_NAME[key]}`);
        const picks = key === "church" ? [pick(["hp", "armor"]), pick(["hp", "armor"])]
          : key === "library" ? [0, 1, 2].map(() => pick(["skill", "level"])) : [];
        applyPlace(engine, p, key, { picks });
      }
    }
    ready[p.id] = true;
  }
}

/** สถานที่นี้ผู้เล่นคนนี้เข้าได้ไหม (ไม่รวมเงื่อนไข "วันละ 1 ที่") */
function placeAvailable(engine, p, key) {
  if (duelNight) return key === "room"; // คืนวันที่ 7: เปิดแค่ห้องพัก (ร้านค้าเปิดตามปกติ)
  if (key === "park") return (p.scMatrix || 0) > 0;
  if (key === "library") return (p.scSkillLevel || 1) < MAX_SKILL_LEVEL || (p.scCapSkill || START_SKILL_CAP) < MAX_SKILL_CAP;
  if (key === "church") return (p.scCapHp || START_HP) + (p.scCapArmor || START_ARMOR) < HP_ARMOR_CAP;
  return PLACES.includes(key);
}

/** สถานที่นี้นับเป็น "สถานที่ประจำวัน" (วันละ 1 ที่) ไหม — สวนสาธารณะกับร้านค้าแวะได้ไม่จำกัด */
const isDaily = (key) => DAILY_PLACES.includes(key);

/** ผู้เล่นเข้าสถานที่ + ส่งตัวเลือกย่อยมาพร้อมกัน (picks = ลำดับการอัปเกรด · targets = เป้า Matrix) */
function choosePlace(engine, id, key, opts = {}) {
  const p = engine.players[id];
  if (!canShop(p)) return;
  if (!PLACES.includes(key) || !placeAvailable(engine, p, key)) return;
  if (isDaily(key) && placeDone[id]) return;
  const door = DOORS.find((d) => d.key === key);
  if (door && typeof p.scX === "number" && Math.abs(p.scX - door.x) > DOOR_REACH) return; // ต้องยืนหน้าประตู
  applyPlace(engine, p, key, opts);
  engine.broadcastState();
}

function applyPlace(engine, p, key, opts) {
  if (isDaily(key)) {
    places[p.id] = key;
    placeDone[p.id] = true;
    p.scPlace = key;
  }
  if (p.scStat) p.scStat.places[key] = (p.scStat.places[key] || 0) + 1;
  p.scPlaceResult = null;   // ให้แต่ละสถานที่เติมเอง -> client เอาไปขึ้นฉากแจ้งเตือน
  if (key === "room") return placeRoom(engine, p);
  if (key === "church") return placeChurch(engine, p, opts.picks);
  if (key === "park") return placePark(engine, p, opts.targets);
  if (key === "library") return placeLibrary(engine, p, opts.picks);
}

// ---------- ห้องพัก: สุ่มของฟรี 1 ชิ้น (คนละคลังกับร้านค้า) ----------
function placeRoom(engine, p) {
  const total = ROOM_ITEMS.reduce((s, it) => s + it.weight, 0);
  let r = Math.random() * total;
  let pick = ROOM_ITEMS[0];
  for (const it of ROOM_ITEMS) { r -= it.weight; if (r <= 0) { pick = it; break; } }
  p.inventory.push({ ...pick, uid: `sc${Date.now()}${Math.floor(Math.random() * 1000)}`, free: true });
  p.scLastGift = pick.name;
  p.scPlaceResult = { place: "room", title: "ได้ของฟรี 1 ชิ้น", detail: pick.name, item: pick.type, seq: Date.now() };
  engine.log(`🛏️ ${p.name} พักที่ห้องพัก — ได้รับ "${pick.name}" มาฟรี 1 ชิ้น`);
}

const pickList = (picks, allowed, n) => (Array.isArray(picks) ? picks : [picks]).filter((k) => allowed.includes(k)).slice(0, n);

// ---------- โบสถ์: อัป 2 ครั้ง เลือกพลังชีวิต/เกราะ (ซ้ำได้) · รวมกันไม่เกิน 10 ----------
function placeChurch(engine, p, picks) {
  const list = pickList(picks, ["hp", "armor"], CHURCH_PICKS);
  if (!list.length) list.push("hp");
  const got = { hp: 0, armor: 0 };
  for (const k of list) {
    if ((p.scCapHp || START_HP) + (p.scCapArmor || START_ARMOR) >= HP_ARMOR_CAP) break;
    if (k === "hp") {
      p.scCapHp = (p.scCapHp || START_HP) + 1;
      p.hp = Math.min(p.scCapHp, p.hp + 1); // ความจุใหม่เติมให้ทันที (วันสืบสวนไม่มีดาเมจอยู่แล้ว)
    } else {
      p.scCapArmor = (p.scCapArmor || START_ARMOR) + 1;
      p.armor = Math.min(p.scCapArmor, p.armor + 1);
    }
    got[k]++;
  }
  const parts = [got.hp && `พลังชีวิต +${got.hp}`, got.armor && `เกราะ +${got.armor}`].filter(Boolean);
  p.scPlaceResult = {
    place: "church", title: parts.join(" · ") || "เต็มเพดานแล้ว",
    detail: `พลังชีวิต ${p.scCapHp} · เกราะ ${p.scCapArmor}`, seq: Date.now()
  };
  engine.log(`⛪ ${p.name} สวดที่โบสถ์ — ${parts.join(" · ") || "ความจุเต็มเพดาน"} (พลังชีวิต ${p.scCapHp} · เกราะ ${p.scCapArmor})`);
}

// ---------- สวนสาธารณะ: ลงแต้ม Matrix ใส่เป้าหมาย (แวะได้ไม่จำกัด ไม่นับเป็นสถานที่ประจำวัน) ----------
function placePark(engine, p, targets) {
  const list = Array.isArray(targets) ? targets : [];
  let used = 0;
  for (const tid of list) {
    if ((p.scMatrix || 0) <= 0) break;
    const t = engine.players[tid];
    if (!t || t.id === p.id || !t.alive || t.scEliminated) continue;
    const cur = p.scPlaced[tid] || 0;
    if (cur >= MATRIX_PER_TARGET) continue;
    p.scPlaced[tid] = cur + 1;
    p.scMatrix--;
    used++;
    if (p.scStat) p.scStat.matrixSpent++;
  }
  p.scPlaceResult = used > 0
    ? { place: "park", title: `ลง Matrix ${used} แต้ม`, detail: `เหลือ ${p.scMatrix}`, seq: Date.now() }
    : null;
  if (used > 0) engine.log(`🌳 ${p.name} แวะสวนสาธารณะ — ลงแต้ม Matrix ${used} แต้ม (เหลือ ${p.scMatrix})`);
}

// ---------- ห้องสมุด: อัป 3 ครั้ง เลือกความจุแต้มสกิล (สูงสุด 8) / ระดับทักษะ (สูงสุด 6) ----------
function placeLibrary(engine, p, picks) {
  const list = pickList(picks, ["skill", "level"], LIBRARY_PICKS);
  if (!list.length) list.push("level");
  const lvBefore = p.scSkillLevel || START_SKILL_LEVEL;
  const capBefore = p.scCapSkill || START_SKILL_CAP;
  let unlock = null;
  for (const k of list) {
    if (k === "skill" && (p.scCapSkill || START_SKILL_CAP) < MAX_SKILL_CAP) p.scCapSkill = (p.scCapSkill || START_SKILL_CAP) + 1;
    else if (k === "level" && (p.scSkillLevel || START_SKILL_LEVEL) < MAX_SKILL_LEVEL) {
      p.scSkillLevel = (p.scSkillLevel || START_SKILL_LEVEL) + 1;
      if (p.scSkillLevel === UNLOCK_AT.secondary) unlock = "secondary";
      if (p.scSkillLevel === UNLOCK_AT.ultimate) unlock = "ultimate";
    }
  }
  if (unlock) p.scUnlocked = unlock;
  const dLv = p.scSkillLevel - lvBefore, dCap = p.scCapSkill - capBefore;
  const parts = [dLv && `ระดับทักษะ +${dLv}`, dCap && `ความจุแต้มสกิล +${dCap}`].filter(Boolean);
  p.scPlaceResult = {
    place: "library", title: parts.join(" · ") || "เต็มเพดานแล้ว",
    detail: `ระดับทักษะ ${p.scSkillLevel} · ความจุแต้มสกิล ${p.scCapSkill}`,
    unlock,
    warn: p.scSkillLevel >= UNLOCK_AT.ultimate && p.scCapSkill < TIER_COST.ultimate ? "แต้มไม่พอใช้ท่าไม้ตาย" : null,
    seq: Date.now()
  };
  engine.log(`📚 ${p.name} อ่านหนังสือที่ห้องสมุด — ${parts.join(" · ") || "เต็มเพดาน"}`);
  if (unlock === "secondary") engine.log(`🔓 ${p.name} ปลดล็อก "สกิลรอง" แล้ว`);
  if (unlock === "ultimate") engine.log(`🔓 ${p.name} ปลดล็อก "ท่าไม้ตาย" แล้ว`);
}

// ============================================================
//  จบวัน -> วันถัดไป / ประกาศคู่ / เข้าวันดวล / จบรอบ
//  คืนค่า "สิ่งที่ server ต้องทำต่อ": { next: "day"|"pairing"|"duelDay"|"cycleEnd" }
// ============================================================
function advanceDay(engine) {
  if (!on) return { next: "day" };
  if (day === PAIRING_DAY) {
    makePairs(engine);
    day++;
    return { next: "pairing" };
  }
  if (day < DUEL_DAY) {
    day++;
    if (day === DUEL_DAY) return { next: "duelDay" };
    return { next: "day" };
  }
  return { next: "day" };
}

/**
 * จับคู่ดวล — **สุ่มมาแค่ 1 คู่ต่อรอบเท่านั้น** คนที่เหลือทั้งหมดผ่านเข้ารอบถัดไปฟรี
 * (กติกา: วันที่ 7 เกิดการต่อสู้แค่คู่เดียว จบแล้ววนกลับไปวันที่ 1 ของรอบใหม่
 *  ดังนั้นประกาศคู่ตอนจบวันที่ 5 จึงแสดงแค่คู่เดียวด้วย)
 */
function makePairs(engine) {
  const pool = Object.values(engine.players).filter((p) => p.alive && !p.scEliminated);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  pairs = [];
  byeIds = [];
  if (pool.length >= 2) {
    const a = pool.shift(), b = pool.shift();
    pairs.push({ a: a.id, b: b.id, done: false, winnerId: null });
    engine.log(`⚔️ คู่ดวลวันที่ 7 — ${a.name} ปะทะ ${b.name}`);
  }
  byeIds = pool.map((p) => p.id);
  if (byeIds.length) {
    engine.log(`✨ ผ่านเข้ารอบถัดไปโดยไม่ต้องดวล: ${byeIds.map((id) => engine.players[id].name).join(" · ")}`);
  }
  duelIndex = 0;
}

/** เข้าวันที่ 7: ทุกคนได้แต้มสกิลเริ่มต้น 4 + เปิดเผยตัวละครของคู่ที่ลงสนาม */
function beginDuelDay(engine) {
  day = DUEL_DAY;
  phase = "duel";
  duelIndex = 0;
  for (const p of Object.values(engine.players)) {
    if (!p.alive || p.scEliminated) continue;
    p.skillPoints = Math.min(maxSkill(p), DUEL_START_SKILL);
  }
  revealCurrentPair(engine);
}

/** เปิดเผยตัวละครของคู่ที่กำลังลงสนามให้ "ทุกคนที่ดูอยู่" (SERAPH_MOONCELL.md §9) */
function revealCurrentPair(engine) {
  const pair = pairs[duelIndex];
  if (!pair) return;
  for (const viewer of Object.values(engine.players)) {
    if (!Array.isArray(viewer.scSeen)) viewer.scSeen = [];
    for (const id of [pair.a, pair.b]) {
      if (!viewer.scSeen.includes(id)) viewer.scSeen.push(id);
    }
  }
  const a = engine.players[pair.a], b = engine.players[pair.b];
  if (a && b) engine.log(`👁 เปิดเผยตัวตน — ${a.name} คือ ${charName(engine, a)} · ${b.name} คือ ${charName(engine, b)}`);
}

function charName(engine, p) {
  const ch = engine.CHAR_BY_ID[p.characterId];
  return ch ? ch.name : "???";
}

/**
 * เช็คหลังจบเทิร์นของวันที่ 7 ว่าคู่นี้จบหรือยัง
 * คืน: "continue" ดวลต่อ · "nextPair" ไปคู่ถัดไป · "cycleEnd" หมดคิวแล้ว
 */
function checkDuelProgress(engine) {
  if (!isDuelDay()) return "continue";
  const pair = pairs[duelIndex];
  if (!pair) return "cycleEnd";
  const a = engine.players[pair.a], b = engine.players[pair.b];
  const aDead = !a || !a.alive;
  const bDead = !b || !b.alive;
  if (!aDead && !bDead) return "continue";

  pair.done = true;
  // ตายพร้อมกันในเทิร์นเดียว = ตกรอบทั้งคู่ ไม่มีผู้ชนะ (เหลือไม่ถึง 2 คน = จบเกมตามปกติที่ seraphAdvance)
  if (aDead && bDead) {
    for (const p of [a, b]) {
      if (!p) continue;
      p.scEliminated = true;
      engine.log(`💀 ${p.name} ถูกลบออกจาก SE.RA.PH — ตกรอบ`);
    }
    engine.log("⚔️ ทั้งคู่ล้มลงพร้อมกัน — ไม่มีผู้ชนะในการดวลครั้งนี้");
    duelIndex++;
    return "cycleEnd";
  }
  const loser = aDead ? a : b;
  const winner = aDead ? b : a;
  if (loser) {
    loser.scEliminated = true;
    engine.log(`💀 ${loser.name} ถูกลบออกจาก SE.RA.PH — ตกรอบ`);
  }
  if (winner) {
    pair.winnerId = winner.id;
    if (winner.scStat) winner.scStat.duelWins++;
    engine.log(`🏅 ${winner.name} ผ่านเข้ารอบถัดไป`);
  }
  // มีคู่เดียวต่อรอบ -> ดวลจบเมื่อไหร่ก็จบรอบทันที ไม่มีคู่ถัดไป
  duelIndex++;
  return "cycleEnd";
}

/** ดวลจบ -> คืนวันที่ 7 (คนที่ยังรอดเดินแมพ พัก/ซื้อของ แล้วกดพร้อมเพื่อจบรอบ) */
function beginDuelNight(engine) {
  duelNight = true;
  phase = "draw";
  for (const p of Object.values(engine.players)) p.scSpectator = false;
  engine.log("🌙 คืนวันที่ 7 — ห้องพักกับร้านค้าเปิดให้เข้า");
}

/** จบรอบ: รีเซ็ต/ฟื้น/รางวัล (SERAPH_MOONCELL.md §8) */
function endCycle(engine) {
  for (const p of Object.values(engine.players)) {
    if (p.scEliminated) continue;
    p.skillPoints = 0;
    p.scPlaced = {};              // แต้มที่ลงบนเป้าหมายถูกล้าง (ที่ยังไม่ได้ลงยังอยู่)
    p.hp = maxHp(p);              // ฟื้นเต็ม
    p.armor = maxArmor(p);
    p.scSpectator = false;
    engine.addGold(p, CYCLE_END_GOLD);
  }
  pairs = [];
  byeIds = [];
  duelIndex = 0;
  duelNight = false;
  day = 1;
  cycleRound++;
  phase = "draw";
  engine.log(`🌙 จบรอบที่ ${cycleRound - 1} — ทุกคนได้ +${CYCLE_END_GOLD} เหรียญ · ฟื้นพลังชีวิตและเกราะเต็ม`);
  engine.log(`🌗 รอบที่ ${cycleRound} เริ่มขึ้น (${isNight() ? "กลางคืน" : "กลางวัน"}) · วันที่ 1 จาก ${DAYS_PER_CYCLE}`);
}

/** เหลือผู้รอดคนเดียว = จบเกม */
function survivors(engine) {
  return Object.values(engine.players).filter((p) => p.alive && !p.scEliminated);
}

// ============================================================
//  การมองเห็นตัวตน (SERAPH_MOONCELL.md §9)
// ============================================================
/** viewer เห็นตัวละครของ target ไหม */
function canSee(viewer, target) {
  if (!on) return true;
  if (!viewer || !target) return false;
  if (viewer.id === target.id) return true;
  return Array.isArray(viewer.scSeen) && viewer.scSeen.includes(target.id);
}

// ============================================================
//  payload ที่ส่งให้ client (SERAPH_SCENES.md §8)
//  ทุกอย่างเป็น per-viewer — ข้อมูลสืบสวนของคนอื่นห้ามรั่ว
// ============================================================
function stateFor(engine, viewerId) {
  if (!on) return null;
  const me = engine.players[viewerId];
  const alive = Object.values(engine.players).filter((p) => p.alive && !p.scEliminated);
  // จำนวนคนที่ลง Matrix ระดับ 3 ใส่เรา — ส่งแค่ "จำนวน" ห้ามส่ง id (ไม่งั้นระบบสืบสวนพัง)
  let watchedBy = 0;
  if (me) {
    for (const o of Object.values(engine.players)) {
      if (o.id === viewerId) continue;
      if ((o.scPlaced && o.scPlaced[viewerId] || 0) >= MATRIX_PER_TARGET) watchedBy++;
    }
  }
  const pair = pairs[duelIndex] || null;
  return {
    day,
    cycleRound,
    // ภาพกลางวัน/กลางคืน: วันที่ 1-6 กลางวัน · คืนวันที่ 7 กลางคืน · สนามดวลสลับตามรอบ (รอบเลขคู่ = กลางคืน)
    night: duelNight || (isDuelDay() && isNight()),
    duelNight,
    intro: introActive,
    phase,
    noCombat: noCombat(),
    daysTotal: DAYS_PER_CYCLE,
    investigationDays: INVESTIGATION_DAYS,
    duelDay: DUEL_DAY,
    // --- ของผู้ชมคนนี้เท่านั้น ---
    place: me ? me.scPlace || null : null,
    dailyUsed: !!placeDone[viewerId],
    placedCount: Object.keys(placeDone).length,
    ready: !!ready[viewerId],
    readyCount: alive.filter((p) => ready[p.id]).length,
    totalPlayers: alive.length,
    matrixHeld: me ? me.scMatrix || 0 : 0,
    matrixMax: MATRIX_MAX,
    matrixPlaced: me ? { ...(me.scPlaced || {}) } : {},
    watchedBy,
    skillLevel: me ? me.scSkillLevel || START_SKILL_LEVEL : START_SKILL_LEVEL,
    skillLevelMax: MAX_SKILL_LEVEL,
    caps: me ? { hp: me.scCapHp, armor: me.scCapArmor, skill: me.scCapSkill } : null,
    unlocked: me ? {
      basic: tierUnlocked(me, "basic"),
      secondary: tierUnlocked(me, "secondary"),
      ultimate: tierUnlocked(me, "ultimate")
    } : null,
    eliminated: me ? !!me.scEliminated : false,
    placeResult: me ? me.scPlaceResult || null : null,   // ผลของสถานที่ที่เพิ่งไปมา (ของผู้ชมคนนี้เท่านั้น)
    shopOpen: canShop(me),
    stat: me ? me.scStat || null : null,                  // สถิติของผู้ชมคนนี้ (ใช้ในฉากจบเกม)
    // สรุปตอนจบเกม: ใครรอด ใครถูกลบ + สถิติของทุกคน (เปิดเผยได้แล้วเพราะเกมจบ)
    finalBoard: Object.values(engine.players).map((o) => ({
      id: o.id, name: o.name,
      charName: engine.CHAR_BY_ID[o.characterId] ? engine.CHAR_BY_ID[o.characterId].name : "???",
      img: null, eliminated: !!o.scEliminated, alive: !!o.alive,
      gold: o.gold || 0, skillLevel: o.scSkillLevel || START_SKILL_LEVEL,
      stat: o.scStat || null
    })),
    // --- ข้อมูลสาธารณะ ---
    pairs: pairs.map((pr) => ({
      a: pr.a, b: pr.b,
      aName: engine.players[pr.a] ? engine.players[pr.a].name : "",
      bName: engine.players[pr.b] ? engine.players[pr.b].name : "",
      done: pr.done, winnerId: pr.winnerId
    })),
    byes: byeIds.map((id) => ({ id, name: engine.players[id] ? engine.players[id].name : "" })),
    myOpponent: me ? opponentOf(me.id) : null,
    duelIndex,
    duelPair: pair ? { a: pair.a, b: pair.b } : null,
    spectating: me ? !!me.scSpectator : false,
    pairingDay: PAIRING_DAY,
    upgradePicks: { church: CHURCH_PICKS, library: LIBRARY_PICKS },
    hpArmorCap: HP_ARMOR_CAP,
    // แมพวันสืบสวน: ประตู + ของที่ยังไม่มีใครเก็บ + ตำแหน่งทุกคน (ชื่อเท่านั้น ตัวละครยังซ่อน)
    world: noCombat() ? {
      w: WORLD_W,
      doors: DOORS,
      pickups: pickups.map(({ id, kind, x }) => ({ id, kind, x })),
      players: alive.map((o) => ({ id: o.id, x: typeof o.scX === "number" ? o.scX : 120, f: o.scFace || 1 }))
    } : null,
    places: PLACES.map((k) => ({
      key: k, name: PLACE_NAME[k],
      daily: isDaily(k),
      available: canShop(me) && !(isDaily(k) && placeDone[viewerId]) && placeAvailable(engine, me, k)
    }))
  };
}

function opponentOf(id) {
  for (const pr of pairs) {
    if (pr.a === id) return pr.b;
    if (pr.b === id) return pr.a;
  }
  return null;
}

/** Matrix ระดับ 1: เห็นจำนวนไพ่ในมือของเป้าหมาย · ระดับ 3: เห็นแต้ม */
function matrixLevelOn(viewer, target) {
  if (!on || !viewer || !target) return 0;
  return (viewer.scPlaced && viewer.scPlaced[target.id]) || 0;
}

/** Matrix ระดับ 2: รับความเสียหายจากเป้าหมายน้อยลง 1 หน่วย */
function damageReduction(victim, sourceId) {
  if (!on || !victim || !sourceId) return 0;
  // ผู้ "รับ" ดาเมจต้องเป็นคนที่ลงแต้มไว้บนผู้โจมตี (ลง 2 แต้มบนใคร = กันดาเมจจากคนนั้น 1 หน่วย)
  const lv = (victim.scPlaced && victim.scPlaced[sourceId]) || 0;
  return lv >= 2 ? 1 : 0;
}

function takeLog() {
  const out = pendingLog;
  pendingLog = [];
  return out;
}

module.exports = {
  // ค่าคงที่
  START_HP, START_ARMOR, START_SKILL_CAP, MAX_SKILL_CAP, START_GOLD,
  START_SKILL_LEVEL, MAX_SKILL_LEVEL, MATRIX_MAX, MATRIX_PER_TARGET,
  INVESTIGATION_DAYS, DAYS_PER_CYCLE, PAIRING_DAY, DUEL_DAY, DUEL_START_SKILL, INTRO_SECONDS,
  CYCLE_END_GOLD, UNLOCK_AT, TIER_COST, PLACES, DAILY_PLACES, PLACE_NAME,
  CHURCH_PICKS, LIBRARY_PICKS, HP_ARMOR_CAP, WORLD_W, DOORS, DOOR_REACH, PICK_REACH, MATRIX_PICKUPS,
  // สถานะโหมด
  active, reset, startMatch, initPlayer, resetFields, setIntro,
  currentDay, currentCycle, currentPhase, isDuelDay, isDuelNight, noCombat, isNight,
  // กติกา
  maxHp, maxArmor, maxSkill, tierUnlocked, costOf, deckCards,
  combatants, inCurrentDuel, onDealRound,
  // เฟสสถานที่
  startPlacePhase, finishPlacePhase, choosePlace, placeAvailable, placePending, canShop, readyPlace,
  // แมพวันสืบสวน
  move, pickup,
  // วัน/คู่ดวล/รอบ
  advanceDay, makePairs, beginDuelDay, beginDuelNight, revealCurrentPair, checkDuelProgress,
  endCycle, survivors, opponentOf,
  // การมองเห็น + payload
  canSee, stateFor, matrixLevelOn, damageReduction, takeLog
};
