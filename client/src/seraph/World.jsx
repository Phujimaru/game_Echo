// ============================================================
//  Moon Cell วันที่ 1-6 — ทางเดินอาคารเรียน (open world 2D เดินซ้าย/ขวา)
//
//  - ทุกคนอยู่ทางเดินเดียวกัน: ตัวเราเดินเองทันที (ทำนายฝั่ง client) แล้วส่งพิกัดให้ server ทุก ~90ms
//    คนอื่นได้พิกัดผ่าน socket "seraphPos" (เบา ไม่ใช่ state ทั้งก้อน) แล้วค่อย ๆ ไหลไปหา (ไม่กระตุก)
//  - ของในแมพ (ชิ้นส่วน Matrix / เหรียญ) — เดินถึงแล้วขอเก็บกับ server (ใครถึงก่อนได้ก่อน)
//  - ประตู 5 บาน: ห้องพัก/ห้องสมุด/โบสถ์ = สถานที่ประจำวัน (วันละ 1 ที่) · ร้านค้า/สวนสาธารณะ แวะได้ไม่จำกัด
//  - ทั้งฉากวาดลง canvas ชั้นเดียว (รายละเอียดเยอะได้โดยไม่สร้างเลเยอร์ GPU เพิ่ม)
// ============================================================

import { useEffect, useLayoutEffect, useRef } from "react";
import { socket } from "../socket";
import GlobeCanvas from "../globe/GlobeCanvas";
import { playSfx } from "../audio";
import {
  C, AZ, EC, IC, GD, TAU, T, clamp, lcg, navy, hexP, diamondP, glow, lockIcon, coinP, survey, globe,
  shock, streaks, avatar, hologram, floorShadow, seal, portraitHex, nameTag, loadImg, fitCanvas
} from "./ocKit";

export const PLACE_LABEL = { room: "ห้องพัก", library: "ห้องสมุด", store: "ร้านค้า", church: "โบสถ์", park: "สวนสาธารณะ" };
const WALK = 210;             // หน่วย/วินาที
const DOOR_REACH = 80;        // ต่ำกว่าของ server (90) นิดหน่อย กันกดเข้าตรงขอบแล้ว server ปัด
const PICK_REACH = 46;        // server รับ 60
const SEND_MS = 90;
const FLOOR = 404;            // ขอบบนพื้น (หน่วยฉาก สูง 540)
const ME_Y = 488, OTHER_Y = 466;
const BOARD_X = 1220;         // บอร์ดประกาศคู่ดวลบนผนัง (ระหว่างห้องสมุดกับร้านค้า)

function doorState(key, sc, me) {
  if (sc.ready || !me?.alive || sc.eliminated) return "locked";
  if (key === "store") return sc.shopOpen ? "open" : "locked";
  const pl = (sc.places || []).find((p) => p.key === key);
  if (key === "park") return pl?.available ? "open" : "dim";
  if (sc.place === key) return "used";
  if (sc.dailyUsed) return "locked";
  return pl?.available ? "open" : "dim";
}

