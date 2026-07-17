// ============================================================
//  ECHO — Blackjack Skill Battle : เซิร์ฟเวอร์ + เอนจินเกม
//  - การ์ดสุ่มเลข 1-10 (ไม่ซ้ำในมือเดียวกัน) รวมแต้มใกล้ 21 สุดโดยไม่เกิน
//  - 1 รอบ: ไพ่ -> [CUTSCENE] -> สรุปผล -> โจมตี -> แบนเนอร์รอบ
//  - ระบบแปลงร่าง/cutscene/เพลงสกิลแบบ generic (Ginga / NewType Paradise / NT-D)
// ============================================================

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const fs = require("fs");
const { CHARACTERS, CHAR_BY_ID, POSITION_COLORS, publicRoster } = require("./characters");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const clientDist = path.join(__dirname, "client", "dist");
const useReact = fs.existsSync(path.join(clientDist, "index.html"));
const staticDir = useReact ? clientDist : path.join(__dirname, "public");
app.use(express.static(staticDir));
app.get(/^\/(?!socket\.io).*/, (req, res) => res.sendFile(path.join(staticDir, "index.html")));


// ---------- ค่าคงที่ ----------
const MAX_PLAYERS = 6;
const CARD_TIME = 60;
const SUMMARY_TIME = 5;
const ATTACK_TIME = 15;
const TRANSITION_TIME = 3;
const ATTACKFX_TIME = 3;  // อนิเมชันบอกว่าใครตีใคร

const MAX_HP = 7;       // เลือดจริงพื้นฐาน (patch พิเศษ — เดิม 5)
const MAX_ARMOR = 3;    // เกราะเริ่มต้น (patch พิเศษ — เดิม 2)
const MAX_SKILL = 8;
const BEAM_AMMO = 2;    // กระสุน Beam Magnum ต่อเกม (บานาจ)
const PUDDING_USES = 2; // Rainbow Pudding ใช้ได้ต่อเกม (คุวากาตะ)
const REIJU_USES = 3;   // เรจูอาคมบัญชา ต่อเกม (ฟุจิมารุ)
const MAGE_USES_PER_TURN = 3; // จอมเวทย์ฝึกหัด กดได้ 3 ครั้งต่อเทิร์น (ฟุจิมารุ)
const GAMBLER_USES = 3; // วอสก้าหน่อยน้อง ใช้ได้ต่อเกม (แกมเบลอร์)
const TEMP_HP_TURNS = 2; // เลือดชั่วคราว (แกมเบลอร์) หายเองภายใน 2 เทิร์น
const EVA_BLAST_DMG = 5; // ระเบิด fourth impact (เอวา 13) ใส่ทุกคนในสนาม

// ร่างสุดท้ายฟุจิมารุ (หลังเปิด Everything For Humanity — คงอยู่จนตาย)
const FUJIMARU_FINAL_IMG = "/characters/fujimaru/fujimaru_final.jpg";

// ---------- Apple guy (patch 1.8) ----------
// ของส่งมอบ 3 ชิ้น: สกิลพื้นฐาน "เอาแบบนี้ได้ไหม" เลือก -> สกิลรอง "เอาไปสิ" ส่งให้เป้าหมาย
// (ภาพปกสกิลพื้นฐานเปลี่ยนตามของที่เลือกอยู่ — override ตอนส่ง state)
const APPLE_ITEMS = {
  drink:  { name: "เครื่องดื่มชูกำลัง", img: "/characters/appleguy/appleguy_skill1.1.jpg" },
  iphone: { name: "ไอโฟนเครื่องใหม่", img: "/characters/appleguy/appleguy_skill1.2.png" },
  promo:  { name: "ใบโปรโมทสินค้า", img: "/characters/appleguy/appleguy_skill1.3.jpg" },
};
const APPLE_ATK_MAX = 1;    // บัฟพลังโจมตีจากการมอบของ ไม่สามารถซ้อนทับได้ (patch 1.9)
const APPLE_GIVE_USES = 1;  // เอาไปสิ ใช้ได้จำกัด 1 ครั้ง (เติมจากสกิลติดตัวเมื่อหลบสำเร็จ — สะสมไม่ได้) (patch 1.9.1)
// อัตราหลบขณะชิวๆครับน้องๆ: เริ่ม 100% -> หลบได้เหลือ 50% -> หลบได้อีกเหลือ 25% และคงที่จนกว่าผลจะหมด
const CHILL_DODGE_MIN = 25; // อัตราหลบต่ำสุด (%)

// ---------- ฟุจิตะ โคโตเนะ (patch 1.9.1) ----------
const KOTONE_COIN_MAX = 6;       // กระปุกออมสินน้องหมูน้อย เก็บ coin ได้สูงสุด
const KOTONE_COIN_PER_DMG = 2;   // 2 coin = +1 ความเสียหายตอนโจมตี (ใช้แล้วเหรียญหมดไป)
const KOTONE_SENA_BASE = 0.1;    // โอกาสเจอท่านประธานเซนะจังเมื่อใช้สกิลใดๆ (ฐาน 10%)
const KOTONE_SENA_PER_COIN = 0.1; // เพิ่มอีก 10% ทุกๆ 1 coin ที่มีอยู่ในกระปุก (patch พิเศษ — เดิมทุก 2 coin)
const KOTONE_CAUGHT_CHANCE = 0.2; // Part-time: โอกาสโดนโปรดิวเซอร์จับได้
const KOTONE_STUN_CHANCE = 0.1;  // [โหมงานหนัก]: โอกาสสุ่มสตั้นต่อเทิร์น (patch 2.0.6 — ลดจาก 20%)
const KOTONE_SILENCE_TURNS = 3;  // ท่าไม้ตาย: ใบ้การใช้สกิลของทุกคน (patch 2.0.6 — เพิ่มเป็น 3 เทิร์น)
const KOTONE_KAWAII_DMG = 1;     // ท่าไม้ตาย: ความเสียหายใส่ทุกคน (patch 2.0.6 — ลดเหลือ 1, Dance Lession +1)
const KOTONE_KAWAII_COIN_NEED = 3; // ท่าไม้ตาย: ต้องมี coin ในกระปุกอย่างน้อย 3 เหรียญถึงจะใช้ได้ (patch 2.0.6)
const KOTONE_COIN_GAIN_MAX = 3;  // Part-time: ได้ coin แบบสุ่ม 1-3 เหรียญต่อครั้ง (patch 2.0.6)
// [โหมงานหนัก] ทำงานอยู่ไหม (คงอยู่จนกว่าจะใช้ Sleeping time ตอนกลางคืน)
function overworkActive(p) {
  return !!p && ((p.statuses && p.statuses.overwork) || 0) > 0;
}
// โอกาสเจอท่านประธานเซนะจัง: ฐาน 10% + 10% ทุกๆ 1 coin ที่มีอยู่ในกระปุก (สูงสุด 70% ตอนมี 6 coin)
function kotoneSenaChance(p) {
  return KOTONE_SENA_BASE + KOTONE_SENA_PER_COIN * (p.coins || 0);
}
// Sleeping time: ถูกโจมตีระหว่างหลับ = สะดุ้งตื่นทันที + ติด [โหมงานหนัก] เพราะนอนไม่พอ (patch พิเศษ)
function maybeWakeKotone(t) {
  if (!t || !t.alive || t.characterId !== "kotone") return;
  if (!((t.statuses && t.statuses.ksleep) > 0)) return;
  delete t.statuses.ksleep;
  t.statuses.overwork = 4; // คงอยู่ 3 เทิร์น (+1 ชดเชยการลดสถานะตอนจบเทิร์น) — Sleeping time ลบก่อนได้
  t.armor = 0;
  t.shield = 0;
  lastLog.push(`😫 ${t.name} ถูกปลุกกลางดึกเพราะโดนโจมตี — ตื่นทันทีและติดสถานะ [โหมงานหนัก] 3 เทิร์นเพราะนอนไม่พอ!`);
}

// แสงจันทร์ส่องวิญญาณ ร่างสปาด้า (ชเรด patch พิเศษ): เป้าหมายที่ถูกส่องแล้วไพ่แตกในเทิร์นนี้
//  -> รับความเสียหาย 1 หน่วยทันที (ครั้งเดียว — ผลหมดตอนจบเทิร์น)
function maybeMoonBurst(p) {
  if (!p || !p.alive) return;
  if (((p.statuses && p.statuses.moonmark) || 0) <= 0) return;
  if (!bustedOf(p)) return;
  delete p.statuses.moonmark;
  dealMixed(p, 1);
  maybeBeatSave(p);
  maybeBeatMode(p);
  maybeEva3(p);
  maybeWakeKotone(p);
  p.wasAttacked = true;
  lastLog.push(`🌕💥 แสงจันทร์ส่องวิญญาณ — ${p.name} ไพ่แตก! รับความเสียหาย -1 ทันที`);
  if (p.alive && p.hp <= 0) {
    instantDeath(p);
    lastLog.push(`💀 ${p.name} เลือดจริงหมด ตกรอบ!`);
  }
}

// ============================================================
//  Bard : คีตกวี — ระบบประพันธ์เพลง / บรรเลงทำนอง / มิติมายาบรรเลง
// ============================================================
// ครบ 3 โน้ต -> หาบทเพลงตามลำดับโน้ต — ต้องเลือกเป้าหมายก่อนเสมอ (patch 2.0.5: ทุกบทเพลงมีเป้าหมาย)
function bardCompose(p, live) {
  const pattern = (p.bardNotes || []).join("");
  p.bardNotes = [];
  const song = BARD_SONGS[pattern];
  if (!song) return;
  if (song.need > 0) {
    // เป้าหมายที่เลือกได้มีพอดี/น้อยกว่าที่ต้องการ -> บทเพลงเลือกให้เองทันที ไม่ต้องรอ (กันเกมค้าง)
    const pool = alivePlayers().filter((o) => song.allowSelf || o.id !== p.id);
    if (pool.length <= song.need) {
      const picked = pool.slice(0, song.need).map((o) => o.id);
      lastLog.push(`🎼 ${p.name} ประพันธ์เพลง ${song.name} สำเร็จ — เป้าหมายมีเพียงพอดี บทเพลงเลือกให้อัตโนมัติ`);
      bardPerform(p, pattern, picked, live);
      return;
    }
    p.bardPending = { pattern, name: song.name, need: song.need, allowSelf: !!song.allowSelf };
    lastLog.push(`🎼 ${p.name} ประพันธ์เพลง ${song.name} สำเร็จ — กำลังเลือกเป้าหมาย (ไม่เลือกก่อนเปิดไพ่ = สุ่มเป้าหมาย)`);
    io.emit("skillFlash", { name: `🎼 ${song.name} — กำลังเลือกเป้าหมาย`, img: song.song === "crimson" ? BARD_CRIMSON_IMG : BARD_JADE_IMG, by: p.name, color: POSITION_COLORS[p.position] || "#9B4F96" });
    return;
  }
  bardPerform(p, pattern, [], live);
}
// บรรเลงทำนอง: ใช้ผลบทเพลง + ท่อนทำนองตามสาย + พลังงาน +1
//  live = บรรเลงระหว่างช่วงจั่วการ์ด (เปิดมิติแล้วพักเกมเล่นวีดีโอได้) / false = บรรเลงตอนเปิดไพ่ (สุ่มเป้า)
function bardPerform(p, pattern, targets, live) {
  const song = BARD_SONGS[pattern];
  if (!song || !p.alive) return;
  const isCrimson = song.song === "crimson";
  applyBardSong(p, pattern, targets);
  if (isCrimson) p.bloodSection = Math.min(BARD_SECTION_MAX, (p.bloodSection || 0) + 1);
  else p.soulSection = Math.min(BARD_SECTION_MAX, (p.soulSection || 0) + 1);
  addSkill(p, 1); // บรรเลงทำนองสำเร็จ ได้รับพลังงาน +1
  // เสียงบรรเลง: สาย Crimson = 01 / สาย Jade = 02
  io.emit("bardSfx", { kind: "perform", sound: isCrimson ? 1 : 2 });
  io.emit("skillFlash", { name: `🎼 บรรเลงทำนอง — ${song.name}`, img: isCrimson ? BARD_CRIMSON_IMG : BARD_JADE_IMG, by: p.name, color: POSITION_COLORS[p.position] || "#9B4F96" });
  lastLog.push(`🎼 ${p.name} บรรเลงทำนอง ${song.name}! พลังงาน +1 (โลหิต ${p.bloodSection || 0}/${BARD_SECTION_MAX} · วิญญาณ ${p.soulSection || 0}/${BARD_SECTION_MAX})`);
  // มิติมายาบรรเลงวิญญาณ (patch 2.0.6): ทุกครั้งที่เกิดการบรรเลงทำนอง
  //  — คีตกวีทำดาเมจ 1 แบบสุ่มกับผู้เล่น 2 คน จนกว่ามิติจะสิ้นสุด
  if ((p.statuses.soulDim || 0) > 0) {
    const pool = alivePlayers().filter((t) => t.id !== p.id);
    const hits = [];
    while (hits.length < BARD_SOUL_TARGETS && pool.length) {
      hits.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    }
    for (const t of hits) {
      dealMixed(t, BARD_SOUL_PERFORM_DMG);
      maybeBeatSave(t);
      maybeBeatMode(t);
      maybeEva3(t);
      maybeWakeKotone(t);
      t.wasAttacked = true;
      if (t.alive && t.hp <= 0) {
        instantDeath(t);
        lastLog.push(`💀 ${t.name} เลือดจริงหมด ตกรอบ!`);
      }
    }
    if (hits.length) lastLog.push(`💚🌑 มิติมายาบรรเลงวิญญาณ — ทำนองของ ${p.name} บาดวิญญาณ ${hits.map((t) => t.name).join(", ")} -${BARD_SOUL_PERFORM_DMG}`);
  }
  maybeBardDim(p, live);
}
// ผลของบทเพลงแต่ละแบบ (patch 2.0.5 — สลับผังบทเพลงใหม่)
function applyBardSong(p, pattern, targets) {
  const ts = (targets || []).map((id) => players[id]).filter((t) => t && t.alive);
  const t = ts[0];
  switch (pattern) {
    case "RRR": // Encore: หลบหลีก +100% ในการโดนโจมตี 1 ครั้งถัดไป
      if (!t) return;
      t.statuses.evade = 1; // ไม่ลดเทิร์น — หมดไปเมื่อถูกเลือกโจมตีครั้งถัดไป
      lastLog.push(`🎼💨 Encore — ${t.name} จะหลบหลีกการโดนโจมตี 1 ครั้งถัดไป (100%)`);
      break;
    case "RRJ": { // Silent Cadence: ขโมยพลังงาน 2 มาเป็นของตัวเอง
      if (!t) return;
      const steal = Math.min(BARD_STEAL_ENERGY, t.skillPoints);
      t.skillPoints -= steal;
      if (steal > 0) addSkill(p, steal);
      lastLog.push(`🎼🤫 Silent Cadence — ${p.name} ขโมยพลังงาน ${steal} หน่วยจาก ${t.name}`);
      break;
    }
    case "RJR": // Fate's Prelude: โชคลาภในการจั่วไพ่ครั้งถัดไป (ซ้อนทับได้ — patch 2.0.6)
      if (!t) return;
      t.statuses.fortune = (t.statuses.fortune || 0) + 1; // ไม่ลดเทิร์น — หมดไปทีละ 1 ต่อการจั่ว
      lastLog.push(`🎼🍀 Fate's Prelude — ${t.name} ได้รับโชคลาภในการจั่วไพ่ (สะสม ${t.statuses.fortune} ครั้ง)`);
      break;
    case "JRR": // Rejuvenation: HP +1 / เกราะ +1 / พลังงาน +1
      if (!t) return;
      healHp(t, 1);
      t.armor = Math.min(maxArmorOf(t), t.armor + 1);
      addSkill(t, 1);
      lastLog.push(`🎼💖 Rejuvenation — ${t.name} ฟื้น HP +1 เกราะ +1 พลังงาน +1`);
      break;
    case "JJJ": { // Sanctuary Hymn: ล้าง + ต้านสถานะผิดปกติ 3 เทิร์น (patch 2.0.6: ล้างดีบัฟพื้นฐานตอนติดด้วย)
      if (!t) return;
      t.statuses.resist = Math.max(t.statuses.resist || 0, 4); // +1 ชดเชยการลดสถานะตอนจบเทิร์น
      let purged = 0;
      for (const k of ["discord", "sleep", "kstun", "nodraw", "noskill", "aquapoison"]) {
        if ((t.statuses[k] || 0) > 0) { delete t.statuses[k]; purged++; }
      }
      lastLog.push(`🎼🛡️ Sanctuary Hymn — ${t.name} ต้านสถานะผิดปกติ 3 เทิร์น${purged ? ` (ล้างดีบัฟออก ${purged} อย่าง)` : ""}`);
      break;
    }
    case "JJR": // Resonance: เชื่อมผล 2 คน 3 เทิร์น
      if (ts.length < 2) return;
      ts[0].linkedWith = ts[1].id;
      ts[1].linkedWith = ts[0].id;
      ts[0].statuses.linked = Math.max(ts[0].statuses.linked || 0, 4);
      ts[1].statuses.linked = Math.max(ts[1].statuses.linked || 0, 4);
      lastLog.push(`🎼🔗 Resonance — ${ts[0].name} และ ${ts[1].name} ถูกเชื่อมผล 3 เทิร์น (ฝ่ายหนึ่งถูกโจมตี อีกฝ่ายเจ็บ 1 ตาม)`);
      break;
    case "JRJ": // Discord: ขัดแย้ง +1 ดาเมจ 3 เทิร์น
      if (!t) return;
      if (resistActive(t)) {
        lastLog.push(`🎼🛡️ ${t.name} ต้านสถานะผิดปกติ — ไม่ติดผลขัดแย้ง`);
        return;
      }
      t.statuses.discord = Math.max(t.statuses.discord || 0, 4);
      lastLog.push(`🎼⚡ Discord — ${t.name} ติดสถานะขัดแย้ง (+1 ดาเมจที่ได้รับ) 3 เทิร์น`);
      break;
    case "RJJ": // Harmony: คุ้มครอง -1 ดาเมจ 3 เทิร์น
      if (!t) return;
      t.statuses.guard = Math.max(t.statuses.guard || 0, 4);
      lastLog.push(`🎼💗 Harmony — ${t.name} ได้รับการคุ้มครอง (-1 ดาเมจ) 3 เทิร์น`);
      break;
  }
}
// ท่อนทำนองครบ 5 ชั้น -> เปิดมิติมายาบรรเลง 3 เทิร์น (โลหิตมาก่อนถ้าครบพร้อมกัน)
function maybeBardDim(p, live) {
  if (!p || !p.alive || p.characterId !== "bard") return;
  if ((p.statuses.bloodDim || 0) > 0 || (p.statuses.soulDim || 0) > 0) return; // มิติเปิดอยู่แล้ว
  let kind = null;
  if ((p.bloodSection || 0) >= BARD_SECTION_MAX) kind = "bloodDim";
  else if ((p.soulSection || 0) >= BARD_SECTION_MAX) kind = "soulDim";
  if (!kind) return;
  p.statuses[kind] = BARD_DIM_TURNS + 1; // +1 ชดเชยการลดสถานะตอนจบเทิร์น
  p.transformAt = ++transformCounter;
  if (kind === "bloodDim") {
    // patch 2.0.6: มิติโลหิต — ผู้เล่นทุกคน (ยกเว้นคีตกวี) ติดขัดแย้ง 3 เทิร์น
    //  และคีตกวีได้รับโชคลาภในการจั่วไพ่ 5 ครั้งถัดไป
    for (const o of alivePlayers()) {
      if (o.id === p.id) continue;
      if (resistActive(o)) {
        lastLog.push(`🛡️ ${o.name} ต้านสถานะผิดปกติ — ไม่ติดผลขัดแย้งจากมิติโลหิต`);
        continue;
      }
      o.statuses.discord = Math.max(o.statuses.discord || 0, 4); // 3 เทิร์น (+1 ชดเชยการลดสถานะตอนจบเทิร์น)
    }
    p.statuses.fortune = (p.statuses.fortune || 0) + BARD_BLOOD_FORTUNE;
    lastLog.push(`❤️🌅 ${p.name} เปิดมิติมายาบรรเลงโลหิต! (3 เทิร์น — นับเป็นตอนเช้า) กดโน้ตได้สูงสุด ${BARD_DIM_NOTES_PER_TURN} ครั้งต่อเทิร์น ต้านสถานะผิดปกติ / ทุกคนติดขัดแย้ง +1 ดาเมจ 3 เทิร์น / คีตกวีได้โชคลาภในการจั่ว ${BARD_BLOOD_FORTUNE} ครั้งถัดไป`);
  } else {
    // patch 2.0.6: มิติวิญญาณ — ต้านสถานะผิดปกติ + กดโน้ตได้สูงสุด 9 ครั้งต่อเทิร์น
    //  และทุกการบรรเลงทำนอง ตีสุ่มผู้เล่น 2 คน คนละ 1 หน่วย จนกว่ามิติจะสิ้นสุด
    lastLog.push(`💚🌑 ${p.name} เปิดมิติมายาบรรเลงวิญญาณ! (3 เทิร์น — นับเป็นตอนกลางคืน) กดโน้ตได้สูงสุด ${BARD_DIM_NOTES_PER_TURN} ครั้งต่อเทิร์น ต้านสถานะผิดปกติ และทุกการบรรเลงตีสุ่มผู้เล่น ${BARD_SOUL_TARGETS} คน -${BARD_SOUL_PERFORM_DMG}`);
  }
  // วีดีโอเปิดมิติ เล่นเต็มทุกครั้ง (ไม่ใช่ครั้งเดียวต่อเกม) — บรรเลงตอนเปิดไพ่ให้เข้าคิวรอ afterResolve เล่นให้
  queueCutscene(p, "bardDim");
  if (live && gameState === "PLAYING") pausePlayingForCutscene();
}

// ---------- เจ้าแห่งเน็ตบ้าน (patch 1.9) ----------
//  ระบบสัญญา: ท่าไม้ตายยื่นข้อเสนอ -> เป้าหมายตอบรับ = เป็นคู่สัญญา (เกราะ +1 / โจมตี +1 ตลอดสัญญา)
//  คู่สัญญาใช้งานครบทุก 3 เทิร์น -> ถามต่อสัญญา (จ่าย 4 แต้มคืนให้เจ้าของ / ปฏิเสธ = เจ็บ 2 ไม่สนเกราะ)
const CONTRACT_FEE = 4;        // ค่าต่อสัญญา (แต้มสกิล) ส่งกลับให้เจ้าแห่งเน็ตบ้าน
const CONTRACT_CYCLE = 3;      // ถามต่อสัญญาทุกๆ N เทิร์นของการใช้งาน
const CONTRACT_ARMOR_BONUS = 1; // คู่สัญญา: เพดานเกราะ +1 (ฟื้นให้ทันทีตอนตอบรับ) — patch 1.9.1 ลดจาก 3
const FIBER_CAP = 19;          // เสือนอนกิน: คู่สัญญาจั่วไม่แตก แต่แต้มไม่เกิน 19
// บัฟที่ "กระชากสายแลน" ถอดออกชั่วคราว 1 เทิร์น (คืนให้ตอนจบเทิร์น — เทิร์นถัดไปกลับมามีผลต่อ)
const UNPLUG_BUFFS = ["upg", "monster", "ginga", "absorb", "beam", "paradise", "ohger", "rachan",
  "song", "golden", "spear", "humanity", "seal", "veil", "chill", "awaken", "vortarmor", "fourth", "fiber", "tiger", "fresh"];

// คู่สัญญาของเจ้าแห่งเน็ตบ้านคนนี้ (ยังมีชีวิตและลิงก์ตรงกันทั้ง 2 ฝั่ง)
function contractPartnerOf(b) {
  if (!b || !b.contractPartner) return null;
  const t = players[b.contractPartner];
  return (t && t.alive && t.contractWith === b.id) ? t : null;
}
// เจ้าแห่งเน็ตบ้านที่ผู้เล่นคนนี้ทำสัญญาด้วย (ยังมีชีวิต)
function contractBoss(p) {
  if (!p || !p.contractWith) return null;
  const b = players[p.contractWith];
  return (b && b.alive && b.contractPartner === p.id) ? b : null;
}
// บัฟคู่สัญญา (เกราะ +3 / โจมตี +1) ทำงานอยู่ไหม — โดนกระชากสายแลนถอดชั่วคราวได้
function contractBuffActive(p) {
  return !!contractBoss(p) && !((p.statuses && p.statuses.unplug) > 0);
}
// "ไม่ใช้งานต่อ": ฟื้นเลือดตัวเองไม่ได้ 1 เทิร์น (จากการปฏิเสธต่อสัญญา)
function noHealActive(p) {
  return !!p && ((p.statuses && p.statuses.nohealing) || 0) > 0;
}
// ฟื้นเลือดจริงแบบเคารพสถานะ "ไม่ใช้งานต่อ" — คืนจำนวนที่ฟื้นได้จริง
function healHp(p, amount) {
  if (noHealActive(p)) return 0;
  const heal = Math.min(MAX_HP - p.hp, amount);
  if (heal > 0) p.hp += heal;
  return heal;
}

// ---------- ระบบกลางวัน/กลางคืน (patch 1.7) ----------
//  เริ่มเกมเป็นกลางวันเสมอ สลับทุก 3 เทิร์น: รอบ 1-3 กลางวัน, 4-6 กลางคืน, 7-9 กลางวัน, ...
//  จบเทิร์นกลางวัน = ทุกคนได้แต้มสกิลเพิ่ม +1 | กลางคืน = เกราะฟื้นทุกเทิร์น (ปกติทุก 2 เทิร์น)
//  cycleShift: Lie Like Vortigern รีเซ็ตเวลากลางคืนให้เหลืออีก 3 เทิร์น — เลื่อนวงจรทั้งเกมไปข้างหน้า
const CYCLE_TURNS = 3;
let cycleShift = 0;
let nightResetPending = false; // ตั้งตอนกดท่าไม้ตาย 2 -> เริ่มนับกลางคืนใหม่ตั้งแต่เทิร์นถัดไป
// แสงสว่างที่สรรค์สร้าง (อควาเรียน patch 2.0): บังคับกลางวันจนถึงรอบที่กำหนด (เขียนทับวงจรปกติชั่วคราว)
let dayForceUntil = 0;
// เสียงไพเราะที่กึกก้อง (ชเรด เอลัน patch พิเศษ): ใช้ท่าไม้ตาย 1 -> รีเซ็ตกลางคืนใหม่ 3 เทิร์น (แบบ Vortigern)
//  และตราบใดที่มีชเรดร่างสปาด้ายังมีชีวิต ทุกค่ำคืน ฉากหลังจะเป็นราตรีของชเรด (change_fill.jpg)
function shradeBgActive() {
  return isNightRound(roundNumber) && Object.values(players).some((p) => p.alive && p.shradeForm);
}
function isNightRound(n) {
  // มิติมายาบรรเลง (Bard): โลหิต = นับเป็นตอนเช้า / วิญญาณ = นับเป็นตอนกลางคืน (อยู่เหนือทุกวงจร)
  const bardCycle = bardDimCycle();
  if (bardCycle) return bardCycle === "night";
  if (n <= dayForceUntil) return false;
  const m = n - cycleShift;
  return m > 0 && Math.floor((m - 1) / CYCLE_TURNS) % 2 === 1;
}

// ---------- ชเรด เอลัน (patch พิเศษ) ----------
const SHRADE_MELODY_MAX = 5;    // ท่วงทำนอง สะสมได้สูงสุด (ครบ 5 ถึงใช้ท่าไม้ตาย 1 ได้)
const SHRADE_ATK_BONUS = 2;     // ร่างอควาเรียน สปาด้า: พลังโจมตีพื้นฐาน +2 ถาวร
const SHRADE_CHARGE_TURNS = 3;  // แด่เพื่อนรักของฉัน: ชาร์จ 3 เทิร์น (เสียเลือดเทิร์นละ 1)
const SHRADE_BLAST_DMG = 5;     // แด่เพื่อนรักของฉัน: ความเสียหายใส่ทุกคนบนสนามเมื่อครบกำหนด
const SHRADE_SPADA_IMG = "/characters/shrade_elan/profile/spada.webp"; // ร่างสปาด้า (ถาวร)
const SHRADE_SPADA_NAME = "อควาเรียน สปาด้า";
// กำลังชาร์จแด่เพื่อนรักของฉันอยู่ไหม (จั่วเพิ่ม/ใช้สกิลอื่นไม่ได้ แต่ชนะจั่วยังตีได้)
function shradeCharging(p) {
  return !!p && ((p.statuses && p.statuses.shradecharge) || 0) > 0;
}

// ---------- Bard : คีตกวี (patch 2.2) ----------
// "โลหิตคือทำนอง วิญญาณคือบทกวี และทุกชีวิตล้วนเป็นเพียงโน้ตตัวหนึ่งในบทเพลงอันนิรันด์"
const BARD_MAX_SKILL = 9;         // Crescendo: พลังงานสูงสุด 9 (ตัวอื่น 8)
const BARD_NOTES_PER_TURN = 2;    // จำกัด 2 โน้ตต่อเทิร์น (patch 2.0.5)
const BARD_DIM_NOTES_PER_TURN = 9; // ระหว่างมิติมายาบรรเลง (โลหิต/วิญญาณ): ไม่ติดลิมิต 2 — กดสกิลได้สูงสุด 9 ครั้งต่อเทิร์น
const BARD_NOTE_COST = 1;         // ค่าใช้พลังงานต่อโน้ต (patch 2.0.5 — ลดจาก 2)
const BARD_NOTE_FREE_CHANCE = 0.15; // โอกาส 15% ที่จะไม่เสียพลังงานเมื่อใช้โน้ต (patch 2.0.6 — ลดจาก 20%)
const BARD_BLOOD_FORTUNE = 5;       // มิติโลหิต: คีตกวีได้โชคลาภในการจั่วไพ่ 5 ครั้งถัดไป (patch 2.0.6)
const BARD_SOUL_TARGETS = 2;        // มิติวิญญาณ: ทุกการบรรเลง ตีสุ่มผู้เล่น 2 คน (patch 2.0.6 — เดิมตีทุกคน)
const BARD_SECTION_MAX = 5;       // ท่อนทำนองสะสมครบ 5 ชั้น -> เปิดมิติมายาบรรเลง
const BARD_DIM_TURNS = 3;         // มิติมายาบรรเลงคงอยู่ 3 เทิร์น
const BARD_SOUL_PERFORM_DMG = 1;  // มิติวิญญาณ (patch 2.0.5): ทุกการบรรเลง Bard ตีทุกคน 1 หน่วย
const BARD_STEAL_ENERGY = 1;      // Silent Cadence: ขโมยพลังงาน (patch 2.0.5.1 — ลดจาก 2)
const BARD_PROFILE_IMG = "/characters/bard/bard_profile.jpg";
const BARD_CRIMSON_IMG = "/characters/bard/bard_crimson.png";
const BARD_JADE_IMG = "/characters/bard/bard_jade.png";
// บทเพลงทั้ง 8 (R = ❤️ Crimson, J = 💚 Jade) — need = จำนวนเป้าหมาย, allowSelf = เลือกตัวเองได้
// (patch 2.0.5: สลับผังบทเพลงใหม่ — สายเพลงนับจากโน้ตเสียงข้างมาก)
const BARD_SONGS = {
  RRR: { name: "Encore", song: "crimson", need: 1, allowSelf: true },           // หลบหลีก +100% โดนโจมตี 1 ครั้งถัดไป
  RRJ: { name: "Silent Cadence", song: "crimson", need: 1, allowSelf: false },  // ขโมยพลังงาน 2
  RJR: { name: "Fate's Prelude", song: "crimson", need: 1, allowSelf: true },   // โชคลาภในการจั่วครั้งถัดไป
  JRR: { name: "Rejuvenation", song: "crimson", need: 1, allowSelf: true },     // HP +1 / เกราะ +1 / พลังงาน +1
  JJJ: { name: "Sanctuary Hymn", song: "jade", need: 1, allowSelf: true },      // ต้านสถานะผิดปกติ 3 เทิร์น
  JJR: { name: "Resonance", song: "jade", need: 2, allowSelf: true },           // เชื่อมผล 3 เทิร์น
  JRJ: { name: "Discord", song: "jade", need: 1, allowSelf: false },            // ขัดแย้ง +1 ดาเมจ 3 เทิร์น
  RJJ: { name: "Harmony", song: "jade", need: 1, allowSelf: true },             // คุ้มครอง -1 ดาเมจ 3 เทิร์น
};
// พลังงานสูงสุดของผู้เล่น (Bard = 9)
function maxSkillOf(p) {
  return (p && p.characterId === "bard") ? BARD_MAX_SKILL : MAX_SKILL;
}
// ต้านสถานะผิดปกติ: จาก Sanctuary Hymn หรือระหว่าง Bard อยู่ในมิติมายาบรรเลง (โลหิต/วิญญาณ)
function resistActive(p) {
  if (!p) return false;
  if (((p.statuses && p.statuses.resist) || 0) > 0) return true;
  return p.characterId === "bard" &&
    (((p.statuses && p.statuses.bloodDim) || 0) > 0 || ((p.statuses && p.statuses.soulDim) || 0) > 0);
}
// มิติมายาบรรเลงที่เปิดอยู่บนสนาม: "day" (โลหิต) | "night" (วิญญาณ) | null
function bardDimCycle() {
  for (const p of Object.values(players)) {
    if (!p || !p.alive || p.characterId !== "bard") continue;
    if ((p.statuses.bloodDim || 0) > 0) return "day";
    if ((p.statuses.soulDim || 0) > 0) return "night";
  }
  return null;
}

// ---------- เรียวกิ ชิกิ (patch 2.0.5 / rework 2.0.6) ----------
const SHIKI_DEATHLINE_MAX = 6;   // เส้นชีวิตสะสมถึง 6 -> โจมตีปกติระหว่างท่าไม้ตาย 1 = สังหารทันที
const SHIKI_DEATHLINE_GAIN = 2;  // เปิดไพ่แล้วแต้มเท่ากับชิกิ -> ติดเส้นชีวิต +2 (ถาวร) — โหมดท่าไม้ตาย 2 เหลือ +1
const SHIKI_KNIFE_HEAL = 3;      // มีดพก: การโจมตีปกติฟื้นเลือดให้ตัวเอง 3 หน่วย (2 เทิร์น)
const SHIKI_GODSLAY_TURNS = 3;   // นายมีฝีมือแค่ไหนหรอ?: ชาร์จยกเลิกท่าไม้ตาย 1 ครั้ง คงอยู่ 3 เทิร์น (สะสมไม่ได้)
const SHIKI_WITHER_LINE_MAX = 8; // โหมดท่าไม้ตาย 2: เส้นชีวิตสะสมได้สูงสุด 8 หน่วยต่อคน
const SHIKI_WITHER_PASSIVE_CAP = 3; // โหมดท่าไม้ตาย 2: สกิลติดตัว/สกิลรอง ให้เส้นชีวิตได้สูงสุด 3 หน่วย
const SHIKI_WITHER_KILL_PER_LINE = 0.1; // ความตายที่โรยรา: โอกาสสังหาร 10% ต่อเส้นชีวิต 1 หน่วย
const SHIKI_PROFILE_IMG = "/characters/shiki/shiki.jpg";
const SHIKI_DEATH_IMG = "/characters/shiki/shiki_death.jpg"; // ร่างระหว่างท่าไม้ตาย ฉันมองเห็นมันแล้ว
const SHIKI_WITHER_IMG = "/characters/shiki/shiki2.jpg";     // ร่างระหว่างท่าไม้ตาย 2 ความตายที่โรยรา
// มอบเส้นชีวิตจากสกิลติดตัว/สกิลรอง (โหมดท่าไม้ตาย 2: +1/ครั้ง และแหล่งปกติให้ได้ไม่เกิน 3)
function shikiGiveLifeline(shiki, target, amount) {
  const cur = target.statuses.deathline || 0;
  if ((shiki.shikiUlt || "deatheye") === "wither") {
    if (cur >= SHIKI_WITHER_PASSIVE_CAP) return 0;
    const next = Math.min(SHIKI_WITHER_PASSIVE_CAP, cur + 1);
    target.statuses.deathline = next;
    return next - cur;
  }
  target.statuses.deathline = cur + amount;
  return amount;
}

