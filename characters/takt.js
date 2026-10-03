// ============================================================
//  อาซาฮินะ ทักต์ — พิเศษ · เลือกได้คนเดียวต่อเกม
//
//  ระบบพันธะสัญญา (สกิลติดตัว คอนดักเตอร์) — ของกลางของ "มิวสิคคาร์ท" ทุกตัว (MUSIC_CARTS)
//    ปุ่มแยก (socket taktInvite) ไม่เสียแต้ม ไม่นับเป็นการใช้สกิล — ส่งคำเชิญให้มิวสิคคาร์ท 1 คน
//    ฝั่งนั้นตอบรับ/ปฏิเสธ (socket taktInviteAnswer · ไม่ตอบก่อนเปิดไพ่ = ปฏิเสธ)
//    รับแล้วเล่น takt_ac.mp4 ทุกครั้ง · ผูกได้พร้อมกันสูงสุด 2 คน · หลุดเมื่อฝ่ายใดฝ่ายหนึ่งตาย (ช่องว่างเชิญใหม่ได้)
//    ปฏิเสธแล้วเชิญคนเดิมซ้ำได้เทิร์นถัดไป · โหมดทีมผูกได้เฉพาะเพื่อนร่วมทีม
//    โหมดอิสระ: ทักต์ + มิวสิคคาร์ทที่ผูกกันเป็นพวกเดียวกัน (sameTeam/isAlly) — เหลือกันเองครบ = ชนะพร้อมกัน
//    ผูกพันธะอยู่อย่างน้อย 1 คน: ทักต์หลบการโจมตีปกติ 35% (ไม่ขึ้นแจ้งเตือน)
//  สกิลติดตัว 2 ตระกูลอาซาฮินะ: พลังชีวิต 5 ไม่มีเกราะ · ไม่รับดาเมจจากการแพ้รอบ (แต้มน้อยสุด/ไพ่แตก —
//    ผลสกิลที่เกาะกับคนไพ่แตกยังโดน) · เทิร์นที่ 3, 6, 9, … ฟื้นพลังชีวิต 2
//    หลบหลีกติดตัว 15% ทั้งโจมตีปกติ (tryAttackDodge) และดาเมจจากสกิล (adjustIncomingDamage) — หลบปืน (ไอเทม)
//    และดาเมจจากสถานะไม่ได้ · มีพันธะ: การโจมตีปกติใช้ 35% แทน (เอาค่าสูงสุด ไม่บวกกัน) · "แม่นยำ" เจาะได้
//
//  สกิลพื้นฐาน เสียงอันไพเราะ (2 · คูลดาวน์ 3) — เลือกใครก็ได้ 1 คน (ตัวเองได้)
//    โชคลาภ +1 · ฟื้นพลังชีวิต 1 · เกราะ +1 — ให้ตัวเองฟื้นพลังชีวิต 2 · ให้มิวสิคคาร์ทในพันธะได้โชคลาภ 2
//  สกิลรอง บรรเลงเสียงสวรรค์ (0 · ไม่นับเป็นการใช้สกิล · มิวสิคคาร์ทละ 1 ครั้ง/เทิร์น)
//    เลือกมิวสิคคาร์ทในพันธะที่มี "บทเพลงที่ไม่อาจลืม" อยู่ แล้วเลือกโหมด (item):
//    low ทุ้มต่ำ (ค่าเริ่มต้น) ได้รับความเสียหาย -1 (ไม่นับดาเมจจากสถานะ) + หลบการโจมตีปกติ 5%
//    gentle อ่อนโยน ตีปกติโดนแล้วฟื้นพลังชีวิต 2 · fierce แข็งกร้าว ตีปกติคริติคอล 20% (×2)
//  ท่าไม้ตาย ปลดปล่อยเสียงดนตรี (4) — เลือกมิวสิคคาร์ทในพันธะที่ยังไม่มีบทเพลง
//    มอบ "บทเพลงที่ไม่อาจลืม" (taktSong) 5 เทิร์น: พลังโจมตี +1 + ผลตามโหมด + ปลดล็อกความสามารถของมิวสิคคาร์ท
//    วีดีโอของมิวสิคคาร์ทแต่ละตัว (takt/<id>/takt_<id>.mp4) เต็มครั้งแรก ครั้งต่อไปขึ้นการ์ดแจ้งเตือน
//    ความสามารถที่ปลดล็อกเป็นของตัวมิวสิคคาร์ทเอง (เช่น characters/titan.js อ่าน songActive)
//
//  สกิลติดตัว 3 เปิดม่าน: ผูกพันธะกับมิวสิคคาร์ท 2 คน "ไม่ซ้ำแบบ" (ไททัน + คอเซ็ตต์) -> takt_passive3.mp4 (ครั้งแรกต่อเกม)
//    ปุ่มพันธะเปลี่ยนเป็นปุ่มบรรเลง (socket taktPerform · ไม่เสียแต้ม · ไม่นับเป็นการใช้สกิล · คำสั่งละคูลดาวน์ 5)
//    สั่งไททัน: ล่อเป้าทั้งโจมตีปกติและสกิลที่เล็งศัตรูไปที่ไททันจนจบเทิร์น (titan.titanTauntRound)
//    สั่งเดสตินี่: คอเซ็ตต์ทำดาเมจสกิล 2 ใส่เป้าที่เลือก (วีดีโอก่อน) · ทักต์และคู่พันธะที่ถูกสั่งต้องไม่ติดสตั้น
//  บทเพลงพัง: ทักต์เลือดเหลือ 1 หรือตาย -> มิวสิคคาร์ททุกคนที่มีบทเพลงเสียบทเพลง + สตั้น 2 (ต้านไม่ได้)
//    (checkLowRevert ที่ flushOrtCounters / ต้นเทิร์น / onDeath) · ผลเฉพาะตัวผ่าน onSongLost ของมิวสิคคาร์ท
//  สถานะของพันธะอยู่บนตัวผู้เล่นทั้งหมด (ย้อนได้ผ่านสแนปช็อต Overload Force/ชิโด):
//    ทักต์: taktBonds (id ของมิวสิคคาร์ท) · taktBasicReady (เลขรอบ)
//    มิวสิคคาร์ท: taktBondBy · taktInvite { fromId } · taktDeclinedRound · taktSongMode · taktModeRound
//    บทเพลง = p.statuses.taktSong (นับเทิร์นปกติ) — ไม่อยู่ใน BUFF_KEYS (เป็นร่างของมิวสิคคาร์ท ปาดทิ้งไม่ได้)
// ============================================================

