// เหรียญ + ร้านค้ามายา + ไอเทม/ปืน GUTS
// export ก่อน require: ไฟล์ใน server/ require วนกันเอง — function declaration ถูก hoist จึงพร้อมใช้ตั้งแต่บรรทัดแรก
Object.assign(module.exports, {
  goldCapOf, addGold, rollShopItem, shopItemName, openShop, refreshShopForJourney, journeyGiftItem,
  grantInventoryItem, hasGutsGun, hasBlackSparklence, hasGutsWeapon, asleep, buyShopItem,
  cardLabel, useInventoryItem, gutsFireTargetOf, applyGutsBullet,
});

const CHAR_HOOKS = require("../characters/index");
const Mark42 = require("../characters/_mark42");
const Journey = require("../characters/_journey");
const Seraph = require("../seraph");
const {
  BARD_FORTUNE_MAX, BLACK_SPARKLENCE_NURSE_COOLDOWN, GOLD_MAX, GUTS_AMMO, GUTS_AMMO_IDS,
  GUTS_CHAA_TURNS, GUTS_GUN_PRICE, GUTS_NURSE_DMG, SHOP_AMMO_WEIGHTS, SHOP_ARMOR_AMOUNT,
  SHOP_ARMOR_PRICE, SHOP_CARD_COLOR_PRICE, SHOP_CARD_REMOVE_PRICE, SHOP_FORTUNE_AMOUNT,
  SHOP_FORTUNE_PRICE, SHOP_MAX_GUNS, SHOP_MAX_HYPER, SHOP_MAX_ITEMS, SHOP_MAX_MARK42,
  SHOP_RESIST_PRICE, SHOP_RESIST_TURNS, SHOP_SKILL_SIZES, SHOP_WEIGHTS,
} = require("./constants");
const match = require("./match");
const { engine } = require("./engine");
const characterRules = require("./characterRules");
const combat = require("./combat");
const cutscene = require("./cutscene");
const cardDeck = require("./deck");
const draw = require("./phases/draw");
const mercury = require("./modes/mercury");
const purge = require("./modes/purge");
const view = require("./view");

// เพดานเหรียญรายบุคคล — กระปุกออมสินน้องหมูน้อย (ฟุจิตะ โคโตเนะ) ขยายเพดานของเจ้าตัวเป็น 45
function goldCapOf(p) {
  if (p && p.characterId === "kotone") return CHAR_HOOKS.kotone.GOLD_CAP;
  return GOLD_MAX;
}
// จุดเดียวที่ "ได้รับเหรียญ" ผ่าน — คืนจำนวนที่เหลืออยู่ในกระเป๋าจริงหลังตัดตามเพดาน
//  ต้องเรียกผ่านตัวนี้เสมอ ไม่งั้นกระปุกออมสินของโคโตเนะจะไม่ทำงาน (สกิลติดตัวผูกกับจังหวะได้รับเหรียญ)
//  โคโตเนะ: กระปุกออมสิน "แบ่ง" เหรียญที่เพิ่งได้ไปเก็บ (หักออกจากกระเป๋า) จึงคืนยอดสุทธิ ไม่ใช่ยอดก่อนแบ่ง
function addGold(p, n) {
  // SE.RA.PH วันที่ 1-6: สกิลติดตัวทุกตัวปิดหมด — กระปุกออมสินของโคโตเนะถูกเรียกตรงจากที่นี่
  //  (ไม่ผ่าน firePassive/passiveSealed) จึงต้องมีด่านของตัวเอง ไม่งั้นมันทำงานทั้งที่ควรปิด
  if (Seraph.noCombat() && p && p.characterId === "kotone") {
    p.gold = Math.max(0, Math.min(goldCapOf(p), (p.gold || 0) + n));
    return p.gold;
  }
  if (!p || !(n > 0) || mercury.isOrt(p)) return 0; // ORT ไม่มีเหรียญ
  const cap = goldCapOf(p);
  const before = p.gold || 0;
  if (before >= cap) return 0;
  p.gold = Math.min(cap, before + n);
  const gained = p.gold - before;
  const saved = p.characterId === "kotone" ? (CHAR_HOOKS.kotone.onGoldGained(engine, p, gained) || 0) : 0;
  return gained - saved;
}

