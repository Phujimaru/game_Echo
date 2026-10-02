// เฟสโจมตี: เลือกเป้า, คำนวณดาเมจ, doAttack
// export ก่อน require: ไฟล์ใน server/ require วนกันเอง — function declaration ถูก hoist จึงพร้อมใช้ตั้งแต่บรรทัดแรก
Object.assign(module.exports, {
  iconFx, attackableTargets, afterSummary, nanayaCancelReattack, attackSoundOf, computeAttackBase,
  estimateAttackOn, doAttack,
});

const CHAR_HOOKS = require("../../characters/index");
const {
  statusAmtOf, resistActive, poisonAtkPenalty, invertActive, consumeEvadeStack, accurateActive,
} = require("../../characters/_universal_status");
const { NETRAMANA_KILL_CHANCE, netramanaActive } = require("../../characters/_universal_status");
const Mark42 = require("../../characters/_mark42");
const Journey = require("../../characters/_journey");
const Seraph = require("../../seraph");
const { io } = require("../app");
const {
  ATTACKFX_TIME, ATTACK_TIME, BARD_CRIMSON_IMG, BARD_JADE_IMG, BAT_SKILL3_IMG, DOOM_WEAPONS,
  HIKARU_STORIUM_ATK_CAP, HIKARU_STORIUM_TOTAL_CAP, HIKARU_STRIUM_IMG, OGURI_ULT_ATK_BONUS,
  ORT_ATTACK_DELAY, PHENEX_BAN_ULT_TURNS, PHENEX_NTD_IMG, PSHIKI_ULT_IMG, SATORU_PROFILE_IMG,
  SHIKI_CANCELABLE_ULTS, SHIKI_DEATHLINE_MAX, SHIKI_DEATH_IMG, SHIKI_WITHER_ATK_CAP,
  SHIKI_WITHER_IMG, TAKUTO_LANCE_DMG, TRANSFORMS, YUNA_COLOR, YUNA_IMG,
} = require("../constants");
const match = require("../match");
const { engine } = require("../engine");
const characterRules = require("../characterRules");
const combat = require("../combat");
const cutscene = require("../cutscene");
const endTurnPhase = require("./endTurn");
const lobby = require("../lobby");
const mercury = require("../modes/mercury");
const purge = require("../modes/purge");
const seraphMode = require("../modes/seraph");
const timers = require("../timers");
const view = require("../view");

// ---- โจมตี ----
// เรจูอาคมบัญชา (อมตะ): ไม่ถูกเลือกเป็นเป้าโจมตีตลอดเทิร์น
// ---------- เอฟเฟกต์ gif ทับไอคอนผู้เล่น (ระบบใหม่ patch 3.4 — ผู้วิงวอน) ----------
//  ต่างจาก cutscene ตรงที่ "ไม่หยุดเกม": ยิงเป็น event ให้ client วาด gif ทับการ์ดของผู้เล่นคนนั้นแล้วหายไปเอง
//  ทุกคนเห็นเหมือนกัน (เป็นข้อมูลสนาม) — client จัดคิว/ตั้งเวลาเองจาก ms ที่ส่งไป (ดู IconFxLayer ใน Game.jsx)
function iconFx(target, kind) {
  const fx = CHAR_HOOKS.the_supplicant.FX[kind];
  if (!target || !fx) return;
  io.emit("iconFx", { targetId: target.id, kind, gif: fx.gif, sound: fx.sound, ms: fx.ms, seq: ++match.iconFxSeq });
}

function attackableTargets(atkId) {
  const attacker = match.players[atkId];
  // ผู้วิงวอน (patch 3.4): คนที่ติด "ลูกแกะน้อยรู้แจ้ง" เล็งผู้วิงวอนไม่ได้เลย — กรองออกจากรายชื่อเป้าหมายตั้งแต่ต้นทาง
  // SE.RA.PH วันที่ 7: ดวลตัวต่อตัว — เล็งได้เฉพาะคู่ของตัวเองเท่านั้น ผู้ชมแตะไม่ได้
  const pool = Seraph.active() ? Seraph.combatants(engine) : purge.purgeActive() ? purge.combatants() : combat.alivePlayers();
  return pool.filter((p) => p.id !== atkId && !combat.sameTeam(attacker, p) && !combat.sealActive(p)
    && !CHAR_HOOKS.the_supplicant.targetBlocked(attacker, p));
}

function afterSummary() {
  // SE.RA.PH วันที่ 1-6: ไม่มีเฟสโจมตีเลย — ต่อด้วยเฟส "เลือกสถานที่" แทน (§5 ขั้นที่ 3)
  if (Seraph.noCombat()) { seraphMode.beginSeraphPlacePhase(); return; }
  // คอนเนอร์ RK800 (สกิลติดตัว 2): ระหว่างการไล่ล่า ทุกเทิร์นเหลือแค่ จั่ว -> สรุปแต้ม ไม่มีเฟสโจมตีเลย
  if (CHAR_HOOKS.conner.chaseActive(engine)) { endTurnPhase.endTurn(); return; }
  // ไบรอัน (สกิลรอง หลีกทางไป): พุ่งชนคนที่แต้มสูงสุดที่มากกว่าเรา — วีดีโอก่อน แล้วค่อยลงความเสียหาย
  //  ทำที่นี่ (หลังรู้แต้มทุกคนแล้ว ก่อนเข้าเฟสโจมตี) เพราะเงื่อนไขคือ "คนที่แต้มมากกว่าเรา"
  {
    const pusher = combat.alivePlayers().find((p) => CHAR_HOOKS.brian.pushTargetOf(engine, p));
    if (pusher) {
      const pt = CHAR_HOOKS.brian.pushTargetOf(engine, pusher);
      // ⚠️ ต้องปักธง "ยิงไปแล้วเทิร์นนี้" ก่อนคิววีดีโอเสมอ — callback ด้านล่างเรียก afterSummary() ซ้ำ
      //  ถ้าไม่ปัก pushTargetOf จะยังคืนเป้าหมายเดิม แล้ววนคิววีดีโอไม่รู้จบ
      CHAR_HOOKS.brian.markPushFired(engine, pusher);
      cutscene.queueCutscene(pusher, "brianPush");
      cutscene.runCutsceneQueue(() => { CHAR_HOOKS.brian.applyPushHit(engine, pusher, pt); afterSummary(); });
      return;
    }
  }
  const winner = match.players[match.roundWinnerId];
  // หลับไหล (Lie Like Vortigern): ผู้ชนะที่ยังหลับอยู่ ออกการกระทำไม่ได้ -> ไม่มีเทิร์นโจมตี
  //  (เทิร์นที่เพิ่งโดนกล่อม sleepFresh ยังโจมตีได้ — การหลับเริ่มเทิร์นถัดไป)
  if (winner && winner.alive && (winner.statuses.sleep || 0) > 0 && !winner.sleepFresh) {
    match.lastLog.push(`💤 ${winner.name} ยังหลับไหลอยู่ — ไม่มีเทิร์นโจมตี`);
    endTurnPhase.endTurn();
    return;
  }
  // โคโตเนะ: หลับพักผ่อน (Sleeping time) / สตั้นจากโหมงานหนัก / หนีท่านประธานเซนะ — ไม่มีเทิร์นโจมตี
  if (winner && winner.alive && (
    (winner.statuses.ksleep || 0) > 0 ||
    (winner.statuses.stun || 0) > 0 // สตั้น (สถานะพื้นฐาน patch 2.0.8) — รวม kstun (โคโตเนะ [โหมงานหนัก]) เข้ามาแล้ว
  )) {
    match.lastLog.push(`💤 ${winner.name} ไม่อยู่ในสภาพจะโจมตีใคร — ไม่มีเทิร์นโจมตี`);
    endTurnPhase.endTurn();
    return;
  }

  // แบทแมน (characters/bat_ben.js): ระหว่างเร้นเงา ออกจากเงามืดมาโจมตีไม่ได้
  // เจ้าหญิงราก (characters/princess_shiki.js): สกิลติดตัว — โจมตีปกติไม่ได้เลย เว้นแต่ติด "ชักดาบ"
  // โปรดิวเซอร์ (ฝึกซ้อม): 3 เทิร์นนี้โจมตีปกติไม่ได้ แต่ทำอย่างอื่นได้ตามปกติ
  // สไตรเกอร์ ยูเรก้า (งานช่าง): เทิร์นที่เข้าไปซ่อม ชนะก็โจมตีไม่ได้
  if (winner && winner.alive && CHAR_HOOKS.striker.cannotAttack(engine, winner)) {
    match.lastLog.push(`🔧 ${winner.name} กำลังซ่อมอยู่ — ไม่มีเทิร์นโจมตี`);
    endTurnPhase.endTurn();
    return;
  }
  if (winner && winner.alive && CHAR_HOOKS.producer_lumi.cannotAttack(winner)) {
    match.lastLog.push(`🎤 ${winner.name} กำลังเตรียมซ้อมอยู่ — ไม่มีเทิร์นโจมตี`);
    endTurnPhase.endTurn();
    return;
  }
  if (winner && winner.alive && CHAR_HOOKS.princess_shiki.cannotAttack(winner)) {
    match.lastLog.push(`👁️ ${winner.name} ไม่ได้ชักดาบออกมา — ไม่มีเทิร์นโจมตี (สกิลติดตัว · ใช้สกิลพื้นฐาน "อืม ฉันเข้าใจแล้ว" เพื่อโจมตีได้)`);
    endTurnPhase.endTurn();
    return;
  }
  // DoomGuy (characters/doomguy.js) สกิลติดตัว: ปกติเสมอแต้มจะไม่มีเทิร์นโจมตี — โรลไปแล้วตอนตัดสิน
  //  ผู้ชนะใน resolveRound() (ห้ามโรลซ้ำที่นี่ ไม่งั้นโอกาสจริงจะถูกคูณซ้ำ)
  // ORT ชนะรอบ: เลือกเป้าเอง (คนที่เลือด+เกราะเหลือน้อยสุด) — เปิดเฟสโจมตีสั้นๆ ให้ทุกคนเห็นว่าใครโดนเล็ง
  if (winner && winner.alive && mercury.isOrt(winner) && !match.roundTiedWin) {
    const t = CHAR_HOOKS.ort.pickTarget(engine, winner);
    if (t) {
      match.attackerId = winner.id;
      match.gameState = "ATTACK";
      timers.startPhaseTimer(ORT_ATTACK_DELAY, () => {
        const tt = match.players[t.id];
        if (tt && tt.alive) doAttack(winner.id, tt.id);
        if (match.gameState === "ATTACK") endTurnPhase.endTurn(); // doAttack ปฏิเสธเป้า (เช่น เป้าได้อมตะกลางทาง) — อย่าให้เฟสค้าง
      });
      view.broadcastState();
      return;
    }
  }
  const doomTieOverride = match.doomTieAttack && !!winner && winner.alive && winner.characterId === "doomguy";
  if (winner && winner.alive && (!match.roundTiedWin || doomTieOverride)) {
    const targets = attackableTargets(winner.id);
    if (targets.length > 0) {
      match.attackerId = winner.id;
      match.gameState = "ATTACK";
      timers.startPhaseTimer(ATTACK_TIME, () => {
        const t = attackableTargets(match.attackerId);
        if (t.length) doAttack(match.attackerId, t[Math.floor(Math.random() * t.length)].id);
        // doAttack ปฏิเสธเป้าได้ (เช่น ไค: บังคับตีคู่ปรับที่เป็นเพื่อนร่วมทีมในโหมด Raid) — อย่าให้เฟส ATTACK ค้าง
        if (match.gameState === "ATTACK") endTurnPhase.endTurn();
      });
      view.broadcastState();
      return;
    }
  }
  endTurnPhase.endTurn();
}

