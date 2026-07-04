// ============================================================
//  ข้อมูลตัวละคร + สกิล (data-driven ตาม ECHO spec ข้อ 4)
//  แก้/เพิ่มตัวละครที่ไฟล์นี้ไฟล์เดียว โดยไม่ต้องแตะ engine
//
//  โครงสกิล: { name, desc, cost, effect }
//    - basic     cost 2
//    - secondary cost 4
//    - ultimate  cost 6 (ต้องเต็มหลอด)
//    - passive   ฟรี ทำงานเองตาม trigger
//
//  effect รองรับ (ยิงใส่ตัวเองก่อนใน milestone นี้ — สกิลใส่คู่ต่อสู้ค่อยเพิ่มทีหลัง):
//    { type:"heal",   amount }  ฟื้นเลือดจริง (ไม่เกินสูงสุด)
//    { type:"armor",  amount }  รับเกราะ (ไม่เกินสูงสุด)
//    { type:"points", amount }  รับแต้มสกิล
//    { type:"shield", amount }  กันความเสียหายครั้งถัดไป N ครั้ง (รีเซ็ตต้นรอบ)
//    { type:"draw",   amount }  จั่วไพ่เพิ่ม (เสี่ยงแตก)
//    { type:"redraw" }          ทิ้งมือ จั่วใหม่ 2 ใบ
//    หรือใส่เป็น array ของ effect เพื่อรวมหลายอย่าง
//
//  passive.trigger: "roundStart" | "win" | "lose" | "attacked"
// ============================================================

