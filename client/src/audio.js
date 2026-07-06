// ============================================================
//  ระบบเสียง ECHO + master volume
//  - master volume คุมทุกเสียง (เพลง / เอฟเฟกต์ / เสียงพากย์ / วีดีโอ) ด้วย curve ยกกำลังสอง
//    ให้หลอดปรับเสียงมีผลชัดเจน (linear เดิมฟังแทบไม่ต่าง)
//  - เพลงเล่นต่อจากจุดเดิมเฉพาะ "ในแมตช์เดียวกัน" — เริ่มเกมใหม่รีเซ็ตทั้งหมด (resetMusicPositions)
//  - เพลงสกิล/ท่าไม้ตาย: ส่ง seq มาด้วย ถ้า seq เปลี่ยน (เปิดท่าใหม่ / ถูกทับด้วยเพลงเดียวกัน
//    ของอีกคน) เพลงจะเริ่มใหม่จากต้น
// ============================================================

const FILES = {
  main_home: "/theme_song/main_home.mp3",
  card_prepare_turn: "/theme_song/card_prepare_turn.mp3",
  ginga: "/characters/hikaru/ginga_song.mp3",
  unicorn: "/characters/banagher/unicorn_song.mp3",
  final_normal: "/characters/kuwagata/final_normal.mp3", // เพลงระหว่างสวมเกราะราชัน
  ex_guts: "/characters/kuwagata/ex_guts.mp3",           // เพลง Beat Mode (ทับทุกเพลงจนตาย)
  normal_k: "/characters/kuwagata/normal_k.mp3",         // เสียงพากย์หลังวีดีโอสวมเกราะราชัน
  ex_k: "/characters/kuwagata/ex_k.mp3",                 // เสียงพากย์หลังวีดีโอ Beat Mode
  temari_final_theme: "/characters/temari/temari_final_theme.mp3", // เพลง ANATA WAAAAAAAA (เล่นถึงตอนเปิดไพ่)
  fujimaru_final: "/characters/fujimaru/fujimaru_final_theme.mp3", // เพลงระหว่าง Everything For Humanity (ฟุจิมารุ)
  action_button: "/effect_sound/action_button.wav",
  trun_change: "/effect_sound/trun_change.wav",
  attack: "/effect_sound/attack.wav",
};

// ระดับเสียงพื้นฐานต่อชนิด (ก่อนคูณ master) — บาลานซ์ให้ดังใกล้เคียงกัน
const MUSIC_BASE = 0.55;
const SFX_BASE = 0.85;
const CLICK_BASE = 0.55;
const VIDEO_BASE = 0.8;

// เพลงบางเพลงต้นฉบับดังกว่าเพลงอื่นมาก (เพลงคุวากาตะทั้ง 2 แบบ) — ลดเฉพาะตัวให้สมดุลกับเพลงอื่น
const MUSIC_TRACK_SCALE = {
  final_normal: 0.6, // สวมเกราะราชัน
  ex_guts: 0.6,       // Beat Mode
};
function trackVolume(name) {
  return MUSIC_BASE * (MUSIC_TRACK_SCALE[name] ?? 1) * vcurve();
}

// ---------- master volume (จำค่าไว้ใน localStorage) ----------
let masterVolume = 0.8;
try {
  const saved = parseFloat(localStorage.getItem("echo_vol"));
  if (!Number.isNaN(saved)) masterVolume = Math.max(0, Math.min(1, saved));
} catch {}
const volListeners = new Set();

// curve ยกกำลังสอง: หูคนรับรู้ความดังแบบ log — ทำให้เลื่อนหลอดแล้วรู้สึกเปลี่ยนจริง
const vcurve = () => masterVolume * masterVolume;

