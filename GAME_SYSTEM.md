# GAME_SYSTEM.md — คู่มือระบบเกม ECHO (เอกสารอ้างอิงภายในสำหรับ AI/ผู้พัฒนา)

> เอกสารนี้อธิบาย **การทำงานจริงของ engine** ไม่ใช่วิธีติดตั้ง/รัน (ดู [README.md](README.md))
> เลขบรรทัดอ้างอิงสภาพโค้ด ณ commit `e42c512` — ถ้าเลื่อนไปแล้วให้ค้นด้วยชื่อฟังก์ชันแทน

---

## 1. ภาพรวมสถาปัตยกรรม

```
server.js                        จุดเริ่ม: ตาข่าย error + require server/socket + export ให้เทสต์ + listen
server/                          เอนจินกลางทั้งหมด แยกตามระบบ (ตารางด้านล่าง)
characters.js (1.7k)             DATA ล้วน — roster/ชื่อสกิล/desc/cost/img + POSITION_COLORS + publicRoster()
characters/index.js              มัดรวม CHAR_HOOKS = { [characterId]: module } — ตัวละครใหม่ต้อง require+push ที่นี่
characters/<id>.js               LOGIC ของตัวละครนั้น (43 ตัว) — export { id, ...methods(engine, ...) }
characters/_universal_status.js  บัฟ/ดีบัฟกลาง (pure function ไม่พึ่ง engine)
characters/_transforms.js        ตาราง metadata คัตซีน (TRANSFORMS) — data ล้วน
characters/yuna.js               "ไอดอลประจำสนาม" ไม่ใช่ตัวละครที่เล่นได้ (ไม่อยู่ใน CHAR_HOOKS, require ตรง)
client/src/                      React (Vite): App.jsx คุมฉาก, screens/Game.jsx (4k บรรทัด) คือ UI สนามทั้งหมด
tests/                           node --test (ไม่มี dep เพิ่ม) — มี integration test ที่ spawn server จริง
```

**หลักการแบ่งความรับผิดชอบ**
- `characters.js` = ตัวเลข/ข้อความที่ผู้เล่นเห็น (ไม่มี logic)
- `characters/<id>.js` = ผลของสกิลจริง — เรียก state ผ่าน `engine.*` เท่านั้น ห้าม require server.js หรือ server/* (จะ circular)
- `server/` = ผู้ถือ state จริง + เรียก hook ตามจังหวะ (dispatcher)
- ผลที่ "ตัวละครไหนก็ควรใช้ร่วมกันได้" → ใช้สถานะ universal ไม่สร้าง key เฉพาะตัวใหม่

**engine object** (`server/engine.js`) คือ context ที่ส่งให้ hook ทุกตัว — `gameState`/`roundNumber`/`centralDeck` ฯลฯ อยู่ใน `match`
จึง expose ผ่าน getter/setter (`engine.gameState`, `engine.setGameState(v)`) ไม่ใช่ค่า primitive ตรงๆ

### 1.1 ไฟล์ใน server/ — ฟังก์ชันไหนอยู่ไหน

| ไฟล์ | เนื้อหา (ฟังก์ชันหลัก) |
|---|---|
| `app.js` | Express + HTTP + Socket.IO (`app`, `server`, `io`), redirect ไฟล์สื่อไป R2 |
| `constants.js` | ค่าคงที่ทั้งหมด (`CARD_TIME`, `MAX_HP`, ราคาร้านค้า, `DOOM_*`, `BARD_*`, `OGURI_*`, `TRANSFORMS` ฯลฯ) |
| `match.js` | **สถานะของแมตช์** (เดิมเป็น `let` ระดับไฟล์): `players`, `gameState`, `gameMode`, `roundNumber`, `timeLeft`, `centralDeck`, `lastLog`, `cutsceneQueue`, `shopItems`, `turnSnapshot` … |
| `engine.js` | `engine` object |
| `lobby.js` | สี/ตำแหน่ง, โหวตโหมด, จัดทีม, `checkLobbyReady`, `startMatch`, `backToLobby` |
| `timers.js` | `startPhaseTimer`/`clearPhaseTimer`, Clock Up, `cardPhaseSeconds`, `reduceCardTimer` |
| `deck.js` | กองกลาง 43 ใบ, `drawCardFor`, `calculateScore`, `scoreOf`, `bustedOf`, เอฟเฟกต์สีการ์ด |
| `combat.js` | `maxHpOf`/`maxArmorOf`, `healHp`, `loseHp`/`loseArmor`, `dealDirect`/`dealMixed`, `adjustIncomingDamage`, `instantDeath`, บัฟ/ดีบัฟ wrapper, `withEffectSource`, `resetCombat` |
| `skills.js` | `useSkill`/`useSkillCore`, Bard (`bardCompose`/`bardPerform`), Locacaca, Overhaul |
| `shop.js` | เหรียญ (`addGold`), ร้านค้ามายา (`openShop`, `buyShopItem`), ไอเทม (`useInventoryItem`), ปืน GUTS |
| `view.js` | `displayImg`, `activeSkillMusic`, `buildStateFor`, `broadcastState`, `broadcastPositions` |
| `cutscene.js` | `triggerCutscene`, `queueCutscene`, `notifyTransform`, `runCutsceneQueue` |
| `qte.js` | QTE กลาง (`startQte`, `qteKey`, `finishQte`) |
| `dayNight.js` | `isNightRound`, `dayCycleIndex`, `morningBonusActive` |
| `overload.js` | snapshot ย้อนเทิร์น + Overload Force |
| `characterRules.js` | กติกาเฉพาะตัวละครที่ระบบกลางยังเรียกตรง (Miyako/Shiki/Oguri/Recruit/Mark 42/Striker ฯลฯ) — ควรค่อยๆ ย้ายเข้า `characters/<id>.js` |
| `pair.js` | สไตรเกอร์ ยูเรก้า: ผู้เล่น 2 คนบังคับตัวละครเดียว |
| `socket.js` | `io.on('connection')` + handler ทุก event, session/reconnect, `newPlayerRecord` |
| `phases/draw.js` | `dealRound`, `hit`, `lock`, `checkAllLocked` |
| `phases/summary.js` | `resolveRound`, `afterResolve`, `goSummary` |
| `phases/attack.js` | `afterSummary`, `computeAttackBase`, `doAttack`, `postAttackFollowup` |
| `phases/endTurn.js` | `endTurn` |
| `phases/echoFreeHit.js` | Echo: เฟสโจมตีย่อยของตีฟรีกลางช่วงจั่วไพ่ (`pickFreeHit`, `startFreeHit`, `finishFreeHit`, `runPendingBeforeReveal`, `runPendingOnLock`) |
| `modes/mercury.js` | Type Mercury (ORT): `mercuryActive`, `isOrt`, `mercuryPick`, โหวตยอมแพ้ |
| `modes/seraph.js` | SE.RA.PH: เฟสเลือกสถานที่ + `seraphAdvance` |

**กติกาเวลาแก้โค้ดใน server/**
- สถานะแมตช์อ่าน/เขียนผ่าน `match.<ชื่อ>` เสมอ (`match.gameState = "SUMMARY"`) — ห้าม destructure ออกมาเก็บ ค่าจะไม่อัปเดต
  สถานะใหม่ของแมตช์ = เพิ่ม field ใน `server/match.js`
- เรียกฟังก์ชันข้ามไฟล์ผ่านชื่อโมดูล (`combat.healHp(p, 1)`, `view.broadcastState()`) — ไฟล์ใน server/ require วนกันเอง
  จึง **ห้าม** `const { healHp } = require("./combat")` (ได้ undefined ถ้าโหลดก่อน) · ยกเว้นไฟล์ที่ไม่ require ใครกลับ:
  `constants`, `match`, `app` และ `engine` ที่ destructure ได้
- ฟังก์ชันที่ไฟล์อื่นเรียกต้องอยู่ใน `Object.assign(module.exports, {...})` **บนสุดของไฟล์** (ก่อน require)
  ใช้ได้เพราะ function declaration ถูก hoist — ห้ามเปลี่ยนเป็น `const fn = () => {}` ถ้าจะ export
- ไฟล์ใหม่ใน server/ ไม่ต้องลงทะเบียนที่ไหน แค่ require จากไฟล์ที่ใช้

---

## 2. State machine (`gameState`)

```
LOBBY → TEAM_MODE → TEAM_SETUP → PLAYING ⇄ CUTSCENE → SUMMARY → ATTACK → TRANSITION → (วน PLAYING) → GAMEOVER → LOBBY
```

| state | ความหมาย | timer |
|---|---|---|
| `LOBBY` | ห้องรอ กด ready — ครบ 2+ คน & ready หมด → `enterModeSelect()` | – |
| `TEAM_MODE` | โหวตโหมด (ffa / duo / trio / overload) | – |
| `TEAM_SETUP` | เลือกทีม A/B/C + ยืนยัน | – |
| `PLAYING` | เฟสจั่วไพ่ + ใช้สกิล/ไอเทม | `cardPhaseSeconds()` = `CARD_TIME` 60s (เหลือ 40s ระหว่างท่าไม้ตายของเอจิ) — เอจิจั่ว 1 ใบ บีบเวลาที่เหลือลงอีกผ่าน `reduceCardTimer()` |
| `CUTSCENE` | เล่นวีดีโอในคิว (พัก state เดิมไว้) | ตาม `seconds` ของแต่ละคลิป |
| `SUMMARY` | เปิดแต้มทุกคน ประกาศผู้ชนะ | `SUMMARY_TIME` 5s |
| `ATTACK` | ผู้ชนะเลือกเป้า (หมดเวลา = สุ่มเป้าให้) | `ATTACK_TIME` 15s |
| `TRANSITION` | แบนเนอร์ "รอบที่ N" | `TRANSITION_TIME` 3s |
| `GAMEOVER` | ประกาศผู้ชนะสุดท้าย | – |

Clock Up (ไรเดอร์ Zect): ระหว่างแช่ตั้งตาข่าย 90 วิ แล้วจำเวลาที่เหลือไว้ที่ `clockUpResumeSeconds` — คลาย (เปิดไพ่ครบ/กดปิด) = เดินต่อจากค่านั้น
  ผ่าน `takeClockUpResume()` (แช่ตั้งแต่ต้นเทิร์น = เวลาเต็มของเฟส) · เดิมบังคับเหลือ 10 วิ

`startPhaseTimer(seconds, onExpire)` (`server/timers.js`) มีตัวเดียวทั้งเกม — ต้อง `clearPhaseTimer()` ทุกครั้งที่เปลี่ยนเฟส

---

## 3. วงจร 1 รอบ (call chain ที่ต้องจำ)

```
dealRound()            :2833  เริ่มรอบ: roundNumber++, สับเด็คใหม่, ล้าง cutsceneQueue/lastLog,
                              เปิดร้านทุก 5 เทิร์น, Yuna window, ฟื้นเกราะรอบคู่, แจกไพ่ใบแรก
   ↓ (ผู้เล่นกด)
hit(id)                :3105  จั่ว 1 ใบ (เช็ค nodraw/ครุ่นคิด/เพดานแต้ม/โชคลาภ/สภาพชา) → checkAllLocked()
useSkill(id,tier,...)  :3181  ใช้สกิล (ดูข้อ 6)
lock(id)               :3161  "เปิดไพ่" = พร้อม — ยิง applyLockColorTriggers() ก่อนล็อก
   ↓
checkAllLocked()       :4158  มนุษย์ทุกคน locked && ไม่มี pending answer → resolveRound()
resolveRound()         :4251  เคลียร์ข้อเสนอค้าง (Locacaca/บทเพลง) → ANATA
                              → หาผู้ชนะ (best) / ผู้แพ้ (worst) → แจกดาเมจแพ้ → afterResolve()
   └ ถ้าแต้มสูงสุดเสมอ & rand<30% → triggerOverloadForce() → restoreTurnSnapshot() (ย้อนทั้งเทิร์น) → beginOverloadForceDraw() (แจกไพ่ใหม่ในเทิร์นเดิม)
afterResolve()         :4502  เอฟเฟกต์หลังเปิดไพ่ (tepeu kill / Ashen Trail / บัฟแตกไพ่) + คัตซีน afterReveal
                              → runCutsceneQueue(goSummary)
goSummary()            :4549  gameState = SUMMARY, timer 5s
afterSummary()         :4561  ผู้ชนะโจมตีไม่ได้ไหม (หลับ/สตั้น/เร้นเงา/เสมอแต้ม) → endTurn()
                              ไม่งั้น gameState = ATTACK รอ doAttack
doAttack(by,target)    :4723  ท่อดาเมจเต็ม (ดูข้อ 5) → postAttackFollowup()
postAttackFollowup()   :4638  โจมตีซ้ำ (nanaya/miyako/takuto) หรือ → endTurn()
endTurn()              :5363  ลดเทิร์นสถานะทั้งหมด,
                              แจกแต้มสกิล+เหรียญ, เช็คจบเกม → TRANSITION → dealRound()
```

**จุดพลาดที่เจอบ่อย**: `dealRound()` ล้าง `cutsceneQueue` ทิ้ง — โค้ดที่คิววีดีโอไว้ต้องอยู่ **หลัง** บรรทัดนั้นเสมอ

---

## 4. การ์ดและแต้ม

- **กองกลางร่วม 43 ใบ** สับใหม่ทุกรอบใน `dealRound()` (ทุกคนจั่วจากกองเดียวกัน — ไพ่หมดกอง = จั่วไม่ได้)
  - เลข 1–10 × 4 สี (red/blue/green/yellow) = 40 ใบ + `king` + `queen` + `joker`
- `drawFromCentralDeck(predicate)` `:1050` — สุ่มจาก index ที่ผ่าน predicate (ใช้ทำ "โชคลาภ" / "จั่วได้แค่ 2-3 แต้ม")
- `drawInitialCard()` ห้ามได้การ์ดพิเศษ
- **การ์ดพิเศษ**: King = เหรียญ +10 ทันที · Queen = `freecast` ใช้สกิลฟรี 1 ครั้ง (หายจบเทิร์น) · Joker = `+min(12, 21-base)` (โหมด Overload = +12 ตายตัว)
- **ทริกเกอร์สี ครบ 3 ใบ/ชุด**
  - 🔵 ฟ้า → ทำงาน **ทันทีตอนจั่ว** (`checkBlueTrigger`): ต้านสถานะผิดปกติ 1 เทิร์น
  - 🔴 แดง / 🟢 เขียว / 🟡 เหลือง → ประเมิน **ตอนกด lock** (`applyLockColorTriggers` `:1122`): แดง = ATK รอบนี้ +n · เขียว = ฟื้นเลือด +n · เหลือง = แต้มสกิล +2n
- **แต้ม**: `calculateScore()` `:1082` (raw) → `scoreOf(p)` `:1158` (+cardBonus, cap ตามบัฟ) → `bustedOf(p)` `:1164`
- **เพดาน** `scoreCap(p)` `:1151`: ปกติ 21 · `fiber` (เสือนอนกิน) 19 ไม่แตก · `upg` (ฮิคารุ) 20 ไม่แตก · Overload = `Infinity`
- **ไพ่แตกแล้วไม่ล็อกอัตโนมัติ** — ยังกดสกิล/ไอเทมได้จนกว่าจะกดเปิดไพ่เอง แต่ท่าไม้ตายที่กดไปเป็นโมฆะ (`voidUltimateOnBust` `:1918`)

---

## 5. ท่อความเสียหาย (สำคัญที่สุด)

**ค่าคงที่ฐาน**: `MAX_HP = 7` · `MAX_ARMOR = 3` · `MAX_SKILL = 8` (Bard = 9) · `MAX_PLAYERS = 7` (patch 2.8)
(เพดานเฉพาะตัว: เอสคานอร์ Last Stand 7/0 · **เอจิ 4/4**)

**ลำดับการรับดาเมจ**: `shield` (กันครั้ง) → `armor` (เกราะ) → `hp` (เลือดจริง) — hp ถึง 0 = ตกรอบ

| ฟังก์ชัน | พฤติกรรม |
|---|---|
| `damageSoft(p)` `:1763` | 1 หน่วยมาตรฐาน: shield → armor → hp (ใช้กับดาเมจแพ้จั่ว) |
| `dealMixed(p,n,isNormal)` `:1822` | n หน่วย เกราะก่อนแล้วเลือด (ท่ามาตรฐานของสกิล/โจมตี) |
| `dealDirect(p,n,isNormal)` `:1800` | ทะลุเกราะ เข้าเลือดจริงตรงๆ (ยังกิน shield) |
| `dealArmorOnly(p,n)` `:1813` | กินเฉพาะเกราะ |
| `loseHp(p)` / `loseArmor(p)` | primitive ระดับ 1 หน่วย — ห้ามแก้ `p.hp` ตรงๆ นอกจากนี้ |
| `instantDeath(p)` `:1370` | สังหารทันที (ผ่านระบบกันตายก่อน) |

ทุก path ผ่าน `adjustIncomingDamage()` `:1784` → `CHAR_HOOKS[id].adjustIncomingDamage()` และเช็ค
`sealActive` (อมตะ ไม่รับดาเมจ) + `friendlyEffectBlocked` (ยิงพวกเดียวกันในโหมดทีม)

`isNormalAttack = true` **เฉพาะที่ `doAttack()` เรียกเท่านั้น** — ใช้แยกว่าเป็น "โจมตีปกติ" (มีผลกับสกิลกันดาเมจหลายตัว)

**พลังโจมตี**: `computeAttackBase(engine, attacker, target)` `:4690` — ฐาน 1 หน่วย บวกจาก
`hook.attackBaseOverride()` (แทนที่ฐาน) + `hook.damageBonus()` (บวกทับ) + บัฟ ungated ที่แจกข้ามตัวละครได้ (`veil`, `partner`, `cardAtkBonus` ฯลฯ)
→ มีเทสต์แยกที่ [tests/computeAttackBase.test.js](tests/computeAttackBase.test.js)

**ระบบกันตาย** (เรียกหลังทุกดาเมจก้อนใหญ่): `maybeBeatSave` (กันตาย 1 ครั้ง/เกม) → `maybeBeatMode` (เลือด<3 เข้าโหมด) → `maybeEva3` → `resolveDamageAftermath`

ท้าย `dealDirect`/`dealMixed`/`dealArmorOnly` ทั้งสามตัวเรียก `mageslayerMarkSteal(target, n)` — จุดเดียวที่ทำให้
"ตราล่าเวท" ของผู้สังหารเมจขโมยพลังงานจาก **ดาเมจทุกประเภท** (ปืน/สกิล/โจมตีปกติ) โดยดูต้นตอจาก `effectSourceId`
ดังนั้นเอฟเฟกต์ที่ยิงดาเมจต้องห่อ `withEffectSource` ไม่งั้นตราล่าเวทเงียบ

**ดาเมจแพ้รอบ** (`resolveRound` `:4400`): แต้มน้อยสุด → `damageSoft` 1 หน่วย + แต้มสกิล +1 — มีทางยกเว้นหลายชั้น (`sealActive`, `beatSaved`, `monster`, eva13 loss-immune, `fullbelly` ลด 1)

---

## 6. สกิล

| tier | cost | หมายเหตุ |
|---|---|---|
| `passive` (+ `passive2`/`passive3`) | ฟรี | ทำงานเองตาม trigger `roundStart`/`win`/`lose`/`attacked` หรือ engine เรียกตรง |
| `basic` | 2 | |
| `secondary` | 4 | |
| `ultimate` | 6 | หลอดจุ 8 |

**ใช้ได้ 1 สกิลต่อเทิร์น** (`p.skillUsedRound`) — ยกเว้นตัวที่มีโควตาของตัวเอง (Bard 2 โน้ต/เทิร์น, kai/takumi 5 ครั้ง)
· **คู่แฝดฮิซากาว่า** สกิลพื้นฐาน (สลับตัว/ชุบแฝด) เป็น **ทางหนี** ที่อะไรก็ปิดกั้นไม่ได้ — `useSkill()` ข้าม `p.locked`
  (สตั้น/หลับไหล), `noskill` และ `moonCellActive()` ให้เฉพาะ `tier === "basic"` ของตัวละครนี้ (ปุ่มฝั่ง client ปลดล็อกด้วย `isHisakawa`)
  · ไม่มีโควตาแยก แต่ "รีเซ็ต" `skillUsedRound` ได้ 2 ทาง — สลับตัว/ชุบแฝด (สกิลพื้นฐาน กดได้แม้ใช้สกิลไปแล้ว
  จำกัดสลับ 1 ครั้ง/เทิร์นด้วย `p.hisakawaSwitchedRound`) และสกิล**ทุกตัว**ที่เหลือซึ่งคืนสิทธิ์ให้อีก 1 ครั้ง
  (ชุบแฝด · สกิลรองทั้งสอง · Miracle Live · Miracle Dance · O-KU-RI-MO-NO-Sunday)
  (`p.hisakawaBonusRound` กันไม่ให้แจกซ้ำในเทิร์นเดียว — สลับตัวล้างค่านี้ แฝดที่ออกมาใหม่จึงได้โบนัสของตัวเองอีก 1 ครั้ง) — ทั้งหมดอยู่ใน `CHAR_HOOKS.hisakawa_sister.applySkill()`

**สูตรราคาจริง** (`useSkill` `:3316`–`:3360`)
```
cost = min(SKILL_COST_MAX /* 8 */,
         max(0, skill.cost - statusAmt(spellflow))   // กระแสเวท (ลดราคา)
       + (nightTaxTier === tier ? 1 : 0)             // กลางคืน: สุ่มแพงขึ้น 1 tier/คน/เทิร์น
       + min(SPELLBURDEN_MAX /* 2 */, statusAmt(spellburden)))  // ภาระเวท
