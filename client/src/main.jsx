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

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {seraphPreview ? <SeraphPreview /> : <App />}
  </React.StrictMode>
);
