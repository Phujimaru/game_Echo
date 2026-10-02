// สัญญาณ "ถึงเวลาพุ่งลงสนาม" ระหว่างฉากลูกโลกกับสนาม 2.5D
//  เปลี่ยนภูมิภาค: server ส่งภูมิภาคใหม่มาตั้งแต่ฉากเดินทาง (RegionTravel) เริ่ม — ถ้าสนามพุ่งลงทันที จะเล่นจบใต้ลูกโลกพอดี
//  จึงให้สนามรอ requestArenaLand() ที่ RegionTravel ยิงตอนชนผิวโลก (ใต้แฟลช) แล้วค่อยพุ่งลง
//  announceArenaLand() = สนามเริ่มพุ่งลงแล้ว (Game.jsx ใช้ให้การ์ดผู้เล่นหล่นลงที่นั่งใหม่)

const requests = new Set();
const lands = new Set();
let landSeq = 0;

export function requestArenaLand() {
  requests.forEach((fn) => fn());
}

export function onArenaLandRequest(fn) {
  requests.add(fn);
  return () => requests.delete(fn);
}

export function announceArenaLand() {
  landSeq += 1;
  lands.forEach((fn) => fn(landSeq));
}

export function onArenaLand(fn) {
  lands.add(fn);
  return () => lands.delete(fn);
}
