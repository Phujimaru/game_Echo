// โหมด Purge: ฉากอุโมงค์ท่อ (three.js อยู่หลังกระดาน) + HUD ของโหมด (อยู่หน้ากระดาน)
//  ฉากเล่นตาม state.purge.scene (server พักเกมไว้ตามเวลาของฉาก):
//   intro = แฟลชแกนดาราจักร (ต่อจากฉากพุ่งเข้าทางช้างเผือก) จางเข้าอุโมงค์ แล้วกล้องไถลจากปลายท่อมาที่หมากของเรา
//   roll  = เฟสทอยเต๋า (PURGE_ROLL) — ทุกคนกดทอยพร้อมกัน ต่างคนต่างเดิน · ทางแยก = เลือกทาง · ใช้ไอเทมกระดานก่อนทอย
//   ort   = กล้องลงระดับพื้นมอง ORT จากมุมหมาก → ORT ทอยเต๋า (ทุกคนเห็นแต้ม) → เดิน/กลืน → กลับขึ้นกระดาน
//   fight = ซูมลงช่องปะทะ แล้วแฟลชขาว — ระหว่างสู้ (state.purge.fight) Game วาดสนามประลองของภูมิภาคแทน ท่อหยุดวาด (hidden)
import { useEffect, useMemo, useRef, useState } from "react";
import { createPurgeScene, REGIONS, REGION_STEPS, regionOfStep, FIGHT_ZOOM_SECONDS } from "./purgeScene";
import { socket } from "../socket";
import { clickSound } from "../audio";
import { TickSeconds } from "../tickStore";
import "./purge.css";

const ITEM_INFO = {
  dice2: { icon: "🎲", name: "เต๋าคู่" },
  golden: { icon: "🌟", name: "เต๋าทอง" },
  boots: { icon: "👟", name: "รองเท้าเร็ว" },
  trap: { icon: "💠", name: "กับดักผลึก" },
  push: { icon: "👐", name: "ผลัก" },
  shield: { icon: "🛡️", name: "โล่ผลึก" },
};
const LANE_NAME = { main: "ทางหลัก", short: "ทางลัด", long: "ทางอ้อม", secret: "ทางลับ" };
const MOD_NAME = { dice2: "เต๋าคู่", golden: "เต๋าทอง", boots: "+3" };

function sceneState(purge, players, youId) {
  return {
    me: youId,
    ort: purge.ort,
    walks: purge.walks || {},
    rolls: purge.rolls || {},
    players: players.filter((p) => !p.isBoss && purge.pl?.[p.id]).map((p) => {
      const ps = purge.pl[p.id];
      return {
        id: p.id,
        name: p.name,
        color: p.color,
        img: p.character?.img || p.img || null,
        node: ps.node,
        choices: ps.choices || null,
        finished: !!ps.finished,
        lost: purge.lost.includes(p.id) || p.purgeLost === true,
      };
    }),
  };
}

