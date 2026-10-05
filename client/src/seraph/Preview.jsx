// ============================================================
//  หน้าดูฉาก Moon Cell — เปิดด้วย  ?seraph  ต่อท้าย URL (dev: http://localhost:5173/?seraph)
//  ใช้ state จำลองในไฟล์นี้ (ไม่ต่อ server) · แท็บด้านล่างสลับฉาก / กลางวัน-กลางคืน · ?tab=<key> เปิดแท็บตรง
//  แท็บ "เกม: …" ใช้ SeraphGame ตัวจริงทั้งดุ้น (HUD/แผงสถานที่/หน้าต่างสถานะ/กระดานวันดวล)
// ============================================================

import { useMemo, useState } from "react";
import SeraphGame from "./SeraphGame";
import MatchIntro from "../oc/intro/MatchIntro";
import { MOON_MS } from "../oc/intro/moonFlight";
import { PlaceScreen, StatusWindow } from "./places";
import { SeraphBoot, DayBanner, PairingScene, DuelIntro, CharacterReveal, FaceOffScene, DeletionScene, CycleEndScene, FinalWinnerScene } from "./scenes";

const DOORS = [
  { key: "room", x: 380 }, { key: "library", x: 940 }, { key: "store", x: 1500 },
  { key: "church", x: 2080 }, { key: "park", x: 2660 }
];
const sk = (id, n, name, cost) => ({ name, cost, desc: `ผลของ ${name}`, img: `/characters/${id}/${id}_skill${n}.jpg` });
function mkPlayer(id, name, color, ch, chName, me) {
  return {
    id, name, color, img: `/characters/${ch}/${ch}.${ch === "eiji" ? "webp" : "jpg"}`, connected: true, alive: true, locked: false,
    character: { id: ch, img: `/characters/${ch}/${ch}.jpg`, name: chName, passive: { name: "สกิลติดตัว", desc: "ผลติดตัว" }, basic: sk(ch, 1, "สกิลพื้นฐาน A", 2), secondary: sk(ch, 2, "สกิลรอง B", 4), ultimate: sk(ch, 3, "ท่าไม้ตาย C", 6) },
    hp: 5, maxHp: 5, armor: 3, maxArmor: 3, skillPoints: me ? 4 : 4, maxSkill: 6, statuses: {}, statusAmt: {},
    cards: me ? [{ value: 7, color: "red" }, { value: 5, color: "blue" }, { value: 6, color: "green" }] : [{ value: 3, color: "yellow" }, { value: 9, color: "red" }],
    score: me ? 18 : null, cardCount: me ? null : 2,
    inventory: me ? [{ uid: "a", type: "heal", name: "ชุดปฐมพยาบาล", amount: 2 }, { uid: "b", type: "armor", name: "เกราะสำรอง", amount: 2 }] : [],
    gold: 14, teamId: null, scHidden: false,
  };
}
const PLAYERS = [
  mkPlayer("p1", "คุณ", "#3d8bd9", "kotone", "ฟุจิตะ โคโตเนะ", true),
  mkPlayer("p2", "Rin", "#d2455b", "satoru", "ซาโตรุ อาเคฟุ"),
  mkPlayer("p3", "Kaze", "#2f9e8f", "eiji", "เอจิ"),
  mkPlayer("p4", "Nox", "#6a5acd", "satoru", "ซาโตรุ")
];
const SHOP = [
  { id: 1, type: "skill", size: "small", amount: 2, price: 3 }, { id: 2, type: "armor", value: 1, price: 3 },
  { id: 3, type: "heal", amount: 1, price: 4 }, { id: 4, type: "resist", turns: 2, price: 4 }
];

function demoSc({ night, day, duelNight }) {
  const paired = day >= 6 || duelNight;
  const duel = day === 7 && !duelNight;
  return {
    day, cycleRound: night ? 2 : 1, night: duelNight || (duel && night), duelNight, duelDay: 7, daysTotal: 7, pairingDay: 5,
    noCombat: !duel, matrixHeld: 2, matrixMax: 4, shopOpen: !duel, ready: false, place: null, dailyUsed: false,
    readyCount: 1, totalPlayers: 4, myOpponent: paired ? "p2" : null, skillLevel: 4, caps: { hp: 5, armor: 3, skill: 5 },
    upgradePicks: { church: 2, library: 3 }, hpArmorCap: 10, matrixPlaced: { p2: 2 },
    pairs: paired ? [{ a: "p1", b: "p2", aName: "คุณ", bName: "Rin" }] : [], byes: paired ? [{ id: "p3", name: "Kaze" }, { id: "p4", name: "Nox" }] : [],
    duelPair: paired ? { a: "p1", b: "p2" } : null, spectating: false, eliminated: false,
    places: ["room", "church", "park", "library"].map((k) => ({ key: k, available: duelNight ? k === "room" : true, daily: k !== "park" })),
    finalBoard: PLAYERS.map((p, i) => ({ id: p.id, name: p.name, charName: p.character.name, eliminated: i > 0, stat: { duelWins: 3 - i, matrixFound: 6 - i } })),
    world: duel ? null : {
      w: 3100, doors: DOORS,
      pickups: duelNight ? [] : [
        { id: "m1", kind: "matrix", x: 640 }, { id: "c1", kind: "coin", x: 820 }, { id: "m2", kind: "matrix", x: 1200 },
        { id: "c2", kind: "coin", x: 1760 }, { id: "m3", kind: "matrix", x: 2360 }, { id: "c3", kind: "coin", x: 2900 }
      ],
      players: [{ id: "p1", x: 200, f: 1 }, { id: "p2", x: 520, f: -1 }, { id: "p3", x: 1100, f: 1 }, { id: "p4", x: 2450, f: -1 }]
    }
  };
}