export default function World({ sc, players, youId, active, paused, onEnter }) {
  const cvRef = useRef(null);
  const live = useRef({});
  useLayoutEffect(() => { live.current = { sc, players, youId, active, paused, onEnter }; });

  // ลูกโลก 3D ตัวเดียวกับเกมหลัก (globe/globeCore) อยู่ชั้นหลัง — เห็นผ่านช่องหน้าต่างที่ canvas เจาะไว้
  const globeRef = useRef(null);

  // สถานะภายใน (ไม่ทำให้ React render ใหม่)
  const S = useRef(null);
  if (!S.current) {
    S.current = {
      x: 120, face: 1, ph: 0, moving: false, keys: {}, target: null, autoEnter: null,
      others: {}, pickSent: {}, lastSend: 0, sentX: null, bursts: [], prevPicks: new Map(),
      fx: null, dayKey: null, t: 0, cam: 0, hover: null, size: { W: 960, s: 1 }
    };
  }

  // ---------- ซิงก์จาก state ----------
  const world = sc.world;
  const dayKey = `${sc.cycleRound}-${sc.day}`;
  useEffect(() => {
    const st = S.current;
    if (!world) return;
    const mine = world.players.find((o) => o.id === youId);
    // วันใหม่ = server จัดทุกคนยืนต้นทางเดินใหม่
    if (st.dayKey !== dayKey) {
      st.dayKey = dayKey;
      if (mine) { st.x = mine.x; st.face = 1; st.sentX = mine.x; }
      st.others = {}; st.target = null; st.autoEnter = null; st.pickSent = {}; st.fx = null;
      st.prevPicks = new Map(world.pickups.map((k) => [k.id, k]));
    }
    for (const o of world.players) {
      if (o.id === youId) continue;
      const cur = st.others[o.id];
      if (!cur) st.others[o.id] = { x: o.x, tx: o.x, f: o.f, ph: 0 };
      else { cur.tx = o.x; cur.f = o.f; }
    }
    for (const id of Object.keys(st.others)) if (!world.players.some((o) => o.id === id)) delete st.others[id];
    // ของที่หายไป = มีคนเก็บ -> วงแหวน + เส้นแสงตรงนั้น
    const now = new Map(world.pickups.map((k) => [k.id, k]));
    for (const [id, k] of st.prevPicks) if (!now.has(id)) {
      st.bursts.push({ x: k.x, kind: k.kind, at: st.t, mine: Math.abs(k.x - st.x) < 90 });
      if (Math.abs(k.x - st.x) < 90) playSfx(k.kind === "coin" ? "buy_something" : "sc_noti2");
    }
    st.prevPicks = now;
  }, [world, dayKey, youId]);

  // ---------- พิกัดคนอื่นแบบเรียลไทม์ ----------
  useEffect(() => {
    const onPos = ({ id, x, f }) => {
      const st = S.current;
      if (id === youId) { if (Math.abs(x - st.x) > 160) st.x = x; return; } // server ตัดพิกัดวาร์ป -> เชื่อ server
      const o = st.others[id];
      if (o) { o.tx = x; o.f = f; } else st.others[id] = { x, tx: x, f, ph: 0 };
    };
    socket.on("seraphPos", onPos);
    return () => socket.off("seraphPos", onPos);
  }, [youId]);

  // ---------- คีย์บอร์ด ----------
  useEffect(() => {
    const isTyping = (e) => /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName || "");
    const down = (e) => {
      const L = live.current;
      if (!L.active || L.paused || isTyping(e)) return;
      const st = S.current, k = e.key;
      if (k === "ArrowLeft" || k === "a" || k === "A") { st.keys.l = true; st.target = null; st.autoEnter = null; e.preventDefault(); }
      else if (k === "ArrowRight" || k === "d" || k === "D") { st.keys.r = true; st.target = null; st.autoEnter = null; e.preventDefault(); }
      else if ((k === "ArrowUp" || k === "w" || k === "W" || k === "Enter" || k === " ") && !e.repeat) { tryEnter(); e.preventDefault(); }
    };
    const up = (e) => {
      const st = S.current, k = e.key;
      if (k === "ArrowLeft" || k === "a" || k === "A") st.keys.l = false;
      if (k === "ArrowRight" || k === "d" || k === "D") st.keys.r = false;
    };
    const blur = () => { S.current.keys = {}; };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); window.removeEventListener("blur", blur); };
  }, []);

  function nearDoor() {
    const L = live.current, st = S.current;
    const doors = L.sc.world?.doors || [];
    let best = null;
    for (const d of doors) { const dd = Math.abs(d.x - st.x); if (dd < DOOR_REACH && (!best || dd < best.dd)) best = { ...d, dd }; }
    return best;
  }
  function tryEnter(forceKey) {
    const L = live.current, st = S.current;
    if (!L.active || L.paused) return;
    const d = forceKey ? (L.sc.world?.doors || []).find((q) => q.key === forceKey) : nearDoor();
    if (!d) return;
    const me0 = L.players.find((p) => p.id === L.youId);
    const ds = doorState(d.key, L.sc, me0);
    if (ds !== "open") { playSfx("action_button"); st.fx = { at: st.t, deny: true, x: d.x }; return; }
    sendPos(true);
    playSfx("sc_glitch");
    st.fx = { at: st.t, key: d.key, x: d.x };
    st.keys = {}; st.target = null; st.autoEnter = null;
    setTimeout(() => live.current.onEnter?.(d.key), 380);
  }
  function sendPos(force) {
    const st = S.current, now = performance.now();
    if (!force && now - st.lastSend < SEND_MS) return;
    if (st.sentX != null && Math.abs(st.sentX - st.x) < 0.5 && !force) return;
    st.lastSend = now; st.sentX = st.x;
    socket.emit("seraphMove", { x: Math.round(st.x), f: st.face });
  }

  // ---------- เมาส์: คลิกพื้น = เดินไป · คลิกประตู = เดินไปแล้วเข้า ----------
  useEffect(() => {
    const cv = cvRef.current;
    const toWorld = (e) => {
      const r = cv.getBoundingClientRect(), st = S.current;
      const k = (r.height) / 540;
      return { wx: st.cam + (e.clientX - r.left) / k, y: (e.clientY - r.top) / k };
    };
    const doorAt = (p) => (live.current.sc.world?.doors || []).find((d) => Math.abs(d.x - p.wx) < 62 && p.y > 150 && p.y < FLOOR + 6);
    const click = (e) => {
      const L = live.current, st = S.current;
      if (!L.active || L.paused) return;
      const p = toWorld(e);
      const d = doorAt(p);
      if (d) {
        if (Math.abs(d.x - st.x) < DOOR_REACH) { tryEnter(d.key); return; }
        st.target = d.x; st.autoEnter = d.key;
      } else if (p.y > 200) { st.target = clamp(p.wx, 40, (L.sc.world?.w || 3100) - 40); st.autoEnter = null; }
    };
    const move = (e) => {
      const p = toWorld(e), d = doorAt(p);
      S.current.hover = d ? d.key : null;
      cv.style.cursor = d || p.y > 200 ? "pointer" : "";
    };
    cv.addEventListener("click", click);
    cv.addEventListener("pointermove", move);
    return () => { cv.removeEventListener("click", click); cv.removeEventListener("pointermove", move); };
  }, []);

  // ---------- ลูปวาด ----------
  useEffect(() => {
    const cv = cvRef.current;
    const ctx = cv.getContext("2d");
    let raf = 0, last = performance.now();
    const frame = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const st = S.current; st.t += dt;
      const L = live.current;
      update(st, L, dt);
      const { W, s } = fitCanvas(cv);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.setTransform(s, 0, 0, s, 0, 0);
      st.size = { W, s };
      draw(ctx, st, L, W);
      // ลูกโลกเลื่อนช้ากว่ากล้อง (อยู่ไกล) — หน่วยของ globeCore: จอสูง 3.44 หน่วย
      const g = globeRef.current;
      if (g) {
        const u = 540 / 3.44;
        g.setLayout({ x: (W * 0.6 - st.cam * 0.05 - W / 2) / u, y: -(205 - 270) / u, s: 1.0 }, true);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  function update(st, L, dt) {
    const w = L.sc.world;
    const worldW = w?.w || 3100;
    let v = 0;
    if (L.active && !L.paused) {
      if (st.keys.l) v -= 1;
      if (st.keys.r) v += 1;
      if (!v && st.target != null) {
        const d = st.target - st.x;
        if (Math.abs(d) < 4) {
          st.target = null;
          if (st.autoEnter) { const key = st.autoEnter; st.autoEnter = null; tryEnter(key); }
        } else v = Math.sign(d);
      }
    } else { st.keys = {}; }
    st.moving = v !== 0;
    if (v) {
      st.face = v;
      st.x = clamp(st.x + v * WALK * dt, 40, worldW - 40);
      if (st.target != null && Math.sign(st.target - st.x) !== v) st.x = st.target;
      st.ph += WALK * dt * 0.055;
      sendPos(false);
    } else if (st.sentX != null && Math.abs(st.sentX - st.x) > 0.5) sendPos(true);
    for (const o of Object.values(st.others)) {
      const d = o.tx - o.x;
      o.moving = Math.abs(d) > 1.5;
      o.x += d * Math.min(1, dt * 9);
      if (o.moving) o.ph += Math.min(Math.abs(d) * dt * 9, WALK * dt) * 0.055;
    }
    // ขอเก็บของที่ยืนทับ (ใครถึงก่อนได้ก่อน — server ตัดสิน)
    if (w && L.active && !L.paused) {
      const meP = L.players.find((p) => p.id === L.youId);
      for (const k of w.pickups) {
        if (Math.abs(k.x - st.x) > PICK_REACH) continue;
        if (k.kind === "matrix" && (L.sc.matrixHeld || 0) >= (L.sc.matrixMax || 4)) continue;
        const now = performance.now();
        if (now - (st.pickSent[k.id] || 0) < 450 || !meP?.alive) continue;
        st.pickSent[k.id] = now;
        sendPos(true);
        socket.emit("seraphPickup", { pid: k.id });
      }
    }
    st.bursts = st.bursts.filter((b) => st.t - b.at < 1);
  }

  return (
    <div className="fixed inset-0 sc-world" data-night={sc.night || undefined} aria-label="ทางเดินอาคารเรียน">
      <GlobeCanvas shared={false} drag={false} autoSpin={0.12} onReady={(core) => { globeRef.current = core; return () => { globeRef.current = null; }; }} />
      <canvas ref={cvRef} className="absolute inset-0 w-full h-full block" />
    </div>
  );
}

// ============================================================
//  วาดทั้งฉาก (หน่วยฉาก: สูง 540 · กว้าง W ตามสัดส่วนจอ)
// ============================================================
const SKYLINE = (() => { const r = lcg(77), a = []; let x = -200; while (x < 4200) { const w = 50 + r() * 90; a.push({ x, w, h: 40 + r() * 110, win: r() }); x += w + 6 + r() * 30; } return a; })();
const MOTES = (() => { const r = lcg(5), a = []; for (let i = 0; i < 70; i++) a.push({ x: r() * 3100, y: r(), s: 0.6 + r() * 1.6, sp: 0.2 + r() * 0.6, ph: r() * 10 }); return a; })();
const DATA = (() => { const r = lcg(9), a = []; for (let i = 0; i < 26; i++) a.push({ x: r() * 3100, y: r(), r: 3 + r() * 5, sp: 6 + r() * 10, ph: r() * 10, c: r() > 0.7 }); return a; })();

function palette(night) {
  return night ? {
    sky0: "#0a1c3f", sky1: "#2a5a93", wall0: "#1c355c", wall1: "#13284a", grid: 0.07, frame: "rgba(190,227,248,.55)",
    shaft: "rgba(160,205,255,A)", shaftA: 0.16, ceil: "#0f2140", lamp: "#cfe6ff", wains: "#162d50", trim: "rgba(127,184,230,.55)",
    floor0: "#21406b", floor1: "#0d1f3b", floorLine: "rgba(127,184,230,.16)", door: "#e6eef7", leaf: "#c9d9ea", leafLine: "rgba(28,63,110,.45)",
    city: "rgba(127,184,230,.22)", cityWin: "rgba(255,240,180,.75)", text: C.navyText
  } : {
    sky0: "#ffffff", sky1: "#cfe4f6", wall0: "#fbfdff", wall1: "#e3ecf6", grid: 0.06, frame: "rgba(61,139,217,.6)",
    shaft: "rgba(255,255,255,A)", shaftA: 0.5, ceil: "#dbe6f2", lamp: "#ffffff", wains: "#e2ebf5", trim: "rgba(61,139,217,.5)",
    floor0: "#edf3f9", floor1: "#cbdbeb", floorLine: "rgba(61,139,217,.14)", door: "#ffffff", leaf: "#eef3f9", leafLine: "rgba(79,110,149,.4)",
    city: "rgba(127,184,230,.28)", cityWin: "rgba(255,255,255,.9)", text: C.ink
  };
}

function draw(c, st, L, W) {
  const { sc, players, youId } = L;
  const world = sc.world || { w: 3100, doors: [], pickups: [], players: [] };
  const t = st.t, night = !!sc.night, P = palette(night);
  const worldW = world.w;
  st.cam = clamp(st.x - W / 2, 0, Math.max(0, worldW - W));
  const cam = st.cam, X = (wx) => wx - cam;
  const me = players.find((p) => p.id === youId);

  // ---- ท้องฟ้านอกหน้าต่าง + ลูกโลก + เมืองไกล ----
  if (night) { const r = lcg(3); for (let i = 0; i < 90; i++) { const sx = ((r() * 3600 - cam * 0.08) % (W + 40) + W + 40) % (W + 40) - 20; c.fillStyle = `rgba(255,255,255,${0.35 + 0.35 * Math.sin(t * 1.4 + i)})`; c.fillRect(sx, 46 + r() * 50, 1.4, 1.4); } }
  for (const b of SKYLINE) {
    const bx = b.x - cam * 0.3; if (bx > W + 10 || bx + b.w < -10) continue;
    c.fillStyle = P.city; c.fillRect(bx, 206 - b.h * 0.55, b.w, b.h * 0.55);
    if (b.win > 0.35) { c.fillStyle = night ? P.cityWin : "rgba(61,139,217,.22)"; for (let wy = 210 - b.h * 0.55; wy < 200; wy += 9) for (let wx = bx + 5; wx < bx + b.w - 6; wx += 10) if ((wx * 7 + wy * 3) % 5 < (night ? 2 : 3)) c.fillRect(wx, wy, 4, 4); }
  }

  // ---- ผนังเจาะหน้าต่าง ----
  const wg = c.createLinearGradient(0, 40, 0, FLOOR); wg.addColorStop(0, P.wall0); wg.addColorStop(1, P.wall1);
  c.fillStyle = wg; c.beginPath(); c.rect(0, 40, W, FLOOR - 40);
  const winStep = 200, ws = Math.floor((cam - 220) / winStep) * winStep + 40;
  const wins = [];
  for (let wx = ws; wx < cam + W + 220; wx += winStep) { wins.push(wx); c.rect(X(wx), 62, 136, 112); }
  c.fill("evenodd");
  survey(c, 0, 40, W, FLOOR - 40, cam, P.grid);
  // เสาผนัง
  for (let wx = Math.floor(cam / 400) * 400 + 170; wx < cam + W + 400; wx += 400) {
    const g = c.createLinearGradient(X(wx) - 16, 0, X(wx) + 16, 0);
    g.addColorStop(0, "rgba(28,63,110,0)"); g.addColorStop(0.5, night ? "rgba(255,255,255,.06)" : "rgba(28,63,110,.06)"); g.addColorStop(1, "rgba(28,63,110,0)");
    c.fillStyle = g; c.fillRect(X(wx) - 16, 40, 32, FLOOR - 40);
  }
  // กรอบหน้าต่าง
  for (const wx of wins) {
    const x0 = X(wx);
    c.strokeStyle = P.frame; c.lineWidth = 3; c.strokeRect(x0, 62, 136, 112);
    c.lineWidth = 1.5; c.beginPath(); c.moveTo(x0 + 68, 62); c.lineTo(x0 + 68, 174); c.moveTo(x0, 108); c.lineTo(x0 + 136, 108); c.stroke();
    c.fillStyle = night ? "rgba(190,227,248,.35)" : "rgba(255,255,255,.95)"; c.fillRect(x0 - 6, 174, 148, 5);
  }
  // เพดาน + ไฟ
  c.fillStyle = P.ceil; c.fillRect(0, 0, W, 40);
  c.fillStyle = night ? "rgba(127,184,230,.4)" : "rgba(61,139,217,.35)"; c.fillRect(0, 39, W, 1.5);
  for (let wx = Math.floor(cam / 260) * 260; wx < cam + W + 260; wx += 260) {
    glow(c, X(wx), 44, 110, night ? "rgba(190,227,248,A)" : IC, night ? 0.25 : 0.55);
    c.fillStyle = P.lamp; c.fillRect(X(wx) - 40, 34, 80, 6);
  }
  // บัวผนัง
  c.fillStyle = P.wains; c.fillRect(0, 330, W, FLOOR - 330);
  c.fillStyle = P.trim; c.fillRect(0, 330, W, 1.5); c.fillRect(0, FLOOR - 3, W, 3);

  // ---- ของตกแต่งตามทางเดิน (ล็อกเกอร์ / โปสเตอร์ / ต้นไม้ / จอข้อมูล) ----
  for (const d of DECOR) { const x = X(d.x); if (x > -200 && x < W + 200) drawDecor(c, x, d, t, P, night); }
  // ม่านข้างหน้าต่าง
  for (const wx of wins) {
    const x0 = X(wx);
    c.fillStyle = night ? "rgba(127,184,230,.35)" : "rgba(190,227,248,.85)";
    c.beginPath(); c.moveTo(x0 - 4, 58); c.lineTo(x0 + 14, 58); c.quadraticCurveTo(x0 + 6, 120, x0 + 12, 178); c.lineTo(x0 - 4, 178); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(x0 + 140, 58); c.lineTo(x0 + 122, 58); c.quadraticCurveTo(x0 + 130, 120, x0 + 124, 178); c.lineTo(x0 + 140, 178); c.closePath(); c.fill();
  }

  // ---- บอร์ดประกาศคู่ดวล (ขึ้นหลังจบวันที่ 5) ----
  drawBoard(c, X(BOARD_X), sc, players, t, P, night);

  // ---- ประตู ----
  const near = (() => { let b = null; for (const d of world.doors) { const dd = Math.abs(d.x - st.x); if (dd < DOOR_REACH && (!b || dd < b.dd)) b = { ...d, dd }; } return b; })();
  for (const d of world.doors) drawDoor(c, X(d.x), d.key, doorState(d.key, sc, me), near?.key === d.key || st.hover === d.key, t, P, night);

  // ---- ลำแสงจากหน้าต่างตกพื้น ----
  c.save(); c.globalCompositeOperation = night ? "lighter" : "source-over";
  for (const wx of wins) {
    const x0 = X(wx), sway = Math.sin(t * 0.3 + wx) * 6;
    const g = c.createLinearGradient(0, 70, 0, 520); g.addColorStop(0, P.shaft.replace("A", P.shaftA)); g.addColorStop(1, P.shaft.replace("A", 0));
    c.fillStyle = g;
    c.beginPath(); c.moveTo(x0 + 6, 66); c.lineTo(x0 + 130, 66); c.lineTo(x0 + 250 + sway, 530); c.lineTo(x0 + 70 + sway, 530); c.closePath(); c.fill();
  }
  c.restore();

  // ---- พื้น ----
  const fg = c.createLinearGradient(0, FLOOR, 0, 540); fg.addColorStop(0, P.floor0); fg.addColorStop(1, P.floor1);
  c.fillStyle = fg; c.fillRect(0, FLOOR, W, 540 - FLOOR);
  c.strokeStyle = P.floorLine; c.lineWidth = 1; c.beginPath();
  for (let wx = Math.floor((cam - 600) / 90) * 90; wx < cam + W + 600; wx += 90) { const sx = X(wx); c.moveTo(sx, FLOOR); c.lineTo(sx + (sx - W / 2) * 0.95, 540); }
  for (const f of [0.1, 0.26, 0.48, 0.78]) { const y = FLOOR + (540 - FLOOR) * f; c.moveTo(0, y); c.lineTo(W, y); }
  c.stroke();
  // เงาสะท้อนหน้าต่างบนพื้นมัน
  for (const wx of wins) { c.fillStyle = night ? "rgba(190,227,248,.07)" : "rgba(255,255,255,.55)"; c.beginPath(); c.ellipse(X(wx) + 160, 452, 70, 9, 0, 0, TAU); c.fill(); }
  // ฝุ่นในลำแสง
  for (const m of MOTES) {
    const mx = X(m.x) + Math.sin(t * m.sp + m.ph) * 14; if (mx < -10 || mx > W + 10) continue;
    const my = 90 + ((m.y * 420 + t * 8 * m.sp) % 420);
    c.fillStyle = night ? `rgba(190,227,248,${0.25 + 0.2 * Math.sin(t + m.ph)})` : `rgba(61,139,217,${0.12 + 0.1 * Math.sin(t + m.ph)})`;
    c.fillRect(mx, my, m.s, m.s);
  }

  // ---- ของในแมพ ----
  for (const k of world.pickups) drawPickup(c, X(k.x), k, t, sc);
  for (const b of st.bursts) {
    const p = (t - b.at) / 0.9, x = X(b.x);
    shock(c, x, 432, p, b.kind === "coin" ? GD : EC, 80);
    streaks(c, x, 432, p, b.kind === "coin" ? GD : EC, 12, 120);
    if (b.mine && p < 0.9) T(c, b.kind === "coin" ? "+1" : "Matrix +1", x, 380 - p * 40, { size: 18, w: 700, align: "center", color: b.kind === "coin" ? "#c08a1e" : C.echo });
  }

  // ---- ผู้เล่นอื่น (ร่างเงา + ตราผนึก) ----
  const pairIds = sc.pairs && sc.pairs[0] ? [sc.pairs[0].a, sc.pairs[0].b] : [];
  for (const [id, o] of Object.entries(st.others)) {
    const x = X(o.x); if (x < -80 || x > W + 80) continue;
    const pl = players.find((p) => p.id === id);
    floorShadow(c, x, OTHER_Y, 22, 0.16);
    glow(c, x, OTHER_Y - 4, 34, night ? "rgba(190,227,248,A)" : AZ, night ? 0.25 : 0.12);
    hologram(c, x, OTHER_Y, 0.88, { face: o.f, walk: o.ph, moving: o.moving, t: t + id.length * 1.7, tone: night ? "#9db8da" : "#8ba3c2", tint: pl?.color });
    const opp = sc.myOpponent === id;
    nameTag(c, pl?.name || "", x, OTHER_Y - 146, pl?.color || C.ink3, opp ? { line: C.hp, lineW: 2, color: C.hp } : {});
    if (opp) T(c, "คู่ดวล", x, OTHER_Y - 164, { size: 12, w: 700, align: "center", color: C.hp });
    else if (pairIds.includes(id)) T(c, "ลงดวล", x, OTHER_Y - 164, { size: 11, w: 600, align: "center", color: C.ink3 });
  }

  // ---- ตัวเรา (คนที่ถูกลบแล้วเหลือแค่กล้อง ไม่มีตัวในทางเดิน) ----
  const mx = X(st.x);
  const ghost = !me || me.scEliminated || me.alive === false;
  if (!ghost) {
  floorShadow(c, mx, ME_Y, 28, 0.22);
  glow(c, mx, ME_Y - 60, 90, AZ, night ? 0.18 : 0.1);
  avatar(c, mx, ME_Y, 1, { face: st.face, walk: st.ph, moving: st.moving, t, tie: me?.color || C.azure, rim: night ? "rgba(190,227,248,.9)" : "rgba(255,255,255,.95)", glow: night ? "rgba(127,184,230,.45)" : null });
  const myImg = loadImg(me?.img || me?.character?.img);
  portraitHex(c, mx, ME_Y - 168, 15, myImg, me?.color || C.azure);
  if (near && L.active && !L.paused) {
    const ds = doorState(near.key, sc, me);
    navy(c, mx - 48, ME_Y - 214, 96, 26, { k: 6, accent: ds === "open" ? C.echoGlow : false });
    T(c, ds === "open" ? "↑ เข้า" : ds === "used" ? "ใช้แล้ว" : "ปิด", mx, ME_Y - 200, { size: 14, w: 600, align: "center", base: "middle", color: ds === "open" ? C.navyText : C.navyMute });
  }
  }

  // ---- ชิ้นส่วนลอยฉากหน้า ----
  for (const d of DATA) {
    const x = X(d.x) * 1.15 - W * 0.07; if (x < -20 || x > W + 20) continue;
    const y = 540 - ((t * d.sp + d.ph * 50) % 560);
    c.save(); c.globalAlpha = 0.35; hexP(c, x, y, d.r); c.strokeStyle = d.c ? C.echo : C.azure; c.lineWidth = 1.2; c.stroke(); c.restore();
  }
  // เสาหน้ากล้อง (พารัลแลกซ์เร็วกว่า)
  for (let wx = Math.floor(cam * 1.3 / 1100) * 1100 + 700; wx < cam * 1.3 + W + 1100; wx += 1100) {
    const x = wx - cam * 1.3;
    const g = c.createLinearGradient(x - 34, 0, x + 34, 0); g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(0.5, night ? "rgba(20,40,80,.5)" : "rgba(255,255,255,.75)"); g.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = g; c.fillRect(x - 34, 0, 68, 540);
  }
  // วีเนต
  const vg = c.createRadialGradient(W / 2, 270, 220, W / 2, 270, W * 0.75);
  vg.addColorStop(0, "rgba(206,222,240,0)"); vg.addColorStop(1, night ? "rgba(5,12,30,.55)" : "rgba(190,210,232,.45)");
  c.fillStyle = vg; c.fillRect(0, 0, W, 540);

  // ---- แผนที่ย่อ ----
  drawMinimap(c, st, sc, world, W, players);

  // ---- เข้าประตู: วงแหวน + แฟลช / ประตูปิด: สั่น ----
  if (st.fx) {
    const d = t - st.fx.at, x = X(st.fx.x);
    if (st.fx.deny) { if (d < 0.5) shock(c, x, 300, d / 0.5, "rgba(210,69,91,A)", 70, 0.6); else st.fx = null; }
    else {
      shock(c, x, 300, d / 0.8, AZ, 300, 0.55);
      streaks(c, x, 300, d / 0.7, AZ, 16, 260);
      if (d < 0.6) { const k = d / 0.6; c.fillStyle = `rgba(255,255,255,${(k < 0.1 ? k / 0.1 : 1 - (k - 0.1) / 0.9) * 0.8})`; c.fillRect(0, 0, W, 540); }
    }
  }
}

// ของตกแต่ง: ตำแหน่งตายตัว (ไม่ทับประตู/บอร์ด)
const DECOR = [
  { x: 120, k: "plant" }, { x: 640, k: "lockers" }, { x: 790, k: "poster", v: 0 }, { x: 1360, k: "screen" },
  { x: 1700, k: "plant" }, { x: 1830, k: "lockers" }, { x: 2310, k: "poster", v: 1 }, { x: 2430, k: "plant" },
  { x: 2890, k: "lockers" }, { x: 3020, k: "screen" }
];
function drawDecor(c, x, d, t, P, night) {
  if (d.k === "lockers") {
    for (let i = 0; i < 5; i++) {
      const lx = x - 70 + i * 28;
      const g = c.createLinearGradient(lx, 0, lx + 27, 0);
      g.addColorStop(0, night ? "#2a4a75" : "#ffffff"); g.addColorStop(1, night ? "#1d3961" : "#e2ebf5");
      c.fillStyle = g; c.fillRect(lx, 250, 27, FLOOR - 252);
      c.strokeStyle = night ? "rgba(127,184,230,.45)" : "rgba(61,139,217,.4)"; c.lineWidth = 1; c.strokeRect(lx + 0.5, 250.5, 26, FLOOR - 253);
      c.fillStyle = night ? "rgba(127,184,230,.4)" : "rgba(61,139,217,.35)";
      for (let v = 0; v < 4; v++) c.fillRect(lx + 6, 262 + v * 4, 15, 1.4);
      c.fillStyle = C.azure; c.fillRect(lx + 20, 318, 2.5, 12);
    }
  } else if (d.k === "poster") {
    c.fillStyle = night ? "rgba(255,255,255,.9)" : "#ffffff"; c.fillRect(x - 46, 226, 92, 92);
    c.strokeStyle = "rgba(61,139,217,.5)"; c.lineWidth = 1.5; c.strokeRect(x - 46, 226, 92, 92);
    if (d.v === 0) { globe(c, x, 262, 22, t, { rings: true }); }
    else { hexP(c, x, 262, 22); c.fillStyle = C.echo; c.fill(); hexP(c, x, 262, 14); c.strokeStyle = "#fff"; c.lineWidth = 1.5; c.stroke(); }
    c.fillStyle = "rgba(28,63,110,.55)"; c.fillRect(x - 32, 296, 64, 4); c.fillStyle = "rgba(28,63,110,.25)"; c.fillRect(x - 32, 304, 44, 3);
    c.fillStyle = "rgba(61,139,217,.7)"; c.beginPath(); c.arc(x, 224, 3, 0, TAU); c.fill();
  } else if (d.k === "plant") {
    c.fillStyle = night ? "#2c4f80" : "#ffffff"; c.beginPath(); c.moveTo(x - 18, FLOOR - 40); c.lineTo(x + 18, FLOOR - 40); c.lineTo(x + 14, FLOOR - 2); c.lineTo(x - 14, FLOOR - 2); c.closePath(); c.fill();
    c.strokeStyle = "rgba(61,139,217,.5)"; c.lineWidth = 1.4; c.stroke();
    const sway = Math.sin(t * 0.9 + x * 0.01) * 0.06;
    for (let i = 0; i < 9; i++) {
      const a = -Math.PI / 2 + (i - 4) * 0.32 + sway, L = 34 + (i % 3) * 12;
      c.save(); c.translate(x, FLOOR - 40); c.rotate(a + Math.PI / 2);
      c.fillStyle = i % 2 ? (night ? "#5f9fd6" : "#7fb8e6") : (night ? "#3d7fbd" : "#9fd0ef");
      c.beginPath(); c.ellipse(0, -L / 2, 6, L / 2, 0, 0, TAU); c.fill(); c.restore();
    }
  } else if (d.k === "screen") {
    navy(c, x - 62, 232, 124, 74, { k: 8 });
    const sc0 = (t * 0.5) % 1;
    c.save(); c.beginPath(); c.rect(x - 56, 240, 112, 60); c.clip();
    c.strokeStyle = "rgba(190,227,248,.55)"; c.lineWidth = 1.2; c.beginPath();
    for (let i = 0; i <= 40; i++) { const px = x - 56 + i * 2.8, py = 280 - Math.sin(i * 0.5 + t * 2) * 8 - Math.sin(i * 0.17 + t) * 6; if (i) c.lineTo(px, py); else c.moveTo(px, py); }
    c.stroke();
    c.fillStyle = "rgba(201,154,214,.85)"; for (let i = 0; i < 6; i++) c.fillRect(x - 50 + i * 18, 290 - ((i * 7 + t * 9) % 14), 10, 2);
    c.fillStyle = "rgba(255,255,255,.14)"; c.fillRect(x - 56, 240 + sc0 * 60, 112, 3);
    c.restore();
    c.fillStyle = night ? "rgba(127,184,230,.5)" : "rgba(28,63,110,.35)"; c.fillRect(x - 3, 306, 6, 24);
  }
}

function drawDoor(c, x, key, state, lit, t, P, night) {
  if (x < -140 || x > 4000) return;
  const label = PLACE_LABEL[key];
  const free = key === "store" || key === "park";
  // กรอบ + บานคู่
  c.fillStyle = night ? "rgba(255,255,255,.9)" : "#ffffff"; c.fillRect(x - 60, 222, 120, FLOOR - 222);
  c.fillStyle = P.leaf; c.fillRect(x - 52, 230, 50, FLOOR - 232); c.fillRect(x + 2, 230, 50, FLOOR - 232);
  c.strokeStyle = P.leafLine; c.lineWidth = 1; c.strokeRect(x - 52, 230, 50, FLOOR - 232); c.strokeRect(x + 2, 230, 50, FLOOR - 232);
  c.fillStyle = night ? "rgba(255,230,160,.55)" : "rgba(190,227,248,.9)"; c.fillRect(x - 44, 246, 34, 48); c.fillRect(x + 10, 246, 34, 48);
  c.fillStyle = C.ink3; c.fillRect(x - 9, 322, 3, 18); c.fillRect(x + 6, 322, 3, 18);
  c.strokeStyle = free ? "rgba(155,79,150,.6)" : "rgba(61,139,217,.55)"; c.lineWidth = 1.5; c.strokeRect(x - 60, 222, 120, FLOOR - 222);
  // ป้ายชื่อ (แผงน้ำเงิน) + สัญลักษณ์
  navy(c, x - 72, 184, 144, 30, { k: 7, accent: free ? C.echoGlow : C.sky });
  doorGlyph(c, key, x - 52, 199, free ? C.echoGlow : C.sky);
  T(c, label, x + 8, 200, { size: 15, w: 600, align: "center", base: "middle", color: C.navyText });
  if (lit && state === "open") {
    glow(c, x, 470, 130, free ? EC : AZ, 0.18);
    c.save(); c.setLineDash([7, 6]); c.lineDashOffset = -t * 26; c.strokeStyle = free ? C.echo : C.azure; c.lineWidth = 2.2;
    c.strokeRect(x - 66, 216, 132, FLOOR - 210); c.restore();
  }
  if (state === "used") {
    c.strokeStyle = C.echo; c.lineWidth = 3; c.strokeRect(x - 60, 222, 120, FLOOR - 222);
    navy(c, x - 34, FLOOR - 30, 68, 22, { k: 5, accent: false, fill: "rgba(110,44,122,.92)" });
    T(c, "ใช้แล้ว", x, FLOOR - 18, { size: 12, w: 600, align: "center", base: "middle", color: "#fff" });
  }
  if (state === "locked" || state === "dim") {
    c.fillStyle = night ? "rgba(19,40,74,.55)" : "rgba(247,250,253,.7)"; c.fillRect(x - 60, 222, 120, FLOOR - 222);
    if (state === "locked") lockIcon(c, x, 318, 22, C.ink3);
  }
}

function doorGlyph(c, key, x, y, col) {
  c.save(); c.strokeStyle = col; c.fillStyle = col; c.lineWidth = 1.6; c.lineJoin = "round";
  c.beginPath();
  if (key === "room") { c.rect(x - 7, y - 1, 14, 6); c.moveTo(x - 7, y - 5); c.lineTo(x - 7, y + 5); }
  else if (key === "library") { c.rect(x - 7, y - 6, 6, 12); c.rect(x + 1, y - 6, 6, 12); }
  else if (key === "store") { c.moveTo(x - 8, y - 5); c.lineTo(x - 5, y - 5); c.lineTo(x - 2, y + 3); c.lineTo(x + 7, y + 3); c.lineTo(x + 8, y - 3); c.lineTo(x - 4, y - 3); }
  else if (key === "church") { c.moveTo(x, y - 8); c.lineTo(x, y + 7); c.moveTo(x - 5, y - 3); c.lineTo(x + 5, y - 3); }
  else if (key === "park") { c.arc(x, y - 2, 5, 0, TAU); c.moveTo(x, y + 3); c.lineTo(x, y + 8); }
  c.stroke(); c.restore();
}

function drawPickup(c, x, k, t, sc) {
  if (x < -40 || x > 4000) return;
  const bob = Math.sin(t * 2.2 + k.x) * 6, y = 428 + bob;
  if (k.kind === "matrix") {
    const full = (sc.matrixHeld || 0) >= (sc.matrixMax || 4);
    c.save(); c.globalAlpha = full ? 0.45 : 1;
    const bg = c.createLinearGradient(0, 230, 0, 470); bg.addColorStop(0, "rgba(155,79,150,0)"); bg.addColorStop(1, "rgba(155,79,150,.22)");
    c.fillStyle = bg; c.fillRect(x - 2, 230, 4, 240);
    glow(c, x, y, 44, EC, 0.35);
    const sx = Math.cos(t * 1.8 + k.x);
    c.translate(x, y); c.scale(Math.max(0.25, Math.abs(sx)), 1);
    diamondP(c, 0, 0, 15); c.fillStyle = "#fbf4ff"; c.fill(); c.strokeStyle = C.echo; c.lineWidth = 2; c.stroke();
    c.beginPath(); c.moveTo(0, -15); c.lineTo(0, 15); c.moveTo(-10, 0); c.lineTo(10, 0); c.strokeStyle = "rgba(155,79,150,.5)"; c.lineWidth = 1; c.stroke();
    diamondP(c, sx > 0 ? -3 : 3, -3, 5); c.fillStyle = C.echo; c.fill();
    c.restore();
    c.save(); c.strokeStyle = `rgba(155,79,150,${0.3 + 0.18 * Math.sin(t * 3 + k.x)})`; c.lineWidth = 1.5; c.beginPath(); c.ellipse(x, 476, 22, 5, 0, 0, TAU); c.stroke(); c.restore();
  } else {
    glow(c, x, y + 4, 30, GD, 0.35);
    coinP(c, x, y + 6, 10, Math.cos(t * 3 + k.x));
    c.save(); c.fillStyle = "rgba(160,120,30,.2)"; c.beginPath(); c.ellipse(x, 478, 12, 3, 0, 0, TAU); c.fill(); c.restore();
  }
}

function drawBoard(c, x, sc, players, t, P, night) {
  if (x < -200 || x > 4000) return;
  const y0 = 214, w = 190, h = 106;
  c.fillStyle = night ? "rgba(255,255,255,.92)" : "#ffffff"; c.fillRect(x - w / 2, y0, w, h);
  c.strokeStyle = "rgba(61,139,217,.55)"; c.lineWidth = 2; c.strokeRect(x - w / 2, y0, w, h);
  const pair = sc.pairs && sc.pairs[0];
  T(c, "การดวลวันที่ 7", x, y0 + 18, { size: 13, w: 700, align: "center", base: "middle", color: C.ink });
  c.fillStyle = "rgba(61,139,217,.25)"; c.fillRect(x - w / 2 + 12, y0 + 30, w - 24, 1);
  if (!pair) {
    T(c, "จบวันที่ 5", x, y0 + 64, { size: 14, w: 600, align: "center", base: "middle", color: C.ink3 });
    return;
  }
  const pa = players.find((p) => p.id === pair.a), pb = players.find((p) => p.id === pair.b);
  seal(c, x - 52, y0 + 62, 16, pa?.color || C.hp);
  seal(c, x + 52, y0 + 62, 16, pb?.color || C.azure);
  T(c, "VS", x, y0 + 62, { size: 16, w: 700, align: "center", base: "middle", color: C.echo });
  T(c, pair.aName, x - 52, y0 + 92, { size: 12, w: 600, align: "center", base: "middle", color: C.ink });
  T(c, pair.bName, x + 52, y0 + 92, { size: 12, w: 600, align: "center", base: "middle", color: C.ink });
  c.save(); c.setLineDash([5, 5]); c.lineDashOffset = -t * 16; c.strokeStyle = C.echo; c.lineWidth = 1.5; c.strokeRect(x - w / 2 - 6, y0 - 6, w + 12, h + 12); c.restore();
}

function drawMinimap(c, st, sc, world, W, players) {
  const mw = Math.min(380, W * 0.36), mx = W / 2 - mw / 2, my = 22;
  navy(c, mx - 14, 8, mw + 28, 30, { k: 6 });
  c.save(); c.setLineDash([4, 4]); c.lineDashOffset = -st.t * 14; c.strokeStyle = "rgba(157,184,218,.55)"; c.lineWidth = 1;
  c.beginPath(); c.moveTo(mx, my); c.lineTo(mx + mw, my); c.stroke(); c.restore();
  const M = (wx) => mx + (wx / world.w) * mw;
  c.strokeStyle = "rgba(190,227,248,.5)"; c.lineWidth = 1; c.strokeRect(M(st.cam), my - 8, (st.size.W / world.w) * mw, 16);
  for (const d of world.doors) { c.fillStyle = d.key === "store" || d.key === "park" ? C.echoGlow : C.navyText; c.fillRect(M(d.x) - 1.5, my - 6, 3, 12); }
  for (const k of world.pickups) {
    if (k.kind === "matrix") { diamondP(c, M(k.x), my, 4); c.fillStyle = C.echoGlow; c.fill(); }
    else { c.fillStyle = "#f0c24e"; c.beginPath(); c.arc(M(k.x), my, 2.4, 0, TAU); c.fill(); }
  }
  for (const [id, o] of Object.entries(st.others)) { const pl = players.find((p) => p.id === id); hexP(c, M(o.x), my + 9, 3.2); c.fillStyle = pl?.color || C.ink3; c.fill(); }
  c.fillStyle = C.ice; c.beginPath(); c.arc(M(st.x), my + 9, 3.8, 0, TAU); c.fill();
}
