// แผงตัวเรา (จอคอม/แท็บเล็ต) — กระจกน้ำเงินตัดมุม ตามดีไซน์ HudMain ที่ผู้ใช้อนุมัติ
//  ซ้ายล่าง = แผงตัวละคร+แต้มสกิล · กลางล่าง = แต้ม/มือไพ่/จั่ว-เปิดไพ่ · ขวาล่าง = กระเป๋า/ร้านค้า/สกิล · ซ้ายบน = รอบ/เวลา/ภูมิภาค
//  คอมโพเนนต์ในไฟล์นี้วาดอย่างเดียว — เงื่อนไขกดได้/ไม่ได้ทั้งหมดส่งมาจาก GameBoard (Game.jsx) ผ่าน props
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { PERMANENT_STATUS_KEYS } from "../../data/permanentStatus";
import "./hud.css";

// สีประจำหมวดสถานะ (จาก cls ของ STATUS_INFO) — ใช้ย้อมช่องไอคอนกับตัวเลข
const TONES = [
  ["bg-echo-hp", "#ff6b81"],
  ["bg-echo-ice", "#f0c868"],
  ["bg-echo-magenta", "#e59ae0"],
  ["bg-echo-cyan", "#7fe0d0"],
  ["bg-echo-armor", "#7fb8e6"],
  ["bg-orange-500", "#f7a14a"],
  ["bg-purple-700", "#c084fc"],
];
function toneOf(cls = "") {
  const hit = TONES.find(([k]) => cls.split(" ").includes(k));
  return hit ? hit[1] : "#a9bcd6";
}
function hexA(h, a) {
  const n = parseInt(h.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}

// ป้ายภาษาอังกฤษจาก statusEntries → ไทย/ทับศัพท์ (แปลเฉพาะใน HUD ไม่แตะข้อมูลต้นทาง)
//  ชื่อเฉพาะ (ชื่อท่า/ชื่ออาวุธ/ชื่อร่าง เช่น Resentful Scabbard, Rider Kick, Mark 42, PUT ON) คงเดิม
const LABEL_TH = [
  ["Sun Charge", "ชาร์จสุริยะ"],
  ["Solar", "โซลาร์"],
  ["Energy", "พลังงาน"],
  ["Stamina ชาร์จ", "ชาร์จสตามินา"],
  ["Dempsey Charge", "ชาร์จเดมป์ซีย์"],
  ["[Armor]", "อาร์เมอร์"],
  ["Poise", "พอยส์"],
];
function thLabel(label = "") {
  let out = String(label);
  for (const [en, th] of LABEL_TH) out = out.split(en).join(th);
  return out;
}

// ทรัพยากรตัวละคร = รายการที่ไม่ได้มาจาก p.statuses และมีตัวนับ "x/y" ในชื่อ (Energy 4/16, กระสุน 2/3 …)
const COUNTER_RE = /(\d+)\s*\/\s*(\d+)/;
function splitEntries(entries, raw) {
  const res = [];
  const list = [];
  for (const it of entries) {
    const m = !(raw && it.key in raw) && COUNTER_RE.exec(it.label || "");
    if (m) {
      const label = it.label.replace(m[0], "").replace(/\s+/g, " ").replace(/^[\s·]+|[\s·]+$/g, "");
      res.push({ ...it, short: thLabel(label || it.label), cur: Number(m[1]), max: Number(m[2]) });
    } else list.push(it);
  }
  return { res, list };
}

// ป้ายตัวเลขท้ายแถว: จำนวนซ้อนทับ · เทิร์นที่เหลือ / สแตค / ถาวร
function statusValue(it, raw) {
  const parts = [];
  if (it.amt > 0) parts.push(`+${it.amt}`);
  const v = it.v || 0;
  const isRaw = !!raw && it.key in raw;
  if (v >= 99) parts.push("ถาวร");
  else if (v > 1 && !String(it.label).includes(String(v))) {
    parts.push(isRaw && !PERMANENT_STATUS_KEYS.has(it.key) ? `${v} เทิร์น` : `×${v}`);
  }
  return parts.join(" · ");
}

function IconTile({ icon, tone, size = 28 }) {
  return (
    <span className="hud-ico" style={{ width: size, height: size, background: hexA(tone, 0.18), boxShadow: `inset 0 0 0 1px ${hexA(tone, 0.35)}` }} aria-hidden="true">
      {icon}
    </span>
  );
}

function Cells({ n, on, color, h, solidOver = 16 }) {
  if (n > solidOver) {
    return (
      <span className="hud-cells hud-cells-solid" style={{ height: h }}>
        <span style={{ width: `${Math.max(0, Math.min(1, on / n)) * 100}%`, background: color }} />
      </span>
    );
  }
  return (
    <span className="hud-cells">
      {Array.from({ length: n }, (_, i) => (
        <span key={i} style={{ height: h, background: i < on ? color : "rgba(255,255,255,0.12)" }} />
      ))}
    </span>
  );
}

// ---------- ซ้ายล่าง: แผงตัวละคร (ดีไซน์ E1 ปรับ) ----------
//  รูปหกเหลี่ยมด้านแบน (ขอบทอง→ฟ้า) เกยซ้ายของแผงเฉียง · ชื่อ+ทีม+ป้ายตัวละคร · เลือด/เกราะเป็นช่องเฉียงนับได้
//  ใต้แผง: แผงแต้มสกิลแยก (ม่วง) + แถบทรัพยากรตัวละคร ต่อลงมา — เลื่อนไปพร้อมกันทั้งชุด
//  รายการสถานะอยู่ในลิ้นชักซ้าย (HudStatusDrawer)
export function HudPanel({ portrait, hexPortrait = true, name, onName, teamId, teamColor, chips, vitals, sp = 0, spMax = 0, statuses = [], rawStatuses }) {
  const [openKey, setOpenKey] = useState(null);
  const { res } = splitEntries(statuses, rawStatuses);
  const toggle = (k) => setOpenKey((o) => (o === k ? null : k));
  return (
    <div className="hud-prof">
      <div className="hud-prof-top">
        <div className="hud-prof-portrait">
          {hexPortrait ? (
            <button type="button" className="hud-portrait-hex" onClick={onName} aria-label="รายละเอียดตัวละคร">
              <span className="hud-hexframe-dark" aria-hidden="true" />
              <span className="hud-hexframe-in">{portrait}</span>
            </button>
          ) : (
            <div className="hud-portrait-twins">{portrait}</div>
          )}
        </div>
        <section className="hud-prof-card" aria-label="ตัวละครของเรา">
          <div className="hud-name-row">
            <button type="button" className="hud-name" onClick={onName} title="รายละเอียดตัวละคร">{name}</button>
            {teamId && <span className="hud-team" style={{ background: teamColor }}>ทีม {teamId}</span>}
            <span className="hud-chips">{chips}</span>
          </div>
          {vitals}
        </section>
      </div>
      <section className="hud-sp-strip" aria-label="แต้มสกิล" title={`แต้มสกิล ${sp}/${spMax}`}>
        <span className="hud-sp-label">แต้มสกิล</span>
        <span className="hud-pips">
          {Array.from({ length: spMax }, (_, i) => <span key={i} data-on={i < sp ? "true" : "false"} />)}
        </span>
        <span className="hud-sp-num">{sp}<span>/{spMax}</span></span>
      </section>
      {res.map((it) => (
        <ResourceRow key={it.key} it={it} open={openKey === it.key} onToggle={() => toggle(it.key)} />
      ))}
    </div>
  );
}

// ---------- ลิ้นชักสถานะ (ชิดขอบซ้ายจอ) ----------
//  ปิด = เหลือแท็บเล็กติดขอบซ้าย (ไอคอน + จำนวน) · กดแท็บ = สไลด์ออกจากซ้าย · กดซ้ำ/ปุ่มปิด/Esc = สไลด์กลับ
//  ในลิ้นชักเป็นรายการแนวตั้งเลื่อนลงอย่างเดียว แตะแถวกางรายละเอียด · ความสูงพอดีเนื้อหา ไม่เกินพื้นที่เหนือแผงผู้เล่น
export function HudStatusDrawer({ statuses = [], rawStatuses, statusAlt, onOpenAll, lowQ = false, defaultOpen = false, defaultOpenKey = null }) {
  const [open, setOpen] = useState(defaultOpen);
  const [openKey, setOpenKey] = useState(defaultOpenKey);
  const panelRef = useRef(null);

  const tabRef = useRef(null);
  const { list } = splitEntries(statuses, rawStatuses);
  const toggle = (k) => setOpenKey((o) => (o === k ? null : k));
  // ปิดอยู่ = เนื้อหาในลิ้นชักห้ามรับโฟกัส (อยู่นอกจอ)
  useLayoutEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    if (open) el.removeAttribute("inert");
    else {
      if (el.contains(document.activeElement)) tabRef.current?.focus({ preventScroll: true });
      el.setAttribute("inert", "");
    }
  }, [open]);
  // Esc = ปิดลิ้นชัก
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  return (
    <div className="hud-drawer" data-open={open ? "true" : "false"} data-instant={lowQ ? "true" : "false"}>
      <section ref={panelRef} id="hud-status-drawer" className="hud-drawer-panel hud-glass" aria-label="สถานะ">
        <div className="hud-st-head">
          <span className="hud-st-title">สถานะ</span>
          <span className="hud-st-tools">
            <span className="hud-count">{list.length}</span>
            {onOpenAll && (
              <button type="button" className="hud-open-all" onClick={onOpenAll} aria-label="ดูสถานะทั้งหมด" title="ดูสถานะทั้งหมด">
                <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
              </button>
            )}
            <button type="button" className="hud-open-all" onClick={() => setOpen(false)} aria-label="ปิด" title="ปิด">
              <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
            </button>
          </span>
        </div>
        {statusAlt || <StatusList items={list} raw={rawStatuses} openKey={openKey} onToggle={toggle} />}
      </section>
      <button
        ref={tabRef}
        type="button"
        className="hud-drawer-tab"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="hud-status-drawer"
        aria-label={open ? "ปิดสถานะ" : `สถานะ ${list.length}`}
        title="สถานะ"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
        <span className="hud-drawer-count">{list.length}</span>
      </button>
    </div>
  );
}

