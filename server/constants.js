// ค่าคงที่ของเกม (เวลาเฟส/เลือด/ร้านค้า) + ค่าคงที่เฉพาะตัวละครที่ระบบกลางยังใช้
const CHAR_HOOKS = require("../characters/index");

// เพดานค่าใช้พลังงานของสกิล: ตัวปรับราคา "ขาขึ้น" ทุกชนิด (กลางคืน / ภาระเวท) ดันราคาได้ไม่เกินนี้
//  สกิลที่ราคาแตะเพดานอยู่แล้ว (เช่นท่าไม้ตาย 8) จะไม่ถูกดันให้แพงขึ้นไปอีก — ส่วนกระแสเวทยังลดราคาได้ตามปกติ
const SKILL_COST_MAX = 8;

// ---------- ค่าคงที่ ----------
const MAX_PLAYERS = 7; // patch 2.8: เปิดช่องผู้เล่นที่ 7
const CARD_TIME = 60;
const OVERLOAD_FORCE_CHANCE = 0.30;
const OVERLOAD_FORCE_CUTSCENE_SECONDS = 5; // overload_force_start.mp4 = 4.809s
const SUMMARY_TIME = 5;
const ATTACK_TIME = 15;
const TRANSITION_TIME = 3;
const SERAPH_PLACE_SAFETY_SECONDS = 300; // SE.RA.PH: ตาข่ายกันเฟสเลือกสถานที่ค้างถาวร (ไม่ใช่เวลาจำกัดของผู้เล่น)
const RECONNECT_GRACE_MS = Math.max(100, Number(process.env.RECONNECT_GRACE_MS) || 60_000);
const RESERVATION_TTL_MS = 120_000;
const ATTACKFX_TIME = 3;  // อนิเมชันบอกว่าใครตีใคร

