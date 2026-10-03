// ต่อสู้: เลือด/เกราะ/ดาเมจ/ฮีล/บัฟ-ดีบัฟ/ตายทันที/รีเซ็ตผู้เล่น
// export ก่อน require: ไฟล์ใน server/ require วนกันเอง — function declaration ถูก hoist จึงพร้อมใช้ตั้งแต่บรรทัดแรก
Object.assign(module.exports, {
  maxHpOf, healHp, healArmor, maxSkillOf, linkedBuddyOf, withExplicitTargets, sameTeam,
  friendlyEffectBlocked, withEffectSource, hisakawaSyncOut, applyBuff, applyDebuff,
  applySpellburden, alivePlayers, overloadCanSafelyDraw, resetOverloadDrawCounter, songActive,
  maxArmorOf, sealActive, beatActive, maybeBeatMode, maybeBeatSave, instantDeath,
  resolveDamageAftermath, healOverflow, loseHp, applyOverloadOverdrawPenalty, loseArmor,
  damageSoft, mageslayerMarkSteal, tryYunaLongingForTwin, dealDirect, dealArmorOnly, dealMixed,
  addSkill, applyEffect, firePassive, skillByStatus, shikiCancelUltimate, voidUltimateOnBust,
  resetRoundDisplay, resetCombat,
});

const { CHAR_BY_ID } = require("../characters");
const CHAR_HOOKS = require("../characters/index");
const {
  applyBuff: rawApplyBuff, applyDebuff: rawApplyDebuff, applySpellburden: rawApplySpellburden,
  coolReduction, noHealActive, invertActive, bleedHealPenalty,
} = require("../characters/_universal_status");
const YunaMod = require("../characters/yuna");
const Mark42 = require("../characters/_mark42");
const Seraph = require("../seraph");
const { io } = require("./app");
const {
  BARD_MAX_SKILL, DOOM_STARTING_WEAPON, HIKARU_MONSTER_ARMOR_BONUS, MAX_ARMOR, MAX_HP, MAX_SKILL,
  OGURI_ENERGY_START, OGURI_GOLD_ARMOR_AT, SHIKI_PROFILE_IMG, TEMP_HP_TURNS, TRANSFORMS,
} = require("./constants");
const match = require("./match");
const { engine } = require("./engine");
const characterRules = require("./characterRules");
const cardDeck = require("./deck");
const lobby = require("./lobby");
const mercury = require("./modes/mercury");
const purge = require("./modes/purge");
const qteSystem = require("./qte");
const view = require("./view");

// ผลของบทเพลงแต่ละแบบ / มิติมายาบรรเลง — ย้าย body ไป characters/bard.js แล้ว (ดู CHAR_HOOKS.bard)

// เลือดจริงสูงสุดของผู้เล่น — Locacaca fruit (ซาโตรุ patch 2.0.8.2) ลด Max HP ได้ (ต่ำสุด 1)
function maxHpOf(p) {
  if (mercury.isOrt(p)) return CHAR_HOOKS.ort.maxHp(); // ORT: เลือดต่อ 1 หลอด (จำนวนหลอดอยู่ที่ p.ortBars)
  // SE.RA.PH: ค่าพลังเดิมของทุกตัวละครถูกละทิ้ง — ใช้ความจุที่อัปที่โบสถ์เท่านั้น (§14 ข้อ 4)
  if (Seraph.active() && p) return Seraph.maxHp(p);
  if (p && p.characterId === "escanor") {
    const escanorHp = CHAR_HOOKS.escanor.maxHp(p);
    if (escanorHp != null) return Math.max(1, escanorHp - ((p.maxHpPenalty) || 0));
  }
  if (p && p.characterId === "hisakawa_sister") return CHAR_HOOKS.hisakawa_sister.maxHp(p);
  // เอจิ (patch 2.4 new): พลังชีวิตพื้นฐาน 4 หน่วย (แทน MAX_HP ปกติ)
  if (p && p.characterId === "eiji") return Math.max(1, CHAR_HOOKS.eiji.maxHp() - ((p.maxHpPenalty) || 0));
  // มาคุโนะอุจิ อิปโป (patch 3.3 new): พลังชีวิตพื้นฐาน 5 หน่วย
  if (p && p.characterId === "ippo") return Math.max(1, CHAR_HOOKS.ippo.maxHp() - ((p.maxHpPenalty) || 0));
  // ผู้วิงวอน (patch 3.4 new): พลังชีวิตพื้นฐาน 5 หน่วย
  if (p && p.characterId === "the_supplicant") return Math.max(1, CHAR_HOOKS.the_supplicant.maxHp() - ((p.maxHpPenalty) || 0));
  // โปรดิวเซอร์ (patch 3.6): หลอดเลือดเป็นของ "ไอดอล" (5) ตอนยืนอยู่ และเป็นของ "โปรดิวเซอร์" (3) เมื่อไอดอลล้ม
  if (p && p.characterId === "producer_lumi") return Math.max(1, CHAR_HOOKS.producer_lumi.maxHp(p) - ((p.maxHpPenalty) || 0));
  // Bamboo-Hatted Kim: พลังชีวิตพื้นฐาน 8 หน่วย
  if (p && p.characterId === "kim") return Math.max(1, CHAR_HOOKS.kim.maxHp() - ((p.maxHpPenalty) || 0));
  // Recruit: พลังชีวิตพื้นฐาน 5 หน่วย
  if (p && p.characterId === "recruit") return Math.max(1, CHAR_HOOKS.recruit.maxHp() - ((p.maxHpPenalty) || 0));
  // อาซาฮินะ ทักต์ (ตระกูลอาซาฮินะ): พลังชีวิตพื้นฐาน 5 หน่วย
  if (p && p.characterId === "takt") return Math.max(1, CHAR_HOOKS.takt.maxHp() - ((p.maxHpPenalty) || 0));
  // สไตรเกอร์ ยูเรก้า: พลังชีวิตพื้นฐาน 12 หน่วย
  if (p && p.characterId === "striker") return Math.max(1, CHAR_HOOKS.striker.maxHp() - ((p.maxHpPenalty) || 0));
  // ดิโอ แบรนโด: พลังชีวิตพื้นฐาน 6 หน่วย
  if (p && p.characterId === "dio") return Math.max(1, CHAR_HOOKS.dio.maxHp() - ((p.maxHpPenalty) || 0));
  return Math.max(1, MAX_HP - ((p && p.maxHpPenalty) || 0));
}
// ฟื้นเลือดจริงแบบเคารพสถานะ "ไม่ใช้งานต่อ" / "ไร้ทางเยียวยา" — คืนจำนวนที่ฟื้นได้จริง
// เชื่อมผล (patch 2.0.8): การเพิ่ม HP ถูกแชร์ให้คู่เชื่อมเท่ากันด้วย
// ผกผัน (patch 2.2.1): การฟื้นเลือดกลับกลายเป็นเสียเลือดแทน (ไม่สนเกราะ)
function healHp(p, amount) {
  if (invertActive(p)) {
    dealDirect(p, amount);
    match.lastLog.push(`🔄 ${p.name} ผกผัน — พลังชีวิตที่ควรฟื้น +${amount} กลับกลายเป็นเสียพลังชีวิต -${amount} แทน (ไม่สนเกราะ)`);
    if (p.alive && p.hp <= 0) { instantDeath(p); if (!p.alive) match.lastLog.push(`💀 ${p.name} เลือดจริงหมด ตกรอบ!`); }
    return 0;
  }
  if (noHealActive(p)) return 0;
  // เลือดไหล (hbleed, สถานะ Universal patch 2.5): การฟื้นพลังชีวิตเหลือครึ่งเดียว
  //  (ฟื้นทีละ 1 หน่วยไม่ถูกลด · ฮารุกะไม่โดนผลนี้ — ตรรกะเต็มอยู่ characters/_universal_status.js)
  amount = bleedHealPenalty(engine, p, amount);
  const heal = Math.min(maxHpOf(p) - p.hp, amount);
  if (heal > 0) { p.hp += heal; hisakawaSyncOut(p); }
  if (heal > 0 && !match.linkMirror) {
    const buddies = linkedBuddiesOf(p);
    match.linkMirror = true;
    for (const b of buddies) {
      const bh = healHp(b, heal);
      if (bh > 0) match.lastLog.push(`🔗 เชื่อมผล — ${b.name} ฟื้นพลังชีวิตตาม ${p.name} +${bh}`);
    }
    match.linkMirror = false;
  }
  return heal;
}
// ฟื้นเกราะแบบเคารพเพดาน — คืนจำนวนที่ฟื้นได้จริง
// เชื่อมผล (patch 2.1.1): การฟื้นเกราะถูกแชร์ให้คู่เชื่อมเท่ากันด้วย
// ผกผัน (patch 2.2.1): การฟื้นเกราะกลับกลายเป็นเสียเกราะแทน
function healArmor(p, amount) {
  if (CHAR_HOOKS.recruit.blocksArmorHeal(p)) return 0; // Recruit [Armor]: ฟื้นไม่ได้จากทุกแหล่ง
  if (invertActive(p)) {
    if (friendlyEffectBlocked(p)) return 0;
    const lost = Math.max(0, Math.min(p.armor, amount));
    if (lost > 0) {
      p.armor -= lost;
      hisakawaSyncOut(p);
      match.lastLog.push(`🔄 ${p.name} ผกผัน — เกราะที่ควรฟื้น +${amount} กลับกลายเป็นเสียเกราะ -${lost} แทน`);
    }
    return 0;
  }
  const heal = Math.max(0, Math.min(maxArmorOf(p) - p.armor, amount));
  if (heal > 0) { p.armor += heal; hisakawaSyncOut(p); }
  if (heal > 0 && !match.linkMirror) {
    const buddies = linkedBuddiesOf(p);
    match.linkMirror = true;
    for (const b of buddies) {
      const bh = healArmor(b, heal);
      if (bh > 0) match.lastLog.push(`🔗 เชื่อมผล — ${b.name} ฟื้นเกราะตาม ${p.name} +${bh}`);
    }
    match.linkMirror = false;
  }
  return heal;
}
// พลังงานสูงสุดของผู้เล่น (Bard = 9)
function maxSkillOf(p) {
  if (mercury.isOrt(p)) return 0; // ORT ไม่มีแต้มสกิล
  if (Seraph.active() && p) return Seraph.maxSkill(p); // SE.RA.PH: ความจุแต้มสกิลเริ่ม 4 เพิ่มได้ถึง 8 ที่โบสถ์
  if (p && p.characterId === "striker") return CHAR_HOOKS.striker.maxSkill(); // สไตรเกอร์ ยูเรก้า: แต้มสกิลสูงสุด 16
  return (p && p.characterId === "bard") ? BARD_MAX_SKILL : MAX_SKILL;
}

