// หน้าดูกระดานจริง (Game.jsx) ด้วย state จำลอง — เฉพาะ dev: ?hud=1&game=1
//  ไว้ตรวจว่าแผงตัวเราต่อกับ GameBoard ถูก (เงื่อนไขปุ่ม/สถานะ/การ์ด) โดยไม่ต้องเปิดห้องจริง
//  phase=PLAYING|ATTACK (ATTACK = เราเป็นฝ่ายโจมตี → แผงเลื่อนลง) · arena=1..3 · n=1..6 · ch=<id ตัวละครเรา>
//  echo=1 = คู่แข่งคนที่ 2 เป็น Echo + แผงปุ่มทดสอบสนามราชินี (ฉากเปิดตัว/ต่อย/ต่อยเรา/โดนตี/ออกจากสนาม)
//  journey=0 = โต๊ะแบบเดิม · ch=oguri / escanor / kim / bard / kai = มีแถวทรัพยากร/ช่องพิเศษ · st=many = สถานะเยอะ · drawer=1 = กดเปิดลิ้นชักสถานะให้หลังโหลด
import { useEffect, useState } from "react";
import Game from "../Game";
import { measureHud } from "./hudMeasure";

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
    // ข้อมูลทรัพยากรของตัวละครที่ statusEntries อ่าน (โชว์เป็นแถวทรัพยากรในแผงผู้เล่น)
    ...(me && chId === "oguri" ? { oguriEnergy: 10, stamina: 30, oguriChargeCap: 52 } : {}),
    // ch=echo_queen: เราเป็น Echo กลางท่าไม้ตาย ยังไม่ได้ตีฟรีเทิร์นนี้ (การ์ดศัตรูต้องขึ้นเป้าหมาย)
    ...(me && chId === "echo_queen" ? { echoQueen: { lv: 10, lvMax: 10, queenTurns: 0, ultTurns: 5, freeHitPending: true, freeHitTargets: ["p1", "p2", "p3", "p4", "p5", "p6"], basicCd: 3 } } : {}),
    ...(me && chId === "escanor" ? { escanorCharge: 7, escanorChargeMax: 12 } : {}),
    ...(me && chId === "kim" ? { kim: { scabbard: 42, scabbardMax: 100, poise: 20, poiseMax: 50, crit: 24, awake: false, coin: "heads", resentUsed: false } } : {}),
  };
}

// ?echo=1: ตัวนับ/ตัวจับเวลาของแผงทดสอบ (หน้า dev หน้าเดียว — เก็บระดับโมดูลพอ)
const echoSeq = { n: 1 };
const echoTimers = [];
const later = (ms, fn) => { echoTimers.push(setTimeout(fn, ms)); };

export default function GamePreview() {
  const q = new URLSearchParams(location.search);
  const n = Math.min(6, Math.max(1, Number(q.get("n") || 6)));
  const area = Math.min(3, Math.max(1, Number(q.get("arena") || 1)));
  const phase = q.get("phase") || "PLAYING";
  const players = Array.from({ length: n + 1 }, (_, i) => player(i, i === 0, q.get("ch") || "artoria_caster"));
  if (q.get("st") === "many") {
    Object.assign(players[0].statuses, { bleed: 3, regen: 2, shock: 2, numb: 1, curse: 4, silence: 2, chill: 2, invert: 3, decay: 2 });
  }
  useEffect(() => {
    if (q.get("drawer") !== "1") return undefined;
    const t = setTimeout(() => document.querySelector(".hud-drawer-tab")?.click(), 600);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // ?measure=1 = วัดกล่องหลังการ์ดผู้เล่นหล่นลงที่นั่งเสร็จ
  useEffect(() => {
    if (q.get("measure") !== "1") return undefined;
    const t = setTimeout(measureHud, 8000);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // ?echo=1: จำลองท่าไม้ตาย Echo (EchoQueenLayer อ่าน state.cutscene / echoField / attack เหมือนของจริง)
  const echoOn = q.get("echo") === "1" && n >= 2;
  const [eq, setEq] = useState({ phase: null, cs: null, field: null, attack: null });
  useEffect(() => () => echoTimers.forEach(clearTimeout), []);
  if (echoOn) {
    players[2] = { ...players[2], name: "Echo", hp: 30, maxHp: 30, armor: 0, maxArmor: 0, img: "/characters/echo_queen/echo_queen_portrait.webp",
      echoQueen: { lv: 10, queenTurns: 0, ultTurns: eq.field ? 5 : 0 } };
  }
  const echoCtl = echoOn && {
    transform: () => {
      const id = ++echoSeq.n;
      setEq({ phase: "CUTSCENE", cs: { id, kind: "echoQueen", playerId: "p2", name: "Echo" }, field: { ownerId: "p2", seq: id, turnsLeft: 5 }, attack: null });
      later(13000, () => setEq((e) => ({ ...e, phase: null, cs: null })));
    },
    punch: (target) => {
      const id = ++echoSeq.n;
      setEq((e) => ({ ...e, phase: "ATTACKING", attack: { id, byId: "p2", targetId: target, dmg: 3, byName: "Echo", targetName: target, skills: [] } }));
      later(2500, () => setEq((e) => ({ ...e, phase: null, attack: null })));
    },
    hit: () => {
      const id = ++echoSeq.n;
      setEq((e) => ({ ...e, phase: "ATTACKING", attack: { id, byId: "p0", targetId: "p2", dmg: 1, byName: "เรา", targetName: "Echo", skills: [] } }));
      later(2500, () => setEq((e) => ({ ...e, phase: null, attack: null })));
    },
    exit: () => setEq((e) => ({ ...e, field: null })),
  };
  const state = {
    gameState: (echoOn && eq.phase) || phase,
    cutscene: echoOn ? eq.cs : null,
    echoField: echoOn ? eq.field : null,
    attack: echoOn ? eq.attack : null,
    youId: "p0",
    players,
    roundNumber: 3,
    cycle: q.get("night") === "1" ? "night" : "day",
    // journey=0 = โต๊ะแบบเดิม (ไม่มีสนาม 2.5D) ไว้ตรวจการ์ดคู่แข่งนอกสนาม
    journey: q.get("journey") === "0" ? null : { area, name: "อาณาจักรแห่งจุดเริ่มต้น", turnsLeft: 7, night: q.get("night") === "1", day: "กลางวัน", nightDesc: "กลางคืน" },
    gameMode: "ffa",
    attackerId: phase === "ATTACK" ? "p0" : null,
    shop: [],
    deckLedger: [],
  };
  return (
    <>
      <Game state={state} lowQ={q.get("lowq") === "1"} skillConfirmOn />
      {echoCtl && (
        <div style={{ position: "fixed", left: 8, bottom: 8, zIndex: 200, display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[["ฉากเปิดตัว", echoCtl.transform], ["ต่อย ผู้เล่น 2", () => echoCtl.punch("p1")], ["ต่อยเรา", () => echoCtl.punch("p0")], ["โดนตี", echoCtl.hit], ["ออกจากสนาม", echoCtl.exit]].map(([label, fn]) => (
            <button key={label} onClick={fn} style={{ padding: "4px 10px", background: "#2a1650", color: "#fff", border: "1px solid #a85cff" }}>{label}</button>
          ))}
        </div>
      )}
    </>
  );
}