const MAX_HP = 7;       // เลือดจริงพื้นฐาน (patch พิเศษ — เดิม 5)
const MAX_ARMOR = 3;    // เกราะเริ่มต้น (patch พิเศษ — เดิม 2)
const MAX_SKILL = 8;
// ---------- ร้านค้ามายา + เศรษฐกิจเหรียญ (patch 2.2 full) ----------
const GOLD_MAX = 30;             // เพดานเหรียญต่อผู้เล่น
const GOLD_PER_TURN = 1;         // เหรียญที่ได้ทุกจบเทิร์น (ทุกคน)
const GOLD_WIN_BONUS = 1;        // เหรียญเพิ่มเมื่อชนะการจั่วไพ่
const SHOP_INTERVAL_TURNS = 5;   // ร้านค้าเปิดทุกๆ 5 เทิร์น
const SHOP_MAX_ITEMS = 15;       // จำนวนสินค้าสูงสุดต่อรอบร้านค้า (เดิม 6 -> 9 -> 15 หลังรวมร้านลุงเท่งเข้ามา)
const SHOP_CARD_COLOR_PRICE = 5; // ยาเปลี่ยนสีการ์ด: เลือกการ์ด 1 ใบในมือ เปลี่ยนเป็นสีที่ต้องการ
const SHOP_FORTUNE_PRICE = 5;
const SHOP_FORTUNE_AMOUNT = 2;   // ยาโชคลาภ: ได้โชคลาภ +2 หน่วยเมื่อใช้
const SHOP_RESIST_PRICE = 5;
const SHOP_RESIST_TURNS = 1;     // ยาต้านสถานะ: ต้านสถานะผิดปกติ 1 เทิร์น
const SHOP_ARMOR_PRICE = 3;
const SHOP_ARMOR_AMOUNT = 1;     // ยาฟื้นเกราะ: ฟื้นเกราะ +1 หน่วย
const SHOP_CARD_REMOVE_PRICE = 5; // ยาลดไพ่: ลดไพ่ใบล่าสุดของตัวเองออก 1 ใบ (กันแตกได้)
const SHOP_SKILL_SIZES = [
  { size: "small", amount: 1, price: 2, weight: 50 },   // สัดส่วนภายในกลุ่ม "ยาฟื้นแต้มสกิล"
  { size: "medium", amount: 4, price: 6, weight: 35 },
  { size: "large", amount: 6, price: 10, weight: 15 },
];
// ---------- ปืนหน่วย GUTS Select (เดิมอยู่ร้านลุงเท่ง — ยุบรวมเข้าร้านค้ามายาแล้ว) ----------
// ปืนเป็นไอเทมถาวร (มีได้กระบอกเดียว) กระสุนซื้อแยกอิสระ แต่ยิงไม่ได้ถ้าไม่มีปืน — ยิงได้ 1 นัด/เทิร์น ช่วงจั่วไพ่เท่านั้น
const ITEM_BASE = "/item";
const GUTS_GUN_PRICE = 15;
const GUTS_CHAA_TURNS = 2;       // Thunder Bullet: สภาพชาคงอยู่ 2 เทิร์น
const GUTS_NURSE_DMG = 4;         // Nursedessei Cannon: ดาเมจ (ลดเกราะก่อน)
const BLACK_SPARKLENCE_NURSE_COOLDOWN = 3; // Black Sparklence: หลังยิง Nursedessei ใช้ปืนไม่ได้ 3 เทิร์นถัดไป
const GUTS_AMMO = {
  shockwave: { id: "shockwave", name: "Shockwave Bullet",   price: 5,  img: `${ITEM_BASE}/guts_key/gomora_key.webp`,    cut: "gutsShockwave" },
  gargorgon: { id: "gargorgon", name: "Gargorgon Ray",      price: 5,  img: `${ITEM_BASE}/guts_key/gargorgon_key.webp`, cut: "gutsGargorgon" },
  thunder:   { id: "thunder",   name: "Thunder Bullet",     price: 5,  img: `${ITEM_BASE}/guts_key/eleking_key.webp`,   cut: "gutsThunder" },
  nurse:     { id: "nurse",     name: "Nursedessei Cannon", price: 10, img: `${ITEM_BASE}/guts_key/nurse_key.webp`,     cut: "gutsNurse", breaksGun: true },
  hyper_trigger: { id: "hyper_trigger", name: "Hyper Key Trigger", price: 20, img: `${ITEM_BASE}/guts_hyper_key/hyper_key_trigger.jpg`, cut: "triggerHenshin", transform: true },
  trigger_dark_key: { id: "trigger_dark_key", name: "Trigger Dark Key", price: 10, img: `${ITEM_BASE}/guts_hyper_key/hyper_key_trigger_dark.jpg`, cut: "triggerDarkHenshin", transformDark: true },
};
const GUTS_AMMO_IDS = Object.keys(GUTS_AMMO).filter((id) => id !== "hyper_trigger" && id !== "trigger_dark_key");
const SHOP_MAX_GUNS = 2;          // ปืนขึ้นได้สูงสุด 2 กระบอกต่อรอบที่ร้านรีสต็อก (ที่เกินสุ่มเป็นกระสุนแทน)
const SHOP_MAX_HYPER = 1;         // Hyper Key Trigger ขึ้นได้สูงสุด 1 ชิ้นต่อรอบ (ซื้อขาด — ที่เกินสุ่มเป็นกระสุนแทน)
const SHOP_MAX_MARK42 = 2;        // เกราะ Mark 42: โอกาสออก/เพดานต่อรอบเท่าปืน GUTS (ที่เกินสุ่มเป็นกระสุนแทน)
// น้ำหนักกระสุนธรรมดาภายในกลุ่ม "กระสุน" (รวม = SHOP_WEIGHTS.gutsAmmo)
const SHOP_AMMO_WEIGHTS = { shockwave: 4, gargorgon: 4, thunder: 4, nurse: 2 };
// ตารางโอกาสออกสินค้าต่อ 1 ช่องสุ่ม (รวม 100) — ช่องล็อกช่องแรก (Trigger Dark Key) ไม่ผ่านตารางนี้
const SHOP_WEIGHTS = {
  cardColor: 15,
  fortune: 5,      // หายากสุด
  resist: 15,
  cardRemove: 12,
  skillPoint: 14,  // แตกย่อยตาม SHOP_SKILL_SIZES.weight
  armor: 14,
  gutsGun: 8,      // จำกัด SHOP_MAX_GUNS ต่อรอบ ที่เกินตกไปรวมกับกระสุน
  gutsAmmo: 14,    // แตกย่อยตาม SHOP_AMMO_WEIGHTS
  hyperTrigger: 3, // Hyper Key Trigger: ของแพงสุด สุ่มออก จำกัด SHOP_MAX_HYPER ต่อรอบ
  mark42: 8,       // เกราะ Mark 42: เจอได้พอๆ กับปืน จำกัด SHOP_MAX_MARK42 ต่อรอบ
};
// ---------- DoomGuy (patch 2.2 full) ----------
const DOOM_BASE = "/characters/doomguy";
const DOOM_WEAPONS = {
  shotgun:      { id: "shotgun", name: "Combat Shotgun", img: `${DOOM_BASE}/สกิลรอง/Combat shotgun.webp`, cost: 2, weight: 17, atk: 2, pierce: false, effect: "explode" },
  heavy:        { id: "heavy", name: "Heavy Cannon", img: `${DOOM_BASE}/สกิลรอง/Heavy Cannon.webp`, cost: 2, weight: 17, atk: 2, pierce: true, effect: "lockon" },
  plasma:       { id: "plasma", name: "Plasma Rifle", img: `${DOOM_BASE}/สกิลรอง/Plasma Rifle.webp`, cost: 2, weight: 17, atk: 1, pierce: true, effect: "drain" },
  chaingun:     { id: "chaingun", name: "Chaingun", img: `${DOOM_BASE}/สกิลรอง/Chaingun.webp`, cost: 2, weight: 17, atk: 2, pierce: false, effect: "shield" },
  rocket:       { id: "rocket", name: "Rocket Launcher", img: `${DOOM_BASE}/สกิลรอง/Rocket Launcher.webp`, cost: 5, weight: 10, atk: 3, pierce: false, splash: true, effect: "bonusdmg" },
  supershotgun: { id: "supershotgun", name: "Super Shotgun", img: `${DOOM_BASE}/สกิลรอง/Super shotgun.webp`, cost: 4, weight: 10, atk: 3, pierce: false, effect: "stun" },
  ballista:     { id: "ballista", name: "Ballista", img: `${DOOM_BASE}/สกิลรอง/Ballista.webp`, cost: 5, weight: 10, atk: 3, pierce: true, effect: "bonusdmg2" },
  bfg:          { id: "bfg", name: "BFG 9000", img: `${DOOM_BASE}/สกิลรอง/BFG9000.webp`, cost: 8, weight: 2, atk: 6, pierce: false, effect: null },
};
const DOOM_WEAPON_IDS = Object.keys(DOOM_WEAPONS);
const DOOM_STARTING_WEAPON = "shotgun";
const DOOM_LOCKON_CHANCE = 1; // patch: เอาทอย 40% ออก ติดสถานะ [ล็อคเป้า] แน่นอนเสมอ
const DOOM_EXPLODE_DMG = 1;
const DOOM_EXPLODE_TARGETS = 2;
const DOOM_LOCKON_BONUS = 1;
const DOOM_ROCKET_BONUS_DMG = 2;
const DOOM_BALLISTA_TARGET_DMG = 2; // Ballista (patch): เปลี่ยนจาก aoe ทุกคน 1 -> เลือกเป้าหมาย 1 คนโดนดาเมจเพิ่มเติม 2 (โครงเดียวกับ Rocket's bonusdmg)
const DOOM_DRAIN_DMG = 1;    // [โดนดูด] (Plasma Rifle): ดาเมจ 1/เทิร์น ผ่านเกราะก่อน
const DOOM_DRAIN_TURNS = 3;  // [โดนดูด]: คงอยู่ 3 เทิร์น
const DOOM_CRUCIBLE_ATK = 7;
const DOOM_CRUCIBLE_CHARGE_NEED = 5;
const DOOM_HEAL_ON_ATK = 1;
const DOOM_SHIELD_ON_ATK = 1; // patch: พาสซีฟเพิ่มโล่ +1 ทุกครั้งที่โจมตีโดน (นอกเหนือจากฮีล)
const DOOM_CHARGE_CHANCE = 0.35; // patch 2.2 new: 10% -> 25% -> 35%
const DOOM_TIE_ATTACK_CHANCE = 0.5; // เสมอแต้ม: มีโอกาสได้โจมตี 50%
const DOOM_FORTUNE_CHANCE = 0.2; // patch: ทุกต้นเทิร์นมีโอกาส 20% ได้ [โชคลาภ] +1 สแตค
const DOOM_CRUCIBLE_BUST_DMG = 2; // Crucible: บังคับทุกคนแตก -> รับความเสียหายเหมือนแพ้จั่ว/ไพ่แตก
const DOOM_CRUCIBLE_BUST_DRAWS = 2; // Crucible (patch 2.2.4): บังคับจั่วเพิ่ม 2 ใบ (แบบเดียวกับ Ashen Trail โอกูริ)
const DOOM_CRUCIBLE_BUST_BONUS = 8; // Crucible (patch 2.2.4): บวกแต้มการ์ดตรงๆ +8 การันตีแตกจริง แม้เปิดไพ่/ล็อกไปแล้ว
// ---------- สึงาชิ ทาคุโตะ (patch 2.2 new) ----------
// ค่าคงที่ของทาคุโตะส่วนใหญ่ย้ายไปอยู่ characters/takuto.js แล้ว — เหลือแค่ที่ shared damage-sum/decay loop ในไฟล์นี้ยังใช้อยู่
const TAKUTO_STAR_NEED = 5;           // ดวงดาวสะสมครบ 5 -> ฉันคว้ามันได้แล้ว (Apprivoise!) ทันที (ใช้ใน log ตอน apprivoise หมดเวลา)
const TAKUTO_APPRIVOISE_TURNS = 10;   // ฉันคว้ามันได้แล้ว: คงอยู่ 10 เทิร์น หมดแล้วกลับเป็นทาคุโตะปกติ ต้องเก็บดวงดาวใหม่ (patch 2.2.3 — เดิมถาวร)
const TAKUTO_LANCE_DMG = 5;           // หอกผู้พิชิต: การโจมตีปกติดาเมจคงที่ 5 หน่วย (คำนวณใน doAttack()'s shared damage-sum — นอกขอบเขต Phase 1)
const TEMP_HP_TURNS = 2; // เลือดชั่วคราว หายเองภายใน 2 เทิร์น

