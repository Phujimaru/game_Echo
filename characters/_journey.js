// ============================================================
//  การเดินทาง (Journey) — ระบบสนามของโหมดสงครามทั่วไป (ffa / duo / trio)
//  ไฟล์นี้ไม่ใช่ตัวละคร (ไม่อยู่ใน CHAR_HOOKS) — server.js require ตรงเหมือน _mark42
//
//  เดินทางผ่าน 7 ภูมิภาค เปลี่ยนภูมิภาคทุก AREA_TURNS (10) เทิร์น — ถึงภูมิภาคที่ 7 แล้วอยู่ที่นั่นถาวร
//  แต่ละภูมิภาคมีผลประจำภูมิภาค (ทั้ง 10 เทิร์น) + ผลกลางวัน + ผลกลางคืน (กลางวัน/กลางคืนไม่ทับกัน)
//  ผลของภูมิภาค "แทน" กฎกลางวัน/กลางคืนเดิมทั้งหมด (โบนัสแต้มเช้าคู่ / ภาษีสกิลกลางคืน) —
//  กฎกลางวัน/กลางคืนเดิมเหลือใช้แค่ใน Type Mercury (SE.RA.PH มีกฎของตัวเอง)
//
//  ภูมิภาคคำนวณจาก roundNumber ล้วน ไม่มี state แยก -> Overload Force / ย้อนเวลาของชิโด ย้อนภูมิภาคให้เองโดยธรรมชาติ
//  กลางวัน/กลางคืนอ่านจาก engine.isNightRound() (มิติมายาบรรเลงของ Bard จึงยังพลิกช่วงเวลาได้ตามเดิม)
// ============================================================

const AREA_TURNS = 10;
const AREA_COUNT = 7;

// ตัวเลขบาลานซ์ (ดูเหตุผลใน GAME_SYSTEM.md หัวข้อ "การเดินทาง")
const MEADOW_GIFT_PCT = 30;       // 2 กลางวัน: ได้ไอเทมฟรีตอนจบเทิร์น
const MEADOW_NIGHT_STOCK = 3;     // 2 กลางคืน: ร้านซื้อได้ช่องละ 3 ชิ้น
const FOREST_ATK_MISS_PCT = 40;   // 3 กลางวัน: โจมตีปกติพลาด
const FOREST_SKILL_MISS_PCT = 25; // 3 กลางวัน: สกิลที่เลือกศัตรูเป็นเป้าพลาด (คืนแต้ม)
const FOREST_DOT_PCT = 50;        // 3 กลางคืน: ลุกไหม้/เลือดไหล/พิษร้าย แรงขึ้น +1
const WHIRL_SHOP_MIN_PRICE = 5;   // 4 กลางวัน: ร้านสุ่มเฉพาะของราคา 5 ขึ้นไป
const WHIRL_TOLL_PCT = 25;        // 4 กลางคืน: จบเทิร์นเสีย 2 เหรียญ
const WHIRL_TOLL_GOLD = 2;
const DESERT_REFUND = 2;          // 5 กลางคืน: ใช้สกิลได้แต้มคืน (ไม่เกินที่จ่ายจริง)
const ICE_CRIT_PCT = 20;          // 6 กลางวัน: โจมตีปกติคริติคอล ×2 (ตัวละครที่มีอัตราคริเอง = บวกเพิ่มเข้าไปในอัตรานั้น)
// ตัวละครที่ทอยคริติคอลเองใน applyCrit ของตัวเอง — สนามบวกอัตราเข้าไปในการทอยนั้นแทนการทอยแยก
const OWN_CRIT_CHARS = new Set(["usagi", "kim", "ort"]);
const ICE_STUN_PCT = 15;          // 6 กลางคืน: จบเทิร์นติดสตั้น 1 เทิร์น
const END_DECAY_PCT = 50;         // 7 กลางวัน: จบเทิร์นติดผุพัง 1 เทิร์น