// ตัวปรับ "ขาขึ้น" ทุกตัวรวมกันดันราคาได้ไม่เกิน 8 → สกิลที่ cost 8 อยู่แล้วจะไม่แพงขึ้นอีก
// publicState() คิดสูตรเดียวกันเป๊ะ (ราคาบนปุ่ม = ราคาที่หักจริง)
ถ้า cost > 0 และมี freecast (การ์ด Queen) → ฟรี 1 ครั้ง
```

**การได้แต้มสกิล** (จุดจริงในโค้ด — ตัวเลขใน README เก่ากว่านี้):
- จบเทิร์น **+1** (เช้าที่แจกโบนัส = **+2**) — `endTurn()` `:5546`
- ทริกเกอร์ไพ่เหลืองครบ 3 ใบ **+2 ต่อชุด**
- รีเจนพิเศษรายตัวละคร (satoru / ultraman_trigger / hisakawa / ignis · eiji ระหว่างท่าไม้ตาย) +1 ต่อเทิร์น
- **ชนะการจั่วไม่ได้แต้มสกิลแล้ว** (patch 2.1.3.5) และ **การโดนโจมตีก็ไม่ได้แต้ม** — ไม่มี `addSkill` ให้เป้าหมายใน `doAttack()` เลย
- **แพ้เพราะแต้มน้อยสุด / ไพ่แตกก็ไม่ได้แต้มสกิลแล้ว** — ลูปผู้แพ้ใน `resolveRound()` (`server/phases/summary.js`)
  ไม่มี `addSkill` ทั้งกรณีโดนดาเมจและกรณีที่มีผลกันดาเมจแพ้จั่ว/ไพ่แตก
- บล็อกการฟื้นแต้ม: `stagger` (ชะงัก) · `manaSeal` · ตัวละคร mageslayer
- `addSkill(p, n, src)` — `src` เป็น tag ของ "ช่องทางฟื้นฟู" (`"item"` / `"passive"` / `"card"`) ใส่เฉพาะจุดที่เป็น
  การฟื้นพลังงานจริงๆ (ไอเทม / พาสซีฟตัวละคร / ไพ่เหลืองครบชุด) **ไม่ใส่** ให้แต้มพื้นฐานจบเทิร์น ค่าชดเชยการแพ้
  หรือการโอนแต้มระหว่างผู้เล่น — ใช้ตัดสินว่าดีบัฟ `manaLeech` (ดูดซับเวท) จะโรล 35% หรือไม่

**โจมตีเพิ่มในเทิร์นเดียวกัน** (เปิดเฟส `ATTACK` ซ้ำจาก `postAttackFollowup()` — เลือกเป้าหมายใหม่ได้ทุกครั้ง):
nanaya · miyako (คอมโบ) · takuto (คอมโบ + ครั้งที่ 3) · kotone ·
**hisakawa_sister** 2 ทาง — "จังหวะนี้แหละ" (แต้มต่ำสุดแบบไม่เสมอ ได้ตีหลังผู้ชนะ · บัฟคู่ ใครคุมอยู่ก็ได้ตี) และ
"ฝันของเหล่าฝาแฝด" (ทุกครั้งที่โจมตีโดน แฝดอีกคนออกมาตีเป็นครั้งที่ 2 เสมอ 100% ดาเมจคงที่ 2 ทับทุกโบนัส —
นับรวมหมัดที่ได้จาก "จังหวะนี้แหละ" ด้วย
ต้องมีแฝดครบทั้งคู่ · `p.hisakawaDreamPending` จอง → `startDreamFollowupAttack()` เปิดเฟส → `p.hisakawaDreamAtk`
ทำให้ `doAttack()` ทับดาเมจและ `displayImg()` โชว์ภาพแฝดอีกคน · หมัดที่ 2 ไม่ทอยต่อเป็นลูกโซ่)

**สกิลที่สลับตัวเองได้** (`useSkill` เลือก `skill` object ใหม่ก่อนคิดราคา): shiki (เลือกตอน join), phenex, hikaru, oguri, takuto, escanor, hisakawa_sister, ignis, oberon_summer, kotone (ตามช่วงเวลา + ร่าง [พร้อมลุย] ทับทั้ง 3 ช่อง)

**คอสที่ไม่ใช่แต้มสกิล**: ท่าไม้ตายในร่าง [พร้อมลุย] ของโคโตเนะจ่าย **6 แต้มสกิล + 6 เหรียญ** — ด่านเงินเช็คที่
`CHAR_HOOKS.kotone.canUseSkill()` (ก่อนหักแต้ม) และหักจริงที่ `payFormUltGold()` ในส่วน effect
**คอนเนอร์ RK800 (patch 2.7)** — ตัวละคร **unique ตัวแรก** (`unique: true` ใน `characters.js`) เลือกได้ 1 คนต่อเกม
เซิร์ฟเวอร์กันซ้ำที่ handler `join` (ตอบ `characterTaken` แล้วไม่ให้เข้า) · ฝั่ง client ปิดการ์ดไว้ผ่าน event `takenChars`
ที่ `broadcastPositions()` ยิงคู่กับ `positions` ทุกครั้ง

- **"ความเครียด" (`p.connorStress` 0-10)** อยู่ที่ **ผู้เล่นคนอื่นทุกคน** ไม่ใช่ที่ตัวคอนเนอร์ — เป็นตัวเลข UI ล้วน
  ไม่ใช่ `p.statuses` จึงไม่อยู่ในลูปลดเทิร์นของ `endTurn()` และ **ต้าน/ล้างไม่ได้** (ไม่เช็ค `resist` โดยตั้งใจ)
  ทุกแหล่งต้องผ่าน `CHAR_HOOKS.conner.addStress()` เท่านั้น — จุดที่ engine เรียก: `useSkill()` (+1/ครั้ง) ·
  `useInventoryItem()` (+1/ครั้ง) · `hit()` (+1 ครั้งเดียวต่อเทิร์น กันซ้ำด้วย `p.connorStressDrewRound`) ·
  `resolveRound()` ผู้ชนะ (+1) · `doAttack()` ผู้ที่ตีคอนเนอร์ (+2) · `endTurn()` ลดลง 1 (ไพ่แตก -1 เพิ่ม)
- **`accused` ("ผู้ต้องหา")** เป็นสถานะนับเทิร์นปกติ (ไม่ต้อง `continue` ในลูป `endTurn`) อยู่ใน `BASIC_DEBUFF_CLEAR`
  — เป็นเครื่องหมายล้วน ผลอยู่ที่ `CHAR_HOOKS.conner.damageBonus()` (คอนเนอร์ตีแรงขึ้น +2)
- **โหมด "การไล่ล่า" (สกิลติดตัว 2)** = สวิตช์กติกาสนาม 3 เทิร์น เก็บที่ `p.connorChase` ของคอนเนอร์
  (`{ targetId, round, mine, theirs }` — เป็น plain object จึงย้อนคืนได้ครบผ่านสแนปช็อต Overload Force)
  - คนนอกวง: `p.connorFrozen` -> **`bustedOf()` คืน true ทันที** + `locked` + `actionBlocked()` ปิด `hit`
  - **`skillBlocked()` ปิด `useSkill`/`useInventoryItem` ของ *ทุกคน*** รวมคอนเนอร์กับเป้าหมายเอง — เหนือกว่า
    "ทางหนี" ของคู่แฝดฮิซากาว่าด้วย (การไล่ล่าเป็นการดวลแต้มล้วน ห้ามใครแทรก)
  - `resolveRound()` เรียก `CHAR_HOOKS.conner.chaseResolveRound()` **ก่อนหาผู้ชนะ** — คืน true = ระงับกติกาปกติทั้งก้อน
    แล้ว **ข้าม `afterResolve()` ไปที่ `runCutsceneQueue(goSummary)` ตรงๆ** เพราะเอฟเฟกต์หลังเปิดไพ่ที่กวาด
    "คนที่ไพ่แตก" (Ashen Trail ของโอกูริ ฯลฯ) จะไปลงคนที่ถูกแช่ ทั้งที่กติกาบอกว่าพวกเขาไม่รับความเสียหาย
  - `afterSummary()` ตัดเฟส `ATTACK` ทิ้งทุกเทิร์นระหว่างไล่ล่า
  - คำขาด "ยอมจำนน / ขัดขืน" ใช้กลไก pending answer แบบเดียวกับสัญญา (`p.connorArrestAsk` +
    เช็คใน `checkAllLocked()` + กวาดตอนหมดเวลาใน `resolveRound()`) — **ไม่ตอบ = ขัดขืน**
  - ตัดสิน: แต้มรวมสูงกว่าเท่านั้นถึงชนะ · **เสมอ = คอนเนอร์แพ้** · ถึง `CHASE_CLINCH` (2) แต้มเมื่อไหร่ตัดจบทันที ไม่นับให้ครบ 3
  - `cleanupChase()` ที่ `endTurn()` เป็นตาข่ายกันธง `connorFrozen` ค้างถาวรเมื่อคอนเนอร์ตายกลางการไล่ล่า
- **ฟื้นคืนชีพ (สกิลติดตัว 3)** ไม่ใช่การกันตาย — `instantDeath()` ให้ตกรอบจริงก่อนแล้วค่อยจอง `p.connorReviveRound`
  (`= roundNumber + 10`) · `dealRound()` เรียก `maybeRevive()` **ก่อน** บล็อกข้ามผู้เล่นที่ตายแล้ว
  ดังนั้น **ถ้าเกมจบก่อนครบ 10 เทิร์นก็ไม่ได้ฟื้น** (เงื่อนไขจบเกมไม่ถูกแก้)
- **ลำดับ "วีดีโอก่อน แล้วค่อยเกิดความเสียหาย"** มี 2 ที่: ท่าไม้ตายใช้ `pausePlayingForCutscene(() => applyCloseCase())`
  (มีตาข่ายสำรองลงดาเมจทันทีถ้าไม่ได้เข้าเส้นทางคัตซีน) · สกิลติดตัว 4 จองคู่กรณีไว้ที่
  `p.connorCounterPending` แล้วลงดาเมจที่ `postAttackFollowup()` ซึ่งทำงานหลัง `runCutsceneQueue` ของ `doAttack` เสมอ
- **คลิปชุดไล่ล่า/ป้องกันตัว/ปิดคดีเรียกผ่าน `queueCutscene` = เล่นทุกครั้ง** ส่วนเปิดตัว/สอบปากคำใช้ `triggerCutscene` = ครั้งเดียวต่อเกม
เทสต์: [tests/characters/conner.test.js](tests/characters/conner.test.js)

**โมโรโบชิ ดัน (patch 2.8)** — ครูฝึกที่ต่อยเองไม่ได้: `attackBaseOverride` คืน **0** (สกิลติดตัว 2 "อาการบาดเจ็บ")
แต่บัฟทุกตัวยังบวกทับได้ เพราะ `computeAttackBase` บวก veil/empower/partner/cardAtkBonus ต่อจากค่าฐานเสมอ
ดาเมจของเขามาจาก "ผลของการที่คนอื่นเล่นพลาด" ทั้งหมด และลงที่ `afterResolve()` เป็นหลัก
- สถานะทั้ง 3 ตัวเป็น**สถานะนับเทิร์นปกติ** (ลดเทิร์นในลูป `endTurn()` ได้เลย ไม่ต้อง `continue`) แต่มี mirror
  ที่ต้องล้างตอนหมดอายุ -> `CHAR_HOOKS.dan.onStatusExpire()` ถูกเรียกในลูปนั้น
  - `danCrutch` (ที่ตัวดัน) ฟื้นเลือด 1/เทิร์นที่ `onRoundStartTick` · ระหว่างติดอยู่ `canUseSkill` ปิดสกิลพื้นฐาน
  - `danDisciple` (ที่เป้าหมาย) เป็นบัฟ ATK **ungated** — อ่านที่ `computeAttackBase` เหมือน `veil`/`partner`
    ไม่ใช่ที่ `damageBonus` ของ hook (เพราะเป็นบัฟที่แจกให้ผู้เล่นคนอื่น ไม่ผูกกับตัวละครเจ้าของสกิล)
    · **สวนได้ครั้งเดียวแล้วสถานะหลุดทันที** (patch 2.8.1) ไม่งั้นเป้าหมายจะตีดันไม่ได้เลยตลอด 3 เทิร์น
  - `danChase` (ที่เป้าหมาย) มี mirror สองทาง: `target.danChaseBy` + `dan.danChaseTargetId` — ปลดผ่าน
    `stopChase()` จุดเดียวเสมอ (หมดอายุ / ตีดันครบ `CHASE_BREAK_HITS` 2 ครั้ง / เป้าหมายหรือดันตกรอบ / เปลี่ยนเป้าหมายใหม่)
    · **จบก่อนครบ 5 เทิร์น = คืนแต้มสกิลให้ดัน 3 หน่วย** (`stopChase(..., refund=true)`) ยกเว้นตอนดันเปลี่ยนเป้าเอง
      (นั่นคือย้ายเป้า ไม่ใช่ท่าถูกสลัดหลุด — ไม่งั้นกดวนรีดแต้มได้) และตอนดันตายไปเอง
    · `stopChase()` **ต้อง idempotent** — `instantDeath()` เรียก `onDeath()` ซึ่งปลดสถานะไปแล้ว
      จุดที่เรียกซ้ำตามหลังจะคืนแต้มรอบสองถ้าไม่กัน
- **ดาเมจ "จากศิษย์" ลดลง 2** ใช้ `engine.effectSourceId` (getter ที่ patch นี้เปิดให้ hook อ่าน) ใน
  `adjustIncomingDamage` — ไม่มีพารามิเตอร์ผู้กระทำส่งมาให้ในท่อนั้น จึงต้องดูต้นตอจาก `withEffectSource`
- **ท่าไม้ตายสลับตัวเองแบบมีเงื่อนไข**: เป้าหมาย `danChase` แพ้แต้มติดกัน 2 ครั้ง (`danLoseStreak`, ไม่นับไพ่แตก)
  -> `dynamicSkillFor()` คืน `ultimate2` — ต้องคิดสูตรเดียวกันเป๊ะทั้งที่ `useSkill()` และ `publicState()`
  และ client ตัดสินจากธง `me.danWhip` ที่ server ส่งมา **ห้ามเดาจากชื่อ/ราคาสกิลบนปุ่ม**
  - **สิทธิ์ใช้ต้องจองเป็น "เลขรอบ" ไม่ใช่อ่านสถานะสดตอนกด** (`dan.danWhipRound` + `dan.danWhipTargetId`
    ตั้งตอนสตรีคครบใน `onAfterResolve`) — บั๊กเดิม: `whipReady()` อ่าน `chaseOn(target)` ตรงๆ พอสตรีคครบ
    ในเทิร์นที่ `danChase` เหลือ 1 พอดี `endTurn` จะลดเป็น 0 แล้ว `onStatusExpire` ล้าง `danLoseStreak` ทิ้ง
    ปุ่มจึงขึ้นแค่ตอนสรุปผลแล้วหายไปก่อนถึงเทิร์นที่กดได้จริง ทั้งที่ log ประกาศไปแล้วว่า "เทิร์นหน้าเปลี่ยนเป็น..."
  - หน้าต่างใช้งานคือ **เทิร์นถัดไป 1 เทิร์นเป๊ะ** (`roundNumber === danWhipRound`) และจะถูกจองใหม่ทุกครั้ง
    ที่สตรีคยังครบเงื่อนไข — เป้าหมายตกรอบเมื่อไหร่สิทธิ์นี้ใช้ไม่ได้ทันที
- **ลำดับ "วีดีโอก่อน แล้วค่อยเกิดความเสียหาย"** ของท่าไม้ตาย 2 ใช้ `pausePlayingForCutscene(() => applyWhip())`
  พร้อมตาข่ายสำรองลงดาเมจทันทีถ้าไม่ได้เข้าเส้นทางคัตซีน (แพทเทิร์นเดียวกับ "จัดการปิดคดี" ของคอนเนอร์)
- **คลิปทุกตัวเรียกผ่าน `queueCutscene` = เล่นทุกครั้ง** ไม่มีคลิปไหนเล่นครั้งเดียวต่อเกม · `danScold`
  (สกิลติดตัว 1) ตั้ง `noIntro: true` ใน `TRANSFORMS` -> client ข้ามการ์ดเปิดตัว 950ms เข้าวีดีโอเลย
  และคลิปนี้ขึ้น **ครั้งเดียวต่อเทิร์น** ถึงจะมีคนไพ่แตกพร้อมกันหลายคน
เทสต์: [tests/characters/dan.test.js](tests/characters/dan.test.js)

**แบทแมน ร่างรถแบทโมบิล (patch 3.1)** — ถอด "เร้นเงา" ออกจากเกม แล้วแทนที่ด้วยร่างที่ 2 ของตัวละคร
- กลไกทั้งหมดของร่างรถรวมศูนย์ที่ **หัวของ `loseHp()`** ผ่าน `CHAR_HOOKS.bat_ben.carAbsorb()` —
  จุดคอขวดเดียวที่พลังชีวิตลดได้ ทำให้ได้ทั้งสองอย่างพร้อมกัน: ดาเมจไม่มีทางแตะตัวแบทแมน
  และการโจมตี "ทะลุเกราะ" (`dealDirect`) กลายเป็นดาเมจที่เกราะเอง = สกิลติดตัว 2 "รถคู่ใจ"
- **ต้องเช็คที่ `loseArmor()` ด้วยอีกจุด** (`onArmorLost`) — ถ้าดาเมจพอดีกับเกราะที่เหลือ
  ท่าจะไม่เคยเรียก `loseHp` เลย รถก็จะไม่พังทั้งที่เกราะเป็น 0 แล้ว
- **`p.hp` ระหว่างอยู่บนรถถูกตั้งเป็น "เต็ม" ไม่ใช่ 0** ตามตัวอักษรของสเปค เพราะเอนจินมีจุดกวาด
  `if (o.alive && o.hp <= 0) instantDeath(o)` อยู่หลายที่ — hp 0 จะโดนกวาดตายทันทีทั้งที่รถยังไม่พัง
  ผลที่ผู้เล่นเห็นเหมือนกันทุกประการ และทำให้ "คืนร่างด้วยเลือดเต็ม" เป็นจริงโดยธรรมชาติ
- **เกราะของรถห้ามฟื้นเองตามจังหวะปกติของสนาม** (`blocksArmorRegen` เกตจุดฟื้นเกราะรอบเลขคู่ใน `dealRound`)
  ไม่งั้นรถซ่อมตัวเองฟรีทุก 2 เทิร์นและแทบไม่มีวันพัง ขัดกับสเปค "ขึ้นรถถาวรจนกว่ารถจะพัง"
- **`p.hp` ที่ส่งให้ client เป็น 0/0 ระหว่างอยู่บนรถ** (ไม่ใช่ `null` ซึ่งจะขึ้น "???" ของทาคุมิ) —
  `LifeBar` วาดหัวใจตามจำนวน `maxHp` จึงไม่มีหัวใจสักดวง เหลือแต่เกราะตามสเปค ส่วนค่าจริงยังเต็มอยู่ในเอนจิน
- `basic2`/`secondary2`/`ultimate2` สลับมาทับทั้งสามช่องผ่าน `dynamicSkillFor()` — ต้องคิดสูตรเดียวกัน
  ทั้งที่ `useSkill()` และ `publicState()` เหมือนทุกตัวละครที่สลับชุดสกิล

**QTE (Quick Time Event) — ระบบกลาง (patch 3.0)** `server/qte.js` · ตัวแรกที่ใช้คือ "ทำนองเพลงร็อก" ของยุย
```
startQte(p, { count, perNoteMs, tag })   สุ่มลำดับ w/a/s/d เก็บที่ p.qte
qteKey(id, key) / qteTimeout(id)         socket handler — ตรวจทั้ง "ตัวถูก" และ "มาทัน" ที่ server
finishQte(p, ok) -> CHAR_HOOKS[tag].onQteDone(engine, p, ok, qte)
qtePending() / sweepQte()                กันสรุปรอบ + กวาดตอนหมดเฟส
```
- **ไม่มี timer ฝั่ง server เลยโดยตั้งใจ** — `startPhaseTimer` มีตัวเดียวทั้งเกมและถูกล้างทุกครั้งที่เปลี่ยนเฟส
  ส่วน `setTimeout` ต่อ QTE มีโอกาสค้างเมื่อผู้เล่นหลุด/จบเทิร์น/กลับล็อบบี้ → เก็บแค่ `deadline` (ms)
  แล้วตัดสินตอนคำตอบมาถึงแทน เวลาจึงยังเป็นของ server เต็มร้อย
- **คลิปผลลัพธ์ต้องสั่งเล่นที่ `finishQte()`** — `onQteDone` ของตัวละครแค่ `queueCutscene` ไว้เฉยๆ
  ถ้าไม่มีใครสั่งเล่น คลิปจะค้างในคิวไปโผล่ตอนจบรอบ (คนละจังหวะกับที่ผู้เล่นเพิ่งกดจบ)
  -> `finishQte` เรียก `pausePlayingForCutscene()` ต่อท้ายเสมอเมื่ออยู่ในเฟส PLAYING และมีของในคิว
- **ไม่แช่คนอื่น**: อยู่ใน `pendingAnswer` ของ `checkAllLocked()` เท่านั้น — คนอื่นจั่ว/เปิดไพ่ได้ตามปกติ
  แค่ยังไม่สรุปรอบให้ · หมดเฟสจั่วไพ่แล้วยังไม่จบ = `sweepQte()` ถือว่าพลาด
- **กันโกง**: ลำดับปุ่มถูกสุ่มและเทียบที่ server · `buildStateFor` ส่งให้เจ้าของ **แค่ปุ่มตัวถัดไปตัวเดียว**
  (ส่งทั้งชุด = เห็นล่วงหน้าทั้งเพลง หมดความหมาย) · `qteTimeout` จาก client ถูกตรวจเวลาซ้ำก่อนเชื่อ
- **"เสียแต้มฟรี" ได้มาฟรี**: `useSkill` หัก `p.skillPoints -= cost` ก่อนลง effect อยู่แล้ว — พลาดก็แค่ไม่เรียก effect

**ยุย โยชิโอกะ (patch 3.0)** — `unique` ตัวที่สอง · ตัวละครเดียวที่ "ยิ่งเล่นเก่ง ยิ่งเข้าใกล้จุดจบ"
- สกิลติดตัว "ความปรารถนา": เล่นครบ 3 เพลงไม่ซ้ำ -> `instantDeath(p, true)` — **พารามิเตอร์ `force` ตัวใหม่**
  ที่ข้ามระบบกันตาย/เกิดใหม่ทั้งหมด (escanor/hisakawa/phenex) ตามสเปคที่ระบุว่า "ไม่สนเงื่อนไขอื่นๆ"
- เพลงเก็บเป็นสถานะบน **ผู้ฟัง** ไม่ใช่บนยุย (`yuiRock`/`yuiBeats`) — การกรองโหมดทีมจึงทำครั้งเดียวตอนแจก
  (`songAudience()`: ally/enemy/self) แล้วที่เหลืออ่านสถานะตรงๆ ไม่ต้องเช็คทีมซ้ำทุกจุด
- `girl don't cry` แจกแต้มสกิลให้ "คนน้อยสุดในวง" ที่ **`onRoundStartAfterLoop`** ไม่ใช่ในลูปต้นเทิร์น —
  ไม่งั้นการเทียบจะใช้ค่าคนละเทิร์นกันตามลำดับที่นั่ง (เหตุผลเดียวกับ `escanor.flushPendingBurn`)
- `my soul your beats` จั่วตามกันเป็นวง — **ต้องมีธงกันลูป** (`p.yuiDrawEcho`) ไม่งั้นไพ่ที่จั่วตาม
  จะไปกระตุ้นให้คนอื่นจั่วตามซ้อนกันเป็นทอดๆ ไม่รู้จบ
- **เพลงชุบชีวิต + สกิลติดตัวชนกัน (patch 3.1)**: ถ้าบรรเลงเพลงชุบชีวิตเป็นเพลงที่ 3 พอดี "ความปรารถนา"
  จะฆ่ายุยในจังหวะเดียวกัน -> เป้าหมายค้างตายถาวรและเกมจบแบบไม่มีใครได้อะไร
  `CHAR_HOOKS.yui.onDeath()` (เรียกจาก `instantDeath`) จึงชุบชีวิตให้ทันทีเมื่อ **ไม่เหลือผู้เล่นอื่นเกิน 1 คน**
  นอกเหนือจากนั้นยังยึดสเปคเดิม (ยุยตายก่อน = ผลหายไป)

**มาคุโนะอุจิ อิปโป (patch 3.3)** — ตัวละครที่หมุนรอบ "การหลบหลีก"
- ค่าสถานะพื้นฐานต่างจากคนอื่น: `maxHpOf` 5 · `maxArmorOf` **4** (สเปคเรียกว่า "โล่" แต่คือเกราะ ไม่ใช่ `p.shield`
  ซึ่งในเกมนี้เป็นโล่กันครั้ง) · อัตราหลบหลีกพื้นฐาน 20%
- โครงหลบหลีกยืมแพทเทิร์นเดียวกับเอจิทั้งชุด (`tryDodge` / `tryAttackDodge` ใน `doAttack` /
  `adjustIncomingDamage` สำหรับดาเมจสกิล) ต่างกันที่ **อิปโปไม่มีโควตาหลบต่อเทิร์น** —
  ถ้าจำกัดเหมือนเอจิจะสะสม Dempsey Charge ไม่ได้เลย
- `adjustIncomingDamage` ของอิปโปเป็นทั้ง "ด่านหลบดาเมจสกิล" และ "จุดล้างอัตราหลบสะสมเมื่อโดนเต็มๆ" ในตัวเดียว
- **Dempsey Charge เก็บที่ `p.ippoCharge` + ธง `statuses.ippoDempsey`** ซึ่ง**ไม่นับเทิร์น** (ต้อง `continue`
  ในลูปลดเทิร์นของ `endTurn`) เพราะหายเมื่อ "โจมตีสำเร็จ" เท่านั้น · การตีเพิ่มใช้ `p.ippoExtraAtk`
  แล้วเปิดเฟส ATTACK ซ้ำทีละครั้งที่ `postAttackFollowup()` (แพทเทิร์นเดียวกับคอมโบของทาคุโตะ/โคโตเนะ)
- **Uper Cut ตัดสินจาก `armorBefore`** ที่เก็บไว้ก่อน `dealMixed`/`dealDirect` — ถ้าอ่านเกราะหลังหมัดลง
  หมัดที่พังเกราะหมดพอดีจะพลิกผลจาก "ผุพัง" เป็น "สตั้น" เอง
- คูลดาวน์ทั้งสามช่องเก็บเป็น**เลขรอบ** (`p.ippoCd`) ตามคอนเวนชันด้านล่าง

**ผู้วิงวอน The Supplicant (patch 3.4)** — ซัพพอร์ตล้วน ทุกอย่างหมุนรอบ "การล้างดีบัฟ"
- ค่าสถานะพื้นฐาน: `maxHpOf` 5 · `maxArmorOf` 5 · พลังงาน 0/8 (ใช้ `MAX_SKILL` ปกติ)
- **กดสกิลได้ 2 ครั้ง/เทิร์น** (`p.supSkillUsesRound`) — `isSupPick` ต้องประกาศ**ก่อน**ด่าน `p.skillUsedRound`
  ใน `useSkill()` ไม่งั้นชน temporal dead zone ของ `const` (เคยพังเทสต์ 8 ตัวมาแล้ว)