// ---------- ไรโด ฮิคารุ / อุลตร้าแมนกิงกะ (rework patch 2.1.3) ----------
//  สกิลพื้นฐาน 1 MonsterLive: เพดานเกราะ+2 ฟื้นเกราะทันที+2 คงอยู่ 3 เทิร์น — เกราะลด = ฟื้นเลือดตามเกราะที่เสีย
//    + ดาเมจที่ได้รับจากการโจมตี -1 (ใช้ terms เดิมของสถานะ monster) — ใช้สกิลรอง 1 ไม่ได้ระหว่างนี้
//  สกิลพื้นฐาน 2 UPG!: แทนสกิลพื้นฐาน 1 ระหว่างร่าง Ginga — เพดานแต้มจั่วไพ่ 20 (เดิม 16/19)
//  สกิลรอง 1 Ultlive Ultraman Ginga: ก่อนเปิดการ์ด แปลงร่าง Ginga 5 เทิร์น ตีหมู่ — เปลี่ยนสกิลพื้นฐานเป็น UPG!
//  สกิลรอง 2 ลำแสงสโตเรียม: แทนสกิลรอง 1 ระหว่างร่าง Ginga Strium — ดาเมจ = โจมตีปกติ(สูงสุด 4)+ลุกไหม้ที่เหลือ รวมไม่เกิน 8
//  ท่าไม้ตาย Ginga Strium: ต้องอยู่ในร่าง Ginga ตอนกลางวันเท่านั้น — แปลงร่าง 5 เทิร์น โจมตี+1 ลุกไหม้ตัวเอง 5
//    โจมตีโดนเป้าหมาย = ลุกไหม้เป้าหมาย +2 — เปลี่ยนสกิลรองเป็นลำแสงสโตเรียม
//  สกิลติดตัว 2 หัวใจที่ลุกไหม้: ระหว่างร่าง Ginga Strium ลุกไหม้ที่เกิดกับตัวเองรักษาแทนสร้างความเสียหาย
// ค่าคงที่ของฮิคารุส่วนใหญ่ย้ายไปอยู่ characters/hikaru.js แล้ว — เหลือแค่ที่ shared infra ในไฟล์นี้ยังใช้อยู่
const HIKARU_MONSTER_ARMOR_BONUS = 2; // MonsterLive: เพดานเกราะ +2 (maxArmorOf)
const HIKARU_STORIUM_ATK_CAP = 4;     // ลำแสงสโตเรียม: นับดาเมจจากการโจมตีปกติสูงสุด 4 (doAttack's shared damage-sum — นอกขอบเขต Phase 1)
const HIKARU_STORIUM_TOTAL_CAP = 8;   // ลำแสงสโตเรียม: ดาเมจรวมสูงสุด 8 (doAttack's shared damage-sum — นอกขอบเขต Phase 1)
const HIKARU_STRIUM_IMG = "/characters/hikaru/hikaru_update/ginga_strium.jpg"; // โปรไฟล์ระหว่างร่าง Ginga Strium (displayImg/TRANSFORMS)

