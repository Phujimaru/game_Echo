// ============================================================
//  ดิโอ แบรนโด (Stardust) — ระดับกลาง · พลังชีวิต 6 / เกราะ 4 / แต้มสกิลสูงสุด 8 (เริ่ม 0)
//
//  ทรัพยากรเฉพาะตัว "เกจเวลา" 0-6 (p.dio.meter) — คิดตอนสรุปแต้มทุกเทิร์น (onRoundResolved)
//    ไพ่ไม่แตก +1 · แต้ม 21 พอดีได้อีก +1 · ไพ่แตก -2 (ไม่ต่ำกว่า 0)
//    เทิร์นที่ถูกแช่ไว้นอกวงดวล (ไบรอัน/คอนเนอร์/Last stand) ไม่นับ — ไพ่แตกแบบบังคับไม่ใช่ความผิดของดิโอ
//
//  สกิลติดตัว Vampire
//    · ทำความเสียหายใส่ศัตรู (ตีปกติโดน / สกิลที่ทำดาเมจ — 1 ครั้งต่อการกด ไม่ใช่ต่อหมัด) -> ฟื้นพลังชีวิต 1
//    · กลางวัน: ทุกครั้งที่โดนตีปกติ/สกิลของศัตรู ความเสียหาย +1 · กลางคืน -1 (ไม่ต่ำกว่า 0)
//      ไม่นับดาเมจจากสถานะ (ลุกไหม้/เลือดไหล ฯลฯ) ไอเทม และดาเมจแพ้รอบ/ไพ่แตก (damageSoft ไม่ผ่าน hook นี้)
//    · Last stand (1 ครั้ง/เกม): ตีปกติ/สกิลของศัตรูที่จะฆ่าดิโอ หรือโดนตอนเลือดเหลือ 1 -> ไม่ตาย ค้างที่ 1
//      แล้วลากผู้โจมตีเข้า [Last stand] ในช่วงจั่วไพ่ของเทิร์นถัดไป: ดวลแต้ม 1 รอบ คนอื่นถูกแช่
//      (โครงเดียวกับ "การแข่งที่มีเดิมพัน" ของไบรอัน — freezeOutsiders / duelResolveRound / skillBlocked)
//      แต้มสูงกว่าแบบไม่แตกชนะ · เสมอหรือแตกทั้งคู่ = ดิโอแพ้ (ตายทันที) · ดิโอชนะ = สูบพลังชีวิต 2
//      ผู้โจมตีตาย/ออกไปก่อนดวล = ยกเลิก
//
//  สกิลพื้นฐาน Throwing knife (3 แต้ม · คูลดาวน์ 2) — ศัตรู 1 คน ดาเมจ 1 (ลดเกราะก่อน) + เลือดไหล 1
//    คลิปง้างมีดเล่นตอนกดปุ่ม (socket "dioKnifeAim" -> aimKnife) แล้วคลิปขว้างเล่นหลังเลือกเป้า
//    ถ้า client ไม่ได้ส่ง aim มา (เช่นเทสต์) จะเล่นทั้งสองคลิปต่อกันหลังเลือกเป้าแทน
//    ทั้งสองคลิปเล่นครั้งแรกต่อเกมเท่านั้น (p.cutsceneShown แยกรายคลิป) — ครั้งต่อไป aimKnife ไม่เล่น/ไม่พักเฟส
//    และคลิปขว้างกลายเป็นการ์ดแจ้งเตือน (notifyTransform แบบ triggerCutscene ครั้งที่ 2)
//  สกิลรอง Barrage (3 แต้ม · คูลดาวน์ 3) — ดาเมจ 1 × 2 เลือกเป้าทีละหมัด (ซ้ำคนเดิมได้) + ผุพัง 2 เทิร์นทุกคนที่โดน
//    คลิปสุ่ม 1 จาก 2 (dioBarrage / dioBarrage2) ทุกครั้งที่กด
//  ท่าไม้ตาย Za warudo!!!!!! (ไม่ใช้แต้มสกิล · คูลดาวน์ 4 · ต้องมีเกจเวลา 1 ขึ้นไป)
//    ใช้เกจเวลาทั้งหมด = แอคชัน แล้วเปิด [THE WORLD]: คนอื่นทุกคนถูกแช่ (รวมไรเดอร์ที่ Clock Up อยู่)
//    คลิปสุ่ม 1 จาก 3 (dioWorld1/2/3) ทุกครั้งที่กด
//    ดิโอเข้าร่างหยุดเวลา — ปุ่มทั้งสามกลายเป็นชุดหยุดเวลา จ่ายด้วยแอคชัน ไม่มีคูลดาวน์ ไม่กินโควตาสกิล
//    ทุกท่าใช้ได้ 1 ครั้งต่อการเปิด THE WORLD (p.dio.world.used — รีเซ็ตทุกครั้งที่กด Za warudo)
//      SHINEI! (3) ดาเมจ 2 + ไร้ทางเยียวยา 2 เทิร์น · Barrage (3) ดาเมจ 1 × 3 เลือกเป้าทีละหมัด + ผุพัง 2 เทิร์น
//      Road Roller (ต้องมี 3 · ใช้หมด) ดาเมจ 2 × 2 เลือกเป้าทีละหมัด แล้ว THE WORLD จบทันที
//    เลือกเป้าทีละหมัด: client ส่ง targets เป็น array ตามจำนวนหมัด (prepareTarget) — id ที่ไม่ใช่ศัตรูที่เล็งได้
//      ถูกแทนด้วยเป้าที่ถูกต้องก่อนหน้า (หรือคนแรกที่ถูกต้อง) · ส่งมาไม่ครบ = หมัดที่เหลือลงเป้าสุดท้าย
//      ไม่มีเป้าที่ถูกต้องเลย = กดไม่ได้ · ตอนลงผล หมัดที่เป้าตายไปแล้วถูกข้าม (ไม่เปลี่ยนเป้าให้) แล้วลงบันทึก
//    THE WORLD จบเมื่อ: ไม่เหลือท่าที่ใช้ได้ (แอคชันไม่พอ/ใช้ครบแล้ว) · ใช้ Road Roller · ครบ 10 วิ (เวลาหยุดนับระหว่างคลิป)
//    ระหว่าง THE WORLD เวลาเฟสจั่วไพ่หยุด — จบแล้วทุกคนกลับมาเฟสเดิมด้วยเวลาที่เหลือตอนกด
//    ⚠️ ตัวจับเวลา 10 วิคือตาข่ายกันห้องค้างในตัว (ดิโอหลุดเน็ตก็จบเองเมื่อครบ) — ไม่มี clearPhaseTimer เฉยๆ
//    หมดเวลา = summary.resolveRound ถูกเรียก -> ดักไว้ที่หัวฟังก์ชันแล้วคืนเวลาให้ (endWorld)
//    checkAllLocked ไม่สรุปรอบระหว่าง THE WORLD (pendingResolve)
//
//  สถานะทั้งหมดอยู่ที่ p.dio (ไม่ใช่ p.statuses — ไม่ลดเทิร์น/ล้าง/ต้านไม่ได้) · p.dioFrozen อยู่ที่ทุกคน
// ============================================================

