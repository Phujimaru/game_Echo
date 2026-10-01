// ห้องรอ (gameState LOBBY) — 3 คอลัมน์: การ์ดของเรา (ซ้าย) · ลูกโลก + อีโมต (กลาง) · รายชื่อผู้เล่น (ขวา)
//  ข้อมูลลับ: ตัวละครของคนอื่นห้ามโชว์ (state ส่ง img/character ของทุกคนมา — ใช้เฉพาะของเราเอง)
import { socket } from "../../socket";
import { clickSound } from "../../audio";
import { POSITIONS } from "../../data/positions";
import { OcButton } from "../ui";
import EmoteDock from "./EmoteDock";

const PAIR_ROLES = [["pilot", "นักบิน"], ["gunner", "พลปืน"]];

function PairLines({ pair }) {
  if (!pair) return null;
  return (
    <div className="ocl-pair">
      {PAIR_ROLES.map(([k, label]) => (
        <span key={k} className={pair[k]?.ready ? "on" : ""}>
          <b>{label}</b>
          {pair[k] ? pair[k].name : "รอคู่หู…"}
          {pair[k]?.ready && <i aria-label="พร้อม">✓</i>}
        </span>
      ))}
    </div>
  );
}

function Switch({ on, label, onToggle }) {
  return (
    <button type="button" role="switch" aria-checked={!!on} className="ocl-switch" onClick={onToggle}>
      <span>{label}</span>
      <i aria-hidden="true" />
    </button>
  );
}

/** การ์ดของเรา — โชว์ภาพตัวละครของตัวเองได้ (ของคนอื่นห้าม) */
function MeCard({ me }) {
  const img = me.character?.img || me.img;
  return (
    <div className="ocl-hero oc-enter" data-ready={me.ready ? "true" : "false"} style={{ "--c": me.color }}>
      <div className="ocl-hero-art">
        {img && <img src={img} alt="" draggable={false} />}
        <span className="ocl-hero-seat oc-latin">P{me.position}</span>
        <span className="ocl-hero-you">คุณ</span>
        <div className="ocl-hero-name">
          <b>{me.name}</b>
          {me.character?.name && <small>{me.character.name}</small>}
        </div>
      </div>
      <PairLines pair={me.pair} />
    </div>
  );
}

/** ผู้เล่นคนอื่น — ไม่มีข้อมูลตัวละคร (การ์ดคว่ำแทน) */
function PlayerRow({ p, i }) {
  return (
    <li
      className="ocl-row oc-enter"
      data-ready={p.ready ? "true" : "false"}
      data-off={p.connected === false ? "true" : "false"}
      style={{ "--c": p.color, animationDelay: `${0.05 * i}s` }}
    >
      <span className="ocl-row-back" aria-hidden="true"><span>?</span></span>
      <span className="ocl-row-main">
        <span className="ocl-row-top">
          <span className="ocl-row-seat oc-latin">P{p.position}</span>
          <b className="ocl-row-name">{p.name}</b>
        </span>
        {p.connected === false && <span className="ocl-row-warn">เชื่อมต่อใหม่…</span>}
        <PairLines pair={p.pair} />
      </span>
      <span className="ocl-row-state">{p.ready ? "พร้อม" : "ยังไม่พร้อม"}</span>
    </li>
  );
}

export default function LobbyRoom({ state, armed, onArm, lowQ, onToggleLowQ, skillConfirmOn, onToggleSkillConfirm, pairRole, onBack }) {
  const count = state.players.length;
  const me = state.players.find((p) => p.id === state.youId);
  // ตัวละครคู่ (สไตรเกอร์ ยูเรก้า): ปุ่มพร้อมเป็นของแต่ละคน — ระเบียนนับว่าพร้อมเมื่อครบคู่และพร้อมทั้งคู่
  const mySideReady = me?.pair && pairRole ? !!me.pair[pairRole]?.ready : !!me?.ready;
  const readyCount = state.players.filter((p) => p.ready).length;
  const others = state.players.filter((p) => p.id !== state.youId).sort((a, b) => a.position - b.position);
  const taken = new Set(state.players.map((p) => p.position));
  const maxSeats = state.maxPlayers || POSITIONS.length;
  const empty = POSITIONS.filter((n) => n <= maxSeats && !taken.has(n));
  const canReady = count >= 2 || !!me?.pair;
  const solo = count === 1 && !me?.pair;

  return (
    <div className="oc-layer ocl-room">
      <header className="ocl-title oc-enter">
        <h1 className="oc-h1">ห้องรอ</h1>
        <span className="oc-label">{count} / {maxSeats} ที่นั่ง</span>
      </header>

      <aside className="ocl-left">
        {me && <MeCard me={me} />}

        <div className="ocl-readybox oc-enter d1">
          <div className="ocl-readyhead">
            <span className="oc-label">พร้อม</span>
            <span className="ocl-readynum"><b>{readyCount}</b> / {count}</span>
          </div>
          <div className="ocl-pips" aria-hidden="true">
            {[...state.players].sort((a, b) => a.position - b.position).map((p) => (
              <i key={p.id} style={{ "--c": p.color }} data-on={p.ready ? "true" : "false"} />
            ))}
          </div>
          {canReady && (
            <OcButton
              variant={mySideReady ? "" : "primary"}
              className="ocl-readybtn"
              onClick={() => { clickSound(); socket.emit("toggleReady"); }}
            >
              {mySideReady ? "ยกเลิก" : "พร้อม"}
            </OcButton>
          )}
          {solo && (
            <OcButton variant="primary" className="ocl-readybtn" onClick={() => { clickSound(); socket.emit("startGame"); }}>
              เล่นคนเดียว (ทดสอบ)
            </OcButton>
          )}
        </div>

        <div className="ocl-settings oc-enter d2">
          <Switch on={lowQ} label="ข้ามวิดีโอ" onToggle={onToggleLowQ} />
          <Switch on={skillConfirmOn} label="ถามก่อนใช้สกิล" onToggle={onToggleSkillConfirm} />
        </div>
      </aside>

      <aside className="ocl-right oc-enter d1">
        <div className="ocl-righthead">
          <span className="oc-label">ผู้เล่น</span>
          <span className="ocl-count oc-latin">{count}/{maxSeats}</span>
        </div>
        <ul className="ocl-roster">
          {others.map((p, i) => <PlayerRow key={p.id} p={p} i={i} />)}
          {empty.map((n) => (
            <li key={`e${n}`} className="ocl-row ocl-row-empty">
              <span className="ocl-row-seat oc-latin">P{n}</span>
              <span>ว่าง</span>
            </li>
          ))}
        </ul>
      </aside>

      <EmoteDock armed={armed} onArm={onArm} className="ocl-dock oc-enter d2" />

      <OcButton variant="ghost" className="ocl-back" onClick={onBack}>← ย้อนกลับ</OcButton>
    </div>
  );
}
