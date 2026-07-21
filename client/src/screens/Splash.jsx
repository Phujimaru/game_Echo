import { clickSound } from "../audio";

// หน้าที่ 1: Title / Splash — ดีไซน์ทแยง ม่วง+น้ำเงิน / เทา halftone (คลิกที่ใดก็ได้เพื่อเริ่ม)
export default function Splash({ onEnter }) {
  const start = () => {
    clickSound();
    onEnter();
  };

  return (
    <div
      onClick={start}
      className="relative min-h-screen overflow-hidden cursor-pointer select-none"
    >
      {/* บล็อกม่วงใหญ่ (ตัดทแยง) */}
      <div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(135deg,#9b4f96,#8a3e85)",
          clipPath: "polygon(0 0, 56% 0, 30% 100%, 0 100%)",
        }}
      />
      {/* สามเหลี่ยมน้ำเงิน แนบขอบทแยง */}
      <div
        className="absolute inset-0"
        style={{ background: "#0b2d4a", clipPath: "polygon(56% 0, 66% 0, 30% 100%)" }}
      />

      {/* โลโก้ + บรรทัดผู้สร้าง */}
      <div className="absolute top-[9%] left-[6%]">
        <h1 className="glitch text-6xl sm:text-8xl font-black" data-text="ECHO">
          ECHO
        </h1>
        <p className="mt-4 text-white font-bold text-base sm:text-lg flex gap-8">
          <span>By Phujim@ru</span>
          <span>เวอร์ชัน 2.1.7</span>
        </p>
      </div>

      {/* คำใบ้ */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/70 text-sm animate-pulse">
        แตะเพื่อเริ่ม
      </div>
    </div>
  );
}