// ============================================================
//  บัฟ & ดีบัฟพื้นฐาน (universal) — ย้าย body ไป characters/_universal_status.js แล้ว
//  (resistActive/applyDebuff/applyBuff/statusAmtOf/cleanseDebuffs/noHealActive/invertActive/
//   SPELLBURDEN_MAX/BASIC_DEBUFF_CLEAR/SOFT_DEBUFF_STEP — require() ไว้ด้านบนไฟล์นี้แล้ว)
// ============================================================
// เชื่อมผล (linked): คู่เชื่อมที่ยังมีผลอยู่ทั้งสองฝั่ง (การเพิ่ม-ลด HP แชร์เท่ากัน)
function linkedBuddiesOf(p) {
  const bardBuddies = CHAR_HOOKS.bard.linkedBuddiesOf(engine, p);
  const kaiBuddy = CHAR_HOOKS.kai.kaiLinkedBuddyOf(engine, p);
  const all = kaiBuddy ? [...bardBuddies, kaiBuddy] : bardBuddies;
  return all.filter((buddy, index) => all.findIndex((x) => x.id === buddy.id) === index);
}
function linkedBuddyOf(p) {
  return linkedBuddiesOf(p)[0] || null;
}
function withExplicitTargets(actorId, ids, fn) {
  const prevIds = match.explicitTargetIds, prevActor = match.explicitActorId;
  const list = (ids || []).filter((x) => x && x !== actorId);
  if (mercury.mercuryActive() && actorId && list.length) { match.explicitTargetIds = new Set(list); match.explicitActorId = actorId; }
  try { return fn(); } finally { match.explicitTargetIds = prevIds; match.explicitActorId = prevActor; }
}
function sameTeam(a, b) {
  // Type Mercury: ผู้เล่นจริงทุกคนเป็นพวกเดียวกัน (ตีกันเองไม่ได้ · เอฟเฟกต์ลบใส่กันไม่ได้) — ศัตรูมีแค่ ORT
  //  ยกเว้นเป้าที่ผู้เล่นกดเลือกเองในสกิล/ไอเทมที่กำลังทำงาน (explicitTargetIds) — ผลจึงลงเพื่อนได้ตามที่ตั้งใจ
  if (mercury.mercuryActive()) {
    if (!a || !b || a.id === b.id || mercury.isOrt(a) || mercury.isOrt(b)) return false;
    if (match.explicitTargetIds && ((a.id === match.explicitActorId && match.explicitTargetIds.has(b.id)) || (b.id === match.explicitActorId && match.explicitTargetIds.has(a.id)))) return false;
    return true;
  }
  // อาซาฮินะ ทักต์: โหมดอิสระ ทักต์กับมิวสิคคาร์ทในพันธะเป็นพวกเดียวกัน (โหมดทีมผูกได้เฉพาะเพื่อนร่วมทีมอยู่แล้ว)
  if (!lobby.teamModeActive() && match.gameMode === "ffa" && CHAR_HOOKS.takt.bonded(engine, a, b)) return true;
  return !!(lobby.teamModeActive() && a && b && a.id !== b.id && a.teamId && b.teamId && a.teamId === b.teamId);
}
function friendlyEffectBlocked(target) {
  const source = match.effectSourceId && match.players[match.effectSourceId];
  return !!(source && target && sameTeam(source, target));
}
function withEffectSource(source, fn) {
  const prev = match.effectSourceId;
  match.effectSourceId = typeof source === "string" ? source : (source && source.id) || null;
  try { return fn(); }
  finally { match.effectSourceId = prev; }
}
// รีเฟรชเลือด/เกราะจากแฝดที่คุมอยู่ก่อนแตะค่าเหล่านั้น — ตั้งใจไม่แตะ p.statuses
//  (p.statuses คือแหล่งความจริงระหว่างเทิร์น การ syncIn เต็มรูปแบบตรงนี้จะล้างสถานะที่ engine
//   เขียนใส่ตรงๆ ทิ้ง เช่น nodraw/noskill/stagger ตอน dealRound, ไอเทมร้านค้า, freecast, dawn)
function hisakawaSyncIn(p) {
  if (p && p.characterId === "hisakawa_sister") CHAR_HOOKS.hisakawa_sister.syncVitals(p);
}
function hisakawaSyncOut(p) {
  if (p && p.characterId === "hisakawa_sister") CHAR_HOOKS.hisakawa_sister.syncOut(p);
}
function applyBuff(p, key, amount, turns) {
  hisakawaSyncIn(p);
  rawApplyBuff(p, key, amount, turns);
  hisakawaSyncOut(p);
}
function applyDebuff(p, key, amount, turns) {
  p = CHAR_HOOKS.johnny.redirectEffect(engine, p); // หมุนวน: การหมุนย้อนกลับ — ดีบัฟของสกิลนั้นลงผู้ใช้เอง
  if (friendlyEffectBlocked(p)) return false;
  if (CHAR_HOOKS.johnny.blocksDebuff(engine, p, key)) return false; // จอห์นนี่ Slow Dancer: กันดีบัฟจากศัตรู
  hisakawaSyncIn(p);
  const ok = rawApplyDebuff(p, key, amount, turns);
  hisakawaSyncOut(p);
  return ok;
}
// ภาระเวท (spellburden) — จุดเดียวที่ทุกตัวละคร/ทุกเอฟเฟกต์ต้องใช้ใส่สถานะนี้
//  กฎกลางอยู่ที่ _universal_status.js: สะสม +1 ถึง SPELLBURDEN_MAX · ใช้ซ้ำใส่คนเดิมไม่ต่ออายุ
//  ต่างจาก applyDebuff() ตรงที่กันเฉพาะ "เพื่อนร่วมทีมคนอื่น" ไม่กันการใส่ตัวเอง — เพราะมีสกิลที่
//  จงใจแลกภาระเวทของตัวเองเป็นพลัง (Dance Lession กลางคืนของโคโตเนะ) ต้องทำงานได้ในโหมดทีมด้วย
function applySpellburden(p, turns) {
  p = CHAR_HOOKS.johnny.redirectEffect(engine, p); // หมุนวน: การหมุนย้อนกลับ
  const source = match.effectSourceId && match.players[match.effectSourceId];
  if (source && p && source.id !== p.id && sameTeam(source, p)) return false;
  if (CHAR_HOOKS.johnny.blocksDebuff(engine, p, "spellburden")) return false; // จอห์นนี่ Slow Dancer
  hisakawaSyncIn(p);
  const ok = rawApplySpellburden(p, turns);
  hisakawaSyncOut(p);
  return ok;
}

// ============================================================
//  ต่อสู้ + เอฟเฟกต์สกิล
// ============================================================
function alivePlayers() { return Object.values(match.players).filter((p) => p.alive); }
function overloadCanSafelyDraw(p) {
  if (!match.overloadForceActive) return true;
  const nextExtraDraw = (p.overloadExtraDraws || 0) + 1;
  return nextExtraDraw % 5 !== 0 || p.hp > 1;
}

function resetOverloadDrawCounter(p, ready = false) {
  if (!p) return;
  p.overloadExtraDraws = 0;
  p.overloadDrawReady = !!ready;
}

// Song for you (เทมาริ patch 2.0.6): บัฟพลังขิงที่ล็อกไว้ตอนใช้สกิล (2 ชาม = +1)
function songActive(p) {
  return !!p && ((p.statuses && p.statuses.song) || 0) > 0;
}
// ---------- เทมาริ (patch 2.0.6) ----------
const TEMARI_ANATA_DRAWS = 3;    // ANATA WAAAAAAAA: บังคับจั่วเพิ่ม 3 ใบ (เพิ่มจาก 2)
// สถานะผิดปกติที่ Song for you ล้างออกได้ทั้งหมด (patch 2.0.8: เพิ่มดีบัฟพื้นฐานใหม่
//  และแยก ยามฟ้าสาง/เส้นชีวิต ออกไปลดทีละ 1 แทน — ดูใน st === "song")
const DEBUFF_KEYS = ["discord", "sleep", "stun", "nodraw", "noskill",
  "energy", "nohealing", "weak", "fragile", "spellburden",
  "oblada", "hburn", "phenexBanUlt", "nanayaSeal", "miyakoSeal", "invert", "manaSeal", "manaRupture", "manaLeech", "mageslayerMark",
  "numb", // เหน็บชา (Bamboo-Hatted Kim)
  "johnnyWhirl"]; // หมุนวน (จอห์นนี่)
