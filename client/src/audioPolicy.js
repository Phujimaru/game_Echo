// Shared music priorities for the regular board and Moon Cell.
// ECHO 5.1: ยังไม่เข้าห้อง (เลือกลำดับ/ตัวละคร) = main5 · ห้องรอ/โหวตโหมด/จัดทีม + ฉากเปิดตัวแมตช์ (intro) = lobby5
export function musicForState(state, { lowQ = false, scene = null, cycleSeq = 0, attackSeq = 0, intro = false } = {}) {
  const phase = state?.gameState;
  if (!phase) return { name: "main5" };
  if (["LOBBY", "TEAM_MODE", "TEAM_SETUP"].includes(phase)) return { name: "lobby5" };
  if (intro && !state?.seraph) return { name: "lobby5" };
  const cs = phase === "CUTSCENE" ? state.cutscene : null;
  const mandatory = cs?.kind === "overloadForce";
  if (cs && (!lowQ || mandatory || cs.announce)) return { name: null };
  const sc = state?.seraph;
  if (sc) {
    if (scene === "pairing" || scene === "duelIntro") return { name: null };
    if (sc.day === (sc.duelDay || sc.daysTotal)) {
      if (state.skillMusic) return { name: state.skillMusic, seq: state.skillMusicSeq };
      return { name: sc.night ? "sc_duel_night" : "sc_duel_day", seq: sc.cycleRound };
    }
    return { name: phase === "SERAPH_PLACE" ? "sc_rest" : "sc_day" };
  }
  // การเดินทาง: ระหว่างฉากแผนที่ (เริ่มเกม / เข้าภูมิภาคใหม่) เพลง map.mp3 ทับทุกอย่าง — เริ่มใหม่ทุกฉาก (seq)
  const journey = state?.journey;
  if (journey?.scene?.active && ["PLAYING", "SUMMARY", "ATTACK", "ATTACKING", "TRANSITION", "CUTSCENE"].includes(phase)) {
    return { name: "journey_map", seq: journey.scene.seq };
  }
  if (state?.skillMusic) return { name: state.skillMusic, seq: state.skillMusicSeq };
  // Type Mercury: เพลงประจำตัว ORT ตลอดทั้ง Raid (รวมฉากเปิดตัว ORT ซึ่งเป็นเฟส CUTSCENE ที่ไม่มีคลิป)
  if (state?.mercury && ["PLAYING", "SUMMARY", "ATTACK", "ATTACKING", "TRANSITION", "CUTSCENE"].includes(phase)) return { name: "ort_theme" };
  if (state?.ortArrival?.active && phase === "CUTSCENE") return { name: "ort_theme" };
  // ช่วงโจมตี: เพลงเฉพาะกิจทับเพลงกลางวัน/กลางคืน และเริ่มจากต้นทุกครั้งที่เข้าช่วง (attackSeq ขยับ)
  if (phase === "ATTACK" || phase === "ATTACKING") return { name: "battle_phase", seq: attackSeq };
  if (["PLAYING", "SUMMARY", "ATTACK", "ATTACKING", "TRANSITION", "CUTSCENE"].includes(phase)) {
    // การเดินทาง (ffa/duo/trio): เพลงประจำภูมิภาค แยกกลางวัน/กลางคืน
    if (journey) return { name: `journey_${journey.area}_${journey.night ? "night" : "day"}`, seq: cycleSeq };
    return { name: state.cycle === "night" ? "new_night" : "new_morning", seq: cycleSeq };
  }
  return { name: "main_home" };
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
