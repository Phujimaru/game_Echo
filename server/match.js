// สถานะของแมตช์ที่กำลังเล่น (เดิมเป็นตัวแปร let ระดับไฟล์ใน server.js)
//  ทุกไฟล์ใน server/ อ่าน/เขียนผ่าน match.<ชื่อ> — ห้าม destructure ออกมาเก็บไว้ (ค่าจะไม่อัปเดตตาม)

const match = {
  cycleShift: 0,
  // แสงสว่างที่สรรค์สร้าง (อควาเรียน patch 2.0): บังคับกลางวันจนถึงรอบที่กำหนด (เขียนทับวงจรปกติชั่วคราว)
  dayForceUntil: 0,
  linkMirror: false, // กันสะท้อนวนไม่รู้จบระหว่างคู่เชื่อม
  // ---------- ไค ชิซากิ (kai) ----------
  //  "เชื่อมต่อ" (kaiLink) — โค้ดแยกอิสระจาก linkedBuddyOf ของ Bard ข้างบนโดยสิ้นเชิง (ดู characters/kai.js)
  //  kaiOverhaulSlots: เกมมีห้องเดียว ไม่มีระบบ multi-room (grep แล้วไม่พบ rooms[) — module-level array
  //  [{ ownerId, playerId, status: "kaiCreation"|"kaiPunishment" }] แยกชุดละ 2 ช่องต่อ Kai เจ้าของมาร์ก
  kaiOverhaulSlots: [],

  // ---------- สถานะเกมส่วนกลาง ----------
  players: {},
  gameState: "LOBBY", // LOBBY | TEAM_MODE | TEAM_SETUP | PLAYING | CUTSCENE | SUMMARY | ATTACK | TRANSITION | GAMEOVER
  gameMode: "ffa", // ffa | duo | trio | mercury | purge | pending
  teamSize: 1,
  teamCount: 0,
  winningTeamId: null,
  modeVotes: {},
  mercuryLost: new Set(),   // characterId ที่ตายไปแล้วในรอบ Raid นี้
  mercuryResult: null,      // "win" | "lose" | "surrender" — ผลของ Raid ที่จบแล้ว
  mercuryHold: false,       // ผู้เล่นตายหมดและยังไม่มีใครเลือกตัวใหม่ -> เกมหยุดรอ เวลาไม่เดิน
  mercurySurrender: null,   // { votes: { [playerId]: true|false }, endsAt, timer }
  ortArrivalSeq: 0,         // เพิ่มทุกครั้งที่ ORT ปรากฏตัว (เริ่ม Raid) -> client เล่นฉากเปิดตัว
  ortArrivalActive: false,  // กำลังพักเกมรอฉากเปิดตัว ORT อยู่ (client ใช้ตัดสินว่าจะเล่นฉากไหม — รีคอนเนกต์กลางเกมไม่เล่นซ้ำ)
  // โหมด Purge (server/modes/purge.js): { steps: {id: ช่อง}, ort, lost, turnFrom, scene, seq, result }
  purge: null,
  journeyScene: null, // { seq, active, mode: "start" | "advance", area, fromArea }
  journeySceneSeq: 0,
  ortFxSeq: 0,
  // เป้าหมายที่ผู้เล่น "กดเลือกเอง" ในการกระทำที่กำลังทำงาน (สกิล/ไอเทม) — Type Mercury ใช้ยกเว้นกฎทีมเดียวกัน
  //  ให้สกิลที่เล็งเพื่อนร่วมทีมเกิดผลจริง (มอบบัฟ/รับศิษย์ ฯลฯ) ส่วนผลหมู่ที่ไม่ได้เล็งยังไม่ลงเพื่อน
  //  ยกเว้นเฉพาะคู่ "ผู้ใช้ -> เป้าที่เลือก" (ไม่นับ id ของผู้ใช้เอง) — ผลหมู่ของสกิลเดียวกันยังไม่ลงเพื่อนคนอื่น
  //  และ client ปลอมรายชื่อเป้าเพื่อเปิดทางให้สกิลหมู่ลงเพื่อนทั้งทีมไม่ได้
  explicitTargetIds: null,
  explicitActorId: null,
  effectSourceId: null,
  timeLeft: 0,
  phaseTimerId: null,
  attackerId: null,
  // Echo "นี่มันเกมของฉัน": เฟสโจมตีย่อยของตีฟรีที่แทรกกลางช่วงจั่วไพ่ (server/phases/echoFreeHit.js)
  //  { echoId, then, resume, prevAttackerId } — มีค่า = endTurn()/postAttackFollowup() ต้องคืนเฟสแทนการจบเทิร์น
  echoFreeHit: null,
  roundWinnerId: null,
  roundTiedWin: false,  // ผู้ชนะได้จากการเสมอแต้ม -> ไม่มีเทิร์นโจมตีรอบนี้
  doomTieAttack: false, // DoomGuy สกิลติดตัว: เสมอแต้มแล้วโรลติด -> ได้เป็นผู้ชนะและได้โจมตีรอบนี้
  overloadForceActive: false, // สนามพิเศษมีผลเฉพาะเทิร์นที่สุ่มติด
  overloadForceSeq: 0,        // เริ่มวิดีโอและเพลงใหม่ทุกครั้งที่เกิด
  overloadForceCount: 0,      // ครั้งที่เกิดในแมตช์
  roundNumber: 0,
  centralDeck: [], // กองกลาง 43 ใบ (สับใหม่ทุกรอบใน dealRound())
  lastLog: [],
  reservations: {},
  cutsceneQueue: [],
  cutsceneInfo: null,
  cutsceneSeq: 0,      // id ต่อ cutscene (ให้ client remount วีดีโอ กันจอดำ)
  attackSeq: 0,        // id ต่อ lastAttack (ให้ client remount ฉากโจมตี กันแอนิเมชันไม่เล่นซ้ำเวลาตี/เป้าหมาย/ดาเมจซ้ำกัน)
  transformCounter: 0, // ลำดับการเปิดร่าง (ใช้เลือกเพลงตอนสวนท่ากัน)
  anataMusicSeq: 0,    // เพลง ANATA WAAAAAAAA เล่นระหว่างช่วงจั่วการ์ด จบเมื่อทุกคนเปิดไพ่
  lastAttack: null,    // ข้อมูลการโจมตีล่าสุด (อนิเมชันใครตีใคร)
  roundSkills: [],     // สกิลที่ใช้ในรอบ (เก็บประวัติ — instant เด้งตอนใช้ / หลังเปิดไพ่โชว์ตอนโจมตี)
  shopItems: [],       // ร้านค้ามายา (patch 2.3): สินค้าส่วนกลางของรอบปัจจุบัน (15 ชิ้น เปิดทุก 5 เทิร์น — ร้านเดียวรวมของลุงเท่งเดิม)
  shopRoundSeq: 0,     // ลำดับรอบร้านค้า (ใช้สร้าง id สินค้าไม่ให้ซ้ำกันข้ามรอบ)
  yunaLongingUsed: false, // เพลง Longing ใช้ไปแล้วหรือยัง (ครั้งเดียวต่อเกม)
  yunaWindowEnd: 0,       // roundNumber ที่เอฟเฟกต์ปัจจุบันหมดผล (0 = ไม่มีเอฟเฟกต์ทำงานอยู่)
  yunaEffect: null,       // "longing" | "delete" | "smile" | "beatbark" | null
  yunaTargetId: null,     // เป้าหมาย delete/smile/longing — null สำหรับ beatbark (ทั้งสนาม)
  yunaMusicSeq: 0,        // เพิ่มทุกครั้งที่ยูนะ trigger ใหม่ -> client รีสตาร์ทเพลงจากต้น
  yunaLongingPendingId: null, // ตายในเทิร์น 1-10 แล้วรอฟื้นด้วย Longing — รอฉากโจมตีจบก่อน (ดู endTurn())
  yunaPity: 0,            // ระบบกันดวงซวย: หน้าต่างไหนไม่ติด +5% สะสมไปเรื่อยๆ ติดแล้วรีเซ็ตกลับ 0 (ดู characters/yuna.js's rollWindow)
  // เก็บ callback ของเฟสปัจจุบันไว้ (นอกเหนือจาก timeLeft) — ใช้ตอนต้อง "แทรก" คัตซีนแบบ async นอกรอบ
  //  ปกติ (เช่น ริต้า เบอร์นัล ตอบคำถามปลดปล่อยความเจ็บปวดช้ากว่ารอบที่ตายจริง) แล้วต้องกลับมาที่เฟส/ตัวจับเวลาเดิมให้ถูกต้อง
  currentPhaseOnExpire: null,
  // Clock Up: เวลาที่เหลือ "ตอนสนามเริ่มถูกแช่" — คลายเมื่อไหร่ (ไรเดอร์เปิดไพ่ครบ / กดปิด) เวลาเดินต่อจากค่านี้
  //  (เดิมบังคับเหลือ 10 วิทุกครั้ง) · Clock Up เปิดค้างมาตั้งแต่ต้นเทิร์น = เวลาเต็มของเฟสจั่วไพ่ เริ่มนับตอนคลาย
  //  null = สนามไม่ได้ถูกแช่อยู่
  clockUpResumeSeconds: null,

  // ---------- ย้อนเทิร์น (Overload Force) ----------
  // สแนปช็อตสภาพผู้เล่นทั้งหมด ณ "ต้นช่วงจั่วไพ่" ของเทิร์นปัจจุบัน (หลังเอฟเฟกต์ต้นเทิร์นทำงานครบแล้ว)
  // ใช้ตอนเกิด Overload Force เพื่อย้อนทุกการกระทำในเทิร์นนั้นทิ้ง — คืนแต้มสกิล/โควตาสกิลที่กดไป/ไอเทม/เหรียญ
  // ให้ครบ เพราะ Overload Force แจกไพ่ใหม่ในเทิร์นเดิม ถ้าไม่ย้อน คนที่กดสกิล "หลังเปิดไพ่" จะเสียของฟรี
  turnSnapshot: null,
  snapshotHistory: [],
  iconFxSeq: 0,
};

module.exports = match;
