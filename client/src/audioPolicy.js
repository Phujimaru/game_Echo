// Shared music priorities for the regular board and Moon Cell.
// ECHO 5.1: main5 เล่นเฉพาะใน launcher ของโปรแกรม · เข้าห้องแล้ว (เลือกลำดับ/ตัวละคร/ห้องรอ/โหวตโหมด/จัดทีม + ฉากเปิดตัวแมตช์) = lobby5 จนเข้าด่าน
export function musicForState(state, { lowQ = false, scene = null, cycleSeq = 0, attackSeq = 0, intro = false } = {}) {
  const phase = state?.gameState;
  if (!phase) return { name: "lobby5" };
  if (["LOBBY", "TEAM_MODE", "TEAM_SETUP"].includes(phase)) return { name: "lobby5" };
  if (intro && !state?.seraph) return { name: "lobby5" };
  const cs = phase === "CUTSCENE" ? state.cutscene : null;
  // Echo: ฉากเปิดตัวร่างยักษ์ (kind "echoQueen" — จะเพิ่มตอนย้ายฉากจากต้นแบบเข้าเกม) เล่นเพลงราชินีตั้งแต่ต้นฉาก ไม่เงียบแบบคัตซีนอื่น
  if (cs?.kind === "echoQueen" && state.skillMusic) return { name: state.skillMusic, seq: state.skillMusicSeq };
  const mandatory = cs?.kind === "overloadForce";
  const sc = state?.seraph;
  // Moon Cell วันที่ 1-6 + คืนวันที่ 7 (เดินแมพ): ไม่มีที่เล่นคลิป — คัตซีนไม่ตัดเพลง (ตัดแล้วจะเงียบเปล่า ๆ ตามความยาวคลิป)
  const scInvestigation = !!sc && (sc.noCombat ?? sc.day !== (sc.duelDay || sc.daysTotal));
  if (cs && !scInvestigation && (!lowQ || mandatory || cs.announce)) return { name: null };
  if (sc) {
    // จบแมตช์: เงียบ ให้ฉากผู้ชนะคนสุดท้ายเล่นเสียงของตัวเอง (เพลงดวลต้องไม่วนค้างใต้ฉาก)
    if (phase === "GAMEOVER" || scene === "final") return { name: null };
    if (scene === "pairing" || scene === "duelIntro") return { name: null };
    if (!scInvestigation) {
      // วันดวลเรียงลำดับแบบเกมหลัก: เพลงสกิล -> เพลงช่วงโจมตี -> เพลงดวลของโหมด
      if (state.skillMusic) return { name: state.skillMusic, seq: state.skillMusicSeq };
      if (phase === "ATTACK" || phase === "ATTACKING") return { name: "battle_phase", seq: attackSeq };
      return { name: sc.night ? "sc_duel_night" : "sc_duel_day", seq: sc.cycleRound };
    }
    // เดินแมพ = เพลงวันสืบสวน · อยู่ในสถานที่ / คืนวันที่ 7 = เพลงพัก
    return { name: scene === "place" || sc.duelNight ? "sc_rest" : "sc_day" };
  }
  // การเดินทาง: ฉากเปลี่ยนภูมิภาค (ลูกโลก) ไม่มีเพลงของตัวเอง — state.journey เป็นภูมิภาคปลายทางแล้ว
  //  เพลงประจำภูมิภาคใหม่จึงเริ่มตั้งแต่ฉากเริ่ม (App ขยับ cycleSeq เมื่อภูมิภาค/ช่วงเวลาเปลี่ยน)
  const journey = state?.journey;
  // Purge: ระหว่างฉากซูมออก (ฉากเปิด/จบเทิร์น) เล่นเฉพาะเพลงด่าน — เพลงท่าไม้ตาย/ช่วงโจมตีของผู้เล่นปิดไว้ก่อน
  const purgeTrack = purgeMusic(state);
  if (purgeTrack && state.purge.scene?.active && phase === "CUTSCENE") return { name: purgeTrack };
  if (state?.skillMusic) return { name: state.skillMusic, seq: state.skillMusicSeq };
  // Type Mercury: เพลงประจำตัว ORT ตลอดทั้ง Raid (รวมฉากเปิดตัว ORT ซึ่งเป็นเฟส CUTSCENE ที่ไม่มีคลิป)
  if (state?.mercury && ["PLAYING", "SUMMARY", "ATTACK", "ATTACKING", "TRANSITION", "CUTSCENE"].includes(phase)) return { name: "ort_theme" };
  if (state?.ortArrival?.active && phase === "CUTSCENE") return { name: "ort_theme" };
  // ช่วงโจมตี: เพลงเฉพาะกิจทับเพลงกลางวัน/กลางคืน และเริ่มจากต้นทุกครั้งที่เข้าช่วง (attackSeq ขยับ)
  if (phase === "ATTACK" || phase === "ATTACKING") return { name: "battle_phase", seq: attackSeq };
  if (purgeTrack && ["PURGE_ROLL", "PLAYING", "SUMMARY", "TRANSITION", "CUTSCENE"].includes(phase)) return { name: purgeTrack };
  if (["PLAYING", "SUMMARY", "ATTACK", "ATTACKING", "TRANSITION", "CUTSCENE"].includes(phase)) {
    // การเดินทาง (ffa/duo/trio): เพลงประจำภูมิภาค แยกกลางวัน/กลางคืน
    if (journey) return { name: `journey_${journey.area}_${journey.night ? "night" : "day"}`, seq: cycleSeq };
    return { name: state.cycle === "night" ? "new_night" : "new_morning", seq: cycleSeq };
  }
  return { name: "main_home" };
}

