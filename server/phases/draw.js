// เฟสไพ่: แจกรอบใหม่, จั่ว, เปิดไพ่
// export ก่อน require: ไฟล์ใน server/ require วนกันเอง — function declaration ถูก hoist จึงพร้อมใช้ตั้งแต่บรรทัดแรก
Object.assign(module.exports, {
  dealRound, hit, lock, nanayaToggleEye, eijiOrdinalScale, flushOrtCounters, checkAllLocked,
});

const { CHAR_BY_ID } = require("../../characters");
const CHAR_HOOKS = require("../../characters/index");
const {
  tickPoison, tickShock, tickMend, tickBurn, tickBleed,
} = require("../../characters/_universal_status");
const YunaMod = require("../../characters/yuna");
const Journey = require("../../characters/_journey");
const Seraph = require("../../seraph");
const { io } = require("../app");
const { SHOP_INTERVAL_TURNS } = require("../constants");
const match = require("../match");
const { engine } = require("../engine");
const combat = require("../combat");
const cutscene = require("../cutscene");
const dayNight = require("../dayNight");
const cardDeck = require("../deck");
const lobby = require("../lobby");
const mercury = require("../modes/mercury");
const overload = require("../overload");
const qteSystem = require("../qte");
const shop = require("../shop");
const summary = require("./summary");
const timers = require("../timers");
const view = require("../view");

