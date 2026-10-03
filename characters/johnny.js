// ============================================================
//  จอห์นนี่ โจสตาร์ (Tusk) — ระดับยาก · 4 ร่าง (Act 1 -> Act 4)
//
//  ค่าพื้นฐาน: พลังชีวิต 7 · เกราะ 3 · แต้มสกิล 8 (เริ่ม 0) · พลังโจมตี 1
//  ทรัพยากร "กระสุนเล็บ" 5/5 (เริ่มเต็ม) — โจมตีปกติไม่ใช้ (เสียง nail-shot เป็นแค่เอฟเฟกต์)
//
//  ร่าง (ดูจากสถานะ ไม่เก็บแยก): Pre-Awaken 0 = Act 1 · 1 = Act 2 · 2 = Act 3 · Awakening = Act 4
//    Act 2: คริติคอล 10% (เฉพาะร่าง) · สกิลรอง = Snipe Shot
//    Act 3: หลบการโจมตีปกติ 15% (เฉพาะร่าง · คริ 10% ของ Act 2 ไม่ติดมา) · สกิลรอง = Wormhole Multi Shot
//    Act 4: สกิลรอง = Ora Ora Ora Ora! BeatDown · ท่าไม้ตาย = Lesson Five · Golden Ratio 2 · วีดีโอแปลงร่าง
//           + เพลง johnny_theme ทับเพลงสนามตลอดที่อยู่ร่างนี้ (activeMusic)
//  คริติคอล = ×2 (ทอยรวมใน Journey.applyCrit ผ่าน critBonus)
//
//  สกิลพื้นฐาน (2 · ก่อนเปิดไพ่ · item "tea" | "spin")
//    Herbal Tea Time: ฟื้นพลังชีวิต 1 · กระสุนเล็บ +3-5 (เพดาน 5)
//    Spin Rotation: Spin +1-3 (Spin Mastery +1-2 เพิ่ม) · 20% ได้ Spin Mastery
//  สกิลรอง (คูลดาวน์แยกรายท่า เก็บเป็น "เลขรอบที่กดได้อีกครั้ง")
//    Rapid Shot (Act 1 · 3 + เล็บ 2 · หลังเปิดไพ่ · คูลดาวน์ 3 นับจากตอนได้ตี) — ตีปกติครั้งถัดไปตี 2 ครั้ง
//      (ครั้งที่ 2 เปิดจากหัว endTurn แบบคาเยนน์ — พลาด/ถูกหลบก็ตีต่อ) · แต่ละครั้งพลาดเอง 25%
//      · โดน = หมุนวน +1-2 · ลบ Chumimi ได้ +1
//    Snipe Shot (Act 2 · 4 + เล็บ 2 · เลือกเป้าตอนกด · คูลดาวน์ 4 นับจากตอนยิง) — ชนะการเปิดไพ่เมื่อไหร่
//      ยิงแยกจากการโจมตีปกติที่หัว afterSummary: ดาเมจ 2 (ลดเกราะก่อน + เปราะบาง) · หมุนวน +2-3
//    Wormhole Multi Shot (Act 3 · 5 + เล็บ 3 · ก่อนเปิดไพ่ · คูลดาวน์ 5) — สุ่มยิงศัตรู 3 นัด นัดละ 1
//      (คนละไม่เกิน 2 นัด · ลดเกราะก่อน + เปราะบาง) · นัดละหมุนวน +1-2
//    Ora Ora Ora Ora! BeatDown (Act 4 · 6 · หลังเปิดไพ่ · คูลดาวน์ 5 นับจากตอนได้ตี) — เสีย Golden Ratio 1
//      และกระสุนเล็บทั้งหมด · ตีปกติที่ผ่านด่านหลบครั้งถัดไป +1 ต่อหมุนวน 3 สแตคบนเป้า + มอบ Chumimi · วีดีโอทุกครั้ง
//  ท่าไม้ตาย
//    Tusk Evo Experience (Act 1-3 · 4 + Pre-Awaken ที่ถือ · คูลดาวน์ 5 + Pre-Awaken ที่ถือ · ก่อนเปิดไพ่)
//      Pre-Awaken +1 · ถือครบ 2 แล้วกด = Awakening (Act 4) · เสียง tusk!
//    Lesson Five (Act 4 · 7 + Golden Ratio 1 · หลังเปิดไพ่) — เสีย Golden Ratio 1 + เล็บ 1 · ตีครั้งถัดไป +1
//      เป้ามี Chumimi: ลบทิ้ง +2 · สตั้น 1 เทิร์น (เทิร์นหน้า · ต้านได้) · ไม่สนการลดดาเมจทุกชนิด
//      (คุ้มครอง/Smile for You/เต็มอิ่ม ที่ doAttack + ฮุคลดดาเมจของทุกตัวละครที่ adjustIncomingDamage) · วีดีโอทุกครั้ง
//
//  บัฟเฉพาะตัว (อยู่ที่ p.johnny ไม่ใช่ p.statuses) — ศัตรูปาดบัฟ (stripLatestBuff) ได้ทุกตัว ยกเว้น Pre-Awaken/Awakening
//    (ลงทะเบียนผ่าน registerBuffSource · ตราเวลาจาก nextBuffSeq ตัวเดียวกับบัฟกลาง)
//    Slow Dancer (ได้ตอนเริ่มเกม): กัน 2 ครั้ง — ดีบัฟจากศัตรู (applyDebuff/applySpellburden/applyBleed)
//      หรือสกิลศัตรูที่เล็งจอห์นนี่ (สกิลนั้นไม่มีผลกับจอห์นนี่ทั้งดาเมจและดีบัฟ)
//    Spin (สูงสุด 15): 7+ Spin Energy (ต้นเทิร์นแต้มสกิล +1) · 15 Spinning Skin (ดาเมจที่ได้รับ -1 สองครั้ง
//      แล้วคูลดาวน์ 3 เทิร์น · ไม่ลดดาเมจจากสถานะ)
//      Act 4: Golden Ratio ถูกศัตรูปาด + Spin 15 = แปลง Spin 15 เป็น Golden Ratio 1 (ครั้งเดียวต่อการเข้า Act 4)
//    Golden Ratio (สูงสุด 2): หมด = กลับ Act 1 (สกิลกลับเป็น Rapid Shot / Tusk Evo) · ลบ Awakening
//    Pre-Awaken (สูงสุด 2 · ปาดไม่ได้): คริ +12.5% ต่อสแตค · ทำดาเมจได้ = คูลดาวน์ Tusk Evo -1
//    Awakening (ปาดไม่ได้): พลังโจมตี +1 · ตีโดน/ยิงโดน แต้มสกิล +1
//    Spin Mastery (5 เทิร์น): Spin Rotation ได้ Spin เพิ่ม +1-2
//  ดีบัฟ "หมุนวน" (p.statuses.johnnyWhirl = เทิร์นที่เหลือ · p.statusAmt.johnnyWhirl = สแตค สูงสุด 9)
//    ได้เพิ่มเมื่อไหร่ต่ออายุเป็น 8 เทิร์น · ต้านได้ · ล้างได้ทั้งก้อน (BASIC_DEBUFF_CLEAR)
//    ผู้ติดใช้สกิล/ไอเทม: ทอย 15% ครั้งเดียวต่อการกด -> "การหมุนย้อนกลับ" ดาเมจของสกิลนั้น (dealMixed/dealDirect/
//    dealArmorOnly) ลงผู้ใช้เองแทน และหมุนวน -2 · ดีบัฟที่ลงหลังดาเมจก้อนแรกย้อนกลับด้วย
//    (ไม่ครอบคลุม: ดาเมจที่ลงหลังวีดีโอจบ/หลังเปิดไพ่ และสถานะที่สกิลเขียน p.statuses ตรงๆ)
//  มาร์ก "Chumimi" (p.statuses.johnnyChumimi · 5 เทิร์น · ต้าน/ล้างไม่ได้)
//    Lesson Five ลบ = +2 · Rapid/Snipe/Wormhole โดนแล้วลบ = +1 · ลบเมื่อไหร่เล่นเสียง chumimi
// ============================================================