// ---------- ระบบกลางวัน/กลางคืน (patch 1.7 / ปรับเวลา+โบนัส patch 2.1.7) ----------
//  เริ่มเกมเป็นกลางวันเสมอ สลับทุก 5 เทิร์น: รอบ 1-5 กลางวัน, 6-10 กลางคืน, 11-15 กลางวัน, ...
//  จบเทิร์นกลางวัน = ทุกคนได้แต้มสกิลเพิ่ม +1 แต่แจกเฉพาะเช้าที่ 2, 4, 6, ... (เช้าที่ 1, 3, 5, ... ไม่มีโบนัส — ดู morningBonusActive)
//  กลางคืน = สุ่มสกิลพื้นฐาน/สกิลรองของแต่ละคนแพงขึ้น +1 ทุกเทิร์น (ดู nightTaxTier) — เกราะฟื้นทุก 2 เทิร์นเหมือนกันทั้งวัน/คืน
//  cycleShift: Lie Like Vortigern รีเซ็ตเวลากลางคืนให้เหลืออีก 5 เทิร์น — เลื่อนวงจรทั้งเกมไปข้างหน้า
const CYCLE_TURNS = 5;

// ---------- Bard : คีตกวี (patch 2.2) ----------
// "โลหิตคือทำนอง วิญญาณคือบทกวี และทุกชีวิตล้วนเป็นเพียงโน้ตตัวหนึ่งในบทเพลงอันนิรันด์"
const BARD_MAX_SKILL = 9;         // Crescendo: พลังงานสูงสุด 9 (ตัวอื่น 8)
const BARD_NOTES_PER_TURN = 2;    // จำกัด 2 โน้ตต่อเทิร์น (patch 2.0.5)
const BARD_DIM_NOTES_PER_TURN = 6; // ระหว่างมิติมายาบรรเลง (โลหิต/วิญญาณ patch 2.0.8): ไม่ติดลิมิต 2 — กดสกิลได้สูงสุด 6 ครั้งต่อเทิร์น
const BARD_NOTE_COST = 1;         // ค่าใช้พลังงานต่อโน้ต (patch 2.0.5 — ลดจาก 2)
const BARD_NOTE_FREE_CHANCE = 0.15; // โอกาส 15% ที่จะไม่เสียพลังงานเมื่อใช้โน้ต (patch 2.0.6 — ลดจาก 20%)
const BARD_DIM_FORTUNE = 1;         // มิติมายาบรรเลง (patch 2.0.8): คีตกวีได้โชคลาภ 1 ครั้ง (ทั้งสองมิติ)
const BARD_DIM_EVADE = 1;           // มิติมายาบรรเลง (patch 2.0.8): คีตกวีได้หลบหลีก 1 ครั้ง (ทั้งสองมิติ)
const BARD_DIM_RESIST_TURNS = 3;    // มิติมายาบรรเลง (patch 2.0.8): คีตกวีได้ต้านสถานะผิดปกติ 3 เทิร์น
const BARD_BLOOD_FRAGILE = 1;       // มิติโลหิต (patch 2.0.8): ทุกคน (ยกเว้นคีตกวี) ติดเปราะบาง +1 ดาเมจ 3 เทิร์น
const BARD_FORTUNE_MAX = 3;         // โชคลาภ ซ้อนทับได้สูงสุด 3 ครั้ง (patch 2.0.6.1)
// โชคลาภ (patch 2.2 new — ปรับใหม่): จั่วปุ๊ป ถ้ามีบัฟสะสมอยู่ ใช้ 1 หน่วยทันทีแล้วหายไป
//  ปรับไพ่ที่จั่วให้แต้มรวมตกอยู่ 19-21 (ดู fortuneTargetList) — ไม่มีเงื่อนไขโอกาส/แต้มเริ่มต้นแล้ว
const BARD_SOUL_TARGETS = 2;        // มิติวิญญาณ: ทุกการบรรเลง ตีสุ่มผู้เล่น 2 คน (patch 2.0.6 — เดิมตีทุกคน)
const BARD_SECTION_MAX = 5;       // ท่อนทำนองสะสมครบ 5 ชั้น -> เปิดมิติมายาบรรเลง
const BARD_DIM_TURNS = 3;         // มิติมายาบรรเลงคงอยู่ 3 เทิร์น
const BARD_SOUL_PERFORM_DMG = 1;  // มิติวิญญาณ (patch 2.0.5): ทุกการบรรเลง Bard ตีทุกคน 1 หน่วย
const BARD_PROFILE_IMG = "/characters/bard/bard_new.jpg"; // patch 2.1.1: เปลี่ยนรูปประจำตัวคีตกวี
const BARD_CRIMSON_IMG = "/characters/bard/bard_crimson.png";
const BARD_JADE_IMG = "/characters/bard/bard_jade.png";
// บทเพลงทั้ง 8 (R = ❤️ Crimson, J = 💚 Jade) — need = จำนวนเป้าหมาย, allowSelf = เลือกตัวเองได้
// (patch 2.0.5: สลับผังบทเพลงใหม่ — สายเพลงนับจากโน้ตเสียงข้างมาก)
const BARD_SONGS = {
  RRR: { name: "Encore", song: "crimson", need: 1, allowSelf: true },           // หลบหลีก +100% โดนโจมตี 1 ครั้งถัดไป
  RRJ: { name: "Silent Cadence", song: "crimson", need: 1, allowSelf: false },  // ใบ้สกิล 1 เทิร์น + ขโมยพลังงาน 1
  RJR: { name: "Fate's Prelude", song: "crimson", need: 1, allowSelf: true },   // โชคลาภในการจั่วครั้งถัดไป
  JRR: { name: "Rejuvenation", song: "crimson", need: 1, allowSelf: true },     // HP +1 / เกราะ +1 / พลังงาน +1
  JJJ: { name: "Sanctuary Hymn", song: "jade", need: 1, allowSelf: true },      // ต้านสถานะผิดปกติ 3 เทิร์น
  JJR: { name: "Resonance", song: "jade", need: 2, allowSelf: true },           // เชื่อมผล 3 เทิร์น
  JRJ: { name: "Discord", song: "jade", need: 1, allowSelf: false },            // ขัดแย้ง +1 ดาเมจ 3 เทิร์น
  RJJ: { name: "Harmony", song: "jade", need: 1, allowSelf: true },             // คุ้มครอง -1 ดาเมจ 3 เทิร์น
};
// ---------- เรียวกิ ชิกิ (patch 2.0.5 / rework 2.0.6) ----------
// ค่าคงที่ของชิกิเองส่วนใหญ่ย้ายไปอยู่ characters/shiki.js แล้ว — เหลือแค่ที่ shared infra ในไฟล์นี้ยังใช้อยู่
const SHIKI_DEATHLINE_MAX = 6;   // เส้นชีวิตสะสมถึง 6 -> โจมตีปกติระหว่างท่าไม้ตาย 1 = สังหารทันที (ใช้เป็น gate ก่อนเรียก CHAR_HOOKS.shiki)
const SHIKI_WITHER_PASSIVE_CAP = 2; // โหมดท่าไม้ตาย 2: สกิลติดตัว/สกิลรอง ให้เส้นชีวิตได้สูงสุด 2 หน่วย (ใช้ใน shikiGiveLifeline — shared กับ tepeu/phenex)
const SHIKI_WITHER_ATK_CAP = 5;  // ความตายที่โรยรา: เส้นชีวิตแปรเป็นดาเมจเสริมการโจมตีปกติ — พลังโจมตีรวมสูงสุด 5 ต่อครั้ง (คำนวณใน doAttack()'s shared damage-sum — นอกขอบเขต Phase 1)
const SHIKI_PROFILE_IMG = "/characters/shiki/shiki.jpg";
const SHIKI_DEATH_IMG = "/characters/shiki/shiki_death.jpg"; // ร่างระหว่างท่าไม้ตาย ฉันมองเห็นมันแล้ว
const SHIKI_WITHER_IMG = "/characters/shiki/shiki2.jpg";     // ร่างระหว่างท่าไม้ตาย 2 ความตายที่โรยรา
// เจ้าหญิงราก (patch 2.2.7): รูปที่ใช้บนป้ายสรุปการโจมตีตอน "เนตรมณะ" สังหารสำเร็จ (สถานะ Universal ใช้ร่วมทุกตัวละคร)
const PSHIKI_ULT_IMG = "/characters/princess_shiki/p_shiki_skill3.jpg";
// แบทแมน (patch 2.2.7): รูปที่ใช้บนป้ายสรุปการโจมตีตอนล่อเป้า/สะท้อนความเสียหาย
const BAT_SKILL3_IMG = "/characters/bat_ben/bat_ben_skill3.jpg";
// ---------- โทโนะ ชิกิ (patch 2.1.7) ----------
// ค่าคงที่/logic ส่วนใหญ่ย้ายไปอยู่ characters/tohno.js แล้ว — เหลือแค่ภาพที่โค้ดส่วนกลาง (TRANSFORMS/displayImg) ยังใช้อยู่
const TOHNO_DEATH_IMG = CHAR_HOOKS.tohno.DEATH_IMG; // ร่างระหว่างถือ "หลับให้สบาย"
// ---------- อาริมะ มิยาโกะ (patch 2.2.0) ----------
// ค่าคงที่ของมิยาโกะส่วนใหญ่ย้ายไปอยู่ characters/miyako.js แล้ว — เหลือแค่ที่ shared infra ในไฟล์นี้ยังใช้อยู่
const MIYAKO_KILL_REDUCE = 0.40;      // นั่นพี่จ๋าหรอ?: ลดโอกาสถูกสังหารทันทีลง 40% ทุกครั้งที่รอด (สะสม — ใช้ใน miyakoKillChance shared infra)
// ท่าไม้ตายที่ยกเลิกย้อนหลังได้ (เจ้าของท่ามาตีชิกิระหว่างถือชาร์จ) — สถานะท่าไม้ตายที่กำลังมีผลอยู่
const SHIKI_CANCELABLE_ULTS = ["gingastrium", "chill",
  "kready", "deatheye", "wither",
  "anata",                  // patch 2.0.8: เพิ่ม ANATA WAAAAAAAA (เทมาริ) — ครอบคลุมท่าไม้ตายทุกตัวละครที่เก็บเป็นสถานะ
  "bloodDim", "soulDim",    // patch 2.0.8.1: มิติมายาบรรเลงทั้งสอง (คีตกวี) นับเป็นท่าไม้ตาย — ยกเลิกย้อนหลังได้
  "victorybeat", "ashen",   // patch 2.0.8.1: ท่าไม้ตายโอกูริ แคป ทั้งสองท่า
  "phenexNtd", "phenexTaunt", // patch 2.1.6: ท่าไม้ตายริต้า เบอร์นัล ทั้งสองท่า
  "batTaunt",                 // patch 2.2.7: เข้ามาเลย (แบทแมน)
  "pshikiUlt",                // patch 2.2.7: ทุกอย่างจะต้องราบรื่น (เจ้าหญิงราก)
  "harukaOmega",               // patch 2.5: New Omega (มิซึซาว่า ฮารุกะ) — สถานะล้วน ลบทิ้งได้ตรงๆ ไม่มี mirror ต้องเก็บกวาด
  "muimiTower"];               // มุยมิ: สถานะ “ดาบสะบั้น” จากดาบสะบั้นหอคอยสวรรค์
