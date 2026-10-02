// ภาพทางช้างเผือก (2D) — ใช้ร่วมกันระหว่างฉากเปิดตัวผู้เล่น (เส้นพุ่งออกจากโลก) กับฉากเปิดของท่อ (ละลายเข้าอุโมงค์)
//  สร้างครั้งเดียวต่อหน้าเว็บแล้วแคชเป็น data URL · ภาพเดียวกันทั้งสองฝั่ง = รอยต่อไม่สะดุด
let cached = null;

function makeRnd(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; }; }

export function milkyWayUrl() {
  if (cached) return cached;
  const W = 1600, H = 900;
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const g = c.getContext("2d");
  const r = makeRnd(20261002);
  // พื้นอวกาศ
  const bg = g.createRadialGradient(W * 0.5, H * 0.5, 0, W * 0.5, H * 0.5, W * 0.75);
  bg.addColorStop(0, "#0d1330"); bg.addColorStop(0.6, "#060a1c"); bg.addColorStop(1, "#02030a");
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  // แถบทางช้างเผือก: กลุ่มหมอกเรืองแสงตามแนวทแยง
  g.save();
  g.translate(W / 2, H / 2); g.rotate(-0.42);
  g.globalCompositeOperation = "lighter";
  for (let i = 0; i < 260; i++) {
    const x = (r() - 0.5) * W * 1.5, y = (r() - 0.5) * (70 + 120 * Math.exp(-Math.abs(x) / 500)) * (r() < 0.5 ? 1 : 1.6);
    const rad = 40 + r() * 140;
    const hue = r() < 0.6 ? [150, 170, 255] : r() < 0.5 ? [255, 190, 220] : [190, 240, 255];
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, `rgba(${hue[0]},${hue[1]},${hue[2]},${0.05 + r() * 0.06})`);
    gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
  }
  // แนวฝุ่นมืดกลางแถบ
  g.globalCompositeOperation = "source-over";
  for (let i = 0; i < 90; i++) {
    const x = (r() - 0.5) * W * 1.4, y = (r() - 0.5) * 40;
    const rad = 30 + r() * 80;
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, "rgba(4,6,16,.35)"); gr.addColorStop(1, "rgba(4,6,16,0)");
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
  }
  // ดาวหนาแน่นในแถบ
  for (let i = 0; i < 2600; i++) {
    const x = (r() - 0.5) * W * 1.5, y = (r() + r() + r() - 1.5) * 110;
    const a = 0.3 + r() * 0.7;
    g.fillStyle = `rgba(235,240,255,${a})`;
    g.fillRect(x, y, r() < 0.92 ? 1 : 2, 1);
  }
  g.restore();
  // ดาวทั่วฟ้า + ดาวสว่างมีแสงกระจาย
  for (let i = 0; i < 1400; i++) {
    const x = r() * W, y = r() * H, a = 0.25 + r() * 0.75;
    g.fillStyle = `rgba(230,236,255,${a})`;
    g.fillRect(x, y, r() < 0.9 ? 1 : 2, r() < 0.9 ? 1 : 2);
  }
  g.globalCompositeOperation = "lighter";
  for (let i = 0; i < 40; i++) {
    const x = r() * W, y = r() * H, rad = 6 + r() * 14;
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, "rgba(255,255,255,.9)"); gr.addColorStop(0.2, "rgba(180,200,255,.35)"); gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
  }
  cached = c.toDataURL("image/jpeg", 0.88);
  return cached;
}
