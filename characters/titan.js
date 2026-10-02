// ============================================================
//  ไททัน — ระดับง่าย · มิวสิคคาร์ท (ผูกพันธะกับอาซาฮินะ ทักต์ได้ — ระบบพันธะอยู่ characters/takt.js)
//
//  สกิลพื้นฐาน ของว่าง (0 · ไม่นับเป็นการใช้สกิล · 3 ครั้ง/เกม · 1 ครั้ง/เทิร์น) — ก่อนเปิดไพ่
//    ฟื้นพลังชีวิต 2 · แต้มสกิล +3
//  สกิลรอง ซองแฝด (4) — ก่อนเปิดไพ่ · titanTwin 3 เทิร์น: ตีปกติโดนแล้วเป้าติดลุกไหม้ 2 (กดซ้ำ = ต่ออายุ)
//  ท่าไม้ตาย คล่องตัวสูง (4 · กดซ้ำไม่ได้ระหว่างผลยังอยู่ · วีดีโอเต็มครั้งแรกต่อเกม) — ก่อนเปิดไพ่
//    หลบหลีก 2 ครั้ง + titanAgile 3 เทิร์น: ถูกตีปกติ/ถูกสกิลเล็ง/โดนดาเมจสกิล (ไม่ว่าจะเสียหายหรือไม่ · แม้หลบได้)
//    สวนผู้กระทำด้วยพลังโจมตีปกติ ไม่จำกัดครั้ง (หมัดสวนพ่วงช็อตกัน/ซองแฝด/ดูดเลือดด้วย)
//    ตีปกติ: จองที่หัว doAttack ก่อนด่านหลบ -> หมัดลง = สวนในการ์ดสรุปเดียวกัน / ถูกหลบ = สวนตอน flush หัว endTurn
//    สกิล: จองที่ useSkill (เป้าที่เลือก) + adjustIncomingDamage (ดาเมจสกิลหมู่) -> สวนตอน flushOrtCounters
//
//  ระหว่าง "บทเพลงที่ไม่อาจลืม" (taktSong จากท่าไม้ตายของทักต์ · takt.songActive) สกิลรอง/ไม้ตายสลับเป็น
//    สกิลรอง 2 Vigorous Rising Sun (4) — ก่อนเปิดไพ่ · ค้างไว้จนได้โจมตี 1 ชุด (หรือบทเพลงหมด)
//      ชุดนั้นตีได้ 2 ครั้ง + หมัดละลุกไหม้ 1 · วีดีโอก่อนหมัดแรกของชุดทุกครั้ง
//    ท่าไม้ตาย 2 Triumphant (12 · วีดีโอทุกครั้ง แล้วค่อยลงผล) — ไททันจ่ายแต้มทั้งหมดที่มี (ไม่เกิน 12)
//      ทักต์ที่ผูกพันธะจ่ายส่วนที่เหลือ (ทักต์ต้องยังอยู่ · รวมกันไม่ถึง 12 = กดไม่ได้)
//      ศัตรูทุกคน (ไม่โดนทักต์/พวกเดียวกัน) ถูกลบบัฟกลางทั้งหมดแล้วรับดาเมจ 4 (ลดเกราะก่อน · ฆ่าได้)
//      หลังใช้ ไททันติดสตั้น 2 + เปราะบาง 2 ทันที (ต้านไม่ได้)
//    สกิลติดตัว มิวสิคคาร์ท (ปลดล็อก): ตีปกติได้อีก 1 ครั้ง (รวม Vigorous Rising Sun = 3 ครั้ง ครั้งที่ 3 โอกาส 25%)
//      + ตีปกติโดนแล้วฟื้นพลังชีวิตตามดาเมจที่ทำได้ (สูงสุด 2 ต่อครั้ง)
//    ภาพบนสนามเปลี่ยนเป็น takt_titan.jpg (วีดีโอ takt_titan.mp4 เล่นที่ takt.js ตอนได้บทเพลง)
//  สกิลติดตัว 2 ช็อตกัน: ตีปกติ 50% ดาเมจ +1 (ทอยที่ doAttack ไม่ใช่ damageBonus — buildStateFor เรียกทุก broadcast)
//    + หลบการโจมตีปกติ 5%
//
//  ชุดตีหลายครั้ง: p.titan.set { left, n, total, sun } สร้างที่หมัดแรก · หมัดต่อไปเปิดจากหัว endTurn
//    (continueAttack — ถูกหลบก็ตีต่อ แบบเดียวกับคาเยนน์/โทโนะ) · เลือกเป้าใหม่ได้ทุกหมัด
//  สถานะทั้งหมดของตัวละครอยู่ที่ p.titan (ไม่ใช่ p.statuses) ยกเว้น titanTwin / titanAgile ที่นับเทิร์นปกติ
// ============================================================

