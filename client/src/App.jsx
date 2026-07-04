import { useEffect, useRef, useState } from "react";
import { socket } from "./socket";
import { playMusic, playSfx, stopMusic } from "./audio";
import Splash from "./screens/Splash";
import Setup from "./screens/Setup";
import CharacterSelect from "./screens/CharacterSelect";
import Lobby from "./screens/Lobby";
import Game from "./screens/Game";

export default function App() {
  const [stage, setStage] = useState("splash"); // splash | setup | character | connected
  const [state, setState] = useState(null);
  const [roster, setRoster] = useState([]);
  const [taken, setTaken] = useState([]);
  const [name, setName] = useState("");
  const [position, setPosition] = useState(null);

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
  const phase = stage === "connected" && state ? state.gameState : null;
  const ginga = stage === "connected" && state ? state.gingaActive : false;
  useEffect(() => {
    // CUTSCENE: หยุดเพลงพื้นหลัง ปล่อยให้เสียงในวีดีโอเล่น (เพลง Ginga มาหลังวีดีโอ)
    // ร่าง Ginga: เพลงสกิลทับ | ช่วงต่อสู้: card_prepare_turn | อื่นๆ: main_home
    const battle = phase === "PLAYING" || phase === "SUMMARY" || phase === "ATTACK" || phase === "TRANSITION";
    if (phase === "CUTSCENE") stopMusic();
    else if (ginga) playMusic("ginga");
    else playMusic(battle ? "card_prepare_turn" : "main_home");

    // เปลี่ยนจาก "เลือกการ์ด" ไปสรุปผล -> เสียง trun_change (ยกเว้นเข้า cutscene)
    if (prevPhase.current === "PLAYING" && phase && phase !== "PLAYING" && phase !== "CUTSCENE") {
      playSfx("trun_change");
    }
    prevPhase.current = phase;
  }, [stage, phase, ginga]);

  const goCharacter = (n, pos) => {
    setName(n);
    setPosition(pos);
    setStage("character");
  };
  const confirmCharacter = (characterId) =>
    socket.emit("join", { name, position, characterId });

  if (stage === "splash") return <Splash onEnter={() => setStage("setup")} />;
  if (stage === "setup")
    return <Setup taken={taken} initialName={name} initialPos={position} onNext={goCharacter} />;
  if (stage === "character")
    return (
      <CharacterSelect
        roster={roster}
        position={position}
        name={name}
        onConfirm={confirmCharacter}
        onBack={() => setStage("setup")}
      />
    );

  // connected
  if (!state)
    return (
      <div className="min-h-screen grid place-items-center text-lg opacity-70">
        กำลังเชื่อมต่อ...
      </div>
    );
  if (state.gameState === "LOBBY")
    return <Lobby state={state} onBack={() => { socket.emit("leave"); setStage("character"); }} />;
  return <Game state={state} />;
}
