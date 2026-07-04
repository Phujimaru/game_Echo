// ============================================================
//  ระบบเสียง ECHO
//  - เพลงพื้นหลัง (loop): main_home / card_prepare_turn
//  - เอฟเฟกต์ (one-shot): action_button, trun_change
//  จัดการ autoplay policy ให้เอง (เบราว์เซอร์บล็อกเสียงจนกว่าจะมี user gesture)
// ============================================================

const FILES = {
  main_home: "/theme_song/main_home.mp3",
  card_prepare_turn: "/theme_song/card_prepare_turn.mp3",
  ginga: "/skill_song/ginga/ginga_song.mp3",
  unicorn: "/skill_song/banagher/unicorn_song.mp3",
  action_button: "/effect_sound/action_button.wav",
  trun_change: "/effect_sound/trun_change.wav",
};

const MUSIC_VOLUME = 0.45;

let currentMusic = null; // ชื่อเพลงพื้นหลังที่กำลังเล่น
const musicCache = {};

function getMusic(name) {
  if (!musicCache[name]) {
    const a = new Audio(FILES[name]);
    a.loop = true;
    a.volume = MUSIC_VOLUME;
    musicCache[name] = a;
  }
  return musicCache[name];
}

// เปลี่ยนเพลงพื้นหลัง (ถ้าเป็นเพลงเดิมอยู่แล้ว ไม่ทำอะไร -> ไม่รีสตาร์ท)
export function playMusic(name) {
  if (!FILES[name] || currentMusic === name) return;
  if (currentMusic) {
    const prev = getMusic(currentMusic);
    prev.pause();
    prev.currentTime = 0;
  }
  currentMusic = name;
  getMusic(name).play().catch(() => {}); // ถ้าโดนบล็อก จะถูกปลุกตอน user คลิกครั้งแรก
}

export function stopMusic() {
  if (!currentMusic) return;
  const a = getMusic(currentMusic);
  a.pause();
  a.currentTime = 0;
  currentMusic = null;
}

// เอฟเฟกต์เสียงสั้นๆ (สร้างใหม่ทุกครั้งเพื่อให้ซ้อนกันได้)
export function playSfx(name) {
  if (!FILES[name]) return;
  const a = new Audio(FILES[name]);
  a.volume = name === "action_button" ? 0.6 : 0.85;
  a.play().catch(() => {});
}

export function clickSound() {
  playSfx("action_button");
}

// ปลุกเพลงพื้นหลังให้เล่นต่อ ถ้าโดน autoplay บล็อกไว้ (เรียกตอนมี user gesture)
function resumeCurrent() {
  if (currentMusic) {
    const a = getMusic(currentMusic);
    if (a.paused) a.play().catch(() => {});
  }
}
if (typeof window !== "undefined") {
  window.addEventListener("pointerdown", resumeCurrent);
}
