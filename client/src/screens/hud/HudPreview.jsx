// หน้าดูแผงตัวเรา (เฉพาะ dev ไม่ต่อ socket): ?hud=1
//  พารามิเตอร์: st=0..14 (จำนวนสถานะ) · res=0 (ไม่มีทรัพยากรตัวละคร) · target=1 (กำลังเลือกเป้า → แผงเลื่อนลง)
//  open=1 (กางรายละเอียดสถานะแถวแรก) · lost=1 (สกิลรองข้อมูลสูญหาย) · bust=1 · cards=0..6 · team=A · night=1 · arena=1..3 · n=0..6 · lowq=1
import { useEffect, useMemo, useState } from "react";
import ArenaScene from "../../journey/arena/ArenaScene";
import { arenaLayout, ARENA_CARD_SCALE } from "../../journey/arena/arenaData";
import { journeyArea } from "../../journey/areas";
import Card from "../../components/Card";
import { SelfHud, HudPanel, HudCenter, HudRight, HudTopBar } from "./SelfHud";
import { SkillSlot } from "./SkillSlot";
import { StatRow, VitalExtras } from "./StatRow";
import { OrtLostTierContext } from "./ortLost";

const COLS = ["#3d8bd9", "#9b4f96", "#e0812f", "#2fa39a", "#d2455b", "#6b7fd6", "#c49a2c"];
const MOCK_STATUS = [
  { key: "atkUp", v: 3, amt: 1, icon: "⚔️", label: "พลังโจมตี", cls: "bg-echo-ice text-gray-900", desc: "โจมตีแรงขึ้นตามจำนวนซ้อนทับ จนกว่าจะหมดเวลา" },
  { key: "dodge", v: 2, amt: 0, icon: "💨", label: "หลบหลีก", cls: "bg-echo-cyan text-gray-900", desc: "มีโอกาสหลบการโจมตีที่เข้ามา" },
  { key: "poison", v: 2, amt: 0, icon: "☠️", label: "พิษ", cls: "bg-echo-hp", desc: "เสียพลังชีวิต 1 ทุกต้นเทิร์น" },
  { key: "aroundCaliburn", v: 2, amt: 0, icon: "✨", label: "Around Caliburn", cls: "bg-echo-magenta", desc: "พลังโจมตี +1" },
  { key: "nightTax", v: 999, amt: 0, icon: "🌙", label: "ภาษีกลางคืน", cls: "bg-white/20", desc: "การ์ดหนึ่งระดับแพงขึ้น 1" },
  { key: "stun", v: 1, amt: 0, icon: "💫", label: "ติดสตัน", cls: "bg-echo-hp", desc: "ใช้สกิลไม่ได้" },
  { key: "mark", v: 3, amt: 0, icon: "🎯", label: "ถูกมาร์ก", cls: "bg-echo-magenta", desc: "โดนคริติคอลง่ายขึ้น" },
  { key: "burn", v: 2, amt: 2, icon: "🔥", label: "ไฟไหม้", cls: "bg-echo-hp", desc: "เสียพลังชีวิตตามจำนวนชั้น" },
  { key: "haste", v: 1, amt: 0, icon: "⚡", label: "เร่งความเร็ว", cls: "bg-echo-cyan text-gray-900", desc: "จั่วการ์ดเพิ่มได้ 1 ใบ" },
  { key: "sealSec", v: 2, amt: 0, icon: "🔒", label: "ผนึกสกิลรอง", cls: "bg-white/20", desc: "ใช้สกิลรองไม่ได้" },
  { key: "armorUp", v: 4, amt: 0, icon: "🛡️", label: "เกราะแกร่ง", cls: "bg-echo-armor", desc: "รับความเสียหายลดลง 1" },
  { key: "bleed", v: 3, amt: 0, icon: "🩸", label: "เลือดไหลจนกว่าจะได้รับการรักษาจากเพื่อนร่วมทีม", cls: "bg-echo-hp", desc: "เสียพลังชีวิต 1 ทุกครั้งที่จั่วการ์ด" },
  { key: "regen", v: 2, amt: 0, icon: "💚", label: "ฟื้นฟู", cls: "bg-echo-armor", desc: "ฟื้นพลังชีวิต 1 ทุกต้นเทิร์น" },
  { key: "tonkatsu", v: 3, amt: 0, icon: "🍜", label: "ทงคัสสึ", cls: "bg-echo-cyan text-gray-900", desc: "ชามทงคัสสึสะสม (สูงสุด 4)" },
];
const MOCK_RES = [
  { key: "kimScabbard", v: 1, icon: "🗡️", label: "Resentful Scabbard 42/100", cls: "bg-echo-ice text-gray-900", desc: "30+ ทำดาเมจฟื้นพลังชีวิต +1 · 55+ เลือดไหล/เหน็บชาที่มอบ +1 เทิร์น" },
  { key: "kimPoise", v: 1, icon: "🍃", label: "Poise 2/4", cls: "bg-echo-cyan text-gray-900", desc: "1 หน่วย = โอกาสคริติคอล 1.2%" },
];
const SKILLS = {
  basic: { name: "Strike Air", cost: 2, desc: "ก่อนเปิดไพ่: พลังโจมตี +1", img: "/characters/artoria_caster/artoria_caster_skill1.jpg" },
  secondary: { name: "Mana Burst", cost: 3, desc: "ก่อนเปิดไพ่: เกราะ +1", img: "/characters/artoria_caster/artoria_caster_skill2.jpg" },
  ultimate: { name: "Excalibur", cost: 6, desc: "ก่อนเปิดไพ่: ทุกคนเสียพลังชีวิต 2", img: "/characters/artoria_caster/artoria_caster_skill3.jpg" },
};
const HAND = [{ value: 7, color: "red" }, { special: "king" }, { value: 4, color: "blue" }];

