import { useState } from "react";
import { clickSound } from "../audio";
import { FALLBACK } from "../data/avatars";
import { POSITION_COLORS } from "../data/positions";

const PURPLE = "linear-gradient(135deg,#9b4f96,#7d3a78)";

// รูปตัวละคร (เต็มกรอบ) — ใช้ img ถ้ามี ไม่งั้นอีโมจิสำรอง
function CharImage({ c, className, emojiSize = "3.5rem", rounded = "" }) {
  const [broken, setBroken] = useState(false);
  return (
    <div className={`relative overflow-hidden ${rounded} ${className}`} style={{ background: PURPLE }}>
      {c.img && !broken ? (
        <img
          src={c.img}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          onError={() => setBroken(true)}
        />
      ) : (
        <span className="absolute inset-0 grid place-items-center" style={{ fontSize: emojiSize }}>
          {FALLBACK[c.avatar] || "🙂"}
        </span>
      )}
    </div>
  );
}

// ช่องสกิล 1 อัน — แสดงข้อมูลเต็ม (ชื่อ + คำอธิบาย + แต้มที่ใช้)
// คำอธิบายยาวเกินเพดาน (max-h) จะเลื่อนขึ้นลงดูในช่องตัวเองได้ ไม่ดันช่องอื่นจนอัดกัน
function SkillTile({ label, skill }) {
  return (
    <div style={{ background: PURPLE }} className="rounded-2xl px-4 py-3 shadow-lg text-white text-left flex flex-col min-h-0">
      <div className="flex items-center justify-between gap-2 shrink-0">
        <span className="text-base sm:text-lg font-bold">{label}</span>
        <span className="text-xs bg-black/30 rounded-full px-2 py-0.5 shrink-0">
          {skill && skill.cost != null ? `แต้มสกิลที่ใช้ ${skill.cost} แต้ม` : "ไม่เสีย"}
        </span>
      </div>
      {skill ? (
        <>
          <div className="font-bold text-echo-gold mt-1 shrink-0">{skill.name}</div>
          <div className="text-sm text-white/90 mt-0.5 leading-snug flex-1 min-h-0 max-h-36 overflow-y-auto pr-1">{skill.desc}</div>
        </>
      ) : (
        <div className="text-sm text-white/60 mt-1">—</div>
      )}
    </div>
  );
}

