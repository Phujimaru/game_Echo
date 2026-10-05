// ============================================================
//  Moon Cell — ภายในสถานที่ + หน้าต่างสถานะ + HUD ทางเดิน
//  ภาพพื้นหลังเป็น canvas (placeArt.js) · แผงตัวเลือกเป็น DOM สไตล์ ORDEAL CALL (แผงกระจกน้ำเงิน · ปุ่มยืนยันม่วง ECHO)
//  ข้อความในแผง = หัวข้อ/ป้ายสั้น ๆ เท่านั้น (กฎ UI ของ ECHO: ไม่มีประโยคอธิบาย)
// ============================================================

import { useEffect, useRef, useState } from "react";
import { socket } from "../socket";
import { playSfx } from "../audio";
import { shopInfoOf } from "../data/shop";
import GlobeCanvas from "../globe/GlobeCanvas";
import { PLACE_ART, PLACE_SKY } from "./placeArt";
import { fitCanvas } from "./ocKit";
import { PLACE_LABEL } from "./World";

const TIERS = [["basic", "สกิลพื้นฐาน", 1, 2], ["secondary", "สกิลรอง", 3, 4], ["ultimate", "ท่าไม้ตาย", 6, 6]];
const ITEM_GLYPH = { heal: "✚", armor: "⛨", skill: "◆", resist: "⊘", fortune: "★", guard: "⬡" };

// ---------- ชิ้นเล็กที่ใช้ซ้ำ ----------
export function Hex({ on, tone = "echo", size = 16 }) {
  return <span className="scp-hex" data-on={on || undefined} data-tone={tone} style={{ width: size, height: size * 1.12 }} />;
}
export function Pips({ n, max, tone = "sky", pending = 0 }) {
  return (
    <span className="scp-pips">
      {Array.from({ length: max }, (_, i) => (
        <i key={i} data-on={i < n || undefined} data-pend={(i >= n && i < n + pending) || undefined} data-tone={tone} />
      ))}
    </span>
  );
}
function Seal({ color }) { return <span className="scp-seal" style={{ "--c": color || "#8ba3c2" }} />; }

