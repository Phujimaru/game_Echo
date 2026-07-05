// ============================================================
//  ระบบเสียง ECHO + master volume
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
  action_button: "/effect_sound/action_button.wav",
  trun_change: "/effect_sound/trun_change.wav",
  attack: "/effect_sound/attack.wav",
};

const MUSIC_BASE = 0.45; // ระดับเพลงพื้นฐาน (ก่อนคูณ master)

// ---------- master volume (จำค่าไว้ใน localStorage) ----------
let masterVolume = 0.8;
try {
  const saved = parseFloat(localStorage.getItem("echo_vol"));
  if (!Number.isNaN(saved)) masterVolume = Math.max(0, Math.min(1, saved));
} catch {}
const volListeners = new Set();

export function getMasterVolume() { return masterVolume; }
export function onVolumeChange(fn) { volListeners.add(fn); return () => volListeners.delete(fn); }
export function setMasterVolume(v) {
  masterVolume = Math.max(0, Math.min(1, v));
  try { localStorage.setItem("echo_vol", String(masterVolume)); } catch {}
  if (currentMusic) getMusic(currentMusic).volume = MUSIC_BASE * masterVolume;
  volListeners.forEach((fn) => fn(masterVolume));
}

let currentMusic = null;
const musicCache = {};
function getMusic(name) {
  if (!musicCache[name]) {
    const a = new Audio(FILES[name]);
    a.loop = true;
    musicCache[name] = a;
  }
  musicCache[name].volume = MUSIC_BASE * masterVolume;
  return musicCache[name];
}

// เพลงเล่นต่อจากจุดเดิมเสมอ (ไม่รีเซ็ตตำแหน่ง) — โดน cutscene/สรุปผลแทรกแล้วกลับมา เพลงต่อจากเดิม
export function playMusic(name) {
  if (!FILES[name]) return;
  if (currentMusic === name) {
    const a = getMusic(name);
    if (a.paused) a.play().catch(() => {}); // เพลงเดิมถูกพักไว้ -> เล่นต่อจากตำแหน่งเดิม
    return;
  }
  if (currentMusic) getMusic(currentMusic).pause(); // พักไว้เฉยๆ เก็บตำแหน่ง ไว้กลับมาเล่นต่อ
  currentMusic = name;
  getMusic(name).play().catch(() => {});
}
export function stopMusic() {
  if (!currentMusic) return;
  getMusic(currentMusic).pause(); // พักไว้ ไม่รีเซ็ต -> กลับมาเล่นต่อจากจุดเดิม
  currentMusic = null;
}
export function playSfx(name) {
  if (!FILES[name]) return;
  const a = new Audio(FILES[name]);
  a.volume = (name === "action_button" ? 0.6 : 0.85) * masterVolume;
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
