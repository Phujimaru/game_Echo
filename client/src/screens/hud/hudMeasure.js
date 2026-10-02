// เครื่องมือ dev: วัดกล่องของแผงตัวเราด้วย getBoundingClientRect แล้วเช็คว่ามีคู่ไหนทับกัน (?measure=1 ในหน้า preview)
//  ผลเขียนลง <pre id="hud-measure"> (อ่านผ่าน --dump-dom) และ console
const PARTS = [
  ["แผงตัวละคร", ".hud-prof-card"],
  ["รูปตัวละคร", ".hud-prof-portrait"],
  ["แต้มสกิล", ".hud-sp-strip"],
  ["ทรัพยากร", ".hud-res-strip"],
  ["แท็บสถานะ", ".hud-drawer-tab"],
  ["กลุ่มกลาง", ".hud-center-in"],
  ["กลุ่มขวา", ".hud-right-in"],
  ["แถบบน", ".hud-top"],
  ["คู่แข่ง", ".p-target-wrap"],
  ["กองไพ่", ".bd-deck"],
];
// คู่ที่อยู่กลุ่มเดียวกันโดยตั้งใจ (รูปเกยแผง / แผงแต้มชิดแผง) ไม่นับว่าชน
const SAME = new Set(["แผงตัวละคร|รูปตัวละคร", "รูปตัวละคร|แต้มสกิล", "รูปตัวละคร|ทรัพยากร"]);

export function measureHud() {
  const boxes = [];
  for (const [name, sel] of PARTS) {
    document.querySelectorAll(sel).forEach((el, i) => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) boxes.push({ name: `${name}${i ? i + 1 : ""}`, kind: name, r });
    });
  }
  const hits = [];
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i];
      const b = boxes[j];
      if (SAME.has(`${a.kind}|${b.kind}`) || SAME.has(`${b.kind}|${a.kind}`)) continue;
      const w = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
      const h = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
      if (w > 0.5 && h > 0.5) hits.push(`${a.name} × ${b.name} (${Math.round(w)}×${Math.round(h)})`);
    }
  }
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const out = boxes
    .filter((b) => b.r.left < -1 || b.r.top < -1 || b.r.right > vw + 1 || b.r.bottom > vh + 1)
    .map((b) => `${b.name} ล้นจอ`);
  const card = document.querySelector(".pc-card");
  const lines = [
    `${vw}x${vh}`,
    card ? `ขนาดการ์ดคู่แข่ง (ก่อนย่อ): ${card.offsetWidth}x${card.offsetHeight}` : "ไม่มีการ์ดคู่แข่ง",
    ...boxes.map((b) => `${b.name}: ${Math.round(b.r.left)},${Math.round(b.r.top)} ${Math.round(b.r.width)}x${Math.round(b.r.height)}`),
    hits.length ? `ทับ: ${hits.join(" | ")}` : "ทับ: ไม่มี",
    out.length ? `ล้น: ${out.join(" | ")}` : "ล้น: ไม่มี",
  ];
  let pre = document.getElementById("hud-measure");
  if (!pre) {
    pre = document.createElement("pre");
    pre.id = "hud-measure";
    pre.style.display = "none";
    document.body.appendChild(pre);
  }
  pre.textContent = lines.join("\n");
  console.log(lines.join("\n"));
}
