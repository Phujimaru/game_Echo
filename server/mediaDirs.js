// โฟลเดอร์สื่อทั้งหมดที่เก็บบน Cloudflare R2 — /characters (รูป/วิดีโอ/เพลงตัวละคร), /item (ปืนหน่วย GUTS
//  Select + คีย์/วีดีโอกระสุน), /overload_force (สนาม), /theme_song + /effect_sound (เพลง/เสียง),
//  /image (พื้นหลัง + สแปลช), /mooncell (สื่อโหมด Moon Cell: เพลง/SFX — ฉากทั้งหมดวาดด้วย canvas แล้ว ไม่ใช้ GIF/ภาพสถานที่)
//  /journey (เพลงการเดินทาง 7 ภูมิภาค กลางวัน/กลางคืน + map.mp3 ของฉากแผนที่) · /purge (เพลงโหมด Purge)
//  ใช้ร่วมกัน: server/app.js (redirect ไป R2) · desktop/ (แคชไฟล์สื่อในเครื่องผู้เล่น)
module.exports = ["characters", "item", "overload_force", "theme_song", "effect_sound", "image", "mooncell", "journey", "purge"];