// ---------- 14 ปีกแห่งสุริยัน อควาเรียน (patch 2.0) ----------
const AQUA_LEADERS = {
  apollo: { name: "อะพอลโล่ (โซล่า)", pilotName: "อะพอลโล่", robotName: "โซล่า อควาเรียน", skillImg: "/characters/auqarion/skill1/apollo.jpg", profileImg: "/characters/auqarion/profile/apollo.jpg", fuseCover: "/characters/auqarion/skill2/skill2_solar.webp", fuseKey: "aquaFuseSolar", fuseProfile: "/characters/auqarion/profile/solar.jpg", ultimateKey: "ultimateSolar" },
  sirius: { name: "ซิลิอุส (มาร์)", pilotName: "ซิลิอุส", robotName: "มาร์ อควาเรียน", skillImg: "/characters/auqarion/skill1/sirius.jpg", profileImg: "/characters/auqarion/profile/sirius.jpg", fuseCover: "/characters/auqarion/skill2/skill2_mars.webp", fuseKey: "aquaFuseMars", fuseProfile: "/characters/auqarion/profile/mars.jpg", ultimateKey: "ultimateMars" },
  rena: { name: "ลีน่า (ลูน่า)", pilotName: "ลีน่า", robotName: "ลูน่า อควาเรียน", skillImg: "/characters/auqarion/skill1/rena.jpg", profileImg: "/characters/auqarion/profile/rena.jpg", fuseCover: "/characters/auqarion/skill2/skill2_luna.webp", fuseKey: "aquaFuseLuna", fuseProfile: "/characters/auqarion/profile/luna.jpg", ultimateKey: "ultimateLuna" },
};
const AQUA_GODWING_NAME = "ปีกแห่งสุริยัน อควาเรียน";
// ชื่อที่แสดงในเกม: ก่อนรวมร่าง = ชื่อผู้นำ / รวมร่างแล้ว = ชื่อหุ่น / ปีกแห่งสุริยัน = ร่างสุดท้าย
function aquaDisplayName(p) {
  if ((p.statuses && p.statuses.godwing) > 0) return AQUA_GODWING_NAME;
  const leader = AQUA_LEADERS[p.leader || "apollo"];
  return p.fused ? leader.robotName : leader.pilotName;
}
const AQUA_GODWING_PROFILE = "/characters/auqarion/profile/godwing.jpg";
const AQUA_LIGHTDEW_MAX = 5;    // แสงละออง สะสมได้สูงสุด (patch พิเศษ — ลดจาก 10)
const AQUA_FUSE_DEW = 1;        // รวมร่างหุ่นศักดิ์สิทธิ์: แสงละออง +1
const AQUA_REVERT_DEW = 2;      // คืนร่าง: แสงละออง +2
const AQUA_GODWING_TURNS = 5;   // ปีกแห่งสุริยัน คงอยู่ 5 เทิร์น
const AQUA_DAY_EXTEND = 5;      // ต่อเวลากลางวันเป็น 5 เทิร์น (นับจากเทิร์นที่เปิดใช้งาน)
const AQUA_MARS_REFLECT_CHANCE = 0.3; // ดาบแห่งจุดจบ: โอกาสสะท้อนความเสียหายครึ่งหนึ่ง
const AQUA_REVIVE_TURNS = 12;   // ไปยังพฤกษาแห่งชีวิต: ตายระหว่างสถานะนี้ -> ฟื้นคืนชีพใน 12 เทิร์น
// ร่างที่รวมอยู่ตอนนี้: "apollo" | "sirius" | "rena" | null (ยังไม่รวมร่าง)
function aquaForm(p) {
  return (p && p.characterId === "aquarion" && p.fused) ? p.leader : null;
}
// สกิลติดตัว 1 แสงแห่งสุริยัน: ทำงานตอนอยู่ร่างโซล่า หรือปีกแห่งสุริยัน
function aquaPassive1Active(p) {
  return !!p && p.characterId === "aquarion" && (((p.statuses && p.statuses.godwing) || 0) > 0 || aquaForm(p) === "apollo");
}
// สกิลติดตัว 2 ดาบแห่งจุดจบ: ทำงานตอนอยู่ร่างมาร์ หรือปีกแห่งสุริยัน
function aquaPassive2Active(p) {
  return !!p && p.characterId === "aquarion" && (((p.statuses && p.statuses.godwing) || 0) > 0 || aquaForm(p) === "sirius");
}
// สกิลติดตัว 3 จันทราสยบ: ทำงานตอนอยู่ร่างลูน่า หรือปีกแห่งสุริยัน
function aquaPassive3Active(p) {
  return !!p && p.characterId === "aquarion" && (((p.statuses && p.statuses.godwing) || 0) > 0 || aquaForm(p) === "rena");
}
// สกิลติดตัว 4 แสงสว่างที่สรรค์สร้าง: แสงละอองครบ 10 + ร่างโซล่า + กลางวัน -> ปีกแห่งสุริยัน 5 เทิร์น
function maybeGodwing(p) {
  if (!p || !p.alive || p.characterId !== "aquarion") return;
  if (((p.statuses && p.statuses.godwing) || 0) > 0) return;
  if ((p.lightDew || 0) < AQUA_LIGHTDEW_MAX) return;
  if (!p.fused || p.leader !== "apollo") return;
  if (isNightRound(roundNumber)) return;
  p.statuses.godwing = AQUA_GODWING_TURNS;
  p.lightDew = 0;
  dayForceUntil = Math.max(dayForceUntil, roundNumber + AQUA_DAY_EXTEND - 1);
  lastLog.push(`🌟 ${p.name} แสงละอองเปี่ยมล้น — แสงสว่างที่สรรค์สร้าง! กลายเป็นปีกแห่งสุริยันเต็มรูปแบบ (5 เทิร์น)`);
  triggerCutscene(p, "godwingForm");
}

// ร่างกลางวัน/กลางคืนของโอเบรอน (สลับอัตโนมัติตามช่วงเวลา)
const OBERON_MORNING_IMG = "/characters/oberon/oberon_morning.jpg";
const OBERON_NIGHT_IMG = "/characters/oberon/oberon_night.jpg";

// รูปร่างโอเจอร์ (ใช้ทั้งท่าไม้ตายสวมเกราะราชัน และ Beat Mode)
const OHGER_FORM = "/characters/kuwagata/kuwakata_ohger_form.jpg";

// การแปลงร่าง/cutscene ต่อสถานะ
//  afterReveal = เล่นหลังเปิดไพ่ (ท่าไม้ตาย) | ntd/beat เล่นตอน trigger (โดนโจมตี/เลือดต่ำ)
//  voice = เสียงพากย์เล่นต่อเมื่อวีดีโอจบ | music = เพลงสกิลที่ค้างหลัง cutscene
const TRANSFORMS = {
  ginga:    { img: "/characters/hikaru/ginga.jpg",           video: "/characters/hikaru/ginga_final.mp4",     title: "ULTLIVE ULTRAMAN GINGA", label: "ปล่อยท่าไม้ตาย",   seconds: 21, music: "ginga",   afterReveal: true },
  paradise: { img: "/characters/banagher/unicorn_ntdfinal.jpg", video: "/characters/banagher/Unicorn_final.mp4", title: "NEWTYPE PARADISE",    label: "ปล่อยท่าไม้ตาย",   seconds: 10, music: "unicorn", afterReveal: true },
  ntd:      { img: "/characters/banagher/unicron_ntd.jpg",   video: "/characters/banagher/NTD_passive.mp4",   title: "NT-D SYSTEM",           label: "สกิลติดตัวทำงาน", seconds: 9,  music: null,     afterReveal: false },
  // seconds ≈ ความยาววิดีโอ (วีดีโอจบ = ตัดกลับจอปกติทันที ไม่ค้างเฟรม)
  //  เสียงพากย์ + เอฟเฟกต์ระเบิด + แจ้งเปลี่ยนร่าง จะเล่นบนจอปกติหลังวีดีโอจบ (ฝั่ง client)
  //  rachan: วีดีโอ 11.62 | beat: วีดีโอ 4.70
  rachan:   { img: OHGER_FORM, video: "/characters/kuwagata/kuwagata_final.mp4",   title: "สวมเกราะราชัน",       label: "ปล่อยท่าไม้ตาย",   seconds: 12, music: "final_normal", voice: "normal_k", afterReveal: true },
  beat:     { img: OHGER_FORM, video: "/characters/kuwagata/kuwagata_passive.mp4", title: "ประกายเขี้ยวปฏิปักษ์", label: "สกิลติดตัวทำงาน", seconds: 5,  music: "ex_guts",      voice: "ex_k",     afterReveal: false },
  // humanity: ท่าไม้ตายฟุจิมารุ — วีดีโอ 13 วิ แล้วเพลง fujimaru_final_theme เล่นค้างระหว่างมีผล
  humanity: { img: FUJIMARU_FINAL_IMG, video: "/characters/fujimaru/fujimaru_final.mp4", title: "EVERYTHING FOR HUMANITY", label: "ปล่อยท่าไม้ตาย", seconds: 13, music: "fujimaru_final", afterReveal: true },
  // monster: เล่นทันทีตอนใช้สกิล (พักช่วงจั่วการ์ดไว้ก่อน) | anataFinal: สกิลติดตัวเทมาริ เล่นก่อนท่าไม้ตายอื่นเสมอ
  monster:  { img: "/characters/hikaru/black_king.webp", video: "/characters/hikaru/ginga_skill3.mp4", title: "MONSTERLIVE", label: "แปลงร่างไคจู", seconds: 10, music: null, afterReveal: false },
  anataFinal: { img: "/characters/temari/temari.webp", video: "/characters/temari/temari_final.mp4", title: "หิวอะโปรดิวเซอร์", label: "สกิลติดตัวทำงาน", seconds: 10, music: null, afterReveal: false },
  // golden: ท่าไม้ตายแกมเบลอร์ ทอยสำเร็จ -> เล่นทันทีก่อนเปิดไพ่ (แบบ monster) + เพลงค้างระหว่างมีผล — วีดีโอ 10 วิ
  golden:   { img: "/characters/gambler/gamnler_final.jpg", video: "/characters/gambler/gambler_final.mp4", title: "เวลาทองของพี่มาแล้ว 777", label: "ปล่อยท่าไม้ตาย", seconds: 11, music: "gambler", afterReveal: false },
  // fourth: ท่าไม้ตายเอวา 13 (หลังเปิดไพ่) — วีดีโอ 10 วิ + เพลงค้างระหว่างมีผล
  fourth:   { img: "/characters/eva13/eva13_final.jpg", video: "/characters/eva13/eva13_final.mp4", title: "FOURTH IMPACT", label: "ปล่อยท่าไม้ตาย", seconds: 11, music: "eva13", afterReveal: true },
  // eva3: สกิลติดตัว 3 เอวา 13 (เลือด <= 3) — วีดีโอ 9 วิ | evaboom: สกิลติดตัว 1 ตายขณะ fourth impact — วีดีโอ 17 วิ
  eva3:     { img: "/characters/eva13/eva13_passive3.jpg", video: "/characters/eva13/eva13_passive3.mp4", title: "อย่าให้ฉันทำแแบบนี้เลย", label: "สกิลติดตัวทำงาน", seconds: 10, music: null, afterReveal: false },
  evaboom:  { img: "/characters/eva13/eva13.webp", video: "/characters/eva13/eva13_passive1.mp4", title: "ไม่สามารถแก้ไขอะไรได้อีกแล้ว", label: "สกิลติดตัวทำงาน", seconds: 18, music: null, afterReveal: false },
  // ---------- โอเบรอน (patch 1.7) ----------
  // lai: ท่าไม้ตายกลางวัน — วีดีโอ 13 วิ | vortigern: patch 1.7.6 ข้ามวีดีโอประจำท่า — เล่น oberonChange แทนทันที
  // (ฉากหลัง "ราตรีกลืนกิน" ไม่ผูกกับท่าไม้ตาย — ทำงานเองทุกครั้งที่เข้ากลางคืนขณะมีโอเบรอนอยู่ในเกม)
  lai:       { img: "/characters/oberon/oberon_skill3_morning.webp", video: "/characters/oberon/oberon_final_morning.mp4", title: "LAI RHYME GOODFELLOW", label: "ปล่อยท่าไม้ตาย", seconds: 14, music: null, afterReveal: true },
  vortigern: { img: "/characters/oberon/oberon_skill3_night.jpg", video: "/characters/oberon/oberon_final_night.mp4", title: "LIE LIKE VORTIGERN", label: "ปล่อยท่าไม้ตาย", seconds: 17, music: null, afterReveal: true },
  // oberonChange: ต่อจากวีดีโอ Vortigern — ราตรีกลืนกิน (16 วิ) แล้วฉากหลังกลางคืนกลายเป็น oberon_background.mp4
  oberonChange: { img: OBERON_NIGHT_IMG, video: "/characters/oberon/oberon_changefill.mp4", title: "ราตรีกลืนกิน", label: "ราตรีถูกครอบงำ", seconds: 17, music: null, afterReveal: false },
  // oberonNight: สลับร่างตอนเข้ากลางคืน (วีดีโอ 5 วิ) | oberonDay: กลับร่างกลางวัน = แจ้งเตือนปกติ ไม่มีวีดีโอ
  oberonNight: { img: OBERON_NIGHT_IMG, video: "/characters/oberon/morning_tonight.mp4", title: "ราชาแห่งการหลอกลวง", label: "สลับร่างยามราตรี", seconds: 6, music: null, afterReveal: false },
  oberonDay:   { img: OBERON_MORNING_IMG, video: null, title: "ราชาแห่งภูติ", label: "กลับคืนร่างกลางวัน", seconds: 0, music: null, afterReveal: false },
  // appleguyDodge: สกิลติดตัว Apple guy — หลบการถูกเลือกโจมตีสำเร็จระหว่างชิวๆครับน้องๆ
  //  (วีดีโอ 13 วิ เล่นซ้ำได้เรื่อยๆ แต่ขึ้นเฉพาะตอนอัตราหลบ 50%/25% — จบวีดีโอค่อยขึ้นสรุปผลการตี)
  appleguyDodge: { img: "/characters/appleguy/appleguy.jpg", video: "/characters/appleguy/appleguy_final.mp4", title: "ชิวๆครับน้องๆ", label: "หลบหลีกสบายใจ", seconds: 14, music: null, afterReveal: false },
  // broadbandBill: สกิลติดตัวเจ้าแห่งเน็ตบ้าน — ขึ้นต้นเทิร์นที่คู่สัญญาต้องจ่ายค่าต่อสัญญา (วีดีโอ 6 วิ — ครั้งแรกต่อเกม ครั้งถัดไปแจ้งเตือนเล็กๆ)
  broadbandBill: { img: "/characters/broadband_man/broadband_man.jpg", video: "/characters/broadband_man/broadband_man_final.mp4", title: "ชำระค่าบริการ", label: "สกิลติดตัวทำงาน", seconds: 7, music: null, afterReveal: false },
  // ---------- ฟุจิตะ โคโตเนะ (patch 1.9.1) ----------
  // kotoneSena: ข้อเสียสกิลติดตัว — เจอท่านประธานเซนะจัง (วีดีโอ 5 วิ ครั้งแรกต่อเกม ครั้งถัดไปแจ้งเตือนเล็กๆ)
  kotoneSena: { img: "/characters/kotone/kotone.jpg", video: "/characters/kotone/kotone_passive.mp4", title: "ท่านประธานเซนะจัง!?", label: "สกิลติดตัวทำงาน", seconds: 6, music: null, afterReveal: false },
  // kawaii: ท่าไม้ตายโคโตเนะ (หลังเปิดไพ่) — วีดีโอ 15 วิ
  kawaii: { img: "/characters/kotone/kotone_skill3.jpg", video: "/characters/kotone/kotone_final.mp4", title: "SEKAI ICHI KAWAII WATASHI", label: "ปล่อยท่าไม้ตาย", seconds: 16, music: null, afterReveal: true },
  // ---------- 14 ปีกแห่งสุริยัน อควาเรียน (patch 2.0) ----------
  // aquaFuseSolar/Mars/Luna: รวมร่างหุ่นศักดิ์สิทธิ์ (ทำงานก่อนเปิดไพ่ — เล่นทันทีตอนกดสกิล)
  aquaFuseSolar: { img: AQUA_LEADERS.apollo.fuseProfile, video: "/characters/auqarion/skill2/solar.mp4", title: "โซล่า อควาเรียน", label: "รวมร่างหุ่นศักดิ์สิทธิ์", seconds: 14, music: null, afterReveal: false },
  aquaFuseMars: { img: AQUA_LEADERS.sirius.fuseProfile, video: "/characters/auqarion/skill2/mars.mp4", title: "มาร์ อควาเรียน", label: "รวมร่างหุ่นศักดิ์สิทธิ์", seconds: 12, music: null, afterReveal: false },
  aquaFuseLuna: { img: AQUA_LEADERS.rena.fuseProfile, video: "/characters/auqarion/skill2/luna.mp4", title: "ลูน่า อควาเรียน", label: "รวมร่างหุ่นศักดิ์สิทธิ์", seconds: 11, music: null, afterReveal: false },
  // godwingForm: สกิลติดตัว 4 แสงสว่างที่สรรค์สร้าง (ทำงานก่อนเปิดไพ่ — เล่นทันทีตอนเข้าเงื่อนไข)
  godwingForm: { img: AQUA_GODWING_PROFILE, video: "/characters/auqarion/skill2/godwing.mp4", title: "ปีกแห่งสุริยัน", label: "แสงสว่างที่สรรค์สร้าง", seconds: 10, music: null, afterReveal: false },
  // ---------- ชเรด เอลัน (patch พิเศษ) ----------
  // shradeMoon: สกิลรอง แสงจันทร์ส่องวิญญาณ (ก่อนเปิดไพ่ — เล่นทันทีตอนกดสกิล) วีดีโอ 4.1 วิ
  shradeMoon: { img: "/characters/shrade_elan/skill2/shrade_skill2.jpg", video: "/characters/shrade_elan/skill2/shrade_skill2.mp4", title: "แสงจันทร์ส่องวิญญาณ", label: "ใช้สกิล", seconds: 5, music: null, afterReveal: false },
  // shradeForm: ท่าไม้ตาย 1 รวมร่างทำนองเพลง (ก่อนเปิดไพ่ — แปลงร่างสปาด้าถาวร) วีดีโอ 20 วิ
  shradeForm: { img: SHRADE_SPADA_IMG, video: "/characters/shrade_elan/skill3/shrade_final.mp4", title: "รวมร่างทำนองเพลง", label: "ปล่อยท่าไม้ตาย", seconds: 20, music: null, afterReveal: false },
  // shradeCharge: ท่าไม้ตาย 2 แด่เพื่อนรักของฉัน — วีดีโอเริ่มชาร์จ 10 วิ (เพลง shrade_theme ค้างระหว่างชาร์จ)
  shradeCharge: { img: "/characters/shrade_elan/skill3/shrade_skill3.2.jpg", video: "/characters/shrade_elan/skill3/shrade_final2.1.mp4", title: "แด่เพื่อนรักของฉัน", label: "ปล่อยท่าไม้ตาย", seconds: 10, music: "shrade", afterReveal: false },
  // shradeBlast: แด่เพื่อนรักของฉัน ครบ 3 เทิร์น — วีดีโอสุดท้าย 15 วิ แล้วระเบิดใส่ทุกคน 5 หน่วย
  shradeBlast: { img: SHRADE_SPADA_IMG, video: "/characters/shrade_elan/skill3/shrade_final2.2.mp4", title: "แด่เพื่อนรักของฉัน", label: "บทเพลงบรรเลงจบ", seconds: 15, music: null, afterReveal: false },
  // shradePassive: สกิลติดตัว เสียงไพเราะที่กึกก้อง — เข้ากลางคืนพร้อมท่วงทำนองครบ 5 วีดีโอ 11 วิ
  shradePassive: { img: "/characters/shrade_elan/profile/shrade_elan.jpg", video: "/characters/shrade_elan/shrade_passive.mp4", title: "เสียงไพเราะที่กึกก้อง", label: "สกิลติดตัวทำงาน", seconds: 11, music: null, afterReveal: false },
  // ---------- Bard : คีตกวี (patch 2.2) ----------
  // bardDim: เปิดมิติมายาบรรเลง (ท่อนทำนองครบ 5) — วีดีโอ 7 วิ แล้วฉากหลัง/เพลงเปลี่ยนตามสายมิติ
  //  (เล่นวีดีโอเต็มทุกครั้งที่เปิดมิติ — ไม่ใช้ triggerCutscene แบบครั้งเดียวต่อเกม)
  bardDim: { img: BARD_PROFILE_IMG, video: "/characters/bard/bard_dim.mp4", title: "มิติมายาบรรเลง", label: "สกิลติดตัวทำงาน", seconds: 8, music: "bard_dim", afterReveal: false },
  // ---------- เรียวกิ ชิกิ (patch 2.0.5 / rework 2.0.6) ----------
  // shikiKill: เนตรมารแห่งความมรณะ — เป้าหมายเส้นชีวิตครบ 6 ถูกโจมตีปกติระหว่างท่าไม้ตาย 1 (เล่นก่อนสังหารทุกครั้ง)
  shikiKill: { img: SHIKI_DEATH_IMG, video: "/characters/shiki/shiki_skill3_hit.mp4", title: "ฉันมองเห็นมันแล้ว", label: "สังหารด้วยเนตรมาร", seconds: 18, music: null, afterReveal: false }, // วีดีโอ 17 วิ
  // shikiSeal: นายมีฝีมือแค่ไหนหรอ? — เล่นแทนที่ท่าไม้ตายที่ถูกชิกิยกเลิก (patch 2.0.6)
  shikiSeal: { img: SHIKI_PROFILE_IMG, video: "/characters/shiki/shiki_passive2.mp4", title: "นายมีฝีมือแค่ไหนหรอ?", label: "ท่าไม้ตายถูกยกเลิก", seconds: 19, music: null, afterReveal: false }, // วีดีโอ 18 วิ
  // shikiWitherKill: ความตายที่โรยรา — โจมตีปกติแล้วสุ่มสังหารสำเร็จ (เล่นก่อนสังหารทุกครั้ง)
  shikiWitherKill: { img: SHIKI_WITHER_IMG, video: "/characters/shiki/shiki_skill3.2_hit.mp4", title: "ความตายที่โรยรา", label: "ความตายมาเยือน", seconds: 9, music: null, afterReveal: false }, // วีดีโอ 8.7 วิ
  // ท่าไม้ตาย 4 แบบ (หลังเปิดไพ่): โซล่า/มาร์/ลูน่า/ปีกแห่งสุริยัน — เลือกตามร่างที่รวมอยู่
  solarburst: { img: "/characters/auqarion/skill3/skill3_solar.png", video: "/characters/auqarion/skill3/solar_final.mp4", title: "หมัดไร้ขอบเขต", label: "ปล่อยท่าไม้ตาย", seconds: 10, music: null, afterReveal: true },
  marssword: { img: "/characters/auqarion/skill3/skill3_mars.jpg", video: "/characters/auqarion/skill3/mars_final.mp4", title: "ดาบแห่งแสง", label: "ปล่อยท่าไม้ตาย", seconds: 8, music: null, afterReveal: true },
  lunabow: { img: "/characters/auqarion/skill3/skill3_luna.jpg", video: "/characters/auqarion/skill3/luna_final.mp4", title: "ศรศักดิ์สิทธิ์", label: "ปล่อยท่าไม้ตาย", seconds: 11, music: null, afterReveal: true },
  godtree: { img: "/characters/auqarion/skill3/skill3_godwing.jpg", video: "/characters/auqarion/skill3/godwing_final.mp4", title: "ไปยังพฤกษาแห่งชีวิต", label: "ปล่อยท่าไม้ตาย", seconds: 17, music: "auqarion", afterReveal: true },
};


// ---------- สถานะเกมส่วนกลาง ----------
let players = {};
let gameState = "LOBBY"; // LOBBY | PLAYING | CUTSCENE | SUMMARY | ATTACK | TRANSITION | GAMEOVER
let timeLeft = 0;
let phaseTimerId = null;
let attackerId = null;
let roundWinnerId = null;
let roundTiedWin = false;  // ผู้ชนะได้จากการเสมอแต้ม -> ไม่มีเทิร์นโจมตีรอบนี้
let roundNumber = 0;
let lastLog = [];
let reservations = {};
let cutsceneQueue = [];
let cutsceneInfo = null;
let cutsceneSeq = 0;      // id ต่อ cutscene (ให้ client remount วีดีโอ กันจอดำ)
let transformCounter = 0; // ลำดับการเปิดร่าง (ใช้เลือกเพลงตอนสวนท่ากัน)
let anataMusicSeq = 0;    // เพลง ANATA WAAAAAAAA เล่นระหว่างช่วงจั่วการ์ด จบเมื่อทุกคนเปิดไพ่
let oberonDevour = 0;     // ราตรีกลืนกิน: เปิดเมื่อโอเบรอนใช้ท่าไม้ตาย 2 (Vortigern) — หายไปเมื่อหมดกลางคืน (0 = ปิด)
let lastAttack = null;    // ข้อมูลการโจมตีล่าสุด (อนิเมชันใครตีใคร)
let roundSkills = [];     // สกิลที่ใช้ในรอบ (เก็บประวัติ — instant เด้งตอนใช้ / หลังเปิดไพ่โชว์ตอนโจมตี)

function clearPhaseTimer() {
  if (phaseTimerId) clearInterval(phaseTimerId);
  phaseTimerId = null;
}
function startPhaseTimer(seconds, onExpire) {
  clearPhaseTimer();
  timeLeft = seconds;
  phaseTimerId = setInterval(() => {
    timeLeft--;
    if (timeLeft <= 0) { clearPhaseTimer(); onExpire(); }
    else broadcastState();
  }, 1000);
}


// ============================================================
//  การ์ด (สุ่มเลข 1-10 ไม่ซ้ำในมือเดียวกัน) + แต้ม
// ============================================================
function drawCardFor(p) {
  const used = new Set(p.cards.map((c) => c.value));
  const avail = [];
  for (let v = 1; v <= 10; v++) if (!used.has(v)) avail.push(v);
  const v = avail.length ? avail[Math.floor(Math.random() * avail.length)] : 1 + Math.floor(Math.random() * 10);
  return { value: v };
}
function calculateScore(cards) { return cards.reduce((s, c) => s + c.value, 0); }
function upgCap(p) {
  // เพดานแต้มขณะ UPG! : ปกติ 16 — ถ้าอยู่ในร่าง Ginga (ท่าไม้ตาย) เพิ่มเป็น 19
  return (p.statuses && (p.statuses.ginga || 0) > 0) ? 19 : 16;
}
function scoreCap(p) {
  // แต้มสูงสุดที่รับได้ก่อนล็อกไพ่อัตโนมัติ (UPG! = เพดานของมัน, เสือนอนกิน (fiber) = 19, ปกติ = 21)
  if (p.statuses && p.statuses.upg) return upgCap(p);
  if (p.statuses && p.statuses.fiber) return FIBER_CAP;
  return 21;
}
function scoreOf(p) {
  const raw = calculateScore(p.cards);
  if (p.statuses && p.statuses.upg) return Math.min(raw, upgCap(p));
  if (p.statuses && p.statuses.fiber) return Math.min(raw, FIBER_CAP);
  return raw;
}
function bustedOf(p) {
  if (p.statuses && (p.statuses.upg || p.statuses.fiber)) return false;
  return calculateScore(p.cards) > 21;
}


// ============================================================
//  ต่อสู้ + เอฟเฟกต์สกิล
// ============================================================
function alivePlayers() { return Object.values(players).filter((p) => p.alive); }

// Song for you (เทมาริ patch 2.0.6): บัฟพลังขิงที่ล็อกไว้ตอนใช้สกิล (2 ชาม = +1)
function songActive(p) {
  return !!p && ((p.statuses && p.statuses.song) || 0) > 0;
}
// ---------- เทมาริ (patch 2.0.6) ----------
const TEMARI_TONKATSU_MAX = 6;   // ชามทงคัสสึสะสมได้สูงสุด (เพิ่มจาก 3)
const TEMARI_ANATA_DRAWS = 3;    // ANATA WAAAAAAAA: บังคับจั่วเพิ่ม 3 ใบ (เพิ่มจาก 2)
// สถานะผิดปกติที่ Song for you ล้างออกได้ทั้งหมด (patch 2.0.6)
const DEBUFF_KEYS = ["discord", "sleep", "kstun", "nodraw", "noskill", "sena", "caught",
  "aquapoison", "energy", "nohealing", "moonmark", "dawn", "deathline", "overwork", "unplug"];
// เกราะสูงสุดของผู้เล่น: ปกติ 2 — ระหว่างสวมเกราะราชัน (ท่าไม้ตายคุวากาตะ) เพิ่ม +3 เป็น 5
// ระหว่าง Everything For Humanity (ฟุจิมารุ) เพิ่ม +3
// ระหว่างสกิลติดตัว 3 เอวา 13 (เลือด <= 3) เพิ่ม +1
// ระหว่าง Lie Like Vortigern (โอเบรอน) เป้าหมายได้เพดานเกราะ +1
// ระหว่างเป็นคู่สัญญาเจ้าแห่งเน็ตบ้าน (สนใจใช้บริการเราไหม) เพิ่ม +3
function maxArmorOf(p) {
  return MAX_ARMOR
    + ((((p.statuses && p.statuses.rachan) || 0) > 0) ? 3 : 0)
    + ((((p.statuses && p.statuses.humanity) || 0) > 0) ? 3 : 0)
    + ((((p.statuses && p.statuses.vortarmor) || 0) > 0) ? 1 : 0)
    + (contractBuffActive(p) ? CONTRACT_ARMOR_BONUS : 0)
    + (eva3Active(p) ? 1 : 0);
}
// เรจูอาคมบัญชา คำสั่ง 1 (ฟุจิมารุ): อมตะ 1 เทิร์น — ไม่รับความเสียหายใดๆ
function sealActive(p) {
  return !!p && ((p.statuses && p.statuses.seal) || 0) > 0;
}
// Beat Mode (คุวากาตะ): พลังชีวิต < 3 = อยู่ในประกายเขี้ยวปฏิปักษ์
function beatActive(p) {
  return !!p && p.alive && p.characterId === "kuwagata" && p.hp < 3;
}
// เข้าสู่ Beat Mode ครั้งแรก (เล่นวีดีโอ passive + ตั้งร่างถาวรจนตาย)
function maybeBeatMode(p) {
  if (!p || !p.alive || p.characterId !== "kuwagata") return;
  if (p.hp < 1 || p.hp >= 3) return;      // ต้องเหลือ 1-2 หน่วย (0 = กำลังจะตาย)
  if (p.seen && p.seen.beat) return;       // เข้าแล้วครั้งเดียวพอ (ถาวรจนตาย)
  p.seen.beat = true;
  p.transformAt = ++transformCounter;
  p.beatAt = p.transformAt; // ล็อกลำดับตอนเข้า Beat (ให้เพลง ex_guts ไม่รีสตาร์ทตอนแปลงร่างอื่นทีหลัง)
  const firstTime = !p.cutsceneShown.beat;
  triggerCutscene(p, "beat");
  if (firstTime) queueTransformAnnounce(p, "beat"); // วีดีโอ -> ประกาศเปลี่ยนร่าง (ระเบิดเขียว + เสียงพากย์)
  lastLog.push(`⚡ ${p.name} เข้าสู่ประกายเขี้ยวปฏิปักษ์ (Beat Mode)!`);
}
// Beat Mode กันตาย: ทำงานทันทีเมื่อความเสียหายถึงตาย ไม่ต้องรอเข้า Beat Mode ก่อน
// (ครั้งเดียวต่อเกม — ค้างที่ 1 หน่วย, เกราะไม่ฟื้นคืน, ภูมิดาเมจจากการแพ้ตอนจั่วการ์ด)
function maybeBeatSave(p) {
  if (!p || !p.alive || p.characterId !== "kuwagata") return false;
  if (p.beatSaved || p.hp >= 1) return false;
  p.hp = 1;
  p.beatSaved = true;
  p.armorLocked = true;
  lastLog.push(`🛡️⚡ ${p.name} ประกายเขี้ยวปฏิปักษ์ — รอดจากความเสียหายถึงตาย! (กันตายได้ครั้งเดียว)`);
  return true;
}
// ตายกลางเทิร์น (เลือดหมดจากสกิล/ผลสถานะ): ตกรอบทันที — อควาเรียนที่ตายขณะไปยังพฤกษาแห่งชีวิต
//  จะติดธงรอฟื้นคืนชีพ (ตั้งเวลา 12 เทิร์นตอนจบเทิร์น ถ้าเกมยังไม่จบ)
function instantDeath(p) {
  if (p.characterId === "aquarion" && ((p.statuses && p.statuses.godtree) || 0) > 0) p.pendingRevive = true;
  p.hp = 0; p.alive = false; p.result = "dead"; p.locked = true;
}

// ---------- เอวานเกเลี่ยน หมายเลข 13 ----------
// สกิลติดตัว 3 อย่าให้ฉันทำแแบบนี้เลย: เลือด <= 3 = ทำงาน (ห้ามจั่วของสกิลรอง +1 เทิร์น, เพดานเกราะ +1)
function eva3Active(p) {
  return !!p && p.alive && p.characterId === "eva13" && p.hp > 0 && p.hp <= 3;
}
// เข้าสกิลติดตัว 3 ครั้งแรก: เล่นวีดีโอ + ฟื้นเกราะให้ 1 หน่วย (เพดานเพิ่มแล้วผ่าน maxArmorOf)
function maybeEva3(p) {
  if (!eva3Active(p)) return;
  if (p.seen && p.seen.eva3) return; // เข้าแล้วครั้งเดียวพอ (ผลเปิด/ปิดตามเลือดจริง)
  p.seen.eva3 = true;
  p.armor = Math.min(maxArmorOf(p), p.armor + 1); // ฟื้นเกราะให้ด้วย
  triggerCutscene(p, "eva3");
  lastLog.push(`🗡️ ${p.name} อย่าให้ฉันทำแแบบนี้เลย — เพดานเกราะ +1 และฟื้นเกราะ!`);
}
// สกิลติดตัว 2 ทุกอย่างไร้ความหมาย: ไม่รับดาเมจแพ้จั่ว/แตก
//  - fourth impact อยู่ = บังคับทำงานแบบไม่ติดเงื่อนไข
//  - สกิลติดตัว 3 ทำงานอยู่ (เลือด <= 3) = สกิลติดตัว 2 ไม่ทำงาน
function evaLossImmune(p) {
  if (!p || p.characterId !== "eva13") return false;
  if ((p.statuses.fourth || 0) > 0) return true;
  return !eva3Active(p);
}

// ---------- Gambler the gambling ----------
// สกิลติดตัว แจ๊กพอตแตก!: เลือด < 3 -> โชคด้านบวก +10% และผลดีทุกอย่าง +1 หน่วย
function gamblerJackpot(p) {
  return !!p && p.alive && p.characterId === "gambler" && p.hp < 3;
}
// โอกาสสำเร็จด้านบวก: พื้นฐาน 50% + สกิลติดตัว 10% (ทุกสกิล รวมท่าไม้ตาย) + เวลาทอง 10%
// (เวลาทองไม่มีผลกับท่าไม้ตายอยู่แล้ว — ระหว่างบัฟยังอยู่กดท่าไม้ตายซ้ำไม่ได้)
function gamblerChance(p, tier) {
  let c = 0.5;
  if (gamblerJackpot(p)) c += 0.1;
  if (tier !== "ultimate" && (p.statuses.golden || 0) > 0) c += 0.1;
  return c;
}
// ฮีลพร้อมล้น: เลือดจริง -> เกราะ -> เลือดชั่วคราว (หายเองใน 2 เทิร์น / หมดเมื่อรับดาเมจ)
//  คืนรายละเอียดว่าฮีลครั้งนี้ลงช่องไหนเท่าไหร่ (ใช้แจ้งผลใน log ให้ชัด)
function healOverflow(p, amount) {
  let left = amount;
  const toHp = healHp(p, left); // "ไม่ใช้งานต่อ" = ฟื้นเลือดจริงไม่ได้ (ล้นไปเกราะ/เลือดชั่วคราวได้ตามปกติ)
  left -= toHp;
  let toArmor = 0;
  if (left > 0) {
    toArmor = Math.min(left, Math.max(0, maxArmorOf(p) - p.armor));
    p.armor += toArmor; left -= toArmor;
  }
  if (left > 0) {
    p.tempHp = (p.tempHp || 0) + left;
    p.tempHpTurns = TEMP_HP_TURNS;
  }
  return { toHp, toArmor, toTemp: left };
}

function joinedPositions() { return Object.values(players).map((p) => p.position); }
function positionsFor(sid) {
  const joined = joinedPositions();
  const reserved = Object.entries(reservations).filter(([id]) => id !== sid).map(([, p]) => p);
  return [...new Set([...joined, ...reserved])];
}
function positionUsedByOther(pos, sid) {
  return joinedPositions().includes(pos) ||
    Object.entries(reservations).some(([id, p]) => id !== sid && p === pos);
}

