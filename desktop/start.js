// npm start — เปิดโปรแกรมตอน dev · ล้าง ELECTRON_RUN_AS_NODE ก่อน (เทอร์มินัลบางตัว เช่นที่มาจาก VS Code
//  ตั้งค่านี้ค้างไว้ ทำให้ electron ทำงานเป็น node ธรรมดาแทนที่จะเปิดหน้าต่าง)
const { spawn } = require("child_process");
const electron = require("electron");

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(electron, [__dirname, ...process.argv.slice(2)], { stdio: "inherit", env });
child.on("exit", (code) => process.exit(code ?? 0));