// ---------- ร้านค้ามายา (patch 2.3: ยุบร้านลุงเท่งเข้ามาเป็นร้านเดียว) ----------
// สุ่มสินค้า 1 ชิ้นตามน้ำหนักใน SHOP_WEIGHTS (รวม 100):
//   เปลี่ยนสีการ์ด 15 / โชคลาภ 5 / ต้านสถานะ 15 / ยาลดไพ่ 12 / ฟื้นแต้มสกิล 14 / ฟื้นเกราะ 14 / ปืน GUTS 8 / กระสุน GUTS 14 / Hyper Key 3
//   allowGun = false (ปืนครบ SHOP_MAX_GUNS แล้ว) / allowHyper = false (Hyper Key ครบ SHOP_MAX_HYPER แล้ว)
//   -> น้ำหนักของที่เต็มโควตาตกไปรวมกับกระสุนธรรมดา
function pickWeighted(entries) {
  const total = entries.reduce((n, e) => n + e.w, 0);
  let r = Math.random() * total;
  for (const e of entries) { r -= e.w; if (r <= 0) return e.key; }
  return entries[entries.length - 1].key;
}
function rollShopAmmo() {
  const ammoId = pickWeighted(GUTS_AMMO_IDS.map((id) => ({ key: id, w: SHOP_AMMO_WEIGHTS[id] || 1 })));
  return { type: "gutsAmmo", ammo: ammoId, price: GUTS_AMMO[ammoId].price };
}
function rollShopItem(allowGun = true, allowHyper = true, allowMark42 = true) {
  const weights = { ...SHOP_WEIGHTS };
  if (!allowMark42) { weights.gutsAmmo += weights.mark42; weights.mark42 = 0; }
  if (!allowGun) { weights.gutsAmmo += weights.gutsGun; weights.gutsGun = 0; }
  if (!allowHyper) { weights.gutsAmmo += weights.hyperTrigger; weights.hyperTrigger = 0; }
  const type = pickWeighted(Object.entries(weights).map(([key, w]) => ({ key, w })));
  if (type === "cardColor") return { type: "cardColor", price: SHOP_CARD_COLOR_PRICE };
  if (type === "fortune") return { type: "fortune", price: SHOP_FORTUNE_PRICE };
  if (type === "resist") return { type: "resist", price: SHOP_RESIST_PRICE };
  if (type === "cardRemove") return { type: "cardRemove", price: SHOP_CARD_REMOVE_PRICE };
  if (type === "skillPoint") {
    const size = pickWeighted(SHOP_SKILL_SIZES.map((s) => ({ key: s.size, w: s.weight })));
    const s = SHOP_SKILL_SIZES.find((x) => x.size === size);
    return { type: "skillPoint", size: s.size, value: s.amount, price: s.price };
  }
  if (type === "gutsGun") return { type: "gutsGun", price: GUTS_GUN_PRICE };
  if (type === "mark42") return { type: "mark42", price: Mark42.PRICE };
  if (type === "hyperTrigger") return { type: "gutsAmmo", ammo: "hyper_trigger", price: GUTS_AMMO.hyper_trigger.price };
  if (type === "gutsAmmo") return rollShopAmmo();
  return { type: "armor", value: SHOP_ARMOR_AMOUNT, price: SHOP_ARMOR_PRICE };
}
function shopItemName(item) {
  if (item.type === "cardColor") return "ยาเปลี่ยนสีการ์ด";
  if (item.type === "fortune") return "ยาโชคลาภ";
  if (item.type === "resist") return "ยาต้านสถานะ";
  if (item.type === "cardRemove") return "ยาลดไพ่";
  if (item.type === "skillPoint") return `ยาฟื้นแต้มสกิล +${item.value}`;
  if (item.type === "armor") return `ยาฟื้นเกราะ +${item.value}`;
  if (item.type === "gutsGun") return "ปืนหน่วย GUTS Select";
  if (item.type === "blackSparklence") return "Black Sparklence";
  if (item.type === "mark42") return "เกราะ Mark 42";
  if (item.type === "gutsAmmo") return (GUTS_AMMO[item.ammo] || {}).name || "กระสุน";
  return "สินค้า";
}
// เปิดร้านค้ามายา: สุ่มสินค้าใหม่ทั้งหมด 15 ช่อง (สินค้าประเภทเดียวกันขึ้นซ้ำได้)
//  ช่องแรกช่องเดียวเป็นช่องล็อก — Trigger Dark Key โผล่แน่นอน 1 ชิ้นทุกรอบ (อิกนิสต้องมีของซื้อเสมอ) และไม่ถูกสุ่มซ้ำในช่องอื่น
//  ที่เหลือ 14 ช่องสุ่มล้วน — Hyper Key Trigger ก็สุ่มออกเหมือนของอื่น (ไม่การันตีแล้ว) จำกัด 1 ชิ้น/รอบ
function openShop() {
  match.shopRoundSeq++;
  match.shopItems = [
    { id: `shop_${match.shopRoundSeq}_dark`, type: "gutsAmmo", ammo: "trigger_dark_key", price: GUTS_AMMO.trigger_dark_key.price, sold: false, soldTo: null },
  ];
  let guns = 0;
  let hypers = 0;
  let suits = 0;
  for (let i = 1; i < SHOP_MAX_ITEMS; i++) {
    // การเดินทาง (คลื่นวงวนน้ำ กลางวัน): สุ่มซ้ำจนได้ของราคา 5 ขึ้นไป
    const rolled = Journey.filterShopRoll(engine, () => rollShopItem(guns < SHOP_MAX_GUNS, hypers < SHOP_MAX_HYPER, suits < SHOP_MAX_MARK42));
    if (rolled.type === "gutsGun") guns++;
    if (rolled.type === "mark42") suits++;
    if (rolled.ammo === "hyper_trigger") hypers++;
    match.shopItems.push({ id: `shop_${match.shopRoundSeq}_${i}`, ...rolled, sold: false, soldTo: null });
  }
  refreshShopForJourney();
  match.lastLog.push(`🏪 ร้านค้ามายาเปิดแล้ว! มีสินค้า ${match.shopItems.length} ชิ้น: ${match.shopItems.map(shopItemName).join(", ")}`);
}
// การเดินทาง: ผลของภูมิภาคที่มีต่อร้านค้า "คิดใหม่ทุกต้นเทิร์น" (เรียกจาก dealRound + ตอนร้านเปิด + หลังซื้อ)
//  ร้านเปิดทุก 5 เทิร์นแต่ของค้างอยู่ข้ามช่วงเวลา — เดิมคิดผลครั้งเดียวตอนเปิดร้าน ผลจึงช้ากว่าช่วงจริงทั้งช่วง
//  (ร้านเทิร์น 15 ที่เปิดตอนกลางวันยังซื้อได้ช่องละ 1 ชิ้นตลอดกลางคืน 16-19 ของทุ่งดอกไม้)
//  · ทุ่งดอกไม้ กลางคืน: ช่องละหลายชิ้น — นับที่ซื้อไปแล้ว (bought) เทียบเพดานของช่วงเวลาปัจจุบัน
//    sold = ครบเพดานแล้ว (client ใช้ sold ตัดสินว่ากดซื้อได้ไหม) · stock/stockMax ส่งไปโชว์ "เหลือ x/3"
//  · คลื่นวงวนน้ำ กลางวัน: ช่องที่ยังไม่มีใครซื้อและราคาต่ำกว่า 5 ถูกสุ่มใหม่เป็นของราคา 5 ขึ้นไป
function refreshShopForJourney() {
  // ทุกโหมด (รวม SE.RA.PH) ใช้ตัวนับ bought ตัดสิน sold — ผลของภูมิภาคทำงานเฉพาะโหมดที่มีการเดินทาง (Journey.is/shopStock)
  if (!match.shopItems.length) return;
  if (Journey.is(engine, 4, "day")) {
    for (let i = 0; i < match.shopItems.length; i++) {
      const it = match.shopItems[i];
      if ((it.bought || 0) > 0 || it.sold || it.price >= Journey.WHIRL_SHOP_MIN_PRICE) continue;
      const rolled = Journey.filterShopRoll(engine, () => rollShopItem(false, false, false)); // ไม่เพิ่มของโควตา (ปืน/Hyper/Mark 42)
      match.shopItems[i] = { id: `${it.id}_w`, ...rolled, sold: false, soldTo: null };
    }
  }
  for (const it of match.shopItems) {
    // ของที่ขายไปก่อนมีตัวนับ bought (ร้านจาก snapshot/เวอร์ชันเก่า) ถือว่าซื้อไป 1 ชิ้น
    if (it.bought == null) it.bought = it.sold ? 1 : 0;
    const limit = Journey.shopStock(engine, it);
    it.sold = it.bought >= limit;
    if (limit > 1) { it.stock = Math.max(0, limit - it.bought); it.stockMax = limit; }
    else { delete it.stock; delete it.stockMax; }
  }
}
// การเดินทาง (ทุ่งดอกไม้ กลางวัน): ของฟรีราคาไม่เกิน 5 ที่ใช้ได้ทันที — ไม่มีกระสุน (ใช้ไม่ได้ถ้าไม่มีปืน)
function journeyGiftItem() {
  const small = SHOP_SKILL_SIZES.find((x) => x.size === "small");
  const pool = [
    { type: "armor", value: SHOP_ARMOR_AMOUNT, price: SHOP_ARMOR_PRICE },
    { type: "skillPoint", size: small.size, value: small.amount, price: small.price },
    { type: "cardColor", price: SHOP_CARD_COLOR_PRICE },
    { type: "fortune", price: SHOP_FORTUNE_PRICE },
    { type: "resist", price: SHOP_RESIST_PRICE },
    { type: "cardRemove", price: SHOP_CARD_REMOVE_PRICE },
  ].filter((it) => it.price <= 5);
  return { ...pool[Math.floor(Math.random() * pool.length)] };
}
// แจกไอเทมเข้าคลังโดยตรง (ไม่ผ่านร้านค้า/ไม่เสียเหรียญ) — ใช้กับเอฟเฟกต์ตัวละครที่ "ได้รับไอเทม +1 ชิ้น"
//  item = { type, value?, size?, ammo? } รูปแบบเดียวกับของในร้าน — คืน item ที่เข้าคลังจริง
function grantInventoryItem(p, item) {
  if (!p || !item || !item.type) return null;
  p.inventory = p.inventory || [];
  const entry = { uid: `grant_${item.type}_${p.inventory.length}_${Date.now()}`, type: item.type, value: item.value, size: item.size, ammo: item.ammo, price: item.price || 0 };
  p.inventory.push(entry);
  return entry;
}
// ผู้เล่นมีปืนหน่วย GUTS Select อยู่ในกระเป๋าหรือยัง (มีได้กระบอกเดียว)
function hasGutsGun(p) {
  return (p.inventory || []).some((it) => it.type === "gutsGun");
}
function hasBlackSparklence(p) {
  return p && (p.inventory || []).some((it) => it.type === "blackSparklence");
}
function hasGutsWeapon(p) {
  return hasGutsGun(p) || hasBlackSparklence(p);
}
// ซื้อสินค้า: ใครกดก่อนได้ก่อน (Node เป็น single-thread — ประมวลผลทีละ event จึงไม่มี race condition จริง)
// หลับไหล (Lie Like Vortigern ของโอเบรอน): "ออกการกระทำใดๆ ไม่ได้" — จั่ว/กดสกิลกันไว้ด้วย p.locked อยู่แล้ว
//  แต่ร้านค้า/ไอเทมไม่ได้ผูกกับ p.locked ทั้งหมด (บางชนิดกดใช้นอกเฟสจั่วได้) จึงต้องมีด่านของตัวเอง
function asleep(p) { return !!p && ((p.statuses && p.statuses.sleep) || 0) > 0; }

