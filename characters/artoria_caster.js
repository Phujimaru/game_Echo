// ============================================================
//  จอมเวทย์ อาร์โทเรีย — ระดับง่าย
//
//  "ผู้เล่นทุกคน" = ffa: ทุกคนที่ยังอยู่ (รวมฝ่ายตรงข้าม) · โหมดทีม/Raid: ตัวเอง + เพื่อนร่วมทีมเท่านั้น
//  สกิลพื้นฐาน เสน่ห์แห่งความหวัง (0 แต้ม · คูลดาวน์ 5 เทิร์น) — ทำงานก่อนเปิดการ์ด
//    ผู้เล่นทุกคน พลังโจมตี +1 (3 เทิร์น) และแต้มสกิล +3
//  สกิลรอง ผู้พิทักษ์ทะเลสาบ (0 แต้ม · คูลดาวน์ 2 เทิร์น) — ทำงานก่อนเปิดการ์ด
//    เลือก 1 คน (โหมดทีม: ตัวเอง/เพื่อนร่วมทีม · ffa: ใครก็ได้) แต้มสกิล +1 และ "ความหวัง" 2 เทิร์น
//  ท่าไม้ตาย Around Caliburn (8 แต้ม · วีดีโอทุกครั้งที่กด) — ทำงานก่อนเปิดการ์ด
//    ผู้เล่นทุกคน พลังโจมตี +1 (3 เทิร์น) · หลบหลีก 1 สแตค · ล้างดีบัฟที่โดนล่าสุด 1 อย่าง · ฟื้นพลังชีวิต 2
//  สกิลติดตัว หัวใจที่บริสุทธิ์ — ต้นเทิร์นที่ 3, 6, 9, … หลบหลีก 1 สแตค (อยู่ 1 เทิร์น ใช้ได้ 1 ครั้ง) + ฟื้นพลังชีวิต 2
//  บัฟเฉพาะตัว "ความหวัง" (artHope) — ออกหมัดโจมตีปกติ (ถูกหลบก็นับ) ฟื้นแต้มสกิล +1
//
//  พลังโจมตี +1 ของสกิลพื้นฐาน (artCharm) กับท่าไม้ตาย (artCaliburn) เป็นคนละสถานะ จึงซ้อนกันได้ (+2)
//  คูลดาวน์เก็บเป็นเลขรอบ: กดเทิร์น N คูลดาวน์ 5 = กดได้อีกเทิร์น N+5
// ============================================================

const ID = "artoria_caster";
const DIR = "/characters/artoria_caster";
const IMG = {
  base: `${DIR}/artoria_caster.webp`,
  skill1: `${DIR}/artoria_caster_skill1.jpg`,
  skill2: `${DIR}/artoria_caster_skill2.jpg`,
  skill3: `${DIR}/artoria_caster_skill3.jpg`,
};
const VIDEO = { ult: `${DIR}/artoria_caster_skill3.mp4` };

const CHARM_ATK = 1;
const CHARM_TURNS = 3;
const CHARM_SKILL = 3;
const CHARM_COOLDOWN = 5;
const LAKE_SKILL = 1;
const HOPE_TURNS = 2;
const LAKE_COOLDOWN = 2;
const CALIBURN_ATK = 1;
const CALIBURN_TURNS = 3;
const CALIBURN_HEAL = 2;
const HEART_EVERY = 3;
const HEART_HEAL = 2;

const isArtoria = (p) => !!p && p.characterId === ID;

function allies(engine, src) {
  const teamish = engine.teamModeActive() || engine.mercuryActive();
  return engine.alivePlayers().filter((o) => !engine.isOrt(o) && (!teamish || o.id === src.id || engine.sameTeam(src, o)));
}
function pickTarget(engine, p, targets) {
  const t = engine.players[Array.isArray(targets) ? targets[0] : null];
  if (!t || !t.alive || engine.isOrt(t)) return null;
  const teamish = engine.teamModeActive() || engine.mercuryActive();
  if (teamish && t.id !== p.id && !engine.sameTeam(p, t)) return null; // โหมดทีม: มอบให้ตัวเอง/เพื่อนร่วมทีมเท่านั้น
  return t;
}

