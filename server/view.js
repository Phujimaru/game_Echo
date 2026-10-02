// สร้างสถานะที่ส่งให้ผู้เล่นแต่ละคน + broadcast
// export ก่อน require: ไฟล์ใน server/ require วนกันเอง — function declaration ถูก hoist จึงพร้อมใช้ตั้งแต่บรรทัดแรก
Object.assign(module.exports, {
  displayImg, buildStateFor, broadcastState, broadcastPositions, takenUniqueChars,
});

const { CHAR_BY_ID } = require("../characters");
const CHAR_HOOKS = require("../characters/index");
const { SPELLBURDEN_MAX, statusAmtOf, blindActive } = require("../characters/_universal_status");
const YunaMod = require("../characters/yuna");
const Mark42 = require("../characters/_mark42");
const Journey = require("../characters/_journey");
const Seraph = require("../seraph");
const { io } = require("./app");
const {
  DOOM_BALLISTA_TARGET_DMG, DOOM_DRAIN_DMG, DOOM_DRAIN_TURNS, DOOM_LOCKON_BONUS,
  DOOM_ROCKET_BONUS_DMG, DOOM_WEAPONS, HIKARU_STRIUM_IMG, MAX_PLAYERS, OGURI_ZONE_IMG,
  PHENEX_BASE_IMG, PHENEX_NTD_IMG, SHIKI_DEATH_IMG, SHIKI_WITHER_IMG, SKILL_COST_MAX,
  TOHNO_DEATH_IMG, TRANSFORMS,
} = require("./constants");
const match = require("./match");
const { engine } = require("./engine");
const characterRules = require("./characterRules");
const combat = require("./combat");
const dayNight = require("./dayNight");
const cardDeck = require("./deck");
const lobby = require("./lobby");
const mercury = require("./modes/mercury");
const purge = require("./modes/purge");
const pair = require("./pair");
const shop = require("./shop");

