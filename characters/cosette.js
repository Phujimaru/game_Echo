// ============================================================
//  คอเซ็ตต์ ชไนเดอร์ (เดสตินี่) — ระดับกลาง · มิวสิคคาร์ท (ระบบพันธะ/บทเพลงอยู่ characters/takt.js)
//
//  สกิลพื้นฐาน เปลี่ยนร่าง (0 · ไม่นับเป็นการใช้สกิล · สลับได้ 1 ครั้ง/เทิร์น) — ก่อนเปิดไพ่
//    มนุษย์ (เริ่มต้น): ต้นเทิร์นฟื้นพลังชีวิต 1 · พลังโจมตี -1
//    พรมลิขิต: พลังโจมตี +2 · ต้นเทิร์นเสียพลังชีวิต 2 (ลดเกราะก่อน · ลดได้ถึงเลือด 1 แล้วหยุด + กลับร่างมนุษย์เอง)
//  สกิลรอง มิวสิคคาร์ทที่แท้จริง (1 · ไม่นับเป็นการใช้สกิล · กดซ้อนได้ 3 ขั้น · มีผลแค่เทิร์นที่กด)
//    ขั้นละ: ตีปกติโดนแล้วเป้าติดลุกไหม้ +1 · หลบการโจมตีปกติ +5%
//  ท่าไม้ตาย ทิ่มแทง (4 · ค้างไว้จนใช้ · กดซ้ำไม่ได้) — ก่อนเปิดไพ่
//    ตีปกติที่ผ่านด่านหลบ: คัดลอกบัฟกลางทั้งหมดของเป้ามาใส่ตัวเอง -> ลบต้านสถานะของเป้า -> ภาระเวท 2 (3 เทิร์น)
//    ถูกหลบ = พลาด ไม่เล่นวีดีโอ ท่ายังค้าง · วีดีโอเต็มครั้งแรกต่อเกม (ก่อนการ์ดสรุปการโจมตี)
//  ระหว่าง "บทเพลงที่ไม่อาจลืม" สกิลรอง/ไม้ตายสลับเป็นชุดบทเพลง และสกิลของร่างปกติไม่ทำงานซ้อน
//    (ทิ่มแทงที่ค้างอยู่ รอไว้ใช้หลังกลับร่างปกติ · มิวสิคคาร์ทที่แท้จริงไม่ทำงาน)
//    สกิลรอง 2 Maestro (3 · คูลดาวน์ 4 นับจากตอนกด): คอนดักเตอร์ได้โชคลาภ 1 · 2 เทิร์น (หรือจนใช้):
//      คอนดักเตอร์ออกหมัดโจมตีปกติ (ถูกหลบก็นับ) -> คอเซ็ตต์ตามตีอีก 1 ครั้ง (เลือกเป้าเอง · เปิดจากหัว endTurn)
//      วีดีโอ takt_destiny_skill2.mp4 ก่อนตามตี (เต็มครั้งแรกต่อเกม)
//    ท่าไม้ตาย 2 Destiny (เลือก I = 8 / II = 12 · item) — คอเซ็ตต์จ่ายแต้มที่มีก่อน คอนดักเตอร์จ่ายส่วนที่ขาด
//      กดได้เมื่อคอนดักเตอร์เลือดมากกว่า 2 · ตอนกด: คอเซ็ตต์ฟื้น 1 แล้วคอนดักเตอร์เสีย 1
//      ค้างจนตีปกติโดน 1 ครั้ง (ถูกหลบ = พลาด บัฟยังอยู่) · วีดีโอทุกครั้งก่อนการ์ดสรุป
//      I: ดาเมจ ×1.5 ปัดขึ้น + ลบต้านสถานะเป้าแล้วติดผกผัน 2 เทิร์น · II: ลบบัฟกลางทั้งหมดของเป้าก่อน แล้วดาเมจ ×2
//      ตัวคูณคิดก่อนคริติคอล (คริซ้อนได้) · บทเพลงหาย = บัฟ Maestro/Destiny ที่ค้างหายด้วย
//  สกิลติดตัว มิวสิคคาร์ท (ปลดล็อกระหว่างบทเพลง)
//    จั่วเองครบทุก 5 ใบ (ข้ามเทิร์นได้ · ไม่นับใบที่แจก) โอกาส 20% ได้โชคลาภ 1
//    พรมลิขิต: ความเสียหายต้นเทิร์นย้ายไปลงคอนดักเตอร์เหลือ 1 (ไม่ตาย ค้างที่ 1)
//    ตีปกติโดน: ฟื้นพลังชีวิตให้คอนดักเตอร์ 1 และตัวเอง 1
//    คอนดักเตอร์เลือดเหลือ 1 หรือตาย -> takt.revertCarts: บทเพลงหาย + สตั้น 2 + onSongLost (กลับร่างมนุษย์ +
//      takt_destiny_low.mp4 เต็มครั้งแรกต่อเกม)
//  สกิลติดตัว โชคชะตา (ไม่ทำงานระหว่างบทเพลง): ร่างพรมลิขิต ตีปกติโดนฟื้นพลังชีวิต 2
//
//  สถานะทั้งหมดอยู่ที่ p.cosette (ไม่ใช่ p.statuses — ไม่ลดเทิร์น/ล้าง/ต้านไม่ได้)
// ============================================================

