// ============================================================
//  Echo (echo_queen · พิเศษ · unique) — ร่างยักษ์แบบระบบ ORT
//  สเปกเต็ม (ล็อกแล้ว): .claude/plans/echo-queen-plan.md §1
//
//  ค่าพื้นฐาน: เลือด 10 · เกราะ 0 · เพดานเลือด = 10 + 2 × ระดับขยายร่าง (สูงสุด 30)
//
//  "ขยายร่าง" ระดับ 0-10 · ระดับละ: เพดานเลือด +2 และฟื้นเลือด 2
//    ล้างไม่ได้ ยกเว้น Overwrite ของ Echo เอง
//  สกิลพื้นฐาน "มหึมา" (0 แต้ม · ก่อนเปิดไพ่ · คูลดาวน์ 12 เทิร์นนับจากตอนกด)
//    ได้ "ราชินีแห่ง Echo" 10 เทิร์น (ล้างไม่ได้) · ขยายร่าง +1 ทันที แล้ว +1 ทุกต้นเทิร์นถัดไปจนสถานะหมด
//    กดไม่ได้ระหว่างมีราชินี (แม้คูลดาวน์จะหมดแล้ว)
//  สกิลรอง "Overwrite" (0 แต้ม · ก่อนเปิดไพ่ · กดไม่ได้ระหว่างท่าไม้ตาย)
//    ชุด = floor(ระดับ / 2) · คูลดาวน์มหึมา -1/ชุด · พลังโจมตี +1/ชุด 2 เทิร์น (นับเทิร์นที่กด)
//    ล้างขยายร่างทั้งหมด + ราชินี (เพดานกลับ 10 · เลือดเกินถูกตัด) แล้วฟื้นเลือด 5 (คิดหลังตัดเพดาน)
//  ท่าไม้ตาย "นี่มันเกมของฉัน" (8 แต้ม · ก่อนเปิดไพ่ · ต้องขยายร่าง 10 · ระดับไม่หาย)
//    ฟื้นเลือดตัวเอง 5 ทันทีตอนกด · สนามเปลี่ยน 5 เทิร์น (นับเทิร์นที่กด) · ตีฟรีทุกเทิร์นช่วงจั่วไพ่ = "โจมตีปกติ" ใส่เป้า 1 คน
//    ไม่เลือกก่อนเปิดไพ่ = สุ่มเป้าแล้วตีให้ก่อนเปิดไพ่ · ติดสตั้น/หลับ = ตีฟรีไม่ได้
//    (ลำดับเฟสของตีฟรีอยู่ server/phases/echoFreeHit.js — ไฟล์นี้มีแค่กติกา)
//  สกิลติดตัว 1 "เหล่าสหายตัวน้อยเอ๋ย"
//    ระดับ 1-4: คุ้มครอง 1 (ลดดาเมจที่ได้รับ 1 ทุกช่องทางที่ผ่าน adjustIncomingDamage — ระดับ 0 ไม่มี)
//      ตั้งใจให้หมัด 1 หน่วยเหลือ 0 (ผู้ใช้ยืนยัน) — ไม่ใช่กับดัก "บัฟลดดาเมจ = อมตะ" เพราะไม่มีโล่ที่ต้องกร่อน
//    ระดับ >= 5: พลังโจมตี +1 · ระดับ 10: พลังโจมตี +1 อีก + โอกาสสังหาร 5% (ตีฟรีก็ใช้)
//    ทุกต้นเทิร์นสุ่ม 20% ได้ "ต้านสถานะ" 1 เทิร์น (บัฟ resist จริง — ตัวเดียวที่เป็นสถานะจริง)
//  สกิลติดตัว 2 "การกลืนกินระดับ EX": สังหารผู้เล่นได้ = พลังโจมตีถาวร +1 (รวมสูงสุด +2)
//
//  สถานะทั้งหมดอยู่ที่ p.echoQ (ไม่ใช่ p.statuses) -> ล้าง/ต้าน/ปาดไม่ได้โดยธรรมชาติ
//  คูลดาวน์/ช่วงเวลาเก็บเป็น "เลขรอบ" (แพทเทิร์น ippo/johnny/dio) — เดินต่อเองไม่ต้องมีใครลดให้
//  p.echoQ เป็น plain object -> สแนปช็อต Overload Force/ชิโดย้อนคืนได้ครบ (ไม่ต้องอยู่ใน keep)
// ============================================================

