import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import "../oc/ui-extra/curtain.css";

export const SCREEN_ORDER = { splash: 0, setup: 1, character: 2, connecting: 2.5, lobby: 3, gameintro: 3.5, ortarrival: 3.5, game: 4 };
// หน้าก่อนเข้าเกมใช้ลูกโลกร่วมเลื่อนเป็นฉากเปลี่ยนหน้าแทน — สลับกันเองไม่ต้องมีม่าน (5.1.2)
//  gameintro = ฉากเปิดแมตช์ (MatchIntro) ใช้ลูกโลกร่วมใบเดิมต่อจากหน้าเลือกโหมด จนจังหวะชนผิวโลก (5.1.6)
export const GLOBE_SCREENS = new Set(["setup", "character", "connecting", "lobby", "gameintro"]);
const quiet = (a, b) => GLOBE_SCREENS.has(a) && GLOBE_SCREENS.has(b);

// ม่านเปลี่ยนฉาก ORDEAL CALL: แผ่นขาวเฉียงมีกริดกวาดผ่านจอ (ขอบนำ/ขอบท้าย = แถบฟ้าน้ำแข็ง + เส้นม่วง ECHO บาง)
//  โหมด sweep (preTrigger / เปลี่ยน screenKey): ปิดจอทึบช่วง ~420–1000ms แล้วกวาดออก จบใน 1.8 วิ
//    App.navigate สลับเนื้อหาที่ 660ms และปลดล็อกที่ 1860ms — ห้ามขยับช่วงปิดจอทึบออกนอกจังหวะนี้
//  โหมด hold (holdCover → release): ปิดค้างจนกว่าจะสั่งปล่อย (อย่างน้อย MIN_HOLD_MS) แล้วกวาดออกใน 520ms
const TransitionCurtain = forwardRef(function TransitionCurtain({ screenKey }, ref) {
  const [state, setState] = useState({ visible: false, mode: "sweep", phase: null, direction: "forward", playId: 0 });
  const liveRef = useRef({ visible: false, mode: "sweep", phase: null });

  const prevKey = useRef(screenKey);
  const prevOrder = useRef(SCREEN_ORDER[screenKey] ?? 0);
  const firstRun = useRef(true);
  const timers = useRef([]);
  const holdStart = useRef(0);
  const MIN_HOLD_MS = 1150;

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  const hide = () => {
    liveRef.current = { ...liveRef.current, visible: false };
    setState((s) => ({ ...s, visible: false }));
  };

  const playSweep = (dir) => {
    clearTimers();
    liveRef.current = { visible: true, mode: "sweep", phase: null };
    setState((s) => ({ visible: true, mode: "sweep", phase: null, direction: dir, playId: s.playId + 1 }));
    timers.current.push(setTimeout(hide, 1800));
  };

  const startHold = (dir) => {
    clearTimers();
    holdStart.current = Date.now();
    liveRef.current = { visible: true, mode: "hold", phase: "in" };
    setState((s) => ({ visible: true, mode: "hold", phase: "in", direction: dir, playId: s.playId + 1 }));
    timers.current.push(setTimeout(() => {
      const cur = liveRef.current;
      if (cur.mode !== "hold" || cur.phase !== "in") return;
      liveRef.current = { ...cur, phase: "held" };
      setState((s) => ({ ...s, phase: "held" }));
    }, 420));
    timers.current.push(setTimeout(() => releaseHold(), 6000));
  };

  const releaseHold = () => {
    const cur = liveRef.current;
    if (cur.mode !== "hold" || cur.phase === "out" || !cur.visible) return;
    // ค้างจออย่างน้อย MIN_HOLD_MS เสมอ — ถ้า server ตอบเร็วมาก ม่านจะถูกเปิดตั้งแต่ยังปิดไม่ทันเต็มจอ
    const waited = Date.now() - holdStart.current;
    if (waited < MIN_HOLD_MS) {
      clearTimers();
      if (cur.phase === "in") {
        timers.current.push(setTimeout(() => {
          const c = liveRef.current;
          if (c.mode !== "hold" || c.phase !== "in") return;
          liveRef.current = { ...c, phase: "held" };
          setState((st) => ({ ...st, phase: "held" }));
        }, Math.max(0, 440 - waited)));
      }
      timers.current.push(setTimeout(releaseHold, MIN_HOLD_MS - waited));
      return;
    }
    clearTimers();
    liveRef.current = { ...cur, phase: "out" };
    setState((s) => ({ ...s, phase: "out" }));
    timers.current.push(setTimeout(hide, 520));
  };

  useImperativeHandle(ref, () => ({
    preTrigger(targetKey) {
      const order = SCREEN_ORDER[targetKey] ?? 0;
      const dir = order >= prevOrder.current ? "forward" : "back";
      const silent = quiet(prevKey.current, targetKey);
      prevKey.current = targetKey;
      prevOrder.current = order;
      if (!silent) playSweep(dir);
    },
    holdCover(dir = "forward") {
      startHold(dir);
    },
    // ข้ามม่านไปเลยสำหรับรอยต่อที่มีอนิเมชันของตัวเองอยู่แล้ว (ฉากเปิดตัวผู้เล่น -> สนาม)
    skip(targetKey) {
      prevKey.current = targetKey;
      prevOrder.current = SCREEN_ORDER[targetKey] ?? 0;
    },
    release() {
      releaseHold();
    },
  }));

  useLayoutEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      prevKey.current = screenKey;
      prevOrder.current = SCREEN_ORDER[screenKey] ?? 0;
      return;
    }
    if (screenKey === prevKey.current) return;
    const order = SCREEN_ORDER[screenKey] ?? 0;
    const dir = order >= prevOrder.current ? "forward" : "back";
    const silent = quiet(prevKey.current, screenKey);
    prevKey.current = screenKey;
    prevOrder.current = order;
    if (silent && !(liveRef.current.mode === "hold" && liveRef.current.visible)) return;

    const holding = liveRef.current.mode === "hold" && liveRef.current.visible;
    if (holding) {
      if (screenKey !== "connecting") releaseHold();
    } else {
      playSweep(dir);
    }
  }, [screenKey]);

  if (!state.visible) return null;

  return (
    <div
      key={state.playId}
      className="occ"
      data-mode={state.mode}
      data-phase={state.phase || ""}
      data-dir={state.direction}
      aria-hidden="true"
    >
      <div className="occ-sheets">
        <i className="occ-sheet"><span className="occ-clip"><span className="occ-grid" /></span></i>
      </div>
      <div className="occ-core">
        <span className="occ-core-box">
          <b className="occ-logo">ECHO</b>
          <span className="occ-sub">ORDEAL <em>CALL</em></span>
          <span className="occ-bar"><i /></span>
        </span>
      </div>
    </div>
  );
});

export default TransitionCurtain;
