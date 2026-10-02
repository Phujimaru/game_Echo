// ============================================================
//  ภูมิภาค IV — คลื่นวงวนน้ำ
//  สนาม = วงแท่นหินกลางวังวนน้ำยักษ์ · วงที่นั่ง = หินลอยน้ำ (มีคลื่นซัดรอบ)
//  กลางสนาม = เสาหินปะการัง + ลำน้ำพุ่งวน (กองไพ่วางบนผิวน้ำวน)
//  รอบนอก = เกาะหินโด่ง ซุ้มหินโค้ง ซากเรือ งูทะเลยักษ์ · นกนางนวลบินวน ละอองน้ำ ฟองอากาศ
//  กลางคืน = แพลงก์ตอนเรืองแสงสีฟ้า + แสงจันทร์
// ============================================================

import { r1, rand32, proj, seatPoint } from "../arenaKit";

const H = { ring: [], pad: 12, center: [10, 19, 12] };

/* แขนเกลียวลอการิทึม (r = r0 → r1, มุมเพิ่มตาม ln r) — หมุนตามเข็ม (arSpin) แล้วแขนดูไหลเข้าหากลาง */
function armPath(th0, a, ra, rb, n) {
  let d = "";
  for (let i = 0; i <= n; i++) {
    const r = ra * Math.pow(rb / ra, i / n);
    const th = th0 + a * Math.log(r / ra);
    d += `${i ? "L" : "M"}${Math.round(r * Math.cos(th))} ${Math.round(r * Math.sin(th))}`;
  }
  return d;
}

