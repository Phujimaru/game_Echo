// สัญญาณ "ถึงเวลาพุ่งลงสนาม" ระหว่างฉากลูกโลกกับสนาม 2.5D
//  เปลี่ยนภูมิภาค: server ส่งภูมิภาคใหม่มาตั้งแต่ฉากเดินทาง (RegionTravel) เริ่ม — ถ้าสนามพุ่งลงทันที จะเล่นจบใต้ลูกโลกพอดี
//  จึงให้สนามรอ requestArenaLand() ที่ RegionTravel ยิงตอนชนผิวโลก (ใต้แฟลช) แล้วค่อยพุ่งลง
//  announceArenaLand() = สนามเริ่มพุ่งลงแล้ว (Game.jsx อ่านผ่าน useSyncExternalStore ให้การ์ดผู้เล่นหล่นลงที่นั่งใหม่)
//
//  กันจอกระพริบ (5.1.10): คัตซีนสกิลแทนกระดานทั้งจอ → กระดาน+สนาม mount ใหม่ทุกครั้งที่จบคัตซีน
//   ถ้าสนามพุ่งลงซ้ำ (ม่านฟ้าขาวทึบ) ทุกครั้ง = จอกระพริบไม่หยุด → จำภูมิภาคล่าสุดไว้ระดับโมดูล mount ใหม่ในภูมิภาคเดิมไม่พุ่งซ้ำ

const requests = new Set();
const lands = new Set();
let landSeq = 0;
let landAt = -1e9;
let lastArea = 0;
let lastSeenAt = -1e9;

const REMOUNT_GRACE_MS = 120000; // กระดานหายไปไม่เกินเท่านี้ (คัตซีน/ม่าน) แล้วกลับมาภูมิภาคเดิม = ไม่พุ่งซ้ำ

export function requestArenaLand() {
  requests.forEach((fn) => fn());
}

export function onArenaLandRequest(fn) {
  requests.add(fn);
  return () => requests.delete(fn);
}

export function announceArenaLand() {
  landSeq += 1;
  landAt = performance.now();
  lands.forEach((fn) => fn(landSeq));
}

export function onArenaLand(fn) {
  lands.add(fn);
  return () => lands.delete(fn);
}

export function getArenaLandSeq() {
  return landSeq;
}

/** วินาทีที่เหลือก่อนถึงจังหวะ `atSec` (นับจากเริ่มพุ่งลงล่าสุด) — เลยมาแล้ว (กระดาน mount ใหม่หลังคัตซีน) = null ไม่ต้องเล่นซ้ำ */
export function arenaLandDelay(atSec) {
  const left = atSec - (performance.now() - landAt) / 1000;
  return left > -0.3 ? Math.max(0, left) : null;
}

/** สนาม mount: ควรพุ่งลงไหม (ไม่ใช่การกลับมาที่ภูมิภาคเดิมหลังคัตซีน) */
export function shouldLandOnMount(area) {
  return !(area === lastArea && performance.now() - lastSeenAt < REMOUNT_GRACE_MS);
}

/** สนามบอกว่ากำลังแสดงภูมิภาคไหนอยู่ (เรียกตอนเปลี่ยน/ถอด) */
export function noteArenaShown(area) {
  lastArea = area;
  lastSeenAt = performance.now();
}