- **"เกราะศรัทธา" (`supFaith`) เป็นชั้นเกราะที่ 2 หลังเกราะหลัก** — ดูดดาเมจที่**หัว `loseHp()`**
  (จุดคอขวดเดียวกับร่างรถของแบทแมน) จึงกันดาเมจเจาะเกราะ `dealDirect` ให้อัตโนมัติด้วย ·
  เก็บ "จำนวนหน่วย" ที่ `statusAmt` ส่วน `statuses` เป็นแค่ธง -> อยู่ใน `NO_TICK_STATUS` + `continue` ใน `endTurn`
- **ผลพ่วงของสถานะที่ล้างไม่ได้ ห้ามใส่เป็นสถานะจริง** — เกราะศรัทธา (คุ้มครอง/เสริมพลัง) ·
  ลูกแกะน้อยรู้แจ้ง (อ่อนแอ/เปราะบาง) · ลงทัณฑ์ (ชา/ตาบอด) คิดสดที่จุดใช้งานผ่าน
  `statusAmtBonus()` / `chaaActive()` / `blindActive()` ถ้าใส่เป็นสถานะจริง "ต้านสถานะผิดปกติ"
  หรือการล้างดีบัฟของคนอื่นจะถอดออกได้ ซึ่งขัดสเปคที่ระบุว่าสถานะแม่ล้างไม่ได้
- ⚠️ **กับดัก "บัฟลดดาเมจ = อมตะ" (บั๊กจริงที่เจอตอนเล่น patch 3.4.3)**: พลังโจมตีปกติของเกมนี้คือ
  **1 หน่วย** บัฟลดดาเมจ 1 หน่วยใดๆ จึงหักหมัดปกติเหลือ **0 พอดี** — และเมื่อดาเมจเป็น 0
  ก็ไม่มีอะไรไหลไปถึง `loseHp()` แปลว่า**โล่ที่รอกินดาเมจอยู่ตรงนั้นจะไม่มีวันถูกกิน** กลายเป็นอมตะถาวร
  แทนที่จะเป็นโล่จำกัดจำนวนครั้ง · เกราะศรัทธาแก้ด้วย `absorbBlockedHit()` ที่ `doAttack` —
  หมัดที่ถูกกันจนเหลือ 0 ยังกร่อนโล่ 1 หน่วยเหมือนกัน · **ตัวละครใหม่ที่จะให้ "คุ้มครอง" คู่กับโล่
  ต้องคิดเรื่องนี้เสมอ**
- **"ลูกแกะน้อยรู้แจ้ง" กันการเล็งผู้วิงวอน** ปิดที่ 3 ปากทางเท่านั้น: `attackableTargets()` +
  ด่านแรกของ `doAttack()` + ด่านแรกของ `useSkill()`/`useInventoryItem()` — ไม่ต้องไปแก้ `prepareXTarget` ทีละตัว
- ตราพิพากษาเดินจาก `onJudgeTrigger()` ที่ `doAttack()` **ยิงทีละฝั่ง** (ผู้โจมตีและผู้ถูกโจมตี
  อาจถือตราคนละใบพร้อมกัน) — ปลายทางแยกเป็น `resolveJudgeComplete()` (ครบ 3) กับ `onJudgeExpire()` (หมดเวลา)

**สถานะ Universal ใหม่ (patch 3.4)**
- **"เยียวยา" (`mend`)** — บัฟฟื้นเลือดต่อเนื่อง `statusAmt` = พลังชีวิต/เทิร์น · ใส่ซ้ำ = **บวกเทิร์น**
  (ไม่ใช่รีเฟรช) เพดาน `MEND_MAX_TURNS` 5 · ติกที่ต้นเทิร์นด้วย `tickMend()` การลดเทิร์นทำที่ลูปกลางตามปกติ ·
  ใช้ `engine.healHp` จึงเคารพ "ไร้ทางเยียวยา"/"ผกผัน"/เลือดไหลครบ
- **"ตาบอด" (`blind`)** — ดีบัฟพื้นฐานธรรมดา (ต้าน/ล้างได้) · จุดทำงานจริงอยู่ที่ `buildStateFor()`
  โดยรวมเข้ากับ `takumiBlackout` เป็นตัวแปร `blackout` เดียว ต่างกันที่ blind บังเฉพาะ**ผู้ชมที่ตาบอด**
  และปิดแต้มสกิลของตัวเองด้วย (ทาคุมิเปิดของตัวเองไว้)

**เอฟเฟกต์ gif ทับไอคอนผู้เล่น (`iconFx`, patch 3.4)** — ระบบใหม่ที่ **ไม่หยุดเกม** ต่างจาก cutscene
- server: `iconFx(target, kind)` ยิง `io.emit("iconFx", …)` พร้อม `seq` ที่เดินขึ้นเสมอ
- client: เก็บ state ไว้ **นอก React** (module scope + listener set) เพราะ `Portrait` ถูก mount หลายที่
  พร้อมกัน (โต๊ะรวม/การ์ดเล็ก/โมดัล) การ prop-drill ลงไปทุกจุดต้องแก้ call site เป็นสิบแห่ง ·
  `key={seq}` บังคับให้ gif เริ่มเล่นใหม่ทุกครั้ง และ timeout ตรวจ `seq` ก่อนลบ กันเอฟเฟกต์ใหม่โดนอันเก่าลบทิ้ง
- gif แบบ "ค้าง" (ตราพิพากษา) ไม่ผ่านระบบนี้ — อ่านจาก `p.supJudge.gif` ใน state ตรงๆ

**คอนเนอร์ RK800 — rework สกิลพื้นฐาน + บาลานซ์ (patch 3.4.2)**
- **"วิเคราะห์สถานการณ์" เปลี่ยนทั้งท่า**: จากการเปิดไพ่ทุกคน+ตัดเทิร์นโจมตี -> เป็นการ **คาดการณ์ลำดับ
  การกระทำของเป้าหมายในเทิร์นที่แล้ว** (จั่ว/ไอเทม/สกิล/ซื้อของ) · กติกาที่ตกลงกับผู้เล่นไว้:
  นับ **เทียบช่องต่อช่อง** (ผิดกลางทางแล้วช่องหลังยังถูกได้) · รางวัล **เส้นตรง N:N** ·
  ลำดับจริงนับ **เฉพาะครั้งแรก** ของแต่ละประเภท (ยาวสุด 4 ช่อง) · ทาย **"ไม่ได้ทำอะไรเลย"** ได้
  และถ้าถูกก็นับเป็นถูกทั้งลำดับ (ได้เครียด +5 แต่ 0 ข้อจึงไม่มีเลือด/แต้มสกิล)
- **ระบบบันทึกลำดับการกระทำ** (`p.connorActions` / `p.connorActionsPrev`) — หมุนที่ `onRoundStartTick`
  ⚠️ บันทึก **เสมอแม้ไม่มีคอนเนอร์ในสนาม** (ต่างจาก `addStress`) เพราะคอนเนอร์ฟื้นคืนชีพกลับมาได้ด้วย
  สกิลติดตัว 3 — ถ้าหยุดบันทึกตอนเขาตาย เทิร์นแรกที่กลับมาจะไม่มีข้อมูลให้ทาย
- ท่านี้กด **ไม่ได้ในเทิร์นแรก** (ยังไม่มี "เทิร์นที่แล้ว") — กันทั้งที่ `canUseSkill` และปุ่มฝั่ง client
- `p.connorActionsPrev` ส่งให้ **เจ้าตัวคนเดียว** ใน `buildStateFor` — คอนเนอร์ต้องทายเอง ห้ามเห็นเฉลย
- **เพลง `conner_think.m4a` เล่นระหว่าง "กำลังคิด" เท่านั้น** ไม่ใช่ตอนกดยืนยัน — จึงคุมฝั่ง client
  ผูกกับวงจรชีวิตของโมดัล (`useEffect` mount/unmount) ซึ่งครอบทุกทางออก: ยืนยัน · ยกเลิก · กดนอกกล่อง
  · เอฟเฟกต์ปิดอัตโนมัติเมื่อหมดเฟส · ออกจากหน้าจอ
- **ลูปเสียงเฉพาะกิจ (`startLoopSfx`/`stopLoopSfx` ใน audio.js)** เป็นช่องอิสระจาก BGM หลัก
  ⚠️ ห้ามใช้ `stopMusic()` กับกรณีแบบนี้ — เอฟเฟกต์เพลงใน `App.jsx` สั่ง `playMusic()` ซ้ำทุกครั้งที่
  state เปลี่ยน และ `playMusic` จะ `play()` เพลงที่ถูก pause ไว้กลับมาทันทีในบรอดแคสต์ถัดไป
  จึงใช้ "หรี่" (`musicDuck`) แทนการหยุด
- **บาลานซ์ที่แก้พร้อมกัน**: ตัด `STRESS_DECAY_BUST` ทิ้ง (เดิมไพ่แตกลดเครียดเพิ่มอีก 1 = เป้าหมายยอม
  ไพ่แตกทิ้งเทิร์นเพื่อกดเครียดเป็นลบสุทธิ จับกุมไม่ได้ตลอดเกม) · สกิลรองที่ระดับผู้กระทำความผิดขึ้นไป
  เพิ่มเครียด **2 ไม่ใช่ 1** (คิดจากระดับ *ก่อน* กด) · `COUNTER_CHANCE` 15% -> **35%**

**ไบรอัน (GT-R34) (patch 3.5)** — ทรัพยากรเดียวคุมทั้งตัวละคร
- **น้ำมัน 0-12 เป็นทั้งเชื้อเพลิง ค่าสกิล และตัวจับเวลาของร่างรถ** — ไม่มีสถานะนับเทิร์นของร่างเลย
  (`brianCar`/`brianBoost` เป็นธงใน NO_TICK_STATUS · น้ำมันหมดถังเมื่อไหร่ `onRoundStartTick` ดับรถให้เอง)
- **แยก `addFuel` กับ `burnFuel` ให้ชัด**: มีแค่ `burnFuel` (น้ำมันที่ *รถกินเอง* ต่อเทิร์น) ที่แปลงเป็นเลือด
  ทุก 2 หน่วย — ถ้าเอาค่าสกิลมานับด้วย N2O ที่เททั้งถังจะฟื้นเลือดทีเดียว 6 หน่วย
- **"การแข่งที่มีเดิมพัน" ยืมโครง "จับกุมขั้นเด็ดขาด" ของคอนเนอร์มาทั้งดุ้น** (`duelResolveRound` เข้าคุม
  `resolveRound` แล้ว `return` · `freezeOutsiders` + `brianFrozen` ที่ `bustedOf` · ข้าม `afterResolve()`
  ทั้งก้อนเพราะเอฟเฟกต์ที่ยิงใส่ "คนไพ่แตก" จะกวาดโดนคนที่ถูกแช่) — ต่างกันที่จบใน 1 เทิร์น
- **N2O ใช้ subset-sum (DP) ไม่ใช่ greedy** ในการเลือกไพ่จากกองกลางให้ได้ 21 พอดี — greedy "หยิบใบใหญ่สุด
  ก่อน" ตันง่ายมาก (ต้องการ 16 จากกอง {12,9,5,2}: หยิบ 12 แล้วเหลือ 4 ที่ไม่มีใบเติม ทั้งที่ 9+5+2 = 16 พอดี)
- ช่องท่าไม้ตายสลับเป็น N2O (`ultimate2`) เฉพาะระหว่างการแข่ง และเป็น **ข้อยกเว้นเดียว** ของ `skillBlocked`
  ที่ล็อกสกิล/ไอเทมของทุกคนไว้ในเทิร์นนั้น — และต้องยกเว้นจาก **โควตาสกิลของเทิร์น** (`skillUsedRound`) ด้วย
  เพราะการแข่งจบใน 1 เทิร์นและท่าไม้ตาย 1 กินโควตาไปแล้วในเทิร์นเดียวกัน · ต้องสลับที่ `buildStateFor`
  (`ultimatePub`) คู่กับที่ `useSkill` ด้วย ไม่งั้นปุ่มโชว์ชื่อ/ราคาของท่าไม้ตาย 1 ทั้งที่กดแล้วได้ N2O
- ⚠️ **`activeSkillMusic()` เป็นสาย `if (bestX) return bestX;` ล้วน ไม่มีตัวแปร `best` กลาง** — เคยเผลอ
  เขียน `if (!best || ...) best = ...` ที่นี่แล้วเซิร์ฟเวอร์พังทั้งเกม (ReferenceError จาก TDZ ของ `let best`
  ที่ประกาศทีหลัง) เพราะฟังก์ชันนี้ถูกเรียกทุก `broadcastState`
- ⚠️ **`afterReveal: true` ใน TRANSFORMS ไม่ใช่แค่ "เล่นหลังเปิดไพ่"** — มันทำให้ลูปกลางใน `afterResolve()`
  ไล่หา **สถานะที่ชื่อตรงกับคีย์ TRANSFORMS** แล้วเล่นวีดีโอให้เอง (และ `voidUltimateOnBust` ลบสถานะนั้น
  ทิ้งถ้าเจ้าของไพ่แตก) · คลิปที่โค้ด **คิวเอง** ผ่าน `queueCutscene` ต้องเป็น `afterReveal: false` เสมอ
  ไม่งั้นเล่นซ้ำ 2 ครั้ง — เคยพลาดกับ `brianPush` ที่เป็นทั้งชื่อสถานะและชื่อคลิป
- ⚠️ **เอฟเฟกต์ที่คิววีดีโอแล้วเรียก `afterSummary()` ซ้ำใน callback ต้องปักธง "ทำไปแล้วเทิร์นนี้" ก่อนคิว**
  ("หลีกทางไป" ใช้ `brianPushFiredRound`) ไม่งั้นเงื่อนไขเดิมยังเป็นจริง แล้ววนคิววีดีโอไม่รู้จบ

**โปรดิวเซอร์ (luminous) (patch 3.6)** — 2 ตัวตนในช่องผู้เล่นเดียว
- **อย่าเลียนแบบระบบ sync ของคู่แฝดฮิซาคาว่าโดยอัตโนมัติ** — ฮิซาคาว่าต้อง `hisakawaSyncIn/Out` ทุกจุดที่แตะ
  เลือด เพราะแฝดสองคน **มีหลอดคนละหลอด** · ของโปรดิวเซอร์ ไอดอล 5 คน **ใช้หลอดเดียวกัน** จึงให้
  `p.hp`/`p.armor`/`p.statuses` เป็นของไอดอลตรงๆ ไปเลย — ดาเมจทุกช่องทางลงถูกที่เองโดยไม่ต้องเขียน routing
- จังหวะเดียวที่ต้องดักคือ **ตอนไอดอลเลือดหมด** (`tryIdolDown` เรียกจาก `instantDeath`) → สลับเจ้าของหลอดเป็นโปรดิวเซอร์ · `maxHpOf`/`maxArmorOf` คืน 5/3 หรือ 3/0 ตามธง
  → กลไกเลือด/ตายของเอนจินทำงานต่อได้เองทั้งหมด
- **โคฮารุ (ไพ่ใบแรกหักลบ) พลิกเครื่องหมายของ `card.value` เลย** ไม่ได้แก้สูตร `calculateScore` กลาง —
  ต้องทำ **ก่อน** `onCardDrawn()` ไม่งั้นทริกเกอร์สี/การ์ดพิเศษคิดจากค่าเดิมที่ยังไม่พลิก
- **Million star 765 (ดาเมจหน่วง 1 เทิร์น) ต้องมี "ต้นตอที่ระบุตัวได้" เท่านั้น** — ดาเมจจากสถานะ
  (ลุกไหม้/เลือดไหล) ไม่มีเจ้าของ ถ้าหน่วงด้วยจะกลายเป็นภูมิคุ้มกันถาวรเพราะไม่มีวันมี "คนทำ" ให้ตรวจว่ายังไม่ตาย
- ⚠️ **ดาเมจที่หน่วงไว้ต้องตายไปพร้อม "ผู้รับ"** — Million star 765 หน่วงดาเมจที่ *ไอดอล* รับไว้
  ถ้าไม่ล้างคิวตอนไอดอลล้ม ดาเมจก้อนนั้นจะไหลไปลงหลอดโปรดิวเซอร์ (3 หน่วย ไม่มีเกราะ) ในเทิร์นถัดไป
  = ดาเมจที่เล็งไอดอลเต็มหลอดฆ่าทั้งตัวละครได้ในทีเดียว ทั้งที่ท่านี้เป็นท่า "อดทน" · ล้างที่ `tryIdolDown`
- ⚠️ **ฮุคที่ต้องนับ "การถูกเล็ง" ต้องอยู่ก่อนด่านหลบหลีกใน `doAttack`** — ด่านหลบ (`tryAttackDodge`)
  `return` ออกจาก `doAttack` ทันที ทุกอย่างที่อยู่หลังจากนั้นจะไม่ทำงานเลยเมื่อถูกหลบ · luminous มีการหลบ
  40% ติดมาด้วย ตัวนับ burst ที่เคยวางไว้หลังจุดลงดาเมจจึงกิน ~40% หายเงียบๆ จนรางวัลแทบไม่เกิดขึ้น
- ⚠️ **ผลที่หน่วงไว้รอคลิปต้องมีตาข่ายที่ `endTurn` ด้วย** — เส้นทาง "ถูกหลบ" ไม่ผ่าน `postAttackFollowup`
  ผลที่รอ flush อยู่จึงค้างตลอดกาล (ทำให้ `flush*` เป็น idempotent แล้วเรียกทั้งสองที่)
- ท่าไม้ตายมี 6 แบบผ่าน `dynamicSkillFor` (`ultimate_<idol>` × 5 + `ultimate2`) — สลับ **ทั้งที่ `useSkill`
  และ `buildStateFor`** เหมือนไบรอัน · ช่องแรกสลับ `basic`↔`basic2` ตามว่าไอดอลล้มหรือยัง

**อุซากิ (เอาฮา · unique)** — `characters/usagi.js`
- สกิลพื้นฐาน (กินไอเทมในกระเป๋า) กดได้ 2 ครั้ง/เทิร์น และ **ไม่กินโควตาสกิลของเทิร์น** (`isUsagiBasic` ในสองบรรทัดโควตาของ `useSkill`)
  · client เปิด `UsagiItemModal` แล้วส่ง uid ของไอเทมมาทาง `item`
- สกิลรองเป็น 2 จังหวะ: `useSkill` จ่ายแต้ม + ตั้ง `p.usagiSwapOffer` (แต้มเป้าหมายส่งให้เจ้าตัวคนเดียวใน `buildStateFor`)
  → socket `usagiSwapAnswer` เอา = `pausePlayingForCutscene` (วีดีโอก่อน) แล้วสลับ `cards` ทั้งมือ · ไม่ตอบก่อนเปิดไพ่ = ไม่เอา
- ท่าไม้ตาย = **ระบบโจทย์คณิต** ยืมแนวคิด QTE: เก็บเส้นตายเป็น ms ที่ `p.usagiQuiz` ของผู้ถูกทำโจทย์ ไม่มี setTimeout ฝั่ง server
  · แจก **ทันทีตอนกด** (เทิร์นที่ 1) แล้วแจกต่อที่ `onRoundStartAfterLoop` (เทิร์นที่ 2-3) ผ่าน `dealQuizzes()` · `usagiMath` = เทิร์นที่เหลือรวมเทิร์นนี้
    ลดที่ลูปลดเทิร์นของ `endTurn()` **จุดเดียว** (บั๊กเดิม: ลดทั้งตอนแจกและตอนจบเทิร์น = ทำงานรอบเดียว) · **นาฬิกาหยุดเมื่อไม่ได้อยู่เฟส PLAYING** (ระหว่างวีดีโอท่าไม้ตาย)
    (`syncPause` ที่หัว `broadcastState`) · client ได้ `leftMs` ไม่ใช่เวลาเครื่อง server · ไม่ส่งเฉลย · ค้างอยู่ = `pendingAnswer` ของ
    `checkAllLocked` และ `resolveRound` กวาดข้อที่เหลือเป็นผิด · ข้ามเพื่อนร่วมทีม (`sameTeam`) · ORT ไม่ได้โจทย์แต่รับดาเมจเต็ม 3 ทุกเทิร์น (ORT สวนกลับอุซากิตามปกติ)
- สกิลติดตัว ปรุๆ: `onAttack` ก่อนด่านหลบใน `doAttack` (นับแม้โดนหลบ) · คริติคอลคูณยอดสุทธิถัดจากของ ORT · ATK +1 ผ่าน `damageBonus`
- เทสต์: [tests/characters/usagi.test.js](tests/characters/usagi.test.js) · [tests/characters/usagi-ult.integration.test.js](tests/characters/usagi-ult.integration.test.js)

**Bamboo-Hatted Kim (พิเศษ · unique)** — `characters/kim.js` · พลังชีวิต 8 / เกราะ 2
- ฝักดาบ +3-10 เมื่อ**ได้รับความเสียหายทุกชนิด** (`adjustIncomingDamage` + `onSoftDamage` ใน `damageSoft`) · +3-8 เมื่อสร้างความเสียหาย > 0 รวมการสวนกลับ
- ทรัพยากรทั้งหมดอยู่ที่ `p.kim` (ฝักดาบ 0-100 · Poise 0-50 · เหรียญหัว/ก้อย · บัพ ymf/tctb/bones · คูลดาวน์เลขรอบ) — **ไม่ใช่ `p.statuses`**
  จึงไม่ลดเทิร์น/ล้าง/ต้านไม่ได้ · มีแค่ Counter Stance (`kimCounter` 2 เทิร์น) ที่เป็นสถานะนับเทิร์นปกติ
- โยนเหรียญที่ `onRoundStartTick` ถัดจาก `ippo.applyPendingStun` (หลังเลือดไหล/ฟื้นเกราะ — อ่านพลังชีวิตของต้นเทิร์นนั้น)
- **"ถูกหลบ" ตัดสินย้อนหลัง**: `beforeAttack` (หัว `doAttack` ก่อนด่านหลบ) จำ reference ของ `lastAttack` ไว้ ·
  หมัดลง = `onAttackLanded` ล้างธง · ไม่ลงแล้ว `lastAttack` ใหม่มี `dodge: true` = ฝักดาบ +10 ที่ `flushMiss` (หัว `doAttack` ถัดไป / หัว `endTurn`)
- คริติคอลคูณยอดสุทธิถัดจากของอุซากิ · สวนกลับ (Counter Stance / บัพรวมร่าง) อยู่ถัดจากสวนกลับของยุย ใช้ `counterBase` (ไม่รวม Yield My Flesh ตามสเปค)
- บัพรวมร่างล่อเป้าผ่านคิว taunter เดียวกับยุย/ริต้า/แบทแมน · ท่าไม้ตาย 1: `resolveUltScores` ปรับแต้มด้วย `cardBonus`
  ถัดจาก `kotone.resolveFormUlts` แล้ว `onRoundResult` อ่าน `isLoser` หลังตัดสินผลทุกคน (ตาข่าย: รอบถูกตัดทางลัด -> ลงบัพต้นเทิร์นถัดไป)
- Resentment ดักที่หัว `instantDeath` เฉพาะ `hp <= 0` (สังหารทันทีตอนเลือดยังเหลือไม่นับเป็น "ความเสียหาย")
- **"เหน็บชา" (`numb`) — ดีบัฟ Universal ใหม่**: 30% กดสกิลแล้วไม่ทำงาน (`numbFizzles` ใน `_universal_status.js`
  โรลที่ `useSkillCore` ถัดจากจุดหักแต้ม — แต้ม/โควตาเทิร์นเสียไปแล้ว) · อยู่ใน `BASIC_DEBUFF_CLEAR` ·
  ที่ Kim มอบ "ในเทิร์นถัดไป" จองไว้ที่ `p.kimNumbPending` แล้วแปลงเป็นสถานะจริงต้นเทิร์น (ใส่ 1 เทิร์นตอนเฟสโจมตีเลยจะโดน `endTurn` กินทิ้งก่อนมีผล)
- เทสต์: [tests/characters/kim.test.js](tests/characters/kim.test.js)