const TABS = [
  ["intro", "ฉากเปิด (บินไปดวงจันทร์)"],
  ["world", "เกม: ทางเดิน"], ["world6", "เกม: วันที่ 6"], ["night", "เกม: คืนวันที่ 7"], ["duel", "เกม: ดวล"],
  ["church", "โบสถ์"], ["library", "ห้องสมุด"], ["room", "ห้องพัก"], ["park", "สวน"], ["store", "ร้านค้า"], ["status", "สถานะ"],
  ["boot", "บูต"], ["day", "เปิดวัน"], ["pairing", "ประกาศคู่"], ["duelIntro", "เข้าวันดวล"], ["reveal", "เปิดเผย"], ["faceoff", "ประจันหน้า"],
  ["deletion", "ถูกลบ"], ["cycleEnd", "จบรอบ"], ["final", "ผู้ชนะ"]
];

export default function SeraphPreview() {
  const q = new URLSearchParams(location.search);
  const [tab, setTab] = useState(q.get("tab") || "world");
  const [night, setNight] = useState(q.get("night") === "1");
  const [run, setRun] = useState(0);
  const [atk, setAtk] = useState(null);
  const day = tab === "world6" ? 6 : tab === "duel" || tab === "night" ? 7 : 3;
  const sc = useMemo(() => demoSc({ night, day, duelNight: tab === "night" }), [night, day, tab]);
  const state = {
    gameState: "SERAPH_PLACE", youId: "p1", players: PLAYERS, roundNumber: 3, cycle: night ? "night" : "day", shop: SHOP, gameMode: "seraph", deckLedger: [],
    seraph: sc, attack: atk,
    ...(tab === "duel" ? { gameState: atk ? "ATTACKING" : "PLAYING" } : {})
  };
  const me = PLAYERS[0];
  const done = () => setRun((r) => r + 1);
  const k = `${tab}${night}${run}`;
  let body = null;
  // ฉากเปิดแมตช์: การ์ดคนอื่นเป็น ??? (server ซ่อนตัวละคร) → บินอ้อมโลกไปดวงจันทร์
  const masked = PLAYERS.map((p, i) => (i === 0 ? { ...p, position: 1 } : { ...p, position: i + 1, img: null, character: { name: "???" } }));
  if (tab === "intro") body = <MatchIntro key={k} players={masked} area={1} onOutro={() => ({ moon: true, durationMs: MOON_MS })} onHandoff={() => {}} onDone={done} />;
  else if (["world", "world6", "night", "duel"].includes(tab)) body = <SeraphGame key={k} state={state} lowQ={false} skillConfirmOn roster={null} pairRole={null} onSceneChange={() => {}} />;
  else if (["church", "library", "room", "park", "store"].includes(tab)) body = <PlaceScreen key={k} place={tab} sc={sc} me={me} players={PLAYERS} youId="p1" shop={SHOP} onLeave={done} />;
  else if (tab === "status") body = <StatusWindow key={k} sc={sc} me={me} players={PLAYERS} onClose={done} />;
  else if (tab === "boot") body = <SeraphBoot key={k} players={PLAYERS} cycleRound={1} onDone={done} />;
  else if (tab === "day") body = <DayBanner key={k} day={night ? 7 : 3} night={night} cycleRound={1} onDone={done} />;
  else if (tab === "pairing") body = <PairingScene key={k} pairs={demoSc({ day: 6 }).pairs} byes={demoSc({ day: 6 }).byes} players={PLAYERS} myId="p1" onDone={done} />;
  else if (tab === "duelIntro") body = <DuelIntro key={k} onDone={done} />;
  else if (tab === "reveal") body = <CharacterReveal key={k} player={PLAYERS[1]} onDone={done} />;
  else if (tab === "faceoff") body = <FaceOffScene key={k} a={PLAYERS[0]} b={PLAYERS[1]} onDone={done} />;
  else if (tab === "deletion") body = <DeletionScene key={k} loser={PLAYERS[1]} winner={PLAYERS[0]} onDone={done} />;
  else if (tab === "cycleEnd") body = <CycleEndScene key={k} cycleRound={1} matrixHeld={2} onDone={done} />;
  else if (tab === "final") body = <FinalWinnerScene key={k} winner={PLAYERS[0]} board={sc.finalBoard} onDone={done} />;
  return (
    <div className="fixed inset-0" style={{ background: "#f7fafd" }}>
      {body}
      <div className="fixed bottom-2 left-2 right-2 z-[300] flex gap-1.5 flex-wrap justify-center pointer-events-auto">
        {TABS.map(([key, label]) => (
          <button key={key} type="button" onClick={() => { setTab(key); setRun((r) => r + 1); }} className="sc-prev-btn" data-on={tab === key || undefined}>{label}</button>
        ))}
        <button type="button" onClick={() => setNight((v) => !v)} className="sc-prev-btn">{night ? "กลางคืน" : "กลางวัน"}</button>
        {tab === "duel" && (
          <>
            <button type="button" className="sc-prev-btn" onClick={() => setAtk({ id: Date.now(), byId: "p1", targetId: "p2", dmg: 2, byName: "คุณ", targetName: "Rin", skills: [] })}>เราตี</button>
            <button type="button" className="sc-prev-btn" onClick={() => setAtk({ id: Date.now(), byId: "p2", targetId: "p1", dmg: 2, byName: "Rin", targetName: "คุณ", skills: [] })}>โดนตี</button>
          </>
        )}
      </div>
    </div>
  );
}
