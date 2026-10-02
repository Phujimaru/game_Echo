// หน้าดูกระดานจริง (Game.jsx) ด้วย state จำลอง — เฉพาะ dev: ?hud=1&game=1
//  ไว้ตรวจว่าแผงตัวเราต่อกับ GameBoard ถูก (เงื่อนไขปุ่ม/สถานะ/การ์ด) โดยไม่ต้องเปิดห้องจริง
//  phase=PLAYING|ATTACK (ATTACK = เราเป็นฝ่ายโจมตี → แผงเลื่อนลง) · arena=1..3 · n=1..6 · ch=<id ตัวละครเรา>
import Game from "../Game";

const COLS = ["#3d8bd9", "#9b4f96", "#e0812f", "#2fa39a", "#d2455b", "#6b7fd6", "#c49a2c"];
const skill = (id, n, name, cost) => ({ name, cost, desc: `ก่อนเปิดไพ่: ผลของ ${name}`, img: `/characters/${id}/${id}_skill${n}.jpg` });

function player(i, me, chId) {
  const id = me ? chId : "artoria_caster";
  return {
    id: `p${i}`,
    name: me ? "เรา" : `ผู้เล่น ${i + 1}`,
    color: COLS[i % 7],
    img: `/characters/${id}/${id}.webp`,
    connected: true,
    alive: true,
    locked: false,
    character: {
      id,
      name: me ? "อาร์โทเรีย แคสเตอร์" : `คู่แข่ง ${i}`,
      passive: { name: "ติดตัว", desc: "สกิลติดตัว" },
      basic: skill(id, 1, "Strike Air", 2),
      secondary: skill(id, 2, "Mana Burst", 3),
      ultimate: skill(id, 3, "Excalibur", 6),
    },
    hp: me ? 4 : 5, maxHp: 7, armor: 2, maxArmor: 3, tempHp: me ? 1 : 0, shield: me ? 1 : 0,
    skillPoints: me ? 5 : 3, maxSkill: 8,
    statuses: me ? { poison: 2, atkUp: 3, dodge: 2, stun: 1, mark: 3, burn: 2, seal: 0 } : { poison: 1 },
    statusAmt: me ? { atkUp: 1 } : {},
    cards: me ? [{ value: 7, color: "red" }, { special: "king" }, { value: 4, color: "blue" }] : [],
    score: me ? 18 : null,
    inventory: me ? [{ id: "a" }, { id: "b" }] : [],
    gold: 12,
    teamId: null,
  };
}

export default function GamePreview() {
  const q = new URLSearchParams(location.search);
  const n = Math.min(6, Math.max(1, Number(q.get("n") || 6)));
  const area = Math.min(3, Math.max(1, Number(q.get("arena") || 1)));
  const phase = q.get("phase") || "PLAYING";
  const players = Array.from({ length: n + 1 }, (_, i) => player(i, i === 0, q.get("ch") || "artoria_caster"));
  const state = {
    gameState: phase,
    youId: "p0",
    players,
    roundNumber: 3,
    cycle: q.get("night") === "1" ? "night" : "day",
    journey: { area, name: "อาณาจักรแห่งจุดเริ่มต้น", turnsLeft: 7, night: q.get("night") === "1", day: "กลางวัน", nightDesc: "กลางคืน" },
    gameMode: "ffa",
    attackerId: phase === "ATTACK" ? "p0" : null,
    shop: [],
    deckLedger: [],
  };
  return <Game state={state} lowQ={q.get("lowq") === "1"} skillConfirmOn />;
}