const AREAS = [
  {
    id: 1, name: "อาณาจักรแห่งจุดเริ่มต้น",
    passive: null,
    day: "จบเทิร์นเลขคู่ ได้แต้มสกิลเพิ่ม +1",
    night: "ทุกเทิร์นสุ่มสกิลพื้นฐานหรือสกิลรองของแต่ละคนให้ใช้แต้มเพิ่มขึ้น +1 (ไม่รวมท่าไม้ตาย)",
  },
  {
    id: 2, name: "สวนดอกไม้ทุ่งหญ้าแสนอบอุ่น",
    passive: null,
    day: `จบเทิร์นมีโอกาส ${MEADOW_GIFT_PCT}% ได้ไอเทมราคาไม่เกิน 5 เหรียญฟรี 1 ชิ้น`,
    night: `ร้านค้ามายาซื้อได้ช่องละ ${MEADOW_NIGHT_STOCK} ชิ้น (ยกเว้นปืน / Hyper Key Trigger / เกราะ Mark 42)`,
  },
  {
    id: 3, name: "ป่าไม้ต้องสาป",
    passive: "ทุกสกิลใช้แต้มเพิ่มขึ้น +1 (เพดาน 8 แต้มเหมือนเดิม)",
    day: `โจมตีปกติพลาด ${FOREST_ATK_MISS_PCT}% แต่ถ้าโดนแรงขึ้น +1 · สกิลที่เลือกศัตรูเป็นเป้าหมายพลาด ${FOREST_SKILL_MISS_PCT}% (พลาดได้แต้มคืน) — "แม่นยำ" ไม่พลาด`,
    night: `ลุกไหม้ / เลือดไหล / พิษร้าย มีโอกาส ${FOREST_DOT_PCT}% แรงขึ้น +1 ทุกครั้งที่ออกฤทธิ์`,
  },
  {
    id: 4, name: "คลื่นวงวนน้ำ",
    passive: "จบเทิร์นได้เหรียญเพิ่ม +1",
    day: `ร้านค้ามายาสุ่มเฉพาะสินค้าราคา ${WHIRL_SHOP_MIN_PRICE} เหรียญขึ้นไป`,
    night: `จบเทิร์นมีโอกาส ${WHIRL_TOLL_PCT}% เสีย ${WHIRL_TOLL_GOLD} เหรียญ — มีไม่พอจะเสียเท่าที่มีและโดนความเสียหาย 1`,
  },
  {
    id: 5, name: "ทะเลทรายไม่อาจหวนคืน",
    passive: "เกราะฟื้น +1 ทุกเทิร์น",
    day: "จบเทิร์นโดนความเสียหาย 1 (ลดเกราะก่อน)",
    night: `ใช้สกิลได้แต้มคืน ${DESERT_REFUND} (ไม่เกินแต้มที่จ่ายจริง)`,
  },
  {
    id: 6, name: "อาณาจักรน้ำแข็ง",
    passive: "เกราะฟื้น +1 ทุกเทิร์น",
    day: `โจมตีปกติมีโอกาส ${ICE_CRIT_PCT}% คริติคอล ×2 (ตัวละครที่มีอัตราคริอยู่แล้ว ได้อัตราคริเพิ่ม +${ICE_CRIT_PCT}% แทน — ยังคูณ ×2 เท่าเดิม)`,
    night: `จบเทิร์นมีโอกาส ${ICE_STUN_PCT}% ติดสตั้น 1 เทิร์น (ไม่โดนซ้ำเทิร์นติดกัน · ต้านสถานะกันได้)`,
  },
  {
    id: 7, name: "จุดสิ้นสุดของโลก",
    passive: "เกราะฟื้น +1 ทุกเทิร์น · จบเทิร์นได้แต้มสกิลเพิ่ม +1",
    day: `จบเทิร์นโดนความเสียหาย 1 (ลดเกราะก่อน) และมีโอกาส ${END_DECAY_PCT}% ติดผุพัง 1 เทิร์น`,
    night: "พลังโจมตีของทุกคน +1",
  },
];

const roll = (pct) => Math.random() * 100 < pct;

function active(engine) {
  return ["ffa", "duo", "trio"].includes(engine.gameMode);
}
function areaOf(round) {
  const r = Math.max(1, Number(round) || 1);
  return Math.min(AREA_COUNT, Math.floor((r - 1) / AREA_TURNS) + 1);
}
// ภูมิภาค/ช่วงเวลาของเทิร์นปัจจุบัน — null = ไม่ได้อยู่ในโหมดที่มีการเดินทาง
function current(engine) {
  if (!active(engine)) return null;
  const round = engine.roundNumber;
  return { area: areaOf(round), night: !!engine.isNightRound(round) };
}
function is(engine, area, half) {
  const c = current(engine);
  if (!c || c.area !== area) return false;
  if (half === "day") return !c.night;
  if (half === "night") return c.night;
  return true;
}

