// "อบ" พื้นสนามเป็นภาพเดียว (5.1.12 แก้จอกระพริบ)
//  พื้นสนามเป็นแผ่น CSS-3D ขนาดหลายพันพิกเซล (1080p ≈ 8000×8000) มีชิ้นลูกหลายร้อยชิ้น — GPU ต้องเก็บเป็นเท็กซ์เจอร์ก้อนใหญ่มาก
//  เครื่องที่หน่วยความจำ GPU ไม่พอจะเห็นภาพกระพริบเป็นช่องๆ ตลอดเวลาแม้อยู่นิ่ง
//  แก้: วาดชิ้นบนพื้นที่ไม่ขยับทั้งหมดลง <canvas> ครั้งเดียว (ผ่าน SVG foreignObject ให้ CSS gradient แบบเดิมวาดเหมือนเดิมทุกอย่าง)
//  แล้วใช้ canvas ก้อนเดียวนั้นเป็นพื้น — เหลือเท็กซ์เจอร์เดียวขนาดคงที่ (ไม่เกิน BAKE_PX)

const BAKE_PX = 4096;

const kebab = (k) => k.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase());
const NUM_PX = new Set(["left", "top", "width", "height"]);
const esc = (v) => String(v).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

function cssText(style) {
  let s = "position:absolute;box-sizing:border-box;";
  for (const [k, v] of Object.entries(style)) {
    if (v == null || k === "animation") continue;
    s += `${kebab(k)}:${typeof v === "number" && NUM_PX.has(k) ? `${v}px` : v};`;
  }
  return s;
}

/** คืน Promise<HTMLCanvasElement|null> — null = วาดไม่ได้ (ให้ผู้เรียกใช้ชิ้น DOM เดิมต่อ) */
export function bakePlane(size, ground, flats) {
  const px = Math.min(BAKE_PX, Math.ceil(size));
  let body = "";
  for (const f of flats) body += `<div style="${esc(cssText(f.style))}"></div>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 ${size} ${size}">`
    + `<foreignObject x="0" y="0" width="${size}" height="${size}">`
    + `<div xmlns="http://www.w3.org/1999/xhtml" style="position:relative;width:${size}px;height:${size}px;overflow:hidden;background:${esc(ground)}">${body}</div>`
    + `</foreignObject></svg>`;
  const img = new Image();
  img.decoding = "async";
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  return img.decode().then(() => {
    const cv = document.createElement("canvas");
    cv.width = px;
    cv.height = px;
    const ctx = cv.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, px, px);
    return cv;
  }).catch(() => null);
}