// แถบทรัพยากรตัวละคร: ทรงเฉียงแบบเดียวกับแผงแต้มสกิล ต่อลงมาใต้แผง (แตะเพื่อกางรายละเอียด)
function ResourceRow({ it, open, onToggle }) {
  const tone = toneOf(it.cls);
  const id = `hud-rs-${it.key}`;
  return (
    <div className="hud-res-strip" data-open={open ? "true" : "false"} style={{ "--tone": tone, "--tone-bg": hexA(tone, 0.14) }}>
      <button type="button" className="hud-res-btn" onClick={it.desc ? onToggle : undefined} aria-expanded={it.desc ? open : undefined} aria-controls={it.desc ? id : undefined}>
        <IconTile icon={it.icon} tone={tone} size={26} />
        <span className="hud-res-label">{it.short}</span>
        <Cells n={it.max} on={it.cur} color={tone} h={10} />
        <span className="hud-res-num">{it.cur}/{it.max}</span>
      </button>
      {open && it.desc && <div id={id} className="hud-res-desc">{it.desc}</div>}
    </div>
  );
}

// รายการสถานะแนวตั้ง เลื่อนลงอย่างเดียว · แตะแถวเพื่อดูรายละเอียดในแถวเอง
function StatusList({ items, raw, openKey, onToggle, max }) {
  const boxRef = useRef(null);
  const innerRef = useRef(null);
  const [more, setMore] = useState(false);
  // ยังเลื่อนลงต่อได้ไหม (โชว์เงาจางขอบล่าง)
  const measure = () => {
    const el = boxRef.current;
    if (el) setMore(el.scrollHeight - el.scrollTop - el.clientHeight > 4);
  };
  // เนื้อหาเปลี่ยน (สถานะมา/ไป/กางรายละเอียด) → วัดใหม่ผ่าน ResizeObserver
  useLayoutEffect(() => {
    if (typeof ResizeObserver === "undefined" || !innerRef.current) return undefined;
    const box = boxRef.current;
    const ro = new ResizeObserver(() => setMore(box.scrollHeight - box.scrollTop - box.clientHeight > 4));
    ro.observe(innerRef.current);
    ro.observe(boxRef.current);
    return () => ro.disconnect();
  }, []);
  return (
    <div className="hud-st-wrap">
      <div ref={boxRef} className="hud-st-list" style={max ? { maxHeight: max } : undefined} onScroll={measure}>
        <div ref={innerRef} className="hud-st-inner">
          {items.length === 0 && <div className="hud-st-empty">ไม่มีสถานะ</div>}
          {items.map((it) => {
            const tone = toneOf(it.cls);
            const open = openKey === it.key;
            const val = statusValue(it, raw);
            const id = `hud-st-${it.key}`;
            return (
              <div key={it.key} className="hud-row" data-open={open ? "true" : "false"}>
                <button type="button" className="hud-row-btn" onClick={it.desc ? () => onToggle(it.key) : undefined} aria-expanded={it.desc ? open : undefined} aria-controls={it.desc ? id : undefined}>
                  <IconTile icon={it.icon} tone={tone} />
                  <span className="hud-row-label">{thLabel(it.label)}</span>
                  {val && <span className="hud-pill" style={{ color: tone }}>{val}</span>}
                </button>
                {open && it.desc && <div id={id} className="hud-row-desc">{it.desc}</div>}
              </div>
            );
          })}
        </div>
      </div>
      {more && <div className="hud-st-fade" aria-hidden="true" />}
    </div>
  );
}

