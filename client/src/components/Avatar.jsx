import { useState } from "react";
import { FALLBACK } from "../data/avatars";

// รูปตัวละคร: ใช้ img (ชื่อไฟล์ใน /avatars) ถ้ามี ไม่งั้น fallback เป็นอีโมจิตาม index
export default function Avatar({ img, index = 0, size = 56 }) {
  const [broken, setBroken] = useState(false);
  const src = img || null; // img = path เต็ม เช่น /characters/hikaru/hikaru_ginga.jpg
  return (
    <span
      className="relative inline-flex items-center justify-center rounded-full bg-white/15 overflow-hidden shrink-0 ring-2 ring-echo-purple/40"
      style={{ width: size, height: size, fontSize: size * 0.55 }}
    >
      {src && !broken ? (
        <img
          src={src}
          alt=""
          className="absolute w-full h-full object-cover"
          onError={() => setBroken(true)}
        />
      ) : (
        <span>{FALLBACK[index] || "🙂"}</span>
      )}
    </span>
  );
}