const takt = require("./takt");
const { stripLatestBuff } = require("./_universal_status");

const ID = "titan";
const DIR = "/characters/titan";
const TDIR = "/characters/takt/titan";
const IMG = {
  base: `${DIR}/titan.jpg`,
  song: `${TDIR}/takt_titan.jpg`,
  skill1: `${DIR}/titan_skill1.jpg`,
  skill2: `${DIR}/titan_skill2.png`,
  skill3: `${DIR}/titan_skill3.jpg`,
  sun: `${TDIR}/takt_titan_skill2.jpg`,
  triumph: `${TDIR}/takt_titan_skill3.webp`,
};
const VIDEO = {
  agile: `${DIR}/titan_skill3.mp4`,
  song: `${TDIR}/takt_titan.mp4`,
  sun: `${TDIR}/takt_titan_skill2.mp4`,
  triumph: `${TDIR}/takt_titan_skill3.mp4`,
};
const HIT_SOUND = "titan_hit"; // คีย์ใน client/src/audio.js

const SNACK_USES = 3;
const SNACK_HEAL = 2;
const SNACK_SP = 3;
const TWIN_TURNS = 3;
const TWIN_BURN = 2;
const AGILE_EVADE = 2;
const AGILE_TURNS = 3;
const SUN_BURN = 1;
const TRIUMPH_COST = 12;
const TRIUMPH_DMG = 4;
const TRIUMPH_STUN = 2;
const TRIUMPH_FRAGILE = 2;
const THIRD_HIT_PCT = 25;
const LIFESTEAL_MAX = 2;
const SHOT_PCT = 50;
const SHOT_BONUS = 1;
const DODGE_PCT = 5;
const BURN_MAX = 6;

const isTitan = (p) => !!p && p.characterId === ID;
const unlocked = (p) => isTitan(p) && takt.songActive(p);
const agile = (p) => isTitan(p) && ((p.statuses.titanAgile || 0) > 0);
const twin = (p) => isTitan(p) && ((p.statuses.titanTwin || 0) > 0);

function fresh() {
  return { snacks: 0, snackRound: 0, sun: false, sunVideo: false, set: null, counterQ: [], shot: false, after: null };
}
function st(p) { return p.titan || (p.titan = fresh()); }

// ลุกไหม้ที่ไททันมอบ — เคารพ "ต้านสถานะผิดปกติ" และพวกเดียวกัน · เพดาน 6
function addBurn(engine, src, t, n) {
  if (!t || !t.alive || !(n > 0) || engine.sameTeam(src, t)) return 0;
  if (engine.resistActive(t)) { engine.log(`🛡️ ${t.name} ต้านสถานะผิดปกติ — ไม่ติดลุกไหม้`); return 0; }
  const before = t.statuses.hburn || 0;
  t.statuses.hburn = Math.min(BURN_MAX, before + n);
  return t.statuses.hburn - before;
}
// ลบบัฟกลางทั้งหมด (BUFF_KEYS) — คืนจำนวนที่ลบได้
function stripAllBuffs(t) {
  let n = 0;
  while (stripLatestBuff(t)) n++;
  return n;
}