const ID = "echo_queen";

const BASE_HP = 10;
const HP_PER_LV = 2;
const LV_HEAL = 2;
const LV_MAX = 10;

const QUEEN_TURNS = 10;
const MONSTROUS_COOLDOWN = 12;

const OVERWRITE_HEAL = 5;
const OVERWRITE_ATK_TURNS = 2;

const ULT_TURNS = 5;
const ULT_NEED_LV = 10;
const ULT_HEAL = 5; // กดท่าไม้ตาย = ฟื้นเลือดตัวเอง 5 ทันที (healHp ปกติ — ไม่ใช้งานต่อ/ผกผัน/เลือดไหลมีผลตามเดิม)
// ฉากเปิดตัว 12 วิ (client/src/echoQueen/echoQueenStage.js · ACTS.transform) + เผื่อเครือข่าย 1 วิ
const INTRO_SECONDS = 13; // ตัวจับเวลาเฟสนับเป็นวินาทีเต็ม

const GUARD_AMT = 1;
const GUARD_LV_MIN = 1;
const GUARD_LV_MAX = 4;
const ATK_LV_MID = 5;   // ระดับ >= 5: พลังโจมตี +1
const KILL_CHANCE = 0.05;
const RESIST_CHANCE = 0.2;
const KILL_ATK_MAX = 2;

const IMG = { base: "/characters/echo_queen/echo_queen_portrait.webp" };

function isEcho(p) { return !!p && p.characterId === ID; }
function fresh() {
  return {
    lv: 0,
    queenFrom: 0, queenUntil: 0, // ราชินีแห่ง Echo: รอบที่กด / รอบสุดท้ายที่มีผล
    cdRound: 0,                  // มหึมา: เลขรอบที่กดได้อีกครั้ง
    atkBuffUntil: 0, atkBuffN: 0, // Overwrite: พลังโจมตี +N ถึงรอบนี้
    killAtk: 0,                  // การกลืนกินระดับ EX: พลังโจมตีถาวรจากการสังหาร (0-2)
    ultFrom: 0, ultUntil: 0,     // นี่มันเกมของฉัน: รอบที่กด / รอบสุดท้ายที่มีผล
    freeHitRound: 0,             // รอบล่าสุดที่ใช้ตีฟรีไปแล้ว
    freeHitTarget: null,         // เป้าของตีฟรีในรอบนั้น (null = ไม่มีเป้าให้ตี)
  };
}
function st(p) {
  if (!p.echoQ) p.echoQ = fresh();
  return p.echoQ;
}
function levelOf(p) { return isEcho(p) ? Math.max(0, Math.min(LV_MAX, (p.echoQ && p.echoQ.lv) || 0)) : 0; }

