// ============================================================
//  ภูมิภาค VII — จุดสิ้นสุดของโลก
//  สนาม = เกาะหินแตกลอยเหนือเหว · รอยแยกลาวาเรืองเต้นเป็นจังหวะ · วงที่นั่ง = เสาหินบะซอลต์ · กลางสนาม = แท่นบูชาแตกในหลุมลาวา + กองไฟ
//  รอบนอก = แผ่นดินแตกลอยหลายระดับ หนามหินดำ เสาซากปรักหักพัง · ขอบโลกแตกร้าวที่เส้นขอบฟ้า
//  ฟ้าแดงเลือด/ดำ · ถ่านไฟลอยขึ้น เถ้าร่วง ฟ้าแลบ ไอร้อน · กลางด้านไกล (270°) โล่งไว้ให้บอส ORT
// ============================================================

import { r1, rand32, proj, seatPoint, nearSector } from "../arenaKit";

const H = { ring: [], pad: 14, center: [10, 24] };

function build(B) {
  const { k, px, night } = B;
  const rand = rand32(707);
  const C = night ? {
    sky: "linear-gradient(180deg, #000000 0%, #0c0102 9%, #2e0405 19%, #6e0b08 28%, #8a1209 34%, #3a0505 100%)",
    rock: "#24130f", rock2: "#170b09", rock3: "#3a1e17", ash: "rgba(110, 70, 60, 0.35)", abyss: ["#000000", "#2a0504", "#6a1008"],
    lava: "#ff3a1c", lavaHi: "#ffb08a", lavaGlow: "rgba(255, 50, 20, 0.55)", ember: "#ff7a3a",
    shadow: "rgba(0, 0, 0, 0.7)", edge: ["#000000", "#000000", "#ff3212"], isle: ["#1a0b09", "#2e1712"], spike: ["#0c0505", "#ff3a1c"],
    haze: ["rgba(8,0,0,0.7)", "rgba(70,6,4,0.25)"],
  } : {
    sky: "linear-gradient(180deg, #070101 0%, #2a0506 9%, #6c0f0a 18%, #b5341a 27%, #e0642a 33%, #6a1a0c 100%)",
    rock: "#3a2219", rock2: "#26140f", rock3: "#553126", ash: "rgba(160, 120, 105, 0.3)", abyss: ["#020000", "#4a0b05", "#a3300f"],
    lava: "#ff5a1a", lavaHi: "#ffd27a", lavaGlow: "rgba(255, 100, 30, 0.5)", ember: "#ffb347",
    shadow: "rgba(10, 0, 0, 0.6)", edge: ["#000000", "#080101", "#ff7a26"], isle: ["#2a1410", "#4a281e"], spike: ["#170908", "#ff6a26"],
    haze: ["rgba(30,4,2,0.6)", "rgba(140,40,12,0.2)"],
  };
  B.sky = C.sky;
  B.shadow = C.shadow;
  B.hazeDark = true;
  B.hazeGrad = `linear-gradient(180deg, ${C.haze[0]} 0%, ${C.haze[1]} 22%, rgba(0,0,0,0) 46%)`;

  /* พื้น: เกาะหิน (เถ้าโรยเป็นจุด) -> ขอบเกาะ -> เหวมืดที่มีแสงลาวาเรืองจากเบื้องล่าง */
  B.ground = `radial-gradient(circle at 50% 50%, ${C.rock3} 0, ${C.rock} ${px(380)}, ${C.rock2} ${px(690)}, ${C.abyss[0]} ${px(706)}, ${C.abyss[0]} ${px(800)}, ${C.abyss[1]} ${px(1150)}, ${C.abyss[2]} ${px(1700)})`;
  B.disc(0, 0, 690 * k, `radial-gradient(circle, ${C.ash} 0 ${px(2.4)}, transparent ${px(3.4)}) 0 0 / ${px(21)} ${px(25)}`);

  /* แสงลาวาในเหวลึก (ใต้เกาะ) */
  for (let g = 0; g < 7; g++) {
    const a = rand() * Math.PI * 2;
    const rr = (950 + rand() * 500) * k;
    B.disc(Math.cos(a) * rr, Math.sin(a) * rr, (180 + rand() * 160) * k, `radial-gradient(circle, ${C.lavaGlow} 0%, transparent 70%)`, null, 0.8, `arPulse ${r1(4 + rand() * 3)}s ease-in-out ${r1(-rand() * 4)}s infinite`);
  }
  /* ขอบเกาะแตกหยัก + ก้อนหินหลุดลอยอยู่ใกล้ขอบ */
  for (let i = 0; i < 26; i++) {
    const a = ((i + rand() * 0.7) / 26) * Math.PI * 2;
    const rr = (670 + rand() * 80) * k;
    B.rect(Math.cos(a) * rr, Math.sin(a) * rr, (90 + rand() * 80) * k, (70 + rand() * 60) * k, C.rock2, null, rand() * 90, 1, `${r1(14 + rand() * 30)}%`);
  }
  for (let i = 0; i < 12; i++) {
    const a = rand() * Math.PI * 2;
    const rr = (800 + rand() * 160) * k;
    const sz = (24 + rand() * 40) * k;
    B.rect(Math.cos(a) * rr + 8 * k, Math.sin(a) * rr + 18 * k, sz, sz * 0.8, "rgba(0,0,0,0.55)", null, rand() * 90, 1, "35%");
    B.rect(Math.cos(a) * rr, Math.sin(a) * rr, sz, sz * 0.8, C.rock2, `${px(2)} solid ${C.rock3}`, rand() * 90, 1, "35%");
  }
  /* รอยไหม้ดำบนพื้น */
  for (let s = 0; s < 14; s++) {
    const a = rand() * Math.PI * 2;
    const rr = (180 + rand() * 440) * k;
    B.oval(Math.cos(a) * rr, Math.sin(a) * rr, (40 + rand() * 50) * k, (26 + rand() * 30) * k, "radial-gradient(closest-side, rgba(0,0,0,0.55), transparent)", 1, rand() * 180);
  }

  /* รอยแยกลาวา: แตกจากหลุมกลางออกไปถึงขอบเกาะ (เรืองกว้าง + แกนสว่าง) — ทั้งเส้นเต้นจังหวะเดียวกัน */
  const lavaCore = `linear-gradient(180deg, ${C.lava} 0%, ${C.lavaHi} 50%, ${C.lava} 100%)`;
  const lavaWide = `linear-gradient(180deg, transparent 0%, ${C.lavaGlow} 50%, transparent 100%)`;
  const crack = (x, y, a, n, len, w, anim) => {
    for (let i = 0; i < n; i++) {
      const L = (len * (0.7 + rand() * 0.6)) * k;
      const nx = x + Math.cos(a) * L;
      const ny = y + Math.sin(a) * L;
      const deg = (a * 180) / Math.PI;
      const ww = w * (1 - (i / n) * 0.55);
      B.flat((x + nx) / 2, (y + ny) / 2, L + 6 * k, ww * 5.5 * k, { bg: lavaWide, rot: deg, anim });
      B.rect((x + nx) / 2, (y + ny) / 2, L + 3 * k, ww * k, lavaCore, null, deg, 1, px(3));
      x = nx;
      y = ny;
      a += (rand() - 0.5) * 0.9;
    }
    return [x, y];
  };
  const ends = []; // ปลายรอยแยก (ไว้วางเปลวไฟ)
  for (let c = 0; c < 9; c++) {
    const deg = c * 40 + 20 + (rand() - 0.5) * 14;
    const a0 = (deg * Math.PI) / 180;
    const anim = `arPulse ${r1(2.6 + rand() * 1.8)}s ease-in-out ${r1(-rand() * 3)}s infinite`;
    const end = crack(Math.cos(a0) * 150 * k, Math.sin(a0) * 150 * k, a0, 5, 108, 5, anim);
    ends.push([...end, deg]);
    if (c % 3 === 1) crack(end[0], end[1], a0 + 0.8, 2, 60, 3, anim);
  }

  /* วงไฟรอบหลุมกลาง + วงพิธีไหม้ใต้วงที่นั่ง */
  B.disc(0, 0, 240 * k, `radial-gradient(circle, ${C.lavaGlow} 0%, transparent 72%)`, null, 1, "arPulse 3.4s ease-in-out infinite");
  B.disc(0, 0, 214 * k, "transparent", `${px(4)} solid ${C.lava}`, 0.85, "arPulse 3.4s ease-in-out infinite");
  B.disc(0, 0, 202 * k, "transparent", `${px(2)} dashed ${C.lavaHi}`, 0.6, "arSpin 50s linear infinite");
  B.disc(0, 0, 360 * k, "transparent", `${px(3)} dashed rgba(255, 90, 40, 0.35)`, 1, "arSpin 120s linear infinite reverse");

  /* หลุมลาวา (ขอบหินยก) + แท่นบูชาแตกกลางหลุม */
  const rockSide = `linear-gradient(90deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.7) 100%), repeating-linear-gradient(90deg, ${C.rock2} 0 ${px(12)}, ${C.rock3} ${px(12)} ${px(16)}, ${C.rock} ${px(16)} ${px(30)})`;
  const Lc = B.cyl(0, 0, 150 * k, H.center[0], rockSide,
    `radial-gradient(circle at 50% 50%, ${C.lavaHi} 0%, ${C.lava} 34%, #8a1606 62%, ${C.rock2} 78%)`, `${px(12)} solid ${C.rock3}`);
  B.disc(0, Lc, 120 * k, `radial-gradient(circle, rgba(255, 230, 160, 0.7) 0%, transparent 65%)`, null, 1, "arPulse 2.2s ease-in-out infinite");
  for (let r = 0; r < 2; r++) B.disc(0, Lc, 118 * k, "transparent", `${px(3)} solid ${C.lavaHi}`, 1, `arRipple 3s ease-out ${r1(-r * 1.5)}s infinite`);
  /* เศษแท่นบูชาแตกลอยบนลาวา */
  [[-92, 30, 40, 20, 28], [86, 46, 32, 16, -34], [70, -78, 26, 14, 60], [-80, -62, 22, 12, -20]].forEach(([x, y, w, h, rot]) => {
    B.rect(x * k, Lc + y * k, w * k, h * k, C.rock3, `${px(2)} solid ${C.rock2}`, rot, 1, px(3));
  });
  const altarSide = `linear-gradient(90deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 38%, rgba(0,0,0,0.7) 100%), linear-gradient(90deg, transparent 0 22%, ${C.lava} 22% 23.5%, transparent 23.5% 64%, ${C.lava} 64% 65%, transparent 65%), ${C.rock3}`;
  const La = B.cyl(0, Lc, 56 * k, H.center[1], altarSide,
    `radial-gradient(circle, ${C.rock3} 0 55%, ${C.rock} 56%)`, `${px(5)} solid ${C.lava}`);
  B.disc(0, La, 44 * k, "transparent", `${px(2)} solid ${C.lavaHi}`, 0.8, "arPulse 2.6s ease-in-out infinite");
  B.disc(0, La, 90 * k, `radial-gradient(circle, ${C.lavaGlow} 0%, transparent 70%)`, null, 1, "arPulse 2.6s ease-in-out infinite");

  B.fore = (W, Hh, S) => {
    [[0.05, 1.0, 520, 300, 0], [0.96, 1.0, 560, 320, 1]].forEach((b, i) => {
      B.foreAdd("I7Crag", W * b[0], Hh * b[1], b[2] * S, b[3] * S, { col: night ? "#050101" : "#0e0303", col2: C.lava, blur: 8 * S, op: 0.95, rot: i });
    });
    [[0.08, 0.05, 620, 260], [0.92, 0.03, 680, 280]].forEach((b, i) => {
      B.foreAdd("I7Smoke", W * b[0], Hh * b[1], b[2] * S, b[3] * S, { col: night ? "rgba(6,0,0,0.9)" : "rgba(26,6,4,0.85)", blur: 14 * S, op: 0.9, anim: `arDrift ${18 + i * 6}s ease-in-out ${-i * 7}s infinite` });
    });
  };

  return {
    ringLift: 0,
    centerLift: La,
    seatPad: (p, st, rr) => {
      const big = rr > 50 * k;
      B.disc(p.x, p.y, rr * 2, `radial-gradient(circle, ${st.col} 0%, transparent 70%)`, null, night ? 0.7 : 0.55);
      B.disc(p.x, p.y, rr * 1.4, "transparent", `${px(big ? 4 : 3)} solid ${C.lava}`, 0.9, "arPulse 2.8s ease-in-out infinite");
      const hexSide = `linear-gradient(90deg, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.75) 100%), repeating-linear-gradient(90deg, ${C.rock} 0 ${px(9)}, ${C.rock3} ${px(9)} ${px(11)}, ${C.rock2} ${px(11)} ${px(20)})`;
      return B.cyl(p.x, p.y, rr, H.pad, hexSide,
        `radial-gradient(circle at 40% 35%, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0) 48%), ${st.col}`,
        `${px(big ? 7 : 5)} solid ${C.rock3}`) - p.y;
    },
    after: () => {
      const t = rand32(71);
      /* ขอบโลกแตกร้าวที่เส้นขอบฟ้า */
      B.stand("I7Edge", 0, -1660 * k, 3400, 440, { c1: C.edge[0], c2: C.edge[1], col: C.edge[2], c3: C.lavaHi }, false);
      /* หนามหินดำ: กลุ่มซ้าย-ขวาระหว่างวงที่นั่งกับขอบเกาะ (กลางด้านหลังโล่ง เห็นขอบเกาะกับเหว) */
      [[-620, -420, 1.5], [-520, -570, 1.15], [-700, -560, 0.95], [-430, -650, 0.8], [620, -430, 1.5], [530, -580, 1.15], [705, -545, 0.95], [440, -655, 0.8]].forEach(([x, y, sc], i) => {
        B.stand("I7Spike", x * k, y * k, 90 * sc, 160 * sc, { c1: C.spike[0], c2: C.spike[1], col: C.lava, rot: i % 3 });
      });
      /* เสาซากปรักหักพังหลังวงที่นั่ง */
      [212, 328].forEach((d, i) => {
        const p = seatPoint(440 * k, d);
        B.stand("I7Ruin", p.x, p.y, 70, 130, { c1: C.spike[0], c2: C.rock2, col: C.lava, c3: C.spike[1], rot: i % 2 });
      });
      /* เปลวไฟริมเกาะด้านหลัง */
      [232, 252, 288, 308].forEach((d, i) => {
        const p = seatPoint(650 * k, d);
        B.oval(p.x, p.y, 40 * k, 22 * k, `radial-gradient(closest-side, ${C.lavaHi}, ${C.lava} 45%, transparent)`, 0.9);
        B.stand("I7Flame", p.x, p.y, 54, 84, { c1: C.lava, c2: C.lavaHi, anim: `ar7Flicker ${r1(1 + i * 0.17)}s ease-in-out ${r1(-i * 0.5)}s infinite` }, false);
      });
      /* เปลวไฟพุ่งจากปลายรอยแยก (มีบ่อลาวาใต้เปลว) */
      ends.forEach(([x, y, d], i) => {
        if (nearSector(d) || Math.abs(d - 270) < 12) return;
        const fx = x * 0.94;
        const fy = y * 0.94;
        B.oval(fx, fy, 46 * k, 26 * k, `radial-gradient(closest-side, ${C.lavaHi}, ${C.lava} 45%, transparent)`, 0.9);
        const z = 0.75 + t() * 0.4;
        B.stand("I7Flame", fx, fy, 64 * z, 96 * z, { c1: C.lava, c2: C.lavaHi, anim: `ar7Flicker ${r1(0.9 + t() * 0.6)}s ease-in-out ${r1(-i * 0.37)}s infinite` }, false);
      });
      /* กองไฟบนแท่นบูชา (ยืนบนหน้าแท่น ด้านหลังกองไพ่) */
      B.stand("I7Flame", 0, La - 30 * k, 96, 96, { c1: C.lava, c2: C.lavaHi, anim: "ar7Flicker 1.1s ease-in-out infinite" }, false);
      [[-40, -6], [40, -6]].forEach(([x, y], i) => {
        B.stand("I7Flame", x * k, La + y * k, 46, 58, { c1: C.lava, c2: C.lavaHi, anim: `ar7Flicker ${0.8 + i * 0.2}s ease-in-out ${-i * 0.4}s infinite` }, false);
      });

      /* เอฟเฟกต์ */
      const f = rand32(77);
      const { W, H: Hh } = B.c;
      const S = B.S;
      B.fxAdd("I7Orb", W * 0.64, Hh * 0.1, 150 * S, 170 * S, { col: night ? "#c8261a" : "#ff9a3a", col2: night ? "#3a0202" : "#000000", rot: night ? 1 : 0, anim: "arPulse 6s ease-in-out infinite" });
      B.fxAdd("Glow", W * 0.5, Hh * 0.22, W * 1.3, Hh * 0.32, { col: night ? "rgba(255, 40, 20, 0.4)" : "rgba(255, 120, 40, 0.45)", anim: "arPulse 3.6s ease-in-out infinite" });
      /* รอยแยกบนฟ้าเหนือเหวที่ขอบโลก */
      {
        // วางตรงเหวสองแห่งในภาพขอบโลก (I7Edge กว้าง 3400 · เหวที่ x≈1000/2440 · ปากเหว y≈260/440)
        const e = proj(B.c, 0, -1660 * k);
        const ew = 3400 * k * e.s;
        [[1000, 0], [2440, 1]].forEach(([ex, v], i) => {
          const h = Hh * 0.22;
          B.fxAdd("I7Rift", e.x + (ex / 3400 - 0.5) * ew, e.y - 180 * k * e.s - h / 2 + 10 * S, 150 * S, h, { col: C.lava, col2: C.lavaHi, rot: v, anim: `arPulse ${2.4 + i * 0.7}s ease-in-out ${-i}s infinite` });
        });
      }
      /* แผ่นดินแตกลอยกลางฟ้า (ใหญ่ = ใกล้) — เว้นกลางจอด้านบนให้การ์ดบอส */
      const nt = night ? 10 : 0;
      [[0.07, 0.17, 290, 0], [0.93, 0.18, 300, 1], [0.36, 0.05, 150, 2], [0.56, 0.04, 120, 0], [0.2, 0.28, 120, 1], [0.84, 0.31, 110, 2]].forEach((b, i) => {
        B.fxAdd("I7IsleFx", W * b[0], Hh * b[1], b[2] * S, b[2] * 1.23 * S, { col: C.lava, col2: C.lavaHi, rot: b[3] + nt, anim: `ar7Hover ${r1(7 + i * 1.1)}s ease-in-out ${r1(-i * 1.7)}s infinite` });
      });
      [[0.15, 0.06, 46], [0.27, 0.2, 34], [0.47, 0.13, 30], [0.68, 0.22, 40], [0.77, 0.03, 36], [0.99, 0.29, 50]].forEach((b, i) => {
        B.fxAdd("I7ChunkFx", W * b[0], Hh * b[1], b[2] * S, b[2] * 0.9 * S, { col: C.lava, col2: C.lavaHi, rot: i + nt, anim: `ar7Hover ${r1(4.5 + i * 0.8)}s ease-in-out ${r1(-i * 1.3)}s infinite` });
      });
      for (let sm = 0; sm < 4; sm++) {
        B.fxAdd("Fog", W * (0.1 + sm * 0.27), Hh * (0.06 + (sm % 2) * 0.08), W * 0.6, Hh * 0.2, {
          col: night ? "rgba(0, 0, 0, 0.6)" : "rgba(20, 2, 2, 0.5)", anim: `arDrift ${r1(20 + f() * 14)}s ease-in-out ${r1(-f() * 20)}s infinite`,
        });
      }
      /* ฟ้าแลบ: สายฟ้าแวบในฟ้าเท่านั้น — ไม่มีแฟลชทั้งจอ (ผู้ใช้เคยเจอจอกระพริบ แฟลชเต็มจอจะดูเหมือนบั๊กเดิมและแสบตา) */
      [[0.2, 0.1, 7.3, 0], [0.62, 0.06, 9.1, -3.2], [0.88, 0.14, 11.7, -6.5], [0.4, 0.04, 13.3, -9]].slice(0, night ? 4 : 3).forEach((b, i) => {
        B.fxAdd("I7Bolt", W * b[0], Hh * b[1], 110 * S, Hh * 0.3, { col: night ? "#ffd0c0" : "#fff2e0", col2: C.lava, rot: i % 2, anim: `ar7Bolt ${b[2]}s linear ${b[3]}s infinite` });
      });
      /* ไอร้อนเหนือรอยแยก */
      for (let h = 0; h < 3; h++) {
        const p = proj(B.c, (h - 1) * 380 * k, -120 * k);
        B.fxAdd("Glow", p.x, p.y, 420 * S, 160 * S, { col: C.lavaGlow, op: 0.5, anim: `arPulse ${r1(3 + h)}s ease-in-out ${-h}s infinite` });
      }
      /* ถ่านไฟลอยขึ้นจากล่างจอ */
      for (let e = 0; e < 32; e++) {
        const z = (e % 4 === 0 ? 7 + f() * 5 : 3 + f() * 4) * S;
        const dur = 6 + f() * 7;
        B.fxAdd("I7Ember", f() * W, Hh + 10 * S, z, z, {
          col: e % 3 ? C.ember : C.lavaHi, op: 0.95,
          anim: `${e % 2 ? "ar7RiseA" : "ar7RiseB"} ${r1(dur)}s linear ${r1(-f() * dur)}s infinite`,
        });
      }
      /* เถ้าร่วง */
      for (let a = 0; a < 18; a++) {
        const z = (5 + f() * 6) * S;
        const dur = 11 + f() * 8;
        B.fxAdd("I7Ash", f() * W * 1.1 - W * 0.05, f() * Hh * 0.9 - Hh * 0.1, z, z * 0.7, {
          col: night ? "#4a3a38" : "#7a6a66", op: 0.8, rot: r1(f() * 180),
          anim: `${a % 2 ? "arFallA" : "arFallB"} ${r1(dur)}s linear ${r1(-f() * dur)}s infinite`,
        });
      }
      B.fxAdd("Vignette", W / 2, Hh / 2, W, Hh, { col: night ? "rgba(10, 0, 0, 0.85)" : "rgba(30, 2, 0, 0.7)" });
    },
  };
}

export default { H, build };
