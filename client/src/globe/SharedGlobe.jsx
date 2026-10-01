// ============================================================
//  ลูกโลกร่วม (ช่วงก่อนเข้าเกม: เลือกลำดับ → เลือกตัว → ห้องรอ → เลือกโหมด → จัดทีม)
//  App วาง <SharedGlobeStage> ไว้ชั้นล่างสุด — มี canvas ลูกเดียวค้างข้ามหน้า
//  หน้าจอแต่ละหน้ายังใช้ <GlobeCanvas layout onReady> เหมือนเดิม แต่ GlobeCanvas จะ "ยืม" ลูกโลกร่วมแทนการสร้างใหม่
//  → เปลี่ยนหน้า = โลกค่อยๆ เลื่อน/ย่อไปตำแหน่งของหน้าใหม่ (ใช้แทนม่านเปลี่ยนฉาก)
//  เข้าห้องครั้งแรก โลกเริ่มแบบซูมเต็มจอ (ต่อจากฉากซูมเข้าโลกของ launcher) แล้วถอยออก
// ============================================================
import { createContext, useEffect, useRef, useState } from "react";
import { createGlobe } from "./globeCore";

// { core } เมื่อฉากร่วมพร้อม · { core: null } = มีฉากร่วมแต่ยังสร้างไม่เสร็จ · null = ไม่มีฉากร่วม (หน้าจอสร้างลูกโลกเอง)
export const SharedGlobeContext = createContext(null);

const ZOOMED_IN = { x: 0, y: 0, s: 4.6 };

export function SharedGlobeStage({ active, children }) {
  const canvasRef = useRef(null);
  const [core, setCore] = useState(null);

  useEffect(() => {
    if (!active) return undefined;
    const c = createGlobe(canvasRef.current, { layout: ZOOMED_IN });
    setCore(c);
    return () => { setCore(null); c.dispose(); };
  }, [active]);

  return (
    <SharedGlobeContext.Provider value={active ? { core } : null}>
      {active && (
        <div className="oc-screen oc-stage" aria-hidden="true">
          <canvas ref={canvasRef} className="oc-stage-canvas" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }} />
        </div>
      )}
      {children}
    </SharedGlobeContext.Provider>
  );
}

/**
 * ห่อ core ร่วมให้หน้าจอหนึ่งหน้าใช้ — จำทุกอย่างที่หน้านั้นเพิ่ม (frame/click/hover, ของ 3D) แล้วเก็บกวาดตอนออกจากหน้า
 *  dispose() ของหน้าจอเป็น no-op (ห้ามทำลายลูกโลกร่วม)
 */
export function scopeCore(core) {
  const offs = [];
  const groups = [core.scene, core.world, core.tilt, core.spin];
  const before = groups.map((g) => new Set(g.children));
  const scoped = Object.create(core);
  for (const k of ["onFrame", "onClick", "onHover"]) {
    scoped[k] = (fn) => { const off = core[k](fn); offs.push(off); return off; };
  }
  scoped.dispose = () => {};
  const cleanup = () => {
    offs.forEach((off) => off());
    core.setDragHandler(null);
    core.setDrag(true);
    core.setAutoSpin(0.1);
    core.focusDir(null);
    core.world.rotation.set(0, 0, 0);
    groups.forEach((g, i) => {
      for (const child of [...g.children]) {
        if (before[i].has(child)) continue;
        g.remove(child);
        child.traverse((o) => {
          o.geometry?.dispose?.();
          const m = o.material;
          if (m) (Array.isArray(m) ? m : [m]).forEach((x) => { x.map?.dispose?.(); x.dispose(); });
        });
      }
    });
    const cam = core.camera;
    if (cam.fov !== 32 || cam.position.z !== 6 || cam.position.x || cam.position.y) {
      cam.fov = 32; cam.position.set(0, 0, 6); cam.rotation.set(0, 0, 0); cam.updateProjectionMatrix();
    }
  };
  return { scoped, cleanup };
}