export default function PurgeStage({ purge, players, youId, night, hidden, gameState }) {
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const seqRef = useRef(null);
  const fightNodeRef = useRef(null);
  const [toast, setToast] = useState(null);
  const [lost, setLost] = useState(null);
  const [flash, setFlash] = useState(0);
  const [milky, setMilky] = useState(0);
  const [ortDice, setOrtDice] = useState(null);
  const [forkPos, setForkPos] = useState([]);
  const [picking, setPicking] = useState(null); // ไอเทมที่ต้องเลือกค่าก่อนใช้ (เต๋าทอง / ผลัก)
  const [viewChanged, setViewChanged] = useState(false); // ผู้เล่นหมุน/ซูมกล้องเอง → โชว์ปุ่มคืนมุม
  const [following, setFollowing] = useState(null);
  const [logOpen, setLogOpen] = useState(false);
  const [seenLog, setSeenLog] = useState(0); // id บันทึกล่าสุดที่เห็นแล้ว (จุดแจ้งเตือนบนแถบ)
  const timers = useRef([]);

  const st = useMemo(() => sceneState(purge, players, youId), [purge, players, youId]);
  const nodes = useMemo(() => {
    const m = {};
    for (const n of purge.board?.nodes || []) m[n.id] = n;
    return m;
  }, [purge.board]);
  const progOf = (id) => nodes[purge.pl?.[id]?.node]?.prog ?? 0;

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
      onView: (changed) => setViewChanged(changed),
      onOrtDice: (roll) => {
        const k = Date.now();
        setOrtDice({ roll, k });
        later(3200, () => setOrtDice((d) => (d && d.k === k ? null : d)));
      },
    });
    sceneRef.current = sc;
    return () => { list.forEach(clearTimeout); sc.dispose(); sceneRef.current = null; };
  }, []);

  useEffect(() => { sceneRef.current?.setPaused(!!hidden); }, [hidden]);
  useEffect(() => { sceneRef.current?.setNight(!!night); }, [night]);
  useEffect(() => { sceneRef.current?.setBoard(purge.board); }, [purge.board]);

  useEffect(() => {
    const sc = sceneRef.current;
    if (!sc) return;
    const scene = purge.scene;
    if (scene && scene.seq !== seqRef.current) {
      const first = seqRef.current === null;
      seqRef.current = scene.seq;
      if (scene.active && !first) {
        if (scene.kind === "intro") { setMilky(Date.now()); sc.playIntro(st); return; }
        if (scene.kind === "ort") { sc.playOrt(st, scene); return; }
        if (scene.kind === "fight") {
          sc.playFight(st, scene);
          fightNodeRef.current = scene.node;
          timers.current.push(setTimeout(() => setFlash(Date.now()), FIGHT_ZOOM_SECONDS * 1000 - 150));
          return;
        }
        if (scene.kind === "roll" && fightNodeRef.current) {
          sc.returnFromFight(fightNodeRef.current);
          fightNodeRef.current = null;
        }
        // ฉากก่อนหน้ายังไม่จบ (เครื่องช้า) แต่เทิร์นใหม่เริ่มแล้ว: ตัดไปที่กระดานทันที
        if (scene.kind === "roll" && sc.isBusy()) { sc.forceSync(st); return; }
      }
      if (first) {
        if (scene.active && scene.kind === "intro") { setMilky(Date.now()); sc.playIntro(st); return; }
        sc.forceSync(st);
        return;
      }
    }
    sc.sync(st);
  }, [purge, st]);

  const me = purge.pl?.[youId];
  const rolling = gameState === "PURGE_ROLL";
  const choices = rolling && me?.choices ? me.choices : null;

  // ปุ่มเลือกทาง: วางตามตำแหน่งช่องแรกของแต่ละทางบนจอ (อัปเดตตามกล้อง)
  useEffect(() => {
    if (!choices) return undefined;
    let raf = 0;
    const tick = () => {
      const sc = sceneRef.current;
      if (sc) {
        const next = choices.map((id) => { const q = sc.project(id, 2); return { id, x: Math.round(q.x), y: Math.round(q.y) }; });
        setForkPos((prev) => (prev.length === next.length && prev.every((p, i) => p.id === next[i].id && p.x === next[i].x && p.y === next[i].y) ? prev : next));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); setForkPos([]); };
  }, [choices]);

  const logList = purge.log || [];
  const lastLogId = logList.length ? logList[logList.length - 1].id : 0;
  const toggleLog = () => { clickSound(); setLogOpen((o) => !o); setSeenLog(lastLogId); };
  const follow = (id) => {
    clickSound();
    const next = following === id || id === youId ? null : id;
    setFollowing(next);
    sceneRef.current?.setFollow(next);
  };
  const roll = () => { clickSound(); setPicking(null); socket.emit("purgeRoll"); };
  const choose = (nextId) => { clickSound(); socket.emit("purgeChoose", { nextId }); };
  const applyItem = (it, extra = {}) => { clickSound(); setPicking(null); socket.emit("purgeItem", { uid: it.uid, ...extra }); };
  const onItem = (it) => {
    if (it.type === "golden" || it.type === "push") setPicking((p) => (p && p.uid === it.uid ? null : it));
    else applyItem(it);
  };

  const ort = purge.ort;
  const total = purge.board?.main || 150;
  const sx = (s) => `${(Math.min(total, s) / total) * 100}%`;
  const myProg = progOf(youId);
  const myReg = REGIONS[regionOfStep(myProg)];
  const watching = !!purge.fight && !purge.fight.ids.includes(youId);
  const humans = players.filter((p) => !p.isBoss && purge.pl?.[p.id]);
  const nameOf = (id) => players.find((p) => p.id === id)?.name || "?";
  const canAct = rolling && me && !me.finished && !purge.lost.includes(youId);
  const spectating = !hidden && (purge.lost.includes(youId) || !!me?.finished);
  const pushTargets = picking?.type === "push"
    ? humans.filter((p) => p.id !== youId && p.alive && !purge.pl[p.id].finished && progOf(p.id) - myProg >= 0 && progOf(p.id) - myProg <= 6)
    : [];
  const myGold = players.find((p) => p.id === youId)?.gold;

  return (
    <>
      <div className={`pg-stage purge-keep${hidden ? " is-hidden" : ""}`}><canvas ref={canvasRef} /></div>
      {milky > 0 && <div key={milky} className="pg-milky purge-keep" />}
      {flash > 0 && <div key={flash} className="pg-flash purge-keep" />}
      <div className={`pg-hud purge-keep${gameState === "GAMEOVER" ? " is-over" : ""}`}>
        <div className="pg-top">
          <div className="pg-chip">
            <span className="pg-chip-n" style={{ color: myReg.color }}>{myReg.n}</span>
            <span>{myReg.name}</span>
            <span className="pg-chip-step">ช่อง {Math.round(myProg)}</span>
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
                style={{ left: sx(progOf(p.id)), "--c": p.color || "#fff" }}
              />
            ))}
          </div>
          <div className="pg-chip pg-chip-ort">
            {ort == null ? `ORT ตื่นเทิร์น ${purge.ortTurn}` : `ORT · ช่อง ${ort}`}
          </div>
        </div>
        {purge.turn > 0 && (
          <div className="pg-turn">
            เทิร์น {purge.turn}{rolling && <> · ⏱️ <TickSeconds /> วิ</>}{myGold != null && <> · 💰 {myGold}</>}
          </div>
        )}
        {watching && <div className="pg-watch">ชมการปะทะ</div>}

        {/* ซ้าย: สถานะทุกคน (คลิกเพื่อตามดู) + อันดับเข้าเส้นชัย */}
        <div className="pg-side">
          {(rolling || spectating) && (
            <div className="pg-roster">
              {humans.map((p) => {
                const ps = purge.pl[p.id];
                const r = purge.rolls?.[p.id];
                const lostP = purge.lost.includes(p.id);
                const out = lostP || ps.finished;
                const on = following === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={out}
                    className={`pg-roster-row${out ? " is-out" : ""}${p.id === youId ? " is-me" : ""}${on ? " is-on" : ""}`}
                    style={{ "--c": p.color || "#fff" }}
                    onClick={() => follow(p.id)}
                  >
                    <span className="pg-roster-dot" />
                    <span className="pg-roster-name">{p.name}</span>
                    <span className="pg-roster-st">
                      {ps.finished ? `อันดับ ${ps.rank}` : lostP ? "LOST" : !rolling ? "" : ps.done && !r ? "⛓️" : ps.choices ? "เลือกทาง" : r ? `🎲 ${r.total}` : "…"}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          {purge.finished?.length > 0 && (
            <div className="pg-rank">
              {purge.finished.map((id, i) => (
                <div key={id} className={`pg-rank-row${id === youId ? " is-me" : ""}`}>
                  <b>{i + 1}</b><span>{nameOf(id)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ขวา: แผงบันทึกเหตุการณ์ สไลด์เปิด/ปิด */}
        <div className={`pg-logbox${logOpen ? " is-open" : ""}`}>
          <button type="button" className="pg-logtab" onClick={toggleLog}>
            <span>{logOpen ? "▶" : "◀"}</span>
            <span className="pg-logtab-t">บันทึก</span>
            {!logOpen && lastLogId > seenLog && <i className="pg-logdot" />}
          </button>
          <div className="pg-logpanel">
            <div className="pg-logh">บันทึก</div>
            <div className="pg-loglist">
              {logList.length === 0 && <div className="pg-logempty">—</div>}
              {[...logList].reverse().map((e) => (
                <div key={e.id} className="pg-logrow"><b>{e.turn}</b><span>{e.msg}</span></div>
              ))}
            </div>
          </div>
        </div>

        {viewChanged && !hidden && (
          <button type="button" className="pg-viewreset" onClick={() => { clickSound(); sceneRef.current?.resetView(); setFollowing(null); }}>มุมเดิม</button>
        )}

        {/* ปุ่มเลือกทางแยก */}
        {choices && forkPos.map((f) => {
          const n = nodes[f.id];
          if (!n) return null;
          const x = Math.max(80, Math.min(window.innerWidth - 80, f.x)), y = Math.max(140, Math.min(window.innerHeight - 200, f.y - 40));
          return (
            <button key={f.id} type="button" className={`pg-fork pg-fork-${n.kind}`} style={{ left: x, top: y }} onClick={() => choose(f.id)}>
              {LANE_NAME[n.kind] || "ทางหลัก"}
            </button>
          );
        })}

        {/* แผงทอยเต๋า + กระเป๋าไอเทม */}
        {canAct && (
          <div className="pg-act">
            {(me.items || []).length > 0 && !me.rolled && !me.done && (
              <div className="pg-bag">
                {me.items.map((it) => {
                  const info = ITEM_INFO[it.type] || { icon: "❔", name: it.type };
                  return (
                    <button key={it.uid} type="button" className={`pg-item${picking?.uid === it.uid ? " is-on" : ""}`} onClick={() => onItem(it)}>
                      <span className="pg-item-i">{info.icon}</span>
                      <span>{info.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
            {picking?.type === "golden" && (
              <div className="pg-pick">
                {[1, 2, 3, 4, 5, 6].map((v) => (
                  <button key={v} type="button" className="pg-pick-b" onClick={() => applyItem(picking, { value: v })}>{v}</button>
                ))}
              </div>
            )}
            {picking?.type === "push" && (
              <div className="pg-pick">
                {pushTargets.length ? pushTargets.map((p) => (
                  <button key={p.id} type="button" className="pg-pick-b is-wide" style={{ "--c": p.color || "#fff" }} onClick={() => applyItem(picking, { targetId: p.id })}>{p.name}</button>
                )) : <span className="pg-pick-none">ไม่มีเป้าหมาย</span>}
              </div>
            )}
            {choices ? (
              <div className="pg-wait">เลือกทาง</div>
            ) : !me.rolled && !me.done ? (
              <button type="button" className="pg-roll" onClick={roll}>
                <span className="pg-roll-die">🎲</span>
                <span>ทอยเต๋า</span>
                {me.mod && <span className="pg-roll-mod">{MOD_NAME[me.mod]}{me.mod === "golden" && me.golden ? ` ${me.golden}` : ""}</span>}
                {me.shield && <span className="pg-roll-mod">🛡️</span>}
              </button>
            ) : (
              <div className="pg-wait">{me.done && !purge.rolls?.[youId] && !purge.walks?.[youId] ? "⛓️ ติดหล่ม" : "รอผู้เล่นอื่น"}</div>
            )}
          </div>
        )}

        {ortDice && (
          <div key={ortDice.k} className="pg-ortdice">
            <div className="pg-ortdice-t">ORT</div>
            <div className="pg-ortdice-n">{ortDice.roll}</div>
          </div>
        )}
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