const CHARACTERS = [
  {
    id: "hikaru",
    name: "ไรโด ฮิคารุ",
    avatar: 0,
    img: "/characters/hikaru/hikaru_ginga.jpg",
    transformImg: "/characters/hikaru/ginga.jpg", // สลับรูปเป็นร่าง Ginga ระหว่างอยู่ในผลท่าไม้ตาย
    // สกิลติดตัว: ระหว่างอยู่ในร่าง Ginga (ท่าไม้ตาย) การโจมตี +1 หน่วย
    // (ทำงานในตรรกะการโจมตีของ engine โดยตรง ไม่ผูกกับ trigger)
    passive: {
      name: "Ginga no Uta",
      desc: "ระหว่างอยู่ในผลของท่าไม้ตาย Ultlive Ultraman Ginga การโจมตีจะ +1 หน่วย",
    },
    basic: {
      name: "UPG!",
      desc: "เทิร์นนี้ไพ่จะไม่มีทางแตก แต่แต้มสูงสุดได้เพียง 16 (จั่วเท่าไหร่ก็ไม่เกิน)",
      cost: 2,
      img: "/characters/hikaru/ginga_skill1.jpg",
      effect: { type: "status", status: "upg", turns: 1 },
    },
    secondary: {
      name: "MonsterLive",
      desc: "แปลงร่างไคจู 1 เทิร์น: ถ้าถูกผู้ชนะเลือกโจมตี รับความเสียหายน้อยลง 1 หน่วย (ทำงานหลังเปิดไพ่)",
      cost: 4,
      img: "/characters/hikaru/ginga_skill2.jpg",
      effect: { type: "status", status: "monster", turns: 1 },
    },
    ultimate: {
      name: "Ultlive Ultraman Ginga",
      desc: "แปลงร่าง Ginga 3 เทิร์น + เพลงขึ้น: การโจมตีกลายเป็นตีหมู่ — เป้าหมายที่เลือกเข้าเลือดจริง คนอื่นเสียเฉพาะเกราะ",
      cost: 6,
      img: "/characters/hikaru/ginga_skill3.jpg",
      effect: { type: "status", status: "ginga", turns: 3 },
    },
  },
  {
    id: "kuwagata",
    name: "คุวากาตะโอเจอร์",
    avatar: 1,
    img: "/characters/kuwagata/Kuwakata_Ohger.webp",
    locked: true,
    passive: {
      name: "สายมานา",
      desc: "ต้นรอบ รับแต้มสกิล +1",
      trigger: "roundStart",
      effect: { type: "points", amount: 1 },
    },
    basic: { name: "อ่านเกม", desc: "จั่วไพ่เพิ่ม 1 ใบ", cost: 2, effect: { type: "draw", amount: 1 } },
    secondary: { name: "แปรธาตุ", desc: "ทิ้งมือ แล้วจั่วใหม่ 2 ใบ", cost: 4, effect: { type: "redraw" } },
    ultimate: { name: "เกราะเวทย์", desc: "รับเกราะเต็ม +2", cost: 6, effect: { type: "armor", amount: 2 } },
  },
  {
    id: "winton",
    name: "วินตัน",
    avatar: 2,
    img: "/characters/winton/winton.webp",
    locked: true,
    passive: {
      name: "ชิงไหวพริบ",
      desc: "เมื่อชนะรอบ รับแต้มสกิล +1",
      trigger: "win",
      effect: { type: "points", amount: 1 },
    },
    basic: { name: "เสี่ยงดวง", desc: "จั่วไพ่เพิ่ม 1 ใบ", cost: 2, effect: { type: "draw", amount: 1 } },
    secondary: { name: "เงาปกป้อง", desc: "กันความเสียหายครั้งถัดไป 1 ครั้ง", cost: 4, effect: { type: "shield", amount: 1 } },
    ultimate: {
      name: "ลอบสังหาร",
      desc: "ฟื้นเลือดจริง +1 และรับเกราะ +1",
      cost: 6,
      effect: [{ type: "heal", amount: 1 }, { type: "armor", amount: 1 }],
    },
  },
  {
    id: "banagher",
    name: "บานาจ ลิงก์",
    avatar: 3,
    img: "/characters/banagher/Banagher_Links.png",
    // สกิลติดตัว NT-D System: ถูกเลือกโจมตี -> สวนกลับผู้โจมตี 2 (นับเกราะ) + เปิดร่าง NT-D
    // (จัดการในตรรกะ engine โดยตรง ไม่ผูก trigger)
    passive: {
      name: "NT-D System",
      desc: "เมื่อถูกเลือกโจมตี NT-D จะทำงาน สวนกลับผู้โจมตีนั้น 2 หน่วย (นับเกราะที่มีอยู่ด้วย)",
    },
    basic: {
      name: "Absorb shield",
      desc: "เทิร์นนี้ ถ้าถูกโจมตีเข้าเลือดจริง จะฟื้นพลังชีวิต +1 (ถ้าโดนแค่เกราะ ไม่มีผล)",
      cost: 2,
      img: "/characters/banagher/unicorn_skill1.jpg",
      effect: { type: "status", status: "absorb", turns: 1 },
    },
    secondary: {
      name: "Beam Magnum",
      desc: "ถ้าเป็นผู้ที่แต้มใกล้ 21 สุด (ผู้ชนะ) การโจมตีจะแรงขึ้น +1 หน่วย",
      cost: 4,
      img: "/characters/banagher/unicorn_skill2.jpg",
      effect: { type: "status", status: "beam", turns: 1 },
    },
    ultimate: {
      name: "NewType Paradise",
      desc: "เปิด NT-D พิเศษ 2 เทิร์น: ถูกเลือกโจมตีไม่ได้ (อยู่ยงคงกระพัน) — โจมตีได้แต่ยังไม่สร้างความเสียหายจริง",
      cost: 6,
      img: "/characters/banagher/unicorn_skill3.jpg",
      effect: { type: "status", status: "paradise", turns: 2 },
    },
  },
];

const CHAR_BY_ID = Object.fromEntries(CHARACTERS.map((c) => [c.id, c]));

// สีประจำตำแหน่ง P1-P6 (ตามภาพดีไซน์)
const POSITION_COLORS = {
  1: "#9B4F96", // ม่วง
  2: "#9B2D3A", // แดงเลือดหมู
  3: "#3B82C4", // ฟ้า
  4: "#E5B33B", // เหลือง
  5: "#C0392B", // แดง
  6: "#2E9E4B", // เขียว
};

// เวอร์ชัน "สาธารณะ" ส่งให้ client (ตัด effect ภายในออก เหลือชื่อ/คำอธิบาย/ค่าใช้)
function publicRoster() {
  const pub = (s) => (s ? { name: s.name, desc: s.desc, cost: s.cost, img: s.img } : null);
  return CHARACTERS.map((c) => ({
    id: c.id,
    name: c.name,
    avatar: c.avatar,
    img: c.img,
    locked: !!c.locked,
    passive: c.passive ? { name: c.passive.name, desc: c.passive.desc } : null,
    basic: pub(c.basic),
    secondary: pub(c.secondary),
    ultimate: pub(c.ultimate),
  }));
}

module.exports = { CHARACTERS, CHAR_BY_ID, POSITION_COLORS, publicRoster };
