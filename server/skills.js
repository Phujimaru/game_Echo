// ใช้สกิล (useSkill) + Bard + Locacaca + Overhaul
// export ก่อน require: ไฟล์ใน server/ require วนกันเอง — function declaration ถูก hoist จึงพร้อมใช้ตั้งแต่บรรทัดแรก
Object.assign(module.exports, {
  bardPerform, useSkill, resolveLoca, answerLoca, bardTarget, kaiOverhaul,
});

const { CHAR_BY_ID } = require("../characters");
const CHAR_HOOKS = require("../characters/index");
const {
  SPELLBURDEN_MAX, statusAmtOf, SOFT_DEBUFF_STEP, tickCurseOnSkill, numbFizzles,
} = require("../characters/_universal_status");
const Journey = require("../characters/_journey");
const Seraph = require("../seraph");
const { io } = require("./app");
const {
  BARD_CRIMSON_IMG, BARD_DIM_NOTES_PER_TURN, BARD_JADE_IMG, BARD_NOTES_PER_TURN, BARD_NOTE_COST,
  BARD_NOTE_FREE_CHANCE, BARD_SECTION_MAX, BARD_SONGS, BARD_SOUL_PERFORM_DMG, BARD_SOUL_TARGETS,
  DOOM_CRUCIBLE_CHARGE_NEED, DOOM_WEAPONS, MAX_HP, OGURI_GOLD_MAX, OGURI_TRAIN_ENERGY_COST,
  OGURI_ULT_CHARGE_COST, ORT_ID, SKILL_COST_MAX,
} = require("./constants");
const match = require("./match");
const { engine } = require("./engine");
const characterRules = require("./characterRules");
const combat = require("./combat");
const cutscene = require("./cutscene");
const dayNight = require("./dayNight");
const cardDeck = require("./deck");
const draw = require("./phases/draw");
const lobby = require("./lobby");
const mercury = require("./modes/mercury");
const purge = require("./modes/purge");
const timers = require("./timers");
const view = require("./view");

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
    const pool = combat.alivePlayers().filter((o) => song.allowSelf || o.id !== p.id);
    if (pool.length <= song.need) {
      const picked = pool.slice(0, song.need).map((o) => o.id);
      match.lastLog.push(`🎼 ${p.name} ประพันธ์เพลง ${song.name} สำเร็จ — เป้าหมายมีเพียงพอดี บทเพลงเลือกให้อัตโนมัติ`);
      bardPerform(p, pattern, picked, live);
      return;
    }
    p.bardPending = { pattern, name: song.name, need: song.need, allowSelf: !!song.allowSelf };
    match.lastLog.push(`🎼 ${p.name} ประพันธ์เพลง ${song.name} สำเร็จ — กำลังเลือกเป้าหมาย (ไม่เลือกก่อนเปิดไพ่ = สุ่มเป้าหมาย)`);
    io.emit("skillFlash", { name: `🎼 ${song.name} — กำลังเลือกเป้าหมาย`, img: song.song === "crimson" ? BARD_CRIMSON_IMG : BARD_JADE_IMG, by: p.name, color: lobby.colorOf(p) });
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
  CHAR_HOOKS.bard.applyBardSong(engine, p, pattern, targets);
  if (isCrimson) p.bloodSection = Math.min(BARD_SECTION_MAX, (p.bloodSection || 0) + 1);
  else p.soulSection = Math.min(BARD_SECTION_MAX, (p.soulSection || 0) + 1);
  combat.addSkill(p, 1); // บรรเลงทำนองสำเร็จ ได้รับพลังงาน +1
  // เสียงบรรเลง: สาย Crimson = 01 / สาย Jade = 02
  io.emit("bardSfx", { kind: "perform", sound: isCrimson ? 1 : 2 });
  io.emit("skillFlash", { name: `🎼 บรรเลงทำนอง — ${song.name}`, img: isCrimson ? BARD_CRIMSON_IMG : BARD_JADE_IMG, by: p.name, color: lobby.colorOf(p) });
  match.lastLog.push(`🎼 ${p.name} บรรเลงทำนอง ${song.name}! พลังงาน +1 (โลหิต ${p.bloodSection || 0}/${BARD_SECTION_MAX} · วิญญาณ ${p.soulSection || 0}/${BARD_SECTION_MAX})`);
  // มิติมายาบรรเลงวิญญาณ (patch 2.0.6): ทุกครั้งที่เกิดการบรรเลงทำนอง
  //  — คีตกวีทำดาเมจ 1 แบบสุ่มกับผู้เล่น 2 คน จนกว่ามิติจะสิ้นสุด
  if ((p.statuses.soulDim || 0) > 0) {
    const pool = combat.alivePlayers().filter((t) => t.id !== p.id);
    const hits = [];
    while (hits.length < BARD_SOUL_TARGETS && pool.length) {
      hits.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    }
    for (const t of hits) {
      combat.dealMixed(t, BARD_SOUL_PERFORM_DMG);
      if (t.alive && t.hp <= 0) t.hp = 1; // มิติวิญญาณ: เป้าหมายไม่สามารถถูกฆ่าได้จากเอฟเฟกต์นี้ (เลือดค้างที่ 1)
      combat.maybeBeatSave(t);
      combat.maybeBeatMode(t);
      characterRules.maybeWakeKotone(t);
      t.wasAttacked = true;
    }
    if (hits.length) match.lastLog.push(`💚🌑 มิติมายาบรรเลงวิญญาณ — ทำนองของ ${p.name} บาดวิญญาณ ${hits.map((t) => t.name).join(", ")} -${BARD_SOUL_PERFORM_DMG} (ตายไม่ได้จากเอฟเฟกต์นี้)`);
  }
  CHAR_HOOKS.bard.maybeBardDim(engine, p, live);
}
//  ท่าที่ "เล่นวีดีโอก่อน แล้วค่อยลงผล" (เข้าเฟส CUTSCENE) ยังไม่สวนตอนนี้ — pausePlayingForCutscene สวนให้หลังผลลงจริง
function useSkill(id, tier, targets, item) {
  // จอห์นนี่: บริบทของการกด 1 ครั้ง — หมุนวนทอย "การหมุนย้อนกลับ" + Slow Dancer ที่กันสกิลนี้ (ปิดใน finally)
  const johnnyCtx = CHAR_HOOKS.johnny.beginUse(engine, match.players[id], targets);
  try {
    const res = combat.withExplicitTargets(id, Array.isArray(targets) ? targets : [], () => useSkillCore(id, tier, targets, item));
    if (match.gameState !== "CUTSCENE") draw.flushOrtCounters();
    mercury.checkOrtEarlyWin();
    return res;
  } finally { CHAR_HOOKS.johnny.endUse(johnnyCtx); }
}
function useSkillCore(id, tier, targets, item) {
  const p = match.players[id];
  if (!match.effectSourceId && p) return combat.withEffectSource(p, () => useSkill(id, tier, targets, item));
  if (!p || !p.alive) return;
  if (match.gameState !== "PLAYING") return;
  if (!["basic", "secondary", "ultimate"].includes(tier)) return;
  // Purge: ผู้ชมกดสกิลไม่ได้ และเล็งผู้ชมไม่ได้
  if (purge.benched(p) || (Array.isArray(targets) && targets.some((t) => purge.benched(match.players[t])))) return;
  // ORT สกิลติดตัว 1: ช่องสกิลนี้ "ข้อมูลสูญหาย" ในเทิร์นนี้ — กดไม่ได้
  if (CHAR_HOOKS.ort.skillErased(engine, p, tier)) return;
  // ---------- SE.RA.PH (SERAPH_MOONCELL.md §5 + §3) ----------
  //  วันที่ 1-6: ไม่มีสกิลเลย · วันที่ 7: ต้องปลดล็อก tier นั้นด้วยระดับทักษะก่อน
  if (Seraph.active()) {
    if (Seraph.noCombat()) return;
    if (!Seraph.tierUnlocked(p, tier)) return;
    if (p.scSpectator) return; // ผู้ชมกดอะไรไม่ได้
  }
  // ผู้วิงวอน (patch 3.4): คนที่ติด "ลูกแกะน้อยรู้แจ้ง" เล็งผู้วิงวอนด้วยสกิลไม่ได้เลย
  //  กันที่ปากทางจุดเดียว จึงครอบคลุมทุกท่าของทุกตัวละครที่ส่ง targets มา โดยไม่ต้องแก้ prepareXTarget ทีละตัว
  if (Array.isArray(targets) && targets.some((tid) => CHAR_HOOKS.the_supplicant.targetBlocked(p, match.players[tid]))) return;
  // นักบินปริศนา: ซ่อนตัวอยู่ = เล็งด้วยสกิลไม่ได้เลย (ยกเว้นตัวเขาเอง) — ปัดที่ปากทางแบบเดียวกับผู้วิงวอน
  if (Array.isArray(targets) && targets.some((tid) => CHAR_HOOKS.sliver_bullet.untargetable(p, match.players[tid]))) return;
  // ไททัน (เปิดม่าน): เทิร์นที่ล่อเป้า สกิลที่เล็งศัตรูต้องเล็งไททันเท่านั้น
  if (CHAR_HOOKS.titan.skillTargetBlocked(engine, p, targets)) return;
  // คู่แฝดฮิซากาว่า — สกิลพื้นฐาน 1 (สลับตัว/ชุบแฝด) คือ "ทางหนี" ประจำตัว: อะไรก็ตามที่ทำให้กดสกิลไม่ได้
  //  (สตั้น, หลับไหล, หอกลองกินัส, MOON*CELL ฯลฯ) จะไม่มีผลกับช่องนี้ช่องเดียว เพื่อให้ยังหนีไปคุมแฝดอีกคนได้เสมอ
  //  — แต่ยังต้องอยู่ในเฟสจั่วการ์ด และยังจำกัดสลับ 1 ครั้ง/เทิร์นตามเดิม (hisakawaSwitchedRound)
  const isHisakawaEscape = p.characterId === "hisakawa_sister" && tier === "basic";
  if (p.locked && !isHisakawaEscape) return;
  // MOON*CELL (คิชินามิ ฮาคุโนะ): สกิลทั้งหมดของทุกคนใช้ไม่ได้เลย (รวมของฮาคุโนะเจ้าของท่าเองด้วย — เหลือแค่สกิลติดตัว)
  if (CHAR_HOOKS.conner.skillBlocked(engine, p)) return; // คอนเนอร์: ระหว่างการไล่ล่า ทุกคนกดสกิลไม่ได้ (รวมคอนเนอร์กับเป้าหมาย)
  // ไบรอัน: ระหว่างการแข่ง ทุกคนกดสกิลไม่ได้ — ยกเว้น N2O ของไบรอันเอง (สเปคระบุว่าไม่สนกฎของท่าไม้ตาย 1)
  if (CHAR_HOOKS.brian.skillBlocked(engine, p, tier)) return;
  // Clock Up: คนอื่นกดสกิลไม่ไ้ด — ยกเว้นไรเดอร์ด้วยกันที่กด Clock Up ของตัวเองสวน (สกิลติดตัว Zect ข้อ 3)
  if (CHAR_HOOKS.daisuke.skillBlocked(engine, p, tier)) return;
  // ดิโอ: ระหว่าง THE WORLD กดได้แค่เจ้าของท่า · ระหว่าง Last stand ไม่มีใครกดสกิลได้ (แบบการแข่งของไบรอัน)
  if (CHAR_HOOKS.dio.skillBlocked(engine, p, tier)) return;
  if ((p.statuses.phenexTaunt || 0) > 0) return; // ไม่อยากให้ใครต้องเจ็บปวด (ริต้า เบอร์นัล): ระหว่างล่อเป้ากดสกิลไม่ได้เลย
  if (tier === "ultimate" && (p.statuses.phenexBanUlt || 0) > 0) return; // อย่าอยู่เลย แกน่ะ! (ริต้า เบอร์นัล): ถูกแบนท่าไม้ตายชั่วคราว
  // ---------- Bard : คีตกวี — เติมโน้ตประพันธ์เพลง (ช่องที่ 3 ไม่ใช่สกิล กดใช้ไม่ได้) ----------
  if (p.characterId === "bard") {
    if (tier === "ultimate") return; // ช่องประพันธ์เพลง — ไม่ใช่ปุ่มสกิล
    if ((p.statuses.noskill || 0) > 0) return;
    if (p.bardPending) return; // ต้องเลือกเป้าหมายบทเพลงที่ค้างอยู่ก่อน
    // จำกัด 2 โน้ตต่อเทิร์น (patch 2.0.5) — ระหว่างมิติมายาบรรเลง (โลหิต/วิญญาณ) ไม่ติดลิมิต 2
    //  แต่กดสกิลได้สูงสุด 6 ครั้งต่อเทิร์น (patch 2.0.8)
    const dimOn = (p.statuses.soulDim || 0) > 0 || (p.statuses.bloodDim || 0) > 0;
    if ((p.bardNotesUsed || 0) >= (dimOn ? BARD_DIM_NOTES_PER_TURN : BARD_NOTES_PER_TURN)) return;
    // กระแสเวท / ภาระเวท (patch 2.0.8) มีผลกับค่าโน้ตด้วย
    const noteCost = Math.min(SKILL_COST_MAX, Math.max(0, BARD_NOTE_COST - statusAmtOf(p, "spellflow")) + Math.min(SPELLBURDEN_MAX, statusAmtOf(p, "spellburden")));
    const noteBless = noteCost > 0 && (p.statuses.freecast || 0) > 0; // การ์ดราชินี: ใช้สกิลไม่เสียแต้ม 1 ครั้ง
    if (!noteBless && p.skillPoints < noteCost) return;
    const lucky = Math.random() < BARD_NOTE_FREE_CHANCE; // 15% ไม่เสียพลังงาน (พรสวรรค์)
    let free = lucky || noteCost === 0;
    if (!free) {
      if (noteBless) {
        p.statuses.freecast--;
        if (p.statuses.freecast <= 0) delete p.statuses.freecast;
        match.lastLog.push(`👸 ${p.name} การ์ดราชินี — เติมโน้ตนี้โดยไม่เสียพลังงาน`);
        free = true;
      } else {
        p.skillPoints -= noteCost;
      }
    }
    CHAR_HOOKS.ort.onSkillUsed(engine, p, tier); // ORT สกิลติดตัว 1: โน้ตแรกของเทิร์นก็นับเป็นสกิลแรก
    p.bardNotesUsed = (p.bardNotesUsed || 0) + 1;
    const note = tier === "basic" ? "R" : "J";
    p.bardNotes = p.bardNotes || [];
    p.bardNotes.push(note);
    io.emit("bardSfx", { kind: "note", idx: p.bardNotes.length }); // เสียงเติมโน๊ตตามช่องที่ 1-3
    io.emit("skillFlash", {
      name: `${note === "R" ? "Crimson ❤️" : "Jade 💚"} — โน้ตช่องที่ ${p.bardNotes.length}/3${dimOn ? " (มิติมายาบรรเลง)" : ""}${free ? " (พรสวรรค์ ไม่เสียพลังงาน)" : ""}`,
      img: note === "R" ? BARD_CRIMSON_IMG : BARD_JADE_IMG,
      by: p.name, color: lobby.colorOf(p),
    });
    match.lastLog.push(`🎼 ${p.name} เติมโน้ต${note === "R" ? "ทำนองแห่งโลหิต ❤️" : "ทำนองแห่งวิญญาณ 💚"} (ช่องที่ ${p.bardNotes.length}/3)${free ? " — ไม่เสียพลังงาน" : ""}`);
    if (p.bardNotes.length >= 3) bardCompose(p, true);
    // คอนเนอร์ RK800 (สกิลติดตัว 1 สืบสวน): การเติมโน้ตคือ "การกดสกิล" ของคีตกวี (มีแค่พื้นฐาน/รอง)
    //  จึงนับความเครียด +1 ต่อครั้งเหมือนตัวละครอื่น — ช่องนี้ return ก่อนถึงจุดนับหลักของ useSkill()
    CHAR_HOOKS.conner.onSkillUsed(engine, p);
    // วีดีโอสวนกลับที่ค้างคิว (Wonder of U ซาโตรุ — บทเพลงเล็งใส่ซาโตรุ) เล่นทันทีช่วงจั่วการ์ด
    if (match.gameState === "PLAYING" && match.cutsceneQueue.length) cutscene.pausePlayingForCutscene();
    view.broadcastState();
    draw.checkAllLocked();
    return;
  }
  const ch = CHAR_BY_ID[p.characterId];
  let skill = ch && ch[tier];
  // เรียวกิ ชิกิ: ท่าไม้ตายตามที่เลือกไว้ตอนเลือกตัวละคร (ฉันมองเห็นมันแล้ว / ความตายที่โรยรา)
  if (ch && ch.id === "shiki" && tier === "ultimate") {
    skill = (p.shikiUlt === "wither") ? ch.ultimate2 : ch.ultimate;
  }
  // ริต้า เบอร์นัล (patch 2.1.6): ระหว่างฝืนใช้งาน NTD-Sytem (ชั่วคราวหรือถาวรหลังสกิลติดตัว 1) — สกิลรองเปลี่ยนเป็นสกิลรอง 2
  //  หลังเกิดใหม่ (สกิลติดตัว 1 ทำงานแล้ว) — ท่าไม้ตายเปลี่ยนเป็นท่าไม้ตาย 2 ถาวร
  if (ch && ch.id === "phenex") {
    const ntdOn = (p.statuses.phenexNtd || 0) > 0 || p.phenexNtdPermanent;
    if (tier === "secondary") skill = ntdOn ? ch.secondary2 : ch.secondary;
    if (tier === "ultimate") skill = p.phenexReborn ? ch.ultimate2 : ch.ultimate;
  }
  // ไรโด ฮิคารุ (patch 2.1.3): ระหว่างร่าง Ginga หรือ Ginga Strium — สกิลพื้นฐานเปลี่ยนเป็น UPG! (basic2)
  //  ระหว่างร่าง Ginga Strium (ท่าไม้ตาย) — สกิลรองเปลี่ยนเป็นลำแสงสโตเรียม (secondary2)
  if (ch && ch.id === "hikaru") {
    if (tier === "basic") skill = ((p.statuses.ginga || 0) > 0 || (p.statuses.gingastrium || 0) > 0) ? ch.basic2 : ch.basic;
    if (tier === "secondary") skill = (p.statuses.gingastrium || 0) > 0 ? ch.secondary2 : ch.secondary;
  }
  // โอกูริ แคป (Rework): ยุคทองครบ 3 + Stamina ชาร์จ 75 ขึ้นไป = ท่าไม้ตายกลายเป็น Ashen Trail: Cinderella Gray
  if (ch && ch.id === "oguri") {
    if (tier === "ultimate") skill = characterRules.oguriAshenReady(p) ? ch.ultimate2 : ch.ultimate;
  }
  // ไบรอัน: ระหว่าง "การแข่งที่มีเดิมพัน" ช่องท่าไม้ตายกลายเป็น N2O (0 แต้ม แต่เทน้ำมันทั้งถัง)
  if (ch && ch.id === "brian" && tier === "ultimate" && CHAR_HOOKS.brian.n2oSlot(engine, p)) skill = ch.ultimate2;
  // โปรดิวเซอร์: ช่องแรกสลับ "สลับไอดอล"/"ชุบไอดอล" · ช่องท่าไม้ตายสลับตามไอดอล 5 คน + luminous
  if (ch && ch.id === "producer_lumi") skill = CHAR_HOOKS.producer_lumi.dynamicSkillFor(p, ch, tier);
  // ไดจิ: ช่องพื้นฐาน/รองเปลี่ยนชื่อ-ภาพตามการ์ดไซเบอร์ที่ถืออยู่
  if (ch && ch.id === "daichi") skill = CHAR_HOOKS.daichi.dynamicSkillFor(p, ch, tier);
  if (ch && ch.id === "escanor") {
    skill = CHAR_HOOKS.escanor.prepareSkill(engine, p, tier, targets);
    if (!skill) return;
  }
  if (ch && ch.id === "hisakawa_sister") {
    skill = CHAR_HOOKS.hisakawa_sister.dynamicSkillFor(p, ch, tier);
  }
  if (ch && ch.id === "ignis") {
    skill = CHAR_HOOKS.ignis.dynamicSkillFor(p, ch, tier);
  }
  // สึงาชิ ทาคุโตะ (patch 2.2 new): Apprivoise! ทำงานแล้ว — สกิลพื้นฐานเปลี่ยนเป็น Star Sword Emeraude ถาวร
  if (ch && ch.id === "takuto" && tier === "basic" && (p.statuses.apprivoise || 0) > 0) skill = ch.basic2;
  // patch 2.2.5: กันตาย (สกิลติดตัว 1) เคยทำงานไปแล้ว — ท่าไม้ตายเปลี่ยนเป็นร่วมเดินทางไปกับฉันเถอะถาวร (แทนพิชิตแสงดาว)
  if (ch && ch.id === "takuto" && tier === "ultimate" && p.beatSaved) skill = ch.ultimate2;
  // โมโรโบชิ ดัน (patch 2.8 new): สกิลติดตัว "ครูฝึกสุดเหี้ยม" — เป้าหมาย "จงหลบแต่อย่าหนี" แพ้แต้มติดกัน 2 ครั้ง
  //  (ไม่นับไพ่แตก) -> ช่องท่าไม้ตายกลายเป็น "อย่าให้ฉันต้องเฆี่ยนตี" สำหรับเทิร์นนั้น (publicState คิดสูตรเดียวกัน)
  if (ch && ch.id === "dan") skill = CHAR_HOOKS.dan.dynamicSkillFor(engine, p, ch, tier);
  // แบทแมน (patch 3.1): ขึ้นรถแบทโมบิลแล้ว — ทั้งสามช่องเปลี่ยนเป็นเวอร์ชันรถ
  if (ch && ch.id === "bat_ben") skill = CHAR_HOOKS.bat_ben.dynamicSkillFor(p, ch, tier);
  // Bamboo-Hatted Kim: Resentful Scabbard ครบ 80 (ร่าง Awake) — ท่าไม้ตายเป็นท่าที่ 2 (buildStateFor คิดสูตรเดียวกัน)
  if (ch && ch.id === "kim") skill = CHAR_HOOKS.kim.dynamicSkillFor(p, ch, tier);
  // สไตรเกอร์ ยูเรก้า: เตาปฏิกรณ์ (พลังชีวิต <= 7) — ท่าไม้ตายเป็น "เป็นเกียรติมากครับ" (buildStateFor คิดสูตรเดียวกัน)
  if (ch && ch.id === "striker") skill = CHAR_HOOKS.striker.dynamicSkillFor(p, ch, tier);
  // ไททัน: ระหว่างบทเพลงที่ไม่อาจลืม สกิลรอง/ท่าไม้ตายเป็น Vigorous Rising Sun / Triumphant (buildStateFor คิดสูตรเดียวกัน)
  if (ch && ch.id === "titan") skill = CHAR_HOOKS.titan.dynamicSkillFor(p, ch, tier);
  // คอเซ็ตต์: ปุ่มเปลี่ยนร่างสลับภาพตามร่าง · ระหว่างบทเพลง สกิลรอง/ไม้ตายเป็น Maestro / Destiny
  if (ch && ch.id === "cosette") skill = CHAR_HOOKS.cosette.dynamicSkillFor(p, ch, tier);
  // จอห์นนี่: สกิลรอง/ท่าไม้ตายตามร่าง Act 1-4 · ราคา Tusk Evo +1 ต่อ Pre-Awaken (buildStateFor คิดสูตรเดียวกัน)
  if (ch && ch.id === "johnny") skill = CHAR_HOOKS.johnny.dynamicSkillFor(p, ch, tier);
  // ดิโอ: ระหว่าง THE WORLD ปุ่มทั้งสามเป็นชุดร่างหยุดเวลา (buildStateFor คิดสูตรเดียวกัน)
  if (ch && ch.id === "dio") skill = CHAR_HOOKS.dio.dynamicSkillFor(p, ch, tier);
  // นักบินปริศนา: ราคาสกิลพื้นฐานตามแขน (ไม่มี 2 / มี 3) — buildStateFor คิดสูตรเดียวกัน
  if (ch && ch.id === "sliver_bullet") skill = CHAR_HOOKS.sliver_bullet.dynamicSkillFor(p, ch, tier);
  if (!skill) return;
  const isEscanorSkill = p.characterId === "escanor";
  const isHisakawaSkill = p.characterId === "hisakawa_sister";
  const isIgnisSkill = p.characterId === "ignis";
  const isTriggerSkill = p.characterId === "ultraman_trigger";
  // โอเบรอน/โคโตเนะ: สกิลสลับตามช่วงเวลา — กลางคืนใช้เวอร์ชันกลางคืนแทน
  if (tier === "ultimate" && ch.ultimateNight && dayNight.isNightRound(match.roundNumber)) skill = ch.ultimateNight;
  if (tier === "secondary" && ch.secondaryNight && dayNight.isNightRound(match.roundNumber)) skill = ch.secondaryNight;
  if (tier === "basic" && ch.basicNight && dayNight.isNightRound(match.roundNumber)) skill = ch.basicNight;
  // ฟุจิตะ โคโตเนะ (rework 2.3): ร่าง [พร้อมลุย] ทับปุ่มทั้ง 3 ช่อง — ต้องอยู่ "หลัง" การสลับกลางคืนด้านบน
  if (ch.id === "kotone") skill = CHAR_HOOKS.kotone.dynamicSkillFor(p, ch, tier, dayNight.isNightRound(match.roundNumber));
  if (!skill) return;
  if ((p.statuses.noskill || 0) > 0 && !isHisakawaEscape) return; // โดนหอกลองกินัสปัก: เทิร์นนี้ใช้สกิลไม่ได้ (ยกเว้นทางหนีของฮิซากาว่า)
  if (isTriggerSkill && tier === "secondary" && (!(p.statuses.triggerCircle > 0) || p.statuses.triggerMulti > 0 || p.statuses.triggerZeperion > 0)) return;
  if (isTriggerSkill && tier === "ultimate" && (!(p.statuses.triggerCircle > 0) || p.statuses.triggerMulti > 0 || p.statuses.triggerZeperion > 0)) return;
  if (isHisakawaSkill && !CHAR_HOOKS.hisakawa_sister.canUseSkill(engine, p, tier, skill)) return;
  if (isIgnisSkill && !CHAR_HOOKS.ignis.canUseSkill(engine, p, tier, skill)) return;

  let cost = skill.cost;
  // สไตรเกอร์ ยูเรก้า: ขีปนาวุธ = จำนวนนัดที่เลือก (1-9) · เป็นเกียรติมากครับ หักตอนคู่หูอนุมัติ (กดขอ = 0)
  { const sc = CHAR_HOOKS.striker.skillCost(p, tier, item); if (sc != null) cost = sc; }
  // // คากามิ อาราตะ: Rider Kick เป็นการชาร์จ 3 ขั้น ราคาต่างกัน (1 / 1 / 3)
  //  แทนราคาฐานตรงนี้ก่อนตัวปรับทุกตัว (กระแสเวท/ภาระเวท) — ต้องตรงกับ ultimatePub ใน buildStateFor
  if (p.characterId === "kagami" && tier === "ultimate") cost = CHAR_HOOKS.kagami.ultimateCost(p);
  // กลางคืน (patch 2.1.7): สกิลที่สุ่มโดนคืนนี้ (พื้นฐาน/รอง อย่างใดอย่างหนึ่ง) ใช้แต้มมากขึ้น +1 — ไม่มีผลกับท่าไม้ตาย
  //  (เพดาน SKILL_COST_MAX คิดรวมทีเดียวกับภาระเวทด้านล่าง)
  const nightTax = p.nightTaxTier === tier ? 1 : 0;
  // ---------- โอกูริ แคป (Rework): เงื่อนไข Energy / Stamina ชาร์จ ----------
  const isOguri = p.characterId === "oguri";
  const isBreakfast = isOguri && tier === "basic";
  const isOguriTrain = isOguri && tier === "secondary";
  const isAshenTrail = isOguri && tier === "ultimate" && characterRules.oguriAshenReady(p);
  const isVictoryBeat = isOguri && tier === "ultimate" && !isAshenTrail;
  if (isOguriTrain && (p.oguriEnergy || 0) < OGURI_TRAIN_ENERGY_COST) return; // Energy ไม่พอ
  if (isVictoryBeat && (p.stamina || 0) < OGURI_ULT_CHARGE_COST) return;  // Stamina ชาร์จไม่พอ
  // ยุคทองครบ 3 แต้ม: Training ใช้แต้มสกิลลดลง -1 (ใช้งานได้บ่อยขึ้น)
  if (isOguriTrain && characterRules.oguriGoldStacks(p) >= OGURI_GOLD_MAX) cost = Math.max(0, cost - 1);
  // ---------- ซาโตรุ อาเคฟุ (characters/satoru.js) ----------
  const isSatoru = p.characterId === "satoru";
  if (isSatoru && tier === "ultimate") return; // Wonder of U ทำงานอัตโนมัติ — กดเองไม่ได้
  const isOblada = isSatoru && tier === "basic";     // Obla Di, Obla Da: เลือกเป้าหมาย 1 คน (คนอื่นเท่านั้น)
  let obladaTarget = null;
  if (isOblada) {
    obladaTarget = CHAR_HOOKS.satoru.prepareObladaTarget(engine, p, targets);
    if (!obladaTarget) return;
  }
  const isLoca = isSatoru && tier === "secondary";   // Locacaca fruit: เลือกตัวเอง หรือยื่นให้คนอื่น
  let locaTarget = null;
  if (isLoca) {
    locaTarget = CHAR_HOOKS.satoru.prepareLocaTarget(engine, p, targets);
    if (!locaTarget) return;
  }
  const isIgnisSteal = isIgnisSkill && tier === "basic";
  let ignisStealTarget = null;
  if (isIgnisSteal) {
    ignisStealTarget = CHAR_HOOKS.ignis.prepareStealTarget(engine, p, targets);
    if (!ignisStealTarget) return;
  }
  const isIgnisImpact = isIgnisSkill && tier === "ultimate";
  let ignisImpactTarget = null;
  if (isIgnisImpact) {
    ignisImpactTarget = CHAR_HOOKS.ignis.prepareImpactTarget(engine, p, targets);
    if (!ignisImpactTarget) return;
  }
  // SE.RA.PH: ราคาสกิลมาจาก "ระดับทักษะ" ไม่ใช่ค่าของตัวละคร — 2 / 4 / 6 ตายตัว (§3)
  //  ต้องคิดสูตรเดียวกันเป๊ะกับ showCost() ใน publicState ไม่งั้นราคาบนปุ่มไม่ตรงกับที่หักจริง
  if (Seraph.active()) cost = Seraph.costOf(tier);
  // การเดินทาง (ป่าไม้ต้องสาป): ทุกสกิลแพงขึ้น +1 — สกิลราคา 0 ยังฟรี · ต้องตรงกับ showCost() ใน buildStateFor
  const journeyTax = Journey.skillTax(engine, cost);
  // กระแสเวท / ภาระเวท (สถานะพื้นฐาน patch 2.0.8): ใช้พลังงานลดลง/เพิ่มขึ้นตามจำนวนที่ระบุ
  cost = Math.max(0, cost - statusAmtOf(p, "spellflow"));
  //  ตัวปรับราคาขาขึ้นทั้งหมด (กลางคืน + ภาระเวท) รวมกันแล้วดันราคาได้ไม่เกิน SKILL_COST_MAX
  //  → สกิลที่ค่าใช้พลังงานถึงเพดานอยู่แล้ว (เช่นท่าไม้ตาย 8) จะไม่แพงขึ้นไปอีก
  cost = Math.min(CHAR_HOOKS.striker.costCap(p, SKILL_COST_MAX), cost + nightTax + journeyTax + Math.min(SPELLBURDEN_MAX, statusAmtOf(p, "spellburden"))); // ยูเรก้า: เพดาน 16 (ท่าไม้ตาย 9/12)
  // ไททัน Triumphant (12): ราคาตายตัว ไม่โดนตัวปรับราคา · ไททันจ่ายที่มีทั้งหมด ทักต์ในพันธะจ่ายส่วนที่ขาด (หักที่ applyInstantSkill)
  //  คอเซ็ตต์ Destiny (8/12 ตาม item) จ่ายร่วมแบบเดียวกัน
  const titanSplit = p.characterId === "titan" && tier === "ultimate" ? CHAR_HOOKS.titan.triumphSplit(engine, p)
    : p.characterId === "cosette" && tier === "ultimate" ? CHAR_HOOKS.cosette.destinySplit(engine, p, item) : null;
  // ดิโอ: Za warudo ไม่ใช้แต้มสกิล · ชุดร่างหยุดเวลาจ่ายด้วยแอคชัน — ทับตัวปรับราคาทุกตัว (ต้องตรงกับ buildStateFor)
  if (CHAR_HOOKS.dio.freeCost(p, tier)) cost = 0;
  if (titanSplit && !titanSplit.ok) return;
  if (titanSplit) cost = titanSplit.own;
  // การ์ดราชินี: ใช้สกิลไม่เสียแต้ม 1 ครั้ง — ใช้กับสกิลที่มีค่าใช้จ่ายเท่านั้น (ไม่ใช้กับ Triumphant ที่จ่ายร่วมกับทักต์)
  const blessFree = !titanSplit && cost > 0 && (p.statuses.freecast || 0) > 0;
  if (blessFree) cost = 0;
  if (p.skillPoints < cost) return;

  const st = skill.effect && !Array.isArray(skill.effect) && skill.effect.type === "status" ? skill.effect.status : null;
  const isHisakawaFreeAction = isHisakawaSkill && (st === "hisakawaSwitch" || st === "hisakawaRevive");

  // เวลาทอง (แกมเบลอร์): กดสกิลพื้นฐานซ้ำในเทิร์นเดียวได้ จนกว่าจำนวนใช้/แต้มจะหมด
  // เอาแบบนี้ได้ไหม (Apple guy สกิลพื้นฐาน): เลือกของส่งมอบ — ไม่นับเป็นการใช้สกิลของเทิร์น
  //  (ใช้แล้วยังเลือกใช้สกิลอื่นได้อีก 1 ครั้ง)
  const isApplePick = p.characterId === "appleguy" && tier === "basic";
  if (isApplePick && !CHAR_HOOKS.appleguy.validateBasicItem(item)) return; // ต้องเลือกของที่มีจริงเท่านั้น (characters/appleguy.js)
  // มุยมิ: เสบียงฉุกเฉินไม่นับโควตาสกิลหลัก แต่มีโควตา 1 ครั้ง/เทิร์น และ 2 ครั้ง/เกมของตัวเอง
  const isMuimi = p.characterId === "muimi";
  const isMuimiBasic = isMuimi && tier === "basic";
  if (isMuimi && !CHAR_HOOKS.muimi.canUseSkill(engine, p, tier)) return;
  // ขอบคุณอาจารย์มากๆ (โทโนะ ชิกิ สกิลพื้นฐาน): สลับโหมด ใจเย็น/เดือดดาล — ไม่นับเป็นการใช้สกิลของเทิร์น (สลับกี่ครั้งก็ได้)
  const isTohnoSkill = p.characterId === "tohno";
  const isTohnoPick = isTohnoSkill && tier === "basic";
  if (isTohnoPick && !CHAR_HOOKS.tohno.validateBasicItem(item)) return; // ต้องเลือก "calm" / "rage" (characters/tohno.js)
  // เชือดเฉือน / มองเห็นแล้ว!! กดซ้อนกันไม่ได้ (ถือ "จบสิ้นซะ" หรือ "หลับให้สบาย" อยู่)
  if (isTohnoSkill && !CHAR_HOOKS.tohno.canUseSkill(engine, p, tier)) return;
  // เธอ/นาย คือฉันหรอ? (คิชินามิ ฮาคุโนะ สกิลพื้นฐาน): สลับเพศ — ไม่นับเป็นการใช้สกิลของเทิร์น แต่กดสลับได้แค่ 1 ครั้งต่อเทิร์น
  // DoomGuy (patch 2.2 full): สกิลติดตัว "ไม่ติดคูลดาวน์การใช้สกิล" — Quick Swap (พื้นฐาน) และ Weapon (รอง)
  //  ไม่นับเป็นการใช้สกิลของเทิร์น กดได้ทั้งคู่ในเทิร์นเดียวกัน (Quick Swap เองยังจำกัด 1 ครั้ง/เทิร์นแยกต่างหาก)
  const isDoomguyPick = p.characterId === "doomguy" && (tier === "basic" || tier === "secondary");
  // ไค ชิซากิ: มือซ้ายแห่งการรังสรรค์ (พื้นฐาน) + มือขวาแห่งการลงทัณฑ์ (รอง) ไม่นับเป็นการใช้สกิลของเทิร์นร่วมกัน
  //  งบรวม 2 ครั้งต่อเทิร์น ผสมกันได้อิสระ (เช่น รังสรรค์ 2 ครั้งใส่คนละเป้า, หรือ 1 รังสรรค์ + 1 ลงทัณฑ์)
  const isKaiPick = p.characterId === "kai" && (tier === "basic" || tier === "secondary");
  if (isKaiPick && (p.kaiSkillUsesRound || 0) >= 2) return;
  // ผู้วิงวอน (patch 3.4): กดสกิลได้ 2 ครั้งต่อเทิร์น ผสมช่องไหนก็ได้ (แพทเทิร์นเดียวกับไค)
  //  ประกาศไว้ตรงนี้เพราะด่านโควตาสกิลของเทิร์นด้านล่างต้องอ่านค่านี้ ส่วนเงื่อนไขเฉพาะท่าอยู่ที่ CHAR_HOOKS.the_supplicant.canUseSkill
  const isSupPick = p.characterId === "the_supplicant";
  // ไบรอัน "กุญแจรถ": ไม่นับเป็นการใช้สกิลของเทิร์น (กดแล้วยังใช้สกิลอื่นได้อีก 1 ครั้ง)
  const isBrianKey = p.characterId === "brian" && tier === "basic";
  // โปรดิวเซอร์: ช่องแรก (สลับไอดอล / ชุบไอดอล) ไม่นับเป็นการใช้สกิลของเทิร์นทั้งสองแบบ
  const isLumiBasic = p.characterId === "producer_lumi" && tier === "basic";
  // คาเยนน์ "ปืนพกหน่วยรบ": ไม่นับเป็นการใช้สกิลของเทิร์น (กดแล้วยังใช้สกิลอื่นได้อีก 1 ครั้ง · ตัวเองจำกัด 1 ครั้ง/เทิร์น)
  const isCayBasic = p.characterId === "cayenne" && tier === "basic";
  // ไดจิ "การ์ดไซเบอร์": ไม่นับเป็นการใช้สกิลของเทิร์น (กดได้ 2 ครั้ง/เทิร์น แล้วยังใช้สกิลอื่นได้อีก 1 ครั้ง)
  const isDaichiBasic = p.characterId === "daichi" && tier === "basic";
  // ไบรอัน "N2O": ต้องยกเว้นจากโควตาสกิลของเทิร์นด้วย — การแข่งจบใน 1 เทิร์น และการกดท่าไม้ตาย 1
  //  กินโควตาไปแล้วในเทิร์นเดียวกัน ถ้าไม่ยกเว้น N2O จะกดไม่ได้เลยตลอดเกม (สเปคระบุว่า "กดได้ ไม่สนกฎของท่าไม้ตาย 1")
  const isBrianN2O = p.characterId === "brian" && tier === "ultimate" && CHAR_HOOKS.brian.n2oSlot(engine, p);
  // ทาคุมิ ฟุจิวาระ: ขึ้นเกียร์ (พื้นฐาน) / ลงเกียร์ (รอง) / ถึงจะมองไม่เห็น แต่ฉันยังอยู่ (ท่าไม้ตาย) ไม่นับเป็นการใช้สกิลของเทิร์นร่วมกัน
  //  งบรวม 5 ครั้งต่อเทิร์น ผสมกันได้อิสระ (แพทเทิร์นเดียวกับไค กว้างขึ้นครอบคลุมท่าไม้ตายด้วย) — ท่าไม้ตายกดซ้ำไม่ได้ผ่านเช็คทั่วไปด้านล่าง (takumiBlackout บล็อกเอง)
  const isTakumiPick = p.characterId === "takumi" && (tier === "basic" || tier === "secondary" || tier === "ultimate");
  if (isTakumiPick && (p.takumiSkillUsesRound || 0) >= 5) return;
  const isTakumiGearUp = p.characterId === "takumi" && tier === "basic";
  const isTakumiGearDown = p.characterId === "takumi" && tier === "secondary";
  const isTakumiBlackout = p.characterId === "takumi" && tier === "ultimate";
  // มิซึซาว่า ฮารุกะ: ไข่ต้ม และอาหารเสริม — ไม่นับเป็นการใช้สกิลของเทิร์น (แพทเทิร์นเดียวกับไค/ดูมกาย)
  //  กดได้ 2 ครั้งต่อเทิร์นตามโควตา harukaBasicUses แล้วยังเหลือสิทธิ์ใช้สกิลอื่นอีก 1 ครั้งตามปกติ
  const isHarukaBasic = p.characterId === "haruka" && tier === "basic";
  // อุซากิ: สกิลพื้นฐาน (กินไอเทม) มีโควตา 2 ครั้ง/เทิร์นของตัวเอง ไม่กินโควตาสกิลหลักของเทิร์น
  const isUsagiPick = p.characterId === "usagi";
  const isUsagiBasic = isUsagiPick && tier === "basic";
  if (isHarukaBasic && (p.harukaBasicUses || 0) >= CHAR_HOOKS.haruka.BASIC_USES_PER_TURN) return;
  if (isSupPick && (p.supSkillUsesRound || 0) >= CHAR_HOOKS.the_supplicant.SKILL_USES_PER_TURN) return;
  if (p.skillUsedRound && !isUsagiBasic && !isBrianKey && !isBrianN2O && !isLumiBasic && !isCayBasic && !isDaichiBasic && !isSupPick && !isHarukaBasic && !isApplePick && !isMuimiBasic && !isTohnoPick && !isDoomguyPick && !isKaiPick && !isTakumiPick && !isHisakawaFreeAction && !CHAR_HOOKS.striker.skipsTurnQuota(p, tier) && !CHAR_HOOKS.takt.skipsTurnQuota(p, tier) && !CHAR_HOOKS.titan.skipsTurnQuota(p, tier) && !CHAR_HOOKS.cosette.skipsTurnQuota(p, tier) && !CHAR_HOOKS.dio.skipsTurnQuota(p, tier)) return; // ใช้สกิลได้เพียง 1 อันต่อเทิร์น (ซ้ำ/ซ้อนไม่ได้)
  // Beat Mode (ประกายเขี้ยว): ท่าไม้ตายใช้ไม่ได้เสมอ / สกิลพื้นฐานใช้ไม่ได้เฉพาะหลังกันตายทำงานแล้ว (patch 2.2 alpha)
  if (tier === "ultimate" && combat.beatActive(p)) return;
  // ท่าไม้ตาย: กดซ้ำไม่ได้จนกว่าผลจะหมดเวลา (สวมเกราะราชันคงอยู่ถาวร = กดซ้ำไม่ได้อีกเลยตลอดเกม)
  if (tier === "ultimate" && st && (p.statuses[st] || 0) > 0) return;
  // ---------- ไรโด ฮิคารุ / อุลตร้าแมนกิงกะ (rework patch 2.1.3) ----------
  // Ultlive Ultraman Ginga (สกิลรอง 1): ใช้ไม่ได้ระหว่างติด MonsterLive และกดซ้ำไม่ได้จนกว่าผลจะหมด
  const isHikaruGinga = p.characterId === "hikaru" && skill === ch.secondary;
  if (isHikaruGinga && (p.statuses.monster || 0) > 0) return;
  if (isHikaruGinga && (p.statuses.ginga || 0) > 0) return;
  // Ginga Strium (ท่าไม้ตาย): ต้องอยู่ในร่าง Ginga (สกิลรอง 1 ยังไม่หมดเวลา) และต้องเป็นตอนกลางวันเท่านั้นถึงใช้ได้
  if (tier === "ultimate" && p.characterId === "hikaru" && (!((p.statuses.ginga || 0) > 0) || dayNight.isNightRound(match.roundNumber))) return;
  // Crucible (DoomGuy patch 2.2 full): ใช้ได้เมื่อชาร์จครบ 5 เท่านั้น
  if (st === "doomCrucible" && (p.doomCharge || 0) < DOOM_CRUCIBLE_CHARGE_NEED) return;
  // ---------- คาซามะ ไดสุเกะ (characters/daisuke.js) ----------
  //  พื้นฐาน: กดระหว่าง Clock Up ไม่ได้ · รอง/ท่าไม้ตาย: ต้องอยู่ใน CAST OFF
  const isDaisukePick = p.characterId === "daisuke";
  if (isDaisukePick && !CHAR_HOOKS.daisuke.canUseSkill(engine, p, tier)) return;
  const isYagurumaPick = p.characterId === "yaguruma";
  if (isYagurumaPick && !CHAR_HOOKS.yaguruma.canUseSkill(engine, p, tier)) return;
  const isKagamiPick = p.characterId === "kagami";
  if (isKagamiPick && !CHAR_HOOKS.kagami.canUseSkill(engine, p, tier)) return;
  if (isUsagiPick && !CHAR_HOOKS.usagi.canUseSkill(engine, p, tier, targets, item)) return;
  const isTsurugiPick = p.characterId === "tsurugi";
  if (isTsurugiPick && !CHAR_HOOKS.tsurugi.canUseSkill(engine, p, tier)) return;
  // พี่จ๋าอยู่ไหน (อาริมะ มิยาโกะ): กดซ้ำไม่ได้จนกว่าจะได้โจมตี
  if (p.characterId === "miyako" && tier === "basic" && (p.statuses.miyakoHeal || 0) > 0) return;
  // เพลงหมัด อาริมะ (อาริมะ มิยาโกะ): กดซ้ำไม่ได้จนกว่าจะได้โจมตี
  if (p.characterId === "miyako" && tier === "secondary" && (p.statuses.miyakoCombo || 0) > 0) return;
  // เอาไปสิ (Apple guy สกิลรอง, characters/appleguy.js): เลือกผู้เล่น 1 คน (คนอื่นเท่านั้น) มอบของที่เลือกไว้ทันทีก่อนเปิดการ์ด
  const isAppleGive = p.characterId === "appleguy" && tier === "secondary";
  let appleTarget = null;
  if (isAppleGive) {
    appleTarget = CHAR_HOOKS.appleguy.prepareGiveTarget(engine, p, targets);
    if (!appleTarget) return;
  }
  // ---------- ฟุจิตะ โคโตเนะ (rework 2.3, characters/kotone.js) ----------
  //  ทุกท่าไม่ต้องเลือกเป้าหมาย (ตีหมู่/ใส่ตัวเอง) — เงื่อนไขการกดทั้งหมดอยู่ที่ canUseSkill()
  const isKotone = p.characterId === "kotone";
  const kotoneNight = dayNight.isNightRound(match.roundNumber);
  const kotoneWasForm = isKotone && CHAR_HOOKS.kotone.formActive(p); // อยู่ร่าง [พร้อมลุย] ตอนกด (ท่าจะถอดร่างทีหลัง)
  if (isKotone && !CHAR_HOOKS.kotone.canUseSkill(engine, p, tier, skill, kotoneNight)) return;
  // ---------- เอจิ (characters/eiji.js) ----------
  const isEiji = p.characterId === "eiji";
  if (isEiji && !CHAR_HOOKS.eiji.canUseSkill(engine, p, tier)) return;
  // ---------- มิซึซาว่า ฮารุกะ (characters/haruka.js) ----------
  //  พื้นฐาน: โควตา 2 ครั้ง/เทิร์น · รอง: ต้องมี "โอเมก้า" และ "จงไปสู่สุขติ" ต้องไม่ค้างอยู่ · ท่าไม้ตาย: กดซ้ำไม่ได้ระหว่างโอเมก้า
  const isHaruka = p.characterId === "haruka";
  if (isHaruka && !CHAR_HOOKS.haruka.canUseSkill(engine, p, tier)) return;
  // ---------- คอนเนอร์ RK800 (characters/conner.js) ----------
  //  พื้นฐาน: กดไม่ได้ระหว่างโหมดจับกุมขั้นเด็ดขาด · รอง/ท่าไม้ตาย: ต้องเลือกเป้าหมาย 1 คน
  //  (ท่าไม้ตายเล็งได้เฉพาะระดับ "อาชญากร" — เช็คทั้งที่ canUseSkill (มีเป้าให้เล็งไหม) และ prepareTarget (เป้าที่ส่งมาถูกระดับไหม))
  const isConnerPick = p.characterId === "conner";
  let connerTarget = null;
  let connerCloseCase = null; // เป้าหมายของ "จัดการปิดคดี" ที่รอลงดาเมจหลังวีดีโอจบ
  if (isConnerPick) {
    if (!CHAR_HOOKS.conner.canUseSkill(engine, p, tier)) return;
    connerTarget = CHAR_HOOKS.conner.prepareTarget(engine, p, tier, targets);
    if (!connerTarget) return; // ทั้งสามช่องต้องเลือกเป้าหมาย 1 คนแล้ว (rework 3.4.2)
    if (tier === "basic") {
      // วิเคราะห์สถานการณ์: item = ลำดับการกระทำที่คาดการณ์ (array ว่างได้ = ทายว่า "ไม่ได้ทำอะไรเลย")
      const guess = CHAR_HOOKS.conner.sanitizeGuess(item);
      if (!guess) return; // payload ผิดรูป — ไม่หักแต้มสกิลทิ้ง
      p.connorGuess = guess;
    }
  }
  // ---------- ยุย โยชิโอกะ (characters/yui.js) ----------
  //  พื้นฐาน: ไม่กินโควตาสกิลของเทิร์น · สกิลรอง: กดซ้ำระหว่าง "นักมวยปล้ำ" ไม่ได้
  //  ท่าไม้ตาย: item = คีย์เพลงที่เลือก · เพลงชุบชีวิตต้องเลือกคนตายไว้ก่อนด้วย
  const isYuiPick = p.characterId === "yui";
  const isYuiBasic = isYuiPick && tier === "basic";
  if (isYuiPick) {
    if (!CHAR_HOOKS.yui.canUseSkill(engine, p, tier)) return;
    if (tier === "ultimate") {
      const song = CHAR_HOOKS.yui.SONGS[item];
      if (!song) return; // ต้องเลือกเพลงก่อนเสมอ
      if (song.key === "treasure") {
        const rt = CHAR_HOOKS.yui.prepareReviveTarget(engine, p, targets);
        if (!rt) return; // ไม่มีคนตายให้ชุบ = กดไม่ได้
        p.yuiReviveTargetId = rt.id;
      }
    }
  }
  // ---------- อิสึกะ ชิโด (characters/shido.js) ----------
  //  พื้นฐาน: กดซ้ำระหว่าง "ภูติ" มีผลไม่ได้ · สกิลรอง: ต้องมีดาเมจที่บันทึกไว้ >= 3 ก่อนถึงชักดาบได้
  //  ท่าไม้ตาย: กดซ้ำระหว่างกับดักเปิดอยู่ไม่ได้ (และเป็นสกิลเงียบ — ไม่มีแบนเนอร์/ไม่เข้า roundSkills)
  const isShidoPick = p.characterId === "shido";
  if (isShidoPick && !CHAR_HOOKS.shido.canUseSkill(engine, p, tier)) return;
  // ---------- โมโรโบชิ ดัน (characters/dan.js) ----------
  //  พื้นฐาน: กดซ้ำไม่ได้ระหว่างไม้ค้ำยังมีผล · สกิลรอง/ท่าไม้ตาย 1: ต้องเลือกเป้าหมาย 1 คน
  //  ท่าไม้ตาย 2 (อย่าให้ฉันต้องเฆี่ยนตี): เล็งเป้าหมายเดิมอัตโนมัติ ไม่ต้องให้ผู้เล่นส่ง targets มา
  const isDanPick = p.characterId === "dan";
  let danTarget = null;
  let danWhipTarget = null; // เป้าหมายของท่าไม้ตาย 2 ที่รอลงดาเมจหลังวีดีโอจบ
  if (isDanPick) {
    if (!CHAR_HOOKS.dan.canUseSkill(engine, p, tier)) return;
    if (tier === "secondary" || tier === "ultimate") {
      danTarget = CHAR_HOOKS.dan.prepareTarget(engine, p, tier, targets);
      if (!danTarget) return;
    }
  }
  // ---------- เรียวกิ ชิกิ (patch 2.0.6, characters/shiki.js) ----------
  const isShikiLifeline = p.characterId === "shiki" && tier === "secondary"; // นายมีฝีมือแค่ไหนหรอ?
  let shikiLifelineTarget = null;
  if (isShikiLifeline) {
    shikiLifelineTarget = CHAR_HOOKS.shiki.prepareLifelineTarget(engine, p, targets);
    if (!shikiLifelineTarget) return;
  }
  // ---------- เจ้าหญิงราก (patch 2.2.7, characters/princess_shiki.js) ----------
  const isPShikiSeal = p.characterId === "princess_shiki" && tier === "secondary"; // อย่าทำอะไรไม่เข้าท่าเลย
  let pshikiSealTarget = null;
  if (isPShikiSeal) {
    pshikiSealTarget = CHAR_HOOKS.princess_shiki.prepareSealTarget(engine, p, targets);
    if (!pshikiSealTarget) return;
  }
  // อืม ฉันเข้าใจแล้ว (สกิลพื้นฐาน): ชักดาบยังค้างอยู่ กดซ้ำไม่ได้ (ไม่งั้นเสียเลือด 3 ฟรี)
  const isPShikiBlade = p.characterId === "princess_shiki" && tier === "basic";
  if (isPShikiBlade && !CHAR_HOOKS.princess_shiki.canCastBlade(p)) return;
  // ---------- แบทแมน (patch 3.1, characters/bat_ben.js) ----------
  //  ร่างปกติ: พื้นฐาน = รถแบทโมบิล (ครั้งเดียวต่อเกม) · รอง = นายลืมของน่ะ · ไม้ตาย = เข้ามาเลย
  //  ร่างรถ: ทั้งสามช่องเปลี่ยนเป็นเวอร์ชันรถ (ลูกปรายล่อ / ปืนติดรถ / แกไม่รอดแน่)
  // ---------- มาคุโนะอุจิ อิปโป (characters/ippo.js) ----------
  //  ทั้งสามช่องมีคูลดาวน์รายสกิล (เก็บเป็นเลขรอบ ไม่ใช่สถานะ) — ด่านเดียวกันทั้ง canUseSkill และปุ่มฝั่ง client
  const isIppoPick = p.characterId === "ippo";
  if (isIppoPick && !CHAR_HOOKS.ippo.canUseSkill(engine, p, tier)) return;
  // ---------- Bamboo-Hatted Kim (characters/kim.js) ----------
  //  คูลดาวน์รายช่อง (เลขรอบ) · ท่าไม้ตายทั้งสองกดไม่ได้ระหว่างบัพรวมร่าง · ท่าที่ 2 ต้องมีพลังชีวิตพอจ่าย
  const isKimPick = p.characterId === "kim";
  if (isKimPick && !CHAR_HOOKS.kim.canUseSkill(engine, p, tier)) return;
  // โอเบรอน (ฤดูร้อน) / จอมเวทย์ อาร์โทเรีย: ทุกช่องลงผลในโมดูลของตัวเอง (effect: null)
  const isOberonSummer = p.characterId === "oberon_summer";
  if (isOberonSummer && !CHAR_HOOKS.oberon_summer.canUseSkill(engine, p, tier, targets)) return;
  const isArtoria = p.characterId === "artoria_caster";
  if (isArtoria && !CHAR_HOOKS.artoria_caster.canUseSkill(engine, p, tier, targets)) return;
  const isReines = p.characterId === "reines";
  if (isReines && !CHAR_HOOKS.reines.canUseSkill(engine, p, tier, targets)) return;
  const isAndersen = p.characterId === "andersen";
  if (isAndersen && !CHAR_HOOKS.andersen.canUseSkill(engine, p, tier, targets, item)) return;
  // อาซาฮินะ ทักต์ / ไททัน: เงื่อนไขรายช่องอยู่ในโมดูลของตัวเอง (effect: null)
  const isTaktPick = p.characterId === "takt";
  if (isTaktPick && !CHAR_HOOKS.takt.canUseSkill(engine, p, tier, targets, item)) return;
  const isTitanPick = p.characterId === "titan";
  if (isTitanPick && !CHAR_HOOKS.titan.canUseSkill(engine, p, tier)) return;
  const isCosettePick = p.characterId === "cosette";
  if (isCosettePick && !CHAR_HOOKS.cosette.canUseSkill(engine, p, tier, item)) return;
  const isJohnnyPick = p.characterId === "johnny"; // คูลดาวน์รายท่า · กระสุนเล็บ · Golden Ratio · เป้าของ Snipe Shot / Lesson Five
  if (isJohnnyPick && !CHAR_HOOKS.johnny.canUseSkill(engine, p, tier, targets, item)) return;
  const isSliverPick = p.characterId === "sliver_bullet"; // นักบินปริศนา: Beam Magnum ต้องมีแขน + เป้าศัตรู 1 คน
  if (isSliverPick && !CHAR_HOOKS.sliver_bullet.canUseSkill(engine, p, tier, targets)) return;
  // กด Beam Magnum = ปรากฏตัวทันที (ก่อนด่านเหน็บชา/ป่าไม้ต้องสาปที่ขึ้นป้ายชื่อผู้ใช้ — ด่านที่เหลือด้านล่างเป็นของตัวละครอื่น)
  if (isSliverPick && tier === "secondary") CHAR_HOOKS.sliver_bullet.reveal(engine, p);
  // ---------- ดิโอ แบรนโด (characters/dio.js) ----------
  //  คูลดาวน์/เกจเวลา (ร่างปกติ) หรือแอคชันพอ + ยังไม่ใช้ใน THE WORLD ครั้งนี้ · ทุกท่าเล็งศัตรู ยกเว้น Za warudo
  //  Barrage / Road Roller เลือกเป้ารายหมัด (targets ยาวเท่าจำนวนหมัด · คนเดิมซ้ำได้)
  const isDioPick = p.characterId === "dio";
  let dioTarget = null;
  if (isDioPick) {
    if (!CHAR_HOOKS.dio.canUseSkill(engine, p, tier)) return;
    if (CHAR_HOOKS.dio.needsTarget(p, tier)) {
      dioTarget = CHAR_HOOKS.dio.prepareTarget(engine, p, targets, tier); // ท่าหลายหมัด = array เป้ารายหมัด
      if (!dioTarget) return;
    }
  }
  // ---------- Recruit (characters/recruit.js) ----------
  //  คูลดาวน์ · กระสุนพอ · ไม่มี QTE/การเลือกเป้าค้าง · Desert Eagle / Barrett ต้องเลือกเป้าก่อนกด
  const isRecruitPick = p.characterId === "recruit";
  if (isRecruitPick && !CHAR_HOOKS.recruit.canUseSkill(engine, p, tier, targets)) return;
  // ---------- สไตรเกอร์ ยูเรก้า (characters/striker.js) ----------
  //  รอคู่หูตอบ = กดอะไรไม่ได้ · นับถอยหลังระเบิด = กดได้แค่ท่าไม้ตายซ้ำ · ขีปนาวุธต้องเลือกจำนวน 1-9
  const isStrikerPick = p.characterId === "striker";
  if (isStrikerPick && !CHAR_HOOKS.striker.canUseSkill(engine, p, tier, item)) return;
  // ---------- ผู้วิงวอน (characters/the_supplicant.js) ----------
  //  ทั้งสามช่องต้องเลือกเป้าหมาย 1 คน (เลือกตัวเองได้) — โควตา 2 ครั้ง/เทิร์นเช็คไปแล้วด้านบน (ดู isSupPick)
  let supTarget = null;
  if (isSupPick) {
    if (!CHAR_HOOKS.the_supplicant.canUseSkill(engine, p, tier)) return;
    supTarget = CHAR_HOOKS.the_supplicant.prepareTarget(engine, p, targets);
    if (!supTarget) return;
  }
  // ---------- ไบรอัน (GT-R34) (characters/brian.js) ----------
  //  พื้นฐาน: item = "off"/"boost" ตอนกดครั้งที่ 2 · ท่าไม้ตาย 1 ต้องเลือกเป้าหมาย · N2O ไม่ต้อง
  // ---------- โปรดิวเซอร์ (luminous) (characters/producer_lumi.js) ----------
  //  ช่องแรก: item = คีย์ไอดอลที่จะสลับไป (ตอนไอดอลล้มจะกลายเป็นช่องชุบ ไม่ต้องส่ง item)
  const isLumiPick = p.characterId === "producer_lumi";
  if (isLumiPick && !CHAR_HOOKS.producer_lumi.canUseSkill(engine, p, tier, item)) return;
  // ---------- คาเยนน์ ซูซูชิโระ (characters/cayenne.js) ----------
  //  พื้นฐาน: 1 ครั้ง/เทิร์น · รอง/ท่าไม้ตาย: ต้องเป็น "เกพาร์ด" และมีกระสุนพอ (รองกดซ้ำระหว่างบรรจุค้างไม่ได้)
  const isCayPick = p.characterId === "cayenne";
  if (isCayPick && !CHAR_HOOKS.cayenne.canUseSkill(engine, p, tier)) return;
  let cayMissileCast = false; // มิสไซล์แห่งคำอำลา: ความเสียหายลงหลังวีดีโอจบ
  // ---------- ไดจิ โอโซระ (characters/daichi.js) ----------
  //  พื้นฐาน: 2 ครั้ง/เทิร์น · รอง: ต้องอยู่ใน unite และสวมเกราะใบเดิมซ้ำไม่ได้ · ท่าไม้ตาย: กดซ้ำระหว่าง unite ไม่ได้
  const isDaichiPick = p.characterId === "daichi";
  if (isDaichiPick && !CHAR_HOOKS.daichi.canUseSkill(engine, p, tier)) return;
  //  ทั้งสามช่องต้องมีตัวเลือกจากหน้าจอมาด้วยเสมอ (โหมดสับราง / ไอเทม+ชนิดอาวุธ / แบบของท่าไม้ตาย)
  const isBrianPick = p.characterId === "brian";
  let brianTarget = null;
  if (isBrianPick) {
    if (!CHAR_HOOKS.brian.canUseSkill(engine, p, tier, item)) return;
    if (tier === "ultimate" && !CHAR_HOOKS.brian.n2oSlot(engine, p)) {
      brianTarget = CHAR_HOOKS.brian.prepareTarget(engine, p, targets);
      if (!brianTarget) return;
    }
  }
  const isBatPick = p.characterId === "bat_ben";
  if (isBatPick && !CHAR_HOOKS.bat_ben.canUseSkill(engine, p, tier)) return;
  // ---------- DoomGuy (patch 2.2 full): Quick Swap (สกิลพื้นฐาน) 1 ครั้งต่อเทิร์น / Weapon (สกิลรอง) แปรตามอาวุธที่ถืออยู่ ----------
  const isDoomSwap = p.characterId === "doomguy" && tier === "basic";
  if (isDoomSwap && p.doomQuickSwapUsed) return; // ใช้ได้ 1 ครั้งต่อเทิร์น
  if (isDoomSwap && characterRules.doomWeaponMarkPending()) return; // Combat Shotgun/Heavy Cannon: [ระเบิด]/[ล็อคเป้า] ยังค้างอยู่ — สุ่มปืนใหม่ไม่ได้จนกว่าจะโดนใช้
  const isDoomWeapon = p.characterId === "doomguy" && tier === "secondary";
  const doomW = isDoomWeapon ? (DOOM_WEAPONS[p.doomWeapon] || DOOM_WEAPONS.shotgun) : null;
  if (isDoomWeapon) cost = doomW.cost;
  if (isDoomWeapon && !doomW.effect) return; // ปืนบางกระบอกไม่มีความสามารถพิเศษให้กด (BFG 9000)
  let doomTarget = null;
  if (isDoomWeapon && ["explode", "lockon", "stun", "bonusdmg", "bonusdmg2", "drain"].includes(doomW.effect)) {
    doomTarget = CHAR_HOOKS.doomguy.resolveWeaponTarget(engine, p, targets);
    if (!doomTarget) return;
  }
  // ---------- สึงาชิ ทาคุโตะ (patch 2.2 new / 2.2.5) ----------
  const takutoApprivoiseOn = p.characterId === "takuto" && (p.statuses.apprivoise || 0) > 0;
  // patch 2.2.5: มีหอกผู้พิชิตอยู่ = ถือว่าดาบทั้ง 2 อันทำงานอยู่ กดซ้ำไม่ได้เหมือนกัน (แสดงเป็น disable)
  const isTakutoEmeraude = p.characterId === "takuto" && tier === "basic" && takutoApprivoiseOn;
  if (isTakutoEmeraude && ((p.statuses.emeraude || 0) > 0 || (p.statuses.lance || 0) > 0)) return; // ยังไม่ถูกใช้ กดซ้ำไม่ได้
  const isTakutoSaphir = p.characterId === "takuto" && tier === "secondary";
  if (isTakutoSaphir && !takutoApprivoiseOn) return; // ต้องอยู่ในสถานะ Apprivoise! ก่อนเท่านั้น
  if (isTakutoSaphir && ((p.statuses.saphir || 0) > 0 || (p.statuses.lance || 0) > 0)) return; // ยังไม่ถูกใช้ กดซ้ำไม่ได้
  // patch 2.2.4: ท่าไม้ตาย 1 "อย่างนายน่ะ จะไปเข้าใจอะไร" (พิชิตแสงดาว) — ใช้ได้เฉพาะก่อนกันตายทำงาน ต้องมีดาบทั้ง 2 อันพร้อมกันเท่านั้น
  const isTakutoUlt2 = p.characterId === "takuto" && tier === "ultimate" && !p.beatSaved;
  if (isTakutoUlt2 && !((p.statuses.emeraude || 0) > 0 && (p.statuses.saphir || 0) > 0)) return;
  if (isTakutoUlt2 && (p.statuses.takutoThirdAtk || 0) > 0) return; // มีโอกาสค้างอยู่แล้ว กดซ้ำไม่ได้จนกว่าจะได้ใช้ผล
  // patch 2.2.5: ท่าไม้ตาย 2 "ร่วมเดินทางไปกับฉันเถอะ" — แทนท่าไม้ตาย 1 ถาวรหลังกันตายทำงานแล้ว ไม่ต้องมีดาบก็กดได้
  const isTakutoUlt3 = p.characterId === "takuto" && tier === "ultimate" && p.beatSaved;
  if (isTakutoUlt3 && !takutoApprivoiseOn) return; // ต้องอยู่ในสถานะฉันคว้ามันได้แล้วก่อนเท่านั้น
  // ---------- นานายะ ชิกิ: อันนี้ของนายรึเปล่า (characters/nanaya.js) ----------
  const isNanayaSilence = p.characterId === "nanaya" && tier === "basic";
  let nanayaSilenceTarget = null;
  if (isNanayaSilence) {
    nanayaSilenceTarget = CHAR_HOOKS.nanaya.prepareSilenceTarget(engine, p, targets);
    if (!nanayaSilenceTarget) return;
  }
  // ---------- เทเปา (ชิกิ): วันนี้อากาศดีจัง / เป็นแบบนี้นี่เอง / นายเป็นคนทำตัวเองนะ ----------
  // patch 2.2.6: ระหว่างทำอาหารหรือครุ่นคิดอยู่ฝั่งใดฝั่งหนึ่ง ใช้สกิลอื่นไม่ได้เลย (รวมกดอีกฝั่งด้วย) จนกว่าฝั่งที่ทำอยู่จะหมดเวลา
  if (p.characterId === "tepeu" && ((p.tepeuCookTurns || 0) > 0 || (p.tepeuPonderTurns || 0) > 0)) return;
  const isTepeuCook = p.characterId === "tepeu" && tier === "basic";
  const isTepeuPonder = p.characterId === "tepeu" && tier === "secondary";
  const isTepeuKill = p.characterId === "tepeu" && tier === "ultimate";
  let tepeuKillTarget = null;
  if (isTepeuKill) {
    tepeuKillTarget = CHAR_HOOKS.tepeu.prepareKillTarget(engine, p, targets);
    if (!tepeuKillTarget) return;
  }
  // ---------- ไค ชิซากิ (characters/kai.js): มือซ้ายแห่งการรังสรรค์ / มือขวาแห่งการลงทัณฑ์ — Overhaul ไม่ผ่านช่องนี้ (ดู kaiOverhaul()) ----------
  if (p.characterId === "kai" && tier === "ultimate") return; // Overhaul ไม่ใช่ปุ่มสกิลปกติ — กดเองไม่ได้
  const isKaiCreation = p.characterId === "kai" && tier === "basic";
  const isKaiPunishment = p.characterId === "kai" && tier === "secondary";
  let kaiMarkTarget = null;
  if (isKaiCreation || isKaiPunishment) {
    kaiMarkTarget = CHAR_HOOKS.kai.prepareMarkTarget(engine, p, targets);
    if (!kaiMarkTarget) return;
  }
  // ---------- ผู้สังหารเมจ (characters/mageslayer.js): Witch Mark / Mana Rupture / Mana Burden ----------
  const isMsWitchMark = p.characterId === "mageslayer" && tier === "basic";
  let msWitchMarkTarget = null;
  if (isMsWitchMark) {
    if (match.roundNumber < (p.mageslayerWitchMarkReadyRound || 0)) return;
    msWitchMarkTarget = CHAR_HOOKS.mageslayer.prepareWitchMarkTarget(engine, p, targets);
    if (!msWitchMarkTarget) return;
  }
  const isMsRupture = p.characterId === "mageslayer" && tier === "ultimate";
  let msRuptureTarget = null;
  if (isMsRupture) {
    msRuptureTarget = CHAR_HOOKS.mageslayer.prepareRuptureTarget(engine, p, targets);
    if (!msRuptureTarget) return;
  }
  const isMsBurden = p.characterId === "mageslayer" && tier === "secondary";
  if (isMsBurden && CHAR_HOOKS.mageslayer.burdenOnCooldown(engine, p)) return; // Mana Burden: คูลดาวน์ 7 เทิร์น

  // ANATA WAAAAAAAA (เทมาริ): ต้องเลือกเป้าหมาย 1 คนก่อนใช้ (characters/temari.js)
  let anataTargets = null;
  if (st === "anata") {
    anataTargets = CHAR_HOOKS.temari.prepareAnataTargets(engine, p, targets);
    if (!anataTargets) return;
  }

  // สไตรเกอร์ ยูเรก้า (เป็นเกียรติมากครับ): ยังไม่หักแต้ม/ไม่ลงผล — ส่งคำขอให้คู่หู (นักบิน) อนุมัติก่อน
  if (isStrikerPick && CHAR_HOOKS.striker.needsApproval(p, tier)) {
    CHAR_HOOKS.striker.requestApproval(engine, p);
    view.broadcastState();
    return;
  }
  p.skillPoints -= cost;
  // ORT สกิลติดตัว 1: สกิลแรกที่กดในเทิร์นนี้จะ "ข้อมูลสูญหาย" ในเทิร์นถัดไป
  //  ยกเว้นสกิลเงียบของชิโด — log "ท่าไม้ตายของชิโดข้อมูลสูญหาย" ที่ทุกคนเห็นคือการบอกว่าเขาเพิ่งวางกับดัก
  //  นักบินปริศนา: สกิลพื้นฐานระหว่างซ่อนตัวก็เงียบแบบเดียวกัน (ไม่มีอะไรบอกศัตรูว่าเขาอยู่)
  if (!CHAR_HOOKS.shido.silentSkill(p, tier) && !CHAR_HOOKS.sliver_bullet.silentSkill(p, tier)) CHAR_HOOKS.ort.onSkillUsed(engine, p, tier);
  // ORT สกิลติดตัว 2: ถูกเลือกเป็นเป้าของสกิล (แม้เป็นบัฟ/ดีบัฟ) -> สวนกลับผู้ใช้ (ลงท้าย useSkill)
  if (Array.isArray(targets) && targets.includes(ORT_ID)) CHAR_HOOKS.ort.queueCounter(engine, p.id);
  // ไททัน "คล่องตัวสูง": ถูกเลือกเป็นเป้าของสกิล (แม้เป็นบัฟ) -> สวนกลับผู้ใช้ (ลงท้าย useSkill ผ่าน flushOrtCounters)
  CHAR_HOOKS.titan.onSkillTargeted(engine, p, targets);
  // จอห์นนี่ Slow Dancer: ศัตรูเล็งจอห์นนี่ด้วยสกิล -> ใช้ 1 ครั้ง สกิลนี้ไม่มีผลกับเขา (ดาเมจ/ดีบัฟถูกกันจนจบการกด)
  CHAR_HOOKS.johnny.onSkillFired(engine, p, targets);
  if (blessFree) {
    p.statuses.freecast--;
    if (p.statuses.freecast <= 0) delete p.statuses.freecast;
    match.lastLog.push(`👸 ${p.name} การ์ดราชินี — ใช้สกิลนี้โดยไม่เสียแต้มสกิล`);
  }
  if (!CHAR_HOOKS.daisuke.skipsTurnQuota(p, tier) && !isUsagiBasic && !isApplePick && !isMuimiBasic && !isTohnoPick && !isDoomguyPick && !isKaiPick && !isTakumiPick && !isHarukaBasic && !isHisakawaFreeAction && !isYuiBasic && !isSupPick && !isBrianKey && !isBrianN2O && !isLumiBasic && !isCayBasic && !isDaichiBasic && !CHAR_HOOKS.striker.skipsTurnQuota(p, tier) && !CHAR_HOOKS.oberon_summer.skipsTurnQuota(p, tier) && !CHAR_HOOKS.takt.skipsTurnQuota(p, tier) && !CHAR_HOOKS.titan.skipsTurnQuota(p, tier) && !CHAR_HOOKS.cosette.skipsTurnQuota(p, tier) && !CHAR_HOOKS.dio.skipsTurnQuota(p, tier)) p.skillUsedRound = true; // สกิลเลือก/สลับและเสบียงฉุกเฉินไม่นับโควตาสกิลหลัก
  if (isKaiPick) p.kaiSkillUsesRound = (p.kaiSkillUsesRound || 0) + 1;
  if (isTakumiPick) p.takumiSkillUsesRound = (p.takumiSkillUsesRound || 0) + 1;
  // "คำสาป" (สถานะ Universal): กดสกิลสำเร็จแล้ว = เสียพลังชีวิต 1 หน่วย (1 ครั้ง/เทิร์น)
  //  วางหลังหักแต้ม — กดไม่ผ่านเงื่อนไขด้านบนจะ return ไปก่อนถึงตรงนี้ คำสาปจึงไม่กินฟรี
  tickCurseOnSkill(engine, p);
  // "เหน็บชา" (สถานะ Universal — Bamboo-Hatted Kim): 30% สกิลไม่ทำงาน แต่แต้มสกิล/โควตาของเทิร์นถูกใช้ไปแล้วตามเดิม
  if (numbFizzles(p)) {
    match.lastLog.push(`🫨 ${p.name} เหน็บชา — ${skill.name} ไม่ทำงาน! (แต้มสกิลถูกหักไปแล้ว)`);
    if (!CHAR_HOOKS.sliver_bullet.silentSkill(p, tier)) io.emit("skillFlash", { name: `${skill.name} — เหน็บชา สกิลไม่ทำงาน`, img: skill.img || null, by: p.name, color: lobby.colorOf(p) }); // นักบินปริศนาซ่อนตัว: ห้ามมีป้าย
    view.broadcastState();
    draw.checkAllLocked();
    return;
  }
  // การเดินทาง (ป่าไม้ต้องสาป กลางวัน): สกิลที่เลือกศัตรูเป็นเป้าหมายพลาด 25% — คืนแต้ม (และการ์ดราชินี)
  //  แต่สิทธิ์ใช้สกิลของเทิร์นถูกใช้ไปแล้ว · แพทเทิร์นเดียวกับเหน็บชาด้านบน (ยังไม่มีผลใดลงไป)
  if (Journey.skillMisses(engine, p, targets)) {
    p.skillPoints += cost;
    if (blessFree) p.statuses.freecast = (p.statuses.freecast || 0) + 1;
    match.lastLog.push(`🌲 ป่าไม้ต้องสาป — ${skill.name} ของ ${p.name} พลาดเป้า! (ได้แต้มสกิลคืน ${cost})`);
    io.emit("skillFlash", { name: `${skill.name} — พลาดเป้า (ป่าไม้ต้องสาป)`, img: skill.img || null, by: p.name, color: lobby.colorOf(p) });
    view.broadcastState();
    draw.checkAllLocked();
    return;
  }
  // การเดินทาง (ทะเลทราย กลางคืน): ใช้สกิลได้แต้มคืน 2 — ไม่เกินที่จ่ายจริง (การ์ดราชินี/ราคา 0 จึงไม่ได้คืน)
  {
    const refund = Journey.skillRefund(engine, cost);
    if (refund > 0) {
      p.skillPoints = Math.min(combat.maxSkillOf(p), p.skillPoints + refund);
      match.lastLog.push(`🌙 ทะเลทรายยามค่ำคืน — ${p.name} ได้แต้มสกิลคืน +${refund}`);
    }
  }

  // ---------- นายมีฝีมือแค่ไหนหรอ? (ชิกิ patch 2.0.6): ยกเลิกท่าไม้ตายทันทีที่มีผู้เล่นอื่นกด ----------
  //  มีชิกิถือชาร์จ godslay อยู่บนสนาม -> ท่าไม้ตายของผู้เล่นอื่นที่เพิ่งกดถูกยกเลิกทันที
  //  ไม่ว่าท่าจะทำงานก่อนหรือหลังเปิดการ์ด — แต้มสกิลที่จ่ายไปเสียฟรี (ไม่คืน) และเล่นวีดีโอแทนที่
  if (tier === "ultimate") {
    const slayer = combat.alivePlayers().find(
      (s) => s.id !== p.id && s.characterId === "shiki" && (s.statuses.godslay || 0) > 0
    );
    if (slayer) {
      const hasVideo = combat.shikiCancelUltimate(slayer, p, skill.name, skill.img);
      if (hasVideo) cutscene.pausePlayingForCutscene();
      else { view.broadcastState(); draw.checkAllLocked(); }
      return;
    }
  }

  let flashSuffix = ""; // ต่อท้ายชื่อสกิลบนป้ายเด้ง เพื่อบอกผลให้ทุกคนเห็น
  // ---------- คาซามะ ไดสุเกะ (characters/daisuke.js) ----------
  if (isDaisukePick) flashSuffix = CHAR_HOOKS.daisuke.applyInstantSkill(engine, p, tier) || flashSuffix;
  if (isYagurumaPick) flashSuffix = CHAR_HOOKS.yaguruma.applyInstantSkill(engine, p, tier) || flashSuffix;
  if (isKagamiPick) flashSuffix = CHAR_HOOKS.kagami.applyInstantSkill(engine, p, tier) || flashSuffix;
  if (isTsurugiPick) flashSuffix = CHAR_HOOKS.tsurugi.applyInstantSkill(engine, p, tier) || flashSuffix;
  if (isUsagiPick) flashSuffix = CHAR_HOOKS.usagi.applyInstantSkill(engine, p, tier, targets, item) || flashSuffix;
  // ไรเดอร์ Zect: กด Clock Up/Clock Over กลางเฟสจั่วไพ่ — ต้องแก้เวลาที่เหลือตอนนี้
  //  ก่อนที่ pausePlayingForCutscene() จะอ่าน timeLeft ไปเก็บไว้คืนหลังคลิปจบ
  if ((isDaisukePick || isYagurumaPick || isKagamiPick || isTsurugiPick) && tier === "secondary") timers.syncClockUpPhaseTime();
  // ---------- โทโนะ ชิกิ (characters/tohno.js): สลับโหมด / เชือดเฉือน / มองเห็นแล้ว!! ----------
  if (isTohnoSkill) flashSuffix = CHAR_HOOKS.tohno.applyInstantSkill(engine, p, tier, item) || flashSuffix;
  // ---------- Apple guy: เอาแบบนี้ได้ไหม / เอาไปสิ (characters/appleguy.js) ----------
  if (isApplePick) {
    flashSuffix = CHAR_HOOKS.appleguy.applyBasicPick(p, item, engine.log);
  }
  if (isAppleGive && appleTarget) {
    flashSuffix = CHAR_HOOKS.appleguy.applyGiveEffect(engine, p, appleTarget, skill.name);
  }
  // ---------- ฟุจิตะ โคโตเนะ (characters/kotone.js) ----------
  //  ท่าไม้ตายในร่าง [พร้อมลุย] จ่าย 6 เหรียญเพิ่มจากแต้มสกิล (ผลจริงทำงานหลังเปิดไพ่ที่ resolveFormUlts)
  if (isKotone) {
    flashSuffix = CHAR_HOOKS.kotone.payFormUltGold(engine, p, skill) || flashSuffix;
    flashSuffix = CHAR_HOOKS.kotone.applyInstantSkill(engine, p, tier, kotoneNight) || flashSuffix;
  }
  // ---------- เอจิ (characters/eiji.js): ว่องไว / ความแค้น / ไม่ว่ายังก็ตาม ----------
  if (isEiji) flashSuffix = CHAR_HOOKS.eiji.applyInstantSkill(engine, p, tier) || flashSuffix;
  // ---------- มิซึซาว่า ฮารุกะ (characters/haruka.js): ไข่ต้ม และอาหารเสริม / amazon punish / New Omega ----------
  if (isHaruka) flashSuffix = CHAR_HOOKS.haruka.applyInstantSkill(engine, p, tier) || flashSuffix;
  // ---------- มุยมิ: เสบียงฉุกเฉิน / ดาบสนิม / ดาบสะบั้นหอคอยสวรรค์ ----------
  if (isMuimi) flashSuffix = CHAR_HOOKS.muimi.applyInstantSkill(engine, p, tier) || flashSuffix;
  // ---------- ยุย โยชิโอกะ (characters/yui.js): ปากแจ๋ว / เยอรมันซูเพล็ก / ทำนองเพลงร็อก ----------
  if (isYuiPick) flashSuffix = CHAR_HOOKS.yui.applyInstantSkill(engine, p, tier, item) || flashSuffix;
  // ---------- อิสึกะ ชิโด (characters/shido.js): ภูติ / Sandalphon / ฝากด้วยนะตัวฉัน ----------
  if (isShidoPick) flashSuffix = CHAR_HOOKS.shido.applyInstantSkill(engine, p, tier) || flashSuffix;
  // ---------- โมโรโบชิ ดัน (characters/dan.js): ไม้ค้ำ / นายทำให้ฉันผิดหวัง / ฉันบอกว่าอย่าหนี ----------
  if (isDanPick) {
    flashSuffix = CHAR_HOOKS.dan.applyInstantSkill(engine, p, tier, danTarget) || flashSuffix;
    if (tier === "ultimate" && danTarget) {
      // ท่าไม้ตายทั้งสองแบบเล่นวีดีโอทุกครั้ง (queueCutscene ตรงๆ ไม่ใช่ triggerCutscene)
      //  ท่า 1 แค่แปะสถานะ -> เล่นวีดีโอเฉยๆ ก็พอ · ท่า 2 ลงดาเมจ -> หน่วงไว้ให้ลงหลังวีดีโอจบ
      if (CHAR_HOOKS.dan.whipReady(engine, p)) { cutscene.queueCutscene(p, "danWhip"); danWhipTarget = danTarget; }
      else cutscene.queueCutscene(p, "danChase");
    }
  }
  // ---------- คอนเนอร์ RK800 (characters/conner.js): วิเคราะห์สถานการณ์ / ข่มขวัญ-จับกุม / จัดการปิดคดี ----------
  if (isConnerPick) {
    flashSuffix = CHAR_HOOKS.conner.applyInstantSkill(engine, p, tier, connerTarget) || flashSuffix;
    if (tier === "ultimate" && connerTarget) {
      // สเปคระบุลำดับ "เล่นวีดีโอก่อน แล้วค่อยเกิดความเสียหาย" และวีดีโอท่านี้เล่นทุกครั้งที่ปล่อย
      //  จึงหน่วงดาเมจไว้เสมอ แล้วลงจริงหลังคัตซีนจบ (ดูจุดที่เรียก pausePlayingForCutscene ด้านล่าง)
      CHAR_HOOKS.conner.queueCloseCaseVideo(engine, p);
      connerCloseCase = connerTarget;
    }
  }
  // ---------- นานายะ ชิกิ: อันนี้ของนายรึเปล่า (characters/nanaya.js) ----------
  if (isNanayaSilence && nanayaSilenceTarget) {
    flashSuffix = CHAR_HOOKS.nanaya.applySilenceEffect(engine, p, nanayaSilenceTarget, skill.name);
  }
  // ---------- Apple guy: ชิวๆครับน้องๆ — รีเซ็ตอัตราหลบเป็น 100% ----------
  if (st === "chill") {
    p.chillDodge = 100;
    match.lastLog.push(`🏖️ ${p.name} ชิวๆครับน้องๆ — หลบหนีอย่างสบายใจ (จบเทิร์นได้แต้มสกิล +1 จนกว่าจะถูกโจมตี)`);
  }
  // ---------- ชิกิ: นายมีฝีมือแค่ไหนหรอ? (patch 2.0.6, characters/shiki.js) — เส้นชีวิต +1 + ชาร์จยกเลิกท่าไม้ตาย ----------
  if (isShikiLifeline && shikiLifelineTarget) {
    flashSuffix = CHAR_HOOKS.shiki.applyLifelineEffect(engine, p, shikiLifelineTarget, skill.name);
  }
  // ---------- เทเปา (characters/tepeu.js) ----------
  if (isTepeuCook) CHAR_HOOKS.tepeu.applyCookEffect(engine, p);
  if (isTepeuPonder) CHAR_HOOKS.tepeu.applyPonderEffect(engine, p);
  if (isTepeuKill && tepeuKillTarget) flashSuffix = CHAR_HOOKS.tepeu.applyKillEffect(engine, p, tepeuKillTarget, skill.name);
  // ---------- ไค ชิซากิ (characters/kai.js) ----------
  if (isKaiCreation && kaiMarkTarget) flashSuffix = CHAR_HOOKS.kai.applyMark(engine, p, kaiMarkTarget, "kaiCreation", "รังสรรค์");
  if (isKaiPunishment && kaiMarkTarget) flashSuffix = CHAR_HOOKS.kai.applyMark(engine, p, kaiMarkTarget, "kaiPunishment", "ลงทัณฑ์");
  // ---------- ผู้สังหารเมจ (characters/mageslayer.js) ----------
  if (isTriggerSkill) CHAR_HOOKS.ultraman_trigger.applySkill(engine, p, tier);
  if (isHisakawaSkill) flashSuffix = CHAR_HOOKS.hisakawa_sister.applySkill(engine, p, tier, skill) || flashSuffix;
  if (isIgnisSteal && ignisStealTarget) flashSuffix = CHAR_HOOKS.ignis.applySteal(engine, p, ignisStealTarget) || flashSuffix;
  if (isIgnisSkill && !isIgnisSteal && !isIgnisImpact) flashSuffix = CHAR_HOOKS.ignis.applySkill(engine, p, tier, skill) || flashSuffix;
  if (isIgnisImpact) cutscene.queueCutscene(p, "triggerDarkImpact");
  if (isMsWitchMark && msWitchMarkTarget) flashSuffix = CHAR_HOOKS.mageslayer.applyWitchMark(engine, p, msWitchMarkTarget);
  if (isMsRupture && msRuptureTarget) flashSuffix = CHAR_HOOKS.mageslayer.applyRuptureEffect(engine, p, msRuptureTarget, skill.name);
  if (isMsBurden) {
    p.transformAt = ++match.transformCounter; // Mana Burden: BGM mageslayer_ult ใช้ลำดับนี้ตัดสินว่าใครล่าสุด
    p.statuses.mageslayerBurdenBgm = 5;  // ตัวจับเวลาเพลงพื้นหลัง (อายุเท่าภาระเวท/ดูดซับเวทที่แจกออกไป)
    CHAR_HOOKS.mageslayer.applyManaBurden(engine, p);
  }
  // ---------- ทาคุมิ ฟุจิวาระ (characters/takumi.js) ----------
  if (isTakumiGearUp) flashSuffix = CHAR_HOOKS.takumi.applyGearUp(engine, p);
  if (isTakumiGearDown) flashSuffix = CHAR_HOOKS.takumi.applyGearDown(engine, p);
  if (isTakumiBlackout) CHAR_HOOKS.takumi.activateBlackout(engine, p);
  // ---------- โอกูริ แคป (Rework, characters/oguri.js) ----------
  if (isBreakfast) flashSuffix = CHAR_HOOKS.oguri.applyBreakfast(engine, p);
  if (isOguriTrain) flashSuffix = CHAR_HOOKS.oguri.applyTraining(engine, p);
  if (isVictoryBeat) CHAR_HOOKS.oguri.activateVictory(engine, p);
  if (isAshenTrail) CHAR_HOOKS.oguri.activateAshenTrail(engine, p);

  // ---------- ซาโตรุ อาเคฟุ (characters/satoru.js) ----------
  if (isOblada && obladaTarget) {
    flashSuffix = CHAR_HOOKS.satoru.applyObladaEffect(engine, p, obladaTarget, skill.name);
  }
  if (isLoca && locaTarget) {
    flashSuffix = CHAR_HOOKS.satoru.applyLocaEffect(engine, p, locaTarget);
  }

  // ---------- แบทแมน (characters/bat_ben.js) ----------
  //  สกิลที่ไม่ได้ผูกกับสถานะ (รถแบทโมบิล + ทั้งสามช่องของร่างรถ) ลงผลผ่าน applyInstantSkill
  if (isIppoPick) flashSuffix = CHAR_HOOKS.ippo.applyInstantSkill(engine, p, tier) || flashSuffix;
  if (isKimPick) flashSuffix = CHAR_HOOKS.kim.applyInstantSkill(engine, p, tier) || flashSuffix;
  if (isOberonSummer) flashSuffix = CHAR_HOOKS.oberon_summer.applyInstantSkill(engine, p, tier, targets) || flashSuffix;
  if (isArtoria) flashSuffix = CHAR_HOOKS.artoria_caster.applyInstantSkill(engine, p, tier, targets) || flashSuffix;
  if (isReines) flashSuffix = CHAR_HOOKS.reines.applyInstantSkill(engine, p, tier, targets) || flashSuffix;
  if (isAndersen) flashSuffix = CHAR_HOOKS.andersen.applyInstantSkill(engine, p, tier, targets, item) || flashSuffix;
  if (isRecruitPick) flashSuffix = CHAR_HOOKS.recruit.applyInstantSkill(engine, p, tier, targets) || flashSuffix; // เปิด QTE
  if (isStrikerPick) flashSuffix = CHAR_HOOKS.striker.applyInstantSkill(engine, p, tier, item) || flashSuffix;
  if (isTaktPick) flashSuffix = CHAR_HOOKS.takt.applyInstantSkill(engine, p, tier, targets, item) || flashSuffix;
  if (isTitanPick) flashSuffix = CHAR_HOOKS.titan.applyInstantSkill(engine, p, tier, titanSplit) || flashSuffix;
  if (isCosettePick) flashSuffix = CHAR_HOOKS.cosette.applyInstantSkill(engine, p, tier, item, titanSplit) || flashSuffix;
  if (isJohnnyPick) flashSuffix = CHAR_HOOKS.johnny.applyInstantSkill(engine, p, tier, targets, item) || flashSuffix;
  // ดิโอ: ลงผลทันที (วีดีโอคิวไว้เล่นท้าย useSkill) · Za warudo/จบ THE WORLD แก้ timeLeft ก่อน pausePlayingForCutscene อ่าน
  if (isDioPick) flashSuffix = CHAR_HOOKS.dio.applyInstantSkill(engine, p, tier, dioTarget) || flashSuffix;
  // นักบินปริศนา: Beam Magnum ปรากฏตัวก่อนลงผล (ป้ายด้านล่างจึงเปิดเผยได้) · สกิลพื้นฐานมีคลิป/การ์ดของตัวเอง
  if (isSliverPick) flashSuffix = CHAR_HOOKS.sliver_bullet.applyInstantSkill(engine, p, tier, targets) || flashSuffix;
  // ผลที่ลง "หลังวีดีโอ": ขีปนาวุธของยูเรก้า · Triumphant ของไททัน
  const strikerAfter = isStrikerPick ? CHAR_HOOKS.striker.takeAfter(p) : isTitanPick ? CHAR_HOOKS.titan.takeAfter(p) : null;
  // ---------- ผู้วิงวอน (patch 3.4) ----------
  if (isSupPick && supTarget) flashSuffix = CHAR_HOOKS.the_supplicant.applyInstantSkill(engine, p, tier, supTarget) || flashSuffix;
  if (isBrianPick) flashSuffix = CHAR_HOOKS.brian.applyInstantSkill(engine, p, tier, brianTarget, item) || flashSuffix;
  if (isLumiPick) flashSuffix = CHAR_HOOKS.producer_lumi.applyInstantSkill(engine, p, tier, item) || flashSuffix;
  if (isCayPick) {
    flashSuffix = CHAR_HOOKS.cayenne.applyInstantSkill(engine, p, tier) || flashSuffix;
    cayMissileCast = tier === "ultimate";
  }
  if (isDaichiPick) flashSuffix = CHAR_HOOKS.daichi.applyInstantSkill(engine, p, tier) || flashSuffix;
  if (isBatPick) flashSuffix = CHAR_HOOKS.bat_ben.applyInstantSkill(engine, p, tier) || flashSuffix;
  if (st === "batKarma") CHAR_HOOKS.bat_ben.activateKarma(engine, p);
  if (st === "batTaunt") CHAR_HOOKS.bat_ben.activateTaunt(engine, p);
  // ---------- เจ้าหญิงราก (characters/princess_shiki.js) ----------
  if (isPShikiSeal && pshikiSealTarget) {
    flashSuffix = CHAR_HOOKS.princess_shiki.applySealEffect(engine, p, pshikiSealTarget, skill.name);
  }
  if (st === "pshikiBlade") CHAR_HOOKS.princess_shiki.activateBlade(engine, p);
  if (st === "pshikiUlt") CHAR_HOOKS.princess_shiki.activateUlt(engine, p);
  // ---------- ชิกิ: ท่าไม้ตายทั้งสอง (characters/shiki.js) — เปิดเนตรมารแห่งความมรณะ / ความตายที่โรยรา ----------
  if (st === "deatheye") CHAR_HOOKS.shiki.activateDeatheye(engine, p);
  if (st === "wither") CHAR_HOOKS.shiki.activateWither(engine, p);

  // ทงคัสสึ 3 มื้อ (เทมาริ patch 2.0.6): นับชามสะสม (characters/temari.js)
  if (p.characterId === "temari" && tier === "basic") CHAR_HOOKS.temari.applyBasicTonkatsu(p);
  if (isEscanorSkill) CHAR_HOOKS.escanor.applySkill(engine, p, tier, targets);
  else if (!isHisakawaSkill && !isIgnisSkill) combat.applyEffect(p, skill.effect);

  // ---------- DoomGuy (patch 2.2 full, characters/doomguy.js) ----------
  if (isDoomSwap) CHAR_HOOKS.doomguy.applyQuickSwap(engine, p);
  if (isDoomWeapon) {
    io.emit("skillFlash", { name: `🔫 ${doomW.name}`, img: doomW.img, by: p.name, color: lobby.colorOf(p), doomWeapon: p.doomWeapon }); // เสียงสกิลอาวุธ (เฉพาะฝั่ง client แปลว่าเสียงตามอาวุธ)
    CHAR_HOOKS.doomguy.applyWeaponEffect(engine, p, doomW, doomTarget);
  }
  // ---------- สึงาชิ ทาคุโตะ (patch 2.2 new, characters/takuto.js) ----------
  if (p.characterId === "takuto" && tier === "basic" && !takutoApprivoiseOn) CHAR_HOOKS.takuto.applyBasicStar(engine, p);
  if (isTakutoEmeraude) CHAR_HOOKS.takuto.applyEmeraude(engine, p);
  if (isTakutoSaphir) CHAR_HOOKS.takuto.applySaphir(engine, p);
  // ---------- สึงาชิ ทาคุโตะ ท่าไม้ตาย 1 (patch 2.2.4): อย่างนายน่ะ จะไปเข้าใจอะไร (พิชิตแสงดาว) — แทน Tau Missile เดิม ----------
  //  เงื่อนไข: ต้องมีดาบทั้ง 2 อัน (Emeraude+Saphir) พร้อมกันเท่านั้นถึงจะใช้ได้ (เช็คที่ gate ด้านบนแล้ว) — ใช้ได้เฉพาะก่อนกันตายทำงาน
  if (isTakutoUlt2) CHAR_HOOKS.takuto.activateUlt2(engine, p);
  // ---------- สึงาชิ ทาคุโตะ ท่าไม้ตาย 2 ใหม่ (patch 2.2.5): ร่วมเดินทางไปกับฉันเถอะ — แทนท่าไม้ตาย 1 ถาวรหลังกันตายทำงานแล้ว ----------
  if (isTakutoUlt3) CHAR_HOOKS.takuto.activateUlt3(engine, p);

  // Song for you (เทมาริ patch 2.0.6.1): ล้างสถานะผิดปกติทั้งหมดของตัวเอง แล้วนำชามทงคัสสึมาบัฟตัวเอง
  //  1 ชาม = +1 พลังขิง — ใช้แล้วล้างชามทั้งหมด
  if (st === "song") {
    const bowls = p.tonkatsu || 0;
    const atk = bowls;
    p.songAtk = atk;
    p.tonkatsu = 0;
    // ล้างสถานะผิดปกติทั้งหมด (patch 2.0.8: ยามฟ้าสาง/เส้นชีวิต เป็นดีบัฟที่ยังไม่เกิดผลทันที — ลดลงทีละ 1 แทน)
    const cleansed = [];
    for (const k of combat.DEBUFF_KEYS) {
      if ((p.statuses[k] || 0) > 0) {
        delete p.statuses[k];
        if (p.statusAmt) delete p.statusAmt[k];
        cleansed.push(k);
      }
    }
    for (const k of SOFT_DEBUFF_STEP) {
      if ((p.statuses[k] || 0) > 0) {
        p.statuses[k]--;
        if (p.statuses[k] <= 0) delete p.statuses[k];
        cleansed.push(k);
      }
    }
    match.lastLog.push(`🎵 ${p.name} Song for you — ใช้ทงคัสสึ ${bowls} ชาม: พลังขิง +${atk} (ล้างชามทั้งหมด)${cleansed.length ? ` และล้างสถานะผิดปกติ ${cleansed.length} อย่าง` : ""}`);
  }

  // ANATA WAAAAAAAA (characters/temari.js): เก็บเป้าหมายไว้เป็นความลับ + เปิดเพลงจนกว่าทุกคนจะเปิดไพ่
  if (st === "anata") {
    p.anataTargets = CHAR_HOOKS.temari.applyUltimateEffect(engine, p, anataTargets, skill.name);
    match.anataMusicSeq = engine.nextTransformCounter();
  }

  // ---------- ไรโด ฮิคารุ (characters/hikaru.js) ----------
  if (st === "monster") CHAR_HOOKS.hikaru.activateMonster(engine, p);
  if (st === "ginga") CHAR_HOOKS.hikaru.activateGinga(engine, p);
  if (st === "gingastrium") CHAR_HOOKS.hikaru.activateGingaStrium(engine, p);

  // ---------- ริต้า เบอร์นัล / ฟีนิกซ์ (characters/phenex.js) ----------
  if (st === "phenexIgnite") CHAR_HOOKS.phenex.activateIgnite(engine, p);
  if (st === "phenexReflect") CHAR_HOOKS.phenex.activateReflect(engine, p);
  if (st === "phenexNtd") CHAR_HOOKS.phenex.activateNtd(engine, p);
  if (st === "phenexTaunt") CHAR_HOOKS.phenex.activateTaunt(engine, p);
  if (st === "phenexPurge") CHAR_HOOKS.phenex.activatePurge(engine, p);
  // ---------- อาริมะ มิยาโกะ (patch 2.2.0, characters/miyako.js) ----------
  if (st === "miyakoHeal") CHAR_HOOKS.miyako.activateHeal(engine, p);
  if (st === "miyakoCombo") CHAR_HOOKS.miyako.activateCombo(engine, p);
  if (st === "miyakoUlt") CHAR_HOOKS.miyako.activateUlt(engine, p);
  // ---------- DoomGuy (characters/doomguy.js) — Crucible: แปลงร่างทันทีก่อนเปิดไพ่ทั้งหมด + บังคับทุกคนอื่นแตกทันที ----------
  if (st === "doomCrucible") CHAR_HOOKS.doomguy.activateCrucible(engine, p);

  // ข้อเสียโคโตเนะ (characters/kotone.js): 20% เมื่อใช้สกิลพื้นฐาน/พื้นฐาน 2/สกิลรอง -> โดนท่านประธานเซนะจังเจอตัว สตั้นตัวเอง 1 เทิร์น
  if (isKotone) CHAR_HOOKS.kotone.maybeTriggerSena(engine, p, tier, kotoneWasForm);

  // ดูดซับเวท (characters/mageslayer.js): ทุกครั้งที่ผู้เล่นคนใดกดสกิลสำเร็จ — ถ้าติด [ดูดซับเวท] 35% ถูกขโมยพลังงาน 1
  CHAR_HOOKS.mageslayer.onEnergyAction(engine, p);
  CHAR_HOOKS.escanor.onSkillUsed(engine, p);

  // สกิลช่วงจั่วการ์ด (instant): เด้งโชว์ทันทีบนกระดานของทุกคน ไม่ต้องรอเปิดไพ่/ไม่ตัดจอดำ
  if (skill.instant) {
    // Apple guy: ป้ายเด้งของสกิลพื้นฐานโชว์รูปของที่เลือก
    const flashImg = isApplePick ? CHAR_HOOKS.appleguy.ITEMS[item].img
      : isDaichiPick && tier === "basic" ? CHAR_HOOKS.daichi.cardImg(p) // ไดจิ: โชว์การ์ดไซเบอร์ใบที่เพิ่งสุ่มได้
      : (skill.img || null);
    // เทเปา (ชิกิ): กดสกิลพื้นฐาน/สกิลรอง ให้เล่นเสียง tepeu_skill1_2 ก่อนเสมอ
    // คอนเนอร์: เพลงคิด conner_think.m4a "ไม่" เล่นที่นี่ — มันต้องเล่นระหว่างกำลังเรียงลำดับในโมดัล
    //  (ฝั่ง client คุมเอง ดู ConnorPredictModal) ตอนกดยืนยันคือตอนที่คิดเสร็จแล้ว เพลงต้องหยุดพอดี
    const flashSound = (isTepeuCook || isTepeuPonder) ? "tepeu_skill1_2" : isHisakawaSkill ? CHAR_HOOKS.hisakawa_sister.skillVoice(p, tier, skill)
      : isKimPick ? CHAR_HOOKS.kim.skillSound(p, tier) // Bamboo-Hatted Kim: เสียงชักดาบ / ฟาดฟันลง
      : isOberonSummer ? CHAR_HOOKS.oberon_summer.skillSound(p, tier) // โอเบรอน (ฤดูร้อน): เสียงประจำแต่ละช่อง
      : isTohnoSkill ? CHAR_HOOKS.tohno.skillSound(p, tier) : null; // โทโนะ: เสียงพากย์สุ่มตอนกดสกิลรอง/ท่าไม้ตาย
    // อิสึกะ ชิโด "ฝากด้วยนะตัวฉัน": สกิลเงียบ — ห้ามมีแบนเนอร์ให้ใครเห็นว่าเขากดอะไรไป
    //  นักบินปริศนา: สกิลพื้นฐานไม่มีป้าย (คลิป/การ์ดแจ้งเตือนของตัวเอง — ระหว่างซ่อนส่งเฉพาะพวกเดียวกัน)
    if (!CHAR_HOOKS.shido.silentSkill(p, tier) && !CHAR_HOOKS.sliver_bullet.ownNotice(p, tier)) {
      io.emit("skillFlash", { name: skill.name + flashSuffix, img: flashImg, by: p.name, color: lobby.colorOf(p), sound: flashSound });
    }
  }
  // จำสกิลที่ใช้ในรอบ (ท่าไม้ตายมี cutscene ของตัวเอง / สกิลหลังเปิดไพ่ไปโชว์ตอนโจมตี)
  // คอนเนอร์ RK800 (สกิลติดตัว 1 สืบสวน): การกดสกิล 1 ครั้ง = ความเครียด +1 (ไม่ลงที่ตัวคอนเนอร์เอง)
  CHAR_HOOKS.conner.onSkillUsed(engine, p);
  //  สกิลเงียบของชิโดไม่เข้า roundSkills ด้วย — รายการนี้ถูกอ่านโดยหลักสูตร "พิเศษ" ของไบเลธ
  //  ซึ่งจะลงโทษ "คนที่กดสกิลในเทิร์นนี้" = เป็นเบาะแสว่าชิโดกดอะไรไป
  if (!CHAR_HOOKS.shido.silentSkill(p, tier) && !CHAR_HOOKS.sliver_bullet.silentSkill(p, tier)) match.roundSkills.push({ playerId: id, tier, name: skill.name, img: skill.img || null, status: st }); // tier: หลักสูตร "พิเศษ" ของไบเลธอ่านว่าใครกดสกิลระดับไหนในเทิร์นนี้

  p.busted = cardDeck.bustedOf(p);
  if (p.busted) { combat.voidUltimateOnBust(p); CHAR_HOOKS.mageslayer.onBustOrLoseRoll(engine, p); }
  // ไพ่แตก/ถึงเพดานพอดี: ไม่ล็อกอัตโนมัติ — ยังกดสกิล/ใช้ไอเทมได้ต่อไป จนกว่าจะกดเปิดไพ่เอง หรือทุกคนเปิดไพ่ครบ

  // วีดีโอสวนกลับที่ค้างคิว (Wonder of U ซาโตรุ) — เล่นทันทีช่วงจั่วการ์ด
  if (match.gameState === "PLAYING" && match.cutsceneQueue.length) {
    if (isIgnisImpact) cutscene.pausePlayingForCutscene(() => CHAR_HOOKS.ignis.applyImpact(engine, p, ignisImpactTarget));
    else if (cayMissileCast) {
      // คาเยนน์: มิสไซล์แห่งคำอำลา — วีดีโอก่อน แล้วค่อยลงความเสียหาย
      cayMissileCast = false;
      cutscene.pausePlayingForCutscene(() => CHAR_HOOKS.cayenne.fireMissiles(engine, p));
    }
    else if (danWhipTarget) {
      // โมโรโบชิ ดัน: "อย่าให้ฉันต้องเฆี่ยนตี" — วีดีโอก่อน แล้วค่อยลงความเสียหาย (แพทเทิร์นเดียวกับจัดการปิดคดี)
      const dt = danWhipTarget;
      danWhipTarget = null;
      cutscene.pausePlayingForCutscene(() => CHAR_HOOKS.dan.applyWhip(engine, p, dt));
    }
    else if (connerCloseCase) {
      const t = connerCloseCase;
      connerCloseCase = null;
      cutscene.pausePlayingForCutscene(() => CHAR_HOOKS.conner.applyCloseCase(engine, p, t));
    } else if (strikerAfter) cutscene.pausePlayingForCutscene(() => combat.withEffectSource(p, strikerAfter));
    else cutscene.pausePlayingForCutscene();
  } else if (strikerAfter) strikerAfter(); // ตาข่าย: ไม่ได้เข้าเส้นทางคัตซีน -> ลงผลทันที
  // ตาข่ายสำรอง (คอนเนอร์ "จัดการปิดคดี"): ไม่ได้เข้าเส้นทางคัตซีนด้วยเหตุใดก็ตาม -> ลงดาเมจทันที
  //  ไม่งั้นแต้มสกิล 8 หน่วยหายไปเปล่าๆ โดยเป้าหมายไม่โดนอะไรเลย
  if (connerCloseCase) CHAR_HOOKS.conner.applyCloseCase(engine, p, connerCloseCase);
  if (cayMissileCast) CHAR_HOOKS.cayenne.fireMissiles(engine, p); // วีดีโอเคยเล่นไปแล้วในเกมนี้ -> ลงผลทันที
  // ตาข่ายสำรองเดียวกันของ "อย่าให้ฉันต้องเฆี่ยนตี" — ไม่ได้เข้าเส้นทางคัตซีน -> ลงดาเมจทันที
  if (danWhipTarget) CHAR_HOOKS.dan.applyWhip(engine, p, danWhipTarget);
  view.broadcastState();
  draw.checkAllLocked();
}
// ---- Locacaca fruit (ซาโตรุ patch 2.0.8.2) ----
// เป้าหมายตอบรับ = ฮีลเต็ม แลก Max HP -1 และจ่ายแต้มสกิล 4 ให้ซาโตรุ / ปฏิเสธ (หรือไม่ตอบ) = ไม่มีอะไรเกิดขึ้น
function resolveLoca(s, t, accept, timeout) {
  if (!s) return;
  s.locaOffer = null;
  if (!t || !t.alive) return;
  if (accept && s.alive) {
    t.maxHpPenalty = (t.maxHpPenalty || 0) + 1;
    t.hp = Math.min(t.hp, combat.maxHpOf(t));
    const heal = combat.healHp(t, MAX_HP);
    const pay = Math.min(CHAR_HOOKS.satoru.LOCA_STEAL, t.skillPoints);
    t.skillPoints -= pay;
    if (pay > 0) combat.addSkill(s, pay);
    match.lastLog.push(`🍑 ${t.name} รับผลโลกากากาจาก ${s.name} — ฟื้นเลือดจนเต็ม +${heal} แลกกับ Max HP ลดถาวร 1 (เหลือ ${combat.maxHpOf(t)}) และจ่ายแต้มสกิล ${pay} ให้ ${s.name}`);
    io.emit("skillFlash", { name: `Locacaca fruit — ${t.name} รับผลไม้!`, img: "/characters/satoru/locaca.png", by: s.name, color: lobby.colorOf(s) });
  } else {
    match.lastLog.push(`🍑 ${t.name} ${timeout ? "ไม่ตอบ" : "ปฏิเสธ"}ผลโลกากากาของ ${s.name} — ไม่มีอะไรเกิดขึ้น`);
    io.emit("skillFlash", { name: `Locacaca fruit — ${t.name} ปฏิเสธ`, img: "/characters/satoru/locaca.png", by: s.name, color: lobby.colorOf(s) });
  }
}
function answerLoca(id, accept, fromId = null) {
  const t = match.players[id];
  if (match.gameState !== "PLAYING" || !t || !t.alive) return;
  const s = fromId ? match.players[fromId] : Object.values(match.players).find((o) => o.alive && o.locaOffer === id);
  if (s && (!s.alive || s.locaOffer !== id)) return;
  if (!s) return;
  resolveLoca(s, t, accept, false);
  view.broadcastState();
  draw.checkAllLocked();
}
// Bard: รับเป้าหมายบทเพลงที่ประพันธ์เสร็จ (เลือกได้ระหว่างช่วงจั่วการ์ด แม้เปิดไพ่ไปแล้ว)
function bardTarget(id, targets) {
  const p = match.players[id];
  if (match.gameState !== "PLAYING" || !p || !p.alive || !p.bardPending) return;
  const song = p.bardPending;
  const tgs = Array.isArray(targets) ? [...new Set(targets)] : [];
  const valid = tgs.filter((tid) => {
    const t = match.players[tid];
    return t && t.alive && (song.allowSelf || tid !== p.id);
  });
  if (valid.length !== song.need) return;
  p.bardPending = null;
  bardPerform(p, song.pattern, valid, true);
  // วีดีโอสวนกลับที่ค้างคิว (Wonder of U ซาโตรุ) — เล่นทันทีช่วงจั่วการ์ด
  if (match.gameState === "PLAYING" && match.cutsceneQueue.length) cutscene.pausePlayingForCutscene();
  view.broadcastState();
  draw.checkAllLocked();
}
// ไค ชิซากิ (characters/kai.js): กดปุ่ม Overhaul — ต้องมีมาร์กรังสรรค์/ลงทัณฑ์ครบ 2 หน่วยบนกระดานก่อนถึงกดได้
function kaiOverhaul(id) {
  const p = match.players[id];
  if (!p || !p.alive || p.characterId !== "kai") return;
  if (match.gameState !== "PLAYING" || p.locked) return;
  if (CHAR_HOOKS.daisuke.actionBlocked(engine, p)) return; // Clock Up: ปุ่มเฉพาะตัวก็กดไม่ได้ — เวลาหยุดหมายถึงทุกอย่าง
  if (CHAR_HOOKS.dio.actionBlocked(engine, p)) return; // THE WORLD / นอกวง Last stand (ดิโอ)
  const ownSlots = match.kaiOverhaulSlots.filter((slot) => slot.ownerId === p.id);
  if (ownSlots.length < 2) return;
  const [a, b] = ownSlots.slice(0, 2);
  const holderA = match.players[a.playerId];
  const holderB = match.players[b.playerId];
  if (!holderA || !holderA.alive || !holderB || !holderB.alive) return;
  CHAR_HOOKS.kai.resolveOverhaul(engine, holderA, a.status, holderB, b.status, p);
  match.kaiOverhaulSlots = match.kaiOverhaulSlots.filter((slot) => slot.ownerId !== p.id);
  for (const player of Object.values(match.players)) {
    if (player.kaiMarksBy) delete player.kaiMarksBy[p.id];
    for (const statusKey of ["kaiCreation", "kaiPunishment"]) {
      const remaining = Object.values(player.kaiMarksBy || {}).filter((marks) => marks[statusKey]).length;
      if (remaining > 0) player.statuses[statusKey] = 999;
      else {
        delete player.statuses[statusKey];
        if (player.statusAmt) delete player.statusAmt[statusKey];
      }
    }
    if (player.kaiMarksBy && !Object.keys(player.kaiMarksBy).length) delete player.kaiMarksBy;
  }
  p.transformAt = ++match.transformCounter;
  io.emit("skillFlash", { name: "Overhaul", img: view.displayImg(p), by: p.name, color: lobby.colorOf(p) });
  view.broadcastState();
  draw.checkAllLocked();
}
