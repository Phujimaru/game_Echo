// ============================================================
//  หน้าทดสอบงานภาพของระบบ Journey (ไม่ต่อ socket ไม่ได้ผูกกับ routing ของแอป)
//  ใช้: import JourneyPreview from "./journey/JourneyPreview";  แล้ว render <JourneyPreview /> ชั่วคราว
//  props (ไม่บังคับ): initialArea, initialNight, initialLowQ, initialMap ("start" | "advance"), hidePanel
// ============================================================

import { useState } from "react";
import JourneyBackdrop from "./JourneyBackdrop";
import JourneyMap from "./JourneyMap";
import JourneyEmblem from "./Emblem";
import { JOURNEY_AREAS } from "./areas";

const btn = (on) => ({
  padding: "6px 12px",
  borderRadius: 6,
  border: `1px solid ${on ? "#e8bf5a" : "rgba(201,153,47,0.45)"}`,
  background: on ? "rgba(232,191,90,0.22)" : "rgba(10,6,4,0.7)",
  color: on ? "#fff3c8" : "#e7dcc4",
  font: "600 13px var(--font-av-body, Kanit, sans-serif)",
  cursor: "pointer",
});

export default function JourneyPreview({ initialArea = 1, initialNight = false, initialLowQ = false, initialMap = null, hidePanel = false }) {
  const [area, setArea] = useState(initialArea);
  const [night, setNight] = useState(initialNight);
  const [lowQ, setLowQ] = useState(initialLowQ);
  const [map, setMap] = useState(() =>
    initialMap === "start" ? { mode: "start", area: 1, from: 1, id: 1 } : initialMap === "advance" ? { mode: "advance", area: Math.min(7, initialArea + 1), from: initialArea, id: 1 } : null
  );
  const [runs, setRuns] = useState(1);

  const playStart = () => {
    setRuns((r) => r + 1);
    setMap({ mode: "start", area: 1, from: 1, id: runs + 1 });
  };
  const playAdvance = () => {
    const to = Math.min(7, area + 1);
    setRuns((r) => r + 1);
    setMap({ mode: "advance", area: to, from: area, id: runs + 1 });
  };
  const onDone = () => {
    if (map && map.mode === "advance") setArea(map.area);
    if (map && map.mode === "start") setArea(1);
    setMap(null);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000" }}>
      <div style={{ position: "absolute", inset: 0 }}>
        <JourneyBackdrop area={area} night={night} lowQ={lowQ} />
      </div>

      {!hidePanel && (
        <div
          style={{
            position: "absolute",
            left: 16,
            top: 16,
            zIndex: 10,
            display: "flex",
            flexDirection: "column",
            gap: 8,
            padding: 12,
            borderRadius: 10,
            background: "rgba(8,5,3,0.78)",
            border: "1px solid rgba(201,153,47,0.4)",
            color: "#efe2c4",
            font: "500 13px var(--font-av-body, Kanit, sans-serif)",
            maxWidth: 420,
          }}
        >
          <div style={{ fontWeight: 700, color: "#e8bf5a" }}>ทดสอบฉาก Journey</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {JOURNEY_AREAS.map((A) => (
              <button key={A.id} type="button" style={{ ...btn(area === A.id), display: "flex", alignItems: "center", gap: 4 }} title={A.name} onClick={() => setArea(A.id)}>
                <JourneyEmblem icon={A.icon} size="16px" color={A.color} />
                {A.id}
              </button>
            ))}
          </div>
          <div style={{ color: JOURNEY_AREAS[area - 1].color }}>
            ภูมิภาคที่ {area} · {JOURNEY_AREAS[area - 1].name}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            <button type="button" style={btn(!night)} onClick={() => setNight(false)}>
              กลางวัน
            </button>
            <button type="button" style={btn(night)} onClick={() => setNight(true)}>
              กลางคืน
            </button>
            <button type="button" style={btn(lowQ)} onClick={() => setLowQ((v) => !v)}>
              โหมดประหยัด {lowQ ? "เปิด" : "ปิด"}
            </button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            <button type="button" style={btn(false)} onClick={playStart}>
              เล่นแผนที่: เริ่มการเดินทาง
            </button>
            <button type="button" style={btn(false)} onClick={playAdvance} disabled={area >= 7}>
              เล่นแผนที่: ไปภูมิภาคถัดไป
            </button>
          </div>
        </div>
      )}

      {map && (
        <JourneyMap
          key={map.id}
          mode={map.mode}
          area={map.area}
          fromArea={map.from}
          durationMs={map.mode === "start" ? 7000 : 6000}
          lowQ={lowQ}
          onDone={onDone}
        />
      )}
    </div>
  );
}