// หัวใจฆาตกร (นานายะ ชิกิ สกิลติดตัว 2, characters/nanaya.js): เนตรมารพลาดสังหาร -> เปิดโอกาสโจมตีซ้ำทันที
//  (เปลี่ยนเป้าหมายได้ ไม่ต้องรอเทิร์นถัดไป — กดยกเลิกได้ผ่าน nanayaCancelReattack)
// เพลงหมัด อาริมะ (อาริมะ มิยาโกะ สกิลรอง patch 2.2.0): โจมตีต่อได้อีกหลายครั้ง โอกาสลดลงเป็นขั้น (100/75/50/25% สูงสุด 4 ครั้ง)
function postAttackFollowup(attacker) {
  // คอนเนอร์ RK800 (สกิลติดตัว 4 การป้องกันตัว): วีดีโอ connor_passive4 เล่นจบแล้ว -> ค่อยลงดาเมจสวนกลับ
  //  (จุดนี้อยู่หลัง runCutsceneQueue ของ doAttack เสมอ จึงได้ลำดับ "วีดีโอก่อน แล้วจึงเกิดความเสียหาย" ตามสเปค)
  CHAR_HOOKS.conner.resolvePendingCounter(engine);
  if (attacker && attacker.alive && attacker.characterId === "nanaya") {
    if (CHAR_HOOKS.nanaya.startReattack(engine, attacker)) return;
  }
  // เพลงหมัด อาริมะ (characters/miyako.js): ต่อคอมโบตามโอกาสที่ลดหลั่นลงไป
  if (attacker && attacker.alive && attacker.characterId === "miyako") {
    if (CHAR_HOOKS.miyako.startComboReattack(engine, attacker)) return;
  }
  // สึงาชิ ทาคุโตะ (characters/takuto.js): Star Sword Saphir + Emeraude ร่วมกัน — โจมตีเพิ่มอีก 1 ครั้งทันที (การันตี)
  if (attacker && attacker.alive && attacker.characterId === "takuto") {
    if (CHAR_HOOKS.takuto.startComboReattack(engine, attacker)) return;
  }
  // สึงาชิ ทาคุโตะ (characters/takuto.js): อย่างนายน่ะ จะไปเข้าใจอะไร (พิชิตแสงดาว) — หลังคอมโบ Saphir+Emeraude โอกาส 50% ได้โจมตีต่อเป็นครั้งที่ 3
  if (attacker && attacker.alive && attacker.characterId === "takuto") {
    if (CHAR_HOOKS.takuto.startThirdAttack(engine, attacker)) return;
  }
  // อิปโป (characters/ippo.js): Dempsey roll — โจมตีต่อเนื่องตามจำนวน Dempsey Charge ที่สะสมไว้
  // โปรดิวเซอร์: จ่ายรางวัล luminous burst หลังคลิปเล่นจบ (คิวไว้ตั้งแต่ตอนโดนตีครบทุกคน)
  CHAR_HOOKS.producer_lumi.flushBurst(engine);
  // ไดจิ เกราะโกโมร่า: สุ่มผ่านแล้ว -> โจมตีเพิ่มอีก 1 ครั้ง (ครั้งเพิ่มไม่สุ่มต่อ)
  if (CHAR_HOOKS.daichi.startExtraAttack(engine, attacker)) return;
  if (CHAR_HOOKS.ippo.startExtraAttack(engine, attacker)) return;
  if (CHAR_HOOKS.recruit.startExtraAttack(engine, attacker)) return; // Recruit: QTE ผ่าน 30% ได้โจมตีอีกครั้ง
  // โปรดิวเซอร์: All star 765 หมัดที่ 2 · kuroi 961 ตีต่อจากผู้ชนะ (ต้องอยู่หลังหมัดที่ 2 ของตัวเอง)
  if (CHAR_HOOKS.producer_lumi.startExtraAttack(engine, attacker)) return;
  if (CHAR_HOOKS.producer_lumi.startLoserAttack(engine)) return;
  // ฟุจิตะ โคโตเนะ (characters/kotone.js): Self-affirmation Explosion! Love Love — โจมตีเพิ่มอีก 1 ครั้ง
  if (attacker && attacker.alive && attacker.characterId === "kotone") {
    if (CHAR_HOOKS.kotone.startExtraAttack(engine, attacker)) return;
  }
  // คู่แฝดฮิซากาว่า (characters/hisakawa_sister.js): ฝันของเหล่าฝาแฝด — แฝดอีกคนออกมาโจมตีต่ออีก 1 ครั้ง
  //  (เลือกเป้าหมายเองได้ ดาเมจคงที่ 2) ต้องมาก่อนจังหวะอื่นเพราะเป็นส่วนหนึ่งของการโจมตีครั้งนี้
  if (CHAR_HOOKS.hisakawa_sister.startDreamFollowupAttack(engine, attacker)) return;
  if (CHAR_HOOKS.hisakawa_sister.startHayateAssistAttack(engine, attacker)) {
    match.gameState = "ATTACK";
    timers.startPhaseTimer(ATTACK_TIME, () => {
      const t = attackableTargets(match.attackerId);
      if (t.length) doAttack(match.attackerId, t[Math.floor(Math.random() * t.length)].id);
      // doAttack ปฏิเสธเป้าได้ (เช่น ไค: บังคับตีคู่ปรับที่เป็นเพื่อนร่วมทีมในโหมด Raid) — อย่าให้เฟส ATTACK ค้าง
      if (match.gameState === "ATTACK") endTurnPhase.endTurn();
    });
    view.broadcastState();
    return;
  }
  if (attacker) { delete attacker.statuses.miyakoHeal; delete attacker.statuses.yaak; }
  // สไตรเกอร์ ยูเรก้า (อาศัยจังหวะ · โหมดทีม): ฝั่งตรงข้ามตีจบแล้ว 15% ได้โจมตีตาม — ลำดับท้ายสุดหลังตีเพิ่มทุกแบบ
  if (CHAR_HOOKS.striker.startTimingAttack(engine, attacker)) return;
  endTurnPhase.endTurn();
}

// ยกเลิกการโจมตีซ้ำของหัวใจฆาตกร (characters/nanaya.js) — จบเทิร์นตามปกติ
function nanayaCancelReattack(id) {
  const p = match.players[id];
  if (!p || !p.alive || p.characterId !== "nanaya") return;
  CHAR_HOOKS.nanaya.cancelReattack(engine, p);
}

// สูตรคำนวณพลังโจมตีพื้นฐาน — ดึงออกมาจาก doAttack() ให้ทดสอบแยกได้ (ดู tests/computeAttackBase.test.js)
// ตัวละครที่ย้าย contribution มาไว้ที่ characters/<id>.js's damageBonus()/attackBaseOverride() แล้ว:
// appleguy, kotone, phenex, takuto, doomguy, oguri, miyako, hikaru
// — ที่เหลือ (ungated/flag-only) ยังอยู่ที่นี่
// เสียงโจมตีปกติเฉพาะตัวละคร (คีย์ใน client/src/audio.js) — null = ใช้เสียง "attack" กลาง
//  ฮารุกะ: ระหว่างสถานะ "โอเมก้า" เท่านั้น (ออกจากร่างแล้วกลับไปใช้เสียงกลางตามเดิม)
function attackSoundOf(attacker) {
  if (!attacker) return undefined;
  if (attacker.characterId === "mageslayer") return "mageslayer_attack";
  if (attacker.characterId === "tohno") return CHAR_HOOKS.tohno.attackSound(attacker); // ตีธรรมดา (ไม่ใช่ผลของสกิล)
  if (attacker.characterId === "recruit") return CHAR_HOOKS.recruit.attackSound(attacker); // เสียงปืน
  if (attacker.characterId === "striker") return CHAR_HOOKS.striker.attackSound(attacker);
  if (attacker.characterId === "cayenne") return CHAR_HOOKS.cayenne.attackSound(attacker); // ร่างเกพาร์ด: เสียงปืน           // BA.mp3
  if (attacker.characterId === "muimi") return CHAR_HOOKS.muimi.towerActive(attacker) ? "muimi_ub_hit" : "muimi_normal_hit";
  if (CHAR_HOOKS.haruka.omegaActive(attacker)) return "haruka_attack";             // hit_haruka.mp3
  return undefined;
}
function computeAttackBase(engine, attacker, target) {
  const hookCtx = {};
  const hook = engine.CHAR_HOOKS && engine.CHAR_HOOKS[attacker.characterId];
  const baseHook = (hook && hook.attackBaseOverride) ? hook.attackBaseOverride(engine, attacker, target, hookCtx) : 1;
  const hookBonus = (hook && hook.damageBonus) ? (hook.damageBonus(engine, attacker, target, hookCtx) || 0) : 0;

  const triggerForm = attacker.characterId === "ultraman_trigger";
  const storiumAtk = attacker.characterId === "hikaru" && (attacker.statuses.storium || 0) > 0;
  // ยุย โยชิโอกะ: girl don't cry (+1 ทั้งวง) และบัฟ "ทำนอง" ของคนที่ถูกชุบชีวิต (+2) — ungated ทั้งคู่
  const yuiRockAtk = !triggerForm && (attacker.statuses.yuiRock || 0) > 0;
  const yuiMelodyAtk = !triggerForm && (attacker.statuses.yuiMelody || 0) > 0;
  // ศิษย์ (โมโรโบชิ ดัน): ungated เหมือน veil/partner — เป็นบัฟที่แจกให้ผู้เล่นคนอื่น ไม่ผูกกับตัวละครเจ้าของสกิล
  const discipleAtk = !triggerForm && (attacker.statuses.danDisciple || 0) > 0;
  const empowerAtk = !triggerForm && (attacker.statuses.empower || 0) > 0;
  const phenexPurgeAtk = attacker.characterId === "phenex" && (attacker.statuses.phenexPurge || 0) > 0;
  const cardAtkBonus = triggerForm ? 0 : (attacker.statusAmt.cardAtkBonus || 0); // Trigger เสริมพลังตัวเองไม่ได้

  const mark42Atk = Mark42.attackBonus(attacker); // เกราะ Mark 42: พลังโจมตี +1 ระหว่างใส่ (ungated ใครใส่ก็ได้)
  // การเดินทาง: ป่าไม้ต้องสาป กลางวัน (ตีโดนแรงขึ้น +1) / จุดสิ้นสุดของโลก กลางคืน (ทุกคน +1) — ผลสนาม ungated
  const journeyAtkFx = Journey.attackBonus(engine);
  const journeyAtk = journeyAtkFx ? journeyAtkFx.amount : 0;
  // โอเบรอน (ฤดูร้อน) / จอมเวทย์ อาร์โทเรีย: บัฟพลังโจมตีที่แจกให้คนอื่น — ungated แยกคนละสถานะจึงซ้อนกันได้
  const giftAtk = CHAR_HOOKS.oberon_summer.atkBonus(attacker) + CHAR_HOOKS.artoria_caster.atkBonus(attacker) + CHAR_HOOKS.reines.atkBonus(attacker);
  const base = baseHook + hookBonus + mark42Atk + journeyAtk + giftAtk + (empowerAtk ? 1 : 0) + (discipleAtk ? CHAR_HOOKS.dan.DISCIPLE_ATK_BONUS : 0)
    + (yuiRockAtk ? CHAR_HOOKS.yui.ROCK_ATK : 0) + (yuiMelodyAtk ? CHAR_HOOKS.yui.MELODY_ATK : 0)
    + cardAtkBonus;
  return {
    base,
    storiumAtk, empowerAtk, discipleAtk, yuiRockAtk, yuiMelodyAtk, cardAtkBonus,
    phenexPurgeAtk, mark42Atk, journeyAtkFx,
    ...hookCtx,
  };
}

// คอนเนอร์ RK800 (สกิลพื้นฐาน วิเคราะห์สถานการณ์): ประเมินพลังโจมตีปกติที่ attacker จะฟาดใส่ target ได้
//  อ่านจากท่อเดียวกับการโจมตีจริง (computeAttackBase) แต่เป็นแค่ "ค่าประเมิน" — โบนัสที่ตัดสินตอนตีจริง
//  (สังหารทันที/ล่อเป้า/หลบหลีก/ลดดาเมจฝั่งรับ) ไม่ถูกนับ · ห่อ try/catch เพราะเรียกจาก buildStateFor ทุก broadcast
function estimateAttackOn(attacker, target) {
  try {
    const c = computeAttackBase(engine, attacker, target);
    return Math.max(0, c.base || 0);
  } catch { return null; }
}

