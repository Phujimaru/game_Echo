// ซอร์สฝั่งเซิร์ฟเวอร์ทั้งหมด (server.js + server/**/*.js) — ให้เทสต์ที่ค้นข้อความในโค้ดหาเจอ
//  ไม่ว่าโค้ดส่วนนั้นจะถูกย้ายไปอยู่ไฟล์ไหนใน server/
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function serverFiles(dir = path.join(ROOT, 'server')) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...serverFiles(full));
    else if (entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

// path แบบสัมพัทธ์จากรากโปรเจกต์ (เช่น "server/phases/attack.js")
function serverSourcePaths() {
  return ['server.js', ...serverFiles().map((f) => path.relative(ROOT, f).split(path.sep).join('/'))];
}

function serverSource() {
  return serverSourcePaths().map((f) => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
}

module.exports = { serverSource, serverSourcePaths };
