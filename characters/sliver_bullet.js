// ============================================================
//  นักบินปริศนา (Silver Bullet) — ระดับง่าย · unique (เลือกได้ 1 คนต่อเกม) · id "sliver_bullet"
//    (สะกดตามชื่อโฟลเดอร์สื่อเดิม client/public/characters/sliver_bullet/)
//
//  ค่าพื้นฐาน: พลังชีวิต 3 · เกราะ 2 · แต้มสกิลตามปกติ · ไม่มีท่าไม้ตาย (ultimate: null แบบ ORT)
//  แขน (p.sliver.arm): เริ่มเกมมีแขน
//
//  สกิลพื้นฐาน เปลี่ยนชิ้นส่วน (ก่อนเปิดไพ่ · ไม่ทำให้ปรากฏตัว)
//    ไม่มีแขน: ราคา 2 -> ได้แขนใหม่ + ฟื้นพลังชีวิต 1 · มีแขน: ราคา 3 -> ฟื้นพลังชีวิต 2
//    ราคาสลับผ่าน dynamicSkillFor (useSkill + buildStateFor ใช้สูตรเดียวกัน -> ป้ายราคาบนปุ่มตรงกับที่หัก)
//    คลิป sliverReload ครั้งแรกต่อเกม · ครั้งต่อไป = การ์ดแจ้งเตือน + เสียง sliver_reload
//    ระหว่างซ่อนตัว: คลิป/การ์ด/เสียงส่งเฉพาะนักบิน + เพื่อนร่วมทีม (onlyFor) · ไม่มี skillFlash/log/roundSkills
//    (ปุ่มนี้ไม่ขึ้น skillFlash กลางแม้อยู่บนสนาม — มีการ์ด/คลิปของตัวเองแทน)
//  สกิลรอง Beam Magnum (4 · ก่อนเปิดไพ่ · ต้องมีแขน · เสียแขน) — เลือกศัตรู 1 คน
//    ปรากฏตัวก่อน (ป้าย/บันทึกจึงเปิดเผยได้) แล้วยิงดาเมจ 4 แบบ "ไอเทม" (_itemDamage แบบกระสุน Nursedessei —
//    ฮุคหลบ/ลดดาเมจจากสกิลที่ยกเว้นไอเทมจะไม่ทำงาน · ลดเกราะก่อน · ไม่บวกเปราะบาง เหมือนปืน)
//    คลิป sliverBeam ครั้งแรกต่อเกม · ครั้งต่อไปเสียง sliver_shot + skillFlash ปกติ
//  ตีปกติใช้เสียง sliver_shot (attackSoundOf)
//
//  สกิลติดตัว ซุ่มโจมตี (ซ่อนตัว) — เฉพาะ ffa/duo/trio (SE.RA.PH / Purge / Type Mercury = ปิด อยู่บนสนามตลอด)
//    เงื่อนไข (เช็คต้นเทิร์น + ทุกครั้งที่มีคนตาย): ffa = ผู้เล่นที่ยังรอด (รวมนักบิน) >= 3
//      · ทีม = เพื่อนร่วมทีมที่ยังรอด >= 2 (trio ที่เพื่อนครบ) · duo ไม่มีทางเข้าเงื่อนไข
//    ต้นเทิร์นที่เงื่อนไขเป็นจริง: ซ่อนตัวและ "สิง" ผู้เล่นสุ่ม (ffa = คนอื่นที่ยังรอด · ทีม = เพื่อนร่วมทีมที่ยังรอด)
//    ระหว่างซ่อน:
//      - ไม่อยู่ใน combat.alivePlayers() (offField) -> โจมตีปกติ/สกิลหมู่/สุ่มเป้า/การนับคนในสนามข้ามเขาทั้งหมด
//        โดยไม่ขึ้นบันทึก · เป้าที่ส่งมาตรงๆ (useSkill/ไอเทม) ถูกปัดที่ปากทาง (untargetable)
//        ระบบที่ต้องนับเขา (รอเปิดไพ่ · แต้มสกิล/เหรียญจบเทิร์น · จบเกม) ใช้ combat.livingPlayers()
//      - ไม่ได้ไพ่ต้นเทิร์น · จั่วไม่ได้ · ไม่ร่วมตัดสินรอบ (ไม่ชนะ/ไม่แพ้/ไม่รับดาเมจแพ้รอบ-ไพ่แตก)
//      - ปุ่ม "เตรียมพร้อม" ฝั่ง client ส่ง event lock เดิม -> p.locked = true (ความหมายเดียวกับเปิดไพ่) + readied
//        ติดสตั้น/หลับตอนต้นเทิร์น (locked อยู่แล้ว) = นับเป็นเตรียมพร้อม
//      - buildStateFor ตัดเขาออกจาก players ทั้งก้อนสำหรับผู้ชมที่ไม่ใช่ตัวเอง/เพื่อนร่วมทีม และกรองบรรทัดบันทึก
//        ที่มีชื่อเขาซึ่งเกิดระหว่างซ่อน (logHiddenFor) · hostId/hostName ส่งให้ตัวเอง+เพื่อนร่วมทีมเท่านั้น
//      - ใช้ไอเทมกับตัวเองไม่ปรากฏตัว
//    ปรากฏตัว (อยู่บนสนามจนจบเทิร์น · ต้นเทิร์นถัดไปซ่อนใหม่ถ้าเงื่อนไขยังจริง):
//      1. กด Beam Magnum  2. ใช้ไอเทมที่เล็งผู้เล่นอื่น (ปืน GUTS / Mark 42 ให้คนอื่น)
//      3. ช่วงจั่วไพ่ ร่างที่สิงโดนดาเมจจากสกิลหรือไอเทมโจมตี (ไม่นับสถานะ/ตีปกติ — combat.adjustIncomingDamage)
//      4. ร่างที่สิงตาย (ทุกสาเหตุ ทุกเฟส)  5. เงื่อนไขไม่เป็นจริงแล้ว (มีคนตาย)
//    ปรากฏตัวกลางเฟสจั่วไพ่: จั่วต่อจาก 0 ใบได้และร่วมตัดสินรอบตามปกติ — ยกเว้นกดเตรียมพร้อมไปแล้วตอนซ่อน
//      (sitOut: ไม่ร่วมตัดสินรอบนั้น ไม่รับดาเมจแพ้รอบ แต่ถูกเล็งได้)
//
//  สถานะทั้งหมดอยู่ที่ p.sliver (plain object -> ย้อนได้ผ่านสแนปช็อต Overload Force/ชิโด)
// ============================================================

