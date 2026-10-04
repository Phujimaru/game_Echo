// กำปั้นใหม่: ลบเศษแขนเสื้อใต้นิ้ว (เก็บเส้นขอบนิ้ว) → กลับด้านเป็นมือซ้าย → ลบพื้นเขียว → webp
const { execFileSync } = require("child_process");
const SRC = "C:/backjact_media_originals/echo_queen/echo_queen_fist2_src.png";
const OUT = "C:/backjact/client/public/characters/echo_queen/echo_queen_fist.webp";
const CHECK = require("path").join(require("os").tmpdir(), "echo_fist_check.png");

// พิกเซลของแขนเสื้อ = มืด หรือ เทาอมม่วง (ผิวมีแดงมากกว่าเขียวชัดเจน จึงไม่โดน)
const dark = (x, y) => `lt((r(${x},${y})+g(${x},${y})+b(${x},${y}))/3,110)`;
const gray = (x, y) => `gt(r(${x},${y}),140)*lt(abs(r(${x},${y})-g(${x},${y})),22)*gt(b(${x},${y}),r(${x},${y})-5)*lt(b(${x},${y})-g(${x},${y}),40)`;
const sleeve = (x, y) => `max(${dark(x, y)},${gray(x, y)})`;
// ลบเฉพาะพิกเซลที่ข้างบน 6px ก็เป็นแขนเสื้อด้วย → เส้นขอบนิ้ว (ข้างบนเป็นผิว) ยังอยู่
const cond = `between(X,215,400)*between(Y,500,600)*${sleeve("X", "Y")}*${sleeve("X", "Y-6")}`;
const geq = `geq=r='if(${cond},0,r(X,Y))':g='if(${cond},255,g(X,Y))':b='if(${cond},0,b(X,Y))'`;
const key = "chromakey=0x00FF00:0.28:0.06,despill=type=green:mix=0.6:expand=0.2,format=rgba";

const vf = `format=rgb24,${geq},hflip,${key}`;
execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", SRC, "-vf", vf, "-c:v", "libwebp", "-quality", "90", "-compression_level", "6", OUT]);
execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i", "color=c=0x1a2040:s=770x686", "-i", OUT,
  "-filter_complex", "[0][1]overlay=format=auto", "-frames:v", "1", CHECK]);
console.log("ok");
