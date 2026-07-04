import { useEffect, useRef, useState } from "react";
import Card from "../components/Card";
import Button from "../components/Button";
import { socket } from "../socket";
import { clickSound, getMasterVolume } from "../audio";

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
        <div className="text-center cut-title flex flex-col items-center gap-3 px-4">
          <div className="glitch text-3xl sm:text-5xl font-black" data-text={cs.title}>{cs.title}</div>
          <div className="cut-portrait rounded-2xl overflow-hidden w-24 h-24 border-4" style={{ borderColor: cs.color }}>
            <img src={`/avatars/${cs.img}`} alt="" className="w-full h-full object-cover" />
          </div>
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
          <img src={`/avatars/${cs.img}`} alt="" className="w-full h-full object-cover" />
        </div>
        <div className="text-2xl sm:text-3xl font-black drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
          <span style={{ color: cs.color }}>{cs.name}</span> {cs.label || "ปล่อยท่าไม้ตาย"}!
        </div>
      </div>
    </div>
  );
}

// ---------- อนิเมชันบอกว่าใครตีใคร ----------
function AttackFx({ a }) {
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/55">
      <div className="flex items-center gap-4 sm:gap-8 cut-title">
        <div className="flex flex-col items-center gap-1">
          <div className="rounded-2xl overflow-hidden w-24 h-24 sm:w-28 sm:h-28 border-4 -rotate-3" style={{ borderColor: a.byColor }}>
            <img src={`/avatars/${a.byImg}`} alt="" className="w-full h-full object-cover" />
          </div>
          <span className="font-bold" style={{ color: a.byColor }}>{a.byName}</span>
        </div>
        <div className="text-center">
          <div className="text-4xl sm:text-5xl">⚔️</div>
          <div className="text-4xl sm:text-5xl font-black text-echo-hp drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]">-{a.dmg}</div>
          {a.revenge && <div className="text-xs text-echo-gold font-bold">NT-D แก้แค้น!</div>}
          {a.aoe && <div className="text-xs">ตีหมู่!</div>}
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className="shake rounded-2xl overflow-hidden w-24 h-24 sm:w-28 sm:h-28 border-4 rotate-3" style={{ borderColor: a.targetColor }}>
            <img src={`/avatars/${a.targetImg}`} alt="" className="w-full h-full object-cover" />
          </div>
          <span className="font-bold" style={{ color: a.targetColor }}>{a.targetName}</span>
        </div>
      </div>
    </div>
  );
}

// ตำแหน่งผู้เล่นคนอื่น (นอกจากตัวเรา) รอบโต๊ะ — [top%, left%] จัดตามจำนวน ไม่เรียงแถว
const SLOTS = {
  0: [],
  1: [[8, 50]],
  2: [[9, 22], [9, 78]],
  3: [[9, 17], [6, 50], [9, 83]],
  4: [[9, 18], [9, 82], [44, 7], [44, 93]],
  5: [[9, 17], [6, 50], [9, 83], [50, 8], [50, 92]],
};