// รูปที่แสดง: Beat Mode (ถาวรจนตาย) > ร่างสุดท้ายฟุจิมารุ (จนตาย) > Paradise (เหนือกว่าสกิลติดตัว NT-D)
//  > NT-D คงอยู่จนแก้แค้น > ไคจู Black King > Ginga > สวมเกราะราชัน
function displayImg(p, unmasked) {
  if (Mark42.suited(p)) return Mark42.IMG.suit; // เกราะ Mark 42: ภาพประจำตัวเป็นชุดเกราะระหว่างใส่
  if (p.characterId === "escanor" && CHAR_HOOKS.escanor.displayImg) return CHAR_HOOKS.escanor.displayImg(p);
  if (p.characterId === "ultraman_trigger") return "/characters/ultraman_trigger/trigger.webp";
  if (p.characterId === "hisakawa_sister") return CHAR_HOOKS.hisakawa_sister.displayImg(p);
  if (p.characterId === "ignis" && CHAR_HOOKS.ignis.displayImg) return CHAR_HOOKS.ignis.displayImg(p);
  if (p.characterId === "kim") { const kimg = CHAR_HOOKS.kim.displayImg(p); if (kimg) return kimg; } // ร่าง Awake
  // ฟุจิตะ โคโตเนะ: ระหว่างร่าง [พร้อมลุย] = ภาพ Kotone.png (null = ใช้ภาพปกติ)
  if (p.characterId === "kotone") { const kimg = CHAR_HOOKS.kotone.displayImg(p); if (kimg) return kimg; }
  // เอจิ: ระหว่างท่าไม้ตาย ไม่ว่ายังก็ตาม ทำงาน = ภาพ eiji_change.jpg (null = ใช้ภาพปกติ)
  if (p.characterId === "eiji") { const eimg = CHAR_HOOKS.eiji.displayImg(p); if (eimg) return eimg; }
  // ฮารุกะ: ระหว่างสถานะ "โอเมก้า" จากท่าไม้ตาย New Omega = ภาพ new_omega.jpg (null = ใช้ภาพปกติ)
  if (p.characterId === "haruka") { const himg = CHAR_HOOKS.haruka.displayImg(p); if (himg) return himg; }
  // มุยมิ: ระหว่างสถานะ “ดาบสะบั้น” ใช้ภาพท่าไม้ตาย
  if (p.characterId === "muimi") { const mimg = CHAR_HOOKS.muimi.displayImg(p); if (mimg) return mimg; }
  // แบทแมน: ระหว่างอยู่บนรถแบทโมบิล = ภาพรถ (null = ใช้ภาพปกติ)
  if (p.characterId === "bat_ben") { const bimg = CHAR_HOOKS.bat_ben.displayImg(p); if (bimg) return bimg; }
  // ไบรอัน: ระหว่างอยู่ในร่างรถ = ภาพ brian_car.webp (null = ใช้ภาพปกติ)
  if (p.characterId === "brian") { const rimg = CHAR_HOOKS.brian.displayImg(p); if (rimg) return rimg; }
  // โปรดิวเซอร์: ภาพไอดอลที่ยืนแนวหน้า — ไอดอลล้มแล้วกลับไปเป็นภาพโปรดิวเซอร์
  if (p.characterId === "producer_lumi") { const limg = CHAR_HOOKS.producer_lumi.displayImg(p); if (limg) return limg; }
  // คาเยนน์: ระหว่างร่าง "เกพาร์ด" = ภาพ gepard.webp (null = ใช้ภาพปกติ)
  if (p.characterId === "cayenne") { const cimg = CHAR_HOOKS.cayenne.displayImg(p); if (cimg) return cimg; }
  // ไดจิ โอโซระ: สวมเกราะ = ภาพเกราะ · unite = ultraman_x.webp (null = ใช้ภาพปกติ)
  if (p.characterId === "daichi") { const dimg = CHAR_HOOKS.daichi.displayImg(p); if (dimg) return dimg; }
  // คาซามะ ไดสุเกะ: ร่างบนสนามสลับตามโหมด CAST OFF / PUT ON
  if (p.characterId === "daisuke") { const kimg = CHAR_HOOKS.daisuke.displayImg(p); if (kimg) return kimg; }
  if (p.characterId === "yaguruma") { const yimg = CHAR_HOOKS.yaguruma.displayImg(p); if (yimg) return yimg; }
  if (p.characterId === "kagami") { const gimg = CHAR_HOOKS.kagami.displayImg(p); if (gimg) return gimg; }
  if (p.characterId === "tsurugi") { const simg = CHAR_HOOKS.tsurugi.displayImg(p); if (simg) return simg; }
  // เรียวกิ ชิกิ: ระหว่างท่าไม้ตาย ฉันมองเห็นมันแล้ว / ความตายที่โรยรา = ภาพสถานะท่าไม้ตาย
  if (p.characterId === "shiki" && (p.statuses.wither || 0) > 0) return SHIKI_WITHER_IMG;
  if (p.characterId === "shiki" && (p.statuses.deatheye || 0) > 0) return SHIKI_DEATH_IMG;
  // โทโนะ ชิกิ: ระหว่างถือ "หลับให้สบาย" (กดท่าไม้ตายแล้วยังไม่ได้ตี) = ภาพ tohno_death
  if (CHAR_HOOKS.tohno.deathForm(p)) return TOHNO_DEATH_IMG;
  // โอกูริ แคป: ระหว่างร่าง Zone (GrayBeast) = ภาพ zone_form
  if (p.characterId === "oguri" && (p.statuses.graybeast || 0) > 0) return OGURI_ZONE_IMG;
  // ผู้สังหารเมจ: เคยใช้ Witch Mark ไปแล้ว (ถาวร) = MS02.png แทน MS01.png ปกติ
  if (p.characterId === "mageslayer") return p.mageslayerHasMarked ? "/characters/mageslayer/MS02.png" : "/characters/mageslayer/MS01.png";
  // ทาคุมิ ฟุจิวาระ: ภาพเปลี่ยนตามเกียร์ธรรมดา — เกียร์ 1-2: takumi1.webp / เกียร์ 3-5: takumi3.jpg / เกียร์ 6: takumi6.jpg
  if (p.characterId === "takumi") {
    const gear = p.takumiGear || 1;
    if (gear >= 6) return "/characters/takumi/takumi6.jpg";
    if (gear >= 3) return "/characters/takumi/takumi3.jpg";
    return "/characters/takumi/takumi1.webp";
  }
  // ริต้า เบอร์นัล: ล็อบบี้ = rita.png — ลงสนามเป็น phenex.png ปกติ / phenex_ntd.png ระหว่างฝืนใช้งาน NTD-Sytem (ชั่วคราวหรือถาวร)
  if (p.characterId === "phenex") {
    if (match.gameState === "LOBBY") return p.img;
    if ((p.statuses.phenexNtd || 0) > 0 || p.phenexNtdPermanent) return PHENEX_NTD_IMG;
    return PHENEX_BASE_IMG;
  }
  // สึงาชิ ทาคุโตะ (patch 2.2.5): สกิลติดตัว 1 กันตายทำงานไปแล้วสักครั้ง — ระหว่างที่ยังอยู่ในร่างฉันคว้ามันได้แล้ว ใช้ภาพ tauburn_un.jpg แทน tauburn.jpg ปกติ
  if (p.characterId === "takuto" && p.beatSaved && (p.statuses.apprivoise || 0) > 0) return TRANSFORMS.takutoAwaken.img;
  // ไรโด ฮิคารุ (patch 2.1.3): Ginga Strium อยู่เหนือกว่า Ginga (สกิลรอง 1)
  if (p.characterId === "hikaru" && p.seen && p.seen.gingastrium && (p.statuses.gingastrium || 0) > 0) return HIKARU_STRIUM_IMG;
  // ไรโด ฮิคารุ (patch 2.1.6): แก้บั๊ก — MonsterLive (ไคจู Black King) เคยเปลี่ยนภาพได้ก่อน patch 2.1.3 แล้วหายไป คืนให้กลับมาเปลี่ยนภาพอีกครั้ง
  //  ลำดับความสำคัญ: Ginga Strium > ไคจู Black King > Ginga (ตามที่ระบุไว้ในคอมเมนต์ด้านบนฟังก์ชันนี้)
  if (p.characterId === "hikaru" && (p.statuses.monster || 0) > 0) return TRANSFORMS.monster.img;
  for (const key of ["ginga", "apprivoise"]) {
    if (p.seen && p.seen[key] && (p.statuses[key] || 0) > 0) return TRANSFORMS[key].img;
  }
  return p.img;
}
// เพลงสกิล: Ultraman Trigger ทับทุกเพลงระหว่างอยู่ในร่าง > Beat Mode > คนที่เปิดร่างล่าสุด
//  คืน { music, at } — at = ลำดับการเปิดร่าง ให้ client รู้ว่าเป็น "การเปิดครั้งใหม่"
//  (เปิดท่าซ้ำ / คนอื่นเปิดท่าเพลงเดียวกันทับ) -> เพลงต้องเริ่มใหม่จากต้น
function activeSkillMusic() {
  // คอนเนอร์ RK800 (characters/conner.js): เพลงไล่ล่า conner_theme ทับทุกเพลงตลอดช่วงจับกุมขั้นเด็ดขาด
  //  (เกตเดียวกับผลจริงของโหมดไล่ล่า — จบการไล่ล่าเมื่อไหร่เพลงกลับสู่ปกติทันที)
  // อุซากิ: เพลง usagi_theme ตลอดช่วงท่าไม้ตาย (โจทย์คณิต 3 เทิร์น)
  let bestUsagi = null;
  for (const p of combat.alivePlayers()) {
    if (p.characterId !== "usagi" || !((p.statuses.usagiMath || 0) > 0)) continue;
    if (!bestUsagi || (p.transformAt || 0) > bestUsagi.at) bestUsagi = { music: "usagi_theme", at: p.transformAt || 0 };
  }
  if (bestUsagi) return bestUsagi;
  const bestConner = CHAR_HOOKS.conner.activeMusic(engine);
  if (bestConner) return bestConner;
  // Ultraman Trigger: เพลงประจำร่างเล่นค้างตลอด 10 เทิร์นและมีลำดับสูงสุด
  let bestTrigger = null;
  for (const p of combat.alivePlayers()) {
    if (p.characterId !== "ultraman_trigger") continue;
    if (!bestTrigger || (p.transformAt || 0) > bestTrigger.at) bestTrigger = { music: "trigger", at: p.transformAt || 0 };
  }
  if (bestTrigger) return bestTrigger;
  // มุยมิ: เพลงประจำท่าไม้ตายเล่นค้างตลอดช่วง “ดาบสะบั้น”
  let bestMuimi = null;
  for (const p of combat.alivePlayers()) {
    if (CHAR_HOOKS.muimi.towerActive(p)) {
      if (!bestMuimi || (p.transformAt || 0) > bestMuimi.at) bestMuimi = { music: "muimi", at: p.transformAt || 0 };
    }
  }
  if (bestMuimi) return bestMuimi;
  let bestHisakawa = null;
  for (const p of combat.alivePlayers()) {
    if (p.characterId === "hisakawa_sister" && (p.statuses.hisakawaDream || 0) > 0) {
      if (!bestHisakawa || (p.transformAt || 0) > bestHisakawa.at) bestHisakawa = { music: "hisakawa_sunday", at: p.transformAt || 0 };
    }
  }
  if (bestHisakawa) return bestHisakawa;
  // ทาคุมิ ฟุจิวาระ: ถึงจะมองไม่เห็น แต่ฉันยังอยู่ ทำงานอยู่ — เพลง forever เล่นค้าง (priority สูงกว่าเพลงตามเกียร์ ต่ำกว่า Beat Mode)
  let bestTakumiBlackout = null;
  for (const p of combat.alivePlayers()) {
    if (p.characterId === "takumi" && (p.statuses.takumiBlackout || 0) > 0) {
      if (!bestTakumiBlackout || (p.transformAt || 0) > bestTakumiBlackout.at) bestTakumiBlackout = { music: "forever", at: p.transformAt || 0 };
    }
  }
  if (bestTakumiBlackout) return bestTakumiBlackout;
  // สึงาชิ ทาคุโตะ (patch 2.2.5): สกิลติดตัว 1 กันตายทำงานไปแล้วสักครั้ง — ระหว่างที่ยังอยู่ในร่างฉันคว้ามันได้แล้ว เพลง takuto2 เล่นแทน takuto ปกติ
  let bestTakutoAwaken = null;
  for (const p of combat.alivePlayers()) {
    if (p.characterId === "takuto" && p.beatSaved && (p.statuses.apprivoise || 0) > 0) {
      if (!bestTakutoAwaken || (p.takutoAwakenAt || 0) > bestTakutoAwaken.at) bestTakutoAwaken = { music: "takuto2", at: p.takutoAwakenAt || 0 };
    }
  }
  if (bestTakutoAwaken) return bestTakutoAwaken;
  // แด่เพื่อนรักของฉัน (ชเรด เอลัน): เพลง shrade_theme เล่นค้างตลอดช่วงชาร์จ (รองจาก Beat Mode)
  // มิติมายาบรรเลง (Bard): BGM มิติเล่นวนตลอด 3 เทิร์นที่มิติเปิดอยู่
  let bestBard = null;
  for (const p of combat.alivePlayers()) {
    if (p.characterId === "bard" && ((p.statuses.bloodDim || 0) > 0 || (p.statuses.soulDim || 0) > 0)) {
      if (!bestBard || (p.transformAt || 0) > bestBard.at) bestBard = { music: "bard_dim", at: p.transformAt || 0 };
    }
  }
  if (bestBard) return bestBard;
  // ไบรอัน (characters/brian.js): เพลงประจำร่างรถ · ระหว่างการแข่งที่มีเดิมพันใช้เพลงการแข่งแทน
  const bestBrian = CHAR_HOOKS.brian.activeMusic(engine);
  if (bestBrian) return bestBrian;
  // โปรดิวเซอร์: เพลงประจำไอดอลระหว่างท่าไม้ตาย 1 · เพลง luminous ระหว่างท่าไม้ตาย 2
  const bestLumi = CHAR_HOOKS.producer_lumi.activeMusic(engine);
  if (bestLumi) return bestLumi;
  // คาเยนน์ (characters/cayenne.js): เพลงประจำร่างเกพาร์ด — ขึ้นหลังวีดีโอแปลงร่างจบ ค้างตลอดที่ร่างยังอยู่
  const bestCay = CHAR_HOOKS.cayenne.activeMusic(engine);
  if (bestCay) return bestCay;
  // ไดจิ โอโซระ (characters/daichi.js): เพลง daichi_theme ค้างตลอด unite
  const bestDaichi = CHAR_HOOKS.daichi.activeMusic(engine);
  if (bestDaichi) return bestDaichi;
  // อิปโป (characters/ippo.js): เพลงประจำท่า Dempsey roll — เล่นค้างตลอดที่บัฟยังอยู่
  const bestIppo = CHAR_HOOKS.ippo.activeMusic(engine);
  if (bestIppo) return bestIppo;
  // Bamboo-Hatted Kim: เพลงร่าง Awake เล่นค้างตลอดที่ยังอยู่ในร่าง (ถาวรจนตาย)
  const bestKim = CHAR_HOOKS.kim.activeMusic(engine);
  if (bestKim) return bestKim;
  // ยุย (characters/yui.js): เพลงประจำท่าไม้ตายที่กำลังบรรเลงอยู่
  const bestYui = CHAR_HOOKS.yui.activeMusic(engine);
  if (bestYui) return bestYui;
  // อิสึกะ ชิโด (characters/shido.js): เพลง shido_theme เล่นค้างตลอดที่ Sandalphon ยังอยู่
  const bestShido = CHAR_HOOKS.shido.activeMusic(engine);
  if (bestShido) return bestShido;
  // เข้ามาเลย (แบทแมน patch 2.2.7): เพลง bat_ben_theme เล่นค้างตลอดที่ล่อเป้าอยู่
  let bestBat = null;
  for (const p of combat.alivePlayers()) {
    if (p.characterId === "bat_ben" && (p.statuses.batTaunt || 0) > 0) {
      if (!bestBat || (p.transformAt || 0) > bestBat.at) bestBat = { music: "bat_ben", at: p.transformAt || 0 };
    }
  }
  if (bestBat) return bestBat;
  // ทุกอย่างจะต้องราบรื่น (เจ้าหญิงราก patch 2.2.7): เพลง p_shiki_theme เล่นค้างระหว่างท่าไม้ตายทำงาน
  let bestPShiki = null;
  for (const p of combat.alivePlayers()) {
    if (p.characterId === "princess_shiki" && (p.statuses.pshikiUlt || 0) > 0) {
      if (!bestPShiki || (p.transformAt || 0) > bestPShiki.at) bestPShiki = { music: "p_shiki", at: p.transformAt || 0 };
    }
  }
  if (bestPShiki) return bestPShiki;
  // ฉันมองเห็นมันแล้ว / ความตายที่โรยรา (ชิกิ): เพลงประจำท่าเล่นค้างระหว่างท่าไม้ตายทำงาน
  let bestShiki = null;
  for (const p of combat.alivePlayers()) {
    if (p.characterId !== "shiki") continue;
    if ((p.statuses.wither || 0) > 0) {
      if (!bestShiki || (p.transformAt || 0) > bestShiki.at) bestShiki = { music: "shiki2", at: p.transformAt || 0 };
    } else if ((p.statuses.deatheye || 0) > 0) {
      if (!bestShiki || (p.transformAt || 0) > bestShiki.at) bestShiki = { music: "shiki", at: p.transformAt || 0 };
    }
  }
  if (bestShiki) return bestShiki;
  // โทโนะ ชิกิ: เพลง tohno_theme เล่นค้างระหว่างถือ "หลับให้สบาย" (characters/tohno.js)
  const bestTohno = CHAR_HOOKS.tohno.activeMusic(engine);
  if (bestTohno) return bestTohno;
  // Mystic eye of death perception (นานายะ ชิกิ patch 2.1.9): เพลง nanaya_theme เล่นค้างระหว่างเปิดใช้งาน — ปิดพร้อมกับปิดสกิลติดตัว
  let bestNanaya = null;
  for (const p of combat.alivePlayers()) {
    if (p.characterId === "nanaya" && p.nanayaEyeOn) {
      if (!bestNanaya || (p.transformAt || 0) > bestNanaya.at) bestNanaya = { music: "nanaya", at: p.transformAt || 0 };
    }
  }
  if (bestNanaya) return bestNanaya;
  // นายเป็นคนทำตัวเองนะ (เทเปา ชิกิ): เพลง tepeu_theme เล่นค้างช่วงฉากหลังซ้อนแบบโทโนะ ชิกิ หลังท่าไม้ตายจบ
  let bestTepeu = null;
  for (const p of combat.alivePlayers()) {
    if (p.characterId === "tepeu" && (p.tepeuEyeTurns || 0) > 0) {
      if (!bestTepeu || (p.transformAt || 0) > bestTepeu.at) bestTepeu = { music: "tepeu", at: p.transformAt || 0 };
    }
  }
  if (bestTepeu) return bestTepeu;
  // Mana Burden (ผู้สังหารเมจ): เพลง mageslayer_ult เล่นค้างตามอายุของ Mana Burden ที่ตัวเองร่ายไว้
  //  (ผูกกับ p.statuses.mageslayerBurdenBgm ที่ตั้งตอนใช้สกิล — เดิมผูกกับ spellburden ของตัวเอง แต่สกิลไม่ใส่ให้ตัวเองแล้ว)
  let bestMageslayer = null;
  for (const p of combat.alivePlayers()) {
    if (p.characterId === "mageslayer" && (p.statuses.mageslayerBurdenBgm || 0) > 0) {
      if (!bestMageslayer || (p.transformAt || 0) > bestMageslayer.at) bestMageslayer = { music: "mageslayer_ult", at: p.transformAt || 0 };
    }
  }
  if (bestMageslayer) return bestMageslayer;
  // ทาคุมิ ฟุจิวาระ: เพลงประจำตัวตามเกียร์ธรรมดา — เกียร์ 3-5: all_around / เกียร์ 6: secret_love (เกียร์ 1-2 ไม่มีเพลงพิเศษ)
  let bestTakumiGear = null;
  for (const p of combat.alivePlayers()) {
    if (p.characterId !== "takumi") continue;
    const gear = p.takumiGear || 1;
    const gearMusic = gear >= 6 ? "secret_love" : gear >= 3 ? "all_around" : null;
    if (!gearMusic) continue;
    if (!bestTakumiGear || (p.transformAt || 0) > bestTakumiGear.at) bestTakumiGear = { music: gearMusic, at: p.transformAt || 0 };
  }
  if (bestTakumiGear) return bestTakumiGear;
  // Wonder of U (ซาโตรุ patch 2.0.8.2): เพลงเล่นค้างตราบใดที่ยังมีผู้เล่นติด [Calamity] อยู่บนสนาม
  let bestWou = null;
  for (const p of combat.alivePlayers()) {
    if (p.characterId !== "satoru") continue;
    if (!Object.values(match.players).some((o) => o.alive && (o.statuses.calamity || 0) > 0)) continue;
    if (!bestWou || (p.transformAt || 0) > bestWou.at) bestWou = { music: "wonderofu", at: p.transformAt || 0 };
  }
  if (bestWou) return bestWou;
  let best = null;
  for (const key of ["ginga", "gingastrium", "graybeast", "doomCrucible", "apprivoise",
    // ฟุจิตะ โคโตเนะ: เพลงประจำร่าง [พร้อมลุย] + เพลงที่ขึ้นหลังปล่อยท่าไม้ตาย 3/4/5 (ค้างจนจบเทิร์น)
    "kready", "kawaii", "kcampus", "kshuki"]) {
    const t = TRANSFORMS[key];
    if (!t.music) continue;
    for (const p of combat.alivePlayers()) {
      if (p.seen && p.seen[key] && (p.statuses[key] || 0) > 0) {
        if (!best || (p.transformAt || 0) > best.at) best = { music: t.music, at: p.transformAt || 0 };
      }
    }
  }
  return best;
}