const ID = "sliver_bullet";
const DIR = "/characters/sliver_bullet";
const IMG = {
  cover: `${DIR}/sliver_bullet_banagher.png`,
  base: `${DIR}/sliver_bullet.png`,
  skill1: `${DIR}/sliver_bullet_skill1.png`,
  skill2: `${DIR}/sliver_bullet_skill2.webp`,
};
const VIDEO = {
  reload: `${DIR}/sliver_bullet_skill1.mp4`,
  beam: `${DIR}/sliver_bullet_skill2.mp4`,
};
const SFX = { reload: "sliver_reload", shot: "sliver_shot" };
const CUT = { reload: "sliverReload", beam: "sliverBeam" };

const HP = 3;
const ARMOR = 2;
const COST_NO_ARM = 2;
const COST_ARM = 3;
const HEAL_NO_ARM = 1;
const HEAL_ARM = 2;
const BEAM_DMG = 4;
const FFA_MIN_ALIVE = 3;
const TEAM_MIN_MATES = 2;
const PASSIVE_MODES = ["ffa", "duo", "trio"];

const isPilot = (p) => !!p && p.characterId === ID;
function fresh() {
  return {
    arm: true,
    hidden: false,      // ซ่อนตัวอยู่ (ไม่อยู่บนสนาม)
    hostId: null,       // ร่างที่สิงอยู่
    readied: false,     // กดเตรียมพร้อมระหว่างซ่อน
    revealed: false,    // ปรากฏตัวกลางเทิร์นนี้ (ซ่อนตอนต้นเทิร์นแล้วออกมา)
    sitOut: false,      // ปรากฏตัวหลังกดเตรียมพร้อม = ไม่ร่วมตัดสินรอบนี้
    revealLogIdx: 0,    // ความยาว lastLog ตอนปรากฏตัว — บรรทัดก่อนหน้านี้ที่มีชื่อเขาถูกกรองจากศัตรู
    resolvedRound: 0,   // เลขรอบที่ resolveRound ทำงานไปแล้ว (แยกช่วงจั่วไพ่จากช่วงหลังเปิดไพ่)
  };
}
function st(p) { return p.sliver || (p.sliver = fresh()); }
function hidden(p) { return isPilot(p) && !!p.sliver && !!p.sliver.hidden && !!p.alive; }