const ID = "dio";

const MAX_HP = 6;
const MAX_ARMOR = 4;

// ---------- เกจเวลา ----------
const METER_MAX = 6;
const METER_GAIN = 1;        // ไพ่ไม่แตก
const METER_21_BONUS = 1;    // แต้ม 21 พอดี ได้เพิ่มอีก
const METER_BUST_LOSS = 2;   // ไพ่แตก

// ---------- สกิลติดตัว Vampire ----------
const VAMPIRE_HEAL = 1;
const DAY_EXTRA = 1;         // กลางวัน: โดนตี/สกิลศัตรู ความเสียหาย +1
const NIGHT_CUT = 1;         // กลางคืน: -1
const LAST_STAND_DRAIN = 2;  // ชนะดวล: ผู้โจมตีเสียพลังชีวิต 2 ดิโอฟื้น 2

// ---------- สกิล ----------
const KNIFE_CD = 2;
const KNIFE_DMG = 1;
const KNIFE_BLEED = 1;
const BARRAGE_CD = 3;
const BARRAGE_HITS = 2;
const BARRAGE_DMG = 1;
const BARRAGE_DECAY = 2;
const ULT_CD = 4;
const ULT_METER_MIN = 1;

// ---------- THE WORLD ----------
const WORLD_SECONDS = 10;
const SHINE_ACTIONS = 3;
const SHINE_DMG = 2;
const SHINE_NOHEAL = 2;
const TW_BARRAGE_ACTIONS = 3;
const TW_BARRAGE_HITS = 3;
const TW_BARRAGE_DMG = 1;
const TW_BARRAGE_DECAY = 2;
const ROAD_ACTIONS = 3;      // ขั้นต่ำ — กดแล้วใช้แอคชันที่เหลือทั้งหมด
const ROAD_HITS = 2;
const ROAD_DMG = 2;
const TIERS = ["basic", "secondary", "ultimate"];

const DIR = "/characters/dio_brando";
const IMG = {
  base: `${DIR}/dio.webp`,
  knife: `${DIR}/dio_knife.jpg`,
  barrage: `${DIR}/dio_barrage.jpg`,
  timestop: `${DIR}/dio_timestop.jpg`,
  shine: `${DIR}/dio_shine.jpg`,
  roadroller: `${DIR}/dio_roadroller.jpg`,
};
const VIDEO = {
  knifeAim: `${DIR}/dio_skill1.mp4`,
  knifeThrow: `${DIR}/dio_skill1_after.mp4`,
  barrage: `${DIR}/dio_skill2.mp4`,
  barrage2: `${DIR}/dio_skill2_x2.mp4`,
  ult1: `${DIR}/dio_ult1.mp4`,
  ult2: `${DIR}/dio_ult2.mp4`,
  ult3: `${DIR}/dio_ult3.mp4`,
  shine: `${DIR}/dio_shine.mp4`,
  roadroller: `${DIR}/dio_roadroller.mp4`,
  lastStand: `${DIR}/dio_laststand.mp4`,
  lastStandFail: `${DIR}/dio_laststand_fail.mp4`,
};

