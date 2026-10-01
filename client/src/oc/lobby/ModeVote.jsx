// เลือกโหมด (gameState TEAM_MODE) — หมุดโหมดบนลูกโลก กดหมุดหรือป้าย = ดูรายละเอียด · โหวตจริงที่ปุ่ม "โหวต" ในแผง (selectGameMode)
//  โหมดที่มีการเดินทาง (อิสระ/คู่หู/สหายทั้ง 3 เอ๋ย) แสดงเส้นทางภูมิภาค I→VII บนโลก (ดูอย่างเดียว)
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { socket } from "../../socket";
import { clickSound } from "../../audio";
import { dirFromLonLat, regionDir, COLORS } from "../../globe/globeCore";
import { JOURNEY_AREAS } from "../../journey/areas";
import { OcButton, OcPanel } from "../ui";
import EmoteDock from "./EmoteDock";

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

export default function ModeVote({ state, core, interceptRef, armed, onArm, onBack }) {
  const options = useOptions(state);
  const me = state.players.find((p) => p.id === state.youId);
  const myVote = me?.modeVote || null;
  const [focus, setFocus] = useState(() => myVote || options.find((o) => o.enabled)?.mode || options[0]?.mode || "ffa");
  // โหวตเปลี่ยน -> หันไปดูโหมดที่เพิ่งโหวต (ปรับ state ระหว่าง render ตามแนวทางของ React)
  const [seenVote, setSeenVote] = useState(myVote);
  if (seenVote !== myVote) { setSeenVote(myVote); if (myVote) setFocus(myVote); }

  const tagRefs = useRef({});
  const areaRefs = useRef([]);
  const scene = useRef(null); // { markers: {mode: group}, hits: [], route... }
  const optsRef = useRef(options);
  useLayoutEffect(() => { optsRef.current = options; });

  const vote = (mode) => {
    const opt = optsRef.current.find((o) => o.mode === mode);
    setFocus(mode);
    if (!opt || !opt.enabled || opt.suspended) return;
    clickSound();
    socket.emit("selectGameMode", { mode });
  };
  // กดหมุด/ป้าย = เลือกดูอย่างเดียว ยังไม่โหวต (ผู้ใช้สั่ง: ต้องกดยืนยันก่อน)
  const preview = (mode) => { if (mode !== focus) clickSound(); setFocus(mode); };
  const previewRef = useRef(preview);
  useLayoutEffect(() => { previewRef.current = preview; });

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
        el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -130%)`;
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
    interceptRef.current = (ev) => {
      const mode = pickMode(ev);
      if (!mode) return false;
      previewRef.current(mode);
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

  // โหมดที่เลือกดูอยู่: หันโลกเข้าหา + เส้นทางการเดินทาง
  useEffect(() => {
    const s = scene.current;
    if (!s || !core) return;
    const { THREE } = core;
    s.focus = focus;
    for (const [mode, m] of Object.entries(s.markers)) m.ring.material.opacity = mode === focus ? 0.9 : 0;
    if (s.markers[focus]) core.focusDir(s.markers[focus].dir);
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

  const focused = options.find((o) => o.mode === focus) || options[0];
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
              data-blocked={blocked(o) ? "true" : "false"}
              aria-disabled={blocked(o)}
              onClick={() => previewRef.current(o.mode)}
            >
              <span>{modeTitle(o.mode)}</span>
              {o.suspended ? <small>พักใช้งาน</small> : !o.enabled ? <small>{MODE_NEED[o.mode]}</small> : null}
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

      {focused && (
        <OcPanel className="ocl-votepanel oc-enter d1">
          <div className="ocl-vp-head">
            <h2 className="oc-h2">{modeTitle(focused.mode)}</h2>
            <span className="oc-muted">{MODE_SUBTITLES[focused.mode]}</span>
          </div>

          {JOURNEY.has(focused.mode) && (
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
            disabled={blocked(focused) || myVote === focused.mode}
            onClick={() => vote(focused.mode)}
          >
            {focused.suspended ? "พักใช้งาน" : !focused.enabled ? MODE_NEED[focused.mode] : myVote === focused.mode ? "โหวตแล้ว" : "โหวต"}
          </OcButton>
          <OcButton variant="ghost" className="ocl-vp-back" onClick={onBack}>← ย้อนกลับ</OcButton>
        </OcPanel>
      )}

      <EmoteDock armed={armed} onArm={onArm} className="ocl-dock ocl-dock-vote oc-enter d2" />
    </div>
  );
}