**Recruit (ยาก)** — `characters/recruit.js` · พลังชีวิต 5 / เกราะ 2 / กระสุน 6 (`p.recruit.bullets`)
- **QTE คลิกจุดแดงเป็นระบบแยกจาก QTE กลาง** (`p.qte` = กดปุ่ม w/a/s/d) เก็บที่ `p.recruit.qte` — `dots` (จุดขึ้นพร้อมกัน ตำแหน่งสุ่มที่ server)
  / `chase` (จุดเดียววิ่ง เส้นทางสุ่มฝั่ง client) · ไม่มี setTimeout: เส้นตายเป็น ms + `syncPause` หัว `broadcastState` แบบโจทย์ของอุซากิ
  · socket `recruitQteHit` (นับจุด) / `recruitQteDone` (server ตรวจเวลาซ้ำ) → `recruitQteFinish()` ใน `server/characterRules.js`
- **โจมตีปกติ**: `recruitInterceptAttack` (หัว `doAttack` หลังด่านตรวจเป้า) เปิด QTE แทนการตี แล้วพักเฟส ATTACK ด้วย
  `RECRUIT_ATTACK_SAFETY_SECONDS` เป็นตาข่ายกันค้าง · ผ่านแล้วปัก `p.recruit.shot` แล้วเรียก `doAttack` ซ้ำเป็นการยิงจริง
  (ล่อเป้า/หลบหลีกของเป้าหมายยังทำงานตามปกติในรอบนั้น) · พลาด/กระสุนหมด = การ์ดสรุป `dodge: true` แล้วจบเทิร์น
  · HeadShot โรลตอน QTE ผ่านแล้วเก็บเป็นธง — **ห้ามสุ่มใน `damageBonus`** เพราะ `computeAttackBase` ถูกเรียกจาก `buildStateFor` ทุก broadcast
- **สกิล**: QTE ค้าง / นัดที่รอเลือกเป้า (Desert Eagle นัด 2 · FAMAS 2 คน) = `pendingAnswer` ของ `checkAllLocked` ·
  `resolveRound` กวาด: QTE นับจุดที่คลิกได้ตอนนั้น (`sweeping` — ห้ามพักเฟสเล่นคลิป) · นัดที่ยังไม่เลือกเป้าสุ่มให้
  · ผลที่ต้องเกิด "หลังวีดีโอ" คืนเป็น `{ after }` แล้ว server ส่งเข้า `pausePlayingForCutscene(after)`
- [Armor] (ไอคอนสีส้ม) ดักดาเมจ**ทุกชนิดที่ลงเกราะ** ที่ `adjustIncomingDamage` (kind ไม่ใช่ `direct`) + `damageSoft` (`absorbSoft`) — คืน 0 ทั้งก้อน · ครบ 2 ครั้ง `loseArmor`
  · เดิมดักแค่โจมตีปกติ -> พิษ/เลือดไหลติกเดียวเกราะหาย (บั๊กที่ผู้เล่นเจอ) · `healArmor` คืน 0 ให้ Recruit (สกิล Armor ของตัวเองเพิ่มตรงๆ)
- สกิลพิเศษ "เตรียมตัว" = socket `recruitPrep` (ไม่ผ่าน `useSkill` → ไม่กินโควตา) แต่ยังเช็คด่านห้ามสกิล/เหน็บชาเอง
- เทสต์: [tests/characters/recruit.test.js](tests/characters/recruit.test.js)

**โทโนะ ชิกิ (ยาก · unique · rework)** — `characters/tohno.js` · สถานะของตัวเองอยู่ที่ `p.tohno` (ไม่ใช่ `p.statuses`)
- สกิลพื้นฐานสลับโหมด `calm`/`rage` (item ของ `useSkill`) · 0 แต้ม ไม่กินโควตาเทิร์น (`isTohnoPick`) · สกิลรอง/ท่าไม้ตายกันซ้อนที่ `canUseSkill` + `tohnoBusy` ฝั่งปุ่ม
- **รอยร้าวเก็บที่ตัวเป้า** `t.tohnoCrack` / `t.tohnoCrackAt` (ใครก็ติดได้ · ล้างใน `resetCombat` ของทุกคน) — ส่งให้ทุกคนเป็น `tohnoCrack`
  แล้ว client วาดวงม่วง (`CrackRing`) รอบไอคอนเกราะ · จางลงที่ `onRoundStartTick` เมื่อไม่เพิ่มครบ 10 เทิร์น
- `beginAttack` (หัว `doAttack` ถัดจาก `kim.beforeAttack` ก่อนด่านหลบ) ตัดสินชนิดหมัด: เชือดเฉือน (`seq`) / ระเบิด (`burst`) / ธรรมดา (`plain` — ใช้เลือกเสียง)
  · ใช้ "จบสิ้นซะ"/"หลับให้สบาย" ตั้งแต่ออกหมัด (ถูกหลบ = ท่าหายแต่รอยร้าวยังอยู่) · `damageBonus` อ่านธงล้วน (ห้ามแก้ state — `buildStateFor` เรียกด้วย)
- ระเบิดที่ `applyBurst` ถัดจากคริติคอลของ Kim (ผ่านด่านหลบแล้ว) = ดาเมจ + จำนวนรอยร้าว แล้วล้างรอยร้าว **ก่อน** ดาเมจลง
  (โล่/สะท้อน/ดูดซับรับไว้ รอยร้าวก็หายแล้ว) · คิว `tohnoBurst` ทุกครั้งและเล่นก่อนการ์ดสรุป · รอยร้าวใหม่ของโหมดเดือดดาลลงทีหลังที่ `onAttackLanded`
- **หมัดต่อเนื่อง (เชือดเฉือน 4 ครั้ง / ตระกูลโทโนะ 10%) เปิดจากหัว `endTurn` (`continueAttack`) ถัดจากคาเยนน์** —
  หมัดที่ถูกหลบ return ตั้งแต่ด่านหลบ ไม่ผ่าน `postAttackFollowup` ถ้าเปิดจากที่นั่นชุดจะขาดกลางทาง · ลูกโซ่ตีเพิ่มมีเพดาน `CHAIN_CAP` 5
- เสียง: `byVoice` เสียงพากย์สุ่มทุกหมัด (รวมหมัดเชือดเฉือน/หมัดระเบิด) · `byAttackSound` (`tohno_hit`) เฉพาะหมัดธรรมดา — `App.jsx` เล่นคู่กับการ์ด ·
  กดสกิลรอง/ไม้ตาย = `skillFlash.sound` สุ่ม **ยกเว้นไม้ตายที่เพิ่งเล่นวีดีโอเต็ม** (`ultVideo` — ไม่ทับคลิป) ·
  โดนดาเมจจากคนอื่น: นอกเฟสโจมตียิง event `sfx` (`engine.sfx` เว้นช่วง 1.5 วิ) · **ในเฟสโจมตีเก็บไว้ที่ `hurtPending` แล้วขึ้นพร้อมการ์ดเป็น `targetVoice`**
  เพราะดาเมจลงก่อนคลิปที่คิวไว้ (ยิงทันที = ทับคลิป) · ค้างหลังการ์ด = ปล่อยที่หัว `continueAttack`
- วีดีโอไม้ตาย/ระเบิดโหลดล่วงหน้าใน `GutsVideoPreloader` เมื่อมีโทโนะในเกม · `tohno_skill3.mp4` ต้องเป็น faststart (moov อยู่หน้าไฟล์) ไม่งั้นกระตุก
- **"แม่นยำ" (`accurate`) — บัฟ Universal ใหม่** (`accurateActive` ใน `_universal_status.js` · อยู่ใน `BUFF_KEYS`):
  `doAttack` คำนวณ `accurate` ครั้งเดียวแล้วข้ามด่านหลบทุกตัว (สถานะหลบหลีก · ชิวๆ · Flow · Night · เอจิ · อิปโป · Mark 5 · luminous · Zect ×4 · โทโนะ)
  + `appleGuyDodgesKill` · ด่านหลบดาเมจจากสกิล (อิปโป/เอจิ/luminous) เช็ค `engine.sourceAccurate()` · **ด่านหลบใหม่ต้องเช็ค `accurate` ด้วย**
  · ไม่นับเป็นการหลบ: โล่ · ลบล้างของซาโตรุ · ขัดจังหวะของเอจิ
- เทสต์: [tests/tohno.test.js](tests/tohno.test.js)

**สไตรเกอร์ ยูเรก้า (พิเศษ · ตัวละครคู่)** — กลไกต่อสู้ `characters/striker.js` · ระบบคู่หูอยู่ใน `server/pair.js`
- **ระบบคู่หู — ในเกมมีระเบียนผู้เล่นแค่ 1 ระเบียน** (ของคนที่เลือกตัวละครก่อน = host) คนที่สองเก็บที่ `p.pair.co`
  engine ต่อสู้จึงเห็นยูเรก้าเป็นผู้เล่นคนเดียวโดยไม่ต้องแก้ลูปใดๆ ("แพ้ก็แพ้คู่" ได้มาฟรี) · **ห้ามใส่คู่หูลงใน `players`**
  - `playerIdFor(socket)` คืน host id ให้ socket ของคู่หูด้วย · `onPlayerEvent` กรองตาม `PAIR_ROLE_EVENTS`
    (นักบิน: hit/lock/attack/อนุมัติ/ซ่อม · พลปืน: useSkill/buyShopItem/useInventoryItem · อย่างอื่นทำได้ทั้งคู่)
    · นักบินหลุด = พลปืน `lock` แทนได้ (จั่วไม่ได้) — `pairAllows()`
  - socket ของคู่หู `join` ห้องของ host -> ได้ state ชุดเดียวกัน (`youId` = host) · บทบาทของแต่ละเครื่องส่งแยกทาง event `pairRole`
  - เข้าร่วม: host `join` พร้อม `pairRole` · คนที่สอง `joinCopilot` (ไม่ใช้ที่นั่ง) · หน้าเลือกตัวละครเห็นช่องว่างจาก event `pairSlots`
  - พร้อม: `p.pair.hostReady` + `co.ready` -> `p.ready` จริงเมื่อครบคู่และพร้อมทั้งคู่ (`pairRefreshReady`)
  - รีคอนเนกต์: `coSessions` (token -> host) · host ออก/ถูกลบในห้องรอ = `dissolvePair` ส่ง `sessionExpired` ให้คู่หู
  - `p.pair` ไม่ถูกล้างโดย `resetCombat` และอยู่ใน `keep` ของการย้อนสแนปช็อตทั้งสองแบบ + การเลือกตัวใหม่ของ Type Mercury
  - **โหมดทีม**: ยูเรก้านับเป็นทีมเต็ม 1 ทีม (`pairTeamWeight` = teamSize) — duo 3 ระเบียน (2:1) · trio 4 ระเบียน (2 คนบังคับ : 3)
- **เพดานราคาสกิลของยูเรก้าคือ 16 ไม่ใช่ `SKILL_COST_MAX`** (ขีปนาวุธ 1-9 · เป็นเกียรติมากครับ 12) — `striker.costCap` ทั้งใน `useSkill` และ `showCost`
- เป็นเกียรติมากครับ: `useSkill` **ไม่หักแต้ม** แค่ตั้ง `approval` แล้วจบ · หักตอนนักบินอนุมัติ (`strikerApprove`) ·
  ครบ 4 เทิร์น = `onRoundStartTick` คิวคลิประเบิด แล้ว `dealRound` เล่นก่อนเข้าเฟสจั่ว -> `flushDetonation` · ฆ่าตัวเองแบบไม่ force (กันตายช่วยได้)
- หมัดเหล็กใช้ที่ `prepareFistOnAttack` ถัดจาก Rider Slash = ผ่านด่านหลบแล้วเท่านั้น (คุ้มครองของเป้าถูกคิดไปก่อนปาด — ลำดับเดียวกับ Rider Slash)
- อาศัยจังหวะเรียกท้ายสุดของ `postAttackFollowup` (หลังตีเพิ่มทุกแบบของฝั่งตรงข้ามจบ) · งานช่างกันโจมตีที่ `afterSummary`
- เทสต์: [tests/characters/striker.test.js](tests/characters/striker.test.js) · [tests/striker-pair.integration.test.js](tests/striker-pair.integration.test.js)

**อาซาฮินะ ทักต์ (พิเศษ · เลือกซ้ำได้ — พันธะแยกตาม id ทักต์) + ไททัน (ง่าย) + คอเซ็ตต์ (กลาง) — มิวสิคคาร์ท** — `characters/takt.js` · `characters/titan.js`
- **ระบบพันธะเป็นของกลางของ "มิวสิคคาร์ท"** (`takt.MUSIC_CARTS` = characterId -> คีย์คัตซีนตอนได้บทเพลง) — มิวสิคคาร์ทตัวใหม่แค่เพิ่มในตารางนี้
  แล้วอ่าน `takt.songActive(p)` เพื่อปลดล็อกความสามารถของตัวเอง · ฟิลด์ทั้งหมดอยู่บนตัวผู้เล่น (ย้อนได้ผ่านสแนปช็อต):
  ทักต์ `taktBonds` · มิวสิคคาร์ท `taktBondBy` / `taktInvite` / `taktSongMode` / `taktModeRound` · บทเพลง = `statuses.taktSong` (นับเทิร์นปกติ)
- เชิญ/ตอบ = socket `taktInvite {targetId}` / `taktInviteAnswer {accept}` (ไม่ผ่าน `useSkill` -> ไม่กินโควตา) · คำเชิญค้าง = `pendingAnswer`
  ของ `checkAllLocked` · ไม่ตอบ = ปฏิเสธ (`sweepInvites` ต้น `dealRound`) · ตอบรับ = คิว `taktAccept` + `pausePlayingForCutscene`
- **โหมดอิสระ: พันธะ = พวกเดียวกัน** ที่ `sameTeam()` และ `isAlly()` (เฉพาะ `gameMode === "ffa"`) -> ตีกันไม่ได้ · ผลเสียลงกันไม่ได้ · เห็นไพ่กัน ·
  `normalGameOver()` จบเกมเมื่อคนที่รอดทั้งหมดอยู่ในพันธะเดียวกัน (`bondGroupWins`) · โหมดทีมผูกได้เฉพาะเพื่อนร่วมทีม (ไม่ต้องแก้ sameTeam)
- พันธะหลุดที่ `takt.onDeath()` (เรียกจาก `instantDeath`) · ทักต์หลบตีปกติ 15% (มีพันธะ 35% เอาค่าสูงสุด) / ทุ้มต่ำหลบ 5% ที่ `takt.tryAttackDodge`
  · ทักต์หลบดาเมจสกิล 15% ที่ `takt.adjustIncomingDamage` (ปืน `_itemDamage` / สถานะ / แม่นยำ หลบไม่ได้) · ไม่รับดาเมจแพ้รอบเลย = `lossDamageImmune` ใน `resolveRound`
- ผลของบทเพลงเป็น ungated: พลังโจมตี +1 (`computeAttackBase` giftAtk) · แข็งกร้าว (`critBonus` -> `Journey.applyCrit` + `critBonusFor`) ·
  ทุ้มต่ำ (`songIncoming` ใน `adjustIncomingDamage` ของมิวสิคคาร์ท — ไม่ลดดาเมจจากสถานะ) · อ่อนโยน (`songHealOnHit` หลังหมัดลง)
- ไททัน: ชุดสกิลสลับระหว่างบทเพลงผ่าน `titan.dynamicSkillFor` (ต้องตรงกันทั้ง `useSkill` และ `buildStateFor`)
  · **Triumphant 12 แต้มจ่ายร่วม**: `triumphSplit` (ไททันจ่ายทั้งหมดที่มี ทักต์จ่ายส่วนที่ขาด) แทนราคาหลังตัวปรับทุกตัวใน `useSkillCore`
    (ไม่ใช้การ์ดราชินี) · ราคาบนปุ่ม = ส่วนของไททัน · ทักต์ถูกหักที่ `applyInstantSkill` · ดาเมจลงหลังวีดีโอผ่าน `takeAfter` (ช่องเดียวกับขีปนาวุธของยูเรก้า)
  · **ตีหลายครั้ง**: `p.titan.set` สร้างที่ `beginAttack` (หัว doAttack) · หมัดต่อไปเปิดจาก `continueAttack` ที่หัว `endTurn` (ถูกหลบก็ตีต่อ)
    · Vigorous Rising Sun เล่นวีดีโอก่อนหมัดแรกของชุดแบบเดียวกับ "แน่จริงก็หลบสิ" ของคาเยนน์ (`sunNeedsVideo`)
  · ช็อตกัน +1 ทอยที่ `beginAttack` แล้วบวกใน doAttack (ห้ามทอยใน `damageBonus`)
  · **สวนกลับ (คล่องตัวสูง)**: จองที่ `onTargeted` (หัว doAttack ก่อนด่านหลบ) / `onSkillTargeted` (useSkill) / `adjustIncomingDamage` (ดาเมจสกิล)
    -> หมัดลง = สวนในการ์ดเดียวกัน (`flushCounters(engine, true)`) · ที่เหลือ flush ใน `flushOrtCounters()` · ดาเมจสวนตั้ง `_counterDamage` กันสวนกันไปมา
เทสต์: [tests/characters/takt-titan.test.js](tests/characters/takt-titan.test.js)
- **คอเซ็ตต์ ชไนเดอร์ (กลาง · มิวสิคคาร์ทตัวที่ 2)** `characters/cosette.js` — สถานะทั้งหมดที่ `p.cosette`
  · ร่างมนุษย์/พรมลิขิตปรับพลังโจมตีผ่าน `damageBonus` (มนุษย์ -1 = ตีปกติ 0) · ผลต้นเทิร์นที่ `onRoundStartTick`
  · ทิ่มแทง/Destiny ลงผลที่ `prepareOnAttack` (หลังด่านหลบทั้งหมด ก่อน `computeAttackBase` — ถูกหลบ = ไม่เล่นวีดีโอ ท่ายังค้าง)
    แล้ววีดีโอเล่นก่อนการ์ดสรุป (`cosetteFx.videoQueued` ในชุดเงื่อนไขท้าย doAttack) · ตัวคูณ Destiny อยู่ก่อนคริติคอลทุกตัว
  · Maestro: `onAttack` (หัว doAttack) จองเมื่อทักต์ออกหมัด -> `continueFollow` ที่หัว `endTurn` เปิดเฟสโจมตีให้คอเซ็ตต์
  · สกิลของร่างปกติ "ไม่ทำงานซ้อน" ระหว่างบทเพลง (ทิ่มแทงที่ค้างรอไว้หลังกลับร่าง) · Destiny จ่ายร่วมกับทักต์ผ่านช่องเดียวกับ Triumphant
  · ความเสียหายที่ลงทักต์ (สูบเลือด/พรมลิขิต) ห่อ `withEffectSource(ทักต์)` — ถ้าต้นตอเป็นคอเซ็ตต์ `friendlyEffectBlocked` จะกันไว้
- **บทเพลงพัง**: ทักต์เลือดเหลือ 1 หรือตาย -> `takt.revertCarts` (บทเพลงหาย + สตั้น 2 + `onSongLost` ของมิวสิคคาร์ท) · ตรวจที่
  `flushOrtCounters()` ท้ายลูปต้นเทิร์นของ `dealRound` และ `takt.onDeath` · ทักต์เลือด 1 มอบบทเพลงไม่ได้ · Destiny กดได้เมื่อทักต์เลือด 2+ และสูบเลือดทักต์ 2 (ทั้ง I/II · ค้างที่ 1) ตอน**ยิงโดน**เท่านั้น
  · บทเพลงหมดเวลา = Destiny/Maestro ที่ค้างหายที่ต้นเทิร์น (`cosette.onRoundStartTick`) · บทเพลงพังเล่นคลิป low ทุกครั้ง (`cosetteLow` / `titanLow`)
- **เปิดม่าน (ทักต์ สกิลติดตัว 3)**: พันธะไททัน + คอเซ็ตต์ (ไม่ซ้ำแบบ) -> socket `taktPerform {cmd, targetId}` คำสั่งละคูลดาวน์ 5
  · สั่งไททัน = `titanTauntRound` -> `titan.findTaunters` (คิว taunter ของ doAttack) + `titan.skillTargetBlocked` (ด่านแรกของ useSkill)
  · สั่งเดสตินี่ = ดาเมจสกิล 2 จากคอเซ็ตต์หลังวีดีโอ (`pausePlayingForCutscene(after)`)
เทสต์: [tests/characters/cosette.test.js](tests/characters/cosette.test.js)

**จอห์นนี่ โจสตาร์ (Tusk · ยาก)** — `characters/johnny.js` (กติกาเต็มอยู่หัวไฟล์) · สถานะเฉพาะตัวทั้งหมดที่ `p.johnny`
- **ร่างไม่ได้เก็บแยก** — `formOf(p)` อ่านจาก Pre-Awaken (0/1/2 = Act 1/2/3) และ Awakening (= Act 4) · `dynamicSkillFor`
  เลือก `secondary`..`secondary4` / `ultimate`|`ultimate2` (ราคา Tusk Evo = `ultimate.cost` + Pre-Awaken) — `publicRoster` มี `secondary4` แล้ว
- **คูลดาวน์เป็น "เลขรอบที่กดได้"** (`p.johnny.cd.*` · แยกรายท่า) · ท่าหลังเปิดไพ่ (Rapid/Ora) ค้างเป็นธงจนตีที่ผ่านด่านหลบ
  แล้วคูลดาวน์เริ่มนับตอนนั้น · Snipe / Lesson Five เป็นท่าก่อนเปิดไพ่ (`instant`) เลือกศัตรูตอนกด (`johnny.pickTarget`) ลงผลทันทีใน `applyInstantSkill`
- **กระสุนเล็บกับตีปกติ**: `johnny.onAttack` (หัว doAttack ก่อนด่านหลบ) ใช้เล็บ 1 ถ้ามี (`s.nailShot`) · `onAttackLanded` ทอย 50% หมุนวน +1
  · แต่ละนัดของ Rapid Shot ผ่าน doAttack จึงคิดเล็บแยกนัด
- **Rapid Shot นัดที่ 2-3** เปิดจากหัว `endTurn` (`continueRapid`) แพทเทิร์นเดียวกับคาเยนน์ — พลาดเอง 25% อยู่ใน `johnny.tryAttackDodge`
- **Lesson Five + Chumimi ไม่สนการลดดาเมจ**: `fireLesson` เปิดธง `p.johnny.pierce` เฉพาะช่วง `dealMixed` แล้ว
  `combat.adjustIncomingDamage` ใช้ `johnny.pierceFloor` (ฮุคตัวละคร/SE.RA.PH/เย็นชื่นใจยังทำงาน แต่ลดต่ำกว่าค่าเดิมไม่ได้)
  · ยังกันได้: ชุด Mark 42 (ดูดก่อนถึงด่าน) · โล่ (`shield`) · ผนึก/กันพวกเดียวกัน · Slow Dancer ฝั่งตรงข้าม (`warded`)
  · สตั้น 1 ทันทีแบบ Barrett ของ Recruit (`applyDebuff` + `locked = true` = เปิดไพ่ให้ เสียช่วงจั่วที่เหลือ + ชนะก็ตีไม่ได้ · หมดที่ endTurn)
  · วีดีโอ `johnnyLesson` คิวไว้ทุกครั้ง เล่นท้าย useSkill (`pausePlayingForCutscene`) หลังดาเมจลงแล้ว
- **บริบทการกด** `johnny.beginUse/endUse` ห่อ `useSkill()` และ `useInventoryItem()` (ชั้นนอกสุดเท่านั้น):
  · หมุนวน: ทอย 15% ครั้งเดียว -> `redirectTarget` ที่หัว `dealMixed/dealDirect/dealArmorOnly` ย้ายดาเมจไปลงผู้ใช้
    (ไม่ใช่ตีปกติ) · หลังย้อนครั้งแรก `redirectEffect` ย้ายดีบัฟใน `applyDebuff`/`applySpellburden`/`engine.applyBleed` ด้วย
    · **ไม่ครอบคลุม**: ดาเมจที่ลงหลังวีดีโอ (`pausePlayingForCutscene(after)`) / หลังเปิดไพ่ และสถานะที่สกิลเขียน `p.statuses` ตรงๆ
  · Slow Dancer: `onSkillFired` (หลังหักแต้มใน `useSkillCore`) ใช้ 1 ครั้งเมื่อศัตรูเล็งจอห์นนี่ แล้วกันดาเมจ/ดีบัฟจากผู้ใช้นั้นจนจบการกด ·
    ดีบัฟจากศัตรูนอกบริบทนี้กันที่ `blocksDebuff` (applyDebuff/applySpellburden/applyBleed — ต้องมี `effectSourceId`)