// รูปที่แสดง: Beat Mode (ถาวรจนตาย) > ร่างสุดท้ายฟุจิมารุ (จนตาย) > Paradise (เหนือกว่าสกิลติดตัว NT-D)
//  > NT-D คงอยู่จนแก้แค้น > ไคจู Black King > Ginga > สวมเกราะราชัน
function displayImg(p) {
  // โอเบรอน: ร่างสลับตามช่วงเวลากลางวัน/กลางคืนเสมอ
  if (p.characterId === "oberon") return isNightRound(roundNumber) ? OBERON_NIGHT_IMG : OBERON_MORNING_IMG;
  // ชเรด เอลัน: รวมร่างทำนองเพลงแล้ว = ร่างอควาเรียน สปาด้า ถาวร
  if (p.characterId === "shrade_elan" && p.shradeForm) return SHRADE_SPADA_IMG;
  // เรียวกิ ชิกิ: ระหว่างท่าไม้ตาย ฉันมองเห็นมันแล้ว / ความตายที่โรยรา = ภาพสถานะท่าไม้ตาย
  if (p.characterId === "shiki" && (p.statuses.wither || 0) > 0) return SHIKI_WITHER_IMG;
  if (p.characterId === "shiki" && (p.statuses.deatheye || 0) > 0) return SHIKI_DEATH_IMG;
  // อควาเรียน: ในล็อบบี้ใช้ select_profile — ลงสนามแล้ว ปีกแห่งสุริยัน > รวมร่าง (ตามผู้นำ) > โปรไฟล์ผู้นำ
  if (p.characterId === "aquarion") {
    if (gameState === "LOBBY") return p.img;
    if ((p.statuses.godwing || 0) > 0) return AQUA_GODWING_PROFILE;
    const leader = AQUA_LEADERS[p.leader || "apollo"];
    if (p.fused) return leader.fuseProfile;
    return leader.profileImg;
  }
  if (p.seen && p.seen.beat) return OHGER_FORM;
  if (p.humanityActivated) return FUJIMARU_FINAL_IMG; // Everything For Humanity: คงร่างจนตาย
  // เอวา 13: Fourth Impact (ท่าไม้ตาย) > สกิลติดตัว 3 (เลือด <= 3)
  if (p.seen && p.seen.fourth && (p.statuses.fourth || 0) > 0) return TRANSFORMS.fourth.img;
  if (p.seen && p.seen.eva3 && eva3Active(p)) return TRANSFORMS.eva3.img;
  // NewType Paradise อยู่เหนือกว่าสกิลติดตัว NT-D — ระหว่างร่าง Paradise คงภาพ Paradise ไว้
  if (p.seen && p.seen.paradise && (p.statuses.paradise || 0) > 0) return TRANSFORMS.paradise.img;
  if (p.ntdTarget && p.seen && p.seen.ntd) return TRANSFORMS.ntd.img;
  for (const key of ["monster", "ginga", "rachan", "golden"]) {
    if (p.seen && p.seen[key] && (p.statuses[key] || 0) > 0) return TRANSFORMS[key].img;
  }
  return p.img;
}
// เพลงสกิล: Beat Mode (ex_guts) ทับทุกเพลงจนผู้ใช้ตาย > คนที่เปิดร่างล่าสุด
//  คืน { music, at } — at = ลำดับการเปิดร่าง ให้ client รู้ว่าเป็น "การเปิดครั้งใหม่"
//  (เปิดท่าซ้ำ / คนอื่นเปิดท่าเพลงเดียวกันทับ) -> เพลงต้องเริ่มใหม่จากต้น
function activeSkillMusic() {
  let bestBeat = null;
  for (const p of alivePlayers()) {
    if (p.seen && p.seen.beat) {
      if (!bestBeat || (p.beatAt || 0) > bestBeat.at) bestBeat = { music: "ex_guts", at: p.beatAt || 0 };
    }
  }
  if (bestBeat) return bestBeat;
  // แด่เพื่อนรักของฉัน (ชเรด เอลัน): เพลง shrade_theme เล่นค้างตลอดช่วงชาร์จ (รองจาก Beat Mode)
  let bestShrade = null;
  for (const p of alivePlayers()) {
    if (shradeCharging(p)) {
      if (!bestShrade || (p.transformAt || 0) > bestShrade.at) bestShrade = { music: "shrade", at: p.transformAt || 0 };
    }
  }
  if (bestShrade) return bestShrade;
  // มิติมายาบรรเลง (Bard): BGM มิติเล่นวนตลอด 3 เทิร์นที่มิติเปิดอยู่
  let bestBard = null;
  for (const p of alivePlayers()) {
    if (p.characterId === "bard" && ((p.statuses.bloodDim || 0) > 0 || (p.statuses.soulDim || 0) > 0)) {
      if (!bestBard || (p.transformAt || 0) > bestBard.at) bestBard = { music: "bard_dim", at: p.transformAt || 0 };
    }
  }
  if (bestBard) return bestBard;
  // ไปยังพฤกษาแห่งชีวิต (อควาเรียน): เพลงอยู่เหนือเพลงสกิล/ท่าไม้ตายอื่นทั้งหมด (ยกเว้น Beat Mode)
  let bestTree = null;
  for (const p of alivePlayers()) {
    if (p.characterId === "aquarion" && (p.statuses.godtree || 0) > 0) {
      if (!bestTree || (p.transformAt || 0) > bestTree.at) bestTree = { music: "auqarion", at: p.transformAt || 0 };
    }
  }
  if (bestTree) return bestTree;
  // ฉันมองเห็นมันแล้ว / ความตายที่โรยรา (ชิกิ): เพลงประจำท่าเล่นค้างระหว่างท่าไม้ตายทำงาน
  let bestShiki = null;
  for (const p of alivePlayers()) {
    if (p.characterId !== "shiki") continue;
    if ((p.statuses.wither || 0) > 0) {
      if (!bestShiki || (p.transformAt || 0) > bestShiki.at) bestShiki = { music: "shiki2", at: p.transformAt || 0 };
    } else if ((p.statuses.deatheye || 0) > 0) {
      if (!bestShiki || (p.transformAt || 0) > bestShiki.at) bestShiki = { music: "shiki", at: p.transformAt || 0 };
    }
  }
  if (bestShiki) return bestShiki;
  let best = null;
  for (const key of ["ginga", "paradise", "rachan", "humanity", "golden", "fourth", "solarburst", "marssword", "lunabow"]) {
    const t = TRANSFORMS[key];
    if (!t.music) continue;
    for (const p of alivePlayers()) {
      if (p.seen && p.seen[key] && (p.statuses[key] || 0) > 0) {
        if (!best || (p.transformAt || 0) > best.at) best = { music: t.music, at: p.transformAt || 0 };
      }
    }
  }
  return best;
}

// เลือดจริงลด 1 หน่วย — เลือดชั่วคราว (แกมเบลอร์) รับแทนก่อนเสมอ (หมดไปเพราะได้รับความเสียหาย)
function loseHp(p) {
  if ((p.tempHp || 0) > 0) { p.tempHp--; return; }
  p.hp--; p.dmgHp++;
}
// เรจูอาคมบัญชา (อมตะ): ไม่รับความเสียหายใดๆ ตลอดเทิร์น — กันไว้กลางทางทุกช่องทางดาเมจ
function damageSoft(p) {
  if (!p.alive || sealActive(p)) return;
  if (p.shield > 0) { p.shield--; return; }
  if (p.armor > 0) { p.armor--; p.dmgArmor++; }
  else loseHp(p);
}
function dealDirect(p, n) {
  if (sealActive(p)) return;
  for (let i = 0; i < n; i++) {
    if (!p.alive) return;
    if (p.shield > 0) { p.shield--; continue; }
    loseHp(p);
  }
}
function dealArmorOnly(p, n) {
  if (sealActive(p)) return;
  for (let i = 0; i < n; i++) {
    if (p.shield > 0) { p.shield--; continue; }
    if (p.armor > 0) { p.armor--; p.dmgArmor++; }
  }
}
function dealMixed(p, n) { // เกราะก่อนแล้วเลือด (สำหรับ NT-D)
  if (sealActive(p)) return;
  for (let i = 0; i < n; i++) {
    if (!p.alive) return;
    if (p.shield > 0) { p.shield--; continue; }
    if (p.armor > 0) { p.armor--; p.dmgArmor++; }
    else loseHp(p);
  }
}
function addSkill(p, n) {
  const before = p.skillPoints;
  p.skillPoints = Math.min(maxSkillOf(p), p.skillPoints + n); // Bard: เพดานพลังงาน 9
  p.gainedSkill += p.skillPoints - before;
}

function applyEffect(p, effect) {
  if (!effect) return;
  if (Array.isArray(effect)) return effect.forEach((e) => applyOne(p, e));
  applyOne(p, effect);
}
function applyOne(p, e) {
  switch (e.type) {
    case "heal": healHp(p, e.amount); break;
    case "armor": p.armor = Math.min(maxArmorOf(p), p.armor + e.amount); break;
    case "points": addSkill(p, e.amount); break;
    case "shield": p.shield += e.amount || 1; break;
    case "draw": for (let i = 0; i < (e.amount || 1); i++) p.cards.push(drawCardFor(p)); break;
    case "redraw": p.cards = []; p.cards.push(drawCardFor(p)); p.cards.push(drawCardFor(p)); break;
    case "status": p.statuses[e.status] = e.turns || 1; break;
  }
}
function firePassive(p, trigger) {
  const ch = CHAR_BY_ID[p.characterId];
  if (ch && ch.passive && ch.passive.trigger === trigger) applyEffect(p, ch.passive.effect);
}
// หาข้อมูลสกิล (ชื่อ+รูป) จาก status ที่กำลังมีผล — ใช้โชว์ตอนอนิเมชันโจมตี ว่าดาเมจ/การป้องกันมาจากสกิลไหนของใคร
function skillByStatus(p, status) {
  const ch = CHAR_BY_ID[p.characterId];
  if (!ch) return null;
  for (const tier of ["basic", "secondary", "secondaryNight", "ultimate", "ultimateNight",
    "secondaryRevert", "ultimateSolar", "ultimateMars", "ultimateLuna", "ultimateGodwing"]) {
    const s = ch[tier];
    if (s && s.effect && !Array.isArray(s.effect) && s.effect.type === "status" && s.effect.status === status) {
      return { name: s.name, img: s.img || null, by: p.name, color: POSITION_COLORS[p.position] || "#888" };
    }
  }
  return null;
}
// นายมีฝีมือแค่ไหนหรอ? (ชิกิ patch 2.0.6): มีชิกิที่ถือชาร์จยกเลิกท่าไม้ตาย (godslay) อยู่บนสนาม
//  -> ท่าไม้ตายของผู้เล่นอื่นที่เพิ่งกดถูกยกเลิกทันที (แต้มสกิลเสียฟรี — ไม่คืน) และเล่นวีดีโอแทนที่
//  โดยโชว์ทั้งภาพสกิลท่าไม้ตายที่โดน ภาพเจ้าของท่า และบอกว่ายกเลิกท่าของใคร
function shikiCancelUltimate(slayer, victim, skill) {
  delete slayer.statuses.godslay; // ใช้ได้ 1 ครั้งต่อการชาร์จ (สะสมไม่ได้)
  const t = TRANSFORMS.shikiSeal;
  lastLog.push(`👁️🗡️ ${slayer.name} นายมีฝีมือแค่ไหนหรอ? — ยกเลิกท่าไม้ตาย ${skill.name} ของ ${victim.name}! (แต้มสกิลเสียฟรี)`);
  cutsceneQueue.push({
    seconds: t.seconds,
    info: {
      playerId: victim.id, name: victim.name,
      img: skill.img || displayImg(victim), // ภาพสกิลท่าไม้ตายที่โดนยกเลิก
      img2: displayImg(victim),             // ภาพเจ้าของท่าที่โดน
      color: POSITION_COLORS[slayer.position] || "#9B4F96",
      video: t.video, title: t.title, label: `ถูก ${slayer.name} ยกเลิกท่าไม้ตาย`,
    },
  });
}

// ไพ่แตกก่อนเปิดไพ่ = ท่าไม้ตายที่เพิ่งกดในเทิร์นนี้ใช้งานไม่ได้ (แต้มสกิลที่จ่ายไปเสียฟรี)
function voidUltimateOnBust(p) {
  for (const key of Object.keys(TRANSFORMS)) {
    if (!TRANSFORMS[key].afterReveal) continue; // เฉพาะท่าไม้ตาย (ginga / paradise)
    if ((p.statuses[key] || 0) > 0 && !p.seen[key]) {
      delete p.statuses[key];
      lastLog.push(`💥 ${p.name} ไพ่แตก! ท่าไม้ตาย ${TRANSFORMS[key].title} ใช้งานไม่ได้ — แต้มสกิลเสียฟรี`);
    }
  }
  // ANATA WAAAAAAAA (เทมาริ): ผู้ใช้ไพ่แตกเอง = ท่าไม้ตายเป็นโมฆะ
  if ((p.statuses.anata || 0) > 0 && p.anataTargets) {
    delete p.statuses.anata;
    p.anataTargets = null;
    anataMusicSeq = 0;
    lastLog.push(`💥 ${p.name} ไพ่แตก! ท่าไม้ตาย ANATA WAAAAAAAA ใช้งานไม่ได้ — แต้มสกิลเสียฟรี`);
  }
}

function resetRoundDisplay(p) {
  p.dmgHp = 0; p.dmgArmor = 0; p.gainedSkill = 0;
  p.wasAttacked = false; p.isWinner = false; p.isLoser = false;
}
function resetCombat(p) {
  p.hp = MAX_HP; p.armor = MAX_ARMOR; p.skillPoints = 0; p.alive = true; p.shield = 0;
  p.statuses = {}; p.seen = {}; p.ntdTarget = null; p.transformAt = 0; p.beatAt = 0;
  p.armorLocked = false; // Beat Mode: กันตายแล้วเกราะจะไม่ฟื้นคืน
  p.beatSaved = false;   // Beat Mode: กันตายได้ครั้งเดียวต่อเกม (คล้าย Focus Sash)
  p.skillUsedRound = false; // ใช้สกิลได้ 1 อันต่อเทิร์น
  p.beamAmmo = BEAM_AMMO; // กระสุน Beam Magnum รีเซ็ตต้นเกม
  p.puddingUses = PUDDING_USES; // Rainbow Pudding รีเซ็ตต้นเกม
  p.tonkatsu = 0;         // เทมาริ: ชามทงคัสสึที่กินสะสม (สูงสุด 3 — Song for you ล้างตอนใช้)
  p.songAtk = 0;          // Song for you: พลังขิงที่ล็อกไว้ตอนใช้สกิล (สูงสุด 2)
  p.noDrawNext = 0;       // จำนวนเทิร์นที่จั่วเพิ่มไม่ได้ เริ่มเทิร์นถัดไป (ทงคัสสึ / กำไรเท่าตัวโว้ย)
  p.noSkillNext = 0;      // จำนวนเทิร์นที่ใช้สกิลไม่ได้ เริ่มเทิร์นถัดไป (หอกลองกินัส เอวา 13)
  p.gamblerUses = GAMBLER_USES; // แกมเบลอร์: วอสก้าหน่อยน้อง 3 ครั้งต่อเกม (เวลาทองรีเซ็ตให้เต็ม)
  p.profit = 0;           // แกมเบลอร์: บัฟกำไรเท่าตัวโว้ย (+โจมตี, ทะลุเกราะ) สะสมจนกว่าจะได้ตี
  p.tempHp = 0;           // แกมเบลอร์: เลือดชั่วคราวจากฮีลล้น
  p.tempHpTurns = 0;      // เลือดชั่วคราวหายเองเมื่อครบ 2 เทิร์น
  p.anataTargets = null;  // เป้าหมาย ANATA WAAAAAAAA (ลับจนกว่าจะเปิดไพ่)
  p.nightmareTarget = null; // เป้าหมายฝันร้ายยามค่ำคืน (โอเบรอน — ทำงานหลังเปิดไพ่)
  p.reiju = REIJU_USES;   // ฟุจิมารุ: เรจูอาคมบัญชา 3 ครั้งต่อเกม
  p.mageUses = 0;         // จอมเวทย์ฝึกหัด: จำนวนครั้งที่กดในเทิร์นนี้ (สูงสุด 3)
  p.mageHealNext = 0;     // จอมเวทย์ฝึกหัด: ฟื้นเลือดเทิร์นถัดไปตามจำนวนครั้งที่ใช้
  p.humanityActivated = false; // Everything For Humanity เปิดแล้ว (ร่างสุดท้ายจนตาย + ตายเมื่อผลจบ)
  p.sunriseDrop = 0; // โอเบรอน: จำนวนเทิร์นที่พลังชีวิตจะลดลงเทิร์นละ 1 อัตโนมัติ (หลังโดนฮีล 5)
  p.sleepFresh = false; // หลับไหล: เทิร์นที่เพิ่งโดนกล่อมยังไม่เริ่มนับ/ยังโจมตีได้
  p.appleItem = "drink"; // Apple guy: ของส่งมอบที่เลือกอยู่ (ค่าเริ่มต้น เครื่องดื่มชูกำลัง)
  p.appleGifts = {};     // Apple guy: ประวัติการมอบของ "targetId:item" (มอบซ้ำ = บัฟหาย + ล้างประวัติชิ้นนั้น)
  p.appleAtk = 0;        // Apple guy: บัฟพลังโจมตีจากการมอบของ (ไม่ซ้อนทับ — สูงสุด 1)
  p.chillDodge = 100;    // Apple guy: อัตราหลบขณะชิวๆครับน้องๆ (%) — รีเซ็ตเมื่อเปิดท่าไม้ตายใหม่
  p.appleGiveUses = APPLE_GIVE_USES; // Apple guy: จำนวนใช้ เอาไปสิ (เติมจากสกิลติดตัวเมื่อหลบสำเร็จ — สะสมไม่ได้)
  // ---------- ฟุจิตะ โคโตเนะ (patch 1.9.1) ----------
  p.coins = 0;            // กระปุกออมสินน้องหมูน้อย: coin สะสม (สูงสุด 6)
  p.nightWork = 0;        // จำนวนครั้งที่ทำงาน Part-time ในเฟสกลางคืนนี้ (>1 = โหมงานหนัก)
  p.overworkNext = false; // ติด [โหมงานหนัก] ตอนเริ่มเทิร์นถัดไป
  p.senaNext = false;     // เจอท่านประธานเซนะจัง -> เทิร์นถัดไปทำอะไรไม่ได้เลย
  p.danceBuff = false;    // Dance Lession: ผลใบ้สกิลของท่าไม้ตายครั้งถัดไป +1 เทิร์น
  // ---------- เจ้าแห่งเน็ตบ้าน (patch 1.9) ----------
  p.contractPartner = null; // เจ้าแห่งเน็ตบ้าน: id คู่สัญญาปัจจุบัน (มีได้ 1 คน)
  p.contractWith = null;    // ฝั่งคู่สัญญา: id เจ้าแห่งเน็ตบ้านที่ทำสัญญาด้วย
  p.contractOffer = null;   // ข้อเสนอที่ยื่นไว้ รอเป้าหมายตอบ (id เป้าหมาย)
  p.contractTurns = 0;      // จำนวนเทิร์นที่คู่สัญญาใช้งานมาแล้ว (ครบทุก 3 = ถามต่อสัญญา)
  p.renewPending = false;   // ฝั่งคู่สัญญา: กำลังถูกถามต่อสัญญาในเทิร์นนี้
  p.skillDrain = 0;         // โดนปฏิเสธค่าปรับ: แต้มสกิลจบเทิร์นลด 1 (จำนวนเทิร์นที่เหลือ)
  p.skillDrainPending = 0;  // ค่าปรับเริ่มนับเทิร์นถัดไป (ย้ายเข้า skillDrain ตอนเริ่มเทิร์นใหม่)
  p.healNextTurn = 0;       // เสือนอนกิน: ฟื้นเลือด 1 หน่วยในเทิร์นถัดไป (กรณีไม่มีคู่สัญญา)
  p.unplugHold = null;      // กระชากสายแลน: บัฟที่ถูกถอดชั่วคราว (คืนให้ตอนจบเทิร์น)
  // ---------- 14 ปีกแห่งสุริยัน อควาเรียน (patch 2.0) ----------
  p.leader = "apollo";      // ผู้นำที่เลือกไว้ (apollo/sirius/rena) — กำหนดร่างที่จะรวมร่างด้วย
  p.fused = false;          // กำลังรวมร่างหุ่นศักดิ์สิทธิ์อยู่ไหม
  p.lightDew = 0;           // แสงละออง สะสม (สูงสุด 10)
  p.reviveIn = 0;           // ไปยังพฤกษาแห่งชีวิต: จำนวนเทิร์นก่อนฟื้นคืนชีพ (0 = ไม่รอฟื้น)
  p.pendingRevive = false;  // ตายขณะ godtree ยังอยู่ -> รอเช็คตอนจบเทิร์นว่าเกมจบไหม
  // ---------- ชเรด เอลัน (patch พิเศษ) ----------
  p.shradeForm = false;     // รวมร่างทำนองเพลงแล้ว (อควาเรียน สปาด้า — ถาวร โจมตี +2)
  // (patch พิเศษ: ราตรีของชเรดไม่ถาวรแล้ว — ใช้ nightResetPending รีเซ็ตกลางคืน 3 เทิร์นแทน)
  // ---------- Bard : คีตกวี (patch 2.2) ----------
  p.bardNotes = [];         // โน้ตในช่องประพันธ์เพลง (["R","J",...] สูงสุด 3 — ครบแล้วบรรเลงทันที)
  p.bardNotesUsed = 0;      // จำนวนโน้ตที่เติมในเทิร์นนี้ (จำกัด 2 — มิติโลหิตไม่จำกัด)
  p.bardPending = null;     // บทเพลงที่รอเลือกเป้าหมาย { pattern, name, need, allowSelf }
  p.bloodSection = 0;       // ท่อนทำนองแห่งโลหิต (ครบ 5 = มิติมายาบรรเลงโลหิต)
  p.soulSection = 0;        // ท่อนทำนองแห่งวิญญาณ (ครบ 5 = มิติมายาบรรเลงวิญญาณ)
  p.linkedWith = null;      // Resonance: id ผู้เล่นที่ถูกเชื่อมผลด้วย
  // ---------- เรียวกิ ชิกิ (patch 2.0.6) ----------
  //  p.shikiUlt คงไว้ตามที่เลือกตอนเข้าห้อง (deatheye | wither) — ไม่รีเซ็ตระหว่างแมตช์
  p.witherBase = null;      // เส้นชีวิต ณ ตอนชิกิเปิดความตายที่โรยรา (ใช้ลบส่วนที่สะสมช่วงท่าไม้ตาย)
  p.cutsceneShown = {}; // เล่นวีดีโอครั้งเดียวต่อเกม (per match)
}


// ============================================================
//  ส่งสถานะ
// ============================================================
// สถานะที่ผู้เล่นคนอื่นเห็นได้ระหว่างช่วงจั่วการ์ด (patch 1.7.1): โชว์ให้ดูของกันและกันได้
//  ยกเว้นสกิลหลังเปิดไพ่ที่เพิ่งกดรอไว้ในเทิร์นนี้ — เปิดเผยเมื่อทำงานแล้วเท่านั้น (กันสปอยล์)
const HIDDEN_UNTIL_REVEAL = ["beam", "ohger", "absorb", "spear", "nightmare"];
function publicStatuses(p) {
  const out = {};
  for (const [k, v] of Object.entries(p.statuses || {})) {
    if (TRANSFORMS[k] && TRANSFORMS[k].afterReveal && !(p.seen && p.seen[k])) continue;
    if (HIDDEN_UNTIL_REVEAL.includes(k)) continue;
    out[k] = v;
  }
  if (p.ntdTarget) out.ntd = 1;
  return out;
}
function buildStateFor(viewerId) {
  const revealAll = gameState !== "PLAYING" && gameState !== "LOBBY";
  // เพลง ANATA WAAAAAAAA ทับทุกเพลงระหว่างช่วงจั่วการ์ด — จบลงเมื่อทุกคนพร้อมเปิดไพ่แล้ว
  const nightNow = isNightRound(roundNumber);
  // ราตรีกลืนกิน: เปิดเมื่อโอเบรอนใช้ท่าไม้ตาย 2 (Lie Like Vortigern) — ฉากหลังกลางคืนกลายเป็น
  //  วีดีโอ oberon_background.mp4 + เพลงประจำตัวเล่นค้าง และหายไปเมื่อหมดกลางคืน
  const oberonBg = nightNow && oberonDevour > 0;
  // ไปยังพฤกษาแห่งชีวิต (อควาเรียน): ฉากหลังกลายเป็น backgroud_skillgod.jpg ระหว่างสถานะนี้มีผล
  const godtreeBg = Object.values(players).some((p) => p.alive && p.characterId === "aquarion" && (p.statuses.godtree || 0) > 0);
  // ราตรีถาวรของชเรด เอลัน: ฉากหลังกลายเป็น change_fill.jpg จนกว่าชเรดจะหมดสภาพต่อสู้
  const shradeBg = shradeBgActive(); // กลางคืน + มีชเรดร่างสปาด้า = ฉากหลังราตรีของชเรด
  // ฉันมองเห็นมันแล้ว (ชิกิ): ภาพ shiki_fill.png ซ้อนทับฉากหลัง | ความตายที่โรยรา: ฉากหลังวีดีโอ shiki_fill2.mp4
  const shikiBg = Object.values(players).some((p) => p.alive && p.characterId === "shiki" && (p.statuses.wither || 0) > 0)
    ? "wither"
    : Object.values(players).some((p) => p.alive && p.characterId === "shiki" && (p.statuses.deatheye || 0) > 0)
      ? "eye" : null;
  // มิติมายาบรรเลง (Bard): ฉากหลังเปลี่ยนตามสายมิติ "blood" | "soul" | null
  const bardCycleNow = bardDimCycle();
  const bardBg = bardCycleNow === "day" ? "blood" : bardCycleNow === "night" ? "soul" : null;
  let sm = (gameState === "PLAYING" && anataMusicSeq)
    ? { music: "temari_final_theme", at: anataMusicSeq }
    : activeSkillMusic();
  if (!sm && oberonBg) sm = { music: "oberon", at: oberonDevour }; // เพลงสกิล/ท่าไม้ตายอื่นยังทับได้
  // ข้อเสนอ/คำถามต่อสัญญา (เจ้าแห่งเน็ตบ้าน) ที่รอ "ผู้ชม state คนนี้" ตอบ — โชว์เฉพาะช่วงจั่วการ์ด
  const viewer = players[viewerId];
  let contractOffer = null;
  let renewAsk = null;
  if (gameState === "PLAYING" && viewer && viewer.alive) {
    const offerer = Object.values(players).find((o) => o.alive && o.contractOffer === viewerId);
    if (offerer) contractOffer = { from: offerer.name, color: POSITION_COLORS[offerer.position] || "#9B4F96", img: "/characters/broadband_man/broadband_man_skill3.jpg" };
    if (viewer.renewPending) {
      const boss = contractBoss(viewer);
      if (boss) renewAsk = { from: boss.name, fee: CONTRACT_FEE, color: POSITION_COLORS[boss.position] || "#9B4F96", img: "/characters/broadband_man/broadband_man.jpg" };
    }
  }
  return {
    contractOffer, // ข้อเสนอสัญญาที่รอเราตอบ (สนใจใช้บริการเราไหม)
    renewAsk,      // คำถามต่อสัญญาที่รอเราตอบ (ชำระค่าบริการ)
    gameState,
    timeLeft,
    roundNumber,
    cycle: nightNow ? "night" : "day", // กลางวัน/กลางคืน (สลับทุก 3 เทิร์น)
    oberonBg,
    godtreeBg,
    shradeBg, // ราตรีของชเรด เอลัน (ฉากหลัง change_fill.jpg — ทุกค่ำคืนที่ยังอยู่ในร่างสปาด้า)
    bardBg,   // มิติมายาบรรเลง (Bard): "blood" | "soul" | null
    shikiBg,  // ฉันมองเห็นมันแล้ว (ชิกิ): ซ้อน shiki_fill.png ทับฉากหลังปัจจุบัน
    maxPlayers: MAX_PLAYERS,
    youId: viewerId,
    attackerId: gameState === "ATTACK" ? attackerId : null,
    winnerId: (gameState === "SUMMARY" || gameState === "ATTACK") ? roundWinnerId : null,
    skillMusic: sm ? sm.music : null,
    skillMusicSeq: sm ? sm.at : 0, // เปลี่ยน = การเปิดร่างครั้งใหม่ -> client เริ่มเพลงใหม่
    cutscene: gameState === "CUTSCENE" ? cutsceneInfo : null,
    attack: gameState === "ATTACKING" ? lastAttack : null,
    log: (gameState === "SUMMARY" || gameState === "TRANSITION" || gameState === "GAMEOVER") ? lastLog : [],
    players: Object.values(players).map((p) => {
      const mine = p.id === viewerId;
      const show = mine || revealAll;
      // ใบโปรโมทสินค้า (Apple guy): แต้มการ์ดของคนติดสถานะถูกเปิดเผยให้ทุกคนเห็น (1 เทิร์น)
      const promoShow = (p.statuses.promo || 0) > 0;
      const ch = CHAR_BY_ID[p.characterId] || {};
      const pub = (s) => (s ? { name: s.name, desc: s.desc, cost: s.cost, img: s.img, ammo: s.ammo } : null);
      // สกิลพื้นฐานสลับกลางคืน (โคโตเนะ) + Apple guy: ปกสกิลพื้นฐานเปลี่ยนตามของส่งมอบที่เลือกอยู่
      let basicPub = pub(nightNow && ch.basicNight ? ch.basicNight : ch.basic);
      if (basicPub && p.characterId === "appleguy") basicPub.img = (APPLE_ITEMS[p.appleItem] || APPLE_ITEMS.drink).img;
      // อควาเรียน: ปกสกิลพื้นฐาน "เปลี่ยนหัวหน้า" เปลี่ยนตามผู้นำที่เลือกอยู่ + สกิลรอง/ท่าไม้ตายสลับตามร่าง
      let secondaryPub = pub(nightNow && ch.secondaryNight ? ch.secondaryNight : ch.secondary);
      let ultimatePub = pub(nightNow && ch.ultimateNight ? ch.ultimateNight : ch.ultimate);
      if (ch.id === "aquarion") {
        const leader = AQUA_LEADERS[p.leader || "apollo"];
        if (basicPub) basicPub.img = leader.skillImg;
        secondaryPub = pub(p.fused ? ch.secondaryRevert : ch.secondary);
        if (secondaryPub && !p.fused) secondaryPub.img = leader.fuseCover;
        // ท่าไม้ตายสลับตามร่าง — ยังไม่รวมร่างโชว์ท่าของผู้นำที่เลือกไว้ (ปุ่มล็อกฝั่ง client จนกว่าจะรวมร่าง)
        ultimatePub = pub(
          (p.statuses.godwing || 0) > 0 ? ch.ultimateGodwing
          : p.leader === "sirius" ? ch.ultimateMars
          : p.leader === "rena" ? ch.ultimateLuna
          : ch.ultimateSolar
        );
      }
      // ชเรด เอลัน: หลังรวมร่าง — สกิลพื้นฐาน/รองเปลี่ยนเป็นเวอร์ชันสปาด้า และปุ่มท่าไม้ตายเป็น แด่เพื่อนรักของฉัน
      if (ch.id === "shrade_elan" && p.shradeForm) {
        basicPub = pub(ch.basic2);
        secondaryPub = pub(ch.secondary2);
        ultimatePub = pub(ch.ultimate2);
      }
      // เรียวกิ ชิกิ: ท่าไม้ตายตามที่เลือกไว้ตอนเลือกตัว + ระหว่างความตายที่โรยรา ปกสกิล 1 เปลี่ยน
      if (ch.id === "shiki") {
        ultimatePub = pub((p.shikiUlt || "deatheye") === "wither" ? ch.ultimate2 : ch.ultimate);
        if (basicPub && (p.statuses.wither || 0) > 0) basicPub.img = "/characters/shiki/shiki_skill1.2.webp";
      }
      return {
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        img: displayImg(p),
        position: p.position,
        color: POSITION_COLORS[p.position] || "#888",
        locked: p.locked,
        busted: (show || promoShow) ? bustedOf(p) : false,
        result: p.result,
        cardCount: p.cards.length,
        cards: mine ? p.cards : null,
        score: (show || promoShow) ? scoreOf(p) : null,
        hp: p.hp, maxHp: MAX_HP,
        armor: p.armor, maxArmor: maxArmorOf(p),
        shield: p.shield,
        tempHp: p.tempHp || 0, // เลือดชั่วคราว (แกมเบลอร์)
        // เอฟเฟครอบการ์ด (เห็นทุกคน): เขี้ยวปฏิปักษ์สีเขียว (ถาวร) / เกราะราชันสีแดง (ตอนสวม)
        beat: !!(p.seen && p.seen.beat),
        rachan: !!(p.seen && p.seen.rachan) && (p.statuses.rachan || 0) > 0,
        skillPoints: p.skillPoints, maxSkill: maxSkillOf(p), // Bard: เพดานพลังงาน 9
        beamAmmo: p.beamAmmo,
        puddingUses: p.puddingUses,
        gamblerUses: p.gamblerUses, // แกมเบลอร์: จำนวนวอสก้าหน่อยน้องคงเหลือ
        profit: p.profit || 0,      // แกมเบลอร์: บัฟกำไรเท่าตัวโว้ยสะสม
        sunriseDrop: p.sunriseDrop || 0, // โอเบรอน: จำนวนเทิร์นที่จะเสียเลือด 1/เทิร์นจากรุ่งอรุณแห่งวันใหม่
        appleItem: p.appleItem || "drink", // Apple guy: ของส่งมอบที่เลือกอยู่
        appleAtk: p.appleAtk || 0,         // Apple guy: บัฟพลังโจมตีจากการมอบของ (ไม่ซ้อนทับ)
        appleGiveUses: p.appleGiveUses != null ? p.appleGiveUses : APPLE_GIVE_USES, // Apple guy: จำนวนใช้ เอาไปสิ คงเหลือ
        coins: p.coins || 0,               // โคโตเนะ: coin ในกระปุกออมสิน (สูงสุด 6)
        danceBuff: !!p.danceBuff,          // โคโตเนะ: บัฟ Dance Lession (ใบ้สกิลของท่าไม้ตาย +1 เทิร์น)
        leader: p.leader || "apollo",      // อควาเรียน: ผู้นำที่เลือกอยู่ (apollo/sirius/rena)
        fused: !!p.fused,                  // อควาเรียน: กำลังรวมร่างหุ่นศักดิ์สิทธิ์อยู่ไหม
        shradeForm: !!p.shradeForm,        // ชเรด เอลัน: รวมร่างทำนองเพลงแล้ว (อควาเรียน สปาด้า — ถาวร)
        bardNotes: p.bardNotes || [],      // Bard: โน้ตในช่องประพันธ์เพลง (ทุกคนเห็นได้)
        bardNotesUsed: p.bardNotesUsed || 0, // Bard: โน้ตที่เติมไปแล้วเทิร์นนี้ (จำกัด 2)
        bloodSection: p.bloodSection || 0, // Bard: ท่อนทำนองแห่งโลหิต (ครบ 5 = มิติโลหิต)
        soulSection: p.soulSection || 0,   // Bard: ท่อนทำนองแห่งวิญญาณ (ครบ 5 = มิติวิญญาณ)
        bardPending: p.bardPending ? { name: p.bardPending.name, need: p.bardPending.need, allowSelf: p.bardPending.allowSelf } : null, // Bard: บทเพลงรอเลือกเป้าหมาย
        shikiUlt: p.shikiUlt || "deatheye", // ชิกิ: ท่าไม้ตายที่เลือกตอนเข้าห้อง (deatheye | wither)
        lightDew: p.lightDew || 0,         // อควาเรียน: แสงละอองสะสม (สูงสุด 10)
        reviveIn: p.reviveIn || 0,         // อควาเรียน: จำนวนเทิร์นก่อนฟื้นคืนชีพจากไปยังพฤกษาแห่งชีวิต
        contractPartnerId: p.contractPartner || null, // เจ้าแห่งเน็ตบ้าน: คู่สัญญาปัจจุบัน
        contractWithId: p.contractWith || null,       // คู่สัญญา: ทำสัญญากับเจ้าแห่งเน็ตบ้านคนไหน
        contractTurns: p.contractTurns || 0,          // จำนวนเทิร์นที่ใช้บริการมาแล้ว (ครบทุก 3 = ถามต่อสัญญา)
        skillDrain: p.skillDrain || 0,                // ค่าปรับปฏิเสธข้อเสนอ: แต้มจบเทิร์นลด 1 (เทิร์นที่เหลือ)
        chillDodge: p.chillDodge != null ? p.chillDodge : 100, // Apple guy: อัตราหลบปัจจุบัน (%)
        reiju: p.reiju,       // ฟุจิมารุ: เรจูอาคมบัญชาคงเหลือ (UI พิเศษ reiju0-3.jpg)
        mageUses: p.mageUses, // จอมเวทย์ฝึกหัด: กดไปแล้วกี่ครั้งในเทิร์นนี้ (สูงสุด 3)
        tonkatsu: p.tonkatsu || 0, // เทมาริ: ชามทงคัสสึสะสม (UI สะสมชาม)
        atCap: scoreOf(p) >= scoreCap(p), // แต้มเต็มเพดาน (21/UPG) -> ปิดปุ่มจั่ว รอเปิดไพ่เอง
        skillUsed: !!p.skillUsedRound,    // ใช้สกิลไปแล้วในเทิร์นนี้ (1 อันต่อเทิร์น)
        alive: p.alive,
        statuses: show ? { ...p.statuses, ...(p.ntdTarget ? { ntd: 1 } : {}) } : publicStatuses(p),
        character: {
          // โอเบรอน: กลางคืนสลับชื่อ + สกิลรอง/ท่าไม้ตายเป็นเวอร์ชันกลางคืน (ฝันร้ายยามค่ำคืน / Lie Like Vortigern)
          // อควาเรียน: ลงสนามเป็นชื่อผู้นำ รวมร่างแล้วเป็นชื่อหุ่น (ปีกแห่งสุริยันตอนร่างสุดท้าย)
          id: ch.id,
          // อควาเรียน: ล็อบบี้โชว์ชื่อเต็ม — ลงสนามเป็นชื่อผู้นำ/หุ่นตามร่าง
          name: ch.id === "aquarion" ? (gameState === "LOBBY" ? ch.name : aquaDisplayName(p))
            : ch.id === "shrade_elan" && p.shradeForm ? SHRADE_SPADA_NAME
            : nightNow && ch.nightName ? ch.nightName : ch.name,
          passive: ch.passive ? { name: ch.passive.name, desc: ch.passive.desc } : null,
          basic: basicPub,
          secondary: secondaryPub,
          ultimate: ultimatePub,
        },
        dmgHp: p.dmgHp, dmgArmor: p.dmgArmor, gainedSkill: p.gainedSkill,
        wasAttacked: p.wasAttacked, isWinner: p.isWinner, isLoser: p.isLoser,
      };
    }),
  };
}
function broadcastState() {
  for (const id of Object.keys(players)) io.to(id).emit("state", buildStateFor(id));
}
function broadcastPositions() {
  for (const [sid, sock] of io.sockets.sockets) sock.emit("positions", positionsFor(sid));
}


