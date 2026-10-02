// ============================================================
//  ภูมิภาค VI — อาณาจักรน้ำแข็ง
//  สนาม = ทะเลสาบน้ำแข็งสลักวงรูนเกล็ดหิมะ · วงที่นั่ง = แท่นคริสตัลน้ำแข็ง · กลางสนาม = น้ำพุเยือกแข็ง + เสาคริสตัลถือกองไพ่
//  รอบนอก = กองหิมะ หนามน้ำแข็ง สนหิมะ รูปปั้นน้ำแข็ง · ขอบฟ้า = เทือกเขาหิมะ + ปราสาทน้ำแข็ง
//  หิมะตกทั้งกลางวัน/กลางคืน · กลางคืน = แสงเหนือ + แสงเย็นจากปราสาท
// ============================================================

import { r1, rand32, proj, seatPoint, nearSector } from "../arenaKit";

const H = { ring: [], pad: 12, center: [16, 30] };

function build(B) {
  const { k, px, night } = B;
  const rand = rand32(606);
  const C = night ? {
    sky: "linear-gradient(180deg, #01040c 0%, #04102a 30%, #0a2442 62%, #15395a 100%)",
    snow: "#8fa8c2", snow2: "#7590ad", snow3: "#5d7896",
    ice: "#3a6f98", ice2: "#2a5a82", ice3: "#1a4166", iceDeep: "#10304f",
    crack: "rgba(170, 236, 255, 0.75)", crack2: "rgba(4, 18, 40, 0.5)", frost: "rgba(170, 236, 255, 0.07)",
    rune: "#7ff0ff", runeGlow: "rgba(90, 230, 255, 0.5)", rune2: "rgba(127, 240, 255, 0.55)",
    pillar: ["#2d5f88", "#8fe6ff", "#4c8cbb", "#1d4469"], basinTop: ["#bff4ff", "#4fa9d8", "#1d4f7c"],
    shadow: "rgba(0, 8, 24, 0.5)", range: ["#1d3654", "#15294a", "#6d8fb4"], pine: ["#183a3c", "#0f2a2e", "#9fb6cc"],
    spike: ["#9ae9ff", "#4f9ccc", "#24557f"], statue: ["rgba(140, 220, 255, 0.4)", "#16304e"], glint: "#b8f6ff",
  } : {
    sky: "linear-gradient(180deg, #4f7ead 0%, #84abcf 34%, #bcd6ea 68%, #e6f1f9 100%)",
    snow: "#f6fafd", snow2: "#e1ecf5", snow3: "#c4d8e8",
    ice: "#c6e8f9", ice2: "#93cdee", ice3: "#64aedd", iceDeep: "#3f8cc4",
    crack: "rgba(255, 255, 255, 0.95)", crack2: "rgba(40, 100, 150, 0.32)", frost: "rgba(255, 255, 255, 0.13)",
    rune: "#2f9ee0", runeGlow: "rgba(110, 200, 255, 0.45)", rune2: "rgba(47, 158, 224, 0.6)",
    pillar: ["#8cc6ea", "#ffffff", "#bfe6fb", "#6aaedc"], basinTop: ["#ffffff", "#bfe7fa", "#7fbde3"],
    shadow: "rgba(40, 90, 140, 0.22)", range: ["#b4cde3", "#9dbbd6", "#f7fbff"], pine: ["#3d6e66", "#2c564f", "#ffffff"],
    spike: ["#ffffff", "#bfe6fb", "#7fbde3"], statue: ["rgba(220, 244, 255, 0.55)", "#6f8fae"], glint: "#ffffff",
  };
  B.sky = C.sky;
  B.shadow = C.shadow;
  B.hazeCol = night ? "rgba(8, 22, 44, 0.7)" : "rgba(226, 238, 248, 0.6)";

  /* พื้น: ทะเลสาบน้ำแข็ง (กลาง) -> ขอบน้ำแข็งลึก -> ทุ่งหิมะ + เกล็ดหิมะระยิบ */
  B.ground = `radial-gradient(circle, rgba(255,255,255,${night ? 0.35 : 0.9}) 0 ${px(1.4)}, transparent ${px(2.2)}) 0 0 / ${px(29)} ${px(31)}, `
    + `radial-gradient(circle at 50% 50%, ${C.ice} 0, ${C.ice2} ${px(430)}, ${C.ice3} ${px(620)}, ${C.iceDeep} ${px(700)}, ${C.snow3} ${px(718)}, ${C.snow2} ${px(760)}, ${C.snow} ${px(900)}, ${C.snow} ${px(1700)})`;

  /* ลายน้ำค้างแข็งแผ่จากกลาง + เงาสะท้อนบนน้ำแข็ง */
  B.disc(0, 0, 700 * k, `repeating-conic-gradient(from 4deg at 50% 50%, ${C.frost} 0deg 1.4deg, transparent 1.4deg 7deg)`);
  B.oval(-160 * k, -120 * k, 360 * k, 120 * k, `radial-gradient(closest-side, rgba(255,255,255,${night ? 0.1 : 0.4}), transparent)`, 1, -24);

  /* รอยร้าวบนน้ำแข็ง: เดินเป็นเส้นหักไปเรื่อย ๆ (เส้นขาว + เงาเข้มใต้รอย) */
  const crack = (x, y, a, n, len, w) => {
    for (let i = 0; i < n; i++) {
      const L = (len * (0.7 + rand() * 0.6)) * k;
      const nx = x + Math.cos(a) * L;
      const ny = y + Math.sin(a) * L;
      const deg = (a * 180) / Math.PI;
      B.rect((x + nx) / 2, (y + ny) / 2 + 1.5 * k, L + 2 * k, (w + 1.5) * k, C.crack2, null, deg, 1);
      B.rect((x + nx) / 2, (y + ny) / 2, L + 2 * k, w * k, C.crack, null, deg, 0.9);
      x = nx;
      y = ny;
      a += (rand() - 0.5) * 1.1;
    }
  };
  for (let c = 0; c < 9; c++) {
    const a0 = (c / 9) * Math.PI * 2 + rand() * 0.5;
    const r0 = (150 + rand() * 60) * k;
    crack(Math.cos(a0) * r0, Math.sin(a0) * r0, a0 + (rand() - 0.5) * 0.6, 3 + (c % 2), 70 + rand() * 30, 2.2);
  }
  for (let c = 0; c < 5; c++) {
    const a0 = rand() * Math.PI * 2;
    const r0 = (420 + rand() * 180) * k;
    crack(Math.cos(a0) * r0, Math.sin(a0) * r0, rand() * Math.PI * 2, 2, 50, 1.6);
  }

  /* วงรูนเกล็ดหิมะสลักในน้ำแข็ง */
  B.disc(0, 0, 268 * k, `radial-gradient(circle, ${C.runeGlow} 0%, transparent 72%)`, null, 1, "arPulse 5s ease-in-out infinite");
  B.disc(0, 0, 258 * k, "transparent", `${px(3)} solid ${C.rune}`, 0.85);
  B.disc(0, 0, 246 * k, "transparent", `${px(2)} dashed ${C.rune2}`, 0.8, "arSpin 80s linear infinite");
  B.disc(0, 0, 176 * k, "transparent", `${px(2)} solid ${C.rune2}`, 0.75);
  for (let arm = 0; arm < 6; arm++) {
    const deg = arm * 60 + 30;
    const a = (deg * Math.PI) / 180;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    // แขนเกล็ดหิมะ (จากขอบอ่างน้ำพุถึงวงนอก)
    B.rect(ca * 194 * k, sa * 194 * k, 116 * k, 3 * k, C.rune, null, deg, 0.85);
    [168, 214].forEach((d, j) => {
      const L = (j ? 26 : 36) * k;
      [-45, 45].forEach((tw) => {
        const b = ((deg + tw) * Math.PI) / 180;
        B.rect(ca * d * k + (Math.cos(b) * L) / 2, sa * d * k + (Math.sin(b) * L) / 2, L, 2.4 * k, C.rune, null, deg + tw, 0.8);
      });
    });
    B.rect(ca * 258 * k, sa * 258 * k, 15 * k, 15 * k, C.rune, null, deg + 45, 0.9);
    const m = ((deg + 30) * Math.PI) / 180;
    B.rect(Math.cos(m) * 258 * k, Math.sin(m) * 258 * k, 9 * k, 9 * k, "transparent", `${px(2)} solid ${C.rune}`, deg + 75, 0.75);
  }

  /* ขอบทะเลสาบ: หิมะทับขอบน้ำแข็งเป็นแนวไม่เรียบ + กองหิมะ */
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2 + rand() * 0.1;
    const rr = (735 + rand() * 40) * k;
    B.disc(Math.cos(a) * rr, Math.sin(a) * rr, (70 + rand() * 50) * k, `radial-gradient(circle, ${C.snow} 0%, ${C.snow} 45%, transparent 70%)`, null, 0.95);
  }
  for (let d = 0; d < 26; d++) {
    const a = rand() * Math.PI * 2;
    const rr = (790 + rand() * 520) * k;
    const deg = (a * 180) / Math.PI + 90;
    B.oval(Math.cos(a) * rr + 10 * k, Math.sin(a) * rr + 14 * k, (110 + rand() * 90) * k, (34 + rand() * 18) * k, `radial-gradient(closest-side, ${C.snow3}, transparent)`, 0.8, deg);
    B.oval(Math.cos(a) * rr, Math.sin(a) * rr, (100 + rand() * 80) * k, (30 + rand() * 14) * k, `radial-gradient(closest-side, #ffffff, ${C.snow} 60%, transparent)`, night ? 0.45 : 0.95, deg);
  }

  /* น้ำพุเยือกแข็ง: อ่างน้ำแข็ง (ผิวน้ำแข็งตัวเป็นระลอกค้าง) + เสาคริสตัลถือกองไพ่ */
  const iceSide = `linear-gradient(90deg, ${C.pillar[3]} 0%, ${C.pillar[2]} 30%, ${C.pillar[1]} 46%, ${C.pillar[2]} 60%, ${C.pillar[0]} 100%)`;
  const Lb = B.cyl(0, 0, 128 * k, H.center[0], iceSide,
    `repeating-radial-gradient(circle at 50% 50%, rgba(255,255,255,0) 0 ${px(13)}, rgba(255,255,255,${night ? 0.25 : 0.6}) ${px(13)} ${px(15)}), radial-gradient(circle at 42% 38%, ${C.basinTop[0]} 0%, ${C.basinTop[1]} 55%, ${C.basinTop[2]} 100%)`,
    `${px(9)} solid ${C.snow}`);
  for (let r = 0; r < 2; r++) B.disc(0, Lb, 112 * k, "transparent", `${px(2)} solid ${C.rune}`, 1, `arRipple 4.4s ease-out ${r1(-r * 2.2)}s infinite`);
  const facet = `linear-gradient(90deg, rgba(0,0,0,${night ? 0.35 : 0.12}) 0%, rgba(255,255,255,0) 40%, rgba(0,0,0,${night ? 0.4 : 0.18}) 100%), repeating-linear-gradient(90deg, ${C.pillar[2]} 0 ${px(11)}, ${C.pillar[1]} ${px(11)} ${px(14)}, ${C.pillar[0]} ${px(14)} ${px(24)})`;
  const Lp = B.cyl(0, Lb, 46 * k, H.center[1], facet, `radial-gradient(circle at 40% 35%, #ffffff 0%, ${C.pillar[1]} 40%, ${C.pillar[0]} 100%)`, `${px(4)} solid ${C.rune}`);
  B.disc(0, Lp, 80 * k, `radial-gradient(circle, ${C.runeGlow} 0%, transparent 70%)`, null, 1, "arPulse 3.2s ease-in-out infinite");

  B.fore = (W, Hh, S) => {
    const col = night ? "#9cc4e4" : "#ffffff";
    const col2 = night ? "#4f86b8" : "#bfe6fb";
    [[0.12, 0.03, 520, 120, 0], [0.88, 0.02, 560, 130, 1]].forEach((b, i) => {
      B.foreAdd("I6Icicles", W * b[0], Hh * b[1], b[2] * S, b[3] * S, { col, col2, blur: 5 * S, op: night ? 0.75 : 0.95, rot: i, anim: `arSway ${8 + i}s ease-in-out ${-i * 2}s infinite` });
    });
    [[0.04, 1.0, 420, 200, 0], [0.97, 1.0, 460, 210, 1]].forEach((b, i) => {
      B.foreAdd("I6Drift", W * b[0], Hh * b[1], b[2] * S, b[3] * S, { col, col2: night ? "#173a3c" : "#3d6e66", blur: 9 * S, op: night ? 0.8 : 0.95, rot: i });
    });
  };

  return {
    ringLift: 0,
    centerLift: Lp,
    seatPad: (p, st, rr) => {
      B.disc(p.x, p.y, rr * 2, `radial-gradient(circle, ${st.col} 0%, transparent 70%)`, null, night ? 0.75 : 0.5, "arPulse 4s ease-in-out infinite");
      B.disc(p.x, p.y, rr * 1.42, "transparent", `${px(3)} dotted ${C.rune}`, 0.85);
      return B.cyl(p.x, p.y, rr, H.pad, iceSide,
        `linear-gradient(135deg, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0) 42%), ${st.col}`,
        `${px(4)} solid ${night ? "rgba(170,236,255,0.95)" : "rgba(255,255,255,0.95)"}`) - p.y;
    },
    after: () => {
      const t = rand32(61);
      /* ขอบฟ้า: เทือกเขาหิมะ (ปิดช่องใต้เส้นขอบฟ้า) + ปราสาทน้ำแข็ง */
      B.stand("I6Range", 0, -1660 * k, 3400, 470, { c1: C.range[0], c2: C.range[1], c3: C.range[2] }, false);
      B.stand("I6Castle", 0, -1420 * k, 560, 410, { night, col: C.rune }, false);
      /* บัลลังก์คริสตัลหลังเสากลาง (วางบนหน้าเสา ให้ชิ้นตั้งยืนบนเสาไม่ใช่บนพื้น) */
      B.stand("I6Throne", 0, Lp - 34 * k, 190, 150, { c1: C.spike[0], c2: C.spike[1], c3: C.spike[2], col: C.rune }, false);
      /* ผลึกน้ำแข็งพุ่งจากขอบอ่างน้ำพุ (ซ้าย-ขวา) */
      [[-104, -18], [104, -18], [-70, -88], [70, -88]].forEach(([x, y], i) => {
        B.stand("I6Spike", x * k, Lb + y * k, 46 + (i < 2 ? 10 : 0), 66 + (i < 2 ? 12 : 0), { c1: C.spike[0], c2: C.spike[1], c3: C.spike[2] }, false);
      });
      /* รูปปั้นอัศวินในก้อนน้ำแข็ง ด้านหลังวงที่นั่ง */
      [205, 238, 302, 335].forEach((d, i) => {
        const p = seatPoint(455 * k, d);
        B.stand("I6Statue", p.x, p.y, 80, 150, { c1: C.statue[0], c2: C.statue[1], col: C.rune, rot: i % 2 });
      });
      /* กระจุกหนามน้ำแข็งริมทะเลสาบ */
      for (let s = 0; s < 13; s++) {
        const d = 160 + s * (220 / 12) + (t() - 0.5) * 6;
        if (Math.abs(d - 270) < 14) continue;
        const p = seatPoint((640 + t() * 120) * k, d);
        const z = 0.7 + t() * 0.7;
        B.stand("I6Spike", p.x, p.y, 110 * z, 150 * z, { c1: C.spike[0], c2: C.spike[1], c3: C.spike[2] });
      }
      /* สนหิมะ */
      for (let n = 0; n < 34; n++) {
        const d = t() * 360;
        if (nearSector(d) || Math.abs(d - 270) < 17) continue;
        const p = seatPoint((820 + Math.pow(t(), 0.8) * 760) * k, d);
        const z = 0.9 + t() * 0.8;
        B.stand("I6Pine", p.x, p.y, 100 * z, 170 * z, { c1: C.pine[0], c2: C.pine[1], c3: C.pine[2] });
      }
      /* ผลึกเล็กข้างแท่นที่นั่ง (ด้านนอกวง) */
      for (let s = 0; s < 10; s++) {
        const d = 175 + s * 21;
        const p = seatPoint(372 * k, d);
        B.stand("I6Shard", p.x, p.y, 40, 46, { c1: C.spike[0], c2: C.spike[1], c3: C.spike[2] });
      }

      /* เอฟเฟกต์: แสงเหนือ (คืน) / แดด+ลำแสง (วัน) · หิมะตก · ประกายน้ำแข็ง · ไอหนาวลอยต่ำ · ขอบจอน้ำค้างแข็ง */
      const f = rand32(66);
      const { W, H: Hh } = B.c;
      const S = B.S;
      if (night) {
        [[0.26, 0.07, 1.0, "#5ef0b0", "#3fb8ff", 17], [0.7, 0.05, 0.95, "#8f7bff", "#5ee8ff", 23], [0.5, 0.12, 0.7, "#5ef0b0", "#8f7bff", 13]].forEach((a, i) => {
          B.fxAdd("I6Aurora", W * a[0], Hh * a[1], W * a[2], Hh * 0.3, { col: a[3], col2: a[4], op: 0.85, anim: `ar6Aurora ${a[5]}s ease-in-out ${-i * 5}s infinite` });
        });
        B.fxAdd("Glow", W * 0.5, Hh * 0.18, W * 0.7, Hh * 0.4, { col: "rgba(120, 230, 255, 0.28)", anim: "arPulse 6s ease-in-out infinite" });
      } else {
        B.fxAdd("Glow", W * 0.22, Hh * 0.02, W * 0.8, Hh * 0.8, { col: "rgba(255, 255, 255, 0.6)", anim: "arPulse 10s ease-in-out infinite" });
        for (let g = 0; g < 3; g++) {
          B.fxAdd("I6Beam", W * (0.2 + g * 0.17), Hh * 0.32, 110 * S, Hh * 1.0, { rot: 24, op: 0.55, col: "rgba(255, 255, 255, 0.55)", anim: `arPulse ${7 + g * 2}s ease-in-out ${-g * 2.3}s infinite` });
        }
      }
      for (let fg = 0; fg < 3; fg++) {
        B.fxAdd("Fog", W * (0.15 + fg * 0.35), Hh * (0.36 + fg * 0.05), W * 0.7, Hh * 0.14, {
          col: night ? "rgba(150, 210, 255, 0.16)" : "rgba(255, 255, 255, 0.5)", anim: `arDrift ${r1(24 + f() * 12)}s ease-in-out ${r1(-f() * 20)}s infinite`,
        });
      }
      /* ประกายระยิบบนน้ำแข็ง + ยอดผลึก */
      for (let g = 0; g < 14; g++) {
        const a = f() * Math.PI * 2;
        const rr = (90 + f() * 560) * k;
        const p = proj(B.c, Math.cos(a) * rr, Math.sin(a) * rr * 0.9);
        const z = (14 + f() * 16) * S;
        B.fxAdd("I6Glint", p.x, p.y - f() * 30 * S, z, z, { col: C.glint, anim: `arTwinkle ${r1(1.8 + f() * 2.6)}s ease-in-out ${r1(-f() * 5)}s infinite` });
      }
      /* หิมะตก: เริ่มเหนือจอ หน่วงติดลบให้กระจายทั้งจอ · ใหญ่/ใกล้ = ตกเร็ว */
      const nSnow = night ? 44 : 50;
      for (let s = 0; s < nSnow; s++) {
        const near = s % 5 === 0;
        const z = (near ? 12 + f() * 7 : 5 + f() * 5) * S;
        const dur = near ? 6 + f() * 3 : 10 + f() * 8;
        B.fxAdd(s % 7 === 3 ? "I6Star" : "I6Flake", f() * W * 1.1 - W * 0.05, -20 * S, z, z, {
          col: night ? "#dff2ff" : "#ffffff", op: near ? 0.95 : 0.85,
          anim: `${s % 2 ? "ar6SnowA" : "ar6SnowB"} ${r1(dur)}s linear ${r1(-f() * dur)}s infinite`,
        });
      }
      B.fxAdd("I6Frost", W / 2, Hh / 2, W, Hh, { col: night ? "rgba(120, 190, 240, 0.4)" : "rgba(255, 255, 255, 0.75)", col2: night ? "rgba(2, 8, 20, 0.6)" : "rgba(120, 170, 210, 0.3)" });
    },
  };
}

export default { H, build };
