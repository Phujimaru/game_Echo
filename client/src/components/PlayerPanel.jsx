import Avatar from "./Avatar";
import StatBar from "./StatBar";
import Card from "./Card";
import { clickSound } from "../audio";

function Badge({ p, phase }) {
  const base = "inline-block text-xs px-2 py-0.5 rounded-lg mt-1 font-semibold";
  if (!p.alive) return <span className={`${base} bg-gray-800`}>💀 ตกรอบ</span>;
  if (phase === "RESULTS" || phase === "GAMEOVER") {
    if (p.isWinner) return <span className={`${base} bg-echo-gold text-gray-900`}>🏆 ชนะ</span>;
    if (p.isLoser) return <span className={`${base} bg-echo-hp`}>แต้มน้อยสุด</span>;
    return <span className={`${base} bg-emerald-700`}>รอด</span>;
  }
  if (p.busted) return <span className={`${base} bg-echo-hp`}>💥 แตก</span>;
  if (p.locked) return <span className={`${base} bg-emerald-700`}>✅ เปิดไพ่แล้ว</span>;
  return <span className={`${base} bg-echo-purple`}>🤔 กำลังคิด</span>;
}

// สถานะสกิลที่กำลังติดตัว (มีระยะเวลา)
function Statuses({ statuses }) {
  if (!statuses) return null;
  const items = [];
  if (statuses.upg) items.push(["UPG", "bg-echo-cyan text-gray-900"]);
  if (statuses.monster) items.push([`🦖 x${statuses.monster}`, "bg-echo-hp"]);
  if (statuses.ginga) items.push([`✨ Ginga x${statuses.ginga}`, "bg-echo-gold text-gray-900"]);
  if (!items.length) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {items.map(([t, cls], i) => (
        <span key={i} className={`text-[11px] px-1.5 py-0.5 rounded-md font-bold ${cls}`}>
          {t}
        </span>
      ))}
    </div>
  );
}

function Effects({ p, phase }) {
  if (phase !== "RESULTS" && phase !== "GAMEOVER") return null;
  const parts = [];
  if (p.dmgHp) parts.push(["dmg", `-${p.dmgHp}`, "❤️"]);
  if (p.dmgArmor) parts.push(["dmg", `-${p.dmgArmor}`, "🛡️"]);
  if (p.wasAttacked) parts.push(["atk", "⚔️ ถูกเลือกโจมตี", ""]);
  if (p.gainedSkill) parts.push(["skill", `+${p.gainedSkill}`, "⚡"]);
  if (!parts.length) return null;
  const color = { dmg: "bg-echo-hp", atk: "bg-echo-magenta", skill: "bg-echo-gold text-gray-900" };
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {parts.map(([k, t, e], i) => (
        <span key={i} className={`text-xs px-1.5 py-0.5 rounded-md font-bold ${color[k]}`}>
          {t}
          {e}
        </span>
      ))}
    </div>
  );
}

export default function PlayerPanel({ p, you, phase, targetable, onAttack }) {
  const cards = p.cards
    ? p.cards.map((c, i) => <Card key={i} card={c} />)
    : Array.from({ length: p.cardCount }, (_, i) => <Card key={i} back />);

  // กรอบ = สีประจำตำแหน่ง; ไฮไลต์ต่างๆ ทับด้วย ring
  const ring = you
    ? "ring-2 ring-echo-gold"
    : p.isWinner
    ? "ring-2 ring-echo-gold"
    : p.isLoser
    ? "ring-2 ring-echo-hp"
    : "";

  return (
    <div
      onClick={targetable ? () => { clickSound(); onAttack(p.id); } : undefined}
      style={{ borderColor: p.color }}
      className={`relative rounded-2xl p-3 min-w-[190px] bg-echo-navy/60 backdrop-blur border-2 ${ring} ${
        !p.alive ? "opacity-45 grayscale" : ""
      } ${targetable ? "cursor-crosshair targetable" : ""}`}
    >
      <div className="flex items-center gap-2.5 text-left mb-1">
        <div className="relative">
          <Avatar img={p.img} index={p.avatar} size={52} />
          <span
            className="absolute -bottom-1 -right-1 text-[10px] font-bold px-1.5 rounded-full"
            style={{ background: p.color }}
          >
            P{p.position}
          </span>
        </div>
        <div>
          <div className="font-bold">
            {p.name}
            {you && <span className="text-echo-gold"> (คุณ)</span>}
          </div>
          <div className="text-xs opacity-70">{p.character.name}</div>
          <Badge p={p} phase={phase} />
        </div>
      </div>

      <StatBar p={p} />
      <Statuses statuses={p.statuses} />

      <div className="min-h-[72px]">{cards}</div>

      <div className="font-bold mt-1">แต้ม: {p.score !== null ? p.score : "?"}</div>

      <Effects p={p} phase={phase} />
    </div>
  );
}