// ============================================================
//  cutscene
// ============================================================
// ครั้งแรกต่อเกม/ต่อคน = เล่นวีดีโอเต็ม (หยุดกระดาน), ครั้งต่อไป = แค่การ์ดแจ้งเตือนเล็กๆ ไม่หยุดเกม
function triggerCutscene(p, key) {
  if (p.cutsceneShown[key]) notifyTransform(p, key);
  else { p.cutsceneShown[key] = true; queueCutscene(p, key); }
}
function queueCutscene(p, key) {
  const t = TRANSFORMS[key];
  if (!t) return;
  cutsceneQueue.push({
    seconds: t.seconds,
    info: {
      playerId: p.id, name: p.name,
      img: t.img, color: POSITION_COLORS[p.position] || "#9B4F96",
      video: t.video, title: t.title, label: t.label, voice: t.voice || null,
    },
  });
}
// การ์ดแจ้งเตือนเล็กๆ (ครั้งที่ 2 เป็นต้นไป): ส่งทันทีแบบเดียวกับ skillFlash — ไม่ตัดเข้าเฟส CUTSCENE
// ไม่หยุดเวลา/กระดาน แค่บอกว่าใครใช้ท่าอะไรซ้ำ
function notifyTransform(p, key) {
  const t = TRANSFORMS[key];
  if (!t) return;
  io.emit("transformNotice", {
    playerId: p.id, name: p.name,
    img: t.img, color: POSITION_COLORS[p.position] || "#9B4F96",
    title: t.title, label: t.label,
  });
}
// ประกาศเปลี่ยนร่าง (เอฟเฟกต์ระเบิด + ชื่อ + เสียงพากย์) — ต่อจากวีดีโอ ก่อนขึ้นสรุปผล/คนอื่น
//  seconds ≈ ความยาวเสียงพากย์ เพื่อให้เสียงเล่นจบก่อนขึ้นฉากถัดไป (ไม่ทับวีดีโอคนอื่น)
function queueTransformAnnounce(p, kind) {
  const t = TRANSFORMS[kind];
  if (!t) return;
  cutsceneQueue.push({
    seconds: kind === "beat" ? 9 : 7,
    info: {
      playerId: p.id, name: p.name,
      img: OHGER_FORM, color: POSITION_COLORS[p.position] || "#9B4F96",
      title: t.title, voice: t.voice || null, kind, announce: true,
    },
  });
}
// พักช่วงจั่วการ์ดไว้ เล่น cutscene ให้จบ แล้วกลับมาจั่วต่อด้วยเวลาที่เหลือ
// (ใช้กับสกิลที่แปลงร่างทันทีก่อนเปิดไพ่ เช่น MonsterLive)
function pausePlayingForCutscene() {
  const remain = Math.max(3, timeLeft);
  clearPhaseTimer();
  runCutsceneQueue(() => {
    gameState = "PLAYING";
    startPhaseTimer(remain, resolveRound);
    broadcastState();
    checkAllLocked();
  });
}
function runCutsceneQueue(onDone) {
  if (cutsceneQueue.length === 0) { cutsceneInfo = null; onDone(); return; }
  const c = cutsceneQueue.shift();
  cutsceneInfo = { ...c.info, id: ++cutsceneSeq }; // id ใหม่ทุกครั้ง -> client remount วีดีโอ
  gameState = "CUTSCENE";
  startPhaseTimer(c.seconds, () => runCutsceneQueue(onDone));
  broadcastState();
}


// ============================================================
//  วงจรรอบ
// ============================================================
function startMatch() {
  for (const p of Object.values(players)) resetCombat(p);
  roundNumber = 0;
  cycleShift = 0;
  nightResetPending = false;
  oberonDevour = 0;
  dayForceUntil = 0;
  dealRound();
}

function dealRound() {
  clearPhaseTimer();
  roundNumber++;
  // รีเซ็ตเวลากลางคืน (Lie Like Vortigern): นับกลางคืนใหม่ — เทิร์นนี้เป็นคืนที่ 1 จาก 3
  const prevNight = isNightRound(roundNumber - 1); // เช็คด้วยวงจรเดิมก่อนเลื่อน (กันแบนเนอร์สลับเวลาเด้งผิด)
  if (nightResetPending) {
    nightResetPending = false;
    cycleShift = roundNumber - (CYCLE_TURNS + 1); // ให้เทิร์นนี้ตรงกับคืนแรกของวงจร
  }
  lastLog = [];
  attackerId = null;
  roundWinnerId = null;
  roundTiedWin = false;
  cutsceneQueue = [];
  cutsceneInfo = null;
  lastAttack = null;
  roundSkills = [];
  anataMusicSeq = 0;

  for (const p of Object.values(players)) {
    resetRoundDisplay(p);
    p.shield = 0;
    p.skillUsedRound = false; // เทิร์นใหม่ ใช้สกิลได้อีก 1 อัน
    p.bardNotesUsed = 0;      // Bard: นับโน้ตใหม่ทุกเทิร์น (จำกัด 2 — มิติวิญญาณไม่จำกัด)
    p.mageUses = 0;           // จอมเวทย์ฝึกหัด: นับใหม่ทุกเทิร์น (กดได้ 3 ครั้งต่อเทิร์น)
    p.anataTargets = null;
    p.nightmareTarget = null;
    // ห้ามจั่วการ์ดเพิ่มที่ตั้งไว้จากเทิร์นก่อน (ทงคัสสึ / กำไรเท่าตัวโว้ย) — noDrawNext เป็นจำนวนเทิร์น
    if (p.noDrawNext) {
      p.statuses.nodraw = Math.max(p.statuses.nodraw || 0, Number(p.noDrawNext) || 1);
      p.noDrawNext = 0;
    }
    // ห้ามใช้สกิลที่ตั้งไว้จากเทิร์นก่อน (หอกลองกินัส เอวา 13)
    if (p.noSkillNext) {
      p.statuses.noskill = Math.max(p.statuses.noskill || 0, Number(p.noSkillNext) || 1);
      p.noSkillNext = 0;
    }
    // ค่าปรับปฏิเสธข้อเสนอ (เจ้าแห่งเน็ตบ้าน): แต้มจบเทิร์นลด 1 — เริ่มนับเทิร์นถัดไปจากที่ปฏิเสธ
    if (p.skillDrainPending) {
      p.skillDrain = Math.max(p.skillDrain || 0, p.skillDrainPending);
      p.skillDrainPending = 0;
    }
    // ไปยังพฤกษาแห่งชีวิต (อควาเรียน): ตายระหว่างสถานะนี้ -> ฟื้นคืนชีพหลัง 12 เทิร์น (ถ้าเกมยังไม่จบ)
    if (!p.alive && p.reviveIn > 0) {
      p.reviveIn--;
      if (p.reviveIn <= 0) {
        p.alive = true;
        p.hp = 1; p.armor = 0; p.skillPoints = 0; p.shield = 0;
        p.statuses = {}; p.seen = {};
        p.fused = false; p.leader = "apollo"; p.lightDew = 0;
        p.locked = false; p.busted = false; p.result = null;
        lastLog.push(`🌳✨ ${p.name} ฟื้นคืนชีพจากพฤกษาแห่งชีวิต! (เลือด 1 เกราะ 0 แต้มสกิล 0)`);
      }
    }
    if (!p.alive) { p.cards = []; p.locked = true; p.busted = false; continue; }

    // [โหมงานหนัก] (โคโตเนะ): ติดสถานะตอนเริ่มเทิร์นถัดจากที่โหมงานกะดึก — เกราะ/โล่พังทั้งหมดและฟื้นไม่ได้
    if (p.overworkNext) {
      p.overworkNext = false;
      p.statuses.overwork = 4; // คงอยู่ 3 เทิร์น (+1 ชดเชยการลดสถานะตอนจบเทิร์น) — Sleeping time ลบก่อนได้
      p.armor = 0;
      p.shield = 0;
      lastLog.push(`🥵 ${p.name} ติดสถานะ [โหมงานหนัก] 3 เทิร์น — เกราะพังทั้งหมด ฟื้นเกราะไม่ได้ ใช้แต้มสกิลเพิ่ม 1 และเสี่ยงสตั้น 10% ทุกเทิร์น`);
    }

    // รุ่งอรุณแห่งวันใหม่ (โอเบรอน): เสียพลังชีวิตเทิร์นละ 1 หน่วยแบบไม่สนเกราะ (รวม 2 เทิร์น)
    //  ผลด้านลบจากสกิลหักเลือดได้เรื่อยๆ แต่ห้ามตาย — ค้างที่พลังชีวิต 1 หน่วย
    if ((p.sunriseDrop || 0) > 0) {
      p.sunriseDrop--;
      if (p.hp > 1 || (p.tempHp || 0) > 0) {
        loseHp(p);
        lastLog.push(`🌄 ${p.name} ผลรุ่งอรุณแห่งวันใหม่จางลง — พลังชีวิต -1${p.sunriseDrop > 0 ? ` (เหลืออีก ${p.sunriseDrop} เทิร์น)` : ""}`);
      } else {
        lastLog.push(`🌄 ${p.name} ผลรุ่งอรุณแห่งวันใหม่จางลง — พลังชีวิตเหลือ 1 จึงไม่ลดต่อ`);
      }
    }

    // แด่เพื่อนรักของฉัน (ชเรด เอลัน): ระหว่างชาร์จไม่เสียเลือดแล้ว (patch พิเศษ) — แจ้งนับถอยหลังอย่างเดียว
    if (shradeCharging(p)) {
      lastLog.push(`🎻 ${p.name} บรรเลงบทเพลงสุดท้าย — เหลืออีก ${p.statuses.shradecharge} เทิร์นจะปลดปล่อย`);
    }

    // เครื่องดื่มชูกำลัง (Apple guy): เพิ่มแต้มสกิล 1 แต่เสียพลัง 1 หน่วยต่อเทิร์น
    //  ความเสียหายธรรมดา (โดนโล่/เกราะก่อน ไม่เจาะเกราะ) และไม่ถึงตาย — เลือดค้างที่ 1
    if ((p.statuses.energy || 0) > 0) {
      addSkill(p, 1);
      if (p.shield > 0 || p.armor > 0 || (p.tempHp || 0) > 0 || p.hp > 1) {
        damageSoft(p);
        lastLog.push(`🥤 ${p.name} เครื่องดื่มชูกำลังออกฤทธิ์ — แต้มสกิล +1 เสียพลัง 1 หน่วย (เกราะก่อน)`);
      } else {
        lastLog.push(`🥤 ${p.name} เครื่องดื่มชูกำลังออกฤทธิ์ — แต้มสกิล +1 (พลังชีวิตเหลือ 1 จึงไม่ลด)`);
      }
    }

    // เกราะฟื้น 1 หน่วยทุก 2 เทิร์น (รอบเลขคู่) — จบเทิร์นช่วงกลางคืน: ฟื้นทุกเทิร์น
    // Beat Mode: หลังกันตายทำงาน เกราะจะไม่ฟื้นคืน (prevNight = เทิร์นที่เพิ่งจบเป็นกลางคืนตามวงจรเดิม)
    // [โหมงานหนัก] (โคโตเนะ): ฟื้นเกราะไม่ได้จนกว่าจะใช้ Sleeping time
    if (!p.armorLocked && !overworkActive(p) && (roundNumber % 2 === 0 || prevNight)) {
      p.armor = Math.min(maxArmorOf(p), p.armor + 1);
    }
    // คืนร่าง (อควาเรียน): ฟื้นฟูเกราะเพิ่ม +1 หน่วยทุกเทิร์น (ซ้อนกับการฟื้นเกราะปกติ) เป็นเวลา 3 เทิร์น
    if ((p.statuses.godarmor || 0) > 0 && p.armor < maxArmorOf(p)) {
      p.armor = Math.min(maxArmorOf(p), p.armor + 1);
      lastLog.push(`🛡️ ${p.name} คืนร่าง — เกราะฟื้นเพิ่ม +1`);
    }
    // จอมเวทย์ฝึกหัด (ฟุจิมารุ): ฟื้นพลังชีวิต 1 หน่วยตามจำนวนครั้งที่ใช้สกิลในเทิร์นก่อน
    if (p.mageHealNext > 0) {
      const heal = healHp(p, p.mageHealNext);
      if (heal > 0) {
        lastLog.push(`🪄 ${p.name} จอมเวทย์ฝึกหัด — ฟื้นพลังชีวิต +${heal}`);
      }
      p.mageHealNext = 0;
    }
    // เสือนอนกิน (เจ้าแห่งเน็ตบ้าน): ฟื้นพลังชีวิต 1 หน่วยในเทิร์นถัดไป (กรณีไม่มีคู่สัญญา)
    if ((p.healNextTurn || 0) > 0) {
      const heal = healHp(p, p.healNextTurn);
      if (heal > 0) lastLog.push(`🐯 ${p.name} เสือนอนกิน — ฟื้นพลังชีวิต +${heal}`);
      p.healNextTurn = 0;
    }
    // การตื่นขึ้น (Lai Rhyme Goodfellow โอเบรอน): ฟื้นพลังชีวิตเทิร์นละ 1 หน่วย
    if ((p.statuses.awaken || 0) > 0 && healHp(p, 1) > 0) {
      lastLog.push(`⏰ ${p.name} การตื่นขึ้น — ฟื้นพลังชีวิต +1`);
    }
    firePassive(p, "roundStart");

    // ---------- อควาเรียน: แสงสว่างที่สรรค์สร้าง (เช็คทุกรอบ เผื่อกลางวันเพิ่งเริ่มพร้อมแสงละอองเต็ม) ----------
    maybeGodwing(p);
    // ---------- อควาเรียน: ศรศักดิ์สิทธิ์ — พิษ ลดพลังชีวิตเป้าหมาย 1 หน่วยทุกเทิร์น ----------
    if ((p.statuses.aquapoison || 0) > 0 && p.hp > 1) {
      p.hp--; p.dmgHp++;
      lastLog.push(`☠️ ${p.name} ติดพิษศรศักดิ์สิทธิ์ — เสียพลังชีวิต -1 (เหลืออีก ${p.statuses.aquapoison - 1} เทิร์น)`);
    }
    p.cards = [];
    p.cards.push(drawCardFor(p));
    p.cards.push(drawCardFor(p));
    p.locked = false;
    p.busted = false;
    p.result = null;

    // หลับไหล (Lie Like Vortigern โอเบรอน): ออกการกระทำใดๆ ไม่ได้ทั้งเทิร์น
    // และเสียพลังชีวิตแบบไม่สนเกราะเทิร์นละ 1 หน่วย — หักได้เรื่อยๆ แต่ห้ามตาย (ค้างที่ 1 หน่วย)
    if ((p.statuses.sleep || 0) > 0) {
      p.locked = true;
      if (p.hp > 1) { p.hp--; p.dmgHp++; }
      lastLog.push(`💤 ${p.name} หลับไหลจากคำลวงของราชาภูติ — ขยับไม่ได้ (เหลืออีก ${p.statuses.sleep} เทิร์น)`);
    }

    // ---------- อควาเรียน: ไปยังพฤกษาแห่งชีวิต — ทำอะไรไม่ได้เลย + ทุกคนเจ็บ 1 (ไม่สนเกราะ) ทุกเทิร์น ----------
    //  (ต้องล็อกหลังแจกไพ่ — แจกไพ่รีเซ็ต locked = false)
    if ((p.statuses.godtree || 0) > 0) {
      p.locked = true;
      for (const o of alivePlayers()) {
        if (o.id === p.id) continue;
        dealDirect(o, 1);
        maybeBeatSave(o);
        maybeBeatMode(o);
        maybeEva3(o);
        maybeWakeKotone(o);
        o.wasAttacked = true;
        if (o.alive && o.hp <= 0) {
          instantDeath(o);
          lastLog.push(`💀 ${o.name} เลือดจริงหมด ตกรอบ!`);
        }
      }
      if (p.hp > 1) { p.hp--; p.dmgHp++; }
      p.armor = Math.min(maxArmorOf(p), p.armor + 2);
      lastLog.push(`🌳 ${p.name} ไปยังพฤกษาแห่งชีวิต — ทุกคนเจ็บ -1 (ไม่สนเกราะ) ตัวเองเสียเลือด -1 (ไม่สนเกราะ) เกราะฟื้น +2`);
    }

    // ---------- ฟุจิตะ โคโตเนะ (patch 1.9.1) ----------
    // Sleeping time: หลับตลอดเฟสกลางคืน (ฟื้น 2/เทิร์น) — ถึงเช้าตื่นรับ [เช้าที่สดใส] 3 เทิร์น
    if ((p.statuses.ksleep || 0) > 0) {
      if (isNightRound(roundNumber)) {
        p.locked = true;
        const heal = healHp(p, 2);
        lastLog.push(`😴 ${p.name} หลับพักผ่อนอยู่ — ฟื้นพลังชีวิต +${heal}`);
      } else {
        delete p.statuses.ksleep;
        p.statuses.fresh = 3;
        lastLog.push(`🌅 ${p.name} ตื่นนอนอย่างสดชื่น — ได้รับ [เช้าที่สดใส] 3 เทิร์น (แต้มสกิล +1 และโล่ +1 ทุกเทิร์น)`);
      }
    }
    // [เช้าที่สดใส]: แต้มสกิล +1 และโล่ +1 ทุกเทิร์นที่ผลยังอยู่
    if ((p.statuses.fresh || 0) > 0) {
      addSkill(p, 1);
      p.shield += 1;
      lastLog.push(`🌅 ${p.name} เช้าที่สดใส — แต้มสกิล +1 และโล่ +1`);
    }
    // เจอท่านประธานเซนะจัง: เทิร์นนี้ทำอะไรไม่ได้เลย
    if (p.senaNext) {
      p.senaNext = false;
      p.statuses.sena = 1;
      p.locked = true;
      lastLog.push(`🏃‍♀️ ${p.name} มัวแต่หลบหนีท่านประธานเซนะจัง — ทำอะไรไม่ได้เลยทั้งเทิร์น!`);
    }
    // [โหมงานหนัก]: สุ่มสตั้น 20% ต่อเทิร์น
    if (overworkActive(p) && !p.locked && Math.random() < KOTONE_STUN_CHANCE) {
      p.statuses.kstun = 1;
      p.locked = true;
      lastLog.push(`😵 ${p.name} หมดแรงจาก [โหมงานหนัก] — สตั้น ขยับไม่ได้ทั้งเทิร์น!`);
    }

    // Bard: ถูกขัดจังหวะการประพันธ์ (หลับ/สตั้น/ใบ้สกิล ฯลฯ) -> โน้ตทั้งหมดถูกรีเซ็ต
    if (p.characterId === "bard" && (p.bardNotes || []).length &&
      (p.locked || (p.statuses.noskill || 0) > 0)) {
      p.bardNotes = [];
      lastLog.push(`🎼💔 ${p.name} ถูกขัดจังหวะการประพันธ์เพลง — โน้ตทั้งหมดถูกรีเซ็ต!`);
    }
  }

  // ความตายที่โรยรา (ชิกิ patch 2.0.6): ทุกเทิร์นที่ท่าไม้ตายยังทำงาน มอบเส้นชีวิต +1
  //  ให้ผู้เล่นทุกคนยกเว้นตัวเอง (สะสมได้สูงสุด 8 หน่วยต่อคน)
  for (const s of alivePlayers()) {
    if (s.characterId !== "shiki" || !((s.statuses.wither || 0) > 0)) continue;
    for (const o of alivePlayers()) {
      if (o.id === s.id) continue;
      o.statuses.deathline = Math.min(SHIKI_WITHER_LINE_MAX, (o.statuses.deathline || 0) + 1);
    }
    lastLog.push(`🥀 ความตายที่โรยรา — ${s.name} มอบเส้นชีวิต +1 ให้ผู้เล่นทุกคน (เหลืออีก ${Math.max(0, (s.statuses.wither || 0) - 1)} เทิร์น)`);
  }

  // ชำระค่าบริการ (เจ้าแห่งเน็ตบ้าน): คู่สัญญาใช้งานครบทุกๆ 3 เทิร์น -> ขึ้นวีดีโอก่อน (ครั้งแรกต่อเกม
  //  ครั้งถัดไปแจ้งเตือนเล็กๆ) แล้วถามคู่สัญญาว่าจะต่อสัญญาไหมระหว่างช่วงจั่วการ์ด
  for (const b of alivePlayers()) {
    if (b.characterId !== "broadband_man") continue;
    const t = contractPartnerOf(b);
    if (!t) continue;
    b.contractTurns = (b.contractTurns || 0) + 1;
    if (b.contractTurns % CONTRACT_CYCLE === 0) {
      t.renewPending = true;
      triggerCutscene(b, "broadbandBill");
      lastLog.push(`📶 ${b.name} เรียกเก็บค่าบริการ — ${t.name} ต้องเลือกต่อสัญญา (${CONTRACT_FEE} แต้ม) หรือยกเลิกสัญญา`);
    }
  }

  // สลับช่วงเวลากลางวัน/กลางคืน (ทุก 3 เทิร์น): โอเบรอนสลับร่างอัตโนมัติ
  const night = isNightRound(roundNumber);
  if (!night && oberonDevour) {
    oberonDevour = 0; // ราตรีกลืนกิน หายไปเมื่อหมดกลางคืน
    lastLog.push("🌄 ราตรีกลืนกินจางหายไปพร้อมแสงแรกของวัน");
  }
  if (roundNumber > 1 && night !== prevNight) {
    lastLog.push(night ? "🌙 ราตรีมาเยือน — เกราะจะฟื้นทุกเทิร์น" : "☀️ ฟ้าสางแล้ว — จบเทิร์นได้แต้มสกิลเพิ่ม +1");
    for (const p of alivePlayers()) {
      if (p.characterId !== "oberon") continue;
      if (night) triggerCutscene(p, "oberonNight"); // ครั้งแรกเล่นวีดีโอ morning_tonight.mp4 / ครั้งถัดไปแจ้งเตือนเล็กๆ
      else notifyTransform(p, "oberonDay");         // กลับร่างกลางวัน = แจ้งปกติ ไม่มีวีดีโอ
    }
    // เสียงไพเราะที่กึกก้อง (ชเรด เอลัน): เข้ากลางคืนพร้อมท่วงทำนองครบ 5 -> เล่นวีดีโอเปิดตัว
    if (night) {
      for (const p of alivePlayers()) {
        if (p.characterId !== "shrade_elan" || p.shradeForm) continue;
        if ((p.statuses.melody || 0) >= SHRADE_MELODY_MAX) triggerCutscene(p, "shradePassive");
        lastLog.push(`🎻 ${p.name} เสียงไพเราะที่กึกก้อง — ราตรีปลดล็อกท่าไม้ตาย รวมร่างทำนองเพลง`);
      }
    }
    // ไปยังพฤกษาแห่งชีวิต (อควาเรียน): คงอยู่จนกว่ากลางวันจะหมด — กลางคืนมาเยือนแล้วผลสิ้นสุดลง
    if (night) {
      for (const p of alivePlayers()) {
        if (p.characterId === "aquarion" && (p.statuses.godtree || 0) > 0) {
          delete p.statuses.godtree;
          lastLog.push(`🌳 ${p.name} กลางวันหมดลง — ไปยังพฤกษาแห่งชีวิตสิ้นสุด`);
        }
      }
    }
  }

  gameState = "PLAYING";
  startPhaseTimer(CARD_TIME, resolveRound);
  if (cutsceneQueue.length) { pausePlayingForCutscene(); return; } // วีดีโอสลับร่างโอเบรอนตอนเข้ากลางคืน
  broadcastState();
  checkAllLocked();
}

