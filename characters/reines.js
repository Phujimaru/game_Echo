// ============================================================
//  ไรเนส เอลเมลลอย — ระดับกลาง
//
//  "ทุกคน" = ffa: ทุกคนที่ยังอยู่ (รวมตัวเองและฝ่ายตรงข้าม) · โหมดทีม/Raid: ตัวเอง + เพื่อนร่วมทีมเท่านั้น
//  ท่าที่ปล่อยผลเสีย ไม่โดนตัวเอง และในโหมดทีมลงเฉพาะฝ่ายตรงข้าม
//
//  สกิลพื้นฐาน คำแนะนำชั้นครู (2 แต้ม · คูลดาวน์ 3) — ทำงานก่อนเปิดการ์ด
//    ทุกคนได้ "คุ้มครอง" 1 (1 เทิร์น) และทุกคนยกเว้นไรเนสฟื้นแต้มสกิล +1
//  สกิลรอง คำสั่งขั้นเด็ดขาด (4 แต้ม) — ทำงานก่อนเปิดการ์ด
//    เลือก 1 คน (รวมตัวเอง · โหมดทีมเฉพาะเพื่อนร่วมทีม) พลังโจมตี +1 และอัตราคริ +20% 2 เทิร์น (reinesCmd)
//    + "โชคลาภ" 1 หน่วย · ให้คนเดิมซ้ำ = โชคลาภเพิ่ม ส่วนพลังโจมตี/อัตราคริแค่ต่ออายุกลับเป็น 2 เทิร์น (ไม่ซ้อน)
//    หลังใช้ ไรเนสรับความเสียหาย 1 (ลดเกราะก่อน)
//  ท่าไม้ตาย แผนการลับสุดยอดชั้นครู (6 แต้ม · คูลดาวน์ 5 · วีดีโอทุกครั้งที่กด) — ทำงานก่อนเปิดการ์ด
//    ศัตรูทุกคน "เปราะบาง" 1 + "อ่อนแอ" 1 (3 เทิร์น · ต้านสถานะกันได้) และแต้มสกิล -1 (ต้านไม่ได้)
//    ไรเนสฟื้นพลังชีวิต 3
//  สกิลติดตัว คุณนายใหญ่ — ซื้อของ 1 ชิ้นมีโอกาส 20% ได้เพิ่มอีก 1 ชิ้นฟรี
//    ยกเว้นของที่มีได้ชิ้นเดียว (ปืน / Hyper Key Trigger / Trigger Dark Key / เกราะ Mark 42) · ของแถมไม่หักสต็อกร้าน
//
//  อัตราคริ +20% ของ reinesCmd ใช้กับโจมตีปกติ: ตัวละครที่มีอัตราคริเอง (อุซากิ/Kim) บวกเข้าการทอยของตัวเอง
//  ผ่าน engine.critBonusFor() · ตัวอื่นทอยรวมกับสนามที่ Journey.applyCrit — คริได้ครั้งเดียว ×2 เสมอ
// ============================================================

const ID = "reines";
const DIR = "/characters/reines";
const IMG = {
  base: `${DIR}/reines.jpg`,
  skill1: `${DIR}/reines_skill1.jpeg`,
  skill2: `${DIR}/reines_skill2.jpg`,
  skill3: `${DIR}/reines_skill3.jpg`,
};
const VIDEO = { ult: `${DIR}/reines_skill3.mp4` };

const GUARD_AMT = 1;
const GUARD_TURNS = 1;
const ADVICE_SKILL = 1;
const ADVICE_COOLDOWN = 3;
const CMD_ATK = 1;
const CMD_CRIT = 20;
const CMD_TURNS = 2;
const CMD_SELF_DMG = 1;
const PLAN_TURNS = 3;
const PLAN_DRAIN = 1;
const PLAN_HEAL = 3;
const PLAN_COOLDOWN = 5;
const BONUS_ITEM_PCT = 20;

const isReines = (p) => !!p && p.characterId === ID;
const teamish = (engine) => engine.teamModeActive() || engine.mercuryActive();

function allies(engine, src) {
  return engine.alivePlayers().filter((o) => !engine.isOrt(o) && (!teamish(engine) || o.id === src.id || engine.sameTeam(src, o)));
}
function enemies(engine, src) {
  return engine.alivePlayers().filter((o) => o.id !== src.id && !(teamish(engine) && engine.sameTeam(src, o)));
}
function pickTarget(engine, p, targets) {
  const t = engine.players[Array.isArray(targets) ? targets[0] : null];
  if (!t || !t.alive || engine.isOrt(t)) return null;
  if (teamish(engine) && t.id !== p.id && !engine.sameTeam(p, t)) return null; // โหมดทีม: มอบให้ตัวเอง/เพื่อนร่วมทีมเท่านั้น
  return t;
}
// ของที่มีได้ชิ้นเดียว — คุณนายใหญ่ไม่แถม
function uniqueItem(item) {
  if (item.type === "gutsGun" || item.type === "mark42") return true;
  return item.type === "gutsAmmo" && (item.ammo === "hyper_trigger" || item.ammo === "trigger_dark_key");
}