function dealRound() {
  timers.clearPhaseTimer();
  match.roundNumber++;
  match.overloadForceActive = false;
  match.centralDeck = cardDeck.buildCentralDeck(); // กองกลาง 43 ใบ สับใหม่ทุกรอบ
  match.lastLog = [];
  match.attackerId = null;
  match.roundWinnerId = null;
  match.roundTiedWin = false;
  match.doomTieAttack = false;
  match.cutsceneQueue = []; // ล้างคิวเก่าก่อนเสมอ — ต้องอยู่ก่อน rollWindow/CHAR_HOOKS ด้านล่างทั้งหมด ไม่งั้นคัตซีนที่เพิ่งคิวไว้จะโดนล้างทิ้งไปด้วย
  match.cutsceneInfo = null;
  match.lastAttack = null;
  match.roundSkills = [];
  match.anataMusicSeq = 0;
  // Mana Rupture ทำงานต้นเทิร์นถัดไป ก่อนแจกไพ่/เริ่มการกระทำ
  CHAR_HOOKS.mageslayer.resolveDueRuptures(engine);
  // SE.RA.PH: ตั้งว่าใครลงสนามเทิร์นนี้ (วันที่ 7 = เฉพาะคู่ที่ดวล คนอื่นเป็นผู้ชม)
  Seraph.onDealRound(engine);
  // ร้านค้ามายา (patch 2.2 full): เปิดทุกๆ 5 เทิร์น ตอนเริ่มเทิร์นใหม่
  //  SE.RA.PH: เติมสต็อกใหม่ทุกวัน เพราะ "ร้านสะดวกซื้อ" เป็น 1 ใน 5 สถานที่ที่เลือกได้ทุกวัน
  if (Seraph.active()) { if (Seraph.currentDay() === 1) shop.openShop(); } // เปิดครั้งเดียวต่อรอบ ใช้สต็อกเดิมทั้งรอบ
  else if (match.roundNumber % SHOP_INTERVAL_TURNS === 0) shop.openShop();
  else shop.refreshShopForJourney(); // การเดินทาง: ผลต่อร้านค้าตามช่วงเวลาของเทิร์นนี้ (ร้านค้างมาจากเทิร์นก่อน)
  // ยูนะ ไอดอลประจำสนาม: ม้วนลูกเต๋าทุกๆ 5 เทิร์น เริ่มจากเทิร์นที่ 16 (16, 21, 26, ...)
  //  เอจิ: ระหว่างท่าไม้ตาย ไม่ว่ายังก็ตาม บังคับเปิดสนามอยู่ ยูนะจะไม่เกิดขึ้นเองแบบปกติ
  //  SE.RA.PH: ยูนะปิดทั้งโหมด (SERAPH_MOONCELL.md §12)
  //  Type Mercury: ยูนะปิดทั้งโหมด (เหมือน SE.RA.PH)
  if (!Seraph.active() && !mercury.mercuryActive() && match.roundNumber >= 16 && (match.roundNumber - 16) % 5 === 0 && !timers.eijiUltFieldActive()) YunaMod.rollWindow(engine, match.roundNumber);
  const prevNight = dayNight.isNightRound(match.roundNumber - 1);
  // Type Mercury: คนที่เลือกตัวละครใหม่ไว้แล้วลงสนามตอนนี้ (ก่อนลูปแจกไพ่ใบแรก จึงได้ไพ่ทันทีในเทิร์นนี้)
  mercury.mercuryRespawnPicked();
  // ORT สกิลติดตัว 1: สกิลแรกของเทิร์นที่แล้ว "ข้อมูลสูญหาย" ในเทิร์นนี้ (อยู่หลังล้าง cutsceneQueue แล้ว)
  CHAR_HOOKS.ort.onRoundStart(engine);

  for (const p of Object.values(match.players)) {
    combat.resetRoundDisplay(p);
    // ธงบังคับไพ่แตกของมุยมิผูกกับเลขเทิร์นอยู่แล้ว แต่ล้างค่าค้างไว้ให้ state อ่านง่ายและกัน snapshot เก่า
    if (p.muimiForcedBustRound !== match.roundNumber) p.muimiForcedBustRound = 0;
    p.shield = 0;
    p.skillUsedRound = false; // เทิร์นใหม่ ใช้สกิลได้อีก 1 อัน
    // DoomGuy (patch 2.2 full): Quick Swap ใช้ได้อีก 1 ครั้งต่อเทิร์น
    if (p.characterId === "doomguy") p.doomQuickSwapUsed = false;
    if ((p.wouGuardCd || 0) > 0) p.wouGuardCd--; // ซาโตรุ (patch 2.0.8.3): คูลดาวน์ลบล้างลดลงทุกต้นเทิร์น (2 เทิร์นต่อการใช้)
    // Apple guy (characters/appleguy.js): บัฟพลังโจมตีแต่ละหน่วยนับถอยหลังแยกกัน — หมดอายุเองเมื่อครบ
    if (p.characterId === "appleguy") CHAR_HOOKS.appleguy.onRoundStartDecay(p);
    // เทเปา (patch 2.2 new): ทำอาหาร/ครุ่นคิด/ฉากหลังไม้ตาย นับถอยหลังที่ endTurn() แทน (ต้องอ่านค่าก่อนลดเพื่อรู้ "เทิร์นสุดท้าย" ให้ตรง)
    p.bardNotesUsed = 0;      // Bard: นับโน้ตใหม่ทุกเทิร์น (จำกัด 2 — มิติวิญญาณไม่จำกัด)
    p.kaiSkillUsesRound = 0;  // ไค: งบสกิล 2 ครั้ง (รังสรรค์/ลงทัณฑ์ ผสมกันได้อิสระ) เต็มใหม่ทุกเทิร์น
    p.takumiSkillUsesRound = 0; // ทาคุมิ: งบสกิลรวม 5 ครั้งต่อเทิร์น (พื้นฐาน/รอง/ท่าไม้ตาย ผสมกันได้อิสระ) เต็มใหม่ทุกเทิร์น
    CHAR_HOOKS.doomguy.onRoundStartFortuneRoll(engine, p); // DoomGuy: ทุกต้นเทิร์นมีโอกาส 20% ได้ [โชคลาภ] +1 สแตค
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
    // ชะงัก (The Beat of Victory โอกูริ patch 2.0.8.1): ติดจากการถูกโจมตีเทิร์นก่อน — เริ่มมีผลเทิร์นนี้
    if (p.staggerNext) {
      p.statuses.stagger = Math.max(p.statuses.stagger || 0, Number(p.staggerNext) || 1);
      p.staggerNext = 0;
    }
    // คอนเนอร์ RK800 (สกิลติดตัว 3 ปัญญาประดิษฐ์): ครบ 10 เทิร์นหลังตาย -> กลับเข้าสนามด้วยเลือด 3 เกราะ 2
    //  ต้องอยู่ "ก่อน" บล็อกข้ามผู้เล่นที่ตายแล้ว ไม่งั้นเทิร์นที่ฟื้นจะไม่ได้รับไพ่ใบแรก
    if (!p.alive) CHAR_HOOKS.conner.maybeRevive(engine, p);
    // ยุย: สมบัติล้ำค่าที่สุด..... — ครบกำหนดแล้วชุบชีวิตเป้าหมายที่จองไว้ (ตัวยุยเองต้องยังอยู่)
    if (p.characterId === "yui") CHAR_HOOKS.yui.maybeRevive(engine, p);
    if (!p.alive) { p.cards = []; p.locked = true; p.busted = false; p.overloadDrawReady = false; continue; }
    // SE.RA.PH วันที่ 7: คนที่ไม่ใช่คู่ที่กำลังลงสนาม = ผู้ชม ไม่ได้รับไพ่และไม่ถ่วงการเปิดไพ่
    if (Seraph.active() && !Seraph.inCurrentDuel(p)) { p.cards = []; p.locked = true; p.busted = false; p.overloadDrawReady = false; continue; }

    // กลางคืน (patch 2.1.7): สุ่มใหม่ทุกเทิร์นว่าสกิลพื้นฐานหรือสกิลรอง (อย่างใดอย่างหนึ่ง) จะใช้แต้มมากขึ้น — ไม่มีผลกับท่าไม้ตาย
    // SE.RA.PH: ปิดข้อเสียของกลางคืนทั้งโหมด (SERAPH_MOONCELL.md §12)
    //  ที่นี่คือ "ภาษี tier +1" ซึ่งทำให้สกิลที่ถูกสุ่มแพงขึ้น 1 แต้มในรอบกลางคืน
    //  ถ้าไม่ปิด รอบเลขคู่ (กลางคืนทั้งรอบ) จะมีคนกดสกิลไม่ออกทั้งที่แต้มถึงตามตาราง 2/4/6
    //  การเดินทาง: ภาษีนี้เหลือเฉพาะ "อาณาจักรแห่งจุดเริ่มต้น" กลางคืน (ภูมิภาคอื่นใช้ผลของภูมิภาคแทน)
    if (Journey.nightTaxOn(engine, dayNight.isNightRound(match.roundNumber)) && !Seraph.active()) {
      const ch0 = CHAR_BY_ID[p.characterId];
      const taxCandidates = [];
      if (ch0 && ch0.basic) taxCandidates.push("basic");
      if (ch0 && ch0.secondary) taxCandidates.push("secondary");
      p.nightTaxTier = taxCandidates.length ? taxCandidates[Math.floor(Math.random() * taxCandidates.length)] : null;
    } else {
      p.nightTaxTier = null;
    }
    p.phenexTauntGrace = false; // ไม่อยากให้ใครต้องเจ็บปวด (ริต้า เบอร์นัล): ผ่านเทิร์นที่หมดเวลาพอดีไปแล้ว ล้างค่านี้ทิ้ง

    // ---------- นานายะ ชิกิ (characters/nanaya.js) ----------
    p.nanayaToggleUsed = false; // Mystic eye of death perception: เปิด/ปิดได้อีก 1 ครั้งในเทิร์นใหม่นี้
    if (p.characterId === "nanaya") CHAR_HOOKS.nanaya.onRoundStartRest(engine, p);

    CHAR_HOOKS.daisuke.onRoundStartTick(engine, p); // ค่าแต้มสกิลของ Clock Up + การฟื้นฟูของ PUT ON
    CHAR_HOOKS.yaguruma.onRoundStartTick(engine, p);
    CHAR_HOOKS.kagami.onRoundStartTick(engine, p);
    CHAR_HOOKS.usagi.onRoundStartTick(engine, p);
    CHAR_HOOKS.oberon_summer.onRoundStartTick(engine, p);  // นกจาบยามเช้า: เป้าหมายเสียพลังชีวิต 2 ทะลุเกราะ
    CHAR_HOOKS.artoria_caster.onRoundStartTick(engine, p); // หัวใจที่บริสุทธิ์: เทิร์นที่ 3, 6, 9, … หลบหลีก + ฟื้นพลังชีวิต
    CHAR_HOOKS.tsurugi.onRoundStartTick(engine, p);

    // ---------- ซาโตรุ อาเคฟุ (patch 2.0.8.2): ดาเมจต่อเนื่องทุก 2 เทิร์น ----------
    //  สิ่งแปลกปลอม (Obla Di, Obla Da): ดาเมจ 1 / [Calamity]: ดาเมจตามเลเวล — ทำงานตอนเวลาคงเหลือเป็นเลขคี่
    {
      let dotDmg = 0;
      const dotFrom = [];
      if ((p.statuses.oblada || 0) > 0 && p.statuses.oblada % 2 === 1) { dotDmg += 1; dotFrom.push("สิ่งแปลกปลอม"); }
      if ((p.statuses.calamity || 0) > 0 && p.statuses.calamity % 2 === 1) {
        const lv = Math.max(1, (p.statusAmt && p.statusAmt.calamity) || 1);
        dotDmg += lv;
        dotFrom.push(`Calamity Lv${lv}`);
      }
      if (dotDmg > 0) {
        combat.dealMixed(p, dotDmg);
        combat.maybeBeatSave(p);
        combat.maybeBeatMode(p);
        p.wasAttacked = true;
        match.lastLog.push(`🌩️ ${p.name} ถูกหายนะกัดกิน (${dotFrom.join(" + ")}) — รับความเสียหาย -${dotDmg}`);
        if (p.alive && p.hp <= 0) {
          combat.instantDeath(p);
          if (!p.alive) match.lastLog.push(`💀 ${p.name} เลือดจริงหมด ตกรอบ!`);
          p.cards = [];
          p.locked = true;
          p.busted = false;
          continue;
        }
      }
    }

    // เครื่องดื่มชูกำลัง (Apple guy): เพิ่มแต้มสกิล 1 แต่เสียพลัง 1 หน่วยต่อเทิร์น
    //  ความเสียหายธรรมดา (โดนโล่/เกราะก่อน ไม่เจาะเกราะ) และไม่ถึงตาย — เลือดค้างที่ 1
    if ((p.statuses.energy || 0) > 0) {
      combat.addSkill(p, 1, "item");
      if (p.shield > 0 || p.armor > 0 || (p.tempHp || 0) > 0 || p.hp > 1) {
        combat.damageSoft(p);
        match.lastLog.push(`🥤 ${p.name} เครื่องดื่มชูกำลังออกฤทธิ์ — แต้มสกิล +1 เสียพลัง 1 หน่วย (เกราะก่อน)`);
      } else {
        match.lastLog.push(`🥤 ${p.name} เครื่องดื่มชูกำลังออกฤทธิ์ — แต้มสกิล +1 (พลังชีวิตเหลือ 1 จึงไม่ลด)`);
      }
    }

    // เกราะฟื้น 1 หน่วยทุก 2 เทิร์น (รอบเลขคู่) — เหมือนกันทั้งกลางวัน/กลางคืน (ยกเลิกโบนัสฟื้นทุกเทิร์นตอนกลางคืน patch 2.1.7)
    // Beat Mode: หลังกันตายทำงาน เกราะจะไม่ฟื้นคืน
    // หนูจะทำให้พี่ตาสว่างเอง (อาริมะ มิยาโกะ patch 2.2.0): เกราะไม่ฟื้นตามจำนวนเทิร์นที่เหลือ
    // [โหมงานหนัก] (โคโตเนะ patch 2.2.2): เปลี่ยนไปพังโล่แทนเกราะแล้ว — เกราะฟื้นได้ตามปกติ
    // ผุพัง (สถานะ Universal patch 2.2 beta — ไวท์เล็น "ฉันขอรับไปนะคะ"): เกราะไม่ฟื้นระหว่างมีผล
    //  แบทแมนร่างรถ: เกราะคือ "พลังชีวิตของรถ" ไม่ใช่เกราะจริง — ห้ามฟื้นเอง ไม่งั้นรถซ่อมตัวเองฟรีทุก 2 เทิร์น
    //  และจะไม่มีวันพังเลยถ้าโดนตีเบาๆ (สเปคระบุว่า "ขึ้นรถถาวรจนกว่ารถจะพัง" = ต้องพังได้จริง)
    //  การเดินทาง: ภูมิภาค 5-7 เกราะฟื้นทุกเทิร์น (Journey.armorRegenDue)
    const armorRegenDue = Journey.armorRegenDue(engine, match.roundNumber);
    if (!p.armorLocked && !((p.statuses.decay || 0) > 0) && !Seraph.noCombat() && armorRegenDue
        && !CHAR_HOOKS.bat_ben.blocksArmorRegen(p)
        && !CHAR_HOOKS.daisuke.blocksArmorRegen(p) // CAST OFF: ปลดเกราะทิ้งแล้ว เกราะจึงไม่ฟื้น
        && !CHAR_HOOKS.recruit.blocksArmorRegen(p)) { // Recruit: [Armor] ไม่ฟื้นเองอัตโนมัติ // CAST OFF: ปลดเกราะทิ้งแล้ว เกราะจึงไม่ฟื้น
      // เท็นโนจิ โคทาโร่ (rewrite): เลือดยังไม่เต็ม -> เกราะที่ควรฟื้นถูกเขียนทับเป็นเลือดแทน
      combat.healArmor(p, 1);
    }
    // คู่แฝดฮิซากาว่า: แฝดที่พักอยู่ฟื้นเกราะเองได้ตามจังหวะเดียวกัน แม้ไม่ได้ถูกควบคุมอยู่
    //  (เงื่อนไข "ผุพัง" คิดจากสถานะของแฝดคนนั้นเอง — ดู CHAR_HOOKS.hisakawa_sister.regenRestingArmor)
    if (!p.armorLocked && armorRegenDue) CHAR_HOOKS.hisakawa_sister.regenRestingArmor(engine, p);
    // การตื่นขึ้น (Lai Rhyme Goodfellow โอเบรอน): ฟื้นพลังชีวิตเทิร์นละ 1 หน่วย
    if ((p.statuses.awaken || 0) > 0 && combat.healHp(p, 1) > 0) {
      match.lastLog.push(`⏰ ${p.name} การตื่นขึ้น — ฟื้นพลังชีวิต +1`);
    }
    combat.firePassive(p, "roundStart");

    // ---------- โอกูริ แคป (Rework): Stamina ชาร์จ / ยุคทอง / Zone (GrayBeast) / หมดแรง (Burnout) / Sunny Day — เช็คตอนเริ่มเทิร์น ----------
    CHAR_HOOKS.oguri.onRoundStartTick(engine, p);
    combat.withEffectSource(p, () => CHAR_HOOKS.escanor.onRoundStartTick(engine, p, prevNight));
    CHAR_HOOKS.hisakawa_sister.onRoundStartTick(engine, p);

    // ---------- ลุกไหม้ (hburn, สถานะ Universal): ดาเมจ 1/เทิร์น สะสมสูงสุด 6 — ย้าย body ไป characters/_universal_status.js แล้ว ----------
    tickBurn(engine, p);
    // ---------- เลือดไหล (hbleed, สถานะ Universal patch 2.5): ดาเมจ 1/เทิร์น สะสมสูงสุด 6 (ฮารุกะฟื้นเลือดแทน) ----------
    tickBleed(engine, p);
    tickPoison(engine, p); // พิษร้าย (โซ ยากุรุมะ): ดาเมจต้นเทิร์น — ส่วนพลังโจมตีหักที่ computeAttackBase
    // "ช็อต" (// คากามิ อาราตะ): โรล 15% ติดสตั้น — ต้องอยู่ก่อนบล็อกเช็คสตั้นด้านล่าง ไม่งั้นสตั้นจะเลื่อนไปมีผลเทิร์นถัดไป
    tickShock(engine, p);
    // ---------- [โดนดูด] (doomDrain, Plasma Rifle — DoomGuy): ดาเมจ 1/เทิร์น 3 เทิร์น เจาะเกราะก่อน ----------
    CHAR_HOOKS.doomguy.tickDrain(engine, p);
    p.cards = [];
    // New Omega (ฮารุกะ): ธงบังคับไพ่แตกมีผลแค่เทิร์นที่กด — กดใหม่ถึงจะระเบิดอีกครั้ง
    //  ต้องล้าง "ก่อน" แจกไพ่ใบแรกด้านล่าง ไม่งั้น onCardDrawn/bustedOf ระหว่างแจกจะยังอ่านธงของเทิร์นที่แล้ว
    CHAR_HOOKS.haruka.clearBurst(p);
    p.cardBonus = 0; // แต้มการ์ดโบนัส (Ashen Trail โอกูริ patch 2.1.1) — รีเซ็ตทุกเทิร์น
    p.colorTrigger = { red: 0, blue: 0, green: 0, yellow: 0 }; // นับจำนวนครั้งที่ทริกเกอร์สีนั้นทำงานไปแล้วในรอบนี้
    p.statusAmt.cardAtkBonus = 0; // พลังโจมตีจากการ์ดแดง — รีเซ็ตทุกรอบ
    combat.resetOverloadDrawCounter(p, false); // ไพ่ตั้งต้นไม่นับเป็นไพ่จั่วเพิ่มของ Overload Force
    { const c = cardDeck.drawInitialCard(p); if (c) { p.cards.push(c); cardDeck.onCardDrawn(p, c); } }
    p.overloadDrawReady = match.overloadForceActive;
    p.locked = false;
    p.busted = false;
    p.result = null;

    // [Calamity] (ซาโตรุ patch 2.0.8.2): ถูกบังคับจั่วไพ่เพิ่มตามเลเวล ตอนเริ่มเทิร์นถัดจากที่โดน
    if ((p.calamityDraw || 0) > 0) {
      const n = p.calamityDraw;
      p.calamityDraw = 0;
      for (let i = 0; i < n; i++) { const c = cardDeck.drawCardFor(p); if (c) { p.cards.push(c); cardDeck.onCardDrawn(p, c); } }
      p.busted = cardDeck.bustedOf(p);
      match.lastLog.push(`🌩️ [Calamity] บังคับ ${p.name} จั่วไพ่เพิ่ม ${n} ใบ${p.busted ? " — ไพ่แตกตั้งแต่ต้นเทิร์น!" : ""}`);
      if (p.busted) combat.voidUltimateOnBust(p);
    }

    // หลับไหล (Lie Like Vortigern โอเบรอน): ออกการกระทำใดๆ ไม่ได้ทั้งเทิร์น
    // และเสียพลังชีวิตแบบไม่สนเกราะเทิร์นละ 1 หน่วย — หักได้เรื่อยๆ แต่ห้ามตาย (ค้างที่ 1 หน่วย)
    if ((p.statuses.sleep || 0) > 0) {
      p.locked = true;
      if (p.hp > 1) { p.hp--; p.dmgHp++; combat.hisakawaSyncOut(p); }
      match.lastLog.push(`💤 ${p.name} หลับไหลจากคำลวงของราชาภูติ — ขยับไม่ได้ (เหลืออีก ${p.statuses.sleep} เทิร์น)`);
    }

    // ---------- แบทแมน (characters/bat_ben.js): เหรียญกลางคืน / ฟื้นเลือดจากเร้นเงา / ฟื้นเลือดจากเข้ามาเลย ----------
    CHAR_HOOKS.bat_ben.onRoundStartTick(engine, p);
    // ---------- เจ้าหญิงราก (characters/princess_shiki.js): แต้มสกิลฟื้นเองทุกเทิร์น ----------
    CHAR_HOOKS.princess_shiki.onRoundStartTick(engine, p);
    // ---------- ฟุจิตะ โคโตเนะ (characters/kotone.js): Sleeping time (ฮีล/แต้มสกิลต่อเทิร์น) + สตั้นจากท่านประธานเซนะจัง ----------
    CHAR_HOOKS.kotone.onRoundStartTick(engine, p);
    // ---------- เอจิ (characters/eiji.js): รีเซ็ตโควตาหลบหลีก/Ordinal Scale + ฟื้นเลือดจากความเร็วสูง ----------
    if (p.characterId === "eiji") CHAR_HOOKS.eiji.onRoundStartTick(engine, p);
    // ---------- มิซึซาว่า ฮารุกะ (characters/haruka.js): รีเซ็ตโควตาสกิลพื้นฐาน 2 ครั้ง + โควตาเลือดไหลของสกิลติดตัว ----------
    if (p.characterId === "haruka") CHAR_HOOKS.haruka.onRoundStartTick(engine, p);
    // ---------- ยุย โยชิโอกะ (characters/yui.js): ล็อกมือระหว่างบรรเลงเพลงชุบชีวิต ----------
    if (p.characterId === "yui") CHAR_HOOKS.yui.onRoundStartTick(engine, p);
    // ---------- อิสึกะ ชิโด (characters/shido.js): ภูติ — ฟื้นพลังชีวิตต่อเทิร์น ----------
    if (p.characterId === "shido") CHAR_HOOKS.shido.onRoundStartTick(engine, p);
    // ---------- โมโรโบชิ ดัน (characters/dan.js): ไม้ค้ำพยุงร่าง — ฟื้นพลังชีวิตต่อเทิร์น ----------
    if (p.characterId === "dan") CHAR_HOOKS.dan.onRoundStartTick(engine, p);
    // ---------- คอนเนอร์ RK800 (characters/conner.js): รีเซ็ตโควตา "จั่วไพ่ = เครียด +1 ต่อเทิร์น" + ธงวิเคราะห์สถานการณ์ ----------
    CHAR_HOOKS.conner.onRoundStartTick(engine, p);
    // อิปโป (characters/ippo.js): Uper Cut ตั้งสตั้นไว้เมื่อเทิร์นก่อน -> เริ่มมีผลตอนนี้
    //  ต้องอยู่ "ก่อน" บล็อกเช็คสตั้นด้านล่าง ไม่งั้นสตั้นจะเลื่อนไปมีผลอีกเทิร์นหนึ่ง
    CHAR_HOOKS.ippo.applyPendingStun(engine, p);
    // Bamboo-Hatted Kim: เหน็บชาที่จองไว้เมื่อเทิร์นก่อนเริ่มมีผล (ทุกคน) · ของ Kim เอง: To Claim Their Bones /
    //  Poise ลดทุก 5 เทิร์น / โยนเหรียญ — อยู่หลังเลือดไหล/ฟื้นเกราะ เพราะเหรียญอ่านพลังชีวิตของต้นเทิร์นนี้
    CHAR_HOOKS.kim.onRoundStartTick(engine, p);
    CHAR_HOOKS.tohno.onRoundStartTick(engine, p); // รอยร้าวจางลงทุก 10 เทิร์น · ล้างชุดโจมตีที่ค้างของโทโนะ
    CHAR_HOOKS.recruit.onRoundStartTick(engine, p); // Recruit: ล้างธงยิง/HeadShot/โจมตีอีกครั้งที่ค้างจากเทิร์นก่อน
    // สไตรเกอร์ ยูเรก้า: สตั้นจากหมัดเหล็กซ้ำ (ทุกคน · ก่อนบล็อกเช็คสตั้น) · Mark 5 แต้มสกิล · นับถอยหลังระเบิด · เตาปฏิกรณ์
    CHAR_HOOKS.striker.onRoundStartTick(engine, p);
    // ไดจิ เกราะเอเลคิง: สตั้นที่ติดไว้เมื่อเทิร์นก่อน -> เริ่มมีผลตอนนี้ (ก่อนบล็อกเช็คสตั้นด้านล่างด้วยเหตุผลเดียวกัน)
    CHAR_HOOKS.daichi.applyPendingStun(engine, p);
    // ---------- ผู้วิงวอน (characters/the_supplicant.js): รีเซ็ตโควตาสกิล 2 ครั้ง + ต่ออายุ "กระแสเวท" ถาวร ----------
    CHAR_HOOKS.the_supplicant.onRoundStartTick(engine, p);
    // ---------- ไบรอัน (characters/brian.js): รถกินน้ำมัน (แปลงเป็นเลือด) หรือเติมน้ำมันประจำเทิร์น ----------
    CHAR_HOOKS.brian.onRoundStartTick(engine, p);
    // ---------- โปรดิวเซอร์: ผลติดตัวรายไอดอล + ฝึกซ้อม + ดาเมจที่หน่วงไว้จากเทิร์นก่อน ----------
    CHAR_HOOKS.producer_lumi.onRoundStartTick(engine, p);
    // ---------- คาเยนน์ ทหารผ่านศึก: ความเสียหายที่เลื่อนไว้เมื่อเทิร์นก่อนลงผลตอนนี้ ----------
    CHAR_HOOKS.cayenne.onRoundStartTick(engine, p);
    // ---------- ไดจิ โอโซระ: โควตาการ์ดไซเบอร์ · การ์ดที่ตัดไว้บวกเข้ามือ · เกราะเบมสตาร์ฟื้นเลือด ----------
    CHAR_HOOKS.daichi.onRoundStartTick(engine, p);
    // ---------- "เยียวยา" (สถานะ Universal patch 3.4): ฟื้นพลังชีวิตต่อเทิร์นตามจำนวนหน่วย ----------
    //  วางไว้ที่นี่ (ต้นเทิร์น) เหมือนลุกไหม้/เลือดไหล การลดเทิร์นทำที่ลูปกลางของ endTurn ตามปกติ
    tickMend(engine, p);
    // อมาซอน (ฮารุกะ สกิลติดตัว): โดนสวนกลับเมื่อเทิร์นก่อน -> สตั้นเริ่มมีผลตอนนี้
    //  ต้องอยู่ "ก่อน" บล็อกเช็คสตั้นด้านล่างเหมือน Gargorgon Ray ไม่งั้นสตั้นจะเลื่อนไปอีกเทิร์นหนึ่ง
    if (p.harukaStunPending > 0) {
      const turns = p.harukaStunPending;
      p.harukaStunPending = 0;
      if (combat.applyDebuff(p, "stun", null, turns)) match.lastLog.push(`🌑 ${p.name} โดนอมาซอนสวนกลับเมื่อเทิร์นก่อน — ติดสถานะสตั้น ${turns} เทิร์น!`);
    }
    // Gargorgon Ray (ปืนหน่วย GUTS Select): ผลหน่วง 1 เทิร์น — เช็คต้านสถานะตอนนี้ (เป้าหมายซื้อยาต้านมากันไว้ทัน)
    //  ต้องอยู่ "ก่อน" บล็อกเช็คสตั้นด้านล่าง ไม่งั้นสตั้นจะข้ามไปมีผลอีกเทิร์นหนึ่ง
    if (p.gutsGargorgonPending) {
      p.gutsGargorgonPending = false;
      if (combat.applyDebuff(p, "stun", null, 1)) match.lastLog.push(`🌑 ${p.name} โดน Gargorgon Ray เมื่อเทิร์นก่อน — ติดสถานะสตั้น 1 เทิร์น!`);
      else match.lastLog.push(`🛡️ ${p.name} ต้านผลของ Gargorgon Ray ไว้ได้ — ไม่ติดสตั้น`);
    }
    // สตั้น (สถานะพื้นฐาน patch 2.0.8): ทำอะไรไม่ได้จนจบเทิร์นหรือจนกว่าดีบัฟจะหมดเวลา
    if ((p.statuses.stun || 0) > 0) {
      p.locked = true;
      match.lastLog.push(`😵 ${p.name} ติดสถานะสตั้น — ขยับไม่ได้ทั้งเทิร์น! (เหลืออีก ${p.statuses.stun} เทิร์น)`);
    }

    // Bard (characters/bard.js): ถูกขัดจังหวะการประพันธ์ (หลับ/สตั้น/ใบ้สกิล ฯลฯ) -> โน้ตทั้งหมดถูกรีเซ็ต
    CHAR_HOOKS.bard.onRoundStartInterruptCheck(engine, p);
  }

  // ---------- เอสคานอร์ (characters/escanor.js): ลุกไหม้ที่ Last Stand แจกตอนต้นเทิร์น ----------
  //  ต้องแปะ "หลัง" ลูปต้นเทิร์นจบทั้งวง เพราะ tickBurn ของแต่ละคนอยู่ในลูปด้านบน — ถ้าแปะในลูป
  //  คนที่ยังวนไม่ถึงจะถูกกินหน่วยที่เพิ่งได้ทิ้งในเทิร์นเดียวกัน (ผลไม่เท่ากันตามลำดับที่นั่ง)
  CHAR_HOOKS.escanor.flushPendingBurn(engine);
  // ORT: ไม่ต้องกดเปิดไพ่ — จั่วเองผ่าน characters/ort.js (checkAllLocked ไม่รอ ORT อยู่แล้ว)
  if (mercury.ortBoss()) mercury.ortBoss().locked = true;

  // ---------- คอนเนอร์ RK800 (characters/conner.js): การไล่ล่ายังดำเนินอยู่ -> แช่ผู้เล่นนอกวงใหม่ทุกเทิร์น ----------
  //  ต้องอยู่หลังลูปต้นเทิร์น เพราะในลูปเพิ่งตั้ง p.locked = false และแจกไพ่ใบแรกให้ทุกคนไปแล้ว
  CHAR_HOOKS.producer_lumi.onRoundStartAfterLoop(engine); // โปรดิวเซอร์: รีเซ็ตโควตาหมัดที่ 2 ของ All star 765
  CHAR_HOOKS.conner.onRoundStartAfterLoop(engine);
  // ---------- ยุย (characters/yui.js): girl don't cry — คนแต้มสกิลน้อยสุดในวงได้ +1 ----------
  //  ต้องอยู่หลังลูปต้นเทิร์น ไม่งั้นการเทียบ "ใครแต้มน้อยสุด" จะใช้ค่าคนละเทิร์นกันตามลำดับที่นั่ง
  CHAR_HOOKS.yui.onRoundStartAfterLoop(engine);
  // อุซากิ (ท่าไม้ตาย): แจกโจทย์คณิตให้ฝ่ายตรงข้าม — หลังลูปต้นเทิร์น (ทุกคนได้ไพ่ใบแรกแล้ว)
  CHAR_HOOKS.usagi.onRoundStartAfterLoop(engine);
  // มุยมิ: ครบแพ้ต่อเนื่อง 3 ครั้งแล้วสุ่มหัวใจนักสู้ที่ต้นเทิร์นถัดไป หลังแจกไพ่ครบทั้งสนาม
  CHAR_HOOKS.muimi.onRoundStartAfterLoop(engine);

  // ความตายที่โรยรา (ชิกิ patch 2.0.8, characters/shiki.js): ทุกเทิร์นที่ท่าไม้ตายยังทำงาน มอบเส้นชีวิต +1 ให้ทุกคนยกเว้นตัวเอง
  CHAR_HOOKS.shiki.onRoundStartWitherTick(engine);

  // สลับช่วงเวลากลางวัน/กลางคืน — แบนเนอร์บอกทั้งสนามเมื่อช่วงเวลาเปลี่ยน
  const night = dayNight.isNightRound(match.roundNumber);
  if (match.roundNumber > 1 && night !== prevNight) {
    match.lastLog.push(night ? "🌙 ราตรีมาเยือน — สุ่มสกิลพื้นฐาน/สกิลรองแพงขึ้น +1 ทุกเทิร์น" : "☀️ ฟ้าสางแล้ว — จบเทิร์นได้แต้มสกิลเพิ่ม +1");
  }

  overload.captureTurnSnapshot(); // จุดย้อนเวลาของเทิร์นนี้ (เอฟเฟกต์ต้นเทิร์นทำงานครบแล้ว ยังไม่มีใครกดอะไร)
  overload.pushSnapshotHistory();  // เก็บใบเดียวกันเข้าประวัติย้อนหลัง 6 เทิร์น (ท่าไม้ตายของชิโดย้อนกลับไปหยิบ)
  match.gameState = "PLAYING";
  timers.startPhaseTimer(timers.cardPhaseSeconds(), summary.resolveRound);
  // สไตรเกอร์ ยูเรก้า: ครบกำหนด "เป็นเกียรติมากครับ" — วีดีโอระเบิด (คิวไว้ต้นเทิร์น) เล่นก่อน แล้วค่อยลงความเสียหาย
  if (match.cutsceneQueue.length) { cutscene.pausePlayingForCutscene(() => CHAR_HOOKS.striker.flushDetonation(engine)); return; }
  CHAR_HOOKS.striker.flushDetonation(engine); // ตาข่าย: ไม่ได้เข้าเส้นทางคัตซีน -> ระเบิดทันที
  view.broadcastState();
  checkAllLocked();
}

