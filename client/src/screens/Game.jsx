import { useEffect, useRef, useState } from "react";
import Card from "../components/Card";
import Button from "../components/Button";
import { socket } from "../socket";
import { clickSound, getMasterVolume, playSfx } from "../audio";

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

// ---------- cutscene แปลงร่าง ----------
//  เต็ม = วีดีโอเต็มจอ (ครั้งแรกต่อเกม) | brief = แบนเนอร์สั้นบอกแค่ใครใช้อะไร
function Cutscene({ cs }) {
  const ref = useRef(null);
  useEffect(() => {
    if (cs.brief) return;
    const v = ref.current;
    if (!v) return;
    v.volume = getMasterVolume();
    v.currentTime = 0;
    v.play().catch(() => { v.muted = true; v.play().catch(() => {}); }); // กัน autoplay block
  }, [cs.id]); // remount ต่อ cutscene -> เล่นวีดีโอใหม่เสมอ (กันจอดำตอนท่าเดียวกันต่อกัน)

  if (cs.brief) {
    return (
      <div className="fixed inset-0 z-50 grid place-items-center bg-black/75">
        <div className="text-center pop-in flex flex-col items-center gap-3 px-4 text-hard">
          <div className="text-3xl sm:text-5xl font-black text-white">{cs.title}</div>
          {cs.img ? (
            <div className={`cut-portrait rounded-2xl overflow-hidden border-4 ${cs.skill ? "w-44 h-28" : "w-24 h-24"}`} style={{ borderColor: cs.color }}>
              <img src={cs.img} alt="" className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="cut-portrait w-24 h-24 rounded-2xl border-4 grid place-items-center text-4xl" style={{ borderColor: cs.color }}>✦</div>
          )}
          <div className="text-2xl font-black">
            <span style={{ color: cs.color }}>{cs.name}</span> {cs.label}!
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black overflow-hidden">
      <video ref={ref} src={cs.video} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 bg-white cut-flash pointer-events-none" />
      <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(circle, transparent 45%, rgba(0,0,0,0.75) 100%)" }} />
      <div className="absolute top-[8%] inset-x-0 text-center px-4">
        <div className="cut-title glitch text-4xl sm:text-6xl font-black" data-text={cs.title}>{cs.title}</div>
      </div>
      <div className="absolute bottom-[9%] inset-x-0 flex flex-col items-center gap-3">
        <div className="cut-portrait cut-glow rounded-2xl overflow-hidden w-28 h-28 sm:w-36 sm:h-36 border-4" style={{ borderColor: cs.color, "--cut-color": cs.color }}>
          <img src={cs.img} alt="" className="w-full h-full object-cover" />
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
            <div className="text-4xl sm:text-5xl">⚔️</div>
            <div className="text-4xl sm:text-5xl font-black text-echo-hp drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]">-{a.dmg}</div>
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
    <div className="absolute top-[16%] left-1/2 -translate-x-1/2 z-40 pointer-events-none">
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

// ชื่อเฟส (โชว์อนิเมชันตอนเปลี่ยนเฟส)
const PHASE_NAMES = { PLAYING: "🎴 สุ่มการ์ด", ATTACK: "⚔️ โจมตี" };

// ตำแหน่งผู้เล่นคนอื่น (นอกจากตัวเรา) รอบโต๊ะ — [top%, left%] จัดตามจำนวน ไม่เรียงแถว
const SLOTS = {
  0: [],
  1: [[8, 50]],
  2: [[9, 22], [9, 78]],
  3: [[9, 17], [6, 50], [9, 83]],
  4: [[9, 18], [9, 82], [44, 7], [44, 93]],
  5: [[9, 17], [6, 50], [9, 83], [50, 8], [50, 92]],
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

function Shield({ on }) {
  return (
    <svg width="16" height="18" viewBox="0 0 24 24">
      <path d="M12 2 L21 6 V12 C21 17 12 22 12 22 C12 22 3 17 3 12 V6 Z"
        fill={on ? "#3b82c4" : "transparent"} stroke="#3b82c4" strokeWidth="2" />
    </svg>
  );
}

// แถวพลังชีวิต + หลอดสกิล
function Stats({ p, center }) {
  return (
    <div className={center ? "flex flex-col items-center gap-1" : ""}>
      <div className="flex items-center gap-1.5">
        <span className="text-base leading-none">
          {Array.from({ length: p.maxHp }, (_, i) => (i < p.hp ? "❤️" : "🖤")).join("")}
        </span>
        <span className="flex gap-0.5">
          {Array.from({ length: p.maxArmor }, (_, i) => <Shield key={i} on={i < p.armor} />)}
        </span>
        {p.shield > 0 && <span className="text-xs text-echo-cyan font-bold">+🛡️{p.shield}</span>}
      </div>
      <div className="flex gap-0.5 mt-1">
        {Array.from({ length: p.maxSkill }, (_, i) => (
          <span key={i} className={`w-3 h-3 rounded-[3px] ${i < p.skillPoints ? "bg-echo-gold" : "bg-white/15 border border-white/20"}`} />
        ))}
      </div>
    </div>
  );
}

function StatusChips({ statuses }) {
  if (!statuses) return null;
  const items = [];
  if (statuses.upg) items.push(["UPG", "bg-echo-cyan text-gray-900"]);
  if (statuses.monster) items.push([`🦖${statuses.monster}`, "bg-echo-hp"]);
  if (statuses.ginga) items.push([`✨G${statuses.ginga}`, "bg-echo-gold text-gray-900"]);
  if (statuses.absorb) items.push(["Absorb", "bg-echo-armor"]);
  if (statuses.beam) items.push(["Beam", "bg-echo-magenta"]);
  if (statuses.paradise) items.push([`Paradise${statuses.paradise}`, "bg-echo-gold text-gray-900"]);
  if (statuses.ntd) items.push(["NT-D", "bg-echo-hp"]);
  if (statuses.ohger) items.push(["Ohger", "bg-echo-gold text-gray-900"]);
  if (statuses.rachan) items.push([`ราชัน${statuses.rachan}`, "bg-echo-armor"]);
  if (!items.length) return null;
  return (
    <div className="flex flex-wrap gap-1 justify-center mt-1">
      {items.map(([t, c], i) => <span key={i} className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${c}`}>{t}</span>)}
    </div>
  );
}

// ผู้เล่นคนอื่นรอบโต๊ะ
function OtherPlayer({ p, phase, slot, targetable, onAttack }) {
  const summary = phase === "SUMMARY";
  return (
    <div
      className="absolute -translate-x-1/2 flex flex-col items-center gap-1 w-28"
      style={{ top: `${slot[0]}%`, left: `${slot[1]}%` }}
    >
      <div
        onClick={targetable ? () => { clickSound(); onAttack(p.id); } : undefined}
        className={`relative ${!p.alive ? "opacity-40 grayscale" : ""} ${targetable ? "cursor-crosshair targetable rounded-2xl" : ""}`}
      >
        <Portrait p={p} className="w-16 h-16 sm:w-20 sm:h-20 -rotate-3 border-4" />
        <div className="absolute inset-0 rounded-2xl border-4 -rotate-3 pointer-events-none" style={{ borderColor: p.color }} />
        {!p.alive && <span className="absolute inset-0 grid place-items-center text-3xl">💀</span>}
        {p.isWinner && summary && <span className="absolute -top-2 -right-2 text-xl">👑</span>}
        {phase === "PLAYING" && p.locked && p.alive && (
          <span className="absolute -bottom-1 -right-1 bg-emerald-600 rounded-full w-5 h-5 grid place-items-center text-xs">✓</span>
        )}
      </div>
      <div className="max-w-full truncate text-sm sm:text-base font-black px-2 py-0.5 rounded-lg bg-black/50 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]" style={{ borderBottom: `3px solid ${p.color}` }}>{p.name}</div>
      <Stats p={p} center />
      {summary && p.score !== null && (
        <div className={`score-pop text-2xl font-black ${p.isWinner ? "text-echo-gold" : p.busted ? "text-echo-hp" : "text-white"}`}>
          {p.busted ? "แตก!" : `${p.score} แต้ม`}
        </div>
      )}
      <StatusChips statuses={p.statuses} />
    </div>
  );
}

// ช่องสกิลเป็นรูป (คลิกใช้ระหว่างเฟสไพ่)
function SkillSlot({ label, tier, skill, points, disabled, onUse, ammo }) {
  const [broken, setBroken] = useState(false);
  const hasAmmo = skill && skill.ammo != null;
  const ammoLeft = hasAmmo ? (ammo ?? skill.ammo) : null;
  const outOfAmmo = hasAmmo && ammoLeft <= 0;
  const afford = skill && points >= skill.cost;
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
        {skill && <span className="absolute top-1 right-1 text-xs font-bold bg-black/60 text-white rounded px-1.5">{skill.cost}</span>}
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

export default function Game({ state }) {
  const [skillOpen, setSkillOpen] = useState(false);
  const [showChar, setShowChar] = useState(false);
  const [flash, setFlash] = useState(null); // สกิลช่วงจั่วการ์ด เด้งทันทีบนกระดาน
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
  // Beat Mode (คุวากาตะ เลือด < 3): สกิลพื้นฐาน + ท่าไม้ตายใช้ไม่ได้
  const beatMe = !!(me && ch?.id === "kuwagata" && me.alive && me.hp < 3);

  // สกิลช่วงจั่วการ์ด: server แจ้งมา -> เด้งทันที (ไม่ตัดเข้าจอดำ) แล้วหายเอง
  useEffect(() => {
    const onFlash = (f) => setFlash({ ...f, id: Date.now() });
    socket.on("skillFlash", onFlash);
    return () => socket.off("skillFlash", onFlash);
  }, []);
  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 2500);
    return () => clearTimeout(t);
  }, [flash]);

  const skill = (tier) => { clickSound(); socket.emit("useSkill", { tier }); setSkillOpen(false); };

  // เฟส CUTSCENE: วีดีโอ/แบนเนอร์แปลงร่าง (key=id -> remount กันจอดำ)
  //  ยกเว้นฉากประกาศเปลี่ยนร่าง (announce) -> แสดงกระดานเกมตามปกติ + เอฟเฟกต์ทับ (ไม่ตัดจอดำ)
  const csAnnounce = phase === "CUTSCENE" && state.cutscene && state.cutscene.announce ? state.cutscene : null;
  if (phase === "CUTSCENE" && state.cutscene && !csAnnounce) return <Cutscene key={state.cutscene.id} cs={state.cutscene} />;

  // ---- ย่อ/ขยายทั้งกระดานให้พอดีจอ (auto-fit) ----
  // กว้างจริง >= 820 : แสดงเต็มจอเหมือนเดิม (สเกล 1). แคบกว่านั้น (มือถือแนวตั้ง) : ออกแบบที่ 820px แล้วย่อลงพอดีจอ
  const DESIGN_W = Math.max(820, vp.w);
  const scale = vp.w / DESIGN_W;
  const designH = vp.h / scale;

  return (
    <div className="fixed inset-0 overflow-hidden">
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
          รอบที่ {state.roundNumber} · ⏱️ {state.timeLeft} วิ
        </div>
      )}

      {/* ผู้เล่นคนอื่น */}
      {others.map((p, i) => (
        <OtherPlayer
          key={p.id}
          p={p}
          phase={phase}
          slot={slots[i] || [50, 50]}
          targetable={iAmAttacker && p.alive}
          onAttack={(id) => socket.emit("attack", { targetId: id })}
        />
      ))}

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

                {/* พลังชีวิต + เกราะ */}
                <div className="flex items-center gap-2 mt-2 flex-wrap text-sm">
                  <span className="font-bold opacity-90">พลังชีวิต</span>
                  <span className="flex">{Array.from({ length: me.maxHp }, (_, i) => <span key={i} className="text-lg leading-none">{i < me.hp ? "❤️" : "🖤"}</span>)}</span>
                  <span className="flex gap-0.5 ml-1">{Array.from({ length: me.maxArmor }, (_, i) => <Shield key={i} on={i < me.armor} />)}</span>
                  {me.shield > 0 && <span className="text-xs text-echo-cyan font-bold">+🛡️{me.shield}</span>}
                  <span className="font-bold opacity-90">เกราะ</span>
                  <StatusChips statuses={me.statuses} />
                </div>

                {/* ช่องสกิล 3 อัน (ใช้ได้ 1 สกิลต่อเทิร์น) */}
                <div className="grid grid-cols-3 gap-3 mt-2">
                  <SkillSlot label="สกิลพื้นฐาน" tier="basic" skill={ch?.basic} points={me.skillPoints} disabled={done || phase !== "PLAYING" || beatMe || me.skillUsed} onUse={skill} ammo={me.puddingUses} />
                  <SkillSlot label="สกิลรอง" tier="secondary" skill={ch?.secondary} points={me.skillPoints} disabled={done || phase !== "PLAYING" || me.skillUsed} onUse={skill} ammo={me.beamAmmo} />
                  <SkillSlot label="ท่าไม้ตาย" tier="ultimate" skill={ch?.ultimate} points={me.skillPoints} disabled={done || phase !== "PLAYING" || beatMe || me.skillUsed} onUse={skill} />
                </div>
                {me.skillUsed && phase === "PLAYING" && !done && (
                  <div className="text-center text-xs sm:text-sm font-bold text-echo-gold mt-1">ใช้สกิลได้ 1 อันต่อเทิร์น — เทิร์นนี้ใช้ไปแล้ว</div>
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
                    <Button variant="cyan" className="px-3 py-4 text-lg" disabled={me.atCap} onClick={() => { clickSound(); socket.emit("hit"); }}>จั่วการ์ด</Button>
                    <Button variant="gold" className="px-3 py-4 text-lg" onClick={() => { clickSound(); socket.emit("lock"); }}>เปิดไพ่</Button>
                    {me.atCap && <div className="text-center text-xs font-bold text-echo-gold">แต้มเต็มแล้ว!<br />ใช้สกิล/เปิดไพ่ได้เลย</div>}
                  </>
                ) : phase === "PLAYING" && me.alive && done ? (
                  <div className="text-center text-base font-bold text-white/90">{me.busted ? "แตก! 😢" : "พร้อมแล้ว ✅"}<br />รอเพื่อน...</div>
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

      {/* ---------- สกิลช่วงจั่วการ์ด เด้งทันที ---------- */}
      {flash && <SkillFlash key={flash.id} f={flash} />}

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
              {(() => { const c = state.players.find((p) => p.alive); return c ? <>🏆 {c.name} ชนะ!</> : "จบเกม"; })()}
            </div>
            <Button onClick={() => { clickSound(); socket.emit("backToLobby"); }}>🏠 กลับห้องรอ</Button>
          </div>
        </div>
      )}

      {/* ---------- modal รายละเอียดตัวละคร ---------- */}
      {showChar && ch && (
        <div className="fixed inset-0 z-40 bg-black/60 grid place-items-center p-6" onClick={() => setShowChar(false)}>
          <div className="bg-echo-navy rounded-2xl p-5 max-w-md w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="text-xl font-bold mb-2">{ch.name}</div>
            {[["สกิลติดตัว", ch.passive], ["สกิลพื้นฐาน", ch.basic], ["สกิลรอง", ch.secondary], ["ท่าไม้ตาย", ch.ultimate]].map(([label, s], i) =>
              s ? (
                <div key={i} className="py-1.5 border-t border-white/10">
                  <div className="flex justify-between"><span className="font-bold">{label} · {s.name}</span><span className="text-xs opacity-70">{s.cost != null ? `ใช้ ${s.cost}` : "ฟรี"}</span></div>
                  <div className="text-sm opacity-80">{s.desc}</div>
                </div>
              ) : null
            )}
            <Button className="mt-3" onClick={() => { clickSound(); setShowChar(false); }}>ปิด</Button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
