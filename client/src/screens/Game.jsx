import { useEffect, useRef, useState } from "react";
import Card from "../components/Card";
import Button from "../components/Button";
import { socket } from "../socket";
import { clickSound, playSfx, videoVolume, onVolumeChange } from "../audio";

// ขนาดจอ (อัปเดตเมื่อหมุน/ย่อขยาย) — ใช้ย่อทั้งกระดานให้พอดีจอ รองรับมือถือแนวตั้ง
function useViewport() {
  const [vp, setVp] = useState(() => ({
    w: typeof window !== "undefined" ? window.innerWidth : 1280,
    h: typeof window !== "undefined" ? window.innerHeight : 720,
  }));
  useEffect(() => {
    const onResize = () => {
      const vv = window.visualViewport;
      setVp({ w: vv ? vv.width : window.innerWidth, h: vv ? vv.height : window.innerHeight });
    };
    onResize();
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    if (window.visualViewport) window.visualViewport.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
      if (window.visualViewport) window.visualViewport.removeEventListener("resize", onResize);
    };
  }, []);
  return vp;
}

// ---------- cutscene แปลงร่าง (วีดีโอเต็มจอ ครั้งแรกต่อเกมเท่านั้น) ----------
function Cutscene({ cs }) {
  const ref = useRef(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.volume = videoVolume(); // ผ่าน master volume curve เดียวกับเสียงอื่น
    v.currentTime = 0;
    v.play().catch(() => { v.muted = true; v.play().catch(() => {}); }); // กัน autoplay block
    // เลื่อนหลอดเสียงระหว่างวีดีโอ -> อัปเดตทันที
    return onVolumeChange(() => { if (ref.current) ref.current.volume = videoVolume(); });
  }, [cs.id]); // remount ต่อ cutscene -> เล่นวีดีโอใหม่เสมอ (กันจอดำตอนท่าเดียวกันต่อกัน)

  return (
    <div className="fixed inset-0 z-50 bg-black overflow-hidden">
      <video ref={ref} src={cs.video} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 bg-white cut-flash pointer-events-none" />
      <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(circle, transparent 45%, rgba(0,0,0,0.75) 100%)" }} />
      <div className="absolute top-[8%] inset-x-0 text-center px-4">
        <div className="cut-title glitch text-4xl sm:text-6xl font-black" data-text={cs.title}>{cs.title}</div>
      </div>
      <div className="absolute bottom-[9%] inset-x-0 flex flex-col items-center gap-3">
        <div className="flex items-center gap-3">
          <div className="cut-portrait cut-glow rounded-2xl overflow-hidden w-28 h-28 sm:w-36 sm:h-36 border-4" style={{ borderColor: cs.color, "--cut-color": cs.color }}>
            <img src={cs.img} alt="" className="w-full h-full object-cover" />
          </div>
          {/* ภาพที่สอง (เช่น แม้แต่พระเจ้าก็จะฆ่าให้ดู — ภาพสกิลท่าไม้ตาย + ภาพเจ้าของท่าที่โดน) */}
          {cs.img2 && (
            <div className="cut-portrait cut-glow rounded-2xl overflow-hidden w-28 h-28 sm:w-36 sm:h-36 border-4" style={{ borderColor: cs.color, "--cut-color": cs.color }}>
              <img src={cs.img2} alt="" className="w-full h-full object-cover" />
            </div>
          )}
        </div>
        <div className="text-2xl sm:text-3xl font-black drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
          <span style={{ color: cs.color }}>{cs.name}</span> {cs.label || "ปล่อยท่าไม้ตาย"}!
        </div>
      </div>
    </div>
  );
}