- **ปาดบัฟเฉพาะตัว**: `_universal_status.registerBuffSource` — `stripLatestBuff` เทียบตราเวลา (`nextBuffSeq`) กับบัฟกลาง
  ปาด Slow Dancer / Spin / Golden Ratio / Spin Mastery ได้ (ทั้งก้อน) · Pre-Awaken/Awakening ไม่อยู่ในรายการ ·
  Golden Ratio ถูกปาดใน Act 4 + Spin 15 = แปลงเป็น Golden Ratio 1 (ครั้งเดียวต่อการเข้า Act 4)
- ดีบัฟ `johnnyWhirl` (หมุนวน: เทิร์นที่ statuses · สแตคที่ statusAmt) อยู่ใน `BASIC_DEBUFF_CLEAR` · มาร์ก `johnnyChumimi` ไม่อยู่ (ต้าน/ล้างไม่ได้)
  · ทั้งสองลดเทิร์นตามลูปกลางของ `endTurn` (ไม่ใช่ NO_TICK)
- สื่อ: `client/public/characters/johnny/` (แปลงวีดีโอตามมาตรฐานสตรีมแล้ว) · เพลง `johnny_theme` ผ่าน `johnny.activeMusic` (Act 4)
  · เสียง `johnny_nail` (ตีปกติ/ยิงเล็บ) `johnny_chumimi` (ลบ Chumimi) `johnny_tusk` (Tusk Evo) · หน้าต่างเลือกสกิลพื้นฐานมีเฉพาะกระดานจอคอม
เทสต์: [tests/characters/johnny.test.js](tests/characters/johnny.test.js)

**ดิโอ แบรนโด (Stardust · กลาง)** — `characters/dio.js` (กติกาเต็มอยู่หัวไฟล์) · สถานะเฉพาะตัวทั้งหมดที่ `p.dio` · พลังชีวิต 6 / เกราะ 4
- **เกจเวลา 0-6** (`p.dio.meter`) คิดที่ `dio.onRoundResolved` ใน `resolveRound()` (หลัง kotone/kim เปลี่ยนแต้ม · ก่อนดวล/ไล่ล่า/Overload Force)
  ไม่แตก +1 · 21 พอดี +1 เพิ่ม · แตก -2 · เทิร์นที่ถูกแช่นอกวงดวล (`dioFrozen`/`brianFrozen`/`connorFrozen`) ไม่นับ
- **Vampire** = `dio.adjustIncomingDamage`: ต้นตอเป็นศัตรู (`effectSourceId` ≠ ดิโอ · ไม่ใช่ `_statusDamage`/`_itemDamage`) และ n > 0 ->
  กลางวัน +1 / กลางคืน -1 ทุกหมัด · ดาเมจแพ้รอบไม่ผ่าน hook นี้อยู่แล้ว (`damageSoft`) · ดูดเลือด +1: ตีปกติ (`dio.onAttackLanded` ใน `doAttack`)
  และสกิลที่ทำความเสียหายได้จริง 1 ครั้งต่อการกด (`dio.hit` เทียบเลือด+เกราะ+โล่ก่อน/หลัง)
- **Last stand**: ตัดสินใน `adjustIncomingDamage` (จะตาย หรือโดนตอนเลือด 1) แล้ว **ตัดดาเมจให้เหลือพอดีค้างที่ 1** (เกราะ/โล่ยังรับก่อน)
  · ตาข่ายอีก 2 ชั้น: `combat.instantDeath` เรียก `dio.tryLastStandOnDeath` (สังหารทันทีจากศัตรู) และ `dio.tryDeathSave` ผ่าน `maybeBeatSave`
  — เทิร์นที่ Last stand ทำงาน (`lastStand.trigRound`) ดิโอค้างที่ 1 จนจบเทิร์นเสมอ (กันหมัดที่ไม่สนการลดดาเมจของจอห์นนี่ทะลุเพดาน)
  · ดวลเริ่มที่ `dio.onRoundStartAfterLoop` (หลังลูปต้นเทิร์นของ `dealRound` ข้างคอนเนอร์) ยืมโครงการแข่งของไบรอันทั้งดุ้น:
  `dioFrozen` ที่ `bustedOf` · `dio.duelResolveRound` เข้าคุม `resolveRound` แล้ว `return` (ข้าม afterResolve) · `skillBlocked`/`itemBlocked` ทุกคน
  · มีดวลไบรอัน/ไล่ล่าคอนเนอร์ค้างอยู่ = เลื่อนไปเทิร์นถัดไป · แพ้ = `instantDeath(dio, true)` หลังคิวคลิป `dioLastStandFail`
- **THE WORLD** (`p.dio.world = { actions, resume }`): Za warudo จำ `engine.timeLeft` ไว้ที่ `resume` แล้ว `engine.setTimeLeft(10)` ก่อน
  `pausePlayingForCutscene()` ท้าย useSkill อ่านค่า -> นาฬิกา 10 วิเริ่มหลังคลิป (สุ่ม 1 จาก 3) จบ และหยุดนับระหว่างคลิปของท่าในร่างหยุดเวลาเอง
  · ครบ 10 วิ = ตัวจับเวลาเรียก `summary.resolveRound` -> ดักที่หัวฟังก์ชันด้วย `dio.endWorldOnTimeout` แล้วตั้งเวลาเฟสจั่วไพ่ที่เหลือคืน
    (ตัวจับเวลา 10 วิคือตาข่ายกันห้องค้างในตัว ดิโอหลุดเน็ตก็จบเอง) · `checkAllLocked` ไม่สรุปรอบระหว่างนี้ (`dio.pendingResolve`)
  · ชุดหยุดเวลา: SHINEI! 3 · Barrage 3 · Road Roller ขั้นต่ำ 3 (ใช้หมด) — **ทุกท่า 1 ครั้งต่อ THE WORLD** (`p.dio.world.used` สร้างใหม่ทุกครั้งที่กด Za warudo)
    · ไม่เหลือท่าที่ใช้ได้ (`worldAnyOpen`: แอคชันไม่พอ หรือใช้ครบแล้ว) / Road Roller / ดิโอตกรอบ / จบเทิร์น = `endWorld` คืน `timeLeft` ทันที
  · แช่ทุกคน (รวมไรเดอร์ Clock Up) ด้วย `dio.actionBlocked` ข้างๆ `daisuke.actionBlocked` ทุกจุด (hit/lock/ร้าน/ไอเทม/ปุ่มเฉพาะตัว)
    — ดิโอเองก็จั่ว/เปิดไพ่/ใช้ไอเทมไม่ได้ ทำได้แค่ชุดหยุดเวลา (`dio.skillBlocked` ปล่อยเฉพาะเจ้าของท่า)
  · ชุดหยุดเวลา = `basic2/secondary2/ultimate2` ผ่าน `dio.dynamicSkillFor` (useSkill + buildStateFor) · ราคาแต้มสกิลถูกทับเป็น 0 ที่
    `dio.freeCost` (Za warudo ด้วย) · ไม่กินโควตาสกิล (`dio.skipsTurnQuota`) · ปุ่มฝั่ง client ใช้ `skillLocks` + `costLabel` (ป้ายราคาเป็นแอคชัน)
- **Throwing knife สองคลิป**: กดปุ่ม -> socket `dioKnifeAim` (`dio.aimKnife` เช็คว่ากดได้จริง · 1 ครั้ง/เทิร์น) เล่นคลิปง้าง ->
  client ค้างโหมดเลือกเป้าผ่าน CUTSCENE (`giftSel.keep`) -> useSkill เล่นคลิปขว้าง · ไม่มี aim ในเทิร์นนั้น = เล่นสองคลิปต่อกันหลังเลือกเป้า
  · ทั้งสองคลิปเล่น **ครั้งแรกต่อเกมเท่านั้น** (`p.cutsceneShown.dioKnifeAim` / `.dioKnifeThrow` แยกรายคลิปผ่าน `queueOnce`) — ครั้งต่อไป
    `aimKnife` คืน false (ไม่เล่น ไม่พักเฟส) และคลิปขว้างเป็นการ์ดแจ้งเตือน `notifyTransform` แทน
- **คลิปสุ่ม**: Barrage (ทั้งสองร่าง) สุ่ม `dioBarrage`/`dioBarrage2` 1 คลิป · Za warudo สุ่ม `dioWorld1-3` 1 คลิป ทุกครั้งที่กด (`pickClip` ใช้ `Math.random`)
- **เลือกเป้ารายหมัด** (Barrage 2 หมัด · Barrage ร่างหยุดเวลา 3 · Road Roller 2): client เก็บ `giftSel.picks` จนครบ `need`
  (= `dio.publicState().picks[tier]` · ศัตรูเหลือคนเดียวคลิกเดียวครบ) แล้วส่ง `targets` ทั้งชุด · server `dio.prepareTarget(…, tier)`
  คืน array รายหมัด: id ที่เล็งไม่ได้ใช้เป้าที่ถูกต้องก่อนหน้าแทน (หมัดแรก = คนแรกที่ถูกต้อง) · ส่งไม่ครบ = ต่อด้วยเป้าสุดท้าย · ไม่มีเป้าถูกต้องเลย = กดไม่ได้
  · ลงผลทีละหมัดตามลำดับ (`dio.multiHit`) — เป้าที่ตายไปก่อนถึงหมัดนั้น **ข้าม** (ไม่เปลี่ยนเป้า) แล้วลงบันทึก · ผุพังลงทุกคนที่โดน (คนละครั้ง)
    · Vampire 1 ครั้งต่อการกด
- คูลดาวน์เป็น "เลขรอบ" แบบ `ippo.setCooldown` (`p.dio.cd.*`) · ผลของสกิลลงทันทีตอนกด แล้วคลิปเล่นตาม (ไม่ใช่วีดีโอก่อนดาเมจ)
- สื่อ: `client/public/characters/dio_brando/` (โฟลเดอร์ `Dio/` ต้นฉบับชื่อซ้ำแบบไม่สนตัวพิมพ์บน Windows จึงใช้ชื่อนี้)
  · วีดีโอแปลงตามมาตรฐานสตรีมแล้ว และขยายเสียงที่ตัวไฟล์ให้ใกล้ -16 dBFS (ต้นฉบับเบา -28 ถึง -35) · `dio_laststand_fail.mp4` ลดใน `LOUDNESS_GAIN`
เทสต์: [tests/characters/dio.test.js](tests/characters/dio.test.js)

**นักบินปริศนา (Silver Bullet)** — `characters/sliver_bullet.js` · id `sliver_bullet` (สะกดตามโฟลเดอร์สื่อ) · ง่าย · **unique** · พลังชีวิต 3 เกราะ 2 · ไม่มีท่าไม้ตาย (`ultimate: null` แบบ ORT)
— ตัวอย่างของ "ผู้เล่นที่อยู่นอกสนาม" (ซ่อนตัวทั้งเทิร์นโดยที่ศัตรูไม่รู้ว่ามีอยู่)
- **แขน** (`p.sliver.arm` เริ่มมี) · สกิลพื้นฐาน "เปลี่ยนชิ้นส่วน" ราคา 2 (ไม่มีแขน: ได้แขน + ฟื้น 1) / 3 (มีแขน: ฟื้น 2) — ราคาสลับผ่าน
  `sliver_bullet.dynamicSkillFor` ทั้ง `useSkill` และ `buildStateFor` (ราคาบนปุ่มตรงกับที่หัก) · ไม่มี skillFlash กลาง (`ownNotice`) ใช้คลิป
  `sliverReload` ครั้งแรกต่อเกม แล้วเป็น `notifyTransform` + เสียง `sliver_reload` · **ไม่ทำให้ปรากฏตัว**
- **Beam Magnum** (4 · ต้องมีแขน · เสียแขน · เลือกศัตรู 1 คนจาก `attackableTargets`) — ปรากฏตัวทันทีที่ผ่าน `canUseSkill` (ก่อนด่านเหน็บชา/ป่าไม้ต้องสาปที่ขึ้นป้ายชื่อ)
  แล้วยิงดาเมจ 4 แบบ **ไอเทม** (`t._itemDamage = true` รอบ `dealMixed` แบบกระสุน Nursedessei — ฮุคหลบ/ลดดาเมจสกิลที่ยกเว้นไอเทมไม่ทำงาน
  เช่นทักต์ อิปโป Kim ไททัน ดิโอ · ลดเกราะก่อน · ไม่บวกเปราะบาง) · คลิป `sliverBeam` ครั้งแรกต่อเกม แล้วเป็นเสียง `sliver_shot` + skillFlash ปกติ
  · ตีปกติก็ใช้เสียง `sliver_shot` (`attackSoundOf`)
- **ซุ่มโจมตี (ซ่อนตัว)** — เปิดเฉพาะ ffa/duo/trio (SE.RA.PH / Purge / Type Mercury = อยู่บนสนามตลอด) · เงื่อนไข ffa: ผู้รอด (รวมตัวเอง) ≥ 3 ·
  ทีม: เพื่อนร่วมทีมรอด ≥ 2 (duo ไม่มีทางเข้า) · `onRoundStart` (ก่อนลูปแจกไพ่ของ `dealRound`) ซ่อน + สุ่มร่างที่สิง (`p.sliver.hostId`) ใหม่ทุกเทิร์น
  - **`combat.alivePlayers()` ไม่นับคนที่ซ่อนอยู่** (`sliver_bullet.offField`) — จุดเดียวที่ทำให้โจมตีปกติ/สกิลหมู่/สุ่มเป้า/การนับคนในสนามของ
    ทุกตัวละครข้ามเขาโดยไม่ขึ้นบันทึก · ระบบที่ต้องนับเขาใช้ **`combat.livingPlayers()`**: `checkAllLocked` (รอ "เตรียมพร้อม") ·
    แต้มสกิล/เหรียญ/ชิวๆ จบเทิร์น · `resolveRound` ล็อกทุกคน · เงื่อนไขจบเกม (`aliveHumans`) นับเขาอยู่แล้ว
  - เป้าที่ส่งมาตรงๆ ถูกปัดที่ปากทาง (`untargetable`): `useSkillCore` (ข้างผู้วิงวอน) · `useInventoryItemCore` · `gutsFireTargetOf` — ยกเว้นตัวเขาเอง
  - ไม่ได้ไพ่ (`noCards`: ไพ่ใบแรกของ `dealRound` / Overload Force · Calamity ค้างไว้) · `hit()` ไม่ได้ · ไม่อยู่ใน combatants ของ `resolveRound`
    (ไม่ชนะ/ไม่แพ้/ไม่รับดาเมจแพ้รอบ)
  - **"เตรียมพร้อม" = socket `lock` เดิม** -> `p.locked = true` (ความหมายเดียวกับเปิดไพ่ — ถูกต้องตรงนี้) + `readied` (`onLock`) ·
    ติดสตั้น/หลับตอนต้นเทิร์นระหว่างซ่อน = นับเป็นเตรียมพร้อม · กดแล้วก็ใช้สกิล/ไอเทมไม่ได้แล้ว (ด่าน `p.locked` เดิม)
  - **ข้อมูลรายผู้ชม**: `buildStateFor` ตัดเขาออกจาก `players` ทั้งก้อนสำหรับคนที่ไม่ใช่ตัวเอง/เพื่อนร่วมทีม (`hiddenFrom` — GAMEOVER เปิดให้ทุกคน)
    · ฟิลด์ `sliver_bullet` = `{ hidden, hostId, hostName, arm, readied, revealed, sitOut, basicCost }` (host/hidden/readied จริงเฉพาะคนใน)
    · `log` ผ่าน `filterLog`: บรรทัดที่มีชื่อเขาซึ่งเกิดระหว่างซ่อน (ก่อน `revealLogIdx` = `engine.logLength` ตอนปรากฏตัว) ไม่ส่งให้ศัตรู
    · คลิป/การ์ด/เสียงของสกิลพื้นฐานระหว่างซ่อนใช้ `onlyFor` (ตัวเอง + เพื่อนร่วมทีม) — `notifyTransform(p, key, onlyFor)` และ
      `engine.sfx(sound, onlyFor)` รับ `onlyFor` แล้ว (ส่ง `io.to(id)` รายคน) · Mark 42 ใส่เองระหว่างซ่อนก็ใช้ช่องทางนี้ (`privateAudience`)
    · สกิลพื้นฐานระหว่างซ่อนเงียบแบบชิโด (`silentSkill`: ไม่เข้า `roundSkills` / ORT / ป้ายเหน็บชา) · **ไม่มีบรรทัดไหนพูดถึงการสิง/ร่างที่สิง**
  - ตาข่าย: `adjustIncomingDamage` ของเขาคืน 0 ให้ดาเมจจากคนอื่นที่หลุดมาถึงระหว่างซ่อน
- **ปรากฏตัว** (`reveal` — บรรทัด "ปรากฏตัวบนสนาม" เปิดเผยได้ · อยู่บนสนามจนจบเทิร์น · ต้นเทิร์นถัดไปซ่อนใหม่ถ้าเงื่อนไขยังจริง):
  1. Beam Magnum · 2. ไอเทมที่เล็งคนอื่น (กระสุน GUTS หลังผ่าน `gutsFireTargetOf` · Mark 42 ให้/ระเบิด · คุมชุดบนตัวคนอื่นใน `mark42Control`) ·
  3. ร่างที่สิงรับดาเมจ > 0 จากสกิล/ไอเทมโจมตี (มีต้นตอเป็นคนอื่น · ไม่ใช่ตีปกติ/`_statusDamage`) **ช่วงจั่วไพ่** — เช็คท้าย
     `combat.adjustIncomingDamage` (`onDamageTaken`) · "ช่วงจั่วไพ่" = PLAYING/CUTSCENE ก่อน `resolveRound` (`p.sliver.resolvedRound`) ·
  4. ร่างที่สิงตาย (ทุกเฟส) · 5. เงื่อนไขหมดเพราะมีคนตาย — ทั้งสองเช็คที่ `instantDeath` (`onDeath` -> `recheck`) และหลังลูปต้นเทิร์น
  · ไม่ปรากฏ: สกิลพื้นฐาน · ร่างที่สิงโดนตีปกติ · สกิลหมู่/สุ่ม (ข้ามเขาอยู่แล้ว) · ไอเทมใส่ตัวเอง · กดเตรียมพร้อม
- ปรากฏตัวกลางเฟสจั่วไพ่ = จั่วต่อจาก 0 ใบและร่วมตัดสินรอบตามปกติ · **ถ้ากดเตรียมพร้อมไปแล้ว** = `sitOut` (`sitsOutRound` กรองออกจาก combatants
  ของ `resolveRound` · ไม่รับดาเมจแพ้รอบ) แต่ถูกเล็ง/โจมตีได้ · ปรากฏตัวตอนต้นเทิร์น (ร่างตายจากผลต้นเทิร์น) = ไม่มีไพ่ใบแรก จั่วจาก 0
- จบเกม: ซ่อนอยู่ก็ยังนับเป็นผู้รอด · ffa เหลือ 2 คนเมื่อไหร่ปรากฏตัวเอง (ไม่มีทางค้าง) · trio ทีมเขาชนะได้ทั้งที่ยังซ่อน · สถานะทั้งหมดอยู่ที่ `p.sliver`
  (ย้อนได้ผ่านสแนปช็อต Overload Force/ชิโด)
- **ที่ยังไม่ครอบคลุม**: socket ที่รับ id เป้าหมายนอก `useSkill`/ไอเทม (เช่น `bardTarget`) ไม่ได้ปัดเป้าที่ซ่อนอยู่ (client ไม่มีที่นั่งให้กด) ·
  ระหว่างคลิปสกิลพื้นฐานครั้งแรกตอนซ่อน ทุกคนยังหยุดรอเวลาเท่ากัน (ศัตรูเห็นกระดานค้างเฉยๆ ไม่รู้ว่าใคร) · ผลสนามของการเดินทางที่วนผ่าน
  `alivePlayers` ข้ามเขาระหว่างซ่อน
เทสต์: [tests/characters/sliver_bullet.test.js](tests/characters/sliver_bullet.test.js)

**Echo (`echo_queen` · พิเศษ · unique)** — `characters/echo_queen.js` (กติกาเต็มอยู่หัวไฟล์ · สเปกล็อก `.claude/plans/echo-queen-plan.md` §1)
· เลือด 10 · เกราะ 0 · เพดานเลือด = 10 + 2×ขยายร่าง (`maxHpOf`/`maxArmorOf`) · ราคา 0/0/8 · ยังไม่มีภาพ/คลิปสกิล (ปุ่มวาด ✦)
- **สถานะทั้งหมดอยู่ที่ `p.echoQ`** (`lv` · `queenFrom/queenUntil` · `cdRound` · `atkBuffUntil/atkBuffN` · `killAtk` · `ultFrom/ultUntil` ·
  `freeHitRound/freeHitTarget`) — ไม่ใช่ `p.statuses` จึงล้าง/ต้าน/ปาดไม่ได้ (ยกเว้น Overwrite ของ Echo เอง) · ทุกช่วงเวลาเป็น "เลขรอบ"
  (ราชินี 10 เทิร์น = `queenUntil = กด + 9` · มหึมาคูลดาวน์ 12 = `cdRound = กด + 12` คือเลขรอบที่กดได้ · ท่าไม้ตาย 5 เทิร์นนับเทิร์นที่กด)
  · plain object -> สแนปช็อต Overload Force/ชิโดย้อนคืนพร้อมทุกอย่าง (ไม่อยู่ใน `keep`) · ล้างที่ `resetCombat`
  · ข้อยกเว้นเดียวที่เป็นสถานะจริง: ต้านสถานะ 20% ต้นเทิร์น (`applyBuff(p, "resist", null, 1)` ใน `onRoundStartTick`)
- ต้นเทิร์น (`dealRound` ข้าง `daichi`): ราชินีมีผล + ไม่ใช่เทิร์นที่กด -> ขยายร่าง +1 (`gainLevel` = เพดาน +2 แล้ว `healHp` 2)
- **คุ้มครองระดับ 1-4** = "คุ้มครอง" ปกติของเกม (ผู้ใช้ยืนยัน) — `echo_queen.guardBonus()` บวกเข้าจุดเดียวกับ `guard` กลาง
  (`attack.js` ตีปกติ/ตีฟรี + กระสุนคาเยนน์) ไม่ลดดาเมจสกิล/ลุกไหม้/แพ้รอบ · คิดสด ไม่ใช่สถานะจริง (ต้าน/ล้างไม่ได้) · หมัด 1 หน่วยเหลือ 0 โดยตั้งใจ
  (ไม่มีโล่ที่ต้องกร่อน จึงไม่ใช่กับดัก "บัฟลดดาเมจ = อมตะ") · พลังโจมตี (ระดับ 5/10 · คิล · Overwrite) ที่ `damageBonus` + ป้าย `attackFx`
- โอกาสสังหาร 5% (ระดับ 10) = `echo_queen.onAttackKill` ใน `doAttack` ถัดจาก ORT (ผ่าน `miyakoKillChance` -> ORT ต้านได้ · พลาด =
  `miyakoSurvivedKillAttempt` แบบเนตรมณะ) · `hasKillCapability` นับ Echo ระดับ 10 · สกิลติดตัวทั้งหมดปิดได้ด้วย `passiveSealed`
- คิล +1 (สูงสุด 2) = `echo_queen.onKill` ใน `instantDeath` ข้าง `ort.onKill` — ผู้สังหาร = `effectSourceId` หรือ `lastDamageSourceId`
  ของเทิร์นเดียวกัน (ตีปกติจนเลือดหมดไปตายตอนกวาดท้าย `endTurn`/หลังตีฟรี)
- ท่าไม้ตายฟื้นเลือดตัวเอง 5 ทันทีตอนกด (`healHp` ปกติ — ไม่ใช้งานต่อ/ผกผัน/เลือดไหลมีผล)
- ท่าไม้ตาย**ไม่เป็นโมฆะเมื่อไพ่แตก** (ผลลงก่อนเปิดไพ่ — ผู้ใช้ยืนยัน) → Echo ไม่อยู่ใน `voidUltimateOnBust`
  แบบเดียวกับท่าอื่นที่กลไกนี้แค่ลบสถานะ · เลือด 5 ที่ฟื้นไปตอนกดไม่ถูกดึงคืน · ปุ่ม disable ผ่าน `skillLocks` ชุดเดียวกับ `canUseSkill`