const ID = "takt";
const DIR = "/characters/takt";
const IMG = {
  base: `${DIR}/takt_normal.jpg`,
  bonded: `${DIR}/takt_with.jpg`,
  skill1: `${DIR}/takt_skill1.jpg`,
  skill2: `${DIR}/takt_skill2.jpg`,
  skill3: `${DIR}/takt_skill3.avif`,
};
const VIDEO = {
  accept: `${DIR}/takt_ac.mp4`,
  curtain: `${DIR}/takt_passive3.mp4`,
  cmdTitan: `${DIR}/takt_passive3-titan.mp4`,
  cmdDestiny: `${DIR}/takt_passive3-destiny.mp4`,
};

// ตัวละครที่มีสกิลติดตัว "มิวสิคคาร์ท" -> คีย์คัตซีนตอนได้บทเพลง (characters/_transforms.js)
const MUSIC_CARTS = { titan: { songKey: "taktSongTitan" }, cosette: { songKey: "taktSongCosette" } };

const MAX_BONDS = 2;
const TAKT_HP = 5;
const TAKT_ARMOR = 0;
const BOND_DODGE = 35;
const INNATE_DODGE = 15;
const REGEN_EVERY = 3;
const REGEN_HP = 2;
const BASIC_COOLDOWN = 3;
const BASIC_FORTUNE = 1;
const BASIC_FORTUNE_CART = 2;
const BASIC_HEAL = 1;
const BASIC_HEAL_SELF = 2;
const BASIC_ARMOR = 1;
const SONG_TURNS = 5;
const SONG_ATK = 1;
const MODES = {
  low: { label: "ทุ้มต่ำ", reduce: 1, dodge: 5 },
  gentle: { label: "อ่อนโยน", heal: 2 },
  fierce: { label: "แข็งกร้าว", crit: 20 },
};
const DEFAULT_MODE = "low";
const PERFORM_COOLDOWN = 5;
const PERFORM_DMG = 2;
const LOW_STUN = 2;
const CURTAIN_TYPES = ["titan", "cosette"]; // เปิดม่าน: ต้องมีมิวสิคคาร์ทครบทั้งสองแบบ

const isTakt = (p) => !!p && p.characterId === ID;
const isMusicCart = (p) => !!p && !!MUSIC_CARTS[p.characterId];
const alive = (p) => !!p && p.alive;

