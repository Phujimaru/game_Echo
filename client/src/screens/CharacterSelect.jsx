import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { clickSound } from "../audio";
import { FALLBACK } from "../data/avatars";
import { POSITION_COLORS } from "../data/positions";
import GlobeCanvas from "../globe/GlobeCanvas";
import { OcScreen, OcPanel, OcButton } from "../oc/ui";
import { createCharRings } from "../oc/charselect/charRings";
import "../oc/charselect/charselect.css";

// หน้าเลือกตัวละคร (ORDEAL CALL): การ์ดตัวละครโคจรรอบลูกโลก หนึ่งวงต่อหนึ่งหมวด + แผงข้อมูลด้านขวา
//  ภาพรวม: ทุกวงโคจรรอบโลกคนละระนาบ · กดชื่อหมวด/การ์ด = ซูมเข้าวงนั้นวงเดียว · กดที่ว่าง/ปุ่ม "หมวดทั้งหมด"/Esc = ถอยกลับภาพรวม
const LAYOUT = { x: -0.4, y: -0.02, s: 0.86 };
const FOCUS_LAYOUT = { x: -0.45, y: 0.15, s: 0.9 };

const DIFFICULTY_GROUPS = [
  { key: "easy", label: "ง่าย", color: "#2E9E4B", order: ["hikaru", "mageslayer", "ignis", "daichi", "artoria_caster", "satoru"] },
  { key: "medium", label: "กลาง", color: "#E5B33B", order: ["temari", "miyako", "bat_ben", "escanor", "hisakawa_sister", "ippo", "cayenne", "oberon_summer", "reines"] },
  { key: "hard", label: "ยาก", color: "#C0392B", order: ["kotone", "bard", "shiki", "kai", "takumi", "the_supplicant", "recruit", "tohno", "andersen"] },
  { key: "fun", label: "เอาฮา", color: "#9B4F96", order: ["appleguy", "dan", "usagi"] },
  { key: "impossible", label: "ทักษิณ จะโปรหาบิดาท่านหรือ?", color: "#450a0a", order: ["nanaya", "princess_shiki"] },
  { key: "special", label: "พิเศษ", color: "#0e7490", order: ["ultraman_trigger", "yui", "shido", "brian", "producer_lumi", "kim", "striker"] },
  // หมวดตามสังกัด ไม่ใช่ระดับความยาก — ไรเดอร์ทุกคนที่มี Clock Up (แกนร่วม characters/_zect.js)
  { key: "zect", label: "องค์กรZectz", color: "#3B5BA5", order: ["daisuke", "yaguruma", "kagami", "tsurugi"] },
  // มหันตภัย: บอส (บอตเท่านั้น) — ดูข้อมูลได้แต่เลือกเล่นไม่ได้
  { key: "calamity", label: "มหันตภัย", color: "#7f1d1d", order: ["ort"] },
];
// ตัวที่ความยากไม่ตรงหมวดไหนเลย (ข้อมูลใหม่ที่ยังไม่ได้จัดหมวด) — รวมไว้วงสุดท้าย
const OTHER_GROUP = { key: "_other", label: "อื่นๆ", color: "#8BA3C2", order: [] };

function charsInGroup(roster, g) {
  const idx = (c) => { const i = g.order.indexOf(c.id); return i < 0 ? 999 : i; };
  return roster.filter((c) => !c.hidden && (c.difficulty || "easy") === g.key).sort((a, b) => idx(a) - idx(b));
}

function Thumb({ c, dim }) {
  const [broken, setBroken] = useState(null);
  if (c.img && broken !== c.img) {
    return (
      <div className={`cs-thumb${dim ? " dim" : ""}`}>
        <img src={c.img} alt="" decoding="async" onError={() => setBroken(c.img)} />
      </div>
    );
  }
  return <div className="cs-thumb emoji" aria-hidden="true">{FALLBACK[c.avatar] || "🙂"}</div>;
}