// เกราะสูงสุดของผู้เล่น: ปกติ 2 — ระหว่าง Lie Like Vortigern (โอเบรอน) เป้าหมายได้เพดานเกราะ +1
function maxArmorOf(p) {
  if (mercury.isOrt(p)) return CHAR_HOOKS.ort.maxArmor();
  if (Seraph.active() && p) return Seraph.maxArmor(p); // SE.RA.PH: ความจุจากโบสถ์เท่านั้น
  // แบทแมน: ระหว่างอยู่บนรถแบทโมบิล เพดานเกราะ = พลังชีวิตของรถ (7)
  const batCarArmor = CHAR_HOOKS.bat_ben.maxArmor(p);
  if (batCarArmor != null) return batCarArmor;
  const escanorArmor = (p && p.characterId === "escanor" && CHAR_HOOKS.escanor.maxArmor) ? CHAR_HOOKS.escanor.maxArmor(p) : null;
  // Last Stand: "เกราะ 0" เป็นค่าตายตัวของร่าง — คืนก่อนบวกโบนัสใดๆ ไม่งั้นบัฟเพดานเกราะจากเพื่อนร่วมทีมทะลุได้
  if (escanorArmor === 0) return 0;
  const armorBase = (p && p.characterId === "hisakawa_sister") ? CHAR_HOOKS.hisakawa_sister.maxArmor(p)
    : (escanorArmor != null) ? escanorArmor
    : (p && p.characterId === "ippo") ? CHAR_HOOKS.ippo.maxArmor() // อิปโป (patch 3.3 new): "โล่ 4" = เพดานเกราะ 4
    : (p && p.characterId === "the_supplicant") ? CHAR_HOOKS.the_supplicant.maxArmor() // ผู้วิงวอน (patch 3.4 new): เพดานเกราะ 5
    : (p && p.characterId === "producer_lumi") ? CHAR_HOOKS.producer_lumi.maxArmor(p) // โปรดิวเซอร์: เกราะ 3 ตอนไอดอลยืน · 0 เมื่อไอดอลล้ม
    : (p && p.characterId === "eiji") ? CHAR_HOOKS.eiji.maxArmor() // เอจิ (patch 2.4 new): เกราะพื้นฐาน 4 หน่วย
    : (p && p.characterId === "kim") ? CHAR_HOOKS.kim.maxArmor() // Bamboo-Hatted Kim: "โล่ 2" = เพดานเกราะ 2
    : (p && p.characterId === "recruit") ? CHAR_HOOKS.recruit.maxArmor() // Recruit: เกราะ 2
    : (p && p.characterId === "striker") ? CHAR_HOOKS.striker.maxArmor() // สไตรเกอร์ ยูเรก้า: เกราะ 3
    : (p && p.characterId === "takt") ? CHAR_HOOKS.takt.maxArmor() // อาซาฮินะ ทักต์: ไม่มีเกราะ
    : (p && p.characterId === "dio") ? CHAR_HOOKS.dio.maxArmor() // ดิโอ แบรนโด: เกราะ 4
    : MAX_ARMOR;
  return armorBase
    + (characterRules.oguriGoldStacks(p) >= OGURI_GOLD_ARMOR_AT ? 1 : 0) // ยุคทอง (โอกูริ Rework): ครบ 2 แต้มขึ้นไป เพดานเกราะ +1
    + ((p.characterId === "hikaru" && ((p.statuses && p.statuses.monster) || 0) > 0) ? HIKARU_MONSTER_ARMOR_BONUS : 0) // MonsterLive (ฮิคารุ patch 2.1.3): เพดานเกราะ +2
    + (CHAR_HOOKS.escanor.armorBonus(p) || 0);
}
// เรจูอาคมบัญชา คำสั่ง 1 (ฟุจิมารุ): อมตะ 1 เทิร์น — ไม่รับความเสียหายใดๆ
function sealActive(p) {
  return !!p && ((p.statuses && p.statuses.seal) || 0) > 0;
}
// Beat Mode (universal dispatcher — เรียกกลับเข้า characters/<id>.js ของแต่ละตัวละครที่มีกลไกนี้)
//  ตอนนี้มี takuto (ฉันยัง...มองเห็นอยู่!!!) — ดู characters/takuto.js
function beatActive(p) {
  const mod = CHAR_HOOKS[p && p.characterId];
  return !!(mod && mod.isBeatActive && mod.isBeatActive(engine, p));
}
function maybeBeatMode(p) {
  const mod = CHAR_HOOKS[p && p.characterId];
  if (mod && mod.maybeEnterBeatMode) mod.maybeEnterBeatMode(engine, p);
}
// กันตายทันทีเมื่อความเสียหายถึงตาย (ครั้งเดียวต่อเกม — ค้างที่ 1 หน่วย)
function maybeBeatSave(p) {
  if (!p || !p.alive || characterRules.passiveSealed(p)) return false;
  if (p.beatSaved || p.hp >= 1) return false;
  const mod = CHAR_HOOKS[p.characterId];
  return !!(mod && mod.tryDeathSave && mod.tryDeathSave(engine, p));
}
// ---------- ริต้า เบอร์นัล / ฟีนิกซ์ (patch 2.1.6) ----------
// สกิลติดตัว 1 ถ้าเลือกได้ อยากเกิดเป็นอะไรหรอ?: ตายครั้งแรกในเกม -> เกิดใหม่ด้วยพลังชีวิต/เกราะเต็ม (ครั้งเดียวต่อเกม)
//  เปิด NTD-System ถาวรฟรี (ไม่เสียเลือด) + พลังโจมตีพื้นฐานถาวร +1 — ท่าไม้ตายเปลี่ยนเป็นท่า 2 / สกิลรองเปลี่ยนเป็นสกิลรอง 2 ถาวร
// ริต้า เบอร์นัล (characters/phenex.js) — wrapper รอบ CHAR_HOOKS.phenex.resolveRelease
// ตายกลางเทิร์น (เลือดหมดจากสกิล/ผลสถานะ): ตกรอบทันที
// force = true: ข้ามระบบกันตาย/เกิดใหม่ทั้งหมด (ใช้โดยสกิลติดตัว "ความปรารถนา" ของยุย ที่ระบุว่า
//  "ตายทันทีไม่สนเงื่อนไขอื่นๆ") — ยังผ่านการเก็บกวาดท้ายฟังก์ชันตามปกติทุกอย่าง
function instantDeath(p, force) {
  if (friendlyEffectBlocked(p)) return;
  // ORT: หลอดเลือดแตก (ทั้งเลือดหมดและโดนสังหารทันที) -> หลอดถัดไปเริ่มเต็ม · หลอดสุดท้ายเท่านั้นที่ตายจริง
  if (mercury.isOrt(p) && CHAR_HOOKS.ort.tryBarBreak(engine, p)) return;
  // เกราะ Mark 42: "ตาย" ระหว่างใส่ชุด (สังหารทันที ฯลฯ) = แค่ชุดพัง กลับร่างเดิม
  if (!force && Mark42.suited(p)) { Mark42.breakSuit(engine, p, "combat"); return; }
  // Bamboo-Hatted Kim (Resentment): เลือดหมดจากความเสียหายครั้งแรก -> ค้างที่ 1 (สังหารทันทีตอนเลือดยังเหลือไม่นับ)
  if (!force && CHAR_HOOKS.kim.tryResentment(engine, p)) return;
  // ดิโอ (Last stand): ศัตรูสังหารทันที/ตีจนตายผ่านทางที่ไม่ผ่าน adjustIncomingDamage -> ค้างที่ 1 แล้วจองดวล
  if (!force && CHAR_HOOKS.dio.tryLastStandOnDeath(engine, p)) return;
  if (!force && p.characterId === "escanor" && CHAR_HOOKS.escanor.tryNoonRevive(engine, p)) return;
  if (!force && p.characterId === "hisakawa_sister" && resolveHisakawaTwinDeath(p)) return;
  // Ultraman Trigger: ตายในร่างพิเศษถือว่าตายจริง ไม่คืนร่างแทน
  // ริต้า เบอร์นัล (สกิลติดตัว 1 patch 2.1.6, characters/phenex.js): ตายครั้งแรก -> เกิดใหม่แทนที่จะตกรอบ (ครั้งเดียวต่อเกม)
  if (!force && p.characterId === "phenex" && CHAR_HOOKS.phenex.tryRebirth(engine, p)) return;
  // โปรดิวเซอร์ (characters/producer_lumi.js): ไอดอลเลือดหมด = "ไอดอลล้ม" ไม่ใช่ตกรอบ —
  //  หลอดเลือดสลับไปเป็นของโปรดิวเซอร์ (3) ต่อ · ตกรอบจริงเมื่อโปรดิวเซอร์เลือดหมดอีกที
  if (!force && p.characterId === "producer_lumi" && CHAR_HOOKS.producer_lumi.tryIdolDown(engine, p)) return;
  // ริต้า เบอร์นัล (สกิลติดตัว 2 patch 2.1.7, characters/phenex.js): ตกรอบจริงขณะท่าไม้ตาย 2 ยังทำงานอยู่ -> ปลดปล่อยความเจ็บปวดที่สะสมทั้งหมดก่อนตาย
  if (p.characterId === "phenex") CHAR_HOOKS.phenex.maybeReleasePainOnDeath(engine, p);
  // Purge: เลือดหมด = ล้มลง ถอยหลังในท่อแล้วฟื้นเต็ม (ไม่มีการตกรอบจากการต่อสู้ — ตกรอบได้ทางเดียวคือโดน ORT กิน)
  //  อยู่หลังระบบกันตาย/เกิดใหม่ของตัวละครทั้งหมด และมีผลแม้ force (การตายทันทีของยุยก็แค่ทำให้ล้ม)
  if (purge.tryKnockBack(p)) return;
  // เท็นโนจิ โคทาโร่ (rewrite): ตกรอบจริง แต่ตั้งธงให้ endTurn() ย้อนเทิร์นกลับมาให้ 1 ครั้งต่อเกม
  p.hp = 0; p.alive = false; p.result = "dead"; p.locked = true;
  // คอนเนอร์ RK800 (สกิลติดตัว 3 ปัญญาประดิษฐ์): จองคิวฟื้นคืนชีพอีก 10 เทิร์น (ไม่ใช่การกันตาย — ตกรอบจริงก่อน)
  CHAR_HOOKS.conner.onDeath(engine, p);
  // โมโรโบชิ ดัน (characters/dan.js): เป้าหมาย "จงหลบแต่อย่าหนี"/ศิษย์ตกรอบ (หรือดันเองตกรอบ) -> ปลดสถานะทั้งสองฝั่ง
  // อิสึกะ ชิโด (characters/shido.js): ตายระหว่างกับดักเปิดอยู่ -> จองคิวเกิดใหม่ + คิววีดีโอรอยต่อ
  // ยุย (characters/yui.js): ตกรอบขณะมีคิวชุบชีวิตค้าง — ถ้าไม่เหลือใครแล้ว ให้เป้าหมายฟื้นทันที
  //  (ต้องอยู่ก่อน shido.onDeath ที่อาจย้อนเวลา — ลำดับไหนก็ได้ แต่ต้องอยู่ในชุดเดียวกัน)
  qteSystem.clearQte(p); // ตกรอบแล้ว QTE ที่ค้างอยู่ต้องหายไปด้วย (ไม่งั้นค้างข้ามการชุบชีวิต/ย้อนเวลา)
  CHAR_HOOKS.yui.onDeath(engine, p);
  CHAR_HOOKS.shido.onDeath(engine, p);
  CHAR_HOOKS.dan.onDeath(engine, p);
  // ผู้วิงวอน (characters/the_supplicant.js): ผู้ถือตราพิพากษา/ผู้วิงวอนตกรอบ -> ล้างตราที่ค้างอยู่ทั้งสองฝั่ง
  CHAR_HOOKS.the_supplicant.onDeath(engine, p);
  // ไบรอัน (characters/brian.js): คนขับหรือคู่แข่งตกรอบ -> ลงจากรถ / ยกเลิกการแข่ง
  CHAR_HOOKS.brian.onDeath(engine, p);
  // ดิโอ (characters/dio.js): ดิโอตกรอบ -> ปิด THE WORLD / ยกเลิก Last stand · คู่ดวลตกรอบ -> ยกเลิกดวล
  CHAR_HOOKS.dio.onDeath(engine, p);
  // อาซาฮินะ ทักต์ (characters/takt.js): ทักต์หรือมิวสิคคาร์ทตกรอบ -> พันธะสัญญาหลุด
  CHAR_HOOKS.takt.onDeath(engine, p);
  // มหาเทพ อรชุน (สกิลติดตัว หัวใจที่เที่ยงธรรม): จำไว้ว่าใครเคยสังหารผู้เล่นอื่น — ธงถาวรทั้งเกม
  //  อ่านจาก effectSourceId (ต้นตอของเอฟเฟกต์ที่กำลังทำงาน) เพราะ instantDeath ไม่มีพารามิเตอร์ผู้สังหาร
  const killer = match.players[match.effectSourceId];
  if (killer && killer.id !== p.id) killer.hasKilled = true;
  CHAR_HOOKS.ort.onKill(engine, p); // ORT สกิลติดตัว 3 การวิวัฒนาการ: สังหารผู้เล่นจริง -> หลอด +1 / พลังโจมตี +1
  if (mercury.mercuryActive() && !mercury.isOrt(p)) mercury.mercuryOnDeath(p);
  CHAR_HOOKS.kai.pruneOverhaulSlots(engine); // ไค ชิซากิ: ผู้ถือรังสรรค์/ลงทัณฑ์ตกรอบ -> ลบออกจาก Overhaul tracker
  // ยูนะ: เป้าหมายที่ได้รับพร (Delete/Smile for You/Longing) ตาย/หมดสภาพ -> เพลง+บัฟยูนะปิดลงทันที
  //  ยกเว้น Break Beat Bark เพราะมีผลทั้งสนาม ไม่ผูกกับผู้เล่นคนใดคนหนึ่งโดยเฉพาะ
  if (match.yunaEffect && match.yunaEffect !== "beatbark" && match.yunaTargetId === p.id) {
    match.yunaEffect = null; match.yunaTargetId = null; match.yunaWindowEnd = 0;
    delete p.statuses.yunaDelete; delete p.statuses.yunaSmile; delete p.statuses.yunaLonging;
  }
  // ยูนะ (เพลง Longing): คนแรกที่ตายระหว่างเทิร์น 1-10 -> ทำเครื่องหมายไว้ก่อน (ครั้งเดียวต่อเกม)
  //  ยังไม่ฟื้นคืนชีพทันที — ต้องรอให้ฉากโจมตี(ถ้ามี)จบก่อน แล้วค่อยฟื้น+ขึ้นวีดีโอ (ดู endTurn() จุดที่ตั้งค่า yunaLongingPendingId)
  //  Type Mercury: ยูนะไม่ทำงานในโหมด Raid (ตายแล้วเลือกตัวใหม่แทน)
  if (!mercury.mercuryActive() && !match.yunaLongingUsed && match.roundNumber >= 1 && match.roundNumber <= 10) {
    match.yunaLongingUsed = true;
    match.yunaLongingPendingId = p.id;
  }
}

