// Echo "นี่มันเกมของฉัน": ตีฟรี (โจมตีปกติ) ช่วงจั่วไพ่ — เฟสโจมตีย่อยที่แทรกกลาง PLAYING แล้วคืนกลับ
// export ก่อน require: ไฟล์ใน server/ require วนกันเอง — function declaration ถูก hoist จึงพร้อมใช้ตั้งแต่บรรทัดแรก
Object.assign(module.exports, {
  freeHitActive, pickFreeHit, startFreeHit, finishFreeHit, runPendingBeforeReveal, runPendingOnLock,
});

// ---------- ทำไมเป็น "เฟสย่อย" ไม่ใช่แยกแกนดาเมจออกจาก doAttack (ตัวเลือก ข ในแผน) ----------
//  doAttack() มีทางออกกลางฟังก์ชัน ~20 ทาง (หลบหลีก/ลบล้าง/สะท้อน/ดูดซับ/สังหารทันที/ขัดจังหวะ ฯลฯ) และฮุคของ
//  ตัวละครหลายตัว (eiji/ippo/phenex/bat_ben/ort ...) ตั้ง ATTACKING + ตัวจับเวลา -> endTurn เองข้างในโมดูลของตัวเอง
//  การแยกแกนดาเมจที่ไม่แตะเฟส (ตัวเลือก ก) จึงต้องรื้อทุกฮุคพวกนั้น — เสี่ยงกว่ามาก
//  ทางที่ใช้: ตั้ง ATTACK ชั่วคราว (attackerId = Echo) แล้วเรียก doAttack ตัวจริง -> ทุกเส้นทางของ doAttack จบที่
//  postAttackFollowup() หรือ endTurn() เสมอ ทั้งสองจุดมีด่าน `match.echoFreeHit` อยู่บนสุด -> finishFreeHit()
//  คืนเฟส PLAYING + เวลาที่เหลือ (หรือไปต่อที่ resolveRound/lock ตามที่เรียกมา) แทนการไปโจมตีซ้ำ/จบเทิร์น
//  ระหว่างเฟสย่อย gameState = ATTACK/ATTACKING/CUTSCENE -> คนอื่นจั่ว/กดสกิล/เปิดไพ่ไม่ได้ (แบบพักเฟสดูคัตซีน)
//  และฉากสรุปการโจมตีบน client เล่นได้ตามปกติ (state.attack ส่งเฉพาะตอน ATTACKING)

const CHAR_HOOKS = require("../../characters/index");
const match = require("../match");
const { engine } = require("../engine");
const attack = require("./attack");
const combat = require("../combat");
const draw = require("./draw");
const mercury = require("../modes/mercury");
const summary = require("./summary");
const timers = require("../timers");
const view = require("../view");

const E = () => CHAR_HOOKS.echo_queen;

function freeHitActive() { return !!match.echoFreeHit; }

// กลับเข้าเฟสจั่วไพ่ด้วยเวลาที่เหลือตอนเริ่มตีฟรี (แบบ pausePlayingForCutscene)
//  คืน false = เกมจบไปแล้ว (Raid: ORT ตาย) ไม่ต้องทำอะไรต่อ
function resumePlaying(fh, skipCheck) {
  if (mercury.checkOrtEarlyWin()) return false;
  timers.startPhaseTimer(fh.resume, summary.resolveRound);
  view.broadcastState();
  if (!skipCheck) draw.checkAllLocked();
  return true;
}

// socket "echoFreeHit": Echo เลือกเป้าเอง -> ตีทันที (ช่วงจั่วไพ่)
function pickFreeHit(id, targetId) {
  const p = match.players[id];
  if (match.gameState !== "PLAYING" || match.echoFreeHit || !p || !p.alive || p.locked) return false;
  // ถูกแช่ทั้งสนาม (Clock Up / THE WORLD / นอกวงไล่ล่า/แข่ง/ดวล) = กดอะไรไม่ได้ เหมือนปุ่มอื่น
  if (CHAR_HOOKS.daisuke.actionBlocked(engine, p) || CHAR_HOOKS.dio.actionBlocked(engine, p)
    || CHAR_HOOKS.conner.actionBlocked(engine, p) || CHAR_HOOKS.brian.actionBlocked(engine, p)) return false;
  if (!E().freeHitPending(engine, p)) return false;
  const t = E().validTarget(engine, p, targetId);
  if (!t) return false;
  return startFreeHit(p, t.id, (fh) => resumePlaying(fh));
}