// lostChars / blockedChars / confirmLabel / backLabel / title: ใช้ตอนเลือกตัวใหม่กลางโหมด Type Mercury
//  lostChars = ตัวที่ตายไปแล้วใน Raid ("ข้อมูลสูญหาย") · blockedChars = ตัวที่ใช้ไม่ได้ด้วยเหตุผลอื่น (เช่น unique ที่เพื่อนใช้อยู่)
const PAIR_ROLE_TEXT = {
  pilot: { t: "นักบิน", d: "จั่วการ์ด · เปิดการ์ด · เลือกเป้าโจมตี · ซ่อม · อนุมัติท่าไม้ตาย 2" },
  gunner: { t: "พลปืน", d: "ใช้สกิล · ซื้อของ · ใช้ไอเทม" },
};
const SHIKI_ULTS = [
  { k: "deatheye", t: "ท่า 1 · ฉันมองเห็นมันแล้ว" },
  {
    k: "wither",
    t: "ท่า 2 · ความตายที่โรยรา",
    d: "เลือกท่า 2: สกิลติดตัวจะมอบเส้นชีวิตน้อยลงเหลือ 1 หน่วยต่อครั้ง (จาก 2) และให้ได้สูงสุด 3 หน่วย — ท่าไม้ตาย 2 จะแจกเส้นชีวิตเพิ่มได้อีกสูงสุด 3 หน่วยต่อคน (รวมสูงสุด 6 = โอกาสสังหาร 60%)",
  },
];

// รายการสกิลที่แผงแสดง (ชุดเดียวกับหน้าเลือกตัวละครเดิมทุกกรณีพิเศษ)
function skillRows(sel) {
  const skills = [];
  if (!sel) return skills;
  const push = (label, s) => s && skills.push({ label, skill: s });
  push("ติดตัว", sel.passive);
  if (sel.id === "hisakawa_sister") push("ติดตัว 2", sel.passive2);
  if (sel.id === "nanaya") { push("ติดตัว 2", sel.passive2); push("ติดตัว 3", sel.passive3); }
  if (sel.id === "conner") { push("ติดตัว 2", sel.passive2); push("ติดตัว 3", sel.passive3); push("ติดตัว 4", sel.passive4); }
  if (sel.id === "cayenne") push("ติดตัว 2", sel.passive2);
  if (sel.pair) { push("ติดตัว 2", sel.passive2); push("ติดตัว 3", sel.passive3); }
  if (sel.id === "ort") { push("ติดตัว 2", sel.passive2); push("ติดตัว 3", sel.passive3); }
  push(sel.basicNight ? "สกิลพื้นฐาน (กลางวัน)" : "สกิลพื้นฐาน", sel.basic);
  if (sel.basicNight) push("สกิลพื้นฐาน (กลางคืน)", sel.basicNight);
  if (sel.id === "hisakawa_sister") push("สกิลพื้นฐาน 2 (เมื่อแฝดล้ม)", sel.basic2);
  push(sel.secondaryNight ? "สกิลรอง (กลางวัน)" : "สกิลรอง", sel.secondary);
  if (sel.secondaryNight) push("สกิลรอง (กลางคืน)", sel.secondaryNight);
  if (sel.id === "hisakawa_sister") push("สกิลรอง (ฮายาเตะ)", sel.secondary2);
  if (!sel.ultimateSolar) push(sel.ultimateNight ? "ท่าไม้ตาย (กลางวัน)" : sel.id === "shiki" ? "ท่าไม้ตาย 1" : "ท่าไม้ตาย", sel.ultimate);
  if (sel.id === "hisakawa_sister") { push("ท่าไม้ตาย 2 (ฮายาเตะ)", sel.ultimate2); push("ท่าไม้ตาย 3 (รวมพลัง)", sel.ultimate3); }
  if (sel.id === "shiki") push("ท่าไม้ตาย 2", sel.ultimate2);
  if (sel.pair) push("ท่าไม้ตาย 2", sel.ultimate2);
  if (sel.ultimateNight) push("ท่าไม้ตาย (กลางคืน)", sel.ultimateNight);
  if (sel.secondaryRevert) push("สกิลรอง (คืนร่าง)", sel.secondaryRevert);
  if (sel.ultimateSolar) push("ท่าไม้ตาย (โซล่า)", sel.ultimateSolar);
  if (sel.ultimateMars) push("ท่าไม้ตาย (มาร์)", sel.ultimateMars);
  if (sel.ultimateLuna) push("ท่าไม้ตาย (ลูน่า)", sel.ultimateLuna);
  if (sel.ultimateGodwing) push("ท่าไม้ตาย (ปีกแห่งสุริยัน)", sel.ultimateGodwing);
  return skills;
}