function isDio(p) { return !!p && p.characterId === ID; }
function st(p) {
  if (!p.dio) p.dio = freshState();
  return p.dio;
}
function freshState() {
  return {
    meter: 0,
    cd: {},              // คูลดาวน์รายช่อง: เลขรอบสุดท้ายที่ยังติดคูลดาวน์ (แบบเดียวกับ ippo.setCooldown)
    world: null,         // { actions, resume, used: { [tier]: true } } ระหว่าง THE WORLD (used = ท่าที่ใช้ไปแล้วในครั้งนี้)
    lastStandUsed: false,
    lastStand: null,     // { attackerId, round, active } — ดวลที่จองไว้/กำลังดวล
    aimRound: 0,         // เทิร์นที่เล่นคลิปง้างมีดไปแล้ว (กันเล่นซ้ำ/กดรัวถ่วงเกม)
    fxHit: null,         // ผลของ Vampire ตอนโดนตีปกติ (ให้การ์ดสรุปการโจมตีอ่าน)
  };
}
function meterOf(p) { return isDio(p) && p.dio ? Math.max(0, Math.min(METER_MAX, p.dio.meter || 0)) : 0; }
function worldOn(p) { return isDio(p) && !!p.alive && !!(p.dio && p.dio.world); }
function worldOwner(engine) { return engine.alivePlayers().find((p) => worldOn(p)) || null; }
function duelOwner(engine) {
  return engine.alivePlayers().find((p) => isDio(p) && p.dio && p.dio.lastStand && p.dio.lastStand.active) || null;
}
// ศัตรูที่ลงมือกับดิโออยู่ตอนนี้ (null = ดาเมจจากสถานะ/ไอเทม/ตัวเอง/ไม่มีต้นตอ)
function enemySource(engine, p) {
  const src = engine.effectSourceId && engine.players[engine.effectSourceId];
  if (!src || src.id === p.id) return null;
  if (p._statusDamage || p._itemDamage) return null;
  return src;
}
// พลังป้องกันรวมของเป้า (ใช้ตัดสินว่า "ทำความเสียหายได้จริง" ไหม)
function guardTotal(p) { return (p.hp || 0) + (p.armor || 0) + (p.shield || 0) + (p.tempHp || 0); }
function tierCost(tier) { return tier === "basic" ? SHINE_ACTIONS : tier === "secondary" ? TW_BARRAGE_ACTIONS : ROAD_ACTIONS; }
// ท่าในร่างหยุดเวลาช่องนี้ยังกดได้ไหม (แอคชันพอ + ยังไม่ได้ใช้ใน THE WORLD ครั้งนี้)
function worldTierOpen(w, tier) { return !!w && !(w.used && w.used[tier]) && (w.actions || 0) >= tierCost(tier); }
function worldAnyOpen(w) { return TIERS.some((t) => worldTierOpen(w, t)); }
// จำนวนหมัดที่ต้องเลือกเป้า (1 = เป้าเดียวแบบเดิม)
function hitsFor(p, tier) {
  if (worldOn(p)) return tier === "secondary" ? TW_BARRAGE_HITS : tier === "ultimate" ? ROAD_HITS : 1;
  return tier === "secondary" ? BARRAGE_HITS : 1;
}
// สุ่ม 1 คลิปจากรายการ (ทุกครั้งที่กด)
function pickClip(keys) { return keys[Math.min(keys.length - 1, Math.floor(Math.random() * keys.length))]; }
// คลิปที่เล่นครั้งแรกต่อเกมเท่านั้น (p.cutsceneShown ล้างทุกแมตช์ใน resetCombat กลาง) — คืน true = คิวคลิปแล้ว
function queueOnce(engine, p, key) {
  if (!p.cutsceneShown) p.cutsceneShown = {};
  if (p.cutsceneShown[key]) return false;
  p.cutsceneShown[key] = true;
  engine.queueCutscene(p, key);
  return true;
}