// รูปตัวละคร (เต็มกรอบ + fallback)
function Portrait({ p, className, rounded = "rounded-2xl" }) {
  const [broken, setBroken] = useState(false);
  return (
    <div className={`relative overflow-hidden ${rounded} ${className}`} style={{ background: "linear-gradient(135deg,#9b4f96,#7d3a78)" }}>
      {p.img && !broken ? (
        <img src={`/avatars/${p.img}`} alt="" className="absolute inset-0 w-full h-full object-cover" onError={() => setBroken(true)} />
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
      className="absolute -translate-x-1/2 flex flex-col items-center gap-1 w-40"
      style={{ top: `${slot[0]}%`, left: `${slot[1]}%` }}
    >
      <div className="flex items-center gap-2">
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
        <div className="text-sm font-bold text-left drop-shadow">{p.name}</div>
      </div>
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

export default function Game({ state }) {
  const [skillOpen, setSkillOpen] = useState(false);
  const [showChar, setShowChar] = useState(false);
  const phase = state.gameState;
  const me = state.players.find((p) => p.id === state.youId);
  const others = state.players.filter((p) => p.id !== state.youId);
  const slots = SLOTS[Math.min(others.length, 5)] || [];
  const iAmAttacker = phase === "ATTACK" && state.attackerId === state.youId;
  const attacker = state.players.find((p) => p.id === state.attackerId);
  const winner = state.players.find((p) => p.id === state.winnerId);
  const done = me && (me.locked || !me.alive);
  const ch = me?.character;

  const skill = (tier) => { clickSound(); socket.emit("useSkill", { tier }); setSkillOpen(false); };

  // เฟส CUTSCENE: วีดีโอ/แบนเนอร์แปลงร่าง (key=id -> remount กันจอดำ)
  if (phase === "CUTSCENE" && state.cutscene) return <Cutscene key={state.cutscene.id} cs={state.cutscene} />;

  return (
    <div className="relative min-h-screen overflow-hidden">
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
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-[min(96vw,640px)]">
          <div className="relative rounded-3xl p-4 pl-24 shadow-2xl" style={{ background: "linear-gradient(135deg,#7a2230,#a3283a)" }}>
            {/* รูปตัวเรา */}
            <div className="absolute -left-3 -top-3">
              <div className="relative">
                <Portrait p={me} className="w-24 h-28 -rotate-3 border-4" />
                <div className="absolute inset-0 rounded-2xl border-4 -rotate-3 pointer-events-none" style={{ borderColor: me.color }} />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="font-bold text-lg">คุณ <span className="opacity-70 text-sm">({me.character.name})</span></div>
              <div className="text-sm font-bold">แต้มสกิล {me.skillPoints}/{me.maxSkill}</div>
            </div>

            <div className="mt-1"><Stats p={me} /></div>

            {/* ไพ่ของเรา (เห็นเฉพาะเรา) */}
            <div className="min-h-[68px] flex flex-wrap items-center mt-1">
              {phase === "SUMMARY" ? (
                <div className="text-3xl font-black">
                  {me.busted ? <span className="text-echo-hp">แตก!</span> : <>แต้มคุณ: <span className="text-echo-gold">{me.score}</span></>}
                </div>
              ) : (
                me.cards && me.cards.map((c, i) => <Card key={i} value={c.value} />)
              )}
              {phase !== "SUMMARY" && me.score != null && (
                <span className="ml-2 font-bold">= {me.score}{me.busted ? " (แตก)" : ""}</span>
              )}
            </div>

            {/* ปุ่มตามเฟส */}
            {phase === "PLAYING" && me.alive && (
              done ? (
                <div className="mt-1 text-center font-bold text-white/90">
                  {me.busted ? "แตก! 😢 " : "พร้อมแล้ว ✅ "}รอผู้เล่นอื่นเปิดไพ่...
                </div>
              ) : (
                <div className="mt-2 flex flex-wrap gap-2 items-center">
                  <Button variant="cyan" onClick={() => { clickSound(); socket.emit("hit"); }}>จั่วการ์ด</Button>
                  <Button variant="gold" onClick={() => { clickSound(); socket.emit("lock"); }}>เปิดไพ่</Button>
                  <Button variant="ghost" onClick={() => { clickSound(); setSkillOpen((v) => !v); }}>เลือกสกิล ▾</Button>
                  <button onClick={() => { clickSound(); setShowChar(true); }} className="text-sm underline opacity-80">รายละเอียดตัวละคร</button>
                </div>
              )
            )}

            {phase === "PLAYING" && me.alive && skillOpen && !done && ch && (
              <div className="mt-2 flex flex-wrap gap-2">
                {[["basic", ch.basic], ["secondary", ch.secondary], ["ultimate", ch.ultimate]].map(([tier, s]) =>
                  s ? (
                    <button key={tier} disabled={me.skillPoints < s.cost} onClick={() => skill(tier)}
                      title={s.desc}
                      className="rounded-lg bg-black/30 hover:bg-black/50 border border-white/20 px-3 py-1.5 text-sm font-bold disabled:opacity-40">
                      {s.name} <span className="opacity-70">({s.cost})</span>
                    </button>
                  ) : null
                )}
              </div>
            )}

            {phase === "PLAYING" && !me.alive && <div className="mt-1 text-center opacity-80">คุณตกรอบแล้ว — ดูต่อจนจบเกม</div>}

            {phase === "ATTACK" && (
              <div className="mt-1 text-center font-bold">
                {iAmAttacker ? "⚔️ คุณชนะ! เลือกเป้าหมายโจมตี (คลิกที่ผู้เล่น)" : `รอ ${attacker ? attacker.name : "ผู้ชนะ"} โจมตี...`}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---------- เฟสสรุปผล: ป้ายผู้ชนะ ---------- */}
      {phase === "SUMMARY" && (
        <div className="absolute top-[30%] left-1/2 -translate-x-1/2 text-center">
          <div className="text-2xl sm:text-3xl font-black bg-black/50 rounded-2xl px-6 py-2">
            {winner ? <>🏆 ผู้ชนะรอบนี้: <span className="text-echo-gold">{winner.name}</span></> : "ไม่มีผู้ชนะ"}
          </div>
          {state.log?.length > 0 && (
            <div className="mt-2 flex flex-col gap-1 items-center">
              {state.log.map((t, i) => <div key={i} className="text-sm bg-black/40 rounded px-3 py-1">{t}</div>)}
            </div>
          )}
        </div>
      )}

      {/* ---------- อนิเมชันใครตีใคร ---------- */}
      {phase === "ATTACKING" && state.attack && <AttackFx a={state.attack} />}

      {/* ---------- แบนเนอร์รอบถัดไป ---------- */}
      {phase === "TRANSITION" && (
        <div className="absolute inset-0 grid place-items-center bg-black/40 z-30">
          <div className="round-banner text-6xl sm:text-8xl font-black glitch" data-text={`รอบที่ ${state.roundNumber + 1}`}>
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
  );
}
