// เลือกโหมด (gameState TEAM_MODE) — หมุดโหมดบนลูกโลก · โหวตจริงที่ปุ่ม "โหวต" ในแผง (selectGameMode)
//  เปิดหน้ามา = ยังไม่เลือกดูโหมดไหน (โลก + หมุดเท่านั้น ไม่มีแผง ไม่มีเส้นทาง)
//  กดหมุด/ป้าย = เลือกดู: โลกหันเข้าหาหมุดแล้วซูมเล็กน้อย (Lobby.jsx globeLayout) แผงเลื่อนเข้ามาทางขวา
//  กดที่ว่าง / Esc = เลิกดู: แผงเลื่อนออก เส้นทางหาย โลกกลับไปมุมภาพรวม
//  ท่าพัก (ไม่ได้เลือกดูโหมดไหน): หมุด "อิสระ" อยู่กลางโลกหันตรงหน้า · หน้านี้โลกไม่หมุนเอง (ออกจากหน้าแล้วคืนค่า)
//  ย้อนกลับ = กลับห้องรอ (modeBackToLobby — ทุกคนยกเลิกพร้อม) ไม่ใช่ออกจากห้อง
//  โหมดที่มีการเดินทาง (อิสระ/คู่หู/สหายทั้ง 3 เอ๋ย) แสดงเส้นทางภูมิภาค I→VII บนโลก (ดูอย่างเดียว)
//  ป้ายชื่อโหมดแต่ละโหมดมีกรอบของตัวเอง (lobby.css .ocl-modetag[data-mode]) · หน้านี้ไม่มีอีโมต
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { socket } from "../../socket";
import { clickSound } from "../../audio";
import { dirFromLonLat, regionDir, COLORS } from "../../globe/globeCore";
import { JOURNEY_AREAS } from "../../journey/areas";
import { OcButton, OcPanel } from "../ui";

const MODE_TITLES = { ffa: "อิสระ", duo: "คู่หู", trio: "สหายทั้ง 3 เอ๋ย", seraph: "Moon Cell", mercury: "Type Mercury" };
const MODE_SUBTITLES = { ffa: "ทุกคนสู้กันเอง", duo: "ทีมละ 2 คน", trio: "ทีมละ 3 คน", seraph: "SE.RA.PH", mercury: "เรดบอส ORT · ทุกคนร่วมทีม" };
const MODE_NEED = { ffa: "2 คนขึ้นไป", duo: "4 หรือ 6 คน", trio: "6 คน", seraph: "2 คนขึ้นไป", mercury: "1–7 คน" };
const MODE_GEO = { ffa: [2, 30], duo: [26, 4], trio: [48, 30], mercury: [322, -10], seraph: [334, 46] };
const JOURNEY = new Set(["ffa", "duo", "trio"]);
const ORDER = ["ffa", "duo", "trio", "mercury", "seraph"];

const modeTitle = (m) => MODE_TITLES[m] || m;
const turnRange = (i, n) => (i === n - 1 ? `เทิร์น ${i * 10 + 1} ขึ้นไป` : `เทิร์น ${i * 10 + 1}–${i * 10 + 10}`);

function useOptions(state) {
  const count = state.players.length;
  const list = state.modeVotes?.length ? state.modeVotes : (state.modeOptions?.length ? state.modeOptions : [
    { mode: "ffa", enabled: count >= 1, voters: [], voteCount: 0 }, // 1 คน = เล่นทดสอบ (server/lobby.js validGameMode)
    { mode: "duo", enabled: count >= 4 && count % 2 === 0, voters: [], voteCount: 0 },
    { mode: "trio", enabled: count === 6, voters: [], voteCount: 0 },
  ]);
  return [...list].filter((o) => MODE_GEO[o.mode]).sort((a, b) => ORDER.indexOf(a.mode) - ORDER.indexOf(b.mode));
}

/**
 * @param focus   โหมดที่เลือกดูอยู่ (null = ภาพรวม) — Lobby.jsx ถือค่านี้เพราะใช้คิดตำแหน่งลูกโลกด้วย
 * @param onFocus (mode|null)
 */
