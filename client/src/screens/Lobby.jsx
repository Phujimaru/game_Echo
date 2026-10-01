// ห้องรอ ORDEAL CALL — หน้าเดียวครอบ 3 สถานะก่อนเริ่มเกม (ลูกโลกตัวเดียว เลื่อนตำแหน่งตามหน้า)
//  LOBBY = ห้องรอ (oc/lobby/LobbyRoom) · TEAM_MODE = เลือกโหมดบนโลก (ModeVote) · TEAM_SETUP = จัดทีม (TeamSetup)
//  อีโมตปักบนโลกได้เฉพาะหน้าห้องรอ (server ส่งต่อ "lobbyEmote" ให้ทุกคนในห้อง) — หน้าเลือกโหมด/จัดทีมไม่มีอีโมต
//  เปลี่ยนหน้า: ลูกโลกเลื่อนไปตำแหน่งใหม่ · UI หน้าเก่าค้างเป็นภาพจางหายไป (ViewLayer) · UI หน้าใหม่ลอยขึ้น (oc-enter)
//  ปุ่มย้อนกลับถอยทีละขั้น: จัดทีม → เลือกโหมด (teamBackToMode) → ห้องรอ (modeBackToLobby) → เลือกตัว (onBack = ออกจากห้อง)
//  มาจากหน้าเลือกตัว: ภาพตัวละครบินลงตราของเรา (oc/lobby/heroArrival)
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import GlobeCanvas from "../globe/GlobeCanvas";
import { OcScreen } from "../oc/ui";
import { clickSound } from "../audio";
import { useLobbyEmotes, sendEmote } from "../oc/lobby/emotes";
import LobbyRoom from "../oc/lobby/LobbyRoom";
import ModeVote from "../oc/lobby/ModeVote";
import TeamSetup from "../oc/lobby/TeamSetup";
import { useHeroArrival } from "../oc/lobby/heroArrival";
import "../oc/lobby/lobby.css";

const VIEW_H = 2 * 6 * Math.tan((16 * Math.PI) / 180); // ความสูงจอเป็นหน่วยฉาก (กล้อง fov 32 ห่าง 6)
const r3 = (n) => Math.round(n * 1000) / 1000;

function useViewport() {
  const [vp, setVp] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  useEffect(() => {
    const on = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return vp;
}

/** ตำแหน่ง/ขนาดลูกโลกของแต่ละหน้า (คิดจากขนาดจอให้ไม่ชนแผงข้าง) · modeFocus = หน้าเลือกโหมดกำลังเลือกดูโหมด (มีแผงขวา) */
function globeLayout(view, w, h, modeFocus) {
  const ppu = h / VIEW_H;
  if (view === "TEAM_SETUP") {
    // ขอบฟ้าโค้งท้ายจอ ใต้คอลัมน์ทีม
    const s = 2.2;
    return { x: 0, y: r3(-VIEW_H / 2 + 120 / ppu - s - 0.5), s }; // -0.5 = ชดเชยมุมมองกล้อง (ขอบโลกโผล่สูงกว่าที่คิด)
  }
  if (view === "TEAM_MODE") {
    if (!modeFocus) {
      // ภาพรวม: โลกกลางจอ ไม่มีแผง
      const r = Math.min(w * 0.3, (h - 230) * 0.5, 1.12 * ppu);
      return { x: 0, y: -0.06, s: r3(r / ppu) };
    }
    // เลือกดูโหมด: โลกเลื่อนไปซ้ายพ้นแผง และซูมเข้าเล็กน้อย (หมุดที่เลือกหันมาตรงหน้า — ModeVote focusDir)
    const panel = Math.min(400, w * 0.34) + Math.max(16, w * 0.05) + 32;
    const avail = w - panel - 40;
    const cx = 40 + avail / 2;
    const r = Math.min(avail * 0.42, (h - 190) * 0.5, 1.3 * ppu);
    return { x: r3((cx - w / 2) / ppu), y: -0.06, s: r3(r / ppu) };
  }
  const col = Math.max(270, Math.min(360, w * 0.24));
  const side = Math.max(32, w * 0.04) + col + 28;
  const top = 100, bottom = 128;
  const availW = w - side * 2, availH = h - top - bottom;
  const r = Math.max(120, Math.min(availW * 0.45, availH * 0.46, 1.05 * ppu));
  return { x: 0, y: r3((h / 2 - (top + availH / 2)) / ppu), s: r3(r / ppu) };
}

/** ลูกโลกในหน่วยพิกเซลจอ (กลาง + รัศมี) — ให้ UI วางของรอบโลกได้ */
function globeRing(layout, w, h) {
  const ppu = h / VIEW_H;
  return { cx: w / 2 + layout.x * ppu, cy: h / 2 - layout.y * ppu, r: layout.s * ppu };
}

/**
 * กรอบของ UI หนึ่งหน้า — ตอนออกจากหน้า (view เปลี่ยน) โคลน DOM ไว้ในชั้นผี แล้วจางหายไปเอง
 *  เช็คหลัง commit ว่าถูกถอดจริง (StrictMode จำลองถอด/ใส่ใหม่ตอน dev — element ยังติดจออยู่ = ไม่ทำผี)
 */
function ViewLayer({ ghostRef, children }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    const host = ghostRef.current; // ชั้นผีอยู่ก่อน ViewLayer ใน DOM — ref พร้อมแล้วตอนนี้
    return () => {
      if (!el || !host) return;
      const ghost = el.cloneNode(true);
      queueMicrotask(() => {
        if (el.isConnected || !host.isConnected) return;
        ghost.classList.add("ocl-ghost");
        ghost.setAttribute("aria-hidden", "true");
        ghost.inert = true;
        host.appendChild(ghost);
        setTimeout(() => ghost.remove(), 480);
      });
    };
  }, [ghostRef]);
  return <div ref={ref} className="ocl-view">{children}</div>;
}

