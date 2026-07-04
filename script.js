// ============================================
//  โปรแกรมเกม Blackjack แข่งกับบอท
// ============================================

// ตัวแปรเก็บสถานะของเกม
let deck = [];        // สำรับไพ่
let playerCards = []; // ไพ่ในมือผู้เล่น
let dealerCards = []; // ไพ่ในมือเจ้ามือ
let gameOver = true;  // เกมจบแล้วหรือยัง


// -------------------------------------------------
// สลับหน้าจอ: เมนู <-> เกม
// -------------------------------------------------
function startGame() {
  document.getElementById("menu-screen").style.display = "none";
  document.getElementById("game-screen").style.display = "block";
  newGame();
}

function backToMenu() {
  document.getElementById("game-screen").style.display = "none";
  document.getElementById("menu-screen").style.display = "flex";
}


// -------------------------------------------------
// ฟังก์ชันสร้างสำรับไพ่ 52 ใบ
// -------------------------------------------------
function createDeck() {
  const suits = ["♠", "♥", "♦", "♣"];          // ดอกไพ่
  const values = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];
  let newDeck = [];

  for (let suit of suits) {
    for (let value of values) {
      newDeck.push({ suit: suit, value: value });
    }
  }
  return newDeck;
}


// -------------------------------------------------
// สับไพ่ (สลับตำแหน่งแบบสุ่ม)
// -------------------------------------------------
function shuffle(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    let j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];  // สลับไพ่ตำแหน่ง i กับ j
  }
  return deck;
}


// -------------------------------------------------
// จั่วไพ่ 1 ใบจากสำรับ (เอาใบบนสุดออกมา)
// -------------------------------------------------
function drawCard() {
  return deck.pop();
}


// -------------------------------------------------
// คำนวณแต้มไพ่ในมือ
// A นับเป็น 11 หรือ 1 ก็ได้ (เลือกให้ไม่เกิน 21)
// J, Q, K นับเป็น 10
// -------------------------------------------------
function calculateScore(cards) {
  let score = 0;
  let aces = 0; // นับจำนวน A

  for (let card of cards) {
    if (card.value === "A") {
      aces++;
      score += 11;
    } else if (["J","Q","K"].includes(card.value)) {
      score += 10;
    } else {
      score += Number(card.value);
    }
  }

  // ถ้าแต้มเกิน 21 และมี A ให้เปลี่ยน A จาก 11 เป็น 1
  while (score > 21 && aces > 0) {
    score -= 10;
    aces--;
  }

  return score;
}


// -------------------------------------------------
// แสดงไพ่บนหน้าจอ
// hideFirst = true คือซ่อนไพ่ใบแรกของเจ้ามือ (คว่ำไว้)
// -------------------------------------------------
function renderCards(cards, elementId, hideFirst) {
  let html = "";

  for (let i = 0; i < cards.length; i++) {
    let card = cards[i];

    // ถ้าเป็นใบแรกของเจ้ามือและต้องซ่อน
    if (hideFirst && i === 0) {
      html += '<div class="card hidden-card">?</div>';
    } else {
      // ไพ่โพแดง(♥) กับข้าวหลามตัด(♦) เป็นสีแดง
      let colorClass = (card.suit === "♥" || card.suit === "♦") ? "red" : "";
      html += '<div class="card ' + colorClass + '">' + card.value + card.suit + '</div>';
    }
  }

  document.getElementById(elementId).innerHTML = html;
}


// -------------------------------------------------
// อัปเดตหน้าจอทั้งหมด (ไพ่ + แต้ม)
// -------------------------------------------------
function updateScreen(hideDealer) {
  renderCards(playerCards, "player-cards", false);
  renderCards(dealerCards, "dealer-cards", hideDealer);

  document.getElementById("player-score").textContent = calculateScore(playerCards);

  if (hideDealer) {
    // ตอนซ่อนไพ่ ยังไม่โชว์แต้มจริงของเจ้ามือ
    document.getElementById("dealer-score").textContent = "?";
  } else {
    document.getElementById("dealer-score").textContent = calculateScore(dealerCards);
  }
}