/** ฉากหลังของสถานที่ (canvas + ลูกโลก 3D สำหรับห้องที่เห็นท้องฟ้า) */
export function PlaceBackdrop({ place, night }) {
  const ref = useRef(null);
  useEffect(() => {
    const cv = ref.current, c = cv.getContext("2d");
    const art = PLACE_ART[place];
    let raf = 0, t0 = performance.now();
    const loop = (now) => {
      const { W, s } = fitCanvas(cv);
      c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, cv.width, cv.height);
      c.setTransform(s, 0, 0, s, 0, 0);
      art?.(c, W, (now - t0) / 1000, night);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [place, night]);
  const sky = PLACE_SKY[place];
  return (
    <div className="absolute inset-0 sc-world" data-night={night || undefined}>
      {sky && (
        <GlobeCanvas
          shared={false} drag={false} autoSpin={0.12}
          layout={place === "room" ? { x: -1.05, y: 0.48, s: 0.62 } : { x: -0.55, y: 0.75, s: 0.85 }}
        />
      )}
      <canvas ref={ref} className="absolute inset-0 w-full h-full block" />
    </div>
  );
}

function PanelShell({ title, picks, maxPicks, children, footer }) {
  return (
    <div className="scp-panel oc-enter">
      <div className="scp-head">
        <h2>{title}</h2>
        {maxPicks ? <span className="scp-picks">{Array.from({ length: maxPicks }, (_, i) => <Hex key={i} on={i < picks} />)}</span> : null}
      </div>
      <div className="scp-body">{children}</div>
      <div className="scp-foot">{footer}</div>
    </div>
  );
}

// ============================================================
//  ตัวคุมสถานที่: เลือก -> ยืนยัน -> รอผล -> โชว์ผล
// ============================================================
export function PlaceScreen({ place, sc, me, players, youId, shop, onLeave }) {
  const [sent, setSent] = useState(false);
  const [seqAtSend, setSeqAtSend] = useState(null); // ผลเก่าก่อนกดยืนยัน — ผลที่ seq ต่างจากนี้คือผลของการกดครั้งนี้
  const result = sc.placeResult && sc.placeResult.place === place && sent && sc.placeResult.seq !== seqAtSend ? sc.placeResult : null;
  const send = (payload) => {
    setSeqAtSend(sc.placeResult?.seq ?? null);
    playSfx("sc_glitch");
    socket.emit("seraphPlace", { key: place, ...payload });
    setSent(true);
  };
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onLeave(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onLeave]);
  useEffect(() => { if (result) playSfx(result.unlock ? "sc_glitch" : "sc_noti2"); }, [result?.seq]);
  let panel = null;
  if (place === "church") panel = <ChurchPanel sc={sc} result={result} sent={sent} onSend={send} onLeave={onLeave} />;
  else if (place === "library") panel = <LibraryPanel sc={sc} me={me} result={result} sent={sent} onSend={send} onLeave={onLeave} />;
  else if (place === "room") panel = <RoomPanel sc={sc} result={result} sent={sent} onSend={send} onLeave={onLeave} />;
  else if (place === "park") panel = <ParkPanel sc={sc} players={players} youId={youId} result={result} sent={sent} onSend={send} onLeave={onLeave} />;
  else if (place === "store") panel = <StorePanel shop={shop} me={me} onLeave={onLeave} />;
  return (
    <div className="fixed inset-0 z-[62] scp-screen">
      <PlaceBackdrop place={place} night={!!sc.night} />
      {result && <div key={result.seq} className="scp-shock" aria-hidden />}
      <div className="scp-dock">{panel}</div>
    </div>
  );
}

function ResultBlock({ result }) {
  if (!result) return null;
  return (
    <div className="scp-result" key={result.seq}>
      <b>{result.title}</b>
      {result.detail && <span>{result.detail}</span>}
      {result.unlock && <em>ปลดล็อก {result.unlock === "ultimate" ? "ท่าไม้ตาย" : "สกิลรอง"}</em>}
      {result.warn && <i>{result.warn}</i>}
    </div>
  );
}

// ---------- โบสถ์ ----------
function ChurchPanel({ sc, result, sent, onSend, onLeave }) {
  const max = sc.upgradePicks?.church ?? 2, CAP = sc.hpArmorCap ?? 10;
  const [picks, setPicks] = useState([]);
  const hp = sc.caps?.hp ?? 3, ar = sc.caps?.armor ?? 2;
  const total = hp + ar + picks.length;
  const full = sent || picks.length >= max || total >= CAP;
  const add = (k) => { if (!full) { playSfx("action_button"); setPicks((p) => [...p, k]); } };
  const nHp = picks.filter((k) => k === "hp").length, nAr = picks.filter((k) => k === "armor").length;
  const segs = [...Array(hp).fill("hp"), ...Array(nHp).fill("hp+"), ...Array(ar).fill("ar"), ...Array(nAr).fill("ar+")];
  return (
    <PanelShell
      title="โบสถ์" picks={sent ? max : picks.length} maxPicks={max}
      footer={sent
        ? <button type="button" className="oc-btn primary" onClick={onLeave}>กลับทางเดิน</button>
        : <>
            <button type="button" className="oc-btn" onClick={() => (picks.length ? setPicks([]) : onLeave())}>{picks.length ? "ล้าง" : "กลับ"}</button>
            <button type="button" className="oc-btn primary" disabled={!picks.length} onClick={() => onSend({ picks })}>ยืนยัน</button>
          </>}
    >
      {[["hp", "พลังชีวิต", hp, nHp], ["armor", "เกราะ", ar, nAr]].map(([k, label, base, add2]) => (
        <div key={k} className="scp-row">
          <span className={`scp-ico ${k === "hp" ? "is-hp" : "is-ar"}`} />
          <div className="scp-row-main">
            <b>{label}</b>
            <span className="scp-num">{base}{add2 ? <> → <em data-tone={k}>{base + add2}</em></> : null}</span>
          </div>
          <button type="button" className="scp-plus" disabled={full} onClick={() => add(k)}>+1</button>
        </div>
      ))}
      <div className="scp-cap">
        <div className="scp-cap-head"><span>รวม</span><b data-full={total >= CAP || undefined}>{total} / {CAP}</b></div>
        <div className="scp-cap-bar">
          {Array.from({ length: CAP }, (_, i) => <i key={i} data-k={segs[i] || undefined} />)}
        </div>
      </div>
      <ResultBlock result={result} />
    </PanelShell>
  );
}