export function getMasterVolume() { return masterVolume; }
export function videoVolume() { return VIDEO_BASE * vcurve(); } // ให้ <video> ใช้ (ผ่าน curve เดียวกัน)
export function onVolumeChange(fn) { volListeners.add(fn); return () => volListeners.delete(fn); }
export function setMasterVolume(v) {
  masterVolume = Math.max(0, Math.min(1, v));
  try { localStorage.setItem("echo_vol", String(masterVolume)); } catch {}
  if (currentMusic) getMusic(currentMusic).volume = trackVolume(currentMusic);
  volListeners.forEach((fn) => fn(masterVolume));
}

let currentMusic = null;
// seq ล่าสุด "ต่อเพลง" (ไม่ใช่ต่อการสลับเพลง): จำไว้แม้เพลงถูกพัก/สลับออก
// -> กลับมาเล่นเพลงเดิมด้วย seq เดิม (เช่น หลังจบ cutscene ของคนอื่น) = เล่นต่อจากจุดเดิม ไม่เริ่มใหม่
// -> seq ใหม่ (เปิดท่าครั้งใหม่ / คนอื่นเปิดท่าเพลงเดียวกันทับ) = เริ่มจากต้น
const musicSeq = {};
const musicCache = {};
function getMusic(name) {
  if (!musicCache[name]) {
    const a = new Audio(FILES[name]);
    a.loop = true;
    musicCache[name] = a;
  }
  musicCache[name].volume = trackVolume(name);
  return musicCache[name];
}

// seq: identity ของการเปิดเพลงสกิล — เปิดท่าใหม่/คนใหม่ทับเพลงเดิม = seq ใหม่ -> เริ่มจากต้น
// เพลงทั่วไป (main_home / card_prepare_turn) ไม่ส่ง seq -> เล่นต่อจากจุดเดิม (เฉพาะในแมตช์)
export function playMusic(name, seq) {
  if (!FILES[name]) return;
  const a = getMusic(name);
  // seq เดิมของเพลงนี้ (จำข้ามการพัก/สลับเพลง) — เปลี่ยนเมื่อไหร่ค่อยเริ่มเพลงใหม่จากต้น
  const isNewSeq = seq != null && seq !== musicSeq[name];
  if (isNewSeq) {
    musicSeq[name] = seq;
    a.currentTime = 0; // การเปิดร่างครั้งใหม่ (กดใหม่/โดนคนอื่นทับ) -> เริ่มจากต้น
  }
  if (currentMusic === name) {
    if (isNewSeq || a.paused) a.play().catch(() => {}); // ไม่ใช่ seq ใหม่ = เล่นต่อจากตำแหน่งเดิม
    return;
  }
  if (currentMusic) getMusic(currentMusic).pause(); // พักเพลงเดิม เก็บตำแหน่งไว้ (ในแมตช์)
  currentMusic = name;
  a.play().catch(() => {}); // seq เดิม (เช่น กลับมาหลัง cutscene) -> เล่นต่อจากจุดเดิม ไม่เริ่มใหม่
}
export function stopMusic() {
  if (!currentMusic) return;
  getMusic(currentMusic).pause(); // พักไว้ ไม่รีเซ็ต -> กลับมาเล่นต่อจากจุดเดิม (ในแมตช์)
  currentMusic = null;
}
// เริ่มเกมใหม่ / จบแมตช์: รีเซ็ตตำแหน่งเพลงทุกเพลง -> ครั้งถัดไปเริ่มจากต้นทั้งหมด
export function resetMusicPositions() {
  for (const a of Object.values(musicCache)) {
    a.pause();
    a.currentTime = 0;
  }
  for (const k of Object.keys(musicSeq)) delete musicSeq[k];
  currentMusic = null;
}
export function playSfx(name) {
  if (!FILES[name]) return;
  const a = new Audio(FILES[name]);
  a.volume = (name === "action_button" ? CLICK_BASE : SFX_BASE) * vcurve();
  a.play().catch(() => {});
}
export function clickSound() { playSfx("action_button"); }

function resumeCurrent() {
  if (currentMusic) {
    const a = getMusic(currentMusic);
    if (a.paused) a.play().catch(() => {});
  }
}
if (typeof window !== "undefined") window.addEventListener("pointerdown", resumeCurrent);
