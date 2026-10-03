// Socket.io: เชื่อมต่อ/หลุด/กลับเข้า + รับคำสั่งผู้เล่น
// export ก่อน require: ไฟล์ใน server/ require วนกันเอง — function declaration ถูก hoist จึงพร้อมใช้ตั้งแต่บรรทัดแรก
Object.assign(module.exports, {
  scheduleDisconnectedRemoval, newPlayerRecord,
});

const crypto = require("crypto");
const { CHARACTERS, CHAR_BY_ID, publicRoster } = require("../characters");
const CHAR_HOOKS = require("../characters/index");
const Seraph = require("../seraph");
const { io } = require("./app");
const {
  DOOM_STARTING_WEAPON, MAX_ARMOR, MAX_HP, MAX_PLAYERS, OGURI_ENERGY_START, ORT_ID,
  RECONNECT_GRACE_MS,
} = require("./constants");
const match = require("./match");
const { engine } = require("./engine");
const attack = require("./phases/attack");
const characterRules = require("./characterRules");
const combat = require("./combat");
const cutscene = require("./cutscene");
const draw = require("./phases/draw");
const endTurnPhase = require("./phases/endTurn");
const lobby = require("./lobby");
const mercury = require("./modes/mercury");
const purge = require("./modes/purge");
const pair = require("./pair");
const qteSystem = require("./qte");
const shop = require("./shop");
const skills = require("./skills");
const timers = require("./timers");
const view = require("./view");

// playerId is independent from socket.id so a reconnect can reclaim the same player.
const sessions = new Map();          // sessionToken -> playerId
const socketPlayerIds = new Map();   // socket.id -> playerId
const disconnectTimers = new Map();  // playerId -> timeout
const reservationTimers = new Map(); // socket.id -> timeout

// ============================================================
//  Socket.io
// ============================================================
function consumeEventQuota(socket, event, limit, windowMs = 1000) {
  const now = Date.now();
  const rates = socket.data.eventRates || (socket.data.eventRates = new Map());
  let bucket = rates.get(event);
  if (!bucket || now - bucket.startedAt >= windowMs) {
    bucket = { startedAt: now, count: 0 };
    rates.set(event, bucket);
  }
  bucket.count++;
  if (bucket.count <= limit) return true;
  if (bucket.count === limit + 1) socket.emit('rateLimited', { event });
  return false;
}

function playerIdFor(socket) {
  const id = socketPlayerIds.get(socket.id);
  const p = id && match.players[id];
  if (p && p.socketId === socket.id) return id;
  const co = pair.coPilotOf(socket);
  return co ? co.hostId : null;
}

function bindPlayerSocket(socket, playerId) {
  const p = match.players[playerId];
  if (!p) return false;
  const timer = disconnectTimers.get(playerId);
  if (timer) clearTimeout(timer);
  disconnectTimers.delete(playerId);
  p.connected = true;
  p.socketId = socket.id;
  socketPlayerIds.set(socket.id, playerId);
  socket.join(playerId);
  return true;
}

function forgetPlayerSession(p) {
  if (p && p.sessionToken) sessions.delete(p.sessionToken);
}

function scheduleDisconnectedRemoval(playerId) {
  const oldTimer = disconnectTimers.get(playerId);
  if (oldTimer) clearTimeout(oldTimer);
  disconnectTimers.set(playerId, setTimeout(() => removeDisconnectedPlayer(playerId), RECONNECT_GRACE_MS));
}

function removeDisconnectedPlayer(playerId) {
  const p = match.players[playerId];
  if (!p || p.connected) return;
  const wasAttacker = match.attackerId === playerId;
  const wasPregame = lobby.pregameStateActive();
  forgetPlayerSession(p);
  pair.dissolvePair(p);
  delete match.players[playerId];
  disconnectTimers.delete(playerId);

  if (Object.keys(match.players).length === 0) {
    match.gameState = 'LOBBY';
    timers.clearPhaseTimer();
    match.attackerId = null;
    view.broadcastPositions();
    return;
  }
  if (wasPregame) {
    lobby.resetPregameFlowToLobby();
    view.broadcastState();
    view.broadcastPositions();
    return;
  }
  if (match.gameState === 'ATTACK' && wasAttacker) endTurnPhase.endTurn();
  else if (match.gameState === 'PLAYING') { draw.checkAllLocked(); view.broadcastState(); }
  else view.broadcastState();
  view.broadcastPositions();
}

// ห่อ handler ของ socket event ด้วย try/catch — payload ผิดรูปแบบ/บั๊กในโค้ดตัวละครจุดเดียว
//  ไม่ควรทำให้ process ทั้งตัว crash (ตัดผู้เล่นทุกคนออกจากเกมพร้อมกัน) แค่ event นั้นไม่ทำงานพอ
function safeOn(socket, event, handler) {
  socket.on(event, (...args) => {
    try {
      handler(...args);
    } catch (err) {
      console.error(`[socket:${event}] handler เกิดข้อผิดพลาด (ไม่กระทบผู้เล่นคนอื่น):`, err);
    }
  });
}