module.exports = {
  id: ID,
  IMG,
  BASE_HP, HP_PER_LV, LV_HEAL, LV_MAX, QUEEN_TURNS, MONSTROUS_COOLDOWN, OVERWRITE_HEAL, OVERWRITE_ATK_TURNS,
  ULT_TURNS, ULT_NEED_LV, ULT_HEAL, INTRO_SECONDS, GUARD_AMT, KILL_CHANCE, RESIST_CHANCE, KILL_ATK_MAX,
  isEcho,
  levelOf,

  maxHp(p) { return BASE_HP + HP_PER_LV * levelOf(p); },
  maxArmor() { return 0; },

  resetCombat(p) { p.echoQ = fresh(); },

  // ---------- ตัวนับ (เลขรอบ) ----------
  queenTurnsLeft(engine, p) {
    if (!isEcho(p)) return 0;
    const s = st(p);
    // ต้องเคยกดจริง (queenFrom > 0) — ก่อนเทิร์น 1 roundNumber = 0 = ค่าเริ่มต้น queenUntil จึงห้ามเทียบเปล่าๆ (บั๊ก 5.1.26)
    return s.queenFrom > 0 && s.queenUntil >= engine.roundNumber ? s.queenUntil - engine.roundNumber + 1 : 0;
  },
  queenActive(engine, p) { return this.queenTurnsLeft(engine, p) > 0; },
  basicCooldownLeft(engine, p) {
    if (!isEcho(p)) return 0;
    return Math.max(0, (st(p).cdRound || 0) - engine.roundNumber);
  },
  ultTurnsLeft(engine, p) {
    if (!isEcho(p)) return 0;
    const s = st(p);
    // ต้องเคยกดจริง (ultFrom > 0) — บั๊ก 5.1.26: ก่อนเทิร์น 1 (roundNumber 0) ท่าไม้ตาย/สนาม/เพลงทำงานเองเพราะ 0 >= 0
    return s.ultFrom > 0 && s.ultUntil >= engine.roundNumber ? s.ultUntil - engine.roundNumber + 1 : 0;
  },
  ultActive(engine, p) { return this.ultTurnsLeft(engine, p) > 0; },
  // สนามราชินีที่ทุกคนเห็น (buildStateFor.echoField) — client วาดสนามเฉพาะ/ฉากออกจากค่านี้
  //  seq = transformAt (กดใหม่ = สนามรอบใหม่) · ใครเปิดล่าสุดชนะ (unique — ปกติมีคนเดียว)
  fieldState(engine) {
    let best = null;
    for (const p of engine.alivePlayers()) {
      if (!isEcho(p) || !this.ultActive(engine, p)) continue;
      if (!best || (p.transformAt || 0) > best.seq) best = { ownerId: p.id, seq: p.transformAt || 0, turnsLeft: this.ultTurnsLeft(engine, p) };
    }
    return best;
  },
  // เพลง echo_queen_theme ตลอดท่าไม้ตาย — view.js ให้อยู่บนสุดของลำดับเพลง (ทับยูนะ/เอจิ/Overload Force ด้วย)
  //  at = transformAt ที่ applyUlt ตั้ง → กดท่าใหม่ = เพลงเริ่มจากต้น
  activeMusic(engine) {
    let best = null;
    for (const p of engine.alivePlayers()) {
      if (!isEcho(p) || !this.ultActive(engine, p)) continue;
      if (!best || (p.transformAt || 0) > best.at) best = { music: "echo_queen_theme", at: p.transformAt || 0 };
    }
    return best;
  },
  overwriteAtk(engine, p) {
    if (!isEcho(p)) return 0;
    const s = st(p);
    return s.atkBuffN > 0 && s.atkBuffUntil >= engine.roundNumber ? s.atkBuffN : 0;
  },

  // ขยายร่าง +1 (เพดาน 10): เพดานเลือด +2 แล้วฟื้นเลือด 2 — คืน true ถ้าระดับขึ้นจริง
  gainLevel(engine, p) {
    const s = st(p);
    if (s.lv >= LV_MAX) return false;
    s.lv++;
    const healed = engine.healHp(p, LV_HEAL);
    engine.log(`👑 ${p.name} ขยายร่าง ระดับ ${s.lv}/${LV_MAX} — เพดานพลังชีวิต ${engine.maxHpOf(p)} · ฟื้นพลังชีวิต +${healed}`);
    return true;
  },

  // ---------- ต้นเทิร์น (dealRound) ----------
  onRoundStartTick(engine, p) {
    if (!isEcho(p) || !p.alive) return;
    const s = st(p);
    const r = engine.roundNumber;
    // ราชินีแห่ง Echo: +1 ทุกต้นเทิร์น "ถัดจาก" เทิร์นที่กด จนสถานะหมด
    if (r > s.queenFrom && r <= s.queenUntil) this.gainLevel(engine, p);
    // เหล่าสหายตัวน้อยเอ๋ย: 20% ได้ต้านสถานะ 1 เทิร์น (สถานะจริง — หมดที่ลูปลดเทิร์นของ endTurn)
    if (!engine.passiveSealed(p) && Math.random() < RESIST_CHANCE) {
      engine.applyBuff(p, "resist", null, 1);
      engine.log(`🛡️ ${p.name} เหล่าสหายตัวน้อยเอ๋ย — ได้ต้านสถานะผิดปกติ 1 เทิร์น`);
    }
  },

  // ---------- useSkill: ด่านก่อนหักแต้ม (ปุ่มฝั่ง client อ่านผ่าน skillLocks ชุดเดียวกัน) ----------
  canUseSkill(engine, p, tier) {
    if (!isEcho(p)) return true;
    if (tier === "basic") return !this.queenActive(engine, p) && this.basicCooldownLeft(engine, p) === 0;
    if (tier === "secondary") return !this.ultActive(engine, p);
    if (tier === "ultimate") return levelOf(p) >= ULT_NEED_LV && !this.ultActive(engine, p);
    return false;
  },
  skillLocks(engine, p) {
    if (!isEcho(p)) return undefined;
    return {
      basic: { locked: this.queenActive(engine, p), cd: this.basicCooldownLeft(engine, p) },
      secondary: { locked: this.ultActive(engine, p) },
      ultimate: { locked: levelOf(p) < ULT_NEED_LV || this.ultActive(engine, p) },
    };
  },

  applyInstantSkill(engine, p, tier) {
    if (!isEcho(p)) return "";
    if (tier === "basic") return this.applyMonstrous(engine, p);
    if (tier === "secondary") return this.applyOverwrite(engine, p);
    if (tier === "ultimate") return this.applyUlt(engine, p);
    return "";
  },

  // ---------- สกิลพื้นฐาน มหึมา ----------
  applyMonstrous(engine, p) {
    const s = st(p);
    const r = engine.roundNumber;
    s.cdRound = r + MONSTROUS_COOLDOWN;
    s.queenFrom = r;
    s.queenUntil = r + QUEEN_TURNS - 1;
    engine.log(`👑 ${p.name} มหึมา — ได้ "ราชินีแห่ง Echo" ${QUEEN_TURNS} เทิร์น (คูลดาวน์ ${MONSTROUS_COOLDOWN} เทิร์น)`);
    this.gainLevel(engine, p);
    return ` — ขยายร่าง ${s.lv}/${LV_MAX}`;
  },

  // ---------- สกิลรอง Overwrite ----------
  applyOverwrite(engine, p) {
    const s = st(p);
    const r = engine.roundNumber;
    const sets = Math.floor(s.lv / 2);
    if (sets > 0) {
      if (s.cdRound > 0) s.cdRound = Math.max(0, s.cdRound - sets);
      s.atkBuffUntil = r + OVERWRITE_ATK_TURNS - 1;
      s.atkBuffN = sets;
    }
    const lvBefore = s.lv;
    s.lv = 0;
    s.queenFrom = 0;
    s.queenUntil = 0;
    // เพดานกลับ 10 -> เลือดเกินถูกตัด (ก่อนฟื้น 5)
    const cap = engine.maxHpOf(p);
    if (p.hp > cap) p.hp = cap;
    const healed = engine.healHp(p, OVERWRITE_HEAL);
    engine.log(`✒️ ${p.name} Overwrite — ล้างขยายร่าง ${lvBefore} ระดับ (${sets} ชุด)${sets > 0 ? ` · คูลดาวน์มหึมา -${sets} · พลังโจมตี +${sets} ${OVERWRITE_ATK_TURNS} เทิร์น` : ""} · ฟื้นพลังชีวิต +${healed}`);
    return sets > 0 ? ` — ${sets} ชุด` : "";
  },

  // ---------- ท่าไม้ตาย นี่มันเกมของฉัน ----------
  applyUlt(engine, p) {
    const s = st(p);
    const r = engine.roundNumber;
    s.ultFrom = r;
    s.ultUntil = r + ULT_TURNS - 1;
    p.transformAt = engine.nextTransformCounter();
    const healed = engine.healHp(p, ULT_HEAL);
    // ฉากเปิดตัวร่างยักษ์ (canvas ฝั่ง client — ไม่มีคลิป): พักช่วงจั่วไพ่ไว้ INTRO_SECONDS แล้วกลับมาด้วยเวลาที่เหลือ
    //  useSkill เห็นคิวคัตซีนแล้วเรียก pausePlayingForCutscene เอง · เพลงราชินีเริ่มตั้งแต่ต้นฉาก (audioPolicy kind "echoQueen")
    engine.pushCutsceneRaw({
      seconds: INTRO_SECONDS,
      info: { kind: "echoQueen", playerId: p.id, name: p.name, color: engine.colorOf(p), title: "นี่มันเกมของฉัน", label: "ท่าไม้ตาย" },
    });
    engine.log(`♛ ${p.name} นี่มันเกมของฉัน — ฟื้นพลังชีวิต +${healed} · สนามเปลี่ยน ${ULT_TURNS} เทิร์น · ตีฟรีทุกเทิร์นช่วงจั่วไพ่`);
    return ` — ${ULT_TURNS} เทิร์น`;
  },

  // ไพ่แตกไม่ทำให้ท่าไม้ตายเป็นโมฆะ — ผลลงทันทีก่อนเปิดไพ่ (ผู้ใช้ยืนยัน 2026-10-05) จึงไม่เสียบ combat.voidUltimateOnBust

  // ---------- พลังโจมตี (computeAttackBase) ----------
  damageBonus(engine, attacker, target, ctx) {
    if (!isEcho(attacker)) return 0;
    const lv = levelOf(attacker);
    const sealed = engine.passiveSealed(attacker);
    const passiveAtk = sealed ? 0 : (lv >= ATK_LV_MID ? 1 : 0) + (lv >= LV_MAX ? 1 : 0);
    const killAtk = sealed ? 0 : Math.min(KILL_ATK_MAX, st(attacker).killAtk || 0);
    const overwrite = this.overwriteAtk(engine, attacker);
    if (ctx) ctx.echoQueenAtk = { passiveAtk, killAtk, overwrite };
    return passiveAtk + killAtk + overwrite;
  },
  // ป้ายผลบนการ์ดสรุปการโจมตี
  attackFx(ctx) {
    const a = ctx && ctx.echoQueenAtk;
    if (!a) return [];
    const out = [];
    if (a.passiveAtk > 0) out.push(`เหล่าสหายตัวน้อยเอ๋ย +${a.passiveAtk}`);
    if (a.killAtk > 0) out.push(`การกลืนกินระดับ EX +${a.killAtk}`);
    if (a.overwrite > 0) out.push(`Overwrite +${a.overwrite}`);
    return out;
  },

  // ---------- คุ้มครองระดับ 1-4 = "คุ้มครอง" ปกติของเกม (ลดเฉพาะดาเมจจากการโจมตีปกติ/กระสุน) ----------
  //  คิดสดที่จุดเดียวกับ guard กลาง (attack.js + กระสุนคาเยนน์) — ห้ามใส่ guard เป็นสถานะจริง ไม่งั้นต้าน/ล้างได้
  guardBonus(engine, p) {
    if (!isEcho(p)) return 0;
    const lv = levelOf(p);
    if (lv < GUARD_LV_MIN || lv > GUARD_LV_MAX || engine.passiveSealed(p)) return 0;
    return GUARD_AMT;
  },

  // ---------- โอกาสสังหาร 5% (ระดับ 10) — จุดโรลเดียวกับเนตร (miyakoKillChance · ORT ต้าน) ----------
  hasKillCapability(p) { return isEcho(p) && levelOf(p) >= LV_MAX; },
  onAttackKill(engine, attacker, target) {
    if (!isEcho(attacker) || levelOf(attacker) < LV_MAX) return false;
    if (engine.passiveSealed(attacker) || engine.killSealed(attacker)) return false;
    const chance = engine.miyakoKillChance(target, KILL_CHANCE);
    if (!(chance > 0)) return false;
    if (!(Math.random() < chance)) { engine.miyakoSurvivedKillAttempt(target); return false; }
    if (engine.appleGuyDodgesKill(attacker, target)) return true;
    engine.instantDeath(target);
    target.wasAttacked = true;
    engine.log(target.alive
      ? `♛ ${attacker.name} เล็งสังหาร ${target.name} — แต่ ${target.name} หนีความตายไปได้!`
      : `♛ ${attacker.name} เหล่าสหายตัวน้อยเอ๋ย — สังหาร ${target.name} ทันที! (โอกาส ${Math.round(chance * 100)}%)`);
    engine.setLastAttack({
      id: Date.now(),
      byName: attacker.name, byImg: engine.displayImg(attacker), byColor: engine.colorOf(attacker),
      targetName: target.name, targetImg: engine.displayImg(target), targetColor: engine.colorOf(target),
      dmg: 0, kill: !target.alive,
      skills: [{ name: "เหล่าสหายตัวน้อยเอ๋ย — สังหารทันที", img: IMG.base, by: attacker.name, color: engine.colorOf(attacker), side: "atk" }],
    });
    engine.runCutsceneQueue(() => {
      engine.setGameState("ATTACKING");
      engine.startPhaseTimer(engine.ATTACKFX_TIME + 2, engine.endTurn);
      engine.broadcastState();
    });
    return true;
  },

  // ---------- การกลืนกินระดับ EX (เรียกจาก combat.instantDeath หลังตกรอบจริง) ----------
  //  ผู้สังหาร = ต้นตอของเอฟเฟกต์ที่กำลังทำงาน หรือผู้ทำดาเมจล่าสุดในเทิร์นเดียวกัน
  //  (ตีปกติจนเลือดหมดไปตายตอนกวาดท้าย endTurn / หลังตีฟรี ซึ่งไม่มี effectSourceId แล้ว — แบบเดียวกับ ORT)
  onKill(engine, victim) {
    const lastHit = victim.lastDamageRound === engine.roundNumber ? engine.players[victim.lastDamageSourceId] : null;
    const killer = engine.players[engine.effectSourceId] || lastHit;
    if (!isEcho(killer) || killer.id === victim.id) return;
    const s = st(killer);
    if ((s.killAtk || 0) >= KILL_ATK_MAX) return;
    s.killAtk = (s.killAtk || 0) + 1;
    engine.log(`♛ ${killer.name} การกลืนกินระดับ EX — กลืนกิน ${victim.name} · พลังโจมตีถาวร +1 (รวม +${s.killAtk})`);
  },

  // ---------- ตีฟรีของท่าไม้ตาย (กติกา — ลำดับเฟสอยู่ server/phases/echoFreeHit.js) ----------
  freeHitBlocked(p) {
    return ((p.statuses && p.statuses.stun) || 0) > 0 || ((p.statuses && p.statuses.sleep) || 0) > 0;
  },
  freeHitPending(engine, p) {
    if (!isEcho(p) || !p.alive || !this.ultActive(engine, p)) return false;
    if (st(p).freeHitRound === engine.roundNumber) return false;
    return !this.freeHitBlocked(p);
  },
  markFreeHit(engine, p, targetId) {
    const s = st(p);
    s.freeHitRound = engine.roundNumber;
    s.freeHitTarget = targetId || null;
  },
  validTarget(engine, p, targetId) {
    if (!targetId) return null;
    return engine.attackableTargets(p.id).find((o) => o.id === targetId) || null;
  },
  randomTarget(engine, p) {
    const pool = engine.attackableTargets(p.id);
    return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
  },

  // ---------- ข้อมูลส่งให้ client ----------
  //  ระดับ/ราชินี/ท่าไม้ตายเห็นทุกคน (ป้ายบนตัว Echo) · คูลดาวน์และรายชื่อเป้าตีฟรีเห็นเจ้าตัว
  publicState(engine, p, mine) {
    if (!isEcho(p)) return undefined;
    const s = st(p);
    const r = engine.roundNumber;
    const pending = this.freeHitPending(engine, p);
    return {
      lv: levelOf(p),
      lvMax: LV_MAX,
      queenTurns: this.queenTurnsLeft(engine, p),
      ultTurns: this.ultTurnsLeft(engine, p),
      killAtk: Math.min(KILL_ATK_MAX, s.killAtk || 0),
      atkBuff: this.overwriteAtk(engine, p),
      atkBuffTurns: s.atkBuffUntil >= r && s.atkBuffN > 0 ? s.atkBuffUntil - r + 1 : 0,
      freeHitPending: pending,
      freeHitTarget: s.freeHitRound === r ? s.freeHitTarget : null,
      basicCd: mine ? this.basicCooldownLeft(engine, p) : undefined,
      freeHitTargets: mine && pending ? engine.attackableTargets(p.id).map((o) => o.id) : undefined,
    };
  },
};
