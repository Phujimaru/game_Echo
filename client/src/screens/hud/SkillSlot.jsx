// ช่องสกิลของตัวเรา (ย้ายออกมาจาก Game.jsx) — variant="hud" = การ์ดสกิลแบบแผงล่างจอคอม
import { useContext, useState } from "react";
import { OrtLostTierContext } from "./ortLost";

const P_DISPLAY = "var(--font-p-display)";
// ช่องสกิลเป็นรูป (คลิกใช้ระหว่างเฟสไพ่) — cost = แต้มที่ใช้จริง (เวลาทองแกมเบลอร์ลดครึ่ง)
//  เฟรมตัดมุมเฉียง + แถบสีบอกระดับสกิล (พื้นฐาน/รอง/ท่าไม้ตาย) แทนกรอบมนธรรมดา
const SKILL_TIER_ACCENT = { basic: "var(--oc-sky)", secondary: "var(--oc-ice)", ultimate: "var(--oc-echo-glow)" };
// กรอบหกเหลี่ยมด้านแบนบน: วงฟ้า (ทอง = gold) → เส้นมืด → เนื้อใน — ใช้กับตราสกิลและช่องพิเศษ (Bard/Kai)
export function HexFrame({ gold = false, className = "", children }) {
  return (
    <span className={`hud-hexframe ${className}`} data-gold={gold ? "true" : "false"}>
      <span className="hud-hexframe-dark" aria-hidden="true" />
      <span className="hud-hexframe-in">{children}</span>
    </span>
  );
}

export function SkillSlot({ label, tier, skill, points, disabled: disabledProp, onUse, ammo, cost, size, cooldown, variant }) {
  const [broken, setBroken] = useState(false);
  const lost = useContext(OrtLostTierContext);
  const dataLost = !!lost && lost.tier === tier;
  const disabled = disabledProp || dataLost;
  const hasAmmo = skill && skill.ammo != null;
  const ammoLeft = hasAmmo ? (ammo ?? skill.ammo) : null;
  const outOfAmmo = hasAmmo && ammoLeft <= 0;
  const useCost = skill ? (cost ?? skill.cost) : 0;
  const afford = skill && points >= useCost;
  const usable = skill && !disabled && afford && !outOfAmmo;
  const accent = SKILL_TIER_ACCENT[tier] || "var(--color-echo-ice)";
  const heightCls = size === "lg" ? "h-24 sm:h-28" : "h-20 sm:h-24";
  // แผงล่างจอคอม: ตราหกเหลี่ยม (ดีไซน์ S2) — รูปสกิลในหกเหลี่ยมด้านแบน · ระดับ/ชื่อใต้รูป · ป้ายราคามุมขวาบน
  if (variant === "hud") {
    const cd = cooldown || 0;
    const state = dataLost ? "lost" : cd > 0 ? "cd" : usable ? "ready" : skill && !afford ? "nosp" : "off";
    return (
      <button
        type="button"
        disabled={!usable}
        onClick={() => usable && onUse(tier, skill, label, useCost)}
        title={skill ? `${skill.name} — ${skill.desc}` : ""}
        data-usable={usable ? "true" : "false"}
        data-tier={tier}
        data-state={state}
        className="hud-skill"
      >
        <HexFrame gold={tier === "ultimate"} className="hud-skill-hex">
          {skill && skill.img && !broken ? (
            <img src={skill.img} alt="" onError={() => setBroken(true)} />
          ) : (
            <span className="hud-skill-blank">✦</span>
          )}
          {cd > 0 && <span className="hud-skill-cd">{cd}</span>}
          {dataLost && (
            <span className="hud-skill-lost">
              <span>ข้อมูลสูญหาย</span>
              <span className="hud-skill-lost-sub">อีก {lost.turns} เทิร์น</span>
            </span>
          )}
        </HexFrame>
        {hasAmmo && (
          <span className="hud-skill-ammo">
            {Array.from({ length: skill.ammo }, (_, i) => <span key={i} data-on={i < ammoLeft ? "true" : "false"} />)}
          </span>
        )}
        <span className="hud-skill-label">
          <span className="hud-skill-tier">{label}{hasAmmo && <span className="hud-skill-ammo-n"> · {ammoLeft}/{skill.ammo}</span>}</span>
          <span className="hud-skill-name">{skill?.name || "—"}</span>
        </span>
        {skill && <span className="hud-skill-cost" data-cheap={useCost < skill.cost ? "true" : "false"}>{useCost} แต้ม</span>}
      </button>
    );
  }
  return (
    <div className="flex flex-col items-center gap-1">
      <button
        disabled={!usable}
        onClick={() => usable && onUse(tier, skill, label, useCost)}
        title={skill ? `${skill.name} — ${skill.desc}` : ""}
        data-usable={usable ? "true" : "false"}
        data-tier={tier}
        className={`bd-skill ${heightCls} ${usable ? "" : "opacity-65 cursor-not-allowed grayscale"}`}
        style={{
          boxShadow: usable
            ? `0 0 0 1px ${accent}, 0 0 24px -9px ${accent}, 0 16px 28px -14px rgba(0,0,0,.92)`
            : "0 0 0 1px rgba(255,255,255,.12)",
        }}
      >
        <span className="bd-skill-bar" style={{ background: accent }} />
        {skill && skill.img && !broken ? (
          <img src={skill.img} alt="" className="absolute inset-0 w-full h-full object-cover" onError={() => setBroken(true)} />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-gray-500 text-3xl">✦</div>
        )}
        {skill && (
          <span className={`bd-skill-cost ${useCost < skill.cost ? "bg-echo-ice text-gray-900" : "bg-[#0b1d3a]/85 text-white"}`}>
            {useCost}
          </span>
        )}
        {/* คูลดาวน์: ตัวเลขนับถอยหลังกลางการ์ด (การ์ดถูก disable อยู่แล้วจึงแสดงเป็นขาวดำ) */}
        {(cooldown || 0) > 0 && (
          <span className="absolute inset-0 z-20 grid place-items-center bg-black/60">
            <span className="text-3xl sm:text-4xl font-black text-white leading-none drop-shadow-[0_2px_4px_rgba(0,0,0,.9)]" style={{ fontFamily: P_DISPLAY }}>
              {cooldown}
            </span>
          </span>
        )}
        {dataLost && (
          <span className="absolute inset-0 z-20 grid place-items-center text-center bg-black/70 leading-tight" style={{ fontFamily: P_DISPLAY }}>
            <span>
              <span className="block text-sm font-black text-[#ff8fab]">DATA LOST</span>
              <span className="block text-xs font-bold text-white">ข้อมูลสูญหาย</span>
              <span className="block text-[11px] text-white/80">อีก {lost.turns} เทิร์น</span>
            </span>
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
      <div className="text-sm sm:text-base font-bold text-center leading-tight" style={{ fontFamily: P_DISPLAY }}>
        {label}{hasAmmo && <span className="text-echo-cyan"> · {ammoLeft}/{skill.ammo}</span>}
      </div>
    </div>
  );
}