- **ตีฟรีของท่าไม้ตาย (`server/phases/echoFreeHit.js`) — เลือกตัวเลือก (ข) "เฟสโจมตีย่อย"** ไม่ใช่ (ก) แยกแกนดาเมจ:
  `doAttack` มีทางออกกลางฟังก์ชัน ~20 ทาง และฮุคตัวละครหลายตัว (หลบของ eiji/ippo/ฯลฯ · สะท้อน phenex · ดูดซับ bat_ben · สังหาร ORT)
  ตั้ง `ATTACKING` + ตัวจับเวลา -> `endTurn` เองในโมดูลของตัวเอง — แยกแกนต้องรื้อทุกตัว จึงเลือกเรียก `doAttack` ตัวจริงใต้เฟส `ATTACK` ชั่วคราว
  - `startFreeHit`: จำ `timeLeft` -> `match.echoFreeHit = { echoId, then, resume, prevAttackerId }` -> `ATTACK` + `attackerId = Echo` -> `doAttack`
    (ทุกด่านของตีปกติทำงาน: หลบ/ล่อเป้า/คุ้มครอง/สวนกลับ/เปราะบาง) · `doAttack` ปฏิเสธเป้า (เฟสยังเป็น ATTACK) = คืนเฟสทันที
  - ทุกเส้นทางจบที่ `postAttackFollowup()` หรือ `endTurn()` — ทั้งสองมีด่าน `finishFreeHit()` บนสุด: คืน `PLAYING` · flush สวนกลับ
    (`flushOrtCounters`) + luminous · **กวาดคนเลือดหมด** (`instantDeath` ไม่ห่อ effectSource) · แล้วเรียก `then` แทนการตีต่อ/จบเทิร์น
    (`postAttackFollowup` ยังลงดาเมจสวนกลับของคอนเนอร์ก่อนด่าน) — ตีเพิ่มทุกแบบเป็นของผู้ชนะรอบ ตีฟรีจึงไม่ได้
  - ระหว่างเฟสย่อยคนอื่นจั่ว/กดสกิล/เปิดไพ่ไม่ได้ (เฟสไม่ใช่ PLAYING — แบบพักดูคัตซีน) · การ์ดสรุปการโจมตีเล่นตามปกติ (`state.attack` ตอน ATTACKING)
  - ทางเข้า: socket `echoFreeHit {targetId}` (`pickFreeHit` -> คืนเวลาที่เหลือ) · Echo กด `lock` ทั้งที่ยังไม่ตี (`runPendingOnLock` สุ่มเป้า -> หมัดจบแล้ว `lock` ซ้ำ)
    · หัว `resolveRound` (`runPendingBeforeReveal` สุ่มเป้า -> หมัดจบแล้ว `resolveRound` ซ้ำ) ครอบทั้งหมดเวลาและ `checkAllLocked` · ใช้แล้ว `freeHitRound = รอบนี้` ไม่วน
  - ติดสตั้น/หลับ = ไม่มีตีฟรี (`freeHitPending`) · ไม่มีเป้าที่ตีได้ = ใช้สิทธิ์ทิ้ง · `match.echoFreeHit` ล้างที่ `dealRound`/`startMatch`/`backToLobby`
- client (จอคอมเท่านั้น): ชิป `ขยายร่าง n/10` · `ราชินีแห่ง Echo n` · `♛ n` ใน `VitalExtras` (ทุกคนเห็น) · ปุ่ม `👊 ตีฟรี` ใน `HudRight` (`EchoFreeHitPicker`)
  · `buildStateFor` -> `echoQueen` (`basicCd` + `freeHitTargets` เห็นเจ้าตัว)
  · หลอดเลือดถึง 30 บนจอคอมใช้ `StatRow` อยู่แล้ว (เกิน 9 ช่องเป็นหลอดต่อเนื่อง) — `LifeBar` แบบหัวใจเหลือใช้แค่บนมือถือ
- **เพลง `echo_queen_theme`** (`characters/echo_queen/echo_queen_theme.mp3`) ตลอดท่าไม้ตาย — `echo_queen.activeMusic()` เป็น**เงื่อนไขแรกของ `sm`**
  ใน `buildStateFor` (ทับ Overload Force / ท่าไม้ตายเอจิ / ยูนะ / ANATA / เพลงสกิลอื่นทั้งหมด — ผู้ใช้สั่งให้ไม่มีอะไรบังได้) · `at = transformAt` (กดใหม่ = เริ่มจากต้น)
  · `audioPolicy.musicForState`: คัตซีน `kind: "echoQueen"` เล่นเพลงราชินีตั้งแต่ต้นฉากเปิดตัว ไม่เงียบแบบคัตซีนอื่น
- **ฉากเปิดตัว + สนามราชินี** (จอคอมเท่านั้น):
  - server: `applyUlt` ดัน `pushCutsceneRaw({ seconds: INTRO_SECONDS (13), info: { kind: "echoQueen", playerId, … } })` (ไม่มีคลิป) →
    `useSkill` พักช่วงจั่วไพ่ (`pausePlayingForCutscene`) แล้วคืนเวลาที่เหลือ · `buildStateFor.echoField` = `{ ownerId, seq, turnsLeft }` หรือ null
    · `lastAttack` ทุกจุดมี `byId`/`targetId` แล้ว (client เล็งกำปั้นไปการ์ดเป้าได้)
  - client: `echoQueen/echoQueenStage.js` (canvas ล้วน ย้ายจากต้นแบบ `.claude/plans/echo-queen-artifact/`) + `EchoQueenLayer.jsx` ใน `GameBoard`
    · canvas 2 ชั้น: `.echoq-back` (สนาม — ต่อจาก `GameBackground` ก่อนกรอบกระดาน = หลังการ์ดผู้เล่น/HUD) · `.echoq-fx` (z 90 ฉากเปิดตัว/กำปั้น/อนุภาค ไม่รับคลิก)
    · ฉากเปิดตัว 12 วิ: ช่วงแรกทับกระดานจริงแบบโปร่ง (กลิตช์/ภาพแวบ/"ECHO"/ม่านหุบเข้าการ์ด Echo) แล้วทึบทั้งจอ · `Cutscene`/`csSkipped` ข้าม kind นี้ (lowQ ก็เล่นแบบลดเอฟเฟกต์)
    · สนาม: `onCover(true)` → `GameBackground hidden` (visibility — ไม่ถอด ไม่งั้นสนาม 2.5D เล่นฉากพุ่งลงซ้ำ) = ฉากหลัง/สนามของตัวละครอื่นไม่ทับ
    · ต่อย = `state.attack.byId === echoField.ownerId` (รวมตีฟรี) กำปั้นพุ่งไปกลางการ์ดเป้า (`otherRefs`) / เราโดน = พุ่งเข้าจอ · โดนตี = สั่น+เรืองแดง
    · `echoField` หายไป = ฉากออก 3.2 วิ (โบกลา → สลายเป็นพิกเซล → กระดานพลิกหาย → กลิตช์กลับสนามปกติ)
    · ฉากย้ายภูมิภาคไม่บัง: App ไม่ตั้ง `travel` ระหว่างมี `echoField` (server ยังพักเกมตามเดิม)
  - หน้า dev: `?hud=1&game=1&echo=1` (GamePreview — ปุ่มฉากเปิดตัว/ต่อย/ต่อยเรา/โดนตี/ออกจากสนาม)
เทสต์: [tests/characters/echo_queen.test.js](tests/characters/echo_queen.test.js)

**คูลดาวน์ท่าไม้ตายที่วัดเป็น "เลขรอบ" (ชิโด · เอจิ)** — คูลดาวน์ที่กินเวลาข้ามเทิร์นห้ามเก็บเป็นตัวนับใน
`p.statuses` ถ้าไม่อยากให้มันไปโผล่ในรายการสถานะให้ทุกคนเห็น จึงเก็บเป็น **เลขรอบที่ล็อกถึง**
(`p.shidoRewindLock` / `p.eijiUltLock`) แล้วเทียบกับ `engine.roundNumber` — ไม่ต้องมีใครลดเทิร์นให้
และรอดจากการย้อนเวลาของชิโดด้วย (ดู `keepPerPlayer` ของ `applySnapshot`)
- ตั้งค่าตอนสถานะหมดอายุใน**ลูปลดเทิร์นของ `endTurn()`** (`CHAR_HOOKS.eiji.onUltExpire`) ไม่ใช่ตอนกด
- ฟิลด์พวกนี้ไม่ใช่สถานะ จึง**ต้องล้างเองใน `resetCombat()`** ไม่งั้นค้างข้ามแมตช์
- ตัวเลขที่เหลือส่งให้ client ผ่าน `shidoCd` / `eijiUltCd` แล้วโชว์ด้วย prop `cooldown` ของ `SkillSlot`
  ซึ่งเรนเดอร์เฉพาะแผงของตัวเอง — ปุ่มต้องล็อกทั้งสองฝั่ง (`canUseSkill` + `disabled` ของปุ่ม)

**อิสึกะ ชิโด (patch 2.9)** — ตัวอย่างของ "สกิลที่ต้องไม่มีใครรู้ว่าถูกกด"
- **`p.shidoRecorded`** (สกิลติดตัว) บันทึกที่ **`adjustIncomingDamage`** เพราะเป็นจุดเดียวที่เห็น
  *ขนาดของก้อนดาเมจ* ก่อนถูกหั่นเข้าเกราะ/เลือด และทุกท่อ (`dealMixed`/`dealDirect`/`dealArmorOnly`)
  วิ่งผ่านที่นี่หมด · ฮุคนี้ **ไม่แก้ค่า n** แค่จดไว้ · `damageSoft` ไม่ผ่านจุดนี้ = ดาเมจแพ้จั่ว/ไพ่แตก
  ไม่มีสิทธิ์ดีดค่าที่บันทึกไว้ (ตั้งใจ — สเปคระบุว่านับเฉพาะ "ความเสียหายจากผู้เล่นอื่น")
  - กติกาค่า: พื้น 3 · โดน**แรงกว่า**ที่บันทึก = บันทึกทับ · โดน**เบากว่า** = ร่วงกลับ 3 · เท่ากันพอดี = คงเดิม
- **Sandalphon** ใช้ `attackBaseOverride` = **แทนที่** พลังโจมตีปกติ (ไม่ใช่ `damageBonus` ที่บวกทับ)
  · ค่าที่ใช้จริงอ่านจาก **`statusAmt.shidoSword`** ซึ่งล็อกไว้ตอนกด ไม่ใช่ `p.shidoRecorded` ที่ยังขยับได้
- **ท่าไม้ตาย "ฝากด้วยนะตัวฉัน" (กับดักเงียบ `GUARD_TURNS` 3 เทิร์น) ห้ามรั่วทุกช่องทาง** — ปิดไว้ 5 ชั้น:
  0. **คำอธิบายสกิลไม่บอกอะไรเลย** — `desc` ใน `characters.js` เขียนแค่ "พลังปริศนาที่ไม่สามารถเข้าใจได้"
     (ผลจริงอยู่ในคอมเมนต์ของ `characters/shido.js` เท่านั้น) เพราะ `publicRoster()` ส่ง `desc` ให้ทุกคน
     ตั้งแต่หน้าเลือกตัวละคร — เขียนผลจริงลงไปเมื่อไหร่ก็รั่วตั้งแต่ยังไม่เริ่มเกม
     · ชื่อบนฉากคัตซีนตอนย้อนเวลาก็ไม่ใช่ชื่อท่า แต่เป็น "ฉันคงต้องกลับไปแก้ไขสิ่งที่ผิดพลาด"
  1. **ไม่ใช้ `p.statuses`** เลย (สถานะทุกตัวถูกเปิดให้ทุกคนเห็นตอน SUMMARY/ATTACK ผ่าน `revealAll`)
     เก็บที่ `p.shidoGuardTurns` ซึ่ง `buildStateFor` ส่งให้ **เจ้าของคนเดียว** (`mine`)
     -> ไม่อยู่ในลูปลดเทิร์นของ `endTurn()` ต้องลดเองผ่าน `CHAR_HOOKS.shido.onEndTurn()`
     · ตัวนับนี้ (และ `shidoCd` = คูลดาวน์หลังย้อนเวลา) โผล่เป็น **ตัวเลขทับบนการ์ดท่าไม้ตาย** ผ่าน
       prop `cooldown` ของ `SkillSlot` ซึ่งเรนเดอร์เฉพาะแผงของตัวเองอยู่แล้ว จึงไม่มีทางรั่วให้คนอื่นเห็น
  2. **`silentSkill()`** ทำให้ `useSkill()` ข้าม `io.emit("skillFlash")`
  3. **ไม่เข้า `roundSkills`** — กันไม่ให้ประวัติสกิลของเทิร์นกลายเป็นเบาะแส
  4. **แต้มสกิลหลอก** — `buildStateFor` ส่ง `maxSkillOf(p)` ให้คนอื่นเห็นแทนค่าจริงตลอดที่กับดักเปิดอยู่
     (ไม่งั้นแต้มที่หายไป 8 หน่วยเป็นเบาะแสชัดๆ)
- **ผลของกับดักคือ "ย้อนเวลากลับ 5 เทิร์น" (patch 2.9.1)** — ย้อนทุกอย่าง: พลังชีวิต/เกราะ/สถานะ/แต้มสกิล/
  เหรียญ/ไอเทม/ของในร้าน/เลขรอบ/วงจรวัน-คืน และ **ปลุกผู้เล่นที่ตกรอบไปแล้วกลับมาทั้งหมด**
  - ใช้ **ระบบสแนปช็อตตัวเดียวกับ Overload Force** แต่เก็บเป็นวงแหวนย้อนหลัง `SNAPSHOT_HISTORY_MAX` (6) ใบ:
    `buildSnapshot()` / `pushSnapshotHistory()` (เรียกคู่กับ `captureTurnSnapshot()` ปลาย `dealRound`) /
    `snapshotBefore(n)` / `applySnapshot(snap, keepPerPlayer)` — เปิดให้ hook ผ่าน `engine.*`
  - **`engine.setRoundNumber(snap.round - 1)`** ไม่ใช่ `snap.round` เพราะ `dealRound()` จะ `++` กลับเป็น
    `snap.round` แล้วเล่นเทิร์นนั้นใหม่ — ตั้งเป็น `snap.round` ตรงๆ จะข้ามเทิร์นนั้นไปเลย
  - **กันย้อนวนไม่รู้จบ**: สแนปช็อตย้อนแต้มสกิล 8 หน่วยคืนให้ชิโดและลบร่องรอยว่าเคยกดท่านี้ไปด้วย
    จึงต้องกัน `p.shidoRewindLock` ไว้ **นอกการย้อน** ผ่าน `keepPerPlayer` ของ `applySnapshot`
    (ย้อนไปรอบ 7 -> ล็อกถึงรอบ 13 = ต้องเดินหน้าครบ `REWIND_LOCK_TURNS` (6) เทิร์นจริงๆ ก่อนอาร์มกับดักได้อีก)
  - **จังหวะที่ย้อน**: `p.shidoRewindPending` ถูกตั้งที่ `onDeath()` แต่การย้อนจริงทำที่ **หัวคอลแบ็กของ
    `runCutsceneQueue` ใน `endTurn()`** — ย้อนกลาง `instantDeath()` ไม่ได้ (โค้ดที่เรียกมันยังถือ reference
    ผู้เล่นชุดเก่าค้างทั้งสแตก) และต้องอยู่ **ก่อน `alivePlayers()`/เงื่อนไขจบเกมทุกสาย** ไม่งั้นเกมจะประกาศ
    ผู้ชนะคนสุดท้ายทั้งที่อีกครู่ทุกคนกำลังจะกลับมา (`rewindPending()` กันอีกชั้น)
  - `clearSnapshotHistory()` หลังย้อน — ประวัติหลังจุดนั้นเป็น "อนาคตที่ถูกลบทิ้ง" แล้ว
- **วีดีโอคิวที่ `endTurn()` ไม่ใช่ตอนตาย** (`flushDeathVideo`) — ถ้าคิวตอนตาย `runCutsceneQueue` ของ
  `doAttack` จะกินคลิปไปเล่นกลางฉากโจมตี ผิดจากสเปคที่ต้องการให้เป็น "รอยต่อหลังหน้าจอโจมตี"
  · ลำดับจริงคือ **วีดีโอเล่นจบก่อน แล้วค่อยย้อนเวลา** (การย้อนอยู่ในคอลแบ็ก `onDone` ของคิวนั้น)
เทสต์: [tests/characters/shido.test.js](tests/characters/shido.test.js)

---

## 7. สถานะ (statuses)

- `p.statuses[key]` = **จำนวนเทิร์นที่เหลือ** (หรือจำนวนสแตค แล้วแต่ key)
- `p.statusAmt[key]` = **ขนาดของผล** (เช่น guard 2 = ลดดาเมจ 2) — อ่านด้วย `statusAmtOf(p,key)` เสมอ
- ลดเทิร์นทั้งหมดที่ลูปใน `endTurn()` `:5397` — **key ที่ไม่ควรลดเทิร์นต้อง `continue;` ในลูปนั้นเอง** (มี ~40 ข้อยกเว้น พร้อมคอมเมนต์เหตุผลรายบรรทัด)

**บัฟกลาง** (`_universal_status.js`): `spellflow` (สกิลถูกลง) · `might`/`empower` (เสริมพลัง) · `guard` (คุ้มครอง) · `resist` (ต้านสถานะ) · `fortune` (โชคลาภ) · `evade` (หลบหลีก) · `netramana` (โอกาสสังหาร 20%) · `accurate` (แม่นยำ — เจาะการหลบทุกแบบ)

**ดีบัฟกลาง**: `spellburden` (ภาระเวท — ดูกล่องด้านล่าง) · `weak` · `fragile` · `sleep` · `stun` · `nodraw` · `noskill` · `nohealing` · `invert` (ผกผัน) · `hburn` (ลุกไหม้) · `hbleed` (เลือดไหล — ดูกล่องด้านล่าง) · `chaa` (จั่ว 1 ครั้งได้ 2 ใบ) · `decay` (ผุพัง เกราะไม่ฟื้น)

> ⚠️ **กติกาการมอบ `hburn`/`hbleed` ตอนต้นเทิร์น** — `tickBurn()`/`tickBleed()` ถูกเรียก **ในลูป
> `for (const p of Object.values(players))` ของ `startRound()`** (ถัดจาก `CHAR_HOOKS.*.onRoundStartTick`
> ไม่กี่บรรทัด) ดังนั้นฮุค `onRoundStartTick` ที่แจกลุกไหม้/เลือดไหล **ให้ผู้เล่นคนอื่น** ห้ามแปะตรงๆ:
> คนที่ลูปยังวนไม่ถึงจะถูกติกกินหน่วยที่เพิ่งได้ทิ้งในเทิร์นเดียวกัน ส่วนคนที่วนผ่านไปแล้วถึงจะรอเทิร์นถัดไป
> จริง = **ผลไม่เท่ากันตามลำดับที่นั่ง** ให้พักไว้ในคิวของตัวเองแล้ว flush หลังลูปจบ (ต้นแบบ:
> `escanor.queueBurn()` + `escanor.flushPendingBurn(engine)` ที่ถูกเรียกหลังลูปใน `startRound()`)
> — flush อยู่ก่อน `gameState = "PLAYING"` ดีบัฟจึงติดให้เห็นตลอดเทิร์น แค่ยังไม่ติกจนกว่าจะขึ้นเทิร์นใหม่
> · ถ้าฮุคใช้ `withEffectSource` อยู่ ต้องเก็บผู้มอบไว้แล้วคืน source ตอน flush ด้วย ไม่งั้น
> `friendlyEffectBlocked` ในโหมดทีมจะไม่ทำงาน

**ดีบัฟเฉพาะผู้สังหารเมจ** (อยู่ใน `BASIC_DEBUFF_CLEAR` — ต้านสถานะผิดปกติล้างได้ทั้งคู่)
- `mageslayerMark` (ตราล่าเวท) — ไม่ลดเทิร์น (`continue` ใน `endTurn`) ถาวรจนย้ายมาร์ก/ถูกล้าง · ฝั่งผู้ร่ายเก็บที่
  `ms.mageslayerMarkedId` + `target.mageslayerMarks[msId]` และ reconcile ให้เองที่ `tickWitchMark()` ท้ายเทิร์น
- `manaLeech` (ดูดซับเวท) — ลดเทิร์นตามปกติ · ทริกที่ `useSkill()` และที่ `addSkill()` ที่มี `src`
  · `applyManaBurden()` ตั้งเวลาผ่าน `setTurnsNoRefresh()` (ไม่ต่ออายุเหมือนภาระเวท)
  · โอกาสขโมยคิดที่ `leechChanceFor()` — 35% ปกติ / **60% ถ้าเป้าหมายติด `mageslayerMark` อยู่ด้วย**

**เลือดไหล (`hbleed`) — สถานะ Universal (patch 2.5)**
กลไกเหมือน `hburn` ทุกอย่าง: ดาเมจ 1 หน่วยต่อเทิร์น (เกราะก่อน) แล้วลดสแตคลง 1 ที่ `tickBleed()` ต้นเทิร์น (เรียกคู่กับ `tickBurn` ใน `dealRound`)
- ใส่สถานะผ่าน **`engine.applyBleed(p, n)`** เท่านั้น (เคารพ `resist` + เพดาน `HBLEED_MAX = 6`) — ห้ามเขียน `p.statuses.hbleed` ตรงๆ
- อยู่ใน `BASIC_DEBUFF_CLEAR` (ต้านสถานะล้างได้) และ `NO_TICK_STATUS` (ลูป `endTurn` ต้องไม่ลดซ้ำ)
- **ผลข้างเคียงที่ต่างจากลุกไหม้**: ระหว่างติดอยู่ การฟื้นพลังชีวิตเหลือครึ่ง (`bleedHealPenalty` ใน `healHp()`) — ฟื้น 1 หน่วยไม่ถูกลด
- ฮุครายตัวละคร (ไม่ต้องแก้ `_universal_status.js`): `hbleedImmune(p)` / `hbleedHeals(p)` / `hbleedLabel(p)` / `hbleedHarmless(p)`
  (`hbleedHarmless` คุมเฉพาะการลดครึ่งของ `healHp` — ฮารุกะคืน `true` ทั้ง `hbleedHeals`/`hbleedHarmless` จึงไม่มีผลเสียกับเธอเลย)
- เทสต์: [tests/characters/haruka.test.js](tests/characters/haruka.test.js)

**มิซึซาว่า ฮารุกะ — New Omega "ระเบิดแต้มการ์ด" (patch 2.8.1)**
ท่าไม้ตายอยู่ 10 เทิร์น (เดิม 5) และ **กดซ้ำได้แม้โอเมก้ายังทำงานอยู่** — เพราะการระเบิดผูกกับ "การกด 1 ครั้ง"
ไม่ใช่ "ระหว่างที่สถานะติดอยู่" (ถ้ายังล็อกปุ่มไว้เหมือนเดิม จะระเบิดซ้ำไม่ได้เลยตลอด 10 เทิร์น)
- ธง `p.harukaBurst` แปะให้ผู้เล่นทุกคน **ยกเว้นฮารุกะ** -> `bustedOf()` คืน true ทันที ต่อให้ `locked` ไปแล้ว
  (เช็คอยู่ **ก่อน** `overloadForceActive` เพราะเป็นการ "สั่งให้แตก" ไม่ใช่ผลการคิดแต้มที่สนามปลดเพดานได้)
- `resolveRound()` ยกเว้น**เฉพาะ**ความเสียหายจากการไพ่แตกผ่าน `CHAR_HOOKS.haruka.bustDamageImmune()`
  (ยังได้แต้มสกิลปกติ) — เอฟเฟกต์ตัวละครอื่นที่เกาะกับ "คนไพ่แตก" (Ashen Trail, ครูฝึกสุดเหี้ยมของดัน,
  ทาคุมิ) **ยังทำงานตามปกติ** โดยตั้งใจ
- ธงถูกล้างที่ `clearBurst(p)` ในลูปต้นเทิร์นของ `startRound()` ซึ่งต้องอยู่ **ก่อนแจกไพ่ใบแรก**
  ไม่งั้น `onCardDrawn`/`bustedOf` ระหว่างแจกจะอ่านธงของเทิร์นที่แล้ว
- สกิลรอง "จงไปสู่สุขติ" **ไม่ถูกใช้หมดหลังระเบิดครั้งแรกแล้ว** — อยู่ครบ 3 เทิร์น จุดชนวนได้ทุกหมัดที่เข้าเกณฑ์
  (เลือดไหลของเป้าหมายยังถูกล้างทุกครั้ง จึงต้องสะสมใหม่ให้ครบ 3 หน่วยก่อนถึงระเบิดได้อีก)