export default function ModeVote({ state, core, interceptRef, focus, onFocus }) {
  const options = useOptions(state);
  const me = state.players.find((p) => p.id === state.youId);
  const myVote = me?.modeVote || null;
  // โหมดที่แผงแสดง — ค้างไว้ระหว่างแผงเลื่อนออกตอนเลิกดู (ปรับ state ระหว่าง render ตามแนวทางของ React)
  const [shown, setShown] = useState(focus);
  if (focus && focus !== shown) setShown(focus);

  const tagRefs = useRef({});
  const areaRefs = useRef([]);
  const scene = useRef(null); // { markers: {mode: group}, hits: [], route... }
  const optsRef = useRef(options);
  useLayoutEffect(() => { optsRef.current = options; });

  const vote = (mode) => {
    const opt = optsRef.current.find((o) => o.mode === mode);
    if (!opt || !opt.enabled || opt.suspended) return;
    clickSound();
    socket.emit("selectGameMode", { mode });
  };
  // กดหมุด/ป้าย = เลือกดูอย่างเดียว ยังไม่โหวต (ผู้ใช้สั่ง: ต้องกดยืนยันก่อน) · ป้ายเป็นปุ่ม (เสียงคลิกมาเอง) หมุดบนโลกต้องเรียกเอง
  const preview = (mode, sound) => { if (sound && mode !== focus) clickSound(); onFocus(mode); };
  const clear = () => { if (!focus) return; clickSound(); onFocus(null); };
  const cbRef = useRef({ preview, clear });
  useLayoutEffect(() => { cbRef.current = { preview, clear }; });

  useEffect(() => {
    if (!focus) return undefined;
    const onKey = (e) => { if (e.key === "Escape") cbRef.current.clear(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focus]);

  // ---------- ของ 3D: หมุด + เส้นทาง ----------
  useEffect(() => {
    if (!core) return undefined;
    const { THREE } = core;
    const root = new THREE.Group();
    core.spin.add(root);
    const up = new THREE.Vector3(0, 1, 0);
    const markers = {};
    const hits = [];
    for (const mode of ORDER) {
      const dir = dirFromLonLat(...MODE_GEO[mode]);
      const g = new THREE.Group();
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.14, 6), new THREE.MeshBasicMaterial({ color: COLORS.azure }));
      stem.position.y = 0.07;
      const head = new THREE.Mesh(new THREE.OctahedronGeometry(0.022), new THREE.MeshBasicMaterial({ color: COLORS.azure }));
      head.position.y = 0.15;
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.05, 0.058, 48), new THREE.MeshBasicMaterial({ color: COLORS.echo, transparent: true, opacity: 0, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.003;
      const hit = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
      hit.position.y = 0.12; hit.userData.mode = mode;
      g.add(stem, head, ring, hit);
      g.position.copy(dir);
      g.quaternion.setFromUnitVectors(up, dir);
      root.add(g);
      markers[mode] = { g, stem, head, ring, dir };
      hits.push(hit);
    }
    const token = new THREE.Mesh(new THREE.OctahedronGeometry(0.035), new THREE.MeshBasicMaterial({ color: COLORS.echo }));
    token.visible = false;
    root.add(token);
    const areaDirs = JOURNEY_AREAS.map((_, i) => regionDir(i));
    const s = { root, markers, hits, token, route: null, curve: null, areaDirs, focus: null };
    scene.current = s;
    core.setAutoSpin(0); // หน้าเลือกโหมด: โลกนิ่ง หมุนเฉพาะตอนหันเข้าหาหมุด (focusDir)

    const tmp = new THREE.Vector3();
    const offFrame = core.onFrame((dt, clock) => {
      const f = s.markers[s.focus];
      if (f) f.ring.scale.setScalar(1 + 0.25 * Math.sin(clock * 3));
      if (s.curve && token.visible) {
        token.position.copy(s.curve.getPointAt((((clock * 0.08) % 1) + 1) % 1)).multiplyScalar(1.02); // clock ติดลบได้ในเฟรมแรก
        token.rotation.y += dt * 2;
      }
      for (const mode of ORDER) {
        const el = tagRefs.current[mode];
        if (!el) continue;
        const m = s.markers[mode];
        const p = core.project(m.g.localToWorld(tmp.set(0, 0.17, 0)));
        // --k = ขยายป้ายที่เลือกดู (ใส่ใน transform เดียวกัน — scale แยกจะขยายระยะเลื่อนไปด้วย)
        el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -130%) scale(var(--k, 1))`;
        el.classList.toggle("back", core.facing(m.dir) < 0.18);
      }
      const showAreas = !!s.curve;
      areaRefs.current.forEach((el, i) => {
        if (!el) return;
        if (!showAreas) { el.classList.add("back"); return; }
        const d = s.areaDirs[i];
        const p = core.project(core.spin.localToWorld(tmp.copy(d).multiplyScalar(1.01)));
        el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`;
        el.classList.toggle("back", core.facing(d) < 0.18);
      });
    });

    const pickMode = (ev) => {
      const h = core.pick(ev, hits);
      return h ? h.object.userData.mode : null;
    };
    // กดบนโลก (ไม่ใช่ลาก): โดนหมุด = เลือกดู · ที่ว่าง = เลิกดู — กินทุกคลิก (หน้านี้ไม่มีอีโมต)
    interceptRef.current = (ev) => {
      const mode = pickMode(ev);
      if (mode) cbRef.current.preview(mode, true);
      else cbRef.current.clear();
      return true;
    };
    const offHover = core.onHover((ev) => {
      const mode = ev ? pickMode(ev) : null;
      if (mode) core.canvas.dataset.hot = "1"; else delete core.canvas.dataset.hot;
    });

    return () => {
      offFrame(); offHover();
      interceptRef.current = null;
      delete core.canvas.dataset.hot;
      core.spin.remove(root);
      root.traverse((o) => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
      scene.current = null;
      core.focusDir(null);
      core.setAutoSpin(0.1); // ค่าปกติของลูกโลกร่วม (หน้าห้องรอ/จัดทีม)
    };
  }, [core, interceptRef]);

  // สีหมุดตามสถานะ (โหวต/ใช้ไม่ได้)
  useEffect(() => {
    const s = scene.current;
    if (!s) return;
    for (const opt of options) {
      const m = s.markers[opt.mode];
      if (!m) continue;
      const col = !opt.enabled || opt.suspended ? COLORS.mute : myVote === opt.mode ? COLORS.echo : COLORS.azure;
      m.head.material.color.setHex(col);
      m.stem.material.color.setHex(col);
    }
  });

  // โหมดที่เลือกดูอยู่: หันโลกเข้าหา + เส้นทางการเดินทาง · null = ท่าพัก (หมุดอิสระกลางโลก) ไม่มีเส้นทาง
  useEffect(() => {
    const s = scene.current;
    if (!s || !core) return;
    const { THREE } = core;
    s.focus = focus;
    for (const [mode, m] of Object.entries(s.markers)) m.ring.material.opacity = mode === focus ? 0.9 : 0;
    core.focusDir((s.markers[focus] || s.markers.ffa).dir);
    if (s.route) { s.root.remove(s.route); s.route.geometry.dispose(); s.route.material.dispose(); s.route = null; }
    s.curve = null;
    s.token.visible = false;
    if (JOURNEY.has(focus)) {
      let pts = [];
      for (let i = 0; i < s.areaDirs.length - 1; i++) {
        const a = s.areaDirs[i], b = s.areaDirs[i + 1], seg = [];
        for (let t = 0; t <= 1.0001; t += 1 / 40) seg.push(a.clone().lerp(b, t).normalize().multiplyScalar(1 + 0.1 * Math.sin(Math.PI * t)));
        if (pts.length) seg.shift();
        pts = pts.concat(seg);
      }
      s.curve = new THREE.CatmullRomCurve3(pts);
      s.route = new THREE.Mesh(
        new THREE.TubeGeometry(s.curve, pts.length * 2, 0.0055, 6, false),
        new THREE.MeshBasicMaterial({ color: COLORS.echo, transparent: true, opacity: 0.8 }),
      );
      s.root.add(s.route);
      s.token.visible = true;
    }
  }, [focus, core]);

  const panelOpt = options.find((o) => o.mode === shown) || null;
  const votedCount = state.players.filter((p) => p.modeVote).length;
  const blocked = (o) => !o.enabled || o.suspended;

  return (
    <div className="oc-layer ocl-vote">
      <div className="ocl-tags">
        {options.map((o) => {
          const voters = state.players.filter((p) => (o.voters || []).includes(p.id));
          return (
            <button
              key={o.mode}
              type="button"
              ref={(el) => { tagRefs.current[o.mode] = el; }}
              className={`oc-tag ocl-modetag back${myVote === o.mode ? " on" : ""}${focus === o.mode ? " focus" : ""}`}
              data-mode={o.mode}
              data-blocked={blocked(o) ? "true" : "false"}
              aria-disabled={blocked(o)}
              aria-pressed={focus === o.mode}
              onClick={() => cbRef.current.preview(o.mode, false)}
            >
              <span className="ocl-mt-frame" aria-hidden="true" />
              <span className="ocl-mt-name">{modeTitle(o.mode)}</span>
              {voters.length > 0 && (
                <span className="ocl-dots">{voters.map((p) => <i key={p.id} style={{ background: p.color }} />)}</span>
              )}
            </button>
          );
        })}
        {JOURNEY_AREAS.map((a, i) => (
          <span key={a.id} ref={(el) => { areaRefs.current[i] = el; }} className="ocl-areatag back" aria-hidden="true">
            <span className="oc-latin">{a.numeral}</span>{a.short}
          </span>
        ))}
      </div>

      <header className="ocl-title oc-enter">
        <h1 className="oc-h1">เลือกโหมด</h1>
        <span className="oc-label">โหวตแล้ว {votedCount} / {state.players.length}</span>
      </header>

      <div className={`ocl-vote-side${focus ? " open" : ""}`} aria-hidden={!focus}>
        {panelOpt && (
          <OcPanel className="ocl-votepanel" data-mode={panelOpt.mode}>
            <div className="ocl-vp-head">
              <h2 className="oc-h2">{modeTitle(panelOpt.mode)}</h2>
              <span className="oc-muted">{MODE_SUBTITLES[panelOpt.mode]}</span>
            </div>

            {JOURNEY.has(panelOpt.mode) && (
              <section className="ocl-sec">
                <div className="ocl-seclabel">เส้นทาง</div>
                <ol className="ocl-route">
                  {JOURNEY_AREAS.map((a, i) => (
                    <li key={a.id} className={i === 0 ? "first" : ""}>
                      <span className="n oc-latin">{a.numeral}</span>
                      <span>{a.short}</span>
                      <span className="tt">{turnRange(i, JOURNEY_AREAS.length)}</span>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            <section className="ocl-sec">
              <div className="ocl-seclabel">ผลโหวต <span>{votedCount} / {state.players.length}</span></div>
              <ul className="ocl-tally">
                {[...state.players].sort((a, b) => a.position - b.position).map((p) => (
                  <li key={p.id}>
                    <i style={{ background: p.color }} />
                    <span className="nm">{p.name}{p.id === state.youId ? " (คุณ)" : ""}</span>
                    <span className={p.modeVote ? "v" : "v none"}>{p.modeVote ? modeTitle(p.modeVote) : "–"}</span>
                  </li>
                ))}
              </ul>
            </section>

            <OcButton
              variant="primary"
              disabled={!focus || blocked(panelOpt) || myVote === panelOpt.mode}
              onClick={() => vote(panelOpt.mode)}
            >
              {panelOpt.suspended ? "พักใช้งาน" : !panelOpt.enabled ? MODE_NEED[panelOpt.mode] : myVote === panelOpt.mode ? "โหวตแล้ว" : "โหวต"}
            </OcButton>
          </OcPanel>
        )}
      </div>

      <OcButton variant="ghost" className="ocl-back oc-enter d2" onClick={() => socket.emit("modeBackToLobby")}>← ย้อนกลับ</OcButton>
    </div>
  );
}
