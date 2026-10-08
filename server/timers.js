// ตัวจับเวลาเฟส + Clock Up + เวลาเฟสจั่วไพ่
// export ก่อน require: ไฟล์ใน server/ require วนกันเอง — function declaration ถูก hoist จึงพร้อมใช้ตั้งแต่บรรทัดแรก
Object.assign(module.exports, {
  clearPhaseTimer, startPhaseTimer, eijiUltFieldActive, syncClockUpPhaseTime, takeClockUpResume,
  cardPhaseSeconds, reduceCardTimer,
});

const CHAR_HOOKS = require("../characters/index");
const { io } = require("./app");
const { CARD_TIME, RESYNC_EVERY } = require("./constants");
const match = require("./match");
const { engine } = require("./engine");
const view = require("./view");

function clearPhaseTimer() {
  if (match.phaseTimerId) clearInterval(match.phaseTimerId);
  match.phaseTimerId = null;
}
function startPhaseTimer(seconds, onExpire) {
  clearPhaseTimer();
  match.timeLeft = seconds;
  match.currentPhaseOnExpire = onExpire;
  match.phaseTimerId = setInterval(() => {
    match.timeLeft--;
    if (match.timeLeft <= 0) { clearPhaseTimer(); onExpire(); }
    // ทุกวินาที client ต้องการแค่ตัวเลขนับถอยหลัง — ส่ง "tick" (ไม่กี่ไบต์) แทน state ตัวเต็ม
    //  (state ตัวเต็มมีคำอธิบายสกิลของผู้เล่นทุกคน ~10 KB/คน = bandwidth มหาศาลถ้ายิงทุกวินาที)
    //  ยังคง broadcast ตัวเต็มทุก ๆ RESYNC_EVERY วิ เป็นตาข่ายกันเหนียว เผื่อมีจุดไหนแก้ state
    //  แล้วลืมเรียก broadcastState() เอง (เดิมตัวจับเวลากลบให้ภายใน 1 วิ)
    else if (match.timeLeft % RESYNC_EVERY === 0) view.broadcastState();
    else io.emit("tick", match.timeLeft);
  }, 1000);
}
// เอจิ (patch 2.4 new): มีคนกดท่าไม้ตาย "ไม่ว่ายังก็ตาม" ค้างอยู่ไหม — ใช้บีบเวลาเฟสจั่วการ์ด
//  และกันไม่ให้ยูนะเกิดขึ้นเองแบบปกติระหว่างท่านี้ทำงาน
function eijiUltFieldActive() {
  return Object.values(match.players).some((p) => p.alive && CHAR_HOOKS.eiji.ultActive(p));
}
// เวลาของเฟสจั่วการ์ดในเทิร์นนี้ (ปกติ CARD_TIME · ระหว่าง Break Beat Bark! ของเอจิเหลือ 40 วิ)
function normalCardSeconds() {
  return eijiUltFieldActive() ? CHAR_HOOKS.eiji.ULT_CARD_TIME : CARD_TIME;
}
// Clock Up เปิด/ปิด "กลางเฟสจั่วไพ่" — ต้องแก้เวลาที่เหลือของเทิร์นนั้นด้วย
//  ⚠️ cardPhaseSeconds() มีผลแค่ตอนขึ้นเทิร์นใหม่ ส่วน pausePlayingForCutscene() จะคืนเวลาที่เหลือ
//  "ก่อนเล่นคลิป" ให้หลังคลิปจบ — ถ้าไม่เซ็ต timeLeft ตรงนี้ เทิร์นที่กดเปิดนาฬิกาจะเดินต่อตามเดิม
//  (แพทเทิร์นเดียวกับ reduceCardTimer ของเอจิ ที่แก้ timeLeft ตรงๆ เหมือนกัน)
//  ⚠️ ต้องตัดสินจาก "สนามยังถูกแช่อยู่ไหม" ไม่ใช่ "ไรเดอร์คนที่เพิ่งกดเปิด/ปิด"
//  ไม่งั้นพอไรเดอร์สองคนเปิด Clock Up ซ้อนกัน พอคนหนึ่งกดปิด เวลาจะเด้งกลับมา  10 วิ
//  ทั้งที่อีกคนยังแช่สนามอยู่ (บัคที่เจอจริงตอนไรเดอร์สองคนสู้กัน)
function syncClockUpPhaseTime() {
  if (match.gameState !== "PLAYING") return;
  const Z = CHAR_HOOKS.daisuke;
  if (Z.freezeHosts(engine).length) {
    // เพิ่งเริ่มแช่ (ไม่ใช่ไรเดอร์คนที่สองเปิดซ้อน): จำเวลาที่เหลือไว้ก่อน แล้วเวลาหยุดในสายตาผู้เล่น
    if (match.clockUpResumeSeconds == null) match.clockUpResumeSeconds = Math.max(1, match.timeLeft);
    match.timeLeft = Z.CLOCK_UP_SAFETY;
  } else {
    match.timeLeft = takeClockUpResume(); // คลายหมดแล้ว: เดินต่อจากเวลาที่เหลือตอนกด
  }
}
// เวลาที่ต้องคืนตอนคลาย Clock Up แล้วล้างค่าที่จำไว้ (ไม่มีค่า = เวลาเต็มของเฟสจั่วไพ่)
function takeClockUpResume() {
  const s = match.clockUpResumeSeconds != null ? match.clockUpResumeSeconds : normalCardSeconds();
  match.clockUpResumeSeconds = null;
  return s;
}
function cardPhaseSeconds() {
  // คาซามะ ไดสุเกะ (Clock Up): "เวลาหยุด" = ตั้งเวลายาวมากไว้เป็นตาข่ายกันห้องค้าง
  //  แล้วให้ฝั่ง client ไม่โชว์เป็นนาฬิกา
  //  ห้าม clearPhaseTimer() ทิ้งเฉยๆ ไม่งั้นไดสุเกะหลุดเน็ตแล้วห้องจะค้างถาวร
  const clockUp = CHAR_HOOKS.daisuke.cardPhaseSeconds(engine);
  // แช่ตั้งแต่ต้นเทิร์น: คลายเมื่อไหร่ได้เวลาเต็มของเฟสจั่วไพ่ (นับตั้งแต่ไรเดอร์เปิดไพ่)
  match.clockUpResumeSeconds = clockUp ? normalCardSeconds() : null;
  if (clockUp) return clockUp;
  return normalCardSeconds();
}
// เอจิ สกิลติดตัว 1: บีบเวลาที่เหลือของเฟสจั่วการ์ดลง n วินาที (เหลืออย่างน้อย 1 วิ) — คืนเวลาที่เหลือจริง
function reduceCardTimer(n) {
  if (match.gameState !== "PLAYING" || !(n > 0)) return match.timeLeft;
  match.timeLeft = Math.max(1, match.timeLeft - n);
  return match.timeLeft;
}
