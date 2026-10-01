// ตัวละครเป็นการ์ดโคจรรอบลูกโลก หนึ่งวงต่อหนึ่งหมวด (หน้าเลือกตัวละคร)
//  - วงสลับทิศ หมุนช้าๆ · ชี้การ์ด = วงนั้นหยุด + บอกชื่อ · กด = เลือก + หมุนการ์ดมาหน้าสุด (กรอบม่วง)
//  - ลากการ์ดเพื่อหมุนวงนั้น · การ์ดด้านหลังจางลง (กดไม่ได้)
//  - ชื่อหมวด (DOM ของ React) อยู่ปลายซ้ายของแต่ละวง — ตัวควบคุมนี้ตั้งตำแหน่งให้ทุกเฟรม
import { THREE } from "../../globe/globeCore";
import { FALLBACK } from "../../data/avatars";

const CR = 1.55, CARD_W = 0.2, CARD_H = 0.267;
const TW = 192, TH = 256;
const FRONT_A = Math.PI / 2;
const REDUCED = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

const imgCache = new Map(); // url → { img, ok, waiters }
function loadImg(url, cb) {
  let e = imgCache.get(url);
  if (!e) {
    const img = new Image();
    e = { img, ok: null, waiters: new Set() };
    imgCache.set(url, e);
    try {
      const u = new URL(url, location.href);
      if (u.origin !== location.origin) img.crossOrigin = "anonymous"; // ห้ามให้ canvas ติด taint (อัปโหลดเป็น texture ไม่ได้)
    } catch { /* url แปลก — ปล่อยให้ onerror จัดการ */ }
    const done = (ok) => { e.ok = ok; e.waiters.forEach((fn) => fn()); e.waiters.clear(); };
    img.onload = () => done(true);
    img.onerror = () => done(false);
    img.decoding = "async";
    img.src = url;
  }
  if (e.ok == null) e.waiters.add(cb);
  return e;
}

