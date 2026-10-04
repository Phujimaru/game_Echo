// ฝังรูปลงต้นแบบ artifact "กระดานราชินี Echo" → ไฟล์ html เดียวพร้อมเผยแพร่
// ใช้: node .claude/plans/echo-queen-artifact/build.cjs [ไฟล์ปลายทาง]
//  แล้วเผยแพร่ด้วย Artifact tool ไปที่ url เดิม https://claude.ai/artifact/VZPEUkUL8ttmqJRktJQxFT
//  (session ใหม่ต้อง Artifact read url นั้นก่อน 1 ครั้ง ถึงจะ publish ทับได้)
const fs = require("fs"), path = require("path"), os = require("os");
const ROOT = path.resolve(__dirname, "../../..");
const MEDIA = path.join(ROOT, "client/public/characters/echo_queen");
const b64 = (f) => fs.readFileSync(path.join(MEDIA, f)).toString("base64");
const out = process.argv[2] || path.join(os.tmpdir(), "echo-queen-field.html");

let s = fs.readFileSync(path.join(__dirname, "echo_field_src.html"), "utf8");
s = s
  .replace("__MAIN__", b64("echo_queen_board.webp"))     // เท้าคาง + หงายมือ (บนกระดาน)
  .replace("__WIND__", b64("echo_queen_windup.webp"))    // ท่าง้าง
  .replace("__CUT__", b64("echo_queen_spread.webp"))     // ผายมือ (ฉากเปลี่ยนร่าง)
  .replace("__FIST__", b64("echo_queen_fist.webp"));     // กำปั้นมือซ้าย
fs.writeFileSync(out, s);
const js = s.match(/<script>([\s\S]*)<\/script>/)[1];
new Function(js); // ตรวจ syntax
console.log(`ok ${(s.length / 1024).toFixed(0)}KB → ${out}`);