function MockTimer() {
  const circ = 2 * Math.PI * 20;
  return (
    <div className="bd-timer" data-low="false">
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <circle className="bd-timer-ring" cx="24" cy="24" r="20" />
        <circle className="bd-timer-arc" cx="24" cy="24" r="20" strokeDasharray={circ} strokeDashoffset={circ * 0.35} />
      </svg>
      <span className="relative leading-none" style={{ fontFamily: "var(--font-av-display)", fontWeight: 700, fontSize: "1.2rem", color: "#fff" }}>12</span>
    </div>
  );
}

export default function HudPreview() {
  const q = new URLSearchParams(location.search);
  const num = (k, d) => (q.has(k) ? Number(q.get(k)) : d);
  const area = Math.min(3, Math.max(1, num("arena", 1)));
  const nOthers = Math.min(6, Math.max(0, num("n", 6)));
  const night = q.get("night") === "1";
  const lowQ = q.get("lowq") === "1";
  const stN = Math.min(MOCK_STATUS.length, Math.max(0, num("st", 8)));
  const withRes = q.get("res") !== "0";
  const busted = q.get("bust") === "1";
  const nCards = Math.min(6, Math.max(0, num("cards", 3)));
  const [target, setTarget] = useState(q.get("target") === "1");
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const on = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  const lay = useMemo(() => arenaLayout(vp.w, vp.h, area, nOthers), [vp.w, vp.h, area, nOthers]);
  const seats = useMemo(() => [{ phi: 90, col: COLS[0], me: true }, ...lay.others.map((o, i) => ({ phi: o.phi, stem: o.stem, col: COLS[(i + 1) % 7] }))], [lay]);

  // สูตรย่อกระดานเดียวกับ GameBoard (จอคอม)
  const scale = Math.min(vp.w / Math.max(900, vp.w), Math.min(1, vp.h / 920));
  const DESIGN_W = vp.w / scale;
  const designH = vp.h / scale;

  const statuses = [...(withRes ? MOCK_RES : []), ...MOCK_STATUS.slice(0, stN)];
  const raw = Object.fromEntries(MOCK_STATUS.filter((s) => s.key !== "tonkatsu").map((s) => [s.key, s.v]));
  const cards = Array.from({ length: nCards }, (_, i) => HAND[i % HAND.length]);
  const lost = q.get("lost") === "1" ? { tier: "secondary", turns: 2 } : null;
  const a = journeyArea(area);

  return (
    <OrtLostTierContext.Provider value={lost}>
      <div style={{ position: "fixed", inset: 0, overflow: "hidden", background: "#000" }}>
        <ArenaScene area={area} night={night} lowQ W={vp.w} H={vp.h} seats={seats} />
        {lay.others.map((o, i) => (
          <div
            key={i}
            style={{
              position: "absolute", left: o.x, top: o.bottom, width: 236, height: 150,
              transform: `translate(-50%, -100%) scale(${o.s * ARENA_CARD_SCALE})`, transformOrigin: "bottom center",
              background: "rgba(18,38,74,0.88)", border: `2px solid ${target ? "#bee3f8" : COLS[(i + 1) % 7]}`, color: "#eaf3fc",
              font: "500 15px Kanit, sans-serif", display: "grid", placeItems: "center",
              boxShadow: target ? "0 0 22px rgba(190,227,248,0.8)" : "none",
            }}
          >
            ผู้เล่น {i + 2}
          </div>
        ))}
        <div style={{ position: "absolute", left: lay.center.x, top: lay.center.y, width: 90, height: 124, transform: "translate(-50%, -92%)", background: "#12264a", border: "2px solid #f0c868" }} />
        <div className="relative overflow-hidden" style={{ width: DESIGN_W, height: designH, transform: `scale(${scale})`, transformOrigin: "top left" }}>
          <HudTopBar
            night={night}
            round={3}
            timer={<MockTimer />}
            journey={{ ...a, name: a.name, turnsLeft: 7 }}
            onJourney={() => {}}
          />
          {target && (
            <div className="absolute top-[22%] left-1/2 -translate-x-1/2 z-40 text-center text-hard whitespace-nowrap">
              <span className="text-xl font-black text-echo-hp animate-pulse bg-black/60 rounded-full px-5 py-1.5">🔪 คลิกเลือกเป้าหมาย นายมีฝีมือแค่ไหนหรอ?</span>
              <button onClick={() => setTarget(false)} className="ml-2 text-sm font-bold bg-black/60 rounded-full px-3 py-1 border border-white/30">ยกเลิก</button>
            </div>
          )}
          <SelfHud
            hidden={target}
            lowQ={lowQ}
            compact={DESIGN_W < 1240}
            panel={
              <HudPanel
                portrait={<img src="/characters/artoria_caster/artoria_caster.webp" alt="" style={{ objectFit: "cover" }} />}
                name="อาร์โทเรีย แคสเตอร์"
                onName={() => {}}
                teamId={q.get("team") || null}
                teamColor="#22d3ee"
                vitals={
                  <div className="hud-vitals">
                    <StatRow kind="hp" value={4} max={7} extra={1} extraLabel="เลือดชั่วคราว" />
                    <StatRow kind="ar" value={2} max={3} />
                    <VitalExtras p={{ shield: 2 }} className="pc-extra-inline" />
                  </div>
                }
                chips={withRes ? <span className="text-xs font-bold rounded-full px-2 py-0.5 whitespace-nowrap bg-black/55">⚙️ เกียร์ 3/6 (+1)</span> : null}
                statuses={statuses}
                rawStatuses={raw}
                defaultOpen={q.get("open") === "1" ? MOCK_STATUS[0].key : null}
                onOpenAll={() => {}}
              />
            }
            center={
              <HudCenter
                score={busted ? 23 : 18}
                busted={busted}
                hand={cards.length ? (
                  <div className="flex items-center pl-1 pr-4">
                    {cards.map((c, i) => {
                      const step = cards.length > 1 ? Math.max(16, Math.min(80, 150 / (cards.length - 1))) : 0;
                      const off = i - (cards.length - 1) / 2;
                      return (
                        <div key={i} className="relative shrink-0 group hover:z-30" style={{ marginLeft: i === 0 ? 0 : -(80 - step), transform: `rotate(${off * 6}deg) translateY(${Math.abs(off) * 4}px)` }}>
                          <div className={`transition-transform duration-150 group-hover:-translate-y-6 group-hover:scale-110 ${busted ? "grayscale opacity-60" : ""}`}>
                            <Card value={c.value} color={c.color} special={c.special} size="lg" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : <span className="hud-hand-note">ยังไม่จั่วไพ่</span>}
                draw={{ disabled: false, onClick: () => setTarget(true) }}
                reveal={{ disabled: busted, onClick: () => {} }}
              />
            }
            right={
              <HudRight
                sp={5}
                spMax={8}
                extras={q.get("extras") === "1" ? <span className="text-[11px] font-bold rounded-lg px-2 py-1 border border-white/25 bg-black/30">🃏 คุณคือนักบิน</span> : null}
                bagCount={2}
                onBag={() => {}}
                gold={12}
                onShop={() => {}}
                skills={
                  <>
                    <SkillSlot variant="hud" label="พื้นฐาน" tier="basic" skill={SKILLS.basic} points={5} onUse={() => setTarget(true)} />
                    <SkillSlot variant="hud" label="รอง" tier="secondary" skill={SKILLS.secondary} points={5} onUse={() => {}} cooldown={lost ? 0 : 2} disabled={!lost} />
                    <SkillSlot variant="hud" label="ท่าไม้ตาย" tier="ultimate" skill={SKILLS.ultimate} points={5} onUse={() => {}} />
                  </>
                }
              />
            }
          />
        </div>
      </div>
    </OrtLostTierContext.Provider>
  );
}
