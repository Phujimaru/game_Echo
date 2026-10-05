// ============================================================
//  สนาม 8 — Moon Cell (SE.RA.PH วันที่ 7 · ไม่ใช่ภูมิภาคของการเดินทาง)
//  สนาม = ลานข้อมูลสีขาวอมฟ้าแบบ ORDEAL CALL · ตารางสำรวจบนพื้น · วงแหวนเส้นประหมุน
//  กลางสนาม = แท่นหกเหลี่ยมสองชั้น + โฮโลแกรมลูกโลก · วงที่นั่ง = แท่นกลมขอบฟ้า
//  รอบนอก = เสาคริสตัลข้อมูล · จอโฮโลแกรมลอย · เส้นขอบฟ้าเป็นเมืองข้อมูล · หกเหลี่ยมลอยขึ้น
//  กลางคืน = ลานน้ำเงินเข้ม เส้นตารางเรืองแสง
// ============================================================

import { r1, rand32, seatPoint, nearSector } from "../arenaKit";

const H = { ring: [], pad: 14, center: [16, 22] };

function build(B) {
  const { k, px, night } = B;
  const rand = rand32(808);
  const C = night ? {
    sky: "linear-gradient(180deg, #040c20 0%, #0b2046 42%, #1c4577 78%, #2d5d93 100%)",
    floor: ["#2a4f82", "#1b3a66", "#0f2445"], grid: "rgba(127,184,230,0.30)", grid2: "rgba(127,184,230,0.12)",
    side: "#24497a", side2: "#16325a", top: "#dbe9f7", rim: "#7fb8e6", accent: "#c99ad6", glow: "rgba(127,184,230,0.5)",
    shadow: "rgba(0, 8, 26, 0.5)", pylon: ["#bee3f8", "#7fb8e6", "#ffffff"], city: ["#1a3b6a", "#2b5a92"], haze: ["rgba(4,12,32,0.82)", "rgba(20,50,100,0.3)"],
  } : {
    sky: "linear-gradient(180deg, #ffffff 0%, #eef5fc 40%, #d4e6f6 82%, #c2dbf1 100%)",
    floor: ["#ffffff", "#eaf2fa", "#cfe0f1"], grid: "rgba(61,139,217,0.22)", grid2: "rgba(61,139,217,0.08)",
    side: "#e2ecf7", side2: "#c3d6ea", top: "#ffffff", rim: "#3d8bd9", accent: "#9b4f96", glow: "rgba(190,227,248,0.75)",
    shadow: "rgba(28, 63, 110, 0.2)", pylon: ["#7fb8e6", "#3d8bd9", "#ffffff"], city: ["#d2e3f3", "#b9d2ea"], haze: null,
  };
  B.sky = C.sky;
  B.shadow = C.shadow;
  if (night) {
    B.hazeDark = true;
    B.hazeGrad = `linear-gradient(180deg, ${C.haze[0]} 0%, ${C.haze[1]} 22%, rgba(0,0,0,0) 46%)`;
  } else {
    B.hazeCol = "rgba(240, 247, 253, 0.85)";
  }

  /* พื้น: ตารางสำรวจ 2 ชั้น (ละเอียด/หยาบ) บนลานไล่สีจากกลาง */
  B.ground = `repeating-linear-gradient(0deg, ${C.grid} 0 ${px(2)}, transparent ${px(2)} ${px(120)}), `
    + `repeating-linear-gradient(90deg, ${C.grid} 0 ${px(2)}, transparent ${px(2)} ${px(120)}), `
    + `repeating-linear-gradient(0deg, ${C.grid2} 0 ${px(1)}, transparent ${px(1)} ${px(30)}), `
    + `repeating-linear-gradient(90deg, ${C.grid2} 0 ${px(1)}, transparent ${px(1)} ${px(30)}), `
    + `radial-gradient(circle at 50% 50%, ${C.floor[0]} 0, ${C.floor[1]} ${px(800)}, ${C.floor[2]} ${px(1700)})`;

  /* แผ่นหกเหลี่ยมนูนกระจายบนพื้น (ไกลจากวงที่นั่ง) */
  for (let i = 0; i < 26; i++) {
    const a = rand() * 360, rr = (430 + rand() * 900) * k, p = seatPoint(rr, a);
    const s = (40 + rand() * 60) * k;
    B.rect(p.x, p.y, s, s * 1.15, night ? "rgba(127,184,230,0.14)" : "rgba(61,139,217,0.07)", `${px(2)} solid ${night ? "rgba(127,184,230,0.3)" : "rgba(61,139,217,0.18)"}`, 30, 1, "30%");
  }

  /* วงแหวนรอบสนาม: เส้นประหมุนสวนกัน + วงแสงหายใจ */
  B.disc(0, 0, 360 * k, "transparent", `${px(3)} dashed ${C.rim}`, 0.55, "arSpin 90s linear infinite");
  B.disc(0, 0, 400 * k, "transparent", `${px(2)} dashed ${C.accent}`, 0.45, "arSpin 140s linear infinite reverse");
  B.disc(0, 0, 250 * k, `radial-gradient(circle, ${C.glow} 0%, transparent 70%)`, null, 1, "arPulse 4s ease-in-out infinite");
  for (let r = 0; r < 2; r++) B.disc(0, 0, 230 * k, "transparent", `${px(3)} solid ${C.rim}`, 1, `arRipple 4s ease-out ${r1(-r * 2)}s infinite`);

  /* เส้นข้อมูลวิ่งจากกลางออกไปขอบ (8 ทิศ) */
  for (let i = 0; i < 8; i++) {
    const deg = i * 45 + 22.5, a = (deg * Math.PI) / 180, L = 900 * k;
    B.rect(Math.cos(a) * (L / 2 + 160 * k), Math.sin(a) * (L / 2 + 160 * k), L, 4 * k,
      `repeating-linear-gradient(90deg, ${C.rim} 0 ${px(24)}, transparent ${px(24)} ${px(48)})`, null, deg, 0.35);
  }

  /* แท่นกลาง 2 ชั้น */
  const side = `linear-gradient(90deg, rgba(0,0,0,0.12) 0%, rgba(255,255,255,0) 40%, rgba(0,0,0,0.18) 100%), linear-gradient(180deg, ${C.side} 0 70%, ${C.rim} 70% 78%, ${C.side2} 78%)`;
  const Lc = B.cyl(0, 0, 160 * k, H.center[0], side,
    `radial-gradient(circle, ${C.top} 0 62%, ${night ? "#cfe0f1" : "#eaf2fa"} 63%)`, `${px(6)} solid ${C.rim}`);
  B.disc(0, Lc, 128 * k, "transparent", `${px(2)} dashed ${C.rim}`, 0.7, "arSpin 40s linear infinite");
  const La = B.cyl(0, Lc, 72 * k, H.center[1], side,
    `radial-gradient(circle, ${C.top} 0 45%, ${C.accent} 46% 52%, ${C.top} 53%)`, `${px(5)} solid ${C.accent}`);
  B.disc(0, La, 110 * k, `radial-gradient(circle, ${night ? "rgba(201,154,214,0.45)" : "rgba(201,154,214,0.35)"} 0%, transparent 70%)`, null, 1, "arPulse 3s ease-in-out infinite");

  B.fore = (W, Hh, S) => {
    // เสาหน้ากล้องขาวโปร่ง (ชั้นเบลอบังหน้า)
    [[0.03, 0.62, 140, 1100], [0.985, 0.6, 160, 1100]].forEach((b) => {
      B.foreAdd("McForePillar", W * b[0], Hh * b[1], b[2] * S, b[3] * S, { col: night ? "#1f3f6c" : "#ffffff", col2: C.rim, blur: 6 * S, op: night ? 0.85 : 0.9 });
    });
  };

  return {
    ringLift: 0,
    centerLift: La,
    seatPad: (p, st, rr) => {
      const big = rr > 50 * k;
      B.disc(p.x, p.y, rr * 2.1, `radial-gradient(circle, ${st.col} 0%, transparent 70%)`, null, night ? 0.6 : 0.42);
      B.disc(p.x, p.y, rr * 1.5, "transparent", `${px(big ? 4 : 3)} dashed ${C.rim}`, 0.85, "arSpin 26s linear infinite");
      const padSide = `linear-gradient(90deg, rgba(0,0,0,0.14) 0%, rgba(255,255,255,0) 40%, rgba(0,0,0,0.2) 100%), linear-gradient(180deg, ${C.side} 0 60%, ${st.col} 60% 72%, ${C.side2} 72%)`;
      return B.cyl(p.x, p.y, rr, H.pad, padSide,
        `radial-gradient(circle at 40% 35%, rgba(255,255,255,0.75) 0%, rgba(255,255,255,0) 50%), radial-gradient(circle, ${C.top} 0 55%, ${st.col} 56%)`,
        `${px(big ? 6 : 4)} solid ${C.rim}`) - p.y;
    },
    after: () => {
      /* เส้นขอบฟ้า: เมืองข้อมูล */
      B.stand("McCity", 0, -1660 * k, 3400, 420, { c1: C.city[0], c2: C.city[1], col: C.rim, c3: C.accent }, false);
      /* เสาคริสตัลข้อมูลรอบนอก (เว้นด้านที่นั่ง) */
      const t = rand32(81);
      for (let i = 0; i < 14; i++) {
        const d = 180 + i * (180 / 13) + (t() - 0.5) * 6;
        if (nearSector(d) && i % 3) continue;
        const rr = (560 + (i % 3) * 120) * k, p = seatPoint(rr, d);
        const z = 0.8 + t() * 0.5;
        B.stand("McPylon", p.x, p.y, 46 * z, 150 * z, { c1: C.pylon[0], c2: C.pylon[1], c3: C.pylon[2], col: C.accent, anim: `ar8Hover ${r1(4 + t() * 3)}s ease-in-out ${r1(-t() * 4)}s infinite` });
      }
      for (const d of [20, 160, 60, 120]) {
        const p = seatPoint(640 * k, d);
        B.stand("McPylon", p.x, p.y, 56, 170, { c1: C.pylon[0], c2: C.pylon[1], c3: C.pylon[2], col: C.accent, anim: "ar8Hover 5s ease-in-out infinite" });
      }
      /* จอโฮโลแกรมลอยด้านหลัง */
      [[228, 760], [312, 760]].forEach(([d, rr], i) => {
        const p = seatPoint(rr * k, d);
        B.stand("McPanel", p.x, p.y, 220, 150, { c1: night ? "rgba(18,38,72,0.92)" : "rgba(18,38,72,0.88)", col: C.rim, c2: C.accent, anim: `ar8Hover ${6 + i}s ease-in-out ${-i * 2}s infinite` }, false);
      });
      /* โฮโลแกรมลูกโลกเหนือแท่นกลาง (หลังกองไพ่) */
      B.stand("McGlobe", 0, La - 40 * k, 120, 130, { col: C.rim, c2: C.accent, anim: "ar8Hover 4s ease-in-out infinite" }, false);

      /* เอฟเฟกต์บนจอ */
      const f = rand32(88);
      const { W, H: Hh } = B.c;
      const S = B.S;
      B.fxAdd("Glow", W * 0.5, Hh * 0.18, W * 1.2, Hh * 0.3, { col: night ? "rgba(127,184,230,0.35)" : "rgba(255,255,255,0.8)", anim: "arPulse 6s ease-in-out infinite" });
      for (let i = 0; i < 26; i++) {
        const z = (8 + f() * 14) * S, dur = 9 + f() * 9;
        B.fxAdd("McHex", f() * W, Hh + 20 * S, z, z * 1.15, { col: i % 4 ? C.rim : C.accent, op: 0.75, anim: `${i % 2 ? "ar8RiseA" : "ar8RiseB"} ${r1(dur)}s linear ${r1(-f() * dur)}s infinite` });
      }
      for (let i = 0; i < 3; i++) {
        B.fxAdd("Fog", W * (0.15 + i * 0.35), Hh * 0.12, W * 0.6, Hh * 0.18, { col: night ? "rgba(4,12,32,0.5)" : "rgba(255,255,255,0.7)", anim: `arDrift ${r1(22 + i * 6)}s ease-in-out ${-i * 7}s infinite` });
      }
      B.fxAdd("Vignette", W / 2, Hh / 2, W, Hh, { col: night ? "rgba(2, 8, 24, 0.75)" : "rgba(160, 190, 222, 0.45)" });
    },
  };
}

export default { H, build };