// ============================================================
//  ส่งสถานะ
// ============================================================
// สถานะที่ผู้เล่นคนอื่นเห็นได้ระหว่างช่วงจั่วการ์ด (patch 1.7.1): โชว์ให้ดูของกันและกันได้
//  ยกเว้นสกิลหลังเปิดไพ่ที่เพิ่งกดรอไว้ในเทิร์นนี้ — เปิดเผยเมื่อทำงานแล้วเท่านั้น (กันสปอยล์)
const HIDDEN_UNTIL_REVEAL = [
  "nightmare",
  "escanorSpearBurst", "escanorFlare", "escanorFlareNoon", "escanorPunch", "escanorRhitta", "escanorRhittaNoon",
];
function publicStatuses(p) {
  const out = {};
  for (const [k, v] of Object.entries(p.statuses || {})) {
    if (TRANSFORMS[k] && TRANSFORMS[k].afterReveal && !(p.seen && p.seen[k])) continue;
    if (HIDDEN_UNTIL_REVEAL.includes(k)) continue;
    out[k] = v;
  }
  return out;
}
function buildStateFor(viewerId) {
  const revealAll = match.gameState !== "PLAYING" && match.gameState !== "SERAPH_PLACE" && match.gameState !== "LOBBY" && match.gameState !== "TEAM_MODE" && match.gameState !== "TEAM_SETUP";
  // เพลง ANATA WAAAAAAAA ทับทุกเพลงระหว่างช่วงจั่วการ์ด — จบลงเมื่อทุกคนพร้อมเปิดไพ่แล้ว
  const nightNow = dayNight.isNightRound(match.roundNumber);
  // คาซามะ/โซ (Clock Up): ไรเดอร์ที่ยังแช่สนามอยู่ (เปิดอยู่และยังไม่ได้เปิดไพ่)
  //  มากกว่า 1 คน = สนาม FULL FORCE (เพลง + เอฟเฟกต์ความเร็วรอบจอ)
  //  ส่งเป็น "คนที่ดูอยู่ถูกแช่ไหม" — ไม่ใช่ id ของไรเดอร์คนแรกแล้วให้ client ไปเทียบเอง
  //  ⚠️ มีไรเดอร์เปิด Clock Up พร้อมกันหลายคนได้ — การเทียบกับคนแรกคนเดียว
  //  ทำให้ไรเดอร์คนที่สองโดนม่านบังทั้งที่ตัวเองก็เป็นเจ้าของท่า — จึงต้องใช้กติกาเดียวกับฝั่ง server ตรงๆ
  const clockUpFrozen = CHAR_HOOKS.daisuke.actionBlocked(engine, match.players[viewerId]);
  const fullForce = CHAR_HOOKS.daisuke.clockUpHosts(engine).length > 1;
  const hisakawaBg = Object.values(match.players).some((p) => p.alive && p.characterId === "hisakawa_sister" && (p.statuses.hisakawaDream || 0) > 0);
  // ฉันมองเห็นมันแล้ว (ชิกิ): ภาพ shiki_fill.png ซ้อนทับฉากหลัง | ความตายที่โรยรา: ฉากหลังวีดีโอ shiki_fill2.mp4
  //  โทโนะ ชิกิ: ระหว่างถือ "หลับให้สบาย" — ใช้ภาพซ้อนทับเดียวกับ "eye" (shiki_fill.png)
  //  นานายะ ชิกิ (patch 2.1.9): Mystic eye of death perception เปิดใช้งาน — ใช้ภาพซ้อนทับเดียวกัน (shiki_fill.png)
  const shikiBg = Object.values(match.players).some((p) => p.alive && p.characterId === "shiki" && (p.statuses.wither || 0) > 0)
    ? "wither"
    : Object.values(match.players).some((p) => p.alive && (
        (p.characterId === "shiki" && (p.statuses.deatheye || 0) > 0) ||
        CHAR_HOOKS.tohno.deathForm(p) ||
        (p.characterId === "nanaya" && p.nanayaEyeOn) ||
        (p.characterId === "tepeu" && (p.tepeuEyeTurns || 0) > 0) ||
        (p.characterId === "princess_shiki" && (p.statuses.pshikiUlt || 0) > 0)
      ))
      ? "eye" : null;
  // มิติมายาบรรเลง (Bard): ฉากหลังเปลี่ยนตามสายมิติ "blood" | "soul" | null
  const bardCycleNow = CHAR_HOOKS.bard.dimCycle(engine);
  const bardBg = bardCycleNow === "day" ? "blood" : bardCycleNow === "night" ? "soul" : null;
  // ยูนะ: เพลงล็อกทั้งสนาม ชนะทุกอย่างรวมถึง ANATA WAAAAAAAA ตลอด "ทุกเฟส" ของรอบ (จั่วไพ่/สรุปคะแนน/โจมตี) จนกว่าจะหมดเวลา
  //  ไม่ผูกกับ gameState==="PLAYING" เหมือน anata เพราะเอฟเฟกต์ยูนะไม่ได้จำกัดแค่ช่วงจั่วไพ่ — ตอน CUTSCENE ฝั่ง client เงียบเพลงเองอยู่แล้วไม่ต้องกันซ้ำที่นี่
  //  เอจิ: ท่าไม้ตาย ไม่ว่ายังก็ตาม เป็นคนบังคับเปิดสนาม Break Beat Bark! เอง — เพลงจึงเป็นลำดับ
  //  eiji_skill3_connect.m4a แล้วต่อด้วย Break Beat Bark!.mp3 วนลูป (MUSIC_SEQUENCES ฝั่ง client)
  const eijiUltOwner = Object.values(match.players).find((p) => p.alive && CHAR_HOOKS.eiji.ultActive(p));
  let sm = (match.overloadForceActive && match.gameState !== "CUTSCENE")
    ? { music: "overload_force", at: match.overloadForceSeq }
    : eijiUltOwner
    ? { music: "eiji_ult", at: eijiUltOwner.transformAt || 0 }
    : (match.yunaEffect && match.roundNumber <= match.yunaWindowEnd)
    ? { music: YunaMod.YUNA_MUSIC[match.yunaEffect], at: match.yunaMusicSeq }
    : (match.gameState === "PLAYING" && match.anataMusicSeq)
      ? { music: "temari_final_theme", at: match.anataMusicSeq }
      : activeSkillMusic();
  // FULL FORCE: ไรเดอร์สองคนขึ้นไป Clock Up พร้อมกัน — เพลงสนามเปลี่ยนทั้งสนาม
  //  ยังแพ้เพลงสกิล/ท่าไม้ตายที่กำลังเล่นอยู่
  if (!sm && fullForce) sm = { music: "full_force", at: 0 };
  const viewer = match.players[viewerId];
  let connorArrestAsk = null; // คอนเนอร์ RK800: คำขาดจับกุมขั้นเด็ดขาดที่รอผู้ชมคนนี้ตอบ
  let locaOffer = null;
  if (match.gameState === "PLAYING" && viewer && viewer.alive) {
    // คอนเนอร์ RK800: คำขาด "ยอมจำนน / ขัดขืน" ที่ยื่นมาที่เรา
    if (viewer.connorArrestAsk) {
      const from = match.players[viewer.connorArrestAsk.fromId];
      if (from && from.alive) {
        connorArrestAsk = {
          fromId: from.id, from: from.name,
          color: lobby.colorOf(from),
          img: CHAR_HOOKS.conner.IMG.skill2,
        };
      }
    }
    // Locacaca fruit (ซาโตรุ patch 2.0.8.2): ข้อเสนอผลไม้ที่รอผู้ชม state คนนี้ตอบ
    const locaFrom = Object.values(match.players).find((o) => o.alive && o.locaOffer === viewerId);
    if (locaFrom) locaOffer = { fromId: locaFrom.id, from: locaFrom.name, steal: CHAR_HOOKS.satoru.LOCA_STEAL, color: lobby.colorOf(locaFrom), img: "/characters/satoru/locaca.png" };
  }
  // ริต้า เบอร์นัล: ขอแค่ได้พบกันอีก — เลือกเป้าหมายปลดปล่อยความเจ็บปวด (ใช้ได้แม้ตกรอบไปแล้ว/ทุกเฟส)
  let phenexReleaseAsk = null;
  if (viewer && viewer.phenexReleaseAsk) {
    const options = viewer.phenexReleaseAsk.options
      .map((id) => match.players[id])
      .filter((o) => o && o.alive)
      .map((o) => ({ id: o.id, name: o.name, color: lobby.colorOf(o), img: displayImg(o) }));
    if (options.length) phenexReleaseAsk = { pain: viewer.phenexReleaseAsk.pain, options };
  }
  // แบทแมน: นายลืมของน่ะ — เลือกเป้าหมายส่งต่อความเสียหายที่รับไว้ (ทุกเฟส เหมือนของริต้า เบอร์นัล)
  let batKarmaAsk = null;
  if (viewer && viewer.batKarmaAsk) {
    const options = viewer.batKarmaAsk.options
      .map((id) => match.players[id])
      .filter((o) => o && o.alive)
      .map((o) => ({ id: o.id, name: o.name, color: lobby.colorOf(o), img: displayImg(o) }));
    if (options.length) batKarmaAsk = { dmg: viewer.batKarmaAsk.dmg, options };
  }
  // สมุดการ์ดกองกลาง: การ์ดทั้ง 43 ใบตามลำดับคงที่ + ใบไหนถูกจั่วไปแล้วในรอบนี้ (centralDeck สับใหม่ทุกรอบ — สมุดนี้จึงนับเฉพาะรอบปัจจุบัน)
  const remainingCardKeys = new Set(match.centralDeck.map(cardDeck.cardKey));
  const deckLedger = cardDeck.canonicalDeckCards().map((c) => ({ ...c, drawn: !remainingCardKeys.has(cardDeck.cardKey(c)) }));
  // คอนเนอร์ RK800: มีคอนเนอร์อยู่ในแมตช์นี้ไหม (มิเตอร์ความเครียดโผล่บน UI เฉพาะตอนมี)
  const connorInMatch = !!CHAR_HOOKS.conner.connerSlot(engine);
  return {
    connorArrestAsk, // คอนเนอร์ RK800: คำขาด "ยอมจำนน / ขัดขืน" ที่รอเราตอบ (ไม่ตอบก่อนเปิดไพ่ = ขัดขืน)
    locaOffer,     // ข้อเสนอผลโลกากากาที่รอเราตอบ (ซาโตรุ)
    phenexReleaseAsk, // ริต้า เบอร์นัล: เลือกเป้าหมายปลดปล่อยความเจ็บปวด (ขอแค่ได้พบกันอีก)
    batKarmaAsk,      // แบทแมน: เลือกเป้าหมายส่งต่อความเสียหาย (นายลืมของน่ะ)
    // นานายะ ชิกิ (patch 2.1.9): หัวใจฆาตกร — กำลังรอเลือกโจมตีซ้ำ/ยกเลิกอยู่ (เฉพาะผู้เล่นที่เป็นเจ้าของสิทธิ์นี้)
    nanayaReattack: !!(viewer && viewer.nanayaReattackReady && match.gameState === "ATTACK" && match.attackerId === viewer.id),
    gameState: match.gameState,
    gameMode: match.gameMode,
    teamSize: match.teamSize,
    teamCount: match.teamCount,
    teamOptions: lobby.currentTeamOptions(),
    modeOptions: lobby.modeOptionsFor(),
    modeVotes: lobby.modeVoteSummary(),
    winningTeamId: match.winningTeamId,
    timeLeft: match.timeLeft,
    roundNumber: match.roundNumber,
    overloadForce: match.overloadForceActive,
    deckEmpty: match.centralDeck.length === 0,
    cycle: nightNow ? "night" : "day", // กลางวัน/กลางคืน (สลับทุก 3 เทิร์น)
    // SE.RA.PH Moon Cell — ก้อนข้อมูลของโหมด (per-viewer ทั้งก้อน ดู SERAPH_SCENES.md §8)
    seraph: Seraph.stateFor(engine, viewerId),
    // Type Mercury (Raid Boss ORT): ข้อมูลโหมด + บอส + โหวตยอมแพ้ + ตัวที่เลือกลงสนามได้ (per-viewer)
    mercury: mercury.mercuryStateFor(viewer),
    ortArrival: { seq: match.ortArrivalSeq, active: match.ortArrivalActive }, // ฉากเปิดตัว ORT (Raid)
    // Purge: ตำแหน่งทุกคนในท่อ + ORT + ฉากเปิด/ฉากจบเทิร์นที่กำลังพักเกมรอ (ข้อมูลเดียวกันทุกคน)
    purge: purge.purgeStateFor(),
    // การเดินทาง (ffa/duo/trio): ภูมิภาค + กลางวัน/กลางคืน + คำอธิบายผลสนาม + ฉากแผนที่ที่กำลังพักเกมรอ
    journey: Journey.publicInfo(engine, match.journeyScene),
    clockUpFrozen,   // Clock Up: ผู้ชมคนนี้ถูกแช่อยู่ไหม (ไรเดอร์ที่เปิด Clock Up เองจะเป็น false เสมอ)
    fullForce,       // มีไรเดอร์ Clock Up พร้อมกันมากกว่า 1 คน
    hisakawaBg, // ฝันของเหล่าฝาแฝด: ฉากหลัง O-KU-RI-MO-NO-Sunday
    bardBg,   // มิติมายาบรรเลง (Bard): "blood" | "soul" | null
    shikiBg,  // ฉันมองเห็นมันแล้ว (ชิกิ): ซ้อน shiki_fill.png ทับฉากหลังปัจจุบัน
    maxPlayers: MAX_PLAYERS,
    youId: viewerId,
    attackerId: match.gameState === "ATTACK" ? match.attackerId : null,
    winnerId: (match.gameState === "SUMMARY" || match.gameState === "ATTACK") ? match.roundWinnerId : null,
    skillMusic: sm ? sm.music : null,
    skillMusicSeq: sm ? sm.at : 0, // เปลี่ยน = การเปิดร่างครั้งใหม่ -> client เริ่มเพลงใหม่
    // คอนเนอร์ RK800: ออร่าขอบจอแดงระหว่างการไล่ล่า + สกอร์ดวลให้ทุกคนเห็น (เกตเดียวกับผลจริงของโหมดไล่ล่า)
    connorFieldFx: CHAR_HOOKS.conner.fieldFx(engine),
    brianFieldFx: CHAR_HOOKS.brian.fieldFx(engine), // ไบรอัน: ออร่าสนามระหว่างการแข่งที่มีเดิมพัน
    connorChase: (() => {
      const owner = CHAR_HOOKS.conner.chaseOwner(engine);
      if (!owner) return null;
      const t = match.players[owner.connorChase.targetId];
      return {
        byId: owner.id, by: owner.name,
        targetId: owner.connorChase.targetId, target: t ? t.name : "",
        round: owner.connorChase.round, rounds: CHAR_HOOKS.conner.CHASE_ROUNDS,
        mine: owner.connorChase.mine, theirs: owner.connorChase.theirs,
      };
    })(),
    yunaFieldFx: characterRules.yunaBeatBarkActive() ? "beatbark" : null, // Break Beat Bark!: ออร่าขอบจอแดงทั้งสนาม (เกตเดียวกับผลจริง)
    // onlyFor: คลิปที่เล่นให้เฉพาะบางคนดู — คนนอกลิสต์ได้ null (หน้าจอไม่เล่นวีดีโอ แต่ยังรอครบเวลาเท่ากัน)
    cutscene: (match.gameState === "CUTSCENE" && match.cutsceneInfo && (!match.cutsceneInfo.onlyFor || match.cutsceneInfo.onlyFor.includes(viewerId)))
      ? match.cutsceneInfo : null,
    attack: match.gameState === "ATTACKING" ? match.lastAttack : null,
    log: (match.gameState === "SUMMARY" || match.gameState === "TRANSITION" || match.gameState === "GAMEOVER") ? match.lastLog : [],
    shop: match.shopItems, // ร้านค้ามายา (patch 2.3): สินค้าส่วนกลางร้านเดียว เห็นเหมือนกันทุกคน
    deckLedger, // สมุดการ์ด 43 ใบ + สถานะจั่วแล้ว/ยัง (ของรอบปัจจุบัน) — กดที่กองการ์ดกลางเพื่อดู
    players: Object.values(match.players).map((p) => {
      const mine = p.id === viewerId;
      const show = mine || revealAll;
      // โหมดทีม (duo/trio) และ Type Mercury: เพื่อนร่วมทีมเห็นแต้มการ์ดกันตลอดเวลา — ศัตรู/ORT ยังถูกซ่อนตามปกติ
      //  isAlly: duo/trio = ทีมเดียวกัน · Mercury = ผู้เล่นจริงทุกคน (ไม่ใช้ sameTeam เพราะข้อยกเว้น explicitTargetIds)
      const teamReveal = !!viewer && lobby.isAlly(viewer, p);
      // ทาคุมิ ฟุจิวาระ: ถึงจะมองไม่เห็น แต่ฉันยังอยู่ ทำงานอยู่ — บังตากระดานทั้งหมด (score/cards/hp/armor/shield ของทุกคนรวมตัวเอง, แต้มสกิลของทุกคนยกเว้นตัวเอง)
      const takumiBlackout = characterRules.takumiBlackoutActive();
      // "ตาบอด" (สถานะ Universal patch 3.4 / ผลพ่วงของ "ลงทัณฑ์"): ผู้ที่ติดสถานะมองไม่เห็นอะไรเลย
      //  ใช้ช่องทางบังตาเดียวกับท่าไม้ตายของทาคุมิ ต่างกันที่นี่บังเฉพาะ "ผู้ชม" คนที่ตาบอด ไม่ใช่ทั้งสนาม
      const viewerBlind = !!viewer && (blindActive(viewer) || CHAR_HOOKS.the_supplicant.blindActive(viewer));
      const blackout = takumiBlackout || viewerBlind;
      // ใบโปรโมทสินค้า (Apple guy): แต้มการ์ดของคนติดสถานะถูกเปิดเผยให้ทุกคนเห็น (1 เทิร์น)
      const promoShow = (p.statuses.promo || 0) > 0;
      // คอนเนอร์ RK800 (สกิลพื้นฐาน วิเคราะห์สถานการณ์): เทิร์นนี้เห็นไพ่และแต้มของทุกคน (เห็นคนเดียว ไม่แชร์ให้ใคร)
      const ch = CHAR_BY_ID[p.characterId] || {};
      const pub = (s) => (s ? { name: s.name, desc: s.desc, cost: s.cost, img: s.img, ammo: s.ammo } : null);
      // สกิลพื้นฐานสลับกลางคืน (โคโตเนะ) + Apple guy: ปกสกิลพื้นฐานเปลี่ยนตามของส่งมอบที่เลือกอยู่
      let basicPub = pub(nightNow && ch.basicNight ? ch.basicNight : ch.basic);
      if (basicPub && p.characterId === "appleguy") basicPub.img = (CHAR_HOOKS.appleguy.ITEMS[p.appleItem] || CHAR_HOOKS.appleguy.ITEMS.drink).img;
      let secondaryPub = pub(nightNow && ch.secondaryNight ? ch.secondaryNight : ch.secondary);
      let ultimatePub = pub(nightNow && ch.ultimateNight ? ch.ultimateNight : ch.ultimate);
      // เรียวกิ ชิกิ: ท่าไม้ตายตามที่เลือกไว้ตอนเลือกตัว + ระหว่างความตายที่โรยรา ปกสกิล 1 เปลี่ยน
      if (ch.id === "shiki") {
        ultimatePub = pub((p.shikiUlt || "deatheye") === "wither" ? ch.ultimate2 : ch.ultimate);
        if (basicPub && (p.statuses.wither || 0) > 0) basicPub.img = "/characters/shiki/shiki_skill1.2.webp";
      }
      // คิชินามิ ฮาคุโนะ (patch 2.2.1): สกิลรองสลับตามเพศ + ปกสกิลพื้นฐาน (เธอ/นาย คือฉันหรอ?) โชว์ภาพเพศตรงข้ามเสมอ
      // ไรโด ฮิคารุ (patch 2.1.3): ระหว่างร่าง Ginga — สกิลพื้นฐานเปลี่ยนเป็น UPG! / ระหว่างร่าง Ginga Strium — สกิลรองเปลี่ยนเป็นลำแสงสโตเรียม
      if (ch.id === "hikaru") {
        basicPub = pub(((p.statuses.ginga || 0) > 0 || (p.statuses.gingastrium || 0) > 0) ? ch.basic2 : ch.basic);
        secondaryPub = pub((p.statuses.gingastrium || 0) > 0 ? ch.secondary2 : ch.secondary);
      }
      if (ch.id === "escanor") {
        basicPub = pub(CHAR_HOOKS.escanor.dynamicSkillFor(engine, p, ch, "basic"));
        secondaryPub = pub(CHAR_HOOKS.escanor.dynamicSkillFor(engine, p, ch, "secondary"));
        ultimatePub = pub(CHAR_HOOKS.escanor.dynamicSkillFor(engine, p, ch, "ultimate"));
      }
      // โปรดิวเซอร์ (patch 3.6): ช่องแรกสลับ "สลับไอดอล"/"ชุบไอดอล" (ภาพ = ไอดอลปัจจุบัน)
      //  และช่องท่าไม้ตายสลับตามไอดอล 5 คน + luminous — ต้องคิดสูตรเดียวกับ useSkill() เป๊ะ
      //  ไม่งั้นปุ่มค้างที่ชื่อ/ภาพของค่าเริ่มต้น ทั้งที่กดแล้วได้ท่าของไอดอลที่ยืนอยู่จริง
      if (ch.id === "producer_lumi") {
        basicPub = pub(CHAR_HOOKS.producer_lumi.dynamicSkillFor(p, ch, "basic"));
        ultimatePub = pub(CHAR_HOOKS.producer_lumi.dynamicSkillFor(p, ch, "ultimate"));
      }
      if (ch.id === "hisakawa_sister") {
        basicPub = pub(CHAR_HOOKS.hisakawa_sister.dynamicSkillFor(p, ch, "basic"));
        secondaryPub = pub(CHAR_HOOKS.hisakawa_sister.dynamicSkillFor(p, ch, "secondary"));
        ultimatePub = pub(CHAR_HOOKS.hisakawa_sister.dynamicSkillFor(p, ch, "ultimate"));
      }
      // ไดจิ โอโซระ: ภาพ/ชื่อช่องพื้นฐานและรองเปลี่ยนตามการ์ดไซเบอร์ที่ถืออยู่ (สูตรเดียวกับ useSkill)
      if (ch.id === "daichi") {
        basicPub = pub(CHAR_HOOKS.daichi.dynamicSkillFor(p, ch, "basic"));
        secondaryPub = pub(CHAR_HOOKS.daichi.dynamicSkillFor(p, ch, "secondary"));
      }
      if (ch.id === "ignis") {
        basicPub = pub(CHAR_HOOKS.ignis.dynamicSkillFor(p, ch, "basic"));
        secondaryPub = pub(CHAR_HOOKS.ignis.dynamicSkillFor(p, ch, "secondary"));
        ultimatePub = pub(CHAR_HOOKS.ignis.dynamicSkillFor(p, ch, "ultimate"));
      }
      // ฟุจิตะ โคโตเนะ (rework 2.3): ร่าง [พร้อมลุย] ทับปุ่มทั้ง 3 ช่องด้วยท่าไม้ตาย 3/4/5 (ทับทั้งกลางวัน/กลางคืน)
      if (ch.id === "kotone") {
        basicPub = pub(CHAR_HOOKS.kotone.dynamicSkillFor(p, ch, "basic", nightNow));
        secondaryPub = pub(CHAR_HOOKS.kotone.dynamicSkillFor(p, ch, "secondary", nightNow));
        ultimatePub = pub(CHAR_HOOKS.kotone.dynamicSkillFor(p, ch, "ultimate", nightNow));
      }
      // แบทแมน (patch 3.1): ขึ้นรถแบทโมบิลแล้ว — ทั้งสามช่องเปลี่ยนเป็นเวอร์ชันรถ
      if (ch.id === "bat_ben" && CHAR_HOOKS.bat_ben.inCar(p)) {
        basicPub = pub(ch.basic2);
        secondaryPub = pub(ch.secondary2);
        ultimatePub = pub(ch.ultimate2);
      }
      // โมโรโบชิ ดัน (patch 2.8 new): สกิลติดตัว "ครูฝึกสุดเหี้ยม" — เป้าหมาย "จงหลบแต่อย่าหนี" แพ้แต้มติดกัน 2 ครั้ง
      //  -> ปุ่มท่าไม้ตายกลายเป็น "อย่าให้ฉันต้องเฆี่ยนตี" (ต้องคิดสูตรเดียวกับ useSkill เป๊ะ ไม่งั้นราคาบนปุ่มไม่ตรงกับที่หักจริง)
      if (ch.id === "dan") {
        ultimatePub = pub(CHAR_HOOKS.dan.dynamicSkillFor(engine, p, ch, "ultimate"));
      }
      // โอกูริ แคป (Rework): ยุคทองครบ 3 + Stamina ชาร์จ 75 ขึ้นไป — ท่าไม้ตายกลายเป็น Ashen Trail
      if (ch.id === "oguri") {
        ultimatePub = pub(characterRules.oguriAshenReady(p) ? ch.ultimate2 : ch.ultimate);
      }
      // Bamboo-Hatted Kim: ร่าง Awake -> ท่าไม้ตาย 2 (สูตรเดียวกับ useSkill)
      if (ch.id === "kim") ultimatePub = pub(CHAR_HOOKS.kim.dynamicSkillFor(p, ch, "ultimate"));
      if (ch.id === "striker") ultimatePub = pub(CHAR_HOOKS.striker.dynamicSkillFor(p, ch, "ultimate")); // เตาปฏิกรณ์
      // สึงาชิ ทาคุโตะ (patch 2.2 new): Apprivoise! ทำงานแล้ว — สกิลพื้นฐานเปลี่ยนเป็น Star Sword Emeraude ถาวร
      // patch 2.2.5: กันตาย (สกิลติดตัว 1) เคยทำงานไปแล้ว — ท่าไม้ตายเปลี่ยนเป็นร่วมเดินทางไปกับฉันเถอะถาวร (แทนพิชิตแสงดาว)
      if (ch.id === "takuto") {
        if ((p.statuses.apprivoise || 0) > 0) basicPub = pub(ch.basic2);
        ultimatePub = pub(p.beatSaved ? ch.ultimate2 : ch.ultimate);
      }
      // ริดดี้ มาร์เซนาส (patch 2.0.9): ระหว่างเป็นพันธมิตร — ท่าไม้ตายเปลี่ยนเป็นท่า 2 ฉันจะไม่ยอมสูญเสียใครไปอีก
      // บานาจ ลิงก์ (patch 2.1.2): ระหว่างร่าง NewType Paradise — สกิลรอง 1 เปลี่ยนเป็น Beam Magnum เสมอ
      //  ท่าไม้ตายเปลี่ยนเป็นแสงที่ไม่อยู่เพียงลำพัง เฉพาะตอนมีริดดี้เป็นพันธมิตรอยู่ด้วย
      // ริต้า เบอร์นัล (patch 2.1.6): ระหว่างฝืนใช้งาน NTD-Sytem — สกิลรองเปลี่ยนเป็นสกิลรอง 2 / เกิดใหม่แล้ว — ท่าไม้ตายเปลี่ยนเป็นท่าไม้ตาย 2 ถาวร
      if (ch.id === "phenex") {
        const ntdOn = (p.statuses.phenexNtd || 0) > 0 || p.phenexNtdPermanent;
        secondaryPub = pub(ntdOn ? ch.secondary2 : ch.secondary);
        ultimatePub = pub(p.phenexReborn ? ch.ultimate2 : ch.ultimate);
      }
      // DoomGuy (patch 2.2 full): สกิลรอง "Weapon" โชว์ชื่อ/ราคา/ภาพตามอาวุธที่ถืออยู่จริง
      // ไบรอัน: ระหว่าง "การแข่งที่มีเดิมพัน" ช่องท่าไม้ตายกลายเป็น N2O — ต้องคิดสูตรเดียวกับ useSkill()
      //  ไม่งั้นปุ่มจะโชว์ชื่อ/ราคา/ภาพของท่าไม้ตาย 1 ทั้งที่กดแล้วได้ N2O
      if (ch.id === "brian" && CHAR_HOOKS.brian.n2oSlot(engine, p)) ultimatePub = pub(ch.ultimate2);
      // // คากามิ อาราตะ: ราคาบนการ์ดท่าไม้ตายต้องเป็นราคาของ "ขั้นถัดไป" ไม่ใช่ค่าคงที่ใน characters.js
      if (ch.id === "kagami" && ultimatePub) ultimatePub.cost = CHAR_HOOKS.kagami.ultimateCost(p);
      if (ch.id === "doomguy") {
        const w = DOOM_WEAPONS[p.doomWeapon] || DOOM_WEAPONS.shotgun;
        const effDesc = {
          explode: "เลือกเป้าหมาย 1 คน ติดสถานะ [ระเบิด] — โดนโจมตีเมื่อไหร่จะระเบิดใส่คนอื่นสุ่ม 2 คน -1",
          lockon: `เลือกเป้าหมาย 1 คน ติด [ล็อคเป้า] แน่นอน — โดนโจมตีครั้งถัดไปแรงขึ้น +${DOOM_LOCKON_BONUS}`,
          drain: `เลือกเป้าหมาย 1 คน ติดสถานะ [โดนดูด] — ดาเมจ ${DOOM_DRAIN_DMG} หน่วยทุกเทิร์น ${DOOM_DRAIN_TURNS} เทิร์น (เจาะเกราะก่อน)`,
          shield: "เพิ่มโล่ของตัวเอง +1 (ใช้ได้ครั้งเดียวต่อการถืออาวุธนี้)",
          bonusdmg: `เลือกเป้าหมาย 1 คน โดนดาเมจเพิ่มเติมทันที -${DOOM_ROCKET_BONUS_DMG}`,
          stun: "เลือกเป้าหมาย 1 คน สตั้น 1 เทิร์น",
          bonusdmg2: `เลือกเป้าหมาย 1 คน โดนดาเมจเพิ่มเติมทันที -${DOOM_BALLISTA_TARGET_DMG}`,
        }[w.effect] || "ไม่มีความสามารถพิเศษ";
        secondaryPub = { name: `Weapon: ${w.name}`, desc: `ถือ ${w.name} อยู่ — โจมตีปกติ${w.pierce ? "เจาะเกราะ" : ""} ${w.atk} หน่วย. ${effDesc}`, cost: w.cost, img: w.img };
      }
      // กระแสเวท/ภาระเวท (สถานะ Universal): ราคาที่โชว์บนปุ่มสกิลต้องตรงกับที่ useSkill() คิดจริง — ไม่งั้นจะโชว์ราคาเก่าทับกับผลกลางคืนไม่ถูกต้อง
      const spellflowAmt = statusAmtOf(p, "spellflow");
      const spellburdenAmt = Math.min(SPELLBURDEN_MAX, statusAmtOf(p, "spellburden"));
      // กลางคืน (patch 2.1.7): สุ่มแล้วให้สกิลพื้นฐานหรือสกิลรอง (อย่างใดอย่างหนึ่ง) ใช้แต้มมากขึ้น +1 — ไม่มีผลกับท่าไม้ตาย
      //  ซ้อนกับกระแสเวท/ภาระเวทได้ แต่ตัวปรับขาขึ้นรวมกันแล้วต้องไม่ดันราคาเกิน SKILL_COST_MAX
      //  (สกิลที่ค่าใช้พลังงานถึงเพดานอยู่แล้วจะไม่แพงขึ้นไปอีก — ต้องตรงกับ useSkill() เป๊ะ)
      const showCost = (pub, tierName) => {
        // SE.RA.PH: ฐานราคามาจากระดับทักษะ (2/4/6) ไม่ใช่ค่าของตัวละคร — ต้องตรงกับ useSkill() เป๊ะ
        const baseCost = Seraph.active() ? Seraph.costOf(tierName) : pub.cost;
        return Math.min(
          CHAR_HOOKS.striker.costCap(p, SKILL_COST_MAX), // ยูเรก้า: เพดาน 16 — ต้องตรงกับ useSkill()
          Math.max(0, baseCost - spellflowAmt) + spellburdenAmt + (p.nightTaxTier === tierName ? 1 : 0)
            + Journey.skillTax(engine, baseCost), // การเดินทาง (ป่าไม้ต้องสาป) — ต้องตรงกับ useSkill()
        );
      };
      // คอนเนอร์ (วิเคราะห์สถานการณ์ rework 3.4.2): "อ่านขาด" ทั้งลำดับแล้ว = เห็นแต้มการ์ดของเป้าหมาย
      //  คนนั้นคนเดียวตลอดเทิร์นนี้ (เดิมเปิดไพ่ + แต้ม + ประเมินดาเมจของทุกคนพร้อมกัน)
      const connorReads = !!viewer && CHAR_HOOKS.conner.readsScoreOf(viewer, p);
      if (basicPub) basicPub.cost = showCost(basicPub, "basic");
      if (secondaryPub) secondaryPub.cost = showCost(secondaryPub, "secondary");
      if (ultimatePub) ultimatePub.cost = showCost(ultimatePub, "ultimate");
      // สไตรเกอร์ ยูเรก้า: ระหว่างนับถอยหลัง ปุ่มท่าไม้ตาย = "ระเบิดทันที" ไม่เสียแต้ม (จ่าย 12 ไปแล้วตอนเปิดใช้)
      //  ต้องโชว์ราคา 0 ด้วย ไม่งั้นปุ่มฝั่ง client เช็คแต้มจากราคา 12 แล้วกดไม่ได้ (server ไม่หักอยู่แล้ว — striker.skillCost)
      if (ch.id === "striker" && ultimatePub && CHAR_HOOKS.striker.honorOn(p)) {
        ultimatePub.cost = 0;
        ultimatePub.name = `${ultimatePub.name} — ระเบิดทันที`;
      }
      // ---------- SE.RA.PH: ตัวละครถูกซ่อนจนกว่าจะลงดวล (SERAPH_MOONCELL.md §9) ----------
      //  per-viewer: คนที่เคยเห็นตัวละครนั้นลงสนามแล้วจะเห็นตลอดไป คนที่ยังไม่เคยเห็น = ไม่มีข้อมูลเลย
      //  ชื่อ "ผู้เล่น" ไม่ใช่ความลับ — ที่ซ่อนคือ "ตัวละคร" (ภาพ/ชื่อ/สกิลทั้งชุด)
      const scHidden = Seraph.active() && !Seraph.canSee(viewer, p);
      if (scHidden) { basicPub = null; secondaryPub = null; ultimatePub = null; }
      return {
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        img: scHidden ? null : displayImg(p, mine),
        scHidden,                                   // client วาดเป็นเงาดำ + ??? (ดู .sc-silhouette)
        scSpectator: Seraph.active() ? !!p.scSpectator : undefined,
        scEliminated: Seraph.active() ? !!p.scEliminated : undefined,
        // Matrix ระดับ 1: ผู้ชมคนนี้เห็นจำนวนไพ่ในมือของคนนี้แบบเรียลไทม์
        scMatrixLevel: Seraph.active() && viewer ? Seraph.matrixLevelOn(viewer, p) : undefined,
        position: p.position,
        color: lobby.colorOf(p),
        teamId: p.teamId || null,
        teamConfirmed: !!p.teamConfirmed,
        isBoss: mercury.isOrt(p),                                   // ORT: client วาดเป็นบอสตัวใหญ่ฝั่งตรงข้าม
        ort: mercury.isOrt(p) ? CHAR_HOOKS.ort.publicState(p) : undefined,
        // ORT สกิลติดตัว 1: ช่องสกิลของเราที่ "ข้อมูลสูญหาย" เทิร์นนี้ (เห็นเฉพาะเจ้าของ)
        ortLostTier: mine && CHAR_HOOKS.ort.lostTurnsLeft(engine, p) > 0 ? p.ortLostTier : null,
        ortLostTurns: mine ? CHAR_HOOKS.ort.lostTurnsLeft(engine, p) : 0,
        // อุซากิ: ปรุๆ (เห็นทุกคน) · ข้อเสนอสลับไพ่ / โจทย์คณิต (เห็นเฉพาะเจ้าตัว — ไม่ส่งเฉลย)
        usagi: p.characterId === "usagi" ? CHAR_HOOKS.usagi.publicState(p) : undefined,
        andersen: p.characterId === "andersen" ? CHAR_HOOKS.andersen.publicState(p) : undefined, // ตัวนับไพ่ที่จั่วเอง
        // โอเบรอน (ฤดูร้อน) / อาร์โทเรีย: คูลดาวน์/ล็อกรายช่อง — client ใช้ทำปุ่มเทา + ตัวเลขคูลดาวน์
        skillLocks: CHAR_HOOKS[p.characterId] && CHAR_HOOKS[p.characterId].skillLocks && (p.characterId === "oberon_summer" || p.characterId === "artoria_caster" || p.characterId === "reines" || p.characterId === "andersen")
          ? CHAR_HOOKS[p.characterId].skillLocks(engine, p) : undefined,
        ...(mine ? CHAR_HOOKS.usagi.privateState(engine, p) : {}),
        // Bamboo-Hatted Kim: ฝักดาบ/Poise/เหรียญ/บัพ (เห็นทุกคน) · คูลดาวน์/ห้ามจั่ว (เห็นเจ้าตัวคนเดียว)
        kim: CHAR_HOOKS.kim.publicState(p),
        // โทโนะ ชิกิ: โหมด/สถานะที่รอ (เห็นทุกคน) · รอยร้าวบนตัวผู้เล่นทุกคน (ขอบม่วงรอบไอคอนเกราะ)
        tohno: CHAR_HOOKS.tohno.publicState(p),
        tohnoCrack: p.tohnoCrack || 0,
        ...(mine ? CHAR_HOOKS.kim.privateState(engine, p) : {}),
        // Recruit: กระสุน/โควตาเตรียมตัว (เห็นทุกคน) · QTE (ตำแหน่งจุด) / คูลดาวน์ / การเลือกเป้า (เห็นเจ้าตัวคนเดียว)
        recruit: CHAR_HOOKS.recruit.publicState(p),
        ...(mine ? CHAR_HOOKS.recruit.privateState(engine, p) : {}),
        // สไตรเกอร์ ยูเรก้า: สถานะท่า/นับถอยหลัง/คำขออนุมัติ (เห็นทุกคน) · QTE ต่อสายไฟ (เห็นคู่หูเท่านั้น)
        striker: CHAR_HOOKS.striker.publicState(engine, p),
        ...(mine ? CHAR_HOOKS.striker.privateState(engine, p) : {}),
        pair: pair.pairPublic(p), // คู่หู 2 คนที่บังคับตัวละครนี้ (ชื่อ/บทบาท/พร้อม) — null = ตัวละครปกติ
        modeVote: p.modeVote || null,
        locked: p.locked,
        busted: (show || promoShow || connorReads || teamReveal) ? cardDeck.bustedOf(p) : false,
        result: p.result,
        // SE.RA.PH วันดวล: จำนวนไพ่ในมือของ "คู่ต่อสู้" เป็นความลับ — เห็นได้ต่อเมื่อ
        //  ลง Matrix ไว้บนเขาอย่างน้อย 1 แต้ม (นี่คือผลของ Matrix ระดับ 1 ตาม §6)
        //  ผู้ชมไม่โดนกฎนี้ เพราะสเปก §7 ให้ผู้ชมเห็นคู่ที่ลงสนามได้เต็ม ๆ
        cardCount: (Seraph.isDuelDay() && viewer && !mine && !viewer.scSpectator
          && Seraph.inCurrentDuel(viewer) && Seraph.matrixLevelOn(viewer, p) < 1)
          ? null : p.cards.length,
        cards: blackout ? null : (mine ? p.cards : null),
        // SE.RA.PH Matrix ระดับ 3: ผู้ชมที่ลงครบ 3 แต้มบนคนนี้ เห็นแต้มของเขาตลอดเวลา (§6)
        //  (ระดับ 1 "เห็นจำนวนไพ่" ใช้ cardCount ที่ส่งให้ทุกคนอยู่แล้ว — client เป็นคนเลือกโชว์ตามระดับ)
        score: blackout ? null : ((show || promoShow || connorReads || teamReveal
          || (Seraph.active() && viewer && Seraph.matrixLevelOn(viewer, p) >= 3)) ? cardDeck.scoreOf(p) : null),
        // Locacaca (ซาโตรุ): Max HP ลดถาวรได้ / ทาคุมิ: บังตาระหว่างท่าไม้ตายทำงาน (null = ซ่อนทั้งแถบ)
        // แบทแมนร่างรถแบทโมบิล: ส่ง 0/0 เพื่อให้ "ไม่มีพลังชีวิต เหลือแต่เกราะ" ตามสเปค
        //  (LifeBar วาดหัวใจตามจำนวน maxHp — 0 = ไม่มีหัวใจสักดวง แต่ยังไม่ใช่ null จึงไม่ขึ้น "???")
        //  ค่าจริงในเอนจินยังเต็มอยู่โดยตั้งใจ เพราะมีจุดกวาด `if (hp <= 0) instantDeath()` หลายที่
        //  ซึ่งจะฆ่าเขาทันทีทั้งที่รถยังไม่พัง — เกราะคือพลังชีวิตของรถตัวจริงอยู่แล้ว (ดู carAbsorb)
        // เกราะ Mark 42: แสดงพลังชีวิต 0/0 + เกราะชุด x/7 (ค่าจริงซ่อนอยู่ข้างใต้ คืนตอนถอด) — แบบเดียวกับรถแบทแมน
        hp: blackout ? null : (CHAR_HOOKS.bat_ben.inCar(p) || Mark42.suited(p) ? 0 : p.hp),
        maxHp: blackout ? null : (CHAR_HOOKS.bat_ben.inCar(p) || Mark42.suited(p) ? 0 : combat.maxHpOf(p)),
        armor: blackout ? null : (Mark42.suited(p) ? p.mark42.armor : p.armor),
        maxArmor: blackout ? null : (Mark42.suited(p) ? Mark42.SUIT_ARMOR : combat.maxArmorOf(p)),
        mark42: Mark42.publicState(engine, p), // ใส่ชุดอยู่ไหม / ของใคร (เห็นทุกคน)
        ...(mine ? Mark42.privateState(engine, p) : {}), // ชุดของเราที่ส่งออกไป / คูลดาวน์ซื้อ (เห็นเจ้าตัว)
        shield: blackout ? null : p.shield,
        tempHp: p.tempHp || 0, // เลือดชั่วคราว (แกมเบลอร์)
        // เอฟเฟครอบการ์ด (เห็นทุกคน): เขี้ยวปฏิปักษ์สีเขียว (ถาวร) / เกราะราชันสีแดง (ตอนสวม)
        beat: !!(p.seen && p.seen.beat),
        beatSaved: !!p.beatSaved,
        // ยูนะ: ออร่าเฉพาะเป้าหมาย (Longing สีทอง / Delete สีม่วง / Smile for You สีเขียว-ฟ้า) — beatbark ไม่มีเป้าหมายเดี่ยว ดู yunaFieldFx
        fieldAura: (p.id === match.yunaTargetId && match.roundNumber <= match.yunaWindowEnd) ? match.yunaEffect : null,
        hisakawa: p.characterId === "hisakawa_sister" ? CHAR_HOOKS.hisakawa_sister.publicState(p, match.roundNumber) : undefined,
        // ซาโตรุ (patch 2.0.8.2): แต้มสกิลถูกซ่อนจากผู้เล่นอื่นเสมอ (-1 = ซ่อน) / ทาคุมิ: บังตาแต้มสกิลของทุกคนยกเว้นตัวเองระหว่างท่าไม้ตายทำงาน (sentinel -1 แบบเดียวกัน กลับด้าน)
        // อิสึกะ ชิโด (patch 2.9): ระหว่าง "ฝากด้วยนะตัวฉัน" เปิดอยู่ คนอื่นเห็นแต้มสกิลเต็มหลอดเหมือนเดิม
        //  (ไม่งั้นแต้มที่หายไป 8 หน่วยจะเป็นเบาะแสว่าเขากดท่าไม้ตายไปแล้ว — ทั้งท่านี้ต้องไม่มีใครรู้)
        skillPoints: viewerBlind ? -1 : (takumiBlackout && !mine) ? -1 : ((p.characterId === "satoru" && !mine && !characterRules.passiveSealed(p)) ? -1
          : ((!mine && CHAR_HOOKS.shido.guardActive(p)) ? combat.maxSkillOf(p) : p.skillPoints)),
        // ตัวนับถอยหลังกับดักของชิโด — ส่งให้เจ้าของคนเดียว ไม่ใช่สถานะจึงไม่โผล่ตอน revealAll
        shidoGuard: mine && p.characterId === "shido" ? (p.shidoGuardTurns || 0) : undefined,
        // ความเสียหายล่าสุดที่ "ขอพลังให้ฉันด้วย" บันทึกไว้ (UI ป้ายเล็กบนแผงตัวเอง)
        shidoRecorded: mine && p.characterId === "shido" ? (p.shidoRecorded || 0) : undefined,
        // คูลดาวน์ห้ามกดท่าไม้ตายหลังย้อนเวลา (เทิร์นที่เหลือ) — ส่งให้เจ้าของคนเดียวเช่นกัน
        //  ใช้โชว์เป็นตัวเลขทับบนการ์ดสกิล คู่กับ shidoGuard (ตัวนับกับดักที่กำลังเปิดอยู่)
        shidoCd: mine && p.characterId === "shido"
          ? Math.max(0, (p.shidoRewindLock || 0) - match.roundNumber) : undefined,
        // เอจิ: คูลดาวน์ท่าไม้ตายหลัง "ไม่ว่ายังก็ตาม" หมดเวลา (เทิร์นที่เหลือ) — โชว์ทับบนการ์ดสกิล
        eijiUltCd: p.characterId === "eiji" ? CHAR_HOOKS.eiji.ultCooldownLeft(engine, p) : undefined,
        // QTE ที่กำลังเล่นอยู่ — ส่งให้ "เจ้าของคนเดียว" และส่งเฉพาะปุ่มตัวถัดไป
        //  (ส่งลำดับทั้งชุดไปให้ = เห็นล่วงหน้าทั้งเพลง หมดความหมายของ QTE)
        qte: mine && p.qte ? {
          key: p.qte.keys[p.qte.idx], idx: p.qte.idx, total: p.qte.keys.length,
          deadline: p.qte.deadline, perNoteMs: p.qte.perNoteMs,
        } : undefined,
        // ยุย: เพลงที่เลือกได้ + รายชื่อคนตายที่ชุบได้ (ทำเมนูฝั่ง client)
        yuiSongs: mine && p.characterId === "yui" ? CHAR_HOOKS.yui.songChoices(p) : undefined,
        yuiDead: mine && p.characterId === "yui"
          ? CHAR_HOOKS.yui.deadTargets(engine, p).map((o) => ({ id: o.id, name: o.name })) : undefined,
        maxSkill: combat.maxSkillOf(p), // Bard: เพดานพลังงาน 9
        gold: p.gold || 0, // ร้านค้ามายา (patch 2.2 full): เหรียญสะสม — ทุกคนเห็นของกันและกันได้
        goldMax: shop.goldCapOf(p), // เพดานเหรียญรายบุคคล (โคโตเนะ 45 จากกระปุกออมสินน้องหมูน้อย)
        inventory: mine ? (p.inventory || []) : null, // ของในคลัง — เห็นแค่ของตัวเอง
        gutsShotTurn: mine ? (p.gutsShotTurn || 0) : undefined, // ปืน GUTS Select: ยิงไปแล้วเทิร์นไหน (เทียบกับ roundNumber = ยิงครบโควตาแล้ว)
        blackSparklenceCooldown: mine ? Math.max(0, (p.blackSparklenceReadyRound || 0) - match.roundNumber) : undefined,
        hyperTriggerCooldown: mine ? Math.max(0, (p.hyperTriggerReadyRound || 0) - match.roundNumber) : undefined,
        doomWeapon: p.doomWeapon || null, // DoomGuy: อาวุธที่ถืออยู่
        doomCharge: p.characterId === "doomguy" ? (p.doomCharge || 0) : undefined, // DoomGuy: ชาร์จ Crucible (เต็ม 5)
        doomWeaponHasEffect: p.characterId === "doomguy" ? !!(DOOM_WEAPONS[p.doomWeapon] || DOOM_WEAPONS.shotgun).effect : undefined, // DoomGuy: ปืนกระบอกนี้กดใช้ความสามารถพิเศษได้ไหม (Plasma Rifle/BFG 9000 ไม่มี)
        doomQuickSwapUsed: p.characterId === "doomguy" ? !!p.doomQuickSwapUsed : undefined, // DoomGuy: Quick Swap ใช้ไปแล้วในเทิร์นนี้หรือยัง (1 ครั้ง/เทิร์น)
        doomWeaponMarkPending: p.characterId === "doomguy" ? characterRules.doomWeaponMarkPending() : undefined, // DoomGuy: [ระเบิด]/[ล็อคเป้า] ค้างอยู่ — สุ่มปืนใหม่ (Quick Swap) ไม่ได้จนกว่าจะโดนใช้
        // คาซามะ ไดสุเกะ: โหมด/Clock Up/ไรเดอร์ชูต/นับเทิร์น PUT ON (ข้อมูลสนาม ทุกคนเห็นได้)
        daisuke: p.characterId === "daisuke" ? CHAR_HOOKS.daisuke.publicState(p) : undefined,
        yaguruma: p.characterId === "yaguruma" ? CHAR_HOOKS.yaguruma.publicState(p) : undefined,
        kagami: p.characterId === "kagami" ? CHAR_HOOKS.kagami.publicState(p) : undefined,
        tsurugi: p.characterId === "tsurugi" ? CHAR_HOOKS.tsurugi.publicState(p) : undefined,
        appleItem: p.appleItem || "drink", // Apple guy: ของส่งมอบที่เลือกอยู่
        appleAtk: p.appleAtkBuffs ? p.appleAtkBuffs.length : 0, // Apple guy: บัฟพลังโจมตีจากการมอบของ (ซ้อนทับได้สูงสุด 2 หน่วย)
        appleGiveUses: p.appleGiveUses != null ? p.appleGiveUses : CHAR_HOOKS.appleguy.GIVE_USES, // Apple guy: จำนวนใช้ เอาไปสิ คงเหลือ
        muimiEmergencyUses: p.characterId === "muimi" ? (p.muimiEmergencyUses != null ? p.muimiEmergencyUses : CHAR_HOOKS.muimi.EMERGENCY_USES) : undefined,
        muimiEmergencyMax: p.characterId === "muimi" ? CHAR_HOOKS.muimi.EMERGENCY_USES : undefined,
        muimiEmergencyUsed: p.characterId === "muimi" ? p.muimiEmergencyUsedRound === match.roundNumber : undefined,
        muimiLoseStreak: p.characterId === "muimi" ? (p.muimiLoseStreak || 0) : undefined,
        muimiLoseStreakMax: p.characterId === "muimi" ? CHAR_HOOKS.muimi.HEART_LOSSES : undefined,
        muimiUltCd: mine && p.characterId === "muimi" ? CHAR_HOOKS.muimi.ultCooldownLeft(engine, p) : undefined,
        tepeuCookTurns: p.tepeuCookTurns || 0,     // เทเปา: วันนี้อากาศดีจัง — เทิร์นที่เหลือก่อนได้ "มื้อที่สุข" (0 = กดใช้ได้)
        tepeuPonderTurns: p.tepeuPonderTurns || 0, // เทเปา: เป็นแบบนี้นี่เอง — ครุ่นคิดเหลือกี่เทิร์น (0 = กดใช้ได้/จั่วไพ่ได้)
        // ---------- ฟุจิตะ โคโตเนะ (rework 2.3) ----------
        piggy: p.characterId === "kotone" ? (p.piggy || 0) : undefined,          // เงินในกระปุกออมสิน (สูงสุด 15)
        piggyMax: p.characterId === "kotone" ? CHAR_HOOKS.kotone.PIGGY_MAX : undefined,
        kotoneReady: p.characterId === "kotone" ? CHAR_HOOKS.kotone.readyStacks(p) : undefined, // [ความพร้อม] ที่สะสมอยู่
        kotoneReadyNeed: p.characterId === "kotone" ? CHAR_HOOKS.kotone.READY_NEED : undefined,
        kotoneReadyMax: p.characterId === "kotone" ? CHAR_HOOKS.kotone.READY_MAX : undefined,
        kotoneForm: p.characterId === "kotone" ? CHAR_HOOKS.kotone.formActive(p) : undefined,   // อยู่ในร่าง [พร้อมลุย] หรือไม่
        // ---------- เอจิ (patch 2.4 new): UI อัตราหลบหลีกปัจจุบัน (ไม่ใช่สถานะสะสม) ----------
        // อิปโป: อัตราหลบรวม · Dempsey Charge · คูลดาวน์รายสกิล (โชว์เป็นตัวเลขบนการ์ดสกิล)
        ippoDodge: p.characterId === "ippo" ? CHAR_HOOKS.ippo.dodgeChance(p) : undefined,
        ippoCharge: p.characterId === "ippo" ? CHAR_HOOKS.ippo.chargeOf(p) : undefined,
        ippoChargeMax: p.characterId === "ippo" ? CHAR_HOOKS.ippo.DEMPSEY_MAX : undefined,
        // ---------- ผู้วิงวอน (patch 3.4 new) ----------
        //  คำวิงวอนเป็นข้อมูลสาธารณะ (ทุกคนเห็น) เพราะขั้นของมันเปลี่ยนพฤติกรรมทั้งสนาม
        supPrayers: p.characterId === "the_supplicant" ? CHAR_HOOKS.the_supplicant.prayersOf(p) : undefined,
        supPrayersMax: p.characterId === "the_supplicant" ? CHAR_HOOKS.the_supplicant.PRAYER_MAX : undefined,
        supUltCd: mine && p.characterId === "the_supplicant" ? CHAR_HOOKS.the_supplicant.ultCooldownLeft(engine, p) : undefined,
        supSkillUses: p.characterId === "the_supplicant" ? (p.supSkillUsesRound || 0) : undefined,
        supSkillMax: p.characterId === "the_supplicant" ? CHAR_HOOKS.the_supplicant.SKILL_USES_PER_TURN : undefined,
        // เกราะศรัทธา/ตราพิพากษา ติดกับ "ใครก็ได้" ไม่ใช่แค่ผู้วิงวอน — ส่งให้ทุกคนเสมอ (0/false = ไม่มี)
        supFaith: CHAR_HOOKS.the_supplicant.faithOf(p) || undefined,
        supFaithMax: CHAR_HOOKS.the_supplicant.faithOf(p) ? CHAR_HOOKS.the_supplicant.FAITH_MAX : undefined,
        supJudge: CHAR_HOOKS.the_supplicant.judgeOn(p)
          ? { n: p.supJudgeCount || 0, need: CHAR_HOOKS.the_supplicant.JUDGE_NEED, ally: !!p.supJudgeAlly, gif: CHAR_HOOKS.the_supplicant.ULT_GIF } : undefined,
        // ---------- โปรดิวเซอร์ (luminous) (patch 3.6 new) ----------
        //  ไอดอลที่ยืนแนวหน้าและแต้ม "ไอดอล" เป็นข้อมูลสาธารณะ (ทุกคนต้องอ่านออกว่ากำลังเจอผลติดตัวอะไร
        //  และอีกกี่แต้มจะปลดล็อก luminous) ส่วนรายชื่อไอดอลให้เลือกส่งให้เจ้าของคนเดียว
        lumiIdol: p.characterId === "producer_lumi" ? CHAR_HOOKS.producer_lumi.idolKeyOf(p) : undefined,
        lumiIdolName: p.characterId === "producer_lumi" ? CHAR_HOOKS.producer_lumi.idolOf(p).name : undefined,
        lumiIdolPassive: p.characterId === "producer_lumi" ? CHAR_HOOKS.producer_lumi.idolOf(p).passive : undefined,
        lumiIdolDown: p.characterId === "producer_lumi" ? CHAR_HOOKS.producer_lumi.idolDown(p) : undefined,
        lumiPoints: p.characterId === "producer_lumi" ? (p.lumiPoints || 0) : undefined,
        lumiPointsMax: p.characterId === "producer_lumi" ? CHAR_HOOKS.producer_lumi.POINTS_NEED : undefined,
        // เลือดโปรดิวเซอร์ที่พักไว้ระหว่างไอดอลยังยืน — ไอดอลล้มแล้วค่านี้ไปอยู่ในหลอดหลักแทน จึงส่ง undefined
        lumiProducerHp: (p.characterId === "producer_lumi" && !CHAR_HOOKS.producer_lumi.idolDown(p) && !takumiBlackout)
          ? (p.lumiProducerHp || 0) : undefined,
        lumiProducerMax: p.characterId === "producer_lumi" ? CHAR_HOOKS.producer_lumi.PRODUCER_HP : undefined,
        lumiIdols: mine && p.characterId === "producer_lumi" ? CHAR_HOOKS.producer_lumi.publicIdols(p) : undefined,
        // ---------- ไบรอัน (GT-R34) (patch 3.5 new) ----------
        //  น้ำมันเป็นข้อมูลสาธารณะ (ทุกคนเห็น) เพราะเป็นตัวจับเวลาของร่างรถที่ทุกคนต้องอ่านออก
        brianFuel: p.characterId === "brian" ? CHAR_HOOKS.brian.fuelOf(p) : undefined,
        brianFuelMax: p.characterId === "brian" ? CHAR_HOOKS.brian.FUEL_MAX : undefined,
        brianCar: p.characterId === "brian" ? CHAR_HOOKS.brian.carOn(p) : undefined,
        brianBoost: p.characterId === "brian" ? CHAR_HOOKS.brian.boostOn(p) : undefined,
        // ช่องท่าไม้ตายตอนนี้เป็น N2O อยู่ไหม — client ใช้ตัดสินว่าต้องให้จิ้มเป้าหมายก่อนหรือไม่
        brianN2O: p.characterId === "brian" ? CHAR_HOOKS.brian.n2oSlot(engine, p) : undefined,
        brianFrozen: !!p.brianFrozen, // ถูกแช่เพราะอยู่นอกวงการแข่ง (บังคับไพ่แตก กดอะไรไม่ได้)
        ippoCd: p.characterId === "ippo" ? {
          basic: CHAR_HOOKS.ippo.cooldownLeft(engine, p, "basic"),
          secondary: CHAR_HOOKS.ippo.cooldownLeft(engine, p, "secondary"),
          ultimate: CHAR_HOOKS.ippo.cooldownLeft(engine, p, "ultimate"),
        } : undefined,
        // คาเยนน์: กระสุน / แรงใจ / เกพาร์ด / ชุดกระสุนที่บรรจุไว้ / ความเสียหายที่เลื่อนไว้ (ข้อมูลสนาม ทุกคนเห็นได้)
        cayenne: p.characterId === "cayenne" ? CHAR_HOOKS.cayenne.publicState(p) : undefined,
        // ไดจิ: การ์ดที่ถือ / เกราะที่สวม / โควตาการ์ดไซเบอร์ / การ์ดที่ตัดเก็บไว้ (ข้อมูลสนาม ทุกคนเห็นได้)
        daichi: p.characterId === "daichi" ? CHAR_HOOKS.daichi.publicState(p) : undefined,
        // เท็นโนจิ โคทาโร่: โหมดสับราง / อาวุธที่หลอม / พลังโจมตีถาวร / อัตราหลบ / หนี้เลือด (ข้อมูลสนาม ทุกคนเห็นได้)
        eijiDodge: p.characterId === "eiji" ? CHAR_HOOKS.eiji.dodgeChance(p) : undefined,        // % หลบหลีกรวมของเทิร์นนี้
        eijiOrdinal: p.characterId === "eiji" ? CHAR_HOOKS.eiji.ordinalStacks(p) : undefined,    // สแตค Ordinal Scale ที่กดไปแล้ว
        eijiOrdinalMax: p.characterId === "eiji" ? CHAR_HOOKS.eiji.ORDINAL_MAX : undefined,
        eijiDodgeUsed: p.characterId === "eiji" ? !!p.eijiDodgeUsedRound : undefined,            // ใช้โควตาหลบของเทิร์นนี้ไปแล้วหรือยัง
        // ---------- มิซึซาว่า ฮารุกะ (patch 2.5 new): โควตาสกิลพื้นฐาน 2 ครั้ง/เทิร์น (UI ใช้ปิดปุ่มเมื่อครบ) ----------
        // ---------- อาจารย์ ไบเลธ (patch 2.6 new): UI แต้มความรู้ + สถานะหลักสูตร (ทุกคนเห็นได้ เพราะหลักสูตรมีผลทั้งสนาม) ----------
        // ---------- คอนเนอร์ RK800 (patch 2.7 new) ----------
        //  มิเตอร์ความเครียดเป็นข้อมูลสาธารณะ (ทุกคนเห็นของกันและกัน) และโผล่เฉพาะตอนมีคอนเนอร์อยู่ในแมตช์
        connorStress: (connorInMatch && p.characterId !== "conner") ? CHAR_HOOKS.conner.stressOf(p) : undefined,
        connorStressMax: (connorInMatch && p.characterId !== "conner") ? CHAR_HOOKS.conner.STRESS_MAX : undefined,
        connorLevel: (connorInMatch && p.characterId !== "conner") ? CHAR_HOOKS.conner.levelKeyOf(p) : undefined,
        connorFrozen: !!p.connorFrozen, // ถูกแช่เพราะอยู่นอกวงไล่ล่า (บังคับไพ่แตก กดอะไรไม่ได้)
        connorRevives: p.characterId === "conner" ? (p.connorRevives || 0) : undefined,        // ใช้ฟื้นคืนชีพไปแล้วกี่ครั้ง
        connorRevivesMax: p.characterId === "conner" ? CHAR_HOOKS.conner.REVIVE_MAX : undefined,
        // โมโรโบชิ ดัน (patch 2.8): ช่องท่าไม้ตายตอนนี้เป็น "อย่าให้ฉันต้องเฆี่ยนตี" อยู่หรือเปล่า
        //  client ใช้ตัดสินว่าต้องให้จิ้มเป้าหมายก่อนไหม (ท่า 2 เล็งเป้าเดิมอัตโนมัติ) — อย่าเดาจากชื่อ/ราคาสกิล
        danWhip: p.characterId === "dan" ? CHAR_HOOKS.dan.whipReady(engine, p) : undefined,
        connorReviveIn: p.characterId === "conner" && !p.alive && p.connorReviveRound
          ? Math.max(0, p.connorReviveRound - match.roundNumber) : undefined,                         // เหลือกี่เทิร์นก่อนกลับมา
        // ลำดับการกระทำ "เทิร์นที่แล้ว" ของผู้เล่นคนนี้ — ส่งให้เจ้าตัวเท่านั้น (คอนเนอร์ต้องทายเอง ห้ามเห็น)
        connorActionsPrev: mine ? CHAR_HOOKS.conner.actionsPrevOf(p) : undefined,
        // ประเมินความเสียหายที่ผู้เล่นคนนี้จะฟาดใส่คอนเนอร์ได้ — เห็นเฉพาะคอนเนอร์ที่กำลังวิเคราะห์สถานการณ์
        connorScanned: connorReads ? true : undefined, // แต้มของคนนี้ถูกเปิดให้เราเห็นจาก "วิเคราะห์สถานการณ์"
        harukaBasicUses: p.characterId === "haruka" ? (p.harukaBasicUses || 0) : undefined,
        harukaBasicMax: p.characterId === "haruka" ? CHAR_HOOKS.haruka.BASIC_USES_PER_TURN : undefined,
        bardNotes: p.bardNotes || [],      // Bard: โน้ตในช่องประพันธ์เพลง (ทุกคนเห็นได้)
        bardNotesUsed: p.bardNotesUsed || 0, // Bard: โน้ตที่เติมไปแล้วเทิร์นนี้ (จำกัด 2)
        bloodSection: p.bloodSection || 0, // Bard: ท่อนทำนองแห่งโลหิต (ครบ 5 = มิติโลหิต)
        soulSection: p.soulSection || 0,   // Bard: ท่อนทำนองแห่งวิญญาณ (ครบ 5 = มิติวิญญาณ)
        bardPending: p.bardPending ? { name: p.bardPending.name, need: p.bardPending.need, allowSelf: p.bardPending.allowSelf } : null, // Bard: บทเพลงรอเลือกเป้าหมาย
        // ไค ชิซากิ: สรุป Overhaul tracker (ชื่อผู้ถือ+ประเภทสถานะ) — เฉพาะผู้เล่นไคเท่านั้น (ตัวอื่นเห็น undefined)
        kaiOverhaulSlots: p.characterId === "kai" ? match.kaiOverhaulSlots.filter((s) => s.ownerId === p.id).map((s) => ({ playerId: s.playerId, name: (match.players[s.playerId] && match.players[s.playerId].name) || "", status: s.status, img: match.players[s.playerId] ? displayImg(match.players[s.playerId]) : null })) : undefined,
        mageslayerHasMarked: p.characterId === "mageslayer" ? !!p.mageslayerHasMarked : undefined, // ผู้สังหารเมจ: เคยใช้ Witch Mark หรือยัง
        mageslayerWitchMarkCooldown: p.characterId === "mageslayer" ? Math.max(0, (p.mageslayerWitchMarkReadyRound || 0) - match.roundNumber) : undefined,
        mageslayerBurdenCooldown: p.characterId === "mageslayer" ? Math.max(0, (p.mageslayerBurdenReadyRound || 0) - match.roundNumber) : undefined, // Mana Burden: คูลดาวน์ 7 เทิร์น
        escanorCharge: p.characterId === "escanor" ? (p.escanorCharge || 0) : undefined,
        escanorChargeMax: p.characterId === "escanor" ? CHAR_HOOKS.escanor.ESCANOR_CHARGE_MAX : undefined,
        escanorForm: p.characterId === "escanor" ? CHAR_HOOKS.escanor.formOf(p) : undefined,
        kaiRivalId: mine ? (p.kaiRivalId || null) : undefined, // ไค ชิซากิ: คู่ปรับที่ถูกบังคับโจมตี (เห็นแค่ตัวเอง — ฝั่งอื่นเช็คจาก statuses.kaiRival1/2 ได้)
        kaiSkillUsesRound: p.characterId === "kai" ? (p.kaiSkillUsesRound || 0) : undefined, // ไค: งบสกิล 2 ครั้งต่อเทิร์น ใช้ไปแล้วกี่ครั้ง
        takumiGear: p.characterId === "takumi" ? (p.takumiGear || 1) : undefined, // ทาคุมิ: เกียร์ธรรมดาปัจจุบัน (1-6)
        takumiSkillUsesRound: p.characterId === "takumi" ? (p.takumiSkillUsesRound || 0) : undefined, // ทาคุมิ: งบสกิล 5 ครั้งต่อเทิร์น ใช้ไปแล้วกี่ครั้ง
        shikiUlt: p.shikiUlt || "deatheye", // ชิกิ: ท่าไม้ตายที่เลือกตอนเข้าห้อง (deatheye | wither)
        stamina: p.stamina || 0,           // โอกูริ แคป: Stamina ชาร์จสะสม (ทรัพยากรท่าไม้ตาย)
        oguriEnergy: p.oguriEnergy || 0,   // โอกูริ แคป: Energy สะสม (สูงสุด 16 — ทรัพยากร Breakfast/Training)
        oguriChargeCap: p.characterId === "oguri" ? characterRules.oguriChargeCapOf(p) : undefined, // โอกูริ แคป: ความจุ Stamina ชาร์จปัจจุบัน
        chillDodge: p.chillDodge != null ? p.chillDodge : 100, // Apple guy: อัตราหลบปัจจุบัน (%)
        tonkatsu: p.tonkatsu || 0, // เทมาริ: ชามทงคัสสึสะสม (UI สะสมชาม)
        phenexPain: p.phenexPain || 0, // ริต้า เบอร์นัล: ความเจ็บปวดสะสม (ไม่อยากให้ใครต้องเจ็บปวด — ปลดปล่อยตอนตกรอบจริง)
        nanayaEyeOn: !!p.nanayaEyeOn,           // นานายะ ชิกิ: Mystic eye of death perception เปิดอยู่ไหม
        nanayaToggleUsed: !!p.nanayaToggleUsed, // นานายะ ชิกิ: เปิด/ปิดไปแล้วในเทิร์นนี้หรือยัง
        atCap: cardDeck.scoreOf(p) >= cardDeck.scoreCap(p), // แต้มเต็มเพดาน (21/UPG) -> ปิดปุ่มจั่ว รอเปิดไพ่เอง
        skillUsed: !!p.skillUsedRound,    // ใช้สกิลไปแล้วในเทิร์นนี้ (1 อันต่อเทิร์น)
        ready: !!p.ready,                 // ห้องรอ: กดพร้อมแล้วหรือยัง
        connected: p.connected !== false,
        alive: p.alive,
        statuses: show ? { ...p.statuses } : publicStatuses(p),
        statusAmt: p.statusAmt || {}, // จำนวน (amount) ของบัฟ/ดีบัฟพื้นฐาน (patch 2.0.8)
        character: scHidden ? { id: null, img: null, name: "???", passive: null, passive2: null, passive3: null, basic: null, secondary: null, ultimate: null } : {
          // โอเบรอน: กลางคืนสลับชื่อ + สกิลรอง/ท่าไม้ตายเป็นเวอร์ชันกลางคืน (ฝันร้ายยามค่ำคืน / Lie Like Vortigern)
          id: ch.id,
          // ภาพประจำตัวละคร (ไม่ผูกกับร่าง/แฝดที่กำลังคุมอยู่) — ฉากเปิดตัวตอนแมตช์เริ่มใช้ภาพนี้
          img: ch.img,
          name: nightNow && ch.nightName ? ch.nightName : ch.name,
          passive: ch.passive ? { name: ch.passive.name, desc: ch.passive.desc } : null,
          // บานาจ ลิงก์ (patch 2.1.2): สกิลติดตัว 2 ฉันไม่อยากให้เราต้องมาสู้กัน — ตัวอื่นเป็น null
          passive2: ch.passive2 ? { name: ch.passive2.name, desc: ch.passive2.desc } : null,
          // นานายะ ชิกิ (patch 2.1.9): สกิลติดตัว 3 พักผ่อนสักครู่ — ตัวอื่นเป็น null
          passive3: ch.passive3 ? { name: ch.passive3.name, desc: ch.passive3.desc } : null,
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
  CHAR_HOOKS.usagi.syncPause(engine); // อุซากิ: โจทย์คณิตหยุดนับเวลาระหว่างที่ไม่ได้อยู่เฟสจั่วไพ่ (คัตซีนคั่น)
  CHAR_HOOKS.recruit.syncPause(engine); // Recruit: QTE หยุดนับเวลาระหว่างคัตซีนคั่น
  CHAR_HOOKS.kai.pruneOverhaulSlots(engine); // เผื่อสถานะรังสรรค์/ลงทัณฑ์หายไปนอกช่องทาง Overhaul (เช่นถูกล้าง)
  for (const id of Object.keys(match.players)) io.to(id).emit("state", buildStateFor(id));
}
function broadcastPositions() {
  const taken = takenUniqueChars();
  for (const [sid, sock] of io.sockets.sockets) {
    sock.emit("positions", lobby.positionsFor(sid));
    sock.emit("takenChars", taken);
    sock.emit("pairSlots", pair.openPairSlots()); // สไตรเกอร์ ยูเรก้า: ตัวละครคู่ที่ยังรอคู่หู
  }
}
// ตัวละคร unique ที่มีคนเลือกไปแล้วในแมตช์นี้ (หน้าเลือกตัวละครใช้ปิดการ์ดไม่ให้เลือกซ้ำ)
function takenUniqueChars() {
  return [...new Set(
    Object.values(match.players)
      .filter((p) => (CHAR_BY_ID[p.characterId] || {}).unique)
      .map((p) => p.characterId)
  )];
}