// ---------- กลางล่าง: แต้ม · มือไพ่ · จั่ว/เปิดไพ่ ----------
export function HudCenter({ score, busted, handRef, hand, draw, reveal }) {
  return (
    <div className="hud-center-in">
      <div className="hud-hand-row">
        <div className="hud-score">
          <span className="hud-score-label">แต้ม</span>
          <span className="hud-medal" data-busted={busted ? "true" : "false"}>{busted ? "แต้มเกิน" : (score != null ? score : "???")}</span>
        </div>
        <div ref={handRef} className="hud-hand">{hand}</div>
      </div>
      <div className="hud-actions">
        <button type="button" className="hud-btn hud-btn-draw" disabled={draw.disabled} onClick={draw.onClick}>จั่ว</button>
        <button type="button" className="hud-btn hud-btn-reveal" disabled={reveal.disabled} onClick={reveal.onClick}>เปิดไพ่</button>
      </div>
    </div>
  );
}

// ---------- ขวาล่าง: กระเป๋า · ร้านค้า · ตราสกิล 3 ช่อง ----------
function BagIcon() {
  return (
    <svg viewBox="0 0 32 32" width="48" height="48" aria-hidden="true">
      <path d="M11 10V8a5 5 0 0 1 10 0v2" fill="none" stroke="#bee3f8" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M6 11h20l-1.5 16a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2Z" fill="#3d8bd9" stroke="#bee3f8" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M11 16h10" stroke="#e6f2fb" strokeWidth="1.8" strokeLinecap="round" />
      <rect x="14" y="14.5" width="4" height="4" rx="1" fill="#f0c868" />
    </svg>
  );
}
function ShopIcon() {
  return (
    <svg viewBox="0 0 32 32" width="34" height="34" aria-hidden="true">
      <path d="M5 12 7 5h18l2 7Z" fill="#f0c868" />
      <path d="M5 12q3 3 6 0q3 3 5 0q2 3 5 0q3 3 6 0" fill="#c4902a" />
      <rect x="7" y="13" width="18" height="14" fill="none" stroke="#f0c868" strokeWidth="2" />
      <rect x="13" y="19" width="6" height="8" fill="#f0c868" />
    </svg>
  );
}
export function HudRight({ extras, bagCount = 0, onBag, gold = 0, showShop = true, onShop, skills }) {
  return (
    <section className="hud-right-in" aria-label="สกิล">
      <div className="hud-extras">{extras}</div>
      <div className="hud-bag-row">
        <button type="button" className="hud-bag" onClick={onBag} aria-label="กระเป๋า" title="กระเป๋า">
          <BagIcon />
          {bagCount > 0 && <span className="hud-bag-badge">{bagCount}</span>}
        </button>
        {showShop && (
          <button type="button" className="hud-shop" onClick={onShop}>
            <ShopIcon />
            <span>ร้านค้า</span>
            <span className="hud-shop-gold"><span className="hud-coin" aria-hidden="true">฿</span>{gold}</span>
          </button>
        )}
      </div>
      <div className="hud-skills">{skills}</div>
    </section>
  );
}

