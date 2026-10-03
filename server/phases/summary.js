// เฟสสรุปผล: ตัดสินผู้ชนะ/ผู้แพ้ของรอบ
// export ก่อน require: ไฟล์ใน server/ require วนกันเอง — function declaration ถูก hoist จึงพร้อมใช้ตั้งแต่บรรทัดแรก
Object.assign(module.exports, {
  resolveRound,
});

const CHAR_HOOKS = require("../../characters/index");
const Seraph = require("../../seraph");
const {
  DOOM_TIE_ATTACK_CHANCE, GOLD_WIN_BONUS, OVERLOAD_FORCE_CHANCE, SUMMARY_TIME, TRANSFORMS,
} = require("../constants");
const match = require("../match");
const { engine } = require("../engine");
const attack = require("./attack");
const characterRules = require("../characterRules");
const combat = require("../combat");
const cutscene = require("../cutscene");
const cardDeck = require("../deck");
const draw = require("./draw");
const mercury = require("../modes/mercury");
const purge = require("../modes/purge");
const overload = require("../overload");
const qteSystem = require("../qte");
const shop = require("../shop");
const skills = require("../skills");
const timers = require("../timers");
const view = require("../view");

// ---- สรุปผล ----
function resolveRound() {
  timers.clearPhaseTimer();
  // ดิโอ THE WORLD: ครบ 10 วิ (ตัวจับเวลาของ THE WORLD หมด) ไม่ใช่การเปิดไพ่ — ปิด THE WORLD แล้วคืนเวลา
  //  เฟสจั่วไพ่ที่เหลือตอนกดให้ทุกคน (endWorld ตั้ง timeLeft ไว้แล้ว) · checkAllLocked ไม่สรุปรอบระหว่างนี้อยู่แล้ว
  if (CHAR_HOOKS.dio.endWorldOnTimeout(engine)) {
    match.gameState = "PLAYING";
    timers.startPhaseTimer(match.timeLeft, resolveRound);
    view.broadcastState();
    draw.checkAllLocked();
    return;
  }
  match.explicitTargetIds = null; match.explicitActorId = null; // ข้อยกเว้นของการกระทำที่เพิ่งจบ ไม่ลามมาถึงผลหลังเปิดไพ่
  for (const p of combat.alivePlayers()) p.locked = true;
  match.anataMusicSeq = 0; // เพลง ANATA WAAAAAAAA จบลงเมื่อทุกคนพร้อมเปิดไพ่แล้ว

  // ข้อเสนอที่ยังไม่ตอบเมื่อถึงเวลาเปิดไพ่ = ถือว่าปฏิเสธ
  for (const p of Object.values(match.players)) {
    // Locacaca fruit (ซาโตรุ): ไม่ตอบก่อนเปิดไพ่ = ถือว่าปฏิเสธ
    if (p.locaOffer) {
      if (p.alive) skills.resolveLoca(p, match.players[p.locaOffer], false, true);
      else p.locaOffer = null;
    }
    // แบทแมน: นายลืมของน่ะ — ยังไม่เลือกเป้าหมายส่งต่อก่อนเปิดไพ่รอบถัดไป = สุ่มให้
    if (p.batKarmaAsk) {
      const ask = p.batKarmaAsk;
      p.batKarmaAsk = null;
      const options = ask.options.map((id) => match.players[id]).filter((o) => o && o.alive);
      const target = options.length ? options[Math.floor(Math.random() * options.length)] : null;
      combat.withEffectSource(p, () => CHAR_HOOKS.bat_ben.resolveKarmaSend(engine, p, target, ask.dmg));
    }
    // ริต้า เบอร์นัล: ขอแค่ได้พบกันอีก — ยังไม่เลือกเป้าหมายก่อนเปิดไพ่รอบถัดไป = สุ่มให้
    if (p.phenexReleaseAsk) {
      const ask = p.phenexReleaseAsk;
      p.phenexReleaseAsk = null;
      const options = ask.options.map((id) => match.players[id]).filter((o) => o && o.alive);
      const target = options.length ? options[Math.floor(Math.random() * options.length)] : null;
      combat.withEffectSource(p, () => CHAR_HOOKS.phenex.resolveRelease(engine, p, target, ask.pain));
    }
    // คอนเนอร์ RK800: ไม่ตอบคำขาดจับกุมก่อนเปิดไพ่ = ถือว่า "ขัดขืน" (การนิ่งเฉยไม่ใช่การยอมจำนน)
    //  live = false -> วีดีโอเริ่มไล่ล่าเข้าคิวไว้เฉยๆ ให้ afterResolve กวาดไปเล่น (ห้าม pausePlayingForCutscene ตอนนี้)
    if (p.connorArrestAsk) {
      if (p.alive) CHAR_HOOKS.conner.answerArrest(engine, p, false, false);
      else p.connorArrestAsk = null;
    }
  }
  // QTE ที่ยังเล่นไม่จบเมื่อถึงเวลาเปิดไพ่ = ถือว่าพลาด (แต้มเสียฟรี) เหมือนข้อเสนออื่นที่ไม่ตอบ
  qteSystem.sweepQte();
  // Recruit: QTE ของสกิลที่ยังไม่จบ = นับจุดที่คลิกได้ตอนนี้ · นัดที่รอเลือกเป้า = สุ่มเป้าให้
  for (const p of combat.alivePlayers()) if (CHAR_HOOKS.recruit.qteActive(p)) characterRules.recruitQteFinish(p, true);
  CHAR_HOOKS.recruit.sweepPick(engine);
  CHAR_HOOKS.striker.sweep(engine); // สไตรเกอร์ ยูเรก้า: ไม่ตอบ = ไม่อนุมัติ · ซ่อมไม่เสร็จ = ล้มเหลว
  // อุซากิ: หมดเฟสจั่วไพ่ = ข้อที่เหลือนับเป็นผิด · ข้อเสนอสลับไพ่ที่ยังไม่ตอบ = ไม่เอา
  CHAR_HOOKS.usagi.sweepQuizzes(engine);
  for (const p of Object.values(match.players)) if (p.usagiSwapOffer) combat.withEffectSource(p, () => CHAR_HOOKS.usagi.answerSwap(engine, p, false));

  // Bard: บทเพลงที่ยังไม่ได้เลือกเป้าหมายเมื่อถึงเวลาเปิดไพ่ = สุ่มเป้าหมายอัตโนมัติ (บทเพลงไม่สูญเปล่า)
  for (const p of combat.alivePlayers()) {
    if (!p.bardPending) continue;
    const song = p.bardPending;
    p.bardPending = null;
    const pool = combat.alivePlayers().filter((o) => song.allowSelf || o.id !== p.id);
    const picked = [];
    while (picked.length < song.need && pool.length) {
      picked.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0].id);
    }
    if (picked.length === song.need) {
      match.lastLog.push(`🎼 ${p.name} ไม่ได้เลือกเป้าหมาย ${song.name} — บทเพลงเลือกเป้าหมายเอง`);
      skills.bardPerform(p, song.pattern, picked, false);
    }
  }

  // ANATA WAAAAAAAA (เทมาริ): เปิดเผยเป้าหมาย + บังคับจั่วเพิ่ม 2 ใบหลังเปิดไพ่
  // ทำงานก่อนท่าไม้ตายอื่นเสมอ — ถ้าเป้าหมายแตกจากการบังคับจั่ว ท่าไม้ตายที่เพิ่งกดจะเป็นโมฆะ
  const anataProcs = [];
  for (const u of combat.alivePlayers()) {
    if (!u.anataTargets || !u.anataTargets.length) continue;
    if (cardDeck.bustedOf(u)) { u.anataTargets = null; continue; } // ผู้ใช้แตกเอง (โมฆะไปแล้วใน voidUltimateOnBust)
    for (const tid of u.anataTargets) {
      const t = match.players[tid];
      if (!t || !t.alive) continue;
      for (let i = 0; i < combat.TEMARI_ANATA_DRAWS; i++) { const c = cardDeck.drawCardFor(t); if (c) { t.cards.push(c); cardDeck.onCardDrawn(t, c); } } // patch 2.0.6: จั่วเพิ่ม 3 ใบ
      t.busted = cardDeck.bustedOf(t);
      match.lastLog.push(`🎤 ANATA WAAAAAAAA! ${u.name} บังคับ ${t.name} จั่วเพิ่ม ${combat.TEMARI_ANATA_DRAWS} ใบ${t.busted ? " — ไพ่แตก!" : ""}`);
      if (t.busted) { combat.voidUltimateOnBust(t); }
      anataProcs.push({ u, t });
    }
    u.anataTargets = null;
  }

  // ฟุจิตะ โคโตเนะ (characters/kotone.js): ท่าไม้ตายในร่าง [พร้อมลุย] — ทำงานหลังเปิดไพ่ แต่ต้องอยู่ "ก่อน"
  //  การหาผู้ชนะ เพราะผล "บังคับแตก" เปลี่ยนผู้ชนะของรอบนี้ (เหตุผลเดียวกับ ANATA ด้านบน)
  CHAR_HOOKS.kotone.resolveFormUlts(engine);
  // Bamboo-Hatted Kim (จักเฉือนเลือดเนื้อตน): หัว = แต้ม 0 · ก้อย = แต้ม 20 — ต้องอยู่ก่อนหาผู้ชนะด้วยเหตุผลเดียวกัน
  CHAR_HOOKS.kim.resolveUltScores(engine);
  // ดิโอ: เกจเวลาคิดจากแต้มสุดท้ายของเทิร์น (หลังทุกผลที่เปลี่ยนแต้ม · ก่อน Overload Force ที่ย้อนเทิร์นจะย้อนค่านี้ให้เอง)
  CHAR_HOOKS.dio.onRoundResolved(engine);
  // ---------- ดิโอ (Last stand, characters/dio.js) — ดวลแต้ม 1 รอบ เหตุผลเดียวกับการแข่งของไบรอันด้านล่างทุกประการ ----------
  if (CHAR_HOOKS.dio.duelResolveRound(engine)) {
    match.roundWinnerId = null;
    match.roundTiedWin = false;
    cutscene.runCutsceneQueue(goSummary);
    return;
  }

  // ---------- คอนเนอร์ RK800 (สกิลติดตัว 2 จับกุมขั้นเด็ดขาด, characters/conner.js) ----------
  //  ระหว่างการไล่ล่า: ไม่มีผู้ชนะ/ผู้แพ้ ไม่มีดาเมจแพ้จั่ว/ไพ่แตก ไม่มี Overload Force — นับแค่แต้มดวลกัน
  //  (roundWinnerId ค้างเป็น null -> afterSummary จะข้ามเฟสโจมตีให้เองอยู่แล้ว แต่ยังกันซ้ำอีกชั้นที่นั่น)
  // ---------- ไบรอัน (ท่าไม้ตาย 1 การแข่งที่มีเดิมพัน, characters/brian.js) ----------
  //  เหตุผลเดียวกับการไล่ล่าของคอนเนอร์ทุกประการ: ไม่มีผู้ชนะ/ผู้แพ้ของรอบ ไม่มีดาเมจแพ้จั่ว/ไพ่แตก
  //  และต้องข้าม afterResolve() ทั้งก้อน ไม่งั้นเอฟเฟกต์ที่ยิงใส่ "คนไพ่แตก" จะกวาดโดนคนที่ถูกแช่ไว้
  if (CHAR_HOOKS.brian.duelResolveRound(engine)) {
    match.roundWinnerId = null;
    match.roundTiedWin = false;
    cutscene.runCutsceneQueue(goSummary);
    return;
  }
  if (CHAR_HOOKS.conner.chaseResolveRound(engine)) {
    match.roundWinnerId = null;
    match.roundTiedWin = false;
    // ข้าม afterResolve() ทั้งก้อนโดยตั้งใจ — เอฟเฟกต์หลังเปิดไพ่ที่ยิงใส่ "คนที่ไพ่แตก" (Ashen Trail ของโอกูริ,
    //  ถึงจะมองไม่เห็นฯ ของทาคุมิ ฯลฯ) จะกวาดโดนคนที่ถูกแช่ไว้ ทั้งที่กติกาไล่ล่าระบุว่าพวกเขาไม่รับความเสียหาย
    //  จากการถูกบังคับให้ไพ่แตก -> ไปสรุปผลตรงๆ หลังเล่นคลิปที่คิวไว้จบ
    cutscene.runCutsceneQueue(goSummary);
    return;
  }

  // ORT: ทุกคนเปิดไพ่แล้ว -> จั่วแก้มืออีกได้ไม่เกิน 2 ใบ แล้วคิดทริกเกอร์สีเหมือนกดเปิดไพ่
  //  (อยู่หลัง ANATA/ท่าที่บังคับจั่ว ORT จึงเห็นแต้มสุดท้ายของทุกคนก่อนตัดสิน)
  { const boss = CHAR_HOOKS.ort.finalDraw(engine); if (boss) cardDeck.applyLockColorTriggers(boss); }

  // SE.RA.PH: วันที่ 1-6 = ทุกคน · วันที่ 7 = เฉพาะคู่ที่กำลังดวล (คนอื่นเป็นผู้ชม)
  // Purge: เฉพาะคนในจุดปะทะ (คนอื่นเป็นผู้ชม)
  const combatants = Seraph.active() ? Seraph.combatants(engine) : purge.purgeActive() ? purge.combatants() : combat.alivePlayers();
  match.roundWinnerId = null;

  if (combatants.length < 2) {
    match.lastLog.push("รอบนี้ไม่มีการต่อสู้ (ผู้เล่นไม่พอ)");
    afterResolve();
    return;
  }

  const val = (p) => (cardDeck.bustedOf(p) ? -1 : cardDeck.scoreOf(p));
  const best = Math.max(...combatants.map(val));
  const worst = Math.min(...combatants.map(val));

  if (best >= 0) {
    const tied = combatants.filter((p) => val(p) === best);
    // สนาม Overload ต้องสุ่มก่อน Rip and Tear ของ DoomGuy เสมอ และเกิดได้เฉพาะตอนแต้มสูงสุดเสมอกันจริง
    // SE.RA.PH: Overload Force ทำงานเฉพาะวันที่ 7 และห้ามเรียกบอสยูกิทุกกรณี (§7 + §12)
    // Purge: ไม่มี Overload Force (การย้อนเทิร์นไม่ย้อนตำแหน่งในท่อ)
    if (!Seraph.active() && !mercury.mercuryActive() && !purge.purgeActive() && !match.overloadForceActive && !CHAR_HOOKS.muimi.blocksOverloadForce(engine) && tied.length >= 2 && Math.random() < OVERLOAD_FORCE_CHANCE) {
      overload.triggerOverloadForce();
      return;
    }
    // DoomGuy (characters/doomguy.js) สกิลติดตัว: เสมอแต้มกับผู้เล่นอื่น -> โรล DOOM_TIE_ATTACK_CHANCE
    //  "ก่อน" สุ่มผู้ชนะ ติดแล้วได้เป็นผู้ชนะและได้เทิร์นโจมตีทันที
    //  บั๊กเดิม (แก้ที่นี่): โรลนี้เคยอยู่ใน afterSummary() ซึ่งทำงานหลังสุ่มผู้ชนะไปแล้ว และเช็คเฉพาะคนที่
    //  ถูกสุ่มได้เท่านั้น -> ถ้าดูมกายเสมอแต่ไม่ถูกสุ่ม ก็ไม่ได้โรลเลย ทำให้โอกาสจริงถูกหารด้วยจำนวนคนที่เสมอ
    //  (เสมอหลายคนยังโรลรายตัว แต่โอกาสต่อ DoomGuy ต้องอิง DOOM_TIE_ATTACK_CHANCE ตามคำอธิบายสกิล)
    let w = null;
    if (tied.length > 1) {
      for (const d of tied.filter((p) => p.characterId === "doomguy")) {
        if (CHAR_HOOKS.doomguy.tryTieAttack(engine, d)) { w = d; match.doomTieAttack = true; break; }
      }
    }
    if (!w) w = tied[Math.floor(Math.random() * tied.length)];
    match.roundWinnerId = w.id;
    match.roundTiedWin = tied.length > 1; // เสมอแต้มกัน -> ยังได้แต้มสกิล/ท่าไม้ตายทำงานปกติ แต่ไม่มีเทิร์นโจมตี
    w.isWinner = true;
    w.result = "win";
    // เท็นโนจิ โคทาโร่: ชนะในเทิร์นที่เขียนใหม่ -> หนี้เลือดถูกลบ · และอาร์มโควตาโจมตีของกรงเล็บ
    // เทเปา (characters/tepeu.js): รีเซ็ตเคาน์เตอร์แพ้ติดกัน + สมองอันชาญฉลาด
    CHAR_HOOKS.tepeu.onRoundWin(engine, w, combatants);
    // คอนเนอร์ RK800 (สกิลติดตัว 1 สืบสวน): การชนะการจั่ว = ความเครียด +1
    CHAR_HOOKS.conner.onRoundWin(engine, w);
    // ไบรอัน (สกิลติดตัว น้ำมันรถ): ชนะการจั่วได้น้ำมัน +2 (ได้แม้อยู่ในร่างรถ)
    CHAR_HOOKS.brian.onRoundWin(engine, w);
    // ระบบเหรียญ (patch 2.2 full): ชนะการจั่วได้เหรียญเพิ่ม +1 (เพดาน 30)
    shop.addGold(w, GOLD_WIN_BONUS);
    // SE.RA.PH วันที่ 1-6: รางวัลผู้ชนะคือ Matrix +1 (มาแทนเฟสโจมตีของเกมปกติ)
    Seraph.onRoundWinner(engine, w);
    // Purge: ผู้ชนะการปะทะ (ไม่เสมอ) — คนอื่นในจุดนั้นถอยหลัง
    purge.onFightResult(w);
    // patch 2.1.3.5: ชนะจั่วการ์ดไม่ได้แต้มสกิลอีกต่อไป
    combat.firePassive(w, "win");
    if (tied.length > 1) {
      if (match.doomTieAttack) match.lastLog.push(`เสมอที่ ${best} แต้ม — ${w.name} สกิลติดตัว Rip and Tear ทำงาน (โอกาส ${Math.round(DOOM_TIE_ATTACK_CHANCE * 100)}%) ได้เป็นผู้ชนะและยังได้โจมตี!`);
      else match.lastLog.push(`เสมอที่ ${best} แต้ม — สุ่มผู้ชนะได้ ${w.name} (เสมอ ไม่มีเทิร์นโจมตี)`);
    }
  }

  // ---------- อาจารย์ ไบเลธ หลักสูตร "จบการศึกษา": ปลดล็อกการโจมตีตอบหลังผู้ชนะตี ----------
  //  เงื่อนไขคือ "ไบเลธแต้มน้อยสุดของเทิร์นแบบไพ่ไม่แตก" ซึ่ง **ไม่ใช่ชุดเดียวกับ "ผู้แพ้ของเทิร์น"**
  //  บั๊กเดิม: มาร์กนี้ถูกวางไว้ในลูปผู้แพ้ซึ่งกรองด้วย val(p) === worst — แต่ val() ให้คนไพ่แตกเป็น -1
  //  ทำให้ worst = -1 ทันทีที่มีใครไพ่แตกแม้แต่คนเดียว ลูปนั้นจึงเหลือแต่คนไพ่แตก และเงื่อนไข
  //  !bustedOf(l) ที่คร่อมไว้ก็เป็นเท็จเสมอ = ไบเลธไม่เคยถูกมาร์กเลยทุกเทิร์นที่มีคนไพ่แตก
  //  (ผลคือ "ตีตอบ" แทบไม่ทำงานจริงในเกม) -> คิดจากกลุ่ม "ไพ่ไม่แตก" แยกออกมาต่างหาก
  // SE.RA.PH วันที่ 1-6: **ไม่มีใครเสียเลือด/เกราะ และไม่มีใครได้แต้มสกิล** (§5 + §14 ข้อ 3)
  //  วันธรรมดาคือการแข่งแต้มล้วนเพื่อชิงรางวัล ไม่ใช่การต่อสู้ — ยังปักธง isLoser ไว้ให้ UI โชว์อันดับได้
  if (Seraph.noCombat()) {
    if (best !== worst) {
      for (const l of combatants.filter((p) => val(p) === worst && p.id !== match.roundWinnerId)) {
        l.isLoser = true;
        l.result = "lose";
      }
    }
  } else if (best !== worst) {
    for (const l of combatants.filter((p) => val(p) === worst && p.id !== match.roundWinnerId)) {
      l.isLoser = true;
      l.result = "lose";
      if (combat.sealActive(l)) {
        // เรจูอาคมบัญชา (อมตะ): ไม่รับความเสียหายใดๆ เทิร์นนี้
        combat.firePassive(l, "lose");
        match.lastLog.push(`📜 ${l.name} อาคมบัญชาคุ้มครอง — ไม่รับความเสียหายจากการแพ้`);
        continue;
      }
      if (l.beatSaved) {
        // หลังกันตายทำงานแล้ว: ความเสียหายจากการแพ้ตอนจั่วการ์ดไม่มีผล ไม่ว่าห่าง 21 แค่ไหน
        combat.firePassive(l, "lose");
        match.lastLog.push(`⚡ ${l.name} กันตายทำงานแล้ว — ไม่รับความเสียหายจากการแพ้`);
        continue;
      }
      if ((l.statuses.monster || 0) > 0) {
        // ร่างไคจู (MonsterLive): แพ้เพราะแต้มน้อยสุด/ไพ่แตก รับความเสียหายน้อยลง 1 หน่วย (1 -> 0)
        combat.firePassive(l, "lose");
        match.lastLog.push(`🦖 ${l.name} ร่างไคจู — ไม่รับความเสียหายจากการแพ้`);
        continue;
      }
      if (cardDeck.bustedOf(l) && CHAR_HOOKS.haruka.bustDamageImmune(l)) {
        // New Omega (ฮารุกะ): โดนบังคับให้ไพ่แตก จึงไม่รับความเสียหายจากการแตกครั้งนี้
        combat.firePassive(l, "lose");
        match.lastLog.push(`💥 ${l.name} โดน New Omega ระเบิดแต้มการ์ด — ไม่รับความเสียหายจากการที่ไพ่แตก`);
        continue;
      }
      if (CHAR_HOOKS.takt.lossDamageImmune(l)) {
        // อาซาฮินะ ทักต์ (ตระกูลอาซาฮินะ): ไม่รับความเสียหายจากการแพ้รอบ ทั้งแต้มน้อยสุดและไพ่แตก
        combat.firePassive(l, "lose");
        match.lastLog.push(`🎼 ${l.name} ตระกูลอาซาฮินะ — ไม่รับความเสียหายจากการ${cardDeck.bustedOf(l) ? "ที่ไพ่แตก" : "แพ้"}`);
        continue;
      }
      if (cardDeck.bustedOf(l) && CHAR_HOOKS.escanor.bustDamageImmune(l)) {
        // เอสคานอร์ร่าง Last Stand: ไม่รับความเสียหายจากการที่ไพ่แตก
        combat.firePassive(l, "lose");
        match.lastLog.push(`🔥 ${l.name} Last Stand — ไม่รับความเสียหายจากการที่ไพ่แตก`);
        continue;
      }
      if (CHAR_HOOKS.producer_lumi.isLossImmune(engine, l)) {
        // โปรดิวเซอร์ (ความฝันของฉันคือเธอ): ขณะท่าไม้ตายทำงาน ไม่รับดาเมจแพ้จั่ว/ไพ่แตก
        combat.firePassive(l, "lose");
        match.lastLog.push(`🌈 ${l.name} ความฝันของฉันคือเธอ — ไม่รับความเสียหายจากการแพ้/ไพ่แตก`);
        continue;
      }
      let lossDmg = 1;
      // เต็มอิ่ม (Breakfast โอกูริ patch 2.0.8.1): ดาเมจที่ได้รับ -1 (รวมดาเมจแพ้จั่ว/แตก)
      if ((l.statuses.fullbelly || 0) > 0 && lossDmg > 0) {
        lossDmg = Math.max(0, lossDmg - 1);
        match.lastLog.push(`🥖 ${l.name} เต็มอิ่ม — ดาเมจจากการแพ้ลดลง 1`);
      }
      for (let i = 0; i < lossDmg; i++) combat.damageSoft(l);
      // Beat Mode กันตาย: ทำงานทันทีแม้ความเสียหายถึงตายมาจากการแพ้จั่ว/แตก
      combat.maybeBeatSave(l);
      CHAR_HOOKS.mageslayer.onBustOrLoseRoll(engine, l);
      combat.firePassive(l, "lose");
      match.lastLog.push(`${l.name} แต้มน้อยสุด รับความเสียหาย -${lossDmg}`);
    }
  }
  for (const p of combatants) if (!p.result) p.result = "safe";
  // Bamboo-Hatted Kim: ท่าไม้ตาย 1 — แพ้ = To Claim Their Bones แล้วได้ Yield My Flesh (อ่าน isLoser ที่เพิ่งตัดสิน)
  CHAR_HOOKS.kim.onRoundResult(engine);
  // มุยมิ: นับแพ้/ไพ่แตกต่อเนื่องหลังผลของทุกคนถูกกำหนดครบแล้ว
  CHAR_HOOKS.muimi.onAfterRoundScores(engine, combatants);
  CHAR_HOOKS.hisakawa_sister.onAfterRoundScores(engine, combatants, match.roundWinnerId, val);

  // เทเปา (characters/tepeu.js): มีเทเปายังอยู่ในสนาม -> ใครแพ้ติดกันเกิน 3 เทิร์น เส้นชีวิตลดลง 1 หน่วย
  CHAR_HOOKS.tepeu.onRoundLoseStreak(engine, combatants);

  // สกิลติดตัว เนตรมารแห่งความมรณะ (ชิกิ, characters/shiki.js): เปิดไพ่แล้วแต้มเท่ากับผู้เล่นอื่น -> ติดเส้นชีวิตถาวร
  CHAR_HOOKS.shiki.onScoreTiePassive(engine, combatants);

  // สกิลติดตัว หิวอะโปรดิวเซอร์ (เทมาริ patch 1.7.6): เป้าหมาย ANATA WAAAAAAAA แพ้หรือไพ่แตก
  // -> โดนขิงจนช้ำ รับความเสียหายตามโบนัส Song for you เท่านั้น (ไม่นับพลังโจมตีปกติ — สูงสุด 2)
  // ต่อให้เทมาริไม่ชนะ/แพ้ในตานั้นก็ตาม — และฉากของสกิลนี้ขึ้นก่อนทุกท่าไม้ตาย
  let anataFinalShown = false;
  for (const { u, t } of anataProcs) {
    if (!t.alive || !(cardDeck.bustedOf(t) || t.isLoser)) continue;
    let dmg = combat.songActive(u) ? (u.songAtk || 0) : 0;
    combat.dealDirect(t, dmg); // patch 2.0.6: การขิงทำดาเมจแบบไม่สนเกราะ
    combat.maybeBeatSave(t); // กันตายทำงานทันทีถ้าโดนขิงจนถึงตาย
    t.wasAttacked = true;
    combat.addSkill(t, 1);
    match.lastLog.push(`🎤 หิวอะโปรดิวเซอร์! ${t.name} โดนขิงจนช้ำ -${dmg}`);
    if (!anataFinalShown) {
      anataFinalShown = true;
      cutscene.triggerCutscene(u, "anataFinal"); // เข้าคิวก่อน afterResolve -> ขึ้นก่อนท่าไม้ตายอื่นเสมอ
    }
  }

  afterResolve();
}

