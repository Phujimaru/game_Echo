import { useEffect, useLayoutEffect, useRef } from "react";
import { createGlobe } from "./globeCore";

// ลูกโลกเต็มกรอบของตัวเอง (position:absolute inset:0) — หน้าจอเอาของ 3D ของตัวเองไปแปะใน onReady(core)
//  onReady คืนฟังก์ชัน cleanup ได้ (เรียกก่อน core.dispose ตอน unmount)
//  layout เปลี่ยนเมื่อไหร่ โลกค่อยๆ เลื่อน/ย่อไปตำแหน่งใหม่
export default function GlobeCanvas({ layout, drag = true, sand = true, autoSpin, onReady, className = "", style }) {
  const ref = useRef(null);
  const coreRef = useRef(null);
  const readyRef = useRef(onReady);
  useLayoutEffect(() => { readyRef.current = onReady; });

  useEffect(() => {
    const core = createGlobe(ref.current, { layout, drag, sand, autoSpin });
    coreRef.current = core;
    const cleanup = readyRef.current?.(core);
    return () => {
      if (typeof cleanup === "function") cleanup();
      core.dispose();
      coreRef.current = null;
    };
    // สร้างฉากครั้งเดียวต่อการ mount — ค่าที่เปลี่ยนภายหลังส่งผ่าน effect ด้านล่าง
  }, []);

  useEffect(() => { if (layout) coreRef.current?.setLayout(layout); }, [layout?.x, layout?.y, layout?.s]);
  useEffect(() => { coreRef.current?.setDrag(drag); }, [drag]);

  return (
    <canvas
      ref={ref}
      className={`oc-globe ${className}`}
      aria-hidden="true"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block", ...style }}
    />
  );
}