// ---------- ห้องสมุด ----------
function LibraryPanel({ sc, result, sent, onSend, onLeave }) {
  const max = sc.upgradePicks?.library ?? 3;
  const [picks, setPicks] = useState([]);
  const cap = sc.caps?.skill ?? 4, lv = sc.skillLevel ?? 1;
  const pCap = cap + picks.filter((k) => k === "skill").length, pLv = lv + picks.filter((k) => k === "level").length;
  const done = sent || picks.length >= max;
  const add = (k) => {
    if (done || (k === "skill" && pCap >= 8) || (k === "level" && pLv >= 6)) return;
    playSfx("action_button"); setPicks((p) => [...p, k]);
  };
  return (
    <PanelShell
      title="ห้องสมุด" picks={sent ? max : picks.length} maxPicks={max}
      footer={sent
        ? <button type="button" className="oc-btn primary" onClick={onLeave}>กลับทางเดิน</button>
        : <>
            <button type="button" className="oc-btn" onClick={() => (picks.length ? setPicks([]) : onLeave())}>{picks.length ? "ล้าง" : "กลับ"}</button>
            <button type="button" className="oc-btn primary" disabled={!picks.length} onClick={() => onSend({ picks })}>ยืนยัน</button>
          </>}
    >
      <div className="scp-row">
        <span className="scp-ico is-sp" />
        <div className="scp-row-main">
          <b>ความจุแต้มสกิล</b>
          <Pips n={cap} max={8} pending={pCap - cap} />
        </div>
        <button type="button" className="scp-plus" disabled={done || pCap >= 8} onClick={() => add("skill")}>+1</button>
      </div>
      <div className="scp-row">
        <span className="scp-ico is-lv" />
        <div className="scp-row-main">
          <b>ระดับทักษะ <span className="scp-num">{pLv}/6</span></b>
          <span className="scp-track">
            {Array.from({ length: 6 }, (_, i) => (
              <i key={i} data-on={i < lv || undefined} data-pend={(i >= lv && i < pLv) || undefined} data-key={i === 2 || i === 5 || undefined} />
            ))}
          </span>
        </div>
        <button type="button" className="scp-plus" disabled={done || pLv >= 6} onClick={() => add("level")}>+1</button>
      </div>
      <div className="scp-tiers">
        {TIERS.map(([k, name, need, cost]) => {
          const ok = pLv >= need, short = ok && pCap < cost;
          return (
            <div key={k} className="scp-tier" data-ok={ok || undefined} data-short={short || undefined}>
              <b>{name}</b>
              <span>{ok ? (short ? "แต้มไม่พอ" : `ใช้ ${cost}`) : `ระดับ ${need}`}</span>
            </div>
          );
        })}
      </div>
      <ResultBlock result={result} />
    </PanelShell>
  );
}

