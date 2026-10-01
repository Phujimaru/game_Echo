# บันทึกส่งต่องาน ECHO (อัปเดต 2026-10-01)

> สำหรับ session ถัดไป: อ่านไฟล์นี้ให้จบก่อนเริ่มงาน แล้วอ่าน [CLAUDE.md](../CLAUDE.md) และ [GAME_SYSTEM.md](../GAME_SYSTEM.md) §1.1
> คุยกับผู้ใช้เป็นภาษาไทยเสมอ

## สถานะ repo

- งานทั้งหมด **merge เข้า `main` และ push แล้ว** (ทำบน branch `refactor/split-server` ที่แตกจาก `bf469f0`)
- commit ในงานนี้ (เก่า → ใหม่):
  1. `7759cf3` แยก `server.js` (7,900 บรรทัด) เป็นโฟลเดอร์ `server/` 24 ไฟล์ — ไม่เปลี่ยนพฤติกรรมเกม
  2. `1f84978` ลบโค้ดค้างของตัวละครที่ถูกถอดแล้ว + โค้ด/ไฟล์ที่ไม่ได้ใช้
  3. `d62b099` ย่อคำอธิบายสกิล 257 อัน (สั้นลง 42%) และป้ายสถานะ 75 อัน (สั้นลง 37%) + ลบเลขแพตช์ออกจากข้อความในเกม
- ตรวจแล้ว ณ commit ล่าสุด: `npm test` ผ่าน 901/901 · `npx eslint .` เหลือ 2 errors + 85 warnings ที่มีมาก่อนแล้ว · build หน้าเกมผ่าน
- **ยังไม่ได้เปิดเกมเล่นจริงในเบราว์เซอร์** — ถ้าผู้ใช้รายงานปัญหาหลังจากนี้ ให้สงสัยงานชุดนี้ก่อน

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

## ผู้ใช้ตัดสินใจแล้ว

1. **ไฟล์สื่อของตัวที่ถูกถอด → ลบแล้ว** (498MB จาก `client/public/characters/` และสำเนาใน `client/dist/characters/` ในเครื่องผู้ใช้): arjuna, banagher, broadband_man, byleth, eva13, gambler, kotarou, kuwagata, riddhe, shotaro, shrade_elan, yuuki
   — **บน Cloudflare R2 ยังมีอยู่** (session นี้เข้าถึง R2 ไม่ได้) ถ้าผู้ใช้อยากลบที่นั่นด้วยต้องทำเองหรือให้สิทธิ์
2. **โหมด SE.RA.PH (Moon Cell) → เก็บไว้** (ยังพักใช้งานผ่าน `SUSPENDED_MODES` ใน `server/lobby.js`) — ห้ามลบโค้ดหรือไฟล์สื่อ `hakuno`/`mooncell` ที่โหมดนี้ใช้
3. **"บั๊กปุ่มยกเลิกของชิกิ" → ไม่มีจริง** session ก่อนอ่านโค้ดผิดเอง (ปุ่มเรียก `setSkSel(false)` ถูกต้องทั้ง 2 จุด)
4. **merge เข้า `main` และ push แล้ว**

## งานใหญ่ที่วางแผนไว้แต่ยังไม่เริ่ม

### A. แยก server ระดับ 2 (ผู้ใช้อนุมัติแนวทางแล้ว แต่สั่งทำแค่ระดับ 1)
- ย้ายเงื่อนไข `characterId === "..."` ในระบบกลาง (~300 จุด กระจุกใน `server/skills.js` `useSkillCore` และ `server/phases/attack.js` `doAttack`) ไปเป็น hook ใน `characters/<id>.js`
- ย้าย `server/characterRules.js` (ที่พักชั่วคราว) เข้าไฟล์ตัวละคร
- ทำทีละตัวละคร ตัวละ 1 commit และเขียนเทสต์ก่อนย้าย
- ข้อเสนอที่ยังไม่ได้คำตอบ: เพิ่มกฎ eslint `max-lines` ~1,100 สำหรับ `server/`

