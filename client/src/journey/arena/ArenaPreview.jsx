// หน้าดูสนาม 2.5D แบบไม่ต่อ socket (เฉพาะ dev): ?arena=1..7&n=0..6&night=1&lowq=1
//  การ์ดผู้เล่นเป็นกล่องจำลองขนาดเท่าการ์ดจริง (236×150) วางด้วยสูตรเดียวกับ Game.jsx
import { useEffect, useMemo, useState } from "react";
import ArenaScene from "./ArenaScene";
import { arenaLayout, ARENA_CARD_SCALE } from "./arenaData";

const COLS = ["#3d8bd9", "#9b4f96", "#e0812f", "#2fa39a", "#d2455b", "#6b7fd6", "#c49a2c"];

export default function ArenaPreview() {
  const q = new URLSearchParams(location.search);
  const area = Math.min(7, Math.max(1, Number(q.get("arena")) || 1));
  const n = Math.min(6, Math.max(0, Number(q.get("n") ?? 6)));
  const night = q.get("night") === "1";
  const lowQ = q.get("lowq") === "1";
  const bare = q.get("bare") === "1"; // ฉากเปล่า ไม่มีกล่องจำลอง (ไว้ถ่ายภาพไปทำดีไซน์)
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const on = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  const lay = useMemo(() => arenaLayout(vp.w, vp.h, area, n), [vp.w, vp.h, area, n]);
  const seats = useMemo(() => [{ phi: 90, col: COLS[0], me: true }, ...lay.others.map((o, i) => ({ phi: o.phi, stem: o.stem, col: COLS[(i + 1) % 7] }))], [lay]);
  return (
    <div style={{ position: "fixed", inset: 0, overflow: "hidden", background: "#000" }}>
      <ArenaScene area={area} night={night} lowQ={lowQ} W={vp.w} H={vp.h} seats={seats} />
      {!bare && lay.others.map((o, i) => (
        <div
          key={i}
          style={{
            position: "absolute", left: o.x, top: o.bottom, width: 236, height: 150,
            transform: `translate(-50%, -100%) scale(${o.s * ARENA_CARD_SCALE})`, transformOrigin: "bottom center",
            background: "rgba(18,38,74,0.88)", border: `2px solid ${COLS[(i + 1) % 7]}`, color: "#eaf3fc",
            font: "500 15px Kanit, sans-serif", display: "grid", placeItems: "center",
            animation: lowQ ? undefined : `arSeatIn 0.6s cubic-bezier(0.2, 0.8, 0.3, 1.2) ${2.9 + i * 0.09}s both`,
          }}
        >
          ผู้เล่น {i + 2}
        </div>
      ))}
      {!bare && <div style={{ position: "absolute", left: lay.center.x, top: lay.center.y, width: 90, height: 124, transform: "translate(-50%, -92%)", background: "#12264a", border: "2px solid #f0c868" }} />}
      {!bare && <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 270, background: "linear-gradient(0deg, rgba(10,24,50,0.85), rgba(10,24,50,0.35))", borderTop: "1px dashed rgba(255,255,255,0.4)" }} />}
    </div>
  );
}