// เฟสที่นับว่า "อยู่ในแมตช์" — ข้ามขอบนี้เมื่อไหร่ App รีเซ็ตตำแหน่งเพลงทั้งหมด (เพลงเริ่มจากต้น)
//  PURGE_ROLL ต้องอยู่ในนี้ ไม่งั้นทุกเทิร์นของ Purge (ทอยเต๋า ↔ ฉาก ORT) เพลงด่านจะเริ่มใหม่
//  SERAPH_PLACE ก็เช่นกัน (Moon Cell เข้าเฟสเลือกสถานที่ทุกวัน)
export function isMatchPhase(phase) {
  return ["PLAYING", "SUMMARY", "ATTACK", "ATTACKING", "TRANSITION", "CUTSCENE", "PURGE_ROLL", "SERAPH_PLACE"].includes(phase);
}

// Purge: เพลงด่านตามสถานการณ์ในท่อ (ลำดับความสำคัญจากบนลงล่าง)
//  เหลือ 2 คนสุดท้าย (เกมที่เริ่ม 3 คนขึ้นไป) → ORT ห่างผู้เล่นที่ยังรอดคนใดคนหนึ่งไม่เกิน 3 ช่อง → ORT โผล่แล้ว → ก่อน ORT โผล่
export function purgeMusic(state) {
  const pg = state?.purge;
  if (!pg) return null;
  const humans = (state.players || []).filter((p) => !p.isBoss);
  const alive = humans.filter((p) => p.alive && !pg.pl?.[p.id]?.finished);
  if (humans.length >= 3 && alive.length === 2) return "purge_final";
  if (pg.ort == null) return "purge_normal";
  const prog = (id) => pg.board?.nodes?.find((n) => n.id === pg.pl?.[id]?.node)?.prog ?? 0;
  if (alive.some((p) => prog(p.id) - pg.ort <= 3)) return "purge_close";
  return "purge_ort";
}

// Cutscenes can sit between drawing and summary; attack IDs can change without a phase change.
export function createPhaseSoundTracker() {
  let drawing = false;
  let lastSummary = null;
  let lastAttack = null;
  return (state) => {
    const phase = state?.gameState;
    if (!phase || ["LOBBY", "TEAM_MODE", "TEAM_SETUP", "GAMEOVER"].includes(phase)) {
      drawing = false; lastSummary = null; lastAttack = null;
    }
    if (phase === "PLAYING") drawing = true;
    const roundEnded = phase === "SUMMARY" && drawing && lastSummary !== state.roundNumber;
    if (roundEnded) { lastSummary = state.roundNumber; drawing = false; }
    const attack = phase === "ATTACKING" && state.attack && state.attack.id !== lastAttack;
    if (attack) lastAttack = state.attack.id;
    return { roundEnded, attack: !!attack };
  };
}
