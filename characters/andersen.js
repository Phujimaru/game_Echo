// ============================================================
//  ฮันส์ คริสเตียน แอนเดอร์เซน — ระดับยาก
//
//  "ทุกคน" = ffa: ทุกคนที่ยังอยู่ (รวมฝ่ายตรงข้าม) · โหมดทีม/Raid: ตัวเอง + เพื่อนร่วมทีม (แบบเดียวกับตัวละครซัพพอร์ตอื่น)
//
//  สกิลพื้นฐาน นักแสดงผู้ยอดเยี่ยม (2 แต้ม · คูลดาวน์ 2) — ทำงานก่อนเปิดการ์ด
//    เลือก 1 คน (ใครก็ได้ รวมตัวเอง ทุกโหมด) ลดไพ่ใบล่าสุดในมือออก (คืนเข้ากองกลาง แบบยาลดไพ่)
//    ถ้าเป้าหมายเปิดไพ่แล้ว ลดไพ่ไม่ได้ · ฟื้นพลังชีวิตให้เป้าหมาย 1 เสมอ
//  สกิลรอง นางเงือกน้อยของฉัน (4 แต้ม) — ทำงานก่อนเปิดการ์ด
//    เลือก 1 คน (รวมตัวเอง · โหมดทีมเฉพาะเพื่อนร่วมทีม) + เลือกสี (แดง/เหลือง/เขียว/ฟ้า)
//    50% ไพ่มีสีทั้งมือเปลี่ยนเป็นสีที่เลือก · ไม่สำเร็จ = ทั้งมือเปลี่ยนเป็นสีอื่นสีเดียวกัน (สุ่มจาก 3 สีที่เหลือ)
//    ผลไพ่ครบชุดออกตอนเปิดไพ่ตามปกติ (ฟ้าก็ออกตอนเปิดไพ่ — server เช็ค checkBlueTrigger ซ้ำใน applyLockColorTriggers)
//  ท่าไม้ตาย Märchen Meines Lebens (6 แต้ม · วีดีโอทุกครั้งที่กด) — ทำงานก่อนเปิดการ์ด
//    ทุกคนฟื้นพลังชีวิต 2 (การันตี) และโรลแยกกันคนละ 4 อย่าง อย่างละ 25% (50% ถ้าแอนเดอร์เซนมี "มุมมองใหม่"):
//    เยียวยา 1 (3 เทิร์น) · แต้มสกิล +1 ทุกจบเทิร์น (3 เทิร์น) · คุ้มครอง 1 (3 เทิร์น) · อัตราคริ +20% (3 เทิร์น)
//  สกิลติดตัว สุดยอดนักเขียน — นับเฉพาะไพ่ที่กดจั่วเอง (ไม่นับใบแรกที่เกมแจก) นับข้ามเทิร์น
//    ทุก 3 ใบ แต้มสกิล +1 · ทุก 5 ใบ ได้ "มุมมองใหม่" 1 เทิร์น (ได้ซ้ำ = ต่ออายุ ไม่ซ้อน)
//
//  สถานะ: andView (มุมมองใหม่) · andInk (แต้มสกิล +1 ทุกจบเทิร์น — ตัวนับเทิร์นจริง แต่ลดเองใน onEndTurn หลังแจกแต้ม
//    จึงต้องข้ามในลูปลดเทิร์นของ endTurn · ไม่ใส่ NO_TICK_STATUS เพราะนั่นคือรายการสถานะ "ถาวร") · andCrit (อัตราคริ +20%)
// ============================================================

const ID = "andersen";
const DIR = "/characters/andersen";
const IMG = {
  base: `${DIR}/andersen.jpg`,
  skill1: `${DIR}/andersen_skill1.jpg`,
  skill2: `${DIR}/andersen_skill2.jpg`,
  skill3: `${DIR}/andersen_skill3.jpg`,
};
const VIDEO = { ult: `${DIR}/andersen_skill3.mp4` };

const COLORS = ["red", "yellow", "green", "blue"];
const COLOR_TH = { red: "แดง", yellow: "เหลือง", green: "เขียว", blue: "ฟ้า" };
const ACTOR_HEAL = 1;
const ACTOR_COOLDOWN = 2;
const MERMAID_SUCCESS_PCT = 50;
const TALE_HEAL = 2;
const TALE_PCT = 25;
const TALE_VIEW_BONUS = 25;
const TALE_TURNS = 3;
const TALE_CRIT = 20;
const WRITER_SKILL_EVERY = 3;
const WRITER_VIEW_EVERY = 5;

