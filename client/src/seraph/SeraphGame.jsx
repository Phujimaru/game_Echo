// ============================================================
//  Moon Cell (SE.RA.PH) — ตัวคุมฉากของโหมด
//
//    วันที่ 1-6 + คืนวันที่ 7 -> ทางเดินอาคารเรียน (World) + แผงสถานที่ + หน้าต่างสถานะ
//    วันที่ 7 (ดวล)           -> กระดานเดิม <Game> บนสนาม 2.5D ของโหมด (สนาม 8) + โมเดลตัวละคร (DuelModels)
//    ฉากเล่าเรื่องทั้งหมดซ้อนทับด้านบนเป็นคิว (scenes.jsx)
// ============================================================

import { useEffect, useRef, useState } from "react";
import { socket } from "../socket";
import { playSfx, stopLoopSfx } from "../audio";
import Game from "../screens/Game";
import World from "./World";
import DuelModels from "./DuelModels";
import SpectatorRail from "./SpectatorRail";
import { PlaceScreen, StatusWindow, WorldHud } from "./places";
import { SeraphBoot, DayBanner, PairingScene, DuelIntro, CharacterReveal, FaceOffScene, DeletionScene, CycleEndScene, FinalWinnerScene } from "./scenes";

export default function SeraphGame({ state, lowQ, skillConfirmOn, roster, pairRole, onSceneChange }) {
  const sc = state.seraph;
  const me = state.players.find((p) => p.id === state.youId);
  const duelDay = sc.duelDay || sc.daysTotal || 7;
  const inWorld = !!sc.world;

  const [scene, setScene] = useState(null);       // ฉากซ้อนทับที่กำลังเล่น (มี next ต่อคิวได้)
  const [place, setPlace] = useState(null);       // สถานที่ที่เปิดอยู่
  const [statusOpen, setStatusOpen] = useState(false);

  const prevKey = useRef(null);
  const prevCycle = useRef(null);
  const seenPairing = useRef(null);
  const bootShown = useRef(false);

  useEffect(() => () => stopLoopSfx(), []);

  // เพลง: App.jsx เป็นเจ้าของเพลงคนเดียว — ที่นี่แค่บอกว่ากำลังเล่นฉากอะไร (หรืออยู่ในสถานที่)
  const musicScene = scene?.kind ?? (place ? "place" : null);
  useEffect(() => { onSceneChange?.(musicScene); }, [musicScene]);
  useEffect(() => () => onSceneChange?.(null), []);

  // วันจบ/เฟสเปลี่ยน -> ปิดแผงสถานที่ที่ค้าง
  useEffect(() => { if (state.gameState !== "SERAPH_PLACE") setPlace(null); }, [state.gameState]);
  useEffect(() => { setPlace(null); }, [sc.day, sc.cycleRound, sc.duelNight]);

  // ---------- คิวฉากตามเหตุการณ์ ----------
  const dayKey = `${sc.cycleRound}-${sc.day}-${sc.duelNight ? "n" : "d"}`;
  useEffect(() => {
    if (!bootShown.current) {
      bootShown.current = true;
      prevKey.current = dayKey; prevCycle.current = sc.cycleRound;
      setScene({ kind: "boot", next: sc.day < duelDay ? { kind: "day", day: sc.day } : null });
      return;
    }
    if (prevKey.current === dayKey) return;
    prevKey.current = dayKey;
    // รอบใหม่: ฉากจบรอบ แล้วต่อด้วยวันที่ 1
    if (prevCycle.current !== sc.cycleRound) {
      prevCycle.current = sc.cycleRound;
      setScene((prev) => chain(prev, { kind: "cycleEnd", cycle: sc.cycleRound - 1, next: { kind: "day", day: sc.day } }));
      return;
    }
    if (sc.duelNight) { setScene((prev) => chain(prev, { kind: "day", day: sc.day, night: true })); return; }
    if (sc.day === duelDay) { setScene((prev) => chain(prev, { kind: "duelIntro" })); return; }
    // ประกาศคู่ดวล (จบวันที่ 5 -> เห็นตอนเข้าวันที่ 6)
    const pk = `${sc.cycleRound}`;
    if (sc.pairs?.length && seenPairing.current !== pk) {
      seenPairing.current = pk;
      setScene((prev) => chain(prev, { kind: "pairing", next: { kind: "day", day: sc.day, short: true } }));
      return;
    }
    setScene((prev) => chain(prev, { kind: "day", day: sc.day, short: sc.day !== 1 }));
  }, [dayKey]);

  // ---------- ถูกลบ: รายชื่อคนตกรอบเพิ่มขึ้น -> ฉากนี้แทรกหน้าคิว ----------
  const outKey = state.players.filter((p) => p.scEliminated).map((p) => p.id).sort().join(",");
  const prevOut = useRef(outKey);
  const lastPair = useRef(null);
  useEffect(() => { if (sc.duelPair) lastPair.current = sc.duelPair; }, [sc.duelPair?.a, sc.duelPair?.b]);
  useEffect(() => {
    if (outKey === prevOut.current) return;
    const before = prevOut.current.split(",").filter(Boolean);
    prevOut.current = outKey;
    const added = state.players.filter((p) => p.scEliminated && !before.includes(p.id));
    if (!added.length) return;
    const pr = lastPair.current, both = added.length > 1;
    const winnerOf = (loser) => {
      if (both || !pr) return null;
      const wid = pr.a === loser.id ? pr.b : pr.b === loser.id ? pr.a : null;
      return state.players.find((p) => p.id === wid) || null;
    };
    setScene((prev) => added.reduceRight((next, loser) => ({ kind: "deletion", loser, winner: winnerOf(loser), next }), prev));
  }, [outKey]);

  // ---------- ผู้รอดคนสุดท้าย ----------
  const shownFinal = useRef(false);
  useEffect(() => {
    if (state.gameState !== "GAMEOVER" || shownFinal.current) return;
    shownFinal.current = true;
    const left = state.players.filter((p) => !p.scEliminated && p.alive);
    const fin = { kind: "final", winner: left[0] || null };
    setScene((prev) => attachTail(prev, fin));
  }, [state.gameState]);

  // ปุ่มลัด C = หน้าต่างสถานะ (เฉพาะตอนเดินแมพ)
  useEffect(() => {
    const onKey = (e) => {
      if (!inWorld || place || scene || /^(INPUT|TEXTAREA)$/.test(e.target?.tagName || "")) return;
      if (e.key === "c" || e.key === "C") setStatusOpen((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [inWorld, place, scene]);

  const next = () => setScene((s) => s?.next || null);

  // ---------- ฉากซ้อนทับ ----------
  let overlay = null;
  if (scene) {
    const k = scene.kind;
    if (k === "boot") overlay = <SeraphBoot players={state.players} cycleRound={sc.cycleRound} onDone={next} />;
    else if (k === "day") overlay = <DayBanner key={`${scene.day}${scene.night}`} day={scene.day} duelDay={duelDay} pairingDay={sc.pairingDay} cycleRound={sc.cycleRound} short={scene.short} night={scene.night} onDone={next} />;
    else if (k === "cycleEnd") overlay = <CycleEndScene cycleRound={scene.cycle} matrixHeld={sc.matrixHeld} matrixMax={sc.matrixMax} onDone={next} />;
    else if (k === "pairing") overlay = <PairingScene pairs={sc.pairs} byes={sc.byes || []} players={state.players} myId={state.youId} onDone={next} />;
    else if (k === "duelIntro") {
      const pr = sc.duelPair;
      const a = pr && state.players.find((p) => p.id === pr.a), b = pr && state.players.find((p) => p.id === pr.b);
      overlay = <DuelIntro day={duelDay} onDone={() => setScene(a && b ? { kind: "reveal", queue: [a, b], all: [a, b] } : null)} />;
    } else if (k === "reveal") {
      const cur = scene.queue[0];
      overlay = (
        <CharacterReveal key={cur.id} player={state.players.find((p) => p.id === cur.id) || cur}
          onDone={() => { const rest = scene.queue.slice(1); setScene(rest.length ? { ...scene, queue: rest } : { kind: "faceoff", a: scene.all[0], b: scene.all[1] }); }} />
      );
    } else if (k === "faceoff") {
      const fresh = (p) => state.players.find((q) => q.id === p.id) || p;
      overlay = <FaceOffScene a={fresh(scene.a)} b={fresh(scene.b)} onDone={next} />;
    } else if (k === "deletion") overlay = <DeletionScene key={scene.loser.id} loser={scene.loser} winner={scene.winner} onDone={next} />;
    else if (k === "final") overlay = <FinalWinnerScene winner={scene.winner} board={sc.finalBoard || []} onDone={next} />;
  }

  // ---------- ฉากหลัก ----------
  let main;
  if (inWorld) {
    const canWalk = state.gameState === "SERAPH_PLACE" && !!me?.alive && !sc.eliminated;
    main = (
      <>
        <World sc={sc} players={state.players} youId={state.youId} active={canWalk && !scene} paused={!!place || statusOpen} onEnter={(key) => setPlace(key)} />
        <WorldHud sc={sc} me={me} onStatus={() => setStatusOpen(true)} onReady={() => { playSfx("sc_noti2"); setPlace(null); socket.emit("seraphReady"); }} />
        {place && (
          <PlaceScreen place={place} sc={sc} me={me} players={state.players} youId={state.youId} shop={state.shop || []} onLeave={() => setPlace(null)} />
        )}
        {statusOpen && <StatusWindow sc={sc} me={me} players={state.players} onClose={() => setStatusOpen(false)} />}
      </>
    );
  } else {
    // วันดวล: กระดานเดิม แต่ที่นั่งมีแค่คู่ที่ดวล (+ ตัวเรา ถ้าเราเป็นผู้ชม กระดานต้องมี "เรา" ถึงวาด HUD ได้)
    const inDuel = (p) => p.id === sc.duelPair?.a || p.id === sc.duelPair?.b;
    const boardState = { ...state, players: state.players.filter((p) => inDuel(p) || p.id === state.youId) };
    main = (
      <>
        {/* ห้ามใส่ z-index ที่ wrapper — จะขังคลิปคัตซีน/หน้าต่างยืนยันของกระดานไว้ใต้ชั้นของโหมด */}
        <div className="relative">
          <Game state={boardState} lowQ={lowQ} skillConfirmOn={skillConfirmOn} roster={roster} pairRole={pairRole} />
        </div>
        <DuelModels players={state.players} youId={state.youId} duelPair={sc.duelPair} attack={state.attack} night={!!sc.night} />
        <SpectatorRail players={state.players} duelPair={sc.duelPair} youId={state.youId} />
        {sc.spectating && sc.duelPair && (
          <div className="scw-spec">
            <span>ผู้ชม</span>
            <b>{(state.players.find((p) => p.id === sc.duelPair.a) || {}).name}</b>
            <em className="oc-latin">VS</em>
            <b>{(state.players.find((p) => p.id === sc.duelPair.b) || {}).name}</b>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      {main}
      {overlay}
      {sc.eliminated && !overlay && <div className="scw-out">ถูกลบแล้ว</div>}
    </>
  );
}

/** ต่อฉากใหม่ท้ายคิวเดิม (ฉากที่กำลังเล่นอยู่ไม่ถูกตัด) */
function chain(prev, scn) {
  if (!prev) return scn;
  return { ...prev, next: chain(prev.next || null, scn) };
}
/** ฉากจบเกมต้องเล่นหลังฉากถูกลบที่ตั้งไว้ในการส่ง state เดียวกัน */
function attachTail(prev, fin) {
  if (!prev) return fin;
  if (prev.kind === "deletion") return { ...prev, next: attachTail(prev.next || null, fin) };
  return fin;
}
