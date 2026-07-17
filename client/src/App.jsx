import { useEffect, useRef, useState } from "react";
import { socket } from "./socket";
import { playMusic, playSfx, stopMusic, resetMusicPositions } from "./audio";
import Splash from "./screens/Splash";
import Setup from "./screens/Setup";
import CharacterSelect from "./screens/CharacterSelect";
import Lobby from "./screens/Lobby";
import Game from "./screens/Game";
import VolumeControl from "./components/VolumeControl";

export default function App() {
  const [stage, setStage] = useState("splash"); // splash | setup | character | connected
  const [state, setState] = useState(null);
  const [roster, setRoster] = useState([]);
  const [taken, setTaken] = useState([]);
  const [name, setName] = useState("");
  const [position, setPosition] = useState(null);
  // โหมดประหยัด (patch 2.0.6): ข้ามวีดีโอท่าไม้ตาย/คัตซีน — เห็นแค่แจ้งเตือน แต่ยังต้องรอผู้เล่นอื่นดูจบ
  const [lowQ, setLowQ] = useState(() => {
    try { return localStorage.getItem("echo_lowq") === "1"; } catch { return false; }
  });
  const toggleLowQ = () => {
    setLowQ((v) => {
      const next = !v;
      try { localStorage.setItem("echo_lowq", next ? "1" : "0"); } catch {}
      return next;
    });
  };

  useEffect(() => {
    const onState = (s) => setState(s);
    const onRoster = (r) => setRoster(r);
    const onPositions = (t) => setTaken(t);
    const onJoined = () => setStage("connected");
    const onFull = () => alert("ขออภัย ห้องเต็มแล้ว (สูงสุด 6 คน)");
    const onInProgress = () => alert("เกมกำลังเล่นอยู่ รอรอบใหม่ก่อนนะ");
    const onPosTaken = () => {
      alert("ตำแหน่งนี้ถูกจองแล้ว เลือกใหม่นะ");
      setStage("setup");
    };

    socket.on("state", onState);
    socket.on("roster", onRoster);
    socket.on("positions", onPositions);
    socket.on("joined", onJoined);
    socket.on("full", onFull);
    socket.on("inProgress", onInProgress);
    socket.on("positionTaken", onPosTaken);
    return () => {
      socket.off("state", onState);
      socket.off("roster", onRoster);
      socket.off("positions", onPositions);
      socket.off("joined", onJoined);
      socket.off("full", onFull);
      socket.off("inProgress", onInProgress);
      socket.off("positionTaken", onPosTaken);
    };
  }, []);

  // ---------- เพลงพื้นหลัง + เสียงเปลี่ยนเทิร์น ----------
  const prevPhase = useRef(null);
  const prevInMatch = useRef(false);
  const prevCycle = useRef(null); // ช่วงเวลาเดิม (day/night) — เปลี่ยนเมื่อไหร่ เพลงประจำช่วงต้องเริ่มใหม่จากต้น
  const cycleSeq = useRef(0);     // seq เพลงกลางวัน/กลางคืน: +1 ทุกครั้งที่สลับช่วงเวลา -> เริ่มเพลงใหม่
  const phase = stage === "connected" && state ? state.gameState : null;
  const cycle = stage === "connected" && state ? state.cycle : null;
  const skillMusic = stage === "connected" && state ? state.skillMusic : null;
  const skillMusicSeq = stage === "connected" && state ? state.skillMusicSeq : 0;
  useEffect(() => {
    // CUTSCENE: หยุดเพลงพื้นหลัง ปล่อยให้เสียงในวีดีโอเล่น (เพลงสกิลมาหลังวีดีโอ)
    // ร่างแปลง (Ginga/Unicorn): เพลงสกิลทับ | ช่วงต่อสู้: เพลงกลางวัน/กลางคืน | อื่นๆ: main_home
    const battle = phase === "PLAYING" || phase === "SUMMARY" || phase === "ATTACK" || phase === "ATTACKING" || phase === "TRANSITION";
    const inMatch = battle || phase === "CUTSCENE";

    // ขอบเขตแมตช์: เริ่มเกมใหม่ / จบเกม -> รีเซ็ตตำแหน่งเพลงทั้งหมด เริ่มเพลงใหม่จากต้น
    // (การเล่นต่อจากจุดเดิมนับเฉพาะภายในแมตช์เดียวกันเท่านั้น)
    if (inMatch !== prevInMatch.current) resetMusicPositions();
    prevInMatch.current = inMatch;

    // เพลงกลางวัน/กลางคืน (patch พิเศษ): กลางวัน = new_morning | กลางคืน = new_night
    //  สลับช่วงเวลาเมื่อไหร่ seq ขยับ -> กลับมาช่วงเดิมอีกครั้งเพลงจะเริ่มใหม่จากต้น (ไม่เล่นต่อจากจุดเดิม)
    if (inMatch && cycle && prevCycle.current !== cycle) {
      if (prevCycle.current) cycleSeq.current++;
      prevCycle.current = cycle;
    }
    if (!inMatch) prevCycle.current = null;

    // โหมดประหยัด (patch 2.0.6): ข้ามวีดีโอคัตซีน — ระหว่างรอคนอื่นดูวีดีโอ เพลงเล่นต่อตามปกติ
    if (phase === "CUTSCENE" && !lowQ) stopMusic();
    else if (skillMusic) playMusic(skillMusic, skillMusicSeq); // seq เปลี่ยน = การเปิดร่างใหม่ -> เริ่มเพลงใหม่
    else if (battle || phase === "CUTSCENE") playMusic(cycle === "night" ? "new_night" : "new_morning", cycleSeq.current);
    else playMusic("main_home");

    // เปลี่ยนจาก "เลือกการ์ด" ไปสรุปผล -> เสียง trun_change (ยกเว้นเข้า cutscene)
    if (prevPhase.current === "PLAYING" && phase && phase !== "PLAYING" && phase !== "CUTSCENE") {
      playSfx("trun_change");
    }
    // เข้าเฟสโจมตี -> เสียง attack
    if (prevPhase.current !== "ATTACKING" && phase === "ATTACKING") playSfx("attack");
    prevPhase.current = phase;
  }, [stage, phase, cycle, skillMusic, skillMusicSeq, lowQ]);

  const goCharacter = (n, pos) => {
    setName(n);
    setPosition(pos);
    setStage("character");
  };
  // extra: ตัวเลือกเพิ่มเติมตอนเลือกตัว (เช่น ชิกิ: shikiUlt = "deatheye" | "wither")
  const confirmCharacter = (characterId, extra) =>
    socket.emit("join", { name, position, characterId, ...(extra || {}) });

  let screen;
  if (stage === "splash") screen = <Splash onEnter={() => setStage("setup")} />;
  else if (stage === "setup")
    screen = <Setup taken={taken} initialName={name} initialPos={position} onNext={goCharacter} />;
  else if (stage === "character")
    screen = (
      <CharacterSelect
        roster={roster}
        position={position}
        name={name}
        onConfirm={confirmCharacter}
        onBack={() => setStage("setup")}
      />
    );
  else if (!state)
    screen = <div className="min-h-screen grid place-items-center text-lg opacity-70">กำลังเชื่อมต่อ...</div>;
  else if (state.gameState === "LOBBY")
    screen = <Lobby state={state} lowQ={lowQ} onToggleLowQ={toggleLowQ} onBack={() => { socket.emit("leave"); setStage("character"); }} />;
  else screen = <Game state={state} lowQ={lowQ} />;

  return (
    <>
      <VolumeControl />
      {screen}
    </>
  );
}