const takt = require("./takt");
const { stripLatestBuff, BUFF_KEYS } = require("./_universal_status");

const ID = "cosette";
const DIR = "/characters/destiny";
const TDIR = "/characters/takt/destiny";
const IMG = {
  base: `${DIR}/cosette.jpg`,
  destiny: `${DIR}/destiny.jpg`,
  song: `${TDIR}/takt_destiny.png`,
  skill1: `${DIR}/destiny_skill1.webp`,
  skill1Back: `${DIR}/destiny_skill1_back.webp`,
  skill2: `${DIR}/destiny_skill2.jpg`,
  skill3: `${DIR}/destiny_skill3.jpg`,
  maestro: `${TDIR}/takt_destiny_skill2.webp`,
  destinyUlt: `${TDIR}/takt_destiny_skill3.jpg`,
};
const VIDEO = {
  pierce: `${DIR}/destiny_skill3.mp4`,
  song: `${TDIR}/takt_destiny.mp4`,
  low: `${TDIR}/takt_destiny_low.mp4`,
  maestro: `${TDIR}/takt_destiny_skill2.mp4`,
  destinyI: `${TDIR}/takt_destiny_skill3_I.mp4`,
  destinyII: `${TDIR}/takt_destiny_skill3_II.mp4`,
};

const HUMAN_HEAL = 1;
const HUMAN_ATK = -1;
const FATE_ATK = 2;
const FATE_SELF_DMG = 2;
const FATE_TAKT_DMG = 1;
const FATE_HEAL = 2;
const TRUE_MAX = 3;
const TRUE_BURN = 1;
const TRUE_DODGE = 5;
const PIERCE_BURDEN = 2;
const PIERCE_BURDEN_TURNS = 3;
const MAESTRO_COOLDOWN = 4;
const MAESTRO_TURNS = 2;
const MAESTRO_FORTUNE = 1;
const DESTINY_COST = { I: 8, II: 12 };
const DESTINY_MIN_TAKT_HP = 3; // คอนดักเตอร์ต้องเลือดมากกว่า 2 (สูบ 1 แล้วไม่ทำให้บทเพลงพัง)
const INVERT_TURNS = 2;
const DRAW_EVERY = 5;
const DRAW_FORTUNE_PCT = 20;
const CART_HEAL = 1;
const BURN_MAX = 6;

const isCos = (p) => !!p && p.characterId === ID;
const unlocked = (p) => isCos(p) && takt.songActive(p);

function fresh() {
  return {
    form: "human", formRound: 0,
    trueStacks: 0, trueRound: 0,
    pierce: false,
    follow: 0, followPending: false, maestroReady: 0,
    destiny: null,
    draws: 0,
    fx: null, // ผลของหมัดที่กำลังตี { pierce, destiny, videoQueued }
  };
}
function st(p) { return p.cosette || (p.cosette = fresh()); }
function trueStacks(engine, p) { const s = st(p); return s.trueRound === engine.roundNumber ? s.trueStacks : 0; }
function followOn(engine, p) { return st(p).follow >= engine.roundNumber; }

