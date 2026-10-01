# บันทึกส่งต่องาน ECHO (อัปเดต 2026-10-01)

> สำหรับ session ถัดไป: อ่านไฟล์นี้ให้จบก่อนเริ่มงาน แล้วอ่าน [CLAUDE.md](../CLAUDE.md) และ [GAME_SYSTEM.md](../GAME_SYSTEM.md) §1.1
> คุยกับผู้ใช้เป็นภาษาไทยเสมอ

## สถานะ repo

- branch: **`refactor/split-server`** (แตกจาก `main` ที่ `bf469f0`) — **ยังไม่ push และยังไม่ merge**
- commit ในงานนี้ (เก่า → ใหม่):
  1. `7759cf3` แยก `server.js` (7,900 บรรทัด) เป็นโฟลเดอร์ `server/` 24 ไฟล์ — ไม่เปลี่ยนพฤติกรรมเกม
  2. `1f84978` ลบโค้ดค้างของตัวละครที่ถูกถอดแล้ว + โค้ด/ไฟล์ที่ไม่ได้ใช้
  3. `d62b099` ย่อคำอธิบายสกิล 257 อัน (สั้นลง 42%) และป้ายสถานะ 75 อัน (สั้นลง 37%) + ลบเลขแพตช์ออกจากข้อความในเกม
- ตรวจแล้ว ณ commit ล่าสุด: `npm test` ผ่าน 901/901 · `npx eslint .` เหลือ 2 errors + 85 warnings ที่มีมาก่อนแล้ว · build หน้าเกมผ่าน
- **ยังไม่ได้เปิดเกมเล่นจริงในเบราว์เซอร์** — ควรเล่นสัก 1 แมตช์ก่อน merge

## งานที่ทำเสร็จแล้ว (รายละเอียด)

### 1. แยก server.js
- `server.js` เหลือ 54 บรรทัด (ตาข่าย error + require + export ให้เทสต์ + listen) · โค้ดเกมอยู่ใน `server/` ดูตารางใน GAME_SYSTEM.md §1.1
- กติกาเขียนโค้ดใน `server/` (สำคัญ — ถ้าผิดจะได้ `undefined` ตอนโหลด):
  - สถานะแมตช์อ่าน/เขียนผ่าน `match.<ชื่อ>` (`server/match.js`) ห้าม destructure ออกมาเก็บ
  - เรียกฟังก์ชันข้ามไฟล์ผ่านชื่อโมดูล (`combat.healHp()`) เพราะไฟล์ require วนกัน — destructure ได้เฉพาะ `constants` / `match` / `app` / `engine`
  - ฟังก์ชันที่ไฟล์อื่นเรียก ต้องอยู่ใน `Object.assign(module.exports, {...})` **บนสุดของไฟล์** (ก่อน require) และต้องเป็น function declaration
  - `characters/*.js` ไม่ได้แก้ — ยังเรียกผ่าน `engine` เหมือนเดิม
- เทสต์ที่ค้นข้อความในโค้ด server ใช้ `serverSource()` จาก `tests/serverSource.js`
- อัปเดต README, GAME_SYSTEM.md, skill `add-character` / `remove-character` ให้ชี้ไฟล์ใหม่แล้ว

