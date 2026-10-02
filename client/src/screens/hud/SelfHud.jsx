// แผงตัวเรา (จอคอม/แท็บเล็ต) — กระจกน้ำเงินตัดมุม ตามดีไซน์ HudMain ที่ผู้ใช้อนุมัติ
//  ซ้ายล่าง = แผงผู้เล่น · กลางล่าง = แต้ม/มือไพ่/จั่ว-เปิดไพ่ · ขวาล่าง = SP/กระเป๋า/ร้านค้า/สกิล · ซ้ายบน = รอบ/เวลา/ภูมิภาค
//  คอมโพเนนต์ในไฟล์นี้วาดอย่างเดียว — เงื่อนไขกดได้/ไม่ได้ทั้งหมดส่งมาจาก GameBoard (Game.jsx) ผ่าน props
import { useLayoutEffect, useRef, useState } from "react";
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

// ทรัพยากรตัวละคร = รายการที่ไม่ได้มาจาก p.statuses และมีตัวนับ "x/y" ในชื่อ (Energy 4/16, กระสุน 2/3 …)
const COUNTER_RE = /(\d+)\s*\/\s*(\d+)/;
function splitEntries(entries, raw) {
  const res = [];
  const list = [];
  for (const it of entries) {
    const m = !(raw && it.key in raw) && COUNTER_RE.exec(it.label || "");
    if (m) {
      const label = it.label.replace(m[0], "").replace(/\s+/g, " ").replace(/^[\s·]+|[\s·]+$/g, "");
      res.push({ ...it, short: label || it.label, cur: Number(m[1]), max: Number(m[2]) });
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

// ---------- ซ้ายล่าง: แผงผู้เล่น ----------
export function HudPanel({ portrait, hexPortrait = true, name, onName, teamId, teamColor, chips, vitals, statuses = [], rawStatuses, statusAlt, onOpenAll, listMax = 196, defaultOpen = null }) {
  const [openKey, setOpenKey] = useState(defaultOpen);
  const { res, list } = splitEntries(statuses, rawStatuses);
  const toggle = (k) => setOpenKey((o) => (o === k ? null : k));
  return (
    <section className="hud-panel hud-glass" aria-label="ผู้เล่น">
      <div className="hud-head">
        {hexPortrait ? (
          <button type="button" className="hud-hex" onClick={onName} aria-label="รายละเอียดตัวละคร">
            {portrait}
          </button>
        ) : (
          portrait
        )}
        <div className="hud-head-main">
          <div className="hud-name-row">
            <button type="button" className="hud-name" onClick={onName} title="รายละเอียดตัวละคร">{name}</button>
            {teamId && <span className="hud-team" style={{ background: teamColor }}>ทีม {teamId}</span>}
          </div>
          {vitals}
        </div>
      </div>
      <div className="hud-chips">{chips}</div>
      {res.length > 0 && (
        <div className="hud-res">
          {res.map((it) => (
            <ResourceRow key={it.key} it={it} open={openKey === it.key} onToggle={() => toggle(it.key)} />
          ))}
        </div>
      )}
      <div className="hud-st-head">
        <span className="hud-st-title">สถานะ</span>
        <span className="hud-st-tools">
          <span className="hud-count">{list.length}</span>
          {onOpenAll && (
            <button type="button" className="hud-open-all" onClick={onOpenAll} aria-label="ดูสถานะทั้งหมด" title="ดูสถานะทั้งหมด">
              <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            </button>
          )}
        </span>
      </div>
      {/* มีแถวทรัพยากรด้วย → รายการสถานะเตี้ยลงหน่อย แผงจะได้ไม่สูงจนทับที่นั่งคู่แข่งมุมซ้าย */}
      {statusAlt || <StatusList items={list} raw={rawStatuses} openKey={openKey} onToggle={toggle} max={res.length > 0 ? Math.min(listMax, 152) : listMax} />}
    </section>
  );
}

function ResourceRow({ it, open, onToggle }) {
  const tone = toneOf(it.cls);
  const id = `hud-rs-${it.key}`;
  return (
    <div className="hud-row hud-row-res" data-open={open ? "true" : "false"} style={{ background: hexA(tone, open ? 0.16 : 0.08) }}>
      <button type="button" className="hud-row-btn" onClick={it.desc ? onToggle : undefined} aria-expanded={it.desc ? open : undefined} aria-controls={it.desc ? id : undefined}>
        <IconTile icon={it.icon} tone={tone} />
        <span className="hud-res-label">{it.short}</span>
        <Cells n={it.max} on={it.cur} color={tone} h={8} />
        <span className="hud-res-num" style={{ color: tone }}>{it.cur}/{it.max}</span>
      </button>
      {open && it.desc && <div id={id} className="hud-row-desc">{it.desc}</div>}
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
      <div ref={boxRef} className="hud-st-list" style={{ maxHeight: max }} onScroll={measure}>
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
                  <span className="hud-row-label">{it.label}</span>
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

// ---------- ขวาล่าง: SP · กระเป๋า · ร้านค้า · สกิล 3 ช่อง ----------
export function HudRight({ sp, spMax, extras, bagCount = 0, onBag, gold = 0, showShop = true, onShop, skills }) {
  return (
    <section className="hud-right-in" aria-label="สกิล">
      <div className="hud-extras">{extras}</div>
      <div className="hud-sp-row">
        <div className="hud-sp hud-glass" title={`แต้มสกิล ${sp}/${spMax}`}>
          <span className="hud-sp-label">SP</span>
          {spMax > 16 ? (
            <span className="hud-cells hud-cells-solid" style={{ height: 14 }}><span style={{ width: `${(Math.max(0, sp) / spMax) * 100}%`, background: "#c99ad6" }} /></span>
          ) : (
            <span className="hud-sp-cells">
              {Array.from({ length: spMax }, (_, i) => <span key={i} data-on={i < sp ? "true" : "false"} />)}
            </span>
          )}
          <span className="hud-sp-num">{sp}/{spMax}</span>
        </div>
        <button type="button" className="hud-tab" onClick={onBag}>
          กระเป๋า{bagCount > 0 && <span className="hud-tab-badge">{bagCount}</span>}
        </button>
        {showShop && (
          <button type="button" className="hud-tab hud-tab-shop" onClick={onShop}>
            ร้านค้า · <span className="hud-num">{gold}</span>
          </button>
        )}
      </div>
      <div className="hud-skills">{skills}</div>
    </section>
  );
}

// ---------- กล่องรวมทั้งสามกลุ่ม + เลื่อนลงซ่อนตอนเลือกเป้าหมาย ----------
//  hidden = กำลังเลือกเป้าหมาย/เป็นฝ่ายโจมตี — แผงทั้งหมดเลื่อนลงพ้นจอ เหลือแค่ปุ่มแถบเล็กไว้เรียกกลับมาดูชั่วคราว
export function SelfHud({ hidden = false, lowQ = false, compact = false, panel, center, right }) {
  const dockRef = useRef(null);
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
  return (
    <>
      <div ref={dockRef} className="hud-dock" data-away={away ? "true" : "false"} data-instant={lowQ ? "true" : "false"} aria-hidden={away ? "true" : undefined}>
        <div className="hud-grp hud-left">{panel}</div>
        {compact ? (
          <div className="hud-grp hud-rcol">
            {center}
            {right}
          </div>
        ) : (
          <>
            <div className="hud-grp hud-center">{center}</div>
            <div className="hud-grp hud-right">{right}</div>
          </>
        )}
      </div>
      {hidden && (
        <button type="button" className="hud-peek" data-peek={peek ? "true" : "false"} onClick={() => setPeek((v) => !v)} aria-expanded={peek}>
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M6 15l6-6 6 6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
          แผงผู้เล่น
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
export function HudTopBar({ night, round, timer, journey, onJourney }) {
  if (round == null && !journey) return null;
  return (
    <div className="hud-top hud-glass">
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