**ภาระเวท (`spellburden`) — กฎกลาง ห้าม bypass**
ทุกแหล่งต้องเรียก **`engine.applySpellburden(p, turns)`** เท่านั้น (`_universal_status.js` → wrapper ใน `server/combat.js`)
ห้ามเขียน `p.statuses.spellburden` / `applyDebuff(p, "spellburden", ...)` ตรงๆ
- จำนวนสะสม **+1 ต่อครั้ง เพดาน `SPELLBURDEN_MAX = 2`** (เพิ่มราคาสกิลของเป้าหมายได้มากสุด 2 แต้ม)
- **ใช้ซ้ำใส่คนเดิมขณะสถานะยังติดอยู่ = ไม่ต่ออายุ** — `turns` ใช้เฉพาะตอนที่สถานะยังไม่ติด (ผ่าน `setTurnsNoRefresh()`)
- `turns` เป็นของแต่ละแหล่ง: ผู้สังหารเมจ `MS_BURDEN_TURNS` 5 · ซาโตรุ `SPELLBURDEN_TURNS` 4 · โคโตเนะ `KOTONE_DANCE_NIGHT_BURDEN` 2
- `resist` กันได้ทั้งก้อน (คืน `false`) · หมดอายุที่ `endTurn()` แล้วล้าง `statusAmt` ให้เอง (จำนวนไม่ค้าง)
- wrapper ใน `server/combat.js` กันเฉพาะ "เพื่อนร่วมทีม**คนอื่น**" ไม่กันการใส่ตัวเอง — สกิลที่แลกภาระเวทของตัวเองเป็นพลัง
  (Dance Lession กลางคืน) ต้องทำงานได้ในโหมดทีมด้วย
- เทสต์: [tests/spellburden.test.js](tests/spellburden.test.js)

- **ล้างดีบัฟ "ที่โดนล่าสุด"** `cleanseLatestDebuff(p)` (โอเบรอนฤดูร้อน/อาร์โทเรีย): `applyBuff`/`applyDebuff`/`applyBleed` ประทับ `p.statusAt` ให้ดีบัฟในรายการที่ล้างได้ด้วย (เดิมเฉพาะบัฟ)
  ดีบัฟที่เขียน `p.statuses` ตรงๆ ไม่มีตรา = ถือว่าเก่ากว่า · `SOFT_DEBUFF_STEP` ลดทีละ 1 ที่เหลือล้างทั้งก้อน
- `applyDebuff()` คืน `false` ถ้าโดน `resist` กัน — `BASIC_DEBUFF_CLEAR` คือรายการที่ต้านสถานะล้างได้ทั้งหมด, `SOFT_DEBUFF_STEP` (`dawn`, `deathline`) ล้างได้ทีละ 1 สแตค
- **`evade` เป็นกรณีพิเศษ**: ตัวจริงอยู่ใน `p.evadeStacks` (array อายุต่อสแตค, สูงสุด 3 สแตค × 2 เทิร์น) — `p.statuses.evade` เป็นแค่ mirror ใช้ `grantEvadeStack`/`consumeEvadeStack`/`tickEvadeStacks` เท่านั้น ห้ามแตะตรงๆ

---

## 8. คัตซีน / แปลงร่าง

- **เสียงฝั่ง client:** `audioPolicy.js` กำหนดลำดับคัตซีน/เสียงพากย์ → เพลงสกิล → เพลงสนาม ทั้งเกมปกติและ Moon Cell
  คัตซีนที่ถูกซ่อนจากผู้ชมไม่หยุดเพลงของผู้ชมคนนั้น · โหมดประหยัดเล่นเพลงต่อได้เมื่อข้ามวิดีโอ
  `playCutsceneVideo()` พักเพลงด้วย `suspendMusic()` จนกว่าจะออกจากคลิป และคืนเสียงหลัง autoplay บังคับปิดเสียงเมื่อผู้เล่นคลิก/กดแป้นพิมพ์
  เสียงพากย์ประกาศร่างต้องหยุดเมื่อออกจากฉาก · เสียงจบเทิร์นติดตามจาก PLAYING ผ่านคัตซีนถึง SUMMARY และเสียงโจมตีนับตาม `attack.id`
- **สัดส่วนผสมเสียง (`client/src/audio.js`):** ระดับ = ฐานตามชนิด × ค่าปรับรายไฟล์ × `masterGain()`
  ฐาน: เพลง `MUSIC_BASE` 0.75 (เดิม 0.5 — ผู้เล่นบอกว่าเบาไป) · เอฟเฟกต์/เสียงพากย์ `SFX_BASE` 1 · คลิก `CLICK_BASE` 0.55 · วีดีโอ `VIDEO_BASE` 1 (เพลงถูกพักระหว่างวีดีโอ)
  ลูปเสียงเฉพาะกิจ (`startLoopSfx`) ใช้ฐานเพลง เพราะมันเล่นแทนเพลงประกอบ
  `LOUDNESS_GAIN` = ตารางค่าปรับรายไฟล์ (key = path) สร้างจากการวัด RMS แบบตัดช่วงเงียบ เป้า เพลง/เอฟเฟกต์ -14 · วีดีโอ -16 dBFS
  ค่าปรับลดได้อย่างเดียว (HTMLAudio `volume` เกิน 1 ไม่ได้) — ไฟล์ที่เบาเกินจึงถูกเข้ารหัสใหม่ให้ดังขึ้นที่ตัวไฟล์ (ต้นฉบับสำรองที่ R2 `_backup_audio/`)
  **ไฟล์เสียง/วีดีโอใหม่:** วัดความดังก่อนใส่ ถ้าดังกว่าเป้าให้เพิ่มลงตาราง ถ้าไม่อยู่ในตาราง = ไม่ลด
- **มาตรฐานไฟล์วีดีโอคัตซีน** (วีดีโอสตรีมจาก R2 ซึ่งเร็วแค่ ~1-5 Mbps และไม่คงที่ — ไฟล์บิตเรตสูงจะหยุดรอโหลดเป็นช่วงๆ = "กระตุก"):
  H.264 Main · yuv420p · ไม่เกิน 720p (แนวตั้งไม่เกิน 720 กว้าง) · CRF 23 เพดาน 3 Mbps · keyframe ทุก ~2 วิ ·
  **faststart (moov อยู่หน้าไฟล์ — ไม่งั้นเบราว์เซอร์ต้องดึงท้ายไฟล์ก่อนเริ่มเล่น)** · เสียง AAC
  ไฟล์ที่ได้จากแหล่งอื่นเกือบทั้งหมดไม่ผ่านเกณฑ์นี้ (เดิม 127/159 ไม่ใช่ faststart · ค่ากลาง 8.4 Mbps) — ต้องแปลงก่อนอัป R2 ทุกครั้ง

- `TRANSFORMS` (`characters/_transforms.js`) = metadata ต่อ status key: `{ img, video, title, label, seconds, music, voice, afterReveal }`
- `queueCutscene(p,key,onlyFor)` เข้าคิว · `triggerCutscene(p,key)` เล่นทันที (ครั้งแรกวีดีโอเต็ม ครั้งถัดไปแค่การ์ดแจ้งเตือน — ดู `p.cutsceneShown`)
- `runCutsceneQueue(onDone)` `:2542` — ตั้ง `gameState = "CUTSCENE"` เล่นเรียงทีละคลิป แล้วเรียก `onDone`
- **`onlyFor` (patch 2.8.1)** = array ของ `playerId` ที่เห็นคลิปนี้ · `buildStateFor(viewerId)` ส่ง `cutscene: null`
  ให้คนนอกลิสต์ (client วาดกระดานตามปกติแทน) แต่ **ทุกคนยังหยุดรอครบเวลาเดียวกัน** เกมจึงไม่หลุดซิงก์
  ใช้กับคลิปที่เป็นเรื่องส่วนตัวของบางคน เช่น "ครูฝึกสุดเหี้ยม" ของดันที่ด่าเฉพาะคนไพ่แตก
- **`noIntro`** ใน `TRANSFORMS` = ข้ามการ์ดเปิดตัว 950ms ของ client ไปเข้าวีดีโอเลย (คลิปที่สั้นกว่าการ์ดเปิดตัว)
  · `seconds` ของคลิปสั้นต้องตั้งให้พอดีความยาวจริง ไม่งั้นค้างเฟรมสุดท้ายนานกว่าตัวคลิปเอง
- `afterReveal: true` = ลูปใน `afterResolve()` กวาดเล่นให้เอง (ท่าไม้ตายที่ทำงานหลังเปิดไพ่)
- `p.transformAt = ++transformCounter` ใช้ตัดสินว่าเพลงของใครทับใคร เมื่อสวนท่าไม้ตายกัน
- โหมดประหยัด (client `lowQ`) ข้ามวีดีโอแต่ยัง **รอเวลาเท่าเดิม** เพื่อให้ทุกคนซิงก์กัน

---

## 9. เศรษฐกิจ + ร้านค้า

- **Moon Cell (`seraph`)**: สืบสวนวันที่ 1–6 แล้วดวลวันที่ 7 · เลือกสถานที่ได้วันละไม่เกิน 1 แห่ง
  ร้านค้าเป็นกิจกรรมแยก ซื้อก่อนหรือหลังเลือกสถานที่ได้ในเฟส `SERAPH_PLACE` จนกด `seraphReady`
  ทุกคนกดพร้อมครบจึงขึ้นวันใหม่ · เซิร์ฟเวอร์เก็บสถานที่และสถานะพร้อมต่อผู้เล่น รีเฟรชไม่คืนสิทธิ์
  `Seraph.canShop()` บล็อกคนพร้อมแล้ว/ตกรอบ/นอกเฟสเลือกสถานที่ และ `buyShopItem()` ตรวจเฟสเกมซ้ำ
  Overload Force ปิดทั้งโหมด รวมวันดวล (กันทั้งจุดทอยและ `triggerOverloadForce()`)

- **เหรียญ**: จบเทิร์น +1 ทุกคน · ชนะจั่ว +1 · การ์ด King +10 · เพดาน `goldCapOf(p)` = 30 (โคโตเนะ 45 จากสกิลติดตัว)
  - **ทุกการได้รับเหรียญต้องผ่าน `addGold(p, n)`** (`server/shop.js`, เปิดให้ hook ผ่าน `engine.addGold`) — เป็นจุดเดียวที่
    บังคับเพดานรายบุคคลและยิง `CHAR_HOOKS.kotone.onGoldGained()` (กระปุกออมสิน 60% แบ่งเหรียญที่เพิ่งได้ไปหยอด
    ไม่เกินครั้งละ 3 เต็ม 15 — **หักจากยอดที่ได้รับ**) เขียน `p.gold` ตรงๆ = กระปุกออมสินเงียบ
  - `addGold()` คืน **ยอดสุทธิที่เหลืออยู่ในกระเป๋า** (หลังกระปุกแบ่งไปแล้ว) ไม่ใช่ยอดก่อนแบ่ง
- **ร้านเปิดทุก 5 เทิร์น** (`roundNumber % SHOP_INTERVAL_TURNS === 0` ใน `dealRound`) — **ร้านเดียว: ร้านค้ามายา 15 ช่อง** (patch 2.3 ยุบร้านลุงเท่งเข้ามา — ไม่มี `uncleShopItems`/แท็บสลับร้านอีกแล้ว)
  - **ช่องล็อกช่องเดียว = Trigger Dark Key** โผล่แน่นอน 1 ชิ้นทุกรอบ (อิกนิสต้องมีของซื้อเสมอ) และไม่ถูกสุ่มซ้ำในช่องอื่น
  - **14 ช่องที่เหลือสุ่มล้วนตาม `SHOP_WEIGHTS`** (`rollShopItem(allowGun, allowHyper)`): เปลี่ยนสีการ์ด 15% / โชคลาภ 5% / ต้านสถานะ 15% / ยาลดไพ่ 12% / แต้มสกิล 14% / เกราะ 14% / ปืน GUTS Select 8% / กระสุน 14% / Hyper Key Trigger 3%
    - แต้มสกิลแตกย่อยตาม `SHOP_SKILL_SIZES[].weight` — เล็ก 50 / กลาง 35 / ใหญ่ 15 (= 7% / 4.9% / 2.1% ของทั้งช่อง)
    - กระสุนแตกย่อยตาม `SHOP_AMMO_WEIGHTS` — Shockwave/Gargorgon/Thunder อย่างละ 4 / Nurse 2 (= 4% / 4% / 4% / 2%)
    - โควตาต่อรอบ: ปืน ≤ `SHOP_MAX_GUNS` (2) · Hyper Key ≤ `SHOP_MAX_HYPER` (1) — เต็มโควตาแล้วน้ำหนักตกไปรวมกับกระสุนธรรมดา
- **เกราะ Mark 42** (`characters/_mark42.js` — ระบบกลาง ไม่ใช่ตัวละคร · 25 เหรียญ · ระเบิด 2 · วีดีโอใส่/ใส่ให้/เรียกคืนเต็มครั้งแรกครั้งเดียวต่อผู้เล่น ระเบิดทุกครั้ง · โอกาส/เพดานต่อรอบเท่าปืน) ใครก็ใส่ได้ยกเว้น ORT
  - ใส่อยู่ = **เกราะชุด 7 เป็นชั้นแยก `p.mark42.armor`** ดักที่หัว `adjustIncomingDamage` (ทุกท่อ) + `damageSoft` + หัว `loseHp`/`loseArmor`
    (เส้นทางที่ข้ามท่อ) + `instantDeath` (สังหารทันที = ชุดพัง) — เลือด/เกราะจริงไม่ถูกแตะ จึงกลับร่างเดิมครบเมื่อถอด/พัง
    · **ห้ามใช้ `p.armor`** เพราะรถแบทแมนใช้ `p.armor` เป็นพลังชีวิตของรถ · หน้าจอแสดงเลือด 0/0 + เกราะชุด x/7 · พลังโจมตี +1 ที่ `computeAttackBase`
  - เจ้าของ (`p.mark42Owned`) คุมชุดผ่าน socket `mark42Control` (recall / remove / detonate) — คนใส่ถอดเองไม่ได้ ·
    ใช้ไอเทมส่ง `mode` (`self` / `give` / `bomb`) ทาง `useInventoryItem` · วีดีโอก่อนแล้วผลเกิดหลังคลิป (`mark42Run`)
  - ชุดพังจากการต่อสู้ = เจ้าของซื้อใหม่ไม่ได้ 10 เทิร์น (`p.mark42BuyLock`) · ระเบิด/ถอด/เรียกคืนไม่ติดคูลดาวน์ · มีได้ชุดเดียวต่อคน
  - เทสต์: [tests/mark42.test.js](tests/mark42.test.js)
- ซื้อแล้วเข้า `p.inventory` (หายทุกแมตช์ใหม่) → ใช้ผ่าน `useInventoryItem()` `:2693`
- ปืนยิงได้ 1 นัด/เทิร์น เฉพาะช่วงจั่วไพ่ และต้องมีปืนถึงจะยิงกระสุนได้ (`hasGutsGun`)

---

## 10. กลางวัน/กลางคืน

- สลับทุก **5 เทิร์น** (`CYCLE_TURNS`) เริ่มเกมเป็นกลางวัน — โหมด Overload กลับด้าน (5 เทิร์นแรกเป็นกลางคืน)
- กฎสองข้อด้านล่าง **ใช้เฉพาะ Type Mercury** — โหมดสงครามทั่วไปใช้ผลของภูมิภาคแทนทั้งหมด (ข้อ 10.1)
- **กลางวัน**: จบเทิร์นได้แต้มสกิล +1 แต่ **เฉพาะเช้าที่ 2, 4, 6, …** (`morningBonusActive`)
- **กลางคืน**: สุ่ม 1 tier ของแต่ละคนแพงขึ้น +1 (`p.nightTaxTier`)
- **เกราะฟื้น +1 ทุกเทิร์นเลขคู่** เหมือนกันทั้งวัน/คืน (บล็อกโดย `armorLocked` / `decay`) — ภูมิภาค 5-7 ฟื้นทุกเทิร์น (`Journey.armorRegenDue`)
- `cycleShift` = ตัวเลื่อนวงจรทั้งเกม (`engine.setCycleShift` ใช้ในเทสต์) — ถ้าจะเลื่อนวงจร **ต้องคำนวณใหม่ตรงๆ ห้ามบวกสะสม** (บวกคงที่ทำให้เกิดวันแทรกกลางคืนสั้นๆ)
- มิติมายาบรรเลงของ Bard **override วงจรทั้งหมด** (โลหิต = กลางวัน, วิญญาณ = กลางคืน)

### 10.1 การเดินทาง 7 ภูมิภาค (ffa / duo / trio)

โมดูลกลาง [characters/_journey.js](characters/_journey.js) (require ตรงเหมือน `_mark42` — ไม่ใช่ตัวละคร) · เทสต์ [tests/journey.test.js](tests/journey.test.js)
- ภูมิภาค = `areaOf(roundNumber)` เปลี่ยนทุก `AREA_TURNS` (10) เทิร์น ค้างที่ 7 ถาวร — **ไม่มี state แยก** Overload Force/ย้อนเวลาชิโดจึงย้อนภูมิภาคเอง
  กลางวัน/กลางคืนอ่านจาก `isNightRound()` (เทิร์น 1-5 ของภูมิภาคกลางวัน 6-10 กลางคืน · มิติมายาบรรเลงของ Bard ยังพลิกได้)
- ผลของภูมิภาค **แทน** กฎวัน/คืนเดิม: `Journey.nightTaxOn()` (เหลือแค่ 1 กลางคืน) · `Journey.skillBonus()` (1 กลางวันเทิร์นคู่ / 7 ทุกเทิร์น)
- จุดเสียบใน engine (ชื่อฟังก์ชันใน `_journey.js` → ที่เรียก):
  `skillTax` → `useSkillCore()` **และ** `showCost()` ใน `buildStateFor` (ต้องคิดเหมือนกัน — สกิลราคา 0 ไม่โดน) ·
  `skillMisses`/`skillRefund` → `useSkillCore()` ถัดจากด่านเหน็บชา (พลาด = คืนแต้ม+การ์ดราชินี แต่เสียโควตาเทิร์น) ·
  `tryAttackMiss` → `doAttack()` ด่านสุดท้ายของชุดหลบ (แม่นยำเจาะได้) · `attackBonus` → `computeAttackBase()` (ungated) ·
  `applyCrit` → `doAttack()` หลังคริติคอลของตัวละคร — เฉพาะตัวที่ไม่มีอัตราคริเอง · อุซากิ/Kim ได้ `critBonus` (+20%) บวกเข้าการทอยของตัวเองผ่าน `engine.journeyCritBonus()` (คริได้ครั้งเดียว ×2 ไม่คูณซ้อน) · `dotBonus` → `engine.journeyDotBonus()` ใน tick ลุกไหม้/เลือดไหล/พิษร้าย ·
  `filterShopRoll`/`shopStock` → `openShop()` (ช่องหลายชิ้นใช้ `stock`/`stockMax` — `sold` เป็น true ตอนหมดช่องเท่านั้น) ·
  `goldBonus` + `onEndTurn` → `endTurn()` (หลังลูปลดเทิร์นสถานะ ก่อนกวาดคนตาย — สตั้น/ผุพังที่ติดจึงมีผลเต็มเทิร์นหน้า)
- ความเสียหายจากสนาม (`fieldDamage`) ลดเกราะก่อน + ท่อกันตายชุดเดียวกับพิษร้าย และตั้ง `_statusDamage`
- **ฉากเดินทาง** (5.1: บนลูกโลก — `client/src/oc/intro/MatchIntro.jsx` เปิดแมตช์+ดิ่ง, `RegionTravel.jsx` เปลี่ยนภูมิภาค): server พักเฟส CUTSCENE (ไม่มีคลิป) แบบเดียวกับฉากเปิดตัว ORT — `journeyScene` `{ seq, active, mode, area, fromArea }`
  · `start` = ต่อท้าย `gameIntroHoldSeconds()` ใน `startMatch()` (+`JOURNEY_START_SECONDS` 6 — client ดิ่งต่อจากฉากเปิดตัวที่ `onOutro`) · `advance` = `maybeJourneyAdvance()` ท้าย `endTurn`
  ก่อนเทิร์นแรกของภูมิภาคใหม่ (+`JOURNEY_ADVANCE_SECONDS` 7) · เทสต์ที่ต้องการเทิร์น 1 ทันทีตั้ง env `JOURNEY_START_SECONDS=0`
  · `state.journey` (`Journey.publicInfo`) ระหว่างฉาก advance แสดงภูมิภาค **ปลายทาง** แล้ว (ฉากหลัง/เพลงเปลี่ยนใต้ฉากเดินทาง)
- เพลง: `journey_<area>_<day|night>` ใน `client/src/audio.js` (5.1 เลิกใช้เพลง `journey_map` ระหว่างฉากเดินทาง — เล่นเพลงภูมิภาคปลายทางทันที · เปิดแมตช์ยังเป็น `lobby5`) — ไฟล์อยู่ `client/public/journey/` (R2)

---

## 11. Overload Force

- แต้มสูงสุด **เสมอกัน** → โรล 30% (`OVERLOAD_FORCE_CHANCE`) → `triggerOverloadForce()`
  - แจกไพ่ใหม่ **ในเทิร์นเดิม**, ปลดเพดาน 21 (ไม่มีการแตก), Joker = +12 ตายตัว
  - โทษ: ทุกใบที่ 5 ที่จั่วหลังแต้มเกิน 21 → เสีย HP จริง 1 (`applyOverloadOverdrawPenalty`)
- **ย้อนทั้งเทิร์นก่อนแจกไพ่ใหม่**: `captureTurnSnapshot()` ถ่ายสภาพผู้เล่นทั้งหมด (+ `roundSkills`/ร้านค้า/ตัวแปรวงจรวัน-คืน/ยูนะ) ไว้ตอนปลาย `dealRound()` ก่อนเข้าเฟสจั่วไพ่ · `restoreTurnSnapshot()` เรียกเป็นอย่างแรกใน `triggerOverloadForce()`
  - คืนให้ครบ: แต้มสกิล, โควตา `skillUsedRound`/`kaiSkillUsesRound`/`bardNotesUsed`, ไอเทม+เหรียญ, ดาเมจ/ดีบัฟที่ก่อในเทิร์นนั้น, แม้แต่คนที่ตายไปแล้วก็ฟื้น (บั๊กเดิม: สกิลที่ทำงาน "หลังเปิดไพ่" ถูกล้างทิ้งพร้อมมือไพ่ = เสียแต้มกับสกิลฟรี)
  - **ไม่ย้อน** ข้อมูลการเชื่อมต่อ (`socketId`/`connected`/`sessionToken`/`ready`) และไม่ปลุกผู้เล่นที่ออกจากเกมกลางเทิร์น · สแนปช็อตใช้ได้ครั้งเดียว (ล้างทิ้งหลัง restore / ตอน `startMatch()` / กลับล็อบบี้)
- **บอสยูกิและโหมด `overload` ถูกถอดออกแล้ว** (commit `2fe9e63`) — Overload Force ยังเกิดได้ตามปกติทุกโหมด
  โครงผู้เล่นปลอมของยูกิเป็นต้นแบบของ ORT ในโหมด Type Mercury (ข้อ 11.1)

### 11.1 โหมด Type Mercury (Raid Boss ORT)

- `gameMode = "mercury"` · เล่นได้ 1-7 คน (`validGameMode`) · ห้องรอคนเดียวกดพร้อมก็เข้าหน้าเลือกรูปแบบสนามได้
- **ปิดในโหมดนี้**: ยูนะทั้งหมด (สุ่มเอฟเฟกต์สนาม `rollWindow` + เพลง Longing ชุบคนตายคนแรก) และ Overload Force
  (กันที่จุดทอยใน `resolveRound` และหัว `triggerOverloadForce()`) — ท่าไม้ตายของเอจิที่บังคับเปิดสนามยูนะยังใช้ได้ตามปกติ
- หน้าโหวตแบ่ง 2 ชั้นด้วย `group` ใน `modeOptionsFor()`: `normal` (ffa/duo/trio) · `special` (seraph/mercury)
  โหมดใน `SUSPENDED_MODES` ยังโผล่เป็นปุ่มเทา (`suspended: true`) และ `voteGameMode` ปฏิเสธ
