// ห้องรอ (gameState LOBBY) — ลูกโลกกลางจอ (ตำแหน่งเดิม) · ที่นั่ง P1–P7 เรียงเป็นวงโคจรรอบโลก (ซ้าย/ขวา) มีเส้นโยงถึงผิวโลก
//  มุมขวาบน = ตั้งค่า · ขวาล่าง = ปุ่มพร้อม · ซ้ายล่าง = ย้อนกลับ · กลางล่าง = อีโมต
//  ข้อมูลลับ: ตัวละครของคนอื่นห้ามโชว์ (state ส่ง img/character ของทุกคนมา — ใช้เฉพาะของเราเอง)
import { socket } from "../../socket";
import { POSITIONS } from "../../data/positions";
import { OcButton } from "../ui";
import EmoteDock from "./EmoteDock";

const PAIR_ROLES = [["pilot", "นักบิน"], ["gunner", "พลปืน"]];
const DEG = Math.PI / 180;

function PairLines({ pair }) {
  if (!pair) return null;
  return (
    <span className="ocl-pair">
      {PAIR_ROLES.map(([k, label]) => (
        <span key={k} className={pair[k]?.ready ? "on" : ""}>
          <b>{label}</b>
          <em>{pair[k] ? pair[k].name : "รอคู่หู…"}</em>
          {pair[k]?.ready && <i aria-label="พร้อม">✓</i>}
        </span>
      ))}
    </span>
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

/**
 * จุดวางที่นั่งรอบลูกโลก (พิกเซลจอ) — ครึ่งแรกฝั่งซ้าย (บน→ล่าง) ที่เหลือฝั่งขวา
 *  แต่ละที่นั่งอยู่บนวงกลมรัศมี R รอบโลก (ขอบด้านในของป้ายแตะวง) → เรียงเป็นโค้งรับผิวโลก
 */
function seatSpots(n, ring, h) {
  const { cx, cy, r } = ring;
  const R = r * 1.2 + 22; // พ้นหมอกฟ้ารอบโลก (~1.2 เท่ารัศมี)
  const nl = Math.ceil(n / 2), nr = n - nl;
  const span = Math.max(60, Math.min(cy - 100, h - cy - 120)); // ระยะขึ้น/ลงจากกลางโลกที่วางป้ายได้
  const tMax = Math.min(56 * DEG, Math.asin(Math.min(1, span / R)));
  const step = nl > 1 ? (2 * tMax) / (nl - 1) : 0;
  const at = (side, t) => {
    const sx = side === "l" ? -1 : 1;
    return {
      side, t,
      x: cx + sx * R * Math.cos(t), y: cy + R * Math.sin(t),          // ขอบในของป้าย
      gx: cx + sx * r * Math.cos(t), gy: cy + r * Math.sin(t),         // จุดบนผิวโลก
    };
  };
  const spots = [];
  for (let i = 0; i < nl; i++) spots.push(at("l", -tMax + i * step));
  for (let j = 0; j < nr; j++) spots.push(at("r", (j - (nr - 1) / 2) * step));
  return { spots, R };
}

/** ที่นั่งหนึ่งที่ — ของเรามีภาพตัวละคร · คนอื่นเป็นตราผนึก · ว่าง = กรอบเส้นประ */
function Seat({ n, p, me, spot, i }) {
  const img = me ? (p.character?.img || p.img) : null;
  const status = !p ? "empty" : p.ready ? "ready" : "wait";
  const style = {
    top: `${spot.y}px`,
    ...(spot.side === "l" ? { right: `calc(100% - ${spot.x}px)` } : { left: `${spot.x}px` }),
  };
  return (
    <div className={`ocl-seat ${spot.side}${me ? " me" : ""}`} style={style} data-status={status} data-off={p?.connected === false ? "true" : undefined}>
      <div className="ocl-seat-in" style={{ "--c": p?.color || "var(--oc-sky)", animationDelay: `${0.12 + 0.05 * i}s` }}>
        <span className="ocl-emb" aria-hidden="true">
          <span className="ocl-emb-face">
            {img ? <img src={img} alt="" draggable={false} /> : p ? <span className="ocl-seal">?</span> : null}
          </span>
        </span>
        <span className="ocl-seat-info">
          <span className="ocl-seat-top">
            <span className="ocl-seat-no oc-latin">P{n}</span>
            {me && <span className="ocl-seat-you">คุณ</span>}
            {p && <span className="ocl-seat-state">{p.ready ? "พร้อม" : "รอ"}</span>}
          </span>
          <b className="ocl-seat-name">{p ? p.name : "ว่าง"}</b>
          {me && p.character?.name && <small className="ocl-seat-char">{p.character.name}</small>}
          {p?.connected === false && <span className="ocl-seat-warn">เชื่อมต่อใหม่…</span>}
          {p && <PairLines pair={p.pair} />}
        </span>
      </div>
    </div>
  );
}

export default function LobbyRoom({ state, ring, vh, armed, onArm, lowQ, onToggleLowQ, skillConfirmOn, onToggleSkillConfirm, pairRole, onBack }) {
  const count = state.players.length;
  const me = state.players.find((p) => p.id === state.youId);
  // ตัวละครคู่ (สไตรเกอร์ ยูเรก้า): ปุ่มพร้อมเป็นของแต่ละคน — ระเบียนนับว่าพร้อมเมื่อครบคู่และพร้อมทั้งคู่
  const mySideReady = me?.pair && pairRole ? !!me.pair[pairRole]?.ready : !!me?.ready;
  const readyCount = state.players.filter((p) => p.ready).length;
  const maxSeats = Math.min(state.maxPlayers || POSITIONS.length, POSITIONS.length);
  const seats = POSITIONS.slice(0, maxSeats);
  const byPos = new Map(state.players.map((p) => [p.position, p]));
  const canReady = count >= 2 || !!me?.pair;
  const solo = count === 1 && !me?.pair;
  const { spots, R } = seatSpots(seats.length, ring, vh);

  return (
    <div className="oc-layer ocl-room">
      <header className="ocl-title oc-enter">
        <h1 className="oc-h1">ห้องรอ</h1>
        <span className="oc-label">{count} / {maxSeats} ที่นั่ง</span>
      </header>

      <div className="ocl-prefs oc-enter d1">
        <Switch on={lowQ} label="ข้ามวิดีโอ" onToggle={onToggleLowQ} />
        <Switch on={skillConfirmOn} label="ถามก่อนใช้สกิล" onToggle={onToggleSkillConfirm} />
      </div>

      {/* วงโคจร + เส้นโยงที่นั่งถึงผิวโลก */}
      <svg className="ocl-orbit" aria-hidden="true">
        <circle className="ocl-orbit-ring" cx={ring.cx} cy={ring.cy} r={R} />
        {seats.map((n, i) => {
          const p = byPos.get(n);
          const s = spots[i];
          if (!p) return null;
          return (
            <g key={n} className="ocl-tether" data-status={p.ready ? "ready" : "wait"} style={{ "--c": p.color, animationDelay: `${0.3 + 0.05 * i}s` }}>
              <line x1={s.x} y1={s.y} x2={s.gx} y2={s.gy} />
              <circle cx={s.gx} cy={s.gy} r={p.ready ? 4 : 3} />
            </g>
          );
        })}
      </svg>

      {seats.map((n, i) => {
        const p = byPos.get(n) || null;
        return <Seat key={n} n={n} p={p} me={!!p && p.id === state.youId} spot={spots[i]} i={i} />;
      })}

      <EmoteDock armed={armed} onArm={onArm} className="ocl-dock oc-enter d2" />

      <div className="ocl-ready oc-enter d2" data-ready={mySideReady ? "true" : "false"}>
        <div className="ocl-ready-head">
          <span className="oc-label">พร้อม</span>
          <span className="ocl-pips" aria-hidden="true">
            {[...state.players].sort((a, b) => a.position - b.position).map((p) => (
              <i key={p.id} style={{ "--c": p.color }} data-on={p.ready ? "true" : "false"} />
            ))}
          </span>
          <span className="ocl-readynum"><b>{readyCount}</b> / {count}</span>
        </div>
        {canReady && (
          <OcButton variant={mySideReady ? "" : "primary"} className="ocl-readybtn" onClick={() => socket.emit("toggleReady")}>
            {mySideReady ? "ยกเลิก" : "พร้อม"}
          </OcButton>
        )}
        {solo && (
          <OcButton variant="primary" className="ocl-readybtn" onClick={() => socket.emit("startGame")}>
            เล่นคนเดียว (ทดสอบ)
          </OcButton>
        )}
      </div>

      <OcButton variant="ghost" className="ocl-back oc-enter d2" onClick={onBack}>← ย้อนกลับ</OcButton>
    </div>
  );
}