const isAndersen = (p) => !!p && p.characterId === ID;
const teamish = (engine) => engine.teamModeActive() || engine.mercuryActive();
const roll = (pct) => Math.random() * 100 < pct;

function allies(engine, src) {
  return engine.alivePlayers().filter((o) => !engine.isOrt(o) && (!teamish(engine) || o.id === src.id || engine.sameTeam(src, o)));
}
function pickAnyone(engine, targets) {
  const t = engine.players[Array.isArray(targets) ? targets[0] : null];
  return t && t.alive && !engine.isOrt(t) ? t : null;
}
function pickAlly(engine, p, targets) {
  const t = pickAnyone(engine, targets);
  if (!t) return null;
  if (teamish(engine) && t.id !== p.id && !engine.sameTeam(p, t)) return null;
  return t;
}
function cardName(c) {
  if (!c) return "ไพ่";
  if (c.special) return { king: "King", queen: "Queen", joker: "Joker" }[c.special] || "ไพ่พิเศษ";
  return `${COLOR_TH[c.color] || ""} ${c.value}`.trim();
}

module.exports = {
  id: ID,
  IMG, VIDEO, COLORS,
  ACTOR_COOLDOWN, MERMAID_SUCCESS_PCT, TALE_HEAL, TALE_PCT, TALE_VIEW_BONUS, TALE_TURNS, TALE_CRIT,
  WRITER_SKILL_EVERY, WRITER_VIEW_EVERY,

  resetCombat(p) {
    p.andActorReady = 0; // นักแสดงผู้ยอดเยี่ยม: กดได้อีกเมื่อ roundNumber >= ค่านี้
    p.andDrawSkill = 0;  // สุดยอดนักเขียน: ไพ่ที่จั่วเองสะสม (ทุก 3 ใบ แต้มสกิล +1)
    p.andDrawView = 0;   // สุดยอดนักเขียน: ไพ่ที่จั่วเองสะสม (ทุก 5 ใบ มุมมองใหม่)
  },

  // อัตราคริจากท่าไม้ตาย (ungated — ใครติดก็ได้) อ่านที่ critBonusFor / doAttack
  critBonus(p) { return p && p.statuses && (p.statuses.andCrit || 0) > 0 ? TALE_CRIT : 0; },
  talePct(p) { return TALE_PCT + ((p.statuses.andView || 0) > 0 ? TALE_VIEW_BONUS : 0); },

  // ---------- ด่านก่อนหักแต้ม ----------
  canUseSkill(engine, p, tier, targets, item) {
    if (tier === "basic") return engine.roundNumber >= (p.andActorReady || 0) && !!pickAnyone(engine, targets);
    if (tier === "secondary") return COLORS.includes(item) && !!pickAlly(engine, p, targets);
    return true;
  },

  // ---------- ลงผล ----------
  applyInstantSkill(engine, p, tier, targets, item) {
    if (tier === "basic") {
      const t = pickAnyone(engine, targets);
      p.andActorReady = engine.roundNumber + ACTOR_COOLDOWN;
      let note = "";
      if (!t.locked && t.cards && t.cards.length > 0) {
        const removed = t.cards.pop();
        engine.centralDeck.push(removed); // คืนเข้ากองกลางแบบยาลดไพ่
        t.busted = engine.bustedOf(t);
        note = `ลดไพ่ใบล่าสุด (${cardName(removed)}) ออก`;
      } else {
        note = "เปิดไพ่ไปแล้ว ลดไพ่ไม่ได้";
      }
      const healed = engine.healHp(t, ACTOR_HEAL);
      engine.log(`🎭 ${p.name} นักแสดงผู้ยอดเยี่ยม → ${t.name} ${note} · ฟื้นพลังชีวิต +${healed}`);
      return ` → ${t.name}`;
    }
    if (tier === "secondary") {
      const t = pickAlly(engine, p, targets);
      const success = roll(MERMAID_SUCCESS_PCT);
      const color = success ? item : COLORS.filter((c) => c !== item)[Math.floor(Math.random() * 3)];
      let n = 0;
      for (const c of t.cards || []) {
        if (c.special || !COLORS.includes(c.color)) continue;
        c.color = color;
        n++;
      }
      engine.log(`🧜 ${p.name} นางเงือกน้อยของฉัน → ${t.name} เลือกสี${COLOR_TH[item]} — ${success ? "สำเร็จ" : "ล้มเหลว"}! ไพ่ ${n} ใบเปลี่ยนเป็นสี${COLOR_TH[color]}`);
      return ` → ${t.name} (${COLOR_TH[color]})`;
    }
    if (tier === "ultimate") {
      engine.queueCutscene(p, "andersenUlt"); // วีดีโอทุกครั้งที่กด
      const pct = this.talePct(p);
      const list = allies(engine, p);
      const got = [];
      for (const o of list) {
        engine.healHp(o, TALE_HEAL);
        const bits = [];
        if (roll(pct)) { engine.applyMend(o, 1, TALE_TURNS); bits.push("เยียวยา"); }
        if (roll(pct)) { o.statuses.andInk = TALE_TURNS; bits.push("แต้มสกิล +1/เทิร์น"); }
        if (roll(pct)) { engine.applyBuff(o, "guard", 1, TALE_TURNS); bits.push("คุ้มครอง"); }
        if (roll(pct)) { engine.applyBuff(o, "andCrit", TALE_CRIT, TALE_TURNS); bits.push("อัตราคริ +20%"); }
        got.push(`${o.name}${bits.length ? ` (${bits.join(", ")})` : ""}`);
      }
      engine.log(`📖 ${p.name} Märchen Meines Lebens (โอกาส ${pct}%) — ทุกคนฟื้นพลังชีวิต +${TALE_HEAL} · ${got.join(" · ")}`);
      return "";
    }
    return "";
  },

  // ---------- สกิลติดตัว: เรียกจาก hit() หลังได้ไพ่จริง (count = จำนวนใบที่ได้จากการกดจั่วครั้งนี้) ----------
  onPlayerDraw(engine, p, count) {
    if (!isAndersen(p) || !(count > 0)) return;
    p.andDrawSkill = (p.andDrawSkill || 0) + count;
    p.andDrawView = (p.andDrawView || 0) + count;
    while (p.andDrawSkill >= WRITER_SKILL_EVERY) {
      p.andDrawSkill -= WRITER_SKILL_EVERY;
      engine.addSkill(p, 1, "passive");
      engine.log(`✒️ ${p.name} สุดยอดนักเขียน — จั่วครบ ${WRITER_SKILL_EVERY} ใบ แต้มสกิล +1`);
    }
    if (p.andDrawView >= WRITER_VIEW_EVERY) {
      p.andDrawView %= WRITER_VIEW_EVERY;
      p.statuses.andView = 1; // ได้ซ้ำ = ต่ออายุ ไม่ซ้อน
      engine.log(`✒️ ${p.name} สุดยอดนักเขียน — จั่วครบ ${WRITER_VIEW_EVERY} ใบ ได้ "มุมมองใหม่" (ท่าไม้ตายโอกาส +${TALE_VIEW_BONUS}% เทิร์นนี้)`);
    }
  },

  // ---------- จบเทิร์น: แต้มสกิล +1 ของท่าไม้ตาย (andInk ลดตัวนับเองที่นี่) ----------
  onEndTurn(engine) {
    for (const o of engine.alivePlayers()) {
      if (!((o.statuses.andInk || 0) > 0)) continue;
      engine.addSkill(o, 1, "passive"); // ชะงัก/ผนึกพลังเวทปิดการฟื้นแต้มได้ตามปกติ
      o.statuses.andInk--;
      if (o.statuses.andInk <= 0) delete o.statuses.andInk;
    }
  },

  // ---------- ข้อมูลให้ client ----------
  skillLocks(engine, p) {
    return { basic: { cd: Math.max(0, (p.andActorReady || 0) - engine.roundNumber) } };
  },
  publicState(p) {
    return { drawSkill: p.andDrawSkill || 0, drawView: p.andDrawView || 0, skillEvery: WRITER_SKILL_EVERY, viewEvery: WRITER_VIEW_EVERY };
  },
};