function onPlayerEvent(socket, event, handler, limit = 20, windowMs = 1000) {
  safeOn(socket, event, (payload) => {
    if (!consumeEventQuota(socket, event, limit, windowMs)) return;
    const playerId = playerIdFor(socket);
    if (!playerId) return;
    // สไตรเกอร์ ยูเรก้า: คำสั่งของคู่หูลงระเบียนเดียวกัน แต่แต่ละคนทำได้เฉพาะส่วนของตัวเอง
    const p = match.players[playerId];
    const role = pair.pairRoleOf(p, socket);
    if (!pair.pairAllows(p, role, event)) return;
    handler(playerId, payload, { role, co: !!(p && p.pair && p.socketId !== socket.id) });
  });
}

// ระเบียนผู้เล่นใหม่ (ค่าเริ่มต้นของทุกฟิลด์) — ใช้ร่วมกันระหว่าง join, ORT และการเลือกตัวใหม่ในโหมด Type Mercury
function newPlayerRecord({ playerId, sessionToken, socketId, name, color, pos, ch, shikiUlt }) {
  return {
    id: playerId,
    sessionToken,
    socketId,
    connected: true,
    ready: false, // ห้องรอ: ต้องกดพร้อมก่อนเกมถึงจะเริ่มได้ (ครบทุกคน = เริ่มอัตโนมัติ)
    teamId: null, teamConfirmed: false, modeVote: null,
    name: (name || "ผู้เล่น").toString().slice(0, 12),
    customColor: lobby.normalizeColor(color),
    position: pos, characterId: ch.id, avatar: ch.avatar, img: ch.img,
    cards: [], locked: false, busted: false, result: null,
    hp: MAX_HP, armor: MAX_ARMOR, skillPoints: 0, alive: true, shield: 0,
    statuses: {}, statusAmt: {},
    seen: {}, transformAt: 0, cutsceneShown: {},
    armorLocked: false, beatSaved: false, skillUsedRound: false,
    gold: 0, inventory: [], triggerDarkWail: 0, blackSparklenceReadyRound: 0,
    doomWeapon: ch.id === "doomguy" ? DOOM_STARTING_WEAPON : null, doomQuickSwapUsed: false, doomCharge: 0,
    doomChaingunShieldUsed: false,
    takumiGear: 1, takumiSkillUsesRound: 0, takumiBlackoutFired: false,
    takutoComboReady: false, takutoUlt2VideoPending: false, takutoAwakenAt: 0,
    tonkatsu: 0, songAtk: 0, noDrawNext: 0, anataTargets: null,
    tempHp: 0, tempHpTurns: 0, noSkillNext: 0,
    sleepFresh: false,
    appleItem: "drink", appleAtkBuffs: [], chillDodge: 100, appleGiveUses: CHAR_HOOKS.appleguy.GIVE_USES,
    muimiEmergencyUses: CHAR_HOOKS.muimi.EMERGENCY_USES, muimiEmergencyUsedRound: 0,
    muimiLoseStreak: 0, muimiHeartRound: 0, muimiForcedBustRound: 0, muimiUltCasts: 0, muimiUltCastRound: 0, muimiUltLock: 0,
    tepeuCookTurns: 0, tepeuPonderTurns: 0, tepeuEyeTurns: 0, tepeuLoseStreak: 0, tepeuKillTargetId: null,
    cayAmmo: 0, cayMorale: 0, cayBarrage: false, cayBarrageShot: 0, cayPistolRound: 0, cayPending: [],
    daichiCard: "gomora", daichiArmor: null, daichiBasicUses: 0, daichiStored: [], daichiStunPending: 0,
    piggy: 0, senaNext: false, kotoneExtraAtk: false,
    bardNotes: [], bardNotesUsed: 0, bardPending: null,
    bloodSection: 0, soulSection: 0, bardLinks: {},
    kaiLinkWith: null, kaiRivalId: null, kaiMarksBy: {},
    mageslayerMarkedId: null, mageslayerMarks: {}, mageslayerHasMarked: false, mageslayerWitchMarkReadyRound: 0, mageslayerBurdenReadyRound: 0, mageslayerMarkTick: 0,
    shikiUlt: shikiUlt === "wither" ? "wither" : "deatheye", witherAddedBy: {},
    oguriEnergy: OGURI_ENERGY_START, stamina: 0, oguriChargeCapBonus: 0, oguriZoneTurns: 0, staggerNext: 0,
    maxHpPenalty: 0, wouGuardCd: 0, calamityDraw: 0, locaOffer: null,
    dmgHp: 0, dmgArmor: 0, gainedSkill: 0,
    wasAttacked: false, isWinner: false, isLoser: false,
    phenexPain: 0, phenexReborn: false, phenexNtdPermanent: false, phenexLastHitBy: null,
    tohno: null, tohnoCrack: 0, tohnoCrackAt: 0,
  };
}

