// รวมภูมิภาค IV–VII + สนาม 8 (Moon Cell วันดวล) (แต่ละไฟล์ทำแยกกัน) — ไฟล์ที่ยัง export null จะถูกข้าม
import area4 from "./area4";
import area5 from "./area5";
import area6 from "./area6";
import area7 from "./area7";
import area8 from "./area8";
import art4 from "./art4";
import art5 from "./art5";
import art6 from "./art6";
import art7 from "./art7";
import art8 from "./art8";

export const EXTRA_AREAS = Object.fromEntries([[4, area4], [5, area5], [6, area6], [7, area7], [8, area8]].filter(([, m]) => m));

const ARTS = [art4, art5, art6, art7, art8];
const merge = (key) => Object.assign({}, ...ARTS.map((a) => (a && a[key]) || {}));
/** ภาพเฉพาะภูมิภาค: ArenaArt หา kind ที่ไม่รู้จักในนี้ */
export const EXTRA_ART = { stand: merge("stand"), fx: merge("fx"), fore: merge("fore") };
