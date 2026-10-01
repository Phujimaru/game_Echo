// QTE (Quick Time Event) กลาง
// export ก่อน require: ไฟล์ใน server/ require วนกันเอง — function declaration ถูก hoist จึงพร้อมใช้ตั้งแต่บรรทัดแรก
Object.assign(module.exports, {
  startQte, clearQte, qtePending, qteKey, qteTimeout, sweepQte,
});

const CHAR_HOOKS = require("../characters/index");
const match = require("./match");
const { engine } = require("./engine");
const combat = require("./combat");
const cutscene = require("./cutscene");
const draw = require("./phases/draw");
const view = require("./view");

// ============================================================
//  QTE (Quick Time Event) — ระบบกลาง ใช้ร่วมกันได้ทุกตัวละคร
//  ออกแบบให้ "ไม่มี timer ฝั่ง server เลย" โดยตั้งใจ:
//    · startPhaseTimer มีตัวเดียวทั้งเกมและถูกล้างทุกครั้งที่เปลี่ยนเฟส จะเอามาใช้ซ้อนไม่ได้
//    · setTimeout ต่อ QTE = มีโอกาสค้างเมื่อผู้เล่นหลุด/จบเทิร์น/กลับล็อบบี้
//  จึงเก็บแค่ "เส้นตาย" (deadline เป็น ms) แล้วตัดสินตอนคำตอบมาถึงแทน — เวลายังเป็นของ server เต็มร้อย
//  (client วิ่งแถบนับถอยหลังเองเพื่อความลื่น แต่โกงไม่ได้: ลำดับปุ่มถูกสุ่มและตรวจที่ server)
//
//  p.qte = { keys, idx, deadline, perNoteMs, tag }
//    tag = ใครเป็นเจ้าของ QTE นี้ — ใช้เลือกว่าจะเรียก callback ของตัวละครไหนตอนจบ
//  ผลลัพธ์ส่งกลับผ่าน CHAR_HOOKS[<เจ้าของ>].onQteDone(engine, p, ok, qte)
// ============================================================
const QTE_KEYS = ["w", "a", "s", "d"];
function startQte(p, { count, perNoteMs = 2000, tag }) {
  const keys = Array.from({ length: count }, () => QTE_KEYS[Math.floor(Math.random() * QTE_KEYS.length)]);
  p.qte = { keys, idx: 0, perNoteMs, deadline: Date.now() + perNoteMs, tag };
  return p.qte;
}
function clearQte(p) { if (p) p.qte = null; }
// มี QTE ค้างอยู่ไหม — checkAllLocked() ใช้กันไม่ให้สรุปรอบก่อนเจ้าตัวจะเล่นจบ
function qtePending() {
  return combat.alivePlayers().some((p) => p.qte);
}
// จบ QTE แล้วส่งผลให้เจ้าของ (ok = ผ่านครบทุกตัว)
//  เจ้าของ QTE มักคิววีดีโอ "สำเร็จ/ล้มเหลว" ไว้ใน onQteDone — ต้องสั่งเล่นทันทีตรงนี้
//  ไม่งั้นคลิปจะค้างอยู่ในคิวไปโผล่ตอนจบรอบ (คนละจังหวะกับที่ผู้เล่นเพิ่งกดจบ)
//  pausePlayingForCutscene() พักเฟสจั่วไพ่แล้วคืนเวลาที่เหลือให้เมื่อคลิปจบ — แพทเทิร์นเดียวกับ useSkill()
function finishQte(p, ok) {
  const qte = p.qte;
  if (!qte) return;
  p.qte = null;
  const hook = CHAR_HOOKS[qte.tag];
  if (hook && hook.onQteDone) combat.withEffectSource(p, () => hook.onQteDone(engine, p, ok, qte));
  if (match.gameState === "PLAYING" && match.cutsceneQueue.length) cutscene.pausePlayingForCutscene();
}
// ผู้เล่นกดปุ่ม — ตรวจทั้ง "ตัวถูกไหม" และ "มาทันไหม" ที่ server
function qteKey(id, key) {
  const p = match.players[id];
  if (!p || !p.alive || !p.qte) return;
  const qte = p.qte;
  const late = Date.now() > qte.deadline;
  const wrong = String(key || "").toLowerCase() !== qte.keys[qte.idx];
  if (late || wrong) {
    match.lastLog.push(`🎸 ${p.name} ${late ? "กดไม่ทันจังหวะ" : "กดผิดตัว"} — QTE ล้มเหลว!`);
    finishQte(p, false);
    view.broadcastState();
    draw.checkAllLocked();
    return;
  }
  qte.idx++;
  if (qte.idx >= qte.keys.length) { finishQte(p, true); }
  else qte.deadline = Date.now() + qte.perNoteMs; // ตัวถัดไปเริ่มนับใหม่
  view.broadcastState();
  draw.checkAllLocked();
}
// client แจ้งว่านับถอยหลังหมดแล้ว — server ยังตรวจซ้ำเองว่าเลยเส้นตายจริง (กันแจ้งมั่ว)
function qteTimeout(id) {
  const p = match.players[id];
  if (!p || !p.qte || Date.now() <= p.qte.deadline) return;
  match.lastLog.push(`🎸 ${p.name} กดไม่ทันจังหวะ — QTE ล้มเหลว!`);
  finishQte(p, false);
  view.broadcastState();
  draw.checkAllLocked();
}
// ตาข่ายสำรอง: หมดเฟสจั่วไพ่แล้วยังเล่นไม่จบ = ถือว่าพลาด (เหมือนข้อเสนออื่นที่ไม่ตอบ)
function sweepQte() {
  for (const p of combat.alivePlayers()) if (p.qte) finishQte(p, false);
}
