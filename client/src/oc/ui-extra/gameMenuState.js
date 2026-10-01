import { useSyncExternalStore } from "react";
import { socket } from "../../socket";

// ของที่เมนูมุมขวาบน (GameMenu.jsx) ใช้ — แยกไฟล์ไว้ให้ไฟล์ .jsx export แต่ component (fast refresh)

// window.echoApp มาจาก desktop/preload.js — มีเฉพาะหน้าเกมในโปรแกรม ECHO (leaveRoom / isHost) · เบราว์เซอร์ธรรมดา = null
export const echoApp = typeof window !== "undefined" && window.echoApp ? window.echoApp : null;

// แมตช์เริ่มแล้วหรือยัง — ดูจาก state ล่าสุดที่ server ส่งมา (ฟังตั้งแต่โหลดหน้า ไม่ใช่แค่ตอนแผงเปิด)
//  ยังไม่ได้เข้าห้อง (เลือกที่นั่ง/ตัวละคร) = ไม่มี state = ยังไม่เริ่ม · ห้องรอ/โหวตโหมด/จัดทีม = ยังไม่เริ่ม
const PRE_MATCH = new Set(["LOBBY", "TEAM_MODE", "TEAM_SETUP"]);
let started = false;
const listeners = new Set();
function set(next) {
  if (next === started) return;
  started = next;
  listeners.forEach((fn) => fn());
}
socket.on("state", (s) => set(!!s && !!s.gameState && !PRE_MATCH.has(s.gameState)));
socket.on("sessionExpired", () => set(false));

const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
export function useMatchStarted() {
  return useSyncExternalStore(subscribe, () => started);
}
