// กติกาเฉพาะตัวละครที่ระบบกลางยังเรียกตรง (ยังไม่ได้ย้ายเข้า characters/*.js)
// export ก่อน require: ไฟล์ใน server/ require วนกันเอง — function declaration ถูก hoist จึงพร้อมใช้ตั้งแต่บรรทัดแรก
Object.assign(module.exports, {
  rollDoomWeapon, maybeWakeKotone, passiveSealed, killSealed, hasKillCapability,
  appleGuyDodgesKill, miyakoKillChance, miyakoSurvivedKillAttempt, takumiBlackoutActive,
  doomWeaponMarkPending, yunaBeatBarkActive, shikiUltNameOf, clearWitherLines, shikiGiveLifeline,
  oguriGoldStacks, oguriChargeCapOf, oguriAshenReady, oguriAddEnergy, oguriAddCharge,
  satoruOnTargeted, recruitQteFinish, recruitInterceptAttack, recruitQteHit, recruitQteDone,
  recruitPick, mark42Run, mark42Control, strikerApprove, strikerRepairStart, strikerRepairDone,
  recruitPrep,
});

const CHAR_HOOKS = require("../characters/index");
const { resistActive, numbFizzles, accurateActive } = require("../characters/_universal_status");
const { netramanaActive } = require("../characters/_universal_status");
const Mark42 = require("../characters/_mark42");
const Seraph = require("../seraph");
const { io } = require("./app");
const {
  ATTACKFX_TIME, DOOM_WEAPONS, DOOM_WEAPON_IDS, MIYAKO_KILL_REDUCE, OGURI_CHARGE_BASE_CAP,
  OGURI_CHARGE_CAP_MAX_BONUS, OGURI_ENERGY_MAX, OGURI_GOLD_MAX, OGURI_ULT2_CHARGE_COST,
  SHIKI_WITHER_PASSIVE_CAP, TRANSFORMS,
} = require("./constants");
const match = require("./match");
const { engine } = require("./engine");
const attack = require("./phases/attack");
const combat = require("./combat");
const cutscene = require("./cutscene");
const draw = require("./phases/draw");
const endTurnPhase = require("./phases/endTurn");
const lobby = require("./lobby");
const mercury = require("./modes/mercury");
const shop = require("./shop");
const timers = require("./timers");
const view = require("./view");

// ---------- เทเปา (ชิกิ) — ค่าคงที่/ตรรกะทั้งหมดย้ายไปอยู่ characters/tepeu.js แล้ว ----------
// สุ่มอาวุธถัดไปแบบถ่วงน้ำหนัก (ไม่สุ่มซ้ำกระบอกเดิม)
function rollDoomWeapon(excludeId) {
  const total = DOOM_WEAPON_IDS.reduce((n, id) => n + (id === excludeId ? 0 : DOOM_WEAPONS[id].weight), 0);
  let r = Math.random() * total;
  for (const id of DOOM_WEAPON_IDS) {
    if (id === excludeId) continue;
    r -= DOOM_WEAPONS[id].weight;
    if (r <= 0) return id;
  }
  return DOOM_WEAPON_IDS.find((id) => id !== excludeId) || DOOM_WEAPON_IDS[0];
}

