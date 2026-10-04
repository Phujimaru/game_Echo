// ============================================================
// Character hook bundle used by server.js as CHAR_HOOKS[characterId].
// Most legacy character logic still lives in server.js; modules here are
// gradually extracted per character.
// ============================================================

const tohno = require("./tohno");
const temari = require("./temari");
const takuto = require("./takuto");
const appleguy = require("./appleguy");
const nanaya = require("./nanaya");
const satoru = require("./satoru");
const shiki = require("./shiki");
const doomguy = require("./doomguy");
const oguri = require("./oguri");
const miyako = require("./miyako");
const tepeu = require("./tepeu");
const hikaru = require("./hikaru");
const phenex = require("./phenex");
const kotone = require("./kotone");
const bard = require("./bard");
const kai = require("./kai");
const mageslayer = require("./mageslayer");
const takumi = require("./takumi");
const bat_ben = require("./bat_ben");
const princess_shiki = require("./princess_shiki");
const ultraman_trigger = require("./ultraman_trigger");
const escanor = require("./escanor");
const hisakawa_sister = require("./hisakawa_sister");
const ignis = require("./ignis");
const eiji = require("./eiji");
const haruka = require("./haruka");
const conner = require("./conner");
const dan = require("./dan");
const shido = require("./shido");
const yui = require("./yui");
const ippo = require("./ippo");
const the_supplicant = require("./the_supplicant");
const brian = require("./brian");
const producer_lumi = require("./producer_lumi");
const muimi = require("./muimi");
const cayenne = require("./cayenne");
const daichi = require("./daichi");
const daisuke = require("./daisuke");
const yaguruma = require("./yaguruma");
const kagami = require("./kagami");
const tsurugi = require("./tsurugi");
const usagi = require("./usagi"); // อุซากิ (เอาฮา · unique)
const oberon_summer = require("./oberon_summer"); // โอเบรอน (ฤดูร้อน) — ระดับกลาง
const artoria_caster = require("./artoria_caster"); // จอมเวทย์ อาร์โทเรีย — ระดับง่าย
const reines = require("./reines"); // ไรเนส เอลเมลลอย — ระดับกลาง
const andersen = require("./andersen"); // ฮันส์ คริสเตียน แอนเดอร์เซน — ระดับยาก
const kim = require("./kim"); // Bamboo-Hatted Kim (พิเศษ · unique)
const recruit = require("./recruit"); // Recruit (ยาก · QTE)
const striker = require("./striker"); // สไตรเกอร์ ยูเรก้า (พิเศษ · ผู้เล่น 2 คนบังคับร่วมกัน)
const takt = require("./takt"); // อาซาฮินะ ทักต์ (พิเศษ · unique · คอนดักเตอร์ — ระบบพันธะของมิวสิคคาร์ท)
const titan = require("./titan"); // ไททัน (ง่าย · มิวสิคคาร์ท)
const cosette = require("./cosette"); // คอเซ็ตต์ ชไนเดอร์ (กลาง · มิวสิคคาร์ท)
const johnny = require("./johnny"); // จอห์นนี่ โจสตาร์ (ยาก · Tusk Act 1-4)
const dio = require("./dio"); // ดิโอ แบรนโด (Stardust) (กลาง · เกจเวลา / THE WORLD)
const sliver_bullet = require("./sliver_bullet"); // นักบินปริศนา (ง่าย · unique · ซ่อนตัวสิงร่างผู้เล่นอื่น)
const echo_queen = require("./echo_queen"); // Echo (พิเศษ · unique · ขยายร่าง / ร่างยักษ์ตีฟรี)
const ort = require("./ort"); // บอสมหันตภัย (บอตเท่านั้น — โหมด Type Mercury)

const CHARACTER_MODULES = [
  tohno,
  temari,
  takuto,
  appleguy,
  nanaya,
  satoru,
  shiki,
  doomguy,
  oguri,
  miyako,
  tepeu,
  hikaru,
  phenex,
  kotone,
  bard,
  kai,
  mageslayer,
  takumi,
  bat_ben,
  princess_shiki,
  ultraman_trigger,
  escanor,
  hisakawa_sister,
  ignis,
  eiji,
  haruka,
  conner,
  dan,
  shido,
  yui,
  muimi,
  ippo,
  the_supplicant,
  brian,
  producer_lumi,
  cayenne,
  daichi,
  daisuke,
  yaguruma,
  kagami,
  tsurugi,
  usagi,
  oberon_summer,
  artoria_caster,
  reines,
  andersen,
  kim,
  recruit,
  striker,
  takt,
  titan,
  cosette,
  johnny,
  dio,
  sliver_bullet,
  echo_queen,
  ort,
];

const CHAR_HOOKS = {};
for (const mod of CHARACTER_MODULES) CHAR_HOOKS[mod.id] = mod;

module.exports = CHAR_HOOKS;
