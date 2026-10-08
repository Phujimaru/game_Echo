// การ์ด: กองกลาง 43 ใบ, จั่ว, คิดแต้ม, เอฟเฟกต์สีการ์ด
// export ก่อน require: ไฟล์ใน server/ require วนกันเอง — function declaration ถูก hoist จึงพร้อมใช้ตั้งแต่บรรทัดแรก
Object.assign(module.exports, {
  canonicalDeckCards, cardKey, buildCentralDeck, drawFromCentralDeck, drawCardFor, drawInitialCard,
  drawToScore, calculateScore, checkBlueTrigger, onCardDrawn, applyLockColorTriggers,
  fortuneTargetList, scoreCap, scoreOf, bustedOf,
});

const CHAR_HOOKS = require("../characters/index");
const match = require("./match");
const { engine } = require("./engine");
const combat = require("./combat");
const shop = require("./shop");

// ============================================================
//  การ์ด — กองกลางร่วม 43 ใบ (เลข 1-10 x 4 สี = 40 + King/Queen/Joker อย่างละ 1)
// ============================================================
const CARD_COLORS = ["red", "blue", "green", "yellow"];
// รายชื่อการ์ดทั้ง 43 ใบแบบไม่สับ (ลำดับคงที่) — ใช้เป็นแม่แบบแสดงสมุดการ์ด (deckLedger) และเทียบว่าใบไหนถูกจั่วไปแล้ว
function canonicalDeckCards() {
  const deck = [];
  for (let v = 1; v <= 10; v++) for (const color of CARD_COLORS) deck.push({ value: v, color });
  deck.push({ special: "king" }, { special: "queen" }, { special: "joker" });
  return deck;
}
function cardKey(c) { return c.special || `${c.value}-${c.color}`; }
function buildCentralDeck() {
  const deck = canonicalDeckCards();
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}
// สุ่มดึง 1 ใบออกจาก centralDeck จริง โดยเลือกจาก index ที่ผ่าน predicate เท่านั้น (คืน null ถ้าไม่มีใบให้จั่ว)
function drawFromCentralDeck(predicate) {
  const idxPool = [];
  for (let i = 0; i < match.centralDeck.length; i++) if (!predicate || predicate(match.centralDeck[i])) idxPool.push(i);
  if (!idxPool.length) return null;
  const idx = idxPool[Math.floor(Math.random() * idxPool.length)];
  return match.centralDeck.splice(idx, 1)[0];
}
function drawCardFor(p) {
  if (!p || !p.alive) return null;
  return drawFromCentralDeck(null);
}
// แจกเริ่มรอบ: จั่วจากกองกลางเหมือนกัน แต่ห้ามได้การ์ดพิเศษ (King/Queen/Joker)
function drawInitialCard(p) {
  return drawFromCentralDeck((card) => !card.special);
}
// สกิล "บังคับแต้มพุ่งขึ้น" (ฮาคุโนะ/ทาคุโตะ/มิยาโกะ/ฟีนิกซ์ ฯลฯ): ต้องจั่วการ์ดจริงจากกองกลางไปเรื่อยๆ
//  จนกว่าแต้มจะถึงเป้าหมาย ไม่ใช่บวก cardBonus ลอยๆ — ไม่การันตีว่าจะหยุดที่เป้าเป๊ะเพราะการ์ด 1 ใบมีค่าแค่ 1-10
//  จั่วเกินจนแตกได้จริงถ้าดวงไม่ดี และหยุดเองถ้ากองกลางหมดพอดี
function drawToScore(p, target) {
  while (calculateScore(p.cards) < target) {
    const c = drawCardFor(p);
    if (!c) break;
    p.cards.push(c);
    onCardDrawn(p, c);
  }
  CHAR_HOOKS.daichi.onDrawCheck(engine, p); // ไดจิ: การจั่วบังคับจากสกิลก็นับว่า "การ์ดแต้มเกิน" เหมือนกัน
  p.busted = bustedOf(p);
}
function calculateScore(cards) {
  let base = 0, hasJoker = false;
  for (const c of cards) {
    if (c.special === "joker") { hasJoker = true; continue; }
    if (c.special) continue; // King/Queen ไม่เพิ่มแต้ม
    base += c.value;
  }
  if (hasJoker) base += match.overloadForceActive ? 12 : Math.min(12, Math.max(0, 21 - base)); // Overload: Joker +12 ตายตัว
  return base;
}
const YELLOW_CARD_SKILL_BONUS = 2; // ไพ่เหลืองครบ 3 ใบ 1 ชุด = แต้มสกิล +2 (เดิม +1)
// สีการ์ดครบ 3 ใบ: บลูทำงานทันที (ต้านสถานะผิดปกติ), แดง/เขียว/เหลืองทำงานตอนเปิดไพ่ (ดู applyLockColorTriggers)
function checkBlueTrigger(p) {
  const blueCount = p.cards.filter((c) => c.color === "blue").length;
  const shouldHave = Math.floor(blueCount / 3);
  while (p.colorTrigger.blue < shouldHave) {
    p.colorTrigger.blue++;
    combat.applyBuff(p, "resist", 1, 1);
    match.lastLog.push(`🔵 ${p.name} ครบไพ่ฟ้า 3 ใบ — ได้รับต้านสถานะผิดปกติทันที!`);
  }
}
// การ์ดพิเศษ: ทำงานทันทีตอนจั่วได้ (King/Queen) — Joker ทำงานตอนคิดคะแนนใน calculateScore
function applySpecialCardEffect(p, card) {
  if (!card || !card.special) return;
  if (card.special === "king") {
    const g = shop.addGold(p, 10);
    match.lastLog.push(`👑 ${p.name} จั่วได้การ์ดราชา — ได้เหรียญ +${g}!`);
  } else if (card.special === "queen") {
    p.statuses.freecast = 1; // ใช้สกิลครั้งถัดไปไม่เสียแต้ม — หายเมื่อจบเทิร์นถ้าไม่ได้ใช้
    match.lastLog.push(`👸 ${p.name} จั่วได้การ์ดราชินี — ใช้สกิลได้ฟรี 1 ครั้งในเทิร์นนี้!`);
  }
}
// เรียกทุกครั้งที่มีการ์ดถูกเพิ่มเข้ามือ (แจกเริ่มรอบ / hit / บังคับจั่ว) เพื่อเช็คทริกเกอร์ที่ทำงานทันที
function onCardDrawn(p, card) {
  checkBlueTrigger(p);
  applySpecialCardEffect(p, card);
  combat.applyOverloadOverdrawPenalty(p);
}
// แดง/เขียว/เหลือง ครบ 3 ใบ: ประเมินครั้งเดียวตอนเปิดไพ่ (lock) จากมือสุดท้ายทั้งหมด
function applyLockColorTriggers(p) {
  // ไพ่ฟ้าทำงานตอนจั่วเท่านั้น (กติกากลาง) — ข้อยกเว้นเดียว: มือที่ถูก "นางเงือกน้อยของฉัน" (แอนเดอร์เซน)
  //  เปลี่ยนเป็นสีฟ้าในเทิร์นนี้ ได้ผลตอนเปิดไพ่ (checkBlueTrigger นับชุดที่ให้ผลไปแล้ว จึงไม่ให้ผลซ้ำ)
  if (p.colorTrigger && p.andBlueRound === match.roundNumber) checkBlueTrigger(p);
  for (const color of ["red", "green", "yellow"]) {
    const n = Math.floor(p.cards.filter((c) => c.color === color).length / 3);
    if (n <= 0) continue;
    if (color === "red") {
      p.statusAmt.cardAtkBonus = (p.statusAmt.cardAtkBonus || 0) + n;
      match.lastLog.push(`🔴 ${p.name} ครบไพ่แดง 3 ใบ — พลังโจมตีรอบนี้ +${n}`);
    } else if (color === "green") {
      for (let i = 0; i < n; i++) {
        const h = combat.healHp(p, 1);
        if (h > 0) match.lastLog.push(`🟢 ${p.name} ครบไพ่เขียว 3 ใบ — ฟื้นพลังชีวิต +${h}`);
      }
    } else if (color === "yellow") {
      const gain = n * YELLOW_CARD_SKILL_BONUS;
      combat.addSkill(p, gain, "card"); // การ์ดรังสรร (ไพ่เหลืองครบชุด) — นับเป็นการฟื้นพลังงานสำหรับ [ดูดซับเวท]
      match.lastLog.push(`🟡 ${p.name} ครบไพ่เหลือง 3 ใบ — แต้มสกิล +${gain}`);
    }
  }
}
// โชคลาภ (patch 2.2 new): เลือกลำดับแต้มเป้าหมาย (19/20/21) ที่จะพยายามปรับไพ่ที่จั่วให้ไปถึง โดยอิงจากแต้มรวมปัจจุบัน
//  คืนเป็นลิสต์เรียงลำดับ (ตัวที่สุ่มได้ก่อน แล้วค่อยลองตัวที่เหลือ) — ถ้าตัวแรกไม่มีไพ่ให้จั่วพอดี จะลองตัวถัดไปก่อนค่อยยอมแตก
function fortuneTargetList(currentScore) {
  if (currentScore === 20) return [21]; // ใกล้สุดแล้ว มีบัฟ = ไป 21 แน่นอน
  if (currentScore === 19) return Math.random() < 0.5 ? [21, 20] : [20, 21]; // ถึง 19 อยู่แล้ว สุ่ม 50/50 ว่าจะลองอันไหนก่อน
  const roll = Math.random();
  const primary = roll < 0.4 ? 19 : roll < 0.7 ? 20 : 21; // ปกติ: 19 = 40% / 20 = 30% / 21 = 30%
  return [primary, ...[19, 20, 21].filter((v) => v !== primary)];
}
// เพดานแต้มขณะ UPG! (ฮิคารุ, characters/hikaru.js) — wrapper รอบ CHAR_HOOKS.hikaru.upgCap
function scoreCap(p) {
  if (match.overloadForceActive) return Infinity;
  // แต้มสูงสุดที่รับได้ก่อนล็อกไพ่อัตโนมัติ (UPG! = เพดานของมัน, ปกติ = 21)
  if (p.statuses && p.statuses.upg) return CHAR_HOOKS.hikaru.upgCap(p);
  return 21;
}
function scoreOf(p) {
  // แต้มมีพื้นล่างที่ 0 เสมอ — cardBonus ติดลบ (เช่น "พักผ่อน" ของไบเลธ) หักได้มากสุดจนเหลือ 0 ไม่ติดลบ
  const raw = Math.max(0, calculateScore(p.cards) + (p.cardBonus || 0));
  if (p.statuses && p.statuses.upg) return Math.min(raw, CHAR_HOOKS.hikaru.upgCap(p));
  return raw;
}
function bustedOf(p) {
  // คอนเนอร์ RK800 (characters/conner.js): ระหว่างการไล่ล่า ผู้เล่นที่ไม่เกี่ยวข้องถูกบังคับให้ "ไพ่แตก" ทันที
  //  (ดาเมจไพ่แตก/ดาเมจแพ้ถูกระงับทั้งหมดในเทิร์นไล่ล่าอยู่แล้ว — ดู CHAR_HOOKS.conner.chaseResolveRound)
  if (p && p.connorFrozen) return true;
  if (p && p.brianFrozen) return true; // ไบรอัน: คนนอกวง "การแข่งที่มีเดิมพัน" ถูกบังคับไพ่แตก (แต่ไม่รับความเสียหาย)
  if (p && p.dioFrozen) return true;   // ดิโอ: คนนอกวง Last stand ถูกบังคับไพ่แตก (แต่ไม่รับความเสียหาย)
  // มิซึซาว่า ฮารุกะ (characters/haruka.js): New Omega ระเบิดแต้มการ์ด — บังคับแตกทันทีต่อให้เปิดไพ่ไปแล้ว
  //  ต้องอยู่ก่อน overloadForceActive เพราะเป็นการ "สั่งให้แตก" ตรงๆ ไม่ใช่ผลการคิดแต้มที่สนามปลดเพดานได้
  if (CHAR_HOOKS.haruka.forcedBust(p)) return true;
  // มุยมิ: ดาบสะบั้นหอคอยสวรรค์ / หัวใจนักสู้ สั่งให้ไพ่แตกโดยตรง ต้านสถานะป้องกันไม่ได้
  if (CHAR_HOOKS.muimi.forcedBust(engine, p)) return true;
  if (match.overloadForceActive) return false;
  if (p.statuses && p.statuses.upg) return false;
  return calculateScore(p.cards) + (p.cardBonus || 0) > 21;
}

Object.assign(module.exports, { CARD_COLORS });
