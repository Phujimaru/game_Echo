// ภาพจางของหน้าที่กำลังจะถูกถอด (เช่นหน้าเลือกโหมด ตอนแมตช์เริ่ม) — โคลน DOM ไว้แล้วจางหาย ~0.45 วิ
//  ใช้คลาส .ocl-ghost (oc/lobby/lobby.css) · z 64 = เหนือลูกโลกร่วม ใต้ฉากเปิดแมตช์ (65)
//  ต้องเรียก "ก่อน" React ถอดหน้านั้น (เช่นใน socket handler ก่อน setState)
export function ghostScreen(selector) {
  if (typeof document === "undefined") return;
  const el = document.querySelector(selector);
  if (!el) return;
  const ghost = el.cloneNode(true);
  ghost.querySelectorAll("canvas").forEach((c) => c.remove());
  ghost.classList.add("ocl-ghost");
  ghost.setAttribute("aria-hidden", "true");
  Object.assign(ghost.style, { position: "fixed", inset: "0", zIndex: "64" });
  document.body.appendChild(ghost);
  setTimeout(() => ghost.remove(), 700);
}