function passiveOn(engine) {
  return PASSIVE_MODES.includes(engine.gameMode) && !engine.mercuryActive() && !engine.purgeActive();
}
function living(engine) {
  return Object.values(engine.players).filter((o) => o.alive && !engine.isOrt(o));
}
function teammates(engine, p) {
  if (!engine.teamModeActive() || !p.teamId) return [];
  return Object.values(engine.players).filter((o) => o.id !== p.id && o.teamId && o.teamId === p.teamId);
}
function conditionHolds(engine, p) {
  if (!passiveOn(engine) || !p.alive) return false;
  if (engine.teamModeActive()) return teammates(engine, p).filter((o) => o.alive).length >= TEAM_MIN_MATES;
  return living(engine).length >= FFA_MIN_ALIVE;
}
function hostCandidates(engine, p) {
  if (engine.teamModeActive()) return teammates(engine, p).filter((o) => o.alive);
  return living(engine).filter((o) => o.id !== p.id);
}
// ผู้ชมคนนี้เห็นความลับของนักบิน (ร่างที่สิง/การซ่อนตัว) ไหม — ตัวเอง + เพื่อนร่วมทีม
function insider(engine, pilot, viewer) {
  if (!viewer) return false;
  if (viewer.id === pilot.id) return true;
  return engine.teamModeActive() && !!pilot.teamId && viewer.teamId === pilot.teamId;
}
function audience(engine, p) { return [p.id, ...teammates(engine, p).map((o) => o.id)]; }
function pilots(engine) { return Object.values(engine.players).filter(isPilot); }
function drawPhase(engine, s) {
  return s.resolvedRound !== engine.roundNumber && (engine.gameState === "PLAYING" || engine.gameState === "CUTSCENE");
}

function reveal(engine, p) {
  const s = st(p);
  if (!s.hidden) return false;
  s.hidden = false;
  s.hostId = null;
  s.revealed = true;
  s.revealLogIdx = engine.logLength;
  if (s.readied) s.sitOut = true; // กดเตรียมพร้อมไปแล้ว: ถูกเล็งได้ แต่ไม่ร่วมตัดสินรอบนี้
  if (p.alive) engine.log(`🛩️ ${p.name} ปรากฏตัวบนสนาม!`);
  return true;
}
// ต้นเทิร์น/มีคนตาย: เงื่อนไขไม่จริงแล้ว หรือร่างที่สิงตาย -> ปรากฏตัว
function recheck(engine) {
  for (const p of pilots(engine)) {
    const s = st(p);
    if (!s.hidden) continue;
    const host = engine.players[s.hostId];
    if (!p.alive) { s.hidden = false; s.hostId = null; continue; }
    if (!host || !host.alive || !conditionHolds(engine, p)) reveal(engine, p);
  }
}

