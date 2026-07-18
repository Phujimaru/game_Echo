// แถบพลังชีวิต (spec 7.2): HP = จุดแดง, เกราะ = สี่เหลี่ยมฟ้า, สกิล = 6 จุดทอง
export default function StatBar({ p }) {
  return (
    <div className="text-left my-2 space-y-1.5">
      <div className="flex items-center gap-1.5">
        {/* HP จุดกลมแดง */}
        {Array.from({ length: p.maxHp }, (_, i) => (
          <span
            key={i}
            className={`w-3.5 h-3.5 rounded-full ${
              i < p.hp ? "bg-echo-hp shadow-[0_0_6px] shadow-echo-hp" : "bg-white/15"
            }`}
          />
        ))}
        <span className="w-1" />
        {/* เกราะ สี่เหลี่ยมฟ้า */}
        {Array.from({ length: p.maxArmor }, (_, i) => (
          <span
            key={i}
            className={`w-3.5 h-3.5 rounded-[3px] ${
              i < p.armor ? "bg-echo-armor shadow-[0_0_6px] shadow-echo-armor" : "border border-white/25"
            }`}
          />
        ))}
        {/* โล่กันดาเมจ (ถ้ามี) */}
        {p.shield > 0 && (
          <span className="text-xs text-echo-cyan font-bold ml-0.5">🛡️{p.shield}</span>
        )}
      </div>

      {/* หลอดสกิล 6 จุดทอง — ซาโตรุ (patch 2.0.8.2): แต้มสกิลถูกซ่อน (-1) แสดง ??? แทน */}
      {p.skillPoints < 0 ? (
        <div className="flex gap-1 items-center" title="แต้มสกิลถูกซ่อน (สกิลติดตัวซาโตรุ)">
          <span className="text-xs font-black text-echo-gold opacity-90">🌩️ ??? / {p.maxSkill}</span>
        </div>
      ) : (
        <div className="flex gap-1" title={`หลอดสกิล ${p.skillPoints}/${p.maxSkill}`}>
          {Array.from({ length: p.maxSkill }, (_, i) => (
            <span
              key={i}
              className={`w-3 h-3 rounded-full ${
                i < p.skillPoints ? "bg-echo-gold shadow-[0_0_5px] shadow-echo-gold" : "bg-white/10"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