// ---------- ห้องพัก: การ์ดของฟรีพลิกเปิด ----------
function RoomPanel({ result, sent, onSend, onLeave }) {
  const flipped = !!result;
  return (
    <PanelShell
      title="ห้องพัก"
      footer={sent
        ? <button type="button" className="oc-btn primary" disabled={!flipped} onClick={onLeave}>กลับทางเดิน</button>
        : <>
            <button type="button" className="oc-btn" onClick={onLeave}>กลับ</button>
            <button type="button" className="oc-btn primary" onClick={() => onSend({})}>พัก</button>
          </>}
    >
      <div className="scp-card-stage">
        <div className="scp-card" data-flip={flipped || undefined} data-wait={(sent && !flipped) || undefined}>
          <div className="scp-card-back"><span /></div>
          <div className="scp-card-face">
            <span className="scp-card-ico" data-k={result?.item}>{ITEM_GLYPH[result?.item] || "◆"}</span>
            <b>{result?.detail || ""}</b>
            <em>ของฟรี</em>
          </div>
        </div>
      </div>
    </PanelShell>
  );
}

// ---------- สวนสาธารณะ: ลง Matrix ----------
const LV_TXT = ["", "จำนวนไพ่", "ลดดาเมจ 1", "เห็นแต้ม"];
function ParkPanel({ sc, players, youId, result, sent, onSend, onLeave }) {
  const [add, setAdd] = useState({});
  const spent = Object.values(add).reduce((a, b) => a + b, 0);
  const held = (sc.matrixHeld || 0) - (sent ? 0 : spent);
  const targets = players.filter((p) => p.id !== youId && p.alive && !p.scEliminated);
  const plus = (id) => {
    if (sent) return;
    const lv = (sc.matrixPlaced?.[id] || 0) + (add[id] || 0);
    if (held <= 0 || lv >= 3) return;
    playSfx("action_button");
    setAdd((a) => ({ ...a, [id]: (a[id] || 0) + 1 }));
  };
  const list = [];
  for (const [id, n] of Object.entries(add)) for (let i = 0; i < n; i++) list.push(id);
  return (
    <PanelShell
      title="สวนสาธารณะ"
      footer={sent
        ? <button type="button" className="oc-btn primary" onClick={onLeave}>กลับทางเดิน</button>
        : <>
            <button type="button" className="oc-btn" onClick={() => (spent ? setAdd({}) : onLeave())}>{spent ? "ล้าง" : "กลับ"}</button>
            <button type="button" className="oc-btn primary" disabled={!spent} onClick={() => onSend({ targets: list })}>ยืนยัน</button>
          </>}
    >
      <div className="scp-matrix"><span>Matrix</span><Pips n={Math.max(0, held)} max={sc.matrixMax || 4} tone="echo" /></div>
      <div className="scp-targets">
        {targets.map((p) => {
          const base = sc.matrixPlaced?.[p.id] || 0, extra = sent ? 0 : add[p.id] || 0, lv = base + extra;
          const opp = sc.myOpponent === p.id;
          return (
            <button key={p.id} type="button" className="scp-target" data-opp={opp || undefined} disabled={sent || held <= 0 || lv >= 3} onClick={() => plus(p.id)}>
              <Seal color={p.color} />
              <span className="scp-target-name"><b>{p.name}</b>{opp && <em>คู่ดวล</em>}<small>{LV_TXT[lv] || "—"}</small></span>
              <Pips n={base} max={3} tone="echo" pending={extra} />
            </button>
          );
        })}
      </div>
      <ResultBlock result={result} />
    </PanelShell>
  );
}

