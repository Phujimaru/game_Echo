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
4. ✅ electron-updater + ด่านที่ 1 + build exe + สคริปต์ปล่อยเวอร์ชัน — คู่มือเต็มอยู่ [desktop/README.md](../desktop/README.md) (มีข้อความส่งให้เพื่อนด้วย)
   - `updater.js`: generic provider `R2/updates/` · `allowDowngrade` = เวอร์ชันบน R2 เป็นตัวตัดสิน (ถอยเวอร์ชันได้) · ตรวจไม่ได้ = ไม่ให้เข้า · มีใหม่ = โหลด → "กำลังเปิดโปรแกรมใหม่" 1.5 วิ → `quitAndInstall(silent)`
   - `npm run dist` = `scripts/stage-game.js` (โค้ดเกม 10MB → `desktop/build/game`, `npm ci --omit=dev`, build client ไม่ copy สื่อ) + electron-builder NSIS oneClick ต่อผู้ใช้ → `desktop/dist/ECHO-Setup-<ver>.exe` (~109MB)
   - **กับดัก:** electron-builder ข้าม `node_modules` ใน extraResources → ต้องมีรายการแยก `build/game/node_modules` (มีแล้วใน package.json) · build แบบ `--dir` ไม่สร้าง `resources/app-update.yml` (อัปเดตจะพัง ENOENT) — ทดสอบอัปเดตต้องใช้ build เต็ม
   - ทดสอบ exe ที่ build แล้วผ่าน CDP: ตรวจเวอร์ชันไม่ได้ → ค้างที่ด่าน 1, เวอร์ชันตรง → ผ่านทุกด่าน สร้างห้อง เข้าเกม (สื่อนอกแคช → R2), มี 5.0.1 → โหลดครบถึง "กำลังเปิดโปรแกรมใหม่" (ฆ่าแอปก่อนติดตั้งจริง)
   - `npm run release` (`scripts/release.js`): กุญแจ R2 อ่านจาก `.env` ราก repo (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`) · ห้ามปล่อยเลขเวอร์ชันซ้ำ · `--dry-run` / `--skip-build` / `--prune` · dry-run ล่าสุด: สื่อบน R2 ครบ ไม่ต้องอัปเพิ่ม
   - **r2.dev จำกัดความถี่ (HTTP 429)** — ตัวโหลดสื่อ (ขนาน 4, ลองซ้ำ 5 ครั้งพร้อมรอ) และสคริปต์ release รอแล้วลองใหม่ให้แล้ว · ถ้าเพื่อนหลายคนโหลดพร้อมกันแล้วช้า/ล้ม ทางแก้จริงคือผูก custom domain กับ bucket — **ผู้ใช้ไม่มีโดเมน ตัดสินใจใช้ r2.dev ไปก่อน** (2026-10-01) อย่าเสนอซ้ำ เว้นแต่มีปัญหาโหลดจริง
   - ยังไม่มีไอคอนโปรแกรม (ใช้ไอคอน Electron) — รอผู้ใช้ส่งรูป
   - ✅ **ปล่อย 5.0.0 ขึ้น R2 แล้ว** (2026-10-01) bucket `echo-characters` · กุญแจอยู่ใน `.env` (ผู้ใช้เลือกใช้ชุดเดิม) · ลิงก์ตัวติดตั้ง `https://pub-246229b6130d42e19ea95765c029663e.r2.dev/updates/ECHO-Setup-5.0.0.exe`
   - ✅ ลบไฟล์สื่อเก่าบน R2 แล้ว 154 ไฟล์ (620MB: ตัวละครที่ถูกถอดรวม musashi + ไฟล์ไม่ได้ใช้) ด้วย `npm run release -- --prune-only` · โฟลเดอร์ `_backup_audio/` `_backup_video/` ใน bucket ไม่ได้แตะ
5. build 5.0.0 แล้วลองเล่นจริง 2 เครื่องผ่าน Radmin — **ยังไม่ได้ทำ** (ผู้ใช้จะลองเอง)

### ถอนการติดตั้งแล้วลบไฟล์เกมด้วย (✅ ปล่อยเป็น 5.0.1 แล้ว 2026-10-01)
ผู้ใช้สั่ง: ถอนการติดตั้ง = ลบไฟล์เกมที่โหลดมาด้วย **แต่ห้ามลบอะไรนอกโฟลเดอร์ของเกมเด็ดขาด** (กลัวแบบข่าว uninstaller ลบทั้งไดรฟ์)
- ไฟล์: `desktop/installer.nsh` + `desktop/package.json` (`nsis.deleteAppDataOnUninstall: true`, `nsis.include: "installer.nsh"`) · ✅ `npm run release` 5.0.1 ขึ้น R2 แล้ว (latest.yml = 5.0.1 · ลิงก์ติดตั้งใหม่ `updates/ECHO-Setup-5.0.1.exe`)
- macro `customUnInstall` ทำงาน**ก่อน** electron-builder ลบไฟล์ (`templates/nsis/uninstaller.nsh`) → Abort = ไม่มีอะไรถูกลบ · ด่าน: `$INSTDIR` ต้องลงท้าย `\echo-desktop` และ (เฉพาะถอนจริง ไม่ใช่อัปเดต) ต้องมี `ECHO.exe` · ตอนอัปเดตไม่บังคับ `ECHO.exe` เพราะถ้า Abort ตอนอัปเดต ตัวติดตั้งจะวนลอง 5 รอบแล้วล้ม
- **`$INSTDIR` ของตัวถอนมาจาก registry** `HKCU\Software\4e959771-d971-5c37-9ea6-6ef8e009d21b` ค่า `InstallLocation` (`multiUser.nsh`) ไม่ใช่ `_?=` — ทดสอบด่านต้องแก้ค่านี้ ไม่ใช่ก๊อปตัวถอนไปที่อื่น
- ผลทดสอบเก่าที่ว่า "macro ไม่ทำงาน" ผิด — build debug ยืนยันว่า macro รัน + `DELETE_APP_DATA_ON_UNINSTALL` ถูก define
- ทดสอบผ่านทั้งหมด (`/S`): ถอนจริง → โปรแกรม/`%APPDATA%\ECHO`/updater/ทางลัด/registry หาย โฟลเดอร์ข้างเคียงชื่อคล้ายกันยังอยู่ · ติดตั้งตัวเก่าจาก R2 แล้วติดตั้งตัวใหม่ทับ (กรณีเพื่อน) → ไฟล์เกมยังอยู่ ตัวถอนถูกเปลี่ยนเป็นรุ่นใหม่ · ติดตั้งตัวใหม่ทับตัวใหม่ → ไฟล์เกมยังอยู่ · `InstallLocation` ชี้โฟลเดอร์ชื่ออื่น หรือชี้ `...\echo-desktop` ที่ไม่มี `ECHO.exe` → ยกเลิก ไม่มีอะไรหายเลย
- เพื่อนที่ใช้ 5.0.0 ไม่ต้องติดตั้งใหม่ — อัปเดตอัตโนมัติเป็น 5.0.1 แล้วได้ตัวถอนใหม่ (ถ้าถอนก่อนได้อัปเดต `%APPDATA%\ECHO` จะค้าง ต้องลบเอง)
- **เขียน .nsh ด้วยเครื่องมือ Write เท่านั้น** — ผ่าน Bash/Python heredoc แล้ว `$\r$\n` / backslash เพี้ยน · ตัวติดตั้งเปิดแอปเองหลังติดตั้ง (แม้ `/S`) ปิดด้วย `taskkill //F //IM ECHO.exe //T` · ทดสอบในเครื่องผู้ใช้ให้ย้าย `%APPDATA%\ECHO` (1.2GB ของจริง) ไปสำรองก่อน

### C. ECHO 5.1 — ธีม ORDEAL CALL (แทน Avalon) · branch `feat/ordeal-call` (2026-10-01)
✅ **5.1.14** (2026-10-02): **Purge แบบทอยเต๋า** — ทอย 1-6 ทุกเทิร์น · ตกช่องเดียวกัน = ปะทะทีละจุดในสนามประลองของภูมิภาค (คนอื่นเป็นผู้ชม) ผู้แพ้ถอย 2 · ท่อ 80 ช่อง · ORT โผล่จบเทิร์น 5 เดิน 4/เทิร์น · ถึงประตูผนึกก่อนชนะ · ฉากเปิดใหม่ (เส้นพุ่งออกโลก→ทางช้างเผือก→ไถลจากปลายท่อมาจุดเกิด ORT) · ระเบิดตอน ORT กลืน · รอยแยกจุดเกิด ORT · กลางวัน/คืน (GAME_SYSTEM.md §11.2)
✅ **5.1.15** (2026-10-02): **Purge v3** — กระดาน 150 ช่อง มีทางแยกภูมิภาคละจุด (ทางลัด/อ้อม/ลับ) + ช่องกิจกรรม · ทุกคนกดทอยพร้อมกัน ต่างคนต่างเดิน (เฟส PURGE_ROLL) · ไอเทมกระดาน 6 แบบใช้ก่อนทอย · เหรียญ +2 ทุกเทิร์น · ORT ทอย d6 ให้ทุกคนเห็น · ปะทะ 2 รอบ · เข้าเส้นชัยเป็นอันดับ · กล้องตามหมาก/ฉาก ORT ระดับพื้น · ฉากเปิดพุ่งเข้าทางช้างเผือก 3D · แก้จอฟ้า (dt ติดลบ) (GAME_SYSTEM.md §11.2)
✅ **5.1.27** (2026-10-05): แก้ Echo — ท่าไม้ตาย/สนาม/เพลงทำงานเองก่อนเทิร์น 1 (ตัวนับรอบเทียบ 0 >= 0) · ระหว่างสนามราชินี: การ์ด Echo → แถบเลือดบอสเหนือหัว (`EchoBossBar`) · ตัวราชินีต่ำลง · การ์ดคนอื่นย้ายสองข้างจอ (`echoSideSlots`) · กองไพ่เป็นลิ้นชักขวา · ตีฟรีกดการ์ดศัตรูได้ทันที (`targetChain.echoFreeIds`)
✅ **5.1.26** (2026-10-05): **ตัวละครใหม่ Echo** (พิเศษ · unique · `characters/echo_queen.js` · สื่อ `characters/echo_queen/` ภาพวาดมือของผู้ใช้) ขยายร่าง 0-10 (เลือดสูงสุด 30) / มหึมา / Overwrite / ท่าไม้ตาย "นี่มันเกมของฉัน" ฟื้น 5 + ตีฟรีทุกเฟสจั่ว 5 เทิร์น (`server/phases/echoFreeHit.js` — เฟสโจมตีย่อย) · ฉากเปิดตัว canvas 12 วิ (คัตซีน kind `echoQueen` พักเกม 13 วิ) + สนามราชินีหลังการ์ดผู้เล่น + กำปั้น/โดนตี/ฉากออก (`client/src/echoQueen/`) · เพลง `echo_queen_theme` บนสุดของลำดับเพลง · `lastAttack` มี `byId`/`targetId` แล้ว · หน้า dev `?hud=1&game=1&echo=1` · แผน+ต้นแบบ [.claude/plans/echo-queen-plan.md](plans/echo-queen-plan.md) · **ยังไม่ได้ลองเล่นจริงหลายคน · ภาพสกิลยังไม่มี (ผู้ใช้ทำทีหลัง)**
✅ **5.1.25** (2026-10-03): **ตัวละครใหม่ นักบินปริศนา** (ง่าย · unique · `characters/sliver_bullet.js` · สื่อ `characters/sliver_bullet/`) ซ่อนตัวสิงร่างสุ่ม (อิสระ ≥3 คน / trio เพื่อน 2 คน) — `combat.alivePlayers()` ไม่นับนักบินที่ซ่อน ส่วน `combat.livingPlayers()` นับ · ศัตรูไม่ได้รับตัวเขาใน buildStateFor · `sfx`/`notifyTransform` รับ onlyFor แล้ว · ข้อจำกัด: วีดีโอสกิลพื้นฐานครั้งแรกตอนซ่อนยังทำให้เกมหยุดรอ (เป็นเบาะแส) · ที่นั่งศัตรูขยับตอนนักบินซ่อน/โผล่ · Dio/Johnny รื้อรอบ 2 (สุ่มคลิป, เลือกเป้ารายหมัด, Action ใหม่ · กระสุนตีปกติ 50% หมุนวน, Rapid 3 นัด, Snipe/Lesson ก่อนเปิดไพ่) · **ยังไม่ได้ลองเล่นจริง**
✅ **5.1.24** (2026-10-03): คอเซ็ตต์ใช้เสียงตีปกติ `destiny/destiny_hit.mp3` ทุกร่าง (`attackSoundOf` · gain 0.71)
✅ **5.1.23** (2026-10-03): **ตัวละครใหม่ 2 ตัว** — ดิโอ บรันโด (กลาง · `characters/dio.js` · สื่อ `characters/dio_brando/` — ชื่อนี้เพราะ `Dio`/`dio` ชนกันบน Windows) Time Meter / Vampire กลางวัน-คืน / Last stand ดวลจั่ว 1 รอบ / Za warudo -> THE WORLD 10 วิ (socket `dioKnifeAim`) · จอนนี่ โจสตาร์ (ยาก · `characters/johnny.js` · สื่อ `characters/johnny/`) Tusk Act 1-4 / กระสุนเล็บ / Spin / หมุนวน (ย้อนสกิล-ไอเทม) / Chumimi / Lesson Five · Destiny: ได้บทเพลง = ร่างพรมลิขิตอัตโนมัติ ล็อกจนบทเพลงหมด (`onSongGained`) · วีดีโอท่าไม้ตายแอนเดอร์เซน/ไรเนส/อาร์โทเรีย ครั้งแรกต่อเกม · ไฟล์สื่อต้นฉบับย้ายไป `C:\backjact_media_originals\` (ไม่ขึ้น R2) · **ยังไม่ได้ลองเล่นจริง — ผู้ใช้ให้เพื่อนลอง**
✅ **5.1.22** (2026-10-03): คลิปบทเพลงพัง 1 คลิปต่อจังหวะ (`takt.playLowVideo` — ต่างแบบ = ไททัน) · เพลงทักต์เป็น `takt_theme_first.m4a` -> วน `takt_theme_loop.m4a` (`MUSIC_SEQUENCES` ใน audio.js · เริ่ม first ใหม่เมื่อบทเพลงดับหมดแล้วมอบใหม่)
✅ **5.1.21** (2026-10-03): เปิดม่าน = คำสั่งบรรเลงรายคู่พันธะ (คูลดาวน์แยกคน · ใช้ได้ตั้งแต่คู่พันธะคนเดียว · คลิปเปิดม่านเฉพาะไททัน+คอเซ็ตต์) รวมเป็นหน้าต่างเดียวกับพันธะ · ทักต์เลือกซ้ำได้ (พันธะแยกตาม id) · Destiny สูบเลือดทักต์ 2 ตอนยิงโดน (กดได้เมื่อทักต์เลือด 2+) · บทเพลงหมดเวลาล้าง Destiny/Maestro ที่ค้าง · คลิป low ของคอเซ็ตต์/ไททันเล่นทุกครั้ง (`takt_titan_low.mp4` ใหม่) · Maestro ไม่มีวีดีโอ
✅ **5.1.20** (2026-10-03): เพลง `takt/takt_theme.mp3` เล่นตลอดที่มีมิวสิคคาร์ทมีบทเพลง (`takt.activeMusic` — ได้เพิ่มอีกคนไม่เริ่มใหม่ จนกว่าจะดับหมด)
✅ **5.1.19** (2026-10-03): **ตัวละครใหม่ คอเซ็ตต์ ชไนเดอร์** (กลาง · มิวสิคคาร์ทตัวที่ 2 · `characters/cosette.js` · ไฟล์สื่อ `characters/destiny/` + `takt/destiny/`) · ทักต์: บทเพลงพังเมื่อเลือดเหลือ 1/ตาย (มิวสิคคาร์ททุกคนเสียบทเพลง + สตั้น 2) · สกิลติดตัว 3 เปิดม่าน (ไททัน+คอเซ็ตต์ -> ปุ่มบรรเลง 2 คำสั่ง · ทักต์/คู่พันธะติดสตั้นสั่งไม่ได้) · วีดีโอใหม่แปลงมาตรฐานสตรีม + เร่งเสียงคลิปที่เบา (ต้นฉบับสำรองใน scratchpad ของ session) · **ยังไม่ได้ลองเล่นจริง**
✅ **5.1.18** (2026-10-03): บาลานซ์ไททัน/ทักต์ — คล่องตัวสูงหลบหลีก 1 · มิวสิคคาร์ทไม่ดูดเลือดแล้ว · ช็อตกันฟื้น 1 ทุกหมัด + ชุดเดี่ยว 50% ได้ตีครั้งที่ 2 · ทักต์คูลดาวน์สกิลพื้นฐาน 3 · ตระกูลอาซาฮินะไม่รับดาเมจแพ้รอบทั้งหมด + หลบ 15% (ตีปกติ/สกิล ไม่หลบปืน · มีพันธะใช้ 35% สำหรับตีปกติ) · ป้ายหลบหลีกแก้เป็น "อยู่ได้ 2 เทิร์น"
✅ **5.1.17** (2026-10-02): **ตัวละครใหม่ 2 ตัว** — อาซาฮินะ ทักต์ (พิเศษ · unique · `characters/takt.js`) + ไททัน (ง่าย · มิวสิคคาร์ท · `characters/titan.js`) · ระบบพันธะสัญญาเป็นของกลางของมิวสิคคาร์ท (`takt.MUSIC_CARTS` — โฟลเดอร์ `takt/destiny/` เตรียมไว้สำหรับมิวสิคคาร์ทตัวถัดไป) · พันธะ = พวกเดียวกันในโหมดอิสระ (sameTeam/isAlly) ชนะพร้อมกัน · GAME_SYSTEM.md §6 · วีดีโอใหม่แปลงเป็นมาตรฐานสตรีมแล้ว (ต้นฉบับสำรองใน scratchpad ของ session) · **ยังไม่ได้ลองเล่นจริงในเบราว์เซอร์**
✅ **5.1.16** (2026-10-02): Purge — เพลงด่าน/เพลง ORT ไม่เริ่มใหม่ทุกเทิร์น (PURGE_ROLL นับเป็นในแมตช์: `isMatchPhase`) · ผู้เล่นคุมกล้องเอง (ลากหมุน/ล้อซูม/ลากขวาเลื่อน/ดับเบิลคลิกคืนค่า, กันกล้องออกนอกราง) · เลนส์กว้างขึ้น · คลิกรายชื่อเพื่อตามดู (ดูต่อหลังโดนกิน) · แผงบันทึกสไลด์ด้านขวา (ประวัติทั้งเกม) · ORT ใหญ่ขึ้น
✅ **5.1.13** (2026-10-02): Purge — ORT โผล่จบเทิร์น 10 แล้วเดิน 1 ช่องทุก 2 เทิร์น (`PURGE_ORT_EVERY`) · ตัวหมาก ORT ใช้รูป `ort_body.jpg`
✅ **5.1.12** (2026-10-02): **โหมดใหม่ Purge** (หนี ORT ในอุโมงค์ท่อ — GAME_SYSTEM.md §11.2 · `server/modes/purge.js` · `client/src/purge/`) ชนะเดิน 1 ช่อง · ล้มลงถอย 2 · ORT โผล่จบเทิร์น 5 · ฉาก three.js ท่อครึ่งทรงกระบอก 2.5D · เพลงด่าน 4 เพลงใน R2 `purge/` · ต้นแบบ canvas https://claude.ai/artifact/DJuy1VbBhPENAY49CRZqEX · ยังไม่ทำ: ผลพิเศษของภูมิภาค
✅ **5.1.12** (2026-10-02): **แก้จอกระพริบ** — พื้นสนามอบเป็น canvas เดียว (`arena/bakePlane.js`, BAKE_CACHE) · เลิก backdrop-filter ทั้งเกม · เลิกพารัลแลกซ์/fore sway/filter ที่ขยับ · `VeilTail` กันจอขาวแวบระหว่างสรุปผล↔โจมตี · คัตซีนวางทับกระดาน (`cutsceneEl`) ไม่ unmount · `.ort-veil` เฉพาะเฟส 0 · ถอด DiveSky หลังพุ่งลง 5.6 วิ · delay การ์ดหล่นคิดครั้งเดียวต่อ landSeq · ค้าง: globeCore ไม่ forceContextLoss (WebGL context สะสม) · กฎ: ดู memory quality-over-flash
✅ **5.1.11** (2026-10-02): แต้มสกิล/ทรัพยากรต่อชิดใต้แผงตัวละครเป็นแท่งเดียว (`.hud-prof-stack`) · การ์ดคู่แข่งขยายตามจอเท่า HUD (`arenaCardZoom(W,H)`, ACS 0.9) · ล็อกเป้าใหม่ (`TargetLock` นอก clip-path ของการ์ด + `HexLock` + `.pc-targetable`, CSS `.tl-*` ท้าย index.css · มือถือใช้ `TargetLockLegacy`)
✅ **5.1.10** (2026-10-02): HUD สุดท้าย = แผงตัวละครหกเหลี่ยม (E1) + แผงแต้มสกิลแยกชิดใต้ + ตราสกิลหกเหลี่ยม (S2) + ปุ่มกระเป๋ารูปอย่างเดียว/ร้านค้ามีไอคอน + UI ขยายตามจอ (z = clamp(min(h/810, w/1376), 0.6, 1.6)) + การ์ดคู่แข่งหกเหลี่ยมใหญ่ขึ้น (`arenaCardZoom`, `cardX` กันล้นจอ, วงที่นั่งหดตามจอแคบ) · ดีไซน์ทั้งหมดใน canvas หน้า "การ์ดโปรไฟล์" ·  **สนามครบ 7 ภูมิภาค** (`journey/arena/areas/area4-7.js` + `art4-7.jsx` + css · registry `areas/index.js` · ตัวช่วยร่วม `arenaKit.js`) · **จอกระพริบ**: คัตซีนแทนกระดานทั้งจอ → สนาม mount ใหม่แล้วพุ่งลงซ้ำ (ม่านขาว) — `arenaLandBus` จำภูมิภาคล่าสุด (`shouldLandOnMount`, `arenaLandDelay`, Game อ่าน seq ด้วย `useSyncExternalStore`) + เลิก filter ต่อชิ้น · ฉากพุ่งลง ~5 วิ (เกลียวมองตรงลง → เอียง → คลื่นกระแทก) และรอสัญญาณ `requestArenaLand` จาก RegionTravel ตอนเปลี่ยนภูมิภาค · การ์ดหลบกองไพ่กลาง (`stackCards` นับกองไพ่) · **HUD ตัวเราใหม่** `screens/hud/SelfHud.jsx` (+HudTopBar, สถานะแนวตั้งเลื่อนลง, preview dev `?hud=1` / `?hud=1&game=1`) — แผงเลื่อนลงตอนเลือกเป้า (รายการ state ใน `pickingTarget`, ไม่รวม bardPending) / ตอนเราโจมตี (`hudAway`)
✅ **5.1.9** (2026-10-02): สนาม 2.5D เปลี่ยนเป็น**กล้องก้ม 30°** (ผู้ใช้: 55° ดูแบนเหมือน 2D) — `arenaCamera` e30 p1300 R590 + `oy` (perspective-origin ใต้จอ = shift lens เห็นเส้นขอบฟ้า) · แนวเนินไกลปิดขอบพื้น · การ์ดผู้เล่นไม่ทับกัน: `stackCards` ยืดเส้นแสงที่นั่งไกลให้การ์ดลอยพ้นใบใกล้ (`bottom`/`stem`) · **ฉากพุ่งลงจากฟ้า** (`DiveSky` + `arLandPlane` ~3.4 วิ หลัง mount ใต้แฟลช: ฟ้า+เมฆแตก+เส้นความเร็ว → ซูมมองตรงลง → เอียงกล้อง → ป๊อปอัป → การ์ด/กองไพ่หล่นลงที่นั่ง `arSeatIn`, `ARENA_SEAT_IN_S`)
✅ **5.1.8** (2026-10-02): **สนามประลอง 2.5D ภูมิภาค I–III** (`client/src/journey/arena/`) — มุมกล้องเฉียง 55° (ผู้ใช้เลือก) · พื้น CSS perspective+rotateX · ของตั้งเป็นป้ายหันหน้ากล้อง วางด้วยสูตร `proj` เดียวกับพื้น (`arenaData.js`) · ความลึก: ยกพื้นเป็นชั้น (`cyl`), ของไกลเบลอ/จาง, ของบังหน้ากล้อง, พารัลแลกซ์ (ชั้นพื้นไม่แกว่ง เพราะการ์ดผู้เล่นต้องตรงฐานที่นั่ง) · ร่อนลงตอนเข้าภูมิภาค (`.ar-land`) · ที่นั่ง: คนอื่นครึ่งวงด้านไกล เราใกล้กล้อง — `arenaLayout` ให้ทั้ง Game.jsx (การ์ด slot[3]="bottom", กองไพ่บนแท่นกลาง) และฉากหลัง · ภูมิภาค IV–VII ยังใช้ JourneyBackdrop เดิม · ต้นแบบดีไซน์ใน canvas https://claude.ai/artifact/J3mAm1EbTqtK8wmYbhh47s · หน้าดู dev: `?arena=1..3&n=0..6&night=1&lowq=1`
✅ **5.1.7** (2026-10-02): ฉากเปลี่ยนภูมิภาค — เส้นทางที่เดินมาแล้ว (I → … → ต้นทาง) ค้างบนโลก + จุดตรงภูมิภาคที่ผ่าน แล้วค่อยลากเส้นช่วงใหม่ (`RegionTravel.jsx`)
✅ **5.1.6** (2026-10-02): ฉากเปิดแมตช์ไม่ตัดหลังโหวตโหมด (ลูกโลกร่วมลูกเดิม, `oc/intro/screenGhost.js` จางหน้าเลือกโหมด, การ์ดโคจรรอบโลก)
✅ **5.1.5** (2026-10-02): การ์ดรายละเอียดตัวละครแขวนบนเส้นโคจรรอบภาพหกเหลี่ยม (`layoutArc`, `ARC_OFF` ต้องตรง `--cs-arc-off`) · `oc/intro/MatchIntro.jsx` = เปิดตัวผู้เล่นรอบลูกโลก + ดิ่ง (canvas เดียว, App: state `intro`, `startPendingJourney()` คืน `{area,durationMs}`, `onHandoff`) · `RegionTravel.jsx` = เปลี่ยนภูมิภาค (ซูมออก → เส้นเดินทาง → ชื่อ → ดิ่งกลับ) · ลบ GameIntro / GlobeDive / JourneyMap / MapArt / mapGeometry / Emblem + เพลง journey_map
📋 **แผนรอทำ (อีก session):** เข้าฉากด่านให้ลื่น ไม่ตัดฉับหลังฉากดิ่ง → [.claude/plans/scene-loading-plan.md](plans/scene-loading-plan.md)
✅ **5.1.4** (2026-10-02): ลบหมวด "ทักษิณ…" (นานายะ/เจ้าหญิงชิกิ → calamity) · การ์ดบนวงเป็นหกเหลี่ยม (`charRings.js`, กดได้เฉพาะในหกเหลี่ยม) · การ์ดข้อมูลขนาดคงที่ 384px · ทรานซิชันเลือกตัว→ห้องรอ: `oc/heroHandoff.js` (ส่ง) + `oc/lobby/heroArrival.js` (รับ, FLIP ลงตราหกเหลี่ยม) · หน้าโหมด: หมุดอิสระอยู่กลาง ไม่หมุนเอง · ย้อนกลับทีละขั้น: socket ใหม่ `modeBackToLobby` (`lobby.modeSelectBackToLobby`, เทสต์ `tests/pregame-back.test.js`) · จัดทีม: เหลือปุ่มย้อนกลับซ้ายล่าง (ตัด "เปลี่ยนโหมด") · เทสต์ล้มแบบสุ่ม 1 ครั้ง (รันซ้ำ 3 รอบผ่าน) — น่าจะพอร์ตชน ถ้าเจอซ้ำให้ดู
✅ **5.1.3** (2026-10-02): ห้องรอ — สวิตช์ขวาบนลงมาใต้ปุ่มเสียง/เมนู · เลือกโหมด — ไม่เลือกให้ก่อน, กดหมุด=ซูม+แผง, กดที่ว่าง/Esc=ถอย, ไม่มีอีโมต, ป้ายหมุดแค่ชื่อและกรอบต่างกันทุกโหมด, ย้อนกลับซ้ายล่าง · เลือกตัว — ตัวกรองเป็นปุ่มแยกไม่มีตัวเลข ซ่อนตอนเลือกตัว, โลกใหญ่ขึ้น, ยืนยันขวาล่าง, รูปโหลดล่วงหน้าตั้งแต่หน้าเลือกลำดับ (`oc/charselect/portraits.js` createImageBitmap ทีละ 2) + เส้นวงวาดตัวเองก่อนการ์ดโผล่
✅ **5.1.2** (2026-10-01): **ลูกโลกร่วม** `globe/SharedGlobe.jsx` — App วาง canvas เดียวช่วง setup/character/connecting/lobby, `GlobeCanvas` ยืมโลกร่วม (div โปร่งใสรับเมาส์ผ่าน `core.setEventTarget`, `scopeCore` เก็บกวาดของ 3D/listener ตอนออกหน้า) ใช้แทนม่าน (`GLOBE_SCREENS` ใน TransitionCurtain) · เสียงคลิกทุกการกด (`installClickSound` ใน audio.js) · เมนูข้างปุ่มเสียง = ออกจากห้อง/ออกกลางเกม (`window.echoApp` ใน preload เฉพาะหน้าเกม) · launcher: แถบโหลดจาง, ปุ่มเสียง+เมนู, ส่ง `vol` ใน hash · เลือกลำดับ: ไม่มีลูกศร, กดที่ว่าง/Esc = คืนที่นั่ง (`reserve {position:null}`) · เลือกตัว: แผงขึ้นเมื่อเลือก, การ์ดบินออกจากวง, ตัวกรองหมวดใหม่ (มีแถว "ทั้งหมด") · ห้องรอใหม่: ที่นั่งเรียงรอบโลก ปุ่มพร้อมขวาล่าง · เล่นคนเดียวผ่านหน้าเลือกโหมด (`startSoloTest`, ffa เล่น 1 คนได้)
✅ **5.1.1** (2026-10-01): แก้พื้นเทาตอนหน้าเกมโหลด (body + `<html style>`) · แผงเลือกโหมดหลุดไปมุมซ้ายบน = ลำดับ CSS (`main.jsx` ต้อง import `oc/theme.css` ก่อน App) · กดหมุดโหมด = ดูเฉยๆ โหวตที่ปุ่ม · เลือกตัวละคร: ไม่เลือกให้ก่อน, วงโคจรแบบอะตอม, กดหมวด/การ์ด = ซูมเหลือวงเดียว, กดที่ว่าง/Esc/ปุ่ม = ถอยกลับ · ซาโทรุหมวดง่าย ลบหมวดยากสุดขีด · lobby5 เริ่มตั้งแต่หน้าเลือกลำดับ · หน้าเลือกลำดับ: โลกใหญ่ก่อน เลือกที่นั่งแล้วค่อยมีแผง
✅ **ปล่อย 5.1.0 ขึ้น R2 แล้ว** (2026-10-01, build จาก branch นี้ — ยังไม่ merge เข้า main) · ลิงก์ติดตั้ง `updates/ECHO-Setup-5.1.0.exe` · อัปเพลงใหม่ 2 ไฟล์แล้ว
ต้นแบบที่ผู้ใช้อนุมัติ: artifact `https://claude.ai/artifact/Tj8U5YdrUD6XGPeUJxqwcV` · ขาวเด่น ฟ้าแซม ม่วง ECHO เป็นสีเน้น · ในเกมแผงน้ำเงินเข้ม
- **ของกลาง:** `client/src/globe/globeCore.js` (ลูกโลก three.js ใช้ทุกหน้า + launcher ผ่าน iife) · `GlobeCanvas.jsx` · `client/src/oc/theme.css` (โทเคน `--oc-*`) · `oc/ui.jsx`
  - three r186 = แสงแบบ physical + sRGB — ค่าแสงจูนแล้ว · ShaderMaterial ต้อง `#include <colorspace_fragment>` ไม่งั้นสีเข้มเพี้ยน
- **flow ใหม่:** launcher (เปิดโปรแกรม → แตะเพื่อเริ่ม → หน้าแรก → สร้างห้อง/เข้าร่วม) → เกมเริ่มที่ "เลือกลำดับผู้เล่น" (ลบ Splash ในเกมแล้ว) → เลือกตัวละคร (การ์ดโคจรรอบโลก หมวดละวง) → ห้องรอ (โลกกลาง + อีโมต) → เลือกโหมดบนโลก → จัดทีม → `oc/intro/MatchIntro.jsx` (5.1.6: ใช้**ลูกโลกร่วม**ต่อจากหน้าเลือกโหมด — "gameintro" อยู่ใน `GLOBE_SCREENS`, ระหว่างฉากไม่ render `<Game>` · การ์ดผู้เล่นไหลเข้าโคจรรอบโลก → ไหลออก → ดิ่ง · `<Game>` mount ครั้งเดียวที่จังหวะชนใต้แฟลช) → กระดาน · เปลี่ยนภูมิภาค = `RegionTravel.jsx` (ลบ JourneyMap/GameIntro/GlobeDive แล้ว)
- **เพลง:** `main5` เฉพาะใน launcher (ไฟล์พกใน `desktop/launcher/vendor/`, autoplayPolicy) · เข้าห้องแล้ว = `lobby5` ทันทีตั้งแต่หน้าเลือกลำดับ ถึง LOBBY/TEAM_* + intro (`musicForState(..., {intro})`) · กลไก `#music=main5&mt=` (`applyHandoff`) ยังอยู่แต่ไม่ได้ใช้แล้ว (ผู้ใช้สั่งเปลี่ยนเพลงทันทีที่เข้าห้อง)
- **launcher vendor:** `desktop/scripts/build-launcher-vendor.js` (vite `client/vite.globe.config.js` → `globe.js` + main5.0.mp3 + โลโก้) รันอัตโนมัติใน start.js / stage-game.js · gitignore แล้ว
- **อีโมตห้องรอ:** socket `lobbyEmote {emoji, dir}` → broadcast `{emoji, dir, color, playerId}` (`server/lobby.js relayLobbyEmote`, จำกัด 1 ครั้ง/600ms) · เทสต์ `tests/lobby-emote.test.js`
- **กฎข้อความ (ผู้ใช้สั่ง):** หน้าจอมีแค่หัวข้อ/ป้าย ห้ามประโยคอธิบาย ห้ามคำแปลก/ศัพท์ธีม · ห้าม letter-spacing กับภาษาไทย · ห้ามคำ "Blackjack Skill Battle"
- **ยังค้าง/ข้อสังเกต:**
  - server `view.js` ยังส่งข้อมูลตัวละครของทุกคนช่วงก่อนเริ่มเกม (มีมาก่อน) — UI ไม่แสดง แต่ถ้าจะซ่อนจริงต้องตัดที่ server
  - ห้องรอ: ผู้ใช้ยังไม่อนุมัติโครงหน้า (ขอดูคร่าวๆ ก่อน) · ส่วน persona `p-*` ใน index.css ยังม่วงเดิม · ArenaBackdrop เปลี่ยนสีแล้วแต่ยังเป็นภาพปราสาทเดิม
  - ระหว่างทดสอบ agent เขียนทับ `%APPDATA%\ECHO\settings.json` lastHost เป็น 127.0.0.1 (แจ้งผู้ใช้แล้ว)

## ปัญหาที่มีมาก่อน (ไม่ใช่จากงานนี้)
- eslint 2 errors: `tests/characters/escanor.test.js` บรรทัด ~722 (`no-control-regex` จาก `\x08`)
- vite เตือน chunk ใหญ่กว่า 500 kB

## เคล็ดลับเครื่องมือ (เครื่องนี้ Windows + Git Bash)
- **Bash tool ยุบ `\\` เป็น `\` ทั้งใน heredoc และ `node -e '...'`** — regex ที่มี backslash ให้เขียนเป็นไฟล์ .js ใน scratchpad แล้วค่อยรัน (เคยทำให้ Game.jsx เสียหายมาแล้ว ต้อง restore)
- ไฟล์ปน LF/CRLF (`add-character/SKILL.md`, `VictoryScreen.jsx` เป็น CRLF) — สคริปต์แทนข้อความต้อง normalize ก่อนเทียบ
- build หน้าเกมโดยไม่ copy ไฟล์สื่อ 1.8GB: ใน `client/` รัน
  `node --input-type=module -e "import { build } from 'vite'; await build({ build: { outDir: '<scratch>', emptyOutDir: true, copyPublicDir: false } })"`
- เช็คชุดเต็ม: `npm test` · `npx eslint .` · build ด้านบน
