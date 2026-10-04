// Echo "นี่มันเกมของฉัน" — ตัวเชื่อมเวที canvas (echoQueenStage.js) กับ state ของเกม (จอคอมเท่านั้น)
//  back = สนามราชินีหลังการ์ดผู้เล่น · fx = ฉากเปิดตัว/กำปั้น/เอฟเฟกต์หน้าทุกอย่าง (ไม่รับคลิก)
//  mount ตลอดแมตช์ที่มี Echo (เวทีไม่ถูกสร้างใหม่ = ไม่โหลด/เตรียมภาพซ้ำ ไม่เล่นฉากซ้ำ)
//  - ฉากเปิดตัว: เฟส CUTSCENE kind "echoQueen" (server พักเกม 13 วิ)
//  - สนาม: state.echoField (รีคอนเนกต์กลางท่า = เข้าสนามทันที) · หายไป = ฉากออก
//  - ต่อย/โดนตี: state.attack (ATTACKING) ที่ Echo เป็นคนตี / ถูกตี — รวมตีฟรีช่วงจั่วไพ่
import { useEffect, useRef } from "react";
import { createEchoQueenStage } from "./echoQueenStage";
import "./echoQueen.css";

export default function EchoQueenLayer({ state, lowQ, seatCenter, onCover }) {
  const backRef = useRef(null);
  const fxRef = useRef(null);
  const stageRef = useRef(null);
  const coverRef = useRef(onCover);
  useEffect(() => { coverRef.current = onCover; }, [onCover]);

  useEffect(() => {
    const stage = createEchoQueenStage(backRef.current, fxRef.current, { lowQ, onCover: (c) => coverRef.current?.(c) });
    stageRef.current = stage;
    return () => { stage.destroy(); stageRef.current = null; coverRef.current?.(false); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- สร้างเวทีครั้งเดียว lowQ ส่งผ่าน setLowQ ด้านล่าง
  }, []);
  useEffect(() => { stageRef.current?.setLowQ(lowQ); }, [lowQ]);

  const cs = state.gameState === "CUTSCENE" && state.cutscene?.kind === "echoQueen" ? state.cutscene : null;
  const field = state.echoField || null;
  const atk = state.gameState === "ATTACKING" ? state.attack : null;
  const lastCs = useRef(null);
  const prevField = useRef(null);
  const lastAtk = useRef(null);

  // ฉากเปิดตัว (ต้องมาก่อน effect ของสนาม — สนามโผล่พร้อมฉากเปิดตัว ห้ามกระโดดเข้าสนามข้ามฉาก)
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !cs || lastCs.current === cs.id) return;
    lastCs.current = cs.id;
    stage.playTransform({ seat: seatCenter(cs.playerId) });
  }, [cs?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // เข้า/ออกสนาม
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    if (field) {
      if (stage.mode === "none" && !stage.busy && !cs) stage.enterField();
    } else if (prevField.current) {
      stage.exit({ seat: seatCenter(prevField.current.ownerId) });
    }
    prevField.current = field;
  }, [field?.seq, !!field, cs?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ต่อย (Echo ตี) / โดนตี (Echo ถูกตี)
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !atk || !field || lastAtk.current === atk.id) return;
    lastAtk.current = atk.id;
    if (atk.byId === field.ownerId && atk.targetId) {
      const me = atk.targetId === state.youId;
      const at = me ? [window.innerWidth / 2, window.innerHeight * .62] : (seatCenter(atk.targetId) || [window.innerWidth / 2, window.innerHeight * .3]);
      stage.punch({ at, me, dmg: atk.dmg || 0 });
    } else if (atk.targetId === field.ownerId && !atk.dodge) {
      stage.hit({ dmg: atk.dmg || 0 });
    }
  }, [atk?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <canvas ref={backRef} className="echoq-back" aria-hidden="true" />
      <canvas ref={fxRef} className="echoq-fx" aria-hidden="true" />
    </>
  );
}