/* ภาพเกลียวเป็น SVG data-URI (ใช้เป็นพื้นหลังของแผ่นพื้น) — viewBox -1000..1000 */
function swirlSvg(layers) {
  let body = "";
  for (const L of layers) {
    for (let j = 0; j < L.n; j++) {
      const d = armPath((j / L.n) * Math.PI * 2 + (L.off || 0), L.a, L.ra, L.rb, 46);
      body += `<path d='${d}' fill='none' stroke='${L.col}' stroke-opacity='${L.op}' stroke-width='${L.w}' stroke-linecap='round'${L.dash ? ` stroke-dasharray='${L.dash}'` : ""}/>`;
    }
  }
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='-1000 -1000 2000 2000'>${body}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

function build(B) {
  const { k, px, night } = B;
  const rand = rand32(404);
  const C = night ? {
    sky: "linear-gradient(180deg, #01040b 0%, #051327 40%, #0b2a46 78%, #123a58 100%)",
    far: "#0d3550", outer: "#0a2b44", mid: "#072036", deep: "#04121f", eye: "#00050a",
    foam: "#7ff3ff", foamOp: 0.5, arm: "#47e6ff", armOp: 0.32, glint: "#9ff6ff",
    shallow: "rgba(60, 220, 240, 0.16)", slab: "#1d4a5c", rune: "#6ff4ff",
    rock: ["#0b141b", "#17252f", "#22343f"], rockTop: "#2a3d47", wet: ["#06100f", "#0f2522"], moss: "#1f5a4c",
    coral: ["#ff5fc8", "#5ff0ff", "#b88cff", "#ffd36b"], water: ["#0b5a74", "#4fe0f5"], shadow: "rgba(0, 10, 20, 0.55)",
    stack: ["#0b161d", "#172a34", "#3f7484"], foamStand: "#8af4ff", sail: "#3c5566", serp: ["#0b1c22", "#1d3b42"], eye2: "#ff5a4a",
    hz: ["#1a4a66", "#0b2a42", "#08151f"], haze: ["rgba(2,8,18,0.72)", "rgba(10,40,70,0.3)"],
  } : {
    sky: "linear-gradient(180deg, #24597d 0%, #4f8fae 38%, #9ac9d8 74%, #d2eaee 100%)",
    far: "#3d9cb4", outer: "#2b87a3", mid: "#1b6787", deep: "#0d4462", eye: "#03182a",
    foam: "#ffffff", foamOp: 0.62, arm: "#e9fbff", armOp: 0.34, glint: "#ffffff",
    shallow: "rgba(150, 240, 230, 0.32)", slab: "#6aa6a6", rune: "#e6fbff",
    rock: ["#2c3a41", "#4b5d64", "#66797f"], rockTop: "#7a8b8c", wet: ["#1d2b2c", "#2f4a44"], moss: "#5c8f6a",
    coral: ["#ff7a6b", "#ffb55e", "#e8689c", "#fff1c4"], water: ["#1f86a8", "#b9f2ff"], shadow: "rgba(4, 30, 46, 0.4)",
    stack: ["#2f3e45", "#4a5b62", "#6d8086"], foamStand: "#ffffff", sail: "#d9d1bc", serp: ["#1d3a3e", "#3b6a68"], eye2: "#ffd35a",
    hz: ["#8cc9d6", "#3c95ad", "#2a7f98"], haze: null,
  };
  B.sky = C.sky;
  B.shadow = C.shadow;
  if (night) {
    B.hazeDark = true;
    B.hazeGrad = `linear-gradient(180deg, ${C.haze[0]} 0%, ${C.haze[1]} 22%, rgba(0,0,0,0) 46%)`;
  } else {
    B.hazeCol = "rgba(214, 238, 242, 0.6)";
  }

  /* ผิวน้ำ: เกลียวนิ่งทั้งผืน (ไว้ดูตอนมองตรงลง) + ไล่สีจากขอบลงไปก้นวังวน */
  const groundSwirl = swirlSvg([
    { n: 7, a: 2.1, ra: 70, rb: 1000, col: C.arm, op: C.armOp * 0.55, w: 26 },
    { n: 7, a: 2.1, ra: 80, rb: 1000, col: C.foam, op: C.foamOp * 0.7, w: 5, dash: "60 40 20 50", off: 0.18 },
    { n: 14, a: 2.3, ra: 120, rb: 900, col: C.arm, op: C.armOp * 0.45, w: 3, off: 0.4 },
  ]);
  B.ground = `${groundSwirl} center / 100% 100% no-repeat, `
    + `radial-gradient(circle at 50% 50%, ${C.eye} 0, ${C.deep} ${px(200)}, ${C.mid} ${px(520)}, ${C.outer} ${px(1000)}, ${C.far} ${px(1700)})`;

  /* แผ่นเกลียวหมุน 2 ชั้น (นอกช้า · ในเร็ว) + วงฟองถูกดูดเข้ากลาง */
  const spinOuter = swirlSvg([
    { n: 6, a: 2.0, ra: 140, rb: 1000, col: C.foam, op: C.foamOp, w: 9, dash: "90 60 30 70" },
    { n: 6, a: 2.0, ra: 160, rb: 1000, col: C.arm, op: C.armOp, w: 34, off: 0.5 },
  ]);
  B.disc(0, 0, 560 * k, spinOuter, null, night ? 0.9 : 0.75, "arSpin 80s linear infinite");
  /* op ใช้เฉพาะ lowQ (อนิเมชันคุม opacity เอง) */
  for (let i = 0; i < 2; i++) {
    B.disc(0, 0, 480 * k, "transparent", `${px(6)} solid ${C.foam}`, 0.35, `ar4Suck 9s linear ${r1(-i * 4.5)}s infinite`);
  }
  const spinInner = swirlSvg([
    { n: 5, a: 1.6, ra: 120, rb: 1000, col: C.foam, op: C.foamOp + 0.15, w: 16, dash: "120 50" },
    { n: 10, a: 1.7, ra: 200, rb: 1000, col: C.arm, op: C.armOp + 0.1, w: 7, off: 0.3 },
  ]);
  B.disc(0, 0, 285 * k, `${spinInner} center / 100% 100% no-repeat, radial-gradient(closest-side, ${C.eye} 0%, ${C.deep} 62%, rgba(0,0,0,0) 100%)`, null, 1, "arSpin 26s linear infinite");

  /* ทางหินจมน้ำ (วงที่นั่ง) — น้ำตื้นสีอ่อน + แผ่นหินโบราณใต้น้ำ + ลายเส้นเรือง */
  B.disc(0, 0, 300 * k, "transparent", `${px(44)} solid ${C.shallow}`);
  for (let q = 0; q < 26; q++) {
    const aq = (q / 26) * 360 + rand() * 4;
    const p = seatPoint((300 + (rand() - 0.5) * 8) * k, aq);
    B.rect(p.x, p.y, 62 * k, 30 * k, C.slab, null, aq + 90, night ? 0.4 : 0.45, px(6));
  }
  B.disc(0, 0, 326 * k, "transparent", `${px(2)} solid ${C.rune}`, night ? 0.6 : 0.4, night ? "arPulse 5s ease-in-out infinite" : "none");
  B.disc(0, 0, 274 * k, "transparent", `${px(2)} dashed ${C.rune}`, night ? 0.5 : 0.35);

  /* ประกายแสงบนผิวน้ำ */
  for (let g = 0; g < 32; g++) {
    const ga = rand() * 360;
    const gr = (330 + rand() * 1150) * k;
    const gp = seatPoint(gr, ga);
    B.oval(gp.x, gp.y, (10 + rand() * 12) * k, 2.6 * k, C.glint, 0.85, 0);
    B.flats[B.flats.length - 1].anim = `arTwinkle ${r1(2 + rand() * 3)}s ease-in-out ${r1(-rand() * 5)}s infinite`;
  }

  /* โขดหินเล็กโผล่น้ำรอบวง (ใกล้ขอบจอซ้าย/ขวา) */
  const rockSide = `linear-gradient(90deg, ${C.rock[0]} 0%, ${C.rock[1]} 40%, ${C.rock[0]} 100%)`;
  const rockTop = `radial-gradient(circle at 38% 34%, ${C.rock[2]} 0%, ${C.rock[1]} 70%)`;
  [[168, 410, 26], [192, 450, 34], [206, 392, 18], [334, 400, 22], [350, 452, 32], [12, 420, 24], [228, 470, 20], [312, 468, 20]].forEach(([d, rr, sz]) => {
    const p = seatPoint(rr * k, d);
    B.disc(p.x, p.y, sz * 1.7 * k, "transparent", `${px(3)} solid ${C.foam}`, 0.9, `arRipple ${r1(3 + rand() * 1.5)}s ease-out ${r1(-rand() * 3)}s infinite`);
    B.cyl(p.x, p.y, sz * k, 4, rockSide, rockTop, `${px(2)} solid ${C.rock[2]}`);
  });

  /* กลางสนาม: ฟองปั่นรอบโคนเสา → หินเปียก → เสาหิน (มอส+ปะการัง) → ลำน้ำวน */
  B.disc(0, 0, 175 * k, `radial-gradient(circle, ${C.foam} 0%, rgba(255,255,255,0) 70%)`, null, night ? 0.35 : 0.45, "arPulse 3s ease-in-out infinite");
  for (let r = 0; r < 2; r++) B.disc(0, 0, 200 * k, "transparent", `${px(5)} solid ${C.foam}`, 1, `arRipple 3s ease-out ${r1(-r * 1.5)}s infinite`);
  B.disc(0, 0, 146 * k, "transparent", `${px(12)} dotted ${C.foam}`, 0.85, "arSpin 9s linear infinite");
  const wetSide = `linear-gradient(90deg, ${C.wet[0]} 0%, ${C.wet[1]} 42%, ${C.wet[0]} 100%)`;
  const L1 = B.cyl(0, 0, 132 * k, H.center[0], wetSide, C.wet[1], `${px(4)} solid ${C.moss}`);
  const pillarSide = `linear-gradient(90deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.55) 100%), repeating-linear-gradient(90deg, ${C.rock[1]} 0 ${px(14)}, ${C.rock[2]} ${px(14)} ${px(20)}, ${C.rock[0]} ${px(20)} ${px(26)})`;
  const L2 = B.cyl(0, L1, 120 * k, H.center[1], pillarSide,
    `radial-gradient(circle, ${C.rock[0]} 0 ${px(2.5)}, transparent ${px(3.5)}) 0 0 / ${px(23)} ${px(19)}, radial-gradient(circle at 30% 70%, ${C.moss} 0 16%, transparent 34%), radial-gradient(circle at 72% 28%, ${C.moss} 0 12%, transparent 28%), radial-gradient(circle at 42% 38%, ${C.rockTop} 0%, ${C.rock[1]} 80%)`,
    `${px(8)} solid ${C.moss}`);
  /* ปะการังรอบขอบบนเสา */
  for (let c = 0; c < 12; c++) {
    const ca = (c / 12) * Math.PI * 2 + 0.2;
    const cr = (98 + (c % 2) * 8) * k;
    B.disc(Math.cos(ca) * cr, L2 + Math.sin(ca) * cr, (6 + (c % 3) * 2) * k, `radial-gradient(circle, #ffffff 0 18%, ${C.coral[c % 4]} 26%, ${C.coral[c % 4]} 60%, rgba(0,0,0,0) 72%)`, null, 0.95);
  }
  const spoutSide = `linear-gradient(90deg, ${C.water[0]} 0%, ${C.water[1]} 46%, ${C.water[0]} 100%)`;
  const spoutTop = `${swirlSvg([{ n: 4, a: 1.3, ra: 80, rb: 1000, col: "#ffffff", op: 0.75, w: 60 }])} center / 100% 100% no-repeat, radial-gradient(circle, ${C.water[1]} 0%, ${C.water[0]} 100%)`;
  const L3 = B.cyl(0, L2, 76 * k, H.center[2], spoutSide, spoutTop, `${px(5)} solid ${C.foam}`, "arSpin 7s linear infinite");
  B.disc(0, L3, 70 * k, "transparent", `${px(3)} solid ${C.foam}`, 1, "arRipple 2.4s ease-out infinite");

  B.fore = (W, Hh, S) => {
    const rk = night ? "#03080c" : "#14212a";
    [[0.02, 1.0, 420, 0], [0.99, 1.02, 460, 1]].forEach((b, i) => {
      B.foreAdd("W4Rock", W * b[0], Hh * b[1], b[2] * S * 1.4, b[2] * S, { col: rk, col2: night ? "#1b6f7a" : "#4f7a80", blur: 9 * S, op: 0.95, rot: i ? 180 : 0, anim: "none" });
    });
  };

  return {
    ringLift: 0,
    centerLift: L3,
    seatPad: (p, st, rr) => {
      B.disc(p.x, p.y, rr * 2.1, `radial-gradient(circle, ${st.col} 0%, transparent 70%)`, null, night ? 0.8 : 0.5);
      B.disc(p.x, p.y, rr * 1.9, "transparent", `${px(3)} solid ${C.foam}`, 1, `arRipple 3.4s ease-out ${r1(-(st.phi % 7) * 0.45)}s infinite`);
      B.disc(p.x, p.y, rr * 1.18, "transparent", `${px(5)} dotted ${C.foam}`, 0.8, "ar4Lap 2.6s ease-in-out infinite");
      return B.cyl(p.x, p.y, rr * 1.05, H.pad, rockSide,
        `radial-gradient(circle at 28% 66%, ${C.moss} 0 14%, transparent 30%), radial-gradient(circle at 72% 30%, ${C.moss} 0 9%, transparent 22%), radial-gradient(circle at 40% 35%, ${C.rockTop} 0%, ${C.rock[1]} 85%)`,
        `${px(4)} solid ${st.col}`) - p.y;
    },
    after: () => {
      const tr = rand32(41);
      B.stand("W4Horizon", 0, -1660 * k, 3400, 420, { c1: C.hz[0], c2: C.hz[1], c3: C.hz[2], col: C.glint, night }, false);
      B.stand("W4Arch", -330 * k, -1380 * k, 900, 520, { c1: C.stack[0], c2: C.stack[1], c3: C.stack[2], col: C.moss, d1: C.foamStand });
      /* เกาะหินโด่ง */
      const stacks = [[214, 980, 1.25], [226, 1320, 1.5], [238, 760, 1.0], [246, 1500, 1.35], [256, 1080, 0.85], [291, 1220, 1.1], [300, 1500, 1.6], [306, 860, 0.95], [318, 1040, 1.35], [330, 1380, 1.2], [342, 820, 1.05], [204, 1450, 1.4], [352, 1250, 1.3], [282, 1580, 1.0]];
      stacks.forEach(([d, rr, sc], i) => {
        const p = seatPoint(rr * k, d + (tr() - 0.5) * 4);
        B.disc(p.x, p.y, 70 * sc * k, "transparent", `${px(4)} solid ${C.foam}`, 0.8, `arRipple ${r1(3.5 + tr() * 2)}s ease-out ${r1(-tr() * 4)}s infinite`);
        B.stand("W4Stack", p.x, p.y, 200 * sc, 400 * sc, { v: i % 3, c1: C.stack[0], c2: C.stack[1], c3: C.stack[2], col: C.moss, d1: C.foamStand });
      });
      /* ซากเรือถูกดูดเข้าวังวน · งูทะเลยักษ์โผล่ไกล ๆ */
      const wp = seatPoint(900 * k, 236);
      B.stand("W4Wreck", wp.x, wp.y, 300, 260, { c1: night ? "#1a1612" : "#4a3524", c2: night ? "#2a221a" : "#6b4c32", col: C.sail, d1: C.foamStand, anim: "ar4Bob 6s ease-in-out infinite" });
      const sp = seatPoint(1120 * k, 316);
      B.stand("W4Serpent", sp.x, sp.y, 500, 280, { c1: C.serp[0], c2: C.serp[1], col: C.eye2, d1: C.foamStand, night });
      /* หินปะการังรอบวงที่นั่ง + บนเสากลาง */
      [[172, 392, 1], [198, 420, 1.2], [216, 380, 0.9], [326, 384, 1], [344, 418, 1.15], [8, 396, 1]].forEach(([d, rr, sc], i) => {
        const p = seatPoint(rr * k, d);
        B.stand("W4Reef", p.x, p.y, 70 * sc, 56 * sc, { v: i % 2, c1: C.rock[1], c2: C.rock[2], d1: C.coral[i % 4], d2: C.coral[(i + 1) % 4], col: C.moss });
      });
      [[160, 104], [20, 104], [205, 108], [335, 108]].forEach(([d, rr], i) => {
        const a = (d * Math.PI) / 180;
        B.stand("W4Coral", Math.cos(a) * rr * k, L2 + Math.sin(a) * rr * k, 30, 38, { d1: C.coral[i % 4], d2: C.coral[(i + 2) % 4], night }, false);
      });

      /* เอฟเฟกต์ */
      const f = rand32(97);
      const { W, H: Hh } = B.c;
      const S = B.S;
      const cp = proj(B.c, 0, L3);
      if (!night) {
        B.fxAdd("Glow", W * 0.2, Hh * 0.04, W * 0.7, Hh * 0.7, { col: "rgba(255, 248, 225, 0.55)", anim: "arPulse 9s ease-in-out infinite" });
        [[0.3, 0.06, 0.5], [0.7, 0.12, 0.42], [0.92, 0.03, 0.36]].forEach((c, i) => {
          B.fxAdd("Fog", W * c[0], Hh * c[1] - Hh * 0.02, W * c[2], Hh * 0.08, { col: "rgba(255,255,255,0.6)", anim: `arDrift ${30 + i * 8}s ease-in-out ${-i * 9}s infinite` });
        });
        [[0.36, 0.12, "A"], [0.58, 0.18, "B"], [0.24, 0.24, "B"], [0.74, 0.1, "A"], [0.48, 0.28, "A"], [0.86, 0.22, "B"]].forEach((g, i) => {
          B.fxAdd("W4Gull", W * g[0], Hh * g[1], 36 * S, 18 * S, { col: "#f6f9fb", col2: "#3a4a52", anim: `arOrbit${g[2]} ${14 + i * 3}s linear ${-i * 3}s infinite`, inner: `arFlapY ${r1(0.6 + f() * 0.3)}s ease-in-out infinite` });
        });
      } else {
        B.fxAdd("Glow", W * 0.8, Hh * 0.06, W * 0.55, Hh * 0.6, { col: "rgba(170, 220, 255, 0.4)", anim: "arPulse 10s ease-in-out infinite" });
        B.fxAdd("W4Moon", W * 0.8, Hh * 0.075, 70 * S, 70 * S, { col: "#eef6ff", col2: "rgba(170,225,255,0.55)" });
        B.fxAdd("W4Glitter", W * 0.8, Hh * 0.235, 90 * S, Hh * 0.15, { col: "rgba(200,240,255,0.8)", anim: "arPulse 4s ease-in-out infinite" });
        for (let s = 0; s < 30; s++) {
          const z = (3 + f() * 4) * S;
          B.fxAdd("Spark", f() * W, f() * Hh * 0.15, z, z, { col: "#e6f4ff", anim: `arTwinkle ${r1(2 + f() * 4)}s ease-in-out ${r1(-f() * 6)}s infinite` });
        }
        for (let m = 0; m < 12; m++) {
          const a = f() * Math.PI * 2;
          const rr = (200 + f() * 420) * k;
          const mp = proj(B.c, Math.cos(a) * rr, Math.sin(a) * rr * 0.8 - 80 * k);
          const z = (10 + f() * 10) * S;
          B.fxAdd("Wisp", mp.x, mp.y - f() * 60 * S, z, z, { col: "#4fe8ff", op: 0.75, anim: `arFloat ${r1(5 + f() * 5)}s ease-in-out ${r1(-f() * 8)}s infinite` });
        }
      }
      /* ละอองน้ำพุ่งรอบเสากลาง + ฟองอากาศลอยขึ้น */
      for (let d = 0; d < 10; d++) {
        const dz = (6 + f() * 6) * S;
        B.fxAdd("W4Drop", cp.x + (f() - 0.5) * 150 * S, cp.y + (10 + f() * 50) * S, dz, dz * 1.3, { col: night ? "#9ff6ff" : "#ffffff", anim: `${d % 2 ? "ar4DropL" : "ar4DropR"} ${r1(1.6 + f() * 1.2)}s ease-out ${r1(-f() * 3)}s infinite` });
      }
      for (let b = 0; b < 10; b++) {
        const a = f() * Math.PI * 2;
        const rr = (150 + f() * 260) * k;
        const bp = proj(B.c, Math.cos(a) * rr, Math.sin(a) * rr);
        const bz = (8 + f() * 10) * S;
        B.fxAdd("W4Bubble", bp.x, bp.y, bz, bz, { col: night ? "rgba(120,240,255,0.9)" : "rgba(255,255,255,0.9)", anim: `ar4Rise ${r1(3 + f() * 3)}s ease-in ${r1(-f() * 6)}s infinite` });
      }
      /* หมอกละอองต่ำเหนือน้ำ + ประกายบนน้ำ */
      for (let m = 0; m < 5; m++) {
        B.fxAdd("Fog", W * (0.1 + f() * 0.8), Hh * (0.3 + m * 0.07), W * (0.5 + f() * 0.3), Hh * 0.14, { col: night ? "rgba(90, 200, 230, 0.2)" : "rgba(240, 252, 255, 0.5)", anim: `arDrift ${r1(16 + f() * 14)}s ease-in-out ${r1(-f() * 20)}s infinite` });
      }
      for (let s = 0; s < 12; s++) {
        const sz = (6 + f() * 8) * S;
        B.fxAdd("Spark", f() * W, Hh * (0.3 + f() * 0.45), sz, sz, { col: night ? "#7ff3ff" : "#ffffff", anim: `arTwinkle ${r1(1.6 + f() * 2.4)}s ease-in-out ${r1(-f() * 4)}s infinite` });
      }
      B.fxAdd("Vignette", W / 2, Hh / 2, W, Hh, { col: night ? "rgba(0,6,14,0.78)" : "rgba(6,40,60,0.38)" });
    },
  };
}

export default { H, build };