// เทเปา: นายเป็นคนทำตัวเองนะ — ตรรกะย้ายไปอยู่ characters/tepeu.js ทั้งหมดแล้ว (ดู resolveAllKills)

// ---------- โอกูริ แคป (patch 2.0.8.1) ----------
//  ระบบ Stamina: เริ่มเกมได้ 8 แต้ม (สะสมสูงสุด 16) — ใช้เป็นทรัพยากรของสกิลรอง/ท่าไม้ตาย
//  ยุคทอง (goldenera): พลังโจมตี +1 / เพดานเกราะ +1 — สะสม 2 แต้ม อยู่ 3 เทิร์น หายเมื่อฝึกฝนล้มเหลว
//  ครบ 2 แต้ม -> เข้าร่าง Zone (GrayBeast: Stamina +1/เทิร์น, แต้มสกิล +1 ทุก 2 เทิร์น)
//  Stamina หมด + ไม่มียุคทอง -> ร่างหมดแรง (Burnout: ใช้ได้แค่ A Big Meal)
// ---------- โอกูริ แคป (Rework): Energy (ทรัพยากรของสกิล) + Stamina ชาร์จ (ทรัพยากรท่าไม้ตาย แยกกัน) ----------
const OGURI_ENERGY_START = 8;      // Energy: เริ่มเกมได้รับ 8 แต้ม
const OGURI_ENERGY_MAX = 16;       // Energy สะสมสูงสุด
const OGURI_CHARGE_BASE_CAP = 52;  // Stamina ชาร์จ: ความจุพื้นฐาน
const OGURI_CHARGE_CAP_MAX_BONUS = 48; // Training: เพิ่มความจุได้สูงสุดสะสม +48 (รวมเพดานสูงสุด 100)
const OGURI_GOLD_MAX = 3;          // ยุคทอง สะสมสูงสุด (Rework: เดิม 2 -> 3)
const OGURI_GOLD_ARMOR_AT = 2;     // ยุคทอง: ครบ 2 แต้มขึ้นไป ได้เพดานเกราะ +1 (Rework — เดิมแค่มียุคทองก็ได้แล้ว)
const OGURI_TRAIN_ENERGY_COST = 4; // Training: หัก Energy 4 (เดิมหัก Stamina)
const OGURI_ULT_CHARGE_COST = 35;  // The Beat of Victory: Stamina ชาร์จ 35
const OGURI_ULT_ATK_BONUS = 2;     // ชนะ: พลังโจมตีพื้นฐาน +2 (ซ้อนทับกับยุคทองได้)
const OGURI_ULT2_CHARGE_COST = 80; // Ashen Trail: Stamina ชาร์จ 80 (ต้องมียุคทองครบด้วย) — Rework: เดิม 75
const OGURI_ZONE_IMG = "/characters/oguri/zone_form.jpg";

