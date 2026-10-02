// โหมด Purge: ฉากอุโมงค์ท่อ (three.js อยู่หลังกระดาน) + แถบท่อ/ป้ายภูมิภาค/LOST DATA (อยู่หน้ากระดาน)
//  ฉากเล่นตาม state.purge.scene (server พักเฟส CUTSCENE ไว้ตามเวลาของฉาก):
//   intro = ทางช้างเผือกละลายเข้าอุโมงค์ แล้วกล้องไถลจากปลายท่อมาที่จุดเกิด ORT · dice = ภาพรวม/ORT/ทอยเต๋า/เดิน
//   fight = ซูมลงช่องปะทะ แล้วแฟลชขาว — ระหว่างสู้ (state.purge.fight) Game วาดสนามประลองของภูมิภาคแทน ท่อหยุดวาด (hidden)
import { useEffect, useMemo, useRef, useState } from "react";
import { createPurgeScene, REGIONS, REGION_STEPS, regionOfStep, FIGHT_ZOOM_SECONDS } from "./purgeScene";
import { milkyWayUrl } from "./milkyway";
import "./purge.css";

function sceneState(purge, players) {
  return {
    ort: purge.ort,
    players: players.filter((p) => !p.isBoss).map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      img: p.character?.img || p.img || null,
      step: purge.steps[p.id] ?? 0,
      lost: purge.lost.includes(p.id) || p.purgeLost === true,
    })),
  };
}

export default function PurgeStage({ purge, players, youId, night, hidden }) {
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const seqRef = useRef(null);
  const fightTileRef = useRef(null);
  const [toast, setToast] = useState(null);
  const [lost, setLost] = useState(null);
  const [flash, setFlash] = useState(0);
  const [milky, setMilky] = useState(0);
  const timers = useRef([]);

  const st = useMemo(() => sceneState(purge, players), [purge, players]);

  useEffect(() => {
    const list = timers.current;
    const later = (ms, fn) => { list.push(setTimeout(fn, ms)); };
    const sc = createPurgeScene(canvasRef.current, {
      onRegion: (i, name) => {
        const k = Date.now();
        setToast({ i, name, k });
        later(2800, () => setToast((t) => (t && t.k === k ? null : t)));
      },
      onLost: (names) => {
        const k = Date.now();
        setLost({ names, k });
        later(2600, () => setLost((l) => (l && l.k === k ? null : l)));
      },
    });
    sceneRef.current = sc;
    return () => { list.forEach(clearTimeout); sc.dispose(); sceneRef.current = null; };
  }, []);

  useEffect(() => { sceneRef.current?.setPaused(!!hidden); }, [hidden]);
  useEffect(() => { sceneRef.current?.setNight(!!night); }, [night]);

  useEffect(() => {
    const sc = sceneRef.current;
    if (!sc) return;
    const scene = purge.scene;
    if (scene && scene.seq !== seqRef.current) {
      const first = seqRef.current === null;
      seqRef.current = scene.seq;
      if (scene.active) {
        if (scene.kind === "intro") {
          setMilky(Date.now());
          sc.playIntro(st);
          return;
        }
        if (scene.kind === "dice") {
          sc.playDice(st, scene, fightTileRef.current);
          fightTileRef.current = null;
          return;
        }
        if (scene.kind === "fight") {
          sc.playFight(st, scene, fightTileRef.current);
          fightTileRef.current = scene.tile;
          timers.current.push(setTimeout(() => setFlash(Date.now()), FIGHT_ZOOM_SECONDS * 1000 - 150));
          return;
        }
      }
      if (first) { sc.forceState(st); return; }
    }
    sc.setState(st);
  }, [purge, st]);

  const ort = purge.ort;
  const total = purge.totalSteps || 80;
  const sx = (s) => `${(s / total) * 100}%`;
  const myStep = purge.steps[youId] ?? 0;
  const myReg = REGIONS[regionOfStep(myStep)];
  const watching = !!purge.fight && !purge.fight.ids.includes(youId);
  const milkyUrl = useMemo(() => (milky ? milkyWayUrl() : null), [milky]);

  return (
    <>
      <div className={`pg-stage purge-keep${hidden ? " is-hidden" : ""}`}><canvas ref={canvasRef} /></div>
      {milky > 0 && <div key={milky} className="pg-milky purge-keep" style={{ backgroundImage: `url(${milkyUrl})` }} />}
      {flash > 0 && <div key={flash} className="pg-flash purge-keep" />}
      <div className="pg-hud purge-keep">
        <div className="pg-top">
          <div className="pg-chip">
            <span className="pg-chip-n" style={{ color: myReg.color }}>{myReg.n}</span>
            <span>{myReg.name}</span>
            <span className="pg-chip-step">ช่อง {myStep}</span>
          </div>
          <div className="pg-track">
            {REGIONS.map((r, i) => (
              <span key={r.n} className="pg-seg" style={{ left: sx(i * REGION_STEPS), width: `calc(${sx(REGION_STEPS)} - 2px)`, background: r.color }} />
            ))}
            {ort != null && <span className="pg-crystal" style={{ width: sx(ort) }} />}
            {ort != null && <span className="pg-ort" style={{ left: sx(ort) }} />}
            {st.players.map((p) => (
              <span
                key={p.id}
                className={`pg-mark${p.id === youId ? " is-me" : ""}${p.lost ? " is-lost" : ""}`}
                style={{ left: sx(p.step), "--c": p.color || "#fff" }}
              />
            ))}
          </div>
          <div className="pg-chip pg-chip-ort">
            {ort == null ? `ORT ตื่นเทิร์น ${purge.ortTurn}` : `ORT · ช่อง ${ort}`}
          </div>
        </div>
        {purge.turn > 0 && <div className="pg-turn">เทิร์น {purge.turn}</div>}
        {watching && <div className="pg-watch">ชมการปะทะ</div>}
        {toast && (
          <div key={toast.k} className="pg-toast">
            <div className="pg-toast-n" style={{ color: REGIONS[toast.i].color }}>{REGIONS[toast.i].n}</div>
            <div className="pg-toast-name">{REGIONS[toast.i].name}</div>
            {toast.name && <div className="pg-toast-who">{toast.name}</div>}
          </div>
        )}
        {lost && (
          <div key={lost.k} className="pg-lost">
            <div className="pg-lost-t">LOST DATA</div>
            <div className="pg-lost-who">{lost.names.join(" · ")}</div>
          </div>
        )}
      </div>
    </>
  );
}