- **ORT = ผู้เล่นปลอม id `ORT_ID` ("__ort__") ที่นั่ง 8** สร้างใน `startMatch()` ผ่าน `createOrt()` ซึ่งใช้
  `newPlayerRecord()` ตัวเดียวกับ handler `join` (ฟิลด์ครบทุกตัวที่ฮุคอื่นคาดหวัง) · ลบทิ้งที่ `startMatch`/`backToLobby`
  ตรรกะทั้งหมดอยู่ `characters/ort.js` (ลงทะเบียนใน CHAR_HOOKS) · `characters.js` ติด `botOnly: true` = ดูได้ เลือกไม่ได้
- จุดที่ engine กัน/เรียก ORT: `maxHpOf`/`maxArmorOf` (7/3 ต่อหลอด) · `maxSkillOf`/`addSkill`/`addGold` (ไม่มีแต้ม/เหรียญ) ·
  `checkAllLocked` (ไม่รอ ORT) · `hit` (จั่วตามผู้เล่น 1 ใบ) · `resolveRound` (จั่วแก้มือ ≤2 ใบ + ทริกเกอร์สี) ·
  `afterSummary` (ชนะรอบ = เลือกเป้าเลือด+เกราะน้อยสุด ค้างเฟส ATTACK `ORT_ATTACK_DELAY` วิ) ·
  `doAttack` (สังหาร 20% + คริติคอล 75% ×2 หลังดาบเอจิ) · `instantDeath` (หลอดแตก / วิวัฒนาการ / ตัวละครสูญหาย)
- **หลอดเลือด** = `p.ortBars` · ดักที่หัว `instantDeath()` จุดเดียว → ครอบทั้งเลือดหมดและสกิลสังหารทันที
- **ต้านการสังหาร 40%** ดักที่ `miyakoKillChance()` (เนตรทุกตัวผ่านจุดนี้) + เทเปาที่ไม่ผ่านจุดนั้นเรียก `ort.killChanceAgainst` เอง
- **ข้อมูลสูญหาย (สกิลติดตัว 1)**: `p.ortPendingLost` (สกิลแรกของเทิร์นนี้ จองที่จุดหักแต้มใน `useSkillCore`) →
  `dealRound` แปลงเป็น `p.ortLostTier` อยู่ 2 เทิร์น (`p.ortLostUntil` = เลขรอบสุดท้าย) · ส่งให้เจ้าของคนเดียวใน `buildStateFor`
  (`ortLostTier` + `ortLostTurns`) · client ปิดปุ่มผ่าน context ใน `SkillSlot`
- **สวนกลับ (สกิลติดตัว 2)**: จองใน `ort.queueCounter` จาก 3 ทาง (ดาเมจที่ไม่ใช่โจมตีปกติผ่าน `adjustIncomingDamage` /
  เป้าของ `useSkill` / ปืนใน `useInventoryItem`) แล้วลงดาเมจที่ `flushOrtCounters()` — ท้าย `useSkill`/`useInventoryItem`
  (ยกเว้นเข้าเฟส CUTSCENE) · หลังคลิปใน `pausePlayingForCutscene` · `goSummary` · `endTurn` · ธง `flushing` กันสวนกันไปมา
- **ตายแล้วเลือกตัวใหม่**: `instantDeath` → `mercuryOnDeath` (`mercuryLost` ทั้งห้อง) · socket `mercuryPick` →
  `dealRound` เรียก `mercuryRespawnPicked()` ก่อนลูปแจกไพ่ (สร้างระเบียนใหม่ เก็บเหรียญ/ไอเทม รีเซ็ตแต้มสกิล)
  · ถูกชุบชีวิตในร่างเดิม (Longing ของยูนะ) = ปลดล็อกตัวนั้นคืน
- **ผลของ Raid** (`mercuryAdvance` ใน callback ของ `endTurn`): ORT ตาย = ชนะ · ไม่มีใครในสนามและเลือกตัวไม่ได้แล้ว = แพ้ ·
  ตายหมดแต่ยังเลือกได้ = `mercuryHold` (เกมหยุด เวลาไม่เดิน จน `mercuryPick` สั่งเดินต่อ) · โหวตยอมแพ้ = `mercurySurrenderVote`
  (เกินครึ่งห้องจบทันที / หมดเวลา `MERCURY_SURRENDER_SECONDS` นับเฉพาะคนที่กด เสมอ = สู้ต่อ)
- `sameTeam()` คืน true ระหว่างผู้เล่นจริงทุกคนในโหมดนี้ (ตีกันเอง/ผลหมู่ลงเพื่อนไม่ได้) · **ยกเว้นเป้าที่ผู้เล่นกดเลือกเอง**
  ในสกิล/ไอเทมที่กำลังทำงาน (`withExplicitTargets` ห่อ `useSkill`/`useInventoryItem` และส่งต่อไปถึงผลหลังวีดีโอใน
  `pausePlayingForCutscene`) — มอบบัฟ/รับศิษย์ให้เพื่อนจึงเกิดผลจริง · เพื่อนร่วมทีมเห็นแต้มกันตลอด (`teamReveal` ใน `buildStateFor` — ใช้ทั้ง Mercury และ duo/trio ผ่าน `isAlly()`)
- **วิวัฒนาการนับการสังหารจาก "ผู้ทำดาเมจล่าสุดในเทิร์นเดียวกัน"** (`p.lastDamageSourceId`/`lastDamageRound` บันทึกที่
  `adjustIncomingDamage`) — ผู้เล่นที่ ORT ตีจนเลือดหมดไม่ตายใน `doAttack` แต่ตายตอนกวาดท้าย `endTurn` ซึ่งไม่มี `effectSourceId` แล้ว
- ฉากเปิดตัว: server พักเฟส CUTSCENE (ไม่มีคลิป) `MERCURY_ARRIVAL_SECONDS` (env ย่อได้ในเทสต์) · client เล่น `OrtArrival`
  แทน `GameIntro` · อนิเมชันบนตัวบอสยิงผ่าน event `ortFx` (ไม่หยุดเกม) → `OrtBossPanel` เรียก `ortStage.play(kind)`
- **โหมดปกติ (ffa/duo/trio) ไม่มี ORT แล้ว** — การบุกเทิร์น 60 (`maybeOrtInvades`) ถูกถอดออกเมื่อเพิ่มการเดินทาง (ข้อ 10.1)
  ภูมิภาค 7 "จุดสิ้นสุดของโลก" ที่วนอยู่ถาวรเป็นตัวบีบให้เกมจบแทน · `normalGameOver()`/`checkOrtEarlyWin()` ยังนับเฉพาะผู้เล่นจริงเหมือนเดิม
- เทสต์: [tests/characters/ort.test.js](tests/characters/ort.test.js) · [tests/mercury.integration.test.js](tests/mercury.integration.test.js)

### 11.2 โหมด Purge (หนี ORT ในอุโมงค์ท่อ · กระดานทางแยก · ทอยเต๋าเอง)

- `gameMode = "purge"` (กลุ่ม special) · เล่นได้ 1-7 คน · โมดูล [server/modes/purge.js](server/modes/purge.js) + กระดาน [server/modes/purgeBoard.js](server/modes/purgeBoard.js)
  สถานะอยู่ `match.purge` = `{ pl: {id: {node, trail, rolled, done, choices, stop, items, mod, golden, shield, finished, rank, bonusNext, walked}}, ort, ortBonus, lost, finished, turn, scene, walks, rolls, traps, fights, fight, result, winnerId }`
  (รีเซ็ตใน `startMatch`/`backToLobby`)
- **กระดาน** (`buildBoard()` seed คงที่ ส่งให้ client ทั้งก้อนใน `purge.board`): ทางหลัก 150 ช่อง `m0..m150` (ประตูผนึก = `m150`) แบ่ง 5 ภูมิภาค ภูมิภาคละ 30
  · ภูมิภาคละ 1 ทางแยก (`FORKS`) ทางย่อย `short` ทางลัด (ช่องอันตรายเยอะ) / `long` ทางอ้อม (ของดี) / `secret` ทางลับ (ไอเทม/วาร์ป) ไปรวมทางหลักที่ช่อง join
  · ทุกช่องมี `prog` = ระยะเทียบทางหลัก (ใช้ตัดสินว่า ORT ไล่ทันไหม — **ทางอ้อมเดินหลายช่องแต่ prog ขยับช้ากว่า**)
  · ช่องกิจกรรม: `gold` +3 · `back` ถอย 3 · `stop` หยุด 2 เทิร์น · `heal` +2 · `skill` +2 · `item` ไอเทมกระดาน (ถือได้ 3) · `warp` +6 · `reroll` ทอยอีกครั้ง (เทิร์นละครั้ง) · `lure` ORT +2
    · `region` ประจำภูมิภาค: I ทอยเทิร์นหน้า +2 · II กระแสน้ำพาไป 3 · III สลับที่กับคนสุ่ม · IV หินถล่ม (คนอื่นในระยะ 3 ถอย 1) · V เหรียญ +6
- **เฟสทอยเต๋า** `PURGE_ROLL` (`beginRollPhase()` · `PURGE_ROLL_SECONDS` = 25): turn++ · `roundNumber = turn` (กลางวัน/คืน ร้านค้า เดินตามเทิร์นเต๋า) · เหรียญ +2 ทุกคน
  · ทุกคนกดทอยพร้อมกัน (`purgeRoll`) ต่างคนต่างเดิน · ถึงทางแยก = หยุดรอเลือก (`purgeChoose {nextId}`) · ก่อนทอยใช้ไอเทมกระดานได้ (`purgeItem {uid, value, targetId}`)
    `dice2` ทอย 2 ลูก · `golden` เลือกแต้ม · `boots` +3 · `trap` วางกับดักที่ช่องตัวเอง (คนอื่นเหยียบถอย 3) · `push` คนข้างหน้าในระยะ 6 ถอย 2 · `shield` กันการกลืน 1 ครั้ง
  · หมดเวลา = ทอยแทน/เลือกทางหลักให้ (`onRollTimeout`) · ครบทุกคน → `maybeSettle()` รอหมากเดินจบ (`1 + ช่องที่เดินมากสุด × WALK_STEP + 0.6`) → `ortPhase()`
- **ORT**: จบเทิร์น `PURGE_ORT_TURN` (5) โผล่ช่อง 0 · เทิร์นต่อไปทอย 1-6 (+ช่องล่อ) ให้ทุกคนเห็น (`scene.die`/`scene.roll`) · prog ≤ ORT = LOST DATA (`lose()`)
  · ฉาก `ort` พัก CUTSCENE `ortSceneSeconds(scene) + 0.5` (**สูตรต้องตรงกับ client — มีเทสต์เทียบ**) · ORT ยังไม่โผล่และไม่มีใครโดน = ข้ามฉาก
- **จุดปะทะ** = ผู้เล่น 2+ คนอยู่ช่องเดียวกัน (ไม่นับช่องเริ่ม) หลังฉาก ORT · `startFight()` ซูมเข้า 3 วิ → การ์ด 2 รอบ (`dealRound`, `roundNumber = turn - 1`)
  คนที่ไม่อยู่ในจุดนั้นเป็น**ผู้ชม** `benched(p)`: ไม่ได้ไพ่ · ไม่นับใน `resolveRound`/`attackableTargets` (`combatants()`) · กดสกิล/ใช้ไอเทม/โจมตี/ถูกเล็งไม่ได้
  · นับผู้ชนะแต่ละรอบ (`onFightResult()` ถัดจาก `Seraph.onRoundWinner` · ไพ่แตกพร้อมกัน = รอบนั้นไม่มีใครได้)
  · ครบ 2 รอบ: มีผู้ชนะมากสุดคนเดียว → คนอื่นถอย 2 · เสมอ = ถอยทั้งหมด 2 (`PURGE_FIGHT_KNOCKBACK`) → จุดถัดไป/เทิร์นเต๋าใหม่ (`purgeAdvance()` ท้าย `endTurn()`)
- เลือดหมด = ล้มลง ถอย 2 เลือด/เกราะเต็ม (`tryKnockBack()` ใน `instantDeath()` ก่อน `p.alive = false`) · ไม่มี Overload Force
- จบเกม: ถึงประตูผนึก = ได้อันดับตามลำดับ (`finished`) · เกมจบเมื่อทุกคนเข้าเส้นชัยหรือโดนกิน (`maybeEnd`) · `result "ranked"` (`winnerId = finished[0]`) / `"allLost"`
- env สำหรับทดสอบ: `PURGE_INTRO_SECONDS` · `PURGE_ORT_TURN` · `PURGE_ROLL_SECONDS` · `PURGE_FIGHT_INTRO_SECONDS` · `PURGE_FIXED_DICE` (ทุกลูกออกแต้มเดียวกัน)
- client: [client/src/purge/purgeScene.js](client/src/purge/purgeScene.js) (three.js) + [PurgeStage.jsx](client/src/purge/PurgeStage.jsx) แทน `GameBackground`
  · กระดานวาดจาก `purge.board` (`setBoard`) · หมากแต่ละตัวมีคิวอนิเมชันของตัวเองจาก `purge.rolls`/`purge.walks` (seq) — เดินแยกกันได้
  · กล้อง `follow`: ตามหมากของเรา — ยืนนิ่งใกล้หมาก · กำลังเดินมุมบุคคลที่สาม · ทางแยกยกสูงเห็นทุกเส้นทาง (ปุ่มเลือกทางวางตาม `project(nodeId)`) · ใกล้ปากท่อยกมุมกันชนฝาท่อ
  · ฉาก `ort`: กล้องลงระดับพื้นข้ามไหล่หมากที่ใกล้ ORT ที่สุด → ORT ทอยเต๋า (sprite + ป้าย "ORT n") → เดิน/ผุดจากรอยแยก → ระเบิดกระจุยคนที่ถูกกิน → กลับขึ้นกระดาน → ดาบไขว้ที่จุดปะทะ
  · ฉาก `fight`: บินลงช่องปะทะ แล้วแฟลชขาว → Game วาดสนามประลองของภูมิภาค (`ArenaScene` ภูมิภาค = prog/30 + 1) ที่นั่งมีเฉพาะคู่ปะทะ · ท่อหยุดวาด (`hidden`)
  · ฉาก `intro`: ปลายฉากลูกโลก (`MatchIntro` โหมด `warp`) → ทางช้างเผือก → กล้องไถลจากปลายท่อมาจุดเกิด ORT หันกลับ → ลงมาหาหมากของเรา
  · อนิเมชันฉาก (กล้อง/ORT) เดินตามเวลาจริง (≤ 1 วิ/เฟรม) ให้จบทันเวลาที่ server พัก · **dt ห้ามติดลบ** (เวลาของ rAF ย้อนได้ → สีฟ้าพุ่ง = จอฟ้าทั้งจอ)
- เพลง (`purgeMusic()` ใน `client/src/audioPolicy.js`, ไฟล์ใน `/purge/` บน R2): เหลือ 2 คนสุดท้าย (เกม 3+ คน) `playerjust2` → ORT ห่างผู้รอดคนใดไม่เกิน 3 prog
  `playermore3butless` → ORT โผล่แล้ว `ort_came` → ก่อน ORT โผล่ `normal_map` · ระหว่างฉาก CUTSCENE ของโหมด เพลงท่าไม้ตาย/ช่วงโจมตีถูกปิด
- เทสต์: [tests/purge.test.js](tests/purge.test.js) · เพลง: [tests/audio-policy.test.js](tests/audio-policy.test.js)

## 12. โหมดทีม

`gameMode`: `ffa` | `duo` (2 คน/ทีม) | `trio` | `overload` | `pending`
- โหวตเลือกโหมด → `TEAM_SETUP` เลือกทีม A/B/C + ยืนยันครบ → `startMatch()`
- `sameTeam(a,b)` กันเลือกเป็นเป้าโจมตี · `friendlyEffectBlocked(target)` กันเอฟเฟกต์ลบใส่พวกเดียวกัน
- `withEffectSource(source, fn)` ตั้ง `effectSourceId` ให้ระบบรู้ว่าใครเป็นต้นตอ — **handler ที่ก่อเอฟเฟกต์ต้องห่อด้วยตัวนี้** ไม่งั้น friendly-fire check พัง (ดู [tests/team-friendly-fire.test.js](tests/team-friendly-fire.test.js))
- ชนะเมื่อเหลือทีมเดียว (`remainingTeamWinInfo`)

---

## 13. Socket protocol

**Client → Server** (ทุกตัวผ่าน `onPlayerEvent()` ที่มี rate-limit ต่อ event)
```
reconnectSession {sessionToken}   reserve {position}   join {name,position,characterId,shikiUlt}
startGame   selectGameMode {mode}   teamBackToMode   chooseTeam {teamId}   confirmTeam {confirmed}   toggleReady
hit   lock   useSkill {tier,targets,item}   attack {targetId}   echoFreeHit {targetId}
buyShopItem {itemId}   useInventoryItem {uid,cardIndex,color,targetId}
purgeRoll   purgeChoose {nextId}   purgeItem {uid,value,targetId}
contractAnswer / locaAnswer / allyAnswer / allyBreakAnswer / allyFinalAnswer / bardTarget /
kaiOverhaul / phenexRelease / batKarmaSend / nanayaToggleEye / nanayaCancelReattack
backToLobby   leave   disconnect
```

**Server → Client**

| event | เนื้อหา |
|---|---|
| `state` | **snapshot ทั้งเกม ต่อผู้ชมแต่ละคน** — `buildStateFor(viewerId)` `:2127` ซ่อนไพ่/แต้ม/สกิลคนอื่นตอน PLAYING |
| `roster` / `positions` / `positionTaken` / `full` / `inProgress` / `joined` | หน้า setup/lobby |
| `skillFlash` | การ์ดสกิลเด้งบนกระดาน (ไม่หยุดเกม) |
| `transformNotice` | แจ้งแปลงร่างซ้ำ (ครั้งที่ 2+) |
| `bardSfx` | เสียงโน้ต/บรรเลงของ Bard |

- ไม่มีระบบห้อง — **เกมเดียวทั้งเซิร์ฟเวอร์**, สูงสุด 7 คน (patch 2.8)
  - `POSITION_COLORS` มี 8 คีย์: 1-7 คือที่นั่งผู้เล่น · **8 สงวนให้บอส ORT (Type Mercury)** (ฝั่ง client `POSITIONS`
    ไม่มีเลข 8 โดยตั้งใจ — ผู้เล่นเลือกไม่ได้) · `SLOTS[6]` ใน `client/src/screens/Game.jsx` คือผังการ์ด
    ผู้เล่นคนอื่น 6 ใบ ที่ต้อง **ไม่ทับกองการ์ดกลาง** (top 40% / left 45-55%)
  - `duo` ยังต้องการจำนวนคู่ (4 หรือ 6) และ `trio` ต้องการ 6 คนเป๊ะ — มี 7 คนในห้องจึงเหลือแค่ ffa/overload
- `playerId` แยกจาก `socket.id` → รีคอนเนกต์กลับมาเป็นคนเดิมได้ภายใน `RECONNECT_GRACE_MS` (60s)
- `buildStateFor` เป็นจุดเดียวที่ตัดสินว่าอะไรถูกซ่อน — เพิ่มฟิลด์ลับต้องระวังที่นี่

---

## 14. Contract ของ character hook

```js
// characters/<id>.js
module.exports = {
  id: "<characterId>",                     // ต้องตรงกับ id ใน characters.js

  // ตัวเลือก — engine เรียกอัตโนมัติถ้ามี
  damageBonus(engine, attacker, target, ctx) { return 0; },         // บวกดาเมจ (computeAttackBase)
  attackBaseOverride(engine, attacker, target, ctx) { return 1; },  // แทนที่ดาเมจฐาน
  adjustIncomingDamage(engine, p, n, isNormalAttack) { return n; }, // ปรับดาเมจขาเข้า

  // ที่เหลือคือ method ที่ server/ เรียกเองแบบเจาะจง: CHAR_HOOKS.<id>.<method>(engine, ...)
  activateSomething(engine, p) { engine.log("..."); },
};
```

**กฎเหล็ก**
1. เข้าถึง state ผ่าน `engine.*` เท่านั้น (`engine.log`, `engine.healHp`, `engine.dealMixed`, `engine.players`, …)
2. อ่านค่า `let` ของ server ผ่าน getter (`engine.roundNumber`) — เขียนผ่าน setter (`engine.setRoundNumber`)
3. ค่าคงที่เฉพาะตัวละครเก็บในไฟล์ตัวเอง — ที่ยังค้างใน `server/constants.js` คือตัวที่ shared loop ยังใช้อยู่ (มีคอมเมนต์กำกับทุกตัว)
4. ตัวละครใหม่ = เพิ่ม data ใน `characters.js` + ไฟล์ใน `characters/` + `require`+push ใน `characters/index.js`

---

## 15. Gotchas ที่ควรจำก่อนแก้โค้ด

1. **`dealRound()` ล้าง `cutsceneQueue`** — คิววีดีโอไว้ก่อนบรรทัดนั้น = หาย
2. **ลูปลดเทิร์นสถานะใน `endTurn()`** — status key ใหม่ที่ไม่ควรลดเทิร์นต้องเพิ่ม `continue;` เอง ไม่งั้นหายเงียบ; ตรงข้าม key ที่ `continue` แล้วไม่มีใครลบทิ้ง = ค้างถาวรทั้งแมตช์ (บั๊กเดิมของ `burnout`)
3. **โรลโอกาสต้องอยู่ที่จุดตัดสินจริง** — Rip and Tear ของ DoomGuy เคยโรลใน `afterSummary()` หลังสุ่มผู้ชนะไปแล้ว ทำให้โอกาสจริงถูกหารด้วยจำนวนคนที่เสมอ (ย้ายมาที่ `resolveRound()` แล้ว)
4. **`withEffectSource`** ต้องห่อทุก handler ที่ก่อเอฟเฟกต์ ไม่งั้น friendly-fire / แหล่งที่มาดาเมจพัง
5. **ห้ามแก้ `p.hp` / `p.armor` / `p.statuses.evade` ตรงๆ** — ใช้ primitive ที่ให้ไว้ (มี link/mirror/กันตายผูกอยู่)
6. **`isNormalAttack`** ให้ `true` เฉพาะจาก `doAttack()` เท่านั้น
7. **`p.seen[key]` vs `p.cutsceneShown[key]`** — อันแรกกันเอฟเฟกต์ทำงานซ้ำ อันหลังกันวีดีโอเล่นซ้ำ คนละเรื่องกัน
8. `process.on("uncaughtException")` ที่หัวไฟล์เป็น **ตาข่ายสำรอง** ไม่ใช่ที่จัดการ error — handler ต้อง try/catch เอง (`safeOn`/`onPlayerEvent` ทำให้แล้ว)
9. ไฟล์สื่อ (รูป/วีดีโอ/เพลง) ไม่ track ใน git — ไม่มีไฟล์ในเครื่อง client จะ fallback เป็นอีโมจิ (`client/src/data/avatars.js`)
10. **ตัวละคร `unique`** (คอนเนอร์ RK800 · ยุย โยชิโอกะ · อิสึกะ ชิโด) กันซ้ำ **2 ชั้น**: handler `join` ตอบ `characterTaken` และหน้าเลือกตัวละคร
    ปิดการ์ดจาก event `takenChars` — เพิ่มตัว unique ใหม่ต้องแค่ใส่ `unique: true` ใน `characters.js` เท่านั้น
11. `resetCombat(p)` (`server/combat.js`) คือรายการฟิลด์ผู้เล่นทั้งหมด — **ฟิลด์ใหม่ของตัวละครต้องรีเซ็ตที่นี่** ไม่งั้นค้างข้ามแมตช์

---

## 16. เทสต์

```bash
npm test    # node --test "tests/**/*.test.js"
```
- `server.integration.test.js` — spawn server จริงแล้วต่อด้วย socket.io-client (port 32000 + pid%1000)
- `computeAttackBase.test.js` — `require("../server.js").computeAttackBase` ตรงๆ (server ไม่ listen เมื่อไม่ใช่ main module)
- `tests/characters/*.test.js` — ทดสอบ hook รายตัวละครโดย mock `engine`
- อยากเทสต์ฟังก์ชันใหม่ใน server/ ต้องเพิ่มเข้า `module.exports` ท้าย `server.js` ก่อน (เช่น `doAttack: attack.doAttack`)
- เทสต์ที่ค้นข้อความในโค้ดฝั่ง server ใช้ `serverSource()` จาก `tests/serverSource.js` (อ่าน server.js + server/ ทั้งหมด)