function doAttack(byId, targetId) {
  if (match.gameState !== "ATTACK" || byId !== match.attackerId) return;
  const attacker = match.players[byId];
  if (!match.effectSourceId && attacker) return combat.withEffectSource(attacker, () => doAttack(byId, targetId));
  let target = match.players[targetId];
  if (!attacker || !target || !target.alive || target.id === attacker.id || combat.sameTeam(attacker, target) || combat.sealActive(target)
      || CHAR_HOOKS.the_supplicant.targetBlocked(attacker, target)) { // ลูกแกะน้อยรู้แจ้ง: เล็งผู้วิงวอนไม่ได้
    return;
  }
  // SE.RA.PH วันที่ 7: ดวลตัวต่อตัว — เล็งได้เฉพาะคู่ของตัวเองเท่านั้น
  //  ต้องกันที่นี่ด้วย ไม่ใช่แค่กรองรายชื่อใน attackableTargets() เพราะ targetId มาจาก client ตรง ๆ
  if (Seraph.active() && !Seraph.inCurrentDuel(target)) return;
  if (purge.benched(target) || purge.benched(attacker)) return; // Purge: ผู้ชมโจมตี/ถูกโจมตีไม่ได้
  if (CHAR_HOOKS.princess_shiki.cannotAttack(attacker)) return;       // เจ้าหญิงราก (patch 2.2.7): โจมตีไม่ได้ เว้นแต่ติดชักดาบ
  if (CHAR_HOOKS.producer_lumi.cannotAttack(attacker)) return;                            // โปรดิวเซอร์: ระหว่าง "เตรียมซ้อม" โจมตีปกติไม่ได้
  // ไค ชิซากิ: โทสะระงับด้วยโทสะ — มีคู่ปรับ (kaiRival1/kaiRival2 ยังไม่หมด) บังคับเป้าหมายมีแค่คู่ปรับเท่านั้น
  //  คู่ปรับที่ตีไม่ได้อยู่แล้ว (เพื่อนร่วมทีมในโหมด Raid / ตาย / อมตะ) = ไม่บังคับ ไม่งั้นเฟสโจมตีไม่มีเป้าที่ถูกกติกาเหลือเลย
  if (attacker.kaiRivalId && ((attacker.statuses.kaiRival1 || 0) > 0 || (attacker.statuses.kaiRival2 || 0) > 0) && target.id !== attacker.kaiRivalId
      && attackableTargets(attacker.id).some((o) => o.id === attacker.kaiRivalId)) {
    return;
  }
  // Recruit: ยังไม่ได้เล็ง -> เปิด QTE จุดแดงก่อน (ผ่านแล้วค่อยกลับมายิงจริงที่นี่อีกรอบ)
  if (characterRules.recruitInterceptAttack(attacker, target)) return;
  // คาเยนน์ (characters/cayenne.js): "แน่จริงก็หลบสิ" ครั้งแรกของเกม — เล่นวีดีโอก่อน แล้วค่อยเริ่มยิงจริง
  if (CHAR_HOOKS.cayenne.barrageNeedsVideo(attacker)) {
    timers.clearPhaseTimer();
    CHAR_HOOKS.cayenne.startBarrageVideo(engine, attacker);
    cutscene.runCutsceneQueue(() => { match.gameState = "ATTACK"; doAttack(byId, targetId); });
    return;
  }
  timers.clearPhaseTimer();
  CHAR_HOOKS.tohno.takeHurtVoice(engine); // เสียงร้องค้างจากหมัดก่อน (ไม่ได้ขึ้นการ์ด) ทิ้งไป ไม่ให้ไปโผล่ในการ์ดของหมัดนี้
  attacker.didAttackRound = true;
  // คาเยนน์ "แน่จริงก็หลบสิ": หมัดนี้เป็นการโจมตีครั้งที่เท่าไหร่ของชุด (0 = โจมตีปกติธรรมดา)
  //  แต่ละครั้งคือการโจมตีปกติแยกกันจริง — ครั้งถัดไปเปิดจากต้น endTurn (ดู CHAR_HOOKS.cayenne.continueBarrage)
  const cayBarrage = CHAR_HOOKS.cayenne.beginBarrageShot(engine, attacker, targetId);
  // โมโรโบชิ ดัน (characters/dan.js): เป้าหมายที่ถูกขับรถตาม "หันมาตีดัน" -> นับหมัด ครบ 2 ครั้งถึงสลัดหลุด
  //  วางไว้ตรงนี้ (ก่อนคิดดาเมจ) เพราะนับที่ "ได้ออกหมัด" ไม่ใช่ "ตีโดน" — ดันหลบได้ก็ยังนับให้
  CHAR_HOOKS.dan.onChasedAttacked(engine, attacker, target);
  CHAR_HOOKS.usagi.onAttack(engine, attacker);
  CHAR_HOOKS.artoria_caster.onAttack(engine, attacker); // ความหวัง: ออกหมัด (ถูกหลบก็นับ) ฟื้นแต้มสกิล +1
  CHAR_HOOKS.reines.onAttack(engine, attacker); // คุณนายใหญ่: ผู้ติดคำสั่งขั้นเด็ดขาดออกหมัด -> ไรเนสฟื้นแต้มสกิล +2
  // Bamboo-Hatted Kim: จำว่าออกหมัด (ก่อนด่านหลบทั้งหมด) — ถูกหลบ = ฝักดาบ +10 ตัดสินที่หมัดถัดไป/endTurn
  CHAR_HOOKS.kim.beforeAttack(engine, attacker);
  // โทโนะ ชิกิ: หมัดนี้เป็นหมัดแบบไหน (ธรรมดา / เชือดเฉือน / ระเบิดรอยร้าว) — ใช้สถานะที่รอไว้ตอนออกหมัด
  CHAR_HOOKS.tohno.beginAttack(engine, attacker);
  // "แม่นยำ" (บัฟ Universal — โทโนะ มองเห็นแล้ว!!): เจาะการหลบหลีกทุกแบบของเป้าหมาย (โล่กันครั้งยังกันได้ตามปกติ)
  const accurate = accurateActive(attacker);
  attacker.nanayaReattackReady = false; // หัวใจฆาตกร (นานายะ ชิกิ): กำลังใช้โอกาสโจมตีซ้ำนี้อยู่ (หรือไม่เกี่ยวข้องกับตัวละครนี้)

  let phenexTaunted = false;
  let batTaunted = false;
  // ตัวล่อเป้าทุกชนิดเข้าคิวเดียวกัน แล้วกระจายผู้โจมตีตามตำแหน่ง เพื่อไม่ให้คนแรก/ชนิดที่ประมวลผลทีหลังแย่งผลทั้งหมด
  const taunters = [
    ...CHAR_HOOKS.phenex.findTaunters(engine, attacker),
    ...CHAR_HOOKS.bat_ben.findTaunters(engine, attacker),
    ...CHAR_HOOKS.yui.findTaunters(engine, attacker), // ยุย: ปากแจ๋ว
    ...CHAR_HOOKS.kim.findTaunters(engine, attacker), // Bamboo-Hatted Kim: Yield My Flesh To Claim Their Bones
  ].filter((t) => !combat.sameTeam(attacker, t)).sort((a, b) => a.position - b.position);
  if (taunters.length) {
    const taunter = taunters[Math.max(0, (attacker.position || 1) - 1) % taunters.length];
    if (target.id !== taunter.id) {
      const oldTarget = target;
      target = taunter;
      phenexTaunted = taunter.characterId === "phenex";
      batTaunted = taunter.characterId === "bat_ben";
      const label = phenexTaunted ? "🥺 ไม่อยากให้ใครต้องเจ็บปวด"
        : taunter.characterId === "kim" ? "⚔️ Yield My Flesh To Claim Their Bones" : "🦇 เข้ามาเลย";
      match.lastLog.push(`${label} — ${taunter.name} ล่อเป้า! การโจมตีของ ${attacker.name} ถูกดึงจาก ${oldTarget.name} มาที่ตัวเอง`);
    }
  }

  // ---------- ชิกิ: นายมีฝีมือแค่ไหนหรอ? — ยกเลิกท่าไม้ตายแบบย้อนหลัง (patch 2.0.6.1) ----------
  //  ท่าไม้ตายที่มีผลอยู่ก่อนชิกิได้ชาร์จ จะยกเลิกตอนกดไม่ได้ — แต่ถ้าเจ้าของท่ามาตีชิกิที่ถือชาร์จอยู่
  //  ชิกิจะยกเลิกท่าไม้ตายนั้นย้อนหลังทันที (ก่อนคำนวณดาเมจ — โบนัสจากท่านั้นไม่ทำงาน)
  //  patch 2.0.8: ย้ายมาเช็คก่อนการหลบหลีก/สังหารทุกกรณี — การเลือกตีชิกิถือว่า "มาตี" แล้ว ยกเลิกได้เสมอ
  if (target.characterId === "shiki" && (target.statuses.godslay || 0) > 0) {
    const ultKey = SHIKI_CANCELABLE_ULTS.find((k) => (attacker.statuses[k] || 0) > 0);
    if (ultKey) {
      const isBardDim = ultKey === "bloodDim" || ultKey === "soulDim";
      const ultName = characterRules.shikiUltNameOf(attacker, ultKey);
      const ultImg = (TRANSFORMS[ultKey] && TRANSFORMS[ultKey].img)
        || (isBardDim ? TRANSFORMS.bardDim.img : ultKey === "ashen" ? TRANSFORMS.oguriAshen.img : view.displayImg(attacker));
      delete attacker.statuses[ultKey];
      if (ultKey === "muimiTower") CHAR_HOOKS.muimi.onUltExpire(engine, attacker);
      if (ultKey === "wither") characterRules.clearWitherLines(attacker.id);       // ลบเฉพาะเส้นชีวิตที่ท่าของเจ้าของคนนี้แจกไว้
      if (ultKey === "anata") { attacker.anataTargets = null; match.anataMusicSeq = 0; } // ANATA WAAAAAAAA (patch 2.0.8)
      // มิติมายาบรรเลง (patch 2.0.8.1): มิติปิดลง — ท่อนทำนองทั้งหมดถูกรีเซ็ต (แบบเดียวกับมิติจบเอง)
      if (isBardDim) { attacker.bloodSection = 0; attacker.soulSection = 0; }
      match.lastLog.push(`👁️ ${target.name} มองขาดทุกการเคลื่อนไหว — ยกเลิก ${ultName} ของ ${attacker.name} แบบย้อนหลัง!`);
      combat.shikiCancelUltimate(target, attacker, ultName, ultImg);
    }
  }

  // หลบหลีก (Encore / มิติมายาบรรเลง — Bard / สถานะพื้นฐาน patch 2.0.8): หลบการโดนโจมตีตาม % ที่ระบุ
  //  (ไม่ระบุ = 100%) — ซ้อนทับได้ หมดไปทีละ 1 ครั้งเมื่อถูกเลือกโจมตี ไม่ว่าหลบพ้นหรือไม่
  if (!accurate && (target.statuses.evade || 0) > 0) {
    const evadePct = statusAmtOf(target, "evade") || 100;
    consumeEvadeStack(target);
    if (Math.random() * 100 < evadePct) {
      // patch 2.1.3.5: ถูกโจมตีไม่ได้แต้มสกิลอีกต่อไป (แม้หลบพ้น)
      target.wasAttacked = true;
      match.lastLog.push(`💨 หลบหลีก! ${target.name} หลบการโจมตีของ ${attacker.name} ได้ (${evadePct}%) — เหลือหลบหลีกอีก ${target.statuses.evade || 0} ครั้ง`);
      match.lastAttack = {
        id: ++match.attackSeq,
        byName: attacker.name, byImg: view.displayImg(attacker), byColor: lobby.colorOf(attacker),
        byDoomWeapon: attacker.characterId === "doomguy" ? attacker.doomWeapon : undefined, // DoomGuy: อาวุธที่ใช้ยิงตอนนี้ (เสียงยิงฝั่ง client)
        byAttackSound: attackSoundOf(attacker), // เสียงโจมตีปกติเฉพาะตัว (ผู้สังหารเมจ / ฮารุกะระหว่างโอเมก้า)
        targetName: target.name, targetImg: view.displayImg(target), targetColor: lobby.colorOf(target),
        dmg: 0, dodge: true, fxMs: ATTACKFX_TIME * 1000,
        skills: [{ name: `หลบหลีก (${evadePct}%)`, img: BARD_CRIMSON_IMG, by: target.name, color: lobby.colorOf(target), side: "def" }],
      };
      match.gameState = "ATTACKING";
      timers.startPhaseTimer(ATTACKFX_TIME, () => cutscene.runCutsceneQueue(endTurnPhase.endTurn));
      view.broadcastState();
      return;
    }
    match.lastLog.push(`💨 ${target.name} พยายามหลบ (${evadePct}%) แต่ไม่พ้น — การโจมตีดำเนินต่อ (เหลือหลบหลีกอีก ${target.statuses.evade || 0} ครั้ง)`);
  }

  // ---------- ชิกิ: ฉันมองเห็นมันแล้ว (characters/shiki.js) — เป้าหมายเส้นตายครบ 6 = สังหารทันที (บังคับตาย) ----------
  const shikiEye = attacker.characterId === "shiki" && (attacker.statuses.deatheye || 0) > 0;
  if (shikiEye && !characterRules.killSealed(attacker) && (target.statuses.deathline || 0) >= SHIKI_DEATHLINE_MAX) {
    if (CHAR_HOOKS.shiki.onAttackDeatheye(engine, attacker, target)) return;
  }

  // ---------- ชิกิ: ความตายที่โรยรา (characters/shiki.js) — ท่าไม้ตาย 2 (rework patch 2.0.8) ----------
  //  เส้นชีวิตไม่ใช่โอกาสสังหารอีกต่อไป — แปรเป็นดาเมจเสริมการโจมตีปกติแทน (คำนวณต่อในส่วนดาเมจด้านล่าง)
  //  ยังคงมีโอกาสสังหารทันที 1% คงที่ (เพิ่มไม่ได้)
  const shikiWither = attacker.characterId === "shiki" && (attacker.statuses.wither || 0) > 0;
  const witherLines = shikiWither ? (target.statuses.deathline || 0) : 0;
  if (shikiWither && !characterRules.killSealed(attacker)) {
    if (CHAR_HOOKS.shiki.onAttackWither(engine, attacker, target)) return;
  }

  // ---------- เจ้าหญิงราก: Mystical Eye of Death Perception (Truth) (characters/princess_shiki.js) ----------
  //  ได้โจมตีปกติเมื่อไหร่ (ผ่าน "ชักดาบ") คิดโอกาสสังหารจากเส้นชีวิตที่อยู่บนตัวเป้าหมาย (1 หน่วย = 10%)
  if (attacker.characterId === "princess_shiki") {
    if (CHAR_HOOKS.princess_shiki.onAttackDeathline(engine, attacker, target)) return;
  }

  // ---------- ORT (characters/ort.js): โจมตีปกติมีโอกาสสังหารทันที 20% ----------
  if (attacker.characterId === "ort") {
    if (CHAR_HOOKS.ort.onAttackKill(engine, attacker, target)) return;
  }

  // ---------- "เนตรมณะ" (สถานะ Universal patch 2.2.7 — เจ้าหญิงราก "ทุกอย่างจะต้องราบรื่น") ----------
  //  ใครก็ตามที่ติดบัฟนี้ โจมตีปกติแล้วมีโอกาสสังหารเป้าหมายทันที 20% (คิดแยกจาก/หลังเนตรของแต่ละตัวละคร)
  //  วีดีโอสังหารขึ้นเฉพาะตอนเจ้าหญิงรากเป็นผู้ลงมือเอง — ตัวละครอื่นที่ได้บัฟไปสังหารเงียบๆ
  if (netramanaActive(attacker) && !characterRules.killSealed(attacker)) {
    const netraChance = characterRules.miyakoKillChance(target, NETRAMANA_KILL_CHANCE);
    if (Math.random() < netraChance) {
      if (characterRules.appleGuyDodgesKill(attacker, target)) return; // Apple guy: หลบสังหารทันทีได้
      // วีดีโอสังหารเล่นเฉพาะตอนเจ้าหญิงรากเป็นคนลงมือเองเท่านั้น — คนอื่นที่ยืมบัฟนี้ไปใช้
      //  สังหารได้เงียบๆ (ขึ้นแค่ป้ายสรุปการโจมตี) กันวีดีโอของเจ้าหญิงรากเด้งใส่ทั้งสนามทุกครั้งที่ใครก็ตามสังหารสำเร็จ
      if (attacker.characterId === "princess_shiki") cutscene.queueCutscene(attacker, "pshikiKill");
      combat.instantDeath(target);
      target.wasAttacked = true;
      if (!target.alive) match.lastLog.push(`👁️✨💀 เนตรมณะ — ${attacker.name} มองทะลุความตายของ ${target.name} (โอกาส ${Math.round(netraChance * 100)}%) — สังหารทันที!`);
      else match.lastLog.push(`👁️✨💀 เนตรมณะ — ${attacker.name} มองทะลุความตายของ ${target.name} — แต่ ${target.name} เกิดใหม่หนีความตายไปได้!`);
      match.lastAttack = {
        id: ++match.attackSeq,
        byName: attacker.name, byImg: view.displayImg(attacker), byColor: lobby.colorOf(attacker),
        byDoomWeapon: attacker.characterId === "doomguy" ? attacker.doomWeapon : undefined,
        targetName: target.name, targetImg: view.displayImg(target), targetColor: lobby.colorOf(target),
        dmg: 0, kill: !target.alive,
        skills: [{ name: "เนตรมณะ — สังหารทันที", img: PSHIKI_ULT_IMG, by: attacker.name, color: lobby.colorOf(attacker), side: "atk" }],
      };
      cutscene.runCutsceneQueue(() => {
        match.gameState = "ATTACKING";
        timers.startPhaseTimer(ATTACKFX_TIME + 2, endTurnPhase.endTurn);
        view.broadcastState();
      });
      return;
    }
    characterRules.miyakoSurvivedKillAttempt(target);
  }

  // ---------- นานายะ ชิกิ: Mystic eye of death perception (characters/nanaya.js) ----------
  attacker.nanayaMissedThisAttack = false;
  if (attacker.characterId === "nanaya") {
    if (CHAR_HOOKS.nanaya.onAttack(engine, attacker, target)) return;
  }

  // สกิลติดตัว Apple guy (ชิวๆ ไม่โดนหรอกครับ, characters/appleguy.js): ขณะชิวๆครับน้องๆ ทำงาน มีโอกาสหลบการถูกเลือกโจมตี
  if (!accurate && CHAR_HOOKS.appleguy.onAttackTryDodge(engine, attacker, target)) return;

  // โอกูริ แคป (Rework, characters/oguri.js — Training บัฟเสริม Flow): โอกาสหลบการโจมตี 50%
  if (!accurate && CHAR_HOOKS.oguri.tryFlowDodge(engine, attacker, target)) return;
  if (!accurate && CHAR_HOOKS.escanor.tryNightDodge(engine, attacker, target)) return;

  // โปรดิวเซอร์ (luminous): นับจำนวนครั้งที่ถูกตี — ต้องนับ "การถูกเล็ง" ไม่ใช่ "การโดนดาเมจ"
  //  จึงต้องอยู่ก่อนด่านหลบหลีกทั้งหมด · luminous มีการหลบ 40% ของคาโฮะติดมาด้วย ถ้านับหลังด่านหลบ
  //  หมัดที่ถูกหลบ (~40%) จะหายไปเงียบๆ จนรางวัลแทบไม่มีทางเกิดขึ้นเลย
  const lumiBurst = CHAR_HOOKS.producer_lumi.onAttackedNormally(engine, attacker, target);
  // เอจิ (characters/eiji.js): อัตราหลบหลีกรวม (ว่องไว + ไม่ว่ายังก็ตาม + Ordinal Scale) — 1 ครั้งต่อเทิร์น
  if (!accurate && CHAR_HOOKS.eiji.tryAttackDodge(engine, attacker, target)) return;
  // อิปโป (characters/ippo.js): หลบการโจมตีปกติ — หลบพ้นแล้วจบเทิร์นด้วยฉากหลบ
  if (!accurate && CHAR_HOOKS.ippo.tryAttackDodge(engine, attacker, target)) return;
  // สไตรเกอร์ ยูเรก้า (Mark 5): หลบการโจมตีปกติ 5%
  if (!accurate && CHAR_HOOKS.striker.tryAttackDodge(engine, attacker, target)) return;
  // โปรดิวเซอร์ (Tsubasa 283 ของคาโฮะ): หลบหลีก 40%
  if (!accurate && CHAR_HOOKS.producer_lumi.tryAttackDodge(engine, attacker, target)) return;
  // Zect (characters/daisuke.js): ระหว่าง Clock Up หลบการโจมตีได้ 25%
  if (!accurate && CHAR_HOOKS.daisuke.tryAttackDodge(engine, attacker, target)) return;
  if (!accurate && CHAR_HOOKS.yaguruma.tryAttackDodge(engine, attacker, target)) return;
  if (!accurate && CHAR_HOOKS.kagami.tryAttackDodge(engine, attacker, target)) return;
  if (!accurate && CHAR_HOOKS.tsurugi.tryAttackDodge(engine, attacker, target)) return;
  // โทโนะ ชิกิ: หลบหลีก 5% (ตระกูลโทโนะ · ใจเย็น) / 15% (เดือดดาล)
  if (!accurate && CHAR_HOOKS.tohno.tryAttackDodge(engine, attacker, target)) return;
  // การเดินทาง (ป่าไม้ต้องสาป กลางวัน): โจมตีพลาด 40% — ฝั่งผู้ตีพลาดเอง แต่ "แม่นยำ" ก็เจาะได้เหมือนด่านหลบ
  if (!accurate && Journey.tryAttackMiss(engine, attacker, target)) return;
  // เอจิ สกิลติดตัว 1 (ผู้เล่นอันดับ 2): ผู้ชนะไปตีคนอื่นที่ไม่ใช่เอจิ -> 25% ขัดจังหวะแล้วสวนคืน
  if (CHAR_HOOKS.eiji.tryInterrupt(engine, attacker, target)) return;

  // ---------- ซาโตรุ อาเคฟุ (patch 2.0.8.2): สกิลติดตัวลบล้างการโจมตี + Wonder of U สวนกลับ ----------
  if (target.characterId === "satoru") {
    const r = characterRules.satoruOnTargeted(target, attacker, "การโจมตี");
    if (r.negated) {
      // patch 2.1.3.5: ถูกโจมตีไม่ได้แต้มสกิลอีกต่อไป
      target.wasAttacked = true;
      match.lastAttack = {
        id: ++match.attackSeq,
        byName: attacker.name, byImg: view.displayImg(attacker), byColor: lobby.colorOf(attacker),
        byDoomWeapon: attacker.characterId === "doomguy" ? attacker.doomWeapon : undefined, // DoomGuy: อาวุธที่ใช้ยิงตอนนี้ (เสียงยิงฝั่ง client)
        byAttackSound: attackSoundOf(attacker), // เสียงโจมตีปกติเฉพาะตัว (ผู้สังหารเมจ / ฮารุกะระหว่างโอเมก้า)
        targetName: target.name, targetImg: view.displayImg(target), targetColor: lobby.colorOf(target),
        dmg: 0, dodge: true, fxMs: ATTACKFX_TIME * 1000,
        skills: [{ name: "อย่าได้ไล่ตามหัวหน้า (การโจมตีถูกลบล้าง)", img: SATORU_PROFILE_IMG, by: target.name, color: lobby.colorOf(target), side: "def" }],
      };
      cutscene.runCutsceneQueue(() => { // วีดีโอ Wonder of U (ถ้าเพิ่งสวนกลับ) เล่นก่อนจบเทิร์น
        match.gameState = "ATTACKING";
        timers.startPhaseTimer(ATTACKFX_TIME, endTurnPhase.endTurn);
        view.broadcastState();
      });
      return;
    }
    // ลบล้างติดคูลดาวน์อยู่ — การโจมตีดำเนินต่อ (Wonder of U อาจสวนกลับไปแล้วใน satoruOnTargeted)
  }

  // สูตรพลังโจมตีพื้นฐาน — ย้าย body ไป computeAttackBase() แล้ว (ดูก่อนหน้า doAttack ในไฟล์นี้)
  let {
    base,
    gingastriumAtk, ginga, storiumAtk, lastStanding, empowerAtk,
    appleAtk, kotoneLove, kotoneLoveDmg,
    oguriGoldAtk, victoryAtk, phenexPurgeAtk, miyakoUltAtk,
    doomLockonAtk, cardAtkBonus,
    triggerCircleAtk, triggerMultiAtk, triggerZeperionAtk, triggerLightBonus, triggerMultiHighestHp, triggerMultiLowHpPenalty,
    triggerDarkAtk, muimiTowerAtk, mark42Atk, journeyAtkFx,
  } = computeAttackBase(engine, attacker, target);
  // ผกผัน (สถานะ Universal patch 2.2.1): โบนัสพลังโจมตีที่ควรได้ กลับกลายเป็นลดพลังโจมตีแทน (คำนวณรอบเพดานฐาน 1 หน่วย)
  if (invertActive(attacker)) base = Math.max(0, 1 - (base - 1));
  let dmg = base;
  // เสริมพลัง / อ่อนแอ (สถานะพื้นฐาน patch 2.0.8): เพิ่ม/ลดดาเมจที่ทำได้ตามจำนวนที่ระบุ
  //  ผู้วิงวอน (patch 3.4): "เกราะศรัทธา" ให้เสริมพลัง 1 · "ลูกแกะน้อยรู้แจ้ง" ให้อ่อนแอ 1 / เปราะบาง 1
  //  คิดสดที่นี่แทนการใส่เป็นสถานะจริง เพราะสถานะแม่ทั้งสองตัวล้าง/ต้านไม่ได้ (ดูหัว characters/the_supplicant.js)
  const mightAtk = attacker.characterId === "ultraman_trigger" ? 0
    : statusAmtOf(attacker, "might") + CHAR_HOOKS.the_supplicant.statusAmtBonus(attacker, "might");
  if (mightAtk > 0) dmg += mightAtk;
  // ยูนะ: Longing (บัฟผู้ถูกฟื้นคืนชีพ +1 ถาวร 5 เทิร์น) / Break Beat Bark! (ทุกคน +1 เฉพาะโจมตีปกติ ไม่ใช่สกิล)
  const yunaLongingAtk = attacker.characterId === "ultraman_trigger" ? 0 : statusAmtOf(attacker, "yunaLonging");
  if (yunaLongingAtk > 0) dmg += yunaLongingAtk;
  const yunaBeatBark = attacker.characterId !== "ultraman_trigger" && characterRules.yunaBeatBarkActive();
  if (yunaBeatBark) dmg += 1;
  //  "พิษร้าย" หักพลังโจมตีเหมือน "อ่อนแอ" — ซ้อนกันได้ จึงรวมกันก่อนหักทีเดียว
  const weakAtk = statusAmtOf(attacker, "weak") + CHAR_HOOKS.the_supplicant.statusAmtBonus(attacker, "weak") + poisonAtkPenalty(attacker);
  if (weakAtk > 0) dmg = Math.max(0, dmg - weakAtk);
  // ความตายที่โรยรา (ชิกิ patch 2.0.8): เส้นชีวิตของเป้าหมายแปรเป็นดาเมจเสริม +1 ต่อเส้น
  //  แต่พลังโจมตีรวมฝั่งผู้โจมตีไม่เกิน 5 หน่วยต่อการโจมตี
  if (shikiWither && witherLines > 0) {
    const before = dmg;
    dmg = Math.min(SHIKI_WITHER_ATK_CAP, dmg + witherLines);
    match.lastLog.push(`🥀 ความตายที่โรยรา — เส้นชีวิตของ ${target.name} แปรเป็นดาเมจเสริม +${Math.max(0, dmg - before)} (พลังโจมตีรวมสูงสุด ${SHIKI_WITHER_ATK_CAP})`);
  } else if (shikiWither) {
    dmg = Math.min(SHIKI_WITHER_ATK_CAP, dmg); // เพดานพลังโจมตีระหว่างท่าไม้ตาย 2 คงที่ 5
  }
  // ลำแสงสโตเรียม (ฮิคารุ patch 2.1.3): แทนที่ดาเมจทั้งหมดด้วยสูตรเฉพาะ — โจมตีปกติ(สูงสุด 4) + ลุกไหม้ที่เหลือของเป้าหมาย รวมไม่เกิน 8
  let storiumAtkPart = 0, storiumBurnPart = 0;
  if (storiumAtk) {
    storiumAtkPart = Math.min(HIKARU_STORIUM_ATK_CAP, dmg);
    storiumBurnPart = target.statuses.hburn || 0;
    dmg = Math.min(HIKARU_STORIUM_TOTAL_CAP, storiumAtkPart + storiumBurnPart);
    delete attacker.statuses.storium;
  }
  // คุ้มครอง (Harmony / สถานะพื้นฐาน): ความเสียหายที่ได้รับลดลงตามจำนวนที่ระบุ (ไม่ระบุ = 1)
  const bardGuard = (target.statuses.guard || 0) > 0;
  const guardAmt = (bardGuard ? (statusAmtOf(target, "guard") || 1) : 0)
    + CHAR_HOOKS.the_supplicant.statusAmtBonus(target, "guard");
  if (guardAmt > 0) dmg = Math.max(0, dmg - guardAmt);
  // Discord (Bard): เป้าหมายติดขัดแย้ง — ความเสียหายที่ได้รับ +1
  const bardDiscord = (target.statuses.discord || 0) > 0;
  if (bardDiscord) dmg += 1;
  // เปราะบาง (สถานะพื้นฐาน patch 2.0.8): ความเสียหายที่ได้รับเพิ่มตามจำนวนที่ระบุ
  const fragileAmt = statusAmtOf(target, "fragile") + CHAR_HOOKS.the_supplicant.statusAmtBonus(target, "fragile");
  if (fragileAmt > 0) dmg += fragileAmt;
  // ยูนะ: Delete (+1 ดาเมจที่ได้รับ) / Smile for You (-1 ดาเมจที่ได้รับ) — ต้าน/ลบไม่ได้ ซ้อนกับเปราะบางได้
  const yunaDeleteAmt = statusAmtOf(target, "yunaDelete");
  if (yunaDeleteAmt > 0) dmg += yunaDeleteAmt;
  //  เอจิ (เอฟเฟกต์เฉพาะตัว): โจมตีปกติของเอจิไม่สนบัฟลดความเสียหาย Smile for You ของเป้าหมาย
  const yunaSmileAmt = CHAR_HOOKS.eiji.ignoresYunaSmile(attacker) ? 0 : statusAmtOf(target, "yunaSmile");
  if (yunaSmileAmt > 0) dmg = Math.max(0, dmg - yunaSmileAmt);
  // เต็มอิ่ม (Breakfast โอกูริ patch 2.0.8.1): ดาเมจที่ได้รับ -1 (หมดหลังจบเทิร์นที่กดใช้)
  const fullBelly = (target.statuses.fullbelly || 0) > 0;
  if (fullBelly) dmg = Math.max(0, dmg - 1);
  // MOON*CELL (คิชินามิ ฮาคุโนะ patch 2.2.1): ทุกคนยกเว้นเจ้าของท่า โจมตีด้วยพลังโจมตีพื้นฐาน 1 หน่วยเท่านั้น
  //  ไม่ว่าจะเสริมแกร่งอะไรมา (ทับค่าที่คำนวณไว้ทั้งหมดข้างบน — สกิลติดตัว/บัฟถาวรที่ไม่ใช่สถานะก็โดนด้วย)
  // หอกผู้พิชิต (สึงาชิ ทาคุโตะ patch 2.2.5): ทับดาเมจทั้งหมดด้วยค่าคงที่ 5 หน่วย (เหนือกว่าทุกโบนัส/ดีบัฟที่คำนวณมาข้างบน)
  const takutoLanceAtk = attacker.characterId === "takuto" && (attacker.statuses.lance || 0) > 0;
  if (takutoLanceAtk) dmg = TAKUTO_LANCE_DMG;
  // Rider Slash (คามิชิโร่ ซึรุงิ): จังหวะที่สองเป็นแผลเล็กๆ คงที่ 1 เสมอ ไม่คิดโบนัสใดๆ — พิษต่างหากคือส่วนที่แท้จริง
  if (CHAR_HOOKS.tsurugi.slashSecondHit(attacker)) dmg = CHAR_HOOKS.tsurugi.SLASH2_DMG;
  if (CHAR_HOOKS.escanor.adjustOutgoingDamage) dmg = CHAR_HOOKS.escanor.adjustOutgoingDamage(engine, attacker, target, dmg);
  if (attacker.characterId === "satoru") dmg = 0; // ซาโตรุ: โจมตีธรรมดาดาเมจ 0 แล้วติด ObLa หลังโจมตี
  // เอจิ (characters/eiji.js): ดาบแห่งความทรงจำ — โอกาสคูณดาเมจ 2 เท่า (คิดท้ายสุดเพื่อให้คูณยอดสุทธิจริง)
  const eijiSwordFx = {};
  dmg = CHAR_HOOKS.eiji.applySwordDouble(engine, attacker, dmg, eijiSwordFx);
  // ORT: คริติคอล 75% คูณยอดสุทธิ ×2 (คิดท้ายสุดเหมือนดาบของเอจิ)
  const ortCritFx = {};
  dmg = CHAR_HOOKS.ort.applyCrit(engine, attacker, dmg, ortCritFx);
  const usagiCritFx = {};
  dmg = CHAR_HOOKS.usagi.applyCrit(engine, attacker, dmg, usagiCritFx); // อุซากิ: คริติคอล 7% ต่อปรุๆ (×2)
  const kimCritFx = {};
  dmg = CHAR_HOOKS.kim.applyCrit(engine, attacker, dmg, kimCritFx); // Bamboo-Hatted Kim: Poise 1.2%/หน่วย (+หัว 15%) ×2
  // การเดินทาง (อาณาจักรน้ำแข็ง กลางวัน): ตัวละครที่ไม่มีอัตราคริเอง ได้คริติคอล 20% ×2
  //  ตัวละครที่มีอัตราคริเอง (อุซากิ/Kim) ได้อัตราเพิ่มบวกเข้าไปในการทอยของตัวเองด้านบนแล้ว (engine.critBonusFor)
  //  + บัฟอัตราคริของไรเนส (คำสั่งขั้นเด็ดขาด) ทอยรวมกับสนามครั้งเดียว
  const journeyCritFx = {};
  dmg = Journey.applyCrit(engine, attacker, dmg, journeyCritFx, CHAR_HOOKS.reines.critBonus(attacker) + CHAR_HOOKS.andersen.critBonus(attacker));
  // โทโนะ ชิกิ (มองเห็นแล้ว!!): ผ่านด่านหลบแล้ว -> ระเบิดรอยร้าวบนเป้า ดาเมจ +จำนวนรอยร้าว (รอยร้าวถูกใช้หมดแม้โล่จะกัน)
  const tohnoBurstFx = {};
  dmg = CHAR_HOOKS.tohno.applyBurst(engine, attacker, target, dmg, tohnoBurstFx);
  // ฮารุกะ (characters/haruka.js): จงไปสู่สุขติ — จุดชนวน "เลือดไหล" ของเป้าหมายให้ระเบิดรวมกับหมัดนี้
  //  ต้องอ่านค่าเลือดไหล "ก่อน" ความเสียหายลง และก่อนที่โอเมก้าจะแปะเลือดไหลก้อนใหม่ (onAttackLanded ด้านล่าง)
  const harukaPunishFx = {};
  dmg = CHAR_HOOKS.haruka.applyPunish(engine, attacker, target, dmg, harukaPunishFx);
  // คู่แฝดฮิซากาว่า (characters/hisakawa_sister.js): หมัดที่ 2 ของ "ฝันของเหล่าฝาแฝด" — แฝดอีกคนออกมาตีเอง
  //  ดาเมจคงที่เสมอ ไม่รับโบนัสพลังโจมตี/บัฟใดๆ ของตัวที่กำลังคุมอยู่ (คิดท้ายสุดเพื่อทับทุกอย่าง)
  const hisakawaDreamAtk = CHAR_HOOKS.hisakawa_sister.isDreamAttack(attacker);
  if (hisakawaDreamAtk) dmg = CHAR_HOOKS.hisakawa_sister.DREAM_FOLLOWUP_DMG;
  // คาเยนน์ แน่จริงก็หลบสิ: ทุกครั้งของชุด 1 หน่วยคงที่ บัฟฝั่งผู้ยิงไม่มีผล แต่ดีบัฟของเป้าหมายมีผล (ทับทุกอย่างข้างบน)
  if (cayBarrage) dmg = CHAR_HOOKS.cayenne.bulletDamage(engine, target);

  // ---------- ริต้า เบอร์นัล (characters/phenex.js): ฝันไปเถอะ — ตั้งรับ สะท้อนความเสียหายทั้งหมดกลับผู้โจมตีแทนที่จะรับเอง ----------
  if (CHAR_HOOKS.phenex.tryReflectHit(engine, attacker, target, dmg)) return;

  // ---------- แบทแมน (characters/bat_ben.js): นายลืมของน่ะ — ดูดซับความเสียหายทั้งก้อนไว้ แล้วรอเลือกส่งต่อ ----------
  //  ต้องอยู่ก่อนการลงความเสียหายจริงเสมอ (ทั้งตัวแบทแมนและผู้โจมตีจะไม่เจ็บ — เข้ามาเลยจึงไม่สะท้อนด้วย)
  if (CHAR_HOOKS.bat_ben.tryKarmaAbsorb(engine, attacker, target, dmg)) return;

  // ลำแสงสโตเรียม (ฮิคารุ patch 2.1.3): เล่นวีดีโอก่อนสรุปผลความเสียหาย
  if (storiumAtk) {
    cutscene.triggerCutscene(attacker, "hikaruStorium");
    match.lastLog.push(`🌟 ${attacker.name} ลำแสงสโตเรียม — โจมตีปกติ ${storiumAtkPart} + ลุกไหม้ที่เหลือของ ${target.name} ${storiumBurnPart} = ${dmg} หน่วย (สูงสุด ${HIKARU_STORIUM_TOTAL_CAP})`);
  }
  const attackerBeat = combat.beatActive(attacker); // Beat Mode: การโจมตีเป็นความเสียหายจริง ไม่สนเกราะ
  // คาซามะ ไดสุเกะ Rider Shooting (characters/daisuke.js): ล้างเกราะทิ้งก่อนหมัดจะลง
  //  ต้องจำไว้ก่อนว่าท่าอาร์มอยู่ไหม — สองตัวนี้จะล้างธงทิ้งตอนออกหมัด
  //  ใช้ตัดสินท้ายฟังก์ชันว่าจะเล่นวีดีโอก่อนหรือหลังการ์ดสรุปความเสียหาย
  const daisukeRiderFired = CHAR_HOOKS.daisuke.riderArmed(attacker);
  const yagurumaStingFired = CHAR_HOOKS.yaguruma.stingArmed(attacker);
  const kagamiKickFired = CHAR_HOOKS.kagami.kickArmed(attacker);
  const tsurugiSlashFired = CHAR_HOOKS.tsurugi.slashArmed(attacker);
  CHAR_HOOKS.daisuke.stripArmorOnAttack(engine, attacker, target);
  CHAR_HOOKS.yaguruma.stripResistOnAttack(engine, attacker, target); // Rider Sting: เจาะ "ต้านสถานะ" ก่อน ดีบัฟที่ตามมาจึงติด
  // Rider Kick (// คากามิ อาราตะ): เป้าหมายกาง "ต้านสถานะ" ไว้ -> แลกดีบัฟทั้งชุดเป็นหมัดทะลุเกราะเพดาน 3
  const kagamiKickPierce = CHAR_HOOKS.kagami.prepareKickOnAttack(engine, attacker, target);
  // Rider Slash (คามิชิโร่ ซึรุงิ): จังหวะแรกปาดบัฟล่าสุดทิ้งก่อนหมัดจะลง
  CHAR_HOOKS.tsurugi.prepareSlashOnAttack(engine, attacker, target);
  // สไตรเกอร์ ยูเรก้า (หมัดเหล็ก): ผ่านด่านหลบแล้ว = ใช้ท่า — ปาดบัฟก่อนหมัดลง + คิววีดีโอ (เล่นก่อนฉากความเสียหาย)
  const strikerFistFx = CHAR_HOOKS.striker.prepareFistOnAttack(engine, attacker, target);
  const hpBefore = target.hp;
  const shieldBefore = target.shield;
  const escanorFormBeforeHit = target.characterId === "escanor" ? CHAR_HOOKS.escanor.formOf(target) : null;
  // เชื่อมผล (patch 2.0.8): HP ที่เป้าหมายเสียจริงจะแชร์ให้คู่เชื่อมเท่ากันผ่าน loseHp — เก็บค่าก่อนตีไว้โชว์ผล
  const linkedBuddy = combat.linkedBuddyOf(target);
  const buddyHpBefore = linkedBuddy ? linkedBuddy.hp : 0;
  // RS-Hopper (เอวา 13 patch 2.2.1 alpha): "การโจมตีปกติ" = การโจมตีจากการเลือกเป้าหมายในระบบเทิร์นปกติ (doAttack นี้เสมอ)
  //  ไม่ว่าจะมีบัฟเสริมพลังโจมตีติดตัวหรือไม่ — กันเต็มไม่ได้ กันได้แค่ไม่ให้ต่ำกว่า 4 หน่วย (RS-Hopper พิเศษ ดูใน loseHp)
  //  ส่วนความเสียหายจากสกิลประเภทโจมตี/เลือกเป้าหมายที่ไม่ผ่าน doAttack (เช่น ปลดปล่อยความเจ็บปวดของริต้า) กันเต็มได้ทันที
  // DoomGuy (patch 2.2 full): บางอาวุธ (Heavy Cannon / Plasma Rifle / Ballista) ดาเมจเจาะเกราะ — ทะลุเกราะเข้าเลือดจริงเสมอ
  const doomPierceAtk = attacker.characterId === "doomguy" && !((attacker.statuses.doomCrucible || 0) > 0) &&
    !!(DOOM_WEAPONS[attacker.doomWeapon] || DOOM_WEAPONS.shotgun).pierce;
  const ippoArmorBefore = target.armor; // อิปโป Uper Cut: ตัดสินจากเกราะ "ก่อน" โดนหมัดนี้
  const cayPendingBefore = CHAR_HOOKS.cayenne.pendingTotal(target); // คาเยนน์ ทหารผ่านศึก: หมัดนี้ถูกเลื่อนไปเทิร์นหน้าไหม
  if (kagamiKickPierce) dmg = Math.min(dmg, CHAR_HOOKS.kagami.KICK_PIERCE_CAP); // เพดานรวมของหมัดนั้น ไม่ใช่โบนัสที่บวกทีหลัง
  if (attackerBeat || phenexPurgeAtk || doomPierceAtk || kagamiKickPierce) combat.dealDirect(target, dmg, true); // กันตายทะลุเกราะ / อย่าอยู่เลย แกน่ะ!: ทะลุเกราะเข้าเลือดจริง
  else combat.dealMixed(target, dmg, true);               // กฎปกติ: ลดเกราะก่อน ถ้าไม่มีเกราะจึงเข้าเลือดจริง
  CHAR_HOOKS.escanor.onNormalAttackReceived(engine, attacker, target, escanorFormBeforeHit);
  // คาเยนน์ (characters/cayenne.js): เปราะบาง 50% (เกพาร์ด — มีผลตั้งแต่ครั้งถัดไป) · ปืนพกฟื้นเลือด
  const cayAttackFx = CHAR_HOOKS.cayenne.afterMainHit(engine, attacker, target, cayBarrage);
  // ไดจิ (characters/daichi.js): เกราะโกโมร่า 50% ได้ตีเพิ่ม 1 ครั้ง · เกราะเอเลคิง 30% สตั้นเป้าหมายเทิร์นหน้า
  const daichiAttackFx = CHAR_HOOKS.daichi.afterMainHit(engine, attacker, target);
  // ผู้สังหารเมจ (characters/mageslayer.js): Fury — สูบพลังชีวิตและมอบ [ดูดซับเวท] ตามขั้น แล้วเคลียร์สต็อก
  //  (การขโมยพลังงานจากตราล่าเวททำที่ท่อดาเมจกลาง mageslayerMarkSteal ไปแล้ว)
  CHAR_HOOKS.mageslayer.onAttackPostDamage(engine, attacker, target, dmg);
  CHAR_HOOKS.ultraman_trigger.onAttackLanded(engine, attacker, target, {
    triggerCircleAtk, triggerMultiAtk, triggerZeperionAtk, triggerLightBonus,
  });
  // (รัก รักที่สุดเลย) (ฟุจิตะ โคโตเนะ, characters/kotone.js): ใช้แล้วหมดไปทันที และล้างกระปุกออมสินทั้งหมด
  CHAR_HOOKS.kotone.onAttackConsumeLove(engine, attacker);
  // เอจิ (characters/eiji.js): Smile for You ลงตัวเอง -> ฟื้นเลือด · Delete ลงเป้าหมาย -> มอบ "ผุพัง"
  CHAR_HOOKS.eiji.onAttackLanded(engine, attacker, target);
  // Rider Kick (// คากามิ อาราตะ): ฝัง "ช็อต" + "ชา" แล้วล้างการชาร์จทิ้ง (หมัดทะลุเกราะไม่ฝังดีบัฟ)
  CHAR_HOOKS.kagami.resolveKickOnAttack(engine, attacker, target, kagamiKickPierce);
  // Rider Slash (คามิชิโร่ ซึรุงิ): จบจังหวะแรก -> ตั้งธงรอจังหวะสอง / จบจังหวะสอง -> ฝังพิษแล้วปิดชุด
  CHAR_HOOKS.tsurugi.resolveSlashOnAttack(engine, attacker, target);
  // ฮารุกะ (characters/haruka.js): โอเมก้า — การโจมตีปกติแปะ "เลือดไหล" ให้เป้าหมาย 2 หน่วย
  const harukaBleedApplied = CHAR_HOOKS.haruka.onAttackLanded(engine, attacker, target);
  // มุยมิ: ดาบเก่าๆ/ดาบสะบั้นฟื้นฟูเมื่อโจมตีปกติ และใจที่ไม่ยอมแพ้ยืดเวลาท่าไม้ตาย
  const muimiAttackFx = CHAR_HOOKS.muimi.onAttackLanded(engine, attacker);
  // คอนเนอร์ RK800 (characters/conner.js): โจมตีปกติใส่คอนเนอร์ -> ผู้โจมตีเครียด +2
  //  และสกิลติดตัว 4 "การป้องกันตัว" โรล 15% ถ้าคนตีไม่ใช่คนเดิมกับครั้งก่อน (คิววีดีโอไว้ ดาเมจลงที่ postAttackFollowup)
  CHAR_HOOKS.conner.onConnerAttacked(engine, attacker, target);
  const connerCounterFired = CHAR_HOOKS.conner.onAttackedNormally(engine, attacker, target);
  // โมโรโบชิ ดัน (characters/dan.js): "ศิษย์" หันมาโจมตีปกติใส่ดัน -> เล่น dan_skill2.mp4 แล้วสวนคืน 3 หน่วย
  const danCounterFx = CHAR_HOOKS.dan.onAttackedNormally(engine, attacker, target);
  // ยุย (characters/yui.js): เยอรมันซูเพล็ก — สวนกลับผู้ที่โจมตีปกติใส่ (เล่นวีดีโอก่อนสรุปความเสียหาย)
  const yuiCounterFx = CHAR_HOOKS.yui.onAttackedNormally(engine, attacker, target);
  // Bamboo-Hatted Kim: หมัดของ Kim ลง (ฝักดาบ/ชักดาบ/Yield My Flesh/ฟื้นเลือด) · Kim ถูกตี (ฝักดาบ + สวนกลับ)
  const kimAtkFx = CHAR_HOOKS.kim.onAttackLanded(engine, attacker, target, dmg);
  const kimCounterFx = CHAR_HOOKS.kim.onAttackedNormally(engine, attacker, target, dmg);
  // โทโนะ ชิกิ: ใจเย็น ฟื้นพลังชีวิต + ตระกูลโทโนะ 10% ตีอีกครั้ง · เดือดดาล รอยร้าว +1 (ตี 0 ก็นับว่าตีโดน)
  const tohnoAtkFx = CHAR_HOOKS.tohno.onAttackLanded(engine, attacker, target);
  // สไตรเกอร์ ยูเรก้า: มือมีดมอบเลือดไหล · เตาปฏิกรณ์ 15% แทงสวน (วีดีโอเล่นก่อนสรุปความเสียหาย)
  const strikerBleed = CHAR_HOOKS.striker.onAttackLanded(engine, attacker, target);
  const strikerCounterFx = CHAR_HOOKS.striker.onAttackedNormally(engine, attacker, target);
  // แบทแมน (characters/bat_ben.js): ปืนติดรถ — ใช้แล้วหมดกระสุน (ดาเมจถูกบวกไปแล้วที่ computeAttackBase)
  const batGunFired = CHAR_HOOKS.bat_ben.consumeGun(engine, attacker);
  // อิปโป (characters/ippo.js): Uper Cut ลงผลตามว่าเป้าหมาย "มีเกราะก่อนโดนหมัดนี้" หรือไม่
  const ippoUpperFx = CHAR_HOOKS.ippo.resolveUpper(engine, attacker, target, ippoArmorBefore);
  CHAR_HOOKS.daisuke.consumeRiderOnAttack(engine, attacker); // ไรเดอร์ชูตใช้ได้ครั้งเดียว — ธงหายไม่ว่ามีเกราะให้ล้างหรือไม่
  CHAR_HOOKS.yaguruma.resolveStingOnAttack(engine, attacker, target); // ฝังพิษร้าย + ผุพัง แล้วใช้โควตาหมด
  // โปรดิวเซอร์: Mishiro 346 ขโมยของ · Tsubasa 283 ฟื้นแต้มสกิล · All star 765 จองหมัดที่ 2
  const lumiAtkFx = CHAR_HOOKS.producer_lumi.onAttackLanded(engine, attacker, target);
  // ผู้วิงวอน (characters/the_supplicant.js): ตราพิพากษาเดินหน้า — "ถูกโจมตี" และ "เป็นฝ่ายโจมตี" นับแยกกัน
  //  ยิงทีละฝั่งเพราะทั้งผู้โจมตีและผู้ถูกโจมตีอาจถือตราคนละใบพร้อมกันได้
  const supJudgeDefFx = CHAR_HOOKS.the_supplicant.onJudgeTrigger(engine, target, "ถูกโจมตี");
  const supJudgeAtkFx = CHAR_HOOKS.the_supplicant.onJudgeTrigger(engine, attacker, "เป็นฝ่ายโจมตี");
  // Dempsey Charge: เทหมดหน้าตัก -> จำนวนครั้งที่ต้องตีเพิ่ม (บัฟหายทั้งก้อนตรงนี้)
  if (CHAR_HOOKS.ippo.dempseyActive(attacker)) attacker.ippoExtraAtk = (attacker.ippoExtraAtk || 0) + CHAR_HOOKS.ippo.consumeCharge(engine, attacker);
  // Ginga Strium (ฮิคารุ, characters/hikaru.js): โจมตีโดนเป้าหมาย -> ติดลุกไหม้ให้เป้าหมาย / ถูกโจมตีขณะอยู่ในร่างนี้ -> ผู้โจมตีติดลุกไหม้สวนกลับ
  CHAR_HOOKS.hikaru.onAttackBurnApply(engine, attacker, target);
  const escanorAttackVideoQueued = CHAR_HOOKS.escanor.onAttackLanded(engine, attacker, target);
  CHAR_HOOKS.satoru.applyPassiveAttack(engine, attacker, target);
  const hisakawaAttackFx = CHAR_HOOKS.hisakawa_sister.onAttackLanded(engine, attacker, target);
  const ignisAttackFx = CHAR_HOOKS.ignis.onAttackLanded(engine, attacker, target);
  CHAR_HOOKS.hisakawa_sister.maybeDreamFollowup(engine, attacker, target);
  // ริต้า เบอร์นัล: อย่าอยู่เลย แกน่ะ! — เล่นวีดีโอก่อนสรุปผล + ลบ/แบนท่าไม้ตายเป้าหมาย (นับมิติมายาบรรเลงของคีตกวีด้วย)
  if (phenexPurgeAtk) {
    cutscene.triggerCutscene(attacker, "phenexPurge");
    if (target.alive) {
      const purgeKey = SHIKI_CANCELABLE_ULTS.find((k) => (target.statuses[k] || 0) > 0);
      if (purgeKey) {
        const isBardDim = purgeKey === "bloodDim" || purgeKey === "soulDim";
        const ultName = characterRules.shikiUltNameOf(target, purgeKey);
        delete target.statuses[purgeKey];
        if (purgeKey === "muimiTower") CHAR_HOOKS.muimi.onUltExpire(engine, target);
        if (target.statusAmt) delete target.statusAmt[purgeKey];
        if (purgeKey === "wither") characterRules.clearWitherLines(target.id);
        if (purgeKey === "anata") { target.anataTargets = null; match.anataMusicSeq = 0; }
        if (isBardDim) { target.bloodSection = 0; target.soulSection = 0; }
        match.lastLog.push(`🚫 ${attacker.name} อย่าอยู่เลย แกน่ะ! — ลบและปิดการใช้งาน ${ultName} ของ ${target.name} ทันที!`);
      } else if (resistActive(target)) {
        match.lastLog.push(`🛡️ ${target.name} ต้านสถานะผิดปกติ — อย่าอยู่เลย แกน่ะ! ไม่มีผล`);
      } else {
        target.statuses.phenexBanUlt = Math.max(target.statuses.phenexBanUlt || 0, PHENEX_BAN_ULT_TURNS);
        match.lastLog.push(`🚫 ${attacker.name} อย่าอยู่เลย แกน่ะ! — ${target.name} ไม่มีท่าไม้ตายทำงานอยู่ บังคับห้ามใช้ท่าไม้ตาย ${PHENEX_BAN_ULT_TURNS} เทิร์นแทน`);
      }
    }
  }
  // หนูจะทำให้พี่ตาสว่างเอง (อาริมะ มิยาโกะ): เล่นวีดีโอก่อนสรุปผล — เป้าหมายมีความสามารถสังหารทันทีติดตัวไหม
  //  มี -> ปิดใช้งานความสามารถนั้น 3 เทิร์น | ไม่มี -> "ย๊ากก!" พลังโจมตี +1 ลงหมัดนี้ทันที (ผ่าน miyakoAtkBonusOn ด้านบน)
  //  และตั้งสถานะ yaak ต่อไว้ให้ — ถ้ากำลังต่อคอมโบเพลงหมัดอาริมะอยู่ (miyakoCombo) yaak จะไม่ถูกล้างจนกว่าคอมโบจะจบ
  //  ทำให้ทุกหมัดที่เหลือในคอมโบเดียวกันได้โบนัสด้วย (นับทั้งคอมโบเป็นการโจมตีครั้งเดียวตามที่ตั้งใจไว้) — ไม่ใช่คอมโบก็เคลียร์ทิ้งหลังหมัดนี้ตามปกติ
  //  + เป้าหมายเกราะไม่ฟื้น 5 เทิร์น
  if (miyakoUltAtk) CHAR_HOOKS.miyako.resolveUltHit(engine, attacker, target);
  // เสริมพลัง (Rejuvenation): ใช้แล้วหมดไปทันทีเมื่อได้โจมตี
  if (empowerAtk) {
    delete attacker.statuses.empower;
    match.lastLog.push(`💪 ${attacker.name} เสริมพลังจาก Rejuvenation — การโจมตีนี้ +1 (บัฟหมดลง)`);
  }
  // The Beat of Victory (โอกูริ Rework, characters/oguri.js): เป้าหมายที่ถูกโจมตีติด "เกินเยียวยา" + "ชะงัก"
  if (victoryAtk) {
    CHAR_HOOKS.oguri.applyVictoryEffect(engine, target);
  }
  // Beat Mode กันตาย (ครั้งเดียวต่อเกม): ทำงานทันทีเมื่อความเสียหายถึงตาย — ไม่ต้องอยู่ใน Beat Mode ก่อน
  //  หลังกันตายทำงาน -> เกราะจะไม่ฟื้นคืน + ภูมิดาเมจจากการแพ้ (แต่ครั้งต่อไปจะตายปกติ)
  const beatSaveFired = combat.maybeBeatSave(target);
  characterRules.maybeWakeKotone(target); // โคโตเนะหลับอยู่โดนโจมตี = สะดุ้งตื่น + ติด [โหมงานหนัก]
  // เชื่อมผล (Resonance patch 2.0.8): HP ที่เป้าหมายเสียจริงถูกแชร์ให้คู่เชื่อมเท่ากันแล้ว (ผ่าน loseHp)
  //  — ตรวจผลเพื่อแจ้งเตือน/กันตาย/ผลต่อเนื่องของคู่เชื่อม
  let linkedHit = null;
  if (linkedBuddy && linkedBuddy.hp < buddyHpBefore) {
    const shared = buddyHpBefore - linkedBuddy.hp;
    combat.maybeBeatSave(linkedBuddy);
    combat.maybeBeatMode(linkedBuddy);
    characterRules.maybeWakeKotone(linkedBuddy);
    linkedBuddy.wasAttacked = true;
    linkedHit = linkedBuddy;
    match.lastLog.push(`🔗 เชื่อมผล! ${linkedBuddy.name} รับความเสียหายตาม ${target.name} -${shared}`);
  }
  target.wasAttacked = true;
  target.phenexLastHitBy = attacker.id; // ริต้า เบอร์นัล: จำผู้โจมตีล่าสุด — ใช้เลือกเป้าปลดปล่อยความเจ็บปวดตอนตกรอบจริง
  // patch 2.1.3.5: ถูกโจมตีไม่ได้แต้มสกิลอีกต่อไป
  // Beat Mode: ถ้าการโจมตีทำให้เลือดเหลือ < 3 -> เข้าประกายเขี้ยวปฏิปักษ์
  combat.maybeBeatMode(target);
  // มีดพก (ชิกิ, characters/shiki.js): การโจมตีปกติฟื้นเลือดให้ตัวเอง (คงอยู่ 2 เทิร์น)
  const knifeAtk = attacker.characterId === "shiki" && (attacker.statuses.knife || 0) > 0;
  const knifeHeal = knifeAtk ? CHAR_HOOKS.shiki.applyKnifeHeal(engine, attacker) : 0;
  // พี่จ๋าอยู่ไหน (อาริมะ มิยาโกะ): การโจมตีปกติฟื้นเลือดตัวเอง +1 ทุกครั้ง (คงอยู่จนกว่าจะได้ตี — รวมทุกครั้งของคอมโบ)
  const miyakoHealAtk = attacker.characterId === "miyako" && (attacker.statuses.miyakoHeal || 0) > 0;
  if (miyakoHealAtk) CHAR_HOOKS.miyako.applyHealOnHit(engine, attacker);
  // เทเปา (characters/tepeu.js): การโจมตีปกติมอบสถานะ "เส้นชีวิต" ให้เป้าหมาย +1 เสมอ (ไม่ต้องติดครุ่นคิดก็ได้)
  CHAR_HOOKS.tepeu.grantDeathlineOnAttack(engine, attacker, target);
  // เจ้าหญิงราก (characters/princess_shiki.js): สกิลติดตัว — ใครลงมือโจมตีเธอ คนนั้นติดเส้นชีวิต +1 ถาวร (สูงสุด 3)
  CHAR_HOOKS.princess_shiki.grantDeathlineOnAttacked(engine, attacker, target);
  // เจ้าหญิงราก: "ชักดาบ" ได้โจมตีจริงแล้ว -> ฟื้นพลังชีวิต +2
  const pshikiBladeHeal = CHAR_HOOKS.princess_shiki.applyBladeHeal(engine, attacker);
  // แบทแมน (characters/bat_ben.js): เข้ามาเลย — ความเสียหายที่ลงกับแบทแมน เกิดกับผู้โจมตีด้วยเท่ากัน
  const batReflectDmg = CHAR_HOOKS.bat_ben.applyTauntReflect(engine, attacker, target, dmg);
  // ฮารุกะ (characters/haruka.js): อมาซอน — ระหว่างโอเมก้า มีโอกาส 15% สวนกลับผู้โจมตี + สตั้นเทิร์นถัดไป
  const harukaCounterFx = CHAR_HOOKS.haruka.tryCounter(engine, attacker, target);
  // ย๊ากก! (อาริมะ มิยาโกะ patch 2.2.1 alpha): พลังโจมตี +1 ต่อการโจมตี — ถ้าใช้ร่วมกับเพลงหมัดอาริมะ
  //  นับทั้งคอมโบเป็นการโจมตีครั้งเดียว จึงยังไม่ลบตรงนี้ (ให้บวก +1 ทุกหมัดในคอมโบ) — ลบจริงตอนคอมโบจบใน postAttackFollowup()
  // ---------- DoomGuy (characters/doomguy.js) ----------
  if (attacker.characterId === "doomguy") CHAR_HOOKS.doomguy.onAttackPostDamage(engine, attacker, target, dmg, doomLockonAtk);
  // ---------- สึงาชิ ทาคุโตะ (characters/takuto.js) ----------
  const takutoUlt2VideoQueued = attacker.characterId === "takuto" ? CHAR_HOOKS.takuto.onAttackPostDamage(engine, attacker, dmg) : false;
  // เนตรมารแห่งความมรณะ (ชิกิ, characters/shiki.js): โจมตีปกติระหว่างท่าไม้ตายทำงาน (แต่เส้นตายยังไม่ถึง 6) -> รีเซ็ตเส้นตายเป้าหมาย
  const deathlineReset = CHAR_HOOKS.shiki.resetDeathlineOnHit(engine, attacker, target);
  match.lastLog.push(`${attacker.name} โจมตี ${target.name} -${dmg} (ลดเกราะก่อน)`);

  // Ginga / ลำแสงสโตเรียม (ฮิคารุ, characters/hikaru.js): ตีหมู่ผู้เล่นอื่นที่ไม่ใช่เป้าหมาย
  CHAR_HOOKS.hikaru.onAttackGingaSplash(engine, attacker, target, ginga);
  CHAR_HOOKS.hikaru.onAttackStoriumSplash(engine, attacker, target, storiumAtk);

  // Ginga no Uta (ฮิคารุ, characters/hikaru.js): กำจัดเป้าหมายได้ขณะอยู่ในร่าง Ginga Strium -> ต่ออายุ +1 เทิร์น
  CHAR_HOOKS.hikaru.onAttackExtendOnKill(engine, attacker, target, hpBefore, gingastriumAtk);

  // สกิลที่มีผลกับการโจมตีครั้งนี้ (โชว์ใต้อนิเมชัน แยกฝั่งชัดเจน: atk = ฝั่งโจมตี | def = ฝั่งป้องกัน)
  const fxSkills = [];
  const addFx = (x, side) => { if (x) fxSkills.push({ ...x, side }); };
  for (const fx of hisakawaAttackFx || []) addFx(fx, fx.side || "atk");
  if (mercury.isOrt(target) && dmg > 0) mercury.ortFx("hit");
  if (usagiCritFx.crit) addFx({ name: `ปรุๆ คริติคอล ×2 (${usagiCritFx.chance}%${usagiCritFx.field ? " รวมโบนัสอัตราคริ" : ""})`, img: CHAR_HOOKS.usagi.IMG.base, by: attacker.name, color: lobby.colorOf(attacker) }, "atk");
  if (ortCritFx.crit) addFx({ name: "คริติคอล ×2", img: CHAR_HOOKS.ort.IMG.base, by: attacker.name, color: lobby.colorOf(attacker) }, "atk");
  if (CHAR_HOOKS.recruit.consumeHeadshot(attacker)) addFx({ name: "HeadShot +1", img: CHAR_HOOKS.recruit.IMG.base, by: attacker.name, color: lobby.colorOf(attacker) }, "atk");
  if (mark42Atk > 0) addFx({ name: `เกราะ Mark 42 +${mark42Atk}`, img: Mark42.IMG.suit, by: attacker.name, color: lobby.colorOf(attacker) }, "atk");
  if (journeyAtkFx) addFx({ name: journeyAtkFx.name, img: null, by: attacker.name, color: lobby.colorOf(attacker) }, "atk");
  for (const name of CHAR_HOOKS.oberon_summer.atkFx(attacker)) addFx({ name, img: CHAR_HOOKS.oberon_summer.IMG.base, by: attacker.name, color: lobby.colorOf(attacker) }, "atk");
  for (const name of CHAR_HOOKS.artoria_caster.atkFx(attacker)) addFx({ name, img: CHAR_HOOKS.artoria_caster.IMG.base, by: attacker.name, color: lobby.colorOf(attacker) }, "atk");
  for (const name of CHAR_HOOKS.reines.atkFx(attacker)) addFx({ name, img: CHAR_HOOKS.reines.IMG.base, by: attacker.name, color: lobby.colorOf(attacker) }, "atk");
  if (journeyCritFx.crit) addFx({ name: `คริติคอล ×2 (${journeyCritFx.pct}%)`, img: null, by: attacker.name, color: lobby.colorOf(attacker) }, "atk");
  if (kimCritFx.crit) addFx({ name: `Poise คริติคอล ×2 (${kimCritFx.chance}%${kimCritFx.field ? " รวมโบนัสอัตราคริ" : ""})`, img: view.displayImg(attacker), by: attacker.name, color: lobby.colorOf(attacker) }, "atk");
  for (const name of kimAtkFx) addFx({ name, img: view.displayImg(attacker), by: attacker.name, color: lobby.colorOf(attacker) }, "atk");
  if (accurate) addFx({ name: "แม่นยำ — เจาะการหลบหลีก", img: CHAR_HOOKS.tohno.IMG.ultimate, by: attacker.name, color: lobby.colorOf(attacker) }, "atk");
  if (tohnoBurstFx.fired) addFx({ name: `มองเห็นแล้ว!! — ระเบิดรอยร้าว ${tohnoBurstFx.cracks} ขั้น (+${tohnoBurstFx.cracks})`, img: CHAR_HOOKS.tohno.IMG.ultimate, by: attacker.name, color: lobby.colorOf(attacker) }, "atk");
  for (const name of tohnoAtkFx) addFx({ name, img: CHAR_HOOKS.tohno.IMG.basic, by: attacker.name, color: lobby.colorOf(attacker) }, "atk");
  if (strikerFistFx) addFx({ name: `หมัดเหล็ก +1${strikerFistFx.stripped ? ` · ปาด "${strikerFistFx.stripped.label}"` : ""}${strikerFistFx.combo ? " · ซ้ำเป้าเดิม สตั้นเทิร์นหน้า" : ""}`, img: CHAR_HOOKS.striker.IMG.skill2, by: attacker.name, color: lobby.colorOf(attacker) }, "atk");
  if (strikerBleed > 0) addFx({ name: `มือมีด — เลือดไหล +${strikerBleed}`, img: CHAR_HOOKS.striker.IMG.skill1, by: attacker.name, color: lobby.colorOf(attacker) }, "atk");
  if (strikerCounterFx) addFx({ name: `เตาปฏิกรณ์ — แทงสวน -${strikerCounterFx.dmg}`, img: CHAR_HOOKS.striker.IMG.base, by: target.name, color: lobby.colorOf(target) }, "def");
  if (kimCounterFx) addFx({ name: kimCounterFx.name, img: kimCounterFx.img, by: target.name, color: lobby.colorOf(target) }, "def");
  for (const fx of ignisAttackFx || []) addFx(fx, fx.side || "atk");
  if (ginga) addFx(combat.skillByStatus(attacker, "ginga"), "atk");
  if (gingastriumAtk) addFx({ name: `Ginga Strium${lastStanding ? " +1 (คู่ต่อสู้คนเดียว)" : ""}`, img: HIKARU_STRIUM_IMG, by: attacker.name, color: lobby.colorOf(attacker) }, "atk");
  // empower เป็นบัฟกลาง — คีตกวี (Rejuvenation) และผู้สังหารเมจ (Fury ขั้น 3) ใช้ร่วมกัน จึงเลือกภาพตามผู้ถือบัฟ
  if (empowerAtk) addFx({ name: "เสริมพลัง +1", img: attacker.characterId === "bard" ? BARD_CRIMSON_IMG : view.displayImg(attacker), by: attacker.name, color: lobby.colorOf(attacker) }, "atk");
  if (appleAtk > 0) addFx({ name: `เอาไปสิ +${appleAtk} (บัฟมอบของ)`, img: "/characters/appleguy/appleguy_skill2.jpg", by: attacker.name, color: lobby.colorOf(attacker) }, "atk");
  if (kotoneLove) addFx({ name: `รัก รักที่สุดเลย +${kotoneLoveDmg} (กระปุกออมสิน)`, img: "/characters/kotone/rework/KotonePFP.png", by: attacker.name, color: lobby.colorOf(attacker) }, "atk");
  if (shieldBefore > target.shield) addFx({ name: "โล่ป้องกัน (กันความเสียหาย)", img: null, by: target.name, color: lobby.colorOf(target) }, "def");
  // maybeBeatSave เหลือเจ้าของเดียวคือทาคุโตะ (ฉันยัง...มองเห็นอยู่!!!)
  if (beatSaveFired) addFx({ name: "ฉันยัง...มองเห็นอยู่!!! (กันตาย)", img: view.displayImg(target), by: target.name, color: lobby.colorOf(target) }, "def");
  // เรียวกิ ชิกิ
  if (knifeAtk) addFx({ name: `มีดพก (ฟื้นเลือด +${knifeHeal})`, img: "/characters/shiki/shiki_skill1.webp", by: attacker.name, color: lobby.colorOf(attacker) }, "atk");
  if (deathlineReset) addFx({ name: "เนตรมารแห่งความมรณะ (เส้นชีวิตถูกรีเซ็ต)", img: SHIKI_DEATH_IMG, by: attacker.name, color: lobby.colorOf(attacker) }, "atk");
  // Bard: คุ้มครอง / ขัดแย้ง / เชื่อมผล
  if (guardAmt > 0) addFx({ name: `คุ้มครอง (ความเสียหายลด ${guardAmt})`, img: BARD_CRIMSON_IMG, by: target.name, color: lobby.colorOf(target) }, "def");
  if (bardDiscord) addFx({ name: "Discord — ขัดแย้ง (+1 ดาเมจ)", img: BARD_JADE_IMG, by: target.name, color: lobby.colorOf(target) }, "atk");
  if (linkedHit) addFx({ name: `เชื่อมผล (${linkedHit.name} -${buddyHpBefore - linkedHit.hp})`, img: BARD_JADE_IMG, by: target.name, color: lobby.colorOf(target) }, "def");
  // โอกูริ แคป (Rework)
  if (oguriGoldAtk > 0) addFx({ name: `ยุคทอง +${oguriGoldAtk}`, img: view.displayImg(attacker), by: attacker.name, color: lobby.colorOf(attacker) }, "atk");
  if (victoryAtk) addFx({ name: `The Beat of Victory +${OGURI_ULT_ATK_BONUS} (เป้าหมายติดเกินเยียวยา+ชะงัก)`, img: TRANSFORMS.victorybeat.img, by: attacker.name, color: lobby.colorOf(attacker) }, "atk");
  if (fullBelly) addFx({ name: "เต็มอิ่ม (ดาเมจ -1)", img: view.displayImg(target), by: target.name, color: lobby.colorOf(target) }, "def");
  // การ์ดแดงครบ 3 ใบตอนเปิดไพ่ (ระบบกองการ์ดกลาง)
  if (cardAtkBonus > 0) addFx({ name: `การ์ดแดงครบ 3 ใบ +${cardAtkBonus}`, img: view.displayImg(attacker), by: attacker.name, color: lobby.colorOf(attacker) }, "atk");
  // สถานะพื้นฐาน patch 2.0.8
  if (mightAtk > 0) addFx({ name: `เสริมพลัง +${mightAtk}`, img: view.displayImg(attacker), by: attacker.name, color: lobby.colorOf(attacker) }, "atk");
  if (weakAtk > 0) addFx({ name: `อ่อนแอ -${weakAtk}`, img: view.displayImg(attacker), by: attacker.name, color: lobby.colorOf(attacker) }, "atk");
  // ยูนะ
  if (yunaLongingAtk > 0) addFx({ name: `Longing (ยูนะ) +${yunaLongingAtk}`, img: YUNA_IMG, by: attacker.name, color: YUNA_COLOR }, "atk");
  if (yunaBeatBark) addFx({ name: "Break Beat Bark! (ยูนะ) +1", img: YUNA_IMG, by: attacker.name, color: YUNA_COLOR }, "atk");
  if (fragileAmt > 0) addFx({ name: `เปราะบาง (+${fragileAmt} ดาเมจ)`, img: view.displayImg(target), by: target.name, color: lobby.colorOf(target) }, "def");
  if (yunaDeleteAmt > 0) addFx({ name: `Delete (ยูนะ) +${yunaDeleteAmt}`, img: YUNA_IMG, by: target.name, color: YUNA_COLOR }, "def");
  if (yunaSmileAmt > 0) addFx({ name: `Smile for You (ยูนะ) -${yunaSmileAmt}`, img: YUNA_IMG, by: target.name, color: YUNA_COLOR }, "def");
  if (shikiWither && witherLines > 0) addFx({ name: `ความตายที่โรยรา — เส้นชีวิตแปรเป็นดาเมจ (สูงสุดรวม ${SHIKI_WITHER_ATK_CAP})`, img: SHIKI_WITHER_IMG, by: attacker.name, color: lobby.colorOf(attacker) }, "atk");
  if (triggerCircleAtk) addFx({ name: "Circle Arms — แสงสว่าง +2 / ฟื้นชีวิต +2", img: "/characters/ultraman_trigger/skill1/trigger_skill1.webp", by: attacker.name, color: lobby.colorOf(attacker) }, "atk");
  if (triggerMultiAtk) {
    const multiText = triggerMultiLowHpPenalty ? "Multi Sword Finish: HP ต่ำกว่า 5 ดาเมจเหลือ 2" : triggerMultiHighestHp ? "Multi Sword Finish +1 / แสงสว่างเพิ่ม +2" : "Multi Sword Finish / แสงสว่างเพิ่ม +2";
    addFx({ name: multiText, img: "/characters/ultraman_trigger/skill2/trigger_skill2.png", by: attacker.name, color: lobby.colorOf(attacker) }, "atk");
  }
  if (triggerZeperionAtk) addFx({ name: `ลำแสง Zeperion +${triggerLightBonus} จากแสงสว่าง`, img: "/characters/ultraman_trigger/skill3/trigger_skill3.jpg", by: attacker.name, color: lobby.colorOf(attacker) }, "atk");
  if (triggerDarkAtk) addFx({ name: `ความมืดที่ย้อมอนาคต +${triggerDarkAtk}`, img: "/characters/ignis/trigger_dark.jpg", by: attacker.name, color: lobby.colorOf(attacker) }, "atk");
  if (phenexTaunted) addFx({ name: "ไม่อยากให้ใครต้องเจ็บปวด (ล่อเป้ามาที่ตัวเอง)", img: PHENEX_NTD_IMG, by: target.name, color: lobby.colorOf(target) }, "def");
  if (batTaunted) addFx({ name: "เข้ามาเลย (ล่อเป้ามาที่ตัวเอง)", img: BAT_SKILL3_IMG, by: target.name, color: lobby.colorOf(target) }, "def");
  if (batReflectDmg > 0) addFx({ name: `เข้ามาเลย — ความเสียหายเกิดกับผู้โจมตีด้วย -${batReflectDmg}`, img: BAT_SKILL3_IMG, by: target.name, color: lobby.colorOf(target) }, "def");
  // ---------- มิซึซาว่า ฮารุกะ (characters/haruka.js) ----------
  if (harukaPunishFx.punishStacks > 0) addFx({ name: `จงไปสู่สุขติ — ระเบิดเลือดไหล +${harukaPunishFx.punishStacks}`, img: CHAR_HOOKS.haruka.IMG.skill2, by: attacker.name, color: lobby.colorOf(attacker) }, "atk");
  if (ippoUpperFx) addFx({ name: ippoUpperFx.kind === "decay" ? "Uper Cut — ผุพัง 3 เทิร์น" : "Uper Cut — สตั้นเทิร์นหน้า", img: CHAR_HOOKS.ippo.IMG.skill2, by: attacker.name, color: lobby.colorOf(attacker) }, "atk");
  if (lumiAtkFx) for (const name of lumiAtkFx) addFx({ name, img: view.displayImg(attacker), by: attacker.name, color: lobby.colorOf(attacker) }, "atk");
  if (lumiBurst) addFx({ name: "luminous — ทุกคนตีครบแล้ว!", img: CHAR_HOOKS.producer_lumi.IMG.luminous, by: target.name, color: lobby.colorOf(target) }, "def");
  if (supJudgeDefFx) addFx({ name: `${supJudgeDefFx.kind === "mercy" ? "ความเมตตา" : "คำพิพากษา"} ${supJudgeDefFx.n}/${CHAR_HOOKS.the_supplicant.JUDGE_NEED}`, img: CHAR_HOOKS.the_supplicant.IMG.skill3, by: target.name, color: lobby.colorOf(target) }, "def");
  if (supJudgeAtkFx) addFx({ name: `${supJudgeAtkFx.kind === "mercy" ? "ความเมตตา" : "คำพิพากษา"} ${supJudgeAtkFx.n}/${CHAR_HOOKS.the_supplicant.JUDGE_NEED}`, img: CHAR_HOOKS.the_supplicant.IMG.skill3, by: attacker.name, color: lobby.colorOf(attacker) }, "atk");
  if (batGunFired) addFx({ name: `ปืนติดรถ +${CHAR_HOOKS.bat_ben.GUN_BONUS}`, img: CHAR_HOOKS.bat_ben.IMG_GUN, by: attacker.name, color: lobby.colorOf(attacker) }, "atk");
  if (yuiCounterFx) addFx({ name: `เยอรมันซูเพล็ก — ทุ่มสวนกลับ -${yuiCounterFx.dmg}`, img: CHAR_HOOKS.yui.IMG.skill2, by: target.name, color: lobby.colorOf(target) }, "def");
  if (danCounterFx) addFx({ name: `นายทำให้ฉันผิดหวัง — สวนกลับศิษย์ -${danCounterFx.dmg}`, img: CHAR_HOOKS.dan.IMG.skill2, by: target.name, color: lobby.colorOf(target) }, "def");
  if (connerCounterFired) addFx({ name: "การป้องกันตัว — สวนกลับผู้โจมตีทั้งสองคน", img: CHAR_HOOKS.conner.IMG.base, by: target.name, color: lobby.colorOf(target) }, "def");
  if (harukaBleedApplied > 0) addFx({ name: `โอเมก้า — เลือดไหล +${harukaBleedApplied}`, img: CHAR_HOOKS.haruka.IMG.ult, by: attacker.name, color: lobby.colorOf(attacker) }, "atk");
  if (muimiTowerAtk > 0) addFx({ name: `ดาบสะบั้น — พลังโจมตี +${muimiTowerAtk}`, img: CHAR_HOOKS.muimi.IMG.skill3, by: attacker.name, color: lobby.colorOf(attacker) }, "atk");
  if (muimiAttackFx) addFx({
    name: muimiAttackFx.mode === "tower"
      ? `ดาบสะบั้น — ฟื้นพลังชีวิต +${muimiAttackFx.hp}${muimiAttackFx.extended ? " · ยืดเวลา +1 เทิร์น" : ""}`
      : `ดาบเก่าๆ — ฟื้นพลังชีวิต +${muimiAttackFx.hp} · แต้มสกิล +${muimiAttackFx.sp}`,
    img: muimiAttackFx.mode === "tower" ? CHAR_HOOKS.muimi.IMG.skill3 : CHAR_HOOKS.muimi.IMG.skill2,
    by: attacker.name, color: lobby.colorOf(attacker),
  }, "atk");
  if (harukaCounterFx) addFx({ name: `อมาซอน — สวนกลับ -${harukaCounterFx.dmg}${harukaCounterFx.bled > 0 ? ` + เลือดไหล ${harukaCounterFx.bled}` : ""}${harukaCounterFx.stunned ? " + สตั้นเทิร์นหน้า" : ""}`, img: CHAR_HOOKS.haruka.IMG.base, by: target.name, color: lobby.colorOf(target) }, "def");
  for (const fx of CHAR_HOOKS.cayenne.attackFx(engine, attacker, cayAttackFx)) addFx(fx, fx.side);
  for (const fx of CHAR_HOOKS.daichi.attackFx(engine, attacker, daichiAttackFx)) addFx(fx, fx.side);
  addFx(CHAR_HOOKS.cayenne.delayFx(engine, target, cayPendingBefore), "def");
  if (pshikiBladeHeal > 0) addFx({ name: `อืม ฉันเข้าใจแล้ว (ฟื้นเลือด +${pshikiBladeHeal})`, img: "/characters/princess_shiki/p_shiki_skill1.jpg", by: attacker.name, color: lobby.colorOf(attacker) }, "atk");

  // อนิเมชันบอกว่าใครตีใคร
  match.lastAttack = {
    id: ++match.attackSeq,
    byName: attacker.name, byImg: view.displayImg(attacker), byColor: lobby.colorOf(attacker),
        byDoomWeapon: attacker.characterId === "doomguy" ? attacker.doomWeapon : undefined, // DoomGuy: อาวุธที่ใช้ยิงตอนนี้ (เสียงยิงฝั่ง client)
        byAttackSound: attackSoundOf(attacker), // เสียงโจมตีปกติเฉพาะตัว (ผู้สังหารเมจ / ฮารุกะระหว่างโอเมก้า)
    byVoice: CHAR_HOOKS.tohno.attackVoice(attacker), // เสียงพากย์ตอนตี (โทโนะ — สุ่ม 1 จาก 6 ทุกหมัด รวมหมัดของสกิล)
    targetVoice: CHAR_HOOKS.tohno.takeHurtVoice(engine), // เสียงร้องของโทโนะที่โดนดาเมจระหว่างหมัดนี้ (เล่นพร้อมการ์ด ไม่ทับคลิป)
    targetName: target.name, targetImg: view.displayImg(target), targetColor: lobby.colorOf(target),
    dmg, aoe: ginga || storiumAtk, revenge: false, skills: fxSkills,
    fxMs: (fxSkills.length ? ATTACKFX_TIME + 2 : ATTACKFX_TIME) * 1000,
  };
  const showAttackFx = () => {
    match.gameState = "ATTACKING";
    // มีข้อมูลสกิลให้อ่าน -> ยืดเวลาอนิเมชันให้อ่านทัน
    // หัวใจฆาตกร (นานายะ ชิกิ): เนตรมารพลาดสังหาร -> เปิดโอกาสโจมตีซ้ำแทนการจบเทิร์นตรงๆ
    timers.startPhaseTimer(fxSkills.length ? ATTACKFX_TIME + 2 : ATTACKFX_TIME, () => cutscene.runCutsceneQueue(() => postAttackFollowup(attacker)));
    view.broadcastState();
  };
  // Beam Magnum Plus (ริดดี้ patch 2.1.1) / Beam Magnum + แสงที่ไม่อยู่เพียงลำพัง (บานาจ patch 2.1.2) / ลำแสงสโตเรียม (ฮิคารุ patch 2.1.3)
  //  / อย่าอยู่เลย แกน่ะ! (ริต้า เบอร์นัล patch 2.1.6) / ฉันยัง...มองเห็นอยู่!!! กันตาย + อย่างนายน่ะ จะไปเข้าใจอะไร (สึงาชิ ทาคุโตะ patch 2.2.4):
  //  เล่นวีดีโอที่ค้างคิวก่อน แล้วค่อยขึ้นสรุปความเสียหาย
  //  (ปกติทุกท่าอื่นจะขึ้นสรุปความเสียหายก่อนแล้วค่อยเล่นวีดีโอค้างคิวตอนจบ — ท่าเหล่านี้กลับลำดับเฉพาะตัว)
  if ((storiumAtk || phenexPurgeAtk || miyakoUltAtk || triggerMultiAtk || triggerZeperionAtk || escanorAttackVideoQueued || (beatSaveFired && target.characterId === "takuto") || takutoUlt2VideoQueued || eijiSwordFx.videoQueued || harukaPunishFx.videoQueued || (harukaCounterFx && harukaCounterFx.videoQueued) || (danCounterFx && danCounterFx.videoQueued) || (yuiCounterFx && yuiCounterFx.videoQueued) || batGunFired || daisukeRiderFired || yagurumaStingFired || kagamiKickFired || tsurugiSlashFired || strikerFistFx || strikerCounterFx || tohnoBurstFx.videoQueued) && match.cutsceneQueue.length) cutscene.runCutsceneQueue(showAttackFx);
  else showAttackFx();
}
