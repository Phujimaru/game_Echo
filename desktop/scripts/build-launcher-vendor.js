// เตรียมไฟล์ที่หน้าแรก (launcher) ต้องใช้ → desktop/launcher/vendor (ไฟล์ที่ build ได้ ไม่ track ใน git)
//  globe.js (ลูกโลกกลางแบบ iife) + main5.0.mp3 + logo_current.webp + click.mp3 + volume.css — ดู client/vite.globe.config.js
//  ใช้ใน start.js (ข้ามถ้าไฟล์ยังใหม่กว่าต้นทาง) และ stage-game.js (build ใหม่ทุกครั้ง)
//  รันเอง: node scripts/build-launcher-vendor.js [--force]
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const client = path.resolve(__dirname, "../../client");
const vendor = path.resolve(__dirname, "../launcher/vendor");
const OUTPUTS = ["globe.js", "main5.0.mp3", "logo_current.webp", "click.mp3", "volume.css"].map((f) => path.join(vendor, f));
// เวลาที่ build เสร็จล่าสุด (copyFileSync บน Windows คงเวลาแก้ไขของไฟล์ต้นทางไว้ เทียบ mtime ของ output ตรงๆ ไม่ได้)
const STAMP = path.join(vendor, ".built");
const SOURCES = [
  "src/globe/globeCore.js",
  "src/globe/launcherEntry.js",
  "vite.globe.config.js",
  "package-lock.json",
  "public/theme_song/main5.0.mp3",
  "public/image/logo_current.webp",
  "public/effect_sound/click.mp3",
  "src/oc/ui-extra/volume.css",
].map((f) => path.join(client, f));

const mtime = (file) => {
  try {
    return fs.statSync(file).mtimeMs;
  } catch {
    return null;
  }
};

function isFresh() {
  if (OUTPUTS.some((f) => mtime(f) == null)) return false;
  const built = mtime(STAMP);
  return built != null && built >= Math.max(...SOURCES.map((f) => mtime(f) || 0));
}

function buildLauncherVendor({ force = false } = {}) {
  if (!force && isFresh()) return false;
  const script = "import { build } from 'vite'; await build({ configFile: 'vite.globe.config.js' });";
  execFileSync(process.execPath, ["--input-type=module", "-e", script], { cwd: client, stdio: "inherit" });
  const missing = OUTPUTS.filter((f) => !fs.existsSync(f));
  if (missing.length) throw new Error(`build ไฟล์หน้าแรกไม่ครบ: ${missing.map((f) => path.basename(f)).join(", ")}`);
  fs.writeFileSync(STAMP, new Date().toISOString());
  return true;
}

module.exports = { buildLauncherVendor, LAUNCHER_VENDOR_FILES: OUTPUTS };

if (require.main === module) {
  const built = buildLauncherVendor({ force: process.argv.includes("--force") });
  console.log(built ? `build แล้ว → ${vendor}` : "ไฟล์หน้าแรกเป็นปัจจุบันแล้ว");
}