export default function Lobby({ state, onBack, lowQ, onToggleLowQ, skillConfirmOn = true, onToggleSkillConfirm, pairRole = null }) {
  const view = state.gameState === "TEAM_MODE" ? "TEAM_MODE" : state.gameState === "TEAM_SETUP" ? "TEAM_SETUP" : "LOBBY";
  const vp = useViewport();
  const [core, setCore] = useState(null);
  const [armedPick, setArmed] = useState(null);
  const armed = view === "LOBBY" ? armedPick : null; // อีโมตมีเฉพาะห้องรอ
  // โหมดที่หน้าเลือกโหมดกำลังเลือกดู (null = ภาพรวม) — เปลี่ยนหน้าแล้วล้าง (ปรับ state ระหว่าง render ตามแนวทางของ React)
  const [modeFocusPick, setModeFocus] = useState(null);
  const [seenView, setSeenView] = useState(view);
  if (seenView !== view) { setSeenView(view); setModeFocus(null); setArmed(null); }
  const modeFocus = view === "TEAM_MODE" ? modeFocusPick : null;
  const armedRef = useRef(null);
  useLayoutEffect(() => { armedRef.current = armed; });
  const interceptRef = useRef(null); // หน้าย่อยดักคลิกบนโลกก่อน (หมุดโหมด) — คืน true = กินคลิกนั้น

  useLobbyEmotes(core);
  const hero = useHeroArrival(view === "LOBBY");

  // คลิกบนโลก (ไม่ใช่ลาก): หมุดของหน้าย่อยก่อน ไม่โดนหมุดค่อยปักอีโมตที่เลือกไว้
  useEffect(() => {
    if (!core) return undefined;
    return core.onClick((ev) => {
      if (interceptRef.current?.(ev)) return;
      const emo = armedRef.current;
      if (!emo) return;
      const d = core.hitGlobe(ev);
      if (d && sendEmote(emo, d)) clickSound(); // กดบนโลกไม่ใช่ปุ่ม — เสียงคลิกต้องเรียกเอง
    });
  }, [core]);

  useEffect(() => {
    if (!armed) return undefined;
    const onKey = (e) => { if (e.key === "Escape") setArmed(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [armed]);

  const layout = globeLayout(view, vp.w, vp.h, modeFocus);
  const ghostRef = useRef(null);

  return (
    <OcScreen className="ocl" data-view={view} data-armed={armed ? "true" : undefined}>
      <GlobeCanvas layout={layout} onReady={(c) => { setCore(c); return () => setCore(null); }} />
      <div ref={ghostRef} className="ocl-ghosts" aria-hidden="true" />
      {view === "TEAM_MODE" ? (
        <ViewLayer key="TEAM_MODE" ghostRef={ghostRef}>
          <ModeVote state={state} core={core} interceptRef={interceptRef} focus={modeFocus} onFocus={setModeFocus} />
        </ViewLayer>
      ) : view === "TEAM_SETUP" ? (
        <ViewLayer key="TEAM_SETUP" ghostRef={ghostRef}>
          <TeamSetup state={state} />
        </ViewLayer>
      ) : (
        <ViewLayer key="LOBBY" ghostRef={ghostRef}>
          <LobbyRoom
            state={state}
            ring={globeRing(layout, vp.w, vp.h)}
            vh={vp.h}
            armed={armed}
            onArm={setArmed}
            lowQ={lowQ}
            onToggleLowQ={onToggleLowQ}
            skillConfirmOn={skillConfirmOn}
            onToggleSkillConfirm={onToggleSkillConfirm}
            pairRole={pairRole}
            hero={hero}
            onBack={onBack}
          />
        </ViewLayer>
      )}
    </OcScreen>
  );
}