// status: null | { label, tone: "lost" | "block" }
function drawCard(ctx, c, status, entry) {
  ctx.clearRect(0, 0, TW, TH);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, TW, TH);
  const dim = !!status;
  const x0 = 6, y0 = 6, w = TW - 12, h = TH - 12;
  if (entry && entry.ok) {
    const im = entry.img, iw = im.naturalWidth || 1, ih = im.naturalHeight || 1;
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

/**
 * @param groups [{ key, label, color, chars: [roster entry] }]
 * @param opts.onSelect(id)  กดการ์ด
 * @param opts.onHover(card|null, ev)  card = { id, ring }
 */
export function createCharRings(core, groups, { onSelect, onHover }) {
  const { world, canvas } = core;
  const root = new THREE.Group();
  world.add(root);

  const N = groups.length;
  const gap = N > 1 ? Math.min(0.28, 2.3 / (N - 1)) : 0;
  const statusOf = new Map(); // id → status
  let selected = null;
  let labels = [];

  const rings = groups.map((g, k) => {
    const r = { g, y: ((N - 1) / 2) * gap - k * gap, base: k * 0.9, speed: (k % 2 ? -1 : 1) * 0.09, target: null, hover: false, cards: [] };
    const pts = [];
    for (let i = 0; i <= 96; i++) { const a = (i / 96) * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * CR, r.y, Math.sin(a) * CR)); }
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x7fb8e6, transparent: true, opacity: 0.4, depthWrite: false }));
    line.renderOrder = -1;
    root.add(line);
    r.cards = g.chars.map((c, i) => {
      const cv = document.createElement("canvas");
      cv.width = TW; cv.height = TH;
      const ctx = cv.getContext("2d");
      const tex = new THREE.CanvasTexture(cv);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(CARD_W, CARD_H), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
      m.userData = { id: c.id, ring: k, idx: i };
      const card = { m, c, ctx, tex, entry: null, drawn: undefined };
      card.redraw = () => {
        const st = statusOf.get(c.id) || null;
        drawCard(ctx, c, st, card.entry);
        card.drawn = st;
        tex.needsUpdate = true;
      };
      if (c.img) card.entry = loadImg(c.img, card.redraw);
      card.redraw();
      root.add(m);
      return card;
    });
    return r;
  });
  const meshes = rings.flatMap((r) => r.cards.map((cd) => cd.m));
  const byId = new Map(rings.flatMap((r) => r.cards.map((cd) => [cd.c.id, { r, cd }])));

  const selFrame = new THREE.Mesh(new THREE.PlaneGeometry(CARD_W + 0.04, CARD_H + 0.04), new THREE.MeshBasicMaterial({ color: 0x9b4f96, transparent: true }));
  selFrame.visible = false;
  root.add(selFrame);

  const cardAngle = (r, i) => r.base + (i * Math.PI * 2) / r.cards.length;
  const cardAt = (ev) => {
    const h = core.pick(ev, meshes);
    if (!h || h.object.material.opacity < 0.5) return null;
    return h.object.userData;
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
      const h = cardAt(info.ev);
      drag = h ? { ring: h.ring, base: rings[h.ring].base } : { ring: -1 };
      return true;
    }
    if (phase === "move") {
      if (drag && drag.ring >= 0) { const r = rings[drag.ring]; r.target = null; r.base = drag.base - info.dx * 0.006; }
      setHover(null);
      return true;
    }
    if (phase === "up") drag = null;
    return true;
  });
  const offClick = core.onClick((ev) => { const h = cardAt(ev); if (h) onSelect?.(h.id); });
  const offHover = core.onHover((ev) => setHover(ev ? cardAt(ev) : null, ev));

  // ---------- ลูป ----------
  const v = new THREE.Vector3();
  const offFrame = core.onFrame((dt) => {
    const k = REDUCED ? 1 : 1 - Math.pow(0.015, dt);
    rings.forEach((r, ri) => {
      if (r.target != null) { r.base += (r.target - r.base) * k; if (Math.abs(r.target - r.base) < 0.0005) r.target = null; }
      else if (!r.hover && !(drag && drag.ring === ri) && !REDUCED) r.base += r.speed * dt;
      r.cards.forEach((cd, i) => {
        const a = cardAngle(r, i), x = Math.cos(a) * CR, z = Math.sin(a) * CR, f = (Math.sin(a) + 1) / 2;
        cd.m.position.set(x, r.y, z);
        cd.m.scale.setScalar(0.68 + 0.3 * f);
        cd.m.material.opacity = 0.14 + 0.86 * Math.pow(f, 1.4);
        if (cd.c.id === selected) {
          selFrame.visible = true;
          selFrame.position.set(x, r.y, z - 0.003);
          selFrame.scale.copy(cd.m.scale);
          selFrame.material.opacity = cd.m.material.opacity;
        }
      });
    });
    root.updateMatrixWorld(true);
    const W = core.size.w;
    rings.forEach((r, i) => {
      const el = labels[i];
      if (!el) return;
      v.set(-CR - 0.26, r.y, 0);
      root.localToWorld(v);
      const p = core.project(v);
      const lw = el.offsetWidth || 0;
      const x = Math.max(12 + lw, Math.min(W - 12, p.x)); // ชื่อหมวดยาวๆ ไม่ให้ล้นขอบซ้ายจอ
      el.style.transform = `translate(${x}px, ${p.y}px) translate(-100%, -50%)`;
      el.dataset.placed = "1";
    });
  });

  return {
    setLabels(els) { labels = els; },
    /** สถานะการ์ด: Map/obj id → { label, tone } | null — วาดใหม่เฉพาะใบที่เปลี่ยน */
    setStatus(map) {
      statusOf.clear();
      Object.entries(map || {}).forEach(([id, s]) => { if (s) statusOf.set(id, s); });
      byId.forEach(({ cd }) => {
        const st = statusOf.get(cd.c.id) || null;
        const prev = cd.drawn;
        if ((prev?.label || null) !== (st?.label || null) || (prev?.tone || null) !== (st?.tone || null)) cd.redraw();
      });
    },
    /** เลือกการ์ด + หมุนวงให้การ์ดนั้นมาอยู่หน้าสุด */
    select(id, instant) {
      selected = id;
      const hit = byId.get(id);
      if (!hit) { selFrame.visible = false; return; }
      const { r, cd } = hit;
      let t = FRONT_A - (cd.m.userData.idx * Math.PI * 2) / r.cards.length;
      while (t - r.base > Math.PI) t -= Math.PI * 2;
      while (t - r.base < -Math.PI) t += Math.PI * 2;
      if (instant || REDUCED) { r.base = t; r.target = null; } else r.target = t;
    },
    dispose() {
      offClick(); offHover(); offFrame();
      core.setDragHandler(null);
      delete canvas.dataset.pointing;
      byId.forEach(({ cd }) => { if (cd.entry) cd.entry.waiters.delete(cd.redraw); });
    },
  };
}
