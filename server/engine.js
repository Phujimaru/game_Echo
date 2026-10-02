// engine — context object ที่ส่งให้ characters/*.js เรียกกลับเข้ามาใช้ state/ฟังก์ชันร่วม
const engine = {};
module.exports = { engine };

const { CHAR_BY_ID, POSITION_COLORS } = require("../characters");
const CHAR_HOOKS = require("../characters/index");
const {
  SPELLBURDEN_MAX, statusAmtOf, applyBuff: rawApplyBuff, stripLatestBuff, setTurnsNoRefresh,
  resistActive, BASIC_DEBUFF_CLEAR, SOFT_DEBUFF_STEP, cleanseDebuffs, cleanseOneStep,
  cleanseLatestDebuff, coolReduction, applyPoison, poisonAtkPenalty, tickPoison, applyShock,
  tickShock, applyCurse, tickCurseOnSkill, MEND_MAX_TURNS, applyMend, tickMend, blindActive,
  noHealActive, invertActive, HBLEED_MAX, bleedActive, applyBleed, EVADE_STACK_MAX,
  EVADE_STACK_TURNS, grantEvadeStack, consumeEvadeStack, accurateActive,
} = require("../characters/_universal_status");
const { NETRAMANA_KILL_CHANCE, netramanaActive } = require("../characters/_universal_status");
const Journey = require("../characters/_journey");
const { io } = require("./app");
const {
  ATTACKFX_TIME, ATTACK_TIME, BARD_BLOOD_FRAGILE, BARD_DIM_EVADE, BARD_DIM_FORTUNE,
  BARD_DIM_NOTES_PER_TURN, BARD_DIM_RESIST_TURNS, BARD_DIM_TURNS, BARD_FORTUNE_MAX,
  BARD_SECTION_MAX, BARD_SONGS, BARD_SOUL_PERFORM_DMG, BARD_SOUL_TARGETS,
  BLACK_SPARKLENCE_NURSE_COOLDOWN, DOOM_BALLISTA_TARGET_DMG, DOOM_CHARGE_CHANCE,
  DOOM_CRUCIBLE_ATK, DOOM_CRUCIBLE_BUST_BONUS, DOOM_CRUCIBLE_BUST_DMG, DOOM_CRUCIBLE_BUST_DRAWS,
  DOOM_CRUCIBLE_CHARGE_NEED, DOOM_DRAIN_DMG, DOOM_DRAIN_TURNS, DOOM_EXPLODE_DMG,
  DOOM_EXPLODE_TARGETS, DOOM_FORTUNE_CHANCE, DOOM_HEAL_ON_ATK, DOOM_LOCKON_BONUS,
  DOOM_LOCKON_CHANCE, DOOM_ROCKET_BONUS_DMG, DOOM_SHIELD_ON_ATK, DOOM_TIE_ATTACK_CHANCE,
  DOOM_WEAPONS, GOLD_MAX, GUTS_AMMO, GUTS_CHAA_TURNS, GUTS_GUN_PRICE, GUTS_NURSE_DMG, MAX_HP,
  OGURI_ENERGY_MAX, OGURI_GOLD_MAX, OGURI_ULT2_CHARGE_COST, OVERLOAD_FORCE_CHANCE,
  TAKUTO_APPRIVOISE_TURNS, TRANSFORMS,
} = require("./constants");
const match = require("./match");
const attack = require("./phases/attack");
const characterRules = require("./characterRules");
const combat = require("./combat");
const cutscene = require("./cutscene");
const dayNight = require("./dayNight");
const cardDeck = require("./deck");
const draw = require("./phases/draw");
const endTurnPhase = require("./phases/endTurn");
const lobby = require("./lobby");
const mercury = require("./modes/mercury");
const purge = require("./modes/purge");
const overload = require("./overload");
const qteSystem = require("./qte");
const shop = require("./shop");
const skills = require("./skills");
const timers = require("./timers");
const view = require("./view");