// สรุปผลหลังดาเมจจากสกิลของโมดูลตัวละคร: เรียกกันตาย/เปลี่ยนร่าง/ปลุก และตกรอบทันทีเมื่อ HP หมด
function resolveDamageAftermath(p) {
  if (!p || !p.alive) return;
  maybeBeatSave(p);
  maybeBeatMode(p);
  characterRules.maybeWakeKotone(p);
  if (p.alive && p.hp <= 0) instantDeath(p);
}

// ฮีลพร้อมล้น: เลือดจริง -> เกราะ -> เลือดชั่วคราว (หายเองใน 2 เทิร์น / หมดเมื่อรับดาเมจ)
//  คืนรายละเอียดว่าฮีลครั้งนี้ลงช่องไหนเท่าไหร่ (ใช้แจ้งผลใน log ให้ชัด)
function healOverflow(p, amount) {
  let left = amount;
  const toHp = healHp(p, left); // "ไม่ใช้งานต่อ" = ฟื้นเลือดจริงไม่ได้ (ล้นไปเกราะ/เลือดชั่วคราวได้ตามปกติ)
  left -= toHp;
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

// เลือดจริงลด 1 หน่วย — เลือดชั่วคราวรับแทนก่อนเสมอ (หมดไปเพราะได้รับความเสียหาย)
// เชื่อมผล (patch 2.0.8): การลด HP จริงถูกแชร์ให้คู่เชื่อมเท่ากันด้วย (อมตะกันไว้ได้)
function loseHp(p) {
  hisakawaSyncIn(p);
  if (friendlyEffectBlocked(p)) return;
  // เกราะ Mark 42: เส้นทางที่เรียก loseHp ตรงๆ (ไม่ผ่านท่อดาเมจ) ก็ลงชุดแทน
  if (Mark42.absorb(engine, p, 1)) { hisakawaSyncOut(p); return; }
  // แบทแมนร่างรถแบทโมบิล (characters/bat_ben.js): พลังชีวิตลดไม่ได้เลย — ความเสียหายไปลงเกราะ (พลังชีวิตของรถ)
  //  ต้องอยู่บนสุดของ loseHp เพราะนี่คือจุดคอขวดเดียวที่ hp จะลดได้ ทำให้ครอบคลุมทั้งดาเมจทะลุเกราะ
  //  (dealDirect = สกิลติดตัว 2 "รถคู่ใจ") และดาเมจที่ทะลุเกราะมาเพราะเกราะหมดพอดี
  if (CHAR_HOOKS.bat_ben.carAbsorb(engine, p)) { hisakawaSyncOut(p); return; }
  if ((p.tempHp || 0) > 0) { p.tempHp--; hisakawaSyncOut(p); return; }
  p.hp--; p.dmgHp++;
  hisakawaSyncOut(p);
  CHAR_HOOKS.daichi.onDamageTaken(p); // ไดจิ เกราะเบมสตาร์: นับความเสียหายไว้ฟื้นคืนเทิร์นหน้า
  // ไม่อยากให้ใครต้องเจ็บปวด (ริต้า เบอร์นัล, characters/phenex.js): ระหว่างล่อเป้า สะสม "ความเจ็บปวด" +1 ทุกๆ 1 หน่วยเลือดจริงที่เสียไป
  CHAR_HOOKS.phenex.onHpLost(p);
  if (!match.linkMirror) {
    const buddies = linkedBuddiesOf(p);
    match.linkMirror = true;
    for (const b of buddies) if (!sealActive(b)) loseHp(b);
    match.linkMirror = false;
  }
}

// Overload Force: เริ่มนับเฉพาะไพ่ที่จั่วหลังคะแนนเกิน 21 และรีเซ็ตตัวนับใหม่ทุกเทิร์น
// ทุกใบที่ 5 ในช่วงคะแนนเกิน 21 จะเสีย HP จริง 1 หน่วย
// ใช้ loseHp เพื่อให้ระบบกันตาย/เชื่อมผล/ร่างพิเศษยังทำงานตามกติกาหลักของเกม
function applyOverloadOverdrawPenalty(p) {
  if (!match.overloadForceActive || !p || !p.alive || !p.overloadDrawReady) return;
  if (cardDeck.calculateScore(p.cards) <= 21) return;
  p.overloadExtraDraws = (p.overloadExtraDraws || 0) + 1;
  if (p.overloadExtraDraws % 5 !== 0) return;
  const before = p.hp;
  loseHp(p);
  maybeBeatSave(p);
  maybeBeatMode(p);
  if (p.alive && p.hp <= 0) instantDeath(p);
  const lost = Math.max(0, before - p.hp);
  match.lastLog.push(`⚡ ${p.name} จั่วเพิ่มครบ ${p.overloadExtraDraws} ใบใน Overload Force — HP -${lost}${p.alive ? "" : " และหมดสภาพต่อสู้!"}`);
}
// เชื่อมผล (patch 2.1.1): เกราะที่เสียจริงถูกแชร์ให้คู่เชื่อมเท่ากันด้วย (คนละช่องกับ HP)
function loseArmor(p) {
  hisakawaSyncIn(p);
  if (friendlyEffectBlocked(p)) return;
  // เกราะ Mark 42: ล้าง/สลายเกราะ (Rider Shooting · เชื่อมผล ฯลฯ) ลงเกราะชุดแทนเกราะจริงที่ซ่อนอยู่ข้างใต้
  if (Mark42.absorb(engine, p, 1)) { hisakawaSyncOut(p); return; }
  p.armor--; p.dmgArmor++;
  hisakawaSyncOut(p);
  CHAR_HOOKS.daichi.onDamageTaken(p); // ไดจิ เกราะเบมสตาร์: นับความเสียหายไว้ฟื้นคืนเทิร์นหน้า
  // MonsterLive (ฮิคารุ, characters/hikaru.js): เกราะลดลง -> ฟื้นพลังชีวิตตามเกราะที่เสียไป
  CHAR_HOOKS.hikaru.onArmorLost(engine, p);
  // ไม่อยากให้ใครต้องเจ็บปวด (ริต้า เบอร์นัล, characters/phenex.js): ระหว่างล่อเป้า สะสม "ความเจ็บปวด" +1 ทุกๆ 1 หน่วยเกราะที่เสียไป
  CHAR_HOOKS.phenex.onArmorLost(p);
  // แบทแมนร่างรถ (characters/bat_ben.js): เกราะคือพลังชีวิตของรถ — หมดเมื่อไหร่คือรถพัง
  //  ต้องเช็คที่นี่ด้วย ไม่ใช่แค่ใน carAbsorb: ถ้าดาเมจพอดีกับเกราะที่เหลือ ท่อจะไม่เคยเรียก loseHp เลย
  CHAR_HOOKS.bat_ben.onArmorLost(engine, p);
  if (!match.linkMirror) {
    const buddies = linkedBuddiesOf(p);
    match.linkMirror = true;
    // Recruit [Armor]: เกราะหายตามคู่เชื่อมก็นับเป็น "โดน 1 ครั้ง" (ครบ 2 ถึงลด)
    for (const b of buddies) if (!sealActive(b) && b.armor > 0 && !CHAR_HOOKS.recruit.absorbHit(engine, b)) loseArmor(b);
    match.linkMirror = false;
  }
}
// ผู้วิงวอน "เกราะศรัทธา" (patch 3.4.6, characters/the_supplicant.js): นับเป็น "เกราะ" พิเศษที่เสริมขึ้นมา
//  (เกราะศรัทธา 1 หน่วย = เกราะ 1 หน่วย) และกินดาเมจ "ก่อน" เกราะหลักเสมอ — ดาเมจนอกสนาม/สถานะดีบัฟ
//  ก็ผ่านทางนี้เพราะทุกช่องทางไหลผ่าน damageSoft/dealMixed/dealArmorOnly เหมือนกันหมด
//  ข้อยกเว้นเดียวคือดาเมจทะลุเกราะ (dealDirect) ซึ่งข้ามเกราะทุกชนิดตามนิยามของมันอยู่แล้ว
//  คืน true = ดาเมจ 1 หน่วยนี้ถูกเกราะศรัทธากินไปแล้ว ผู้เรียกต้องข้ามการหักเกราะหลัก/เลือดของหน่วยนั้น
function faithArmorAbsorb(p) {
  return CHAR_HOOKS.the_supplicant.faithAbsorb(engine, p);
}
// เรจูอาคมบัญชา (อมตะ): ไม่รับความเสียหายใดๆ ตลอดเทิร์น — กันไว้กลางทางทุกช่องทางดาเมจ
function damageSoft(p) {
  hisakawaSyncIn(p);
  if (!p.alive || sealActive(p) || friendlyEffectBlocked(p)) return;
  // คาเยนน์ ทหารผ่านศึก: ไม่ใช่เกพาร์ด = ความเสียหายแพ้จั่ว/ไพ่แตก ฯลฯ เลื่อนไปลงผลเทิร์นถัดไป
  if (p.characterId === "cayenne" && CHAR_HOOKS.cayenne.delaySoft(engine, p)) return;
  // อมาซอน (ฮารุกะ, characters/haruka.js): ไม่มีเกราะแล้วโดนดาเมจ = เลือดไหลตัวเอง — damageSoft ไม่ผ่าน
  //  adjustIncomingDamage() จึงต้องเรียกฮุคเองที่นี่ ไม่งั้นดาเมจแพ้จั่วจะไม่นับเป็น "ความเสียหายทางใดก็ตาม"
  if (p.characterId === "haruka") CHAR_HOOKS.haruka.onDamaged(engine, p);
  // เกราะ Mark 42: ดาเมจแพ้จั่วลงชุดแทนตัวจริง
  if (Mark42.absorb(engine, p, 1)) { hisakawaSyncOut(p); return; }
  // Bamboo-Hatted Kim: ได้รับความเสียหายทุกชนิด (รวมแพ้จั่ว) = ฝักดาบ +3-10
  CHAR_HOOKS.kim.onSoftDamage(engine, p);
  // Recruit [Armor]: ดาเมจแพ้จั่วก็ต้องโดนครบ 2 ครั้งเกราะถึงลด (ตำแหน่งเดียวกับ adjustIncomingDamage ในท่ออื่น = ก่อนโล่)
  if (CHAR_HOOKS.recruit.absorbSoft(engine, p)) { hisakawaSyncOut(p); return; }
  if (p.shield > 0) { p.shield--; hisakawaSyncOut(p); return; }
  if (faithArmorAbsorb(p)) { hisakawaSyncOut(p); return; } // เกราะศรัทธาอยู่หน้าเกราะหลัก
  if (p.armor > 0) loseArmor(p);
  else loseHp(p);
  // คู่แฝดฮิซากาว่า: ดาเมจแพ้จั่ว/แตกก็ต้องสลับให้แฝดอีกคนออกมาคุมทันทีเหมือนท่อดาเมจอื่น
  //  ไม่งั้นจะยืนอยู่ด้วยแฝดที่เลือดหมดตลอดเฟส SUMMARY/ATTACK แล้วค่อยสลับตอน endTurn()
  resolveHisakawaTwinDeath(p);
}
// isNormalAttack: true เฉพาะที่ doAttack() เรียก (การโจมตีจากการเลือกเป้าหมายในเทิร์นปกติ ไม่ว่าจะมีบัฟเสริมพลังหรือไม่)
// ตราล่าเวท (characters/mageslayer.js): ดาเมจ "ทุกประเภท" ที่ผู้สังหารเมจสร้างใส่เป้าหมายที่ติดตรา
//  (ปืน GUTS / ดาเมจสกิล / ระเบิดมานา / การโจมตีปกติ) จะขโมยพลังงานเท่าดาเมจ — เรียกจากท่อดาเมจกลางทั้ง 3 ตัว
//  แทนการไปแปะทีละจุด โดยดูต้นตอจาก effectSourceId (ทุก handler ห่อด้วย withEffectSource อยู่แล้ว)
function mageslayerMarkSteal(target, n) {
  if (!(n > 0) || !target) return;
  const src = match.effectSourceId && match.players[match.effectSourceId];
  if (!src || src.characterId !== "mageslayer" || src.id === target.id) return;
  CHAR_HOOKS.mageslayer.onDamageDealt(engine, src, target, n);
}
// kind = ช่องทางที่เรียกมา ("direct"/"armor"/"mixed") — hook ที่เลื่อนดาเมจไว้ลงผลทีหลังต้องใช้ช่องทางเดิม (คาเยนน์)
function adjustIncomingDamage(p, n, isNormalAttack, kind) {
  // จำ "ใครทำดาเมจใส่คนนี้ล่าสุด" (เทิร์นไหน) — ผู้เล่นที่เลือดหมดจากโจมตีปกติยังไม่ตายตรงนี้ แต่ตายตอนกวาดท้ายเทิร์น
  //  (endTurn) ซึ่งไม่มี effectSourceId แล้ว ORT (วิวัฒนาการ) จึงต้องอ่านผู้ลงมือจากตรงนี้แทน
  if (p && match.effectSourceId && match.effectSourceId !== p.id) { p.lastDamageSourceId = match.effectSourceId; p.lastDamageRound = match.roundNumber; }
  else if (p && !match.effectSourceId && n > 0) p.lastDamageSourceId = null;
  // เกราะ Mark 42: ชุดรับความเสียหายทุกชนิดแทนตัวจริงทั้งก้อน (ส่วนเกินหายไปพร้อมชุด = แค่กลับร่างเดิม)
  if (n > 0 && Mark42.absorb(engine, p, n)) return 0;
  // จอห์นนี่ Lesson Five + Chumimi: หมัดนี้ไม่สนการลดดาเมจทุกชนิด — ฮุคยังทำงาน (ผลข้างเคียง) แต่ลดต่ำกว่าค่าเดิมไม่ได้
  const pierceFloor = CHAR_HOOKS.johnny.pierceFloor(engine, n, isNormalAttack);
  // SE.RA.PH Matrix ระดับ 2: ลง 2 แต้มบนใคร = รับความเสียหายจากคนนั้นน้อยลง 1 หน่วย (§6)
  //  ต้นตอของดาเมจอ่านจาก effectSourceId (จุดเดียวกับที่ friendly-fire/ตราล่าเวทใช้)
  if (Seraph.active() && match.effectSourceId && match.effectSourceId !== p.id) {
    const cut = Seraph.damageReduction(p, match.effectSourceId);
    if (cut > 0 && n > 0) n = Math.max(0, n - cut);
  }
  // เย็นชื่นใจ (escanorCool, WineBarrel ของเอสคานอร์): สถานะ Universal — ไวน์ถูกขโมยไปใช้ได้
  //  ตรรกะจริงอยู่ characters/_universal_status.js (coolReduction)
  if (n > 0) n = Math.max(0, n - coolReduction(p, isNormalAttack));
  const hook = CHAR_HOOKS[p && p.characterId];
  const out = hook && hook.adjustIncomingDamage ? hook.adjustIncomingDamage(engine, p, n, isNormalAttack, kind) : n;
  return pierceFloor != null ? Math.max(out, pierceFloor) : out;
}
function tryYunaLongingForTwin(p) {
  if (!p || p.characterId !== "hisakawa_sister" || mercury.mercuryActive() || match.yunaLongingUsed || match.roundNumber < 1 || match.roundNumber > 10) return false;
  if (!CHAR_HOOKS.hisakawa_sister.anyTwinDead(p)) return false;
  match.yunaLongingUsed = true;
  return YunaMod.reviveWithLonging(engine, p);
}
function resolveHisakawaTwinDeath(p) {
  if (!p || !p.alive || p.hp > 0 || p.characterId !== "hisakawa_sister") return false;
  const survived = CHAR_HOOKS.hisakawa_sister.tryTwinDeath(engine, p);
  if (survived) tryYunaLongingForTwin(p);
  return survived;
}
// ดาเมจทะลุเกราะ: ข้ามทั้งเกราะหลักและ "เกราะศรัทธา" (ข้อยกเว้นเดียวของเกราะศรัทธาตามสเปค)
function dealDirect(p, n, isNormalAttack) {
  p = CHAR_HOOKS.johnny.redirectTarget(engine, p, isNormalAttack); // หมุนวน: การหมุนย้อนกลับ — ดาเมจลงผู้ใช้สกิลเอง
  if (sealActive(p) || friendlyEffectBlocked(p)) return;
  n = adjustIncomingDamage(p, n, isNormalAttack, "direct");
  if (n <= 0) return;
  for (let i = 0; i < n; i++) {
    if (!p.alive) return;
    if (p.shield > 0) { p.shield--; continue; }
    loseHp(p);
  }
  mageslayerMarkSteal(p, n);
  resolveHisakawaTwinDeath(p);
}
function dealArmorOnly(p, n, isNormalAttack) {
  p = CHAR_HOOKS.johnny.redirectTarget(engine, p, isNormalAttack); // หมุนวน: การหมุนย้อนกลับ
  if (sealActive(p) || friendlyEffectBlocked(p)) return;
  n = adjustIncomingDamage(p, n, isNormalAttack, "armor");
  if (n <= 0) return;
  for (let i = 0; i < n; i++) {
    if (p.shield > 0) { p.shield--; continue; }
    if (faithArmorAbsorb(p)) continue; // เกราะศรัทธาอยู่หน้าเกราะหลัก
    if (p.armor > 0) loseArmor(p);
  }
  mageslayerMarkSteal(p, n);
}
function dealMixed(p, n, isNormalAttack) { // เกราะก่อนแล้วเลือด
  p = CHAR_HOOKS.johnny.redirectTarget(engine, p, isNormalAttack); // หมุนวน: การหมุนย้อนกลับ
  if (sealActive(p) || friendlyEffectBlocked(p)) return;
  n = adjustIncomingDamage(p, n, isNormalAttack, "mixed");
  if (n <= 0) return;
  for (let i = 0; i < n; i++) {
    if (!p.alive) return;
    if (p.shield > 0) { p.shield--; continue; }
    if (faithArmorAbsorb(p)) continue; // เกราะศรัทธาอยู่หน้าเกราะหลัก
    if (p.armor > 0) loseArmor(p);
    else loseHp(p);
  }
  mageslayerMarkSteal(p, n);
  resolveHisakawaTwinDeath(p);
}
// src = แหล่งที่มาของการฟื้นพลังงาน ("item" / "passive" / "card") — ใส่เฉพาะช่องทาง "ฟื้นฟู" จริงๆ
//  ที่ [ดูดซับเวท] (ผู้สังหารเมจ) ต้องตอบสนอง ไม่ใส่ให้แต้มพื้นฐานจบเทิร์น/ค่าชดเชยการแพ้/การโอนแต้มระหว่างผู้เล่น
function addSkill(p, n, src) {
  if (mercury.isOrt(p)) return;
  // ชะงัก (โอกูริ Rework): ฟื้นฟูแต้มสกิลไม่ได้ทุกช่องทาง ระหว่างติดสถานะนี้
  if (((p.statuses && p.statuses.stagger) || 0) > 0) return;
  if (((p.statuses && p.statuses.manaSeal) || 0) > 0) return; // ผนึกพลังงาน (Universal): ฟื้นฟูแต้มสกิลไม่ได้ทุกช่องทาง
  if (p.characterId === "mageslayer") return; // Song's Curse: ฟื้นพลังงานได้เฉพาะการโจมตีเป้าหมายที่ติด Witch Mark ซึ่งไม่เรียก addSkill
  const before = p.skillPoints;
  p.skillPoints = Math.min(maxSkillOf(p), p.skillPoints + n); // Bard: เพดานพลังงาน 9
  p.gainedSkill += p.skillPoints - before;
  // ดูดซับเวท (characters/mageslayer.js): ฟื้นพลังงานจากไอเทม/พาสซีฟ/การ์ดรังสรร -> 35% ถูกผู้สังหารเมจขโมย 1 หน่วย
  if (src && p.skillPoints > before) CHAR_HOOKS.mageslayer.onEnergyAction(engine, p);
}

function applyEffect(p, effect) {
  if (!effect) return;
  if (Array.isArray(effect)) return effect.forEach((e) => applyOne(p, e));
  applyOne(p, effect);
}
function applyOne(p, e) {
  switch (e.type) {
    case "heal": healHp(p, e.amount); break;
    case "armor": healArmor(p, e.amount); break;
    case "points": addSkill(p, e.amount, "passive"); break;
    case "shield": p.shield += e.amount || 1; break;
    case "draw": for (let i = 0; i < (e.amount || 1); i++) { const c = cardDeck.drawCardFor(p); if (c) { p.cards.push(c); cardDeck.onCardDrawn(p, c); } } break;
    case "redraw": {
      p.cards = [];
      for (let i = 0; i < 2; i++) { const c = cardDeck.drawCardFor(p); if (c) { p.cards.push(c); cardDeck.onCardDrawn(p, c); } }
      break;
    }
    case "status": p.statuses[e.status] = e.turns || 1; break;
  }
}
function firePassive(p, trigger) {
  if (Seraph.noCombat()) return; // SE.RA.PH วันที่ 1-6: ไม่มีสกิลติดตัวทำงานเลย
  const ch = CHAR_BY_ID[p.characterId];
  if (ch && ch.passive && ch.passive.trigger === trigger) applyEffect(p, ch.passive.effect);
}
// หาข้อมูลสกิล (ชื่อ+รูป) จาก status ที่กำลังมีผล — ใช้โชว์ตอนอนิเมชันโจมตี ว่าดาเมจ/การป้องกันมาจากสกิลไหนของใคร
function skillByStatus(p, status) {
  const ch = CHAR_BY_ID[p.characterId];
  if (!ch) return null;
  for (const tier of ["basic", "secondary", "secondary2", "secondaryNight", "ultimate", "ultimate2", "ultimateNight"]) {
    const s = ch[tier];
    if (s && s.effect && !Array.isArray(s.effect) && s.effect.type === "status" && s.effect.status === status) {
      return { name: s.name, img: s.img || null, by: p.name, color: lobby.colorOf(p) };
    }
  }
  return null;
}
// นายมีฝีมือแค่ไหนหรอ? (ชิกิ patch 2.0.6): มีชิกิที่ถือชาร์จยกเลิกท่าไม้ตาย (godslay) อยู่บนสนาม
//  -> ท่าไม้ตายของผู้เล่นอื่นถูกยกเลิก (แต้มสกิลเสียฟรี — ไม่คืน)
//  วีดีโอเล่นเฉพาะ "ครั้งแรกของเจ้าของท่าคนนั้น" — โดนยกเลิกครั้งถัดไปเป็นแค่การแจ้งเตือน
//  คืนค่า true = มีวีดีโอเข้าคิว (ผู้เรียกต้องพัก/เล่นคิวเอง)
function shikiCancelUltimate(slayer, victim, skillName, skillImg) {
  delete slayer.statuses.godslay; // ใช้ได้ 1 ครั้งต่อการชาร์จ (สะสมไม่ได้)
  const t = TRANSFORMS.shikiSeal;
  // เจ้าหญิงราก (patch 2.2.7): ชาร์จตัวเดียวกัน แต่ชื่อท่าเป็น "อย่าทำอะไรไม่เข้าท่าเลย" และยกเลิกสำเร็จได้ฮีล
  const slayerSkillName = slayer.characterId === "princess_shiki" ? "อย่าทำอะไรไม่เข้าท่าเลย" : "นายมีฝีมือแค่ไหนหรอ?";
  match.lastLog.push(`👁️🗡️ ${slayer.name} ${slayerSkillName} — ยกเลิกท่าไม้ตาย ${skillName} ของ ${victim.name}! (แต้มสกิลเสียฟรี)`);
  CHAR_HOOKS.princess_shiki.onSealSuccess(engine, slayer);
  if (!victim.cutsceneShown.shikiSeal) {
    victim.cutsceneShown.shikiSeal = true; // ครั้งแรกของเจ้าของท่าคนนี้ = เล่นวีดีโอเต็ม
    match.cutsceneQueue.push({
      seconds: t.seconds,
      info: {
        playerId: victim.id, name: victim.name,
        img: skillImg || view.displayImg(victim), // ภาพสกิลท่าไม้ตายที่โดนยกเลิก
        img2: view.displayImg(victim),            // ภาพเจ้าของท่าที่โดน
        color: lobby.colorOf(slayer),
        video: t.video, title: t.title, label: `ถูก ${slayer.name} ยกเลิกท่าไม้ตาย`,
      },
    });
    return true;
  }
  // เคยโดนยกเลิกแล้ว: แจ้งเตือนเล็กๆ ว่าชิกิยกเลิกท่าไม้ตายของใคร ไม่หยุดเกม
  io.emit("transformNotice", {
    playerId: victim.id, name: slayer.name,
    img: skillImg || SHIKI_PROFILE_IMG, color: lobby.colorOf(slayer),
    title: t.title, label: `ยกเลิกท่าไม้ตาย ${skillName} ของ ${victim.name}`,
  });
  return false;
}

// ไพ่แตกก่อนเปิดไพ่ = ท่าไม้ตายที่เพิ่งกดในเทิร์นนี้ใช้งานไม่ได้ (แต้มสกิลที่จ่ายไปเสียฟรี)
function voidUltimateOnBust(p) {
  for (const key of Object.keys(TRANSFORMS)) {
    if (!TRANSFORMS[key].afterReveal) continue; // เฉพาะท่าไม้ตาย (ginga / paradise)
    if ((p.statuses[key] || 0) > 0 && !p.seen[key]) {
      delete p.statuses[key];
      match.lastLog.push(`💥 ${p.name} ไพ่แตก! ท่าไม้ตาย ${TRANSFORMS[key].title} ใช้งานไม่ได้ — แต้มสกิลเสียฟรี`);
    }
  }
  // ฟุจิตะ โคโตเนะ: ท่าไม้ตายในร่าง [พร้อมลุย] (kawaii/kcampus/kshuki) ทำงานที่ resolveRound ไม่ใช่ลูป afterReveal
  //  จึงต้องลบเองที่นี่ — แต้มสกิล/เหรียญที่จ่ายไปเสียฟรี (ร่างถูกถอดไปตั้งแต่ตอนกดแล้ว)
  if (p.characterId === "kotone") {
    for (const key of CHAR_HOOKS.kotone.FORM_ULT_KEYS) {
      if ((p.statuses[key] || 0) > 0 && !p.seen[key]) {
        delete p.statuses[key];
        match.lastLog.push(`💥 ${p.name} ไพ่แตก! ท่าไม้ตาย ${TRANSFORMS[key].title} ใช้งานไม่ได้ — แต้มสกิลและเหรียญเสียฟรี`);
      }
    }
  }
  // ANATA WAAAAAAAA (เทมาริ): ผู้ใช้ไพ่แตกเอง = ท่าไม้ตายเป็นโมฆะ
  if ((p.statuses.anata || 0) > 0 && p.anataTargets) {
    delete p.statuses.anata;
    p.anataTargets = null;
    match.anataMusicSeq = 0;
    match.lastLog.push(`💥 ${p.name} ไพ่แตก! ท่าไม้ตาย ANATA WAAAAAAAA ใช้งานไม่ได้ — แต้มสกิลเสียฟรี`);
  }
}

function resetRoundDisplay(p) {
  p.dmgHp = 0; p.dmgArmor = 0; p.gainedSkill = 0;
  p.wasAttacked = false; p.didAttackRound = false; p.isWinner = false; p.isLoser = false;
}
function resetCombat(p) {
  Seraph.resetFields(p); // SE.RA.PH: ล้างฟิลด์ของโหมด (GAME_SYSTEM.md gotcha #11)
  p.ready = false; // ห้องรอ: ต้องกดพร้อมใหม่ทุกครั้งที่กลับมาห้องรอ/เริ่มแมตช์ใหม่
  p.skillPoints = 0; p.alive = true; p.shield = 0;
  p.statuses = {}; p.seen = {}; p.transformAt = 0;
  p.statusAmt = {};      // จำนวน (amount) ของบัฟ/ดีบัฟพื้นฐาน (patch 2.0.8) — คู่กับ p.statuses
  p.armorLocked = false; // Beat Mode: กันตายแล้วเกราะจะไม่ฟื้นคืน
  p.beatSaved = false;   // Beat Mode: กันตายได้ครั้งเดียวต่อเกม (คล้าย Focus Sash)
  p.skillUsedRound = false; // ใช้สกิลได้ 1 อันต่อเทิร์น
  // ---------- ร้านค้ามายา + เศรษฐกิจเหรียญ (patch 2.2 full) ----------
  p.gold = 0;        // เหรียญสะสม (เพดาน 30)
  p.inventory = [];  // ของที่ซื้อจากร้านค้า รอใช้ (รวมปืนหน่วย GUTS Select — หายทุกแมตช์ใหม่)
  p.triggerDarkWail = 0;           // อวดครวญ: สะสมบนผู้เล่นทุกคนจากเสียงร้องไห้ สูงสุด 5
  if (p.characterId === "ignis") CHAR_HOOKS.ignis.ensureBlackSparklence(p);
  p.gutsShotTurn = 0;              // ปืนหน่วย GUTS Select: เทิร์นล่าสุดที่ยิงไป (1 นัด/เทิร์น)
  p.blackSparklenceReadyRound = 0; // หลังยิง Nursedessei: รอบที่ Black Sparklence กลับมาใช้ได้
  p.hyperTriggerReadyRound = 0;    // Hyper Key Trigger: หลังคืนร่างรอ 5 เทิร์นก่อนใช้ซ้ำ
  p.triggerRecoveryTargetHp = 0;   // Ultraman Trigger: คืนร่างแล้วฟื้นเลือด +1/เทิร์นจนถึง HP ก่อนแปลงร่าง ถ้าโดนตีจะหยุด
  p.gutsGargorgonPending = false;  // Gargorgon Ray: รอแปลงเป็นสตั้นตอนต้นเทิร์นถัดไป
  p.escanorCharge = 0;
  p.escanorForcedMorning = 0;
  p.escanorPendingWine = 0;
  p.escanorLastStandUsed = false;
  p.escanorNoonSkillLossRound = 0;
  p.escanorSolarIdle = 0;
  // ---------- DoomGuy (patch 2.2 full) ----------
  if (p.characterId === "doomguy") p.doomWeapon = DOOM_STARTING_WEAPON; // เริ่มเกมได้ Combat Shotgun เสมอ
  p.doomQuickSwapUsed = false; // Quick Swap: 1 ครั้งต่อเทิร์น
  p.doomCharge = 0;            // ชาร์จสำหรับปลดล็อก Crucible (ครบ 5)
  p.doomChaingunShieldUsed = false; // Chaingun's [ใช้ได้ครั้งเดียว]: รีเซ็ตทุกครั้งที่เปลี่ยนอาวุธ
  // ---------- สึงาชิ ทาคุโตะ (patch 2.2 new) ----------
  p.takutoComboReady = false; // Saphir+Emeraude ร่วมกัน: รอ postAttackFollowup อ่านเพื่อโจมตีเพิ่มอีกครั้ง (patch 2.2.3 — เดิมเก็บเป็นโอกาส 50/50)
  p.takutoUlt2VideoPending = false; // อย่างนายน่ะ จะไปเข้าใจอะไร: รอโจมตีจริงครั้งถัดไปแล้วค่อยเล่นวีดีโอ
  p.takutoAwakenAt = 0;          // สกิลติดตัว 1 กันตายทำงานแล้ว: ลำดับสำหรับเพลง/ภาพซ้อนทับ (ถ้ามีทาคุโตะหลายคน)
  p.tonkatsu = 0;         // เทมาริ: ชามทงคัสสึที่กินสะสม (สูงสุด 3 — Song for you ล้างตอนใช้)
  p.songAtk = 0;          // Song for you: พลังขิงที่ล็อกไว้ตอนใช้สกิล (สูงสุด 2)
  p.noDrawNext = 0;       // จำนวนเทิร์นที่จั่วเพิ่มไม่ได้ เริ่มเทิร์นถัดไป (ทงคัสสึ / กำไรเท่าตัวโว้ย)
  p.noSkillNext = 0;      // จำนวนเทิร์นที่ใช้สกิลไม่ได้ เริ่มเทิร์นถัดไป (หอกลองกินัส เอวา 13)
  p.tempHp = 0;           // แกมเบลอร์: เลือดชั่วคราวจากฮีลล้น
  p.tempHpTurns = 0;      // เลือดชั่วคราวหายเองเมื่อครบ 2 เทิร์น
  p.anataTargets = null;  // เป้าหมาย ANATA WAAAAAAAA (ลับจนกว่าจะเปิดไพ่)
  CHAR_HOOKS.daisuke.resetCombat(p); // คาซามะ ไดสุเกะ: โหมด CAST OFF/PUT ON / Clock Up / ไรเดอร์ชูต
  CHAR_HOOKS.yaguruma.resetCombat(p);
  CHAR_HOOKS.kagami.resetCombat(p);
  CHAR_HOOKS.tsurugi.resetCombat(p); // คามิชิโร่ ซึรุงิ: โหมด CAST OFF/PUT ON / Clock Up / จังหวะดาบ Rider Slash
  p.sleepFresh = false; // หลับไหล: เทิร์นที่เพิ่งโดนกล่อมยังไม่เริ่มนับ/ยังโจมตีได้
  p.curseHitRound = 0;  // "คำสาป": เทิร์นล่าสุดที่คำสาปกินเลือดไป (1 ครั้ง/เทิร์น)
  p.appleItem = "drink"; // Apple guy: ของส่งมอบที่เลือกอยู่ (ค่าเริ่มต้น เครื่องดื่มชูกำลัง)
  p.appleAtkBuffs = [];  // Apple guy: บัฟพลังโจมตีจากการมอบของ — 1 หน่วย/ครั้ง (สูงสุด 2 หน่วย) นับถอยหลังแยกกัน 5 เทิร์น/หน่วย
  p.chillDodge = 100;    // Apple guy: อัตราหลบขณะชิวๆครับน้องๆ (%) — รีเซ็ตเมื่อเปิดท่าไม้ตายใหม่
  p.appleGiveUses = CHAR_HOOKS.appleguy.GIVE_USES; // Apple guy: จำนวนใช้ เอาไปสิ (เติมจากสกิลติดตัวเมื่อหลบสำเร็จ — ไม่สามารถซ้อนทับได้ เกินเพดานตัดทิ้ง)
  // ---------- ฟุจิตะ โคโตเนะ (rework 2.3) ----------
  p.piggy = 0;              // กระปุกออมสินน้องหมูน้อย: เงินที่หยอดไว้ (สูงสุด 15 — แปลงเป็นดาเมจผ่าน รัก รักที่สุดเลย)
  p.senaNext = false;       // โดนท่านประธานเซนะจังเจอตัว -> เทิร์นถัดไปสตั้น 1 เทิร์น
  p.kotoneExtraAtk = false; // Self-affirmation Explosion! Love Love: รอ postAttackFollowup อ่านเพื่อโจมตีเพิ่มอีก 1 ครั้ง
  // ---------- เอจิ (patch 2.4 new) ----------
  CHAR_HOOKS.conner.resetCombat(p); // คอนเนอร์: ความเครียดของทุกคน + คำขาดจับกุม/สถานะไล่ล่า/โควตาฟื้นคืนชีพ
  CHAR_HOOKS.haruka.resetCombat(p); // harukaBasicUses / harukaBleedProcs (โควตารายเทิร์น) + harukaStunPending (สตั้นค้างจากการสวนกลับ)
  CHAR_HOOKS.ippo.resetCombat(p);    // อิปโป: อัตราหลบสะสม / Dempsey Charge / คูลดาวน์รายสกิล
  // ผู้วิงวอน: คลังคำวิงวอน/โควตาสกิล 2 ครั้ง/เทิร์น + ฟิลด์ "ผู้ถูกตราพิพากษา" ซึ่งอยู่ที่ตัวเป้าหมาย (จึงล้างให้ทุกคน)
  CHAR_HOOKS.the_supplicant.resetCombat(p);
  CHAR_HOOKS.oberon_summer.resetCombat(p);  // โอเบรอน (ฤดูร้อน): คูลดาวน์/ล็อกรายช่อง + สตั้นที่จองไว้ (ติดที่เป้าหมาย)
  CHAR_HOOKS.artoria_caster.resetCombat(p); // จอมเวทย์ อาร์โทเรีย: คูลดาวน์สกิลพื้นฐาน/สกิลรอง
  CHAR_HOOKS.reines.resetCombat(p);         // ไรเนส เอลเมลลอย: คูลดาวน์สกิลพื้นฐาน/ท่าไม้ตาย
  CHAR_HOOKS.andersen.resetCombat(p);       // แอนเดอร์เซน: คูลดาวน์สกิลพื้นฐาน + ตัวนับไพ่ที่จั่วเอง
  CHAR_HOOKS.usagi.resetCombat(p); // อุซากิ: โควตาสกิลพื้นฐาน / ปรุๆ / ข้อเสนอสลับไพ่ / โจทย์คณิต (ติดที่ผู้ถูกทำโจทย์)
  CHAR_HOOKS.kim.resetCombat(p); // Bamboo-Hatted Kim: ฝักดาบ/Poise/บัพ/คูลดาวน์ + เหน็บชาที่จองไว้ (ติดที่ผู้ถูกมอบ)
  CHAR_HOOKS.recruit.resetCombat(p); // Recruit: กระสุน / โควตาเตรียมตัว / ตัวนับเกราะ / คูลดาวน์ / QTE ที่ค้าง
  CHAR_HOOKS.striker.resetCombat(p);
  CHAR_HOOKS.takt.resetCombat(p);  // อาซาฮินะ ทักต์: พันธะ/คำเชิญ/โหมดบทเพลง (ฟิลด์ฝั่งมิวสิคคาร์ทอยู่ที่ทุกคน)
  CHAR_HOOKS.titan.resetCombat(p); // ไททัน: ของว่าง/ชุดตีหลายครั้ง/คิวสวนกลับ/ล่อเป้า
  CHAR_HOOKS.cosette.resetCombat(p); // คอเซ็ตต์: ร่าง/ขั้นมิวสิคคาร์ท/ทิ่มแทง/Maestro/Destiny/ตัวนับจั่ว
  CHAR_HOOKS.johnny.resetCombat(p); // จอห์นนี่: ร่าง/เล็บ/Spin/บัฟเฉพาะตัว/คูลดาวน์ + สตั้น Lesson Five ที่ค้าง (ติดที่ทุกคน)
  CHAR_HOOKS.dio.resetCombat(p); // ดิโอ: เกจเวลา/คูลดาวน์/THE WORLD/Last stand + ธง "ถูกแช่" ของ Last stand (อยู่ที่ทุกคน)
  Mark42.resetCombat(p); // เกราะ Mark 42: ชุดที่ใส่อยู่ / ชุดที่ส่งออกไป / คูลดาวน์ซื้อ // สไตรเกอร์ ยูเรก้า: โหมดมือมีด/หมัดเหล็ก/นับถอยหลังระเบิด/งานช่าง + สตั้นค้างของเป้าหมาย (p.pair ไม่ถูกล้าง)
  // ไบรอัน: น้ำมัน/ตัวสะสมน้ำมันที่รถกิน/ธงวีดีโอครั้งแรก + ธง "ถูกแช่" ที่อยู่ที่ผู้เล่นทุกคน
  CHAR_HOOKS.brian.resetCombat(p);
  // โปรดิวเซอร์: ไอดอลที่ยืนอยู่ / เลือดโปรดิวเซอร์ / แต้ม "ไอดอล" / คิวดาเมจหน่วง ฯลฯ
  CHAR_HOOKS.producer_lumi.resetCombat(p);
  CHAR_HOOKS.bat_ben.resetCombat(p); // แบทแมน: ร่างรถแบทโมบิล + โควตากดครั้งเดียวต่อเกม
  CHAR_HOOKS.yui.resetCombat(p);   // ยุย โยชิโอกะ: เพลงที่เล่นแล้ว / คิวชุบชีวิต / ธงกันลูปการจั่วตาม
  CHAR_HOOKS.shido.resetCombat(p); // อิสึกะ ชิโด: ดาเมจที่บันทึกไว้ / กับดักฝากด้วยนะตัวฉัน / คิวเกิดใหม่
  CHAR_HOOKS.dan.resetCombat(p); // โมโรโบชิ ดัน: เป้าหมาย "จงหลบแต่อย่าหนี" / ศิษย์ / สตรีคแพ้แต้มติดกัน
  CHAR_HOOKS.eiji.resetCombat(p); // eijiOrdinal (สแตค Ordinal Scale ของเทิร์นนี้) + eijiDodgeUsedRound (โควตาหลบ 1 ครั้ง/เทิร์น)
  CHAR_HOOKS.cayenne.resetCombat(p);
  CHAR_HOOKS.daichi.resetCombat(p); // ไดจิ: การ์ดไซเบอร์ / เกราะ / การ์ดที่ตัดเก็บไว้ / สตั้นค้างจากเกราะเอเลคิง (ติดที่ผู้เล่นทุกคน) // คาเยนน์: กระสุน / แรงใจ / ชุดกระสุนที่บรรจุไว้ / คิวความเสียหายที่เลื่อนไว้
  CHAR_HOOKS.muimi.resetCombat(p); // มุยมิ: โควตาเสบียง / สตรีคหัวใจนักสู้ / จำนวนครั้งท่าไม้ตาย
  // ---------- Bard : คีตกวี (patch 2.2) ----------
  p.bardNotes = [];         // โน้ตในช่องประพันธ์เพลง (["R","J",...] สูงสุด 3 — ครบแล้วบรรเลงทันที)
  p.bardNotesUsed = 0;      // จำนวนโน้ตที่เติมในเทิร์นนี้ (จำกัด 2 — มิติโลหิตไม่จำกัด)
  p.bardPending = null;     // บทเพลงที่รอเลือกเป้าหมาย { pattern, name, need, allowSelf }
  p.bloodSection = 0;       // ท่อนทำนองแห่งโลหิต (ครบ 5 = มิติมายาบรรเลงโลหิต)
  p.soulSection = 0;        // ท่อนทำนองแห่งวิญญาณ (ครบ 5 = มิติมายาบรรเลงวิญญาณ)
  p.bardLinks = {};         // Resonance: คู่เชื่อมแยกตาม id Bard เจ้าของบทเพลง
  // ---------- ไค ชิซากิ (kai) ----------
  p.kaiLinkWith = null;     // เชื่อมต่อ (Overhaul#1): id คู่เชื่อม (มิเรอร์กัน — แยกจาก linkedWith ของ Bard)
  p.kaiRivalId = null;      // โทสะระงับด้วยโทสะ (Overhaul#3): id คู่ปรับที่ถูกบังคับโจมตี
  p.kaiSkillUsesRound = 0;   // มือซ้ายแห่งการรังสรรค์/มือขวาแห่งการลงทัณฑ์: งบรวม 2 ครั้งต่อเทิร์น ผสมกันได้อิสระ (เช่น รังสรรค์ 2 ครั้ง, หรือ 1+1)
  // ---------- ผู้สังหารเมจ (mageslayer) ----------
  p.mageslayerMarkedId = null;      // ตราล่าเวท: id เป้าหมายที่มาร์กอยู่ (เคลื่อนย้ายได้)
  p.mageslayerMarks = {};
  p.kaiMarksBy = {};
  p.mageslayerHasMarked = false;    // เคยใช้ Witch Mark หรือยัง (ถาวร — ขับเคลื่อนภาพโปรไฟล์ MS01→MS02)
  p.mageslayerWitchMarkReadyRound = 0; // Witch Mark: รอบที่กลับมาใช้ได้หลังคูลดาวน์ 2 เทิร์น
  p.mageslayerBurdenReadyRound = 0; // Mana Burden: รอบที่กลับมาใช้ได้หลังคูลดาวน์ 7 เทิร์น
  p.mageslayerMarkTick = 0;         // ตราล่าเวท: ตัวนับ "ทุก 2 เทิร์นขโมย 1 หน่วย"
  // ---------- ทาคุมิ ฟุจิวาระ (takumi) ----------
  p.takumiGear = 1;             // เกียร์ธรรมดา: 1-6 เริ่มเกม 1
  p.takumiSkillUsesRound = 0;   // งบสกิลรวม 5 ครั้ง/เทิร์น (พื้นฐาน/รอง/ท่าไม้ตาย ผสมกันได้อิสระ)
  p.takumiBlackoutFired = false; // ถึงจะมองไม่เห็น แต่ฉันยังอยู่: กันยิงซ้ำระหว่างสถานะเดียวกันยังทำงานอยู่
  // ---------- เรียวกิ ชิกิ (patch 2.0.6) ----------
  //  p.shikiUlt คงไว้ตามที่เลือกตอนเข้าห้อง (deatheye | wither) — ไม่รีเซ็ตระหว่างแมตช์
  p.witherAddedBy = {};     // เส้นชีวิตที่ความตายที่โรยราแจก แยกตาม id ชิกิเจ้าของท่า
  // ---------- โอกูริ แคป (Rework) ----------
  p.oguriEnergy = OGURI_ENERGY_START; // Energy: เริ่มเกมได้รับ 8 แต้ม (สะสมสูงสุด 16)
  p.stamina = 0;             // Stamina ชาร์จ: เริ่มเกม 0 หน่วย ได้รับอัตโนมัติทุกเทิร์น
  p.oguriChargeCapBonus = 0; // ความจุ Stamina ชาร์จที่เพิ่มจาก Training (สะสมสูงสุด +48)
  p.oguriZoneTurns = 0;     // นับเทิร์นระหว่างร่าง Zone (แต้มสกิล +1 ทุก 2 เทิร์น)
  p.staggerNext = 0;        // ติดชะงักตอนเริ่มเทิร์นถัดไป (จาก The Beat of Victory)
  // ---------- ซาโตรุ อาเคฟุ (patch 2.0.8.2) ----------
  p.maxHpPenalty = 0;       // Locacaca fruit: Max HP ที่ถูกลดถาวร (ของทุกคน — โดนผลไม้ได้)
  p.wouGuardCd = 0;         // สกิลติดตัวลบล้าง — คูลดาวน์ 2 เทิร์นต่อการใช้ (patch 2.0.8.3)
  p.calamityDraw = 0;       // [Calamity]: จำนวนไพ่ที่ถูกบังคับจั่วตอนเริ่มเทิร์นถัดไป
  p.locaOffer = null;       // ข้อเสนอผลโลกากากาที่ยื่นไว้ รอเป้าหมายตอบ (id เป้าหมาย)
  // ---------- ริต้า เบอร์นัล / ฟีนิกซ์ (patch 2.1.6) ----------
  p.phenexPain = 0;             // ไม่อยากให้ใครต้องเจ็บปวด: ความเจ็บปวดสะสม (ปลดปล่อยตอนตกรอบจริง)
  p.phenexReborn = false;       // ถ้าเลือกได้ อยากเกิดเป็นอะไรหรอ?: เกิดใหม่ไปแล้วหรือยัง (1 ครั้งต่อเกม)
  p.phenexNtdPermanent = false; // เปิด NTD-Sytem ถาวรฟรีจากสกิลติดตัว 1 (แทนสถานะนับเทิร์นปกติ)
  p.phenexLastHitBy = null;     // id ผู้โจมตีล่าสุดที่ทำให้เสียเลือด/เกราะ — ใช้เลือกเป้าปลดปล่อยความเจ็บปวด
  p.phenexReleaseAsk = null;    // ขอแค่ได้พบกันอีก: รอเลือกเป้าหมายปลดปล่อยความเจ็บปวด { pain, options: [id] }
  p.phenexTauntGrace = false;   // ไม่อยากให้ใครต้องเจ็บปวด: ตายเทิร์นที่ท่าไม้ตายหมดเวลาพอดี ยังนับว่าตายขณะทำงาน (patch 2.1.7)
  p.nightTaxTier = null;        // กลางคืน (patch 2.1.7): สกิลที่สุ่มโดนคืนนี้ใช้แต้มมากขึ้น +1 ("basic" | "secondary" | null)
  p.evadeStacks = [];            // หลบหลีก (สถานะ Universal): แต่ละสแตคมีอายุ EVADE_STACK_TURNS เทิร์นของตัวเอง
  p.fortuneIdle = 0;             // โชคลาภ (Bard patch 2.1.7): นับเทิร์นที่ไม่ได้ใช้ (ครบ 3 = หมดฤทธิ์เอง)
  CHAR_HOOKS.tohno.resetCombat(p); // โทโนะ ชิกิ: โหมด/สถานะที่รอ/ชุดโจมตี + รอยร้าวบนตัว (ใครก็ติดได้)
  // ---------- นานายะ ชิกิ (patch 2.1.9) ----------
  p.nanayaEyeOn = false;          // Mystic eye of death perception: เปิด/ปิดได้ระหว่างเกม (ค่าเริ่มต้นปิด)
  p.nanayaToggleUsed = false;     // เปิด/ปิดได้แค่ 1 ครั้งต่อเทิร์น (รีเซ็ตทุกเทิร์นใหม่)
  p.nanayaMissedThisAttack = false; // ใช้ภายในการโจมตีปัจจุบัน: เนตรมารพลาด -> เปิดโอกาสหัวใจฆาตกร
  p.nanayaReattackReady = false;  // หัวใจฆาตกร: กำลังรอเลือกโจมตีซ้ำ/ยกเลิกอยู่
  p.nanayaRestTurn = 0;           // พักผ่อนสักครู่: นับเทิร์น (ครบ 2 = ฟื้นเลือด)
  // ---------- เทเปา (ชิกิ) (patch 2.2 new) ----------
  p.tepeuCookTurns = 0;   // วันนี้อากาศดีจัง: นับถอยหลังทำอาหาร (0 = ไม่ได้ทำอยู่ กดใช้ได้)
  p.tepeuPonderTurns = 0; // เป็นแบบนี้นี่เอง: นับถอยหลังครุ่นคิด (0 = ไม่ได้ครุ่นคิดอยู่ กดใช้ได้/จั่วไพ่ได้)
  p.tepeuEyeTurns = 0;    // นายเป็นคนทำตัวเองนะ: ฉากหลัง/เพลงจบ (แบบโทโนะ ชิกิ) คงอยู่กี่เทิร์น
  p.tepeuLoseStreak = 0;  // แพ้ติดกันกี่เทิร์นแล้ว (ครบเกิน 3 = เส้นชีวิตลด 1 — รีเซ็ตทุกครั้งที่ชนะ)
  p.tepeuKillTargetId = null; // นายเป็นคนทำตัวเองนะ: เป้าหมายที่เล็งไว้ รอผลหลังเปิดไพ่ (afterResolve)
  // ---------- อาริมะ มิยาโกะ (patch 2.2.0) ----------
  p.miyakoComboHits = 0;          // เพลงหมัด อาริมะ: จำนวนครั้งที่ตีไปแล้วในคอมโบปัจจุบัน
  p.miyakoKillResist = 0;         // นั่นพี่จ๋าหรอ?: จำนวนชั้นที่สะสม (ลดโอกาสถูกสังหารทันที 40%/ชั้น)
  // ---------- แบทแมน (เบน แอฟเฟล็ก) (patch 2.2.7) ----------
  p.batNightSaveUsedAt = null; // อัศวินรัตติกาล: กันตายใช้ไปแล้วในคืนที่เท่าไหร่ (null = ยังไม่ใช้เลย)
  p.batKarmaAsk = null;        // นายลืมของน่ะ: รอเลือกเป้าหมายส่งต่อความเสียหาย { dmg, from, options: [id] }
  p.cutsceneShown = {}; // เล่นวีดีโอครั้งเดียวต่อเกม (per match)
  CHAR_HOOKS.ort.resetCombat(p); // ORT สกิลติดตัว 1: ช่องสกิลที่ "ข้อมูลสูญหาย" ของผู้เล่นคนนี้
  p.mercuryPick = null;          // Type Mercury: ตัวละครที่เลือกไว้รอลงสนามเทิร์นถัดไป
  p.lastDamageSourceId = null; p.lastDamageRound = 0; // ผู้ทำดาเมจล่าสุด (ดู adjustIncomingDamage)
  // เลือด/เกราะเริ่มเกม: คำนวณหลังรีเซ็ต statuses/maxHpPenalty แล้วเท่านั้น
  // (maxHpOf/maxArmorOf อ่านค่าพวกนี้ — คำนวณก่อนหน้านั้นจะติดค่าเก่าจากแมตช์ที่แล้ว)
  p.hp = maxHpOf(p);
  p.armor = maxArmorOf(p);
  if (p.characterId === "hisakawa_sister") CHAR_HOOKS.hisakawa_sister.init(p);
}

Object.assign(module.exports, { TEMARI_ANATA_DRAWS, DEBUFF_KEYS });