function hit(id) {
  const p = players[id];
  if (gameState !== "PLAYING" || !p || !p.alive || p.locked) return;
  if ((p.statuses.nodraw || 0) > 0) return; // อิ่มทงคัสสึเกิน: เทิร์นนี้จั่วเพิ่มไม่ได้
  if (shradeCharging(p)) return; // แด่เพื่อนรักของฉัน: ระหว่างชาร์จจั่วการ์ดเพิ่มไม่ได้
  if (scoreOf(p) >= scoreCap(p)) return; // แต้มเต็มเพดาน (เช่น 21 พอดี) = จั่วไม่ได้ รอผู้ใช้ใช้สกิล/เปิดไพ่เอง
  // โชคลาภ (Fate's Prelude / มิติโลหิต — Bard): การจั่วครั้งถัดไปได้ใบที่ดีที่สุดที่ไม่ทำให้แตก
  //  (ซ้อนทับได้ — หมดไปทีละ 1 ต่อการจั่ว 1 ครั้ง)
  if ((p.statuses.fortune || 0) > 0) {
    p.statuses.fortune--;
    if (p.statuses.fortune <= 0) delete p.statuses.fortune;
    const used = new Set(p.cards.map((c) => c.value));
    const avail = [];
    for (let v = 1; v <= 10; v++) if (!used.has(v)) avail.push(v);
    const room = 21 - calculateScore(p.cards);
    const good = avail.filter((v) => v <= room);
    const v = good.length ? Math.max(...good) : Math.min(...avail);
    p.cards.push({ value: v });
    lastLog.push(`🍀 ${p.name} โชคลาภนำทางการจั่ว — ได้ไพ่ใบที่ดีที่สุด`);
  } else {
    p.cards.push(drawCardFor(p));
  }
  p.busted = bustedOf(p);
  if (p.busted) { p.locked = true; voidUltimateOnBust(p); maybeMoonBurst(p); }
  // ถึงเพดานพอดี: ไม่ล็อกอัตโนมัติ — ปิดปุ่มจั่ว (atCap) แล้วรอผู้ใช้เลือกสกิลก่อนเปิดไพ่เอง
  broadcastState();
  checkAllLocked();
}
function lock(id) {
  const p = players[id];
  if (gameState !== "PLAYING" || !p || !p.alive || p.locked) return;
  p.locked = true;
  broadcastState();
  checkAllLocked();
}
function useSkill(id, tier, targets, item) {
  const p = players[id];
  if (!p || !p.alive) return;
  // อควาเรียน: ไปยังพฤกษาแห่งชีวิต — กดปุ่มท่าไม้ตายซ้ำเพื่อยกเลิกได้แม้กำลังล็อกอยู่ (ก่อนเปิดการ์ดเท่านั้น)
  if (gameState === "PLAYING" && p.characterId === "aquarion" && tier === "ultimate" && (p.statuses.godtree || 0) > 0) {
    delete p.statuses.godtree;
    lastLog.push(`🌳 ${p.name} ยกเลิกไปยังพฤกษาแห่งชีวิต`);
    io.emit("skillFlash", { name: "ไปยังพฤกษาแห่งชีวิต — ยกเลิก", img: TRANSFORMS.godtree.img, by: p.name, color: POSITION_COLORS[p.position] || "#9B4F96" });
    broadcastState();
    return;
  }
  if (gameState !== "PLAYING" || p.locked) return;
  if (!["basic", "secondary", "ultimate"].includes(tier)) return;
  if (shradeCharging(p)) return; // แด่เพื่อนรักของฉัน: ระหว่างชาร์จใช้สกิลอื่นไม่ได้
  // ---------- Bard : คีตกวี — เติมโน้ตประพันธ์เพลง (ช่องที่ 3 ไม่ใช่สกิล กดใช้ไม่ได้) ----------
  if (p.characterId === "bard") {
    if (tier === "ultimate") return; // ช่องประพันธ์เพลง — ไม่ใช่ปุ่มสกิล
    if ((p.statuses.noskill || 0) > 0) return;
    if (p.bardPending) return; // ต้องเลือกเป้าหมายบทเพลงที่ค้างอยู่ก่อน
    // จำกัด 2 โน้ตต่อเทิร์น (patch 2.0.5) — ระหว่างมิติมายาบรรเลง (โลหิต/วิญญาณ) ไม่ติดลิมิต 2
    //  แต่กดสกิลได้สูงสุด 9 ครั้งต่อเทิร์น (patch 2.0.5.1)
    const dimOn = (p.statuses.soulDim || 0) > 0 || (p.statuses.bloodDim || 0) > 0;
    if ((p.bardNotesUsed || 0) >= (dimOn ? BARD_DIM_NOTES_PER_TURN : BARD_NOTES_PER_TURN)) return;
    if (p.skillPoints < BARD_NOTE_COST) return;
    const free = Math.random() < BARD_NOTE_FREE_CHANCE; // 20% ไม่เสียพลังงาน
    if (!free) p.skillPoints -= BARD_NOTE_COST;
    p.bardNotesUsed = (p.bardNotesUsed || 0) + 1;
    const note = tier === "basic" ? "R" : "J";
    p.bardNotes = p.bardNotes || [];
    p.bardNotes.push(note);
    io.emit("bardSfx", { kind: "note", idx: p.bardNotes.length }); // เสียงเติมโน๊ตตามช่องที่ 1-3
    io.emit("skillFlash", {
      name: `${note === "R" ? "Crimson ❤️" : "Jade 💚"} — โน้ตช่องที่ ${p.bardNotes.length}/3${dimOn ? " (มิติมายาบรรเลง)" : ""}${free ? " (พรสวรรค์ ไม่เสียพลังงาน)" : ""}`,
      img: note === "R" ? BARD_CRIMSON_IMG : BARD_JADE_IMG,
      by: p.name, color: POSITION_COLORS[p.position] || "#9B4F96",
    });
    lastLog.push(`🎼 ${p.name} เติมโน้ต${note === "R" ? "ทำนองแห่งโลหิต ❤️" : "ทำนองแห่งวิญญาณ 💚"} (ช่องที่ ${p.bardNotes.length}/3)${free ? " — ไม่เสียพลังงาน" : ""}`);
    if (p.bardNotes.length >= 3) bardCompose(p, true);
    broadcastState();
    checkAllLocked();
    return;
  }
  const ch = CHAR_BY_ID[p.characterId];
  let skill = ch && ch[tier];
  // ชเรด เอลัน: หลังรวมร่าง — สกิลพื้นฐานเปลี่ยนเป็นเวอร์ชันสปาด้า (4 แต้ม ฟื้นเลือดอย่างเดียว)
  //  และปุ่มท่าไม้ตายถูกแทนที่ด้วย แด่เพื่อนรักของฉัน
  if (ch && ch.id === "shrade_elan") {
    if (tier === "basic" && p.shradeForm) skill = ch.basic2;
    if (tier === "secondary" && p.shradeForm) skill = ch.secondary2;
    if (tier === "ultimate") skill = p.shradeForm ? ch.ultimate2 : ch.ultimate;
  }
  // เรียวกิ ชิกิ: ท่าไม้ตายตามที่เลือกไว้ตอนเลือกตัวละคร (ฉันมองเห็นมันแล้ว / ความตายที่โรยรา)
  if (ch && ch.id === "shiki" && tier === "ultimate") {
    skill = (p.shikiUlt === "wither") ? ch.ultimate2 : ch.ultimate;
  }
  // อควาเรียน: สกิลรองสลับ รวมร่าง/คืนร่าง — ท่าไม้ตายสลับตามร่างที่รวมอยู่ (โซล่า/มาร์/ลูน่า/ปีกแห่งสุริยัน)
  if (ch && ch.id === "aquarion") {
    if (tier === "secondary") skill = p.fused ? ch.secondaryRevert : ch.secondary;
    else if (tier === "ultimate") {
      skill = (p.statuses.godwing || 0) > 0 ? ch.ultimateGodwing
        : (p.fused && p.leader === "sirius") ? ch.ultimateMars
        : (p.fused && p.leader === "rena") ? ch.ultimateLuna
        : (p.fused && p.leader === "apollo") ? ch.ultimateSolar
        : null;
    }
  }
  if (!skill) return;
  // โอเบรอน/โคโตเนะ: สกิลสลับตามช่วงเวลา — กลางคืนใช้เวอร์ชันกลางคืนแทน
  if (tier === "ultimate" && ch.ultimateNight && isNightRound(roundNumber)) skill = ch.ultimateNight;
  if (tier === "secondary" && ch.secondaryNight && isNightRound(roundNumber)) skill = ch.secondaryNight;
  if (tier === "basic" && ch.basicNight && isNightRound(roundNumber)) skill = ch.basicNight;
  if ((p.statuses.noskill || 0) > 0) return; // โดนหอกลองกินัสปัก: เทิร์นนี้ใช้สกิลไม่ได้

  // เวลาทอง (แกมเบลอร์): แต้มที่ใช้ของสกิลพื้นฐาน/สกิลรองลดครึ่งหนึ่ง
  const isGambler = p.characterId === "gambler";
  const goldenOn = (p.statuses.golden || 0) > 0;
  let cost = skill.cost;
  if (isGambler && goldenOn && (tier === "basic" || tier === "secondary")) cost = Math.ceil(cost / 2);
  // [โหมงานหนัก] (โคโตเนะ): ใช้แต้มสกิลเพิ่มขึ้น 1 แต้มทุกสกิล
  if (p.characterId === "kotone" && overworkActive(p)) cost += 1;
  if (p.skillPoints < cost) return;

  const st = skill.effect && !Array.isArray(skill.effect) && skill.effect.type === "status" ? skill.effect.status : null;

  // จอมเวทย์ฝึกหัด (ฟุจิมารุ): กดซ้ำได้ถึง 3 ครั้งต่อเทิร์น — เป็นข้อยกเว้นของกฎ 1 สกิลต่อเทิร์น
  const isMage = p.characterId === "fujimaru" && tier === "basic";
  const mageRepeat = isMage && (p.mageUses || 0) > 0 && (p.mageUses || 0) < MAGE_USES_PER_TURN;
  // เวลาทอง (แกมเบลอร์): กดสกิลพื้นฐานซ้ำในเทิร์นเดียวได้ จนกว่าจำนวนใช้/แต้มจะหมด
  const isGamble = isGambler && tier === "basic";
  const gambleRepeat = isGamble && goldenOn;
  // เอาแบบนี้ได้ไหม (Apple guy สกิลพื้นฐาน): เลือกของส่งมอบ — ไม่นับเป็นการใช้สกิลของเทิร์น
  //  (ใช้แล้วยังเลือกใช้สกิลอื่นได้อีก 1 ครั้ง)
  const isApplePick = p.characterId === "appleguy" && tier === "basic";
  if (isApplePick && !APPLE_ITEMS[item]) return; // ต้องเลือกของที่มีจริงเท่านั้น
  // เปลี่ยนหัวหน้า (อควาเรียน สกิลพื้นฐาน): เลือกผู้นำ — ไม่นับเป็นการใช้สกิลของเทิร์น (ใช้แล้วยังใช้สกิลอื่นได้อีก 1 ครั้ง)
  const isAquaLeader = p.characterId === "aquarion" && tier === "basic";
  if (isAquaLeader && !AQUA_LEADERS[item]) return; // ต้องเลือกผู้นำที่มีจริงเท่านั้น
  const isAquaFuse = p.characterId === "aquarion" && tier === "secondary" && !p.fused;   // รวมร่างหุ่นศักดิ์สิทธิ์
  const isAquaRevert = p.characterId === "aquarion" && tier === "secondary" && p.fused;  // คืนร่าง
  if (p.skillUsedRound && !mageRepeat && !gambleRepeat && !isApplePick && !isAquaLeader) return; // ใช้สกิลได้เพียง 1 อันต่อเทิร์น (ซ้ำ/ซ้อนไม่ได้)
  if (isMage && (p.mageUses || 0) >= MAGE_USES_PER_TURN) return;
  // จอมเวทย์ฝึกหัด: ระหว่างเปิด Everything For Humanity ใช้ไม่ได้
  if (isMage && (p.statuses.humanity || 0) > 0) return;
  // Mystic Code (ฟุจิมารุ): ต้องมีเกราะเหลือ และต้องเปิด Everything For Humanity อยู่เท่านั้น
  const isMystic = p.characterId === "fujimaru" && tier === "secondary";
  if (isMystic && ((p.statuses.humanity || 0) <= 0 || p.armor < 1)) return;
  // Everything For Humanity: ต้องมีเรจูอาคมบัญชาครบ 3 เท่านั้น (ใช้หมดทั้ง 3 ตอนกด)
  if (st === "humanity" && (p.reiju || 0) < REIJU_USES) return;
  // Beat Mode (ประกายเขี้ยว): สกิลพื้นฐาน + ท่าไม้ตายใช้ไม่ได้ (ใช้ได้แค่สกิลรอง)
  if ((tier === "basic" || tier === "ultimate") && beatActive(p)) return;
  // ท่าไม้ตาย: กดซ้ำไม่ได้จนกว่าผลจะหมดเวลา (สวมเกราะราชันคงอยู่ถาวร = กดซ้ำไม่ได้อีกเลยตลอดเกม)
  if (tier === "ultimate" && st && (p.statuses[st] || 0) > 0) return;
  // เวลาทอง (แกมเบลอร์): ระหว่างบัฟยังอยู่ กดท่าไม้ตายซ้ำไม่ได้
  if (tier === "ultimate" && isGambler && goldenOn) return;
  // MonsterLive (ฮิคารุ): ระหว่างร่างไคจู ใช้ท่าไม้ตายไม่ได้
  if (tier === "ultimate" && p.characterId === "hikaru" && (p.statuses.monster || 0) > 0) return;
  // Rainbow Pudding (คุวากาตะ): ใช้ได้แค่ 2 ครั้งต่อเกม
  const isPudding = p.characterId === "kuwagata" && tier === "basic";
  if (isPudding && (p.puddingUses || 0) <= 0) return;
  // วอสก้าหน่อยน้อง (แกมเบลอร์): ใช้ได้ 3 ครั้งต่อเกม (เวลาทองรีเซ็ตให้เต็ม)
  if (isGamble && (p.gamblerUses || 0) <= 0) return;
  // หอกแห่งแคสเซียส (เอวา 13): ต้องมีเกราะเหลือให้หัก
  const isCassius = p.characterId === "eva13" && tier === "basic";
  if (isCassius && p.armor < 1) return;
  // Fourth Impact (เอวา 13): ใช้ได้เมื่อสกิลติดตัว 3 (เลือด <= 3) ทำงานอยู่เท่านั้น
  if (st === "fourth" && !eva3Active(p)) return;
  // ม่านแห่งราตรี (โอเบรอน): กดซ้ำไม่ได้จนกว่าผลเพิ่มพลังโจมตีจะหมด
  const isVeil = p.characterId === "oberon" && tier === "basic";
  if (isVeil && (p.statuses.veil || 0) > 0) return;
  // รุ่งอรุณแห่งวันใหม่ (โอเบรอน สกิลรองกลางวัน): เลือกเป้าหมาย 1 คน (ตัวเองได้) — ไม่มีคูลดาวน์
  const isSunrise = p.characterId === "oberon" && tier === "secondary" && !isNightRound(roundNumber);
  let sunriseTarget = null;
  if (isSunrise) {
    const tgs = Array.isArray(targets) ? [...new Set(targets)] : [];
    const t = tgs.length === 1 ? players[tgs[0]] : null;
    if (!t || !t.alive) return;
    sunriseTarget = t;
  }
  // ฝันร้ายยามค่ำคืน (โอเบรอน สกิลรองกลางคืน): เลือกเป้าหมาย 1 คน (คนอื่นเท่านั้น)
  //  ทำงานหลังเปิดการ์ด — ความเสียหาย 1 หน่วย × จำนวนการหลับไหลที่เหลือของเป้าหมาย
  const isNightmare = p.characterId === "oberon" && tier === "secondary" && isNightRound(roundNumber);
  let nightmareTarget = null;
  if (isNightmare) {
    const tgs = Array.isArray(targets) ? [...new Set(targets)] : [];
    const t = tgs.length === 1 ? players[tgs[0]] : null;
    if (!t || !t.alive || t.id === p.id) return;
    nightmareTarget = t.id;
  }
  // เอาไปสิ (Apple guy สกิลรอง): เลือกผู้เล่น 1 คน (คนอื่นเท่านั้น) มอบของที่เลือกไว้ทันทีก่อนเปิดการ์ด
  //  ใช้ได้จำนวนจำกัด 1 ครั้ง (เติมได้จากสกิลติดตัวเมื่อหลบสำเร็จ — สะสมไม่ได้) (patch 1.9.1)
  const isAppleGive = p.characterId === "appleguy" && tier === "secondary";
  let appleTarget = null;
  if (isAppleGive) {
    if ((p.appleGiveUses || 0) <= 0) return;
    const tgs = Array.isArray(targets) ? [...new Set(targets)] : [];
    const t = tgs.length === 1 ? players[tgs[0]] : null;
    if (!t || !t.alive || t.id === p.id) return;
    appleTarget = t;
  }
  // ---------- ฟุจิตะ โคโตเนะ (patch 1.9.1) ----------
  const isKotone = p.characterId === "kotone";
  const kotoneNight = isNightRound(roundNumber);
  const isPartTime = isKotone && tier === "basic";                    // Part-time (กลางวัน/กะดึก)
  const isDance = isKotone && tier === "secondary" && !kotoneNight;   // Dance Lession
  const isKSleep = isKotone && tier === "secondary" && kotoneNight;   // Sleeping time
  const isKawaii = isKotone && tier === "ultimate";                   // Sekai ichi kawaii watashi
  if (isPartTime && overworkActive(p)) return;                        // โหมงานหนัก: Part-time ใช้ไม่ได้
  if (isPartTime && (p.statuses.caught || 0) > 0) return;             // โดนโปรดิวเซอร์จับได้: ใช้ไม่ได้ชั่วคราว
  if (isDance && overworkActive(p)) return;                           // โหมงานหนัก: Dance Lession ใช้ไม่ได้
  if (isKawaii && (overworkActive(p) || kotoneNight)) return;         // ท่าไม้ตาย: ใช้ไม่ได้ตอนกลางคืน/โหมงานหนัก
  if (isKawaii && (p.coins || 0) < KOTONE_KAWAII_COIN_NEED) return;   // ท่าไม้ตาย: ต้องมี coin อย่างน้อย 3 เหรียญ (patch 2.0.6)
  if (isKSleep && (p.statuses.ksleep || 0) > 0) return;               // หลับอยู่แล้ว กดซ้ำไม่ได้
  // Dance Lession (patch พิเศษ): ใช้ใส่ตัวเองเท่านั้น — ไม่ต้องเลือกเป้าหมายอีกต่อไป
  // ---------- ชเรด เอลัน (patch พิเศษ) ----------
  const isShrade = p.characterId === "shrade_elan";
  const isShradeBasic = isShrade && tier === "basic";                        // เชิญรับฟัง
  const isShradeMoon = isShrade && tier === "secondary";                     // แสงจันทร์ส่องวิญญาณ
  const isShradeForm = isShrade && tier === "ultimate" && !p.shradeForm;     // รวมร่างทำนองเพลง
  const isShradeFinal = isShrade && tier === "ultimate" && p.shradeForm;     // แด่เพื่อนรักของฉัน
  if (isShradeForm) {
    if (!isNightRound(roundNumber)) return;                     // ปลดล็อกเฉพาะช่วงกลางคืน (สกิลติดตัว)
    if ((p.statuses.melody || 0) < SHRADE_MELODY_MAX) return;   // ต้องมีท่วงทำนองครบ 5
  }
  let shradeMoonTarget = null;
  if (isShradeMoon) {
    const tgs = Array.isArray(targets) ? [...new Set(targets)] : [];
    const t = tgs.length === 1 ? players[tgs[0]] : null;
    if (!t || !t.alive || t.id === p.id) return;
    shradeMoonTarget = t;
  }
  // ---------- เรียวกิ ชิกิ (patch 2.0.6) ----------
  const isShikiLifeline = p.characterId === "shiki" && tier === "secondary"; // นายมีฝีมือแค่ไหนหรอ?
  let shikiLifelineTarget = null;
  if (isShikiLifeline) {
    const tgs = Array.isArray(targets) ? [...new Set(targets)] : [];
    const t = tgs.length === 1 ? players[tgs[0]] : null;
    if (!t || !t.alive || t.id === p.id) return;
    shikiLifelineTarget = t;
  }
  // ---------- เจ้าแห่งเน็ตบ้าน (patch 1.9) ----------
  const isTiger = p.characterId === "broadband_man" && tier === "basic";     // เสือนอนกิน
  const isLan = p.characterId === "broadband_man" && tier === "secondary";   // กระชากสายแลน
  const isOffer = p.characterId === "broadband_man" && tier === "ultimate";  // สนใจใช้บริการเราไหม
  // กระชากสายแลน: ใช้ได้ก็ต่อเมื่อมีคู่สัญญาแล้ว
  if (isLan && !contractPartnerOf(p)) return;
  // สนใจใช้บริการเราไหม: ใช้ไม่ได้ระหว่างมีคู่สัญญา/มีข้อเสนอค้าง — เลือกเป้าหมาย 1 คน (คนอื่นเท่านั้น)
  let offerTarget = null;
  if (isOffer) {
    if (contractPartnerOf(p) || p.contractOffer) return;
    const tgs = Array.isArray(targets) ? [...new Set(targets)] : [];
    const t = tgs.length === 1 ? players[tgs[0]] : null;
    if (!t || !t.alive || t.id === p.id) return;
    offerTarget = t;
  }

  if (st === "beam" && (p.beamAmmo || 0) <= 0) return; // Beam Magnum กระสุนหมด ใช้ไม่ได้
  // Ohger Finish: ต้องมีทั้งสวมเกราะราชัน และ ประกายเขี้ยวปฏิปักษ์ ถึงจะใช้ได้ (+1 ความเสียหาย)
  if (st === "ohger" && !((p.statuses.rachan || 0) > 0 && (beatActive(p) || (p.seen && p.seen.beat)))) return;

  // ANATA WAAAAAAAA (เทมาริ): ต้องเลือกเป้าหมาย 1 คนก่อนใช้
  let anataTargets = null;
  if (st === "anata") {
    const avail = alivePlayers().filter((o) => o.id !== p.id);
    const need = Math.min(1, avail.length);
    if (need === 0) return;
    const tgs = Array.isArray(targets)
      ? [...new Set(targets)].filter((tid) => avail.some((o) => o.id === tid))
      : [];
    if (tgs.length !== need) return;
    anataTargets = tgs;
  }

  p.skillPoints -= cost;
  if (!isApplePick && !isAquaLeader) p.skillUsedRound = true; // เอาแบบนี้ได้ไหม / เปลี่ยนหัวหน้า: ไม่นับเป็นการใช้สกิลของเทิร์น

  // ---------- นายมีฝีมือแค่ไหนหรอ? (ชิกิ patch 2.0.6): ยกเลิกท่าไม้ตายทันทีที่มีผู้เล่นอื่นกด ----------
  //  มีชิกิถือชาร์จ godslay อยู่บนสนาม -> ท่าไม้ตายของผู้เล่นอื่นที่เพิ่งกดถูกยกเลิกทันที
  //  ไม่ว่าท่าจะทำงานก่อนหรือหลังเปิดการ์ด — แต้มสกิลที่จ่ายไปเสียฟรี (ไม่คืน) และเล่นวีดีโอแทนที่
  if (tier === "ultimate") {
    const slayer = alivePlayers().find(
      (s) => s.id !== p.id && s.characterId === "shiki" && (s.statuses.godslay || 0) > 0
    );
    if (slayer) {
      shikiCancelUltimate(slayer, p, skill);
      pausePlayingForCutscene();
      return;
    }
  }

  if (isPudding) p.puddingUses--; // นับใช้ Rainbow Pudding

  // ---------- Gambler the gambling: สกิลเสี่ยงโชค (จัดการใน engine โดยตรง) ----------
  let flashSuffix = ""; // ต่อท้ายชื่อสกิลบนป้ายเด้ง เพื่อบอกผลเสี่ยงโชคให้ทุกคนเห็น
  if (isGambler) {
    const jackpot = gamblerJackpot(p); // เช็คก่อนผลสกิลเปลี่ยนเลือด
    const win = Math.random() < gamblerChance(p, tier);
    if (tier === "basic") {
      // วอสก้าหน่อยน้อง: 50/50 ลดเลือดตัวเอง 1 หรือ ฟื้น 2 (แจ๊กพอต +1) — ฮีลล้นไปเกราะ/เลือดชั่วคราว
      p.gamblerUses--;
      if (win) {
        const heal = 2 + (jackpot ? 1 : 0);
        const got = healOverflow(p, heal);
        const parts = [];
        if (got.toHp > 0) parts.push(`เลือด +${got.toHp}`);
        if (got.toArmor > 0) parts.push(`เกราะ +${got.toArmor}`);
        if (got.toTemp > 0) parts.push(`เลือดชั่วคราว +${got.toTemp}`);
        flashSuffix = ` — ดวงมา! ฟื้น +${heal}`;
        lastLog.push(`🎰 ${p.name} วอสก้าหน่อยน้อง — ดวงมา! ฟื้น +${heal} (${parts.join(", ") || "เต็มหมดแล้ว"})`);
      } else {
        loseHp(p);
        flashSuffix = " — ดวงกุด เสียเลือด -1";
        lastLog.push(`🎰 ${p.name} วอสก้าหน่อยน้อง — ดวงกุด เสียพลังชีวิต -1`);
        // ผลสกิลตัวเองทำให้เลือดหมด -> ตายทันที ไม่ต้องรอจบเทิร์น
        if (p.hp <= 0) {
          instantDeath(p);
          lastLog.push(`💀 ${p.name} เสี่ยงดวงจนสิ้นลม — ตกรอบทันที!`);
        }
      }
    } else if (tier === "secondary") {
      // กำไรเท่าตัวโว้ย: 50/50 ห้ามจั่วเทิร์นนี้+เทิร์นหน้า หรือ +1 โจมตี (แจ๊กพอต +2) และทะลุเกราะ 1 ครั้ง (ถาวรจนได้ตี)
      if (win) {
        const gain = 1 + (jackpot ? 1 : 0);
        p.profit = (p.profit || 0) + gain;
        flashSuffix = ` — กำไรงาม! โจมตี +${gain} ทะลุเกราะ`;
        lastLog.push(`💰 ${p.name} กำไรเท่าตัวโว้ย — กำไรงาม! พลังโจมตี +${gain} และโจมตีครั้งถัดไปไม่สนเกราะ (คงอยู่จนกว่าจะได้ตี รวม +${p.profit})`);
      } else {
        p.statuses.nodraw = Math.max(p.statuses.nodraw || 0, 1);
        p.noDrawNext = Math.max(p.noDrawNext || 0, 1);
        flashSuffix = " — ขาดทุนยับ! ห้ามจั่ว 2 เทิร์น";
        lastLog.push(`💸 ${p.name} กำไรเท่าตัวโว้ย — ขาดทุนยับ! จั่วการ์ดเพิ่มไม่ได้ทั้งเทิร์นนี้และเทิร์นหน้า`);
      }
    } else {
      // เวลาทองของพี่มาแล้ว 777: 50/50 (สกิลติดตัวเพิ่มโอกาสได้) — พลาด = แต้มสกิลหายฟรี
      if (win) {
        p.statuses.golden = 5;
        p.skillPoints = Math.min(MAX_SKILL, p.skillPoints + 3); // สำเร็จ: คืนแต้ม 3 (กินจริงแค่ 3)
        p.skillUsedRound = false; // เทิร์นที่สำเร็จ ยังใช้สกิลต่อได้ (ไม่ติดกฎ 1 สกิลต่อเทิร์น)
        p.gamblerUses = GAMBLER_USES; // รีเซ็ตจำนวนใช้สกิลพื้นฐานกลับมาเต็ม
        p.seen.golden = true;
        p.transformAt = ++transformCounter;
        lastLog.push(`🎉 ${p.name} เวลาทองของพี่มาแล้ว 777 — แจ๊กพอต! บัฟเวลาทอง 5 เทิร์น (คืนแต้มสกิล 3 แต้ม)`);
        if (!p.cutsceneShown.golden) {
          p.cutsceneShown.golden = true;
          queueCutscene(p, "golden");
          pausePlayingForCutscene(); // เล่นวีดีโอทันทีก่อนเปิดไพ่ (แบบ MonsterLive)
        } else {
          notifyTransform(p, "golden");
        }
      } else {
        p.skillPoints = 0;
        flashSuffix = " — แห้ว! แต้มสกิลหายฟรี";
        lastLog.push(`💥 ${p.name} เวลาทองของพี่มาแล้ว 777 — แห้ว! เสียแต้มสกิลทั้งหมดฟรี`);
      }
    }
  }
  // ---------- เอวา 13: หอกแห่งแคสเซียส — หักเกราะตัวเอง 1 ฟื้นเลือด 1 ----------
  if (isCassius) {
    p.armor--;
    healHp(p, 1);
    lastLog.push(`🗡️ ${p.name} หอกแห่งแคสเซียส — หักเกราะ 1 ฟื้นพลังชีวิต +1`);
  }
  // ---------- โอเบรอน: ม่านแห่งราตรี — บัฟหมู่ก่อนเปิดการ์ด ----------
  if (isVeil) {
    for (const o of alivePlayers()) {
      o.statuses.veil = Math.max(o.statuses.veil || 0, 2); // พลังโจมตี +1 คงอยู่ 2 เทิร์น (รวมตัวเอง)
      healHp(o, 1);                                        // ฟื้นพลังชีวิตทุกคน +1 (รวมตัวเอง)
      o.armor = Math.min(maxArmorOf(o), o.armor + 1);      // ฟื้นเกราะทุกคน +1 (รวมตัวเอง)
      // ยามฟ้าสาง +2 ถาวร (สะสมสูงสุด 3) — คนที่กำลังหลับไหลจะไม่รับเพิ่ม (ผลก่อนหน้ายังไม่หมด)
      if (o.id !== p.id && !((o.statuses.sleep || 0) > 0)) o.statuses.dawn = Math.min(3, (o.statuses.dawn || 0) + 2);
    }
    lastLog.push(`🌙 ${p.name} ม่านแห่งราตรี — ทุกคนพลังโจมตี +1 (2 เทิร์น) ฟื้นเลือด/เกราะ +1 และติดยามฟ้าสาง +2 (ยกเว้นผู้ใช้/คนหลับ)`);
  }
  // ---------- โอเบรอน: รุ่งอรุณแห่งวันใหม่ — ฮีล 5 แลกกับเสียเลือด 1/เทิร์น 2 เทิร์น (ไม่สนเกราะ) ----------
  if (isSunrise && sunriseTarget) {
    const t = sunriseTarget;
    healHp(t, 5);
    t.sunriseDrop = 2; // หลังจากนั้นลดลงรวม 2 หน่วย — หักเทิร์นละ 1 แบบไม่สนเกราะ (ไม่ถึงตาย ค้างที่ 1)
    // ยามฟ้าสาง +1 — ไม่ติดถ้าใช้กับตัวเอง หรือเป้าหมายกำลังหลับไหล (ผลก่อนหน้ายังไม่หมด)
    if (t.id !== p.id && !((t.statuses.sleep || 0) > 0)) t.statuses.dawn = Math.min(3, (t.statuses.dawn || 0) + 1);
    flashSuffix = ` — ใส่ ${t.name}`;
    lastLog.push(`🌄 ${p.name} รุ่งอรุณแห่งวันใหม่ — ฟื้นพลังชีวิต ${t.name} +5 (2 เทิร์นถัดมาเสียเลือดเทิร์นละ 1 ไม่สนเกราะ)${t.id !== p.id && !(t.statuses.sleep > 0) ? " และติดยามฟ้าสาง +1" : ""}`);
  }
  // ---------- โอเบรอน: ฝันร้ายยามค่ำคืน — เก็บเป้าหมายไว้ ทำงานหลังเปิดการ์ด ----------
  if (isNightmare) p.nightmareTarget = nightmareTarget;
  // ---------- Apple guy: เอาแบบนี้ได้ไหม — เปลี่ยนของส่งมอบ (ปกสกิลเปลี่ยนตาม) ----------
  if (isApplePick) {
    p.appleItem = item;
    flashSuffix = ` — เลือก${APPLE_ITEMS[item].name}`;
    lastLog.push(`🍎 ${p.name} เอาแบบนี้ได้ไหม — เปลี่ยนของส่งมอบเป็น ${APPLE_ITEMS[item].name}`);
  }
  // ---------- อควาเรียน: เปลี่ยนหัวหน้า — เลือกผู้นำ + ฟื้นเลือด 1 ----------
  if (isAquaLeader) {
    p.leader = item;
    healHp(p, 1);
    flashSuffix = ` — เลือก${AQUA_LEADERS[item].name}`;
    lastLog.push(`🌊 ${p.name} เปลี่ยนหัวหน้า — เลือก${AQUA_LEADERS[item].name} และฟื้นพลังชีวิต +1`);
  }
  // ---------- อควาเรียน: รวมร่างหุ่นศักดิ์สิทธิ์ — แสงละออง +1 + วีดีโอแปลงร่างตามผู้นำ ----------
  if (isAquaFuse) {
    p.fused = true;
    p.lightDew = Math.min(AQUA_LIGHTDEW_MAX, (p.lightDew || 0) + AQUA_FUSE_DEW);
    const leader = AQUA_LEADERS[p.leader || "apollo"];
    flashSuffix = ` — ${leader.robotName}`;
    lastLog.push(`✨ ${p.name} รวมร่างหุ่นศักดิ์สิทธิ์ — กลายเป็น ${leader.robotName} (แสงละออง ${p.lightDew}/${AQUA_LIGHTDEW_MAX})`);
    triggerCutscene(p, leader.fuseKey);
    maybeGodwing(p);
    if (cutsceneQueue.length) pausePlayingForCutscene();
  }
  // ---------- อควาเรียน: คืนร่าง — เกราะ +1 + ฟื้นฟูเกราะเพิ่ม 3 เทิร์น + แสงละออง +2 ----------
  if (isAquaRevert) {
    p.fused = false;
    p.armor = Math.min(maxArmorOf(p), p.armor + 1);
    p.statuses.godarmor = Math.max(p.statuses.godarmor || 0, 4); // ฟื้นเกราะเพิ่ม +1/เทิร์น 3 เทิร์น (+1 ชดเชยการลดสถานะตอนจบเทิร์น)
    p.lightDew = Math.min(AQUA_LIGHTDEW_MAX, (p.lightDew || 0) + AQUA_REVERT_DEW);
    lastLog.push(`🛡️ ${p.name} คืนร่าง — เกราะ +1 และฟื้นฟูเกราะเพิ่ม 3 เทิร์น (แสงละออง ${p.lightDew}/${AQUA_LIGHTDEW_MAX})`);
  }
  // ---------- Apple guy: เอาไปสิ — มอบของที่เลือกให้เป้าหมายทันที + บัฟพลังโจมตี ----------
  if (isAppleGive && appleTarget) {
    p.appleGiveUses = Math.max(0, (p.appleGiveUses || 0) - 1); // จำกัด 1 ครั้ง (เติมจากสกิลติดตัว)
    const t = appleTarget;
    const itemKey = p.appleItem || "drink";
    const it = APPLE_ITEMS[itemKey];
    if (itemKey === "drink") {
      // เพิ่มแต้มสกิล 1 / เสียเลือด 1 ต่อเทิร์น คงอยู่ 2 เทิร์น (+1 ชดเชยการลดสถานะตอนจบเทิร์น)
      t.statuses.energy = Math.max(t.statuses.energy || 0, 3);
      lastLog.push(`🥤 ${p.name} เอาไปสิ — มอบเครื่องดื่มชูกำลังให้ ${t.name} (แต้มสกิล +1 / เสียเลือด 1 ต่อเทิร์น 2 เทิร์น)`);
    } else if (itemKey === "iphone") {
      // ฟื้นเกราะ 2 หน่วย แต่เสียพลังชีวิต 1 หน่วยแบบไม่สนเกราะ
      t.armor = Math.min(maxArmorOf(t), t.armor + 2);
      dealDirect(t, 1);
      maybeBeatSave(t);
      maybeBeatMode(t);
      maybeEva3(t);
      lastLog.push(`📱 ${p.name} เอาไปสิ — มอบไอโฟนเครื่องใหม่ให้ ${t.name} (เกราะ +2 / เสียเลือด 1 ไม่สนเกราะ)`);
      if (t.alive && t.hp <= 0) {
        instantDeath(t);
        lastLog.push(`💀 ${t.name} เลือดจริงหมด ตกรอบ!`);
      }
    } else {
      // ใบโปรโมทสินค้า: แต้มการ์ดของผู้รับถูกเปิดเผยให้ทุกคนเห็น คงอยู่ 1 เทิร์น
      t.statuses.promo = 1;
      lastLog.push(`📢 ${p.name} เอาไปสิ — แปะใบโปรโมทสินค้าให้ ${t.name} (ทุกคนเห็นแต้มการ์ดตลอดเทิร์นนี้)`);
    }
    // บัฟพลังโจมตี (patch 1.9): มอบของไม่ซ้ำ (คน+ชิ้น) = +1 (ไม่ซ้อนทับ — สูงสุด 1)
    //  มอบชิ้นเดิมให้คนเดิมซ้ำ = บัฟหายไป และล้างประวัติชิ้นนั้น (มอบอีกครั้งจะได้บัฟกลับคืน)
    p.appleGifts = p.appleGifts || {};
    const giftKey = `${t.id}:${itemKey}`;
    if (p.appleGifts[giftKey]) {
      delete p.appleGifts[giftKey];
      p.appleAtk = Math.max(0, (p.appleAtk || 0) - 1);
      lastLog.push(`🍎 ${p.name} มอบของชิ้นเดิมให้คนเดิมซ้ำ — บัฟพลังโจมตีจากการมอบของหายไป (ล้างประวัติชิ้นนั้น)`);
    } else {
      p.appleGifts[giftKey] = true;
      p.appleAtk = Math.min(APPLE_ATK_MAX, (p.appleAtk || 0) + 1);
      lastLog.push(`🍎 ${p.name} พลังโจมตีจากการมอบของ +1 (ไม่ซ้อนทับ)`);
    }
    flashSuffix = ` — มอบ${it.name}ให้ ${t.name}`;
  }
  // ---------- โคโตเนะ: Part-time (patch 2.0.6) — เสียเลือด 1 (ไม่ตาย) ได้ coin สุ่ม 1-3 ----------
  //  กลางคืนใช้ได้เหมือนกลางวันทุกอย่าง (ไม่มีระบบงานกะดึกแล้ว)
  if (isPartTime) {
    if (p.hp > 1 || (p.tempHp || 0) > 0) loseHp(p);
    const roll = 1 + Math.floor(Math.random() * KOTONE_COIN_GAIN_MAX);
    const gained = Math.min(KOTONE_COIN_MAX, (p.coins || 0) + roll) - (p.coins || 0);
    p.coins = (p.coins || 0) + gained;
    flashSuffix = ` — coin +${gained} (มี ${p.coins}/${KOTONE_COIN_MAX})`;
    lastLog.push(`🐷 ${p.name} Part-time — เสียพลังชีวิต 1 หน่วย ได้ coin +${gained} (สุ่มได้ ${roll} · สะสม ${p.coins}/${KOTONE_COIN_MAX})`);
    if (Math.random() < KOTONE_CAUGHT_CHANCE) {
      // โดนโปรดิวเซอร์จับได้: ใช้ Part-time ไม่ได้ 2 เทิร์น (+1 ชดเชยการลดสถานะตอนจบเทิร์น)
      p.statuses.caught = 3;
      lastLog.push(`🎬 ${p.name} โดนโปรดิวเซอร์จับได้! — ใช้ Part-time ไม่ได้ 2 เทิร์น`);
    }
  }
  // ---------- โคโตเนะ: Dance Lession (patch 2.0.6) — ใช้ใส่ตัวเองเท่านั้น: เสียเลือด 1
  //  บัฟท่าไม้ตายครั้งถัดไป: ความเสียหาย +1 ----------
  if (isDance) {
    if (p.hp > 1 || (p.tempHp || 0) > 0) loseHp(p);
    p.danceBuff = true;
    lastLog.push(`💃 ${p.name} Dance Lession — ซ้อมเต้นอย่างหนัก: ท่าไม้ตายครั้งถัดไป ความเสียหาย +1`);
  }
  // ---------- โคโตเนะ: Sleeping time — หลับตลอดเฟสกลางคืน + ลบ [โหมงานหนัก] ----------
  if (isKSleep) {
    p.statuses.ksleep = 1; // คงอยู่จนหมดกลางคืน (engine ไม่ลดเทิร์นสถานะนี้)
    p.nightWork = 0;
    p.overworkNext = false;
    if (overworkActive(p)) {
      delete p.statuses.overwork;
      lastLog.push(`😌 ${p.name} ได้นอนพักเสียที — สถานะ [โหมงานหนัก] หายไป`);
    }
    const heal = healHp(p, 2);
    lastLog.push(`😴 ${p.name} Sleeping time — หลับยาวตลอดเฟสกลางคืน (ฟื้น +${heal}/เทิร์น) ตื่นเช้ารับ [เช้าที่สดใส]`);
  }
  // ---------- ชเรด เอลัน: เชิญรับฟัง — ฟื้นเลือด 1 + เกราะ 1 (+ท่วงทำนอง +1 เฉพาะร่างปกติ) ----------
  if (isShradeBasic) {
    healHp(p, 1);
    if (!p.shradeForm) {
      p.armor = Math.min(maxArmorOf(p), p.armor + 1);
      p.statuses.melody = Math.min(SHRADE_MELODY_MAX, (p.statuses.melody || 0) + 1);
      flashSuffix = ` — ท่วงทำนอง ${p.statuses.melody}/${SHRADE_MELODY_MAX}`;
      lastLog.push(`🎻 ${p.name} เชิญรับฟัง — ฟื้นพลังชีวิต +1 เกราะ +1 และท่วงทำนอง +1 (สะสม ${p.statuses.melody}/${SHRADE_MELODY_MAX})`);
    } else {
      lastLog.push(`🎻 ${p.name} เชิญรับฟัง — ฟื้นพลังชีวิต +1`);
    }
  }
  // ---------- ชเรด เอลัน: แสงจันทร์ส่องวิญญาณ — เปิดแต้มการ์ดเป้าหมายให้ทุกคนบนสนามเห็น ----------
  //  ร่างปกติ: ได้ท่วงทำนอง +2 / ร่างสปาด้า: เป้าหมายไพ่แตกในเทิร์นนี้ เจ็บ 1 ทันที (moonmark)
  if (isShradeMoon && shradeMoonTarget) {
    const t = shradeMoonTarget;
    t.statuses.promo = 1; // กลไกเดียวกับใบโปรโมทสินค้า: ทุกคนเห็นแต้มการ์ดตลอดเทิร์นนี้
    flashSuffix = ` — ส่องวิญญาณ ${t.name}`;
    if (!p.shradeForm) {
      p.statuses.melody = Math.min(SHRADE_MELODY_MAX, (p.statuses.melody || 0) + 2);
      lastLog.push(`🌕 ${p.name} แสงจันทร์ส่องวิญญาณ — เปิดแต้มการ์ดของ ${t.name} ให้ทุกคนเห็น และท่วงทำนอง +2 (สะสม ${p.statuses.melody}/${SHRADE_MELODY_MAX})`);
    } else {
      t.statuses.moonmark = 1; // แตกเมื่อไหร่ เจ็บ 1 ทันที (หมดผลตอนจบเทิร์น)
      lastLog.push(`🌕 ${p.name} แสงจันทร์ส่องวิญญาณ (สปาด้า) — เปิดแต้มการ์ดของ ${t.name} ให้ทุกคนเห็น หากไพ่แตกในเทิร์นนี้จะรับความเสียหาย 1 หน่วยทันที`);
    }
    triggerCutscene(p, "shradeMoon"); // ครั้งแรกเล่นวีดีโอ shrade_skill2.mp4 / ครั้งถัดไปแจ้งเตือนเล็กๆ
    if (cutsceneQueue.length) pausePlayingForCutscene();
  }
  // ---------- ชเรด เอลัน: รวมร่างทำนองเพลง — ร่างอควาเรียน สปาด้า ถาวร + รีเซ็ตกลางคืนใหม่ 3 เทิร์น ----------
  if (isShradeForm) {
    p.shradeForm = true;
    nightResetPending = true; // ราตรีเริ่มนับใหม่ เหลืออีก 3 เทิร์นนับจากเทิร์นถัดไป (แบบ Vortigern)
    delete p.statuses.melody; // ท่วงทำนองถูกหลอมรวมเป็นบทเพลง
    p.transformAt = ++transformCounter;
    flashSuffix = ` — ${SHRADE_SPADA_NAME}`;
    lastLog.push(`🎼 ${p.name} รวมร่างทำนองเพลง — กลายเป็น ${SHRADE_SPADA_NAME}! พลังโจมตีพื้นฐาน +${SHRADE_ATK_BONUS} (เฉพาะกลางคืน) และราตรีเริ่มนับใหม่ 3 เทิร์น`);
    triggerCutscene(p, "shradeForm");
    if (cutsceneQueue.length) pausePlayingForCutscene();
  }
  // ---------- ชเรด เอลัน: แด่เพื่อนรักของฉัน — เริ่มชาร์จ 3 เทิร์น (เพลง shrade_theme ค้างระหว่างชาร์จ) ----------
  if (isShradeFinal) {
    p.statuses.shradecharge = SHRADE_CHARGE_TURNS + 1; // +1 ชดเชยการลดสถานะตอนจบเทิร์น
    p.transformAt = ++transformCounter;
    lastLog.push(`🎻 ${p.name} แด่เพื่อนรักของฉัน — เริ่มบรรเลงบทเพลงสุดท้าย! อีก ${SHRADE_CHARGE_TURNS} เทิร์นจะปลดปล่อย (ระหว่างนี้จั่ว/ใช้สกิลไม่ได้)`);
    triggerCutscene(p, "shradeCharge"); // เล่นวีดีโอ shrade_final2.1.mp4 ทันที
    if (cutsceneQueue.length) pausePlayingForCutscene();
  }
  // ---------- เจ้าแห่งเน็ตบ้าน: เสือนอนกิน — แยกผลตามมี/ไม่มีคู่สัญญา (ทำงานพร้อมกันไม่ได้) ----------
  if (isTiger) {
    const t = contractPartnerOf(p);
    if (t) {
      // ข้อ 1: รักษาตัวเอง 2 หน่วย + คู่สัญญาจั่วการ์ดเทิร์นนี้ไม่มีทางแตก (แต้มไม่เกิน 19)
      const heal = healHp(p, 2);
      t.statuses.fiber = 1;
      flashSuffix = ` — เลี้ยงดู ${t.name}`;
      lastLog.push(`🐯 ${p.name} เสือนอนกิน — รักษาตัวเอง +${heal} และ ${t.name} จั่วการ์ดเทิร์นนี้ไม่มีทางแตก (แต้มไม่เกิน ${FIBER_CAP})`);
    } else {
      // ข้อ 2: ไม่มีคู่สัญญา — โจมตี +1 (2 เทิร์น) และฟื้นเลือด 1 หน่วยเทิร์นถัดไป
      p.statuses.tiger = Math.max(p.statuses.tiger || 0, 2);
      p.healNextTurn = Math.max(p.healNextTurn || 0, 1);
      flashSuffix = " — นอนรอลูกค้า";
      lastLog.push(`🐯 ${p.name} เสือนอนกิน — พลังโจมตี +1 (2 เทิร์น) และฟื้นพลังชีวิต 1 หน่วยในเทิร์นถัดไป`);
    }
  }
  // ---------- เจ้าแห่งเน็ตบ้าน: กระชากสายแลน — ถอดบัฟคู่สัญญาชั่วคราว 1 เทิร์น + ดาเมจ 1 ไม่สนเกราะ ----------
  if (isLan) {
    const t = contractPartnerOf(p);
    // ถอดบัฟออกชั่วคราว (นับเทิร์นนี้) — เก็บไว้ใน unplugHold แล้วคืนให้ตอนจบเทิร์น
    t.unplugHold = t.unplugHold || {};
    const stripped = [];
    for (const k of UNPLUG_BUFFS) {
      if ((t.statuses[k] || 0) > 0) {
        t.unplugHold[k] = Math.max(t.unplugHold[k] || 0, t.statuses[k]);
        delete t.statuses[k];
        stripped.push(k);
      }
    }
    t.statuses.unplug = 1; // ระหว่างติด: บัฟคู่สัญญา (เกราะ +1 / โจมตี +1) ก็ไม่ทำงานด้วย
    dealDirect(t, 1); // ความเสียหาย 1 หน่วยแบบไม่สนเกราะ (patch 1.9.1 — เดิม 2 สนเกราะ)
    maybeBeatSave(t);
    maybeBeatMode(t);
    maybeEva3(t);
    maybeWakeKotone(t);
    t.wasAttacked = true;
    flashSuffix = ` — ใส่ ${t.name}`;
    lastLog.push(`🔌 ${p.name} กระชากสายแลน — บัฟของ ${t.name} หายไปชั่วคราว 1 เทิร์น${stripped.length ? ` (ถอด ${stripped.length} บัฟ)` : ""} และรับความเสียหาย -1 ไม่สนเกราะ`);
    if (t.alive && t.hp <= 0) {
      instantDeath(t);
      lastLog.push(`💀 ${t.name} เลือดจริงหมด ตกรอบ!`);
    }
  }
  // ---------- เจ้าแห่งเน็ตบ้าน: สนใจใช้บริการเราไหม — ยื่นข้อเสนอ รอเป้าหมายตอบก่อนเปิดไพ่ ----------
  if (isOffer && offerTarget) {
    p.contractOffer = offerTarget.id;
    flashSuffix = ` — ยื่นข้อเสนอให้ ${offerTarget.name}`;
    lastLog.push(`📶 ${p.name} สนใจใช้บริการเราไหม — ยื่นข้อเสนอสัญญาให้ ${offerTarget.name} (ไม่ตอบก่อนเปิดไพ่ = ปฏิเสธ)`);
  }
  // ---------- Apple guy: ชิวๆครับน้องๆ — รีเซ็ตอัตราหลบเป็น 100% ----------
  if (st === "chill") {
    p.chillDodge = 100;
    lastLog.push(`🏖️ ${p.name} ชิวๆครับน้องๆ — หลบหนีอย่างสบายใจ (จบเทิร์นได้แต้มสกิล +1 จนกว่าจะถูกโจมตี)`);
  }
  // ---------- ชิกิ: นายมีฝีมือแค่ไหนหรอ? (patch 2.0.6) — เส้นชีวิต +1 + ชาร์จยกเลิกท่าไม้ตาย ----------
  //  มอบเส้นชีวิต 1 หน่วยให้เป้าหมายที่เลือก และตัวเองได้ชาร์จยกเลิกท่าไม้ตายของผู้เล่นอื่น 1 ครั้ง
  //  (สะสมไม่ได้) คงอยู่ 3 เทิร์น — ผู้เล่นอื่นคนแรกที่กดท่าไม้ตายหลังจากนี้จะถูกยกเลิกทันที
  if (isShikiLifeline && shikiLifelineTarget) {
    const t = shikiLifelineTarget;
    const gained = shikiGiveLifeline(p, t, 1);
    p.statuses.godslay = SHIKI_GODSLAY_TURNS + 1; // 3 เทิร์น (+1 ชดเชยการลดสถานะตอนจบเทิร์น) — ไม่สะสม
    flashSuffix = ` — วัดฝีมือ ${t.name}`;
    lastLog.push(`🔪 ${p.name} นายมีฝีมือแค่ไหนหรอ? — ${t.name} ติดเส้นชีวิต +${gained} (สะสม ${t.statuses.deathline || 0}) และ ${p.name} พร้อมยกเลิกท่าไม้ตายของผู้เล่นอื่น 1 ครั้ง (3 เทิร์น)`);
  }
  // ---------- ชิกิ: ฉันมองเห็นมันแล้ว — เปิดเนตรมารแห่งความมรณะ 3 เทิร์น ----------
  //  (เพลง shiki_theme + ฉากหลังซ้อน shiki_fill.png + ร่างเปลี่ยนเป็น shiki_death.jpg)
  if (st === "deatheye") {
    p.transformAt = ++transformCounter;
    lastLog.push(`👁️ ${p.name} ฉันมองเห็นมันแล้ว — เนตรมารแห่งความมรณะเปิดขึ้น 3 เทิร์น! (เส้นชีวิตครบ ${SHIKI_DEATHLINE_MAX} = สังหารทันที)`);
  }
  // ---------- ชิกิ: ความตายที่โรยรา (ท่าไม้ตาย 2) — 5 เทิร์น แจกเส้นชีวิต + สุ่มสังหาร ----------
  //  (เพลง shiki_theme2 + ฉากหลัง shiki_fill2.mp4 + ร่างเปลี่ยนเป็น shiki2.jpg + ปกสกิล 1 เปลี่ยน)
  if (st === "wither") {
    p.transformAt = ++transformCounter;
    // จดจำเส้นชีวิตของทุกคน ณ ตอนเปิดท่า — สังหารสำเร็จแล้วจะลบเฉพาะส่วนที่สะสมช่วงท่าไม้ตายออก
    for (const o of Object.values(players)) o.witherBase = o.statuses.deathline || 0;
    lastLog.push(`🥀 ${p.name} ความตายที่โรยรา — ความตายเริ่มโรยราลงบนสนาม 5 เทิร์น! (โจมตีปกติมีโอกาสสังหาร 10% ต่อเส้นชีวิต 1 หน่วย)`);
  }

  // จอมเวทย์ฝึกหัด (ฟุจิมารุ): สแตคดาเมจแพ้จั่ว/แตก +1 ต่อครั้ง (1 เทิร์น) + ฟื้นเลือดเทิร์นถัดไปตามจำนวนครั้ง
  if (isMage) {
    p.mageUses = (p.mageUses || 0) + 1;
    p.mageHealNext = (p.mageHealNext || 0) + 1;
    p.statuses.mage = (p.statuses.mage || 0) + 1; // เก็บเป็นจำนวนสแตค (ล้างหมดตอนจบเทิร์น)
    lastLog.push(`🪄 ${p.name} จอมเวทย์ฝึกหัด x${p.statuses.mage} — ความเสียหายจากการแพ้/แตกเทิร์นนี้ +${p.statuses.mage}`);
  }
  // Mystic Code (ฟุจิมารุ): หักเกราะตัวเอง 1 -> ต่ออายุ Everything For Humanity +1 เทิร์น
  if (isMystic) {
    p.armor--;
    p.statuses.humanity = (p.statuses.humanity || 0) + 1;
    lastLog.push(`🔧 ${p.name} Mystic Code — หักเกราะ 1 ต่ออายุ Everything For Humanity (เหลือ ${p.statuses.humanity} เทิร์น)`);
  }
  // Everything For Humanity: ใช้เรจูอาคมบัญชาทั้ง 3 หมดทันทีตอนกด
  if (st === "humanity") p.reiju = 0;

  // ทงคัสสึ 3 มื้อ (เทมาริ patch 2.0.6): นับชามสะสม (สูงสุด 6 ชาม) — เกิน 2 ชาม = เทิร์นถัดไปจั่วเพิ่มไม่ได้
  const isTonkatsu = p.characterId === "temari" && tier === "basic";
  if (isTonkatsu) {
    p.tonkatsu = Math.min(TEMARI_TONKATSU_MAX, (p.tonkatsu || 0) + 1);
    if (p.tonkatsu > 2) p.noDrawNext = Math.max(p.noDrawNext || 0, 1);
  }
  applyEffect(p, skill.effect);

  // NewType Paradise: เติมกระสุน Beam Magnum +1
  if (st === "paradise") p.beamAmmo = Math.min(BEAM_AMMO, (p.beamAmmo || 0) + 1);

  // Song for you (เทมาริ patch 2.0.6): ล้างสถานะผิดปกติทั้งหมดของตัวเอง แล้วนำชามทงคัสสึมาบัฟตัวเอง
  //  2 ชาม = +1 พลังขิง — ชามเศษที่เหลือ 1 ชาม = +1 โล่ — ใช้แล้วล้างชามทั้งหมด
  if (st === "song") {
    const bowls = p.tonkatsu || 0;
    const atk = Math.floor(bowls / 2);
    const sh = Math.min(3, bowls - atk * 2);
    p.songAtk = atk;
    p.shield += sh;
    p.tonkatsu = 0;
    // ล้างสถานะผิดปกติทั้งหมด (patch 2.0.6)
    const cleansed = [];
    for (const k of DEBUFF_KEYS) {
      if ((p.statuses[k] || 0) > 0) { delete p.statuses[k]; cleansed.push(k); }
    }
    if ((p.sunriseDrop || 0) > 0) { p.sunriseDrop = 0; cleansed.push("sunriseDrop"); }
    lastLog.push(`🎵 ${p.name} Song for you — ใช้ทงคัสสึ ${bowls} ชาม: พลังขิง +${atk}${sh > 0 ? ` และโล่ +${sh}` : ""} (ล้างชามทั้งหมด)${cleansed.length ? ` และล้างสถานะผิดปกติ ${cleansed.length} อย่าง` : ""}`);
  }

  // ANATA WAAAAAAAA: เก็บเป้าหมายไว้เป็นความลับ + เปิดเพลงจนกว่าทุกคนจะเปิดไพ่
  if (st === "anata") {
    p.anataTargets = anataTargets;
    anataMusicSeq = ++transformCounter;
  }

  // MonsterLive (ฮิคารุ): แปลงร่างไคจู Black King ทันทีก่อนเปิดไพ่ — พักช่วงจั่วการ์ดเล่นฉากแปลงร่าง
  if (st === "monster") {
    p.seen.monster = true;
    if (!p.cutsceneShown.monster) {
      p.cutsceneShown.monster = true;
      queueCutscene(p, "monster");
      pausePlayingForCutscene();
    } else {
      notifyTransform(p, "monster");
    }
    lastLog.push(`🦖 ${p.name} แปลงร่างไคจู Black King (MonsterLive)!`);
  }

  // ข้อเสียโคโตเนะ: 40% เมื่อใช้สกิลใดๆ จะเจอท่านประธานเซนะจัง -> เทิร์นถัดไปทำอะไรไม่ได้เลย
  //  (ครั้งแรกเล่นวีดีโอ kotone_passive.mp4 — ครั้งถัดไปแจ้งเตือนปกติ)
  if (isKotone && Math.random() < kotoneSenaChance(p)) {
    p.senaNext = true;
    lastLog.push(`😱 ${p.name} เจอท่านประธานเซนะจัง!! — หลบหนีสุดชีวิต เทิร์นถัดไปจะทำอะไรไม่ได้เลย`);
    if (!p.cutsceneShown.kotoneSena) {
      p.cutsceneShown.kotoneSena = true;
      queueCutscene(p, "kotoneSena");
      pausePlayingForCutscene(); // เล่นวีดีโอทันทีช่วงจั่วการ์ด (แบบ MonsterLive)
    } else {
      notifyTransform(p, "kotoneSena");
    }
  }

  // สกิลช่วงจั่วการ์ด (instant): เด้งโชว์ทันทีบนกระดานของทุกคน ไม่ต้องรอเปิดไพ่/ไม่ตัดจอดำ
  if (skill.instant) {
    // Apple guy: ป้ายเด้งของสกิลพื้นฐานโชว์รูปของที่เลือก / อควาเรียน: โชว์รูปตามผู้นำที่เลือกอยู่
    const flashImg = isApplePick ? APPLE_ITEMS[item].img
      : isAquaLeader ? AQUA_LEADERS[item].skillImg
      : isAquaFuse ? AQUA_LEADERS[p.leader || "apollo"].fuseCover
      : (skill.img || null);
    io.emit("skillFlash", { name: skill.name + flashSuffix, img: flashImg, by: p.name, color: POSITION_COLORS[p.position] || "#9B4F96" });
  }
  // จำสกิลที่ใช้ในรอบ (ท่าไม้ตายมี cutscene ของตัวเอง / สกิลหลังเปิดไพ่ไปโชว์ตอนโจมตี)
  roundSkills.push({ playerId: id, name: skill.name, img: skill.img || null, status: st });

  p.busted = bustedOf(p);
  if (p.busted) { p.locked = true; voidUltimateOnBust(p); maybeMoonBurst(p); }
  // ถึงเพดานพอดี (เช่น 21): ไม่ล็อกอัตโนมัติ — รอผู้ใช้เปิดไพ่เอง

  broadcastState();
  checkAllLocked();
}
// ---- เรจูอาคมบัญชา (สกิลติดตัวฟุจิมารุ) ----
//  สั่งใช้ก่อนเปิดการ์ด ไม่นับเป็นการใช้สกิล (ใช้พร้อมสกิลอื่นได้) — 3 ครั้งต่อเกม
//  คำสั่ง: 1 อมตะ 1 เทิร์น | 2 สุ่มฟื้นเลือด/เกราะเต็ม (50/50) | 3 เติมแต้มสกิลเต็ม
function useReiju(id, command) {
  const p = players[id];
  if (gameState !== "PLAYING" || !p || !p.alive || p.locked) return;
  if (p.characterId !== "fujimaru") return;
  const cmd = Number(command);
  if (![1, 2, 3].includes(cmd)) return;
  if ((p.reiju || 0) <= 0) return;
  p.reiju--;

  let what = "";
  if (cmd === 1) {
    p.statuses.seal = 1;
    what = "อมตะ 1 เทิร์น";
    lastLog.push(`📜 ${p.name} เรจูอาคมบัญชา — เทิร์นนี้เป็นอมตะ ไม่ถูกเลือกโจมตี ไม่รับความเสียหายใดๆ (เหลือ ${p.reiju})`);
  } else if (cmd === 2) {
    if (Math.random() < 0.5) {
      healHp(p, MAX_HP);
      what = "ฟื้นพลังชีวิตเต็ม";
    } else {
      p.armor = maxArmorOf(p);
      what = "ฟื้นเกราะเต็ม";
    }
    lastLog.push(`📜 ${p.name} เรจูอาคมบัญชา — สุ่มได้ ${what}! (เหลือ ${p.reiju})`);
  } else {
    addSkill(p, MAX_SKILL); // เติมให้เต็ม 6 แต้ม (addSkill ตัดเพดานให้เอง)
    what = "เติมแต้มสกิลเต็ม";
    lastLog.push(`📜 ${p.name} เรจูอาคมบัญชา — เติมแต้มสกิลเต็ม ${MAX_SKILL} แต้ม (เหลือ ${p.reiju})`);
  }
  // เด้งโชว์ทันทีบนกระดานทุกคน (แบบเดียวกับสกิล instant) — รูปตามจำนวนเส้นที่เหลือ
  io.emit("skillFlash", {
    name: `ขอสาบานด้วยอาคมบัญชานี้ — ${what}`,
    img: `/characters/fujimaru/reiju${Math.max(0, Math.min(3, p.reiju))}.jpg`,
    by: p.name, color: POSITION_COLORS[p.position] || "#9B4F96",
  });
  broadcastState();
}
// ---- ระบบสัญญา (เจ้าแห่งเน็ตบ้าน patch 1.9) ----
// ตอบข้อเสนอสัญญา (สนใจใช้บริการเราไหม): ตอบรับ = เป็นคู่สัญญา / ปฏิเสธ (หรือไม่ตอบก่อนเปิดไพ่) = โดนค่าปรับ
function resolveOffer(b, t, accept, timeout) {
  if (!b) return;
  b.contractOffer = null;
  if (!t || !t.alive) return;
  if (accept && b.alive) {
    b.contractPartner = t.id;
    t.contractWith = b.id;
    b.contractTurns = 0;
    // เพดานเกราะ +3 (ผ่าน contractBuffActive) พร้อมฟื้นเกราะให้ 3 หน่วยทันที
    t.armor = Math.min(maxArmorOf(t), t.armor + CONTRACT_ARMOR_BONUS);
    lastLog.push(`📶 ${t.name} ตอบรับข้อเสนอของ ${b.name} — เป็นคู่สัญญา! เกราะ +${CONTRACT_ARMOR_BONUS} และพลังโจมตี +1 ตลอดสัญญา`);
    io.emit("skillFlash", { name: `สนใจใช้บริการเราไหม — ${t.name} ตอบรับสัญญา!`, img: "/characters/broadband_man/broadband_man_skill3.jpg", by: b.name, color: POSITION_COLORS[b.position] || "#9B4F96" });
  } else {
    // ปฏิเสธ: เสียเลือด 1 ไม่สนเกราะ + แต้มสกิลจบเทิร์นลด 1 เป็นเวลา 3 เทิร์น (นับเทิร์นถัดไป)
    dealDirect(t, 1);
    maybeBeatSave(t);
    maybeBeatMode(t);
    maybeEva3(t);
    t.skillDrainPending = 3;
    lastLog.push(`📵 ${t.name} ${timeout ? "ไม่ตอบข้อเสนอ" : "ปฏิเสธข้อเสนอ"}ของ ${b.name} — เสียเลือด 1 ไม่สนเกราะ และแต้มสกิลจบเทิร์นลด 1 (3 เทิร์นถัดไป)`);
    io.emit("skillFlash", { name: `สนใจใช้บริการเราไหม — ${t.name} ปฏิเสธ`, img: "/characters/broadband_man/broadband_man_skill3.jpg", by: b.name, color: POSITION_COLORS[b.position] || "#9B4F96" });
    if (t.alive && t.hp <= 0) {
      instantDeath(t);
      lastLog.push(`💀 ${t.name} เลือดจริงหมด ตกรอบ!`);
    }
  }
}
// ตอบคำถามต่อสัญญา (ชำระค่าบริการ): ต่อ = จ่าย 4 แต้มคืนเจ้าของ (ขาดเท่าไหร่รับความเสียหายแทน — สนใจเกราะ)
//  ปฏิเสธ (หรือไม่ตอบก่อนเปิดไพ่) = เสียเลือด 2 ไม่สนเกราะ + "ไม่ใช้งานต่อ" ฟื้นเลือดตัวเองไม่ได้ 1 เทิร์น + สัญญาสิ้นสุด
function resolveRenew(t, accept, timeout) {
  if (!t) return;
  t.renewPending = false;
  const b = contractBoss(t);
  if (!b) return; // เจ้าของสัญญาตาย/หายไปแล้ว
  if (accept) {
    const pay = Math.min(CONTRACT_FEE, t.skillPoints);
    const shortfall = CONTRACT_FEE - pay;
    t.skillPoints -= pay;
    if (pay > 0) addSkill(b, pay);
    if (shortfall > 0) {
      dealMixed(t, shortfall);
      maybeBeatSave(t);
      maybeBeatMode(t);
      maybeEva3(t);
    }
    lastLog.push(`📶 ${t.name} ต่อสัญญากับ ${b.name} — จ่ายแต้มสกิล ${pay} แต้ม${shortfall > 0 ? ` (ขาดอีก ${shortfall} รับเป็นความเสียหายแทน)` : ""}`);
    io.emit("skillFlash", { name: `ชำระค่าบริการ — ${t.name} ต่อสัญญา (จ่าย ${pay} แต้ม)`, img: "/characters/broadband_man/broadband_man.jpg", by: b.name, color: POSITION_COLORS[b.position] || "#9B4F96" });
  } else {
    dealDirect(t, 2);
    maybeBeatSave(t);
    maybeBeatMode(t);
    maybeEva3(t);
    t.statuses.nohealing = 1;
    b.contractPartner = null;
    b.contractTurns = 0;
    t.contractWith = null;
    lastLog.push(`📵 ${t.name} ${timeout ? "ไม่ตอบ" : "ปฏิเสธ"}การต่อสัญญากับ ${b.name} — เสียเลือด 2 ไม่สนเกราะ ติด "ไม่ใช้งานต่อ" (ฟื้นเลือดตัวเองไม่ได้ 1 เทิร์น) และสัญญาสิ้นสุด`);
    io.emit("skillFlash", { name: `ชำระค่าบริการ — ${t.name} ยกเลิกสัญญา`, img: "/characters/broadband_man/broadband_man.jpg", by: b.name, color: POSITION_COLORS[b.position] || "#9B4F96" });
  }
  if (t.alive && t.hp <= 0) {
    instantDeath(t);
    lastLog.push(`💀 ${t.name} เลือดจริงหมด ตกรอบ!`);
  }
}
// รับคำตอบจากเป้าหมาย (ตอบได้ระหว่างช่วงจั่วการ์ด แม้จะเปิดไพ่ไปแล้ว)
function answerContract(id, accept) {
  const p = players[id];
  if (gameState !== "PLAYING" || !p || !p.alive) return;
  if (p.renewPending) {
    resolveRenew(p, accept, false);
    broadcastState();
    checkAllLocked();
    return;
  }
  const b = Object.values(players).find((o) => o.alive && o.contractOffer === id);
  if (!b) return;
  resolveOffer(b, p, accept, false);
  broadcastState();
  checkAllLocked();
}
// Bard: รับเป้าหมายบทเพลงที่ประพันธ์เสร็จ (เลือกได้ระหว่างช่วงจั่วการ์ด แม้เปิดไพ่ไปแล้ว)
function bardTarget(id, targets) {
  const p = players[id];
  if (gameState !== "PLAYING" || !p || !p.alive || !p.bardPending) return;
  const song = p.bardPending;
  const tgs = Array.isArray(targets) ? [...new Set(targets)] : [];
  const valid = tgs.filter((tid) => {
    const t = players[tid];
    return t && t.alive && (song.allowSelf || tid !== p.id);
  });
  if (valid.length !== song.need) return;
  p.bardPending = null;
  bardPerform(p, song.pattern, valid, true);
  broadcastState();
  checkAllLocked();
}
function checkAllLocked() {
  if (gameState !== "PLAYING") return;
  const c = alivePlayers();
  // รอคำตอบข้อเสนอ/ต่อสัญญา (เจ้าแห่งเน็ตบ้าน) / เป้าหมายบทเพลง (Bard) ก่อนเปิดไพ่อัตโนมัติ
  //  — หมดเวลาเฟสไพ่ = ถือว่าปฏิเสธ / สุ่มเป้าหมาย
  const pendingAnswer =
    c.some((p) => p.renewPending && contractBoss(p)) ||
    c.some((p) => p.contractOffer && players[p.contractOffer] && players[p.contractOffer].alive) ||
    c.some((p) => p.bardPending);
  if (c.length > 0 && c.every((p) => p.locked) && !pendingAnswer) resolveRound();
}

