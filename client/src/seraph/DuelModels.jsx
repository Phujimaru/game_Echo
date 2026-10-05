// ============================================================
//  Moon Cell วันดวล — โมเดลตัวละครยืนบนสนาม 2.5D (แบบสตอรี่บอร์ด)
//   - ฝ่ายตรงข้าม (ไกล) ยืนข้างการ์ดของเขาบนแท่นที่นั่ง · ตัวเรา (ใกล้กล้อง) ยืนหน้าซ้าย หันเข้าหาคู่ต่อสู้
//   - เหนือหัวมีตราหกเหลี่ยมใส่รูปตัวละครจริง (ไฟล์เดิมจาก R2) — วันดวลตัวละครถูกเปิดเผยแล้ว
//   - เข้าสนาม = ร่อนลงจากฟ้า + วงแหวนกระแทก · โจมตี = พุ่งเข้าหาเป้า เป้าสะเทือน + แฟลชแดง
//  วาดลง canvas ชั้นเดียวทับกระดาน (pointer-events: none) — ตำแหน่งที่นั่งใช้สูตรเดียวกับ Game.jsx (arenaLayout)
// ============================================================

import { useEffect, useLayoutEffect, useRef } from "react";
import { arenaLayout, arenaCardZoom, ARENA_CARD_SCALE } from "../journey/arena/arenaData";
import { C, AZ, HP, avatar, floorShadow, portraitHex, glow, shock, streaks, loadImg, hexP, ease } from "./ocKit";

const CARD_W = 260;