function addBurn(engine, src, t, n) {
  if (!t || !t.alive || !(n > 0) || engine.sameTeam(src, t)) return 0;
  if (engine.resistActive(t)) { engine.log(`🛡️ ${t.name} ต้านสถานะผิดปกติ — ไม่ติดลุกไหม้`); return 0; }
  const before = t.statuses.hburn || 0;
  t.statuses.hburn = Math.min(BURN_MAX, before + n);
  return t.statuses.hburn - before;
}
function stripAllBuffs(t) { let n = 0; while (stripLatestBuff(t)) n++; return n; }
function removeResist(t) {
  if (!((t.statuses.resist || 0) > 0)) return false;
  delete t.statuses.resist;
  if (t.statusAmt) delete t.statusAmt.resist;
  if (t.statusAt) delete t.statusAt.resist;
  return true;
}
// คัดลอกบัฟกลางของเป้ามาใส่ตัวเอง (เทิร์น/จำนวนเท่ากัน · เป้าไม่เสียบัฟ) — คืนจำนวนบัฟที่คัดลอก
function copyBuffs(engine, from, to) {
  let n = 0;
  for (const k of BUFF_KEYS) {
    const turns = from.statuses[k] || 0;
    if (!(turns > 0)) continue;
    if (k === "evade") {
      for (const left of from.evadeStacks || []) engine.grantEvadeStack(to, left);
    } else {
      const amt = from.statusAmt ? from.statusAmt[k] : undefined;
      to.statuses[k] = Math.max(to.statuses[k] || 0, turns);
      if (amt != null) to.statusAmt[k] = Math.max(to.statusAmt[k] || 0, amt);
    }
    n++;
  }
  return n;
}
// ความเสียหายต้นเทิร์นของพรมลิขิต: ลดเกราะก่อน · ลดเลือดได้ถึง 1 แล้วหยุด — คืนจำนวนที่ลงจริง
function fateSelfDamage(engine, p, n) {
  let done = 0;
  for (let i = 0; i < n; i++) {
    if (p.armor > 0) engine.loseArmor(p);
    else if (p.hp > 1) engine.loseHp(p);
    else break;
    done++;
  }
  return done;
}

