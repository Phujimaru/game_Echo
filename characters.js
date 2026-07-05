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
//
//  instant: true = สกิลทำงานในช่วงจั่วการ์ด -> เด้งโชว์บนกระดานทันทีตอนใช้
//  (สกิลที่ทำงานหลังเปิดไพ่ จะไปโชว์ตอนอนิเมชันโจมตีแทน ว่าใครใช้อะไร)
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
      desc: "ระหว่างอยู่ในผลของท่าไม้ตาย Ultlive Ultraman Ginga การโจมตีจะ +1 หน่วย และหากเป็นคนกำจัดเป้าหมายได้ ผลของท่าไม้ตายจะ +1 เทิร์น",
    },
    basic: {
      name: "UPG!",
      desc: "ช่วงจั่วการ์ดเทิร์นนี้ไพ่จะไม่มีทางแตก แต่จั่วเท่าไหร่ก็ได้แต้มสูงสุดเพียง 16 — ถ้ายังอยู่ในร่าง Ginga (ท่าไม้ตาย) เพดานจะเพิ่มเป็น 19",
      cost: 2,
      img: "/characters/hikaru/ginga_skill1.jpg",
      instant: true, // มีผลช่วงจั่วการ์ด
      effect: { type: "status", status: "upg", turns: 1 },
    },
    secondary: {
      name: "MonsterLive",
      desc: "แปลงร่างไคจู 2 เทิร์น: ถ้าถูกผู้เล่นที่มีแต้มสูงสุด (ผู้ชนะ) เลือกโจมตี รับความเสียหายน้อยลง 1 หน่วย (ทำงานหลังเปิดไพ่)",
      cost: 4,
      img: "/characters/hikaru/ginga_skill2.jpg",
      effect: { type: "status", status: "monster", turns: 2 },
    },
    ultimate: {
      name: "Ultlive Ultraman Ginga",
      desc: "แปลงร่าง Ginga 3 เทิร์น + เพลงขึ้น: การโจมตีกลายเป็นตีหมู่ — เป้าหมายที่เลือกเข้าเลือดจริง คนอื่นรับความเสียหายเพียง 1 หน่วย (Ginga no Uta ไม่มีผลกับการตีหมู่) แต่หากเหลือฝ่ายตรงข้ามเพียงคนเดียว พลังโจมตี +1 หน่วย",
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
    // สกิลติดตัว Beat Mode: พลังชีวิต < 3 -> ประกายเขี้ยวปฏิปักษ์ (จัดการในตรรกะ engine โดยตรง)
    passive: {
      name: "Beat Mode",
      desc: "เมื่อพลังชีวิตต่ำกว่า 3 หน่วย จะเข้าสู่ประกายเขี้ยวปฏิปักษ์อัตโนมัติ: ทุกการโจมตีของผู้ใช้เป็นความเสียหายจริง (ไม่สนเกราะ), สกิลพื้นฐานใช้ไม่ได้ และจะกันตายจากการโจมตีที่ถึงตายทันทีได้ 1 ครั้ง (ค้างที่ 1 หน่วย) — หลังกันตายทำงาน เกราะจะไม่ฟื้นคืนและความเสียหายจากการแพ้ตอนจั่วการ์ดจะไม่มีผล แต่การโจมตีถึงตายครั้งต่อไปจะตายตามปกติ",
    },
    basic: {
      name: "Rainbow Pudding",
      desc: "ฟื้นพลังชีวิต 1 หน่วยทันที (มีผลทันที ไม่ต้องรอเปิดไพ่) — ใช้ได้ 2 ครั้งต่อเกม และใช้ไม่ได้ระหว่างอยู่ในโหมด Beat Mode",
      cost: 2,
      img: "/characters/kuwagata/kuwagata_skill1.png",
      ammo: 2,
      instant: true, // ฟื้นเลือดทันที ไม่ต้องรอเปิดไพ่
      effect: { type: "heal", amount: 1 },
    },
    secondary: {
      name: "Ohger Finish",
      desc: "ฟาดด้วยโอเจอร์คาลิเบอร์ สร้างความเสียหายเพิ่ม +1 หน่วย (ทำงานหลังเปิดไพ่) — หากมีทั้ง สวมเกราะราชัน และ ประกายเขี้ยวปฏิปักษ์ มีผลอยู่พร้อมกัน จะเป็น +2 หน่วยแทน (ไม่ซ้อนทับเงื่อนไขปกติ)",
      cost: 4,
      img: "/characters/kuwagata/kuwagata_skill2.webp",
      effect: { type: "status", status: "ohger", turns: 1 },
    },
    ultimate: {
      name: "สวมเกราะราชัน",
      desc: "สวมเกราะราชันถาวร: เพิ่มปริมาณเกราะที่สะสมได้ +3 หน่วย และสวมเกราะเต็มทันที (ทำงานหลังเปิดไพ่) — ผลคงอยู่ถาวร ใช้ได้ครั้งเดียวต่อเกม",
      cost: 6,
      img: "/characters/kuwagata/kuwagata_skill3.webp",
      effect: { type: "status", status: "rachan", turns: 1 }, // ถาวร: engine ไม่ลดเทิร์นสถานะนี้
    },
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
    basic: { name: "เสี่ยงดวง", desc: "จั่วไพ่เพิ่ม 1 ใบ", cost: 2, instant: true, effect: { type: "draw", amount: 1 } },
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
      desc: "หากถูกเลือกโจมตี NT-D System จะทำงาน ทำให้การโจมตีของบานาจสร้างความเสียหาย +1 หน่วยแก่คนที่โจมตีเราคนล่าสุด และจะหยุดทำงานเมื่อโจมตีคืนสำเร็จ",
    },
    basic: {
      name: "Absorb shield",
      desc: "เทิร์นนี้ ถ้าถูกโจมตีหรือเป็นผู้แพ้ แล้วยังมีเกราะอยู่ เกราะที่เสียไปจะถูกแปลงกลับมาเป็นพลังชีวิต",
      cost: 2,
      img: "/characters/banagher/unicorn_skill1.jpg",
      effect: { type: "status", status: "absorb", turns: 1 },
    },
    secondary: {
      name: "Beam Magnum",
      desc: "สร้างความเสียหายเพิ่ม +2 หน่วย ทำงานหลังทุกคนเปิดไพ่ และซ้อนกับ NT-D System ได้ — มีกระสุน 3 นัดต่อเกม (ไม่นับถ้าเลือกแล้วไม่ได้โจมตีหรือแตกในเทิร์นนั้น)",
      cost: 4,
      img: "/characters/banagher/unicorn_skill2.jpg",
      ammo: 3,
      effect: { type: "status", status: "beam", turns: 1 },
    },
    ultimate: {
      name: "NewType Paradise",
      desc: "เปิด NT-D แบบพิเศษ 3 เทิร์น: ลบข้อเสียของ NT-D System ให้โจมตีผู้เล่นอื่นได้ด้วยพลัง NT-D (+1) และเติมกระสุน Beam Magnum +1 (ทำงานหลังเปิดไพ่)",
      cost: 6,
      img: "/characters/banagher/unicorn_skill3.jpg",
      effect: { type: "status", status: "paradise", turns: 3 },
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
  const pub = (s) => (s ? { name: s.name, desc: s.desc, cost: s.cost, img: s.img, ammo: s.ammo } : null);
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
