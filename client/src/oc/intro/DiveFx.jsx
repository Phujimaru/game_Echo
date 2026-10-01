// ============================================================
//  ชิ้นส่วน DOM ของจังหวะ "ดิ่งลงภูมิภาค" (ใช้ทั้งฉากเปิดแมตช์และฉากเปลี่ยนภูมิภาค) — สไตล์อยู่ใน dive.css
//  ตัวที่เปิด/ปิดตามเฟสใช้คลาสบนกรอบนอก: .ocd-p2/.ocd-p3 (ล็อก/ดิ่ง) · .is-crash (ชน/เผย)
// ============================================================
import { forwardRef, useMemo } from "react";
import { journeyArea } from "../../journey/areas";
import { REDUCED } from "./diveKit";

/** เส้นความเร็วตอนดิ่ง (reverse = พุ่งเข้าหากลางจอ ใช้ตอนถอยกล้องออก) */
export function DiveStreaks({ show, seed = 1, lowQ, reverse = false }) {
  const streaks = useMemo(() => {
    if (lowQ || REDUCED) return [];
    let s = 917 + seed * 31;
    const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    return Array.from({ length: 30 }, () => ({ a: rnd() * 360, d: rnd() * 0.5, t: 0.36 + rnd() * 0.3, w: 10 + rnd() * 18, echo: rnd() < 0.22 }));
  }, [lowQ, seed]);
  if (!show || !streaks.length) return null;
  return (
    <div className={`ocd-streaks${reverse ? " is-rev" : ""}`} aria-hidden="true">
      {streaks.map((s, i) => (
        <i key={i} className={s.echo ? "is-echo" : ""} style={{ "--a": `${s.a.toFixed(1)}deg`, "--w": `${s.w.toFixed(1)}vmax`, animationDelay: `${s.d.toFixed(2)}s`, animationDuration: `${s.t.toFixed(2)}s` }} />
      ))}
    </div>
  );
}

/** วงเล็บเล็งเป้า — ตำแหน่ง/สเกลตั้งจาก JS ทุกเฟรม */
export const DiveReticle = forwardRef(function DiveReticle(_, ref) {
  return (
    <div className="ocd-reticle" ref={ref} aria-hidden="true">
      <span className="ocd-ret-box"><i className="tl" /><i className="tr" /><i className="bl" /><i className="br" /></span>
      <span className="ocd-ret-cross" />
    </div>
  );
});

/** ป้ายภูมิภาคข้างเป้า (ภูมิภาค + เลขโรมัน + ชื่อ) — anchorRef ถูกเลื่อนตามจุดบนจอจาก JS */
export const RegionTag = forwardRef(function RegionTag({ area }, ref) {
  const A = journeyArea(area);
  return (
    <div className="ocd-tag-anchor" ref={ref}>
      <div className="ocd-tag" style={{ "--ac": A.color }}>
        <i className="ocd-tag-line" aria-hidden="true" />
        <span className="ocd-tag-k">ภูมิภาค <b className="oc-latin">{A.numeral}</b></span>
        <span className="ocd-tag-name">{A.name}</span>
      </div>
    </div>
  );
});

/** แฟลชขาว + คลื่นกระแทก + แถบชื่อภูมิภาค (เล่นเมื่อกรอบนอกได้ .is-crash) */
export function DiveImpact({ area, lowQ, banner = true }) {
  const A = journeyArea(area);
  return (
    <>
      <div className="ocd-flash" aria-hidden="true" />
      {!REDUCED && (
        <div className="ocd-shock" aria-hidden="true">
          <i className="r1" />
          {!lowQ && <i className="r2" />}
          {!lowQ && <i className="r3" />}
        </div>
      )}
      {banner && (
        <div className="ocd-banner">
          <span className="ocd-banner-k">ภูมิภาค <b className="oc-latin">{A.numeral}</b></span>
          <span className="ocd-banner-name">{A.name}</span>
        </div>
      )}
    </>
  );
}

export function Chrome({ children }) {
  return (
    <div className="ocd-chrome" aria-hidden="true">
      <i className="oc-tick tl" /><i className="oc-tick tr" /><i className="oc-tick bl" /><i className="oc-tick br" />
      <span className="ocd-mark oc-latin">ECHO · <b>ORDEAL CALL</b></span>
      {children}
    </div>
  );
}