// ---------- ซาโตรุ อาเคฟุ (universal-wrapper — ตรรกะจริงอยู่ characters/satoru.js) ----------
//  satoruOnTargeted() ถูกเรียกจากตัวละครอื่นแทบทุกตัวในเกม (engine.satoruOnTargeted) ก่อนใส่ผลสกิล/
//  ดาเมจใส่เป้าหมาย เพื่อให้สกิลติดตัวซาโตรุทำงานได้แม้ผู้เรียกไม่รู้จักซาโตรุเลย — ห้ามลบ wrapper นี้
const SATORU_PROFILE_IMG = "/characters/satoru/satoru.jpg";

// ---------- ริต้า เบอร์นัล / ฟีนิกซ์ (patch 2.1.6) ----------
// ค่าคงที่ของฟีนิกซ์ส่วนใหญ่ย้ายไปอยู่ characters/phenex.js แล้ว — เหลือแค่ที่ shared infra ในไฟล์นี้ยังใช้อยู่
const PHENEX_BAN_ULT_TURNS = 3;   // อย่าอยู่เลย แกน่ะ!: ไม่มีท่าไม้ตายให้ลบ -> แบนท่าไม้ตายเป้าหมาย 3 เทิร์นแทน (purge resolution — ยังอยู่ server.js เพราะเรียก shiki's shared infra)
const PHENEX_BASE_IMG = "/characters/rita/profile/phenex.png";     // ภาพเริ่มเกม (ลงสนามแล้ว) ปกติ (displayImg/TRANSFORMS)
const PHENEX_NTD_IMG = "/characters/rita/profile/phenex_ntd.png";  // ระหว่างฝืนใช้งาน NTD-Sytem (displayImg/TRANSFORMS/fx)