const { registerBuffSource, nextBuffSeq, statusAmtOf } = require("./_universal_status");

const ID = "johnny";
const DIR = "/characters/johnny";
const IMG = {
  act1: `${DIR}/johnny_act1.png`,
  act2: `${DIR}/johnny_act2.jpg`,
  act3: `${DIR}/johnny_act3.jpg`,
  act4: `${DIR}/johnny_act4.jpeg`,
  skill1: `${DIR}/johnny_skill1.jpg`,
  tea: `${DIR}/johnny_tea.jpg`,
  spin: `${DIR}/johnny_spin.jpg`,
  rapid: `${DIR}/johnny_rapid.webp`,
  snipe: `${DIR}/johnny_snipe.jpg`,
  wormhole: `${DIR}/johnny_wormhole.png`,
  ora: `${DIR}/johnny_ora.jpg`,
  evo: `${DIR}/johnny_tusk_evo.jpg`,
  lesson: `${DIR}/johnny_lesson5.jpg`,
};
const VIDEO = {
  evo: `${DIR}/johnny_act4_evo.mp4`,
  ora: `${DIR}/johnny_ora.mp4`,
  lesson: `${DIR}/johnny_lesson5.mp4`,
};
const SFX = { nail: "johnny_nail", chumimi: "johnny_chumimi", tusk: "johnny_tusk" };
const MUSIC = "johnny_theme";

const NAIL_MAX = 5;
const TEA_HEAL = 1;
const TEA_NAILS = [3, 5];
const SPIN_GAIN = [1, 3];
const SPIN_MAX = 15;
const MASTERY_PCT = 20;
const MASTERY_BONUS = [1, 2];
const MASTERY_TURNS = 5;
const ENERGY_AT = 7;
const SKIN_AT = 15;
const SKIN_USES = 2;
const SKIN_CD = 3;
const SLOW_DANCER = 2;
const GR_MAX = 2;
const PA_MAX = 2;
const CRIT_ACT2 = 10;
const CRIT_PER_PA = 12.5;
const DODGE_ACT3 = 15;
const RAPID = { nails: 2, cd: 3, hits: 2, missPct: 25, whirl: [1, 2] };
const SNIPE = { nails: 2, cd: 4, dmg: 2, whirl: [2, 3] };
const WORM = { nails: 3, cd: 5, shots: 3, perTarget: 2, dmg: 1, whirl: [1, 2] };
const ORA = { cd: 5, per: 3 };
const EVO = { cost: 4, cd: 5 };
const LESSON = { atk: 1, chumimi: 2, stun: 1 };
const SHOT_CHUMIMI = 1;
const WHIRL_MAX = 9;
const WHIRL_TURNS = 8;
const REVERSE_PCT = 15;
const REVERSE_LOSS = 2;
const CHUMIMI_TURNS = 5;

const isJ = (p) => !!p && p.characterId === ID;
const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

