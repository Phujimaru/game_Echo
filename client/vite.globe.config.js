// build ของที่หน้าแรกของโปรแกรม (desktop/launcher) ใช้ → desktop/launcher/vendor (ไม่ track ใน git)
//  - globe.js = ลูกโลกกลาง (src/globe/globeCore.js + three) แบบ iife → window.EchoGlobe
//  - main5.0.mp3 + logo_current.webp คัดลอกจาก public/ (หน้าแรกต้องเล่นเพลง/โชว์โลโก้ได้ตั้งแต่เปิดครั้งแรก
//    ก่อนไฟล์สื่อโหลดเสร็จ และ exe ไม่ได้พก client/public ไปด้วย)
//  เรียกจาก desktop/scripts/build-launcher-vendor.js (ตอน npm start และตอน stage exe)
import { defineConfig } from "vite";
import { copyFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(here, "../desktop/launcher/vendor");
const COPY = [
  ["public/theme_song/main5.0.mp3", "main5.0.mp3"],
  ["public/image/logo_current.webp", "logo_current.webp"],
];

export default defineConfig({
  publicDir: false,
  logLevel: "warn",
  build: {
    outDir,
    emptyOutDir: true,
    target: "es2022",
    lib: {
      entry: path.resolve(here, "src/globe/launcherEntry.js"),
      name: "EchoGlobe",
      formats: ["iife"],
      fileName: () => "globe.js",
    },
  },
  plugins: [{
    name: "echo-launcher-assets",
    closeBundle() {
      mkdirSync(outDir, { recursive: true });
      for (const [from, to] of COPY) copyFileSync(path.resolve(here, from), path.join(outDir, to));
    },
  }],
});