// ร่างกลางวัน/กลางคืนของโอเบรอน (สลับอัตโนมัติตามช่วงเวลา)

// การแปลงร่าง/cutscene ต่อสถานะ — ตาราง data ล้วนๆ ~160 บรรทัด ย้ายไป characters/_transforms.js แล้ว
//  (factory function รับ path รูปที่ server.js ใช้ร่วมกับที่อื่นด้วย กันประกาศ path ซ้ำสองที่)
const TRANSFORMS = require("../characters/_transforms")({
  HIKARU_STRIUM_IMG, BARD_PROFILE_IMG,
  SHIKI_DEATH_IMG, SHIKI_PROFILE_IMG, SHIKI_WITHER_IMG, TOHNO_DEATH_IMG, OGURI_ZONE_IMG,
  PHENEX_NTD_IMG, PHENEX_BASE_IMG,
});

// ---------- โหมด Type Mercury (Raid Boss ORT) ----------
//  ผู้เล่นจริงทุกคนเป็นทีมเดียวกันสู้กับบอส ORT (ผู้เล่นปลอม id ORT_ID ที่นั่ง 8 — ตรรกะอยู่ characters/ort.js)
//  ตายแล้วกลับไปเลือกตัวละครใหม่ได้ เข้าสนามต้นเทิร์นถัดไป · ตัวละครที่ตายแล้ว "ข้อมูลสูญหาย" เลือกซ้ำไม่ได้ทั้งห้อง
const ORT_ID = "__ort__";
const ORT_POSITION = 8;
// ฉากเปิดตัว ORT ฝั่ง client (OrtArrival) ยาว 13.3 วิ — พักไว้ 15 วิ เผื่อเน็ตหน่วง/เครื่องช้า ให้ฉากจบก่อน
//  วีดีโอเปิดตัวของตัวละคร (คอนเนอร์/ไรเดอร์ Zect ฯลฯ) ที่คิวไว้จะเล่นต่อ "หลัง" ช่วงนี้เสมอ · เทสต์ย่อได้ผ่าน env
const MERCURY_ARRIVAL_SECONDS = Math.max(1, Number(process.env.MERCURY_ARRIVAL_SECONDS) || 15);
const MERCURY_SURRENDER_SECONDS = 20;
const ORT_ATTACK_DELAY = 2; // ORT ชนะรอบ: ค้างเฟสโจมตีไว้ให้เห็นเป้าหมายก่อนลงมือ (วินาที)
// โหมดปกติ (ffa/duo/trio) ไม่มี ORT บุกเทิร์น 60 แล้ว — ภูมิภาคที่ 7 ของการเดินทางเป็นตัวบีบให้เกมจบแทน
// ฉากแผนที่การเดินทาง (characters/_journey.js): server พักเกมในเฟส CUTSCENE (ไม่มีคลิป) ให้ทุกคนดูพร้อมกัน
//  start = หลังฉากเปิดตัวผู้เล่นตอนเริ่มเกม · advance = ก่อนเข้าเทิร์นแรกของภูมิภาคใหม่ (11, 21, …, 61)
//  ความยาวฝั่ง client: start 7 วิ · advance 6 วิ (+1 วิเผื่อเน็ตหน่วง) — เทสต์ย่อได้ผ่าน env
//  start เริ่มตั้งแต่ฉากเปิดตัว "เริ่มปิดฉาก" (1 วิสุดท้ายของ gameIntroHoldSeconds + ส่วนเผื่อ ~1 วิ) จึงบวกเพิ่มแค่ 6 วิ
const JOURNEY_START_SECONDS = Math.max(0, Number(process.env.JOURNEY_START_SECONDS ?? 6));
const JOURNEY_ADVANCE_SECONDS = Math.max(0, Number(process.env.JOURNEY_ADVANCE_SECONDS ?? 7));
// ---------- โหมด Purge (server/modes/purge.js · กระดาน server/modes/purgeBoard.js) ----------
//  กระดาน 150 ช่อง + ทางแยก · ทอยเต๋าพร้อมกัน (เฟส PURGE_ROLL) · ปะทะ 2 รอบ แพ้/เสมอถอย 2 · เลือดหมดล้มลงถอย 2
//  ORT โผล่ช่อง 0 ตอนจบเทิร์นเต๋า 5 แล้วทอยเต๋า 2-7 ทุกเทิร์น · ได้เหรียญ +2 ทุกเทิร์น
//  ฉากเปิด client ~11 วิ (พัก 14) · ฉากซูมเข้าจุดปะทะ 3 วิ · เวลาทอย 25 วิ — เทสต์ย่อได้ผ่าน env
const PURGE_FIGHT_KNOCKBACK = 2;
const PURGE_KNOCKBACK = 2;
const PURGE_ORT_TURN = Math.max(1, Number(process.env.PURGE_ORT_TURN) || 5);
const PURGE_TURN_GOLD = 2;
const PURGE_INTRO_SECONDS = Math.max(0, Number(process.env.PURGE_INTRO_SECONDS ?? 14));
const PURGE_FIGHT_INTRO_SECONDS = Math.max(1, Number(process.env.PURGE_FIGHT_INTRO_SECONDS) || 3);
const PURGE_ROLL_SECONDS = Math.max(1, Number(process.env.PURGE_ROLL_SECONDS) || 25);
const TEAM_IDS = ["A", "B", "C"];

// ---------- ยูนะ ไอดอลประจำสนาม (characters/yuna.js — ไม่ใช่ตัวละครที่เล่นได้ ไม่มี p เป็นของตัวเอง) ----------
const YUNA_IMG = "/characters/yuna/yuna.png";
const YUNA_COLOR = "#c9a7ff";

