import Avatar from "../components/Avatar";
import Button from "../components/Button";
import { socket } from "../socket";
import { clickSound } from "../audio";

// หน้าที่ 5: ห้องรอ
export default function Lobby({ state, onBack }) {
  const count = state.players.length;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center gap-5 p-6">
      <h1 className="text-4xl font-black tracking-wide">🕹️ ห้องรอ</h1>
      <p className="opacity-80">
        ผู้เล่นในห้อง: {count}/{state.maxPlayers} คน
      </p>

      <div className="flex flex-wrap justify-center gap-4 max-w-3xl">
        {state.players.map((p) => (
          <div
            key={p.id}
            style={{ borderColor: p.color }}
            className="bg-echo-navy/60 border-2 rounded-2xl p-4 min-w-[120px]"
          >
            <div className="relative inline-block">
              <Avatar img={p.img} index={p.avatar} size={64} />
              <span
                className="absolute -bottom-1 -right-1 text-[10px] font-bold px-1.5 rounded-full"
                style={{ background: p.color }}
              >
                P{p.position}
              </span>
            </div>
            <div className="font-bold mt-2">
              {p.name}
              {p.id === state.youId && <span className="text-echo-gold"> (คุณ)</span>}
            </div>
            <div className="text-xs opacity-70">{p.character.name}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-3 flex-wrap justify-center mt-2">
        <Button variant="ghost" onClick={() => { clickSound(); onBack && onBack(); }}>
          ← ย้อนกลับ
        </Button>
        <Button variant="ghost" onClick={() => socket.emit("startGame")}>
          เล่นคนเดียว (ทดสอบ)
        </Button>
        <Button disabled={count < 1} onClick={() => socket.emit("startGame")}>
          {count >= 2 ? `เริ่มเกม (${count} คน)` : "เริ่มเกม (รอเพื่อน)"}
        </Button>
      </div>
    </div>
  );
}
