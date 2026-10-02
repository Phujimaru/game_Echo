// กระดานโหมด Purge — กราฟช่องเดิน 150 ช่อง (ทางหลัก) + ทางแยกภูมิภาคละ 1 จุด + ช่องกิจกรรม
//  ข้อมูลล้วน (ไม่มีสถานะแมตช์) สร้างครั้งเดียวด้วย seed คงที่ — ส่งให้ client ทั้งก้อน (client วาดตามนี้)
//  ช่อง (node): { id, prog, lane, next: [id], tile, region }
//   prog = ระยะทางเทียบทางหลัก (ใช้ตัดสินว่า ORT ไล่ทันไหม และใช้วางตำแหน่งตามแนวท่อ)
//   lane = มุมเยื้องจากทางหลัก (เรเดียน, + = ผนังฝั่ง +x) · next[0] = ทางเริ่มต้น (หมดเวลาเลือก = ไปทางนี้)
//  ทางแยก: ช่องแยกมี next หลายทาง · ทางย่อยไปรวมกับทางหลักที่ช่อง join

const BOARD_MAIN = 150;     // ช่องสุดท้ายของทางหลัก = ประตูผนึก
const REGION_LEN = 30;      // ภูมิภาคละ 30 ช่อง (5 ภูมิภาค)
// ทางแยกของแต่ละภูมิภาค (นับจากต้นภูมิภาค): แยกที่ at รวมที่ join · ทางย่อยแต่ละสาย: ฝั่ง (-1/+1) + จำนวนช่อง + นิสัย
const FORKS = [
  { at: 6, join: 22, lanes: [{ side: -1, len: 10, kind: "short" }, { side: 1, len: 20, kind: "long" }] },
  { at: 8, join: 24, lanes: [{ side: 1, len: 11, kind: "short" }, { side: -1, len: 19, kind: "secret" }] },
  { at: 5, join: 21, lanes: [{ side: -1, len: 9, kind: "short" }, { side: 1, len: 21, kind: "long" }] },
  { at: 7, join: 23, lanes: [{ side: 1, len: 12, kind: "short" }] },
  { at: 6, join: 22, lanes: [{ side: -1, len: 10, kind: "short" }, { side: 1, len: 18, kind: "secret" }] },
];
const LANE_OFFSET = 0.34;
// ชนิดช่องกิจกรรม (ชื่อไทยอยู่ฝั่ง client)
const TILE_TYPES = ["gold", "back", "stop", "heal", "skill", "item", "warp", "reroll", "lure", "region"];
// น้ำหนักการสุ่มชนิดช่องตามนิสัยทาง — ทางลัดเสี่ยง · ทางอ้อมมีของดี · ทางลับมีของหายาก
const WEIGHTS = {
  main: { gold: 5, back: 3, stop: 2, heal: 2, skill: 2, item: 3, warp: 1, reroll: 1, lure: 2 },
  short: { gold: 1, back: 5, stop: 4, heal: 1, skill: 1, item: 1, warp: 1, reroll: 1, lure: 4 },
  long: { gold: 6, back: 1, stop: 1, heal: 4, skill: 4, item: 4, warp: 1, reroll: 2, lure: 0 },
  secret: { gold: 3, back: 1, stop: 1, heal: 2, skill: 3, item: 6, warp: 4, reroll: 3, lure: 0 },
};
const TILE_CHANCE = { main: 0.34, short: 0.55, long: 0.5, secret: 0.6 };

function makeRnd(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; }; }
function pick(weights, r) {
  const entries = Object.entries(weights).filter(([, w]) => w > 0);
  const total = entries.reduce((n, [, w]) => n + w, 0);
  let x = r() * total;
  for (const [k, w] of entries) { x -= w; if (x <= 0) return k; }
  return entries[entries.length - 1][0];
}

function buildBoard(seed = 20261002) {
  const r = makeRnd(seed);
  const nodes = {};
  const add = (n) => { nodes[n.id] = n; return n; };
  const regionOf = (prog) => Math.min(4, Math.floor(prog / REGION_LEN));
  for (let i = 0; i <= BOARD_MAIN; i++) {
    add({ id: `m${i}`, prog: i, lane: 0, next: i < BOARD_MAIN ? [`m${i + 1}`] : [], tile: null, region: regionOf(i), kind: "main" });
  }
  const protectedIds = new Set(["m0", `m${BOARD_MAIN}`]);
  FORKS.forEach((f, ri) => {
    const at = ri * REGION_LEN + f.at, join = ri * REGION_LEN + f.join;
    protectedIds.add(`m${at}`); protectedIds.add(`m${join}`);
    f.lanes.forEach((ln, li) => {
      const ids = [];
      for (let k = 0; k < ln.len; k++) {
        const u = (k + 1) / (ln.len + 1);
        const id = `b${ri}${li}_${k}`;
        ids.push(id);
        add({ id, prog: at + u * (join - at), lane: ln.side * LANE_OFFSET * Math.pow(Math.sin(u * Math.PI), 0.55), next: [], tile: null, region: ri, kind: ln.kind });
      }
      ids.forEach((id, k) => { nodes[id].next = [k + 1 < ids.length ? ids[k + 1] : `m${join}`]; });
      nodes[`m${at}`].next.push(ids[0]);
    });
  });
  // ช่องกิจกรรม
  for (const n of Object.values(nodes)) {
    if (protectedIds.has(n.id) || n.prog < 2) continue;
    if (r() < TILE_CHANCE[n.kind]) n.tile = pick(WEIGHTS[n.kind], r);
  }
  // ช่องประจำภูมิภาค: ภูมิภาคละ 3 ช่อง บนทางหลัก (เว้นช่องที่มีกิจกรรมอยู่แล้วไม่ได้ — ทับได้)
  for (let ri = 0; ri < 5; ri++) {
    for (const off of [3, 14, 26]) {
      const id = `m${ri * REGION_LEN + off}`;
      if (nodes[id] && !protectedIds.has(id)) nodes[id].tile = "region";
    }
  }
  return { nodes, main: BOARD_MAIN, regionLen: REGION_LEN, gate: `m${BOARD_MAIN}`, start: "m0" };
}

module.exports = { buildBoard, BOARD_MAIN, REGION_LEN, TILE_TYPES };