export default function DuelModels({ players, youId, duelPair, attack, night }) {
  const ref = useRef(null);
  const live = useRef({});
  useLayoutEffect(() => { live.current = { players, youId, duelPair, attack, night }; });
  const S = useRef({ t: 0, enter: 0, atk: null, seenAtk: null });

  useEffect(() => {
    const cv = ref.current, c = cv.getContext("2d");
    let raf = 0, last = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const st = S.current; st.t += dt;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const W = window.innerWidth, H = window.innerHeight;
      if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
      c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, cv.width, cv.height); c.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw(c, st, live.current, W, H);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // การโจมตีครั้งใหม่ -> เล่นท่าพุ่ง
  useEffect(() => {
    if (!attack || S.current.seenAtk === attack.id) return;
    S.current.seenAtk = attack.id;
    S.current.atk = { by: attack.byId, target: attack.targetId, at: S.current.t };
  }, [attack?.id]);

  return <canvas ref={ref} className="fixed inset-0 w-full h-full pointer-events-none sc-duel-models" aria-hidden />;
}

function seatFor(W, H, players, youId, duelPair) {
  // ผังเดียวกับกระดาน: ที่นั่งของ "คนอื่น" เรียงตามลำดับใน state.players (กรองเหลือคู่ดวล + เรา)
  const board = players.filter((p) => p.id === duelPair?.a || p.id === duelPair?.b || p.id === youId);
  const others = board.filter((p) => p.id !== youId);
  const lay = arenaLayout(W, H, 8, others.length);
  const bs = Math.min(1, H / 920) * Math.min(1, W / 900);
  const out = [];
  others.forEach((p, i) => {
    const o = lay.others[i]; if (!o) return;
    const w = CARD_W * o.s * ARENA_CARD_SCALE * bs * arenaCardZoom(W, H);
    // ยืนข้างการ์ด (ขวา ถ้าไม่ล้นจอ) บนพื้นระดับฐานที่นั่ง
    const right = o.cardX + w / 2 + 70 * (H / 900) < W - 60;
    out.push({ p, x: right ? o.cardX + w / 2 + 58 * (H / 900) : o.cardX - w / 2 - 58 * (H / 900), y: o.y + 6 * (H / 900), s: (H / 900) * 1.95 * o.s, face: right ? -1 : 1, far: true });
  });
  const me = board.find((p) => p.id === youId);
  const inDuel = me && (me.id === duelPair?.a || me.id === duelPair?.b);
  // ตัวเรา: ยืนช่องว่างระหว่างแผงตัวเรา (ซ้ายล่าง) กับไพ่กลางจอ — ไม่บัง HUD
  if (inDuel) out.push({ p: me, x: W * 0.29, y: H * 0.69, s: (H / 900) * 2.15, face: 1, far: false });
  return out;
}

function draw(c, st, L, W, H) {
  if (W < 768) return;
  const { players, youId, duelPair, night } = L;
  const seats = seatFor(W, H, players, youId, duelPair);
  const t = st.t;
  const atk = st.atk && t - st.atk.at < 1.4 ? st.atk : null;
  const pos = Object.fromEntries(seats.map((q) => [q.p.id, q]));
  for (const q of seats) {
    const p = q.p, alive = p.alive !== false;
    const land = ease((t - (q.far ? 0.4 : 0.8)) / 0.7);
    if (land <= 0) continue;
    let x = q.x, y = q.y - (1 - land) * H * 0.5;
    let shake = 0, flash = 0;
    if (atk && atk.by === p.id && pos[atk.target]) {
      const k = (t - atk.at) / 0.9, f = k < 0.35 ? ease(k / 0.35) : k < 0.7 ? 1 : 1 - ease((k - 0.7) / 0.3);
      const tgt = pos[atk.target];
      x += (tgt.x - q.x) * 0.35 * f; y += (tgt.y - q.y) * 0.35 * f;
    }
    if (atk && atk.target === p.id) {
      const k = (t - atk.at - 0.3) / 0.6;
      if (k > 0 && k < 1) { shake = Math.sin(k * 40) * (1 - k) * 8 * q.s; flash = 1 - k; }
    }
    const col = p.color || C.azure;
    // แท่นแสงใต้เท้า
    c.save(); c.translate(x, q.y);
    const pul = 0.5 + 0.5 * Math.sin(t * 2 + (q.far ? 0 : 1));
    c.strokeStyle = (q.far ? HP : AZ).replace("A", 0.5 + pul * 0.35); c.lineWidth = 2 * q.s;
    c.beginPath(); c.ellipse(0, 0, 46 * q.s, 11 * q.s, 0, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = (q.far ? HP : AZ).replace("A", 0.25); c.beginPath(); c.ellipse(0, 0, 60 * q.s, 15 * q.s, 0, 0, Math.PI * 2); c.stroke();
    c.restore();
    floorShadow(c, x, q.y, 30 * q.s, 0.22 * land);
    if (land < 1) shock(c, q.x, q.y, (t - (q.far ? 0.4 : 0.8) - 0.6) / 0.7, q.far ? HP : AZ, 140 * q.s, 0.28);
    c.save();
    if (!alive) c.globalAlpha = 0.35;
    glow(c, x, y - 70 * q.s, 90 * q.s, q.far ? "rgba(210,69,91,A)" : AZ, night ? 0.22 : 0.14);
    avatar(c, x + shake, y, q.s, {
      face: q.face, t: t + (q.far ? 2 : 0), tie: col,
      coat: q.far ? "#4a2236" : C.ink, trim: q.far ? "#ff9fac" : C.sky, hair: q.far ? "#2a1822" : "#24314d",
      rim: q.far ? "rgba(255,159,172,.95)" : "rgba(255,255,255,.95)", glow: q.far ? "rgba(210,69,91,.45)" : "rgba(61,139,217,.45)"
    });
    if (flash > 0) {
      c.globalCompositeOperation = "lighter";
      glow(c, x, y - 70 * q.s, 80 * q.s, HP, flash * 0.6);
      c.globalCompositeOperation = "source-over";
    }
    c.restore();
    // ตราหกเหลี่ยมรูปตัวละครเหนือหัว
    const img = loadImg(p.img || p.character?.img);
    portraitHex(c, x, y - 172 * q.s, 18 * q.s, img, col);
    if (atk && atk.by === p.id) {
      const k = (t - atk.at - 0.25) / 0.6, tgt = pos[atk.target];
      if (tgt) { streaks(c, tgt.x, tgt.y - 70 * tgt.s, k, HP, 12, 160 * tgt.s); shock(c, tgt.x, tgt.y - 70 * tgt.s, k, HP, 90 * tgt.s); }
    }
  }
  // เส้นประเชื่อมคู่ดวล (หายใจเบา ๆ)
  if (seats.length === 2) {
    const [a, b] = seats;
    c.save(); c.setLineDash([10, 10]); c.lineDashOffset = -t * 30;
    c.strokeStyle = `rgba(155,79,150,${0.25 + 0.15 * Math.sin(t * 2)})`; c.lineWidth = 2;
    c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke(); c.restore();
    hexP(c, (a.x + b.x) / 2, (a.y + b.y) / 2, 6); c.fillStyle = C.echoGlow; c.fill();
  }
}