// ---------- ร้านค้า ----------
function StorePanel({ shop = [], me, onLeave }) {
  const gold = me?.gold ?? 0, inv = me?.inventory || [];
  const items = shop.filter((it) => !it.sold);
  const charId = me?.characterId || me?.character?.id;
  const restricted = (it) => {
    const hasBlack = inv.some((o) => o.type === "blackSparklence");
    return (it.type === "gutsGun" && (charId === "ignis" || hasBlack || inv.some((o) => o.type === "gutsGun")))
      || (it.type === "gutsAmmo" && it.ammo === "hyper_trigger" && (charId === "ignis" || hasBlack))
      || (it.type === "gutsAmmo" && ["hyper_trigger", "trigger_dark_key"].includes(it.ammo) && inv.some((o) => o.type === "gutsAmmo" && o.ammo === it.ammo));
  };
  return (
    <PanelShell
      title="ร้านค้า"
      footer={<button type="button" className="oc-btn primary" onClick={onLeave}>กลับทางเดิน</button>}
    >
      <div className="scp-gold"><span className="scp-coin" /> <b>{gold}</b></div>
      {items.length === 0 ? <div className="scp-empty">ของหมด</div> : (
        <div className="scp-shop">
          {items.map((it) => {
            const info = shopInfoOf(it), afford = gold >= it.price, lock = restricted(it);
            return (
              <button key={it.id} type="button" className="scp-item" disabled={!afford || lock} title={info.desc || ""}
                onClick={() => { playSfx("buy_something"); socket.emit("buyShopItem", { itemId: it.id }); }}>
                <span className="scp-item-img">{info.img ? <img src={info.img} alt="" /> : <span>{info.icon}</span>}</span>
                <b>{info.label(it)}</b>
                <span className="scp-price" data-poor={!afford || undefined}><span className="scp-coin" />{it.price}{lock ? " · มีแล้ว" : ""}</span>
              </button>
            );
          })}
        </div>
      )}
    </PanelShell>
  );
}