function taktOf(engine, cart) {
  if (!cart || !cart.taktBondBy) return null;
  const t = engine.players[cart.taktBondBy];
  return isTakt(t) && (t.taktBonds || []).includes(cart.id) ? t : null;
}
function bondedCarts(engine, takt) {
  if (!isTakt(takt)) return [];
  return (takt.taktBonds || []).map((id) => engine.players[id]).filter((c) => c && c.taktBondBy === takt.id);
}
// กลุ่มพันธะที่ p อยู่ (ทักต์ + มิวสิคคาร์ททุกคนที่ผูกอยู่) — ไม่ได้อยู่ในพันธะ = null
function groupOf(engine, p) {
  const takt = isTakt(p) ? p : taktOf(engine, p);
  if (!takt) return null;
  const carts = bondedCarts(engine, takt);
  return carts.length ? [takt, ...carts] : null;
}
function songActive(p) { return !!p && ((p.statuses && p.statuses.taktSong) || 0) > 0; }
function modeOf(p) { return MODES[p && p.taktSongMode] ? p.taktSongMode : DEFAULT_MODE; }
function cartLabel(engine, p) { return engine.CHAR_BY_ID[p.characterId] ? engine.CHAR_BY_ID[p.characterId].name : p.name; }

// มิวสิคคาร์ทคนนี้เชิญได้ไหม (เหตุผล = null คือได้)
function inviteBlock(engine, takt, cart) {
  if (!alive(takt) || !isTakt(takt)) return "ไม่ใช่คอนดักเตอร์";
  if (!cart || !alive(cart) || engine.isOrt(cart)) return "เป้าหมายไม่ถูกต้อง";
  if (!isMusicCart(cart)) return "ไม่ใช่มิวสิคคาร์ท";
  if (cart.taktBondBy) return "มีพันธะอยู่แล้ว";
  if (cart.taktInvite) return "รอคำตอบอยู่";
  if (bondedCarts(engine, takt).length >= MAX_BONDS) return "พันธะเต็มแล้ว";
  if (cart.taktDeclinedRound === engine.roundNumber) return "ปฏิเสธไปแล้วเทิร์นนี้";
  if (engine.teamModeActive() && !engine.isAlly(takt, cart)) return "ต่างทีม";
  return null;
}
// เปิดม่าน: พันธะครบ 2 คนและไม่ซ้ำแบบ (ไททัน 1 + คอเซ็ตต์ 1)
function curtainActive(engine, takt) {
  const types = bondedCarts(engine, takt).filter(alive).map((c) => c.characterId);
  return CURTAIN_TYPES.every((t) => types.includes(t));
}
function cartOfType(engine, takt, type) {
  return bondedCarts(engine, takt).find((c) => alive(c) && c.characterId === type) || null;
}
function performBlock(engine, takt, cmd) {
  if (!curtainActive(engine, takt)) return "ยังไม่เปิดม่าน";
  if ((takt.statuses.stun || 0) > 0) return "คอนดักเตอร์ติดสตั้น";
  const cart = cartOfType(engine, takt, cmd === "titan" ? "titan" : "cosette");
  if (!cart) return "ไม่มีคู่พันธะ";
  const ready = (takt.taktPerformReady || {})[cmd] || 0;
  if (engine.roundNumber < ready) return `อีก ${ready - engine.roundNumber} เทิร์น`;
  if ((cart.statuses.stun || 0) > 0) return "ติดสตั้น";
  return null;
}
// เพลง takt_theme: เล่นตลอดที่มีมิวสิคคาร์ทคนใดคนหนึ่งมีบทเพลง — ได้บทเพลงเพิ่มอีกคนไม่เริ่มเพลงใหม่
//  (ค่า at ล็อกไว้ตั้งแต่คนแรก) จนกว่าบทเพลงจะดับหมดทุกคน แล้วรอบหน้าค่อยนับใหม่
let musicAt = null;
function unbond(engine, takt, cart) {
  if (takt) takt.taktBonds = (takt.taktBonds || []).filter((id) => !cart || id !== cart.id);
  if (cart) cart.taktBondBy = null;
}