module.exports = {
  id: ID,
  IMG, VIDEO, HIT_SOUND,
  SNACK_USES, SNACK_HEAL, SNACK_SP, TWIN_TURNS, TWIN_BURN, AGILE_EVADE, AGILE_TURNS, SUN_BURN,
  TRIUMPH_COST, TRIUMPH_DMG, TRIUMPH_STUN, TRIUMPH_FRAGILE, THIRD_HIT_PCT, LIFESTEAL_MAX, SHOT_PCT, SHOT_BONUS, DODGE_PCT,
  isTitan, unlocked,

  resetCombat(p) { p.titan = isTitan(p) ? fresh() : null; },

  // ---------- ชุดสกิลสลับระหว่างบทเพลง (useSkill + buildStateFor ใช้สูตรเดียวกัน) ----------
  dynamicSkillFor(p, ch, tier) {
    if (!unlocked(p)) return ch[tier];
    if (tier === "secondary") return ch.secondary2;
    if (tier === "ultimate") return ch.ultimate2;
    return ch[tier];
  },
  // Triumphant: ไททันจ่ายก่อนทั้งหมดที่มี ทักต์จ่ายส่วนที่เหลือ — null = ช่องนี้ไม่ใช่ Triumphant
  triumphSplit(engine, p) {
    if (!unlocked(p)) return null;
    const t = takt.taktOf(engine, p);
    const own = Math.min(Math.max(0, p.skillPoints || 0), TRIUMPH_COST);
    const need = TRIUMPH_COST - own;
    const ok = !!t && t.alive && (t.skillPoints || 0) >= need;
    return { ok, own, need, taktId: t ? t.id : null };
  },

  canUseSkill(engine, p, tier) {
    if (!isTitan(p)) return true;
    const s = st(p);
    if (tier === "basic") return s.snacks < SNACK_USES && s.snackRound !== engine.roundNumber;
    if (tier === "secondary") return !unlocked(p) || !s.sun;
    if (tier === "ultimate") return unlocked(p) ? this.triumphSplit(engine, p).ok : !agile(p);
    return true;
  },
  skipsTurnQuota(p, tier) { return isTitan(p) && tier === "basic"; },

  applyInstantSkill(engine, p, tier, split) {
    if (!isTitan(p)) return "";
    const s = st(p);
    if (tier === "basic") {
      s.snacks++;
      s.snackRound = engine.roundNumber;
      const hp = engine.healHp(p, SNACK_HEAL);
      engine.addSkill(p, SNACK_SP);
      engine.log(`🍙 ${p.name} ของว่าง — ฟื้นพลังชีวิต +${hp} · แต้มสกิล +${SNACK_SP} (เหลือ ${SNACK_USES - s.snacks} ครั้ง)`);
      return ` (เหลือ ${SNACK_USES - s.snacks} ครั้ง)`;
    }
    if (tier === "secondary" && unlocked(p)) {
      s.sun = true;
      s.sunVideo = false;
      engine.log(`☀️ ${p.name} Vigorous Rising Sun — การโจมตีชุดถัดไปตีได้ 2 ครั้ง หมัดละลุกไหม้ ${SUN_BURN}`);
      return "";
    }
    if (tier === "secondary") {
      p.statuses.titanTwin = TWIN_TURNS;
      engine.log(`🔥 ${p.name} ซองแฝด — ${TWIN_TURNS} เทิร์น ตีปกติโดนแล้วเป้าติดลุกไหม้ ${TWIN_BURN}`);
      return "";
    }
    if (tier === "ultimate" && unlocked(p)) {
      const t = engine.players[split && split.taktId];
      if (t && split.need > 0) t.skillPoints = Math.max(0, (t.skillPoints || 0) - split.need);
      engine.log(`🎺 ${p.name} Triumphant — ไททันจ่าย ${split ? split.own : 0} แต้ม${t && split.need > 0 ? ` · ${t.name} จ่าย ${split.need} แต้ม` : ""}`);
      engine.queueCutscene(p, "titanTriumph"); // วีดีโอทุกครั้ง แล้วค่อยลงผล (takeAfter)
      s.after = () => this.applyTriumph(engine, p);
      return t && split.need > 0 ? ` (${t.name} ร่วมจ่าย ${split.need})` : "";
    }
    if (tier === "ultimate") {
      let got = 0;
      for (let i = 0; i < AGILE_EVADE; i++) if (engine.grantEvadeStack(p)) got++;
      p.statuses.titanAgile = AGILE_TURNS;
      engine.triggerCutscene(p, "titanAgile"); // เต็มครั้งแรกต่อเกม
      engine.log(`💨 ${p.name} คล่องตัวสูง — หลบหลีก +${got} · ${AGILE_TURNS} เทิร์น ถูกโจมตีหรือถูกสกิลเล็งแล้วสวนกลับ`);
      return "";
    }
    return "";
  },
  // ผลที่ต้องลง "หลังวีดีโอ" (Triumphant) — useSkill ส่งเข้า pausePlayingForCutscene
  takeAfter(p) {
    if (!isTitan(p) || !p.titan || !p.titan.after) return null;
    const fn = p.titan.after;
    p.titan.after = null;
    return fn;
  },
  applyTriumph(engine, p) {
    if (!p.alive) return;
    const foes = engine.attackableTargets(p.id); // ศัตรูที่เล็งได้ (ไม่รวมพวกเดียวกัน/ทักต์ในพันธะ)
    let stripped = 0;
    engine.withEffectSource(p, () => {
      for (const f of foes) {
        if (!f.alive) continue;
        if (!engine.friendlyEffectBlocked(f)) stripped += stripAllBuffs(f);
        engine.dealMixed(f, TRIUMPH_DMG);
        f.wasAttacked = true;
        engine.resolveDamageAftermath(f);
      }
    });
    // ราคาของท่า: สตั้น + เปราะบาง ทันที (ต้านไม่ได้)
    p.statuses.stun = Math.max(p.statuses.stun || 0, TRIUMPH_STUN);
    p.statuses.fragile = Math.max(p.statuses.fragile || 0, TRIUMPH_FRAGILE);
    p.statusAmt.fragile = Math.max(p.statusAmt.fragile || 0, 1);
    engine.log(`🎺 Triumphant — ศัตรู ${foes.length} คนรับความเสียหาย ${TRIUMPH_DMG}${stripped ? ` · ลบบัฟ ${stripped} อย่าง` : ""} · ${p.name} ติดสตั้น ${TRIUMPH_STUN} เทิร์น และเปราะบาง ${TRIUMPH_FRAGILE} เทิร์น`);
  },

  // ---------- ต้นเทิร์น ----------
  onRoundStartTick(engine, p) {
    if (!isTitan(p)) return;
    const s = st(p);
    s.set = null;
    s.counterQ = [];
    s.shot = false;
    if (s.sun && !unlocked(p)) { s.sun = false; s.sunVideo = false; } // บทเพลงหมด = Vigorous Rising Sun ที่ค้างหายไปด้วย
  },

  // ---------- โจมตีปกติ ----------
  attackSound(p) { return isTitan(p) ? HIT_SOUND : undefined; },
  // Vigorous Rising Sun: วีดีโอก่อนหมัดแรกของชุด (doAttack เล่นคลิปแล้วเรียกตัวเองซ้ำ)
  sunNeedsVideo(p) { return isTitan(p) && st(p).sun && !st(p).set && !st(p).sunVideo; },
  startSunVideo(engine, p) {
    st(p).sunVideo = true;
    engine.queueCutscene(p, "titanSun");
  },
  // หัว doAttack (ก่อนด่านหลบ): เริ่มชุดตีถ้ายังไม่มี + ทอยช็อตกันของหมัดนี้
  beginAttack(engine, attacker) {
    if (!isTitan(attacker)) return;
    const s = st(attacker);
    if (!s.set) {
      const sun = s.sun;
      const cart = unlocked(attacker);
      let total = 1 + (sun ? 1 : 0) + (cart ? 1 : 0);
      if (sun && cart && !(Math.random() * 100 < THIRD_HIT_PCT)) total--; // ครั้งที่ 3 โอกาส 25%
      s.set = { left: total - 1, n: 1, total, sun };
      s.sun = false;
      s.sunVideo = false;
      if (total > 1) engine.log(`🥁 ${attacker.name} ${sun ? "Vigorous Rising Sun" : "มิวสิคคาร์ท"} — โจมตีชุดนี้ได้ ${total} ครั้ง`);
    }
    s.shot = Math.random() * 100 < SHOT_PCT;
  },
  shotBonus(attacker) { return isTitan(attacker) && st(attacker).shot ? SHOT_BONUS : 0; },
  // หมัดลงแล้ว — dealt = ความเสียหายที่ลงเลือด+เกราะจริง · คืนชื่อเอฟเฟกต์ไว้โชว์บนการ์ดสรุป
  onAttackLanded(engine, attacker, target, dealt) {
    if (!isTitan(attacker)) return [];
    const s = st(attacker);
    const fx = [];
    if (s.shot) fx.push(`ช็อตกัน +${SHOT_BONUS}`);
    if (s.set && s.set.total > 1) fx.push(`หมัดที่ ${s.set.n}/${s.set.total}`);
    let burn = 0;
    engine.withEffectSource(attacker, () => {
      if (twin(attacker)) burn += addBurn(engine, attacker, target, TWIN_BURN);
      if (s.set && s.set.sun) burn += addBurn(engine, attacker, target, SUN_BURN);
    });
    if (burn > 0) fx.push(`ลุกไหม้ +${burn}`);
    if (unlocked(attacker) && dealt > 0) {
      const h = engine.healHp(attacker, Math.min(LIFESTEAL_MAX, dealt));
      if (h > 0) fx.push(`มิวสิคคาร์ท ฟื้นพลังชีวิต +${h}`);
    }
    const gentle = takt.songHealOnHit(engine, attacker);
    if (gentle > 0) fx.push(`อ่อนโยน ฟื้นพลังชีวิต +${gentle}`);
    s.shot = false;
    return fx;
  },
  // หัว endTurn: ชุดยังตีไม่ครบ -> เปิดเฟสโจมตีหมัดถัดไป (เลือกเป้าใหม่ได้) · คืน true = เปิดแล้ว ผู้เรียกต้อง return
  continueAttack(engine) {
    for (const p of Object.values(engine.players)) {
      if (!isTitan(p) || !p.titan || !p.titan.set) continue;
      const s = p.titan;
      if (!p.alive || s.set.left <= 0 || !engine.attackableTargets(p.id).length) { s.set = null; continue; }
      s.set.left--;
      s.set.n++;
      engine.log(`🥁 ${p.name} โจมตีต่อครั้งที่ ${s.set.n}/${s.set.total}`);
      engine.setAttackerId(p.id);
      engine.setGameState("ATTACK");
      engine.startPhaseTimer(engine.ATTACK_TIME, () => {
        const t = engine.attackableTargets(engine.attackerId);
        if (t.length) engine.doAttack(engine.attackerId, t[Math.floor(Math.random() * t.length)].id);
        if (engine.gameState === "ATTACK") engine.endTurn();
      });
      engine.broadcastState();
      return true;
    }
    return false;
  },

  // ---------- ช็อตกัน: หลบการโจมตีปกติ 5% ----------
  tryAttackDodge(engine, attacker, target) {
    if (!isTitan(target) || !target.alive || Math.random() * 100 >= DODGE_PCT) return false;
    target.wasAttacked = true;
    engine.log(`💨 หลบหลีก! ${target.name} หลบการโจมตีของ ${attacker.name} ได้ (ช็อตกัน · ${DODGE_PCT}%)`);
    engine.setLastAttack({
      byName: attacker.name, byImg: engine.displayImg(attacker), byColor: engine.colorOf(attacker),
      byAttackSound: this.attackSound(attacker),
      targetName: target.name, targetImg: engine.displayImg(target), targetColor: engine.colorOf(target),
      dmg: 0, dodge: true,
      skills: [{ name: `ช็อตกัน — หลบหลีก (${DODGE_PCT}%)`, img: IMG.base, by: target.name, color: engine.colorOf(target), side: "def" }],
    });
    engine.runCutsceneQueue(() => {
      engine.setGameState("ATTACKING");
      engine.startPhaseTimer(engine.ATTACKFX_TIME, engine.endTurn);
      engine.broadcastState();
    });
    return true;
  },

  // ---------- คล่องตัวสูง: จองสวนกลับ ----------
  queueCounter(engine, titan, srcId) {
    const src = engine.players[srcId];
    if (!agile(titan) || !titan.alive || !src || !src.alive || src.id === titan.id || engine.sameTeam(titan, src)) return;
    const q = st(titan).counterQ;
    if (!q.includes(src.id)) q.push(src.id); // การกระทำเดียวโดนหลายก้อน = สวนครั้งเดียว
  },
  // ถูกเลือกเป็นเป้าโจมตีปกติ — เรียกก่อนด่านหลบ (หลบได้ก็ยังสวน)
  onTargeted(engine, attacker, target) {
    if (isTitan(target) && attacker) this.queueCounter(engine, target, attacker.id);
  },
  // ถูกเลือกเป็นเป้าของสกิล (แม้เป็นบัฟ)
  onSkillTargeted(engine, src, targets) {
    if (!src || !Array.isArray(targets)) return;
    for (const id of targets) {
      const t = engine.players[id];
      if (isTitan(t) && t.id !== src.id) this.queueCounter(engine, t, src.id);
    }
  },
  // ดาเมจขาเข้า: ทุ้มต่ำ (บทเพลง) ลด 1 · ดาเมจจากสกิล (รวมสกิลหมู่) -> จองสวนกลับ
  adjustIncomingDamage(engine, p, n, isNormalAttack) {
    if (!isTitan(p)) return n;
    const src = engine.effectSourceId;
    const inAttackPhase = engine.gameState === "ATTACK" || engine.gameState === "ATTACKING";
    if (n > 0 && !isNormalAttack && !p._statusDamage && !p._itemDamage && !p._counterDamage && !inAttackPhase && src && src !== p.id) {
      this.queueCounter(engine, p, src);
    }
    return takt.songIncoming(p, n);
  },
  // หมัดสวน 1 ครั้ง: พลังโจมตีปกติ + ช็อตกัน · พ่วงซองแฝด/ดูดเลือด — คืน { foe, dmg } หรือ null
  counterStrike(engine, titan, foe) {
    if (!titan.alive || titan.hp <= 0 || !foe || !foe.alive || engine.sameTeam(titan, foe)) return null;
    const shot = Math.random() * 100 < SHOT_PCT;
    const dmg = Math.max(0, engine.attackPowerAgainst(titan, foe) || 0) + (shot ? SHOT_BONUS : 0);
    const before = foe.hp + foe.armor;
    engine.withEffectSource(titan, () => {
      foe._counterDamage = true; // ดาเมจสวนกลับ — ORT/Kim/ไททันอีกคนจะไม่สวนตอบ
      try { engine.dealMixed(foe, dmg); } finally { foe._counterDamage = false; }
      foe.wasAttacked = true;
      if (twin(titan)) addBurn(engine, titan, foe, TWIN_BURN);
      const dealt = Math.max(0, before - (foe.hp + foe.armor));
      if (unlocked(titan) && dealt > 0) engine.healHp(titan, Math.min(LIFESTEAL_MAX, dealt));
      engine.resolveDamageAftermath(foe);
    });
    engine.log(`💥 ${titan.name} คล่องตัวสูง — สวนกลับ ${foe.name} -${dmg}${shot ? " (ช็อตกัน +1)" : ""}${foe.alive ? "" : " — ตกรอบ!"}`);
    return { foe, dmg, shot };
  },
  // สวนทุกคนที่จองไว้ — inAttack = เรียกจากการ์ดสรุปการโจมตี (ไม่ยิงป้าย/เสียงแยก การ์ดโชว์ให้เอง)
  //  คืน array ของ { titan, foe, dmg, shot }
  flushCounters(engine, inAttack) {
    const out = [];
    for (const k of Object.values(engine.players)) {
      if (!isTitan(k) || !k.titan || !k.titan.counterQ.length) continue;
      const q = k.titan.counterQ;
      k.titan.counterQ = [];
      for (const id of q) {
        const r = this.counterStrike(engine, k, engine.players[id]);
        if (!r) continue;
        out.push({ titan: k, ...r });
        if (!inAttack) {
          engine.skillFlash({ name: `คล่องตัวสูง — สวนกลับ ${r.foe.name} -${r.dmg}`, img: IMG.skill3, by: k.name, color: engine.colorOf(k) });
          engine.sfx(HIT_SOUND);
        }
      }
    }
    return out;
  },

  // ---------- ข้อมูลให้ client ----------
  displayImg(p) { return unlocked(p) ? IMG.song : null; },
  publicState(engine, p) {
    if (!isTitan(p)) return undefined;
    const s = st(p);
    return {
      snacksLeft: SNACK_USES - s.snacks,
      sun: !!s.sun,
      unlocked: unlocked(p),
      set: s.set ? { n: s.set.n, total: s.set.total } : null,
    };
  },
  skillLocks(engine, p) {
    if (!isTitan(p)) return undefined;
    const s = st(p);
    return {
      basic: { locked: s.snacks >= SNACK_USES || s.snackRound === engine.roundNumber, free: true },
      secondary: { locked: unlocked(p) && s.sun },
      ultimate: { locked: unlocked(p) ? !this.triumphSplit(engine, p).ok : agile(p) },
    };
  },
};
