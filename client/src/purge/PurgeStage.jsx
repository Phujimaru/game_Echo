// โหมด Purge: ฉากอุโมงค์ท่อ (three.js อยู่หลังกระดาน) + แถบท่อ/ป้ายภูมิภาค/LOST DATA (อยู่หน้ากระดาน)
//  ฉากเปิด/ฉากจบเทิร์นเล่นตาม state.purge.scene (server พักเฟส CUTSCENE ไว้ตามเวลาของฉาก)
import { useEffect, useMemo, useRef, useState } from "react";
import { createPurgeScene, REGIONS, regionOfStep } from "./purgeScene";
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

export default function PurgeStage({ purge, players, youId }) {
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const seqRef = useRef(null);
  const [toast, setToast] = useState(null);
  const [lost, setLost] = useState(null);
  const toastTimer = useRef(0);
  const lostTimer = useRef(0);

  const st = useMemo(() => sceneState(purge, players), [purge, players]);

  useEffect(() => {
    const sc = createPurgeScene(canvasRef.current, {
      onRegion: (i, name) => {
        clearTimeout(toastTimer.current);
        setToast({ i, name, k: Date.now() });
        toastTimer.current = setTimeout(() => setToast(null), 2800);
      },
      onLost: (names) => {
        clearTimeout(lostTimer.current);
        setLost({ names, k: Date.now() });
        lostTimer.current = setTimeout(() => setLost(null), 2600);
      },
    });
    sceneRef.current = sc;
    return () => { clearTimeout(toastTimer.current); clearTimeout(lostTimer.current); sc.dispose(); sceneRef.current = null; };
  }, []);

  useEffect(() => {
    const sc = sceneRef.current;
    if (!sc) return;
    const scene = purge.scene;
    if (scene && scene.seq !== seqRef.current) {
      const first = seqRef.current === null;
      seqRef.current = scene.seq;
      if (scene.active) {
        if (scene.kind === "intro") { sc.playIntro(st); return; }
        if (scene.kind === "turn") { sc.playTurn(st, scene); return; }
      }
      if (first) { sc.forceState(st); return; }
    }
    sc.setState(st);
  }, [purge, st]);

  const ort = purge.ort;
  const total = purge.totalSteps || 50;
  const sx = (s) => `${(s / total) * 100}%`;
  const myStep = purge.steps[youId] ?? 0;
  const myReg = REGIONS[regionOfStep(myStep)];

  return (
    <>
      <div className="pg-stage purge-keep"><canvas ref={canvasRef} /></div>
      <div className="pg-hud purge-keep">
        <div className="pg-top">
          <div className="pg-chip">
            <span className="pg-chip-n" style={{ color: myReg.color }}>{myReg.n}</span>
            <span>{myReg.name}</span>
            <span className="pg-chip-step">ช่อง {myStep}</span>
          </div>
          <div className="pg-track">
            {REGIONS.map((r, i) => (
              <span key={r.n} className="pg-seg" style={{ left: sx(i * 10), width: `calc(${sx(10)} - 2px)`, background: r.color }} />
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
