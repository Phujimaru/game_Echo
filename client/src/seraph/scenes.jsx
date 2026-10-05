// ============================================================
//  Moon Cell — ฉากเล่าเรื่องทั้งหมด (สไตล์ ORDEAL CALL)
//  บูต · เปิดวัน · ประกาศคู่ดวล · เข้าวันดวล · เปิดเผยตัวละคร · ประจันหน้า · ถูกลบ · จบรอบ · ผู้รอดคนสุดท้าย
//  ภาษาภาพชุดเดียวกับฉากดิ่งของเกมหลัก: แฟลชขาว → วงแหวนกระแทก → แถบประกาศกลางจอ → ของลอยขึ้น (oc-rise)
//  ทุกฉากรับ onDone แล้วเรียกเองเมื่อครบเวลา (ผู้เรียกคุมคิว) · คลิกเพื่อข้ามได้
// ============================================================

import { useEffect, useRef } from "react";
import { playSfx } from "../audio";
import GlobeCanvas from "../globe/GlobeCanvas";
import { C, hexP, glow, fitCanvas, lcg, loadImg } from "./ocKit";

/** ยิง callback ตามตารางเวลา แล้วเก็บกวาด timer ให้เอง */
export function useTimeline(steps, deps = []) {
  useEffect(() => {
    const timers = steps.map(([at, fn]) => setTimeout(fn, at));
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/** โครงฉาก: พื้น/แฟลช/วงแหวน/แถบประกาศ — skip = คลิกเพื่อข้าม */
function Stage({ tone = "snow", onSkip, children, className = "" }) {
  return (
    <div className={`scx scx-${tone} ${className}`} onClick={onSkip} role="presentation">
      <span className="scx-grid" />
      {children}
      <span className="scx-flash" />
    </div>
  );
}
function Banner({ kicker, title, tone, delay = 0, hold }) {
  return (
    <div className={`scx-banner${hold ? " is-hold" : ""}`} data-tone={tone} style={{ "--d": `${delay}s` }}>
      <span className="scx-flare" />
      {kicker && <span className="scx-kicker">{kicker}</span>}
      <b>{title}</b>
    </div>
  );
}
function Rings({ n = 3, tone, delay = 0 }) {
  return <span className="scx-rings" data-tone={tone}>{Array.from({ length: n }, (_, i) => <i key={i} style={{ animationDelay: `${delay + i * 0.18}s` }} />)}</span>;
}
function SealHex({ color, size = 72, delay = 0 }) {
  return <span className="scx-seal oc-enter" style={{ "--c": color || "#8ba3c2", width: size, height: size * 1.12, animationDelay: `${delay}s` }} />;
}
function PortraitHex({ img, color, size = 150, className = "" }) {
  return (
    <span className={`scx-portrait ${className}`} style={{ "--c": color || "#3d8bd9", width: size, height: size * 1.12 }}>
      {img ? <img src={img} alt="" /> : null}
    </span>
  );
}
function DayPips({ day, duelDay = 7, pairingDay = 5 }) {
  return (
    <span className="scx-days">
      {Array.from({ length: duelDay }, (_, i) => (
        <i key={i} data-past={i + 1 < day || undefined} data-now={i + 1 === day || undefined} data-duel={i + 1 === duelDay || undefined} data-pair={i + 1 === pairingDay || undefined} />
      ))}
    </span>
  );
}

// ---------- บูตระบบ (เข้าโหมดครั้งแรก) · 4.6s ----------
export function SeraphBoot({ players = [], cycleRound = 1, onDone }) {
  useTimeline([[0, () => playSfx("sc_noti")], [2600, () => playSfx("sc_noti2")], [4600, () => onDone?.()]]);
  return (
    <Stage onSkip={onDone} className="scx-boot">
      <div className="scx-boot-globe"><GlobeCanvas shared={false} drag={false} autoSpin={0.35} layout={{ x: 0, y: 0.25, s: 0.9 }} /></div>
      <div className="scx-boot-logo">
        <span className="scx-latin">SE.RA.PH</span>
        <b className="scx-latin">MOON <em>CELL</em></b>
      </div>
      <div className="scx-boot-row">
        {players.map((p, i) => (
          <span key={p.id} className="scx-boot-p oc-enter" style={{ animationDelay: `${1.1 + i * 0.12}s` }}>
            <SealHex color={p.color} size={44} delay={1.1 + i * 0.12} />
            <span>{p.name}</span>
          </span>
        ))}
      </div>
      <Banner kicker="Moon Cell" title={`รอบที่ ${cycleRound}`} delay={2.6} />
      <Rings delay={2.55} />
    </Stage>
  );
}

// ---------- เปิดวันใหม่ (วันที่ 1-6) · ย่อ 1.9s / เต็ม 2.8s ----------
export function DayBanner({ day = 1, duelDay = 7, pairingDay = 5, cycleRound = 1, short = false, night = false, onDone }) {
  useTimeline([[0, () => playSfx(day === duelDay - 1 || night ? "sc_noti2" : "sc_noti")], [short ? 1900 : 2800, () => onDone?.()]]);
  return (
    <Stage tone={night ? "night" : "clear"} onSkip={onDone} className={short ? "is-short" : ""}>
      <Rings n={2} />
      <div className="scx-banner is-day">
        <span className="scx-flare" />
        <span className="scx-kicker">รอบที่ {cycleRound}</span>
        <b>{night ? `คืนวันที่ ${day}` : `วันที่ ${day}`}</b>
        <DayPips day={day} duelDay={duelDay} pairingDay={pairingDay} />
      </div>
    </Stage>
  );
}

// ---------- ประกาศคู่ดวล (จบวันที่ 5) · 5.6s ----------
export function PairingScene({ pairs = [], byes = [], players = [], myId, onDone }) {
  const pr = pairs[0];
  const mine = pr && (pr.a === myId || pr.b === myId);
  useTimeline([[0, () => playSfx("sc_noti")], [1500, () => playSfx(mine ? "sc_glitch" : "sc_noti2")], [5600, () => onDone?.()]]);
  const col = (id) => players.find((p) => p.id === id)?.color;
  return (
    <Stage onSkip={onDone}>
      <Banner kicker="จบวันที่ 5" title="ประกาศคู่ดวล" />
      {pr && (
        <div className="scx-sheet" style={{ "--d": "1.5s" }}>
          <span className="scx-sheet-k">การดวลวันที่ 7</span>
          <div className="scx-vs">
            <span className="scx-vs-p" data-me={pr.a === myId || undefined}><SealHex color={col(pr.a)} size={96} delay={1.7} /><b>{pr.a === myId ? "คุณ" : pr.aName}</b></span>
            <span className="scx-vs-x scx-latin">VS</span>
            <span className="scx-vs-p" data-me={pr.b === myId || undefined}><SealHex color={col(pr.b)} size={96} delay={1.85} /><b>{pr.b === myId ? "คุณ" : pr.bName}</b></span>
          </div>
          {byes.length > 0 && <span className="scx-byes">ผ่านรอบนี้ · {byes.map((b) => (b.id === myId ? "คุณ" : b.name)).join(" · ")}</span>}
        </div>
      )}
      <Rings delay={1.45} />
    </Stage>
  );
}

// ---------- เข้าวันที่ 7 · 3.4s ----------
export function DuelIntro({ day = 7, onDone }) {
  useTimeline([[0, () => playSfx("sc_glitch")], [3400, () => onDone?.()]]);
  return (
    <Stage tone="navy" onSkip={onDone}>
      <Rings n={4} tone="hp" />
      <Banner kicker={`วันที่ ${day}`} title="ดวล" tone="hp" />
    </Stage>
  );
}

// ---------- เปิดเผยตัวละคร · 2.8s ต่อคน ----------
export function CharacterReveal({ player, onDone }) {
  useTimeline([[0, () => playSfx("sc_noti")], [900, () => playSfx("sc_glitch")], [2800, () => onDone?.()]]);
  const ch = player.character || {};
  return (
    <Stage tone="navy" onSkip={onDone} className="scx-reveal">
      <span className="scx-reveal-seal"><SealHex color={player.color} size={150} /></span>
      <PortraitHex img={player.img || ch.img} color={player.color} size={190} className="scx-reveal-face" />
      <Rings delay={0.85} />
      <div className="scx-reveal-name">
        <span>{player.name}</span>
        <b>{ch.name || "???"}</b>
      </div>
    </Stage>
  );
}

// ---------- ประจันหน้า · 3.2s ----------
export function FaceOffScene({ a, b, onDone }) {
  useTimeline([[0, () => playSfx("sc_glitch")], [3200, () => onDone?.()]]);
  const one = (p, side) => (
    <span className={`scx-face is-${side}`}>
      <PortraitHex img={p?.img || p?.character?.img} color={p?.color} size={210} />
      <b>{p?.character?.name || "???"}</b>
      <span>{p?.name}</span>
    </span>
  );
  return (
    <Stage tone="navy" onSkip={onDone} className="scx-faceoff">
      {one(a, "l")}
      <span className="scx-vs-x scx-latin is-big">VS</span>
      {one(b, "r")}
      <Rings n={2} delay={0.5} />
    </Stage>
  );
}

// ---------- ถูกลบ · 5.2s — กำแพงหกเหลี่ยมแดง + ร่างสลายเป็นพิกเซล ----------
export function DeletionScene({ loser, winner, onDone }) {
  const ref = useRef(null);
  useTimeline([[0, () => playSfx("sc_glitch")], [3000, () => playSfx("sc_noti2")], [5200, () => onDone?.()]]);
  useEffect(() => {
    const cv = ref.current, c = cv.getContext("2d");
    const img = loadImg(loser?.img || loser?.character?.img);
    const r = lcg(99), parts = Array.from({ length: 260 }, () => [r() * 2 - 1, r(), r()]);
    const col = loser?.color || C.hp;
    let raf = 0; const t0 = performance.now();
    const loop = (now) => {
      const t = (now - t0) / 1000;
      const { W, s } = fitCanvas(cv);
      c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, cv.width, cv.height); c.setTransform(s, 0, 0, s, 0, 0);
      const cx = W / 2, cy = 250, R = 120;
      // กำแพงหกเหลี่ยมแดงไล่ขึ้นจากล่าง
      const wall = Math.min(1, t / 0.7), fl = 0.85 + 0.15 * Math.sin(t * 11);
      c.save(); c.beginPath(); c.rect(0, 540 * (1 - wall), W, 540 * wall); c.clip();
      c.strokeStyle = `rgba(210,69,91,${0.45 * fl})`; c.lineWidth = 1;
      for (let y = -20, row = 0; y < 560; y += 30, row++) for (let x = -20; x < W + 30; x += 34) { hexP(c, x + (row % 2 ? 17 : 0), y, 16); c.stroke(); }
      c.restore();
      glow(c, cx, cy, 300, "rgba(210,69,91,A)", 0.22 * fl);
      // ร่างในหกเหลี่ยม สลายจากบนลงล่าง
      const p = Math.max(0, Math.min(1, (t - 1.0) / 2.6)), top = cy - R * 1.12, h = R * 2.24, cut = top + p * (h + 10);
      c.save(); c.beginPath(); c.rect(0, cut, W, 540); c.clip();
      hexP(c, cx, cy, R + 5); c.fillStyle = col; c.fill();
      c.save(); hexP(c, cx, cy, R); c.clip(); c.fillStyle = "#eef3f9"; c.fillRect(cx - R, cy - R * 1.2, R * 2, R * 2.4);
      if (img && img.complete && img.naturalWidth) { const ar = img.naturalWidth / img.naturalHeight, ih = R * 2.4, iw = ih * ar; c.drawImage(img, cx - iw / 2, cy - R * 1.1, iw, ih); }
      c.fillStyle = `rgba(210,69,91,${0.15 + p * 0.3})`; c.fillRect(cx - R, cy - R * 1.2, R * 2, R * 2.4);
      c.restore(); c.restore();
      if (p > 0 && p < 1) { c.fillStyle = "rgba(255,180,190,.95)"; c.fillRect(cx - R, cut - 1, R * 2, 2.5); }
      for (const [dx, fy, rn] of parts) {
        const py = top + fy * h; if (py > cut) continue;
        const age = (cut - py) / 80; if (age > 2.4) continue;
        c.fillStyle = rn > 0.6 ? `rgba(255,255,255,${1 - age / 2.4})` : `rgba(210,69,91,${1 - age / 2.4})`;
        c.fillRect(cx + dx * R * 0.9 + Math.sin(rn * 20 + age * 2) * age * 18, py - age * 90, 3.2, 3.2);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [loser]);
  return (
    <Stage tone="snow" onSkip={onDone} className="scx-delete">
      <canvas ref={ref} className="absolute inset-0 w-full h-full block" />
      <Rings n={3} tone="hp" />
      <Banner kicker={loser?.name} title="ถูกลบ" tone="hp" delay={3.0} hold />
      {winner && <span className="scx-winner oc-enter" style={{ animationDelay: "3.6s" }}><b>{winner.name}</b> ผ่านเข้ารอบถัดไป</span>}
    </Stage>
  );
}

// ---------- จบรอบ · 4.2s ----------
export function CycleEndScene({ cycleRound = 1, goldGain = 5, matrixHeld = 0, matrixMax = 4, onDone }) {
  useTimeline([[0, () => playSfx("sc_noti")], [4200, () => onDone?.()]]);
  return (
    <Stage onSkip={onDone}>
      <Rings />
      <Banner kicker="Moon Cell" title={`จบรอบที่ ${cycleRound}`} hold />
      <div className="scx-chips">
        {[["+" + goldGain, "เหรียญ"], ["เต็ม", "พลังชีวิต · เกราะ"], [`${matrixHeld}/${matrixMax}`, "Matrix"]].map(([v, k], i) => (
          <span key={k} className="scx-chip oc-enter" style={{ animationDelay: `${1 + i * 0.15}s` }}><b>{v}</b>{k}</span>
        ))}
      </div>
    </Stage>
  );
}

// ---------- ผู้รอดคนสุดท้าย · 10s ----------
export function FinalWinnerScene({ winner, board = [], onDone }) {
  useTimeline([[0, () => playSfx("sc_noti")], [1600, () => playSfx("sc_noti2")], [10000, () => onDone?.()]]);
  const rows = [...board].sort((a, b) => (a.eliminated === b.eliminated ? 0 : a.eliminated ? 1 : -1));
  return (
    <Stage onSkip={onDone} className="scx-final">
      <div className="scx-boot-globe"><GlobeCanvas shared={false} drag={false} autoSpin={0.2} layout={{ x: -1.4, y: 0, s: 1.05 }} /></div>
      <div className="scx-final-hero oc-enter" style={{ animationDelay: ".4s" }}>
        <PortraitHex img={winner?.img || winner?.character?.img} color={winner?.color} size={200} />
        <span className="scx-kicker">ผู้รอดคนสุดท้าย</span>
        <b>{winner ? winner.name : "ไม่มีผู้รอด"}</b>
        {winner?.character?.name && <span className="scx-final-ch">{winner.character.name}</span>}
      </div>
      <div className="scx-board oc-enter" style={{ animationDelay: "1.6s" }}>
        {rows.map((r) => (
          <div key={r.id} className="scx-board-row" data-out={r.eliminated || undefined}>
            <b>{r.name}</b>
            <span>{r.charName}</span>
            <span>ดวลชนะ {r.stat?.duelWins ?? 0}</span>
            <span>Matrix {r.stat?.matrixFound ?? 0}</span>
            <span>{r.eliminated ? "ถูกลบ" : "รอด"}</span>
          </div>
        ))}
      </div>
    </Stage>
  );
}