// ============================================================
//  engine — context object ที่ให้ characters/*.js เรียกกลับเข้ามาใช้ state/ฟังก์ชันร่วมของ server.js
//  (ตัวแปร gameState/lastAttack ฯลฯ เป็น let ในไฟล์นี้ — ต้องผ่าน getter/setter เพราะ
//   ส่งค่า primitive ตรงๆ ออกไปจะไม่ live-update เวลาไฟล์นี้ reassign ตัวแปรนั้นทีหลัง)
// ============================================================
Object.defineProperties(engine, Object.getOwnPropertyDescriptors({
  // Type Mercury / ORT (characters/ort.js)
  ortFx: mercury.ortFx,
  fortuneTargetList: cardDeck.fortuneTargetList,
  mercuryActive: mercury.mercuryActive,
  // Purge (server/modes/purge.js) — เปิดให้เทสต์อ่าน/สั่งได้
  purgeActive: purge.purgeActive,
  purgeAdvance: purge.purgeAdvance,
  purgeBeginRoll: purge.beginRollPhase,
  purgeRoll: purge.roll,
  purgeChoose: purge.choose,
  purgeUseItem: purge.useBoardItem,
  purgeOrtPhase: purge.ortPhase,
  purgeStateFor: purge.purgeStateFor,
  get purge() { return match.purge; },
  isOrt: mercury.isOrt,
  players: match.players,
  CHAR_BY_ID,
  CHAR_HOOKS,
  POSITION_COLORS,
  ATTACKFX_TIME,
  ATTACK_TIME,
  BARD_FORTUNE_MAX,
  BARD_SECTION_MAX,
  BARD_DIM_TURNS,
  BARD_DIM_RESIST_TURNS,
  BARD_DIM_FORTUNE,
  BARD_DIM_EVADE,
  BARD_BLOOD_FRAGILE,
  BARD_DIM_NOTES_PER_TURN,
  BARD_SOUL_TARGETS,
  BARD_SOUL_PERFORM_DMG,
  BARD_SONGS,
  TRANSFORMS,
  shikiCancelUltimate: combat.shikiCancelUltimate,
  SPELLBURDEN_MAX,
  TAKUTO_APPRIVOISE_TURNS,
  DOOM_WEAPONS,
  rollDoomWeapon: characterRules.rollDoomWeapon,
  DOOM_LOCKON_CHANCE,
  DOOM_EXPLODE_DMG,
  DOOM_EXPLODE_TARGETS,
  DOOM_LOCKON_BONUS,
  DOOM_CRUCIBLE_ATK,
  DOOM_ROCKET_BONUS_DMG,
  DOOM_BALLISTA_TARGET_DMG,
  DOOM_DRAIN_DMG,
  DOOM_DRAIN_TURNS,
  DOOM_SHIELD_ON_ATK,
  DOOM_FORTUNE_CHANCE,
  DOOM_CRUCIBLE_CHARGE_NEED,
  DOOM_HEAL_ON_ATK,
  DOOM_CHARGE_CHANCE,
  DOOM_TIE_ATTACK_CHANCE,
  OVERLOAD_FORCE_CHANCE,
  DOOM_CRUCIBLE_BUST_DMG,
  DOOM_CRUCIBLE_BUST_DRAWS,
  DOOM_CRUCIBLE_BUST_BONUS,
  oguriGoldStacks: characterRules.oguriGoldStacks,
  oguriChargeCapOf: characterRules.oguriChargeCapOf,
  oguriAshenReady: characterRules.oguriAshenReady,
  oguriAddEnergy: characterRules.oguriAddEnergy,
  oguriAddCharge: characterRules.oguriAddCharge,
  OGURI_ENERGY_MAX,
  OGURI_GOLD_MAX,
  OGURI_ULT2_CHARGE_COST,
  MAX_HP,
  maxHpOf: combat.maxHpOf,
  maxArmorOf: combat.maxArmorOf,
  maxSkillOf: combat.maxSkillOf,
  addSkill: combat.addSkill,
  drawCardFor: cardDeck.drawCardFor,
  onCardDrawn: cardDeck.onCardDrawn,
  drawToScore: cardDeck.drawToScore,
  get centralDeck() { return match.centralDeck; },
  drawFromCentralDeck: cardDeck.drawFromCentralDeck, // ไบรอัน N2O: ดึงการ์ด "ค่าที่ต้องการ" ออกจากกองกลางจริง (ผ่าน predicate)
  setCentralDeck(v) { match.centralDeck = v; },
  buildStateFor: view.buildStateFor, // เปิดให้เทสต์พิสูจน์ payload รายผู้ชมได้ (เช่น การปลอมตัวของโอเบรอน ที่ต้องต่างกันตามคนดู)
  get kaiOverhaulSlots() { return match.kaiOverhaulSlots; },
  setKaiOverhaulSlots(v) { match.kaiOverhaulSlots = v; },
  voidUltimateOnBust: combat.voidUltimateOnBust,
  sealActive: combat.sealActive,
  hasQueuedCutscene() { return match.cutsceneQueue.length > 0; },
  startQte: qteSystem.startQte,           // ระบบ QTE กลาง (ดูหัวข้อ QTE ด้านบนของไฟล์)
  clearQte: qteSystem.clearQte,
  qteKey: qteSystem.qteKey,             // เปิดไว้ให้เทสต์กดปุ่มแทนผู้เล่นได้ (โค้ดจริงเรียกจาก socket handler)
  recruitQteHit: characterRules.recruitQteHit, recruitQteDone: characterRules.recruitQteDone, recruitPick: characterRules.recruitPick, recruitPrep: characterRules.recruitPrep, // Recruit: เปิดไว้ให้เทสต์ (โค้ดจริงเรียกจาก socket handler)
  qtePending: qteSystem.qtePending,
  // drawCardFor / voidUltimateOnBust มีอยู่แล้วด้านล่าง — ไม่ต้องประกาศซ้ำ
  // ---------- ระบบย้อนเวลา (ท่าไม้ตายของอิสึกะ ชิโด) ----------
  snapshotBefore: overload.snapshotBefore,        // หยิบสแนปช็อตต้นเทิร์นของ N เทิร์นก่อนหน้า (ไม่ลึกพอ = ใบเก่าสุดที่มี)
  pushSnapshotHistory: overload.pushSnapshotHistory,   // เปิดไว้ให้เทสต์สร้างประวัติจำลองได้ (โค้ดจริงเรียกจาก dealRound เท่านั้น)
  applySnapshot: overload.applySnapshot,         // เขียนสภาพสนามทั้งหมดกลับไปเป็นของสแนปช็อตใบนั้น
  clearSnapshotHistory: overload.clearSnapshotHistory,  // ลบประวัติทิ้ง (อนาคตที่ถูกย้อนไปแล้วใช้ต่อไม่ได้)
  get roundSkills() { return match.roundSkills; }, // สกิลที่ถูกกดในเทิร์นนี้ (หลักสูตร "พิเศษ" ของไบเลธอ่านว่าใครกดระดับไหน)
  takumiBlackoutActive: characterRules.takumiBlackoutActive,
  doomWeaponMarkPending: characterRules.doomWeaponMarkPending,
  get gameState() { return match.gameState; },
  setGameState(v) { match.gameState = v; },
  get cutsceneInfo() { return match.cutsceneInfo; },
  get gameMode() { return match.gameMode; },
  setGameMode(v) { match.gameMode = v; },
  resetModeVotes: lobby.resetModeVotes,
  voteGameMode: lobby.voteGameMode,
  validGameMode: lobby.validGameMode,
  modeOptionsFor: lobby.modeOptionsFor,
  remainingTeamWinInfo: lobby.remainingTeamWinInfo,
  get winningTeamId() { return match.winningTeamId; },
  teamModeActive: lobby.teamModeActive,
  isAlly: lobby.isAlly, // ซัพพอร์ต: ตัดสินว่ามอบผลดี/เลือกเป็นเป้าหมายได้ไหม (ไม่ใช้ sameTeam — ดูคอมเมนต์ที่ตัวฟังก์ชัน)
  sameTeam: combat.sameTeam,
  friendlyEffectBlocked: combat.friendlyEffectBlocked,
  withEffectSource: combat.withEffectSource,
  // ต้นตอของเอฟเฟกต์ที่กำลังทำงานอยู่ (ตั้งโดย withEffectSource) — hook ที่ต้องรู้ว่า "ใครเป็นคนทำ"
  //  ในจังหวะที่ไม่มีพารามิเตอร์ผู้กระทำส่งมาให้ (เช่น adjustIncomingDamage) อ่านตรงนี้
  get effectSourceId() { return match.effectSourceId; },
  get roundNumber() { return match.roundNumber; },
  setRoundNumber(v) { match.roundNumber = v; },
  get cycleShift() { return match.cycleShift; },
  setCycleShift(v) { match.cycleShift = Number(v) || 0; }, // เทสต์ตั้งช่วงเวลาเองได้
  get attackerId() { return match.attackerId; },
  setAttackerId(v) { match.attackerId = v; },
  get lastAttack() { return match.lastAttack; },
  setLastAttack(v) { match.lastAttack = v; },
  attackableTargets: attack.attackableTargets,
  // ยูนะ ไอดอลประจำสนาม
  get yunaEffect() { return match.yunaEffect; },
  yunaBeatBarkActive: characterRules.yunaBeatBarkActive, // เกตจริงของ Break Beat Bark! (รวมกรณีที่ท่าไม้ตายเอจิบังคับเปิด) — เทสต์อ่านตรงนี้
  get yunaWindowEnd() { return match.yunaWindowEnd; },
  get yunaLongingUsed() { return match.yunaLongingUsed; },
  get yunaPity() { return match.yunaPity; },
  setYunaPity(v) { match.yunaPity = v; },
  setYunaTrigger({ effect, targetId, windowEnd }) { match.yunaEffect = effect; match.yunaTargetId = targetId; match.yunaWindowEnd = windowEnd; match.yunaMusicSeq++; },
  tryYunaLongingForTwin: combat.tryYunaLongingForTwin,
  pushCutsceneRaw(entry) { match.cutsceneQueue.push(entry); },
  log(msg) { match.lastLog.push(msg); },
  // การ์ดสกิลเด้งบนกระดาน (ไม่หยุดเกม) — payload.sound = คีย์ใน client/src/audio.js ให้เล่นพร้อมการ์ด
  skillFlash(payload) { io.emit("skillFlash", payload); },
  sfx(sound) { if (sound) io.emit("sfx", { sound }); }, // เสียงสั้นๆ ที่ทุกคนได้ยิน (ไม่มีป้าย) — เช่น โทโนะร้องตอนโดนตี
  // ผู้ลงมือของดาเมจก้อนนี้ติด "แม่นยำ" ไหม — ด่านหลบดาเมจจากสกิลของตัวละครต่างๆ (อิปโป/เอจิ/luminous) ใช้เช็ค
  sourceAccurate() { return !!match.effectSourceId && accurateActive(match.players[match.effectSourceId]); },
  accurateActive,
  journeyDotBonus() { return Journey.dotBonus(engine); },
  // อัตราคริเพิ่ม (%) ของผู้โจมตี = สนาม (อาณาจักรน้ำแข็ง กลางวัน) + บัฟคำสั่งขั้นเด็ดขาด (ไรเนส) — อ่านใน applyCrit ของอุซากิ/Kim
  critBonusFor(p) { return Journey.critBonus(engine) + CHAR_HOOKS.reines.critBonus(p) + CHAR_HOOKS.andersen.critBonus(p) + CHAR_HOOKS.takt.critBonus(p); }, // การเดินทาง (ป่าไม้ต้องสาป กลางคืน) — อ่านใน _universal_status.js
  journeyGiftItem: shop.journeyGiftItem,
  refreshShopForJourney: shop.refreshShopForJourney, // เทสต์: จำลองการขึ้นเทิร์นใหม่ของร้านค้า // การเดินทาง (ทุ่งดอกไม้ กลางวัน): สุ่มไอเทมฟรีราคาไม่เกิน 5
  colorOf(p) { return lobby.colorOf(p); },
  nextTransformCounter() { return ++match.transformCounter; },
  startMatch: lobby.startMatch,
  endTurn: endTurnPhase.endTurn,
  doAttack: attack.doAttack,
  useSkill: skills.useSkill,
  alivePlayers: combat.alivePlayers,
  isNightRound: dayNight.isNightRound,
  nightCycleIndex: dayNight.nightCycleIndex,
  GOLD_MAX,
  goldCapOf: shop.goldCapOf,
  addGold: shop.addGold,
  // ---------- ร้านค้ามายา (เปิดไว้ให้ tests/shop.test.js เรียกตรงๆ) ----------
  shopItemName: shop.shopItemName,
  grantInventoryItem: shop.grantInventoryItem,
  GUTS_AMMO,
  GUTS_GUN_PRICE,
  GUTS_CHAA_TURNS,
  GUTS_NURSE_DMG,
  BLACK_SPARKLENCE_NURSE_COOLDOWN,
  rollShopItem: shop.rollShopItem,
  openShop: shop.openShop,
  buyShopItem: shop.buyShopItem,
  useInventoryItem: shop.useInventoryItem,
  gutsFireTargetOf: shop.gutsFireTargetOf,
  applyGutsBullet: shop.applyGutsBullet,
  hasGutsGun: shop.hasGutsGun,
  hasBlackSparklence: shop.hasBlackSparklence,
  hasGutsWeapon: shop.hasGutsWeapon,
  hit: draw.hit,
  lock: draw.lock, // เปิดไพ่ (เทสต์ใช้ตรวจผลไพ่ครบชุดตอนเปิดไพ่)
  get shopItems() { return match.shopItems; },
  setShopItems(v) { match.shopItems = v; },
  NETRAMANA_KILL_CHANCE,
  netramanaActive,
  statusAmtOf,
  calculateScore: cardDeck.calculateScore,
  scoreCap: cardDeck.scoreCap,
  get overloadForceActive() { return match.overloadForceActive; },
  setOverloadForceActive(v) { match.overloadForceActive = !!v; },
  get overloadForceCount() { return match.overloadForceCount; },
  setOverloadForceCount(v) { match.overloadForceCount = Number(v) || 0; },
  triggerOverloadForce: overload.triggerOverloadForce,
  applyOverloadOverdrawPenalty: combat.applyOverloadOverdrawPenalty,
  applyBuff: rawApplyBuff,
  applyDebuff: combat.applyDebuff,
  applyPoison,     // "พิษร้าย" (สถานะ Universal): ดาเมจ 1/เทิร์น + พลังโจมตี -1 (เคารพต้านสถานะผิดปกติ)
  tickPoison,
  stripLatestBuff, // ปาดบัฟล่าสุดของเป้าหมายทิ้ง 1 ตัว (Rider Slash) — ทะเบียนบัฟอยู่ที่ _universal_status.js
  applyShock,      // "ช็อต" (สถานะ Universal): จุดเดียวที่ทุกตัวละครใช้ใส่สถานะนี้ (เคารพต้านสถานะผิดปกติ)
  tickShock,       // โรลต้นเทิร์น 15% -> สตั้น (เช็ค resist ตอนโรล ไม่ใช่ตอนแปะ)
  poisonAtkPenalty, // พลังโจมตีที่หายไปจากพิษ — computeAttackBase อ่านคู่กับ "อ่อนแอ"
  applyCurse,      // "คำสาป" (สถานะ Universal): จุดเดียวที่ทุกตัวละครใช้ใส่สถานะนี้ (เคารพต้านสถานะผิดปกติ)
  tickCurseOnSkill,
  MEND_MAX_TURNS,
  applyMend, // "เยียวยา" (สถานะ Universal): จุดเดียวที่ทุกตัวละครใช้ใส่สถานะนี้ (เคารพเพดานเทิร์น)
  tickMend,
  blindActive,
  // มหาเทพ อรชุน (Mahapralaya): พลังโจมตีปกติที่ attacker จะฟาดใส่ target ได้ — ใช้ท่อเดียวกับคอนเนอร์
  attackPowerAgainst: attack.estimateAttackOn,
  // ผู้วิงวอน: เอฟเฟกต์ gif ทับไอคอนผู้เล่น (ระบบใหม่ patch 3.4) — kind = คีย์ใน CHAR_HOOKS.the_supplicant.FX
  iconFx: attack.iconFx,
  setTurnsNoRefresh,
  applySpellburden: combat.applySpellburden,
  cleanseDebuffs,
  cleanseOneStep,
  cleanseLatestDebuff,
  coolReduction,
  BASIC_DEBUFF_CLEAR,
  SOFT_DEBUFF_STEP,
  noHealActive,
  invertActive,
  HBLEED_MAX,
  bleedActive,
  applyBleed, // "เลือดไหล" (สถานะ Universal): จุดเดียวที่ทุกตัวละครใช้ใส่สถานะนี้ (เคารพต้านสถานะ + เพดาน)
  EVADE_STACK_MAX,
  EVADE_STACK_TURNS,
  grantEvadeStack,
  consumeEvadeStack,
  healHp: combat.healHp,
  healArmor: combat.healArmor,
  healOverflow: combat.healOverflow,
  loseHp: combat.loseHp,
  loseArmor: combat.loseArmor,
  dealDirect: combat.dealDirect,
  dealMixed: combat.dealMixed,
  dealArmorOnly: combat.dealArmorOnly,
  damageSoft: combat.damageSoft,
  instantDeath: combat.instantDeath,
  displayImg: view.displayImg,
  passiveSealed: characterRules.passiveSealed,
  killSealed: characterRules.killSealed,
  resistActive,
  maybeWakeKotone: characterRules.maybeWakeKotone,
  maybeBeatSave: combat.maybeBeatSave,
  maybeBeatMode: combat.maybeBeatMode,
  resolveDamageAftermath: combat.resolveDamageAftermath,
  bustedOf: cardDeck.bustedOf,
  scoreOf: cardDeck.scoreOf,
  shikiGiveLifeline: characterRules.shikiGiveLifeline,
  clearWitherLines: characterRules.clearWitherLines,
  hasKillCapability: characterRules.hasKillCapability,
  miyakoKillChance: characterRules.miyakoKillChance,
  miyakoSurvivedKillAttempt: characterRules.miyakoSurvivedKillAttempt,
  appleGuyDodgesKill: characterRules.appleGuyDodgesKill,
  satoruOnTargeted: characterRules.satoruOnTargeted,
  queueCutscene: cutscene.queueCutscene,
  triggerCutscene: cutscene.triggerCutscene,
  notifyTransform: cutscene.notifyTransform,
  runCutsceneQueue: cutscene.runCutsceneQueue,
  pausePlayingForCutscene: cutscene.pausePlayingForCutscene,
  startPhaseTimer: timers.startPhaseTimer,
  clearPhaseTimer: timers.clearPhaseTimer,
  reduceCardTimer: timers.reduceCardTimer, // เอจิ สกิลติดตัว 1: บีบเวลาที่เหลือของเฟสจั่วการ์ด
  broadcastState: view.broadcastState,
  checkAllLocked: draw.checkAllLocked,
}));
