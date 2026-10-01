// ตัวละครเป็นการ์ดโคจรรอบลูกโลก หนึ่งวงต่อหนึ่งหมวด (หน้าเลือกตัวละคร)
//  ภาพรวม: ทุกวงเป็นวงกลมรอบจุดศูนย์กลางโลก (แบบวงโคจรอะตอม / ทรงกลมวงแหวน) แต่ละวงเอียงคนละระนาบ
//          รัศมีต่างกันเล็กน้อย การ์ดเกาะวงแล้วโคจรช้าๆ สลับทิศ · ชี้การ์ด = วงนั้นหยุด + เด่นขึ้น + บอกชื่อ
//  โฟกัส: setFocus(k) = วง k หมุนมาตั้งเป็นวงรีเอียงหน้าโลก (การ์ดใหญ่ขึ้น) วงอื่นจางหาย + กดไม่ได้
//          ลาก / ล้อเมาส์ / rotate(±1) = หมุนวงทีละใบ · กดที่ว่าง (ไม่โดนการ์ดหรือโลก) = onEmpty()
//  ยกการ์ด: setLifted(ids) = ช่องของการ์ดนั้นจางลง (หน้าจอวาดการ์ด DOM ลอยออกไปแทน) · cardRect(id) = กรอบการ์ดบนจอ (px)
//  การ์ดทุกใบหันหน้าเข้ากล้องเสมอ — ตำแหน่งคำนวณจากท่าทางของวง (quaternion + รัศมี) ทุกเฟรม
//  เปิดหน้า (ไม่ให้กระตุก): วงค่อยๆ ลากเส้นตัวเองทีละวง (มีจุดนำหน้าเส้น) · ภาพตัวละครโหลด/ถอดรหัสเบื้องหลัง (portraits.js)
//          การ์ดสร้าง texture ทีละไม่กี่ใบต่อเฟรมเมื่อภาพพร้อม แล้วค่อยขยาย+จางเข้ามา
import { THREE } from "../../globe/globeCore";
import { FALLBACK } from "../../data/avatars";
import { getPortrait, portraitDone } from "./portraits";

const CARD_W = 0.2, CARD_H = 0.267;
const TW = 192, TH = 256;
const REDUCED = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
// ฉากเปิด: วง k เริ่มลากเส้นที่ DRAW_DELAY + k·DRAW_GAP วิ ใช้เวลา DRAW_DUR วิ · การ์ดโผล่ใช้ APPEAR วิ · สร้าง texture ≤ BUILD_PER_FRAME ใบ/เฟรม
const DRAW_DELAY = 0.12, DRAW_GAP = 0.09, DRAW_DUR = 1.0, APPEAR = 0.42, BUILD_PER_FRAME = 2;
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

// ท่าทางของวงตอนโฟกัส: วงกลมใหญ่รอบโลก เอียงหน้าเข้ากล้อง ~47° → บนจอเป็นวงรีกว้าง ใบหน้าสุดอยู่ใต้โลก ใบหลังสุดอยู่เหนือโลก
const FOCUS_TILT = 0.82, FOCUS_R = 1.75, FOCUS_Y = 0, FOCUS_CARD = 1.45;
const Q_FOCUS = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), FOCUS_TILT);
const UP = new THREE.Vector3(0, 1, 0);