module.exports = {
  id: ID,
  IMG,
  VIDEO,
  MAX_HP,
  MAX_ARMOR,
  METER_MAX,
  METER_BUST_LOSS,
  KNIFE_CD,
  BARRAGE_CD,
  ULT_CD,
  WORLD_SECONDS,
  SHINE_ACTIONS,
  TW_BARRAGE_ACTIONS,
  ROAD_ACTIONS,
  LAST_STAND_DRAIN,
  isDio,
  meterOf,
  worldOn,
  hitsFor,

  maxHp() { return MAX_HP; },
  maxArmor() { return MAX_ARMOR; },

  resetCombat(p) {
    p.dio = isDio(p) ? freshState() : null;
    p.dioFrozen = false; // ถูกแช่เพราะอยู่นอกวง Last stand (บังคับไพ่แตก) — อยู่ที่ผู้เล่นทุกคน
  },

  // ---------- ภาพ / ปุ่มสกิล ----------
  displayImg(p) { return worldOn(p) ? IMG.timestop : null; },
  // ระหว่าง THE WORLD ปุ่มทั้งสามเป็นชุดหยุดเวลา (basic2/secondary2/ultimate2 ใน characters.js)
  dynamicSkillFor(p, ch, tier) { return worldOn(p) ? (ch[`${tier}2`] || ch[tier]) : ch[tier]; },
  // Za warudo ไม่ใช้แต้มสกิล · ชุดหยุดเวลาจ่ายด้วยแอคชัน — ราคาแต้มสกิลเป็น 0 ทับตัวปรับราคาทุกตัว
  freeCost(p, tier) { return isDio(p) && (tier === "ultimate" || worldOn(p)); },
  // ชุดหยุดเวลาไม่กินโควตาสกิลของเทิร์น (กดต่อกันได้จนแอคชันหมด)
  skipsTurnQuota(p) { return worldOn(p); },
  // ป้ายราคาบนปุ่มระหว่าง THE WORLD (client โชว์แทน "N แต้ม")
  costLabel(p, tier) {
    if (!worldOn(p)) return tier === "ultimate" ? `เกจ ${meterOf(p)}` : null;
    return tier === "ultimate" ? `${ROAD_ACTIONS}+ แอคชัน` : `${tierCost(tier)} แอคชัน`;
  },

  // ---------- คูลดาวน์ (เลขรอบ) ----------
  cooldownLeft(engine, p, tier) {
    if (!isDio(p) || !p.dio) return 0;
    const until = (p.dio.cd && p.dio.cd[tier]) || 0;
    return Math.max(0, until - engine.roundNumber + 1);
  },
  setCooldown(engine, p, tier, turns) {
    const s = st(p);
    s.cd = s.cd || {};
    s.cd[tier] = engine.roundNumber + turns;
  },

  // ---------- useSkill: ด่านก่อนหักแต้ม ----------
  canUseSkill(engine, p, tier) {
    if (!isDio(p)) return true;
    const s = st(p);
    if (worldOn(p)) return worldTierOpen(s.world, tier);
    if (this.duelActive(engine)) return false;
    if (this.cooldownLeft(engine, p, tier) > 0) return false;
    if (tier === "ultimate") return meterOf(p) >= ULT_METER_MIN;
    return true;
  },
  // ทุกท่าที่เล็งต้องเป็นศัตรูที่ยังอยู่ (Za warudo ไม่ต้องเลือกใคร)
  needsTarget(p, tier) { return worldOn(p) || tier !== "ultimate"; },
  validTarget(engine, p, id) {
    const t = engine.players[id];
    if (!t || !t.alive || t.id === p.id) return null;
    if (engine.sameTeam(p, t) || engine.sealActive(t)) return null;
    return t;
  },
  // ท่าหลายหมัด (Barrage / Road Roller) คืน array เป้ารายหมัดยาวเท่าจำนวนหมัด (คนเดิมซ้ำได้)
  //  id ที่เล็งไม่ได้ = ใช้เป้าที่ถูกต้องก่อนหน้า (หมัดแรกผิด = คนแรกที่ถูกต้องในรายการ) · ส่งมาไม่ครบ = ต่อด้วยเป้าสุดท้าย
  prepareTarget(engine, p, targets, tier) {
    const ids = Array.isArray(targets) ? targets : targets != null ? [targets] : [];
    const n = tier ? hitsFor(p, tier) : 1;
    if (n <= 1) return this.validTarget(engine, p, ids[0]);
    const valid = ids.slice(0, n).map((id) => this.validTarget(engine, p, id));
    let last = valid.find(Boolean) || null;
    if (!last) return null;
    const out = [];
    for (let i = 0; i < n; i++) {
      if (valid[i]) last = valid[i];
      out.push(last);
    }
    return out;
  },

  // ---------- ลงผลของสกิล ----------
  applyInstantSkill(engine, p, tier, target) {
    if (!isDio(p)) return "";
    if (worldOn(p)) return this.applyWorldSkill(engine, p, tier, target);
    if (tier === "basic") return this.applyKnife(engine, p, target);
    if (tier === "secondary") return this.applyBarrage(engine, p, target);
    if (tier === "ultimate") return this.startWorld(engine, p);
    return "";
  },

  // ตีเป้า n หมัด (ลดเกราะก่อน · ฆ่าได้) — คืน true ถ้าทำความเสียหายได้จริงอย่างน้อย 1 หน่วย
  hit(engine, p, target, dmg, hits) {
    if (!target || !target.alive) return false;
    const before = guardTotal(target);
    let dealt = false;
    engine.withEffectSource(p, () => {
      for (let i = 0; i < hits; i++) {
        if (!target.alive) break;
        engine.dealMixed(target, dmg);
        target.wasAttacked = true;
      }
      dealt = !target.alive || guardTotal(target) < before;
      engine.resolveDamageAftermath(target);
    });
    if (!target.alive) engine.log(`💀 ${target.name} ตกรอบจากฝีมือของ ${p.name}!`);
    return dealt;
  },
  // Vampire: ทำความเสียหายใส่ศัตรูได้ -> ฟื้นพลังชีวิต 1 (1 ครั้งต่อการกดสกิล / ต่อหมัดโจมตีปกติ)
  vampireHeal(engine, p, why) {
    if (!isDio(p) || !p.alive || engine.passiveSealed(p)) return 0;
    const got = engine.healHp(p, VAMPIRE_HEAL);
    if (got > 0) engine.log(`🧛 ${p.name} Vampire — ดูดเลือดจาก${why} ฟื้นพลังชีวิต +${got}`);
    return got;
  },
  // ตีทีละหมัดตามรายการเป้า (คนเดิมซ้ำได้) — เป้าที่ตายไปแล้วก่อนถึงหมัดนั้นถูกข้าม (ไม่เปลี่ยนเป้าให้)
  //  คืน { dealt, hitList: [{ target, n }] ตามลำดับที่โดนครั้งแรก, skipped }
  multiHit(engine, p, targets, dmg) {
    const list = Array.isArray(targets) ? targets : [targets];
    const counts = new Map();
    let dealt = false, skipped = 0;
    for (const t of list) {
      if (!t || !t.alive) { skipped++; continue; }
      if (this.hit(engine, p, t, dmg, 1)) dealt = true;
      counts.set(t, (counts.get(t) || 0) + 1);
    }
    return { dealt, hitList: [...counts].map(([target, n]) => ({ target, n })), skipped };
  },
  // ข้อความบันทึกของท่าหลายหมัด: "A รับความเสียหาย 1 × 2 · B รับความเสียหาย 1 × 1"
  hitSummary(r, dmg) {
    const parts = r.hitList.map(({ target, n }) => `${target.name} รับความเสียหาย ${dmg} × ${n}`);
    if (r.skipped) parts.push(`ข้าม ${r.skipped} หมัด (เป้าตกรอบไปก่อน)`);
    return parts.join(" · ") || "ไม่มีเป้าเหลือ";
  },

  // ---------- สกิลพื้นฐาน Throwing knife ----------
  //  เรียกจาก socket "dioKnifeAim" ตอนผู้เล่นกดปุ่ม (ก่อนเลือกเป้า) — คืน true = คิวคลิปง้างมีดแล้ว ผู้เรียกต้องพักเฟสเล่นคลิป
  aimKnife(engine, p) {
    if (!isDio(p) || !p.alive || p.locked || engine.gameState !== "PLAYING") return false;
    const s = st(p);
    if (worldOn(p) || s.aimRound === engine.roundNumber) return false;
    if (p.cutsceneShown && p.cutsceneShown.dioKnifeAim) return false; // คลิปง้างเล่นครั้งแรกต่อเกมเท่านั้น (ไม่พักเฟส)
    if (p.skillUsedRound || ((p.statuses && p.statuses.noskill) || 0) > 0) return false;
    if (!this.canUseSkill(engine, p, "basic") || this.skillBlocked(engine, p, "basic")) return false;
    const flow = engine.statusAmtOf(p, "spellflow");
    const free = ((p.statuses && p.statuses.freecast) || 0) > 0;
    const cost = Math.max(0, ((engine.CHAR_BY_ID[ID] || {}).basic || {}).cost - flow);
    if (!free && (p.skillPoints || 0) < cost) return false;
    s.aimRound = engine.roundNumber;
    return queueOnce(engine, p, "dioKnifeAim");
  },
  applyKnife(engine, p, target) {
    const s = st(p);
    // ไม่ได้ง้างผ่านปุ่ม (ไม่มี aim เทิร์นนี้) -> เล่นคลิปง้างต่อหน้าคลิปขว้างแทน · ทั้งสองคลิปครั้งแรกต่อเกมเท่านั้น
    if (s.aimRound !== engine.roundNumber) queueOnce(engine, p, "dioKnifeAim");
    s.aimRound = 0;
    if (!queueOnce(engine, p, "dioKnifeThrow")) engine.notifyTransform(p, "dioKnifeThrow"); // ครั้งต่อไป = การ์ดแจ้งเตือน
    this.setCooldown(engine, p, "basic", KNIFE_CD);
    const dealt = this.hit(engine, p, target, KNIFE_DMG, 1);
    let bled = 0;
    if (target.alive) engine.withEffectSource(p, () => { if (!engine.friendlyEffectBlocked(target)) bled = engine.applyBleed(target, KNIFE_BLEED); });
    engine.log(`🔪 ${p.name} Throwing knife — ${target.name} รับความเสียหาย ${KNIFE_DMG}${bled > 0 ? ` และติดเลือดไหล +${bled}` : target.alive ? " (ต้านเลือดไหลไว้ได้)" : ""}`);
    if (dealt) this.vampireHeal(engine, p, target.name);
    return ` — ${target.name}`;
  },

  // ---------- สกิลรอง Barrage ----------
  //  targets = array เป้ารายหมัดจาก prepareTarget (คลิปสุ่ม 1 จาก 2 ทุกครั้ง)
  applyBarrage(engine, p, targets) {
    engine.queueCutscene(p, pickClip(["dioBarrage", "dioBarrage2"]));
    this.setCooldown(engine, p, "secondary", BARRAGE_CD);
    return this.barrageHits(engine, p, targets, BARRAGE_DMG, BARRAGE_DECAY);
  },
  // ทุกคนที่โดนอย่างน้อย 1 หมัดและยังอยู่ ติดผุพัง (คนละ 1 ครั้ง) · Vampire 1 ครั้งต่อการกด
  barrageHits(engine, p, targets, dmg, decayTurns) {
    const r = this.multiHit(engine, p, targets, dmg);
    const decayed = [];
    for (const { target } of r.hitList) {
      if (!target.alive) continue;
      let ok = false;
      engine.withEffectSource(p, () => { ok = engine.applyDebuff(target, "decay", null, decayTurns); });
      if (ok) decayed.push(target.name);
    }
    engine.log(`👊 ${p.name} Barrage — ${this.hitSummary(r, dmg)}${decayed.length ? ` · ติดผุพัง ${decayTurns} เทิร์น: ${decayed.join(", ")}` : ""}`);
    const names = r.hitList.map((h) => h.target.name).join(", ");
    if (r.dealt) this.vampireHeal(engine, p, names);
    return names ? ` — ${names}` : "";
  },

  // ============================================================
  //  ท่าไม้ตาย Za warudo!!!!!! -> THE WORLD
  // ============================================================
  startWorld(engine, p) {
    const s = st(p);
    const actions = meterOf(p);
    s.meter = 0;
    this.setCooldown(engine, p, "ultimate", ULT_CD);
    // จำเวลาที่เหลือของเฟสจั่วไพ่ไว้ แล้วตั้งนาฬิกาของ THE WORLD แทน — pausePlayingForCutscene() ท้าย useSkill
    //  อ่าน timeLeft ตัวนี้ไปตั้งใหม่หลังคลิปจบ เวลา 10 วิจึงเริ่มนับหลังคลิปเล่นจบ
    //  used = ท่าที่ใช้ไปแล้วใน THE WORLD ครั้งนี้ (ทุกท่า 1 ครั้งต่อการเปิด) — สร้างใหม่ทุกครั้งที่กด Za warudo
    s.world = { actions, resume: Math.max(1, engine.timeLeft || 1), used: {} };
    engine.setTimeLeft(WORLD_SECONDS);
    p.transformAt = engine.nextTransformCounter();
    engine.queueCutscene(p, pickClip(["dioWorld1", "dioWorld2", "dioWorld3"])); // สุ่ม 1 จาก 3 ทุกครั้ง
    engine.log(`⏱️ ${p.name} Za warudo!!!!!! — [THE WORLD] เวลาหยุดนิ่ง! ทุกคนขยับไม่ได้ · ดิโอได้ ${actions} แอคชัน (สูงสุด ${WORLD_SECONDS} วิ)`);
    if (!worldAnyOpen(s.world)) this.endWorld(engine, p, "แอคชันไม่พอใช้ท่าใด");
    return ` — ${actions} แอคชัน`;
  },
  // ปิด THE WORLD แล้วคืนเวลาเฟสจั่วไพ่ที่จำไว้ (คืนค่าเวลาที่คืนให้ · null = ไม่ได้อยู่ใน THE WORLD)
  endWorld(engine, p, why) {
    if (!isDio(p) || !p.dio || !p.dio.world) return null;
    const resume = p.dio.world.resume || 1;
    p.dio.world = null;
    engine.setTimeLeft(resume);
    p.transformAt = engine.nextTransformCounter();
    engine.log(`⏱️ THE WORLD สิ้นสุด${why ? ` (${why})` : ""} — เวลากลับมาเดินต่อ เหลือ ${resume} วิ`);
    return resume;
  },
  // หมดเวลา 10 วิ (resolveRound ถูกเรียกจากตัวจับเวลา) — คืน true = ปิดให้แล้ว ผู้เรียกต้องตั้งเวลาเฟสใหม่
  endWorldOnTimeout(engine) {
    const owner = worldOwner(engine);
    if (!owner) return false;
    this.endWorld(engine, owner, "ครบ 10 วิ");
    return true;
  },
  worldActive(engine) { return !!worldOwner(engine); },
  worldOwner(engine) { return worldOwner(engine); },
  // checkAllLocked: ห้ามสรุปรอบระหว่าง THE WORLD (ทุกคนถูกแช่ ไม่ใช่ "เปิดไพ่ครบ")
  pendingResolve(engine) { return this.worldActive(engine); },

  applyWorldSkill(engine, p, tier, target) {
    const w = st(p).world;
    w.used = w.used || {};
    w.used[tier] = true; // 1 ครั้งต่อ THE WORLD
    let suffix = "";
    if (tier === "basic") {
      w.actions -= SHINE_ACTIONS;
      engine.queueCutscene(p, "dioShine");
      const dealt = this.hit(engine, p, target, SHINE_DMG, 1);
      let sealed = false;
      if (target.alive) engine.withEffectSource(p, () => { sealed = engine.applyDebuff(target, "nohealing", null, SHINE_NOHEAL); });
      engine.log(`✨ ${p.name} SHINEI! — ${target.name} รับความเสียหาย ${SHINE_DMG}${sealed ? ` และติดไร้ทางเยียวยา ${SHINE_NOHEAL} เทิร์น` : ""}`);
      if (dealt) this.vampireHeal(engine, p, target.name);
      suffix = ` — ${target.name}`;
    } else if (tier === "secondary") {
      w.actions -= TW_BARRAGE_ACTIONS;
      engine.queueCutscene(p, pickClip(["dioBarrage", "dioBarrage2"]));
      suffix = this.barrageHits(engine, p, target, TW_BARRAGE_DMG, TW_BARRAGE_DECAY);
    } else if (tier === "ultimate") {
      const spent = w.actions;
      w.actions = 0;
      engine.queueCutscene(p, "dioRoadRoller");
      const r = this.multiHit(engine, p, target, ROAD_DMG);
      engine.log(`🚧 ${p.name} Road Roller! (ใช้ ${spent} แอคชัน) — ${this.hitSummary(r, ROAD_DMG)}`);
      const names = r.hitList.map((h) => h.target.name).join(", ");
      if (r.dealt) this.vampireHeal(engine, p, names);
      this.endWorld(engine, p, "Road Roller");
      return names ? ` — ${names}` : "";
    }
    if (p.dio.world && !worldAnyOpen(p.dio.world)) this.endWorld(engine, p, "ไม่เหลือท่าที่ใช้ได้");
    return suffix;
  },

  // ---------- การแช่ (THE WORLD + Last stand) ----------
  //  THE WORLD: ทุกคนจั่ว/เปิดไพ่/ใช้ไอเทม/ร้านค้าไม่ได้ รวมดิโอเอง (ดิโอทำได้แค่ชุดหยุดเวลา)
  //  Last stand: คนนอกวงถูกแช่ — ดิโอกับคู่ดวลยังจั่ว/เปิดไพ่ได้
  actionBlocked(engine, p) {
    if (!p) return false;
    if (this.worldActive(engine)) return true;
    const owner = duelOwner(engine);
    if (!owner) return false;
    return p.id !== owner.id && p.id !== owner.dio.lastStand.attackerId;
  },
  // ระหว่าง THE WORLD กดสกิลได้แค่เจ้าของท่า · ระหว่าง Last stand ไม่มีใครกดสกิลได้เลย (แบบไบรอัน)
  skillBlocked(engine, p) {
    if (!p) return false;
    const owner = worldOwner(engine);
    if (owner) return owner.id !== p.id;
    return !!duelOwner(engine);
  },
  itemBlocked(engine) { return this.worldActive(engine) || this.duelActive(engine); },

  // ============================================================
  //  สกิลติดตัว Vampire — ความเสียหายขาเข้า (กลางวัน/กลางคืน + Last stand)
  // ============================================================
  adjustIncomingDamage(engine, p, n, isNormalAttack, kind) {
    if (!isDio(p) || !p.alive || !(n > 0)) return n;
    const src = enemySource(engine, p);
    if (!src || engine.passiveSealed(p)) return n;
    const s = st(p);
    const night = !!engine.isNightRound(engine.roundNumber);
    const before = n;
    n = night ? Math.max(0, n - NIGHT_CUT) : n + DAY_EXTRA;
    if (isNormalAttack) s.fxHit = { mod: n - before, night, lastStand: false };
    if (n <= 0 || kind === "armor") return n;
    if (s.lastStandUsed) return n;
    // ส่วนที่รับได้ก่อนเลือดจะลด (โล่ -> เกราะศรัทธา -> เกราะ -> เลือดชั่วคราว) — ทะลุเกราะข้ามเกราะทั้งสองชนิด
    const faith = engine.CHAR_HOOKS.the_supplicant.faithOf(p) || 0;
    const absorb = (p.shield || 0) + (p.tempHp || 0) + (kind === "direct" ? 0 : faith + (p.armor || 0));
    const atOne = p.hp <= 1;
    const lethal = n >= absorb + p.hp;
    if (!atOne && !lethal) return n;
    this.triggerLastStand(engine, p, src);
    if (isNormalAttack && s.fxHit) s.fxHit.lastStand = true;
    return Math.min(n, absorb + Math.max(0, p.hp - 1));
  },
  // ตาข่ายชั้นที่สอง: สังหารทันที (เนตรมาร ฯลฯ) จากศัตรู — instantDeath เรียกก่อนตกรอบจริง
  tryLastStandOnDeath(engine, p) {
    if (!isDio(p) || !p.alive) return false;
    const s = st(p);
    // เทิร์นที่ Last stand เพิ่งทำงาน: ดิโอค้างที่ 1 จนจบเทิร์น (ดาเมจที่ทะลุเพดานของ adjustIncomingDamage มาได้
    //  เช่นหมัดที่ไม่สนการลดดาเมจ หรือโดนซ้ำในเทิร์นเดียวกันก่อนถึงดวล) — ดวลเทิร์นหน้าคือตัวตัดสิน
    if (this.holdingAtOne(engine, p)) { if (p.hp < 1) p.hp = 1; return true; }
    if (s.lastStandUsed || engine.passiveSealed(p)) return false;
    const src = enemySource(engine, p);
    if (!src) return false;
    this.triggerLastStand(engine, p, src);
    if (p.hp < 1) p.hp = 1;
    return true;
  },
  // Last stand ทำงานในเทิร์นนี้และยังรอดวลอยู่ = ห้ามตาย (ค้างที่ 1)
  holdingAtOne(engine, p) {
    const ls = isDio(p) && p.dio && p.dio.lastStand;
    return !!ls && !ls.active && ls.trigRound === engine.roundNumber;
  },
  // maybeBeatSave (ทุกท่อดาเมจเรียกหลังลงดาเมจ): เลือดหมดในเทิร์นที่ Last stand ทำงาน -> ค้างที่ 1
  //  คืน false เสมอ — ไม่ใช่ "กันตาย" ของ Beat Mode (การ์ดสรุปการโจมตีจะได้ไม่ขึ้นป้ายของทาคุโตะ)
  tryDeathSave(engine, p) {
    if (this.holdingAtOne(engine, p) && p.hp < 1) p.hp = 1;
    return false;
  },
  triggerLastStand(engine, p, attacker) {
    const s = st(p);
    s.lastStandUsed = true;
    s.lastStand = { attackerId: attacker.id, round: engine.roundNumber + 1, trigRound: engine.roundNumber, active: false };
    engine.queueCutscene(p, "dioLastStand");
    engine.log(`🩸 ${p.name} Last stand — ไม่ยอมล้ม! พลังชีวิตค้างที่ 1 และลาก ${attacker.name} เข้าสู่การดวลในเทิร์นถัดไป`);
  },

  // ---------- Last stand: เริ่มดวลตอนต้นเทิร์นถัดไป (หลังลูปต้นเทิร์นแจกไพ่ใบแรกแล้ว) ----------
  onRoundStartAfterLoop(engine) {
    for (const p of Object.values(engine.players)) {
      if (!isDio(p) || !p.dio || !p.dio.lastStand || p.dio.lastStand.active) continue;
      const ls = p.dio.lastStand;
      if (engine.roundNumber < ls.round) continue;
      const foe = engine.players[ls.attackerId];
      if (!p.alive || !foe || !foe.alive) {
        p.dio.lastStand = null;
        engine.log(`🩸 Last stand ถูกยกเลิก — ${!p.alive ? p.name : "คู่ดวล"} ไม่อยู่ในสนามแล้ว`);
        continue;
      }
      // มีดวล/ไล่ล่าของคนอื่นค้างอยู่ในเทิร์นนี้ -> เลื่อนไปเทิร์นถัดไป (สองโหมดแช่สนามซ้อนกันไม่ได้)
      if (engine.CHAR_HOOKS.brian.duelActive(engine) || engine.CHAR_HOOKS.conner.chaseActive(engine)) {
        ls.round = engine.roundNumber + 1;
        continue;
      }
      ls.active = true;
      p.transformAt = engine.nextTransformCounter();
      for (const o of engine.alivePlayers()) {
        if (o.id === p.id || o.id === foe.id) continue;
        o.dioFrozen = true; // bustedOf() คืน true — ดาเมจแพ้/แตกถูกระงับทั้งเทิร์นอยู่แล้ว
        o.busted = true;
        o.locked = true;
      }
      engine.log(`🩸 [Last stand] ${p.name} ดวลแต้มกับ ${foe.name}! — คนอื่นถูกแช่ ไม่มีใครกดสกิล/ใช้ไอเทมได้ · แต้มสูงกว่า (ไม่แตก) ชนะ · เสมอหรือแตกทั้งคู่ = ${p.name} แพ้`);
    }
  },
  duelActive(engine) { return !!duelOwner(engine); },
  duelOwner(engine) { return duelOwner(engine); },
  // สรุปรอบระหว่างดวล — คืน true = จัดการเองแล้ว resolveRound() ห้ามทำกติกาปกติต่อ (แบบไบรอัน)
  duelResolveRound(engine) {
    const owner = duelOwner(engine);
    if (!owner) return false;
    const foe = engine.players[owner.dio.lastStand.attackerId];
    for (const o of engine.alivePlayers()) o.result = "safe";
    if (!foe || !foe.alive) {
      engine.log("🩸 Last stand ถูกยกเลิก — คู่ดวลไม่อยู่ในสนามแล้ว");
      this.endDuel(engine, owner);
      return true;
    }
    const mine = engine.bustedOf(owner) ? -1 : engine.scoreOf(owner);
    const theirs = engine.bustedOf(foe) ? -1 : engine.scoreOf(foe);
    engine.log(`🩸 ผลการดวล Last stand — ${owner.name} ${mine < 0 ? "ไพ่แตก" : `${mine} แต้ม`} vs ${foe.name} ${theirs < 0 ? "ไพ่แตก" : `${theirs} แต้ม`}`);
    if (mine > theirs) {
      let lost = 0;
      engine.withEffectSource(owner, () => {
        for (let i = 0; i < LAST_STAND_DRAIN; i++) {
          if (!foe.alive || foe.hp <= 0) break;
          const before = foe.hp;
          engine.loseHp(foe);
          lost += Math.max(0, before - foe.hp);
        }
        foe.wasAttacked = true;
        engine.resolveDamageAftermath(foe);
      });
      const got = engine.healHp(owner, LAST_STAND_DRAIN);
      engine.log(`🧛 ${owner.name} ชนะ Last stand! — สูบพลังชีวิตจาก ${foe.name} ${lost} หน่วย ฟื้นพลังชีวิต +${got}`);
      if (!foe.alive) engine.log(`💀 ${foe.name} ตกรอบจาก Last stand!`);
    } else {
      engine.queueCutscene(owner, "dioLastStandFail");
      engine.log(`💀 ${owner.name} ${mine === theirs ? "เสมอ" : "แพ้"}การดวล Last stand — ตกรอบทันที`);
      this.endDuel(engine, owner);
      engine.withEffectSource(foe, () => engine.instantDeath(owner, true));
      return true;
    }
    this.endDuel(engine, owner);
    return true;
  },
  endDuel(engine, owner) {
    if (owner && owner.dio) owner.dio.lastStand = null;
    for (const o of Object.values(engine.players)) o.dioFrozen = false;
  },
  // เก็บกวาดท้ายเทิร์น: ดวลล่มกลางคัน -> ปลดธง "ถูกแช่" ของทุกคนเสมอ · THE WORLD ไม่ข้ามเทิร์น
  cleanupTurn(engine) {
    if (!this.duelActive(engine)) {
      for (const o of Object.values(engine.players)) {
        if (o.dioFrozen) o.dioFrozen = false;
        if (isDio(o) && o.dio && o.dio.lastStand && o.dio.lastStand.active) o.dio.lastStand = null;
      }
    }
    for (const o of Object.values(engine.players)) if (isDio(o) && o.dio && o.dio.world) this.endWorld(engine, o, "จบเทิร์น");
  },

  onRoundStartTick(engine, p) {
    if (!isDio(p) || !p.dio) return;
    p.dio.fxHit = null;
    if (p.dio.world) p.dio.world = null; // ตาข่าย: THE WORLD ไม่ค้างข้ามเทิร์น
  },

  // ---------- เกจเวลา: ตอนสรุปแต้มของรอบ ----------
  onRoundResolved(engine) {
    for (const p of engine.alivePlayers()) {
      if (!isDio(p)) continue;
      if (p.dioFrozen || p.brianFrozen || p.connorFrozen) continue; // ถูกแช่ = ไพ่แตกแบบบังคับ ไม่นับ
      const s = st(p);
      const before = meterOf(p);
      const busted = engine.bustedOf(p);
      const score = engine.scoreOf(p);
      const delta = busted ? -METER_BUST_LOSS : METER_GAIN + (score === 21 ? METER_21_BONUS : 0);
      s.meter = Math.max(0, Math.min(METER_MAX, before + delta));
      const diff = s.meter - before;
      if (diff !== 0) engine.log(`⏳ ${p.name} เกจเวลา ${diff > 0 ? "+" : ""}${diff} (${s.meter}/${METER_MAX})${busted ? " — ไพ่แตก" : score === 21 ? " — 21 พอดี!" : ""}`);
    }
  },

  // ---------- โจมตีปกติ ----------
  //  เรียกหลังหมัดลงใน doAttack — คืนรายการการ์ดสรุป (ฝั่งผู้ตี = ดูดเลือด · ฝั่งดิโอที่ถูกตี = กลางวัน/คืน + Last stand)
  onAttackLanded(engine, attacker, target, dmg) {
    const fx = [];
    if (isDio(attacker) && target && target.id !== attacker.id && dmg > 0) {
      const got = this.vampireHeal(engine, attacker, target.name);
      if (got > 0) fx.push({ name: `Vampire — ฟื้นพลังชีวิต +${got}`, img: IMG.base, by: attacker.name, side: "atk" });
    }
    if (isDio(target) && target.dio && target.dio.fxHit) {
      const h = target.dio.fxHit;
      target.dio.fxHit = null;
      if (h.mod) fx.push({ name: h.night ? `Vampire (กลางคืน) ${h.mod}` : `Vampire (กลางวัน) +${h.mod}`, img: IMG.base, by: target.name, side: "def" });
      if (h.lastStand) fx.push({ name: "Last stand — ค้างที่ 1", img: IMG.base, by: target.name, side: "def" });
    }
    return fx;
  },

  // ---------- ตกรอบ ----------
  onDeath(engine, p) {
    if (isDio(p) && p.dio) {
      if (p.dio.world) this.endWorld(engine, p, `${p.name} ตกรอบ`);
      if (p.dio.lastStand) this.endDuel(engine, p);
      return;
    }
    // คู่ดวลตกรอบก่อนถึงเวลา/ระหว่างดวล -> ยกเลิก
    for (const d of Object.values(engine.players)) {
      if (!isDio(d) || !d.dio || !d.dio.lastStand || d.dio.lastStand.attackerId !== p.id) continue;
      engine.log(`🩸 Last stand ถูกยกเลิก — ${p.name} ตกรอบไปก่อน`);
      this.endDuel(engine, d);
    }
  },

  // ---------- ข้อมูลให้ client ----------
  publicState(engine, p) {
    if (!isDio(p) || !p.dio) return undefined;
    const s = p.dio;
    const foe = s.lastStand ? engine.players[s.lastStand.attackerId] : null;
    return {
      meter: meterOf(p),
      meterMax: METER_MAX,
      world: worldOn(p) ? { actions: s.world.actions, used: { ...(s.world.used || {}) } } : null,
      picks: { basic: hitsFor(p, "basic"), secondary: hitsFor(p, "secondary"), ultimate: hitsFor(p, "ultimate") }, // จำนวนเป้าที่ client ต้องเลือก (รายหมัด)
      lastStandUsed: !!s.lastStandUsed,
      lastStand: s.lastStand ? { foe: foe ? foe.name : "", active: !!s.lastStand.active } : null,
    };
  },
  // ก้อนข้อมูลสนาม (per-viewer): คนดูถูกแช่ไหม + เจ้าของท่า + แอคชันที่เหลือ
  worldInfo(engine, viewerId) {
    const owner = worldOwner(engine);
    if (!owner) return null;
    return { byId: owner.id, by: owner.name, actions: owner.dio.world.actions, frozen: viewerId !== owner.id };
  },
  duelInfo(engine) {
    const owner = duelOwner(engine);
    if (!owner) return null;
    const foe = engine.players[owner.dio.lastStand.attackerId];
    return { byId: owner.id, by: owner.name, foeId: foe ? foe.id : null, foe: foe ? foe.name : "" };
  },
  // ล็อก/คูลดาวน์รายช่อง (client ใช้ทำปุ่มเทา + ตัวเลขคูลดาวน์ — ดู giftLocks ใน Game.jsx)
  skillLocks(engine, p) {
    if (!isDio(p) || !p.dio) return undefined;
    if (worldOn(p)) {
      const w = p.dio.world;
      return {
        basic: { locked: !worldTierOpen(w, "basic"), free: true },
        secondary: { locked: !worldTierOpen(w, "secondary"), free: true },
        ultimate: { locked: !worldTierOpen(w, "ultimate"), free: true },
      };
    }
    const duel = this.duelActive(engine);
    return {
      basic: { locked: duel, cd: this.cooldownLeft(engine, p, "basic") },
      secondary: { locked: duel, cd: this.cooldownLeft(engine, p, "secondary") },
      ultimate: { locked: duel || meterOf(p) < ULT_METER_MIN, cd: this.cooldownLeft(engine, p, "ultimate") },
    };
  },
};
