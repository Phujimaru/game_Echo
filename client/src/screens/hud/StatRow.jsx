// แถววัดค่า (เลือด/เกราะ/แต้มสกิล) + ชิปค่าพิเศษ — ใช้ร่วมกันทั้งการ์ดผู้เล่นอื่นและแผงตัวเรา (ย้ายออกมาจาก Game.jsx)

// ---------- แถววัดค่า: ไอคอน + ช่องนับหน่วย + ตัวเลข ----------
//  สีอย่างเดียวแยกเลือดกับเกราะไม่ออก จึงใช้สัญญาณซ้อนกันสามชั้น:
//   1) ไอคอนนำหน้าแถว (หัวใจ / โล่)  2) ตัวเลขจริงท้ายแถว (3/6)
//   3) รูปทรงของช่อง — เลือดเป็นแคปซูลมน เกราะเป็นทรงโล่ปลายแหลม (มองเห็นต่างแม้ภาพขาวดำ)
function HeartGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="sr-ico" aria-hidden="true">
      <path d="M12 21s-8-5.2-8-10.4A4.6 4.6 0 0 1 12 7a4.6 4.6 0 0 1 8 3.6C20 15.8 12 21 12 21Z" fill="#ff8a94" stroke="#5c0f1d" strokeWidth="1.4" />
    </svg>
  );
}
function ShieldGlyph({ tone }) {
  return (
    <svg viewBox="0 0 24 24" className="sr-ico" aria-hidden="true">
      <path d="M12 2 21 6v6c0 5-9 10-9 10S3 17 3 12V6Z" fill={tone === "orange" ? "#fdba74" : "#8ec5ff"} stroke={tone === "orange" ? "#7c2d12" : "#0e2c4c"} strokeWidth="1.4" />
    </svg>
  );
}

// เกินจำนวนนี้แล้วช่องแต่ละช่องจะแคบกว่า ~4px = นับไม่ออก เปลี่ยนไปใช้หลอดต่อเนื่องที่มีขีดแบ่งหน่วยแทน
//  เพดานจริงในเกมโตได้เกินค่าพื้นฐานเยอะ: ผู้วิงวอนเกราะ 5 · แบทแมนบนรถ 7 · ฮิคารุ MonsterLive +2
//  · เกราะสวมวิญญาณ/ยุคทอง +1 ต่อชั้น · และเลือดชั่วคราว/เกราะศรัทธายังต่อท้ายหลอดอีก
const SEG_LIMIT = 9;
const SEG_LIMIT_BIG = 14;

// รอยร้าว (โทโนะ ชิกิ): วงขอบสีม่วงรอบไอคอนเกราะ ไล่เติมทีละขั้นจนครบ 8 = ม่วงทั้งวง
const CRACK_MAX = 8;
function CrackRing({ n, children }) {
  if (!(n > 0)) return children;
  const r = 10.5;
  const c = 2 * Math.PI * r;
  const filled = (Math.min(n, CRACK_MAX) / CRACK_MAX) * c;
  return (
    <span className="sr-crack" title={`รอยร้าว ${n}/${CRACK_MAX}`}>
      {children}
      <svg viewBox="0 0 24 24" className="sr-crack-ring" aria-hidden="true">
        <circle cx="12" cy="12" r={r} fill="none" stroke="rgba(168,85,247,.25)" strokeWidth="2.2" />
        <circle cx="12" cy="12" r={r} fill="none" stroke="#c084fc" strokeWidth="2.2" strokeLinecap="round"
          strokeDasharray={`${filled} ${c}`} transform="rotate(-90 12 12)" />
      </svg>
    </span>
  );
}

