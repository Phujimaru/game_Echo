// ลูกโลก ORDEAL CALL สำหรับหน้าแรกของโปรแกรม (desktop/launcher)
//  หน้าแรกเป็นไฟล์ในเครื่อง + CSP script-src 'self' → โหลด ES module/CDN ไม่ได้
//  จึง build ไฟล์นี้เป็นสคริปต์ก้อนเดียวแบบ iife (รวม three) ด้วย client/vite.globe.config.js
//  → desktop/launcher/vendor/globe.js ซึ่งประกาศ window.EchoGlobe = { createGlobe, getEarth, THREE, ... }
export * from "./globeCore.js";
