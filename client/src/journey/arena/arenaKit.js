// ตัวช่วยคำนวณที่ใช้ร่วมกันระหว่างตัวสร้างฉาก (arenaData.js) กับไฟล์ภูมิภาค (areas/area4-7.js)

export const NONE = "0 solid transparent";

export function r1(n) {
  return Math.round(n * 10) / 10;
}

export function rand32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* จุดบนพื้น (x,y เทียบกลางสนาม, y บวก = เข้าหากล้อง) -> ตำแหน่งบนจอ + สเกลความลึก
   ตรงกับ CSS: เวที perspective:p (origin = กลางแนวนอน, สูง oy) · พื้น rotateX(90-e) หมุนรอบจุดกลางที่ cy
   oy ต่ำกว่ากลางจอ = เลนส์เลื่อนแกน (shift lens) ยกเส้นขอบฟ้าขึ้นมาในจอโดยไม่ต้องลดระยะ perspective ให้ภาพบิด */
export function proj(c, x, y) {
  const t = ((90 - c.e) * Math.PI) / 180;
  const z = y * Math.sin(t);
  const s = c.p / (c.p - z);
  return { x: r1(c.W / 2 + x * s), y: r1(c.oy + (c.cy - c.oy + y * Math.cos(t)) * s), s: Math.round(s * 1000) / 1000 };
}

export function seatPoint(R, phi) {
  const a = (phi * Math.PI) / 180;
  return { x: Math.cos(a) * R, y: Math.sin(a) * R };
}

export function nearSector(deg) {
  const d = ((deg % 360) + 360) % 360;
  return d > 40 && d < 140;
}