function fresh() {
  return {
    nails: NAIL_MAX,
    spin: 0,
    slowDancer: SLOW_DANCER,
    goldenRatio: 0,
    preAwaken: 0,
    awakening: false,
    mastery: 0,              // เทิร์นที่เหลือของ Spin Mastery
    skinUses: SKIN_USES,     // Spinning Skin: ครั้งที่เหลือก่อนติดคูลดาวน์
    skinReady: 0,            // Spinning Skin: รอบที่ใช้ได้อีกครั้ง
    ratioConverted: false,   // แปลง Spin 15 -> Golden Ratio ใช้ไปแล้วใน Act 4 รอบนี้
    at: { slowDancer: 0, spin: 0, goldenRatio: 0, mastery: 0 }, // ตราเวลาสำหรับปาดบัฟ "ล่าสุด"
    cd: { rapid: 0, snipe: 0, wormhole: 0, ora: 0, evo: 0 },     // รอบที่กดได้อีกครั้ง
    rapid: false,            // Rapid Shot ค้างรอโจมตี
    rapidShot: 0,            // กำลังยิงชุด Rapid Shot ครั้งที่เท่าไหร่ (0 = ไม่ได้ยิง)
    rapidTargetId: null,
    snipe: null,             // Snipe Shot ค้างรอชนะ: id เป้า
    ora: false,
    lesson: false,
    fx: null,                // ผลของหมัดที่กำลังตี
  };
}
function st(p) { return p.johnny || (p.johnny = fresh()); }
function formOf(p) {
  if (!isJ(p)) return 0;
  const s = st(p);
  return s.awakening ? 4 : 1 + Math.min(PA_MAX, s.preAwaken);
}
function whirlOf(p) { return p && ((p.statuses && p.statuses.johnnyWhirl) || 0) > 0 ? statusAmtOf(p, "johnnyWhirl") : 0; }
function chumimiOn(p) { return !!p && ((p.statuses && p.statuses.johnnyChumimi) || 0) > 0; }
function cdLeft(engine, s, key) { return Math.max(0, (s.cd[key] || 0) - engine.roundNumber); }
function skinActive(engine, p) {
  const s = st(p);
  return s.spin >= SKIN_AT && engine.roundNumber >= s.skinReady && s.skinUses > 0;
}
function enemiesOf(engine, p) {
  return engine.alivePlayers().filter((t) => t.id !== p.id && !engine.sameTeam(p, t) && !engine.sealActive(t));
}

// engine เป็น singleton — จำไว้ให้ callback ปาดบัฟ (เรียกจาก _universal_status ซึ่งไม่มี engine) ใช้ log ได้
let ENG = null;
const bind = (engine) => { if (engine) ENG = engine; return engine; };
const log = (msg) => { if (ENG) ENG.log(msg); };

// ---------- ทรัพยากร ----------
function setSpin(p, v) {
  const s = st(p);
  const before = s.spin;
  s.spin = Math.max(0, Math.min(SPIN_MAX, v));
  if (s.spin > before) s.at.spin = nextBuffSeq();
  return s.spin - before;
}
function enterAct4(engine, p) {
  const s = st(p);
  s.awakening = true;
  s.preAwaken = 0;
  s.goldenRatio = GR_MAX;
  s.at.goldenRatio = nextBuffSeq();
  s.ratioConverted = false;
  p.transformAt = engine.nextTransformCounter(); // เพลง johnny_theme เริ่มจากต้นทุกครั้งที่เข้า Act 4
  engine.queueCutscene(p, "johnnyEvo");
  engine.log(`🐎 ${p.name} Tusk Act 4 — Awakening! Golden Ratio ${GR_MAX} · พลังโจมตี +1 · สกิลรอง/ท่าไม้ตายเปลี่ยนเป็น Ora Ora Ora Ora! BeatDown / Lesson Five`);
}
function revertAct1(p, why) {
  const s = st(p);
  if (!s.awakening && s.goldenRatio <= 0) return;
  s.awakening = false;
  s.preAwaken = 0;
  s.goldenRatio = 0;
  log(`🌀 ${p.name} Golden Ratio หมด${why ? ` (${why})` : ""} — คืนร่าง Act 1 · สกิลกลับเป็น Rapid Shot / Tusk Evo Experience`);
}
function loseGoldenRatio(p, n) {
  const s = st(p);
  s.goldenRatio = Math.max(0, s.goldenRatio - n);
  if (s.goldenRatio <= 0) revertAct1(p);
}

// ---------- หมุนวน / Chumimi ----------
//  ผ่าน engine.applyDebuff (ต้านสถานะ / พวกเดียวกัน / Slow Dancer ของจอห์นนี่ฝั่งตรงข้าม กันได้หมด)
function addWhirl(engine, src, t, n) {
  if (!t || !t.alive || !(n > 0)) return 0;
  const before = whirlOf(t);
  let ok = false;
  engine.withEffectSource(src, () => { ok = engine.applyDebuff(t, "johnnyWhirl", null, WHIRL_TURNS); });
  if (!ok) return 0;
  t.statuses.johnnyWhirl = WHIRL_TURNS; // ได้เพิ่มเมื่อไหร่ต่ออายุเต็มเสมอ
  t.statusAmt = t.statusAmt || {};
  t.statusAmt.johnnyWhirl = Math.min(WHIRL_MAX, before + n);
  return t.statusAmt.johnnyWhirl - before;
}
function loseWhirl(t, n) {
  const left = whirlOf(t) - n;
  if (left > 0) t.statusAmt.johnnyWhirl = left;
  else {
    delete t.statuses.johnnyWhirl;
    if (t.statusAmt) delete t.statusAmt.johnnyWhirl;
    if (t.statusAt) delete t.statusAt.johnnyWhirl;
  }
}
// มาร์ก — ต้าน/ล้างไม่ได้ จึงเขียน p.statuses ตรง (ไม่อยู่ใน BASIC_DEBUFF_CLEAR)
function giveChumimi(t) { if (t && t.alive) t.statuses.johnnyChumimi = CHUMIMI_TURNS; }
function takeChumimi(engine, t) {
  if (!chumimiOn(t)) return false;
  delete t.statuses.johnnyChumimi;
  engine.sfx(SFX.chumimi);
  return true;
}

