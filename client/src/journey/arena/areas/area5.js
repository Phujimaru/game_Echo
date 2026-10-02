// ============================================================
//  ภูมิภาค V — ทะเลทรายไม่อาจหวนคืน
//  สนาม = ลานนาฬิกาแดดหินทรายโบราณจมทราย · วงที่นั่ง = ตอเสาหักบนฐานสี่เหลี่ยม
//  กลางสนาม = แท่นหน้าปัดนาฬิกาแดด + เสาโอเบลิสก์ (เงาทอดบนหน้าปัด)
//  รอบนอก = เนินทราย ซากวิหาร แนวเสาหัก โครงกระดูกยักษ์ เศียรรูปปั้นล้ม พุ่มไม้ตาย · แร้งบินวน ทรายปลิว ไอแดด
//  กลางคืน = ทะเลทรายสีฟ้าเย็น ดาวเต็มฟ้า อักษรโบราณเรืองแสงวังเวง
// ============================================================

import { r1, rand32, proj, seatPoint } from "../arenaKit";

const H = { ring: [8], pad: 18, center: [8, 12, 10] };

function build(B) {
  const { k, px, night } = B;
  const rand = rand32(505);
  const C = night ? {
    sky: "linear-gradient(180deg, #02040f 0%, #08102c 38%, #18224c 76%, #2a335e 100%)",
    sand: "#3a4472", sand2: "#47528a", sand3: "#2b3360", ripple: "rgba(8, 12, 40, 0.32)", rippleHi: "rgba(150, 170, 255, 0.08)",
    stone: ["#5d6694", "#4c5480", "#3b426a", "#272d4c"], seam: "rgba(6, 8, 28, 0.4)", carve: "rgba(4, 6, 24, 0.6)",
    rune: "#7fd8ff", runeOp: 0.95, gold: "#9fb4e8", face: ["#6a73a2", "#4d5582"], shadow: "rgba(0, 4, 22, 0.5)", gnomonShadow: "rgba(2, 4, 20, 0.35)",
    dune: ["#2b3463", "#222a52", "#1a2044"], crest: "#8d9be0", ruin: ["#353d68", "#272e52", "#4a5486"], bone: ["#a8b0d4", "#7a83ad"],
    shrub: "#1a1d33", leaf: "#4a4f75", haze: ["rgba(2,4,16,0.78)", "rgba(20,28,70,0.32)"],
  } : {
    sky: "linear-gradient(180deg, #a9461f 0%, #d27a3c 28%, #eeaa60 58%, #f7d49a 100%)",
    sand: "#e0954e", sand2: "#eeb46f", sand3: "#c4793a", ripple: "rgba(140, 78, 30, 0.2)", rippleHi: "rgba(255, 240, 200, 0.22)",
    stone: ["#f4e2bd", "#e0c393", "#bf9864", "#8a6236"], seam: "rgba(110, 66, 26, 0.26)", carve: "rgba(96, 54, 20, 0.55)",
    rune: "#ffe08a", runeOp: 0.55, gold: "#ffd36a", face: ["#f2d29c", "#d9b075"], shadow: "rgba(120, 60, 18, 0.3)", gnomonShadow: "rgba(96, 48, 14, 0.4)",
    dune: ["#f0bb78", "#e09c55", "#c97f3c"], crest: "#ffe7b8", ruin: ["#c79358", "#a8743c", "#e6bd84"], bone: ["#fbf1dc", "#d9c7a3"],
    shrub: "#5a3a1c", leaf: "#8a6a3a", haze: null,
  };
  B.sky = C.sky;
  B.shadow = C.shadow;
  if (night) {
    B.hazeDark = true;
    B.hazeGrad = `linear-gradient(180deg, ${C.haze[0]} 0%, ${C.haze[1]} 22%, rgba(0,0,0,0) 46%)`;
  } else {
    B.hazeCol = "rgba(255, 222, 170, 0.5)";
  }

  /* ผืนทราย: ระลอกลมโค้ง 2 ชุด + ไล่สีจากลานออกไป */
  B.ground = `repeating-radial-gradient(ellipse at 18% -40%, rgba(0,0,0,0) 0 ${px(30)}, ${C.ripple} ${px(30)} ${px(35)}, ${C.rippleHi} ${px(35)} ${px(38)}, rgba(0,0,0,0) ${px(38)} ${px(52)}), `
    + `repeating-radial-gradient(ellipse at 90% 140%, rgba(0,0,0,0) 0 ${px(40)}, ${C.ripple} ${px(40)} ${px(45)}, rgba(0,0,0,0) ${px(45)} ${px(64)}), `
    + `radial-gradient(circle at 50% 50%, ${C.sand2} 0, ${C.sand} ${px(700)}, ${C.sand3} ${px(1700)})`;

  /* เนินทรายนุ่ม (สว่าง/เงา) */
  for (let d = 0; d < 22; d++) {
    const a = rand() * 360;
    const rr = (560 + rand() * 1050) * k;
    const p = seatPoint(rr, a);
    const big = (120 + rand() * 180) * k;
    B.oval(p.x, p.y, big, big * 0.45, `radial-gradient(closest-side, ${d % 2 ? C.sand2 : C.sand3}, rgba(0,0,0,0))`, 0.7, a + 90);
  }
  /* กลองเสาล้มนอนจมทราย (เห็นชัดตอนมองตรงลง) */
  const drumBg = `linear-gradient(180deg, ${C.stone[3]} 0%, ${C.stone[1]} 30%, ${C.stone[0]} 50%, ${C.stone[2]} 100%)`;
  [[200, 560, 30], [226, 640, 70], [328, 600, -20], [345, 700, 50], [252, 760, 10], [160, 620, 80]].forEach(([d, rr, rot]) => {
    const p = seatPoint(rr * k, d);
    B.rect(p.x, p.y, 120 * k, 40 * k, drumBg, `${px(2)} solid ${C.stone[3]}`, d + rot, 0.95, px(10));
    B.rect(p.x + 70 * k * Math.cos(((d + rot) * Math.PI) / 180), p.y + 70 * k * Math.sin(((d + rot) * Math.PI) / 180), 40 * k, 38 * k, drumBg, `${px(2)} solid ${C.stone[3]}`, d + rot + 8, 0.9, px(8));
  });

  /* ลานหินทราย (ยก 8) — แผ่นหินแบ่งช่องวงกลม + รอยแตก + ทรายกลบขอบ */
  const sideS = `linear-gradient(90deg, ${C.stone[3]} 0%, ${C.stone[1]} 42%, ${C.stone[3]} 100%)`;
  const L = B.cyl(0, 0, 450 * k, H.ring[0], sideS,
    `repeating-radial-gradient(circle, rgba(0,0,0,0) 0 ${px(68)}, ${C.seam} ${px(68)} ${px(71)}), repeating-conic-gradient(from 7deg, rgba(0,0,0,0) 0 14deg, ${C.seam} 14deg 15deg), radial-gradient(circle, ${C.stone[0]} 0%, ${C.stone[1]} 100%)`,
    `${px(10)} solid ${C.stone[2]}`);
  for (let c = 0; c < 12; c++) {
    const ca = rand() * Math.PI * 2;
    const cr = (120 + rand() * 300) * k;
    B.rect(Math.cos(ca) * cr, L + Math.sin(ca) * cr, (30 + rand() * 50) * k, 2.4 * k, C.carve, null, rand() * 180, 0.8);
  }
  /* หน้าปัดชั่วโมงบนลาน: วงนอก + ขีดชั่วโมง + อักษรโบราณ */
  B.disc(0, L, 262 * k, "transparent", `${px(5)} solid ${C.carve}`);
  B.disc(0, L, 248 * k, "transparent", `${px(2)} solid ${C.gold}`, 0.6);
  B.disc(0, L, 196 * k, "transparent", `${px(3)} dashed ${C.carve}`, 0.8);
  for (let h = 0; h < 12; h++) {
    const a = (h / 12) * 360;
    const p = seatPoint(226 * k, a);
    B.rect(p.x, L + p.y, (h % 3 === 0 ? 48 : 30) * k, (h % 3 === 0 ? 7 : 4) * k, C.carve, null, a, 0.9);
    const q = seatPoint(176 * k, a + 15);
    B.rect(q.x, L + q.y, 16 * k, 16 * k, "transparent", `${px(2.5)} solid ${C.rune}`, a + 60, C.runeOp, px(3));
    if (night) B.flats[B.flats.length - 1].anim = `arPulse ${r1(3 + (h % 4) * 0.7)}s ease-in-out ${r1(-h * 0.6)}s infinite`;
  }
  /* เงาเสาโอเบลิสก์ทอดบนหน้าปัด (กลางวัน = เงาแดด · กลางคืน = เงาจันทร์จาง ๆ) */
  const sh = seatPoint(170 * k, night ? 300 : 220);
  B.rect(sh.x, L + sh.y, 340 * k, 26 * k, `linear-gradient(90deg, ${C.gnomonShadow}, rgba(0,0,0,0))`, null, night ? 300 + 180 : 220 + 180, 1, px(13));
  /* ทรายกลบขอบลาน (ครึ่งจมทราย) */
  for (let s = 0; s < 9; s++) {
    const a = 150 + s * 28 + rand() * 12;
    const p = seatPoint((430 + rand() * 30) * k, a);
    const w = (110 + rand() * 90) * k;
    B.oval(p.x, L * 0.5 + p.y, w, w * 0.5, `radial-gradient(closest-side, ${C.sand2} 0%, ${C.sand2} 45%, rgba(0,0,0,0) 100%)`, 0.95, a + 90);
  }

  /* กลางสนาม: ขั้นบันไดหิน → แท่นหน้าปัดสำริด */
  const Ls = B.cyl(0, L, 158 * k, H.center[1], sideS, `radial-gradient(circle, ${C.stone[0]} 0%, ${C.stone[1]} 100%)`, `${px(6)} solid ${C.stone[2]}`);
  B.disc(0, Ls, 138 * k, "transparent", `${px(2)} solid ${C.carve}`, 0.8);
  const dialSide = `linear-gradient(90deg, ${C.stone[3]} 0%, ${C.stone[2]} 45%, ${C.stone[3]} 100%)`;
  const Ld = B.cyl(0, Ls, 104 * k, H.center[2], dialSide,
    `repeating-conic-gradient(from 0deg, rgba(0,0,0,0) 0 14deg, ${C.carve} 14deg 15deg), radial-gradient(circle, ${C.face[0]} 0%, ${C.face[1]} 100%)`,
    `${px(7)} solid ${C.gold}`);
  B.disc(0, Ld, 80 * k, "transparent", `${px(2.5)} dashed ${C.rune}`, C.runeOp, "arSpin 60s linear infinite");
  B.disc(0, Ld, 120 * k, `radial-gradient(circle, ${night ? "rgba(127,216,255,0.35)" : "rgba(255,225,140,0.35)"} 0%, rgba(0,0,0,0) 70%)`, null, 1, "arPulse 5s ease-in-out infinite");

  B.fore = (W, Hh, S) => {
    const rk = night ? "#141a36" : "#7a4a22";
    [[0.02, 1.0, 420, 0], [0.99, 1.02, 440, 1]].forEach((b, i) => {
      B.foreAdd("D5Rock", W * b[0], Hh * b[1], b[2] * S * 1.4, b[2] * S, { col: rk, col2: night ? "#3a4472" : "#c48a4e", blur: 9 * S, op: 0.95, rot: i, anim: "none" });
    });
  };

  return {
    ringLift: L,
    centerLift: Ld,
    seatPad: (p, st, rr) => {
      const y = p.y + L;
      B.disc(p.x, y, rr * 2.2, `radial-gradient(circle, ${st.col} 0%, transparent 70%)`, null, night ? 0.8 : 0.5);
      B.rect(p.x, y, rr * 2.7, rr * 2.7, `linear-gradient(135deg, ${C.stone[0]}, ${C.stone[1]})`, `${px(3)} solid ${C.stone[2]}`, st.phi + 45, 1, px(4));
      const flute = `linear-gradient(90deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0) 38%, rgba(0,0,0,0.5) 100%), repeating-linear-gradient(90deg, ${C.stone[0]} 0 ${px(7)}, ${C.stone[2]} ${px(7)} ${px(10)})`;
      const broken = `radial-gradient(circle at 62% 40%, ${C.stone[1]} 0 18%, rgba(0,0,0,0) 34%), radial-gradient(circle at 30% 64%, ${C.stone[2]} 0 10%, rgba(0,0,0,0) 22%), radial-gradient(circle at 45% 45%, ${C.stone[0]} 0%, ${C.stone[1]} 100%)`;
      return B.cyl(p.x, y, rr * 0.95, H.pad, flute, broken, `${px(4)} solid ${st.col}`) - p.y;
    },
    after: () => {
      const tr = rand32(53);
      B.stand("D5Dunes", 0, -1660 * k, 3400, 420, { c1: C.dune[0], c2: C.dune[1], c3: C.dune[2], col: C.crest, d1: C.ruin[1], night }, false);
      /* แนวเสาหักรอบลาน */
      [176, 198, 222, 246, 294, 318, 342, 4].forEach((d, i) => {
        const p = seatPoint(426 * k, d);
        B.stand("D5Column", p.x, p.y + L, 54, i % 3 === 1 ? 150 : 220, { v: i % 3 === 1 ? 1 : 0, c1: C.stone[0], c2: C.stone[2], c3: C.stone[3], col: C.sand2, d1: C.rune, night });
      });
      /* ซากวิหาร */
      [[214, 980, 1.3, 0], [232, 1350, 1.6, 1], [262, 1180, 1.2, 2], [286, 1450, 1.5, 0], [300, 900, 1.0, 1], [334, 1250, 1.4, 2], [250, 1580, 1.4, 1], [206, 1480, 1.5, 2], [348, 1500, 1.4, 0]].forEach(([d, rr, sc, v]) => {
        const p = seatPoint(rr * k, d + (tr() - 0.5) * 4);
        B.stand("D5Ruin", p.x, p.y, 240 * sc, 300 * sc, { v, c1: C.ruin[0], c2: C.ruin[1], c3: C.ruin[2], col: C.dune[0], d1: C.rune, night });
      });
      /* โครงกระดูกยักษ์ + เศียรรูปปั้นล้ม */
      const rp = seatPoint(820 * k, 238);
      B.stand("D5Ribs", rp.x, rp.y, 640, 340, { c1: C.bone[0], c2: C.bone[1], col: C.sand2 });
      const hp = seatPoint(860 * k, 316);
      B.stand("D5Statue", hp.x, hp.y, 420, 300, { c1: C.ruin[2], c2: C.ruin[0], c3: C.ruin[1], col: C.sand2, d1: C.gold, night });
      /* พุ่มไม้ตาย + กะโหลกสัตว์ */
      for (let s = 0; s < 12; s++) {
        const d = 168 + s * 18 + tr() * 8;
        const p = seatPoint((540 + tr() * 160) * k, d);
        const sc = 0.7 + tr() * 0.5;
        B.stand("Shrub", p.x, p.y, 120 * sc, 78 * sc, { col: C.shrub, c1: C.leaf, anim: s % 3 === 0 ? `arSway ${r1(4 + tr() * 3)}s ease-in-out infinite` : "none" });
      }
      [[188, 600], [214, 700], [330, 620], [356, 560], [276, 640]].forEach(([d, rr], i) => {
        const p = seatPoint(rr * k, d);
        B.stand("D5Skull", p.x, p.y, 66 + (i % 2) * 12, 44 + (i % 2) * 8, { c1: C.bone[0], c2: C.bone[1] });
      });
      /* เสาโอเบลิสก์ (เข็มนาฬิกาแดด) ตั้งที่ขอบหลังของแท่นกลาง */
      B.stand("D5Gnomon", 0, Ld - 96 * k, 56, 200, { c1: C.stone[0], c2: C.stone[2], c3: C.stone[3], col: C.gold, d1: C.rune, night }, false);

      /* เอฟเฟกต์ */
      const f = rand32(59);
      const { W, H: Hh } = B.c;
      const S = B.S;
      if (!night) {
        B.fxAdd("Glow", W * 0.8, Hh * 0.04, W * 0.9, Hh * 0.8, { col: "rgba(255, 236, 190, 0.6)", anim: "arPulse 7s ease-in-out infinite" });
        B.fxAdd("D5Sun", W * 0.8, Hh * 0.075, 90 * S, 90 * S, { col: "#fff6dc", col2: "rgba(255, 220, 150, 0.7)" });
        for (let h = 0; h < 3; h++) {
          B.fxAdd("D5Heat", W * (0.3 + h * 0.2), Hh * (0.2 + h * 0.035), W * 0.7, Hh * 0.05, { col: "rgba(255, 244, 214, 0.45)", anim: `ar5Heat ${r1(2.2 + h * 0.6)}s ease-in-out ${r1(-h * 0.9)}s infinite` });
        }
        [[0.32, 0.1, "A"], [0.5, 0.16, "B"], [0.66, 0.08, "A"], [0.22, 0.2, "B"]].forEach((g, i) => {
          B.fxAdd("D5Vulture", W * g[0], Hh * g[1], 62 * S, 22 * S, { col: "#2a1508", anim: `arOrbit${g[2]} ${18 + i * 4}s linear ${-i * 5}s infinite`, inner: "none" });
        });
        for (let d = 0; d < 16; d++) {
          const z = (3 + f() * 4) * S;
          B.fxAdd("Spark", f() * W, Hh * (0.2 + f() * 0.6), z, z, { col: "#fff1cc", op: 0.7, anim: `arFloat ${r1(4 + f() * 4)}s ease-in-out ${r1(-f() * 6)}s infinite` });
        }
      } else {
        B.fxAdd("Glow", W * 0.22, Hh * 0.06, W * 0.6, Hh * 0.6, { col: "rgba(170, 190, 255, 0.35)", anim: "arPulse 10s ease-in-out infinite" });
        B.fxAdd("D5Moon", W * 0.22, Hh * 0.08, 64 * S, 64 * S, { col: "#e6ecfb", col2: "rgba(180,200,255,0.45)" });
        for (let s = 0; s < 44; s++) {
          const z = (2.5 + f() * 4.5) * S;
          B.fxAdd("Spark", f() * W, f() * Hh * 0.17, z, z, { col: s % 5 ? "#e6edff" : "#bcd6ff", anim: `arTwinkle ${r1(2 + f() * 4)}s ease-in-out ${r1(-f() * 6)}s infinite` });
        }
        for (let w = 0; w < 7; w++) {
          const a = 200 + f() * 140;
          const wp = proj(B.c, Math.cos((a * Math.PI) / 180) * (520 + f() * 500) * k, Math.sin((a * Math.PI) / 180) * (520 + f() * 500) * k);
          const z = (12 + f() * 10) * S;
          B.fxAdd("Wisp", wp.x, wp.y - (30 + f() * 80) * S, z, z, { col: "#7fd8ff", op: 0.7, anim: `arFloat ${r1(6 + f() * 5)}s ease-in-out ${r1(-f() * 8)}s infinite` });
        }
      }
      /* ทรายปลิวเป็นเส้น */
      for (let s = 0; s < (night ? 14 : 22); s++) {
        const w = (90 + f() * 160) * S;
        B.fxAdd("D5Streak", f() * W, Hh * (0.22 + f() * 0.6), w, (2 + f() * 2) * S, {
          col: night ? "rgba(170, 185, 255, 0.45)" : "rgba(255, 236, 196, 0.8)",
          anim: `ar5Blow ${r1(2.4 + f() * 2.6)}s linear ${r1(-f() * 5)}s infinite`,
        });
      }
      for (let m = 0; m < 4; m++) {
        B.fxAdd("Fog", W * (0.1 + f() * 0.8), Hh * (0.34 + m * 0.08), W * (0.6 + f() * 0.3), Hh * 0.12, { col: night ? "rgba(120, 140, 220, 0.18)" : "rgba(255, 220, 160, 0.4)", anim: `arDrift ${r1(14 + f() * 12)}s ease-in-out ${r1(-f() * 20)}s infinite` });
      }
      B.fxAdd("Vignette", W / 2, Hh / 2, W, Hh, { col: night ? "rgba(0,2,14,0.8)" : "rgba(90,36,8,0.42)" });
    },
  };
}

export default { H, build };