### B. ECHO 5.0 — แจกเกมเป็น exe (กำลังทำ — ขั้น 1 เสร็จแล้ว)
- Electron ในโฟลเดอร์ใหม่ `desktop/` แบบ **เปิดห้องเอง**: "สร้างห้อง" = fork `server.js` ด้วย `utilityProcess.fork` (ไม่ require เข้า main process — ให้ตาข่าย error/listen ใน server.js ทำงานเอง, server พังไม่ลากแอปพัง, ปิดห้อง = kill process ล้างสถานะแมตช์หมด) · "เข้าร่วม" = ใส่ IP แล้วโหลด `http://IP:3000` (หน้าเกมมาจาก host — `client/src/socket.js` ใช้ `io()` ไม่ต้องแก้)
- เพื่อนอยู่ไกลกัน → ใช้ **Radmin VPN** (IP ขึ้นต้น `26.`) — หน้าสร้างห้องหา IP นี้แล้วโชว์ปุ่มคัดลอก · จำ IP ล่าสุด · เตือนเรื่อง Windows Firewall ต้องติ๊ก Public · ดัก `EADDRINUSE` (พอร์ต 3000 ถูกใช้) แล้วบอกเป็นภาษาไทย
- exe ตัวแรก = **5.0.0** · ตัวติดตั้ง NSIS (Setup.exe ~90MB) · build ต้องข้ามไฟล์สื่อใน `client/dist` (`copyPublicDir: false`) และต้องพก `server/`, `characters/`, `characters.js`, `seraph.js` + dependency ฝั่ง server
- **เลขเวอร์ชันมีที่เดียว = `desktop/package.json`** → ส่งให้ server เป็น env `ECHO_VERSION` ตอน fork
- **ไฟล์สื่อ: ผู้ใช้เลือกแบบ (ก) โหลดครบ ~1.3GB ตอนเปิดครั้งแรก** มีแถบความคืบหน้า + โหลดต่อจากที่ค้างได้ แล้วแคชในเครื่อง
  - ดักคำขอให้ครบทั้ง 8 โฟลเดอร์ใน `R2_DIRS` ([server/app.js](../server/app.js)): characters, item, overload_force, theme_song, effect_sound, image, mooncell, journey — ไม่ใช่แค่ `/characters`
  - ต้องมี `updates/media-manifest.json` บน R2 (path + ขนาด + hash) + สคริปต์สร้างตอนออกเวอร์ชัน — ด่านที่ 2 เทียบกับไฟล์นี้
  - **ความเสี่ยง:** ส่ง mp4 จากแคชผ่าน protocol handler ต้องรองรับ header `Range` เอง ไม่งั้นคัตซีนกรอ/เล่นไม่ได้ — ลองให้ได้ตั้งแต่ต้น
- อัปเดตอัตโนมัติด้วย `electron-updater` (generic provider) · ไฟล์อัปเดต (`latest.yml`, Setup.exe, `.blockmap`) เก็บ **R2 bucket เดิม โฟลเดอร์ `updates/`** · session ของ Claude เข้า R2 ไม่ได้ → ต้องทำสคริปต์ปล่อยเวอร์ชัน (rclone/wrangler) ให้ผู้ใช้รันเอง
- ด่านตรวจ 3 ชั้นทุกครั้งที่เปิด: (1) เช็คเวอร์ชันกับ R2 — เช็คไม่ได้ = ไม่ให้เข้า มีแค่ปุ่มลองใหม่ · มีใหม่ = โหลดแล้วรีสตาร์ท (2) เช็ค/โหลดไฟล์สื่อที่เปลี่ยนตาม manifest (3) ตอนเข้าร่วม ถาม `/version` ของเครื่อง host — ต้องตรงทุกตัวเลข ไม่ตรงไม่ให้เข้า · ไม่อัปเดตกลางแมตช์
- SmartScreen: ไม่ซื้อใบรับรอง — เตรียมคำแนะนำให้เพื่อนกด More info → Run anyway (อัปเดตอัตโนมัติไม่โดนเตือนซ้ำ)
- ข้อสังเกตเล็ก: localStorage แยกตาม origin (= IP ของ host) → ค่าที่จำไว้ เช่นระดับเสียง ต้องตั้งใหม่เมื่อเข้าห้องของ host คนใหม่

**ลำดับงาน:**
1. ✅ endpoint `/version` ใน [server/app.js](../server/app.js) (ตอบ `{ version }` จาก `ECHO_VERSION`, ไม่มี = `"dev"`, `no-store` + CORS `*`) + เทสต์ `tests/version-endpoint.test.js`
2. ✅ `desktop/` โครงพื้นฐาน (Electron 44) — `main.js` (หน้าต่างเต็มจอ, IPC, เข้าร่วม+ด่านที่ 3, จำ IP ล่าสุดใน `%APPDATA%/ECHO/settings.json`), `room.js` (เช็คพอร์ต → `utilityProcess.fork` → รอ `/version`), `preload.js` (เปิด `window.echo` ให้เฉพาะหน้า `file:`), `launcher/` (หน้าแรกภาษาไทย โทนม่วง-ทอง)
   - ผู้ใช้เลือก: **เปิดมาเต็มจอ** (F11 สลับ, F10 ออกจากห้องพร้อม dialog ยืนยัน) · **เข้าห้องได้เฉพาะจาก exe** — exe ต่อท้าย user agent ด้วย `ECHO-Desktop/<เวอร์ชัน>` และ `server/app.js` ปฏิเสธ HTTP (403) + socket (`desktop-only`) ที่ไม่มี token เวอร์ชันเดียวกัน เมื่อรันด้วย `ECHO_VERSION` (`/version` ถามได้เสมอ)
   - รัน dev: `cd desktop && npm install && npm start` (`start.js` ล้าง `ELECTRON_RUN_AS_NODE` ที่เทอร์มินัลของ VS Code/Claude ตั้งค้างไว้) · `ECHO_WINDOWED=1` = ไม่เต็มจอ · `ECHO_ASSET_BASE_URL` = ส่งต่อเป็น `ASSET_BASE_URL` ให้ server ของห้อง (ตอน dev ไม่ตั้งก็ได้ ใช้สื่อใน `client/dist`)
   - ทดสอบแล้วด้วยการขับแอปผ่าน `--remote-debugging-port` (CDP): สร้างห้อง, เข้าห้องตัวเอง, เบราว์เซอร์ธรรมดาได้ 403, หน้าเกมไม่มี `window.echo`, ปิดแอปแล้ว server ปิดตาม, เข้าร่วมด้วย IP ผิดรูปแบบ/ไม่มีห้อง ขึ้นข้อความถูก · **ยังไม่ได้ทดสอบ:** dialog ของ F10 (กดจริง), เล่นข้าม 2 เครื่องผ่าน Radmin
   - หน้า splash ของเกมยังเขียน "เวอร์ชัน 4.0" — ต้องถามผู้ใช้ก่อนออก 5.0.0 ว่าจะเปลี่ยนไหม