// ---------- กล่องรวมทั้งสามกลุ่ม + เลื่อนลงซ่อนตอนเลือกเป้าหมาย ----------
//  hidden = กำลังเลือกเป้าหมาย/เป็นฝ่ายโจมตี — แผงทั้งหมด (รวมลิ้นชักสถานะ) หลบพ้นจอ เหลือแค่ปุ่มลูกศรไว้เรียกกลับมาดูชั่วคราว
//  zoom = ตัวคูณขนาด (หน่วยฐานดีไซน์ 1440×810 → px ของกระดาน) แต่ละกลุ่มขยายจากมุมที่ยึดไว้
//  กลุ่มกลางวางในช่องว่างจริงระหว่างซ้ายกับขวา (วัดจริง) — ความกว้างไม่พอ = ย่อทั้งชุดลงจนเรียงได้ ห้ามทับกันเด็ดขาด
const EDGE_L = 18; // ระยะขอบ (หน่วยฐาน)
const EDGE_R = 20;
const GAP = 16;
export function SelfHud({ hidden = false, lowQ = false, zoom = 1, panel, center, right, drawer }) {
  const dockRef = useRef(null);
  const leftRef = useRef(null);
  const centerRef = useRef(null);
  const rightRef = useRef(null);
  const [m, setM] = useState({ dockW: 0, leftW: 520, leftH: 240, centerW: 344, rightW: 442 });
  // วัดขนาดจริงของแต่ละกลุ่ม (ก่อนขยาย) + ความกว้างกระดาน
  useLayoutEffect(() => {
    const els = [dockRef.current, leftRef.current, centerRef.current, rightRef.current];
    if (els.some((e) => !e) || typeof ResizeObserver === "undefined") return undefined;
    const read = () => setM({
      dockW: els[0].clientWidth,
      leftW: els[1].offsetWidth,
      leftH: els[1].offsetHeight,
      centerW: els[2].offsetWidth,
      rightW: els[3].offsetWidth,
    });
    const ro = new ResizeObserver(read);
    els.forEach((e) => ro.observe(e));
    return () => ro.disconnect();
  }, []);
  const [peek, setPeek] = useState(false);
  const [prevHidden, setPrevHidden] = useState(hidden);
  if (prevHidden !== hidden) {
    setPrevHidden(hidden);
    setPeek(false);
  }
  const away = hidden && !peek;
  // ซ่อนแล้วห้ามโฟกัสค้างในแผง (React 18 ยังไม่รองรับ prop inert → ตั้ง attribute เอง)
  useLayoutEffect(() => {
    const el = dockRef.current;
    if (!el) return;
    if (away) {
      if (el.contains(document.activeElement)) document.activeElement.blur();
      el.setAttribute("inert", "");
    } else el.removeAttribute("inert");
  }, [away]);

  // ความกว้างรวมที่ต้องใช้ (หน่วยฐาน) → ถ้ากระดานแคบกว่า ย่อตัวคูณลงจนสามกลุ่มเรียงแถวเดียวได้พอดี
  const need = EDGE_L + m.leftW + GAP + m.centerW + GAP + m.rightW + EDGE_R;
  const k = m.dockW ? Math.min(zoom, m.dockW / need) : zoom;
  // ช่องว่างระหว่างกลุ่มซ้ายกับขวา (px ของกระดาน) — กลุ่มกลางอยู่กลางจอถ้าได้ ไม่งั้นเลื่อนเข้าช่องว่าง
  const gapL = (EDGE_L + m.leftW + GAP) * k;
  const gapR = m.dockW - (EDGE_R + m.rightW + GAP) * k;
  const cw = m.centerW * k;
  const cx = m.dockW ? Math.min(Math.max(m.dockW / 2, gapL + cw / 2), Math.max(gapL + cw / 2, gapR - cw / 2)) : null;
  return (
    <>
      <div
        ref={dockRef}
        className="hud-dock"
        data-away={away ? "true" : "false"}
        data-instant={lowQ ? "true" : "false"}
        aria-hidden={away ? "true" : undefined}
        style={{ "--hud-k": k, "--hud-panel-h": `${m.leftH}px` }}
      >
        {drawer && <div className="hud-drawer-zone">{drawer}</div>}
        <div ref={leftRef} className="hud-grp hud-left">{panel}</div>
        <div ref={centerRef} className="hud-grp hud-center" style={cx != null ? { left: cx } : undefined}>{center}</div>
        <div ref={rightRef} className="hud-grp hud-right">{right}</div>
      </div>
      {hidden && (
        <button type="button" className="hud-peek" style={{ "--hud-k": k }} data-peek={peek ? "true" : "false"} onClick={() => setPeek((v) => !v)} aria-expanded={peek} aria-label={peek ? "ซ่อนแผงผู้เล่น" : "แสดงแผงผู้เล่น"}>
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M6 15l6-6 6 6" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      )}
    </>
  );
}

// ---------- ซ้ายบน: กลางวัน/คืน · รอบ · เวลา · ภูมิภาค ----------
function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <circle cx="12" cy="12" r="5" fill="#f0c868" />
      <path d="M12 1.5V4M12 20v2.5M1.5 12H4M20 12h2.5M4.6 4.6l1.8 1.8M17.6 17.6l1.8 1.8M4.6 19.4l1.8-1.8M17.6 6.4l1.8-1.8" stroke="#f0c868" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <path d="M15 3a9 9 0 1 0 6 12A7 7 0 1 1 15 3Z" fill="#bcd3ea" />
    </svg>
  );
}
export function HudTopBar({ night, round, timer, journey, onJourney, zoom = 1 }) {
  if (round == null && !journey) return null;
  return (
    <div className="hud-top hud-glass" style={{ "--hud-k": zoom }}>
      <span className="hud-top-cycle" title={night ? "กลางคืน" : "กลางวัน"}>{night ? <MoonIcon /> : <SunIcon />}</span>
      {round != null && (
        <>
          <span className="hud-top-round"><span className="hud-top-k">รอบที่</span><span className="hud-top-n">{round}</span></span>
          {timer}
        </>
      )}
      {journey && (
        <>
          {round != null && <span className="hud-top-div" aria-hidden="true" />}
          <button type="button" className="hud-top-region" onClick={onJourney} title="ผลของภูมิภาคนี้">
            <span className="hud-top-gem" style={{ background: `linear-gradient(135deg, ${journey.glow || journey.color}, ${journey.color})` }}>
              <span>{journey.numeral}</span>
            </span>
            <span className="hud-top-text">
              <span className="hud-top-name">{journey.name}</span>
              <span className="hud-top-sub">{journey.turnsLeft != null ? `อีก ${journey.turnsLeft} เทิร์น` : "ปลายทางสุดท้าย"}</span>
            </span>
          </button>
        </>
      )}
    </div>
  );
}