// ---------- ยิงด้วยสกิล (Snipe / Wormhole) — แยกจากการโจมตีปกติ ----------
//  ลดเกราะก่อน · บวกเปราะบางเอง (dealMixed ไม่คิดให้ — กับดัก #5) · ลบ Chumimi ได้ +1 · ฆ่าได้
function shotHit(engine, p, t, dmg, whirlRange) {
  const r = { name: t.name, dmg: 0, whirl: 0, chumimi: false };
  if (!t.alive) return r;
  let n = dmg + statusAmtOf(t, "fragile");
  if (takeChumimi(engine, t)) { r.chumimi = true; n += SHOT_CHUMIMI; }
  const before = (t.hp || 0) + (t.armor || 0);
  engine.withEffectSource(p, () => {
    engine.dealMixed(t, n);
    engine.resolveDamageAftermath(t);
  });
  r.dmg = n;
  if (!t.alive) engine.log(`💀 ${t.name} เลือดจริงหมด ตกรอบ!`);
  if (t.alive) r.whirl = addWhirl(engine, p, t, randInt(whirlRange[0], whirlRange[1]));
  if (before - ((t.hp || 0) + (t.armor || 0)) > 0 || !t.alive) onDealtDamage(engine, p);
  return r;
}
// ทำดาเมจได้: Pre-Awaken ลดคูลดาวน์ Tusk Evo 1 · Awakening แต้มสกิล +1 (นับเป็น "ยิงโดน")
function onDealtDamage(engine, p) {
  const s = st(p);
  if (s.preAwaken > 0 && s.cd.evo > engine.roundNumber) s.cd.evo--;
}

// ---------- บริบทการกดสกิล/ไอเทม (หมุนวน + Slow Dancer) ----------
//  เปิดที่ useSkill()/useInventoryItem() ชั้นนอกสุด (ซ้อนกันไม่ได้ — ตัวในคืน null) และปิดใน finally
let useCtx = null;

const strippable = ["slowDancer", "spin", "goldenRatio", "mastery"];
const STRIP_LABEL = { slowDancer: "Slow Dancer", spin: "Spin", goldenRatio: "Golden Ratio", mastery: "Spin Mastery" };
function hasBuff(s, k) {
  if (k === "slowDancer") return s.slowDancer > 0;
  if (k === "spin") return s.spin > 0;
  if (k === "goldenRatio") return s.goldenRatio > 0;
  if (k === "mastery") return s.mastery > 0;
  return false;
}
// ปาดบัฟของจอห์นนี่ (ทั้งก้อน) — Pre-Awaken / Awakening ไม่อยู่ในรายการ
const buffSource = {
  latest(p) {
    if (!isJ(p) || !p.johnny) return null;
    const s = p.johnny;
    let best = null;
    for (const k of strippable) {
      if (!hasBuff(s, k)) continue;
      const at = s.at[k] || 0;
      if (!best || at > best.at) best = { key: `johnny:${k}`, at, turns: 1, label: STRIP_LABEL[k] };
    }
    return best;
  },
  strip(p, key) {
    const s = st(p);
    const k = String(key).replace("johnny:", "");
    if (k === "slowDancer") s.slowDancer = 0;
    else if (k === "spin") s.spin = 0;
    else if (k === "mastery") s.mastery = 0;
    else if (k === "goldenRatio") {
      s.goldenRatio = 0;
      // Act 4: Spin 15 แปลงเป็น Golden Ratio 1 (ครั้งเดียวต่อการเข้า Act 4)
      if (s.awakening && s.spin >= SPIN_MAX && !s.ratioConverted) {
        s.ratioConverted = true;
        s.spin -= SPIN_MAX;
        s.goldenRatio = 1;
        s.at.goldenRatio = nextBuffSeq();
        log(`🌀 ${p.name} Golden Ratio ถูกปาด — แปลง Spin ${SPIN_MAX} เป็น Golden Ratio 1 (ยังอยู่ Act 4)`);
      } else revertAct1(p, "ถูกปาดบัฟ");
    }
    log(`✂️ ${p.name} เสียบัฟ ${STRIP_LABEL[k] || k}`);
    return STRIP_LABEL[k] || k;
  },
};
registerBuffSource(buffSource);