module.exports = {
  id: ID,
  IMG, VIDEO,
  HUMAN_HEAL, HUMAN_ATK, FATE_ATK, FATE_SELF_DMG, FATE_TAKT_DMG, FATE_HEAL, TRUE_MAX, TRUE_BURN, TRUE_DODGE,
  PIERCE_BURDEN, PIERCE_BURDEN_TURNS, MAESTRO_COOLDOWN, MAESTRO_TURNS, DESTINY_COST, DESTINY_MIN_TAKT_HP,
  INVERT_TURNS, DRAW_EVERY, DRAW_FORTUNE_PCT, CART_HEAL,
  isCos, unlocked,

  resetCombat(p) { p.cosette = isCos(p) ? fresh() : null; },

  // ---------- ชุดสกิล (useSkill + buildStateFor ใช้สูตรเดียวกัน) ----------
  dynamicSkillFor(p, ch, tier) {
    if (tier === "basic") return st(p).form === "destiny" ? ch.basic2 : ch.basic;
    if (!unlocked(p)) return ch[tier];
    return tier === "secondary" ? ch.secondary2 : tier === "ultimate" ? ch.ultimate2 : ch[tier];
  },
  // Destiny: คอเซ็ตต์จ่ายที่มีก่อน คอนดักเตอร์จ่ายส่วนที่ขาด — null = ช่องนี้ไม่ใช่ Destiny
  destinySplit(engine, p, item) {
    if (!unlocked(p)) return null;
    const cost = DESTINY_COST[item] || DESTINY_COST.I;
    const t = takt.taktOf(engine, p);
    const own = Math.min(Math.max(0, p.skillPoints || 0), cost);
    const need = cost - own;
    const ok = !!DESTINY_COST[item] && !st(p).destiny && !!t && t.alive && t.hp >= DESTINY_MIN_TAKT_HP && (t.skillPoints || 0) >= need;
    return { ok, own, need, cost, tier: item, taktId: t ? t.id : null };
  },

  canUseSkill(engine, p, tier, item) {
    if (!isCos(p)) return true;
    const s = st(p);
    if (tier === "basic") return s.formRound !== engine.roundNumber;
    if (tier === "secondary") return unlocked(p) ? engine.roundNumber >= s.maestroReady && !followOn(engine, p) : trueStacks(engine, p) < TRUE_MAX;
    if (tier === "ultimate") return unlocked(p) ? this.destinySplit(engine, p, item).ok : !s.pierce;
    return true;
  },
  skipsTurnQuota(p, tier) { return isCos(p) && (tier === "basic" || (tier === "secondary" && !unlocked(p))); },

  applyInstantSkill(engine, p, tier, item, split) {
    if (!isCos(p)) return "";
    const s = st(p);
    const round = engine.roundNumber;
    if (tier === "basic") {
      s.form = s.form === "destiny" ? "human" : "destiny";
      s.formRound = round;
      engine.log(s.form === "destiny"
        ? `🗡️ ${p.name} เปลี่ยนร่าง — พรมลิขิต: พลังโจมตี +${FATE_ATK} · ต้นเทิร์นเสียพลังชีวิต ${FATE_SELF_DMG}`
        : `🌸 ${p.name} เปลี่ยนร่าง — มนุษย์: ต้นเทิร์นฟื้นพลังชีวิต ${HUMAN_HEAL} · พลังโจมตี ${HUMAN_ATK}`);
      return s.form === "destiny" ? " — พรมลิขิต" : " — มนุษย์";
    }
    if (tier === "secondary" && unlocked(p)) {
      s.maestroReady = round + MAESTRO_COOLDOWN;
      s.follow = round + MAESTRO_TURNS - 1;
      s.followPending = false;
      const t = takt.taktOf(engine, p);
      if (t && t.alive) t.statuses.fortune = Math.min(engine.BARD_FORTUNE_MAX, (t.statuses.fortune || 0) + MAESTRO_FORTUNE);
      engine.log(`🎼 ${p.name} Maestro — ${t ? `${t.name} ได้โชคลาภ +${MAESTRO_FORTUNE} · ` : ""}${MAESTRO_TURNS} เทิร์น คอนดักเตอร์ออกหมัดแล้วตามตีอีก 1 ครั้ง`);
      return "";
    }
    if (tier === "secondary") {
      if (s.trueRound !== round) s.trueStacks = 0;
      s.trueStacks++;
      s.trueRound = round;
      engine.log(`🎵 ${p.name} มิวสิคคาร์ทที่แท้จริง ขั้น ${s.trueStacks}/${TRUE_MAX} — เทิร์นนี้ตีโดนลุกไหม้ ${s.trueStacks * TRUE_BURN} · หลบ ${s.trueStacks * TRUE_DODGE}%`);
      return ` (ขั้น ${s.trueStacks}/${TRUE_MAX})`;
    }
    if (tier === "ultimate" && unlocked(p)) {
      const t = engine.players[split && split.taktId];
      if (t && split.need > 0) t.skillPoints = Math.max(0, (t.skillPoints || 0) - split.need);
      s.destiny = split.tier;
      const healed = engine.healHp(p, 1); // ฟื้นก่อน แล้วคอนดักเตอร์ค่อยเสีย
      // ต้นตอเป็นตัวคอนดักเตอร์เอง — ถ้าปล่อยเป็นคอเซ็ตต์ friendlyEffectBlocked (พวกเดียวกัน) จะกันไว้
      if (t && t.alive && t.hp > 1) engine.withEffectSource(t, () => engine.loseHp(t));
      engine.log(`🌌 ${p.name} Destiny ${split.tier} — จ่าย ${split.own}${t && split.need > 0 ? ` · ${t.name} จ่าย ${split.need}` : ""} · สูบพลังชีวิตจาก ${t ? t.name : "คอนดักเตอร์"} 1 (+${healed})`);
      return ` ${split.tier}`;
    }
    if (tier === "ultimate") {
      s.pierce = true;
      engine.log(`🗡️ ${p.name} ทิ่มแทง — ตีปกติครั้งถัดไปคัดลอกบัฟของเป้า ลบต้านสถานะ แล้วมอบภาระเวท ${PIERCE_BURDEN}`);
      return "";
    }
    return "";
  },

  // ---------- ต้นเทิร์น ----------
  onRoundStartTick(engine, p) {
    if (!isCos(p)) return;
    const s = st(p);
    s.fx = null;
    if (s.follow && engine.roundNumber > s.follow) { s.follow = 0; s.followPending = false; }
    if (!p.alive) return;
    if (s.form === "human") {
      const h = engine.healHp(p, HUMAN_HEAL);
      if (h > 0) engine.log(`🌸 ${p.name} ร่างมนุษย์ — ฟื้นพลังชีวิต +${h}`);
      return;
    }
    // พรมลิขิต
    if (unlocked(p)) {
      const t = takt.taktOf(engine, p);
      if (t && t.alive && t.hp > 1) {
        engine.withEffectSource(t, () => { for (let i = 0; i < FATE_TAKT_DMG && t.hp > 1; i++) engine.loseHp(t); });
        engine.log(`🗡️ ${p.name} พรมลิขิต — ความเสียหายไปลงที่ ${t.name} -${FATE_TAKT_DMG} (มิวสิคคาร์ท)`);
      }
      return;
    }
    const dealt = fateSelfDamage(engine, p, FATE_SELF_DMG);
    if (dealt > 0) engine.log(`🗡️ ${p.name} พรมลิขิต — เสียหาย -${dealt} (ลดเกราะก่อน)`);
    if (p.hp <= 1) {
      s.form = "human";
      engine.log(`🌸 ${p.name} พลังชีวิตเหลือ 1 — คืนร่างเป็นมนุษย์`);
    }
  },

  // ---------- บทเพลงพัง (takt.revertCarts) ----------
  onSongLost(engine, p) {
    const s = st(p);
    s.form = "human";
    s.destiny = null;
    s.follow = 0;
    s.followPending = false;
    engine.triggerCutscene(p, "cosetteLow"); // เต็มครั้งแรกต่อเกม
  },

  // ---------- สกิลติดตัว มิวสิคคาร์ท: จั่วครบ 5 ใบ 20% โชคลาภ ----------
  onPlayerDraw(engine, p, n) {
    if (!unlocked(p) || !(n > 0)) return;
    const s = st(p);
    s.draws += n;
    while (s.draws >= DRAW_EVERY) {
      s.draws -= DRAW_EVERY;
      if (Math.random() * 100 < DRAW_FORTUNE_PCT) {
        p.statuses.fortune = Math.min(engine.BARD_FORTUNE_MAX, (p.statuses.fortune || 0) + 1);
        engine.log(`🍀 ${p.name} มิวสิคคาร์ท — จั่วครบ ${DRAW_EVERY} ใบ ได้โชคลาภ +1`);
      }
    }
  },

  // ---------- โจมตีปกติ ----------
  // พลังโจมตีตามร่าง (computeAttackBase — ห้ามแก้ state)
  damageBonus(engine, attacker) {
    if (!isCos(attacker)) return 0;
    return st(attacker).form === "destiny" ? FATE_ATK : HUMAN_ATK;
  },
  // หัว doAttack: ล้างผลของหมัดก่อน · คอนดักเตอร์ออกหมัด -> Maestro ของคอเซ็ตต์ในพันธะจองตามตี
  onAttack(engine, attacker) {
    if (isCos(attacker)) st(attacker).fx = null;
    if (!takt.isTakt(attacker)) return;
    for (const c of takt.bondedCarts(engine, attacker)) {
      if (isCos(c) && c.alive && unlocked(c) && followOn(engine, c)) st(c).followPending = true;
    }
  },
  // มิวสิคคาร์ทที่แท้จริง: หลบการโจมตีปกติ 5% ต่อขั้น (เฉพาะเทิร์นที่กด)
  tryAttackDodge(engine, attacker, target) {
    if (!isCos(target) || !target.alive || unlocked(target)) return false;
    const pct = trueStacks(engine, target) * TRUE_DODGE;
    if (!(pct > 0) || Math.random() * 100 >= pct) return false;
    target.wasAttacked = true;
    engine.log(`💨 หลบหลีก! ${target.name} หลบการโจมตีของ ${attacker.name} ได้ (มิวสิคคาร์ทที่แท้จริง · ${pct}%)`);
    engine.setLastAttack({
      byName: attacker.name, byImg: engine.displayImg(attacker), byColor: engine.colorOf(attacker),
      targetName: target.name, targetImg: engine.displayImg(target), targetColor: engine.colorOf(target),
      dmg: 0, dodge: true,
      skills: [{ name: `มิวสิคคาร์ทที่แท้จริง — หลบหลีก (${pct}%)`, img: IMG.skill2, by: target.name, color: engine.colorOf(target), side: "def" }],
    });
    engine.runCutsceneQueue(() => {
      engine.setGameState("ATTACKING");
      engine.startPhaseTimer(engine.ATTACKFX_TIME, engine.endTurn);
      engine.broadcastState();
    });
    return true;
  },
  // ผ่านด่านหลบแล้ว (ก่อนคิดดาเมจ): ทิ่มแทง / Destiny ลงผลก่อนหมัด + คิววีดีโอ (เล่นก่อนการ์ดสรุป)
  //  คืน fx { pierce, copied, burden, destiny, stripped, videoQueued } หรือ null
  prepareOnAttack(engine, attacker, target) {
    if (!isCos(attacker) || !target) return null;
    const s = st(attacker);
    if (unlocked(attacker) && s.destiny) {
      const tier = s.destiny;
      s.destiny = null;
      const fx = { destiny: tier, stripped: 0, videoQueued: true };
      engine.withEffectSource(attacker, () => {
        if (tier === "II" && !engine.friendlyEffectBlocked(target)) fx.stripped = stripAllBuffs(target);
      });
      engine.queueCutscene(attacker, tier === "II" ? "cosetteDestinyII" : "cosetteDestinyI"); // ทุกครั้ง
      s.fx = fx;
      return fx;
    }
    if (!unlocked(attacker) && s.pierce) {
      s.pierce = false;
      const fx = { pierce: true, copied: copyBuffs(engine, target, attacker), burden: 0, videoQueued: false };
      engine.withEffectSource(attacker, () => {
        removeResist(target);
        for (let i = 0; i < PIERCE_BURDEN; i++) if (engine.applySpellburden(target, PIERCE_BURDEN_TURNS)) fx.burden++;
      });
      fx.videoQueued = !(attacker.cutsceneShown && attacker.cutsceneShown.cosettePierce);
      engine.triggerCutscene(attacker, "cosettePierce"); // เต็มครั้งแรกต่อเกม
      engine.log(`🗡️ ${attacker.name} ทิ่มแทง ${target.name} — คัดลอกบัฟ ${fx.copied} อย่าง · ลบต้านสถานะ · ภาระเวท +${fx.burden}`);
      s.fx = fx;
      return fx;
    }
    return null;
  },
  // Destiny: ตัวคูณดาเมจ (ก่อนคริติคอล)
  damageMultiplier(attacker, dmg) {
    const fx = isCos(attacker) ? st(attacker).fx : null;
    if (!fx || !fx.destiny) return dmg;
    return fx.destiny === "II" ? dmg * 2 : Math.ceil(dmg * 1.5);
  },
  // หมัดลงแล้ว — คืนชื่อเอฟเฟกต์ไว้โชว์บนการ์ดสรุป
  onAttackLanded(engine, attacker, target) {
    if (!isCos(attacker)) return [];
    const s = st(attacker);
    const out = [];
    const fx = s.fx;
    if (fx && fx.pierce) out.push(`ทิ่มแทง — คัดลอกบัฟ ${fx.copied} · ภาระเวท +${fx.burden}`);
    if (fx && fx.destiny) {
      out.push(`Destiny ${fx.destiny} ×${fx.destiny === "II" ? 2 : 1.5}${fx.stripped ? ` · ลบบัฟ ${fx.stripped}` : ""}`);
      if (fx.destiny === "I" && target.alive) {
        engine.withEffectSource(attacker, () => {
          removeResist(target);
          if (engine.applyDebuff(target, "invert", null, INVERT_TURNS)) out.push(`ผกผัน ${INVERT_TURNS} เทิร์น`);
        });
      }
    }
    if (unlocked(attacker)) {
      const t = takt.taktOf(engine, attacker);
      const ht = t && t.alive ? engine.healHp(t, CART_HEAL) : 0;
      const hs = engine.healHp(attacker, CART_HEAL);
      if (ht + hs > 0) out.push(`มิวสิคคาร์ท ฟื้นพลังชีวิต${t ? ` ${t.name} +${ht}` : ""} · ตัวเอง +${hs}`);
    } else {
      const stacks = trueStacks(engine, attacker);
      let burn = 0;
      if (stacks > 0) engine.withEffectSource(attacker, () => { burn = addBurn(engine, attacker, target, stacks * TRUE_BURN); });
      if (burn > 0) out.push(`มิวสิคคาร์ทที่แท้จริง — ลุกไหม้ +${burn}`);
      if (s.form === "destiny") {
        const h = engine.healHp(attacker, FATE_HEAL);
        if (h > 0) out.push(`โชคชะตา ฟื้นพลังชีวิต +${h}`);
      }
    }
    s.fx = null;
    return out;
  },
  // หัว endTurn: คอนดักเตอร์ออกหมัดไปแล้ว -> Maestro ตามตี (วีดีโอก่อน) · คืน true = เปิดแล้ว ผู้เรียกต้อง return
  continueFollow(engine) {
    for (const p of Object.values(engine.players)) {
      if (!isCos(p) || !p.cosette || !p.cosette.followPending) continue;
      const s = p.cosette;
      s.followPending = false;
      if (!p.alive || !unlocked(p) || (p.statuses.stun || 0) > 0 || !engine.attackableTargets(p.id).length) continue;
      s.follow = 0; // ใช้แล้ว
      const open = () => {
        engine.log(`🎼 ${p.name} Maestro — ตามตีต่อจากคอนดักเตอร์`);
        engine.setAttackerId(p.id);
        engine.setGameState("ATTACK");
        engine.startPhaseTimer(engine.ATTACK_TIME, () => {
          const t = engine.attackableTargets(engine.attackerId);
          if (t.length) engine.doAttack(engine.attackerId, t[Math.floor(Math.random() * t.length)].id);
          if (engine.gameState === "ATTACK") engine.endTurn();
        });
        engine.broadcastState();
      };
      engine.triggerCutscene(p, "cosetteMaestro"); // เต็มครั้งแรกต่อเกม
      engine.runCutsceneQueue(open);
      return true;
    }
    return false;
  },

  // ---------- ข้อมูลให้ client ----------
  displayImg(p) {
    if (!isCos(p)) return null;
    if (unlocked(p)) return IMG.song;
    return st(p).form === "destiny" ? IMG.destiny : null;
  },
  publicState(engine, p) {
    if (!isCos(p)) return undefined;
    const s = st(p);
    return {
      form: s.form,
      trueStacks: trueStacks(engine, p),
      pierce: !!s.pierce,
      follow: followOn(engine, p) ? s.follow - engine.roundNumber + 1 : 0,
      destiny: s.destiny || null,
      draws: s.draws,
      unlocked: unlocked(p),
    };
  },
  skillLocks(engine, p) {
    if (!isCos(p)) return undefined;
    const s = st(p);
    const round = engine.roundNumber;
    const on = unlocked(p);
    const anyDestiny = on && (this.destinySplit(engine, p, "I").ok || this.destinySplit(engine, p, "II").ok);
    return {
      basic: { locked: s.formRound === round, free: true },
      secondary: on
        ? { locked: followOn(engine, p), cd: Math.max(0, s.maestroReady - round) }
        : { locked: trueStacks(engine, p) >= TRUE_MAX, free: true },
      ultimate: { locked: on ? !anyDestiny : s.pierce },
    };
  },
};
