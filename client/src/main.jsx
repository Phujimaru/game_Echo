import React from "react";
import { createRoot } from "react-dom/client";
// ธีมกลาง ORDEAL CALL ต้องโหลดก่อน App — CSS ของแต่ละหน้า (import ในคอมโพเนนต์) จะได้ทับค่าพื้นฐานอย่าง
//  .oc-panel { position: relative } ได้ (เคยโหลดทีหลัง ทำให้แผงเลือกโหมดหลุดไปมุมซ้ายบนในเกมจริง)
import "./oc/theme.css";
import App from "./App.jsx";
import SeraphPreview from "./seraph/Preview.jsx";
import "./index.css";
import "./seraph/seraph.css"; // เลเยอร์ SE.RA.PH — ต้องมาหลัง index.css เสมอ

// ?seraph = หน้าดูฉากของโหมด SE.RA.PH (งานภาพล้วน ไม่ต่อ socket) — ดู seraph/Preview.jsx
const seraphPreview = new URLSearchParams(location.search).has("seraph");
// ?arena=1..3 = หน้าดูสนาม 2.5D (เฉพาะ dev) — ดู journey/arena/ArenaPreview.jsx
const ArenaPreview = import.meta.env.DEV && new URLSearchParams(location.search).has("arena")
  ? React.lazy(() => import("./journey/arena/ArenaPreview.jsx"))
  : null;
// ?hud=1 = หน้าดูแผงตัวเรา (เฉพาะ dev) — ดู screens/hud/HudPreview.jsx · ?hud=1&game=1 = กระดานจริงด้วย state จำลอง
const hudQ = new URLSearchParams(location.search);
const HudPreview = import.meta.env.DEV && hudQ.has("hud")
  ? React.lazy(() => (hudQ.get("game") === "1" ? import("./screens/hud/GamePreview.jsx") : import("./screens/hud/HudPreview.jsx")))
  : null;

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {HudPreview ? <React.Suspense fallback={null}><HudPreview /></React.Suspense> : ArenaPreview ? <React.Suspense fallback={null}><ArenaPreview /></React.Suspense> : seraphPreview ? <SeraphPreview /> : <App />}
  </React.StrictMode>
);
