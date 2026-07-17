import Avatar from "../components/Avatar";
import Button from "../components/Button";
import { socket } from "../socket";
import { clickSound } from "../audio";

// หน้าที่ 5: ห้องรอ
export default function Lobby({ state, onBack, lowQ, onToggleLowQ }) {
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

      {/* โหมดประหยัด (patch 2.0.6): ข้ามวีดีโอท่าไม้ตาย/คัตซีน — เห็นแค่การแจ้งเตือนแทน
          แต่ยังต้องรอผู้เล่นอื่นที่เปิดวีดีโอดูให้จบอยู่ดี (จับเวลาที่ server) */}
      <button
        onClick={() => { clickSound(); onToggleLowQ && onToggleLowQ(); }}
        className={`rounded-2xl border-2 px-5 py-3 text-left max-w-md transition ${
          lowQ ? "border-echo-gold bg-echo-gold/15" : "border-white/20 bg-white/5 hover:bg-white/10"
        }`}
      >
        <div className="font-bold">
          🎬 โหมดประหยัด (ข้ามวีดีโอ): <span className={lowQ ? "text-echo-gold" : "opacity-70"}>{lowQ ? "เปิดอยู่" : "ปิดอยู่"}</span>
        </div>
        <div className="text-xs opacity-70 mt-1">
          ข้ามวีดีโอท่าไม้ตาย/ฉากคัตซีน — จะเห็นแค่การแจ้งเตือนว่าใครเปิดท่าไม้ตายแทน
          (แต่ยังต้องรอผู้เล่นคนอื่นดูวีดีโอให้จบอยู่ดี)
        </div>
      </button>

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