3. ✅ แคชไฟล์สื่อ — `desktop/media.js` + `desktop/config.js` (R2 public URL) + `server/mediaDirs.js` (รายชื่อ 8 โฟลเดอร์ ใช้ร่วม server/desktop)
   - manifest: `cd desktop && npm run media-manifest` → `desktop/dist/updates/media-manifest.json` (682 ไฟล์ 1.12GB ณ 2026-10-01 · ข้าม .txt/.md) · เช็คแล้วขนาดไฟล์บน R2 ตรงกับ `client/public` ครบทุกไฟล์ · **ยังไม่ได้อัปขึ้น R2** (ขั้นที่ 4)
   - แคชอยู่ `%APPDATA%/ECHO/media/` + `index.json` · โหลดขนาน 6 ไฟล์ ตรวจ sha256 ลองซ้ำ 3 ครั้ง เช็คพื้นที่ดิสก์ ลบไฟล์ที่ถูกถอด · โหลดค้างแล้วเปิดใหม่ = ต่อจากไฟล์ที่ยังไม่เสร็จ
   - ตอบไฟล์สื่อด้วย `protocol.handle("http")` ที่ **origin เดิมของหน้าเกม** (ไม่ redirect) เพราะโหมด ORT ใช้ `getImageData` กับรูป `/characters/ort/*` — ข้าม origin แล้ว canvas โดน taint (**บนเว็บที่ redirect ไป R2 น่าจะพังอยู่แล้ว ยังไม่ได้ยืนยัน**) · header `X-Echo-Media: cache|local` · ไม่มีในแคช → (dev: `client/public`) → R2
   - dev: ไม่ตั้ง `ECHO_MEDIA_MANIFEST` = ข้ามการโหลด ใช้ `client/public` ตรงๆ · exe ใช้ manifest บน R2 เสมอ โหลด manifest ไม่ได้ = เข้าหน้าแรกไม่ได้ (มีปุ่มลองใหม่)
   - ทดสอบในแอปจริงด้วย manifest ย่อย 7 ไฟล์จาก R2 จริง: โหลดครบ, ชื่อไฟล์ไทย+เว้นวรรค, Range 206, กรอวิดีโอ (readyState 4), canvas อ่านพิกเซลได้, socket.io ผ่าน, เปิดรอบสองไม่โหลดซ้ำ · เทสต์ `tests/desktop-media.test.js` · **ยังไม่ได้ลองโหลดเต็ม 1.1GB**
4. electron-updater + ด่านที่ 1 + สคริปต์ปล่อยเวอร์ชัน
5. build 5.0.0 แล้วลองเล่นจริง 2 เครื่องผ่าน Radmin

## ปัญหาที่มีมาก่อน (ไม่ใช่จากงานนี้)
- eslint 2 errors: `tests/characters/escanor.test.js` บรรทัด ~722 (`no-control-regex` จาก `\x08`)
- vite เตือน chunk ใหญ่กว่า 500 kB

## เคล็ดลับเครื่องมือ (เครื่องนี้ Windows + Git Bash)
- **Bash tool ยุบ `\\` เป็น `\` ทั้งใน heredoc และ `node -e '...'`** — regex ที่มี backslash ให้เขียนเป็นไฟล์ .js ใน scratchpad แล้วค่อยรัน (เคยทำให้ Game.jsx เสียหายมาแล้ว ต้อง restore)
- ไฟล์ปน LF/CRLF (`add-character/SKILL.md`, `VictoryScreen.jsx` เป็น CRLF) — สคริปต์แทนข้อความต้อง normalize ก่อนเทียบ
- build หน้าเกมโดยไม่ copy ไฟล์สื่อ 1.8GB: ใน `client/` รัน
  `node --input-type=module -e "import { build } from 'vite'; await build({ build: { outDir: '<scratch>', emptyOutDir: true, copyPublicDir: false } })"`
- เช็คชุดเต็ม: `npm test` · `npx eslint .` · build ด้านบน