export function StatRow({ kind, value, max, extra = 0, extraLabel, big, tone, crack = 0 }) {
  // ทาคุมิ ฟุจิวาระ: ถึงจะมองไม่เห็น แต่ฉันยังอยู่ — ค่าถูกซ่อนเป็น null
  if (max == null) {
    return (
      <div className={`sr ${big ? "sr-big" : ""}`} title="ถูกซ่อน (ถึงจะมองไม่เห็น แต่ฉันยังอยู่)">
        {kind === "hp" ? <HeartGlyph /> : <ShieldGlyph tone={tone} />}
        <span className="sr-num">🌑 ???</span>
      </div>
    );
  }
  const total = max + extra;
  const label = `${kind === "hp" ? "พลังชีวิต" : "เกราะ"} ${value}/${max}${extra > 0 && extraLabel ? ` · ${extraLabel} ${extra}` : ""}`;
  const icon = kind === "hp" ? <HeartGlyph /> : <CrackRing n={crack}><ShieldGlyph tone={tone} /></CrackRing>;
  const num = <span className="sr-num">{value}<span className="sr-max">/{max}</span></span>;

  // หลอดต่อเนื่อง: ขีดแบ่งทุกหน่วยยังวาดอยู่ จึงนับได้เหมือนเดิมถ้าอยากนับ
  if (total > (big ? SEG_LIMIT_BIG : SEG_LIMIT)) {
    return (
      <div className={`sr ${big ? "sr-big" : ""}`} data-kind={kind} data-tone={tone || undefined} title={label}>
        {icon}
        <span className="sr-track sr-solid" style={{ "--n": total }}>
          <span className={`sr-fill sr-${kind}`} style={{ width: `${(Math.min(value, max) / total) * 100}%` }} />
          {extra > 0 && (
            <span className="sr-fill sr-tmp" style={{ left: `${(max / total) * 100}%`, width: `${(extra / total) * 100}%` }} />
          )}
        </span>
        {num}
      </div>
    );
  }

  const cells = [];
  for (let i = 0; i < max; i++) cells.push(i < value ? kind : "off");
  for (let i = 0; i < extra; i++) cells.push("tmp"); // ส่วนเกินเพดาน (เลือดชั่วคราว / เกราะศรัทธา) ต่อท้ายเป็นช่องสีทอง
  return (
    <div className={`sr ${big ? "sr-big" : ""}`} data-kind={kind} data-tone={tone || undefined} title={label}>
      {icon}
      <span className="sr-track">
        {cells.map((c, i) => <span key={i} className={`sr-cell sr-${c}`} />)}
      </span>
      {num}
    </div>
  );
}

// แต้มสกิล: แถวเดียวกันกับเลือด/เกราะ มีป้าย SP นำหน้าและตัวเลขท้ายแถวเหมือนกัน
export function SpRow({ p, big }) {
  // ซาโตรุ / ทาคุมิ: แต้มสกิลถูกซ่อนจากผู้เล่นอื่น
  if (p.skillPoints < 0) {
    return <div className={`sr ${big ? "sr-big" : ""}`} title="แต้มสกิลถูกซ่อน"><span className="sr-sp-label">SP</span><span className="sr-num">🌩️ ???</span></div>;
  }
  return (
    <div className={`sr ${big ? "sr-big" : ""}`} data-kind="sp" title={`แต้มสกิล ${p.skillPoints}/${p.maxSkill}`}>
      <span className="sr-sp-label">SP</span>
      <span className="sr-track">
        {Array.from({ length: p.maxSkill }, (_, i) => (
          <span key={i} className={`sr-cell ${i < p.skillPoints ? "sr-sp" : "sr-off"}`} />
        ))}
      </span>
      <span className="sr-num">{p.skillPoints}<span className="sr-max">/{p.maxSkill}</span></span>
    </div>
  );
}

// ค่าที่ไม่ได้นับเป็นหน่วยเต็มของเกจ (โล่ชั่วคราว/เกราะศรัทธา/เลือดโปรดิวเซอร์) — ชิปเล็กใต้การ์ด
export function VitalExtras({ p, className = "" }) {
  const bits = [];
  if (p.shield > 0) bits.push(["sh", `+🛡️${p.shield}`, "#7fd4ff", `โล่ชั่วคราว ${p.shield}`]);
  if (p.lumiProducerHp != null && !p.lumiIdolDown) bits.push(["pr", `🎧${p.lumiProducerHp}`, "#ff8ad0", `โปรดิวเซอร์เหลือพลังชีวิต ${p.lumiProducerHp}/${p.lumiProducerMax}`]);
  if (!bits.length) return null;
  return (
    <div className={`pc-extra ${className}`}>
      {bits.map(([k, t, c, title]) => (
        <span key={k} className="pc-extra-chip" style={{ color: c }} title={title}>{t}</span>
      ))}
    </div>
  );
}