// then(fh): งานหลังตีฟรีจบ (คืนเฟสจั่วไพ่ / เปิดไพ่ต่อ / สรุปรอบต่อ)
function startFreeHit(p, targetId, then) {
  E().markFreeHit(engine, p, targetId);
  match.echoFreeHit = { echoId: p.id, then, resume: Math.max(3, match.timeLeft || 0), prevAttackerId: match.attackerId };
  timers.clearPhaseTimer();
  match.lastLog.push(`♛ ${p.name} นี่มันเกมของฉัน — ตีฟรีใส่ ${(match.players[targetId] || {}).name || "?"}`);
  match.gameState = "ATTACK";
  match.attackerId = p.id;
  attack.doAttack(p.id, targetId);
  // doAttack ปฏิเสธเป้า (เช่น เป้าได้อมตะกลางทาง) — ไม่มีอะไรเกิดขึ้น คืนเฟสทันที
  if (match.echoFreeHit && match.gameState === "ATTACK") finishFreeHit();
  return true;
}

// เรียกจากหัว endTurn() / postAttackFollowup() — คืน true = เฟสย่อยของตีฟรีจบที่นี่ (ผู้เรียกต้อง return)
function finishFreeHit() {
  const fh = match.echoFreeHit;
  if (!fh) return false;
  match.echoFreeHit = null;
  timers.clearPhaseTimer();
  match.attackerId = fh.prevAttackerId || null;
  match.gameState = "PLAYING";
  // สวนกลับที่จองไว้ระหว่างหมัด (ORT / Kim / ไททัน) + รางวัล luminous — แบบเดียวกับหัว endTurn
  draw.flushOrtCounters();
  CHAR_HOOKS.producer_lumi.flushBurst(engine);
  // ตีปกติไม่ตัดสินความตายเอง (ปกติกวาดท้าย endTurn) — ช่วงจั่วไพ่ต้องกวาดตรงนี้
  //  ไม่ห่อ effectSource: ผู้สังหารอ่านจาก lastDamageSourceId (Echo การกลืนกิน / ORT วิวัฒนาการ)
  for (const q of Object.values(match.players)) {
    if (q.alive && q.hp <= 0) {
      combat.instantDeath(q);
      if (!q.alive) match.lastLog.push(`💀 ${q.name} เลือดจริงหมด ตกรอบ!`);
    }
  }
  fh.then(fh);
  return true;
}

// ไม่เลือกเป้าก่อนเปิดไพ่ = สุ่มเป้าแล้วตีให้ — เรียกจากหัว resolveRound() (ครอบทั้งหมดเวลาและ checkAllLocked)
//  cont = ฟังก์ชันที่ต้องเรียกต่อหลังตีฟรีจบ (resolveRound เอง) · คืน true = เริ่มตีฟรีแล้ว ผู้เรียกต้อง return
function runPendingBeforeReveal(cont) {
  if (match.gameState !== "PLAYING" || match.echoFreeHit) return false;
  for (const p of combat.livingPlayers()) {
    if (!E().freeHitPending(engine, p)) continue;
    const t = E().randomTarget(engine, p);
    if (!t) { E().markFreeHit(engine, p, null); continue; }
    match.lastLog.push(`♛ ${p.name} ไม่ได้เลือกเป้าตีฟรี — สุ่มได้ ${t.name}`);
    return startFreeHit(p, t.id, () => cont());
  }
  return false;
}

// Echo กดเปิดไพ่ทั้งที่ยังไม่ได้ตีฟรี = สุ่มเป้าแล้วตีก่อน แล้วค่อยเปิดไพ่ต่อ — คืน true = ผู้เรียกต้อง return
function runPendingOnLock(p) {
  if (match.gameState !== "PLAYING" || match.echoFreeHit || !E().freeHitPending(engine, p)) return false;
  const t = E().randomTarget(engine, p);
  if (!t) { E().markFreeHit(engine, p, null); return false; }
  match.lastLog.push(`♛ ${p.name} ไม่ได้เลือกเป้าตีฟรี — สุ่มได้ ${t.name}`);
  return startFreeHit(p, t.id, (fh) => { if (resumePlaying(fh, true)) draw.lock(p.id); });
}
