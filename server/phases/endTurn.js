// ปิดรอบ: ลดเทิร์นสถานะ, เหรียญ, ไปรอบถัดไป
// export ก่อน require: ไฟล์ใน server/ require วนกันเอง — function declaration ถูก hoist จึงพร้อมใช้ตั้งแต่บรรทัดแรก
Object.assign(module.exports, {
  endTurn,
});

const CHAR_HOOKS = require("../../characters/index");
const { tickEvadeStacks } = require("../../characters/_universal_status");
const YunaMod = require("../../characters/yuna");
const Journey = require("../../characters/_journey");
const Seraph = require("../../seraph");
const { GOLD_PER_TURN, TAKUTO_STAR_NEED, TRANSITION_TIME } = require("../constants");
const match = require("../match");
const { engine } = require("../engine");
const characterRules = require("../characterRules");
const combat = require("../combat");
const cutscene = require("../cutscene");
const dayNight = require("../dayNight");
const draw = require("./draw");
const mercury = require("../modes/mercury");
const seraphMode = require("../modes/seraph");
const shop = require("../shop");
const timers = require("../timers");
const view = require("../view");

function endTurn() {
  draw.flushOrtCounters();
  // Bamboo-Hatted Kim: หมัดที่ถูกหลบ (ทุกเส้นทางหลบจบที่นี่) -> ฝักดาบ +10
  CHAR_HOOKS.kim.flushMiss(engine);
  // คาเยนน์ "แน่จริงก็หลบสิ": ชุดกระสุนยังยิงไม่ครบ -> เปิดเฟสโจมตีครั้งถัดไปแทนการจบเทิร์น
  //  วางไว้บนสุดเพราะทุกทางจบหมัด (โดน/ถูกหลบ/ถูกสะท้อน/ถูกลบล้าง) ไหลมาจบที่ endTurn เหมือนกันหมด
  if (CHAR_HOOKS.cayenne.continueBarrage(engine)) return;
  // โทโนะ ชิกิ: เชือดเฉือนยังตีไม่ครบ 4 ครั้ง / ตระกูลโทโนะได้ตีอีกครั้ง (ถูกหลบก็ตีต่อได้ — เหตุผลเดียวกับคาเยนน์)
  if (CHAR_HOOKS.tohno.continueAttack(engine)) return;
  // คามิชิโร่ ซึรุงิ "Rider Slash": ฟันไปแค่จังหวะเดียว -> เปิดเฟสโจมตีอีกครั้งแทนการจบเทิร์น
  //  อยู่ตรงนี้เพราะหมัดที่ "ถูกหลบ" return ตั้งแต่ด่านหลบ ไม่ผ่าน postAttackFollowup — สเปคบอกว่าถูกหลบก็ต้องได้ตีจังหวะสอง
  if (CHAR_HOOKS.tsurugi.continueSlash(engine)) return;
  // โปรดิวเซอร์ (luminous burst): ตาข่ายสำรอง — ถ้าหมัดที่ทำให้ครบ "ถูกหลบ" doAttack จะ return
  //  ตั้งแต่ด่านหลบ ไม่ผ่าน postAttackFollowup เลย รางวัลจึงไม่มีวันจ่าย (และ luminous มีการหลบ 40%
  //  ของคาโฮะติดมาด้วย จึงเกิดบ่อยมาก) · flushBurst เป็น idempotent เรียกซ้ำไม่มีผลข้างเคียง
  CHAR_HOOKS.producer_lumi.flushBurst(engine);
  // ถ้าเทิร์นกำลังจะจบโดยยังไม่ได้ใช้สิทธิ์โจมตีเพิ่มของไบเลธ ให้เปิดสิทธิ์ตรงนี้
  // ครอบคลุมผู้ชนะไม่ได้โจมตี, โจมตีพลาด/ถูกลบล้าง และ path ที่ไม่ผ่าน postAttackFollowup
  timers.clearPhaseTimer();
  match.attackerId = null;

  // หลบหลีก (สถานะ Universal): แต่ละสแตคหมดอายุเองตามเทิร์นของตัวเอง / โชคลาภ (Bard): ไม่ได้ใช้ 3 เทิร์นติดกัน = หมดฤทธิ์
  // คอนเนอร์ RK800: การไล่ล่าล่มกลางคัน (เช่นคอนเนอร์ตาย) -> ปลดธง "ถูกแช่" ของทุกคนเสมอ
  CHAR_HOOKS.conner.cleanupChase(engine);
  CHAR_HOOKS.brian.cleanupDuel(engine); // ไบรอัน: การแข่งล่มกลางคัน -> ปลดธง "ถูกแช่" ของทุกคนเสมอ
  for (const p of Object.values(match.players)) {
    // คอนเนอร์ RK800 (สกิลติดตัว 1 สืบสวน): ความเครียดลดลง 1 ต่อเทิร์น (ไพ่แตกในเทิร์นนี้ลดเพิ่มอีก 1)
    //  ต้องอ่านค่า p.busted ก่อน dealRound() รีเซ็ต — จึงอยู่ท้ายเทิร์นตรงนี้
    CHAR_HOOKS.conner.onEndTurnDecay(engine, p);
    CHAR_HOOKS.escanor.onEndTurnSolar(engine, p);
    tickEvadeStacks(engine, p);
    CHAR_HOOKS.bard.onEndTurnIdleDecay(engine, p);
    // DoomGuy (characters/doomguy.js): Weapon — จบเทิร์น บังคับสลับอาวุธใหม่ทันที — ไม่ทำงานระหว่างถือ Crucible
    CHAR_HOOKS.doomguy.onRoundStartWeaponCycle(engine, p);
  }

  for (const p of Object.values(match.players)) {
    for (const k of Object.keys(p.statuses || {})) {
      if (k === "dawn") continue;   // ยามฟ้าสาง (โอเบรอน): สแตคถาวร จนกว่า Vortigern จะล้าง
      if (k === "chill") continue;  // ชิวๆครับน้องๆ (Apple guy): คงอยู่จนกว่าจะถูกโจมตี ไม่ลดเทิร์น
      // โหมงานหนัก (โคโตเนะ patch พิเศษ): คงอยู่ 3 เทิร์นแล้วหมดเอง (หรือลบก่อนด้วย Sleeping time ตอนกลางคืน)
      // ksleep (Sleeping time patch 2.1.3): นับถอยหลังตามปกติ 2 เทิร์นตายตัว — ตื่นเองแล้วรับ [เช้าที่สดใส] (ดูด้านล่าง)
      if (k === "andInk") continue;  // แอนเดอร์เซน: ลดตัวนับเองหลังแจกแต้มสกิลใน andersen.onEndTurn
      if (k === "hbleed") continue;  // เลือดไหล (patch 2.5): ลดลงเองในตอนต้นเทิร์นหลังสร้างผล (tickBleed) ไม่ลดซ้ำที่นี่
      if (k === "hburn") continue;   // ลุกไหม้ (ฮิคารุ patch 2.1.3): ลดลงเองในตอนต้นเทิร์นหลังสร้างผล (ดูด้านล่าง) ไม่ลดซ้ำที่นี่
      if (k === "star") continue;    // ดวงดาว (สึงาชิ ทาคุโตะ): สแตคถาวร สะสมจนครบ 5 เพื่อฉันคว้ามันได้แล้ว
      if (k === "emeraude" || k === "saphir" || k === "lance") continue; // Star Sword / หอกผู้พิชิต (สึงาชิ ทาคุโตะ): คงอยู่จนกว่าจะได้โจมตี (ไม่ลดเทิร์น)
      if (k === "takutoThirdAtk") continue; // พิชิตแสงดาว (สึงาชิ ทาคุโตะ): คงอยู่จนกว่าจะได้ลุ้นโจมตีครั้งที่ 3 (ไม่ลดเทิร์น)
      if (k === "doomCrucible") continue; // Crucible (ดูมกาย patch 2.2 new): คงอยู่จนกว่าจะได้โจมตี 1 ครั้ง (ไม่ลดเทิร์น)
      if (k === "doomDrain") continue; // [โดนดูด] (ดูมกาย, Plasma Rifle): tickDrain() นับถอยหลัง/ลบเองแล้ว ไม่ให้ลูปนี้ลดซ้ำ
      if (k === "doomExplode" || k === "doomLockon") continue; // [ระเบิด]/[ล็อคเป้า] (ดูมกาย, Combat Shotgun/Heavy Cannon): ค้างอยู่จนกว่าจะโดนโจมตีใช้จริง ไม่ลดเทิร์นเอง
      if (k === "fortune") continue; // โชคลาภ (Bard): คงอยู่จนกว่าจะจั่วไพ่ครั้งถัดไป (หมดอายุเองถ้าไม่ใช้ 3 เทิร์น — ดูด้านบน)
      if (k === "linked") { CHAR_HOOKS.bard.tickLinks(p); continue; } // Resonance: นับอายุแยกตาม Bard เจ้าของบทเพลง
      if (k === "yaak") continue;    // ย๊ากก! (อาริมะ มิยาโกะ): คงอยู่จนกว่าจะได้โจมตี (ไม่ลดเทิร์น)
      if (k === "evade") continue;   // หลบหลีก (สถานะ Universal): p.statuses.evade เป็นแค่ mirror ของ p.evadeStacks.length — ตัวจริงหมดอายุผ่าน tickEvadeStacks (ดูด้านบน)
      if (k === "empower") continue; // เสริมพลัง (Rejuvenation): คงอยู่จนกว่าจะได้โจมตี (ไม่ซ้อนทับ)
      if (k === "miyakoHeal" || k === "miyakoCombo" || k === "miyakoUlt") continue; // อาริมะ มิยาโกะ: คงอยู่จนกว่าจะได้โจมตี (ไม่ลดเทิร์น) — miyakoUlt เดิมหลุดหายไปเองหลัง 1 เทิร์นถ้ายังไม่ได้โจมตี (บัค)
      if (k === "kotoneLove") continue;  // โคโตเนะ (รัก รักที่สุดเลย): คงอยู่จนกว่าจะได้โจมตี (ไม่ลดเทิร์น — เหมือน empower)
      if (k === "kotoneReady") continue;  // โคโตเนะ [ความพร้อม]: สแตคถาวร สะสมจนครบ 4 เพื่อเข้าร่าง [พร้อมลุย]
      if (k === "kready") continue;       // โคโตเนะ ร่าง [พร้อมลุย]: อยู่จนกว่าจะปล่อยท่าไม้ตายในร่าง (ไม่ลดเทิร์น)
      if (k === "deathline") continue; // เส้นตาย (ชิกิ): สแตคถาวร จนกว่าจะถูกชิกิโจมตีปกติระหว่างท่าไม้ตาย
      if (k === "tepeuCook" || k === "tepeuPonder") continue; // เทเปา: ป้ายสถานะแสดงผลเฉยๆ — engine ลบเองตาม tepeuCookTurns/tepeuPonderTurns (ดูด้านล่าง)
      // ---------- ไค ชิซากิ (kai) ----------
      if (k === "kaiCreation" || k === "kaiPunishment") continue; // รังสรรค์/ลงทัณฑ์: มาร์กถาวร ไม่ลดเทิร์น — หายเฉพาะผ่าน Overhaul หรือถูกล้าง
      // ---------- ผู้สังหารเมจ (mageslayer) ----------
      if (k === "mageslayerMark") continue; // ตราล่าเวท: ถาวรจนกว่าจะย้าย/ถูกล้าง
      if (k === "mageslayerFury") continue; // Fury: สแตคพลังโกรธ ไม่ใช่ตัวนับเทิร์น — ใช้หมดพร้อมกันตอนโจมตี
      // ---------- Ultraman Trigger ----------
      if (k === "triggerForm") continue; // นับครบ 10 เทิร์นและคืน snapshot แยกที่ท้าย endTurn()
      if (k === "triggerMulti") continue; // จักรแห่งแสงคงอยู่จนกว่าจะโจมตีสำเร็จ 1 ครั้ง
      if (k === "triggerZeperion") continue; // ลำแสง Zeperion คงอยู่จนกว่าจะโจมตีสำเร็จ 1 ครั้ง
      if (k === "triggerLight") continue; // แสงสว่างคงอยู่จนเจ้าของ Trigger คืนร่างหรือโดน Zeperion ล้าง
      if (k === "hisakawaTempo") continue;
      if (k === "triggerDarkWail") continue; // อวดครวญ: สแตคถาวรจนกว่า Impact จะล้างทั้งสนาม
      if (k === "escanorMorning" || k === "escanorNight" || k === "escanorNoon" || k === "escanorLastStand" || k === "escanorSolar" || k === "escanorFlare" || k === "escanorFlareNoon" || k === "escanorPunch" || k === "escanorRhitta" || k === "escanorRhittaNoon" || k === "escanorSun") continue;
      // ---------- โอกูริ แคป (patch 2.0.8.1) ----------
      // อิปโป: Dempsey roll เป็น "ธงบัฟเปิดอยู่" ไม่ใช่ตัวนับเทิร์น — หายเมื่อโจมตีสำเร็จเท่านั้น
      if (k === "ippoDempsey") continue;
      // ผู้วิงวอน: "เกราะศรัทธา" เก็บ "จำนวนหน่วย" ไว้ที่ statusAmt ส่วน statuses เป็นแค่ธง — ไม่ใช่ตัวนับเทิร์น
      //  หายเมื่อถูกดาเมจกินจนหมดเท่านั้น (ดู faithAbsorb) ต้องตรงกับ NO_TICK_STATUS ใน _universal_status.js
      if (k === "supFaith") continue;
      // ไบรอัน: ร่างรถ/ร่างเพิ่มพลังเป็นธง ไม่ใช่ตัวนับเทิร์น — น้ำมันเป็นตัวจับเวลาแทน
      //  ต้องตรงกับ NO_TICK_STATUS ใน _universal_status.js
      if (k === "brianCar" || k === "brianBoost") continue;
      if (k === "graybeast") continue;  // ร่าง Zone: ถาวรจนกว่าจะเข้าร่างหมดแรง
      // burnout (ร่างหมดแรง): เดิมถูกยกเว้นไม่ลดเทิร์นตรงนี้ แต่ไม่มีจุดไหนในโค้ดเคลียร์ทิ้งเองเลย (ไม่มี delete p.statuses.burnout ที่ไหนทั้งไฟล์)
      //  ผลคือติดแล้วค้างถาวรทั้งแมตช์ ทั้งที่ตั้งใจให้เป็นดีบัฟ 2 เทิร์นตายตัว (ดู OGURI_BURNOUT_TURNS, characters/oguri.js) — เอาข้อยกเว้นออก ให้ลดเทิร์นตามปกติ
      // หลับไหล: เทิร์นที่เพิ่งโดนกล่อม ยังไม่เริ่มนับ (เริ่มหลับจริงเทิร์นถัดไป ครบตามจำนวนยามฟ้าสาง)
      if (k === "sleep" && p.sleepFresh) { p.sleepFresh = false; continue; }
      p.statuses[k]--;
      if (p.statuses[k] <= 0) {
        delete p.statuses[k];
        if (p.statusAmt) delete p.statusAmt[k]; // ล้างจำนวน (amount) ของสถานะพื้นฐานที่หมดอายุ (patch 2.0.8)
        // มิติมายาบรรเลงสิ้นสุด (Bard, characters/bard.js): รีเซ็ตท่อนทำนองทั้งหมด — ฉากหลัง/เพลงกลับสู่ปกติ
        if ((k === "bloodDim" || k === "soulDim") && p.characterId === "bard") {
          CHAR_HOOKS.bard.onDimExpire(engine, p);
        }
        // เชื่อมผลจบลง (Resonance): ตัดลิงก์ทั้งสองฝั่ง
        // ไค ชิซากิ: เชื่อมต่อ/คู่ปรับ หมดอายุ -> ล้าง mirror ทั้งสองฝั่ง (โค้ดแยกจาก Resonance ของ Bard)
        // โมโรโบชิ ดัน: "จงหลบแต่อย่าหนี"/"ศิษย์" หมดเวลา -> ล้างธงฝั่งดันและฝั่งเป้าหมายให้ครบ
        if (k === "danChase" || k === "danDisciple") CHAR_HOOKS.dan.onStatusExpire(engine, p, k);
        // ผู้วิงวอน: "ตราพิพากษา" หมดเวลา 5 เทิร์นโดยยังไม่ครบ 3 ครั้ง -> ผลปลายทางฝั่ง "ไม่สัมฤทธิ์"
        if (k === "supJudge") CHAR_HOOKS.the_supplicant.onJudgeExpire(engine, p);
        // โปรดิวเซอร์: ท่าไม้ตายหมดเวลา -> ล้างธงประจำท่า (ของที่ขโมยแล้ว/คนที่ตีเราแล้ว/หมัดที่ค้าง)
        if (k === "lumiUlt" || k === "lumiLuminous") CHAR_HOOKS.producer_lumi.onUltExpire(engine, p, k);
        // คาเยนน์: ร่าง "เกพาร์ด" หมดเวลา -> แรงใจเริ่มสะสมใหม่จาก 0
        if (k === "cayGepard") CHAR_HOOKS.cayenne.onGepardExpire(engine, p);
        // ไดจิ: unite หมดเวลา -> เกราะหลุดไปด้วย
        if (k === "daichiUnite") CHAR_HOOKS.daichi.onUniteExpire(engine, p);
        if (k === "kaiLink") CHAR_HOOKS.kai.onExpireKaiLink(p);
        if (k === "kaiRival1" || k === "kaiRival2") CHAR_HOOKS.kai.onExpireKaiRival(p);
        // ทาคุมิ ฟุจิวาระ: ถึงจะมองไม่เห็น แต่ฉันยังอยู่ หมดเวลาเองตามธรรมชาติ (ไม่มีใครไพ่แตกใน 5 เทิร์น) -> รีเซ็ต guard ให้ใช้ท่าไม้ตายรอบหน้าได้ปกติ
        if (k === "takumiBlackout") {
          p.takumiBlackoutFired = false;
          match.lastLog.push(`🌑 ${p.name} ถึงจะมองไม่เห็น แต่ฉันยังอยู่ หมดเวลาเอง — กลับมามองเห็นกันได้ตามปกติ`);
        }
        // ไม่อยากให้ใครต้องเจ็บปวด (ริต้า เบอร์นัล patch 2.1.7): หมดเวลาพอดีเทิร์นนี้ — ยังนับว่า "ตายขณะท่าไม้ตายทำงาน"
        //  ต่อไปอีก 1 จังหวะจบเทิร์น เผื่อตายจากผลติกท้ายเทิร์นเดียวกัน (ล้างค่านี้ทิ้งตอนเริ่มเทิร์นถัดไปใน dealRound)
        if (k === "phenexTaunt") p.phenexTauntGrace = true;
        // ความเร็วสูงหมดอายุ (เอจิ): คืนแต้มสกิลที่จ่ายค่าสกิลพื้นฐานไป
        if (k === "eijiSwift" && p.characterId === "eiji") CHAR_HOOKS.eiji.onSwiftExpire(engine, p);
        // เอจิ: "ไม่ว่ายังก็ตาม" หมดเวลา -> ติดคูลดาวน์ห้ามกดซ้ำ 3 เทิร์น (เก็บเป็นเลขรอบ ไม่ใช่สถานะ)
        if (k === "eijiUlt" && p.characterId === "eiji") CHAR_HOOKS.eiji.onUltExpire(engine, p);
        // มุยมิ: “ดาบสะบั้น” หมดเวลา -> เริ่มคูลดาวน์ท่าไม้ตาย 3 เทิร์น
        if (k === "muimiTower" && p.characterId === "muimi") CHAR_HOOKS.muimi.onUltExpire(engine, p);
        // Sleeping time หมดเวลาเอง (โคโตเนะ rework 2.3): ตื่นนอนอย่างสดชื่น (ไม่มีผลต่อเนื่องแล้ว)
        if (k === "ksleep" && p.characterId === "kotone") {
          match.lastLog.push(`🌅 ${p.name} ตื่นนอนอย่างสดชื่น — พร้อมลุยต่อแล้ว!`);
        }
        // เร้นเงาหมดเวลา (แบทแมน patch 2.2.7, characters/bat_ben.js): เล่นวีดีโอ -> ระเบิดใส่ทุกคน + ใบ้สกิลคนอื่น
        //  patch 2.2.7.1: ทำงานเสมอเมื่อครบ 3 เทิร์น — โดนโจมตีระหว่างทางไม่ทำให้สถานะหลุดอีกแล้ว
        // ความตายที่โรยราหมดเวลา (ชิกิ patch 2.0.6.1): ลบเส้นชีวิตส่วนที่ท่าไม้ตายแจกไปออกจากทุกคน
        if (k === "wither" && p.characterId === "shiki") {
          characterRules.clearWitherLines(p.id);
          match.lastLog.push(`🥀 ${p.name} ความตายที่โรยราหมดเวลา — เส้นชีวิตที่สะสมช่วงท่าไม้ตายถูกลบออกให้ทุกคน`);
        }
        if (k === "triggerDarkForm" && p.characterId === "ignis") CHAR_HOOKS.ignis.restoreFromTriggerDark(engine, p);
        // ฉันคว้ามันได้แล้ว หมดเวลา (สึงาชิ ทาคุโตะ patch 2.2.3): กลับเป็นทาคุโตะปกติ — ล้างดาบที่ค้างอยู่ ต้องเก็บดวงดาวใหม่ให้ครบ 5 อีกครั้ง
        if (k === "apprivoise" && p.characterId === "takuto") {
          delete p.statuses.emeraude;
          delete p.statuses.saphir;
          delete p.statuses.lance;
          delete p.statuses.takutoThirdAtk;
          p.takutoComboReady = false;
          p.takutoUlt2VideoPending = false;
          match.lastLog.push(`🌠 ${p.name} ฉันคว้ามันได้แล้วหมดเวลา — กลับเป็นทาคุโตะปกติ ต้องเก็บดวงดาวให้ครบ ${TAKUTO_STAR_NEED} อีกครั้งเพื่อแปลงร่าง`);
        }
      }
    }
    for (const k of Object.keys(p.seen || {})) {
      if (k === "beat") continue; // Beat Mode ถาวร
      if (!(p.statuses[k] > 0)) delete p.seen[k];
    }
    // เลือดชั่วคราว: หายเองเมื่อครบ 2 เทิร์น
    if ((p.tempHp || 0) > 0) {
      p.tempHpTurns--;
      if (p.tempHpTurns <= 0) { p.tempHp = 0; p.tempHpTurns = 0; }
    }
    p.armor = Math.min(p.armor, combat.maxArmorOf(p)); // กันเกราะเกินเพดาน
    combat.hisakawaSyncOut(p);
  }
  for (const p of Object.values(match.players)) CHAR_HOOKS.hisakawa_sister.onEndTurnTick(engine, p);
  // Ultraman Trigger: หลังคืนร่างตามเวลา HP เหลือ 1 แล้วฟื้นเอง +1/เทิร์นจนถึง HP ตอนก่อนแปลงร่าง; ถ้าโดนตีระหว่างนี้ การฟื้นอัตโนมัติหยุดทันที
  for (const p of combat.alivePlayers()) {
    const targetHp = p.triggerRecoveryTargetHp || 0;
    if (targetHp <= 0) continue;
    if (p.wasAttacked) {
      delete p.triggerRecoveryTargetHp;
      match.lastLog.push(`✨ ${p.name} ถูกโจมตีระหว่างฟื้นตัวหลังคืนร่าง — การฟื้นอัตโนมัติจาก Hyper Key Trigger หยุดลง`);
      continue;
    }
    if (p.hp < targetHp) {
      const healed = combat.healHp(p, 1);
      if (healed > 0) match.lastLog.push(`✨ ${p.name} ฟื้นตัวหลังคืนร่างจาก Hyper Key Trigger +${healed} (${p.hp}/${targetHp})`);
    }
    if (p.hp >= targetHp) delete p.triggerRecoveryTargetHp;
  }

  // จบเทิร์นรอบนั้น +1 — ช่วงกลางวันได้แต้มสกิลเพิ่มอีก +1 (ระบบกลางวัน/กลางคืน)
  //  การเดินทาง: โบนัสนี้มาจากภูมิภาคแทน (1 กลางวัน = จบเทิร์นเลขคู่ · 7 = ทุกเทิร์น) — Journey.skillBonus
  const dayBonus = Journey.skillBonus(engine, dayNight.morningBonusActive(match.roundNumber)); // patch 2.1.7: แจกเฉพาะเช้าที่ 2, 4, 6, ...
  for (const p of combat.alivePlayers()) {
    let gain = 1 + dayBonus;
    // ซาโตรุ อาเคฟุ (patch 2.0.8.2): สกิลติดตัว — รีเจนแต้มสกิลเพิ่ม +1 ทุกเทิร์น (ปิดได้ เช่น MOON*CELL)
    if (p.characterId === "satoru" && !characterRules.passiveSealed(p)) gain += 1;
    // Ultraman Trigger: สกิลติดตัวฟื้นแต้มสกิลเพิ่มอีก 1 หน่วยทุกเทิร์น
    if (p.characterId === "ultraman_trigger") gain += 1;
    // ฟุจิตะ โคโตเนะ (rework 2.3): สกิลติดตัว — โอกาส 30% ฟื้นแต้มสกิล +1 ต่อเทิร์น
    if (p.characterId === "kotone") gain += CHAR_HOOKS.kotone.extraSkillRegen(engine, p);
    if (p.characterId === "hisakawa_sister") gain += CHAR_HOOKS.hisakawa_sister.extraSkillRegen(p);
    if (p.characterId === "ignis") gain += CHAR_HOOKS.ignis.extraSkillRegen(engine, p);
    // เท็นโนจิ โคทาโร่ (สลับรากชีวิต): กลืนแต้มที่ควรฟื้นไปทำเป็นพลังชีวิตแทน
    combat.addSkill(p, gain);
  }
  if (dayBonus) match.lastLog.push(Journey.active(engine)
    ? `🗺️ ${Journey.AREAS[Journey.areaOf(match.roundNumber) - 1].name} — ทุกคนได้แต้มสกิลเพิ่ม +${dayBonus}`
    : "☀️ จบเทิร์นช่วงกลางวัน — ทุกคนได้แต้มสกิลเพิ่ม +1");
  // ระบบเหรียญ (patch 2.2 full): จบเทิร์น +1 เหรียญให้ทุกคน (เพดาน 30 — เต็มแล้วไม่ได้เพิ่มจน spending ลดลง)
  if (!Seraph.active()) for (const p of combat.alivePlayers()) {
    const goldGain = GOLD_PER_TURN + Journey.goldBonus(engine) + (p.characterId === "hisakawa_sister" ? CHAR_HOOKS.hisakawa_sister.extraGoldRegen(p) : 0) + (p.characterId === "ignis" ? CHAR_HOOKS.ignis.extraGoldRegen(engine, p) : 0);
    // เท็นโนจิ โคทาโร่ (สลับพลังงาน): กลืนเหรียญที่ควรได้ไปทำเป็นแต้มสกิลแทน
    shop.addGold(p, goldGain);
  }

  // ชิวๆครับน้องๆ (Apple guy): จบเทิร์นได้แต้มสกิลเพิ่ม +1 จนกว่าจะถูกโจมตี
  for (const p of combat.alivePlayers()) {
    if ((p.statuses.chill || 0) > 0) {
      combat.addSkill(p, 1, "passive");
      match.lastLog.push(`🏖️ ${p.name} ชิวๆครับน้องๆ — จบเทิร์นได้แต้มสกิลเพิ่ม +1`);
    }
  }

  // ตราล่าเวท (characters/mageslayer.js): ทุก 2 เทิร์นขโมยพลังงานเป้าหมายที่มาร์กไว้ 1 หน่วย
  CHAR_HOOKS.mageslayer.tickWitchMark(engine);

  // เทเปา (characters/tepeu.js): ครุ่นคิด (+แต้มสกิล) / ทำอาหาร (ส่ง "มื้อที่สุข" เข้าคลังเมื่อครบ) / ฉากหลังท่าไม้ตายนับถอยหลัง
  CHAR_HOOKS.tepeu.onTurnEndTick(engine);

  // การเดินทาง: ผลจบเทิร์นของภูมิภาค (ของฟรี / เสียเหรียญ / ความเสียหายจากสนาม / สตั้น / ผุพัง)
  //  อยู่หลังลูปลดเทิร์นสถานะ (สตั้น/ผุพังที่ติดตรงนี้จึงมีผลเต็มเทิร์นหน้า) และก่อนด่านกวาดคนตายด้านล่าง
  Journey.onEndTurn(engine);
  // โอเบรอน (ฤดูร้อน): สตั้นจากจุดจบของความฝัน (ต้องอยู่หลังลูปลดเทิร์น = เต็ม 3 เทิร์นถัดไป) + สกิลติดตัวหน้าไหว้หลังหลอก
  CHAR_HOOKS.oberon_summer.onEndTurn(engine);
  CHAR_HOOKS.andersen.onEndTurn(engine); // แอนเดอร์เซน: แต้มสกิล +1 ทุกจบเทิร์นจากท่าไม้ตาย (andInk)

  for (const p of Object.values(match.players)) {
    if (p.alive && p.hp <= 0) {
      // patch 2.1.6.3: เรียกผ่าน instantDeath() แทนการตั้ง alive=false ตรงๆ — กันบั๊กริต้าไม่เกิดใหม่
      //  (จุดนี้เคย bypass สกิลติดตัว 1 ริต้า เบอร์นัล เพราะไม่ได้เรียก instantDeath ที่มีตรรกะเกิดใหม่)
      combat.instantDeath(p);
      if (!p.alive) match.lastLog.push(`💀 ${p.name} เลือดจริงหมด ตกรอบ!`);
    }
  }
  // Locacaca fruit (ซาโตรุ): ฝ่ายใดฝ่ายหนึ่งตาย -> ข้อเสนอตกไป
  for (const p of Object.values(match.players)) {
    if (p.locaOffer && (!p.alive || !match.players[p.locaOffer] || !match.players[p.locaOffer].alive)) p.locaOffer = null;
  }

  // ยูนะ (เพลง Longing): มีคนตายรอฟื้นอยู่ไหม — ฉากโจมตี(ถ้ามี)จบไปแล้วตอนนี้แน่นอน ค่อยฟื้นคืนชีพ+คิววีดีโอตอนนี้
  //  ให้ทันเข้าคิวก่อน runCutsceneQueue ด้านล่างจะดึงไปเล่น (วีดีโอเล่นจบ -> เพลงล็อกเริ่มพร้อมเทิร์นถัดไปทันที)
  if (match.yunaLongingPendingId) {
    const revived = match.players[match.yunaLongingPendingId];
    match.yunaLongingPendingId = null;
    if (revived) YunaMod.reviveWithLonging(engine, revived);
  }
  // Ultraman Trigger: นับเทิร์นหลังผลท้ายเทิร์นทั้งหมดจบแล้ว เพื่อให้ครบ 10 เทิร์นเต็ม
  // เมื่อหมดเวลา คืน snapshot ก่อนแปลงร่าง (ค่าที่เกิดในร่าง Trigger จึงไม่ติดกลับไป)
  for (const p of Object.values(match.players)) {
    if (p.characterId !== "ultraman_trigger" || !p.alive) continue;
    p.statuses.triggerForm = Math.max(0, (p.statuses.triggerForm || 0) - 1);
    if (p.statuses.triggerForm <= 0) CHAR_HOOKS.ultraman_trigger.restore(engine, p, false);
  }
  // อิสึกะ ชิโด (characters/shido.js): นับถอยหลังกับดัก "ฝากด้วยนะตัวฉัน" (ไม่ได้อยู่ใน p.statuses
  //  จึงไม่เข้าลูปลดเทิร์นด้านบน) แล้วคิว shido_skill3.mp4 เป็นรอยต่อก่อนขึ้นเทิร์นถัดไปถ้ากับดักเพิ่งทำงาน
  for (const p of Object.values(match.players)) CHAR_HOOKS.shido.onEndTurn(engine, p);
  CHAR_HOOKS.shido.flushDeathVideo(engine);
  // เล่นฉากระเบิด/ยูนะ (ถ้ามี) ให้จบก่อน แล้วค่อยสรุปจบเกม/ขึ้นรอบถัดไป
  cutscene.runCutsceneQueue(() => {
    // อิสึกะ ชิโด "ฝากด้วยนะตัวฉัน": ย้อนเวลากลับ 5 เทิร์น — จุดนี้คือหลังวีดีโอรอยต่อเล่นจบแล้ว
    //  ต้องอยู่ "ก่อน" alivePlayers()/เงื่อนไขจบเกมทั้งหมด ไม่งั้นรายชื่อที่คำนวณไว้จะเป็นของก่อนย้อน
    //  (ชิโดเพิ่งตาย เกมอาจนับว่าเหลือผู้ชนะคนสุดท้ายทั้งที่อีกครู่ทุกคนจะถูกย้อนกลับมา)
    let shidoRewound = false;
    for (const sp of Object.values(match.players)) {
      if (CHAR_HOOKS.shido.applyRewind(engine, sp)) shidoRewound = true;
    }

    // ---------- SE.RA.PH: เดินวัน / จบคู่ดวล / จบรอบ / ประกาศผู้ชนะคนสุดท้าย ----------
    if (Seraph.active()) {
      if (seraphMode.seraphAdvance()) return;
    }
    // ---------- Type Mercury: ORT ตาย = ชนะ · ตัวละครหมดและไม่มีใครในสนาม = แพ้ · ตายหมดแต่ยังเลือกตัวได้ = หยุดรอ ----------
    //  ไม่ใช้เงื่อนไข "เหลือคนสุดท้าย" ของโหมดปกติ (ORT นับเป็นผู้เล่น 1 คนใน alivePlayers)
    if (mercury.mercuryActive() && !shidoRewound) {
      if (mercury.mercuryAdvance()) return;
      match.gameState = "TRANSITION";
      timers.startPhaseTimer(TRANSITION_TIME, draw.dealRound);
      view.broadcastState();
      return;
    }

    // นับเฉพาะผู้เล่นจริง — ORT (ถ้าบุกเข้ามาแล้ว) ไม่ใช่ผู้ชิงชัย (ดู normalGameOver)
    if (!shidoRewound && mercury.normalGameOver()) return;
    // การเดินทาง: ข้ามเข้าภูมิภาคใหม่ -> ฉากแผนที่ก่อนแจกไพ่เทิร์นแรกของภูมิภาคนั้น
    if (!shidoRewound && mercury.maybeJourneyAdvance()) return;
    match.gameState = "TRANSITION";
    timers.startPhaseTimer(TRANSITION_TIME, draw.dealRound);
    view.broadcastState();
  });
}