// ---- สรุปผล ----
function resolveRound() {
  clearPhaseTimer();
  for (const p of alivePlayers()) p.locked = true;
  anataMusicSeq = 0; // เพลง ANATA WAAAAAAAA จบลงเมื่อทุกคนพร้อมเปิดไพ่แล้ว

  // ข้อเสนอ/คำถามต่อสัญญา (เจ้าแห่งเน็ตบ้าน) ที่ยังไม่ตอบเมื่อถึงเวลาเปิดไพ่ = ถือว่าปฏิเสธ
  for (const p of Object.values(players)) {
    if (p.contractOffer) {
      if (p.alive) resolveOffer(p, players[p.contractOffer], false, true);
      else p.contractOffer = null;
    }
    if (p.renewPending) {
      if (p.alive) resolveRenew(p, false, true);
      else p.renewPending = false;
    }
  }

  // Bard: บทเพลงที่ยังไม่ได้เลือกเป้าหมายเมื่อถึงเวลาเปิดไพ่ = สุ่มเป้าหมายอัตโนมัติ (บทเพลงไม่สูญเปล่า)
  for (const p of alivePlayers()) {
    if (!p.bardPending) continue;
    const song = p.bardPending;
    p.bardPending = null;
    const pool = alivePlayers().filter((o) => song.allowSelf || o.id !== p.id);
    const picked = [];
    while (picked.length < song.need && pool.length) {
      picked.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0].id);
    }
    if (picked.length === song.need) {
      lastLog.push(`🎼 ${p.name} ไม่ได้เลือกเป้าหมาย ${song.name} — บทเพลงเลือกเป้าหมายเอง`);
      bardPerform(p, song.pattern, picked, false);
    }
  }

  // ANATA WAAAAAAAA (เทมาริ): เปิดเผยเป้าหมาย + บังคับจั่วเพิ่ม 2 ใบหลังเปิดไพ่
  // ทำงานก่อนท่าไม้ตายอื่นเสมอ — ถ้าเป้าหมายแตกจากการบังคับจั่ว ท่าไม้ตายที่เพิ่งกดจะเป็นโมฆะ
  const anataProcs = [];
  for (const u of alivePlayers()) {
    if (!u.anataTargets || !u.anataTargets.length) continue;
    if (bustedOf(u)) { u.anataTargets = null; continue; } // ผู้ใช้แตกเอง (โมฆะไปแล้วใน voidUltimateOnBust)
    for (const tid of u.anataTargets) {
      const t = players[tid];
      if (!t || !t.alive) continue;
      for (let i = 0; i < TEMARI_ANATA_DRAWS; i++) t.cards.push(drawCardFor(t)); // patch 2.0.6: จั่วเพิ่ม 3 ใบ
      t.busted = bustedOf(t);
      lastLog.push(`🎤 ANATA WAAAAAAAA! ${u.name} บังคับ ${t.name} จั่วเพิ่ม ${TEMARI_ANATA_DRAWS} ใบ${t.busted ? " — ไพ่แตก!" : ""}`);
      if (t.busted) { voidUltimateOnBust(t); maybeMoonBurst(t); }
      anataProcs.push({ u, t });
    }
    u.anataTargets = null;
  }

  const combatants = alivePlayers();
  roundWinnerId = null;

  if (combatants.length < 2) {
    lastLog.push("รอบนี้ไม่มีการต่อสู้ (ผู้เล่นไม่พอ)");
    afterResolve();
    return;
  }

  const val = (p) => (bustedOf(p) ? -1 : scoreOf(p));
  const best = Math.max(...combatants.map(val));
  const worst = Math.min(...combatants.map(val));

  if (best >= 0) {
    const tied = combatants.filter((p) => val(p) === best);
    const w = tied[Math.floor(Math.random() * tied.length)];
    roundWinnerId = w.id;
    roundTiedWin = tied.length > 1; // เสมอแต้มกัน -> ยังได้แต้มสกิล/ท่าไม้ตายทำงานปกติ แต่ไม่มีเทิร์นโจมตี
    w.isWinner = true;
    w.result = "win";
    addSkill(w, 1); // ชนะเป็นคนแรก (ใกล้ 21 สุด / เท่ากับ 21) +1
    firePassive(w, "win");
    if (tied.length > 1) lastLog.push(`เสมอที่ ${best} แต้ม — สุ่มผู้ชนะได้ ${w.name} (เสมอ ไม่มีเทิร์นโจมตี)`);
    // ดาบแห่งจุดจบ (อควาเรียน): ชนะพร้อมมีผู้เล่นอื่นไพ่แตกในเทิร์นนั้น -> พลังโจมตี +1 (เทิร์นนี้)
    if (aquaPassive2Active(w) && combatants.some((c) => c.id !== w.id && bustedOf(c))) {
      w.statuses.marssurge = 1;
      lastLog.push(`🗡️ ${w.name} ดาบแห่งจุดจบ — มีผู้เล่นอื่นไพ่แตก พลังโจมตี +1`);
    }
  }

  if (best !== worst) {
    // จอมเวทย์ฝึกหัด (ฟุจิมารุ): ความเสียหายจากการแพ้จั่ว/แตกรุนแรงขึ้น +1 ต่อสแตค (รวมทุกคนที่เปิดไว้)
    const mageExtra = combatants.reduce((n, q) => n + (q.statuses.mage || 0), 0);
    // การหลับไหลอันไม่สิ้นสุด (สกิลติดตัวโอเบรอน): ผู้แพ้ที่ติดทั้ง "การตื่นขึ้น" และ "ยามฟ้าสาง" เจ็บขึ้น +1
    const oberonHere = combatants.some((q) => q.characterId === "oberon");
    for (const l of combatants.filter((p) => val(p) === worst && p.id !== roundWinnerId)) {
      l.isLoser = true;
      l.result = "lose";
      if (sealActive(l)) {
        // เรจูอาคมบัญชา (อมตะ): ไม่รับความเสียหายใดๆ เทิร์นนี้
        addSkill(l, 1);
        firePassive(l, "lose");
        lastLog.push(`📜 ${l.name} อาคมบัญชาคุ้มครอง — ไม่รับความเสียหายจากการแพ้`);
        continue;
      }
      if ((l.statuses.humanity || 0) > 0) {
        // Everything For Humanity: ความเสียหายจากการแพ้จั่ว/แตก ทำอะไรไม่ได้
        addSkill(l, 1);
        firePassive(l, "lose");
        lastLog.push(`✨ ${l.name} Everything For Humanity — ความเสียหายจากการแพ้ทำอะไรไม่ได้`);
        continue;
      }
      if (l.beatSaved) {
        // หลังกันตายทำงานแล้ว: ความเสียหายจากการแพ้ตอนจั่วการ์ดไม่มีผล ไม่ว่าห่าง 21 แค่ไหน
        addSkill(l, 1);
        firePassive(l, "lose");
        lastLog.push(`⚡ ${l.name} ประกายเขี้ยวปฏิปักษ์ — ไม่รับความเสียหายจากการแพ้`);
        continue;
      }
      if ((l.statuses.monster || 0) > 0) {
        // ร่างไคจู (MonsterLive): แพ้เพราะแต้มน้อยสุด/ไพ่แตก รับความเสียหายน้อยลง 1 หน่วย (1 -> 0)
        addSkill(l, 1);
        firePassive(l, "lose");
        lastLog.push(`🦖 ${l.name} ร่างไคจู — ไม่รับความเสียหายจากการแพ้`);
        continue;
      }
      if (evaLossImmune(l)) {
        // สกิลติดตัว 2 เอวา 13 (ทุกอย่างไร้ความหมาย): ไม่รับดาเมจแพ้จั่ว/แตก
        //  — นอก fourth impact ทำงานเสมอ ยกเว้นสกิลติดตัว 3 (เลือด <= 3) ทำงานอยู่ | fourth impact = บังคับทำงาน
        addSkill(l, 1);
        firePassive(l, "lose");
        lastLog.push(`🌑 ${l.name} ทุกอย่างไร้ความหมาย — ไม่รับความเสียหายจากการแพ้`);
        continue;
      }
      if ((l.statuses.godwing || 0) > 0) {
        // ปีกแห่งสุริยัน (อควาเรียน): ไม่โดนความเสียหายจากการ์ดแตกหรือแพ้จั่ว
        addSkill(l, 1);
        firePassive(l, "lose");
        lastLog.push(`🌟 ${l.name} ปีกแห่งสุริยัน — ไม่รับความเสียหายจากการแพ้/ไพ่แตก`);
        continue;
      }
      const armorBefore = l.armor;
      // การหลับไหลอันไม่สิ้นสุด: ติดทั้งการตื่นขึ้น + ยามฟ้าสาง -> ดาเมจแตก/แพ้ +1
      // และล้าง "การตื่นขึ้น" ออก 1 หน่วยทุกครั้งที่เกิดผล
      const dawnExtra = (oberonHere && (l.statuses.awaken || 0) > 0 && (l.statuses.dawn || 0) > 0) ? 1 : 0;
      if (dawnExtra > 0) {
        l.statuses.awaken--;
        if (l.statuses.awaken <= 0) delete l.statuses.awaken;
      }
      const lossDmg = 1 + mageExtra + dawnExtra; // จอมเวทย์ฝึกหัด: แพ้จั่ว/แตกเจ็บขึ้นตามสแตค
      for (let i = 0; i < lossDmg; i++) damageSoft(l);
      // Absorb shield: ถ้าเป็นผู้แพ้แล้วเสียเกราะ ให้แปลงเกราะที่เสียกลับเป็นพลังชีวิต
      const armorLost = armorBefore - l.armor;
      if ((l.statuses.absorb || 0) > 0 && armorLost > 0) {
        const heal = healHp(l, armorLost);
        if (heal > 0) lastLog.push(`🛡️ ${l.name} Absorb shield แปลงเกราะที่เสีย ${armorLost} → พลังชีวิต +${heal}`);
      }
      // Beat Mode กันตาย: ทำงานทันทีแม้ความเสียหายถึงตายมาจากการแพ้จั่ว/แตก
      maybeBeatSave(l);
      addSkill(l, 1); // โดนความเสียหายเพราะแต้มห่างจาก 21 มากที่สุด +1
      firePassive(l, "lose");
      lastLog.push(`${l.name} แต้มน้อยสุด รับความเสียหาย -${lossDmg}${mageExtra > 0 ? ` (จอมเวทย์ฝึกหัด +${mageExtra})` : ""}${dawnExtra > 0 ? " (การหลับไหลอันไม่สิ้นสุด +1)" : ""}`);
    }
  }
  for (const p of combatants) if (!p.result) p.result = "safe";

  // สกิลติดตัว เนตรมารแห่งความมรณะ (ชิกิ): เปิดไพ่แล้วแต้มเท่ากับผู้เล่นอื่น
  //  (เกิดขึ้นแบบหมู่ได้) -> ผู้เล่นคนนั้นติดสถานะ "เส้นชีวิต" +2 แบบถาวร
  //  (โหมดท่าไม้ตาย 2: ให้เพียง +1 และแหล่งปกติให้ได้สูงสุด 3)
  for (const s of combatants) {
    if (s.characterId !== "shiki" || bustedOf(s)) continue;
    const witherMode = (s.shikiUlt || "deatheye") === "wither";
    for (const o of combatants) {
      if (o.id === s.id || bustedOf(o)) continue;
      if (scoreOf(o) !== scoreOf(s)) continue;
      const gained = shikiGiveLifeline(s, o, SHIKI_DEATHLINE_GAIN);
      if (gained > 0) {
        lastLog.push(`🩸 เนตรมารแห่งความมรณะ — ${o.name} แต้มเท่ากับ ${s.name} ติดเส้นชีวิต +${gained} (สะสม ${o.statuses.deathline}${witherMode ? `/${SHIKI_WITHER_LINE_MAX}` : `/${SHIKI_DEATHLINE_MAX}`})`);
      } else {
        lastLog.push(`🩸 เนตรมารแห่งความมรณะ — ${o.name} แต้มเท่ากับ ${s.name} แต่เส้นชีวิตจากแหล่งปกติเต็มเพดานแล้ว (${SHIKI_WITHER_PASSIVE_CAP})`);
      }
    }
  }

  // สกิลติดตัว หิวอะโปรดิวเซอร์ (เทมาริ patch 1.7.6): เป้าหมาย ANATA WAAAAAAAA แพ้หรือไพ่แตก
  // -> โดนขิงจนช้ำ รับความเสียหายตามโบนัส Song for you เท่านั้น (ไม่นับพลังโจมตีปกติ — สูงสุด 2)
  // ต่อให้เทมาริไม่ชนะ/แพ้ในตานั้นก็ตาม — และฉากของสกิลนี้ขึ้นก่อนทุกท่าไม้ตาย
  let anataFinalShown = false;
  for (const { u, t } of anataProcs) {
    if (!t.alive || !(bustedOf(t) || t.isLoser)) continue;
    let dmg = songActive(u) ? (u.songAtk || 0) : 0;
    if ((t.statuses.monster || 0) > 0) dmg = Math.max(0, dmg - 1); // ร่างไคจูรับเบาลง 1
    dealDirect(t, dmg); // patch 2.0.6: การขิงทำดาเมจแบบไม่สนเกราะ
    maybeBeatSave(t); // กันตายทำงานทันทีถ้าโดนขิงจนถึงตาย
    t.wasAttacked = true;
    addSkill(t, 1);
    lastLog.push(`🎤 หิวอะโปรดิวเซอร์! ${t.name} โดนขิงจนช้ำ -${dmg}`);
    if (!anataFinalShown) {
      anataFinalShown = true;
      triggerCutscene(u, "anataFinal"); // เข้าคิวก่อน afterResolve -> ขึ้นก่อนท่าไม้ตายอื่นเสมอ
    }
  }

  // สกิลติดตัว 1 เอวา 13: เลือดหมดตั้งแต่ช่วงสรุปผล (แพ้จั่ว/แตก/โดนขิง) ขณะ Fourth Impact ยังอยู่
  //  -> ตกรอบและระเบิดทันที ไม่ต้องรอจบเทิร์น (เลือดเหลือ 0 แล้ว ไม่ควรรอโดนตีอีกรอบ)
  for (const e of combatants) {
    if (!(e.alive && e.hp <= 0 && e.characterId === "eva13" && (e.statuses.fourth || 0) > 0)) continue;
    instantDeath(e);
    lastLog.push(`💀 ${e.name} เลือดจริงหมด ตกรอบ!`);
    lastLog.push(`💥 ${e.name} ไม่สามารถแก้ไขอะไรได้อีกแล้ว — ทุกสิ่งทุกอย่างไร้ความหมาย! ระเบิดใส่ทุกคน -${EVA_BLAST_DMG}`);
    for (const o of alivePlayers()) {
      if (o.id === e.id) continue;
      dealMixed(o, EVA_BLAST_DMG);
      maybeBeatSave(o);
      maybeBeatMode(o);
      maybeEva3(o);
      maybeWakeKotone(o);
      o.wasAttacked = true;
    }
    triggerCutscene(e, "evaboom");
    // คนที่โดนแรงระเบิดจนเลือดหมด ตกรอบทันทีเช่นกัน
    for (const o of Object.values(players)) {
      if (o.alive && o.hp <= 0) {
        instantDeath(o);
        lastLog.push(`💀 ${o.name} เลือดจริงหมด ตกรอบ!`);
      }
    }
  }

  afterResolve();
}