### 2. ล้างของค้าง / โค้ดไม่ได้ใช้
- ตัวละครปัจจุบันมี 50 ตัว (ครบไฟล์ทุกตัว) · ตัวที่ถูกถอดไปใน `2fe9e63`: arjuna, banagher, broadband_man, byleth, eva13, gambler, hakuno, kuwagata, riddhe, shrade_elan (+ yuuki และโหมด overload)
- ลบจาก `Game.jsx`: state / ปุ่ม / หน้าต่าง / ป้ายสถานะ 33 อัน / socket emit 6 ตัวที่ server ไม่รับ (ไฟล์ 6,321 → 5,676 บรรทัด)
- ลบจาก server: สถานะที่ไม่มีใครสร้าง (absorb, beam, ohger, spear, cassius, rsHopper, melody, moonmark, unplug, lai, vortigern, grit, healthfull, overweight, fiber, tiger, golden), ธง `allyWinFlag`, ธง `nightResetPending`, engine 5 ตัว (`setTeamCount`, `setTeamSize`, `setNightResetPending`, `extendNight`, `fieldFreezeByOther`), ค่าคงที่ OGURI ที่ไม่ได้ใช้ 30 ตัว, ฟิลด์ผู้เล่น `profit` / `beatAt` / `moonMarksBy`
- ลบ `client/src/journey/JourneyPreview.jsx` (หน้าทดสอบที่ไม่ได้ต่อเข้าแอป), CSS ของตัวที่ถูกถอด, ตัวแปรไม่ได้ใช้
- **แก้ต้นเหตุเทสต์เงียบ:** `process.on("uncaughtException")` ใน `server.js` เดิมติดตั้งเสมอ ทำให้ไฟล์เทสต์ที่ require โมดูลไม่มีอยู่กลืน error — ตอนนี้ติดตั้งเฉพาะ `require.main === module` · ไฟล์ `tests/characters/duplicate-safety.test.js` ที่เคยพังเงียบ ตอนนี้รันจริงและผ่าน 6 ข้อ
- fixture ในเทสต์ที่ใช้ id ตัวที่ถูกถอด เปลี่ยนเป็น `'dummy'`

### 3. คำอธิบายที่ผู้เล่นเห็น
- รูปแบบใหม่: `ก่อนเปิดไพ่: ผล · ผล (ข้อจำกัด)` — กฎเต็มอยู่ใน skill `add-character` หัวข้อ "เขียนคำอธิบายสกิล"
- ไม่แตะ: ท่าไม้ตายของชิโด (ตั้งใจให้ลึกลับ), คำอธิบายใน `client/src/data/shop.js` และป้ายสถานะที่สั้นอยู่แล้ว (≤140 ตัวอักษร)
- แก้ตัวเลขผิดในป้ายของ Oguri: ชาร์จ 6-12/เทิร์น (เดิมเขียน 8-16) · Ashen Trail ใช้ 80 (เดิมเขียน 75)

## รอผู้ใช้ตัดสินใจ (ถามแล้ว ยังไม่ได้คำตอบ)

1. **ไฟล์สื่อของตัวที่ถูกถอด ~500MB** ใน `client/public/characters/` (ไม่อยู่ใน git — ลบแล้วกู้ไม่ได้): arjuna, banagher, broadband_man, byleth, eva13, gambler, kotarou, kuwagata, riddhe, shotaro, shrade_elan, yuuki — ลบ / ย้ายไปเก็บ / ปล่อยไว้? (บน R2 ก็มีชุดเดียวกัน) **ห้ามลบเองโดยไม่ได้รับคำยืนยัน**
2. **โหมด SE.RA.PH (Moon Cell)** ตั้ง "พักใช้งาน" (`SUSPENDED_MODES` ใน `server/lobby.js`) แต่โค้ดครบ: `seraph.js`, `server/modes/seraph.js`, `client/src/seraph/` 12 ไฟล์, `SERAPH_MOONCELL.md`, `SERAPH_SCENES.md`, tests — เก็บหรือลบ?
3. **บั๊กเดิม (ยังไม่แก้):** ปุ่ม "ยกเลิก" ของแบนเนอร์ `skSel` (ชิกิ "นายมีฝีมือแค่ไหนหรอ?") ใน `Game.jsx` เรียก `setKaiPunishSel(false)` แทน `setSkSel(false)` — มี 2 จุด (จอคอม + มือถือ)
4. **push / merge** branch นี้หรือยัง

## งานใหญ่ที่วางแผนไว้แต่ยังไม่เริ่ม