module.exports = {
  id: ID,
  IMG, VIDEO,
  GUARD_AMT, ADVICE_COOLDOWN, CMD_ATK, CMD_CRIT, CMD_TURNS, PLAN_TURNS, PLAN_HEAL, PLAN_COOLDOWN, BONUS_ITEM_PCT,

  resetCombat(p) {
    p.reinesAdviceReady = 0; // คำแนะนำชั้นครู: กดได้อีกเมื่อ roundNumber >= ค่านี้
    p.reinesPlanReady = 0;   // แผนการลับสุดยอดชั้นครู: กดได้อีกเมื่อ roundNumber >= ค่านี้
  },

  // บัฟคำสั่งขั้นเด็ดขาด (ungated — ใครติดก็ได้): พลังโจมตีอ่านที่ computeAttackBase · อัตราคริอ่านที่ critBonusFor/doAttack
  atkBonus(p) { return p && p.statuses && (p.statuses.reinesCmd || 0) > 0 ? CMD_ATK : 0; },
  critBonus(p) { return p && p.statuses && (p.statuses.reinesCmd || 0) > 0 ? CMD_CRIT : 0; },
  atkFx(p) { return this.atkBonus(p) ? [`คำสั่งขั้นเด็ดขาด +${CMD_ATK}`] : []; },

  // ---------- ด่านก่อนหักแต้ม ----------
  canUseSkill(engine, p, tier, targets) {
    const round = engine.roundNumber;
    if (tier === "basic") return round >= (p.reinesAdviceReady || 0);
    if (tier === "secondary") return !!pickTarget(engine, p, targets);
    if (tier === "ultimate") return round >= (p.reinesPlanReady || 0);
    return true;
  },

  // ---------- ลงผล ----------
  applyInstantSkill(engine, p, tier, targets) {
    const round = engine.roundNumber;
    if (tier === "basic") {
      p.reinesAdviceReady = round + ADVICE_COOLDOWN;
      const list = allies(engine, p);
      for (const o of list) {
        engine.applyBuff(o, "guard", GUARD_AMT, GUARD_TURNS);
        if (o.id !== p.id) engine.addSkill(o, ADVICE_SKILL);
      }
      engine.log(`📘 ${p.name} คำแนะนำชั้นครู — ${list.length} คนได้คุ้มครอง ${GUARD_TURNS} เทิร์น และทุกคนยกเว้นไรเนสฟื้นแต้มสกิล +${ADVICE_SKILL}`);
      return "";
    }
    if (tier === "secondary") {
      const t = pickTarget(engine, p, targets);
      const again = (t.statuses.reinesCmd || 0) > 0;
      engine.applyBuff(t, "reinesCmd", CMD_ATK, CMD_TURNS); // ให้ซ้ำ = ต่ออายุกลับเป็น 2 เทิร์น ไม่ซ้อน
      t.statuses.fortune = Math.min(engine.BARD_FORTUNE_MAX, (t.statuses.fortune || 0) + 1);
      engine.log(`📜 ${p.name} คำสั่งขั้นเด็ดขาด → ${t.name} ได้โชคลาภ +1${again ? " · พลังโจมตี/อัตราคริต่ออายุ" : ` · พลังโจมตี +${CMD_ATK} และอัตราคริ +${CMD_CRIT}% (${CMD_TURNS} เทิร์น)`}`);
      // ราคาของคำสั่ง: ไรเนสรับความเสียหาย 1 (ลดเกราะก่อน) — ไม่ผูกต้นตอ (เป็นผลต่อตัวเอง)
      engine.dealMixed(p, CMD_SELF_DMG);
      engine.maybeBeatSave(p);
      engine.maybeBeatMode(p);
      if (p.alive && p.hp <= 0) engine.instantDeath(p);
      return ` → ${t.name}`;
    }
    if (tier === "ultimate") {
      p.reinesPlanReady = round + PLAN_COOLDOWN;
      engine.queueCutscene(p, "reinesUlt"); // วีดีโอทุกครั้งที่กด
      const foes = enemies(engine, p);
      let hit = 0;
      engine.withEffectSource(p, () => {
        for (const o of foes) {
          const a = engine.applyDebuff(o, "fragile", 1, PLAN_TURNS);
          const b = engine.applyDebuff(o, "weak", 1, PLAN_TURNS);
          if (a || b) hit++;
          if (!engine.isOrt(o)) o.skillPoints = Math.max(0, (o.skillPoints || 0) - PLAN_DRAIN); // ต้านสถานะกันไม่ได้
        }
      });
      const healed = engine.healHp(p, PLAN_HEAL);
      engine.log(`🗝️ ${p.name} แผนการลับสุดยอดชั้นครู — ศัตรู ${foes.length} คนแต้มสกิล -${PLAN_DRAIN}${hit ? ` · ${hit} คนติดเปราะบาง+อ่อนแอ ${PLAN_TURNS} เทิร์น` : ""} · ไรเนสฟื้นพลังชีวิต +${healed}`);
      return "";
    }
    return "";
  },

  // ---------- สกิลติดตัว คุณนายใหญ่: เรียกจาก buyShopItem() หลังซื้อสำเร็จ ----------
  onShopBuy(engine, p, item) {
    if (!isReines(p) || uniqueItem(item) || !(Math.random() * 100 < BONUS_ITEM_PCT)) return false;
    engine.grantInventoryItem(p, item);
    engine.log(`👑 ${p.name} คุณนายใหญ่ — ได้ ${engine.shopItemName(item)} เพิ่มอีก 1 ชิ้นฟรี`);
    return true;
  },

  // ---------- ข้อมูลให้ client ----------
  skillLocks(engine, p) {
    const round = engine.roundNumber;
    return {
      basic: { cd: Math.max(0, (p.reinesAdviceReady || 0) - round) },
      ultimate: { cd: Math.max(0, (p.reinesPlanReady || 0) - round) },
    };
  },
};