export default function CharacterSelect({ roster, position, color: myColor, name, takenChars = [], pairSlots = [], lostChars = [], blockedChars = [], confirmLabel = "ยืนยัน", backLabel = "ย้อนกลับ", title, onConfirm, onBack }) {
  const color = myColor || POSITION_COLORS[position] || "#9B4F96";

  const grouped = useMemo(() => {
    const gs = DIFFICULTY_GROUPS.map((g) => ({ ...g, chars: charsInGroup(roster, g) })).filter((g) => g.chars.length > 0);
    const rest = roster.filter((c) => !c.hidden && !DIFFICULTY_GROUPS.some((g) => (c.difficulty || "easy") === g.key));
    if (rest.length) gs.push({ ...OTHER_GROUP, chars: rest });
    return gs;
  }, [roster]);
  const orderedRoster = useMemo(() => grouped.flatMap((g) => g.chars), [grouped]);

  // ตัวละครคู่ที่ยังรอคู่หู = ยังเข้าร่วมได้ (เป็นคู่หู) แม้จะถูกเลือกไปแล้วหนึ่งคน
  const pairSlotOf = (c) => (c && c.pair ? pairSlots.find((s) => s.characterId === c.id) : null);
  // ไม่บอกว่าผู้เล่นคนอื่นเลือกใคร — ปิดเฉพาะตัว unique ที่ server แจ้งว่าถูกเลือกไปแล้ว
  const isTaken = (c) => !!c && !!c.unique && takenChars.includes(c.id) && !pairSlotOf(c);
  // เหตุผลที่เลือกตัวนี้ไม่ได้ (null = เลือกได้) — ตัวที่เลือกไม่ได้ยังกดดูข้อมูลได้
  const blockReason = (c) => {
    if (!c) return null;
    if (c.botOnly) return "บอสเท่านั้น";
    if (lostChars.includes(c.id)) return "ข้อมูลสูญหาย";
    if (isTaken(c)) return "ถูกเลือกไปแล้ว";
    if (blockedChars.includes(c.id)) return "ใช้ไม่ได้";
    return null;
  };
  const cardStatus = (c) => {
    const r = blockReason(c);
    if (r) return { label: r, tone: r === "ข้อมูลสูญหาย" ? "lost" : "block" };
    return c.locked ? { label: "ยังไม่ปลดล็อก", tone: "block" } : null;
  };

  const [picked, setPicked] = useState(null); // เปิดหน้ามายังไม่เลือกใคร
  const [focus, setFocus] = useState(null); // key หมวดที่ซูมอยู่ | null = ภาพรวม
  const [shikiUlt, setShikiUlt] = useState("deatheye");
  const [pairRole, setPairRole] = useState("pilot"); // ตัวละครคู่: บทบาทที่คนแรกเลือก
  const [desc, setDesc] = useState(null); // คำอธิบายที่ลอยข้างแผง { key, title, text, top|bottom, right }

  const sel = roster.find((c) => c.id === picked);
  const selGroup = sel ? grouped.find((g) => g.chars.some((c) => c.id === sel.id)) : null;
  const reason = blockReason(sel);
  const canConfirm = !!sel && !sel.locked && !reason;

  const ringsRef = useRef(null);
  const tipRef = useRef(null);
  const panelRef = useRef(null);

  const focusIdx = focus ? grouped.findIndex((g) => g.key === focus) : -1;
  const focusGroup = focusIdx >= 0 ? grouped[focusIdx] : null;

  const statusMap = {};
  orderedRoster.forEach((c) => { const s = cardStatus(c); if (s) statusMap[c.id] = s; });
  const statusKey = JSON.stringify(statusMap);
  useEffect(() => { ringsRef.current?.setStatus(JSON.parse(statusKey)); }, [statusKey]);
  // ลำดับสำคัญ: โฟกัสก่อน แล้วค่อยเลือก (select หมุนการ์ดมาหน้าสุดตามท่าทางของวงที่กำลังจะเป็น)
  useEffect(() => { ringsRef.current?.setFocus(focusIdx >= 0 ? focusIdx : null); }, [focusIdx]);
  useEffect(() => { ringsRef.current?.select(picked); }, [picked]);

  // Esc = ถอยกลับภาพรวม
  useEffect(() => {
    if (!focus) return undefined;
    const onKey = (e) => { if (e.key === "Escape") { e.stopPropagation(); setFocus(null); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focus]);

  const choose = (id) => {
    clickSound();
    setDesc(null);
    setPicked(id);
    if (id === picked) ringsRef.current?.select(id); // กดตัวเดิมซ้ำ (ที่หมุนออกไปแล้ว) = หมุนกลับมาหน้าสุด
    const g = grouped.find((x) => x.chars.some((c) => c.id === id));
    if (g) setFocus(g.key); // กดการ์ดจากภาพรวม = ซูมเข้าวงของการ์ดนั้นด้วย
  };
  const openGroup = (key) => {
    clickSound();
    ringsRef.current?.setHighlight(-1);
    setFocus(key);
  };
  const closeGroup = () => {
    clickSound();
    setFocus(null);
  };
  const onCardHover = (h, ev) => {
    const tip = tipRef.current;
    if (!tip) return;
    if (!h || !ev) { tip.hidden = true; return; }
    const c = cbRef.current.byId.get(h.id);
    const st = cbRef.current.statusMap[h.id];
    tip.textContent = c ? (st ? `${c.name} · ${st.label}` : c.name) : "";
    tip.hidden = false;
    const r = tip.parentElement.getBoundingClientRect();
    tip.style.transform = `translate(${ev.clientX - r.left}px, ${ev.clientY - r.top}px) translate(-50%, -150%)`;
  };
  // ฉาก 3 มิติเรียก callback ผ่าน ref เสมอ (ได้ค่าล่าสุดของหน้าจอ)
  const cbRef = useRef(null);
  useLayoutEffect(() => {
    cbRef.current = { choose, closeGroup, onCardHover, statusMap, focusIdx, picked, byId: new Map(roster.map((c) => [c.id, c])) };
  });

  const onReady = (core) => {
    const rings = createCharRings(core, grouped, {
      onSelect: (id) => cbRef.current.choose(id),
      onHover: (h, ev) => cbRef.current.onCardHover(h, ev),
      onEmpty: () => cbRef.current.closeGroup(),
    });
    const cb = cbRef.current;
    rings.setStatus(cb.statusMap);
    if (cb.focusIdx >= 0) rings.setFocus(cb.focusIdx, true);
    if (cb.picked) rings.select(cb.picked, true);
    ringsRef.current = rings;
    return () => { rings.dispose(); ringsRef.current = null; };
  };
  const ringsKey = grouped.map((g) => `${g.key}:${g.chars.map((c) => c.id).join(",")}`).join("|");

  // คำอธิบายลอยข้างแผง (ซ่อนไว้ จนกว่าจะชี้/โฟกัสแถว)
  const showDesc = (key, titleText, text) => (e) => {
    if (!text) return;
    const row = e.currentTarget.getBoundingClientRect();
    const panel = panelRef.current?.getBoundingClientRect();
    const scr = panelRef.current?.closest(".oc-screen")?.getBoundingClientRect() || { left: 0, top: 0, width: innerWidth, height: innerHeight };
    const right = scr.left + scr.width - (panel ? panel.left : row.left) + 12;
    const low = row.top - scr.top > scr.height * 0.58;
    setDesc({ key, title: titleText, text, right, ...(low ? { bottom: scr.top + scr.height - row.bottom } : { top: row.top - scr.top }) });
  };
  const hideDesc = (key) => () => setDesc((d) => (d && d.key === key ? null : d));
  const descProps = (key, titleText, text) => ({
    onMouseEnter: showDesc(key, titleText, text),
    onFocus: showDesc(key, titleText, text),
    onMouseLeave: hideDesc(key),
    onBlur: hideDesc(key),
  });

  const confirm = () => {
    if (!picked || sel?.locked || blockReason(sel)) return;
    if (sel?.pair) { onConfirm(picked, pairSlotOf(sel) ? { copilot: true } : { pairRole }); return; }
    onConfirm(picked, picked === "shiki" ? { shikiUlt } : undefined);
  };

  const skills = skillRows(sel);
  const slot = pairSlotOf(sel);

  return (
    <OcScreen className="cs-screen">
      <GlobeCanvas key={ringsKey} className={focusGroup ? "is-focus" : ""} layout={focusGroup ? FOCUS_LAYOUT : LAYOUT} drag={false} onReady={onReady} />

      {focusGroup ? (
        <div className="cs-nav cs-focus" key="focus">
          <button type="button" className="cs-back" onClick={closeGroup}>
            <span aria-hidden="true">←</span> หมวดทั้งหมด
          </button>
          <h2 className="cs-focus-name">
            <i className="oc-diamond" style={{ background: focusGroup.color }} />
            {focusGroup.label}
          </h2>
          {focusGroup.chars.length > 1 && (
            <div className="cs-spin" role="group" aria-label="หมุนวง">
              <button type="button" className="cs-spin-btn" aria-label="ก่อนหน้า" onClick={() => { clickSound(); ringsRef.current?.rotate(-1); }}>‹</button>
              <button type="button" className="cs-spin-btn" aria-label="ถัดไป" onClick={() => { clickSound(); ringsRef.current?.rotate(1); }}>›</button>
            </div>
          )}
        </div>
      ) : (
        <nav className="cs-nav cs-cats" key="cats" aria-label="หมวด" onMouseLeave={() => ringsRef.current?.setHighlight(-1)}>
          {grouped.map((g, i) => (
            <button
              key={g.key}
              type="button"
              className={`cs-cat${selGroup?.key === g.key ? " has-sel" : ""}`}
              onClick={() => openGroup(g.key)}
              onMouseEnter={() => ringsRef.current?.setHighlight(i)}
              onFocus={() => ringsRef.current?.setHighlight(i)}
              onBlur={() => ringsRef.current?.setHighlight(-1)}
            >
              <i className="oc-diamond" style={{ background: g.color }} />
              <span>{g.label}</span>
            </button>
          ))}
        </nav>
      )}

      <div className="cs-top oc-enter">
        {title && <h1 className="oc-h2">{title}</h1>}
        {position != null && (
          <span className="cs-me">
            <i className="oc-diamond" style={{ background: color }} />
            <span className="p">P{position}</span>
            <b>{name || "ผู้เล่น"}</b>
          </span>
        )}
      </div>

      <div className="cs-side" ref={panelRef}>
        <OcPanel className="oc-enter d1">
          <span className="oc-label">เลือกตัวละคร</span>

          {sel && (
            <div className="cs-head">
              <Thumb key={sel.id} c={sel} dim={!!reason} />
              <div className="cs-head-txt">
                <div className="cs-chips">
                  {selGroup && (
                    <span className="cs-group">
                      <i className="oc-diamond" style={{ background: selGroup.color }} />
                      {selGroup.label}
                    </span>
                  )}
                  {reason && <span className="cs-flag bad">{reason}</span>}
                  {!reason && sel.locked && <span className="cs-flag">ยังไม่ปลดล็อก</span>}
                </div>
                <h2 className="oc-h2">{sel.name}</h2>
              </div>
            </div>
          )}

          {skills.length > 0 && (
            <div className="cs-skills" key={`sk${sel?.id}`} onScroll={() => setDesc(null)}>
              {skills.map((s, i) => {
                const key = `s${i}`;
                const ult = s.label.startsWith("ท่าไม้ตาย");
                return (
                  <div
                    key={key}
                    className={`cs-sk${ult ? " ult" : ""}${desc?.key === key ? " on" : ""}`}
                    tabIndex={0}
                    aria-label={`${s.label} ${s.skill.name}${s.skill.cost != null ? ` ${s.skill.cost} แต้ม` : ""}. ${s.skill.desc || ""}`}
                    {...descProps(key, s.skill.name, s.skill.desc)}
                  >
                    <span className="cs-sk-k">{s.label}</span>
                    <span className="cs-sk-n">{s.skill.name}</span>
                    {s.skill.cost != null && <span className="cs-sk-c">{s.skill.cost}</span>}
                  </div>
                );
              })}
            </div>
          )}

          {sel?.pair && (
            <div className="cs-opts">
              {slot ? (
                <div className="cs-pair" tabIndex={0} {...descProps("pair", PAIR_ROLE_TEXT[slot.role]?.t, `${PAIR_ROLE_TEXT[slot.role]?.d || ""} · ใช้ที่นั่งเดียวกับคู่หู`)}>
                  <i className="oc-diamond" style={{ background: "var(--oc-echo)" }} />
                  คู่กับ {slot.hostName} · {PAIR_ROLE_TEXT[slot.role]?.t}
                </div>
              ) : (
                <>
                  <span className="oc-label">บทบาท</span>
                  <div className="cs-opts-row" role="group" aria-label="บทบาท">
                    {["pilot", "gunner"].map((k) => (
                      <button
                        key={k}
                        type="button"
                        className="cs-opt"
                        aria-pressed={pairRole === k}
                        onClick={() => { clickSound(); setPairRole(k); }}
                        {...descProps(`role-${k}`, PAIR_ROLE_TEXT[k].t, PAIR_ROLE_TEXT[k].d)}
                      >
                        {PAIR_ROLE_TEXT[k].t}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {sel?.id === "shiki" && sel.ultimate2 && (
            <div className="cs-opts">
              <span className="oc-label">ท่าไม้ตายที่ใช้</span>
              <div className="cs-opts-row" role="group" aria-label="ท่าไม้ตายที่ใช้">
                {SHIKI_ULTS.map((o) => (
                  <button
                    key={o.k}
                    type="button"
                    className="cs-opt"
                    aria-pressed={shikiUlt === o.k}
                    onClick={() => { clickSound(); setShikiUlt(o.k); }}
                    {...descProps(`ult-${o.k}`, o.t, o.d || (o.k === "deatheye" ? sel.ultimate?.desc : null))}
                  >
                    {o.t}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="cs-actions">
            <OcButton variant="primary" disabled={!canConfirm} onClick={confirm}>{confirmLabel}</OcButton>
            <OcButton variant="ghost" onClick={onBack}>{backLabel}</OcButton>
          </div>
        </OcPanel>
      </div>

      {desc && (
        <div className="cs-desc" role="tooltip" style={{ right: desc.right, top: desc.top, bottom: desc.bottom }}>
          {desc.title && <b>{desc.title}</b>}
          {desc.text}
        </div>
      )}

      <div className="cs-tip" ref={tipRef} hidden />
    </OcScreen>
  );
}