// status: null | { label, tone: "lost" | "block" } · entry = ภาพจาก portraits.js (ครอปสัดส่วนช่องภาพมาแล้ว)
function drawCard(ctx, c, status, entry) {
  ctx.clearRect(0, 0, TW, TH);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, TW, TH);
  const dim = !!status;
  const x0 = 6, y0 = 6, w = TW - 12, h = TH - 12;
  if (entry && entry.state === "ok" && entry.bmp) {
    const im = entry.bmp, iw = im.width || 1, ih = im.height || 1;
    const s = Math.max(w / iw, h / ih), sw = w / s, sh = h / s;
    const sx = (iw - sw) / 2, sy = Math.max(0, Math.min(ih - sh, (ih - sh) * 0.16)); // ครอปแบบ cover เอนขึ้นบน (หน้าตัวละคร)
    if (dim) ctx.filter = "grayscale(1) brightness(.85)";
    ctx.drawImage(im, sx, sy, sw, sh, x0, y0, w, h);
    ctx.filter = "none";
  } else {
    const g = ctx.createLinearGradient(0, 0, TW, TH);
    g.addColorStop(0, dim ? "#b9c3cf" : "#c99ad6");
    g.addColorStop(1, dim ? "#8ba3c2" : "#3d8bd9");
    ctx.fillStyle = g;
    ctx.fillRect(x0, y0, w, h);
    ctx.font = "96px 'Segoe UI Emoji', 'Apple Color Emoji', sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(FALLBACK[c.avatar] || "🙂", TW / 2, TH / 2);
  }
  ctx.lineWidth = 6; ctx.strokeStyle = "#ffffff"; ctx.strokeRect(3, 3, TW - 6, TH - 6);
  ctx.lineWidth = 1.5; ctx.strokeStyle = "rgba(61,139,217,.75)"; ctx.strokeRect(7, 7, TW - 14, TH - 14);
  if (status) {
    ctx.fillStyle = "rgba(18,38,72,.82)";
    ctx.fillRect(7, TH - 52, TW - 14, 38);
    ctx.fillStyle = status.tone === "lost" ? "#ffb3bf" : "#eaf3fc";
    ctx.font = "600 21px 'Chakra Petch', 'Kanit', sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(status.label, TW / 2, TH - 33, TW - 24);
  }
}

// ระนาบวงที่ k จาก n วง: เส้นตั้งฉากกระจายรอบแกนสายตา → บนจอเป็นวงรีที่แกนยาวหมุนไปทีละ 180°/n (แบบสัญลักษณ์อะตอม)
//  มุมเอียงจากแกนสายตาสลับกันไม่ให้ซ้อนกันพอดี (ไม่เกิน ~70° จึงไม่มีวงไหนกลายเป็นเส้นตรง)
const OPEN = [1.02, 0.84, 1.18, 0.93];
const RAD = [0, 3, 1, 4, 2];
function overviewPose(k, n) {
  const beta = (k / n) * Math.PI + 0.42;
  const alpha = OPEN[k % OPEN.length];
  const normal = new THREE.Vector3(Math.sin(alpha) * Math.cos(beta), Math.sin(alpha) * Math.sin(beta), Math.cos(alpha));
  return { q: new THREE.Quaternion().setFromUnitVectors(UP, normal), R: 1.4 + 0.065 * RAD[k % RAD.length] };
}

// มุมในระนาบวง (ระบบ cos a·x + sin a·z ของวง) ที่อยู่ใกล้กล้องที่สุดเมื่อวงอยู่ในท่า q
const ex = new THREE.Vector3(), ez = new THREE.Vector3();
function frontAngle(q) {
  ex.set(1, 0, 0).applyQuaternion(q);
  ez.set(0, 0, 1).applyQuaternion(q);
  return Math.atan2(ez.z, ex.z);
}
const nearAngle = (t, ref) => {
  while (t - ref > Math.PI) t -= Math.PI * 2;
  while (t - ref < -Math.PI) t += Math.PI * 2;
  return t;
};

/**
 * @param groups [{ key, label, color, chars: [roster entry] }]
 * @param opts.onSelect(id)  กดการ์ด (ที่กดได้)
 * @param opts.onHover(card|null, ev)  card = { id, ring }
 * @param opts.onEmpty()  ตอนโฟกัส: กดที่ว่างนอกการ์ดและนอกลูกโลก
 */