// ============================================================
//  หน้าต่างสถานะของเรา (ค่าพลัง / สกิล / เงิน / Matrix / กระเป๋า)
// ============================================================
export function StatusWindow({ sc, me, players, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape" || e.key === "c" || e.key === "C") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const ch = me?.character || {};
  const cap = sc.caps || {}, lv = sc.skillLevel ?? 1;
  const placed = Object.entries(sc.matrixPlaced || {}).filter(([, n]) => n > 0);
  const inv = me?.inventory || [];
  const [tip, setTip] = useState(null);
  return (
    <div className="fixed inset-0 z-[90] scs-veil" onClick={onClose}>
      <div className="scs-win oc-enter" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="สถานะ">
        <div className="scs-hero">
          <span className="scs-portrait" style={{ "--c": me?.color || "#3d8bd9" }}>{me?.img ? <img src={me.img} alt="" /> : null}</span>
          <div>
            <h2>{ch.name || "—"}</h2>
            <span className="scs-player">{me?.name}</span>
          </div>
          <button type="button" className="scs-close" onClick={onClose} aria-label="ปิด">✕</button>
        </div>

        <div className="scs-grid">
          <section>
            <h3>ค่าพลัง</h3>
            <div className="scs-stat"><span className="scp-ico is-hp" /><b>พลังชีวิต</b><span>{me?.hp ?? cap.hp} / {cap.hp}</span></div>
            <div className="scs-stat"><span className="scp-ico is-ar" /><b>เกราะ</b><span>{me?.armor ?? cap.armor} / {cap.armor}</span></div>
            <div className="scs-stat"><span className="scp-ico is-sp" /><b>ความจุแต้มสกิล</b><Pips n={cap.skill || 4} max={8} /></div>
            <div className="scs-stat"><span className="scp-ico is-lv" /><b>ระดับทักษะ</b><span className="scp-track">{Array.from({ length: 6 }, (_, i) => <i key={i} data-on={i < lv || undefined} data-key={i === 2 || i === 5 || undefined} />)}</span></div>
          </section>

          <section>
            <h3>สกิล</h3>
            {TIERS.map(([k, label, need, cost]) => {
              const sk = ch[k];
              const ok = lv >= need, short = ok && (cap.skill || 4) < cost;
              return (
                <div key={k} className="scs-skill" data-ok={ok || undefined} data-short={short || undefined}
                  onMouseEnter={() => setTip(k)} onMouseLeave={() => setTip(null)} onFocus={() => setTip(k)} onBlur={() => setTip(null)} tabIndex={0}>
                  <span className="scs-skill-tier">{label}</span>
                  <b>{sk?.name || "—"}</b>
                  <span className="scs-skill-state">{ok ? (short ? "แต้มไม่พอ" : `ใช้ ${cost}`) : `ระดับ ${need}`}</span>
                  {tip === k && sk?.desc && <p>{sk.desc}</p>}
                </div>
              );
            })}
            {ch.passive && (
              <div className="scs-skill" data-ok onMouseEnter={() => setTip("p")} onMouseLeave={() => setTip(null)} tabIndex={0} onFocus={() => setTip("p")} onBlur={() => setTip(null)}>
                <span className="scs-skill-tier">สกิลติดตัว</span><b>{ch.passive.name}</b><span className="scs-skill-state">วันที่ 7</span>
                {tip === "p" && ch.passive.desc && <p>{ch.passive.desc}</p>}
              </div>
            )}
          </section>

          <section>
            <h3>ทรัพยากร</h3>
            <div className="scs-stat"><span className="scp-coin" /><b>เงิน</b><span>{me?.gold ?? 0}</span></div>
            <div className="scs-stat"><span className="scp-ico is-mx" /><b>Matrix</b><Pips n={sc.matrixHeld || 0} max={sc.matrixMax || 4} tone="echo" /></div>
            {placed.length > 0 && (
              <div className="scs-placed">
                {placed.map(([id, n]) => {
                  const p = players.find((q) => q.id === id);
                  return <span key={id}><Seal color={p?.color} />{p?.name || "?"}<Pips n={n} max={3} tone="echo" /></span>;
                })}
              </div>
            )}
          </section>

          <section>
            <h3>กระเป๋า <span className="scp-num">{inv.length}</span></h3>
            {inv.length === 0 ? <div className="scp-empty">ว่าง</div> : (
              <div className="scs-bag">
                {inv.map((it) => {
                  const info = shopInfoOf(it);
                  return (
                    <span key={it.uid} className="scs-item" title={info.desc || ""}>
                      <span className="scp-item-img">{info.img ? <img src={info.img} alt="" /> : <span>{info.icon}</span>}</span>
                      <b>{info.label(it)}</b>
                    </span>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

// ============================================================
//  HUD ทางเดิน (DOM ทับ canvas): วัน · Matrix · เงิน · ปุ่มสถานะ · ปุ่มพร้อม
// ============================================================
export function WorldHud({ sc, me, onStatus, onReady }) {
  const day = sc.day, dd = sc.duelDay || 7;
  const canAct = !!me?.alive && !sc.eliminated;
  return (
    <>
      <div className="scw-hud">
        <div className="scw-day">
          <span>วันที่</span><b>{day}</b><small>/{dd}</small>
          <span className="scw-days">
            {Array.from({ length: dd }, (_, i) => <i key={i} data-past={i + 1 < day || undefined} data-now={i + 1 === day || undefined} data-duel={i + 1 === dd || undefined} data-pair={i + 1 === (sc.pairingDay || 5) || undefined} />)}
          </span>
        </div>
        <div className="scw-res">
          <span className="scw-mx"><span>Matrix</span><Pips n={sc.matrixHeld || 0} max={sc.matrixMax || 4} tone="echo" /></span>
          <span className="scw-gold"><span className="scp-coin" /><b>{me?.gold ?? 0}</b></span>
        </div>
      </div>
      <div className="scw-actions">
        <button type="button" className="oc-btn" onClick={onStatus}>สถานะ</button>
        {canAct && (sc.ready
          ? <span className="scw-wait">รอ {sc.readyCount}/{sc.totalPlayers}</span>
          : <button type="button" className="oc-btn primary" onClick={onReady}>พร้อม</button>)}
      </div>
      {sc.place && !sc.ready && <div className="scw-used">{PLACE_LABEL[sc.place]} · ใช้แล้ว</div>}
    </>
  );
}