// เปิดร่างท่าไม้ตาย (หลังเปิดไพ่) -> cutscene ก่อนสรุปผล (สรุปผลไว้ท้ายสุดเสมอ)
//  หมายเหตุ: สกิลทั่วไปไม่มีแบนเนอร์ก่อนสรุปผลแล้ว — instant เด้งตอนใช้ / หลังเปิดไพ่ไปโชว์ตอนโจมตี
function afterResolve() {
  // ---------- เทเปา (characters/tepeu.js): นายเป็นคนทำตัวเองนะ — ผลสังหาร/พลาดทำงานหลังเปิดไพ่ทุกคน ----------
  CHAR_HOOKS.tepeu.resolveAllKills(engine);
  // ---------- Ashen Trail: Cinderella Gray (โอกูริ, characters/oguri.js): หลังเปิดไพ่ — โจมตีทุกคนที่ไพ่แตก ----------
  CHAR_HOOKS.oguri.onAfterResolveAshenTrail(engine);
  CHAR_HOOKS.escanor.onAfterResolve(engine);
  // ---------- ทาคุมิ ฟุจิวาระ (characters/takumi.js): ถึงจะมองไม่เห็น แต่ฉันยังอยู่ — คนแรกที่ไพ่แตกระหว่างบัฟยังทำงาน ----------
  CHAR_HOOKS.takumi.tryBustTrigger(engine);
  // ---------- โมโรโบชิ ดัน (characters/dan.js): "จงหลบแต่อย่าหนี" ลงโทษเป้าหมาย + ครูฝึกสุดเหี้ยมกวาดคนไพ่แตก ----------
  //  ต้องอยู่หลังเอฟเฟกต์ที่กวาดคนไพ่แตกตัวอื่น เพื่อให้ผลบวก 1 หน่วยของสกิลติดตัวเป็นชั้นสุดท้ายเสมอ
  CHAR_HOOKS.dan.onAfterResolve(engine);
  // ---------- ยุย (characters/yui.js): my soul your beats — ไพ่แตกกลางจังหวะเพลงรับความเสียหาย ----------
  CHAR_HOOKS.yui.onAfterResolve(engine);
  // ---------- แบทแมน (characters/bat_ben.js): แกไม่รอดแน่ — พุ่งชนคนที่ไพ่แตก ----------
  CHAR_HOOKS.bat_ben.onAfterResolve(engine);

  const activated = [];
  for (const p of combat.alivePlayers()) {
    const pBusted = cardDeck.bustedOf(p); // ไพ่แตก = ท่าไม้ตายไม่ทำงาน (กันหลุดกรณีเพิ่งกดแล้วแตก)
    for (const key of Object.keys(TRANSFORMS)) {
      if (!TRANSFORMS[key].afterReveal) continue;
      if (pBusted) continue;
      if ((p.statuses[key] || 0) > 0 && !p.seen[key]) {
        p.seen[key] = true;
        p.transformAt = ++match.transformCounter;
        cutscene.triggerCutscene(p, key);
        match.lastLog.push(`✨ ${p.name} ${TRANSFORMS[key].label} ${TRANSFORMS[key].title}!`);
        activated.push(p);
      }
    }
  }
  // สวนท่าไม้ตายกัน: เอาเพลงของผู้ชนะ (ถ้าไม่มีผู้ชนะ = คนที่เปิดหลังสุด ซึ่ง transformAt สูงสุดอยู่แล้ว)
  if (activated.length > 1) {
    const winner = activated.find((p) => p.id === match.roundWinnerId);
    if (winner) winner.transformAt = ++match.transformCounter;
  }
  // Beat Mode: ถ้าใครเลือดตกต่ำกว่า 3 จากการแพ้รอบนี้ -> เข้าประกายเขี้ยวปฏิปักษ์
  for (const p of combat.alivePlayers()) combat.maybeBeatMode(p);
  cutscene.runCutsceneQueue(goSummary);
}

function goSummary() {
  draw.flushOrtCounters(); // เอฟเฟกต์หลังเปิดไพ่ (afterResolve) ที่ลงใส่ ORT
  match.gameState = "SUMMARY";
  timers.startPhaseTimer(SUMMARY_TIME, attack.afterSummary);
  view.broadcastState();
}