// -------------------------------------------------
// เริ่มเกมใหม่
// -------------------------------------------------
function newGame() {
  // สร้างและสับสำรับใหม่
  deck = shuffle(createDeck());

  // แจกไพ่คนละ 2 ใบ
  playerCards = [drawCard(), drawCard()];
  dealerCards = [drawCard(), drawCard()];

  gameOver = false;

  // เปิดปุ่มจั่ว/หยุด
  document.getElementById("btn-hit").disabled = false;
  document.getElementById("btn-stand").disabled = false;

  document.getElementById("message").textContent = "ตาของคุณ! จั่วไพ่หรือหยุด?";

  updateScreen(true); // ซ่อนไพ่ใบแรกของเจ้ามือ

  // ตรวจว่าผู้เล่นได้ Blackjack (21 ตั้งแต่แรก) หรือไม่
  if (calculateScore(playerCards) === 21) {
    playerStand();
  }
}


// -------------------------------------------------
// ผู้เล่นจั่วไพ่
// -------------------------------------------------
function playerHit() {
  if (gameOver) return;

  playerCards.push(drawCard());
  updateScreen(true);

  let score = calculateScore(playerCards);

  // ถ้าเกิน 21 คือแตก (Bust) แพ้ทันที
  if (score > 21) {
    endGame("แตก! (เกิน 21) คุณแพ้ 😢");
  } else if (score === 21) {
    // ได้ 21 พอดี หยุดให้อัตโนมัติ
    playerStand();
  }
}


// -------------------------------------------------
// ผู้เล่นหยุด -> ถึงตาบอทเล่น
// กติกาบอท: จั่วต่อไปเรื่อยๆ จนแต้มถึง 17 ขึ้นไป
// ใช้ setTimeout เพื่อให้เห็นบอทจั่วทีละใบ (มีอนิเมชัน)
// -------------------------------------------------
function playerStand() {
  if (gameOver) return;

  // ปิดปุ่มจั่ว/หยุดระหว่างบอทเล่น
  document.getElementById("btn-hit").disabled = true;
  document.getElementById("btn-stand").disabled = true;

  // เปิดไพ่ใบที่คว่ำของเจ้ามือก่อน
  updateScreen(false);

  // ให้บอทจั่วทีละใบ ทุกๆ 0.7 วินาที
  dealerTurn();
}


// -------------------------------------------------
// บอทจั่วไพ่ทีละใบ (แบบหน่วงเวลาให้เห็นอนิเมชัน)
// -------------------------------------------------
function dealerTurn() {
  if (calculateScore(dealerCards) < 17) {
    // ยังไม่ถึง 17 -> จั่วเพิ่ม 1 ใบ แล้วเรียกตัวเองอีกครั้ง
    dealerCards.push(drawCard());
    updateScreen(false);
    setTimeout(dealerTurn, 700);
  } else {
    // ถึง 17 ขึ้นไปแล้ว -> ตัดสินผล
    decideWinner();
  }
}


// -------------------------------------------------
// ตัดสินผู้ชนะ
// -------------------------------------------------
function decideWinner() {
  let playerScore = calculateScore(playerCards);
  let dealerScore = calculateScore(dealerCards);

  let message = "";

  if (dealerScore > 21) {
    message = "เจ้ามือแตก! คุณชนะ 🎉";
  } else if (playerScore > dealerScore) {
    message = "คุณชนะ! 🎉";
  } else if (playerScore < dealerScore) {
    message = "เจ้ามือชนะ 😢";
  } else {
    message = "เสมอกัน 🤝";
  }

  endGame(message);
}


// -------------------------------------------------
// จบเกม แสดงผล และเปิดไพ่เจ้ามือ
// -------------------------------------------------
function endGame(message) {
  gameOver = true;
  updateScreen(false); // เปิดไพ่เจ้ามือให้เห็นทั้งหมด

  document.getElementById("message").textContent = message;
  document.getElementById("btn-hit").disabled = true;
  document.getElementById("btn-stand").disabled = true;
}
