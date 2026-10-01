// สไตรเกอร์ ยูเรก้า: ผู้เล่น 2 คนบังคับตัวละครเดียว
// export ก่อน require: ไฟล์ใน server/ require วนกันเอง — function declaration ถูก hoist จึงพร้อมใช้ตั้งแต่บรรทัดแรก
Object.assign(module.exports, {
  coPilotOf, pairRoleOf, pairAllows, pairRefreshReady, pairRefreshName, pairPublic, openPairSlots,
  removeCoPilot, dissolvePair, bindCoPilotSocket, pairTeamWeight, teamHeadcount,
});

const { io } = require("./app");
const match = require("./match");
const lobby = require("./lobby");

// ============================================================
//  สไตรเกอร์ ยูเรก้า: คู่หู — ผู้เล่น 2 คนบังคับตัวละครเดียว (characters/striker.js คือกลไกต่อสู้)
//  ในเกมมีระเบียนผู้เล่นแค่ 1 ระเบียน (ของคนที่เลือกตัวละครก่อน = host) — คนที่สองเก็บที่ p.pair.co
//  engine ต่อสู้ทั้งหมดจึงเห็นยูเรก้าเป็นผู้เล่นคนเดียว "แพ้ก็แพ้คู่" โดยไม่ต้องแก้ลูปใดๆ
//    · socket ของคู่หู join ห้อง (room) ของ host -> ได้ state ชุดเดียวกัน (youId = host) โดยอัตโนมัติ
//    · onPlayerEvent ส่งคำสั่งของทั้งคู่มาที่ระเบียนเดียวกัน แล้วกรองตามบทบาท (PAIR_ROLE_EVENTS)
//    · p.pair ไม่ถูกล้างโดย resetCombat และไม่ถูกย้อนโดยสแนปช็อต (ข้อมูลการเชื่อมต่อ)
//  p.pair = { role: บทบาทของ host ("pilot" | "gunner"), hostName, hostReady, co: { id, name, sessionToken, socketId, connected, ready } | null }
// ============================================================
const PAIR_ROLES = ["pilot", "gunner"];
const PAIR_ROLE_EVENTS = {
  pilot: new Set(["hit", "lock", "attack", "strikerApprove", "strikerRepairStart", "strikerRepairDone"]),
  gunner: new Set(["useSkill", "buyShopItem", "useInventoryItem", "mark42Control"]),
};
const coSocketHost = new Map(); // socket.id ของคู่หู -> hostId
const coSessions = new Map();   // sessionToken ของคู่หู -> hostId
const coTimers = new Map();     // hostId -> ตัวนับถอยหลังลบคู่หูที่หลุดในห้องรอ
function coPilotOf(socket) {
  const hostId = coSocketHost.get(socket.id);
  const p = hostId && match.players[hostId];
  const co = p && p.pair && p.pair.co;
  return co && co.socketId === socket.id ? { hostId, co } : null;
}
function otherRole(role) { return role === "pilot" ? "gunner" : "pilot"; }
// บทบาทของ socket นี้บนระเบียน p (null = ไม่ใช่ตัวละครคู่)
function pairRoleOf(p, socket) {
  if (!p || !p.pair) return null;
  if (p.socketId === socket.id) return p.pair.role;
  return p.pair.co && p.pair.co.socketId === socket.id ? otherRole(p.pair.role) : null;
}
function pairRoleConnected(p, role) {
  if (!p || !p.pair) return false;
  return p.pair.role === role ? !!p.connected : !!(p.pair.co && p.pair.co.connected);
}
function pairAllows(p, role, event) {
  if (!p || !p.pair || !role) return true;
  const need = PAIR_ROLE_EVENTS.pilot.has(event) ? "pilot" : PAIR_ROLE_EVENTS.gunner.has(event) ? "gunner" : null;
  if (!need || need === role) return true;
  // นักบินหลุด: พลปืนเปิดการ์ดแทนได้ชั่วคราว (แต่จั่วไม่ได้)
  if (event === "lock" && role === "gunner" && !pairRoleConnected(p, "pilot")) return true;
  return false;
}
function pairRefreshReady(p) {
  if (!p || !p.pair) return;
  const co = p.pair.co;
  p.ready = !!(p.pair.hostReady && co && co.connected && co.ready);
}
function pairRefreshName(p) {
  if (!p || !p.pair) return;
  p.name = p.pair.co ? `${p.pair.hostName} & ${p.pair.co.name}`.slice(0, 26) : p.pair.hostName;
}
function pairPublic(p) {
  if (!p || !p.pair) return null;
  const co = p.pair.co;
  const hostSide = { name: p.pair.hostName, connected: !!p.connected, ready: !!p.pair.hostReady };
  const coSide = co ? { name: co.name, connected: !!co.connected, ready: !!co.ready } : null;
  return {
    pilot: p.pair.role === "pilot" ? hostSide : coSide,
    gunner: p.pair.role === "gunner" ? hostSide : coSide,
    open: !co ? otherRole(p.pair.role) : null,
  };
}
// หน้าเลือกตัวละคร: ตัวละครคู่ที่ยังรอคู่หู (ให้คนอื่นกดเข้าร่วมเป็นคู่หูได้)
function openPairSlots() {
  if (!lobby.pregameStateActive()) return [];
  return Object.values(match.players).filter((p) => p.pair && !p.pair.co)
    .map((p) => ({ characterId: p.characterId, hostName: p.pair.hostName, role: otherRole(p.pair.role) }));
}
function removeCoPilot(p, notify) {
  const co = p && p.pair && p.pair.co;
  if (!co) return;
  const t = coTimers.get(p.id);
  if (t) clearTimeout(t);
  coTimers.delete(p.id);
  coSessions.delete(co.sessionToken);
  if (co.socketId) {
    coSocketHost.delete(co.socketId);
    const sock = io.sockets.sockets.get(co.socketId);
    if (sock) { sock.leave(p.id); if (notify) sock.emit("sessionExpired"); }
  }
  p.pair.co = null;
  pairRefreshName(p);
  pairRefreshReady(p);
}
// host ออก/ถูกลบ -> คู่หูไม่มีตัวละครให้บังคับแล้ว ส่งกลับไปหน้าเลือกตัวละคร
function dissolvePair(p) { removeCoPilot(p, true); }
function bindCoPilotSocket(socket, p) {
  const co = p.pair.co;
  if (co.socketId && co.socketId !== socket.id) coSocketHost.delete(co.socketId);
  const t = coTimers.get(p.id);
  if (t) clearTimeout(t);
  coTimers.delete(p.id);
  co.socketId = socket.id;
  co.connected = true;
  coSocketHost.set(socket.id, p.id);
  socket.join(p.id);
  socket.emit("pairRole", { role: otherRole(p.pair.role) });
}
// โหมดทีม: ยูเรก้า (2 คน) ยืนเป็นทีมเต็ม 1 ทีมคนเดียว — duo สู้ 2:1 · trio สู้ 2:3
//  นับ "ช่อง" ของทีม: ตัวละครคู่หนัก = teamSize ช่อง (เต็มทีมทันที)
function pairTeamWeight(p, size = match.teamSize) { return p && p.pair ? Math.max(1, size) : 1; }
function teamHeadcount(size) {
  return Object.values(match.players).reduce((n, p) => n + pairTeamWeight(p, size), 0);
}

Object.assign(module.exports, { PAIR_ROLES, coSocketHost, coSessions, coTimers });