const RESYNC_EVERY = 10; // ทุกกี่วินาทีถึงจะ broadcast state ตัวเต็ม (นอกนั้นส่งแค่ "tick")

module.exports = {
  SKILL_COST_MAX, MAX_PLAYERS, CARD_TIME, OVERLOAD_FORCE_CHANCE, OVERLOAD_FORCE_CUTSCENE_SECONDS,
  SUMMARY_TIME, ATTACK_TIME, TRANSITION_TIME, SERAPH_PLACE_SAFETY_SECONDS, RECONNECT_GRACE_MS,
  RESERVATION_TTL_MS, ATTACKFX_TIME, MAX_HP, MAX_ARMOR, MAX_SKILL, GOLD_MAX, GOLD_PER_TURN,
  GOLD_WIN_BONUS, SHOP_INTERVAL_TURNS, SHOP_MAX_ITEMS, SHOP_CARD_COLOR_PRICE, SHOP_FORTUNE_PRICE,
  SHOP_FORTUNE_AMOUNT, SHOP_RESIST_PRICE, SHOP_RESIST_TURNS, SHOP_ARMOR_PRICE, SHOP_ARMOR_AMOUNT,
  SHOP_CARD_REMOVE_PRICE, SHOP_SKILL_SIZES, ITEM_BASE, GUTS_GUN_PRICE, GUTS_CHAA_TURNS,
  GUTS_NURSE_DMG, BLACK_SPARKLENCE_NURSE_COOLDOWN, GUTS_AMMO, GUTS_AMMO_IDS, SHOP_MAX_GUNS,
  SHOP_MAX_HYPER, SHOP_MAX_MARK42, SHOP_AMMO_WEIGHTS, SHOP_WEIGHTS, DOOM_BASE, DOOM_WEAPONS,
  DOOM_WEAPON_IDS, DOOM_STARTING_WEAPON, DOOM_LOCKON_CHANCE, DOOM_EXPLODE_DMG,
  DOOM_EXPLODE_TARGETS, DOOM_LOCKON_BONUS, DOOM_ROCKET_BONUS_DMG, DOOM_BALLISTA_TARGET_DMG,
  DOOM_DRAIN_DMG, DOOM_DRAIN_TURNS, DOOM_CRUCIBLE_ATK, DOOM_CRUCIBLE_CHARGE_NEED, DOOM_HEAL_ON_ATK,
  DOOM_SHIELD_ON_ATK, DOOM_CHARGE_CHANCE, DOOM_TIE_ATTACK_CHANCE, DOOM_FORTUNE_CHANCE,
  DOOM_CRUCIBLE_BUST_DMG, DOOM_CRUCIBLE_BUST_DRAWS, DOOM_CRUCIBLE_BUST_BONUS, TAKUTO_STAR_NEED,
  TAKUTO_APPRIVOISE_TURNS, TAKUTO_LANCE_DMG, TEMP_HP_TURNS, HIKARU_MONSTER_ARMOR_BONUS,
  HIKARU_STORIUM_ATK_CAP, HIKARU_STORIUM_TOTAL_CAP, HIKARU_STRIUM_IMG, CYCLE_TURNS, BARD_MAX_SKILL,
  BARD_NOTES_PER_TURN, BARD_DIM_NOTES_PER_TURN, BARD_NOTE_COST, BARD_NOTE_FREE_CHANCE,
  BARD_DIM_FORTUNE, BARD_DIM_EVADE, BARD_DIM_RESIST_TURNS, BARD_BLOOD_FRAGILE, BARD_FORTUNE_MAX,
  BARD_SOUL_TARGETS, BARD_SECTION_MAX, BARD_DIM_TURNS, BARD_SOUL_PERFORM_DMG, BARD_PROFILE_IMG,
  BARD_CRIMSON_IMG, BARD_JADE_IMG, BARD_SONGS, SHIKI_DEATHLINE_MAX, SHIKI_WITHER_PASSIVE_CAP,
  SHIKI_WITHER_ATK_CAP, SHIKI_PROFILE_IMG, SHIKI_DEATH_IMG, SHIKI_WITHER_IMG, PSHIKI_ULT_IMG,
  BAT_SKILL3_IMG, TOHNO_DEATH_IMG, MIYAKO_KILL_REDUCE, SHIKI_CANCELABLE_ULTS, OGURI_ENERGY_START,
  OGURI_ENERGY_MAX, OGURI_CHARGE_BASE_CAP, OGURI_CHARGE_CAP_MAX_BONUS, OGURI_GOLD_MAX,
  OGURI_GOLD_ARMOR_AT, OGURI_TRAIN_ENERGY_COST, OGURI_ULT_CHARGE_COST, OGURI_ULT_ATK_BONUS,
  OGURI_ULT2_CHARGE_COST, OGURI_ZONE_IMG, SATORU_PROFILE_IMG, PHENEX_BAN_ULT_TURNS,
  PHENEX_BASE_IMG, PHENEX_NTD_IMG, TRANSFORMS, ORT_ID, ORT_POSITION, MERCURY_ARRIVAL_SECONDS,
  MERCURY_SURRENDER_SECONDS, ORT_ATTACK_DELAY, JOURNEY_START_SECONDS, JOURNEY_ADVANCE_SECONDS,
  PURGE_FIGHT_KNOCKBACK, PURGE_KNOCKBACK, PURGE_ORT_TURN, PURGE_TURN_GOLD, PURGE_INTRO_SECONDS,
  PURGE_FIGHT_INTRO_SECONDS, PURGE_ROLL_SECONDS,
  TEAM_IDS, YUNA_IMG, YUNA_COLOR, RESYNC_EVERY,
};