function hit(id) {
  const p = match.players[id];
  if (match.gameState !== "PLAYING" || !p || !p.alive || p.locked) return;
  if (match.centralDeck.length === 0) return; // กองร่วมหมดแล้ว ทุกคนจั่วเพิ่มไม่ได้
  if ((p.statuses.nodraw || 0) > 0) return; // อิ่มทงคัสสึเกิน: เทิร์นนี้จั่วเพิ่มไม่ได้
  if ((p.statuses.phenexTaunt || 0) > 0) return; // ไม่อยากให้ใครต้องเจ็บปวด (ริต้า เบอร์นัล): ระหว่างล่อเป้าจั่วการ์ดเพิ่มไม่ได้
  if ((p.tepeuPonderTurns || 0) > 0) return; // ครุ่นคิด (เทเปา): จั่วไพ่ไม่ได้ระหว่างนี้ (ยังโจมตีได้ถ้าชนะ)
  if (CHAR_HOOKS.kim.blocksDraw(engine, p)) return; // Bamboo-Hatted Kim: กดท่าไม้ตาย 1 ตอนออก "หัว" = จั่วต่อไม่ได้จนเปิดไพ่
  if (CHAR_HOOKS.conner.actionBlocked(engine, p)) return; // คอนเนอร์: อยู่นอกวงไล่ล่า -> ถูกแช่ ทำอะไรไม่ได้
  // ไบรอัน: ระหว่างการแข่ง เฉพาะ "คนนอกวง" ที่จั่วไม่ได้ — ไบรอันกับคู่แข่งต้องจั่วได้ตามปกติ
  //  เพราะทั้งท่าคือการดวลแต้มกันตัวต่อตัว (สเปคล็อกแค่สกิล/ไอเทมของคู่แข่งทั้งสอง ไม่ได้ล็อกการจั่ว)
  if (CHAR_HOOKS.brian.actionBlocked(engine, p)) return;
  if (CHAR_HOOKS.daisuke.actionBlocked(engine, p)) return; // Clock Up: คนอื่นจั่วไม่ได้
  if (cardDeck.scoreOf(p) >= cardDeck.scoreCap(p)) return; // แต้มเต็มเพดาน (เช่น 21 พอดี) = จั่วไม่ได้ รอผู้ใช้ใช้สกิล/เปิดไพ่เอง
  // โชคลาภ (patch 2.2 new): จั่วปุ๊ป ถ้ามีบัฟสะสมอยู่ ใช้ 1 หน่วยทันทีแล้วหน่วยนั้นหายไป
  //  ปรับไพ่ที่จั่วให้แต้มรวมตกอยู่ 19-21 (สุ่มถ่วงน้ำหนัก มีเคสพิเศษถ้าแต้มปัจจุบันเป็น 19/20 อยู่แล้ว)
  //  ถ้าเป้าที่สุ่มได้ไม่มีไพ่ให้จั่วพอดี จะลองเป้าที่เหลือก่อน — ไม่มีไพ่ให้ตรงเป้าไหนเลยจริงๆ ค่อยจั่วแบบสุ่มตามปกติ (แตกได้ตามปกติ)
  let drawn = null;
  if (!match.overloadForceActive && (p.statuses.fortune || 0) > 0) {
    p.statuses.fortune--;
    p.fortuneIdle = 0;
    if (p.statuses.fortune <= 0) delete p.statuses.fortune;
    const cur = cardDeck.calculateScore(p.cards);
    let picked = null;
    for (const target of cardDeck.fortuneTargetList(cur)) {
      const need = target - cur;
      if (need < 1 || need > 10) continue;
      const c = cardDeck.drawFromCentralDeck((card) => !card.special && card.value === need);
      if (c) { picked = { target, card: c }; break; }
    }
    if (picked) {
      drawn = picked.card;
      p.cards.push(drawn);
      match.lastLog.push(`🍀 ${p.name} โชคลาภทำงาน — ได้ไพ่ที่ทำให้แต้มรวมเป็น ${picked.target}!`);
    } else {
      drawn = cardDeck.drawCardFor(p);
      if (drawn) p.cards.push(drawn);
      match.lastLog.push(`🍀 ${p.name} โชคลาภทำงาน แต่ไม่มีไพ่ที่ทำให้ถึงเป้าไหนได้เลย — จั่วแบบสุ่มตามปกติ`);
    }
  } else {
    drawn = cardDeck.drawCardFor(p);
    if (drawn) p.cards.push(drawn);
  }
  let drewCount = drawn ? 1 : 0; // แอนเดอร์เซน (สุดยอดนักเขียน): นับเฉพาะไพ่ที่ผู้เล่นกดจั่วเอง
  if (drawn) {
    cardDeck.onCardDrawn(p, drawn); CHAR_HOOKS.escanor.onCardDraw(engine, p); CHAR_HOOKS.eiji.onCardDraw(engine, p);
  }
  // สภาพชา (ดีบัฟ Universal — Thunder Bullet): กดจั่ว 1 ครั้ง ได้ไพ่ 2 ใบ
  //  ใบที่ 2 จั่วแบบสุ่มปกติเสมอ (โชคลาภช่วยแค่ใบแรก) และไม่เช็คเพดานแต้มซ้ำ — แตกได้ตามสภาพ
  //  ผู้วิงวอน "ลงทัณฑ์" พ่วง "ชา" มาด้วย — เป็นผลพ่วงที่เช็คสด ไม่ใช่สถานะจริง (ล้างไม่ได้ตามสเปค)
  if ((p.statuses.chaa || 0) > 0 || CHAR_HOOKS.the_supplicant.chaaActive(p)) {
    const extra = cardDeck.drawCardFor(p);
    if (extra) {
      p.cards.push(extra);
      cardDeck.onCardDrawn(p, extra);
      drewCount++;
      match.lastLog.push(`🌀 ${p.name} อยู่ในสภาพชา — จั่วติดมาอีกใบ (${shop.cardLabel(extra)})`);
    }
  }
  CHAR_HOOKS.andersen.onPlayerDraw(engine, p, drewCount);
  // คอนเนอร์ RK800 (สกิลติดตัว 1 สืบสวน): การจั่วไพ่ทำให้เครียด +1 — นับครั้งเดียวต่อเทิร์นไม่ว่าจะจั่วกี่ใบ
  //  นับเฉพาะตอนได้ไพ่จริง (กองหมดกลางคัน = ไม่นับ)
  // โปรดิวเซอร์ (โคฮารุ): ไพ่ใบแรกของเทิร์นถูกพลิกเครื่องหมายเป็นลบ — ต้องทำ "ก่อน" onCardDrawn
  //  ไม่งั้นทริกเกอร์สี/การ์ดพิเศษจะคิดจากค่าเดิมที่ยังไม่พลิก
  if (drawn) CHAR_HOOKS.producer_lumi.onCardDraw(engine, p, drawn);
  if (drawn) CHAR_HOOKS.conner.onCardDraw(engine, p);
  // ยุย (characters/yui.js): my soul your beats — ใครจั่ว คนอื่นในวงจั่วตามด้วย (กันลูปในฮุคเอง)
  if (drawn) CHAR_HOOKS.yui.onCardDraw(engine, p);
  // ไดจิ โอโซระ: การ์ดทำให้แต้มเกิน -> มาUNITEกัน ตัดใบนั้นเก็บไว้ (ก่อน) / ข้อมูลจำลอง ล้างมือจั่วใหม่ (หลัง)
  CHAR_HOOKS.daichi.onDrawCheck(engine, p);
  p.busted = cardDeck.bustedOf(p);
  if (p.busted) { combat.voidUltimateOnBust(p); CHAR_HOOKS.mageslayer.onBustOrLoseRoll(engine, p); }
  // ORT: ผู้เล่นจริงจั่ว 1 ครั้ง -> บอสจั่วตามได้ 1 ใบ (ถ้ายังไม่ถึงเป้าแต้ม)
  if (drawn) CHAR_HOOKS.ort.onHumanDraw(engine, p);
  if (mercury.checkOrtEarlyWin()) return;
  // ไพ่แตก: ไม่ล็อกอัตโนมัติ — ยังกดสกิล/ใช้ไอเทมได้ต่อไป จนกว่าจะกดเปิดไพ่เอง หรือทุกคนเปิดไพ่ครบ
  view.broadcastState();
  checkAllLocked();
}
function lock(id) {
  const p = match.players[id];
  if (match.gameState !== "PLAYING" || !p || !p.alive || p.locked) return;
  if (CHAR_HOOKS.daisuke.actionBlocked(engine, p)) return; // Clock Up: คนอื่นกดเปิดไพ่ไม่ได้
  cardDeck.applyLockColorTriggers(p);
  p.locked = true;
  // คาซามะ ไดสุเกะ (Clock Up): เจ้าของท่ากดเปิดไพ่ = เวลากลับมาเดิน เหลือให้คนอื่นแค่ 10 วิ
  //  ต้องตั้งตัวจับเวลาใหม่ก่อน checkAllLocked() เผื่อกรณีคนอื่นล็อกครบพอดีแล้วเปิดไพ่ทันที
  if (CHAR_HOOKS.daisuke.onHostLockIn(engine, p)) timers.startPhaseTimer(timers.takeClockUpResume(), summary.resolveRound);
  view.broadcastState();
  checkAllLocked();
}
// นานายะ ชิกิ: เปิด/ปิด Mystic eye of death perception (characters/nanaya.js)
function nanayaToggleEye(id) {
  const p = match.players[id];
  if (match.gameState !== "PLAYING" || !p || !p.alive || p.locked) return;
  if (CHAR_HOOKS.daisuke.actionBlocked(engine, p)) return; // Clock Up: ปุ่มเฉพาะตัวก็กดไม่ได้ — เวลาหยุดหมายถึงทุกอย่าง
  if (p.characterId !== "nanaya") return;
  if (!CHAR_HOOKS.nanaya.toggleEye(engine, p)) return;
  io.emit("skillFlash", {
    name: `Mystic eye of death perception — ${p.nanayaEyeOn ? "เปิดใช้งาน" : "ปิดใช้งาน"}`,
    img: "/characters/nanaya/nanaya.png", by: p.name, color: lobby.colorOf(p),
  });
  view.broadcastState();
}
// เอจิ สกิลติดตัว 3 (characters/eiji.js): ปุ่ม กลโกง Ordinal Scale — สละแต้มสกิล 1 แลกอัตราหลบ +10%
//  ไม่นับเป็นการใช้สกิลของเทิร์น จึงกดพร้อมสกิลอื่นได้ และกดซ้ำได้จนครบ 5 ครั้งต่อเทิร์น
function eijiOrdinalScale(id) {
  const p = match.players[id];
  if (match.gameState !== "PLAYING" || !p || !p.alive || p.locked) return;
  if (CHAR_HOOKS.daisuke.actionBlocked(engine, p)) return; // Clock Up: ปุ่มเฉพาะตัวก็กดไม่ได้ — เวลาหยุดหมายถึงทุกอย่าง
  if (p.characterId !== "eiji") return;
  if (!CHAR_HOOKS.eiji.pressOrdinal(engine, p)) return;
  io.emit("skillFlash", {
    name: `กลโกง Ordinal Scale — เร่งความเร็ว ${CHAR_HOOKS.eiji.ordinalStacks(p)}/${CHAR_HOOKS.eiji.ORDINAL_MAX} (หลบหลีก ${CHAR_HOOKS.eiji.dodgeChance(p)}%)`,
    img: CHAR_HOOKS.eiji.IMG.passive3,
    by: p.name, color: lobby.colorOf(p),
  });
  view.broadcastState();
}
// ORT สกิลติดตัว 2: สวนกลับทุกคนที่จองไว้ระหว่างการกระทำที่เพิ่งจบ (สกิล/ปืน/เอฟเฟกต์หลังเปิดไพ่)
function flushOrtCounters() {
  const ort = CHAR_HOOKS.ort.flushCounters(engine);
  // Bamboo-Hatted Kim: สวนกลับ "ดาเมจจากสกิล" ที่จองไว้ ลงจังหวะเดียวกับสวนกลับของ ORT (หลังสกิล/ไอเทม/คลิปจบ)
  const kim = CHAR_HOOKS.kim.flushCounters(engine);
  if (ort || kim) view.broadcastState();
}
function checkAllLocked() {
  if (match.gameState !== "PLAYING") return;
  const c = combat.alivePlayers();
  // รอคำตอบข้อเสนอ (ซาโตรุ) / เป้าหมายบทเพลง (Bard) ก่อนเปิดไพ่อัตโนมัติ
  //  — หมดเวลาเฟสไพ่ = ถือว่าปฏิเสธ / สุ่มเป้าหมาย
  const pendingAnswer =
    c.some((p) => !mercury.isOrt(p) && p.locaOffer && match.players[p.locaOffer] && match.players[p.locaOffer].alive) || // Locacaca (ซาโตรุ) — ORT ไม่ตอบ ไม่ต้องรอ
    c.some((p) => p.bardPending) ||
    // คอนเนอร์ RK800: คำขาด "ยอมจำนน / ขัดขืน" ที่ยังไม่ตอบ (ไม่ตอบก่อนเปิดไพ่ = ขัดขืน)
    c.some((p) => !mercury.isOrt(p) && p.connorArrestAsk && match.players[p.connorArrestAsk.fromId] && match.players[p.connorArrestAsk.fromId].alive) ||
    // QTE ที่ยังเล่นไม่จบ (ยุย: ทำนองเพลงร็อก) — คนอื่นจั่ว/เปิดไพ่ได้ตามปกติ แค่ยังไม่สรุปรอบให้
    qteSystem.qtePending() ||
    // อุซากิ: ยังทำโจทย์คณิตไม่เสร็จ / ยังไม่ตอบ "เอา/ไม่เอา" ไพ่ของเป้าหมาย
    CHAR_HOOKS.usagi.quizPending(engine) || c.some((p) => p.usagiSwapOffer) ||
    // Recruit: QTE ของสกิลยังเล่นไม่จบ / ยังไม่เลือกเป้า (Desert Eagle นัดที่ 2 · FAMAS)
    CHAR_HOOKS.recruit.pickPending(engine) ||
    // สไตรเกอร์ ยูเรก้า: รอคู่หูอนุมัติท่าไม้ตาย 2 / กำลังต่อสายไฟ
    CHAR_HOOKS.striker.approvalPending(engine);
  // ถ้าไม่เหลือใครรอดเลย (เช่น ทาคุโตะระเบิดใส่ทุกคนตายหมดรวมถึงตัวเอง) ก็ต้องสรุปผลด้วยเช่นกัน ไม่งั้นเกมค้าง
  // ORT ไม่ต้องกดเปิดไพ่ — รอเฉพาะผู้เล่นจริง (บอสจั่วรอบสุดท้ายใน resolveRound)
  if (c.filter((p) => !mercury.isOrt(p)).every((p) => p.locked) && !pendingAnswer) summary.resolveRound();
}