// ---------- ฟุจิตะ โคโตเนะ (rework 2.3) ----------
// ค่าคงที่ของโคโตเนะอยู่ที่ characters/kotone.js ทั้งหมดแล้ว (เพดานเหรียญ/กระปุกอ่านผ่าน CHAR_HOOKS.kotone.*)
// Sleeping time: ถูกโจมตีระหว่างหลับจะไม่ปลุกโคโตเนะ — หลับยาว 3 เทิร์นเต็มโดยไม่สะดุ้งตื่น
// (คงฟังก์ชัน/จุดเรียกไว้เผื่อใช้ในอนาคต — ตอนนี้ไม่มีผลอะไรแล้ว)
function maybeWakeKotone(t) {
  return;
}
// ---------- นานายะ ชิกิ (patch 2.1.9) ----------
// ค่าคงที่/logic ทั้งหมดย้ายไปอยู่ characters/nanaya.js แล้ว
// สกิลติดตัวถูก "อันนี้ของนายรึเปล่า" หรือ MOON*CELL (คิชินามิ ฮาคุโนะ) ปิดใช้งานอยู่ไหม
function passiveSealed(p) {
  if (!p) return false;
  // SE.RA.PH วันที่ 1-6: ปิดสกิลติดตัวของทุกคน — ปิดที่นี่จุดเดียวจึงครอบคลุมทุก trigger
  //  ที่ผ่าน passiveSealed (§14 ข้อ 1) ส่วน firePassive มีด่านของตัวเองด้านล่าง
  if (Seraph.noCombat()) return true;
  return ((p.statuses && p.statuses.nanayaSeal) || 0) > 0;
}
// ความสามารถสังหารทันทีถูก "หนูจะทำให้พี่ตาสว่างเอง" ปิดใช้งานอยู่ไหม (อาริมะ มิยาโกะ)
function killSealed(p) {
  return !!p && ((p.statuses && p.statuses.miyakoSeal) || 0) > 0;
}
// ตัวละครนี้ "มี" ความสามารถสังหารทันทีติดตัวไหม (นานายะ ชิกิ: นับแม้กำลังปิดสกิลติดตัวไว้อยู่ — ป้องกันเปิดกลับมาใช้ทีหลัง
//  หลังโดนปิดใช้งานจากหนูจะทำให้พี่ตาสว่างเอง / เรียวกิ ชิกิ: ต้องมีท่าไม้ตายสังหารทันทีเปิดใช้งานอยู่จริงเท่านั้น เพราะเป็นทรัพยากรที่ต้องเสียแต้มเปิดใหม่)
function hasKillCapability(p) {
  if (!p || !p.alive) return false;
  if (p.characterId === "nanaya") return true;
  if (p.characterId === "shiki" && (((p.statuses.deatheye || 0) > 0) || ((p.statuses.wither || 0) > 0))) return true;
  // เจ้าหญิงราก (patch 2.2.7): สกิลติดตัวคิดโอกาสสังหารจากเส้นชีวิตเสมอเมื่อได้โจมตีปกติ
  if (p.characterId === "princess_shiki") return true;
  // "เนตรมณะ" (สถานะ Universal patch 2.2.7): ใครติดบัฟนี้ก็มีความสามารถสังหารทันทีระหว่างที่บัฟยังอยู่
  if (netramanaActive(p)) return true;
  return false;
}
// Apple guy: หลบหลีกสำเร็จระหว่างชิวๆครับน้องๆ สามารถรอดพ้นจากสกิลประเภท "สังหารทันที" ได้ด้วย
//  (universal-dispatcher wrapper — ตรรกะจริงอยู่ characters/appleguy.js — ตัวละครสังหารทันทีอื่นเรียกผ่าน engine.appleGuyDodgesKill)
function appleGuyDodgesKill(attacker, target) {
  if (accurateActive(attacker)) return false; // "แม่นยำ": เจาะการหลบทุกแบบ
  return CHAR_HOOKS.appleguy.tryDodgeKill(engine, attacker, target);
}
// นั่นพี่จ๋าหรอ? (สกิลติดตัว): ลดโอกาสถูกสังหารทันทีของอาริมะ มิยาโกะ ตามจำนวนครั้งที่เคยรอด (สะสม 40%/ครั้ง)
function miyakoKillChance(target, baseChance) {
  // ORT (ต้านการสังหาร): สกิลสังหารที่โอกาสต่ำกว่า 40% ใช้กับ ORT ไม่ได้เลย — ทุกเนตรเรียกผ่านจุดนี้
  if (mercury.isOrt(target)) return CHAR_HOOKS.ort.killChanceAgainst(target, baseChance);
  if (!target || target.characterId !== "miyako") return baseChance;
  const resist = target.miyakoKillResist || 0;
  return Math.max(0, baseChance * (1 - MIYAKO_KILL_REDUCE * resist));
}
// เรียกเมื่ออาริมะ มิยาโกะ รอดจากการถูกสังหารทันที (การสังหารพลาด/ไม่เกิดขึ้น) — สะสมสกิลติดตัวเพิ่ม +1 ชั้น เสียพลังชีวิต 1 หน่วยไม่สนเกราะ
function miyakoSurvivedKillAttempt(target) {
  if (!target || target.characterId !== "miyako" || !target.alive) return;
  target.miyakoKillResist = (target.miyakoKillResist || 0) + 1;
  match.lastLog.push(`🥊 ${target.name} นั่นพี่จ๋าหรอ? — รอดจากการถูกสังหารทันที! โอกาสถูกสังหารทันทีในอนาคตลดลงอีก 40% (สะสม ${target.miyakoKillResist} ชั้น) เสียพลังชีวิต 1 หน่วย (ไม่สนเกราะ)`);
  combat.dealDirect(target, 1);
  if (target.alive && target.hp <= 0) { combat.instantDeath(target); if (!target.alive) match.lastLog.push(`💀 ${target.name} เลือดจริงหมด ตกรอบ!`); }
}
// ทาคุมิ ฟุจิวาระ: ถึงจะมองไม่เห็น แต่ฉันยังอยู่ — ท่าไม้ตายทำงานอยู่ไหม (บังตากระดานทั้งหมด)
function takumiBlackoutActive() {
  return Object.values(match.players).some((pp) => (pp.statuses && pp.statuses.takumiBlackout) > 0);
}
// DoomGuy: มี [ระเบิด]/[ล็อคเป้า] ค้างอยู่บนใครสักคนไหม (Combat Shotgun/Heavy Cannon) — ค้างอยู่ระหว่างนี้กด Quick Swap สุ่มปืนใหม่ไม่ได้ จนกว่าจะโดนใช้ (โดนโจมตี)
function doomWeaponMarkPending() {
  return Object.values(match.players).some((pp) => (pp.statuses && (pp.statuses.doomExplode > 0 || pp.statuses.doomLockon > 0)));
}
// ยูนะ — Break Beat Bark! ทำงานอยู่ไหม (บัฟทั้งสนาม ไม่ใช่สถานะผู้เล่นคนเดียว)
function yunaBeatBarkActive() {
  // เอจิ: ท่าไม้ตาย "ไม่ว่ายังก็ตาม" บังคับเปิด Break Beat Bark! — ถือ statuses.eijiUlt เป็นแหล่งความจริง
  //  ห้ามพึ่ง yunaEffect อย่างเดียว เพราะ Longing (ที่ทริกจากการตาย ไม่ผ่าน rollWindow) เขียนทับตัวแปรร่วมนี้
  //  ได้ทุกเมื่อ ทำให้เอฟเฟกต์สนามของท่าไม้ตายหายกลางคันทั้งที่ตัวท่ายังนับเทิร์นเหลืออยู่
  if (timers.eijiUltFieldActive()) return true;
  return match.yunaEffect === "beatbark" && match.roundNumber <= match.yunaWindowEnd;
}
// ชื่อท่าไม้ตายจาก status (ใช้ตอนยกเลิกย้อนหลัง — บางท่าไม่มีใน TRANSFORMS/ข้อมูลสกิล)
function shikiUltNameOf(p, key) {
  if (key === "wither") return "ความตายที่โรยรา";
  if (key === "batTaunt") return "เข้ามาเลย";
  if (key === "pshikiUlt") return "ทุกอย่างจะต้องราบรื่น";
  if (key === "deatheye") return "ฉันมองเห็นมันแล้ว";
  if (key === "chill") return "ชิวๆครับน้องๆ";
  if (key === "bloodDim") return "มิติมายาบรรเลงโลหิต";
  if (key === "soulDim") return "มิติมายาบรรเลงวิญญาณ";
  if (key === "ashen") return "Ashen Trail: Cinderella Gray";
  const t = TRANSFORMS[key];
  if (t && t.title) return t.title;
  const s = combat.skillByStatus(p, key);
  return s ? s.name : key;
}
// จบความตายที่โรยรา (สังหารสำเร็จ/หมดเวลา/ถูกยกเลิก): ลบเส้นชีวิตส่วนที่ท่าไม้ตายแจกไปออกจากทุกคน
function clearWitherLines(shikiId = null) {
  for (const o of Object.values(match.players)) {
    const byOwner = o.witherAddedBy || {};
    const added = shikiId ? (byOwner[shikiId] || 0) : Object.values(byOwner).reduce((sum, n) => sum + n, 0);
    if (added > 0) {
      const cur = o.statuses.deathline || 0;
      const next = Math.max(0, cur - added);
      if (next > 0) o.statuses.deathline = next;
      else delete o.statuses.deathline;
    }
    if (shikiId) delete byOwner[shikiId];
    else o.witherAddedBy = {};
    if (shikiId && !Object.keys(byOwner).length) delete o.witherAddedBy;
  }
}
// มอบเส้นชีวิตจากสกิลติดตัว/สกิลรอง (โหมดท่าไม้ตาย 2: +1/ครั้ง และแหล่งปกติให้ได้ไม่เกิน 3)
function shikiGiveLifeline(shiki, target, amount) {
  if (resistActive(target)) return 0; // ต้านสถานะผิดปกติ: ไม่ได้เส้นชีวิตเพิ่ม (สแตคเดิมที่มีอยู่ก่อนหน้าไม่หาย)
  const cur = target.statuses.deathline || 0;
  if ((shiki.shikiUlt || "deatheye") === "wither") {
    if (cur >= SHIKI_WITHER_PASSIVE_CAP) return 0;
    const next = Math.min(SHIKI_WITHER_PASSIVE_CAP, cur + 1);
    target.statuses.deathline = next;
    return next - cur;
  }
  target.statuses.deathline = cur + amount;
  return amount;
}
// แต้มยุคทองปัจจุบัน (เก็บจำนวนใน statusAmt คู่กับเวลาใน statuses)
function oguriGoldStacks(p) {
  return ((p.statuses && p.statuses.goldenera) || 0) > 0 ? ((p.statusAmt && p.statusAmt.goldenera) || 0) : 0;
}
// ความจุ Stamina ชาร์จปัจจุบัน (พื้นฐาน 52 + ที่เพิ่มจาก Training สะสมสูงสุด +48 = เพดาน 100)
function oguriChargeCapOf(p) {
  return OGURI_CHARGE_BASE_CAP + Math.min(OGURI_CHARGE_CAP_MAX_BONUS, p.oguriChargeCapBonus || 0);
}
// ยุคทองครบ + Stamina ชาร์จพอ -> ปลดล็อกท่าไม้ตาย 2 Ashen Trail แทนท่าไม้ตาย 1
function oguriAshenReady(p) {
  return oguriGoldStacks(p) >= OGURI_GOLD_MAX && (p.stamina || 0) >= OGURI_ULT2_CHARGE_COST;
}
// เพิ่ม/ลด Energy (0..16) — ทรัพยากรของ Breakfast/Training/GrayBeast
function oguriAddEnergy(p, n) {
  p.oguriEnergy = Math.max(0, Math.min(OGURI_ENERGY_MAX, (p.oguriEnergy || 0) + n));
}
// เพิ่ม/ลด Stamina ชาร์จ (0..ความจุปัจจุบัน) — ทรัพยากรของท่าไม้ตาย ได้รับอัตโนมัติทุกเทิร์น
function oguriAddCharge(p, n) {
  p.stamina = Math.max(0, Math.min(oguriChargeCapOf(p), (p.stamina || 0) + n));
}
function satoruOnTargeted(t, by, what) {
  if (!t || t.characterId !== "satoru") return { negated: false };
  return CHAR_HOOKS.satoru.onTargeted(engine, t, by, what);
}

