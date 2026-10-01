// ส่งต่อ "ภาพโปรไฟล์ตัวละคร" ข้ามหน้า (เลือกตัวละคร → ห้องรอ) เพื่อทำทรานซิชันแบบภาพเดียวไหลต่อเนื่อง
//  หน้าเลือกตัว: ตอนกดยืนยัน เรียก setHeroHandoff({ img, rect }) ด้วยตำแหน่ง/ขนาดภาพบนจอ (getBoundingClientRect)
//  หน้าห้องรอ: ตอน mount เรียก takeHeroHandoff() — ได้ข้อมูลครั้งเดียว (ถ้ายังไม่เก่าเกิน) แล้ววาดภาพลอย
//   จาก rect เดิมไปลงที่ตราโปรไฟล์ของเรา (FLIP) ระหว่างที่ลูกโลกร่วมเลื่อนไปตำแหน่งของห้องรอ
let pending = null;

/** @param {{ img: string, rect: {left:number, top:number, width:number, height:number}, color?: string }} data */
export function setHeroHandoff(data) {
  if (!data?.img || !data.rect) { pending = null; return; }
  const { left, top, width, height } = data.rect;
  pending = { img: data.img, rect: { left, top, width, height }, color: data.color || null, at: Date.now() };
}

/** คืนข้อมูลแล้วล้างทิ้ง · เก่าเกิน maxAgeMs (เช่น server ตอบช้า/ห้องเต็ม) = null */
export function takeHeroHandoff(maxAgeMs = 10000) {
  const p = pending;
  pending = null;
  return p && Date.now() - p.at <= maxAgeMs ? p : null;
}

export function clearHeroHandoff() { pending = null; }
