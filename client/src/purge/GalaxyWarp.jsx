// Purge: แคนวาสฉากพุ่งเข้าทางช้างเผือก (ปลายฉากเปิดตัว MatchIntro โหมด warp)
import { useEffect, useRef } from "react";
import { createWarpScene } from "./warpGalaxy";

export default function WarpGalaxy({ D, lowQ }) {
  const ref = useRef(null);
  useEffect(() => {
    let sc = null;
    try { sc = createWarpScene(ref.current, { D, lowQ }); } catch { sc = null; } // ไม่มี WebGL = เหลือแค่ซูมเส้น + แฟลช
    return () => sc?.dispose();
  }, [D, lowQ]);
  return <canvas ref={ref} className="ocx-warp-space" aria-hidden="true" />;
}