module.exports = {
  AREA_TURNS, AREA_COUNT, AREAS,
  MEADOW_GIFT_PCT, MEADOW_NIGHT_STOCK, FOREST_ATK_MISS_PCT, FOREST_SKILL_MISS_PCT, FOREST_DOT_PCT,
  WHIRL_SHOP_MIN_PRICE, WHIRL_TOLL_PCT, WHIRL_TOLL_GOLD, DESERT_REFUND, ICE_CRIT_PCT, ICE_STUN_PCT, END_DECAY_PCT,
  active, areaOf, current, is,

  // ---------- กฎวัน/คืนเดิมที่ภูมิภาคเข้ามาแทน ----------
  // ภาษีสกิลกลางคืน (สุ่มพื้นฐาน/รอง +1) — ในการเดินทางเหลือเฉพาะ 1 กลางคืน
  nightTaxOn(engine, legacyNight) {
    return active(engine) ? is(engine, 1, "night") : legacyNight;
  },
  // แต้มสกิลโบนัสจบเทิร์น (ต่อคน) — ในการเดินทางแทนโบนัสเช้าคู่เดิมทั้งหมด
  skillBonus(engine, legacyMorning) {
    if (!active(engine)) return legacyMorning ? 1 : 0;
    let n = 0;
    if (is(engine, 1, "day") && engine.roundNumber % 2 === 0) n += 1;
    if (is(engine, 7)) n += 1;
    return n;
  },
  goldBonus(engine) { return is(engine, 4) ? 1 : 0; },
  // 5-7: เกราะฟื้นทุกเทิร์น (ปกติฟื้นเฉพาะเทิร์นเลขคู่)
  armorRegenDue(engine, round) {
    const c = current(engine);
    return (c && c.area >= 5) || round % 2 === 0;
  },

  // ---------- ราคาสกิล (ต้องคิดเหมือนกันทั้ง useSkill() และ buildStateFor()) ----------
  // 3: ทุกสกิลแพงขึ้น +1 — สกิลราคา 0 (ปุ่มสลับโหมด/เลือกของ) ยังฟรีเหมือนเดิม
  skillTax(engine, baseCost) {
    return is(engine, 3) && baseCost > 0 ? 1 : 0;
  },
  // 3 กลางวัน: สกิลที่เลือกศัตรูเป็นเป้าหมายพลาด — คืน true = พลาด (ผู้เรียกคืนแต้มแล้วจบ)
  skillMisses(engine, p, targets) {
    if (!is(engine, 3, "day") || engine.accurateActive(p)) return false; // แม่นยำ = ไม่พลาด
    const foes = (Array.isArray(targets) ? targets : []).filter((t) => {
      const o = engine.players[t];
      return o && o.id !== p.id && o.alive && !engine.sameTeam(p, o);
    });
    return foes.length > 0 && roll(FOREST_SKILL_MISS_PCT);
  },
  // 5 กลางคืน: แต้มที่ได้คืนหลังใช้สกิลสำเร็จ
  skillRefund(engine, paid) {
    return is(engine, 5, "night") ? Math.min(DESERT_REFUND, Math.max(0, paid)) : 0;
  },

  // ---------- การโจมตีปกติ ----------
  // 3 กลางวัน: โจมตีพลาด — จบหมัดเหมือนด่านหลบหลีก (การ์ดสรุป dodge: true)
  tryAttackMiss(engine, attacker, target) {
    if (!is(engine, 3, "day") || !roll(FOREST_ATK_MISS_PCT)) return false;
    target.wasAttacked = true;
    engine.log(`🌲 ป่าไม้ต้องสาป — ${attacker.name} โจมตี ${target.name} พลาดเป้า! (${FOREST_ATK_MISS_PCT}%)`);
    engine.setLastAttack({
      byName: attacker.name, byImg: engine.displayImg(attacker), byColor: engine.colorOf(attacker),
      targetName: target.name, targetImg: engine.displayImg(target), targetColor: engine.colorOf(target),
      dmg: 0, dodge: true,
      skills: [{ name: `ป่าไม้ต้องสาป — พลาดเป้า (${FOREST_ATK_MISS_PCT}%)`, img: null, by: attacker.name, color: engine.colorOf(attacker), side: "atk" }],
    });
    engine.runCutsceneQueue(() => {
      engine.setGameState("ATTACKING");
      engine.startPhaseTimer(engine.ATTACKFX_TIME, engine.endTurn);
      engine.broadcastState();
    });
    return true;
  },
  // พลังโจมตีที่ภูมิภาคให้ (3 กลางวัน: ตีโดนแรงขึ้น +1 · 7 กลางคืน: ทุกคน +1)
  attackBonus(engine) {
    if (is(engine, 3, "day")) return { amount: 1, name: "ป่าไม้ต้องสาป — ตีโดนแรงขึ้น +1" };
    if (is(engine, 7, "night")) return { amount: 1, name: "จุดสิ้นสุดของโลก — พลังโจมตี +1" };
    return null;
  },
  // 6 กลางวัน: อัตราคริติคอลที่สนามให้ (%) — ตัวละครที่มีระบบคริเอง (OWN_CRIT_CHARS) บวกค่านี้เข้าไปในการทอยของตัวเอง
  //  ผ่าน engine.critBonusFor(p) (สนาม + บัฟอัตราคริของตัวละคร เช่น คำสั่งขั้นเด็ดขาดของไรเนส) · หมัดหนึ่งคริได้ครั้งเดียว ×2 เสมอ
  critBonus(engine) {
    return is(engine, 6, "day") ? ICE_CRIT_PCT : 0;
  },
  // 6 กลางวัน: คริติคอลของสนามสำหรับตัวละครที่ไม่มีอัตราคริของตัวเอง (โอกาส 20% ×2)
  //  extraPct = อัตราคริจากบัฟอื่นที่ไม่ใช่สนาม (ไรเนส) — รวมกันแล้วทอยครั้งเดียว
  applyCrit(engine, attacker, dmg, fx, extraPct = 0) {
    if (!(dmg > 0) || OWN_CRIT_CHARS.has(attacker.characterId)) return dmg;
    const pct = this.critBonus(engine) + extraPct;
    if (!pct || !roll(pct)) return dmg;
    fx.crit = true;
    fx.pct = pct;
    return dmg * 2;
  },
  OWN_CRIT_CHARS,

  // ---------- 3 กลางคืน: ดาเมจสถานะต่อเนื่อง ----------
  dotBonus(engine) {
    return is(engine, 3, "night") && roll(FOREST_DOT_PCT) ? 1 : 0;
  },

  // ---------- ร้านค้ามายา ----------
  // 4 กลางวัน: สุ่มใหม่จนได้ของราคา >= 5 (ของที่ถูกกว่ามีแค่ยาเกราะ/ยาแต้มสกิลเล็ก จึงหลุดเร็วมาก)
  filterShopRoll(engine, rollFn) {
    let item = rollFn();
    if (!is(engine, 4, "day")) return item;
    for (let i = 0; i < 40 && item.price < WHIRL_SHOP_MIN_PRICE; i++) item = rollFn();
    return item;
  },
  // 2 กลางคืน: จำนวนชิ้นต่อช่อง — ของที่เกมตั้งโควตาต่อรอบไว้ (ปืน/Hyper Key/Mark 42) ยังช่องละ 1
  shopStock(engine, item) {
    if (!is(engine, 2, "night")) return 1;
    if (item.type === "gutsGun" || item.type === "mark42") return 1;
    if (item.type === "gutsAmmo" && item.ammo === "hyper_trigger") return 1;
    return MEADOW_NIGHT_STOCK;
  },

  // ---------- ผลจบเทิร์น (เรียกหลังลูปลดเทิร์นสถานะ -> สตั้น/ผุพังที่ติดตรงนี้มีผลเต็มเทิร์นหน้า) ----------
  onEndTurn(engine) {
    const c = current(engine);
    if (!c) return;
    const alive = engine.alivePlayers().filter((p) => !engine.isOrt(p));
    if (c.area === 2 && !c.night) {
      for (const p of alive) {
        if (!roll(MEADOW_GIFT_PCT)) continue;
        const item = engine.grantInventoryItem(p, engine.journeyGiftItem());
        if (item) engine.log(`🌼 ${p.name} เก็บของในทุ่งดอกไม้ได้ — ${engine.shopItemName(item)} (ฟรี)`);
      }
    }
    if (c.area === 4 && c.night) {
      for (const p of alive) {
        if (!roll(WHIRL_TOLL_PCT)) continue;
        const gold = p.gold || 0;
        const lost = Math.min(gold, WHIRL_TOLL_GOLD);
        p.gold = gold - lost;
        if (lost >= WHIRL_TOLL_GOLD) {
          engine.log(`🌊 ${p.name} ถูกวังวนน้ำกลืนเหรียญไป -${lost}`);
        } else {
          engine.log(`🌊 ${p.name} ถูกวังวนน้ำกลืนเหรียญไป -${lost} แต่ไม่พอจ่าย — โดนความเสียหาย 1`);
          fieldDamage(engine, p);
        }
      }
    }
    if ((c.area === 5 || c.area === 7) && !c.night) {
      const icon = c.area === 5 ? "☀️ แดดทะเลทรายแผดเผา" : "🔥 เปลวไฟแห่งจุดจบแผดเผา";
      for (const p of alive) {
        engine.log(`${icon} ${p.name} — ความเสียหาย 1`);
        fieldDamage(engine, p);
        if (c.area === 7 && p.alive && roll(END_DECAY_PCT) && engine.applyDebuff(p, "decay", null, 1)) {
          engine.log(`🥀 ${p.name} ติดผุพัง 1 เทิร์น — เกราะไม่ฟื้น`);
        }
      }
    }
    if (c.area === 6 && c.night) {
      const round = engine.roundNumber;
      for (const p of alive) {
        if (p.journeyStunRound === round - 1) continue; // เพิ่งโดนแช่แข็งเมื่อเทิร์นที่แล้ว
        if (!roll(ICE_STUN_PCT)) continue;
        if (engine.applyDebuff(p, "stun", null, 1)) {
          p.journeyStunRound = round;
          engine.log(`❄️ ${p.name} ถูกความหนาวแช่แข็ง — ติดสตั้น 1 เทิร์น`);
        } else {
          engine.log(`❄️ ${p.name} ต้านทานความหนาวไว้ได้ (ต้านสถานะผิดปกติ)`);
        }
      }
    }
  },

  // ---------- ข้อมูลที่ส่งให้ client ----------
  publicInfo(engine, scene) {
    if (!active(engine)) return null;
    // ระหว่างฉากเดินทางไปภูมิภาคใหม่ ให้ client เห็นภูมิภาคปลายทางแล้ว (ฉากหลัง/เพลงเปลี่ยนใต้ฉากแผนที่)
    const round = scene && scene.active && scene.mode === "advance" ? engine.roundNumber + 1 : engine.roundNumber;
    const area = areaOf(round);
    const night = !!engine.isNightRound(round);
    const a = AREAS[area - 1];
    const turnInArea = area < AREA_COUNT ? ((Math.max(1, round) - 1) % AREA_TURNS) + 1 : null;
    return {
      area, night, name: a.name, passive: a.passive, day: a.day, nightDesc: a.night,
      turnsLeft: turnInArea ? AREA_TURNS - turnInArea + 1 : null, // เทิร์นที่เหลือในภูมิภาคนี้ (ภูมิภาค 7 = ไม่มีที่สิ้นสุด)
      scene: scene ? { seq: scene.seq, active: !!scene.active, mode: scene.mode, area: scene.area, fromArea: scene.fromArea } : null,
    };
  },
};

// ความเสียหายจากสนาม 1 หน่วย (ลดเกราะก่อน) — ท่อตายชุดเดียวกับลุกไหม้/พิษร้าย
function fieldDamage(engine, p) {
  p._statusDamage = true; // ไม่ใช่ดาเมจจากสกิล/การโจมตี (ฮุคของเอสคานอร์ ฯลฯ อ่านค่านี้)
  engine.dealMixed(p, 1);
  p._statusDamage = false;
  engine.maybeBeatSave(p);
  engine.maybeBeatMode(p);
  engine.maybeWakeKotone(p);
  if (p.alive && p.hp <= 0) {
    engine.instantDeath(p);
    if (!p.alive) engine.log(`💀 ${p.name} ไม่อาจเดินทางต่อได้อีก — ตกรอบ!`);
  }
}
