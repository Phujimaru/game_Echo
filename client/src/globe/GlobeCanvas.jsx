import { useContext, useEffect, useLayoutEffect, useRef } from "react";
import { createGlobe } from "./globeCore";
import { SharedGlobeContext, scopeCore } from "./SharedGlobe";

// ลูกโลกเต็มกรอบของตัวเอง (position:absolute inset:0) — หน้าจอเอาของ 3D ของตัวเองไปแปะใน onReady(core)
//  onReady คืนฟังก์ชัน cleanup ได้ (เรียกก่อนเก็บกวาด/ทำลายตอน unmount)
//  layout เปลี่ยนเมื่อไหร่ โลกค่อยๆ เลื่อน/ย่อไปตำแหน่งใหม่ (layoutRate = ความไหล ดู core.setLayout)
//  ถ้าอยู่ใต้ <SharedGlobeStage> จะยืมลูกโลกร่วมแทนการสร้างใหม่ (shared=false = บังคับสร้างของตัวเอง เช่นฉากซ้อนบนกระดาน)
//    กรณีนั้นวาด div โปร่งใสไว้ตรงที่ canvas เคยอยู่ เพื่อรับเมาส์แทน (canvas จริงอยู่ชั้นล่างสุด)
export default function GlobeCanvas({ layout, layoutRate, drag = true, sand = true, autoSpin, onReady, className = "", style, shared = true }) {
  const ctx = useContext(SharedGlobeContext);
  const useShared = shared && !!ctx;
  const sharedCore = useShared ? ctx.core : null;

  const ref = useRef(null);
  const coreRef = useRef(null);
  const readyRef = useRef(onReady);
  useLayoutEffect(() => { readyRef.current = onReady; });
  const layoutRef = useRef(layout);
  useLayoutEffect(() => { layoutRef.current = layout; });

  // ลูกโลกของตัวเอง
  useEffect(() => {
    if (useShared) return undefined;
    const core = createGlobe(ref.current, { layout, drag, sand, autoSpin });
    coreRef.current = core;
    const cleanup = readyRef.current?.(core);
    return () => {
      if (typeof cleanup === "function") cleanup();
      core.dispose();
      coreRef.current = null;
    };
    // สร้างฉากครั้งเดียวต่อการ mount — ค่าที่เปลี่ยนภายหลังส่งผ่าน effect ด้านล่าง
  }, [useShared]);

  // ยืมลูกโลกร่วม
  useEffect(() => {
    if (!sharedCore) return undefined;
    sharedCore.setEventTarget(ref.current);
    sharedCore.setDrag(drag);
    if (autoSpin != null) sharedCore.setAutoSpin(autoSpin);
    if (layoutRef.current) sharedCore.setLayout(layoutRef.current, false, layoutRate ?? 0.12);
    const { scoped, cleanup: scopeCleanup } = scopeCore(sharedCore);
    coreRef.current = scoped;
    const cleanup = readyRef.current?.(scoped);
    const el = ref.current;
    return () => {
      if (typeof cleanup === "function") cleanup();
      scopeCleanup();
      if (sharedCore.canvas === el) sharedCore.setEventTarget(null);
      coreRef.current = null;
    };
  }, [sharedCore]);

  useEffect(() => { if (layout) coreRef.current?.setLayout(layout, false, layoutRate ?? (useShared ? 0.12 : 0.02)); }, [layout?.x, layout?.y, layout?.s]);
  useEffect(() => { coreRef.current?.setDrag(drag); }, [drag]);

  if (useShared) {
    return (
      <div
        ref={ref}
        className={`oc-globe ${className}`}
        aria-hidden="true"
        style={{ position: "absolute", inset: 0, ...style }}
      />
    );
  }
  return (
    <canvas
      ref={ref}
      className={`oc-globe ${className}`}
      aria-hidden="true"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block", ...style }}
    />
  );
}