function buyShopItem(id, itemId) {
  // SE.RA.PH: ซื้อของได้เฉพาะ "วันสืบสวน" (วันที่ 1-6) ที่ร้านสะดวกซื้อเท่านั้น
  //  วันดวลไม่มีการซื้อขาย — กันที่นี่ด้วย ไม่ใช่แค่ซ่อนปุ่มฝั่ง client
  const p = match.players[id];
  if (!p || !p.alive) return;
  if (asleep(p)) return; // หลับไหล: ซื้อของไม่ได้
  if (CHAR_HOOKS.daisuke.actionBlocked(engine, p)) return; // Clock Up: คนอื่นซื้อของไม่ได้
  if (Seraph.active() && (match.gameState !== "SERAPH_PLACE" || !Seraph.canShop(p))) return;
  const item = match.shopItems.find((it) => it.id === itemId);
  if (!item || item.sold) return;
  if ((p.gold || 0) < item.price) return;
  p.inventory = p.inventory || [];
  if (item.type === "gutsGun" && (hasGutsGun(p) || p.characterId === "ignis" || hasBlackSparklence(p))) return;
  if (item.type === "mark42" && !Mark42.canBuy(engine, p)) return; // มีชุดอยู่แล้ว / ชุดเพิ่งพังจากการต่อสู้ (10 เทิร์น)
  if (item.type === "gutsAmmo" && item.ammo === "hyper_trigger" && (p.characterId === "ignis" || hasBlackSparklence(p))) return;
  if (item.type === "gutsAmmo" && (item.ammo === "hyper_trigger" || item.ammo === "trigger_dark_key") && p.inventory.some((it) => it.type === "gutsAmmo" && it.ammo === item.ammo)) return;
  item.bought = (item.bought || 0) + 1; // ทุ่งดอกไม้ กลางคืน: ช่องละหลายชิ้น (refreshShopForJourney คิด sold/stock ใหม่)
  item.soldTo = p.id;
  refreshShopForJourney();
  p.gold -= item.price;
  p.inventory.push({ uid: `${item.id}_${p.inventory.length}_${Date.now()}`, type: item.type, value: item.value, size: item.size, ammo: item.ammo, price: item.price });
  match.lastLog.push(`🛍️ ${p.name} ซื้อ ${shopItemName(item)} จากร้านค้ามายา (-${item.price} เหรียญ)`);
  CHAR_HOOKS.reines.onShopBuy(engine, p, item); // ไรเนส (คุณนายใหญ่): 20% ได้เพิ่มอีก 1 ชิ้นฟรี (ไม่หักสต็อก)
  // คอนเนอร์ (วิเคราะห์สถานการณ์): "ซื้อของ" เป็น 1 ใน 4 การกระทำที่คอนเนอร์ต้องคาดการณ์
  CHAR_HOOKS.conner.onShopBuy(engine, p);
  view.broadcastState();
}
// ใช้ของในคลัง
const CARD_COLOR_NAME = { red: "แดง", blue: "ฟ้า", green: "เขียว", yellow: "เหลือง" };
function cardLabel(c) {
  if (!c) return "?";
  if (c.special) return { king: "ราชา", queen: "ราชินี", joker: "โจ๊กเกอร์" }[c.special] || c.special;
  return String(c.value);
}
function useInventoryItem(id, uid, opts = {}) {
  const res = combat.withExplicitTargets(id, opts && opts.targetId ? [opts.targetId] : [], () => useInventoryItemCore(id, uid, opts));
  if (match.gameState !== "CUTSCENE") draw.flushOrtCounters();
  mercury.checkOrtEarlyWin();
  return res;
}
function useInventoryItemCore(id, uid, opts = {}) {
  const p = match.players[id];
  if (!p || !p.alive) return;
  if (purge.benched(p) || (opts && opts.targetId && purge.benched(match.players[opts.targetId]))) return; // Purge: ผู้ชมใช้ไอเทมไม่ได้ และใช้ใส่ผู้ชมไม่ได้
  if (asleep(p)) return; // หลับไหล: ใช้ไอเทมไม่ได้เลย (ยาโชคลาภ/ต้านสถานะ/แต้มสกิล/เกราะ เดิมไม่เช็ค p.locked จึงรั่ว)
  if (CHAR_HOOKS.conner.skillBlocked(engine, p)) return; // คอนเนอร์: ระหว่างการไล่ล่า ทุกคนใช้ไอเทมไม่ได้ (รวมคอนเนอร์กับเป้าหมาย)
  if (CHAR_HOOKS.brian.itemBlocked(engine)) return;      // ไบรอัน: ระหว่างการแข่ง ทุกคนใช้ไอเทมไม่ได้
  if (CHAR_HOOKS.daisuke.actionBlocked(engine, p)) return; // Clock Up: คนอื่นใช้ไอเทมไม่ได้
  // ผู้วิงวอน (patch 3.4): "ลูกแกะน้อยรู้แจ้ง" กันการเล็งผู้วิงวอนด้วยไอเทมด้วย (เช่นกระสุน GUTS Select)
  if (opts && opts.targetId && CHAR_HOOKS.the_supplicant.targetBlocked(p, match.players[opts.targetId])) return;
  const idx = (p.inventory || []).findIndex((it) => it.uid === uid);
  if (idx < 0) return;
  const item = p.inventory[idx];
  // ---------- เกราะ Mark 42 (characters/_mark42.js): ใส่เอง / ใส่ให้คนอื่น / ใส่ให้คนอื่นแล้วระเบิด — ช่วงจั่วการ์ด ----------
  if (item.type === "mark42") {
    if (match.gameState !== "PLAYING") return;
    const plan = Mark42.planUse(engine, p, item, opts.mode, opts.targetId);
    if (!plan) return;
    p.inventory.splice(idx, 1);
    characterRules.mark42Run(p, plan, CHAR_HOOKS.conner.onItemUsed ? () => CHAR_HOOKS.conner.onItemUsed(engine, p) : null);
    return;
  }
  let cutsceneKey = null;  // ตั้งค่าโดยกระสุน GUTS Select — ถ้ามีจะตัดเข้า CUTSCENE แทน broadcastState ปกติ
  let pendingShot = null;  // { item, target } ของกระสุนที่ยิง — ให้ผลจริงตอนวีดีโอจบ
  if (item.type === "cardColor") {
    if (match.gameState !== "PLAYING" || p.locked) return; // ใช้ได้เฉพาะช่วงกำลังจั่วไพ่อยู่เท่านั้น
    const cardIndex = Number(opts.cardIndex);
    const color = opts.color;
    const target = Number.isInteger(cardIndex) ? p.cards[cardIndex] : null;
    if (!target || target.special || !cardDeck.CARD_COLORS.includes(color)) return; // ต้องเลือกการ์ดเลข (ไม่ใช่การ์ดพิเศษ) + สีที่ถูกต้อง
    const oldColor = target.color;
    target.color = color;
    cardDeck.checkBlueTrigger(p); // เผื่อเปลี่ยนสีแล้วครบฟ้า 3 ใบพอดี
    match.lastLog.push(`🎨 ${p.name} ใช้ยาเปลี่ยนสีการ์ด — เปลี่ยนไพ่ ${cardLabel(target)} จาก${CARD_COLOR_NAME[oldColor]}เป็น${CARD_COLOR_NAME[color]}`);
  } else if (item.type === "fortune") {
    p.statuses.fortune = Math.min(BARD_FORTUNE_MAX, (p.statuses.fortune || 0) + SHOP_FORTUNE_AMOUNT);
    p.fortuneIdle = 0;
    match.lastLog.push(`🍀 ${p.name} ใช้ยาโชคลาภ — ได้โชคลาภ +${SHOP_FORTUNE_AMOUNT} จากคลัง`);
  } else if (item.type === "resist") {
    p.statuses.resist = Math.max(p.statuses.resist || 0, SHOP_RESIST_TURNS);
    match.lastLog.push(`🛡️ ${p.name} ใช้ยาต้านสถานะ — ต้านสถานะผิดปกติ ${SHOP_RESIST_TURNS} เทิร์น จากคลัง`);
  } else if (item.type === "cardRemove") {
    if (match.gameState !== "PLAYING" || p.locked || !p.cards || p.cards.length === 0) return;
    const removed = p.cards.pop();
    match.centralDeck.push(removed); // คืนไพ่ที่ลดออกกลับเข้ากองกลาง ให้คนอื่นจั่วได้อีก
    p.busted = cardDeck.bustedOf(p);
    match.lastLog.push(`✂️ ${p.name} ใช้ยาลดไพ่ — ลดไพ่ใบล่าสุด (${cardLabel(removed)}) ออก คืนเข้ากองกลาง${p.busted ? "" : " — ไพ่ไม่แตกแล้ว!"}`);
  } else if (item.type === "skillPoint") {
    combat.addSkill(p, item.value, "item");
    match.lastLog.push(`⚡ ${p.name} ใช้ยาฟื้นแต้มสกิล +${item.value} จากคลัง (เพดาน ${combat.maxSkillOf(p)})`);
  } else if (item.type === "armor") {
    const healed = combat.healArmor(p, item.value);
    match.lastLog.push(`🔧 ${p.name} ใช้ยาฟื้นเกราะ +${healed} จากคลัง`);
  } else if (item.type === "wineBarrel") {
    if (match.gameState !== "PLAYING" || p.locked) return; // ของกดใช้: ใช้ได้เฉพาะช่วงกำลังจั่วไพ่อยู่เท่านั้น
    if (!CHAR_HOOKS.escanor.useWineBarrel(engine, p, item)) return;
    match.lastLog.push(`🍷 ${p.name} ดื่ม ${item.name || `WineBarrel Lv.${item.level || 1}`} จากคลัง`);
  } else if (item.type === "tepeuMeal") {
    const healed = combat.healHp(p, item.value);
    match.lastLog.push(`🍲 ${p.name} ใช้ "มื้อที่สุข" — ฟื้นพลังชีวิต +${healed} จากคลัง`);
  } else if (item.type === "gutsGun" || item.type === "blackSparklence") {
    return; // ปืนเป็นไอเทมถาวร ไม่ใช่ของกดใช้ — ต้อง return ก่อนถึง splice ท้ายฟังก์ชัน ไม่งั้นปืนหายทันทีที่กด
  } else if (item.type === "gutsAmmo") {
    if (item.ammo === "hyper_trigger") {
      const readyRound = p.hyperTriggerReadyRound || 0;
      if (match.gameState !== "PLAYING" || p.locked || !hasGutsGun(p) || p.gutsShotTurn === match.roundNumber || p.characterId === "ultraman_trigger" || p.characterId === "ignis" || hasBlackSparklence(p) || match.roundNumber < readyRound) return;
      if (!CHAR_HOOKS.ultraman_trigger.activate(engine, p)) return;
      p.gutsShotTurn = match.roundNumber;
      cutscene.pausePlayingForCutscene();
      return;
    }
    if (item.ammo === "trigger_dark_key") {
      if (match.gameState !== "PLAYING" || p.locked || !hasBlackSparklence(p) || p.gutsShotTurn === match.roundNumber || match.roundNumber < (p.blackSparklenceReadyRound || 0)) return;
      if (!CHAR_HOOKS.ignis.activateTriggerDark(engine, p)) return;
      p.inventory.splice(idx, 1);
      p.gutsShotTurn = match.roundNumber;
      cutscene.pausePlayingForCutscene();
      return;
    }
    const target = gutsFireTargetOf(p, item, opts.targetId);
    if (!target) return; // ยิงไม่ได้ = ไม่เสียกระสุน
    if (mercury.isOrt(target)) CHAR_HOOKS.ort.queueCounter(engine, p.id); // ORT สกิลติดตัว 2: ถูกยิงด้วยปืน -> สวนกลับ
    p.gutsShotTurn = match.roundNumber; // 1 นัดต่อเทิร์น — จองไว้ตั้งแต่ตอนกด กันยิงซ้ำระหว่างวีดีโอเล่นอยู่
    match.lastLog.push(`🔫 ${p.name} ยิง ${GUTS_AMMO[item.ammo].name} ใส่ ${target.name}!`);
    // วีดีโอเต็มจอของกระสุนแต่ละแบบเล่นครั้งเดียวต่อเกม "ต่อผู้ยิงแต่ละคน" (เก็บใน p.cutsceneShown เหมือน
    //  วีดีโอแปลงร่างของตัวละคร — รีเซ็ตทุกแมตช์ใหม่ใน resetCombat) ครั้งต่อไปเป็นการ์ดแจ้งเตือนเล็ก ไม่หยุดกระดาน
    const key = GUTS_AMMO[item.ammo].cut;
    if (p.cutsceneShown[key]) cutscene.notifyTransform(p, key);
    else { p.cutsceneShown[key] = true; cutsceneKey = key; }
    pendingShot = { item, target };
  } else {
    return;
  }
  p.inventory.splice(idx, 1);
  // คอนเนอร์ RK800 (สกิลติดตัว 1 สืบสวน): การใช้ไอเทม 1 ครั้ง = ความเครียด +1
  CHAR_HOOKS.conner.onItemUsed(engine, p);
  if (cutsceneKey) {
    // เล่นวีดีโอก่อน แล้วค่อยให้ผลของกระสุนเกิดขึ้นตอนวีดีโอจบ (ผู้เล่นจะเห็นความเสียหายโผล่หลังจบวีดีโอ)
    cutscene.queueCutscene(p, cutsceneKey);
    // ห่อ withEffectSource ซ้ำ: คอลแบ็กนี้ทำงาน "หลังวีดีโอจบ" ซึ่งหลุดออกจากขอบเขต effectSourceId ของ
    //  onPlayerEvent ไปแล้ว — ไม่ห่อ = ตราล่าเวท (ผู้สังหารเมจ) และ friendly-fire check ไม่รู้ว่าใครยิง
    cutscene.pausePlayingForCutscene(() => combat.withEffectSource(p, () => applyGutsBullet(p, pendingShot.item, pendingShot.target)));
  } else {
    if (pendingShot) applyGutsBullet(p, pendingShot.item, pendingShot.target); // ไม่มีวีดีโอ = ให้ผลทันที
    view.broadcastState();
  }
}
// ตรวจว่ายิงได้ไหม + คืนเป้าหมายที่ถูกต้อง (null = ยิงไม่ได้)
//  ยิงได้เฉพาะช่วงจั่วไพ่และยังไม่เปิดไพ่ / ต้องมีปืน / 1 นัดต่อเทิร์น / เป้าหมายต้องเป็นคนอื่นที่ยังไม่ตกรอบ
function gutsFireTargetOf(p, item, targetId) {
  if (match.gameState !== "PLAYING" || p.locked) return null;
  if (!hasGutsWeapon(p)) return null;
  if (hasBlackSparklence(p) && match.roundNumber < (p.blackSparklenceReadyRound || 0)) return null;
  if (p.gutsShotTurn === match.roundNumber) return null;
  if (!GUTS_AMMO[item.ammo]) return null;
  const target = match.players[targetId];
  if (!target || !target.alive || target.id === p.id || combat.sameTeam(p, target)) return null;
  return target;
}
// ให้ผลของกระสุน — เรียกหลังวีดีโอจบเท่านั้น (ดู pausePlayingForCutscene)
function applyGutsBullet(p, item, target) {
  // Nursedessei Cannon: ยิงเสร็จปืนพัง หายจากกระเป๋า ต้องซื้อใหม่ (พังแม้เป้าหมายจะตกรอบไปก่อนแล้ว)
  if (GUTS_AMMO[item.ammo].breaksGun) {
    const gunIdx = (p.inventory || []).findIndex((it) => it.type === "gutsGun");
    if (gunIdx >= 0) p.inventory.splice(gunIdx, 1);
    else if (hasBlackSparklence(p)) p.blackSparklenceReadyRound = match.roundNumber + BLACK_SPARKLENCE_NURSE_COOLDOWN + 1;
  }
  if (!target || !target.alive) { // เป้าหมายตกรอบระหว่างวีดีโอเล่น — กระสุนสูญเปล่า
    match.lastLog.push(`💨 ${GUTS_AMMO[item.ammo].name} พลาดเป้า — ${target ? target.name : "เป้าหมาย"} ตกรอบไปก่อนแล้ว`);
    return;
  }
  if (item.ammo === "shockwave") {
    const before = target.armor;
    // Recruit [Armor]: สลายเกราะก็นับเป็น "โดน 1 ครั้ง" ไม่ใช่เกราะหายทั้งหมด
    if (Mark42.suited(target)) Mark42.breakSuit(engine, target, "combat"); // เกราะ Mark 42: สลายเกราะ = ชุดพัง
    else if (!CHAR_HOOKS.recruit.absorbHit(engine, target)) for (let i = 0; i < before; i++) { if (target.armor > 0) combat.loseArmor(target); }
    // ผู้วิงวอน: "ปืนสลายเกราะ" ทำลาย "เกราะศรัทธา" ได้เหมือนเกราะปกติทุกประการ (สเปคระบุไว้ชัด)
    const faithBefore = CHAR_HOOKS.the_supplicant.faithOf(target);
    for (let i = 0; i < faithBefore; i++) CHAR_HOOKS.the_supplicant.faithAbsorb(engine, target);
    if (faithBefore > 0) match.lastLog.push(`💥✝️ Shockwave Bullet — เกราะศรัทธาของ ${target.name} ถูกสลายทั้งหมด (-${faithBefore})`);
    combat.mageslayerMarkSteal(target, before); // ตราล่าเวท: กระสุนนี้ทำลายเกราะด้วย loseArmor ตรงๆ ไม่ผ่านท่อ deal* จึงต้องเรียกเอง
    match.lastLog.push(before > 0
      ? `💥 Shockwave Bullet — เกราะของ ${target.name} ถูกทำลายทั้งหมด (-${before}) แต่พลังชีวิตจริงไม่ได้รับความเสียหาย`
      : `💨 Shockwave Bullet — ${target.name} ไม่มีเกราะให้ทำลาย กระสุนสูญเปล่า`);
  } else if (item.ammo === "gargorgon") {
    target.gutsGargorgonPending = true;
    match.lastLog.push(`🌑 Gargorgon Ray — ${target.name} จะติดสถานะสตั้นในเทิร์นถัดไป (ต้านทานได้)`);
  } else if (item.ammo === "thunder") {
    if (combat.applyDebuff(target, "chaa", null, GUTS_CHAA_TURNS)) match.lastLog.push(`⚡ Thunder Bullet — ${target.name} ติดสถานะ [สภาพชา] ${GUTS_CHAA_TURNS} เทิร์น (กดจั่ว 1 ครั้งได้ไพ่ 2 ใบ)`);
    else match.lastLog.push(`🛡️ Thunder Bullet — ${target.name} ต้านสถานะผิดปกติไว้ได้ ไม่ติด [สภาพชา]`);
  } else if (item.ammo === "nurse") {
    // _itemDamage: ก้อนนี้มาจาก "ปืนที่เป็นไอเทม" ไม่ใช่สกิลของตัวละคร
    //  อิปโป: ห้ามหลบปืนที่เป็นไอเทม — ดู characters/ippo.js adjustIncomingDamage
    target._itemDamage = true;
    combat.dealMixed(target, GUTS_NURSE_DMG);
    target._itemDamage = false;
    match.lastLog.push(hasBlackSparklence(p)
      ? `☄️ Nursedessei Cannon — ${target.name} เสียหาย -${GUTS_NURSE_DMG} (ลดเกราะก่อน) และ Black Sparklence ของ ${p.name} ใช้งานไม่ได้ ${BLACK_SPARKLENCE_NURSE_COOLDOWN} เทิร์น!`
      : `☄️ Nursedessei Cannon — ${target.name} เสียหาย -${GUTS_NURSE_DMG} (ลดเกราะก่อน) และปืนของ ${p.name} พังหายไป!`);
    combat.maybeBeatSave(target);
    combat.maybeBeatMode(target);
    characterRules.maybeWakeKotone(target);
    if (target.alive && target.hp <= 0) {
      combat.instantDeath(target);
      if (!target.alive) match.lastLog.push(`💀 ${target.name} เลือดจริงหมด ตกรอบ!`);
    }
  }
}
