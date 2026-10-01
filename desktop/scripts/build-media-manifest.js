// สร้าง media-manifest.json จาก client/public (เฉพาะโฟลเดอร์สื่อใน server/mediaDirs.js)
//  ใช้ตอนออกเวอร์ชัน: ไฟล์สื่อบน R2 ต้องตรงกับ client/public ก่อน แล้วอัป manifest นี้ไปที่ updates/media-manifest.json
//  node scripts/build-media-manifest.js [ไฟล์ปลายทาง]   (ค่าเริ่มต้น desktop/dist/updates/media-manifest.json)
const fs = require("fs");
const path = require("path");
const { buildManifest } = require("../media");
const MEDIA_DIRS = require("../../server/mediaDirs");

const publicDir = path.resolve(__dirname, "../../client/public");
const out = path.resolve(process.argv[2] || path.join(__dirname, "../dist/updates/media-manifest.json"));

buildManifest(publicDir, MEDIA_DIRS).then((manifest) => {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(manifest, null, 1));
  const entries = Object.values(manifest.files);
  const mb = entries.reduce((n, e) => n + e.size, 0) / 1024 ** 2;
  console.log(`media-manifest: ${entries.length} ไฟล์ · ${mb.toFixed(1)} MB -> ${out}`);
});