module.exports = {
  id: ID,
  IMG, VIDEO, SFX, CUT, HP, ARMOR, COST_NO_ARM, COST_ARM, HEAL_NO_ARM, HEAL_ARM, BEAM_DMG,
  FFA_MIN_ALIVE, TEAM_MIN_MATES,
  isPilot, hidden, conditionHolds, hostCandidates, reveal,

  maxHp() { return HP; },
  maxArmor() { return ARMOR; },
  resetCombat(p) { p.sliver = isPilot(p) ? fresh() : null; },

  // ---------- กติกาสนาม ----------
  // combat.alivePlayers() ข้ามคนที่ซ่อนตัวอยู่ (อยู่นอกสนาม)
  offField(p) { return hidden(p); },
  // เป้าที่ส่งมาตรงๆ (สกิล/ไอเทม): เล็งนักบินที่ซ่อนอยู่ไม่ได้ ยกเว้นตัวเขาเอง
  untargetable(user, t) { return hidden(t) && (!user || user.id !== t.id); },
  // ไม่ได้ไพ่ต้นเทิร์น / จั่วไม่ได้
  noCards(p) { return hidden(p); },
  // ไม่ร่วมตัดสินรอบ (ซ่อนอยู่ หรือปรากฏตัวหลังกดเตรียมพร้อม)
  sitsOutRound(p) { return isPilot(p) && !!p.sliver && (!!p.sliver.hidden || !!p.sliver.sitOut); },

  // ---------- ต้นเทิร์น ----------
  //  ก่อนลูปแจกไพ่ของ dealRound — ตัดสินว่าซ่อนไหม + สุ่มร่างใหม่ทุกเทิร์น
  onRoundStart(engine) {
    for (const p of pilots(engine)) {
      const s = st(p);
      s.readied = false; s.revealed = false; s.sitOut = false; s.revealLogIdx = 0; s.resolvedRound = 0;
      s.hidden = false; s.hostId = null;
      if (!p.alive || !conditionHolds(engine, p)) continue;
      const pool = hostCandidates(engine, p);
      if (!pool.length) continue;
      s.hidden = true;
      s.hostId = pool[Math.floor(Math.random() * pool.length)].id;
    }
  },
  //  หลังลูปแจกไพ่: ร่างที่สิงตาย/เงื่อนไขหายระหว่างผลต้นเทิร์น -> ปรากฏตัว (ไม่มีไพ่ จั่วต่อจาก 0)
  //  ติดสตั้น/หลับ (locked แล้ว) ระหว่างซ่อน = นับเป็นเตรียมพร้อม
  onRoundStartAfterLoop(engine) {
    for (const p of pilots(engine)) {
      const s = st(p);
      if (s.hidden && p.locked) s.readied = true;
    }
    recheck(engine);
  },
  onResolveRound(engine) {
    for (const p of pilots(engine)) st(p).resolvedRound = engine.roundNumber;
  },
  // เตรียมพร้อม = event lock เดิม (draw.lock ตั้ง p.locked = true ให้แล้ว)
  onLock(engine, p) { if (hidden(p)) st(p).readied = true; },
  onDeath(engine) { recheck(engine); },
  // ร่างที่สิงรับดาเมจจากสกิล/ไอเทมโจมตีช่วงจั่วไพ่ (เรียกจาก combat.adjustIncomingDamage หลังคิดค่าสุดท้าย)
  onDamageTaken(engine, victim, n, isNormalAttack) {
    if (!(n > 0) || isNormalAttack || !victim || victim._statusDamage) return;
    const src = engine.effectSourceId;
    if (!src || src === victim.id) return;
    for (const p of pilots(engine)) {
      const s = st(p);
      if (s.hidden && s.hostId === victim.id && drawPhase(engine, s)) reveal(engine, p);
    }
  },
  // ระหว่างซ่อน: ผู้ที่เห็นผลของการกระทำส่วนตัว (ไอเทมใส่ตัวเอง) = ตัวเอง + เพื่อนร่วมทีม · ไม่ซ่อน = null (ทุกคน)
  privateAudience(engine, p) { return hidden(p) ? audience(engine, p) : null; },
  // ใช้ไอเทมที่เล็งผู้เล่นอื่น -> ปรากฏตัวก่อนไอเทมทำงาน
  onTargetedAction(engine, p, targetId) {
    if (hidden(p) && targetId && targetId !== p.id) reveal(engine, p);
  },
  // ตาข่าย: ดาเมจจากคนอื่นที่หลุดมาถึงตัวระหว่างซ่อน (เส้นทางที่ไม่ผ่าน alivePlayers) = ไม่มีผล
  adjustIncomingDamage(engine, p, n) {
    if (hidden(p) && engine.effectSourceId && engine.effectSourceId !== p.id) return 0;
    return n;
  },

  // ---------- สกิล ----------
  dynamicSkillFor(p, ch, tier) {
    if (!isPilot(p) || tier !== "basic" || !ch.basic) return ch[tier];
    return { ...ch.basic, cost: st(p).arm ? COST_ARM : COST_NO_ARM };
  },
  pickTarget(engine, p, targets) {
    const id = Array.isArray(targets) ? targets[0] : null;
    return engine.attackableTargets(p.id).find((t) => t.id === id) || null;
  },
  canUseSkill(engine, p, tier, targets) {
    if (!isPilot(p)) return true;
    if (tier === "basic") return true;
    if (tier === "secondary") return st(p).arm && !!this.pickTarget(engine, p, targets);
    return false;
  },
  // ระหว่างซ่อน: สกิลพื้นฐานเงียบสนิท (ไม่เข้า roundSkills / ORT / skillFlash)
  silentSkill(p, tier) { return tier === "basic" && hidden(p); },
  // สกิลพื้นฐานไม่ขึ้น skillFlash กลางเลย (มีคลิป/การ์ดแจ้งเตือนของตัวเอง)
  ownNotice(p, tier) { return isPilot(p) && tier === "basic"; },
  applyInstantSkill(engine, p, tier, targets) {
    if (!isPilot(p)) return "";
    const s = st(p);
    if (tier === "basic") {
      const secret = hidden(p);
      const onlyFor = secret ? audience(engine, p) : undefined;
      const hadArm = s.arm;
      s.arm = true;
      const healed = engine.healHp(p, hadArm ? HEAL_ARM : HEAL_NO_ARM);
      if (!p.cutsceneShown) p.cutsceneShown = {};
      if (!p.cutsceneShown[CUT.reload]) {
        p.cutsceneShown[CUT.reload] = true;
        engine.queueCutscene(p, CUT.reload, onlyFor);
      } else {
        engine.notifyTransform(p, CUT.reload, onlyFor);
        engine.sfx(SFX.reload, onlyFor);
      }
      if (!secret) engine.log(`🔧 ${p.name} เปลี่ยนชิ้นส่วน — ${hadArm ? "" : "ได้แขนใหม่ · "}ฟื้นพลังชีวิต +${healed}`);
      return "";
    }
    if (tier === "secondary") {
      const t = this.pickTarget(engine, p, targets);
      reveal(engine, p); // ปรากฏตัวก่อนผลและป้าย -> ป้ายสกิลเปิดเผยได้
      s.arm = false;
      if (!p.cutsceneShown) p.cutsceneShown = {};
      if (!p.cutsceneShown[CUT.beam]) { p.cutsceneShown[CUT.beam] = true; engine.queueCutscene(p, CUT.beam); }
      else engine.sfx(SFX.shot);
      if (!t || !t.alive) return "";
      const before = (t.hp || 0) + (t.armor || 0);
      engine.withEffectSource(p, () => {
        t._itemDamage = true; // ดาเมจแบบไอเทม (เหมือนกระสุน Nursedessei) — ฮุคหลบสกิลที่ยกเว้นไอเทมไม่ทำงาน
        try { engine.dealMixed(t, BEAM_DMG); } finally { t._itemDamage = false; }
        engine.resolveDamageAftermath(t);
      });
      const dealt = Math.max(0, before - ((t.hp || 0) + (t.armor || 0)));
      engine.log(`🔫 ${p.name} Beam Magnum → ${t.name} -${dealt} (เสียแขน)${t.alive ? "" : " — ตกรอบ!"}`);
      return ` → ${t.name}`;
    }
    return "";
  },
  attackSound(p) { return isPilot(p) ? SFX.shot : undefined; },

  // ---------- ข้อมูลให้ client ----------
  //  insider (ตัวเอง + เพื่อนร่วมทีม) เห็นร่างที่สิง · คนอื่นเห็นเฉพาะตอนเขาอยู่บนสนาม (ไม่มี host)
  publicState(engine, p, viewer) {
    if (!isPilot(p)) return undefined;
    const s = st(p);
    const inside = insider(engine, p, viewer);
    const host = inside && s.hidden ? engine.players[s.hostId] : null;
    return {
      hidden: inside ? !!s.hidden : false,
      hostId: host ? host.id : null,
      hostName: host ? host.name : null,
      arm: !!s.arm,
      readied: inside ? !!s.readied : false,
      revealed: !!s.revealed,
      sitOut: !!s.sitOut,
      basicCost: s.arm ? COST_ARM : COST_NO_ARM,
    };
  },
  // ผู้ชมคนนี้ต้องไม่เห็นนักบินคนนี้เลย (ซ่อนอยู่ + ไม่ใช่ตัวเอง/เพื่อนร่วมทีม)
  //  จบเกม (GAMEOVER) = เปิดเผยทุกคน ให้หน้าประกาศผลมีเขาครบ
  hiddenFrom(engine, p, viewer) { return engine.gameState !== "GAMEOVER" && hidden(p) && !insider(engine, p, viewer); },
  // บันทึกที่ผู้ชมคนนี้เห็นได้: ตัดบรรทัดที่มีชื่อนักบินซึ่งเกิดระหว่างที่เขาซ่อนอยู่ (ก่อนปรากฏตัว)
  filterLog(engine, lines, viewer) {
    let out = lines;
    if (engine.gameState === "GAMEOVER") return out;
    for (const p of pilots(engine)) {
      const s = p.sliver;
      if (!s || insider(engine, p, viewer) || !p.name) continue;
      const cut = s.hidden ? Infinity : s.revealed ? s.revealLogIdx : 0;
      if (!cut) continue;
      out = out.filter((line, i) => i >= cut || typeof line !== "string" || !line.includes(p.name));
    }
    return out;
  },
  skillLocks(engine, p) {
    if (!isPilot(p)) return undefined;
    return {
      basic: { locked: false },
      secondary: { locked: !st(p).arm },
      ultimate: { locked: true },
    };
  },
};