// เปิดร่างท่าไม้ตาย (หลังเปิดไพ่) -> cutscene ก่อนสรุปผล (สรุปผลไว้ท้ายสุดเสมอ)
//  หมายเหตุ: สกิลทั่วไปไม่มีแบนเนอร์ก่อนสรุปผลแล้ว — instant เด้งตอนใช้ / หลังเปิดไพ่ไปโชว์ตอนโจมตี
function afterResolve() {
  // ฝันร้ายยามค่ำคืน (โอเบรอน patch 1.8): ทำงานหลังเปิดการ์ด — เป้าหมายเดี่ยว
  //  สร้างความเสียหาย 1 หน่วยแก่เป้าหมายที่เลือก — หากเป้าหมายกำลังหลับไหล พลังโจมตี +2
  //  (ผู้ใช้ไพ่แตก = สกิลไม่ทำงาน)
  for (const p of alivePlayers()) {
    if (!((p.statuses.nightmare || 0) > 0) || !p.nightmareTarget) continue;
    const t = players[p.nightmareTarget];
    p.nightmareTarget = null;
    if (bustedOf(p)) {
      lastLog.push(`💥 ${p.name} ไพ่แตก! ฝันร้ายยามค่ำคืนใช้งานไม่ได้ — แต้มสกิลเสียฟรี`);
      continue;
    }
    if (!t || !t.alive) continue;
    const sleeping = (t.statuses.sleep || 0) > 0;
    const dmg = 1 + (sleeping ? 2 : 0);
    dealMixed(t, dmg);
    maybeBeatSave(t);
    maybeBeatMode(t);
    maybeEva3(t);
    maybeWakeKotone(t);
    t.wasAttacked = true;
    lastLog.push(`🌘 ฝันร้ายยามค่ำคืน! ${p.name} เล่นงาน ${t.name} -${dmg}${sleeping ? " (เป้าหมายหลับไหล +2)" : ""}`);
  }
  const activated = [];
  for (const p of alivePlayers()) {
    if (bustedOf(p)) continue; // ไพ่แตก = ท่าไม้ตายไม่ทำงาน (กันหลุดกรณีเพิ่งกดแล้วแตก)
    for (const key of Object.keys(TRANSFORMS)) {
      if (!TRANSFORMS[key].afterReveal) continue;
      if ((p.statuses[key] || 0) > 0 && !p.seen[key]) {
        p.seen[key] = true;
        p.transformAt = ++transformCounter;
        // สวมเกราะราชัน: เพิ่มแค่เพดานเกราะ +3 (ไม่ฟื้นเกราะให้ — เกราะที่มีคงเดิม รอฟื้นฟูเองต้นรอบ)
        // Everything For Humanity (ฟุจิมารุ): หักเลือดเหลือ 1 + ความจุเกราะ +3 พร้อมฟื้นเกราะ +3
        //  ร่างสุดท้ายคงอยู่จนตาย — เมื่อผลจบลงแล้วเกมยังไม่จบ ตัวละครตายทันที (เช็คใน endTurn)
        if (key === "humanity") {
          p.humanityActivated = true;
          p.hp = 1;
          p.armor = Math.min(maxArmorOf(p), p.armor + 3);
        }
        // Sekai ichi kawaii watashi (โคโตเนะ): ตัด coin ทั้งหมด — ตีทุกคน 1 หน่วย
        //  และทุกคนถูกใบ้การใช้สกิล 2 เทิร์นนับจากเทิร์นถัดไป (มีบัฟ Dance Lession = 3 เทิร์น)
        if (key === "kawaii") {
          const silence = KOTONE_SILENCE_TURNS; // patch 2.0.6: ใบ้สกิล 3 เทิร์นคงที่ (Dance Lession ไม่ต่อเวลาแล้ว)
          const kdmg = KOTONE_KAWAII_DMG + (p.danceBuff ? 1 : 0); // Dance Lession: ความเสียหาย +1
          if (p.danceBuff) lastLog.push(`💃 บัฟ Dance Lession ถูกใช้ไปกับการแสดง — ความเสียหาย +1`);
          p.danceBuff = false;
          const coins = p.coins || 0;
          p.coins = 0;
          for (const o of alivePlayers()) {
            if (o.id === p.id) continue;
            dealMixed(o, kdmg);
            maybeBeatSave(o);
            maybeWakeKotone(o);
            if (resistActive(o)) lastLog.push(`🛡️ ${o.name} ต้านสถานะผิดปกติ — ไม่ติดผลใบ้สกิล`);
            else o.noSkillNext = Math.max(o.noSkillNext || 0, silence);
            o.wasAttacked = true;
          }
          lastLog.push(`💖 Sekai ichi kawaii watashi! ${p.name} ขึ้นไลฟ์สุดน่ารัก — ทุกคน -${kdmg} และตกหลุมรักจนใช้สกิลไม่ได้ ${silence} เทิร์น${coins > 0 ? ` (เท coin ทั้งหมด ${coins} เหรียญออกจากกระปุก)` : ""}`);
        }
        // Lai Rhyme Goodfellow (โอเบรอน กลางวัน): โจมตีทุกคนไม่สนเกราะ 1 หน่วย
        //  + มอบ "การตื่นขึ้น" (ฟื้น 1/เทิร์น 1 เทิร์น) + ติด "ยามฟ้าสาง" +1 (คนหลับไม่ติดเพิ่ม)
        if (key === "lai") {
          for (const o of alivePlayers()) {
            if (o.id === p.id) continue;
            dealDirect(o, 1);
            maybeBeatSave(o);
            maybeWakeKotone(o);
            o.statuses.awaken = Math.max(o.statuses.awaken || 0, 2); // +1 ชดเชยการลดสถานะตอนจบเทิร์น
            if (!((o.statuses.sleep || 0) > 0)) o.statuses.dawn = Math.min(3, (o.statuses.dawn || 0) + 1);
            o.wasAttacked = true;
          }
          lastLog.push(`🌞 Lai Rhyme Goodfellow! ${p.name} โจมตีทุกคน -1 (ไม่สนเกราะ) มอบสถานะ "การตื่นขึ้น" และยามฟ้าสาง +1`);
        }
        // Lie Like Vortigern (โอเบรอน กลางคืน): เกราะหมู่ +1 (ยกเว้นตัวเอง) แล้วกล่อมคนติดยามฟ้าสางให้หลับไหล
        if (key === "vortigern") {
          for (const o of alivePlayers()) {
            if (o.id === p.id) continue;
            o.statuses.vortarmor = 4; // เพดานเกราะ +1 คงอยู่ 3 เทิร์น (+1 ชดเชยการลดสถานะตอนจบเทิร์น)
            o.armor = Math.min(maxArmorOf(o), o.armor + 1);
            const dawn = Math.min(3, o.statuses.dawn || 0); // ยามฟ้าสางสะสมได้ไม่เกิน 3 -> หลับสูงสุด 3 เทิร์น
            if (dawn > 0 && resistActive(o)) {
              lastLog.push(`🛡️ ${o.name} ต้านสถานะผิดปกติ — ไม่หลับไหลจากคำลวงของราชาภูติ`);
            } else if (dawn > 0) {
              // เก็บจำนวนเทิร์นหลับตามจริง — sleepFresh กันการนับถอยหลังในเทิร์นที่เพิ่งโดนกล่อม
              // (เริ่มหลับจริงเทิร์นถัดไป และป้ายสถานะโชว์เลขตรงกับจำนวนเทิร์นที่หลับ)
              o.statuses.sleep = dawn;
              o.sleepFresh = true;
              lastLog.push(`💤 ${o.name} ต้องคำลวงของราชาภูติ — หลับไหล ${dawn} เทิร์น!`);
            }
          }
          for (const o of Object.values(players)) delete o.statuses.dawn; // ล้างยามฟ้าสางให้ทุกคน
          // ราตรีกลืนกิน: ฉากหลังกลางคืนกลายเป็นวีดีโอ + เพลงประจำตัวโอเบรอน จนกว่าจะหมดกลางคืน
          oberonDevour = ++transformCounter;
          // สนามของโอเบรอน: รีเซ็ตเวลากลางคืนให้เหลืออีก 3 เทิร์นนับจากเทิร์นถัดไป
          nightResetPending = true;
          lastLog.push(`🌑 Lie Like Vortigern! ${p.name} มอบเกราะ +1 ให้ทุกคน (3 เทิร์น) — ราตรีกลืนกิน และรีเซ็ตกลางคืนเหลืออีก 3 เทิร์น`);
        }
        // Vortigern (patch 1.7.6): ข้ามวีดีโอประจำท่าไม้ตาย — เล่นราตรีกลืนกิน (oberon_changefill.mp4) ทันที
        //  จบแล้วฉากหลังกลางคืนกลายเป็น oberon_background.mp4 + เพลงประจำตัว (ผ่าน oberonDevour)
        if (key === "vortigern") {
          triggerCutscene(p, "oberonChange");
        } else {
          const firstTime = !p.cutsceneShown[key];
          triggerCutscene(p, key);
          // ครั้งแรก (เล่นวีดีโอ): ต่อด้วยฉากประกาศเปลี่ยนร่าง (ระเบิด + เสียงพากย์) ก่อนขึ้นคนอื่น/สรุปผล
          if (firstTime && key === "rachan") queueTransformAnnounce(p, "rachan");
        }
        lastLog.push(`✨ ${p.name} ${TRANSFORMS[key].label} ${TRANSFORMS[key].title}!`);
        activated.push(p);
      }
    }
  }
  // สวนท่าไม้ตายกัน: เอาเพลงของผู้ชนะ (ถ้าไม่มีผู้ชนะ = คนที่เปิดหลังสุด ซึ่ง transformAt สูงสุดอยู่แล้ว)
  if (activated.length > 1) {
    const winner = activated.find((p) => p.id === roundWinnerId);
    if (winner) winner.transformAt = ++transformCounter;
  }
  // Beat Mode: ถ้าใครเลือดตกต่ำกว่า 3 จากการแพ้รอบนี้ -> เข้าประกายเขี้ยวปฏิปักษ์
  for (const p of alivePlayers()) maybeBeatMode(p);
  // สกิลติดตัว 3 เอวา 13: เลือดตกถึง <= 3 -> อย่าให้ฉันทำแแบบนี้เลย
  for (const p of alivePlayers()) maybeEva3(p);
  runCutsceneQueue(goSummary);
}

function goSummary() {
  gameState = "SUMMARY";
  startPhaseTimer(SUMMARY_TIME, afterSummary);
  broadcastState();
}

// ---- โจมตี ----
// เรจูอาคมบัญชา (อมตะ): ไม่ถูกเลือกเป็นเป้าโจมตีตลอดเทิร์น
function attackableTargets(atkId) {
  return alivePlayers().filter((p) => p.id !== atkId && !sealActive(p));
}
function afterSummary() {
  const winner = players[roundWinnerId];
  // หลับไหล (Lie Like Vortigern): ผู้ชนะที่ยังหลับอยู่ ออกการกระทำไม่ได้ -> ไม่มีเทิร์นโจมตี
  //  (เทิร์นที่เพิ่งโดนกล่อม sleepFresh ยังโจมตีได้ — การหลับเริ่มเทิร์นถัดไป)
  if (winner && winner.alive && (winner.statuses.sleep || 0) > 0 && !winner.sleepFresh) {
    lastLog.push(`💤 ${winner.name} ยังหลับไหลอยู่ — ไม่มีเทิร์นโจมตี`);
    endTurn();
    return;
  }
  // โคโตเนะ: หลับพักผ่อน (Sleeping time) / สตั้นจากโหมงานหนัก / หนีท่านประธานเซนะ — ไม่มีเทิร์นโจมตี
  if (winner && winner.alive && (
    ((winner.statuses.ksleep || 0) > 0 && isNightRound(roundNumber)) ||
    (winner.statuses.kstun || 0) > 0 ||
    (winner.statuses.sena || 0) > 0 ||
    (winner.statuses.godtree || 0) > 0
  )) {
    lastLog.push(`💤 ${winner.name} ไม่อยู่ในสภาพจะโจมตีใคร — ไม่มีเทิร์นโจมตี`);
    endTurn();
    return;
  }
  if (winner && winner.alive && !roundTiedWin) {
    const targets = attackableTargets(winner.id);
    if (targets.length > 0) {
      attackerId = winner.id;
      gameState = "ATTACK";
      startPhaseTimer(ATTACK_TIME, () => {
        const t = attackableTargets(attackerId);
        if (t.length) doAttack(attackerId, t[Math.floor(Math.random() * t.length)].id);
        else endTurn();
      });
      broadcastState();
      return;
    }
  }
  endTurn();
}

function doAttack(byId, targetId) {
  if (gameState !== "ATTACK" || byId !== attackerId) return;
  const attacker = players[byId];
  const target = players[targetId];
  if (!attacker || !target || !target.alive || target.id === attacker.id) return;
  if (sealActive(target)) return; // เรจูอาคมบัญชา (อมตะ): เลือกโจมตีไม่ได้
  clearPhaseTimer();

  // Encore (Bard patch 2.0.5): เป้าหมายมีสถานะหลบหลีก — หลบการโดนโจมตี 1 ครั้งถัดไป 100%
  if ((target.statuses.evade || 0) > 0) {
    delete target.statuses.evade;
    addSkill(target, 1); // ถูกเลือกโจมตี +1 แต้มสกิลตามปกติ (แม้หลบพ้น)
    target.wasAttacked = true;
    lastLog.push(`💨 Encore! ${target.name} หลบหลีกการโจมตีของ ${attacker.name} ได้ (100%) — ผลหลบหลีกหมดลง`);
    lastAttack = {
      byName: attacker.name, byImg: displayImg(attacker), byColor: POSITION_COLORS[attacker.position] || "#888",
      targetName: target.name, targetImg: displayImg(target), targetColor: POSITION_COLORS[target.position] || "#888",
      dmg: 0, dodge: true,
      skills: [{ name: "Encore (หลบหลีก 100%)", img: BARD_CRIMSON_IMG, by: target.name, color: POSITION_COLORS[target.position] || "#888", side: "def" }],
    };
    gameState = "ATTACKING";
    startPhaseTimer(ATTACKFX_TIME, endTurn);
    broadcastState();
    return;
  }

  // ---------- ชิกิ: ฉันมองเห็นมันแล้ว — เป้าหมายเส้นตายครบ 10 = สังหารทันที (บังคับตาย) ----------
  //  เล่นวีดีโอ shiki_skill3_hit.mp4 ก่อนสังหาร — จัดการได้ 1 คน ท่าไม้ตายปิดลงทันที
  const shikiEye = attacker.characterId === "shiki" && (attacker.statuses.deatheye || 0) > 0;
  if (shikiEye && (target.statuses.deathline || 0) >= SHIKI_DEATHLINE_MAX) {
    queueCutscene(attacker, "shikiKill"); // เล่นวีดีโอก่อนสังหารทุกครั้ง
    delete target.statuses.deathline;
    delete attacker.statuses.deatheye; // จัดการได้แล้ว 1 คน — ท่าไม้ตายปิดลงทันที
    // มีดพก: ยังเป็นการโจมตีปกติ — ฟื้นเลือดให้ตัวเองตามปกติ
    if ((attacker.statuses.knife || 0) > 0) {
      const heal = healHp(attacker, SHIKI_KNIFE_HEAL);
      if (heal > 0) lastLog.push(`🔪 ${attacker.name} มีดพก — ฟื้นพลังชีวิต +${heal}`);
    }
    instantDeath(target);
    target.wasAttacked = true;
    lastLog.push(`👁️💀 เนตรมารแห่งความมรณะ! ${attacker.name} มองเห็นเส้นชีวิตของ ${target.name} — สังหารทันที (บังคับตาย)!`);
    lastLog.push(`👁️ ${attacker.name} จัดการเป้าหมายได้แล้ว — ฉันมองเห็นมันแล้ว ปิดลงทันที`);
    lastAttack = {
      byName: attacker.name, byImg: displayImg(attacker), byColor: POSITION_COLORS[attacker.position] || "#888",
      targetName: target.name, targetImg: displayImg(target), targetColor: POSITION_COLORS[target.position] || "#888",
      dmg: 0, kill: true,
      skills: [{ name: "ฉันมองเห็นมันแล้ว — สังหารทันที", img: "/characters/shiki/shiki_skill3.jpg", by: attacker.name, color: POSITION_COLORS[attacker.position] || "#888", side: "atk" }],
    };
    runCutsceneQueue(() => {
      gameState = "ATTACKING";
      startPhaseTimer(ATTACKFX_TIME + 2, endTurn);
      broadcastState();
    });
    return;
  }

  // ---------- ชิกิ: ความตายที่โรยรา (ท่าไม้ตาย 2) — โจมตีปกติสุ่มสังหาร 10% ต่อเส้นชีวิต 1 หน่วย ----------
  //  สังหารสำเร็จ: เล่นวีดีโอ shiki_skill3.2_hit.mp4 ก่อน — ท่าไม้ตายจบลงทันที
  //  และลบเส้นชีวิตที่สะสมเฉพาะช่วงท่าไม้ตายออกให้ทุกคน
  const shikiWither = attacker.characterId === "shiki" && (attacker.statuses.wither || 0) > 0;
  if (shikiWither) {
    const lines = target.statuses.deathline || 0;
    const chance = Math.min(1, lines * SHIKI_WITHER_KILL_PER_LINE);
    if (lines > 0 && Math.random() < chance) {
      queueCutscene(attacker, "shikiWitherKill"); // เล่นวีดีโอก่อนสังหารทุกครั้ง
      delete attacker.statuses.wither; // สังหารได้แล้ว 1 คน — ท่าไม้ตายจบลง
      delete target.statuses.deathline;
      // ลบเส้นชีวิตที่สะสมเฉพาะช่วงท่าไม้ตายออกให้ทุกคน (คงเหลือเท่าตอนก่อนเปิดท่า)
      for (const o of Object.values(players)) {
        if (o.witherBase == null) continue;
        const cur = o.statuses.deathline || 0;
        if (cur > o.witherBase) {
          if (o.witherBase > 0) o.statuses.deathline = o.witherBase;
          else delete o.statuses.deathline;
        }
        o.witherBase = null;
      }
      // มีดพก: ยังเป็นการโจมตีปกติ — ฟื้นเลือดให้ตัวเองตามปกติ
      if ((attacker.statuses.knife || 0) > 0) {
        const heal = healHp(attacker, SHIKI_KNIFE_HEAL);
        if (heal > 0) lastLog.push(`🔪 ${attacker.name} มีดพก — ฟื้นพลังชีวิต +${heal}`);
      }
      instantDeath(target);
      target.wasAttacked = true;
      lastLog.push(`🥀💀 ความตายที่โรยรา! ${attacker.name} เด็ดเส้นชีวิตของ ${target.name} (โอกาส ${Math.round(chance * 100)}%) — สังหารทันที!`);
      lastLog.push(`🥀 ${attacker.name} จัดการเป้าหมายได้แล้ว — ความตายที่โรยราจบลง และเส้นชีวิตที่สะสมช่วงท่าไม้ตายถูกลบออกให้ทุกคน`);
      lastAttack = {
        byName: attacker.name, byImg: displayImg(attacker), byColor: POSITION_COLORS[attacker.position] || "#888",
        targetName: target.name, targetImg: displayImg(target), targetColor: POSITION_COLORS[target.position] || "#888",
        dmg: 0, kill: true,
        skills: [{ name: "ความตายที่โรยรา — สังหารทันที", img: "/characters/shiki/shiki_skill3.2.jpg", by: attacker.name, color: POSITION_COLORS[attacker.position] || "#888", side: "atk" }],
      };
      runCutsceneQueue(() => {
        gameState = "ATTACKING";
        startPhaseTimer(ATTACKFX_TIME + 2, endTurn);
        broadcastState();
      });
      return;
    }
    if (lines > 0) {
      lastLog.push(`🥀 ความตายที่โรยรา — ${attacker.name} เสี่ยงเด็ดเส้นชีวิตของ ${target.name} (โอกาส ${Math.round(chance * 100)}%) แต่ความตายยังไม่มาเยือน`);
    }
  }

  // สกิลติดตัว Apple guy (ชิวๆ ไม่โดนหรอกครับ): ขณะชิวๆครับน้องๆ ทำงาน มีโอกาสหลบการถูกเลือกโจมตี
  //  เริ่มต้น 100% -> หลบได้เหลือ 50% -> หลบได้อีกเหลือ 25% และคงที่จนกว่าผลจะหมด
  //  หลบได้ฟื้นเลือด 1 + ขึ้นวีดีโอ — หลบไม่พ้น = โดนโจมตีตามปกติ และผลชิวๆครับน้องๆ จบลง
  if (target.characterId === "appleguy" && (target.statuses.chill || 0) > 0) {
    const rate = Math.max(CHILL_DODGE_MIN, Math.min(100, target.chillDodge != null ? target.chillDodge : 100));
    if (Math.random() * 100 < rate) {
      target.chillDodge = rate > 50 ? 50 : CHILL_DODGE_MIN;
      healHp(target, 1); // หลบได้ ฟื้นพลังชีวิต 1 หน่วย
      // หลบได้ ฟื้นฟูจำนวนการใช้งานสกิลรอง เอาไปสิ +1 ครั้ง (สะสมไม่ได้) (patch 1.9.1)
      target.appleGiveUses = Math.min(APPLE_GIVE_USES, (target.appleGiveUses || 0) + 1);
      addSkill(target, 1); // ถูกเลือกโจมตี +1 แต้มสกิลตามปกติ (แม้หลบพ้น)
      target.wasAttacked = true;
      lastLog.push(`🏖️ ${target.name} ชิวๆครับน้องๆ — หลบการโจมตีของ ${attacker.name} ได้! ฟื้นพลังชีวิต +1 เติมเอาไปสิ +1 (อัตราหลบเหลือ ${target.chillDodge}%)`);
      // ฉากวิ่งหลบ: ขึ้นหลังจากฝั่งตรงข้ามกดตีแล้ว จบวีดีโอค่อยแสดงสรุปผลการตีตามปกติ
      //  ขึ้นเฉพาะตอนอัตราหลบขณะนั้นเป็น 25% และครั้งเดียวต่อเกมเท่านั้น (patch 1.9.1)
      if (rate <= CHILL_DODGE_MIN && !target.cutsceneShown.appleguyDodge) {
        target.cutsceneShown.appleguyDodge = true;
        queueCutscene(target, "appleguyDodge");
      }
      lastAttack = {
        byName: attacker.name, byImg: displayImg(attacker), byColor: POSITION_COLORS[attacker.position] || "#888",
        targetName: target.name, targetImg: displayImg(target), targetColor: POSITION_COLORS[target.position] || "#888",
        dmg: 0, dodge: true,
        skills: [{ name: "ชิวๆครับน้องๆ (หลบพ้น)", img: "/characters/appleguy/appleguy_skill3.jpg", by: target.name, color: POSITION_COLORS[target.position] || "#888", side: "def" }],
      };
      runCutsceneQueue(() => {
        gameState = "ATTACKING";
        startPhaseTimer(ATTACKFX_TIME, endTurn);
        broadcastState();
      });
      return;
    }
    delete target.statuses.chill;
    lastLog.push(`💢 ${target.name} หลบไม่พ้น — ผลชิวๆครับน้องๆ จบลง`);
  }

  const ginga = (attacker.statuses.ginga || 0) > 0;
  const beam = (attacker.statuses.beam || 0) > 0;
  const paradiseAtk = (attacker.statuses.paradise || 0) > 0;
  // Ohger Finish: ต้องมีทั้งสวมเกราะราชัน + ประกายเขี้ยวปฏิปักษ์ (เช็คตอนกดสกิล) = +1
  const ohger = (attacker.statuses.ohger || 0) > 0;
  const ohgerBonus = ohger ? 1 : 0;
  // Everything For Humanity (ฟุจิมารุ): พลังโจมตี +4
  const humanityAtk = (attacker.statuses.humanity || 0) > 0;
  // หอกลองกินัส (เอวา 13): พลังโจมตี +1 (1 เทิร์น) + เป้าหมายจั่วไม่ได้เทิร์นถัดมา
  const spearAtk = (attacker.statuses.spear || 0) > 0;
  // กำไรเท่าตัวโว้ย (แกมเบลอร์): +โจมตีสะสม และทะลุเกราะ 1 ครั้ง — หมดไปเมื่อได้ตี
  const profitAtk = attacker.characterId === "gambler" ? (attacker.profit || 0) : 0;
  // NT-D System: สวนกลับคนที่ตีเราล่าสุด +1 — NewType Paradise = NT-D แบบพิเศษ ใช้ +1 กับเป้าหมายใดก็ได้
  const isRevenge = attacker.characterId === "banagher" && attacker.ntdTarget && attacker.ntdTarget === target.id;
  const ntdBonus = (isRevenge || paradiseAtk) ? 1 : 0;
  // Ginga no Uta: ถ้าเหลือฝ่ายตรงข้ามเพียงคนเดียว พลังโจมตี +1
  const lastStanding = ginga && alivePlayers().filter((p) => p.id !== attacker.id).length === 1;
  // ม่านแห่งราตรี (โอเบรอน): พลังโจมตี +1 ทุกคนที่ติดบัฟ (2 เทิร์น)
  const veilAtk = (attacker.statuses.veil || 0) > 0;
  // การหลับไหลอันไม่สิ้นสุด (สกิลติดตัวโอเบรอน patch 1.7.6): พลังโจมตีพื้นฐานเป็น 0 ทั้งสองร่าง
  //  ชนะจั่วก็ตีไม่เข้า เว้นแต่มีบัฟม่านแห่งราตรี (+1) — และร่างกลางวัน การโจมตีปกติติด "ยามฟ้าสาง" +1
  const oberonZero = attacker.characterId === "oberon" ? -1 : 0;
  const oberonDayAtk = attacker.characterId === "oberon" && !isNightRound(roundNumber);
  // เอาไปสิ (Apple guy): บัฟพลังโจมตีจากการมอบของ (ไม่ซ้อนทับ — คงอยู่จนหายจากการมอบซ้ำ)
  const appleAtk = attacker.characterId === "appleguy" ? (attacker.appleAtk || 0) : 0;
  // เสือนอนกิน (เจ้าแห่งเน็ตบ้าน): พลังโจมตี +1 (2 เทิร์น — กรณีไม่มีคู่สัญญา)
  const tigerAtk = (attacker.statuses.tiger || 0) > 0;
  // คู่สัญญา (สนใจใช้บริการเราไหม): พลังโจมตี +1 ตลอดสัญญา (โดนกระชากสายแลนถอดชั่วคราวได้)
  const partnerAtk = contractBuffActive(attacker);
  // กระปุกออมสินน้องหมูน้อย (โคโตเนะ): แปลง coin เป็นความเสียหาย 2 coin = +1 (ใช้แล้วเหรียญหมดไป)
  let pigDmg = attacker.characterId === "kotone" ? Math.floor((attacker.coins || 0) / KOTONE_COIN_PER_DMG) : 0;
  // [โหมงานหนัก] (โคโตเนะ): เมื่อถึงเฟสตอนเช้า พลังโจมตีเหลือ 0 เพราะพักผ่อนไม่พอ
  const kotoneExhausted = attacker.characterId === "kotone" && overworkActive(attacker) && !isNightRound(roundNumber);
  if (kotoneExhausted) pigDmg = 0; // ตีไม่เข้า — ไม่เสีย coin ฟรี
  // ---------- อควาเรียน: สกิลติดตัว 1/2/3 (แสงแห่งสุริยัน / ดาบแห่งจุดจบ / จันทราสยบ) ----------
  let aquaAtk = 0;
  let aquaZero = false; // จันทราสยบ กลางวัน: พลังโจมตีเหลือ 0 (แต่โจมตีได้ฟื้นเลือด 1)
  if (attacker.characterId === "aquarion") {
    const aquaNight = isNightRound(roundNumber);
    if (aquaPassive1Active(attacker) && !aquaNight) aquaAtk += 1; // แสงแห่งสุริยัน: กลางวัน +1
    if (aquaPassive3Active(attacker)) {
      if (aquaNight) aquaAtk += 1; // จันทราสยบ: กลางคืน +1
      else aquaZero = true;        // จันทราสยบ: กลางวันเหลือ 0
    }
    if ((attacker.statuses.marssurge || 0) > 0) aquaAtk += 1; // ดาบแห่งจุดจบ: ชนะเทิร์นที่มีคนไพ่แตก
  }
  // รวมร่างทำนองเพลง (ชเรด เอลัน): ร่างอควาเรียน สปาด้า พลังโจมตีพื้นฐาน +2
  //  (patch พิเศษ: ตอนเช้าไม่คืนร่าง แต่โบนัสโจมตีไม่ทำงาน — มีผลเฉพาะช่วงกลางคืน)
  const shradeAtk = (attacker.characterId === "shrade_elan" && attacker.shradeForm && isNightRound(roundNumber)) ? SHRADE_ATK_BONUS : 0;
  const shradeDayOff = attacker.characterId === "shrade_elan" && attacker.shradeForm && !isNightRound(roundNumber);

  let base = 1 + oberonZero + (veilAtk ? 1 : 0) + (ginga ? 1 : 0) + (beam ? 2 : 0) + (lastStanding ? 1 : 0) + ohgerBonus + (humanityAtk ? 4 : 0) + (spearAtk ? 1 : 0) + profitAtk + appleAtk + (tigerAtk ? 1 : 0) + (partnerAtk ? 1 : 0) + pigDmg + aquaAtk + shradeAtk; // Beam Magnum +2
  if (kotoneExhausted) base = 0;
  if (aquaZero) base = 0;
  let dmg = base + (kotoneExhausted ? 0 : ntdBonus);
  if (pigDmg > 0) {
    attacker.coins -= pigDmg * KOTONE_COIN_PER_DMG; // ทุบกระปุกจ่ายเป็นดาเมจ
    lastLog.push(`🐷 ${attacker.name} ทุบกระปุกออมสินน้องหมูน้อย — ใช้ ${pigDmg * KOTONE_COIN_PER_DMG} coin เพิ่มความเสียหาย +${pigDmg} (เหลือ ${attacker.coins})`);
  }
  if (kotoneExhausted) lastLog.push(`🥱 ${attacker.name} พักผ่อนไม่พอจาก [โหมงานหนัก] — พลังโจมตีช่วงเช้าเหลือ 0`);
  if ((target.statuses.monster || 0) > 0) dmg = Math.max(0, dmg - 1);
  // ชำระค่าบริการ (สกิลติดตัวเจ้าแห่งเน็ตบ้าน): คู่สัญญาโจมตีใส่ตัวละครนี้ ความเสียหายลด 1
  const contractGuard = target.characterId === "broadband_man" && target.contractPartner === attacker.id && attacker.contractWith === target.id;
  if (contractGuard) dmg = Math.max(0, dmg - 1);
  // Harmony (Bard): เป้าหมายได้รับการคุ้มครอง — ความเสียหายลด 1
  const bardGuard = (target.statuses.guard || 0) > 0;
  if (bardGuard) dmg = Math.max(0, dmg - 1);
  // Discord (Bard): เป้าหมายติดขัดแย้ง — ความเสียหายที่ได้รับ +1
  const bardDiscord = (target.statuses.discord || 0) > 0;
  if (bardDiscord) dmg += 1;

  // Beam Magnum: หักกระสุน 1 นัดเมื่อได้โจมตีจริงเท่านั้น (ไม่นับถ้าเลือกแล้วไม่ได้ตี/แตกในเทิร์น)
  if (beam && (attacker.beamAmmo || 0) > 0) attacker.beamAmmo--;

  // ดาบแห่งแสง (อควาเรียน ท่าไม้ตายร่างมาร์): ลดเกราะเป้าหมายก่อน 1 หน่วย แล้วจึงสร้างความเสียหาย
  const marsswordAtk = (attacker.statuses.marssword || 0) > 0;
  if (marsswordAtk && target.armor > 0) {
    target.armor--;
    lastLog.push(`⚔️ ดาบแห่งแสง! ${attacker.name} ลดเกราะ ${target.name} -1 ก่อนโจมตี`);
  }

  const attackerBeat = beatActive(attacker); // Beat Mode: การโจมตีเป็นความเสียหายจริง ไม่สนเกราะ
  const hpBefore = target.hp;
  const armorBefore = target.armor;
  const shieldBefore = target.shield;
  if (attackerBeat || profitAtk > 0) dealDirect(target, dmg); // ประกายเขี้ยวปฏิปักษ์ / กำไรเท่าตัวโว้ย: ทะลุเกราะเข้าเลือดจริง
  else dealMixed(target, dmg);               // กฎปกติ: ลดเกราะก่อน ถ้าไม่มีเกราะจึงเข้าเลือดจริง
  if (profitAtk > 0) {
    attacker.profit = 0; // บัฟกำไรหมดไปเมื่อได้ตี
    lastLog.push(`💰 ${attacker.name} กำไรเท่าตัวโว้ย — โจมตี +${profitAtk} ทะลุเกราะ! (บัฟหมดลง)`);
  }
  // จันทราสยบ (อควาเรียน กลางวันร่างลูน่า): พลังโจมตีเหลือ 0 แต่ยังได้โจมตี -> ฟื้นเลือด 1
  if (aquaZero) {
    const heal = healHp(attacker, 1);
    if (heal > 0) lastLog.push(`🌙 ${attacker.name} จันทราสยบ — พลังโจมตีเหลือ 0 แต่ยังได้โจมตี ฟื้นพลังชีวิต +${heal}`);
  }
  // ศรศักดิ์สิทธิ์ (อควาเรียน ท่าไม้ตายร่างลูน่า): ติดพิษ ลดพลังชีวิตเป้าหมาย 1 หน่วยทุกเทิร์น 2 เทิร์น
  if ((attacker.statuses.lunabow || 0) > 0 && target.alive) {
    if (resistActive(target)) {
      lastLog.push(`🛡️ ${target.name} ต้านสถานะผิดปกติ — ไม่ติดพิษศรศักดิ์สิทธิ์`);
    } else {
      target.statuses.aquapoison = Math.max(target.statuses.aquapoison || 0, 3); // +1 ชดเชยการลดสถานะตอนจบเทิร์น
      lastLog.push(`☠️ ศรศักดิ์สิทธิ์! ${target.name} ติดพิษ เสียพลังชีวิต 1 หน่วยทุกเทิร์น (2 เทิร์น)`);
    }
  }
  // ดาบแห่งจุดจบ (อควาเรียน ร่างมาร์/ปีกแห่งสุริยัน): 30% สะท้อนความเสียหายครึ่งหนึ่งกลับผู้โจมตี (ดาเมจ 1 สะท้อนไม่ได้)
  let aquaReflect = 0;
  if (aquaPassive2Active(target) && dmg > 1 && Math.random() < AQUA_MARS_REFLECT_CHANCE) {
    aquaReflect = Math.floor(dmg / 2);
    if (aquaReflect > 0 && attacker.alive) {
      dealMixed(attacker, aquaReflect);
      maybeBeatSave(attacker);
      maybeBeatMode(attacker);
      maybeEva3(attacker);
      attacker.wasAttacked = true;
      lastLog.push(`🗡️ ดาบแห่งจุดจบ! ${target.name} สะท้อนความเสียหาย -${aquaReflect} กลับให้ ${attacker.name}`);
    }
  }
  // หอกลองกินัส: โจมตีโดนเป้าหมาย -> มีโอกาส 20/80 ที่เทิร์นถัดมาเป้าหมายจะใช้สกิลไม่ได้
  //  (สกิลติดตัว 3 เอวาทำงาน = โอกาสเพิ่มเป็น 50/50)
  if (spearAtk && target.alive) {
    const chance = eva3Active(attacker) ? 0.5 : 0.2;
    if (Math.random() < chance) {
      if (resistActive(target)) {
        lastLog.push(`🛡️ ${target.name} ต้านสถานะผิดปกติ — หอกลองกินัสไม่มีผล`);
      } else {
        target.noSkillNext = Math.max(target.noSkillNext || 0, 1);
        lastLog.push(`🗡️ หอกลองกินัสปักเป้า! ${target.name} ใช้สกิลไม่ได้ในเทิร์นถัดไป`);
      }
    } else {
      lastLog.push(`🗡️ หอกลองกินัสพลาด — ${target.name} ยังใช้สกิลได้ตามปกติ`);
    }
  }
  // Beat Mode กันตาย (ครั้งเดียวต่อเกม): ทำงานทันทีเมื่อความเสียหายถึงตาย — ไม่ต้องอยู่ใน Beat Mode ก่อน
  //  หลังกันตายทำงาน -> เกราะจะไม่ฟื้นคืน + ภูมิดาเมจจากการแพ้ (แต่ครั้งต่อไปจะตายปกติ)
  const beatSaveFired = maybeBeatSave(target);
  maybeWakeKotone(target); // โคโตเนะหลับอยู่โดนโจมตี = สะดุ้งตื่น + ติด [โหมงานหนัก]
  // Resonance (Bard): เป้าหมายถูกเชื่อมผลอยู่ — คู่เชื่อมรับความเสียหาย 1 หน่วยตาม (เกราะก่อน)
  let linkedHit = null;
  if ((target.statuses.linked || 0) > 0 && target.linkedWith) {
    const buddy = players[target.linkedWith];
    if (buddy && buddy.alive && buddy.id !== attacker.id && (buddy.statuses.linked || 0) > 0) {
      dealMixed(buddy, 1);
      maybeBeatSave(buddy);
      maybeBeatMode(buddy);
      maybeEva3(buddy);
      maybeWakeKotone(buddy);
      buddy.wasAttacked = true;
      linkedHit = buddy;
      lastLog.push(`🔗 เชื่อมผล! ${buddy.name} รับความเสียหายตาม ${target.name} -1`);
    }
  }
  target.wasAttacked = true;
  addSkill(target, 1); // โดนเลือกโจมตีจากผู้ชนะรอบนั้น +1
  // Absorb shield: เกราะที่เสียไปจากการถูกโจมตี แปลงกลับเป็นพลังชีวิต
  const armorLost = armorBefore - target.armor;
  if ((target.statuses.absorb || 0) > 0 && armorLost > 0) {
    const heal = healHp(target, armorLost);
    if (heal > 0) lastLog.push(`🛡️ ${target.name} Absorb shield แปลงเกราะที่เสีย ${armorLost} → พลังชีวิต +${heal}`);
  }
  // Beat Mode: ถ้าการโจมตีทำให้เลือดเหลือ < 3 -> เข้าประกายเขี้ยวปฏิปักษ์
  maybeBeatMode(target);
  // สกิลติดตัว 3 เอวา 13: ถ้าการโจมตีทำให้เลือดเหลือ <= 3
  maybeEva3(target);
  // มีดพก (ชิกิ): การโจมตีปกติฟื้นเลือดให้ตัวเอง 3 หน่วย (คงอยู่ 2 เทิร์น)
  const knifeAtk = attacker.characterId === "shiki" && (attacker.statuses.knife || 0) > 0;
  let knifeHeal = 0;
  if (knifeAtk) {
    knifeHeal = healHp(attacker, SHIKI_KNIFE_HEAL);
    lastLog.push(`🔪 ${attacker.name} มีดพก — ฟื้นพลังชีวิต +${knifeHeal}`);
  }
  // เนตรมารแห่งความมรณะ (ชิกิ): โจมตีปกติระหว่างท่าไม้ตายทำงาน (แต่เส้นตายยังไม่ถึง 10)
  //  -> เส้นตายของเป้าหมายถูกลบออกทั้งหมด เริ่มนับใหม่ (นับเป็นรายคน)
  let deathlineReset = false;
  if (shikiEye && (target.statuses.deathline || 0) > 0) {
    delete target.statuses.deathline;
    deathlineReset = true;
    lastLog.push(`👁️ เนตรมารแห่งความมรณะ — เส้นชีวิตของ ${target.name} ถูกลบออกทั้งหมด เริ่มนับใหม่`);
  }
  if (isRevenge) {
    attacker.ntdTarget = null;
    delete attacker.seen.ntd;
    lastLog.push(`⚡ ${attacker.name} แก้แค้น ${target.name} ด้วย NT-D +1 -${dmg} (ลดเกราะก่อน) — NT-D สงบลง`);
  } else {
    lastLog.push(`${attacker.name} โจมตี ${target.name} -${dmg} (ลดเกราะก่อน)`);
  }

  // Ginga: ตีหมู่ — คนที่ไม่ใช่เป้าหมายรับความเสียหายแค่ 1 (Ginga no Uta ไม่มีผลกับการตีหมู่)
  if (ginga) {
    const splashHit = [];
    for (const o of alivePlayers()) {
      if (o.id === attacker.id || o.id === target.id) continue;
      let admg = 1;
      if ((o.statuses.monster || 0) > 0) admg = Math.max(0, admg - 1);
      dealArmorOnly(o, admg);
      o.wasAttacked = true;
      splashHit.push(o);
    }
    if (splashHit.length) lastLog.push(`ตีหมู่ Ginga! ผู้เล่นอื่นเสียเกราะ -1`);
  }
  // หมัดไร้ขอบเขต (อควาเรียน ท่าไม้ตายร่างโซล่า): ตีหมู่ — คนที่ไม่ใช่เป้าหมายเสียเกราะ 1 หน่วย
  if ((attacker.statuses.solarburst || 0) > 0) {
    const splashHit = [];
    for (const o of alivePlayers()) {
      if (o.id === attacker.id || o.id === target.id) continue;
      dealArmorOnly(o, 1);
      o.wasAttacked = true;
      splashHit.push(o);
    }
    if (splashHit.length) lastLog.push(`หมัดไร้ขอบเขต! ${attacker.name} ตีหมู่ — ผู้เล่นอื่นเสียเกราะ -1`);
  }

  // การหลับไหลอันไม่สิ้นสุด (โอเบรอน patch 1.7.6): ยามกลางวัน การโจมตีปกติติด "ยามฟ้าสาง" +1 แก่เป้าหมาย
  //  (สะสมสูงสุด 3 — คนที่กำลังหลับไหลไม่ติดเพิ่ม)
  let dawnApplied = false;
  if (oberonDayAtk && target.alive && !((target.statuses.sleep || 0) > 0)) {
    target.statuses.dawn = Math.min(3, (target.statuses.dawn || 0) + 1);
    dawnApplied = true;
    lastLog.push(`🌅 การหลับไหลอันไม่สิ้นสุด: ${target.name} ติดยามฟ้าสาง +1`);
  }

  // Ginga no Uta: ถ้ากำจัดเป้าหมายที่เลือกได้ ต่ออายุท่าไม้ตาย +1 เทิร์น (ชดเชยการลดสถานะตอนจบเทิร์น)
  if (attacker.characterId === "hikaru" && ginga && hpBefore > 0 && target.hp <= 0) {
    attacker.statuses.ginga = (attacker.statuses.ginga || 0) + 1;
    lastLog.push(`🎵 Ginga no Uta: ${attacker.name} กำจัด ${target.name} — ท่าไม้ตายคงอยู่ +1 เทิร์น`);
  }

  // NT-D (บานาจเป็นเป้า): ตั้งบัฟแก้แค้น "คนล่าสุด" — แสดงฉากเมื่อเปลี่ยนเป้าเท่านั้น
  if (target.characterId === "banagher" && attacker.alive) {
    const changed = target.ntdTarget !== attacker.id;
    target.ntdTarget = attacker.id;
    target.seen.ntd = true;
    if (changed) triggerCutscene(target, "ntd");
  }

  // สกิลที่มีผลกับการโจมตีครั้งนี้ (โชว์ใต้อนิเมชัน แยกฝั่งชัดเจน: atk = ฝั่งโจมตี | def = ฝั่งป้องกัน)
  const fxSkills = [];
  const addFx = (x, side) => { if (x) fxSkills.push({ ...x, side }); };
  if (beam) addFx(skillByStatus(attacker, "beam"), "atk");
  if (ohger) addFx(skillByStatus(attacker, "ohger"), "atk");
  if (ginga) addFx(skillByStatus(attacker, "ginga"), "atk");
  if (humanityAtk) addFx(skillByStatus(attacker, "humanity"), "atk");
  if (spearAtk) addFx(skillByStatus(attacker, "spear"), "atk");
  if (veilAtk) addFx({ name: "ม่านแห่งราตรี +1", img: "/characters/oberon/oberon_skill1.jpg", by: attacker.name, color: POSITION_COLORS[attacker.position] || "#888" }, "atk");
  if (oberonZero < 0 && !veilAtk) addFx({ name: "การหลับไหลอันไม่สิ้นสุด (พลังโจมตี 0)", img: displayImg(attacker), by: attacker.name, color: POSITION_COLORS[attacker.position] || "#888" }, "atk");
  if (dawnApplied) addFx({ name: "การหลับไหลอันไม่สิ้นสุด (ยามฟ้าสาง +1)", img: displayImg(attacker), by: attacker.name, color: POSITION_COLORS[attacker.position] || "#888" }, "atk");
  if (profitAtk > 0) addFx({ name: `กำไรเท่าตัวโว้ย +${profitAtk} (ทะลุเกราะ)`, img: "/characters/gambler/gambler_skill2.jpg", by: attacker.name, color: POSITION_COLORS[attacker.position] || "#888" }, "atk");
  if (appleAtk > 0) addFx({ name: `เอาไปสิ +${appleAtk} (บัฟมอบของ)`, img: "/characters/appleguy/appleguy_skill2.jpg", by: attacker.name, color: POSITION_COLORS[attacker.position] || "#888" }, "atk");
  if (tigerAtk) addFx({ name: "เสือนอนกิน +1", img: "/characters/broadband_man/broadband_man_skill1.jpg", by: attacker.name, color: POSITION_COLORS[attacker.position] || "#888" }, "atk");
  if (pigDmg > 0) addFx({ name: `กระปุกออมสินน้องหมูน้อย +${pigDmg}`, img: "/characters/kotone/kotone.jpg", by: attacker.name, color: POSITION_COLORS[attacker.position] || "#888" }, "atk");
  if (kotoneExhausted) addFx({ name: "โหมงานหนัก (พลังโจมตี 0)", img: "/characters/kotone/kotone.jpg", by: attacker.name, color: POSITION_COLORS[attacker.position] || "#888" }, "atk");
  if (partnerAtk) addFx({ name: "คู่สัญญา +1 (สนใจใช้บริการเราไหม)", img: "/characters/broadband_man/broadband_man_skill3.jpg", by: attacker.name, color: POSITION_COLORS[attacker.position] || "#888" }, "atk");
  if (contractGuard) addFx({ name: "ชำระค่าบริการ (ความเสียหายลด 1)", img: "/characters/broadband_man/broadband_man.jpg", by: target.name, color: POSITION_COLORS[target.position] || "#888" }, "def");
  if (paradiseAtk && !isRevenge) addFx(skillByStatus(attacker, "paradise"), "atk");
  if (isRevenge) addFx({ name: "NT-D System แก้แค้น +1", img: TRANSFORMS.ntd.img, by: attacker.name, color: POSITION_COLORS[attacker.position] || "#888" }, "atk");
  if (attackerBeat) addFx({ name: "ประกายเขี้ยวปฏิปักษ์ (ทะลุเกราะ)", img: OHGER_FORM, by: attacker.name, color: POSITION_COLORS[attacker.position] || "#888" }, "atk");
  if ((target.statuses.monster || 0) > 0) addFx(skillByStatus(target, "monster"), "def");
  if (shieldBefore > target.shield) addFx({ name: "โล่ป้องกัน (กันความเสียหาย)", img: null, by: target.name, color: POSITION_COLORS[target.position] || "#888" }, "def");
  if ((target.statuses.absorb || 0) > 0 && armorLost > 0) addFx(skillByStatus(target, "absorb"), "def");
  if (beatSaveFired) addFx({ name: "ประกายเขี้ยวปฏิปักษ์ (กันตาย)", img: OHGER_FORM, by: target.name, color: POSITION_COLORS[target.position] || "#888" }, "def");
  // อควาเรียน
  if (aquaAtk > 0) addFx({ name: `พลังโจมตี +${aquaAtk} (สกิลติดตัว)`, img: displayImg(attacker), by: attacker.name, color: POSITION_COLORS[attacker.position] || "#888" }, "atk");
  if (aquaZero) addFx({ name: "จันทราสยบ (พลังโจมตี 0)", img: displayImg(attacker), by: attacker.name, color: POSITION_COLORS[attacker.position] || "#888" }, "atk");
  if ((attacker.statuses.solarburst || 0) > 0) addFx(skillByStatus(attacker, "solarburst"), "atk");
  if (marsswordAtk) addFx(skillByStatus(attacker, "marssword"), "atk");
  if ((attacker.statuses.lunabow || 0) > 0) addFx(skillByStatus(attacker, "lunabow"), "atk");
  if (aquaReflect > 0) addFx({ name: `ดาบแห่งจุดจบ — สะท้อน -${aquaReflect}`, img: displayImg(target), by: target.name, color: POSITION_COLORS[target.position] || "#888" }, "def");
  if (shradeAtk > 0) addFx({ name: `รวมร่างทำนองเพลง +${shradeAtk}`, img: SHRADE_SPADA_IMG, by: attacker.name, color: POSITION_COLORS[attacker.position] || "#888" }, "atk");
  if (shradeDayOff) addFx({ name: "รวมร่างทำนองเพลง (ตอนเช้า — โบนัสโจมตีไม่ทำงาน)", img: SHRADE_SPADA_IMG, by: attacker.name, color: POSITION_COLORS[attacker.position] || "#888" }, "atk");
  // เรียวกิ ชิกิ
  if (knifeAtk) addFx({ name: `มีดพก (ฟื้นเลือด +${knifeHeal})`, img: "/characters/shiki/shiki_skill1.webp", by: attacker.name, color: POSITION_COLORS[attacker.position] || "#888" }, "atk");
  if (deathlineReset) addFx({ name: "เนตรมารแห่งความมรณะ (เส้นชีวิตถูกรีเซ็ต)", img: SHIKI_DEATH_IMG, by: attacker.name, color: POSITION_COLORS[attacker.position] || "#888" }, "atk");
  // Bard: คุ้มครอง / ขัดแย้ง / เชื่อมผล
  if (bardGuard) addFx({ name: "Harmony — คุ้มครอง (ความเสียหายลด 1)", img: BARD_CRIMSON_IMG, by: target.name, color: POSITION_COLORS[target.position] || "#888" }, "def");
  if (bardDiscord) addFx({ name: "Discord — ขัดแย้ง (+1 ดาเมจ)", img: BARD_JADE_IMG, by: target.name, color: POSITION_COLORS[target.position] || "#888" }, "atk");
  if (linkedHit) addFx({ name: `Resonance — เชื่อมผล (${linkedHit.name} -1)`, img: BARD_JADE_IMG, by: target.name, color: POSITION_COLORS[target.position] || "#888" }, "def");

  // อนิเมชันบอกว่าใครตีใคร
  lastAttack = {
    byName: attacker.name, byImg: displayImg(attacker), byColor: POSITION_COLORS[attacker.position] || "#888",
    targetName: target.name, targetImg: displayImg(target), targetColor: POSITION_COLORS[target.position] || "#888",
    dmg, aoe: ginga || (attacker.statuses.solarburst || 0) > 0, revenge: isRevenge, skills: fxSkills,
  };
  gameState = "ATTACKING";
  // มีข้อมูลสกิลให้อ่าน -> ยืดเวลาอนิเมชันให้อ่านทัน
  startPhaseTimer(fxSkills.length ? ATTACKFX_TIME + 2 : ATTACKFX_TIME, () => runCutsceneQueue(endTurn));
  broadcastState();
}

