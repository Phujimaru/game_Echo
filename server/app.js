// Express + HTTP + Socket.IO — เสิร์ฟหน้าเว็บ/ไฟล์สื่อ (redirect ไป R2)
const express = require("express");
const compression = require("compression");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const fs = require("fs");

const app = express();
const server = http.createServer(app);
// จำกัด origin ที่เชื่อมต่อ socket.io ได้ — ตั้ง ALLOWED_ORIGIN เป็นโดเมนจริงตอน deploy (เช่น
//  https://your-app.onrender.com) กัน third-party เว็บอื่นฝัง script มาเชื่อมต่อ/join เกมได้
//  ไม่ตั้งค่านี้ = ไม่จำกัด origin (ค่าเริ่มต้นเดิม) — เหมาะกับ dev ในเครื่องที่ยังไม่รู้โดเมนจริง
//  (dev ผ่าน Vite proxy ที่ :5173 อยู่แล้วไม่ต้องพึ่งค่านี้ เพราะ browser มองว่าเป็น same-origin)
const io = new Server(server, {
  // Socket events use small payloads; reject oversized packets before parsing.
  maxHttpBufferSize: 64 * 1024,
  cors: process.env.ALLOWED_ORIGIN ? { origin: process.env.ALLOWED_ORIGIN } : undefined,
  // state ที่ส่งเป็น JSON ภาษาไทย (ชื่อ/คำอธิบายสกิลของผู้เล่นทุกคน) บีบอัดได้หลายเท่าตัว
  //  socket.io v4 ปิด permessage-deflate ไว้เป็นค่าเริ่มต้น — เปิดเฉพาะแพ็กเก็ตที่ใหญ่พอจะคุ้มค่า CPU
  perMessageDeflate: { threshold: 1024 },
});

const clientDist = path.join(__dirname, "..", "client", "dist");
const useReact = fs.existsSync(path.join(clientDist, "index.html"));
const staticDir = useReact ? clientDist : path.join(__dirname, "..", "public");

// ไฟล์ตัวละคร (รูป/วิดีโอ/เพลง) ย้ายไปเก็บบน Cloudflare R2 แล้ว — ตั้ง ASSET_BASE_URL ไว้ค่อย redirect
// ไปที่นั่นแทนการเสิร์ฟจากเครื่องเอง (R2 ไม่คิดค่า egress ต่างจาก bandwidth ของ server หลักที่มีโควตา)
// ไม่ตั้งค่านี้ = fallback เสิร์ฟจากไฟล์ในเครื่องตามเดิม (เช่นตอน dev ในเครื่อง)
const ASSET_BASE_URL = process.env.ASSET_BASE_URL; // เช่น https://pub-xxxx.r2.dev
// โฟลเดอร์สื่อทั้งหมดที่ย้ายไป R2 — /characters (รูป/วิดีโอ/เพลงตัวละคร), /item (ปืนหน่วย GUTS
//  Select + คีย์/วีดีโอกระสุน), /overload_force (สนาม), /theme_song + /effect_sound (เพลง/เสียง),
//  /image (พื้นหลัง + สแปลช), /mooncell (สื่อโหมด SE.RA.PH: ฉากหลัง GIF + ภาพสถานที่ + เพลง/SFX)
//  /journey (เพลงการเดินทาง 7 ภูมิภาค กลางวัน/กลางคืน + map.mp3 ของฉากแผนที่)
//  — ต้องอัปขึ้น R2 ให้ครบทุกโฟลเดอร์ก่อนถึงจะ redirect ติด ไม่งั้น 404
const R2_DIRS = ["characters", "item", "overload_force", "theme_song", "effect_sound", "image", "mooncell", "journey"];
if (ASSET_BASE_URL) {
  for (const dir of R2_DIRS) {
    app.get(`/${dir}/*`, (req, res) => res.redirect(302, ASSET_BASE_URL + req.path));
  }
}

// gzip ให้ index.html + bundle js/css ของ vite (637 KB -> ~170 KB) — compression ข้ามไฟล์ที่บีบมาแล้ว
//  อย่าง jpg/png/webp/mp3/mp4 ให้เองอยู่แล้ว จึงไม่เปลืองซีพียูฟรี ๆ กับไฟล์สื่อ
app.use(compression());
app.use(express.static(staticDir, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith(".html")) {
      // app shell ต้องเช็คของใหม่ทุกครั้ง ไม่งั้น deploy ใหม่แล้ว client ยังใช้โค้ดเก่าค้าง
      res.setHeader("Cache-Control", "no-cache");
    } else if (path.basename(path.dirname(filePath)) === "assets") {
      // ไฟล์ js/css ของ vite มี hash ในชื่อไฟล์อยู่แล้ว เปลี่ยนเนื้อหา = เปลี่ยนชื่อไฟล์ แคชยาวสุดได้เลย
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    } else {
      // รูป/วิดีโอ/เพลงตัวละคร (ไฟล์ใหญ่ ชื่อไฟล์ไม่มี hash) แคช 30 วัน ลด bandwidth การโหลดซ้ำ
      res.setHeader("Cache-Control", "public, max-age=2592000");
    }
  },
}));
app.get(/^\/(?!socket\.io).*/, (req, res) => res.sendFile(path.join(staticDir, "index.html")));

module.exports = {
  server, io,
};
