// ห้องรอ ORDEAL CALL — หน้าเดียวครอบ 3 สถานะก่อนเริ่มเกม (ลูกโลกตัวเดียว เลื่อนตำแหน่งตามหน้า)
//  LOBBY = ห้องรอ (oc/lobby/LobbyRoom) · TEAM_MODE = เลือกโหมดบนโลก (ModeVote) · TEAM_SETUP = จัดทีม (TeamSetup)
//  อีโมตปักบนโลกใช้ได้ทุกหน้า (server ส่งต่อ "lobbyEmote" ให้ทุกคนในห้อง)
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import GlobeCanvas from "../globe/GlobeCanvas";
import { OcScreen } from "../oc/ui";
import { useLobbyEmotes, sendEmote } from "../oc/lobby/emotes";
import LobbyRoom from "../oc/lobby/LobbyRoom";
import ModeVote from "../oc/lobby/ModeVote";
import TeamSetup from "../oc/lobby/TeamSetup";
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

/** ตำแหน่ง/ขนาดลูกโลกของแต่ละหน้า (คิดจากขนาดจอให้ไม่ชนแผงข้าง) */
function globeLayout(view, w, h) {
  const ppu = h / VIEW_H;
  if (view === "TEAM_SETUP") {
    // ขอบฟ้าโค้งท้ายจอ ใต้คอลัมน์ทีม
    const s = 2.2;
    return { x: 0, y: r3(-VIEW_H / 2 + 120 / ppu - s - 0.5), s }; // -0.5 = ชดเชยมุมมองกล้อง (ขอบโลกโผล่สูงกว่าที่คิด)
  }
  if (view === "TEAM_MODE") {
    const panel = Math.min(400, w * 0.34) + Math.max(16, w * 0.05) + 32;
    const avail = w - panel - 40;
    const cx = 40 + avail / 2;
    const r = Math.min(avail * 0.36, (h - 230) * 0.5, 1.12 * ppu);
    return { x: r3((cx - w / 2) / ppu), y: -0.06, s: r3(r / ppu) };
  }
  const col = Math.max(270, Math.min(360, w * 0.24));
  const side = Math.max(32, w * 0.04) + col + 28;
  const top = 100, bottom = 128;
  const availW = w - side * 2, availH = h - top - bottom;
  const r = Math.max(120, Math.min(availW * 0.45, availH * 0.46, 1.05 * ppu));
  return { x: 0, y: r3((h / 2 - (top + availH / 2)) / ppu), s: r3(r / ppu) };
}

export default function Lobby({ state, onBack, lowQ, onToggleLowQ, skillConfirmOn = true, onToggleSkillConfirm, pairRole = null }) {
  const view = state.gameState === "TEAM_MODE" ? "TEAM_MODE" : state.gameState === "TEAM_SETUP" ? "TEAM_SETUP" : "LOBBY";
  const vp = useViewport();
  const [core, setCore] = useState(null);
  const [armedPick, setArmed] = useState(null);
  const armed = view === "TEAM_SETUP" ? null : armedPick; // หน้าจัดทีมไม่มีแถบอีโมต
  const armedRef = useRef(null);
  useLayoutEffect(() => { armedRef.current = armed; });
  const interceptRef = useRef(null); // หน้าย่อยดักคลิกบนโลกก่อน (หมุดโหมด) — คืน true = กินคลิกนั้น

  useLobbyEmotes(core);

  // คลิกบนโลก (ไม่ใช่ลาก): หมุดของหน้าย่อยก่อน ไม่โดนหมุดค่อยปักอีโมตที่เลือกไว้
  useEffect(() => {
    if (!core) return undefined;
    return core.onClick((ev) => {
      if (interceptRef.current?.(ev)) return;
      const emo = armedRef.current;
      if (!emo) return;
      const d = core.hitGlobe(ev);
      if (d) sendEmote(emo, d);
    });
  }, [core]);

  useEffect(() => {
    if (!armed) return undefined;
    const onKey = (e) => { if (e.key === "Escape") setArmed(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [armed]);

  const layout = globeLayout(view, vp.w, vp.h);

  return (
    <OcScreen className="ocl" data-view={view} data-armed={armed ? "true" : undefined}>
      <GlobeCanvas layout={layout} onReady={(c) => { setCore(c); return () => setCore(null); }} />
      {view === "TEAM_MODE" ? (
        <ModeVote state={state} core={core} interceptRef={interceptRef} armed={armed} onArm={setArmed} onBack={onBack} />
      ) : view === "TEAM_SETUP" ? (
        <TeamSetup state={state} onBack={onBack} />
      ) : (
        <LobbyRoom
          state={state}
          armed={armed}
          onArm={setArmed}
          lowQ={lowQ}
          onToggleLowQ={onToggleLowQ}
          skillConfirmOn={skillConfirmOn}
          onToggleSkillConfirm={onToggleSkillConfirm}
          pairRole={pairRole}
          onBack={onBack}
        />
      )}
    </OcScreen>
  );
}