### A. แยก server ระดับ 2 (ผู้ใช้อนุมัติแนวทางแล้ว แต่สั่งทำแค่ระดับ 1)
- ย้ายเงื่อนไข `characterId === "..."` ในระบบกลาง (~300 จุด กระจุกใน `server/skills.js` `useSkillCore` และ `server/phases/attack.js` `doAttack`) ไปเป็น hook ใน `characters/<id>.js`
- ย้าย `server/characterRules.js` (ที่พักชั่วคราว) เข้าไฟล์ตัวละคร
- ทำทีละตัวละคร ตัวละ 1 commit และเขียนเทสต์ก่อนย้าย
- ข้อเสนอที่ยังไม่ได้คำตอบ: เพิ่มกฎ eslint `max-lines` ~1,100 สำหรับ `server/`

### B. ECHO 5.0 — แจกเกมเป็น exe (คุยแผนจบแล้ว ยังไม่เริ่มเขียนโค้ด)
- Electron ในโฟลเดอร์ใหม่ `desktop/` แบบ **เปิดห้องเอง**: "สร้างห้อง" = รัน `server.js` ในเครื่อง (`require.main` guard มีแล้ว) · "เข้าร่วม" = ใส่ IP แล้วโหลด `http://IP:3000`
- เพื่อนอยู่ไกลกัน → ใช้ **Radmin VPN** (IP ขึ้นต้น `26.`) — หน้าสร้างห้องหา IP นี้แล้วโชว์ปุ่มคัดลอก · จำ IP ล่าสุด · เตือนเรื่อง Windows Firewall ต้องติ๊ก Public
- exe ตัวแรก = **5.0.0** · ตัวติดตั้ง NSIS (Setup.exe ~90MB) · ไฟล์สื่อโหลดจาก R2 ครั้งแรกแล้วแคช (ดักคำขอ `/characters/...` ใน Electron) · build ต้องข้ามไฟล์สื่อใน `client/dist`
- อัปเดตอัตโนมัติด้วย `electron-updater` · ไฟล์อัปเดตเก็บ **R2 bucket เดิม โฟลเดอร์ `updates/`**
- ด่านตรวจ 3 ชั้นทุกครั้งที่เปิด: (1) เช็คเวอร์ชันกับ R2 — เช็คไม่ได้ = ไม่ให้เข้า มีแค่ปุ่มลองใหม่ · มีใหม่ = โหลดแล้วรีสตาร์ท (2) เช็ค/โหลดไฟล์สื่อที่เปลี่ยน (3) ตอนเข้าร่วม ถาม `/version` ของเครื่อง host — ต้องตรงทุกตัวเลข ไม่ตรงไม่ให้เข้า · ไม่อัปเดตกลางแมตช์
- ต้องเพิ่ม endpoint `/version` ใน server (ไม่แตะ engine)
- SmartScreen: ไม่ซื้อใบรับรอง — เตรียมคำแนะนำให้เพื่อนกด More info → Run anyway (อัปเดตอัตโนมัติไม่โดนเตือนซ้ำ)

## ปัญหาที่มีมาก่อน (ไม่ใช่จากงานนี้)
- eslint 2 errors: `tests/characters/escanor.test.js` บรรทัด ~722 (`no-control-regex` จาก `\x08`)
- vite เตือน chunk ใหญ่กว่า 500 kB

## เคล็ดลับเครื่องมือ (เครื่องนี้ Windows + Git Bash)
- **Bash tool ยุบ `\\` เป็น `\` ทั้งใน heredoc และ `node -e '...'`** — regex ที่มี backslash ให้เขียนเป็นไฟล์ .js ใน scratchpad แล้วค่อยรัน (เคยทำให้ Game.jsx เสียหายมาแล้ว ต้อง restore)
- ไฟล์ปน LF/CRLF (`add-character/SKILL.md`, `VictoryScreen.jsx` เป็น CRLF) — สคริปต์แทนข้อความต้อง normalize ก่อนเทียบ
- build หน้าเกมโดยไม่ copy ไฟล์สื่อ 1.8GB: ใน `client/` รัน
  `node --input-type=module -e "import { build } from 'vite'; await build({ build: { outDir: '<scratch>', emptyOutDir: true, copyPublicDir: false } })"`
- เช็คชุดเต็ม: `npm test` · `npx eslint .` · build ด้านบน