module.exports = {
  id: ID,
  IMG, VIDEO, SFX, MUSIC,
  NAIL_MAX, SPIN_MAX, ENERGY_AT, SKIN_AT, SKIN_USES, SKIN_CD, SLOW_DANCER, GR_MAX, PA_MAX,
  CRIT_ACT2, CRIT_PER_PA, DODGE_ACT3, RAPID, SNIPE, WORM, ORA, EVO, LESSON, SHOT_CHUMIMI,
  WHIRL_MAX, WHIRL_TURNS, REVERSE_PCT, REVERSE_LOSS, CHUMIMI_TURNS, MASTERY_PCT, MASTERY_TURNS,
  isJ, formOf, whirlOf, chumimiOn, addWhirl, buffSource,

  resetCombat(p) {
    p.johnny = isJ(p) ? fresh() : null;
    p.johnnyStunPending = 0; // สตั้นจาก Lesson Five ที่รอเริ่มเทิร์นหน้า (ติดที่เป้าหมาย)
  },

  // ---------- ชุดสกิลตามร่าง (useSkill + buildStateFor ใช้สูตรเดียวกัน) ----------
  dynamicSkillFor(p, ch, tier) {
    if (!isJ(p)) return ch[tier];
    const form = formOf(p);
    if (tier === "secondary") return [ch.secondary, ch.secondary2, ch.secondary3, ch.secondary4][form - 1] || ch.secondary;
    if (tier === "ultimate") {
      if (form === 4) return ch.ultimate2;
      return ch.ultimate ? { ...ch.ultimate, cost: ch.ultimate.cost + st(p).preAwaken } : ch.ultimate;
    }
    return ch[tier];
  },

  snipeTarget(engine, p, targets) {
    const id = Array.isArray(targets) ? targets[0] : null;
    return engine.attackableTargets(p.id).find((t) => t.id === id) || null;
  },
  canUseSkill(engine, p, tier, targets, item) {
    if (!isJ(p)) return true;
    bind(engine);
    const s = st(p);
    const form = formOf(p);
    const round = engine.roundNumber;
    if (tier === "basic") return item === "tea" || item === "spin";
    if (tier === "secondary") {
      if (form === 1) return !s.rapid && !(s.rapidShot > 0) && round >= s.cd.rapid && s.nails >= RAPID.nails;
      if (form === 2) return !s.snipe && round >= s.cd.snipe && s.nails >= SNIPE.nails && !!this.snipeTarget(engine, p, targets);
      if (form === 3) return round >= s.cd.wormhole && s.nails >= WORM.nails && enemiesOf(engine, p).length > 0;
      return !s.ora && round >= s.cd.ora && s.goldenRatio >= 1;
    }
    if (tier === "ultimate") {
      if (form === 4) return !s.lesson && s.goldenRatio >= 1;
      return round >= s.cd.evo;
    }
    return true;
  },

  applyInstantSkill(engine, p, tier, targets, item) {
    if (!isJ(p)) return "";
    bind(engine);
    const s = st(p);
    const form = formOf(p);
    const round = engine.roundNumber;
    if (tier === "basic" && item === "tea") {
      const h = engine.healHp(p, TEA_HEAL);
      const before = s.nails;
      s.nails = Math.min(NAIL_MAX, s.nails + randInt(TEA_NAILS[0], TEA_NAILS[1]));
      engine.log(`🍵 ${p.name} Herbal Tea Time — ฟื้นพลังชีวิต +${h} · กระสุนเล็บ +${s.nails - before} (${s.nails}/${NAIL_MAX})`);
      return ` — Herbal Tea Time · เล็บ ${s.nails}/${NAIL_MAX}`;
    }
    if (tier === "basic") {
      const bonus = s.mastery > 0 ? randInt(MASTERY_BONUS[0], MASTERY_BONUS[1]) : 0;
      const got = setSpin(p, s.spin + randInt(SPIN_GAIN[0], SPIN_GAIN[1]) + bonus);
      let mastery = false;
      if (Math.random() * 100 < MASTERY_PCT) {
        s.mastery = MASTERY_TURNS;
        s.at.mastery = nextBuffSeq();
        mastery = true;
      }
      engine.log(`🌀 ${p.name} Spin Rotation — Spin +${got} (${s.spin}/${SPIN_MAX})${bonus ? " · Spin Mastery" : ""}${mastery ? ` · ได้ Spin Mastery ${MASTERY_TURNS} เทิร์น` : ""}`);
      return ` — Spin ${s.spin}/${SPIN_MAX}${mastery ? " · Spin Mastery" : ""}`;
    }
    if (tier === "secondary" && form === 1) {
      s.nails -= RAPID.nails;
      s.rapid = true;
      engine.log(`💅 ${p.name} Rapid Shot — ตีปกติครั้งถัดไปยิง ${RAPID.hits} นัด`);
      return "";
    }
    if (tier === "secondary" && form === 2) {
      const t = this.snipeTarget(engine, p, targets);
      s.nails -= SNIPE.nails;
      s.snipe = t ? t.id : null;
      engine.log(`🎯 ${p.name} Snipe Shot — เล็งไว้แล้ว ชนะการเปิดไพ่เมื่อไหร่ยิงทันที`);
      return "";
    }
    if (tier === "secondary" && form === 3) {
      s.nails -= WORM.nails;
      s.cd.wormhole = round + WORM.cd;
      const res = this.fireWormhole(engine, p);
      return res.length ? ` — ${res.map((r) => `${r.name} -${r.dmg}`).join(" · ")}` : "";
    }
    if (tier === "secondary") {
      s.ora = true;
      s.nails = 0;
      loseGoldenRatio(p, 1);
      engine.log(`👊 ${p.name} Ora Ora Ora Ora! BeatDown — เสีย Golden Ratio 1 และกระสุนเล็บทั้งหมด · ตีครั้งถัดไปแรงขึ้นตามหมุนวนของเป้า`);
      return "";
    }
    if (tier === "ultimate" && form === 4) {
      s.lesson = true;
      s.nails = Math.max(0, s.nails - 1);
      loseGoldenRatio(p, 1);
      engine.log(`🐎 ${p.name} Lesson Five — เสีย Golden Ratio 1 และกระสุนเล็บ 1 · ตีครั้งถัดไป +${LESSON.atk}`);
      return "";
    }
    if (tier === "ultimate") {
      const held = s.preAwaken;
      s.cd.evo = round + EVO.cd + held;
      engine.sfx(SFX.tusk);
      if (held >= PA_MAX) { enterAct4(engine, p); return " — Act 4"; }
      s.preAwaken = held + 1;
      engine.log(`🐎 ${p.name} Tusk Evo Experience — Pre-Awaken ${s.preAwaken}/${PA_MAX} · เข้าสู่ Act ${s.preAwaken + 1}`);
      return ` — Act ${s.preAwaken + 1}`;
    }
    return "";
  },

  // Wormhole Multi Shot: สุ่มยิง 3 นัด คนละไม่เกิน 2 นัด
  fireWormhole(engine, p) {
    const pool = enemiesOf(engine, p);
    const count = new Map();
    const order = [];
    for (let i = 0; i < WORM.shots; i++) {
      const open = pool.filter((t) => t.alive && (count.get(t.id) || 0) < WORM.perTarget);
      if (!open.length) break;
      const t = open[Math.floor(Math.random() * open.length)];
      count.set(t.id, (count.get(t.id) || 0) + 1);
      order.push(t);
    }
    const res = [];
    for (const t of order) {
      engine.sfx(SFX.nail);
      const r = shotHit(engine, p, t, WORM.dmg, WORM.whirl);
      res.push(r);
      engine.log(`🕳️ ${p.name} Wormhole Multi Shot — ${t.name} -${r.dmg}${r.chumimi ? " (Chumimi +1)" : ""}${r.whirl ? ` · หมุนวน +${r.whirl}` : ""}`);
    }
    return res;
  },

  // ---------- Snipe Shot: ชนะการเปิดไพ่ = ยิงก่อนเฟสโจมตี (หัว afterSummary) ----------
  fireSnipe(engine, p) {
    if (!isJ(p) || !p.alive) return null;
    bind(engine);
    const s = st(p);
    if (!s.snipe) return null;
    const pool = engine.attackableTargets(p.id);
    if (!pool.length) return null;
    const t = pool.find((x) => x.id === s.snipe) || pool[Math.floor(Math.random() * pool.length)];
    s.snipe = null;
    s.cd.snipe = engine.roundNumber + SNIPE.cd;
    engine.sfx(SFX.nail);
    const r = shotHit(engine, p, t, SNIPE.dmg, SNIPE.whirl);
    if (s.awakening) engine.addSkill(p, 1, "passive");
    engine.log(`🎯 ${p.name} Snipe Shot — ${t.name} -${r.dmg}${r.chumimi ? " (Chumimi +1)" : ""}${r.whirl ? ` · หมุนวน +${r.whirl}` : ""}`);
    engine.skillFlash({ name: `Snipe Shot — ${t.name} -${r.dmg}`, img: IMG.snipe, by: p.name, color: engine.colorOf(p) });
    return r;
  },

  // ---------- ต้นเทิร์น (ทุกคน) ----------
  //  สตั้นของ Lesson Five เริ่มมีผล — ต้องอยู่ก่อนบล็อกเช็คสตั้นของ dealRound (แพทเทิร์นเดียวกับ ippo.applyPendingStun)
  onRoundStartTick(engine, p) {
    bind(engine);
    if (p.johnnyStunPending > 0) {
      const turns = p.johnnyStunPending;
      p.johnnyStunPending = 0;
      if (p.alive) {
        if (engine.applyDebuff(p, "stun", null, turns)) engine.log(`😵 ${p.name} โดน Lesson Five เมื่อเทิร์นก่อน — สตั้น ${turns} เทิร์น`);
        else engine.log(`🛡️ ${p.name} ต้านสตั้นของ Lesson Five ไว้ได้`);
      }
    }
    if (!isJ(p)) return;
    const s = st(p);
    s.rapidShot = 0;
    s.fx = null;
    if (s.mastery > 0) {
      s.mastery--;
      if (s.mastery <= 0) engine.log(`🌀 ${p.name} Spin Mastery หมดเวลา`);
    }
    if (p.alive && s.spin >= ENERGY_AT) {
      engine.addSkill(p, 1, "passive");
      engine.log(`🌀 ${p.name} Spin Energy — แต้มสกิล +1`);
    }
  },

  // ---------- โจมตีปกติ ----------
  critBonus(attacker) {
    if (!isJ(attacker)) return 0;
    return (formOf(attacker) === 2 ? CRIT_ACT2 : 0) + CRIT_PER_PA * st(attacker).preAwaken;
  },
  // พลังโจมตี (computeAttackBase — ห้ามแก้ state)
  damageBonus(engine, attacker) {
    if (!isJ(attacker)) return 0;
    const s = st(attacker);
    const fx = s.fx;
    let b = s.awakening ? 1 : 0;
    if (fx) {
      if (fx.lesson) b += LESSON.atk + (fx.lessonChumimi ? LESSON.chumimi : 0);
      if (fx.ora) b += fx.ora;
      if (fx.rapidChumimi) b += SHOT_CHUMIMI;
    }
    return b;
  },
  // หัว doAttack: ล้างผลหมัดก่อน · Rapid Shot ที่ค้างเริ่มชุดยิง (คูลดาวน์นับจากตอนนี้)
  onAttack(engine, attacker, target) {
    if (!isJ(attacker)) return;
    bind(engine);
    const s = st(attacker);
    s.fx = null;
    if (s.rapid && !(s.rapidShot > 0)) {
      s.rapid = false;
      s.rapidShot = 1;
      s.cd.rapid = engine.roundNumber + RAPID.cd;
      engine.log(`💅 ${attacker.name} Rapid Shot — ยิงนัดที่ 1/${RAPID.hits}`);
    }
    if (s.rapidShot > 0 && target) s.rapidTargetId = target.id;
  },
  // ด่านหลบ: Rapid Shot พลาดเอง 25% (ฝั่งผู้ยิง) · Act 3 หลบการโจมตีปกติ 15% (ฝั่งเป้า)
  tryAttackDodge(engine, attacker, target) {
    let miss = null;
    if (isJ(attacker) && st(attacker).rapidShot > 0 && Math.random() * 100 < RAPID.missPct) {
      miss = { name: `Rapid Shot — พลาด (${RAPID.missPct}%)`, img: IMG.rapid, by: attacker, side: "atk" };
      engine.log(`💨 ${attacker.name} Rapid Shot นัดที่ ${st(attacker).rapidShot} พลาดเป้า`);
    } else if (isJ(target) && target.alive && formOf(target) === 3 && Math.random() * 100 < DODGE_ACT3) {
      miss = { name: `Tusk Act 3 — หลบหลีก (${DODGE_ACT3}%)`, img: IMG.act3, by: target, side: "def" };
      engine.log(`💨 หลบหลีก! ${target.name} หลบการโจมตีของ ${attacker.name} ได้ (Tusk Act 3 · ${DODGE_ACT3}%)`);
    }
    if (!miss) return false;
    target.wasAttacked = true;
    engine.setLastAttack({
      byName: attacker.name, byImg: engine.displayImg(attacker), byColor: engine.colorOf(attacker),
      byAttackSound: isJ(attacker) ? SFX.nail : undefined,
      targetName: target.name, targetImg: engine.displayImg(target), targetColor: engine.colorOf(target),
      dmg: 0, dodge: true,
      skills: [{ name: miss.name, img: miss.img, by: miss.by.name, color: engine.colorOf(miss.by), side: miss.side }],
    });
    engine.runCutsceneQueue(() => {
      engine.setGameState("ATTACKING");
      engine.startPhaseTimer(engine.ATTACKFX_TIME, engine.endTurn);
      engine.broadcastState();
    });
    return true;
  },
  // ผ่านด่านหลบแล้ว (ก่อนคิดดาเมจ): ใช้ Lesson Five / Ora ที่ค้าง + ลบ Chumimi + คิววีดีโอ (เล่นก่อนการ์ดสรุป)
  prepareOnAttack(engine, attacker, target) {
    if (!isJ(attacker) || !target) return null;
    bind(engine);
    const s = st(attacker);
    const fx = { videoQueued: false };
    if (s.rapidShot > 0) fx.rapid = s.rapidShot;
    if (s.lesson) {
      s.lesson = false;
      fx.lesson = true;
      if (takeChumimi(engine, target)) { fx.lessonChumimi = true; fx.pierce = true; }
      engine.queueCutscene(attacker, "johnnyLesson");
      fx.videoQueued = true;
    }
    if (s.ora) {
      s.ora = false;
      fx.ora = Math.floor(whirlOf(target) / ORA.per);
      fx.oraStacks = whirlOf(target);
      s.cd.ora = engine.roundNumber + ORA.cd;
      engine.queueCutscene(attacker, "johnnyOra");
      fx.videoQueued = true;
    }
    if (fx.rapid && takeChumimi(engine, target)) fx.rapidChumimi = true;
    s.fx = fx;
    return fx;
  },
  // Lesson Five + Chumimi: หมัดนี้ไม่สนการลดดาเมจทุกชนิด
  piercing(attacker) { return isJ(attacker) && !!(st(attacker).fx && st(attacker).fx.pierce); },
  // หมัดลงแล้ว — คืนชื่อเอฟเฟกต์ไว้โชว์บนการ์ดสรุป
  onAttackLanded(engine, attacker, target, dmg) {
    if (!isJ(attacker)) return [];
    bind(engine);
    const s = st(attacker);
    const fx = s.fx || {};
    const out = [];
    if (fx.rapid) {
      const w = target.alive ? addWhirl(engine, attacker, target, randInt(RAPID.whirl[0], RAPID.whirl[1])) : 0;
      out.push(`Rapid Shot นัดที่ ${fx.rapid}/${RAPID.hits}${fx.rapidChumimi ? ` · Chumimi +${SHOT_CHUMIMI}` : ""}${w ? ` · หมุนวน +${w}` : ""}`);
    }
    if (fx.ora !== undefined) {
      giveChumimi(target);
      out.push(`Ora Ora Ora Ora! BeatDown +${fx.ora} (หมุนวน ${fx.oraStacks})${target.alive ? " · Chumimi" : ""}`);
    }
    if (fx.lesson) {
      if (fx.lessonChumimi && target.alive) target.johnnyStunPending = LESSON.stun;
      out.push(fx.lessonChumimi
        ? `Lesson Five +${LESSON.atk} · Chumimi +${LESSON.chumimi} · ไม่สนการลดดาเมจ · สตั้นเทิร์นหน้า`
        : `Lesson Five +${LESSON.atk}`);
    }
    if (s.awakening) {
      engine.addSkill(attacker, 1, "passive");
      out.push("Awakening +1 พลังโจมตี · แต้มสกิล +1");
    }
    if (dmg > 0) onDealtDamage(engine, attacker);
    s.fx = null;
    return out;
  },
  // ชุด Rapid Shot ยังไม่ครบ -> เปิดเฟสโจมตีนัดถัดไป (หัว endTurn — ทุกทางจบหมัดไหลมาที่นี่ พลาด/ถูกหลบก็ยิงต่อ)
  continueRapid(engine) {
    for (const p of Object.values(engine.players)) {
      if (!isJ(p) || !p.johnny || !(p.johnny.rapidShot > 0)) continue;
      const s = p.johnny;
      const next = s.rapidShot + 1;
      if (!p.alive || next > RAPID.hits || (p.statuses.stun || 0) > 0 || !engine.attackableTargets(p.id).length) {
        s.rapidShot = 0;
        s.rapidTargetId = null;
        continue;
      }
      s.rapidShot = next;
      engine.log(`💅 ${p.name} Rapid Shot — ยิงนัดที่ ${next}/${RAPID.hits}`);
      engine.setAttackerId(p.id);
      engine.setGameState("ATTACK");
      engine.startPhaseTimer(engine.ATTACK_TIME, () => {
        const t = engine.attackableTargets(engine.attackerId);
        if (!t.length) { engine.endTurn(); return; }
        const same = t.find((x) => x.id === s.rapidTargetId);
        engine.doAttack(engine.attackerId, (same || t[Math.floor(Math.random() * t.length)]).id);
        if (engine.gameState === "ATTACK") engine.endTurn();
      });
      engine.broadcastState();
      return true;
    }
    return false;
  },

  // ---------- รับดาเมจ (จอห์นนี่เป็นเป้า) ----------
  //  Slow Dancer (สกิลศัตรูที่เล็งเรา) กันทั้งก้อน · Spinning Skin -1 (ไม่ลดดาเมจจากสถานะ)
  adjustIncomingDamage(engine, p, n, isNormalAttack) {
    if (!isJ(p) || !(n > 0)) return n;
    bind(engine);
    if (!isNormalAttack && useCtx && useCtx.ward.has(p.id) && engine.effectSourceId === useCtx.userId) return 0;
    if (p._statusDamage || !skinActive(engine, p)) return n;
    const s = st(p);
    s.skinUses--;
    engine.log(`🌀 ${p.name} Spinning Skin — ความเสียหาย -1${s.skinUses <= 0 ? ` (คูลดาวน์ ${SKIN_CD} เทิร์น)` : ""}`);
    if (s.skinUses <= 0) { s.skinUses = SKIN_USES; s.skinReady = engine.roundNumber + SKIN_CD; }
    return Math.max(0, n - 1);
  },
  // combat.adjustIncomingDamage: Lesson Five + Chumimi ห้ามถูกลดต่ำกว่าค่าที่ส่งเข้ามา — คืน null = ไม่เกี่ยว
  pierceFloor(engine, n, isNormalAttack) {
    if (!isNormalAttack) return null;
    const src = engine.effectSourceId && engine.players[engine.effectSourceId];
    return src && this.piercing(src) ? n : null;
  },

  // ---------- Slow Dancer / การหมุนย้อนกลับ ----------
  beginUse(engine, user, targets) {
    if (useCtx || !user) return null;
    bind(engine);
    useCtx = { userId: user.id, reverse: false, triggered: false, ward: new Set(), targets: Array.isArray(targets) ? [...targets] : [] };
    if (whirlOf(user) > 0 && Math.random() * 100 < REVERSE_PCT) useCtx.reverse = true;
    return useCtx;
  },
  endUse(ctx) { if (ctx && useCtx === ctx) useCtx = null; },
  // สกิลถูกใช้จริง (หักแต้มแล้ว): ศัตรูเล็งจอห์นนี่ที่มี Slow Dancer -> ใช้ 1 ครั้ง สกิลนี้ไม่มีผลกับเขา
  onSkillFired(engine, user, targets) {
    if (!Array.isArray(targets) || !user) return;
    for (const id of new Set(targets)) {
      const t = engine.players[id];
      if (!isJ(t) || !t.alive || t.id === user.id || engine.sameTeam(user, t)) continue;
      const s = st(t);
      if (!(s.slowDancer > 0)) continue;
      s.slowDancer--;
      if (useCtx && useCtx.userId === user.id) useCtx.ward.add(t.id);
      engine.log(`💃 ${t.name} Slow Dancer — สกิลของ ${user.name} ไม่มีผล (เหลือ ${s.slowDancer})`);
    }
  },
  // ดีบัฟจากศัตรู: Slow Dancer กัน (ใช้ 1 ครั้ง) · สกิลที่ถูกกันไปแล้วด้านบนไม่กินซ้ำ
  blocksDebuff(engine, p, key) {
    if (!isJ(p) || !p.alive || !p.johnny) return false;
    bind(engine);
    const src = engine.effectSourceId && engine.players[engine.effectSourceId];
    if (!src || src.id === p.id || engine.sameTeam(src, p)) return false;
    if (useCtx && useCtx.userId === src.id && useCtx.ward.has(p.id)) return true;
    const s = p.johnny;
    if (!(s.slowDancer > 0)) return false;
    s.slowDancer--;
    engine.log(`💃 ${p.name} Slow Dancer — กันสถานะผิดปกติ${key ? ` (${key})` : ""} จาก ${src.name} (เหลือ ${s.slowDancer})`);
    return true;
  },
  // ดาเมจของสกิล/ไอเทมที่ทอย "การหมุนย้อนกลับ" ติด -> ลงผู้ใช้เองแทน (ครั้งแรกหมุนวน -2)
  redirectTarget(engine, p, isNormalAttack) {
    if (!useCtx || !useCtx.reverse || isNormalAttack || !p) return p;
    if (engine.effectSourceId !== useCtx.userId || p.id === useCtx.userId) return p;
    const user = engine.players[useCtx.userId];
    if (!user || !user.alive) return p;
    if (!useCtx.triggered) {
      useCtx.triggered = true;
      loseWhirl(user, REVERSE_LOSS);
      engine.log(`🌀 การหมุนย้อนกลับ! ผลของสกิลที่ ${user.name} ใช้ ย้อนกลับเข้าตัวเอง (หมุนวน -${REVERSE_LOSS})`);
      engine.skillFlash({ name: "การหมุนย้อนกลับ", img: IMG.spin, by: user.name, color: engine.colorOf(user) });
    }
    return user;
  },
  redirectEffect(engine, p) {
    if (!useCtx || !useCtx.triggered || !p) return p;
    if (engine.effectSourceId !== useCtx.userId || p.id === useCtx.userId) return p;
    return engine.players[useCtx.userId] || p;
  },

  // ---------- เพลง Act 4 ----------
  activeMusic(engine) {
    let best = null;
    for (const p of engine.alivePlayers()) {
      if (!isJ(p) || !p.johnny || !p.johnny.awakening) continue;
      if (!best || (p.transformAt || 0) > best.at) best = { music: MUSIC, at: p.transformAt || 0 };
    }
    return best;
  },
  attackSound(attacker) { return isJ(attacker) ? SFX.nail : undefined; },

  // ---------- ข้อมูลให้ client ----------
  displayImg(p) {
    if (!isJ(p)) return null;
    return [null, IMG.act1, IMG.act2, IMG.act3, IMG.act4][formOf(p)] || null;
  },
  publicState(engine, p) {
    if (!isJ(p)) return undefined;
    const s = st(p);
    return {
      form: formOf(p),
      nails: s.nails, nailMax: NAIL_MAX,
      spin: s.spin, spinMax: SPIN_MAX,
      energy: s.spin >= ENERGY_AT,
      skin: s.spin >= SKIN_AT ? { uses: s.skinUses, cd: Math.max(0, s.skinReady - engine.roundNumber) } : null,
      goldenRatio: s.goldenRatio, preAwaken: s.preAwaken, awakening: s.awakening,
      slowDancer: s.slowDancer, mastery: s.mastery,
      crit: this.critBonus(p), dodge: formOf(p) === 3 ? DODGE_ACT3 : 0,
      rapidShot: s.rapidShot,
    };
  },
  // ท่าที่ค้างรอ (เห็นเฉพาะเจ้าตัว — สกิลหลังเปิดไพ่ไม่เปิดเผยจนกว่าจะทำงาน)
  privateState(engine, p) {
    if (!isJ(p)) return {};
    const s = st(p);
    const t = s.snipe ? engine.players[s.snipe] : null;
    return { johnnyPending: { rapid: s.rapid, snipe: t ? t.name : null, ora: s.ora, lesson: s.lesson } };
  },
  skillLocks(engine, p) {
    if (!isJ(p)) return undefined;
    const s = st(p);
    const form = formOf(p);
    const sec = form === 1 ? { locked: s.rapid || s.rapidShot > 0 || s.nails < RAPID.nails, cd: cdLeft(engine, s, "rapid") }
      : form === 2 ? { locked: !!s.snipe || s.nails < SNIPE.nails, cd: cdLeft(engine, s, "snipe") }
      : form === 3 ? { locked: s.nails < WORM.nails, cd: cdLeft(engine, s, "wormhole") }
      : { locked: s.ora || s.goldenRatio < 1, cd: cdLeft(engine, s, "ora") };
    const ult = form === 4 ? { locked: s.lesson || s.goldenRatio < 1 } : { locked: false, cd: cdLeft(engine, s, "evo") };
    return { basic: { locked: false }, secondary: sec, ultimate: ult };
  },
};