io.on('connection', (socket) => {
  socket.emit("roster", publicRoster());
  socket.emit("positions", lobby.positionsFor(socket.id));
  socket.emit("takenChars", view.takenUniqueChars());
  socket.emit("pairSlots", pair.openPairSlots());

  safeOn(socket, 'reconnectSession', ({ sessionToken } = {}) => {
    if (!consumeEventQuota(socket, 'reconnectSession', 3, 10_000)) return;
    if (typeof sessionToken !== 'string' || sessionToken.length > 128) return;
    const playerId = sessions.get(sessionToken);
    const p = playerId && match.players[playerId];
    // สไตรเกอร์ ยูเรก้า: session ของคู่หู — ผูก socket ใหม่เข้ากับระเบียนของ host
    const coHost = !p && match.players[pair.coSessions.get(sessionToken)];
    if (coHost && coHost.pair && coHost.pair.co && coHost.pair.co.sessionToken === sessionToken) {
      const co = coHost.pair.co;
      if (co.connected && co.socketId !== socket.id && io.sockets.sockets.has(co.socketId)) { socket.emit('sessionInUse'); return; }
      pair.bindCoPilotSocket(socket, coHost);
      pair.pairRefreshReady(coHost);
      socket.emit('reconnected', { sessionToken });
      view.broadcastState();
      view.broadcastPositions();
      return;
    }
    if (!p || p.sessionToken !== sessionToken) { socket.emit('sessionExpired'); return; }
    if (p.connected && p.socketId !== socket.id && io.sockets.sockets.has(p.socketId)) {
      socket.emit('sessionInUse');
      return;
    }
    if (!bindPlayerSocket(socket, playerId)) { socket.emit('sessionExpired'); return; }
    socket.emit('reconnected', { sessionToken });
    if (p.pair) { socket.emit("pairRole", { role: p.pair.role }); pair.pairRefreshReady(p); }
    view.broadcastState();
    view.broadcastPositions();
  });

  safeOn(socket, "reserve", ({ position } = {}) => {
    if (!consumeEventQuota(socket, 'reserve', 8, 10_000) || playerIdFor(socket)) return;
    const pos = Number(position);
    if (!pos) { lobby.releaseReservation(socket.id); view.broadcastPositions(); return; }
    if (pos < 1 || pos > MAX_PLAYERS || lobby.positionUsedByOther(pos, socket.id)) return;
    lobby.reservePosition(socket.id, pos);
    view.broadcastPositions();
  });

  // สไตรเกอร์ ยูเรก้า: เข้าร่วมเป็นคู่หูของตัวละครคู่ที่ยังรออยู่ (ไม่ใช้ที่นั่ง — นั่งที่เดียวกับ host)
  safeOn(socket, "joinCopilot", ({ name, characterId } = {}) => {
    if (!consumeEventQuota(socket, 'join', 3, 10_000) || playerIdFor(socket)) return;
    if (match.gameState !== "LOBBY") { socket.emit("inProgress"); return; }
    const host = Object.values(match.players).find((p) => p.pair && !p.pair.co && (!characterId || p.characterId === characterId));
    if (!host) { socket.emit("pairTaken"); return; }
    lobby.releaseReservation(socket.id);
    const sessionToken = crypto.randomBytes(32).toString('base64url');
    host.pair.co = { id: crypto.randomUUID(), name: (name || "ผู้เล่น").toString().slice(0, 12), sessionToken, socketId: null, connected: true, ready: false };
    pair.coSessions.set(sessionToken, host.id);
    pair.bindCoPilotSocket(socket, host);
    pair.pairRefreshName(host);
    pair.pairRefreshReady(host);
    socket.emit('joined', { sessionToken });
    view.broadcastState();
    view.broadcastPositions();
  });

  safeOn(socket, "join", ({ name, position, characterId, shikiUlt, color, pairRole } = {}) => {
    if (!consumeEventQuota(socket, 'join', 3, 10_000) || playerIdFor(socket)) return;
    if (Object.keys(match.players).length >= MAX_PLAYERS) { socket.emit("full"); return; }
    if (match.gameState !== "LOBBY") { socket.emit("inProgress"); return; }
    const pos = Number(position);
    if (!pos || pos < 1 || pos > MAX_PLAYERS || lobby.positionUsedByOther(pos, socket.id)) { socket.emit("positionTaken"); return; }
    lobby.releaseReservation(socket.id);
    let ch = CHAR_BY_ID[characterId];
    // ORT (botOnly) เลือกเล่นไม่ได้ — ตกไปใช้ตัวแรกที่เล่นได้เหมือนตัวที่ยังล็อกอยู่
    if (!ch || ch.locked || ch.botOnly) ch = CHARACTERS.find((c) => !c.locked && !c.botOnly) || CHARACTERS[0];
    // ตัวละคร unique (คอนเนอร์ RK800): เลือกได้แค่ 1 คนต่อเกม — ปฏิเสธการเข้าร่วมแทนการสลับตัวให้เงียบๆ
    //  (ฝั่ง client ปิดการ์ดไว้ตั้งแต่หน้าเลือกตัวละครผ่าน event "takenChars" — ด่านนี้กันเคสกดพร้อมกันเป๊ะ)
    if (ch.unique && Object.values(match.players).some((o) => o.characterId === ch.id)) {
      socket.emit("characterTaken", { characterId: ch.id, name: ch.name });
      return;
    }

    const playerId = crypto.randomUUID();
    const sessionToken = crypto.randomBytes(32).toString('base64url');
    match.players[playerId] = newPlayerRecord({ playerId, sessionToken, socketId: socket.id, name, color, pos, ch, shikiUlt });
    // สไตรเกอร์ ยูเรก้า: คนแรกเลือกบทบาท (นักบิน/พลปืน) แล้วรอคู่หูเข้ามารับอีกส่วน
    if (ch.id === "striker") {
      const np = match.players[playerId];
      np.pair = { role: pair.PAIR_ROLES.includes(pairRole) ? pairRole : "pilot", hostName: np.name, hostReady: false, co: null };
    }
    sessions.set(sessionToken, playerId);
    bindPlayerSocket(socket, playerId);
    socket.emit('joined', { sessionToken });
    if (match.players[playerId].pair) socket.emit("pairRole", { role: match.players[playerId].pair.role });
    view.broadcastState();
    view.broadcastPositions();
  });

  // ปุ่มเล่นคนเดียว (ทดสอบ): คนเดียวในห้อง -> เข้าหน้าเลือกโหมดเหมือนเกมปกติ (หลายคนเริ่มได้ทางกดพร้อมครบเท่านั้น)
  onPlayerEvent(socket, 'startGame', (id) => lobby.startSoloTest(id), 2);
  // Type Mercury: ตายแล้วเลือกตัวละครใหม่ลงสนามเทิร์นถัดไป / โหวตยอมแพ้
  onPlayerEvent(socket, 'mercuryPick', (id, { characterId, shikiUlt } = {}) => {
    if (typeof characterId !== 'string') return;
    mercury.mercuryPick(id, characterId, { shikiUlt });
  }, 6);
  onPlayerEvent(socket, 'mercurySurrender', (id, { yes } = {}) => mercury.mercurySurrenderVote(id, !!yes), 6);
  onPlayerEvent(socket, 'selectGameMode', (id, { mode } = {}) => {
    if (match.gameState !== 'TEAM_MODE') return;
    lobby.voteGameMode(id, mode);
  }, 4);
  onPlayerEvent(socket, 'teamBackToMode', () => {
    if (match.gameState !== 'TEAM_SETUP') return;
    lobby.resetTeamAssignments(false);
    lobby.resetModeVotes();
    match.gameMode = 'pending';
    match.teamSize = 1;
    match.teamCount = 0;
    match.gameState = 'TEAM_MODE';
    view.broadcastState();
  }, 4);
  // หน้าเลือกโหมด -> ย้อนกลับห้องรอ (ทุกคนยกเลิกพร้อม)
  onPlayerEvent(socket, 'modeBackToLobby', () => lobby.modeSelectBackToLobby(), 4);
  onPlayerEvent(socket, 'chooseTeam', (id, { teamId } = {}) => lobby.chooseTeam(id, teamId), 8);
  onPlayerEvent(socket, 'confirmTeam', (id, { confirmed } = {}) => lobby.confirmTeam(id, confirmed), 8);
  // ห้องรอ: กดพร้อม/ยกเลิกพร้อม — ครบทุกคน (อย่างน้อย 2 คน) เริ่มเกมอัตโนมัติ
  onPlayerEvent(socket, 'toggleReady', (playerId, _payload, actor) => {
    if (!lobby.pregameStateActive()) return;
    const p = match.players[playerId];
    if (!p) return;
    if (p.pair) {
      // ตัวละครคู่: พร้อมทีละคน — ต้องมีคู่หูครบและกดพร้อมทั้งคู่ ระเบียนถึงนับว่าพร้อม
      if (actor && actor.co) { if (p.pair.co) p.pair.co.ready = !p.pair.co.ready; }
      else p.pair.hostReady = !p.pair.hostReady;
      pair.pairRefreshReady(p);
    } else p.ready = !p.ready;
    view.broadcastState();
    lobby.checkLobbyReady();
  });
  // ห้องรอ / เลือกโหมด / จัดทีม: ปักอีโมตบนลูกโลก — ส่งต่อให้ทุกคนในห้อง (1 ครั้งต่อ 600 ms)
  onPlayerEvent(socket, 'lobbyEmote', (id, payload) => lobby.relayLobbyEmote(id, payload), 1, 600);

  onPlayerEvent(socket, 'hit', (id) => draw.hit(id), 8);
  // Purge: กดทอยเต๋า / เลือกทางที่ทางแยก / ใช้ไอเทมกระดาน (ก่อนทอย)
  onPlayerEvent(socket, 'purgeRoll', (id) => purge.roll(id), 4);
  onPlayerEvent(socket, 'purgeChoose', (id, { nextId } = {}) => { if (typeof nextId === 'string') purge.choose(id, nextId); }, 6);
  onPlayerEvent(socket, 'purgeItem', (id, payload = {}) => {
    if (!payload || typeof payload.uid !== 'string') return;
    purge.useBoardItem(id, { uid: payload.uid, value: payload.value, targetId: typeof payload.targetId === 'string' ? payload.targetId : null });
  }, 6);
  onPlayerEvent(socket, 'lock', (id) => draw.lock(id), 4);
  onPlayerEvent(socket, 'useSkill', (id, { tier, targets, item } = {}) => skills.useSkill(id, tier, targets, item), 12);
  onPlayerEvent(socket, 'buyShopItem', (id, { itemId } = {}) => shop.buyShopItem(id, itemId), 8);
  onPlayerEvent(socket, 'useInventoryItem', (id, { uid, cardIndex, color, targetId, mode } = {}) => combat.withEffectSource(match.players[id], () => shop.useInventoryItem(id, uid, { cardIndex, color, targetId, mode })), 8);
  // เกราะ Mark 42: เจ้าของคุมชุดที่ส่งออกไปแล้ว (recall / remove / detonate)
  onPlayerEvent(socket, 'mark42Control', (id, { action } = {}) => combat.withEffectSource(match.players[id], () => characterRules.mark42Control(id, action)), 6);
  onPlayerEvent(socket, 'locaAnswer', (id, { accept, fromId } = {}) => skills.answerLoca(id, !!accept, fromId), 4);
  // ริต้า เบอร์นัล: ขอแค่ได้พบกันอีก — เลือกเป้าหมายปลดปล่อยความเจ็บปวด (ใช้ได้แม้ตกรอบไปแล้ว)
  onPlayerEvent(socket, 'phenexRelease', (playerId, { targetId } = {}) => {
    const p = match.players[playerId];
    if (!p || !p.phenexReleaseAsk) return;
    const ask = p.phenexReleaseAsk;
    p.phenexReleaseAsk = null;
    const options = ask.options.map((id) => match.players[id]).filter((o) => o && o.alive);
    const target = options.find((o) => o.id === targetId) || null;
    combat.withEffectSource(p, () => CHAR_HOOKS.phenex.resolveRelease(engine, p, target, ask.pain));
    // ORT สกิลติดตัว 2: เลือก ORT เป็นเป้าผ่านช่องทางนี้ (ไม่ใช่ useSkill) ก็ต้องสวนกลับเหมือนกัน
    if (mercury.isOrt(target)) CHAR_HOOKS.ort.queueCounter(engine, p.id);
    draw.flushOrtCounters();
    // คำตอบนี้มาแบบ async นอกรอบ resolveRound ปกติ (ตอบช้ากว่ารอบที่ตายจริงก็ได้ — "ใช้ได้แม้ตกรอบไปแล้ว/ทุกเฟส")
    //  ต้องเล่นวีดีโอที่ค้างคิว (ถ้ามี) โดยไม่ทำลาย gameState/ตัวจับเวลาของเฟสที่กำลังทำงานอยู่ตอนนี้
    //  (บั๊กเดิม: เรียก runCutsceneQueue(() => broadcastState()) ตรงๆ ทำให้ gameState ค้างที่ "CUTSCENE"
    //   แบบไม่มีตัวจับเวลาใดๆ ทำงานต่อ — เกมค้างถาวรถ้าคำตอบมาถึงตอนไม่ใช่เฟส PLAYING พอดี)
    if (match.cutsceneQueue.length) {
      const resumeState = match.gameState;
      const resumeSeconds = Math.max(3, match.timeLeft);
      const resumeOnExpire = match.currentPhaseOnExpire;
      cutscene.runCutsceneQueue(() => {
        match.gameState = resumeState;
        if (resumeOnExpire) timers.startPhaseTimer(resumeSeconds, resumeOnExpire);
        view.broadcastState();
      });
    } else {
      view.broadcastState();
    }
  });
  // แบทแมน: นายลืมของน่ะ — เลือกเป้าหมายส่งต่อความเสียหายที่รับไว้ (ตอบได้ทุกเฟส เหมือน phenexRelease)
  onPlayerEvent(socket, 'batKarmaSend', (playerId, { targetId } = {}) => {
    const p = match.players[playerId];
    if (!p || !p.batKarmaAsk) return;
    const ask = p.batKarmaAsk;
    p.batKarmaAsk = null;
    const options = ask.options.map((id) => match.players[id]).filter((o) => o && o.alive);
    const target = options.find((o) => o.id === targetId) || null;
    combat.withEffectSource(p, () => CHAR_HOOKS.bat_ben.resolveKarmaSend(engine, p, target, ask.dmg));
    if (mercury.isOrt(target)) CHAR_HOOKS.ort.queueCounter(engine, p.id); // ORT สกิลติดตัว 2 (เหตุผลเดียวกับริต้าด้านบน)
    draw.flushOrtCounters();
    // คำตอบมาแบบ async นอกรอบปกติ — ต้องเล่นวีดีโอที่ค้างคิวโดยไม่ทำลาย gameState/ตัวจับเวลาของเฟสปัจจุบัน
    //  (เหตุผลเดียวกับ phenexRelease ด้านบน — เรียก runCutsceneQueue ตรงๆ จะทำให้เกมค้างที่เฟส CUTSCENE)
    if (match.cutsceneQueue.length) {
      const resumeState = match.gameState;
      const resumeSeconds = Math.max(3, match.timeLeft);
      const resumeOnExpire = match.currentPhaseOnExpire;
      cutscene.runCutsceneQueue(() => {
        match.gameState = resumeState;
        if (resumeOnExpire) timers.startPhaseTimer(resumeSeconds, resumeOnExpire);
        view.broadcastState();
      });
    } else {
      view.broadcastState();
    }
  });
  onPlayerEvent(socket, 'bardTarget', (id, { targets } = {}) => {
    combat.withEffectSource(match.players[id], () => skills.bardTarget(id, targets));
    // ORT สกิลติดตัว 2: บทเพลงเลือก ORT เป็นเป้า -> สวนกลับ (บทเพลงไม่ได้ผ่าน useSkill)
    if (Array.isArray(targets) && targets.includes(ORT_ID)) CHAR_HOOKS.ort.queueCounter(engine, id);
    if (match.gameState !== "CUTSCENE") draw.flushOrtCounters();
  }, 8);
  onPlayerEvent(socket, 'kaiOverhaul', (id) => {
    combat.withEffectSource(match.players[id], () => skills.kaiOverhaul(id));
    if (match.gameState !== "CUTSCENE") draw.flushOrtCounters();
  }, 4);
  // คอนเนอร์ RK800: เป้าหมายระดับอาชญากรตอบคำขาด — submit = true คือ "ยอมจำนน", false คือ "ขัดขืน"
  onPlayerEvent(socket, 'connorArrestAnswer', (id, { submit } = {}) => {
    const t = match.players[id];
    if (!t || !t.alive || !t.connorArrestAsk) return;
    // วีดีโอสอบปากคำ (connor_skill2) อาจกำลังเล่นอยู่ตอนคำขาดโผล่ — ต้องตอบได้ทั้งสองเฟส
    if (match.gameState !== 'PLAYING' && match.gameState !== 'CUTSCENE') return;
    if (!CHAR_HOOKS.conner.answerArrest(engine, t, !!submit, true)) return;
    view.broadcastState();
    draw.checkAllLocked();
  }, 4);
  onPlayerEvent(socket, 'attack', (id, { targetId } = {}) => attack.doAttack(id, targetId), 6);
  // SE.RA.PH: เลือกสถานที่ประจำวัน (option = แท่นที่โบสถ์ · targets = เป้าหมายที่ลง Matrix ที่สวนสาธารณะ)
  onPlayerEvent(socket, 'seraphPlace', (id, { key, option, targets } = {}) => {
    if (match.gameState !== 'SERAPH_PLACE') return;
    combat.withEffectSource(match.players[id], () => Seraph.choosePlace(engine, id, key, { option, targets }));
  }, 8);
  onPlayerEvent(socket, 'seraphReady', (id) => {
    if (match.gameState === 'SERAPH_PLACE') Seraph.readyPlace(engine, id);
  }, 4);
  onPlayerEvent(socket, 'nanayaToggleEye', (id) => draw.nanayaToggleEye(id), 4);
  // ดิโอ Throwing knife: กดปุ่มแล้ว (ก่อนเลือกเป้า) เล่นคลิปง้างมีดให้ทุกคน — client เข้าโหมดเลือกเป้าค้างไว้ระหว่างคลิป
  //  แล้วค่อยส่ง useSkill ตอนเลือกเป้า · คลิปเล่นเฉพาะตอนกดสกิลได้จริง และไม่เกิน 1 ครั้ง/เทิร์น (dio.aimKnife)
  onPlayerEvent(socket, 'dioKnifeAim', (id) => {
    const p = match.players[id];
    if (!p || match.gameState !== 'PLAYING') return;
    if (CHAR_HOOKS.conner.skillBlocked(engine, p) || CHAR_HOOKS.brian.skillBlocked(engine, p, 'basic') || CHAR_HOOKS.daisuke.skillBlocked(engine, p, 'basic')) return;
    if (!CHAR_HOOKS.dio.aimKnife(engine, p)) return;
    cutscene.pausePlayingForCutscene();
  }, 2);
  onPlayerEvent(socket, 'eijiOrdinalScale', (id) => combat.withEffectSource(match.players[id], () => draw.eijiOrdinalScale(id)), 8);
  onPlayerEvent(socket, 'nanayaCancelReattack', (id) => attack.nanayaCancelReattack(id), 4);
  // QTE (ยุย: ทำนองเพลงร็อก) — กดปุ่มทีละตัว · limit สูงกว่าปกติเผื่อกดรัวตอนตื่นเต้น
  onPlayerEvent(socket, 'qteKey', (id, { key } = {}) => qteSystem.qteKey(id, key), 40);
  // อุซากิ: ตอบ "เอา/ไม่เอา" ไพ่ของเป้าหมาย (สกิลรอง) — เอา = วีดีโอก่อน แล้วค่อยสลับไพ่
  onPlayerEvent(socket, 'usagiSwapAnswer', (id, { accept } = {}) => {
    const p = match.players[id];
    if (!p || match.gameState !== "PLAYING" || !p.usagiSwapOffer) return;
    const swap = combat.withEffectSource(p, () => CHAR_HOOKS.usagi.answerSwap(engine, p, !!accept));
    if (swap) cutscene.pausePlayingForCutscene(() => CHAR_HOOKS.usagi.applySwap(engine, p));
    else { view.broadcastState(); draw.checkAllLocked(); }
  }, 6);
  // อุซากิ (ท่าไม้ตาย): ตอบโจทย์คณิต / แจ้งหมดเวลา (server ตรวจเวลาซ้ำเองก่อนเชื่อ)
  const usagiQuizStep = (id, value, timedOut) => {
    const p = match.players[id];
    if (!p || !p.alive || !p.usagiQuiz || match.gameState !== "PLAYING") return;
    CHAR_HOOKS.usagi.answerQuiz(engine, p, value, timedOut);
    view.broadcastState();
    if (mercury.checkOrtEarlyWin()) return;
    draw.checkAllLocked();
  };
  onPlayerEvent(socket, 'usagiQuizAnswer', (id, { value } = {}) => usagiQuizStep(id, value, false), 20);
  onPlayerEvent(socket, 'usagiQuizTimeout', (id) => usagiQuizStep(id, null, true), 20);
  onPlayerEvent(socket, 'qteTimeout', (id) => qteSystem.qteTimeout(id), 10);
  // Recruit: คลิกจุดแดง (limit สูงเผื่อคลิกรัว) / แจ้งหมดเวลา / เลือกเป้าหลัง QTE / สกิลพิเศษ "เตรียมตัว"
  // สไตรเกอร์ ยูเรก้า: นักบินอนุมัติ "เป็นเกียรติมากครับ" / เริ่มซ่อม / ส่งผลต่อสายไฟ
  onPlayerEvent(socket, 'strikerApprove', (id, { accept } = {}) => characterRules.strikerApprove(id, !!accept), 6);
  onPlayerEvent(socket, 'strikerRepairStart', (id) => characterRules.strikerRepairStart(id), 4);
  onPlayerEvent(socket, 'strikerRepairDone', (id, { pairs } = {}) => characterRules.strikerRepairDone(id, pairs), 6);
  onPlayerEvent(socket, 'recruitQteHit', (id, { id: dotId } = {}) => characterRules.recruitQteHit(id, dotId), 40);
  onPlayerEvent(socket, 'recruitQteDone', (id) => characterRules.recruitQteDone(id), 10);
  onPlayerEvent(socket, 'recruitPick', (id, { targets } = {}) => characterRules.recruitPick(id, targets), 6);
  // อาซาฮินะ ทักต์ (คอนดักเตอร์): ส่งคำเชิญพันธะ (ไม่เสียแต้ม ไม่นับเป็นการใช้สกิล) / มิวสิคคาร์ทตอบรับ-ปฏิเสธ
  //  ตอบรับ = เล่นวีดีโอ takt_ac.mp4 แล้วกลับเข้าเฟสจั่วไพ่ด้วยเวลาที่เหลือ
  onPlayerEvent(socket, 'taktInvite', (id, { targetId } = {}) => {
    const p = match.players[id];
    if (!p || !p.alive || match.gameState !== "PLAYING") return;
    if (CHAR_HOOKS.takt.invite(engine, p, targetId)) view.broadcastState();
  }, 6);
  onPlayerEvent(socket, 'taktInviteAnswer', (id, { accept } = {}) => {
    const p = match.players[id];
    if (!p || match.gameState !== "PLAYING" || !p.taktInvite) return;
    if (CHAR_HOOKS.takt.answerInvite(engine, p, !!accept) && match.cutsceneQueue.length) cutscene.pausePlayingForCutscene();
    else { view.broadcastState(); draw.checkAllLocked(); }
  }, 6);
  // อาซาฮินะ ทักต์ (เปิดม่าน): คำสั่งบรรเลงรายคู่พันธะ — ไททันล่อเป้า · คอเซ็ตต์โจมตีเป้า (วีดีโอก่อน)
  onPlayerEvent(socket, 'taktPerform', (id, { cartId, targetId } = {}) => {
    const p = match.players[id];
    if (!p || !p.alive || match.gameState !== "PLAYING") return;
    const r = combat.withEffectSource(p, () => CHAR_HOOKS.takt.perform(engine, p, cartId, targetId));
    if (!r) return;
    if (match.cutsceneQueue.length) cutscene.pausePlayingForCutscene(r.after || undefined);
    else { if (r.after) r.after(); draw.flushOrtCounters(); view.broadcastState(); draw.checkAllLocked(); }
  }, 6);
  onPlayerEvent(socket, 'recruitPrep', (id, { kind } = {}) => characterRules.recruitPrep(id, kind), 6);
  onPlayerEvent(socket, 'backToLobby', () => { if (match.gameState === 'GAMEOVER') lobby.backToLobby(); }, 2);

  safeOn(socket, "leave", () => {
    if (!consumeEventQuota(socket, 'leave', 2, 10_000)) return;
    if (!lobby.pregameStateActive()) return;
    // สไตรเกอร์ ยูเรก้า: คู่หูออก = ตัวละครกลับไปรอคู่หูใหม่ (host ยังอยู่)
    const coRef = pair.coPilotOf(socket);
    if (coRef) {
      pair.removeCoPilot(match.players[coRef.hostId], false);
      lobby.resetPregameFlowToLobby();
      view.broadcastState();
      view.broadcastPositions();
      return;
    }
    const playerId = playerIdFor(socket);
    const p = playerId && match.players[playerId];
    if (!p) return;
    pair.dissolvePair(p);
    lobby.reservePosition(socket.id, p.position);
    forgetPlayerSession(p);
    delete match.players[playerId];
    socketPlayerIds.delete(socket.id);
    // มีคนออกก่อนเริ่มเกม -> ย้อนกลับห้องรอและรีเซ็ตความพร้อม/ทีมของคนที่เหลือ
    lobby.resetPregameFlowToLobby();
    view.broadcastState();
    view.broadcastPositions();
  });

  safeOn(socket, 'disconnect', () => {
    // สไตรเกอร์ ยูเรก้า: คู่หูหลุด — ระหว่างแมตช์ส่วนนั้นหยุดทำงานจนกว่าจะกลับมา · ห้องรอหมดเวลาแล้วลบออก
    const coRef = pair.coPilotOf(socket);
    if (coRef) {
      pair.coSocketHost.delete(socket.id);
      const host = match.players[coRef.hostId];
      coRef.co.connected = false;
      coRef.co.socketId = null;
      if (lobby.pregameStateActive()) {
        lobby.resetPregameFlowToLobby();
        pair.coTimers.set(host.id, setTimeout(() => {
          if (host.pair && host.pair.co === coRef.co && !coRef.co.connected) { pair.removeCoPilot(host, false); view.broadcastState(); view.broadcastPositions(); }
        }, RECONNECT_GRACE_MS));
      }
      pair.pairRefreshReady(host);
      view.broadcastState();
      view.broadcastPositions();
      return;
    }
    const playerId = socketPlayerIds.get(socket.id);
    socketPlayerIds.delete(socket.id);
    lobby.releaseReservation(socket.id);
    const p = playerId && match.players[playerId];
    if (p && p.socketId === socket.id) {
      p.connected = false;
      p.socketId = null;
      if (lobby.pregameStateActive()) lobby.resetPregameFlowToLobby();
      // During a match the player is parked indefinitely and may reclaim this
      // exact character/session whenever they return. Lobby slots still expire.
      if (lobby.pregameStateActive()) scheduleDisconnectedRemoval(playerId);
      view.broadcastState();
    }
    view.broadcastPositions();
  });
});

Object.assign(module.exports, { reservationTimers });