module.exports = {
  id: ID,
  IMG, VIDEO,
  CHARM_ATK, CHARM_SKILL, CHARM_COOLDOWN, LAKE_COOLDOWN, CALIBURN_HEAL, HEART_EVERY, HEART_HEAL,

  resetCombat(p) {
    p.artCharmReady = 0; // เสน่ห์แห่งความหวัง: กดได้อีกเมื่อ roundNumber >= ค่านี้
    p.artLakeReady = 0;  // ผู้พิทักษ์ทะเลสาบ: กดได้อีกเมื่อ roundNumber >= ค่านี้
  },

  // พลังโจมตีจากท่าของอาร์โทเรีย (ungated — อ่านที่ computeAttackBase ใครติดก็ได้)
  atkBonus(p) {
    if (!p || !p.statuses) return 0;
    return ((p.statuses.artCharm || 0) > 0 ? CHARM_ATK : 0) + ((p.statuses.artCaliburn || 0) > 0 ? CALIBURN_ATK : 0);
  },
  atkFx(p) {
    const out = [];
    if ((p.statuses.artCharm || 0) > 0) out.push(`เสน่ห์แห่งความหวัง +${CHARM_ATK}`);
    if ((p.statuses.artCaliburn || 0) > 0) out.push(`Around Caliburn +${CALIBURN_ATK}`);
    return out;
  },

  // ---------- ด่านก่อนหักแต้ม ----------
  canUseSkill(engine, p, tier, targets) {
    const round = engine.roundNumber;
    if (tier === "basic") return round >= (p.artCharmReady || 0);
    if (tier === "secondary") return round >= (p.artLakeReady || 0) && !!pickTarget(engine, p, targets);
    return true;
  },

  // ---------- ลงผล ----------
  applyInstantSkill(engine, p, tier, targets) {
    const round = engine.roundNumber;
    if (tier === "basic") {
      p.artCharmReady = round + CHARM_COOLDOWN;
      const list = allies(engine, p);
      for (const o of list) {
        engine.applyBuff(o, "artCharm", CHARM_ATK, CHARM_TURNS);
        engine.addSkill(o, CHARM_SKILL);
      }
      engine.log(`🌸 ${p.name} เสน่ห์แห่งความหวัง — ${list.length} คน พลังโจมตี +${CHARM_ATK} (${CHARM_TURNS} เทิร์น) และแต้มสกิล +${CHARM_SKILL}`);
      return "";
    }
    if (tier === "secondary") {
      const t = pickTarget(engine, p, targets);
      p.artLakeReady = round + LAKE_COOLDOWN;
      engine.addSkill(t, LAKE_SKILL);
      engine.applyBuff(t, "artHope", null, HOPE_TURNS);
      engine.log(`💧 ${p.name} ผู้พิทักษ์ทะเลสาบ → ${t.name} แต้มสกิล +${LAKE_SKILL} และได้ "ความหวัง" ${HOPE_TURNS} เทิร์น`);
      return ` → ${t.name}`;
    }
    if (tier === "ultimate") {
      engine.queueCutscene(p, "artoriaUlt"); // วีดีโอทุกครั้งที่กด
      const list = allies(engine, p);
      let cleansed = 0;
      for (const o of list) {
        engine.applyBuff(o, "artCaliburn", CALIBURN_ATK, CALIBURN_TURNS);
        engine.grantEvadeStack(o);
        if (engine.cleanseLatestDebuff(o)) cleansed++;
        engine.healHp(o, CALIBURN_HEAL);
      }
      engine.log(`⚔️ ${p.name} Around Caliburn — ${list.length} คน พลังโจมตี +${CALIBURN_ATK} (${CALIBURN_TURNS} เทิร์น) · หลบหลีก 1 ครั้ง · ฟื้นพลังชีวิต +${CALIBURN_HEAL}${cleansed ? ` · ล้างสถานะผิดปกติ ${cleansed} คน` : ""}`);
      return "";
    }
    return "";
  },

  // ---------- สกิลติดตัว หัวใจที่บริสุทธิ์ (ต้นเทิร์นที่ 3, 6, 9, …) ----------
  onRoundStartTick(engine, p) {
    if (!isArtoria(p) || !p.alive || engine.roundNumber % HEART_EVERY !== 0) return;
    engine.grantEvadeStack(p, 1);
    const healed = engine.healHp(p, HEART_HEAL);
    engine.log(`🤍 ${p.name} หัวใจที่บริสุทธิ์ — ได้หลบหลีก 1 ครั้ง (เทิร์นนี้) และฟื้นพลังชีวิต +${healed}`);
  },

  // ---------- ความหวัง: ออกหมัดโจมตีปกติ (ถูกหลบก็นับ) ฟื้นแต้มสกิล +1 ----------
  onAttack(engine, attacker) {
    if (!attacker || !((attacker.statuses.artHope || 0) > 0)) return;
    engine.addSkill(attacker, 1, "passive");
    engine.log(`✨ ${attacker.name} ความหวัง — โจมตีแล้วฟื้นแต้มสกิล +1`);
  },

  // ---------- ข้อมูลให้ client ----------
  skillLocks(engine, p) {
    const round = engine.roundNumber;
    return {
      basic: { cd: Math.max(0, (p.artCharmReady || 0) - round) },
      secondary: { cd: Math.max(0, (p.artLakeReady || 0) - round) },
    };
  },
  targetSkills: { secondary: { anyone: false } },
};
