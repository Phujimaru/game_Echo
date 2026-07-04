import { useEffect, useState } from "react";
import { socket } from "../socket";
import { clickSound } from "../audio";
import { POSITIONS, POSITION_COLORS } from "../data/positions";

// หน้าที่ 2: ตั้งชื่อ + เลือกตำแหน่ง P1-P6 (ดีไซน์ header ทแยง + ปุ่มสีเต็ม)
//  taken = ตำแหน่งที่คนอื่นจอง/เข้าเล่นแล้ว (server ส่งมาแบบไม่รวมของเราเอง)
export default function Setup({ taken, initialName = "", initialPos = null, onNext }) {
  const [name, setName] = useState(initialName);
  const [pos, setPos] = useState(initialPos);

  // ถ้าตำแหน่งที่เราเลือกไว้ โดนคนอื่นชิงไปก่อน -> ยกเลิกการเลือกของเรา
  useEffect(() => {
    if (pos && taken.includes(pos)) {
      setPos(null);
      alert("ตำแหน่งนี้เพิ่งถูกคนอื่นเลือกไป ลองเลือกใหม่นะ");
    }
  }, [taken, pos]);

  const pick = (n) => {
    clickSound();
    setPos(n);
    socket.emit("reserve", { position: n }); // จองตำแหน่งทันที ให้คนอื่นเห็นว่าไม่ว่าง
  };

  const submit = () => {
    clickSound();
    if (!name.trim()) return alert("กรุณาตั้งชื่อก่อนนะ");
    if (!pos) return alert("เลือกตำแหน่งผู้เล่นก่อนนะ");
    onNext(name.trim(), pos);
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* ---------- header ทแยง ---------- */}
      <div className="relative h-28 sm:h-32">
        <div
          className="absolute inset-x-0 top-0 h-28 sm:h-32"
          style={{ background: "#0b2d4a", clipPath: "polygon(0 0,100% 0,100% 86%,0 100%)" }}
        />
        <div
          className="absolute left-0 top-0 h-28 sm:h-32 w-[24rem] max-w-[70vw]"
          style={{ background: "linear-gradient(135deg,#9b4f96,#8a3e85)", clipPath: "polygon(0 0, 70% 0, 50% 100%, 0 100%)" }}
        />
        <h1 className="glitch absolute top-4 left-5 text-4xl sm:text-5xl font-black" data-text="ECHO">
          ECHO
        </h1>
        <h2 className="absolute top-8 sm:top-10 inset-x-0 text-center pl-40 pr-6 text-2xl sm:text-3xl font-bold text-white">
          เลือกลำดับผู้เล่น และตั้งชื่อ
        </h2>
      </div>

      {/* ---------- เนื้อหา ---------- */}
      <div className="relative flex flex-col items-center gap-7 px-6 pt-10">
        <div className="text-center">
          <div className="text-2xl font-bold mb-3">ชื่อผู้เล่น</div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={12}
            placeholder="กรอกชื่อ"
            className="bg-white text-xl text-gray-900 placeholder-gray-400 rounded-full px-6 py-3 w-80 max-w-[85vw] outline-none focus:ring-4 ring-echo-purple/60 shadow-lg"
          />
        </div>

        <div className="flex flex-wrap justify-center gap-4 sm:gap-6">
          {POSITIONS.map((n) => {
            const selected = pos === n;
            const lockedByOther = taken.includes(n) && !selected; // คนอื่นจองไว้
            return (
              <div key={n} className="flex flex-col items-center gap-2">
                <button
                  disabled={lockedByOther}
                  onClick={() => pick(n)}
                  style={{ background: POSITION_COLORS[n] }}
                  className={`w-20 h-20 sm:w-24 sm:h-24 rounded-2xl text-3xl sm:text-4xl font-black text-white shadow-lg transition ${
                    lockedByOther ? "opacity-25 grayscale cursor-not-allowed" : "hover:scale-105"
                  } ${selected ? "ring-4 ring-white scale-105" : ""}`}
                >
                  P{n}
                </button>
                <span
                  className={`font-semibold text-sm ${
                    selected ? "text-echo-gold" : lockedByOther ? "text-white/50" : "text-white"
                  }`}
                >
                  {selected ? "เลือกแล้ว" : lockedByOther ? "ถูกจอง" : "ว่าง"}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ---------- ปุ่มยืนยัน มุมขวาล่าง (โผล่เมื่อกรอกชื่อ + เลือกตำแหน่งครบ) ---------- */}
      {name.trim() && pos && (
        <button onClick={submit} className="absolute bottom-0 right-0 w-56 h-28 group">
          <div
            className="absolute inset-0 transition group-hover:brightness-110"
            style={{ background: "linear-gradient(135deg,#9b4f96,#8a3e85)", clipPath: "polygon(100% 0,100% 100%,0 100%)" }}
          />
          <span className="absolute bottom-5 right-6 text-2xl font-bold text-white">ยืนยัน →</span>
        </button>
      )}
    </div>
  );
}