export function createCharRings(core, groups, { onSelect, onHover, onEmpty }) {
  const { world, canvas } = core;
  const root = new THREE.Group();
  world.add(root);

  const N = groups.length;
  const statusOf = new Map(); // id → status
  let selected = null;
  let focus = null; // index วงที่โฟกัส | null = ภาพรวม
  let highlight = -1; // วงที่ชี้อยู่ที่รายชื่อหมวด
  let lifted = new Set(); // การ์ดที่ถูกยกออกจากวง (ช่องจางลง)

  const torus = new THREE.TorusGeometry(1, 0.0042, 6, 192);
  torus.rotateX(Math.PI / 2); // นอนในระนาบ xz ของวง (uv.x = มุมรอบวง 0..1 → ใช้ตัดเส้นตอนลากเส้น)

  // ลากเส้นวง: alphaMap ครึ่งขาว/ครึ่งดำ (nearest) แล้วยืด uv ด้วย repeat.x = 0.5/p → เห็นเฉพาะช่วงมุม 0..p ของวง
  const cutImg = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255, 0, 0, 0, 255]), 2, 1);
  cutImg.magFilter = cutImg.minFilter = THREE.NearestFilter;
  cutImg.generateMipmaps = false;
  cutImg.needsUpdate = true;
  // จุดนำหน้าเส้นตอนลาก
  const dotCv = document.createElement("canvas");
  dotCv.width = dotCv.height = 64;
  {
    const g = dotCv.getContext("2d").createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.22, "rgba(255,255,255,.95)"); g.addColorStop(1, "rgba(255,255,255,0)");
    const dctx = dotCv.getContext("2d");
    dctx.fillStyle = g; dctx.fillRect(0, 0, 64, 64);
  }
  const dotTex = new THREE.CanvasTexture(dotCv);
  // การ์ดที่ยังไม่มี texture ใช้ภาพว่างร่วมกัน (shader เดียวกับการ์ดจริง — ไม่ต้องคอมไพล์ใหม่ตอนการ์ดโผล่)
  const blank = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  blank.needsUpdate = true;
  let clock = 0;      // วินาทีนับจากเปิดหน้า (ฉากเปิด)
  let warmed = false; // เฟรมแรกวาดการ์ดทุกใบ (ความทึบ 0) ให้ shader พร้อมตั้งแต่ต้น
  const toBuild = []; // การ์ดที่ภาพพร้อมแล้ว รอสร้าง texture

  const rings = groups.map((g, k) => {
    const pose = overviewPose(k, N);
    const cut = cutImg.clone();
    cut.repeat.set(REDUCED ? 0.499 : 1000, 1);
    const color = new THREE.Color(g.color || "#7fb8e6");
    const line = new THREE.Mesh(torus, new THREE.MeshBasicMaterial({ color, alphaMap: cut, transparent: true, opacity: 0.5, depthWrite: false }));
    line.renderOrder = -1;
    root.add(line);
    const dot = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex, color, transparent: true, opacity: 0, depthWrite: false }));
    dot.scale.setScalar(0.11);
    dot.visible = false;
    root.add(dot);
    const n = Math.max(1, g.chars.length);
    const r = {
      k, g, line, cut, dot, draw: REDUCED ? 1 : 0, q0: pose.q, R0: pose.R, q: pose.q.clone(), R: pose.R, y: 0, step: (Math.PI * 2) / n,
      base: k * 0.9, speed: (k % 2 ? -1 : 1) * (0.06 + 0.012 * (k % 3)), target: null,
      hover: false, b: 0, vis: 1, hl: 0, cards: [],
    };
    r.cards = g.chars.map((c, i) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(CARD_W, CARD_H), new THREE.MeshBasicMaterial({ map: blank, transparent: true, opacity: 0 }));
      m.userData = { id: c.id, ring: k, idx: i };
      // ap = ความคืบหน้าการโผล่ (0..1) · ready = มี texture แล้ว · gate = วงต้องลากเส้นถึงไหนก่อนการ์ดใบนี้โผล่
      const card = { m, c, ctx: null, tex: null, entry: null, drawn: undefined, idx: i, op: 0, ap: 0, ready: false, gate: 0.2 + ((i + 0.5) / n) * 0.7 };
      card.redraw = () => {
        if (!card.ctx) return;
        const st = statusOf.get(c.id) || null;
        drawCard(card.ctx, c, st, card.entry);
        card.drawn = st;
        card.tex.needsUpdate = true;
      };
      card.onLoaded = () => { toBuild.push(card); };
      if (c.img) {
        card.entry = getPortrait(c.img, card.onLoaded);
        if (portraitDone(card.entry)) toBuild.push(card);
      } else toBuild.push(card);
      root.add(m);
      return card;
    });
    return r;
  });
  const byId = new Map(rings.flatMap((r) => r.cards.map((cd) => [cd.c.id, { r, cd }])));

  const build = (card) => {
    const cv = document.createElement("canvas");
    cv.width = TW; cv.height = TH;
    card.ctx = cv.getContext("2d");
    card.tex = new THREE.CanvasTexture(cv);
    card.tex.colorSpace = THREE.SRGBColorSpace;
    card.tex.anisotropy = 4;
    card.redraw();
    card.m.material.map = card.tex;
    card.ready = true;
    if (REDUCED) card.ap = 1;
  };

  const selFrame = new THREE.Mesh(new THREE.PlaneGeometry(CARD_W + 0.04, CARD_H + 0.04), new THREE.MeshBasicMaterial({ color: 0x9b4f96, transparent: true }));
  selFrame.visible = false;
  selFrame.renderOrder = -0.5;
  root.add(selFrame);

  // การ์ด i อยู่ที่มุม base − i·step (ใบถัดไปอยู่ทางขวาของใบหน้าสุดตอนโฟกัส)
  const cardAngle = (r, i) => r.base - i * r.step;
  const poseOf = (r) => (focus === r.k ? Q_FOCUS : r.q0);
  const bringToFront = (r, idx, instant) => {
    const t = nearAngle(frontAngle(poseOf(r)) + idx * r.step, r.base);
    if (instant || REDUCED) { r.base = t; r.target = null; } else r.target = t;
  };
  const snap = (r) => {
    const fa = frontAngle(poseOf(r)), from = r.target ?? r.base;
    r.target = fa + Math.round((from - fa) / r.step) * r.step;
  };

  // การ์ดที่กดได้ตอนนี้ (วงที่มองเห็น + ไม่จางเกิน)
  const interactive = () => {
    const out = [];
    rings.forEach((r) => {
      if (focus != null ? r.k !== focus : r.vis < 0.5) return;
      const min = focus != null ? 0.3 : 0.35;
      r.cards.forEach((cd) => { if (cd.ready && cd.ap > 0.6 && cd.m.visible && cd.m.material.opacity >= min) out.push(cd.m); });
    });
    return out;
  };
  const cardAt = (ev) => {
    const h = core.pick(ev, interactive());
    return h ? h.object.userData : null;
  };

  let hoverRing = -1;
  const setHover = (h, ev) => {
    if (hoverRing >= 0) rings[hoverRing].hover = false;
    hoverRing = h ? h.ring : -1;
    if (h) rings[h.ring].hover = true;
    if (h) canvas.dataset.pointing = "1"; else delete canvas.dataset.pointing;
    onHover?.(h, ev);
  };

  // ---------- pointer ----------
  let drag = null;
  core.setDrag(false);
  core.setDragHandler((phase, info) => {
    if (phase === "down") {
      if (focus != null) { const r = rings[focus]; drag = { ring: focus, base: r.target ?? r.base }; return true; }
      const h = cardAt(info.ev);
      drag = h ? { ring: h.ring, base: rings[h.ring].base } : { ring: -1 };
      return true;
    }
    if (phase === "move") {
      if (drag && drag.ring >= 0) {
        const r = rings[drag.ring];
        r.target = null;
        r.base = drag.base - info.dx * (focus != null ? 0.0045 : 0.006);
        drag.moved = true;
      }
      setHover(null);
      return true;
    }
    if (phase === "up") {
      if (drag && drag.moved && focus != null && drag.ring === focus) snap(rings[focus]);
      drag = null;
    }
    return true;
  });
  const offClick = core.onClick((ev) => {
    const h = cardAt(ev);    if (h) { onSelect?.(h.id); return; }
    if (focus != null && !core.hitGlobe(ev)) onEmpty?.();
  });
  const offHover = core.onHover((ev) => setHover(ev ? cardAt(ev) : null, ev));

  // ล้อเมาส์ตอนโฟกัส = หมุนทีละใบ (หน่วงไว้ไม่ให้ทัชแพดหมุนรัว)
  let wheelAt = 0;
  const onWheel = (ev) => {
    if (focus == null) return;
    ev.preventDefault();
    const now = performance.now();
    if (now - wheelAt < 140 || Math.abs(ev.deltaY) + Math.abs(ev.deltaX) < 2) return;
    wheelAt = now;
    api.rotate((Math.abs(ev.deltaY) >= Math.abs(ev.deltaX) ? ev.deltaY : ev.deltaX) > 0 ? 1 : -1);
  };
  canvas.addEventListener("wheel", onWheel, { passive: false });

  // ---------- ลูป ----------
  const pos = new THREE.Vector3();
  const rc = new THREE.Vector3();
  const head = new THREE.Vector3();
  const offFrame = core.onFrame((dt) => {
    clock += dt;
    // สร้าง texture การ์ดที่ภาพพร้อมแล้ว ทีละไม่กี่ใบต่อเฟรม (กันเฟรมกระตุกตอนภาพเสร็จพร้อมกันหลายใบ)
    for (let b = 0; b < BUILD_PER_FRAME && toBuild.length; b++) {
      const cd = toBuild.shift();
      if (!cd.ready) build(cd);
    }
    const k = REDUCED ? 1 : 1 - Math.pow(0.015, dt);
    const kb = REDUCED ? 1 : 1 - Math.pow(0.012, dt);
    const hlRing = highlight >= 0 ? highlight : hoverRing;
    selFrame.visible = false;
    rings.forEach((r, ri) => {
      // ท่าทางของวง: ภาพรวม ↔ โฟกัส
      r.b += ((focus === ri ? 1 : 0) - r.b) * kb;
      r.vis += ((focus == null || focus === ri ? 1 : 0) - r.vis) * kb;
      r.hl += ((focus == null && hlRing >= 0 ? (hlRing === ri ? 1 : -1) : 0) - r.hl) * k;
      if (Math.abs(r.b - (focus === ri ? 1 : 0)) < 0.0005) r.b = focus === ri ? 1 : 0;
      const e = r.b;
      r.q.slerpQuaternions(r.q0, Q_FOCUS, e);
      r.R = r.R0 + (FOCUS_R - r.R0) * e;
      r.y = FOCUS_Y * e;
      r.line.quaternion.copy(r.q);
      r.line.position.set(0, r.y, 0);
      r.line.scale.setScalar(r.R);
      const dimOthers = r.hl < 0 ? 1 + 0.55 * r.hl : 1; // วงอื่นจางลงตอนชี้วงหนึ่ง
      // ฉากเปิด: ลากเส้นวงจากมุม 0 ไปรอบวง (เส้นที่กำลังลากเข้มกว่าปกติ + จุดนำหน้า)
      if (r.draw < 1) {
        r.draw = Math.min(1, Math.max(0, (clock - DRAW_DELAY - ri * DRAW_GAP) / DRAW_DUR));
        const p = easeOut(r.draw);
        r.cut.repeat.x = r.draw >= 1 ? 0.499 : 0.5 / Math.max(0.0005, p);
        r.dot.visible = (r.draw > 0 && r.draw < 1) || !warmed;
        if (r.dot.visible) {
          const th = p * Math.PI * 2;
          head.set(Math.cos(th), 0, Math.sin(th)).applyQuaternion(r.q).multiplyScalar(r.R);
          head.y += r.y;
          r.dot.position.copy(head);
          r.dot.material.opacity = Math.min(1, r.draw * 8, (1 - r.draw) * 6) * r.vis;
        }
      }
      const drawing = r.draw < 1 ? 0.35 * Math.sin(Math.PI * r.draw) : 0;
      r.line.material.opacity = Math.min(1, (0.42 + 0.4 * Math.max(0, r.hl) + 0.18 * e + drawing) * r.vis * dimOthers);
      r.line.visible = (r.draw > 0 || !warmed) && r.line.material.opacity > 0.005;

      // หมุนวง
      if (r.target != null) { r.base += (r.target - r.base) * k; if (Math.abs(r.target - r.base) < 0.0005) { r.base = r.target; r.target = null; } }
      else if (focus == null && !r.hover && !(drag && drag.ring === ri) && !REDUCED) r.base += r.speed * dt;

      ex.set(1, 0, 0).applyQuaternion(r.q);
      ez.set(0, 0, 1).applyQuaternion(r.q);
      const depthSpan = Math.max(0.5, Math.hypot(ex.z, ez.z));
      const grow = 1 + (FOCUS_CARD - 1) * e;
      r.cards.forEach((cd, i) => {
        const a = cardAngle(r, i), ca = Math.cos(a), sa = Math.sin(a);
        pos.set(ex.x * ca + ez.x * sa, ex.y * ca + ez.y * sa, ex.z * ca + ez.z * sa);
        const f = Math.max(0, Math.min(1, ((pos.z / depthSpan) + 1) / 2)); // 1 = หน้าสุด
        pos.multiplyScalar(r.R);
        pos.y += r.y;
        cd.m.position.copy(pos);
        // การ์ดโผล่เมื่อ texture พร้อม + เส้นวงลากผ่านมาถึงแล้ว: ขยายจาก 55% + จางเข้า
        if (cd.ready && cd.ap < 1 && r.draw >= cd.gate) cd.ap = Math.min(1, cd.ap + dt / APPEAR);
        const ae = easeOut(cd.ap);
        cd.m.scale.setScalar((0.8 + 0.4 * f) * grow * (0.55 + 0.45 * ae));
        const op = (0.2 + 0.14 * e + (0.8 - 0.14 * e) * Math.pow(f, 1.3)) * r.vis * dimOthers * ae;
        const up = lifted.has(cd.c.id);
        cd.op = op; // ความทึบจริงของช่อง (ไม่นับการยก) — การ์ดลอยใช้เทียบตอนบินกลับ
        cd.m.material.opacity = up ? op * 0.16 : op;
        cd.m.visible = op > 0.01 || !warmed;
        if (cd.c.id === selected && cd.m.visible) {
          selFrame.visible = true;
          selFrame.position.set(pos.x, pos.y, pos.z - 0.004);
          selFrame.scale.copy(cd.m.scale);
          selFrame.material.opacity = up ? op * 0.4 : op;
        }
      });
    });
    warmed = true;
  });

  const api = {
    /** สถานะการ์ด: obj id → { label, tone } | null — วาดใหม่เฉพาะใบที่เปลี่ยน */
    setStatus(map) {
      statusOf.clear();
      Object.entries(map || {}).forEach(([id, s]) => { if (s) statusOf.set(id, s); });
      byId.forEach(({ cd }) => {
        const st = statusOf.get(cd.c.id) || null;
        const prev = cd.drawn;
        if ((prev?.label || null) !== (st?.label || null) || (prev?.tone || null) !== (st?.tone || null)) cd.redraw();
      });
    },
    /** เลือกการ์ด (null = ไม่เลือก) + หมุนวงให้การ์ดนั้นมาอยู่หน้าสุด */
    select(id, instant) {
      selected = id || null;
      const hit = id ? byId.get(id) : null;
      if (hit) bringToFront(hit.r, hit.cd.idx, instant);
    },
    /** โฟกัสวง k (null = กลับภาพรวม) — ถ้าตัวที่เลือกอยู่ในวงนั้น หมุนมาหน้าสุด ไม่งั้นจัดให้มีใบหนึ่งอยู่หน้าพอดี */
    setFocus(k, instant) {
      const next = k == null || !rings[k] ? null : k;
      if (next === focus) return;
      focus = next;
      setHover(null);
      if (focus == null) return;
      const r = rings[focus];
      r.hover = false;
      const hit = selected ? byId.get(selected) : null;
      if (hit && hit.r === r) bringToFront(r, hit.cd.idx); else snap(r);
      if (instant || REDUCED) {
        rings.forEach((x) => { x.b = x.k === focus ? 1 : 0; x.vis = x.k === focus ? 1 : 0; });
        if (r.target != null) { r.base = r.target; r.target = null; }
      }
    },
    /** หมุนวงที่โฟกัสทีละใบ: +1 = ใบทางขวามาหน้า · −1 = ใบทางซ้าย */
    rotate(dir) {
      if (focus == null) return;
      const r = rings[focus];
      snap(r);
      r.target += dir * r.step;
    },
    /** การ์ดที่ถูกยกออกจากวง (ช่องจางลง) */
    setLifted(ids) { lifted = new Set(ids || []); },
    /** กรอบการ์ดบนจอ (px ภายในพื้นที่รับเมาส์) + ความทึบของช่อง · null = ไม่มีการ์ดนี้ */
    cardRect(id) {
      const hit = byId.get(id);
      if (!hit) return null;
      const m = hit.cd.m;
      m.getWorldPosition(rc);
      const s = m.scale.x * world.scale.x;
      const c = core.project(rc);
      rc.x += (CARD_W / 2) * s; rc.y += (CARD_H / 2) * s;
      const p = core.project(rc);
      const hw = Math.abs(p.x - c.x), hh = Math.abs(c.y - p.y);
      return { x: c.x - hw, y: c.y - hh, w: hw * 2, h: hh * 2, op: m.visible ? hit.cd.op : 0 };
    },
    /** ชี้ชื่อหมวด = วงนั้นเด่นขึ้น (−1 = เลิก) */
    setHighlight(k) { highlight = k == null ? -1 : k; },
    dispose() {
      offClick(); offHover(); offFrame();
      canvas.removeEventListener("wheel", onWheel);
      core.setDragHandler(null);
      delete canvas.dataset.pointing;
      byId.forEach(({ cd }) => { if (cd.entry) cd.entry.waiters.delete(cd.onLoaded); });
      toBuild.length = 0;
      // texture ที่ไม่ได้ผูกกับวัตถุในฉากแล้ว (ของในฉาก ฉากร่วม/ลูกโลกของตัวเองเก็บกวาดให้)
      blank.dispose(); cutImg.dispose(); dotTex.dispose();
    },
  };
  return api;
}
