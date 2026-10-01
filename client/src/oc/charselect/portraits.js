// ภาพตัวละครของหน้าเลือกตัว — โหลด + ถอดรหัสเบื้องหลังทีละไม่กี่ใบ (เปิดหน้าแล้วจอไม่กระตุก)
//  ใช้ fetch → createImageBitmap (เบราว์เซอร์ถอดรหัสนอกเธรดหลัก) แล้วย่อ/ครอปเหลือขนาดการ์ด (ไฟล์บางรูปใหญ่หลาย MB)
//  ได้ภาพเล็กพร้อมวาด (ImageBitmap หรือ canvas) เก็บแคชไว้ทั้งหน้าเว็บ — การ์ดในวง (charRings) และการ์ดลอย (CharacterSelect) ใช้ร่วมกัน
//  warmPortraits() = เริ่มโหลดล่วงหน้าตั้งแต่หน้าเลือกลำดับ (รายชื่อตัวละครได้จาก socket "roster" ที่ server ส่งมาตอนเชื่อมต่อ)
import { socket } from "../../socket";

// สัดส่วนเดียวกับช่องภาพในการ์ด (180×244) · ครอปแบบ cover เอนขึ้นบน (หน้าตัวละคร)
export const PORTRAIT_W = 320, PORTRAIT_H = 434;
const TOP_BIAS = 0.16;
const MAX_JOBS = 2;

const cache = new Map(); // url → { url, state: idle|queued|loading|ok|fail, bmp, waiters }
const queue = [];
let running = 0;
let rosterUrls = [];
let warm = false;

function entryOf(url) {
  let e = cache.get(url);
  if (!e) { e = { url, state: "idle", bmp: null, waiters: new Set() }; cache.set(url, e); }
  return e;
}

const crossOrigin = (url) => {
  try { return new URL(url, location.href).origin !== location.origin; } catch { return false; }
};

function cropRect(iw, ih) {
  const a = PORTRAIT_W / PORTRAIT_H;
  let sw = iw, sh = ih;
  if (iw / ih > a) sw = ih * a; else sh = iw / a;
  const sy = Math.max(0, Math.min(ih - sh, (ih - sh) * TOP_BIAS));
  return { sx: Math.round((iw - sw) / 2), sy: Math.round(sy), sw: Math.max(1, Math.round(sw)), sh: Math.max(1, Math.round(sh)) };
}

async function viaBitmap(url) {
  const res = await fetch(url, { mode: crossOrigin(url) ? "cors" : "same-origin" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  // ขั้นแรกถอดรหัส + ย่อกว้างคงสัดส่วน (นอกเธรดหลัก) → ขั้นสองครอปจากภาพเล็กแล้ว (ถูกมาก)
  const big = await createImageBitmap(blob, { resizeWidth: PORTRAIT_W * 2, resizeQuality: "medium" });
  try {
    const { sx, sy, sw, sh } = cropRect(big.width, big.height);
    return await createImageBitmap(big, sx, sy, sw, sh, { resizeWidth: PORTRAIT_W, resizeHeight: PORTRAIT_H, resizeQuality: "high" });
  } finally {
    big.close?.();
  }
}

// สำรอง (ไม่มี createImageBitmap / fetch ไม่ผ่าน): <img> + decode() แล้ววาดลง canvas ขนาดการ์ด
function viaImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (crossOrigin(url)) img.crossOrigin = "anonymous"; // ห้ามให้ canvas ติด taint (อัปโหลดเป็น texture ไม่ได้)
    img.decoding = "async";
    img.onerror = () => reject(new Error("image"));
    img.onload = () => {
      (img.decode ? img.decode() : Promise.resolve()).catch(() => {}).then(() => {
        const cv = document.createElement("canvas");
        cv.width = PORTRAIT_W; cv.height = PORTRAIT_H;
        const { sx, sy, sw, sh } = cropRect(img.naturalWidth || 1, img.naturalHeight || 1);
        cv.getContext("2d").drawImage(img, sx, sy, sw, sh, 0, 0, PORTRAIT_W, PORTRAIT_H);
        resolve(cv);
      });
    };
    img.src = url;
  });
}

async function load(url) {
  if (typeof createImageBitmap === "function" && typeof fetch === "function") {
    try { return await viaBitmap(url); } catch { /* ลองทางสำรอง */ }
  }
  return viaImage(url);
}

function pump() {
  while (running < MAX_JOBS && queue.length) {
    const e = queue.shift();
    if (e.state !== "queued") continue;
    e.state = "loading";
    running++;
    load(e.url)
      .then((bmp) => { e.bmp = bmp; e.state = "ok"; }, () => { e.state = "fail"; })
      .then(() => {
        running--;
        const ws = [...e.waiters];
        e.waiters.clear();
        ws.forEach((fn) => { try { fn(e); } catch (err) { console.error(err); } });
        setTimeout(pump, 0); // เว้นจังหวะให้เธรดหลักวาดเฟรมก่อนเริ่มใบถัดไป
      });
  }
}

/** เข้าคิวโหลด (ข้ามใบที่โหลดแล้ว/กำลังโหลด) · front = ดันขึ้นหน้าคิว (ใบที่หน้าจอต้องใช้ก่อน) */
export function preloadPortraits(urls, { front = false } = {}) {
  const list = [];
  for (const u of urls || []) {
    if (!u) continue;
    const e = entryOf(u);
    if (e.state === "idle") { e.state = "queued"; list.push(e); }
    else if (front && e.state === "queued") {
      const i = queue.indexOf(e);
      if (i >= 0) queue.splice(i, 1);
      list.push(e);
    }
  }
  if (front) queue.unshift(...list); else queue.push(...list);
  pump();
}

/** ข้อมูลภาพของ url (ไม่เริ่มโหลด) — state: idle | queued | loading | ok | fail */
export function peekPortrait(url) {
  return entryOf(url);
}

/** ขอภาพ: เข้าคิวถ้ายังไม่โหลด · cb(entry) ถูกเรียกครั้งเดียวเมื่อเสร็จ (สำเร็จ/พลาด) — ถ้าเสร็จอยู่แล้วไม่เรียก ให้เช็ค portraitDone เอง */
export function getPortrait(url, cb) {
  const e = entryOf(url);
  if (e.state === "idle") preloadPortraits([url]);
  if (cb && !portraitDone(e)) e.waiters.add(cb);
  return e;
}

export const portraitDone = (e) => !!e && (e.state === "ok" || e.state === "fail");

/** เริ่มโหลดภาพทุกตัวละครล่วงหน้า (เรียกจากหน้าเลือกลำดับ) — ถ้ายังไม่ได้รายชื่อ จะเริ่มทันทีที่ได้ */
export function warmPortraits() {
  warm = true;
  if (rosterUrls.length) preloadPortraits(rosterUrls);
}

socket.on("roster", (r) => {
  rosterUrls = (Array.isArray(r) ? r : []).filter((c) => c && !c.hidden && c.img).map((c) => c.img);
  if (warm) preloadPortraits(rosterUrls);
});