// ---------- อนิเมชันบอกว่าใครตีใคร + สกิลที่มีผลกับการโจมตีครั้งนี้ ----------
//  แถวสกิลข้างใต้บอกว่า "ทำไมความเสียหายถึงเป็นเท่านี้ / ทำไมป้องกันได้"
function AttackFx({ a }) {
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/55">
      <div className="flex flex-col items-center gap-3 pop-in text-hard px-3">
        <div className="flex items-center gap-4 sm:gap-8">
          <div className="flex flex-col items-center gap-1">
            <div className="rounded-2xl overflow-hidden w-24 h-24 sm:w-28 sm:h-28 border-4 -rotate-3" style={{ borderColor: a.byColor }}>
              <img src={a.byImg} alt="" className="w-full h-full object-cover" />
            </div>
            <span className="font-bold text-base sm:text-lg" style={{ color: a.byColor }}>{a.byName}</span>
          </div>
          <div className="text-center">
            <div className="text-4xl sm:text-5xl">{a.dodge ? "💨" : a.kill ? "💀" : "⚔️"}</div>
            {a.dodge ? (
              <div className="text-3xl sm:text-4xl font-black text-echo-cyan drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]">หลบพ้น!</div>
            ) : a.kill ? (
              <div className="text-3xl sm:text-4xl font-black text-echo-hp drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]">สังหาร!</div>
            ) : (
              <div className="text-4xl sm:text-5xl font-black text-echo-hp drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]">-{a.dmg}</div>
            )}
            {a.revenge && <div className="text-xs text-echo-gold font-bold">NT-D แก้แค้น!</div>}
            {a.aoe && <div className="text-xs">ตีหมู่!</div>}
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className="shake rounded-2xl overflow-hidden w-24 h-24 sm:w-28 sm:h-28 border-4 rotate-3" style={{ borderColor: a.targetColor }}>
              <img src={a.targetImg} alt="" className="w-full h-full object-cover" />
            </div>
            <span className="font-bold text-base sm:text-lg" style={{ color: a.targetColor }}>{a.targetName}</span>
          </div>
        </div>
        {a.skills && a.skills.length > 0 && (() => {
          // แยกฝั่งชัดเจน: ซ้าย = สกิลฝั่งโจมตี | ขวา = สกิลฝั่งป้องกัน (ไม่ปนกันตรงกลาง)
          const atk = a.skills.filter((s) => (s.side ? s.side === "atk" : s.by === a.byName));
          const def = a.skills.filter((s) => (s.side ? s.side === "def" : s.by !== a.byName));
          const SkillCard = ({ s }) => (
            <div className="flex items-center gap-2 bg-black/70 rounded-xl px-2.5 py-1.5 border border-white/15 w-full max-w-[15rem]">
              {s.img ? (
                <img src={s.img} alt="" className="w-14 h-10 object-cover rounded-lg shrink-0" />
              ) : (
                <span className="w-10 h-10 grid place-items-center text-xl shrink-0">✦</span>
              )}
              <div className="text-left leading-tight min-w-0">
                <div className="text-sm sm:text-base font-bold text-echo-gold">{s.name}</div>
                <div className="text-xs sm:text-sm font-bold truncate" style={{ color: s.color }}>{s.by}</div>
              </div>
            </div>
          );
          const both = atk.length > 0 && def.length > 0;
          return (
            <div className="grid grid-cols-2 gap-x-4 w-full max-w-2xl items-start">
              <div className={`flex flex-col items-center gap-1.5 ${both ? "border-r-2 border-white/25 pr-4" : ""}`}>
                {atk.length > 0 && (
                  <div className="text-sm sm:text-base font-black bg-black/60 rounded-full px-4 py-0.5 border" style={{ color: a.byColor, borderColor: a.byColor }}>
                    ⚔️ ฝั่งโจมตี
                  </div>
                )}
                {atk.map((s, i) => <SkillCard key={i} s={s} />)}
              </div>
              <div className="flex flex-col items-center gap-1.5 pl-1">
                {def.length > 0 && (
                  <div className="text-sm sm:text-base font-black bg-black/60 rounded-full px-4 py-0.5 border" style={{ color: a.targetColor, borderColor: a.targetColor }}>
                    🛡️ ฝั่งป้องกัน
                  </div>
                )}
                {def.map((s, i) => <SkillCard key={i} s={s} />)}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

// ---------- ประกาศเปลี่ยนร่าง (บนกระดานเกม หลังวีดีโอจบ) ----------
//  วีดีโอจบ -> กลับมากระดาน -> เอฟเฟกต์ระเบิด + เสียงพากย์เล่นให้จบ (ไม่มีเพลงแทรก) แล้วค่อยไปต่อ
//  แดง = สวมเกราะราชัน | เขียว = Beat Mode
function TransformAnnounce({ cs }) {
  useEffect(() => {
    if (cs.voice) playSfx(cs.voice); // เสียงแปลงร่าง เล่นต่อจากวีดีโอบนกระดาน
  }, [cs.id]);
  const red = cs.kind === "rachan";
  return (
    <div className="fixed inset-0 z-50 grid place-items-center pointer-events-none overflow-hidden">
      <div className={`absolute inset-0 ${red ? "xfx-flash-red" : "xfx-flash-green"}`} />
      <div className={`xfx-burst ${red ? "xfx-burst-red" : "xfx-burst-green"}`} />
      <div className="relative flex flex-col items-center gap-3 pop-in text-hard px-4 text-center">
        <div className={`rounded-2xl overflow-hidden w-28 h-28 sm:w-36 sm:h-36 border-4 ${red ? "aura-rachan" : "aura-beat"}`} style={{ borderColor: cs.color }}>
          <img src={cs.img} alt="" className="w-full h-full object-cover" />
        </div>
        <div className="text-3xl sm:text-5xl font-black" style={{ color: red ? "#ff5747" : "#4ade80" }}>
          <span style={{ color: cs.color }}>{cs.name}</span> เปลี่ยนร่าง!
        </div>
        <div className="text-xl sm:text-2xl font-bold bg-black/55 rounded-full px-5 py-1">{cs.title}</div>
      </div>
    </div>
  );
}

// ---------- สกิลช่วงจั่วการ์ด: เด้งขึ้นทันทีบนกระดาน (ไม่ตัดเข้าจอดำ) ----------
function SkillFlash({ f }) {
  return (
    <div className="absolute top-[32%] left-1/2 -translate-x-1/2 z-40 pointer-events-none">
      <div className="pop-in flex items-center gap-3 bg-black/75 rounded-2xl px-4 py-2 border-2 text-hard" style={{ borderColor: f.color }}>
        {f.img ? (
          <img src={f.img} alt="" className="w-16 h-11 object-cover rounded-lg" />
        ) : (
          <span className="text-2xl">✦</span>
        )}
        <div className="text-left leading-tight">
          <div className="text-lg font-black text-echo-gold">{f.name}</div>
          <div className="text-sm font-bold" style={{ color: f.color }}>{f.by} ใช้สกิล</div>
        </div>
      </div>
    </div>
  );
}

// ---------- โหมดประหยัด (patch 2.0.6): ข้ามวีดีโอคัตซีน — แจ้งเตือนแทน แต่ยังรอเวลาเท่าวีดีโอจริง ----------
//  ผู้เล่นที่เปิดโหมดนี้จะเห็นแค่ว่าใครเปิดท่าไม้ตาย/สกิลอะไร พร้อมนับถอยหลังรอคนอื่นดูวีดีโอจบ
function CutsceneSkipNotice({ cs, timeLeft }) {
  return (
    <div className="fixed top-[32%] left-1/2 -translate-x-1/2 z-40 pointer-events-none px-3 max-w-full">
      <div className="pop-in flex items-center gap-3 bg-black/85 rounded-2xl px-4 py-2.5 border-2 text-hard" style={{ borderColor: cs.color }}>
        {cs.img ? (
          <img src={cs.img} alt="" className="w-16 h-16 object-cover rounded-xl border-2 shrink-0" style={{ borderColor: cs.color }} />
        ) : (
          <span className="text-2xl">✦</span>
        )}
        <div className="text-left leading-tight">
          <div className="text-lg font-black" style={{ color: cs.color }}>{cs.name} {cs.label || "ปล่อยท่าไม้ตาย"}!</div>
          <div className="text-sm font-bold text-echo-gold">{cs.title}</div>
          <div className="text-xs opacity-80 mt-0.5">🎬 โหมดประหยัด — รอผู้เล่นอื่นดูวีดีโอให้จบ ({timeLeft} วิ)</div>
        </div>
      </div>
    </div>
  );
}

// ---------- แจ้งเตือนแปลงร่างซ้ำ (ครั้งที่ 2 เป็นต้นไป): การ์ดเล็กๆ ไม่หยุดเกม ----------
function TransformNotice({ n }) {
  return (
    <div className="fixed top-[32%] left-1/2 -translate-x-1/2 z-40 pointer-events-none">
      <div className="pop-in flex items-center gap-3 bg-black/75 rounded-2xl px-4 py-2 border-2 text-hard" style={{ borderColor: n.color }}>
        {n.img ? (
          <img src={n.img} alt="" className="w-16 h-16 object-cover rounded-xl border-2 shrink-0" style={{ borderColor: n.color }} />
        ) : (
          <span className="text-2xl">✦</span>
        )}
        <div className="text-left leading-tight">
          <div className="text-lg font-black" style={{ color: n.color }}>{n.name}</div>
          <div className="text-sm font-bold text-echo-gold">{n.title} {n.label}!</div>
        </div>
      </div>
    </div>
  );
}

// ---------- ฉากหลังกลางวัน/กลางคืน (patch 1.7) ----------
//  กลางวัน = background_morning.jpg | กลางคืน = background_night.jpg
//  เปลี่ยนช่วงเวลาแบบ crossfade ช้าๆ (ไม่ตัดปุ๊บปั๊บ) — ซ้อนทั้ง 2 ภาพแล้วเฟดสลับกัน
//  ระหว่าง Lie Like Vortigern (โอเบรอน) ฉากหลังกลางคืนกลายเป็นวีดีโอ oberon_background.mp4 (เฟดเข้า)
function GameBackground({ cycle, oberonBg, godtreeBg, shradeBg, bardBg, shikiBg }) {
  const night = cycle === "night";
  return (
    <div className="absolute inset-0 -z-10 pointer-events-none overflow-hidden">
      <img
        src="/image/background_morning.jpg"
        alt=""
        className="absolute inset-0 w-full h-full object-cover transition-opacity duration-[3000ms] ease-in-out"
        style={{ opacity: night ? 0 : 1 }}
      />
      <img
        src="/image/background_night.jpg"
        alt=""
        className="absolute inset-0 w-full h-full object-cover transition-opacity duration-[3000ms] ease-in-out"
        style={{ opacity: night ? 1 : 0 }}
      />
      {/* ราตรีของชเรด เอลัน (ร่างสปาด้า): ทุกค่ำคืน ฉากหลังกลายเป็น change_fill.jpg */}
      {shradeBg && (
        <img
          src="/characters/shrade_elan/change_fill.jpg"
          alt=""
          className="absolute inset-0 w-full h-full object-cover bg-fade-in"
        />
      )}
      {/* มิติมายาบรรเลง (Bard): โลหิต = ตอนเช้า / วิญญาณ = ตอนกลางคืน (ทับฉากหลังอื่นทั้งหมด) */}
      {bardBg && (
        <img
          src={bardBg === "blood" ? "/characters/bard/bard_bg_blood.png" : "/characters/bard/bard_bg_soul.png"}
          alt=""
          className="absolute inset-0 w-full h-full object-cover bg-fade-in"
        />
      )}
      {night && oberonBg && (
        <video
          src="/characters/oberon/oberon_background.mp4"
          autoPlay loop muted playsInline
          className="absolute inset-0 w-full h-full object-cover bg-fade-in"
        />
      )}
      {godtreeBg && (
        <img
          src="/characters/auqarion/backgroud_skillgod.jpg"
          alt=""
          className="absolute inset-0 w-full h-full object-cover bg-fade-in"
        />
      )}
      {/* ฉันมองเห็นมันแล้ว (ชิกิ): ซ้อน shiki_fill.png ทับฉากหลังปัจจุบันระหว่างท่าไม้ตายทำงาน */}
      {shikiBg === "eye" && (
        <img
          src="/characters/shiki/shiki_fill.png"
          alt=""
          className="absolute inset-0 w-full h-full object-cover bg-fade-in"
        />
      )}
      {/* ความตายที่โรยรา (ชิกิ patch 2.0.6): ฉากหลังกลายเป็นวีดีโอ shiki_fill2.mp4 ระหว่างท่าไม้ตาย 2 ทำงาน */}
      {shikiBg === "wither" && (
        <video
          src="/characters/shiki/shiki_fill2.mp4"
          autoPlay loop muted playsInline
          className="absolute inset-0 w-full h-full object-cover bg-fade-in"
        />
      )}
      <div className="absolute inset-0 bg-black/25" />
    </div>
  );
}

// ---------- แบนเนอร์สลับช่วงเวลา (กลางวัน <-> กลางคืน ทุก 3 เทิร์น) ----------
//  c.oberon = "ราตรีกลืนกิน": โอเบรอนใช้ท่าไม้ตาย 2 — ฉากหลังวีดีโอ + เพลงประจำตัว จนกว่าจะหมดกลางคืน
function CycleBanner({ c }) {
  const night = c.cycle === "night";
  return (
    <div className="fixed top-[28%] left-1/2 -translate-x-1/2 z-40 pointer-events-none">
      <div className="pop-in flex items-center gap-3 bg-black/80 rounded-2xl px-6 py-3 border-2 text-hard" style={{ borderColor: night ? "#818cf8" : "#e5b33b" }}>
        <span className="text-4xl">{night ? (c.oberon ? "🌑" : "🌙") : "☀️"}</span>
        <div className="text-left leading-tight">
          <div className="text-xl font-black" style={{ color: night ? "#a5b4fc" : "#e5b33b" }}>
            {night ? (c.oberon ? "ราตรีกลืนกิน" : "ราตรีมาเยือน") : "รุ่งอรุณมาถึง"}
          </div>
          <div className="text-sm font-bold opacity-90">
            {night ? (c.oberon ? "ราชาแห่งการหลอกลวงครอบงำราตรี — จนกว่าฟ้าจะสาง" : "เกราะฟื้นทุกเทิร์น") : "จบเทิร์นได้แต้มสกิลเพิ่ม +1"}
          </div>
        </div>
      </div>
    </div>
  );
}

// ชื่อเฟส (โชว์อนิเมชันตอนเปลี่ยนเฟส)
const PHASE_NAMES = { PLAYING: "🎴 สุ่มการ์ด", ATTACK: "⚔️ โจมตี" };

// สถานะที่ผูกกับท่าไม้ตายของแต่ละตัวละคร — ใช้เช็คว่ากำลังมีผลอยู่ไหม (กดซ้ำไม่ได้จนกว่าจะหมดเวลา)
const ULTIMATE_STATUS = { hikaru: "gingastrium", kuwagata: "rachan", banagher: "paradise", temari: "anata", fujimaru: "humanity", gambler: "golden", eva13: "fourth", appleguy: "chill", kotone: "kawaii", shiki: "deatheye" };

// ---------- Apple guy: ของส่งมอบ 3 ชิ้น (สกิลพื้นฐาน เอาแบบนี้ได้ไหม เลือก -> สกิลรอง เอาไปสิ ส่งให้เป้าหมาย) ----------
const APPLE_ITEMS = [
  { key: "drink", name: "เครื่องดื่มชูกำลัง", img: "/characters/appleguy/appleguy_skill1.1.jpg", desc: "ผู้รับได้แต้มสกิล +1 แต่เสียพลัง 1 หน่วยต่อเทิร์น (ความเสียหายธรรมดา โดนเกราะก่อน) คงอยู่ 2 เทิร์น (ค่าเริ่มต้น)" },
  { key: "iphone", name: "ไอโฟนเครื่องใหม่", img: "/characters/appleguy/appleguy_skill1.2.png", desc: "ผู้รับฟื้นเกราะ 2 หน่วย แต่เสียพลังชีวิต 1 หน่วยแบบไม่สนเกราะ" },
  { key: "promo", name: "ใบโปรโมทสินค้า", img: "/characters/appleguy/appleguy_skill1.3.jpg", desc: "แต้มการ์ดของผู้รับถูกเปิดเผยให้ทุกคนเห็น คงอยู่ 1 เทิร์น" },
];
const APPLE_ITEM_NAME = Object.fromEntries(APPLE_ITEMS.map((it) => [it.key, it.name]));

// ตำแหน่งผู้เล่นคนอื่น (นอกจากตัวเรา) รอบโต๊ะ — [top%, left%] จัดตามจำนวน ไม่เรียงแถว
const SLOTS = {
  0: [],
  1: [[8, 50]],
  2: [[9, 22], [9, 78]],
  3: [[9, 17], [6, 50], [9, 83]],
  4: [[9, 18], [9, 82], [44, 11], [44, 89]],
  5: [[9, 17], [6, 50], [9, 83], [50, 11], [50, 89]],
};

// เอฟเฟครอบการ์ด: Beat Mode = สายฟ้าเขียว (ถาวร) / สวมเกราะราชัน = โกลว์แดง
function auraClass(p) {
  if (p.beat) return "aura-beat";
  if (p.rachan) return "aura-rachan";
  return "";
}

// รูปตัวละคร (เต็มกรอบ + fallback)
function Portrait({ p, className, rounded = "rounded-2xl" }) {
  const [broken, setBroken] = useState(false);
  return (
    <div className={`relative overflow-hidden ${rounded} ${auraClass(p)} ${className}`} style={{ background: "linear-gradient(135deg,#9b4f96,#7d3a78)" }}>
      {p.img && !broken ? (
        <img src={p.img} alt="" className="absolute inset-0 w-full h-full object-cover" onError={() => setBroken(true)} />
      ) : (
        <span className="absolute inset-0 grid place-items-center text-3xl">🙂</span>
      )}
    </div>
  );
}

function Shield({ on, size = 16 }) {
  return (
    <svg width={size} height={Math.round(size * 1.125)} viewBox="0 0 24 24" className="shrink-0">
      <path d="M12 2 L21 6 V12 C21 17 12 22 12 22 C12 22 3 17 3 12 V6 Z"
        fill={on ? "#3b82c4" : "transparent"} stroke="#3b82c4" strokeWidth="2" />
    </svg>
  );
}

// ---------- แถวเลือด + เกราะ (ใช้ร่วมกันทุกจุด) ----------
//  บังคับอยู่บรรทัดเดียวแนวนอนเสมอ ไม่หักขึ้นบรรทัดใหม่ตามความยาว — sm = ขนาดเล็ก (การ์ดคู่ต่อสู้มือถือ)
function LifeBar({ p, sm, className = "" }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap shrink-0 ${className}`}>
      <span className={`${sm ? "text-sm" : "text-lg"} leading-none whitespace-nowrap`}>
        {Array.from({ length: p.maxHp }, (_, i) => (i < p.hp ? "❤️" : "🖤")).join("")}
      </span>
      {p.tempHp > 0 && <span className={`${sm ? "text-xs" : "text-sm"} text-echo-gold font-bold`}>💛{p.tempHp}</span>}
      <span className="inline-flex gap-0.5 shrink-0">
        {Array.from({ length: p.maxArmor }, (_, i) => <Shield key={i} on={i < p.armor} size={sm ? 12 : 16} />)}
      </span>
      {p.shield > 0 && <span className={`${sm ? "text-xs" : "text-sm"} text-echo-cyan font-bold`}>+🛡️{p.shield}</span>}
    </span>
  );
}

// แถวพลังชีวิต + หลอดสกิล
function Stats({ p, center }) {
  return (
    <div className={center ? "flex flex-col items-center gap-1" : ""}>
      <LifeBar p={p} />
      {p.skillPoints < 0 ? (
        // ซาโตรุ (patch 2.0.8.2): แต้มสกิลถูกซ่อนจากผู้เล่นอื่น
        <div className="mt-1 text-xs font-black text-echo-gold opacity-90" title="แต้มสกิลถูกซ่อน (สกิลติดตัวซาโตรุ)">🌩️ ???</div>
      ) : (
        <div className="flex gap-0.5 mt-1">
          {Array.from({ length: p.maxSkill }, (_, i) => (
            <span key={i} className={`w-3.5 h-3.5 rounded-[3px] ${i < p.skillPoints ? "bg-echo-gold" : "bg-white/15 border border-white/20"}`} />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- สถานะผิดปกติ (patch 1.7.1): ตารางกลาง ไอคอน + ชื่อ + สี + คำอธิบาย ----------
//  ใช้ทั้งป้ายเล็กบนการ์ดผู้เล่น และหน้าต่างรายละเอียด — ทุกคนเห็นสถานะของกันและกันได้
//  (แตะ/คลิกการ์ดผู้เล่นตอนที่ไม่ได้เลือกเป้าโจมตี เพื่อเปิดดูคำอธิบายเต็ม)
const STATUS_INFO = {
  upg:       { icon: "🎴", label: "UPG", cls: "bg-echo-cyan text-gray-900", desc: "เทิร์นนี้ไพ่ไม่มีทางแตก แต่แต้มไม่เกินเพดานของสกิล" },
  monster:   { icon: "🛡️", label: "MonsterLive", cls: "bg-echo-armor", desc: "MonsterLive: เพดานเกราะ +2 — เกราะลดลงเท่าไหร่ฟื้นเลือดเท่านั้น และความเสียหายที่ได้รับจากการโจมตีลดลง 1 หน่วย (ใช้สกิลรอง Ultlive Ultraman Ginga ไม่ได้)" },
  ginga:     { icon: "✨", label: "Ginga", cls: "bg-echo-gold text-gray-900", desc: "ร่าง Ultraman Ginga: โจมตี +1 และตีหมู่ทุกคน (เหลือคู่ต่อสู้คนเดียว +1 เพิ่ม) — ระหว่างนี้สกิลพื้นฐานเปลี่ยนเป็น UPG!" },
  gingastrium: { icon: "🔥", label: "Ginga Strium", cls: "bg-echo-hp", desc: "ร่าง Ginga Strium: โจมตี +1 (เหลือคู่ต่อสู้คนเดียว +1 เพิ่ม) ติดลุกไหม้ให้เป้าหมายที่โดนโจมตี — ระหว่างนี้สกิลรองเปลี่ยนเป็นลำแสงสโตเรียม" },
  hburn:     { icon: "🔥", label: "ลุกไหม้", cls: "bg-echo-hp", desc: "ลุกไหม้: เสียพลังชีวิต 1 หน่วยทุกเทิร์น (ลดเกราะก่อน ลดลงทีละหน่วยหลังสร้างความเสียหาย) สะสมได้ไม่เกิน 6 หน่วย" },
  storium:   { icon: "🌟", label: "สโตเรียม", cls: "bg-echo-magenta", desc: "ลำแสงสโตเรียม: การโจมตีครั้งถัดไปกลายเป็นตีหมู่ — เป้าหมายที่เลือกรับดาเมจปกติ(สูงสุด 4)+ลุกไหม้ที่เหลือ ผู้เล่นอื่นรับดาเมจเท่าลุกไหม้ของตัวเอง" },
  absorb:    { icon: "🛡️", label: "Absorb", cls: "bg-echo-armor", desc: "เกราะที่เสียในเทิร์นนี้แปลงกลับเป็นพลังชีวิต" },
  beam:      { icon: "🔫", label: "Beam", cls: "bg-echo-magenta", desc: "Beam Magnum: การโจมตีเทิร์นนี้ +2 หน่วย" },
  paradise:  { icon: "🦄", label: "Paradise", cls: "bg-echo-gold text-gray-900", desc: "NewType Paradise: โจมตีด้วยพลัง NT-D (+1) ได้ทุกเป้าหมาย" },
  ntd:       { icon: "⚡", label: "NT-D", cls: "bg-echo-hp", desc: "NT-D System: การโจมตีสวนกลับคนที่ตีเราล่าสุด +1 หน่วย" },
  ohger:     { icon: "👑", label: "Ohger", cls: "bg-echo-gold text-gray-900", desc: "Ohger Finish: การโจมตีเทิร์นนี้ +1 หน่วย" },
  rachan:    { icon: "🛡️", label: "ราชัน", cls: "bg-echo-armor", desc: "สวมเกราะราชัน: เพดานเกราะ +3 ถาวร" },
  song:      { icon: "🎵", label: "Song", cls: "bg-echo-magenta", desc: "Song for you: พลังขิงตามชามที่ใช้ (1 ชาม = +1) — มีผลเฉพาะสกิลติดตัวโดนขิง (ขิงแบบไม่สนเกราะ)" },
  anata:     { icon: "🎤", label: "ANATA", cls: "bg-echo-gold text-gray-900", desc: "ANATA WAAAAAAAA: เป้าหมายลับจะถูกบังคับจั่ว 2 ใบหลังเปิดไพ่" },
  mage:      { icon: "🪄", label: "จอมเวทย์", cls: "bg-echo-cyan text-gray-900", desc: "จอมเวทย์ฝึกหัด: ความเสียหายจากการแพ้/แตกเทิร์นนี้ +1 ต่อสแตค (ฟื้นเลือดคืนเทิร์นหน้า)" },
  humanity:  { icon: "✨", label: "EFH", cls: "bg-echo-gold text-gray-900", desc: "Everything For Humanity: โจมตี +4 เกราะ +3 และกันดาเมจแพ้/แตก — ผลจบแล้วตัวละครตาย" },
  seal:      { icon: "📜", label: "อมตะ", cls: "bg-echo-hp", desc: "เรจูอาคมบัญชา: เทิร์นนี้ไม่ถูกเลือกโจมตี และไม่รับความเสียหายใดๆ" },
  nodraw:    { icon: "🚫", label: "ห้ามจั่ว", cls: "bg-echo-hp", desc: "จั่วการ์ดเพิ่มไม่ได้ในเทิร์นนี้" },
  noskill:   { icon: "🚫", label: "ห้ามสกิล", cls: "bg-echo-hp", desc: "โดนหอกลองกินัสปัก: ใช้สกิลไม่ได้ในเทิร์นนี้" },
  golden:    { icon: "🎰", label: "777", cls: "bg-echo-gold text-gray-900", desc: "เวลาทอง: โชคด้านบวก +10% คอสสกิลพื้นฐาน/รองลดครึ่ง กดสกิลพื้นฐานซ้ำได้" },
  spear:     { icon: "🗡️", label: "หอกลองกินัส", cls: "bg-echo-magenta", desc: "หอกลองกินัส: โจมตี +1 และมีโอกาสทำให้เป้าหมายใช้สกิลไม่ได้เทิร์นถัดไป" },
  fourth:    { icon: "☄️", label: "Impact", cls: "bg-echo-hp", desc: "Fourth Impact: กันดาเมจแพ้/แตก — ถูกกำจัดระหว่างนี้จะระเบิดทุกคน 5 หน่วย" },
  lai:       { icon: "🌞", label: "Goodfellow", cls: "bg-echo-gold text-gray-900", desc: "Lai Rhyme Goodfellow กำลังทำงาน" },
  vortigern: { icon: "🌑", label: "Vortigern", cls: "bg-echo-hp", desc: "Lie Like Vortigern: ราตรีกลืนกินครอบงำสนามจนกว่าฟ้าจะสาง" },
  veil:      { icon: "🌙", label: "ม่านราตรี", cls: "bg-echo-magenta", desc: "ม่านแห่งราตรี: พลังโจมตี +1 หน่วย" },
  dawn:      { icon: "🌅", label: "ฟ้าสาง", cls: "bg-echo-gold text-gray-900", desc: "ยามฟ้าสาง: สะสมถาวร (สูงสุด 3) — Lie Like Vortigern จะกล่อมหลับตามจำนวนสแตค" },
  awaken:    { icon: "⏰", label: "ตื่นขึ้น", cls: "bg-echo-cyan text-gray-900", desc: "การตื่นขึ้น: ฟื้นพลังชีวิตเทิร์นละ 1 — ถ้าติดคู่ยามฟ้าสาง ดาเมจแพ้/แตก +1 (เสียการตื่นขึ้น 1 เมื่อเกิดผล)" },
  sleep:     { icon: "💤", label: "หลับไหล", cls: "bg-echo-hp", desc: "หลับไหล: ออกการกระทำใดๆ ไม่ได้ และเสียเลือด 1/เทิร์นไม่สนเกราะ (ไม่ถึงตาย — ค้างที่ 1)" },
  nightmare: { icon: "🌘", label: "ฝันร้าย", cls: "bg-echo-magenta", desc: "ฝันร้ายยามค่ำคืน: หลังเปิดไพ่ เป้าหมายที่เลือกรับความเสียหาย 1 หน่วย — หากกำลังหลับไหล เพิ่มอีก 2 หน่วย" },
  vortarmor: { icon: "🛡️", label: "เกราะราตรี", cls: "bg-echo-armor", desc: "Lie Like Vortigern: เพดานเกราะ +1 ชั่วคราว" },
  // ---------- Apple guy (patch 1.8) ----------
  energy:    { icon: "🥤", label: "ชูกำลัง", cls: "bg-echo-cyan text-gray-900", desc: "เครื่องดื่มชูกำลัง: ได้แต้มสกิล +1 แต่เสียพลัง 1 หน่วยต่อเทิร์นแบบความเสียหายธรรมดา (โดนเกราะก่อน ไม่ถึงตาย — ค้างที่ 1)" },
  promo:     { icon: "📢", label: "เปิดแต้ม", cls: "bg-echo-gold text-gray-900", desc: "แต้มการ์ดถูกเปิดเผยให้ทุกคนเห็นตลอดเทิร์นนี้ (ใบโปรโมทสินค้า / แสงจันทร์ส่องวิญญาณ)" },
  chill:     { icon: "🏖️", label: "ชิวๆ", cls: "bg-echo-cyan text-gray-900", desc: "ชิวๆครับน้องๆ: จบเทิร์นได้แต้มสกิล +1 และมีโอกาสหลบการถูกเลือกโจมตี — คงอยู่จนกว่าจะถูกโจมตี" },
  // ---------- เจ้าแห่งเน็ตบ้าน (patch 1.9) ----------
  fiber:     { icon: "📡", label: "เน็ตแรง", cls: "bg-echo-cyan text-gray-900", desc: "เสือนอนกิน: เทิร์นนี้จั่วการ์ดไม่มีทางแตก แต่แต้มจะไม่เกิน 19" },
  tiger:     { icon: "🐯", label: "เสือนอนกิน", cls: "bg-echo-gold text-gray-900", desc: "เสือนอนกิน: พลังโจมตี +1 (และฟื้นพลังชีวิต 1 หน่วยในเทิร์นถัดไป)" },
  unplug:    { icon: "🔌", label: "สายหลุด", cls: "bg-echo-hp", desc: "กระชากสายแลน: บัฟหายไปชั่วคราวตลอดเทิร์นนี้ (กลับคืนในเทิร์นถัดไป)" },
  nohealing: { icon: "🚱", label: "ไม่ใช้งานต่อ", cls: "bg-echo-hp", desc: "ปฏิเสธการต่อสัญญา: ฟื้นเลือดตัวเองไม่ได้ 1 เทิร์น" },
  // ---------- ฟุจิตะ โคโตเนะ (patch 1.9.1 / rework 2.1.3) ----------
  overwork:  { icon: "🥵", label: "โหมงานหนัก", cls: "bg-echo-hp", desc: "โหมงานหนัก: ใช้แต้มสกิลเพิ่มขึ้น 1 สุ่มสตั้น 10% ทุกเทิร์น เกราะ/โล่พังทั้งหมดและฟื้นไม่ได้ พลังโจมตีช่วงเช้าเหลือ 0 — คงอยู่ 3 เทิร์น และลบล้างได้ด้วย Sleeping time (สกิลรอง 2) เท่านั้น" },
  fresh:     { icon: "🌅", label: "เช้าที่สดใส", cls: "bg-echo-gold text-gray-900", desc: "เช้าที่สดใส: ได้แต้มสกิล +1 และโล่ +1 ทุกเทิร์น ตามจำนวนเทิร์นที่เหลือ" },
  ksleep:    { icon: "😴", label: "หลับพักผ่อน", cls: "bg-echo-cyan text-gray-900", desc: "Sleeping time: หลับ 2 เทิร์นตายตัว — ตื่นแล้วจะได้รับ [เช้าที่สดใส] (เทิร์นแรกของการหลับ ศัตรูเลือกโจมตีไม่ได้)" },
  kpierce:   { icon: "💃", label: "เจาะเกราะ", cls: "bg-echo-magenta", desc: "สกิลรอง: การโจมตีครั้งถัดไปเจาะเกราะเพิ่ม +1 (ทะลุเกราะเข้าเลือดจริง) — ใช้แล้วหมดไป" },
  sena:      { icon: "😱", label: "หนีเซนะ", cls: "bg-echo-hp", desc: "เจอท่านประธานเซนะจัง — มัวแต่หลบหนีจนทำอะไรไม่ได้เลยทั้งเทิร์นนี้" },
  kstun:     { icon: "😵", label: "สตั้น", cls: "bg-echo-hp", desc: "หมดแรงจาก [โหมงานหนัก] — เทิร์นนี้ขยับไม่ได้" },
  kawaii:    { icon: "💖", label: "Kawaii", cls: "bg-echo-magenta", desc: "Sekai ichi kawaii watashi: หลังเปิดไพ่จะโจมตีเป้าหมายที่เลือกไว้ 3 หน่วยและสตั้น 3 เทิร์น" },
  // ---------- ชเรด เอลัน (patch พิเศษ) ----------
  melody:    { icon: "🎵", label: "ท่วงทำนอง", cls: "bg-echo-cyan text-gray-900", desc: "ท่วงทำนอง: สะสมจากสกิล เชิญรับฟัง (สูงสุด 5) — ครบ 5 ตอนกลางคืนจะใช้ท่าไม้ตาย รวมร่างทำนองเพลง ได้" },
  shradecharge: { icon: "🎻", label: "บทเพลงสุดท้าย", cls: "bg-echo-hp", desc: "แด่เพื่อนรักของฉัน: กำลังบรรเลงบทเพลงสุดท้าย — จั่ว/ใช้สกิลไม่ได้ ครบกำหนดจะระเบิดใส่ทุกคน 8 หน่วย แล้วชเรดจบชีวิตลง" },
  moonmark:  { icon: "🌕", label: "จันทร์ส่อง", cls: "bg-echo-magenta", desc: "แสงจันทร์ส่องวิญญาณ (สปาด้า): หากไพ่แตกในเทิร์นนี้ จะรับความเสียหาย 1 หน่วยทันที" },
  // ---------- สถานะพื้นฐาน universal (patch 2.0.8) ----------
  freecast:  { icon: "🎁", label: "พรแห่งการจั่ว", cls: "bg-echo-gold text-gray-900", desc: "พรแห่งการจั่ว: ใช้สกิลครั้งถัดไปไม่เสียแต้มสกิล (คงอยู่จนกว่าจะได้ใช้)" },
  stun:      { icon: "😵", label: "สตั้น", cls: "bg-echo-hp", desc: "สตั้น: ไม่สามารถทำอะไรได้จนจบเทิร์นหรือจนกว่าดีบัฟจะหมดเวลา" },
  weak:      { icon: "🥀", label: "อ่อนแอ", cls: "bg-echo-hp", desc: "อ่อนแอ: ดาเมจที่ทำได้ลดลงตามจำนวนที่ระบุ ตามจำนวนเทิร์นที่เหลือ" },
  fragile:   { icon: "💔", label: "เปราะบาง", cls: "bg-echo-hp", desc: "เปราะบาง: ดาเมจที่ได้รับเพิ่มขึ้นตามจำนวนที่ระบุ ตามจำนวนเทิร์นที่เหลือ" },
  might:     { icon: "💪", label: "เสริมพลัง", cls: "bg-echo-gold text-gray-900", desc: "เสริมพลัง: ดาเมจที่ทำได้เพิ่มขึ้นตามจำนวนที่ระบุ ตามจำนวนเทิร์นที่เหลือ" },
  spellflow: { icon: "🌀", label: "กระแสเวท", cls: "bg-echo-cyan text-gray-900", desc: "กระแสเวท: การใช้สกิลทุกชนิดใช้พลังงานลดลงตามจำนวนที่ระบุ ตามจำนวนเทิร์นที่เหลือ" },
  spellburden: { icon: "⛓️", label: "ภาระเวท", cls: "bg-echo-hp", desc: "ภาระเวท: การใช้สกิลทุกชนิดใช้พลังงานเพิ่มขึ้นตามจำนวนที่ระบุ (ไม่เกิน 8) ตามจำนวนเทิร์นที่เหลือ" },
  // ---------- Bard : คีตกวี (patch 2.2) ----------
  resist:    { icon: "🛡️", label: "ต้านผิดปกติ", cls: "bg-echo-gold text-gray-900", desc: "ต้านสถานะผิดปกติ: ล้างและต้านทานดีบัฟพื้นฐาน (ขัดแย้ง/หลับไหล/สตั้น/ห้ามจั่ว/ห้ามใช้สกิล/พิษ/อ่อนแอ/เปราะบาง/ภาระเวท) ตามจำนวนเทิร์นที่เหลือ — ดีบัฟที่ยังไม่เกิดผลทันที (ยามฟ้าสาง/เส้นชีวิต) ถูกล้างจะลดลงทีละ 1 หน่วย" },
  guard:     { icon: "💗", label: "คุ้มครอง", cls: "bg-echo-armor", desc: "คุ้มครอง: ความเสียหายจากการถูกโจมตีลดลงตามจำนวนที่ระบุ (ไม่ระบุ = 1) ตามจำนวนเทิร์นที่เหลือ" },
  fortune:   { icon: "🍀", label: "โชคลาภ", cls: "bg-echo-gold text-gray-900", desc: "โชคลาภ: การจั่วไพ่ครั้งถัดไปจะได้ไพ่ใบที่ดีที่สุดที่ไม่ทำให้แตก (ซ้อนทับได้สูงสุด 3 — หมดไปทีละ 1 ต่อการจั่ว — ไม่ได้ใช้ 3 เทิร์นติดกันจะหมดฤทธิ์เอง)" },
  empower:   { icon: "💪", label: "เสริมพลัง", cls: "bg-echo-gold text-gray-900", desc: "Rejuvenation: การโจมตีครั้งถัดไป +1 ดาเมจ (ไม่ซ้อนทับ — หมดเมื่อได้โจมตี)" },
  linked:    { icon: "🔗", label: "เชื่อมผล", cls: "bg-echo-magenta", desc: "เชื่อมผล: HP โดนดาเมจ, เกราะโดนดาเมจ, ฟื้นฟู HP และฟื้นฟูเกราะ ถูกแชร์ให้คู่เชื่อมเท่ากัน 1:1 (ฝ่ายหนึ่งเสีย/ได้ อีกฝ่ายเสีย/ได้ตาม) ตามจำนวนเทิร์นที่เหลือ" },
  discord:   { icon: "⚡", label: "ขัดแย้ง", cls: "bg-echo-hp", desc: "Discord: ความเสียหายที่ได้รับจากการถูกโจมตี +1 หน่วย ตามจำนวนเทิร์นที่เหลือ" },
  evade:     { icon: "💨", label: "หลบหลีก", cls: "bg-echo-cyan text-gray-900", desc: "หลบหลีก: หลบการโดนโจมตีตาม % ที่ระบุ (ไม่ระบุ = 100%) — ซ้อนทับได้สูงสุด 3 หมดไปทีละ 1 เมื่อถูกเลือกโจมตี — ไม่ได้ใช้ 3 เทิร์นติดกันจะหมดฤทธิ์เอง" },
  bloodDim:  { icon: "❤️", label: "มิติโลหิต", cls: "bg-echo-hp", desc: "มิติมายาบรรเลงโลหิต (นับเป็นตอนเช้า): กดโน้ตได้สูงสุด 6 ครั้งต่อเทิร์น — ตอนเปิดมิติ คีตกวีได้ต้านสถานะผิดปกติ 3 เทิร์น หลบหลีก 1 โชคลาภ 1 และผู้เล่นทุกคน (ยกเว้นคีตกวี) ติดเปราะบาง +1 ดาเมจที่ได้รับ 3 เทิร์น" },
  soulDim:   { icon: "💚", label: "มิติวิญญาณ", cls: "bg-echo-magenta", desc: "มิติมายาบรรเลงวิญญาณ (นับเป็นตอนกลางคืน): กดโน้ตได้สูงสุด 6 ครั้งต่อเทิร์น — ตอนเปิดมิติ คีตกวีได้ต้านสถานะผิดปกติ 3 เทิร์น หลบหลีก 1 โชคลาภ 1 และทุกการบรรเลงทำนอง ทำความเสียหาย 1 หน่วยแบบสุ่มกับผู้เล่น 2 คน จนกว่ามิติจะสิ้นสุด (เป้าหมายไม่สามารถถูกฆ่าได้จากเอฟเฟกต์นี้)" },
  // ---------- เรียวกิ ชิกิ (patch 2.0.6) ----------
  knife:     { icon: "🔪", label: "มีดพก", cls: "bg-echo-cyan text-gray-900", desc: "มีดพก: การโจมตีปกติฟื้นพลังชีวิตให้ตัวเอง 3 หน่วย ตามจำนวนเทิร์นที่เหลือ" },
  deathline: { icon: "🩸", label: "เส้นชีวิต", cls: "bg-echo-hp", desc: "เส้นชีวิต (เนตรมารแห่งความมรณะ): สะสมจากการเปิดไพ่แต้มเท่ากับชิกิ / สกิลรอง / ท่าไม้ตาย 2 — โหมดท่า 1: ครบ 6 แล้วถูกชิกิโจมตีปกติระหว่างท่าไม้ตาย = ถูกสังหารทันที (ถูกโจมตีก่อนครบ = รีเซ็ตทั้งหมด) / โหมดท่า 2 (patch 2.0.8): สะสมได้สูงสุด 5 — ระหว่างความตายที่โรยรา เส้นชีวิตแปรเป็นดาเมจเสริมการโจมตีปกติของชิกิ +1 ต่อเส้น (พลังโจมตีรวมสูงสุด 5) และมีโอกาสถูกสังหารทันที 1% คงที่" },
  deatheye:  { icon: "👁️", label: "เนตรมาร", cls: "bg-echo-hp", desc: "ฉันมองเห็นมันแล้ว: โจมตีปกติใส่ผู้เล่นที่มีเส้นชีวิตครบ 6 = สังหารทันที (บังคับตาย) — จัดการได้ 1 คน ท่าไม้ตายปิดลงทันที" },
  wither:    { icon: "🥀", label: "โรยรา", cls: "bg-echo-hp", desc: "ความตายที่โรยรา (rework patch 2.0.8): ทุกเทิร์นมอบเส้นชีวิต +1 ให้ผู้เล่นทุกคน (ยกเว้นชิกิ) — ท่าไม้ตายแจกได้สูงสุด 3 หน่วยต่อคน (รวมแหล่งปกติสูงสุด 5) — โจมตีปกติ: เส้นชีวิตแปรเป็นดาเมจเสริม +1 ต่อเส้น (พลังโจมตีรวมสูงสุด 5 ต่อครั้ง) และมีโอกาสสังหารทันที 1% คงที่ เพิ่มไม่ได้ — เมื่อท่าจบลง (สังหารสำเร็จ/หมดเวลา) เส้นชีวิตส่วนที่ท่าแจกไปถูกลบออกจากทุกคน" },
  godslay:   { icon: "👁️", label: "ยกเลิกอัลติ", cls: "bg-echo-gold text-gray-900", desc: "นายมีฝีมือแค่ไหนหรอ?: ชิกิพร้อมยกเลิกท่าไม้ตายของผู้เล่นอื่น 1 คน 1 ครั้ง (2 เทิร์น — ผลยังอยู่กดสกิลซ้ำไม่ได้) — ผู้เล่นอื่นคนแรกที่กดท่าไม้ตายระหว่างนี้จะถูกยกเลิกทันที (แต้มสกิลเสียฟรี) และหากเจ้าของท่าไม้ตายที่มีผลอยู่ก่อนแล้วมาโจมตีชิกิ จะถูกยกเลิกท่าแบบย้อนหลังทันที" },
  // ---------- โอกูริ แคป (patch 2.0.8.1) ----------
  graybeast: { icon: "🐴", label: "GrayBeast", cls: "bg-echo-gold text-gray-900", desc: "ร่าง Zone: ได้รับ Stamina +1 และแต้มสกิล +1 ทุกเทิร์น — หายไปเมื่อไม่มียุคทองเหลืออยู่ หรือเข้าร่างหมดแรง" },
  burnout: { icon: "💦", label: "หมดแรง", cls: "bg-echo-hp", desc: "Burnout: Stamina หมดและไม่มียุคทอง — ใช้สกิลใดๆ ไม่ได้ยกเว้น A Big Meal จนกว่า Stamina จะกลับมามากกว่า 0" },
  goldenera: { icon: "🏇", label: "ยุคทอง", cls: "bg-echo-gold text-gray-900", desc: "ยุคทอง: พลังโจมตีพื้นฐาน +1 ทุกๆ 2 แต้มที่ติดอยู่บนตัว และเพดานเกราะ +1 — สะสมสูงสุด 2 แต้ม อยู่ 6 เทิร์น (รีเฟรชเมื่อได้แต้มใหม่) ทุกแต้มลดโอกาสฝึกฝนสำเร็จ 10% — หายทั้งหมดเมื่อฝึกฝนล้มเหลว · ครบ 2 แต้มตอนเริ่มเทิร์นจะเข้าสู่ร่าง Zone (ยุคทองหมด = ออกจากร่าง Zone)" },
  grit: { icon: "😤", label: "เวลากัดฟันทน", cls: "bg-echo-cyan text-gray-900", desc: "เวลากัดฟันทน: ทุกแต้มเพิ่มโอกาสฝึกฝนสำเร็จ 10% (สะสมสูงสุด 2) — หายไปเมื่อฝึกฝนสำเร็จ" },
  fullbelly: { icon: "🥖", label: "เต็มอิ่ม", cls: "bg-echo-armor", desc: "เต็มอิ่ม (Breakfast): ดาเมจที่ได้รับ -1 หน่วย — หายไปหลังจบเทิร์นที่กดใช้ (สะสมได้ 1 แต้ม)" },
  overweight: { icon: "🍱", label: "Overweight", cls: "bg-echo-hp", desc: "Overweight (A Big Meal): ฟื้นฟูแต้มสกิลไม่ได้ทุกช่องทาง — ลบออกได้ด้วย Healthfull ครบ 2 แต้ม (จากการฝึกฝนสำเร็จระหว่างติดบัฟนี้) เท่านั้น" },
  healthfull: { icon: "💪", label: "Healthfull", cls: "bg-echo-cyan text-gray-900", desc: "Healthfull: ได้จากการฝึกฝนสำเร็จระหว่างติด Overweight — ครบ 2 แต้มจะถูกใช้เพื่อลบ Overweight ออก 1 แต้ม" },
  victorybeat: { icon: "🏆", label: "Beat of Victory", cls: "bg-echo-gold text-gray-900", desc: "The Beat of Victory: หากชนะเทิร์นนี้ การโจมตี +1 ดาเมจ และเป้าหมายติดชะงัก 1 เทิร์น" },
  ashen: { icon: "🐴", label: "Ashen Trail", cls: "bg-echo-hp", desc: "Ashen Trail: Cinderella Gray — เทิร์นนี้การโจมตี +2 ดาเมจ และหลังเปิดไพ่จะโจมตีใส่ทุกคนที่ไพ่แตก คนละ 2 หน่วย" },
  stagger: { icon: "🫨", label: "ชะงัก", cls: "bg-echo-hp", desc: "ชะงัก (The Beat of Victory): ใช้สกิลไม่ได้ และจั่วไพ่ได้ไม่เกิน 16 แต้ม ตามจำนวนเทิร์นที่เหลือ" },
  // ---------- ซาโตรุ อาเคฟุ (patch 2.0.8.2) ----------
  oblada:   { icon: "🎵", label: "สิ่งแปลกปลอม", cls: "bg-echo-hp", desc: "Obla Di, Obla Da: รับความเสียหาย 1 หน่วยทุกๆ 2 เทิร์น ตามจำนวนเทิร์นที่เหลือ (ดีบัฟพื้นฐาน — ต้าน/ล้างได้)" },
  // ---------- ริดดี้ มาร์เซนาส (patch 2.0.9) ----------
  absorbplus: { icon: "🧲", label: "Absorb Shield", cls: "bg-echo-armor", desc: "Absorb Shield: เพดานเกราะ +2 พร้อมเกราะชั่วคราว (1 เทิร์น) — หลังเปิดไพ่ ล่อเป้าการโจมตีของทุกคนมาที่ตัวเอง และเกราะที่เสียจากการถูกตี/แพ้ แปลงกลับเป็นพลังชีวิต" },
  beamplus:  { icon: "🔫", label: "Beam Plus", cls: "bg-echo-magenta", desc: "Beam Magnum Plus: การโจมตีปกติเทิร์นนี้กลายเป็นตีหมู่ +1 หน่วย (ผู้เล่นอื่นนอกเป้าหมายเสียเกราะ 1) — ซ้อนกับ NT-D ได้ รวมสูงสุด +1" },
  riddhentd: { icon: "⚡", label: "NT-D", cls: "bg-echo-gold text-gray-900", desc: "แกไม่มีสิทธิ์มาสั่งสอนฉัน: NT-D System — พลังโจมตีพื้นฐาน +1 หน่วย ตามจำนวนเทิร์นที่เหลือ" },
  riddheguard: { icon: "🛡️", label: "ไม่ยอมสูญเสีย", cls: "bg-echo-hp", desc: "ฉันจะไม่ยอมสูญเสียใครไปอีก: เพดานเกราะ +2 และต้านสถานะผิดปกติให้ทั้งคู่ — ระหว่างนี้ริดดี้จั่วการ์ด/ใช้สกิล/โจมตีไม่ได้ ริดดี้เองตายไม่ได้ (HP ต่ำสุด 1) และถ้าเกราะรวมเสียถึง 3 หน่วย ฟื้นเกราะให้ทั้งคู่ +2 พร้อมวีดีโอพิเศษ" },
  riddheward: { icon: "🛡️", label: "บันชีปกป้อง", cls: "bg-echo-armor", desc: "ได้รับการปกป้องจากบันชี: เพดานเกราะ +2 และต้านสถานะผิดปกติ ตามจำนวนเทิร์นที่เหลือ" },
  calamity: { icon: "🌩️", label: "Calamity", cls: "bg-echo-hp", desc: "Wonder of U: หายนะไล่ล่า — ถูกบังคับจั่วไพ่เพิ่มตามระดับตอนเริ่มเทิร์นถัดจากที่โดน และรับความเสียหายตามระดับทุกๆ 2 เทิร์น ตามจำนวนเทิร์นที่เหลือ (สะสมสูงสุด 3 ระดับ — โดนซ้ำ = ระดับเพิ่ม + เวลารีเฟรช)" },
  // ---------- 14 ปีกแห่งสุริยัน อควาเรียน (patch 2.0) ----------
  solarburst: { icon: "🥊", label: "หมัดไร้ขอบเขต", cls: "bg-echo-gold text-gray-900", desc: "หมัดไร้ขอบเขต: การโจมตีเทิร์นนี้กลายเป็นตีหมู่ — เป้าหมายรับเต็ม คนอื่นเสียเกราะ 1 หน่วย" },
  marssword:  { icon: "⚔️", label: "ดาบแห่งแสง", cls: "bg-echo-hp", desc: "ดาบแห่งแสง: เมื่อโจมตี จะลดเกราะเป้าหมาย 1 หน่วยก่อน แล้วจึงสร้างความเสียหายตามปกติ" },
  lunabow:    { icon: "🏹", label: "ศรศักดิ์สิทธิ์", cls: "bg-echo-magenta", desc: "ศรศักดิ์สิทธิ์: โจมตีตามปกติ และติดพิษเป้าหมาย เสียเลือด 1 หน่วยทุกเทิร์น 2 เทิร์น" },
  godtree:    { icon: "🌳", label: "พฤกษาแห่งชีวิต", cls: "bg-echo-gold text-gray-900", desc: "ไปยังพฤกษาแห่งชีวิต: ทำอะไรไม่ได้เลย — ทุกคนเจ็บ 1 (ไม่สนเกราะ) ทุกเทิร์น ตัวเองเสียเลือด 1/เทิร์น (ต่ำสุด 1) เกราะฟื้น +2/เทิร์น — ระหว่างผลทำงาน กลางวันยาวไม่สิ้นสุดและร่างปีกแห่งสุริยันไม่มีวันหมด จนกว่าจะกดท่าไม้ตายซ้ำเพื่อยกเลิก หรือตาย — ตายระหว่างนี้จะฟื้นคืนชีพใน 12 เทิร์น" },
  godwing:    { icon: "🌟", label: "ปีกแห่งสุริยัน", cls: "bg-echo-gold text-gray-900", desc: "ปีกแห่งสุริยัน: เปิดสกิลติดตัว 1-3 พร้อมกัน ไม่รับความเสียหายจากแพ้จั่ว/ไพ่แตก และต่อเวลากลางวันเป็น 5 เทิร์น" },
  godarmor:   { icon: "🛡️", label: "คืนร่าง", cls: "bg-echo-armor", desc: "คืนร่าง: ฟื้นฟูเกราะเพิ่ม +1 หน่วยทุกเทิร์น ตามจำนวนเทิร์นที่เหลือ" },
  aquapoison: { icon: "☠️", label: "พิษศร", cls: "bg-echo-hp", desc: "พิษศรศักดิ์สิทธิ์: เสียพลังชีวิต 1 หน่วยทุกเทิร์น (ไม่ถึงตาย — ค้างที่ 1) ตามจำนวนเทิร์นที่เหลือ" },
  marssurge:  { icon: "🗡️", label: "ดาบแห่งจุดจบ", cls: "bg-echo-gold text-gray-900", desc: "ดาบแห่งจุดจบ: ชนะเทิร์นที่มีผู้เล่นอื่นไพ่แตก — พลังโจมตี +1 หน่วยในเทิร์นนี้" },
};
// รวมสถานะทั้งหมดของผู้เล่นเป็นรายการเดียว — full = รวมของที่โชว์แยกที่อื่นด้วย (โล่/เลือดชั่วคราว)
function statusEntries(p, full) {
  const out = [];
  for (const [k, v] of Object.entries(p.statuses || {})) {
    if (!(v > 0)) continue;
    const info = STATUS_INFO[k] || { icon: "✦", label: k, cls: "bg-white/20", desc: "" };
    const amt = (p.statusAmt || {})[k] || 0; // จำนวน (amount) ของบัฟ/ดีบัฟพื้นฐาน (patch 2.0.8)
    out.push({ key: k, v, amt, ...info });
  }
  if ((p.sunriseDrop || 0) > 0) out.push({ key: "sunriseDrop", v: p.sunriseDrop, icon: "🌄", label: "แสงรุ่งอรุณ", cls: "bg-echo-hp", desc: "ผลรุ่งอรุณแห่งวันใหม่: เสียพลังชีวิต 1/เทิร์นแบบไม่สนเกราะ ตามจำนวนเทิร์นที่เหลือ" });
  if ((p.tonkatsu || 0) > 0) out.push({ key: "tonkatsu", v: p.tonkatsu, icon: "🍜", label: "ทงคัสสึ", cls: "bg-echo-cyan text-gray-900", desc: "ชามทงคัสสึสะสม (สูงสุด 4) — ใช้กับ Song for you: 1 ชาม = +1 พลังขิง และล้างสถานะผิดปกติทั้งหมด" });
  if ((p.profit || 0) > 0) out.push({ key: "profit", v: p.profit, icon: "💰", label: "กำไร", cls: "bg-echo-gold text-gray-900", desc: "กำไรเท่าตัวโว้ย: การโจมตีครั้งถัดไป +N และทะลุเกราะ (คงอยู่จนได้ตี)" });
  if ((p.appleAtk || 0) > 0) out.push({ key: "appleAtk", v: p.appleAtk, icon: "🍎", label: "มอบของ", cls: "bg-echo-gold text-gray-900", desc: "เอาไปสิ: พลังโจมตีเพิ่มจากการมอบของ (ไม่ซ้อนทับ) — มอบชิ้นเดิมให้คนเดิมซ้ำ บัฟหายไป" });
  if ((p.coins || 0) > 0) out.push({ key: "coins", v: p.coins, icon: "🐷", label: "Coin", cls: "bg-echo-gold text-gray-900", desc: "กระปุกออมสินน้องหมูน้อย: coin สะสม (สูงสุด 6) — ตอนโจมตีแปลงเป็นความเสียหาย 3 coin = +1 (ใช้แล้วเหรียญหมดไป)" });
  // โอกูริ แคป: Stamina สะสม (โชว์เสมอ — ทรัพยากรหลักของตัวละคร)
  if (p.character?.id === "oguri") out.push({ key: "stamina", v: 1, icon: "🏇", label: `Stamina ${p.stamina || 0}/16`, cls: "bg-echo-cyan text-gray-900", desc: "Stamina: ทรัพยากรของโอกูริ แคป (สะสมสูงสุด 16) — Training ใช้ 4 / The Beat of Victory ใช้ 8 / Ashen Trail ใช้ 12 — เติมได้จาก Breakfast (+4), A Big Meal (เต็ม 16) และ GrayBeast (+1/เทิร์น)" });
  if ((p.lightDew || 0) > 0) out.push({ key: "lightDew", v: p.lightDew, icon: "✨", label: "แสงละออง", cls: "bg-echo-cyan text-gray-900", desc: "แสงละอองสะสม (สูงสุด 5) — ครบ 5 ขณะอยู่ร่างโซล่าตอนกลางวัน จะกลายเป็นปีกแห่งสุริยัน 5 เทิร์น" });
  if ((p.reviveIn || 0) > 0) out.push({ key: "reviveIn", v: p.reviveIn, icon: "🌳", label: "รอฟื้นคืนชีพ", cls: "bg-echo-gold text-gray-900", desc: "พฤกษาแห่งชีวิต: จะฟื้นคืนชีพเมื่อครบตามจำนวนเทิร์นที่เหลือ (เลือด 1 เกราะ 0 แต้มสกิล 0) หากเกมยังไม่จบ" });
  if ((p.phenexPain || 0) > 0) out.push({ key: "phenexPain", v: p.phenexPain, icon: "💔", label: "ความเจ็บปวด", cls: "bg-echo-hp", desc: "ความเจ็บปวดสะสม (ไม่อยากให้ใครต้องเจ็บปวด) — ปลดปล่อยเป็นความเสียหายใส่เป้าหมายที่เลือกตอนตกรอบจริง (ไม่สนการหลบหลีก)" });
  // Bard: ท่อนทำนองสะสม + โน้ตในช่องประพันธ์เพลง (ทุกคนเห็นได้)
  if ((p.bloodSection || 0) > 0) out.push({ key: "bloodSection", v: p.bloodSection, icon: "❤️", label: "ท่อนโลหิต", cls: "bg-echo-hp", desc: "ท่อนทำนองแห่งโลหิต: สะสมจากการบรรเลงเพลงสาย Crimson — ครบ 5 ชั้น เปิดมิติมายาบรรเลงโลหิต 3 เทิร์น" });
  if ((p.soulSection || 0) > 0) out.push({ key: "soulSection", v: p.soulSection, icon: "💚", label: "ท่อนวิญญาณ", cls: "bg-echo-magenta", desc: "ท่อนทำนองแห่งวิญญาณ: สะสมจากการบรรเลงเพลงสาย Jade — ครบ 5 ชั้น เปิดมิติมายาบรรเลงวิญญาณ 3 เทิร์น" });
  if ((p.bardNotes || []).length > 0) out.push({ key: "bardNotes", v: 1, icon: "🎼", label: p.bardNotes.map((n) => (n === "R" ? "❤️" : "💚")).join(""), cls: "bg-echo-cyan text-gray-900", desc: "ช่องประพันธ์เพลง: โน้ตที่เติมไว้ — ครบ 3 โน้ตจะบรรเลงทำนองตามลำดับโน้ตทันที" });
  if (p.contractWithId) out.push({ key: "contract", v: 1, icon: "📶", label: "คู่สัญญา", cls: "bg-echo-cyan text-gray-900", desc: "สนใจใช้บริการเราไหม: เพดานเกราะ +1 และพลังโจมตี +1 ตลอดสัญญา — ทุก 3 เทิร์นต้องเลือกต่อสัญญา (4 แต้ม) หรือยกเลิก" });
  // ริดดี้ (patch 2.0.9): คู่พันธมิตรบันชี × ยูนิคอร์น
  if (p.allyId) out.push({ key: "ally", v: 1, icon: "🤝", label: "พันธมิตร", cls: "bg-echo-cyan text-gray-900", desc: "พันธมิตรบันชี × ยูนิคอร์น: เห็นแต้มการ์ดของกันและกันได้ตลอด — ถ้าคู่พันธมิตรตีกันเอง ฝ่ายถูกตีเลือกยกเลิกพันธมิตรได้ (ฟื้นสิ่งที่เสียคืน) และถ้าเหลือแค่คู่พันธมิตรบนสนามแล้วเลือกคงพันธมิตร = ชนะทั้งคู่" });
  if (p.contractPartnerId) out.push({ key: "boss", v: 1, icon: "📶", label: "มีคู่สัญญา", cls: "bg-echo-gold text-gray-900", desc: "เจ้าแห่งเน็ตบ้าน: มีคู่สัญญาอยู่ 1 คน — คู่สัญญาโจมตีใส่ตัวละครนี้ ความเสียหายลด 1 หน่วย" });
  if ((p.skillDrain || 0) > 0) out.push({ key: "skillDrain", v: p.skillDrain, icon: "📵", label: "ค่าปรับ", cls: "bg-echo-hp", desc: "ปฏิเสธข้อเสนอสัญญา: แต้มสกิลหลังจบเทิร์นลด 1 หน่วย ตามจำนวนเทิร์นที่เหลือ" });
  if ((p.statuses?.chill || 0) > 0) out.push({ key: "chillDodge", v: 1, icon: "💨", label: `หลบ ${p.chillDodge != null ? p.chillDodge : 100}%`, cls: "bg-echo-cyan text-gray-900", desc: "โอกาสหลบการถูกเลือกโจมตีขณะชิวๆครับน้องๆ — เริ่ม 100% หลบได้เหลือ 50% หลบได้อีกเหลือ 25% และคงที่จนกว่าผลจะหมด" });
  if (full && (p.shield || 0) > 0) out.push({ key: "shield", v: p.shield, icon: "🛡️", label: "โล่", cls: "bg-echo-armor", desc: "กันความเสียหายครั้งถัดไปตามจำนวนโล่" });
  if (full && (p.tempHp || 0) > 0) out.push({ key: "tempHp", v: p.tempHp, icon: "💛", label: "เลือดชั่วคราว", cls: "bg-echo-gold text-gray-900", desc: "หายเองใน 2 เทิร์น หรือหมดไปเมื่อรับความเสียหาย" });
  return out;
}
function StatusChips({ p, left }) {
  const items = statusEntries(p);
  if (!items.length) return null;
  return (
    <div className={`flex flex-wrap gap-1 ${left ? "justify-start" : "justify-center"} mt-1`}>
      {items.map((it) => (
        <span
          key={it.key}
          title={`${it.label}${it.amt > 0 ? ` +${it.amt}` : ""}${it.v > 1 ? ` x${it.v}` : ""} — ${it.desc}`}
          className={`text-xs px-1.5 py-0.5 rounded-md font-bold border border-black/25 shadow ${it.cls}`}
        >
          {it.icon}{it.label}{it.amt > 0 ? ` +${it.amt}` : ""}{it.v > 1 ? ` ${it.v}` : ""}
        </span>
      ))}
    </div>
  );
}

// ---------- หน้าต่างดูสถานะ + รายละเอียดสกิลของผู้เล่น (แตะการ์ดผู้เล่นคนไหนก็ได้ตอนไม่ได้เลือกเป้า) ----------
//  patch 1.9.1: เพิ่มรายละเอียดสกิลตัวละครของฝั่งตรงข้ามให้กดดูได้จากหน้ากระดาน
function StatusModal({ p, onClose }) {
  const items = statusEntries(p, true);
  const ch = p.character;
  const skillRows = ch
    ? [["สกิลติดตัว", ch.passive], ["สกิลพื้นฐาน", ch.basic], ["สกิลรอง", ch.secondary], ["ท่าไม้ตาย", ch.ultimate]]
    : [];
  return (
    <div className="fixed inset-0 z-40 bg-black/60 grid place-items-center p-4" onClick={onClose}>
      <div className="bg-echo-navy rounded-2xl p-5 max-w-md w-full shadow-2xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-3">
          <div className="rounded-xl overflow-hidden w-14 h-14 border-2 shrink-0 bg-black/40" style={{ borderColor: p.color }}>
            {p.img && <img src={p.img} alt="" className="w-full h-full object-cover" />}
          </div>
          <div className="min-w-0">
            <div className="text-lg font-black truncate" style={{ color: p.color }}>{p.name}</div>
            <div className="text-sm opacity-80 truncate">{p.character?.name} — สถานะ / รายละเอียดสกิล</div>
          </div>
        </div>
        {items.length === 0 ? (
          <div className="text-sm opacity-70 py-2 text-center">ไม่มีสถานะผิดปกติ</div>
        ) : (
          <div className="flex flex-col gap-2">
            {items.map((it) => (
              <div key={it.key} className="flex items-start gap-2 rounded-xl bg-white/5 border border-white/10 px-3 py-2">
                <span className={`text-xs px-1.5 py-0.5 rounded-md font-bold shrink-0 ${it.cls}`}>{it.icon}{it.label}{it.amt > 0 ? ` +${it.amt}` : ""}{it.v > 1 ? ` ${it.v}` : ""}</span>
                <span className="text-sm opacity-90 leading-snug">{it.desc}</span>
              </div>
            ))}
          </div>
        )}
        {/* รายละเอียดสกิลตัวละคร (ดูของฝั่งตรงข้ามได้) */}
        {skillRows.length > 0 && (
          <div className="mt-3 border-t border-white/10 pt-2">
            <div className="font-bold mb-1.5">สกิลของ {ch.name}</div>
            {skillRows.map(([label, s], i) =>
              s ? (
                <div key={i} className="flex items-start gap-2 py-1.5 border-t border-white/5 first:border-t-0">
                  {s.img ? (
                    <img src={s.img} alt="" className="w-16 h-11 object-cover rounded-lg shrink-0 mt-0.5" />
                  ) : (
                    <span className="w-16 h-11 grid place-items-center text-xl shrink-0 bg-white/5 rounded-lg mt-0.5">✦</span>
                  )}
                  <div className="min-w-0">
                    <div className="flex justify-between gap-2">
                      <span className="font-bold text-sm">{label} · <span className="text-echo-gold">{s.name}</span></span>
                      <span className="text-xs opacity-70 shrink-0">{s.cost != null ? `ใช้ ${s.cost}` : "ฟรี"}</span>
                    </div>
                    <div className="text-xs opacity-80 leading-snug">{s.desc}</div>
                  </div>
                </div>
              ) : null
            )}
          </div>
        )}
        <Button className="mt-3 w-full" onClick={() => { clickSound(); onClose(); }}>ปิด</Button>
      </div>
    </div>
  );
}

// ผู้เล่นคนอื่นรอบโต๊ะ — picked = ถูกเลือกเป้าหมาย ANATA WAAAAAAAA แล้ว
//  คลิกตอนไม่ได้เลือกเป้า = เปิดหน้าต่างดูสถานะของคนนั้น (onInspect)
function OtherPlayer({ p, phase, slot, targetable, onAttack, picked, onInspect }) {
  const summary = phase === "SUMMARY";
  return (
    <div
      className="absolute -translate-x-1/2 flex flex-col items-center gap-1 w-32"
      style={{ top: `${slot[0]}%`, left: `${slot[1]}%` }}
    >
      <div
        onClick={targetable ? () => { clickSound(); onAttack(p.id); } : () => { clickSound(); onInspect(p.id); }}
        className={`relative ${!p.alive ? "opacity-40 grayscale" : ""} ${targetable ? "cursor-crosshair targetable rounded-2xl" : "cursor-pointer"}`}
        title={targetable ? undefined : "แตะเพื่อดูสถานะ"}
      >
        <Portrait p={p} className="w-20 h-20 -rotate-3 border-4" />
        <div className="absolute inset-0 rounded-2xl border-4 -rotate-3 pointer-events-none" style={{ borderColor: p.color }} />
        {picked && <span className="absolute -top-2 -left-2 text-2xl">🎤</span>}
        {!p.alive && <span className="absolute inset-0 grid place-items-center text-3xl">💀</span>}
        {p.isWinner && summary && <span className="absolute -top-2 -right-2 text-xl">👑</span>}
        {phase === "PLAYING" && p.locked && p.alive && (
          <span className="absolute -bottom-1 -right-1 bg-emerald-600 rounded-full w-5 h-5 grid place-items-center text-xs">✓</span>
        )}
      </div>
      <div className="max-w-full truncate text-base sm:text-lg font-black px-2 py-0.5 rounded-lg bg-black/50 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]" style={{ borderBottom: `3px solid ${p.color}` }}>{p.name}</div>
      <Stats p={p} center />
      {/* ใบโปรโมทสินค้า (Apple guy): แต้มการ์ดถูกเปิดเผยให้ทุกคนเห็นแม้ยังไม่เปิดไพ่ */}
      {(summary || (p.statuses?.promo || 0) > 0) && p.score !== null && (
        <div className={`score-pop text-2xl font-black ${p.isWinner ? "text-echo-gold" : p.busted ? "text-echo-hp" : "text-white"}`}>
          {p.busted ? "แตก!" : `${p.score} แต้ม`}
        </div>
      )}
      <StatusChips p={p} />
    </div>
  );
}

// ---------- การ์ดคู่ต่อสู้แบบมือถือ (เรียงกริดด้านบน แตะเพื่อโจมตี/เลือกเป้า ANATA) ----------
//  แตะตอนไม่ได้เลือกเป้า = เปิดหน้าต่างดูสถานะของคนนั้น (onInspect)
function MobileOpponent({ p, phase, targetable, onAttack, picked, onInspect }) {
  const summary = phase === "SUMMARY";
  return (
    <div
      onClick={targetable ? () => { clickSound(); onAttack(p.id); } : () => { clickSound(); onInspect(p.id); }}
      className={`relative flex items-center gap-2 rounded-2xl bg-black/50 border-2 px-2 py-1.5 min-h-[68px] ${!p.alive ? "opacity-40 grayscale" : ""} ${targetable ? "targetable cursor-crosshair" : "cursor-pointer"}`}
      style={{ borderColor: p.color }}
    >
      <div className="relative shrink-0">
        <Portrait p={p} className="w-14 h-14 border-2" rounded="rounded-xl" />
        {!p.alive && <span className="absolute inset-0 grid place-items-center text-2xl">💀</span>}
        {p.isWinner && summary && <span className="absolute -top-2 -right-1 text-lg">👑</span>}
        {phase === "PLAYING" && p.locked && p.alive && (
          <span className="absolute -bottom-1 -right-1 bg-emerald-600 rounded-full w-5 h-5 grid place-items-center text-xs">✓</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-base font-black" style={{ color: p.color }}>{p.name}</div>
        {/* เลือด + เกราะ อยู่บรรทัดเดียวแนวนอนเสมอ */}
        <LifeBar p={p} sm className="mt-0.5" />
        <StatusChips p={p} left />
      </div>
      {/* ใบโปรโมทสินค้า (Apple guy): แต้มการ์ดถูกเปิดเผยให้ทุกคนเห็นแม้ยังไม่เปิดไพ่ */}
      {(summary || (p.statuses?.promo || 0) > 0) && p.score !== null && (
        <div className={`score-pop shrink-0 text-xl font-black ${p.isWinner ? "text-echo-gold" : p.busted ? "text-echo-hp" : "text-white"}`}>
          {p.busted ? "แตก!" : p.score}
        </div>
      )}
      {picked ? (
        <span className="absolute -top-2 -left-2 text-xl">🎤</span>
      ) : targetable ? (
        <span className="absolute -top-2 -left-2 text-xl">🎯</span>
      ) : null}
    </div>
  );
}

// ---------- modal รายละเอียดตัวละคร (ใช้ร่วมกันทั้งจอคอม/มือถือ) ----------
//  me = ผู้เล่นของเรา -> โชว์สถานะผิดปกติที่ติดอยู่ตอนนี้ พร้อมคำอธิบายเต็ม
function CharModal({ ch, me, onClose }) {
  const myStatuses = me ? statusEntries(me, true) : [];
  return (
    <div className="fixed inset-0 z-40 bg-black/60 grid place-items-center p-4" onClick={onClose}>
      <div className="bg-echo-navy rounded-2xl p-5 max-w-md w-full shadow-2xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="text-xl font-bold mb-2">{ch.name}</div>
        {[["สกิลติดตัว", ch.passive], ["สกิลพื้นฐาน", ch.basic], ["สกิลรอง", ch.secondary], ["ท่าไม้ตาย", ch.ultimate]].map(([label, s], i) =>
          s ? (
            <div key={i} className="py-1.5 border-t border-white/10">
              <div className="flex justify-between"><span className="font-bold">{label} · {s.name}</span><span className="text-xs opacity-70">{s.cost != null ? `ใช้ ${s.cost}` : "ฟรี"}</span></div>
              <div className="text-sm opacity-80">{s.desc}</div>
            </div>
          ) : null
        )}
        {myStatuses.length > 0 && (
          <div className="py-1.5 border-t border-white/10">
            <div className="font-bold mb-1.5">สถานะที่ติดอยู่ตอนนี้</div>
            <div className="flex flex-col gap-1.5">
              {myStatuses.map((it) => (
                <div key={it.key} className="flex items-start gap-2 rounded-xl bg-white/5 border border-white/10 px-3 py-1.5">
                  <span className={`text-xs px-1.5 py-0.5 rounded-md font-bold shrink-0 ${it.cls}`}>{it.icon}{it.label}{it.amt > 0 ? ` +${it.amt}` : ""}{it.v > 1 ? ` ${it.v}` : ""}</span>
                  <span className="text-sm opacity-90 leading-snug">{it.desc}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <Button className="mt-3 w-full" onClick={() => { clickSound(); onClose(); }}>ปิด</Button>
      </div>
    </div>
  );
}

// ---------- เรจูอาคมบัญชา (สกิลติดตัวฟุจิมารุ): UI พิเศษแยกจากช่องสกิล ----------
//  ไม่นับเป็นการใช้สกิล -> ใช้พร้อมสกิลอื่นได้ | 3 ครั้งต่อเกม | รูปเปลี่ยนตามเส้นที่เหลือ (reiju3-0)
const REIJU_COMMANDS = [
  { cmd: 1, icon: "🛡️", name: "อมตะ 1 เทิร์น", desc: "เทิร์นนี้ไม่ถูกเลือกโจมตี และไม่รับความเสียหายใดๆ เลย" },
  { cmd: 2, icon: "🎲", name: "สุ่มฟื้นจนเต็ม", desc: "สุ่มฟื้นพลังชีวิต หรือ เกราะ อย่างใดอย่างหนึ่งจนเต็ม (โอกาส 50/50)" },
  { cmd: 3, icon: "✨", name: "เติมแต้มสกิลเต็ม", desc: "เติมแต้มสกิลให้เต็ม 6 แต้มทันที" },
];
const reijuImg = (n) => `/characters/fujimaru/reiju${Math.max(0, Math.min(3, n ?? 0))}.jpg`;

function ReijuButton({ me, usable, onOpen, className = "" }) {
  return (
    <button
      onClick={() => { if (usable) { clickSound(); onOpen(); } }}
      disabled={!usable}
      title="เรจูอาคมบัญชา — สั่งใช้ก่อนเปิดการ์ด (ไม่นับเป็นการใช้สกิล)"
      className={`relative rounded-xl overflow-hidden border-2 border-echo-gold shadow-lg transition ${
        usable ? "hover:scale-105 ring-2 ring-echo-gold/60" : "opacity-60 grayscale cursor-not-allowed"
      } ${className}`}
    >
      <img src={reijuImg(me.reiju)} alt="" className="absolute inset-0 w-full h-full object-cover" />
      <span className="absolute bottom-0 inset-x-0 bg-black/75 text-[10px] font-bold text-echo-gold leading-tight py-0.5">
        📜 อาคม {me.reiju ?? 0}/3
      </span>
    </button>
  );
}

function ReijuModal({ me, onUse, onClose }) {
  return (
    <div className="fixed inset-0 z-40 bg-black/60 grid place-items-center p-4" onClick={onClose}>
      <div className="bg-echo-navy rounded-2xl p-5 max-w-md w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-3">
          <div className="rounded-xl overflow-hidden w-16 h-16 border-2 border-echo-gold shrink-0">
            <img src={reijuImg(me.reiju)} alt="" className="w-full h-full object-cover" />
          </div>
          <div>
            <div className="text-lg font-black text-echo-gold">ขอสาบานด้วยอาคมบัญชานี้</div>
            <div className="text-sm opacity-80">เรจูอาคมบัญชาเหลือ {me.reiju ?? 0}/3 — เลือกคำสั่ง</div>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          {REIJU_COMMANDS.map((c) => (
            <button
              key={c.cmd}
              onClick={() => { clickSound(); onUse(c.cmd); }}
              className="text-left rounded-xl bg-white/5 hover:bg-white/15 border border-white/15 px-3 py-2 transition"
            >
              <div className="font-bold text-echo-gold">{c.icon} คำสั่งที่ {c.cmd} · {c.name}</div>
              <div className="text-sm opacity-80">{c.desc}</div>
            </button>
          ))}
        </div>
        <Button className="mt-3 w-full" onClick={() => { clickSound(); onClose(); }}>ปิด</Button>
      </div>
    </div>
  );
}

// ---------- เอาแบบนี้ได้ไหม (Apple guy สกิลพื้นฐาน): เมนูเลือกของส่งมอบ ----------
//  ใช้ 2 แต้ม เปลี่ยนของที่จะมอบผ่านสกิลรอง "เอาไปสิ" — ใช้แล้วยังใช้สกิลอื่นได้อีก 1 ครั้ง
//  ภาพปกสกิลพื้นฐานเปลี่ยนตามของที่เลือกอยู่
function AppleItemModal({ me, onPick, onClose }) {
  return (
    <div className="fixed inset-0 z-40 bg-black/60 grid place-items-center p-4" onClick={onClose}>
      <div className="bg-echo-navy rounded-2xl p-5 max-w-md w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="text-lg font-black text-echo-gold">🍎 เอาแบบนี้ได้ไหม — เลือกของส่งมอบ</div>
        <div className="text-sm opacity-80 mb-3">ของที่เลือกจะถูกมอบให้เป้าหมายผ่านสกิลรอง "เอาไปสิ" (ใช้ 2 แต้ม — ใช้แล้วยังใช้สกิลอื่นได้อีก 1 ครั้ง)</div>
        <div className="flex flex-col gap-2">
          {APPLE_ITEMS.map((it) => (
            <button
              key={it.key}
              onClick={() => { clickSound(); onPick(it.key); }}
              className={`text-left flex items-center gap-3 rounded-xl border px-3 py-2 transition ${
                me.appleItem === it.key ? "bg-echo-gold/20 border-echo-gold" : "bg-white/5 hover:bg-white/15 border-white/15"
              }`}
            >
              <img src={it.img} alt="" className="w-16 h-12 object-cover rounded-lg shrink-0" />
              <div>
                <div className="font-bold text-echo-gold">{it.name}{me.appleItem === it.key ? " · เลือกอยู่" : ""}</div>
                <div className="text-sm opacity-80">{it.desc}</div>
              </div>
            </button>
          ))}
        </div>
        <Button className="mt-3 w-full" onClick={() => { clickSound(); onClose(); }}>ปิด</Button>
      </div>
    </div>
  );
}

// ---------- โทโนะ ชิกิ (สกิลพื้นฐาน): เมนูเลือกระดับมีดพับประจำตระกูล ----------
const TOHNO_LEVELS = [
  { level: 1, name: "1. ปิดใช้งานสกิลติดตัว (ค่าเริ่มต้น)", desc: "ทุกครั้งที่ได้โจมตี ฟื้นพลังชีวิต +2" },
  { level: 2, name: "2. เปิดใช้งานสกิลติดตัว", desc: "โจมตีปกติมีโอกาสสังหารทันที 5% — พลาดเสียพลังชีวิต 1 หน่วย (ไม่สนเกราะ)" },
  { level: 3, name: "3. เพิ่มโอกาสสังหาร", desc: "โอกาสสังหารทันที 10% — พลาดเสียพลังชีวิต 2 หน่วย (ไม่สนเกราะ)" },
  { level: 4, name: "4. เพิ่มโอกาสสังหาร", desc: "โอกาสสังหารทันที 20% — พลาดเสียพลังชีวิต 4 หน่วย (ไม่สนเกราะ)" },
  { level: 5, name: "5. เพิ่มโอกาสสังหาร", desc: "โอกาสสังหารทันที 50% — พลาดเสียพลังชีวิต 6 หน่วย (ไม่สนเกราะ)" },
];
function TohnoLevelModal({ me, onPick, onClose }) {
  return (
    <div className="fixed inset-0 z-40 bg-black/60 grid place-items-center p-4" onClick={onClose}>
      <div className="bg-echo-navy rounded-2xl p-5 max-w-md w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="text-lg font-black text-echo-gold">🔪 มีดพับประจำตระกูล — เลือกระดับ</div>
        <div className="text-sm opacity-80 mb-3">กดเปลี่ยนระดับได้กี่ครั้งก็ได้ — สังหารสำเร็จจะไม่เสียพลังชีวิตไม่ว่าระดับใด</div>
        <div className="flex flex-col gap-2">
          {TOHNO_LEVELS.map((it) => (
            <button
              key={it.level}
              onClick={() => { clickSound(); onPick(it.level); }}
              className={`text-left flex items-center gap-3 rounded-xl border px-3 py-2 transition ${
                (me.tohnoLevel || 1) === it.level ? "bg-echo-gold/20 border-echo-gold" : "bg-white/5 hover:bg-white/15 border-white/15"
              }`}
            >
              <div>
                <div className="font-bold text-echo-gold">{it.name}{(me.tohnoLevel || 1) === it.level ? " · เลือกอยู่" : ""}</div>
                <div className="text-sm opacity-80">{it.desc}</div>
              </div>
            </button>
          ))}
        </div>
        <Button className="mt-3 w-full" onClick={() => { clickSound(); onClose(); }}>ปิด</Button>
      </div>
    </div>
  );
}
// ---------- เปลี่ยนหัวหน้า (อควาเรียน สกิลพื้นฐาน): เมนูเลือกผู้นำ ----------
//  ใช้ 2 แต้ม ฟื้นเลือด 1 หน่วย — ใช้แล้วยังใช้สกิลอื่นได้อีก 1 ครั้ง — กำหนดร่างที่จะรวมร่างด้วยสกิลรอง
const AQUA_LEADERS = [
  { key: "apollo", name: "อะพอลโล่ (โซล่า)", img: "/characters/auqarion/skill1/apollo.jpg" },
  { key: "sirius", name: "ซิลิอุส (มาร์)", img: "/characters/auqarion/skill1/sirius.jpg" },
  { key: "rena", name: "ลีน่า (ลูน่า)", img: "/characters/auqarion/skill1/rena.jpg" },
];
function AquaLeaderModal({ me, onPick, onClose }) {
  return (
    <div className="fixed inset-0 z-40 bg-black/60 grid place-items-center p-4" onClick={onClose}>
      <div className="bg-echo-navy rounded-2xl p-5 max-w-md w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="text-lg font-black text-echo-gold">🌊 เปลี่ยนหัวหน้า — เลือกผู้นำ</div>
        <div className="text-sm opacity-80 mb-3">กำหนดร่างที่จะรวมร่างด้วยสกิลรอง "รวมร่างหุ่นศักดิ์สิทธิ์" (ใช้ 2 แต้ม ฟื้นเลือด +1 — ใช้แล้วยังใช้สกิลอื่นได้อีก 1 ครั้ง)</div>
        <div className="flex flex-col gap-2">
          {AQUA_LEADERS.map((it) => (
            <button
              key={it.key}
              onClick={() => { clickSound(); onPick(it.key); }}
              className={`text-left flex items-center gap-3 rounded-xl border px-3 py-2 transition ${
                me.leader === it.key ? "bg-echo-gold/20 border-echo-gold" : "bg-white/5 hover:bg-white/15 border-white/15"
              }`}
            >
              <img src={it.img} alt="" className="w-14 h-14 object-cover rounded-lg shrink-0" />
              <div className="font-bold text-echo-gold">{it.name}{me.leader === it.key ? " · เลือกอยู่" : ""}</div>
            </button>
          ))}
        </div>
        <Button className="mt-3 w-full" onClick={() => { clickSound(); onClose(); }}>ปิด</Button>
      </div>
    </div>
  );
}

// ---------- สนใจใช้บริการเราไหม (เจ้าแห่งเน็ตบ้าน): ข้อเสนอสัญญา — เป้าหมายเลือกตอบรับ/ปฏิเสธ ----------
//  ไม่ตอบก่อนเปิดไพ่ = ถือว่าปฏิเสธ (โดนค่าปรับตามปกติ)
function ContractOfferModal({ offer, onAnswer }) {
  return (
    <div className="fixed inset-0 z-40 bg-black/70 grid place-items-center p-4">
      <div className="bg-echo-navy rounded-2xl p-5 max-w-md w-full shadow-2xl border-2" style={{ borderColor: offer.color }}>
        <div className="flex items-center gap-3 mb-3">
          <img src={offer.img} alt="" className="w-20 h-14 object-cover rounded-xl shrink-0" />
          <div>
            <div className="text-lg font-black text-echo-gold">📶 สนใจใช้บริการเราไหม</div>
            <div className="text-sm opacity-80"><span className="font-bold" style={{ color: offer.color }}>{offer.from}</span> ยื่นข้อเสนอสัญญาให้คุณ</div>
          </div>
        </div>
        <div className="flex flex-col gap-2 text-sm">
          <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-2">✅ <b>ตอบรับ</b> — เพดานเกราะ +1 พร้อมฟื้นเกราะ 1 หน่วย และพลังโจมตี +1 คงอยู่ตลอดสัญญา (ทุก 3 เทิร์นจะถูกเรียกเก็บค่าต่อสัญญา 4 แต้ม)</div>
          <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-2">❌ <b>ปฏิเสธ</b> — เสียพลังชีวิต 1 หน่วยไม่สนเกราะ และแต้มสกิลจบเทิร์นลด 1 เป็นเวลา 3 เทิร์น — ไม่ตอบก่อนเปิดไพ่ = ปฏิเสธ</div>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-3">
          <Button variant="gold" className="py-3" onClick={() => { clickSound(); onAnswer(true); }}>✅ ตอบรับ</Button>
          <Button variant="ghost" className="py-3" onClick={() => { clickSound(); onAnswer(false); }}>❌ ปฏิเสธ</Button>
        </div>
      </div>
    </div>
  );
}

// ---------- Locacaca fruit (ซาโตรุ patch 2.0.8.2): ข้อเสนอผลไม้ — เป้าหมายเลือกรับ/ปฏิเสธ ----------
//  ไม่ตอบก่อนเปิดไพ่ = ถือว่าปฏิเสธ (ไม่มีอะไรเกิดขึ้น)
function LocaOfferModal({ offer, onAnswer }) {
  return (
    <div className="fixed inset-0 z-40 bg-black/70 grid place-items-center p-4">
      <div className="bg-echo-navy rounded-2xl p-5 max-w-md w-full shadow-2xl border-2" style={{ borderColor: offer.color }}>
        <div className="flex items-center gap-3 mb-3">
          <img src={offer.img} alt="" className="w-20 h-14 object-cover rounded-xl shrink-0" />
          <div>
            <div className="text-lg font-black text-echo-gold">🍑 Locacaca fruit</div>
            <div className="text-sm opacity-80"><span className="font-bold" style={{ color: offer.color }}>{offer.from}</span> ยื่นผลโลกากากาให้คุณ</div>
          </div>
        </div>
        <div className="flex flex-col gap-2 text-sm">
          <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-2">✅ <b>รับ</b> — ฟื้นเลือดจนเต็มทันที แต่ Max HP ลดถาวร 1 หน่วย และจ่ายแต้มสกิล {offer.steal} หน่วยให้ {offer.from}</div>
          <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-2">❌ <b>ปฏิเสธ</b> — ไม่มีอะไรเกิดขึ้น — ไม่ตอบก่อนเปิดไพ่ = ปฏิเสธ</div>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-3">
          <Button variant="gold" className="py-3" onClick={() => { clickSound(); onAnswer(true); }}>✅ รับผลไม้</Button>
          <Button variant="ghost" className="py-3" onClick={() => { clickSound(); onAnswer(false); }}>❌ ปฏิเสธ</Button>
        </div>
      </div>
    </div>
  );
}

// ---------- พันธมิตรบันชี × ยูนิคอร์น (ริดดี้ มาร์เซนาส patch 2.0.9) ----------
// Event เริ่มเกม: ริดดี้เห็นบานาจบนสนาม -> เลือกยื่นข้อเสนอพันธมิตร (เลือกบานาจ 1 คน) หรือเดินเส้นทางเดี่ยว
function AllyChoiceModal({ choices, onPick, onDecline }) {
  return (
    <div className="fixed inset-0 z-40 bg-black/70 grid place-items-center p-4">
      <div className="bg-echo-navy rounded-2xl p-5 max-w-md w-full shadow-2xl border-2 border-echo-gold/60">
        <div className="text-lg font-black text-echo-gold">🤝 ตรวจพบยูนิคอร์นบนสนาม</div>
        <div className="text-sm opacity-80 mb-3">ต้องการยื่นข้อเสนอเป็นพันธมิตรกับบานาจไหม? (เป็นพันธมิตรแล้ว ท่าไม้ตายจะเปลี่ยนเป็น "ฉันจะไม่ยอมสูญเสียใครไปอีก" และเห็นแต้มการ์ดของกันและกัน — ไม่ตอบก่อนเปิดไพ่ = เดินเส้นทางเดี่ยว)</div>
        <div className="flex flex-col gap-2">
          {choices.map((c) => (
            <button
              key={c.id}
              onClick={() => { clickSound(); onPick(c.id); }}
              className="text-left flex items-center gap-3 rounded-xl bg-white/5 hover:bg-white/15 border border-white/15 px-3 py-2 transition"
            >
              <img src={c.img} alt="" className="w-14 h-14 object-cover rounded-lg shrink-0" />
              <div className="font-bold" style={{ color: c.color }}>{c.name} <span className="text-white/70 text-sm">(บานาจ ลิงก์)</span></div>
            </button>
          ))}
        </div>
        <Button variant="ghost" className="mt-3 w-full py-3" onClick={() => { clickSound(); onDecline(); }}>🤖 ไม่เป็นพันธมิตร — เดินเส้นทางเดี่ยว</Button>
      </div>
    </div>
  );
}
// ริต้า เบอร์นัล: ขอแค่ได้พบกันอีก — เลือกเป้าหมายปลดปล่อยความเจ็บปวด (แสดงแม้ตกรอบไปแล้ว)
function PhenexReleaseModal({ ask, onPick }) {
  return (
    <div className="fixed inset-0 z-40 bg-black/70 grid place-items-center p-4">
      <div className="bg-echo-navy rounded-2xl p-5 max-w-md w-full shadow-2xl border-2 border-echo-hp/60">
        <div className="text-lg font-black text-echo-hp">💔 ขอแค่ได้พบกันอีก</div>
        <div className="text-sm opacity-80 mb-3">เลือกเป้าหมายที่จะปลดปล่อยความเจ็บปวดสะสม {ask.pain} หน่วยใส่ (ไม่สนการหลบหลีก)</div>
        <div className="flex flex-col gap-2">
          {ask.options.map((c) => (
            <button
              key={c.id}
              onClick={() => { clickSound(); onPick(c.id); }}
              className="text-left flex items-center gap-3 rounded-xl bg-white/5 hover:bg-white/15 border border-white/15 px-3 py-2 transition"
            >
              <img src={c.img} alt="" className="w-14 h-14 object-cover rounded-lg shrink-0" />
              <div className="font-bold" style={{ color: c.color }}>{c.name}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
// บานาจ: ข้อเสนอพันธมิตรจากริดดี้ — ตอบรับ/ปฏิเสธ (ไม่ตอบก่อนเปิดไพ่ = ปฏิเสธ)
function AllyOfferModal({ offer, onAnswer }) {
  return (
    <div className="fixed inset-0 z-40 bg-black/70 grid place-items-center p-4">
      <div className="bg-echo-navy rounded-2xl p-5 max-w-md w-full shadow-2xl border-2" style={{ borderColor: offer.color }}>
        <div className="flex items-center gap-3 mb-3">
          <img src={offer.img} alt="" className="w-16 h-16 object-cover rounded-xl shrink-0" />
          <div>
            <div className="text-lg font-black text-echo-gold">🤝 ข้อเสนอพันธมิตรบันชี</div>
            <div className="text-sm opacity-80"><span className="font-bold" style={{ color: offer.color }}>{offer.from}</span> ยื่นข้อเสนอเป็นพันธมิตรให้คุณ</div>
          </div>
        </div>
        <div className="flex flex-col gap-2 text-sm">
          <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-2">✅ <b>ตอบรับ</b> — เห็นแต้มการ์ดของกันและกันตลอด / ท่าไม้ตาย 2 ของริดดี้จะมอบเกราะ+ต้านสถานะ และกันตายให้คุณ (HP ต่ำสุด 1) / เหลือแค่คู่พันธมิตรบนสนามแล้วคงพันธมิตร = ชนะทั้งคู่</div>
          <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-2">❌ <b>ปฏิเสธ</b> — ริดดี้เดินเส้นทางเดี่ยว: โจมตีใส่คุณแรงขึ้น +1 และถ้าคุณโจมตีเขา (หรือไม่โจมตีครบ 3 เทิร์น) NT-D จะทำงานฟรี — ไม่ตอบก่อนเปิดไพ่ = ปฏิเสธ</div>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-3">
          <Button variant="gold" className="py-3" onClick={() => { clickSound(); onAnswer(true); }}>✅ ตอบรับ</Button>
          <Button variant="ghost" className="py-3" onClick={() => { clickSound(); onAnswer(false); }}>❌ ปฏิเสธ</Button>
        </div>
      </div>
    </div>
  );
}
// ถูกคู่พันธมิตรโจมตี: เลือกยกเลิกพันธมิตร (ฟื้นสิ่งที่เสียคืน) หรือให้อภัย (คงพันธมิตร)
function AllyBreakModal({ ask, onAnswer }) {
  return (
    <div className="fixed inset-0 z-40 bg-black/70 grid place-items-center p-4">
      <div className="bg-echo-navy rounded-2xl p-5 max-w-md w-full shadow-2xl border-2" style={{ borderColor: ask.color }}>
        <div className="flex items-center gap-3 mb-3">
          <img src={ask.img} alt="" className="w-16 h-16 object-cover rounded-xl shrink-0" />
          <div>
            <div className="text-lg font-black text-echo-hp">💥 ถูกคู่พันธมิตรโจมตี!</div>
            <div className="text-sm opacity-80"><span className="font-bold" style={{ color: ask.color }}>{ask.from}</span> โจมตีใส่คุณ (เสียเลือด {ask.hp} เกราะ {ask.armor}) — ยกเลิกพันธมิตรไหม?</div>
          </div>
        </div>
        <div className="flex flex-col gap-2 text-sm">
          <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-2">💔 <b>ยกเลิกพันธมิตร</b> — ฟื้นพลังชีวิต/เกราะที่เสียไปจากการโดนคู่ตีคืน และริดดี้กลับสู่เส้นทางเดี่ยว</div>
          <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-2">🤝 <b>ให้อภัย</b> — คงพันธมิตรต่อไป (ไม่ตอบก่อนเปิดไพ่ = คงพันธมิตร)</div>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-3">
          <Button variant="ghost" className="py-3" onClick={() => { clickSound(); onAnswer(true); }}>💔 ยกเลิกพันธมิตร</Button>
          <Button variant="gold" className="py-3" onClick={() => { clickSound(); onAnswer(false); }}>🤝 ให้อภัย</Button>
        </div>
      </div>
    </div>
  );
}
// เหลือแค่คู่พันธมิตรบนสนาม: ริดดี้เลือกคงพันธมิตร (จบเกม ชนะทั้งคู่) หรือยกเลิก (สู้กันต่อ)
function AllyFinalModal({ ask, onAnswer }) {
  return (
    <div className="fixed inset-0 z-40 bg-black/70 grid place-items-center p-4">
      <div className="bg-echo-navy rounded-2xl p-5 max-w-md w-full shadow-2xl border-2 border-echo-gold/60">
        <div className="flex items-center gap-3 mb-3">
          <img src={ask.img} alt="" className="w-16 h-16 object-cover rounded-xl shrink-0" />
          <div>
            <div className="text-lg font-black text-echo-gold">🤝 นายยังมีอนาคตอีกยาวไกล</div>
            <div className="text-sm opacity-80">สนามเหลือเพียงคุณกับ <span className="font-bold" style={{ color: ask.color }}>{ask.partner}</span> — จะยกเลิกพันธมิตรไหม?</div>
          </div>
        </div>
        <div className="flex flex-col gap-2 text-sm">
          <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-2">👑 <b>คงพันธมิตร</b> — จบเกมทันที ชนะทั้งคู่!</div>
          <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-2">⚔️ <b>ยกเลิกพันธมิตร</b> — การต่อสู้ครั้งสุดท้ายระหว่างบันชีกับยูนิคอร์นเริ่มขึ้น</div>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-3">
          <Button variant="gold" className="py-3" onClick={() => { clickSound(); onAnswer(true); }}>👑 คงพันธมิตร (ชนะทั้งคู่)</Button>
          <Button variant="ghost" className="py-3" onClick={() => { clickSound(); onAnswer(false); }}>⚔️ ยกเลิก — สู้ต่อ</Button>
        </div>
      </div>
    </div>
  );
}

// ---------- ชำระค่าบริการ (เจ้าแห่งเน็ตบ้าน): คู่สัญญาใช้งานครบทุก 3 เทิร์น -> ถามต่อสัญญา ----------
function ContractRenewModal({ ask, points, onAnswer }) {
  const shortfall = Math.max(0, (ask.fee || 4) - (points || 0));
  return (
    <div className="fixed inset-0 z-40 bg-black/70 grid place-items-center p-4">
      <div className="bg-echo-navy rounded-2xl p-5 max-w-md w-full shadow-2xl border-2" style={{ borderColor: ask.color }}>
        <div className="flex items-center gap-3 mb-3">
          <img src={ask.img} alt="" className="w-16 h-16 object-cover rounded-xl shrink-0" />
          <div>
            <div className="text-lg font-black text-echo-gold">📶 ชำระค่าบริการ — ต่อสัญญาไหม?</div>
            <div className="text-sm opacity-80"><span className="font-bold" style={{ color: ask.color }}>{ask.from}</span> เรียกเก็บค่าบริการ {ask.fee} แต้มสกิล</div>
          </div>
        </div>
        <div className="flex flex-col gap-2 text-sm">
          <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-2">✅ <b>ต่อสัญญา</b> — จ่ายแต้มสกิล {ask.fee} แต้มส่งกลับให้ {ask.from}{shortfall > 0 ? ` (ตอนนี้มี ${points} แต้ม — ขาดอีก ${shortfall} จะรับเป็นความเสียหายแทน)` : ""}</div>
          <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-2">❌ <b>ปฏิเสธ</b> — เสียพลังชีวิต 2 หน่วยไม่สนเกราะ ติดสถานะ "ไม่ใช้งานต่อ" (ฟื้นเลือดตัวเองไม่ได้ 1 เทิร์น) และสัญญาสิ้นสุด — ไม่ตอบก่อนเปิดไพ่ = ปฏิเสธ</div>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-3">
          <Button variant="gold" className="py-3" onClick={() => { clickSound(); onAnswer(true); }}>✅ ต่อสัญญา</Button>
          <Button variant="ghost" className="py-3" onClick={() => { clickSound(); onAnswer(false); }}>❌ ปฏิเสธ</Button>
        </div>
      </div>
    </div>
  );
}

// ช่องสกิลเป็นรูป (คลิกใช้ระหว่างเฟสไพ่) — cost = แต้มที่ใช้จริง (เวลาทองแกมเบลอร์ลดครึ่ง)
function SkillSlot({ label, tier, skill, points, disabled, onUse, ammo, cost }) {
  const [broken, setBroken] = useState(false);
  const hasAmmo = skill && skill.ammo != null;
  const ammoLeft = hasAmmo ? (ammo ?? skill.ammo) : null;
  const outOfAmmo = hasAmmo && ammoLeft <= 0;
  const useCost = skill ? (cost ?? skill.cost) : 0;
  const afford = skill && points >= useCost;
  const usable = skill && !disabled && afford && !outOfAmmo;
  return (
    <div className="flex flex-col items-center gap-1">
      <button
        disabled={!usable}
        onClick={() => usable && onUse(tier)}
        title={skill ? `${skill.name} — ${skill.desc}` : ""}
        className={`relative w-full h-20 sm:h-24 rounded-2xl overflow-hidden bg-gray-300 shadow-lg transition ${
          usable ? "hover:scale-105 ring-2 ring-echo-gold" : "opacity-70 cursor-not-allowed grayscale"
        }`}
      >
        {skill && skill.img && !broken ? (
          <img src={skill.img} alt="" className="absolute inset-0 w-full h-full object-cover" onError={() => setBroken(true)} />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-gray-500 text-3xl">✦</div>
        )}
        {skill && (
          <span className={`absolute top-1 right-1 text-xs font-bold rounded px-1.5 ${useCost < skill.cost ? "bg-echo-gold text-gray-900" : "bg-black/60 text-white"}`}>
            {useCost}
          </span>
        )}
        {hasAmmo && (
          <span className="absolute bottom-1 left-1 right-1 flex items-center justify-center gap-0.5 bg-black/55 rounded px-1 py-0.5">
            {Array.from({ length: skill.ammo }, (_, i) => (
              <span key={i} className={`w-2 h-2.5 rounded-[2px] ${i < ammoLeft ? "bg-echo-cyan shadow-[0_0_4px] shadow-echo-cyan" : "bg-white/25"}`} />
            ))}
          </span>
        )}
      </button>
      <div className="text-sm sm:text-base font-bold text-center leading-tight">
        {label}{hasAmmo && <span className="text-echo-cyan"> · {ammoLeft}/{skill.ammo}</span>}
      </div>
    </div>
  );
}

// ---------- Bard : คีตกวี — ช่องประพันธ์เพลง (แทนที่ช่องท่าไม้ตาย) ----------
//  แสดงโน้ต ❤️/💚 ที่เติมไว้ 3 ช่อง — ครบ 3 บรรเลงทำนองเองแล้วล้างช่องเพื่อเริ่มบทเพลงใหม่
//  patch 2.1.2: จำกัด 2 โน้ตต่อเทิร์น — ระหว่างมิติมายาบรรเลง (โลหิต/วิญญาณ) กดได้สูงสุด 6 ครั้งต่อเทิร์น
function BardComposeSlot({ me }) {
  const notes = me.bardNotes || [];
  const dimOn = (me.statuses?.soulDim || 0) > 0 || (me.statuses?.bloodDim || 0) > 0;
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-full h-20 sm:h-24 rounded-2xl overflow-hidden bg-black/40 border-2 border-echo-gold/70 shadow-lg grid grid-cols-3 gap-1.5 p-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`rounded-xl grid place-items-center text-2xl sm:text-3xl border ${
              notes[i] ? "bg-white/15 border-echo-gold/70 pop-in" : "bg-white/5 border-white/15"
            }`}
          >
            {notes[i] === "R" ? "❤️" : notes[i] === "J" ? "💚" : <span className="opacity-25">♪</span>}
          </div>
        ))}
      </div>
      <div className="text-sm sm:text-base font-bold text-center leading-tight">
        {dimOn ? `ประพันธ์เพลง · มิติมายาบรรเลง โน้ต ${me.bardNotesUsed || 0}/6` : `ประพันธ์เพลง · โน้ต ${me.bardNotesUsed || 0}/2 เทิร์นนี้`}
      </div>
    </div>
  );
}

export default function Game({ state, lowQ }) {
  const [skillOpen, setSkillOpen] = useState(false);
  const [showChar, setShowChar] = useState(false);
  const [flash, setFlash] = useState(null); // สกิลช่วงจั่วการ์ด เด้งทันทีบนกระดาน
  const [notice, setNotice] = useState(null); // แปลงร่างซ้ำ (ครั้งที่ 2 เป็นต้นไป) เด้งแจ้งเตือนทันที ไม่หยุดเกม
  const [anataSel, setAnataSel] = useState(null); // เทมาริ: โหมดเลือกเป้าหมาย ANATA WAAAAAAAA (null = ไม่ได้เลือกอยู่)
  const [dawnSel, setDawnSel] = useState(false); // โอเบรอน: โหมดเลือกเป้าหมายรุ่งอรุณแห่งวันใหม่ (เลือกตัวเองได้)
  const [bgSel, setBgSel] = useState(false); // บานาจ: โหมดเลือกเป้าหมาย Absorb shield (เลือกตัวเองได้)
  const [nightSel, setNightSel] = useState(false); // โอเบรอน: โหมดเลือกเป้าหมายฝันร้ายยามค่ำคืน (เลือกตัวเองไม่ได้)
  const [kawaiiSel, setKawaiiSel] = useState(false); // โคโตเนะ (patch 2.1.3): โหมดเลือกเป้าหมาย Sekai ichi kawaii watashi (เลือกตัวเองไม่ได้)
  const [appleOpen, setAppleOpen] = useState(false); // Apple guy: เมนูเลือกของส่งมอบ (สกิลพื้นฐาน)
  const [tohnoOpen, setTohnoOpen] = useState(false); // โทโนะ ชิกิ: เมนูเลือกระดับมีดพับประจำตระกูล (สกิลพื้นฐาน)
  const [aquaOpen, setAquaOpen] = useState(false);   // อควาเรียน: เมนูเลือกผู้นำ (สกิลพื้นฐาน)
  const [appleSel, setAppleSel] = useState(false);   // Apple guy: โหมดเลือกเป้าหมายเอาไปสิ (เลือกตัวเองไม่ได้)
  const [bbSel, setBbSel] = useState(false);         // เจ้าแห่งเน็ตบ้าน: โหมดเลือกเป้าหมายยื่นข้อเสนอสัญญา
  const [shSel, setShSel] = useState(false);         // ชเรด เอลัน: โหมดเลือกเป้าหมายแสงจันทร์ส่องวิญญาณ (เลือกตัวเองไม่ได้)
  const [skSel, setSkSel] = useState(false);         // ชิกิ: โหมดเลือกเป้าหมาย นายมีฝีมือแค่ไหนหรอ? (เลือกตัวเองไม่ได้)
  const [saObSel, setSaObSel] = useState(false);     // ซาโตรุ: โหมดเลือกเป้าหมาย Obla Di, Obla Da (เลือกตัวเองไม่ได้)
  const [saLocaSel, setSaLocaSel] = useState(false); // ซาโตรุ: โหมดเลือกเป้าหมาย Locacaca fruit (เลือกตัวเองได้)
  const [bardSel, setBardSel] = useState([]);        // Bard: เป้าหมายบทเพลงที่เลือกไว้ (บทเพลงต้องการ 1-2 คน)
  const [cycleFx, setCycleFx] = useState(null); // แบนเนอร์สลับกลางวัน/กลางคืน
  const prevCycle = useRef(null);
  const [reijuOpen, setReijuOpen] = useState(false); // ฟุจิมารุ: เมนูเลือกคำสั่งเรจูอาคมบัญชา
  const [statusViewId, setStatusViewId] = useState(null); // ดูสถานะผู้เล่นคนอื่น (แตะการ์ดตอนไม่ได้เลือกเป้า)
  const vp = useViewport();
  const phase = state.gameState;
  const me = state.players.find((p) => p.id === state.youId);
  const others = state.players.filter((p) => p.id !== state.youId);
  const slots = SLOTS[Math.min(others.length, 5)] || [];
  const iAmAttacker = phase === "ATTACK" && state.attackerId === state.youId;
  const attacker = state.players.find((p) => p.id === state.attackerId);
  const winner = state.players.find((p) => p.id === state.winnerId);
  const loser = state.players.find((p) => p.isLoser);
  const done = me && (me.locked || !me.alive);
  const ch = me?.character;
  // ผู้เล่นที่กำลังเปิดดูสถานะ (ข้อมูลสดจาก state ทุกครั้งที่ re-render)
  const statusView = statusViewId ? state.players.find((x) => x.id === statusViewId) : null;
  // Beat Mode (คุวากาตะ เลือด < 3): สกิลพื้นฐาน + ท่าไม้ตายใช้ไม่ได้
  const beatMe = !!(me && ch?.id === "kuwagata" && me.alive && me.hp < 3);
  // กลางวัน/กลางคืน (patch 1.7): สลับทุก 3 เทิร์น — โอเบรอนสลับร่าง/ท่าไม้ตายตามช่วงเวลา
  const nightNow = state.cycle === "night";
  // ท่าไม้ตายกำลังมีผลอยู่: กดซ้ำไม่ได้จนกว่าจะหมดเวลา (สวมเกราะราชันถาวร = กดซ้ำไม่ได้อีกเลย)
  //  โอเบรอน: กลางวันเช็ค lai / กลางคืนเช็ค vortigern
  // อควาเรียน: ท่าไม้ตายสลับตามร่างที่รวมอยู่ (โซล่า/มาร์/ลูน่า) หรือปีกแห่งสุริยัน (ไปยังพฤกษาแห่งชีวิต)
  const aquaUltStatusKey = (p) => {
    if (!p) return null;
    if ((p.statuses?.godwing || 0) > 0) return "godtree";
    if (p.fused && p.leader === "sirius") return "marssword";
    if (p.fused && p.leader === "rena") return "lunabow";
    if (p.fused && p.leader === "apollo") return "solarburst";
    return null;
  };
  // ริดดี้ (patch 2.0.9): ระหว่างเป็นพันธมิตร ท่าไม้ตายเป็นท่า 2 (riddheguard) — เส้นทางเดี่ยวเป็นท่า 1 (riddhentd)
  const riddheAlliedMe = ch?.id === "riddhe" && !!me?.allyId &&
    state.players.some((x) => x.id === me.allyId && x.alive && x.allyId === me.id);
  // บานาจ ลิงก์ (patch 2.1.2): มีริดดี้เป็นพันธมิตร
  const banagherAlliedMe = ch?.id === "banagher" && !!me?.allyId &&
    state.players.some((x) => x.id === me.allyId && x.alive && x.allyId === me.id);
  const ultStatusKey = ch?.id === "oberon" ? (nightNow ? "vortigern" : "lai")
    : ch?.id === "aquarion" ? aquaUltStatusKey(me)
    : ch?.id === "shiki" ? (me?.shikiUlt === "wither" ? "wither" : "deatheye")
    : ch?.id === "riddhe" ? (riddheAlliedMe ? "riddheguard" : "riddhentd")
    // บานาจ: ระหว่างร่าง Paradise ที่มีริดดี้เป็นพันธมิตร ปุ่มท่าไม้ตายกลายเป็นแสงที่ไม่อยู่เพียงลำพัง — กดซ้ำได้เรื่อยๆ (ไม่ล็อก)
    : ch?.id === "banagher" ? ((banagherAlliedMe && (me?.statuses?.paradise || 0) > 0) ? null : "paradise")
    : ULTIMATE_STATUS[ch?.id];
  const ultimateActive = !!(me && me.statuses && me.statuses[ultStatusKey]);
  // ไปยังพฤกษาแห่งชีวิต: กดปุ่มท่าไม้ตายซ้ำได้เพื่อยกเลิก แม้ล็อกอยู่ (server อนุญาตแม้ระหว่าง locked)
  const aquaCancelable = ch?.id === "aquarion" && !!me?.statuses?.godtree;
  // ท่าไม้ตายอควาเรียนใช้ไม่ได้จนกว่าจะรวมร่าง
  const aquaUltLocked = ch?.id === "aquarion" && !me?.fused;
  // MonsterLive (ฮิคารุ patch 2.1.3): ระหว่างมีผล ใช้สกิลรอง Ultlive Ultraman Ginga ไม่ได้
  const monsterMe = !!(me && ch?.id === "hikaru" && me.statuses?.monster);
  // Ginga Strium (ฮิคารุ patch 2.1.3): ต้องอยู่ในร่าง Ginga (สกิลรอง 1) และเป็นตอนกลางวันเท่านั้นถึงใช้ได้
  const hikaruUltLocked = ch?.id === "hikaru" && !((me?.statuses?.ginga || 0) > 0 && !nightNow);
  // Ohger Finish (คุวากาตะ): ต้องมีทั้งสวมเกราะราชัน และ ประกายเขี้ยวปฏิปักษ์ (+1 ความเสียหาย)
  const ohgerLocked = !!(me && ch?.id === "kuwagata" && !(me.statuses?.rachan && (me.beat || beatMe)));
  // Full Assault (บานาจ ลิงก์ patch 2.1.2): กดซ้ำไม่ได้จนกว่าผลจะหมด — ไม่มีผลตอนสกิลรองกลายเป็น Beam Magnum (ร่าง Paradise)
  const banagherAssaultLocked = !!(me && ch?.id === "banagher" && !((me.statuses?.paradise || 0) > 0) && (me.statuses?.fullassault || 0) > 0);
  // ห้ามจั่วการ์ดเพิ่มเทิร์นนี้ (ทงคัสสึ / กำไรเท่าตัวโว้ย)
  const noDraw = !!(me && me.statuses?.nodraw);
  // ห้ามใช้สกิลเทิร์นนี้ (โดนหอกลองกินัสปัก) — เรจูอาคมบัญชาไม่นับเป็นสกิล ใช้ได้ปกติ
  const noSkill = !!(me && me.statuses?.noskill);
  // ---------- แกมเบลอร์ ----------
  const isGambler = ch?.id === "gambler";
  const goldenOn = !!(me && me.statuses?.golden); // บัฟเวลาทอง 777 กำลังมีผล
  // เวลาทอง: กดสกิลพื้นฐานซ้ำได้ในเทิร์นเดียว จนกว่าจำนวนใช้/แต้มจะหมด + คอสพื้นฐาน/รองลดครึ่ง
  const gambleRepeat = isGambler && goldenOn && (me?.gamblerUses || 0) > 0;
  const halfCost = (s) => (s ? Math.ceil(s.cost / 2) : 0);
  // ---------- เอวา 13 ----------
  const isEva = ch?.id === "eva13";
  // หอกแห่งแคสเซียส: ต้องมีเกราะเหลือให้หัก
  const cassiusLocked = isEva && (me?.armor || 0) < 1;
  // Fourth Impact: ใช้ได้เมื่อสกิลติดตัว 3 ทำงาน (เลือด <= 3) เท่านั้น
  const fourthLocked = isEva && (me?.hp || 0) > 3;
  // ---------- ฟุจิมารุ ----------
  const isFuji = ch?.id === "fujimaru";
  const humanityOn = !!(me && me.statuses?.humanity); // Everything For Humanity กำลังมีผล
  // จอมเวทย์ฝึกหัด: กดได้ 3 ครั้งต่อเทิร์น (ยกเว้นกฎ 1 สกิลต่อเทิร์น เฉพาะกดซ้ำตัวมันเอง) — ใช้ไม่ได้ระหว่าง EFH
  const mageRepeat = isFuji && (me?.mageUses || 0) > 0 && (me?.mageUses || 0) < 3;
  const mageLocked = isFuji && (humanityOn || (me?.mageUses || 0) >= 3);
  // Mystic Code: ต้องเปิด EFH อยู่ + มีเกราะเหลือ
  const mysticLocked = isFuji && !(humanityOn && (me?.armor || 0) >= 1);
  // Everything For Humanity: ต้องมีเรจูอาคมบัญชาครบ 3
  const humanityLocked = isFuji && (me?.reiju || 0) < 3;
  // เรจูอาคมบัญชา (สกิลติดตัว): สั่งใช้ก่อนเปิดการ์ด ไม่นับเป็นการใช้สกิล
  const reijuUsable = !!(isFuji && phase === "PLAYING" && me?.alive && !done && (me?.reiju || 0) > 0);
  const useReiju = (cmd) => { socket.emit("useReiju", { command: cmd }); setReijuOpen(false); };
  // ---------- โอเบรอน ----------
  const isOberon = ch?.id === "oberon";
  // ม่านแห่งราตรี: กดซ้ำไม่ได้จนกว่าผลเพิ่มพลังโจมตีจะหมด
  const veilLocked = isOberon && !!me?.statuses?.veil;
  // ---------- Apple guy ----------
  const isApple = ch?.id === "appleguy"; // สกิลพื้นฐานไม่นับเป็นการใช้สกิลของเทิร์น (ใช้แล้วยังใช้สกิลอื่นได้)
  const isAquarion = ch?.id === "aquarion"; // เปลี่ยนหัวหน้า (สกิลพื้นฐาน) ไม่นับเป็นการใช้สกิลของเทิร์นเช่นกัน
  const isTohno = ch?.id === "tohno"; // มีดพับประจำตระกูล (สกิลพื้นฐาน) ไม่นับเป็นการใช้สกิลของเทิร์นเช่นกัน (กดเปลี่ยนระดับได้เรื่อยๆ)
  // ---------- เจ้าแห่งเน็ตบ้าน ----------
  const isBroadband = ch?.id === "broadband_man";
  const lanLocked = isBroadband && !me?.contractPartnerId;    // กระชากสายแลน: ใช้ได้ก็ต่อเมื่อมีคู่สัญญาแล้ว
  const offerLocked = isBroadband && !!me?.contractPartnerId; // สนใจใช้บริการเราไหม: ใช้ไม่ได้ระหว่างมีคู่สัญญา
  // ---------- ฟุจิตะ โคโตเนะ ----------
  const isKotone = ch?.id === "kotone";
  const overworkMe = !!(me && me.statuses?.overwork); // [โหมงานหนัก]: Part-time (กลางวัน)/Dance/ท่าไม้ตายใช้ไม่ได้ + แต้มสกิลแพงขึ้น 1
  const ktBasicLocked = isKotone && overworkMe && !nightNow; // โหมงานหนักตอนกลางวัน (patch 2.0.8.1: นำโดนโปรดิวเซอร์จับได้ออกแล้ว)
  const ktSecLocked = isKotone && (nightNow ? !!me?.statuses?.ksleep : (overworkMe || (me?.coins || 0) < 3)); // หลับอยู่แล้ว / โหมงานหนัก / coin ไม่ถึง 3 (patch 2.1.3)
  const ktUltLocked = isKotone && (overworkMe || nightNow || (me?.coins || 0) < 3);        // ท่าไม้ตายใช้ไม่ได้กลางคืน/โหมงานหนัก/coin ไม่ถึง 3
  const ktCost = (s) => (s ? s.cost + 1 : 0); // โหมงานหนัก: ใช้แต้มสกิลเพิ่มขึ้น 1
  // ---------- Bard : คีตกวี ----------
  const isBard = ch?.id === "bard";
  const bardPending = isBard && phase === "PLAYING" ? me?.bardPending : null; // บทเพลงรอเลือกเป้าหมาย
  const bardNeed = bardPending?.need || 0;
  // เติมโน้ตไม่ได้เมื่อ: มีบทเพลงรอเลือกเป้าหมาย / เติมโน้ตครบลิมิตของเทิร์นนี้แล้ว
  //  (patch 2.0.8 — ระหว่างมิติมายาบรรเลงทั้งสองแบบ ไม่ติดลิมิต 2 แต่กดได้สูงสุด 6 ครั้งต่อเทิร์น)
  const bardDimOn = isBard && ((me?.statuses?.soulDim || 0) > 0 || (me?.statuses?.bloodDim || 0) > 0);
  const bardNoteLocked = isBard && (!!me?.bardPending || (me?.bardNotesUsed || 0) >= (bardDimOn ? 6 : 2));
  // ---------- ชเรด เอลัน ----------
  const isShrade = ch?.id === "shrade_elan";
  // แด่เพื่อนรักของฉัน: ระหว่างชาร์จจั่วการ์ด/ใช้สกิลอื่นไม่ได้ (แต่ชนะจั่วยังโจมตีได้)
  const shCharging = !!(me && me.statuses?.shradecharge);
  // ---------- ริดดี้ มาร์เซนาส ----------
  // ฉันจะไม่ยอมสูญเสียใครไปอีก: ระหว่างทำงาน จั่วการ์ด/ใช้สกิลไม่ได้ (แม้ชนะจั่วก็โจมตีไม่ได้)
  const rgCharging = !!(me && me.statuses?.riddheguard);
  // ---------- ริต้า เบอร์นัล ----------
  // ไม่อยากให้ใครต้องเจ็บปวด: ระหว่างล่อเป้า จั่วการ์ด/ใช้สกิลไม่ได้ (แต่ชนะจั่วยังโจมตีได้)
  const phenexTaunting = !!(me && me.statuses?.phenexTaunt);
  // รวมร่างทำนองเพลง: ใช้ได้เฉพาะกลางคืน + ท่วงทำนองครบ 5 (หลังรวมร่างปุ่มเปลี่ยนเป็น แด่เพื่อนรักของฉัน)
  const shUltLocked = isShrade && !me?.shradeForm && (!nightNow || (me?.statuses?.melody || 0) < 5);
  // ---------- เรียวกิ ชิกิ ----------
  // นายมีฝีมือแค่ไหนหรอ?: ผลยกเลิกท่าไม้ตายยังอยู่ — กดสกิลรองซ้ำไม่ได้ (patch 2.0.6.1)
  const skSecLocked = ch?.id === "shiki" && !!me?.statuses?.godslay;
  // ANATA WAAAAAAAA: เลือกเป้าหมายได้เพียง 1 คน
  const aliveOthers = others.filter((p) => p.alive);
  const anataNeed = Math.min(1, aliveOthers.length);

  // สกิลช่วงจั่วการ์ด: server แจ้งมา -> เด้งทันที (ไม่ตัดเข้าจอดำ) แล้วหายเอง
  useEffect(() => {
    const onFlash = (f) => setFlash({ ...f, id: Date.now() });
    socket.on("skillFlash", onFlash);
    return () => socket.off("skillFlash", onFlash);
  }, []);
  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 1800);
    return () => clearTimeout(t);
  }, [flash]);
  useEffect(() => {
    const onNotice = (n) => setNotice({ ...n, id: Date.now() });
    socket.on("transformNotice", onNotice);
    return () => socket.off("transformNotice", onNotice);
  }, []);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 1800);
    return () => clearTimeout(t);
  }, [notice]);

  const skill = (tier) => {
    clickSound();
    // ท่าไม้ตายเทมาริ: เข้าโหมดเลือกเป้าหมาย 2 คนก่อน (ยังไม่ส่งไป server)
    if (tier === "ultimate" && ch?.id === "temari") { setAnataSel([]); setSkillOpen(false); return; }
    // สกิลรองโอเบรอน: เข้าโหมดเลือกเป้าหมาย 1 คนก่อนส่งไป server
    //  กลางวัน = รุ่งอรุณแห่งวันใหม่ (เลือกตัวเองได้) / กลางคืน = ฝันร้ายยามค่ำคืน (คนอื่นเท่านั้น)
    if (tier === "secondary" && ch?.id === "oberon") {
      if (nightNow) setNightSel(true); else setDawnSel(true);
      setSkillOpen(false);
      return;
    }
    // Apple guy: สกิลพื้นฐานเปิดเมนูเลือกของส่งมอบ / สกิลรองเข้าโหมดเลือกเป้าหมายมอบของ
    if (tier === "basic" && ch?.id === "appleguy") { setAppleOpen(true); setSkillOpen(false); return; }
    if (tier === "secondary" && ch?.id === "appleguy") { setAppleSel(true); setSkillOpen(false); return; }
    // อควาเรียน: สกิลพื้นฐานเปิดเมนูเลือกผู้นำ
    if (tier === "basic" && ch?.id === "aquarion") { setAquaOpen(true); setSkillOpen(false); return; }
    // โทโนะ ชิกิ: สกิลพื้นฐานเปิดเมนูเลือกระดับมีดพับประจำตระกูล (1-5)
    if (tier === "basic" && ch?.id === "tohno") { setTohnoOpen(true); setSkillOpen(false); return; }
    // เจ้าแห่งเน็ตบ้าน: ท่าไม้ตายเข้าโหมดเลือกเป้าหมายยื่นข้อเสนอสัญญา
    if (tier === "ultimate" && ch?.id === "broadband_man") { setBbSel(true); setSkillOpen(false); return; }
    // ชเรด เอลัน: สกิลรอง (แสงจันทร์ส่องวิญญาณ) เข้าโหมดเลือกเป้าหมายก่อนส่งไป server
    //  (Dance Lession โคโตเนะ ใช้ใส่ตัวเองเท่านั้นแล้ว — ไม่ต้องเลือกเป้าหมาย)
    if (tier === "secondary" && ch?.id === "shrade_elan") { setShSel(true); setSkillOpen(false); return; }
    // เรียวกิ ชิกิ: สกิลรอง (นายมีฝีมือแค่ไหนหรอ?) เข้าโหมดเลือกเป้าหมายก่อนส่งไป server
    if (tier === "secondary" && ch?.id === "shiki") { setSkSel(true); setSkillOpen(false); return; }
    // บานาจ ลิงก์ (patch 2.1.2): สกิลพื้นฐาน Absorb shield เข้าโหมดเลือกเป้าหมาย (เลือกตัวเองได้)
    if (tier === "basic" && ch?.id === "banagher") { setBgSel(true); setSkillOpen(false); return; }
    // ซาโตรุ อาเคฟุ: สกิลพื้นฐาน/สกิลรอง เข้าโหมดเลือกเป้าหมาย — ท่าไม้ตายทำงานอัตโนมัติ กดเองไม่ได้
    if (tier === "basic" && ch?.id === "satoru") { setSaObSel(true); setSkillOpen(false); return; }
    if (tier === "secondary" && ch?.id === "satoru") { setSaLocaSel(true); setSkillOpen(false); return; }
    if (tier === "ultimate" && ch?.id === "satoru") { setSkillOpen(false); return; }
    // ฟุจิตะ โคโตเนะ (patch 2.1.3): ท่าไม้ตาย Sekai ichi kawaii watashi เข้าโหมดเลือกเป้าหมาย (คนอื่นเท่านั้น)
    if (tier === "ultimate" && ch?.id === "kotone") { setKawaiiSel(true); setSkillOpen(false); return; }
    socket.emit("useSkill", { tier });
    setSkillOpen(false);
  };
  // เลือกเป้าหมาย Obla Di, Obla Da / Locacaca fruit (ซาโตรุ) -> ส่งไป server ทันที
  const pickSaOb = (id) => {
    socket.emit("useSkill", { tier: "basic", targets: [id] });
    setSaObSel(false);
  };
  const pickSaLoca = (id) => {
    socket.emit("useSkill", { tier: "secondary", targets: [id] });
    setSaLocaSel(false);
  };
  // เลือกเป้าหมายแสงจันทร์ส่องวิญญาณ (ชเรด เอลัน) -> ส่งไป server ทันที
  const pickSh = (id) => {
    socket.emit("useSkill", { tier: "secondary", targets: [id] });
    setShSel(false);
  };
  // เลือกเป้าหมาย นายมีฝีมือแค่ไหนหรอ? (ชิกิ) -> ส่งไป server ทันที
  const pickSk = (id) => {
    socket.emit("useSkill", { tier: "secondary", targets: [id] });
    setSkSel(false);
  };
  // เลือกเป้าหมายบทเพลง (Bard) — ครบจำนวนที่บทเพลงต้องการแล้วส่งไป server ทันที
  const pickBard = (id) => {
    if (!bardPending) return;
    const next = bardSel.includes(id) ? bardSel.filter((x) => x !== id) : [...bardSel, id];
    if (next.length >= bardNeed) {
      socket.emit("bardTarget", { targets: next });
      setBardSel([]);
    } else setBardSel(next);
  };
  // บทเพลงถูกยืนยัน/หมดเวลาแล้ว -> ล้างเป้าหมายที่เลือกค้าง
  useEffect(() => {
    if (!bardPending) setBardSel([]);
  }, [bardPending]);
  // เสียงประกอบ Bard: เติมโน้ตตามช่องที่ 1-3 / บรรเลงทำนอง (Crimson=1, Jade=2, Encore=3)
  useEffect(() => {
    const onBardSfx = (e) => {
      if (!e) return;
      if (e.kind === "note") playSfx(`bard_note${Math.min(3, Math.max(1, e.idx || 1))}`);
      else if (e.kind === "perform") playSfx(`bard_melody${Math.min(3, Math.max(1, e.sound || 1))}`);
    };
    socket.on("bardSfx", onBardSfx);
    return () => socket.off("bardSfx", onBardSfx);
  }, []);
  // เลือกเป้าหมายยื่นข้อเสนอสัญญา (สนใจใช้บริการเราไหม) -> ส่งไป server ทันที
  const pickBb = (id) => {
    socket.emit("useSkill", { tier: "ultimate", targets: [id] });
    setBbSel(false);
  };
  // เลือกของส่งมอบ (เอาแบบนี้ได้ไหม) -> ส่งไป server ทันที
  const pickAppleItem = (key) => {
    socket.emit("useSkill", { tier: "basic", item: key });
    setAppleOpen(false);
  };
  // เลือกระดับมีดพับประจำตระกูล (โทโนะ ชิกิ) -> ส่งไป server ทันที (ไม่ปิดเมนู — กดเปลี่ยนต่อได้เรื่อยๆ)
  const pickTohnoLevel = (level) => {
    socket.emit("useSkill", { tier: "basic", item: level });
  };
  // เลือกผู้นำ (เปลี่ยนหัวหน้า) -> ส่งไป server ทันที
  const pickAquaLeader = (key) => {
    socket.emit("useSkill", { tier: "basic", item: key });
    setAquaOpen(false);
  };
  // เลือกเป้าหมายมอบของ (เอาไปสิ) -> ส่งไป server ทันที
  const pickGive = (id) => {
    socket.emit("useSkill", { tier: "secondary", targets: [id] });
    setAppleSel(false);
  };
  // เลือกเป้าหมายรุ่งอรุณแห่งวันใหม่ / ฝันร้ายยามค่ำคืน -> ส่งไป server ทันที
  const pickDawn = (id) => {
    socket.emit("useSkill", { tier: "secondary", targets: [id] });
    setDawnSel(false);
  };
  // เลือกเป้าหมาย Absorb shield (บานาจ ลิงก์) -> ส่งไป server ทันที
  const pickBg = (id) => {
    socket.emit("useSkill", { tier: "basic", targets: [id] });
    setBgSel(false);
  };
  const pickNight = (id) => {
    socket.emit("useSkill", { tier: "secondary", targets: [id] });
    setNightSel(false);
  };
  // เลือกเป้าหมาย Sekai ichi kawaii watashi (โคโตเนะ patch 2.1.3) -> ส่งไป server ทันที
  const pickKawaii = (id) => {
    socket.emit("useSkill", { tier: "ultimate", targets: [id] });
    setKawaiiSel(false);
  };
  // เลือก/ยกเลิกเป้าหมาย ANATA — ครบจำนวนแล้วส่งไป server ทันที
  const pickAnata = (id) => {
    if (!anataSel) return;
    const next = anataSel.includes(id) ? anataSel.filter((x) => x !== id) : [...anataSel, id];
    if (next.length >= anataNeed) {
      socket.emit("useSkill", { tier: "ultimate", targets: next });
      setAnataSel(null);
    } else setAnataSel(next);
  };
  // ออกจากโหมดเลือกเป้าเมื่อพ้นช่วงจั่วการ์ด / ใช้สกิลไปแล้ว (server ยืนยัน)
  useEffect(() => {
    if (anataSel && (phase !== "PLAYING" || me?.skillUsed || done)) setAnataSel(null);
  }, [anataSel, phase, me?.skillUsed, done]);
  useEffect(() => {
    if (dawnSel && (phase !== "PLAYING" || me?.skillUsed || done)) setDawnSel(false);
  }, [dawnSel, phase, me?.skillUsed, done]);
  useEffect(() => {
    if (bgSel && (phase !== "PLAYING" || me?.skillUsed || done)) setBgSel(false);
  }, [bgSel, phase, me?.skillUsed, done]);
  useEffect(() => {
    if (nightSel && (phase !== "PLAYING" || me?.skillUsed || done)) setNightSel(false);
  }, [nightSel, phase, me?.skillUsed, done]);
  useEffect(() => {
    if (kawaiiSel && (phase !== "PLAYING" || me?.skillUsed || done)) setKawaiiSel(false);
  }, [kawaiiSel, phase, me?.skillUsed, done]);
  useEffect(() => {
    if (appleSel && (phase !== "PLAYING" || me?.skillUsed || done)) setAppleSel(false);
  }, [appleSel, phase, me?.skillUsed, done]);
  useEffect(() => {
    if (bbSel && (phase !== "PLAYING" || me?.skillUsed || done)) setBbSel(false);
  }, [bbSel, phase, me?.skillUsed, done]);
  useEffect(() => {
    if (shSel && (phase !== "PLAYING" || me?.skillUsed || done)) setShSel(false);
  }, [shSel, phase, me?.skillUsed, done]);
  useEffect(() => {
    if (skSel && (phase !== "PLAYING" || me?.skillUsed || done)) setSkSel(false);
  }, [skSel, phase, me?.skillUsed, done]);
  useEffect(() => {
    if (saObSel && (phase !== "PLAYING" || me?.skillUsed || done)) setSaObSel(false);
  }, [saObSel, phase, me?.skillUsed, done]);
  useEffect(() => {
    if (saLocaSel && (phase !== "PLAYING" || me?.skillUsed || done)) setSaLocaSel(false);
  }, [saLocaSel, phase, me?.skillUsed, done]);
  useEffect(() => {
    if (appleOpen && (phase !== "PLAYING" || done)) setAppleOpen(false);
  }, [appleOpen, phase, done]);
  useEffect(() => {
    if (aquaOpen && (phase !== "PLAYING" || done)) setAquaOpen(false);
  }, [aquaOpen, phase, done]);
  useEffect(() => {
    if (tohnoOpen && (phase !== "PLAYING" || done)) setTohnoOpen(false);
  }, [tohnoOpen, phase, done]);
  // แบนเนอร์สลับกลางวัน/กลางคืน: เด้งเมื่อ cycle เปลี่ยนระหว่างแมตช์ แล้วหายเอง
  useEffect(() => {
    if (prevCycle.current && state.cycle && prevCycle.current !== state.cycle) {
      setCycleFx({ cycle: state.cycle, id: Date.now() });
    }
    prevCycle.current = state.cycle;
  }, [state.cycle]);
  // ราตรีกลืนกิน: เด้งแบนเนอร์เมื่อโอเบรอนใช้ท่าไม้ตาย 2 (ฉากหลังเปลี่ยน) แล้วหายเอง
  const prevDevour = useRef(false);
  useEffect(() => {
    if (!prevDevour.current && state.oberonBg) setCycleFx({ cycle: "night", oberon: true, id: Date.now() });
    prevDevour.current = !!state.oberonBg;
  }, [state.oberonBg]);
  useEffect(() => {
    if (!cycleFx) return;
    // ระหว่าง CUTSCENE แบนเนอร์ยังไม่ถูกแสดง (จอวีดีโอเต็มจอ) — รอวีดีโอจบก่อนค่อยเริ่มนับถอยหลัง
    if (phase === "CUTSCENE") return;
    const t = setTimeout(() => setCycleFx(null), 3500);
    return () => clearTimeout(t);
  }, [cycleFx, phase]);
  // ปิดเมนูเรจูอาคมบัญชาอัตโนมัติเมื่อใช้ไม่ได้แล้ว (พ้นช่วงจั่วการ์ด / เส้นหมด)
  useEffect(() => {
    if (reijuOpen && !reijuUsable) setReijuOpen(false);
  }, [reijuOpen, reijuUsable]);

  // เฟส CUTSCENE: วีดีโอ/แบนเนอร์แปลงร่าง (key=id -> remount กันจอดำ)
  //  ยกเว้นฉากประกาศเปลี่ยนร่าง (announce) -> แสดงกระดานเกมตามปกติ + เอฟเฟกต์ทับ (ไม่ตัดจอดำ)
  //  โหมดประหยัด (patch 2.0.6): ข้ามวีดีโอ — แสดงกระดาน + แจ้งเตือนว่าใครเปิดท่าไม้ตาย รอเวลาเท่าวีดีโอจริง
  const csAnnounce = phase === "CUTSCENE" && state.cutscene && state.cutscene.announce ? state.cutscene : null;
  const csSkipped = lowQ && phase === "CUTSCENE" && state.cutscene && !csAnnounce ? state.cutscene : null;
  if (phase === "CUTSCENE" && state.cutscene && !csAnnounce && !lowQ) return <Cutscene key={state.cutscene.id} cs={state.cutscene} />;

  // ============================================================
  //  โหมดมือถือแนวตั้ง (< 768px): layout เฉพาะโทรศัพท์ ไม่ย่อจากจอคอม
  //  บน = การ์ดคู่ต่อสู้ (แตะเพื่อโจมตี) | ล่าง = แผงเรา + ปุ่มใหญ่เต็มนิ้ว
  // ============================================================
  if (vp.w < 768) {
    const revealed = phase === "SUMMARY" || phase === "ATTACK" || phase === "ATTACKING";
    return (
      <div className="fixed inset-0 overflow-hidden flex flex-col">
        <GameBackground cycle={state.cycle} oberonBg={state.oberonBg} godtreeBg={state.godtreeBg} shradeBg={state.shradeBg} bardBg={state.bardBg} shikiBg={state.shikiBg} />
        {/* แถบบน: รอบ + เวลา (เว้นขวาให้ปุ่มเสียง) */}
        <div className="shrink-0 flex flex-col items-center gap-1 pt-2 px-14 min-h-[40px]">
          {(phase === "PLAYING" || phase === "ATTACK") && (
            <div className="text-lg font-bold bg-black/50 px-5 py-1 rounded-full border border-white/10">
              {state.oberonBg ? "🌑" : nightNow ? "🌙" : "☀️"} รอบที่ {state.roundNumber} · ⏱️ {state.timeLeft} วิ
            </div>
          )}
          {state.oberonBg && (
            <div className="text-sm font-black text-indigo-300 bg-black/60 px-4 py-0.5 rounded-full border border-indigo-400/40 text-hard">🌑 ราตรีกลืนกิน</div>
          )}
        </div>

        {/* คู่ต่อสู้: การ์ดกริด (แตะการ์ดเพื่อโจมตีตอนเป็นผู้ชนะ) */}
        <div className={`shrink-0 max-h-[36vh] overflow-y-auto grid gap-2 px-2 pt-2 ${others.length <= 1 ? "grid-cols-1 max-w-sm w-full mx-auto" : "grid-cols-2"}`}>
          {others.map((p) => (
            <MobileOpponent
              key={p.id}
              p={p}
              phase={phase}
              targetable={((iAmAttacker && !p.statuses?.seal) || !!anataSel || dawnSel || nightSel || appleSel || bbSel || shSel || skSel || saObSel || saLocaSel || bgSel || kawaiiSel || !!bardPending) && p.alive}
              picked={!!anataSel && anataSel.includes(p.id)}
              onAttack={(id) => (anataSel ? pickAnata(id) : dawnSel ? pickDawn(id) : nightSel ? pickNight(id) : appleSel ? pickGive(id) : bbSel ? pickBb(id) : shSel ? pickSh(id) : skSel ? pickSk(id) : saObSel ? pickSaOb(id) : saLocaSel ? pickSaLoca(id) : bgSel ? pickBg(id) : kawaiiSel ? pickKawaii(id) : bardPending ? pickBard(id) : socket.emit("attack", { targetId: id }))}
              onInspect={setStatusViewId}
            />
          ))}
        </div>
        {iAmAttacker && (
          <div className="shrink-0 text-center mt-1.5 text-lg font-black text-echo-gold animate-pulse text-hard">
            ⚔️ แตะการ์ดคู่ต่อสู้เพื่อโจมตี!
          </div>
        )}
        {anataSel && (
          <div className="shrink-0 text-center mt-1.5 text-hard">
            <span className="text-lg font-black text-echo-gold animate-pulse">🎤 แตะเลือกเป้าหมาย ANATA ({anataSel.length}/{anataNeed})</span>
            <button onClick={() => { clickSound(); setAnataSel(null); }} className="ml-3 text-sm font-bold bg-black/60 rounded-full px-3 py-1 border border-white/30">ยกเลิก</button>
          </div>
        )}
        {dawnSel && (
          <div className="shrink-0 text-center mt-1.5 text-hard">
            <span className="text-lg font-black text-echo-gold animate-pulse">🌄 แตะเลือกเป้าหมายรุ่งอรุณแห่งวันใหม่</span>
            <button onClick={() => { clickSound(); pickDawn(me.id); }} className="ml-3 text-sm font-bold bg-echo-gold text-gray-900 rounded-full px-3 py-1">เลือกตัวเอง</button>
            <button onClick={() => { clickSound(); setDawnSel(false); }} className="ml-2 text-sm font-bold bg-black/60 rounded-full px-3 py-1 border border-white/30">ยกเลิก</button>
          </div>
        )}
        {bgSel && (
          <div className="shrink-0 text-center mt-1.5 text-hard">
            <span className="text-lg font-black text-echo-gold animate-pulse">🛡️ แตะเลือกเป้าหมาย Absorb shield</span>
            <button onClick={() => { clickSound(); pickBg(me.id); }} className="ml-3 text-sm font-bold bg-echo-gold text-gray-900 rounded-full px-3 py-1">เลือกตัวเอง</button>
            <button onClick={() => { clickSound(); setBgSel(false); }} className="ml-2 text-sm font-bold bg-black/60 rounded-full px-3 py-1 border border-white/30">ยกเลิก</button>
          </div>
        )}
        {nightSel && (
          <div className="shrink-0 text-center mt-1.5 text-hard">
            <span className="text-lg font-black text-echo-magenta animate-pulse">🌘 แตะเลือกเป้าหมายฝันร้ายยามค่ำคืน</span>
            <button onClick={() => { clickSound(); setNightSel(false); }} className="ml-2 text-sm font-bold bg-black/60 rounded-full px-3 py-1 border border-white/30">ยกเลิก</button>
          </div>
        )}
        {kawaiiSel && (
          <div className="shrink-0 text-center mt-1.5 text-hard">
            <span className="text-lg font-black text-echo-magenta animate-pulse">💖 แตะเลือกเป้าหมาย Sekai ichi kawaii watashi</span>
            <button onClick={() => { clickSound(); setKawaiiSel(false); }} className="ml-2 text-sm font-bold bg-black/60 rounded-full px-3 py-1 border border-white/30">ยกเลิก</button>
          </div>
        )}
        {appleSel && (
          <div className="shrink-0 text-center mt-1.5 text-hard">
            <span className="text-lg font-black text-echo-gold animate-pulse">🎁 แตะเลือกเป้าหมายเอาไปสิ — มอบ{APPLE_ITEM_NAME[me?.appleItem] || "ของ"}</span>
            <button onClick={() => { clickSound(); setAppleSel(false); }} className="ml-2 text-sm font-bold bg-black/60 rounded-full px-3 py-1 border border-white/30">ยกเลิก</button>
          </div>
        )}
        {bbSel && (
          <div className="shrink-0 text-center mt-1.5 text-hard">
            <span className="text-lg font-black text-echo-cyan animate-pulse">📶 แตะเลือกเป้าหมายยื่นข้อเสนอสัญญา</span>
            <button onClick={() => { clickSound(); setBbSel(false); }} className="ml-2 text-sm font-bold bg-black/60 rounded-full px-3 py-1 border border-white/30">ยกเลิก</button>
          </div>
        )}
        {shSel && (
          <div className="shrink-0 text-center mt-1.5 text-hard">
            <span className="text-lg font-black text-echo-cyan animate-pulse">🌕 แตะเลือกเป้าหมายแสงจันทร์ส่องวิญญาณ</span>
            <button onClick={() => { clickSound(); setShSel(false); }} className="ml-2 text-sm font-bold bg-black/60 rounded-full px-3 py-1 border border-white/30">ยกเลิก</button>
          </div>
        )}
        {skSel && (
          <div className="shrink-0 text-center mt-1.5 text-hard">
            <span className="text-lg font-black text-echo-hp animate-pulse">🔪 แตะเลือกเป้าหมาย นายมีฝีมือแค่ไหนหรอ?</span>
            <button onClick={() => { clickSound(); setSkSel(false); }} className="ml-2 text-sm font-bold bg-black/60 rounded-full px-3 py-1 border border-white/30">ยกเลิก</button>
          </div>
        )}
        {saObSel && (
          <div className="shrink-0 text-center mt-1.5 text-hard">
            <span className="text-lg font-black text-echo-hp animate-pulse">🎵 แตะเลือกเป้าหมาย Obla Di, Obla Da</span>
            <button onClick={() => { clickSound(); setSaObSel(false); }} className="ml-2 text-sm font-bold bg-black/60 rounded-full px-3 py-1 border border-white/30">ยกเลิก</button>
          </div>
        )}
        {saLocaSel && (
          <div className="shrink-0 text-center mt-1.5 text-hard">
            <span className="text-lg font-black text-echo-gold animate-pulse">🍑 แตะเลือกเป้าหมาย Locacaca fruit</span>
            <button onClick={() => { clickSound(); pickSaLoca(me.id); }} className="ml-3 text-sm font-bold bg-echo-gold text-gray-900 rounded-full px-3 py-1">กินเอง</button>
            <button onClick={() => { clickSound(); setSaLocaSel(false); }} className="ml-2 text-sm font-bold bg-black/60 rounded-full px-3 py-1 border border-white/30">ยกเลิก</button>
          </div>
        )}
        {bardPending && (
          <div className="shrink-0 text-center mt-1.5 text-hard">
            <span className="text-lg font-black text-echo-gold animate-pulse">🎼 แตะเลือกเป้าหมาย {bardPending.name} ({bardSel.length}/{bardNeed})</span>
            {bardPending.allowSelf && (
              <button onClick={() => { clickSound(); pickBard(me.id); }} className="ml-3 text-sm font-bold bg-echo-gold text-gray-900 rounded-full px-3 py-1">เลือกตัวเอง</button>
            )}
          </div>
        )}

        {/* กลางจอ: โลโก้ */}
        <div className="flex-1 min-h-0 grid place-items-center pointer-events-none">
          <h1 className="glitch text-5xl font-black opacity-50" data-text="ECHO">ECHO</h1>
        </div>

        {/* ---------- แผงตัวเรา (ล่างสุด กดง่ายด้วยนิ้วโป้ง) ---------- */}
        {me && (
          <div className="shrink-0 px-2 pb-2">
            <div className="rounded-3xl p-3 shadow-2xl" style={{ background: "linear-gradient(135deg,#7a2230,#a3283a)" }}>
              {/* แถวบน: รูปเรา | การ์ด/แต้ม | กล่องแต้มรวม */}
              <div className="flex items-center gap-2">
                <button onClick={() => { clickSound(); setShowChar(true); }} className="relative shrink-0" title="รายละเอียดตัวละคร">
                  <Portrait p={me} className="w-14 h-16 border-2" rounded="rounded-xl" />
                  <div className="absolute inset-0 rounded-xl border-2 pointer-events-none" style={{ borderColor: me.color }} />
                  <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 text-[10px] font-bold bg-black/75 rounded-full px-1.5 leading-tight whitespace-nowrap">ℹ️ ข้อมูล</span>
                </button>
                {isFuji && <ReijuButton me={me} usable={reijuUsable} onOpen={() => setReijuOpen(true)} className="w-14 h-16 shrink-0" />}
                <div className="flex-1 min-w-0 flex items-center overflow-x-auto min-h-[56px]">
                  {revealed ? (
                    <div className="text-3xl font-black">
                      {me.busted ? <span className="text-echo-hp">แตก!</span> : <>แต้ม <span className="text-echo-gold">{me.score}</span></>}
                    </div>
                  ) : (
                    me.cards && me.cards.map((c, i) => <Card key={i} value={c.value} size="sm" />)
                  )}
                </div>
                <div className="rounded-xl bg-echo-gold text-gray-900 px-3 py-1 text-center font-black shadow-lg shrink-0">
                  <div className="text-[10px] leading-none">แต้มรวม</div>
                  <div className="text-2xl leading-tight">{me.score != null ? me.score : "?"}</div>
                </div>
              </div>
              <div className="h-1.5 rounded-full bg-black/30 overflow-hidden mt-1.5">
                <div className="h-full transition-all" style={{ width: `${Math.min(100, ((me.score || 0) / 21) * 100)}%`, background: me.busted ? "#c0392b" : "#fff" }} />
              </div>

              {/* พลังชีวิต + เกราะ (บรรทัดเดียวเสมอ) + สถานะ + หลอดสกิล */}
              <div className="flex items-center flex-wrap gap-x-2 gap-y-1 mt-2">
                <LifeBar p={me} />
                <StatusChips p={me} left />
                <span className="ml-auto flex items-center gap-1.5">
                  <span className="flex gap-1 p-1 rounded-lg bg-black/25">
                    {Array.from({ length: me.maxSkill }, (_, i) => (
                      <span key={i} className={`w-4 h-4 rounded ${i < me.skillPoints ? "bg-gradient-to-b from-yellow-200 to-echo-gold shadow-[0_0_6px] shadow-echo-gold" : "bg-white/10 border border-white/25"}`} />
                    ))}
                  </span>
                  <span className="text-sm font-black whitespace-nowrap">{me.skillPoints}/{me.maxSkill}</span>
                </span>
              </div>

              {/* ช่องสกิล 3 อัน (ใช้ได้ 1 สกิลต่อเทิร์น) */}
              <div className="grid grid-cols-3 gap-2 mt-2">
                <SkillSlot label="สกิลพื้นฐาน" tier="basic" skill={ch?.basic} points={me.skillPoints} disabled={done || phase !== "PLAYING" || noSkill || beatMe || shCharging || rgCharging || phenexTaunting || bardNoteLocked || (me.skillUsed && !mageRepeat && !gambleRepeat && !isApple && !isAquarion && !isBard && !isTohno) || mageLocked || cassiusLocked || veilLocked || ktBasicLocked} onUse={skill} ammo={isGambler ? me.gamblerUses : me.puddingUses} cost={isGambler && goldenOn ? halfCost(ch?.basic) : isKotone && overworkMe ? ktCost(ch?.basic) : undefined} />
                <SkillSlot label="สกิลรอง" tier="secondary" skill={ch?.secondary} points={me.skillPoints} disabled={done || phase !== "PLAYING" || noSkill || (me.skillUsed && !isBard) || shCharging || rgCharging || phenexTaunting || bardNoteLocked || ohgerLocked || mysticLocked || lanLocked || ktSecLocked || skSecLocked || banagherAssaultLocked || monsterMe} onUse={skill} ammo={isApple ? me.appleGiveUses : me.beamAmmo} cost={isGambler && goldenOn ? halfCost(ch?.secondary) : isKotone && overworkMe ? ktCost(ch?.secondary) : undefined} />
                {isBard ? <BardComposeSlot me={me} /> : <SkillSlot label="ท่าไม้ตาย" tier="ultimate" skill={ch?.ultimate} points={me.skillPoints} disabled={aquaCancelable ? false : (done || phase !== "PLAYING" || noSkill || beatMe || me.skillUsed || ultimateActive || humanityLocked || fourthLocked || offerLocked || ktUltLocked || aquaUltLocked || shUltLocked || shCharging || rgCharging || phenexTaunting || hikaruUltLocked)} onUse={skill} />}
              </div>
              {noSkill && phase === "PLAYING" && !done && (
                <div className="text-center text-sm font-bold text-echo-hp mt-1">🗡️ โดนหอกลองกินัสปัก — เทิร์นนี้ใช้สกิลไม่ได้</div>
              )}
              {rgCharging && phase === "PLAYING" && !done && (
                <div className="text-center text-sm font-bold text-echo-hp mt-1">🛡️ ฉันจะไม่ยอมสูญเสียใครไปอีก — จั่ว/ใช้สกิล/โจมตีไม่ได้ระหว่างท่าทำงาน</div>
              )}
              {phenexTaunting && phase === "PLAYING" && !done && (
                <div className="text-center text-sm font-bold text-echo-hp mt-1">🥺 ไม่อยากให้ใครต้องเจ็บปวด — จั่ว/ใช้สกิลไม่ได้ระหว่างล่อเป้า (ชนะจั่วยังโจมตีได้)</div>
              )}
              {me.skillUsed && !mageRepeat && !gambleRepeat && phase === "PLAYING" && !done && (
                <div className="text-center text-sm font-bold text-echo-gold mt-1">ใช้สกิลได้ 1 อันต่อเทิร์น — เทิร์นนี้ใช้ไปแล้ว</div>
              )}
              {mageRepeat && phase === "PLAYING" && !done && (
                <div className="text-center text-sm font-bold text-echo-cyan mt-1">🪄 จอมเวทย์ฝึกหัด กดได้อีก {3 - (me.mageUses || 0)} ครั้งในเทิร์นนี้</div>
              )}
              {me.skillUsed && gambleRepeat && phase === "PLAYING" && !done && (
                <div className="text-center text-sm font-bold text-echo-gold mt-1">🎰 เวลาทอง! กดสกิลพื้นฐานต่อได้ (เหลือ {me.gamblerUses} ครั้ง)</div>
              )}

              {/* ปุ่มแอคชันใหญ่ (ล่างสุด เต็มความกว้าง) */}
              <div className="mt-2">
                {phase === "PLAYING" && me.alive && !done ? (
                  <>
                    <div className="flex gap-2">
                      <Button variant="cyan" className="flex-1 py-4 text-xl" disabled={me.atCap || noDraw || shCharging || rgCharging || phenexTaunting} onClick={() => { clickSound(); socket.emit("hit"); }}>🎴 จั่วการ์ด</Button>
                      <Button variant="gold" className="flex-1 py-4 text-xl" onClick={() => { clickSound(); socket.emit("lock"); }}>✅ เปิดไพ่</Button>
                    </div>
                    {noDraw && <div className="text-center text-sm font-bold text-echo-hp mt-1">🚫 เทิร์นนี้จั่วไม่ได้</div>}
                    {shCharging && <div className="text-center text-sm font-bold text-echo-hp mt-1">🎻 กำลังบรรเลงบทเพลงสุดท้าย — จั่ว/ใช้สกิลไม่ได้ (ชนะจั่วยังโจมตีได้)</div>}
                    {me.atCap && <div className="text-center text-sm font-bold text-echo-gold mt-1">แต้มเต็มแล้ว! ใช้สกิล หรือเปิดไพ่ได้เลย</div>}
                  </>
                ) : phase === "PLAYING" && me.alive && done ? (
                  <div className="text-center text-lg font-bold py-2">{me.busted ? "แตก! 😢" : me.statuses?.sleep || me.statuses?.ksleep ? "หลับไหลอยู่ 💤" : me.statuses?.sena ? "หนีเซนะอยู่ 🏃‍♀️" : me.statuses?.kstun ? "สตั้นอยู่ 😵" : "พร้อมแล้ว ✅"} รอเพื่อน...</div>
                ) : phase === "ATTACK" ? (
                  <div className="text-center text-lg font-bold py-2">{iAmAttacker ? "⚔️ แตะการ์ดคู่ต่อสู้ด้านบน!" : `รอ ${attacker ? attacker.name : "ผู้ชนะ"} เลือกเป้าหมาย...`}</div>
                ) : !me.alive ? (
                  <div className="text-center text-lg opacity-80 py-2">💀 ตกรอบแล้ว</div>
                ) : <div className="py-1" />}
              </div>
            </div>
          </div>
        )}

        {/* ---------- เฟสสรุปผล (เต็มจอ เลื่อนดูได้) ---------- */}
        {phase === "SUMMARY" && (
          <div className="fixed inset-0 z-30 flex flex-col items-center justify-center gap-2 p-3 bg-black/40 pointer-events-none">
            <div className="pop-in text-2xl font-black bg-black/70 rounded-full px-6 py-1 text-white text-hard border border-white/20">🃏 เปิดการ์ด!</div>
            <div className="pop-in flex flex-col items-center gap-3 rounded-3xl px-4 py-4 w-full max-w-sm max-h-[70vh] overflow-y-auto bg-gradient-to-b from-slate-900/95 to-black/95 border-2 border-echo-gold/40 shadow-2xl pointer-events-auto">
              <div className="flex items-start justify-center gap-6 text-hard">
                {winner && (
                  <div className="flex flex-col items-center gap-1">
                    <div className="text-echo-gold text-lg font-black">🏆 ผู้ชนะ</div>
                    <div className="cut-portrait cut-glow rounded-2xl overflow-hidden w-20 h-20 border-4" style={{ borderColor: winner.color, "--cut-color": winner.color }}>
                      <img src={winner.img} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="font-black" style={{ color: winner.color }}>{winner.name}</div>
                    <div className="text-echo-gold font-black">{winner.busted ? "แตก!" : `${winner.score} แต้ม`}</div>
                  </div>
                )}
                {loser && (
                  <div className="flex flex-col items-center gap-1">
                    <div className="text-echo-hp text-base font-black">💔 แต้มน้อยสุด −1</div>
                    <div className="shake rounded-2xl overflow-hidden w-16 h-16 border-4 grayscale" style={{ borderColor: loser.color }}>
                      <img src={loser.img} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="font-bold" style={{ color: loser.color }}>{loser.name}</div>
                    <div className="text-echo-hp text-sm">{loser.busted ? "แตก!" : `${loser.score} แต้ม`}</div>
                  </div>
                )}
              </div>
              {state.log?.length > 0 && (
                <div className="flex flex-col gap-1 items-center w-full border-t border-white/10 pt-2">
                  {state.log.map((t, i) => <div key={i} className="text-sm bg-black/40 rounded px-2 py-1 w-full text-center">{t}</div>)}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ---------- อนิเมชันเปลี่ยนเฟส ---------- */}
        {PHASE_NAMES[phase] && (
          <div key={`${phase}-${state.roundNumber}`} className="phase-intro fixed top-[38%] left-1/2 z-40 pointer-events-none">
            <div className="text-3xl font-black bg-black/70 rounded-full px-6 py-2.5 whitespace-nowrap text-white text-hard border-2 border-white/20">{PHASE_NAMES[phase]}</div>
          </div>
        )}

        {/* ---------- overlay ที่ใช้ร่วมกับจอคอม ---------- */}
        {phase === "ATTACKING" && state.attack && <AttackFx a={state.attack} />}
        {csAnnounce && <TransformAnnounce key={csAnnounce.id} cs={csAnnounce} />}
        {csSkipped && <CutsceneSkipNotice key={csSkipped.id} cs={csSkipped} timeLeft={state.timeLeft} />}
        {flash && <SkillFlash key={flash.id} f={flash} />}
        {notice && <TransformNotice key={notice.id} n={notice} />}
        {cycleFx && <CycleBanner key={cycleFx.id} c={cycleFx} />}

        {/* ---------- แบนเนอร์รอบถัดไป ---------- */}
        {phase === "TRANSITION" && (
          <div className="fixed inset-0 grid place-items-center bg-black/40 z-30">
            <div className="round-banner text-6xl font-black text-white text-hard">รอบที่ {state.roundNumber + 1}</div>
          </div>
        )}

        {/* ---------- จบเกม ---------- */}
        {phase === "GAMEOVER" && (
          <div className="fixed inset-0 grid place-items-center bg-black/60 z-30 p-4">
            <div className="text-center">
              <div className="text-4xl font-black mb-4">
                {(() => {
                  if (state.allyWin) { const ws = state.players.filter((p) => p.alive); return <>🤝 {ws.map((w) => w.name).join(" & ")} ชนะทั้งคู่!</>; }
                  const c = state.players.find((p) => p.alive); return c ? <>🏆 {c.name} ชนะ!</> : "จบเกม";
                })()}
              </div>
              <Button className="py-4 px-8 text-xl" onClick={() => { clickSound(); socket.emit("backToLobby"); }}>🏠 กลับห้องรอ</Button>
            </div>
          </div>
        )}

        {showChar && ch && <CharModal ch={ch} me={me} onClose={() => setShowChar(false)} />}
        {reijuOpen && me && <ReijuModal me={me} onUse={useReiju} onClose={() => setReijuOpen(false)} />}
        {appleOpen && me && <AppleItemModal me={me} onPick={pickAppleItem} onClose={() => setAppleOpen(false)} />}
        {tohnoOpen && me && <TohnoLevelModal me={me} onPick={pickTohnoLevel} onClose={() => setTohnoOpen(false)} />}
        {aquaOpen && me && <AquaLeaderModal me={me} onPick={pickAquaLeader} onClose={() => setAquaOpen(false)} />}
        {state.contractOffer && me?.alive && <ContractOfferModal offer={state.contractOffer} onAnswer={(a) => socket.emit("contractAnswer", { accept: a })} />}
        {state.locaOffer && me?.alive && <LocaOfferModal offer={state.locaOffer} onAnswer={(a) => socket.emit("locaAnswer", { accept: a })} />}
        {state.renewAsk && me?.alive && <ContractRenewModal ask={state.renewAsk} points={me.skillPoints} onAnswer={(a) => socket.emit("contractAnswer", { accept: a })} />}
        {state.allyChoices && me?.alive && <AllyChoiceModal choices={state.allyChoices} onPick={(id) => socket.emit("riddheAlly", { targetId: id })} onDecline={() => socket.emit("riddheAlly", {})} />}
        {state.phenexReleaseAsk && <PhenexReleaseModal ask={state.phenexReleaseAsk} onPick={(id) => socket.emit("phenexRelease", { targetId: id })} />}
        {state.allyOfferAsk && me?.alive && <AllyOfferModal offer={state.allyOfferAsk} onAnswer={(a) => socket.emit("allyAnswer", { accept: a })} />}
        {state.allyBreakAsk && me?.alive && <AllyBreakModal ask={state.allyBreakAsk} onAnswer={(c) => socket.emit("allyBreakAnswer", { cancel: c })} />}
        {state.allyFinalAsk && me?.alive && <AllyFinalModal ask={state.allyFinalAsk} onAnswer={(k) => socket.emit("allyFinalAnswer", { keep: k })} />}
        {statusView && <StatusModal p={statusView} onClose={() => setStatusViewId(null)} />}
      </div>
    );
  }

  // ---- จอคอม/แท็บเล็ต: กระดานเดิม (ออกแบบที่ 900px, auto-fit) ----
  const DESIGN_W = Math.max(900, vp.w);
  const scale = vp.w / DESIGN_W;
  const designH = vp.h / scale;

  return (
    <div className="fixed inset-0 overflow-hidden">
      <GameBackground cycle={state.cycle} oberonBg={state.oberonBg} godtreeBg={state.godtreeBg} shradeBg={state.shradeBg} bardBg={state.bardBg} shikiBg={state.shikiBg} />
      <div
        className="relative overflow-hidden"
        style={{ width: DESIGN_W, height: designH, transform: `scale(${scale})`, transformOrigin: "top left" }}
      >
      {/* โลโก้กลางโต๊ะ */}
      <div className="absolute inset-x-0 top-[32%] flex justify-center pointer-events-none">
        <h1 className="glitch text-5xl sm:text-6xl font-black opacity-60" data-text="ECHO">ECHO</h1>
      </div>

      {/* ตัวจับเวลา + รอบ */}
      {(phase === "PLAYING" || phase === "ATTACK") && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 text-lg font-bold bg-black/40 px-4 py-1.5 rounded-full">
          <span className="text-xl">{state.oberonBg ? "🌑" : nightNow ? "🌙" : "☀️"} รอบที่ {state.roundNumber} · ⏱️ {state.timeLeft} วิ</span>
        </div>
      )}
      {/* ราตรีกลืนกิน: ป้ายค้างระหว่างฉากหลังโอเบรอนมีผล (จนกว่าจะหมดกลางคืน) */}
      {state.oberonBg && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 text-sm font-black text-indigo-300 bg-black/60 px-4 py-0.5 rounded-full border border-indigo-400/40 text-hard">
          🌑 ราตรีกลืนกิน
        </div>
      )}

      {/* ผู้เล่นคนอื่น */}
      {others.map((p, i) => (
        <OtherPlayer
          key={p.id}
          p={p}
          phase={phase}
          slot={slots[i] || [50, 50]}
          targetable={((iAmAttacker && !p.statuses?.seal) || !!anataSel || dawnSel || nightSel || appleSel || bbSel || shSel || skSel || saObSel || saLocaSel || bgSel || kawaiiSel || !!bardPending) && p.alive}
          picked={!!anataSel && anataSel.includes(p.id)}
          onAttack={(id) => (anataSel ? pickAnata(id) : dawnSel ? pickDawn(id) : nightSel ? pickNight(id) : appleSel ? pickGive(id) : bbSel ? pickBb(id) : shSel ? pickSh(id) : skSel ? pickSk(id) : saObSel ? pickSaOb(id) : saLocaSel ? pickSaLoca(id) : bgSel ? pickBg(id) : kawaiiSel ? pickKawaii(id) : bardPending ? pickBard(id) : socket.emit("attack", { targetId: id }))}
          onInspect={setStatusViewId}
        />
      ))}

      {/* โหมดเลือกเป้าหมาย ANATA WAAAAAAAA (เทมาริ) */}
      {anataSel && (
        <div className="absolute top-[22%] left-1/2 -translate-x-1/2 z-40 text-center text-hard">
          <span className="text-xl font-black text-echo-gold animate-pulse bg-black/60 rounded-full px-5 py-1.5">🎤 คลิกเลือกเป้าหมาย ANATA ({anataSel.length}/{anataNeed})</span>
          <button onClick={() => { clickSound(); setAnataSel(null); }} className="ml-3 text-sm font-bold bg-black/60 rounded-full px-3 py-1 border border-white/30">ยกเลิก</button>
        </div>
      )}

      {/* โหมดเลือกเป้าหมายรุ่งอรุณแห่งวันใหม่ (โอเบรอน) — เลือกตัวเองได้ */}
      {dawnSel && (
        <div className="absolute top-[22%] left-1/2 -translate-x-1/2 z-40 text-center text-hard whitespace-nowrap">
          <span className="text-xl font-black text-echo-gold animate-pulse bg-black/60 rounded-full px-5 py-1.5">🌄 คลิกเลือกเป้าหมายรุ่งอรุณแห่งวันใหม่</span>
          <button onClick={() => { clickSound(); pickDawn(me.id); }} className="ml-3 text-sm font-bold bg-echo-gold text-gray-900 rounded-full px-3 py-1">เลือกตัวเอง</button>
          <button onClick={() => { clickSound(); setDawnSel(false); }} className="ml-2 text-sm font-bold bg-black/60 rounded-full px-3 py-1 border border-white/30">ยกเลิก</button>
        </div>
      )}

      {/* โหมดเลือกเป้าหมาย Absorb shield (บานาจ ลิงก์ patch 2.1.2) — เลือกตัวเองได้ */}
      {bgSel && (
        <div className="absolute top-[22%] left-1/2 -translate-x-1/2 z-40 text-center text-hard whitespace-nowrap">
          <span className="text-xl font-black text-echo-gold animate-pulse bg-black/60 rounded-full px-5 py-1.5">🛡️ คลิกเลือกเป้าหมาย Absorb shield</span>
          <button onClick={() => { clickSound(); pickBg(me.id); }} className="ml-3 text-sm font-bold bg-echo-gold text-gray-900 rounded-full px-3 py-1">เลือกตัวเอง</button>
          <button onClick={() => { clickSound(); setBgSel(false); }} className="ml-2 text-sm font-bold bg-black/60 rounded-full px-3 py-1 border border-white/30">ยกเลิก</button>
        </div>
      )}

      {/* โหมดเลือกเป้าหมายฝันร้ายยามค่ำคืน (โอเบรอน) — เลือกได้เฉพาะคนอื่น */}
      {nightSel && (
        <div className="absolute top-[22%] left-1/2 -translate-x-1/2 z-40 text-center text-hard whitespace-nowrap">
          <span className="text-xl font-black text-echo-magenta animate-pulse bg-black/60 rounded-full px-5 py-1.5">🌘 คลิกเลือกเป้าหมายฝันร้ายยามค่ำคืน</span>
          <button onClick={() => { clickSound(); setNightSel(false); }} className="ml-2 text-sm font-bold bg-black/60 rounded-full px-3 py-1 border border-white/30">ยกเลิก</button>
        </div>
      )}

      {/* โหมดเลือกเป้าหมาย Sekai ichi kawaii watashi (โคโตเนะ patch 2.1.3) — เลือกได้เฉพาะคนอื่น */}
      {kawaiiSel && (
        <div className="absolute top-[22%] left-1/2 -translate-x-1/2 z-40 text-center text-hard whitespace-nowrap">
          <span className="text-xl font-black text-echo-magenta animate-pulse bg-black/60 rounded-full px-5 py-1.5">💖 คลิกเลือกเป้าหมาย Sekai ichi kawaii watashi</span>
          <button onClick={() => { clickSound(); setKawaiiSel(false); }} className="ml-2 text-sm font-bold bg-black/60 rounded-full px-3 py-1 border border-white/30">ยกเลิก</button>
        </div>
      )}

      {/* โหมดเลือกเป้าหมายเอาไปสิ (Apple guy) — มอบของที่เลือกไว้ให้คนอื่น */}
      {appleSel && (
        <div className="absolute top-[22%] left-1/2 -translate-x-1/2 z-40 text-center text-hard whitespace-nowrap">
          <span className="text-xl font-black text-echo-gold animate-pulse bg-black/60 rounded-full px-5 py-1.5">🎁 คลิกเลือกเป้าหมายเอาไปสิ — มอบ{APPLE_ITEM_NAME[me?.appleItem] || "ของ"}</span>
          <button onClick={() => { clickSound(); setAppleSel(false); }} className="ml-2 text-sm font-bold bg-black/60 rounded-full px-3 py-1 border border-white/30">ยกเลิก</button>
        </div>
      )}

      {/* โหมดเลือกเป้าหมายยื่นข้อเสนอสัญญา (เจ้าแห่งเน็ตบ้าน) — เลือกได้เฉพาะคนอื่น */}
      {bbSel && (
        <div className="absolute top-[22%] left-1/2 -translate-x-1/2 z-40 text-center text-hard whitespace-nowrap">
          <span className="text-xl font-black text-echo-cyan animate-pulse bg-black/60 rounded-full px-5 py-1.5">📶 คลิกเลือกเป้าหมายยื่นข้อเสนอสัญญา</span>
          <button onClick={() => { clickSound(); setBbSel(false); }} className="ml-2 text-sm font-bold bg-black/60 rounded-full px-3 py-1 border border-white/30">ยกเลิก</button>
        </div>
      )}

      {/* โหมดเลือกเป้าหมายแสงจันทร์ส่องวิญญาณ (ชเรด เอลัน) — เลือกได้เฉพาะคนอื่น */}
      {shSel && (
        <div className="absolute top-[22%] left-1/2 -translate-x-1/2 z-40 text-center text-hard whitespace-nowrap">
          <span className="text-xl font-black text-echo-cyan animate-pulse bg-black/60 rounded-full px-5 py-1.5">🌕 คลิกเลือกเป้าหมายแสงจันทร์ส่องวิญญาณ</span>
          <button onClick={() => { clickSound(); setShSel(false); }} className="ml-2 text-sm font-bold bg-black/60 rounded-full px-3 py-1 border border-white/30">ยกเลิก</button>
        </div>
      )}

      {/* โหมดเลือกเป้าหมาย นายมีฝีมือแค่ไหนหรอ? (ชิกิ) — เลือกได้เฉพาะคนอื่น */}
      {skSel && (
        <div className="absolute top-[22%] left-1/2 -translate-x-1/2 z-40 text-center text-hard whitespace-nowrap">
          <span className="text-xl font-black text-echo-hp animate-pulse bg-black/60 rounded-full px-5 py-1.5">🔪 คลิกเลือกเป้าหมาย นายมีฝีมือแค่ไหนหรอ?</span>
          <button onClick={() => { clickSound(); setSkSel(false); }} className="ml-2 text-sm font-bold bg-black/60 rounded-full px-3 py-1 border border-white/30">ยกเลิก</button>
        </div>
      )}

      {/* โหมดเลือกเป้าหมาย Obla Di, Obla Da (ซาโตรุ) — เลือกได้เฉพาะคนอื่น */}
      {saObSel && (
        <div className="absolute top-[22%] left-1/2 -translate-x-1/2 z-40 text-center text-hard whitespace-nowrap">
          <span className="text-xl font-black text-echo-hp animate-pulse bg-black/60 rounded-full px-5 py-1.5">🎵 คลิกเลือกเป้าหมาย Obla Di, Obla Da</span>
          <button onClick={() => { clickSound(); setSaObSel(false); }} className="ml-2 text-sm font-bold bg-black/60 rounded-full px-3 py-1 border border-white/30">ยกเลิก</button>
        </div>
      )}

      {/* โหมดเลือกเป้าหมาย Locacaca fruit (ซาโตรุ) — เลือกตัวเองได้ */}
      {saLocaSel && (
        <div className="absolute top-[22%] left-1/2 -translate-x-1/2 z-40 text-center text-hard whitespace-nowrap">
          <span className="text-xl font-black text-echo-gold animate-pulse bg-black/60 rounded-full px-5 py-1.5">🍑 คลิกเลือกเป้าหมาย Locacaca fruit</span>
          <button onClick={() => { clickSound(); pickSaLoca(me.id); }} className="ml-3 text-sm font-bold bg-echo-gold text-gray-900 rounded-full px-3 py-1">กินเอง</button>
          <button onClick={() => { clickSound(); setSaLocaSel(false); }} className="ml-2 text-sm font-bold bg-black/60 rounded-full px-3 py-1 border border-white/30">ยกเลิก</button>
        </div>
      )}

      {/* โหมดเลือกเป้าหมายบทเพลง (Bard) — บทเพลงประพันธ์เสร็จแล้ว รอเป้าหมาย (ไม่เลือก = สุ่มตอนเปิดไพ่) */}
      {bardPending && (
        <div className="absolute top-[22%] left-1/2 -translate-x-1/2 z-40 text-center text-hard whitespace-nowrap">
          <span className="text-xl font-black text-echo-gold animate-pulse bg-black/60 rounded-full px-5 py-1.5">🎼 คลิกเลือกเป้าหมาย {bardPending.name} ({bardSel.length}/{bardNeed})</span>
          {bardPending.allowSelf && (
            <button onClick={() => { clickSound(); pickBard(me.id); }} className="ml-3 text-sm font-bold bg-echo-gold text-gray-900 rounded-full px-3 py-1">เลือกตัวเอง</button>
          )}
        </div>
      )}

      {/* ---------- แผงตัวเรา (ล่างกลาง) ---------- */}
      {me && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-[min(96%,860px)]">
          <div className="relative rounded-3xl p-4 pl-28 shadow-2xl" style={{ background: "linear-gradient(135deg,#7a2230,#a3283a)" }}>
            {/* รูป + ชื่อ + รายละเอียด (ซ้าย) */}
            <div className="absolute left-[-6px] top-6 w-28 flex flex-col items-center text-center">
              <div className="relative">
                <Portrait p={me} className="w-24 h-28 border-4" />
                <div className="absolute inset-0 rounded-2xl border-4 pointer-events-none" style={{ borderColor: me.color }} />
              </div>
              <div className="font-bold text-base mt-1 leading-tight">{me.character.name}</div>
              <button onClick={() => { clickSound(); setShowChar(true); }} className="text-xs underline opacity-80">รายละเอียดตัวละคร</button>
              {isFuji && <ReijuButton me={me} usable={reijuUsable} onOpen={() => setReijuOpen(true)} className="w-20 h-16 mt-1.5" />}
            </div>

            <div className="flex gap-3">
              {/* เนื้อหาหลัก */}
              <div className="flex-1 min-w-0">
                {/* บน: การ์ด/แต้ม + กล่องแต้มรวม */}
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 min-h-[64px]">
                      {phase === "SUMMARY" || phase === "ATTACK" || phase === "ATTACKING" ? (
                        <div className="text-3xl font-black">
                          {me.busted ? <span className="text-echo-hp">แตก!</span> : <>แต้ม <span className="text-echo-gold">{me.score}</span></>}
                        </div>
                      ) : (
                        me.cards && me.cards.map((c, i) => <Card key={i} value={c.value} />)
                      )}
                    </div>
                    <div className="h-2 rounded-full bg-black/30 overflow-hidden mt-1">
                      <div className="h-full transition-all" style={{ width: `${Math.min(100, ((me.score || 0) / 21) * 100)}%`, background: me.busted ? "#c0392b" : "#fff" }} />
                    </div>
                  </div>
                  <div className="rounded-2xl bg-echo-gold text-gray-900 px-4 py-1.5 text-center font-black shadow-lg shrink-0">
                    <div className="text-xs leading-none">แต้มรวม</div>
                    <div className="text-3xl leading-tight">{me.score != null ? me.score : "?"}</div>
                  </div>
                </div>

                {/* พลังชีวิต + เกราะ (บรรทัดเดียวเสมอ — ป้ายสถานะเท่านั้นที่หักบรรทัดได้) */}
                <div className="flex items-center gap-2 mt-2 flex-wrap text-sm">
                  <span className="font-bold opacity-90 shrink-0">พลังชีวิต</span>
                  <LifeBar p={me} />
                  <span className="font-bold opacity-90 shrink-0">เกราะ</span>
                  <StatusChips p={me} />
                </div>

                {/* ช่องสกิล 3 อัน (ใช้ได้ 1 สกิลต่อเทิร์น) */}
                <div className="grid grid-cols-3 gap-3 mt-2">
                  <SkillSlot label="สกิลพื้นฐาน" tier="basic" skill={ch?.basic} points={me.skillPoints} disabled={done || phase !== "PLAYING" || noSkill || beatMe || shCharging || rgCharging || phenexTaunting || bardNoteLocked || (me.skillUsed && !mageRepeat && !gambleRepeat && !isApple && !isAquarion && !isBard && !isTohno) || mageLocked || cassiusLocked || veilLocked || ktBasicLocked} onUse={skill} ammo={isGambler ? me.gamblerUses : me.puddingUses} cost={isGambler && goldenOn ? halfCost(ch?.basic) : isKotone && overworkMe ? ktCost(ch?.basic) : undefined} />
                  <SkillSlot label="สกิลรอง" tier="secondary" skill={ch?.secondary} points={me.skillPoints} disabled={done || phase !== "PLAYING" || noSkill || (me.skillUsed && !isBard) || shCharging || rgCharging || phenexTaunting || bardNoteLocked || ohgerLocked || mysticLocked || lanLocked || ktSecLocked || skSecLocked || banagherAssaultLocked} onUse={skill} ammo={isApple ? me.appleGiveUses : me.beamAmmo} cost={isGambler && goldenOn ? halfCost(ch?.secondary) : isKotone && overworkMe ? ktCost(ch?.secondary) : undefined} />
                  {isBard ? <BardComposeSlot me={me} /> : <SkillSlot label="ท่าไม้ตาย" tier="ultimate" skill={ch?.ultimate} points={me.skillPoints} disabled={aquaCancelable ? false : (done || phase !== "PLAYING" || noSkill || beatMe || me.skillUsed || ultimateActive || monsterMe || humanityLocked || fourthLocked || offerLocked || ktUltLocked || aquaUltLocked || shUltLocked || shCharging || rgCharging || phenexTaunting)} onUse={skill} />}
                </div>
                {noSkill && phase === "PLAYING" && !done && (
                  <div className="text-center text-xs sm:text-sm font-bold text-echo-hp mt-1">🗡️ โดนหอกลองกินัสปัก — เทิร์นนี้ใช้สกิลไม่ได้</div>
                )}
                {rgCharging && phase === "PLAYING" && !done && (
                  <div className="text-center text-xs sm:text-sm font-bold text-echo-hp mt-1">🛡️ ฉันจะไม่ยอมสูญเสียใครไปอีก — จั่ว/ใช้สกิล/โจมตีไม่ได้ระหว่างท่าทำงาน</div>
                )}
                {me.skillUsed && !mageRepeat && !gambleRepeat && phase === "PLAYING" && !done && (
                  <div className="text-center text-xs sm:text-sm font-bold text-echo-gold mt-1">ใช้สกิลได้ 1 อันต่อเทิร์น — เทิร์นนี้ใช้ไปแล้ว</div>
                )}
                {mageRepeat && phase === "PLAYING" && !done && (
                  <div className="text-center text-xs sm:text-sm font-bold text-echo-cyan mt-1">🪄 จอมเวทย์ฝึกหัด กดได้อีก {3 - (me.mageUses || 0)} ครั้งในเทิร์นนี้</div>
                )}
                {me.skillUsed && gambleRepeat && phase === "PLAYING" && !done && (
                  <div className="text-center text-xs sm:text-sm font-bold text-echo-gold mt-1">🎰 เวลาทอง! กดสกิลพื้นฐานต่อได้ (เหลือ {me.gamblerUses} ครั้ง)</div>
                )}

                {/* หลอดแต้มสกิล (จัดกลาง + สวยขึ้น) */}
                <div className="flex items-center justify-center gap-3 mt-3">
                  <div className="flex gap-1.5 p-1 rounded-xl bg-black/25">
                    {Array.from({ length: me.maxSkill }, (_, i) => (
                      <span
                        key={i}
                        className={`w-8 h-7 rounded-md transition ${
                          i < me.skillPoints
                            ? "bg-gradient-to-b from-yellow-200 to-echo-gold border border-yellow-100 shadow-[0_0_8px] shadow-echo-gold"
                            : "bg-white/10 border border-white/25"
                        }`}
                      />
                    ))}
                  </div>
                  <div className="font-black text-base whitespace-nowrap">แต้มสกิล {me.skillPoints}/{me.maxSkill}</div>
                </div>
              </div>

              {/* ปุ่มจั่ว/เปิดไพ่ (คอลัมน์ขวา) */}
              <div className="flex flex-col gap-3 justify-center shrink-0 w-32">
                {phase === "PLAYING" && me.alive && !done ? (
                  <>
                    {/* แต้มถึงเพดาน (เช่น 21 พอดี) = ปิดปุ่มจั่ว รอผู้ใช้เลือกสกิล/เปิดไพ่เอง */}
                    <Button variant="cyan" className="px-3 py-4 text-lg" disabled={me.atCap || noDraw || shCharging || rgCharging || phenexTaunting} onClick={() => { clickSound(); socket.emit("hit"); }}>จั่วการ์ด</Button>
                    <Button variant="gold" className="px-3 py-4 text-lg" onClick={() => { clickSound(); socket.emit("lock"); }}>เปิดไพ่</Button>
                    {noDraw && <div className="text-center text-xs font-bold text-echo-hp">🚫 เทิร์นนี้จั่วไม่ได้</div>}
                    {shCharging && <div className="text-center text-xs font-bold text-echo-hp">🎻 บรรเลงบทเพลงสุดท้าย<br />จั่ว/ใช้สกิลไม่ได้</div>}
                    {me.atCap && <div className="text-center text-xs font-bold text-echo-gold">แต้มเต็มแล้ว!<br />ใช้สกิล/เปิดไพ่ได้เลย</div>}
                  </>
                ) : phase === "PLAYING" && me.alive && done ? (
                  <div className="text-center text-base font-bold text-white/90">{me.busted ? "แตก! 😢" : me.statuses?.sleep || me.statuses?.ksleep ? "หลับไหลอยู่ 💤" : me.statuses?.sena ? "หนีเซนะอยู่ 🏃‍♀️" : me.statuses?.kstun ? "สตั้นอยู่ 😵" : "พร้อมแล้ว ✅"}<br />รอเพื่อน...</div>
                ) : phase === "ATTACK" ? (
                  <div className="text-center text-base font-bold">{iAmAttacker ? "⚔️ เลือกเป้า!" : `รอ ${attacker ? attacker.name : "ผู้ชนะ"}`}</div>
                ) : !me.alive ? (
                  <div className="text-center text-base opacity-80">ตกรอบแล้ว</div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------- เฟสสรุปผล: อนิเมชันผู้ชนะ + ผู้แต้มน้อยสุด (กลางจอ) ---------- */}
      {phase === "SUMMARY" && (
        <div className="absolute top-[14%] left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-3 pointer-events-none">
          <div className="pop-in text-2xl sm:text-3xl font-black bg-black/70 rounded-full px-6 py-1 text-white text-hard border border-white/20">🃏 เปิดการ์ด!</div>
          <div className="pop-in flex flex-col items-center gap-3 rounded-3xl px-6 sm:px-10 py-5 bg-gradient-to-b from-slate-900/95 to-black/95 border-2 border-echo-gold/40 shadow-2xl backdrop-blur-md ring-1 ring-white/10">
            <div className="flex items-start gap-6 sm:gap-12 text-hard">
              {winner && (
                <div className="flex flex-col items-center gap-1">
                  <div className="text-echo-gold text-xl sm:text-2xl font-black">🏆 ผู้ชนะ</div>
                  <div className="cut-portrait cut-glow rounded-2xl overflow-hidden w-24 h-24 sm:w-28 sm:h-28 border-4" style={{ borderColor: winner.color, "--cut-color": winner.color }}>
                    <img src={winner.img} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div className="font-black text-lg" style={{ color: winner.color }}>{winner.name}</div>
                  <div className="text-echo-gold font-black">{winner.busted ? "แตก!" : `${winner.score} แต้ม`}</div>
                </div>
              )}
              {loser && (
                <div className="flex flex-col items-center gap-1">
                  <div className="text-echo-hp text-lg sm:text-xl font-black">💔 แต้มน้อยสุด −1</div>
                  <div className="shake rounded-2xl overflow-hidden w-20 h-20 sm:w-24 sm:h-24 border-4 grayscale" style={{ borderColor: loser.color }}>
                    <img src={loser.img} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div className="font-bold" style={{ color: loser.color }}>{loser.name}</div>
                  <div className="text-echo-hp text-sm">{loser.busted ? "แตก!" : `${loser.score} แต้ม`}</div>
                </div>
              )}
            </div>
            {state.log?.length > 0 && (
              <div className="flex flex-col gap-1 items-center max-w-lg w-full border-t border-white/10 pt-3">
                {state.log.map((t, i) => <div key={i} className="text-sm bg-black/40 rounded px-3 py-1 w-full text-center">{t}</div>)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---------- อนิเมชันเปลี่ยนเฟส (กลางจอ) ---------- */}
      {PHASE_NAMES[phase] && (
        <div key={`${phase}-${state.roundNumber}`} className="phase-intro absolute top-[38%] left-1/2 z-40 pointer-events-none">
          <div className="text-4xl sm:text-5xl font-black bg-black/70 rounded-full px-8 py-3 whitespace-nowrap text-white text-hard border-2 border-white/20">{PHASE_NAMES[phase]}</div>
        </div>
      )}

      {/* ---------- อนิเมชันใครตีใคร ---------- */}
      {phase === "ATTACKING" && state.attack && <AttackFx a={state.attack} />}

      {/* ---------- ประกาศเปลี่ยนร่าง: กระดานยังโชว์อยู่ + ระเบิด/เสียงแปลงร่างเล่นให้จบ ---------- */}
      {csAnnounce && <TransformAnnounce key={csAnnounce.id} cs={csAnnounce} />}

      {/* ---------- โหมดประหยัด: ข้ามวีดีโอคัตซีน — แจ้งเตือนว่าใครเปิดท่าไม้ตาย + รอเวลาเท่าวีดีโอจริง ---------- */}
      {csSkipped && <CutsceneSkipNotice key={csSkipped.id} cs={csSkipped} timeLeft={state.timeLeft} />}

      {/* ---------- สกิลช่วงจั่วการ์ด เด้งทันที ---------- */}
      {flash && <SkillFlash key={flash.id} f={flash} />}
      {notice && <TransformNotice key={notice.id} n={notice} />}
      {cycleFx && <CycleBanner key={cycleFx.id} c={cycleFx} />}

      {/* ---------- แบนเนอร์รอบถัดไป ---------- */}
      {phase === "TRANSITION" && (
        <div className="absolute inset-0 grid place-items-center bg-black/40 z-30">
          <div className="round-banner text-6xl sm:text-8xl font-black text-white text-hard">
            รอบที่ {state.roundNumber + 1}
          </div>
        </div>
      )}

      {/* ---------- จบเกม ---------- */}
      {phase === "GAMEOVER" && (
        <div className="absolute inset-0 grid place-items-center bg-black/60 z-30">
          <div className="text-center">
            <div className="text-4xl sm:text-5xl font-black mb-4">
              {(() => {
                if (state.allyWin) { const ws = state.players.filter((p) => p.alive); return <>🤝 {ws.map((w) => w.name).join(" & ")} ชนะทั้งคู่!</>; }
                const c = state.players.find((p) => p.alive); return c ? <>🏆 {c.name} ชนะ!</> : "จบเกม";
              })()}
            </div>
            <Button onClick={() => { clickSound(); socket.emit("backToLobby"); }}>🏠 กลับห้องรอ</Button>
          </div>
        </div>
      )}

      {/* ---------- modal รายละเอียดตัวละคร / ดูสถานะผู้เล่น ---------- */}
      {showChar && ch && <CharModal ch={ch} me={me} onClose={() => setShowChar(false)} />}
      {reijuOpen && me && <ReijuModal me={me} onUse={useReiju} onClose={() => setReijuOpen(false)} />}
      {appleOpen && me && <AppleItemModal me={me} onPick={pickAppleItem} onClose={() => setAppleOpen(false)} />}
        {tohnoOpen && me && <TohnoLevelModal me={me} onPick={pickTohnoLevel} onClose={() => setTohnoOpen(false)} />}
        {aquaOpen && me && <AquaLeaderModal me={me} onPick={pickAquaLeader} onClose={() => setAquaOpen(false)} />}
      {state.contractOffer && me?.alive && <ContractOfferModal offer={state.contractOffer} onAnswer={(a) => socket.emit("contractAnswer", { accept: a })} />}
        {state.locaOffer && me?.alive && <LocaOfferModal offer={state.locaOffer} onAnswer={(a) => socket.emit("locaAnswer", { accept: a })} />}
      {state.renewAsk && me?.alive && <ContractRenewModal ask={state.renewAsk} points={me.skillPoints} onAnswer={(a) => socket.emit("contractAnswer", { accept: a })} />}
      {state.allyChoices && me?.alive && <AllyChoiceModal choices={state.allyChoices} onPick={(id) => socket.emit("riddheAlly", { targetId: id })} onDecline={() => socket.emit("riddheAlly", {})} />}
        {state.phenexReleaseAsk && <PhenexReleaseModal ask={state.phenexReleaseAsk} onPick={(id) => socket.emit("phenexRelease", { targetId: id })} />}
      {state.allyOfferAsk && me?.alive && <AllyOfferModal offer={state.allyOfferAsk} onAnswer={(a) => socket.emit("allyAnswer", { accept: a })} />}
      {state.allyBreakAsk && me?.alive && <AllyBreakModal ask={state.allyBreakAsk} onAnswer={(c) => socket.emit("allyBreakAnswer", { cancel: c })} />}
      {state.allyFinalAsk && me?.alive && <AllyFinalModal ask={state.allyFinalAsk} onAnswer={(k) => socket.emit("allyFinalAnswer", { keep: k })} />}
      {statusView && <StatusModal p={statusView} onClose={() => setStatusViewId(null)} />}
      </div>
    </div>
  );
}