// ---- ปิดรอบ ----
function endTurn() {
  clearPhaseTimer();
  attackerId = null;

  // สกิลติดตัว 1 เอวา 13 (ไม่สามารถแก้ไขอะไรได้อีกแล้ว): กำลังจะถูกกำจัดขณะ fourth impact ยังอยู่
  //  -> เช็คก่อนลดเทิร์นสถานะ (ดาเมจถึงตายเกิดตอน fourth ยังไม่หมดอายุ)
  const evaBlasts = Object.values(players).filter(
    (p) => p.alive && p.hp <= 0 && p.characterId === "eva13" && (p.statuses.fourth || 0) > 0
  );

  // แด่เพื่อนรักของฉัน (ชเรด เอลัน): ชาร์จจะครบกำหนดเมื่อจบเทิร์นนี้ (เหลือ 1 ก่อนลดสถานะ)
  //  — เก็บไว้ก่อนลูปลดเทิร์นสถานะ แล้วปลดปล่อยหลังเช็คคนตายรอบแรก (ตายก่อนปลดปล่อย = ไม่ระเบิด)
  const shradeBlasts = Object.values(players).filter(
    (p) => p.alive && p.characterId === "shrade_elan" && (p.statuses.shradecharge || 0) === 1
  );

  // กระชากสายแลน (เจ้าแห่งเน็ตบ้าน): คืนบัฟที่ถูกถอดไว้ชั่วคราว — เทิร์นถัดไปกลับมามีผลต่อ
  //  (คืนก่อนลูปลดเทิร์นสถานะ = บัฟถูกนับเวลาเทิร์นนี้ไปด้วยตามสเปค "นับเทิร์นนี้")
  for (const p of Object.values(players)) {
    if (!p.unplugHold) continue;
    for (const [k, v] of Object.entries(p.unplugHold)) p.statuses[k] = Math.max(p.statuses[k] || 0, v);
    p.unplugHold = null;
  }

  for (const p of Object.values(players)) {
    for (const k of Object.keys(p.statuses || {})) {
      if (k === "rachan") continue; // สวมเกราะราชัน: ผลคงอยู่ถาวร ไม่ลดเทิร์น
      if (k === "dawn") continue;   // ยามฟ้าสาง (โอเบรอน): สแตคถาวร จนกว่า Vortigern จะล้าง
      if (k === "chill") continue;  // ชิวๆครับน้องๆ (Apple guy): คงอยู่จนกว่าจะถูกโจมตี ไม่ลดเทิร์น
      // โหมงานหนัก (โคโตเนะ patch พิเศษ): คงอยู่ 3 เทิร์นแล้วหมดเอง (หรือลบก่อนด้วย Sleeping time ตอนกลางคืน)
      if (k === "ksleep") continue;   // Sleeping time (โคโตเนะ): หลับจนหมดเฟสกลางคืน (ตื่นตอนเช้า)
      if (k === "godtree") continue; // ไปยังพฤกษาแห่งชีวิต (อควาเรียน): คงอยู่จนกว่ากลางวันจะหมด/ยกเลิกเอง ไม่ลดเทิร์น
      if (k === "melody") continue;  // ท่วงทำนอง (ชเรด เอลัน): สแตคถาวร สะสมจนครบ 5 เพื่อรวมร่าง
      if (k === "fortune") continue; // โชคลาภ (Bard): คงอยู่จนกว่าจะจั่วไพ่ครั้งถัดไป
      if (k === "evade") continue;   // Encore (Bard patch 2.0.5): หลบหลีก คงอยู่จนกว่าจะถูกเลือกโจมตีครั้งถัดไป
      if (k === "deathline") continue; // เส้นตาย (ชิกิ): สแตคถาวร จนกว่าจะถูกชิกิโจมตีปกติระหว่างท่าไม้ตาย
      // ปีกแห่งสุริยัน (อควาเรียน): ระหว่างท่าไม้ตายไปยังพฤกษาแห่งชีวิตทำงาน ร่างไม่มีวันหมด
      //  (คงอยู่จนกว่าผลท่าไม้ตายจะจบลงหรือตาย — ค่อยกลับมานับเทิร์นต่อ)
      if (k === "godwing" && (p.statuses.godtree || 0) > 0) continue;
      if (k === "mage") { delete p.statuses.mage; continue; } // จอมเวทย์ฝึกหัด: เก็บเป็นสแตค อยู่แค่ 1 เทิร์น
      // หลับไหล: เทิร์นที่เพิ่งโดนกล่อม ยังไม่เริ่มนับ (เริ่มหลับจริงเทิร์นถัดไป ครบตามจำนวนยามฟ้าสาง)
      if (k === "sleep" && p.sleepFresh) { p.sleepFresh = false; continue; }
      p.statuses[k]--;
      if (p.statuses[k] <= 0) {
        delete p.statuses[k];
        // ปีกแห่งสุริยันจบลง (อควาเรียน): ล้างแสงละอองที่สะสมออกทั้งหมด
        if (k === "godwing" && p.characterId === "aquarion") {
          p.lightDew = 0;
          lastLog.push(`🌟 ${p.name} ผลปีกแห่งสุริยันจบลง — แสงละอองถูกล้างออก`);
        }
        // มิติมายาบรรเลงสิ้นสุด (Bard): รีเซ็ตท่อนทำนองทั้งหมด — ฉากหลัง/เพลงกลับสู่ปกติ
        if ((k === "bloodDim" || k === "soulDim") && p.characterId === "bard") {
          p.bloodSection = 0;
          p.soulSection = 0;
          lastLog.push(`🎼 ${p.name} มิติมายาบรรเลงสิ้นสุด — ท่อนทำนองทั้งหมดถูกรีเซ็ต`);
        }
        // เชื่อมผลจบลง (Resonance): ตัดลิงก์ทั้งสองฝั่ง
        if (k === "linked") p.linkedWith = null;
      }
    }
    for (const k of Object.keys(p.seen || {})) {
      if (k === "ntd" || k === "beat" || k === "eva3") continue; // NT-D คงอยู่จนแก้แค้น / Beat Mode ถาวร / eva3 เปิดปิดตามเลือด
      if (!(p.statuses[k] > 0)) delete p.seen[k];
    }
    // เลือดชั่วคราว (แกมเบลอร์): หายเองเมื่อครบ 2 เทิร์น
    if ((p.tempHp || 0) > 0) {
      p.tempHpTurns--;
      if (p.tempHpTurns <= 0) { p.tempHp = 0; p.tempHpTurns = 0; }
    }
    // [โหมงานหนัก] (โคโตเนะ): เกราะพังและฟื้นไม่ได้ — ล้างเกราะที่ได้มาระหว่างเทิร์นทิ้ง
    if (overworkActive(p)) p.armor = 0;
    p.armor = Math.min(p.armor, maxArmorOf(p)); // กันเกราะเกินเพดาน
  }

  // ไปยังพฤกษาแห่งชีวิต (อควาเรียน): ระหว่างผลยังทำงาน กลางวันจะยาวไม่สิ้นสุด
  //  — ต่อเวลากลางวันให้คลุมเทิร์นถัดไปทุกครั้งที่จบเทิร์น จนกว่าจะกดยกเลิกหรือตาย
  for (const p of alivePlayers()) {
    if (p.characterId === "aquarion" && (p.statuses.godtree || 0) > 0) {
      dayForceUntil = Math.max(dayForceUntil, roundNumber + 1);
    }
  }

  // จบเทิร์นรอบนั้น +1 — ช่วงกลางวันได้แต้มสกิลเพิ่มอีก +1 (ระบบกลางวัน/กลางคืน)
  const dayBonus = !isNightRound(roundNumber);
  for (const p of alivePlayers()) {
    let gain = dayBonus ? 2 : 1;
    // ค่าปรับปฏิเสธข้อเสนอ (เจ้าแห่งเน็ตบ้าน): แต้มสกิลหลังจบเทิร์นลด 1
    if ((p.skillDrain || 0) > 0) {
      gain = Math.max(0, gain - 1);
      p.skillDrain--;
      lastLog.push(`📵 ${p.name} ค่าปรับปฏิเสธข้อเสนอ — แต้มสกิลจบเทิร์นลด 1${p.skillDrain > 0 ? ` (เหลืออีก ${p.skillDrain} เทิร์น)` : ""}`);
    }
    addSkill(p, gain);
  }
  if (dayBonus) lastLog.push("☀️ จบเทิร์นช่วงกลางวัน — ทุกคนได้แต้มสกิลเพิ่ม +1");

  // ชิวๆครับน้องๆ (Apple guy): จบเทิร์นได้แต้มสกิลเพิ่ม +1 จนกว่าจะถูกโจมตี
  for (const p of alivePlayers()) {
    if ((p.statuses.chill || 0) > 0) {
      addSkill(p, 1);
      lastLog.push(`🏖️ ${p.name} ชิวๆครับน้องๆ — จบเทิร์นได้แต้มสกิลเพิ่ม +1`);
    }
  }

  // Everything For Humanity (ฟุจิมารุ): ผลจบลงแล้วเกมยังไม่จบ -> จ่ายราคา ตัวละครตายลง
  for (const p of Object.values(players)) {
    if (p.alive && p.humanityActivated && !(p.statuses.humanity > 0)) {
      p.hp = 0;
      lastLog.push(`💫 ${p.name} ผลของ Everything For Humanity จบลง — ร่างกายรับไม่ไหว...`);
    }
  }

  for (const p of Object.values(players)) {
    if (p.alive && p.hp <= 0) {
      // ไปยังพฤกษาแห่งชีวิต (อควาเรียน): ตายขณะสถานะนี้ยังอยู่ -> รอฟื้นคืนชีพ (เช็คว่าเกมจบไหมด้านล่าง)
      if (p.characterId === "aquarion" && (p.statuses.godtree || 0) > 0) p.pendingRevive = true;
      p.hp = 0; p.alive = false; p.result = "dead";
      lastLog.push(`💀 ${p.name} เลือดจริงหมด ตกรอบ!`);
    }
  }
  // ระเบิด fourth impact: เอวา 13 ตายขณะสถานะยังอยู่ -> ทุกคนในสนามรับ 5 หน่วย (เกราะก่อนแล้วเลือด)
  if (evaBlasts.length) {
    for (const e of evaBlasts) {
      lastLog.push(`💥 ${e.name} ไม่สามารถแก้ไขอะไรได้อีกแล้ว — ทุกสิ่งทุกอย่างไร้ความหมาย! ระเบิดใส่ทุกคน -${EVA_BLAST_DMG}`);
      for (const o of alivePlayers()) {
        if (o.id === e.id) continue;
        dealMixed(o, EVA_BLAST_DMG);
        maybeBeatSave(o);
        maybeBeatMode(o);
        maybeEva3(o);
        o.wasAttacked = true;
      }
      triggerCutscene(e, "evaboom");
    }
    // เช็คคนตายจากแรงระเบิดอีกรอบ
    for (const p of Object.values(players)) {
      if (p.alive && p.hp <= 0) {
        if (p.characterId === "aquarion" && (p.statuses.godtree || 0) > 0) p.pendingRevive = true;
        p.hp = 0; p.alive = false; p.result = "dead";
        lastLog.push(`💀 ${p.name} เลือดจริงหมด ตกรอบ!`);
      }
    }
  }
  // แด่เพื่อนรักของฉัน (ชเรด เอลัน): ครบ 3 เทิร์น — เล่นวีดีโอสุดท้าย แล้วระเบิดใส่ทุกคนบนสนาม 5 หน่วย
  //  จากนั้นชเรดจบชีวิตลงตามไป — หากทุกคนตายเพราะท่านี้หมดก่อน ชเรดถือว่าเป็นผู้ชนะ (ไม่ตายตาม)
  for (const s of shradeBlasts) {
    if (!s.alive) continue; // ตายไปก่อนจะได้ปลดปล่อย = ท่าไม้ตายไม่ระเบิด
    lastLog.push(`🎻💥 ${s.name} แด่เพื่อนรักของฉัน — บทเพลงบรรเลงจบ! ระเบิดใส่ทุกคนบนสนาม -${SHRADE_BLAST_DMG}`);
    triggerCutscene(s, "shradeBlast");
    for (const o of alivePlayers()) {
      if (o.id === s.id) continue;
      dealMixed(o, SHRADE_BLAST_DMG);
      maybeBeatSave(o);
      maybeBeatMode(o);
      maybeEva3(o);
      maybeWakeKotone(o);
      o.wasAttacked = true;
    }
    // คนที่โดนบทเพลงจนเลือดหมด ตกรอบทันที
    for (const o of Object.values(players)) {
      if (o.alive && o.hp <= 0) {
        if (o.characterId === "aquarion" && (o.statuses.godtree || 0) > 0) o.pendingRevive = true;
        o.hp = 0; o.alive = false; o.result = "dead";
        lastLog.push(`💀 ${o.name} เลือดจริงหมด ตกรอบ!`);
      }
    }
    const othersLeft = alivePlayers().filter((o) => o.id !== s.id);
    if (othersLeft.length === 0) {
      lastLog.push(`👑 ${s.name} บทเพลงกวาดล้างทุกคนบนสนาม — ชเรดคือผู้ชนะ!`);
    } else {
      s.hp = 0; s.alive = false; s.result = "dead";
      lastLog.push(`🎻 ${s.name} จบชีวิตลงพร้อมบทเพลงสุดท้าย... ลาก่อนเพื่อนรัก`);
    }
  }
  // ไปยังพฤกษาแห่งชีวิต (อควาเรียน): ตั้งเวลาฟื้นคืนชีพ 12 เทิร์น ก็ต่อเมื่อเกมยังไม่จบ (เหลือผู้เล่นอื่นอย่างน้อย 2 คน)
  {
    const revivers = Object.values(players).filter((p) => p.pendingRevive);
    if (revivers.length) {
      const stillAliveNow = alivePlayers().length;
      for (const p of revivers) {
        p.pendingRevive = false;
        if (stillAliveNow >= 2) {
          p.reviveIn = AQUA_REVIVE_TURNS;
          lastLog.push(`🌳 ${p.name} ร่างสลายไปกับพฤกษาแห่งชีวิต — จะฟื้นคืนชีพใน ${AQUA_REVIVE_TURNS} เทิร์น หากเกมยังไม่จบ`);
        }
      }
    }
  }
  // ถ้าเป้าแก้แค้นตาย/หายไป -> NT-D สงบ
  for (const p of Object.values(players)) {
    if (p.ntdTarget && (!players[p.ntdTarget] || !players[p.ntdTarget].alive)) {
      p.ntdTarget = null;
      delete p.seen.ntd;
    }
  }
  // สัญญา (เจ้าแห่งเน็ตบ้าน): ฝ่ายใดฝ่ายหนึ่งตาย/หายไป -> สัญญาสิ้นสุด รอทำใหม่ได้
  for (const p of Object.values(players)) {
    if (p.contractPartner) {
      const t = players[p.contractPartner];
      if (!p.alive || !t || !t.alive || t.contractWith !== p.id) {
        if (t && t.contractWith === p.id) { t.contractWith = null; t.renewPending = false; }
        p.contractPartner = null;
        p.contractTurns = 0;
        if (p.alive || (t && t.alive)) lastLog.push(`📴 สัญญาของ ${p.name} สิ้นสุดลง`);
      }
    }
    if (p.contractOffer && (!p.alive || !players[p.contractOffer] || !players[p.contractOffer].alive)) p.contractOffer = null;
    if (p.contractWith && (!players[p.contractWith] || !players[p.contractWith].alive)) { p.contractWith = null; p.renewPending = false; }
  }

  // เล่นฉากระเบิด (ถ้ามี) ให้จบก่อน แล้วค่อยสรุปจบเกม/ขึ้นรอบถัดไป
  runCutsceneQueue(() => {
    const stillAlive = alivePlayers();
    const total = Object.keys(players).length;

    if (total >= 2 && stillAlive.length <= 1) {
      if (stillAlive.length === 1) lastLog.push(`🏆 ${stillAlive[0].name} คือผู้ชนะคนสุดท้าย!`);
      else lastLog.push("ไม่มีผู้รอด — เสมอ");
      gameState = "GAMEOVER";
      timeLeft = 0;
      broadcastState();
    } else {
      gameState = "TRANSITION";
      startPhaseTimer(TRANSITION_TIME, dealRound);
      broadcastState();
    }
  });
}

function backToLobby() {
  gameState = "LOBBY";
  clearPhaseTimer();
  timeLeft = 0;
  attackerId = null;
  roundWinnerId = null;
  roundNumber = 0;
  cycleShift = 0;
  nightResetPending = false;
  oberonDevour = 0;
  dayForceUntil = 0;
  lastLog = [];
  cutsceneQueue = [];
  cutsceneInfo = null;
  for (const p of Object.values(players)) {
    p.cards = []; p.locked = false; p.busted = false; p.result = null;
    resetRoundDisplay(p);
    resetCombat(p);
  }
  broadcastState();
}


// ============================================================
//  Socket.io
// ============================================================
io.on("connection", (socket) => {
  socket.emit("roster", publicRoster());
  socket.emit("positions", positionsFor(socket.id));

  socket.on("reserve", ({ position } = {}) => {
    const pos = Number(position);
    if (!pos) { delete reservations[socket.id]; broadcastPositions(); return; }
    if (pos < 1 || pos > 6 || positionUsedByOther(pos, socket.id)) return;
    reservations[socket.id] = pos;
    broadcastPositions();
  });

  socket.on("join", ({ name, position, characterId, shikiUlt } = {}) => {
    if (Object.keys(players).length >= MAX_PLAYERS) { socket.emit("full"); return; }
    if (gameState !== "LOBBY") { socket.emit("inProgress"); return; }
    const pos = Number(position);
    if (!pos || pos < 1 || pos > 6 || positionUsedByOther(pos, socket.id)) { socket.emit("positionTaken"); return; }
    delete reservations[socket.id];
    let ch = CHAR_BY_ID[characterId];
    if (!ch || ch.locked) ch = CHARACTERS.find((c) => !c.locked) || CHARACTERS[0];

    players[socket.id] = {
      id: socket.id,
      name: (name || "ผู้เล่น").toString().slice(0, 12),
      position: pos, characterId: ch.id, avatar: ch.avatar, img: ch.img,
      cards: [], locked: false, busted: false, result: null,
      hp: MAX_HP, armor: MAX_ARMOR, skillPoints: 0, alive: true, shield: 0,
      statuses: {}, seen: {}, ntdTarget: null, transformAt: 0, cutsceneShown: {},
      armorLocked: false, beatSaved: false, skillUsedRound: false,
      beamAmmo: BEAM_AMMO, puddingUses: PUDDING_USES,
      tonkatsu: 0, songAtk: 0, noDrawNext: 0, anataTargets: null, nightmareTarget: null,
      gamblerUses: GAMBLER_USES, profit: 0, tempHp: 0, tempHpTurns: 0, noSkillNext: 0,
      reiju: REIJU_USES, mageUses: 0, mageHealNext: 0, humanityActivated: false,
      sunriseDrop: 0, sleepFresh: false,
      appleItem: "drink", appleGifts: {}, appleAtk: 0, chillDodge: 100, appleGiveUses: APPLE_GIVE_USES,
      coins: 0, nightWork: 0, overworkNext: false, senaNext: false, danceBuff: false,
      contractPartner: null, contractWith: null, contractOffer: null,
      contractTurns: 0, renewPending: false, skillDrain: 0, skillDrainPending: 0,
      healNextTurn: 0, unplugHold: null,
      leader: "apollo", fused: false, lightDew: 0, reviveIn: 0,
      shradeForm: false,
      bardNotes: [], bardNotesUsed: 0, bardPending: null,
      bloodSection: 0, soulSection: 0, linkedWith: null,
      shikiUlt: shikiUlt === "wither" ? "wither" : "deatheye", witherBase: null,
      dmgHp: 0, dmgArmor: 0, gainedSkill: 0,
      wasAttacked: false, isWinner: false, isLoser: false,
    };
    socket.emit("joined");
    broadcastState();
    broadcastPositions();
  });

  socket.on("startGame", () => {
    if (gameState === "LOBBY" && Object.keys(players).length >= 1) startMatch();
  });

  socket.on("hit", () => hit(socket.id));
  socket.on("lock", () => lock(socket.id));
  socket.on("useSkill", ({ tier, targets, item } = {}) => useSkill(socket.id, tier, targets, item));
  socket.on("useReiju", ({ command } = {}) => useReiju(socket.id, command));
  socket.on("bardTarget", ({ targets } = {}) => bardTarget(socket.id, targets)); // Bard: เลือกเป้าหมายบทเพลง
  socket.on("contractAnswer", ({ accept } = {}) => answerContract(socket.id, !!accept)); // เจ้าแห่งเน็ตบ้าน: ตอบข้อเสนอ/ต่อสัญญา
  socket.on("attack", ({ targetId } = {}) => doAttack(socket.id, targetId));
  socket.on("backToLobby", () => { if (gameState === "GAMEOVER") backToLobby(); });

  socket.on("leave", () => {
    if (gameState !== "LOBBY") return;
    const p = players[socket.id];
    if (!p) return;
    reservations[socket.id] = p.position;
    delete players[socket.id];
    broadcastState();
    broadcastPositions();
  });

  socket.on("disconnect", () => {
    const wasAttacker = attackerId === socket.id;
    delete players[socket.id];
    delete reservations[socket.id];

    if (Object.keys(players).length === 0) {
      gameState = "LOBBY";
      clearPhaseTimer();
      attackerId = null;
      broadcastPositions();
      return;
    }
    if (gameState === "ATTACK" && wasAttacker) endTurn();
    else if (gameState === "PLAYING") { checkAllLocked(); broadcastState(); }
    else broadcastState();
    broadcastPositions();
  });
});


const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("🃏 ECHO — Blackjack Skill Battle ทำงานที่พอร์ต " + PORT));
