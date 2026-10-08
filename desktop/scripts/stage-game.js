// เตรียมโค้ดเกมที่จะพกไปใน exe → desktop/build/game (electron-builder คัดลอกไปเป็น resources/game)
//  - server.js + server/ + characters/ + characters.js
//  - หน้าเกม: build client ใหม่แบบไม่ copy ไฟล์สื่อ (client/public ~1.1GB อยู่บน R2 + แคชในเครื่องผู้เล่นแทน)
//  - node_modules เฉพาะ dependency ที่ server ใช้ตอนรัน (npm ci --omit=dev จาก lock file ของ repo)
const { execFileSync, execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { buildLauncherVendor } = require("./build-launcher-vendor");

const repo = path.resolve(__dirname, "../..");
const out = path.resolve(__dirname, "../build/game");
const version = require("../package.json").version;

function step(label, fn) {
  const t = Date.now();
  process.stdout.write(`• ${label}… `);
  fn();
  console.log(`${((Date.now() - t) / 1000).toFixed(1)}s`);
}

step("ล้างโฟลเดอร์เดิม", () => {
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
});

step("คัดลอกโค้ด server", () => {
  for (const f of ["server.js", "characters.js", "package.json", "package-lock.json"]) {
    fs.copyFileSync(path.join(repo, f), path.join(out, f));
  }
  for (const d of ["server", "characters"]) {
    fs.cpSync(path.join(repo, d), path.join(out, d), { recursive: true });
  }
});

step("ติดตั้ง dependency ของ server", () => {
  execSync("npm ci --omit=dev --ignore-scripts --no-audit --no-fund", { cwd: out, stdio: "ignore" });
});

step("build หน้าเกม (ไม่รวมไฟล์สื่อ)", () => {
  const outDir = path.join(out, "client", "dist").split(path.sep).join("/");
  const script = `import { build } from 'vite'; await build({ logLevel: 'error', build: { outDir: ${JSON.stringify(outDir)}, emptyOutDir: true, copyPublicDir: false } });`;
  execFileSync(process.execPath, ["--input-type=module", "-e", script], { cwd: path.join(repo, "client"), stdio: "inherit" });
});

// หน้าแรกของโปรแกรม: ลูกโลก (iife) + เพลง main5 + โลโก้ → desktop/launcher/vendor (electron-builder พกไปกับ "launcher/**")
step("build ลูกโลก + เพลงของหน้าแรก", () => {
  buildLauncherVendor({ force: true });
});

// ตรวจว่าโค้ดเกมพร้อมรันจริง: โหลดไฟล์หลักได้ + หน้าเกมมี index.html
step("ตรวจผลลัพธ์", () => {
  if (!fs.existsSync(path.join(out, "client", "dist", "index.html"))) throw new Error("ไม่มี client/dist/index.html");
  for (const dep of Object.keys(require(path.join(repo, "package.json")).dependencies)) {
    if (!fs.existsSync(path.join(out, "node_modules", dep))) throw new Error(`ไม่มี dependency: ${dep}`);
  }
});

let bytes = 0;
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full);
    else bytes += fs.statSync(full).size;
  }
})(out);
console.log(`โค้ดเกมสำหรับ exe ${version}: ${(bytes / 1024 ** 2).toFixed(1)} MB -> ${out}`);