// ============================================================
//  Recruit (characters/recruit.js) — QTE คลิกจุดแดง (แยกจาก QTE กลางแบบกดปุ่ม)
//  โจมตีปกติ: เฟส ATTACK ถูกพักไว้ด้วยตัวจับเวลา server (ตาข่ายกันค้างถ้าเจ้าตัวหลุด) แล้วค่อยยิงจริงผ่าน doAttack
//  สกิล: เล่นในเฟส PLAYING — ค้างอยู่ = pendingAnswer ของ checkAllLocked · เปิดไพ่แล้วยังไม่จบ = นับจุดที่คลิกได้ตอนนั้น
// ============================================================
const RECRUIT_ATTACK_SAFETY_SECONDS = Math.ceil(CHAR_HOOKS.recruit.QTE_MS / 1000) + 3;
// sweeping = เรียกจาก resolveRound (เปิดไพ่แล้ว) — ห้ามพักเฟสเล่นคลิปตรงนี้ คลิปที่คิวไว้ไปเล่นกับ afterResolve เอง
function recruitQteFinish(p, sweeping) {
  const res = CHAR_HOOKS.recruit.takeQte(p);
  if (!res) return;
  if (res.mode === "attack") { recruitAttackResolved(p, res); return; }
  const out = combat.withEffectSource(p, () => CHAR_HOOKS.recruit.resolveSkill(engine, p, res)) || {};
  const after = out.after ? () => combat.withEffectSource(p, out.after) : null;
  if (!sweeping && match.gameState === "PLAYING" && match.cutsceneQueue.length) { cutscene.pausePlayingForCutscene(after); return; }
  if (after) after();
  if (sweeping) return;
  view.broadcastState();
  if (mercury.checkOrtEarlyWin()) return;
  draw.checkAllLocked();
}
function recruitAttackResolved(p, res) {
  timers.clearPhaseTimer();
  if (match.gameState !== "ATTACK" || match.attackerId !== p.id || !p.alive) { if (match.gameState === "ATTACK") endTurnPhase.endTurn(); return; }
  CHAR_HOOKS.recruit.settleAttack(engine, p, res);
  if (res.ok) {
    attack.doAttack(p.id, res.targetId);
    // doAttack ปฏิเสธเป้าได้ (เป้าตายไปแล้ว ฯลฯ) — อย่าให้เฟส ATTACK ค้าง
    if (match.gameState === "ATTACK") { p.recruit.shot = false; endTurnPhase.endTurn(); }
    return;
  }
  const target = match.players[res.targetId];
  recruitShowMiss(p, target, `ยิงพลาด — QTE ${res.hits}/${res.total}`);
}
function recruitShowMiss(p, target, label) {
  match.lastAttack = {
    id: ++match.attackSeq,
    byName: p.name, byImg: view.displayImg(p), byColor: lobby.colorOf(p), byAttackSound: attack.attackSoundOf(p),
    targetName: target ? target.name : "", targetImg: target ? view.displayImg(target) : null, targetColor: target ? lobby.colorOf(target) : "#888",
    dmg: 0, dodge: true, fxMs: ATTACKFX_TIME * 1000,
    skills: [{ name: label, img: CHAR_HOOKS.recruit.IMG.base, by: p.name, color: lobby.colorOf(p), side: "atk" }],
  };
  match.gameState = "ATTACKING";
  timers.startPhaseTimer(ATTACKFX_TIME, () => cutscene.runCutsceneQueue(endTurnPhase.endTurn));
  view.broadcastState();
}
// doAttack ของ Recruit ที่ยังไม่ได้เล็ง -> เปิด QTE แทนการตีทันที (คืน true = รับช่วงไปแล้ว)
function recruitInterceptAttack(attacker, target) {
  if (attacker.characterId !== "recruit" || !attacker.recruit) return false;
  if (CHAR_HOOKS.recruit.consumeShot(attacker)) return false; // QTE ผ่านแล้ว — นี่คือการยิงจริง
  timers.clearPhaseTimer();
  if (!CHAR_HOOKS.recruit.hasBullets(attacker)) {
    match.lastLog.push(`🔫 ${attacker.name} กระสุนหมด — ยิงไม่ได้!`);
    recruitShowMiss(attacker, target, "กระสุนหมด — ยิงไม่ได้");
    return true;
  }
  CHAR_HOOKS.recruit.startQte(engine, attacker, "attack", target.id);
  timers.startPhaseTimer(RECRUIT_ATTACK_SAFETY_SECONDS, () => recruitQteFinish(attacker, false));
  view.broadcastState();
  return true;
}
function recruitQteHit(id, dotId) {
  const p = match.players[id];
  if (!p || !p.alive || !CHAR_HOOKS.recruit.qteActive(p)) return;
  if (CHAR_HOOKS.recruit.hitDot(engine, p, String(dotId || ""))) recruitQteFinish(p, false);
  else view.broadcastState();
}
function recruitQteDone(id) {
  const p = match.players[id];
  if (!p || !p.alive || !CHAR_HOOKS.recruit.qteActive(p) || !CHAR_HOOKS.recruit.timeUp(p)) return;
  recruitQteFinish(p, false);
}
function recruitPick(id, targets) {
  const p = match.players[id];
  if (!p || !p.alive || match.gameState !== "PLAYING") return;
  if (!combat.withEffectSource(p, () => CHAR_HOOKS.recruit.applyPick(engine, p, targets))) return;
  view.broadcastState();
  if (mercury.checkOrtEarlyWin()) return;
  draw.checkAllLocked();
}
// ---------- เกราะ Mark 42: เล่นวีดีโอก่อน แล้วค่อยเกิดผล (แพทเทิร์นเดียวกับกระสุน GUTS) ----------
function mark42Run(p, plan, onUsed) {
  io.emit("skillFlash", { name: plan.flash, img: Mark42.IMG.item, by: p.name, color: lobby.colorOf(p) });
  if (onUsed) onUsed();
  const after = () => combat.withEffectSource(p, plan.after);
  if (plan.video && match.gameState === "PLAYING") {
    // ระเบิดเล่นทุกครั้ง · ใส่เอง/ใส่ให้/เรียกคืน เต็มครั้งแรกครั้งเดียว (ครั้งถัดไปแค่การ์ดแจ้งเตือน ไม่หยุดเกม)
    //  ผ่าน engine — เทสต์แทนที่ได้ (ในเกมจริงคือฟังก์ชันเดียวกัน)
    if (plan.video === "mark42Bomb") engine.queueCutscene(p, plan.video);
    else engine.triggerCutscene(p, plan.video);
    if (match.cutsceneQueue.length) { cutscene.pausePlayingForCutscene(after); return; }
  }
  after();
  view.broadcastState();
  if (mercury.checkOrtEarlyWin()) return;
  draw.checkAllLocked();
}
// เจ้าของคุมชุดที่ส่งออกไปแล้ว: เรียกคืน / ถอด / สั่งระเบิด (ช่วงจั่วการ์ด · คนใส่ถอดเองไม่ได้)
function mark42Control(id, action) {
  const p = match.players[id];
  if (!p || !p.alive || match.gameState !== "PLAYING" || shop.asleep(p)) return;
  if (CHAR_HOOKS.conner.skillBlocked(engine, p) || CHAR_HOOKS.brian.itemBlocked(engine) || CHAR_HOOKS.daisuke.actionBlocked(engine, p) || CHAR_HOOKS.dio.itemBlocked(engine)) return;
  const plan = Mark42.planControl(engine, p, action);
  if (!plan) { view.broadcastState(); return; }
  mark42Run(p, plan, null);
}
// ---------- สไตรเกอร์ ยูเรก้า: คำสั่งของนักบิน ----------
function strikerApprove(id, accept) {
  const p = match.players[id];
  if (!p || !p.alive || match.gameState !== "PLAYING") return;
  const out = combat.withEffectSource(p, () => CHAR_HOOKS.striker.answerApproval(engine, p, accept));
  const after = out && out.after ? () => combat.withEffectSource(p, out.after) : null;
  if (match.cutsceneQueue.length) { cutscene.pausePlayingForCutscene(after); return; }
  if (after) after();
  view.broadcastState();
  if (mercury.checkOrtEarlyWin()) return;
  draw.checkAllLocked();
}
function strikerRepairStart(id) {
  const p = match.players[id];
  if (!p || match.gameState !== "PLAYING" || p.locked || !CHAR_HOOKS.striker.canRepair(engine, p)) return;
  CHAR_HOOKS.striker.startRepair(engine, p);
  view.broadcastState();
}
function strikerRepairDone(id, pairs) {
  const p = match.players[id];
  if (!p || match.gameState !== "PLAYING") return;
  if (!p.striker || !p.striker.repair) return;
  combat.withEffectSource(p, () => CHAR_HOOKS.striker.finishRepair(engine, p, Array.isArray(pairs) ? pairs : null));
  view.broadcastState();
  draw.checkAllLocked();
}
// สกิลพิเศษ "เตรียมตัว" — ไม่กินโควตาสกิลของเทิร์น แต่ยังเป็น "การกดสกิล" (ด่านเดียวกับ useSkill ที่เกี่ยวข้อง)
function recruitPrep(id, kind) {
  const p = match.players[id];
  if (!p || !p.alive || match.gameState !== "PLAYING" || p.locked || Seraph.active()) return;
  if ((p.statuses.noskill || 0) > 0 || (p.statuses.phenexTaunt || 0) > 0) return;
  if (CHAR_HOOKS.conner.skillBlocked(engine, p) || CHAR_HOOKS.brian.skillBlocked(engine, p, "basic") || CHAR_HOOKS.daisuke.skillBlocked(engine, p, "basic") || CHAR_HOOKS.dio.skillBlocked(engine, p, "basic")) return;
  if (!CHAR_HOOKS.recruit.canPrep(engine, p, kind)) return;
  p.skillPoints -= 1;
  const prep = CHAR_HOOKS.recruit.PREP[kind];
  if (numbFizzles(p)) {
    match.lastLog.push(`🫨 ${p.name} เหน็บชา — ${prep.name} ไม่ทำงาน! (แต้มสกิลถูกหักไปแล้ว)`);
    io.emit("skillFlash", { name: `${prep.name} — เหน็บชา สกิลไม่ทำงาน`, img: CHAR_HOOKS.recruit.IMG[kind], by: p.name, color: lobby.colorOf(p) });
  } else {
    const suffix = combat.withEffectSource(p, () => CHAR_HOOKS.recruit.applyPrep(engine, p, kind)) || "";
    io.emit("skillFlash", { name: `${prep.name}${suffix}`, img: CHAR_HOOKS.recruit.IMG[kind], by: p.name, color: lobby.colorOf(p), sound: CHAR_HOOKS.recruit.SFX[kind] });
  }
  CHAR_HOOKS.conner.onSkillUsed(engine, p);
  view.broadcastState();
  draw.checkAllLocked();
}