export default function CharacterSelect({ roster, position, name, onConfirm, onBack }) {
  const [picked, setPicked] = useState(null);
  const color = POSITION_COLORS[position] || "#9B4F96";
  const sel = roster.find((c) => c.id === picked);

  const pick = (id) => { clickSound(); setPicked(id); };
  const confirm = () => { clickSound(); if (picked) onConfirm(picked); };
  const back = () => { clickSound(); onBack(); };
  const reselect = () => { clickSound(); setPicked(null); };

  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden">
      {/* ---------- header ทแยง ---------- */}
      <div className="relative h-28 sm:h-32 shrink-0">
        <div
          className="absolute inset-x-0 top-0 h-28 sm:h-32"
          style={{ background: "#0b2d4a", clipPath: "polygon(0 0,100% 0,100% 86%,0 100%)" }}
        />
        <div
          className="absolute left-0 top-0 h-28 sm:h-32 w-[22rem] max-w-[62vw]"
          style={{ background: "linear-gradient(135deg,#9b4f96,#8a3e85)", clipPath: "polygon(0 0, 66% 0, 46% 100%, 0 100%)" }}
        />
        <div className="relative flex items-center px-5 gap-4 h-24 sm:h-28">
          <h1 className="glitch text-4xl sm:text-5xl font-black shrink-0" data-text="ECHO">ECHO</h1>
          <h2 className="flex-1 text-center text-2xl sm:text-3xl font-bold text-white">เลือกตัวละคร</h2>
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-white font-bold text-lg sm:text-xl max-w-[9rem] truncate">
              {name || "ชื่อผู้เล่น"}
            </span>
            <span
              className="w-14 h-14 grid place-items-center rounded-2xl text-white text-2xl font-black shadow-lg"
              style={{ background: color }}
            >
              P{position}
            </span>
          </div>
        </div>
      </div>

      {roster.length === 0 ? (
        <div className="flex-1 grid place-items-center opacity-70">กำลังโหลดตัวละคร...</div>
      ) : !sel ? (
        /* ================= โหมดกริด (ยังไม่เลือก) ================= */
        <>
          <div className="flex-1 flex flex-col items-center justify-center p-6 gap-4 min-w-0 w-full">
            <p className="opacity-70">แตะเลือกตัวละครเพื่อดูรายละเอียด</p>
            {/* 2 แถวคงที่ ตัวละครใหม่เพิ่มทางขวา -> เลื่อนแนวนอนดูได้ */}
            <div className="w-full overflow-x-auto">
              <div className="grid grid-rows-2 grid-flow-col auto-cols-max gap-4 sm:gap-6 mx-auto px-1 pb-2">
                {roster.map((c) =>
                  c.locked ? (
                    <div key={c.id} className="cursor-not-allowed" title="ยังไม่ปลดล็อก">
                      <div className="relative w-32 h-32 sm:w-40 sm:h-40">
                        <CharImage c={c} className="w-full h-full grayscale opacity-50" rounded="rounded-2xl shadow-lg" emojiSize="4rem" />
                        <div className="absolute inset-0 grid place-items-center text-5xl">🔒</div>
                      </div>
                      <div className="mt-1.5 font-bold text-sm text-white/50">{c.name}</div>
                    </div>
                  ) : (
                    <button key={c.id} onClick={() => pick(c.id)} className="transition hover:scale-105" title={c.name}>
                      <CharImage c={c} className="w-32 h-32 sm:w-40 sm:h-40" rounded="rounded-2xl shadow-lg" emojiSize="4rem" />
                      <div className="mt-1.5 font-bold text-sm">{c.name}</div>
                    </button>
                  )
                )}
                {/* การ์ด "เร็วๆนี้" */}
                <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-2xl grid place-items-center bg-gray-200 text-gray-700 shadow-lg">
                  <div className="text-6xl">👤</div>
                  <div className="font-bold -mt-1">เร็วๆนี้</div>
                </div>
              </div>
            </div>
          </div>
          <button
            onClick={back}
            className="absolute bottom-5 left-5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 px-5 py-2.5 font-bold"
          >
            ← ย้อนกลับ
          </button>
        </>
      ) : (
        /* ================= โหมดรายละเอียด (เลือกแล้ว) ================= */
        <>
          <div className="flex-1 flex flex-col lg:flex-row items-center lg:items-start gap-4 p-4 sm:p-6 overflow-y-auto pb-32 lg:pb-6">
            {/* คอลัมน์ตัวละครให้สลับ (แนวนอนบนมือถือ / แนวตั้งบนจอกว้าง)
                จอกว้าง: ล็อกความสูงแล้วเลื่อนขึ้นลงดูตัวอื่นได้ — ไม่ wrap เป็นหลายคอลัมน์จนดันจอกว้าง */}
            <div className="flex flex-row lg:flex-col flex-wrap lg:flex-nowrap justify-center lg:justify-start gap-3 shrink-0 p-1 lg:max-h-[70vh] lg:overflow-y-auto">
              {roster.map((c) => (
                <button
                  key={c.id}
                  onClick={() => !c.locked && pick(c.id)}
                  disabled={c.locked}
                  style={{ outline: c.id === picked ? `3px solid ${color}` : "none" }}
                  className={`relative rounded-xl transition shrink-0 ${c.locked ? "cursor-not-allowed" : "hover:scale-105"}`}
                  title={c.locked ? "ยังไม่ปลดล็อก" : c.name}
                >
                  <CharImage
                    c={c}
                    className={`w-16 h-16 sm:w-20 sm:h-20 ${c.locked ? "grayscale opacity-50" : ""}`}
                    rounded="rounded-xl"
                    emojiSize="2rem"
                  />
                  {c.locked && <span className="absolute inset-0 grid place-items-center text-2xl">🔒</span>}
                </button>
              ))}
            </div>

            {/* รูปตัวใหญ่ */}
            <CharImage
              c={sel}
              className="w-40 h-52 sm:w-56 sm:h-72 shrink-0 -rotate-2 shadow-2xl"
              rounded="rounded-2xl"
              emojiSize="5rem"
            />

            {/* แผงสกิล */}
            <div className="w-full lg:flex-1 lg:self-stretch lg:max-h-[70vh] bg-echo-navy/85 rounded-3xl p-4 sm:p-5 flex flex-col gap-3">
              <div
                className="rounded-xl bg-white/5 border-2 px-4 py-2 text-2xl sm:text-3xl font-bold text-white text-center"
                style={{ borderColor: color }}
              >
                {sel.name}
              </div>
              {/* auto-rows-fr = ทุกช่องสูงเท่ากัน ช่องที่คำอธิบายยาวจะเลื่อนดูในตัวเอง */}
              <div className="grid grid-cols-2 auto-rows-fr gap-3 flex-1 min-h-0">
                <SkillTile label="สกิลติดตัว" skill={sel.passive} />
                <SkillTile label={sel.basicNight ? "สกิลพื้นฐาน (กลางวัน)" : "สกิลพื้นฐาน"} skill={sel.basic} />
                {sel.basicNight && <SkillTile label="สกิลพื้นฐาน (กลางคืน)" skill={sel.basicNight} />}
                {/* โอเบรอน/โคโตเนะ: สกิลสลับตามช่วงเวลากลางวัน/กลางคืน — โชว์ครบทุกท่า */}
                <SkillTile label={sel.secondaryNight ? "สกิลรอง (กลางวัน)" : "สกิลรอง"} skill={sel.secondary} />
                {sel.secondaryNight && <SkillTile label="สกิลรอง (กลางคืน)" skill={sel.secondaryNight} />}
                <SkillTile label={sel.ultimateNight ? "ท่าไม้ตาย (กลางวัน)" : "ท่าไม้ตาย"} skill={sel.ultimate} />
                {sel.ultimateNight && <SkillTile label="ท่าไม้ตาย (กลางคืน)" skill={sel.ultimateNight} />}
              </div>
            </div>
          </div>

          <button
            onClick={reselect}
            className="absolute bottom-5 left-5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 px-5 py-2.5 font-bold"
          >
            ← เลือกใหม่
          </button>

          <button onClick={confirm} className="absolute bottom-0 right-0 w-56 h-28 group">
            <div
              className="absolute inset-0 transition group-hover:brightness-110"
              style={{ background: "linear-gradient(135deg,#9b4f96,#8a3e85)", clipPath: "polygon(100% 0,100% 100%,0 100%)" }}
            />
            <span className="absolute bottom-5 right-6 text-2xl font-bold text-white">ยืนยัน →</span>
          </button>
        </>
      )}
    </div>
  );
}