module.exports = {
  id: ID,
  IMG, VIDEO, MUSIC_CARTS, MODES, MAX_BONDS, TAKT_HP, TAKT_ARMOR, BOND_DODGE, INNATE_DODGE, REGEN_EVERY, REGEN_HP,
  BASIC_COOLDOWN, SONG_TURNS, SONG_ATK, PERFORM_COOLDOWN, PERFORM_DMG, LOW_STUN,
  isTakt, isMusicCart, taktOf, groupOf, songActive, modeOf, curtainActive, bondedCarts,

  maxHp() { return TAKT_HP; },
  maxArmor() { return TAKT_ARMOR; },

  resetCombat(p) {
    p.taktBonds = [];          // ทักต์: id ของมิวสิคคาร์ทที่ผูกพันธะอยู่ (สูงสุด 2)
    p.taktBasicReady = 0;      // ทักต์: เสียงอันไพเราะกดได้อีกเมื่อ roundNumber >= ค่านี้
    p.taktBondBy = null;       // มิวสิคคาร์ท: id ของทักต์ที่ผูกพันธะด้วย
    p.taktInvite = null;       // มิวสิคคาร์ท: คำเชิญที่ยังไม่ตอบ { fromId }
    p.taktDeclinedRound = 0;   // มิวสิคคาร์ท: เทิร์นที่ปฏิเสธ (เชิญซ้ำได้เทิร์นถัดไป)
    p.taktSongMode = DEFAULT_MODE; // มิวสิคคาร์ท: โหมดของบทเพลง
    p.taktModeRound = 0;       // มิวสิคคาร์ท: เทิร์นที่ถูกสลับโหมดล่าสุด (1 ครั้ง/เทิร์น)
    p.taktPerformReady = { titan: 0, destiny: 0 }; // ทักต์ (เปิดม่าน): คำสั่งบรรเลงกดได้อีกเมื่อ roundNumber >= ค่านี้
  },

  // ---------- เพลงประจำบทเพลง (view.activeSkillMusic) ----------
  activeMusic(engine) {
    const on = Object.values(engine.players).filter((p) => alive(p) && isMusicCart(p) && songActive(p));
    if (!on.length) { musicAt = null; return null; }
    if (musicAt == null) musicAt = Math.max(...on.map((p) => p.transformAt || 0));
    return { music: "takt_theme", at: musicAt };
  },

  // ---------- พวกเดียวกัน (โหมดอิสระ) ----------
  bonded(engine, a, b) {
    if (!a || !b || a.id === b.id) return false;
    const g = groupOf(engine, a);
    return !!g && g.some((x) => x.id === b.id);
  },
  // คนที่ยังรอดทั้งหมดอยู่ในพันธะเดียวกัน (2 คนขึ้นไป) = ชนะพร้อมกัน
  bondGroupWins(engine, stillAlive) {
    if (!stillAlive || stillAlive.length < 2) return false;
    const g = groupOf(engine, stillAlive[0]);
    return !!g && stillAlive.every((p) => g.some((x) => x.id === p.id));
  },

  // ---------- คำเชิญ ----------
  invite(engine, takt, targetId) {
    if (engine.gameState !== "PLAYING") return false;
    const cart = engine.players[targetId];
    if (inviteBlock(engine, takt, cart)) return false;
    cart.taktInvite = { fromId: takt.id };
    engine.log(`🎼 ${takt.name} ส่งคำเชิญทำพันธะสัญญาให้ ${cart.name}`);
    engine.skillFlash({ name: `คอนดักเตอร์ — เชิญ ${cart.name} ทำพันธะสัญญา`, img: IMG.base, by: takt.name, color: engine.colorOf(takt) });
    return true;
  },
  // คืน true = ตอบรับ (ผู้เรียกเล่นวีดีโอที่คิวไว้)
  answerInvite(engine, cart, accept) {
    const inv = cart && cart.taktInvite;
    if (!inv) return false;
    cart.taktInvite = null;
    const takt = engine.players[inv.fromId];
    if (!accept || !alive(cart) || !alive(takt) || cart.taktBondBy || bondedCarts(engine, takt).length >= MAX_BONDS) {
      if (alive(takt)) {
        cart.taktDeclinedRound = engine.roundNumber;
        engine.log(`🎼 ${cart.name} ปฏิเสธพันธะสัญญาของ ${takt.name}`);
        engine.skillFlash({ name: `${cart.name} ปฏิเสธพันธะสัญญา`, img: IMG.base, by: takt.name, color: engine.colorOf(takt) });
      }
      return false;
    }
    takt.taktBonds = [...(takt.taktBonds || []), cart.id];
    cart.taktBondBy = takt.id;
    cart.taktSongMode = cart.taktSongMode || DEFAULT_MODE;
    engine.log(`🎼 ${cart.name} ตอบรับพันธะสัญญากับ ${takt.name} — ผูกพันธะแล้ว ${takt.taktBonds.length}/${MAX_BONDS}`);
    engine.queueCutscene(takt, "taktAccept");
    if (curtainActive(engine, takt)) {
      engine.triggerCutscene(takt, "taktCurtain"); // เปิดม่าน: เต็มครั้งแรกต่อเกม
      engine.log(`🎭 ${takt.name} เปิดม่าน — มิวสิคคาร์ทครบทั้งสองแบบ ปุ่มพันธะเปลี่ยนเป็นปุ่มบรรเลง`);
    }
    return true;
  },

  // ---------- เปิดม่าน: คำสั่งบรรเลง ----------
  //  คืน null = สั่งไม่ได้ · { after } = ผลที่ต้องลงหลังวีดีโอ (ผู้เรียกส่งเข้า pausePlayingForCutscene)
  perform(engine, takt, cmd, targetId) {
    if (!alive(takt) || !isTakt(takt) || (cmd !== "titan" && cmd !== "destiny") || performBlock(engine, takt, cmd)) return null;
    if (cmd === "titan") {
      const titan = cartOfType(engine, takt, "titan");
      takt.taktPerformReady = { ...(takt.taktPerformReady || {}), titan: engine.roundNumber + PERFORM_COOLDOWN };
      titan.titanTauntRound = engine.roundNumber;
      engine.triggerCutscene(takt, "taktCmdTitan");
      engine.log(`🎭 ${takt.name} บรรเลง — สั่ง ${titan.name} ล่อเป้าศัตรูทุกคนจนจบเทิร์นนี้`);
      engine.skillFlash({ name: `บรรเลง — ${titan.name} ล่อเป้า`, img: IMG.skill2, by: takt.name, color: engine.colorOf(takt) });
      return { after: null };
    }
    const cos = cartOfType(engine, takt, "cosette");
    const t = engine.attackableTargets(cos.id).find((o) => o.id === targetId);
    if (!t) return null;
    takt.taktPerformReady = { ...(takt.taktPerformReady || {}), destiny: engine.roundNumber + PERFORM_COOLDOWN };
    engine.triggerCutscene(takt, "taktCmdDestiny");
    engine.log(`🎭 ${takt.name} บรรเลง — สั่ง ${cos.name} โจมตี ${t.name}`);
    engine.skillFlash({ name: `บรรเลง — ${cos.name} โจมตี ${t.name}`, img: IMG.skill2, by: takt.name, color: engine.colorOf(takt) });
    return {
      after: () => {
        if (!cos.alive || !t.alive) return;
        engine.withEffectSource(cos, () => {
          engine.dealMixed(t, PERFORM_DMG);
          t.wasAttacked = true;
          engine.resolveDamageAftermath(t);
        });
        engine.log(`🗡️ ${cos.name} โจมตีตามคำสั่ง — ${t.name} -${PERFORM_DMG}${t.alive ? "" : " — ตกรอบ!"}`);
      },
    };
  },

  // ---------- บทเพลงพัง: ทักต์เลือดเหลือ 1 หรือตาย ----------
  revertCarts(engine, takt) {
    let n = 0;
    for (const c of bondedCarts(engine, takt)) {
      if (!alive(c) || !songActive(c)) continue;
      delete c.statuses.taktSong;
      c.statuses.stun = Math.max(c.statuses.stun || 0, LOW_STUN);
      const hook = engine.CHAR_HOOKS[c.characterId];
      if (hook && hook.onSongLost) hook.onSongLost(engine, c);
      engine.log(`💔 ${takt.name} ${takt.alive ? "พลังชีวิตเหลือ 1" : "ตกรอบ"} — บทเพลงของ ${c.name} ขาดหาย คืนร่างเดิม และติดสตั้น ${LOW_STUN} เทิร์น`);
      n++;
    }
    return n;
  },
  checkLowRevert(engine) {
    let n = 0;
    for (const p of Object.values(engine.players)) {
      if (isTakt(p) && p.alive && p.hp <= 1) n += this.revertCarts(engine, p);
    }
    return n;
  },
  // คำเชิญที่ยังไม่ตอบ — checkAllLocked รอคำตอบก่อนสรุปรอบ (หมดเวลาเฟส = ปฏิเสธ)
  invitePending(engine) {
    return Object.values(engine.players).some((p) => alive(p) && p.taktInvite && alive(engine.players[p.taktInvite.fromId]));
  },
  // เปิดไพ่/หมดเวลาโดยยังไม่ตอบ = ปฏิเสธ (เรียกตอนต้นเทิร์น — ทุกทางจบรอบไหลผ่านที่นั่น)
  sweepInvites(engine) {
    for (const p of Object.values(engine.players)) {
      if (!p.taktInvite) continue;
      const takt = engine.players[p.taktInvite.fromId];
      p.taktInvite = null;
      if (alive(p) && alive(takt)) {
        p.taktDeclinedRound = engine.roundNumber - 1;
        engine.log(`🎼 ${p.name} ไม่ได้ตอบคำเชิญของ ${takt.name} — ถือว่าปฏิเสธ`);
      }
    }
  },

  // ---------- ตาย = พันธะหลุด ----------
  onDeath(engine, victim) {
    if (!victim) return;
    if (isTakt(victim)) {
      this.revertCarts(engine, victim); // ทักต์ตาย = บทเพลงของทุกคนพัง (ก่อนพันธะหลุด)
      for (const c of bondedCarts(engine, victim)) {
        c.taktBondBy = null;
        if (c.alive) engine.log(`🎼 ${victim.name} ตกรอบ — พันธะสัญญากับ ${c.name} สิ้นสุดลง`);
      }
      victim.taktBonds = [];
      for (const p of Object.values(engine.players)) if (p.taktInvite && p.taktInvite.fromId === victim.id) p.taktInvite = null;
      return;
    }
    if (isMusicCart(victim)) {
      const takt = taktOf(engine, victim);
      victim.taktInvite = null;
      if (!takt) return;
      unbond(engine, takt, victim);
      delete victim.statuses.taktSong;
      if (takt.alive) engine.log(`🎼 ${victim.name} ตกรอบ — พันธะสัญญากับ ${takt.name} สิ้นสุดลง (เชิญคนใหม่ได้)`);
    }
  },

  // ---------- ต้นเทิร์น ----------
  onRoundStartTick(engine, p) {
    if (!isTakt(p) || !p.alive) return;
    if (engine.roundNumber > 0 && engine.roundNumber % REGEN_EVERY === 0) {
      const healed = engine.healHp(p, REGEN_HP);
      if (healed > 0) engine.log(`🎼 ${p.name} ตระกูลอาซาฮินะ — ฟื้นพลังชีวิต +${healed}`);
    }
  },

  // ---------- สกิลติดตัว 2: ไม่รับดาเมจจากการแพ้รอบ (แต้มน้อยสุด/ไพ่แตก) ----------
  lossDamageImmune(p) { return isTakt(p); },

  // ---------- หลบการโจมตีปกติ: ทักต์ 15% ติดตัว / 35% เมื่อมีพันธะ (ไม่บวกกัน) · มิวสิคคาร์ทโหมดทุ้มต่ำ 5% ----------
  dodgeChance(engine, target) {
    if (isTakt(target)) return bondedCarts(engine, target).length ? BOND_DODGE : INNATE_DODGE;
    if (isMusicCart(target) && songActive(target) && MODES[modeOf(target)].dodge) return MODES[modeOf(target)].dodge;
    return 0;
  },
  tryAttackDodge(engine, attacker, target) {
    const pct = this.dodgeChance(engine, target);
    if (!target || !target.alive || !(pct > 0) || Math.random() * 100 >= pct) return false;
    const takt = isTakt(target);
    const bondDodge = takt && pct === BOND_DODGE;
    const why = bondDodge ? "คอนดักเตอร์" : takt ? "ตระกูลอาซาฮินะ" : "ทุ้มต่ำ";
    target.wasAttacked = true;
    engine.log(`💨 หลบหลีก! ${target.name} หลบการโจมตีของ ${attacker.name} ได้ (${why} · ${pct}%)`);
    engine.setLastAttack({
      byName: attacker.name, byImg: engine.displayImg(attacker), byColor: engine.colorOf(attacker),
      targetName: target.name, targetImg: engine.displayImg(target), targetColor: engine.colorOf(target),
      dmg: 0, dodge: true,
      // คอนดักเตอร์: หลบโดยไม่ขึ้นป้ายบอกเหตุผล (สเปค "ไม่ต้องขึ้นแจ้งเตือน")
      skills: bondDodge ? [] : [{ name: `${why} — หลบหลีก (${pct}%)`, img: takt ? IMG.base : IMG.skill2, by: target.name, color: engine.colorOf(target), side: "def" }],
    });
    engine.runCutsceneQueue(() => {
      engine.setGameState("ATTACKING");
      engine.startPhaseTimer(engine.ATTACKFX_TIME, engine.endTurn);
      engine.broadcastState();
    });
    return true;
  },

  // ---------- ตระกูลอาซาฮินะ: หลบดาเมจจากสกิล 15% (ไม่หลบปืน/สถานะ · แม่นยำเจาะได้) ----------
  adjustIncomingDamage(engine, p, n, isNormalAttack) {
    if (!isTakt(p) || !(n > 0) || isNormalAttack || p._statusDamage || p._itemDamage) return n;
    const src = engine.effectSourceId;
    if (!src || src === p.id || engine.sourceAccurate() || Math.random() * 100 >= INNATE_DODGE) return n;
    engine.log(`💨 ${p.name} ตระกูลอาซาฮินะ — หลบความเสียหายจากสกิลได้ (${INNATE_DODGE}%)`);
    engine.skillFlash({ name: `ตระกูลอาซาฮินะ — หลบสกิล (${INNATE_DODGE}%)`, img: IMG.base, by: p.name, color: engine.colorOf(p) });
    return 0;
  },

  // ---------- ผลของบทเพลง (ungated — มิวสิคคาร์ทตัวไหนก็ได้) ----------
  atkBonus(p) { return songActive(p) ? SONG_ATK : 0; },
  atkFx(p) { return songActive(p) ? [`บทเพลงที่ไม่อาจลืม +${SONG_ATK}`] : []; },
  critBonus(p) { return songActive(p) ? (MODES[modeOf(p)].crit || 0) : 0; },
  // ทุ้มต่ำ: ความเสียหายที่ได้รับ -1 — ไม่นับดาเมจจากสถานะ (ลุกไหม้/เลือดไหลติกละ 1 จะกลายเป็นภูมิคุ้มกัน)
  songIncoming(p, n) {
    if (!(n > 0) || !songActive(p) || p._statusDamage) return n;
    return Math.max(0, n - (MODES[modeOf(p)].reduce || 0));
  },
  // อ่อนโยน: ตีปกติโดนแล้วฟื้นพลังชีวิต 2 — คืนจำนวนที่ฟื้นได้จริง
  songHealOnHit(engine, attacker) {
    if (!songActive(attacker) || !MODES[modeOf(attacker)].heal || !attacker.alive) return 0;
    return engine.healHp(attacker, MODES[modeOf(attacker)].heal);
  },

  // ---------- สกิล ----------
  //  targets[0] = เป้าหมาย · item = โหมด (สกิลรอง)
  pickCart(engine, p, targets, needSong) {
    const t = engine.players[Array.isArray(targets) ? targets[0] : null];
    if (!t || !t.alive || taktOf(engine, t) !== p) return null;
    return needSong === songActive(t) ? t : null;
  },
  canUseSkill(engine, p, tier, targets, item) {
    if (!isTakt(p)) return true;
    if (tier === "basic") {
      const t = engine.players[Array.isArray(targets) ? targets[0] : null];
      return engine.roundNumber >= (p.taktBasicReady || 0) && !!t && t.alive && !engine.isOrt(t);
    }
    if (tier === "secondary") {
      const t = this.pickCart(engine, p, targets, true);
      return !!t && !!MODES[item] && t.taktModeRound !== engine.roundNumber;
    }
    if (tier === "ultimate") return p.hp > 1 && !!this.pickCart(engine, p, targets, false); // เลือด 1 = บทเพลงพังทันที
    return true;
  },
  skipsTurnQuota(p, tier) { return isTakt(p) && tier === "secondary"; },
  applyInstantSkill(engine, p, tier, targets, item) {
    if (!isTakt(p)) return "";
    if (tier === "basic") {
      const t = engine.players[targets[0]];
      p.taktBasicReady = engine.roundNumber + BASIC_COOLDOWN;
      const self = t.id === p.id;
      const cart = taktOf(engine, t) === p;
      const fortune = cart ? BASIC_FORTUNE_CART : BASIC_FORTUNE;
      t.statuses.fortune = Math.min(engine.BARD_FORTUNE_MAX, (t.statuses.fortune || 0) + fortune);
      const hp = engine.healHp(t, self ? BASIC_HEAL_SELF : BASIC_HEAL);
      const ar = engine.healArmor(t, BASIC_ARMOR);
      engine.log(`🎵 ${p.name} เสียงอันไพเราะ → ${t.name} โชคลาภ +${fortune} · ฟื้นพลังชีวิต +${hp} · เกราะ +${ar || 0}`);
      return ` → ${t.name}`;
    }
    if (tier === "secondary") {
      const t = this.pickCart(engine, p, targets, true);
      t.taktSongMode = item;
      t.taktModeRound = engine.roundNumber;
      engine.log(`🎵 ${p.name} บรรเลงเสียงสวรรค์ — บทเพลงของ ${t.name} เปลี่ยนเป็นโหมด "${MODES[item].label}"`);
      return ` → ${t.name} · ${MODES[item].label}`;
    }
    if (tier === "ultimate") {
      const t = this.pickCart(engine, p, targets, false);
      t.statuses.taktSong = SONG_TURNS;
      t.taktSongMode = modeOf(t);
      t.transformAt = engine.nextTransformCounter();
      const key = MUSIC_CARTS[t.characterId].songKey;
      engine.triggerCutscene(t, key); // เต็มครั้งแรกต่อเกม ครั้งต่อไปเป็นการ์ดแจ้งเตือน
      engine.log(`🎼 ${p.name} ปลดปล่อยเสียงดนตรี — ${t.name} ได้ "บทเพลงที่ไม่อาจลืม" ${SONG_TURNS} เทิร์น (โหมด ${MODES[t.taktSongMode].label} · พลังโจมตี +${SONG_ATK}) · ปลดล็อกความสามารถของ${cartLabel(engine, t)}`);
      return ` → ${t.name}`;
    }
    return "";
  },

  // ---------- ข้อมูลให้ client ----------
  displayImg(engine, p) { return isTakt(p) && bondedCarts(engine, p).length ? IMG.bonded : null; },
  publicState(engine, p) {
    if (isTakt(p)) {
      return {
        role: "conductor",
        bonds: bondedCarts(engine, p).map((c) => ({ id: c.id, name: c.name, song: songActive(c) ? (c.statuses.taktSong || 0) : 0, mode: modeOf(c) })),
        maxBonds: MAX_BONDS,
        dodge: bondedCarts(engine, p).length ? BOND_DODGE : INNATE_DODGE,
        curtain: curtainActive(engine, p),
        perform: curtainActive(engine, p) ? {
          titan: { block: performBlock(engine, p, "titan"), cd: Math.max(0, ((p.taktPerformReady || {}).titan || 0) - engine.roundNumber) },
          destiny: { block: performBlock(engine, p, "destiny"), cd: Math.max(0, ((p.taktPerformReady || {}).destiny || 0) - engine.roundNumber) },
        } : null,
      };
    }
    if (isMusicCart(p)) {
      const takt = taktOf(engine, p);
      return {
        role: "cart",
        bondBy: takt ? { id: takt.id, name: takt.name } : null,
        song: songActive(p) ? (p.statuses.taktSong || 0) : 0,
        mode: modeOf(p),
        modeUsed: p.taktModeRound === engine.roundNumber,
        invited: !!p.taktInvite,
      };
    }
    return undefined;
  },
  // เห็นเฉพาะเจ้าตัว: คำเชิญที่รอตอบ (มิวสิคคาร์ท) · รายชื่อที่เชิญได้ (ทักต์)
  privateState(engine, p) {
    if (isMusicCart(p) && p.taktInvite) {
      const t = engine.players[p.taktInvite.fromId];
      return { taktInvite: t ? { fromId: t.id, fromName: t.name } : null };
    }
    if (isTakt(p)) {
      const carts = Object.values(engine.players).filter((c) => isMusicCart(c) && c.alive && !engine.isOrt(c));
      const cos = curtainActive(engine, p) ? cartOfType(engine, p, "cosette") : null;
      return {
        taktCandidates: carts.map((c) => ({ id: c.id, name: c.name, block: inviteBlock(engine, p, c) })),
        // สั่งเดสตินี่: เป้าที่คอเซ็ตต์เล็งได้
        taktPerformTargets: cos ? engine.attackableTargets(cos.id).map((o) => o.id) : [],
      };
    }
    return {};
  },
  skillLocks(engine, p) {
    if (!isTakt(p)) return undefined;
    const carts = bondedCarts(engine, p).filter((c) => c.alive);
    return {
      basic: { cd: Math.max(0, (p.taktBasicReady || 0) - engine.roundNumber) },
      secondary: { locked: !carts.some((c) => songActive(c) && c.taktModeRound !== engine.roundNumber), free: true },
      ultimate: { locked: p.hp <= 1 || !carts.some((c) => !songActive(c)) },
    };
  },
};
