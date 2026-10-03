// คิวคัตซีน/วีดีโอแปลงร่าง
// export ก่อน require: ไฟล์ใน server/ require วนกันเอง — function declaration ถูก hoist จึงพร้อมใช้ตั้งแต่บรรทัดแรก
Object.assign(module.exports, {
  triggerCutscene, queueCutscene, notifyTransform, pausePlayingForCutscene, runCutsceneQueue,
});

const { io } = require("./app");
const { TRANSFORMS } = require("./constants");
const match = require("./match");
const combat = require("./combat");
const draw = require("./phases/draw");
const lobby = require("./lobby");
const mercury = require("./modes/mercury");
const summary = require("./phases/summary");
const timers = require("./timers");
const view = require("./view");

// ============================================================
//  cutscene
// ============================================================
// ครั้งแรกต่อเกม/ต่อคน = เล่นวีดีโอเต็ม (หยุดกระดาน), ครั้งต่อไป = แค่การ์ดแจ้งเตือนเล็กๆ ไม่หยุดเกม
function triggerCutscene(p, key) {
  // ท่าที่ไม่มีวีดีโอ (มีแต่ภาพ+เพลง เช่น kready ของโคโตเนะ) = แจ้งเตือนบนกระดานอย่างเดียว ไม่ตัดเข้าเฟส CUTSCENE
  if (!TRANSFORMS[key] || !TRANSFORMS[key].video) { notifyTransform(p, key); return; }
  if (p.cutsceneShown[key]) notifyTransform(p, key);
  else { p.cutsceneShown[key] = true; queueCutscene(p, key); }
}
// onlyFor (ไม่บังคับ): array ของ playerId ที่ "เห็นวีดีโอนี้" — คนอื่นยังหยุดรอตามจังหวะเดียวกัน
//  แต่ buildStateFor จะไม่ส่ง cutscene ให้ (client จึงวาดกระดานตามปกติแทนที่จะเล่นคลิป)
//  ใช้กับคลิปที่เป็นเรื่องส่วนตัวของผู้เล่นบางคน เช่น "ครูฝึกสุดเหี้ยม" ของดันที่ด่าเฉพาะคนที่ไพ่แตก
function queueCutscene(p, key, onlyFor) {
  const t = TRANSFORMS[key];
  if (!t || !t.video) return;
  match.cutsceneQueue.push({
    seconds: t.seconds,
    info: {
      playerId: p.id, name: p.name,
      img: t.img, color: lobby.colorOf(p),
      video: t.video, title: t.title, label: t.label, voice: t.voice || null,
      noIntro: !!t.noIntro, // true = ตัดการ์ดเปิดตัว 950ms ทิ้ง เข้าวีดีโอทันที (คลิปสั้นมาก)
      onlyFor: Array.isArray(onlyFor) && onlyFor.length ? [...onlyFor] : null,
    },
  });
}
// การ์ดแจ้งเตือนเล็กๆ (ครั้งที่ 2 เป็นต้นไป): ส่งทันทีแบบเดียวกับ skillFlash — ไม่ตัดเข้าเฟส CUTSCENE
// ไม่หยุดเวลา/กระดาน แค่บอกว่าใครใช้ท่าอะไรซ้ำ
//  onlyFor (ไม่บังคับ): array ของ playerId ที่เห็นการ์ดนี้ (แบบเดียวกับ queueCutscene) — คนอื่นไม่ได้รับ event เลย
function notifyTransform(p, key, onlyFor) {
  const t = TRANSFORMS[key];
  if (!t) return;
  const payload = {
    playerId: p.id, name: p.name,
    img: t.img, color: lobby.colorOf(p),
    title: t.title, label: t.label,
  };
  if (Array.isArray(onlyFor)) { for (const id of onlyFor) io.to(id).emit("transformNotice", payload); return; }
  io.emit("transformNotice", payload);
}
// พักช่วงจั่วการ์ดไว้ เล่น cutscene ให้จบ แล้วกลับมาจั่วต่อด้วยเวลาที่เหลือ
// (ใช้กับสกิลที่แปลงร่างทันทีก่อนเปิดไพ่ เช่น MonsterLive)
// after (ไม่บังคับ): งานที่ต้องทำ "หลังวีดีโอจบ" ก่อนกลับเข้าเฟสจั่วไพ่ — ใช้กับกระสุน GUTS Select
//  ที่ต้องเล่นวีดีโอก่อนแล้วค่อยให้ผลเสียหาย/สถานะโผล่บนกระดาน (ไม่ใช่ลดเลือดไปตั้งแต่ก่อนวีดีโอเล่น)
function pausePlayingForCutscene(after) {
  const remain = Math.max(3, match.timeLeft);
  const targets = match.explicitTargetIds, actor = match.explicitActorId; // ผลที่ลงหลังวีดีโอจบ ยังนับเป้าที่ผู้เล่นเลือกไว้ตอนกด
  timers.clearPhaseTimer();
  runCutsceneQueue(() => {
    if (after) combat.withExplicitTargets(actor, targets ? [...targets] : [], after);
    draw.flushOrtCounters(); // ดาเมจที่ลงหลังวีดีโอจบ (ท่าที่ "วีดีโอก่อน แล้วค่อยเกิดความเสียหาย") ก็ทำให้ ORT สวนกลับได้
    match.gameState = "PLAYING";
    if (mercury.checkOrtEarlyWin()) return;
    timers.startPhaseTimer(remain, summary.resolveRound);
    view.broadcastState();
    draw.checkAllLocked();
  });
}
function runCutsceneQueue(onDone) {
  if (match.cutsceneQueue.length === 0) { match.cutsceneInfo = null; onDone(); return; }
  const c = match.cutsceneQueue.shift();
  match.cutsceneInfo = { ...c.info, id: ++match.cutsceneSeq }; // id ใหม่ทุกครั้ง -> client remount วีดีโอ
  match.gameState = "CUTSCENE";
  timers.startPhaseTimer(c.seconds, () => runCutsceneQueue(onDone));
  view.broadcastState();
}
